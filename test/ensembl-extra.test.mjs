// Ensembl 补充词库（ensembl-extra）回归：帮助文档左栏、API 文档、VEP 工具页、FTP 下载表头
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const extra = JSON.parse(fs.readFileSync(path.join(root, "../dict/ensembl-extra.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "ensembl");

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

test("词库条目：数量、键值规整、不与主词库重复", () => {
  const entries = Object.entries(extra.exact || {});
  assert.ok(entries.length >= 120, "条目太少: " + entries.length);
  const bad = [];
  for (const [en, zh] of entries) {
    if (!en || en !== en.trim()) bad.push("键首尾空白: " + JSON.stringify(en));
    if (/[\u3400-\u4dbf\u4e00-\u9fff]/.test(en)) bad.push("键含中文: " + en);
    if (!zh || zh !== zh.trim()) bad.push("空译文: " + en);
    if (en === zh) bad.push("自映射: " + en);
  }
  assert.deepEqual(bad, []);

  const main = JSON.parse(fs.readFileSync(path.join(root, "../dict/ensembl.json"), "utf8"));
  const common = JSON.parse(fs.readFileSync(path.join(root, "../dict/common.json"), "utf8"));
  const dup = entries
    .map(([en]) => en)
    .filter((en) => en in main.exact || en in common.exact);
  assert.deepEqual(dup, [], "与 ensembl/common 重复的键");
});

test("帮助文档左栏：API 与网页代码导航整条翻译", () => {
  const doc = run(
    '<div id="left"><ul>' +
      "<li><b>API Installation</b></li>" +
      "<li><b>API Installation - Git</b></li>" +
      "<li><b>Code versioning scheme</b></li>" +
      "<li><b>Variation database and API</b></li>" +
      "<li><b>Regulation Database and API</b></li>" +
      "<li><b>General instructions for the Perl API</b></li>" +
      "<li><b>Schema Documentation</b></li>" +
      "<li><b>Compara API Tutorial</b></li>" +
      "<li><b>Basic customisation</b></li>" +
      "<li><b>Web code development</b></li>" +
      "<li><b>Variant Simulator</b></li>" +
      "<li><b>VCF to PED Converter</b></li>" +
      "</ul></div>"
  );
  const got = [...doc.querySelectorAll("li b")].map((e) => e.textContent);
  assert.deepEqual(got, [
    "API 安装",
    "API 安装 - Git",
    "代码版本管理方案",
    "变异数据库与 API",
    "调控数据库与 API",
    "Perl API 通用说明",
    "数据库模式文档",
    "Compara API 教程",
    "基本定制",
    "网页代码开发",
    "变异模拟器",
    "VCF 转 PED 转换器"
  ]);
});

test("API 文档页：小节标题与表格说明", () => {
  const doc = run(
    '<div class="subheader">On this page</div>' +
      "<h2>Core</h2>" +
      "<p>Ensembl's API is written in Perl:</p>" +
      "<dt>DNA-sequence level</dt>" +
      "<li>Whole genome alignments</li>" +
      "<li>Synteny regions</li>" +
      "<li>Conservation scores / constrained elements</li>" +
      '<a title="Core API overview diagram">Core API overview diagram</a>'
  );
  assert.equal(doc.querySelector(".subheader").textContent, "本页内容");
  assert.equal(doc.querySelector("p").textContent, "Ensembl 的 API 用 Perl 编写：");
  assert.deepEqual(
    [...doc.querySelectorAll("dt,li")].map((e) => e.textContent),
    ["DNA 序列层级", "全基因组比对", "共线性区域", "保守性评分 / 受约束元件"]
  );
  assert.equal(doc.querySelector("a").getAttribute("title"), "核心 API 总览图");
});

test("VEP 工具页：表头、按钮与固定说明句", () => {
  const doc = run(
    "<table><thead><tr>" +
      '<th title="Online tool">Online tool</th>' +
      "<th>Upload limit</th>" +
      "<th>Download script</th>" +
      "</tr></thead><tbody>" +
      "<tr><td>Maximun 1000 variants recommended</td>" +
      "<td>Convert Ensembl files for use with other analysis tools</td>" +
      "<td>Get a subset of data from a BAM or VCF file.</td></tr></tbody></table>" +
      '<a href="#">Linkage Disequilibrium Calculator</a>' +
      '<a href="#">Clone from GitHub</a>' +
      '<a href="#">Pull Docker image from DockerHub</a>' +
      '<li>More options and flexibility</li>'
  );
  assert.deepEqual(
    [...doc.querySelectorAll("th")].map((e) => e.textContent),
    ["在线工具", "上传限制", "下载脚本"]
  );
  assert.deepEqual(
    [...doc.querySelectorAll("td")].map((e) => e.textContent),
    [
      "建议最多 1000 个变异",
      "转换 Ensembl 文件以供其他分析工具使用",
      "从 BAM 或 VCF 文件中获取数据子集。"
    ]
  );
  assert.deepEqual(
    [...doc.querySelectorAll("a,li")].map((e) => e.textContent),
    ["连锁不平衡计算器", "从 GitHub 克隆", "从 DockerHub 拉取 Docker 镜像", "更多选项与灵活性"]
  );
});

test("FTP 下载页：表格列头与格式说明", () => {
  const doc = run(
    "<table><thead><tr>" +
      '<th title="DNA (FASTA)">DNA (FASTA)</th>' +
      "<th>cDNA (FASTA)</th>" +
      "<th>CDS (FASTA)</th>" +
      "<th>ncRNA (FASTA)</th>" +
      "<th>Gene sets</th>" +
      "<th>Other annotations</th>" +
      "<th>Whole databases</th>" +
      "<th>Variation (Ensembl VEP)</th>" +
      "<th>Data files</th>" +
      "</tr></thead>" +
      "<tbody><tr><td>FASTA</td><td>GTF</td><td>VCF</td><td>BAM/BigWig</td></tr></tbody></table>" +
      "<h2>Database dumps</h2>" +
      "<dt>Peptides</dt>" +
      "<dt>Tarball</dt>" +
      "<li>Stable ids</li>"
  );
  assert.deepEqual(
    [...doc.querySelectorAll("th")].map((e) => e.textContent),
    [
      "DNA（FASTA）",
      "cDNA（FASTA）",
      "CDS（FASTA）",
      "ncRNA（FASTA）",
      "基因集",
      "其他注释",
      "完整数据库",
      "变异（Ensembl VEP）",
      "数据文件"
    ]
  );
  assert.equal(doc.querySelector("th").getAttribute("title"), "DNA（FASTA）");
  // 文件格式名保持英文，不能翻
  assert.deepEqual(
    [...doc.querySelectorAll("td")].map((e) => e.textContent),
    ["FASTA", "GTF", "VCF", "BAM/BigWig"]
  );
  assert.deepEqual(
    [...doc.querySelectorAll("dt,li")].map((e) => e.textContent),
    ["肽", "压缩包", "稳定 ID"]
  );
});

test("带版本号的标题走规则，编号与物种名不动", () => {
  const doc = run(
    "<h1>Ensembl Website Installation Instructions - Version 116</h1>" +
      "<h2>What's new in release 116?</h2>" +
      "<p>Homo sapiens</p>" +
      "<p>ENSG00000141510.21</p>" +
      "<p>GRCh38.p14</p>" +
      "<a>BioMart</a>"
  );
  assert.equal(doc.querySelector("h1").textContent, "Ensembl 网站安装说明 - 版本 116");
  assert.equal(doc.querySelector("h2").textContent, "版本 116 有什么新内容？");
  assert.deepEqual(
    [...doc.querySelectorAll("p,a")].map((e) => e.textContent),
    ["Homo sapiens", "ENSG00000141510.21", "GRCh38.p14", "BioMart"]
  );
});
