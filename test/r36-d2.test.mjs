// r36-d2：三条「需模板」残留的落库验证。原文全部取自真实渲染 DOM。
// 取法：本机注入 0.10.40 后调用 window.__BIOL10N.disable() 还原逐节点/逐属性原文，再用探针
// （/mnt/E/临时文件/probe.mjs，CDP 9227）取 outerHTML；2026-11-24 采集。
// 口径：三处都不是「缺词」，而是逐节点打不中整句——
//   1) Reactome 图例 <p> 只有 3 个文本节点 + 2 个 <wbr>，零槽位 → 模板通道不可用（见第一组注释），
//      改走段落通道（exact 整句，translateParagraphs：src/engine.js:1396）；
//   2) Reactome 通路示意图 alt/title 是「固定短语 + 通路名」，走属性规则；
//   3) GDC 数据处理页长段走整句模板；InterPro Kringle 描述被引用上标切成三个内联 div，逐段 exact。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;

function load(...names) {
  const exact = {};
  const rules = [];
  const templates = [];
  for (const n of names) {
    const d = JSON.parse(fs.readFileSync(path.join(root, "../dict/" + n + ".json"), "utf8"));
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
    templates.push(...(d.templates || []));
  }
  return { exact, rules, templates };
}

function boot(siteId, html, url, dataOverride) {
  const site = sites.find((s) => s.id === siteId);
  const data = dataOverride || load(...site.dicts);
  const dom = new JSDOM(html, { url });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return { dom, engine, doc: dom.window.document };
}

// ---- 真实渲染 DOM（还原后的原文） ----
const REACT_LEGEND_HTML = "<p>\n        Results are shown as five categories: (▲▲) significantly up-regulated,\n        (▲) non-significantly up-regulated, (▼) non-signifi<wbr>cantly down-regulated,\n        (▼▼) signifi<wbr>cantly down-regulated, and not (-) found.\n    </p>";
const REACT_LEGEND_ZH = "结果分为五类：（▲▲）显著上调、（▲）非显著上调、（▼）非显著下调、（▼▼）显著下调，以及未检出（-）。";
const REACT_LEGEND_EN = "Results are shown as five categories: (▲▲) significantly up-regulated, (▲) non-significantly up-regulated, (▼) non-significantly down-regulated, (▼▼) significantly down-regulated, and not (-) found.";

const GDC_P_HTML = "<p>The GDC draws upon the expertise of collaborators in the development of pipelines supporting data processing including the standardization of associated biospecimen and clinical data, the re-alignment of DNA and RNA sequence data against a common reference genome build, and the generation of derived data. GDC pipelines are implemented using data processing software and algorithms selected in consultation with the expert genomics community. GDC Workflows including fully implemented bioinformatics tools, Common Workflow Language (CWL) scripts, and Docker files are available in the <a href=\"https://github.com/NCI-GDC/gdc-workflow-overview\" class=\"ext\" data-extlink=\"\" target=\"_blank\" rel=\"noopener\" title=\"(opens in a new window)\">GDC Workflow GitHub Repository<svg focusable=\"false\" width=\"1em\" height=\"1em\" class=\"ext\" data-extlink-placement=\"append\" aria-label=\"(link is external)\" viewBox=\"0 0 80 40\" role=\"img\" aria-hidden=\"false\"><title>(link is external)</title><path d=\"M48 26c-1.1 0-2 0.9-2 2v26H10V18h26c1.1 0 2-0.9 2-2s-0.9-2-2-2H8c-1.1 0-2 0.9-2 2v40c0 1.1 0.9 2 2 2h40c1.1 0 2-0.9 2-2V28C50 26.9 49.1 26 48 26z\"></path><path d=\"M56 6H44c-1.1 0-2 0.9-2 2s0.9 2 2 2h7.2L30.6 30.6c-0.8 0.8-0.8 2 0 2.8C31 33.8 31.5 34 32 34s1-0.2 1.4-0.6L54 12.8V20c0 1.1 0.9 2 2 2s2-0.9 2-2V8C58 6.9 57.1 6 56 6z\"></path></svg></a> for reproducibility and are documented in the <a href=\"https://docs.gdc.cancer.gov/Data/Introduction/\">GDC Documentation Site</a>.</p>";
const GDC_P_ZH = "GDC 借助合作者的专业能力开发支持数据处理的流程，涵盖相关生物样本与临床数据的标准化、将 DNA 与 RNA 序列数据重新比对到统一的参考基因组版本，以及衍生数据的生成。GDC 流程使用经与基因组学专家社区协商选定的数据处理软件与算法实现。包含完整实现的生物信息学工具、通用工作流语言（CWL）脚本与 Docker 文件的 GDC 工作流可在GDC Workflow GitHub Repository（外部链接）中获取以保证可重现性，并记录在GDC 文档站点中。";

