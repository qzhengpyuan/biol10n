#!/usr/bin/env node
/**
 * 采集「模板通道」候选：脚本跑完后仍为英文、且内部只有内联元素（a/code/em…）的段落，
 * 转成带 {{n}} 占位符的英文模板，写入 research/pat-<siteId>.json。
 * 用法: node tools/pat-collect.mjs <siteId> <url> [waitMs]
 * 依赖: 本机 BrowserOS neo 开着 CDP（默认 9227）。
 */
import fs from "node:fs";
import path from "node:path";

const port = process.env.CDP_PORT || "9227";
const root = path.dirname(new URL(import.meta.url).pathname) + "/..";
const [siteId, url, waitArg] = process.argv.slice(2);
if (!siteId || !url) {
  console.error("用法: node tools/pat-collect.mjs <siteId> <url> [waitMs]");
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

const COLLECTOR = String.raw`(() => {
  const INLINE = new Set(["A","ABBR","B","BDI","BDO","BR","CITE","CODE","DATA","DEL","DFN","EM","I","INS","KBD","MARK","Q","S","SAMP","SMALL","SPAN","STRONG","SUB","SUP","TIME","U","VAR","WBR"]);
  const norm = (s) => (s || "").replace(/[\u00a0\u2000-\u200b\u3000]/g, " ").replace(/\s+/g, " ").trim();
  const inlineSubtree = (el) => { for (const k of el.children) { if (!INLINE.has(k.tagName)) return false; if (!inlineSubtree(k)) return false; } return true; };
  const out = [];
  const seen = new Set();
  for (const el of document.querySelectorAll("p, dd, li")) {
    if (el.hasAttribute("data-biol10n-block") || el.hasAttribute("data-biol10n-tpl")) continue;
    if (el.closest("pre,code,svg,script,style,textarea,[contenteditable=''],[contenteditable='true']")) continue;
    if (el.querySelector("p, li, ul, ol, div, table, pre, textarea")) continue;
    const parts = [], slots = [];
    let bad = false;
    for (let c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) { parts.push(c.nodeValue || ""); continue; }
      if (c.nodeType !== 1) { bad = true; break; }
      const tn = c.tagName;
      if (!INLINE.has(tn)) { bad = true; break; }
      if (tn !== "BR" && !inlineSubtree(c)) { bad = true; break; }
      slots.push({ tag: tn.toLowerCase(), text: norm(c.textContent) });
      parts.push("{{" + slots.length + "}}");
    }
    if (bad || !slots.length) continue;
    const pat = norm(parts.join(""));
    if (!pat || /[\u3400-\u9fff]/.test(pat)) continue;
    if (pat.length < 40 || pat.length > 2200) continue;
    if (!/[A-Za-z]/.test(pat)) continue;
    const key = pat;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ pat, slots, tag: el.tagName.toLowerCase(), text: norm(el.textContent) });
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
const outFile = path.join(root, "research", "pat-" + siteId + ".json");
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(data, null, 1));
console.log("模板候选 " + data.total + " 条 -> " + path.relative(root, outFile));
await b.send("Target.closeTarget", { targetId }).catch(() => {});
b.close();
