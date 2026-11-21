// 检查方 r11 回归：长整串分区标题、下拉选项、分类词、拆条空格
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const load = (n) => JSON.parse(fs.readFileSync(path.join(root, "../dict", n + ".json"), "utf8"));

function run(dicts, html) {
  const dom = new JSDOM(html);
  const names = [].concat(dicts);
  const exact = {};
  let rules = [];
  for (const d of names) {
    const c = load(d);
    Object.assign(exact, c.exact || {});
    if (c.rules) rules = rules.concat(c.rules.map((r) => ({ ...r, _d: d })));
  }
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact, rules },
    site: { scope: "", block: "pre, code", attrs: [] }
  });
  engine.start();
  return dom.window.document;
}

test("UCSC hgGene 长整串分区标题整条翻译", () => {
  const doc = run("ucsc", [
    '<div class=subheadingBar>Comments and Description Text from UniProtKB</div>',
    '<div class=subheadingBar>RNA-Seq Expression Data from GTEx (53 Tissues, 570 Donors)</div>',
    '<div class=subheadingBar>Gene Ontology (GO) Annotations with Structured Vocabulary</div>'
  ].join(""));
  const got = [...doc.querySelectorAll("div.subheadingBar")].map((e) => e.textContent);
  assert.deepEqual(got, [
    "来自 UniProtKB 的注释与描述文本",
    "来自 GTEx 的 RNA-Seq 表达数据（53 种组织，570 位供体）",
    "带结构化词表的基因本体（GO）注释"
  ]);
});

test("UCSC hgGene 标题行按规则翻译并保留编号", () => {
  const doc = run("ucsc", '<div class=subheadingBar>Human Gene TP53 (ENST00000269305.9) from GENCODE V50</div>');
  assert.equal(doc.querySelector("div.subheadingBar").textContent, "人类基因 TP53（ENST00000269305.9，GENCODE V50）");
});

test("hgTables 输出格式下拉五项翻译、track 名不动", () => {
  const doc = run("ucsc", [
    "<select>",
    "<option>Selected fields from primary and related tables</option>",
    "<option>GTF - gene transfer format (limited)</option>",
    "<option>Custom track</option>",
    "<option>Hyperlinks to Genome Browser</option>",
    "<option>GENCODE V50</option>",
    "</select>"
  ].join(""));
  const got = [...doc.querySelectorAll("option")].map((o) => o.textContent);
  assert.deepEqual(got, [
    "主表与相关表中选定的字段",
    "GTF - 基因转移格式（有限）",
    "自定义轨道",
    "指向基因组浏览器的超链接",
    "GENCODE V50"
  ]);
});

test("RCSB 分类词带计数整条翻译，学名保持英文", () => {
  const doc = run("rcsb", [
    "<span>Experimental model (2)</span>",
    "<span>Non-standard residue (100)</span>",
    "<span>Multi-domain proteins (alpha and beta) (105)</span>",
    "<span>Homo sapiens (1,599)</span>"
  ].join(""));
  const got = [...doc.querySelectorAll("span")].map((e) => e.textContent);
  assert.deepEqual(got, [
    "实验模型（2）",
    "非标准残基（100）",
    "多结构域蛋白（α 和 β）（105）",
    "Homo sapiens (1,599)"
  ]);
});

test("RCSB 多选提示拆条只留一个空格", () => {
  const dom = new JSDOM('<small id=s>Use CTRL or Shift keys to select more than one file (</small>');
  const doc = dom.window.document;
  const span = doc.createElement("span");
  span.textContent = "25";
  doc.body.appendChild(span);
  doc.body.appendChild(doc.createTextNode(" files max)"));
  const rcsb = load("rcsb");
  const engine = createEngine({
    document: doc,
    window: dom.window,
    data: { exact: rcsb.exact, rules: rcsb.rules },
    site: { scope: "", block: "pre, code", attrs: [] }
  });
  engine.start();
  const text = doc.body.textContent.replace(/\s+/g, " ").trim();
  assert.equal(text, "使用 CTRL 或 Shift 键可选择多个文件（最多 25 个文件）");
});

test("GTEx 纯缩写标签按约定保留英文", () => {
  const doc = run("gtex", '<a class="nav-link" href="/home/qtl">ieQTL/isQTL</a>');
  assert.equal(doc.querySelector("a").textContent, "ieQTL/isQTL");
});
test("cBio 冒号规则不得把任意值整条翻掉", () => {
  const doc = run(["cbioportal", "common"], "<span>Study: Nuclear</span>");
  assert.equal(doc.querySelector("span").textContent, "Study: Nuclear");
});
