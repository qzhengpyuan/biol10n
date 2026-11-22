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
  exact: {
    Search: "搜索",
    "Advanced search": "高级检索",
    "Protein families": "蛋白家族",
    Explore: "探索"
  },
  rules: []
};

function boot(html) {
  const dom = new JSDOM(html, { url: "https://www.ebi.ac.uk/interpro/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: DATA,
    site: { scope: "body", block: "pre, code", attrs: ["placeholder", "title", "aria-label", "alt"] }
  });
  engine.start();
  return { engine, doc: dom.window.document, dom };
}

test("开放 shadow root 里的文本与属性被翻译", () => {
  const { engine, doc, dom } = boot('<div id="host"></div>');
  const host = doc.getElementById("host");
  const sr = host.attachShadow({ mode: "open" });
  sr.innerHTML = '<p>Advanced search</p><button title="Search">Search</button><span>Protein families</span>';
  engine.scan();
  assert.match(sr.textContent, /高级检索/, "shadow 里的文本应翻成中文");
  assert.match(sr.textContent, /搜索/, "按钮文本也应命中");
  assert.match(sr.textContent, /蛋白家族/);
  assert.equal(sr.querySelector("button").getAttribute("title"), "搜索", "title 属性同样走属性通道");
  assert.ok(engine.stats.shadow >= 1, "统计里应记录处理过的 shadow root");
  dom.window.close();
});

test("嵌套 shadow root 也会被覆盖", () => {
  const { engine, doc, dom } = boot('<div id="outer"></div>');
  const outer = doc.getElementById("outer").attachShadow({ mode: "open" });
  outer.innerHTML = '<div id="inner"></div><p>Explore</p>';
  const inner = outer.getElementById("inner").attachShadow({ mode: "open" });
  inner.innerHTML = "<p>Advanced search</p>";
  engine.scan();
  assert.match(outer.textContent, /探索/);
  assert.match(inner.textContent, /高级检索/, "嵌套的那一层也要翻");
  dom.window.close();
});

test("运行时挂上的 shadow root 也会被处理", async () => {
  const { engine, doc, dom } = boot('<div id="app"></div>');
  const host = doc.createElement("x-card");
  const sr = host.attachShadow({ mode: "open" });
  sr.innerHTML = "<p>Advanced search</p>";
  doc.getElementById("app").appendChild(host);
  await new Promise((r) => setTimeout(r, 700));
  assert.match(sr.textContent, /高级检索/, "后插的 shadow 内容也要翻");
  dom.window.close();
});
