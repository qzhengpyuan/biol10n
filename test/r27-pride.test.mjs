// PRIDE Archive（www.ebi.ac.uk/pride）列表页与数据集页补漏（r27）：
// 检索结果计数「· N datasets」、高级检索提示句、左侧分面枚举（组织/细胞类型、疾病、定量方法）、
// 分面搜索占位符与滑块 aria-label、质控分面的长说明 tooltip、SDRF 表头。
// 只断言新增条目与既有保护项（登录号/物种/文件/SDRF 列键/实验类型值/min-max）不被误伤。
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

const FALLBACK_SITE = {
  id: "pride",
  name: "PRIDE Archive",
  hosts: ["www.ebi.ac.uk"],
  path: "^/pride",
  dicts: ["common", "spa", "pride"],
  scope: "body"
};
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "pride") || FALLBACK_SITE;

function loadStack() {
  const exact = {}, rules = [], templates = [];
  for (const id of site.dicts) {
    const p = path.join(root, "../dict", id + ".json");
    if (!fs.existsSync(p)) continue;
    const b = JSON.parse(fs.readFileSync(p, "utf8"));
    Object.assign(exact, b.exact || {});
    rules.push(...(b.rules || []));
    templates.push(...(b.templates || []));
  }
  return { exact, rules, templates };
}

function boot(html) {
  const dom = new JSDOM("<body>" + html + "</body>");
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: loadStack(),
    site: { ...site, rescan: false }
  });
  engine.start();
  return { doc: dom.window.document, engine };
}

const NEW_EXACT = {
  // 左侧分面：组织/细胞类型
  "Cell culture": "细胞培养物",
  "Epithelial cell": "上皮细胞",
  "Brain": "脑",
  "Permanent cell line cell": "永生化细胞系细胞",
  "Liver": "肝脏",
  "Blood plasma": "血浆",
  // 左侧分面：疾病
  "Breast cancer": "乳腺癌",
  "Colon cancer": "结肠癌",
  "Acute leukemia": "急性白血病",
  "Cervix carcinoma": "宫颈癌",
  "Alzheimer's disease": "阿尔茨海默病",
  // 左侧分面：定量方法
  "Label free": "非标记定量",
  "MS1 intensity based label-free quantification method": "基于 MS1 强度的非标记定量方法",
  "Spectrum counting": "谱图计数",
  "TIC": "总离子流",
  // 数据集页 SDRF 表头（title 里是 comment[...]/characteristics[...] 列键，不受影响）
  "spiked compound": "掺入化合物",
  "biological replicate": "生物学重复",
  "proteomics data acquisition method": "蛋白质组学数据采集方式",
  "cleavage agent details": "裂解试剂详情",
  "technical replicate": "技术重复",
  "fraction identifier": "组分标识符",
  "data file": "数据文件",
  "sdrf version": "SDRF 版本",
  "sdrf template": "SDRF 模板",
  "sdrf annotation tool": "SDRF 注释工具",
  // 分面搜索框
  "Find quantification method…": "查找定量方法……",
  "Find keywords…": "查找关键词……",
  "Find project tags…": "查找项目标签……",
  // 质控滑块的 aria-label
  "Chromatography duration minimum": "色谱时长最小值",
  "Chromatography duration maximum": "色谱时长最大值",
  "MS1 spectra per run minimum": "每次运行的 MS1 谱图数最小值",
  "MS1 spectra per run maximum": "每次运行的 MS1 谱图数最大值",
  "MS2 spectra per run minimum": "每次运行的 MS2 谱图数最小值",
  "MS2 spectra per run maximum": "每次运行的 MS2 谱图数最大值",
  // 高级检索提示句
  "Combine any field with a value (conditions are AND-ed). Use the filter panel on the left for the common facets.":
    "将任意字段与取值组合（条件之间为「与」关系）。常用筛选维度请使用左侧筛选面板。",
  // 质控分面的长说明 tooltip
  "Identification-free QC computed by prideQC from the raw files. Preview: not yet scientifically validated.":
    "由 prideQC 从原始文件计算的免鉴定质控。预览：尚未经过科学验证。",
  "Datasets with identification-free run QC from prideQC. Run QC is being computed across PRIDE; a dataset without it may not be processed yet.":
    "带有 prideQC 免鉴定运行质控的数据集。运行质控正在全库计算中，尚无质控的数据集可能尚未处理完成。",
  "Inferred by prideQC from the MS2 isolation windows and cycle structure of each raw file. A dataset counts for every method found in its runs.":
    "由 prideQC 依据每个原始文件的 MS2 隔离窗口与周期结构推断。数据集各次运行中出现的每种方法各计一次。",
  "From the fragment mass precision of repeated MS2 spectra (prideQC).":
    "由重复 MS2 谱图的碎片质量精度得出（prideQC）。",
  "Median retention time span of the runs of the dataset, in minutes (prideQC). Drag the slider or type a minimum and a maximum.":
    "数据集各次运行保留时间跨度的中位数，单位为分钟（prideQC）。可拖动滑块或输入最小值与最大值。",
  "Median number of MS1 spectra per run of the dataset (prideQC). Drag the slider or type a minimum and a maximum.":
    "数据集每次运行 MS1 谱图数的中位数（prideQC）。可拖动滑块或输入最小值与最大值。",
  "Median number of MS2 spectra per run of the dataset (prideQC). Drag the slider or type a minimum and a maximum.":
    "数据集每次运行 MS2 谱图数的中位数（prideQC）。可拖动滑块或输入最小值与最大值。",
  "Datasets that provide a sample-to-data relationship file (SDRF), matched on the file names the archive holds.":
    "提供样本到数据关系文件（SDRF）的数据集，按归档中实际保存的文件名匹配。",
  "Sample-to-data relationship file (SDRF) available — click to show only datasets with an experimental design":
    "已有样本到数据关系文件（SDRF）——点击仅显示带实验设计的数据集"
};

