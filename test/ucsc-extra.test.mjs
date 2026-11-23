// UCSC 补充词库（ucsc-extra）回归：工具栏提示、轨道图例按钮、hgGene 分区、hgTables 表单
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const extra = JSON.parse(fs.readFileSync(path.join(root, "../dict/ucsc-extra.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "ucsc");

function run(html) {
  const dom = new JSDOM(html);
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: extra.exact, rules: extra.rules },
    site
  });
  engine.start();
  return dom.window.document;
}

test("hgTracks 顶部工具栏 title 提示整条翻译", () => {
  const doc = run(
    '<div class="toolbar">' +
      '<input type="submit" name="hgt.left3" value="&lt;&lt;&lt;" title="Move 95% to the left">' +
      '<input type="submit" name="hgt.right3" value="&gt;&gt;&gt;" title="Move 47.5% to the right">' +
      '<a href="#" title="Show only default tracks">default</a>' +
      '<a href="#" title="Get a link to this view to share with others">link</a>' +
      '<a href="#" title="Show a table of all chromsomes in this assembly (or scaffolds/contigs) and their sizes.">chrom</a>' +
      "</div>"
  );
  const inputs = [...doc.querySelectorAll("input")];
  assert.equal(inputs[0].getAttribute("title"), "向左移动 95%");
  assert.equal(inputs[1].getAttribute("title"), "向右移动 47.5%");
  assert.equal(inputs[0].getAttribute("value"), "<<<", "提交值不能改");
  const links = [...doc.querySelectorAll("a")];
  assert.equal(links[0].getAttribute("title"), "仅显示默认轨道");
  assert.equal(links[1].getAttribute("title"), "获取此视图的链接以便分享给他人");
  assert.equal(
    links[2].getAttribute("title"),
    "显示该组装体中全部染色体（或 scaffold/contig）及其大小的表格。"
  );
});

test("hgTracks 轨道图例提示：配置/排序/密度规则", () => {
  const doc = run(
    '<div class="trackControls">' +
      '<a title="GENCODE V50 click or right click to configure... drag to reorder">GENCODE</a>' +
      '<a title="dbSNP 155 click or right click to configure... drag to reorder highlighted subtracks">dbSNP</a>' +
      '<a title="MANE Select Plus Clinical: Representative transcript from RefSeq &amp; GENCODE drag to reorder">MANE</a>' +
      '<area title="Click to alter the display density of GENCODE V50">' +
      '<area title="Includes annotations on GRCh38.p14 patch sequences">' +
      '<span title="lifted from hg19">lift</span>' +
      "</div>"
  );
  const as = [...doc.querySelectorAll("a")];
  assert.equal(as[0].getAttribute("title"), "GENCODE V50：点击或右键单击可配置，拖动可重新排序");
  assert.equal(
    as[1].getAttribute("title"),
    "dbSNP 155：点击或右键单击可配置，拖动可重新排序高亮的子轨道"
  );
  assert.equal(
    as[2].getAttribute("title"),
    "MANE Select Plus Clinical: Representative transcript from RefSeq & GENCODE：拖动可重新排序"
  );
  const areas = [...doc.querySelectorAll("area")];
  assert.equal(areas[0].getAttribute("title"), "点击可更改 GENCODE V50 的显示密度");
  assert.equal(areas[1].getAttribute("title"), "包含 GRCh38.p14 补丁序列上的注释");
  assert.equal(doc.querySelector("span").getAttribute("title"), "从 hg19 迁移而来");
});

test("容器轨道标题：container/subreacks 数量后缀翻成中文且名称命中词库", () => {
  const doc = run(
    '<div class="trackControls">' +
      '<a title="ClinVar Variants - container, 3 subtracks">ClinVar</a>' +
      '<a title="Assembly identifiers, clones, and markers - container, 4 tracks">asm</a>' +
      "</div>"
  );
  const as = [...doc.querySelectorAll("a")];
  assert.equal(as[0].getAttribute("title"), "ClinVar 变异 - 容器，3 个子轨道");
  assert.equal(as[1].getAttribute("title"), "Assembly identifiers, clones, and markers - 容器，4 条轨道");
});

