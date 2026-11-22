// UCSC 基因页补充词库（ucsc-hggene）回归：hgGene 分区/UniProt 标签/固定说明句 + hgGeneGraph 互作图
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/ucsc-hggene.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "ucsc");

function run(html) {
  const dom = new JSDOM(html);
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: book.exact, rules: book.rules, templates: book.templates },
    site
  });
  engine.start();
  return dom.window.document;
}

test("词库结构：条数、键值形态、规则可编译、模板槽位连续", () => {
  assert.equal(book.meta.family, "ucsc");
  assert.ok(book.meta.sites.includes("genome.ucsc.edu"));
  assert.ok(Object.keys(book.exact).length >= 50, "exact 至少 50 条");
  assert.ok(book.rules.length >= 6, "rules 至少 6 条");
  assert.ok(Array.isArray(book.templates), "templates 必须是数组");

  const seen = new Set();
  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "键里不能有中文: " + k);
    assert.ok(/[\u4e00-\u9fff]/.test(v), "译文里必须有中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "键首尾不能有空白: " + JSON.stringify(k));
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

test("hgGene 顶部：转录本区间标题与 UniProt 注释标签", () => {
  const doc = run(
    '<div class="section">' +
      "<b>Transcript (Including UTRs)</b>" +
      "<b>DESCRIPTION:</b><b>FUNCTION:</b><b>COFACTOR:</b><b>SUBUNIT:</b><b>INTERACTION:</b>" +
      "<b>TISSUE SPECIFICITY:</b><b>INDUCTION:</b><b>DOMAIN:</b><b>PTM:</b><b>DISEASE:</b>" +
      "<b>SIMILARITY:</b><b>WEB RESOURCE:</b><b>ID:</b><b>more ...</b>" +
      "</div>"
  );
  const bs = [...doc.querySelectorAll("b")].map((e) => e.textContent);
  assert.deepEqual(bs, [
    "转录本（含 UTR）",
    "描述：",
    "功能：",
    "辅因子：",
    "亚基组成：",
    "相互作用：",
    "组织特异性：",
    "诱导：",
    "结构域：",
    "翻译后修饰：",
    "疾病关联：",
    "相似性：",
    "网络资源：",
    "编号：",
    "更多……"
  ]);
});

test("hgGene 分区：PDB 结构标题、CCDS、GeneReviews、GNF 芯片标题", () => {
  const doc = run(
    '<div class="section">' +
      "<b>Protein Data Bank (PDB) 3-D Structure</b>" +
      "<b>CCDS:</b>" +
      "<b>GeneReviews article(s) related to gene</b>" +
      "<h3>GNF Expression Atlas 2 Data from U133A and GNF1H Chips</h3>" +
      "</div>"
  );
  const bs = [...doc.querySelectorAll("b")].map((e) => e.textContent);
  assert.deepEqual(bs, [
    "蛋白质数据库（PDB）三维结构",
    "CCDS 编号：",
    "与该基因相关的 GeneReviews 条目"
  ]);
  assert.equal(doc.querySelector("h3").textContent, "来自 U133A 与 GNF1H 芯片的 GNF Expression Atlas 2 数据");
});

test("hgGene 固定说明句：引物设计与 RNAfold 折叠说明", () => {
  const doc = run(
    "<div>" +
      "<p>Primer3Plus can design qPCR Primers that straddle exon-exon-junctions, which amplify only cDNA, not genomic DNA.</p>" +
      "<p>Exonprimer can design one pair of Sanger sequencing primers around every exon, located in non-genic sequence.</p>" +
      "<p>To design primers for a non-coding sequence, zoom to a region of interest and select from the drop-down menu: View &gt; In External Tools &gt; Primer3</p>" +
      "<table><tr><td>The RNAfold program from <a href=\"http://rna.tbi.univie.ac.at/\">Vienna RNA Package</a> is used to perform the secondary structure predictions and folding calculations. The estimated folding energy is in kcal/mol. The more negative the energy, the more secondary structure the RNA is likely to have.</td></tr></table>" +
      "</div>"
  );
  const ps = [...doc.querySelectorAll("p")].map((e) => e.textContent);
  assert.equal(ps[0], "Primer3Plus 可设计跨越外显子-外显子连接处的 qPCR 引物，只扩增 cDNA，不扩增基因组 DNA。");
  assert.equal(ps[1], "Exonprimer 可为每个外显子设计一对 Sanger 测序引物，引物位于非基因序列中。");
  assert.equal(
    ps[2],
    "为非编码序列设计引物时，请缩放到感兴趣的区域，再从下拉菜单中选择：View > In External Tools > Primer3"
  );
  const td = doc.querySelector("td");
  assert.equal(
    td.textContent,
    "RNAfold 程序由 Vienna RNA Package 提供，用于进行二级结构预测与折叠计算。估计的折叠自由能以 kcal/mol 计；能量越负，RNA 越可能形成二级结构。"
  );
  assert.equal(doc.querySelector("a").getAttribute("href"), "http://rna.tbi.univie.ac.at/", "链接地址不能改");
});

test("hgGene 表格枚举与结构方法：Picture/Text/Ratios/Absolute/- X-ray/- NMR", () => {
  const doc = run(
    "<div>" +
      "<a>Picture</a><a>Text</a>" +
      "<table>" +
      "<tr><td>Ratios</td><td>Absolute</td></tr>" +
      '<tr><td><a href="http://www.rcsb.org/structure/1A1U">1A1U</a> - NMR <a href="#">MuPIT</a></td></tr>' +
      '<tr><td><a href="http://www.rcsb.org/structure/1AIE">1AIE</a> - X-ray <a href="#">MuPIT</a></td></tr>' +
      "</table>" +
      "</div>"
  );
  const as = [...doc.querySelectorAll("a")].map((e) => e.textContent);
  assert.deepEqual(as.slice(0, 2), ["图片", "文本"]);
  const tds = [...doc.querySelectorAll("td")].map((e) => e.textContent);
  assert.equal(tds[0], "比值");
  assert.equal(tds[1], "绝对值");
  assert.equal(tds[2].trim().replace(/\s+/g, " "), "1A1U - 核磁共振 MuPIT");
  assert.equal(tds[3].trim().replace(/\s+/g, " "), "1AIE - X 射线 MuPIT");
  assert.deepEqual(as.slice(2), ["1A1U", "MuPIT", "1AIE", "MuPIT"], "PDB 编号与工具名保持原样");
});

test("hgGeneGraph 轨道标题与说明句", () => {
  const doc = run(
    '<div class="container-fluid">' +
      '<span class="gbTrackName">Gene Interactions Track</span>' +
      '<span class="gbTrackTitle">Gene interactions and pathways from curated databases and text-mining</span>' +
      "</div>" +
      '<div class="info">Data information</div>' +
      '<div class="help">Please see the <a href="hgGeneGraphHelp">Gene Interactions Track Manual</a>.</div>'
  );
  assert.equal(doc.querySelector(".gbTrackName").textContent, "基因互作轨道");
  assert.equal(
    doc.querySelector(".gbTrackTitle").textContent,
    "来自人工策展数据库与文本挖掘的基因互作与通路"
  );
  assert.equal(doc.querySelector(".info").textContent, "数据信息");
  const help = doc.querySelector(".help");
  assert.equal(help.textContent, "更多信息请参阅基因互作轨道手册。");
  assert.equal(help.querySelector("a").getAttribute("href"), "hgGeneGraphHelp", "模板替换不能丢链接");
});

test("hgGeneGraph 标题规则：top N 互作基因 / 低频互作 / 文本挖掘计数", () => {
  const doc = run(
    "<div>" +
      '<div class="banner"><a href="hgGene?gene=TP53">TP53</a>: top 25 interacting genes (<a href="hgTracks">chr17:7668420-7687490</a>)</div>' +
      '<div class="low">Less-frequently mentioned interactions with TP53, not among the Top 25</div>' +
      "<li>Text-mining: 1,234 abstracts e.g.</li>" +
      "</div>"
  );
  assert.equal(
    doc.querySelector(".banner").textContent,
    "TP53：前 25 个互作基因 (chr17:7668420-7687490)"
  );
  assert.equal(
    doc.querySelector(".low").textContent,
    "与 TP53 互作、提及频次较低的基因（不在前 25 名之列）"
  );
  assert.equal(doc.querySelector("li").textContent, "文本挖掘：1,234 篇摘要，例如");
});

test("hgGeneGraph 过滤控件：下拉选项、隐藏非本基因互作、显示前 N 个基因", () => {
  const doc = run(
    '<form name="filterForm">' +
      '<select name="supportLevel">' +
      "<option>Show all interactions, even only text-mining support</option>" +
      "<option>Show only interactions with some database support</option>" +
      "<option>Show only interactions with pathway database support</option>" +
      "</select>" +
      '<span style="font-weight:bold">Hide non-TP53 interactions</span>' +
      '<b>Show top <input name="geneCount" type="text" size="3" value="25"> Genes on graph</b>' +
      "</form>"
  );
  const opts = [...doc.querySelectorAll("option")].map((e) => e.textContent);
  assert.deepEqual(opts, [
    "显示全部互作，包括仅有文本挖掘支持的",
    "仅显示有数据库支持的互作",
    "仅显示有通路数据库支持的互作"
  ]);
  assert.equal(doc.querySelector("span").textContent, "隐藏非 TP53 互作");
  const b = doc.querySelector("b");
  const bTexts = [...b.childNodes].filter((n) => n.nodeType === 3).map((n) => n.nodeValue.trim());
  assert.deepEqual(bTexts, ["显示前", "个基因"], "输入框两侧的文字各自翻好，value 不动");
  assert.equal(b.querySelector("input").getAttribute("value"), "25");
  assert.equal(doc.querySelector("input").getAttribute("name"), "geneCount", "name 不能改");
});

test("hgGeneGraph 图例、注释菜单、按钮与 tooltip", () => {
  const doc = run(
    '<div class="legend">' +
      'Like above, interactions are colored by support. Grey:only text mining, light-blue:interaction database, blue:pathway database' +
      "</div>" +
      '<div class="annotate">' +
      '<button title="Annotate genes using external databases">Annotate Genes</button>' +
      "<a>No Annotation</a><a>GNF2 Expression</a><a>Pan-Cancer Mutations</a>" +
      '<button title="Export the graph to various file formats">Export</button>' +
      '<a title="Open help page">?</a>' +
      '<a title="Link to Gene Details page">details</a>' +
      '<a title="link to Genome Browser">browser</a>' +
      "</div>" +
      '<div class="low">Other genes interacting with TP53. Mouse-over to show number of abstracts or databases. Sorted alphabetically (<a>sort by article count</a>).</div>' +
      "<small>Click link to show details</small>" +
      "<li>No curated information</li>"
  );
  assert.equal(
    doc.querySelector(".legend").textContent,
    "如上所述，互作按支持度着色。灰色：仅有文本挖掘支持；浅蓝色：互作数据库支持；蓝色：通路数据库支持"
  );
  const buttons = [...doc.querySelectorAll("button")];
  assert.equal(buttons[0].getAttribute("title"), "使用外部数据库注释基因");
  assert.equal(buttons[1].getAttribute("title"), "将图导出为多种文件格式");
  const links = [...doc.querySelectorAll("a")];
  assert.equal(links[0].textContent, "无注释");
  assert.equal(links[1].textContent, "GNF2 表达");
  assert.equal(links[2].textContent, "泛癌突变");
  assert.equal(links[3].getAttribute("title"), "打开帮助页面");
  assert.equal(links[4].getAttribute("title"), "链接到基因详情页面");
  assert.equal(links[5].getAttribute("title"), "链接到基因组浏览器");
  assert.equal(
    doc.querySelector(".low").textContent,
    "与 TP53 互作的其他基因。将鼠标悬停可显示摘要数或数据库数。按字母顺序排列 (按文章数排序)."
  );
  assert.equal(doc.querySelector("small").textContent, "点击链接查看详情");
  assert.equal(doc.querySelector("li").textContent, "无人工策展信息");
});

test("hgGeneGraph 顶部操作说明整段：规则 + 帮助链接 + 尾句", () => {
  const doc = run(
    '<div class="intro">' +
      "Mouse over or click genes or lines for details. Dashed lines indicate interactions without text mining support. " +
      "Click any gene to make it the new center. Click any line to show details about the interaction. " +
      "Only TP53-interacting genes and only the most-mentioned/most-curated interactions are shown in the graph. " +
      'See the <a href="hgGeneGraphHelp">Help Page</a> for details.' +
      "</div>"
  );
  assert.equal(
    doc.querySelector(".intro").textContent,
    "将鼠标悬停在基因或连线上可查看详情。虚线表示没有文本挖掘支持的互作。点击任一基因可把它设为新的中心。" +
      "点击任一连线可查看该互作的详情。图中只显示与 TP53 互作、且被提及或策展最多的基因。更多信息请参阅 Help Page 了解详情。"
  );
  // 句中的 <a> 后面紧跟小写英文（"for details."），引擎按"处在句子中间"处理，保持链接原文不翻，
  // 只翻同一段里能独立成句/成标签的文本节点；与真实 hgGeneGraph 页面的效果一致。
  const a = doc.querySelector(".intro a");
  assert.equal(a.textContent, "Help Page");
  assert.equal(a.getAttribute("href"), "hgGeneGraphHelp", "链接地址不能改");
});

test("数据不动：基因名、坐标、登录号、PDB 编号、疾病名", () => {
  const doc = run(
    '<table class="data"><tr>' +
      "<td>TP53</td><td>BRCA1</td><td>chr17:7,668,421-7,687,490</td>" +
      "<td>ENST00000269305.9</td><td>NM_000546.6</td><td>P04637</td>" +
      "<td>CCDS11118.1</td><td>1TUP</td><td>Homo sapiens</td>" +
      "<td>li-fraumeni syndrome</td><td>breast cancer</td>" +
      "</tr></table>"
  );
  const tds = [...doc.querySelectorAll("td")].map((e) => e.textContent);
  assert.deepEqual(tds, [
    "TP53",
    "BRCA1",
    "chr17:7,668,421-7,687,490",
    "ENST00000269305.9",
    "NM_000546.6",
    "P04637",
    "CCDS11118.1",
    "1TUP",
    "Homo sapiens",
    "li-fraumeni syndrome",
    "breast cancer"
  ]);
});