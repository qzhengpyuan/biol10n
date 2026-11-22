// PRIDE Archive 词库（pride）属性通道回归：首页 KPI 卡说明、数据集页 QC 指标标题（MS 本体 ID / QCPRIDE 指标 ID 保留）、共享容差与实验组的长说明句、文件表与类型枚举，"不该翻"的登录号与文件名
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

// 站点条目以 config/sites.json 为准；父级还没加 pride 时退回到这里约定的同款配置。
const projectedSite = {
  id: "pride",
  name: "PRIDE Archive",
  hosts: ["www.ebi.ac.uk"],
  path: "^/pride",
  dicts: ["common", "spa", "pride"],
  scope: "body",
  spa: true
};
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const configSite = sites.find((s) => s.id === "pride");
const site = Object.assign({}, configSite || projectedSite, {
  id: "pride",
  dicts: (configSite && configSite.dicts && configSite.dicts.length) ? configSite.dicts : ["common", "spa", "pride"],
  scope: (configSite && configSite.scope) || "body"
});
const dictIds = Array.isArray(site.dicts) && site.dicts.length ? site.dicts : ["common", "spa", "pride"];

const data = { exact: {}, rules: [], templates: [] };
for (const id of dictIds) {
  const b = JSON.parse(fs.readFileSync(path.join(root, "../dict", id + ".json"), "utf8"));
  Object.assign(data.exact, b.exact || {});
  data.rules = data.rules.concat(b.rules || []);
  data.templates = data.templates.concat(b.templates || []);
}

function run(html) {
  const dom = new JSDOM("<body>" + html + "</body>");
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return dom.window.document;
}
function plain(doc) {
  return doc.body.textContent.replace(/\s+/g, " ").trim();
}

test("词库结构：条数、键值形态、规则可编译、模板槽位连续", () => {
  assert.equal(book.meta.family, "pride");
  assert.ok(book.meta.sites.includes("www.ebi.ac.uk"), "meta.sites 要声明 host");
  assert.ok(Object.keys(book.exact).length >= 300, "exact 至少 300 条");
  assert.ok(book.rules.length >= 35, "rules 至少 35 条");
  assert.ok(Array.isArray(book.templates), "templates 必须是数组");

  const seen = new Set();
  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "键里不能有中文: " + k);
    assert.ok(/[\u4e00-\u9fff]/.test(v), "译文里必须有中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "键首尾不能有空白: " + JSON.stringify(k));
    assert.equal(v, v.trim(), "译文首尾不能有空白: " + JSON.stringify(k));
    assert.ok(!/https?:\/\/[^\s）]+\.[a-z]/i.test(v), "译文里不能有明文 URL: " + k);
    assert.ok(!seen.has(k), "重复键: " + k);
    seen.add(k);
  }
  for (const r of book.rules) {
    const re = new RegExp(r.re);
    assert.ok(re.source.length > 0);
    assert.ok(/[\u4e00-\u9fff]/.test(r.to), "规则译文里必须有中文: " + r.re);
    if (/^\([^)]*\)/.test(r.re) || /\([^)]+\)/.test(r.re)) assert.ok(/\$\d/.test(r.to), "带捕获组的规则要用到占位符: " + r.re);
  }
  for (const t of book.templates) {
    const used = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.ok(used.length >= 1, "模板要带槽位: " + t.pat);
    assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, "模板长度越界: " + t.pat.length);
    const sorted = used.slice().sort((a, b) => a - b);
    sorted.forEach((n, i) => assert.equal(n, i + 1, "槽位必须从 1 连续: " + t.pat));
    const zhUsed = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.deepEqual(zhUsed.slice().sort((a, b) => a - b), sorted, "译文槽位要与原文一致");
  }
});

test("站点条目：common+spa+pride 栈、path 锚在 /pride", () => {
  assert.deepEqual(site.dicts, ["common", "spa", "pride"], "common 垫底、spa 居中、本册覆盖在其上");
  assert.ok(site.hosts.includes("www.ebi.ac.uk"));
  assert.equal(site.path, "^/pride", "www.ebi.ac.uk 上有多个站，必须按路径锚定");
});

