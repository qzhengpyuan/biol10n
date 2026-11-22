// InterPro（dict/interpro.json）冒烟测试：页头页脚、导航、首页检索表单、条目页、蛋白页、
// 浏览筛选、帮助页、开放 shadow root 与三段被内联元素切碎的说明句。
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

// sites.json 里 InterPro 已登记，dicts 需追加本册
const site = {
  id: "interpro",
  name: "InterPro",
  hosts: ["www.ebi.ac.uk"],
  path: "^/interpro",
  dicts: ["common", "spa", "interpro"],
  scope: "body",
  spa: true,
  waitFor: "#root",
  rescan: false
};

const all = {
  exact: Object.assign({}, common.exact, spa.exact, dict.exact),
  rules: [...(common.rules || []), ...(spa.rules || []), ...(dict.rules || [])],
  templates: [...(common.templates || []), ...(spa.templates || []), ...(dict.templates || [])]
};

const CJK = /[\u4e00-\u9fff]/;
const NB = "\u2011"; // InterPro‑N 里的不换行连字符

function engineFor(html, url) {
  const dom = new JSDOM(html, { url: url || "https://www.ebi.ac.uk/interpro/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: all,
    site
  });
  engine.start();
  return { doc: dom.window.document, engine, dom };
}

const anyEngine = engineFor("<p>x</p>").engine;
function text(el) {
  return el.textContent.replace(/\s+/g, " ").trim();
}

test("词库结构：family/sites、exact 条数、译文含汉字、规则带捕获组、模板槽位连续", () => {
  assert.equal(dict.meta.family, "interpro");
  assert.deepEqual(dict.meta.sites, ["www.ebi.ac.uk"]);
  const keys = Object.keys(dict.exact);
  assert.ok(keys.length >= 240, "exact 只有 " + keys.length + " 条");
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.notEqual(v, k, "自映射: " + k);
    assert.match(v, CJK, "译文不含汉字: " + k + " => " + v);
  }
  assert.ok(dict.rules.length >= 1, "规则太少");
  for (const r of dict.rules) {
    assert.doesNotThrow(() => new RegExp(r.re), "坏正则: " + r.re);
    assert.match(r.to, CJK, "规则译文不含汉字: " + r.re);
    assert.ok(/\((?!\?)/.test(r.re), "规则没有捕获组: " + r.re);
    const m = new RegExp(r.re).exec("Approximately 73k") || new RegExp(r.re).exec("Approximately 9");
    if (/Approximately/.test(r.re)) assert.ok(m, "近似值规则没匹配上: " + r.re);
  }
  const tpl = dict.templates || [];
  assert.ok(tpl.length >= 3, "模板太少: " + tpl.length);
  for (const t of tpl) {
    assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, "模板 pat 长度越界: " + t.pat.length);
    assert.match(t.zh, CJK, "模板译文不含汉字: " + t.pat);
    const slots = (t.pat.match(/\{\{\d+\}\}/g) || []).length;
    assert.ok(slots >= 1, "模板没有槽位: " + t.pat);
    for (let i = 1; i <= slots; i++) assert.ok(t.pat.includes("{{" + i + "}}"), "槽位不连续: " + t.pat);
    assert.equal((t.zh.match(/\{\{\d+\}\}/g) || []).length, slots, "译文槽位数不一致: " + t.pat);
    assert.doesNotMatch(t.zh, /[\w.+-]+@[\w-]+\.[\w.]+/, "模板译文含明文邮箱: " + t.pat);
  }
});

test("条目卫生：key 无中文、首尾无空白，值里没有明文 URL / 邮箱；不与 common/spa 打架", () => {
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.doesNotMatch(k, CJK, "key 含中文: " + k);
    assert.equal(k, k.trim(), "key 首尾有空白: " + JSON.stringify(k));
    assert.equal(v, v.trim(), "值首尾有空白: " + k);
    assert.doesNotMatch(v, /https?:\/\//i, "值含明文 URL: " + k);
    assert.doesNotMatch(v, /[\w.+-]+@[\w-]+\.[\w.]+/, "值含明文邮箱: " + k);
    assert.doesNotMatch(k, /[\r\n]/, "key 含换行: " + k);
    if (k in common.exact) assert.equal(v, common.exact[k], "与 common 译法不一致: " + k);
    if (k in spa.exact) assert.equal(v, spa.exact[k], "与 spa 译法不一致: " + k);
  }
});

