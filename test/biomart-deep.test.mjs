// Ensembl BioMart 深层界面词（dict/biomart.json）回归：
// Attributes 面板的列名/描述（表型、GO、外部参考、结构域、蛋白特征）、物种前缀属性（规则）、
// 序列与变异面板、Results 导出区与表头、BioMart 教程/常见问题页固定问答。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/biomart.json"), "utf8"));

// 站点条目以 config/sites.json 为准；父级还没登记时用这里约定的同款配置。
// valueText：导出区 <input type="submit" value="Go"> 的可见文字只有 value 通道能翻。
const projectedSite = {
  id: "biomart",
  name: "Ensembl BioMart",
  hosts: ["*.archive.ensembl.org"],
  path: "^/biomart",
  dicts: ["common", "spa", "ensembl", "ensembl-extra", "ensembl-tpl", "ensembl2", "biomart"],
  scope: "body",
  spa: true,
  waitFor: "body",
  valueText: true
};
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const configSite = sites.find((s) => s.id === "biomart");
const site = Object.assign({}, configSite || projectedSite, {
  id: "biomart",
  dicts:
    configSite && configSite.dicts && configSite.dicts.length
      ? configSite.dicts
      : projectedSite.dicts,
  scope: (configSite && configSite.scope) || "body",
  // 导出区按钮文案在 input 的 value 上：attrs 要含 value（config defaults.attrs 在生产里已合入站点）
  attrs: ["placeholder", "title", "aria-label", "alt", "value"],
  valueText: true
});

const data = { exact: {}, rules: [], templates: [] };
for (const id of site.dicts) {
  const p = path.join(root, "../dict", id + ".json");
  if (!fs.existsSync(p)) continue;
  const b = JSON.parse(fs.readFileSync(p, "utf8"));
  Object.assign(data.exact, b.exact || {});
  data.rules = data.rules.concat(b.rules || []);
  data.templates = data.templates.concat(b.templates || []);
}

const CJK = /[\u4e00-\u9fff]/;
const URL = "https://jun2026.archive.ensembl.org/biomart/martview/04f88976172f5fea59902c4cbe725d44";

function engineFor(html) {
  const dom = new JSDOM("<body>" + html + "</body>", { url: URL });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data,
    site
  });
  engine.start();
  return { doc: dom.window.document, engine };
}
const anyEngine = engineFor("<p>x</p>").engine;
function tr(s) {
  return anyEngine.translateText(s);
}
function text(el) {
  return el.textContent.replace(/\s+/g, " ").trim();
}

test("词库结构：family/sites、条数与规则数、译文含汉字、无自映射与 URL", () => {
  assert.equal(book.meta.family, "biomart");
  assert.ok(book.meta.sites.includes("www.ensembl.org"), "sites 要声明 www 入口");
  assert.ok(book.meta.sites.includes("*.archive.ensembl.org"), "sites 要声明 archive 主机");
  const keys = Object.keys(book.exact);
  assert.ok(keys.length >= 330, "exact 只有 " + keys.length + " 条");
  assert.ok(book.rules.length >= 20, "rules 只有 " + book.rules.length + " 条");
  assert.ok(Array.isArray(book.templates), "templates 必须是数组");
  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(!CJK.test(k), "key 含中文: " + k);
    assert.match(v, CJK, "译文不含汉字: " + k + " => " + v);
    assert.notEqual(v, k, "自映射: " + k);
    assert.equal(k, k.trim(), "key 首尾有空白: " + JSON.stringify(k));
    assert.equal(v, v.trim(), "值首尾有空白: " + k);
    assert.doesNotMatch(v, /https?:\/\//i, "值含明文 URL: " + k);
    assert.doesNotMatch(v, /[\w.+-]+@[\w-]+\.[\w.]+/, "值含邮箱: " + k);
  }
});

