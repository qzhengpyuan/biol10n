// r57 GDC 文档站补译（API 检索与获取 / 文件下载 / 提交 API / 附录 A 可用字段 / 数据模型 / 生物信息学流程）。
// 实测来源（2026-11-25，docs.gdc.cancer.gov 原始英文 HTML，jsdom 回放真实 DOM，TreeWalker 取 trim 后 ≤80 字符、含字母、不含汉字的文本）：
//   https://docs.gdc.cancer.gov/API/Users_Guide/Search_and_Retrieval/            454 -> 234
//   https://docs.gdc.cancer.gov/API/Users_Guide/Downloading_Files/               214 -> 73
//   https://docs.gdc.cancer.gov/API/Users_Guide/Submission/                      405 -> 205
//   https://docs.gdc.cancer.gov/API/Users_Guide/Appendix_A_Available_Fields/    2520 -> 2382（残差为字段名与类型说明，按口径保留）
//   https://docs.gdc.cancer.gov/Data/Data_Model/GDC_Data_Model/                  222 -> 64
//   https://docs.gdc.cancer.gov/Data/Bioinformatics_Pipelines/CNV_Pipeline/      216 -> 88
//   https://docs.gdc.cancer.gov/Data/Bioinformatics_Pipelines/DNA_Seq_Variant_Calling_Pipeline/ 340 -> 154
//   https://docs.gdc.cancer.gov/Data/Bioinformatics_Pipelines/DNA_Seq_WGS/       272 -> 123
//   https://docs.gdc.cancer.gov/Data/Bioinformatics_Pipelines/Expression_mRNA_Pipeline/ 261 -> 107
//   https://docs.gdc.cancer.gov/Data/Bioinformatics_Pipelines/Methylation_Pipeline/ 213 -> 65
//   https://docs.gdc.cancer.gov/Data/Bioinformatics_Pipelines/RPPA_intro/        198 -> 74
//   https://docs.gdc.cancer.gov/Data/Bioinformatics_Pipelines/miRNA_Pipeline/    195 -> 68
// 口径：API 字段名（case / sample / submitter_id）、JSON 示例、流程名（BWA、STAR、MuTect2…）、登录号与 UUID 一律不翻；
// 带内联链接的整段进 templates，{{n}} 与段内第 n 个内联元素一一对应。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const SITE = sites.find((s) => s.id === "gdc-docs");
const BOOK = JSON.parse(fs.readFileSync(path.join(root, "../dict/gdc-docs.json"), "utf8"));
const CJK = /[\u3400-\u9fff]/;

function load() {
  const exact = {};
  const rules = [];
  const templates = [];
  for (const n of SITE.dicts) {
    const d = JSON.parse(fs.readFileSync(path.join(root, "../dict/" + n + ".json"), "utf8"));
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
    templates.push(...(d.templates || []));
  }
  return { exact, rules, templates };
}
const DATA = load();

const URLS = {
  p1: "https://docs.gdc.cancer.gov/API/Users_Guide/Search_and_Retrieval/",
  p2: "https://docs.gdc.cancer.gov/API/Users_Guide/Downloading_Files/",
  p3: "https://docs.gdc.cancer.gov/API/Users_Guide/Submission/",
  p5: "https://docs.gdc.cancer.gov/Data/Data_Model/GDC_Data_Model/",
  b2: "https://docs.gdc.cancer.gov/Data/Bioinformatics_Pipelines/DNA_Seq_Variant_Calling_Pipeline/"
};

function boot(html, key = "p1") {
  const dom = new JSDOM(html, { url: URLS[key] });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data: DATA, site: SITE });
  engine.start();
  return { engine, doc: dom.window.document };
}

