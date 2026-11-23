// r26 GTEx Portal 界面文案：数据集页 / 组织页 / eQTL 仪表盘 / 基因页（dict/gtex-home.json）。
// 断言口径：translateText(真实 DOM 原串) 必须返回登记译文；未登记串必须返回 null（防误伤）。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();

const ATTRIBUTE_TITLE = "Expression values are shown in TPM (Transcripts Per Million), calculated from a gene model with isoforms collapsed to a single gene (see Datasets -> Download -> Reference). No other normalization steps have been applied. Box plots are shown as median and 25th and 75th percentiles; points are displayed as outliers if they are above or below 1.5 times the interquartile range.";
const ATTRIBUTE_EXON = "<p>Exon-level expression is calculated based on a collapsed gene model. To learn more about the collapsing transcript model, go to Documentation: Analysis Methods. In the exon view, the heatmap summarizes the median read counts per base of each exon of the collapsed gene model across all tissues. The tissues (rows) are hierarchically clustered, using the Euclidean distance and average linkage. The dendrogram scale shows the cluster distance. The exons (columns) are ordered based on genomic location. Below the heatmap, the collapsed gene model is illustrated: exons are represented as rectangles, and introns are scaled up to 1 kb long. Additionally, the junctions between joined exons of all splice variants are mapped out on the model as arcs. At times, an exon on the gene model may show dashed-line borders, which indicates that the exon or part of it has been filtered in the final collapsed model. The individual isoform structures are illustrated below the gene model. By clicking a tissue label (a row label) on the heatmap, the gene model and isoform tracks will change colors scaled by tissue-specific expression; a lollipop plot will appear next to the isoform tracks summarizing the isoform-level expression in the tissue.</p> <p>In the junction view, the heatmap summarizes the median raw read counts of junctions from individual isoforms. The tissues (rows) are hierarchically clustered based on the junction expression data, and the junctions (columns) are sorted by genomic location.</p> <p>In the isoform expression view, the median expression of each isoform in each tissue is summarized using a heatmap. The tissues (rows) and isoforms (columns) are ordered based on hierarchical clustering. </p> <p>All expression quantifications are described in the Documentation: Analysis Methods -> Expression Quantification section of the portal. </p>";

function load(...names) {
  const exact = {};
  const rules = [];
  const templates = [];
  for (const n of names) {
    const d = JSON.parse(fs.readFileSync(path.join(root, "../dict/" + n + ".json"), "utf8"));
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
    templates.push(...(d.templates || []));
  }
  return { exact, rules, templates };
}

function boot(data, html = "<p>x</p>") {
  const dom = new JSDOM(html, { url: "https://gtexportal.org/home/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data,
    site: { scope: "", block: "pre, code", attrs: ["placeholder", "title", "aria-label"], rescan: [] }
  });
  engine.start();
  return { engine, doc: dom.window.document };
}

const data = load("common", "gtex", "gtex-home");

// 数据集页 / 组织页 / 基因页 / eQTL 仪表盘：本轮新增的界面固定文案
const entries = {
  "Copy URL to clipboard": "复制链接到剪贴板",
  "Search query": "搜索关键词",
  Metadata: "元数据",
  "RNA-Seq": "RNA 测序",
  here: "此处",
  "Main Sampling Site": "主要采样部位",
  "With Genotype": "有基因型数据",
  "Number of Samples": "样本数",
  "Gene Expression": "基因表达",
  Female: "女性",
  Male: "男性",
  "Bulk Tissue RNA-Seq Sample Info": "批量组织 RNA-Seq 样本信息",
  "Mitochondrial genes are excluded.": "已排除线粒体基因。",
  "QTL analysis results are available for tissues with >70 samples with genotype data": "QTL 分析结果仅提供基因型样本数 >70 的组织",
  "The following interactive heat map reports the top 50 expressed genes in": "以下交互式热图展示",
  "as well as their expression profiles across all tissues.": "中表达量最高的 50 个基因，以及它们在所有组织中的表达谱。",
  "Information about this GTEx tissue is available to view at": "该 GTEx 组织的相关信息可在以下位置查看：",
  "Tissue Sites Mapped to HuBMAP Human Reference Atlas": "映射到 HuBMAP 人类参考图谱的组织位点",
  "Created by Mariya Kahn and the GTEx Portal team": "由 Mariya Kahn 与 GTEx 门户团队创建",
  "Chart: GTEx samples by tissue": "图表：各组织的 GTEx 样本数",
  "GTEx eQTL Dashboard": "GTEx eQTL 仪表盘",
  "Enter Gene-Variant Pairs": "输入基因-变异对",
  "Limited to 30 entries.": "最多 30 条。",
  "Example search": "示例检索",
  "Select Tissue(s)": "选择组织",
  "For example: ENSG00000248746.5,chr11_66561248_T_C_b38": "例如：ENSG00000248746.5,chr11_66561248_T_C_b38",
  "This repository is under review for potential modification in compliance with Administration directives.": "本数据仓库正在接受审查，可能依据行政指令进行修改。",
  Anatomagram: "解剖图"
};

