// 词库体检：自映射、同册重复、跨册冲突、可疑条目。用法: node tools/dict-lint.mjs [--json]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const files = fs.readdirSync(path.join(root, "dict")).filter((f) => f.endsWith(".json")).sort();
const books = {};
for (const f of files) {
  const id = f.replace(/\.json$/, "");
  books[id] = JSON.parse(fs.readFileSync(path.join(root, "dict", f), "utf8"));
}

const selfMaps = [];        // key === value
const dupWithin = [];       // 同一册里 key 重复（JSON 里不可能，但多了空格/不同写法会出现）
const spaced = [];          // 首尾空白
const conflicts = [];       // 跨册同 key 不同值
const seen = new Map();     // key -> [{book, val}]

for (const [id, d] of Object.entries(books)) {
  for (const [k, v] of Object.entries(d.exact || {})) {
    if (k === v) selfMaps.push({ book: id, k });
    if (k !== k.trim() || v !== String(v).trim()) spaced.push({ book: id, k, v });
    if (!seen.has(k)) seen.set(k, []);
    seen.get(k).push({ book: id, v });
  }
}
for (const [k, list] of seen) {
  const vals = [...new Set(list.map((x) => x.v))];
  if (vals.length > 1) conflicts.push({ k, list });
}
const counts = { books: files.length, entries: Object.values(books).reduce((n, d) => n + Object.keys(d.exact || {}).length, 0) };
const report = { counts, selfMaps, dupWithin, spaced, conflicts };
if (process.argv.includes("--json")) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`词库 ${counts.books} 本 / ${counts.entries} 条`);
  console.log(`自映射 ${selfMaps.length} 条: ` + selfMaps.slice(0, 20).map((x) => x.book + ":" + x.k).join(", "));
  console.log(`首尾空白 ${spaced.length} 条: ` + spaced.slice(0, 10).map((x) => x.book + ":" + JSON.stringify(x.k)).join(", "));
  console.log(`跨册冲突 ${conflicts.length} 组:`);
  for (const c of conflicts.slice(0, 40)) console.log("  " + c.k + " → " + c.list.map((x) => x.book + "=" + x.v).join(" / "));
}
