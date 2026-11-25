// r57 GTEx 词库补译回归：FAQ 骨架、问句、整段说明与行内链接模板（gtex）
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const { createEngine } = new Function(src + "\nreturn { createEngine };")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/gtex.json"), "utf8"));
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;
const SITE = { scope: "body", block: "pre, code", rescan: false };

function boot(html) {
  const dom = new JSDOM("<body>" + html + "</body>", { url: "https://gtexportal.org/home/faq" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: dict.exact, rules: dict.rules || [], templates: dict.templates || [] },
    site: SITE
  });
  engine.start();
  return dom.window.document;
}

test("词库形状：rules 与 templates 都是对象条目，不是数组对", () => {
  for (const r of dict.rules || []) {
    assert.equal(typeof r, "object");
    assert.equal(typeof r.re, "string");
    assert.equal(typeof r.to, "string");
  }
  for (const t of dict.templates || []) {
    assert.equal(typeof t, "object");
    assert.equal(typeof t.pat, "string");
    assert.equal(typeof t.zh, "string");
  }
  assert.ok(Array.isArray(dict.rules) && Array.isArray(dict.templates));
});

test("exact 条目：无首尾空白、无自映射、译文都有汉字", () => {
  const bad = [];
  for (const [en, zh] of Object.entries(dict.exact)) {
    if (!en || en !== en.trim()) bad.push("键空白: " + JSON.stringify(en));
    if (!zh || zh !== String(zh).trim()) bad.push("值空白: " + en);
    if (en === zh) bad.push("自映射: " + en);
    if (!CJK.test(zh)) bad.push("无中文: " + en);
  }
  assert.deepEqual(bad, []);
});

test("模板：占位符连续、译文占位符一一对应、长度合规", () => {
  assert.ok(dict.templates.length >= 38, "模板太少: " + dict.templates.length);
  const bad = [];
  for (const t of dict.templates) {
    const slots = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    const used = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    if (!slots.length) { bad.push("无占位符: " + t.pat.slice(0, 40)); continue; }
    if (slots.join(",") !== slots.map((_, i) => i + 1).join(",")) bad.push("编号不连续: " + t.pat.slice(0, 40));
    if (slots.join(",") !== used.join(",")) bad.push("译文不对应: " + t.pat.slice(0, 40));
    if (t.pat.length < 20 || t.pat.length > 2200) bad.push("长度: " + t.pat.length);
    if (!CJK.test(t.zh)) bad.push("无中文: " + t.pat.slice(0, 40));
  }
  assert.deepEqual(bad, []);
});

test("FAQ 骨架与问句都有条目", () => {
  const cases = [
    ["Frequently Asked Questions", "常见问题"],
    ["About data and analysis", "关于数据与分析"],
    ["About the GTEx Portal", "关于 GTEx 门户"],
    ["How was the autolysis score measured?", "自溶评分是如何测定的？"],
    ["Why does GTEx use TPM units rather than RPKM?", "为什么 GTEx 使用 TPM 而不是 RPKM？"],
    ["How to cite or acknowledge the GTEx project?", "如何引用或致谢 GTEx 项目？"],
    ["Can I use one of the figures in the GTEx Portal in my paper?", "我可以在论文中使用 GTEx 门户中的插图吗？"]
  ];
  for (const [en, zh] of cases) assert.equal(dict.exact[en], zh, "缺条目: " + en);
});

test("FAQ 长问句逐条保留专名（样本 ID、版本号、格式串不译）", () => {
  const q = dict.exact["What does the sample ID for an RNA-seq or genotype sample stand for, such as GTEX-14753-1626-SM-5NQ9L?"];
  assert.ok(q && q.includes("GTEX-14753-1626-SM-5NQ9L"), "样本 ID 应原样保留");
  const q2 = dict.exact["Why are the results in release v7 different from those in release v6p? My SNP of interest had a significant eQTL in v6P, but in v7 it no longer has a significant eQTL?"];
  assert.ok(q2 && q2.includes("v7") && q2.includes("v6p"), "版本号应原样保留");
  const q3 = dict.exact["How are splicing phenotype IDs created? The sQTL phenotype identifiers appear to be in the format: chr:bp_first:bp_end:clu_XXXX:ensg_geneID. Does the \"clu_XXXX\" id map to specific types of splicing events?"];
  assert.ok(q3 && q3.includes("chr:bp_first:bp_end:clu_XXXX:ensg_geneID"), "格式串应原样保留");
});

