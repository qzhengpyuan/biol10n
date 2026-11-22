// Expasy（dict/expasy.json）回归：首页检索栏与筛选、分类/类型枚举、帮助页与关于页固定说明句、
// 资源详情页字段、检索结果与新闻页的分页/日期句式。站点栈按 config/sites.json 里登记的 dicts 取。
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
const site =
  sites.find((s) => s.id === "expasy") || {
    id: "expasy",
    name: "Expasy",
    hosts: ["www.expasy.org", "expasy.org"],
    dicts: ["common", "expasy"],
    scope: "body",
    attrs: ["placeholder", "title", "aria-label", "alt", "value"]
  };

const CJK = /[\u4e00-\u9fff]/;
const U = "https://www.expasy.org/";

// 站点词库栈：按 boot.js 的规则把 site.dicts 依次合并（后册覆盖前册）
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
  const dom = new JSDOM(html, { url: url || U });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return dom.window.document;
}
const text = (el) => el.textContent.replace(/\s+/g, " ").trim();

test("词库结构：family/sites、条数、键值形态、规则可编译、模板槽位连续", () => {
  assert.equal(book.meta.family, "expasy");
  assert.ok(book.meta.sites.includes("www.expasy.org"));
  const keys = Object.keys(book.exact);
  assert.ok(keys.length >= 100, "exact 只有 " + keys.length + " 条");
  assert.ok(book.rules.length >= 8, "rules 太少: " + book.rules.length);
  assert.ok(book.templates.length >= 40, "templates 太少: " + book.templates.length);
  assert.ok(book.meta.area.length > 0 && book.meta.note.length > 0, "meta 说明要有内容");

  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(!CJK.test(k), "键里不能有中文: " + k);
    // 纯符号译文（分页里 "of" → "/"）没有汉字，但也不能留英文单词
    assert.ok(CJK.test(v) || !/[A-Za-z]/.test(v), "译文里必须有中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "键首尾不能有空白: " + JSON.stringify(k));
    assert.equal(v, v.trim(), "值首尾不能有空白: " + JSON.stringify(k));
    assert.ok(!/https?:\/\/|@[\w.-]+\.\w+/.test(v), "译文里不能有 URL/邮箱: " + k);
  }
  for (const r of book.rules) {
    assert.doesNotThrow(() => new RegExp(r.re), "坏正则: " + r.re);
    assert.ok(CJK.test(r.to), "规则译文里必须有中文: " + r.re);
    assert.ok(/\$\d/.test(r.to), "带捕获组的规则要用到占位符: " + r.re);
  }
  for (const t of book.templates) {
    const used = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.ok(used.length >= 1, "模板要带槽位: " + t.pat);
    const sorted = used.slice().sort((a, b) => a - b);
    sorted.forEach((n, i) => assert.equal(n, i + 1, "槽位必须从 1 连续: " + t.pat));
    const zhUsed = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.deepEqual(zhUsed.slice().sort((a, b) => a - b), sorted, "译文槽位要与原文一致: " + t.pat);
    assert.ok(t.pat.length >= 20, "模板原文太短（引擎不接受 <20 字符）: " + t.pat);
  }
});

test("首页检索栏：门户名、检索说明、aria-label 与示例词保持原样", () => {
  const doc = run(
    '<form class="search">' +
      '<div class="text-center font-bold text-black">Expasy, the Swiss Bioinformatics Resource Portal</div>' +
      "<label>Explore high-quality biological data resources</label>" +
      '<input placeholder="e.g. BLAST, UniProt, MSH6, Albumin...">' +
      '<button aria-label="Search"></button>' +
      "</form>"
  );
  assert.equal(text(doc.querySelector("div")), "Expasy，瑞士生物信息学资源门户");
  assert.equal(text(doc.querySelector("label")), "探索高质量生物数据资源");
  assert.equal(
    doc.querySelector("input").getAttribute("placeholder"),
    "e.g. BLAST, UniProt, MSH6, Albumin...",
    "示例词是数据，保持原样"
  );
  assert.equal(doc.querySelector("button").getAttribute("aria-label"), "检索");
});