test("规则：正则可编译、带捕获组且译文用到占位符", () => {
  for (const r of book.rules) {
    const re = new RegExp(r.re);
    assert.ok(re.source.length > 0, "空规则");
    assert.match(r.to, CJK, "规则译文不含汉字: " + r.re);
    // ^(Features)$ 是整串枚举（分组里没有通配），不要求槽位；
    // 带可变捕获组的规则必须把 $1 写进译文，否则等于写死一条译文。
    const hasGroup = /\([^)]*\)/.test(r.re) || /%id/.test(r.re);
    assert.ok(hasGroup, "规则没有捕获组: " + r.re);
    if (/\(\.\+/.test(r.re)) {
      assert.ok(/\$1/.test(r.to), "带可变捕获组的规则没用到 $1: " + r.re);
    }
    if (/\$\d/.test(r.to)) assert.ok(hasGroup, "译文用了槽位但规则没有捕获组: " + r.re);
  }
  // 检查方点名的两条：物种前缀属性必须走规则，不能堆 exact
  const srcs = book.rules.map((r) => r.re);
  assert.ok(srcs.includes("^(.+?) Orthologues$"), "缺少 Orthologues 规则");
  assert.ok(srcs.includes("^(.+) genes \\((.+)\\)$"), "缺少 genes(assembly) 规则");
  const keys = Object.keys(book.exact);
  assert.ok(!keys.some((k) => / Orthologues$/.test(k)), "物种 Orthologues 不该进 exact");
  assert.ok(!keys.some((k) => / genes \([^)]+\)$/.test(k)), "物种 genes(assembly) 不该进 exact");
});

test("规则行为：物种 Orthologues / genes(assembly)", () => {
  const cases = [
    ["Human Orthologues", "人类 直系同源"],
    ["Zebrafish Orthologues", "Zebrafish 直系同源"],
    ["Caenorhabditis elegans (Nematode, N2) Orthologues", "Caenorhabditis elegans (Nematode, N2) 直系同源"],
    ["Human genes (GRCh38.p14)", "人类 基因（GRCh38.p14）"],
    ["Zebrafish genes (GRCz11)", "Zebrafish 基因（GRCz11）"],
    ["Chicken genes (bGalGal1.mat.broiler.GRCg7b)", "Chicken 基因（bGalGal1.mat.broiler.GRCg7b）"]
  ];
  for (const [src, want] of cases) assert.equal(tr(src), want, "原文: " + src);
  // 组装号是数据，原样留在括号里
  assert.match(tr("Zebrafish genes (GRCz11)"), /GRCz11/, "组装号不能被翻");
});

test("规则行为：同源属性的 12 种物种前缀形态", () => {
  const cases = [
    ["Chicken gene stable ID", "Chicken 基因稳定 ID"],
    ["Chicken gene name", "Chicken 基因名称"],
    ["Chicken protein or transcript stable ID", "Chicken 蛋白或转录本稳定 ID"],
    ["Chicken chromosome/scaffold name", "Chicken 染色体/支架名称"],
    ["Chicken chromosome/scaffold start (bp)", "Chicken 染色体/支架起始（bp）"],
    ["Chicken chromosome/scaffold end (bp)", "Chicken 染色体/支架终止（bp）"],
    ["Chicken homology type", "Chicken 同源类型"],
    ["Chicken Gene-order conservation score", "Chicken 基因顺序保守性评分"],
    ["Chicken Whole-genome alignment coverage", "Chicken 全基因组比对覆盖度"],
    ["Chicken orthology confidence [0 low, 1 high]", "Chicken 直系同源置信度[0 低，1 高]"],
    ["Last common ancestor with Chicken", "与 Chicken 的最后共同祖先"],
    ["%id. target Chicken gene identical to query gene", "目标 Chicken 基因与查询基因的同一性（%）"],
    ["%id. query gene identical to target Chicken gene", "查询基因与目标 Chicken 基因的同一性（%）"]
  ];
  for (const [src, want] of cases) assert.equal(tr(src), want, "原文: " + src);
  // 无前缀的同名属性走既有 exact，不能被规则带跑
  assert.equal(tr("Gene stable ID"), "基因稳定 ID");
  assert.equal(tr("Chromosome/scaffold name"), "染色体/支架名称");
});

