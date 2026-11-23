// MeSH 主题词页词库（dict/mesh.json）冒烟测试
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/mesh.json"), "utf8"));

const CJK = /[\u4e00-\u9fff]/;
const BAD_VALUE = /(\/mnt\/|\/home\/|\/Users\/[^/\s]+|C:\\\\Users\\\\|[\w.+-]+@[\w-]+\.[\w.]+)/i;

const site = {
  scope: "body",
  attrs: [],
  proseGuard: true,
  proseMax: 120,
  proseExempt: ".usa-banner",
  punctFix: true,
  rescan: false,
  blocks: []
};

function mount(html) {
  const dom = new JSDOM(html, { url: "https://www.ncbi.nlm.nih.gov/mesh/68002034" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: dict.exact, rules: dict.rules, templates: dict.templates || [] },
    site
  });
  engine.start();
  return dom.window.document;
}

function translateText(s) {
  const dom = new JSDOM("<body></body>", { url: "https://www.ncbi.nlm.nih.gov/mesh/Q000008" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: dict.exact, rules: dict.rules, templates: dict.templates || [] },
    site
  });
  return engine.translateText(s);
}

test("词库能解析，meta 与各通道齐全", () => {
  assert.equal(dict.meta.family, "mesh");
  assert.ok(dict.exact && typeof dict.exact === "object");
  assert.ok(Array.isArray(dict.rules));
  assert.ok(Object.keys(dict.exact).length >= 60, "词条数过少");
  for (const r of dict.rules) {
    assert.equal(typeof r.re, "string");
    assert.equal(typeof r.to, "string");
    assert.ok(r.re.startsWith("^") && r.re.endsWith("$"), "规则必须首尾锚定: " + r.re);
    assert.doesNotThrow(() => new RegExp(r.re), "规则无法编译: " + r.re);
    assert.ok(!CJK.test(r.re), "规则 re 含中文: " + r.re);
  }
});

test("键无中文、无自映射、值无明文 URL/邮箱/本机路径", () => {
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.ok(!CJK.test(k), "键含中文: " + k);
    assert.equal(k, k.trim());
    assert.equal(v, String(v).trim());
    assert.notEqual(k, v, "自映射: " + k);
    assert.ok(CJK.test(v), "值不像中文: " + k + " => " + v);
    assert.ok(!BAD_VALUE.test(v), "值含本机信息: " + k + " => " + v);
  }
});

test("主题词页标签：Entry Terms / Previous Indexing / 药理作用 / 树号 / 唯一编号", () => {
  const doc = mount(
    "<div id=\"maincontent\">" +
      "<h1>Bumetanide</h1>" +
      "<p>Entry Terms:</p>" +
      "<ul><li>Bumethanide</li><li>Bumex</li></ul>" +
      "<p>Previous Indexing:</p>" +
      "<ul><li>Benzoates (1974)</li></ul>" +
      "<p>Pharmacologic Action:</p>" +
      "<ul><li>Diuretics</li></ul>" +
      "<p>Tree Number(s): D02.065.884.150, D02.886.590.700.150</p>" +
      "<p>MeSH Unique ID: D002034</p>" +
      "<p>Registry Number: 0Y2S3XUQ5H</p>" +
      "<p class=\"mesh_year_introduced\">Year introduced: 1991(1975)</p>" +
      "</div>"
  );
  const ps = [...doc.querySelectorAll("p")].map((p) => p.textContent);
  assert.deepEqual(ps, [
    "入口词：",
    "先前标引：",
    "药理作用：",
    "树号：D02.065.884.150, D02.886.590.700.150",
    "MeSH 唯一编号：D002034",
    "登记号：0Y2S3XUQ5H",
    "引入年份：1991(1975)"
  ]);
  // 主题词本身与入口词（MeSH 术语名）不翻
  assert.equal(doc.querySelector("h1").textContent, "Bumetanide");
  assert.deepEqual([...doc.querySelectorAll("ul li")].map((li) => li.textContent), [
    "Bumethanide",
    "Bumex",
    "Benzoates (1974)",
    "Diuretics"
  ]);
});

test("副主题词（Qualifiers）与构建器提示句翻译", () => {
  const doc = mount(
    "<div id=\"maincontent\">" +
      "<p>Restrict to MeSH Major Topic.</p>" +
      "<p>Do not include MeSH terms found below this term in the MeSH hierarchy.</p>" +
      "<ul class=\"mesh_subheadings\">" +
      "<li><label>administration and dosage</label></li>" +
      "<li><label>adverse effects</label></li>" +
      "<li><label>cerebrospinal fluid</label></li>" +
      "<li><label>isolation and purification</label></li>" +
      "<li><label>supply and distribution</label></li>" +
      "<li><label>therapeutic use</label></li>" +
      "</ul>" +
      "</div>"
  );
  const labels = [...doc.querySelectorAll("label")].map((l) => l.textContent);
  assert.deepEqual(labels, [
    "给药与剂量",
    "不良效应",
    "脑脊液",
    "分离与纯化",
    "供应与分配",
    "治疗用途"
  ]);
  const ps = [...doc.querySelectorAll("p")].map((p) => p.textContent);
  assert.equal(ps[0], "限定为 MeSH 主要主题词。");
  assert.equal(ps[1], "不包含该词在 MeSH 层级中的下位词。");
});