const IPRO_DESC_HTML = "<div class=\"description Description_style__description___e6\" data-testid=\"description\"><div class=\"content Description_style__content___b2\"><div><div class=\"inline Description_style__inline___c9\">Kringles are autonomous structural domains, found throughout the blood clotting and fibrinolytic proteins. Kringle domains are believed to play a role in binding mediators (e.g., membranes, other proteins or phospholipids), and in the regulation of proteolytic activity </div><sup>[<a id=\"description-1\" href=\"/interpro/entry/InterPro/IPR000001/#PUB00002414\" class=\"text-high Description_style__text-high___f0\">1, </a><a id=\"description-3\" href=\"/interpro/entry/InterPro/IPR000001/#PUB00001541\" class=\"text-high Description_style__text-high___f0\">3, </a><a id=\"description-6\" href=\"/interpro/entry/InterPro/IPR000001/#PUB00003257\" class=\"text-high Description_style__text-high___f0\">6</a>]</sup><div class=\"inline Description_style__inline___c9\">. Kringle domains </div><sup>[<a id=\"description-2\" href=\"/interpro/entry/InterPro/IPR000001/#PUB00003400\" class=\"text-high Description_style__text-high___f0\">2, </a><a id=\"description-5\" href=\"/interpro/entry/InterPro/IPR000001/#PUB00000803\" class=\"text-high Description_style__text-high___f0\">5, </a><a id=\"description-4\" href=\"/interpro/entry/InterPro/IPR000001/#PUB00001620\" class=\"text-high Description_style__text-high___f0\">4</a>]</sup><div class=\"inline Description_style__inline___c9\"> are characterised by a triple loop, 3-disulphide bridge structure, whose conformation is defined by a number of hydrogen bonds and small pieces of anti-parallel β-sheet. They are found in a varying number of copies in some plasma proteins including prothrombin and urokinase-type plasminogen activator, which are serine proteases belonging to MEROPS peptidase family S1A.</div></div></div></div>";
const IPRO_DESC_ZH = "Kringle 是自主的结构域，见于凝血与纤溶蛋白。Kringle 结构域被认为参与结合介质（例如膜、其他蛋白或磷脂）并参与蛋白水解活性的调控 [1, 3, 6]。Kringle 结构域 [2, 5, 4] 以三重环、3 个二硫键桥的结构为特征，其构象由若干氢键与少量反平行 β-折叠片段决定。它们在某些血浆蛋白中以不同拷贝数出现，包括凝血酶原与尿激酶型纤溶酶原激活物，二者属于 MEROPS 肽酶家族 S1A 的丝氨酸蛋白酶。";

// ---------- 1. Reactome 分析叠加层图例：零槽位 → 段落通道 ----------
// 现场结构（探针实测）：<p> 里只有 3 个文本节点 + 2 个 <wbr>，<wbr> 断在单词中间
// （"signifi" + "cantly"），逐节点 exact 必失败。buildTemplate（src/engine.js:1441）对空文本的内联
// 元素走 extras、不占槽位（src/engine.js:1461），最后在 src/engine.js:1469 "if (!slots.length) return null;"
// 返回 null——所以这一段的模板通道在结构上无解，改由 translateParagraphs（src/engine.js:1396）
// 用整句 exact 整块替换。本条落的是段落通道，不是模板。
test("Reactome 图例整句：段落通道整块命中，无需模板", () => {
  const { doc, engine } = boot("reactome", REACT_LEGEND_HTML, "https://reactome.org/PathwayBrowser/#/R-HSA-109582");
  const p = doc.querySelector("p");
  assert.equal(p.textContent.trim(), REACT_LEGEND_ZH, "整句应换成中文");
  assert.equal(engine.stats.tpl, 0, "模板通道未参与（零槽位走不通）");
  assert.equal(engine.stats.paras, 1, "段落通道命中 1 次");
  assert.equal(p.querySelectorAll("wbr").length, 0, "段落通道整块替换，<wbr> 一并消失（视觉等价）");
});

