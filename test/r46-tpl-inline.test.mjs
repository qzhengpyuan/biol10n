// r46：模板通道要覆盖内联文本容器（<small>/<b>/<em>），
// ENA 检索页的「Uses <a>EBI Search</a> to perform …」挂在 <small> 上，旧选择器漏掉了。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/ena.json"), "utf8"));
const common = JSON.parse(fs.readFileSync(path.join(root, "../dict/common.json"), "utf8"));
const all = {
  exact: Object.assign({}, common.exact, book.exact),
  rules: [...(common.rules || []), ...book.rules],
  templates: [...(common.templates || []), ...book.templates]
};
const site = { id: "ena", hosts: ["www.ebi.ac.uk"], dicts: ["common", "ena"], scope: "body", spa: false };
const CJK = /[\u4e00-\u9fff]/;

function run(html) {
  const dom = new JSDOM(html, { url: "https://www.ebi.ac.uk/ena/browser/search" });
  createEngine({ document: dom.window.document, window: dom.window, data: all, site }).start();
  return dom.window.document;
}
const text = (el) => el.textContent.replace(/\s+/g, " ").trim();

test("模板在 <small> 上生效，且 <a> 链接原样保留", () => {
  const doc = run(
    '<div id="content"><small>Uses <a class="no-underline" href="https://www.ebi.ac.uk/ebisearch">EBI Search</a> to perform a free text search across ENA data.</small></div>'
  );
  const s = doc.querySelector("small");
  assert.match(text(s), CJK, "small 未中文化: " + text(s));
  assert.doesNotMatch(text(s), /to perform a free text search/);
  const a = s.querySelector("a");
  assert.ok(a, "链接被抹掉了");
  assert.equal(a.getAttribute("href"), "https://www.ebi.ac.uk/ebisearch");
  assert.match(text(a), /EBI Search/);
});

test("模板在 <b>/<em>/<strong> 上同样生效", () => {
  const doc = run(
    '<p><b>Uses <a href="#x">EBI Search</a> to perform a free text search across ENA data.</b></p>' +
      '<p><em>Uses <a href="#y">EBI Search</a> to perform a free text search across ENA data.</em></p>'
  );
  for (const tag of ["b", "em"]) {
    const el = doc.querySelector(tag);
    assert.match(text(el), CJK, tag + " 未中文化");
    assert.ok(el.querySelector("a"), tag + " 的链接被抹掉了");
  }
});

test("没有对应模板的内联容器保持英文（不误伤）", () => {
  const doc = run("<div><small>Some unrelated English sentence that is not in the dictionary at all.</small></div>");
  assert.doesNotMatch(text(doc.querySelector("small")), CJK);
});
