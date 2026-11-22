// NCBI GEO 文档体系词库（dict/geo-docs.json）冒烟测试：
// /geo/info/ 索引页导航与分区、/geo/info/faq.html 的 29 条 FAQ 问题标题、
// /gds/ 与 /geo/ 检索页导航、文档子页的固定说明句模板与动态串规则。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/geo-docs.json"), "utf8"));
const common = JSON.parse(fs.readFileSync(path.join(root, "../dict/common.json"), "utf8"));
const ncbi = JSON.parse(fs.readFileSync(path.join(root, "../dict/ncbi.json"), "utf8"));
const geoExtra = JSON.parse(fs.readFileSync(path.join(root, "../dict/geo-extra.json"), "utf8"));

// sites.json 已有条目 id "ncbi-geo"，这里按「建议条目」构造站点配置（dicts 顺序与接入后一致）。
// 该站点 scope 里的 11 个选择器在 /geo/info/ 上全部 0 命中，引擎实际退回 body，所以这里直接用 body。
const site = {
  id: "ncbi-geo",
  name: "NCBI GEO",
  hosts: ["www.ncbi.nlm.nih.gov"],
  dicts: ["common", "ncbi", "geo-extra", "geo-docs"],
  scope: "body"
};

// 站点真实加载的是 common + ncbi + geo-extra（本册接入后再加上本册），合并后的词表才是页面真实行为
const all = {
  exact: Object.assign({}, common.exact, ncbi.exact, geoExtra.exact, dict.exact),
  rules: [...(common.rules || []), ...(ncbi.rules || []), ...(geoExtra.rules || []), ...dict.rules],
  templates: [...(common.templates || []), ...(ncbi.templates || []), ...(geoExtra.templates || []), ...(dict.templates || [])]
};

const CJK = /[\u4e00-\u9fff]/;

function engineFor(html, url) {
  const dom = new JSDOM(html, { url: url || "https://www.ncbi.nlm.nih.gov/geo/info/" });
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

test("词库结构：family/sites 正确，exact 条数与译文合规，规则带捕获组，模板槽位自洽", () => {
  assert.equal(dict.meta.family, "geo-docs");
  assert.deepEqual(dict.meta.sites, ["www.ncbi.nlm.nih.gov"]);
  const keys = Object.keys(dict.exact);
  assert.ok(keys.length >= 390, "exact 只有 " + keys.length + " 条");
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.notEqual(v, k, "自映射: " + k);
    if (CJK.test(v)) continue;
    // 少数纯外文标签（格式/品牌名）只做全角标点换算，值必须等于 key 的标点规范化结果
    const normalized = k.replace(/\s*\(/g, "（").replace(/\)/g, "）");
    assert.equal(v, normalized, "译文不含汉字且不是纯标点规范化: " + k + " => " + v);
  }
  assert.ok(dict.rules.length >= 1, "没有规则");
  for (const r of dict.rules) {
    assert.doesNotThrow(() => new RegExp(r.re), "坏正则: " + r.re);
    assert.match(r.to, CJK, "规则译文不含汉字: " + r.re);
    assert.ok(/\((?!\?)/.test(r.re), "规则没有捕获组: " + r.re);
  }
  const tpl = dict.templates || [];
  assert.ok(tpl.length >= 15, "模板太少: " + tpl.length);
  for (const t of tpl) {
    assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, "模板 pat 长度越界: " + t.pat.length);
    assert.match(t.zh, CJK, "模板译文不含汉字: " + t.pat);
    const slots = (t.pat.match(/\{\{\d+\}\}/g) || []).length;
    assert.ok(slots >= 1, "模板没有槽位: " + t.pat);
    for (let i = 1; i <= slots; i++) assert.ok(t.pat.includes("{{" + i + "}}"), "槽位不连续: " + t.pat);
    assert.equal((t.zh.match(/\{\{\d+\}\}/g) || []).length, slots, "译文槽位数不一致: " + t.pat);
    assert.doesNotMatch(t.zh, /[\w.+-]+@[\w-]+\.[\w.]+/, "模板译文含明文邮箱: " + t.pat);
  }
});

