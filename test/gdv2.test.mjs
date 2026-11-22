// GDV 深页词库（dict/gdv2.json）校验 + 引擎行为测试
// 覆盖：配置轨道面板（Configure Page / Find Tracks）、画布工具条 tooltip、
//       外显子导航器与状态条、轨道集线器对话框、GDV 帮助页与 FAQ 小节标题
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/gdv2.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const siteCfg = sites.find((s) => s.id === "ncbi-gdv");
// 测试里同步扫描：关掉 SPA 的 waitFor 轮询
const site = { ...siteCfg, spa: false, waitFor: "" };

// 生产上 GDV 同时加载 common / ncbi / geo-extra / seq / gdv，本册排在最后
const prod = { exact: {}, rules: [], templates: [] };
for (const id of [...new Set([...siteCfg.dicts, "gdv2"])]) {
  const d = JSON.parse(fs.readFileSync(path.join(root, "../dict/" + id + ".json"), "utf8"));
  Object.assign(prod.exact, d.exact || {});
  if (d.rules) prod.rules.push(...d.rules);
  if (d.templates) prod.templates.push(...d.templates);
}

const URL = "https://www.ncbi.nlm.nih.gov/gdv/browser/genome/?id=GCF_000001405.40";

// 只加载本册：验证本册条目自足（不靠前四册）
function mountOnly(html, url = URL) {
  const dom = new JSDOM(html, { url });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: dict.exact, rules: dict.rules, templates: dict.templates },
    site
  });
  engine.start();
  return dom.window.document;
}

// 与生产一致：带上前四册
function mount(html, url = URL) {
  const dom = new JSDOM(html, { url });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: prod,
    site
  });
  engine.start();
  return dom.window.document;
}

// ---------------- 结构校验 ----------------

test("词库可解析，meta 指向 GDV 站点", () => {
  assert.equal(dict.meta.family, "gdv");
  assert.equal(dict.meta.version, "0.1.0");
  assert.ok(dict.meta.sites.includes("www.ncbi.nlm.nih.gov"));
  assert.ok(dict.meta.area.length > 0);
});

test("条目数量达标：exact ≥ 60、rules ≥ 10", () => {
  const n = Object.keys(dict.exact).length;
  assert.ok(n >= 60, "exact 条目应 ≥ 60，实际 " + n);
  assert.ok(dict.rules.length >= 10, "rules 应 ≥ 10，实际 " + dict.rules.length);
  assert.ok(Array.isArray(dict.templates));
});

test("关键条目齐全（面板、提示条、工具提示、集线器对话框、帮助页）", () => {
  const want = {
    "Cell value has been edited": "单元格值已修改",
    "Recognition Sites": "识别位点",
    "Warning: No track data found in this range": "警告：该范围内没有轨道数据",
    "Error: Incomplete data returned by back-end service": "错误：后端服务返回的数据不完整",
    "Filtered (read count from min to max)": "已过滤（读段数从最小到最大）",
    "Configure current set of tracks": "配置当前轨道集",
    "Configure Remote Track Hubs and Tracks": "配置远程轨道集线器与轨道",
    "Coloration:": "配色：",
    "Label Placement:": "标签位置：",
    "Shapes:": "形状：",
    "Spacing:": "间距：",
    "Number of connected track hubs": "已连接的轨道集线器数量",
    "Number of found track hubs": "找到的轨道集线器数量",
    "Search term or Track Hub URL. Leave blank to \"Search All\"": "检索词或轨道集线器 URL。留空则「检索全部」",
    "Controlling GDV with URL Parameters": "用 URL 参数控制 GDV",
    "Track Sets and Collections": "轨道集与集合",
    "Chromosome Region Selector": "染色体区域选择器",
    "Ideogram Band Colors": "染色体模式图条带配色",
    "4. How many tracks can I display?": "4. 我最多能显示多少条轨道？"
  };
  for (const [k, v] of Object.entries(want)) assert.equal(dict.exact[k], v, "缺少或值不符：" + k);
});

test("key 无首尾空白/无中文，value 无 URL 与邮箱，无自映射", () => {
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.equal(k, k.trim(), "key 有首尾空白：" + JSON.stringify(k));
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "key 含中文：" + k);
    assert.notEqual(k, v, "自映射：" + k);
    assert.ok(v && v === v.trim(), "value 为空或有空白：" + k);
    assert.ok(!/https?:\/\//.test(v), "value 含 URL：" + k);
    assert.ok(!/[\w.+-]+@[\w-]+\.\w+/.test(v), "value 含邮箱：" + k);
  }
});

