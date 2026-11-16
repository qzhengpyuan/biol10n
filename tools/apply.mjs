#!/usr/bin/env node
/**
 * 构建 + 装进本机 ScriptCat，并回读已安装版本。
 * 用法: node tools/apply.mjs
 * 前置: 本机 127.0.0.1:8765 提供 dist/ 静态服务；BrowserOS neo 开 CDP（默认 9227）。
 * 并发: 用 /tmp/biol10n-apply.lock 串行化，多个子代理同时调用也不会互相打断。
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.dirname(new URL(import.meta.url).pathname) + "/..";
const port = process.env.CDP_PORT || "9227";
const extId = process.env.SC_EXT_ID || "pfgknhjjodmdokgbmkgdnlbgfondkfhe";
const server = process.env.DIST_SERVER || "http://127.0.0.1:8765";
const lockPath = "/tmp/biol10n-apply.lock";

function acquireLock() {
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    try {
      const fd = fs.openSync(lockPath, "wx");
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      return;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      // 超龄锁（进程已死）直接清掉
      try {
        const pid = Number(fs.readFileSync(lockPath, "utf8"));
        if (pid && !fs.existsSync("/proc/" + pid)) { fs.rmSync(lockPath, { force: true }); continue; }
      } catch {}
      execFileSync("sleep", ["0.5"]);
    }
  }
  throw new Error("等锁超时: " + lockPath);
}
function releaseLock() { fs.rmSync(lockPath, { force: true }); }

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    ws.onopen = () => resolve({
      send(method, params = {}, sessionId) {
        const mid = ++id;
        const msg = { id: mid, method, params };
        if (sessionId) msg.sessionId = sessionId;
        ws.send(JSON.stringify(msg));
        return new Promise((res, rej) => pending.set(mid, { res, rej }));
      },
      close() { ws.close(); }
    });
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id);
        pending.delete(m.id);
        m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
      }
    };
    ws.onerror = (e) => reject(new Error("CDP 连接失败: " + (e.message || e)));
  });
}

acquireLock();
try {
  const build = execFileSync("node", ["build.mjs"], { cwd: root, encoding: "utf8" });
  process.stdout.write(build);

  const head = await fetch(server + "/biol10n.user.js");
  if (!head.ok) throw new Error("静态服务不可用: " + server + "（先在 dist/ 里起 python3 -m http.server 8765 --bind 127.0.0.1）");

  const base = "http://127.0.0.1:" + port;
  const ver = await (await fetch(base + "/json/version")).json();
  const b = await connect(ver.webSocketDebuggerUrl);

  // 1) 打开脚本地址，ScriptCat 会跳到安装页
  const t1 = await b.send("Target.createTarget", { url: server + "/biol10n.user.js" });
  await new Promise((r) => setTimeout(r, 2500));
  const list = await (await fetch(base + "/json/list")).json();
  const installPage = list.find((t) => t.type === "page" && t.url.includes("/src/install.html"));
  if (!installPage) throw new Error("没打开安装页（脚本猫是否已加载？）");
  const s1 = await b.send("Target.attachToTarget", { targetId: installPage.id, flatten: true });
  const send1 = (m, p = {}) => b.send(m, p, s1.sessionId);
  await send1("Runtime.enable");
  const click = await send1("Runtime.evaluate", {
    expression: "(()=>{const b=[...document.querySelectorAll('button')].find(x=>['更新','安装'].includes(x.textContent.trim()));if(!b)return 'no-btn';b.click();return 'clicked '+b.textContent.trim();})()",
    returnByValue: true
  });
  console.log("[apply]", click.result.value);
  await new Promise((r) => setTimeout(r, 2500));
  // 安装页装完会自己关掉，这里忽略"目标不存在"
  await b.send("Target.closeTarget", { targetId: installPage.id }).catch(() => {});
  await b.send("Target.closeTarget", { targetId: t1.targetId }).catch(() => {});

  // 2) 回读已安装版本
  const t2 = await b.send("Target.createTarget", { url: "chrome-extension://" + extId + "/src/options.html" });
  await new Promise((r) => setTimeout(r, 2500));
  const s2 = await b.send("Target.attachToTarget", { targetId: t2.targetId, flatten: true });
  const send2 = (m, p = {}) => b.send(m, p, s2.sessionId);
  await send2("Runtime.enable");
  const check = await send2("Runtime.evaluate", {
    expression: "(async()=>{const st=await chrome.storage.local.get(null);const keys=Object.keys(st).filter(k=>k.startsWith('script:'));return JSON.stringify(keys.map(k=>st[k].name+' @'+st[k].metadata.version));})()",
    returnByValue: true,
    awaitPromise: true
  });
  console.log("[apply] 已安装:", check.result.value);
  await b.send("Target.closeTarget", { targetId: t2.targetId }).catch(() => {});
  b.close();
} finally {
  releaseLock();
}