test("r27 词库结构：新增条目齐备、规则可编译、既有条目未被改动", () => {
  assert.equal(book.meta.family, "pride");
  assert.ok(Object.keys(book.exact).length >= 381, "exact 至少 381 条，实际 " + Object.keys(book.exact).length);
  assert.ok(book.rules.length >= 40, "rules 至少 40 条，实际 " + book.rules.length);
  for (const [en, zh] of Object.entries(NEW_EXACT)) {
    assert.equal(book.exact[en], zh, "词库缺条目或被改动: " + en);
  }
  const rule = book.rules.find((r) => r.re === "^· ([\\d,]+) datasets$");
  assert.ok(rule, "缺「· N datasets」计数规则");
  assert.equal(rule.to, "· $1 个数据集");
  // 既有条目按原样保留（只追加，不改语义）
  assert.equal(book.exact["Read more"], undefined, "Read more 仍走锚定规则而不是 exact");
  assert.ok(book.rules.some((r) => r.re === "^Read more$" && r.to === "阅读更多"));
  assert.ok(book.templates.length >= 2, "既有模板条目不能被删");
  assert.equal(book.exact["Read more"], undefined);
});

test("r27 引擎：新增 exact 全部命中，受控数据不被误伤", () => {
  const { engine } = boot("");
  for (const [en, zh] of Object.entries(NEW_EXACT)) {
    assert.equal(engine.translateText(en), zh, "未命中: " + en);
  }
  // 登录号、物种拉丁名、文件名、SDRF 列键、实验类型值、单位与 min/max 保持英文
  for (const kept of [
    "PXD087665",
    "Homo sapiens (human)",
    "Erwinia carotovora",
    "TMT_Erwinia_1uLSike_Top10HCD_isol2_45stepped_60min_01.raw",
    "characteristics[organism]",
    "comment[sdrf version]",
    "Bottom-up proteomics",
    "Shotgun proteomics",
    "Data-dependent acquisition",
    "monohydroxylated residue",
    "LTQ Orbitrap Velos",
    "min",
    "max",
    "[ppm]",
    "TMT",
    "SILAC"
  ]) {
    assert.equal(engine.translateText(kept), null, "不该翻的却被翻: " + kept);
  }
});

