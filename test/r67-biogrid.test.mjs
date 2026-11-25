// r67：BioGRID 帮助 wiki（wiki.thebiogrid.org）与主站（thebiogrid.org）词库
// 覆盖：wiki 导航/面包屑/目录/帮助首页链接列表/COVID 资源块/文档页占位文案；
// 主站导航、首页简介、检索框与三个提交按钮、热门数据集卡片、最新动态（标题+正文+日期）、页脚。
// 口径：物种拉丁名、基因/蛋白名、BioGRID ORCS/GIX、交互类型枚举（physical/genetic）不翻；
// 版本号、登录号、邮件地址、文件名、时间戳原样保留。
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
const site = sites.find((s) => s.id === "biogrid");
const biogrid = JSON.parse(fs.readFileSync(path.join(root, "../dict/biogrid.json"), "utf8"));
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;

// 按站点声明的 dicts 顺序合并（与 dist 里的运行时一致）
const data = { exact: {}, rules: [], templates: [] };
for (const id of site.dicts) {
  const b = JSON.parse(fs.readFileSync(path.join(root, "../dict", id + ".json"), "utf8"));
  Object.assign(data.exact, b.exact || {});
  data.rules = data.rules.concat(b.rules || []);
  data.templates = data.templates.concat(b.templates || []);
}

