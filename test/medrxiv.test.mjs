// medRxiv（www.medrxiv.org，Highwire 平台，与 bioRxiv 同构）站点词库回归：
// 首页导航与学科领域表 / 提示条 / 高级检索面板 / 检索结果工具条 / 文章页侧栏与预印本声明 /
// 邮件转发表单。作者、标题、机构、期刊、DOI 等文献元数据整块 skip，不翻也不进漏翻清单。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/medrxiv.json"), "utf8"));

// 线上站点栈：通用册先加载，站点册后加载（同名键后者覆盖前者）
const STACK = ["common", "medrxiv"];
const exact = {};
const rules = [];
const templates = [];
for (const id of STACK) {
  const d = JSON.parse(fs.readFileSync(path.join(root, "../dict/" + id + ".json"), "utf8"));
  Object.assign(exact, d.exact || {});
  if (d.rules) rules.push(...d.rules);
  if (d.templates) templates.push(...d.templates);
}

// 站点配置直接用 config/sites.json 里的真条目：配置写错（skip/block/scopedExact 掉了）测试要红
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8"));
const site = (sites.sites || []).find((s) => s.id === "medrxiv");
assert.ok(site, "config/sites.json 里必须有 medrxiv 站点条目");

function run(html) {
  const dom = new JSDOM(html);
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact, rules, templates },
    site
  });
  engine.start();
  return { doc: dom.window.document, engine };
}

const text = (el) => String(el.textContent || "").replace(/\s+/g, " ").trim();

test("词库结构：条数、键值形态、规则锚定、模板槽位连续", () => {
  assert.equal(book.meta.family, "medrxiv");
  assert.ok(book.meta.sites.includes("www.medrxiv.org"), "sites 要挂 www.medrxiv.org");
  assert.ok(Object.keys(book.exact).length >= 180, "exact 至少 180 条");
  assert.ok(book.rules.length >= 3, "rules 至少 3 条");
  assert.ok(book.templates.length >= 4, "templates 至少 4 条");

  const seen = new Set();
  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "键里不能有中文: " + k);
    assert.ok(/[\u4e00-\u9fff]/.test(v), "译文里必须有中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "键首尾不能有空白: " + JSON.stringify(k));
    assert.equal(v, v.trim(), "译文首尾不能有空白: " + JSON.stringify(v));
    assert.ok(!seen.has(k), "重复键: " + k);
    seen.add(k);
  }
  for (const r of book.rules) {
    const re = new RegExp(r.re);
    assert.ok(re.source.length > 0);
    assert.ok(/^\^/.test(r.re) && /\$$/.test(r.re), "规则必须 ^…$ 锚定: " + r.re);
    assert.ok(/[\u4e00-\u9fff]/.test(r.to), "规则译文里必须有中文: " + r.re);
    assert.ok(/\$\d/.test(r.to), "规则要用到捕获占位符: " + r.re);
  }
  for (const t of book.templates) {
    const used = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.ok(used.length >= 1, "模板要带槽位: " + t.pat);
    const sorted = used.slice().sort((a, b) => a - b);
    sorted.forEach((n, i) => assert.equal(n, i + 1, "槽位必须从 1 连续: " + t.pat));
    const zhUsed = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.deepEqual(zhUsed.slice().sort((a, b) => a - b), sorted, "译文槽位要与原文一致");
  }
});

