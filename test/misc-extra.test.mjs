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
const GENE_HTML = "<div class=\"col-sm-8\" role=\"main\" align=\"justify\" style=\"font-size: 12pt\"> <br> <strong>说明：</strong> Gene module allows users to select any gene of interest and visualize the correlation of its expression with immune infiltration level in diverse cancer types. Once your interested gene and immune infiltrates submitted, a heatmap with numbers will show the purity-adjusted spearman's rho across various cancer types. When you click your interested cell on the heatmap, a scatter plot will pop out to present the relationship between infiltrates estimation value and gene expression. Tumor purity is a major confounding factor in this analysis, since most immune cell types are negatively correlated with tumor purity. Therefore, we recommend users to select the “Purity Adjustment” option, which will use the partial Spearman’s correlation to perform this association analysis. Specially, for methods like EPIC and quanTIseq, which provide cell fractions referred to total cells, tumor purity and immune infiltration are necessarily negatively correlated, hence there is no need to adjust purity for the asscociation analysis using the estimations from EPIC and quanTIseq. </div>";
const SCNA_HTML = "<div class=\"col-sm-8\" role=\"main\" align=\"justify\" style=\"font-size: 12pt\"> <br> <strong>Instruction:</strong> sCNA (somatic copy number alterations) Module allows a user to compare immune infiltration distribution by the sCNA status of a gene across TCGA cancer types. GISTIC2.0 (25) estimates the sCNA information from copy number segmentation profiles at the gene level, including “deep deletion”, “arm-level deletion”, “diploid/normal”, “arm-level gain”, and “high amplification” defined by GISTIC2.0. Given the input gene, TIMER3 displays a stacked bar plot showing the relative proportion of different sCNA states of the gene for all TCGA cancer types. TIMER3 requires the user to specify a “deep deletion” or “high amplification” alteration status of the gene to compare with the “diploid/normal” status. When a user submits a query, TIMER3 draws a heatmap table for the log-fold changes of immune infiltration levels between the specified alteration group and the normal one. With a click on an entry of the table, the user can view the immune infiltration distribution between different sCNA status of the gene on a violin plot for pairwise comparisons of normal group with each alteration group. <div class=\"shiny-plot-output html-fill-item shiny-bound-output recalculating\" id=\"scnaOutput_frequency\" style=\"width:100%;height:auto;\" aria-live=\"polite\"></div> </div>";
const GENEDE_HTML = "<div class=\"col-sm-8\" role=\"main\" align=\"justify\" style=\"font-size: 12pt\"> <br> <strong>说明：</strong> Gene_DE module allows users to study the differential expression between tumor and adjacent normal tissues for any gene of interest across all TCGA tumors. Distributions of gene expression levels are displayed using box plots. The statistical significance computed by differential analysis (edgeR) on RNA-Seq raw counts is annotated by the number of stars (*: p-value &lt; 0.05; **: p-value &lt;0.01; ***: p-value &lt;0.001). Users can identify genes that are up-regulated or down-regulated in the tumors compared to normal tissues for each cancer type, as displayed in <font color=\"gray\"><b>gray</b></font> columns when normal data are available. </div>";
const PRED_HTML = "<div class=\"col-sm-8\" role=\"main\" align=\"justify\" style=\"font-size: 12pt\"> <br> <strong>说明：</strong> The Immunotherapy Prediction module provides robust support for users, enabling them to comprehensively assess the predictive ability of genes in immunotherapy response through Receiver Operating Characteristic (ROC) curve analysis. Users simply need to input the target gene and click the corresponding generated cell to display the ROC curve for that gene, clearly marked with the Area Under the Curve (AUC) value. Based on cross-validation results, the module visually marks model performance with different colors: models with excellent performance (AUC ≥ 0.9) are marked in <font color=\"#E05F48\"><b>red</b></font>; good performance (0.9 &gt; AUC ≥ 0.7) in <font color=\"#F7C873\"><b>yellow</b></font>; suboptimal performance (0.7 &gt; AUC ≥ 0.5) in <font color=\"skyblue\"><b>blue</b></font>; and random models (AUC &lt; 0.5) in <font color=\"lightgray\"><b>gray</b></font>. </div>";


// —— 以下为 2026-11 补充：GEPIA2 / UALCAN / TIMER3 线上页面残留长句与拆句
// TIMER3 的模块说明 div 直接取自线上 DOM（含 <br>、<strong>说明：</strong>、<font> 颜色词）
const timerBook = JSON.parse(fs.readFileSync(path.join(root, "../dict/timer.json"), "utf8"));

// 模板通道需要模板数组；颜色词（gray/red/…）沿用 timer.json 的既有译文
function runFull(html, siteId) {
  const dom = new JSDOM(html);
  const site = sites.find((s) => s.id === siteId) || { id: siteId, dicts: [] };
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: {
      exact: { ...timerBook.exact, ...misc.exact },
      rules: misc.rules || [],
      templates: misc.templates || []
    },
    site
  });
  engine.start();
  return dom.window.document;
}

