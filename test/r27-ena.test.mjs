// ENA Browser（dict/ena.json）r27 补词回归：项目记录页字段名、文本检索结果页的无结果提示与
// 查询语法模板、读段文件下载脚本提示；登录号、物种名、结果标题等数据不动。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, "../dict", f), "utf8"));

const book = read("ena.json");
const common = read("common.json");
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;

// sites.json 里的 ENA 条目由维护者合入时添加；未添加时用同一份配置对象，保证测试自带闭环。
const siteCfg = sites.find((s) => s.id === "ena") || {
  id: "ena",
  name: "ENA Browser",
  hosts: ["www.ebi.ac.uk"],
  path: "^/ena/",
  dicts: ["common", "ena"],
  scope: "body",
  proseExempt: ""
};
const site = Object.assign({}, siteCfg, { spa: false, waitFor: null, rescan: false });

const all = {
  exact: Object.assign({}, common.exact, book.exact),
  rules: [...(common.rules || []), ...book.rules],
  templates: [...(common.templates || []), ...book.templates]
};
const CJK = /[\u4e00-\u9fff]/;

function run(html, url) {
  const dom = new JSDOM(html, {
    url: url || "https://www.ebi.ac.uk/ena/browser/view/PRJEB33227"
  });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: all,
    site
  });
  engine.start();
  return dom.window.document;
}

function text(el) {
  return el ? el.textContent.replace(/\s+/g, " ").trim() : null;
}

const NEW_EXACT = {
  "Study Name:": "研究名称：",
  "ENA-FIRST-PUBLIC:": "ENA 首次公开：",
  "ENA-LAST-UPDATE:": "ENA 最后更新：",
  "No results matching your query were found. If your query string contains non-alphanumeric characters, consider enclosing it in double quotes (\"\").":
    "未找到与您的检索式匹配的结果。如果检索式中含有非字母数字字符，可以尝试用双引号（\"\"）将其括起来。",
  "Get a script to download multiple selected files from FTP using wget. Run the commands in the file in a terminal to download the files.":
    "获取一个用 wget 从 FTP 下载多个已选文件的脚本。在终端中运行该文件里的命令即可下载这些文件。"
};
const NEW_TPL = { pat: "Refer to {{1}} for more details.", zh: "更多详情请参阅{{1}}。" };