test("首页：导航、学科领域表、提示条、Cookie 条", () => {
  const { doc } = run(
    '<div id="skip-link"><a href="#main">Skip to main content</a></div>' +
      '<ul class="menu"><li><a>Home</a></li><li><a>Submit</a></li><li><a>FAQ</a></li>' +
      "<li><a>Blog</a></li><li><a>ALERTS / RSS</a></li><li><a>Resources</a></li><li><a>About</a></li></ul>" +
      '<div id="biorxiv-subject-areas-table-title"><b>Subject Areas</b></div>' +
      '<a href="/content/early/recent"><strong>All Articles</strong></a>' +
      '<ul class="highwire-views-col"><li><a href="/collection/oncology">Oncology</a></li>' +
      '<li><a href="/collection/nursing">Nursing</a></li>' +
      '<li><a href="/collection/surgery">Surgery</a></li></ul>' +
      '<div class="pub_jnl"><p>Caution: Preprints are preliminary reports of work that have not been certified by peer review. They should not be relied on to guide clinical practice or health-related behavior and should not be reported in news media as established information.</p></div>' +
      '<div id="sliding-popup"><p>We use cookies on this site to enhance your user experience. By clicking any link on this page you are giving your consent for us to set cookies.</p>' +
      '<button>Continue</button><a>Find out more</a></div>'
  );
  const all = text(doc.body);
  assert.match(all, /跳到主要内容/);
  assert.match(all, /常见问题/);
  assert.match(all, /提醒 \/ RSS/);
  assert.match(all, /资源/);
  assert.match(all, /学科领域/);
  assert.match(all, /全部文章/);
  assert.match(all, /肿瘤学/);
  assert.match(all, /护理/);
  assert.match(all, /外科手术/);
  assert.match(all, /注意：预印本是尚未经过同行评议的初步研究报告/, "提示条要整段翻");
  assert.match(all, /本站使用 Cookie 以改善你的使用体验/);
  assert.match(all, /继续/);
  assert.match(all, /了解更多/);
  assert.doesNotMatch(all, /Skip to main content|Caution: Preprints|We use cookies on this site/);
});

test("检索页：高级检索面板字段与选项（含被标签切碎的 words/any/phrase）", () => {
  const { doc } = run(
    '<form id="highwire-search-form">' +
      '<label for="edit-txtsimple">Search Terms &amp; Keywords</label>' +
      '<div class="description">Type a term to search within all articles on this preprint server: e.g. stem cell</div>' +
      '<fieldset id="edit-limits"><legend><span class="fieldset-legend"><a class="fieldset-title">' +
      '<span class="fieldset-legend-prefix element-invisible">Hide</span> Limit Results</a></span></legend>' +
      '<span class="label filter-by-date-label">Date Posted</span>' +
      '<label for="edit-limit-from"><span class="element-invisible">From</span></label>' +
      '<label for="edit-limit-to"><span class="element-invisible">Through</span></label>' +
      '<label for="edit-jcode">Include articles in medRxiv and/or bioRxiv: </label>' +
      '<select id="edit-jcode"><option value="medrxiv" selected>medRxiv</option>' +
      '<option value="biorxiv">bioRxiv</option><option value="">bioRxiv and medRxiv</option></select>' +
      '<label for="edit-subject-collection-code">Include articles in subject area(s) </label>' +
      '<select id="edit-subject-collection-code"><option value="0">-- All Collections --</option>' +
      '<option value="Oncology">Oncology</option></select>' +
      '<label for="edit-series">Include articles in Series</label>' +
      '<select><option>-- All Series --</option></select>' +
      '<div class="form-item"><label>Include Only:</label></div>' +
      '<label class="option"><input type="checkbox" checked> Open Access Articles</label>' +
      '<label class="option"><input type="checkbox"> Review Articles</label>' +
      "</fieldset>" +
      '<fieldset id="edit-keywords"><legend><span class="fieldset-legend"><a class="fieldset-title">' +
      '<span class="fieldset-legend-prefix element-invisible">Show</span> Authors, Keywords</a></span></legend>' +
      '<div class="fieldset-description">Search for specific authors and/or words and phrases.</div>' +
      '<label for="edit-author1">Author </label>' +
      '<label for="edit-title">Title </label>' +
      '<label for="edit-title-flags">words </label><div class="form-radios">' +
      '<label class="option"><input type="radio" name="f"> any </label>' +
      '<label class="option"><input type="radio" name="f" checked> all </label>' +
      '<label class="option"><input type="radio" name="f"> phrase </label></div>' +
      '<label for="edit-abstract-title">Abstract or Title </label>' +
      '<label for="edit-text-abstract-title">Full Text or Abstract or Title </label>' +
      '<label for="edit-publisher">Publisher </label>' +
      '<select id="edit-publisher"><option>- All Publishers -</option></select>' +
      '<label for="edit-volume">Volume </label><label for="edit-issue">Issue </label>' +
      '<div class="fieldset-description">Citation-specific search information</div>' +
      '<div class="form-item"><label>Number of results per page</label></div>' +
      '<label class="option">Standard Format</label><label class="option">Condensed Format</label>' +
      '<label class="option">Exclude meeting abstracts</label>' +
      "</fieldset>" +
      '<div class="form-item form-item-format-result"><label>Format Results</label></div>' +
      "</form>"
  );
  const all = text(doc.body);
  for (const zh of ["检索词与关键词", "限定结果", "发布日期", "从", "至", "收录来自 medRxiv 和/或 bioRxiv 的文章：",
    "收录的学科领域", "全部收藏集", "收录的系列", "全部系列", "仅包括：", "开放获取文章", "综述文章",
    "作者、关键词", "检索特定作者和/或词与短语。", "作者", "标题", "词语", "任一", "全部", "短语",
    "摘要或标题", "全文或摘要或标题", "出版商", "全部出版商", "卷", "期", "引文专项检索信息",
    "每页结果数", "标准格式", "精简格式", "排除会议摘要", "结果格式", "隐藏", "显示"]) {
    assert.ok(all.includes(zh), "缺少译文: " + zh);
  }
  // 品牌与选项 value 不能被改
  assert.equal(doc.querySelectorAll("#edit-jcode option")[0].value, "medrxiv");
  assert.equal(text(doc.querySelector("#edit-jcode option")), "medRxiv");
  assert.equal(doc.querySelector("#edit-subject-collection-code option").value, "0");
});

