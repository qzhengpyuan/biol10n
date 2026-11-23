// r33 InterPro 检索页 callout 与 EBI 家族杂项（dict/interpro.json）
// 覆盖：文本检索页的「Found an exact gene match …」警告块与「Found an exact match:」条目块、
// 检索页署名行「Powered by EBI search」、首页成员数据库标题 PROSITE patterns、
// 以及共享 EBI 页脚里被两个链接切开的 "and"。
// 所有片段都按 CDP 9227 实测渲染 DOM 复刻（2026-11-24，InterPro 111.0）。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/interpro.json"), "utf8"));
const common = JSON.parse(fs.readFileSync(path.join(root, "../dict/common.json"), "utf8"));
const spa = JSON.parse(fs.readFileSync(path.join(root, "../dict/spa.json"), "utf8"));

const site = {
  id: "interpro",
  name: "InterPro",
  hosts: ["www.ebi.ac.uk"],
  path: "^/interpro",
  dicts: ["common", "spa", "interpro"],
  scope: "body",
  spa: true,
  waitFor: "#root",
  rescan: false,
  attrs: ["data-content"]
};

const all = {
  exact: Object.assign({}, common.exact, spa.exact, dict.exact),
  rules: [...(common.rules || []), ...(spa.rules || []), ...(dict.rules || [])],
  templates: [...(common.templates || []), ...(spa.templates || []), ...(dict.templates || [])]
};

const CJK = /[\u4e00-\u9fff]/;
const SEARCH_URL = "https://www.ebi.ac.uk/interpro/search/text/p53/";
const HOME_URL = "https://www.ebi.ac.uk/interpro/";

function engineFor(html, url) {
  const dom = new JSDOM(html, { url: url || SEARCH_URL });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: all,
    site
  });
  engine.start();
  return { doc: dom.window.document, engine, dom };
}

function text(el) {
  return el.textContent.replace(/\s+/g, " ").trim();
}

const anyEngine = engineFor("<p>x</p>").engine;

// 实测 DOM：/interpro/search/text/p53/ 的「精确基因匹配」警告块（外链与 accession 原样）
const GENE_CALLOUT =
  '<div id="root"><div class="new-callout Callout_styles__new-callout___c0 warning Callout_styles__warning___f4">' +
  '<div class="callout-content">' +
  '<span>Found an exact gene match for <b>P53</b> in the following key species:</span> ' +
  "<ul>" +
  '<li><b>Drosophila melanogaster</b>: <a href="/interpro/protein/UniProt/A0A0B4K7P1/">A0A0B4K7P1</a>, ' +
  '<a href="/interpro/protein/UniProt/Q2XVY6/">Q2XVY6</a>, <a href="/interpro/protein/UniProt/Q2XVY7/">Q2XVY7</a>, ' +
  '<a href="/interpro/protein/UniProt/Q2XVY8/">Q2XVY8</a>, <a href="/interpro/protein/UniProt/Q7KS52/">Q7KS52</a>' +
  '<button type="button" class="vf-button vf-button--inline vf-button--sm" style="white-space: nowrap;">and 3 proteins more (click to show).</button></li>' +
  '<li><b>Homo sapiens</b>: <a href="/interpro/protein/UniProt/A0A0C4KX50/">A0A0C4KX50</a>, ' +
  '<a href="/interpro/protein/UniProt/A0A0C4L134/">A0A0C4L134</a></li>' +
  "</ul></div></div></div>";

