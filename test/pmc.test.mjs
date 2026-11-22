// PMC 站词库（dict/pmc.json）冒烟测试：页眉页脚与 PMC 页面骨架
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/pmc.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "ncbi-pmc");

function mount(html) {
  const dom = new JSDOM(html, { url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8891128/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: dict.exact, rules: dict.rules },
    site
  });
  engine.start();
  return dom.window.document;
}

test("词库规模：exact 至少 40 条，且每条译文都含汉字", () => {
  const keys = Object.keys(dict.exact);
  assert.ok(keys.length >= 40, "exact 只有 " + keys.length + " 条");
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.match(v, /[\u4e00-\u9fff]/, "译文不含汉字: " + k + " => " + v);
  }
});

test("PMC 页眉：检索框、站点导航与期刊列表入口", () => {
  const doc = mount(
    '<header class="usa-header usa-header--extended">' +
      '<form class="usa-search"><button class="usa-button"><span class="usa-search__submit-text">Search NCBI</span></button></form>' +
      '<nav class="usa-nav"><p id="primary-navigation-sr-only-title" class="usa-sr-only">Primary site navigation</p></nav>' +
      '<div class="pmc-header__search"><form id="pmc-search-form" class="usa-search">' +
      '<label class="usa-sr-only">Search PMC Full-Text Archive</label>' +
      '<button class="usa-button"><span class="usa-search__submit-text">Search in PMC</span></button>' +
      "</form></div>" +
      '<ul class="pmc-header__search__menu"><li><a class="usa-link" href="/journals/">Journal List</a></li></ul>' +
      "</header>"
  );
  assert.equal(doc.querySelector(".usa-search__submit-text").textContent, "检索 NCBI");
  assert.equal(doc.querySelector("#primary-navigation-sr-only-title").textContent, "主导航");
  assert.equal(doc.querySelector("#pmc-search-form label").textContent, "检索 PMC 全文库");
  assert.equal(doc.querySelector("#pmc-search-form .usa-search__submit-text").textContent, "在 PMC 中检索");
  assert.equal(doc.querySelector("ul.pmc-header__search__menu a").textContent, "期刊列表");
});

test("PMC 页脚：免责声明整句与两个声明入口", () => {
  const doc = mount(
    '<div class="pmc-layout__disclaimer">' +
      "<p>As a library, NLM provides access to scientific literature. Inclusion in an NLM database does not imply endorsement of, or agreement with, the contents by NLM or the National Institutes of Health.</p>" +
      '<a class="usa-link" href="/about/disclaimer/">PMC Disclaimer</a>' +
      '<a class="usa-link" href="/about/copyright/">PMC Copyright Notice</a>' +
      "</div>"
  );
  const p = doc.querySelector("p").textContent;
  assert.match(p, /NLM 提供科学文献的访问/);
  assert.match(p, /并不表示 NLM 或美国国立卫生研究院认可或同意其内容/);
  const links = [...doc.querySelectorAll("a")].map((a) => a.textContent);
  assert.deepEqual(links, ["PMC 免责声明", "PMC 版权声明"]);
});

test("文章骨架：Article notes / Copyright and License information / 图注与表注前缀", () => {
  const doc = mount(
    '<div id="maincontent"><section class="body">' +
      '<ul class="d-buttons"><li><button class="d-button">Article notes</button></li>' +
      '<li><button class="d-button">Copyright and License information</button></li></ul>' +
      '<figure id="f1" class="fig"><h4 class="obj_head">Figure 1.</h4><a class="usa-link" href="#">Open in a new tab</a></figure>' +
      '<section id="T1" class="tw"><h4 class="obj_head">Table 2B.</h4></section>' +
      "<h2>Funding</h2><h2>Conflict of Interest</h2><h2>Acknowledgments</h2>" +
      "</section></div>"
  );
  const buttons = [...doc.querySelectorAll(".d-button")].map((b) => b.textContent);
  assert.deepEqual(buttons, ["文章注释", "版权与许可信息"]);
  assert.equal(doc.querySelector("#f1 .obj_head").textContent, "图 1.");
  assert.equal(doc.querySelector("#f1 a").textContent, "在新标签页中打开");
  assert.equal(doc.querySelector("#T1 .obj_head").textContent, "表 2B.");
  const heads = [...doc.querySelectorAll("h2")].map((h) => h.textContent);
  assert.deepEqual(heads, ["资助", "利益冲突", "致谢"]);
});

test("文章工具条：ACTIONS/RESOURCES/引用与分享入口、PDF 大小走高规则", () => {
  const doc = mount(
    '<div id="maincontent">' +
      "<h2>ACTIONS</h2><h2>RESOURCES</h2>" +
      '<li><a class="usa-button"><span>PDF (1.1 MB)</span></a></li>' +
      '<span class="usa-tooltip__body">Download PDF</span>' +
      '<span class="usa-tooltip__body">View on publisher site</span>' +
      '<h2 class="usa-modal__heading">PERMALINK</h2>' +
      "<h3>Cited by other articles</h3><h3>Links to NCBI Databases</h3>" +
      "<h2>On this page</h2>" +
      "</div>"
  );
  const texts = [...doc.querySelectorAll("h2, h3, span")].map((e) => e.textContent);
  assert.ok(texts.includes("操作"));
  assert.ok(texts.includes("资源"));
  assert.ok(texts.includes("PDF（1.1 MB）"), "PDF 大小未按规则转换: " + texts.join(" | "));
  assert.ok(texts.includes("下载 PDF"));
  assert.ok(texts.includes("在出版商网站查看"));
  assert.ok(texts.includes("固定链接"));
  assert.ok(texts.includes("其他文章的引用"));
  assert.ok(texts.includes("NCBI 数据库链接"));
  assert.ok(texts.includes("本页内容"));
});

