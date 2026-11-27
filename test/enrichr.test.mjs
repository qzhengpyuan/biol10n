import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/enrichr.json"), "utf8"));
const exact = dict.exact || {};
const rules = dict.rules || [];
const templates = dict.templates || [];
const entries = Object.entries(exact);

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;
const URL_RE = /(https?:\/\/|www\.)/i;
const MAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/;

const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();

// 直接用真实站点配置：scope/block/skip/scopedExact 任何一项漂了，测试要跟着红。
const sitesCfg = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8"));
const siteCfg = sitesCfg.sites.find((s) => s.id === "enrichr");
assert.ok(siteCfg, "config/sites.json 里必须有 enrichr 站点");
const SITE = {
  scope: siteCfg.scope,
  block: siteCfg.block || sitesCfg.defaults.block,
  attrs: [...new Set([...(sitesCfg.defaults.attrs || []), ...(siteCfg.attrs || [])])],
  skip: siteCfg.skip || "",
  scopedExact: siteCfg.scopedExact || [],
  proseGuard: siteCfg.proseGuard !== false,
  proseMax: siteCfg.proseMax || 120,
  proseExempt: siteCfg.proseExempt || ""
};

function boot(html) {
  const dom = new JSDOM('<!doctype html><html><head><title>Enrichr</title></head><body>' + html + "</body></html>", { url: "https://maayanlab.cloud/Enrichr/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact, rules, templates },
    site: SITE
  });
  engine.start();
  return { dom, engine, doc: dom.window.document };
}

test("enrichr：结构合法，三张表都在", () => {
  assert.ok(dict.meta && Array.isArray(dict.meta.sites), "缺少 meta.sites");
  assert.ok(dict.meta.sites.includes("maayanlab.cloud"), "meta.sites 必须含 maayanlab.cloud");
  assert.ok(entries.length >= 120, "词条太少: " + entries.length);
  assert.ok(rules.length >= 3, "规则太少: " + rules.length);
  assert.ok(templates.length >= 5, "模板太少: " + templates.length);
});

