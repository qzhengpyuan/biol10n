// ClinVar 主站/记录页：页头导航、区块标题、表头、表单提示、规则句
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const core = JSON.parse(fs.readFileSync(path.join(root, "../dict/clinvar-core.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "ncbi-clinvar");

/** 起一个最小 DOM 并跑一遍引擎，返回 document */
function run(html) {
  const dom = new JSDOM(html);
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: core.exact, rules: core.rules },
    site
  });
  engine.start();
  return dom.window.document;
}

test("ClinVar 站点导航与页脚入口翻成中文", () => {
  const doc = run(
    '<nav><a href="#"><span>ClinVar Home</span></a><a>About ClinVar</a><a>Understand the Data</a>' +
      '<a>Access the Data</a><a>Submit Data</a><a>Expert panels and practice guidelines</a></nav>' +
      '<footer><a>List of submitters</a><a>Map of submitters</a><a>Web Policies</a></footer>'
  );
  const t = [...doc.querySelectorAll("nav a")].map((e) => e.textContent);
  assert.deepEqual(t, ["ClinVar 首页", "关于 ClinVar", "理解数据", "获取数据", "提交数据", "专家组与实践指南"]);
  assert.equal(doc.querySelectorAll("footer a")[0].textContent, "提交者列表");
  assert.equal(doc.querySelectorAll("footer a")[1].textContent, "提交者分布图");
});

test("变异记录页区块标题（含 - Germline 组合）与固定说明句", () => {
  const doc = run(
    '<h3>Conditions - Germline</h3>' +
      '<h3>Submissions - Germline</h3>' +
      '<h3>Submissions - Functional Data</h3>' +
      '<h3>Variant Details</h3>' +
      '<h3>Text-mined citations for rs28897672</h3>' +
      '<p>Functional data are available for this variant</p>'
  );
  const h = [...doc.querySelectorAll("h3")].map((e) => e.textContent);
  assert.deepEqual(h, [
    "疾病条件（胚系）",
    "提交记录（胚系）",
    "提交记录 - 功能数据",
    "变异详情",
    "rs28897672 的文献挖掘引文"
  ]);
  assert.equal(doc.querySelector("p").textContent, "该变异有可用的功能数据");
});

test("记录页表头、dt 标签与提交区块固定枚举", () => {
  const doc = run(
    '<dl><dt>Type and length</dt><dd>x</dd><dt>Timeline in ClinVar</dt><dd>y</dd>' +
      '<dt>Global minor allele frequency (GMAF)</dt><dd>0.00003</dd></dl>' +
      '<table><thead><tr><th>Assertion criteria</th><th>Submitter</th><th>Variation/condition record</th></tr></thead>' +
      "<tbody><tr><td>criteria provided, multiple submitters, no conflicts</td>" +
      "<td>reviewed by expert panel</td><td>no assertion criteria provided</td></tr></tbody></table>"
  );
  const dt = [...doc.querySelectorAll("dt")].map((e) => e.textContent);
  assert.deepEqual(dt, ["类型与长度", "ClinVar 时间线", "全球次要等位基因频率（GMAF）"]);
  const th = [...doc.querySelectorAll("th")].map((e) => e.textContent);
  assert.deepEqual(th, ["断言标准", "提交者", "变异/疾病记录"]);
  const td = [...doc.querySelectorAll("td")].map((e) => e.textContent);
  assert.deepEqual(td, ["提供了断言标准，多个提交者，无冲突", "由专家组审核", "未提供断言标准"]);
});

test("属性通道：检索框 placeholder、展开按钮 title、审核状态提示", () => {
  const doc = run(
    '<input id="q" placeholder="Search ClinVar for gene symbols, HGVS expressions, conditions, and more">' +
      '<i id="exp" title="Expand all rows"></i>' +
      '<a id="rs" title="Review status: criteria provided, single submitter Click for help">★</a>'
  );
  assert.equal(doc.getElementById("q").getAttribute("placeholder"), "检索 ClinVar：基因符号、HGVS 表达、疾病等");
  assert.equal(doc.getElementById("exp").getAttribute("title"), "展开全部行");
  assert.equal(doc.getElementById("rs").getAttribute("title"), "审核状态：提供了断言标准，单一提交者，点击查看帮助");
});