test("Reactome 图例：零占位符模板被引擎与 check.mjs 双向拒绝", () => {
  // 引擎侧：pat 无 {{n}} 时 buildTemplate 因无槽位返回 null（src/engine.js:1469）
  const data = { exact: {}, rules: [], templates: [{ pat: REACT_LEGEND_EN, zh: REACT_LEGEND_ZH }] };
  const { doc, engine } = boot("reactome", REACT_LEGEND_HTML, "https://reactome.org/PathwayBrowser/#/R-HSA-109582", data);
  assert.match(doc.querySelector("p").textContent, /Results are shown as five categories/, "零槽位模板不会被套用");
  assert.equal(engine.stats.tpl, 0);
  // 工具侧：tools/check.mjs:57 对「模板 pat 没有占位符」直接报错，所以也加不了空 {{n}} 绕过
  const reactome = JSON.parse(fs.readFileSync(path.join(root, "../dict/reactome.json"), "utf8"));
  for (const t of reactome.templates) {
    assert.match(t.pat, /\{\{1\}\}/, "模板 pat 必须有占位符: " + t.pat.slice(0, 40));
  }
  // <wbr> 不计槽位：这一段除了 <wbr> 没有任何内联元素可当槽位
  const kids = [...doc.querySelector("p").childNodes];
  assert.equal(kids.filter((n) => n.nodeType === 1).length, 2, "只有两个 <wbr>");
  assert.equal(kids.filter((n) => n.nodeType === 1).every((n) => n.tagName === "WBR" && !String(n.textContent).trim()), true, "<wbr> 全为空文本，不占槽位");
});

// ---------- 2. Reactome 通路示意图 alt/title ----------
test("Reactome 示意图 alt/title 走属性规则：Illustration for X → X 示意图", () => {
  const { engine } = boot("reactome", "<p>x</p>", "https://reactome.org/PathwayBrowser/#/R-HSA-109582");
  assert.equal(engine.translateText("Illustration for Hemostasis"), "止血 示意图", "通路名 Hemostasis 由既有 ^Hemostasis$ 规则译出");
  assert.equal(engine.translateText("Illustration for Signaling by Rho GTPases"), "Signaling by Rho GTPases 示意图", "通路名不在词库时原样保留，固定短语照翻");
  assert.equal(engine.translateText("Illustration of Hemostasis"), null, "非整串匹配不替换");
  assert.equal(engine.translateText("Illustration:"), null);
  assert.ok(load("reactome").rules.some((r) => r.re === "^Illustration for (.+)$" && r.to === "$1 示意图"), "词库里有该规则");
});

test("Reactome 示意图 alt/title：属性通道真替换 img 的两个属性", () => {
  const html = '<p>x</p><img class="gwt-Image" alt="Illustration for Hemostasis" title="Illustration for Hemostasis" src="about:blank">';
  const { doc } = boot("reactome", html, "https://reactome.org/PathwayBrowser/#/R-HSA-109582");
  const img = doc.querySelector("img");
  assert.equal(img.getAttribute("alt"), "止血 示意图");
  assert.equal(img.getAttribute("title"), "止血 示意图");
});

