// EMBL-EBI（www.ebi.ac.uk）通用页头/页脚与 404 页文案（dict/string-atlas.json 增量）回归。
// 站点词库栈与 config/sites.json 的 embl-ebi 一致：common + string-atlas + spa。
// 取证：Chrome 影子实例 CDP 9227 抓的真实 DOM 文本节点
//   https://www.ebi.ac.uk/does-not-exist-xyz （404 页）
//   https://www.ebi.ac.uk/ （页头导航 / 搜索分类 / 页脚）
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

const dict = read("string-atlas.json");
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;
const SITE = { scope: "body", block: "pre, code", rescan: false };

function siteData() {
  const exact = {}, rules = [], templates = [];
  for (const f of ["common.json", "string-atlas.json", "spa.json"]) {
    const d = read(f);
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
    templates.push(...(d.templates || []));
  }
  return { exact, rules, templates };
}

function boot(html) {
  const dom = new JSDOM(html, { url: "https://www.ebi.ac.uk/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: siteData(),
    site: SITE
  });
  engine.start();
  return { dom, engine, doc: dom.window.document };
}

// r24 补的页头页脚与 404 文案：键 = 页面真实文本节点原串（大小写、弯引号均按 DOM）
const ADDED = {
  "Error: 404": "错误：404",
  "We\u2019re sorry, the page you were looking for is no longer available.": "抱歉，您要查找的页面已不存在。",
  "Don't be discouraged, negative results are the backbone of science.": "别灰心，阴性结果正是科学的脊梁。",
  "Use our search to get back on track.": "使用我们的搜索功能回到正轨。",
  "Need help?": "需要帮助？",
  "Contact our support team": "联系我们的支持团队",
  "About EBI Search": "关于 EBI Search",
  "Example searches:": "示例检索：",
  "EMBL-EBI home": "EMBL-EBI 主页",
  "Support and feedback": "支持与反馈",
  "Long-term data preservation": "长期数据保存",
  "Access and benefit sharing": "获取与惠益分享",
  "People and groups": "人员与团队",
  "Full contact details": "完整联系方式",
  "Terms of use": "使用条款",
  "EMBL-EBI is part of the": "EMBL-EBI 是以下机构的一部分：",
  "EMBL-EBI is the home for big data in biology.": "EMBL-EBI 是生物学大数据之家。",
  "We help scientists exploit complex information to make discoveries that benefit humankind.": "我们帮助科学家利用复杂信息做出造福人类的发现。",
  "Choose a category": "选择类别",
  "Genomes & metagenomes": "基因组与宏基因组",
  "Nucleotide sequences": "核苷酸序列",
  "Protein sequences": "蛋白序列",
  "Small molecules": "小分子",
  "Gene expression": "基因表达",
  "Gene-Disease Associations": "基因-疾病关联",
  "Diseases": "疾病",
  "Molecular interactions": "分子相互作用",
  "Reactions & pathways": "反应与通路",
  "Protein families": "蛋白质家族",
  "Literature": "文献",
  "Samples & ontologies": "样本与本体",
  "EMBL-EBI People": "EMBL-EBI 人员",
  "EMBL-EBI web": "EMBL-EBI 网站",
  "Homepage quicklinks": "首页快捷入口",
  "Find data resources": "查找数据资源",
  "Submit data": "提交数据",
  "Explore our research": "探索我们的研究",
  "Train with us": "参加我们的培训",
  "Latest news": "最新新闻",
  "Data resources": "数据资源",
  "About EMBL": "关于 EMBL"
};

test("词库结构：41 条新词条在册、键为规整英文原串、年份用规则", () => {
  const bad = [];
  for (const [en, zh] of Object.entries(ADDED)) {
    if (!Object.prototype.hasOwnProperty.call(dict.exact, en)) bad.push("缺条目: " + en);
    else if (dict.exact[en] !== zh) bad.push("译法不符: " + en + " => " + dict.exact[en]);
  }
  assert.deepEqual(bad, []);
  for (const en of Object.keys(ADDED)) {
    if (en !== en.trim()) bad.push("键首尾空白: " + JSON.stringify(en));
    if (/\s\s/.test(en)) bad.push("键含连续空白: " + JSON.stringify(en));
    if (CJK.test(en)) bad.push("键含中文: " + en);
  }
  assert.deepEqual(bad, []);
  const cr = (dict.rules || []).filter((r) => /Copyright © EMBL/.test(r.re));
  assert.deepEqual(cr, [{ re: "^Copyright © EMBL (\\d{4})$", to: "版权所有 © EMBL $1" }]);
  // 页脚年份不能写死成 2026 的 exact
  assert.ok(!Object.prototype.hasOwnProperty.call(dict.exact, "Copyright © EMBL 2026"));
});

