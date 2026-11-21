// KEGG 文档第二批词库（dict/kegg-docs2.json）：dbentry / weblinks / kegg2 / kegg3 / DBGET 首页
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/kegg-docs2.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "kegg");
const loadBook = (id) => JSON.parse(fs.readFileSync(path.join(root, "../dict/" + id + ".json"), "utf8"));

// KEGG 站按 common → kegg → kegg-docs → kegg-docs2 顺序装载，后面的册子覆盖同名键
const siteData = { exact: {}, rules: [], templates: [] };
for (const book of ["common", "kegg", "kegg-docs", "kegg-docs2"]) {
  const d = book === "kegg-docs2" ? dict : loadBook(book);
  Object.assign(siteData.exact, d.exact || {});
  siteData.rules.push(...(d.rules || []));
  siteData.templates.push(...(d.templates || []));
}
const createEngine = new Function(
  fs.readFileSync(path.join(root, "../src/engine.js"), "utf8") + "; return createEngine;"
)();

const CJK = /[\u3400-\u9fff]/;
const URL_ONLY = /^\s*(?:https?:\/\/|www\.)\S+\s*$/i;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;
const FILE_PATH = /(?:\/mnt\/|\/home\/|\/Users\/|C:\\\\Users\\\\)/;

function mount(html, url) {
  const dom = new JSDOM(html, { url: url || "https://www.kegg.jp/kegg/docs/dbentry.html" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: siteData,
    site
  });
  engine.start();
  return { doc: dom.window.document, engine };
}

const text = (doc, sel) => doc.querySelector(sel).textContent.replace(/\s+/g, " ").trim();
const all = (doc, sel) => [...doc.querySelectorAll(sel)].map((e) => e.textContent.replace(/\s+/g, " ").trim());
const cellText = (doc) => all(doc, "td");

test("词库结构：规模、规则锚定、模板占位符", () => {
  assert.equal(dict.meta.family, "kegg-docs2");
  for (const host of ["www.kegg.jp", "www.genome.jp"]) assert.ok(dict.meta.sites.includes(host));
  assert.ok(Object.keys(dict.exact).length >= 70, "exact 少于 70 条");
  assert.equal(dict.templates.length, 3);
  assert.equal(dict.rules.length, 2);
  for (const r of dict.rules) {
    assert.ok(r.re.startsWith("^") && r.re.endsWith("$"), "规则未锚定: " + r.re);
    assert.ok(CJK.test(r.to), "规则译文无汉字: " + r.re);
    assert.doesNotThrow(() => new RegExp(r.re));
  }
  for (const t of dict.templates) {
    assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, "模板长度越界: " + t.pat);
    assert.match(t.pat, /\{\{1\}\}/);
    assert.match(t.zh, /\{\{1\}\}/);
    assert.ok(CJK.test(t.zh));
    const slots = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    const used = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.deepEqual(used, slots, "译文占位符顺序与原句不一致: " + t.pat);
  }
});

test("每条译文含汉字、没有明文 URL/邮箱/本机路径", () => {
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.equal(k, k.replace(/\s+/g, " ").trim(), "键未归一化: " + JSON.stringify(k));
    assert.ok(!CJK.test(k), "键里出现中文: " + k);
    assert.ok(CJK.test(v), "译文无汉字: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.doesNotMatch(v, URL_ONLY, "译文是裸 URL: " + k);
    assert.doesNotMatch(v, EMAIL, "译文含邮箱: " + k);
    assert.doesNotMatch(v, FILE_PATH, "译文含本机路径: " + k);
  }
});

test("不收录平面文件全大写常量", () => {
  for (const k of Object.keys(dict.exact)) {
    assert.doesNotMatch(k, /^[A-Z0-9_\-]{4,}$/, "不应收录平面文件常量: " + k);
  }
});

