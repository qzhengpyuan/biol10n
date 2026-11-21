// clinvar-tip：ClinVar 变异页字段定义 / 悬停提示 / 帮助句（整句进 exact）
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const engineSrc = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(engineSrc + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/clinvar-tip.json"), "utf8"));

function boot(html) {
  const dom = new JSDOM(html, { url: "https://www.ncbi.nlm.nih.gov/clinvar/variation/12881/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: dict.exact, rules: dict.rules || [], templates: dict.templates || [] },
    site: { scope: "body", block: "pre, code" }
  });
  engine.start();
  return { dom, engine, doc: dom.window.document };
}

const GMAF =
  "The global minor allele frequency calculated by the 1000 Genomes Project. The minor allele at this location is indicated in parentheses and may be different from the allele represented by this VCV record.";
const HAPLO =
  "The haploinsufficiency score for the gene, curated by ClinGen\u2019s Dosage Sensitivity Curation task team.";
const GENE_COUNT =
  "The number of variants in ClinVar that are contained within this gene, with a link to view the list of variants.";

test("GMAF 字段说明整句变中文", () => {
  const { dom, doc } = boot("<p>" + GMAF + "</p>");
  const p = doc.querySelector("p");
  assert.match(p.textContent, /千人基因组计划/, "整句应换成中文");
  assert.match(p.textContent, /VCV 记录/, "句尾也应换成中文");
  assert.doesNotMatch(p.textContent, /The global minor allele frequency/);
  dom.window.close();
});

test("单倍剂量不足说明整句变中文，ClinGen 保留", () => {
  const { dom, doc } = boot("<p>" + HAPLO + "</p>");
  const p = doc.querySelector("p");
  assert.match(p.textContent, /单倍剂量不足评分/, "整句应换成中文");
  assert.match(p.textContent, /ClinGen/, "机构名保持英文");
  assert.doesNotMatch(p.textContent, /curated by/);
  dom.window.close();
});

test("变异数量说明整句变中文", () => {
  const { dom, doc } = boot("<p>" + GENE_COUNT + "</p>");
  const p = doc.querySelector("p");
  assert.match(p.textContent, /完全包含在该基因内/, "整句应换成中文");
  assert.doesNotMatch(p.textContent, /with a link to view the list/);
  dom.window.close();
});

test("词表自检：条数、汉字、邮箱与 .gov 链接", () => {
  const keys = Object.keys(dict.exact);
  assert.ok(keys.length >= 20, "exact 条数应 ≥ 20，实际 " + keys.length);
  const cjk = /[\u4e00-\u9fff]/;
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.ok(k.trim().length > 0, "英文键不应为空");
    assert.notEqual(k, v, "不应自映射: " + k.slice(0, 60));
    assert.match(v, cjk, "译文应含汉字: " + k.slice(0, 60));
    assert.doesNotMatch(v, /[\w.+-]+@[\w-]+\.[\w.]+/, "译文不应含邮箱: " + k.slice(0, 60));
    assert.ok(!v.includes(".gov"), "译文不应含 .gov 链接: " + k.slice(0, 60));
    assert.ok(!v.includes("http"), "译文不应含网址: " + k.slice(0, 60));
  }
  const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
  assert.equal(dup.length, 0, "同句不应重复收录");
  assert.ok(Array.isArray(dict.rules) && Array.isArray(dict.templates), "rules/templates 必须是数组");
});

test("无关英文段落不受影响", () => {
  const { dom, doc } = boot("<p>This paragraph is not part of the ClinVar tooltip dictionary.</p>");
  assert.match(doc.querySelector("p").textContent, /not part of the ClinVar tooltip dictionary/);
  dom.window.close();
});