test("首页 KPI 卡：title 说明翻中文，数值与单位原样", () => {
  const doc = run(
    '<div class="kpis">' +
      '<a class="kpi" href="/pride/archive/" title="Browse all public datasets"><span class="kpi-value">42,823</span><span class="kpi-label">public datasets</span></a>' +
      '<a class="kpi" href="/pride/stats" title="Files in the archive"><span class="kpi-value">3.9 M</span><span class="kpi-label">files</span></a>' +
      '<a class="kpi" href="/pride/stats" title="Total volume submitted"><span class="kpi-value">4.4 PB</span><span class="kpi-label">of data</span></a>' +
      '<a class="kpi" href="/pride/stats" title="Submitting countries"><span class="kpi-value">87</span><span class="kpi-label">countries</span></a>' +
      '<a class="kpi" href="/pride/stats" title="Submissions in the latest complete month"><span class="kpi-value">873</span><span class="kpi-label">datasets in Oct 2026</span></a>' +
      "</div>"
  );
  const kpis = [...doc.querySelectorAll("a.kpi")];
  assert.equal(kpis[0].getAttribute("title"), "浏览全部公开数据集");
  assert.equal(kpis[1].getAttribute("title"), "归档中的文件数");
  assert.equal(kpis[2].getAttribute("title"), "已提交的数据总量");
  assert.equal(kpis[3].getAttribute("title"), "提交国家/地区");
  assert.equal(kpis[4].getAttribute("title"), "最近一个完整月份的提交量");
  const text = plain(doc);
  assert.ok(text.includes("42,823") && text.includes("3.9 M") && text.includes("4.4 PB"), "数值不动: " + text);
  assert.ok(text.includes("2026 年 10 月新增数据集"), "月份走规则、年份与数字不动: " + text);
});

test("首页 QC 区：统计口径、两个计数说明、统计页入口", () => {
  const doc = run(
    '<section class="qc"><h2>Data quality across PRIDE</h2>' +
      '<div class="who-toggle" aria-label="Count by"><button class="active" title="Each dataset counts once, with the median (or most common value) of its runs">Per dataset</button>' +
      '<button title="Every raw file counts once; large datasets weigh more">Per raw file</button></div>' +
      '<div class="stat-card"><span class="stat-card-title">Acquisition method</span>' +
      '<span class="stat-card-note" title="inferred from MS2 isolation windows and cycle structure">inferred from MS2 isolation windows and cycle structure</span>' +
      '<a class="stat-card-more" title="Open in statistics" href="/pride/stats">Details</a></div></section>'
  );
  const toggle = doc.querySelector(".who-toggle");
  assert.equal(toggle.getAttribute("aria-label"), "统计口径");
  const [pd, prf] = [...doc.querySelectorAll(".who-toggle button")];
  assert.equal(pd.getAttribute("title"), "每个数据集只计一次，取各次运行的中位数（或最常见值）");
  assert.equal(prf.getAttribute("title"), "每个原始文件只计一次；数据集越大权重越高");
  const more = doc.querySelector("a.stat-card-more");
  assert.equal(more.getAttribute("title"), "在统计页面中打开");
  assert.equal(more.textContent, "详情");
  const note = doc.querySelector(".stat-card-note");
  assert.equal(note.textContent, "由 MS2 隔离窗口与周期结构推断", "说明句正文照翻，title 与正文一致");
});

