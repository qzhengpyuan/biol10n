import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();

const DATA = {
  exact: { Search: "搜索", "Advanced search": "高级检索", "Protein families": "蛋白家族", Dataset: "数据集" },
  rules: []
};

function boot(html) {
  const dom = new JSDOM(html, { url: "https://www.ensembl.org/biomart/martview" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: DATA,
    site: { scope: "body", attrs: ["placeholder", "title", "aria-label"] }
  });
  engine.start();
  return { engine, doc: dom.window.document, dom };
}

test("同源 iframe 里的界面文本被翻译", () => {
  const { engine, doc, dom } = boot('<iframe id="f"></iframe>');
  const frame = doc.getElementById("f");
  const fd = frame.contentDocument;
  fd.body.innerHTML = '<div><span>Dataset</span><button title="Search">Search</button></div>';
  engine.scan();
  assert.match(fd.body.textContent, /数据集/);
  assert.equal(fd.querySelector("button").getAttribute("title"), "搜索");
  assert.ok(engine.stats.frames >= 1);
  dom.window.close();
});

test("跨域 iframe（contentDocument 为 null）不报错", () => {
  const { engine, dom } = boot('<iframe id="x" src="about:blank"></iframe>');
  const frame = dom.window.document.getElementById("x");
  Object.defineProperty(frame, "contentDocument", { get() { return null; } });
  assert.doesNotThrow(() => engine.scan());
  dom.window.close();
});
