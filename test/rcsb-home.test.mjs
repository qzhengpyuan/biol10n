// RCSB PDB 改版首页与新组件词库（dict/rcsb-home.json）冒烟测试：
// 首页检索帮助卡、统计卡与新闻标题；检索结果页查询摘要/分页；结构页新技术字段；帮助弹窗与页脚模板
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const readDict = (n) => JSON.parse(fs.readFileSync(path.join(root, "../dict", n + ".json"), "utf8"));
const dict = readDict("rcsb-home");
const common = readDict("common");
const spa = readDict("spa");
const rcsb = readDict("rcsb");

// config/sites.json 里 RCSB 站点 id 为 rcsb-pdb，已登记 rcsb 册；本册接入后 dicts 变成
// ["common","spa","rcsb","rcsb-home"]，scope 与 rcsb 册一致（这里不带 blocks，#helpModal 用 footer 包住以进入 scope）
const site = {
  id: "rcsb-pdb",
  name: "RCSB PDB",
  hosts: ["www.rcsb.org", "rcsb.org"],
  dicts: ["common", "spa", "rcsb", "rcsb-home"],
  scope: "header, nav, main, footer, #root, .visually-hidden-focusable, .skip-link",
  spa: true,
  waitFor: "#root",
  valueText: true
};

const all = {
  exact: Object.assign({}, common.exact, spa.exact, rcsb.exact, dict.exact),
  rules: [...(common.rules || []), ...(spa.rules || []), ...(rcsb.rules || []), ...dict.rules],
  templates: [...(common.templates || []), ...(spa.templates || []), ...(rcsb.templates || []), ...dict.templates]
};

const CJK = /[\u4e00-\u9fff]/;

function engineFor(html, url) {
  const dom = new JSDOM(html, { url: url || "https://www.rcsb.org/" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data: all, site });
  engine.start();
  return { doc: dom.window.document, engine };
}

const anyEngine = engineFor("<p>x</p>").engine;
function covers(k) {
  return k in all.exact || anyEngine.translateText(k) !== null;
}
function text(el) {
  return el.textContent.replace(/\s+/g, " ").trim();
}

test("词库结构：family/sites 正确，exact 条数足够、译文含汉字、规则带捕获组、模板槽位连续", () => {
  assert.equal(dict.meta.family, "rcsb");
  for (const host of ["www.rcsb.org", "rcsb.org"]) assert.ok(dict.meta.sites.includes(host), "缺站点: " + host);
  const keys = Object.keys(dict.exact);
  assert.ok(keys.length >= 15, "exact 只有 " + keys.length + " 条");
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.notEqual(v, k, "自映射: " + k);
    assert.match(v, CJK, "译文不含汉字: " + k + " => " + v);
  }
  assert.ok(dict.rules.length >= 3, "规则太少");
  for (const r of dict.rules) {
    assert.doesNotThrow(() => new RegExp(r.re), "坏正则: " + r.re);
    // 方法名一类术语由捕获组二次翻译（$1 再走 exact/rules），这类规则的 to 本身可以没有汉字，
    // 其实际译法由下面的「规则行为」用例逐条断言
    assert.ok(CJK.test(r.to) || /^\$\d( \$\d)*$/.test(r.to), "规则译文不含汉字: " + r.re);
    assert.ok(/\((?!\?)/.test(r.re), "规则没有捕获组: " + r.re);
  }
  const tpl = dict.templates || [];
  assert.ok(tpl.length >= 6, "模板太少: " + tpl.length);
  for (const t of tpl) {
    assert.ok(t.pat.length >= 20, "模板 pat 太短: " + t.pat);
    assert.match(t.zh, CJK, "模板译文不含汉字: " + t.pat);
    const slots = (t.pat.match(/\{\{\d+\}\}/g) || []).length;
    assert.ok(slots >= 1, "模板没有槽位: " + t.pat);
    for (let i = 1; i <= slots; i++) assert.ok(t.pat.includes("{{" + i + "}}"), "槽位不连续: " + t.pat);
    assert.equal((t.zh.match(/\{\{\d+\}\}/g) || []).length, slots, "译文槽位数不一致: " + t.pat);
  }
});

