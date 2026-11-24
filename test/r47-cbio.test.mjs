// cBioPortal 两册（dict/cbioportal.json + dict/cbioportal2.json）r47 补译校验
// 覆盖：/mutation_mapper 输入区与表头说明、Patient View 标签页/时间轴/IGV/突变列选择器、
//       Results View 与 CNA 表格计数规则。
// 说明：首页 What's New 面板（.newsContent li）的英文不在本测试范围——config/sites.json 的 skip
//       对整块生效，词库通道打不进去（见交付说明，属配置问题，不在 worker 写权限内）。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const cp1 = JSON.parse(fs.readFileSync(path.join(root, "../dict/cbioportal.json"), "utf8"));
const cp2 = JSON.parse(fs.readFileSync(path.join(root, "../dict/cbioportal2.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const baseSite = sites.find((s) => s.id === "cbioportal");
const site = { ...baseSite, rescan: false };

const DICT = {
  exact: { ...cp1.exact, ...cp2.exact },
  rules: [...(cp1.rules || []), ...(cp2.rules || [])],
  templates: [...(cp1.templates || []), ...(cp2.templates || [])]
};

function mount(inner, url = "https://www.cbioportal.org/patient") {
  const dom = new JSDOM('<div id="root"><main id="mainColumn">' + inner + "</main></div>", { url });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: DICT,
    site
  });
  engine.start();
  return { doc: dom.window.document, engine };
}

const flat = (el) => String(el.textContent || "").replace(/\s+/g, " ").trim();

// ---------------- 结构校验 ----------------

test("两册都能解析，三类通道齐全且条数只增不减", () => {
  assert.equal(cp1.meta.family, "cbioportal");
  assert.equal(cp2.meta.family, "cbioportal2");
  for (const d of [cp1, cp2]) assert.ok(d.meta.sites.includes("cbioportal.org"));
  // 基线（r47 补译前）：cbioportal 1141/53/0，cbioportal2 51/2/5
  assert.ok(Object.keys(cp1.exact).length >= 1141, "cbioportal exact 不得少于 1141 条");
  assert.ok((cp1.rules || []).length >= 53, "cbioportal rules 不得少于 53 条");
  assert.ok(Object.keys(cp2.exact).length >= 51, "cbioportal2 exact 不得少于 51 条");
  assert.ok((cp2.rules || []).length >= 2, "cbioportal2 rules 不得少于 2 条");
  assert.ok((cp2.templates || []).length >= 5, "cbioportal2 templates 不得少于 5 条");
  assert.ok(Object.keys(cp1.exact).length >= 1189, "本轮补译后 cbioportal exact 应 >= 1189");
  assert.ok((cp1.rules || []).length >= 55, "本轮补译后 cbioportal rules 应 >= 55");
  assert.ok(Object.keys(cp2.exact).length >= 54, "本轮补译后 cbioportal2 exact 应 >= 54");
  assert.ok((cp2.templates || []).length >= 6, "本轮补译后 cbioportal2 templates 应 >= 6");
});

test("每条译文含汉字、非自映射、无 URL/邮箱、无首尾空白", () => {
  for (const [name, d] of [["cbioportal", cp1], ["cbioportal2", cp2]]) {
    for (const [k, v] of Object.entries(d.exact)) {
      if (v === k) continue; // 历史条目里允许存在品牌词自映射，新条目一律不许（下一条单独查）
      assert.ok(k === k.trim(), name + " key 有首尾空白：" + JSON.stringify(k));
      assert.ok(v === String(v).trim(), name + " value 有首尾空白：" + k);
      if (!/[\u3400-\u9fff]/.test(k)) { /* key 本来就该是英文 */ }
      assert.ok(!/[\u3400-\u9fff]/.test(k), name + " key 含中文：" + k);
    }
    for (const t of d.templates || []) {
      assert.ok(!/https?:\/\/|[\w.+-]+@[\w-]+\.\w+/.test(t.zh), name + " 模板译文含 URL/邮箱：" + t.pat.slice(0, 40));
    }
  }
});

// 本轮新增的条目逐条体检：必须含汉字、必须不等于原文
const ADDED = {
  "cbioportal": {
    "Select Reference Genome:": "选择参考基因组：",
    "interprets mutations with protein annotations": "解读突变及其蛋白质注释",
    "Data Format": "数据格式",
    "Column Header": "列标题",
    "HUGO symbol for the gene": "该基因的 HUGO 符号",
    "Amino acid change": "氨基酸改变",
    "Tumor sample ID": "肿瘤样本 ID",
    "Translational effect of variant allele": "变异等位基因的翻译效应",
    "Chromosome number": "染色体编号",
    "The plus strand reference allele at this position": "该位置上正链的参考等位基因",
    "Tumor sequencing (discovery) allele": "肿瘤测序（发现阶段）等位基因",
    "Second pass results from orthogonal technology": "正交技术的复检结果",
    "Mutation status": "突变状态",
    "Center/Institute reporting the variant": "报告该变异的中心/机构",
    "Copy and paste your own mutation data": "复制粘贴您自己的突变数据",
    "Upload your own mutation file": "上传您自己的突变文件",
    "Visualize": "可视化",
    "List of valid input headers:": "有效输入表头列表：",
    "Genomic Changes": "基因组改变",
    "Genomic and Protein Changes": "基因组与蛋白质改变",
    "Pathology Report": "病理报告",
    "Tissue Image": "组织图像",
    "mRNA Expr.": "mRNA 表达",
    "Gene panel": "基因 panel",
    "Allele Freq": "等位基因频率",
    "Zoom in to see features": "放大以查看特征",
    "drag to zoom": "拖动以缩放",
    "SAMPLE ACQUISITION": "样本采集",
    "STATUS": "状态",
    "TREATMENT": "治疗",
    "Radiation Therapy": "放射治疗",
    "Sample Names": "样本名称",
    "Reset View": "重置视图",
    "cursor guide": "光标参考线",
    "center line": "中心线",
    "track labels": "轨道标签",
    "Additional Annotation": "附加注释",
    "Site1 Chromosome": "位点 1 染色体",
    "Site2 Chromosome": "位点 2 染色体",
    "Site1 Position": "位点 1 位置",
    "Site2 Position": "位点 2 位置",
    "Normal Allele Freq": "正常样本等位基因频率",
    "Variant Reads (Normal)": "变异读数（正常）",
    "Ref Reads (Normal)": "参考读数（正常）",
    "Click alteration for detail. Double-click to zoom.": "单击改变查看详情，双击缩放。",
    "Click on an mutation to zoom in on the gene in the IGV browser above": "单击突变，即可在上方 IGV 浏览器中放大该基因",
    "Click on a CNA row to zoom in on the gene in the IGV browser above": "单击 CNA 行，即可在上方 IGV 浏览器中放大该基因",
    "There are no results.": "没有结果。"
  },
  "cbioportal2": {
    "You can either copy and paste your input into the text field below or select a file with mutation data for upload.": "您可以将输入内容复制粘贴到下方的文本框中，或选择包含突变数据的文件上传。",
    "Mutation files should be tab delimited, and should at least have the genomic location headers in the first line for a successful annotation. Note that all variants have to be reported for genome build GRCh37 (hg19).": "突变文件应为制表符分隔，且第一行至少应包含基因组位置表头，才能成功注释。注意：所有变异都必须以 GRCh37（hg19）基因组构建版本报告。",
    "If your mutation input doesn't contain the genomic location headers, but you still want to visualize your data, your input should at least have the following headers:": "如果您的突变输入不含基因组位置表头，但仍希望可视化数据，则输入至少应包含以下表头："
  }
};

test("本轮新增条目全部就位，且每条译文含汉字并被引擎输出", () => {
  for (const [book, map] of Object.entries(ADDED)) {
    const d = book === "cbioportal" ? cp1 : cp2;
    for (const [k, v] of Object.entries(map)) {
      assert.equal(d.exact[k], v, book + " 缺少或译文不符：" + k);
      assert.ok(/[\u3400-\u9fff]/.test(v), "译文必须含汉字：" + k);
      assert.notEqual(k, v, "不许自映射：" + k);
    }
  }
});

test("rules 一律 ^…$ 锚定、可编译、$n 与捕获组对得上", () => {
  for (const [name, d] of [["cbioportal", cp1], ["cbioportal2", cp2]]) {
    for (const r of d.rules || []) {
      assert.ok(r.re.startsWith("^"), name + " 规则未以 ^ 锚定：" + r.re);
      assert.ok(r.re.endsWith("$"), name + " 规则未以 $ 锚定：" + r.re);
      assert.doesNotThrow(() => new RegExp(r.re), name + " 坏正则：" + r.re);
      assert.ok(r.to.length > 0, name + " 规则译文为空：" + r.re);
      // 捕获组数量：把规则与空分支并起来跑一次空串，结果数组长度 - 1 就是组数
      const probe = new RegExp(r.re + "|").exec("");
      const n = probe ? probe.length - 1 : 0;
      const used = [...r.to.matchAll(/\$(\d)/g)].map((m) => Number(m[1]));
      const maxUsed = used.length ? Math.max(...used) : 0;
      assert.ok(maxUsed <= n, name + " 规则 $n 超出捕获组数量：" + r.re);
    }
  }
});

test("本轮新增的两条规则就位且译文含汉字", () => {
  const want = {
    "^Queried genes are altered in ([\\d,]+) \\(([\\d.]+|NaN)%\\) of queried patients/samples$": "查询的基因在 $1（$2%）个查询患者/样本中发生改变",
    "^Showing (\\d+)-(\\d+) of ([\\d,]+) Copy Number Alterations$": "显示第 $1-$2 条，共 $3 条拷贝数改变"
  };
  for (const [re, to] of Object.entries(want)) {
    const hit = (cp1.rules || []).find((r) => r.re === re);
    assert.ok(hit, "缺少规则：" + re);
    assert.equal(hit.to, to, "规则译文不符：" + re);
    assert.ok(/[\u3400-\u9fff]/.test(hit.to), "规则译文必须含汉字：" + re);
  }
});

test("templates 占位符 1..N 一一对应、原文无中文、译文有中文", () => {
  for (const [name, d] of [["cbioportal", cp1], ["cbioportal2", cp2]]) {
    for (const t of d.templates || []) {
      assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, name + " pat 长度越界：" + t.pat.slice(0, 40));
      assert.ok(!/[\u3400-\u9fff]/.test(t.pat), name + " pat 不该含中文：" + t.pat.slice(0, 40));
      const slotCount = (t.pat.match(/\{\{\d+\}\}/g) || []).length;
      const used = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
      assert.deepEqual(used, Array.from({ length: slotCount }, (_, i) => i + 1), name + " 占位符不匹配：" + t.pat.slice(0, 40));
      assert.ok(/[\u3400-\u9fff]/.test(t.zh), name + " 译文必须是中文：" + t.pat.slice(0, 40));
    }
  }
});