test("misc-extra：GEPIA2 关于页功能与资助说明整段", () => {
  const doc = run(
    "<div>" +
      "<p>GEPIA2 provides customizable functions such as tumor/normal differential expression analysis, profiling according to cancer types or pathological stages, patient survival analysis, similar gene detection, correlation analysis and dimensionality reduction analysis.</p>" +
      "<p>This project was supported by grants from Beijing Advanced Innovation Center for Genomics at Peking University, Key Technologies R&D Program (2016YFC0900100) and National Natural Science Foundation of China (81573022, 31530036).</p>" +
      "</div>",
    "gepia2"
  );
  const ps = [...doc.querySelectorAll("p")].map((e) => e.textContent.replace(/\s+/g, " ").trim());
  assert.match(ps[0], /^GEPIA2 提供可定制的功能/);
  assert.match(ps[0], /降维分析。$/);
  assert.match(ps[1], /^本项目得到北京大学北京未来基因诊断高精尖创新中心/);
  assert.match(ps[1], /国家重点研发计划（2016YFC0900100）/);
  assert.match(ps[1], /国家自然科学基金（81573022、31530036）/);
});

test("misc-extra：GEPIA2 帮助页 Top、New 与关于页 Contact us", () => {
  const doc = run(
    "<div>" +
      '<ul class="nav nav-pills nav-stacked"><li><a href="#top">Top</a></li><li><a href="#ut9"><span class="label label-info">New</span> 编辑结果</a></li></ul>' +
      "<h3>Contact us</h3>" +
      "</div>",
    "gepia2"
  );
  assert.equal(doc.querySelector('a[href="#top"]').textContent.trim(), "顶部");
  assert.equal(doc.querySelector("span.label-info").textContent.trim(), "新增");
  assert.equal(doc.querySelector("h3").textContent.trim(), "联系我们");
});

test("misc-extra：UALCAN 首页 f) 说明句与两条新闻整段", () => {
  const doc = run(
    "<div>" +
      "<p><b>f)</b> Provide additional information about the selected genes/targets by linking to GeneCards, Pubmed, TargetScan, The human protein atlas, DRUGBANK, Open Targets and the GTEx. These resources allow researchers to gather valuable information and data about the genes/targets of interest, <a href=\"#\">GeneCards</a>.</p>" +
      '<ul><li><font color="#095ce8"><font style="font-weight:bold;">MammOnc-DB</font>, an integrative breast cancer proteogenomic data analysis platform with over 20,000 samples including single cell sequencing data is now online: <a href="#">mammonc-db.org</a></li></ul>' +
      '<div><font color="#095ce8"><font style="font-weight:bold;">UALCAN 移动版</font>, a free companion tool /app for UALCAN is now available in App store and Google Play store. This app will make UALCAN/TCGA cancer gene expression data readily accessible for researchers through phones and tablets and make target discovery at the fingertips.</font></div>' +
      "</div>",
    "ualcan"
  );
  const all = doc.body.textContent.replace(/\s+/g, " ");
  assert.match(all, /通过链接到 GeneCards、Pubmed、TargetScan/);
  assert.match(all, /提供所选基因\/靶点的更多信息/);
  assert.match(all, /一个整合性乳腺癌蛋白质基因组数据分析平台/);
  assert.match(all, /现已上线/);
  assert.match(all, /免费配套工具 \/app 现已在 App Store 和 Google Play 商店上线/);
  assert.match(all, /让靶点发现触手可及/);
  assert.doesNotMatch(all, /Provide additional information/);
  assert.doesNotMatch(all, /free companion tool/);
});

test("misc-extra：UALCAN 访问量 1.9 Million 在中文语境中回填", () => {
  const doc = run(
    '<div><li align="left"><font color="#095ce8" size="3">UALCAN 现已被访问超过 <font style="font-weight:bold;">1.9 Million</font> 次，来自 100 多个国家的癌症研究者访问，并被引用 8500 余次</font></li></div>',
    "ualcan"
  );
  assert.match(doc.body.textContent, /访问超过 190 万次/);
});

test("misc-extra：TIMER3 免疫模块说明整段（Gene / sCNA，线上 DOM）", () => {
  const doc = run(GENE_HTML + SCNA_HTML, "timer2");
  const divs = [...doc.querySelectorAll("div[role=main]")].map((e) => e.textContent.replace(/\s+/g, " ").trim());
  assert.match(divs[0], /^说明：基因模块允许用户选择任意感兴趣的基因/);
  assert.match(divs[0], /经纯度校正的 Spearman's rho/);
  assert.doesNotMatch(divs[0], /Gene module allows/);
  assert.match(divs[1], /sCNA（体细胞拷贝数改变）模块允许用户按基因的 sCNA 状态/);
  assert.match(divs[1], /“深度缺失”“臂级缺失”“二倍体\/正常”/);
  assert.doesNotMatch(divs[1], /allows a user to compare/);
});

test("misc-extra：TIMER3 被内联切碎的说明走模板（Gene_DE / Immunotherapy Prediction，线上 DOM）", () => {
  const doc = runFull(GENEDE_HTML + PRED_HTML, "timer2");
  const divs = [...doc.querySelectorAll("div[role=main]")].map((e) => e.textContent.replace(/\s+/g, " ").trim());
  assert.match(divs[0], /^说明：Gene_DE 模块允许用户在全部 TCGA 肿瘤中研究/);
  assert.match(divs[0], /如图中以灰色列显示（当存在正常数据时）。$/);
  assert.doesNotMatch(divs[0], /Gene_DE module allows/);
  assert.match(divs[1], /^说明：免疫治疗预测模块为用户提供有力支持/);
  assert.match(divs[1], /以红色标记；性能良好者（0.9 > AUC ≥ 0.7）以黄色标记/);
  assert.match(divs[1], /随机模型（AUC < 0.5）以灰色标记。$/);
});
