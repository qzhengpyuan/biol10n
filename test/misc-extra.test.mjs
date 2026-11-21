// 检查方 misc-extra：UALCAN / TIMER / miRBase / GEPIA2 四站补充词库
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const misc = JSON.parse(fs.readFileSync(path.join(root, "../dict/misc-extra.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;

function run(html, siteId) {
  const dom = new JSDOM(html);
  const site = sites.find((s) => s.id === siteId) || { id: siteId, dicts: [] };
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: misc.exact, rules: misc.rules },
    site
  });
  engine.start();
  return dom.window.document;
}

const text = (doc, sel) => doc.querySelector(sel).textContent.replace(/\s+/g, " ").trim();

test("词库规模与站点声明", () => {
  assert.ok(Object.keys(misc.exact).length >= 120, "exact 少于 120 条");
  assert.ok(misc.rules.length >= 5, "规则少于 5 条");
  assert.equal(misc.meta.family, "misc");
  for (const host of ["ualcan.path.uab.edu", "timer.comp-genomics.org", "timer.cistrome.org", "www.mirbase.org", "gepia2.cancer-pku.cn"]) {
    assert.ok(misc.meta.sites.includes(host), "缺少站点 " + host);
  }
  for (const r of misc.rules) {
    assert.ok(r.re.startsWith("^") && r.re.endsWith("$"), "规则未锚定: " + r.re);
    assert.ok(r.to && r.to.length > 0);
  }
});

test("UALCAN 教程页目录与步骤标签", () => {
  const doc = run(
    '<div id="tut">' +
      "<h2>Welcome to UALCAN User guide!</h2>" +
      "<h3>1. How to obtain list of top differentially expressed genes?</h3>" +
      "<h3>2. How to query UALCAN for gene(s) of interest in specific cancer?</h3>" +
      "<p>Introduction to Cancer terms</p>" +
      "<p>Step 1:</p><p>Step 2:</p><p>Step 3:</p><p>Step 4:</p><p>Step 5:</p>" +
      "<p>Downloading the box plot from UALCAN</p>" +
      "</div>",
    "ualcan"
  );
  assert.equal(text(doc, "h2"), "欢迎使用 UALCAN 用户指南！");
  assert.equal(text(doc, "h3"), "1. 如何获取差异表达最显著基因的列表？");
  assert.equal(doc.querySelectorAll("h3")[1].textContent.trim(), "2. 如何在特定癌症中查询感兴趣的基因？");
  const ps = [...doc.querySelectorAll("p")].map((e) => e.textContent.trim());
  assert.ok(ps.includes("癌症术语介绍"));
  assert.ok(ps.includes("第 1 步：") && ps.includes("第 5 步："));
  assert.ok(ps.includes("从 UALCAN 下载箱线图"));
});

test("UALCAN 首页说明句（长段落 exact）", () => {
  const doc = run(
    "<div>" +
      "<p>UALCAN is a comprehensive, user-friendly, and interactive web resource for analyzing cancer OMICS data. " +
      "It is built on PERL-CGI with high quality graphics using javascript and CSS. UALCAN is designed to,</p>" +
      "<p>provide easy access to publicly available cancer OMICS data (TCGA, MET500, CPTAC and CBTTC),</p>" +
      "<p>allow users to identify biomarkers or to perform in silico validation of potential genes of interest,</p>" +
      "</div>",
    "ualcan"
  );
  const ps = [...doc.querySelectorAll("p")].map((e) => e.textContent.trim());
  assert.match(ps[0], /^UALCAN 是一个综合、易用且可交互的癌症 OMICS 数据分析网络资源/);
  assert.match(ps[0], /UALCAN 旨在：$/);
  assert.match(ps[1], /^提供对公开癌症 OMICS 数据（TCGA、MET500、CPTAC 和 CBTTC）的便捷访问/);
  assert.match(ps[2], /^使用户能够识别生物标志物/);
});