test("条目卫生：key 不含中文、首尾无空白，值里没有明文 URL / 邮箱 / 换行", () => {
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.doesNotMatch(k, CJK, "key 含中文: " + k);
    assert.equal(k, k.trim(), "key 首尾有空白: " + JSON.stringify(k));
    assert.equal(v, v.trim(), "值首尾有空白: " + k);
    assert.doesNotMatch(v, /https?:\/\//i, "值含明文 URL: " + k);
    assert.doesNotMatch(v, /[\w.+-]+@[\w-]+\.[\w.]+/, "值含明文邮箱: " + k);
    assert.doesNotMatch(k, /[\r\n]/, "key 含换行: " + k);
    assert.equal(k, k.replace(/\s+/g, " "), "key 有连续空白: " + JSON.stringify(k));
  }
  for (const t of dict.templates) {
    assert.doesNotMatch(t.zh, /[\w.+-]+@[\w-]+\.[\w.]+/, "模板译文含明文邮箱: " + t.pat);
    assert.doesNotMatch(t.pat, /[\r\n]/, "模板 pat 含换行");
  }
});

test("首页检索帮助卡：七个新工具说明句（逐字原文）", () => {
  const must = [
    "Find structures that share a similar 3D shape using AI/ML-generated vector embeddings",
    "Find structures that contain a similar 3D arrangement of residues with functional significance (catalytic or binding sites)",
    "Use structural properties that have text or numerical values to build complex queries with 'AND/OR' logic",
    "Find structures with sequences that share small conserved regions (motifs) that have biological meaning",
    "Find structures that contain a similar nucleotide or protein sequence using the MMseqs2 method",
    "Find PDB structures using annotations from various ontologies and hierarchical classification schemes, e.g. Disease Ontology, Molecular Function",
    "Graphical summaries of protein features and their relationships with UniProtKB entries",
    "Query Summary",
    "CSM",
    "Search API",
    "LOADING",
    "Nov 18-24: World Antimicrobial Awareness Week",
    "Harmonization of NMR Data Deposition: Adoption of unified NMR data and PDBx/mmCIF",
    "Register for Electron Microscopy on PDB\u2019s 55th Birthday",
    "Quarterly Newsletter: Fall 2026 | Issue 111",
    "Education Corner: Fall 2026 | Issue 111"
  ];
  for (const k of must) assert.ok(covers(k), "缺少条目: " + k);
});

test("不抢 common 的通用数字规则：带计数的串仍走通用规则", () => {
  assert.equal(anyEngine.translateText("20 results"), "共 20 条结果");
  assert.equal(anyEngine.translateText("20 per page"), "每页 20 条");
  assert.equal(anyEngine.translateText("71,848 Structures"), "71,848 结构");
  for (const r of dict.rules) {
    let re;
    try { re = new RegExp(r.re); } catch { continue; }
    assert.ok(!re.test("20 results"), "规则抢了 N results: " + r.re);
    assert.ok(!re.test("20 per page"), "规则抢了 N per page: " + r.re);
  }
});

test("规则正则与新技术字段行为", () => {
  const { engine } = engineFor("<p>x</p>");
  const cases = [
    [": Asymmetric - C1", "：非对称 - C1"],
    [": Homo 3-mer -", "：同源 3 聚体 -"],
    [": Homo 2-mer -", "：同源 2 聚体 -"],
    ["X-RAY DIFFRACTION 1.55 \u00c5", "X 射线衍射 1.55 \u00c5"],
    ["SOLUTION NMR 2.1 \u00c5", "溶液核磁共振 2.1 \u00c5"],
    ["of 71,848 Structures", "，共 71,848 个结构"],
    ["of 2,874 Degradations", null]
  ];
  for (const [src, want] of cases) assert.equal(engine.translateText(src), want, "原文: " + src);
});

test("首页渲染：工具轮播卡、统计卡、新闻标题", () => {
  const { doc } = engineFor(
    '<div><div class="carousel">' +
      '<p class="text-smaller">Find structures that share a similar 3D shape using AI/ML-generated vector embeddings</p>' +
      '<p class="text-smaller">Use structural properties that have text or numerical values to build complex queries with \'AND/OR\' logic</p>' +
      '<p class="text-smaller">Find PDB structures using annotations from various ontologies and hierarchical classification schemes, e.g. Disease Ontology, Molecular Function</p>' +
      "</div>" +
      '<div class="stats"><span>71,848 Structures</span><span>284,301 Computed Structure Models</span></div>' +
      "<h3>Nov 18-24: World Antimicrobial Awareness Week</h3>" +
      "<h3>Quarterly Newsletter: Fall 2026 | Issue 111</h3>" +
      "</div>"
  );
  const ps = [...doc.querySelectorAll("p.text-smaller")].map(text);
  assert.equal(ps[0], "查找共享相似三维形状的结构，基于 AI/ML 生成的向量嵌入");
  assert.equal(ps[1], "使用带文本值或数值的结构属性，以“AND/OR”逻辑构建复杂查询");
  assert.equal(ps[2], "使用来自各种本体与层级分类方案的注释查找 PDB 结构，例如疾病本体、分子功能");
  assert.equal(text(doc.querySelector(".stats span")), "71,848 结构");
  const h3 = [...doc.querySelectorAll("h3")].map(text);
  assert.equal(h3[0], "11 月 18–24 日：世界提高抗微生物药物认识周");
  assert.equal(h3[1], "季度通讯：2026 年秋季 | 第 111 期");
});