test("规则行为：结构域数据库 ID/start/end 与 Interpro 归一", () => {
  const cases = [
    ["CDD ID", "CDD 编号"],
    ["Pfam start", "Pfam 起始"],
    ["Pfam end", "Pfam 终止"],
    ["PROSITE profiles start", "PROSITE profiles 起始"],
    ["Superfamily end", "Superfamily 终止"],
    ["Transmembrane helices end", "跨膜螺旋 终止"],
    ["Coiled-coils (Ncoils) start", "卷曲螺旋（Ncoils） 起始"],
    ["Low complexity (Seg) end", "低复杂度区域（Seg） 终止"],
    ["AFFY HG U95A probe", "AFFY HG U95A 探针"],
    ["ILLUMINA HumanRef 8 V3 probe", "ILLUMINA HumanRef 8 V3 探针"]
  ];
  for (const [src, want] of cases) assert.equal(tr(src), want, "原文: " + src);
  // 站内小写 "Interpro" 统一成品牌写法 InterPro
  assert.equal(tr("Interpro ID"), "InterPro 编号");
  assert.equal(tr("Interpro start"), "InterPro 起始");
  assert.equal(tr("Interpro Description"), "InterPro 描述");
});

test("Attributes 面板（feature page）：表型、GO、外部参考、结构域列名", () => {
  const must = {
    "Phenotype description": "表型描述",
    "Source name": "来源名称",
    "Study external reference": "研究外部参考",
    "Strain name": "品系名称",
    "Strain gender": "品系性别",
    "P value": "P 值",
    "GO term accession": "GO 术语登录号",
    "GO term name": "GO 术语名称",
    "GO term definition": "GO 术语定义",
    "GO term evidence code": "GO 术语证据代码",
    "GO domain": "GO 领域",
    "GOSlim GOA Accession(s)": "GOSlim GOA 登录号",
    "GOSlim GOA Description": "GOSlim GOA 描述",
    "CCDS ID": "CCDS 编号",
    "ChEMBL ID": "ChEMBL 编号",
    "HGNC symbol": "HGNC 符号",
    "HGNC ID": "HGNC 编号",
    "Human Protein Atlas accession": "Human Protein Atlas 登录号",
    "INSDC protein ID": "INSDC 蛋白 ID",
    "LRG display in Ensembl gene ID": "Ensembl 基因中的 LRG 展示 ID",
    "MEROPS - the Peptidase Database ID": "MEROPS 肽酶数据库 ID",
    "MIM morbid accession": "MIM 疾病登录号",
    "miRBase transcript name ID": "miRBase 转录本名称 ID",
    "NCBI gene (formerly Entrezgene) description": "NCBI 基因（原 Entrezgene）描述",
    "PDB ID": "PDB 编号",
    "Reactome transcript ID": "Reactome 转录本 ID",
    "RefSeq peptide predicted ID": "RefSeq 肽段预测编号",
    "RFAM ID": "RFAM 编号",
    "RNAcentral ID": "RNAcentral 编号",
    "STRING ID": "STRING 编号",
    "UCSC Stable ID": "UCSC 稳定 ID",
    "UniParc ID": "UniParc 编号",
    "UniProtKB/Swiss-Prot ID": "UniProtKB/Swiss-Prot 编号",
    "WikiGene description": "WikiGene 描述",
    "DataBase of Aberrant 3' Splice Sites name": "异常 3' 剪接位点数据库名称",
    "EFO ID": null
  };
  for (const [k, want] of Object.entries(must)) {
    if (want === null) continue;
    assert.equal(tr(k), want, "列名译文不符: " + k);
  }
});

