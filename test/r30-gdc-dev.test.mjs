// r30 GDC 文档站补词：/about-data/data-types-and-file-formats、/developers、
// /developers/gdc-application-programming-interface-api、/developers/gdc-analysis-tool-sdk、
// /submit-data/submitter-portal（实测 404，改用站内真实路径 /submit-data/gdc-data-submission-portal）、/access-data/gdc-data-portal
// 词库：dict/gdc-docs.json（2026-11-23 由 CDP 9227 实测页面关闭汉化后读取原始英文 DOM）
// 断言口径：exact 用 translateText 逐条比对；带内联元素的整段用真实 DOM 走模板/整段通道，
// 并检查 href 与节点数量未变；格式名、参考基因组、accession 这类数据串必须返回 null。
// 已知边界：段落内有内联 <svg> 的外链（外部链接图标）会被模板构建拒绝，整段保持英文，这里单列回归。
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
const cfg = sites.find((s) => s.id === "gdc-docs");
const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/gdc-docs.json"), "utf8"));
const CJK = /[\u4e00-\u9fff]/;

function load(names) {
  const exact = {}, rules = [], templates = [];
  for (const n of names) {
    const d = JSON.parse(fs.readFileSync(path.join(root, "../dict/" + n + ".json"), "utf8"));
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
    templates.push(...(d.templates || []));
  }
  return { exact, rules, templates };
}

function boot(html, url = "https://gdc.cancer.gov/developers") {
  const dom = new JSDOM("<body>" + html + "</body>", { url });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: load(cfg.dicts),
    site: cfg
  });
  engine.start();
  return { engine, doc: dom.window.document };
}

const plain = (el) => el.textContent.replace(/\s+/g, " ").trim();

// ---------------- 结构与词库 ----------------

test("gdc-docs 词库：meta 与新增条数就位", () => {
  assert.equal(book.meta.family, "gdc");
  assert.deepEqual(book.meta.sites, ["gdc.cancer.gov"]);
  assert.equal(cfg.hosts[0], "gdc.cancer.gov");
  assert.ok(cfg.dicts.includes("gdc-docs"), "gdc-docs 应加载本册");
  assert.ok(Object.keys(book.exact).length >= 395, "exact 条数不足（r30 后应 ≥395）");
  assert.ok(book.templates.length >= 68, "模板条数不足（r30 后应 ≥68）");
});

test("gdc-docs 词库：模板占位符 1..N 连续，pat 无汉字、zh 有汉字、无重复 pat", () => {
  const seen = new Set();
  for (const t of book.templates) {
    assert.equal(typeof t.pat, "string", "pat 缺失");
    assert.equal(typeof t.zh, "string", "zh 缺失");
    assert.ok(!CJK.test(t.pat), "pat 含中文: " + t.pat.slice(0, 60));
    assert.ok(CJK.test(t.zh), "zh 无中文: " + t.pat.slice(0, 60));
    const used = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.ok(used.length > 0, "模板没有占位符: " + t.pat.slice(0, 60));
    const sorted = used.slice().sort((a, b) => a - b);
    sorted.forEach((n, i) => assert.equal(n, i + 1, "占位符不连续: " + t.pat.slice(0, 60)));
    assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, "pat 长度越界: " + t.pat.length);
    assert.ok(!seen.has(t.pat), "模板重复: " + t.pat.slice(0, 60));
    seen.add(t.pat);
  }
});

test("gdc-docs 词库：规则锚定且可编译，译文含中文", () => {
  for (const r of book.rules) {
    assert.ok(r.re.startsWith("^") && r.re.endsWith("$"), "规则必须锚定: " + r.re);
    assert.doesNotThrow(() => new RegExp(r.re), "规则无法编译: " + r.re);
    assert.ok(!CJK.test(r.re), "规则 re 含中文: " + r.re);
  }
});

// ---------------- 新词条（exact） ----------------

