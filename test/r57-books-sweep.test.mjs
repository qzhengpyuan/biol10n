// NCBI Bookshelf（/books、/books/NBK143764、/books/about、/books/NBK25500）补词回归（r57）
// 覆盖：首页「Using Bookshelf / Participate」两个 portlet 的固定标签、首页站点说明整句、
// 目录侧栏的 Last Update 元数据、书目引文里的 Bethesda (MD) 出版项、公有领域提示模板、
// 封面缩略图的 alt，以及两条反向约束（ul.toc 的章节标题不碰、品牌与登录号不收）。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/books.json"), "utf8"));
const allDicts = fs
  .readdirSync(path.join(root, "../dict"))
  .filter((f) => f.endsWith(".json") && f !== "books.json")
  .map((f) => ({ id: f.replace(/\.json$/, ""), data: JSON.parse(fs.readFileSync(path.join(root, "../dict", f), "utf8")) }));

const site = sites.find((s) => s.id === "ncbi-books") || {
  id: "ncbi-books",
  hosts: ["www.ncbi.nlm.nih.gov"],
  path: "^/books",
  dicts: ["common", "ncbi", "books", "ncbi-footer"],
  scope: "body",
  proseExempt: ".usa-banner, .usa-media_block-body, [class*=disclaimer]",
  skip: "ul.toc a.toc-item, .bktoc_lst_exp a.toc-item",
  skipFree: ["a.toc-item[href*='editors']"],
  inlineExact: true
};

// 本轮新增的条目：跨册冲突检查只锁这一批，别人往别的册加词不会把我这条测试打红。
const NEW_EXACT = [
  "Using Bookshelf", "Quick Start Guide", "Tutorials", "New Releases", "Participate",
  "Authors and Publishers", "How to Apply", "Participation Agreement", "File Submission Specifications",
  "New & Updated", "Featured Titles", "NLM Literature Archive", "Open Access Subset", "Librarians",
  "Related NLM Catalog Entries", "Book thumbnail", "RSS Feed", "RSS feeds", "Bethesda (MD):",
  "Bookshelf provides free online access to books and documents in life science and healthcare. Search, read, and discover."
];

function stackData() {
  const data = { exact: {}, rules: [], templates: [] };
  for (const id of site.dicts) {
    const p = path.join(root, "../dict", id + ".json");
    if (!fs.existsSync(p)) continue;
    const b = JSON.parse(fs.readFileSync(p, "utf8"));
    Object.assign(data.exact, b.exact || {});
    data.rules = data.rules.concat(b.rules || []);
    data.templates = data.templates.concat(b.templates || []);
  }
  return data;
}

function run(html) {
  const dom = new JSDOM("<body>" + html + "</body>", { url: "https://www.ncbi.nlm.nih.gov/books/NBK25500/" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data: stackData(), site });
  engine.start();
  return dom.window.document;
}
const flat = (doc) => doc.body.textContent.replace(/\s+/g, " ").trim();
const CJK = /[\u3400-\u9fff]/;

test("词库结构：本册条数、键值形态、新增条目不收 3 字符碎词", () => {
  assert.equal(book.meta.family, "books");
  assert.ok(book.meta.sites.includes("www.ncbi.nlm.nih.gov"), "meta.sites 要声明 host");
  assert.ok(Object.keys(book.exact).length >= 170, "exact 条数不足: " + Object.keys(book.exact).length);
  assert.ok(book.rules.length >= 21, "rules 条数不足: " + book.rules.length);
  assert.ok(book.templates.length >= 2, "templates 条数不足: " + book.templates.length);
  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(!CJK.test(k), "键里不能有中文: " + k);
    assert.ok(CJK.test(v), "译文里必须有中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "键首尾不能有空白: " + JSON.stringify(k));
    assert.equal(v, String(v).trim(), "值首尾不能有空白: " + JSON.stringify(k));
  }
  for (const k of NEW_EXACT) {
    assert.ok(Object.hasOwn(book.exact, k), "本轮新增条目缺失: " + k);
    assert.ok(k.length > 3, "不要单独收 3 字符以内的短词: " + k);
  }
});

