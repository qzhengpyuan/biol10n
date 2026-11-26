// Human Protein Atlas 剩余英文词库（dict/hpa2.json）校验 + 引擎行为测试
// 覆盖：基因页信息图分组标签（SPECIFICITY/DISTRIBUTION/EXPRESSION/RELIABILITY）、SUMMARY/INFOGRAPHIC 导航标签、
//       /about 资源名录 13 条模板、/about 各图谱小节条目 41 条、/humanproteome/tissue 三段帮助说明模板
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/hpa2.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "hpa");
assert.ok(site, "config/sites.json 里应有 hpa 站点");

// 生产上 common + hpa 与本册一起加载；模板槽位里的 <a> 文字由它们翻成中文。
// 这里只补模板测试真正用到的那几个槽位词，其余保持原样。
const overlay = {
  Tissue: "组织",
  Brain: "脑",
  "Single Cell": "单细胞",
  "Immune Cell": "免疫细胞",
  Subcellular: "亚细胞",
  Cancer: "癌症",
  Blood: "血液",
  "Cell line": "细胞系",
  Structure: "结构",
  Interaction: "相互作用",
  Metabolic: "代谢",
  Isoform: "异构体",
  Evolutionary: "进化",
  specificity: "特异性",
  "detected in all": "全部检出",
  here: "此处",
  "Go to interactive expression cluster page": "前往交互式表达聚类页面"
};

function mount(html) {
  const dom = new JSDOM(html, { url: "https://www.proteinatlas.org/about" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: {
      exact: Object.assign({}, overlay, dict.exact),
      rules: dict.rules,
      templates: dict.templates
    },
    site
  });
  engine.start();
  return dom.window.document;
}

const bodyText = (doc) => (doc.body.textContent || "").replace(/\s+/g, " ").trim();

// ---------------- 结构校验 ----------------

test("词库可解析，meta 指向 hpa", () => {
  assert.equal(dict.meta.family, "hpa");
  assert.deepEqual(dict.meta.sites, ["www.proteinatlas.org"]);
  assert.ok(Array.isArray(dict.rules), "rules 必须是数组");
  // 本册早期不收规则，怕把图表里的数值与专名翻坏；0.13.0 起只为「图表 tooltip 整句」收规则，
  // 每条都必须 requireHit（要求命中已知词才替换），否则数字与基因名会被规则吞掉。
  // 例外：捕获组按设计就不该翻——
  //   「Non-significant (p<0.05)」：捕获组是 p 值，永远命中不了词表，requireHit 会让规则失效；
  //   「TP53 is a prognostic marker in:」：捕获组是基因符号，本来就要原样保留，requireHit 同样会挡掉。
  // 两条都是固定句式 + 槽位，不会误伤数值与专名。
  const noRequireHit = new Set([
    "^Non-significant \\((p<[0-9eE.+-]+)\\)$",
    "^(.+) is a prognostic marker in:$",
  ]);
  for (const r of dict.rules) {
    assert.equal(typeof r.re, "string", "规则必须是 {re,to} 对象");
    assert.equal(typeof r.to, "string");
    if (noRequireHit.has(r.re)) continue;
    assert.equal(r.requireHit, true, "hpa2 的规则必须 requireHit，避免误伤数值与专名：" + r.re);
  }
});

test("exact 与 templates 规模合理", () => {
  assert.ok(Object.keys(dict.exact).length >= 45, "exact 至少 45 条，实际 " + Object.keys(dict.exact).length);
  assert.ok(dict.templates.length >= 16, "templates 至少 16 条，实际 " + dict.templates.length);
});

test("关键条目存在（信息图分组标签与导航标签）", () => {
  const want = {
    SPECIFICITY: "特异性",
    DISTRIBUTION: "分布",
    EXPRESSION: "表达",
    RELIABILITY: "可靠性",
    SUMMARY: "摘要",
    INFOGRAPHIC: "信息图"
  };
  for (const [k, v] of Object.entries(want)) assert.equal(dict.exact[k], v, "缺少或值不符：" + k);
});

test("关键条目存在（about 图谱小节条目，含页面原有拼写 cellines）", () => {
  const want = {
    "if a gene is enriched in a particular cell type (specificity)": "基因是否在特定细胞类型中富集（特异性）",
    "the known and predicted PTMs for the proteins": "蛋白质的已知与预测 PTM",
    "isoform specific protein expression": "异构体特异性蛋白质表达",
    "if a gene is enriched in cellines from a particular cancer type (specificity)":
      "基因是否在特定癌症类型的细胞系中富集（特异性）"
  };
  for (const [k, v] of Object.entries(want)) assert.equal(dict.exact[k], v, "缺少或值不符：" + k);
  // 页面上 cellines 是原站拼写，键必须与原文一致
  assert.ok(Object.keys(dict.exact).some((k) => k.includes("cellines")), "须保留原站拼写 cellines");
});

test("exact 键全英文、值不出现明文 URL 或邮箱，且键值不相等", () => {
  const urlRe = /https?:\/\/|www\./i;
  const mailRe = /[\w.+-]+@[\w-]+\.[\w.-]+/;
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.ok(!/[\u3400-\u9fff]/.test(k), "键里不该有中文：" + k);
    assert.ok(k === k.trim(), "键首尾不能有空白：" + JSON.stringify(k));
    assert.notEqual(k, v, "自映射：" + k);
    assert.ok(/[\u4e00-\u9fff]/.test(v), "值必须是中文：" + k);
    assert.ok(!urlRe.test(v), "值里出现 URL：" + k);
    assert.ok(!mailRe.test(v), "值里出现邮箱：" + k);
  }
});

