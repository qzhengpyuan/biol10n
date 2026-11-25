// IntAct（dict/intact.json）回归：首页骨架与说明句、高级检索提示、发布统计规则、DocBot 组件文案、
// 检索结果页工具面板/列显示/表头/分页、下载页数据集副标题与突变术语模板。
// 必须保持英文：互作类型（MI 术语）、物种拉丁名、基因/蛋白名、登录号（P04637、EBI-xxx）、PMID、
// 数据集名、论文题录——这些出现在模板槽位里时原样保留。
// 取证：Chrome 影子实例 CDP 9227 抓的真实 DOM（www.ebi.ac.uk/intact/home、/intact/search?query=P04637、
// /intact/download/datasets，2026-11-26）。检索结果行与分页由站点 /ws 端点提供，该端点在本机与 CI 均超时
//（curl 25s 返回 000），结果行/分面筛选无法实机复核，此处只覆盖静态骨架与 DataTables 默认串。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, "../dict", f), "utf8"));
const book = read("intact.json");
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8"));
const site = sites.sites.find((s) => s.id === "intact");
const defaults = sites.defaults || {};

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;
const U = "https://www.ebi.ac.uk/intact/home";

// 站点词库栈：sites.json 里登记的那几册 + 本册（去重，接线前后都成立）
const stack = [...new Set((site.dicts || ["common"]).concat("intact"))];
const data = { exact: {}, rules: [], templates: [] };
for (const id of stack) {
  const p = path.join(root, "../dict", id + ".json");
  if (!fs.existsSync(p)) continue;
  const d = JSON.parse(fs.readFileSync(p, "utf8"));
  Object.assign(data.exact, d.exact || {});
  data.rules = data.rules.concat(d.rules || []);
  data.templates = data.templates.concat(d.templates || []);
}

const cfg = {
  scope: site.scope || "",
  block: defaults.block || "",
  attrs: [...(defaults.attrs || []), ...(site.attrs || [])],
  funcWords: site.funcWords !== false,
  proseGuard: site.proseGuard !== false,
  proseMax: site.proseMax || 120,
  proseExempt: site.proseExempt || "",
  rescan: false
};

function engineFor(doc, win) {
  const engine = createEngine({ document: doc, window: win, data, site: cfg });
  engine.start();
  return engine;
}
function run(html) {
  const dom = new JSDOM('<div id="wrap">' + html + "</div>", { url: U });
  engineFor(dom.window.document, dom.window);
  return dom.window.document;
}
const text = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : null);

