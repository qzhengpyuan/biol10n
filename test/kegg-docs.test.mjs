// KEGG 帮助/文档四页词库（dict/kegg-docs.json）：规模、取值与四个页面的关键文案
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/kegg-docs.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "kegg");
const loadBook = (id) => JSON.parse(fs.readFileSync(path.join(root, "../dict/" + id + ".json"), "utf8"));
// KEGG 站加载 common + kegg + kegg-docs（词条只收在本册，缺的靠前两册，跟运行时一致）
const siteData = { exact: {}, rules: [], templates: [] };
for (const book of ["common", "kegg", "kegg-docs"]) {
  const d = book === "kegg-docs" ? dict : loadBook(book);
  Object.assign(siteData.exact, d.exact || {});
  siteData.rules.push(...(d.rules || []));
  siteData.templates.push(...(d.templates || []));
}
const createEngine = new Function(
  fs.readFileSync(path.join(root, "../src/engine.js"), "utf8") + "; return createEngine;"
)();

const CJK = /[\u3400-\u9fff]/;
const URL_ONLY = /^\s*(?:https?:\/\/|www\.)\S+\s*$/i;

function mount(html, url) {
  const dom = new JSDOM(html, { url: url || "https://www.kegg.jp/kegg/docs/weblinks.html" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: siteData,
    site
  });
  engine.start();
  return dom.window.document;
}

const text = (doc, sel) => doc.querySelector(sel).textContent.replace(/\s+/g, " ").trim();

test("词库规模：exact ≥ 60，规则与模板结构合法", () => {
  assert.ok(Object.keys(dict.exact).length >= 60, "exact 少于 60 条");
  assert.equal(dict.meta.family, "kegg-docs");
  for (const host of ["www.kegg.jp", "www.genome.jp"]) {
    assert.ok(dict.meta.sites.includes(host), "缺少站点 " + host);
  }
  for (const r of dict.rules) {
    assert.ok(r.re.startsWith("^") && r.re.endsWith("$"), "规则未锚定: " + r.re);
    assert.ok(CJK.test(r.to), "规则译文无汉字: " + r.re);
  }
  assert.equal(dict.templates.length, 3, "帮助页三个 TD 应各有一条模板");
  for (const t of dict.templates) {
    assert.ok(t.pat.includes("{{1}}") && t.zh.includes("{{1}}"), "模板占位符缺失: " + t.pat.slice(0, 60));
    assert.ok(CJK.test(t.zh));
  }
});

test("每条译文含汉字、不以裸 URL 充当译文、键已归一化", () => {
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.equal(k, k.replace(/\s+/g, " ").trim(), "键未归一化: " + JSON.stringify(k));
    assert.ok(CJK.test(v), "译文无汉字: " + k);
    assert.doesNotMatch(v, URL_ONLY, "译文是裸 URL: " + k);
    assert.notEqual(k, v, "自映射: " + k);
  }
});

test("不收录 KEGG 平面文件的全大写常量", () => {
  const CAPS = /^(ENTRY|NAME|DEFINITION|DESCRIPTION|GENE|SEQUENCE|COMPOUND|PATHWAY|MODULE|ORTHOLOGY|BRITE|GENOME|DBLINKS|REFERENCE|AUTHORS|TITLE|JOURNAL|REMARK)$/;
  for (const k of Object.keys(dict.exact)) assert.doesNotMatch(k, CAPS, "不应收录平面文件常量: " + k);
});

test("KEGG Search 帮助页：标题、三行 TD 正文整句翻成中文并保留链接", () => {
  const [t1, t2, t3] = dict.templates.map((t, i) =>
    t.pat.replace("{{1}}", '<a href="#x">' + (i === 0 ? "KEGG identifier" : "Searching KEGG") + "</a>")
  );
  const doc = mount(
    "<!doctype html><html><head><title>KEGG Search (Help)</title></head><body>" +
      '<div class="frame3"><table>' +
      '<tr><th>DBGET</th><td>' + t2 + "</td></tr>" +
      '<tr><th>KEGG</th><td>' + t1 + "</td></tr>" +
      '<tr><th>MEDICUS</th><td>' + t3 + "</td></tr>" +
      "</table></div></body></html>",
    "https://www.kegg.jp/kegg/document/help_kegg_search.html"
  );
  assert.equal(doc.title, "KEGG 检索（帮助）");
  const tds = [...doc.querySelectorAll("td")];
  assert.match(tds[0].textContent, /^此模式对整个 KEGG 数据库执行 DBGET 检索。更多细节见 KEGG 检索说明。$/);
  assert.match(tds[1].textContent, /^此模式接受 KEGG 标识符，以检索对应条目。/);
  assert.equal(tds[1].querySelector("a").getAttribute("href"), "#x");
  assert.match(tds[1].textContent, /当检索词不匹配任何 KEGG 标识符时，由 DBGET 执行关键词检索。/);
  assert.match(tds[2].textContent, /^此模式是 KEGG MEDICUS 页面中的默认模式。/);
  assert.match(tds[2].textContent, /DailyMed 数据库中处方药与非处方药的 FDA 药品说明书/);
  assert.equal(text(doc, "th"), "DBGET 检索");
});