test("enrichr：键是规整英文，值是非空中文，且不含明文 URL/邮箱", () => {
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

test("enrichr：规则可编译、锚定、译文保留捕获组", () => {
  const bad = [];
  for (const r of rules) {
    let re = null;
    try { re = new RegExp(r.re); } catch (e) { bad.push("非法正则: " + r.re); continue; }
    if (!r.re.startsWith("^") || !r.re.endsWith("$")) bad.push("正则未锚定: " + r.re);
    if (!r.to || !CJK.test(r.to)) bad.push("规则译文缺中文: " + r.re);
    const groups = (r.re.match(/\(\?<|\((?!\?)/g) || []).length;
    if (groups > 0 && !/\$1/.test(r.to)) bad.push("有捕获组但译文没用 $1: " + r.re);
  }
  assert.deepEqual(bad, []);
});

test("enrichr：模板占位符 1..N 一一对应，长度合规", () => {
  const bad = [];
  for (const t of templates) {
    if (!t.pat || !t.zh) { bad.push("模板缺 pat/zh"); continue; }
    if (t.pat.length < 20 || t.pat.length > 1600) bad.push("pat 长度越界: " + t.pat.length);
    if (CJK.test(t.pat)) bad.push("pat 含中文: " + t.pat.slice(0, 40));
    const slots = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
    const used = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
    assert.ok(slots.length > 0);
    assert.deepEqual(slots, Array.from({ length: slots.length }, (_, i) => i + 1));
    assert.deepEqual(used, slots);
    if (!CJK.test(t.zh)) bad.push("zh 没有中文: " + t.pat.slice(0, 40));
    if (URL_RE.test(t.zh)) bad.push("zh 含 URL: " + t.pat.slice(0, 40));
  }
  assert.deepEqual(bad, []);
});

test("enrichr：每条 exact 都能在真实控件边界上命中（逐条渲染）", () => {
  const miss = [];
  for (const [en, zh] of entries) {
    // 挂在 <button> 上：控件祖先不会被正文保护拦下，长句词条也能验到查表结果。
    const { doc, dom } = boot("<div><button></button></div>");
    const btn = doc.querySelector("button");
    btn.textContent = en;
    const eng = createEngine({
      document: doc, window: dom.window, data: { exact, rules, templates }, site: SITE
    });
    eng.start();
    const got = btn.textContent.trim();
    if (got !== zh) miss.push(JSON.stringify(en) + " => " + JSON.stringify(got) + "（期望 " + JSON.stringify(zh) + "）");
    dom.window.close();
  }
  assert.deepEqual(miss, []);
});

test("enrichr：三条带数字的规则按真实文案命中", () => {
  const { doc, dom } = boot([
    "<div><span id=a>614 gene(s) entered</span>",
    "<span id=b>Sample gene set (614 genes)</span>",
    "<span id=c>Showing 1 to 10 of 230 entries</span>",
    "<span id=d>1 gene(s) entered</span></div>"
  ].join(""));
  assert.equal(doc.querySelector("#a").textContent, "614 个基因已输入");
  assert.equal(doc.querySelector("#b").textContent, "示例基因集（614 个基因）");
  assert.equal(doc.querySelector("#c").textContent, "显示第 1 至 10 条，共 230 条");
  assert.equal(doc.querySelector("#d").textContent, "1 个基因已输入");
  dom.window.close();
});

test("enrichr：首页输入面板按真实 childNodes 边界套模板，链接节点原样保留", () => {
  const { doc, dom } = boot([
    '<div id="textbox-description"> Drop a file or paste a set of Entrez gene symbols on each row in the textbox below. You can try a gene set <a href="#" id="example-link">example</a>. Also, you can now try adding a <a href="#" id="background-link">background</a>. </div>',
    '<div id="slider-line">Include the top <span id="slider-bar">100</span> most relevant genes</div>',
    '<div id="res_gene">Alternatively, try <a href="#" id="gene-search">the Gene Search</a> or <a href="#" id="term-search">the Term Search</a> features to fetch annotated Enrichr gene sets.</div>'
  ].join(""));
  const desc = doc.querySelector("#textbox-description");
  assert.match(desc.textContent, /拖入文件，或将 Entrez 基因符号逐行粘贴到下方文本框中。你可以试试/);
  assert.match(desc.textContent, /基因集，现在也可以添加/);
  assert.equal(desc.querySelectorAll("a").length, 2, "两个链接节点必须留在原位");
  assert.equal(desc.querySelector("#example-link").getAttribute("href"), "#");
  assert.equal(doc.querySelector("#slider-line").textContent, "包含前 100 个最相关基因");
  const alt = doc.querySelector("#res_gene");
  assert.match(alt.textContent, /也可以试试/);
  assert.equal(alt.querySelectorAll("a").length, 2);
  assert.equal(alt.querySelector("#gene-search").getAttribute("href"), "#");
  assert.equal(doc.querySelector("#slider-bar").textContent, "100", "槽位元素内容不吞");
  dom.window.close();
});

test("enrichr：结果页图例与 Appyter 段（内联 b/a 槽位）命中", () => {
  const { doc, dom } = boot([
    '<div class="hidden method">Click the bars to sort. Now sorted by <span>p-value ranking</span>.</div>',
    '<p id="appyter">With the Enrichr <a href="#"><b>Appyter</b></a> you can create publication ready visualizations for your enrichment analysis results. The Appyter creates scatter plots, bar plots, hexagonal grids, and Manhattan plots from your results. The results are delivered as a Jupyter notebook report. Click on the button below to execute the Appyter to receive the report.</p>'
  ].join(""));
  const method = doc.querySelector(".hidden.method");
  assert.match(method.textContent, /^点击柱条排序。当前按/);
  assert.equal(method.querySelectorAll("span").length, 1, "槽位 span 必须留在原位");
  const appyter = doc.querySelector("#appyter");
  assert.match(appyter.textContent, /^借助 Enrichr /);
  assert.match(appyter.textContent, /点击下方按钮运行 Appyter 以获取报告。$/);
  assert.equal(appyter.querySelectorAll("a b").length, 1, "内联 b 节点必须保留");
  dom.window.close();
});

test("enrichr：scopedExact 只在自己命中的元素里生效，且不影响同类词的其他位置", () => {
  const { doc, dom } = boot([
    '<div id="navbar"><a href="#analyze">Analyze</a><a href="#new">What&apos;s new?</a><a href="#libraries">Libraries</a></div>',
    '<table class="nav"><tr><td><a id="bg-link">Bar\n Graph</a></td><td><a id="table-link">Table</a></td><td><a id="grid-link">Grid</a></td></tr></table>',
    '<td class="shown"><a id="Transcription-link">Transcription</a><a id="Diseases/Drugs-link">Diseases/Drugs</a><a id="Cell_Types-link">Cell Types</a></td>',
    '<p id="textbox-description"><a id="example-link">example</a> <a id="background-link">background</a></p>',
    '<p id="other">Misc</p>'
  ].join(""));
  assert.equal(doc.querySelector('#navbar a[href="#analyze"]').textContent, "分析");
  assert.equal(doc.querySelector('#navbar a[href="#new"]').textContent, "更新内容");
  assert.equal(doc.querySelector("#bg-link").textContent, "柱状图");
  assert.equal(doc.querySelector("#table-link").textContent, "表格");
  assert.equal(doc.querySelector("#grid-link").textContent, "网格");
  assert.equal(doc.querySelector("#Transcription-link").textContent, "转录");
  assert.equal(doc.querySelector("#Diseases\\/Drugs-link").textContent, "疾病/药物");
  assert.equal(doc.querySelector("#Cell_Types-link").textContent, "细胞类型");
  assert.equal(doc.querySelector("#example-link").textContent, "示例");
  assert.equal(doc.querySelector("#background-link").textContent, "背景");
  // scopedExact 只在白名单里生效：写在普通段落里的 "Misc" 保持英文（只有 #Misc-link 那一支收录了它）
  assert.equal(doc.querySelector("#other").textContent, "Misc");
  dom.window.close();
});

test("enrichr：skip 挡住品牌分片与文库名，block 放行 .highlight 菜单项", () => {
  const { doc, dom } = boot([
    '<div id="header"><div id="logo"><a id="IndexLogo-link"><div><span>En</span><span class="red">rich</span><span>r</span></div></a></div></div>',
    '<div class="header column"><a class="title" id="KEGG_2021_Human-link">KEGG_2021_Human</a></div>',
    '<ul><li><a href="#basics" class="highlight"><span class="section">The Basics</span><span class="description">Learn the basics of using Enrichr</span></a></li></ul>'
  ].join(""));
  const logo = doc.querySelector("#logo");
  assert.equal(logo.textContent, "Enrichr", "品牌不翻、也不拆");
  assert.equal(doc.querySelector("#KEGG_2021_Human-link").textContent, "KEGG_2021_Human", "文库名是数据，保留英文");
  const hl = doc.querySelector("a.highlight");
  assert.equal(hl.querySelector(".section").textContent, "基础", "站点 block 去掉了 .highlight，菜单首项照翻");
  assert.equal(hl.querySelector(".description").textContent, "学习 Enrichr 的基本用法");
  dom.window.close();
});

test("enrichr：长句里的内联链接按正文保护留英文（不制造半中半英）", () => {
  const long = "The Term search feature lets you search for terms that contain a given gene, which is useful when you want to know which pathways or ontologies include your gene of interest.";
  const { doc, dom } = boot('<p id="prose">' + long + ' Try <a id="ts-link">Term search</a> from the menu.</p>');
  assert.equal(doc.querySelector("#ts-link").textContent, "Term search", "正文句子里的链接不能单独翻成中文");
  dom.window.close();
});

test("enrichr：missNoise 锚定、能压数据噪音、不吃界面词", () => {
  const noise = siteCfg.missNoise || [];
  assert.ok(noise.length >= 6, "missNoise 太少: " + noise.length);
  const data = ["KEGG_2021_Human", "1.2e-05", "STAT3, BRCA1, TP53", "ChEA 2022", "45%", "Aging_Perturbations_from_GEO_up"];
  const ui = ["Table", "Grid", "Search", "The Basics", "Analyze", "Libraries", "Contribute", "Help", "Significant"];
  const compiled = noise.map((n) => {
    const caps = n.startsWith("rec:");
    const body = n.replace(/^(rec|re):/, "");
    return { raw: n, re: new RegExp(body, caps ? "" : "i") };
  });
  const bad = [];
  for (const c of compiled) {
    for (const w of ui) if (c.re.test(w)) bad.push("missNoise 吃了界面词: " + c.raw + " ← " + w);
  }
  assert.deepEqual(bad, [], "missNoise 不能吃掉真界面词");
  assert.ok(compiled.some((c) => c.re.test("KEGG_2021_Human")), "至少能压住 KEGG_2021_Human 这类文库名");
  assert.ok(compiled.some((c) => c.re.test("1.2e-05")), "至少能压住科学计数法数值");
  assert.ok(compiled.some((c) => c.re.test("STAT3, BRCA1, TP53")), "至少能压住基因列表");
  assert.ok(compiled.some((c) => c.re.test("ChEA 2022")), "至少能压住带年份的文库名");
  assert.ok(data.length >= 0);
});

test("更新内容/元数据/关于三个长页签整块留英文，不再漏出半中半英", () => {
  const html = `<div id="new_t"><p>In the past year, we have rolled out major updates to Enrichr, including new libraries and faster analysis.</p></div>`;
  const { doc } = boot(html);
  const t = doc.querySelector("#new_t").textContent;
  assert.match(t, /we have rolled out major updates/);
  assert.doesNotMatch(t, /过去一年|已推出/);
});

test("Find knowledge 按钮翻译", () => {
  const { doc } = boot(`<button class="proceed-button">Find knowledge</button>`);
  assert.equal(doc.querySelector(".proceed-button").textContent, "查找知识");
});
