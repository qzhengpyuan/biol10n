// NCBI GDV（Genome Data Viewer）词库校验 + 引擎行为测试
// 覆盖：Configure Page 轨道配置窗口、轨道设置面板、工具/轨道/下载/右键菜单、
// 位置跳转与标记对话框、物种起始页（/gdv/）简介与物种树
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/gdv.json"), "utf8"));
const commonDict = JSON.parse(fs.readFileSync(path.join(root, "../dict/common.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "ncbi-gdv");

const BROWSER = "https://www.ncbi.nlm.nih.gov/gdv/browser/genome/?id=GCF_000001405.40";
const HOME = "https://www.ncbi.nlm.nih.gov/gdv/";

function mount(html, url = BROWSER) {
  const dom = new JSDOM("<main>" + html + "</main>", { url });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: {
      exact: { ...commonDict.exact, ...dict.exact },
      rules: [...commonDict.rules, ...dict.rules],
      templates: dict.templates
    },
    site
  });
  engine.start();
  return dom.window.document.querySelector("main");
}

const text = (el) => (el.textContent || "").replace(/\s+/g, " ").trim();

// ---------------- 结构校验 ----------------

test("词库可解析，三类都有内容，站点范围是 GDV", () => {
  assert.equal(dict.meta.family, "gdv");
  assert.ok(dict.meta.sites.includes("www.ncbi.nlm.nih.gov"));
  assert.ok(Object.keys(dict.exact).length > 80, "exact 条目应多于 80 条");
  assert.ok(dict.rules.length >= 5, "rules 至少 5 条");
  assert.ok(dict.templates.length >= 1, "templates 至少 1 条");
});

test("关键条目存在（配置窗口、菜单、对话框、起始页）", () => {
  const want = {
    "Configure Page": "配置页面",
    "Available Tracks": "可用轨道",
    "Find Tracks": "查找轨道",
    "Custom Data": "自定义数据",
    "Active Tracks": "活动轨道",
    "Click on track to display settings. To re-order tracks, drag and drop track names.":
      "点击轨道即可显示设置。要调整轨道顺序，请拖动轨道名称。",
    "Track legend": "轨道图例",
    "Other settings:": "其他设置：",
    "Show Label": "显示标签",
    "Remove track(s)": "移除轨道",
    "Reset tracks": "重置轨道",
    "Go To": "转到",
    "Flip Strands": "翻转链",
    "BLAST and Primer Search": "BLAST 与引物检索",
    "Select a Range": "选择范围",
    "Zoom On Range": "缩放至所选范围",
    "Configure Track Hubs": "配置轨道集线器",
    "Download GenBank Flat File": "下载 GenBank 平面文件",
    "Enter sequence position or range (possible range formats are 10k-20k, -20--10, -10k:-5, 5 to 515, -1m..1m):":
      "输入序列位置或范围（可用格式：10k-20k、-20--10、-10k:-5、5 to 515、-1m..1m）：",
    "Browse genome": "浏览基因组",
    "Assembly details": "组装详情"
  };
  for (const [k, v] of Object.entries(want)) {
    assert.equal(dict.exact[k], v, "缺少或值不符：" + k);
  }
});

test("rule 正则可编译，且能改写实测原文", () => {
  for (const r of dict.rules) {
    assert.doesNotThrow(() => new RegExp(r.re), "坏正则：" + r.re);
    assert.ok(r.to.length > 0);
  }
  const cat = dict.rules.find((r) => r.re.startsWith("^Category:"));
  assert.ok(new RegExp(cat.re).test("Category: NCBI Genes (55 Items)"), "Category 规则应命中实测原文");
  const enzyme = dict.rules.find((r) => r.re.includes("restriction endonuclease"));
  assert.ok(new RegExp(enzyme.re).test("Acc65I restriction endonuclease recognition and cleavage sites"));
  const settings = dict.rules.find((r) => r.re === "^Track Settings: (.+)$");
  assert.ok(settings, "缺少 Track Settings 规则");
});

test("模板 pat 长度合规、占位符与译文一一对应、原文不含中文", () => {
  for (const t of dict.templates) {
    assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, "pat 长度越界");
    assert.ok(!/[\u4e00-\u9fff]/.test(t.pat), "pat 不该含中文");
    const slots = (t.pat.match(/\{\{\d+\}\}/g) || []).length;
    const used = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
    assert.deepEqual(used, Array.from({ length: slots }, (_, i) => i + 1), "占位符不匹配");
    assert.ok(/[\u4e00-\u9fff]/.test(t.zh), "译文必须是中文");
  }
});

