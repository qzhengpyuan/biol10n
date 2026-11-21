// NCBI PMC 首页与检索页骨架词库（dict/pmc-home.json）冒烟测试
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/pmc-home.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "ncbi-pmc");

const CJK = /[\u4e00-\u9fff]/;
const URL_RE = /https?:\/\//i;
const MAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/;

function engineFor(html, url) {
  const dom = new JSDOM(html, { url: url || "https://pmc.ncbi.nlm.nih.gov/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: dict.exact, rules: dict.rules, templates: dict.templates || [] },
    site
  });
  engine.start();
  return { doc: dom.window.document, engine };
}

function textOf(html, selector) {
  const { doc } = engineFor(html);
  const el = doc.querySelector(selector);
  return el ? el.textContent.replace(/\s+/g, " ").trim() : "";
}

// ---- 结构 ----

test("站点存在且词库元信息正确", () => {
  assert.ok(site, "config/sites.json 里没有 ncbi-pmc");
  assert.equal(dict.meta.family, "pmc-home");
  assert.ok(dict.meta.sites.includes("pmc.ncbi.nlm.nih.gov"));
  assert.ok(Array.isArray(dict.rules) && dict.rules.length >= 4);
  assert.ok(Array.isArray(dict.templates) && dict.templates.length >= 3);
});

test("exact 条目够用，译文都含汉字", () => {
  const keys = Object.keys(dict.exact);
  assert.ok(keys.length >= 40, "exact 只有 " + keys.length + " 条");
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.ok(k.length > 0, "空 key");
    assert.match(v, CJK, "译文不含汉字: " + k + " => " + v);
  }
  for (const r of dict.rules) assert.match(r.to, CJK, "规则译文不含汉字: " + r.re);
});

test("条目卫生：key 无中文，值无明文 URL/邮箱，首尾无空白", () => {
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.doesNotMatch(k, CJK, "key 含中文: " + k);
    assert.doesNotMatch(v, URL_RE, "值含明文 URL: " + k);
    assert.doesNotMatch(v, MAIL_RE, "值含明文邮箱: " + k);
    assert.equal(k, k.trim(), "key 首尾有空白: " + JSON.stringify(k));
    assert.equal(v, v.trim(), "值首尾有空白: " + k);
  }
});

test("规则：正则可编译、$1 有对应捕获组、去重", () => {
  const seen = new Set();
  for (const r of dict.rules) {
    assert.doesNotThrow(() => new RegExp(r.re), "正则坏掉: " + r.re);
    assert.ok(!seen.has(r.re), "规则重复: " + r.re);
    seen.add(r.re);
    assert.doesNotMatch(r.re, CJK, "正则里含中文: " + r.re);
    const refs = (r.to.match(/\$(\d)/g) || []).map((x) => Number(x.slice(1)));
    if (!refs.length) continue;
    const groupCount = new RegExp("|" + r.re).exec("").length - 1;
    for (const n of refs) assert.ok(n <= groupCount, "缺捕获组 $" + n + ": " + r.re);
  }
});

test("模板：pat 长度合规、槽位从 1 连续、zh 占位符与槽位数一致", () => {
  const seen = new Set();
  for (const t of dict.templates) {
    assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, "pat 长度不合规(" + t.pat.length + "): " + t.pat.slice(0, 40));
    assert.doesNotMatch(t.pat, CJK, "pat 含中文: " + t.pat.slice(0, 40));
    assert.ok(!seen.has(t.pat), "模板重复: " + t.pat.slice(0, 40));
    seen.add(t.pat);
    const slots = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.ok(slots.length >= 1, "模板没有槽位: " + t.pat.slice(0, 40));
    assert.deepEqual(slots, slots.map((_, i) => i + 1), "pat 槽位不是 1..N: " + t.pat.slice(0, 40));
    const zhSlots = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.deepEqual(zhSlots, slots, "zh 占位符与 pat 槽位不一致: " + t.pat.slice(0, 40));
    assert.match(t.zh, CJK, "模板译文不含汉字: " + t.pat.slice(0, 40));
    assert.doesNotMatch(t.zh, URL_RE, "模板译文含明文 URL: " + t.pat.slice(0, 40));
  }
});

// ---- 关键条目 ----

test("首页卡片与说明句都在", () => {
  const must = [
    "About PMC",
    "For Authors",
    "For Publishers",
    "For Developers",
    "Discover a digital archive of scholarly articles, spanning centuries of scientific research.",
    "Learn how to find and read articles of interest to you.",
    "Browse the PMC Journal List or learn about some of PMC's unique collections.",
    "Navigate the PMC submission methods to comply with a funder mandate, expand access, and ensure preservation.",
    "Learn about deposit options for journals and publishers and the PMC selection process.",
    "Find tools for bulk download, text mining, and other machine analysis.",
    "Content provided in part by:",
    "Journals deposit the complete contents of each issue or volume.",
    "Journals deposit all NIH-funded articles as defined by the NIH Public Access Policy.",
    "Publisher deposits a subset of articles from a collection of journals."
  ];
  for (const k of must) assert.ok(k in dict.exact, "缺少条目: " + k);
});