test("jsdom：页头导航、首页检索表单与成员数据库分类", () => {
  const { doc } = engineFor(`<div id="root">
    <nav>
      <a href="/interpro/">Home</a>
      <a href="/interpro/search/sequence/">By Sequence</a>
      <a href="/interpro/search/text/">By Text</a>
      <a href="/interpro/search/ida/">By Domain Architecture</a>
      <a href="/interpro/entry/pfam/">By Member DB</a>
      <a href="/interpro/help/">Help</a>
      <a href="/interpro/result/download/">Your downloads</a>
      <a href="/interpro/release_notes/">Release notes</a>
    </nav>
    <h4>Classification of protein families</h4>
    <button>Search by sequence</button>
    <button>Search by text</button>
    <button>Search by Domain Architecture</button>
    <header>Scan your sequences</header>
    <label>Sequence type:</label>
    <legend>Member databases</legend>
    <legend>Families, domains, sites &amp; repeats</legend>
    <legend>Signal peptides and transmembrane regions</legend>
    <div>Drop your file here</div>
    <span>Powered by InterProScan</span>
  </div>`);
  assert.equal(text(doc.querySelector('a[href="/interpro/search/sequence/"]')), "按序列");
  assert.equal(text(doc.querySelector('a[href="/interpro/search/text/"]')), "按文本");
  assert.equal(text(doc.querySelector('a[href="/interpro/search/ida/"]')), "按结构域架构");
  assert.equal(text(doc.querySelector('a[href="/interpro/entry/pfam/"]')), "按成员数据库");
  assert.equal(text(doc.querySelector('a[href="/interpro/result/download/"]')), "你的下载");
  assert.equal(text(doc.querySelector('a[href="/interpro/release_notes/"]')), "版本发布说明");
  assert.equal(text(doc.querySelector("h4")), "蛋白家族分类");
  assert.equal(text(doc.querySelector("header")), "扫描你的序列");
  assert.equal(text(doc.querySelector("label")), "序列类型：");
  const legends = [...doc.querySelectorAll("legend")].map(text);
  assert.deepEqual(legends, ["成员数据库", "家族、结构域、位点与重复", "信号肽与跨膜区域"]);
  assert.equal(text(doc.querySelector("div div")), "将文件拖放到此处");
  assert.match(text(doc.body), /由 InterProScan 提供支持/);
});

test("jsdom：条目页区块标题、字段标签与蛋白页表头", () => {
  const { doc } = engineFor(`<div id="root">
    <div>By</div><div>entry</div><div>InterPro</div><div>IPR000001</div>
    <span>Overview</span><span>Domain Architectures</span><span>Interactions</span><span>Pathways</span>
    <h3>Kringle</h3>
    <table><tr><td>Short name</td><td><i>Kringle</i></td></tr>
      <tr><td>Overlapping</td><td>homologous</td><td>superfamilies</td></tr></table>
    <h4>Description</h4><h4>References</h4><h4>Cross References</h4>
    <h5>Contributing Member Database Entries</h5>
    <h5>Representative structure</h5>
    <a href="/x">View article</a>
    <span>PMID:</span>
    <a href="/y">Provide feedback</a>
    <table><tr><td>Length</td><td><a href="/seq">393 amino acids</a></td></tr>
      <tr><td>Species</td><td>Homo sapiens (Human)</td></tr>
      <tr><td>Family membership</td><td>p53 tumour suppressor family</td></tr></table>
  </div>`, "https://www.ebi.ac.uk/interpro/entry/InterPro/IPR000001/");
  const spans = [...doc.querySelectorAll("span")].map(text);
  assert.ok(spans.includes("概览"), "Overview 未翻: " + spans.join("|"));
  assert.ok(spans.includes("结构域架构"), "Domain Architectures 未翻");
  assert.ok(spans.includes("相互作用"), "Interactions 未翻");
  assert.ok(spans.includes("通路"), "Pathways 未翻");
  assert.equal(text(doc.querySelector("h4")), "描述", "Description 未翻（common 应覆盖）");
  const h5 = [...doc.querySelectorAll("h5")].map(text);
  assert.ok(h5.includes("贡献数据的成员数据库条目"), "成员数据库标题未翻: " + h5.join("|"));
  assert.ok(h5.includes("代表性结构"), "代表性结构未翻");
  assert.equal(text(doc.querySelector('a[href="/x"]')), "查看文章");
  assert.equal(text(doc.querySelector("table tr td")), "简称");
  const cells = [...doc.querySelectorAll("td")].map(text);
  assert.ok(cells.includes("重叠") && cells.includes("同源") && cells.includes("超家族"), "重叠同源超家族未翻: " + cells.join("|"));
  assert.equal(text(doc.querySelector('a[href="/seq"]')), "393 氨基酸", "数字+单位应由 common 规则补齐");
  assert.equal(text(doc.querySelector("td + td a[href='/seq']")), "393 氨基酸");
  assert.match(text(doc.body), /提供反馈/);
  assert.match(text(doc.body), /p53 tumour suppressor family/, "蛋白家族专名不该被翻");
});

