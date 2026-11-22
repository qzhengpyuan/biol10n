// NCBI Gene / PubMed 属性通道词库回归：邻基因 alt（Neighboring gene X）、PubMed ID 标题列表、
// PubMed 图表对话框与 PDF 查看器按钮的 title/aria-label/alt，以及字号/登录号/品牌等不译保护。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const engineSrc = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(engineSrc + "; return createEngine;")();
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;

const geneBook = readJson("../dict/gene.json");
const ncbiBook = readJson("../dict/ncbi.json");
const sites = readJson("../config/sites.json").sites;

// 以 config/sites.json 的 ncbi-gene / pubmed 为准；父级尚未接线时退回本轮普查用的同款栈。
const FALLBACK = {
  "ncbi-gene": {
    id: "ncbi-gene",
    hosts: ["www.ncbi.nlm.nih.gov"],
    dicts: ["common", "ncbi", "gene", "gene2", "ncbi-footer"],
    scope: "body"
  },
  pubmed: {
    id: "pubmed",
    hosts: ["pubmed.ncbi.nlm.nih.gov"],
    dicts: ["common", "ncbi", "ncbi-help", "pubmed2", "fill-r19"],
    scope: "main, .site-content, .usa-skipnav, .no-session-banner, .no-script-banner, aside.page-sidebar, #article-page-header, #article-top-actions-bar, .ncbi-alerts"
  }
};

function stackFor(id) {
  const cfg = sites.find((s) => s.id === id) || FALLBACK[id];
  const dicts = Array.isArray(cfg.dicts) && cfg.dicts.length ? cfg.dicts : FALLBACK[id].dicts;
  const data = { exact: {}, rules: [], templates: [] };
  for (const dictId of dicts) {
    const book = readJson("../dict/" + dictId + ".json");
    Object.assign(data.exact, book.exact || {});
    data.rules = data.rules.concat(book.rules || []);
    data.templates = data.templates.concat(book.templates || []);
  }
  // rescan:false 只关掉延迟补扫的定时器，属性通道与线上一致。
  return { site: Object.assign({}, cfg, { rescan: false }), data, dictIds: dicts };
}