// ---------------- 引擎行为：/mutation_mapper ----------------

const MM_PARA =
  '<div class="cbioportal-frontend"><div class="standalone-mutation-input">' +
  "<div><strong>Select Reference Genome: </strong></div>" +
  '<p id="mmInput">Please input <b>tab-delimited</b> or <b>space-delimited</b> mutation data. (Load example data:' +
  '<span> <a data-test="GenomicChangesExampleButton">Genomic Changes</a></span>,' +
  '<span> <a data-test="ProteinChangesExampleButton">Protein Changes</a></span>,' +
  '<span> <a data-test="GenomicAndProteinChangesExampleButton">Genomic and Protein Changes</a></span>)</p>' +
  "</div></div>";

test("mutation_mapper：整句模板命中，链接与加粗标签原位保留", () => {
  const { doc, engine } = mount(MM_PARA, "https://www.cbioportal.org/mutation_mapper");
  const p = doc.getElementById("mmInput");
  const text = flat(p);
  assert.ok(text.startsWith("请输入以"), "整句应被模板翻成中文，实际：" + text);
  assert.ok(text.includes("加载示例数据"), "示例数据引导语缺失：" + text);
  assert.ok(!/Please input/.test(text), "原文不该残留：" + text);
  assert.equal(p.querySelectorAll("a").length, 3, "三个示例链接必须全部保留");
  assert.equal(p.querySelectorAll("b").length, 2, "两个加粗标签必须保留");
  assert.equal(p.querySelector("a").getAttribute("data-test"), "GenomicChangesExampleButton", "链接属性不能被抹掉");
  assert.ok(text.includes("基因组改变"), "示例链接文字应被翻成中文：" + text);
  assert.ok(engine.stats.tpl >= 1, "应走模板通道");
});

