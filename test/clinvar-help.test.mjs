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

// ---- FAQ 答案正文与首页卡片（v0.9.92 追加） ----
function mountTpl(html) {
  const dom = new JSDOM(html, { url: "https://www.ncbi.nlm.nih.gov/clinvar/docs/faq/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: dict.exact, rules: dict.rules, templates: dict.templates },
    site
  });
  engine.start();
  return dom.window.document;
}

test("FAQ 答案整段：反链基因的排序、RCV 登录号、Last Updated 日期", () => {
  const doc = mountTpl(
    '<div id="maincontent" class="col1">' +
      "<p>When a gene is on the negative strand, the location of a variation relative to the gene sorts in opposite order to the location on the genome. The position column on ClinVar's tabular display is the chromosome location, so the ordering seems counterintuitive. At present we do not provide a method to sort in the opposite order.</p>" +
      "<p>A persistent issue for clinical genetics is the lack of consensus about how to describe the clinical condition that results from variation in known disease genes. As a result, we recognize there are often multiple RCV accessions assigned to the same variant for conditions that might be considered the same or overlapping. We anticipate this will change over time as expert panels review the data and decide how to describe the condition. When updates result in matching conditions, the RCV accessions will be merged.</p>" +
      "<p>At the bottom left side of a ClinVar record is a date called \"Last Updated\". If this date is after the date on the VCF file, then the web is displaying data that is newer than data in the VCF file. The website is updated weekly, while the VCF file is created monthly.</p>" +
      "</div>"
  );
  const ps = [...doc.querySelectorAll("p")].map((p) => p.textContent);
  assert.match(ps[0], /当基因位于负链时/);
  assert.match(ps[0], /目前我们不提供按相反顺序排序的方法/);
  assert.ok(!/negative strand/.test(ps[0]));
  assert.match(ps[1], /临床遗传学长期存在的一个问题/);
  assert.match(ps[1], /这些 RCV 登录号将会合并/);
  assert.match(ps[2], /「最后更新」（Last Updated）/);
  assert.match(ps[2], /VCF 文件每月生成一次/);
});

test("FAQ 答案整段：变异描述、版本号递增与提交数口径", () => {
  const doc = mountTpl(
    '<div id="maincontent" class="col1">' +
      "<p>ClinVar accepts the description of the variant provided by the submitter. We believe it helps our public to find records, even though the location of the variant on a defined sequence may be uncertain. In some cases, the original assay was at the protein level, and the numbering system for that protein is uncertain or the nucleotide change that may generate the protein change is indeterminate. In other cases, deletions have been reported relative to a transcript, and it is not clear whether the nucleotide change in the genome resulted from a corresponding genomic change, or aberrant splicing generated from another genomic location. Many submissions do have supporting citations, but ClinVar does not have the resources to review the literature to establish the precise nucleotide locations. We welcome submissions that would improve these data for us.</p>" +
      "<p>Any change that the submitter makes to any SCV record causes the version number to increase. The SCV version number does not increase if there is a change in data that NCBI provides, such as allele frequencies, additional HGVS expressions or a MedGen ID for a condition. Data that NCBI provides are packaged only in the VCV and RCV accessions, and changes to those data to not cause a VCV or RCV version to increment either. A new version is assigned to a VCV or RCV if there is a new version of an SCV, an SCV is deleted, or if more SCVs are aggregated into the VCV or RCV.</p>" +
      "<p>The count of submissions on the submitter page is a count of the number of submitted variant classifications from that submitter. This may include submissions for the same variant but with different conditions. The number of records returned in a search for that submitter is for the number of variants that the submitter has reported. Because the submitter may have reported multiple classifications for the same variant with different conditions, the number of variants in the search results may be less than the number of submissions on the submitter summary page.</p>" +
      "<table><tbody><tr><td>all genes are reported , but the preferred description is based on selection of the RefSeq that corresponds to an exonic location. If the variation is in an exon of more than one gene, then the preferred description will not include a gene symbol, and will be based only on the genomic location.</td></tr></tbody></table>" +
      "</div>"
  );
  const ps = [...doc.querySelectorAll("p")].map((p) => p.textContent);
  assert.match(ps[0], /ClinVar 接受提交者提供的变异描述/);
  assert.match(ps[0], /我们欢迎能够帮助我们改进这些数据的提交/);
  assert.ok(!/We welcome submissions/.test(ps[0]));
  assert.match(ps[1], /都会导致版本号递增/);
  assert.match(ps[1], /则会为该 VCV 或 RCV 分配新版本/);
  assert.match(ps[2], /提交者页面上的提交数/);
  assert.match(ps[2], /可能少于提交者摘要页面上的提交数/);
  const td = doc.querySelector("td").textContent;
  assert.match(td, /所有基因都会报告/);
  assert.ok(!/preferred description/.test(td));
});

test("FAQ 提问：not specified 整句与 criteria provided 三段链接", () => {
  const doc = mountTpl(
    '<div id="maincontent" class="col1"><ul>' +
      '<li><a href="#var_gene_order" data-ga-category="faq"></a> <a href="#not_specified" data-ga-category="faq">I\'m interested in a variant that was submitted with the condition "not specified". What does that mean?</a></li>' +
      '<li><a href="#num_submitters" data-ga-category="faq">What does it mean if a ClinVar record is "</a> <a href="#num_submitters" data-ga-category="faq">criteria provided,</a> <a href="#num_submitters" data-ga-category="faq">single submitter" but has more than one submission?</a></li>' +
      "</ul></div>"
  );
  const lis = [...doc.querySelectorAll("li")].map((li) => li.textContent.replace(/\s+/g, ""));
  assert.equal(lis[0], "我对以「notspecified」（未指定）为条件提交的变异感兴趣，这是什么意思？");
  assert.equal(lis[1], "如果ClinVar记录写着（已提供断言标准、单一提交者），但有多条提交记录，这是什么意思？");
  assert.equal(doc.querySelectorAll("li")[0].querySelectorAll("a")[1].getAttribute("href"), "#not_specified");
  assert.equal(doc.querySelectorAll("li")[1].querySelectorAll("a").length, 3);
});

test("FAQ 答案含链接：模板把链接放回中文语序，URL 不变", () => {
  const doc = mountTpl(
    '<div id="maincontent" class="col1"><p>ClinVar records should be referred to with accession and version numbers. It important to include the version number because the classification may change over time; the version number allows you to distinguish between previous and current versions. If you need to build URLs based on a ClinVar accession, please note the instructions for <a href="/clinvar/docs/linking" data-ga-category="faq">constructing links to ClinVar</a>.</p></div>'
  );
  const p = doc.querySelector("p");
  assert.match(p.textContent, /引用 ClinVar 记录时应注明登录号与版本号/);
  assert.match(p.textContent, /如需基于 ClinVar 登录号构建 URL/);
  const a = p.querySelector("a");
  assert.equal(a.getAttribute("href"), "/clinvar/docs/linking");
  assert.equal(a.textContent, "构造指向 ClinVar 的链接");
  assert.ok(!/accession and version numbers/.test(p.textContent));
});