test("数据集页 QC 表头：标签与单位翻中文，MS 本体 ID 原样保留", () => {
  const doc = run(
    '<table class="qc-table"><thead><tr>' +
      '<th title="MS run duration · MS:4000067 · unit: second">MS run duration<span class="unit">[second]</span></th>' +
      '<th title="number of MS1 spectra · MS:4000059 · unit: count unit">number of MS1 spectra<span class="unit">[count unit]</span></th>' +
      '<th title="MS1 density quantiles (Q1) · MS:4000061">MS1 density quantiles <span class="part">Q1</span></th>' +
      '<th title="MS1 quantile RT fraction (Q4) · MS:4000184 · unit: fraction">MS1 quantile RT fraction <span class="part">Q4</span><span class="unit">[fraction]</span></th>' +
      '<th title="MS1 observed m/z bounds (min) · MS:4000222 · unit: m/z">MS1 observed m/z bounds <span class="part">min</span><span class="unit">[m/z]</span></th>' +
      '<th title="fastest frequency for MS level 1 collection · MS:4000065 · unit: hertz">fastest frequency for MS level 1 collection<span class="unit">[hertz]</span></th>' +
      '<th title="mean MS2 precursor charge in all spectra · MS:4000173">mean MS2 precursor charge in all spectra</th>' +
      '<th title="ratio of 3+ over 2+ of all MS2 known precursor charges · MS:4000169">ratio of 3+ over 2+ of all MS2 known precursor charges</th>' +
      "</tr></thead></table>"
  );
  const ths = [...doc.querySelectorAll("th")];
  assert.equal(ths[0].getAttribute("title"), "MS 运行时长 · MS:4000067 · 单位：秒");
  assert.equal(ths[1].getAttribute("title"), "MS1 谱图数 · MS:4000059 · 单位：计数单位");
  assert.equal(ths[2].getAttribute("title"), "MS1 密度分位数（Q1） · 本体 MS:4000061");
  assert.equal(ths[3].getAttribute("title"), "MS1 保留时间分位点占比（Q4） · MS:4000184 · 单位：比例");
  assert.equal(ths[4].getAttribute("title"), "MS1 观测 m/z 范围（最小值） · MS:4000222 · 单位：m/z");
  assert.equal(ths[5].getAttribute("title"), "MS1 采集的最快频率 · MS:4000065 · 单位：赫兹");
  assert.equal(ths[6].getAttribute("title"), "全部谱图中 MS2 母离子电荷均值 · 本体 MS:4000173");
  assert.equal(ths[7].getAttribute("title"), "全部已知 MS2 母离子电荷中 3+ 与 2+ 之比 · 本体 MS:4000169");
  assert.ok(ths[0].getAttribute("title").includes("MS:4000067"), "本体 ID 不能被吃掉");
  assert.ok(ths[2].getAttribute("title").includes("MS:4000061"), "本体 ID 不能被吃掉");
  const text = plain(doc);
  assert.ok(text.includes("[秒]") && text.includes("[计数单位]") && text.includes("[赫兹]") && text.includes("[比例]"), text);
  assert.ok(text.includes("[m/z]"), "m/z 是单位符号，保留原文: " + text);
  assert.ok(text.includes("MS1 密度分位数"), "列名正文要翻: " + text);
  assert.ok(text.includes("Q1") && text.includes("Q4") && !/MS:4000/.test(text), "分位不算本体 ID；裸 min/max 不做 exact（会把「720 min」翻坏），保留英文: " + text);
});

