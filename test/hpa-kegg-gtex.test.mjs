// KEGG（dict/kegg-docs2.json）与 GTEx（dict/gtex.json）：KEGG pathway 页引导段的整段译文与
// 「通路标识符」模板，以及 GTEx 页脚版权行。三处原来都是「句子被链接/元素切碎后只翻半截」。
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
const keggBook = JSON.parse(fs.readFileSync(path.join(root, "../dict/kegg-docs2.json"), "utf8"));
const gtexBook = JSON.parse(fs.readFileSync(path.join(root, "../dict/gtex.json"), "utf8"));

const keggSite = sites.find((s) => s.id === "kegg");
const gtexSite = sites.find((s) => s.id === "gtex");
assert.ok(keggSite, "config/sites.json 里应有 kegg 站点");
assert.ok(gtexSite, "config/sites.json 里应有 gtex 站点");

// 生产上按 site.dicts 依次叠加（KEGG 的引导段链接文字由 common/kegg 册翻成中文）。
function stackData(site) {
  const data = { exact: {}, rules: [], templates: [] };
  for (const id of site.dicts) {
    let b;
    try {
      b = JSON.parse(fs.readFileSync(path.join(root, "../dict", id + ".json"), "utf8"));
    } catch (e) {
      continue;
    }
    Object.assign(data.exact, b.exact || {});
    data.rules = data.rules.concat(b.rules || []);
    data.templates = data.templates.concat(b.templates || []);
  }
  return data;
}

function mount(site, html, url) {
  const dom = new JSDOM(html, { url });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: stackData(site),
    site
  });
  engine.start();
  return dom.window.document;
}

const zh = (s) => String(s).replace(/\s+/g, " ").trim();
const hasEnglishWord = (s) => /[a-z]{3,}/.test(s);

// ---------------- KEGG ----------------

