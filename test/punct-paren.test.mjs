import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";
const srcEngine = fs.readFileSync(new URL("../src/engine.js", import.meta.url), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();

const sites = JSON.parse(fs.readFileSync(new URL("../config/sites.json", import.meta.url), "utf8"));
const site = sites.sites.find((s) => s.id === "msigdb");
const data = { exact: {}, rules: [], templates: [] };
for (const name of ["common", "msigdb"]) {
  const b = JSON.parse(fs.readFileSync(new URL(`../dict/${name}.json`, import.meta.url), "utf8"));
  Object.assign(data.exact, b.exact || {});
  data.rules = data.rules.concat(b.rules || []);
  data.templates = data.templates.concat(b.templates || {});
}

function run(html) {
  const dom = new JSDOM(html, { url: "https://www.gsea-msigdb.org/gsea/msigdb/human/collections.jsp" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return dom.window.document;
}

test("左括号紧跟被翻译的链接时补成全角", () => {
  const doc = run('<p><span class="sub">(<a href="#">browse 50 gene sets</a>)</span></p>');
  assert.equal(doc.querySelector(".sub").textContent, "（浏览 50 个基因集）");
});

test("英文语境里的半角括号不动", () => {
  const doc = run("<p>Choose a collection (optional)</p>");
  assert.equal(doc.querySelector("p").textContent, "Choose a collection (optional)");
});
