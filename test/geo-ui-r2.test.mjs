// NCBI GEO 记录页（GDSbrowser 数据集页 + Accession viewer 系列页）界面补译回归：
// 页头页签、下载区、聚类工具表单（检验方法/显著性/倍数/距离/连接方式）、下载 tooltip 与 alt/title 属性。
// 词条一律按真实 DOM 的文本节点边界挂载：页签、图例、表单标签各自是独立节点，
// 「A vs B」「2+ fold」这类也在节点里原样出现，不拼整句。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const engineSrc = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(engineSrc + "; return createEngine;")();
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;

const sites = readJson("../config/sites.json").sites;
const site = sites.find((s) => s.id === "ncbi-geo");

// 与线上一致：ge-extra 与 geo-docs 都在这条栈里，属性通道走站点默认白名单。
function stack() {
  const data = { exact: {}, rules: [], templates: [] };
  for (const dictId of site.dicts) {
    const book = readJson("../dict/" + dictId + ".json");
    Object.assign(data.exact, book.exact || {});
    data.rules = data.rules.concat(book.rules || []);
    data.templates = data.templates.concat(book.templates || []);
  }
  return data;
}

function run(html) {
  const dom = new JSDOM("<body>" + html + "</body>", { url: "https://www.ncbi.nlm.nih.gov/geo/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: stack(),
    site: Object.assign({}, site, { rescan: false })
  });
  engine.start();
  return dom.window.document;
}

const texts = (doc, sel) => [...doc.querySelectorAll(sel)].map((e) => e.textContent);

test("数据集记录页页头：DataSet Record GDS5076: 与三个页签各自成节点，各自翻", () => {
  // 真实页面：<tr class="caption"><th>DataSet Record GDS5076:</th>…<a class="button">Expression Profiles</a>
  const d = run(
    "<table><tr class=\"caption\"><th>DataSet Record GDS5076:</th>" +
      "<th><a class=\"button\" title=\"View Expression Profiles\">Expression Profiles</a></th>" +
      "<th><a class=\"button\" title=\"Data Analysis Tools\">数据分析工具</a></th>" +
      "<th><a class=\"button\" title=\"Sample Subsets\">Sample Subsets</a></th></tr></table>"
  );
  assert.equal(d.querySelector("th").textContent, "数据集记录 GDS5076：");
  assert.deepEqual(texts(d, "a.button").slice(0, 1), ["表达谱"]);
  assert.equal(d.querySelectorAll("a.button")[0].getAttribute("title"), "查看表达谱");
  assert.equal(d.querySelectorAll("a.button")[2].textContent, "样本子集");
  assert.equal(d.querySelectorAll("a.button")[2].getAttribute("title"), "样本子集");
});

test("数据集记录页下载区：图例与文件条目（既有译文不回归）", () => {
  const d = run(
    "<fieldset><legend>Cluster Analysis</legend></fieldset>" +
      "<fieldset><legend>Download</legend><ul>" +
      "<li><a class=\"dataset-soft-full\">DataSet full SOFT file</a></li>" +
      "<li><a class=\"dataset-soft\">DataSet SOFT file</a></li>" +
      "<li><a class=\"series-family-soft\">Series family SOFT file</a></li>" +
      "<li><a class=\"annotation-soft\">Annotation SOFT file</a></li></ul></fieldset>"
  );
  assert.deepEqual(texts(d, "legend"), ["聚类分析", "下载"]);
  const links = texts(d, "li a");
  for (const zh of links) assert.ok(CJK.test(zh), "下载条目应已中文：" + zh);
});