test("首页侧栏：筛选面板标题、分类栏与类型栏的 aria-label、分类/类型枚举", () => {
  const doc = run(
    "<div>" +
      "<h2>Filters</h2>" +
      '<ul aria-label="Resource Categories">' +
      "<li><div>Genes &amp; Genomes</div></li><li><div>Proteins &amp; Proteomes</div></li>" +
      "<li><div>Evolution &amp; Phylogeny</div></li><li><div>AI and machine learning</div></li>" +
      "<li><div>Metabolomics</div></li>" +
      "</ul>" +
      "<h2>SIB Resources</h2><h2>All Resources</h2>" +
      '<ul aria-label="Resource Types"><li>Database</li><li>Software tool</li></ul>' +
      "</div>"
  );
  assert.deepEqual(
    [...doc.querySelectorAll("h2")].map((e) => text(e)),
    ["筛选条件", "SIB 资源", "全部资源"]
  );
  const uls = [...doc.querySelectorAll("ul")];
  assert.equal(uls[0].getAttribute("aria-label"), "资源分类");
  assert.equal(uls[1].getAttribute("aria-label"), "资源类型");
  assert.deepEqual(
    [...uls[0].querySelectorAll("div")].map((e) => text(e)),
    ["基因与基因组", "蛋白质与蛋白质组", "进化与系统发育", "人工智能与机器学习", "代谢组学"]
  );
  assert.deepEqual([...uls[1].children].map((e) => text(e)), ["数据库", "软件工具"]);
});

test("帮助页表格：表头与字段名（含 Y/N 值不动）", () => {
  const doc = run(
    "<table>" +
      "<tr><td>Information</td><td>Mandatory (Y/N)</td><td>Card view (Y/N)</td><td>Detailed view (Y/N)</td></tr>" +
      "<tr><td>Resource name</td><td>Y</td><td>Y</td><td>Y</td></tr>" +
      "<tr><td>Short description</td><td>Y</td><td>Y</td><td>Y</td></tr>" +
      "<tr><td>Media URL</td><td>Y</td><td>N</td><td>Y</td></tr>" +
      "<tr><td>Documentation URL</td><td>Y</td><td>N</td><td>Y</td></tr>" +
      "<tr><td>SIB Group</td><td>N</td><td>N</td><td>Y</td></tr>" +
      "<tr><td>ELIXIR or GCBR badge</td><td>N</td><td>Y</td><td>Y</td></tr>" +
      "</table>"
  );
  assert.deepEqual(
    [...doc.querySelectorAll("tr")].map((tr) => [...tr.children].map((td) => text(td))),
    [
      ["信息", "是否必填（Y/N）", "卡片视图（Y/N）", "详情视图（Y/N）"],
      ["资源名称", "Y", "Y", "Y"],
      ["简短描述", "Y", "Y", "Y"],
      ["媒体网址", "Y", "N", "Y"],
      ["文档网址", "Y", "N", "Y"],
      ["SIB 研究组", "N", "N", "Y"],
      ["ELIXIR 或 GCBR 徽标", "N", "Y", "Y"]
    ]
  );
});

test("帮助页模板句：SIB 资源组合整段（三处内联、链接地址不变）", () => {
  const doc = run(
    "<div><p>Resources which are in the " +
      '<a href="https://www.sib.swiss/services/open-software-and-databases#resources-portfolio">SIB portfolio</a>' +
      " are displayed in the section labelled " +
      '<span>"SIB Resources"</span> of the Expasy home page. These resources also include the mention ' +
      '<span>"supported by the SIB Swiss Institute of Bioinformatics"</span>' +
      " in their detailed view to indicate that they benefit from SIB support.</p></div>"
  );
  const p = doc.querySelector("p");
  assert.equal(
    text(p),
    "属于SIB 资源组合的资源会显示在 Expasy 首页标有「SIB 资源」的区块中。" +
      "这些资源的详情视图还会注明「由 SIB 瑞士生物信息学研究所支持」，表示其获得了 SIB 的支持。"
  );
  const a = p.querySelector("a");
  assert.equal(a.getAttribute("href"), "https://www.sib.swiss/services/open-software-and-databases#resources-portfolio");
  assert.equal(text(a), "SIB 资源组合", "占位符原样放回，链接文字也要跟着翻");
});