test("hgTracks 图例按钮文字与分组控件", () => {
  const doc = run(
    '<div class="legend">' +
      "<span>Configure track</span><span>Hide track</span>" +
      "<button>Collapse all track groups</button><button>Expand all track groups</button>" +
      "<button>Hide all tracks in this group</button>" +
      '<input type="button" value="Add custom tracks" title="Add your own custom tracks - keyboard shortcut: c, then t">' +
      '<input type="submit" value="Collapse all" title="Collapse all track groups">' +
      "</div>"
  );
  const spans = [...doc.querySelectorAll("span")].map((e) => e.textContent);
  assert.deepEqual(spans, ["配置轨道", "隐藏轨道"]);
  const buttons = [...doc.querySelectorAll("button")].map((e) => e.textContent);
  assert.deepEqual(buttons, ["折叠全部轨道分组", "展开全部轨道分组", "隐藏此分组中的全部轨道"]);
  const inputs = [...doc.querySelectorAll("input")];
  // r38 起 ucsc 的 attrs 加了 value：按钮/提交值走属性通道（提交参数仍由引擎排除，只改可见文案）
  assert.equal(inputs[0].getAttribute("value"), "添加自定义轨道");
  assert.equal(inputs[0].getAttribute("title"), "添加你自己的自定义轨道 - 快捷键：c，然后 t");
  // type=submit 的 value 是提交内容（服务器按它分支），引擎按设计不动，只翻 type=button 的可见文案
  assert.equal(inputs[1].getAttribute("value"), "Collapse all", "submit 提交值保持英文");
  assert.equal(inputs[1].getAttribute("title"), "折叠全部轨道分组");
});

test("hgTracks 展示模式与滚动提示", () => {
  const doc = run(
    '<div class="trackTitles">' +
      '<a title="Base Position click or right click to configure... drag to reorder">Base Position</a>' +
      '<span title="click &amp; drag to scroll; shift+click &amp; drag to zoom">x</span>' +
      '<span title="drag select or click to zoom">y</span>' +
      '<span>Base Position</span><span>Pseudogenes</span><span>GC Percent</span>' +
      "</div>"
  );
  const spans = [...doc.querySelectorAll("span")];
  assert.equal(doc.querySelector("a").getAttribute("title"), "碱基位置：点击或右键单击可配置，拖动可重新排序");
  assert.equal(spans[0].getAttribute("title"), "单击并拖动可滚动；Shift + 单击并拖动可缩放");
  assert.equal(spans[1].getAttribute("title"), "拖动选择或单击以缩放");
  assert.deepEqual(spans.slice(2).map((e) => e.textContent), ["碱基位置", "假基因", "GC 含量"]);
});

test("hgGene 页分区标签与提示句", () => {
  const doc = run(
    '<div class="section">' +
      "<b>Gencode Transcript:</b><b>Total Exon Count:</b><b>Coding Exon Count:</b>" +
      "<b>Coding Region</b><b>SEQUENCE CAUTION:</b><b>Cellular Component:</b>" +
      "<b>Alternate Gene Symbols:</b><b>RefSeq Accession:</b>" +
      "<a>Gene Details</a><a>Protein Sequence</a>" +
      "<b>InterPro Domains:</b><b>Pfam Domains:</b>" +
      "<span>Diseases sorted by gene-association score:</span>" +
      "<span>Highest median expression:</span><span>View at GTEx portal</span>" +
      "<span>Click here to load the transcript sequence and exon structure into Primer3Plus</span>" +
      "</div>"
  );
  const bs = [...doc.querySelectorAll("b")].map((e) => e.textContent);
  assert.deepEqual(bs, [
    "GENCODE 转录本：",
    "外显子总数：",
    "编码外显子数：",
    "编码区",
    "序列提示：",
    "细胞组分：",
    "替代基因符号：",
    "RefSeq 登录号：",
    "InterPro 结构域：",
    "Pfam 结构域："
  ]);
  const as = [...doc.querySelectorAll("a")].map((e) => e.textContent);
  assert.deepEqual(as, ["基因详情", "蛋白质序列"]);
  const spans = [...doc.querySelectorAll("span")].map((e) => e.textContent);
  assert.deepEqual(spans, [
    "按基因关联评分排序的疾病：",
    "最高中位表达：",
    "在 GTEx 门户中查看",
    "点击此处把转录本序列与外显子结构载入 Primer3Plus"
  ]);
});

