// NCBI Bookshelf 站词库（dict/books.json）冒烟测试：页眉/工具栏/右栏/浏览与检索页骨架
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/books.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "ncbi-books");

const CJK = /[\u4e00-\u9fff]/;

function engineFor(html, url) {
  const dom = new JSDOM(html, { url: url || "https://www.ncbi.nlm.nih.gov/books/NBK143764/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: dict.exact, rules: dict.rules, templates: dict.templates || [] },
    site
  });
  engine.start();
  return { doc: dom.window.document, engine };
}

test("词库结构：family/sites 正确，exact 有足够条目且译文都含汉字", () => {
  assert.equal(dict.meta.family, "books");
  assert.ok(dict.meta.sites.includes("www.ncbi.nlm.nih.gov"));
  const keys = Object.keys(dict.exact);
  assert.ok(keys.length >= 90, "exact 只有 " + keys.length + " 条");
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.match(v, CJK, "译文不含汉字: " + k + " => " + v);
  }
  for (const r of dict.rules) {
    assert.match(r.to, CJK, "规则译文不含汉字: " + r.re);
  }
});

test("条目卫生：key 里没有中文，值里没有明文 URL / 邮箱", () => {
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.doesNotMatch(k, CJK, "key 含中文: " + k);
    assert.doesNotMatch(v, /https?:\/\//i, "值含明文 URL: " + k);
    assert.doesNotMatch(v, /[\w.+-]+@[\w-]+\.[\w.]+/, "值含明文邮箱: " + k);
  }
});

test("关键条目存在：页脚声明、Contents、版权、Bookshelf ID、PDF、术语表开关", () => {
  const must = [
    "NCBI Bookshelf. A service of the National Library of Medicine, National Institutes of Health.",
    "Contents",
    "Copyright and Permissions",
    "Copyright Notice",
    "Bookshelf ID:",
    "PDF version of this page",
    "PDF version of this title",
    "Disable Glossary Links",
    "In this GeneReview",
    "Search this book",
    "Go to:",
    "Table of Contents"
  ];
  for (const k of must) assert.ok(k in dict.exact, "缺少条目: " + k);
});

test("浏览页与检索页骨架条目存在", () => {
  const must = [
    "Select a category or enter filter term below.",
    "Filter term:",
    "Title or Contributor",
    "Contributor (Author or Editor)",
    "All Types",
    "All Publishers",
    "Versions/Editions",
    "Current titles in Bookshelf",
    "Include previous versions/editions",
    "Previous versions or editions",
    "Include in the search result",
    "Added to Bookshelf",
    "Resource types",
    "Top results in this book",
    "Show more titles",
    "Images search in Bookshelf"
  ];
  for (const k of must) assert.ok(k in dict.exact, "缺少条目: " + k);
});

test("高级检索页骨架条目存在", () => {
  const must = [
    "Books Home",
    "Books Advanced Search Builder",
    "Use the builder below to create your search",
    "Select Operation",
    "Field Value",
    "Add new line",
    "Show index list",
    "Recent queries",
    "Add to builder",
    "Items found",
    "Save as a My NCBI Collection"
  ];
  for (const k of must) assert.ok(k in dict.exact, "缺少条目: " + k);
});

test("规则正则合法，且在样例原文上给出预期译文", () => {
  for (const r of dict.rules) assert.doesNotThrow(() => new RegExp(r.re), "坏正则: " + r.re);
  const { engine } = engineFor("<p>x</p>");
  const cases = [
    ["Bookshelf ID: NBK52787", "书架 ID：NBK52787"],
    ["Estimated reading time: 12 minutes", "预计阅读时间：12 分钟"],
    ["Estimated reading time: 1 minute", "预计阅读时间：1 分钟"],
    ["Report (13422)", "报告（13422）"],
    ["Collection (117)", "合集（117）"],
    ["Results: 1 to 20 of 3020 books (53944 items)", "结果：第 1 至 20 项，共 3020 本图书（53944 条记录）"],
    ["See more (517)...", "查看更多（517）..."],
    ["Figure 1.", "图 1."],
    ["Table 2B.", "表 2B."],
    ["PDF (14M)", "PDF 版（14M）"],
    ["Previous 200", "前 200 个"],
    ["Next 200", "后 200 个"],
    ["FIGURE 6-1", "图 6-1"]
  ];
  for (const [src, want] of cases) {
    assert.equal(engine.translateText(src), want, "原文: " + src);
  }
});