test("dbentry：导语、导航、说明句与左栏标签翻成中文", () => {
  const { doc } = mount(
    '<!doctype html><html><head><title>KEGG Database Entry Format</title></head><body>' +
      '<div id="content"><h2>KEGG Database Entry Format</h2>' +
      "[ <a>KEGG Identifier</a> |<a>KEGG WebLinks</a> |\nKEGG Database Entry Format ]" +
      "<div>This document describes the database entry field names in the web page and the corresponding flat file. It also summarizes the fields searched by " +
      '<a href="#dbget">DBGET</a>.</div>' +
      '<div>The content of each field is described in the link from "Web page".</div>' +
      "<h3>DBGET Search Fields</h3>" +
      "<table><tr><td>Lineage</td><td>LINEAGE</td></tr>" +
      "<tr><td>Vtax</td><td>VTAX</td></tr>" +
      "<tr><td>vtax</td><td>vtax</td></tr>" +
      "<tr><td>Reaction(IUBMB)</td><td>REACTION</td></tr>" +
      "<tr><td>(T4 entry)</td><td>(T4 entry)</td></tr>" +
      "<tr><td>(gif image)</td><td>(gif image)</td></tr>" +
      "<tr><td>Group</td><td>GROUP</td></tr>" +
      "<tr><th>DBGET name</th><th>Database name</th></tr></table></div></body></html>"
  );
  assert.equal(doc.title, "KEGG 数据库条目格式");
  assert.equal(text(doc, "h2"), "KEGG 数据库条目格式");
  assert.match(text(doc, "#content"), /\[ KEGG 标识符 \|\s*KEGG 外部链接 \| KEGG 数据库条目格式 \]/);
  assert.match(text(doc, "#content"), /本文档介绍网页中数据库条目的字段名及其对应的平面文件，并汇总以下检索字段，它们由 DBGET 检索。/);
  assert.match(text(doc, "#content"), /各字段的内容见「网页」列的链接说明。/);
  assert.equal(text(doc, "h3"), "DBGET 检索字段");
  const tds = cellText(doc);
  for (const zh of ["谱系", "Vtax 标识符", "反应（IUBMB）", "（T4 条目）"]) {
    assert.ok(tds.includes(zh), "缺少译文: " + zh);
  }
  assert.ok(all(doc, "th").includes("DBGET 名称"), "表头未译");
  assert.ok(!("REACTION" in dict.exact), "本册不应收录平面文件常量 REACTION");
  // 右栏平面文件常量与 DBGET 库名小写写法必须原样保留
  for (const en of ["LINEAGE", "VTAX", "vtax", "(gif image)", "Group"]) {
    assert.ok(tds.includes(en), "常量被误翻: " + en);
  }
});

test("weblinks：导航尾段与 KEGG ID 语法单元格保持原样", () => {
  const { doc } = mount(
    "[ <a>KEGG Identifier</a> |\nKEGG WebLinks |\n<a>KEGG Database Entry Format</a> ]" +
      "<table><tr><td>map, &lt;org&gt;</td><td>&lt;map number&gt;</td><td>disease_ja</td></tr></table>",
    "https://www.kegg.jp/kegg/docs/weblinks.html"
  );
  assert.match(text(doc, "body"), /\[ KEGG 标识符 \|\s*KEGG 外部链接 \| KEGG 数据库条目格式 \]/);
  const tds = cellText(doc);
  assert.deepEqual(tds, ["map, <org>", "<map number>", "disease_ja"]);
});