test("规则是对象形态、可编译，且本轮三条规则都在", () => {
  for (const r of book.rules) {
    assert.equal(typeof r, "object");
    assert.equal(typeof r.re, "string");
    assert.equal(typeof r.to, "string");
    assert.ok(CJK.test(r.to), "规则译文里必须有中文: " + r.re);
    assert.doesNotThrow(() => new RegExp(r.re), "规则必须可编译: " + r.re);
  }
  assert.ok(book.rules.some((r) => r.re.indexOf("^Last Update: ") === 0), "缺 Last Update 规则");
  assert.ok(book.rules.some((r) => r.re.indexOf("^Cover of ") === 0), "缺 Cover of 规则");
  const cite = book.rules.find((r) => r.re.indexOf("Internet") >= 0);
  assert.ok(cite, "缺 [Internet] 引文规则");
  assert.ok(
    new RegExp(cite.re).test("Entrez® Programming Utilities Help [Internet]. Bethesda (MD): National Center for Biotechnology Information (US); 2010-."),
    "[Internet] 引文规则命中不了真实串"
  );
});

test("模板槽位连续、原文无汉字、译文有汉字且句末不留英文句点", () => {
  for (const t of book.templates) {
    const used = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    const zhUsed = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.ok(used.length >= 1, "模板要带槽位: " + t.pat.slice(0, 40));
    assert.ok(!CJK.test(t.pat), "模板原文里不能有汉字: " + t.pat.slice(0, 40));
    assert.ok(CJK.test(t.zh), "模板译文里必须有中文: " + t.pat.slice(0, 40));
    assert.deepEqual(used.slice().sort((a, b) => a - b), used, "槽位必须从 1 连续: " + t.pat.slice(0, 40));
    assert.deepEqual(zhUsed.slice().sort((a, b) => a - b), used, "译文槽位要与原文一致: " + t.pat.slice(0, 40));
  }
});

test("本轮新增键不引入跨册冲突：其它册的同名键译文一致", () => {
  const clashes = [];
  for (const k of NEW_EXACT) {
    for (const d of allDicts) {
      const other = d.data.exact && d.data.exact[k];
      if (other && other !== book.exact[k]) clashes.push(k + ": books=" + book.exact[k] + " / " + d.id + "=" + other);
    }
  }
  assert.deepEqual(clashes, [], "跨册同键译文不一致（会新增冲突组）：\n" + clashes.join("\n"));
});

test("首页「Using Bookshelf」portlet 四个固定链接译出", () => {
  const doc = run(
    '<div class="onecol"><div class="firsttier_portlet"><div class="portlet_head"><h2>Using Bookshelf</h2></div>' +
      '<div class="portlet_content"><ul>' +
      '<li><a href="/books/help/">Quick Start Guide</a></li>' +
      '<li><a href="/books/help/tutorials/">Tutorials</a></li>' +
      '<li><a href="/books/new/">New Releases</a></li>' +
      "</ul></div></div></div>"
  );
  const out = flat(doc);
  assert.ok(out.includes("使用 Bookshelf"), "portlet 标题未译: " + out);
  assert.ok(out.includes("快速入门指南"), "Quick Start Guide 未译");
  assert.ok(out.includes("教程"), "Tutorials 未译");
  assert.ok(out.includes("新书发布"), "New Releases 未译");
});

test("首页「Participate」portlet 四个固定链接译出（含参与协议）", () => {
  const doc = run(
    '<div class="onecol lastcol"><div class="firsttier_portlet"><div class="portlet_head"><h2>Participate</h2></div>' +
      '<div class="portlet_content"><ul>' +
      '<li><a href="/books/about/publishers/">Authors and Publishers</a></li>' +
      '<li><a href="/books/about/publishers/#how">How to Apply</a></li>' +
      '<li><a href="/books/about/publishers/#agreement">Participation Agreement</a></li>' +
      '<li><a href="/books/about/filespec/">File Submission Specifications</a></li>' +
      "</ul></div></div></div>"
  );
  const out = flat(doc);
  assert.ok(out.includes("参与"), "Participate 未译: " + out);
  assert.ok(out.includes("作者与出版者"), "Authors and Publishers 未译");
  assert.ok(out.includes("如何申请"), "How to Apply 未译");
  assert.ok(out.includes("参与协议"), "Participation Agreement 未译");
  assert.ok(out.includes("文件提交规范"), "File Submission Specifications 未译");
});