test("条目卫生：key 不含中文、首尾无空白、值无明文 URL/邮箱，且不与既有词库重复定义", () => {
  const others = [common, ncbi, geoExtra];
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.doesNotMatch(k, CJK, "key 含中文: " + k);
    assert.equal(k, k.trim(), "key 首尾有空白: " + JSON.stringify(k));
    assert.equal(v, v.trim(), "值首尾有空白: " + k);
    assert.doesNotMatch(k, /[\r\n]/, "key 含换行: " + k);
    assert.doesNotMatch(v, /https?:\/\//i, "值含明文 URL: " + k);
    assert.doesNotMatch(v, /[\w.+-]+@[\w-]+\.[\w.]+/, "值含明文邮箱: " + k);
    for (const o of others) {
      assert.ok(!(k in (o.exact || {})), "与既有词库重复定义同一 key（会造成跨册冲突）: " + k);
    }
  }
});

test("/geo/info/ 索引页：四个分区标题、分区标签与全部导航链接", () => {
  const must = [
    "GEO Documentation",
    "General information",
    "Submission information",
    "Data download, query and analysis",
    "Featured projects",
    "Data types",
    "Array submissions",
    "Submission format options",
    "Frequently Asked Questions",
    "Overview of data organization",
    "MIAME guidelines",
    "Citing and linking to the GEO database",
    "Data disclaimer",
    "Guidelines for reviewers and journal editors",
    "GEO publications",
    "Citation listings: deposit and third-party usage",
    "General data submission guide",
    "RT-PCR submissions",
    "High-throughput sequence submissions",
    "GEOarchive (spreadsheets, e.g., Excel)",
    "SOFT (plain text)",
    "MINiML (XML)",
    "GEO File Transfer Protocol (FTP)",
    "GEO Submission Validation",
    "Platform content guidelines",
    "Updating GEO records or account information",
    "Download options",
    "Programmatic access",
    "NCBI-generated RNA-seq count data",
    "About GEO2R"
  ];
  for (const k of must) assert.ok(covers(k), "缺少条目: " + k);
  assert.equal(anyEngine.translateText("Last modified: July 9, 2026"), "最后修改：2026 年 7 月 9 日");
  assert.equal(anyEngine.translateText("(legacy)"), "（旧版）");
});

test("/geo/info/faq.html：29 条 FAQ 问题标题全部覆盖（答案长正文不收）", () => {
  const titles = [
    "What is GEO?",
    "Why should I submit my data to GEO?",
    "How do I submit my data to GEO?",
    "When do I submit my data to GEO?",
    "When will my data receive GEO accession numbers?",
    "What kinds of data will GEO accept?",
    "Does GEO store raw data?",
    "Can I submit an extracted or summary subset of data?",
    "How do I create a GEO account?",
    "How can I make edits to my contact information?",
    "I run a facility and need to submit data for multiple investigators. What account should I use?",
    "Can I keep my data private while my manuscript is being prepared or under review?",
    "Can I keep my data private after my manuscript is published?",
    "How can I allow reviewers access to my private records?",
    "How can I make corrections to data that I already submitted?",
    "How can I delete my records?",
    "I'm a reviewer, how do I access and evaluate pre-publication data?",
    "Does GEO support MIAME and MINSEQE?",
    "Human Subject Guidelines: Can I submit data derived from human subjects?",
    "Who can use GEO data?",
    "What kinds of retrievals are possible in GEO?",
    "How can I query and analyze GEO data?",
    "Can GEO data be accessed programmatically?",
    "Can I get notified when new data is available?",
    "Can I cite data I find in GEO as evidence to support my own research?",
    "What is the difference between a Series and a DataSet?",
    "Why can't I find gene profile charts or DataSet clusters for my study of interest?",
    "What do the red bars and blue squares represent in GEO profile charts?",
    "What data types are provided with next-generation sequence submissions?"
  ];
  assert.equal(titles.length, 29);
  for (const k of titles) assert.ok(covers(k), "缺少 FAQ 问题: " + k);
  // 同名锚点的另一种措辞（页面里 A 与 H3 写法不同）
  assert.ok(covers("Does GEO support MIAME and MINSEQE standards?"));
  assert.ok(covers("Why can't I find gene profile charts or clusters for my study of interest?"));
  // 答案里的长自由文本不进词库
  assert.equal(anyEngine.translateText("There are several good reasons for submitting your data to us."), null);
});