test("帮助页模板句：EDAM 段（四个槽位含两处 et al）与按主题筛选示例", () => {
  const doc = run(
    '<div><p>Resources are assigned one or more <span>keywords</span> from the <span>EDAM ontology</span>. ' +
      "EDAM (Ison <i>et al,</i> 2013 ; Black <i>et al,</i> 2022) is a domain ontology of data analysis and data management " +
      "in bio- and other sciences, and science-based applications. Targeting usability by diverse users, the structure of EDAM " +
      "is relatively simple, divided into 4 main sections: Topic, Operation, Data (incl. Identifier), and Format.</p>" +
      "<p>Select the category <span>AI &amp; Machine learning</span> to view all the resources matching that topic. " +
      "All the resources found are not SIB resources.</p></div>"
  );
  const [edam, select] = [...doc.querySelectorAll("p")];
  assert.equal(
    text(edam),
    "资源会从EDAM 本体中分配一个或多个关键词。EDAM（Ison 等 2013；Black 等 2022）是一个描述生物科学及其他科学中的" +
      "数据分析与数据管理、以及基于科学的应用的领域本体。为便于不同用户使用，EDAM 的结构相对简单，分为 4 个主部分：" +
      "主题（Topic）、操作（Operation）、数据（Data，含标识符）与格式（Format）。"
  );
  assert.equal(
    text(select),
    "选择分类人工智能与机器学习可查看与该主题匹配的全部资源。找到的资源并非都是 SIB 资源。"
  );
});

test("检索结果页：命中数、跨库检索按钮、结果小标题与分类标题的规则", () => {
  const doc = run(
    "<div>" +
      "<span>1 hit</span><span>0 hit</span><span>4645 hits</span>" +
      '<button>Search results: within a set of 18 databases</button>' +
      '<div class="search-title">Search results: database and tool description</div>' +
      "<span>1 resource found for</span><h3>System Biology</h3>" +
      "</div>"
  );
  const spans = [...doc.querySelectorAll("span")].map((e) => text(e));
  assert.deepEqual(spans.slice(0, 3), ["1 个命中", "0 个命中", "4645 个命中"]);
  assert.equal(doc.querySelector("button").textContent, "检索结果：共 18 个数据库");
  assert.equal(text(doc.querySelector("div.search-title")), "检索结果：数据库与工具描述");
  assert.equal(spans[3], "找到 1 个资源，匹配");
  assert.equal(doc.querySelector("h3").textContent, "系统生物学", "站上把 Systems Biology 写成 System Biology");
});

test("分页：Showing/页码/上下页与 Go to page 的 aria-label", () => {
  const doc = run(
    "<div>" +
      '<p class="text-sm text-neutral-500 leading-5">Showing <span class="font-medium">1</span> to ' +
      '<span class="font-medium">10</span> of <span class="font-medium">179</span> results</p>' +
      '<nav role="navigation" aria-label="Pagination Navigation">' +
      '<span aria-disabled="true" aria-label="&amp;laquo; Previous"><span aria-hidden="true">« Previous</span></span>' +
      '<span class="text-sm">Page 1/18</span>' +
      '<a aria-label="Go to page 2">2</a><a aria-label="Go to page 18">18</a>' +
      "<a>Next »</a></nav></div>"
  );
  assert.equal(text(doc.querySelector("p")), "显示第 1 至 10 / 179 结果");
  const nav = doc.querySelector("nav");
  assert.equal(nav.getAttribute("aria-label"), "分页导航");
  const spans = [...nav.querySelectorAll("span")];
  assert.equal(text(spans[0]), "« 上一页", "禁用态外面那层 span 也带着同样的文字");
  assert.equal(spans[0].getAttribute("aria-label"), "上一页", "字面实体 &laquo; Previous 也收进了词库");
  assert.equal(text(spans[1]), "« 上一页", "内层 aria-hidden span 同样命中 exact");
  assert.equal(text(spans[2]), "第 1/18 页");
  const links = [...nav.querySelectorAll("a")];
  assert.equal(links[0].getAttribute("aria-label"), "转到第 2 页");
  assert.equal(links[1].getAttribute("aria-label"), "转到第 18 页");
  assert.equal(text(links[2]), "下一页 »");
});

test("日期句式：Posted / 带破折号的 Posted / Last updated", () => {
  const doc = run(
    "<div>Posted 19 November 2026</div>" +
      "<div>Posted 04 November 2026 -</div>" +
      "<p>Last updated: June 18, 2026</p>"
  );
  const divs = [...doc.querySelectorAll("div")].map((e) => text(e));
  assert.equal(divs[0], "发布于 2026 年 11 月 19 日");
  assert.equal(divs[1], "发布于 2026 年 11 月 4 日，", "月份走 common 的 11 月，前导零去掉");
  assert.equal(text(doc.querySelector("p")), "最后更新：2026 年 6 月 18 日");
});