test("rule 正则可编译、带捕获组，译文引用捕获组且为中文", () => {
  for (const r of dict.rules) {
    assert.doesNotThrow(() => new RegExp(r.re), "坏正则：" + r.re);
    assert.ok(/\(.+\)/.test(r.re), "规则必须带捕获组：" + r.re);
    assert.ok(/\$\d/.test(r.to), "译文应引用捕获组：" + r.re);
    assert.ok(/[\u4e00-\u9fff]/.test(r.to), "译文必须是中文：" + r.re);
  }
});

test("规则命中实测原文并产出预期中文", () => {
  const cases = [
    ["Tracks shown: 9/1151", "已显示轨道：9/1151"],
    ["Tracks available: 1151/1151", "可用轨道：1151/1151"],
    ["GRC Curation Issues mapped to GRCh38.p14", "映射到 GRCh38.p14 的 GRC 整理问题"],
    ["GRC Join Certificates GRCh38.p14", "GRC 连接证书 GRCh38.p14"],
    ["Assembly Regions, GRCh38.p14 (GCF_000001405.40)", "组装区域：GRCh38.p14 (GCF_000001405.40)"],
    ["Annotated Clone Assembly Problems (GRCh38.p14)", "已注释克隆组装问题（GRCh38.p14）"],
    ["Genes, NCBI Homo sapiens Annotation Release 110, 2022-04-08", "基因：NCBI Homo sapiens Annotation Release 110, 2022-04-08"],
    ["Alignments of alternate loci from GRCh38.p14 (GCF_000001405.40) to sequences from the primary assembly unit.",
      "GRCh38.p14 (GCF_000001405.40) 的替代位点与主组装单元序列的比对。"],
    ["Symmetric unique K-mers for GRCh38 human assembly", "GRCh38 human assembly 的对称唯一 k-mer"],
    ["RNA-seq exon coverage, aggregate (filtered), NCBI Homo sapiens Annotation Release 110 - log base 2 scaled",
      "RNA-seq exon coverage, aggregate (filtered), NCBI Homo sapiens Annotation Release 110 - 以 2 为底的对数缩放"]
  ];
  for (const [src, want] of cases) {
    const r = dict.rules.find((x) => new RegExp(x.re).test(src));
    assert.ok(r, "没有规则命中：" + src);
    const m = new RegExp(r.re).exec(src);
    assert.equal(r.to.replace(/\$(\d)/g, (_, d) => m[Number(d)]), want, "规则输出不符：" + src);
  }
  // 长句规则：外显子导航器（带一个数字捕获组）
  const exon = dict.rules.find((r) => r.re.includes("Exon Navigator"));
  const src = "Exon Navigator: There are too many (5534) genes in the region. Please narrow the region to enable exon navigation.";
  const m = new RegExp(exon.re).exec(src);
  assert.ok(m, "外显子导航器规则未命中");
  assert.equal(exon.to.replace(/\$(\d)/g, (_, d) => m[Number(d)]),
    "外显子导航器：该区域基因过多（5534 个）。请缩小区域以启用外显子导航。");
});

// ---------------- 本册自足 ----------------

test("本册单挂也够用：自己的条目不必依赖前四册", () => {
  const doc = mountOnly(
    '<div id="gdv-root"><span class="a">Cell value has been edited</span>' +
      '<span class="b">Warning: No track data found in this range</span>' +
      '<span class="c">Coloration:</span>' +
      '<span class="d">Tracks shown: 9/1151</span>' +
      '<span class="f">Number of connected track hubs</span>' +
      '<span class="g">GRC Join Certificates GRCh37.p13</span></div>'
  );
  const q = (x) => doc.querySelector(x).textContent;
  assert.equal(q(".a"), "单元格值已修改");
  assert.equal(q(".b"), "警告：该范围内没有轨道数据");
  assert.equal(q(".c"), "配色：");
  assert.equal(q(".d"), "已显示轨道：9/1151");
  assert.equal(q(".f"), "已连接的轨道集线器数量");
  assert.equal(q(".g"), "GRC 连接证书 GRCh37.p13");
});

// ---------------- 引擎行为（jsdom 渲染） ----------------

