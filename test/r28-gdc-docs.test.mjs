// GDC 文档站（dict/gdc-docs.json）词库校验 + 引擎行为测试
// 覆盖：主页顶栏/主导航、首页三段卡片（strong 拼接的模板）、/about-gdc 正文与 FAQ、
// /about-data 数据类型清单（带链接的 li 模板）、/access-data、/submit-data、/support，
// 以及 <title> 的「X | NCI Genomic Data Commons」规则、属性通道（alt / title）、sr-only 文本。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const load = (n) => JSON.parse(fs.readFileSync(path.join(root, "../dict/" + n + ".json"), "utf8"));
const dict = load("gdc-docs");
const gdcDict = load("gdc");
const gdc2Dict = load("gdc2");
const commonDict = load("common");
const oncoDict = load("onco");
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "gdc-docs");

const URL_HOME = "https://gdc.cancer.gov/";
// 与运行时一致：common/onco/spa/gdc/gdc2 + 本册
const data = {
  exact: {
    ...commonDict.exact,
    ...oncoDict.exact,
    ...gdcDict.exact,
    ...gdc2Dict.exact,
    ...dict.exact
  },
  rules: [
    ...(commonDict.rules || []),
    ...(oncoDict.rules || []),
    ...(gdcDict.rules || []),
    ...(gdc2Dict.rules || []),
    ...(dict.rules || [])
  ],
  templates: [
    ...(gdcDict.templates || []),
    ...(gdc2Dict.templates || []),
    ...(dict.templates || [])
  ]
};

function mount(html, url = URL_HOME) {
  const dom = new JSDOM(html, { url });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return { doc: dom.window.document, engine };
}

// ---------------- 结构校验 ----------------

test("词库可解析，属于 gdc 家族，挂 gdc.cancer.gov，三类容器齐备", () => {
  assert.equal(dict.meta.family, "gdc");
  assert.ok(dict.meta.sites.includes("gdc.cancer.gov"), "sites 必须含 gdc.cancer.gov");
  assert.ok(site, "config/sites.json 里应存在 gdc-docs 站点");
  assert.equal(site.hosts[0], "gdc.cancer.gov");
  assert.ok(Object.keys(dict.exact).length >= 150, "exact 条数应 >= 150");
  assert.ok(dict.rules.length >= 6);
  assert.ok(dict.templates.length >= 12);
  const total = Object.keys(dict.exact).length + dict.rules.length + dict.templates.length;
  assert.ok(total >= 150, "总条数应 >= 150：" + total);
});

test("顶层导航与分组标题条目存在", () => {
  const pairs = {
    "About the GDC": "关于 GDC",
    "About the Data": "关于数据",
    "Analyze Data": "分析数据",
    "Access Data": "访问数据",
    "Submit Data": "提交数据",
    "For Developers": "面向开发者",
    "Learn About the GDC": "了解 GDC",
    "GDC Organization": "GDC 组织",
    "Any Questions?": "有疑问？",
    "GDC Overview": "GDC 概览",
    "GDC Resources": "GDC 资源",
    "GDC Policies": "GDC 政策",
    "GDC Team": "GDC 团队",
    "Office of Cancer Genomics": "癌症基因组学办公室",
    "GDC FAQs": "GDC 常见问题",
    "Media Inquiries": "媒体咨询",
    "GDC Data Model": "GDC 数据模型",
    "GDC Data Processing": "GDC 数据处理",
    "TCGA Resources": "TCGA 资源",
    "Data Summary": "数据概览",
    "GDC Data Security": "GDC 数据安全",
    "Data Sources": "数据来源",
    "Toggle submenu": "展开子菜单",
    "Launch Data Portal": "打开数据门户"
  };
  for (const [k, v] of Object.entries(pairs)) assert.equal(dict.exact[k], v, "缺条目或译法不一致：" + k);
});

test("key 无中文，value 无明文 URL / 邮箱 / 本机路径", () => {
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "key 含中文：" + k);
    assert.ok(!/https?:\/\/|[\w.+-]+@[\w-]+\.\w+/.test(v), "value 含 URL/邮箱：" + k);
    assert.ok(!/\/mnt\/|\/home\//.test(v), "value 含本机路径：" + k);
    assert.ok(v.trim() === v, "value 有首尾空白：" + k);
    assert.notEqual(k, v, "自映射：" + k);
  }
});