// r57 新增 exact（原文逐字取自上述页面文本节点）
const NEW_EXACT = {
  "Introducing Search and Retrieval Requests": "搜索与获取请求简介",
  "Components of a Request": "请求的组成部分",
  "Retrieval of project metadata using project_id": "使用 project_id 获取项目元数据",
  "Filters: Specifying the Query": "过滤器：指定查询",
  "Example: exclude and excludeifany Operators": "示例：exclude 与 excludeifany 运算符",
  "Alternative Request Format": "替代请求格式",
  "Downloading an Uncompressed Group of Files": "下载未压缩的文件组",
  "POST request with form data payload": "携带表单数据载荷的 POST 请求",
  "Manifest endpoint": "清单端点",
  "Dry Run Transactions": "试运行事务",
  "Transaction Status": "事务状态",
  "Making Requests to the Submission API": "向提交 API 发起请求",
  "Patching Entitites": "修补实体",
  "Methylation Liftover Pipeline": "甲基化 Liftover 流程",
  "Microsatellite Instability Detection": "微卫星不稳定性检测",
  "Copy Number Variation Analysis Pipeline": "拷贝数变异分析流程",
  "DNA-Seq: Whole Genome Sequencing Variant Calling": "DNA-Seq：全基因组测序变异检出",
  "Protein Expression - RPPA": "蛋白质表达 - RPPA",
  "Step 1: Converting BAMs to FASTQs with Biobambam - biobambam2": "步骤 1：使用 Biobambam 将 BAM 转换为 FASTQ - biobambam2",
  "Base Quality Score Recalibration": "碱基质量分数重校准"
};

// ---------------- 结构与词库 ----------------

test("gdc-docs 词库：r57 新增条目就位，计数不回退", () => {
  assert.equal(BOOK.meta.family, "gdc");
  assert.deepEqual(BOOK.meta.sites, ["gdc.cancer.gov"]);
  assert.ok(SITE.dicts.includes("gdc-docs"));
  assert.ok(Object.keys(BOOK.exact).length >= 1091, "exact 条数不足（r57 后应 ≥1091）");
  assert.ok(BOOK.templates.length >= 126, "模板条数不足（r57 后应 ≥126）");
  assert.ok(BOOK.rules.length >= 12, "规则条数不应回退");
});

test("词库形状：rules 是对象、templates 是对象、译文含汉字、无自映射", () => {
  for (const r of BOOK.rules) {
    assert.equal(typeof r, "object", "rules 必须是对象");
    assert.equal(typeof r.re, "string", "rules 缺 re：" + JSON.stringify(r));
    assert.equal(typeof r.to, "string", "rules 缺 to：" + JSON.stringify(r));
  }
  for (const t of BOOK.templates) {
    assert.equal(typeof t, "object", "templates 必须是对象");
    assert.equal(typeof t.pat, "string");
    assert.equal(typeof t.zh, "string");
    assert.match(t.zh, CJK, "模板译文不含汉字：" + t.pat.slice(0, 50));
  }
  for (const [k, v] of Object.entries(BOOK.exact)) {
    assert.equal(typeof v, "string");
    assert.match(v, CJK, "译文不含汉字：" + k);
    assert.notEqual(k, v, "自映射：" + k);
    assert.ok(!CJK.test(k), "键含中文：" + k);
    assert.equal(v.trim(), v, "值有首尾空白：" + k);
  }
});

test("r57 新增 exact 逐条命中（词库 + 引擎两条路径）", () => {
  const { engine } = boot("<p>x</p>");
  for (const [en, zh] of Object.entries(NEW_EXACT)) {
    assert.equal(BOOK.exact[en], zh, "词库缺条目或译法不一致：" + en);
    assert.equal(engine.translateText(en), zh, "引擎未命中：" + en);
  }
});

test("短词护栏：r57 新增键长度都 > 3（避免污染长句）", () => {
  for (const en of Object.keys(NEW_EXACT)) assert.ok(en.length > 3, "过短的键：" + en);
});

test("模板占位符：所有模板 {{n}} 从 1 连续、zh 与 pat 数量一致", () => {
  for (const t of BOOK.templates) {
    const nums = (s) => [...s.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    const a = nums(t.pat);
    if (!a.length) continue;
    const b = nums(t.zh);
    assert.equal(b.length, a.length, "占位符数量不一致：" + t.pat.slice(0, 60));
    assert.deepEqual([...new Set(b)].sort((x, y) => x - y), a.map((_, i) => i + 1), "占位符编号不连续：" + t.pat.slice(0, 60));
  }
});

test("跨册同键：r57 新增 exact 与其它册的译法一致（不新增冲突）", () => {
  const dir = path.join(root, "../dict");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json") && x !== "gdc-docs.json")) {
    const other = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    for (const k of Object.keys(NEW_EXACT)) {
      if (k in (other.exact || {})) assert.equal(other.exact[k], NEW_EXACT[k], "跨册冲突：" + f + " / " + k);
    }
  }
});

