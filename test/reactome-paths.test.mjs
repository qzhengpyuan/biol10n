// Reactome 通路浏览器（PathwayBrowser）缺口回归：左侧 29 条固定顶层分类、标题分段、面板小词，
// 以及「顶层分类要翻 / 通路名当数据不翻」这条边界（正文与检索词里的小写 cell cycle 必须留英文）。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/reactome.json"), "utf8"));
const common = JSON.parse(fs.readFileSync(path.join(root, "../dict/common.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => (s.hosts || []).includes("reactome.org"));
assert.ok(site, "config/sites.json 必须有 reactome.org 条目");

// 左侧层级树的 29 条顶层分类：固定枚举值，按 Reactome 官方中文惯用译法。
const TOP_LEVEL = [
  ["Autophagy", "自噬"],
  ["Cell Cycle", "细胞周期"],
  ["Cell-Cell communication", "细胞间通讯"],
  ["Cellular responses to stimuli", "细胞对外界刺激的反应"],
  ["Chromatin organization", "染色质组织"],
  ["Circadian clock", "昼夜节律钟"],
  ["Developmental Biology", "发育生物学"],
  ["Digestion and absorption", "消化与吸收"],
  ["Disease", "疾病"],
  ["DNA Repair", "DNA 修复"],
  ["DNA Replication", "DNA 复制"],
  ["Drug ADME", "药物 ADME"],
  ["Extracellular matrix organization", "细胞外基质组织"],
  ["Gene expression (Transcription)", "基因表达（转录）"],
  ["Hemostasis", "止血"],
  ["Immune System", "免疫系统"],
  ["Metabolism", "代谢"],
  ["Metabolism of proteins", "蛋白质代谢"],
  ["Metabolism of RNA", "RNA 代谢"],
  ["Muscle contraction", "肌肉收缩"],
  ["Neuronal System", "神经系统"],
  ["Organelle biogenesis and maintenance", "细胞器生成与维持"],
  ["Programmed Cell Death", "程序性细胞死亡"],
  ["Protein localization", "蛋白质定位"],
  ["Reproduction", "生殖"],
  ["Sensory Perception", "感觉知觉"],
  ["Signal Transduction", "信号转导"],
  ["Transport of small molecules", "小分子转运"],
  ["Vesicle-mediated transport", "囊泡介导的转运"]
];

const dictData = (withBook) => {
  const data = { exact: Object.assign({}, common.exact), rules: (common.rules || []).slice(), templates: (common.templates || []).slice() };
  if (withBook) {
    Object.assign(data.exact, book.exact);
    data.rules = data.rules.concat(book.rules || []);
    data.templates = data.templates.concat(book.templates || []);
  }
  return data;
};
const data = dictData(true);

function run(html, opts = {}) {
  const dom = new JSDOM(html);
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: opts.data || data,
    site
  });
  engine.start();
  return dom.window.document;
}
const text = (el) => (el.textContent || "").replace(/\s+/g, " ").trim();
const CJK = /[\u3400-\u4fff\u4e00-\u9fff]/;
const CJK_ALL = /[\u3400-\u4fff\u4e00-\u9fff]/g;

// 真实 DOM 形态：左侧层级树的顶层节点 = div.gwt-TreeItem > div > div > span.gwt-InlineLabel
const treeHtml = (names) =>
  names
    .map(
      (n) =>
        '<div class="gwt-TreeItem"><div class="GCR0SYYDBTB"><div class="GCR0SYYDFTB GCR0SYYDETB">' +
        '<span class="gwt-InlineLabel" title="' + n + '">' + n + "</span></div></div></div>"
    )
    .join("");

const leaves = (doc) => {
  const out = [];
  const walk = (el) => {
    for (const c of el.children) walk(c);
    if (/^(SCRIPT|STYLE|NOSCRIPT|TITLE|OPTION)$/.test(el.tagName)) return;
    if (el.children.length) return;
    const t = text(el);
    if (t) out.push({ tag: el.tagName, t });
  };
  walk(doc.body);
  return out;
};

test("词库结构：29 条顶层分类以锚定规则收录，译法固定", () => {
  const ruleOf = (en) => (book.rules || []).find((r) => r.re === "^" + en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$");
  for (const [en, zh] of TOP_LEVEL) {
    assert.ok(!/[\u4e00-\u9fff]/.test(en), "英文名里不能有汉字: " + en);
    assert.ok(CJK.test(zh), "译文里必须有汉字: " + en);
    assert.notEqual(en, zh, "自映射: " + en);
    assert.equal(zh, zh.trim(), "译文首尾不能有空白: " + en);
    if (en === "Disease") {
      // Disease 是全站通用词，由 common 册提供，本册不重复登记
      assert.equal(common.exact[en], zh, "Disease 应由 common 册提供: " + zh);
      continue;
    }
    const r = ruleOf(en);
    assert.ok(r, "缺顶层分类条目: " + en);
    assert.equal(r.to, zh, "译法不对: " + en);
    assert.ok(!/\$\d/.test(r.to), "顶层分类是整词替换，不该带占位符: " + en);
  }
  // 设计约束：这些名字同时是「通路名/检索词」形态的数据，不能进 exact 表，
  // 否则 translateCapture 会把 “Search results for cell cycle” 里的检索词也翻掉。
  for (const [en] of TOP_LEVEL) {
    if (en === "Disease") continue; // Disease 由 common 册提供
    assert.ok(!Object.prototype.hasOwnProperty.call(book.exact, en), "顶层分类不要进 exact 表: " + en);
  }
  for (const r of book.rules) {
    const re = new RegExp(r.re);
    assert.ok(re.source.length > 0);
    assert.ok(/[\u4e00-\u9fff（）]/.test(r.to), "规则译文里必须有中文或全角标点: " + r.re);
    // 只有真正的捕获组才要求占位符（\(Transcription\) 是转义括号，不算）
    if (/(^|[^\\])\(/.test(r.re)) assert.ok(/\$\d/.test(r.to), "带捕获组的规则要用到占位符: " + r.re);
  }
  for (const t of book.templates) {
    const used = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    used.forEach((n, i) => assert.equal(n, i + 1, "槽位必须从 1 连续: " + t.pat));
    const zhUsed = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.deepEqual(zhUsed.slice().sort((a, b) => a - b), used.slice().sort((a, b) => a - b), "译文槽位要与原文一致");
  }
});

test("左侧层级树：29 个顶层节点全部变中文（加词前 29 个英文叶子 → 加词后 0）", () => {
  const html = '<div class="GCR0SYYDBTB">' + treeHtml(TOP_LEVEL.map((x) => x[0])) + "</div>";
  const before = run(html, { data: dictData(false) });
  const beforeLeaves = leaves(before).filter((l) => l.t);
  const beforeEn = beforeLeaves.filter((l) => /[A-Za-z]/.test(l.t) && !CJK.test(l.t));
  const beforeCjk = (text(before.body).match(CJK_ALL) || []).length;
  // Disease 由 common 册提供，加词前就已经是中文，所以这里是 28 条
  assert.equal(beforeEn.length, TOP_LEVEL.length - 1, "加词前 28 条顶层分类整块是英文");
  assert.equal(beforeCjk, 2, "加词前只有 common 给的「疾病」两个汉字");

  const after = run(html);
  const items = [...after.querySelectorAll(".gwt-TreeItem .gwt-InlineLabel")].map(text);
  assert.deepEqual(items, TOP_LEVEL.map((x) => x[1]));
  const afterEn = leaves(after).filter((l) => /[a-z]/.test(l.t));
  assert.equal(afterEn.length, 0, "加词后不能剩小写英文: " + JSON.stringify(afterEn));
  // DNA / RNA / ADME 是固定缩写，保留大写形态
  for (const label of items) {
    assert.ok(CJK.test(label), "必须是中文: " + label);
    assert.ok(!/[a-z]/.test(label), "不能带小写英文: " + label);
  }
  assert.ok((text(after.body).match(CJK_ALL) || []).length >= 80, "加词后汉字数应显著上升");
});

test("标题分段：PB | 通路名、Reactome | 通路名", () => {
  const title = (html) => run(html).title;
  assert.equal(title("<html><head><title>PB | Cell Cycle</title></head><body></body></html>"), "通路浏览器 | 细胞周期");
  assert.equal(title("<html><head><title>PB | Hemostasis</title></head><body></body></html>"), "通路浏览器 | 止血");
  // 词表里没有的通路名（数据）保持英文，只翻 PB 前缀
  assert.equal(title("<html><head><title>PB | Mitophagy</title></head><body></body></html>"), "通路浏览器 | Mitophagy");
  assert.equal(
    title("<html><head><title>Reactome | Cell Cycle</title></head><body></body></html>"),
    "Reactome 通路数据库 | 细胞周期"
  );
  assert.equal(
    title("<html><head><title>Reactome | Mitophagy</title></head><body></body></html>"),
    "Reactome 通路数据库 | Mitophagy"
  );
  // 标题以外的普通文本不受标题规则影响（规则锚定在整串）
  assert.equal(text(run("<p>PB and Reactome</p>").querySelector("p")), "PB and Reactome");
});

test("同级小词：Showing / pValue / General / Beta Browser:", () => {
  const doc = run(
    "<div>" +
      '<span class="gwt-InlineLabel">Showing</span>' +
      '<select class="gwt-ListBox"><option value="false">pValue</option><option value="true">coverage</option></select>' +
      "</div>" +
      '<div><span class="gwt-InlineLabel">Beta Browser:</span></div>' +
      '<fieldset class="fieldset-details"><legend>General</legend><a title="Export diagram to SBML">SBML</a></fieldset>'
  );
  assert.equal(text(doc.querySelector("span")), "显示");
  assert.deepEqual([...doc.querySelectorAll("option")].map(text), ["p 值", "覆盖度"]);
  assert.equal(text(doc.querySelectorAll("span")[1]), "Beta 版浏览器：");
  assert.ok(!/Beta 浏览器/.test(text(doc.querySelector("div + div"))), "不能留「Beta 浏览器」这种半截译法");
  assert.equal(text(doc.querySelector("legend")), "常规");
  assert.equal(doc.querySelector("fieldset a").getAttribute("title"), "将图导出为 SBML");
});

test("数据不动：物种拉丁名、通路名+物种、GO 号、accession、作者、交互资源名", () => {
  const doc = run(
    '<div class="species"><select><option>Homo sapiens</option><option>Mus musculus</option></select></div>' +
    "<table><tr><td>Cell Cycle (Homo sapiens)</td><td>cell cycle (0007049)</td>" +
    "<td>R-HSA-1640170</td><td>help@reactome.org</td><td>Matthews, L (2011-10-10)</td><td>5/5</td></tr></table>" +
    '<div class="psicquic"><label>IntAct</label><label>BioGrid</label><label>Reactome-FIs</label></div>'
  );
  assert.deepEqual([...doc.querySelectorAll("option")].map(text), ["Homo sapiens", "Mus musculus"]);
  assert.deepEqual([...doc.querySelectorAll("td")].map(text), [
    "Cell Cycle (Homo sapiens)",
    "cell cycle (0007049)",
    "R-HSA-1640170",
    "help@reactome.org",
    "Matthews, L (2011-10-10)",
    "5/5"
  ]);
  assert.deepEqual([...doc.querySelectorAll("label")].map(text), ["IntAct", "BioGrid", "Reactome-FIs"]);
});

test("不产生新的半中半英：英文正文里的 cell cycle 保持英文，检索词不被翻", () => {
  const prose =
    "The replication of the genome and the subsequent segregation of chromosomes into daughter cells are controlled by a series of events collectively known as the cell cycle. DNA replication is carried out during a discrete temporal period known as the S (synthesis)-phase, and chromosome segregation occurs during a massive reorganization to cellular architecture at mitosis.";
  const doc = run(
    '<td><div class="elv-Details-OverviewDisclosure-summation">' +
      "The replication of the genome and the subsequent segregation of chromosomes into daughter cells are controlled by a series of events collectively known as the <b>cell cycle</b>. DNA replication is carried out during a discrete temporal period known as the S (synthesis)-phase, and chromosome segregation occurs during a massive reorganization to cellular architecture at mitosis." +
      "</div></td>" +
      '<h2>Search results for <span class="searchterm">cell cycle</span></h2>' +
      "<p>" + prose + "</p>"
  );
  // 详情面板正文：整段英文，里面那个 <b> 不能被单独翻成「细胞周期」
  const bold = doc.querySelector(".elv-Details-OverviewDisclosure-summation b");
  assert.equal(text(bold), "cell cycle", "英文正文里的通路名不能翻成中文");
  const sum = text(doc.querySelector(".elv-Details-OverviewDisclosure-summation"));
  assert.ok(!CJK.test(sum), "详情面板正文不能出现汉字: " + sum.slice(0, 80));
  // 检索词是数据：只翻「Search results for」外壳
  assert.equal(text(doc.querySelector("h2")), "“cell cycle”的检索结果");
  assert.equal(text(doc.querySelector(".searchterm")), "cell cycle");
  assert.equal(text(doc.querySelector("p")), prose, "长正文整段留英文");
});