test("配置轨道面板：页签、类别、表头、设置区与动态轨道名", () => {
  const doc = mount(
    '<div id="gdv-root"><div class="x-window"><div class="title">Configure Page</div>' +
      "<div class=\"tabs\"><span>Available Tracks</span><span>Find Tracks</span><span>Custom Data</span><span>Active Tracks</span></div>" +
      "<div class=\"cats\"><span>Sequence</span><span>Genes/Products</span><span>Variation</span><span>Alignments</span><span>Expression</span><span>Epigenomics</span></div>" +
      "<div class=\"tip\">Click on track to display settings. To re-order tracks, drag and drop track names.</div>" +
      "<table><thead><tr><th>Active</th><th>Track name</th><th>Category</th><th>Description</th></tr></thead>" +
      "<tbody><tr><td></td><td>GRC Curation Issues mapped to GRCh38.p14</td><td>Assembly</td><td>placeholder</td></tr>" +
      "<tr><td></td><td>Genes, NCBI RefSeq Annotation GCF_000001405.40-RS_2026_11</td><td>Genes/Products</td><td>placeholder</td></tr></tbody></table>" +
      "<div class=\"settings\"><span>Track Settings: Sequence</span><span>Track legend</span><span>Other settings:</span>" +
      "<span>Show Label</span><span>Color gaps by type</span><span>Remove track(s)</span><span>Configure</span><span>Reset tracks</span><span>Cancel</span></div>" +
      "</div></div>"
  );
  assert.equal(doc.querySelector(".title").textContent, "配置页面");
  const tabs = [...doc.querySelectorAll(".tabs span")].map((s) => s.textContent);
  assert.deepEqual(tabs, ["可用轨道", "查找轨道", "自定义数据", "活动轨道"]);
  const cats = [...doc.querySelectorAll(".cats span")].map((s) => s.textContent);
  assert.deepEqual(cats, ["序列", "基因/产物", "变异", "比对结果", "表达", "表观基因组学"]);
  assert.equal(doc.querySelector(".tip").textContent, "点击轨道即可显示设置。要调整轨道顺序，请拖动轨道名称。");
  const ths = [...doc.querySelectorAll("th")].map((s) => s.textContent);
  assert.deepEqual(ths, ["启用", "轨道名称", "类别", "描述"]);
  const cells = [...doc.querySelectorAll("tbody td")].map((s) => s.textContent);
  assert.equal(cells[1], "映射到 GRCh38.p14 的 GRC 整理问题");
  assert.equal(cells[2], "组装");
  assert.ok(cells[5].startsWith("基因"), "基因轨道名应翻成中文：" + cells[5]);
  assert.ok(cells[5].includes("GCF_000001405.40-RS_2026_11"), "登录号不得改动");
  assert.equal(cells[6], "基因/产物");
  const st = [...doc.querySelectorAll(".settings span")].map((s) => s.textContent);
  assert.deepEqual(st, [
    "轨道设置：序列", "轨道图例", "其他设置：", "显示标签",
    "按类型给间隙着色", "移除轨道", "配置", "重置轨道", "取消"
  ]);
});

test("画布工具条：title/aria-label 翻成中文，图标子元素不丢", () => {
  const doc = mount(
    '<div id="gdv-root"><div class="toolbar">' +
      '<button aria-label="Configure tracks" title="Configure tracks, upload data, add remote tracks or track hubs"><i class="c"></i></button>' +
      '<button aria-label="Zoom In"></button><button aria-label="Zoom Out"></button>' +
      '<button aria-label="Pan left"></button><button aria-label="Pan right"></button>' +
      '<button aria-label="Zoom To Sequence"></button><button aria-label="Reload View"></button>' +
      '<button title="Ideogram of chromosome \'17\'"><svg viewBox="0 0 10 10"></svg></button>' +
      '<button title="Track display options"></button><button title="Track Info"></button>' +
      '<button title="Download Track Data"></button><button title="Hide track"></button>' +
      '<button title="Previous gene"></button><button title="Next gene out of view"></button>' +
      '<button title="Select previous exon"></button><button title="Right click for help menu"></button>' +
      '<button title="Configure current set of tracks"></button>' +
      '<button title="Configure Remote Track Hubs and Tracks"></button>' +
      '<input placeholder="Location, gene or phenotype" />' +
      "</div></div>"
  );
  const btns = [...doc.querySelectorAll("button")];
  assert.equal(btns[0].getAttribute("aria-label"), "配置轨道");
  assert.match(btns[0].getAttribute("title"), /^配置轨道、上传数据、添加远程轨道或轨道集/);
  assert.equal(btns[1].getAttribute("aria-label"), "放大");
  assert.equal(btns[2].getAttribute("aria-label"), "缩小");
  assert.equal(btns[3].getAttribute("aria-label"), "向左平移");
  assert.equal(btns[5].getAttribute("aria-label"), "缩放到序列");
  assert.equal(btns[6].getAttribute("aria-label"), "重新加载视图");
  assert.match(btns[7].getAttribute("title"), /^染色体 .*17.*的模式图$/);
  assert.equal(btns[8].getAttribute("title"), "轨道显示选项");
  assert.equal(btns[10].getAttribute("title"), "下载轨道数据");
  assert.equal(btns[11].getAttribute("title"), "隐藏轨道");
  assert.equal(btns[12].getAttribute("title"), "上一个基因");
  assert.equal(btns[13].getAttribute("title"), "下一个基因在视图外");
  assert.equal(btns[14].getAttribute("title"), "选择上一个外显子");
  assert.equal(btns[15].getAttribute("title"), "右键单击打开帮助菜单");
  assert.equal(btns[16].getAttribute("title"), "配置当前轨道集");
  assert.equal(btns[17].getAttribute("title"), "配置远程轨道集线器与轨道");
  assert.equal(doc.querySelector("input").getAttribute("placeholder"), "位置、基因或表型");
  assert.equal(doc.querySelector("button svg").tagName.toLowerCase(), "svg", "图标子元素不能被吃掉");
});