// ---------------- 导航与目录 ----------------

test("目录/导航：API 章节标题译成中文，链接 href 不变", () => {
  const html =
    '<nav class="md-nav"><ul class="md-nav__list">' +
    '<li class="md-nav__item"><a href="../Search_and_Retrieval/" class="md-nav__link"><span class="md-ellipsis">Filters: Specifying the Query</span></a></li>' +
    '<li class="md-nav__item"><a href="../Downloading_Files/" class="md-nav__link"><span class="md-ellipsis">Manifest endpoint</span></a></li>' +
    '<li class="md-nav__item"><a href="../Submission/" class="md-nav__link"><span class="md-ellipsis">Dry Run Transactions</span></a></li>' +
    '</ul></nav>';
  const { doc } = boot(html, "p1");
  const links = [...doc.querySelectorAll("a")];
  assert.equal(links.length, 3);
  assert.equal(links[0].textContent.trim(), "过滤器：指定查询");
  assert.equal(links[1].textContent.trim(), "清单端点");
  assert.equal(links[2].textContent.trim(), "试运行事务");
  assert.deepEqual(links.map((a) => a.getAttribute("href")), ["../Search_and_Retrieval/", "../Downloading_Files/", "../Submission/"]);
});

test("页面标题：流程页与附录页标题整条译成中文", () => {
  const cases = [
    ["Bioinformatics Pipeline: Copy Number Variation Analysis - GDC Docs", "生物信息学流程：拷贝数变异分析 - GDC 文档"],
    ["Bioinformatics Pipeline: Methylation Analysis Pipeline - GDC Docs", "生物信息学流程：甲基化分析流程 - GDC 文档"],
    ["Bioinformatics Pipeline: Protein Expression - GDC Docs", "生物信息学流程：蛋白质表达 - GDC 文档"],
    ["Aligned Reads Summary Metrics - GDC Docs", "比对读段汇总指标 - GDC 文档"],
    ["Appendix A: Available Fields - GDC Docs", "附录 A：可用字段 - GDC 文档"]
  ];
  for (const [en, zh] of cases) {
    const dom = new JSDOM("<html><head><title>" + en + "</title></head><body><p>x</p></body></html>", { url: URLS.p1 });
    const engine = createEngine({ document: dom.window.document, window: dom.window, data: DATA, site: SITE });
    engine.start();
    assert.equal(dom.window.document.title, zh, "标题未译：" + en);
  }
});

// ---------------- 模板渲染 ----------------