const FX = {"HOME_TOP":"<div id=\"home-description\" class=\"row\"><h1>IntAct Molecular Interaction Database</h1><p class=\"text-justify\"> IntAct provides a free, open source database system and analysis tools for molecular interaction data. All interactions are derived from literature curation or direct user submissions. The IntAct Team also produces the <a href=\"https://www.ebi.ac.uk/complexportal\" target=\"_blank\">Complex Portal</a>. </p></div>","HOME_EXAMPLE":"<ul class=\"no-margin no-padding\"><li>Gene names: <a>Ndc80</a></li><li>UniProt ACs: <a>Q05471</a></li><li>Taxon IDs: <a>9606</a></li></ul>","HOME_NOTE":"<p class=\"columns margin-top-medium font\"><em> Quick search can yield to false positives as one identifier can be referenced by 2 different fields. If you want to avoid these, we suggest you to use <a href=\"home#advanced-search\">Advanced Search</a>. </em></p>","HOME_MIQL":"<p> For more information about Advanced Search and the MIQL syntax, see the <a href=\"documentation/user-guide#advanced_search\">documentation</a></p>","HOME_RELEASE":"<div id=\"releaseVersion\"><h6><i class=\"icon icon-common icon-database\"></i> Release 254 - November 2026</h6><ul style=\"margin-bottom: 0;\"><li>Publications : 24,076</li><li>Interactors : 146,455</li><li>Interactions : 930,109</li><li>Binary Interactions : 1,814,919</li></ul></div>","HOME_SIDE":"<h5 class=\"white-color\">Interactomes</h5><h5 class=\"white-color\">Datasets</h5><h5 class=\"white-color\">Mutations</h5><h5 class=\"white-color\">FTP</h5><h5 class=\"white-color\">Data Submission</h5><h5 class=\"white-color\">How To Cite Us</h5><h5 class=\"white-color\">Documentation</h5><h5 class=\"white-color\">Training</h5>","HOME_ELIXIR":"<a href=\"https://elixir-europe.org/platforms/data/core-data-resources\" target=\"_blank\"><div class=\"elixir-logo-kite\"></div><h5><span class=\"elixir-banner-name\">IntAct</span> is part of the ELIXIR infrastructure </h5><div id=\"elixir-banner-info\"><small><span class=\"elixir-banner-description\">IntAct is an ELIXIR Core Data Resource </span><span class=\"readmore\">Learn more ›</span></small></div></a>","DOCBOT":"<div class=\"vf-chatbot-modal__footnote\"><span>Our chatbot uses AI to assist you. Its use is subject to the <a class=\"vf-banner__link\" href=\"https://www.ebi.ac.uk/about/terms-of-use/\">EMBL-EBI Terms of Use</a> and the <a class=\"vf-banner__link\" href=\"https://www.ebi.ac.uk/about/embl-ebi-ai-chatbot-disclaimer/\">Chatbot Disclaimer</a>. Do not include any personal information about you or others in the chat (for more information, see the<a class=\"vf-banner__link\" href=\"https://www.ebi.ac.uk/docbot/assets/privacy_notice.pdf\"> Privacy Notice</a>).</span></div>","DOCBOT_CLOSE":"<div class=\"vf-chatbot-dialog__body\"><p class=\"vf-text vf-text-body--3\">Are you sure you want to close the chat? <br>Your current conversation history will be permanently deleted.</p></div>","SEARCH_HEAD":"<h2>Search for P04637</h2><p>This takes longer than usual. Bear with us!</p>","SEARCH_TOOLS":"<div id=\"toolbar-column\" class=\"columns\"><h4 class=\"underline margin-bottom-large\"><i class=\"icon icon-common icon-spacer icon-tool\"></i>Network Tools </h4><div class=\"row\"><button id=\"reset\" type=\"button\" class=\"button expanded\"><i class=\"icon icon-common icon-spacer icon-redo-alt\"></i>Redraw Network </button><button id=\"loadCytoscapeBtn\" type=\"button\" class=\"button expanded\"> Load in Cytoscape </button></div><ul class=\"vertical menu facets\"><h5>Layout</h5><div class=\"margin-bottom-large\"><li><span class=\"margin-left-small\"><input type=\"radio\" name=\"layout\" value=\"lumina\" id=\"lumina\"><label for=\"lumina\">Lumina</label></span></li><li><span class=\"margin-left-small\"><input type=\"radio\" name=\"layout\" value=\"fcose\" id=\"force-directed\"><label for=\"force-directed\">Force directed</label></span></li><li><span class=\"margin-left-small\"><input type=\"radio\" name=\"layout\" value=\"avsdf\" id=\"avsdf\"><label for=\"avsdf\">Circular</label></span></li><li><span class=\"margin-left-small\"><input type=\"radio\" name=\"layout\" value=\"cise\" id=\"cise\"><label for=\"cise\">Bubbles</label></span></li></div><h5>Edges</h5><div class=\"margin-bottom-large\"><li><span class=\"margin-left-small\"><input type=\"checkbox\" id=\"expand\"><label for=\"expand\">Expand</label></span></li><li><span class=\"margin-left-small\"><input type=\"checkbox\" id=\"mutation\" disabled=\"\"><label for=\"mutation\" class=\"disabled\">Affected By Mutation </label></span><span class=\"tool-tip-text\">There is no mutation in this network</span></li></div><h5>Group By</h5><div class=\"margin-bottom-large\"><li><span class=\"margin-left-small\"><input type=\"checkbox\" id=\"species\"><label for=\"species\">Species</label></span></li></div></ul></div>","SEARCH_TABS":"<ul id=\"search-results-tabs\" class=\"tabs\" role=\"tablist\"><li class=\"tabs-title is-active\" role=\"presentation\"><a href=\"search?query=P04637#interactions\" role=\"tab\" aria-selected=\"true\">Interactions</a></li><li class=\"tabs-title\" role=\"presentation\"><a href=\"search?query=P04637#interactors\" role=\"tab\">Interactors</a></li></ul>","SEARCH_LENGTH":"<div class=\"dataTables_length\" id=\"interactionsTable_length\"><label>Show <select name=\"interactionsTable_length\"><option value=\"25\">25</option><option value=\"50\">50</option><option value=\"500\">500</option></select> entries</label></div>","SEARCH_TOGGLE":"<div class=\"column-toggle-container\"><button type=\"button\" class=\"dropdown button stick-and-fill-right\"> Column toggle </button><div class=\"dropdown-pane\" id=\"interactions_columnView\"><ul class=\"no-bullet tight\"><li class=\"column-toggle\"><label><input type=\"checkbox\" name=\"list\" value=\"Select\">Select </label></li><li class=\"column-toggle\"><label><input type=\"checkbox\" name=\"list\" value=\"Molecule A\">Molecule A </label></li><li class=\"column-toggle\"><label><input type=\"checkbox\" name=\"list\" value=\"Host Organism\">Host Organism </label></li><li class=\"column-toggle\"><label><input type=\"checkbox\" name=\"list\" value=\"Interaction AC\">Interaction AC </label></li><li class=\"column-toggle\"><label><input type=\"checkbox\" name=\"list\" value=\"Interaction Cross References\">Interaction Cross References </label></li></ul></div></div>","SEARCH_INTERACTORS":"<table><thead><tr><th><div class=\"dataTables_sizing\">Select</div></th><th><div class=\"dataTables_sizing\">Accession</div></th><th><div class=\"dataTables_sizing\">Preferred ID</div></th><th><div class=\"dataTables_sizing\">Type</div></th><th><div class=\"dataTables_sizing\">Species</div></th><th><div class=\"dataTables_sizing\">Description</div></th><th><div class=\"dataTables_sizing\">Alias</div></th><th><div class=\"dataTables_sizing\">Alternative IDs</div></th><th><div class=\"dataTables_sizing\">Interactions found in current search</div></th><th><div class=\"dataTables_sizing\">Total interactions in all IntAct</div></th></tr></thead></table>","DL_CURATED":"<div><h1>Curated Datasets</h1><p>Curated datasets are publications tagged, either computationally or manually by a curator, as being relevant to a specific area of biology.</p><p>These are actively maintained and grow with every release.<br> Please <a href=\"http://www.ebi.ac.uk/support/index.php?query=intact\">contact us</a> to request a new dataset relevant to your work.</p></div>","DL_ENTRY":"<li><p><a href=\"http://www.ebi.ac.uk/intact/search?query=annot:%22dataset:cancer%22\"><strong>Cancer</strong> </a>- Interactions investigated in the context of cancer <a href=\"https://ftp.ebi.ac.uk/pub/databases/intact/current/psi25/datasets/Cancer.zip\"><img src=\"https://example.org/miXML25.png\" alt=\"PSI-MI XML 2.5\"></a> <a href=\"https://ftp.ebi.ac.uk/pub/databases/intact/current/psi30/datasets/Cancer.zip\"><img src=\"https://example.org/miXml30.png\" alt=\"PSI-MI XML 3.0\"></a> <a href=\"https://ftp.ebi.ac.uk/pub/databases/intact/current/psimitab/datasets/Cancer.zip\"><img src=\"https://example.org/miTab27.png\" alt=\"PSI-MI TAB 2.7\"></a></p><p>This dataset consists of interactions of proteins that are involved in cancer. An ongoing literature survey was carried out to determine publications of interest. Protein annotations were also considered when choosing the publications to be curated.</p></li>","DL_SPECIES":"<div><h1>Species-based Datasets</h1><p>16 bespoke species-specific datasets are generated with each release and are available <a href=\"https://www.ebi.ac.uk/intact/interactomes\">here</a></p><p>This includes our bespoke dataset for <a href=\"https://www.ebi.ac.uk/intact/search?query=2697049&amp;interactorSpeciesFilter=SARS-CoV-2\">SARS-CoV-2</a>. A dataset for interactions involving proteins from coronaviruses in general can be found <a href=\"https://www.ebi.ac.uk/intact/download/datasets#curated\">here</a>.</p><p>The data are based on the taxonomy of the proteins taking part in the interaction. Analysis of one such dataset, which involves <em>Arabidopsis</em> proteins, has been discussed in PMID: <a href=\"http://europepmc.org/article/MED/20371643\">20371643</a>.</p></div>","DL_MUT":"<h1>Mutations</h1><p><a href=\"https://ftp.ebi.ac.uk/pub/databases/intact/current/various/mutations.tsv\">This dataset</a> contains annotations of experimental evidence where mutations have been shown to affect a protein interaction.</p><p>Several types of mutations are captured and the terms used to described them can be found in the <a href=\"https://www.ebi.ac.uk/ols/ontologies/mi\">PSI Molecular Interactions Controlled Vocabulary</a>.</p><ul><li>Mutation <a href=\"https://www.ebi.ac.uk/ols/ontologies/mi/terms?iri=MI_0118\">MI:0118</a>: A change in a sequence or structure in comparison to a reference entity due to a insertion, deletion or substitution event. <em>This root term is used when there is a mutation present in a protein and the wild type version has not been tested or shown to interact in the referenced paper.</em><ul><li>Mutation causing an interaction <a href=\"https://www.ebi.ac.uk/ols/ontologies/mi/terms?iri=MI_2227\">MI:2227</a>: A change in a sequence or structure in comparison to a reference entity due to a insertion, deletion or substitution event that enables an interaction when compared with the wild-type, which does not interact.</li></ul></li></ul>","DL_OUTPUT":"<h2>Output format description</h2><p>We provide a tab-delimited flatfile download with the full dataset. Every instance of a mutation affecting a given interaction is given a unique identifier (<em>“Feature AC”</em>). Please notice that some mutations will affect more than one residue position range in non-consecutive order. Each one of these non-consecutive ranges is recorded in a separate line, hence there will always be a difference between the number of lines in the file and the number of unique mutations. Here is a brief description of the different columns used in the file:</p><ul><li>Feature AC: Accession number for that particular mutation feature.</li><li>Feature short label: Human-readable short label summarizing the amino acid changes and their positions, compliant with the Human Genome Variation Society recommendations (see <a href=\"http://varnomen.hgvs.org/recommendations/protein/\">http://varnomen.hgvs.org/recommendations/protein/</a>) .</li><li>Original sequence: Wild type amino acid residue(s) affected, in one letter code.</li></ul>","DL_TABLE":"<table><thead><tr><th>Feature AC</th><th>Feature short label</th><th>Feature range(s)</th><th>Original sequence</th><th>Resulting sequence</th><th>Feature type</th><th>Feature annotation</th><th>Affected protein AC</th><th>Affected protein symbol</th><th>Affected protein full name</th><th>Affected protein organism</th><th>Interaction participants</th><th>PubMedID</th><th>Figure legend</th><th>Interaction AC</th></tr></thead></table>","DL_SIDE":"<a href=\"download/datasets#curated\">Curated datasets</a><a href=\"download/datasets#computationally\">Computational datasets</a><a href=\"download/datasets#species\">Species-specific datasets</a><a href=\"download/datasets#mutations\">Mutations dataset</a>","DL_DISCLAIMER":"<p><em>Disclaimer: Search results for our datasets are displayed on our old website while we implement this search capacity in our new website.</em></p>","KEEP_EN":"<div><p>Multiplexed mapping of the interactome of GPCRs with receptor activity-modifying proteins - Thomas Sakmar et al., (2024)</p><p>IntAct curation assigns MI:0811 to every interaction of type proximity.</p><p>Target P04637 was curated from EBI-1234567 in Synechocystis sp. PCC 6803.</p><p>Affinomics</p></div>"};

