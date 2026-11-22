// BioStudies（www.ebi.ac.uk/biostudies）站点词库回归：
// 首页 / 收藏集 / 检索与筛选 / 研究详情（字段区、文件表、关联信息）/ 关于 / 提交 FAQ / 帮助页
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/biostudies.json"), "utf8"));

// 线上站点栈：EMBL-EBI 全局页头页脚由 string-atlas / string-atlas2 提供，BioStudies 本体最后
const STACK = ["common", "string-atlas", "string-atlas2", "biostudies"];
const exact = {};
const rules = [];
const templates = [];
for (const id of STACK) {
  const d = JSON.parse(fs.readFileSync(path.join(root, "../dict", id + ".json"), "utf8"));
  Object.assign(exact, d.exact || {});
  if (d.rules) rules.push(...d.rules);
  if (d.templates) templates.push(...d.templates);
}

// config/sites.json 尚未收录 biostudies，测试用等价的最小站点对象
const site = { id: "biostudies", hosts: ["www.ebi.ac.uk"], path: "^/biostudies" };

function run(html) {
  const dom = new JSDOM(html);
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact, rules, templates },
    site
  });
  engine.start();
  return dom.window.document;
}

const text = (el) => String(el.textContent || "").replace(/\s+/g, " ").trim();

test("词库结构：条数、键值形态、规则可编译、模板槽位连续", () => {
  assert.equal(book.meta.family, "biostudies");
  assert.ok(book.meta.sites.includes("www.ebi.ac.uk"), "sites 要挂 www.ebi.ac.uk");
  assert.ok(Object.keys(book.exact).length >= 200, "exact 至少 200 条");
  assert.ok(book.rules.length >= 14, "rules 至少 14 条");
  assert.ok(book.templates.length >= 10, "templates 至少 10 条");

  const seen = new Set();
  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "键里不能有中文: " + k);
    assert.ok(/[\u4e00-\u9fff]/.test(v), "译文里必须有中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "键首尾不能有空白: " + JSON.stringify(k));
    assert.equal(v, v.trim(), "译文首尾不能有空白: " + JSON.stringify(v));
    assert.ok(!seen.has(k), "重复键: " + k);
    seen.add(k);
  }
  for (const r of book.rules) {
    const re = new RegExp(r.re);
    assert.ok(re.source.length > 0);
    assert.ok(/[\u4e00-\u9fff]/.test(r.to), "规则译文里必须有中文: " + r.re);
    assert.ok(/\$\d/.test(r.to), "带捕获组的规则要用到占位符: " + r.re);
  }
  for (const t of book.templates) {
    const used = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.ok(used.length >= 1, "模板要带槽位: " + t.pat);
    const sorted = used.slice().sort((a, b) => a - b);
    sorted.forEach((n, i) => assert.equal(n, i + 1, "槽位必须从 1 连续: " + t.pat));
    const zhUsed = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.deepEqual(zhUsed.slice().sort((a, b) => a - b), sorted, "译文槽位要与原文一致");
  }
});

test("首页：tagline、简介整段、最新标题与更新日期", () => {
  const doc = run(
    '<div class="hero"><h1>BioStudies – one package for all the data supporting a study</h1>' +
      "<p>The BioStudies database holds descriptions of biological studies, links to data from these studies in other databases at EMBL-EBI or outside, as well as data that do not fit in the structured archives at EMBL-EBI. The database can accept a wide range of types of studies described via a simple format. It also enables manuscript authors to submit supplementary information and link to it from the publication.</p></div>" +
      "<h2>Latest <span>(Updated: 22 November 2026 at 12:30:04)</span></h2>" +
      "<div><span>BioStudies is a recommended ELIXIR Deposition Database</span><span>is part of the ELIXIR infrastructure</span></div>"
  );
  assert.equal(doc.querySelector("h1").textContent, "BioStudies：一个数据包，承载研究所需的全部数据");
  const p = text(doc.querySelector("p"));
  assert.ok(p.startsWith("BioStudies 数据库收录生物学研究的描述信息"), p);
  assert.ok(p.endsWith("也便于论文作者提交补充信息并从论文链接过去。"), p);
  assert.equal(text(doc.querySelector("h2")), "最新（更新于：2026 年 11 月 22 日 12:30:04）");
  const spans = [...doc.querySelectorAll("div span")].map(text);
  assert.deepEqual(spans, ["BioStudies 是 ELIXIR 推荐的数据存储数据库", "是 ELIXIR 基础设施的一部分"]);
});