test("DBGET 首页：标题、导语、表头与 ID 类型说明", () => {
  const { doc } = mount(
    '<!doctype html><html><head><title>DBGET Search</title></head><body>' +
      "<h2>DBGET Search</h2>" +
      '<div><b>DBGET</b> is an integrated database retrieval system for major biological databases at <a href="https://www.genome.jp/">GenomeNet</a>. It is also used in KEGG as the backbone retrieval system. DBGET is based on a flat-file view of molecular biology databases, where the database is considered as a collection of entries. Thus, each entry of each database can be retrieved by the combination of the database name and the entry name (see the <a href="https://www.kanehisa.jp/en/about_dbget.html">history of development</a>).</div>' +
      "<blockquote><a>DBGET at GenomeNet</a></blockquote>" +
      "<h4>KEGG Database in DBGET</h4>" +
      "<table><tr><th>Database name</th><th>Abbre-<br>viation</th><th>Webpage</th></tr>" +
      "<tr><td>Genes in KEGG viruses</td><td>map number</td><td>&lt;org&gt; or T number</td></tr>" +
      "<tr><td>Chemical compounds</td><td>Chemical Reactions</td><td>vtax number</td></tr>" +
      '<tr><td>KEGG Enzyme</td><td>T4 number</td><td>DG number</td></tr></table>' +
      '<p>"kegg" includes mgenes and mgenome maintained by GenomeNet</p></body></html>',
    "https://www.kegg.jp/dbget/"
  );
  assert.equal(doc.title, "DBGET 检索");
  assert.equal(text(doc, "h2"), "DBGET 检索");
  assert.equal(text(doc, "h4"), "DBGET 中的 KEGG 数据库");
  assert.match(text(doc, "div"), /^DBGET 是一个整合数据库检索系统，可检索主要生物学数据库，站点为 GenomeNet 服务。它也是 KEGG 的骨干检索系统。DBGET 基于分子生物学数据库的平面文件视图，即把数据库视为条目集合。因此，每个数据库的每个条目都可以通过数据库名与条目名的组合来检索（参见发展历程）\.$/);
  assert.equal(text(doc, "blockquote"), "GenomeNet 上的 DBGET");
  const ths = all(doc, "th");
  assert.deepEqual(ths, ["数据库名", "缩写", "网页"]);
  const tds = cellText(doc);
  for (const zh of ["KEGG 病毒中的基因", "化合物", "化学反应", "KEGG 酶", "map 编号", "<org> 或 T 编号", "vtax 编号", "T4 编号", "DG 编号"]) {
    assert.ok(tds.includes(zh), "缺少译文: " + zh);
  }
  assert.match(text(doc, "p"), /「kegg」包含由 GenomeNet 维护的 mgenes 与 mgenome/);
});

test("kegg2：三行“A、B、C 与 D”工具说明按原链接顺序重排", () => {
  const { doc } = mount(
    "<table>" +
      '<tr><td>KO assignment tools including <a href="#a">BlastKOALA</a> and <a href="#b">GhostKOALA</a></td></tr>' +
      '<tr><td>KEGG mapping tools including <a href="#1">Reconstruct</a>, <a href="#2">Search</a>, <a href="#3">Color</a>, <a href="#4">Join</a> and <a href="#5">MWsearch</a></td></tr>' +
      '<tr><td><a href="#x">Genome alignment</a>, <a href="#y">Genome similarity</a>, <a href="#z">Taxonomy mapping</a> and <a href="#w">User data analysis</a> tools</td></tr>' +
      "<tr><td>cats and dogs</td></tr></table>",
    "https://www.kegg.jp/kegg/kegg2.html"
  );
  const tds = all(doc, "td");
  assert.equal(tds[0], "KO 注释工具，包括 BlastKOALA 与 GhostKOALA");
  assert.equal(tds[1], "KEGG 映射工具，包括重建、检索、着色、连接与 MWsearch");
  assert.equal(tds[2], "基因组比对、基因组相似性、分类学映射与用户数据分析工具");
  assert.equal(tds[3], "cats and dogs", "模板误伤普通英文段落");
  assert.equal(doc.querySelector("td a").getAttribute("href"), "#a", "模板应保留原链接");
  assert.equal(doc.querySelectorAll("td")[1].querySelectorAll("a").length, 5);
});

test("大小写敏感的 Gn / Vtax 规则不影响小写库名", () => {
  const { doc } = mount(
    "<table><tr><td>Gn</td><td>gn</td><td>Vtax</td><td>vtax</td></tr></table>",
    "https://www.kegg.jp/kegg/docs/dbentry.html"
  );
  assert.deepEqual(cellText(doc), ["基因名", "gn", "Vtax 标识符", "vtax"]);
});
