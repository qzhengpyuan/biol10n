// GSEA / MSigDB 官网（www.gsea-msigdb.org/gsea/...）词库回归：首页、集合页、浏览页、基因集详情页、帮助页。
// 站点 id "msigdb"，词库 common/msigdb。按真实 DOM 节点边界挂载（页面里的 <a>/<br>/<em> 会把句子切成多段）。
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
const site = sites.find((s) => s.id === "msigdb");
if (!site) throw new Error("config/sites.json 里找不到 msigdb 站点");

const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/msigdb.json"), "utf8"));
const data = { exact: {}, rules: [], templates: [] };
for (const id of site.dicts) {
  const p = path.join(root, "../dict", id + ".json");
  if (!fs.existsSync(p)) continue;
  const b = JSON.parse(fs.readFileSync(p, "utf8"));
  Object.assign(data.exact, b.exact || {});
  data.rules = data.rules.concat(b.rules || []);
  data.templates = data.templates.concat(b.templates || []);
}

function run(html, url) {
  const dom = new JSDOM(html, { url: url || "https://www.gsea-msigdb.org/gsea/msigdb/" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return dom.window.document;
}
const text = (el) => el.textContent.replace(/\s+/g, " ").trim();
const CJK = /[\u4e00-\u9fff]/;
// 少数条目是「英文缩写 + 全角括号」的合法中文写法（NCBI（Entrez）），不含汉字但已本地化。
const PUNCT_ONLY_ZH = /^[A-Za-z0-9 .:/-]+（[A-Za-z0-9 .:/-]+）$/;

test("站点配置：hosts 精确到 gsea-msigdb.org，path 收紧到 /gsea", () => {
  assert.deepEqual(site.hosts.slice().sort(), ["gsea-msigdb.org", "www.gsea-msigdb.org"]);
  assert.equal(site.path, "^/gsea");
  assert.ok(site.dicts.includes("common") && site.dicts.includes("msigdb"));
  assert.ok(site.attrs.includes("title"));
  assert.ok(site.missNoise.length >= 20);
  assert.equal(book.meta.sites[0], "msigdb");
  const others = sites.filter((s) => s.id !== "msigdb" && (s.hosts || []).some((h) => /gsea-msigdb\.org$/.test(h)));
  assert.equal(others.length, 0);
});

test("词条卫生：译文已本地化、不含 URL/邮箱、基因集名不进词表", () => {
  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(CJK.test(v) || PUNCT_ONLY_ZH.test(v), "译文未本地化: " + k);
    assert.ok(!/https?:\/\/|@/.test(v), "译文含 URL/邮箱: " + k);
    assert.ok(!/^[A-Z0-9_]+$/.test(k), "基因集名/常量不该进 exact: " + k);
  }
  for (const t of book.templates) {
    assert.ok(CJK.test(t.zh), "模板译文缺中文: " + t.pat);
    const patSlots = (t.pat.match(/\{\{\d+\}\}/g) || []).sort();
    const zhSlots = (t.zh.match(/\{\{\d+\}\}/g) || []).sort();
    assert.deepEqual(zhSlots, patSlots, "模板占位符必须一一对应: " + t.pat);
  }
  for (const r of book.rules) {
    assert.ok(r.re.startsWith("^") && r.re.endsWith("$"), "规则必须锚定: " + r.re);
  }
});

test("首页：资源介绍整句走模板，Human/Mouse 两个链接原位保留", () => {
  const html = '<p>The Molecular Signatures Database (MSigDB) is a resource of tens of thousands of annotated gene sets for use with GSEA software, divided into <a href="human/">Human</a> and <a href="mouse/">Mouse</a> collections. From this web site, you can</p>';
  const doc = run(html);
  const p = doc.querySelector("p");
  assert.equal(text(p), "分子特征数据库（MSigDB）收录数万个带注释的基因集，供 GSEA 软件使用，分为人类与小鼠两类集合。在本站中，您可以");
  assert.equal(p.querySelectorAll("a").length, 2);
  assert.equal(p.querySelector("a").getAttribute("href"), "human/");
});

test("首页：集合表里的集合名与说明分段翻译，代号不动", () => {
  const html = '<table><tr><td><a href="x"><span>H</span> hallmark gene sets</a> are a collection of curated gene sets that capture biological states.</td></tr></table>';
  const doc = run(html);
  assert.equal(text(doc.querySelector("span")), "H");
  assert.equal(text(doc.querySelector("a")), "H 标志性基因集");
});

test("集合页：表头、browse 计数与 details 链接", () => {
  const html = '<table><tr><th>C1: positional gene sets<br/><span class="sub">(<a href="b">browse 302 gene sets</a>)</span></th>' +
    '<td>Gene sets corresponding to human chromosome cytogenetic bands. <a href="d">details</a></td></tr></table>';
  const doc = run(html);
  assert.equal(text(doc.querySelector("th")), "C1：位置型基因集（浏览 302 个基因集）");
  assert.equal(text(doc.querySelector("td")), "对应人类染色体细胞遗传学带的基因集。详情");
});

test("浏览页：括号里的集合描述与计数走规则（锚定 + 描述必须命中词表）", () => {
  const doc = run('<p><a href="x">(hallmark gene sets, 50 gene sets)</a></p>');
  assert.equal(text(doc.querySelector("a")), "（标志性基因集，50 个基因集）");
  const doc2 = run('<p><a href="x">(brand new unknown collection, 7 gene sets)</a></p>');
  assert.equal(text(doc2.querySelector("a")), "(brand new unknown collection, 7 gene sets)");
});

test("基因集页：h1、表头分段、tooltip 与状态标签", () => {
  const html = '<h1>Human Gene Set: HALLMARK_APOPTOSIS</h1>' +
    '<table><tr><th>Standard name</th><td>HALLMARK_APOPTOSIS</td></tr>' +
    '<tr><th>Brief description</th><td>x</td></tr>' +
    '<tr><th>Source<br/>Id</th><th>NCBI (Entrez)<br/>Gene Id</th></tr></table>' +
    '<p>(<i>Renamed</i>)</p>' +
    '<table><tr><th title="original member source identifier">Source</th></tr></table>' +
    '<a href="#" id="sh">show</a>';
  const doc = run(html);
  assert.equal(text(doc.querySelector("h1")), "人类基因集：HALLMARK_APOPTOSIS");
  assert.deepEqual([...doc.querySelectorAll("th")].map(text).slice(0, 4),
    ["标准名称", "简要描述", "来源标识", "NCBI（Entrez）基因编号"]);
  assert.equal(text(doc.querySelector("td")), "HALLMARK_APOPTOSIS");
  assert.equal(text(doc.querySelector("i")), "重命名");
  assert.equal(doc.querySelector("[title]").getAttribute("title"), "原始成员来源标识符");
  // show 是脚本读写的状态令牌，绝不能被翻
  assert.equal(text(doc.querySelector("#sh")), "show");
});

test("基因集页：相关基因集计数句与 Pubmed 编号", () => {
  const doc = run('<p><a href="x">11 additional gene sets from the source publication)</a></p><p>Pubmed 26771021</p>');
  assert.equal(text(doc.querySelectorAll("p a")[0]), "11 个来自该来源文献的其他基因集)");
  assert.equal(text(doc.querySelectorAll("p")[1]), "PubMed 文献 26771021");
});

test("跨页公共文案：导航、登录页表单提示、帮助页 li 模板", () => {
  const doc = run('<nav><a>GSEA Home</a><a>Molecular Signatures Database</a><a>Documentation</a><a>Team</a><a>login</a></nav>');
  assert.deepEqual([...doc.querySelectorAll("nav a")].map(text),
    ["GSEA 首页", "分子特征数据库", "文档", "团队", "登录"]);
  const doc2 = run('<table><tr><td>Items marked with <font color="red">*</font> are required.</td></tr></table>');
  assert.equal(text(doc2.querySelector("td")), "标记 * 的项为必填项。");
  const doc3 = run('<ul><li>Compute overlaps with other MSigDB gene sets (<a href="m">more...</a>)</li></ul>');
  assert.equal(text(doc3.querySelector("li")), "计算与其他 MSigDB 基因集的重叠（更多...）");
});

test("数据噪音不进词表：基因符号与物种拉丁名保持原样", () => {
  const doc = run('<table><tr><td>TP53</td><td>Homo sapiens</td><td>chr4q34</td></tr></table>');
  assert.deepEqual([...doc.querySelectorAll("td")].map(text), ["TP53", "Homo sapiens", "chr4q34"]);
});

