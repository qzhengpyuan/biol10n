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

// 回归：SVG 命名空间里的 <style> tagName 是小写 "style"，
// 早期用大写键查 SKIP_TAGS 挡不住，.cls-1{fill:#737373} 会被当正文扫（GDV 页脚）。
test("SVG <style> 里的 CSS 不进入翻译", () => {
  const html = '<svg><style>.cls-1{fill:#737373}</style><text>Human</text></svg>';
  const dom = new JSDOM("<body>" + html + "</body>", { url: "https://example.org/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: { Human: "人类", ".cls-1{fill:#737373}": "坏翻译" }, rules: [] },
    site: { attrs: [], block: "", scope: "body" }
  });
  engine.start();
  const style = dom.window.document.querySelector("style");
  assert.equal(style.textContent, ".cls-1{fill:#737373}");
  assert.equal(dom.window.document.querySelector("text").textContent, "人类");
});

