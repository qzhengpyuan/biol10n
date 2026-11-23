// r35-a：Europe PMC 更正提示、ENA 项目页工具提示与 xref 折叠按钮、PRIDE SDRF 表头。
// 原文全部取自 CDP 9227 实测渲染 DOM（2026-11-24，BioL10n 0.10.39）：
// - europepmc.org/article/MED/34887591 → span.notification.small.informative 内的
//   "This article has been corrected. See" + 引文链接（Nature. 2023 Jun;618(7965):E19-E20. …）
// - www.ebi.ac.uk/ena/browser/view/PRJEB402 → #cdk-describedby-message-18/19 两条提示、
//   三个 mat-icon-button 的 aria-label（Toggle xref / Toggle EuropePMC / Toggle PubMed）
// - www.ebi.ac.uk/pride/archive/projects/PXD000001 → SDRF 预览表 th（文本与 title 同串）
// 口径：只翻提示句与动作名，引文/品牌不翻；PRIDE 表头文本与 th[title] 都翻
// （导出走 TSV 数据，不读 title 属性）。
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

function dataFor(siteId) {
  const site = sites.find((s) => s.id === siteId);
  const exact = {};
  const rules = [];
  const templates = [];
  for (const n of site.dicts) {
    const d = JSON.parse(fs.readFileSync(path.join(root, "../dict/" + n + ".json"), "utf8"));
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
    templates.push(...(d.templates || []));
  }
  return { site, data: { exact, rules, templates } };
}

function boot(siteId, html, url) {
  const { site, data } = dataFor(siteId);
  const dom = new JSDOM(html, { url });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return { dom, engine, doc: dom.window.document, data };
}

const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();
const CJK = /[\u3400-\u9fff]/;

const NEW_EXACT = {
  europepmc: {
    "This article has been corrected. See": "本文已更正。参见"
  },
  ena: {
    "Show the parent umbrella projects that this project is a part of": "显示此项目所属的上级伞形项目",
    "Show the subprojects within this project": "显示此项目内的子项目",
    "Toggle xref": "展开或折叠 xref",
    "Toggle EuropePMC": "展开或折叠 EuropePMC",
    "Toggle PubMed": "展开或折叠 PubMed"
  },
  pride: {
    "source name": "样本来源名称",
    "assay name": "检测名称",
    "technology type": "技术类型"
  }
};

test("r35-a 新增 exact 逐条命中，译文含汉字，品牌原样", () => {
  for (const [siteId, entries] of Object.entries(NEW_EXACT)) {
    const { engine, data } = boot(siteId, "<p>x</p>", "https://europepmc.org/");
    for (const [srcText, want] of Object.entries(entries)) {
      assert.equal(data.exact[srcText], want, siteId + " 词库缺条目：" + srcText);
      assert.equal(engine.translateText(srcText), want, siteId + " 未命中：" + srcText);
      assert.match(want, CJK, siteId + " 译文不含汉字：" + srcText);
    }
  }
  // 品牌名保留：xref / EuropePMC / PubMed 不落中文
  const { engine } = boot("ena", "<p>x</p>", "https://www.ebi.ac.uk/ena/browser/view/PRJEB402");
  assert.equal(engine.translateText("Toggle xref"), "展开或折叠 xref");
  assert.equal(engine.translateText("Toggle EuropePMC"), "展开或折叠 EuropePMC");
  assert.equal(engine.translateText("Toggle PubMed"), "展开或折叠 PubMed");
});

test("Europe PMC 更正提示：只翻提示句，引文链接与期刊缩写原样", () => {
  const CITATION = "Nature. 2023 Jun;618(7965):E19-E20. doi: 10.1038/s41586-023-06194-2.";
  const html =
    '<div class="notification-list" data-v-05478c76="">' +
    '<span class="notification small informative" data-v-0b906ea6="">' +
    '<i class="fas fa-info-circle" data-v-0b906ea6=""></i>\n      ' +
    "This article has been corrected. See\n      " +
    '<a href="/article/MED/37237109" data-v-0b906ea6="">' + CITATION + "</a>.\n    </span></div>";
  const { doc } = boot("europepmc", html, "https://europepmc.org/article/MED/34887591");
  const span = doc.querySelector("span.notification");
  const t = norm(span.textContent);
  assert.ok(t.startsWith("本文已更正。参见"), "提示句未翻：" + t);
  assert.ok(t.includes(CITATION), "引文被改动：" + t);
  // 句末那个孤立 "." 文本节点由引擎标点通道本地化成「。」（既有行为，不改词库）
  assert.equal(t, "本文已更正。参见 " + CITATION + "。");
  assert.ok(!/has been corrected/i.test(span.textContent), "英文提示句残留");
  // 引文链接文本与 href 都不动
  const a = span.querySelector("a");
  assert.equal(norm(a.textContent), CITATION);
  assert.equal(a.getAttribute("href"), "/article/MED/37237109");
});

