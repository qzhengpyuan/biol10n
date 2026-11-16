// 术语一致性校验：站点词库不得对全局词条另译（allowOverride 除外）
import fs from "node:fs";
import path from "node:path";

const root = path.dirname(new URL(import.meta.url).pathname) + "/..";
const terms = JSON.parse(fs.readFileSync(path.join(root, "docs/terms.json"), "utf8"));
const canonical = terms.canonical || {};
const allow = new Set(terms.allowOverride || []);

const dictDir = path.join(root, "dict");
const problems = [];
let checked = 0;
let overrides = 0;

for (const f of fs.readdirSync(dictDir).filter((f) => f.endsWith(".json"))) {
  const d = JSON.parse(fs.readFileSync(path.join(dictDir, f), "utf8"));
  const isSource = ("dict/" + f) === terms.source;
  if (isSource) continue;
  for (const [k, v] of Object.entries(d.exact || {})) {
    if (!(k in canonical)) continue;
    checked++;
    if (allow.has(k)) { overrides++; continue; }
    if (v !== canonical[k]) problems.push(f + "  " + k + "  " + v + "  ≠  " + canonical[k]);
  }
}

if (problems.length) {
  console.log("术语不一致 " + problems.length + " 处：");
  for (const p of problems) console.log("  ✖ " + p);
  console.log("\n修法：改站点词库对齐 " + terms.source + "；确属站点语境的，加进 docs/terms.json 的 allowOverride");
  process.exit(1);
}
console.log("✔ 术语一致（比对 " + checked + " 条，站点级例外 " + overrides + " 条）");