test("检索结果：工具条、计数、引文按钮与 doi 标签", () => {
  const { doc } = run(
    '<div class="highwire-search-results-tools-wrapper">' +
      '<form class="hw-search-extra"><label for="edit-numresults">Items/Page </label>' +
      '<select id="edit-numresults"><option>10</option><option>25</option></select>' +
      '<label for="edit-sort">Order by </label>' +
      '<select id="edit-sort"><option value="relevance-rank" selected>Best Match</option>' +
      '<option value="publication-date-ascending">Oldest First</option>' +
      '<option value="publication-date-descending">Newest First</option></select></form>' +
      '<ul class="links search-result-tool"><li><a href="#" title="Edit Search">Edit</a></li>' +
      '<li><a href="/alerts" title="Create an alert for this search">Alert</a></li></ul></div>' +
      '<h1 id="page-title"> 1,467 Results</h1>' +
      '<p class="for-term">for term "aspirin"</p>' +
      '<div class="highwire-search-results"><ul class="highwire-search-results-list">' +
      '<li class="search-result"><div class="highwire-cite">' +
      '<span class="highwire-cite-title"><a href="/content/x">Aspirin for pre-eclampsia</a></span>' +
      '<div class="highwire-cite-authors"><span class="highwire-citation-authors">' +
      '<span class="highwire-citation-author"><span class="nlm-given-names">Leila</span> ' +
      '<span class="nlm-surname">Harrison</span></span></span></div>' +
      '<div class="highwire-cite-metadata"><span>medRxiv </span><span>2026.11.13.26368074; </span>' +
      '<span><span class="doi_label">doi:</span> https://doi.org/10.64898/2026.11.13.26368074 </span></div>' +
      '<div class="highwire-cite-extras"><a href="#" class="save-citation"><span class="title">Add to Selected Citations</span></a></div>' +
      '</div></li></ul></div>' +
      '<a class="view-selected">View Selected Citations (0)</a>' +
      '<a title="Add All Citations">Add All Citations</a>' +
      '<a title="Remove All Citations">Remove All Citations</a>'
  );
  const all = text(doc.body);
  assert.match(all, /每页条数/);
  assert.match(all, /排序依据/);
  assert.match(all, /最佳匹配/);
  assert.match(all, /最早优先/);
  assert.match(all, /最新优先/);
  assert.match(all, /检索词“aspirin”/);
  assert.match(all, /加入已选引文/);
  assert.match(all, /添加全部引文/);
  assert.match(all, /移除全部引文/);
  assert.match(all, /查看已选引文/, "View Selected Citations (n) 要按规则翻");
  assert.match(all, /doi:/, "doi: 是文献元数据标签，保持原样");
  // 文献元数据整块不动：标题、作者、期刊名
  assert.equal(text(doc.querySelector(".highwire-cite-title")), "Aspirin for pre-eclampsia");
  assert.match(text(doc.querySelector(".highwire-citation-authors")), /Leila Harrison/);
  assert.equal(text(doc.querySelector(".doi_label")), "doi:", "元数据标签不许翻");
  // 属性通道
  assert.equal(doc.querySelector('[title="编辑检索"]'), doc.querySelector(".search-result-tool a"));
  assert.equal(doc.querySelector('[title="为此检索创建提醒"]').getAttribute("href"), "/alerts");
});