test("规则全部锚定且能编译；模板占位符 1..N 对齐", () => {
  for (const r of dict.rules) {
    assert.ok(r.re.startsWith("^") && r.re.endsWith("$"), "规则未锚定：" + r.re);
    assert.doesNotThrow(() => new RegExp(r.re), "坏正则：" + r.re);
    assert.ok(!/https?:\/\/|[\w.+-]+@[\w-]+\.\w+/.test(r.to), "规则译文含 URL/邮箱：" + r.re);
  }
  for (const t of dict.templates) {
    assert.ok(t.pat && t.zh, "模板缺 pat/zh");
    assert.ok(!/[\u4e00-\u9fff]/.test(t.pat), "模板 pat 含中文：" + t.pat.slice(0, 40));
    assert.ok(/[\u4e00-\u9fff]/.test(t.zh), "模板 zh 不含中文：" + t.pat.slice(0, 40));
    const nums = (s) => (s.match(/\{\{(\d+)\}\}/g) || []).map((x) => Number(x.replace(/\D/g, "")));
    const a = nums(t.pat).sort((x, y) => x - y).join(",");
    const b = nums(t.zh).sort((x, y) => x - y).join(",");
    assert.equal(a, b, "占位符不一致：" + t.pat.slice(0, 60));
    const seq = nums(t.pat).sort((x, y) => x - y);
    seq.forEach((n, i) => assert.equal(n, i + 1, "pat 占位符必须从 1 连续：" + t.pat.slice(0, 60)));
  }
});

// ---------------- 规则 ----------------

test("标题规则：X | NCI Genomic Data Commons", () => {
  const r = dict.rules.find((x) => x.re.includes("NCI Genomic Data Commons"));
  assert.ok(r, "缺标题规则");
  const re = new RegExp(r.re);
  const m = re.exec("About the GDC | NCI Genomic Data Commons");
  assert.ok(m, "标题规则应命中 /about-gdc 的标题");
  assert.equal(m[1], "About the GDC");
  assert.equal(r.to.replace(/\$1/g, m[1]), "About the GDC | NCI 基因组数据共享平台");
  assert.equal(re.test("GDC Data Portal"), false, "不该命中普通标题");
});

test("开新窗口提示规则：$1 原样保留 URL", () => {
  const r = dict.rules.find((x) => x.re.includes("opens in a new window"));
  assert.ok(r, "缺 (opens in a new window) 规则");
  const m = new RegExp(r.re).exec("https://www.hhs.gov/ (opens in a new window)");
  assert.ok(m);
  assert.equal(m[1], "https://www.hhs.gov/");
  assert.equal(r.to.replace(/\$1/g, m[1]), "https://www.hhs.gov/（在新窗口中打开）");
});

// ---------------- 引擎行为：导航与属性 ----------------

