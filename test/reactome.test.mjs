// Reactome 站点词库（reactome）回归：站点骨架 / 检索页 / 通路详情 / 下载页 / 通路浏览器图例与交互控件
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

// config/sites.json 尚未收录 reactome.org 时用下面这份等价配置跑（见交付报告里的建议条目）。
const site =
  sites.find((s) => (s.hosts || []).includes("reactome.org")) || {
    id: "reactome",
    hosts: ["reactome.org"],
    dicts: ["common", "reactome"],
    scope: "body",
    spa: true,
    // .highlighting = 检索词高亮片段（用户查询原文），属于数据，整块不翻
    skip: ".highlighting",
    proseExempt: "#cookie-banner, #citationModal, .read-more, .summation, .alert"
  };

const data = {
  exact: Object.assign({}, common.exact, book.exact),
  rules: [].concat(common.rules || [], book.rules),
  templates: [].concat(common.templates || [], book.templates)
};

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

test("词库结构：条数、键值形态、规则可编译、模板槽位连续", () => {
  assert.equal(book.meta.family, "reactome");
  assert.ok(book.meta.sites.includes("reactome.org"));
  assert.ok(Object.keys(book.exact).length >= 400, "exact 至少 400 条");
  assert.ok(book.rules.length >= 15, "rules 至少 15 条");
  assert.ok(Array.isArray(book.templates) && book.templates.length >= 4, "templates 至少 4 条");

  const seen = new Set();
  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "键里不能有中文: " + k);
    assert.ok(/[\u4e00-\u9fff]/.test(v) || v === "。", "译文里必须有中文（句末标点例外）: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "键首尾不能有空白: " + JSON.stringify(k));
    assert.equal(v, String(v).trim(), "值首尾不能有空白: " + JSON.stringify(v));
    assert.ok(!seen.has(k), "重复键: " + k);
    seen.add(k);
  }
  for (const r of book.rules) {
    const re = new RegExp(r.re);
    assert.ok(re.source.length > 0);
    assert.ok(/[\u4e00-\u9fff（）]/.test(r.to), "规则译文里必须有中文或全角标点: " + r.re);
    assert.ok(/\$\d/.test(r.to), "带捕获组的规则要用到占位符: " + r.re);
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

test("站点骨架：顶部导航与页脚栏目", () => {
  const doc = run(
    '<header><span class="nav-header">About</span><span>Content</span><span>Docs</span>' +
      "<span>Tools</span><a>Community</a></header>" +
      '<footer><a>What is Reactome ?</a><a>Scientific Advisory Board</a><a>Editorial Calendar</a>' +
      "<a>Release Calendar</a><a>Our Logo</a><a>Privacy Notice</a><a>Digital Preservation</a>" +
      "<a>Table of Contents</a><a>Data Schema</a><a>ORCID Integration Project</a>" +
      "<a>Userguide</a><a>Developer's Zone</a><a>Icon Info</a><a>Data Model</a>" +
      "<a>Curator Guide</a><a>Release Documentation</a><a>Linking to Us</a></footer>"
  );
  const headers = [...doc.querySelectorAll("header > *")].map(text);
  assert.deepEqual(headers.slice(0, 5), ["关于", "内容", "文档", "工具", "社区"]);
  const links = [...doc.querySelectorAll("footer a")].map(text);
  assert.deepEqual(links, [
    "Reactome 是什么？",
    "科学顾问委员会",
    "编辑日历",
    "发布日历",
    "我们的标识",
    "隐私声明",
    "数字保存",
    "目录",
    "数据模式",
    "ORCID 集成项目",
    "用户指南",
    "开发者专区",
    "图标说明",
    "数据模型",
    "策展人指南",
    "发布文档",
    "链接到我们"
  ]);
});

test("首页：检索框标题、按钮、三张工具卡与统计标签", () => {
  const doc = run(
    '<div><h3>Find Reactions, Proteins and Pathways</h3><button>Go!</button></div>' +
      '<div class="card"><a>Pathway Browser</a><p>Visualize and interact with Reactome biological pathways</p></div>' +
      '<div class="card"><a>Analysis Tools</a><p>Merges pathway identifier mapping, <br> over-representation, and expression analysis</p></div>' +
      '<div class="card"><a>Documentation</a><p>Information to browse the database and use its principal tools for data analysis</p></div>' +
      "<div><b>Human Pathways</b><b>Reactions</b><b>Proteins</b><b>Small Molecules</b><b>Drugs</b><b>Literature References</b></div>"
  );
  assert.equal(text(doc.querySelector("h3")), "检索反应、蛋白质与通路");
  assert.equal(text(doc.querySelector("button")), "执行！");
  const cards = [...doc.querySelectorAll(".card")].map(text);
  assert.equal(cards[0].replace(/\s+/g, ""), "通路浏览器可视化并与Reactome生物通路交互");
  assert.equal(cards[1].replace(/\s+/g, ""), "分析工具整合通路标识符映射、过表征分析与表达分析");
  assert.equal(cards[2].replace(/\s+/g, ""), "文档浏览数据库并使用其主要分析工具的相关信息");
  const stats = [...doc.querySelectorAll("b")].map(text);
  assert.deepEqual(stats, ["人类通路", "反应", "蛋白质", "小分子", "药物", "文献引用"]);
});

test("检索结果页：标题/Showing/总数模板 + 计数与分页规则", () => {
  const doc = run(
    "<h2>Search results for <span class=\"searchterm\">cell cycle</span></h2>" +
      "<p>Showing <strong>30</strong> results out of <strong>12617</strong></p>" +
      "<span class=\"total-range\">(30 results from a total of 12617)</span>" +
      "<label>Reaction (6143)</label>" +
      "<label>Entries without species (118)</label>" +
      "<label>Homo sapiens (7900)</label>" +
      "<div>Filter your results (30 of 12617)</div>" +
      "<p>Page 1 of 3</p>"
  );
  assert.equal(text(doc.querySelector("h2")), "“cell cycle”的检索结果");
  assert.equal(text(doc.querySelectorAll("p")[0]), "共 12617 条结果，当前显示 30 条");
  assert.equal(text(doc.querySelector(".total-range")), "（显示 30 条，共 12617 条）");
  const labels = [...doc.querySelectorAll("label")].map(text);
  assert.deepEqual(labels, ["反应（6143）", "无物种条目（118）", "Homo sapiens (7900)"], "物种拉丁名与计数保持原样");
  assert.equal(text(doc.querySelector("div")), "筛选结果（显示 30 条，共 12617 条）");
  assert.equal(text(doc.querySelectorAll("p")[1]), "第 1 页，共 3 页");
});

test("检索页枚举：结果类型与反应类型（固定枚举值）", () => {
  const doc = run(
    "<div>" +
      ["Reaction", "Pathway", "Protein", "Complex", "Set", "Icon", "Interactor", "RNA Sequence",
        "Genes and Transcripts", "Drug", "Chemical Compound", "Cell", "Polymer", "OtherEntity", "DNA Sequence"]
        .map((s) => "<label>" + s + "</label>").join("") +
      "</div>" +
      "<div>" +
      ["binds", "transports", "phosphorylates", "regulates", "activates", "cleaves", "translocates",
        "ubiquitinates", "dephosphorylates", "deubiquitinates", "co-transports"]
        .map((s) => "<label>" + s + "</label>").join("") +
      "</div>"
  );
  const groups = [...doc.querySelectorAll("div")].map((d) => [...d.querySelectorAll("label")].map(text));
  assert.deepEqual(groups[0], [
    "反应", "通路", "蛋白质", "复合物", "集合", "图标", "相互作用分子", "RNA 序列",
    "基因与转录本", "药物", "化合物", "细胞", "聚合物", "其他实体", "DNA 序列"
  ]);
  assert.deepEqual(groups[1], [
    "结合", "转运", "磷酸化", "调控", "激活", "切割", "易位",
    "泛素化", "去磷酸化", "去泛素化", "协同转运"
  ]);
});

test("通路详情页：字段名、参与者/事件分区与内联链接模板", () => {
  const doc = run(
    '<div><span>Stable Identifier</span><span>R-HSA-1640170</span>' +
      "<span>Type</span><span>Pathway</span><span>ReviewStatus</span><span>5/5</span>" +
      "<span>Locations in the PathwayBrowser</span></div>" +
      '<div class="text-center"><span style="font-size: smaller">Click the image above or ' +
      '<a href="/PathwayBrowser/#/R-HSA-1640170">here</a> to open this pathway in the Pathway Browser</span></div>' +
      "<h3>Participants</h3><h3>Events</h3><h3>Event Information</h3>" +
      "<div>Go Biological Process</div><div>Orthologous Events</div>" +
      '<a title="Read more details">5/5</a>' +
      '<a title="Export diagram to SBML">SBML</a><a title="Export diagram to PDF">PDF</a>' +
      '<a title="Open \'Cell Cycle\' in the Pathway Browser">open</a>' +
      '<a title="goto Reactome Pathway Browser">goto</a>'
  );
  const spans = [...doc.querySelectorAll("span")].map(text);
  assert.deepEqual(spans.slice(0, 6), ["稳定标识符", "R-HSA-1640170", "类型", "通路", "审核状态", "5/5"]);
  assert.equal(spans[6], "在通路浏览器中的位置");
  assert.equal(spans[7], "点击上方图片或此处在通路浏览器中打开该通路");
  assert.equal(doc.querySelector("span a").getAttribute("href"), "/PathwayBrowser/#/R-HSA-1640170", "链接不能丢");
  const heads = [...doc.querySelectorAll("h3")].map(text);
  assert.deepEqual(heads, ["参与者", "活动", "事件信息"]);
  const divs = [...doc.querySelectorAll("div")].map(text);
  assert.deepEqual(divs.slice(-2), ["GO 生物学过程", "同源事件"]);
  const as = [...doc.querySelectorAll("a")].slice(1);
  assert.deepEqual(as.map((a) => a.getAttribute("title")), [
    "阅读更多详情",
    "将图导出为 SBML",
    "将图导出为 PDF",
    "在通路浏览器中打开「Cell Cycle」",
    "前往 Reactome 通路浏览器"
  ]);
});

test("下载页：栏目标题、映射条目、版本与弃用说明", () => {
  const doc = run(
    "<h1>Downloads</h1>" +
      "<h3>Services and Repositories</h3>" +
      "<a>Zenodo Repository</a><a>GitHub Repository</a>" +
      "<h3>Database</h3><div>Reactome Knowledge Graph</div>" +
      "<h3>Mapping Files</h3><div>Identifier mapping files</div>" +
      "<div>Lowest level pathway diagram / Subset of the pathway</div>" +
      "<h3>Other Mappings</h3><a>BioModels to Pathways</a><a>Reactome to OMIM</a>" +
      "<div>Human Pathways with Entity-level Diagrams</div>" +
      "<h3>Ontology Files</h3><h3>Systems Biology Formats</h3>" +
      "<div>BioPAX level 3</div>" +
      '<p>As of Reactome V94, the “Events in BioPAX level 2 format" will no longer be available.</p>' +
      "<p>As of Reactome V94, the “Protégé 2.0 ontology files” will no longer be available.</p>" +
      "<div>Version 2026</div><div>Version 2021</div>" +
      '<p>Please contact the Reactome <span id="cloak"><a href="mailto:help@reactome.org">Helpdesk</a></span> if you have questions about the files.</p>' +
      "<div><strong>Total: <span>50</span> results found.</strong></div>"
  );
  assert.equal(text(doc.querySelector("h1")), "下载");
  const h3 = [...doc.querySelectorAll("h3")].map(text);
  assert.deepEqual(h3, ["服务与仓库", "数据库", "映射文件", "其他映射", "本体文件", "系统生物学格式"]);
  const as = [...doc.querySelectorAll("a")].map(text);
  assert.deepEqual(as.slice(0, 2), ["Zenodo 仓库", "GitHub 仓库"]);
  const divs = [...doc.querySelectorAll("div")].map(text);
  assert.ok(divs.includes("Reactome 知识图谱"));
  assert.ok(divs.includes("标识符映射文件") === false || true);
  assert.ok(divs.includes("标识符映射文件"));
  assert.ok(divs.includes("最底层的通路图 / 通路的子集"));
  assert.ok(divs.includes("带实体级通路图的人类通路"));
  assert.ok(divs.includes("BioPAX 第 3 级"));
  assert.ok(divs.includes("版本 2026") && divs.includes("版本 2021"));
  const ps = [...doc.querySelectorAll("p")].map(text);
  assert.equal(ps[0], "自 Reactome V94 起，不再提供“BioPAX 第 2 级格式的事件”。");
  assert.equal(ps[1], "自 Reactome V94 起，不再提供“Protégé 2.0 本体文件”。");
  assert.equal(ps[2], "如有疑问，请联系 Reactome 帮助台。");
  assert.equal(doc.querySelector("p a").getAttribute("href"), "mailto:help@reactome.org", "邮箱链接不能改");
  assert.equal(text(doc.querySelectorAll("div")[divs.length - 1]), "共 50 条结果。");
});

test("旧版通路浏览器：工具栏 title、面板标签与版本/发布规则", () => {
  const doc = run(
    '<a title="Back to homepage">home</a>' +
      '<a title="Pathway Browser version 3.7">3.7</a>' +
      '<a title="Reactome database release 98">98</a>' +
      '<button title="show/hide hierarchy panel"></button>' +
      '<button title="show/hide details panel"></button>' +
      '<button title="expand/minimise centre display"></button>' +
      '<button title="Starts the tour..."></button>' +
      '<button title="Get Citation..."></button>' +
      '<button title="Open beta version of the current page"></button>' +
      '<div title="Zoom in"></div><div title="Zoom out"></div>' +
      '<div title="Move up"></div><div title="Move left"></div><div title="Move right"></div><div title="Move down"></div>' +
      '<div title="Show/Hide settings"></div><div title="Colour Profiles"></div>' +
      '<div title="Pathway overview key"></div><div title="Export diagram"></div><div title="Diagram key"></div>' +
      '<div title="Select IntAct as a resource"></div>' +
      '<div title="ZINC is not currently available"></div>' +
      '<div title="Use this slider to set the confidence threshold"></div>' +
      '<div title="Search only in the displayed diagram"></div>' +
      "<div>Loading hierarchy for Homo sapiens</div>" +
      "<div>Id: R-HSA-1640170.5</div>"
  );
  const titles = [...doc.querySelectorAll("[title]")].map((e) => e.getAttribute("title"));
  assert.deepEqual(titles.slice(3, 9), [
    "显示/隐藏层级面板",
    "显示/隐藏详情面板",
    "展开/最小化中央显示区",
    "开始导览……",
    "获取引用信息……",
    "打开当前页面的 Beta 版本"
  ]);
  assert.deepEqual(titles.slice(9, 21), [
    "放大", "缩小", "上移", "左移", "右移", "下移",
    "显示/隐藏设置", "配色方案", "通路总览图例", "导出图", "图例说明",
    "选择 IntAct 作为数据源"
  ]);
  assert.equal(titles[21], "ZINC 目前不可用");
  assert.equal(titles[22], "使用此滑块设置置信度阈值");
  assert.equal(titles[23], "仅在当前显示的图中检索");
  const divs = [...doc.querySelectorAll("div")].map(text);
  assert.deepEqual(divs.slice(-2), ["正在加载 Homo sapiens 的层级结构", "编号：R-HSA-1640170.5"]);
});

test("Beta 通路浏览器：图例、箭头说明、缩放与折叠控件", () => {
  const doc = run(
    "<div><span>LEGEND</span><span>Arrow Type</span><span>Motion</span><span>Process</span>" +
      "<span>Inhibition</span><span>Transformation</span><span>Disease Modifiers</span>" +
      "<span>Not happening</span><span>Disease related</span>" +
      "<span>Qualitative</span><span>Quantitative</span></div>" +
      '<img alt="indication arrow"><img alt="motion arrow"><img alt="process arrow">' +
      '<img alt="inhibition arrow"><img alt="transformation arrow">' +
      '<img alt="not happening arrow"><img alt="disease-related arrow">' +
      '<div><span>Zoom</span><span>Fit to screen</span><span>Expand all</span><span>Collapse all</span>' +
      "<span>Expand one</span><span>Collapse one</span><span>Select all</span><span>Unselect all</span></div>" +
      '<button aria-label="Toggle Cell Cycle"></button>' +
      '<a title="Navigate to R-HSA-69620">n</a><a title="Open origin of R-HSA-69620">o</a>' +
      "<div>Switch to dark mode</div><div>Open former Pathway Browser</div>" +
      "<div>Send feedback for the beta version</div><div>Details page</div><div>Stable identifier</div>"
  );
  const spans = [...doc.querySelectorAll("span")].map(text);
  assert.deepEqual(spans.slice(0, 11), [
    "图例", "箭头类型", "运动", "过程", "抑制", "转化", "疾病修饰", "未发生", "疾病相关", "定性", "定量"
  ]);
  assert.deepEqual([...doc.querySelectorAll("img")].map((e) => e.getAttribute("alt")), [
    "表示箭头", "运动箭头", "过程箭头", "抑制箭头", "转化箭头", "未发生箭头", "疾病相关箭头"
  ]);
  assert.deepEqual(spans.slice(11), ["缩放", "适应屏幕", "全部展开", "全部收起", "展开一项", "折叠一项", "全选", "取消全选"]);
  assert.equal(doc.querySelector("button").getAttribute("aria-label"), "展开或折叠 Cell Cycle");
  assert.equal(doc.querySelector("a").getAttribute("title"), "跳转到 R-HSA-69620");
  assert.equal(doc.querySelectorAll("a")[1].getAttribute("title"), "打开 R-HSA-69620 的原始事件");
  const divs = [...doc.querySelectorAll("div")].map(text);
  assert.deepEqual(divs.slice(-5), ["切换到深色模式", "打开旧版通路浏览器", "发送 Beta 版本反馈", "详情页", "稳定标识符"]);
});

test("数据不动：物种拉丁名、通路名、标识符、邮箱、评分", () => {
  const doc = run(
    '<table class="data"><tr>' +
      "<td>Homo sapiens</td><td>Mus musculus</td><td>Cell Cycle</td><td>Cell Cycle Checkpoints</td>" +
      "<td>R-HSA-1640170</td><td>cell cycle (0007049)</td><td>help@reactome.org</td>" +
      "<td>5/5</td><td>R-HSA-1640170.5</td><td>Matthews, L (2011-10-10)</td><td>P04637</td>" +
      "</tr></table>"
  );
  assert.deepEqual([...doc.querySelectorAll("td")].map(text), [
    "Homo sapiens", "Mus musculus", "Cell Cycle", "Cell Cycle Checkpoints",
    "R-HSA-1640170", "cell cycle (0007049)", "help@reactome.org",
    "5/5", "R-HSA-1640170.5", "Matthews, L (2011-10-10)", "P04637"
  ]);
});

test("正文保护：长摘要不翻，proseExempt 命中的推测说明翻首句", () => {
  const longProse =
    "The replication of the genome and the subsequent segregation of chromosomes into daughter cells are controlled by a series of events collectively known as the cell cycle. DNA replication is carried out during a discrete temporal period known as the S (synthesis)-phase, and chromosome segregation occurs during a massive reorganization to cellular architecture at mitosis.";
  const doc = run(
    "<p>" + longProse + "</p>" +
      '<div class="summation">This event has been computationally inferred from an event that has been demonstrated in another species.' +
      '<p>The inference is based on the homology mapping from PANTHER. Briefly, reactions for which all i<a href="#" class="read-more">… Read more</a></p></div>' +
      '<div class="alert alert-warning"><strong>Warning!</strong> Unable to extract citation. Please try again later.</div>'
  );
  assert.equal(text(doc.querySelector("p")), longProse, "通路正文整段保持英文");
  const sum = doc.querySelector(".summation");
  assert.equal(
    sum.firstChild.nodeValue.trim(),
    "该事件是根据已在其他物种中证实的事件计算推断而来的。"
  );
  assert.equal(text(sum.querySelector("a")), "… 阅读更多", "proseExempt 内的 read-more 链接要翻");
  assert.equal(text(doc.querySelector(".alert")), "警告！无法提取引用信息，请稍后重试。");
});

test("属性通道：placeholder/title/aria-label 翻译，value/name/href 不动", () => {
  const doc = run(
    '<input placeholder="Search protein, gene, pathway, reaction" name="q" value="cell cycle">' +
      '<input placeholder="Search for a term, e.g. pten ..." name="term" value="pten">' +
      '<a href="/PathwayBrowser/#/R-HSA-1640170" title="Open pathway diagram">open</a>' +
      '<button aria-label="Toggle Cell Cycle" title="Zoom in"></button>'
  );
  const inputs = [...doc.querySelectorAll("input")];
  assert.equal(inputs[0].getAttribute("placeholder"), "检索蛋白质、基因、通路、反应");
  assert.equal(inputs[0].getAttribute("name"), "q");
  assert.equal(inputs[0].getAttribute("value"), "cell cycle", "输入框默认值（数据）不能翻");
  assert.equal(inputs[1].getAttribute("placeholder"), "检索词，例如 pten ……");
  const a = doc.querySelector("a");
  assert.equal(a.getAttribute("title"), "打开通路图");
  assert.equal(a.getAttribute("href"), "/PathwayBrowser/#/R-HSA-1640170");
  const btn = doc.querySelector("button");
  assert.equal(btn.getAttribute("aria-label"), "展开或折叠 Cell Cycle");
  assert.equal(btn.getAttribute("title"), "放大");
});

// 下面这段 HTML 逐字取自 https://reactome.org/content/query?q=cell%20cycle 的真实结果卡片
// （h4.title + div.result-detail + div.summation），用来锁住「数据不动、骨架翻」的实际形态。
test("真实页面片段：检索结果卡片（图标 title、通路名、字段名、长摘要保护）", () => {
  const doc = run(
    '<div class="result-title"><h4 class="title">' +
      '<i class="sprite-resize sprite sprite-TopLevelPathway" title="TopLevelPathway"></i>' +
      '<a href="./detail/R-HSA-1640170" class="" title="Show Details"><span class="highlighting">Cell</span> <span class="highlighting">Cycle</span></a>' +
      "</h4></div>" +
      '<div class="result-detail">' +
      '<div class="favth-col-xs-12"><div><strong>Identifier: </strong>R-HSA-1640170</div></div>' +
      '<div class="favth-col-xs-12"><div><strong>Species: </strong>Homo sapiens</div></div>' +
      "</div>" +
      '<div class="favth-col-xs-12 summation">The replication of the genome and the subsequent segregation of chromosomes into daughter cells are controlled by a series of events collectively known as the <b><span class="highlighting">cell</span> <span class="highlighting">cycle</span></b>. DNA replication is carried ou<a href="#" class="read-more">… Read more</a></div>'
  );

  const link = doc.querySelector("h4.title a");
  assert.equal(text(link), "Cell Cycle", "通路名是数据，保持英文");
  assert.equal(link.getAttribute("title"), "显示详情");
  assert.equal(link.getAttribute("href"), "./detail/R-HSA-1640170", "链接目标不动");
  assert.equal([...doc.querySelectorAll("h4.title .highlighting")].map(text).join(" "), "Cell Cycle", "检索高亮片段不拆不改");
  assert.equal(doc.querySelector("i.sprite").getAttribute("title"), "TopLevelPathway", "图标 sprite 名是内部类名，不翻");

  const labels = [...doc.querySelectorAll(".result-detail strong")].map(text);
  assert.deepEqual(labels, ["标识符：", "物种："]);
  const values = [...doc.querySelectorAll(".result-detail strong")].map((s) => s.nextSibling.nodeValue.trim());
  assert.deepEqual(values, ["R-HSA-1640170", "Homo sapiens"]);

  const sum = doc.querySelector(".summation");
  assert.match(sum.textContent, /^The replication of the genome/, "长摘要受 prose 保护，整段保持英文");
  assert.equal(text(sum.querySelector("a")), "… 阅读更多");
});
