// Ensembl Genomes 门户（dict/ensemblgenomes.json）回归：页头标语、首页检索框与「Go」按钮、
// 博客入口、新版站点指引、五个分类门户入口按钮、页脚署名、Cookie 提示条（两条链接模板）、
// 检索页的分类群下拉与结果字段标签、「N results for」计数规则、分页 first/last、404 页。
// 必须保持英文：物种名/拉丁名、装配名、产品名（EnsemblPlants 等）、登录号与基因描述正文。
// 取证：Chrome 影子实例 CDP 9227 抓的真实 DOM（https://ensemblgenomes.org/ 与其 /search/、404 页，2026-11-26）
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
const book = read("ensemblgenomes.json");
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8"));
const site = sites.sites.find((s) => s.id === "ensemblgenomes");
const defaults = sites.defaults || {};

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;
const U = "https://ensemblgenomes.org/";

// 站点词库栈：sites.json 里登记的那几册 + 本册（lead 接线后 Set 会去重，两种状态都成立）
const stack = [...new Set((site.dicts || ["common"]).concat("ensemblgenomes"))];
const data = { exact: {}, rules: [], templates: [] };
for (const id of stack) {
  const p = path.join(root, "../dict", id + ".json");
  if (!fs.existsSync(p)) continue;
  const d = JSON.parse(fs.readFileSync(p, "utf8"));
  Object.assign(data.exact, d.exact || {});
  data.rules = data.rules.concat(d.rules || []);
  data.templates = data.templates.concat(d.templates || []);
}

const cfg = {
  scope: site.scope || "",
  block: defaults.block || "",
  attrs: [...(defaults.attrs || []), ...(site.attrs || [])],
  funcWords: site.funcWords !== false,
  proseGuard: site.proseGuard !== false,
  proseMax: site.proseMax || 120,
  proseExempt: site.proseExempt || "",
  rescan: false
};

function engineFor(doc, win) {
  const engine = createEngine({ document: doc, window: win, data, site: cfg });
  engine.start();
  return engine;
}
function run(html) {
  const dom = new JSDOM('<div id="wrap">' + html + "</div>", { url: U });
  engineFor(dom.window.document, dom.window);
  return dom.window.document;
}
const text = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : null);

