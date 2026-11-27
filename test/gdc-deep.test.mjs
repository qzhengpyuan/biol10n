// GDC 数据门户深路径页（/annotations、/analysis_page?app=Projects、/analysis_page?app=Downloads）
// 的次级界面词库校验：列选择器、自定义筛选条件对话框、注释浏览器的可控词表值。
// 真页取证见 /tmp/biol10n-gdc3/REPORT.md（headless + CDP，2026-11-28）。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "gdc");
const gdc2 = JSON.parse(fs.readFileSync(path.join(root, "../dict/gdc2.json"), "utf8"));

// 与运行时同一口径：按站点 dicts 顺序合并，后面的册覆盖前面的册。
const data = { exact: {}, rules: [], templates: [] };
for (const id of site.dicts) {
  const d = JSON.parse(fs.readFileSync(path.join(root, `../dict/${id}.json`), "utf8"));
  Object.assign(data.exact, d.exact || {});
  data.rules.push(...(d.rules || []));
  data.templates.push(...(d.templates || []));
}

const URL_ANN = "https://portal.gdc.cancer.gov/annotations";
const URL_FILES = "https://portal.gdc.cancer.gov/analysis_page?app=Downloads";

function mount(html, url = URL_FILES) {
  const dom = new JSDOM(html, { url });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return dom.window.document;
}

// 站点首页导航里 Projects / Repository 的深链接；页面级词表值。
const ENTITY_TYPES = {
  aliquot: "等分样本",
  analyte: "分析物",
  portion: "分份样本",
  slide: "切片玻片",
  diagnosis: "诊断",
  structural_variation: "结构变异",
  masked_somatic_mutation: "掩蔽体细胞突变",
  submitted_unaligned_reads: "提交的未比对读段",
  biospecimen_supplement: "生物样本补充数据",
  slide_image: "切片图像",
  protein_expression: "蛋白表达",
  copy_number_segment: "拷贝数片段",
  copy_number_auxiliary_file: "拷贝数辅助文件",
  somatic_mutation_index: "体细胞突变索引",
  clinical_supplement: "临床补充数据",
  pathology_report: "病理报告",
  raw_methylation_array: "原始甲基化芯片",
  masked_methylation_array: "掩蔽甲基化芯片",
  copy_number_estimate: "拷贝数估计",
  methylation_beta_value: "甲基化 β 值",
  read_group: "读段组"
};

const CATEGORIES = {
  "item is noncanonical": "条目不符合规范",
  "item flagged dnu": "条目标记为 DNU（勿使用）",
  "prior malignancy": "既往恶性肿瘤",
  "alternate sample pipeline": "备选样本流程",
  "center qc failed": "中心质控未通过",
  "history of unacceptable prior treatment related to a prior/other malignancy": "与既往/其他恶性肿瘤相关的不可接受既往治疗史",
  "item in special subset": "条目属于特殊子集",
  "synchronous malignancy": "同时性恶性肿瘤",
  "neoadjuvant therapy": "新辅助治疗",
  "genotype mismatch": "基因型不匹配",
  "bcr notification": "BCR 通知",
  "history of acceptable prior treatment related to a prior/other malignancy": "与既往/其他恶性肿瘤相关的可接受既往治疗史",
  "item does not meet study protocol": "条目不符合研究方案",
  "item flagged low quality": "条目标记为低质量",
  "item may not meet study protocol": "条目可能不符合研究方案",
  "case submitted is found to be a recurrence after submission": "提交后发现该病例为复发",
  "permanently missing item or object": "永久缺失的条目或对象",
  "duplicate case": "重复病例",
  "duplicate item": "重复条目",
  "subject identity unknown": "受试者身份未知",
  "molecular analysis outside specification": "分子分析超出规范",
  "pathology outside specification": "病理超出规范",
  "barcode incorrect": "条码错误",
  "acceptable treatment for tcga tumor": "TCGA 肿瘤的可接受治疗",
  "biospecimen identity unknown": "生物样本身份未知",
  "subject withdrew consent": "受试者撤回知情同意",
  "qualification metrics changed": "合格性指标发生变化",
  "inadvertently shipped": "误发运",
  "qualified in error": "合格标记有误",
  "normal tissue origin incorrect": "正常组织来源不正确",
  "normal class but appears diseased": "分类为正常但呈现病变",
  "tumor class but appears normal": "分类为肿瘤但呈现正常",
  "sample compromised": "样本受损",
  "tumor tissue origin incorrect": "肿瘤组织来源不正确"
};