test("kegg-docs2：新增 exact 与模板的形态", () => {
  const keys = [
    "KEGG Identifier",
    "is a collection of manually drawn pathway maps representing our knowledge of the molecular interaction, reaction and relation networks for:",
    "are used for different types of maps.",
    "Pathway maps are associated with",
    "KEGG modules",
    "reaction modules",
    "KEGG networks",
    "taxonomic groups",
    "of constituent modules."
  ];
  for (const k of keys) {
    const v = keggBook.exact[k];
    assert.equal(typeof v, "string", "缺少键：" + k);
    assert.ok(/[\u3400-\u9fff]/.test(v), "译文里必须有中文：" + k);
    assert.ok(!/[\u3400-\u9fff]/.test(k), "键里不能有中文：" + k);
    assert.notEqual(k, v, "自映射：" + k);
    assert.equal(v, v.trim(), "译文首尾空白：" + k);
  }
  const tpl = keggBook.templates.find((t) => t.pat.startsWith("Each pathway map is identified"));
  assert.ok(tpl, "缺少通路标识符模板");
  assert.equal(tpl.pat, "Each pathway map is identified by the combination of 2-4 letter prefix code and 5 digit number (see {{1}}). The prefix has the following meaning:");
  const slots = [...tpl.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  const used = [...tpl.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  assert.deepEqual(slots, [1]);
  assert.deepEqual(used, [1]);
  assert.ok(!/[\u3400-\u9fff]/.test(tpl.pat), "pat 不能含中文");
});

test("KEGG pathway 页：PATHWAY 引导段整句中文，<b> 包裹的 KEGG PATHWAY 保持品牌名", () => {
  const doc = mount(
    keggSite,
    "<div class=\"indent\"><b>KEGG PATHWAY</b> is a collection of manually drawn pathway maps " +
      "representing our knowledge of the molecular interaction, reaction and relation networks for:</div>",
    "https://www.genome.jp/kegg/pathway.html"
  );
  const div = doc.querySelector("div.indent");
  const t = zh(div.textContent);
  assert.equal(t, "KEGG PATHWAY 收录人工绘制的通路图，呈现我们对下列各方面的分子相互作用、反应与关系网络的认识：");
  assert.equal(zh(div.querySelector("b").textContent), "KEGG PATHWAY");
});

test("KEGG pathway 页：模块/网络/分类群一句整句中文，四个链接全部保留", () => {
  const doc = mount(
    keggSite,
    "<div class=\"indent\">Pathway maps are associated with " +
      "<a href=\"/kegg/module.html\">KEGG modules</a>, " +
      "<a href=\"/kegg/reaction/rmodule.html\">reaction modules</a>, " +
      "<a href=\"/kegg/network.html\">KEGG networks</a> and " +
      "<a href=\"/kegg/syntax/taxonomy.html\">taxonomic groups</a> of constituent modules.</div>",
    "https://www.genome.jp/kegg/pathway.html"
  );
  const div = doc.querySelector("div.indent");
  const t = zh(div.textContent);
  assert.ok(t.startsWith("通路图与"), "整句开头应是中文，实际：" + t);
  assert.ok(t.endsWith("中的组成模块相关。"), "整句结尾应是中文，实际：" + t);
  assert.ok(!hasEnglishWord(t), "不该再剩下英文单词：" + t);
  const links = [...div.querySelectorAll("a")];
  assert.equal(links.length, 4);
  assert.deepEqual(links.map((a) => zh(a.textContent)), ["KEGG 模块", "反应模块", "KEGG 网络", "分类群"]);
  assert.deepEqual(links.map((a) => a.getAttribute("href")), [
    "/kegg/module.html",
    "/kegg/reaction/rmodule.html",
    "/kegg/network.html",
    "/kegg/syntax/taxonomy.html"
  ]);
});

test("KEGG pathway 页：通路标识符模板整段中文，KEGG Identifier 链接不丢", () => {
  const doc = mount(
    keggSite,
    "<div class=\"list2\">Each pathway map is identified by the combination of 2-4 letter prefix code " +
      "and 5 digit number (see <a href=\"/kegg/kegg3.html\">KEGG Identifier</a>). " +
      "The prefix has the following meaning:</div>",
    "https://www.genome.jp/kegg/pathway.html"
  );
  const div = doc.querySelector("div.list2");
  const t = zh(div.textContent);
  assert.equal(t, "每张通路图由 2-4 个字母的前缀代码与 5 位数字组合标识（参见KEGG 标识符）。各前缀的含义如下：");
  const a = div.querySelector("a");
  assert.ok(a, "KEGG Identifier 链接必须保留");
  assert.equal(a.getAttribute("href"), "/kegg/kegg3.html");
  assert.equal(zh(a.textContent), "KEGG 标识符");
});

test("KEGG pathway 页：被 dl 隔断的 will be used 尾句整句中文", () => {
  const doc = mount(
    keggSite,
    "<div class=\"list2\"><dl><dt>map</dt><dd>manually drawn reference pathway</dd></dl>" +
      "are used for different types of maps.</div>",
    "https://www.genome.jp/kegg/pathway.html"
  );
  const t = zh(doc.querySelector("div.list2").textContent);
  assert.ok(t.endsWith("用于不同类型的图。"), "尾句应是中文，实际：" + t);
});

// ---------------- GTEx ----------------

test("gtex：页脚版权行整句中文，不再残留 All rights reserved.", () => {
  const rule = gtexBook.rules.find((r) => /Broad Institute/.test(r.re));
  assert.ok(rule, "版权行规则应在本册（gtex 先于 gtex-home 命中）");
  assert.match(rule.to, /。保留所有权利。$/, "译文要用中文句号隔开：「…Harvard。保留所有权利。」");
  const doc = mount(
    gtexSite,
    "<div id=\"root\"><footer><span>©2026 Broad Institute of MIT and Harvard. All rights reserved.</span></footer></div>",
    "https://gtexportal.org/home"
  );
  const t = zh(doc.querySelector("footer span").textContent);
  assert.equal(t, "©2026 Broad Institute of MIT and Harvard。保留所有权利。");
  assert.ok(!hasEnglishWord(t.replace("Broad Institute of MIT and Harvard", "")), "除机构名外不该有英文单词");
});

test("gtex-home：首页导航卡片文字仍是中文（回归）", () => {
  const doc = mount(
    gtexSite,
    "<div id=\"root\"><span>Browse and search GTEx histology images</span></div>",
    "https://gtexportal.org/home"
  );
  assert.equal(zh(doc.querySelector("span").textContent), "浏览并检索 GTEx 组织学图像");
});