test("期刊列表页：标题、检索框与筛选标签", () => {
  const doc = mount(
    '<div id="maincontent"><h1 id="journalListHeading">PMC Journal List</h1>' +
      '<a class="usa-link">Learn more in our User Guide</a>' +
      '<label class="usa-sr-only">Search for journals</label>' +
      '<button><span class="usa-search__submit-text">Search Journal List</span></button>' +
      '<a class="usa-link"><span>Download full journal list</span></a>' +
      "<h3>FILTERS</h3>" +
      "<label>NLM Title Abbreviation:</label><label>ISSN (print):</label><label>ISSN (online):</label>" +
      "<label>Release Delay (Embargo):</label><label>Agreement Status:</label>" +
      "</div>"
  );
  assert.equal(doc.querySelector("h1").textContent, "PMC 期刊列表");
  assert.equal(doc.querySelector("a.usa-link").textContent, "在我们的用户指南中了解更多");
  assert.equal(doc.querySelector("label.usa-sr-only").textContent, "检索期刊");
  assert.equal(doc.querySelector("button .usa-search__submit-text").textContent, "检索期刊列表");
  const labels = [...doc.querySelectorAll("label")].map((e) => e.textContent);
  assert.deepEqual(labels, [
    "检索期刊",
    "NLM 刊名缩写：",
    "ISSN（印刷版）：",
    "ISSN（在线版）：",
    "发布延迟（禁运期）：",
    "协议状态："
  ]);
  assert.equal(doc.querySelector("h3").textContent, "筛选");
});

test("期刊信息与筛选计数：计数保留、标签译出", () => {
  const doc = mount(
    '<div id="maincontent"><ul class="usa-list">' +
      "<li><label>NLM Unique ID:</label> 1234</li><li><label>Earliest:</label> 1990</li>" +
      "</ul><label>All articles (4084)</label><label>No longer participating (380)</label>" +
      "</div>"
  );
  const labels = [...doc.querySelectorAll("label")].map((e) => e.textContent);
  assert.deepEqual(labels, ["NLM 唯一标识：", "最早收录：", "全部文章（4084）", "已不再参与（380）"]);
});

test("期刊注记与致谢句、通讯作者/编辑/审稿标签", () => {
  const doc = mount(
    '<footer class="p"><p class="courtesy-note">Articles from Frontiers in Immunology are provided here courtesy of <strong>Frontiers Media SA</strong></p></footer>' +
      '<div id="maincontent" class="author-notes">' +
      '<p class="display-inline">*Correspondence: Paola Panina-Bordignon,</p>' +
      "<p>Edited by: Richard Idro, Makerere University, Uganda</p>" +
      "</div>"
  );
  const note = doc.querySelector(".courtesy-note").textContent;
  assert.match(note, /以下文章由 Frontiers in Immunology 提供，承蒙以下机构惠允：/);
  assert.match(note, /Frontiers Media SA/);
  const ps = [...doc.querySelectorAll(".author-notes p")].map((e) => e.textContent);
  assert.equal(ps[0], "通讯作者：Paola Panina-Bordignon,");
  assert.equal(ps[1], "编辑：Richard Idro, Makerere University, Uganda");
});

test("文献标识与期刊名不翻", () => {
  const doc = mount(
    '<div id="maincontent"><div class="ameta">PMCID: PMC8891128 PMID: 35102710 doi: 10.3389/fimmu.2022.826091</div>' +
      "<p>Frontiers in Immunology</p></div>"
  );
  const id = doc.querySelector(".ameta").textContent;
  assert.ok(id.includes("PMCID: PMC8891128"));
  assert.ok(id.includes("PMID: 35102710"));
  assert.ok(id.includes("10.3389/fimmu.2022.826091"));
  assert.equal(doc.querySelector("p").textContent, "Frontiers in Immunology");
});

test("PMC 文章页 aria-label：页眉检索、操作栏与内容区块", () => {
  const doc = mount(
    '<div class="pmc-header">' +
      '<button aria-label="Open search"></button>' +
      '<div aria-label="PMC Header with search box"></div>' +
      '<button aria-label="Open article navigation"></button>' +
      "</div>" +
      '<section aria-label="Article content"><div aria-label="Actions bar"></div></section>' +
      '<aside aria-label="Article citation and metadata"></aside>' +
      '<a title="Link to Health Care Science" href="#"></a>'
  );
  assert.equal(doc.querySelector('button[aria-label="打开检索"]') !== null, true);
  assert.equal(doc.querySelector('[aria-label="PMC 页眉与检索框"]') !== null, true);
  assert.equal(doc.querySelector('[aria-label="打开文章导航"]') !== null, true);
  assert.equal(doc.querySelector('[aria-label="文章正文"]') !== null, true);
  assert.equal(doc.querySelector('[aria-label="操作栏"]') !== null, true);
  assert.equal(doc.querySelector('[aria-label="文章引文与元数据"]') !== null, true);
  assert.equal(doc.querySelector("a").getAttribute("title"), "链接到 Health Care Science");
});