test("词库结构：family/sites、条数、键值形态、规则锚定、模板槽位连续", () => {
  assert.equal(book.meta.family, "ensembl");
  assert.ok(book.meta.sites.includes("ensemblgenomes.org"));
  assert.ok(book.meta.area.length > 0 && book.meta.note.length > 0, "meta 说明要有内容");
  const keys = Object.keys(book.exact);
  assert.ok(keys.length >= 30, "exact 只有 " + keys.length + " 条");
  assert.ok(book.rules.length >= 1, "rules 太少");
  assert.ok(book.templates.length >= 3, "templates 太少");

  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(!CJK.test(k), "键里不能有中文: " + k);
    assert.ok(CJK.test(v), "译文里必须有中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "键首尾不能有空白: " + JSON.stringify(k));
    assert.equal(v, v.trim(), "值首尾不能有空白: " + JSON.stringify(k));
    assert.ok(!/https?:\/\/|@[\w.-]+\.\w+/.test(v), "译文里不能有 URL/邮箱: " + k);
  }
  for (const r of book.rules) {
    assert.doesNotThrow(() => new RegExp(r.re), "坏正则: " + r.re);
    assert.ok(/^\^/.test(r.re) && /\$$/.test(r.re), "规则要锚定: " + r.re);
    assert.ok(CJK.test(r.to), "规则译文里必须有中文: " + r.re);
    if (/\([^?]/.test(r.re)) assert.ok(/\$\d/.test(r.to), "带捕获组的规则要用到占位符: " + r.re);
  }
  for (const t of book.templates) {
    const used = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.ok(used.length >= 1, "模板要带槽位: " + t.pat.slice(0, 40));
    const sorted = used.slice().sort((a, b) => a - b);
    sorted.forEach((n, i) => assert.equal(n, i + 1, "槽位必须从 1 连续: " + t.pat.slice(0, 40)));
    const zhUsed = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.deepEqual(zhUsed.slice().sort((a, b) => a - b), sorted, "译文槽位要与原文一致");
    assert.ok(t.pat.length >= 20, "模板原文太短（引擎不接受 <20 字符）");
    assert.ok(!CJK.test(t.pat), "模板原文里不能有汉字: " + t.pat.slice(0, 40));
  }
});

const HEAD =
  '<header><div class="header__inner">' +
  '<a href="/"><img class="header__logo" src="/images/logos/eg-logo.png" alt="ensembl logo"/></a>' +
  '<span class="header__middle">' +
  "Providing genome data for non-vertebrate species, with tools for the manipulation, analysis and visualisation of that data" +
  "</span>" +
  '<span class="header__right"><a href="https://www.ensembl.info/contact-us/">Contact us</a></span>' +
  "</div></header>";

test("页头：标语整句翻，Contact us 走站点词库栈，logo alt 翻", () => {
  const doc = run(HEAD);
  assert.equal(
    text(doc.querySelector(".header__middle")),
    "为非脊椎动物物种提供基因组数据，以及处理、分析与可视化这些数据的工具"
  );
  assert.equal(text(doc.querySelector(".header__right a")), "联系我们");
  assert.equal(doc.querySelector(".header__logo").getAttribute("alt"), "Ensembl 标志");
});

const TOPGRID =
  '<div class="home-top-grid">' +
  '<div class="home__blog-panel"><img class="home__blog-panel-image" src="/images/icons/blog.svg" alt="ensembl blog"/>' +
  '<a href="https://www.ensembl.info" target="_blank" rel="noreferrer">Latest release notes, updates &amp; news from our blog</a></div>' +
  '<div class="home__search-panel"><form action="/search/" method="get">' +
  '<label for="search-field">Search all genomes</label>' +
  '<input id="search-field" class="home__search-field" name="query" />' +
  '<button class="home__goto-search-button" type="submit">Go</button>' +
  "</form></div></div>";

test("首页检索框：label 与「Go」按钮翻，action 与 name 不动", () => {
  const doc = run(TOPGRID);
  assert.equal(text(doc.querySelector(".home__search-panel label")), "检索全部基因组");
  assert.equal(text(doc.querySelector("button")), "检索");
  assert.equal(doc.querySelector("form").getAttribute("action"), "/search/");
  assert.equal(doc.querySelector("input").getAttribute("name"), "query");
  assert.equal(text(doc.querySelector(".home__blog-panel a")), "博客上的最新发布说明、更新与新闻");
  assert.equal(doc.querySelector(".home__blog-panel img").getAttribute("alt"), "Ensembl 博客");
});

const NEWPANEL =
  '<div class="home__new-website-panel"><div class="home__new-website-panel-body">' +
  '<div class="home__new-website-panel-body-content">' +
  "<p>This is the new home for genome data from across the tree of life, all in one platform</p>" +
  '<ul class="home__new-website-panel-species-list">' +
  '<li><div class="home__new-website-panel-species-label"><a href="https://www.ensembl.org/genome/GCA_900519105.1">Bread wheat</a><span>IWGSC</span></div></li>' +
  '<li><div class="home__new-website-panel-species-label"><a href="https://www.ensembl.org/genome/GCA_000002985.3">Caenorhabditis elegans</a><span>WBcel235</span></div></li>' +
  '<li><div class="home__new-website-panel-species-label"><a href="https://www.ensembl.org/genome/GCA_000146045.2">Baker’s yeast</a><span>R64-1-1</span></div></li>' +
  "</ul></div>" +
  '<a class="home__panel-goto-button" href="https://ensembl.org">Go to the new Ensembl site</a>' +
  "</div></div>";

test("新版站点面板：说明句与按钮翻，物种名/装配名保持英文", () => {
  const doc = run(NEWPANEL);
  assert.equal(
    text(doc.querySelector(".home__new-website-panel-body-content p")),
    "这里是生命之树各分支基因组数据的新家，全部汇集于一个平台"
  );
  assert.equal(text(doc.querySelector(".home__panel-goto-button")), "前往新版 Ensembl 站点");
  assert.deepEqual(
    [...doc.querySelectorAll(".home__new-website-panel-species-label a")].map((e) => text(e)),
    ["Bread wheat", "Caenorhabditis elegans", "Baker’s yeast"]
  );
  assert.deepEqual(
    [...doc.querySelectorAll(".home__new-website-panel-species-label span")].map((e) => text(e)),
    ["IWGSC", "WBcel235", "R64-1-1"]
  );
});

const DIVISION =
  '<div class="home__division-panel home__division-panel_plants">' +
  '<div class="home__division-panel-logo-container">' +
  '<img src="/images/favicons/android-chrome-192x192.png" alt="ensembl logo" />' +
  '<div class="home__division-panel-logo-text home__division-panel-logo-text_plants">EnsemblPlants</div></div>' +
  '<div class="home__division-panel-species-container"><div class="home__panel-species">' +
  '<div class="home__panel-species-info"><div class="home__panel-species-name">' +
  '<a href="https://plants.ensembl.org/Triticum_aestivum/Info/Index">Triticum aestivum</a></div>' +
  '<div class="home__panel-species-assembly">IWGSC</div></div></div></div>' +
  '<a class="home__panel-goto-button home__panel-goto-button_plants" href="https://plants.ensembl.org">Go to Ensembl Plants</a>' +
  "</div>";

test("分类门户面板：入口按钮翻，产品名与拉丁名/装配名保持英文", () => {
  const doc = run(DIVISION);
  assert.equal(text(doc.querySelector(".home__division-panel-logo-text")), "EnsemblPlants", "产品名不翻");
  assert.equal(text(doc.querySelector(".home__panel-species-name a")), "Triticum aestivum", "拉丁名不翻");
  assert.equal(text(doc.querySelector(".home__panel-species-assembly")), "IWGSC", "装配名不翻");
  assert.equal(text(doc.querySelector(".home__panel-goto-button")), "前往 Ensembl Plants");
});

test("五个分类门户入口按钮：各自的品牌名保持原样", () => {
  const doc = run(
    ["Bacteria", "Fungi", "Metazoa", "Plants", "Protists"]
      .map(
        (d) =>
          '<a class="home__panel-goto-button" href="https://' +
          d.toLowerCase() +
          '.ensembl.org">Go to Ensembl ' +
          d +
          "</a>"
      )
      .join("")
  );
  assert.deepEqual(
    [...doc.querySelectorAll(".home__panel-goto-button")].map((e) => text(e)),
    ["前往 Ensembl Bacteria", "前往 Ensembl Fungi", "前往 Ensembl Metazoa", "前往 Ensembl Plants", "前往 Ensembl Protists"]
  );
});

test("页脚署名：模板把 EMBL-EBI 链接原样放回", () => {
  const doc = run(
    '<footer><div class="footer__left">' +
      '<img class="footer__embl-ebi-logo" src="/images/logos/EMBL_EBI_Logo_black.svg" alt="embl-ebi logo"/>' +
      '<span>Ensembl Genomes is developed by <a href="https://www.ebi.ac.uk">EMBL-EBI</a></span>' +
      '</div><div class="footer__right"><img class="footer__elixir-logo" src="/images/logos/elixir.png" alt="elixir logo"/></div></footer>'
  );
  const footer = doc.querySelector("footer");
  assert.equal(text(footer.querySelector(".footer__left span")), "Ensembl Genomes 由 EMBL-EBI 开发");
  const a = footer.querySelector(".footer__left a");
  assert.equal(text(a), "EMBL-EBI", "机构名不翻");
  assert.equal(a.getAttribute("href"), "https://www.ebi.ac.uk");
  assert.equal(footer.querySelector(".footer__embl-ebi-logo").getAttribute("alt"), "EMBL-EBI 标志");
  assert.equal(footer.querySelector(".footer__elixir-logo").getAttribute("alt"), "ELIXIR 标志");
});

test("Cookie 提示条：整段模板，两条链接（隐私政策/使用条款）与「and」合并成「和」", () => {
  const doc = run(
    '<div class="cookie-banner"><div class="cookie-banner__message"><span>' +
      "This website requires cookies in order to function. By using the site you are agreeing to this as outlined in our" +
      ' <a target="_blank" href="https://www.ebi.ac.uk/data-protection/ensembl/privacy-notice">Privacy Policy</a>' +
      " and" +
      ' <a target="_blank" href="https://www.ebi.ac.uk/about/terms-of-use">Terms of Use</a>.' +
      "</span></div>" +
      '<div class="cookie-banner__button-container"><button class="cookie-banner__button">I agree</button></div></div>'
  );
  const span = doc.querySelector(".cookie-banner__message span");
  assert.equal(
    text(span),
    "本网站需要 Cookie 才能正常运行。使用本网站即表示你同意我们隐私政策和使用条款中所述的做法。"
  );
  const links = [...span.querySelectorAll("a")];
  assert.equal(links.length, 2, "两条链接都要保留");
  assert.deepEqual(links.map((e) => text(e)), ["隐私政策", "使用条款"]);
  assert.equal(links[0].getAttribute("href"), "https://www.ebi.ac.uk/data-protection/ensembl/privacy-notice");
  assert.equal(links[1].getAttribute("href"), "https://www.ebi.ac.uk/about/terms-of-use");
  assert.equal(text(doc.querySelector(".cookie-banner__button")), "我同意");
});

const SEARCHTOP =
  '<div class="top-grid"><div class="search-panel"><form>' +
  '<label for="search-field" class="search-field__label">Search all genomes</label>' +
  '<input id="search-field" class="search-field__input" name="query" />' +
  '<button class="search-field__button" type="submit">Search</button>' +
  "</form></div>" +
  '<div class="divisions-filter"><label for="divisions">Search in division</label>' +
  '<select id="divisions"><option value="">All</option>' +
  '<option value="bacteria">Bacteria</option><option value="fungi">Fungi</option>' +
  '<option value="metazoa">Metazoa</option><option value="plants">Plants</option>' +
  '<option value="protists">Protists</option></select></div>' +
  '<div class="hit-count">81301 results for "yeast"</div></div>';

test("检索页顶部：分类群下拉文字翻、value 不动，计数规则走单复数", () => {
  const doc = run(SEARCHTOP);
  assert.equal(text(doc.querySelector(".search-field__label")), "检索全部基因组");
  assert.equal(text(doc.querySelector(".search-field__button")), "检索");
  assert.equal(text(doc.querySelector(".divisions-filter label")), "在分类群中检索");
  const opts = [...doc.querySelectorAll("#divisions option")];
  assert.deepEqual(opts.map((e) => text(e)), ["全部", "细菌", "真菌", "后生动物", "植物", "原生生物"]);
  assert.deepEqual(opts.map((e) => e.getAttribute("value")), ["", "bacteria", "fungi", "metazoa", "plants", "protists"]);
  // 计数：results/result 单复数都收敛到「条结果」，检索词原样保留在引号里
  assert.equal(text(doc.querySelector(".hit-count")), '81301 条结果："yeast"');
  const one = run('<div class="hit-count">1 result for "kinase"</div>');
  assert.equal(text(one.querySelector(".hit-count")), '1 条结果："kinase"');
});

test("检索页：选中的分类群回填到 label（URL 参数是小写）", () => {
  const doc = run(
    '<div class="search-panel"><form><label for="search-field" class="search-field__label">Search fungi</label></form></div>' +
      '<div class="search-panel"><form><label for="search-field" class="search-field__label">Search protists</label></form></div>'
  );
  assert.deepEqual(
    [...doc.querySelectorAll(".search-field__label")].map((e) => text(e)),
    ["检索真菌", "检索原生生物"]
  );
});

test("检索结果条目：字段标签与转录本/肽段标签翻，基因 ID/物种/位置/描述保持英文", () => {
  const doc = run(
    '<div class="search-result-item">' +
      '<div class="search-result-item__header">' +
      '<span class="search-result-item__header-section">Transcripts: <a href="https://protists.ensembl.org/x/Transcript/Summary?g=EAA21353">EAA21353</a></span>' +
      '<span class="search-result-item__header-section">Peptides: <a href="https://protists.ensembl.org/x/Transcript/ProteinSummary?g=EAA21353">EAA21353</a></span>' +
      "</div>" +
      '<div class="search-result-item__body">' +
      '<span class="search-result-item__label">Gene ID</span><span><a href="https://protists.ensembl.org/x/Gene/Summary?g=EAA21353">EAA21353</a></span>' +
      '<span class="search-result-item__label">Description</span><span>similar to yeast ncl1-related</span>' +
      '<span class="search-result-item__label">Species</span><span><a href="https://protists.ensembl.org/Plasmodium_yoelii_yoelii/Info/Index">Plasmodium yoelii yoelii str. 17XNL (GCA_000003085.2)</a></span>' +
      '<span class="search-result-item__label">Location</span><span><a href="https://protists.ensembl.org/Plasmodium_yoelii_yoelii/Info/Index">MALPY00533:17070-20549</a></span>' +
      "</div></div>"
  );
  assert.deepEqual(
    [...doc.querySelectorAll(".search-result-item__header-section")].map((e) => text(e)),
    ["转录本： EAA21353", "肽段： EAA21353"]
  );
  assert.deepEqual(
    [...doc.querySelectorAll(".search-result-item__label")].map((e) => text(e)),
    ["基因 ID", "描述", "物种", "位置"]
  );
  const body = [...doc.querySelectorAll(".search-result-item__body span")].map((e) => text(e));
  assert.ok(body.includes("EAA21353"), "登录号不翻");
  assert.ok(body.includes("similar to yeast ncl1-related"), "基因描述是数据，不翻");
  assert.ok(body.includes("MALPY00533:17070-20549"), "位置串不翻");
});

test("检索页分页：first/last 翻，页码与链接原样", () => {
  const doc = run(
    '<div class="pager">' +
      '<a class="pager__page" href="?page=1">« first</a>' +
      '<span class="pager__spanner">...</span>' +
      '<span class="pager__page pager__page_current">7</span>' +
      '<a class="pager__page" href="?page=8">8</a>' +
      '<span class="pager__spanner">...</span>' +
      '<a class="pager__page" href="?page=11">last »</a>' +
      "</div>"
  );
  const links = [...doc.querySelectorAll(".pager a")];
  assert.deepEqual(links.map((e) => text(e)), ["« 首页", "8", "末页 »"]);
  assert.deepEqual(links.map((e) => e.getAttribute("href")), ["?page=1", "?page=8", "?page=11"]);
  assert.equal(text(doc.querySelector(".pager__page_current")), "7");
});

test("404 页：标题与提示句走模板，Home page 链接保留", () => {
  const doc = run(
    "<main><h1>Page not found</h1>" +
      '<p>Please try a Search or go to the <a href="/">Home page</a></p></main>'
  );
  assert.equal(text(doc.querySelector("h1")), "页面未找到");
  const p = doc.querySelector("p");
  assert.equal(text(p), "请尝试检索，或返回首页");
  const a = p.querySelector("a");
  assert.equal(text(a), "首页");
  assert.equal(a.getAttribute("href"), "/");
});

test("文档标题也翻（站点脚本重渲染后仍按标题通道处理）", () => {
  const dom = new JSDOM(
    "<!doctype html><html><head><title>Page not found</title></head><body><main><h1>Page not found</h1></main></body></html>",
    { url: U }
  );
  engineFor(dom.window.document, dom.window);
  assert.equal(dom.window.document.title, "页面未找到");
});

test("不许翻的清单：品牌首页标题、整段基因描述、产品名与登录号", () => {
  const doc = run(
    "<main>" +
      '<div class="home__division-panel-logo-text home__division-panel-logo-text_bacteria">EnsemblBacteria</div>' +
      '<span class="search-result-item__label">Yeast KTI12 Protein</span>' +
      '<span>hypothetical protein, yeast conserved</span>' +
      '<a href="https://bacteria.ensembl.org/x">Streptococcus pneumoniae</a>' +
      "</main>"
  );
  assert.equal(text(doc.querySelector(".home__division-panel-logo-text")), "EnsemblBacteria");
  assert.equal(text(doc.querySelector(".search-result-item__label")), "Yeast KTI12 Protein");
  assert.equal(text(doc.querySelectorAll("span")[1]), "hypothetical protein, yeast conserved");
  assert.equal(text(doc.querySelector("a")), "Streptococcus pneumoniae");
});