test("/gds/ 检索页：筛选面板、结果控件、字段标签与浏览活动", () => {
  const must = [
    "GEO DataSets",
    "Functional Genomics Studies",
    "Getting Started",
    "GEO Tools",
    "More Resources",
    "Example Searches",
    "Keywords and species",
    "Study type",
    "Studies with CEL files",
    "Studies with between 100 and 500 samples",
    "Result Filters",
    "Entry type",
    "Organism",
    "Publication dates",
    "Custom date range",
    "Additional filters",
    "Search results",
    "Supplemental Content",
    "Find related data",
    "Search details",
    "Important Links",
    "Recent activity",
    "Show additional filters",
    "Clear all",
    "Items per page",
    "Sort by",
    "Choose Destination",
    "Clipboard",
    "Create alert",
    "Top Organisms",
    "Turn Off",
    "Turn On",
    "Download data: CSV"
  ];
  for (const k of must) assert.ok(covers(k), "缺少条目: " + k);
  assert.deepEqual(["Organism:", "Type:", "Platform:", "Accession:"].map((k) => anyEngine.translateText(k)), [
    "物种：",
    "类型：",
    "平台：",
    "登录号："
  ]);
});

test("/geo/ 首页：文档菜单、Query & Browse 菜单与浏览计数标签", () => {
  const must = [
    "Gene Expression Omnibus",
    "Search GEO DataSets",
    "Search GEO Profiles",
    "Analyze with GEO2R",
    "Studies with Genome Data Viewer Tracks",
    "Programmatic access",
    "Repository Browser",
    "FTP Site",
    "Email GEO",
    "How to construct queries",
    "How to download data",
    "Data Disclaimer",
    "GEO publications",
    "DataSets:",
    "Platforms:",
    "Samples:",
    "Login to Submit",
    "Update Guidelines",
    "MIAME Standards",
    "Guidelines for Reviewers"
  ];
  for (const k of must) assert.ok(covers(k), "缺少条目: " + k);
});

test("规则行为：下载格式列表走本册规则，分页/计数走既有规则（不重复收）", () => {
  assert.equal(dict.rules[0].re, "^Download data: (.+)$");
  assert.equal(anyEngine.translateText("Download data: CSV"), "下载数据：CSV");
  assert.equal(anyEngine.translateText("Download data: TXT, XLSX"), "下载数据：TXT, XLSX");
  assert.equal(anyEngine.translateText("Download data: RESULTS"), "下载数据：RESULTS");
  // 以下动态串由 common / ncbi 处理，本册不重复收（记录在册，避免被本册抢走）
  assert.equal(anyEngine.translateText("Items: 1 to 20 of 10125"), "第 1 至 20 项，共 10125 项");
  assert.equal(anyEngine.translateText("15 Samples"), "15 样本");
  assert.equal(anyEngine.translateText("Page of 507"), null);
});