test("key 里没有中文，value 里没有明文 URL / 邮箱", () => {
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "key 含中文：" + k);
    assert.ok(!/https?:\/\/|[\w.+-]+@[\w-]+\.\w+/.test(v), "value 含 URL/邮箱：" + k);
    assert.equal(k, k.trim(), "key 带首尾空白：" + JSON.stringify(k));
  }
  for (const t of dict.templates) {
    assert.ok(!/https?:\/\/|[\w.+-]+@[\w-]+\.\w+/.test(t.zh), "译文含 URL/邮箱");
  }
});

// ---------------- 引擎行为 ----------------

test("Configure Page：标题、四个页签、轨道类别与设置面板全部翻成中文", () => {
  const root = mount(
    '<div class="x-window">' +
      '<div class="x-title-text">Configure Page</div>' +
      '<span class="x-tab-inner">Available Tracks</span>' +
      '<span class="x-tab-inner">Find Tracks</span>' +
      '<span class="x-tab-inner">Custom Data</span>' +
      '<span class="x-tab-inner">Active Tracks</span>' +
      '<span class="x-tab-inner">Genes/Products</span>' +
      '<span class="x-tab-inner">Phenotype and Disease</span>' +
      '<span class="x-tab-inner">Genomic Clones</span>' +
      '<div class="x-autocontainer-innerCt">Click on track to display settings. To re-order tracks, drag and drop track names.</div>' +
      '<span class="x-column-header-text-inner">Track name</span>' +
      '<div class="x-title-text">Track Settings: Sequence</div>' +
      '<a href="#legend">Track legend</a>' +
      '<span class="x-form-item-label-text">Other settings:</span>' +
      '<label class="x-form-cb-label">Show Label</label>' +
      '<label class="x-form-cb-label">Color gaps by type</label>' +
      '<span class="x-btn-inner">Remove track(s)</span>' +
      '<span class="x-btn-inner">Configure</span>' +
      '<span class="x-btn-inner">Reset tracks</span>' +
      "</div>"
  );
  const titles = [...root.querySelectorAll(".x-title-text")].map(text);
  assert.deepEqual(titles, ["配置页面", "轨道设置：序列"]);
  const tabs = [...root.querySelectorAll(".x-tab-inner")].map(text);
  assert.deepEqual(tabs, [
    "可用轨道",
    "查找轨道",
    "自定义数据",
    "活动轨道",
    "基因/产物",
    "表型与疾病",
    "基因组克隆"
  ]);
  assert.equal(text(root.querySelector(".x-autocontainer-innerCt")), "点击轨道即可显示设置。要调整轨道顺序，请拖动轨道名称。");
  assert.equal(text(root.querySelector(".x-column-header-text-inner")), "轨道名称");
  const legend = root.querySelector("a");
  assert.equal(text(legend), "轨道图例");
  assert.equal(legend.getAttribute("href"), "#legend");
  const labels = [...root.querySelectorAll("label")].map(text);
  assert.deepEqual(labels, ["显示标签", "按类型给间隙着色"]);
  const btns = [...root.querySelectorAll(".x-btn-inner")].map(text);
  assert.deepEqual(btns, ["移除轨道", "配置", "重置轨道"]);
  assert.equal(text(root.querySelector(".x-form-item-label-text")), "其他设置：");
});

test("轨道设置面板：渲染选项与基因轨道复选框", () => {
  const root = mount(
    '<div class="x-window"><div class="x-title-text">Track Settings: Sequence</div>' +
      '<span class="x-form-item-label-text">Rendering options:</span>' +
      '<label class="x-form-cb-label">Hide non-coding</label>' +
      '<label class="x-form-cb-label">Hide model transcripts</label>' +
      '<label class="x-form-cb-label">Show only CCDS variants</label>' +
      '<label class="x-form-cb-label">Show only RefSeq or MANE Select</label>' +
      '<label class="x-form-cb-label">Show annotated protein features</label>' +
      "<a href='#x'>What's this?</a>" +
      "</div>"
  );
  const labels = [...root.querySelectorAll("label")].map(text);
  assert.deepEqual(labels, [
    "隐藏非编码",
    "隐藏模型转录本",
    "仅显示 CCDS 变异",
    "仅显示 RefSeq 或 MANE Select",
    "显示已注释的蛋白质特征"
  ]);
  assert.equal(text(root.querySelector(".x-form-item-label-text")), "渲染选项：");
  assert.equal(text(root.querySelector("a")), "这是什么？");
});