// ---------------- 结构校验 ----------------

test("新增词条落在 portal 册里，键值形状合规", () => {
  assert.equal(gdc2.meta.family, "gdc");
  assert.equal(gdc2.meta.version, "0.3.0");
  assert.ok(gdc2.meta.sites.includes("portal.gdc.cancer.gov"));
  for (const [k, v] of Object.entries({ ...ENTITY_TYPES, ...CATEGORIES })) {
    assert.equal(gdc2.exact[k], v, "缺词条：" + k);
  }
  for (const k of ["File UUID", "Case UUID", "Entity UUID", "Filter Columns", "Search for a property", "Only show properties with values", "show only properties with values", "Remove the facet", "Close Modal", "Search input for columns", "restore default column ordering", "centernotification", "observation"]) {
    assert.ok(gdc2.exact[k], "缺词条：" + k);
  }
  for (const [k, v] of Object.entries(gdc2.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "key 含中文：" + k);
    assert.ok(!/https?:\/\/|[\w.+-]+@[\w-]+\.\w+/.test(v), "value 含 URL/邮箱：" + k);
  }
  const count = gdc2.rules.find((r) => r.re.includes("properties"));
  assert.ok(count, "缺 N properties 规则");
  assert.equal(count.to, "$1 个属性");
});

// ---------------- 注释浏览器词表值 ----------------

test("注释浏览器：实体类型分面值翻成中文，与既有 aggregated_somatic_mutation 口径一致", () => {
  const html = '<div data-testid="facet-card-Entity Type">' +
    Object.keys(ENTITY_TYPES).map((k) => `<label><input type="checkbox" aria-label="${k}"><span class="font-content">${k}</span></label>`).join("") +
    '<span class="font-content">aggregated_somatic_mutation</span></div>';
  const doc = mount(html, URL_ANN);
  const spans = [...doc.querySelectorAll("span.font-content")].map((e) => e.textContent);
  for (const [en, zh] of Object.entries({ ...ENTITY_TYPES, aggregated_somatic_mutation: "汇总体细胞突变" })) {
    assert.ok(spans.includes(zh), "实体类型未翻：" + en);
    assert.ok(!spans.includes(en), "实体类型残留英文：" + en);
  }
  const labels = [...doc.querySelectorAll("input")].map((e) => e.getAttribute("aria-label"));
  assert.ok(labels.includes("等分样本"), "复选框 aria-label 未翻");
});

test("注释浏览器：分类/类别分面值与表格单元翻成中文", () => {
  const rows = Object.keys(CATEGORIES).map((k) => `<tr><td><span class="font-content">${k}</span></td><td class="px-2.5 py-2">${k}</td></tr>`).join("");
  const doc = mount(
    '<div data-testid="facet-card-Classification"><span class="font-content">observation</span><span class="font-content">centernotification</span></div>' +
      `<table><tbody>${rows}</tbody></table>`,
    URL_ANN
  );
  const texts = [...doc.querySelectorAll("span.font-content, td")].map((e) => e.textContent);
  for (const [en, zh] of Object.entries(CATEGORIES)) {
    assert.ok(texts.includes(zh), "类别值未翻：" + en);
    assert.ok(!texts.includes(en), "类别值残留英文：" + en);
  }
  assert.ok(texts.includes("观察"));
  assert.ok(texts.includes("中心通知"));
});

test("注释浏览器：项目名/病例号/UUID/时间戳/文件原样保留", () => {
  const uuid = "00615882-6e5a-46b4-891a-c058a28b3b60";
  const ts = "2022-02-28T11:47:23.155838-06:00";
  const doc = mount(
    '<table><tbody><tr>' +
      `<td><a class="text-utility-link underline">${uuid}</a></td>` +
      '<td><a class="text-utility-link underline">C3N-00852</a></td>' +
      '<td><a class="text-utility-link underline">CPTAC-3</a></td>' +
      `<td class="px-2.5 py-2">${ts}</td>` +
      '<td class="px-2.5 py-2">VCF</td>' +
      '</tr></tbody></table>',
    URL_ANN
  );
  const tds = [...doc.querySelectorAll("td, a")].map((e) => e.textContent);
  assert.ok(tds.includes(uuid), "UUID 被改写");
  assert.ok(tds.includes("C3N-00852"), "病例号被改写");
  assert.ok(tds.includes("CPTAC-3"), "项目 ID 被改写");
  assert.ok(tds.includes(ts), "时间戳被改写");
  assert.ok(tds.includes("VCF"), "数据格式缩写被改写");
});