test("渲染 /geo/info/：标题、分区、链接与 Last modified 都翻好且 href 不丢", () => {
  const { doc } = engineFor(
    '<div id="content"><h1>GEO Documentation</h1>' +
      '<h2>General information</h2><ul class="doc_list">' +
      '<li><a href="/geo/info/faq.html">Frequently Asked Questions</a></li>' +
      '<li><a href="/geo/info/overview.html">Overview of data organization</a></li>' +
      '<li><a href="/geo/info/MIAME.html">MIAME guidelines</a></li>' +
      '<li><a href="/geo/info/linking.html">Citing and linking to the GEO database</a></li>' +
      '<li><a href="/geo/info/reviewer.html">Guidelines for reviewers and journal editors</a></li>' +
      "</ul>" +
      "<h2>Submission information</h2><ul>" +
      "<li><span>Data types</span></li><li><span>Array submissions</span></li>" +
      '<li><a href="/geo/info/submissionftp.html">GEO File Transfer Protocol (FTP)</a></li>' +
      '<li><a href="/geo/info/validate.html">GEO Submission Validation</a></li>' +
      "</ul>" +
      "<h2>Data download, query and analysis</h2>" +
      '<ul><li><a href="/geo/info/download.html">Download options</a></li>' +
      '<li><a href="/geo/info/download.html#programmatic">Programmatic access</a></li></ul>' +
      "<h2>Featured projects</h2><ul class=\"doc_list\">" +
      '<li><a href="/geo/encode/">ENCODE</a></li>' +
      '<li><a href="/geo/roadmap/epigenomics/">RoadMap Epigenomics</a> (legacy)</li>' +
      "</ul>" +
      '<div id="last_mod">Last modified: July 9, 2026</div></div>'
  );
  assert.equal(text(doc.querySelector("h1")), "GEO 文档");
  assert.deepEqual(
    [...doc.querySelectorAll("h2")].map(text),
    ["一般信息", "提交信息", "数据下载、查询与分析", "精选项目"]
  );
  const links = [...doc.querySelectorAll("a")].map(text);
  for (const want of [
    "常见问题",
    "数据组织概览",
    "MIAME 指南",
    "引用与链接 GEO 数据库",
    "审稿人与期刊编辑指南",
    "GEO 文件传输协议（FTP）",
    "GEO 提交校验",
    "下载选项",
    "程序化访问"
  ]) {
    assert.ok(links.includes(want), "缺少链接译文 " + want + " 实际: " + links.join("|"));
  }
  const spans = [...doc.querySelectorAll("span")].map(text);
  assert.deepEqual(spans, ["数据类型", "芯片提交"]);
  assert.equal(doc.querySelector("#last_mod").textContent, "最后修改：2026 年 7 月 9 日");
  assert.equal([...doc.querySelectorAll("li")].pop().textContent.replace(/\s+/g, " ").trim(), "RoadMap Epigenomics （旧版）");
  assert.equal(doc.querySelector("h1 a, #content a").getAttribute("href"), "/geo/info/faq.html", "链接不能丢");
  assert.equal(doc.querySelectorAll("h2").length, 4);
});

test("渲染 FAQ：问题标题翻成中文，答案长段落基本保持英文（不出现半中半英）", () => {
  const answer =
    "There are several good reasons for submitting your data to us. The most likely reason is that the funder of your research " +
    "or the journal in which you are publishing your research requires deposit of microarray or sequence data to a " +
    '<a href="/geo/info/MIAME.html">MIAME- or MINSEQE</a>-compliant public repository like GEO.';
  const { doc } = engineFor(
    "<h2>Submission</h2>" +
      "<h3>What is GEO?</h3>" +
      "<p>The Gene Expression Omnibus (GEO) is a public repository that archives and freely distributes microarray and sequencing data.</p>" +
      "<h3>Why should I submit my data to GEO?</h3>" +
      "<p>" + answer + "</p>" +
      "<h3>Can I keep my data private after my manuscript is published?</h3>" +
      "<h3>What is the difference between a Series and a DataSet?</h3>" +
      '<h2>Query and search</h2><h3>Who can use GEO data?</h3><h3>Can GEO data be accessed programmatically?</h3>',
    "https://www.ncbi.nlm.nih.gov/geo/info/faq.html"
  );
  const h3 = [...doc.querySelectorAll("h3")].map(text);
  assert.deepEqual(h3, [
    "什么是 GEO？",
    "为什么应将数据提交到 GEO？",
    "稿件发表后，我的数据可以继续保持私有吗？",
    "系列（Series）与数据集（DataSet）有什么区别？",
    "谁可以使用 GEO 数据？",
    "GEO 数据可以通过程序访问吗？"
  ]);
  const ps = [...doc.querySelectorAll("p")];
  assert.equal(ps.length, 2);
  const body = text(ps[1]);
  assert.ok(body.startsWith("There are several good reasons for submitting your data to us."), "答案段落不应被翻: " + body);
  assert.match(body, /MIAME- or MINSEQE/, "术语链接文本保持原文");
  assert.equal(ps[1].querySelector("a").getAttribute("href"), "/geo/info/MIAME.html");
  // 长答案里没有汉字（半中半英检视）
  assert.doesNotMatch(text(ps[1]), CJK);
});