test("developers：侧栏与 FAQ 骨架词条命中", () => {
  const { engine } = boot("<p>x</p>");
  const pairs = {
    "MORE ABOUT DEVELOPER TOOLS": "更多开发者工具",
    DOCUMENTATION: "文档",
    "SOURCE CODE": "源代码",
    "GDC API Graphic": "GDC API 图示",
    "GDC Analysis Tool SDK": "GDC 分析工具 SDK",
    "GDC Application Developer's Guide": "GDC 应用开发者指南",
    "How can I download BAM index files (BAI files) using the API?": "如何使用 API 下载 BAM 索引文件（BAI 文件）？",
    "BAI files are included with the download when using the GDC Data Transfer Tool to download BAM files.": "使用 GDC 数据传输工具下载 BAM 文件时，下载内容会一并包含 BAI 文件。",
    "BAI files are not available for sliced BAM files.": "BAI 文件不适用于切片后的 BAM 文件。",
    "See all GDC API FAQs": "查看全部 GDC API 常见问题",
    "Note:": "说明："
  };
  for (const [en, zh] of Object.entries(pairs)) assert.equal(engine.translateText(en), zh, "缺词条: " + en);
});

test("developers / API 页：整段与标题词条命中", () => {
  const { engine } = boot("<p>x</p>");
  const pairs = {
    "The GDC provides developers and users with a variety tools, components, and other key information in support of developing novel apps for visualizing and analyzing GDC data.":
      "GDC 为开发者和用户提供多种工具、组件及其他关键信息，以支持开发用于可视化和分析 GDC 数据的新应用。",
    "Thank you for supporting this wonderful software.": "感谢支持这款出色的软件。",
    "GDC API Key Features": "GDC API 主要功能",
    "Search Data": "检索数据",
    "BAM Slicing": "BAM 切片",
    "GDC Submission Portal": "GDC 提交门户",
    "The GDC API also supports BAM slicing to retrieve only a portion of a file.": "GDC API 还支持 BAM 切片，仅获取文件的一部分。"
  };
  for (const [en, zh] of Object.entries(pairs)) assert.equal(engine.translateText(en), zh, "缺词条: " + en);
  assert.ok(
    engine
      .translateText(
        "GDC data analysis endpoints allow API users to programmatically explore data in the GDC using advanced filters at a gene and mutation level. Mutation endpoints are provided for both somatic mutations and copy number variations. Survival analysis data is also available."
      )
      .startsWith("GDC 数据分析端点"),
    "API 分析端点段缺词条"
  );
});

test("data portal：功能标题、浏览器清单与版本说明词条命中", () => {
  const { engine } = boot("<p>x</p>");
  const pairs = {
    "GDC Data Portal Key Features": "GDC 数据门户主要功能",
    "Create Custom Cohorts": "创建自定义队列",
    "Analyze Custom Cohorts": "分析自定义队列",
    "Browse Harmonized Data": "浏览统一化数据",
    "View Project Information": "查看项目信息",
    "Projects tool": "项目工具",
    "Create Personalized Cart": "创建个性化购物车",
    "Download Data Quickly and Securely": "快速安全地下载数据",
    "Cart Download Instructions": "购物车下载说明",
    "View Slide Images": "查看切片图像",
    "Slide Image Viewer": "切片图像查看器",
    "Accessing the GDC Data Portal": "访问 GDC 数据门户",
    "Supported Internet Browsers": "支持的互联网浏览器",
    "Most recent stable version of Google Chrome": "最新稳定版 Google Chrome",
    "Most recent stable version of Mozilla Firefox": "最新稳定版 Mozilla Firefox",
    "Most recent supported stable version of Microsoft Edge on Microsoft Windows":
      "Microsoft Windows 上受支持的最新稳定版 Microsoft Edge",
    "Release Notes": "版本说明",
    "GDC Data Portal Release Notes": "GDC 数据门户版本说明",
    "Component Library": "组件库"
  };
  for (const [en, zh] of Object.entries(pairs)) assert.equal(engine.translateText(en), zh, "缺词条: " + en);
});

test("数据串与格式名不翻译：返回 null 或原样", () => {
  const { engine } = boot("<p>x</p>");
  for (const s of [
    "FASTQ",
    "BAM",
    "GRCh38",
    "VCF",
    "SRA XML",
    "JSON format",
    "GDC API",
    "related_files=true",
    "b0986067-67c0-40a9-afeb-264fcddebe96"
  ]) {
    assert.equal(engine.translateText(s), null, "不应翻译: " + s);
  }
});

// ---------------- 模板通道（真实 DOM） ----------------