test("资源详情页：四个入口按钮、开发/支持方模板、徽标与两个分区标题", () => {
  const doc = run(
    "<div>" +
      '<a href="https://bgee.org/">Browse the resource website</a>' +
      "<span>Watch the video</span><span>Read the documentation</span><span>Try the tutorial</span>" +
      '<p>Developed by the <a href="https://www.sib.swiss/group">Evolutionary Bioinformatics group</a> and supported by the ' +
      '<a href="https://www.sib.swiss/database-software-tools/sib-resources">SIB Swiss Institute of Bioinformatics</a>' +
      '<a href="https://www.sib.swiss/research-infrastructure/database-software-tools/sib-resources">.</a></p>' +
      "<p>Bgee is an <a>ELIXIR Switzerland Service</a>, an <a>ELIXIR Core Data Resource</a> and a " +
      "<a>Global Core Biodata Resource</a>.</p>" +
      "<h2>What you can do with this resource</h2><h2>Browse these keywords in Expasy</h2>" +
      "<h2>You might also be interested in</h2>" +
      "<footer>This resource is released under a Creative Commons Universal license <a>CC0</a></footer>" +
      "</div>"
  );
  const as = [...doc.querySelectorAll("a")];
  assert.equal(text(as[0]), "浏览资源网站");
  assert.deepEqual(
    [...doc.querySelectorAll("span")].map((e) => text(e)),
    ["观看视频", "阅读文档", "试用教程"]
  );
  const [dev, badge] = [...doc.querySelectorAll("p")];
  assert.equal(text(dev), "由进化生物信息学研究组开发，并得到SIB Swiss Institute of Bioinformatics的支持.");
  assert.equal(text(badge), "Bgee 是ELIXIR 瑞士服务、ELIXIR 核心数据资源与全球核心生物数据资源。");
  assert.deepEqual(
    [...doc.querySelectorAll("h2")].map((e) => text(e)),
    ["你可以用该资源做什么", "在 Expasy 中浏览这些关键词", "你可能还感兴趣"]
  );
  assert.equal(text(doc.querySelector("footer")), "本资源依据知识共享通用（CC0）许可发布 CC0");
});

test("关于页：分区标题、引用按钮、资助句与页脚", () => {
  const doc = run(
    "<h1>About Expasy</h1><h2>Scope</h2><h2>Brief history</h2><h2>License</h2>" +
      "<h2>Maintainers</h2><h2>Funding</h2><h2>Submissions and Contact</h2>" +
      "<button>Cite Expasy</button>" +
      "<p>Expasy is funded by the Swiss State Secretariat for Education, Research and Innovation (SERI).</p>" +
      '<p>Expasy is operated by the <a href="https://sib.swiss">SIB Swiss Institute of Bioinformatics</a></p>' +
      '<p><a href="/terms-of-use">Terms of Use</a> <a href="#top">Back to the top</a></p>'
  );
  assert.equal(text(doc.querySelector("h1")), "关于 Expasy");
  assert.deepEqual(
    [...doc.querySelectorAll("h2")].map((e) => text(e)),
    ["范围", "简史", "许可", "维护者", "资助", "提交与联系"]
  );
  assert.equal(text(doc.querySelector("button")), "引用 Expasy");
  const ps = [...doc.querySelectorAll("p")];
  assert.equal(text(ps[0]), "Expasy 由瑞士教育、研究与创新国务秘书处（SERI）资助。");
  assert.equal(text(ps[1]), "Expasy 由以下机构运营： SIB Swiss Institute of Bioinformatics");
  assert.deepEqual([...ps[2].querySelectorAll("a")].map((e) => text(e)), ["使用条款", "返回顶部"]);
});

test("数据不动：资源名、基因/登录号、URL、DOI、物种名、机构名", () => {
  const doc = run(
    '<table class="data"><tr>' +
      "<td>UniProtKB/Swiss-Prot</td><td>Bgee</td><td>STRING</td><td>P04637</td><td>TP53</td>" +
      "<td>Homo sapiens</td><td>10.1093/nar/gkab225</td>" +
      '<td><a href="https://www.expasy.org/resources/bgee">https://www.expasy.org/resources/bgee</a></td>' +
      "<td>SIB Swiss Institute of Bioinformatics</td><td>neXtProt</td>" +
      "</tr></table>"
  );
  assert.deepEqual(
    [...doc.querySelectorAll("td")].map((e) => text(e)),
    [
      "UniProtKB/Swiss-Prot",
      "Bgee",
      "STRING",
      "P04637",
      "TP53",
      "Homo sapiens",
      "10.1093/nar/gkab225",
      "https://www.expasy.org/resources/bgee",
      "SIB Swiss Institute of Bioinformatics",
      "neXtProt"
    ]
  );
  assert.equal(doc.querySelector("a").getAttribute("href"), "https://www.expasy.org/resources/bgee");
});
