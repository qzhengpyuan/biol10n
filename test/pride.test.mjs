// PRIDE Archive（www.ebi.ac.uk/pride）词库回归：首页 / 数据集检索与列表 / 数据集详情（字段区、文件表、表头）
// / 帮助文档与提交入口 / 404 与 Cookie 横幅。按 config/sites.json 的真实站点词库栈渲染片段。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/pride.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;

// 站点条目要由维护者在 config/sites.json 里落地；落地前用同一份期望值跑，落地后自动读真实配置。
const FALLBACK_SITE = {
  id: "pride",
  name: "PRIDE Archive",
  hosts: ["www.ebi.ac.uk"],
  path: "^/pride",
  dicts: ["common", "spa", "pride"],
  scope: "body",
  proseExempt: ""
};
const site = sites.find((s) => s.id === "pride") || FALLBACK_SITE;

function loadStack() {
  const exact = {}, rules = [], templates = [];
  for (const id of site.dicts) {
    const b = JSON.parse(fs.readFileSync(path.join(root, "../dict", id + ".json"), "utf8"));
    Object.assign(exact, b.exact || {});
    rules.push(...(b.rules || []));
    templates.push(...(b.templates || []));
  }
  return { exact, rules, templates };
}

function run(html) {
  const dom = new JSDOM(html);
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: loadStack(),
    site: { ...site, rescan: false }
  });
  engine.start();
  return dom.window.document;
}

