// NCBI GEO / GDS / SRA 补充词库：界面骨架、检索面板、详情页区块、帮助页固定说明
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const geo = JSON.parse(fs.readFileSync(path.join(root, "../dict/geo-extra.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "ncbi-geo");

function run(html) {
  const dom = new JSDOM("<main id='maincontent'>" + html + "</main>");
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: geo.exact, rules: geo.rules },
    site
  });
  engine.start();
  return dom.window.document;
}

test("SRA 检索面板：分组标题与固定的库布局/策略枚举翻成中文", () => {
  const d = run(
    "<h3>Access</h3><h3>Library Layout</h3><h3>Strategy</h3><h3>Data in Cloud</h3><h3>File Type</h3>" +
      "<a>paired</a><a>single</a><a>EpiGenomics</a><a>Exome</a><a>RNASeq</a><a>aligned data</a>"
  );
  const texts = [...d.querySelectorAll("h3,a")].map((e) => e.textContent);
  assert.deepEqual(texts, [
    "访问权限", "文库布局", "测序策略", "云端数据", "文件类型",
    "双端", "单端", "表观基因组学", "外显子组", "RNA 测序", "比对数据"
  ]);
});

test("SRA 结果区旁的固定提示句与下拉选项翻成中文", () => {
  const d = run(
    "<h3>Results by taxon</h3><h3>Top Bioprojects</h3><h3>Search in related databases</h3>" +
      "<select><option>RunInfo</option><option>Accession List</option><option>Full XML</option></select>" +
      "<p>No items found.</p>"
  );
  assert.equal(d.querySelector("h3").textContent, "按分类群统计结果");
  assert.deepEqual([...d.querySelectorAll("h3")].map((e) => e.textContent), [
    "按分类群统计结果", "主要 BioProject", "在相关数据库中检索"
  ]);
  assert.deepEqual([...d.querySelectorAll("option")].map((e) => e.textContent), ["运行信息", "登录号列表", "完整 XML"]);
  assert.equal(d.querySelector("p").textContent, "未找到条目。");
});

test("SRA 页顶提示句：链接两侧的固定片段各自翻成中文", () => {
  const d = run(
    "<p>Read our recent <a>NCBI Insights blog</a> for more details.</p>" +
      "<a>Controlled</a>"
  );
  assert.equal(d.querySelector("p").textContent, "阅读我们近期的 NCBI Insights 博客了解更多详情。");
  assert.equal(d.querySelectorAll("a")[1].textContent, "受控访问");
});

test("GEO 高级检索构建器：字段名、按钮与检索历史操作", () => {
  const d = run(
    "<h3>Builder</h3><label>Select Operation</label><label>Field Value</label>" +
      "<a>Add new line</a><a>Remove line</a><a>Show index list</a>" +
      "<a>Previous 200</a><a>Next 200</a><a>Refresh index</a>" +
      "<a>Download history</a><a>Clear history</a><a>Add to builder</a>" +
      "<table><caption>Recent queries</caption><tr><th>Items found</th></tr></table>" +
      "<select><option>DataSet Type</option><option>Number of Samples</option><option>Sample Source</option>" +
      "<option>Submitter Institute</option><option>Update Date</option></select>"
  );
  assert.deepEqual([...d.querySelectorAll("h3,label,a")].map((e) => e.textContent), [
    "构建器", "选择运算符", "字段值",
    "添加新行", "删除该行", "显示索引列表",
    "前 200 条", "后 200 条", "刷新索引",
    "下载检索历史", "清除检索历史", "添加到构建器"
  ]);
  assert.equal(d.querySelector("caption").textContent, "最近检索");
  assert.equal(d.querySelector("th").textContent, "命中条目数");
  assert.deepEqual([...d.querySelectorAll("option")].map((e) => e.textContent), [
    "数据集类型", "样本数", "样本来源", "提交机构", "更新日期"
  ]);
});

test("数据集详情页区块标题与字段标签翻成中文", () => {
  const d = run(
    "<h2>Contributors</h2><table><tr><td>Technology type</td><td>Distribution</td></tr>" +
      "<tr><td>Sample name</td><td>Library strategy</td><td>Instrument model</td></tr>" +
      "<tr><td>Extract protocol</td><td>Label protocol</td><td>Consent</td><td>Platform title</td></tr></table>"
  );
  assert.equal(d.querySelector("h2").textContent, "贡献者");
  assert.deepEqual([...d.querySelectorAll("td")].map((e) => e.textContent), [
    "技术类型", "分布", "样本名称", "文库策略", "仪器型号", "提取方案", "标记方案", "知情同意", "平台标题"
  ]);
});