test("工具菜单与右键菜单项翻成中文", () => {
  const root = mount(
    '<div class="x-menu">' +
      '<div class="x-menu-item"><a>Go To</a></div>' +
      '<div class="x-menu-item"><a>Flip Strands</a></div>' +
      '<div class="x-menu-item"><a>Set Origin</a></div>' +
      '<div class="x-menu-item"><a>Sequence Text View</a></div>' +
      '<div class="x-menu-item"><a>BLAST and Primer Search</a></div>' +
      "</div>" +
      '<div class="x-menu">' +
      '<div class="x-menu-item"><a>Select a Range</a></div>' +
      '<div class="x-menu-item"><a>Set New Marker At Position</a></div>' +
      '<div class="x-menu-item"><a>Set Sequence Origin At Position</a></div>' +
      '<div class="x-menu-item"><a>Zoom On Range</a></div>' +
      '<div class="x-menu-item"><a>Printer-Friendly (PDF/SVG)</a></div>' +
      "</div>"
  );
  const menus = [...root.querySelectorAll(".x-menu")].map((m) => [...m.querySelectorAll("a")].map(text));
  assert.deepEqual(menus[0], ["转到", "翻转链", "设置原点", "序列文本视图", "BLAST 与引物检索"]);
  assert.deepEqual(menus[1], ["选择范围", "在当前位置设置新标记", "在当前位置设置序列原点", "缩放至所选范围", "适合打印的版本（PDF/SVG）"]);
});

test("轨道菜单与下载菜单", () => {
  const root = mount(
    '<div class="x-menu">' +
      '<div class="x-menu-item"><a>Configure Track Hubs</a></div>' +
      '<div class="x-menu-item"><a>NCBI Recommended Track Sets</a></div>' +
      '<div class="x-menu-item"><a>My NCBI Track Collections</a></div>' +
      '<div class="x-menu-item"><a>Download GenBank Flat File</a></div>' +
      '<div class="x-menu-item"><a>Printer-Friendly PDF/SVG</a></div>' +
      "</div>"
  );
  const items = [...root.querySelectorAll("a")].map(text);
  assert.deepEqual(items, [
    "配置轨道集线器",
    "NCBI 推荐轨道集",
    "我的 NCBI 轨道集合",
    "下载 GenBank 平面文件",
    "适合打印的 PDF/SVG"
  ]);
});

test("位置跳转与新建标记对话框", () => {
  const root = mount(
    '<div class="x-window"><div class="x-title-text">Go to position/range</div>' +
      "<div>Enter sequence position or range (possible range formats are 10k-20k, -20--10, -10k:-5, 5 to 515, -1m..1m):</div>" +
      '<span class="x-btn-inner">Cancel</span></div>' +
      '<div class="x-window"><div class="x-title-text">Set New Marker</div>' +
      '<label>Name</label><label>Pos/Range:</label><label>Color:</label>' +
      '<label class="x-form-cb-label">Lock Marker</label></div>'
  );
  const titles = [...root.querySelectorAll(".x-title-text")].map(text);
  assert.deepEqual(titles, ["转到位置/范围", "设置新标记"]);
  assert.equal(
    text(root.querySelectorAll(".x-window")[0].querySelector("div:nth-child(2)")),
    "输入序列位置或范围（可用格式：10k-20k、-20--10、-10k:-5、5 to 515、-1m..1m）："
  );
  const labels = [...root.querySelectorAll("label")].map(text);
  assert.deepEqual(labels, ["名称", "位置/范围：", "颜色：", "锁定标记"]);
  assert.equal(text(root.querySelector(".x-btn-inner")), "取消");
});

test("起始页简介：链接句走模板，两个链接与 title 属性都保住", () => {
  const root = mount(
    '<div class="content"><p><a href="/genome/gdv/browser/help/" title="More about GDV"><strong>GDV</strong></a>' +
      ' supports the exploration and analysis of <a href="/genome/annotation_euk/" title="More about eukaryotic genome annotation at NCBI">NCBI-annotated</a>' +
      " and selected non-NCBI annotated eukaryotic genome assemblies. Currently, assemblies from over 5190 organisms are available. </p></div>",
    HOME
  );
  const p = root.querySelector("p");
  assert.match(text(p), /^GDV 支持对 NCBI-annotated 以及选定的非 NCBI 注释真核基因组组装进行探索与分析。/);
  assert.match(text(p), /目前共有超过 5190 个物种的组装可用。$/);
  assert.equal(p.querySelectorAll("a").length, 2);
  assert.equal(p.querySelector("a").getAttribute("href"), "/genome/gdv/browser/help/");
  assert.equal(p.querySelectorAll("a")[1].getAttribute("href"), "/genome/annotation_euk/");
  assert.equal(p.querySelector("a").getAttribute("title"), "关于 GDV");
  assert.equal(p.querySelectorAll("a")[1].getAttribute("title"), "关于 NCBI 的真核基因组注释");
});