test("章节页右栏：查看入口、Bookshelf ID、出版与更新日期、阅读时长", () => {
  const { doc } = engineFor(
    '<div id="rightcolumn"><ul class="simple-list">' +
      '<li><a href="/books/NBK5/?report=reader">PubReader 阅读器</a></li>' +
      '<li><a href="/books/NBK5/?report=printable">打印视图</a></li>' +
      '<li><a href="/books/NBK5/pdf/x.pdf">PDF version of this page</a> (492K)</li>' +
      '<li><a href="/books/n/x/pdf/">PDF version of this title</a> (14M)</li>' +
      '<li><a href="#" class="toggle-glossary-link" title="Enable/disable links to the glossary">Disable Glossary Links</a></li>' +
      "</ul></div>" +
      '<div class="small"><span class="label">Bookshelf ID: NBK52787</span></div>' +
      '<p class="small">Initial Posting: <a href="#">2011</a>; Last Update: <a href="#">2024</a>.</p>' +
      "<p>Estimated reading time: <em>29 minutes</em></p>" +
      '<div class="goto"><a class="page-toc-label" title="Go to other sections in this page">Go to:</a></div>' +
      '<div class="half_rhythm"><ul class="inline_list"><li><span class="label">Copyright and Permissions</span></li></ul></div>' +
      "<h3><span>In this GeneReview</span></h3>"
  );
  const links = [...doc.querySelectorAll("#rightcolumn li a")].map((a) => a.textContent);
  assert.deepEqual(links, ["PubReader 阅读器", "打印视图", "本页 PDF 版", "本书 PDF 版", "禁用术语表链接"]);
  assert.equal(doc.querySelector(".toggle-glossary-link").getAttribute("title"), "启用/禁用术语表链接");
  const meta = [...doc.querySelectorAll(".label")].map((s) => s.textContent);
  assert.ok(meta.includes("书架 ID：NBK52787"), "Bookshelf ID 未翻: " + meta.join("/"));
  const posting = doc.querySelector("p.small").textContent;
  assert.match(posting, /初次发布：/);
  assert.match(posting, /；最后更新：/);
  assert.equal(dict.exact["; Last Revision:"], "；最后修订：");
  const reading = [...doc.querySelectorAll("p")].map((x) => x.textContent).join("|");
  assert.match(reading, /预计阅读时间：29 分钟/);
  assert.equal(doc.querySelector(".page-toc-label").textContent, "跳转到：");
  assert.equal(doc.querySelector(".page-toc-label").getAttribute("title"), "跳转到本页的其他章节");
  assert.equal(doc.querySelector(".inline_list .label").textContent, "版权与许可");
  assert.equal(doc.querySelector("h3 span").textContent, "本 GeneReview 内容");
});

test("书目目录页：Contents 标题、页脚声明、PDF 版本、引用框", () => {
  const { doc } = engineFor(
    "<h2>Contents</h2>" +
      '<ul class="inline_list"><li><span class="label">Copyright and Permissions</span></li></ul>' +
      '<div class="bk_prnt"><p class="small">NCBI Bookshelf. A service of the National Library of Medicine, National Institutes of Health.</p></div>' +
      '<div class="bk_tt">The NCBI Handbook [Internet]. 2nd edition. Bethesda (MD): National Center for Biotechnology Information (US); 2013-.</div>'
  );
  assert.equal(doc.querySelector("h2").textContent, "目录");
  assert.equal(doc.querySelector(".inline_list .label").textContent, "版权与许可");
  assert.equal(
    doc.querySelector(".bk_prnt p").textContent,
    "NCBI Bookshelf。美国国立医学图书馆、美国国立卫生研究院提供的一项服务。"
  );
  assert.match(doc.querySelector(".bk_tt").textContent, /^The NCBI Handbook \[Internet\]\. 2nd edition\./, "书目款目不该被翻");
});

