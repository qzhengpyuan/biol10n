// 标题分段：只切一层会留下半中半英（HPA「检索：TP53 - The Human Protein Atlas」）。
// 未命中的段再按其余分隔符拆一层，拆不出合格结果就整条不动。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();

function boot(title, { exact = {}, rules = [] } = {}) {
  const dom = new JSDOM("<p>hi</p>", { url: "https://www.proteinatlas.org/" });
  dom.window.document.title = title;
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact, rules },
    site: { scope: "body", block: "pre, code", attrs: [], rescan: [] }
  });
  engine.start();
  return { engine, doc: dom.window.document };
}

function loadDicts(ids) {
  const exact = {}, rules = [];
  for (const id of ids) {
    const d = JSON.parse(fs.readFileSync(path.join(root, "../dict", id + ".json"), "utf8"));
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
  }
  return { exact, rules };
}


test("嵌套分段：『Search: TP53 - The Human Protein Atlas』两段都译出，基因符号保留", () => {
  const { doc } = boot("Search: TP53 - The Human Protein Atlas", {
    exact: { Search: "检索", "The Human Protein Atlas": "人类蛋白质图谱" }
  });
  assert.equal(doc.title, "检索：TP53 - 人类蛋白质图谱");
});

test("嵌套分段拆不出合格结果时整条标题不动（不留半中半英）", () => {
  const { doc } = boot("Search: breast cancer - GEO DataSets - NCBI", {
    exact: { Search: "检索" }
  });
  assert.equal(doc.title, "Search: breast cancer - GEO DataSets - NCBI");
});

test("真实 HPA 词库：检索页标题整条中文化（此前是「检索：TP53 - The Human Protein Atlas」）", () => {
  const { exact, rules } = loadDicts(["hpa", "hpa2"]);
  const { doc } = boot("Search: TP53 - The Human Protein Atlas", { exact, rules });
  assert.equal(doc.title, "检索：TP53 - 人类蛋白质图谱");
});

test("真实 HPA 词库：组织表达页标题走整条规则，槽位里的基因符号保留", () => {
  const { exact, rules } = loadDicts(["hpa", "hpa2"]);
  const { doc } = boot("Tissue expression of TP53 - Summary - The Human Protein Atlas", { exact, rules });
  assert.equal(doc.title, "组织表达 - TP53 - 摘要 - 人类蛋白质图谱");
});