// ---------------- 列选择器 / 自定义筛选条件 ----------------

test("列选择器：列名、占位符与无障碍标签全部命中", () => {
  const doc = mount(
    '<div class="mantine-Menu-dropdown">' +
      '<div>自定义列</div>' +
      '<input placeholder="Filter Columns" aria-label="Search input for columns">' +
      '<button aria-label="restore default column ordering"></button>' +
      '<div><span>File UUID</span></div>' +
      '<div><span>Case UUID</span></div>' +
      '<div><span>Entity UUID</span></div>' +
      '<div><span>项目 ID</span></div>' +
      '</div>',
    URL_ANN
  );
  assert.equal(doc.querySelector("input").getAttribute("placeholder"), "筛选列");
  assert.equal(doc.querySelector("input").getAttribute("aria-label"), "列检索输入框");
  assert.equal(doc.querySelector("button").getAttribute("aria-label"), "恢复默认列顺序");
  const labels = [...doc.querySelectorAll("div > span")].map((e) => e.textContent);
  assert.ok(labels.includes("文件 UUID"));
  assert.ok(labels.includes("病例 UUID"));
  assert.ok(labels.includes("实体 UUID"));
  assert.ok(labels.includes("项目 ID"), "已翻的列名被改坏");
});

test("自定义筛选条件：标题、检索框、属性计数与开关文案命中", () => {
  const doc = mount(
    '<section role="dialog" aria-modal="true">' +
      '<h2>Add a Custom Filter</h2>' +
      '<p>Search for a property</p>' +
      '<input placeholder="检索" data-testid="textbox-search-for-a-property">' +
      '<p>321 properties</p>' +
      '<p>1,024 properties</p>' +
      '<label>Only show properties with values<input type="checkbox" aria-label="show only properties with values"></label>' +
      '<button aria-label="Close Modal">x</button>' +
      '<button data-testid="button-analysis.input_files.data_category"><span>analysis.input_files.data_category</span>' +
        '<span>Broad categorization of the contents of the data file.</span></button>' +
      '</section>',
    URL_FILES
  );
  assert.equal(doc.querySelector("h2").textContent, "添加自定义筛选条件");
  assert.equal(doc.querySelectorAll("p")[0].textContent, "检索属性");
  assert.equal(doc.querySelectorAll("p")[1].textContent, "321 个属性");
  assert.equal(doc.querySelectorAll("p")[2].textContent, "1,024 个属性");
  assert.equal(doc.querySelector("label").textContent, "仅显示有值的属性");
  assert.equal(doc.querySelector("label input").getAttribute("aria-label"), "仅显示有值的属性");
  assert.equal(doc.querySelectorAll("button")[0].getAttribute("aria-label"), "关闭弹窗");
  // 数据字典的属性路径与说明句属于 schema 文档，不在本轮词库里（见 REPORT.md）。
  assert.equal(doc.querySelector("button span").textContent, "analysis.input_files.data_category");
  assert.match(doc.querySelectorAll("button span")[1].textContent, /^Broad categorization/);
});

test("自定义筛选条件卡片：删除按钮的无障碍标签翻成中文", () => {
  const doc = mount(
    '<div class="flex flex-row items-center"><div class="font-heading font-semibold">Input Files Data Category</div>' +
      '<button aria-label="Remove the facet"></button></div>',
    URL_FILES
  );
  assert.equal(doc.querySelector("button").getAttribute("aria-label"), "移除该筛选条件");
});

test("已知的界面固定文案不被新词条误伤（文件表头/分页/数据车）", () => {
  const doc = mount(
    '<div><span>File Name</span><span>File Size</span><span>Access</span><span>Data Format</span></div>' +
      '<div class="sr-only">Table sorted by File Name in ascending order.</div>' +
      '<div><span>35.99 kB</span><span>17.04 GB</span><span>JSON</span><span>TSV</span><span>WXS</span></div>',
    URL_FILES
  );
  const t = doc.body.textContent;
  assert.match(t, /文件名/);
  assert.match(t, /文件大小/);
  assert.match(t, /访问权限/);
  assert.match(t, /数据格式/);
  assert.match(t, /表格已按 文件名 升序排序。/);
  assert.match(t, /35\.99 kB/);
  assert.match(t, /17\.04 GB/);
  assert.match(t, /WXS/);
});
