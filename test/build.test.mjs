import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const dist = new URL("../dist/biol10n.user.js", import.meta.url);
const hasDist = fs.existsSync(dist);
const skip = hasDist ? false : "先运行 npm run build 生成 dist";
const src = hasDist ? fs.readFileSync(dist, "utf8") : "";
const lines = src.split("\n");
const start = lines.findIndex((l) => l.trim() === "// ==UserScript==");
const end = lines.findIndex((l) => l.trim() === "// ==/UserScript==");

test("构建产物带合法元数据块", { skip }, () => {
  assert.equal(start, 0, "元数据块必须在第 1 行开始");
  assert.ok(end > start, "元数据块必须闭合");
  for (let i = start; i <= end; i++) {
    assert.ok(lines[i].startsWith("//"), "元数据块第 " + (i + 1) + " 行缺少 // 前缀: " + lines[i].slice(0, 40));
  }
});

test("元数据块声明了站点匹配与零授权", { skip }, () => {
  const meta = lines.slice(start, end + 1).filter((l) => l.startsWith("// @"));
  const matches = meta.filter((l) => l.startsWith("// @match"));
  assert.ok(matches.length >= 10, "站点匹配太少: " + matches.length);
  assert.ok(meta.some((l) => /^\/\/ @grant\s+none$/.test(l)), "必须 @grant none");
});

test("元数据块之后的正文可解析", { skip }, () => {
  const body = lines.slice(end + 1).join("\n");
  assert.doesNotThrow(() => new Function(body), "脚本体存在语法错误");
});