test("New in PMC 与 HIGHLIGHTS 条目都在", () => {
  const must = [
    "New in PMC",
    "Collections and Saved Search features added to PMC Search",
    "Changes to PMC's Article Dataset Distribution Services Complete",
    "highlights"
  ];
  for (const k of must) assert.ok(k in dict.exact, "缺少条目: " + k);
});

test("检索页骨架条目都在", () => {
  const must = [
    "Publication stage",
    "NIH Preprint Pilot",
    "Published journal article",
    "Author manuscript",
    "PMC Open Access Subset",
    "Historical back issues",
    "Biomedical Journal Digitization Projects",
    "View Search Details",
    "Embargoed Articles:",
    "Include",
    "Enter a search in the search field to view results.",
    "Select custom date range",
    "Save results to a file",
    "PMCID List"
  ];
  for (const k of must) assert.ok(k in dict.exact, "缺少条目: " + k);
});

test("不翻的类别确实没收录", () => {
  const banned = ["PubMed", "PMCID", "CSV", "NLM", "NIH", "HHS", "USA.gov", "RefSeq", "ClinVar"];
  for (const k of banned) assert.ok(!(k in dict.exact), "不该收录品牌/缩写: " + k);
});

// ---- 实际渲染 ----

test("首页数字句整句变中文（数字被 span 切开也要处理）", () => {
  const html = '<h2 class="font-body-xl"><span class="text-uppercase">12.6 million</span> articles are archived in PMC.</h2>';
  const got = textOf(html, "h2");
  assert.equal(got, "PMC 已归档 1260 万篇文章。");
  assert.doesNotMatch(got, /million/i);
});

test("首页数字句：数字变化时走规则保底", () => {
  const html = '<h2 class="font-body-xl"><span class="text-uppercase">13.1 million</span> articles are archived in PMC.</h2>';
  const got = textOf(html, "h2");
  assert.match(got, /13\.1 百万篇/, "规则没兜住: " + got);
});

test("卡片数字标题走规则，$1 保留数字", () => {
  const cases = [
    ["3038 Full Participation Journals", "3038 完全参与期刊"],
    ["248 NIH Portfolio Journals", "248 NIH 组合期刊"],
    ["44 Selective Deposit Programs", "44 选择性存缴项目"]
  ];
  for (const [src, want] of cases) {
    const got = textOf('<p class="font-sans-lg text-normal">' + src + "</p>", "p");
    assert.equal(got, want, src);
  }
});

test("首页简介段模板：<sup>®</sup> 保留，句子整段中文", () => {
  const html =
    '<div class="pmc-hero__text"><p class="margin-0">PubMed Central<sup>&reg;</sup> (PMC) is a free full-text archive of biomedical and life sciences journal literature at the U.S. National Institutes of Health\'s National Library of Medicine (NIH/NLM)</p></div>';
  const { doc } = engineFor(html);
  const p = doc.querySelector("p");
  assert.match(p.textContent, /免费提供的生物医学与生命科学期刊文献全文档案/);
  assert.ok(p.querySelector("sup"), "模板把 <sup>®</sup> 弄丢了");
  assert.equal(p.querySelector("sup").textContent, "®");
});

test("Cloud 文档段模板：链接保留、译文不含明文 URL", () => {
  const html =
    '<p>Full documentation of the updated Cloud service is available at: <a href="tools/pmcaws/">https://pmc.ncbi.nlm.nih.gov/tools/pmcaws/</a></p>';
  const { doc } = engineFor(html);
  const p = doc.querySelector("p");
  assert.match(p.textContent, /更新后云服务的完整文档见：/);
  const a = p.querySelector("a");
  assert.ok(a, "链接丢了");
  assert.equal(a.getAttribute("href"), "tools/pmcaws/");
});

test("检索页筛选骨架变中文", () => {
  const html =
    '<div><span class="text-uppercase text-gray-70">Publication stage</span>' +
    '<label class="usa-checkbox__label">Published journal article</label>' +
    '<label class="usa-checkbox__label">Author manuscript</label>' +
    '<label class="usa-checkbox__label">Historical back issues</label>' +
    '<button class="usa-accordion__button search-details">View Search Details</button>' +
    '<div class="margin-0 text-bold">Embargoed Articles:</div></div>';
  const { doc } = engineFor(html);
  const text = doc.body.textContent.replace(/\s+/g, " ");
  for (const want of ["出版阶段", "已发表期刊文章", "作者手稿", "历史回溯期刊", "查看检索详情", "禁运期文章："]) {
    assert.ok(text.includes(want), "缺译文: " + want + " / 实际: " + text);
  }
});

test("检索页保存/日期弹窗文案变中文（含 $1 数字规则）", () => {
  const html =
    '<div><h2 class="usa-modal__heading">Save results to a file</h2>' +
    '<label class="usa-label">Results Selection:</label>' +
    '<div class="save-all-limit-warning">Only the first 10,000 items will be saved in your file</div>' +
    '<h2 class="usa-modal__heading">Select custom date range</h2></div>';
  const { doc } = engineFor(html);
  const text = doc.body.textContent.replace(/\s+/g, " ");
  for (const want of ["将结果保存到文件", "结果选择：", "文件中只保存前 10,000 条", "选择自定义日期范围"]) {
    assert.ok(text.includes(want), "缺译文: " + want + " / 实际: " + text);
  }
});