test("顶栏与主导航整块变中文，链接与按钮结构不动", () => {
  const { doc } = mount(
    '<div class="usa-banner"><div class="usa-banner__header-text">An official website of the United States government</div></div>' +
      '<nav><ul class="tbm-nav level-0">' +
      '<li><div class="tbm-link-container">' +
      '<a href="/about-gdc" class="tbm-link level-1 tbm-toggle">About the GDC</a>' +
      '<button class="tbm-submenu-toggle"><span class="visually-hidden">Toggle submenu</span></button>' +
      "</div>" +
      '<span class="tbm-link level-2 tbm-group-title">Learn About the GDC</span>' +
      '<a href="/about-gdc/gdc-overview" class="tbm-link level-3">GDC Overview</a>' +
      '<a href="/about-gdc/gdc-resources" class="tbm-link level-3">GDC Resources</a>' +
      '<span class="tbm-link level-2 tbm-group-title">Any Questions?</span>' +
      "</li>" +
      '<li><a class="button" href="https://portal.gdc.cancer.gov"><span>Launch Data Portal</span></a></li>' +
      '<li><a href="/about-data" class="tbm-link level-1 tbm-toggle">About the Data</a></li>' +
      '<li><a href="/analyze-data">Analyze Data</a></li>' +
      '<li><a href="/access-data">Access Data</a></li>' +
      '<li><a href="/submit-data">Submit Data</a></li>' +
      '<li><a href="/developers">For Developers</a></li>' +
      "</ul></nav>"
  );
  assert.equal(doc.querySelector(".usa-banner__header-text").textContent, "美国政府官方网站");
  assert.equal(doc.querySelector(".tbm-link.level-1").textContent, "关于 GDC");
  assert.equal(doc.querySelector(".tbm-link.level-1").getAttribute("href"), "/about-gdc");
  assert.equal(doc.querySelector(".visually-hidden").textContent, "展开子菜单");
  assert.equal(doc.querySelector(".tbm-submenu-toggle").tagName, "BUTTON");
  const groups = [...doc.querySelectorAll(".tbm-group-title")].map((e) => e.textContent);
  assert.deepEqual(groups, ["了解 GDC", "有疑问？"]);
  const level3 = [...doc.querySelectorAll(".tbm-link.level-3")].map((e) => e.textContent);
  assert.deepEqual(level3, ["GDC 概览", "GDC 资源"]);
  assert.equal(doc.querySelector('a[href="https://portal.gdc.cancer.gov"] span').textContent, "打开数据门户");
  assert.equal(doc.querySelector('a[href="/about-data"]').textContent, "关于数据");
  assert.equal(doc.querySelector('a[href="/analyze-data"]').textContent, "分析数据");
  assert.equal(doc.querySelector('a[href="/access-data"]').textContent, "访问数据");
  assert.equal(doc.querySelector('a[href="/submit-data"]').textContent, "提交数据");
  assert.equal(doc.querySelector('a[href="/developers"]').textContent, "面向开发者");
});

test("属性通道：动作卡 img alt 与 IFRAME/A[title] 都翻", () => {
  const { doc } = mount(
    "<main>" +
      '<img id="a" src="analyze.svg" alt="Analyze Data">' +
      '<img id="b" src="access.svg" alt="Access Data">' +
      '<img id="c" src="submit.svg" alt="Submit Data">' +
      '<img id="d" src="api.svg" alt="GDC API Icon">' +
      '<a id="e" href="/help" title="GDC Data Transfer Tool User\'s Guide">Data Transfer</a>' +
      '<iframe id="f" title="A Data Sharing Platform to Promote Precision Oncology: The Genomic Data Commons"></iframe>' +
      '<a id="g" href="https://www.hhs.gov/" title="https://www.hhs.gov/ (opens in a new window)">HHS</a>' +
      "</main>"
  );
  assert.equal(doc.getElementById("a").getAttribute("alt"), "分析数据");
  assert.equal(doc.getElementById("b").getAttribute("alt"), "访问数据");
  assert.equal(doc.getElementById("c").getAttribute("alt"), "提交数据");
  assert.equal(doc.getElementById("d").getAttribute("alt"), "GDC API 图标");
  assert.equal(doc.getElementById("e").getAttribute("title"), "GDC 数据传输工具用户指南");
  assert.equal(
    doc.getElementById("f").getAttribute("title"),
    "促进精准肿瘤学的数据共享平台：基因组数据共享平台"
  );
  assert.equal(doc.getElementById("g").getAttribute("title"), "https://www.hhs.gov/（在新窗口中打开）");
});

test("页脚栏目名与 sr-only 面包屑", () => {
  const { doc } = mount(
    "<footer><h2 class=\"block-title\">APPLICATIONS</h2>" +
      '<a class="menu__link" href="/developers/gdc-application-programming-interface-api">API</a>' +
      '<h2 class="block-title">MORE INFORMATION</h2>' +
      '<h2 class="show-for-sr">Breadcrumb</h2>' +
      '<div class="text-sm">NIH... Turning Discovery Into Health ®</div></footer>'
  );
  const titles = [...doc.querySelectorAll(".block-title")].map((e) => e.textContent);
  assert.deepEqual(titles, ["应用", "更多信息"]);
  assert.equal(doc.querySelector(".show-for-sr").textContent, "面包屑导航");
});

// ---------------- 引擎行为：标题 ----------------

test("document.title 走整条规则翻成中文", () => {
  const dom = new JSDOM(
    "<html><head><title>About the GDC | NCI Genomic Data Commons</title></head><body><p>x</p></body></html>",
    { url: "https://gdc.cancer.gov/about-gdc" }
  );
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  assert.equal(dom.window.document.title, "关于 GDC | NCI 基因组数据共享平台");
});

