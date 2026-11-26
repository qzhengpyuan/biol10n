// README 是脚本猫商店页正文（发版时随 release 分支一起推），词库表与合计行必须与 dict/ 实际一致。
// 历史上漂移过三次：子代理补词后只改 dict/ 不改 README，商店页长期显示旧数字。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const lines = readme.split("\n");
const dictIds = fs.readdirSync(path.join(root, "dict")).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
const sites = JSON.parse(fs.readFileSync(path.join(root, "config/sites.json"), "utf8")).sites;

/** README 词库表的行：| id | exact | rules | templates | 说明 | */
function rows() {
  const out = new Map();
  for (const l of lines) {
    const m = /^\| ([\w.-]+) \| (\d*) \| (\d*) \| (\d*) \|/.exec(l);
    if (!m || m[1] === "册") continue;
    if (out.has(m[1])) out.get(m[1]).dups = (out.get(m[1]).dups || 0) + 1;
    out.set(m[1], { exact: Number(m[2] || 0), rules: Number(m[3] || 0), tpl: Number(m[4] || 0), line: l });
  }
  return out;
}

function actual(id) {
  const d = JSON.parse(fs.readFileSync(path.join(root, "dict", id + ".json"), "utf8"));
  return { exact: Object.keys(d.exact || {}).length, rules: (d.rules || []).length, tpl: (d.templates || []).length };
}

test("README 词库表：每一册行都与 dict/*.json 的实际条数一致，且没有多余行", () => {
  const table = rows();
  const drift = [];
  for (const id of dictIds) {
    const want = actual(id);
    const got = table.get(id);
    if (!got) { drift.push(id + "：README 缺行"); continue; }
    if (got.exact !== want.exact || got.rules !== want.rules || got.tpl !== want.tpl) {
      drift.push(id + "：README " + got.exact + "/" + got.rules + "/" + got.tpl + " ≠ 实际 " + want.exact + "/" + want.rules + "/" + want.tpl);
    }
  }
  for (const [id, row] of table) {
    if (!dictIds.includes(id)) drift.push(id + "：README 有行但 dict/ 没有这一册");
    if (row.dups) drift.push(id + "：README 里重复了 " + (row.dups + 1) + " 行");
  }
  assert.deepEqual(drift, [], "README 词库表与 dict/ 不一致：\n" + drift.join("\n"));
});

test("README 合计行与体积行：条数、册数、站点数、字节数都是当前的", () => {
  const table = rows();
  let exact = 0, rules = 0, tpl = 0;
  for (const id of dictIds) { const a = actual(id); exact += a.exact; rules += a.rules; tpl += a.tpl; }
  const total = new RegExp("合计 \\*\\*(\\d+) 条 / (\\d+) 条规则 / (\\d+) 条模板\\*\\*（(\\d+) 册 / (\\d+) 站点）").exec(readme);
  assert.ok(total, "README 找不到「合计 xxx 条 / xxx 条规则 / xxx 条模板（xxx 册 / xxx 站点）」行");
  assert.equal(Number(total[1]), exact, "合计 exact 条数");
  assert.equal(Number(total[2]), rules, "合计 rules 条数");
  assert.equal(Number(total[3]), tpl, "合计 templates 条数");
  assert.equal(Number(total[4]), dictIds.length, "合计册数");
  assert.equal(Number(total[5]), sites.length, "合计站点数（对照 config/sites.json）");
  // 表体逐行相加也必须等于 table 的值（合计行与表体不能各说各话）
  let se = 0, sr = 0, st = 0;
  for (const id of dictIds) { const r = table.get(id); se += r.exact; sr += r.rules; st += r.tpl; }
  assert.equal(se, exact, "表体 exact 相加应等于合计");
  assert.equal(sr, rules, "表体 rules 相加应等于合计");
  assert.equal(st, tpl, "表体 templates 相加应等于合计");

  const dist = path.join(root, "dist/biol10n.user.js");
  if (!fs.existsSync(dist)) return; // dist 不入库，纯词库改动的机器上可能没有构建产物
  const bytes = fs.statSync(dist).size;
  const sizeLine = /[（(]([\d,]+) 字节[）)]/.exec(readme);
  assert.ok(sizeLine, "README 找不到「(xxx,xxx 字节)」体积行");
  assert.equal(Number(sizeLine[1].replace(/,/g, "")), bytes, "README 体积字节数应等于 dist/biol10n.user.js 实际大小");
});