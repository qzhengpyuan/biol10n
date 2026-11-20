// 冒烟测试：在 jsdom 里执行构建产物，逐条打印「原文 → 译文」，用于肉眼验收误翻
// 用法: node tools/smoke.mjs <html文件> <站点url> [条数]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const file = process.argv[2];
const url = process.argv[3] || "https://example.org/";
const limit = Number(process.argv[4] || 40);
if (!file) { console.error("用法: node tools/smoke.mjs <html> <url> [条数]"); process.exit(2); }

const html = fs.readFileSync(file, "utf8");
const dom = new JSDOM(html, { url, runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;

const before = [];
const w0 = window.document.createTreeWalker(window.document.body, 4, null, false);
let n;
while ((n = w0.nextNode())) before.push(n.nodeValue);

const userscript = fs.readFileSync(path.join(root, "dist/biol10n.user.js"), "utf8")
  .replace(/^\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\s*/, "");

try { window.eval(userscript); } catch (e) { console.error("脚本执行失败:", e.message); process.exit(1); }

const after = [];
const w1 = window.document.createTreeWalker(window.document.body, 4, null, false);
while ((n = w1.nextNode())) after.push(n.nodeValue);

let changed = 0;
const rows = [];
for (let i = 0; i < Math.min(before.length, after.length); i++) {
  if (before[i] === after[i]) continue;
  changed++;
  if (rows.length < limit) rows.push([before[i].replace(/\s+/g, " ").trim(), after[i].replace(/\s+/g, " ").trim()]);
}

console.log("文本节点 " + before.length + " 个，被替换 " + changed + " 个（展示前 " + rows.length + " 条）");
console.log("");
for (const [a, b] of rows) {
  console.log("  原: " + (a.length > 58 ? a.slice(0, 58) + "…" : a));
  console.log("  译: " + (b.length > 58 ? b.slice(0, 58) + "…" : b));
  console.log("");
}