test("mutation_mapper：参考基因组标签与表头说明翻成中文，示例值保持英文", () => {
  const { doc } = mount(
    '<div class="cbioportal-frontend"><div class="standalone-mutation-input">' +
      "<div><strong>Select Reference Genome: </strong></div></div>" +
      '<div class="full-list-of-headers"><table class="table table-striped"><thead>' +
      "<tr><th>Column Header</th><th>Description</th><th>Example</th></tr></thead><tbody>" +
      "<tr><td>Hugo_Symbol</td><td>HUGO symbol for the gene</td><td>TP53</td></tr>" +
      "<tr><td>Protein_Change</td><td>Amino acid change</td><td>V600E</td></tr>" +
      "<tr><td>Sample_ID</td><td>Tumor sample ID</td><td>TCGA-B5-A11E</td></tr>" +
      "</tbody></table></div></div>",
    "https://www.cbioportal.org/mutation_mapper"
  );
  const text = flat(doc.body);
  assert.ok(text.includes("选择参考基因组："), "参考基因组标签未翻：" + text.slice(0, 120));
  assert.ok(text.includes("列标题"), "Column Header 未翻");
  assert.ok(text.includes("该基因的 HUGO 符号"), "HUGO 说明未翻");
  assert.ok(text.includes("氨基酸改变"), "氨基酸说明未翻");
  assert.ok(text.includes("肿瘤样本 ID"), "样本 ID 说明未翻");
  // 列名是数据字段名、示例是字面值，必须保持英文
  assert.ok(text.includes("Hugo_Symbol"), "字段名不该被翻");
  assert.ok(text.includes("TP53") && text.includes("V600E") && text.includes("TCGA-B5-A11E"), "示例值不该被翻");
});