test("Attributes 面板：蛋白特征、序列与变异列名", () => {
  const cases = [
    ["AFDB-ENSP mappings", "AFDB-ENSP 映射"],
    ["PDB-ENSP mappings", "PDB-ENSP 映射"],
    ["Transmembrane helices", "跨膜螺旋"],
    ["Cleavage site (Signalp)", "切割位点（SignalP）"],
    ["Unspliced (Transcript)", "未剪接（转录本）"],
    ["Flank-coding region (Gene)", "侧翼编码区（基因）"],
    ["5' UTR", "5' 非翻译区（UTR）"],
    ["3' UTR", "3' 非翻译区（UTR）"],
    ["Exon sequences", "外显子序列"],
    ["Coding sequence", "编码序列"],
    ["CDS start (within cDNA)", "CDS 起始（cDNA 内）"],
    ["Minor allele", "次要等位基因"],
    ["Minor allele frequency", "次要等位基因频率"],
    ["Minor allele count", "次要等位基因计数"],
    ["Variant chromosome Strand", "变异染色体链"],
    ["Variant chromosome/scaffold strand", "变异染色体/支架链"],
    ["chromosome/scaffold position start (bp)", "染色体/支架位置起始（bp）"],
    ["PolyPhen prediction", "PolyPhen 预测"],
    ["PolyPhen score", "PolyPhen 评分"],
    ["SIFT prediction", "SIFT 预测"],
    ["SIFT score", "SIFT 评分"],
    ["Protein allele", "蛋白等位基因"],
    ["Paralogous Human Genes", "人类旁系同源基因"],
    ["Human paralogue gene stable ID", "人类旁系同源基因稳定 ID"],
    ["Paralogue last common ancestor with Human", "旁系同源与人类的最后共同祖先"]
  ];
  for (const [src, want] of cases) assert.equal(tr(src), want, "原文: " + src);
});

test("BioMart 教程/FAQ 页：固定问答标题与整句", () => {
  const cases = [
    ["FAQ", "常见问题"],
    ["BioMart tutorials and FAQs", "BioMart 教程与常见问题"],
    ["Extracting data with BioMart", "使用 BioMart 提取数据"],
    ["How to use BioMart", "如何使用 BioMart"],
    // 这三条 ensembl2 已有译法，本册不重复登记（同栈里取其译法）
    ["Combining multiple species datasets", "合并多个物种数据集"],
    ["BiomaRt Bioc R package", "BiomaRt Bioconductor R 包"],
    ["BioMart RESTful access", "BioMart RESTful 访问"],
    [
      "Missing non coding genes in your mart query output, please check the following",
      "查询结果缺少非编码基因时，请查看以下"
    ],
    [
      "How can I download all the proteins in the human proteome? Do I use BioMart?",
      "如何下载人类蛋白质组中的全部蛋白质？我需要用 BioMart 吗？"
    ]
  ];
  for (const [src, want] of cases) assert.equal(tr(src), want, "原文: " + src);
  const long =
    "Ensembl BioMart shows results for protein-coding genes when protein-associated attributes are chosen. Non-coding genes that pass filters will not be shown in the results if certain protein-associated attributes are chosen. Why does this occur?";
  assert.match(tr(long), /^选择与蛋白质相关的属性时/, "FAQ 整句未翻译");
});

