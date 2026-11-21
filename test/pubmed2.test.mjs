import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/pubmed2.json"), "utf8"));
const exact = dict.exact || {};
const rules = dict.rules || [];
const templates = dict.templates || [];
const entries = Object.entries(exact);

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;
const URL_RE = /(https?:\/\/|www\.)/i;
const MAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/;

const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();

// pubmed 站点在 config/sites.json 里的实际配置（scope 之外只取影响翻译判定的字段）
const SITE = {
  scope: "main, .site-content, .usa-skipnav, .no-session-banner, .no-script-banner, aside.page-sidebar, #article-page-header, #article-top-actions-bar",
  block: "pre, code, kbd, samp, textarea, [contenteditable='true'], .highlight, .blob-code, .code",
  attrs: ["placeholder", "title", "aria-label", "alt", "value"],
  skip: ".docsum-title, h1.heading-title",
  proseGuard: true,
  proseMax: 120,
  proseExempt: ".usa-banner, .usa-media_block-body, [class*=disclaimer]"
};

function boot(html) {
  const dom = new JSDOM(html, { url: "https://pubmed.ncbi.nlm.nih.gov/?term=breast+cancer" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact, rules, templates },
    site: SITE
  });
  engine.start();
  return { dom, engine, doc: dom.window.document };
}

test("pubmed2：结构合法，三张表都在", () => {
  assert.ok(dict.meta && Array.isArray(dict.meta.sites), "缺少 meta.sites");
  assert.ok(dict.meta.sites.includes("pubmed.ncbi.nlm.nih.gov"), "meta.sites 必须含 PubMed 主机");
  assert.equal(typeof exact, "object");
  assert.ok(Array.isArray(rules));
  assert.ok(Array.isArray(templates));
  assert.ok(entries.length >= 20, "词条太少: " + entries.length);
  assert.ok(rules.length >= 3, "规则太少: " + rules.length);
  assert.ok(templates.length >= 1, "缺少模板条");
});

test("pubmed2：键是规整英文，值是非空中文，且不含明文 URL/邮箱", () => {
  const bad = [];
  for (const [en, zh] of entries) {
    if (!en || en !== en.trim()) bad.push("键首尾空白: " + JSON.stringify(en));
    if (CJK.test(en)) bad.push("键含中文: " + en);
    if (!/^[\x20-\x7e\u00a0-\u024f\u2000-\u27ff]+$/.test(en)) bad.push("键含可疑字符: " + en);
    if (typeof zh !== "string" || !zh || zh !== zh.trim()) bad.push("空译文: " + en);
    if (!CJK.test(zh) && !/^[A-Za-z0-9 ]+：$/.test(zh)) bad.push("译文没有中文: " + en + " => " + zh);
    if (URL_RE.test(zh)) bad.push("译文含明文 URL: " + en);
    if (MAIL_RE.test(zh)) bad.push("译文含邮箱: " + en);
    if (zh === en) bad.push("自映射: " + en);
  }
  assert.deepEqual(bad.slice(0, 10), []);
});

