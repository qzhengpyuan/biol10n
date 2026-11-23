// 内联 <svg> 图标（链接里的下载箭头）不该让整段模板作废（r30 GDC 开发者页）。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();

const SITE = { scope: "", block: "pre, code", attrs: [], proseMax: 120 };

function boot(html, data) {
  const dom = new JSDOM(html, { url: "https://gdc.cancer.gov/developers" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: data.exact || {}, rules: [], templates: data.templates || [] },
    site: SITE
  });
  return { dom, engine, doc: dom.window.document };
}

const HTML =
  '<p>You can <a href="/docs">download <svg width="8" height="8"><path d="M0 0h8v8H0z"/></svg></a> the full documentation here.</p>';
const TPL = {
  pat: "You can {{1}} the full documentation here.",
  zh: "你可以{{1}}完整文档。"
};

test("链接内含内联 svg 时模板仍然命中，svg 保留在链接里", () => {
  const { engine, doc, dom } = boot(HTML, { templates: [TPL], exact: { download: "下载" } });
  engine.start();
  const p = doc.querySelector("p");
  assert.match(p.textContent, /完整文档/, "段落应换成中文");
  const a = p.querySelector("a");
  assert.ok(a, "链接节点必须还在");
  assert.ok(a.querySelector("svg"), "图标 svg 必须保留");
  assert.equal(engine.stats.tpl, 1, "模板命中计数");
  dom.window.close();
});

test("链接文本本身仍被逐节点翻成中文", () => {
  const { engine, doc, dom } = boot(HTML, { templates: [TPL], exact: { download: "下载" } });
  engine.start();
  const a = doc.querySelector("p a");
  assert.match(a.textContent, /下载/, "槽位里的 download 应被翻成下载：" + a.textContent);
  dom.window.close();
});