test("developers：API 简介段模板命中，链接与 href 不动", () => {
  const html =
    '<p id="api">The <a href="/developers/gdc-application-programming-interface-api">GDC Application Programming Interface (API)</a> provides developers with a programmatic interface to query, analyze, and download GDC data and submit data to the GDC.</p>';
  const { doc } = boot(html);
  const p = doc.getElementById("api");
  assert.ok(plain(p).startsWith("GDC 应用程序编程接口（API）为开发者提供编程接口"), plain(p));
  assert.ok(plain(p).includes("向 GDC 提交数据"));
  const links = [...p.querySelectorAll("a")];
  assert.equal(links.length, 1);
  assert.equal(links[0].getAttribute("href"), "/developers/gdc-application-programming-interface-api");
  assert.equal(links[0].textContent, "GDC 应用程序编程接口（API）");
});

test("developers：SDK 段模板命中，槽位链接译文与 href 保留", () => {
  const html =
    '<p id="sdk">The <a href="/developers/gdc-analysis-tool-sdk">GDC Analysis Tool Software Development Kit</a> supports the development of applications that allow for analysis, visualization, and refinement of cohorts. Applications that operate within the GDC Data Portal interact with the GDC API via SDK.</p>';
  const { doc } = boot(html);
  const p = doc.getElementById("sdk");
  assert.ok(plain(p).includes("支持开发用于分析、可视化与优化队列的应用"), plain(p));
  assert.ok(plain(p).includes("通过 SDK 与 GDC API 交互"));
  const a = p.querySelector("a");
  assert.equal(a.getAttribute("href"), "/developers/gdc-analysis-tool-sdk");
  assert.equal(a.textContent, "GDC 分析工具软件开发工具包");
});

test("developers：组件库与数据模型段模板命中", () => {
  const html =
    '<p id="cl">The GDC provides a <a href="/developers/gdc-component-library">Component Library</a> to facilitate the development of web-based applications for the GDC Data Portal.</p>' +
    '<p id="dm">The <a href="/developers/gdc-data-model">GDC Data Model</a> is the central method of organization of all data artifacts ingested by the GDC.</p>';
  const { doc } = boot(html);
  const cl = doc.getElementById("cl");
  assert.ok(plain(cl).includes("便于为 GDC 数据门户开发基于网页的应用"), plain(cl));
  assert.equal(cl.querySelector("a").getAttribute("href"), "/developers/gdc-component-library");
  assert.equal(cl.querySelector("a").textContent, "组件库");
  const dm = doc.getElementById("dm");
  assert.ok(plain(dm).includes("是组织 GDC 接收的所有数据产物的核心方式"), plain(dm));
  assert.equal(dm.querySelector("a").getAttribute("href"), "/developers/gdc-data-model");
  assert.equal(dm.querySelector("a").textContent, "GDC 数据模型");
});

test("developers FAQ：参数名 related_files=true 原样保留", () => {
  const html =
    '<p id="q">When using the API to download BAM files, BAI files will only be included if the <strong>related_files=true</strong> parameter is specified together with the BAM UUID, for example:</p>';
  const { doc } = boot(html);
  const p = doc.getElementById("q");
  assert.ok(plain(p).startsWith("使用 API 下载 BAM 文件时"), plain(p));
  assert.equal(p.querySelectorAll("strong").length, 1);
  assert.equal(p.querySelector("strong").textContent, "related_files=true");
});

test("developers FAQ：API 端点名 files/data 不被译词破坏（整段通道）", () => {
  const html =
    '<p id="alt">Alternatively, users can determine the BAI file UUID from the API <strong>files</strong> endpoint by supplying the BAM UUID. The BAI file UUID can then be used to download the BAI file from the <strong>data</strong> endpoint.</p>';
  const { doc } = boot(html);
  const p = doc.getElementById("alt");
  assert.ok(plain(p).includes("从 API 的 files 端点确定 BAI 文件的 UUID"), plain(p));
  assert.ok(plain(p).includes("从 data 端点下载 BAI 文件"), plain(p));
  assert.ok(!plain(p).includes("个文件"), "端点名 files 被误译: " + plain(p));
});