test("r27 规则：检索结果计数「· N datasets」锚定整串", () => {
  const { doc } = boot(
    '<h1>Search PRIDE Archive · 42,876 datasets</h1>' +
      '<span class="search-heading-count"> · 42,876 datasets</span>' +
      '<span class="other">· 42,876 files</span>'
  );
  assert.equal(doc.querySelector(".search-heading-count").textContent, " · 42,876 个数据集");
  assert.equal(doc.querySelector("h1").textContent, "检索 PRIDE Archive · 42,876 个数据集");
  assert.equal(doc.querySelector(".other").textContent, "· 42,876 files", "别的计数不能套用");
  const { engine } = boot("");
  assert.equal(engine.translateText("· 3 datasets"), "· 3 个数据集");
  // 无间隔点的「N datasets」由 common 的通用计数规则处理，本册不抢
  assert.equal(engine.translateText("42,876 datasets"), "42,876 数据集");
});

test("r27 jsdom：列表页左侧分面枚举与分面搜索框", () => {
  const { doc } = boot(
    '<aside class="facets">' +
      '<div class="facet-block"><div class="facet-name">Tissue / Cell type</div>' +
      '<ul class="facet-values">' +
      '<li><span class="facet-value-label" title="Cell culture">Cell culture</span><span class="facet-count">21,202</span></li>' +
      '<li><span class="facet-value-label" title="Epithelial cell">Epithelial cell</span></li>' +
      '<li><span class="facet-value-label" title="Brain">Brain</span></li>' +
      '<li><span class="facet-value-label" title="Permanent cell line cell">Permanent cell line cell</span></li>' +
      '<li><span class="facet-value-label" title="Liver">Liver</span></li>' +
      '<li><span class="facet-value-label" title="Blood plasma">Blood plasma</span></li>' +
      "</ul></div>" +
      '<div class="facet-block"><div class="facet-name">Disease</div>' +
      '<ul class="facet-values">' +
      '<li><span class="facet-value-label" title="Breast cancer">Breast cancer</span></li>' +
      '<li><span class="facet-value-label" title="Colon cancer">Colon cancer</span></li>' +
      '<li><span class="facet-value-label" title="Acute leukemia">Acute leukemia</span></li>' +
      '<li><span class="facet-value-label" title="Cervix carcinoma">Cervix carcinoma</span></li>' +
      '<li><span class="facet-value-label" title="Alzheimer&#39;s disease">Alzheimer&#39;s disease</span></li>' +
      "</ul></div>" +
      '<div class="facet-block"><div class="facet-name">Quantification method</div>' +
      '<input placeholder="Find quantification method…">' +
      '<ul class="facet-values">' +
      '<li><span class="facet-value-label" title="TMT">TMT</span></li>' +
      '<li><span class="facet-value-label" title="Label free">Label free</span></li>' +
      '<li><span class="facet-value-label" title="MS1 intensity based label-free quantification method">MS1 intensity based label-free quantification method</span></li>' +
      '<li><span class="facet-value-label" title="Spectrum counting">Spectrum counting</span></li>' +
      '<li><span class="facet-value-label" title="SILAC">SILAC</span></li>' +
      '<li><span class="facet-value-label" title="TIC">TIC</span></li>' +
      "</ul></div>" +
      '<div class="facet-block"><div class="facet-name">Keywords</div><input placeholder="Find keywords…"></div>' +
      '<div class="facet-block"><div class="facet-name">Project tags</div><input placeholder="Find project tags…"></div>' +
      "</aside>"
  );
  const biotypes = [...doc.querySelectorAll(".facet-block")][0];
  assert.deepEqual(
    [...biotypes.querySelectorAll(".facet-value-label")].map((e) => e.textContent),
    ["细胞培养物", "上皮细胞", "脑", "永生化细胞系细胞", "肝脏", "血浆"]
  );
  assert.equal(biotypes.querySelector(".facet-value-label").getAttribute("title"), "细胞培养物", "title 与文本同源，一并翻");
  assert.equal(biotypes.querySelector(".facet-count").textContent, "21,202", "计数不动");
  const diseases = [...doc.querySelectorAll(".facet-block")][1];
  assert.deepEqual(
    [...diseases.querySelectorAll(".facet-value-label")].map((e) => e.textContent),
    ["乳腺癌", "结肠癌", "急性白血病", "宫颈癌", "阿尔茨海默病"]
  );
  const quant = [...doc.querySelectorAll(".facet-block")][2];
  assert.deepEqual(
    [...quant.querySelectorAll(".facet-value-label")].map((e) => e.textContent),
    ["TMT", "非标记定量", "基于 MS1 强度的非标记定量方法", "谱图计数", "SILAC", "总离子流"],
    "试剂/技术缩写（TMT、SILAC）保留原文"
  );
  assert.deepEqual(
    [...doc.querySelectorAll("input")].map((e) => e.getAttribute("placeholder")),
    ["查找定量方法……", "查找关键词……", "查找项目标签……"]
  );
});