test("首页 portlet 标题与侧栏入口（New & Updated / Featured Titles / 存档与图书馆员）", () => {
  const doc = run(
    '<div class="portlet"><div class="portlet_head"><div class="portlet_title"><h3>New &amp; Updated</h3></div></div></div>' +
      '<div class="portlet"><div class="portlet_head"><div class="portlet_title"><h3>Featured Titles</h3></div></div></div>' +
      '<div class="portlet"><div class="portlet_content"><ul>' +
      '<li><a href="/books/archive/">NLM Literature Archive</a></li>' +
      '<li><a href="/books/oai/">Open Access Subset</a></li>' +
      '<li><a href="/books/about/librarians/">Librarians</a></li>' +
      "</ul></div></div>"
  );
  const out = flat(doc);
  assert.ok(out.includes("新增与更新"), "New & Updated 未译: " + out);
  assert.ok(out.includes("精选书目"), "Featured Titles 未译");
  assert.ok(out.includes("NLM 文献存档"), "NLM Literature Archive 未译");
  assert.ok(out.includes("开放获取子集"), "Open Access Subset 未译");
  assert.ok(out.includes("图书馆员"), "Librarians 未译");
});

test("首页站点说明整句译出，专名 Bookshelf 保留英文", () => {
  const en =
    "Bookshelf provides free online access to books and documents in life science and healthcare. Search, read, and discover.";
  const out = flat(run('<div class="dbheader"><div class="headerintro"><div class="dbdescription">' + en + "</div></div></div>"));
  assert.ok(!out.includes("provides free online access"), "说明句未译: " + out);
  assert.ok(out.includes("Bookshelf 免费提供"), "Bookshelf 专名应保留: " + out);
  assert.ok(out.includes("生命科学"), "译文缺少关键词");
});

test("目录侧栏元数据：Last Update 标签翻转、日期本地化为「YYYY 年 M 月 D 日」", () => {
  const doc = run('<ul class="toc"><li><a class="toc-item" href="/books/x/">Basic Searching</a><div class="small">Last Update: October 27, 2023.</div></li></ul>');
  const out = flat(doc);
  assert.ok(out.includes("最后更新：2023 年 10 月 27 日。"), "Last Update 未按「标签翻转、日期本地化」处理: " + out);
  assert.ok(!out.includes("Last Update:"), "仍残留英文标签");
});

test("既有 Created/Last Update 组合规则优先，不被新规则截胡", () => {
  const out = flat(run("<div>Created: February 21, 2013; Last Update: July 19, 2013</div>"));
  assert.ok(out.startsWith("创建于 2013 年 2 月 21 日"), "组合规则被截胡: " + out);
  assert.ok(out.includes("最后更新：2013 年 7 月 19 日"), "组合规则右半段丢失: " + out);
});

test("目录侧栏 Created 元数据：带句号的单条与组合也都本地化", () => {
  const one = flat(run("<div>Created: November 14, 2013.</div>"));
  assert.equal(one, "创建于 2013 年 11 月 14 日。", "带句号的单条 Created 未本地化: " + one);
  const both = flat(run("<div>Created: November 14, 2013; Last Update: July 19, 2013.</div>"));
  assert.equal(both, "创建于 2013 年 11 月 14 日；最后更新：2013 年 7 月 19 日。", "带句号的组合 Created 未本地化: " + both);
});

