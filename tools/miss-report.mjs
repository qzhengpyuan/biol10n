#!/usr/bin/env node
/**
 * 用真实浏览器（CDP）打开一个页面，列出「脚本跑完后仍然是英文」的短文本与属性。
 * 用法: node tools/miss-report.mjs <siteId> <url> [waitMs]
 * 依赖: 本机已跑 BrowserOS neo 并开放 --remote-debugging-port（默认 9227）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const port = process.env.CDP_PORT || "9227";
const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const [siteId, url, waitArg] = process.argv.slice(2);
if (!siteId || !url) {
  console.error("用法: node tools/miss-report.mjs <siteId> <url> [waitMs]");
  process.exit(2);
}
const waitMs = Number(waitArg || 15000);

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    ws.onopen = () =>
      resolve({
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

const COLLECTOR = `(() => {
  const SKIP = new Set(["SCRIPT","STYLE","NOSCRIPT","CODE","PRE","KBD","SAMP","TEXTAREA","SVG","MATH"]);
  const texts = new Map();
  const tw = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
  while (tw.nextNode()) {
    const n = tw.currentNode;
    const p = n.parentElement;
    if (!p || SKIP.has(p.tagName)) continue;
    if (p.closest("code,pre,svg,script,style,.highlight,.blob-code")) continue;
    const t = (n.nodeValue || "").replace(/\\s+/g, " ").trim();
    if (!t || t.length > 80) continue;
    if (/[\\u3400-\\u9fff]/.test(t)) continue;
    if (!/[A-Za-z]/.test(t)) continue;
    texts.set(t, (texts.get(t) || 0) + 1);
  }
  const attrs = [];
  const seen = new Set();
  for (const el of document.querySelectorAll("input,textarea,img,button,a,[placeholder],[title],[aria-label],[alt]")) {
    const names = ["placeholder", "title", "aria-label", "alt"];
    // 隐藏控件（type=hidden）里的 value 是给站点 JS 读的配置，不是可见文字，翻它反而会改坏行为
    if ((el.tagName === "INPUT" && el.type !== "hidden") || el.tagName === "TEXTAREA") names.push("value");
    for (const name of names) {
      const v = (el.getAttribute(name) || "").replace(/\\s+/g, " ").trim();
      // 上限 200：miRBase 的 175 字符 textarea placeholder 曾被 100 的阈值整条漏掉
      if (!v || v.length > 200) continue;
      if (!/[A-Za-z]/.test(v) || /[\\u3400-\\u9fff]/.test(v)) continue;
      const k = name + "=" + v;
      if (seen.has(k)) continue;
      seen.add(k);
      attrs.push([name, v, el.tagName.toLowerCase()]);
    }
  }
  return JSON.stringify({
    title: document.title,
    url: location.href,
    translated: !!window.__BIOL10N,
    stats: window.__BIOL10N ? window.__BIOL10N.stats() : null,
    texts: [...texts.entries()].sort((a, b) => b[1] - a[1]),
    attrs
  });
})()`;

const base = "http://127.0.0.1:" + port;
const ver = await (await fetch(base + "/json/version")).json();
const b = await connect(ver.webSocketDebuggerUrl);
const { targetId } = await b.send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await b.send("Target.attachToTarget", { targetId, flatten: true });
const send = (m, p = {}) => b.send(m, p, sessionId);
await send("Page.enable");
await send("Runtime.enable");
await send("Page.navigate", { url });

const deadline = Date.now() + 45000;
while (Date.now() < deadline) {
  const s = await send("Runtime.evaluate", { expression: "document.readyState", returnByValue: true });
  if (s.result.value === "complete") break;
  await new Promise((r) => setTimeout(r, 500));
}
await new Promise((r) => setTimeout(r, waitMs));
// 滚动一遍，触发懒加载
await send("Runtime.evaluate", {
  expression: "(()=>{let y=0;const h=()=>document.body.scrollHeight;const id=setInterval(()=>{window.scrollBy(0,800);y+=800;if(y>h()){clearInterval(id);window.__l10nScrollDone=true;}},120);window.__l10nScroll=id;return 'scrolling'})()",
  returnByValue: true
});
await new Promise((r) => setTimeout(r, 3000));
await send("Runtime.evaluate", { expression: "(()=>{if(window.__l10nScroll)clearInterval(window.__l10nScroll);window.scrollTo(0,0);return 'reset'})()", returnByValue: true });
await new Promise((r) => setTimeout(r, 1200));

const res = await send("Runtime.evaluate", { expression: COLLECTOR, returnByValue: true });
if (res.exceptionDetails) {
  console.error("采集失败:", JSON.stringify(res.exceptionDetails).slice(0, 300));
  process.exit(1);
}
const data = JSON.parse(res.result.value);
data.siteId = siteId;
data.collectedAt = new Date().toISOString();

fs.mkdirSync(path.join(root, "research"), { recursive: true });
fs.writeFileSync(path.join(root, "research", "miss-" + siteId + ".json"), JSON.stringify(data, null, 1));

const shot = await send("Page.captureScreenshot", { format: "png" });
const shotDir = path.join(root, "research", "shots");
fs.mkdirSync(shotDir, { recursive: true });
fs.writeFileSync(path.join(shotDir, siteId + ".png"), Buffer.from(shot.data, "base64"));

await b.send("Target.closeTarget", { targetId });
b.close();

console.log("#", siteId, "|", data.title, "| 已注入:", data.translated, "| 统计:", JSON.stringify(data.stats));
console.log("# 文本 " + data.texts.length + " 条，属性 " + data.attrs.length + " 条");
for (const [t, c] of data.texts.slice(0, 80)) console.log((c > 1 ? "[" + c + "] " : "      ") + t);
for (const [name, v, tag] of data.attrs.slice(0, 25)) console.log("  @" + name + " <" + tag + "> " + v);
