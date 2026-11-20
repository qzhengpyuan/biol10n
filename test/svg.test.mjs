import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const src = readFileSync(new URL("../src/engine.js", import.meta.url), "utf8");
const { createEngine } = new Function(src + "\nreturn { createEngine };")();

// UCSC 网关物种树：<text><tspan>Human</tspan><tspan>Homo sapiens</tspan></text>
// 整段拼接必然命中不了词表，但第一个 tspan 是完整单词，应该单独翻。
test("SVG 多 tspan 时整段不命中也能逐个完整词兜底", () => {
  const html = '<svg><text><tspan>Human</tspan><tspan>Homo sapiens</tspan></text>' +
    '<text><tspan>Bone </tspan><tspan>marrow</tspan></text></svg>';
  const dom = new JSDOM("<body>" + html + "</body>", { url: "https://example.org/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: { "Human": "人类", "Bone marrow": "骨髓" }, rules: [] },
    site: { attrs: [], block: "", scope: "body", proseGuard: true }
  });
  engine.start();
  const texts = [...dom.window.document.querySelectorAll("text")].map(t => t.textContent);
  assert.match(texts[0], /人类/);
  assert.match(texts[0], /Homo sapiens/);
  assert.match(texts[1], /骨髓/);
});