function boot(siteId, html) {
  const { site, data } = stackFor(siteId);
  const host = (site.hosts && site.hosts[0]) || "www.ncbi.nlm.nih.gov";
  const dom = new JSDOM("<body><main>" + html + "</main></body>", { url: "https://" + host + "/" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return dom.window.document;
}

const attr = (doc, selector, name) => {
  const el = doc.querySelector(selector);
  assert.ok(el, "找不到元素: " + selector);
  return el.getAttribute(name);
};

test("词库结构：本轮新增的 4 条规则锚定、可编译、捕获组有占位符", () => {
  const added = [
    ...geneBook.rules.filter((r) => r.re === "^Neighboring gene (.+)$" || r.re === "^PubMed ID ([\\d,\\s]+)$"),
    ...ncbiBook.rules.filter((r) => r.re === "^Figure (\\d+[A-Za-z]?)\\.$" || r.re === "^([\\d,]+) entries from ([\\d,]+) species$")
  ];
  assert.deepEqual(
    added.map((r) => r.re).sort(),
    ["^([\\d,]+) entries from ([\\d,]+) species$", "^Figure (\\d+[A-Za-z]?)\\.$", "^Neighboring gene (.+)$", "^PubMed ID ([\\d,\\s]+)$"],
    "新增规则缺失或写法变了"
  );
  const bad = [];
  for (const r of added) {
    if (typeof r.to !== "string") { bad.push("规则缺 to: " + r.re); continue; }
    if (!r.re.startsWith("^") || !r.re.endsWith("$")) bad.push("未锚定: " + r.re);
    try { new RegExp(r.re); } catch (e) { bad.push("无法编译: " + r.re); }
    if (!CJK.test(r.to)) bad.push("译文无汉字: " + r.re);
    if (/\([^)]*\)/.test(r.re) && !/\$\d/.test(r.to)) bad.push("捕获组未用占位符: " + r.re);
  }
  // 整册既有规则仍须可编译（不重排、不改旧规则，只校验可编译性）
  for (const book of [geneBook, ncbiBook]) for (const r of book.rules) new RegExp(r.re);
  assert.deepEqual(bad, []);
});

test("词库结构：NCBI Gene 两条属性规则就位", () => {
  const neighbor = geneBook.rules.find((r) => r.re === "^Neighboring gene (.+)$");
  assert.ok(neighbor, "缺 Neighboring gene 规则");
  assert.match(neighbor.to, /^邻近基因 \$1$/);
  const pmidList = geneBook.rules.find((r) => /^\^PubMed ID /.test(r.re) && !/\\d\+\$$/.test(r.re));
  assert.ok(pmidList, "缺 PubMed ID 编号列表规则（单个编号那条已有）");
  assert.match(pmidList.to, /PubMed 编号 \$1/);
  for (const rule of [neighbor, pmidList]) assert.equal(rule.requireHit, undefined, "这两条是固定前缀，不该要求捕获段命中词表");
});

test("词库结构：PubMed 属性条目齐全且值为中文", () => {
  const keys = [
    "Free full text at PubMed Central",
    "Explore related research with NLM Linked Discoveries",
    "PubMed links associated with Books",
    "Link to related CDD entry",
    "Link to related Genes",
    "Link to Gene for the GeneRIF subcategory",
    "Link to Protein RefSeqs",
    "Protein family models supported by a particular publication",
    "navigate to Conflict of interest statement section",
    "navigate to Figures section",
    "navigate to References section",
    "Figures Dialog",
    "show full caption",
    "hide full caption",
    "Close (Esc)",
    "Toggle fullscreen",
    "Zoom in/out",
    "Previous (arrow left)",
    "Next (arrow right)",
    "Atypon full text link",
    "(marsupials)"
  ];
  const bad = [];
  for (const key of keys) {
    const val = ncbiBook.exact[key];
    if (typeof val !== "string") { bad.push("缺条目: " + key); continue; }
    if (!CJK.test(val)) bad.push("译文无汉字: " + key + " => " + val);
    if (key === val) bad.push("自映射: " + key);
    if (key !== key.trim() || val !== val.trim()) bad.push("首尾空白: " + key);
  }
  assert.deepEqual(bad, []);
  assert.match(ncbiBook.exact["(marsupials)"], /^（有袋类）$/);
  assert.match(ncbiBook.exact["Link to Protein RefSeqs"], /^链接到蛋白质 RefSeq$/, "与 gene2 册既有译法保持一致");
});

test("NCBI Gene：alt 的 Neighboring gene 前缀落地，基因名/调控元件名原样保留", () => {
  const doc = boot(
    "ncbi-gene",
    '<img alt="Neighboring gene sex hormone binding globulin">' +
      '<img alt="Neighboring gene ATPase Na+/K+ transporting subunit beta 2">' +
      '<img alt="Neighboring gene H3K4me1 hESC enhancer GRCh37_chr17:7552896-7553396">' +
      '<img alt="Neighboring gene WD repeat containing antisense to TP53">'
  );
  const alts = [...doc.querySelectorAll("img")].map((el) => el.getAttribute("alt"));
  assert.deepEqual(alts, [
    "邻近基因 sex hormone binding globulin",
    "邻近基因 ATPase Na+/K+ transporting subunit beta 2",
    "邻近基因 H3K4me1 hESC enhancer GRCh37_chr17:7552896-7553396",
    "邻近基因 WD repeat containing antisense to TP53"
  ]);
  for (const value of alts) assert.ok(!/Neighboring/.test(value), "英文前缀残留: " + value);
});

test("NCBI Gene：title 的 PubMed ID 编号列表落地，PMID 数字一个不改", () => {
  const cases = [
    "PubMed ID 2144364",
    "PubMed ID 2144364,15629713",
    "PubMed ID 12609999,17145718,17146433,22578566",
    "PubMed ID 7720704,14744935,14963330,15340061,16131611,16322561,16507995,17403783,18756595,19011621,19234109,20096447,20810912,21597459,22914926,24101517,24289924,24625977,26634371"
  ];
  const doc = boot("ncbi-gene", cases.map((v) => '<a title="' + v + '">link</a>').join(""));
  const got = [...doc.querySelectorAll("a")].map((el) => el.getAttribute("title"));
  cases.forEach((value, i) => {
    const digits = value.replace(/^PubMed ID /, "");
    assert.equal(got[i], "PubMed 编号 " + digits, "PMID 列表被改动: " + value);
    assert.match(got[i], /^PubMed 编号 [\d,]+$/);
  });
});

test("NCBI Gene：登录号、品牌、基因符号不译", () => {
  const doc = boot(
    "ncbi-gene",
    '<a aria-label="NC_000017.11">x</a><a aria-label="GitHub">x</a><a aria-label="Youtube">x</a>' +
      "<div><span>TP53</span><span>NM_000546.6</span><span>7668421..7687490</span></div>"
  );
  assert.equal(attr(doc, "a:nth-of-type(1)", "aria-label"), "NC_000017.11");
  assert.equal(attr(doc, "a:nth-of-type(2)", "aria-label"), "GitHub");
  assert.equal(attr(doc, "a:nth-of-type(3)", "aria-label"), "Youtube");
  const spans = [...doc.querySelectorAll("span")].map((el) => el.textContent);
  assert.deepEqual(spans, ["TP53", "NM_000546.6", "7668421..7687490"]);
});

test("NCBI Gene 检索页：物种分组与条目计数", () => {
  const doc = boot(
    "ncbi-gene",
    '<a title="(marsupials)">x</a><a title="(primates)">x</a><span title="9565 entries from 1482 species">x</span>'
  );
  const titles = [...doc.querySelectorAll("[title]")].map((el) => el.getAttribute("title"));
  assert.deepEqual(titles, ["（有袋类）", "（灵长类）", "共 9565 条记录，来自 1482 个物种"]);
});

test("PubMed：title 里的界面文案落地，期刊题录与机构地址不动", () => {
  const doc = boot(
    "pubmed",
    '<a title="Free full text at PubMed Central">x</a>' +
      '<a title="Explore related research with NLM Linked Discoveries">x</a>' +
      '<a title="PubMed links associated with Books">x</a>' +
      '<a title="Link to related CDD entry">x</a>' +
      '<a title="Link to related Genes">x</a>' +
      '<a title="Link to Gene for the GeneRIF subcategory">x</a>' +
      '<a title="Link to Protein RefSeqs">x</a>' +
      '<a title="Protein family models supported by a particular publication">x</a>' +
      '<a title="Emerging microbes & infections">x</a>' +
      '<a title="Department of Microbiology, Queen Mary Hospital, Pokfulam, Hong Kong Special Administrative Region, People\'s Republic of China.">x</a>'
  );
  const titles = [...doc.querySelectorAll("[title]")].map((el) => el.getAttribute("title"));
  assert.deepEqual(titles, [
    "PubMed Central 免费全文",
    "借助 NLM Linked Discoveries 探索相关研究",
    "与 Books 关联的 PubMed 链接",
    "链接到相关 CDD 条目",
    "链接到相关基因",
    "链接到 GeneRIF 子类别的基因",
    "链接到蛋白质 RefSeq",
    "特定出版物支持的蛋白家族模型",
    "Emerging microbes & infections",
    "Department of Microbiology, Queen Mary Hospital, Pokfulam, Hong Kong Special Administrative Region, People's Republic of China."
  ]);
});

test("PubMed：图表对话框与 PDF 查看器的 aria-label/title 落地", () => {
  const doc = boot(
    "pubmed",
    '<a aria-label="navigate to Conflict of interest statement section">x</a>' +
      '<a aria-label="navigate to Figures section">x</a>' +
      '<a aria-label="navigate to References section">x</a>' +
      '<div aria-label="Figures Dialog" role="dialog">x</div>' +
      '<button aria-label="show full caption">x</button>' +
      '<button title="Close (Esc)">x</button>' +
      '<button title="Toggle fullscreen">x</button>' +
      '<button title="Zoom in/out">x</button>' +
      '<button title="Previous (arrow left)">x</button>' +
      '<button title="Next (arrow right)">x</button>'
  );
  assert.equal(attr(doc, "a:nth-of-type(1)", "aria-label"), "跳转到「利益冲突声明」部分");
  assert.equal(attr(doc, "a:nth-of-type(2)", "aria-label"), "跳转到「图片」部分");
  assert.equal(attr(doc, "a:nth-of-type(3)", "aria-label"), "跳转到「参考文献」部分");
  assert.equal(attr(doc, "div[role=dialog]", "aria-label"), "图片对话框");
  assert.equal(attr(doc, "button:nth-of-type(1)", "aria-label"), "显示完整图注");
  const buttons = [...doc.querySelectorAll("button")].map((el) => el.getAttribute("title"));
  assert.deepEqual(buttons.slice(1), ["关闭（Esc）", "切换全屏", "放大/缩小", "上一个（左箭头）", "下一个（右箭头）"]);
});

test("PubMed：图片 alt 与 Figure N. 规则", () => {
  const doc = boot(
    "pubmed",
    '<img alt="Atypon full text link">' +
      '<img alt="Figure 1.">' +
      '<img alt="Figure 12.">' +
      '<img alt="Figure 1A.">' +
      '<input placeholder="MM"><input placeholder="DD">'
  );
  const alts = [...doc.querySelectorAll("img")].map((el) => el.getAttribute("alt"));
  assert.deepEqual(alts, ["Atypon 全文链接", "图 1.", "图 12.", "图 1A."]);
  const holders = [...doc.querySelectorAll("input")].map((el) => el.getAttribute("placeholder"));
  assert.deepEqual(holders, ["MM", "DD"], "MM/DD 是日期格式占位符，不译");
});

test("PubMed：品牌 aria-label 与已中文属性不被二次改写", () => {
  const doc = boot(
    "pubmed",
    '<a aria-label="GitHub">x</a><a aria-label="Youtube">x</a>' +
      '<a aria-label="跳转到「摘要」部分">x</a>' +
      '<button title="关闭（Esc）">x</button>'
  );
  assert.equal(attr(doc, "a:nth-of-type(1)", "aria-label"), "GitHub");
  assert.equal(attr(doc, "a:nth-of-type(2)", "aria-label"), "Youtube");
  assert.equal(attr(doc, "a:nth-of-type(3)", "aria-label"), "跳转到「摘要」部分");
  assert.equal(attr(doc, "button", "title"), "关闭（Esc）");
});
