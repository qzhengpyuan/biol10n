// r29 Europe PMC 文章页分区补词：引文与影响力（Impact metrics / scite 智能引文）、Data 分区报错句、
// 图表分区（Figures (n)、(Figure n.) Click for full size image、Show more figures）、作者「[Show all n]」、
// 「Add to list」保存弹窗与登录提示句。
// 词库：dict/europepmc.json（站点另加载 dict/common.json）。
// 原文取自 2026-11-23 实测页面（https://europepmc.org/article/MED/23193274 展开
// #impact / #data / #figures-and-tables；搜索页 https://europepmc.org/search?query=TP53 的保存弹窗）。
// 断言口径：界面串必须整串译为中文；题录、作者、摘要、编号一律返回 null。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, "..", "dict", f), "utf8"));
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

// 真实 DOM 片段（2026-11-23 实测，已删 data-v-* 与 base64 图片）
const IMPACT = `
<div id="impact" class="content-section">
  <h2 id="article--impact--header" role="button" tabindex="0" class="section-title">Citations &amp; impact</h2>
  <div class="section-content"><div class="impact">
    <h3>Impact metrics</h3>
    <div class="impact-metrics"><div class="impact-counters">
      <div id="article--impact--subItem-citedByCount">
        <div class="featured-number"><div class="feature-large has-below">682</div>
          <div class="large-label semi-bold">Citations</div></div>
        <span role="button" tabindex="0" class="action small semi-bold" id="article--impact--jumpToLink-citations"><span class="action-icon "></span>
            Jump to Citations
          </span>
      </div>
    </div>
    <h4 id="citedByCount">
        Citations of article over time
      </h4>
    <canvas aria-label="Citation chart" role="img" class="chartjs-render-monitor"></canvas>
    <h4><span id="scite-title">
            Smart citations by scite.ai
            <span><span tabindex="0" style="display: none;"><div class="popper light"><div class="content small">
              Smart citations by
              <a href="//scite.ai">scite.ai</a> include citation statements
              extracted from the full text of the citing article. The number
              of the statements may be higher than the number of citations
              provided by EuropePMC if one paper cites another multiple times
              or lower if scite has not yet processed some of the citing
              articles.
            </div></div></span><span class=""><i class="far fa-question-circle"></i></span></span></span>
      <div class="small regular"><i>Explore citation contexts and check if this article has been
              supported or disputed.</i></div>
      <a href="//scite.ai/reports/10.1093/nar/gks1172" class="small regular">https://scite.ai/reports/10.1093/nar/gks1172</a></h4>
    <div id="scite-panel"><div class="col">
      <div class="semi-bold">Supporting</div>
      <div class="semi-bold">Mentioning</div>
      <div class="semi-bold">Contrasting</div></div></div>
    <h3 id="article-citations-header">Article citations</h3>
  </div></div>
</div>`;

const EXTRAS = `
<div id="data" class="content-section">
  <h2 id="article--data--header" class="section-title">Data</h2>
  <div class="section-content"><div><div>Failed to load data links. Please reload the page.</div></div></div>
</div>
<div id="figures-and-tables" class="content-section">
  <h2 id="article--figures-and-tables--header" role="button" tabindex="0" class="section-title">
    Figures (3)&nbsp;<span class="right"><i class="fas fa-caret-down"></i></span></h2>
  <div class="section-content"><div class="figures">
    <div class="figures--bar full"><div class="figure-fade scroll-left"><div tabindex="0" role="button" class="figure-scroll-button left"><span class="fa-stack"></span><span class="alt-text">Show more figures</span></div></div>
    <a id="article--figure--icon-Figure-1." href="#" class="figures--figure-box"><span class="alt-text">(Figure 1.) Click for full size image</span></a>
    <a id="article--figure--icon-Figure-2." href="#" class="figures--figure-box"><span class="alt-text">(Figure 2.) Click for full size image</span></a>
    </div>
  </div></div>
</div>
<div class="metadata--author-list"><span class="metadata--author-showall-link"><a class="semi-bold">[Show all 21]</a></span></div>
<div class="modal"><h3>Add to list</h3>
  <p>Please sign in to save and receive email updates for new results.</p>
  <button>Continue</button></div>
<h1 id="article--current--title">ENCODE data in the UCSC Genome Browser: year 5 update.</h1>
<p id="article--abstract--content">The Encyclopedia of DNA Elements (ENCODE), http://encodeproject.org, has completed its fifth year of scientific collaboration.</p>
<span class="metadata--author-name">Rosenbloom KR</span>
<span id="article--pmcid">PMCID: PMC3531152</span>`;