test("引擎：问句文本节点命中 exact", () => {
  const doc = boot("<ul><li><a>How was the autolysis score measured?</a></li></ul>");
  assert.equal(doc.querySelector("a").textContent, "自溶评分是如何测定的？");
});

test("引擎：整段说明命中 exact，基因名不动", () => {
  const html = "<p>The autolysis score was assigned by a pathologist during a visual inspection of the histology image.  The assigned values ranged from 0 to 3 (None, Mild, Moderate, and Severe).</p>";
  const doc = boot(html);
  assert.match(doc.querySelector("p").textContent, /自溶评分由病理学家/);
  const doc2 = boot("<span>CFD</span><span>APOD</span>");
  assert.equal(doc2.querySelectorAll("span")[0].textContent, "CFD");
  assert.equal(doc2.querySelectorAll("span")[1].textContent, "APOD");
});

test("引擎：带行内链接的整段走模板，链接与 href 保留", () => {
  const html = '<p>For privacy reasons, NIH policy prevents us from releasing the raw sequence data via the GTEx portal. You must request access via: <a href="https://dbgap.ncbi.nlm.nih.gov/">dbGAP</a>. Protected data are available in the AnVIL repository.</p>';
  const doc = boot(html);
  const p = doc.querySelector("p");
  assert.match(p.textContent, /出于隐私原因/);
  assert.match(p.textContent, /受保护数据可在 AnVIL 仓库中获取/);
  const a = p.querySelector("a");
  assert.equal(a.getAttribute("href"), "https://dbgap.ncbi.nlm.nih.gov/");
  assert.equal(a.textContent, "dbGAP");
});

test("引擎：模板把链接标签也译成中文，不留半中半英", () => {
  const html = '<p>The publicly available donor phenotypes and sample annotations can be downloaded from the GTEx Portal in the Annotation section of each release <a href="#">here</a></p>';
  const doc = boot(html);
  const p = doc.querySelector("p");
  assert.match(p.textContent, /公开的供体表型与样本注释/);
  const html2 = '<p>Access to protected data is described <a href="#">here</a></p>';
  const doc2 = boot(html2);
  assert.match(doc2.querySelector("p").textContent, /受保护数据的访问方式见/);
});

test("引擎：链接标签单条命中（含引号的单组织 eQTL）", () => {
  const doc = boot('<a href="#">Open Access Data page</a><a href="#">&quot;Single-Tissue eQTLs&quot;</a>');
  const links = doc.querySelectorAll("a");
  assert.equal(links[0].textContent, "开放获取数据页面");
  assert.equal(links[1].textContent, "“单组织 eQTL”");
});

test("引擎：组织名与版本号在问句里保持英文", () => {
  const doc = boot("<p>What is the difference between the tissue sites Brain - Frontal Cortex and Brain - Cortex, Brain - Cerebellum and Brain - Cerebellar Hemisphere?</p>");
  const t = doc.querySelector("p").textContent;
  assert.match(t, /有什么区别？$/);
  assert.ok(t.includes("Brain - Frontal Cortex") && t.includes("Brain - Cerebellar Hemisphere"));
});

test("引擎：工具名与品牌名不译，细胞描述句译出", () => {
  const doc = boot("<p>From what location/organ were the cells - cultured fibroblasts derived?</p>");
  assert.equal(doc.querySelector("p").textContent, "细胞 - 培养成纤维细胞取自哪个部位/器官？");
  const doc2 = boot("<p>No, trimming is not necessary with the STAR aligner. See: <a href=\"https://github.com/alexdobin/STAR/issues/455\">https://github.com/alexdobin/STAR/issues/455</a> for additional details.</p>");
  const p2 = doc2.querySelector("p");
  assert.match(p2.textContent, /使用 STAR 比对器时无需修剪/);
  assert.equal(p2.querySelector("a").getAttribute("href"), "https://github.com/alexdobin/STAR/issues/455");
});

test("规则：分页与数据源句式仍可用", () => {
  const doc = boot("<p>Showing 1 to 10 of 20 entries</p>");
  assert.equal(doc.querySelector("p").textContent, "显示第 1 至 10 条，共 20 条");
});

test("组织页：皮下组织说明句可译", () => {
  assert.equal(dict.exact["Subcutaneous tissue beneath the leg's skin sample."], "腿部皮肤样本下方的皮下组织。");
});
