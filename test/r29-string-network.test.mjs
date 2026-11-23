// STRING 网络页分析面板 / 设置与导出弹层 / 多蛋白输入表单（r29）回归：
// 词库结构、分析面板表头与富集可视化枚举、弹层标题与固定说明句、规则与模板、jsdom 渲染与不误翻用例。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, "../dict", f), "utf8"));

const dict = read("string-atlas.json");
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;
const SITE = { scope: "body", block: "pre, code", rescan: false };
const URL_NETWORK = "https://string-db.org/network/9606.ENSP00000269305";

function siteData() {
  const books = ["common.json", "string-atlas.json"];
  const exact = {}, rules = [], templates = [];
  for (const f of books) {
    if (!fs.existsSync(path.join(root, "../dict", f))) continue;
    const d = read(f);
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
    templates.push(...(d.templates || []));
  }
  return { exact, rules, templates };
}

function boot(html, url) {
  const dom = new JSDOM(html, { url: url || URL_NETWORK });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: siteData(),
    site: SITE
  });
  engine.start();
  return { dom, engine, doc: dom.window.document };
}

test("r29 词库结构：新增条目后规模、字段规整与占位符一致", () => {
  const exact = Object.entries(dict.exact || {});
  assert.ok(exact.length >= 660, "exact 条目不足: " + exact.length);
  assert.ok((dict.rules || []).length >= 34, "规则不足: " + (dict.rules || []).length);
  assert.ok((dict.templates || []).length >= 35, "模板不足: " + (dict.templates || []).length);
  const bad = [];
  for (const [en, zh] of exact) {
    if (en !== en.trim()) bad.push("键首尾空白: " + JSON.stringify(en));
    if (/\s\s/.test(en)) bad.push("键含连续空白: " + JSON.stringify(en));
    if (CJK.test(en)) bad.push("键含中文: " + en);
    if (!zh || zh !== zh.trim()) bad.push("空译文/首尾空白: " + en);
    if (!CJK.test(zh)) bad.push("译文无中文: " + en);
    if (en === zh) bad.push("自映射: " + en);
    if (/https?:\/\/|www\./.test(zh)) bad.push("译文含 URL: " + en);
  }
  for (const r of dict.rules || []) {
    let re;
    try { re = new RegExp(r.re); } catch (e) { bad.push("正则非法: " + r.re); continue; }
    if (!/^\^/.test(r.re) || !/\$$/.test(r.re)) bad.push("未锚定: " + r.re);
    const groups = (re.source.match(/\((?!\?)/g) || []).length;
    for (const m of r.to.matchAll(/\$(\d)/g)) if (Number(m[1]) > groups) bad.push("占位符越界: " + r.re);
  }
  for (const t of dict.templates || []) {
    const slots = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    const uniq = [...new Set(slots)].sort((a, b) => a - b);
    if (uniq.join(",") !== Array.from({ length: slots.length }, (_, i) => i + 1).join(",")) bad.push("槽位不连续: " + t.pat.slice(0, 40));
    const zhSlots = [...new Set([...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
    if (zhSlots.join(",") !== uniq.join(",")) bad.push("译文槽位不一致: " + t.pat.slice(0, 40));
  }
  assert.deepEqual(bad, []);
});

test("r29 分析面板：网络统计、富集表表头与分类标题", () => {
  const { engine } = boot("<body></body>");
  const cases = {
    "average node degree:": "平均节点度：",
    "avg. local clustering coefficient:": "平均局部聚类系数：",
    "expected number of edges:": "期望边数：",
    "PPI enrichment p-value:": "PPI 富集 P 值：",
    "what does that mean?": "这是什么意思？",
    "GO-term": "GO 术语",
    "count in network": "网络内数量",
    "Count In Network:": "网络内数量：",
    "strength": "强度",
    "signal": "信号",
    "false discovery rate": "假发现率",
    "(year) title": "（年份）标题",
    "compartment": "区室",
    "(more ...)": "（更多…）",
    "(less ...)": "（收起…）",
    "Biological Process (Gene Ontology)": "生物学过程（基因本体）",
    "Molecular Function (Gene Ontology)": "分子功能（基因本体）",
    "Cellular Component (Gene Ontology)": "细胞组分（基因本体）",
    "Reference Publications (PubMed)": "参考文献（PubMed）",
    "Reactome Pathways": "Reactome 通路",
    "Tissue Expression (TISSUES)": "组织表达（TISSUES）",
    "Subcellular Localization (COMPARTMENTS)": "亚细胞定位（COMPARTMENTS）",
    "Human Phenotype (Monarch)": "人类表型（Monarch）",
    "Annotated Keywords (UniProt)": "注释关键词（UniProt）",
    "Protein Domains (SMART)": "蛋白质结构域（SMART）",
    "Functional enrichment visualization": "功能富集可视化"
  };
  for (const [en, zh] of Object.entries(cases)) {
    assert.equal(engine.translateText(en), zh, "未命中: " + en);
  }
});

test("r29 富集可视化设置：下拉枚举与导出表格勾选项", () => {
  const { engine } = boot("<body></body>");
  const cases = {
    "selected terms only": "仅选中的术语",
    "Selected terms only": "仅选中的术语",
    "Graph type:": "图表类型：",
    "dot plot": "点图",
    "bar chart": "条形图",
    "Group terms by:": "术语分组方式：",
    "don't group": "不分组",
    "Nr. of terms shown:": "显示的术语数：",
    "Sort table/terms by:": "表格/术语排序依据：",
    "gene count": "基因数",
    "Gene count": "基因数",
    "Color Palette:": "配色方案：",
    "mint - blue": "薄荷绿 - 蓝",
    "red - blue": "红 - 蓝",
    "lime - emerald": "青柠 - 翠绿",
    "green - blue": "绿 - 蓝",
    "peach - purple": "桃 - 紫",
    "straw - navy": "麦秆 - 藏青",
    "yellow - pink": "黄 - 粉",
    "X-axis:": "X 轴：",
    "Highlight selected terms:": "高亮选中的术语：",
    "Merge rows by term similarity:": "按术语相似度合并行：",
    "don't merge": "不合并",
    "Maximum FDR shown:": "显示的最大 FDR：",
    "Minimum signal shown:": "显示的最小信号：",
    "Minimum strength shown:": "显示的最小强度：",
    "Minimum count in network:": "网络内最小数量：",
    "Row Visibility:": "行可见性：",
    "Display only selected rows": "仅显示选中的行",
    "Show enriched terms as:": "富集术语显示为：",
    "pie (inside)": "饼图（内部）",
    "donut (around)": "环形（外围）",
    "heat strip (below)": "热条（下方）",
    "Draw absent terms": "绘制缺失术语",
    "Statistical background": "统计背景",
    "whole genome": "全基因组",
    "Add Background": "添加背景",
    "Save / Export": "保存 / 导出",
    "All enriched terms": "全部富集术语",
    "Download vector image (SVG)": "下载矢量图（SVG）",
    "Download bitmap image (PNG)": "下载位图（PNG）",
    "no enriched terms selected (click on any term above to select)": "未选中任何富集术语（点击上方任一条术语即可选中）",
    "one single selected enriched term; file-format: tab-delimited": "仅选中一个富集术语；文件格式：制表符分隔",
    "one single domain is enriched; file-format: tab-delimited": "仅一个结构域显著富集；文件格式：制表符分隔"
  };
  for (const [en, zh] of Object.entries(cases)) {
    assert.equal(engine.translateText(en), zh, "未命中: " + en);
  }
});

test("r29 弹层：设置项说明窗口标题与表头解释", () => {
  const { engine } = boot("<body></body>");
  const cases = {
    "Network type": "网络类型",
    "Network edges": "网络边",
    "Evidence channel toggle": "证据通道开关",
    "Link score threshold": "连接得分阈值",
    "Network expansion": "网络扩展",
    "Warning": "警告",
    "Interaction Enrichment": "互作富集",
    "Enrichment Table Columns": "富集表各列",
    "Evidence view": "证据视图",
    "Confidence view": "可信度视图",
    "Typed view": "分型视图",
    "1st shell": "第一层",
    "2nd shell": "第二层",
    "Count In Network:": "网络内数量：",
    "Strength:": "强度：",
    "Signal:": "信号：",
    "False Discovery Rate:": "假发现率：",
    "Learn more about the network types": "进一步了解网络类型",
    "Learn more about network edges": "进一步了解网络边",
    "Learn more about different evidence channels": "进一步了解不同的证据通道",
    "Learn more about filtering by channel": "进一步了解按通道筛选",
    "Learn more about STRING scores": "进一步了解 STRING 得分",
    "Learn more about choosing the threshold": "进一步了解如何选择阈值",
    "Learn more about network expansion": "进一步了解网络扩展"
  };
  for (const [en, zh] of Object.entries(cases)) {
    assert.equal(engine.translateText(en), zh, "未命中: " + en);
  }
});

test("r29 固定说明句：设置弹层与列解释整段", () => {
  const { engine } = boot("<body></body>");
  assert.equal(
    engine.translateText(
      "Select the network type. This determines what the edges represent."
    ),
    "选择网络类型。这决定了边的含义。"
  );
  assert.equal(
    engine.translateText(
      "A single edge is shown between proteins. The thickness and opacity of the edge reflect the overall confidence score combining all evidence channels."
    ),
    "蛋白质之间只显示一条边。边的粗细与不透明度反映综合所有证据通道的总体可信度得分。"
  );
  assert.equal(
    engine.translateText(
      "Scores from the different channels are calibrated in the same way, so a given score has the same meaning regardless of the evidence source."
    ),
    "各通道的得分采用相同方式校准，因此同一分值不论来自哪种证据来源，含义都相同。"
  );
  assert.equal(
    engine.translateText(
      "The interaction score reflects the confidence that an association between two proteins exists. Only edges with a score at or above the selected threshold are shown in the network."
    ),
    "互作得分反映两个蛋白质之间存在关联的可信度。网络中只显示得分达到所选阈值的边。"
  );
  assert.equal(
    engine.translateText(
      "Proteins are selected based on their associations with the original query proteins. These nodes are shown in color."
    ),
    "按与原始查询蛋白质的关联程度选取蛋白质。这些节点以彩色显示。"
  );
  assert.equal(
    engine.translateText(
      "Log10(observed / expected). This measure describes how large the enrichment effect is. It\u2019s the ratio between i) the number of proteins in your network that are annotated with a term and ii) the number of proteins that we expect to be annotated with this term in a random network of the same size."
    ),
    "Log10（观测值 / 期望值）。该指标描述富集效应的大小，即 i) 您网络中被注释上某术语的蛋白质数量与 ii) 在同样大小的随机网络中预期被注释上该术语的蛋白质数量之比。"
  );
});

test("r29 规则：可视化枚举、导出计数与被字符串化的相似度", () => {
  const { engine } = boot("<body></body>");
  const cases = [
    ["similarity = 1.0", "相似度 = 1.0"],
    ["similarity >= 0.8", "相似度 ≥ 0.8"],
    ["FDR <= 0.01", "假发现率 ≤ 0.01"],
    ["FDR <= 1e-05", "假发现率 ≤ 1e-05"],
    ["signal >= 0.50", "信号 ≥ 0.50"],
    ["strength >= 1.25", "强度 ≥ 1.25"],
    ["Druggable Genome (4669 Genes)", "可成药基因组（4669 个基因）"],
    ["Groups at similarity 0.8", "相似度 0.8 的分组"],
    ["107 GO-terms significantly enriched; file-format: tab-delimited", "107 个 GO 术语显著富集；文件格式：制表符分隔"],
    ["10000 publications significantly enriched; file-format: tab-delimited", "10000 篇文献显著富集；文件格式：制表符分隔"],
    ["82 pathways significantly enriched; file-format: tab-delimited", "82 条通路显著富集；文件格式：制表符分隔"],
    ["10 tissues significantly enriched; file-format: tab-delimited", "10 个组织显著富集；文件格式：制表符分隔"],
    ["12 compartments significantly enriched; file-format: tab-delimited", "12 个区室显著富集；文件格式：制表符分隔"],
    ["2 phenotypes significantly enriched; file-format: tab-delimited", "2 个表型显著富集；文件格式：制表符分隔"],
    ["13 keywords significantly enriched; file-format: tab-delimited", "13 个关键词显著富集；文件格式：制表符分隔"],
    ["416 enriched terms in 11 categories; file-format: tab-delimited", "11 个类别中共 416 个富集术语；文件格式：制表符分隔"],
    ["Biological Process (Gene Ontology) enrichment", "生物学过程（基因本体）富集"],
    ["KEGG Pathways enrichment", "KEGG 通路富集"]
  ];
  for (const [en, zh] of cases) assert.equal(engine.translateText(en), zh, "规则未命中: " + en);
});

test("r29 jsdom：统计背景整句保留换行，导出列保留加粗与链接", () => {
  const { doc } = boot(
    "<body>" +
      "<div class=\"legend_info_box\">For the above enrichment analysis, <br>the following statistical background <br>is assumed:</div>" +
      "<div class=\"cell exporttablecolumn1\"><b>All enriched terms</b> (without PubMed)</div>" +
      "<div class=\"exporttablecolumn3\"><span class=\"count\">3</span> selected enriched terms; file-format: tab-delimited</div>" +
      "<div class=\"enrichment_statistic\">This measure describes how significant the enrichment is. Shown are p-values corrected for multiple testing within each category using the" +
      '<a target="_blank" href="https://en.wikipedia.org/wiki/False_discovery_rate">Benjamini\u2013Hochberg procedure</a>.</div>' +
      "</body>"
  );
  const divs = [...doc.querySelectorAll("div")];
  assert.match(divs[0].textContent, /^上述富集分析假定使用以下统计背景：/);
  assert.equal(divs[0].querySelectorAll("br").length, 2, "两处换行应保留");
  assert.equal(divs[1].textContent, "全部富集术语（不含 PubMed）");
  assert.equal(divs[1].querySelector("b").textContent, "全部富集术语");
  assert.equal(divs[2].textContent, "3 个选中的富集术语；文件格式：制表符分隔");
  assert.match(divs[3].textContent, /^该指标描述富集的显著性。/);
  const link = divs[3].querySelector("a");
  assert.equal(link.textContent, "Benjamini\u2013Hochberg procedure", "方法名链接保持原文");
  assert.equal(link.getAttribute("href"), "https://en.wikipedia.org/wiki/False_discovery_rate");
});

test("r29 jsdom：分析面板表头与设置下拉渲染", () => {
  const { doc } = boot(
    '<body><div class="main_page_content_container">' +
      '<div class="network_statistics_table">' +
      '<div class="stat_label">average node degree:</div><div class="stat_value">3.82</div>' +
      '<div class="stat_label">PPI enrichment p-value:</div><div class="stat_value">0.645</div>' +
      "</div>" +
      '<div id="enrichment_visualization">' +
      '<div class="legend_headline">Functional enrichment visualization</div>' +
      '<div class="analysis_table_settings_first_cell data_">Graph type:</div>' +
      '<select id="graph_type"><option value="dot">dot plot</option><option value="bar">bar chart</option></select>' +
      '<div class="analysis_table_settings_first_cell data_">Color Palette:</div>' +
      '<select id="palette"><option value="1">mint - blue</option><option value="2">red - blue</option></select>' +
      '<label><input type="checkbox" id="draw_absent"> Draw absent terms</label>' +
      '<a class="download" href="/x">Download vector image (SVG)</a>' +
      "</div>" +
      '<div class="global_enrichment_table_headline">Biological Process (Gene Ontology)</div>' +
      '<table><thead><tr><th><span>GO-term</span></th><th><span class="desc">description</span></th>' +
      "<th><span>count in network</span></th><th><span>strength</span></th><th><span>signal</span></th>" +
      "<th><span>false discovery rate</span></th></tr></thead></table>" +
      "</div></body>"
  );
  assert.equal(doc.querySelector(".stat_label").textContent, "平均节点度：");
  assert.equal(doc.querySelectorAll(".stat_label")[1].textContent, "PPI 富集 P 值：");
  assert.equal(doc.querySelector(".stat_value").textContent, "3.82", "数值不翻");
  const opts = [...doc.querySelectorAll("#graph_type option")].map((o) => o.textContent);
  assert.deepEqual(opts, ["点图", "条形图"]);
  assert.deepEqual(
    [...doc.querySelectorAll("#palette option")].map((o) => o.textContent),
    ["薄荷绿 - 蓝", "红 - 蓝"]
  );
  assert.equal(doc.querySelector("#palette option").getAttribute("value"), "1", "option value 不动");
  assert.match(doc.querySelector("label").textContent, /绘制缺失术语/);
  assert.equal(doc.querySelector("a.download").textContent, "下载矢量图（SVG）");
  assert.equal(doc.querySelector(".global_enrichment_table_headline").textContent, "生物学过程（基因本体）");
  const heads = [...doc.querySelectorAll("th")].map((th) => th.textContent);
  assert.deepEqual(heads, ["GO 术语", "描述", "网络内数量", "强度", "信号", "假发现率"]);
});

test("r29 不误翻：蛋白名、登录号、GO 编号、通路号、物种名与数值", () => {
  const { engine } = boot("<body></body>");
  for (const s of [
    "TBP",
    "ENSP00000269305",
    "Homo sapiens",
    "GO:0009299",
    "hsa04218",
    "HP:0031413",
    "PPI enrichment p-value: 0.645",
    "4.46e-05"
  ]) {
    assert.equal(engine.translateText(s), null, "不应翻译: " + s);
  }
});