test("词库结构：family/sites、条数、键值形态、规则锚定、模板槽位连续", () => {
  assert.ok(site, "sites.json 里必须登记 intact 站");
  assert.equal(book.meta.family, "ebi");
  assert.ok(book.meta.sites.some((s) => s.includes("www.ebi.ac.uk/intact")));
  assert.ok(book.meta.area.length > 0 && book.meta.note.length > 0, "meta 说明要有内容");
  const keys = Object.keys(book.exact);
  assert.ok(keys.length >= 150, "exact 只有 " + keys.length + " 条");
  assert.ok(book.rules.length >= 5, "rules 太少");
  assert.ok(book.templates.length >= 40, "templates 只有 " + book.templates.length + " 条");

  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(!CJK.test(k), "键里不能有中文: " + k);
    assert.ok(CJK.test(v), "译文里必须有中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "键首尾不能有空白: " + JSON.stringify(k));
    assert.equal(v, v.trim(), "值首尾不能有空白: " + JSON.stringify(k));
    assert.ok(!/https?:\/\/|@[\w.-]+\.\w+/.test(v), "译文里不能有 URL/邮箱: " + k);
  }
  for (const r of book.rules) {
    assert.doesNotThrow(() => new RegExp(r.re), "坏正则: " + r.re);
    assert.ok(/^\^/.test(r.re) && /\$$/.test(r.re), "规则要锚定: " + r.re);
    assert.ok(CJK.test(r.to), "规则译文里必须有中文: " + r.re);
    if (/\((?!\?)/.test(r.re)) assert.ok(/\$\d/.test(r.to), "带捕获组的规则要用到占位符: " + r.re);
  }
  const pats = new Set();
  for (const t of book.templates) {
    const used = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.ok(used.length >= 1, "模板要带槽位: " + t.pat.slice(0, 40));
    const sorted = used.slice().sort((a, b) => a - b);
    sorted.forEach((n, i) => assert.equal(n, i + 1, "槽位必须从 1 连续: " + t.pat.slice(0, 40)));
    const zhUsed = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.deepEqual(zhUsed.slice().sort((a, b) => a - b), sorted, "译文槽位要与原文一致");
    assert.ok(t.pat.length >= 20, "模板原文太短（引擎不接受 <20 字符）");
    assert.ok(!CJK.test(t.pat), "模板原文里不能有汉字: " + t.pat.slice(0, 40));
    assert.equal(t.pat, t.pat.trim(), "模板原文首尾不能有空白");
    assert.ok(!pats.has(t.pat), "模板原文重复: " + t.pat.slice(0, 40));
    pats.add(t.pat);
  }
});

test("首页：标题与简介整句翻，Complex Portal 链接保留", () => {
  const doc = run(FX.HOME_TOP);
  assert.equal(text(doc.querySelector("h1")), "IntAct 分子相互作用数据库");
  const p = doc.querySelector("p");
  assert.equal(
    text(p),
    "IntAct 提供免费、开源的数据库系统与分子相互作用数据分析工具。所有相互作用均来自文献整理或用户直接提交。IntAct 团队还负责维护 Complex Portal。"
  );
  const a = p.querySelector("a");
  assert.equal(text(a), "Complex Portal", "专名链接文字保持英文");
  assert.equal(a.getAttribute("href"), "https://www.ebi.ac.uk/complexportal");
});

test("首页例项：前缀标签翻成带冒号的中文，示例值不翻", () => {
  const doc = run(FX.HOME_EXAMPLE);
  const lis = [...doc.querySelectorAll("li")].map(text);
  assert.equal(lis[0], "基因名称： Ndc80");
  assert.equal(lis[1], "UniProt 登录号： Q05471");
  assert.equal(lis[2], "分类单元 ID： 9606");
});

test("首页快速检索说明：整句模板，Advanced Search 链接回到高级检索", () => {
  const doc = run(FX.HOME_NOTE);
  const em = doc.querySelector("em");
  assert.equal(
    text(em),
    "由于同一个标识符可能被 2 个不同字段引用，快速检索可能产生假阳性。如需避免，建议使用高级检索。"
  );
  const a = em.querySelector("a");
  assert.equal(text(a), "高级检索");
  assert.equal(a.getAttribute("href"), "home#advanced-search");
});

test("首页 MIQL 提示：一句一个链接，文档名留英文链接文字", () => {
  const doc = run(FX.HOME_MIQL);
  assert.equal(text(doc.querySelector("p")), "有关高级检索与 MIQL 语法的更多信息，请参阅文档");
  assert.equal(doc.querySelector("p a").getAttribute("href"), "documentation/user-guide#advanced_search");
});

test("首页发布统计：四条计数规则 + 版本号规则", () => {
  const doc = run(FX.HOME_RELEASE);
  assert.equal(text(doc.querySelector("h6")), "版本 254 - 2026 年 11 月");
  const lis = [...doc.querySelectorAll("li")].map(text);
  assert.deepEqual(lis, ["文献：24,076", "相互作用分子：146,455", "相互作用：930,109", "二元相互作用：1,814,919"]);
});

test("首页侧栏：导航项翻；FTP 这类协议名留英文", () => {
  const doc = run(FX.HOME_SIDE);
  const hs = [...doc.querySelectorAll("h5")].map(text);
  assert.deepEqual(hs, ["互作组", "数据集", "突变", "FTP", "数据提交", "如何引用我们", "文档", "培训"]);
});

test("首页 ELIXIR 标识：横幅与内核数据资源说明", () => {
  const doc = run(FX.HOME_ELIXIR);
  assert.ok(text(doc.querySelector(".elixir-banner-description")).includes("ELIXIR 核心数据资源"));
  assert.equal(text(doc.querySelector(".readmore")), "了解更多 ›");
  assert.equal(text(doc.querySelector(".elixir-banner-name")), "IntAct", "缩写 span 不动");
});

test("DocBot 脚注：三槽模板，三条链接地址不动", () => {
  const doc = run(FX.DOCBOT);
  const t = text(doc.querySelector("div"));
  assert.equal(
    t,
    "我们的聊天机器人使用 AI 为你提供帮助，其使用须遵守 EMBL-EBI 使用条款和聊天机器人免责声明。请勿在对话中包含你或他人的任何个人信息（更多信息请参阅 隐私声明）。"
  );
  const hrefs = [...doc.querySelectorAll("a")].map((a) => a.getAttribute("href"));
  assert.deepEqual(hrefs, [
    "https://www.ebi.ac.uk/about/terms-of-use/",
    "https://www.ebi.ac.uk/about/embl-ebi-ai-chatbot-disclaimer/",
    "https://www.ebi.ac.uk/docbot/assets/privacy_notice.pdf"
  ]);
});

test("DocBot 关闭确认：br 槽模板，对话历史提示整句翻", () => {
  const doc = run(FX.DOCBOT_CLOSE);
  assert.equal(text(doc.querySelector("p")), "确定要关闭聊天吗？当前对话历史将被永久删除。");
  assert.ok(doc.querySelector("br"), "br 要留着");
});

test("检索页：检索词标题与加载提示", () => {
  const doc = run(FX.SEARCH_HEAD);
  assert.equal(text(doc.querySelector("h2")), "检索 P04637");
  assert.equal(text(doc.querySelector("p")), "加载时间比平时更长，请稍候！");
});

test("检索页工具面板：网络工具、布局/边/分组标签、按钮", () => {
  const doc = run(FX.SEARCH_TOOLS);
  assert.equal(text(doc.querySelector("h4")), "网络工具");
  const buttons = [...doc.querySelectorAll("button")].map(text);
  assert.deepEqual(buttons, ["重绘网络", "载入 Cytoscape"]);
  const labels = [...doc.querySelectorAll("label")].map(text);
  assert.deepEqual(labels, ["Lumina", "力导向", "环形", "气泡", "展开", "受突变影响", "物种"]);
  assert.equal(text(doc.querySelector(".tool-tip-text")), "该网络中没有突变");
});

test("检索页：Interactions / Interactors 两个页签", () => {
  const doc = run(FX.SEARCH_TABS);
  assert.deepEqual([...doc.querySelectorAll("a")].map(text), ["相互作用", "相互作用分子"]);
});

test("检索页分页：Show/entries 两个文本节点分别翻", () => {
  const doc = run(FX.SEARCH_LENGTH);
  const t = text(doc.querySelector("label"));
  assert.ok(t.startsWith("显示"), t);
  assert.ok(t.endsWith("条"), t);
  assert.ok(!/Show|entries/.test(t), t);
});

test("检索页：列显示开关与结果表表头", () => {
  const doc = run(FX.SEARCH_TOGGLE);
  assert.equal(text(doc.querySelector("button")), "列显示");
  const cols = [...doc.querySelectorAll("label")].map(text);
  assert.deepEqual(cols, ["选择", "分子 A", "宿主生物", "相互作用登录号", "相互作用交叉引用"]);

  const doc2 = run(FX.SEARCH_INTERACTORS);
  const ths = [...doc2.querySelectorAll("th")].map(text);
  assert.deepEqual(ths, [
    "选择",
    "登录号",
    "首选 ID",
    "类型",
    "物种",
    "描述",
    "别名",
    "备选 ID",
    "本次检索中发现的相互作用",
    "IntAct 全部相互作用总数"
  ]);
});

test("下载页：人工整理数据集说明与「持续维护」整句（含 br 槽）", () => {
  const doc = run(FX.DL_CURATED);
  assert.equal(text(doc.querySelector("h1")), "人工整理数据集");
  const ps = [...doc.querySelectorAll("p")].map(text);
  assert.equal(ps[0], "人工整理数据集是指经计算流程或整理人员标记为与某一生物学领域相关的文献集合。");
  assert.equal(ps[1], "这些数据集持续维护，并随每次发布而扩充。请联系我们，申请与你工作相关的新数据集。");
  assert.equal(doc.querySelector("p a").getAttribute("href"), "http://www.ebi.ac.uk/support/index.php?query=intact");
});

test("下载页：数据集条目副标题走 1 槽模板，数据集名与长说明整段翻", () => {
  const doc = run(FX.DL_ENTRY);
  const ps = [...doc.querySelectorAll("p")];
  assert.equal(text(ps[0]), "Cancer - 以癌症为背景研究的相互作用");
  assert.equal(text(ps[0].querySelector("strong")), "Cancer", "数据集名保持英文");
  assert.equal(
    text(ps[1]),
    "该数据集收录与癌症相关蛋白质的相互作用。我们持续开展文献调研以确定值得关注的文献，并在挑选待整理文献时兼顾蛋白注释。"
  );
  const alts = [...doc.querySelectorAll("img")].map((i) => i.getAttribute("alt"));
  assert.deepEqual(alts, ["PSI-MI XML 2.5", "PSI-MI XML 3.0", "PSI-MI TAB 2.7"], "格式图标 alt 是格式名，不翻");
});

test("下载页物种段：三条说明模板，here 翻成此处、物种拉丁名保留", () => {
  const doc = run(FX.DL_SPECIES);
  const ps = [...doc.querySelectorAll("p")].map(text);
  assert.equal(ps[0], "每次发布都会生成 16 个定制的物种专属数据集，可在此处查看");
  assert.equal(ps[1], "其中包含我们为 SARS-CoV-2 定制的数据集。涉及冠状病毒蛋白相互作用的一般数据集可在此处找到。");
  assert.equal(
    ps[2],
    "数据依据参与相互作用的蛋白质的分类学归属。其中一个涉及 Arabidopsis 蛋白的数据集的分析已在 PMID：20371643 中讨论。"
  );
  assert.equal(text(doc.querySelector("em")), "Arabidopsis", "物种拉丁名不翻");
});

test("下载页突变段：数据集链接模板、术语词表模板、根术语两个槽", () => {
  const doc = run(FX.DL_MUT);
  assert.equal(text(doc.querySelector("h1")), "突变");
  const ps = [...doc.querySelectorAll("p")].map(text);
  assert.equal(ps[0], "该数据集收录了实验证据注释，记录突变已被证明会影响某一蛋白质相互作用的情况。");
  assert.equal(ps[1], "数据集收录多种类型的突变，用于描述这些突变的术语见 PSI 分子相互作用受控词表。");
  const li = doc.querySelector("li");
  assert.ok(text(li).startsWith("突变 MI:0118：与参考实体相比，序列或结构因插入、缺失或替换事件而发生改变。"), text(li));
  assert.ok(text(li).includes("使用该根术语"), text(li));
  const inner = li.querySelector("li");
  assert.ok(text(inner).startsWith("导致相互作用的突变 MI:2227："), text(inner));
});

test("下载页输出格式：1 槽长段、列说明 li、格式表表头", () => {
  const doc = run(FX.DL_OUTPUT);
  assert.equal(text(doc.querySelector("h2")), "输出格式说明");
  const p = text(doc.querySelector("p"));
  assert.ok(p.startsWith("我们提供包含完整数据集的制表符分隔平面文件下载。"), p);
  assert.ok(p.includes("唯一标识符（“Feature AC”）"), p, "槽位里的列名保持原样");
  const lis = [...doc.querySelectorAll("li")].map(text);
  assert.equal(lis[0], "特征登录号：该突变特征的登录号。");
  assert.ok(lis[1].startsWith("特征短标签：便于阅读的短标签"), lis[1]);
  assert.ok(lis[1].includes("http://varnomen.hgvs.org/recommendations/protein/"), lis[1]);
  assert.equal(lis[2], "原始序列：受影响野生型氨基酸残基的单字母代码。");

  const doc2 = run(FX.DL_TABLE);
  assert.deepEqual([...doc2.querySelectorAll("th")].map(text), [
    "特征登录号",
    "特征短标签",
    "特征范围",
    "原始序列",
    "结果序列",
    "特征类型",
    "特征注释",
    "受影响蛋白质登录号",
    "受影响蛋白质符号",
    "受影响蛋白质全名",
    "受影响蛋白质物种",
    "相互作用参与者",
    "PubMed 文献号",
    "图注",
    "相互作用登录号"
  ]);
});

test("下载页侧栏与免责声明", () => {
  const doc = run(FX.DL_SIDE);
  assert.deepEqual([...doc.querySelectorAll("a")].map(text), [
    "人工整理数据集",
    "计算维护数据集",
    "按物种划分的数据集",
    "突变数据集"
  ]);
  const doc2 = run(FX.DL_DISCLAIMER);
  assert.equal(
    text(doc2.querySelector("p")),
    "免责声明：在新的网站实现数据集检索功能期间，数据集检索结果仍显示在旧网站上。"
  );
});

test("必须保持英文：论文题录、MI 术语、登录号、物种拉丁名、数据集名", () => {
  const doc = run(FX.KEEP_EN);
  const ps = [...doc.querySelectorAll("p")].map(text);
  assert.equal(
    ps[0],
    "Multiplexed mapping of the interactome of GPCRs with receptor activity-modifying proteins - Thomas Sakmar et al., (2024)"
  );
  assert.equal(ps[1], "IntAct curation assigns MI:0811 to every interaction of type proximity.");
  assert.equal(ps[2], "Target P04637 was curated from EBI-1234567 in Synechocystis sp. PCC 6803.");
  assert.equal(ps[3], "Affinomics");
});