test("ENA：两条描述提示与三个折叠按钮 aria-label 都翻，图标连字不动", () => {
  const html =
    '<div id="content"><app-root>' +
    '<button mat-icon-button="" class="mat-icon-button" aria-label="Toggle xref">' +
    '<span class="mat-button-wrapper"><mat-icon class="mat-icon material-icons" aria-hidden="true">expand_more</mat-icon></span></button>' +
    '<button mat-icon-button="" class="mat-icon-button" aria-label="Toggle EuropePMC">' +
    '<span class="mat-button-wrapper"><mat-icon class="mat-icon material-icons" aria-hidden="true">chevron_right</mat-icon></span></button>' +
    '<button mat-icon-button="" class="mat-icon-button" aria-label="Toggle PubMed">' +
    '<span class="mat-button-wrapper"><mat-icon class="mat-icon material-icons" aria-hidden="true">chevron_right</mat-icon></span></button>' +
    '<div id="cdk-describedby-message-18">Show the parent umbrella projects that this project is a part of</div>' +
    '<div id="cdk-describedby-message-19">Show the subprojects within this project</div>' +
    "</app-root></div>";
  const { doc } = boot("ena", html, "https://www.ebi.ac.uk/ena/browser/view/PRJEB402");
  const labels = [...doc.querySelectorAll("button.mat-icon-button")].map((b) => b.getAttribute("aria-label"));
  assert.deepEqual(labels, ["展开或折叠 xref", "展开或折叠 EuropePMC", "展开或折叠 PubMed"]);
  assert.equal(norm(doc.querySelector("#cdk-describedby-message-18").textContent), "显示此项目所属的上级伞形项目");
  assert.equal(norm(doc.querySelector("#cdk-describedby-message-19").textContent), "显示此项目内的子项目");
  // 图标连字是 material-icons 的 ligature 文本，不是界面文案，保持英文
  assert.equal(doc.querySelector("mat-icon").textContent, "expand_more");
});

test("PRIDE：SDRF 表头文本与 th[title] 都翻，编码字段名不翻", () => {
  const html =
    '<table class="sdrf-preview"><thead><tr>' +
    '<th title="source name" class="kind-core">source name</th>' +
    '<th title="assay name" class="kind-core">assay name</th>' +
    '<th title="technology type" class="kind-core">technology type</th>' +
    '<th title="characteristics[organism]" class="kind-core">characteristics[organism]</th>' +
    "</tr></thead><tbody><tr>" +
    '<td class="kind-core">Homo sapiens (human)</td>' +
    "</tr></tbody></table>";
  const { doc, engine } = boot("pride", html, "https://www.ebi.ac.uk/pride/archive/projects/PXD000001");
  const ths = [...doc.querySelectorAll("th")];
  assert.deepEqual(ths.map((th) => norm(th.textContent)), ["样本来源名称", "检测名称", "技术类型", "characteristics[organism]"]);
  assert.deepEqual(ths.map((th) => th.getAttribute("title")), ["样本来源名称", "检测名称", "技术类型", "characteristics[organism]"]);
  // SDRF 规范字段名（带方括号的编码字段）不翻，物种学名不翻
  assert.equal(engine.translateText("characteristics[organism]"), null);
  assert.equal(engine.translateText("Homo sapiens (human)"), null);
  assert.equal(norm(doc.querySelector("td").textContent), "Homo sapiens (human)");
});

test("未登记串保持 null：没有加宽成 ^Toggle (.+)$ 的泛型规则", () => {
  const { engine, data } = boot("ena", "<p>x</p>", "https://www.ebi.ac.uk/ena/browser/view/PRJEB402");
  // ENA 册只收这三条 aria-label，未引入跨站泛型 Toggle 规则（reactome 册的 ^Toggle (.+)$ 不在这里）
  assert.equal(data.rules.some((r) => /\^Toggle /.test(String(r.re))), false);
  assert.equal(engine.translateText("Toggle something else"), null);
  assert.equal(engine.translateText("Show the parent umbrella projects"), null);
});