test("起始页：组装卡片链接、字段标签与物种树俗名", () => {
  const root = mount(
    '<div class="genome-overview"><h4><a href="/datasets/genome/?taxon=9606">Homo sapiens (human)</a></h4></div>' +
      '<a href="/gdv/browser/genome/?id=GCF_000001405.40">Browse genome</a>' +
      '<a href="/cgv/9606">Comparative Genomics</a>' +
      "<div>Assembly details</div>" +
      "<div>RefSeq accession</div><div>GenBank accession</div>" +
      '<ul><li>brewer\'s yeast</li><li>maize</li><li>rice</li><li>zebrafish</li><li>fruit fly</li><li>chicken</li><li>domestic cattle</li></ul>' +
      '<div id="tip">To view more organisms in the tree, click on nodes that have \'+\' signs. Press and hold the \'+\' to expand and reveal all the subgroups.</div>',
    HOME
  );
  const links = [...root.querySelectorAll("a")].map(text);
  assert.deepEqual(links, ["Homo sapiens (human)", "浏览基因组", "比较基因组学"]);
  const divs = [...root.querySelectorAll("div")].map(text);
  assert.ok(divs.includes("组装详情"));
  assert.ok(divs.includes("RefSeq 登录号"));
  assert.ok(divs.includes("GenBank 登录号"));
  const lis = [...root.querySelectorAll("li")].map(text);
  assert.deepEqual(lis, ["酿酒酵母", "玉米", "水稻", "斑马鱼", "果蝇", "鸡", "家牛"]);
  assert.match(text(root.querySelector("#tip")), /^要查看树中的更多物种/);
});

test("规则：轨道类别计数、内切酶说明与识别位点", () => {
  const root = mount(
    "<div>Category: NCBI Genes (55 Items)</div>" +
      "<div>Category: Nonsense-Mediated Decay</div>" +
      "<div>Acc65I restriction endonuclease recognition and cleavage sites</div>" +
      "<div>EcoRI Recognition Sites</div>" +
      "<div>Repeats identified by WindowMasker</div>"
  );
  const divs = [...root.querySelectorAll("div")].map(text);
  assert.equal(divs[0], "类别：NCBI Genes（55 项）");
  assert.equal(divs[1], "类别：Nonsense-Mediated Decay");
  assert.equal(divs[2], "Acc65I 限制性内切酶识别与切割位点");
  assert.equal(divs[3], "EcoRI 识别位点");
  assert.equal(divs[4], "WindowMasker 识别的重复序列");
});

test("数据不翻：组装号、轨道名、学名、坐标与 option 值原样保留", () => {
  const root = mount(
    '<div class="x-grid-cell-inner">基因，NCBI RefSeq 注释 GCF_000001405.40-RS_2026_11</div>' +
      "<div>RNA-seq exon coverage, aggregate (filtered), NCBI Homo sapiens Annotation Release 110</div>" +
      "<div>GRCh38.p14 (GCF_000001405.40)</div>" +
      "<div>Chr 1 (NC_000001.11)</div>" +
      "<div>Aedes albopictus</div>" +
      "<div>Plasmodium falciparum 3D7</div>" +
      '<div>NC_000001.11:1 - 248,956,422</div>' +
      '<select><option value="GCF_000001405.40 (GRCh38.p14)">GCF_000001405.40 (GRCh38.p14)</option></select>'
  );
  const divs = [...root.querySelectorAll("div")].map(text);
  assert.deepEqual(divs, [
    "基因，NCBI RefSeq 注释 GCF_000001405.40-RS_2026_11",
    "RNA-seq exon coverage, aggregate (filtered), NCBI Homo sapiens Annotation Release 110",
    "GRCh38.p14 (GCF_000001405.40)",
    "Chr 1 (NC_000001.11)",
    "Aedes albopictus",
    "Plasmodium falciparum 3D7",
    "NC_000001.11:1 - 248,956,422"
  ]);
  const opt = root.querySelector("option");
  assert.equal(opt.getAttribute("value"), "GCF_000001405.40 (GRCh38.p14)");
  assert.equal(text(opt), "GCF_000001405.40 (GRCh38.p14)");
});