test("渲染 /gds/ 检索结果页：筛选面板、下载格式规则与分页计数", () => {
  const { doc } = engineFor(
    '<div id="faceted_search"><div class="facet"><h3>Result Filters</h3>' +
      "<h3>Entry type</h3><h3>Organism</h3><h3>Study type</h3><h3>Author</h3>" +
      "<h3>Attribute name</h3><h3>Publication dates</h3><h3>Custom date range</h3><h3>Additional filters</h3>" +
      '<button>Show additional filters</button><a href="#">Clear all</a></div></div>' +
      '<div id="search-results"><div class="results-amount"><h3>Items: 1 to 20 of 10125</h3></div>' +
      '<div class="sort"><label>Items per page<select><option>10</option><option>20</option></select></label>' +
      "<label>Sort by<select><option>Best match</option></select></label></div>" +
      '<div class="download"><a href="#" class="download-link">Download data: CSV</a>' +
      '<a href="#" class="download-link">Download data: TXT</a></div>' +
      '<dl><dt>Organism:</dt><dd>Homo sapiens</dd><dt>Type:</dt><dd>Expression profiling by array</dd>' +
      "<dt>Platform:</dt><dd>GPL570</dd><dt>Accession:</dt><dd>GSE1000</dd></dl>" +
      '<div class="supp"><h3>Supplemental Content</h3></div><h3>Search details</h3></div>'
  );
  const h3 = [...doc.querySelectorAll("h3")].map(text);
  for (const want of ["结果筛选", "条目类型", "物种", "研究类型", "作者", "属性名", "发表日期", "自定义日期范围", "更多筛选条件", "第 1 至 20 项，共 10125 项", "补充内容", "检索详情"]) {
    assert.ok(h3.includes(want), "缺少标题 " + want + " 实际: " + h3.join("|"));
  }
  const links = [...doc.querySelectorAll("a")].map(text);
  assert.ok(links.includes("全部清除"));
  assert.ok(links.includes("下载数据：CSV"), "下载规则未生效: " + links.join("|"));
  assert.ok(links.includes("下载数据：TXT"));
  assert.equal(text(doc.querySelector("button")), "显示更多筛选条件");
  assert.deepEqual(
    [...doc.querySelectorAll("dt")].map(text),
    ["物种：", "类型：", "平台：", "登录号："]
  );
  const labels = [...doc.querySelectorAll(".sort label")].map(text);
  assert.match(labels[0], /^每页条目数/, "Items per page 未翻: " + labels[0]);
  assert.match(labels[1], /^排序方式/, "Sort by 未翻: " + labels[1]);
});

test("渲染 linking.html：固定说明句模板翻好且槽位里的链接与 href 都保留", () => {
  const { doc } = engineFor(
    '<p>We strongly recommend that submitters cite their <a href="/geo/info/linking.html#series">Series</a> ' +
      'accession number (<a href="/geo/series/">GSE</a>xxx) because that record summarizes the experiment and includes ' +
      "links to all other relevant data.</p>",
    "https://www.ncbi.nlm.nih.gov/geo/info/linking.html"
  );
  const p = doc.querySelector("p");
  assert.equal(
    text(p),
    "我们强烈建议提交者引用其系列登录号（GSExxx），因为该记录概括了整个实验，并包含指向其他所有相关数据的链接。"
  );
  assert.deepEqual([...p.querySelectorAll("a")].map((a) => a.getAttribute("href")), [
    "/geo/info/linking.html#series",
    "/geo/series/"
  ]);
});