test("规则：Approximately 计数、不误伤百分数句", () => {
  assert.equal(anyEngine.translateText("Approximately 73k"), "约 73k");
  assert.equal(anyEngine.translateText("Approximately 9"), "约 9");
  assert.equal(anyEngine.translateText("Approximately 657"), "约 657");
  assert.equal(anyEngine.translateText("Approximately 5% longer"), null, "带百分数说明的句子不该命中近似值规则");
  assert.equal(anyEngine.translateText("InterPro type: domain"), "InterPro 类型：结构域");
  assert.equal(anyEngine.translateText("InterPro type: homologous superfamily"), "InterPro 类型：同源超家族");
});

test("jsdom：开放 shadow root（interpro-type 徽标文字与 host aria-label）", () => {
  const dom = new JSDOM(`<div id="root"><span id="tip"></span><p><interpro-type type="domain" aria-label="InterPro type: domain" dimension="17px">domain</interpro-type></p></div>`, {
    url: "https://www.ebi.ac.uk/interpro/entry/InterPro/IPR000001/"
  });
  const doc = dom.window.document;
  const host = doc.querySelector("interpro-type");
  const sr = host.attachShadow({ mode: "open" });
  sr.innerHTML = '<style>.svg-container{display:inline-flex}</style><span class="svg-container"><svg viewBox="0 0 60 60"><rect x="0" y="0" width="60" height="60"></rect></svg><span style="color:#6caed4;padding-left:0.5rem;">Homologous Superfamily</span></span>';
  const engine = createEngine({ document: doc, window: dom.window, data: all, site });
  engine.start();
  assert.equal(host.getAttribute("aria-label"), "InterPro 类型：结构域", "shadow host 的 aria-label 未翻");
  assert.equal(text(host), "结构域", "徽标 slot 文字未翻");
  const inner = sr.querySelector("span[style]");
  assert.equal(text(inner), "同源超家族", "shadow root 内的文字未翻: " + text(inner));
  assert.ok((engine.stats.shadow || 0) >= 1, "shadow 通道没跑起来");
});

test("jsdom：cookie 横幅模板（两个链接原样回填）", () => {
  const { doc } = engineFor(`<div id="root"><div class="banner">This website requires cookies, and the limited processing of your personal data in order to function. By using the site you are agreeing to this as outlined in our <a href="https://www.ebi.ac.uk/data-protection/privacy-notice/embl-ebi-public-website">Privacy Notice</a> and <a href="https://www.ebi.ac.uk/about/terms-of-use">Terms of Use</a>.</div></div>`);
  const banner = doc.querySelector(".banner");
  assert.match(text(banner), /^本网站需要 Cookie/, "整段未换成中文: " + text(banner));
  const links = banner.querySelectorAll("a");
  assert.equal(links.length, 2, "链接数变了");
  assert.equal(links[0].getAttribute("href"), "https://www.ebi.ac.uk/data-protection/privacy-notice/embl-ebi-public-website");
  assert.equal(text(links[0]), "隐私声明");
  assert.equal(links[1].getAttribute("href"), "https://www.ebi.ac.uk/about/terms-of-use");
  assert.equal(text(links[1]), "使用条款");
});