test("MeSH 树根与格式 tab（All MeSH Categories / Full）翻译，树号与类别名不动", () => {
  const doc = mount(
    "<div id=\"maincontent\">" +
      "<ul><li><a href=\"/mesh/1000048\">All MeSH Categories</a></li>" +
      "<li><a href=\"/mesh/1000068\">Chemicals and Drugs Category</a></li>" +
      "<li><a href=\"/mesh/68002034\">Bumetanide</a></li></ul>" +
      "</div>" +
      "<ul class=\"inline_list left display_settings\">" +
      "<li><label>Full</label></li><li><label>Full (text)</label></li>" +
      "</ul>"
  );
  const links = [...doc.querySelectorAll("a")].map((a) => a.textContent);
  assert.deepEqual(links, ["全部 MeSH 类别", "Chemicals and Drugs Category", "Bumetanide"]);
  assert.deepEqual([...doc.querySelectorAll("label")].map((l) => l.textContent), ["完整", "完整（文本）"]);
});

test("MeSH 首页：标语、简介段、入口链接与搜索框提示语", () => {
  const doc = mount(
    "<div id=\"maincontent\">" +
      "<h2 class=\"res_tagline\">NLM Controlled Vocabulary</h2>" +
      "<div class=\"dbdescription\">MeSH (Medical Subject Headings) is the NLM controlled vocabulary thesaurus used for indexing articles for PubMed.</div>" +
      "<div class=\"portlet_head\">Using MeSH</div>" +
      "<li>Tutorials</li>" +
      "<div class=\"portlet_head\">More Resources</div>" +
      "<li>NLM MeSH Homepage</li>" +
      "<input type=\"text\" title=\"Search MeSH. Use up and down arrows to choose an item from the autocomplete.\">" +
      "</div>"
  );
  assert.equal(doc.querySelector(".res_tagline").textContent, "NLM 受控词表");
  assert.equal(
    doc.querySelector(".dbdescription").textContent,
    "MeSH（医学主题词表）是美国国家医学图书馆的受控词表，用于为 PubMed 的文章做标引。"
  );
  assert.equal([...doc.querySelectorAll(".portlet_head")][0].textContent, "使用 MeSH");
  assert.equal([...doc.querySelectorAll(".portlet_head")][1].textContent, "更多资源");
  assert.deepEqual([...doc.querySelectorAll("li")].map((li) => li.textContent), ["教程", "NLM MeSH 主页"]);
  assert.equal(
    doc.querySelector("input").getAttribute("title"),
    "检索 MeSH。使用上下方向键从自动补全列表中选择条目。"
  );
});

test("检索结果页：检索构建器与检索 PubMed 按钮", () => {
  const doc = mount(
    "<div id=\"maincontent\">" +
      "<h3>PubMed Search Builder</h3>" +
      "<button>Add to search builder</button>" +
      "<button>Search PubMed</button>" +
      "<h3 class=\"result_count left\">Items 1 - 20 of 30</h3>" +
      "</div>"
  );
  assert.equal(doc.querySelector("h3").textContent, "PubMed 检索构建器");
  assert.deepEqual([...doc.querySelectorAll("button")].map((b) => b.textContent), [
    "添加到检索构建器",
    "检索 PubMed"
  ]);
});

// Q000008 实测 h1 是两个空格："administration  and  dosage [Subheading]"
// （https://www.ncbi.nlm.nih.gov/mesh/Q000008，2026-11-22）。规则锚定整串，
// 裸词条（administration and dosage）仍走 exact，不能被加上「限定词」。
test("副主题词页：整串 [Subheading] 只加全角（限定词），裸词不误伤", () => {
  assert.equal(translateText("administration and dosage [Subheading]"), "给药与剂量（限定词）");
  assert.equal(translateText("administration  and  dosage [Subheading]"), "给药与剂量（限定词）");
  assert.equal(translateText("adverse effects [Subheading]"), "不良效应（限定词）");
  assert.equal(translateText("administration and dosage"), "给药与剂量");
  assert.equal(translateText("adverse effects"), "不良效应");
});

test("副主题词页 h1：真实 DOM 的双空格标题整条译出", () => {
  const doc = mount('<h1 class="title">administration  and  dosage [Subheading]</h1>');
  assert.equal(doc.querySelector("h1").textContent, "给药与剂量（限定词）");
});