// ---------- 3. GDC 数据处理页长段（两条链接） ----------
// 现场结构：<p> 里 2 个 <a>（第一个 <a> 内还嵌一个外链 <svg>，isInlineSubtree 放行），文本节点 3 段：
// 起句 -> 链接 -> 句中 -> 链接 -> 尾句点。首扫时尾句点仍是半角 "."，pat 不含中文（src/engine.js:1471），
// 模板通道可用；把 "." 本地化成 "。" 发生在模板替换之后，重扫时元素已带 data-biol10n-tpl 且含汉字，不会再套。
test("GDC 数据处理长段：模板整段命中，两条链接与内嵌 svg 原位保留", () => {
  const { doc, engine } = boot("gdc-docs", GDC_P_HTML, "https://gdc.cancer.gov/about-data/gdc-data-processing");
  const p = doc.querySelector("p");
  assert.equal(engine.stats.tpl, 1, "模板通道命中");
  assert.equal(p.textContent, GDC_P_ZH, "整段中文");
  assert.equal(p.querySelectorAll("a").length, 2, "两条链接都在");
  assert.equal(p.querySelectorAll("a")[0].getAttribute("href"), "https://github.com/NCI-GDC/gdc-workflow-overview");
  assert.equal(p.querySelectorAll("a")[1].getAttribute("href"), "https://docs.gdc.cancer.gov/Data/Introduction/");
  assert.equal(p.querySelectorAll("svg").length, 1, "第一个链接里的外链图标仍在");
  assert.doesNotMatch(p.textContent, /reproducibility/, "句中残片不再留英文");
  const tpl = load("gdc-docs").templates.find((t) => t.pat.startsWith("The GDC draws upon the expertise") && t.pat.indexOf("for reproducibility") > 0);
  assert.ok(tpl, "词库里应有这段模板");
  assert.equal((tpl.pat.match(/\{\{\d+\}\}/g) || []).join(","), "{{1}},{{2}}");
  assert.ok(tpl.pat.endsWith("documented in the {{2}}."), "pat 以半角句点收尾（首扫时的真实文本）");
  assert.ok(!/[\u4e00-\u9fff]/.test(tpl.pat), "pat 不含中文");
});

// ---------- 4. InterPro 条目描述（Kringle） ----------
// 现场结构：一段说明被两个引用上标 <sup>[1, 3, 6]</sup> / <sup>[2, 5, 4]</sup> 切成三个 div.inline；
// 每个 div 内部只有一个文本节点，所以逐节点 exact 即可覆盖整句、上标原位保留。
// 做不成模板：父节点里是 div（src/engine.js:1495 跳过含 div 的容器），且 buildTemplate 的槽位只收
// INLINE_TAGS，div 不在其中（src/engine.js:1456 直接 return null）。
test("InterPro Kringle 描述：三段内联 div 逐段命中，引用上标原位保留", () => {
  const { doc, engine } = boot("interpro", IPRO_DESC_HTML, "https://www.ebi.ac.uk/interpro/entry/InterPro/IPR000001/");
  const full = String(doc.querySelector('div[class*="Description_style__description"]').textContent).replace(/\s+/g, " ").trim();
  assert.equal(full, IPRO_DESC_ZH, "整段（含上标）读下来应是完整中文");
  assert.equal(doc.querySelectorAll('div[class*="Description_style__inline"]').length, 3);
  assert.equal(doc.querySelectorAll("sup").length, 2, "两个引用上标仍在");
  assert.match(full, /的调控 \[1, 3, 6\]。Kringle 结构域 \[2, 5, 4\] 以三重环/, "上标落在原位置（句读两侧）");
  assert.doesNotMatch(full, /autonomous structural/, "英文原句不再残留");
  assert.equal(engine.stats.tpl, 0, "本段没有走模板通道");
  const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/interpro.json"), "utf8"));
  for (const k of [
    "Kringles are autonomous structural domains, found throughout the blood clotting and fibrinolytic proteins. Kringle domains are believed to play a role in binding mediators (e.g., membranes, other proteins or phospholipids), and in the regulation of proteolytic activity",
    ". Kringle domains",
    "are characterised by a triple loop, 3-disulphide bridge structure, whose conformation is defined by a number of hydrogen bonds and small pieces of anti-parallel β-sheet. They are found in a varying number of copies in some plasma proteins including prothrombin and urokinase-type plasminogen activator, which are serine proteases belonging to MEROPS peptidase family S1A."
  ]) {
    assert.ok(book.exact[k], "词库缺条目: " + k.slice(0, 50));
  }
});

test("InterPro 描述：未登记的邻近英文不被误伤", () => {
  const { engine } = boot("interpro", "<p>x</p>", "https://www.ebi.ac.uk/interpro/entry/InterPro/IPR000001/");
  assert.equal(engine.translateText("Kringle domains are believed to play a role"), null);
  assert.equal(engine.translateText("are characterised by a triple loop"), null);
  assert.equal(engine.translateText("Kringle superfamily"), null);
});
