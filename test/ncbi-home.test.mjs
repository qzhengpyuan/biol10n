// NCBI 三个资源首页（Nucleotide / Protein / Datasets）词库冒烟测试
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/ncbi-home.json"), "utf8"));

// 这三个站接线时会一起加载（common + ncbi 管公共骨架，本册管资源首页正文）
const merged = { exact: {}, rules: [], templates: [] };
for (const name of ["common", "ncbi", "ncbi-home"]) {
  const b = JSON.parse(fs.readFileSync(path.join(root, "../dict", name + ".json"), "utf8"));
  Object.assign(merged.exact, b.exact || {});
  merged.rules.push(...(b.rules || []));
  merged.templates.push(...(b.templates || []));
}

function mount(html, url) {
  const dom = new JSDOM(html, { url: url || "https://www.ncbi.nlm.nih.gov/nuccore/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: merged,
    site: { scope: "body" }
  });
  engine.start();
  return dom.window.document;
}

test("词库结构：family/sites、条目数、rule 合法、模板合法", () => {
  assert.equal(dict.meta.family, "ncbi-home");
  assert.ok(dict.meta.sites.includes("www.ncbi.nlm.nih.gov"));
  assert.ok(Object.keys(dict.exact).length >= 30, "条目数应 >= 30，实际 " + Object.keys(dict.exact).length);
  assert.ok(Array.isArray(dict.rules));
  assert.ok(Array.isArray(dict.templates));
  for (const r of dict.rules) {
    assert.doesNotThrow(() => new RegExp(r.re), "坏规则: " + r.re);
    assert.equal(typeof r.to, "string");
    assert.ok(/\$\d/.test(r.to) || !/\(/.test(r.re), "规则有捕获组但译文没用到: " + r.re);
  }
  for (const t of dict.templates) {
    assert.ok(typeof t.pat === "string" && t.pat.length >= 20 && t.pat.length <= 2200, "模板长度越界: " + t.pat);
    assert.ok(/[\u4e00-\u9fff]/.test(t.zh), "模板译文没有中文: " + t.pat);
  }
});

test("key 里没有中文，值里没有明文 URL/邮箱", () => {
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "key 含中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "key 首尾空白: " + k);
    assert.equal(v, v.trim(), "值首尾空白: " + k);
    assert.ok(/[\u4e00-\u9fff]/.test(v), "值没有中文: " + k);
    assert.ok(!/https?:\/\//i.test(v), "值含 URL: " + k);
    assert.ok(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(v), "值含邮箱: " + k);
  }
});

test("关键条目存在（/nuccore/、/protein/、/datasets/ 实测原文）", () => {
  const want = [
    "Using Nucleotide",
    "Using Protein",
    "Nucleotide Tools",
    "Protein Tools",
    "Other Resources",
    "Quick Start Guide",
    "Submit to GenBank",
    "GenBank Home",
    "RefSeq Home",
    "Gene Home",
    "SRA Home",
    "How to use NCBI Datasets",
    "More ways to explore",
    "Command-line tools",
    "How-to guides",
    "Data resources",
    "Analysis tools",
    "Data quality tools",
    "Enter a species"
  ];
  for (const k of want) assert.ok(Object.prototype.hasOwnProperty.call(dict.exact, k), "缺条目: " + k);
});

test("/nuccore/ 首页：数据库说明、三组入口卡片标题与链接", () => {
  const doc = mount(
    "<main><h1>Nucleotide</h1>" +
      '<div class="dbdescription">The Nucleotide database is a collection of sequences from several sources, including GenBank, RefSeq, TPA and PDB. Genome, gene and transcript sequence data provide the foundation for biomedical research and discovery.</div>' +
      '<div class="portlet"><h2>Using Nucleotide</h2><ul>' +
      '<li><a href="#">Quick Start Guide</a></li><li><a href="#">FAQ</a></li><li><a href="#">Help</a></li>' +
      '<li><a href="#">GenBank FTP</a></li><li><a href="#">RefSeq FTP</a></li></ul></div>' +
      '<div class="portlet"><h2>Nucleotide Tools</h2><ul>' +
      '<li><a href="#">Submit to GenBank</a></li><li><a href="#">LinkOut</a></li><li><a href="#">E-Utilities</a></li>' +
      '<li><a href="#">BLAST</a></li><li><a href="#">Batch Entrez®</a></li></ul></div>' +
      '<div class="portlet"><h2>Other Resources</h2><ul>' +
      '<li><a href="#">GenBank Home</a></li><li><a href="#">RefSeq Home</a></li><li><a href="#">Gene Home</a></li>' +
      '<li><a href="#">SRA Home</a></li><li><a href="#">INSDC</a></li></ul></div></main>',
    "https://www.ncbi.nlm.nih.gov/nuccore/"
  );
  assert.match(doc.querySelector(".dbdescription").textContent, /^Nucleotide 数据库汇集了来自 GenBank、RefSeq、TPA 与 PDB 等多个来源的序列。/);
  assert.equal(doc.querySelectorAll("h2")[0].textContent.trim(), "使用 Nucleotide");
  assert.equal(doc.querySelectorAll("h2")[1].textContent.trim(), "Nucleotide 工具");
  assert.equal(doc.querySelectorAll("h2")[2].textContent.trim(), "其他资源");
  const links = [...doc.querySelectorAll("a")].map((e) => e.textContent.trim());
  assert.equal(links[0], "快速入门指南");
  assert.ok(links.includes("向 GenBank 提交"), "Submit to GenBank 未翻译");
  // 资源名不翻
  for (const k of ["GenBank FTP", "RefSeq FTP", "LinkOut", "E-Utilities", "BLAST", "Batch Entrez®", "INSDC"]) {
    assert.ok(links.includes(k), "资源名被翻或丢失: " + k);
  }
  for (const k of ["GenBank 首页", "RefSeq 首页", "Gene 首页", "SRA 首页"]) {
    assert.ok(links.includes(k), "缺译文: " + k);
  }
});

test("/protein/ 首页：说明句与 Protein 工具卡片", () => {
  const doc = mount(
    "<main><h1>Protein</h1>" +
      '<div class="dbdescription">The Protein database is a collection of sequences from several sources, including translations from annotated coding regions in GenBank, RefSeq and TPA, as well as records from SwissProt, PIR, PRF, and PDB. Protein sequences are the fundamental determinants of biological structure and function.</div>' +
      '<h2>Using Protein</h2><h2>Protein Tools</h2><h2>Other Resources</h2>' +
      '<a href="#">Quick Start Guide</a><a href="#">GenBank FTP</a><a href="#">Batch Entrez</a><a href="#">CDD</a>',
    "https://www.ncbi.nlm.nih.gov/protein/"
  );
  assert.match(doc.querySelector(".dbdescription").textContent, /^Protein 数据库汇集了来自多个来源的序列/);
  const h2 = [...doc.querySelectorAll("h2")].map((e) => e.textContent.trim());
  assert.deepEqual(h2, ["使用 Protein", "Protein 工具", "其他资源"]);
  const links = [...doc.querySelectorAll("a")].map((e) => e.textContent.trim());
  assert.deepEqual(links, ["快速入门指南", "GenBank FTP", "Batch Entrez", "CDD"]);
});

test("/datasets/ 单文本节点的链接走 rules 兜底", () => {
  const doc = mount(
    "<main><a href='/g'>Browse all 39 genomes</a><a href='/x'>View the Mus musculus taxonomy page</a>" +
      "<a href='/r'>View the reference genome GRCm39</a></main>",
    "https://www.ncbi.nlm.nih.gov/datasets/"
  );
  const links = [...doc.querySelectorAll("a")].map((e) => e.textContent.trim());
  assert.deepEqual(links, ["浏览全部 39 个基因组", "查看 Mus musculus 分类学页面", "查看参考基因组 GRCm39"]);
});

test("/datasets/ 首页：How to use、Get started 卡片与 More ways to explore", () => {
  const doc = mount(
    "<main>" +
      '<section data-section="hero-graphic"><h1>NCBI Datasets</h1>' +
      "<p>A one-stop shop for finding, browsing, and downloading genomic data</p>" +
      '<span class="helper-text">Examples:</span><a href="#">red-winged blackbird</a><a href="#">Salmonella</a></section>' +
      '<section data-section="hero_section"><h2>How to use NCBI Datasets</h2>' +
      "<p>The best way to start is to use the search bar above. But here's an example of the types of resources and data we offer.</p>" +
      "<h4>Looking for basic information?</h4><a href='/t'>Browse the taxonomy tree</a>" +
      "<a href='/x'>View the <!--s1-->Tursiops truncatus<!--s2--> taxonomy page</a>" +
      "<h4>Interested in genomic data?</h4><a href='/g'>Browse all <!--s3-->7<!--s4--> genomes</a>" +
      "<a href='/r'>View the reference genome <!--s5-->mTurTru1.mat.Y</a>" +
      "<a href='/b'>BLAST against the reference genome</a>" +
      "<h4>Searching for gene data?</h4><a href='/gn'>Browse all <!--s6-->Tursiops truncatus<!--s7--> genes</a></section>" +
      '<section data-section="explore_section"><h2>More ways to explore</h2>' +
      "<h4>Command-line tools</h4><p>Step-by-step instructions on installing NCBI Datasets command-line tools to retrieve gene, genome, and coronavirus data</p>" +
      "<h4>How-to guides</h4><p>Use NCBI Datasets to gather metadata, download data packages, view reports, and more</p>" +
      "<h4>GitHub</h4><p>Request a new feature or submit a bug report by opening an issue in GitHub</p></section>" +
      '<section><a href="/cgr">NIH Comparative Genomics Resource (CGR)</a>' +
      "<p>This resource is part of the NIH Comparative Genomics Resource (CGR) Toolkit</p>" +
      '<a href="/about">About CGR</a><a href="/d">Data resources</a><a href="/a">Analysis tools</a><a href="/q">Data quality tools</a></section>' +
      '<input placeholder="Enter a species"><input placeholder="Search NCBI ...">' +
      "</main>",
    "https://www.ncbi.nlm.nih.gov/datasets/"
  );
  assert.equal(doc.querySelector("h1").textContent, "NCBI Datasets", "资源名不应翻译");
  assert.match(doc.querySelector("section[data-section='hero-graphic'] p").textContent, /^一站式查找、浏览与下载基因组数据的平台$/);
  assert.equal(doc.querySelector(".helper-text").textContent, "示例：");
  assert.deepEqual([...doc.querySelectorAll("h2")].map((e) => e.textContent), ["如何使用 NCBI Datasets", "更多探索方式"]);
  assert.equal(doc.querySelectorAll("h4")[0].textContent, "想了解基本信息？");
  assert.equal(doc.querySelectorAll("h4")[1].textContent, "对基因组数据感兴趣？");
  assert.equal(doc.querySelectorAll("h4")[2].textContent, "在找基因数据？");
  const links = [...doc.querySelectorAll("section[data-section='hero_section'] a")].map((e) => e.textContent.trim());
  assert.deepEqual(links, [
    "浏览分类树",
    "查看 Tursiops truncatus 分类学页面",
    "浏览全部 7 个基因组",
    "查看参考基因组 mTurTru1.mat.Y",
    "对参考基因组运行 BLAST",
    "浏览全部 Tursiops truncatus 基因"
  ]);
  // 示例物种名不翻
  const heroLinks = [...doc.querySelectorAll("section[data-section='hero-graphic'] a")].map((e) => e.textContent);
  assert.deepEqual(heroLinks, ["red-winged blackbird", "Salmonella"]);
  // More ways to explore 三张卡片
  const explore = doc.querySelector("section[data-section='explore_section']");
  assert.deepEqual([...explore.querySelectorAll("h4")].map((e) => e.textContent), ["命令行工具", "操作指南", "GitHub"]);
  const ps = [...explore.querySelectorAll("p")].map((e) => e.textContent);
  assert.match(ps[0], /^分步说明如何安装 NCBI Datasets 命令行工具/);
  assert.match(ps[1], /^使用 NCBI Datasets 收集元数据/);
  assert.match(ps[2], /^在 GitHub 中提交 issue/);
  // CGR 区块
  assert.equal(doc.querySelectorAll("section")[3].querySelector("p").textContent, "本资源是 NIH 比较基因组学资源（CGR）工具包的一部分");
  assert.deepEqual([...doc.querySelectorAll("section")[3].querySelectorAll("a")].slice(1).map((e) => e.textContent), ["关于 CGR", "数据资源", "分析工具", "数据质量工具"]);
  // placeholder 通道
  const inputs = [...doc.querySelectorAll("input")].map((e) => e.getAttribute("placeholder"));
  assert.deepEqual(inputs, ["输入物种名", "检索 NCBI ..."]);
});