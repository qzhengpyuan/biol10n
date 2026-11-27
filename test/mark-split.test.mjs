// <mark> 行内高亮把条目名切成片段时的整段判定：
// InterPro 检索结果的「<mark>Protein</mark> kinase-like domain superfamily」原本被逐节点翻成
// 「蛋白质 kinase-like domain superfamily」（半中半英）。修复后片段必须按「整条文本流」判：
// 整条有整条译文才动（连高亮一起换），否则整段留英文，绝不单独翻片段。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const CJK = /[\u3400-\u9fff]/;

// 长正文块：修复前正因为它超过 proseMax（120）才进正文保护，而 mark 片段恰好从保护里漏出去。
const LONG = "This entry represents a large group of structurally related domains found in a wide variety of " +
  "proteins involved in signal transduction, cell cycle control and metabolic regulation across eukaryotes, " +
  "and the domain is shared by serine/threonine and tyrosine kinases as well as other ATP-binding proteins.";

const DATA = {
  exact: {
    "Protein": "蛋白质",
    "Download": "下载",
    "documentation": "文档",
    "Support": "支持",
    "watch a tutorial video": "观看教程视频"
  },
  rules: [],
  templates: []
};

// 整条文本流本身收在词表里：这种形态应该整段换掉，而不是只翻 <mark> 里的半句
const DATA_WHOLE = {
  exact: Object.assign({}, DATA.exact, { "Download all": "下载全部" }),
  rules: [],
  templates: []
};

function boot(html, opts) {
  const o = opts || {};
  const dom = new JSDOM(html, { url: o.url || "https://www.ebi.ac.uk/interpro/search/text/Protein" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: o.data || DATA,
    site: { id: "interpro", scope: "body", block: "pre, code", rescan: false, inlineExact: !!o.inlineExact }
  });
  engine.start();
  return { doc: dom.window.document, engine };
}

test("mark 切开的条目名：长正文块里整段留英文，不出现中文片段", () => {
  const { doc } = boot(
    '<div id="main"><p id="p1"><a id="a1" href="/interpro/entry/IPR000719"><mark>Protein</mark> ' +
    'kinase-like domain superfamily</a>. ' + LONG + "</p></div>"
  );
  const p1 = doc.getElementById("p1");
  assert.ok(p1.textContent.length > 120, "复现前提：块 textContent 必须 > 120");
  assert.equal(doc.getElementById("a1").textContent, "Protein kinase-like domain superfamily");
  assert.doesNotMatch(p1.textContent, CJK, "整块被翻出了中文片段（半中半英）");
  assert.equal(doc.querySelectorAll("mark").length, 1, "高亮结构不该被片段翻译破坏");
});

test("mark 切开的条目名：短块（不触发正文保护）同样留英文", () => {
  const { doc } = boot('<div><p id="p2"><a id="a2"><mark>Protein</mark> kinase-like domain superfamily</a></p></div>');
  const p2 = doc.getElementById("p2");
  assert.ok(p2.textContent.length <= 120, "这一条的前提是短块");
  assert.equal(doc.getElementById("a2").textContent, "Protein kinase-like domain superfamily");
  assert.doesNotMatch(p2.textContent, CJK);
});

test("独立高亮词照常翻译：<mark>Download</mark>", () => {
  const { doc } = boot('<div><button id="b1"><mark>Download</mark></button><p id="p3"><mark>Download</mark></p></div>');
  assert.equal(doc.getElementById("b1").textContent, "下载");
  assert.equal(doc.getElementById("p3").textContent, "下载");
});

test("普通行内场景不变：长段里的链接文字仍受正文保护，短标签照翻", () => {
  const { doc } = boot(
    '<div id="main"><p id="p4">Read the <a id="l1" href="/doc">documentation</a> before you submit data to any ' +
    "of the databases hosted here, and contact the helpdesk if the upload fails because of a file format problem.</p>" +
    '<p id="p5"><a id="l2" href="/support">Support</a></p></div>'
  );
  assert.equal(doc.getElementById("l1").textContent, "documentation", "正文里的链接文字不该被单独翻");
  assert.equal(doc.getElementById("l2").textContent, "支持", "独立短标签应照翻");
});

test("inlineExact 的整段拼回通道不回归，mark 片段仍不翻", () => {
  const q1 = "For help with submitting your data, please " +
    '<a id="a1" href="/tut">watch a tutorial video</a>' +
    ". Submitters should read the documentation before starting, and contact us if the submission form does " +
    "not accept your file. The FAQ covers every step of the process in detail and explains what to do when a file is rejected.";
  const { doc } = boot(
    '<div id="main"><p id="q1">' + q1 + '</p><p id="q2"><a id="m1"><mark>Protein</mark> kinase-like domain ' +
    'superfamily</a>. ' + LONG + "</p></div>",
    { inlineExact: true, url: "https://www.ncbi.nlm.nih.gov/geo/info/faq.html" }
  );
  assert.equal(doc.getElementById("a1").textContent, "观看教程视频", "inlineExact 拼回整段命中被挡了");
  assert.equal(doc.getElementById("m1").textContent, "Protein kinase-like domain superfamily");
  assert.doesNotMatch(doc.getElementById("q2").textContent, CJK);
});

test("整条文本流有整条译文时整段替换（不是只翻高亮片段）", () => {
  const { doc, engine } = boot(
    '<div><p id="p6"><a id="f1" href="/download"><mark>Download</mark> all</a></p></div>',
    { data: DATA_WHOLE }
  );
  const f1 = doc.getElementById("f1");
  assert.equal(f1.textContent, "下载全部");
  assert.equal(f1.getAttribute("href"), "/download", "整段替换不能丢链接");
  engine.restore();
  assert.equal(f1.textContent, "Download all", "restore 要把原文与 <mark> 挂回去");
});

test("真实 InterPro 结构：<mark> 两侧是 <span> 时同样整段留英文", () => {
  // 线上 DOM 实测形态：<a href="…"><span></span><mark>Protein</mark><span> kinase domain</span></a>
  // 两侧是元素而不是文本节点，nextTextAfter/prevTextBefore 看不到同句，修复前照样翻成「蛋白质 kinase domain」。
  const { doc } = boot(
    '<div id="main"><div id="card"><a id="r1" href="/interpro/entry/IPR000719/"><span></span><mark>Protein</mark>' +
    '<span> kinase domain</span></a><p>' + LONG + "</p></div></div>"
  );
  assert.equal(doc.getElementById("r1").textContent, "Protein kinase domain");
  assert.doesNotMatch(doc.getElementById("card").textContent, CJK);
});
