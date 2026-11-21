// seq2：NCBI 序列页(/nuccore /protein)与数据集基因组页(/datasets/genome)剩余界面骨架词库
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const engineSrc = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(engineSrc + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/seq2.json"), "utf8"));
const sitesFile = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8"));
const defaults = sitesFile.defaults;

const CJK = /[\u4e00-\u9fff]/;
const BAD = /(\/mnt\/|\/home\/|\/Users\/[^/\s]+|C:\\\\Users\\\\|[\w.+-]+@[\w-]+\.[\w.]+)/i;

function boot(html, siteId, url) {
  const site = sitesFile.sites.find((s) => s.id === siteId);
  const dom = new JSDOM(html, { url });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: dict.exact, rules: dict.rules || [], templates: dict.templates || [] },
    site: {
      scope: site.scope,
      block: defaults.block,
      attrs: defaults.attrs,
      proseExempt: site.proseExempt
    }
  });
  engine.start();
  return { dom, doc: dom.window.document };
}

const ASSEMBLY = "https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_000005845.2/";
const NUCCORE = "https://www.ncbi.nlm.nih.gov/nuccore/NM_000546.6";

/* ---------------- 结构体检 ---------------- */

test("词库可解析，meta 与条目基本形状正确", () => {
  assert.equal(dict.meta.family, "seq2");
  assert.deepEqual(dict.meta.sites, ["www.ncbi.nlm.nih.gov"]);
  assert.ok(Object.keys(dict.exact).length >= 30);
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.ok(k.trim() === k && k.length > 0, "key 首尾不许有空白: " + JSON.stringify(k));
    assert.ok(!CJK.test(k), "key 不许含中文: " + k);
    assert.ok(typeof v === "string" && v.trim() === v && v.length > 0, "value 非法: " + k);
    assert.ok(CJK.test(v), "value 必须是中文: " + k + " => " + v);
    assert.ok(!BAD.test(v), "value 不许含本机路径/邮箱: " + k);
  }
  assert.equal(dict.templates.length, 1);
});

test("规则：正则可编译、锚定、不含中文，且捕获组齐全", () => {
  for (const r of dict.rules) {
    assert.ok(r.re.startsWith("^") && r.re.endsWith("$"), "规则必须锚定: " + r.re);
    assert.ok(!CJK.test(r.re), "规则不许含中文: " + r.re);
    assert.doesNotThrow(() => new RegExp(r.re), "规则无法编译: " + r.re);
    assert.ok(typeof r.to === "string" && CJK.test(r.to), "规则译文必须是中文: " + r.re);
  }
});

test("模板：pat 无中文、zh 有中文、占位符 1..N 一一对应", () => {
  for (const t of dict.templates) {
    assert.ok(!CJK.test(t.pat), "模板 pat 含中文");
    assert.ok(CJK.test(t.zh), "模板 zh 不含中文");
    assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, "模板 pat 长度越界");
    const nums = (s) => (s.match(/\{\{(\d+)\}\}/g) || []).map((x) => Number(x.replace(/\D/g, "")));
    assert.deepEqual(nums(t.pat).sort(), nums(t.zh).sort());
  }
});

/* ---------------- 行为：数据集基因组页 ---------------- */

test("组装总表：组装水平枚举 Complete Genome 翻成完整基因组", () => {
  const { dom, doc } = boot("<table><tr><td>Assembly level</td><td>Complete Genome</td></tr></table>", "ncbi-assembly", ASSEMBLY);
  const tds = [...doc.querySelectorAll("td")].map((td) => td.textContent);
  assert.equal(tds[1], "完整基因组");
  dom.window.close();
});

test("样本详情与 BioSample 字段标签", () => {
  const { dom, doc } = boot(
    "<h2>Sample details</h2>" +
      "<dl><dt>BioSample ID</dt><dd>SAMN02604091</dd>" +
      "<dt>Substrain</dt><dd>K-12 substr. MG1655</dd>" +
      "<dt>Sample name</dt><dd>Escherichia coli</dd></dl>",
    "ncbi-assembly",
    ASSEMBLY
  );
  assert.equal(doc.querySelector("h2").textContent, "样本详情");
  const dts = [...doc.querySelectorAll("dt")].map((d) => d.textContent);
  assert.deepEqual(dts, ["BioSample 编号", "亚株", "样本名称"]);
  assert.equal(doc.querySelector("dd").textContent, "SAMN02604091", "编号值不许动");
  dom.window.close();
});