test("r29 词库：新增 exact / rules / templates 齐备", () => {
  assert.equal(book.exact["Impact metrics"], "影响力指标");
  assert.equal(book.exact["Jump to Citations"], "跳到引文");
  assert.equal(book.exact["Citations of article over time"], "文章被引次数随时间变化");
  assert.equal(book.exact["Smart citations by scite.ai"], "scite.ai 智能引文");
  assert.equal(book.exact["Supporting"], "支持");
  assert.equal(book.exact["Mentioning"], "提及");
  assert.equal(book.exact["Contrasting"], "对立");
  assert.equal(book.exact["Article citations"], "文章引文");
  assert.equal(book.exact["Failed to load data links. Please reload the page."], "数据链接加载失败，请重新加载页面。");
  assert.equal(book.exact["Show more figures"], "查看更多图片");
  assert.equal(book.exact["Citation chart"], "被引图表");
  assert.equal(book.exact["Add to list"], "加入列表");
  assert.match(book.exact["Please sign in to save and receive email updates for new results."], /登录/);
  assert.match(book.exact["Explore citation contexts and check if this article has been supported or disputed."], /引文语境/);

  const rules = book.rules.map((r) => r.re);
  assert.ok(rules.includes("^Figures \\((\\d+)\\)$"), "缺 Figures (n) 规则");
  assert.ok(rules.includes("^\\(Figure (\\d+)\\.\\) Click for full size image$"), "缺图注规则");
  assert.ok(rules.includes("^\\[Show all (\\d+)\\]$"), "缺 [Show all n] 规则");

  const tpl = book.templates.find((t) => t.pat.includes("Smart citations by {{1}}"));
  assert.ok(tpl, "缺 scite 智能引文模板");
  assert.ok(tpl.zh.includes("{{1}}"), "模板译文必须保留占位符");
  assert.equal(tpl.pat.match(/\{\{\d+\}\}/g).length, 1, "模板占位符必须与原文槽位一一对应");
});

test("r29 规则：图表计数、图注、作者展开链接", () => {
  const { engine } = boot("");
  assert.equal(engine.translateText("Figures (3)"), "图（3）");
  assert.equal(engine.translateText("Figures (12)"), "图（12）");
  assert.equal(engine.translateText("(Figure 1.) Click for full size image"), "（图 1）点击查看原图");
  assert.equal(engine.translateText("(Figure 12.) Click for full size image"), "（图 12）点击查看原图");
  assert.equal(engine.translateText("[Show all 21]"), "[显示全部 21]");
  // 不误伤：没有编号的裸词与带数据的句子都不动
  // 裸词 "Figures" 由 common.json 的 Figure 条目译作「图」（侧栏就是它），但不会套上图注句式
  assert.equal(engine.translateText("Figures"), "图");
  assert.equal(engine.translateText("[Show all]"), null);
  assert.equal(engine.translateText("(Figure 3.) TP53 mutation frequencies in colorectal cancer."), null);
  assert.equal(engine.translateText("Figures (3) of the ENCODE paper."), null);
});

test("r29 引擎：引文与影响力 / Data 分区整块落地", () => {
  const { doc } = boot(IMPACT + EXTRAS);
  assert.equal(flat(doc.querySelector("#impact h3")), "影响力指标");
  assert.equal(flat(doc.querySelector("#article--impact--jumpToLink-citations")), "跳到引文");
  assert.equal(flat(doc.querySelector("#citedByCount")), "文章被引次数随时间变化");
  assert.equal(doc.querySelector("canvas").getAttribute("aria-label"), "被引图表");
  assert.match(flat(doc.querySelector("#scite-title")), /^scite\.ai 智能引文/);
  assert.match(flat(doc.querySelector(".small.regular i")), /探索引文语境/);
  assert.deepEqual([...doc.querySelectorAll("#scite-panel .col > div")].map(flat), ["支持", "提及", "对立"]);
  assert.equal(flat(doc.querySelector("#article-citations-header")), "文章引文");
  assert.equal(flat(doc.querySelector("#data .section-content")), "数据链接加载失败，请重新加载页面。");
});

test("r29 模板：scite 说明句保留原链接节点", () => {
  const { doc } = boot(IMPACT + EXTRAS);
  const box = doc.querySelector(".popper .content.small");
  const link = box.querySelector("a");
  assert.ok(link, "模板替换后链接节点必须还在");
  assert.equal(link.getAttribute("href"), "//scite.ai");
  assert.equal(flat(link), "scite.ai");
  const text = flat(box);
  assert.match(text, /的智能引文包含从引用文章全文中提取的引文语句/);
  assert.doesNotMatch(text, /include citation statements/);
  assert.match(text, /EuropePMC 给出的被引次数/);
});

test("r29 引擎：图表分区与作者展开、保存弹窗", () => {
  const { doc } = boot(IMPACT + EXTRAS);
  assert.equal(flat(doc.querySelector("#figures-and-tables h2")), "图（3）");
  assert.equal(flat(doc.querySelector(".figure-scroll-button .alt-text")), "查看更多图片");
  const caps = [...doc.querySelectorAll(".figures--figure-box .alt-text")].map(flat);
  assert.deepEqual(caps, ["（图 1）点击查看原图", "（图 2）点击查看原图"]);
  assert.equal(flat(doc.querySelector(".metadata--author-showall-link")), "[显示全部 21]");
  assert.equal(flat(doc.querySelector(".modal h3")), "加入列表");
  assert.match(flat(doc.querySelector(".modal p")), /请登录后保存，并接收新结果的邮件提醒。/);
});

test("r29 不误翻：题录、作者、摘要、编号保持原文", () => {
  const { doc } = boot(IMPACT + EXTRAS);
  assert.equal(flat(doc.querySelector("#article--current--title")), "ENCODE data in the UCSC Genome Browser: year 5 update.");
  assert.equal(flat(doc.querySelector(".metadata--author-name")), "Rosenbloom KR");
  assert.equal(flat(doc.querySelector("#article--pmcid")), "PMCID: PMC3531152");
  assert.match(flat(doc.querySelector("#article--abstract--content")), /^The Encyclopedia of DNA Elements/);
  // 数字与 scite 计数保持原样
  assert.match(flat(doc.querySelector("#article--impact--subItem-citedByCount")), /682/);
});