test("jsdom：蛋白页 InterPro-N 提示块模板（6 个槽位含 <br>，链接不丢）", () => {
  const html = '<div id="root"><div class="new-callout"><div class="callout-content">This sequence includes matches predicted by ✨<b>InterPro' + NB + 'N</b>, an AI-powered deep learning model developed by Google DeepMind.<br>By default, InterPro matches are supplemented with novel InterPro' + NB + 'N predictions (novel matches or those at least 5% longer).<br>To change the display mode, open the <i>Options</i> menu below and select your preferred setting. See <a href="https://interpro-documentation.readthedocs.io/en/latest/protein_viewer.html#interpro-n-display-modes">our documentation</a> for an explanation of each display mode. If you use InterPro-N predictions, please include <a href="https://interpro-documentation.readthedocs.io/en/latest/citing.html#interpro-n">the InterPro-N citation</a> in your references.</div></div></div>';
  const { doc } = engineFor(html, "https://www.ebi.ac.uk/interpro/protein/UniProt/P04637/");
  const el = doc.querySelector(".callout-content");
  const body = text(el);
  assert.match(body, /^本序列包含由 ✨InterPro/, "整段未换成中文: " + body.slice(0, 80));
  assert.match(body, /Google DeepMind 开发的 AI 深度学习模型/);
  assert.match(body, /各显示模式的说明见我们的文档/);
  assert.match(body, /附上InterPro-N 引用信息/);
  assert.equal(el.querySelectorAll("br").length, 2, "<br> 槽位丢了");
  assert.equal(el.querySelectorAll("a").length, 2, "链接丢了");
  assert.equal(el.querySelector("b").textContent, "InterPro" + NB + "N", "品牌名原样保留");
  assert.equal(text(el.querySelector("i")), "选项", "<i>Options</i> 槽位内容未翻");
  assert.equal(el.querySelectorAll("a")[0].getAttribute("href"), "https://interpro-documentation.readthedocs.io/en/latest/protein_viewer.html#interpro-n-display-modes");
});

test("jsdom：首页公告模板与属性通道（title / placeholder / aria-label）", () => {
  const { doc } = engineFor(`<div id="root">
    <div class="callout-content">We're pleased to announce the&nbsp;<a href="https://doi.org/10.1093/bioadv/vbag141">publication of the InterProScan 6 paper</a>, describing the latest generation of our sequence analysis pipeline.</div>
    <span title="Approximately 54k">54k</span>
    <input placeholder="Search entries">
    <i aria-label="icon Overview"></i>
    <input type="text" aria-label="Search InterPro">
  </div>`);
  const call = doc.querySelector(".callout-content");
  assert.match(text(call), /^我们很高兴地宣布InterProScan 6 论文的发表/, "公告未整句汉化: " + text(call));
  assert.equal(call.querySelectorAll("a").length, 1, "公告链接丢了");
  const tip = doc.querySelector("span[title]");
  assert.equal(tip.getAttribute("title"), "约 54k", "title 属性未翻");
  assert.equal(doc.querySelector("input[placeholder]").getAttribute("placeholder"), "检索条目");
  assert.equal(doc.querySelector("i").getAttribute("aria-label"), "图标：概览");
  assert.equal(doc.querySelector('input[aria-label]').getAttribute("aria-label"), "检索 InterPro");
});

test("disable() 后可还原英文原文（模板与逐节点两条通道都要能回滚）", () => {
  const { doc, engine } = engineFor(`<div id="root"><div class="callout-content">We're pleased to announce the&nbsp;<a href="/p">publication of the InterProScan 6 paper</a>, describing the latest generation of our sequence analysis pipeline.</div><p>Overview</p></div>`);
  assert.match(text(doc.querySelector(".callout-content")), /我们很高兴地宣布/);
  engine.disable();
  assert.match(text(doc.querySelector(".callout-content")), /^We're pleased to announce the/, "模板未还原: " + text(doc.querySelector(".callout-content")));
  assert.equal(text(doc.querySelector("p")), "Overview", "逐节点未还原");
});