test("API 页：带图标简介段模板命中，img 与文案都保留", () => {
  const html =
    '<p id="intro" class="text-leading with-sidebar with-icon"><img src="/system/files/inline-images/icon-client-tool.png" alt="Client Tool" width="77" height="75" class="align-left">The GDC Application Programming Interface (API) provides developers with a programmatic interface to query, analyze, and download GDC data and submit data to the GDC.</p>';
  const { doc } = boot(html, "https://gdc.cancer.gov/developers/gdc-application-programming-interface-api");
  const p = doc.getElementById("intro");
  assert.ok(plain(p).startsWith("GDC 应用程序编程接口（API）为开发者提供编程接口"), plain(p));
  const imgs = p.querySelectorAll("img");
  assert.equal(imgs.length, 1);
  assert.equal(imgs[0].getAttribute("src"), "/system/files/inline-images/icon-client-tool.png");
});

test("API 页：REST 简介段模板命中，两个门户链接 href 与译文保留", () => {
  const html =
    '<p id="rest">The GDC API is the external facing REST interface for the GDC. The GDC API drives the <a href="https://portal.gdc.cancer.gov">GDC Data Portal</a>, the <a href="https://portal.gdc.cancer.gov/submission/">GDC Submission Portal</a> and is made accessible to external users for programmatic access to the same functionality found through GDC Portals. This includes searching, analyzing, submitting and downloading subsets of data files, metadata, and annotations based on specific parameters.</p>';
  const { doc } = boot(html, "https://gdc.cancer.gov/developers/gdc-application-programming-interface-api");
  const p = doc.getElementById("rest");
  assert.ok(plain(p).startsWith("GDC API 是 GDC 对外的 REST 接口"), plain(p));
  assert.ok(plain(p).includes("外部用户开放编程访问"));
  const links = [...p.querySelectorAll("a")];
  assert.equal(links.length, 2);
  assert.deepEqual(
    links.map((a) => a.getAttribute("href")),
    ["https://portal.gdc.cancer.gov", "https://portal.gdc.cancer.gov/submission/"]
  );
  assert.deepEqual(links.map((a) => a.textContent), ["GDC 数据门户", "GDC 提交门户"]);
});

test("data portal：队列构建器单元格模板命中，链接保留", () => {
  const html =
    '<table><tbody><tr><td id="cohort" style="vertical-align:top;width:65%;">The GDC Data Portal centers around the idea of building cohorts, or groups of cases, before analyzing or downloading data. With the <a href="https://portal.gdc.cancer.gov/analysis_page?app=CohortBuilder&amp;tab=general">Cohort Builder</a>, users filter and select cases according to clinical, biospecimen, and other available data elements to create custom cohorts for analysis.</td></tr></tbody></table>';
  const { doc } = boot(html, "https://gdc.cancer.gov/access-data/gdc-data-portal");
  const td = doc.getElementById("cohort");
  assert.ok(plain(td).startsWith("GDC 数据门户以在分析或下载数据之前构建队列"), plain(td));
  const a = td.querySelector("a");
  assert.equal(a.getAttribute("href"), "https://portal.gdc.cancer.gov/analysis_page?app=CohortBuilder&tab=general");
  assert.equal(a.textContent, "队列构建器");
});

test("data portal：下载渠道三块模板命中，5 个链接 href 全保留", () => {
  const html =
    '<table><tbody><tr><td id="dl">' +
    '<p>The <a href="https://portal.gdc.cancer.gov/">GDC Data Portal</a> provides two primary channels for downloading data:</p>' +
    '<ul><li>Download directly from the browser using the <a href="https://portal.gdc.cancer.gov/">GDC Data Portal</a></li>' +
    '<li>Download large volumes using the dedicated <a href="/access-data/gdc-data-transfer-tool">GDC Data Transfer Tool</a></li></ul>' +
    '<p>When downloading data via the GDC Data Transfer Tool, the <a href="https://portal.gdc.cancer.gov/">GDC Data Portal</a> generates a file manifest that can be imported into the GDC Data Transfer Tool to initiate the download. Note that certain files require users to obtain controlled access authorization, which is managed by the NIH database of Genotypes and Phenotypes (dbGaP). Please visit <a href="/access-data/obtaining-access-controlled-data">Obtaining Access to GDC Data and Resources</a> for information about how to obtain permission to access controlled data sets through dbGaP.</p>' +
    "</td></tr></tbody></table>";
  const { doc } = boot(html, "https://gdc.cancer.gov/access-data/gdc-data-portal");
  const td = doc.getElementById("dl");
  assert.ok(plain(td).includes("提供两种主要的数据下载渠道"), plain(td).slice(0, 120));
  assert.ok(plain(td).includes("会生成清单文件"));
  assert.ok(plain(td).includes("获取 GDC 数据与资源的访问权"));
  const links = [...td.querySelectorAll("a")];
  assert.equal(links.length, 5);
  assert.deepEqual(
    links.map((a) => a.getAttribute("href")),
    [
      "https://portal.gdc.cancer.gov/",
      "https://portal.gdc.cancer.gov/",
      "/access-data/gdc-data-transfer-tool",
      "https://portal.gdc.cancer.gov/",
      "/access-data/obtaining-access-controlled-data"
    ]
  );
});

