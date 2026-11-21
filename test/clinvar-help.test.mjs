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
test("审核状态页：体细胞说明整段、多重性列表项与冲突分类尾句翻成中文", () => {
  const doc = mount(
    '<div id="maincontent">' +
      "<p>It differs from the calculation for germline and oncogenicity in that consensus in the classification is not considered. The rationale is that for a given variant, it will be typical for different tiers to be reported for different types of assertions (therapeutic, diagnostic, or prognostic) and different tumor types, so conflicts are not informative. Thus the review status for somatic clinical impact is based on the following data provided in the contributing SCVs:</p>" +
      "<ul><li>otherwise, the review status is based on a. transparency: whether any submitted record provided assertion criteria and evidence for the classification (or a public contact) b. multiplicity: whether there are multiple submitted records (consensus is not required)</li></ul>" +
      "<table><tbody><tr><td>and evidence for the classification (or a public contact) were provided. However there are conflicting classifications. The conflicting values for the classification are enumerated.</td></tr></tbody></table>" +
      "</div>"
  );
  const p = doc.querySelector("p").textContent;
  assert.match(p, /不考虑分类中的一致性/);
  assert.match(p, /临床影响的体细胞分类的审核状态/);
  assert.match(doc.querySelector("li").textContent, /多重性，即是否存在多条提交记录/);
  assert.match(doc.querySelector("td").textContent, /但存在相互冲突的分类/);
});

test("星数表英文数词 four/three/two/one 翻成中文", () => {
  const doc = mount(
    '<div id="maincontent"><table><tbody>' +
      "<tr><th>Number of gold stars</th><th>Review status</th></tr>" +
      "<tr><td>four</td><td>practice guideline</td></tr>" +
      "<tr><td>three</td><td>reviewed by expert panel</td></tr>" +
      "<tr><td>two</td><td>criteria provided, multiple submitters</td></tr>" +
      "<tr><td>one</td><td>criteria provided, single submitter</td></tr>" +
      "</tbody></table></div>"
  );
  const stars = [...doc.querySelectorAll("tbody tr td:first-child")].map((td) => td.textContent);
  assert.deepEqual(stars, ["四", "三", "二", "一"]);
});

test("字面 markdown 链接整句翻成中文，URL 原样保留", () => {
  const doc = mount(
    '<div id="maincontent"><table><tbody>' +
      "<tr><td>There is a submitted record with a classification from a [practice guideline](https://www.ncbi.nlm.nih.gov/clinvar/docs/review_guidelines/)</td></tr>" +
      "<tr><td>There is a submitted record with a classification from an [expert panel](https://www.ncbi.nlm.nih.gov/clinvar/docs/review_guidelines/)</td></tr>" +
      "</tbody></table></div>"
  );
  const tds = [...doc.querySelectorAll("td")].map((e) => e.textContent);
  assert.equal(
    tds[0],
    "有一条提交记录的分类来自 [实践指南](https://www.ncbi.nlm.nih.gov/clinvar/docs/review_guidelines/)"
  );
  assert.equal(
    tds[1],
    "有一条提交记录的分类来自 [专家组](https://www.ncbi.nlm.nih.gov/clinvar/docs/review_guidelines/)"
  );
});

test("断言标准示例说明整段翻成中文", () => {
  const doc = mount(
    '<div id="maincontent"><p>The following table provides examples to help submitters understand what is meant by documentation of assertion criteria and to guide you in creating your own documentation for your specific assertion criteria. These example documents are not intended to be submitted to ClinVar by other groups; please do not include either of these documents in your submission (unless your group provided the sample documentation).</p></div>'
  );
  const text = doc.querySelector("p").textContent;
  assert.match(text, /下表提供示例/);
  assert.match(text, /断言标准的文档/);
  assert.ok(!/assertion criteria/.test(text), "不应残留英文 assertion criteria");
});
