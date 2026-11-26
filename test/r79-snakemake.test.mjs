// Snakemake 官网（snakemake.github.io）词库回归：首页、插件目录、工作流目录与其文档页。
// 站点 id "snakemake"，词库 common/snakemake。
// 注：Snakemake 的 Sphinx 文档站（snakemake.readthedocs.io）与 wrappers 索引（snakemake-wrappers.readthedocs.io）
// 不在 snakemake.github.io 这个 host 下，sites.json 也只认这个 host，所以本册只覆盖首页 + 插件目录 + 工作流目录。
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
const site = sites.find((s) => s.id === "snakemake");
if (!site) throw new Error("config/sites.json 里找不到 snakemake 站点");

const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/snakemake.json"), "utf8"));
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
  const dom = new JSDOM(html, { url: url || "https://snakemake.github.io/" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return dom.window.document;
}
const text = (el) => el.textContent.replace(/\s+/g, " ").trim();

test("站点配置：hosts/dicts 指向 snakemake.github.io", () => {
  assert.equal(site.hosts[0], "snakemake.github.io");
  assert.ok(site.dicts.includes("common") && site.dicts.includes("snakemake"));
  assert.equal(book.meta.sites[0], "snakemake.github.io");
});

test("首页：顶栏与 hero 按钮", () => {
  const html = "<nav><a>Docs</a><a>Sponsor us</a></nav>" +
    "<div><a>Read the docs</a><a>Tutorial</a><a>Read the paper</a><a>Workflow catalog</a></div>";
  const doc = run(html);
  assert.deepEqual([...doc.querySelectorAll("a")].map(text),
    ["文档", "赞助我们", "阅读文档", "教程", "阅读论文", "工作流目录"]);
});

test("首页：功能区块标题（含引号标题）与作者区", () => {
  const html = "<div>" +
    "<h1>Readability and automation</h1><h1>Portability</h1><h1>Scripting integration</h1>" +
    "<h1>Modularization</h1><h1>\"Turing completeness\"</h1><h1>Human Readability</h1>" +
    "<h1>Dynamic workflows</h1><h1>Transparency and data provenance</h1>" +
    "<h1>Scalability</h1><h1>Configurability</h1><h1>Extensibility</h1>" +
    "<h1>Community driven development</h1>" +
    '<h1 class="x">Authors and Contributors<span title="ordered by number of contributions">&nbsp;ⓘ</span></h1>' +
    "</div>";
  const doc = run(html);
  const hs = [...doc.querySelectorAll("h1")].map(text);
  assert.deepEqual(hs.slice(0, 12), ["可读性与自动化", "可移植性", "脚本集成", "模块化",
    "「图灵完备」", "人类可读性", "动态工作流", "透明度与数据溯源",
    "可伸缩性", "可配置性", "可扩展性", "社区驱动开发"]);
  assert.equal(hs[12], "作者与贡献者 ⓘ");
  assert.equal(doc.querySelector("span").getAttribute("title"), "按贡献数量排序");
});

test("首页：带链接的整句走模板，链接与 href 保留", () => {
  const html = "<div>" +
    '<p>By integration with the <a href="https://conda.io">Conda package manager</a> and <a href="https://apptainer.org">containers</a>, all software dependencies of each workflow step are automatically deployed upon execution.</p>' +
    '<p>Register for the <a href="https://x">Snakemake Hackathon 2027</a> at <a href="https://y">Paul Scherrer Institute</a>, Switzerland.</p>' +
    '<p>Snakemake allows to define workflows that are dynamically updated at runtime. By defining so-called <a href="https://z">checkpoints</a>, the workflow can be dynamically adapted at runtime. Further, input can be provided as <a href="https://q">Python queues</a>, thereby enabling a workflow to continuously receive new input data (e.g. while a certain measurement is conducted).</p>' +
    "</div>";
  const doc = run(html);
  const ps = [...doc.querySelectorAll("p")];
  assert.equal(text(ps[0]), "通过与 Conda 包管理器和容器集成，每个工作流步骤的所有软件依赖都会在执行时自动部署。");
  assert.equal(ps[0].querySelectorAll("a").length, 2);
  assert.equal(ps[0].querySelector("a").getAttribute("href"), "https://conda.io");
  assert.equal(text(ps[1]), "报名参加在瑞士 Paul Scherrer Institute 举办的 Snakemake 黑客松 2027。");
  assert.match(text(ps[2]), /^Snakemake 允许定义在运行时动态更新的工作流：通过定义所谓的检查点/);
  assert.match(text(ps[2]), /输入还可以通过 Python 队列提供/);
  assert.equal(ps[2].querySelectorAll("a").length, 2);
});

test("首页：引用计数与下载量（数字与链接保留）", () => {
  const html = '<div><p>&gt;14 new citations per week (<a href="https://a">old</a> + <a href="https://b">new paper</a>)</p>' +
    '<a href="https://c">&gt;1,200,000 downloads</a></div>';
  const doc = run(html);
  assert.equal(text(doc.querySelector("p")), ">每周新增引用 14 次以上（旧论文 + 新论文）");
  assert.equal(text(doc.querySelector("div > a")), ">1,200,000 次下载");
});

test("首页：页脚版权与作者区标题", () => {
  const html = '<footer><p>© 2025, The Snakemake team. Built with <a href="https://x">Sphinx 7.2.6</a></p>' +
    '<p>© 2023, The Snakemake team Built with <a href="https://y">Sphinx 8.2.3</a></p></footer>';
  const doc = run(html);
  assert.equal(text(doc.querySelectorAll("p")[0]), "© 2025，Snakemake 团队。由 Sphinx 7.2.6 构建");
  assert.equal(text(doc.querySelectorAll("p")[1]), "© 2023，Snakemake 团队。由 Sphinx 8.2.3 构建");
});

test("插件目录首页：分类标题、正文模板与页脚", () => {
  const html = '<div><p>executor plugins</p><p>storage plugins</p><p>report plugins</p>' +
    '<p>logger plugins</p><p>scheduler plugins</p>' +
    '<p>This catalog collects information about and documentation of all Snakemake plugins published on <a href="https://pypi.org">PyPI</a>. Note that plugin support is available in <a href="https://snakemake.readthedocs.io">Snakemake 8.0</a> and later. Via plugins, Snakemake enables users and developers to extend the core functionality, e.g. by providing backends for execution and storage, or supporting different ways of logging or scheduling. Via stable, concise, and well documented semantically versioned interfaces, plugin evolution can happen independently of the main Snakemake codebase. The following illustration depicts the general architecture of Snakemake and its plugin interfaces:</p>' +
    '<p>Improve the catalog itself by filing issues or creating pull requests at <a href="https://github.com">https://github.com/snakemake/snakemake-plugin-catalog</a>.</p></div>';
  const doc = run(html, "https://snakemake.github.io/snakemake-plugin-catalog/");
  const ps = [...doc.querySelectorAll("p")].map(text);
  assert.deepEqual(ps.slice(0, 5), ["执行器插件", "存储插件", "报告插件", "日志插件", "调度器插件"]);
  assert.match(ps[5], /^本目录收集了发布在 PyPI 上的所有 Snakemake 插件的信息与文档。/);
  assert.match(ps[5], /下图展示了 Snakemake 及其插件接口的整体架构：$/);
  assert.equal(ps[6], "在 https://github.com/snakemake/snakemake-plugin-catalog 提交 issue 或 pull request 来改进本目录。");
});

test("插件详情页：面包屑规则、章节标题、设置表头与固定说明句", () => {
  const html = "<div>" +
    "<span>Snakemake executor plugin: slurm</span>" +
    "<h2>Installation</h2><h2>Usage</h2><h2>Settings</h2><h2>Further details</h2>" +
    "<table><thead><tr><th>CLI argument</th><th>Description</th><th>Default</th><th>Choices</th><th>Required</th><th>Type</th></tr></thead></table>" +
    "<p>This plugin is not maintained and reviewed by the official Snakemake organization.</p>" +
    '<p>The executor plugin has the following settings (which can be passed via command line, the workflow or environment variables, if provided in the respective columns):</p>' +
    '<p>In order to use the plugin, run Snakemake (&gt;=9.11) with the corresponding value for the logger flag:</p>' +
    '<p>Maximum number of requests per second for this storage provider. If nothing is specified, the default implemented by the storage plugin is used.</p>' +
    "</div>";
  const doc = run(html, "https://snakemake.github.io/snakemake-plugin-catalog/plugins/executor/slurm.html");
  assert.equal(text(doc.querySelector("span")), "Snakemake 执行器插件：slurm");
  assert.deepEqual([...doc.querySelectorAll("h2")].map(text), ["安装", "使用", "设置", "更多细节"]);
  assert.deepEqual([...doc.querySelectorAll("th")].map(text),
    ["命令行参数", "描述", "默认", "可选值", "必填", "类型"]);
  const ps = [...doc.querySelectorAll("p")].map(text);
  assert.equal(ps[0], "本插件不由 Snakemake 官方组织维护与审核。");
  assert.match(ps[1], /^执行器插件有以下设置/);
  assert.equal(ps[2], "要使用该插件，请用对应的 logger 参数值运行 Snakemake（>=9.11）：");
  assert.match(ps[3], /^该存储提供方每秒的最大请求数。未指定时使用存储插件自带的默认值。$/);
});

test("插件详情页：安装与持久化模板保留代码占位", () => {
  const html = "<div>" +
    '<p>In order to use the plugin, run Snakemake (&gt;=8.6) in the folder where your workflow code and config resides (containing either <code>Snakefile</code> or <code>workflow/Snakefile</code>) with the corresponding value for the executor flag:</p>' +
    '<p>All arguments can also be persisted via a <a href="https://snakemake.readthedocs.io">profile</a>, such that they don’t have to be specified on each invocation. Here, this would mean the following entries inside of the profile</p>' +
    '<p>For specifying other default resources than the built-in ones, see the <a href="https://x">snakemake documentation on resources</a>.</p>' +
    "</div>";
  const doc = run(html, "https://snakemake.github.io/snakemake-plugin-catalog/plugins/executor/slurm.html");
  const ps = [...doc.querySelectorAll("p")].map(text);
  assert.match(ps[0], /^要使用该插件，请在工作流代码与配置所在的目录（包含 Snakefile 或 workflow\/Snakefile）中/);
  assert.equal(doc.querySelectorAll("code").length, 2, "code 必须保留原样");
  assert.match(ps[1], /^所有参数也可以通过配置档案保存下来/);
  assert.equal(ps[2], "如需指定内置资源之外的默认资源，请参阅snakemake documentation on resources。");
});

test("工作流目录：侧栏、表头、表题与统计徽标规则", () => {
  const html = "<div>" +
    "<nav><a>Top workflows by stars</a><a>Top workflows by watchers</a><a>Top workflows by update</a>" +
    "<a>Top workflows by tests</a><a>Top workflows by topic</a>" +
    "<a>All standardized workflows</a><a>All other workflows</a></nav>" +
    "<table><caption>All workflows according to ‘standardized usage’</caption>" +
    "<thead><tr><th>Workflow</th><th>Description</th><th>Topics</th><th>Reporting</th><th>Stars</th><th>Watchers</th></tr></thead></table>" +
    "<div><span>Updated: 2026-10-09</span><span>Release: v3.1.2</span><span>formatting: passed</span>" +
    "<span>linting: failed</span><span>373 stars</span><span>12 watchers</span><span>5 tests</span></div>" +
    "</div>";
  const doc = run(html, "https://snakemake.github.io/snakemake-workflow-catalog/docs/workflows_by_stars.html");
  assert.deepEqual([...doc.querySelectorAll("nav a")].map(text),
    ["按星标排序的工作流", "按关注数排序的工作流", "按更新时间排序的工作流",
      "按测试数排序的工作流", "按主题排序的工作流", "全部标准化工作流", "其他工作流"]);
  assert.equal(text(doc.querySelector("caption")), "全部符合「标准化用法」的工作流");
  assert.deepEqual([...doc.querySelectorAll("th")].map(text),
    ["工作流", "描述", "主题", "报告", "星标", "关注数"]);
  assert.deepEqual([...doc.querySelectorAll("span")].map(text),
    ["更新：2026-10-09", "发布：v3.1.2", "格式检查：通过", "代码检查：未通过",
      "373 星标", "12 关注", "5 个测试"]);
});

test("工作流详情页：元信息标签、步骤标题与部署模板", () => {
  const html = "<div>" +
    "<p>Latest release:</p><p>Last update:</p><p>Share link:</p><p>Quality control:</p><p>Topics:</p><p>Wrappers:</p>" +
    "<h2>Deployment</h2><h3>Step 1: Install Snakemake and Snakedeploy</h3>" +
    "<h3>Step 2: Deploy workflow</h3><h3>Step 3: Configure workflow</h3>" +
    "<h3>Step 4: Run workflow</h3><h3>Step 5: Generate report</h3>" +
    '<p>Snakemake and Snakedeploy are best installed <em>via</em> the <a href="https://conda.io">Conda</a> package manager. It is recommended to install conda <em>via</em> <a href="https://github.com/conda-forge/miniforge">Miniforge</a>. Run</p>' +
    '<p>For other installation methods, refer to the <a href="https://x">Snakemake</a> and <a href="https://y">Snakedeploy</a> documentation.</p>' +
    '<p>For further options such as cluster and cloud execution, see <a href="https://z">the docs</a>.</p>' +
    "</div>";
  const doc = run(html, "https://snakemake.github.io/snakemake-workflow-catalog/docs/workflows/franciscozorrilla/metaGEM.html");
  const ps = [...doc.querySelectorAll("p")].map(text);
  assert.deepEqual(ps.slice(0, 6), ["最新发布：", "最近更新：", "分享链接：", "质量检查：", "主题：", "包装器："]);
  assert.deepEqual([...doc.querySelectorAll("h3")].map(text),
    ["第 1 步：安装 Snakemake 与 Snakedeploy", "第 2 步：部署工作流", "第 3 步：配置工作流",
      "第 4 步：运行工作流", "第 5 步：生成报告"]);
  assert.equal(ps[6], "Snakemake 与 Snakedeploy 最好通过 Conda 包管理器安装；conda 建议通过 Miniforge 安装。运行");
  assert.equal(ps[7], "其它安装方法请参阅 Snakemake 与 Snakedeploy 的文档。");
  assert.equal(ps[8], "集群、云端执行等更多选项见文档。");
});

test("工作流目录 about 页：整句模板与段落", () => {
  const html = "<div>" +
    '<p>Workflows are <a href="https://x">automatically added</a> to the Workflow Catalog. This is done by regularly searching Github repositories for matching workflow structures. The catalog includes workflows based on the following criteria.</p>' +
    '<p>The repository is small enough to be cloned into a <a href="https://y">Github Actions</a> job (very large files should be handled via <a href="https://z">Git LFS</a>, so that they can be stripped out during cloning).</p>' +
    '<li><p>The repository has a <code>README.md</code> file, containing the words “snakemake” and “workflow” (case insensitive).</p></li>' +
    '<li><p>The repository contains a workflow definition named either <code>Snakefile</code> or <code>workflow/Snakefile</code>.</p></li>' +
    '<li><p>The repository is not blacklisted here.</p></li>' +
    '<h3>Workflow pages</h3>' +
    '<li><p><strong>Tube Maps</strong>: A graphical representation of the workflow rulegraph, built using <a href="https://s">snakevision</a>. Tube maps will automatically show up on your workflow page if the following command can be run for your workflow: <code>snakemake -s &lt;snakefile&gt; --rulegraph</code>. This means, you need to have a working test case defined in the <code>.test</code> sub-dir.</p></li>' +
    "</div>";
  const doc = run(html, "https://snakemake.github.io/snakemake-workflow-catalog/docs/about/adding_workflows.html");
  const ps = [...doc.querySelectorAll("p")].map(text);
  assert.match(ps[0], /^工作流会被自动加入到工作流目录/);
  assert.match(ps[1], /^仓库足够小，可以克隆进 Github Actions 任务中/);
  assert.equal(ps[2], "仓库有一个 README.md 文件，其中包含单词 “snakemake” 与 “workflow”（不区分大小写）。");
  assert.equal(ps[3], "仓库包含名为 Snakefile 或 workflow/Snakefile 的工作流定义。");
  assert.equal(ps[4], "该仓库不在黑名单中。");
  assert.equal(text(doc.querySelector("h3")), "工作流页面");
  assert.match(ps[5], /^管线图：工作流规则图的可视化表示，由 snakevision 生成。/);
  assert.match(ps[5], /snakemake -s <snakefile> --rulegraph/, "命令行必须原样保留");
  assert.equal(doc.querySelectorAll("p")[5].querySelectorAll("code").length, 2, "代码槽位（规则图命令与 .test）必须保留");
});

test("词库结构：无自映射、译文含汉字、规则锚定且有捕获组引用", () => {
  assert.ok(Object.keys(book.exact).length >= 150);
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
    const a = patSlots.slice().sort((x, y) => x - y), b = zhSlots.slice().sort((x, y) => x - y);
    assert.deepEqual(a, b, "占位符数量必须一致：" + t.pat.slice(0, 40));
    for (let i = 0; i < b.length; i++) assert.equal(b[i], i + 1, "占位符必须 1..N 连续：" + t.pat.slice(0, 40));
  }
});