test("帮助弹窗与页脚：模板整句翻译且链接保留", () => {
  const { doc } = engineFor(
    "<footer><div id='helpModal'><p>Find " +
      '<span class="fw-bold">entities</span> and <span class="fw-bold">assemblies</span> by combining queries from tools in this suite: ' +
      "Attribute Search, Sequence Similarity, Sequence Motif, 3D Similarity, and 3D Motif with 'AND' logic.</p>" +
      "<ul>" +
      '<li>Use <a href="/contact">this form</a> for questions about <a href="https://www.rcsb.org">RCSB.org</a> and RCSB PDB services. ' +
      "<br> Please attach a <strong>screenshot</strong> when reporting an issue, if possible.</li>" +
      '<li>To update/release <strong>your</strong> in-progress structure depositions: <a href="/onedep-login">Log in</a> access the <a href="/onedep-communication">OneDep Communication panel</a>.</li>' +
      '<li>For questions about structure deposition, biocuration, validation or PDB policies, use the <a href="/chatbot">RCSB PDB chatbot</a>.</li>' +
      '<li>For questions/corrections to specific PDB entries, including citation updates: ' +
      '<a href="mailto:deposit-help@mail.wwpdb.org">Contact us</a> email ' +
      '<a href="mailto:deposit-help@mail.wwpdb.org">deposit-help@mail.wwpdb.org</a>.</li>' +
      "</ul></div></footer>"
  );
  const p = text(doc.querySelector("#helpModal p"));
  assert.ok(p.startsWith("通过组合本套件中各工具的查询条件查找"), "helpModal 首句未翻译: " + p);
  assert.ok(p.includes("并以“AND”逻辑组合"), "helpModal 逻辑短语未翻译: " + p);
  assert.equal(doc.querySelectorAll("#helpModal p span.fw-bold").length, 2, "内联槽位节点不能丢");
  const lis = [...doc.querySelectorAll("#helpModal li")];
  const lis0 = lis[0];
  assert.ok(text(lis0).startsWith("请使用"), "页脚首条未翻译: " + text(lis0));
  assert.ok(text(lis0).includes("报告问题时，如有可能请附上"), "页脚首条后半句未翻译: " + text(lis0));
  assert.ok(text(lis[1]).startsWith("如需更新/发布"), "页脚第二条未翻译: " + text(lis[1]));
  assert.ok(text(lis[1]).includes("请访问"), "页脚第二条后半句未翻译: " + text(lis[1]));
  assert.ok(text(lis[2]).includes("请使用"), "页脚第三条未翻译: " + text(lis[2]));
  assert.ok(text(lis[3]).includes("请发送电子邮件至"), "页脚第四条未翻译: " + text(lis[3]));
  assert.equal(doc.querySelector("a[href='/onedep-communication']") !== null, true, "链接不能丢");
  assert.equal(doc.querySelector("a[href='/chatbot']") !== null, true, "链接不能丢");
  assert.equal(doc.querySelectorAll("a[href^='mailto:deposit-help']").length, 2, "邮箱链接不能丢");
  assert.equal(doc.querySelector("#helpModal br") !== null, true, "<br> 槽位要保留");
});

test("检索结果页渲染：查询摘要、分页、表头", () => {
  const { doc } = engineFor(
    '<main><div class="search-summary"><span>This query matches <strong>71,848 Structures</strong>.</span></div>' +
      '<div class="pager"><span><strong>1</strong> to <strong>25</strong> of 71,848 Structures</span></div>' +
      "<table><thead><tr><th>Released</th><th>Method</th><th>Organisms</th><th>Macromolecule</th><th>Unique Ligands</th></tr></thead></table>" +
      "</main>",
    "https://www.rcsb.org/search"
  );
  const summary = text(doc.querySelector(".search-summary span"));
  assert.equal(summary, "本次查询匹配71,848 结构。");
  const pager = text(doc.querySelector(".pager span"));
  assert.ok(pager.includes("，共 71,848 个结构"), "分页 of 段未翻译: " + pager);
  assert.doesNotMatch(pager, /of 71,848 Structures/, "分页仍有英文: " + pager);
  assert.equal(text(doc.querySelector("th")), "发布日期");
  assert.equal(text(doc.querySelectorAll("th")[1]), "方法");
});