test("r27 词库：新增 exact 与模板齐备、槽位连续、翻译口径合法", () => {
  for (const [k, v] of Object.entries(NEW_EXACT)) {
    assert.equal(book.exact[k], v, "缺新词条或译文不符: " + k);
    assert.match(v, CJK, "译文不含中文: " + k);
    assert.notEqual(k, v);
    assert.doesNotMatch(v, /https?:\/\//i, "译文含明文 URL: " + k);
  }
  const tpl = book.templates.find((t) => t.pat === NEW_TPL.pat);
  assert.ok(tpl, "缺模板: " + NEW_TPL.pat);
  assert.equal(tpl.zh, NEW_TPL.zh);
  const slots = [...tpl.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  const zh = [...tpl.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  slots.slice().sort((a, b) => a - b).forEach((n, i) => assert.equal(n, i + 1, "槽位必须从 1 连续"));
  assert.deepEqual(zh.slice().sort((a, b) => a - b), slots.slice().sort((a, b) => a - b));
  // 模板通道只接受 20 字符以上的句式（engine buildTemplate 的下限），防止误伤短标签
  assert.ok(tpl.pat.replace(/\{\{\d+\}\}/g, "").length >= 20, "模板静态部分过短会失配");
});

test("项目记录页：Study Name 字段名翻译，字段值与登录号不动", () => {
  const doc = run(
    '<div id="content"><app-root>' +
      '<h3 class="record-title">Project: PRJEB33227</h3>' +
      '<div class="record-description">Global Chicken Data</div>' +
      '<div class="attribute"><div class="attribute-name">Secondary Study Accession:</div><div class="attribute-value">ERP115998</div></div>' +
      '<div class="attribute"><div class="attribute-name">Study Title:</div><div class="attribute-value">Global Chicken</div></div>' +
      '<div class="attribute"><div class="attribute-name">Center Name:</div><div class="attribute-value">KUNMING INSTITUTE OF ZOOLOGY, CHINESE ACADEMY OF SCIENCES</div></div>' +
      '<div class="attribute"><div class="attribute-name">Study Name:</div><div class="attribute-value">Chicken 2K</div></div>' +
      "</app-root></div>"
  );
  const names = [...doc.querySelectorAll(".attribute-name")].map(text);
  assert.deepEqual(names, ["次级研究登录号：", "研究标题：", "中心名称：", "研究名称："]);
  const values = [...doc.querySelectorAll(".attribute-value")].map(text);
  assert.deepEqual(values, [
    "ERP115998",
    "Global Chicken",
    "KUNMING INSTITUTE OF ZOOLOGY, CHINESE ACADEMY OF SCIENCES",
    "Chicken 2K"
  ]);
  assert.equal(text(doc.querySelector("h3.record-title")), "项目：PRJEB33227");
  assert.equal(text(doc.querySelector(".record-description")), "Global Chicken Data", "记录描述是数据，不翻");
});

test("文本检索结果页：无结果提示整句翻译，查询语法提示走模板且保留链接", () => {
  const doc = run(
    '<div id="content"><app-root><app-text-search>' +
      '<p class="nr">No results matching your query were found. If your query string contains non-alphanumeric characters, consider enclosing it in double quotes (""). </p>' +
      '<p class="qs">Refer to <a class="no-underline" href="https://www.ebi.ac.uk/ebisearch/documentation.ebi#query_syntax" target="_blank"> Query Syntax documentation</a> for more details. </p>' +
      "</app-text-search></app-root></div>",
    "https://www.ebi.ac.uk/ena/browser/text-search?query=histone"
  );
  assert.equal(
    text(doc.querySelector("p.nr")),
    "未找到与您的检索式匹配的结果。如果检索式中含有非字母数字字符，可以尝试用双引号（\"\"）将其括起来。"
  );
  assert.equal(
    text(doc.querySelector("p.qs")),
    "更多详情请参阅 Query Syntax documentation。"
  );
  const a = doc.querySelector("p.qs a");
  assert.equal(
    a.getAttribute("href"),
    "https://www.ebi.ac.uk/ebisearch/documentation.ebi#query_syntax",
    "模板不能丢链接"
  );
  assert.equal(text(a), "Query Syntax documentation", "链接文本原样搬回，不改写");
});

test("记录页 ENA 标签字段名：首次公开/最后更新，日期值不动", () => {
  const doc = run(
    '<div id="content"><app-root>' +
      '<h3 class="record-title">Sample: SAMEA5757237</h3>' +
      '<div class="attribute"><div class="attribute-name">Scientific Name:</div><div class="attribute-value">Gallus gallus (chicken)</div></div>' +
      '<div class="attribute"><div class="attribute-name">ENA-FIRST-PUBLIC:</div><div class="attribute-value">2021-05-16</div></div>' +
      '<div class="attribute"><div class="attribute-name">ENA-LAST-UPDATE:</div><div class="attribute-value">2021-05-16</div></div>' +
      "</app-root></div>",
    "https://www.ebi.ac.uk/ena/browser/view/SAMEA5757237"
  );
  assert.deepEqual([...doc.querySelectorAll(".attribute-name")].map(text), [
    "学名：",
    "ENA 首次公开：",
    "ENA 最后更新："
  ]);
  assert.deepEqual([...doc.querySelectorAll(".attribute-value")].map(text), [
    "Gallus gallus (chicken)",
    "2021-05-16",
    "2021-05-16"
  ]);
});

test("读段文件：下载脚本提示整句命中，表格数据不动", () => {
  const doc = run(
    '<div id="content"><app-root>' +
      '<div id="cdk-describedby-message-132" class="tooltip">Get a script to download multiple selected files from FTP using wget. Run the commands in the file in a terminal to download the files.</div>' +
      "<table><thead><tr><th>Run Accession</th><th>Scientific Name</th></tr></thead>" +
      "<tbody><tr><td>ERR3419984</td><td>Gallus gallus</td></tr></tbody></table>" +
      '<div class="mat-paginator-range-label">1 - 1 of 1 (1 total)</div>' +
      "</app-root></div>"
  );
  assert.equal(
    text(doc.querySelector(".tooltip")),
    "获取一个用 wget 从 FTP 下载多个已选文件的脚本。在终端中运行该文件里的命令即可下载这些文件。"
  );
  assert.deepEqual([...doc.querySelectorAll("th")].map(text), ["运行登录号", "学名"]);
  assert.deepEqual([...doc.querySelectorAll("td")].map(text), ["ERR3419984", "Gallus gallus"], "登录号与物种名不动");
  assert.equal(text(doc.querySelector(".mat-paginator-range-label")), "第 1 - 1 条，共 1 条（1 总计）");
});

test("只追加不改写：既有条目的语义保持不变", () => {
  assert.equal(book.exact["Study Title:"], "研究标题：");
  assert.equal(book.exact["Secondary Study Accession:"], "次级研究登录号：");
  assert.equal(book.exact["Analysis Files:"], "分析文件：");
  assert.equal(book.exact["PageTab"], "页面标签");
  assert.ok(book.rules.some((r) => r.re === "^Project: (.+)$" && r.to === "项目：$1"));
});
