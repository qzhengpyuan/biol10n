// Rfam 词库（rfam）回归：首页 / 家族页 / 检索 / 下载 / 404 与 docs.rfam.org 侧栏说明
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/rfam.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "rfam") || {
  id: "rfam",
  hosts: ["rfam.org", "docs.rfam.org"],
  dicts: ["common", "rfam"],
  scope: "body"
};
const stack = site.dicts && site.dicts.includes("rfam") ? site.dicts : ["common", "rfam"];
const data = { exact: {}, rules: [], templates: [] };
for (const name of stack) {
  const d = JSON.parse(fs.readFileSync(path.join(root, "../dict", name + ".json"), "utf8"));
  Object.assign(data.exact, d.exact || {});
  data.rules.push(...(d.rules || []));
  data.templates.push(...(d.templates || []));
}

function run(html) {
  const dom = new JSDOM(html);
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return dom.window.document;
}
const text = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");

test("词库结构：条数、键值形态、规则可编译、模板槽位连续", () => {
  assert.equal(book.meta.family, "rfam");
  assert.ok(book.meta.sites.includes("rfam.org"));
  assert.ok(book.meta.sites.includes("docs.rfam.org"));
  assert.ok(Object.keys(book.exact).length >= 280, "exact 至少 280 条");
  assert.ok(book.rules.length >= 25, "rules 至少 25 条");
  assert.ok(book.templates.length >= 25, "templates 至少 25 条");

  const seen = new Set();
  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "键里不能有中文: " + k);
    assert.ok(/[\u4e00-\u9fff]/.test(v), "译文里必须有中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "键首尾不能有空白: " + JSON.stringify(k));
    assert.equal(v, v.trim(), "译文首尾不能有空白: " + JSON.stringify(k));
    assert.ok(!seen.has(k), "重复键: " + k);
    seen.add(k);
  }
  for (const r of book.rules) {
    assert.ok(new RegExp(r.re).source.length > 0, "规则要能编译: " + r.re);
    assert.ok(/[\u4e00-\u9fff]/.test(r.to), "规则译文里必须有中文: " + r.re);
  }
  for (const t of book.templates) {
    const used = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.ok(used.length >= 1, "模板要带槽位: " + t.pat);
    const sorted = used.slice().sort((a, b) => a - b);
    sorted.forEach((n, i) => assert.equal(n, i + 1, "槽位必须从 1 连续: " + t.pat));
    const zhUsed = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.deepEqual(zhUsed.slice().sort((a, b) => a - b), sorted, "译文槽位要与原文一致: " + t.pat);
  }
});

test("首页：版本行按规则翻成中文日期与家族数", () => {
  const doc = run("<h1>Rfam 15.1 (January 2026, 4227 families)</h1>");
  assert.equal(text(doc.querySelector("h1")), "Rfam 15.1（2026 年 1 月，4227 个家族）");
});

test("首页：区块标题、卡片说明与培训空状态", () => {
  const doc = run(
    "<h2>Browse Rfam</h2>" +
      "<p>RNA families by type, name, or accession</p>" +
      "<p>The Rfam database is a collection of RNA families, each represented by multiple sequence alignments, consensus secondary structures and covariance models</p>" +
      "<h2>Getting Started</h2><p>Find guides, tutorials, and references to help you get the most out of Rfam.</p>" +
      "<h2>Current Projects</h2><h2>Featured Families</h2><h2>Database Statistics</h2>" +
      "<h3>Training</h3><p>On-demand training</p><p>Live training</p>" +
      "<p>No on-demand training found.</p><p>No live training found.</p>"
  );
  const h2 = [...doc.querySelectorAll("h2")].map((e) => e.textContent);
  assert.deepEqual(h2, ["浏览 Rfam", "入门指南", "当前项目", "精选家族", "数据库统计"]);
  const ps = [...doc.querySelectorAll("p")].map((e) => e.textContent.trim());
  assert.equal(ps[0], "按类型、名称或登录号浏览 RNA 家族");
  assert.equal(ps[1], "Rfam 数据库收录 RNA 家族，每个家族由多序列比对、共识二级结构和协方差模型表示");
  assert.equal(ps[2], "查找指南、教程与参考资料，充分利用 Rfam。");
  assert.equal(ps[3], "点播培训");
  assert.equal(ps[4], "直播培训");
  assert.equal(ps[5], "未找到点播培训。");
  assert.equal(ps[6], "未找到直播培训。");
  assert.equal(text(doc.querySelector("h3")), "培训");
});