function makeEngine(html, url) {
  const dom = new JSDOM(html, { url: url || "https://thebiogrid.org/" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return { dom, doc: dom.window.document, engine };
}

const plain = makeEngine("<!doctype html><body><p>placeholder</p></body>");
function tr(s) {
  return plain.engine.translateText(s);
}

// ---- 词库形状 ----

test("biogrid 册挂在本站两个域名上，且站点声明只加载 common/biogrid", () => {
  assert.equal(site.scope, "body");
  assert.deepEqual(site.dicts, ["common", "biogrid"]);
  for (const h of ["wiki.thebiogrid.org", "thebiogrid.org", "www.thebiogrid.org"]) {
    assert.ok(site.hosts.includes(h), "hosts 缺 " + h);
  }
  assert.equal(biogrid.meta.family, "biogrid");
  assert.ok(biogrid.meta.sites.includes("wiki.thebiogrid.org"));
});

test("exact 规模与形态：译文全中文、键无汉字、无自映射、无首尾空白", () => {
  const keys = Object.keys(biogrid.exact);
  assert.ok(keys.length >= 100, "exact 只有 " + keys.length + " 条");
  for (const k of keys) {
    const v = biogrid.exact[k];
    assert.equal(k, k.trim(), "键有首尾空白: " + JSON.stringify(k));
    assert.equal(v, v.trim(), "译文有首尾空白: " + k);
    assert.equal(CJK.test(k), false, "键里混了汉字: " + k);
    assert.notEqual(v, k, "自映射: " + k);
    assert.ok(CJK.test(v), "译文没有中文: " + k + " => " + v);
  }
});

test("单词级 exact 只出现在导航/按钮/链接标签，键里没有长句标点", () => {
  for (const k of Object.keys(biogrid.exact)) {
    const words = k.split(/\s+/).filter(Boolean);
    if (words.length > 1) continue;
    assert.ok(/^[a-z]+$/.test(k) || /^\[more\]$/.test(k) || /^[A-Z][a-z]+$/.test(k), "可疑单词条: " + k);
  }
});

test("rules 形态：^…$ 锚定、to 含中文、捕获组编号不越界", () => {
  assert.ok(biogrid.rules.length >= 5, "rules 太少: " + biogrid.rules.length);
  for (const r of biogrid.rules) {
    assert.equal(typeof r.re, "string");
    assert.equal(typeof r.to, "string");
    assert.ok(r.re.startsWith("^"), "规则没锚定开头: " + r.re);
    assert.ok(r.re.endsWith("$"), "规则没锚定结尾: " + r.re);
    assert.ok(CJK.test(r.to), "规则译文没有中文: " + r.re + " => " + r.to);
    const groups = new RegExp(r.re + "|").exec("").length - 1;
    for (const m of r.to.matchAll(/\$(\d)/g)) {
      assert.ok(Number(m[1]) <= groups, "规则引用了不存在的捕获组 $" + m[1] + ": " + r.re);
    }
    assert.ok(new RegExp(r.re));
  }
});

test("templates 形态：pat 无汉字、zh 有汉字、占位符 1..N 一一对应", () => {
  assert.equal(biogrid.templates.length, 7);
  for (const t of biogrid.templates) {
    assert.equal(typeof t.pat, "string");
    assert.equal(typeof t.zh, "string");
    assert.equal(CJK.test(t.pat), false, "pat 里有汉字: " + t.pat.slice(0, 60));
    assert.ok(CJK.test(t.zh), "zh 里没有汉字: " + t.pat.slice(0, 60));
    assert.ok(t.pat.length >= 20, "pat 太短（引擎要求 ≥20 字符）");
    const slots = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    const used = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.deepEqual(used.slice().sort((a, b) => a - b), slots, "占位符对不上: " + t.pat.slice(0, 60));
    assert.equal(new Set(used).size, used.length, "占位符重复: " + t.pat.slice(0, 60));
  }
});

// ---- wiki 侧 ----

const WIKI = '<!doctype html><html><body>'
  + '<div class="breadcrumbs"><span class="bchead">You are here: </span><span class="home"><a href="/doku.php/start">Help and Support Resources</a></span></div>'
  + '<div id="dw__toc"><h3 class="toggle">Table of Contents</h3></div>'
  + '<h1>Help and Support Resources</h1>'
  + '<div class="level1"><p>While we try to provide as much documentation as possible about our site, we may overlook certain topics of interest. If you can\'t find the answer to your question listed in our support pages below, please email us at: <strong><a href="mailto:support@thebiogrid.org" class="mail">support@thebiogrid.org</a></strong> and we will answer your question directly. Our site is constantly changing so please check back often for possible changes.</p></div>'
  + '<div id="plugin_include__covid"><p>COVID-19 is a rapidly evolving global health crisis and the research community is expediting release of new publication datasets on SARS-CoV-2 to facilitate new therapeutic approaches. At the BioGRID, we\'re focusing our curation efforts on the literature for these data, and making any datasets we curate openly available on our <strong><a href="https://thebiogrid.org/project/3">COVID-19 Coronavirus Project Page</a></strong>, <strong><a href="https://downloads.thebiogrid.org/">downloads</a></strong>, and <strong><a href="https://wiki.thebiogrid.org/doku.php/biogridrest">REST webservice</a></strong> for easy access by the global research community.</p>'
  + '<ul><li class="level1"><div class="li"> If you\'re looking for Coronavirus health information, please visit your local government resources or see what the health experts at <strong><a href="https://www.canada.ca/">Health Canada</a></strong> and the <strong><a href="https://www.coronavirus.gov/">CDC (coronavirus.gov)</a></strong> are recommending. Stay safe and help flatten the curve!</div></li></ul></div>'
  + '<ul><li><a href="/doku.php/downloads">BioGRID Download Format Details</a></li><li><a href="/doku.php/advanced_search">Advanced Search Options</a></li><li><a href="/doku.php/tools">tools</a></li></ul>'
  + '<div id="footer">Copyright &copy; 2026 <a href="http://www.tyerslab.com">TyersLab.com</a>, All Rights Reserved.</div>'
  + '</body></html>';

const wiki = makeEngine(WIKI, "https://wiki.thebiogrid.org/");

test("wiki 面包屑/目录/一级标题翻干净", () => {
  assert.equal(wiki.doc.querySelector(".bchead").textContent.replace(/\s+/g, " ").trim(), "您所在位置：");
  assert.equal(wiki.doc.querySelector(".toggle").textContent.trim(), "目录");
  assert.equal(wiki.doc.querySelector("h1").textContent.trim(), "帮助与支持资源");
});

test("帮助首页的说明整段翻完，邮箱链接原样保留（可点）", () => {
  const p = wiki.doc.querySelector(".level1 p");
  assert.equal(
    p.textContent.replace(/\s+/g, " ").trim(),
    "尽管我们尽量为本站提供尽可能完整的文档，但仍可能遗漏某些关注话题。如果在下面的支持页面中找不到你问题的答案，请发邮件至 support@thebiogrid.org，我们会直接答复你的问题。本站内容不断更新，请经常回来查看可能的变更。"
  );
  const a = p.querySelector("a");
  assert.equal(a.getAttribute("href"), "mailto:support@thebiogrid.org");
  assert.equal(a.textContent, "support@thebiogrid.org");
});

test("COVID 资源块整段翻完，三个行内链接都按中文语序回到原位", () => {
  const p = wiki.doc.querySelector("#plugin_include__covid > p");
  assert.equal(
    p.textContent.replace(/\s+/g, " ").trim(),
    "COVID-19 是一场快速演变的全球卫生危机，研究界正加快发布 SARS-CoV-2 的新文献数据集，以推动新的治疗途径。在 BioGRID，我们正把整理工作集中在这类数据的文献上，并将整理出的数据集公开在COVID-19 冠状病毒项目页面、下载和REST Web 服务上，方便全球研究界取用。"
  );
  const links = Array.from(p.querySelectorAll("a")).map((a) => a.getAttribute("href"));
  assert.deepEqual(links, [
    "https://thebiogrid.org/project/3",
    "https://downloads.thebiogrid.org/",
    "https://wiki.thebiogrid.org/doku.php/biogridrest",
  ]);
});

test("COVID 公告条（两个机构链接）整句翻完，机构名与域名保留", () => {
  const li = wiki.doc.querySelector("#plugin_include__covid li .li");
  assert.equal(
    li.textContent.replace(/\s+/g, " ").trim(),
    "如果你在寻找冠状病毒健康信息，请访问当地政府资源，或参考加拿大卫生部和CDC (coronavirus.gov)的健康专家给出的建议。注意安全，帮助压平疫情曲线！"
  );
});

test("文档页占位文案：「尚不存在」与「创建此页面」都翻", () => {
  const html = '<!doctype html><body><div class="page"><h1 class="sectionedit1">This topic does not exist yet</h1>'
    + '<p>You\'ve followed a link to a topic that doesn\'t exist yet. If permissions allow, you may create it by clicking on <strong>Create this page</strong>.</p></div></body>';
  const docPage = makeEngine(html, "https://wiki.thebiogrid.org/doku.php/biogrid_documentation");
  assert.equal(docPage.doc.querySelector("h1").textContent.trim(), "该主题尚不存在");
  assert.equal(
    docPage.doc.querySelector("p").textContent.replace(/\s+/g, " ").trim(),
    "你访问的链接指向一个尚不存在的主题。如果权限允许，你可以点击创建此页面创建该页面。"
  );
});

test("wiki 导航词与页脚（条款/隐私/产品名）翻干净", () => {
  const as = Array.from(wiki.doc.querySelectorAll("body > ul a"));
  assert.equal(as[0].textContent.trim(), "BioGRID 下载格式说明");
  assert.equal(as[1].textContent.trim(), "高级检索选项");
  assert.equal(as[2].textContent.trim(), "工具");
  assert.equal(wiki.doc.querySelector("#footer").textContent.replace(/\s+/g, " ").trim(), "版权所有 © 2026 TyersLab.com，保留所有权利。");
});

// ---- 主站侧 ----

const HOME = '<!doctype html><html><body>'
  + '<h1>Welcome to our Database of Protein, Genetic and Chemical Interactions</h1>'
  + '<p id="intro"> BioGRID is a biomedical interaction repository with data compiled through comprehensive curation efforts. Our current index is version <span class="homeStat">5.0.263</span> and searches <span class="homeStat">88,939</span> publications for <span class="homeStat">3,050,286</span> protein and genetic interactions, <span class="homeStat">31,540</span> chemical interactions and <span class="homeStat">1,128,339</span> post translational modifications from major model organism species. All data are <strong>freely</strong> provided via our search index and available for download in many standardized formats. </p>'
  + '<h3> Search BioGRID:</h3>'
  + '<select name="searchType"><option>By Protein/Gene</option><option>By Publication</option><option>By Chemical</option></select>'
  + '<select name="organism"><option>All Organisms</option><optgroup label="Coronavirus-Related Organisms"><option>Homo sapiens</option></optgroup></select>'
  + '<input id="gene" placeholder="Search by Protein/Gene Identifiers ..." />'
  + '<textarea id="pub" placeholder="Search publications by pubmed id or by keyword terms..."></textarea>'
  + '<textarea id="chem" placeholder="Search for chemicals by keywords, names, brands, molecular formula, smiles, inchi, inchikey, and third party database ids (chembl, pubchem, chemspider)"></textarea>'
  + '<a title="Submit BioGRID Search">Submit Identifier Search</a>'
  + '<a title="Submit BioGRID Publication Search">Submit Publication Search</a>'
  + '<a title="Submit BioGRID Chemical Search">Submit Chemical Search</a>'
  + '<div class="featureTitle">Advanced Search</div><div class="featureTitle">Helpful Search Tips</div><div class="featureTitle">Featured Datasets</div>'
  + '<div class="interestBox"><p>The BioGRID Open Respository of CRISPR Screens (ORCS) is a publicly accessible <a href="https://orcs.thebiogrid.org">database of CRISPR screens</a> compiled through comprehensive curation of all genome-wide CRISPR screen data reported in the biomedical literature. ORCS is updated on a quarterly basis and is fully searchable by gene/protein, phenotype, cell line, authors, and other attributes. Each screen recorded in ORCS is accompanied by structured metadata annotation that captures salient CRISPR experimental details. All data in ORCS can be downloaded in standard formats.</p>'
  + '<div><a href="https://orcs.thebiogrid.org">Learn more <i class="fa"></i></a></div></div>'
  + '<div class="newsPost"><div class="newsPostTitle"><a href="https://thebiogrid.org/news/346" title="BioGRID Version 5.0.262 Released"> BioGRID Version 5.0.262 Released </a></div>'
  + '<div class="newsPostBody"><p>The <strong><a title="Search the BioGRID" href="https://thebiogrid.org">BioGRID</a></strong>\'s curated set of data have been updated to include interactions, chemical associations, and post-translational modifications (PTM) from <strong>88,684</strong> publications. These additions bring our total number of non-redundant interactions to <strong>2,364,201</strong>, raw interactions to <strong>3,035,956</strong>, non-redundant chemical associations to <strong>14,024</strong>, raw chemical associations to <strong>31,540</strong>, Non-Redundant PTM Sites to <strong>563,757</strong> and Un-Assigned PTMs to <strong>57,396</strong>. <br /><br /> New curated data are added in curation updates on a monthly basis. For a more comprehensive breakdown of our numbers, check out our latest <strong><a href="http://wiki.thebiogrid.org/doku.php/statistics">statistics</a></strong>. To download these data, visit our <strong><a href="https://downloads.thebiogrid.org/BioGRID">download page</a></strong> or utilize our <strong><a href="https://wiki.thebiogrid.org/doku.php/biogridrest">web service</a></strong>.</p></div>'
  + '<div class="newsPostDetails">Posted: October 1, 2026 - 12:06 am</div></div>'
  + '</body></html>';

const home = makeEngine(HOME);
const htext = (sel) => Array.from(home.doc.querySelectorAll(sel)).map((e) => e.textContent.replace(/\s+/g, " ").trim());

test("主站首页标题与简介整段翻完，版本号与统计数字原样保留", () => {
  assert.equal(home.doc.querySelector("h1").textContent.trim(), "欢迎使用我们的蛋白质、遗传与化学相互作用数据库");
  assert.equal(
    home.doc.querySelector("#intro").textContent.replace(/\s+/g, " ").trim(),
    "BioGRID 是一个生物医学相互作用数据库，其数据通过全面的整理工作汇编而成。我们当前的索引版本为 5.0.263，可检索 88,939 篇出版物中的 3,050,286 项蛋白质相互作用与遗传相互作用、31,540 项化学相互作用，以及来自主要模式生物物种的 1,128,339 项翻译后修饰。所有数据均通过我们的检索索引免费提供，并提供多种标准化格式供下载。"
  );
});

test("检索入口：标题、三种检索类型、物种下拉与三个提交按钮都翻", () => {
  assert.equal(htext("h3")[0], "检索 BioGRID：");
  assert.deepEqual(htext("select[name=searchType] option"), ["按蛋白质/基因", "按文献", "按化学物"]);
  assert.deepEqual(htext("select[name=organism] option"), ["全部物种", "Homo sapiens"]);
  assert.deepEqual(
    Array.from(home.doc.querySelectorAll("a")).slice(0, 3).map((a) => a.getAttribute("title")),
    ["提交 BioGRID 检索", "提交 BioGRID 文献检索", "提交 BioGRID 化学物检索"]
  );
});

test("三个检索框的 placeholder 翻成中文，物种选项与 optgroup 保持原样", () => {
  assert.equal(home.doc.querySelector("#gene").placeholder, "按蛋白质/基因标识符检索……");
  assert.equal(home.doc.querySelector("#pub").placeholder, "按 PubMed ID 或关键词检索文献……");
  assert.match(home.doc.querySelector("#chem").placeholder, /^按关键词、名称、品牌、分子式、SMILES、InChI、InChIKey/);
  assert.ok(CJK.test(home.doc.querySelector("#chem").placeholder));
});

test("快捷入口三个 featureTitle 翻干净", () => {
  assert.deepEqual(htext(".featureTitle"), ["高级检索", "实用检索技巧", "精选数据集"]);
});

test("ORCS 卡片整段翻完，行内链接保留原位", () => {
  const p = home.doc.querySelector(".interestBox p");
  assert.equal(
    p.textContent.replace(/\s+/g, " ").trim(),
    "BioGRID 开放的 CRISPR 筛选库（ORCS）是一个可公开访问的CRISPR 筛选数据库，其数据通过全面整理生物医学文献中报道的所有全基因组 CRISPR 筛选数据汇编而成。ORCS 每季度更新，可按基因/蛋白质、表型、细胞系、作者等属性完整检索。ORCS 中记录的每项筛选都附带结构化元数据注释，用来记录关键的 CRISPR 实验细节。ORCS 中的所有数据都可以按标准格式下载。"
  );
  assert.equal(p.querySelector("a").getAttribute("href"), "https://orcs.thebiogrid.org");
});

test("最新动态：版本标题按规则翻，正文整段翻完且数字/链接/<br> 全在", () => {
  assert.equal(htext(".newsPostTitle")[0], "BioGRID 版本 5.0.262 发布");
  assert.equal(
    htext(".newsPostBody p")[0],
    "BioGRID 整理的数据集已更新，新增了来自 88,684 篇出版物的相互作用、化学关联与翻译后修饰（PTM）数据。这些新增使我们的非冗余相互作用总数达到 2,364,201，原始相互作用达到 3,035,956，非冗余化学关联达到 14,024，原始化学关联达到 31,540，非冗余 PTM 位点达到 563,757，未分配 PTM 达到 57,396。新增整理数据按月更新。要更全面地了解我们的数据明细，请查看最新的统计。要下载这些数据，请访问我们的下载页面或使用Web 服务。"
  );
  const body = home.doc.querySelector(".newsPostBody p");
  assert.equal(body.querySelectorAll("br").length, 2);
  assert.deepEqual(Array.from(body.querySelectorAll("a")).map((a) => a.textContent), ["BioGRID", "统计", "下载页面", "Web 服务"]);
  assert.equal(body.querySelector("a").getAttribute("href"), "https://thebiogrid.org");
});

test("发布时间的 am/pm 规则把 12 小时制转成中文时间，日期走通用月名表", () => {
  assert.equal(tr("Posted: October 1, 2026 - 12:06 am"), "发布于 2026 年 10 月 1 日 上午 12:06");
  assert.equal(tr("Posted: June 1, 2026 - 2:05 pm"), "发布于 2026 年 6 月 1 日 下午 2:05");
  assert.equal(htext(".newsPostDetails")[0], "发布于 2026 年 10 月 1 日 上午 12:06");
});

// ---- 通用规则与不翻清单 ----

test("版本标题规则对文本与 alt 属性都生效", () => {
  assert.equal(tr("BioGRID Version 5.0.263 Released"), "BioGRID 版本 5.0.263 发布");
  const m = makeEngine('<!doctype html><body><img alt="BioGRID Version 5.0.253 Released" /></body>');
  assert.equal(m.doc.querySelector("img").alt, "BioGRID 版本 5.0.253 发布");
});

test("导航单词 projects 走规则通道（避免与 gdc 的「个项目」跨册冲突），不写进 exact", () => {
  assert.equal(biogrid.exact.projects, undefined);
  assert.equal(tr("projects"), "项目");
  assert.equal(tr("Search:"), "检索");
});

test("页脚版权按年份规则翻，不写死 2026", () => {
  assert.equal(tr("Copyright © 2027"), "版权所有 © 2027");
  assert.equal(tr(", All Rights Reserved."), "，保留所有权利。");
});

test("必留原文清单：物种拉丁名、交互类型枚举、ORCS/GIX 产品名、登录号", () => {
  const keep = [
    "Homo sapiens",
    "Mus musculus",
    "Saccharomyces cerevisiae (S288c)",
    "Severe acute respiratory syndrome coronavirus 2",
    "physical",
    "genetic",
    "BioGRID ORCS",
    "GIX",
    "GSE331160",
  ];
  for (const s of keep) assert.equal(tr(s), null, "不该翻却命中了: " + s);
});

test("整页残留：除白名单（品牌/域名/物种/文件名）外不再有纯英文短节点", () => {
  const body = WIKI.replace(/^[\s\S]*?<body>/, "").replace(/<\/body>[\s\S]*$/, "")
    + HOME.replace(/^[\s\S]*?<body>/, "").replace(/<\/body>[\s\S]*$/, "");
  const { doc } = makeEngine("<!doctype html><body>" + body, "https://wiki.thebiogrid.org/");
  const SKIP = new Set(["SCRIPT", "STYLE", "PRE", "CODE", "SVG", "NOSCRIPT", "TEXTAREA"]);
  const allow = new Set([
    "Bio", "GRID", "BioGRID", "TyersLab.com", "SGD", "GitHub", "YouTube", "Bluesky",
    "support@thebiogrid.org", "start.txt", "jenn", "by", "· Last modified:",
    "CDC (coronavirus.gov)", "Homo sapiens",
  ]);
  const w = doc.createTreeWalker(doc.body, 4, null, false);
  const bad = [];
  let n;
  while ((n = w.nextNode())) {
    const t = (n.nodeValue || "").trim();
    if (!t || t.length > 80) continue;
    if (!/[A-Za-z]/.test(t) || CJK.test(t)) continue;
    if (allow.has(t)) continue;
    let el = n.parentElement, skip = false;
    while (el) { if (SKIP.has(el.tagName)) { skip = true; break; } el = el.parentElement; }
    if (skip) continue;
    bad.push(t);
  }
  assert.deepEqual([...new Set(bad)], [], "残留: " + [...new Set(bad)].join(" | "));
});