import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";

const root = path.dirname(new URL(import.meta.url).pathname);
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();

const DATA = {
  exact: { "Breast Invasive Carcinoma": "乳腺浸润性癌", "PanCancer Atlas": "泛癌图谱" },
  rules: [
    { re: "^(.+) \\(TCGA, (.+)\\)$", to: "$1（TCGA，$2）", requireHit: true },
    { re: "^(.+) \\((\\d+)\\)$", to: "$1（$2）", requireHit: true }
  ]
};

function boot(html) {
  const dom = new JSDOM(html, { url: "https://www.cbioportal.org/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: DATA,
    site: { scope: "", block: "pre, code, textarea", attrs: [] }
  });
  engine.scan();
  return dom.window.document;
}

test("捕获组真的命中才套全角标点", () => {
  const doc = boot("<div><span>Breast Invasive Carcinoma (TCGA, PanCancer Atlas)</span></div>");
  assert.equal(doc.querySelector("span").textContent, "乳腺浸润性癌（TCGA，泛癌图谱）");
});

test("纯英文专名保持原样，不被套上半角转全角", () => {
  const doc = boot("<div><span>Pan-Lung Cancer (TCGA, Nat Genet 2016)</span></div>");
  assert.equal(doc.querySelector("span").textContent, "Pan-Lung Cancer (TCGA, Nat Genet 2016)");
});

test("数字捕获组不阻断模板（data 也算命中前先判）", () => {
  const doc = boot("<div><span>Breast Invasive Carcinoma (12)</span></div>");
  assert.equal(doc.querySelector("span").textContent, "乳腺浸润性癌（12）");
});