test("状态条/外显子导航器/提示条：计数规则与整句提示都翻成中文", () => {
  const doc = mount(
    '<div id="gdv-root"><div class="status">Tracks shown: 9/1151</div>' +
      '<div class="avail">Tracks available: 1151/1151</div>' +
      '<div class="exon-err">Exon Navigator: There are too many (5534) genes in the region. Please narrow the region to enable exon navigation.</div>' +
      '<div class="exon-none">Exon Navigator: There are no genes in the region</div>' +
      '<div class="warn">Warning: No track data found in this range</div>' +
      '<div class="err">Error: Incomplete data returned by back-end service</div>' +
      '<div class="grc-none">No GRC genome issues in range</div>' +
      '<div class="opt">Filtered (read count from min to max)</div>' +
      '<div class="exons">Exons: click an exon to zoom in, mouse over to see details</div>' +
      '<div class="cat">Category: Assembly (8 Items)</div>' +
      "</div>"
  );
  const q = (s) => doc.querySelector(s).textContent;
  assert.equal(q(".status"), "已显示轨道：9/1151");
  assert.equal(q(".avail"), "可用轨道：1151/1151");
  assert.equal(q(".exon-err"), "外显子导航器：该区域基因过多（5534 个）。请缩小区域以启用外显子导航。");
  assert.equal(q(".exon-none"), "外显子导航器：该区域内没有基因");
  assert.equal(q(".warn"), "警告：该范围内没有轨道数据");
  assert.equal(q(".err"), "错误：后端服务返回的数据不完整");
  assert.equal(q(".grc-none"), "范围内没有 GRC 基因组问题");
  assert.equal(q(".opt"), "已过滤（读段数从最小到最大）");
  assert.equal(q(".exons"), "外显子：点击外显子可放大，鼠标悬停可查看详情");
  // 类别计数走 gdv 既有规则
  assert.match(q(".cat"), /^类别：装配|^类别：组装/);
});

test("轨道集线器对话框：标题、搜索说明、计数与按钮", () => {
  const doc = mount(
    '<div id="gdv-root"><div class="hub-dialog">' +
      '<div class="hd">Configure Track Hubs</div>' +
      '<div title="Add hubs directly or by search">+</div>' +
      '<input placeholder="Search term or Track Hub URL. Leave blank to &quot;Search All&quot;" />' +
      '<div class="count">Number of connected track hubs</div>' +
      '<div class="found">Number of found track hubs</div>' +
      '<button title="Track Hubs help"></button>' +
      '<div class="discard">Discard search results</div>' +
      "<button>Apply changes</button><button>Cancel</button>" +
      "</div></div>"
  );
  assert.equal(doc.querySelector(".hd").textContent, "配置轨道集线器");
  assert.equal(doc.querySelector("div[title]").getAttribute("title"), "直接添加或通过检索添加轨道集线器");
  assert.equal(doc.querySelector("input").getAttribute("placeholder"),
    "检索词或轨道集线器 URL。留空则「检索全部」");
  assert.equal(doc.querySelector(".count").textContent, "已连接的轨道集线器数量");
  assert.equal(doc.querySelector(".found").textContent, "找到的轨道集线器数量");
  assert.equal(doc.querySelector(".discard").textContent, "丢弃检索结果");
  const btns = [...doc.querySelectorAll("button")];
  assert.equal(btns[0].getAttribute("title"), "轨道集线器帮助");
  assert.deepEqual(btns.slice(-2).map((b) => b.textContent), ["应用更改", "取消"]);
});

