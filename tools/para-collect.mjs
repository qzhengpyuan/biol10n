#!/usr/bin/env node
/**
 * 采集「长整段」候选：脚本跑完后仍为英文、内部没有任何内联元素、长度 300–1800 的 p/dd/li。
 * 这些段落靠 exact 整段词条替换（引擎 translateParagraphs，上限 1800）。
 * 用法: node tools/para-collect.mjs <siteId> <url> [waitMs]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const port = process.env.CDP_PORT || "9227";
const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const [siteId, url, waitArg] = process.argv.slice(2);
if (!siteId || !url) {
  console.error("用法: node tools/para-collect.mjs <siteId> <url> [waitMs]");
  process.exit(2);
}
const waitMs = Number(waitArg || 15000);

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

const COLLECTOR = String.raw`(() => {
  const norm = (s) => (s || "").replace(/[\u00a0\u2000-\u200b\u3000]/g, " ").replace(/\s+/g, " ").trim();
  const out = [];
  const seen = new Set();
  for (const el of document.querySelectorAll("p, dd, li")) {
    if (el.hasAttribute("data-biol10n-block") || el.hasAttribute("data-biol10n-tpl")) continue;
    if (el.closest("pre,code,svg,script,style,textarea,[contenteditable=''],[contenteditable='true']")) continue;
    if (el.querySelector("p, li, ul, ol, div, table, pre, textarea")) continue;
    if (el.querySelector("a, code, em, strong, b, i, span, br, sub, sup, u, small")) continue;
    const t = norm(el.textContent);
    if (!t || /[\u3400-\u9fff]/.test(t)) continue;
    if (t.length < 300 || t.length > 1800) continue;
    if (!/[A-Za-z]{3}/.test(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push({ text: t, tag: el.tagName.toLowerCase(), len: t.length });
  }
  return JSON.stringify({ url: location.href, total: out.length, items: out });
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
const outFile = path.join(root, "research", "para-" + siteId + ".json");
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(data, null, 1));
console.log("长整段候选 " + data.total + " 条 -> " + path.relative(root, outFile));
await b.send("Target.closeTarget", { targetId }).catch(() => {});
b.close();