test("书目引文：单独出版项 Bethesda (MD): 与整行 [Internet] 出处都译出", () => {
  const single = flat(run('<div>Bethesda (MD): <a href="https://www.ncbi.nlm.nih.gov/">National Center for Biotechnology Information (US)</a>; 2010-.</div>'));
  assert.ok(single.startsWith("贝塞斯达（马里兰州）："), "单独出版项未译: " + single);

  const line = flat(
    run("<p>Entrez® Programming Utilities Help [Internet]. Bethesda (MD): National Center for Biotechnology Information (US); 2010-.</p>")
  );
  assert.ok(line.includes("贝塞斯达（马里兰州）：美国国家生物技术信息中心（US）；2010-"), "整行出处未译: " + line);
  assert.ok(!line.includes("National Center for Biotechnology Information"), "仍残留英文机构名");
});

test("公有领域提示走模板：链接保留、href 不变", () => {
  const doc = run(
    '<div><div>This publication is in the public domain. For more information, see the <a href="/books/about/copyright/">Bookshelf Copyright Notice</a>.</div></div>'
  );
  const out = flat(doc);
  assert.ok(out.includes("本出版物属于公有领域"), "模板未命中: " + out);
  assert.ok(out.includes("更多信息请参见"), "模板后半句缺失: " + out);
  assert.equal(doc.querySelector("a").getAttribute("href"), "/books/about/copyright/", "链接被拆");
  assert.equal(doc.querySelectorAll("a").length, 1);
});

test("封面缩略图与订阅图标的说明属性（alt/title）译出", () => {
  const doc = run(
    '<a href="/books/n/handbook2e/"><img src="x.png" alt="Cover of The NCBI Handbook"></a>' +
      '<img src="rss.png" alt="RSS Feed" title="RSS feeds">' +
      '<img src="t.png" alt="Book thumbnail">'
  );
  const alts = [...doc.querySelectorAll("img")].map((i) => i.getAttribute("alt"));
  assert.deepEqual(alts, ["The NCBI Handbook 封面", "RSS 订阅源", "图书缩略图"]);
  assert.equal(doc.querySelectorAll("img")[1].getAttribute("title"), "RSS 订阅源");
});

test("反向约束：ul.toc 的章节标题保持英文（目录项不得被翻）", () => {
  const doc = run(
    '<ul class="toc"><li><a class="toc-item" href="/books/n/handbook2e/Literature/">Literature</a></li>' +
      '<li><a class="toc-item" href="/books/n/handbook2e/x/">Basic Searching</a></li></ul>'
  );
  const items = [...doc.querySelectorAll("a.toc-item")].map((a) => a.textContent.trim());
  assert.deepEqual(items, ["Literature", "Basic Searching"], "目录项被误翻: " + items.join(" / "));
});

test("反向约束：正文与小标题不翻（内容不是界面）", () => {
  const doc = run(
    '<div class="main-content"><h3>Basic Searching</h3><p>Output: List of UIDs matching the Entrez query</p>' +
      '<div class="meta-content"><span class="title">E-utilities Quick Start</span><p class="contrib-group">Eric Sayers, PhD.</p></div></div>'
  );
  const out = flat(doc);
  assert.ok(out.includes("Basic Searching"), "小标题被误翻");
  assert.ok(out.includes("Output: List of UIDs matching the Entrez query"), "正文被误翻");
  assert.ok(out.includes("E-utilities Quick Start"), "章节标题被误翻");
});

test("反向约束：品牌/工具名与登录号不进词表", () => {
  const banned = ["PubMed", "ClinVar", "RefSeq", "SRA", "ToolKit", "NBK25500", "NBK143764", "NCBI Bookshelf"];
  const keys = new Set(Object.keys(book.exact));
  for (const b of banned) assert.ok(!keys.has(b), "品牌/登录号不该单独收: " + b);
  const doc = run('<select id="database"><optgroup label="Databases"><option>PubMed</option><option>ClinVar</option></optgroup></select>');
  const opts = [...doc.querySelectorAll("option")].map((o) => o.textContent);
  assert.deepEqual(opts, ["PubMed", "ClinVar"], "数据库名被误翻");
});
