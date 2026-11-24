// NCBI 目录型站点词库（dict/ncbi-dirs.json）冒烟测试：
// RefSeq 首页/关于页、BioSample 首页/检索结果、CCDS 浏览页/报表页、NCBI 提交门户（submit.ncbi.nlm.nih.gov）
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/ncbi-dirs.json"), "utf8"));
const common = JSON.parse(fs.readFileSync(path.join(root, "../dict/common.json"), "utf8"));
const ncbi = JSON.parse(fs.readFileSync(path.join(root, "../dict/ncbi.json"), "utf8"));

// sites.json 尚未登记这四个路径，这里按推荐条目构造站点配置（dicts 顺序与建议一致）
const site = {
  id: "ncbi-dirs",
  name: "NCBI RefSeq / BioSample / CCDS / 提交门户",
  hosts: ["www.ncbi.nlm.nih.gov", "submit.ncbi.nlm.nih.gov"],
  dicts: ["common", "ncbi", "ncbi-dirs"],
  scope: "body"
};

// 站点实际加载的是 common + ncbi（本册接入后再加上本册），合并后的词表才是页面真实行为
const all = {
  exact: Object.assign({}, common.exact, ncbi.exact, dict.exact),
  rules: [...(common.rules || []), ...(ncbi.rules || []), ...dict.rules],
  templates: [...(common.templates || []), ...(ncbi.templates || []), ...dict.templates]
};

const CJK = /[\u4e00-\u9fff]/;