test("导航与面包屑：当前位置、页码、支持与反馈、EBI 主页", () => {
  const doc = run(
    '<nav><ul class="dropdown menu">' +
      "<li><a>Search BioStudies</a></li><li><a>About BioStudies</a></li><li><a>Support and feedback</a></li><li><a>People and groups</a></li>" +
      "</ul></nav>" +
      '<ul class="breadcrumbs"><li><a href="/biostudies/">BioStudies</a></li>' +
      '<li><span class="show-for-sr">Current: </span> Collections</li></ul>' +
      '<span>You are here:</span><span>Pagination</span><a>EMBL-EBI home</a>'
  );
  const links = [...doc.querySelectorAll("nav a")].map(text);
  assert.deepEqual(links, ["检索 BioStudies", "关于 BioStudies", "支持与反馈", "人员与团队"]);
  const crumb = doc.querySelectorAll(".breadcrumbs li")[1];
  assert.equal(text(crumb).replace(/\s+/g, ""), "当前：收藏集");
  const spans = [...doc.querySelectorAll("span")].map(text);
  assert.ok(spans.includes("您所在位置："), spans.join("|"));
  assert.ok(spans.includes("页码"), spans.join("|"));
  assert.equal(doc.querySelector(".breadcrumbs a").getAttribute("href"), "/biostudies/", "链接地址不能改");
});

test("收藏集页：表头、DataTables 计数与分页、排序提示", () => {
  const doc = run(
    "<table><thead><tr>" +
      '<th aria-label="Collection: activate to sort column ascending">Collection</th>' +
      '<th aria-label="Description: activate to sort column ascending">Description</th>' +
      '<th aria-label="Studies: activate to sort column ascending">Studies</th>' +
      '<th aria-label="Links: activate to sort column ascending">Links</th>' +
      '<th aria-label="Files: activate to sort column ascending">Files</th>' +
      '<th aria-label="Type: activate to sort column ascending">Type</th>' +
      "</tr></thead></table>" +
      '<div class="dataTables_info">Showing 1 to 10 of 18 entries</div>' +
      '<ul class="pagination"><li><a>Page 1</a></li><li><a>Page 2</a></li></ul>'
  );
  const ths = [...doc.querySelectorAll("th")].map(text);
  assert.deepEqual(ths, ["合集", "描述", "研究", "链接", "文件", "类型"]);
  const arias = [...doc.querySelectorAll("th")].map((t) => t.getAttribute("aria-label"));
  assert.deepEqual(arias, [
    "合集：点击按升序排序",
    "描述：点击按升序排序",
    "研究：点击按升序排序",
    "链接：点击按升序排序",
    "文件：点击按升序排序",
    "类型：点击按升序排序"
  ]);
  assert.equal(text(doc.querySelector(".dataTables_info")), "显示第 1–10 条，共 18 条");
  assert.deepEqual([...doc.querySelectorAll(".pagination a")].map(text), ["第 1 页", "第 2 页"]);
});

test("检索页：检索头、结果计数、分面与同义词警告", () => {
  const doc = run(
    "<h2>Search results for <b>cancer</b></h2>" +
      "<div><h3>Collection</h3><h3>Release Date</h3><h3>Link Type</h3><h3>File Type</h3><a>see all</a><span>TOP 10</span></div>" +
      '<p class="warning">You query contains a term which has too many synonyms and more specific phrases in <a href="#">EFO</a>. The results shown below do not include those expanded terms.</p>' +
      '<div class="results"><span>1 ‒ 20 of 64,602+ results</span></div>'
  );
  assert.equal(text(doc.querySelector("h2")), "检索结果：cancer");
  assert.deepEqual([...doc.querySelectorAll("h3")].map(text), ["合集", "发布日期", "链接类型", "文件类型"]);
  assert.equal(text(doc.querySelector("div a")), "查看全部");
  assert.equal(text(doc.querySelector("div span")), "前 10");
  assert.equal(
    text(doc.querySelector(".warning")),
    "您的检索词中包含同义词过多、且在 EFO 中更具体的短语；下方结果不含这些扩展词。"
  );
  assert.equal(text(doc.querySelector(".results span")), "1 ‒ 20，共 64,602+ 条结果");
});

test("二级浏览页：收藏集名与数量单位（studies/links/files/views）", () => {
  const doc = run(
    "<div><span>3,478,315 studies</span><span>25,829,575 links</span><span>68,590,629 files</span>" +
      "<span>7 views</span><span>1 file</span><span>2 links</span></div>"
  );
  assert.deepEqual([...doc.querySelectorAll("span")].map(text), [
    "3,478,315 项研究",
    "25,829,575 个链接",
    "68,590,629 个文件",
    "7 次浏览",
    "1 个文件",
    "2 个链接"
  ]);
});