test("结构与卫生：新增键为实测 DOM 原文，值含汉字且不与 common/spa 打架", () => {
  const expect = {
    "EBI search": "EBI search 提供支持",
    "Found an exact match:": "找到精确匹配：",
    "PROSITE patterns": "PROSITE 模式",
    "and": "和"
  };
  for (const [k, v] of Object.entries(expect)) {
    assert.equal(dict.exact[k], v, "缺词条或译法变了: " + k);
    assert.ok(k.length <= 80, "key 超过 80 字符: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.match(v, CJK, "译文不含汉字: " + k);
    assert.doesNotMatch(v, /https?:\/\//i, "值含明文 URL: " + k);
    assert.doesNotMatch(v, /[\w.+-]+@[\w-]+\.[\w.]+/, "值含明文邮箱: " + k);
    if (k in common.exact) assert.equal(v, common.exact[k], "与 common 译法不一致: " + k);
    if (k in spa.exact) assert.equal(v, spa.exact[k], "与 spa 译法不一致: " + k);
  }
  // "and" 与其它册（ensembl / ncbi-help / cbioportal / gepia2）同值，禁止出现两种译法
  assert.equal(dict.exact["and"], "和");

  const rule = dict.rules.find((r) => r.re === "^(Powered by)$");
  assert.ok(rule, "缺 Powered by 规则");
  assert.equal(rule.to, "由");
  assert.doesNotThrow(() => new RegExp(rule.re));
  assert.ok(/^^/.test(rule.re) && /\$$/.test(rule.re), "规则未锚定: " + rule.re);

  const tpl = dict.templates.find((t) => /Found an exact gene match for \{\{1\}\}/.test(t.pat));
  assert.ok(tpl, "缺精确基因匹配模板");
  assert.equal(tpl.pat, "Found an exact gene match for {{1}} in the following key species:");
  assert.equal(tpl.zh, "在以下关键物种中找到与 {{1}} 精确匹配的基因：");
  assert.ok(tpl.pat.length >= 20 && tpl.pat.length <= 2200, "模板 pat 长度越界: " + tpl.pat.length);
  assert.doesNotMatch(tpl.pat, CJK, "模板 pat 含中文");
  assert.equal((tpl.zh.match(/\{\{\d+\}\}/g) || []).length, 1, "模板槽位数不对");
});

test("规则：Powered by 只在独立成节点时命中，不误伤 Powered by InterProScan", () => {
  assert.equal(anyEngine.translateText("Powered by"), "由");
  assert.equal(anyEngine.translateText("Powered by InterProScan"), "由 InterProScan 提供支持", "整串词条应优先于规则");
  assert.equal(anyEngine.translateText("Powered by the EBI Search"), null, "带宾语的整句不该被十词规则接管");
});

test("jsdom：检索页「精确基因匹配」警告块（span + <b>，模板通道）", () => {
  const { doc } = engineFor(GENE_CALLOUT);
  const span = doc.querySelector(".callout-content > span");
  assert.equal(text(span), "在以下关键物种中找到与 P53 精确匹配的基因：", "整句未换成中文: " + text(span));
  assert.equal(span.querySelectorAll("b").length, 1, "<b> 槽位丢了");
  assert.equal(text(span.querySelector("b")), "P53", "基因名不该被翻");

  const callout = doc.querySelector(".callout-content");
  assert.match(text(callout), /^在以下关键物种中找到与 P53 精确匹配的基因：/, "callout 首句未汉化: " + text(callout));
  const lis = [...callout.querySelectorAll("li")];
  assert.equal(lis.length, 2, "物种列表条数变了");
  // 物种学名是题录/专名：保持原文
  assert.equal(text(lis[0].querySelector("b")), "Drosophila melanogaster");
  assert.equal(text(lis[1].querySelector("b")), "Homo sapiens");
  // accession 与链接原样保留
  const links = [...callout.querySelectorAll("a")];
  assert.equal(links.length, 7, "accession 链接数变了: " + links.length);
  assert.equal(text(links[0]), "A0A0B4K7P1");
  assert.equal(links[0].getAttribute("href"), "/interpro/protein/UniProt/A0A0B4K7P1/");
  assert.equal(text(links[6]), "A0A0C4L134");
  // 折叠按钮仍由既有规则处理
  assert.equal(text(callout.querySelector("button")), "另有 3 个蛋白（点击显示）。");
  // 整块不应再残留英文句子
  assert.doesNotMatch(text(callout), /Found an exact gene match|key species/);
});

test("jsdom：检索页「Found an exact match:」条目块（单文本节点，走词条）", () => {
  const { doc } = engineFor(
    // 实测 DOM 里 <a> 内是三个文本节点（"Entry" / " " / "IPR000001"），用注释切出同样的节点形态
    '<div id="root"><div class="callout-content"><span>Found an exact match:</span> ' +
      '<a href="/interpro/entry/InterPro/IPR000001/">Entry<!----> IPR000001</a></div></div>',
    "https://www.ebi.ac.uk/interpro/search/text/IPR000001/"
  );
  const callout = doc.querySelector(".callout-content");
  assert.match(text(callout), /^找到精确匹配：\s*条目 IPR000001$/, "条目块未汉化: " + text(callout));
  const a = callout.querySelector("a");
  assert.equal(a.getAttribute("href"), "/interpro/entry/InterPro/IPR000001/");
  assert.equal(text(a), "条目 IPR000001");
});

test("jsdom：检索页署名行「Powered by EBI search」→ 由 EBI search 提供支持", () => {
  const { doc } = engineFor(
    '<div id="root"><div class="search-adv SearchByText_style__search-adv___d5">' +
      '<span>Powered by <a href="https://www.ebi.ac.uk/ebisearch/" rel="noreferrer noopener" target="_blank" ' +
      'class="neutral SearchByText_style__neutral___b4 ext">EBI search</a></span></div></div>'
  );
  const span = doc.querySelector(".search-adv > span");
  assert.equal(text(span), "由 EBI search 提供支持", "署名行未汉化: " + text(span));
  assert.doesNotMatch(text(span), /^技术支持/, "不该再是「技术支持」");
  const a = span.querySelector("a");
  assert.equal(a.getAttribute("href"), "https://www.ebi.ac.uk/ebisearch/");
  assert.equal(a.getAttribute("target"), "_blank");
  assert.equal(a.className, "neutral SearchByText_style__neutral___b4 ext", "class 被改掉了");
  assert.equal(text(a), "EBI search 提供支持");
});

test("jsdom：首页成员数据库标题 PROSITE patterns / profiles 与版本号共存", () => {
  const { doc } = engineFor(
    '<div id="root"><ul>' +
      '<li><span class="home_styles__title___fe">PROSITE profiles</span><span class="version">2026_01</span>' +
      "<span>488 条记录</span></li>" +
      '<li><span class="home_styles__title___fe">PROSITE patterns</span><span class="version">2026_01</span>' +
      "<span>451 条记录</span></li>" +
      "</ul></div>",
    HOME_URL
  );
  const titles = [...doc.querySelectorAll("span.home_styles__title___fe")].map(text);
  assert.deepEqual(titles, ["PROSITE 谱", "PROSITE 模式"]);
  const versions = [...doc.querySelectorAll("span.version")].map(text);
  assert.deepEqual(versions, ["2026_01", "2026_01"], "版本号不该被翻");
  const counts = [...doc.querySelectorAll("li > span:last-child")].map(text);
  assert.deepEqual(counts, ["488 条记录", "451 条记录"], "计数不该被翻");
});

test("jsdom：共享 EBI 页脚「Postdocs and PhDs」——独立 and 节点译成「和」", () => {
  const { doc } = engineFor(
    // 实测 DOM：EBI 页脚是 "Postdocs" + " " + "and" + " " + "PhDs" 五个节点，用注释切出同样的形态
    '<div id="root"><ul class="vf-list">' +
      '<li><a href="//www.ebi.ac.uk/research/postdocs" class="vf-list__link">Postdocs</a> <!---->and<!----> ' +
      '<a href="//www.ebi.ac.uk/research/eipp" class="vf-list__link">PhDs</a></li></ul></div>',
    HOME_URL
  );
  const li = doc.querySelector("li");
  assert.match(text(li), /^博士后\s?和\s?博士生$/, "页脚 and 未处理: " + text(li));
  const links = [...li.querySelectorAll("a")];
  assert.equal(links.length, 2, "页脚链接数变了");
  assert.equal(links[0].getAttribute("href"), "//www.ebi.ac.uk/research/postdocs");
  assert.equal(links[1].getAttribute("href"), "//www.ebi.ac.uk/research/eipp");
});

test("disable() 后还原英文原文（模板块、词条块、署名行都要能回滚）", () => {
  const { doc, engine } = engineFor(
    GENE_CALLOUT +
      '<div class="search-adv"><span>Powered by <a href="https://www.ebi.ac.uk/ebisearch/">EBI search</a></span></div>' +
      '<div class="footer"><a href="/p">Postdocs</a> <!---->and<!----> <a href="/e">PhDs</a></div>'
  );
  assert.match(text(doc.querySelector(".callout-content > span")), /^在以下关键物种中/);
  assert.equal(text(doc.querySelector(".search-adv > span")), "由 EBI search 提供支持");
  assert.match(text(doc.querySelector(".footer")), /^博士后\s?和\s?博士生$/);

  engine.disable();
  assert.match(text(doc.querySelector(".callout-content > span")), /^Found an exact gene match for P53 in the following key species:$/, "模板未还原");
  assert.equal(text(doc.querySelector(".search-adv > span")), "Powered by EBI search", "署名行未还原");
  assert.equal(text(doc.querySelector(".footer")), "Postdocs and PhDs", "页脚未还原");
  assert.equal(doc.querySelectorAll(".callout-content a").length, 7, "还原后链接丢失");
});