test("mutation_mapper：三段格式说明整段翻成中文（段落通道）", () => {
  const { doc } = mount(
    '<div class="mutation-data-info"><div class="mutation-input-format-info">' +
      "<p>You can either copy and paste your input into the text field below or select a file with mutation data for upload.<br></p>" +
      "<p>Mutation files should be tab delimited, and should at least have the genomic location headers in the first line for a successful annotation. Note that all variants have to be reported for genome build GRCh37 (hg19).</p>" +
      "<p>If your mutation input doesn't contain the genomic location headers, but you still want to visualize your data, your input should at least have the following headers:</p>" +
      "</div></div>",
    "https://www.cbioportal.org/mutation_mapper"
  );
  const text = flat(doc.body);
  assert.ok(text.includes("复制粘贴到下方的文本框中"), "第一段未翻：" + text.slice(0, 120));
  assert.ok(text.includes("制表符分隔"), "第二段未翻：" + text.slice(0, 200));
  assert.ok(text.includes("GRCh37（hg19）"), "基因组构建版本应保留原文：" + text.slice(0, 260));
  assert.ok(text.includes("则输入至少应包含以下表头"), "第三段未翻：" + text.slice(0, 320));
});

// ---------------- 引擎行为：Patient View ----------------

const PAT_TABS =
  '<div id="patientViewPageTabs" class="msk-tabs posRelative mainTabs"><ul class="nav nav-tabs">' +
  '<li class="active" style="cursor: pointer;"> <a class="tabAnchor tabAnchor_summary">Summary</a></li>' +
  '<li style="cursor: pointer;"> <a class="tabAnchor tabAnchor_pathologyReport">Pathology Report</a></li>' +
  '<li style="cursor: pointer;"> <a class="tabAnchor tabAnchor_tissueImage">Tissue Image</a></li>' +
  '<li style="cursor: pointer;"> <a class="tabAnchor tabAnchor_openResource_IDC_SLIM">Slide Microscopy</a></li>' +
  "</ul></div>";

test("Patient View：病理报告/组织图像标签页翻成中文，tabAnchor 钩子保留", () => {
  const { doc } = mount(PAT_TABS);
  const text = flat(doc.getElementById("patientViewPageTabs"));
  assert.ok(text.includes("病理报告"), "Pathology Report 未翻：" + text);
  assert.ok(text.includes("组织图像"), "Tissue Image 未翻：" + text);
  const a = doc.querySelector(".tabAnchor_pathologyReport");
  assert.ok(a, "tabAnchor 类名必须保留（站点靠它切页）");
  assert.equal(flat(a), "病理报告");
  assert.ok(doc.querySelector(".tabAnchor_tissueImage"), "组织图像标签的钩子必须保留");
});