test("聚类工具：检验方法与显著性（下拉选项与标签都翻，value 不动）", () => {
  const d = run(
    "<div class=\"azline\"><b>Step 1:</b> Select test and significance level</div>" +
      "<select name=\"testKindAB\" id=\"testKindAB\">" +
      "<option value=\"0\">Two-tailed t-test (A vs B)</option>" +
      "<option value=\"1\">One-tailed t-test (A &gt; B)</option>" +
      "<option value=\"2\">One-tailed t-test (A &lt; B)</option>" +
      "<option value=\"3\">Value means difference</option>" +
      "<option value=\"4\">Rank means difference</option></select>" +
      "<span id=\"signifLabel0\">Significance level:</span>" +
      "<select id=\"signifAB_rv\"><option>2+ fold</option><option>3+ fold</option><option>8+ fold</option></select>" +
      "<select name=\"sideAB\"><option>higher</option><option>lower</option><option>either</option></select>"
  );
  assert.equal(d.querySelector(".azline").textContent, "第 1 步选择检验方法与显著性水平");
  assert.deepEqual(texts(d, "#testKindAB option"), [
    "双尾 t 检验（A 与 B）",
    "单尾 t 检验（A > B）",
    "单尾 t 检验（A < B）",
    "数值均值差异",
    "秩均值差异"
  ]);
  // value 是服务器分支依据，引擎从不改它
  assert.deepEqual([...d.querySelectorAll("#testKindAB option")].map((o) => o.value), ["0", "1", "2", "3", "4"]);
  assert.equal(d.querySelector("#signifLabel0").textContent, "显著性水平：");
  assert.deepEqual(texts(d, "#signifAB_rv option"), ["2 倍以上", "3 倍以上", "8 倍以上"]);
  assert.deepEqual(texts(d, "select[name=sideAB] option"), ["更高", "更低", "任一"]);
});

test("聚类工具：距离与连接方式，Single 不能落成库布局的「单端」", () => {
  const d = run(
    "<table><tr><td>Distance:</td><td><select name=\"dist\">" +
      "<option>Uncentered Correlation</option><option>Pearson Correlation</option><option>Euclidean</option></select></td></tr>" +
      "<tr><td>Linkage:</td><td><select id=\"clustopt\" name=\"method\">" +
      "<option>Average/UPGMA</option><option>Single</option><option>Complete</option></select></td></tr></table>" +
      "<a id=\"gdslnk2\">Hierarchical</a>" +
      "<a id=\"gdslnk3\">Partitional (K-means/K-medians)</a>" +
      "<a id=\"gdslnk4\">By location on chromosome</a>"
  );
  const tds = texts(d, "td").filter((t) => t.endsWith("：") || t.endsWith(":"));
  assert.deepEqual(tds.slice(0, 2), ["距离度量：", "连接方式："]);
  assert.deepEqual(texts(d, "select[name=dist] option"), ["非中心化相关", "皮尔逊相关", "欧氏距离"]);
  assert.deepEqual(texts(d, "#clustopt option"), ["平均连接（UPGMA）", "单连接", "完全连接"]);
  assert.ok(!texts(d, "#clustopt option").includes("单端"), "聚类连接方式不能写成单端");
  assert.deepEqual(texts(d, "a[id^=gdslnk]"), ["层次聚类", "划分聚类（K-means/K-medians）", "按染色体位置"]);
});

test("Single 只在连接方式语境是单连接；SRA 的 single/paired 仍是单端/双端", () => {
  const d = run("<h3>Library Layout</h3><a>paired</a><a>single</a><select><option>Single</option></select>");
  assert.deepEqual(texts(d, "a"), ["双端", "单端"]);
  assert.equal(d.querySelector("option").textContent, "单连接");
});

test("记录页属性通道：alt / title 全覆盖（页脚图标、下载条目、工具提示）", () => {
  const d = run(
    "<img alt=\"National Center for Biotechnology Information (NCBI)\">" +
      "<img alt=\"GEO DataSet Browser\">" +
      "<a class=\"button\" title=\"Sample Subsets\">样本子集</a>" +
      "<a title=\"GDS5076 Cluster Analysis\">聚类分析</a>" +
      "<img alt=\"GDS5076 Cluster Image\">" +
      "<a title=\"Contains DataSet information, experiment variable subsets and expression value measurements (plain text, tab-delimited format).\">x</a>" +
      "<a title=\"Contains the complete, original, submitter-supplied records that form the basis of this DataSet (XML format).\">x</a>" +
      "<a title=\"Link to PubMed record\">PubMed</a>" +
      "<li title=\"Find specific gene(s) within this DataSet. Search by gene name, symbol or differential expression flags.\">y</li>" +
      "<img title=\"Boxplots and value distributions\" alt=\"Boxplots and value distributions\">"
  );
  const imgs = [...d.querySelectorAll("img")];
  assert.equal(imgs[0].alt, "美国国家生物技术信息中心（NCBI）");
  assert.equal(imgs[1].alt, "GEO 数据集浏览器");
  assert.equal(imgs[2].alt, "GDS5076 聚类图像");
  assert.equal(imgs[3].getAttribute("title"), "箱线图与数值分布");
  assert.equal(imgs[3].alt, "箱线图与数值分布");
  const anchors = [...d.querySelectorAll("a[title]")];
  assert.equal(anchors[0].getAttribute("title"), "样本子集");
  assert.equal(anchors[1].getAttribute("title"), "GDS5076 聚类分析");
  assert.equal(anchors[2].getAttribute("title"),
    "包含数据集信息、实验变量子集与表达值测量结果（纯文本，制表符分隔格式）。");
  assert.equal(anchors[3].getAttribute("title"),
    "包含构成该数据集基础的完整原始提交记录（XML 格式）。");
  assert.equal(anchors[4].getAttribute("title"), "链接到 PubMed 记录");
  assert.equal(d.querySelector("li").getAttribute("title"),
    "在此数据集中查找特定基因。可按基因名称、符号或差异表达标记检索。");
});