test("文章页：侧栏工具、标签页、机构与作者保持英文", () => {
  const { doc } = run(
    '<div class="pane-biorxiv-art-tools"><a class="article-dl-pdf-link"><span class="title">Download PDF</span></a>' +
      '<a class="print-save-options">Print/Save Options</a>' +
      '<a class="dropdown-link">Full Text &amp; In-line Figures</a>' +
      '<a class="print-save-info" title="More Information on Print/Save Options">More Info</a>' +
      '<a class="article-dl-pdf-link"><span class="title">Email this Article</span></a>' +
      '<a title="Citation Tools"><span class="title">Citation Tools</span></a>' +
      '<a href="#qr">Get QR code</a></div>' +
      '<ul class="tabs"><li><a>Abstract</a></li><li><a>Full Text</a></li><li><a>Info/History</a></li>' +
      "<li><a>Metrics</a></li><li><a>Data/Code</a></li><li><a>Author Declarations</a></li>" +
      "<li><a>Community Reviews</a></li><li><a>Blogs/Media</a></li><li><a>Video</a></li></ul>" +
      '<h2 class="pane-title">Subject Area</h2>' +
      '<span class="highwire-article-collection-term"><a class="highlight" href="/collection/obstetrics-and-gynecology">' +
      'Obstetrics and Gynecology<i class="icon-caret-right"></i> </a></span>' +
      '<div class="highwire-cite-authors"><span class="highwire-citation-authors">' +
      '<span class="highwire-citation-author"><span class="nlm-given-names">Leila</span> ' +
      '<span class="nlm-surname">Harrison</span></span></span></div>' +
      '<div class="author-affiliation"><span class="nlm-institution">Emory University</span>, Atlanta, GA, ' +
      '<span class="nlm-country">USA</span></div>' +
      '<ul class="author-tooltip-find-more"><li><a>Find this author on Google Scholar</a></li>' +
      '<li><a>Find this author on PubMed</a></li><li><a>Search for this author on this site</a></li></ul>'
  );
  const all = text(doc.body);
  assert.match(all, /下载 PDF/);
  assert.match(all, /打印\/保存选项/);
  assert.match(all, /全文与插图/);
  assert.match(all, /更多信息/);
  assert.match(all, /通过电子邮件发送本文/);
  assert.match(all, /引用工具/);
  assert.match(all, /获取二维码/);
  assert.match(all, /摘要/);
  assert.match(all, /信息\/历史/);
  assert.match(all, /指标/);
  assert.match(all, /数据\/代码/);
  assert.match(all, /作者声明/);
  assert.match(all, /社区评议/);
  assert.match(all, /博客\/媒体/);
  assert.match(all, /学科领域/);
  assert.match(all, /妇产科学/, ".highlight 链接不能被默认 block 选择器挡住");
  assert.match(all, /在 Google Scholar 上查找该作者/);
  // 作者与机构不翻
  assert.match(text(doc.querySelector(".highwire-citation-authors")), /Leila Harrison/);
  assert.match(text(doc.querySelector(".author-affiliation")), /Emory University/);
});

test("文章页：预印本声明按真实节点边界走模板，三个子节点都不许留英文", () => {
  // 线上 DOM：<div class=pub_jnl><a>…[</a><a>what does this mean?</a>]. It reports … should <em>not</em> be used …</div>
  const { doc } = run(
    '<div class="pub_jnl">' +
      '<a href="/about/FAQ#unrefereed">This article is a preprint and has not been peer-reviewed [</a>' +
      '<a href="/about/FAQ#unrefereed">what does this mean?</a>]. It reports new medical research that ' +
      "has yet to be evaluated and so should <em>not</em> be used to guide clinical practice.</div>"
  );
  const div = doc.querySelector(".pub_jnl");
  assert.equal(
    text(div),
    "本文为预印本，尚未经过同行评议 [这是什么意思？]。该文报告的是尚未经过评估的新医学研究，因此不应将其用于指导临床实践。"
  );
  // 链接不能丢
  assert.equal(div.querySelectorAll("a").length, 2);
  assert.equal(text(div.querySelector("a")), "本文为预印本，尚未经过同行评议 [");
});

