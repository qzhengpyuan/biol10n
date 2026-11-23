// 文档站长段落里的内联链接文字：GEO FAQ 的「please <a>watch a tutorial video</a>.」
// 整条命中词库、长度也短，但前一个字符是字母，旧逻辑当句子成分挡住 → 词库有译文也不翻。
// 站点开 inlineExact 才放行，通用站点保持原判据（避免正文链接被拆成半中半英）。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();

const LONG = "For help with submitting your data, please watch a tutorial video. Submitters should read the " +
  "documentation before starting, and contact us if the submission form does not accept your file. " +
  "The FAQ covers every step of the process in detail and explains what to do when a file is rejected.";
const DATA = { exact: { "watch a tutorial video": "观看教程视频", "documentation": "文档" }, rules: [], templates: [] };

function boot(inlineExact) {
  const html = '<div id="main"><p>' + LONG.replace("watch a tutorial video", '<a id="a1" href="/tut">watch a tutorial video</a>')
    .replace("the documentation", 'the <a id="a2" href="/doc">documentation</a>') + "</p></div>";
  const dom = new JSDOM(html, { url: "https://www.ncbi.nlm.nih.gov/geo/info/faq.html" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: DATA,
    site: { scope: "body", block: "pre, code", rescan: false, inlineExact: !!inlineExact }
  });
  engine.start();
  return dom.window.document;
}

test("开 inlineExact：长段里的链接文字按词库翻译", () => {
  const doc = boot(true);
  assert.equal(doc.getElementById("a1").textContent, "观看教程视频");
  assert.equal(doc.getElementById("a1").getAttribute("href"), "/tut");
});

test("不开 inlineExact：同样的链接保持英文（正文保护默认行为不变）", () => {
  const doc = boot(false);
  assert.equal(doc.getElementById("a1").textContent, "watch a tutorial video");
});

test("长段正文本身不因放行而被逐词翻", () => {
  const doc = boot(true);
  assert.match(doc.querySelector("p").textContent, /Submitters should read the/);
});