test("最近活动浮层的 Accession: GDS5076 也按规则翻（登录号保持原样）", () => {
  const d = run("<div class=\"brieflinkpopdesc\">Accession: GDS5076</div>");
  assert.equal(d.querySelector(".brieflinkpopdesc").textContent, "登录号：GDS5076");
});

test("数据与标识符一律不翻：数据集标题、引文、平台名、分组字母", () => {
  const d = run(
    "<td>PIAS1 SUMO ligase depletion effect on breast cancer cell line</td>" +
      "<span class=\"authors\">Liu B, Tahk S, Yee KM, Yang R et al.</span>" +
      "<span class=\"source\">PLoS One</span>" +
      "<td>: [HG-U133A_2] Affymetrix Human Genome U133A 2.0 Array</td>" +
      "<td>protocol</td><span>A</span><span>vs</span><span>B</span>"
  );
  const all = d.body.textContent;
  for (const keep of [
    "PIAS1 SUMO ligase depletion effect on breast cancer cell line",
    "Liu B, Tahk S, Yee KM, Yang R et al.",
    "PLoS One",
    ": [HG-U133A_2] Affymetrix Human Genome U133A 2.0 Array",
    "protocol"
  ]) {
    assert.ok(all.includes(keep), "不该被翻：" + keep);
  }
  const plainSpans = [...d.querySelectorAll("span")].filter((s) => !s.className).map((s) => s.textContent);
  assert.deepEqual(plainSpans, ["A", "vs", "B"]);
});

test("锚定的单词规则不咬正文：Complete sequence / Hierarchical clustering 保持英文", () => {
  const d = run("<p>Complete sequence of BRCA1</p><p>Hierarchical clustering of samples</p>");
  assert.deepEqual(texts(d, "p"), ["Complete sequence of BRCA1", "Hierarchical clustering of samples"]);
});

test("样本页：字段名、数据表说明与行数提示（存取号原样保留）", () => {
  const d = run(
    "<a class=\"acc\">Sample GSM1076965</a>" +
      "<table><tr><td>Extracted molecule</td><td>total RNA</td></tr></table>" +
      "<strong>Data table header descriptions</strong>" +
      "<table><tr><td>ABS_CALL</td>" +
      "<td>indicating whether the transcript was present (P), absent (A), or marginal (M)</td></tr></table>" +
      "<strong>Data table</strong>" +
      "<div>Total number of rows:</div>" +
      "<div>Table truncated, full table size</div>"
  );
  assert.equal(d.querySelector("a.acc").textContent, "样本 GSM1076965");
  assert.equal(d.querySelectorAll("td")[0].textContent, "提取分子");
  assert.equal(d.querySelectorAll("td")[1].textContent, "total RNA");
  assert.deepEqual(texts(d, "strong"), ["数据表表头说明", "数据表"]);
  assert.equal(d.querySelectorAll("td")[2].textContent, "ABS_CALL");
  assert.equal(d.querySelectorAll("td")[3].textContent,
    "表示该转录本为存在（P）、缺失（A）或边缘（M）");
  assert.equal(d.querySelectorAll("div")[0].textContent, "总行数：");
  assert.equal(d.querySelectorAll("div")[1].textContent, "表格已截断，完整表格大小为");
});
