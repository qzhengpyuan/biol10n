// NCBI dbVar + BioProject 站词库（dict/dbvar-bioproject.json）测试
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/dbvar-bioproject.json"), "utf8"));
const common = JSON.parse(fs.readFileSync(path.join(root, "../dict/common.json"), "utf8"));
const ncbi = JSON.parse(fs.readFileSync(path.join(root, "../dict/ncbi.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "ncbi-bioproject") || { hosts: ["www.ncbi.nlm.nih.gov"] };

// 真实接线里站级 dicts = common + ncbi + 本册；这里按同样方式合并
const data = {
  exact: { ...common.exact, ...ncbi.exact, ...dict.exact },
  rules: [...(common.rules || []), ...(ncbi.rules || []), ...(dict.rules || [])],
  templates: [...(common.templates || []), ...(ncbi.templates || []), ...(dict.templates || [])]
};

const CJK = /[\u4e00-\u9fff]/;

function mount(html, url) {
  const dom = new JSDOM(html, { url: url || "https://www.ncbi.nlm.nih.gov/bioproject/PRJNA31257" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return dom.window.document;
}

const flat = (s) => String(s || "").replace(/\s+/g, " ").trim();

function applyRule(text) {
  for (const r of dict.rules) {
    const m = new RegExp(r.re).exec(text);
    if (m) return r.to.replace(/\$(\d)/g, (_, d) => (m[Number(d)] === undefined ? "" : m[Number(d)]));
  }
  return null;
}

test("词库结构：family/sites 正确，exact 有足够条目，rule 与模板齐全", () => {
  assert.equal(dict.meta.family, "dbvar-bioproject");
  assert.ok(dict.meta.sites.includes("www.ncbi.nlm.nih.gov"));
  const keys = Object.keys(dict.exact);
  assert.ok(keys.length >= 150, "exact 只有 " + keys.length + " 条");
  assert.ok(Array.isArray(dict.rules) && dict.rules.length >= 12);
  assert.ok(Array.isArray(dict.templates) && dict.templates.length >= 1);
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.match(v, CJK, "译文不含汉字: " + k + " => " + v);
  }
});

test("条目卫生：key 无中文、无自映射、无首尾空白，值无明文 URL / 邮箱", () => {
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.doesNotMatch(k, CJK, "key 含中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "key 首尾空白: " + k);
    assert.equal(v, v.trim(), "值首尾空白: " + k);
    assert.doesNotMatch(v, /https?:\/\//i, "值含明文 URL: " + k);
    assert.doesNotMatch(v, /[\w.+-]+@[\w-]+\.[\w.]+/, "值含明文邮箱: " + k);
  }
});

test("规则：正则可编译、译文引用捕获组且含汉字", () => {
  for (const r of dict.rules) {
    assert.doesNotThrow(() => new RegExp(r.re), "坏规则: " + r.re);
    assert.match(r.to, CJK, "规则译文不含汉字: " + r.re);
    assert.match(r.to, /\$\d/, "规则译文应引用捕获组: " + r.re);
  }
});

test("模板：pat 是真实原文、20-2200 字、占位符与槽位一一对应", () => {
  for (const t of dict.templates) {
    assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, "模板长度越界: " + t.pat);
    assert.doesNotMatch(t.pat, CJK, "模板 pat 含中文: " + t.pat);
    assert.match(t.zh, CJK, "模板译文无中文: " + t.pat);
    const used = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
    const have = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
    assert.deepEqual(used, have, "占位符不匹配: " + t.pat);
  }
});

test("关键条目：dbVar 首页与站名/说明句", () => {
  const must = [
    "dbVar: Study Browser",
    "Database of genomic structural variation",
    "dbVar is NCBI's database of human genomic Structural Variation — large variants >50 bp including insertions, deletions, duplications, inversions, mobile elements, translocations, and complex variants",
    "Overview of dbVar",
    "Variant Summary",
    "Help & FAQ",
    "Accessing Data",
    "Structural Variation Data Hub",
    "Nonredundant Datasets (GitHub)",
    "Study Browser",
    "FTP Data Download",
    "Submitting Data",
    "Submission Templates",
    "VCF Submissions",
    "Search Examples (additional terms)",
    "Genomic location",
    "Gene in a specific dataset",
    "Clinical significance and phenotype",
    "All of dbVar (then use filters on results page)",
    "Other NCBI Resources",
    "Variation Portal",
    "Variation Tools",
    "Tools for analyzing dbVar data",
    "dbVar News and Announcements"
  ];
  for (const k of must) assert.ok(k in dict.exact, "缺少条目: " + k);
});

test("关键条目：BioProject 首页与说明句", () => {
  const must = [
    "Organizing biological data",
    "A BioProject is a collection of biological data related to a single initiative, originating from a single organization or from a consortium. A BioProject record provides users a single place to find links to the diverse data types generated for that project.",
    "Using BioProject",
    "BioProject Help",
    "BioProject Overview",
    "Browse BioProject",
    "Download (FTP)",
    "Large Initiatives",
    "NCBI Resources"
  ];
  for (const k of must) assert.ok(k in dict.exact, "缺少条目: " + k);
});

test("关键条目：dbVar 记录页字段标签、页签、表头", () => {
  const must = [
    "Study Type:",
    "Submitter:",
    "Submitter URL:",
    "Project:",
    "Publication(s):",
    "Variants in this study",
    "BioProjects",
    "Source: NCBI",
    "Download Both",
    "Samplesets",
    "Experimental Details",
    "Validations",
    "Assembly used for analysis:",
    "Variant Summary for:",
    "Remapping summary:",
    "Number of Variant Regions",
    "Number of Variant Calls",
    "Placement type",
    "Link to graphical display",
    "Remapped",
    "Variant Region remap status",
    "Variant Call remap status",
    "Variant Regions on source",
    "Variant Calls on source",
    "Perfect",
    "Good",
    "Pass",
    "Fail",
    "Mult",
    "Variant Region Count",
    "Variant Call Count"
  ];
  for (const k of must) assert.ok(k in dict.exact, "缺少条目: " + k);
});

test("关键条目：dbVar 变异检索结果页筛选与表头", () => {
  const must = [
    "Object Type",
    "Variant Type",
    "Method Type",
    "Clinical Interpretation",
    "Has Clinical Interpretation",
    "Sex of Subject",
    "Study Type",
    "Subject Phenotype Status",
    "insertion",
    "inversion",
    "Sequencing",
    "Control Set",
    "Variant Region ID",
    "Clinical Assertion",
    "Genes in region",
    "Tabular View"
  ];
  for (const k of must) assert.ok(k in dict.exact, "缺少条目: " + k);
});

test("关键条目：BioProject 筛选面与记录页字段", () => {
  const must = [
    "Project Types",
    "Project Data",
    "Project Data:",
    "Attributes: Data Types/Material",
    "Attributes: Capture",
    "Attributes: Method Type",
    "Organism Groups",
    "Umbrella",
    "Primary submission",
    "Epigenomics",
    "Genome sequencing",
    "Metagenome",
    "Targeted locus",
    "Whole",
    "Monoisolate",
    "Multi-isolate",
    "Multi-species",
    "Environmental",
    "Synthetic",
    "Mammals",
    "Other vertebrates",
    "Protists",
    "Invertebrate",
    "BioProject ID list",
    "Accessions List",
    "Navigate Across",
    "NCBI Links",
    "Locus Tag Prefix",
    "Resource Name",
    "Number of Links",
    "Sequence data",
    "Other datasets",
    "Nucleotide (Genomic DNA)",
    "SRA Experiments",
    "Capillary Traces (Trace Archive)",
    "Assembly details:",
    "Chrs",
    "SRA Data Details",
    "Parameter",
    "Related RefSeq Project",
    "Registration date:",
    "Sorted by Default order",
    "Display Settings:",
    "Send to:"
  ];
  for (const k of must) assert.ok(k in dict.exact, "缺少条目: " + k);
});

test("规则行为：分页、计数、导出标题、下载链接", () => {
  assert.equal(applyRule("Items: 1 to 20 of 203773"), "第 1 - 20 项，共 203773 项");
  assert.equal(applyRule("of 10189"), "／ 共 10189 页");
  assert.equal(applyRule("Select item 1565569"), "选择条目 1565569");
  assert.equal(applyRule("Number of Variants: 20"), "变异数：20");
  assert.equal(applyRule("20 per page"), "每页 20 条");
  assert.equal(applyRule("Publications (total 57)"), "论文（共 57 篇）");
  assert.equal(applyRule("Download 297 Variant Regions"), "下载 297 个变异区域");
  assert.equal(applyRule("Download 297 Variant Calls"), "下载 297 个变异调用");
  assert.equal(applyRule("115736 additional projects"), "115736 个以上项目");
  assert.equal(applyRule("Registration date: 27-Feb-2009"), "注册日期：27-Feb-2009");
  assert.equal(applyRule("Accession: PRJNA31257"), "登录号：PRJNA31257");
  assert.equal(applyRule("ID: 31257"), "编号：31257");
  assert.equal(applyRule("Remapped: GRCh38.p12 (hg38)"), "重映射：GRCh38.p12 (hg38)");
  assert.equal(applyRule("Submitted: NCBI35 (hg17)"), "已提交：NCBI35 (hg17)");
});

test("渲染：dbVar 记录页字段标签与表头翻、物种/登录号值不翻", () => {
  const doc = mount(`<div id="maincontent">
    <h1>dbVar: Study Browser</h1>
    <dl class="details">
      <dt>Organism:</dt><dd>Human</dd>
      <dt>Study Type:</dt><dd>Control Set</dd>
      <dt>Submitter:</dt><dd>Evan Eichler</dd>
      <dt>Submitter URL:</dt><dd>http://hgsv.washington.edu</dd>
      <dt>Project:</dt><dd>PRJNA29893</dd>
      <dt>Publication(s):</dt><dd>Tuzun et al. 2005</dd>
    </dl>
    <table><thead><tr>
      <th>Sequence ID</th><th>Chr</th><th>Number of Variant Regions</th>
      <th>Number of Variant Calls</th><th>Placement type</th><th>Link to graphical display</th>
    </tr></thead></table>
    <a class="download">Download 297 Variant Regions</a>
  </div>`, "https://www.ncbi.nlm.nih.gov/dbvar/studies/nstd1/");
  const txt = flat(doc.querySelector("#maincontent").textContent);
  assert.match(txt, /研究类型：/);
  assert.match(txt, /对照集/);
  assert.match(txt, /提交者：/);
  assert.match(txt, /研究浏览/);
  assert.match(txt, /变异区域数/);
  assert.match(txt, /定位类型/);
  assert.match(txt, /图形显示链接/);
  assert.match(txt, /下载 297 个变异区域/);
  // 值不翻
  assert.match(txt, /PRJNA29893/);
  assert.match(txt, /Evan Eichler/);
});

test("渲染：dbVar 分页模板保留 span 并整体译出", () => {
  const doc = mount(`<div class="ui-ncbigrid-paged-toolbar">
    <div class="ui-ncbigrid-paged-countItems">Items <span class="ui-ncbigrid-paged-startRow">1</span> - <span class="ui-ncbigrid-paged-endRow">10</span> of <span class="ui-ncbigrid-paged-totalRows">91</span></div>
  </div>`, "https://www.ncbi.nlm.nih.gov/dbvar/studies/nstd1/");
  const box = doc.querySelector(".ui-ncbigrid-paged-countItems");
  assert.equal(flat(box.textContent), "第 1 - 10 项，共 91 项");
  assert.equal(box.querySelectorAll("span").length, 3, "内联 span 应原样保留");
});

test("渲染：BioProject 结果条目（Project data type / Scope / Accession）", () => {
  const doc = mount(`<div class="rprt"><div class="rslt">
    <p class="title"><a href="/bioproject/1565569">Monkeypox virus infection in a wild herbivorous western red colobus monkey</a></p>
    <div class="supp">
      <dl class="details"><dt></dt><dd>Project data type: Other</dd></dl>
      <dl class="details"><dt>Scope: </dt><dd>Monoisolate</dd></dl>
      <dl class="details"><dt></dt><dd>Project data type: Genome sequencing and assembly</dd></dl>
      <dl class="details"><dt></dt><dd>Project data type: Transcriptome or Gene expression</dd></dl>
      <dl class="details"><dt></dt><dd>Project data type: Raw sequence reads</dd></dl>
    </div>
    <div class="aux"><div class="resc"><dl class="rprtid">
      <dt>Accession: </dt><dd>PRJEB128946</dd><dt> ID: </dt><dd>1565569</dd>
    </dl></div></div>
  </div></div>`, "https://www.ncbi.nlm.nih.gov/bioproject/?term=human");
  const t = flat(doc.querySelector(".rprt").textContent);
  assert.match(t, /项目数据类型：其他/);
  assert.match(t, /项目数据类型：基因组测序与组装/);
  assert.match(t, /项目数据类型：转录组或基因表达/);
  assert.match(t, /项目数据类型：原始序列读段/);
  assert.match(t, /范围：/);
  assert.match(t, /单分离物/);
  assert.match(t, /登录号：/);
  assert.match(t, /PRJEB128946/, "登录号值不翻");
  assert.match(t, /Monkeypox virus infection/, "条目标题（数据）不翻");
});

test("渲染：BioProject 记录页字段标签与 Project Data 表头", () => {
  const doc = mount(`<div id="maincontent">
    <table id="CombinedTable"><tbody>
      <tr><td class="CTtitle">Accession</td><td class="CTcontent">PRJNA31257</td></tr>
      <tr><td class="CTtitle">Data Type</td><td class="CTcontent">Genome sequencing</td></tr>
      <tr><td class="CTtitle">Scope</td><td class="CTcontent">Monoisolate</td></tr>
      <tr><td class="CTtitle">Organism</td><td class="CTcontent"><a>Homo sapiens</a></td></tr>
      <tr><td class="CTtitle">Publications (total 57) <a class="RegularLinkB">Less...</a></td><td class="CTcontent"></td></tr>
      <tr><td class="CTtitle">NCBI Links</td><td class="CTcontent"></td></tr>
      <tr><td class="CTtitle">Related Resources</td><td class="CTcontent"></td></tr>
      <tr><td class="CTtitle">Locus Tag Prefix</td><td class="CTcontent">AC81RY</td></tr>
    </tbody></table>
    <table class="FrameGrid"><tr><th>Resource Name</th><th>Number<br>of Links</th></tr>
      <tr><td colspan="2" class="DataGrp">Sequence data</td></tr>
      <tr><td><span>Nucleotide (Genomic DNA)</span></td><td>1012</td></tr>
      <tr><td><span>SRA Experiments</span></td><td>1</td></tr>
      <tr><td colspan="2" class="DataGrp">Other datasets</td></tr>
    </table>
  </div>`, "https://www.ncbi.nlm.nih.gov/bioproject/PRJNA31257");
  const t = flat(doc.querySelector("#maincontent").textContent);
  assert.match(t, /登录号/);
  assert.match(t, /数据类型/);
  assert.match(t, /范围/);
  assert.match(t, /物种/);
  assert.match(t, /论文（共 57 篇）/);
  assert.match(t, /NCBI 链接/);
  assert.match(t, /相关资源/);
  assert.match(t, /基因座标签前缀/);
  assert.match(t, /资源名称/);
  assert.match(t, /链接数/);
  assert.match(t, /序列数据/);
  assert.match(t, /核酸序列（基因组 DNA）/);
  assert.match(t, /SRA 实验/);
  assert.match(t, /其他数据集/);
  // 固定枚举值照常翻；登录号、物种名等值不翻
  assert.match(t, /基因组测序/);
  assert.match(t, /PRJNA31257/);
  assert.match(t, /Homo sapiens/);
});