test("帮助页目录项与固定的记录说明句翻成中文", () => {
  const d = run(
    "<h1>GEO Overview</h1><h2>Data organization</h2><h2>Query and Analysis</h2>" +
      "<a>Example Series record »</a><a>Download GEO data</a>" +
      "<h3>Platform records are supplied by submitters</h3>" +
      "<h3>Profiles are derived from DataSets</h3>" +
      "<b>Text description of the overall experiment</b>"
  );
  assert.deepEqual([...d.querySelectorAll("h1,h2,h3,a,b")].map((e) => e.textContent), [
    "GEO 概览", "数据组织", "查询与分析",
    "系列记录示例 »", "下载 GEO 数据",
    "平台记录由提交者提供",
    "表达谱由数据集衍生",
    "整个实验的文本描述"
  ]);
});

test("提交指南页的固定小标题翻成中文", () => {
  const d = run(
    "<h1>Submitting high-throughput sequence data to GEO</h1><h2>Submission instructions</h2>" +
      "<h2>Data file compression</h2><h2>Organizing your submission</h2>" +
      "<a>Download metadata spreadsheet</a><a>Submit to GEO</a><a>GEO FTP server</a>" +
      "<h3>MD5 Checksums</h3><h3>Data multiplexing</h3>"
  );
  assert.deepEqual([...d.querySelectorAll("h1,h2,h3,a")].map((e) => e.textContent), [
    "向 GEO 提交高通量序列数据", "提交说明",
    "数据文件压缩", "组织提交内容",
    "下载元数据表格", "提交至 GEO", "GEO FTP 服务器",
    "MD5 校验和", "数据多重化"
  ]);
});

test("规则：平台编号标题与查询链接回填登录号", () => {
  const d = run("<a>Platform GPL24676</a><a>Query DataSets for GPL24676</a>");
  assert.equal(d.querySelectorAll("a")[0].textContent, "平台 GPL24676");
  assert.equal(d.querySelectorAll("a")[1].textContent, "查询 GPL24676 的数据集");
});

test("规则：Last modified 与 SRA run 摘要句回填数字，不改内容", () => {
  const d = run(
    "<div>Last modified: July 8, 2026</div>" +
      "<p>1 ILLUMINA (Illumina NovaSeq 6000) run: 23.3M spots, 7G bases, 2Gb downloads</p>"
  );
  assert.equal(d.querySelector("div").textContent, "最后修改：July 8, 2026");
  assert.equal(
    d.querySelector("p").textContent,
    "1 次 ILLUMINA（Illumina NovaSeq 6000）运行：23.3M spot、7G 碱基、2Gb 下载"
  );
});

test("规则：SRA 未命中提示句回填检索词", () => {
  const d = run("<p>The following term was not found in SRA: GSE331160.</p>");
  assert.equal(d.querySelector("p").textContent, "在 SRA 中未找到以下检索词：GSE331160。");
});

test("数据行保持英文：登录号、物种名、样本名、研究标题都不动", () => {
  const d = run(
    "<dd>GSE331160</dd><dd>GSM9740574</dd><a>Homo sapiens</a>" +
      "<table><tr><td>Control MDA-MB-231 cell line Replicate 1</td></tr></table>" +
      "<p class='title'>A non-canonical CXCR4–RPL35A interaction governs translational control to drive TNBC metastasis</p>"
  );
  assert.deepEqual([...d.querySelectorAll("dd,a,td")].map((e) => e.textContent), [
    "GSE331160", "GSM9740574", "Homo sapiens", "Control MDA-MB-231 cell line Replicate 1"
  ]);
  assert.equal(
    d.querySelector("p.title").textContent,
    "A non-canonical CXCR4–RPL35A interaction governs translational control to drive TNBC metastasis"
  );
});

test("检索框 title 属性同样翻成中文", () => {
  const d = run("<input type='text' title='Search SRA'>");
  assert.equal(d.querySelector("input").getAttribute("title"), "检索 SRA");
});