test("分类学检查 + ANI 匹配表标签", () => {
  const { dom, doc } = boot(
    "<h3>Taxonomy check</h3>" +
      "<dl><dt>Taxonomy check status</dt><dd>Confirmed</dd>" +
      "<dt>Best match status</dt><dd>species_match</dd>" +
      "<dt>Submitted organism name</dt><dd>Escherichia coli</dd>" +
      "<dt>Submitted species name</dt><dd>Escherichia coli</dd></dl>" +
      "<h4>Average Nucleotide Identity (ANI) match details</h4>" +
      "<table><tr><th>Best match type-strain for submitted organism</th><th>Best match type-strain</th></tr>" +
      "<tr><td>Type assembly</td><td>GCA_000210475.1</td></tr>" +
      "<tr><td>Organism name</td><td>Escherichia coli ETEC H10407</td></tr>" +
      "<tr><td>Type category</td><td>claderef</td></tr>" +
      "<tr><td>Assembly coverage</td><td>Type assembly coverage</td></tr></table>",
    "ncbi-assembly",
    ASSEMBLY
  );
  assert.equal(doc.querySelector("h3").textContent, "分类学检查");
  const dts = [...doc.querySelectorAll("dt")].map((d) => d.textContent);
  assert.deepEqual(dts, ["分类学检查状态", "最佳匹配状态", "提交的生物体名称", "提交的物种名称"]);
  assert.equal(doc.querySelectorAll("dd")[1].textContent, "species_match", "机器枚举值不许动");
  assert.equal(doc.querySelector("h4").textContent, "平均核苷酸一致性（ANI）匹配详情");
  const ths = [...doc.querySelectorAll("th")].map((x) => x.textContent);
  assert.deepEqual(ths, ["提交生物体的最佳匹配模式菌株", "最佳匹配模式菌株"]);
  const tds = [...doc.querySelectorAll("td")].map((x) => x.textContent);
  assert.deepEqual(tds, ["模式菌株组装", "GCA_000210475.1", "生物体名称", "Escherichia coli ETEC H10407", "模式类别", "claderef", "组装覆盖度", "模式菌株组装覆盖度"]);
  dom.window.close();
});

test("注释详情：查看注释链接、提交者规则、EGAP 流程名", () => {
  const { dom, doc } = boot(
    "<table><tr><td>NCBI Eukaryotic Genome Annotation Pipeline (EGAP)</td></tr></table>" +
      "<a href='/a'>View RefSeq annotation</a><a href='/b'>View GenBank annotation</a>" +
      "<p>Annotation submitted by NCBI RefSeq</p><p>Annotation submitted by Univ. Wisconsin</p>" +
      "<h3>Sequences added to RefSeq</h3>",
    "ncbi-assembly",
    ASSEMBLY
  );
  assert.equal(doc.querySelector("td").textContent, "NCBI 真核基因组注释流程（EGAP）");
  const as = [...doc.querySelectorAll("a")].map((a) => a.textContent);
  assert.deepEqual(as, ["查看 RefSeq 注释", "查看 GenBank 注释"]);
  const ps = [...doc.querySelectorAll("p")].map((p) => p.textContent);
  assert.deepEqual(ps, ["注释由 NCBI RefSeq 提交", "注释由 Univ. Wisconsin 提交"]);
  assert.equal(doc.querySelector("h3").textContent, "添加到 RefSeq 的序列");
  dom.window.close();
});

test("质量分析：CheckM 标题、完整度/污染度、百分位、PubMed 全部链接", () => {
  const { dom, doc } = boot(
    "<h3>CheckM analysis (v1.2.4)</h3>" +
      "<table><tr><th>Completeness</th><td>89th</td></tr></table>" +
      "<p>Completeness:</p><p>Contamination:</p><p>Percentile</p>" +
      "<a href='/p'>View all 319 in PubMed</a>",
    "ncbi-assembly",
    ASSEMBLY
  );
  assert.equal(doc.querySelector("h3").textContent, "CheckM 分析（v1.2.4）");
  assert.equal(doc.querySelector("th").textContent, "完整度");
  const ps = [...doc.querySelectorAll("p")].map((p) => p.textContent);
  assert.deepEqual(ps, ["完整度：", "污染度：", "百分位"]);
  assert.equal(doc.querySelector("a").textContent, "在 PubMed 中查看全部 319 篇");
  dom.window.close();
});

test("病原体检测资源三个入口与 BRC 分析按钮", () => {
  const { dom, doc } = boot(
    "<h2>Pathogen Detection Resource</h2><ul><li>Isolate Browser</li><li>SNP Tree Viewer</li></ul>" +
      "<p>Genotypes identified by AMRFinderPlus</p><a href='/x'>Analyze in BRC Analytics</a>",
    "ncbi-assembly",
    ASSEMBLY
  );
  assert.equal(doc.querySelector("h2").textContent, "病原体检测资源");
  const lis = [...doc.querySelectorAll("li")].map((x) => x.textContent);
  assert.deepEqual(lis, ["分离株浏览器", "SNP 树查看器"]);
  assert.equal(doc.querySelector("p").textContent, "由 AMRFinderPlus 鉴定的基因型");
  assert.equal(doc.querySelector("a").textContent, "在 BRC Analytics 中分析");
  dom.window.close();
});