test("研究详情页（BioStudies）：字段区、修改时间、页签与文件表", () => {
  const doc = run(
    '<div class="study">' +
      "<p>Release Date: 2024-06-01</p><p>▪ Modified: 2025-01-02</p>" +
      "<dl><dt>E-mail:</dt><dd>a@b.org</dd><dt>Affiliation</dt><dd>MGH - Massachusetts General Hospital</dd>" +
      "<dt>RORID:</dt><dd>https://ror.org/002pd6e78</dd><dt>Taxonomy (NCBI)</dt><dd>TaxID:9606</dd></dl>" +
      "<ul><li><a>Data files</a></li><li><a>Linked Information</a></li><li><a>Similar Studies</a></li></ul>" +
      '<button title="Download Study as JSON">[JSON]</button>' +
      '<button title="Download Study as PageTab">[PageTab]</button>' +
      "<span>Download all files</span><span>Too many files!</span>" +
      '<table><tbody><tr><td class="dataTables_empty">No data available in table</td></tr></tbody></table>' +
      '<div class="dataTables_info">Showing 1 to 1 of 1 entries</div>'
  );
  assert.deepEqual([...doc.querySelectorAll("p")].map(text), ["发布日期：2024-06-01", "▪ 修改于：2025-01-02"]);
  assert.deepEqual([...doc.querySelectorAll("dt")].map(text), ["电子邮箱：", "所属单位", "ROR 编号：", "分类学（NCBI）"]);
  assert.deepEqual([...doc.querySelectorAll("li a")].map(text), ["数据文件", "关联信息", "相似研究"]);
  assert.equal(doc.querySelectorAll("button")[0].getAttribute("title"), "以 JSON 格式下载研究");
  assert.equal(doc.querySelectorAll("button")[1].getAttribute("title"), "以 PageTab 格式下载研究");
  assert.deepEqual([...doc.querySelectorAll(".study > span")].map(text), ["下载全部文件", "文件数过多！"]);
  assert.equal(text(doc.querySelector(".dataTables_empty")), "表中暂无数据");
  assert.equal(text(doc.querySelector(".dataTables_info")), "显示第 1–1 条，共 1 条");
});

test("研究详情页（ArrayExpress）：检测与数据、实验方案、表格切换与角色字段", () => {
  const doc = run(
    "<div>" +
      "<h3>Assays and Data</h3><h3>Protocols</h3><h3>MAGE-TAB Files</h3>" +
      "<span>MINSEQE Score</span><span>Exp. Design</span><span>No. of Samples</span>" +
      '<a href="#">view table</a><span>File List</span>' +
      "<h4>Source Characteristics</h4><h4>Characteristics Table</h4><h4>Factors Table</h4><h4>Variables</h4>" +
      "<span>Role:</span><span>investigator;submitter</span>" +
      "<span>Processed</span><span>Raw</span>" +
      '<span class="more">... 5 other values</span>' +
      "<p>E-MTAB-17034</p><p>Homo sapiens</p>"
  );
  assert.deepEqual([...doc.querySelectorAll("h3")].map(text), ["检测与数据", "实验方案", "MAGE-TAB 文件"]);
  assert.deepEqual([...doc.querySelectorAll("div > span")].map(text).slice(0, 3), ["MINSEQE 评分", "实验设计", "样本数"]);
  assert.equal(text(doc.querySelector("a")), "查看表格");
  assert.deepEqual([...doc.querySelectorAll("h4")].map(text), ["源特征", "特征表", "因素表", "变量"]);
  assert.deepEqual([...doc.querySelectorAll(".more")].map(text), ["……另 5 个值"]);
  assert.deepEqual([...doc.querySelectorAll("p")].map(text), ["E-MTAB-17034", "Homo sapiens"], "accession 与物种拉丁名不翻");
});