test("渲染：Attributes 面板列名与 title 提示（Filters 提示句同时覆盖）", () => {
  const { doc } = engineFor(
    '<div id="filterpanel"><h4>Please restrict your query using criteria below</h4>' +
      "<label>Phenotype description</label><label>P value</label>" +
      "<label>GO term evidence code</label><label>Minor allele frequency</label></div>" +
      '<div id="attributepanel"><label title="Interpro protein identifiers and data.">Interpro ID</label>' +
      "<label>UCSC Stable ID</label><label>5&#39; UTR</label>" +
      "<label>Human Orthologues</label><label>Zebrafish genes (GRCz11)</label></div>"
  );
  assert.deepEqual([...doc.querySelectorAll("#filterpanel label")].map(text), [
    "表型描述",
    "P 值",
    "GO 术语证据代码",
    "次要等位基因频率"
  ]);
  assert.equal(
    text(doc.querySelector("#filterpanel h4")),
    "请在下方条件中限制查询范围",
    "Filters 面板提示标题未翻"
  );
  assert.deepEqual([...doc.querySelectorAll("#attributepanel label")].map(text), [
    "InterPro 编号",
    "UCSC 稳定 ID",
    "5' 非翻译区（UTR）",
    "人类 直系同源",
    "Zebrafish 基因（GRCz11）"
  ]);
  assert.equal(
    doc.querySelector("#attributepanel label").getAttribute("title"),
    "InterPro 蛋白标识符与数据。",
    "title 通道未翻"
  );
});

test("渲染：Results 导出区、Go 按钮与表头（表头跟随所选属性）", () => {
  const { doc } = engineFor(
    '<div id="mart_export_menubar">' +
      "<span>Export all results to</span>" +
      '<select id="export_saveto"><option>File</option><option>Compressed file (.gz)</option></select>' +
      "<span>Unique results only</span><span>Email notification to</span><span>View</span>" +
      '<select id="export_subset"><option>10</option><option>All</option></select>' +
      "<span>rows as</span>" +
      '<select id="preView_outputformat"><option>HTML</option><option>CSV</option><option>TSV</option></select>' +
      '<input type="submit" name="export_submit" value="Go">' +
      "</div>" +
      '<table id="resultsTableId"><thead><tr>' +
      "<th>Gene stable ID</th><th>Phenotype description</th><th>GO term name</th>" +
      "<th>Human Orthologues</th><th>Minor allele count</th>" +
      "</tr></thead><tbody><tr>" +
      "<td>ENSG00000210049</td><td>Abdominal obesity-metabolic syndrome 3</td><td>lipid metabolic process</td>" +
      "<td>ENSG00000139618</td><td>2</td>" +
      "</tr></tbody></table>"
  );
  assert.deepEqual([...doc.querySelectorAll("#mart_export_menubar span")].map(text), [
    "将所有结果导出至",
    "仅唯一结果",
    "邮件通知至",
    "查看",
    "行，格式为"
  ]);
  assert.equal(doc.querySelector('input[name="export_submit"]').value, "前往", "Go 按钮可见文字应翻");
  assert.deepEqual([...doc.querySelectorAll("#preView_outputformat option")].map(text), [
    "HTML",
    "CSV",
    "TSV"
  ]);
  assert.deepEqual([...doc.querySelectorAll("#resultsTableId th")].map(text), [
    "基因稳定 ID",
    "表型描述",
    "GO 术语名称",
    "人类 直系同源",
    "次要等位基因计数"
  ]);
  // 数据行里的表型名、GO 术语名、ENGS ID 都是数据，不翻
  const cells = [...doc.querySelectorAll("#resultsTableId td")].map(text);
  assert.deepEqual(cells, [
    "ENSG00000210049",
    "Abdominal obesity-metabolic syndrome 3",
    "lipid metabolic process",
    "ENSG00000139618",
    "2"
  ]);
});

test("专名、枚举值与格式名不翻（数据面）", () => {
  const skip = [
    "ENSG00000210049.1",
    "ENST00000387314",
    "GRCh38.p14",
    "hsapiens_gene_ensembl",
    "MT-TF",
    "IG_C_gene",
    "ensembl_havana",
    "HTML",
    "CSV",
    "TSV",
    "XLS",
    "BioMart",
    "Ensembl",
    "Phobius",
    "MobiDB lite",
    "URL",
    "XML",
    "Perl",
    "EMBL-EBI",
    "Mouse strains 116",
    "Ensembl Genes 116"
  ];
  for (const s of skip) assert.equal(tr(s), null, "不该翻: " + s);
});