import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const src = readFileSync(new URL("../src/engine.js", import.meta.url), "utf8");
const { createEngine } = new Function(src + "\nreturn { createEngine };")();
const common = JSON.parse(readFileSync(new URL("../dict/common.json", import.meta.url), "utf8"));

function run(html) {
  const dom = new JSDOM("<body>" + html + "</body>", { url: "https://genome.ucsc.edu/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: common.exact, rules: common.rules },
    site: { attrs: [], block: "" }
  });
  engine.start();
  return dom.window.document.body.textContent.trim();
}

test("美式日期翻成中文", () => {
  assert.equal(run("<p>November 13, 2026</p>"), "2026 年 11 月 13 日");
});

test("日期后面还带内容时整体不动（由站点规则处理）", () => {
  assert.equal(run("<li>Nov. 13, 2026 - New ways to sign in</li>"), "Nov. 13, 2026 - New ways to sign in");
});

test("月+年翻成中文", () => {
  assert.equal(run("<p>September 2026</p>"), "2026 年 9 月");
});

test("英式日期翻成中文", () => {
  assert.equal(run("<p>13 Nov 2026</p>"), "2026 年 11 月 13 日");
});

test("非月份的缩写串不动", () => {
  assert.equal(run("<p>Fig. 3, 2020</p>"), "Fig. 3, 2020");
});