test("下载文件整段：清单端点模板生效，2 个链接与 2 个 code 全部保留", () => {
  const html =
    '<p id="p">The <code>manifest</code> endpoint generates a download manifest file that can be used with the ' +
    '<a href="../../../Data_Transfer_Tool/Users_Guide/Getting_Started/">GDC Data Transfer Tool</a>. The Data Transfer Tool is recommended for transferring large volumes of data. ' +
    'The GDC API can also generate a download manifest from a list of results that match a <a href="../Search_and_Retrieval/">Search and Retrieval</a> query. ' +
    'To do this, append <code>&amp;return_type=manifest</code> to the end of the query. Note that the "size" parameter does not work with the manifest endpoint and will return the entire set of files.</p>';
  const { doc } = boot(html, "p2");
  const p = doc.getElementById("p");
  assert.doesNotMatch(p.textContent, /\{\{/, "占位符未替换");
  assert.match(p.textContent, /端点生成下载清单文件/);
  assert.match(p.textContent, /会返回整个文件集/);
  const links = [...p.querySelectorAll("a")];
  assert.equal(links.length, 2, "链接数量被改变");
  assert.equal(links[0].getAttribute("href"), "../../../Data_Transfer_Tool/Users_Guide/Getting_Started/");
  assert.equal(links[1].getAttribute("href"), "../Search_and_Retrieval/");
  assert.match(links[0].textContent, CJK);
  assert.equal(p.querySelectorAll("code").length, 2, "code 数量被改变");
  assert.equal([...p.querySelectorAll("code")][1].textContent, "&return_type=manifest");
});

test("端点选择整段：6 个槽位顺序正确，链接 href 与 code 文本原样", () => {
  const html =
    '<p id="p">The choice of endpoint determines what is listed in the search results. The <code>files</code> endpoint will generate a list of files, whereas the ' +
    '<code>cases</code> endpoint will generate a list of cases. Each of the above endpoints, other than <code>_mapping</code>, can query and return any of the related fields in the ' +
    '<a href="../../../Data/Data_Model/GDC_Data_Model/">GDC Data Model</a>. So the <code>cases</code> endpoint can be queried for file fields (e.g. to look for cases that have certain types of experimental data), ' +
    'and the <code>files</code> endpoint can be queried for clinical metadata associated with a case (e.g. to look for files from cases diagnosed with a specific cancer type).</p>';
  const { doc } = boot(html, "p1");
  const p = doc.getElementById("p");
  assert.match(p.textContent, /端点的选择决定搜索结果中列出什么/);
  assert.match(p.textContent, /可用于查询与病例相关的临床元数据/);
  assert.equal(p.querySelectorAll("a").length, 1);
  assert.equal(p.querySelector("a").getAttribute("href"), "../../../Data/Data_Model/GDC_Data_Model/");
  const codes = [...p.querySelectorAll("code")].map((c) => c.textContent);
  assert.deepEqual(codes, ["files", "cases", "_mapping", "cases", "files"]);
  assert.equal(p.querySelectorAll("code")[0].textContent, "files");
});

test("参数名不翻：带 from/size/sort/pretty 参数链接的示例段保持英文", () => {
  const html =
    '<p id="p">This example is a query for projects contained in the GDC. It uses the <a href="#size-and-from">from</a>, <a href="#size-and-from">size</a>, ' +
    '<a href="#sort">sort</a>, and <a href="#pretty">pretty</a> parameters, and returns the first two projects sorted by project id.</p>';
  const { doc } = boot(html, "p1");
  const p = doc.getElementById("p");
  // 整段模板会让内联补译把参数名翻成「大小 / 排序」，违反「参数名不翻」，因此该段不建模板。
  assert.equal(p.textContent.trim(), "This example is a query for projects contained in the GDC. It uses the from, size, sort, and pretty parameters, and returns the first two projects sorted by project id.");
  const links = [...p.querySelectorAll("a")];
  assert.deepEqual(links.map((a) => a.getAttribute("href")), ["#size-and-from", "#size-and-from", "#sort", "#pretty"]);
  assert.deepEqual(links.map((a) => a.textContent), ["from", "size", "sort", "pretty"]);
});

test("DNA-Seq 分析整段：BWA/Picard 六个槽位与 pubmed 引用链接保留", () => {
  const html =
    '<p id="p">DNA-Seq analysis begins with the <a href="/Data_Dictionary/viewer/#?view=table-definition-view&amp;id=alignment_workflow">Alignment Workflow</a>. ' +
    'Read groups are aligned to the reference genome using one of two <a href="http://bio-bwa.sourceforge.net">BWA</a> algorithms <a href="http://www.ncbi.nlm.nih.gov/pubmed/19451168">[1]</a>. ' +
    'BWA-MEM is used if mean read length is greater than or equal to 70 bp. Otherwise BWA-aln is used. Each read group is aligned to the reference genome separately and all read group alignments that belong to a single aliquot are merged using ' +
    '<a href="http://broadinstitute.github.io/picard">Picard Tools</a> <a href="https://broadinstitute.github.io/picard/command-line-overview.html#SortSam">SortSam</a> and <a href="https://broadinstitute.github.io/picard/command-line-overview.html#MergeSamFiles">MergeSamFiles</a>. ' +
    'Duplicate reads, which may persist as PCR artifacts, are then flagged to prevent downstream variant call errors.</p>';
  const { doc } = boot(html, "b2");
  const p = doc.getElementById("p");
  assert.match(p.textContent, /DNA-Seq 分析从比对流程开始/);
  assert.match(p.textContent, /属于同一等分试样的所有读段组比对结果使用/);
  assert.match(p.textContent, /以避免下游变异检出错误/);
  const links = [...p.querySelectorAll("a")];
  assert.equal(links.length, 6, "链接数量被改变");
  assert.equal(links[0].getAttribute("href"), "/Data_Dictionary/viewer/#?view=table-definition-view&id=alignment_workflow");
  assert.equal(links[1].getAttribute("href"), "http://bio-bwa.sourceforge.net");
  assert.equal(links[2].textContent, "[1]");
  assert.equal(links[5].getAttribute("href"), "https://broadinstitute.github.io/picard/command-line-overview.html#MergeSamFiles");
  assert.match(links[0].textContent, CJK, "Alignment Workflow 链接文字未译");
});

test("提交模板整段：GDC Data Model 文档与数据字典两个链接保留", () => {
  const html =
    '<p id="p">Submitters should review the <a href="../../../Data/Data_Model/GDC_Data_Model/">GDC Data Model documentation</a> and the ' +
    '<a href="../../../Data_Dictionary/">GDC Data Dictionary</a> before initiating submission.</p>';
  const { doc } = boot(html, "p3");
  const p = doc.getElementById("p");
  assert.match(p.textContent, /提交者在开始提交前应查阅/);
  const links = [...p.querySelectorAll("a")];
  assert.equal(links.length, 2);
  assert.deepEqual(links.map((a) => a.getAttribute("href")), ["../../../Data/Data_Model/GDC_Data_Model/", "../../../Data_Dictionary/"]);
});

test("JSON 模板整段：URL 槽位原样保留，不误译接口地址", () => {
  const html =
    '<p id="p">The JSON in the request was generated using the <code>case</code> JSON template that can be obtained from the ' +
    '<a href="../../../Data_Dictionary/">GDC Data Dictionary Viewer</a> and from <code>https://api.gdc.cancer.gov/v0/submission/template/case?format=json</code>.</p>';
  const { doc } = boot(html, "p3");
  const p = doc.getElementById("p");
  assert.match(p.textContent, /请求中的 JSON 是使用/);
  const codes = [...p.querySelectorAll("code")].map((c) => c.textContent);
  assert.equal(codes[1], "https://api.gdc.cancer.gov/v0/submission/template/case?format=json");
  assert.equal(p.querySelectorAll("a").length, 1);
});

// ---------------- 不翻口径 ----------------

test("流程名与工具名不翻：missNoise 词条与品牌缩写保持英文", () => {
  const { engine } = boot("<p>x</p>");
  for (const s of ["BWA with BQSR", "STAR 2-Pass Genome", "MuTect2", "CellRanger - 10x Chromium", "ASCAT2", "FoundationOne Annotation"]) {
    assert.equal(DATA.exact[s], undefined, "流程名不该进 exact：" + s);
    assert.equal(engine.translateText(s), null, "流程名被翻译了：" + s);
  }
  for (const s of ["API", "UUID", "dbGaP", "TCGA VCF 1.1v2"]) {
    assert.equal(DATA.exact[s], undefined, "品牌/缩写不该进 exact：" + s);
    assert.equal(engine.translateText(s), null, "品牌/缩写被翻译了：" + s);
  }
});

test("字段名、坐标串与登录号不翻：submitter_id / GRCh38.d1.vd1 / PRJNA 保持原样", () => {
  const { engine, doc } = boot('<p id="p">submitter_id case_id GRCh38.d1.vd1 PRJNA123456 rs1234567</p>', "p5");
  assert.equal(doc.getElementById("p").textContent, "submitter_id case_id GRCh38.d1.vd1 PRJNA123456 rs1234567");
  for (const s of ["submitter_id", "GRCh38.d1.vd1", "PRJNA123456"]) assert.equal(engine.translateText(s), null, "数据标识被翻译了：" + s);
});

test("未登记的英文段落保持原样（模板与词条不误伤）", () => {
  const html = '<p id="p">This paragraph is not part of the GDC API documentation and must stay untouched for now.</p>';
  const { doc } = boot(html, "p1");
  assert.equal(doc.getElementById("p").textContent, "This paragraph is not part of the GDC API documentation and must stay untouched for now.");
});