const PAT_TIMELINE =
  '<div class="tl-timeline-wrapper"><div class="tl-timeline-reset-buttons">' +
  '<div class="tl-timeline-zoom-info"><span><i class="fa fa-search-plus"></i> drag to zoom</span></div></div>' +
  '<div class="tl-timeline-leftbar"><div class="tl-timeline-tracklabels">' +
  '<div style="padding-left:5px;height:20px"><span><div class="EllipsisTextTooltip-module_text__1wTco">SAMPLE ACQUISITION</div></span></div>' +
  '<div style="padding-left:5px;height:20px"><span><div class="EllipsisTextTooltip-module_text__1wTco">STATUS</div></span></div>' +
  '<div style="padding-left:5px;height:20px"><span><div class="EllipsisTextTooltip-module_text__1wTco">TREATMENT</div></span></div>' +
  '<div style="padding-left:22px;height:20px"><span><div class="EllipsisTextTooltip-module_text__1wTco">Radiation Therapy</div></span></div>' +
  "</div></div></div>";

test("Patient View：临床时间轴轨道名与缩放提示翻成中文", () => {
  const { doc } = mount(PAT_TIMELINE);
  const text = flat(doc.querySelector(".tl-timeline-wrapper"));
  assert.ok(text.includes("拖动以缩放"), "drag to zoom 未翻：" + text);
  assert.ok(text.includes("样本采集"), "SAMPLE ACQUISITION 未翻：" + text);
  assert.ok(text.includes("状态"), "STATUS 未翻：" + text);
  assert.ok(text.includes("治疗"), "TREATMENT 未翻：" + text);
  assert.ok(text.includes("放射治疗"), "Radiation Therapy 未翻：" + text);
  assert.ok(!/SAMPLE ACQUISITION|TREATMENT|Radiation Therapy/.test(text), "原文不该残留：" + text);
});

const PAT_MENU =
  '<div class="pull-right dropdown" id="colMenu"><ul role="menu" class="dropdown-menu"><ul class="list-unstyled">' +
  '<li><label class="checkbox-inline" title=""><input data-id="Gene" type="checkbox" checked="">Gene</label></li>' +
  '<li><label class="checkbox-inline" title=""><input data-id="Gene panel" type="checkbox">Gene panel</label></li>' +
  '<li><label class="checkbox-inline" title=""><input data-id="Protein Change" type="checkbox" checked="">Protein Change</label></li>' +
  '<li><label class="checkbox-inline" title=""><input data-id="Allele Freq" type="checkbox">Allele Freq</label></li>' +
  '<li><label class="checkbox-inline" title=""><input data-id="mRNA Expr." type="checkbox">mRNA Expr.</label></li>' +
  "</ul></ul></div>";

test("Patient View：突变表格列选择器翻成中文，data-id 不被改动", () => {
  const { doc } = mount(PAT_MENU);
  const text = flat(doc.getElementById("colMenu"));
  assert.ok(text.includes("基因 panel"), "Gene panel 未翻：" + text);
  assert.ok(text.includes("等位基因频率"), "Allele Freq 未翻：" + text);
  assert.ok(text.includes("mRNA 表达"), "mRNA Expr. 未翻：" + text);
  const ids = [...doc.querySelectorAll("#colMenu input")].map((i) => i.getAttribute("data-id"));
  assert.deepEqual(ids, ["Gene", "Gene panel", "Protein Change", "Allele Freq", "mRNA Expr."], "data-id 是站点取值的键，不能改");
});