test("r26 新增词条逐条命中，且译文含汉字", () => {
  const { engine } = boot(data);
  for (const [srcText, want] of Object.entries(entries)) {
    assert.equal(data.exact[srcText], want, "词库缺条目：" + srcText);
    assert.equal(engine.translateText(srcText), want, "未命中：" + srcText);
    assert.match(want, /[\u4e00-\u9fff]/, "译文不含汉字：" + srcText);
  }
});

test("r26 数据集页表格说明规则：无句末点的 A data dictionary 也能命中", () => {
  const { engine } = boot(data);
  const cases = {
    "A data dictionary that describes each variable in the GTEx_Data_V6_Annotations_SampleAttributesDS.txt": "描述 GTEx_Data_V6_Annotations_SampleAttributesDS.txt 中每个变量的数据字典。",
    "A data dictionary that describes each variable in the GTEx_v7_Annotations_SampleAttributesDS.txt": "描述 GTEx_v7_Annotations_SampleAttributesDS.txt 中每个变量的数据字典。",
    "A data dictionary that describes each variable in the GTEx_Analysis_Annotations_SampleDS__Pilot_V3.txt": "描述 GTEx_Analysis_Annotations_SampleDS__Pilot_V3.txt 中每个变量的数据字典。"
  };
  for (const [srcText, want] of Object.entries(cases)) {
    assert.equal(engine.translateText(srcText), want, "未命中：" + srcText);
  }
});

test("r26 组织页表题与数据集分组标题规则", () => {
  const { engine } = boot(data);
  assert.equal(engine.translateText("Table: Sample count in Liver"), "表格：Liver 的样本数");
  assert.equal(engine.translateText("Table: Sample count in Kidney Cortex"), "表格：Kidney Cortex 的样本数");
  assert.equal(engine.translateText("GTEx Analysis V6p"), "GTEx 分析 V6p");
  assert.equal(engine.translateText("GTEx Analysis V11"), "GTEx 分析 V11");
  assert.equal(engine.translateText("GTEx Analysis Pilot V3"), "GTEx 分析 Pilot V3");
});

test("r26 基因页两段 ⓘ 帮助文本（title 属性整串）命中", () => {
  const { engine } = boot(data);
  const a = engine.translateText(ATTRIBUTE_TITLE);
  assert.match(a, /表达值以 TPM/, "TPM 说明未命中");
  assert.match(a, /四分位距 1\.5 倍/);
  const b = engine.translateText(ATTRIBUTE_EXON);
  assert.ok(b && b.startsWith("<p>外显子水平表达"), "外显子说明未命中");
  assert.match(b, /<p>在接头视图中/);
  assert.match(b, /<p>在异构体表达视图中/);
});

test("r26 title / placeholder 属性在 start 后变中文，summary=\"false\" 不动", () => {
  const dom = new JSDOM(
    '<span id="copy" title="Copy URL to clipboard"></span>' +
      '<input id="q" placeholder="Search query">' +
      '<table id="t" summary="false"></table>' +
      '<span id="info"></span>',
    { url: "https://gtexportal.org/home/downloads/adult-gtex/overview" }
  );
  dom.window.document.getElementById("info").setAttribute("title", ATTRIBUTE_TITLE);
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data,
    site: { scope: "", block: "pre, code", attrs: ["placeholder", "title", "aria-label"], rescan: [] }
  });
  engine.start();
  const doc = dom.window.document;
  assert.equal(doc.getElementById("copy").getAttribute("title"), "复制链接到剪贴板");
  assert.equal(doc.getElementById("q").getAttribute("placeholder"), "搜索关键词");
  assert.equal(doc.getElementById("t").getAttribute("summary"), "false");
  assert.match(doc.getElementById("info").getAttribute("title"), /^表达值以 TPM/, "基因页 ⓘ 帮助文本没走属性通道");
});

test("r26 数据串不误伤：文件名 / 组织名 / 版本号 / 纯标签保持原样", () => {
  const { engine } = boot(data);
  const keep = [
    "GTEx_Analysis_2025-08-22_v11_RSEMv1.3.3_transcripts_expected_count.txt.gz",
    "Adipose Subcutaneous",
    "V11",
    "QTL",
    "TPM",
    "LIVER",
    "UBERON:0001114",
    "https://doi.org/10.1126/science.aaz1776"
  ];
  for (const s of keep) assert.equal(engine.translateText(s), null, "不该命中：" + s);
});
