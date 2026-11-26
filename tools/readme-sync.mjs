#!/usr/bin/env node
/**
 * 把 README 的词库表、合计行、体积行同步成 dict/ 与 dist/ 的当前值。
 * 用法: node tools/readme-sync.mjs [--check]
 *   --check 只报差异不写盘（CI/汇报用），有差异时 exit 1。
 * 说明行（每册最后一列）与表结构原样保留，只改三列数字与合计/字节数。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const checkOnly = process.argv.includes("--check");
const dictDir = path.join(root, "dict");
const files = fs.readdirSync(dictDir).filter((f) => f.endsWith(".json")).sort();
const sites = JSON.parse(fs.readFileSync(path.join(root, "config/sites.json"), "utf8")).sites;

const counts = new Map();
let exact = 0, rules = 0, tpl = 0;
for (const f of files) {
  const id = f.replace(/\.json$/, "");
  const d = JSON.parse(fs.readFileSync(path.join(dictDir, f), "utf8"));
  const c = [Object.keys(d.exact || {}).length, (d.rules || []).length, (d.templates || []).length];
  counts.set(id, c);
  exact += c[0]; rules += c[1]; tpl += c[2];
}

const readmePath = path.join(root, "README.md");
const src = fs.readFileSync(readmePath, "utf8");
const outLines = [];
const changes = [];

for (const line of src.split("\n")) {
  const row = /^\| ([\w.-]+) \| (\d*) \| (\d*) \| (\d*) \|(.*)$/.exec(line);
  if (row && counts.has(row[1])) {
    const c = counts.get(row[1]);
    const cell = (n) => (n ? String(n) : "");
    const next = "| " + row[1] + " | " + cell(c[0]) + " | " + cell(c[1]) + " | " + cell(c[2]) + " |" + row[5];
    if (next !== line) changes.push(row[1] + "：" + [row[2], row[3], row[4]].map((x) => x || "0").join("/") + " → " + c.join("/"));
    outLines.push(next);
    continue;
  }
  const total = /^(合计 \*\*)(\d+)( 条 \/ )(\d+)( 条规则 \/ )(\d+)( 条模板\*\*（)(\d+)( 册 \/ )(\d+)( 站点）.*)$/.exec(line);
  if (total) {
    const next = total[1] + exact + total[3] + rules + total[5] + tpl + total[7] + files.length + total[9] + sites.length + total[11];
    if (next !== line) changes.push("合计行：" + line.trim() + " → " + next.trim());
    outLines.push(next);
    continue;
  }
  const size = /^(.*[（(])([\d,]+)( 字节[）)].*)$/.exec(line);
  const dist = path.join(root, "dist/biol10n.user.js");
  if (size && fs.existsSync(dist)) {
    const bytes = fs.statSync(dist).size.toLocaleString("en-US");
    const kb = Math.round(fs.statSync(dist).size / 1024);
    let next = size[1] + bytes + size[3];
    next = next.replace(/\*\*(\d+) KB\*\*/, "**" + kb + " KB**");
    // 体积行里还嵌着「N 个文件共 X 条词条（含 Y 条规则）+ Z 条模板，覆盖 S 个站点」，
    // 只改字节数会留下一半新一半旧的假一致（--check 也照样报「一致」）。
    next = next.replace(/\d+ 个文件共 \d+ 条词条/, files.length + " 个文件共 " + exact + " 条词条");
    next = next.replace(/（含 \d+ 条规则）/, "（含 " + rules + " 条规则）");
    next = next.replace(/\+ \d+ 条模板/, "+ " + tpl + " 条模板");
    next = next.replace(/覆盖 \d+ 个站点/, "覆盖 " + sites.length + " 个站点");
    if (next !== line) changes.push("体积行：" + line.trim() + " → " + next.trim());
    outLines.push(next);
    continue;
  }
  outLines.push(line);
}

if (!changes.length) { console.log("README 已与 dict/ 一致"); process.exit(0); }
console.log(changes.join("\n"));
if (checkOnly) { console.error("有 " + changes.length + " 处漂移（--check 不写盘）"); process.exit(1); }
fs.writeFileSync(readmePath, outLines.join("\n"));
console.log("已写入 README.md（" + changes.length + " 处）");