test("浏览书目页：检索条、类型/出版者筛选与显示设置", () => {
  const { doc } = engineFor(
    '<div class="books-browse-top"><div class="search-bar">Select a category or enter filter term below.<br>' +
      "<label>Filter term: <input></label><label for=\"term\"> in </label>" +
      '<select name="termtype"><option selected> Title or Contributor </option><option> 标题 </option>' +
      "<option> Contributor (Author or Editor) </option></select></div></div>" +
      '<div class="filter"><h4>类型</h4><ul id="types">' +
      '<li class="checked"><a class="applyterm">All Types</a></li>' +
      '<li><a class="applyterm">Report (13422)</a></li>' +
      '<li><a class="applyterm">图书（1626）</a></li>' +
      '<li><a class="applyterm">Collection (117)</a></li>' +
      '<li><a class="more">More</a></li></ul></div>' +
      '<div class="filter"><h4>出版者</h4><ul><li><a class="applyterm">All Publishers</a></li></ul></div>' +
      '<div class="filter"><h4>Versions/Editions</h4><ul><li><a>Current titles in Bookshelf</a></li>' +
      "<li><a>Include previous versions/editions</a></li></ul></div>" +
      '<div id="display_bar"><h4><a>Display Settings:</a></h4></div>' +
      '<div id="save_link_filter">Save link:</div><a class="seemore">Show more titles</a>'
  );
  const text = doc.body.textContent;
  assert.match(text, /在下方选择类别或输入筛选词。/);
  assert.match(text, /筛选词：/);
  assert.match(text, /标题或贡献者/);
  assert.match(text, /贡献者（作者或编者）/);
  const terms = [...doc.querySelectorAll(".applyterm")].map((a) => a.textContent);
  assert.deepEqual(terms, ["全部类型", "报告（13422）", "图书（1626）", "合集（117）", "全部出版者"]);
  assert.equal([...doc.querySelectorAll(".more")][0].textContent, "更多");
  assert.match(text, /版本\/版次/);
  assert.match(text, /Bookshelf 当前书目/);
  assert.match(text, /包含既往版本\/版次/);
  assert.match(text, /显示设置：/);
  assert.match(text, /保存链接：/);
  assert.equal(doc.querySelector(".seemore").textContent, "显示更多书目");
});

test("检索结果页：筛选块、结果计数、图片检索与邮件发送", () => {
  const { doc } = engineFor(
    "<h3>Previous versions or editions</h3><ul><li><a>Include in the search result</a></li></ul>" +
      "<h3>Added to Bookshelf</h3><ul><li><a>60 days</a></li></ul>" +
      "<h3>Resource types</h3><ul><li><a>Report</a></li><li><a>Collection</a></li></ul>" +
      '<h3 class="result_count left">Results: 1 to 20 of 3020 books (53944 items)</h3>' +
      '<div class="portlet"><h3>Images search in Bookshelf</h3><a class="seemore">See more (517)...</a></div>' +
      "<ul><li><label>Pub Date</label></li><li><label>E-mail</label></li><li><label>Number to send</label></li></ul>" +
      '<p class="links"><a>Top results in this book</a></p>' +
      '<div class="legend-from"><span class="legend-from-title">FIGURE 6-1</span></div>'
  );
  const text = doc.body.textContent;
  assert.match(text, /既往版本或版次/);
  assert.match(text, /纳入检索结果/);
  assert.match(text, /加入 Bookshelf/);
  assert.match(text, /60 天/);
  assert.match(text, /资源类型/);
  assert.match(doc.querySelector(".result_count").textContent, /^结果：第 1 至 20 项，共 3020 本图书（53944 条记录）$/);
  assert.match(text, /Bookshelf 图片检索/);
  assert.equal(doc.querySelector(".seemore").textContent, "查看更多（517）...");
  assert.match(text, /出版日期/);
  assert.match(text, /电子邮件/);
  assert.match(text, /发送数量/);
  assert.match(text, /本书中的热门结果/);
  assert.equal(doc.querySelector(".legend-from-title").textContent, "图 6-1");
});

test("高级检索页：构建器按钮、索引翻页与历史操作", () => {
  const { doc } = engineFor(
    "<h2>Books Advanced Search Builder</h2>" +
      '<div id="search_term" class="built_search"> Use the builder below to create your search </div>' +
      "<h3>Builder</h3>" +
      '<label for="fop_0">Select Operation</label><label for="fv_0">Field Value</label>' +
      '<a title="Remove this line from builder">Remove line</a><a>Show index list</a><a>Add new line</a>' +
      '<a title="Previous 200 set of indexed terms">Previous 200</a><a title="Next 200 set of indexed terms">Next 200</a>' +
      "<a>Refresh index</a><a>Download history</a><a>Clear history</a><caption>Recent queries</caption>" +
      "<table><tr><th>Add to builder</th><th>Items found</th></tr></table>" +
      '<a>AND in builder</a><a>Delete from history</a><a>Save as a My NCBI Collection</a>' +
      '<option>Publication Year</option><option>Full Author Name</option><option>ISBN</option>'
  , "https://www.ncbi.nlm.nih.gov/books/advanced/");
  assert.equal(doc.querySelector("h2").textContent, "图书高级检索构建器");
  assert.equal(doc.querySelector(".built_search").textContent.trim(), "用下方的构建器创建您的检索式");
  const links = [...doc.querySelectorAll("a")].map((a) => a.textContent);
  assert.deepEqual(links, [
    "删除该行", "显示索引列表", "添加新行", "前 200 个", "后 200 个", "刷新索引",
    "下载检索历史", "清除检索历史", "以 AND 加入构建器", "从检索历史中删除", "另存为 My NCBI 收藏"
  ]);
  assert.equal(doc.querySelectorAll("a")[0].getAttribute("title"), "从构建器中删除此行");
  assert.equal(doc.querySelectorAll("a")[3].getAttribute("title"), "前 200 个索引词");
  const ths = [...doc.querySelectorAll("th")].map((t) => t.textContent);
  assert.deepEqual(ths, ["添加到构建器", "命中条目数"]);
  const opts = [...doc.querySelectorAll("option")].map((o) => o.textContent);
  assert.deepEqual(opts, ["出版年", "完整作者姓名", "ISBN"], "ISBN 是标准编号，保持英文");
});