test("translateText：404 文案与通用页头页脚逐条命中", () => {
  const { engine } = boot("<body></body>");
  for (const [en, zh] of Object.entries(ADDED)) {
    assert.equal(engine.translateText(en), zh, "未命中: " + en);
  }
});

test("规则：Copyright © EMBL <年份> 保留年份", () => {
  const { engine } = boot("<body></body>");
  assert.equal(engine.translateText("Copyright © EMBL 2026"), "版权所有 © EMBL 2026");
  assert.equal(engine.translateText("Copyright © EMBL 2027"), "版权所有 © EMBL 2027");
  assert.equal(engine.translateText("2004"), null);
});

test("jsdom：404 页真实骨架（h1 + 三段说明 + Need help? + 支持链接）", () => {
  const { doc } = boot(
    '<body><div class="vf-stack">' +
      '<h1 class="vf-intro__heading">Error: 404</h1>' +
      '<p class="vf-lede">We\u2019re sorry, the page you were looking for is no longer available.</p>' +
      '<p class="vf-intro__text">Don\'t be discouraged, negative results are the backbone of science.</p>' +
      '<p class="vf-intro__text">Use our search to get back on track.</p>' +
      "</div>" +
      '<h3>Need help?</h3>' +
      '<a class="vf-button vf-button--primary" href="https://www.ebi.ac.uk/support/error">Contact our support team</a>' +
      '<a class="vf-link" href="https://www.ebi.ac.uk/ebisearch/overview.ebi/about">About EBI Search</a>' +
      "</body>"
  );
  assert.equal(doc.querySelector("h1").textContent, "错误：404");
  const ps = [...doc.querySelectorAll("p")].map((p) => p.textContent);
  assert.deepEqual(ps, [
    "抱歉，您要查找的页面已不存在。",
    "别灰心，阴性结果正是科学的脊梁。",
    "使用我们的搜索功能回到正轨。"
  ]);
  assert.equal(doc.querySelector("h3").textContent, "需要帮助？");
  assert.equal(doc.querySelector(".vf-button").textContent, "联系我们的支持团队");
  assert.equal(doc.querySelector(".vf-link").textContent, "关于 EBI Search");
});

test("jsdom：真实页脚（服务/研究/关于链接 + 版权年份规则）", () => {
  const { doc } = boot(
    '<body><footer class="vf-footer"><div class="vf-footer__inner">' +
      '<p class="vf-footer__notice"><a class="vf-footer__link" href="//www.ebi.ac.uk/about/our-impact">EMBL-EBI is the home for big data in biology.</a></p>' +
      '<p class="vf-footer__notice"> We help scientists exploit complex information to make discoveries that benefit humankind. </p>' +
      '<div class="vf-links"><h4 class="vf-links__heading"><a class="vf-heading__link" href="//www.ebi.ac.uk/services">Services</a></h4>' +
      '<ul class="vf-links__list"><li class="vf-list__item"><a class="vf-list__link" href="//www.ebi.ac.uk/support">Support and feedback</a></li>' +
      '<li class="vf-list__item"><a class="vf-list__link" href="//www.ebi.ac.uk/licencing">Licensing</a></li>' +
      '<li class="vf-list__item"><a class="vf-list__link" href="//www.ebi.ac.uk/long-term-data-preservation">Long-term data preservation</a></li>' +
      '<li class="vf-list__item"><a class="vf-list__link" href="//www.ebi.ac.uk/abs-dsi">Access and benefit sharing</a></li></ul></div>' +
      '<div class="vf-links"><h4 class="vf-links__heading"><a class="vf-heading__link" href="//www.ebi.ac.uk/about">About</a></h4>' +
      '<ul class="vf-links__list"><li class="vf-list__item"><a class="vf-list__link" href="//www.ebi.ac.uk/about/people">People and groups</a></li></ul></div>' +
      '<p class="vf-footer__notice"><a class="vf-footer__link" href="//www.ebi.ac.uk/about/contact">Full contact details</a></p>' +
      '<p class="vf-footer__notice">Copyright © EMBL 2026</p>' +
      "<p>EMBL-EBI is part of the <a href=\"//www.embl.org\">European Molecular Biology Laboratory</a>.</p>" +
      '<p><a class="vf-list__link" href="//www.ebi.ac.uk/about/terms-of-use">Terms of use</a></p>' +
      "</div></footer></body>"
  );
  const texts = [...doc.querySelectorAll("a, p, h4")].map((e) => e.textContent.trim());
  for (const zh of [
    "EMBL-EBI 是生物学大数据之家。",
    "我们帮助科学家利用复杂信息做出造福人类的发现。",
    "服务",
    "支持与反馈",
    "许可",
    "长期数据保存",
    "获取与惠益分享",
    "关于",
    "人员与团队",
    "完整联系方式",
    "版权所有 © EMBL 2026",
    "使用条款"
  ]) {
    assert.ok(texts.includes(zh), "页脚未译: " + zh);
  }
  // 段落被 <a> 切成两段文本：前半句走 exact，链接里的机构名按口径不翻
  assert.ok(doc.body.textContent.includes("EMBL-EBI 是以下机构的一部分："));
  assert.ok(doc.body.textContent.includes("European Molecular Biology Laboratory。"));
});