test("pubmed2：规则可编译、锚定、译文保留捕获组", () => {
  const bad = [];
  for (const r of rules) {
    let re = null;
    try { re = new RegExp(r.re); } catch (e) { bad.push("非法正则: " + r.re); continue; }
    if (!r.re.startsWith("^") || !r.re.endsWith("$")) bad.push("正则未锚定: " + r.re);
    if (!r.to || !CJK.test(r.to)) bad.push("规则译文缺中文: " + r.re);
    if (URL_RE.test(r.to) || MAIL_RE.test(r.to)) bad.push("规则译文含 URL/邮箱: " + r.re);
    const groups = (r.re.match(/\(\?<|\((?!\?)/g) || []).length;
    if (groups > 0 && !/\$1/.test(r.to)) bad.push("有捕获组但译文没用 $1: " + r.re);
    assert.ok(re);
  }
  assert.deepEqual(bad, []);
});

test("pubmed2：模板占位符 1..N 一一对应，长度合规", () => {
  const bad = [];
  for (const t of templates) {
    if (!t.pat || !t.zh) { bad.push("模板缺 pat/zh"); continue; }
    if (t.pat.length < 20 || t.pat.length > 2200) bad.push("pat 长度越界: " + t.pat.length);
    if (CJK.test(t.pat)) bad.push("pat 含中文: " + t.pat.slice(0, 40));
    const slots = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
    const used = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
    if (!slots.length) bad.push("pat 没有占位符: " + t.pat.slice(0, 40));
    assert.deepEqual(slots, Array.from({ length: slots.length }, (_, i) => i + 1));
    assert.deepEqual(used, slots);
    if (!CJK.test(t.zh)) bad.push("zh 没有中文: " + t.pat.slice(0, 40));
    if (URL_RE.test(t.zh) || MAIL_RE.test(t.zh)) bad.push("zh 含 URL/邮箱");
  }
  assert.deepEqual(bad, []);
});

test("pubmed2：每条 exact 都能在实际页面上命中（逐条渲染）", () => {
  const miss = [];
  for (const [en, zh] of entries) {
    const { doc, dom } = boot("<p>" + en.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</p>");
    const got = doc.querySelector("p").textContent.replace(/\s+/g, " ").trim();
    if (got !== zh) miss.push(JSON.stringify(en) + " => " + JSON.stringify(got) + "（期望 " + JSON.stringify(zh) + "）");
    dom.window.close();
  }
  assert.deepEqual(miss, []);
});

test("pubmed2：结果页无结果提示与筛选条命中", () => {
  const html = [
    '<main><h3>No results were found.</h3>',
    '<div class="usa-alert-text">Your search was processed without automatic term mapping because it retrieved zero results.</div>',
    '<div class="usa-alert-text">The following terms were ignored: zzzqqqxxyy, nosuchterm12345</div>',
    '<div class="confirm-reset-filters-text">Filters on the sidebar will be reset to the default list and any currently applied filters will be cleared.</div>',
    '<p class="usa-sr-only">Table representation of search results timeline featuring number of search results per year.</p>',
    '<span class="filter-titles">Review, Free full text</span></main>'
  ].join("");
  const { doc, dom } = boot(html);
  assert.equal(doc.querySelector("h3").textContent, "未找到结果。");
  const alerts = doc.querySelectorAll(".usa-alert-text");
  assert.equal(alerts[0].textContent, "由于检索结果为零，本次检索未进行自动词条映射。");
  assert.equal(alerts[1].textContent, "以下检索词已被忽略：zzzqqqxxyy, nosuchterm12345", "被忽略的词条原样保留");
  assert.match(doc.querySelector(".confirm-reset-filters-text").textContent, /侧边栏的筛选条件将恢复为默认列表/);
  assert.match(doc.querySelector(".usa-sr-only").textContent, /以表格形式呈现检索结果时间线/);
  assert.equal(doc.querySelector(".filter-titles").textContent, "综述、免费全文");
  dom.window.close();
});

test("pubmed2：被引篇数与全部参考文献的计数规则", () => {
  const html = [
    '<main><ul><li class="citedby-count"><a>Cited by 290 articles</a></li>',
    "<li><a>Cited by 1 article</a></li>",
    "<li><a>Cited by 1,204 articles</a></li></ul>",
    '<button class="show-all">Show all 59 references</button>',
    '<button>Show all 1 reference</button></main>'
  ].join("");
  const { doc, dom } = boot(html);
  const links = doc.querySelectorAll("ul a");
  assert.equal(links[0].textContent, "被引 290 次");
  assert.equal(links[1].textContent, "被引 1 次");
  assert.equal(links[2].textContent, "被引 1,204 次");
  const btns = doc.querySelectorAll("button");
  assert.equal(btns[0].textContent, "显示全部 59 条参考文献");
  assert.equal(btns[1].textContent, "显示全部 1 条参考文献");
  dom.window.close();
});

test("pubmed2：文章页栏目标签与参考文献标题命中", () => {
  const html = [
    '<main><strong class="sub-title">Keywords:</strong>',
    '<span class="id-label">PMCID:</span>',
    '<h4 class="refs-list-title">REFERENCES</h4>',
    '<h3 class="title">Supplementary info</h3>',
    '<a class="details-link">Proceed to details</a>',
    '<a class="show-all-linked-articles">See all "Cited by" articles</a>',
    '<h3 class="linkout-category">Medical</h3>',
    '<strong>Warnings</strong><strong>Terms not found:</strong>',
    '<input placeholder="YYYY/MM/DD"></main>'
  ].join("");
  const { doc, dom } = boot(html);
  assert.equal(doc.querySelector(".sub-title").textContent, "Keywords:", "关键词标签受正文保护拦截，本册不收录");
  assert.equal(doc.querySelector(".id-label").textContent, "PMCID：");
  assert.equal(doc.querySelector(".refs-list-title").textContent, "参考文献");
  assert.equal(doc.querySelector("h3.title").textContent, "补充信息");
  assert.equal(doc.querySelector(".details-link").textContent, "前往详情");
  assert.equal(doc.querySelector(".show-all-linked-articles").textContent, "查看所有被引文献");
  assert.equal(doc.querySelector(".linkout-category").textContent, "医学");
  const strongs = doc.querySelectorAll("strong");
  assert.equal(strongs[strongs.length - 2].textContent, "警告");
  assert.equal(strongs[strongs.length - 1].textContent, "未找到的词条：");
  assert.equal(doc.querySelector("input").getAttribute("placeholder"), "YYYY/MM/DD", "日期占位符保持原样");
  dom.window.close();
});

test("pubmed2：预印本提示整段按模板译，链接节点与 href 原样保留", () => {
  const html = '<main><div class="usa-alert-text">The National Library of Medicine is <a href="https://pmc.ncbi.nlm.nih.gov/about/nihpreprints/">running a pilot</a> to include preprints that result from research funded by NIH in PMC and PubMed. </div>' +
    '<div class="usa-alert-text"><b>It has not yet been peer reviewed by a journal.</b></div>' +
    '<h3 class="usa-alert-heading">This is a preprint.</h3>' +
    '<a>Preprint notice</a><span class="preprint">[Preprint]</span></main>';
  const { doc, dom, engine } = boot(html);
  const alert = doc.querySelector(".usa-alert-text");
  assert.match(alert.textContent, /美国国家医学图书馆正在/, "整段模板应命中");
  assert.match(alert.textContent, /纳入 PMC 和 PubMed/);
  const a = alert.querySelector("a");
  assert.ok(a, "链接节点必须保留");
  assert.equal(a.getAttribute("href"), "https://pmc.ncbi.nlm.nih.gov/about/nihpreprints/");
  assert.equal(a.textContent, "开展试点", "链接文字随后单独译出");
  assert.equal(engine.stats.tpl, 1, "模板命中 1 次");
  assert.equal(doc.querySelectorAll(".usa-alert-text")[1].textContent, "尚未经过期刊同行评审。");
  assert.equal(doc.querySelector(".usa-alert-heading").textContent, "这是一篇预印本。");
  assert.equal(doc.querySelector(".preprint").textContent, "[预印本]");
  dom.window.close();
});

test("pubmed2：论文正文、期刊名、编号与机构名不动", () => {
  const html = [
    "<main>",
    "<p>Breast cancer is a heterogeneous disease in which genetic and environmental factors are involved, and stem cells are the main player.</p>",
    "<span>Mol Cell</span>",
    "<span>10.1016/j.molcel.2020.12.016</span>",
    "<span>PMID: 33417853</span>",
    "<span>Hematology/Medical Oncology, Cleveland Clinic, Cleveland, Ohio, USA.</span>",
    "<span>DP1 GM142101/GM/NIGMS NIH HHS/United States</span>",
    "<span>Breast Neoplasms* / mortality</span>",
    "<p>© 2024 The Authors. Journal of Surgical Oncology published by Wiley Periodicals LLC.</p>",
    "</main>"
  ].join("");
  const { doc, dom } = boot(html);
  const spans = doc.querySelectorAll("span");
  assert.equal(spans[0].textContent, "Mol Cell");
  assert.equal(spans[1].textContent, "10.1016/j.molcel.2020.12.016");
  assert.equal(spans[2].textContent, "PMID: 33417853");
  assert.match(spans[3].textContent, /^Hematology\/Medical Oncology/, "机构名整串不翻");
  assert.equal(spans[4].textContent, "DP1 GM142101/GM/NIGMS NIH HHS/United States");
  assert.equal(spans[5].textContent, "Breast Neoplasms* / mortality");
  assert.match(doc.querySelectorAll("p")[0].textContent, /^Breast cancer is a heterogeneous disease/, "正文段落保持英文");
  assert.match(doc.querySelectorAll("p")[1].textContent, /^\u00a9 2024 The Authors/, "版权声明不翻");
  dom.window.close();
});
