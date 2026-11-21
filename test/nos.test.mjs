import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();
const cp = JSON.parse(fs.readFileSync(path.join(root, "../dict/cbioportal.json"), "utf8"));

function boot(html) {
  const dom = new JSDOM(html, { url: "https://www.cbioportal.org/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: cp.exact, rules: cp.rules },
    site: { scope: "", block: "pre, code", attrs: [] }
  });
  engine.start();
  return dom.window.document;
}

// 检查方 r9 的真实串：冒号后有空格（"Mixed Histology (NOS): 30 (2.8%)"），
// 规则必须带 \s*，否则回落通用括号规则会产出坏括号。
test("cBio 饼图图例带空格的 NOS 变体", () => {
  const doc = boot("<p id=a>Mixed Histology (NOS): 30 (2.8%)</p><p id=b>Infiltrating Carcinoma (NOS): 1 (<0.1%)</p>");
  assert.equal(doc.getElementById("a").textContent, "混合组织学（非特指）：30（2.8%）");
  assert.equal(doc.getElementById("b").textContent, "浸润性癌（非特指）：1（<0.1%）");
});

test("cBio NOS 带空格但无百分比", () => {
  const doc = boot("<p id=a>Mixed Histology (NOS): 30</p>");
  assert.equal(doc.getElementById("a").textContent, "混合组织学（非特指）：30");
});

test("cBio NOS 未收录名称也保留括号内的名字", () => {
  const doc = boot("<p id=a>Foo (NOS): 12 (5.5%)</p>");
  assert.equal(doc.getElementById("a").textContent, "Foo（非特指）：12（5.5%）");
});
