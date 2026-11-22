// Ensembl BioMart 词库（dict/biomart.json）冒烟测试：工具栏、摘要面板、数据集选择、Filters、Attributes、Results/导出
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/biomart.json"), "utf8"));
const books = ["common", "spa", "ensembl", "ensembl-extra", "ensembl-tpl", "ensembl2"].map((n) =>
  JSON.parse(fs.readFileSync(path.join(root, "../dict/" + n + ".json"), "utf8"))
);

// sites.json 尚未登记 BioMart；这里按推荐条目构造站点配置（dicts 顺序与建议一致）
// attrs 追加 value：导出区的 Go 是 <input type="submit" value="Go">，只有 value 通道能翻可见按钮文字
// 生产环境里 config/sites.json 的 defaults.attrs 已含 value，这里直接传进 engine 复现该行为
const site = {
  id: "biomart",
  name: "Ensembl BioMart",
  hosts: ["jun2026.archive.ensembl.org", "*.archive.ensembl.org"],
  dicts: ["common", "spa", "ensembl", "ensembl-extra", "ensembl-tpl", "ensembl2", "biomart"],
  scope: "body",
  spa: true,
  waitFor: "body",
  attrs: ["value"]
};

// 站点实际加载的是 ensembl 系列词典（本册接入后再加上本册），合并后的词表才是页面真实行为
const all = {
  exact: Object.assign({}, ...books.map((b) => b.exact), dict.exact),
  rules: [...books.flatMap((b) => b.rules || []), ...dict.rules],
  templates: [...books.flatMap((b) => b.templates || []), ...dict.templates]
};

const CJK = /[\u4e00-\u9fff]/;
const URL = "https://jun2026.archive.ensembl.org/biomart/martview/5d05e49eed1c9e888b1aa91be6aaf61e";

function engineFor(html) {
  const dom = new JSDOM(html, { url: URL });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: all,
    site
  });
  engine.start();
  return { doc: dom.window.document, engine };
}

const anyEngine = engineFor("<p>x</p>").engine;
function covers(k) {
  return k in all.exact || anyEngine.translateText(k) !== null;
}
function text(el) {
  return el.textContent.replace(/\s+/g, " ").trim();
}

test("词库结构：family/sites 正确，exact 有足够条目且译文都含汉字", () => {
  assert.equal(dict.meta.family, "biomart");
  assert.ok(dict.meta.sites.includes("jun2026.archive.ensembl.org"), "sites 应包含实测主机");
  const keys = Object.keys(dict.exact);
  assert.ok(keys.length >= 200, "exact 只有 " + keys.length + " 条");
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.notEqual(v, k, "自映射: " + k);
    assert.match(v, CJK, "译文不含汉字: " + k + " => " + v);
  }
  assert.ok(dict.rules.length >= 2, "规则太少");
  for (const r of dict.rules) {
    assert.doesNotThrow(() => new RegExp(r.re), "坏正则: " + r.re);
    assert.match(r.to, CJK, "规则译文不含汉字: " + r.re);
    assert.ok(/\((?!\?)/.test(r.re), "规则没有捕获组: " + r.re);
  }
  const tpl = dict.templates || [];
  assert.ok(Array.isArray(tpl), "templates 必须是数组");
  for (const t of tpl) {
    assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, "模板 pat 长度越界: " + t.pat.length);
    assert.match(t.zh, CJK, "模板译文不含汉字: " + t.pat);
    const slots = (t.pat.match(/\{\{\d+\}\}/g) || []).length;
    assert.ok(slots >= 1, "模板没有槽位: " + t.pat);
    for (let i = 1; i <= slots; i++) assert.ok(t.pat.includes("{{" + i + "}}"), "槽位不连续: " + t.pat);
    assert.equal((t.zh.match(/\{\{\d+\}\}/g) || []).length, slots, "译文槽位数不一致: " + t.pat);
  }
});