test("不翻名单：书名、作者、非 NCBI 出版社款目、章节标题与书目款目保持原文", () => {
  const { doc } = engineFor(
    '<p class="title">The NCBI Handbook [Internet]. 2nd edition.</p>' +
      '<div class="desc">Adam MP, Bick S, Mirzaa GM, et al., editors.</div>' +
      '<div class="details">Oxford: Wiley-Liss; 2002.</div>' +
      '<a class="toc-item">A Brief History of NCBI’s Formation and Growth</a>' +
      '<div class="supp">Cold Spring Harbor (NY): Cold Spring Harbor Laboratory Press; 1997.</div>'
  );
  assert.equal(doc.querySelector(".title").textContent, "The NCBI Handbook [Internet]. 2nd edition.");
  assert.match(doc.querySelector(".desc").textContent, /^Adam MP, Bick S/);
  assert.match(doc.querySelector(".details").textContent, /^Oxford: Wiley-Liss; 2002\.$/);
  assert.equal(doc.querySelector(".toc-item").textContent, "A Brief History of NCBI’s Formation and Growth");
  assert.match(doc.querySelector(".supp").textContent, /^Cold Spring Harbor \(NY\)/);
});

// NCBI 固定出版模板行（NBK143764 实测）：可见的 .half_rhythm 被 <a><span> 切成
// 「Bethesda (MD): 」+ 出版者链接 + 「; 」+ 年份 span + 「-.」三段，整串规则永远命不中。
// 所以规则负责扁平串，模板负责真实分片 DOM；出版者名由 exact 在链接里补翻。
test("NCBI 出版模板行：扁平串规则与真实分片 DOM 模板都译出", () => {
  const flat = "Bethesda (MD): National Center for Biotechnology Information (US); 2013-.";
  assert.equal(
    engineFor("<p>x</p>").engine.translateText(flat),
    "贝塞斯达（马里兰州）：美国国家生物技术信息中心（US）；2013-."
  );
  const { doc } = engineFor(
    '<div class="meta-content fm-sec"><div class="half_rhythm">Bethesda (MD): ' +
      '<a href="https://www.ncbi.nlm.nih.gov/"><span itemprop="publisher">National Center for Biotechnology Information (US)</span></a>; ' +
      '<span itemprop="datePublished">2013</span>-.</div></div>'
  );
  assert.equal(
    doc.querySelector(".half_rhythm").textContent.replace(/\s+/g, " ").trim(),
    "贝塞斯达（马里兰州）：美国国家生物技术信息中心（US）；2013-."
  );
  assert.equal(
    doc.querySelector(".half_rhythm a span").textContent,
    "美国国家生物技术信息中心（US）"
  );
  assert.ok(doc.querySelector(".half_rhythm a"), "模板重建后出版者链接必须保留");
});

test("出版模板通道：规则与模板占位符齐备", () => {
  const rule = dict.rules.find((r) => r.re.includes("Bethesda"));
  assert.ok(rule, "缺少 Bethesda 出版模板规则");
  assert.equal(rule.re, "^Bethesda \\(MD\\): National Center for Biotechnology Information \\(US\\); (.+)$");
  assert.equal(rule.to, "贝塞斯达（马里兰州）：美国国家生物技术信息中心（US）；$1");
  const tpl = (dict.templates || []).find((t) => t.pat.startsWith("Bethesda (MD):"));
  assert.ok(tpl, "缺少出版模板行");
  assert.equal(tpl.pat, "Bethesda (MD): {{1}}; {{2}}-.");
  assert.equal(tpl.zh, "贝塞斯达（马里兰州）：{{1}}；{{2}}-.");
});