// ---------------- 引擎行为：模板 ----------------

test("首页简介：被 <a> 切开的整段按模板替换，三个链接原位保留", () => {
  const { doc } = mount(
    "<main><p id=\"p1\">The GDC supports several cancer genome programs at the NCI Office of Cancer Genomics (<a href=\"/about-gdc/ocg\">OCG</a>), including The Cancer Genome Atlas (<a href=\"/tcga\">TCGA</a>) and Therapeutically Applicable Research to Generate Effective Treatments (<a href=\"/target\">TARGET</a>).</p></main>"
  );
  const p = doc.getElementById("p1");
  assert.equal(
    p.textContent,
    "GDC 支持 NCI 癌症基因组学办公室（OCG）的多项癌症基因组计划，包括癌症基因组图谱（TCGA）与治疗性适用研究以产生有效疗法（TARGET）。"
  );
  const links = [...p.querySelectorAll("a")];
  assert.equal(links.length, 3, "链接不能丢");
  assert.deepEqual(links.map((a) => a.getAttribute("href")), ["/about-gdc/ocg", "/tcga", "/target"]);
  assert.deepEqual(links.map((a) => a.textContent), ["OCG", "TCGA", "TARGET"]);
});

test("模板按中文语序重排槽位：{{2}} 在 {{1}} 之前", () => {
  const { doc } = mount(
    "<main><ul><li id=\"l1\">Discover the evolution of the GDC in the <a href=\"/podcast\">Genomic Data Commons Podcast</a> in the <a href=\"/nci-podcast\">NCI Personal Genomics Podcast Series</a></li></ul></main>"
  );
  const li = doc.getElementById("l1");
  assert.equal(
    li.textContent,
    "在 NCI 个人基因组学播客系列的基因组数据共享平台播客中了解 GDC 的发展历程"
  );
  const links = [...li.querySelectorAll("a")];
  assert.equal(links.length, 2);
  assert.equal(links[0].textContent, "NCI 个人基因组学播客系列", "第一个链接应是原第二个槽位");
  assert.equal(links[1].textContent, "基因组数据共享平台播客");
  assert.equal(links[0].getAttribute("href"), "/nci-podcast");
});

test("about-data：数据类型 li 模板保留加粗与链接", () => {
  const { doc } = mount(
    "<main><ul>" +
      '<li id="l1"><strong>Post-transcriptional Modifications</strong> - The GDC provides access to mRNA sequence data to assist in identifying post-transcriptional splice modifications that are manifested as splice junction and isoform variants.</li>' +
      '<li id="l2">Data and metadata is submitted to the GDC in <a href="/data-types">standard data types and file formats</a> through the <a href="/pipeline">GDC Data Submission Pipeline</a>. Molecular data stored in the GDC are harmonized against a common reference genome.</li>' +
      "</ul></main>"
  );
  const l1 = doc.getElementById("l1");
  assert.equal(l1.textContent, "转录后修饰 - GDC 提供 mRNA 序列数据，用于协助识别表现为剪接位点与异构体变异的转录后剪接修饰。");
  assert.ok(l1.querySelector("strong"), "加粗节点必须保留");
  const l2 = doc.getElementById("l2");
  assert.equal(
    l2.textContent,
    "数据与元数据以 standard data types and file formats 的形式通过 GDC Data Submission Pipeline 提交到 GDC。GDC 中存储的分子数据会与统一参考基因组进行统一处理。"
  );
  assert.equal(l2.querySelectorAll("a").length, 2);
});

// ---------------- 引擎行为：规则 ----------------

test("三张动作卡的插图说明与发布公告走规则", () => {
  const { doc } = mount(
    "<main>" +
      '<span id="s1">Illustration: Analyze Data</span>' +
      '<span id="s2">Illustration: Access Data</span>' +
      '<span id="s3">Illustration: Submit Data</span>' +
      '<span id="s4">Coming Soon: GDC Data Release 47!</span>' +
      '<a id="s5" href="/news/46">GDC Data Release 46 Adds New Cancer Genomic Datasets</a>' +
      "</main>"
  );
  assert.equal(doc.getElementById("s1").textContent, "插图：分析数据");
  assert.equal(doc.getElementById("s2").textContent, "插图：访问数据");
  assert.equal(doc.getElementById("s3").textContent, "插图：提交数据");
  assert.equal(doc.getElementById("s4").textContent, "即将发布：GDC 数据发布 47！");
  assert.equal(doc.getElementById("s5").textContent, "GDC 数据发布 46 新增癌症基因组数据集");
});