test("条目卫生：key 不含中文、首尾无空白，值里没有明文 URL / 邮箱", () => {
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.doesNotMatch(k, CJK, "key 含中文: " + k);
    assert.equal(k, k.trim(), "key 首尾有空白: " + JSON.stringify(k));
    assert.equal(v, v.trim(), "值首尾有空白: " + k);
    assert.doesNotMatch(v, /https?:\/\//i, "值含明文 URL: " + k);
    assert.doesNotMatch(v, /[\w.+-]+@[\w-]+\.[\w.]+/, "值含明文邮箱: " + k);
    assert.doesNotMatch(k, /[\r\n]/, "key 含换行: " + k);
  }
});

test("工具栏、摘要面板与数据集选择", () => {
  const must = [
    "Start a new query",
    "Get result count for the query with any filters applied",
    "Preview the results of the query",
    "Show query in URL Access Format - Bookmark",
    "Show query in XML Web Service Format",
    "Show query as Perl Script",
    "Get Help",
    "Choose a main dataset to query",
    "Restrict your query by filtering",
    "Choose data you want to view or save",
    "Optional second dataset to combine in queries",
    "- CHOOSE DATABASE -",
    "- CHOOSE ADDITIONAL DATASET -",
    "[None selected]",
    "Dataset",
    "Filters",
    "Attributes",
    "Results",
    "Count",
    "Help",
    "New",
    "Go"
  ];
  for (const k of must) assert.ok(covers(k), "缺少条目: " + k);
});

test("Filters 面板：提示句、分组标题、筛选名与枚举", () => {
  const must = [
    "Please restrict your query using criteria below(If filter values are truncated in any lists, hover over the list item to see the full text)",
    "REGION:",
    "GENE:",
    "PHENOTYPE:",
    "GENE ONTOLOGY:",
    "MULTI SPECIES COMPARISONS:",
    "PROTEIN DOMAINS AND FAMILIES:",
    "VARIANT:",
    "Chromosome/scaffold",
    "Coordinates",
    "Start",
    "End",
    "Karyotype band",
    "Band Start",
    "Band End",
    "Marker",
    "Marker Start",
    "Marker End",
    "Multiple regions (Chr:Start:End:Strand) [Max 500 advised]",
    "e.g. 1:100:10000:-1, 1:100000:200000:1",
    "Limit to genes (external references)...",
    "Only",
    "Excluded",
    "Input external references ID list [Max 500 advised]",
    "Limit to genes (microarray probes/probesets)...",
    "Input microarray probes/probesets ID list [Max 500 advised]",
    "Transcript count >=",
    "Transcript count <=",
    "Gene type",
    "Transcript type",
    "Source (gene)",
    "Source (transcript)",
    "Transcript Support Level (TSL)",
    "GENCODE basic",
    "GENCODE primary",
    "APPRIS annotation",
    "Ensembl Canonical",
    "MANE Select",
    "MANE Plus clinical",
    "Phenotype",
    "Phenotype source",
    "GO Term Accession (e.g. GO:0050789) [Max 500 advised]",
    "GO Term Name [e.g. regulation of biological process]",
    "GO Evidence code",
    "Homologue filters",
    "Limit to genes ...",
    "Limit to genes with these family or domain IDs [Max 500 advised]",
    "Germline variant source",
    "Somatic variant source",
    "Variant supporting evidence",
    "Variant Consequence"
  ];
  for (const k of must) assert.ok(covers(k), "缺少条目: " + k);
});

test("Attributes / Results / 导出区：页签、collection 标题、表头与导出选项", () => {
  const must = [
    "Please select columns to be included in the output and hit 'Results' when ready",
    "Structures",
    "Homologues (Max select 6 orthologues)",
    "Variant (Germline)",
    "Variant (Somatic)",
    "Sequences",
    "External References",
    "Microarray probes/probesets",
    "Domains",
    "Protein features",
    "Exon Information",
    "Upstream flank",
    "Downstream flank",
    "Gene Information",
    "Transcript Information",
    "Variant",
    "Variants Location",
    "Gene Location and Effect",
    "Human Paralogues",
    "Gene stable ID",
    "Gene stable ID version",
    "Transcript stable ID",
    "Transcript stable ID version",
    "Protein stable ID",
    "Protein stable ID version",
    "Exon stable ID",
    "Gene description",
    "Chromosome/scaffold name",
    "Gene start (bp)",
    "Gene end (bp)",
    "Strand",
    "Transcript start (bp)",
    "Transcript end (bp)",
    "Transcription start site (TSS)",
    "Transcript length (including UTRs and CDS)",
    "Gene name",
    "Gene Synonym",
    "Export all results to",
    "Unique results only",
    "Email notification to",
    "View",
    "rows as",
    "File",
    "Compressed file (.gz)",
    "Compressed web file (notify by email)",
    "Datasets -> Filters (filtering and inputs) -> Attributes (desired output) -> Results",
    "BioMart tutorial"
  ];
  for (const k of must) assert.ok(covers(k), "缺少条目: " + k);
});