test("家族页：标签页全部翻成中文", () => {
  const tabs = [
    ["Summary", "摘要"],
    ["Sequences", "序列"],
    ["Alignment", "比对"],
    ["Secondary structure", "二级结构"],
    ["Species", "物种"],
    ["Trees", "系统树"],
    ["Structures", "结构"],
    ["Motif matches", "基序匹配"],
    ["Genomic Context", "基因组上下文"],
    ["Cross-references", "交叉引用"],
    ["Curation", "审编"]
  ];
  const doc = run(
    '<ul class="vf-tabs__list">' +
      tabs.map(([en], i) => '<li><a class="vf-tabs__link" href="#tab-' + i + '">' + en + "</a></li>").join("") +
      "</ul>"
  );
  assert.deepEqual([...doc.querySelectorAll("a")].map((a) => a.textContent), tabs.map(([, zh]) => zh));
});

test("家族页：家族簇归属与维基百科注释句，链接不丢", () => {
  const doc = run(
    '<p> This family is a member of clan <strong><a href="/clan/CL00113" class="vf-link">5S_rRNA</a></strong> (<a href="/clan/CL00113" class="vf-link">CL00113</a>), which contains 2 members: </p>' +
      '<p> This family is described by the Wikipedia entry <a class="vf-link" href="https://en.wikipedia.org/wiki/5S_ribosomal_RNA" target="_blank">5S ribosomal RNA</a>. </p>'
  );
  const ps = [...doc.querySelectorAll("p")].map((e) => e.textContent.replace(/\s+/g, " ").trim());
  assert.equal(ps[0], "该家族属于家族簇 5S_rRNA （CL00113），共 2 个成员：");
  assert.equal(ps[1], "该家族由维基百科条目5S ribosomal RNA描述。");
  assert.deepEqual([...doc.querySelectorAll("a")].map((a) => a.getAttribute("href")), [
    "/clan/CL00113",
    "/clan/CL00113",
    "https://en.wikipedia.org/wiki/5S_ribosomal_RNA"
  ]);
  assert.equal(doc.querySelector("strong").textContent, "5S_rRNA", "家族名数据保持原样");
});

test("家族页：序列/种子/全长比对说明句（数字槽位不留英文）", () => {
  const doc = run(
    "<p> This section shows the sequences included in the full alignment for this family. The full alignment contains <strong>594154</strong> sequences from <strong>12253</strong> species. </p>" +
      "<p> The seed alignment for <strong>5S_rRNA</strong> contains <strong>712</strong> sequences. </p>" +
      "<p> The full alignment for <strong>5S_rRNA</strong> contains sequences from <strong>12253</strong> species. </p>"
  );
  const ps = [...doc.querySelectorAll("p")].map((e) => e.textContent.replace(/\s+/g, " ").trim());
  assert.equal(ps[0], "本节显示该家族全长比对收录的序列。全长比对包含来自 12253 个物种的 594154 条序列。");
  assert.equal(ps[1], "5S_rRNA 的种子比对包含 712 条序列。");
  assert.equal(ps[2], "5S_rRNA 的全长比对包含来自 12253 个物种的序列。");
});

test("家族页：建树方法、PDB 结构映射、策展提交说明句", () => {
  const doc = run(
    "<p> These trees were generated using either a maximum likelihood approach (Rivas &amp; Eddy, 2008) for families with \u2264 64 sequences, or neighbour-joining with F84 distances (<a class=\"vf-link\" href=\"https://phylipweb.github.io/phylip/\" target=\"_blank\">PHYLIP</a>) for larger families. </p>" +
      "<p> For sequences which have a structure in the <a class=\"vf-link\" href=\"https://www.wwpdb.org/\" target=\"_blank\">Protein Data Bank</a>, we generate a mapping between EMBL, PDB and Rfam coordinate systems. The table below shows structures on which the <strong>5S_rRNA</strong> family has been found. </p>" +
      "<p> This section shows the detailed information about the Rfam family. We're happy to receive updated or improved alignments for new or existing families. <a class=\"vf-link\" href=\"/submit-alignment?accession=RF00001&amp;prefill=1\">Submit</a> your new alignment and we'll take a look. </p>"
  );
  const ps = [...doc.querySelectorAll("p")].map((e) => e.textContent.replace(/\s+/g, " ").trim());
  assert.equal(
    ps[0],
    "这些树由以下方法生成：序列数 ≤ 64 的家族使用最大似然法（Rivas & Eddy, 2008），更大的家族使用基于 F84 距离的邻接法（PHYLIP）。"
  );
  assert.equal(
    ps[1],
    "对于在Protein Data Bank中有结构的序列，我们会建立 EMBL、PDB 与 Rfam 坐标系之间的映射。下表列出已发现 5S_rRNA 家族的结构。"
  );
  assert.equal(
    ps[2],
    "本节显示该 Rfam 家族的详细信息。我们乐于接收针对新家族或现有家族的更新或改进比对。提交您的新比对，我们会查看。"
  );
  assert.equal(doc.querySelector("a").getAttribute("href"), "https://phylipweb.github.io/phylip/", "链接地址不能改");
  assert.equal(doc.querySelectorAll("a")[2].getAttribute("href"), "/submit-alignment?accession=RF00001&prefill=1");
});