function engineFor(html, url) {
  const dom = new JSDOM(html, { url: url || "https://www.ncbi.nlm.nih.gov/refseq/" });
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

test("词库结构：family/sites 正确，exact 条目充足且译文都含汉字", () => {
  assert.equal(dict.meta.family, "ncbi-dirs");
  assert.deepEqual(dict.meta.sites, ["www.ncbi.nlm.nih.gov", "submit.ncbi.nlm.nih.gov"]);
  const keys = Object.keys(dict.exact);
  assert.ok(keys.length >= 240, "exact 只有 " + keys.length + " 条");
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.notEqual(v, k, "自映射: " + k);
    assert.match(v, CJK, "译文不含汉字: " + k + " => " + v);
  }
  assert.ok(dict.rules.length >= 4, "规则太少");
  for (const r of dict.rules) {
    assert.doesNotThrow(() => new RegExp(r.re), "坏正则: " + r.re);
    assert.match(r.to, CJK, "规则译文不含汉字: " + r.re);
    assert.ok(/\((?!\?)/.test(r.re), "规则没有捕获组: " + r.re);
  }
  const tpl = dict.templates || [];
  assert.ok(tpl.length >= 20, "模板只有 " + tpl.length + " 条");
  for (const t of tpl) {
    assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, "模板 pat 长度越界: " + t.pat.length);
    assert.match(t.zh, CJK, "模板译文不含汉字: " + t.pat);
    assert.doesNotMatch(t.pat, CJK, "模板原文含汉字: " + t.pat);
    const slots = (t.pat.match(/\{\{\d+\}\}/g) || []).length;
    assert.ok(slots >= 1, "模板没有槽位: " + t.pat);
    for (let i = 1; i <= slots; i++) assert.ok(t.pat.includes("{{" + i + "}}"), "槽位不连续: " + t.pat);
    assert.equal((t.zh.match(/\{\{\d+\}\}/g) || []).length, slots, "译文槽位数不一致: " + t.pat);
    for (const mail of (t.zh.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || [])) {
      assert.ok(t.pat.includes(mail), "模板译文引入了原文没有的邮箱: " + mail);
    }
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

test("与 common / ncbi 同键时必须同值（不制造新的跨册冲突）", () => {
  for (const [name, book] of [["common", common], ["ncbi", ncbi]]) {
    for (const [k, v] of Object.entries(dict.exact)) {
      if (k in book.exact) assert.equal(book.exact[k], v, name + " 里同键不同值: " + k);
    }
  }
});

test("RefSeq 首页：标语、区块标题、公告列表与下载信息", () => {
  const must = [
    "Integrated reference sequences",
    "A comprehensive, integrated, non-redundant, well-annotated set of reference sequences including genomic, transcript, and protein.",
    "Using RefSeq",
    "About RefSeq",
    "Human Reference Genome",
    "Prokaryotic RefSeq Genomes",
    "RefSeq Access",
    "Consensus CDS (CCDS)",
    "RefSeq Functional Elements",
    "Targeted Loci",
    "RefSeq projects",
    "Announcements",
    "This release includes:",
    "Proteins:",
    "Transcripts:",
    "Organisms:",
    "Available at:",
    "Documentation:",
    "Related Links",
    "Feedback & Credits",
    "Publications and Citing RefSeq",
    "Contact RefSeq Help Desk",
    "Submit a GeneRIF",
    "Society".replace("Society", "Collaborators"),
    "previous announcements",
    "NCBI's refseq-announce mail list",
    "RefSeq: NCBI Reference Sequence Database"
  ];
  for (const k of must) assert.ok(covers(k), "缺少条目: " + k);
});

test("RefSeq 关于页：范围、特征清单与生产流程小节", () => {
  const must = [
    "RefSeq genomes are copies of selected assembled genomes available in GenBank. RefSeq transcript and protein records are generated by several processes including:",
    "Computation",
    "Manual curation",
    "Scope",
    "Growth Statistics",
    "Data Access and Availability",
    "RefSeq releases",
    "RefSeq Genomes",
    "Entrez Query Hints",
    "Distinguishing Features",
    "The main features of the RefSeq collection include:",
    "non-redundancy",
    "explicitly linked nucleotide and protein sequences",
    "data validation and format consistency",
    "distinct accession series",
    "(all accessions include an underscore '_' character)",
    "RefSeq Production Processes and Policy",
    "Genome Assembly & Annotation Pipeline",
    "Model RefSeq",
    "Known RefSeq",
    "NCBI curation of eukaryotic transcript and protein sequences:",
    "The process flow includes the following steps:",
    "Names, Symbols, Aliases",
    "Cross-references to other databases",
    "Curation Processing (QA failures and other genes):",
    "remove vector, linker contamination",
    "extend UTR",
    "Add publications"
  ];
  for (const k of must) assert.ok(covers(k), "缺少条目: " + k);
  const pats = dict.templates.map((t) => t.pat);
  assert.ok(pats.some((p) => p.startsWith("This page provides a brief overview of the RefSeq production processes.")), "缺模板: 生产流程导语");
  assert.ok(pats.some((p) => p.startsWith("The Reference Sequence (RefSeq) collection provides")), "缺模板: RefSeq 集合定义段");
  assert.ok(pats.some((p) => p.includes("Propagation from annotated genomes")), "缺模板: INSDC 传递条目");
});

test("BioSample 首页与检索结果页：区块标题、筛选面板与控件", () => {
  const must = [
    "The BioSample database contains descriptions of biological source materials used in experimental assays.",
    "Using BioSample",
    "Sources",
    "Authenticated Cell Line",
    "Example Searches",
    "BioSample Overview",
    "BioSample Documentation",
    "Submission FAQ",
    "Search Help",
    "Background, Search and Submit",
    "Browse Human Cell Line STR Profiles",
    "Browse Known Misidentified Cell Lines",
    "bacteria of genus Shigella for which SRA data is available",
    "mouse samples for which strain and age information is available",
    "fibroblast cell samples",
    "Sample type",
    "Environmental package",
    "Used by SRA",
    "Model organism or animal",
    "Microbe",
    "human-gut",
    "microbial mat/biofilm",
    "wastewater/sludge",
    "miscellaneous or artificial",
    "geographic location",
    "collection date",
    "Has related data",
    "Identifiers:",
    "Package:",
    "BioSample ID list",
    "Accessions List",
    "Show"
  ];
  for (const k of must) assert.ok(covers(k), "缺少条目: " + k);
  // 已被 common / ncbi 抢先的动态串，本册不再重复收录
  const keys = Object.keys(dict.exact);
  for (const k of ["Result Filters", "Items per page", "Sort by", "Choose Destination", "Add to Clipboard", "Attributes"]) {
    assert.ok(!keys.includes(k), "不该重复收（已被别的册覆盖）: " + k);
  }
});

test("CCDS 浏览页与报表页：表单标签、侧栏导航、报表表头", () => {
  const must = [
    "Nucleotide ID",
    "Protein ID",
    "All Organisms",
    "All Releases",
    "Current Releases",
    "Releases & Statistics",
    "email CCDS",
    "Genome Displays",
    "Related Resources",
    "Available information includes:",
    "Access and Availability",
    "CCDS Identifiers and Tracking",
    "Process Flow and Quality Testing",
    "Identifying Inclusion in MANE",
    "Past Announcements",
    "The CCDS set is built by consensus among the collaborating members which include:",
    "Ensembl Annotation Pipeline",
    "HAVANA Curation Group",
    "Eukaryotic Genome Annotation Pipeline",
    "RefSeq Curation Group",
    "The general process flow for defining the CCDS gene set includes:",
    "compare genome annotation results",
    "quality evaluation",
    "Chrom.",
    "CCDS Release",
    "NCBI Annotation Release",
    "Ensembl Annotation Release",
    "Links Key",
    "Links to:",
    "History report",
    "BLAST report",
    "Nucleotide report",
    "Protein report",
    "Re-query CCDS DB by:",
    "Genome Browser Links:",
    "Ensembl Genome Browser",
    "NCBI Sequence Viewer",
    "UCSC Genome Browser",
    "VEGA Genome Browser",
    "Write to the Help Desk",
    "Please use the following citations for CCDS:",
    "The CCDS dataset is also available for anonymous"
  ];
  for (const k of must) assert.ok(covers(k), "缺少条目: " + k);
});

test("提交门户：首页标题、推荐工具卡片与资源入口", () => {
  const must = [
    "Submission Portal",
    "My submissions",
    "Submit to the world's largest public repository of biological and scientific information",
    "What do you want to submit?",
    "Enter a few words about your data and select an option to learn more.",
    "Enter sequence type",
    "Suggest tool",
    "Suggested tools",
    "SRA accepts unassembled reads from high throughput sequencing platforms. Submitted data files should generally be minimally processed and include per-base quality scores.",
    "GEO accepts raw data, processed data and metadata for gene expression and epigenomics datasets generated by high-throughput sequencing and microarray technologies.",
    "Submit individual-level phenotype, molecular, and sequence data from human-subject research studies.",
    "Submit human genomic variants classified for inherited diseases, cancer, or drug responses and the evidence for classification.",
    "Submit the electronic version of a peer-reviewed manuscript for inclusion in PubMed Central.",
    "Explore clinicial studies conducted around the world.",
    "Submit BioNano maps, Beta-lactamase gene, and PacBio methylation data.",
    "Small human genomic variation: single nucleotide, insertions, deletions, and microsatellites.",
    "Automatically create a BioProject and BioSample during sequence data submission.",
    "Best practices and recommendations for public health submitters.",
    "Submit sequences",
    "Submit to medical genetics & human variation",
    "Submit to other resources",
    "Review the three GenBank submission paths below to select the appropriate option for your data.",
    "Resources for sequence submitters",
    "About submission groups",
    "Learn what submission groups are, when to use them, and how to manage them",
    "Human Variation",
    "Sequence submission FAQ",
    "What is an accession number?",
    "What happens after my data is submitted?",
    "Start new submission",
    "Submission Templates",
    "Submission (ASN.1)",
    "Structured Comment - Genomes",
    "Genome Info file template",
    "Example of Genome Info file using BioSample Accessions",
    "Metadata spreadsheet for BioSample accessions",
    "dbGaP submission templates",
    "NCBI Username",
    "Keep me logged in",
    "Forgot login info?",
    "more login options"
  ];
  for (const k of must) assert.ok(covers(k), "缺少条目: " + k);
});

test("补充条目：属性名与物种下拉的固定枚举值", () => {
  assert.equal(dict.exact["cell type"], "细胞类型");
  assert.equal(dict.exact["Virus"], "病毒");
  assert.equal(dict.rules.length, 4);
});

test("CCDS 浏览页渲染：匿名 FTP 句与版本公告（含链接槽位）", () => {
  const { doc } = engineFor(
    '<div><p>The CCDS dataset is also available for anonymous <a href="ftp://ftp.ncbi.nih.gov/pub/CCDS">FTP</a>.</p>' +
      '<p>This update adds 2,746 new CCDS IDs, and adds 237 genes into the human CCDS set. CCDS Release 24 includes a total of 35,608 CCDS IDs that correspond to 19,107 GeneIDs, with 48,062 protein sequences from NCBI and 47,762 from Ensembl. See the <a href="CcdsBrowse.cgi?REQUEST=SHOW_STATISTICS">Releases &amp; Statistics</a>  report for details.</p>' +
      '<p>Please use the following citations for CCDS:<br><br>PubMed: 19498102</p></div>',
    "https://www.ncbi.nlm.nih.gov/CCDS/CcdsBrowse.cgi"
  );
  const ps = doc.querySelectorAll("p");
  assert.equal(text(ps[0]), "CCDS 数据集也可以通过匿名 FTP 下载。");
  assert.ok(text(ps[1]).startsWith("本次更新新增 2,746 个 CCDS 编号"), text(ps[1]));
  assert.ok(text(ps[1]).endsWith("详见版本与统计报告。"), text(ps[1]));
  assert.ok(ps[1].querySelector("a"));
  assert.ok(text(ps[2]).startsWith("CCDS 的引用文献如下："), text(ps[2]));
});

test("规则：公告版本号、CCDS 版本、基因报表与修订号", () => {
  const { engine } = engineFor("<p>x</p>");
  const cases = [
    ["RefSeq Release 238 is available for FTP", "RefSeq 第 238 版已发布，可经 FTP 下载"],
    ["CCDS Release 24 - Update for Human", "CCDS 第 24 版 - 人类更新"],
    ["Report for Gene BRCA1", "基因 BRCA1 的报告"],
    ["Last revision: 1.218.4", "最后修订：1.218.4"]
  ];
  for (const [src, want] of cases) assert.equal(engine.translateText(src), want, "原文: " + src);
  // 已被 ncbi 抢先的计数串：保持 ncbi 的译法，本册不另立规则
  assert.equal(engine.translateText("Items: 1 to 20 of 28344025"), "第 1 至 20 项，共 28344025 项");
  assert.equal(engine.translateText("Select item 63275148"), "选择条目 63275148");
  assert.equal(engine.translateText("Last updated: 2021-03-19T20:52:12Z"), "最后更新：2021-03-19T20:52:12Z");
});

test("RefSeq 首页渲染：标语、区块、公告与带链接的模板句", () => {
  const { doc } = engineFor(
    '<div><div class="res_logo"><h1 class="res_name"><a href="/refseq/">RefSeq</a></h1>' +
      '<h2 class="res_tagline">Integrated reference sequences</h2></div>' +
      '<div class="res_desc">A comprehensive, integrated, non-redundant, well-annotated set of reference sequences including genomic, transcript, and protein.</div>' +
      '<h2>Using RefSeq</h2><ul><li><a href="/refseq/about/">About RefSeq</a></li>' +
      '<li><a href="/refseq/human/">Human Reference Genome</a></li>' +
      '<li><a href="/refseq/faq/">FAQ</a></li></ul>' +
      '<h2>RefSeq Access</h2><ul><li><a href="/datasets/">NCBI Datasets</a></li><li><a href="/refseq/ftp/">RefSeq FTP</a></li></ul>' +
      '<h2>RefSeq projects</h2><ul><li><a href="/CCDS/">Consensus CDS (CCDS)</a></li>' +
      '<li><a href="/refseq/functional-elements/">RefSeq Functional Elements</a></li></ul>' +
      '<h2>Announcements</h2>' +
      '<h3>November 13, 2026<br>RefSeq Release 238 is available for FTP</h3>' +
      '<p>This release includes:</p>' +
      '<dl><dt>Proteins:</dt><dd>514,488,735</dd><dt>Transcripts:</dt><dd>88,257,089</dd>' +
      '<dt>Organisms:</dt><dd>186,115</dd><dt>Available at:</dt><dd><a href="https://ftp.ncbi.nlm.nih.gov/refseq/release/">https://ftp.ncbi.nlm.nih.gov/refseq/release/</a></dd>' +
      '<dt>Documentation:</dt><dd>Release Notes</dd></dl>' +
      '<p>See <a href="/refseq/announcements/">previous announcements</a> or subscribe to ' +
      '<a href="mailto:refseq-announce@ncbi.nlm.nih.gov">NCBI&#39;s refseq-announce mail list</a> to receive announcements.</p></div>'
  );
  assert.equal(text(doc.querySelector(".res_tagline")), "整合的参考序列");
  assert.equal(text(doc.querySelector(".res_desc")), "一套全面、整合、非冗余且注释完善的参考序列，涵盖基因组、转录本与蛋白质。");
  assert.deepEqual(
    [...doc.querySelectorAll("h2")].map(text),
    ["整合的参考序列", "使用 RefSeq", "获取 RefSeq", "RefSeq 项目", "公告"]
  );
  const links = [...doc.querySelectorAll("ul a")].map(text);
  for (const want of ["关于 RefSeq", "人类参考基因组", "共识编码序列（CCDS）", "RefSeq 功能元件"]) {
    assert.ok(links.includes(want), "缺少链接 " + want + " 实际: " + links.join("|"));
  }
  assert.ok(text(doc.querySelector("h3")).includes("RefSeq 第 238 版已发布，可经 FTP 下载"), "公告标题未翻: " + text(doc.querySelector("h3")));
  assert.deepEqual([...doc.querySelectorAll("dt")].map(text), ["蛋白质：", "转录本：", "生物：", "下载地址：", "文档："]);
  assert.deepEqual([...doc.querySelectorAll("dd")].slice(0, 3).map(text), ["514,488,735", "88,257,089", "186,115"]);
  const ps = [...doc.querySelectorAll("p")].map(text);
  assert.equal(ps[0], "本版本包含：");
  assert.equal(ps[1], "查看往期公告，或订阅NCBI 的 refseq-announce 邮件列表以接收公告。");
  const mail = [...doc.querySelectorAll("p a")].map((a) => a.getAttribute("href"));
  assert.deepEqual(mail, ["/refseq/announcements/", "mailto:refseq-announce@ncbi.nlm.nih.gov"], "模板里的链接不能丢");
});

test("BioSample 检索结果渲染：筛选面板、计数与结果条目字段", () => {
  const { doc } = engineFor(
    '<div><h2>Result Filters</h2><h3>Organism</h3><h3>Sample type</h3>' +
      '<ul><li><a href="?filter=sample_type:human">Human</a><span>(1,522,764)</span></li>' +
      '<li><a href="?filter=sample_type:microbe">Microbe</a><span>(39,373)</span></li>' +
      '<li><a href="?filter=sample_type:animal">Model organism or animal</a><span>(10,594)</span></li>' +
      '<li><a href="?filter=sample_type:plant">Plant</a><span>(248)</span></li></ul>' +
      '<h3>Environmental package</h3><ul><li><a href="?f=soil">soil</a><span>(1,398)</span></li>' +
      '<li><a href="?f=human-gut">human-gut</a><span>(517,251)</span></li></ul>' +
      '<h3>Other</h3><ul><li><a href="?f=sra">Used by SRA</a><span>(14,002,477)</span></li>' +
      '<li><a href="?f=all">Clear all</a></li></ul>' +
      '<fieldset><legend>Format</legend><label>Summary</label><label>Summary (text)</label>' +
      '<label>Full</label><label>Full (text)</label><label>BioSample ID list</label><label>Accessions List</label></fieldset>' +
      '<fieldset><legend>Items per page</legend><label>20</label><label>50</label></fieldset>' +
      '<h2>Search results</h2><h3>Items: 1 to 20 of 28344025</h3>' +
      '<dl><dt>Identifiers:</dt><dd>BioSample: SAMN63275148; Sample name: OC1rev_Endo_HEK293T_SpCas9_Rep3; SRA: SRS30816274</dd>' +
      '<dt>Organism:</dt><dd>Homo sapiens</dd><dt>Accession:</dt><dd>SAMN63275148</dd><dt>ID:</dt><dd>63275148</dd></dl></div>'
  );
  assert.deepEqual([...doc.querySelectorAll("h3")].map(text), ["物种", "样本类型", "环境包", "其他", "第 1 至 20 项，共 28344025 项"]);
  const facet = [...doc.querySelectorAll("li a")].map(text);
  for (const want of ["人类", "微生物", "模式生物或动物", "植物", "土壤", "人类肠道", "被 SRA 使用"]) {
    assert.ok(facet.includes(want), "缺少筛选项 " + want + " 实际: " + facet.join("|"));
  }
  assert.equal(doc.querySelector("li span").textContent, "(1,522,764)", "计数原样保留");
  assert.deepEqual([...doc.querySelectorAll("label")].map(text), ["概要", "概要（文本）", "完整", "完整（文本）", "BioSample ID 列表", "登录号列表", "20", "50"]);
  assert.deepEqual([...doc.querySelectorAll("dt")].map(text), ["标识符：", "物种：", "登录号：", "编号："]);
  assert.equal(doc.querySelector("dd").textContent, "BioSample: SAMN63275148; Sample name: OC1rev_Endo_HEK293T_SpCas9_Rep3; SRA: SRS30816274", "样本元数据留英文");
});

test("提交门户渲染：卡片说明句（<strong> 切碎）与资源入口保持链接", () => {
  const { doc } = engineFor(
    '<div><h1>Submission Portal</h1>' +
      '<p>Submit to the world&#39;s largest public repository of biological and scientific information</p>' +
      '<h2>What do you want to submit?</h2>' +
      '<p>Enter a few words about your data and select an option to learn more.</p>' +
      '<label>Enter sequence type</label><button id="clear-btn">Clear</button><button id="search-btn">Suggest tool</button>' +
      '<h3>Suggested tools</h3>' +
      '<p>Submit assembled complete or incomplete/draft prokaryotic and eukaryotic genomes. Not for viral, phage, or single locus sequences (for example: 16S rRNA) - submit those to <a href="/subs/genbank/">SP-GenBank</a>.</p>' +
      '<p>Use the Submission Portal-GenBank to submit <strong>assembled</strong> nucleotide sequences, <strong>except</strong> for prokaryotic and eukaryotic genomes and transcriptomes.</p>' +
      '<p>Submit <strong>unassembled</strong>, high throughput sequencing reads.</p>' +
      '<li id="tool-publichealth-item"><a href="/about/public-health/">Public Health submitter guidance</a>' +
      '<br>Best practices and recommendations for public health submitters</li>' +
      '<h3>Sequence submission FAQ</h3><button>What is an accession number?</button>' +
      '<a href="/subs/genbank/">Submit to GenBank</a><a href="/subs/biosample/">BioProject and BioSample</a></div>'
  );
  assert.equal(text(doc.querySelector("h1")), "提交门户");
  assert.equal(text(doc.querySelector("p")), "向全球最大的生物学与科学信息公共存储库提交数据");
  assert.deepEqual([...doc.querySelectorAll("h2")].map(text), ["您想提交什么？"]);
  assert.deepEqual([...doc.querySelectorAll("button")].map(text), ["清除", "推荐工具", "什么是 accession 编号？"]);
  const ps = [...doc.querySelectorAll("p")].map(text);
  assert.equal(ps[1], "用几句话描述您的数据，并选择一个选项以了解更多。");
  assert.equal(
    ps[2],
    "提交组装完成的完整或未完成/草图级原核与真核基因组。不适用于病毒、噬菌体或单位点序列（例如 16S rRNA），这些请提交至SP-GenBank。"
  );
  assert.equal(ps[3], "使用 Submission Portal-GenBank 提交组装的核苷酸序列，但不包括原核与真核基因组及转录组。");
  assert.equal(ps[4], "提交未组装的高通量测序读长。");
  const strongs = [...doc.querySelectorAll("p strong")].map(text);
  assert.deepEqual(strongs.slice(0, 3), ["组装的", "但不包括", "未组装的"], "strong 槽位不连续或译文不对: " + strongs.join("|"));
  assert.equal(doc.querySelector("p a").getAttribute("href"), "/subs/genbank/", "模板里的链接不能丢");
  assert.deepEqual(
    [...doc.querySelectorAll("a")].slice(-2).map(text),
    ["向 GenBank 提交", "BioProject 与 BioSample"]
  );
  const li = doc.querySelector("#tool-publichealth-item");
  assert.equal(text(li), "公共卫生提交者指南面向公共卫生提交者的最佳实践与建议");
});

test("CCDS 报表页渲染：表头、链接说明与基因报表标题", () => {
  const { doc } = engineFor(
    '<div><h3>Report for Gene BRCA1</h3>' +
      '<table><thead><tr><th>CCDS</th><th>Current</th><th>Status</th><th>Species</th><th>Chrom.</th><th>Gene</th>' +
      '<th>CCDS Release</th><th>NCBI Annotation Release</th><th>Ensembl Annotation Release</th><th>Links</th></tr></thead>' +
      '<tbody><tr><td>11453.1</td><td>Public</td><td>Homo sapiens</td><td>17</td><td>BRCA1</td><td>24</td></tr></tbody></table>' +
      '<table><tr><th>Links Key</th><th>Links to:</th><th>Re-query CCDS DB by:</th><th>Genome Browser Links:</th></tr>' +
      '<tr><td>History report</td><td>BLAST report</td><td>Nucleotide report</td><td>Protein report</td></tr></table>' +
      '<p>Available information includes:</p>' +
      '<table><tr><td>Overview</td><td>Access and Availability</td><td>CCDS Identifiers and Tracking</td>' +
      '<td>Process Flow and Quality Testing</td></tr></table></div>'
  );
  assert.equal(text(doc.querySelector("h3")), "基因 BRCA1 的报告");
  assert.deepEqual(
    [...doc.querySelectorAll("thead th")].map(text),
    ["CCDS", "当前", "状态", "物种", "染色体", "基因", "CCDS 版本", "NCBI 注释版本", "Ensembl 注释版本", "链接"]
  );
  const secondTh = [...doc.querySelectorAll("table")[1].querySelectorAll("th")].map(text);
  assert.deepEqual(secondTh, ["链接说明", "链接指向：", "按以下条件重新查询 CCDS 数据库：", "基因组浏览器链接："]);
  assert.deepEqual(
    [...doc.querySelectorAll("table")[1].querySelectorAll("td")].map(text),
    ["历史报告", "BLAST 报告", "核苷酸报告", "蛋白质报告"]
  );
  assert.equal(text(doc.querySelector("body > div > p")), "可用信息包括：");
  assert.deepEqual(
    [...doc.querySelectorAll("table")[2].querySelectorAll("td")].map(text),
    ["概览", "访问与获取", "CCDS 标识符与追踪", "流程与质量检测"]
  );
});