test("data portal：浏览器兼容段模板命中，链接保留", () => {
  const html =
    '<p id="browser">The <a href="https://portal.gdc.cancer.gov/">GDC Data Portal</a> is compatible with most modern web browsers, including:</p>';
  const { doc } = boot(html, "https://gdc.cancer.gov/access-data/gdc-data-portal");
  const p = doc.getElementById("browser");
  assert.ok(plain(p).startsWith("GDC 数据门户兼容大多数现代网页浏览器"), plain(p));
  assert.equal(p.querySelector("a").getAttribute("href"), "https://portal.gdc.cancer.gov/");
});


test("submit-data：提交门户页（站内真实路径）标题与模板命中，链接保留", () => {
  const html =
    '<p id="reg">The GDC Data Submission Portal allows users to submit data associated with projects registered in dbGaP. Information on registering a project in dbGaP is available at <a href="/submit-data/obtaining-access-submit-data">Obtaining Access to Submit Data</a>.</p>' +
    '<p id="dt">Following successful submission of biospecimen and clinical data files into the GDC, users can download a manifest file and import the file into the <a href="/submit-data/gdc-data-transfer-tool">GDC Data Transfer Tool</a> for uploading large molecular data files into the GDC.</p>';
  const { doc } = boot(html, "https://gdc.cancer.gov/submit-data/gdc-data-submission-portal");
  const reg = doc.getElementById("reg");
  assert.ok(plain(reg).startsWith("GDC 数据提交门户允许用户提交与 dbGaP 中已注册项目关联的数据"), plain(reg));
  assert.equal(reg.querySelector("a").getAttribute("href"), "/submit-data/obtaining-access-submit-data");
  assert.equal(reg.querySelector("a").textContent, "获取数据提交权限");
  const dt = doc.getElementById("dt");
  assert.ok(plain(dt).startsWith("生物样本与临床数据文件成功提交至 GDC 后"), plain(dt));
  assert.equal(dt.querySelector("a").getAttribute("href"), "/submit-data/gdc-data-transfer-tool");
  assert.equal(dt.querySelector("a").textContent, "GDC 数据传输工具");
});

// ---------------- 已知边界 ----------------

test("已知边界：含内联 <svg> 外链图标的整段拒绝模板，英文与链接原样保留", () => {
  const svg =
    '<svg focusable="false" class="ext" aria-label="(link is external)"><title>(link is external)</title><path d="M0 0h10v10H0z"></path></svg>';
  const html =
    '<p id="svgp">The GDC currently accepts DNA and RNA sequencing data in both ' +
    '<a href="http://maq.sourceforge.net/fastq.shtml" class="ext">FASTQ' + svg + "</a> and " +
    '<a href="https://samtools.github.io/hts-specs/SAMv1.pdf" class="ext">BAM' + svg + "</a> formats.</p>";
  const { doc } = boot(html, "https://gdc.cancer.gov/about-data/data-types-and-file-formats");
  const p = doc.getElementById("svgp");
  assert.ok(plain(p).includes("The GDC currently accepts DNA and RNA sequencing data"), "该段不应被翻译: " + plain(p));
  const links = [...p.querySelectorAll("a")];
  assert.equal(links.length, 2);
  assert.deepEqual(links.map((a) => a.getAttribute("href")), [
    "http://maq.sourceforge.net/fastq.shtml",
    "https://samtools.github.io/hts-specs/SAMv1.pdf"
  ]);
  assert.equal(p.querySelectorAll("svg").length, 2, "外链图标不应丢失");
});
