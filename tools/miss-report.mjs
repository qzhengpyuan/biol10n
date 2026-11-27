#!/usr/bin/env node
/**
 * 用真实浏览器（CDP）打开一个页面，列出「脚本跑完后仍然是英文」的短文本与属性。
 * 用法: node tools/miss-report.mjs <siteId> <url> [waitMs]
 * 依赖: 一个开放 CDP 的浏览器（端口取 CDP_PORT，默认 9227 = BrowserOS neo）。
 *
 * 两种跑法：
 *   1) neo + ScriptCat 装了本脚本 —— 直接读 \`window.__BIOL10N\`。
 *   VIA_HOME=1：SPA 站（CELLxGENE 的 /datasets、/collections）先开首页再点导航进目标页，
 *   直接 navigate 会拿到「只有 header、<main> 为空」的假页面。
 *
 *   2) 直连 headless（站点走系统代理时 neo 打不开，用 --no-proxy-server 起一个 Chrome，
 *      设 INJECT=1 让本工具在 document-start 注入 dist/biol10n.user.js，等价于脚本猫注入）：
 *        google-chrome --headless=new --no-proxy-server --remote-debugging-port=9231 \
 *          --user-data-dir=/tmp/biol10n-chk-profile-9231 about:blank &
 *        CDP_PORT=9231 INJECT=1 node tools/miss-report.mjs cbioportal-docs <url>
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

// 站级 skip 与引擎/uia 面板同一语义：这些区块里的文字引擎根本不碰，清单里也不该出现。
// （cBioPortal 正文、GEO 结果标题、miRBase 的分类树都是这一类。）
let siteSkip = "", siteSkipFree = [], siteValueText = false;
try {
  const cfg = JSON.parse(fs.readFileSync(path.join(root, "config/sites.json"), "utf8"));
  const site = (cfg.sites || []).find((s) => s.id === siteId);
  siteSkip = (site && site.skip) || "";
  siteSkipFree = (site && site.skipFree) || [];
  siteValueText = !!(site && site.valueText);
} catch (e) { /* 没有配置就不按 skip 过滤 */ }

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
  const SITE = window.__L10N_SITE_SKIP || { skip: "", free: [], valueText: false };
  function inSiteSkip(el) {
    if (!SITE.skip || !el || !el.closest) return false;
    let hit = false;
    try { hit = !!el.closest(SITE.skip); } catch (e) { return false; }
    if (!hit) return false;
    for (const f of SITE.free || []) { try { if (el.closest(f)) return false; } catch (e2) {} }
    return true;
  }
  let skipFiltered = 0;
  const texts = new Map();
  const tw = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
  while (tw.nextNode()) {
    const n = tw.currentNode;
    const p = n.parentElement;
    if (!p || SKIP.has(p.tagName)) continue;
    // head 里的 <link title> 之类不可见，报出来只是噪音（每站都会撞上一条 "Sitemap"）
    if (p.closest("head,code,pre,svg,script,style,.highlight,.blob-code")) continue;
    if (inSiteSkip(p)) { skipFiltered++; continue; }
    const t = (n.nodeValue || "").replace(/\\s+/g, " ").trim();
    // 与 ui.js 的 looksUntranslated 对齐：邮箱/URL 不是界面文案
    if (t.indexOf("@") >= 0 || /^https?:/.test(t) || t.indexOf("www.") === 0) continue;
    if (!t || t.length > 80) continue;
    if (/[\\u3400-\\u9fff]/.test(t)) continue;
    if (!/[A-Za-z]/.test(t)) continue;
    texts.set(t, (texts.get(t) || 0) + 1);
  }
  const attrs = [];
  const seen = new Set();
  for (const el of document.querySelectorAll("input,textarea,img,button,a,[placeholder],[title],[aria-label],[alt]")) {
    // 同上：<head> 里的 <link rel=alternate title=Sitemap> 是给浏览器/爬虫看的，不是界面文字
    if (el.closest("head")) continue;
    if (inSiteSkip(el)) continue;
    const names = ["placeholder", "title", "aria-label", "alt"];
    // 隐藏控件（type=hidden）里的 value 是给站点 JS 读的配置，不是可见文字，翻它反而会改坏行为
    // 与引擎一致：value 只算「可见按钮」；文本框默认值只有站点声明 valueText 才翻
    if (el.tagName === "INPUT") {
      const ty = (el.type || "text").toLowerCase();
      if (/^(submit|button|reset)$/.test(ty) || (SITE.valueText && /^(text|search|email|url|tel|)$/.test(ty))) names.push("value");
    } else if (el.tagName === "TEXTAREA" && SITE.valueText) names.push("value");
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
    skipFiltered,
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
// INJECT=1（或给具体文件路径）：在 document-start 注入构建产物，替代脚本猫。
// 注入发生在导航之前，与 userscript 的 run-at document-start 一致，so 首扫口径可比。
if (process.env.INJECT) {
  const p = process.env.INJECT === "1" ? path.join(root, "dist/biol10n.user.js") : process.env.INJECT;
  await send("Page.addScriptToEvaluateOnNewDocument", { source: fs.readFileSync(p, "utf8") });
  console.log("# 注入 " + p);
}
async function waitReady() {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    const s = await send("Runtime.evaluate", { expression: "document.readyState", returnByValue: true });
    if (s.result.value === "complete") break;
    await new Promise((r) => setTimeout(r, 500));
  }
}