test("研究详情页（BioImages）：图像数据集页签、集合内检索与关联段", () => {
  const doc = run(
    "<div>" +
      '<label><input type="checkbox">Search in BioImages only</label>' +
      '<span class="section-title">Associations</span>' +
      '<span class="section-title">Data files</span>' +
      '<button title="Select all files">x</button><button title="Close modal">x</button>' +
      '<span title="Open HTTP Folder">HTTP</span><span title="Open Globus">Globus</span>' +
      "<span>File List</span><span>File Type</span><span>File list length</span>" +
      "<h4>Image acquisition</h4><h4>Imaging method</h4><h4>Imaging instrument</h4>"
  );
  assert.equal(text(doc.querySelector("label")), "仅在 BioImages 中检索");
  assert.deepEqual([...doc.querySelectorAll(".section-title")].map(text), ["关联", "数据文件"]);
  assert.deepEqual([...doc.querySelectorAll("button")].map((b) => b.getAttribute("title")), ["选择全部文件", "关闭弹窗"]);
  assert.deepEqual([...doc.querySelectorAll("[title]")].slice(2).map((b) => b.getAttribute("title")), [
    "打开 HTTP 目录",
    "打开 Globus"
  ]);
  assert.deepEqual([...doc.querySelectorAll("div > span")].map(text).slice(-3), ["文件列表", "文件类型", "文件列表长度"]);
  assert.deepEqual([...doc.querySelectorAll("h4")].map(text), ["图像采集", "成像方法", "成像仪器"]);
});

test("关于页：章节标题、使命段模板与团队段", () => {
  const doc = run(
    "<div>" +
      "<h3>What is BioStudies?</h3><h3>Citing BioStudies</h3>" +
      "<h3>Citing a particular dataset in BioStudies</h3><h3>The team behind BioStudies</h3>" +
      "<p>The mission of BioStudies is to provide access to all the data outputs of a life sciences study from a single place, by organising links to data in other databases at EMBL-EBI or elsewhere, as well as hosting data and metadata that do not fit anywhere else. The database accepts submissions via an online tool, or in a simple tab-delimited format. BioStudies provides rich mechanisms for defining and using metadata guidelines specific for a particular data source such as a project or a community, and organises datasets in <a href=\"/biostudies/collections\">collections</a>.</p>" +
      "<p>BioStudies is developed and run by the <a href=\"/biostudies/teams\">BioStudies team</a>.</p>" +
      "<p>The ArrayExpress collection and Annotare are maintained by the <a href=\"/arrayexpress\">Gene Expression team</a>.</p>" +
      "</div>"
  );
  assert.deepEqual([...doc.querySelectorAll("h3")].map(text), [
    "什么是 BioStudies？",
    "引用 BioStudies",
    "引用 BioStudies 中的特定数据集",
    "BioStudies 团队"
  ]);
  const ps = [...doc.querySelectorAll("p")];
  assert.ok(text(ps[0]).startsWith("BioStudies 的使命是在同一处提供生命科学研究的所有数据产出"), text(ps[0]));
  assert.ok(text(ps[0]).endsWith("并把数据集组织成收藏集。"), text(ps[0]));
  assert.equal(text(ps[1]), "BioStudies 由BioStudies 团队开发并运行。");
  assert.equal(text(ps[2]), "ArrayExpress 收藏集与 Annotare 由基因表达团队维护。");
  assert.equal(ps[0].querySelector("a").getAttribute("href"), "/biostudies/collections", "模板替换不能丢链接");
  assert.equal(ps[2].querySelector("a").getAttribute("href"), "/arrayexpress", "模板替换不能丢链接");
});

test("提交与帮助页：FAQ 标题、文件命名枚举、帮助目录与 API 端点摘要", () => {
  const doc = run(
    "<div>" +
      "<h3>Which file types can I submit?</h3>" +
      "<p>BioStudies accepts all file types. However, there are some restrictions in the naming of the files. It is safe to use:</p>" +
      "<ul><li>Any alphanumeric character (a-z | A-Z | 0-9)</li><li>Exclamation point ( ! )</li><li>Hyphen ( - )</li>" +
      "<li>Underscore ( _ )</li><li>Period ( . )</li></ul>" +
      "<h4>Searching the archive</h4><h4>Downloading data</h4><h4>FTP downloads</h4><h4>Data access</h4>" +
      "<table><tr><th>Parameter</th><th>Description</th></tr></table>" +
      "<p>/api/v1/studies Returns a list of studies according to the search criteria</p>" +
      "<p>/api/v1/studies/{accession} Returns the detailed JSON for a particular accession</p>" +
      "</div>"
  );
  assert.equal(text(doc.querySelector("h3")), "可以提交哪些文件类型？");
  assert.ok(text(doc.querySelector("div > p")).startsWith("BioStudies 接受所有文件类型，但对文件命名有一定限制。"));
  assert.deepEqual([...doc.querySelectorAll("li")].map(text), [
    "任意字母数字字符（a-z | A-Z | 0-9）",
    "感叹号（!）",
    "连字符（-）",
    "下划线（_）",
    "句点（.）"
  ]);
  assert.deepEqual([...doc.querySelectorAll("h4")].map(text), ["检索档案", "下载数据", "FTP 下载", "数据获取"]);
  assert.deepEqual([...doc.querySelectorAll("th")].map(text), ["参数", "描述"]);
  const ps = [...doc.querySelectorAll("p")].map(text);
  assert.equal(ps[1], "/api/v1/studies 按检索条件返回研究列表");
  assert.equal(ps[2], "/api/v1/studies/{accession} 返回指定登录号的完整 JSON");
});

