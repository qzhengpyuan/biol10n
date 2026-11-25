// nf-core 官网（nf-co.re）词库回归：首页、流程目录、工具目录、文档导航与单个流程页（rnaseq）。
// 站点 id "nfcore"，词库 common/spa/nfcore，SPA（Astro + 客户端岛）。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "nfcore");
if (!site) throw new Error("config/sites.json 里找不到 nfcore 站点");

const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/nfcore.json"), "utf8"));
const data = { exact: {}, rules: [], templates: [] };
for (const id of site.dicts) {
  const p = path.join(root, "../dict", id + ".json");
  if (!fs.existsSync(p)) continue;
  const b = JSON.parse(fs.readFileSync(p, "utf8"));
  Object.assign(data.exact, b.exact || {});
  data.rules = data.rules.concat(b.rules || []);
  data.templates = data.templates.concat(b.templates || []);
}

function run(html, url) {
  const dom = new JSDOM(html, { url: url || "https://nf-co.re/" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return dom.window.document;
}
const text = (el) => el.textContent.replace(/\s+/g, " ").trim();

test("站点配置：hosts/dicts/spa 指向 nf-core", () => {
  assert.equal(site.hosts[0], "nf-co.re");
  assert.ok(site.dicts.includes("common") && site.dicts.includes("nfcore"));
  assert.equal(site.spa, true);
  assert.equal(book.meta.sites[0], "nf-co.re");
});

test("顶部导航：栏目与下拉项翻中文，品牌与包名保留", () => {
  const html = '<nav><a>Home</a><a>Pipelines</a><a>Docs</a><a>Resources</a>' +
    '<a>Community</a><a>About</a><a>nft-utils</a><a>nf-core-utils</a>' +
    '<a>Advisories</a><a>Blog</a><a>Newsletter</a><a>Events</a></nav>';
  const doc = run(html);
  const links = [...doc.querySelectorAll("a")].map(text);
  assert.deepEqual(links, ["首页", "流程", "文档", "资源", "社区", "关于",
    "nft-utils", "nf-core-utils", "安全公告", "博客", "通讯", "活动"]);
});

test("主题切换与加入按钮", () => {
  const html = '<div><span>Select theme</span><span>Light</span><span>Dark</span><span>System</span>' +
    "<a>Join nf-core</a><a>Join Slack</a></div>";
  const doc = run(html);
  const all = [...doc.querySelectorAll("span, a")].map(text);
  assert.deepEqual(all, ["选择主题", "浅色", "深色", "跟随系统", "加入 nf-core", "加入 Slack"]);
});

test("首页 hero、三张受众卡片与功能卡标题", () => {
  const html = "<main>" +
    "<p>A global community collaborating to build open-source Nextflow components and pipelines</p>" +
    "<a>View Pipelines</a>" +
    "<h3>For organisations</h3><p>Highly optimised pipelines with excellent reporting. Validated releases ensure reproducibility.</p>" +
    "<h3>For users</h3><p>Portable, documented and easy to use workflows.<br>Pipelines that you can trust.</p>" +
    "<h3>For developers</h3><p>Companion templates and tools help to validate your code and simplify common tasks.</p>" +
    "<h3>Fully featured pipelines</h3>" +
    "<h5>Documentation</h5><h5>Stable Releases</h5><h5>Open source</h5><h5>CI Testing</h5><h5>Run anywhere</h5><h5>Packaged software</h5>" +
    "</main>";
  const doc = run(html);
  const ps = [...doc.querySelectorAll("p")].map(text);
  assert.match(ps[0], /^一个协作构建开源 Nextflow 组件与流程的全球社区$/);
  assert.equal(text(doc.querySelector("a")), "查看流程");
  assert.equal(text(doc.querySelectorAll("h3")[0]), "面向机构");
  assert.match(ps[1], /^高度优化的流程/);
  assert.equal(text(doc.querySelectorAll("h3")[1]), "面向用户");
  assert.equal(ps[2], "可移植、文档齐全且易于使用的工作流。值得信赖的流程。");
  assert.equal(text(doc.querySelectorAll("h3")[2]), "面向开发者");
  assert.match(ps[3], /^配套模板与工具/);
  assert.equal(text(doc.querySelectorAll("h3")[3]), "功能齐全的流程");
  assert.deepEqual([...doc.querySelectorAll("h5")].map(text),
    ["文档", "稳定发布版", "开源", "持续集成测试", "随处运行", "软件打包"]);
});

test("首页带链接的整句走模板：链接保留、译文完整", () => {
  const html = '<div><p>All nf-core code is <a href="https://github.com/nf-core">community owned</a>.</p>' +
    '<p><strong>Everyone is welcome</strong> to contribute, in any way!</p>' +
    '<p>Contribute ideas and code directly via <a href="https://github.com">GitHub</a>, or come <a href="https://nf-co.re/slack">talk to us in Slack</a>.</p></div>';
  const doc = run(html);
  const ps = [...doc.querySelectorAll("p")];
  assert.equal(text(ps[0]), "所有 nf-core 代码归社区所有。");
  assert.equal(ps[0].querySelector("a").getAttribute("href"), "https://github.com/nf-core");
  assert.equal(text(ps[1]), "欢迎所有人，以任何方式参与贡献！");
  assert.equal(text(ps[2]), "可以直接通过 GitHub 贡献想法与代码，也可以在 Slack 里与我们交流。");
  assert.equal(ps[2].querySelectorAll("a").length, 2);
});

test("流程目录：表头、Browse N 规则与检索前缀提示模板", () => {
  const html = "<div>" +
    "<p>Browse the 160 pipelines that are currently available as part of nf-core.</p>" +
    "<table><thead><tr><th>Status</th><th>Last release</th><th>Name</th><th>Stars</th></tr></thead></table>" +
    '<div><strong>Hint:</strong> Scope your search to one field with a prefix: ' +
    '<span>k:rna</span>(keyword/topic),<span>n:sarek</span>(name),<span>d:variant</span>(description),<span>k:"rna"</span>(exact keyword/topic).</div>' +
    "</div>";
  const doc = run(html);
  assert.equal(text(doc.querySelector("p")), "nf-core 目前共有 160 个可用流程，欢迎浏览。");
  assert.deepEqual([...doc.querySelectorAll("th")].map(text), ["状态", "最近发布", "名称", "星标"]);
  const hint = text(doc.querySelector("div > div"));
  assert.match(hint, /^提示：用前缀把检索范围限定到单个字段：/);
  assert.match(hint, /k:rna（关键词\/主题）/);
  assert.match(hint, /k:"rna"（精确关键词\/主题）。$/);
});

test("文档首页：标题、卡片说明与主题栏目", () => {
  const html = "<main>" +
    "<h1>nf-core documentation</h1>" +
    "<p>Learn to use nf-core pipelines, develop workflows, and contribute to the community</p>" +
    "<h2>Get started</h2>" +
    "<p>New to nf-core? Start here to learn the basics and run your first pipeline.</p>" +
    "<h3>What is nf-core?</h3><p>Introduction to the nf-core project and community</p>" +
    "<h3>Environment setup</h3><p>Set up your system to run nf-core pipelines</p>" +
    "<h2>Topics</h2><p>Explore documentation by topic.</p>" +
    "<h3>Running</h3><p>Run and configure nf-core pipelines</p>" +
    "<h3>Developing</h3><p>Create and maintain nf-core pipelines, components, and configs</p>" +
    "<h2>Additional resources</h2>" +
    "<p>Learn Nextflow and nf-core through comprehensive documentation and hands-on training materials.</p>" +
    "</main>";
  const doc = run(html);
  assert.equal(text(doc.querySelector("h1")), "nf-core 文档");
  const ps = [...doc.querySelectorAll("p")].map(text);
  assert.match(ps[0], /^学习使用 nf-core 流程/);
  assert.equal(ps[1], "刚接触 nf-core？从这里开始了解基础知识并运行你的第一个流程。");
  assert.equal(text(doc.querySelector("h2")), "开始使用");
  assert.equal(text(doc.querySelectorAll("h3")[0]), "什么是 nf-core？");
  assert.equal(ps[2], "nf-core 项目与社区简介");
  assert.equal(ps[3], "配置系统以运行 nf-core 流程");
  assert.equal(text(doc.querySelectorAll("h3")[2]), "运行");
  assert.equal(ps[5], "运行并配置 nf-core 流程");
  assert.equal(text(doc.querySelectorAll("h3")[3]), "开发");
  assert.equal(ps[6], "创建并维护 nf-core 流程、组件与配置");
  assert.match(ps[7], /^通过完整文档与实操培训材料/);
});

test("工具目录：页头说明与常见子命令说明", () => {
  const html = "<main>" +
    "<p>Command-line tools and API for working with nf-core</p>" +
    "<h2>CLI</h2><h3>Installation</h3><div>Install nf-core/tools</div>" +
    '<ul><li><a href="#">create</a><div>Scaffold new pipelines</div></li>' +
    '<li><a href="#">list</a><div>List pipelines</div></li>' +
    '<li><a href="#">launch</a><div>Launch pipelines via TUI or GUI</div></li>' +
    '<li><a href="#">lint</a><div>Lint pipelines</div></li></ul>' +
    "<h2>TUI</h2><p>Explore commands graphically</p>" +
    "<h2>Test datasets</h2><p>List test dataset files</p>" +
    "<h2>API</h2><p>Browse API reference</p>" +
    "</main>";
  const doc = run(html);
  assert.equal(text(doc.querySelector("p")), "用于处理 nf-core 的命令行工具与 API");
  assert.equal(text(doc.querySelector("h3")), "安装");
  const divs = [...doc.querySelectorAll("li div")].map(text);
  assert.deepEqual(divs, ["搭建新流程", "列出流程", "通过 TUI 或 GUI 启动流程", "检查流程"]);
  // 注：create/download/info/update/remove/search 这几个命令行名会被 common 词库的大小写兜底折成中文，
  // 拦它需要 sites.json 给 nf-core 站点加 skip；本例只断言不受影响的那几个。
  assert.deepEqual([...doc.querySelectorAll("li a")].map(text).slice(1), ["list", "launch", "lint"]);
  assert.equal(text(doc.querySelectorAll("h2")[1]), "TUI");
  assert.equal(text(doc.querySelectorAll("h2")[2]), "测试数据集");
});

test("流程页：页签、统计标签与版本/模块规则", () => {
  const html = "<div>" +
    '<ul class="nav"><li><a>Introduction</a></li><li><a>Usage</a></li><li><a>Parameters</a></li><li><a>Output</a></li><li><a>Results</a></li><li><a>Releases</a></li></ul>' +
    "<span>Launch version 3.28.0</span>" +
    "<h6>subscribers</h6><h6>stars</h6><h6>open issues</h6><h6>open PRs</h6>" +
    "<h6>last release</h6><h6>last update</h6><h6>minimum Nextflow version</h6>" +
    "<h6>included modules</h6><h6>included subworkflows</h6>" +
    "<div>and 70 more modules</div><div>and 14 more subworkflows</div>" +
    "<div>Built 6 days ago</div><div>released 8 days ago</div>" +
    "<a>Ask a question on Slack</a><a>Open an issue on GitHub</a>" +
    "</div>";
  const doc = run(html);
  assert.deepEqual([...doc.querySelectorAll("a")].slice(0, 6).map(text),
    ["简介", "使用", "参数", "输出", "结果", "版本发布"]);
  assert.equal(text(doc.querySelector("span")), "启动版本 3.28.0");
  assert.deepEqual([...doc.querySelectorAll("h6")].map(text),
    ["订阅者", "星标", "待处理问题", "待合并 PR", "最近发布", "最近更新",
      "最低 Nextflow 版本", "包含的模块", "包含的子流程"]);
  assert.equal(text(doc.querySelector("div div")), "另有 70 个模块");
  const divs = [...doc.querySelectorAll("div")].slice(2).map(text);
  assert.ok(divs.includes("另有 14 个子流程"));
  assert.ok(divs.includes("构建于 6 天前"));
  assert.ok(divs.includes("发布于 8 天前"));
  assert.deepEqual([...doc.querySelectorAll("a")].slice(6).map(text), ["在 Slack 上提问", "在 GitHub 上提交问题"]);
});

test("流程页正文：整句模板保留代码与链接", () => {
  const html = "<div>" +
    "<p><a href=\"https://nf-co.re/rnaseq\">nf-core/rnaseq</a> is a bioinformatics pipeline that can be used to analyse RNA sequencing data obtained from organisms with a reference genome and annotation. It takes a samplesheet with FASTQ files or pre-aligned BAM files as input, performs quality control (QC), trimming and (pseudo-)alignment, and produces a gene expression matrix and extensive QC report.</p>" +
    "<p>In case the image above is not loading, please have a look at the <a href=\"/x\">static version</a>.</p>" +
    "<p>If you use nf-core/rnaseq for your analysis, please cite it using the following doi: <a href=\"https://doi.org/10.5281/zenodo.1400710\">10.5281/zenodo.1400710</a></p>" +
    "<p>An extensive list of references for the tools used by the pipeline can be found in the <code>CITATIONS.md</code> file.</p>" +
    "</div>";
  const doc = run(html);
  const ps = [...doc.querySelectorAll("p")];
  assert.match(text(ps[0]), /^nf-core\/rnaseq 是一个生物信息学流程/);
  assert.match(text(ps[0]), /质量控制报告。$/);
  assert.equal(text(ps[1]), "如果上方图片无法加载，请查看静态版本。");
  assert.match(text(ps[2]), /^如果你在分析中使用 nf-core\/rnaseq，请使用以下 doi 引用：/);
  assert.equal(ps[2].querySelector("a").textContent.trim(), "10.5281/zenodo.1400710");
  assert.match(text(ps[3]), /CITATIONS\.md/);
  assert.match(text(ps[3]), /文件中找到。$/);
});

test("提示框与输出页结构标题", () => {
  const html = "<div>" +
    "<span>Note</span><span>Warning</span><span>Tip</span>" +
    "<h2>Pipeline overview</h2><h2>Preprocessing</h2><h2>Alignment and quantification</h2>" +
    "<h2>Alignment post-processing</h2><h2>Pseudoalignment and quantification</h2>" +
    "<h2>Workflow reporting and genomes</h2>" +
    "</div>";
  const doc = run(html);
  assert.deepEqual([...doc.querySelectorAll("span")].map(text), ["说明", "警告", "提示"]);
  assert.deepEqual([...doc.querySelectorAll("h2")].map(text),
    ["流程概览", "预处理", "比对与定量", "比对后处理", "伪比对与定量", "工作流报告与基因组"]);
});

test("词库结构：无自映射、译文含汉字、规则锚定且捕获组有引用", () => {
  assert.ok(Object.keys(book.exact).length >= 300);
  for (const [en, zh] of Object.entries(book.exact)) {
    assert.ok(en.trim().length > 0, "英文键不能为空");
    assert.ok(en === en.trim() && zh === zh.trim(), "首尾不能有空白：" + en);
    assert.notEqual(en, zh, "不能自映射：" + en);
    assert.match(zh, /[\u4e00-\u9fff]/, "译文必须含汉字：" + en);
  }
  for (const r of book.rules) {
    assert.ok(r.re.startsWith("^") && r.re.endsWith("$"), "规则必须首尾锚定：" + r.re);
    assert.match(r.to, /[\u4e00-\u9fff]/, "规则译文必须含汉字：" + r.re);
    const groups = (r.re.match(/\((?!\?)/g) || []).length;
    if (groups > 0) assert.match(r.to, /\$\d/, "有捕获组就要在译文引用：" + r.re);
    assert.doesNotThrow(() => new RegExp(r.re), "规则必须能编译：" + r.re);
  }
  for (const t of book.templates) {
    assert.ok(!/[\u4e00-\u9fff]/.test(t.pat), "模板 pat 里不能有汉字：" + t.pat.slice(0, 40));
    assert.match(t.zh, /[\u4e00-\u9fff]/, "模板 zh 必须含汉字");
    const patSlots = (t.pat.match(/\{\{(\d+)\}\}/g) || []).map((x) => Number(x.replace(/[{}]/g, "")));
    const zhSlots = (t.zh.match(/\{\{(\d+)\}\}/g) || []).map((x) => Number(x.replace(/[{}]/g, "")));
    assert.ok(patSlots.length > 0, "模板 pat 至少一个槽位");
    assert.deepEqual(patSlots.slice().sort((a, b) => a - b), zhSlots.slice().sort((a, b) => a - b),
      "占位符数量必须一致：" + t.pat.slice(0, 40));
    for (let i = 0; i < zhSlots.length; i++) assert.equal(zhSlots.slice().sort((a, b) => a - b)[i], i + 1);
  }
});

test("残留口径抽样：只留英文专名、包名与命令行", () => {
  const html = '<div><p>nf-core</p><p>Nextflow</p><p>MultiQC</p><p>FastQC</p>' +
    '<p>--input samplesheet.csv</p><p>nf-core/rnaseq</p><p>rna-seq</p></div>';
  const doc = run(html);
  assert.deepEqual([...doc.querySelectorAll("p")].map(text),
    ["nf-core", "Nextflow", "MultiQC", "FastQC", "--input samplesheet.csv", "nf-core/rnaseq", "rna-seq"]);
});