test("工具栏与属性面板的 title 提示", () => {
  const must = [
    "Stable ID of the Gene",
    "Versionned stable ID of the Gene",
    "Stable ID of the Transcript",
    "Versionned stable ID of the Transcript",
    "Start Coordinate of the gene in chromosomal coordinates.",
    "End Coordinate of the gene in chromosomal coordinates.",
    "Orientation of genes on chromosome/scaffold.",
    "Band of chromosome/scaffold where genes occur.",
    "Percentage gene GC content",
    "Phenotypes linked to genes",
    "Information from external database sources.",
    "Interpro protein identifiers and data.",
    "Descriptive Data (ID, Descriptions,etc.) for variants",
    "Location of Variants on Genes, and their Effects on Gene Function",
    "Orientation of the Variant on the Transcript"
  ];
  for (const k of must) assert.ok(covers(k), "缺少条目: " + k);
});

test("规则正则与动态串行为", () => {
  const { engine } = engineFor("<p>x</p>");
  const cases = [
    ["Features", "特征"],
    ["86411 / 86411 Genes", "86411 / 86411 个基因"],
    ["864110 / 9 Genes", "864110 / 9 个基因"],
    ["[4 enabled]", "[已启用 4 个]"],
    ["[12 enabled]", "[已启用 12 个]"]
  ];
  for (const [src, want] of cases) assert.equal(engine.translateText(src), want, "原文: " + src);
  // 动态计数与 [N enabled] 只走规则，不进 exact（否则同一句式两套数据会漏翻）
  const keys = Object.keys(dict.exact);
  assert.ok(!keys.some((k) => /^\d[\d,]* \/ [\d,]+ Genes$/.test(k)), "动态计数不该进 exact");
  assert.ok(!keys.some((k) => /^\[\d+ enabled\]$/.test(k)), "[N enabled] 不该进 exact");
});

test("渲染：工具栏、摘要计数与数据集下拉", () => {
  const { doc } = engineFor(
    '<div id="mart_header">' +
      '<a id="new_button_tag" href="/biomart/martview?ts=1" title="Start a new query">New </a>' +
      '<a id="count_button_tag" title="Get result count for the query with any filters applied">Count </a>' +
      '<a id="results_button_tag" title="Preview the results of the query">Results </a>' +
      '<a id="url_button" title="Show query in URL Access Format - Bookmark">URL</a>' +
      '<a id="xml_button" title="Show query in XML Web Service Format">XML</a>' +
      '<a id="perl_button" title="Show query as Perl Script">Perl</a>' +
      '<a id="help_button" title="Get Help">Help</a>' +
      "</div>" +
      '<div id="summarypanel">' +
      "<span>Dataset</span><span>Filters</span><span>Attributes</span>" +
      '<span id="summarypanel_filter_count_1">86411 / 86411 Genes</span>' +
      "<span>[4 enabled]</span><span>[None selected]</span>" +
      "</div>" +
      '<select id="databasemenu"><option>- CHOOSE DATABASE -</option><option>Ensembl Genes 116</option></select>' +
      '<select id="datasetmenu_3"><option>- CHOOSE ADDITIONAL DATASET -</option><option>Human genes (GRCh38.p14)</option></select>'
  );
  assert.deepEqual(
    [...doc.querySelectorAll("#mart_header a")].map(text),
    ["新建", "计数", "结果", "URL", "XML", "Perl", "帮助"]
  );
  assert.equal(doc.querySelector("#new_button_tag").getAttribute("title"), "开始新查询");
  assert.equal(doc.querySelector("#new_button_tag").getAttribute("href"), "/biomart/martview?ts=1", "链接不能丢");
  assert.equal(doc.querySelector("#count_button_tag").getAttribute("title"), "获取应用筛选条件后的查询结果计数");
  assert.equal(doc.querySelector("#help_button").getAttribute("title"), "获取帮助");
  const summary = [...doc.querySelectorAll("#summarypanel > *")].map(text);
  assert.deepEqual(summary, ["数据集", "筛选条件", "属性", "86411 / 86411 个基因", "[已启用 4 个]", "[未选择]"]);
  const options = [...doc.querySelectorAll("option")].map(text);
  assert.equal(options[0], "- 选择数据库 -");
  assert.equal(options[1], "Ensembl Genes 116", "数据库名是专名，不能翻");
  assert.equal(options[2], "- 选择附加数据集 -");
  // r22：BioMart Attributes 面板的「<物种> genes (组装号)」是界面属性名（检查方点名），随本册规则翻；
  // 物种名与组装号仍是数据，原样留在括号与 $1 里。
  assert.equal(options[3], "人类 基因（GRCh38.p14）");
});

