// 模板标记与站点重渲染：ENA 的 Angular 会把模板替换过的块换回英文，
// 引擎不能因为 data-biol10n-tpl 标记就把它永久当已译。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();

const DATA = {
  exact: {},
  rules: [],
  templates: [{ pat: "Refer to {{1}} for more details.", zh: "更多详情请参阅{{1}}。" }]
};
const SITE = { scope: "body", block: "pre, code", rescan: false };
const HTML = '<div id="box"><p id="p">Refer to <a href="#doc">Query Syntax documentation</a> for more details.</p></div>';

function boot() {
  const dom = new JSDOM(HTML, { url: "https://www.ebi.ac.uk/ena/browser/text-search?query=x" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data: DATA, site: SITE });
  engine.start();
  return { dom, engine, doc: dom.window.document };
}

test("模板首次命中：整块换成中文并保留链接", () => {
  const { doc } = boot();
  const p = doc.getElementById("p");
  assert.equal(p.textContent, "更多详情请参阅Query Syntax documentation。");
  assert.equal(p.querySelector("a").getAttribute("href"), "#doc");
  assert.equal(p.getAttribute("data-biol10n-tpl"), "1");
});

test("站点把块重渲染回英文后，scan 能再翻一次", () => {
  const { engine, doc } = boot();
  const p = doc.getElementById("p");
  p.innerHTML = 'Refer to <a href="#doc">Query Syntax documentation</a> for more details.';
  engine.scan();
  assert.equal(p.textContent, "更多详情请参阅Query Syntax documentation。");
});

test("仍为中文时不会重复替换（标记保留、无二次套模板）", () => {
  const { engine, doc } = boot();
  const p = doc.getElementById("p");
  engine.scan();
  engine.scan();
  assert.equal(p.textContent, "更多详情请参阅Query Syntax documentation。");
  assert.equal(p.getAttribute("data-biol10n-tpl"), "1");
});
