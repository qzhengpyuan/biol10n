// NCBI 站点指南与 About 页词库（dict/ncbi-guide.json）冒烟测试
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/ncbi-guide.json"), "utf8"));

// 站点接线时这三册会一起加载（common + ncbi 管公共 chrome，本册管 guide/about 正文）
const merged = { exact: {}, rules: [], templates: [] };
for (const name of ["common", "ncbi", "ncbi-guide"]) {
  const b = JSON.parse(fs.readFileSync(path.join(root, "../dict", name + ".json"), "utf8"));
  Object.assign(merged.exact, b.exact || {});
  merged.rules.push(...(b.rules || []));
  merged.templates.push(...(b.templates || []));
}

function mount(html, url) {
  const dom = new JSDOM(html, { url: url || "https://www.ncbi.nlm.nih.gov/guide/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: merged,
    site: { scope: "body" }
  });
  engine.start();
  return dom.window.document;
}

test("词库结构：family/sites、条目数、rule 合法", () => {
  assert.equal(dict.meta.family, "ncbi-guide");
  assert.ok(dict.meta.sites.includes("www.ncbi.nlm.nih.gov"));
  assert.ok(Object.keys(dict.exact).length >= 25, "条目数应 >= 25，实际 " + Object.keys(dict.exact).length);
  assert.ok(Array.isArray(dict.rules));
  assert.ok(Array.isArray(dict.templates));
  for (const r of dict.rules) {
    assert.doesNotThrow(() => new RegExp(r.re), "坏规则: " + r.re);
    assert.equal(typeof r.to, "string");
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

test("关键条目存在（/guide/ 与 /home/about/ 实测原文）", () => {
  const want = [
    "National Center for Biotechnology Information",
    "Welcome to NCBI",
    "The National Center for Biotechnology Information advances science and health by providing access to biomedical and genomic information.",
    "About the NCBI",
    "Mission",
    "NCBI News & Blog",
    "Deposit data or manuscripts into NCBI databases",
    "Transfer NCBI data to your computer",
    "Find help documents, attend a class or watch a tutorial",
    "Develop",
    "Use NCBI APIs and code libraries to build applications",
    "Analyze",
    "Identify an NCBI tool for your data analysis task",
    "Research",
    "Explore NCBI research and collaborative projects",
    "Resource List (A-Z)",
    "Popular Resources",
    "About NCBI",
    "Our Mission",
    "NCBI’s contribution to the NIH mission of ‘uncovering new knowledge’",
    "Organizational Structure",
    "The role of the branches within NCBI and the Board of Scientific Counselors.",
    "Programs & Activities",
    "NCBI’s resources for genomic, genetic, and biomedical data",
    "Researchers at NCBI",
    "The basic research program conducted by our intramural investigators",
    "health",
    "chemicals",
    "popular resources ▼",
    "Search NCBI"
  ];
  for (const k of want) assert.ok(Object.prototype.hasOwnProperty.call(dict.exact, k), "缺条目: " + k);
});

test("/guide/ 首页：标题、导语、六张行动卡与说明句翻成中文", () => {
  const doc = mount(
    "<main>" +
      '<h1>\nWelcome to NCBI</h1>' +
      "<p>\nThe National Center for Biotechnology Information advances science and health by providing access to biomedical and genomic information.</p>" +
      '<ul class="about_links"><li><a href="/About/">About the NCBI</a> |</li><li><a href="/x">Mission</a> |</li>' +
      '<li><a href="/y">Organization</a> |</li><li><a href="https://ncbiinsights.ncbi.nlm.nih.gov">NCBI News&nbsp;&amp; Blog</a></li></ul>' +
      '<section class="action_bar">' +
      '<div><h2>\nSubmit</h2><p><a href="/s">Deposit data or manuscripts into NCBI databases</a></p></div>' +
      '<div><h2>\nDownload</h2><p><a href="/d">Transfer NCBI data to your computer </a></p></div>' +
      '<div><h2>\nLearn</h2><p><a href="/l">Find help documents, attend a class or watch a tutorial</a></p></div>' +
      '<div><h2>\nDevelop</h2><p><a href="/v">Use NCBI APIs and code libraries to build applications</a></p></div>' +
      '<div><h2>\nAnalyze</h2><p><a href="/a">Identify an NCBI tool for your data analysis task</a></p></div>' +
      '<div><h2>\nResearch</h2><p><a href="/r">Explore NCBI research and collaborative projects</a></p></div>' +
      "</section>" +
      '<h3>Popular Resources</h3><ul><li><a href="/pubmed/">PubMed</a></li><li><a href="/blast/">BLAST</a></li></ul>' +
      "</main>"
  );
  assert.equal(doc.querySelector("h1").textContent.trim(), "欢迎访问 NCBI");
  assert.match(doc.querySelector("p").textContent, /美国国家生物技术信息中心通过提供生物医学与基因组信息/);
  const links = [...doc.querySelectorAll(".about_links a")].map((e) => e.textContent.trim());
  assert.deepEqual(links, ["关于 NCBI", "使命", "机构", "NCBI 新闻与博客"]);
  const h2 = [...doc.querySelectorAll("section h2")].map((e) => e.textContent.trim());
  assert.deepEqual(h2, ["提交", "下载", "学习", "开发", "分析", "研究"]);
  const cards = [...doc.querySelectorAll("section p a")].map((e) => e.textContent.trim());
  assert.deepEqual(cards, [
    "向 NCBI 数据库提交数据或稿件",
    "将 NCBI 数据传输到你的计算机",
    "查找帮助文档、参加课程或观看教程",
    "使用 NCBI API 与代码库构建应用",
    "为你的数据分析任务选择合适的 NCBI 工具",
    "浏览 NCBI 的研究与协作项目"
  ]);
  assert.equal(doc.querySelector("h3").textContent.trim(), "常用资源");
  // 资源名不翻
  assert.deepEqual([...doc.querySelectorAll("h3 + ul a")].map((e) => e.textContent), ["PubMed", "BLAST"]);
});

test("/home/about/ 卡片：<br> 拆开的标题整串命中，说明句翻成中文", () => {
  const doc = mount(
    '<div id="maincontent"><h1 class="gray-border large_h1">About NCBI</h1>' +
      '<div class="action_bar">' +
      '<a href="mission/"><section><h2>Our<br>\n Mission</h2>' +
      "<p class=\"button_text\">NCBI’s contribution to the NIH mission of ‘uncovering new knowledge’</p></section></a>" +
      '<a href="structure/"><section><h2 class="tutorials">Organizational Structure</h2>' +
      '<p class="button_text">The role of the branches within NCBI and the Board of Scientific Counselors.</p></section></a>' +
      '<a href="programs/"><section><h2>Programs<br>\n &amp; Activities</h2>' +
      "<p class=\"button_text\">NCBI’s resources for genomic, genetic, and biomedical data</p></section></a>" +
      '<a href="/research/"><section><h2 class="documentation">Researchers<br>\n at NCBI</h2>' +
      '<p class="button_text">The basic research program conducted by our intramural investigators</p></section></a>' +
      "</div></div>",
    "https://www.ncbi.nlm.nih.gov/home/about/"
  );
  assert.equal(doc.querySelector("h1").textContent.trim(), "关于 NCBI");
  const h2 = [...doc.querySelectorAll("h2")].map((e) => e.textContent.replace(/\s+/g, " ").trim());
  assert.deepEqual(h2, ["我们的使命", "组织结构", "项目与活动", "NCBI 的研究人员"]);
  const ps = [...doc.querySelectorAll("p.button_text")].map((e) => e.textContent.trim());
  assert.deepEqual(ps, [
    "对 NIH「发现新知识」这一使命的贡献",
    "NCBI 各分支机构与科学顾问委员会的职责。",
    "NCBI 的基因组、遗传与生物医学数据资源",
    "由本机构内部研究人员开展的基础研究"
  ]);
});

test("导航与检索框：health / chemicals / popular resources / 搜索占位符", () => {
  const doc = mount(
    "<nav><ul>" +
      '<li><a href="/health/" class="uppercase">health</a></li>' +
      '<li><a href="/chemicals/" class="uppercase">chemicals</a></li>' +
      '<li class="popular-res-menu"><a href="#" class="uppercase">popular resources ▼</a></li>' +
      "</ul></nav>" +
      '<input id="search" type="text" placeholder="Search NCBI">'
  );
  const nav = [...doc.querySelectorAll("nav a")].map((e) => e.textContent);
  assert.deepEqual(nav, ["健康", "化学", "常用资源 ▼"]);
  assert.equal(doc.querySelector("input").getAttribute("placeholder"), "检索 NCBI");
});