test("渲染：Filters 面板", () => {
  const { doc } = engineFor(
    '<div id="filterpanel">' +
      "<p>Please restrict your query using criteria below(If filter values are truncated in any lists, hover over the list item to see the full text)</p>" +
      "<h3>REGION:</h3><label>Chromosome/scaffold <input type=\"text\"></label>" +
      "<label>Coordinates</label><label>Start <input type=\"text\"></label><label>End <input type=\"text\"></label>" +
      "<label>Karyotype band</label><label>Band Start</label><label>Band End</label>" +
      "<label>Multiple regions (Chr:Start:End:Strand) [Max 500 advised]</label>" +
      "<p>e.g. 1:100:10000:-1, 1:100000:200000:1</p>" +
      "<h3>GENE:</h3><label>Limit to genes (external references)...</label>" +
      '<select><option>Only</option><option>Excluded</option></select>' +
      "<label>Input external references ID list [Max 500 advised]</label>" +
      "<label>Transcript count &gt;=</label><label>Transcript count &lt;=</label>" +
      "<label>Gene type</label><label>Transcript type</label>" +
      "<label>Source (gene)</label><label>Source (transcript)</label>" +
      "<label>Transcript Support Level (TSL)</label>" +
      "<h3>PHENOTYPE:</h3><label>Phenotype</label><label>Phenotype source</label>" +
      "<h3>GENE ONTOLOGY:</h3><label>GO Term Accession (e.g. GO:0050789) [Max 500 advised]</label>" +
      "<h3>VARIANT:</h3><label>Variant Consequence</label>" +
      "</div>"
  );
  const panel = doc.querySelector("#filterpanel");
  const labels = [...panel.querySelectorAll("label")].map(text);
  assert.deepEqual(labels, [
    "染色体/支架",
    "坐标",
    "起始",
    "终止",
    "核型条带",
    "条带起始",
    "条带终止",
    "多区域（染色体:起始:终止:链）[建议最多 500 个]",
    "限定为基因（外部参考）...",
    "输入外部参考 ID 列表[建议最多 500 个]",
    "转录本数量 ≥",
    "转录本数量 ≤",
    "基因类型",
    "转录本类型",
    "来源（基因）",
    "来源（转录本）",
    "转录本支持等级（TSL）",
    "表型",
    "表型来源",
    "GO 术语登录号（例如 GO:0050789）[建议最多 500 个]",
    "变异后果"
  ]);
  assert.deepEqual([...panel.querySelectorAll("h3")].map(text), ["区域：", "基因：", "表型：", "基因本体：", "变异："]);
  assert.equal(panel.querySelector("p").textContent, "请在下方条件中限制查询范围（如果列表中的筛选值被截断，请将鼠标悬停在列表项上查看完整文本）");
  assert.deepEqual([...panel.querySelectorAll("option")].map(text), ["仅包含", "排除"]);
});

