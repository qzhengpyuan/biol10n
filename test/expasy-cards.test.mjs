// Expasy 首页资源卡一句话简介补齐回归：整句 exact 命中、专名保留英文、译文不半中半英。
// 站点栈按 config/sites.json 里 expasy 登记的 dicts 取（common 在前，expasy 在后）。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/expasy.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "expasy");
if (!site) throw new Error("config/sites.json 里找不到 expasy 站点");

const data = { exact: {}, rules: [], templates: [] };
for (const id of site.dicts) {
  const p = path.join(root, "../dict", id + ".json");
  if (!fs.existsSync(p)) continue;
  const b = JSON.parse(fs.readFileSync(p, "utf8"));
  Object.assign(data.exact, b.exact || {});
  data.rules = data.rules.concat(b.rules || []);
  data.templates = data.templates.concat(b.templates || []);
}

function run(html, url) {
  const dom = new JSDOM(html, { url: url || "https://www.expasy.org/" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return dom.window.document;
}
const text = (el) => el.textContent.replace(/\s+/g, " ").trim();
const CJK = /[\u4e00-\u9fff]/;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// 站上资源卡的真实结构（首页 / 检索结果 / 详情页「你可能还感兴趣」共用一个骨架）：
// <article class="resource">…<a class="resource__link"><h3 class="h5">名字</h3></a>
// <div class="text-sm leading-snug mt-1">一句话简介</div></article>
const card = (name, desc) =>
  '<article class="resource"><div class="flex items-center mb-3"><div class="flex-1"><ul>' +
  '<li><ul aria-label="Resource Categories"><li class="sr-only">Transcriptomics</li></ul></li>' +
  '</ul></div><div class="text-neutral-500"><ul><li><ul aria-label="Resource Types">' +
  '<li class="sr-only">Database</li></ul></li></ul></div></div>' +
  '<a href="/resources/x" class="resource__link"><h3 class="h5">' + esc(name) + "</h3></a>" +
  '<div class="text-sm leading-snug mt-1">' + esc(desc) + "</div></article>";

// 2026-11 首页仍残留的卡片简介里挑出的样本：[资源名, 页面原文, 期望译文]
const TOOL_CARDS = [
  ["OpenStructure", "Molecular modelling and visualisation environment", "分子建模与可视化环境"],
  ["miRmap", "Prediction of microRNA target repression strength", "microRNA 靶标抑制强度预测"],
  ["Translate", "Convert a nucleotide sequence to a protein sequence", "将核苷酸序列转换为蛋白质序列"],
  ["ProtParam", "Computation of physico chemical parameters of a protein", "蛋白质理化参数计算"],
  ["BUSCO", "From QC to gene prediction and phylogenomics", "从质量控制到基因预测与系统发育基因组学"],
  ["MELANIE", "2-D PAGE analysis", "2-D PAGE 分析"],
  ["MatrixDB", "Extracellular proteins and polysaccharides interactions", "胞外蛋白与多糖的相互作用"],
  ["BindCraft", "Design of functional protein binders", "功能性蛋白结合剂设计"]
];

const SPARQL_CARDS = [
  ["OMA SPARQL endpoint", "SPARQL access to the OMA Orthology database", "通过 SPARQL 访问 OMA 直系同源数据库"],
  ["Bgee SPARQL endpoint", "SPARQL access to the Bgee gene expression database", "通过 SPARQL 访问 Bgee 基因表达数据库"],
  ["OrthoDB SPARQL endpoint", "SPARQL access to the OrthoDB catalog of orthologs", "通过 SPARQL 访问 OrthoDB 直系同源物目录"],
  ["HAMAP SPARQL endpoint", "SPARQL access to the HAMAP annotation rules", "通过 SPARQL 访问 HAMAP 注释规则"],
  ["UniProt SPARQL endpoint", "SPARQL access to UniProt and related data", "通过 SPARQL 访问 UniProt 及相关数据"],
  ["Rhea SPARQL endpoint", "SPARQL access to the Rhea knowledgebase", "通过 SPARQL 访问 Rhea 知识库"],
  ["Cellosaurus SPARQL endpoint", "SPARQL access to Cellosaurus", "通过 SPARQL 访问 Cellosaurus"],
  ["MetaNetX SPARQL endpoint", "SPARQL access to MetaNetX", "通过 SPARQL 访问 MetaNetX"],
  ["SwissLipids SPARQL endpoint", "SPARQL access to the SwissLipids knowledgebase", "通过 SPARQL 访问 SwissLipids 知识库"],
  ["SIBiLS SPARQL endpoint", "SPARQL access to SIBiLS, the SIB Literature Services", "通过 SPARQL 访问 SIBiLS（SIB 文献服务）"],
  ["SPHN SPARQL endpoint", "SPARQL access to the SPHN data", "通过 SPARQL 访问 SPHN 数据"],
  ["SPSP SPARQL endpoint", "SPARQL access to the Swiss Pathogen Surveillance Platform", "通过 SPARQL 访问瑞士病原体监测平台"]
];

// 带专名的整句：名字留在英文里，其余必须翻
const PROPER_NOUN_CARDS = [
  ["raxmlGUI", "raxmlGUI 2.0 is a graphical user interface to RAxML", "raxmlGUI 2.0 是 RAxML 的图形界面"],
  ["rawrr", "R package for fast reading Thermo Fisher Scientific MS data", "快速读取 Thermo Fisher Scientific 质谱数据的 R 包"],
  ["V-pipe SARS-CoV-2", "V-pipe pipeline for SARS-CoV-2 sequencing data", "用于 SARS-CoV-2 测序数据的 V-pipe 流水线"],
  ["OMAMO", "OMAMO allows the user to find the best simple model organism", "OMAMO 帮助用户找到最佳简单模式生物"],
  ["OMArk", "OMArk determines the quality and completeness of gene sets", "OMArk 用于评估基因集的质量与完整性"],
  ["ScanProsite", "Protein sequences against PROSITE", "将蛋白质序列比对到 PROSITE"],
  ["HAMAP-Scan", "Scanning of protein sequences against HAMAP families", "将蛋白质序列比对到 HAMAP 家族"],
  ["TASer", "Search tool associated to TASmania", "TASmania 配套检索工具"]
];

test("词库规模：exact 已含卡片简介批次，键值形态干净（无自映射、无首尾空白、键无中文）", () => {
  const keys = Object.keys(book.exact);
  assert.ok(keys.length >= 300, "exact 只有 " + keys.length + " 条，卡片简介批次没进库");
  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(!CJK.test(k), "键里不能有中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "键首尾不能有空白: " + JSON.stringify(k));
    assert.equal(v, v.trim(), "值首尾不能有空白: " + JSON.stringify(k));
    assert.ok(CJK.test(v) || !/[A-Za-z]/.test(v), "译文里必须有中文: " + k);
  }
});

test("首页卡片：8 条工具类简介整句命中，资源名保持英文", () => {
  const doc = run("<div>" + TOOL_CARDS.map((c) => card(c[0], c[1])).join("") + "</div>");
  const arts = [...doc.querySelectorAll("article.resource")];
  assert.equal(arts.length, TOOL_CARDS.length);
  TOOL_CARDS.forEach(([name, en, zh], i) => {
    assert.equal(text(arts[i].querySelector("h3")), name, "资源名不翻: " + en);
    assert.equal(text(arts[i].querySelector("div.text-sm")), zh, "简介要整句命中: " + en);
  });
});

test("SPARQL 系列：12 条「SPARQL access to X」全部命中，端点名与专名保留英文", () => {
  const doc = run("<div>" + SPARQL_CARDS.map((c) => card(c[0], c[1])).join("") + "</div>");
  const descs = [...doc.querySelectorAll("div.text-sm")].map((e) => text(e));
  assert.deepEqual(descs, SPARQL_CARDS.map((c) => c[2]));
  // 端点名是资源名，不能翻；译文里的专名也要还在
  const names = [...doc.querySelectorAll("h3")].map((e) => text(e));
  assert.deepEqual(names, SPARQL_CARDS.map((c) => c[0]));
  assert.ok(/OMA 直系同源数据库/.test(descs[0]));
  assert.ok(/OrthoDB 直系同源物目录/.test(descs[2]));
  assert.ok(!/access to/.test(descs.join(" ")), "不能留 SPARQL access to 的英文尾巴");
});

test("专名句：工具名/机构名原样保留，其余成分翻成中文", () => {
  const doc = run("<div>" + PROPER_NOUN_CARDS.map((c) => card(c[0], c[1])).join("") + "</div>");
  const descs = [...doc.querySelectorAll("div.text-sm")].map((e) => text(e));
  PROPER_NOUN_CARDS.forEach(([name, en, zh], i) => assert.equal(descs[i], zh, en));
  assert.ok(/raxmlGUI 2.0 是 RAxML 的图形界面/.test(descs[0]));
  assert.ok(/Thermo Fisher Scientific/.test(descs[1]), "厂商名不翻");
  assert.ok(/SARS-CoV-2/.test(descs[2]) && /V-pipe/.test(descs[2]), "病毒名与流水线名不翻");
  assert.ok(/^OMAMO /.test(descs[3]) && /^OMArk /.test(descs[4]), "以工具名起句的简介保留名字");
});

// 半中半英的判据：整句类译文（键 ≥3 个词）里不能再留英文普通词。
// 以小写字母开头的专名片段只有这 4 个（Quest for Orthologs 的 for、microRNA、raxmlGUI、scRNA-seq）；
// 大写开头的名字（OMA、PROSITE、Thermo…）不在本判据内，leak 出来的「database / access / the」这类才会被抓。
const LATIN_LOWER_OK = new Set(["for", "microRNA", "raxmlGUI", "scRNA-seq"]);

test("不半中半英：整句译文里不留英文普通词（只有专名/缩写可以带拉丁字母）", () => {
  const bad = [];
  let checked = 0;
  for (const [k, v] of Object.entries(book.exact)) {
    if (k.trim().split(/\s+/).length < 3) continue; // 短标签（RefSeq AC 之类）不在本判据内
    checked++;
    for (const m of v.matchAll(/[A-Za-z][A-Za-z0-9.\-]*/g)) {
      if (!/^[a-z]/.test(m[0])) continue;
      if (!LATIN_LOWER_OK.has(m[0])) bad.push(k + " → " + v + " （" + m[0] + "）");
    }
  }
  assert.ok(checked >= 200, "整句条数太少: " + checked);
  assert.deepEqual(bad, [], "有英文普通词没翻干净\n" + bad.join("\n"));
  // 抽查新增批次里的长句
  assert.equal(
    book.exact["Convert a nucleotide sequence to a protein sequence"],
    "将核苷酸序列转换为蛋白质序列"
  );
  assert.equal(
    book.exact["Weekly automated benchmarking of protein structure modelling"],
    "蛋白质结构建模的每周自动化基准评测"
  );
  assert.equal(
    book.exact["Search a large collection of scientific publications"],
    "检索大量科学文献"
  );
});

test("故意不翻：品牌名、资源名、SPARQL endpoint 名与新闻动态文本保持原样", () => {
  const doc = run(
    "<div>" +
    card("MHC Motif Atlas", "MHC Motif Atlas") +
    card("OMA SPARQL endpoint", "SPARQL access to the OMA Orthology database") +
    "<span>ExpasyGPT</span><span>Glydin'</span><span>FetchGWI / tagger</span><span>SWISS-MODEL Repository</span>" +
    "<p>, a resource for all viral genus and families, has updated the taxonomy for monodnaviria.</p>" +
    "</div>"
  );
  const arts = [...doc.querySelectorAll("article.resource")];
  assert.equal(text(arts[0].querySelector("h3")), "MHC Motif Atlas");
  assert.equal(text(arts[0].querySelector("div.text-sm")), "MHC Motif Atlas", "简介与资源名同形，说明是名字，不翻");
  assert.equal(text(arts[1].querySelector("h3")), "OMA SPARQL endpoint", "SPARQL endpoint 是资源名，不翻");
  assert.equal(text(arts[1].querySelector("div.text-sm")), "通过 SPARQL 访问 OMA 直系同源数据库");
  assert.deepEqual(
    [...doc.querySelectorAll("span")].map((e) => text(e)),
    ["ExpasyGPT", "Glydin'", "FetchGWI / tagger", "SWISS-MODEL Repository"]
  );
  assert.equal(
    text(doc.querySelector("p")),
    ", a resource for all viral genus and families, has updated the taxonomy for monodnaviria.",
    "新闻正文是动态内容，不进词库"
  );
});

test("同句复用：检索结果页与详情页推荐区（class 不同）用同一批简介", () => {
  const doc = run(
    '<div><div class="flex items-center mb-3"><h4 class="h5">miRmap</h4>' +
      '<div class="text-sm text-neutral-700">Prediction of microRNA target repression strength</div></div>' +
      '<article class="resource"><a href="/resources/viralzone"><h3 class="h5">Foldtree</h3></a>' +
      '<div class="text-sm leading-snug mt-1">Phylogenetic tree from predicted protein structures</div></article></div>'
  );
  assert.equal(text(doc.querySelector("h4")), "miRmap");
  assert.equal(text(doc.querySelector("div.text-sm")), "microRNA 靶标抑制强度预测");
  assert.equal(text(doc.querySelector("article h3")), "Foldtree");
  assert.equal(
    text(doc.querySelector("article div.text-sm")),
    "由预测蛋白质结构构建系统发育树"
  );
});

test("首页回放：混排 20 张卡片后残留英文只剩资源名", () => {
  const mix = [...TOOL_CARDS, ...SPARQL_CARDS.slice(0, 6), ...PROPER_NOUN_CARDS.slice(0, 6)];
  const doc = run("<div>" + mix.map((c) => card(c[0], c[1])).join("") + "</div>");
  const arts = [...doc.querySelectorAll("article.resource")];
  assert.equal(arts.length, 20);
  // 简介全部中文
  for (const a of arts) assert.ok(CJK.test(text(a.querySelector("div.text-sm"))));
  // 名字全部没被翻译成中文（都是资源专名）
  const names = arts.map((a) => text(a.querySelector("h3")));
  for (const n of names) assert.ok(!CJK.test(n), "资源名不该被翻: " + n);
  // 卡片里的分类/类型枚举仍然各归各位
  for (const a of arts) {
    const uls = a.querySelectorAll("ul[aria-label]");
    assert.equal(uls[0].getAttribute("aria-label"), "资源分类", "分类 aria-label 也翻");
    assert.equal(uls[1].getAttribute("aria-label"), "资源类型");
    const li = a.querySelectorAll("ul[aria-label] li");
    assert.equal(text(li[0]), "转录组学");
    assert.equal(text(li[1]), "数据库");
  }
});