/* ---------------- 行为：序列页 ---------------- */

test("GenBank 视图锚点 tooltip（title 属性通道）翻成中文", () => {
  const { dom, doc } = boot(
    "<nav>" +
      '<a href=' + '"#a1"' + ' title="Jump to the comment section of this record">Comments</a>' +
      '<a href=' + '"#a2"' + ' title="Jump to the feature table of this record">Features</a>' +
      '<a href=' + '"#a3"' + ' title="Jump to the sequence of this record">Sequence</a>' +
      '<a href=' + '"#a4"' + ' title="Jump to the feature">feature</a>' +
      '<a href=' + '"#a5"' + ' title="Jump to NM_000546.6">NM_000546.6</a>' +
      "</nav>",
    "ncbi-nuccore",
    NUCCORE
  );
  const titles = [...doc.querySelectorAll("a")].map((a) => a.getAttribute("title"));
  assert.deepEqual(titles, [
    "跳转到此记录的评论部分",
    "跳转到此记录的特征表",
    "跳转到此记录的序列",
    "跳转到特征",
    "跳转到 NM_000546.6"
  ]);
  dom.window.close();
});

test("规则只对整段命中，半句英文不动", () => {
  const { dom, doc } = boot(
    "<p>View all 319 in PubMed</p>" +
      "<p>Annotation submitted by NCBI RefSeq</p>" +
      "<p>Added chromosome MT</p>" +
      "<p>You can View all 319 in PubMed next</p>",
    "ncbi-assembly",
    ASSEMBLY
  );
  const ps = [...doc.querySelectorAll("p")].map((p) => p.textContent);
  assert.equal(ps[0], "在 PubMed 中查看全部 319 篇");
  assert.equal(ps[1], "注释由 NCBI RefSeq 提交");
  assert.equal(ps[2], "新增染色体 MT");
  assert.equal(ps[3], "You can View all 319 in PubMed next", "非整段命中不许改");
  dom.window.close();
});

test("CheckM 说明句按模板翻，内联链接保留", () => {
  const { dom, doc } = boot(
    "<p>Calculated on the Prokaryotic Genome Annotation Pipeline (PGAP) gene set with the Escherichia coli CheckM marker set. " +
      "For more information on CheckM, see " +
      '<a href="https://doi.org/x">Parks, et al. Genome Res (2015)</a>.</p>',
    "ncbi-assembly",
    ASSEMBLY
  );
  const p = doc.querySelector("p");
  assert.match(p.textContent, /^根据原核基因组注释流程（PGAP）基因集与该物种的 CheckM 标记基因集计算。/);
  assert.ok(p.textContent.indexOf("参见 Parks, et al. Genome Res (2015)。") > 0);
  assert.equal(p.querySelectorAll("a").length, 1, "链接必须还在");
  assert.equal(p.querySelector("a").getAttribute("href"), "https://doi.org/x");
  dom.window.close();
});

test("编号、物种名、机器枚举值一律保持原样", () => {
  const { dom, doc } = boot(
    "<dl><dt>BioSample ID</dt><dd>SAMN02604091</dd>" +
      "<dt>Substrain</dt><dd>K-12 substr. MG1655</dd></dl>" +
      "<table><tr><td>GCF_000005845.2</td><td>Escherichia coli str. K-12 substr. MG1655</td><td>species_match</td></tr></table>",
    "ncbi-assembly",
    ASSEMBLY
  );
  const dds = [...doc.querySelectorAll("dd")].map((d) => d.textContent);
  assert.deepEqual(dds, ["SAMN02604091", "K-12 substr. MG1655"]);
  const tds = [...doc.querySelectorAll("td")].map((d) => d.textContent);
  assert.deepEqual(tds, ["GCF_000005845.2", "Escherichia coli str. K-12 substr. MG1655", "species_match"]);
  dom.window.close();
});
test("CheckM 标题被拆成多个文本节点时括号仍配对", () => {
  const { dom, doc } = boot("<h3>CheckM analysis (<span>v1.2.4</span>)</h3>", "ncbi-assembly", ASSEMBLY);
  const txt = doc.querySelector("h3").textContent;
  dom.window.close();
  assert.equal(txt, "CheckM 分析（v1.2.4）");
});
