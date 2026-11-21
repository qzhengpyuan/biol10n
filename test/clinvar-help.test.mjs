// ClinVar 帮助/文档页词库（dict/clinvar-help.json）冒烟测试
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/clinvar-help.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "ncbi-clinvar");

function mount(html) {
  const dom = new JSDOM(html, { url: "https://www.ncbi.nlm.nih.gov/clinvar/docs/help/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: dict.exact, rules: dict.rules },
    site
  });
  engine.start();
  return dom.window.document;
}

test("文档页标题与章节标题翻成中文", () => {
  const doc = mount(
    '<div id="maincontent">' +
      "<h1>ClinVar Website Overview</h1>" +
      "<h2>Review status on submitted records (SCV)</h2>" +
      "<h2>Representation of classifications in ClinVar</h2>" +
      "<h3>How ClinVar validates submissions</h3>" +
      "</div>"
  );
  assert.equal(doc.querySelector("h1").textContent, "ClinVar 网站概览");
  assert.equal(doc.querySelector("h2").textContent, "提交记录（SCV）的审核状态");
  assert.equal(doc.querySelectorAll("h2")[1].textContent, "ClinVar 中分类的表示方式");
  assert.equal(doc.querySelector("h3").textContent, "ClinVar 如何验证提交内容");
});

test("帮助页页内 anchors、教程入口与常见问题入口翻成中文", () => {
  const doc = mount(
    '<nav class="on-this-page"><ul>' +
      "<li><a href=\"#common\">Common queries</a></li>" +
      "<li><a href=\"#filters\">Search filters</a></li>" +
      "<li><a href=\"#review\">Reviewing the results</a></li>" +
      "<li><a href=\"#faq\">FAQ about using ClinVar</a></li>" +
      "</ul></nav>" +
      '<div class="buttons"><a class="usa-button" href="/clinvar/docs/tutorial/">Tutorial</a></div>'
  );
  const links = [...doc.querySelectorAll("nav a, .buttons a")].map((a) => a.textContent);
  assert.deepEqual(links, [
    "常用检索",
    "检索筛选器",
    "查看检索结果",
    "ClinVar 使用常见问题",
    "教程"
  ]);
});

test("正文固定说明整句与表格表头翻成中文", () => {
  const doc = mount(
    '<div id="maincontent"><p>The title represents the preferred name of the variant.</p>' +
      "<table><tbody>" +
      "<tr><th>ClinVar's Field Name</th><th>Scope and explanation</th></tr>" +
      "<tr><td>The chromosome on which a variant is found.</td><td>no classification for the individual variant</td></tr>" +
      "</tbody></table></div>"
  );
  assert.equal(doc.querySelector("p").textContent, "标题表示该变异的首选名称。");
  const ths = [...doc.querySelectorAll("th")].map((e) => e.textContent);
  assert.deepEqual(ths, ["ClinVar 字段名", "适用范围与说明"]);
  const tds = [...doc.querySelectorAll("td")].map((e) => e.textContent);
  assert.deepEqual(tds, ["变异所在的染色体。", "该变异本身未分类"]);
});

test("链接 title 属性（导航 tooltip）也翻", () => {
  const doc = mount(
    '<div id="maincontent">' +
      '<a href="/clinvar/docs/identifiers/" title="Identifiers in ClinVar">ids</a>' +
      '<a href="/clinvar/docs/variation_report/" title="The ClinVar VCV (variant) page">vcv</a>' +
      "</div>"
  );
  const as = [...doc.querySelectorAll("a")];
  assert.equal(as[0].getAttribute("title"), "ClinVar 中的标识符");
  assert.equal(as[1].getAttribute("title"), "ClinVar VCV（变异）页面");
});

test("分页与编号标题走规则，编号与数字保留", () => {
  const doc = mount(
    '<div id="maincontent">' +
      '<div class="pagination"><a href="#">Previous 200</a> <a href="#">Next 200</a></div>' +
      "<h3>1. How do I search ClinVar efficiently?</h3>" +
      "</div>"
  );
  const links = [...doc.querySelectorAll(".pagination a")].map((a) => a.textContent);
  assert.deepEqual(links, ["上一页 200 条", "下一页 200 条"]);
  assert.equal(doc.querySelector("h3").textContent, "1. 如何高效检索 ClinVar？");
});

test("requireHit：捕获组没有命中词表时整条规则放弃，不留半中半英", () => {
  const doc = mount('<div id="maincontent"><h3>1. Some unknown sentence here?</h3></div>');
  assert.equal(doc.querySelector("h3").textContent, "1. Some unknown sentence here?");
});

test("变异名/登录号等数据不翻", () => {
  const doc = mount(
    '<div id="maincontent"><table><tbody>' +
      "<tr><td>NM_000314.8:c.395G&gt;T</td><td>VCV000007105</td><td>PTEN</td></tr>" +
      "</tbody></table></div>"
  );
  const tds = [...doc.querySelectorAll("td")].map((e) => e.textContent);
  assert.deepEqual(tds, ["NM_000314.8:c.395G>T", "VCV000007105", "PTEN"]);
});
