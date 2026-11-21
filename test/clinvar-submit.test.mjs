// ClinVar 提交 / 高级检索 / 工具页（dict/clinvar-submit.json）落地校验
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/clinvar-submit.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "ncbi-clinvar");
const texts = (doc, sel) => [...doc.querySelectorAll(sel)].map((e) => e.textContent.replace(/\s+/g, " ").trim());

function boot(html) {
  const dom = new JSDOM(html);
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: dict.exact, rules: dict.rules },
    site
  });
  engine.start();
  return dom.window.document;
}

test("提交门户：手风琴标题整条翻译", () => {
  const doc = boot(
    [
      "<h2>Log in or create an account</h2>",
      "<h2>Register your organization</h2>",
      "<h2>Determine if your organization is registered already</h2>",
      "<h2>Update an existing organization or personnel</h2>",
      "<h2>Authorize more than one submitter from your organization</h2>",
      "<h2>Submit on behalf of a different organization</h2>",
      "<h2>Get a cumulative report of your released records</h2>"
    ].join("")
  );
  assert.deepEqual(texts(doc, "h2"), [
    "登录或创建账户",
    "注册您的机构",
    "确认您的机构是否已注册",
    "更新已有机构或人员信息",
    "授权本机构的多位提交者",
    "代表其他机构提交",
    "获取已发布记录的累积报告"
  ]);
});

test("提交门户：步骤句按规则翻，按钮名保持英文", () => {
  const doc = boot(
    [
      "<div>1. Click the \"Log in\" button</div>",
      "<div>2. Complete the required fields on the ORGANIZATION INFORMATION tab</div>",
      "<div>Once complete, click \"Continue\".</div>"
    ].join("")
  );
  assert.deepEqual(texts(doc, "div"), [
    "1. 点击“Log in”按钮",
    "2. 在 ORGANIZATION INFORMATION 选项卡中填写必填字段",
    "填写完成后，点击“Continue”。"
  ]);
});

test("提交门户：固定说明句与状态说明", () => {
  const doc = boot(
    [
      "<p>You must accept the terms to register your organization and submit to ClinVar.</p>",
      "<li>Unfinished</li><li>: not yet submitted</li>",
      "<li>Processed</li><li>: submitted and under review by ClinVar staff</li>",
      "<li>Deleted</li><li>: deleted at the submitter’s request or for lack of response</li>",
      "<p>The submitting organization must register in Submission Portal.</p>"
    ].join("")
  );
  assert.equal(
    doc.querySelector("p").textContent,
    "必须先接受这些条款，才能注册机构并向 ClinVar 提交数据。"
  );
  assert.deepEqual(texts(doc, "li"), [
    "未完成",
    "：尚未提交",
    "已处理",
    "：已提交，正在由 ClinVar 工作人员审核",
    "已删除",
    "：应提交者要求或因无响应而删除"
  ]);
  assert.equal(
    doc.querySelectorAll("p")[1].textContent,
    "提交机构必须在提交门户中注册。"
  );
});

test("提交门户：机构术语表与标签", () => {
  const doc = boot(
    [
      "<table><tr><th>Term</th><th>Definition</th><th>Example</th></tr>",
      "<tr><td>Institution</td><td>the larger entity consisting of one or more smaller Organizations</td>",
      "<td>university, hospital, company, government agency</td></tr>",
      "<tr><td>Organization</td><td>a smaller entity within the larger Institution</td>",
      "<td>lab, clinic, department, LSDB</td></tr></table>",
      "<p>Provide your organization and institution name:</p>",
      "<p>ClinVar uses the following terms to represent a submitter’s affiliation:</p>"
    ].join("")
  );
  assert.deepEqual(texts(doc, "th"), ["术语", "定义", "示例"]);
  assert.deepEqual(texts(doc, "td"), [
    "机构",
    "由一个或多个较小组织构成的较大实体",
    "大学、医院、公司、政府机构",
    "Organization",
    "较大机构内部的较小实体",
    "实验室、诊所、科室、LSDB"
  ]);
  assert.deepEqual(texts(doc, "p"), [
    "填写您的组织与机构名称：",
    "ClinVar 用以下术语表示提交者的所属机构："
  ]);
});

