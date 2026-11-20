// 用真实页面统计词库覆盖率与未命中短语：node tools/coverage.mjs <html文件> [站点id]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const file = process.argv[2];
const siteId = process.argv[3];
if (!file) { console.error("用法: node tools/coverage.mjs <html> [站点id]"); process.exit(2); }

const engineSrc = fs.readFileSync(path.join(root, "src/engine.js"), "utf8");
const createEngine = new Function(engineSrc + "; return createEngine;")();

const sites = JSON.parse(fs.readFileSync(path.join(root, "config/sites.json"), "utf8"));
const site = sites.sites.find((s) => s.id === siteId) || sites.sites[0];

const exact = {};
const rules = [];
for (const id of site.dicts) {
  const p = path.join(root, "dict", id + ".json");
  if (!fs.existsSync(p)) continue;
  const d = JSON.parse(fs.readFileSync(p, "utf8"));
  Object.assign(exact, d.exact || {});
  if (d.rules) rules.push(...d.rules);
}

const html = fs.readFileSync(file, "utf8");
const dom = new JSDOM(html, { url: "https://" + site.hosts[0] + "/" });
const doc = dom.window.document;
const engine = createEngine({ document: doc, window: dom.window, data: { exact, rules }, site: { block: sites.defaults.block } });

const CJK = /[\u4e00-\u9fff]/;
// 数据行特征：物种拉丁名、通路名、编号、纯大写缩写组合——不该翻，也不计入覆盖率
const DATA_LIKE = [
  /^[A-Z][a-z]+ [a-z]+$/,                                  // Homo sapiens
  /^[A-Z][a-z]+ [a-z]+ [a-z]+$/,                           // 三词学名
  /(biosynthesis|metabolism|degradation|signaling pathway)$/i,
  /^[a-z]{2,3}\d{3,5}$/i,                                   // 通路/条目编号
  /^[A-Z] [A-Z]$/,                                         // KEGG 分类缩写 M N
  /^[\d.,%+\-–— ]+$/,                                       // 纯数字
  /^[-–—] /
];
const isData = (t) => DATA_LIKE.some((re) => re.test(t));
const LET = /[A-Za-z]/;
const miss = new Map();
let nodes = 0, hit = 0, keep = 0, dataRows = 0;

const walker = doc.createTreeWalker(doc.body, 4, null, false);
let n;
while ((n = walker.nextNode())) {
  const t = (n.nodeValue || "").replace(/\s+/g, " ").trim();
  if (t.length < 2 || CJK.test(t) || !LET.test(t)) continue;
  const p = n.parentElement;
  if (!p || p.closest("script, style, pre, code, textarea")) continue;
  // 只统计界面骨架：正文（题目/摘要/引文）不算覆盖率，也不该翻
  if (p.closest("article, .docsum-content, .docsum-snippet, .abstract-content, .full-view, .citation, .references, .citedby")) continue;
  // 长句视为正文
  if (t.length > 90) continue;
  if (!process.argv.includes("--all") && isData(t)) { dataRows++; continue; }
  // 同级兄弟超过 30 个视为批量数据列表（通路名、物种名、基因列表），不算界面骨架
  const sibs = p.parentElement ? p.parentElement.children.length : 0;
  if (!process.argv.includes("--lists") && sibs > 30) { dataRows++; continue; }
  nodes++;
  const out = engine.translateText(t);
  if (out !== null) hit++;
  else { keep++; miss.set(t, (miss.get(t) || 0) + 1); }
}

const pct = ((hit / Math.max(nodes, 1)) * 100).toFixed(1);
console.log("站点: " + site.id + "（词库: " + site.dicts.join(" + ") + "）");
console.log("跳过的数据行: " + dataRows);
console.log("可翻文本节点: " + nodes + "  命中: " + hit + "  保留英文: " + keep + "  覆盖率: " + pct + "%");
console.log("\n未命中高频短语 Top 25:");
[...miss.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 25)
  .forEach(([t, c]) => console.log("  " + String(c).padStart(3) + "×  " + (t.length > 70 ? t.slice(0, 70) + "…" : t)));