test("文章页：许可声明、关注说明、ORCID/日期规则", () => {
  const { doc } = run(
    '<div class="field-item"><div>The copyright holder for this preprint is the author/funder, ' +
      "who has granted medRxiv a license to display the preprint in perpetuity." +
      '<span class="license-type"> It is made available under a ' +
      '<a href="http://creativecommons.org/licenses/by/4.0/">CC-BY 4.0 International license</a>.</span></div></div>' +
      '<p class="follow-description">You can now receive automatic notifications when a preprint is revised, ' +
      'withdrawn, commented on, peer reviewed, or published in a journal. Select the events you would like ' +
      'to follow below and click "Submit". To see all of the preprints you are currently following, ' +
      'please go to the <a href="https://medrxiv.org/alerts">medRxiv Alerts Page</a>.</p>' +
      '<ul class="author-tooltip-find-more"><li><a>ORCID record for Leila Harrison</a></li></ul>' +
      "<p>Posted November 16, 2026.</p>" +
      '<div class="field-label">Copyright</div>'
  );
  const all = text(doc.body);
  assert.match(all, /本预印本的版权持有人为作者\/资助方/);
  assert.match(all, /本文以 CC-BY 4\.0 国际许可协议的条款提供。/);
  assert.match(all, /当预印本被修订、撤稿、被评论、经过同行评议或在期刊发表时/, "关注说明整段模板");
  assert.match(all, /请前往 medRxiv 提醒页面。/, "模板里的链接文字要翻");
  assert.match(all, /Leila Harrison 的 ORCID 记录/);
  assert.match(all, /发布于/);
  assert.match(all, /版权/);
});

test("邮件转发与评论面板：表单标签、空状态说明", () => {
  const { doc } = run(
    '<form id="forward-form"><div class="form-item">' +
      "<p>Thank you for your interest in spreading the word about medRxiv.</p>" +
      "<p>NOTE: Your email address is requested solely to identify you as the sender of this article.</p></div>" +
      '<label for="edit-email">Your Email </label><label for="edit-name">Your Name </label>' +
      '<label for="edit-sendto">Send To </label>' +
      "<div>Enter multiple addresses on separate lines or separate them with commas.</div>" +
      "<div>You are going to email the following</div>" +
      '<label for="edit-subject">Message Subject </label>' +
      "<div>(Your Name) has forwarded a page to you from medRxiv</div>" +
      "<div>(Your Name) thought you would like to see this page from the medRxiv website.</div>" +
      '<label for="edit-message">Message Body </label>' +
      '<label for="edit-personal">Your Personal Message </label>' +
      '<label for="edit-captcha">CAPTCHA</label></form>' +
      '<div class="csh_panelc"><p class="tab-title">Comments</p>' +
      '<p class="tab-description">medRxiv aims to provide a venue for anyone to comment on a medRxiv preprint. ' +
      "Comments are moderated for offensive or irrelevant content (this can take ~24 h). Please avoid duplicate " +
      "submissions. The content of a comment is not endorsed by medRxiv. medRxiv is now using a new commenting " +
      "interface powered by Hypothes.is. All comments previously submitted via the legacy platform (Disqus) have " +
      "been transferred to the new platform using the medRxiv_admin account. Please read our " +
      '<a href="https://connect.biorxiv.org/news">commenting guide</a> for more information.</p>' +
      '<p class="tab-description">There is no TRiP material for this paper.</p>' +
      '<p class="tab-description">There are no community reviews for this paper.</p>' +
      '<p class="tab-description">There are no automated evaluations for this paper.</p>' +
      '<p class="tab-description">There are no videos for this paper.</p>' +
      '<div class="tab-header"><p class="tab-title">Video:</p></div></div>' +
      '<h2>Citation Manager Formats</h2><ul><li>BibTeX</li><li>RIS</li><li>Zotero</li></ul>'
  );
  const all = text(doc.body);
  for (const zh of ["感谢你愿意帮助传播 medRxiv。", "注意：索取你的电子邮箱仅用于标明本文的发送者。",
    "你的邮箱", "你的姓名", "发送至", "多个地址请分行填写，或用逗号分隔。", "你将要发送以下内容",
    "邮件主题", "（你的姓名）向你转发了 medRxiv 的一个页面",
    "（你的姓名）认为你可能想看看 medRxiv 网站上的这个页面。", "邮件正文", "你的附言", "验证码"]) {
    assert.ok(all.includes(zh), "缺少译文: " + zh);
  }
  assert.match(all, /medRxiv 旨在为任何人提供评论 medRxiv 预印本的场所/);
  assert.match(all, /更多信息请阅读我们的评论指南。/);
  assert.match(all, /本文暂无 TRiP 材料。/);
  assert.match(all, /本文暂无社区评议。/);
  assert.match(all, /本文暂无自动化评价。/);
  assert.match(all, /本文暂无视频。/);
  assert.match(all, /文献管理格式/);
  // 引文格式名是产品名，不翻
  assert.match(all, /BibTeX/);
  assert.match(all, /Zotero/);
});