test("统计页：表头与日期保留，星标规则回填", () => {
  const doc = boot(
    [
      "<h1>ClinVar submissions</h1>",
      "<table><tr><th>Category of analysis</th><th>Current total (Nov 15, 2026)</th></tr>",
      "<tr><td>Unique variation records with practice guidelines (4 stars)</td></tr>",
      "<tr><td>Unique variation records from expert panels (3 stars)</td></tr>",
      "<tr><td>Total submitters</td></tr>",
      '<tr><td title="Number of unique submitting organizations">3421</td></tr></table>'
    ].join("")
  );
  assert.equal(doc.querySelector("h1").textContent, "ClinVar 提交");
  assert.deepEqual(texts(doc, "th"), ["分析类别", "当前总计（Nov 15, 2026）"]);
  assert.deepEqual(texts(doc, "td"), [
    "带实践指南（4 星）的唯一变异记录",
    "来自专家小组（3 星）的唯一变异记录",
    "提交者总数",
    "3421"
  ]);
  assert.equal(doc.querySelector("td[title]").getAttribute("title"), "唯一提交机构数量");
});

test("下载页：目录说明与格式名保留", () => {
  const doc = boot(
    [
      "<h2>XML files</h2>",
      "<a>FTP directory for XML files</a>",
      "<table><tr><td>Limited to variants with a precise location</td></tr>",
      "<tr><td>Updated weekly; see</td></tr></table>",
      "<a>the README file</a>",
      "<span>VCF</span>",
      "<span>gene_condition_source_id</span>"
    ].join("")
  );
  assert.deepEqual(texts(doc, "h2"), ["XML 文件"]);
  assert.deepEqual(texts(doc, "a"), ["XML 文件的 FTP 目录", "README 文件"]);
  assert.deepEqual(texts(doc, "td"), ["仅限具有精确位置的变异", "每周更新；参见"]);
  // 格式名与字段名是数据/标识符，不动
  assert.deepEqual(texts(doc, "span"), ["VCF", "gene_condition_source_id"]);
});

test("高级检索：构建器文案、字段枚举与条数规则", () => {
  const doc = boot(
    [
      "<h1>ClinVar Advanced Search Builder</h1>",
      "<p>Use the builder below to create your search</p>",
      "<a>Add new line</a>",
      "<a>Previous 200</a>",
      "<a>Next 200</a>",
      "<a>Refresh index</a>",
      "<div>There is no recent history</div>",
      "<select><option>Base Position</option><option>Type of variation</option>",
      "<option>MIM</option><option>AlleleID</option><option>Disease/Phenotype</option></select>",
      '<button title="Run this search">Run</button>',
      '<a title="Comprehensive list of submitters">list</a>'
    ].join("")
  );
  assert.equal(doc.querySelector("h1").textContent, "ClinVar 高级检索构建器");
  assert.equal(doc.querySelector("p").textContent, "用下方的构建器创建您的检索式");
  assert.deepEqual(texts(doc, "a"), ["添加新行", "前 200 条", "后 200 条", "刷新索引", "list"]);
  assert.equal(doc.querySelector("div").textContent, "暂无历史记录");
  // 字段名翻，标识符（MIM/AlleleID）不动
  assert.deepEqual(texts(doc, "option"), ["碱基位置", "变异类型", "MIM", "AlleleID", "疾病/表型"]);
  assert.equal(doc.querySelector("button").getAttribute("title"), "运行此检索");
  assert.equal(
    doc.querySelector("a[title]").getAttribute("title"),
    "提交者完整列表"
  );
});

test("提交数据与标识符一律不动", () => {
  const doc = boot(
    [
      '<a class="sub">Laboratory for Molecular Genetics, University Hospital Bonn</a>',
      "<span>SCV000123456.1</span>",
      "<span>NM_000546.6:c.743G>A</span>",
      "<span>Nov 15, 2026</span>",
      "<span>3,421</span>"
    ].join("")
  );
  assert.equal(
    doc.querySelector("a").textContent,
    "Laboratory for Molecular Genetics, University Hospital Bonn"
  );
  assert.deepEqual(texts(doc, "span"), ["SCV000123456.1", "NM_000546.6:c.743G>A", "Nov 15, 2026", "3,421"]);
});

test("词库本身：无自映射、无非中文值、规则锚定", () => {
  const entries = Object.entries(dict.exact);
  assert.ok(entries.length >= 120, "词条太少: " + entries.length);
  const bad = [];
  for (const [en, zh] of entries) {
    if (en === zh) bad.push("自映射: " + en);
    if (!/[\u3400-\u9fff]/.test(zh)) bad.push("值不含中文: " + en);
    if (en !== en.trim() || zh !== zh.trim()) bad.push("首尾空白: " + en);
    if (/\s{2,}/.test(en)) bad.push("键内有连续空白: " + en);
  }
  assert.deepEqual(bad.slice(0, 10), []);
  const badRules = dict.rules.filter((r) => !/^\^/.test(r.re) || !/\$$/.test(r.re));
  assert.deepEqual(badRules, []);
});