test("帮助页与 FAQ：小节标题、固定短标签与轨道说明", () => {
  const doc = mount(
    "<main><h1>NCBI Genome Data Viewer</h1>" +
      "<h2>Finding Organisms and Genome Assemblies</h2>" +
      "<h3>Page layout</h3><h4>Track Sets and Collections</h4>" +
      "<h3>Controlling GDV with URL Parameters</h3>" +
      "<h4>NCBI-Provided Tracks</h4><h4>Remote Streaming Files</h4>" +
      "<div class=\"desc\">Gene annotations provided by NCBI</div>" +
      "<div class=\"desc2\">Tiling Path (Components)</div>" +
      "<div class=\"faq\">4. How many tracks can I display?</div></main>",
    "https://www.ncbi.nlm.nih.gov/gdv/browser/help/"
  );
  assert.equal(doc.querySelector("h1").textContent, "NCBI 基因组数据查看器");
  assert.equal(doc.querySelector("h2").textContent, "查找物种与基因组组装");
  assert.equal(doc.querySelector("h3").textContent, "页面布局");
  const h4 = [...doc.querySelectorAll("h4")].map((h) => h.textContent);
  assert.deepEqual(h4, ["轨道集与集合", "NCBI 提供的轨道", "远程流式文件"]);
  assert.equal([...doc.querySelectorAll("h3")][1].textContent, "用 URL 参数控制 GDV");
  assert.equal(doc.querySelector(".desc").textContent, "NCBI 提供的基因注释");
  assert.equal(doc.querySelector(".desc2").textContent, "铺瓦路径（元件）");
  assert.equal(doc.querySelector(".faq").textContent, "4. 我最多能显示多少条轨道？");
});

test("长轨道说明（>120 字的固定说明句）整段翻成中文", () => {
  const doc = mount(
    '<div id="gdv-root"><div class="grid-cell"><div>' +
      "This track highlights assembly regions that are associated with one or more of the following features: alternate loci, assembly patches, centromeres (non-gap), heterochromatin (non-gap) or PAR (pseudo-autosomal region)." +
      "</div></div></div>"
  );
  const t = doc.querySelector(".grid-cell").textContent;
  assert.match(t, /^该轨道标出与下列一项或多项特征相关的组装区域/);
  assert.ok(!/This track highlights/.test(t));
});

test("不翻数据：登录号、基因名、版本号、组装名原样保留", () => {
  const doc = mount(
    '<div id="gdv-root"><table><tbody>' +
      "<tr><td>NC_000017.11</td><td>NC_000001.11</td><td>GCF_000001405.40</td></tr>" +
      "<tr><td>TP53</td><td>WRAP53</td><td>NM_000546.6</td></tr>" +
      "<tr><td>GRCh38.p14 (GCF_000001405.40)</td><td>Chr 17 (NC_000017.11)</td><td>REGION108</td></tr>" +
      "</tbody></table></div>"
  );
  const tds = [...doc.querySelectorAll("td")].map((t) => t.textContent);
  assert.deepEqual(tds, [
    "NC_000017.11", "NC_000001.11", "GCF_000001405.40",
    "TP53", "WRAP53", "NM_000546.6",
    "GRCh38.p14 (GCF_000001405.40)", "Chr 17 (NC_000017.11)", "REGION108"
  ]);
});

test("规则不误伤：Genes/Products 不被 Genes, 规则咬到", () => {
  const doc = mount(
    '<div id="gdv-root"><div class="a">Genes, NCBI RefSeq Annotation GCF_000001405.40-RS_2026_11</div>' +
      '<div class="c">Genes/Products</div></div>'
  );
  assert.ok(doc.querySelector(".a").textContent.startsWith("基因"), "基因轨道名未翻译");
  assert.ok(doc.querySelector(".a").textContent.includes("GCF_000001405.40-RS_2026_11"));
  assert.equal(doc.querySelector(".c").textContent, "基因/产物");
});