test("帮助页：跨节点 FAQ 段落模板（游标分页 / 下载帮助 / 许可）", () => {
  const doc = run(
    '<div class="faq">' +
      "<p>If you need to retrieve a large number of search results, or all studies matching a search or belonging to a collection, use the BioStudies API with cursor pagination rather than requesting increasingly deep result pages. See the <strong>API</strong> section below for cursor pagination and examples.</p>" +
      "<p>For general help with downloading see <a href=\"/biostudies/help\">here</a>. Aspera transfers are supported, and are particularly useful for large data volumes.</p>" +
      "<p>Some datasets will have license info included in the metadata “License” field. Where no license is stated, data are available under the <a href=\"/about/terms-of-use\">EBI Terms of Use</a> which place no restrictions on use or redistribution.</p>" +
      "</div>"
  );
  const ps = [...doc.querySelectorAll("p")].map(text);
  assert.ok(ps[0].startsWith("如果需要取出大量检索结果"), ps[0]);
  assert.ok(ps[0].endsWith("游标分页与示例见下方的API一节。"), ps[0]);
  assert.equal(ps[1], "下载的通用帮助见此处。支持 Aspera 传输，对大数据量尤其有用。");
  assert.equal(
    ps[2],
    "部分数据集会在元数据“License”字段中给出许可信息；未注明许可的，数据按EBI 使用条款提供，对该数据的使用或再分发不设限制。"
  );
  assert.equal(doc.querySelectorAll("p")[1].querySelector("a").getAttribute("href"), "/biostudies/help");
  assert.equal(doc.querySelectorAll("p")[2].querySelector("a").getAttribute("href"), "/about/terms-of-use");
});

test("数据不动：accession、DOI、物种、机构、文件名、论文标题、URL 一律原样", () => {
  const doc = run(
    "<table><tr>" +
      "<td>S-BSST3573</td><td>E-MTAB-17034</td><td>S-BIAD4068</td>" +
      "<td>10.6019/S-BSST3573</td><td>10.1136/gutjnl-2026-340224</td>" +
      "<td>Homo sapiens (human)</td><td>TaxID:9606</td>" +
      "<td>MGH - Massachusetts General Hospital</td>" +
      "<td>Supplementary_Table_3_SomasSCAN7K_Revision_1.xlsx</td>" +
      "<td>The circulating proteomic signature of alcohol-associated liver disease</td>" +
      "<td>https://doi.org/10.1136/gutjnl-2026-340224</td>" +
      "</tr></table>" +
      '<a href="https://www.ebi.ac.uk/biostudies/studies/S-BSST3573">S-BSST3573</a>'
  );
  const tds = [...doc.querySelectorAll("td")].map(text);
  assert.deepEqual(tds, [
    "S-BSST3573",
    "E-MTAB-17034",
    "S-BIAD4068",
    "10.6019/S-BSST3573",
    "10.1136/gutjnl-2026-340224",
    "Homo sapiens (human)",
    "TaxID:9606",
    "MGH - Massachusetts General Hospital",
    "Supplementary_Table_3_SomasSCAN7K_Revision_1.xlsx",
    "The circulating proteomic signature of alcohol-associated liver disease",
    "https://doi.org/10.1136/gutjnl-2026-340224"
  ]);
  assert.equal(
    doc.querySelector("a").getAttribute("href"),
    "https://www.ebi.ac.uk/biostudies/studies/S-BSST3573",
    "链接地址不能改"
  );
});

test("词库不越界：论文题、集合专名、物种、accession 不作为键", () => {
  const banned = [
    "Nature",
    "Homo sapiens",
    "S-BSST3573",
    "E-MTAB-17034",
    "ArrayExpress",
    "BioImages",
    "BioModels",
    "EMBL-EBI",
    "BioStudies",
    "CC0"
  ];
  for (const k of banned) assert.equal(book.exact[k], undefined, "不该收数据串: " + k);
  for (const v of Object.values(book.exact)) {
    assert.ok(!/https?:\/\//.test(v), "译文里不能有明文 URL: " + v);
    assert.ok(!/\S+@\S+\.\S+/.test(v) || /\{\{/.test(v), "译文里不能有明文邮箱: " + v);
  }
});