test("规则：首次收录日期、登录号、观察记录、计数与省略形式", () => {
  const doc = run(
    '<div><span id="first">First in ClinVar: Oct 22, 2016</span></div>' +
      '<div><span id="acc">Accession: SCV000244308.1</span></div>' +
      '<div><span id="obs">Observation 1</span></div>' +
      '<div><a id="more">+2 more</a></div>' +
      '<div><a id="hgvs">... more HGVS</a></div>' +
      '<div><span id="age">30-39 years</span></div>' +
      '<div><span id="last">Record last updated Nov 14, 2026</span></div>'
  );
  assert.equal(doc.getElementById("first").textContent, "首次收录于 ClinVar：Oct 22, 2016");
  assert.equal(doc.getElementById("acc").textContent, "登录号：SCV000244308.1");
  assert.equal(doc.getElementById("obs").textContent, "观察记录 1");
  assert.equal(doc.getElementById("more").textContent, "另有 2 条");
  assert.equal(doc.getElementById("hgvs").textContent, "…展开更多 HGVS");
  assert.equal(doc.getElementById("age").textContent, "30–39 岁");
  assert.equal(doc.getElementById("last").textContent, "记录最后更新于 Nov 14, 2026");
});

test("检索表单标签带示例值时只翻标签、示例值原样保留", () => {
  const doc = run(
    '<div><span id="gene">Gene symbol: CFTR</span></div>' +
      '<div><span id="rsn">rs number: rs180177042</span></div>' +
      '<div><span id="hgsv">HGVS: NM_000314.8:c.395G>T</span></div>' +
      '<div><span id="vid">ClinVar Variation ID: 1473634</span></div>'
  );
  assert.equal(doc.getElementById("gene").textContent, "基因符号：CFTR");
  assert.equal(doc.getElementById("rsn").textContent, "rs 编号：rs180177042");
  assert.equal(doc.getElementById("hgsv").textContent, "HGVS：NM_000314.8:c.395G>T");
  assert.equal(doc.getElementById("vid").textContent, "ClinVar 变异 ID：1473634");
});

test("变异名、HGVS、疾病名、submitter 等数据保持英文", () => {
  const doc = run(
    '<p id="hgvs">NM_007294.4(BRCA1):c.181T&GT;G (p.Cys61Gly)</p>' +
      '<p id="cond">Breast-ovarian cancer, familial, susceptibility to, 1</p>' +
      '<div><span id="lab">Institute of Human Genetics, University of Leipzig Medical Center</span></div>' +
      '<div><span id="scv">SCV000244308.1</span></div>'
  );
  assert.equal(doc.getElementById("hgvs").textContent, "NM_007294.4(BRCA1):c.181T>G (p.Cys61Gly)");
  assert.equal(doc.getElementById("cond").textContent, "Breast-ovarian cancer, familial, susceptibility to, 1");
  assert.equal(
    doc.getElementById("lab").textContent,
    "Institute of Human Genetics, University of Leipzig Medical Center"
  );
  assert.equal(doc.getElementById("scv").textContent, "SCV000244308.1");
});
test("首页主线文案与检索结果计数片段", () => {
  const doc = run(
    '<p id="desc">ClinVar aggregates information about genomic variation and its relationship to human health.</p>' +
      '<h3 id="country">Submitters Per Country</h3>' +
      '<h2 id="welcome">ClinVar welcomes submissions</h2>' +
      '<div><span id="count">16,172 variants for</span></div>'
  );
  assert.equal(
    doc.getElementById("desc").textContent,
    "ClinVar 汇集基因组变异及其与人类健康关系的信息。"
  );
  assert.equal(doc.getElementById("country").textContent, "各国提交者");
  assert.equal(doc.getElementById("welcome").textContent, "ClinVar 欢迎提交数据");
  assert.equal(doc.getElementById("count").textContent, "16,172 条变异：");
});
