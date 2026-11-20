#!/usr/bin/env node
/**
 * 构建 + 装进本机 ScriptCat，并回读已安装版本。
 * 用法: node tools/apply.mjs
 * 前置: BrowserOS neo 开 CDP（默认 9227）。静态服务（默认 127.0.0.1:8765，服务 dist/）没起会自动拉起。
 * 说明: 扩展 id 不写死 —— 从安装页 URL 反查，避免机器上装了多个 ScriptCat 时装到 A 却回读 B。
 * 并发: 用 /tmp/biol10n-apply.lock 串行化，多个子代理同时调用也不会互相打断。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawn } from "node:child_process";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const port = process.env.CDP_PORT || "9227";
const server = process.env.DIST_SERVER || "http://127.0.0.1:8765";
const lockPath = "/tmp/biol10n-apply.lock";
const serverPidPath = "/tmp/biol10n-dist-server.pid";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

async function serverReady() {
  try {
    const r = await fetch(server + "/biol10n.user.js");
    return r.ok;
  } catch { return false; }
}

/** dist/ 的静态服务没起就拉起来（python3 http.server，只绑回环）。 */
async function ensureServer() {
  if (await serverReady()) return false;
  const dist = path.join(root, "dist");
  const portNum = new URL(server).port || "8765";
  const logs = fs.openSync("/tmp/biol10n-dist-server.log", "a");
  const child = spawn("python3", ["-m", "http.server", portNum, "--bind", "127.0.0.1"], {
    cwd: dist,
    detached: true,
    stdio: ["ignore", logs, logs]
  });
  child.unref();
  try { fs.writeFileSync(serverPidPath, String(child.pid)); } catch {}
  for (let i = 0; i < 25; i++) {
    await sleep(300);
    if (await serverReady()) return true;
  }
  throw new Error("静态服务起不来: " + server + "（手动: cd dist && python3 -m http.server " + portNum + " --bind 127.0.0.1）");
}

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
  const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;

  const started = await ensureServer();
  if (started) console.log("[apply] 已拉起静态服务 " + server);

  const base = "http://127.0.0.1:" + port;
  const ver = await (await fetch(base + "/json/version")).json();
  const b = await connect(ver.webSocketDebuggerUrl);

  // 1) 打开脚本地址，脚本猫会接管并跳到它自己的安装页
  const t1 = await b.send("Target.createTarget", { url: server + "/biol10n.user.js" });
  await sleep(2500);
  const list = await (await fetch(base + "/json/list")).json();
  const installPage = list.find((t) => t.type === "page" && t.url.includes("/src/install.html"));
  if (!installPage) throw new Error("没打开安装页（脚本猫是否已加载？）");
  const m = /^chrome-extension:\/\/([a-p]{32})\//.exec(installPage.url);
  if (!m) throw new Error("安装页 URL 里没有扩展 id: " + installPage.url);
  const extId = m[1];
  console.log("[apply] 安装页扩展 id:", extId);

  const s1 = await b.send("Target.attachToTarget", { targetId: installPage.id, flatten: true });
  const send1 = (mm, p = {}) => b.send(mm, p, s1.sessionId);
  await send1("Runtime.enable");
  const click = await send1("Runtime.evaluate", {
    expression: "(()=>{const b=[...document.querySelectorAll('button')].find(x=>['更新','安装'].includes(x.textContent.trim()));if(!b)return 'no-btn';b.click();return 'clicked '+b.textContent.trim();})()",
    returnByValue: true
  });
  console.log("[apply]", click.result.value);
  await sleep(2500);
  await b.send("Target.closeTarget", { targetId: installPage.id }).catch(() => {});
  await b.send("Target.closeTarget", { targetId: t1.targetId }).catch(() => {});

  // 2) 回读同一个扩展里已安装的版本
  const t2 = await b.send("Target.createTarget", { url: "chrome-extension://" + extId + "/src/options.html" });
  await sleep(2500);
  const s2 = await b.send("Target.attachToTarget", { targetId: t2.targetId, flatten: true });
  const send2 = (mm, p = {}) => b.send(mm, p, s2.sessionId);
  await send2("Runtime.enable");
  const check = await send2("Runtime.evaluate", {
    expression: "(async()=>{const st=await chrome.storage.local.get(null);const keys=Object.keys(st).filter(k=>k.startsWith('script:'));return JSON.stringify(keys.map(k=>st[k].name+' @'+st[k].metadata.version));})()",
    returnByValue: true,
    awaitPromise: true
  });
  console.log("[apply] 已安装:", check.result.value);
  const got = String(check.result.value || "");
  if (!got.includes("@" + version)) {
    throw new Error("回读版本与 package.json 不一致（期望 " + version + "）: " + got);
  }
  await b.send("Target.closeTarget", { targetId: t2.targetId }).catch(() => {});
  b.close();
} finally {
  releaseLock();
}
