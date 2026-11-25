// r58：GDC 流程页标题半中半英
// 现象（0.13.5 实测）：document.title = "生物信息学流程：DNA-Seq Analysis: Whole Genome
// Sequencing Variant Calling - GDC Docs" —— 只翻了 "Bioinformatics Pipeline:" 前缀，剩下的
// 流程名由规则 ^Bioinformatics Pipeline: (.+)$ 的捕获组原样带出，而整条标题 exact 只写了
// 不带 " - GDC Docs" 的形态，lookupExact 永远不命中。
// 修法：① 补 4 条带站点后缀的整标题 exact；② TITLE_BRANDS 放行 mRNA/miRNA 这类非全大写缩写，
// 否则整条中文标题会被 titleAcceptable 以 "mRNA 不是品牌" 退回。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;

const BOOKS = {};
for (const id of ["common", "onco", "anatomy", "gdc", "gdc2", "gdc-docs"]) {
  BOOKS[id] = JSON.parse(fs.readFileSync(path.join(root, "../dict", id + ".json"), "utf8"));
}
const site = sites.find((s) => s.id === "gdc-docs");
const data = { exact: {}, rules: [], templates: [] };
for (const id of site.dicts) {
  const b = BOOKS[id];
  if (!b) continue;
  Object.assign(data.exact, b.exact || {});
  data.rules = data.rules.concat(b.rules || []);
  data.templates = data.templates.concat(b.templates || []);
}

function title(orig) {
  const dom = new JSDOM("<body><p>placeholder</p></body>", {
    url: "https://docs.gdc.cancer.gov/Data/Bioinformatics_Pipelines/DNA_Seq_WGS/"
  });
  dom.window.document.title = orig;
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data,
    site: { id: "gdc-docs", hosts: ["docs.gdc.cancer.gov"], scope: "body" }
  });
  engine.start();
  return dom.window.document.title;
}

const CASES = [
  [
    "Bioinformatics Pipeline: DNA-Seq Analysis: Whole Genome Sequencing Variant Calling - GDC Docs",
    "生物信息学流程：DNA 测序分析：全基因组测序变异检测 - GDC 文档"
  ],
  [
    "Bioinformatics Pipeline: DNA-Seq Analysis: Whole Exome and Targeted Sequencing Analysis Pipeline - GDC Docs",
    "生物信息学流程：DNA 测序分析：全外显子与靶向测序分析流程 - GDC 文档"
  ],
  ["Bioinformatics Pipeline: mRNA Analysis - GDC Docs", "生物信息学流程：mRNA 分析 - GDC 文档"],
  ["Bioinformatics Pipeline: miRNA Analysis - GDC Docs", "生物信息学流程：miRNA 分析 - GDC 文档"]
];

for (const [orig, want] of CASES) {
  test("整条标题翻干净: " + orig.slice(0, 48) + "…", () => {
    assert.equal(title(orig), want);
  });
}

test("词库里有这 4 条带后缀的整标题，且没有残留英文流程名", () => {
  for (const [orig, want] of CASES) {
    assert.equal(BOOKS["gdc-docs"].exact[orig], want, "缺整标题词条: " + orig);
  }
});

test("非全大写缩写（mRNA/miRNA）不会被 titleAcceptable 退回", () => {
  const dom = new JSDOM("<body></body>", { url: "https://docs.gdc.cancer.gov/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data,
    site: { id: "gdc-docs", hosts: ["docs.gdc.cancer.gov"], scope: "body" }
  });
  dom.window.document.title = "Bioinformatics Pipeline: mRNA Analysis - GDC Docs";
  engine.start();
  // 若 mRNA 不在白名单，title 会原样保留英文
  assert.match(dom.window.document.title, /生物信息学流程/);
});