test("检索页：检索说明句、示例与结果计数", () => {
  const doc = run(
    '<p> Search Rfam families, clans, motifs, genomes, and sequences by keyword, accession, species, author, or other metadata. See the <a href="/help/text-search">text search documentation</a> for help getting started. </p>' +
      "<p>Examples: <a>SAM riboswitch</a> <a>Homo sapiens</a></p>" +
      '<small id="search-results-count">15 of 182,619</small>' +
      "<p>Showing 15 of 182,619 results</p>"
  );
  const p = doc.querySelector("p");
  assert.equal(
    text(p),
    "可按关键词、登录号、物种、作者或其他元数据检索 Rfam 的家族、家族簇、基序、基因组和序列。入门帮助请参阅文本检索文档。"
  );
  assert.equal(doc.querySelector("a").getAttribute("href"), "/help/text-search");
  const ps = [...doc.querySelectorAll("p")].map((e) => e.textContent.replace(/\s+/g, " ").trim());
  assert.equal(ps[1], "示例： SAM riboswitch Homo sapiens");
  assert.equal(doc.querySelector("#search-results-count").textContent, "15 / 182,619 条");
  assert.equal(ps[2], "显示第 15 条，共 182,619 条结果");
});

test("检索页：结果卡计数带量词、筛选面板标签", () => {
  const doc = run(
    "<ul>" +
      '<li><a href="#tab1">940 seed sequences</a></li>' +
      '<li><a href="#tab2">272 full sequences</a></li>' +
      '<li><a href="#tab3">153 species</a></li>' +
      '<li><span class="rfam-badge">3D</span> <a href="#tab6">3 structures</a></li>' +
      '<li><a href="#tab-publications"><span>11</span> <span>Open Access Publications</span></a></li>' +
      '<li><a href="#tab-references"><span>3</span> <span>cross-references</span></a></li>' +
      "</ul>" +
      '<div class="rfam-facet"><h3>Entry type</h3><label>Family (55)</label><label>Sequence (182,560)</label></div>' +
      '<div class="rfam-facet"><h3>Pseudoknot</h3><label>Yes (22)</label><label>No (33)</label></div>'
  );
  const links = [...doc.querySelectorAll("a")].map((a) => a.textContent.replace(/\s+/g, " ").trim());
  assert.deepEqual(links, [
    "940 条种子序列",
    "272 条全长序列",
    "153 个物种",
    "3 个结构",
    "11 开放获取论文",
    "3 个交叉引用"
  ]);
  const h3 = [...doc.querySelectorAll("h3")].map((e) => e.textContent);
  assert.deepEqual(h3, ["条目类型", "假结"]);
  const labels = [...doc.querySelectorAll("label")].map((e) => e.textContent.replace(/\s+/g, " ").trim());
  assert.deepEqual(labels, ["家族（55）", "序列（182,560）", "是（22）", "否（33）"]);
});

test("检索页：排序下拉 20 项全部中文，方向箭头保留", () => {
  const opts = [
    "Seed sequences ↓", "Seed sequences ↑",
    "Full sequences ↓", "Full sequences ↑",
    "Species ↓", "Species ↑",
    "3D structures ↓", "3D structures ↑",
    "Accession ↓", "Accession ↑",
    "Families in genome ↓", "Families in genome ↑",
    "RNAs in genome ↓", "RNAs in genome ↑",
    "Genome length ↓", "Genome length ↑",
    "Bit score ↓", "Bit score ↑",
    "E-value ↓", "E-value ↑"
  ];
  const doc = run("<select>" + opts.map((o) => "<option>" + o + "</option>").join("") + "</select>");
  const got = [...doc.querySelectorAll("option")].map((o) => o.textContent);
  assert.equal(got.length, 20);
  for (const g of got) assert.ok(/[\u4e00-\u9fff]/.test(g), "排序项没翻: " + g);
  assert.equal(got[0], "种子序列 ↓");
  assert.equal(got[6], "三维结构 ↓");
  assert.equal(got[8], "登录号 ↓");
  assert.equal(got[18], "E 值 ↓");
});