test("r27 jsdom：高级检索提示句与质控分面的长说明 tooltip", () => {
  const { doc } = boot(
    '<p class="advanced-hint">Combine any field with a value (conditions are AND-ed). Use the filter panel on the left for the common facets.</p>' +
      '<div class="facet-block"><div class="facet-name" title="Datasets with identification-free run QC from prideQC. Run QC is being computed across PRIDE; a dataset without it may not be processed yet.">Run QC</div>' +
      '<span class="facet-group-badge" title="Identification-free QC computed by prideQC from the raw files. Preview: not yet scientifically validated.">preview</span></div>' +
      '<div class="facet-block"><div class="facet-name" title="Inferred by prideQC from the MS2 isolation windows and cycle structure of each raw file. A dataset counts for every method found in its runs.">Acquisition method</div></div>' +
      '<div class="facet-block"><div class="facet-name" title="From the fragment mass precision of repeated MS2 spectra (prideQC).">MS2 resolution</div></div>' +
      '<div class="facet-block"><div class="facet-name" title="Median retention time span of the runs of the dataset, in minutes (prideQC). Drag the slider or type a minimum and a maximum.">Chromatography duration</div>' +
      '<input type="number" aria-label="Chromatography duration minimum"><input type="number" aria-label="Chromatography duration maximum"></div>' +
      '<div class="facet-block"><div class="facet-name" title="Median number of MS1 spectra per run of the dataset (prideQC). Drag the slider or type a minimum and a maximum.">MS1 spectra per run</div>' +
      '<input aria-label="MS1 spectra per run minimum"><input aria-label="MS1 spectra per run maximum"></div>' +
      '<div class="facet-block"><div class="facet-name" title="Median number of MS2 spectra per run of the dataset (prideQC). Drag the slider or type a minimum and a maximum.">MS2 spectra per run</div>' +
      '<input aria-label="MS2 spectra per run minimum"><input aria-label="MS2 spectra per run maximum"></div>' +
      '<div class="facet-block"><div class="facet-name" title="Datasets that provide a sample-to-data relationship file (SDRF), matched on the file names the archive holds.">Experimental design</div></div>' +
      '<button class="type-badge type-sdrf" title="Sample-to-data relationship file (SDRF) available — click to show only datasets with an experimental design">SDRF</button>'
  );
  assert.equal(
    doc.querySelector(".advanced-hint").textContent,
    "将任意字段与取值组合（条件之间为「与」关系）。常用筛选维度请使用左侧筛选面板。"
  );
  const names = [...doc.querySelectorAll(".facet-name")];
  assert.deepEqual(names.map((e) => e.textContent), ["运行质控", "采集方式", "MS2 分辨率", "色谱时长", "每次运行的 MS1 谱图数", "每次运行的 MS2 谱图数", "实验设计"]);
  assert.equal(
    names[0].getAttribute("title"),
    "带有 prideQC 免鉴定运行质控的数据集。运行质控正在全库计算中，尚无质控的数据集可能尚未处理完成。"
  );
  assert.equal(names[1].getAttribute("title"), "由 prideQC 依据每个原始文件的 MS2 隔离窗口与周期结构推断。数据集各次运行中出现的每种方法各计一次。");
  assert.equal(names[2].getAttribute("title"), "由重复 MS2 谱图的碎片质量精度得出（prideQC）。");
  assert.ok(names[3].getAttribute("title").startsWith("数据集各次运行保留时间跨度的中位数，单位为分钟（prideQC）。"));
  assert.ok(names[3].getAttribute("title").endsWith("可拖动滑块或输入最小值与最大值。"));
  assert.ok(names[6].getAttribute("title").startsWith("提供样本到数据关系文件（SDRF）的数据集"));
  assert.equal(
    doc.querySelector(".facet-group-badge").getAttribute("title"),
    "由 prideQC 从原始文件计算的免鉴定质控。预览：尚未经过科学验证。"
  );
  assert.equal(doc.querySelector(".facet-group-badge").textContent, "预览");
  assert.deepEqual(
    [...doc.querySelectorAll("input[type=number]")].map((e) => e.getAttribute("aria-label")),
    ["色谱时长最小值", "色谱时长最大值"]
  );
  assert.deepEqual(
    [...doc.querySelectorAll("input")].slice(2).map((e) => e.getAttribute("aria-label")),
    ["每次运行的 MS1 谱图数最小值", "每次运行的 MS1 谱图数最大值", "每次运行的 MS2 谱图数最小值", "每次运行的 MS2 谱图数最大值"]
  );
  assert.equal(
    doc.querySelector(".type-sdrf").getAttribute("title"),
    "已有样本到数据关系文件（SDRF）——点击仅显示带实验设计的数据集"
  );
});