test("跨册口径：Default/Topic 与三条规则锁（防止与其它册撞值）", () => {
  assert.equal(book.exact.Default, "默认", "Default 必须与 alphafold/interpro/ucsc 一致");
  assert.equal(book.exact.Topic, "主题", "Topic 与 clinicaltrials/geneontology 一致");
  assert.equal(book.exact.Topics, undefined, "Topics 已被 nfcore/ucsc-extra 占为「目录」，不能直接建键");
  assert.equal(book.exact.old, undefined, "old 已被 gxa 占为「老年」，不能直接建键");
  assert.equal(book.exact.Snakefile, undefined, "Snakefile 是文件名，不能建自映射键");
  const rule = (re) => book.rules.find((r) => r.re === re);
  assert.equal(rule("^Topics$") && rule("^Topics$").to, "主题");
  assert.equal(rule("^old$") && rule("^old$").to, "旧论文");
  assert.equal(rule("^profiles$") && rule("^profiles$").to, "配置档案");
  const doc = run("<div><p>Topics</p><p>profiles</p></div>");
  assert.deepEqual([...doc.querySelectorAll("p")].map(text), ["主题", "配置档案"]);
});

test("残留口径抽样：基因/包名/命令行/版本号保持英文", () => {
  const html = '<div><p>snakemake</p><p>Snakemake</p><p>FAIROS-HEP research network</p>' +
    '<p>snakemake-executor-plugin-slurm</p><p>--jobs 100</p><p>v3.1.2</p>' +
    '<p>bio/star/align</p><p>slurm</p></div>';
  const doc = run(html);
  assert.deepEqual([...doc.querySelectorAll("p")].map(text),
    ["snakemake", "Snakemake", "FAIROS-HEP 研究网络", "snakemake-executor-plugin-slurm",
      "--jobs 100", "v3.1.2", "bio/star/align", "slurm"]);
});