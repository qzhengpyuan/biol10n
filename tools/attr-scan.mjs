#!/usr/bin/env node
/**
 * 属性通道普查：打开一个页面，列出「脚本跑完后仍是英文」的属性值，按属性名分组计数。
 * 用途：r30 T5。文本通道由 miss-report.mjs 覆盖，本脚本只盯属性。
 * 用法: node tools/attr-scan.mjs <siteId> <url> [waitMs] [--top N]
 * 依赖: 本机 BrowserOS neo 开放 --remote-debugging-port（默认 9227，env CDP_PORT 覆盖）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const port = process.env.CDP_PORT || "9227";
const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const argv = process.argv.slice(2);
const topIdx = argv.indexOf("--top");
const top = topIdx >= 0 ? Number(argv[topIdx + 1]) || 20 : 20;
const args = argv.filter((a, i) => a !== "--top" && i !== topIdx + 1);
const [siteId, url, waitArg] = args;
if (!siteId || !url) {
  console.error("用法: node tools/attr-scan.mjs <siteId> <url> [waitMs] [--top N]");
  process.exit(2);
}
const waitMs = Number(waitArg || 15000);

const ATTRS = [
  "title", "aria-label", "aria-description", "aria-roledescription", "alt",
  "placeholder", "value", "label", "data-content", "data-qtip", "data-tip",
  "data-original-title", "data-tooltip", "mouseovertext", "summary"
];

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
          return new Promise((res) => pending.set(mid, res));
        },
        close: () => ws.close()
      });
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        pending.get(m.id)(m.result);
        pending.delete(m.id);
      }
    };
    ws.onerror = reject;
  });
}

const COLLECTOR = `(() => {
  const names = ${JSON.stringify(ATTRS)};
  const out = {};
  const seen = new Set();
  const els = document.querySelectorAll("[title],[aria-label],[aria-description],[alt],[placeholder],[label],[data-content],[data-qtip],[data-tip],[data-original-title],[data-tooltip],[mouseovertext],[summary],option,optgroup,input,textarea,img,iframe");
  for (const el of els) {
    const tag = el.tagName.toLowerCase();
    for (const name of names) {
      let v = el.getAttribute(name) || "";
      if (name === "value" && tag === "input" && el.type === "hidden") continue;
      v = v.replace(/\\s+/g, " ").trim();
      if (!v || v.length > 120) continue;
      if (!/[A-Za-z]/.test(v) || /[\\u3400-\\u9fff]/.test(v)) continue;
      const k = name + "=" + v;
      if (seen.has(k)) continue;
      seen.add(k);
      (out[name] = out[name] || []).push({ v, tag, cls: (el.className && String(el.className).slice(0, 40)) || "" });
    }
  }
  const rows = [];
  for (const [name, arr] of Object.entries(out)) rows.push({ name, count: arr.length, samples: arr.slice(0, 40) });
  rows.sort((a, b) => b.count - a.count);
  return JSON.stringify({
    title: document.title,
    url: location.href,
    translated: !!window.__BIOL10N,
    stats: window.__BIOL10N ? window.__BIOL10N.stats() : null,
    rows
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

const res = await send("Runtime.evaluate", { expression: COLLECTOR, returnByValue: true });
if (res.exceptionDetails) {
  console.error("采集失败:", JSON.stringify(res.exceptionDetails).slice(0, 300));
  process.exit(1);
}
const data = JSON.parse(res.result.value);
data.siteId = siteId;
data.collectedAt = new Date().toISOString();
fs.mkdirSync(path.join(root, "research"), { recursive: true });
fs.writeFileSync(path.join(root, "research", "attrs-" + siteId + ".json"), JSON.stringify(data, null, 1));
await b.send("Target.closeTarget", { targetId });
b.close();

const total = data.rows.reduce((n, r) => n + r.count, 0);
console.log("#", siteId, "|", data.title, "| 已注入:", data.translated, "| 属性英文 " + total + " 条 / " + data.rows.length + " 类");
for (const r of data.rows) {
  console.log("@" + r.name + " ×" + r.count);
  for (const s of r.samples.slice(0, top)) console.log("   <" + s.tag + "> " + s.v + (s.cls ? "   [" + s.cls + "]" : ""));
}
