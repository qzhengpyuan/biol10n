// r60 GTEx 长尾补译：组织学查看器、采样点解剖图、FAQ 致谢句与降序排序
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const { createEngine } = new Function(src + "\nreturn { createEngine };")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/gtex.json"), "utf8"));
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;
const SITE = { scope: "body", block: "pre, code", rescan: false };

function boot(html) {
  const dom = new JSDOM("<body>" + html + "</body>", { url: "https://gtexportal.org/home/histologyPage" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: dict.exact, rules: dict.rules || [], templates: dict.templates || [] },
    site: SITE
  });
  engine.start();
  return dom.window.document;
}

test("词库形状与规模", () => {
  assert.ok(Array.isArray(dict.rules) && Array.isArray(dict.templates));
  for (const r of dict.rules) assert.equal(typeof r.re, "string");
  for (const t of dict.templates) assert.equal(typeof t.pat, "string");
  assert.ok(Object.keys(dict.exact).length >= 530, "exact 太少: " + Object.keys(dict.exact).length);
  assert.ok(dict.rules.length >= 14, "rules 太少: " + dict.rules.length);
  assert.ok(dict.templates.length >= 41, "templates 太少: " + dict.templates.length);
});

test("新增 exact 条目：无首尾空白、无自映射、译文都有汉字", () => {
  const bad = [];
  for (const [en, zh] of Object.entries(dict.exact)) {
    if (!en || en !== en.trim()) bad.push("键空白: " + JSON.stringify(en));
    if (!zh || String(zh) !== String(zh).trim()) bad.push("值空白: " + en);
    if (en === zh) bad.push("自映射: " + en);
    if (!CJK.test(zh)) bad.push("无中文: " + en);
  }
  assert.deepEqual(bad, []);
});

test("组织学查看器：标题、检索文案、表头", () => {
  const doc = boot(
    "<h1>GTEx Histology Viewer</h1>" +
    "<h4>Find histology image by tissue sample ID</h4>" +
    "<table><thead><tr><th>Viewed</th><th>Tissue Sample ID</th><th>Subject ID</th><th>Age Bracket</th><th>Hardy Scale</th><th>Pathology Categories</th><th>Pathology Notes</th></tr></thead></table>" +
    "<p>(When in Multi-Image Mode, multiple rows from the sample table may be selected and viewed.)</p>"
  );
  assert.match(doc.querySelector("h1").textContent, /组织学查看器/);
  assert.match(doc.querySelector("h4").textContent, /按组织样本 ID 查找组织学图像/);
  const ths = [...doc.querySelectorAll("th")].map((x) => x.textContent.trim());
  for (const want of ["已查看", "组织样本 ID", "受试者 ID", "年龄段", "Hardy 量表", "病理类别", "病理备注"]) {
    assert.ok(ths.includes(want), "表头缺中文: " + want + " / 实际: " + ths.join(","));
  }
  assert.match(doc.querySelector("p:last-of-type").textContent, /多图模式/);
});

test("组织学查看器：降序排序 aria-label 规则", () => {
  const doc = boot("<table><thead><tr><th aria-label=\"Tissue Sample ID: activate to sort column descending\">Tissue Sample ID</th></tr></thead></table>");
  assert.equal(doc.querySelector("th").getAttribute("aria-label"), "组织样本 ID：点击按列降序排序");
});