test("UALCAN 基因句子规则回填", () => {
  const doc = run(
    "<div>" +
      "<p>Analyzing survival plots of CLEC3A in breast invasive carcinoma TCGA dataset</p>" +
      "<p>Analyzing promoter DNA methylation level of TP53 in breast invasive carcinoma TCGA dataset</p>" +
      "<p>Obtaining list of positively/negatively correlated genes of BRCA1 in breast invasive carcinoma TCGA dataset</p>" +
      "<p>Obtaining TP53 expression profile in breast invasive carcinoma dataset based on patient’s race.</p>" +
      "</div>",
    "ualcan"
  );
  const ps = [...doc.querySelectorAll("p")].map((e) => e.textContent.trim());
  assert.equal(ps[0], "分析 CLEC3A 在乳腺浸润性癌 TCGA 数据集中的生存曲线");
  assert.equal(ps[1], "分析 TP53 在乳腺浸润性癌 TCGA 数据集中的启动子 DNA 甲基化水平");
  assert.equal(ps[2], "获取 BRCA1 在乳腺浸润性癌 TCGA 数据集中的正/负相关基因列表");
  assert.equal(ps[3], "获取 TP53 在乳腺浸润性癌数据集中基于患者种族的表达谱。");
});

test("GEPIA2 帮助页控件说明与侧栏项", () => {
  const doc = run(
    "<div>" +
      "<p>: Set the violin color in the plot.</p>" +
      "<p>: Samples with expression level higher than this threshold are considered as the high-expression cohort.</p>" +
      "<p>p-value Cutoff</p>" +
      "<p>Second Step</p>" +
      "<p>◕ Correlation Analysis</p>" +
      "<p>Local package</p>" +
      "</div>",
    "gepia2"
  );
  const ps = [...doc.querySelectorAll("p")].map((e) => e.textContent.trim());
  assert.equal(ps[0], "：设置图形中小提琴的颜色。");
  assert.equal(ps[1], "：表达水平高于此阈值的样本视为高表达队列。");
  assert.equal(ps[2], "p 值阈值");
  assert.equal(ps[3], "第二步");
  assert.equal(ps[4], "◕ 相关性分析");
  assert.equal(ps[5], "本地安装包");
});

test("GEPIA2 GTEx 组织词表", () => {
  const doc = run(
    '<table><tbody>' +
      "<tr><th>Adrenal Gland</th><td>肾上腺</td></tr>" +
      "<tr><th>Bone Marrow</th><th>Uterus</th><th>Liver</th><th>Spleen</th></tr>" +
      "<tr><th>Fibroblasts</th><th>Vagina</th><th>BRCA1</th><th>ENSG00000141510</th></tr>" +
      "</tbody></table>",
    "gepia2"
  );
  const th = [...doc.querySelectorAll("th")].map((e) => e.textContent.trim());
  assert.deepEqual(th, ["肾上腺", "骨髓", "子宫", "肝脏", "脾脏", "成纤维细胞", "阴道", "BRCA1", "ENSG00000141510"]);
});

test("GEPIA2 帮助页长句与下载说明", () => {
  const doc = run(
    "<div>" +
      "<p>We use three methods for differential expression analysis using TCGA tumor samples with paired adjacent TCGA normal samples and GTEx normal samples.</p>" +
      "<p>The downloaded PDF and the SVG plots can be edited by Adobe Illustrator. Here is a tutorial video:</p>" +
      "</div>",
    "gepia2"
  );
  const ps = [...doc.querySelectorAll("p")].map((e) => e.textContent.trim());
  assert.match(ps[0], /^我们使用三种方法进行差异表达分析/);
  assert.match(ps[1], /^下载的 PDF 和 SVG 图可用 Adobe Illustrator 编辑/);
});

test("TIMER 模块说明句", () => {
  const doc = run(
    "<div><p>Users can upload their own cancer RNA-Seq data to identify its molecular subtype, TCGA immune subtype, and pan-cancer subtype. " +
      "The gene and isoform expression can also be compared with the TCGA and GTEx data.</p></div>",
    "timer2"
  );
  assert.match(text(doc, "p"), /用户可以上传自己的癌症 RNA-Seq 数据/);
});

test("整句 exact 不做子串替换，数据行不动", () => {
  const doc = run(
    "<div>" +
      "<p>This is the Second Step of the whole pipeline</p>" +
      "<p>TCGA-BRCA</p>" +
      "<p>hsa-miR-21-5p</p>" +
      "<p>Adrenal Gland samples from GTEx were used here</p>" +
      "</div>",
    "gepia2"
  );
  const ps = [...doc.querySelectorAll("p")].map((e) => e.textContent.trim());
  assert.equal(ps[0], "This is the Second Step of the whole pipeline");
  assert.equal(ps[1], "TCGA-BRCA");
  assert.equal(ps[2], "hsa-miR-21-5p");
  assert.equal(ps[3], "Adrenal Gland samples from GTEx were used here");
});