test("下载页：版本行、区块标题、发布历史表头与当前/存档徽标", () => {
  const doc = run(
    "<p>Rfam Downloads • Latest release: 15.1</p>" +
      "<h2>Accessing the server</h2><h2>Current release files</h2><h2>Release history</h2>" +
      "<table><tr><th>Release</th><th>Date</th><th>Families</th><th>Status</th><th>FTP Directory</th></tr>" +
      "<tr><td>15.1</td><td>Jan 2026</td><td>4227</td><td>Current</td><td>CURRENT/</td></tr>" +
      "<tr><td>15.0</td><td>Sep 2024</td><td>4178</td><td>Archive</td><td>15.0/</td></tr></table>" +
      "<p>All Rfam covariance models in a single file, suitable for use with Infernal's <code>cmscan</code> to annotate novel sequences.</p>"
  );
  assert.equal(text(doc.querySelector("p")), "Rfam 下载 • 最新版本：15.1");
  assert.deepEqual([...doc.querySelectorAll("h2")].map((e) => e.textContent), [
    "访问服务器",
    "当前版本文件",
    "发布历史"
  ]);
  assert.deepEqual([...doc.querySelectorAll("th")].map((e) => e.textContent), [
    "版本",
    "日期",
    "家族",
    "状态",
    "FTP 目录"
  ]);
  const tds = [...doc.querySelectorAll("td")].map((e) => e.textContent);
  assert.equal(tds[3], "当前");
  assert.equal(tds[8], "存档");
  assert.equal(tds[4], "CURRENT/", "FTP 目录名是数据");
  const card = [...doc.querySelectorAll("p")].pop();
  assert.equal(card.textContent.replace(/\s+/g, " ").trim(), "全部 Rfam 协方差模型汇于单个文件，可与 Infernal 的 cmscan 配合注释新序列。");
  assert.equal(card.querySelector("code").textContent, "cmscan", "命令名在 code 里保持原样");
});

test("404 页：错误标题、说明句与返回入口", () => {
  const doc = run(
    "<h1>Error 404</h1><h2>Page not found</h2>" +
      "<p>The page you requested could not be found. It may have moved, been removed, or the URL may be incorrect.</p>" +
      '<a href="/">Go to homepage</a><a href="/search">Search Rfam</a>'
  );
  assert.equal(doc.querySelector("h1").textContent, "错误 404");
  assert.equal(doc.querySelector("h2").textContent, "页面未找到");
  assert.equal(doc.querySelector("p").textContent, "您请求的页面不存在。它可能已被移动或删除，或者 URL 有误。");
  assert.deepEqual([...doc.querySelectorAll("a")].map((e) => e.textContent), ["前往首页", "检索 Rfam"]);
});

test("数据不动：登录号、家族名、物种与长段英文正文保持原样", () => {
  const doc = run(
    "<div><h1>RF00001</h1><p>5S_rRNA</p><p>CL00113</p><p>Homo sapiens</p>" +
      "<p>Stockholm (gzip)</p><p>Protein Data Bank</p>" +
      "<p>The 5S ribosomal RNA (5S rRNA) is an approximately 120 nucleotide-long ribosomal RNA molecule with a mass of 40 kDa. It is a structural and functional component of the large subunit of the ribosome in all domains of life.</p></div>"
  );
  const all = doc.body.textContent.replace(/\s+/g, " ");
  for (const keep of ["RF00001", "5S_rRNA", "CL00113", "Homo sapiens", "Stockholm (gzip)", "Protein Data Bank"]) {
    assert.ok(all.includes(keep), "数据被翻了: " + keep);
  }
  const wiki = [...doc.querySelectorAll("p")].pop().textContent;
  assert.ok(wiki.startsWith("The 5S ribosomal RNA (5S rRNA) is an approximately 120 nucleotide-long"), "维基正文不该被翻");
  assert.ok(wiki.includes("in all domains of life."), "正文里不该出现半中半英");
});