test("词库结构与站点栈：条数、键值形态、规则可编译、模板槽位连续", () => {
  assert.equal(book.meta.family, "pride");
  assert.equal(book.meta.version, "0.1.0");
  assert.ok(book.meta.sites.includes("www.ebi.ac.uk"));
  assert.ok(Object.keys(book.exact).length >= 200, "exact 至少 200 条");
  assert.ok(book.rules.length >= 20, "rules 至少 20 条");
  assert.ok(Array.isArray(book.templates) && book.templates.length >= 2, "templates 至少 2 条");
  // 站点栈里必须包含本册，且 common 在前（同 key 时公共词库优先）
  assert.ok(site.dicts.includes("pride"), "站点 dicts 必须包含 pride");
  assert.ok(site.dicts.indexOf("common") < site.dicts.indexOf("pride"), "common 要排在 pride 之前");

  const seen = new Set();
  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "键里不能有中文: " + k);
    assert.ok(/[\u4e00-\u9fff]/.test(v), "译文里必须有中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "键首尾不能有空白: " + JSON.stringify(k));
    assert.equal(v, String(v).trim(), "译文首尾不能有空白: " + JSON.stringify(v));
    assert.ok(!/https?:\/\/|@[a-z0-9.-]+\.[a-z]{2,}/i.test(v), "译文不能含网址/邮箱: " + k);
    assert.ok(!seen.has(k), "重复键: " + k);
    seen.add(k);
  }
  for (const r of book.rules) {
    const re = new RegExp(r.re);
    assert.ok(re.source.length > 0);
    assert.ok(/[\u4e00-\u9fff]/.test(r.to), "规则译文里必须有中文: " + r.re);
    assert.ok(/\$\d/.test(r.to), "规则要用到捕获组: " + r.re);
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

test("顶部导航（pride-header）：Archive 下拉、Tools、Help/About 菜单", () => {
  const doc = run(
    '<nav class="menu">' +
      "<a>Home</a><button>Archive</button>" +
      "<a>Datasets</a><a>Affinity proteomics</a><a>Crosslinking</a>" +
      "<a>Single-cell Proteomics</a><a>Spectral libraries</a><a>Proteins</a><a>USI</a>" +
      "<button>Tools</button>" +
      "<a>Submission tool</a><a>Web Submissions</a><a>pMultiQC</a><a>Web service API</a>" +
      "<a>SDRF editor</a><a>SDRF validator</a>" +
      "<button>Help</button><a>Documentation</a><a>Controlled-access submissions</a>" +
      "<a>Submission Files Requirements</a><a>PRIDE Assistant</a>" +
      "<button>About</button><a>About PRIDE</a><a>License</a><a>Contact</a>" +
      "<a>Log in</a><a>Register</a>" +
      "</nav>" +
      '<div class="banner"><span>System Announcements</span><button>Collapse</button></div>'
  );
  const nav = doc.querySelector(".menu");
  const texts = [...nav.querySelectorAll("a,button")].map((e) => e.textContent.trim());
  assert.deepEqual(texts, [
    "首页",
    "数据归档",
    "数据集",
    "亲和蛋白质组学",
    "交联",
    "单细胞蛋白质组学",
    "谱图库",
    "蛋白质",
    "USI",
    "工具",
    "提交工具",
    "网页提交",
    "pMultiQC",
    "Web 服务 API",
    "SDRF 编辑器",
    "SDRF 校验器",
    "帮助",
    "文档",
    "受控访问数据提交",
    "提交文件要求",
    "PRIDE 助手",
    "关于",
    "关于 PRIDE",
    "许可",
    "联系方式",
    "登录",
    "注册"
  ]);
  assert.equal(doc.querySelector(".banner span").textContent, "系统公告");
  assert.equal(doc.querySelector(".banner button").textContent, "收起");
  // 工具名、服务名、机构名保持原文
  assert.equal(nav.querySelectorAll("a")[7].textContent, "USI");
});

test("首页 hero 与 KPI：固定说明句、示例检索词、统计口径", () => {
  const doc = run(
    '<section class="hero">' +
      "<h1>The PRoteomics IDEntifications database</h1>" +
      "<p>Find, share and reuse mass-spectrometry proteomics data — the ProteomeXchange founding member and an ELIXIR Core Data Resource.</p>" +
      '<input placeholder="Search datasets by accession, keyword, protein, organism, disease…" aria-label="Search PRIDE Archive">' +
      "<button>Search</button>" +
      '<div class="hero-examples"><span>Try:</span><button>cancer</button><a>or browse all datasets →</a></div>' +
      '<div class="kpi-strip">' +
      '<a class="kpi" title="Browse all public datasets"><span class="kpi-value">42,822</span><span class="kpi-label">public datasets</span></a>' +
      '<a class="kpi" title="Files in the archive"><span class="kpi-value">3.9 M</span><span class="kpi-label">files</span></a>' +
      '<a class="kpi" title="Total volume submitted"><span class="kpi-value">4.4 PB</span><span class="kpi-label">of data</span></a>' +
      '<a class="kpi"><span class="kpi-value">87</span><span class="kpi-label">countries</span></a>' +
      '<a class="kpi"><span class="kpi-value">873</span><span class="kpi-label">datasets in Oct 2026</span></a>' +
      "</div></section>"
  );
  assert.equal(
    doc.querySelector(".hero p").textContent,
    "查找、共享并复用质谱蛋白质组学数据（ProteomeXchange 创始成员、ELIXIR 核心数据资源）。"
  );
  // 品牌全称按 r21 P2-4 要求译出（PRIDE 是缩写，段落里保留）
  assert.equal(doc.querySelector("h1").textContent, "PRIDE 蛋白质组鉴定数据库");
  assert.equal(doc.querySelector(".hero-examples span").textContent, "试试：");
  assert.equal(doc.querySelector(".hero-examples a").textContent, "或浏览全部数据集 →");
  assert.equal(doc.querySelector("input").getAttribute("placeholder"), "登录号、关键词、蛋白质、物种、疾病……");
  assert.equal(doc.querySelector("input").getAttribute("aria-label"), "检索 PRIDE Archive");
  const labels = [...doc.querySelectorAll(".kpi-label")].map((e) => e.textContent);
  assert.deepEqual(labels, ["公开数据集", "个文件", "数据量", "国家/地区", "2026 年 10 月新增数据集"]);
  const values = [...doc.querySelectorAll(".kpi-value")].map((e) => e.textContent);
  assert.deepEqual(values, ["42,822", "3.9 M", "4.4 PB", "87", "873"], "数值与单位不动");
});

test("首页资源卡、统计区块与质控说明", () => {
  const doc = run(
    '<div class="resource-container">' +
      '<a class="resource"><span class="resource-title">PRIDE Archive</span><span class="resource-desc">Public mass-spectrometry datasets: raw files, results, metadata and sample annotations.</span></a>' +
      '<a class="resource"><span class="resource-title">PRIDE Affinity Proteomics</span><span class="resource-desc">Olink, SomaScan and other affinity-based proteomics datasets.</span></a>' +
      '<a class="resource"><span class="resource-title">Single-cell Proteomics</span><span class="resource-desc">Curated single-cell proteomics datasets with experimental metadata and SDRF guidance.</span></a>' +
      '<a class="resource"><span class="resource-title">PRIDE Archive USI</span><span class="resource-desc">Look up and visualise any spectrum in the archive by its USI.</span></a>' +
      '<a class="resource"><span class="resource-title">PRIDE Crosslinking</span><span class="resource-desc">Crosslinking mass-spectrometry datasets and interaction views.</span></a>' +
      "</div>" +
      '<h2>The archive at a glance</h2><a>All statistics</a>' +
      "<h3>Datasets submitted per month</h3><h3>Organisms, tissues and diseases</h3>" +
      "<h3>Submissions by country</h3><h3>Links to other omics resources</h3><a>Details</a>" +
      "<h2>Data quality across PRIDE</h2>" +
      '<p class="section-sub"> Identification-free QC of 488,449 raw files from 10,555 datasets, computed by <a href="https://github.com/PRIDE-Archive/prideQC">prideQC</a><span> · updated 19 Nov 2026</span></p>' +
      '<div class="qc-cards"><span>Per dataset</span><span>Per raw file</span></div>' +
      '<p class="preview">Preview: these values have not yet had scientific validation.</p>' +
      "<a>All QC statistics</a>" +
      '<dl><dt>Acquisition method</dt><dd>inferred from MS2 isolation windows and cycle structure</dd>' +
      "<dt>MS2 resolution</dt><dd>from repeated-spectrum fragment mass precision</dd>" +
      "<dt>MS1 spectra per run</dt><dd>logarithmic bins</dd>" +
      "<dt>MS2 spectra per run</dt><dd>logarithmic bins</dd>" +
      "<dt>Chromatography duration (min)</dt><dd>retention time span of each run</dd></dl>"
  );
  const titles = [...doc.querySelectorAll(".resource-title")].map((e) => e.textContent);
  assert.deepEqual(titles, [
    "PRIDE Archive",
    "PRIDE 亲和蛋白质组学",
    "单细胞蛋白质组学",
    "PRIDE Archive USI",
    "PRIDE 交联"
  ], "资源名：Archive/USI 是服务名保留原文，其余描述性名称照翻");
  const descs = [...doc.querySelectorAll(".resource-desc")].map((e) => e.textContent);
  assert.equal(descs[0], "公开的质谱蛋白质组学数据集：原始文件、结果、元数据与样本注释。");
  assert.equal(descs[2], "经人工策展的单细胞蛋白质组学数据集，含实验元数据与 SDRF 指南。");
  assert.equal(descs[3], "按 USI 查询并可视化归档中的任意谱图。");
  assert.equal(doc.querySelectorAll("h2")[0].textContent, "归档概览");
  const h3 = [...doc.querySelectorAll("h3")].map((e) => e.textContent);
  assert.deepEqual(h3, ["每月提交的数据集数", "物种、组织与疾病", "按国家/地区统计的提交量", "与其他组学资源的链接"]);
  assert.equal(doc.querySelector("h2 + a").textContent, "全部统计");
  // 长句被 <a> 切开：前半段走规则、日期段各自走规则
  const sub = doc.querySelector(".section-sub");
  assert.equal(
    sub.textContent.trim(),
    "免鉴定质控（488,449 个原始文件、10,555 个数据集），计算工具： prideQC · 更新于 2026 年 11 月 19 日",
    "中文与拉丁字母之间由引擎补空格"
  );
  assert.equal(sub.querySelector("a").getAttribute("href"), "https://github.com/PRIDE-Archive/prideQC", "链接地址不能改");
  assert.deepEqual([...doc.querySelectorAll(".qc-cards span")].map((e) => e.textContent), ["按数据集", "按原始文件"]);
  assert.equal(doc.querySelector(".preview").textContent, "预览：这些数值尚未经过科学验证。");
  const dts = [...doc.querySelectorAll("dt")].map((e) => e.textContent);
  assert.deepEqual(dts, ["采集方式", "MS2 分辨率", "每次运行的 MS1 谱图数", "每次运行的 MS2 谱图数", "色谱时长（分钟）"]);
  const dds = [...doc.querySelectorAll("dd")].map((e) => e.textContent);
  assert.deepEqual(dds, ["由 MS2 隔离窗口与周期结构推断", "由重复谱图的碎片质量精度得出", "对数分箱", "对数分箱", "每次运行的保留时间跨度"]);
});

test("检索页头部与筛选栏：标题规则、facet 名称、搜索框占位符、QC 枚举", () => {
  const doc = run(
    "<h1>Search PRIDE Archive · 42,822 datasets</h1>" +
      '<div class="hero-examples"><span>Try:</span><button>PXD005011</button></div>' +
      "<button>Advanced search</button>" +
      '<aside class="facets">' +
      '<div class="facet-block"><div class="facet-name">Organism</div><input placeholder="Find organism…"></div>' +
      '<div class="facet-block"><div class="facet-name">Tissue / Cell type</div><input placeholder="Find tissue / cell type…"></div>' +
      '<div class="facet-block"><div class="facet-name">Disease</div><input placeholder="Find disease…"></div>' +
      '<div class="facet-block"><div class="facet-name">Experiment type</div></div>' +
      '<div class="facet-block"><div class="facet-name">Instrument</div><input placeholder="Find instrument…"></div>' +
      '<div class="facet-block"><div class="facet-name">Software</div><input placeholder="Find software…"></div>' +
      '<div class="facet-block"><div class="facet-name">Quantification method</div></div>' +
      '<div class="facet-block"><div class="facet-name">Results format</div></div>' +
      '<div class="facet-block"><div class="facet-name">Publication year</div></div>' +
      '<div class="facet-block"><div class="facet-name">Run QC</div><span>preview</span></div>' +
      '<div class="facet-block"><div class="facet-name">Acquisition method</div></div>' +
      '<div class="facet-block"><div class="facet-name">MS2 resolution</div></div>' +
      '<div class="facet-block"><div class="facet-name">Chromatography duration</div></div>' +
      '<div class="facet-block"><div class="facet-name">Experimental design</div></div>' +
      '<div class="facet-block"><div class="facet-name">Project tags</div></div>' +
      '<div class="facet-block"><div class="facet-name">Other omics links</div></div>' +
      '<button class="facet-more">Show more (100)</button>' +
      '<div class="qc">' +
      '<label><span class="facet-value-label">Run QC available</span></label>' +
      "<label><span>Not determined</span></label><label><span>High resolution</span></label><label><span>Low resolution</span></label>" +
      "<label><span>SDRF available</span></label>" +
      "</div></aside>"
  );
  assert.equal(doc.querySelector("h1").textContent, "检索 PRIDE Archive · 42,822 个数据集");
  assert.equal(doc.querySelector(".hero-examples span").textContent, "试试：");
  assert.equal(doc.querySelector(".facet-more").textContent, "显示更多（100）");
  assert.deepEqual(
    [...doc.querySelectorAll(".facet-name")].map((e) => e.textContent),
    [
      "物种",
      "组织/细胞类型",
      "疾病",
      "实验类型",
      "仪器",
      "软件",
      "定量方法",
      "结果格式",
      "出版年份",
      "运行质控",
      "采集方式",
      "MS2 分辨率",
      "色谱时长",
      "实验设计",
      "项目标签",
      "其他组学链接"
    ]
  );
  assert.deepEqual(
    [...doc.querySelectorAll("input")].map((e) => e.getAttribute("placeholder")),
    ["查找物种……", "查找组织/细胞类型……", "查找疾病……", "查找仪器……", "查找软件……"]
  );
  assert.deepEqual(
    [...doc.querySelectorAll(".qc span")].map((e) => e.textContent),
    ["有运行质控", "未确定", "高分辨率", "低分辨率", "有 SDRF"]
  );
});

test("数据集卡片：固定标签翻译，卡片里的数据（标题、物种、人名、日期）不动", () => {
  const doc = run(
    '<div class="ivu-card resource-item"><div class="resource-body">' +
      '<a class="resource-id">PXD087665</a>' +
      '<p class="resource-title">DIA-based plasma proteomic profiling of normal cognition, mild cognitive impairment, and Alzheimer\'s disease</p>' +
      '<p class="species-line"><span class="project-info">Species: </span><button class="species-pill">Homo sapiens (human)</button></p>' +
      '<p class="instrument-line"><span class="project-info">Instrument: </span><button class="instrument-chip">Orbitrap Fusion</button></p>' +
      '<span><span class="project-info">Project Description: </span><span>This dataset contains data-independent acquisition mass spectrometry (DIA-MS) data from plasma samples of 60 individuals, including 20 with normal cognition (NC).</span><a class="more-action">Read more</a></span>' +
      '<p class="people-line"><span class="project-info">Lab Head: </span><button class="person-link">Nariko Arimura</button>' +
      '<span class="project-info">Submitter: </span><button class="person-link">Nariko Arimura</button></p>' +
      '<p><span class="project-info">Made public: </span><span>2026-11-19</span></p>' +
      '<p><span class="project-info">Download Statistics: </span><span>Total Downloads: 0</span></p>' +
      '<p><span class="project-info">Keywords: </span><button class="keyword-chip">Plasma proteomics</button></p>' +
      '<p><span class="project-info">Reference: </span><span>DOI: 10.1038/s41596-021-00616-z</span></p>' +
      "</div></div>"
  );
  const infos = [...doc.querySelectorAll(".project-info")].map((e) => e.textContent.trim());
  assert.deepEqual(infos, [
    "物种",
    "仪器",
    "项目描述：",
    "实验室负责人：",
    "提交者",
    "公开日期：",
    "下载统计：",
    "关键词",
    "参考文献："
  ], "尾部冒号由引擎规范化去掉或换成全角");
  // 数据不动
  assert.equal(doc.querySelector(".resource-id").textContent, "PXD087665");
  assert.equal(doc.querySelector(".species-pill").textContent, "Homo sapiens (human)");
  assert.equal(doc.querySelector(".instrument-chip").textContent, "Orbitrap Fusion");
  assert.equal([...doc.querySelectorAll(".person-link")][0].textContent, "Nariko Arimura");
  assert.ok(doc.querySelector(".resource-title").textContent.startsWith("DIA-based plasma proteomic profiling"), "数据集标题不翻");
  assert.ok(doc.querySelector(".project-info + span").textContent.includes("This dataset contains"), "项目描述正文（长句）保持英文");
  assert.equal(doc.querySelectorAll(".more-action")[0].textContent, "阅读更多", "r21 P2-4：Read more 收为「阅读更多」，与 ucsc 对齐");
  const dateText = [...doc.querySelectorAll("p span")].map((e) => e.textContent.trim()).find((t) => t === "2026-11-19");
  assert.ok(dateText, "日期保持原文");
  assert.ok(doc.body.textContent.includes("总下载次数：0"), "下载计数标签走规则");
  assert.ok(doc.body.textContent.includes("DOI: 10.1038/s41596-021-00616-z"), "DOI 与编号不动");
});

test("列表工具条与分页：视图切换、排序、每页条数、总数", () => {
  const doc = run(
    '<div class="resource-list-title-container">' +
      '<span class="list-title">List of Datasets (42822)</span>' +
      '<span class="view-toggle" role="group" aria-label="Result view">' +
      '<button class="active" title="Card view">Cards</button><button title="Table view">Table</button></span>' +
      '<button>Download JSON</button>' +
      '<span class="toolbar-group"><span class="toolbar-label">Order by</span></span>' +
      '<span class="toolbar-group"><span class="toolbar-label">Sort by</span></span>' +
      "</div>" +
      '<select><option>Relevance</option><option>Submission Date</option><option>Publication Date</option><option>Number of Downloads</option><option>Avg Number of Downloads</option></select>' +
      '<select><option>20 /page</option><option>100 /page</option></select>' +
      '<ul class="ivu-page"><span class="ivu-page-total">Total 42822 items</span>' +
      '<li title="Previous Page"></li><li title="Next Page"></li><li title="Next 5 Pages"></li></ul>'
  );
  assert.equal(doc.querySelector(".list-title").textContent, "数据集列表（42822）");
  assert.deepEqual([...doc.querySelectorAll(".view-toggle button")].map((e) => e.textContent), ["卡片", "表格"]);
  assert.equal(doc.querySelector(".view-toggle button").getAttribute("title"), "卡片视图");
  assert.equal(doc.querySelector(".view-toggle").getAttribute("aria-label"), "结果视图");
  assert.equal(doc.querySelectorAll("button")[2].textContent, "下载 JSON");
  assert.deepEqual([...doc.querySelectorAll(".toolbar-label")].map((e) => e.textContent), ["排序依据", "排序方式"]);
  assert.deepEqual(
    [...doc.querySelectorAll("select")[0].querySelectorAll("option")].map((e) => e.textContent),
    ["相关度", "提交日期", "出版日期", "下载次数", "平均下载次数"]
  );
  assert.deepEqual(
    [...doc.querySelectorAll("select")[1].querySelectorAll("option")].map((e) => e.textContent),
    ["20 条/页", "100 条/页"]
  );
  assert.equal(doc.querySelector(".ivu-page-total").textContent, "共 42822 项");
  assert.deepEqual([...doc.querySelectorAll("li")].map((e) => e.getAttribute("title")), ["上一页", "下一页", "后 5 页"]);
  // value 属性不能动
  assert.equal(doc.querySelectorAll("select")[1].querySelector("option").getAttribute("value"), null);
});

test("数据集详情字段区：Properties 卡片的字段名", () => {
  const doc = run(
    '<div class="ivu-card"><div class="ivu-card-head"><p>Properties</p></div><div class="card-body">' +
      '<div class="property-row"><div class="summary-content-header">Organism</div><button class="species-pill">Erwinia carotovora</button></div>' +
      '<div class="property-row"><div class="summary-content-header">Organism part</div><p>Unknown</p></div>' +
      '<div class="property-row"><div class="summary-content-header">Modification</div><a>monohydroxylated residue</a></div>' +
      '<div class="property-row"><div class="summary-content-header">Instrument</div><a>LTQ Orbitrap Velos</a></div>' +
      '<div class="property-row"><div class="summary-content-header">Software</div><p>Unknown</p></div>' +
      '<div class="property-row"><div class="summary-content-header">Experiment Type</div><p>Bottom-up proteomics</p></div>' +
      '<div class="property-row"><div class="summary-content-header">Quantification</div><p>Unknown</p></div>' +
      '<div class="property-row"><div class="summary-content-header">Other Omics Links</div><p>Unknown</p></div>' +
      '<div class="property-row"><div class="summary-content-header">DOI</div><a href="https://doi.org/10.6019/PXD000001">https://doi.org/10.6019/PXD000001</a></div>' +
      "</div></div>"
  );
  assert.deepEqual(
    [...doc.querySelectorAll(".summary-content-header")].map((e) => e.textContent),
    ["物种", "生物体部位", "修饰", "仪器", "软件", "实验类型", "定量", "其他组学链接", "DOI 号"]
  );
  assert.equal(doc.querySelector(".ivu-card-head p").textContent, "属性");
  // 字段值保持原文
  assert.equal(doc.querySelector(".species-pill").textContent, "Erwinia carotovora");
  assert.deepEqual(
    [...doc.querySelectorAll(".property-row > p, .property-row > a")].map((e) => e.textContent).slice(0, 3),
    ["未知", "monohydroxylated residue", "LTQ Orbitrap Velos"]
  );
  assert.equal(doc.querySelectorAll(".property-row")[8].querySelector("a").getAttribute("href"), "https://doi.org/10.6019/PXD000001");
});

test("详情页文件表：表头、计数、展开全部与类型枚举", () => {
  const doc = run(
    "<h2>Project Files</h2>" +
      "<div>RAW (1), SEARCH (1), PEAK (2), RESULT (1), OTHER (3)</div>" +
      '<div class="files-toolbar"><span>All types</span>' +
      '<a class="files-all-button">View all 9 files</a>' +
      "<span>Download all:</span><button>FTP</button><button>Globus</button></div>" +
      "<table><thead><tr><th>Name</th><th>Type</th><th>Size (M)</th><th>Download</th></tr></thead>" +
      "<tbody><tr><td>TMT_Erwinia_1uLSike_Top10HCD_isol2_45stepped_60min_01.raw</td><td>RAW</td><td>210</td><td>FTP</td></tr></tbody></table>" +
      '<ul class="ivu-page"><span class="ivu-page-total">Total 9 items</span></ul>'
  );
  assert.equal(doc.querySelector("h2").textContent, "项目文件");
  assert.deepEqual([...doc.querySelectorAll("th")].map((e) => e.textContent), ["名称", "类型", "大小（MB）", "下载"]);
  assert.equal(doc.querySelector(".files-all-button").textContent, "查看全部 9 个文件");
  assert.equal(doc.querySelector(".files-toolbar span").textContent, "全部类型");
  assert.equal(doc.querySelector(".ivu-page-total").textContent, "共 9 项");
  // 文件类型枚举、文件名、协议名保持原文
  assert.equal(doc.querySelectorAll("tbody td")[0].textContent, "TMT_Erwinia_1uLSike_Top10HCD_isol2_45stepped_60min_01.raw");
  assert.equal(doc.querySelectorAll("tbody td")[1].textContent, "RAW");
  assert.deepEqual([...doc.querySelectorAll(".files-toolbar button")].map((e) => e.textContent), ["FTP", "Globus"]);
  assert.equal(doc.querySelectorAll("tbody td")[3].textContent, "FTP", "行内传输协议名保持原文");
});

test("详情页 SDRF 区：工具栏计数、开关、类型图例、社区注释整块（模板保留链接）", () => {
  const doc = run(
    '<div class="sdrf-toolbar">' +
      '<span class="sdrf-count">6 samples/runs · 20 columns</span>' +
      '<a class="files-all-button">View full SDRF</a>' +
      '<a class="sdrf-download-link">Download TSV</a>' +
      '<span class="sdrf-legend"><span class="kind-dot"></span> characteristics <span class="kind-dot"></span> comment <span class="kind-dot"></span> factor value </span>' +
      '<label class="sdrf-prefix-toggle"><span class="label">Show prefix</span></label>' +
      "</div>" +
      '<p class="community-sdrf-notice"><i class="notice-icon"></i><span>' +
      "<strong>Annotated by the community.</strong> This sample metadata was contributed by the proteomics community, not by the dataset submitter, and has not been verified by them. " +
      '<a href="#editor">Open it in the SDRF editor</a> · <a href="#correction">contribute a correction</a> · <a href="#problem">report a problem</a>' +
      "</span></p>" +
      '<button class="sdrf-toggle">Hide</button>'
  );
  assert.equal(doc.querySelector(".sdrf-count").textContent, "6 个样本/运行 · 20 列");
  assert.equal(doc.querySelector(".files-all-button").textContent, "查看完整 SDRF");
  assert.equal(doc.querySelector(".sdrf-download-link").textContent, "下载 TSV");
  assert.equal(doc.querySelector(".sdrf-prefix-toggle").textContent.trim(), "显示前缀");
  assert.equal(doc.querySelector(".sdrf-toggle").textContent, "隐藏");
  const notice = doc.querySelector(".community-sdrf-notice span");
  assert.equal(
    notice.textContent.trim(),
    "由社区注释。该样本元数据由蛋白质组学社区贡献，并非由数据集提交者提供，也未经过其核实。在 SDRF 编辑器中打开 · 提交更正 · 报告问题"
  );
  const links = [...notice.querySelectorAll("a")];
  assert.deepEqual(links.map((a) => a.getAttribute("href")), ["#editor", "#correction", "#problem"], "模板替换不能丢链接");
  assert.deepEqual(links.map((a) => a.textContent), ["在 SDRF 编辑器中打开", "提交更正", "报告问题"]);
});

test("帮助文档索引与页面内导航：分组标题、页面目录、上下篇", () => {
  const doc = run(
    '<nav class="doc-nav">' +
      "<h2>Getting started</h2>" +
      '<a class="doc-pagelink">Introduction to PRIDE</a><a class="doc-pagelink">ProteomeXchange</a>' +
      '<a class="doc-pagelink">Frequently asked questions</a><a class="doc-pagelink">Contact us</a>' +
      "<h2>Submitting data</h2>" +
      '<a class="doc-pagelink">How to submit data</a><a class="doc-pagelink">Data submission guidelines</a>' +
      '<a class="doc-pagelink">PRIDE Submission Tool</a><a class="doc-pagelink">Web Submissions portal</a>' +
      '<a class="doc-pagelink">Software-specific recommendations</a><a class="doc-pagelink">Updating an existing dataset</a>' +
      '<a class="doc-pagelink">Uploading large datasets with Globus</a><a class="doc-pagelink">The submission.px file</a>' +
      '<a class="doc-pagelink">Computing file checksums</a><a class="doc-pagelink">Crosslinking datasets</a>' +
      '<a class="doc-pagelink">Submitting controlled-access data</a><a class="doc-pagelink">Linking to other omics data</a>' +
      "<h2>Data formats</h2><a class=\"doc-pagelink\">Supported file formats</a><a class=\"doc-pagelink\">Universal Spectrum Identifier (USI)</a>" +
      "<h2>Policies and citation</h2><a class=\"doc-pagelink\">Data policy</a><a class=\"doc-pagelink\">Usage policy</a><a class=\"doc-pagelink\">Citing PRIDE</a>" +
      "</nav>" +
      '<aside class="on-this-page"><p>ON THIS PAGE</p>' +
      "<a>Overview of the workflow</a><a>What happens after upload</a><a>Prepare the files</a><a>Making the data public</a>" +
      "<a>Questions and answers</a></aside>" +
      '<div class="doc-footer"><a>‹ Previous</a><a>Next ›</a><a>Edit this page on GitHub</a><a>Report a problem</a></div>'
  );
  assert.deepEqual(
    [...doc.querySelectorAll(".doc-nav h2")].map((e) => e.textContent),
    ["入门指南", "提交数据", "数据格式", "政策与引用"]
  );
  const links = [...doc.querySelectorAll(".doc-pagelink")].map((e) => e.textContent);
  assert.equal(links[0], "PRIDE 简介");
  assert.equal(links[1], "ProteomeXchange", "项目名保持原文");
  assert.equal(links[4], "如何提交数据");
  assert.equal(links[10], "使用 Globus 上传大型数据集");
  assert.equal(links[13], "交联数据集");
  assert.equal(links[16], "支持的文件格式");
  assert.equal(links[17], "通用谱图标识符（USI）");
  assert.equal(links[18], "数据政策");
  assert.equal(doc.querySelector(".on-this-page p").textContent, "本页内容");
  assert.deepEqual(
    [...doc.querySelectorAll(".on-this-page a")].map((e) => e.textContent),
    ["流程概览", "上传之后会发生什么", "准备文件", "将数据公开", "常见问题解答"]
  );
  assert.deepEqual(
    [...doc.querySelectorAll(".doc-footer a")].map((e) => e.textContent),
    ["‹ 上一篇", "下一篇 ›", "在 GitHub 上编辑此页", "报告问题"]
  );
});

test("404 与 Cookie 横幅：整句翻译且外链地址不变", () => {
  const doc = run(
    '<main class="not-found"><div class="code">404</div><h1>This page was not found</h1>' +
      "<p>The address may be wrong, or the page may have moved.</p>" +
      "<a>PRIDE home</a><a>Search datasets</a><a>Help</a></main>" +
      '<div id="data-protection-banner"><div class="row">' +
      '<div class="columns medium-8 large-9 white-color">This website requires cookies, and the limited processing of your personal data in order to function. By using the site you are agreeing to this as outlined in our ' +
      '<a href="https://www.ebi.ac.uk/data-protection/privacy-notice/embl-ebi-public-website">Privacy Notice</a> and ' +
      '<a href="https://www.ebi.ac.uk/about/terms-of-use">Terms of Use</a>.</div>' +
      '<div class="columns medium-4 large-3"><a>I agree, dismiss this banner</a></div>' +
      "</div></div>"
  );
  assert.equal(doc.querySelector("h1").textContent, "未找到该页面");
  assert.equal(doc.querySelector("main p").textContent, "地址可能有误，或页面已被移动。");
  assert.deepEqual([...doc.querySelectorAll("main a")].map((e) => e.textContent), ["PRIDE 首页", "检索数据集", "帮助"]);
  const banner = doc.querySelector("#data-protection-banner .white-color");
  assert.equal(
    banner.textContent,
    "本网站需要使用 Cookie 并对你的个人数据作有限处理才能正常运行。继续使用本站即表示你同意我们隐私声明与使用条款中所述的内容。"
  );
  const hrefs = [...banner.querySelectorAll("a")].map((a) => a.getAttribute("href"));
  assert.deepEqual(hrefs, [
    "https://www.ebi.ac.uk/data-protection/privacy-notice/embl-ebi-public-website",
    "https://www.ebi.ac.uk/about/terms-of-use"
  ]);
  assert.equal(doc.querySelector("#data-protection-banner .columns.medium-4 a").textContent, "我同意，关闭此提示");
});

test("计数类文案走规则：文件数、类型计数、分组、按页条数", () => {
  const doc = run(
    "<div>" +
      "<h1>Files of PXD000001</h1>" +
      "<div class='summary'>9 files · 490 MB · EXPERIMENTAL DESIGN (1), OTHER (3), PEAK (2)</div>" +
      "<span>9 shown</span>" +
      "<span>One experiment group</span>" +
      "<span>1 runs · 21 metrics in 39 columns</span>" +
      "<span>Group 1</span>" +
      "<span>1 run</span>" +
      "<span>precursor 9 ppm</span><span>fragment 18 ppm</span>" +
      "<span>Percentile: 100%</span>" +
      "<span>Datasets range from 0 to 720 min</span>" +
      "</div>"
  );
  const texts = [...doc.querySelectorAll("div > span, div > h1, div > div")].map((e) => e.textContent);
  assert.equal(texts[0], "PXD000001 的文件");
  assert.equal(texts[1], "9 个文件 · 490 MB · EXPERIMENTAL DESIGN (1), OTHER (3), PEAK (2)", "类型计数保持原文，只翻计数骨架");
  assert.equal(texts[2], "已显示 9 个");
  assert.equal(texts[3], "一个实验组");
  assert.equal(texts[4], "1 次运行 · 21 项指标，共 39 列");
  assert.equal(texts[5], "第 1 组");
  assert.equal(texts[6], "1 次运行");
  assert.equal(texts[7], "母离子 9 ppm");
  assert.equal(texts[8], "碎片离子 18 ppm");
  assert.equal(texts[9], "百分位：100%");
  assert.equal(texts[10], "数据集范围从 0 到 720 min");
});

test("帮助页说明句与提交入口文案", () => {
  const doc = run(
    "<h1>PRIDE documentation</h1>" +
      "<p>Help pages for the PRIDE Archive: how to submit a dataset, which file formats and metadata are accepted, how to search and download public data, and how to use the PRIDE APIs and tools. Use the filter on the left to find a page quickly.</p>" +
      '<p class="faq">If you cannot find an answer here, check the FAQ or write to pride-support@ebi.ac.uk.</p>' +
      "<h3>How to submit data</h3>" +
      "<ol><li>Register</li><li>Choose Submission Type</li><li>Submit Dataset</li><li>Accessing Private data</li><li>Post-submission</li></ol>" +
      "<div class=\"tool-card\"><h4>Submission Tool</h4><p>PRIDE Submission Tool enables direct user submissions of protein and peptide identification or quantification data, along with the spectra to PRIDE Archive.</p><a>Read more</a></div>" +
      "<a>Web Submissions portal</a>" +
      "<p>Human data that cannot be shared openly? <a>Controlled-access data</a></p>" +
      "<div class=\"steps-note\"><p>The Pride Submission tool allows users to perform the final submission.</p></div>"
  );
  assert.equal(doc.querySelector("h1").textContent, "PRIDE 文档");
  assert.ok(doc.body.textContent.includes("PRIDE Archive 帮助页面：如何提交数据集"));
  assert.ok(doc.body.textContent.includes("如果在这里找不到答案，请查看FAQ"), "邮箱用捕获组保留，不写进词库");
  assert.deepEqual(
    [...doc.querySelectorAll("li")].map((e) => e.textContent),
    ["注册", "选择提交类型", "提交数据集", "访问私有数据", "提交后"]
  );
  assert.equal(doc.querySelector(".tool-card h4").textContent, "提交工具");
  assert.ok(doc.querySelector(".tool-card p").textContent.startsWith("PRIDE 提交工具让用户可直接向 PRIDE Archive 提交"));
  assert.equal([...doc.querySelectorAll("a")].pop().textContent, "受控访问数据");
  assert.ok(doc.body.textContent.includes("人类数据无法公开共享？"));
  assert.equal(doc.querySelector(".steps-note p").textContent, "PRIDE 提交工具让用户完成最终的提交。");
});
