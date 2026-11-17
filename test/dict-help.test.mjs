import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.dirname(new URL(import.meta.url).pathname);
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/ncbi-help.json"), "utf8"));
const entries = Object.entries(dict.exact || {});

test("帮助词库：键是规整的英文，值是中文", () => {
  assert.ok(entries.length > 100, "帮助词库条目太少: " + entries.length);
  const bad = [];
  for (const [en, zh] of entries) {
    if (!en || en !== en.trim()) bad.push("键首尾空白: " + JSON.stringify(en));
    if (/[\u3400-\u4dbf\u4e00-\u9fff]/.test(en)) bad.push("键含中文: " + en);
    if (!zh || zh !== zh.trim()) bad.push("空译文: " + en);
    if (en.length > 2000) bad.push("键过长: " + en.slice(0, 40));
  }
  assert.deepEqual(bad.slice(0, 8), []);
});

test("帮助词库：允许原文保留的标识符不产生重复中文", () => {
  const dup = entries.filter(([en, zh]) => zh === en && /[\u3400-\u9fff]/.test(zh));
  assert.equal(dup.length, 0);
});
