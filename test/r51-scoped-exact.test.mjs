// r51：按选择器精确替换（site.scopedExact）
// 目的：导航标签这种「单词级」词条只在该元素里生效，正文句子里的同名单词不受影响。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();

const data = { exact: {}, rules: [], templates: [] };
const site = {
  id: "t",
  dicts: [],
  scopedExact: [
    { sel: "a.md-tabs__link, label.md-nav__title", exact: { Data: "数据", Tool: "工具" } }
  ]
};

function boot(html) {
  const dom = new JSDOM(html, { url: "https://docs.example.org/" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return { doc: dom.window.document, engine };
}

test("选择器命中的导航标签翻成中文", () => {
  const { doc } = boot('<a class="md-tabs__link" href="/Data/Introduction/">Data</a>');
  assert.equal(doc.querySelector("a").textContent, "数据");
});

test("嵌套子元素（<span>）也命中，最多向上找 3 层", () => {
  const { doc } = boot('<a class="md-tabs__link"><span class="md-ellipsis">Tool</span></a>');
  assert.equal(doc.querySelector("span").textContent, "工具");
});

test("同样单词出现在正文里不翻", () => {
  const { doc } = boot("<p>Generates manifests for use with GDC Data Transfer Tool</p>");
  assert.equal(doc.querySelector("p").textContent, "Generates manifests for use with GDC Data Transfer Tool");
});

test("不在 scoped 选择器里、词库里也没有该词时保持英文", () => {
  const { doc } = boot('<div class="other">Data</div>');
  assert.equal(doc.querySelector("div").textContent, "Data");
});