test("数据集页 QC：QCPRIDE 指标标题与长说明句", () => {
  const doc = run(
    '<table class="qc-table"><thead><tr>' +
      '<th title="suggested precursor search tolerance · QCPRIDE:24117D188C618917D827 · unit: ppm">suggested precursor tolerance [ppm]</th>' +
      '<th title="suggested fragment search tolerance: ppm for high-resolution MS2, Da for low-resolution MS2 · QCPRIDE:D2338E066BD0AD22664B / QCPRIDE:3D7A0C71FC01C8616CDB">suggested fragment tolerance</th>' +
      '<th title="acquisition method inference evidence (INFERRED_NOT_OBSERVED) · QCPRIDE:66216D97E9C2CB43C805">acquisition method</th>' +
      '<th title="shared precursor tolerance">shared precursor tolerance</th>' +
      '<th title="shared fragment tolerance">shared fragment tolerance</th>' +
      "</tr></thead></table>" +
      '<div class="qc-groups"><span class="qc-groups-title" title="Runs with compatible fragment resolution, acquisition method, run duration, MS1/MS2 counts and tolerances. Shared tolerance: the largest per-run suggestion in the group, rounded up (ppm to an integer, Da to 0.001), so one setting covers every run in the group.">One experiment group</span>' +
      '<button class="qc-group" title="Show only the runs of group 1">Group 1</button></div>'
  );
  const ths = [...doc.querySelectorAll("th")];
  assert.equal(ths[0].getAttribute("title"), "建议母离子检索容差 · QCPRIDE:24117D188C618917D827 · 单位：ppm");
  assert.equal(
    ths[1].getAttribute("title"),
    "建议碎片离子检索容差：高分辨 MS2 用 ppm，低分辨 MS2 用 Da · QCPRIDE:D2338E066BD0AD22664B 或 QCPRIDE:3D7A0C71FC01C8616CDB"
  );
  assert.equal(ths[2].getAttribute("title"), "采集方式推断证据（INFERRED_NOT_OBSERVED） · 本体 QCPRIDE:66216D97E9C2CB43C805");
  assert.equal(ths[3].getAttribute("title"), "共享母离子容差");
  assert.equal(ths[3].textContent, "共享母离子容差");
  assert.equal(ths[4].textContent, "共享碎片离子容差");
  const groupBtn = doc.querySelector("button.qc-group");
  assert.equal(groupBtn.getAttribute("title"), "仅显示第 1 组的运行");
  const groupNote = doc.querySelector(".qc-groups-title");
  assert.ok(groupNote.getAttribute("title").startsWith("碎片分辨率、采集方式、运行时长"), groupNote.getAttribute("title"));
  assert.ok(groupNote.getAttribute("title").includes("向上取整（ppm 取整数，Da 取到 0.001）"));
});