test("» 结尾的文档链接：槽位必须命中词表才替换", () => {
  const { doc } = mount(
    "<main>" +
      '<span id="s1" class="doc-name">GDC Data Transfer Tool User\'s Guide »</span>' +
      '<span id="s2" class="doc-name">GDC Data Portal User\'s Guide »</span>' +
      '<span id="s3">Some Unlisted Handbook »</span>' +
      "</main>"
  );
  assert.equal(doc.getElementById("s1").textContent, "GDC 数据传输工具用户指南 »");
  assert.equal(doc.getElementById("s2").textContent, "GDC 数据门户用户指南 »");
  assert.equal(doc.getElementById("s3").textContent, "Some Unlisted Handbook »", "未收录的文档名保持英文");
});

test("页脚 News - X 只翻已收录的类别", () => {
  const { doc } = mount(
    "<footer>" +
      '<a id="n1" href="/news/access">News - Access Data</a>' +
      '<a id="n2" href="/news/general">News - General GDC</a>' +
      "</footer>"
  );
  assert.equal(doc.getElementById("n1").textContent, "新闻 - 访问数据");
  assert.equal(doc.getElementById("n2").textContent, "新闻 - GDC 综合");
});


test("首页首段：<strong> + <span> 切开的整句各自整条命中", () => {
  const { doc } = mount(
    '<main><p class="text-leading"><strong>The NCI\'s Genomic Data Commons (GDC)</strong> <span>provides the cancer research community with a repository and computational platform for cancer researchers who need to understand cancer, its clinical progression, and response to therapy.</span></p></main>'
  );
  assert.equal(doc.querySelector("strong").textContent, "NCI 的基因组数据共享平台（GDC）");
  assert.equal(
    doc.querySelector("span").textContent,
    "为需要了解癌症、其临床进展与治疗反应的癌症研究者提供数据仓库与计算平台。"
  );
  assert.match(doc.querySelector("p").textContent, /^NCI 的基因组数据共享平台（GDC）\s*为需要了解癌症/);
});

// ---------------- 引擎行为：不误伤 ----------------

test("未收录的正文与数据保持英文，重复扫描不二次替换", () => {
  const { doc, engine } = mount(
    "<main>" +
      '<p id="p1">High Quality Data Sharing Enables Precision Medicine</p>' +
      '<p id="p2">Some sentence that is not in the dictionary at all.</p>' +
      '<table><tr><td id="td">25ab28a6-8841-4048-8950-6ca724320b41.maf.gz</td><td>GRCh38</td></tr></table>' +
      "</main>"
  );
  assert.equal(doc.getElementById("p1").textContent, "高质量数据共享助力精准医学");
  assert.equal(doc.getElementById("p2").textContent, "Some sentence that is not in the dictionary at all.");
  assert.equal(doc.getElementById("td").textContent, "25ab28a6-8841-4048-8950-6ca724320b41.maf.gz");
  engine.scan();
  assert.equal(doc.getElementById("p1").textContent, "高质量数据共享助力精准医学");
  assert.equal(doc.getElementById("p2").textContent, "Some sentence that is not in the dictionary at all.");
});

test("disable 还原英文（模板块挂回原子节点）", () => {
  const { doc, engine } = mount(
    "<main><p id=\"p1\">The GDC supports several cancer genome programs at the NCI Office of Cancer Genomics (<a href=\"/about-gdc/ocg\">OCG</a>), including The Cancer Genome Atlas (<a href=\"/tcga\">TCGA</a>) and Therapeutically Applicable Research to Generate Effective Treatments (<a href=\"/target\">TARGET</a>).</p></main>"
  );
  assert.match(doc.getElementById("p1").textContent, /^GDC 支持/);
  engine.disable();
  assert.match(doc.getElementById("p1").textContent, /^The GDC supports several cancer genome programs/);
  assert.equal(doc.querySelectorAll("#p1 a").length, 3);
});