test("hgTables 表头标签、tooltip 与说明句", () => {
  const doc = run(
    '<form class="tableBrowser">' +
      "<b>Select dataset</b><b>Define region of interest</b>" +
      "<b>Retrieve and display data</b><b>Output field separator:</b><b>File type returned:</b>" +
      '<span class="tbTooltiptext">Specify the genome, track and data table to be used as the data source.</span>' +
      '<span class="tbTooltiptext">Specify output options and press the \'get output\' button.</span>' +
      "<li>Specifies which clade the organism is in.</li>" +
      "<li>Displays statistics about the data specified by the parameters.</li>" +
      '<input placeholder="Search any species, genome or assembly name">' +
      '<a aria-label="Send output to Galaxy">galaxy</a>' +
      "</form>"
  );
  const bs = [...doc.querySelectorAll("b")].map((e) => e.textContent);
  assert.deepEqual(bs, ["选择数据集", "定义感兴趣区域", "检索并显示数据", "输出字段分隔符：", "返回的文件类型："]);
  const tips = [...doc.querySelectorAll("span.tbTooltiptext")].map((e) => e.textContent);
  assert.deepEqual(tips, [
    "指定用作数据来源的基因组、轨道与数据表。",
    "指定输出选项并按「get output」按钮。"
  ]);
  const lis = [...doc.querySelectorAll("li")].map((e) => e.textContent);
  assert.deepEqual(lis, ["指定该生物所属的分支。", "显示由参数指定的数据的统计信息。"]);
  assert.equal(doc.querySelector("input").getAttribute("placeholder"), "检索任意物种、基因组或组装名称");
  assert.equal(doc.querySelector("a").getAttribute("aria-label"), "把输出发送到 Galaxy");
});

test("hgGateway 说明句与首页视频标题", () => {
  const doc = run(
    '<div class="gateway">' +
      "<p>For a detailed set of statistics about this assembly, see the</p>" +
      "<p>For more information about the files included in the GRCh38 GenBank submission, see the</p>" +
      '<iframe title="UCSC Genome Browser Basics Part 1"></iframe>' +
      '<iframe title="Saving and Sharing Sessions in the Genome Browser"></iframe>' +
      "</div>"
  );
  const ps = [...doc.querySelectorAll("p")].map((e) => e.textContent);
  assert.equal(ps[0], "有关该组装体的详细统计信息，请参阅");
  assert.equal(ps[1], "有关 GRCh38 GenBank 提交中所含文件的更多信息，请参阅");
  const iframes = [...doc.querySelectorAll("iframe")].map((e) => e.getAttribute("title"));
  assert.deepEqual(iframes, ["UCSC 基因组浏览器基础 第 1 部分", "在基因组浏览器中保存与共享会话"]);
});

test("数据不动：基因名、坐标、登录号、物种名、轨道版本号", () => {
  const doc = run(
    '<table class="data"><tr>' +
      "<td>WDR91</td><td>chr17:7,668,402-7,687,550</td><td>NM_000546.6</td>" +
      "<td>Homo sapiens</td><td>GENCODE V50</td><td>uc003vsp.3</td>" +
      "<td>rs587780073</td><td>NP_000537.3</td>" +
      "</tr></table>"
  );
  const tds = [...doc.querySelectorAll("td")].map((e) => e.textContent);
  assert.deepEqual(tds, [
    "WDR91",
    "chr17:7,668,402-7,687,550",
    "NM_000546.6",
    "Homo sapiens",
    "GENCODE V50",
    "uc003vsp.3",
    "rs587780073",
    "NP_000537.3"
  ]);
});

test("词库无自映射、无重复键，规则均可编译", () => {
  const keys = Object.keys(extra.exact);
  const seen = new Set();
  for (const k of keys) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "键里不能有中文: " + k);
    assert.ok(/[\u4e00-\u9fff]/.test(extra.exact[k]), "译文里必须有中文: " + k);
    assert.notEqual(k, extra.exact[k]);
    assert.ok(!seen.has(k), "重复键: " + k);
    seen.add(k);
  }
  for (const r of extra.rules) assert.doesNotThrow(() => new RegExp(r.re));
});