test("组织学查看器：筛选占位符与枚举值", () => {
  const doc = boot(
    "<input placeholder=\"Select Tissues...\"><input placeholder=\"Select Pathology Categories...\">" +
    "<input placeholder=\"For example: GTEX-1117F-2426, GTEX-1117F-2526, GTEX-1117F-0126-SM-4DLZ8\">" +
    "<ul><li>Slow death</li><li>Intermediate death</li><li>Fast death - violent</li><li>Fast death - natural causes</li><li>Ventilator case</li>" +
    "<li>Adenoma</li><li>Atrophy</li><li>No abnormalities</li><li>Solar elastosis</li><li>Spermatogenesis</li></ul>"
  );
  const inputs = [...doc.querySelectorAll("input")].map((x) => x.getAttribute("placeholder"));
  assert.deepEqual(inputs, [
    "选择组织…",
    "选择病理类别…",
    "例如：GTEX-1117F-2426、GTEX-1117F-2526、GTEX-1117F-0126-SM-4DLZ8"
  ]);
  const lis = [...doc.querySelectorAll("li")].map((x) => x.textContent.trim());
  for (const want of ["缓慢死亡", "中间型死亡", "快速死亡 - 暴力", "快速死亡 - 自然原因", "呼吸机病例", "腺瘤", "萎缩", "无异常", "日光性弹性纤维变性", "精子发生"]) {
    assert.ok(lis.includes(want), "枚举缺中文: " + want + " / 实际: " + lis.join(","));
  }
});

test("采样点解剖图：页首说明与表格描述", () => {
  const doc = boot(
    "<p>This page provides a visual representation of the biospecimen source sites (BSSs) for the collection of tissue from postmortem/organ procurement cases for the Genotype-Tissue Expression (GTEx) project.<br> The full documentation on tissue collection procedures can be found on the <a href=\"#\">GTEx Tissue Harvesting Work Instruction</a>.</p>" +
    "<table><tbody>" +
    "<tr><td>Left kidney cortex.</td></tr>" +
    "<tr><td>Central region, 5 mm below capsule.</td></tr>" +
    "<tr><td>Amygdala (sampled at Miami Brain Bank and preserved as fresh frozen tissue).</td></tr>" +
    "<tr><td>Entire pituitary gland.</td></tr>" +
    "</tbody></table>"
  );
  const p = doc.querySelector("p").textContent;
  assert.match(p, /本页以可视化方式展示/);
  assert.match(p, /组织采集流程的完整文档见/);
  const tds = [...doc.querySelectorAll("td")].map((x) => x.textContent.trim());
  assert.deepEqual(tds, [
    "左肾皮质。",
    "中央区域，距被膜下 5 mm。",
    "Amygdala（在迈阿密脑库取样，并保存为新鲜冷冻组织）。",
    "整个垂体。"
  ]);
});

test("FAQ：gcloud 下载句与致谢引导句", () => {
  assert.equal(
    dict.exact["Please acknowledge the GTEx Project and/or Portal. An example acknowledgement statement follows:"],
    "请致谢 GTEx 项目及/或门户。致谢声明示例如下："
  );
  assert.match(dict.exact["If you are going to download the entire dataset, we recommend that you use Google's gcloud command line utility. Specifically, we suggest that you use 'gcloud storage rsync' to perform the download. You can find Google egress pricing here:"], /出网流量定价/);
  const doc = boot("<p>Please acknowledge the GTEx Project and/or Portal. An example acknowledgement statement follows:</p>");
  assert.match(doc.querySelector("p").textContent, /致谢声明示例如下/);
});

test("回归护栏：不得给致谢整段加碎片词条（会让整段退化成半中半英）", () => {
  for (const k of Object.keys(dict.exact)) {
    assert.notEqual(k, "The Genotype-Tissue Expression (GTEx) Project was supported by the");
    assert.ok(!k.startsWith("of the Office of the Director of the National Institutes of Health, and by NCI"));
  }
  // 整段长句仍由既有 exact 覆盖（关于页靠段落通道整块替换）
  const longKey = Object.keys(dict.exact).find((k) => k.startsWith("The Genotype-Tissue Expression (GTEx) Project was supported by the Common Fund"));
  assert.ok(longKey, "缺少致谢整段长句条目");
  assert.match(dict.exact[longKey], /共同基金资助/);
});

test("既有 FAQ 问答正文仍在（抽样）", () => {
  const cases = [
    ["How was the autolysis score measured?", "自溶评分是如何测定的？"],
    ["Why does GTEx use TPM units rather than RPKM?", "为什么 GTEx 使用 TPM 而不是 RPKM？"]
  ];
  for (const [en, zh] of cases) assert.equal(dict.exact[en], zh, "缺条目: " + en);
});
