// A 类缺口检测：把 miss-<site>.json 里的残留英文与站点词库逐条对照，
// 词库里明明有、页面却没翻的才是 bug（B 类属于词库缺词，另说）。
// 用法: node tools/aclass.mjs <siteId> [missFile]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const [siteId, missArg] = process.argv.slice(2);
if (!siteId) { console.error("用法: node tools/aclass.mjs <siteId> [missFile]"); process.exit(2); }
const missFile = missArg || path.join(root, "research", "miss-" + siteId + ".json");
if (!fs.existsSync(missFile)) { console.error("找不到 " + missFile); process.exit(2); }

const sites = JSON.parse(fs.readFileSync(path.join(root, "config/sites.json"), "utf8"));
const site = sites.sites.find((s) => s.id === siteId);
if (!site) { console.error("未知站点: " + siteId); process.exit(2); }

// 与引擎同口径的归一化：合并空白、去首尾。大小写不敏感靠小写索引。
const norm = (s) => String(s).replace(/\s+/g, " ").trim();
const exact = new Map();   // 归一化文本 → 译法
const lower = new Map();
for (const id of site.dicts || []) {
  const p = path.join(root, "dict", id + ".json");
  if (!fs.existsSync(p)) continue;
  const d = JSON.parse(fs.readFileSync(p, "utf8"));
  for (const [k, v] of Object.entries(d.exact || {})) {
    exact.set(norm(k), v);
    const low = norm(k).toLowerCase();
    if (!lower.has(low)) lower.set(low, v);
  }
}

const singulars = (s) => {
  const out = [];
  if (/ies$/.test(s)) out.push(s.slice(0, -3) + "y");
  if (/[^s]s$/.test(s)) out.push(s.slice(0, -1));
  if (/(ses|xes|zes|ches|shes)$/.test(s)) out.push(s.slice(0, -2));
  return out;
};

const lookup = (t) => {
  const s = norm(t);
  if (exact.has(s)) return exact.get(s);
  if (lower.has(s.toLowerCase())) return lower.get(s.toLowerCase());
  for (const sg of singulars(s)) {
    if (exact.has(sg)) return exact.get(sg);
    if (lower.has(sg.toLowerCase())) return lower.get(sg.toLowerCase());
  }
  return null;
};

const data = JSON.parse(fs.readFileSync(missFile, "utf8"));
const aText = [], aAttr = [];
for (const [t, count] of data.texts || []) {
  const hit = lookup(t);
  if (hit !== null) aText.push([t, hit, count]);
}
for (const [name, v, tag] of data.attrs || []) {
  const hit = lookup(v);
  if (hit !== null) aAttr.push([name, v, hit, tag]);
}

console.log("[" + siteId + "] A 类（词库有、页面没翻）：文本 " + aText.length + " 条，属性 " + aAttr.length + " 条");
for (const [t, hit, c] of aText.slice(0, 60)) console.log("  [" + (c || 1) + "] " + t + "  →  " + hit);
for (const [name, v, hit, tag] of aAttr.slice(0, 30)) console.log("  @" + name + " <" + tag + "> " + v + "  →  " + hit);
process.exit(aText.length + aAttr.length ? 1 : 0);
