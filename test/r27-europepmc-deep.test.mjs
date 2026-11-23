// Europe PMC 深页补漏（r27）：文章页 Data 分区标签、结果页预印本版本徽标与「Cited by … | PPR: …」组合串、
// 页脚 ELIXIR 政策链接的弯引号变体。词库断言 + 引擎 translateText + jsdom 渲染用例。
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

const book = read("europepmc.json");
const common = read("common.json");
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const configSite = sites.find((s) => s.id === "europepmc") || { id: "europepmc", scope: "body" };
const site = Object.assign({}, configSite, { id: "europepmc", scope: configSite.scope || "body", attrs: ["value"] });

const data = {
  exact: Object.assign({}, common.exact, book.exact),
  rules: (common.rules || []).concat(book.rules || []),
  templates: (common.templates || []).concat(book.templates || [])
};

function boot(html, url) {
  const dom = new JSDOM("<body>" + html + "</body>", { url: url || "https://europepmc.org/article/MED/23193274" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return { dom, engine, doc: dom.window.document };
}
const flat = (el) => String(el.textContent || "").replace(/\s+/g, " ").trim();

test("r27 词库：深页条目与规则齐备", () => {
  assert.equal(book.exact["Data"], "数据", "文章页 Data 标签缺失");
  // 页面用弯引号（U+2019），词库里原有的直引号条目命不中
  assert.equal(book.exact["EMBL-EBI\u2019s long term data preservation policies"], "EMBL-EBI 的长期数据保存政策");
  assert.match(
    book.exact["EMBL-EBI's long term data preservation policies"],
    /长期数据保存政策/,
    "直引号旧条目应保持同一译法"
  );
  const rules = book.rules.map((r) => r.re);
  assert.ok(rules.includes("^Preprint v(\\d+(?:\\.\\d+)*)$"), "缺少预印本版本号规则");
  assert.ok(rules.includes("^Cited by: ([\\d,]+) articles? \\| ([A-Za-z]{2,12}: .+)$"), "缺少引文计数组合串规则");
  assert.ok(
    rules.some((re) => re.startsWith("^(.+), ") && re.includes("(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)")),
    "缺少题录行日期规则"
  );
});

test("r27 规则：预印本版本号与引文计数组合串", () => {
  const { engine } = boot("");
  assert.equal(engine.translateText("Preprint v1"), "预印本 v1");
  assert.equal(engine.translateText("Preprint v2.1"), "预印本 v2.1");
  assert.equal(
    engine.translateText("Cited by: 0 articles | PPR: PPR1372621"),
    "被引：0 篇 | PPR: PPR1372621"
  );
  assert.equal(
    engine.translateText("Cited by: 1,234 articles | PMID: 12345678"),
    "被引：1,234 篇 | PMID: 12345678"
  );
  // 无尾随编号的旧形态仍由既有规则处理
  assert.equal(engine.translateText("Cited by: 0 articles"), "被引：0 篇");
  assert.equal(engine.translateText("Cited by: 206 articles |"), "被引：206 篇 |");
  // 不误伤：论文标题、正文里的单词不整句替换
  assert.equal(engine.translateText("Data-driven analysis of TP53 mutations."), null);
  assert.equal(engine.translateText("Preprint server"), null);
  assert.equal(engine.translateText("Cited by: many articles"), null);
  // 文章页题录行：期刊名保留、日期换成中文格式（月名走词表二次查表）
  assert.equal(
    engine.translateText("Nucleic Acids Research, 27 Nov 2012, 41(Database issue):D56-63"),
    "Nucleic Acids Research，2012 年 11 月 27 日，41(Database issue):D56-63"
  );
  // 日期已在中文里的题录行不再二次改写
  assert.equal(engine.translateText("Nucleic Acids Res, 40(database issue):D912-7, 2011 年 11 月 09 日"), null);
});

test("r27 jsdom：文章页侧栏 Data 标签与分区标题", () => {
  const { doc } = boot(
    '<ul id="article--side-menu">' +
      '<li class="highlighted"><a id="article--side-menu--item-abstract" href="#abstract"><span>摘要</span></a></li>' +
      '<li class="data-section"><a id="article--side-menu--item-data" class="data" href="#data"><span>Data</span></a></li>' +
      "</ul>" +
      '<h2 id="article--data--header" class="section-title">Data</h2>'
  );
  assert.equal(flat(doc.querySelector("#article--side-menu--item-data")), "数据");
  assert.equal(flat(doc.querySelector("#article--data--header")), "数据");
  assert.equal(flat(doc.querySelector("#article--side-menu--item-abstract")), "摘要", "已翻条目应保持不变");
});

test("r27 jsdom：结果页引文行（Cited by … | PPR: …）与预印本徽标", () => {
  const { doc } = boot(
    '<div class="search-results"><ul><li class="citation">' +
      '<h3 class="citation-title">Effects of KRAS/NRAS/BRAF Mutations in TP53-Mutant Colorectal Cancer</h3>' +
      '<p class="citation-id">Cited by: 0 articles | PPR: PPR1372621</p>' +
      '<p class="citation-labels small"><span class="citation-version">Preprint v1</span></p>' +
      "</li></ul></div>",
    "https://europepmc.org/search?query=TP53"
  );
  assert.equal(flat(doc.querySelector("p.citation-id")), "被引：0 篇 | PPR: PPR1372621");
  assert.equal(flat(doc.querySelector(".citation-version")), "预印本 v1");
  // 论文标题是题录，必须原样保留
  assert.equal(
    flat(doc.querySelector(".citation-title")),
    "Effects of KRAS/NRAS/BRAF Mutations in TP53-Mutant Colorectal Cancer"
  );
});

test("r27 jsdom：页脚模板保留链接，弯引号政策链接翻成中文", () => {
  const { doc } = boot(
    "<p>Europe PMC is an <a href=\"/about\">ELIXIR Core Data Resource</a>, " +
      "<a href=\"/about\">Global Core Biodata Resource</a>, and conforms with " +
      "<a href=\"/preservation\">EMBL-EBI\u2019s long term data preservation policies</a>.</p>"
  );
  const p = doc.querySelector("p");
  assert.equal(
    flat(p),
    "Europe PMC 是ELIXIR 核心数据资源、全球核心生物数据资源，并遵循EMBL-EBI 的长期数据保存政策。"
  );
  assert.equal(p.querySelectorAll("a").length, 3, "链接节点必须保留");
  assert.equal(p.querySelector("a").getAttribute("href"), "/about");
  assert.equal(p.querySelectorAll("a")[2].getAttribute("href"), "/preservation");
  assert.equal(flat(p.querySelectorAll("a")[2]), "EMBL-EBI 的长期数据保存政策");
});