test("渲染：Results 导出区、表头与数据行（ID/专名不翻）", () => {
  const { doc } = engineFor(
    '<div id="resultspanel">' +
      '<div id="mart_export_menubar">' +
      "<span>Export all results to</span>" +
      '<select id="export_saveto"><option>File</option><option>Compressed file (.gz)</option><option>Compressed web file (notify by email)</option></select>' +
      "<span>Unique results only</span><span>Email notification to</span>" +
      "<span>View</span>" +
      '<select id="export_subset"><option>10</option><option>All</option></select>' +
      "<span>rows as</span>" +
      '<select id="preView_outputformat"><option>HTML</option><option>CSV</option><option>TSV</option></select>' +
      '<input type="submit" name="export_submit" value="Go">' +
      "</div>" +
      '<table id="resultsTableId"><thead><tr>' +
      "<th>Gene stable ID version</th><th>Transcript stable ID</th><th>Transcript stable ID version</th>" +
      "<th>Gene name</th><th>Gene description</th><th>Chromosome/scaffold name</th>" +
      "<th>Gene start (bp)</th><th>Gene end (bp)</th>" +
      "</tr></thead><tbody><tr>" +
      "<td>ENSG00000210049.1</td><td>ENST00000387314</td><td>ENST00000387314.1</td>" +
      "<td>MT-TF</td><td>mitochondrially encoded tRNA-Phe (UUU/C) [Source:HGNC Symbol;Acc:HGNC:7481]</td>" +
      "<td>MT</td><td>577</td><td>647</td>" +
      "</tr></tbody></table></div>"
  );
  const menubar = doc.querySelector("#mart_export_menubar");
  assert.deepEqual([...menubar.querySelectorAll("span")].map(text), [
    "将所有结果导出至",
    "仅唯一结果",
    "邮件通知至",
    "查看",
    "行，格式为"
  ]);
  assert.deepEqual([...doc.querySelectorAll("#export_saveto option")].map(text), ["文件", "压缩文件（.gz）", "压缩网页文件（邮件通知）"]);
  assert.deepEqual([...doc.querySelectorAll("#export_subset option")].map(text), ["10", "全部"]);
  // 文件格式名是提交值，保持原样
  assert.deepEqual([...doc.querySelectorAll("#preView_outputformat option")].map(text), ["HTML", "CSV", "TSV"]);
  assert.equal(doc.querySelector('input[name="export_submit"]').value, "前往", "Go 按钮可见文字应翻");
  assert.deepEqual([...doc.querySelectorAll("#resultsTableId th")].map(text), [
    "基因稳定 ID 版本",
    "转录本稳定 ID",
    "转录本稳定 ID 版本",
    "基因名称",
    "基因描述",
    "染色体/支架名称",
    "基因起始（bp）",
    "基因终止（bp）"
  ]);
  const cells = [...doc.querySelectorAll("#resultsTableId td")].map(text);
  assert.deepEqual(cells.slice(0, 4), ["ENSG00000210049.1", "ENST00000387314", "ENST00000387314.1", "MT-TF"]);
  assert.match(cells[4], /^mitochondrially encoded tRNA-Phe/);
  assert.deepEqual(cells.slice(5), ["MT", "577", "647"]);
});

test("专名与编号不翻：物种/数据集名、基因与转录本 ID、文献与数据库品牌", () => {
  const { engine } = engineFor("<p>x</p>");
  const skip = [
    "Mouse strains 116",
    "hsapiens_gene_ensembl",
    "Ensembl Genes 116",
    "MT-TF",
    "ENSG00000210049.1",
    "ENST00000387314.1",
    "GRCh38.p14",
    "mitochondrially encoded tRNA-Phe (UUU/C) [Source:HGNC Symbol;Acc:HGNC:7481]",
    "IG_C_gene",
    "ensembl_havana",
    "BioMart",
    "EMBL-EBI",
    "TSV",
    "HTML"
  ];
  for (const s of skip) assert.equal(engine.translateText(s), null, "不该翻: " + s);
});