test("WebLinks：章节标题、表头、表内容与备注", () => {
  const doc = mount(
    "<h4>General form</h4><b>REST-style URL</b><b>Database name</b><b>Database entry identifier</b>" +
      "<h4>KEGG ID naming conventions</h4><p>Table 1. KEGG databases</p>" +
      "<dl><dt>(Note)</dt><dd>The base URL www.kegg.jp may be replaced by www.genome.jp for the entry operation.</dd></dl>" +
      "<table>" +
      "<tr><td>DB name</td><td>Prefix</td><td>KEGG ID</td><td>Web page</td></tr>" +
      "<tr><td>BRITE functional hierarchies</td><td>KO functional orthologs</td><td>Small molecules</td></tr>" +
      "<tr><td>Genes in viruses category</td><td>Mature peptides in viruses</td><td>Genes in addendum category</td></tr>" +
      "<tr><td>three- or four-letter KEGG organism code</td><td>NCBI gene ID or locus_tag</td><td>EC number</td></tr>" +
      "</table>" +
      "<p>Table 2. KEGG databases in Japanese</p><p>Table 2 shows Japanese version of selected KEGG databases.</p>" +
      "<b>URL form</b><b>Examples</b><b>Restriction</b><div>(in Japanese)</div>"
  );
  const heads = [...doc.querySelectorAll("h4")].map((e) => e.textContent.trim());
  assert.deepEqual(heads, ["通用形式", "KEGG ID 命名约定"]);
  const bolds = [...doc.querySelectorAll("b")].map((e) => e.textContent.trim());
  assert.deepEqual(bolds, ["REST 风格 URL", "数据库名", "数据库条目标识符", "URL 形式", "示例", "限制"]);
  assert.equal(text(doc, "dt"), "（注）");
  assert.equal(text(doc, "dd"), "entry 操作的基础 URL www.kegg.jp 可替换为 www.genome.jp。");
  const tds = [...doc.querySelectorAll("td")].map((e) => e.textContent.trim());
  assert.deepEqual(tds.slice(0, 4), ["数据库名", "前缀", "KEGG 标识符", "网页"]);
  for (const zh of ["BRITE 功能层级", "KO 功能直系同源", "小分子", "病毒类别的基因", "病毒中的成熟肽", "附加类别的基因", "三到四位的 KEGG 生物代码", "NCBI 基因 ID 或 locus_tag", "EC 编号"]) {
    assert.ok(tds.includes(zh), "缺少表内容译文: " + zh);
  }
  const ps = [...doc.querySelectorAll("p")].map((e) => e.textContent.trim());
  assert.deepEqual(ps, ["表 1. KEGG 数据库", "表 2. KEGG 数据库日文版", "表 2 列出部分 KEGG 数据库的日文版。"]);
  assert.equal(text(doc, "div"), "（日文）");
});

test("KEGG Identifier 页：章节标题、表头与物种代码说明", () => {
  const doc = mount(
    "<h3>KEGG Data Objects and Identifiers</h3>" +
      "<h4>KEGG Identifier</h4><h4>Vtax Identifier</h4><h4>KEGG DB Links</h4>" +
      "<table><tr><td>Prefix</td><td>ID conversion</td><td>Internal links</td><td>Outside links</td><td>Other</td>" +
      "<td>Metabolites and chemical substances</td><td>Disease-related network elements</td></tr></table>" +
      '<span class="small">&lt;org&gt; represents three- or four-letter organism code</span>',
    "https://www.kegg.jp/kegg/kegg3.html"
  );
  assert.equal(text(doc, "h3"), "KEGG 数据对象与标识符");
  const heads = [...doc.querySelectorAll("h4")].map((e) => e.textContent.trim());
  assert.deepEqual(heads, ["KEGG 标识符", "Vtax 标识符", "KEGG 数据库链接"]);
  const tds = [...doc.querySelectorAll("td")].map((e) => e.textContent.trim());
  for (const zh of ["前缀", "内部链接", "外部链接", "其他", "代谢物与化学物质", "疾病相关网络元件"]) {
    assert.ok(tds.includes(zh), "缺少表头译文: " + zh);
  }
  assert.equal(text(doc, "span.small"), "<org> 表示三到四位的生物代码");
});

test("DBGET search 页：标题、库名与检索表单", () => {
  const doc = mount(
    "<!doctype html><html><head><title>DBGET search - PATHWAY</title></head><body>" +
      "<h2>DBGET Search - PATHWAY</h2>" +
      '<table><tr><th>DBGET</th><th>LinkDB</th></tr></table>' +
      "<b>Database: PATHWAY</b><strong>Search PATHWAY for</strong>" +
      "<div>Release 120.0+/11-21, Nov 26</div>" +
      "<select><option>No limit</option></select><div>bfind mode Show</div><div>bget mode</div>" +
      "<div>Kyoto University Bioinformatics Center</div></body></html>",
    "https://www.kegg.jp/dbget-bin/www_bfind?pathway"
  );
  assert.equal(doc.title, "DBGET 检索 - PATHWAY");
  assert.equal(text(doc, "h2"), "DBGET 检索 - PATHWAY");
  const ths = [...doc.querySelectorAll("th")].map((e) => e.textContent.trim());
  assert.deepEqual(ths, ["DBGET 检索", "LinkDB 链接库"]);
  assert.equal(text(doc, "b"), "数据库：PATHWAY");
  assert.equal(text(doc, "strong"), "在 PATHWAY 中检索");
  assert.equal(text(doc, "option"), "不限");
  const divs = [...doc.querySelectorAll("div")].map((e) => e.textContent.trim());
  assert.ok(divs.includes("版本 120.0+/11-21, Nov 26"));
  assert.ok(divs.includes("bfind 模式，显示"));
  assert.ok(divs.includes("bget 模式"));
  assert.ok(divs.includes("京都大学生物信息学中心"));
});