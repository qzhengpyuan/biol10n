import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";

const root = path.dirname(new URL(import.meta.url).pathname);
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();

const DATA = {
  exact: {
    Search: "搜索",
    "Advanced search": "高级检索",
    Results: "结果",
    "Per page": "每页条数",
    Gene: "基因",
    "Reference sequence": "参考序列"
  },
  rules: [
    { re: "^Showing (\\d+) of ([\\d,]+) results$", to: "显示第 $1 条，共 $2 条结果" },
    { re: "^Sort by (.+)$", to: "按 $1 排序" },
    { re: "^Search results for \"(.+)\"$", to: "“$1”的检索结果" }
  ]
};
const SITE = { scope: "", block: "pre, code, kbd, samp, textarea", attrs: ["placeholder", "title", "aria-label", "alt"] };

function boot(html) {
  const dom = new JSDOM(html, { url: "https://pubmed.ncbi.nlm.nih.gov/?term=brca1" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: DATA,
    site: SITE
  });
  return { dom, engine, doc: dom.window.document };
}

test("精确命中并保留外侧空白", () => {
  const { engine, doc } = boot("<div>\n  Search\n</div>");
  engine.start();
  assert.equal(doc.querySelector("div").textContent, "\n  搜索\n");
});

test("整句模板替换并保留变量", () => {
  const { engine, doc } = boot("<p>Showing 1 of 20 results</p>");
  engine.start();
  assert.equal(doc.querySelector("p").textContent, "显示第 1 条，共 20 条结果");
});

test("已有中文的节点不重复处理", () => {
  const { engine, doc } = boot("<p>搜索 Search</p>");
  engine.start();
  assert.equal(doc.querySelector("p").textContent, "搜索 Search");
});

test("code/pre 内不翻译", () => {
  const { engine, doc } = boot("<pre>Search</pre><code>Results</code>");
  engine.start();
  assert.equal(doc.querySelector("pre").textContent, "Search");
  assert.equal(doc.querySelector("code").textContent, "Results");
});

test("词表里没有的专有名词原样保留", () => {
  const { engine, doc } = boot("<div><span>BRCA1</span><span>TP53</span></div>");
  engine.start();
  assert.equal(doc.querySelectorAll("span")[0].textContent, "BRCA1");
  assert.equal(doc.querySelectorAll("span")[1].textContent, "TP53");
});

test("属性翻译：placeholder / title / aria-label", () => {
  const { engine, doc } = boot('<input placeholder="Search" title="Search" aria-label="Search">');
  engine.start();
  const el = doc.querySelector("input");
  assert.equal(el.getAttribute("placeholder"), "搜索");
  assert.equal(el.getAttribute("title"), "搜索");
  assert.equal(el.getAttribute("aria-label"), "搜索");
});

test("重复扫描是幂等的", () => {
  const { engine, doc } = boot("<span>Search</span>");
  engine.start();
  engine.scan();
  engine.scan();
  assert.equal(doc.querySelector("span").textContent, "搜索");
});

test("动态插入的节点会被观察器处理", async () => {
  const { engine, doc } = boot("<div id=root></div>");
  engine.start();
  const p = doc.createElement("p");
  p.textContent = "Results";
  doc.getElementById("root").appendChild(p);
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(p.textContent, "结果");
});

test("disable 能还原原文", () => {
  const { engine, doc } = boot("<span>Search</span>");
  engine.start();
  assert.equal(doc.querySelector("span").textContent, "搜索");
  engine.disable();
  assert.equal(doc.querySelector("span").textContent, "Search");
});

test("未命中文本进入缺词表", () => {
  const { engine } = boot("<p>Query sequence</p>");
  engine.start();
  assert.ok(engine.misses().includes("Query sequence"));
});

test("模板捕获组会在词表里二次查表", () => {
  const { engine, doc } = boot("<span>Sort by Gene</span>");
  engine.start();
  assert.equal(doc.querySelector("span").textContent, "按 基因 排序");
});

test("模板捕获组查不到时保留原文", () => {
  const { engine, doc } = boot("<p>Sort by Relevance</p>");
  engine.start();
  assert.equal(doc.querySelector("p").textContent, "按 Relevance 排序");
});

test("模板里带引号的捕获组能去掉引号后命中", () => {
  const { engine, doc } = boot('<p>Search results for "Gene"</p>');
  engine.start();
  assert.equal(doc.querySelector("p").textContent, "“基因”的检索结果");
});

test("pushState 路由切换后会重新扫描", async () => {
  const { engine, dom, doc } = boot("<div id=root><p>Search</p></div>");
  engine.start();
  assert.equal(doc.querySelector("p").textContent, "搜索");
  const p = doc.createElement("p");
  p.textContent = "Results";
  doc.getElementById("root").appendChild(p);
  dom.window.history.pushState({}, "", "/?page=2");
  await new Promise((r) => setTimeout(r, 700));
  assert.equal(p.textContent, "结果");
});

test("SPA 等待元素出现后再扫描", async () => {
  const dom = new JSDOM("<div id=app></div>", { url: "https://www.ensembl.org/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: DATA,
    site: { ...SITE, spa: true, waitFor: "#gene-summary" }
  });
  engine.start();
  const wrap = dom.window.document.createElement("div");
  wrap.id = "gene-summary";
  wrap.innerHTML = "<span>Results</span>";
  dom.window.document.getElementById("app").appendChild(wrap);
  await new Promise((r) => setTimeout(r, 600));
  assert.equal(dom.window.document.querySelector("span").textContent, "结果");
});