test("属性通道：placeholder / title / alt", () => {
  const { doc } = run(
    '<input placeholder="Search for this keyword">' +
      '<a title="Share this on Twitter"><img alt="Twitter logo" src="x.png"></a>' +
      '<a title="Publish this post to LinkedIn"><img alt="LinkedIn logo" src="x.png"></a>' +
      '<a title="Open in new tab">x</a>' +
      '<iframe title="Hypothesis annotation viewer"></iframe>'
  );
  assert.equal(doc.querySelector("input").placeholder, "搜索此关键词");
  assert.equal(doc.querySelectorAll("img")[0].alt, "Twitter 标志");
  assert.equal(doc.querySelectorAll("img")[1].alt, "LinkedIn 标志");
  assert.equal(doc.querySelectorAll("a")[0].title, "分享到 Twitter");
  assert.equal(doc.querySelectorAll("a")[1].title, "发布到 LinkedIn");
  assert.equal(doc.querySelectorAll("a")[2].title, "在新标签页打开");
  assert.equal(doc.querySelector("iframe").title, "Hypothesis 注释查看器");
});

test("skip 区块整体不动：文章正文、作者、机构", () => {
  const { doc } = run(
    '<div class="highwire-markup"><h2>Abstract</h2><p>Despite strong evidence supporting low-dose aspirin, ' +
      "implementation remains suboptimal globally. The prevention pathway encompasses early antenatal care " +
      "engagement, screening and risk identification.</p></div>" +
      '<div class="highwire-cite-title">Beyond prescription: Determinants of low-dose aspirin adoption</div>' +
      '<div class="author-tooltip-name">Leila Harrison</div>' +
      '<div class="author-tooltip-affiliation"><span class="author-tooltip-text">' +
      '<div class="author-affiliation"><span class="nlm-institution">Emory University</span>, Atlanta, GA, ' +
      '<span class="nlm-country">USA</span></div></span></div>'
  );
  assert.match(text(doc.querySelector(".highwire-markup")), /Despite strong evidence supporting low-dose aspirin/);
  assert.equal(text(doc.querySelector(".highwire-cite-title")), "Beyond prescription: Determinants of low-dose aspirin adoption");
  assert.equal(text(doc.querySelector(".author-tooltip-name")), "Leila Harrison");
  assert.match(text(doc.querySelector(".author-tooltip-affiliation")), /Emory University/);
});

test("幂等与还原：连跑两次不重复翻，disable 回英文", () => {
  const { doc, engine } = run('<h1>Subject Areas</h1><p><a>Download PDF</a></p>');
  assert.equal(text(doc.body), "学科领域下载 PDF");
  engine.scan();
  assert.equal(text(doc.body), "学科领域下载 PDF", "第二次扫描不能出现中文叠中文");
  engine.disable();
  assert.equal(text(doc.querySelector("h1")), "Subject Areas");
  assert.equal(text(doc.querySelector("a")), "Download PDF");
});