test("模板：pat 无中文、长度合规、占位符从 1 连续编号且与槽位一一对应", () => {
  for (const t of dict.templates) {
    assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, "pat 长度越界：" + t.pat.slice(0, 40));
    assert.ok(!/[\u3400-\u9fff]/.test(t.pat), "pat 不能含中文：" + t.pat.slice(0, 40));
    assert.ok(/[\u4e00-\u9fff]/.test(t.zh), "zh 必须是中文：" + t.pat.slice(0, 40));
    const used = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    const slots = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.ok(used.length > 0, "zh 必须带占位符：" + t.pat.slice(0, 40));
    assert.equal(used.length, slots.length, "占位符数量不一致：" + t.pat.slice(0, 40));
    assert.deepEqual([...used].sort((a, b) => a - b), slots.map((_, i) => i + 1), "占位符编号须 1..N：" + t.pat.slice(0, 40));
    assert.ok(!/https?:\/\//.test(t.zh), "zh 里出现 URL：" + t.pat.slice(0, 40));
  }
});

// ---------------- 引擎行为 ----------------

test("信息图分组标签在引擎里真的被替换", () => {
  const doc = mount(
    "<ul><li><a class='ui-multiselect-grouplabel'>SPECIFICITY</a></li>" +
      "<li><a class='ui-multiselect-grouplabel'>RELIABILITY</a></li>" +
      "<li><span>INFOGRAPHIC</span></li></ul>"
  );
  assert.match(bodyText(doc), /特异性/);
  assert.match(bodyText(doc), /可靠性/);
  assert.match(bodyText(doc), /信息图/);
  assert.ok(!/SPECIFICITY|RELIABILITY|INFOGRAPHIC/.test(bodyText(doc)), "不应残留原标签");
});

test("about 资源名录：The + 链接 + 说明 的模板替换保留链接", () => {
  const doc = mount(
    "<ul><li>The <a href='/humanproteome/tissue'>Tissue</a> resource, showing the distribution of the proteins " +
      "across all major tissues and organs in the human body</li></ul>"
  );
  const li = doc.querySelector("li");
  assert.equal((li.textContent || "").replace(/\s+/g, " ").trim(), "组织资源，展示蛋白质在人体所有主要组织与器官中的分布");
  assert.equal(li.querySelector("a").getAttribute("href"), "/humanproteome/tissue", "链接必须保留");
  assert.equal((li.querySelector("a").textContent || "").trim(), "组织");
});

test("tissue 页主说明段：四个内联链接按序放回译文", () => {
  const doc = mount(
    "<p>Based on transcriptomics analysis across all major organs and tissue types in the human body, " +
      "all putative 20162 protein coding genes have been classified with regard to abundance and distribution of " +
      'transcribed mRNA molecules, including <a href="/s1">9345</a> proteins showing a significantly elevated level ' +
      'of expression in a particular tissue or a group of related tissues and <a href="/s2">8813</a> proteins ' +
      '<a href="/s3">detected in all</a> organs and tissues. Read more about the different categories of elevated ' +
      'expression <a href="/s4">here</a>.</p>'
  );
  const p = doc.querySelector("p");
  const text = (p.textContent || "").replace(/\s+/g, " ").trim();
  assert.match(text, /^基于对人体所有主要器官与组织类型的转录组学分析/);
  assert.match(text, /全部 20162 个假定蛋白编码基因/);
  assert.equal(p.querySelectorAll("a").length, 4, "四个链接都要留下");
  const hrefs = [...p.querySelectorAll("a")].map((a) => a.getAttribute("href"));
  assert.deepEqual(hrefs, ["/s1", "/s2", "/s3", "/s4"]);
});

test("tissue 页 UMAP 说明与 MS 特异性说明整段翻完", () => {
  const umap = mount(
    "<p>The UMAP was generated by clustering genes based on expression patterns. The colored areas represent " +
      "the area in the UMAP where most of the genes of each cluster reside. Click on a cluster or " +
      '<a href="/humanproteome/tissue/expression+cluster">Go to interactive expression cluster page</a> to view ' +
      "an interactive UMAP and details about all cluster annotations.</p>"
  );
  const t1 = (umap.querySelector("p").textContent || "").replace(/\s+/g, " ").trim();
  assert.match(t1, /^UMAP 由基于表达模式的基因聚类生成/);
  assert.match(t1, /前往交互式表达聚类页面/);
  assert.ok(!/UMAP was generated/.test(t1));

  const ms = mount(
    "<p>Tissue <a href='/humanproteome/tissue/method/MS+based'>specificity</a> was calculated, and is here shown " +
      "as piecharts and bar plot, clickable for target lists, for the two datasets respectively. Protein detection " +
      "(intensity) is displayed at gene-summary pages for more detailed exploration of the data.</p>"
  );
  const t2 = (ms.querySelector("p").textContent || "").replace(/\s+/g, " ").trim();
  assert.match(t2, /^组织特异性已计算/);
  assert.ok(!/was calculated/.test(t2));
});

test("about 小节条目按整条替换", () => {
  const doc = mount("<ul><li>the known and predicted PTMs for the proteins</li></ul>");
  assert.equal((doc.querySelector("li").textContent || "").trim(), "蛋白质的已知与预测 PTM");
});