// VIA_HOME=1：从站点首页「点导航」进目标页，而不是直接 navigate。
// 有些 SPA（CELLxGENE 的 /datasets、/collections）直连时 SSR 只吐 header，客户端不 hydrate，
// <main> 是空的；直接导航会把整页误判成「22 个节点、无缺口」。走首页再点链接才会渲染。
// 找不到对应链接时退化为 history.pushState + popstate（React Router 一般认这个）。
const viaHome = process.env.VIA_HOME === "1" || process.env.VIA_HOME === "true";
if (viaHome) {
  const home = new URL(url).origin + "/";
  console.log("# VIA_HOME：先开首页 " + home + "，再点导航进 " + url);
  await send("Page.navigate", { url: home });
  await waitReady();
  await new Promise((r) => setTimeout(r, Math.max(waitMs, 8000)));
  const hop = await send("Runtime.evaluate", {
    expression: "(async () => {" +
      "const want = " + JSON.stringify(url) + ";" +
      "const u = new URL(want);" +
      "const path = u.pathname + u.search;" +
      "const as = [...document.querySelectorAll('a[href]')];" +
      "const hit = as.find((a) => { try { const h = new URL(a.href, location.origin); return h.origin === u.origin && (h.pathname + h.search) === path; } catch (e) { return false; } });" +
      "if (hit) { hit.click(); return 'click'; }" +
      "history.pushState(null, '', path);" +
      "window.dispatchEvent(new PopStateEvent('popstate', { state: null }));" +
      "return 'pushState';" +
    "})()",
    returnByValue: true,
    awaitPromise: true
  });
  console.log("# 导航方式: " + (hop.result && hop.result.value));
  await waitReady();
  await new Promise((r) => setTimeout(r, waitMs));
} else {
  await send("Page.navigate", { url });
  await waitReady();
  await new Promise((r) => setTimeout(r, waitMs));
}
// 滚动一遍，触发懒加载
await send("Runtime.evaluate", {
  expression: "(()=>{let y=0;const h=()=>document.body.scrollHeight;const id=setInterval(()=>{window.scrollBy(0,800);y+=800;if(y>h()){clearInterval(id);window.__l10nScrollDone=true;}},120);window.__l10nScroll=id;return 'scrolling'})()",
  returnByValue: true
});
await new Promise((r) => setTimeout(r, 3000));
await send("Runtime.evaluate", { expression: "(()=>{if(window.__l10nScroll)clearInterval(window.__l10nScroll);window.scrollTo(0,0);return 'reset'})()", returnByValue: true });
await new Promise((r) => setTimeout(r, 1200));

await send("Runtime.evaluate", {
  expression: "window.__L10N_SITE_SKIP = " + JSON.stringify({ skip: siteSkip, free: siteSkipFree, valueText: siteValueText }),
  returnByValue: true
});
const res = await send("Runtime.evaluate", { expression: COLLECTOR, returnByValue: true });
if (res.exceptionDetails) {
  console.error("采集失败:", JSON.stringify(res.exceptionDetails).slice(0, 300));
  process.exit(1);
}
const data = JSON.parse(res.result.value);
data.siteId = siteId;
// 站点级噪音名单（config/sites.json 的 missNoise）：流程名/工具名/品牌本来就不翻，
// 混在清单里会盖住真缺口。页面内的漏翻面板（src/ui.js 的 isNoise）早就按这份名单过滤，
// 命令行工具这边也得一致，否则「每轮都要人工把这些名字划掉」。
let siteNoise = [];
try {
  const cfg = JSON.parse(fs.readFileSync(path.join(root, "config/sites.json"), "utf8"));
  const site = (cfg.sites || []).find((s) => s.id === siteId);
  siteNoise = (site && site.missNoise) || [];
} catch (e) { /* 没有配置就不过滤 */ }
// 与 src/ui.js 的 isNoise 同一套语义：普通条目子串匹配，"re:" 开头当正则（作者自己加 ^ $）。
const noiseRules = [];
for (const raw of siteNoise) {
  const n = String(raw || "").trim();
  if (!n) continue;
  const low = n.toLowerCase();
  // rec: = 大小写敏感（基因符号这类必须区分大小写），re: 仍是不敏感
  if (low.slice(0, 4) === "rec:") {
    try { noiseRules.push({ re: new RegExp(n.slice(4)), cs: true }); } catch (e) { /* 写坏的正则不生效 */ }
  } else if (low.slice(0, 3) === "re:") {
    try { noiseRules.push({ re: new RegExp(n.slice(3), "i") }); } catch (e) { /* 写坏的正则不生效 */ }
  } else {
    noiseRules.push({ sub: low });
  }
}
const isNoise = (t) => {
  const raw = String(t).trim();
  const s = raw.toLowerCase();
  // rec: 的正则拿原串比（大小写敏感），re: 走小写串
  return noiseRules.some((r) => (r.re ? r.re.test(r.cs ? raw : s) : s.includes(r.sub)));
};
if (siteNoise.length) {
  const t0 = data.texts.length, a0 = data.attrs.length;
  data.texts = data.texts.filter((x) => !isNoise(x[0]));
  data.attrs = data.attrs.filter((x) => !isNoise(x[1]));
  data.noiseFiltered = { texts: t0 - data.texts.length, attrs: a0 - data.attrs.length, list: siteNoise.length };
}
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
if (data.skipFiltered) console.log("# 站级 skip 区块里另有 " + data.skipFiltered + " 条文本没进清单");
console.log("# 文本 " + data.texts.length + " 条，属性 " + data.attrs.length + " 条" +
  (data.noiseFiltered ? "（已按站级 missNoise 过滤 " + data.noiseFiltered.texts + " 条文本 / " + data.noiseFiltered.attrs + " 条属性，" + data.noiseFiltered.list + " 条名单）" : ""));
for (const [t, c] of data.texts.slice(0, 80)) console.log((c > 1 ? "[" + c + "] " : "      ") + t);
for (const [name, v, tag] of data.attrs.slice(0, 25)) console.log("  @" + name + " <" + tag + "> " + v);