test("r27 jsdom：数据集页 SDRF 表头翻中文，列键（title）保持原文", () => {
  const { doc } = boot(
    '<table class="sdrf"><thead><tr>' +
      '<th class="col-index">#</th>' +
      '<th title="source name">source name</th>' +
      '<th title="characteristics[organism]">Organism</th>' +
      '<th title="characteristics[spiked compound]">spiked compound</th>' +
      '<th title="characteristics[biological replicate]">biological replicate</th>' +
      '<th title="assay name">assay name</th>' +
      '<th title="technology type">technology type</th>' +
      '<th title="comment[proteomics data acquisition method]">proteomics data acquisition method</th>' +
      '<th title="comment[cleavage agent details]">cleavage agent details</th>' +
      '<th title="comment[technical replicate]">technical replicate</th>' +
      '<th title="comment[fraction identifier]">fraction identifier</th>' +
      '<th title="comment[data file]">data file</th>' +
      '<th title="comment[sdrf version]">sdrf version</th>' +
      '<th title="comment[sdrf template]">sdrf template</th>' +
      '<th title="comment[sdrf annotation tool]">sdrf annotation tool</th>' +
      "</tr></thead>" +
      "<tbody><tr><td>1</td><td>TMT_Erwinia_spike_culture</td><td>Pectobacterium carotovorum</td></tr></tbody></table>"
  );
  const ths = [...doc.querySelectorAll("th")];
  assert.deepEqual(ths.map((e) => e.textContent), [
    "#",
    "source name",
    "物种",
    "掺入化合物",
    "生物学重复",
    "assay name",
    "technology type",
    "蛋白质组学数据采集方式",
    "裂解试剂详情",
    "技术重复",
    "组分标识符",
    "数据文件",
    "SDRF 版本",
    "SDRF 模板",
    "SDRF 注释工具"
  ], "core 列（source name / assay name / technology type）的 title 就是列键本身，翻文本会连带改列键，故保留英文");
  // SDRF 列键进 title，一个都不能改（站点按列键筛选/排序）
  assert.deepEqual(
    ths.slice(1).map((e) => e.getAttribute("title")),
    [
      "source name",
      "characteristics[organism]",
      "characteristics[spiked compound]",
      "characteristics[biological replicate]",
      "assay name",
      "technology type",
      "comment[proteomics data acquisition method]",
      "comment[cleavage agent details]",
      "comment[technical replicate]",
      "comment[fraction identifier]",
      "comment[data file]",
      "comment[sdrf version]",
      "comment[sdrf template]",
      "comment[sdrf annotation tool]"
    ]
  );
  // 表体数据（来源名、物种）保持原文
  const tds = [...doc.querySelectorAll("tbody td")].map((e) => e.textContent);
  assert.deepEqual(tds, ["1", "TMT_Erwinia_spike_culture", "Pectobacterium carotovorum"]);
});