test("jsdom：页头导航 + 搜索分类下拉（真实 option 文本）", () => {
  const { doc } = boot(
    '<body><header><nav>' +
      '<a href="https://www.ebi.ac.uk">EMBL-EBI</a>' +
      '<a href="https://www.ebi.ac.uk/about">About us</a>' +
      '<a href="https://www.ebi.ac.uk">EMBL-EBI home</a>' +
      "</nav></header>" +
      '<div class="vf-search"><label for="cat">Choose a category</label><select id="cat">' +
      "<option>All</option><option>Genomes &amp; metagenomes</option><option>Nucleotide sequences</option>" +
      "<option>Protein sequences</option><option>Small molecules</option><option>Gene expression</option>" +
      "<option>Gene-Disease Associations</option><option>Diseases</option><option>Molecular interactions</option>" +
      "<option>Reactions &amp; pathways</option><option>Protein families</option><option>Literature</option>" +
      "<option>Samples &amp; ontologies</option><option>EMBL-EBI People</option><option>EMBL-EBI web</option>" +
      "</select></div>" +
      '<p><span>Homepage quicklinks</span><a href="https://www.ebi.ac.uk/services">Data resources</a>' +
      '<a href="https://www.ebi.ac.uk/services">Find data resources</a><a href="https://www.ebi.ac.uk/submission">Submit data</a>' +
      '<a href="https://www.ebi.ac.uk/research">Explore our research</a><a href="https://www.ebi.ac.uk/training">Train with us</a>' +
      '<a href="https://www.ebi.ac.uk/about/news">Latest news</a><a href="https://www.embl.org/">About EMBL</a></p>' +
      "</body>"
  );
  const navTexts = [...doc.querySelectorAll("header a")].map((a) => a.textContent);
  assert.deepEqual(navTexts, ["EMBL-EBI", "关于我们", "EMBL-EBI 主页"]);
  assert.equal(doc.querySelector("label").textContent, "选择类别");
  const opts = [...doc.querySelectorAll("option")].map((o) => o.textContent);
  assert.deepEqual(opts, [
    "全部",
    "基因组与宏基因组",
    "核苷酸序列",
    "蛋白序列",
    "小分子",
    "基因表达",
    "基因-疾病关联",
    "疾病",
    "分子相互作用",
    "反应与通路",
    "蛋白质家族",
    "文献",
    "样本与本体",
    "EMBL-EBI 人员",
    "EMBL-EBI 网站"
  ]);
  const p = doc.querySelector("p");
  for (const zh of ["首页快捷入口", "数据资源", "查找数据资源", "提交数据", "探索我们的研究", "参加我们的培训", "最新新闻", "关于 EMBL"]) {
    assert.ok(p.textContent.includes(zh), "快捷入口未译: " + zh);
  }
});