test("数据集页 QC：实验组与共享容差的整条 tooltip（含 prideQC 小写品牌名）", () => {
  const longPre =
    "Shared precursor search tolerance of the experiment group: the largest per-run suggestion in the group, rounded up (ppm to an integer, Da to 0.001), so one setting covers every run. Empty when fewer than 80% of the group runs have an estimate or units differ. · prideQC cohort precursor tolerance";
  const longFrag =
    "Shared fragment search tolerance of the experiment group: the largest per-run suggestion in the group, rounded up (ppm to an integer, Da to 0.001), so one setting covers every run. Empty when fewer than 80% of the group runs have an estimate or units differ. · prideQC cohort fragment tolerance";
  const grp =
    "prideQC experiment group: runs with compatible fragment resolution, acquisition method, run duration, MS1/MS2 counts and tolerances (same grouping as the prideQC/pmultiQC report) · prideQC experiment group";
  const doc = run(
    '<table class="qc-table"><thead><tr>' +
      '<th title="' + grp.replace(/"/g, "&quot;") + '">group</th>' +
      '<th title="' + longPre + '">shared precursor tolerance</th>' +
      '<th title="' + longFrag + '">shared fragment tolerance</th>' +
      "</tr></thead></table>"
  );
  const ths = [...doc.querySelectorAll("th")];
  assert.equal(ths[0].textContent, "组");
  assert.ok(ths[0].getAttribute("title").startsWith("prideQC 实验组：碎片分辨率"), ths[0].getAttribute("title"));
  assert.ok(ths[0].getAttribute("title").endsWith("· prideQC 实验组"), ths[0].getAttribute("title"));
  assert.ok(ths[1].getAttribute("title").startsWith("实验组的共享母离子检索容差："), ths[1].getAttribute("title"));
  assert.ok(ths[1].getAttribute("title").includes("当组内给出估计值的运行不足 80% 或单位不一致时为空。"), ths[1].getAttribute("title"));
  assert.ok(ths[1].getAttribute("title").endsWith("· prideQC 队列母离子容差"), ths[1].getAttribute("title"));
  assert.ok(ths[2].getAttribute("title").endsWith("· prideQC 队列碎片离子容差"), ths[2].getAttribute("title"));
});

test("数据集页文件区：下载全部、类型枚举、表头与类型分布串", () => {
  const doc = run(
    '<div class="files"><span class="files-bulk-label">Download all:</span>' +
      "<p class=\"files-breakdown\">RAW (1), SEARCH (1), PEAK (2), RESULT (1), OTHER (3)</p>" +
      '<span class="ivu-select-placeholder">All types</span>' +
      '<ul class="ivu-select-dropdown-list">' +
      '<li class="ivu-select-item">EXPERIMENTAL DESIGN</li><li class="ivu-select-item">PEAK</li>' +
      '<li class="ivu-select-item">RAW</li><li class="ivu-select-item">RESULT</li>' +
      '<li class="ivu-select-item">SEARCH</li><li class="ivu-select-item">OTHER</li></ul>' +
      '<table><thead><tr><th>Name</th><th>Type</th><th>Size (M)</th><th>Download</th></tr></thead></table>' +
      '<a class="files-all-button" title="Open the complete file list on one page: search, sort, copy URLs — no pagination">View all 9 files</a>' +
      "</div>"
  );
  assert.equal(doc.querySelector(".files-bulk-label").textContent, "全部下载：");
  assert.equal(doc.querySelector(".files-breakdown").textContent.trim(), "原始文件（1）、检索结果（1）、谱图（2）、结果文件（1）、其他（3）");
  const items = [...doc.querySelectorAll(".ivu-select-item")].map((li) => li.textContent);
  assert.deepEqual(items, ["实验设计", "谱图", "原始文件", "结果文件", "检索结果", "其他"]);
  const ths = [...doc.querySelectorAll("th")].map((th) => th.textContent);
  assert.deepEqual(ths, ["名称", "类型", "大小（MB）", "下载"]);
  assert.equal(doc.querySelector(".files-all-button").textContent, "查看全部 9 个文件");
});

test("数据集页：chip 的 title 走锚定规则，物种拉丁名与关键词原样", () => {
  const doc = run(
    '<div class="chips">' +
      '<button class="tag-chip" title="Datasets tagged Prime-xs project">Prime-xs project</button>' +
      '<button class="keyword-chip" title="Datasets with keyword Spikes">Spikes</button>' +
      '<button class="species-pill" title="Datasets from Erwinia carotovora">Erwinia carotovora</button>' +
      '<button class="file-view-button" aria-label="View erwinia_carotovora.fasta" title="View the file content without downloading it: sort, search and filter columns"></button>' +
      '<a href="https://doi.org/10.6019/PXD000001" title="Opens DOI in a new tab">10.6019/PXD000001</a>' +
      "</div>"
  );
  const [tag, kw, sp] = [...doc.querySelectorAll(".tag-chip, .keyword-chip, .species-pill")];
  assert.equal(tag.getAttribute("title"), "标记为 Prime-xs project 的数据集");
  assert.equal(tag.textContent, "Prime-xs project");
  assert.equal(kw.getAttribute("title"), "含关键词 Spikes 的数据集");
  assert.equal(kw.textContent, "Spikes");
  assert.equal(sp.getAttribute("title"), "来自 Erwinia carotovora 的数据集");
  assert.equal(sp.textContent, "Erwinia carotovora", "物种拉丁名不翻");
  const view = doc.querySelector(".file-view-button");
  assert.equal(view.getAttribute("aria-label"), "查看 erwinia_carotovora.fasta", "只翻 View 前缀，文件名不动");
  assert.equal(view.getAttribute("title"), "无需下载即可查看文件内容：可排序、检索并筛选列");
  assert.equal(doc.querySelector("a").getAttribute("title"), "在新标签页中打开 DOI");
  assert.equal(doc.querySelector("a").textContent, "10.6019/PXD000001", "DOI 不翻");
});

test("数据集页：结果格式说明、整页 QC 入口与固定说明句", () => {
  const doc = run(
    '<div class="dataset-type"><span class="type-standard" title="Identification results provided in PSI standard formats (mzIdentML / mzTab), validated by ProteomeXchange (&quot;complete&quot; submission) and citable via DOI.">Standard formats</span></div>' +
      '<a class="files-all-button" title="Open the complete SDRF on one page: filter by any column, sort, export">View full SDRF</a>' +
      '<a class="files-all-button" title="Open the complete run QC on one page: filter, sort, all metrics of each run">View full run QC</a>' +
      '<a title="Open all metrics of this run">TMT_Erwinia_1uLSike_Top10HCD_isol2_45stepped_60min_01.raw</a>' +
      '<p>Submitted datasets are &#39;private&#39; by default. They will be available to you and the reviewers if you are logged-in into PRIDE</p>' +
      '<p>After the submission, the dataset metadata is validated and different post-processing are applied.</p>' +
      '<button class="read-more-toggle">Read more</button>'
  );
  const span = doc.querySelector(".type-standard");
  assert.ok(span.getAttribute("title").startsWith("以 PSI 标准格式（mzIdentML / mzTab）提供的鉴定结果"), span.getAttribute("title"));
  assert.ok(span.getAttribute("title").includes("可通过 DOI 引用。"));
  const links = [...doc.querySelectorAll("a.files-all-button")];
  assert.equal(links[0].getAttribute("title"), "在单页中打开完整 SDRF：可按任意列筛选、排序并导出");
  assert.equal(links[1].getAttribute("title"), "在单页中打开完整运行质控：可筛选、排序，并查看每次运行的全部指标");
  const metrics = doc.querySelector('a[title="打开本次运行的全部指标"]');
  assert.ok(metrics, "打开全部指标的入口要翻: " + plain(doc));
  const text = plain(doc);
  assert.ok(text.includes("提交的数据集默认为「私有」。登录 PRIDE 后，你与审稿人即可访问。"), text);
  assert.ok(text.includes("提交完成后，数据集元数据会经过校验，并执行多种后续处理。"), text);
  assert.ok(text.includes("阅读更多"), "Read more 走锚定规则: " + text);
});

test("下载与文件操作：FTP 下载、隐私入口文案", () => {
  const doc = run(
    '<button title="Download via FTP" class="ivu-btn">FTP</button>' +
      '<a href="/pride/archive/private" title="Download submission tool">Download submission tool</a>'
  );
  const btn = doc.querySelector("button");
  assert.equal(btn.getAttribute("title"), "通过 FTP 下载");
  assert.equal(btn.textContent, "FTP", "协议缩写不动");
  assert.equal(doc.querySelector("a").textContent, "下载提交工具");
});

test("不该翻的：登录号、文件名、蛋白/修饰描述、SDRF 列名、论文标题、物种名", () => {
  const kept = [
    "PXD000001",
    "TMT_Erwinia_1uLSike_Top10HCD_isol2_45stepped_60min_01.raw",
    "CT=protein;AC=P00924;CN=Enolase spike;QY=10",
    "Pectobacterium carotovorum",
    "Gut Microbially Produced Bile Acid Metabolite Lengthens Circadian Period in Host Intestinal Cells",
    "MS:4000067",
    "10.6019/PXD000001",
    "monohydroxylated residue",
    "Bottom-up proteomics"
  ];
  const doc = run(
    '<ul class="kept">' + kept.map((t) => "<li>" + t.replace(/</g, "&lt;") + "</li>").join("") + "</ul>" +
      '<table class="sdrf"><thead><tr>' +
      '<th title="characteristics[organism]">organism</th>' +
      '<th title="comment[sdrf version]">sdrf version</th>' +
      "</tr></thead></table>"
  );
  assert.deepEqual([...doc.querySelectorAll(".kept li")].map((li) => li.textContent), kept);
  const ths = [...doc.querySelectorAll("th")];
  assert.equal(ths[0].getAttribute("title"), "characteristics[organism]", "SDRF 列键不翻");
  assert.equal(ths[1].getAttribute("title"), "comment[sdrf version]", "SDRF 列键不翻");
  // 列名正文交给 common 处理（organism -> 物种），本册不额外收 SDRF 词表；
  // 关键在于 title 里的列键保持原文，筛选/排序不受影响。
  assert.equal(ths[0].textContent, "物种");
});

test("同 key 冲突的 Read more 用锚定规则：换掉整句就不动", () => {
  const doc = run("<button>Read more</button><p>Read more about PRIDE in the paper</p>");
  const [btn, p] = [doc.querySelector("button"), doc.querySelector("p")];
  assert.equal(btn.textContent, "阅读更多");
  assert.equal(p.textContent, "Read more about PRIDE in the paper", "只收整串命中，句子不套用");
});