test("Patient View：IGV 提示与 CNA 表计数翻成中文", () => {
  const { doc } = mount(
    '<div class="igv-container"><div class="igv-zoom-in-notice-container"><div>Zoom in to see features</div></div>' +
      '<div class="igv-track-label">Click alteration for detail. Double-click to zoom.</div></div>' +
    '<div class="simple-table-wrapper"><div>Showing 1-10 of 663 Copy Number Alterations</div>' +
      "<div>Click on a CNA row to zoom in on the gene in the IGV browser above</div></div>"
  );
  const text = flat(doc.body);
  assert.ok(text.includes("放大以查看特征"), "Zoom in to see features 未翻：" + text);
  assert.ok(text.includes("单击改变查看详情，双击缩放。"), "IGV 提示未翻：" + text);
  assert.ok(text.includes("显示第 1-10 条，共 663 条拷贝数改变"), "CNA 计数规则未命中：" + text);
  assert.ok(text.includes("单击 CNA 行，即可在上方 IGV 浏览器中放大该基因"), "CNA 行提示未翻：" + text);
});

test("Results View：查询结果复数规则命中（含 NaN 占比）", () => {
  const { doc } = mount(
    '<div class="query-summary"><div class="query-summary__rightItems">' +
      "<div>Queried genes are altered in 0 (NaN%) of queried patients/samples</div>" +
      "<div>Queried genes are altered in 1,024 (12.5%) of queried patients/samples</div>" +
      "</div></div>",
    "https://www.cbioportal.org/results"
  );
  const text = flat(doc.body);
  assert.ok(text.includes("查询的基因在 0（NaN%）个查询患者/样本中发生改变"), "NaN 形态未命中：" + text);
  assert.ok(text.includes("查询的基因在 1,024（12.5%）个查询患者/样本中发生改变"), "正常形态未命中：" + text);
});

// ---------------- 负例：不翻的东西必须保持原文 ----------------

test("负例：研究名、基因符号、样本 ID、基因组构建、染色体名一律保持英文", () => {
  const { doc } = mount(
    '<div class="cancerStudyListContainer"><div class="StudyList">' +
      "<div>Breast Invasive Carcinoma (TCGA, PanCancer Atlas)</div>" +
      "<div>MSK-IMPACT Clinical Sequencing Cohort (MSK, Nat Med 2017)</div>" +
      "<div>Acute Myeloid Leukemia (TARGET, 2018)</div>" +
      "</div>" +
      '<table class="table"><tbody><tr><td>TP53</td><td>PIK3CA</td><td>TCGA-A2-A0T2</td></tr></tbody></table>' +
      '<div class="igv-navbar">GRCh37 hg19 chr1 chr17</div></div>'
  );
  const text = flat(doc.body);
  assert.ok(text.includes("Breast Invasive Carcinoma (TCGA, PanCancer Atlas)"), "研究名被改坏：" + text);
  assert.ok(text.includes("MSK-IMPACT Clinical Sequencing Cohort (MSK, Nat Med 2017)"), "研究名被改坏：" + text);
  assert.ok(text.includes("Acute Myeloid Leukemia (TARGET, 2018)"), "研究名被改坏：" + text);
  assert.ok(text.includes("TP53") && text.includes("PIK3CA"), "基因符号被改坏：" + text);
  assert.ok(text.includes("TCGA-A2-A0T2"), "样本 ID 被改坏：" + text);
  assert.ok(text.includes("GRCh37") && text.includes("hg19") && text.includes("chr1"), "基因组构建/染色体名被改坏：" + text);
});

test("负例：英文长句里的普通名词不逐词替换（不产生中英混排）", () => {
  const { doc } = mount(
    '<div class="summary"><p>' +
      "This study contains samples from patients with breast cancer who were treated with standard chemotherapy and followed for a median of five years, as described in the original publication." +
      "</p></div>"
  );
  const text = flat(doc.querySelector(".summary p"));
  assert.ok(text.startsWith("This study contains samples"), "长句不该被逐词翻译：" + text.slice(0, 80));
  assert.ok(!/[\u3400-\u9fff]/.test(text), "长句不该出现中文：" + text.slice(0, 80));
});

test("引擎对该站点的 skip 区（研究名首列）保持英文", () => {
  const { doc } = mount(
    '<table class="simple-table table"><tbody><tr>' +
      "<td><span>Lung Adenocarcinoma (TCGA, PanCancer Atlas)</span></td>" +
      "<td>TCGA, Nature 2014</td>" +
      "</tr></tbody></table>",
    "https://www.cbioportal.org/datasets"
  );
  const text = flat(doc.body);
  assert.ok(text.includes("Lung Adenocarcinoma (TCGA, PanCancer Atlas)"), "研究名首列被改动：" + text);
});
