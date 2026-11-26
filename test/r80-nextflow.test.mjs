// Nextflow 官网（nextflow.io）与文档站（docs.nextflow.io）词库回归：
// 首页、文档首页导航与正文、安装页、博客列表界面。
// 站点 id "nextflow"，词库 common/spa/nextflow。
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
const site = sites.find((s) => s.id === "nextflow");
if (!site) throw new Error("config/sites.json 里找不到 nextflow 站点");

const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/nextflow.json"), "utf8"));
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
  const dom = new JSDOM(html, { url: url || "https://www.nextflow.io/" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return dom.window.document;
}
const text = (el) => el.textContent.replace(/\s+/g, " ").trim();

test("站点配置：hosts/dicts 指向 nextflow.io 与文档站", () => {
  // www.nextflow.io/docs/* 与 docs.nextflow.io/* 都 302 到 docs.seqera.io/nextflow/…，
  // 真实环境里文档站只有后半段域名能命中站点配置，hosts 必须带 docs.seqera.io。
  assert.deepEqual(site.hosts, ["nextflow.io", "www.nextflow.io", "docs.nextflow.io", "docs.seqera.io"]);
  assert.ok(site.dicts.includes("common") && site.dicts.includes("spa") && site.dicts.includes("nextflow"));
  assert.equal(site.scope, "body");
  assert.equal(book.meta.sites[0], "nextflow.io");
  assert.equal(book.meta.family, "nextflow");
});

test("首页横幅与顶部导航：栏目翻中文，产品名保留", () => {
  const html = '<div><p>Nextflow.io is not changing. Our new product, Nextflow Frontier, is live, built on Nextflow by the team who created it.</p>' +
    "<a>Learn more</a>" +
    "<nav><a>Documentation</a><a>Training</a><a>Forums</a><a>Examples</a><a>Tools</a><a>Resources</a>" +
    "<a>Blog</a><a>Podcast</a><a>Community forum</a><a>Slack community chat</a><a>nf-core pipelines</a>" +
    "<a>About Nextflow</a><a>Nextflow Ambassadors</a><a>GitHub repository</a><a>Seqera AI</a></nav>" +
    "<ul><li>Basic pipeline</li><li>Mixing scripting languages</li><li>BLAST pipeline</li><li>RNA-Seq pipeline</li>" +
    "<li>Machine Learning pipeline</li><li>Implementation patterns</li></ul></div>";
  const doc = run(html);
  assert.equal(text(doc.querySelector("p")), "Nextflow.io 不会改变。我们的新产品 Nextflow Frontier 已经上线，由创造 Nextflow 的团队基于 Nextflow 打造。");
  assert.equal(text(doc.querySelector("a")), "了解更多");
  assert.deepEqual([...doc.querySelectorAll("nav a")].map(text), ["文档", "培训", "论坛", "示例", "工具", "资源",
    "博客", "播客", "社区论坛", "Slack 社区聊天", "nf-core 流程", "关于 Nextflow", "Nextflow 大使",
    "GitHub 仓库", "Seqera AI"]);
  assert.deepEqual([...doc.querySelectorAll("li")].map(text),
    ["基础流程", "混合脚本语言", "BLAST 流程", "RNA-Seq 流程", "机器学习流程", "实现模式"]);
});

test("首页 hero 与功能卡：整句直译", () => {
  const html = '<main><h1>Reproducible Scientific Workflows at Scale</h1>' +
    "<p>Nextflow enables scalable, reproducible, and portable scientific workflows for research and production use cases.</p>" +
    "<p>Open-source software supported by</p>" +
    "<h2>Nextflow supercharges science with reproducible containers, streamlined Git collaboration, and frictionless cloud and HPC for scale</h2>" +
    "<h3>Fast prototyping</h3>" +
    "<p>Nextflow allows you to write a computational pipeline by making it simpler to put together many different tasks. You may reuse your existing scripts and tools and you don't need to learn a new language or API to start using it.</p>" +
    "<h3>Reproducibility</h3><h3>Continuous checkpoints</h3>" +
    "<p>All the intermediate results produced during the pipeline execution are automatically tracked.</p>" +
    "<p>This allows you to resume its execution, from the last successfully executed step, no matter what the reason was for it stopping.</p>" +
    "<h3>Portable</h3>" +
    "<p>Nextflow provides an abstraction layer between your pipeline's logic and the execution layer, so that it can be executed on multiple platforms without it changing.</p>" +
    "<h3>Stream oriented</h3>" +
    "<p>Nextflow extends the Unix pipes model with a fluent DSL, allowing you to handle complex stream interactions easily. It promotes a programming approach, based on functional composition, that results in resilient and easily reproducible pipelines.</p>" +
    "<h3>Unified parallelism</h3>" +
    "<p>Nextflow is based on the dataflow programming model which greatly simplifies writing complex distributed pipelines.</p></main>";
  const doc = run(html);
  assert.equal(text(doc.querySelector("h1")), "可扩展的可重复科学工作流");
  const ps = [...doc.querySelectorAll("p")].map(text);
  assert.equal(ps[0], "Nextflow 为科研与生产场景提供可扩展、可重复、可移植的科学工作流。");
  assert.equal(ps[1], "开源软件支持方：");
  assert.match(text(doc.querySelector("h2")), /^Nextflow 以可重复的容器、顺畅的 Git 协作和无摩擦的云端与 HPC 扩展能力/);
  assert.deepEqual([...doc.querySelectorAll("h3")].map(text),
    ["快速原型开发", "可重复性", "持续检查点", "可移植", "面向流", "统一并行"]);
  assert.match(ps[2], /^Nextflow 让你可以编写计算流程/);
  assert.equal(ps[3], "流程执行期间产生的所有中间结果都会被自动跟踪。");
  assert.equal(ps[4], "无论因何停止，都可以从最后一次成功执行的步骤继续运行。");
  assert.match(ps[5], /^Nextflow 在流程逻辑与执行层之间提供抽象层/);
  assert.match(ps[6], /^Nextflow 以流畅的 DSL 扩展 Unix 管道模型/);
  assert.equal(ps[7], "Nextflow 基于数据流编程模型，极大简化了复杂分布式流程的编写。");
});

test("首页带链接整句走模板：链接保留，槽位译文完整", () => {
  const html = '<div><p>Nextflow supports <a href="#">Docker</a> and <a href="#">Singularity</a> containers technology.</p>' +
    '<p>This, along with the integration of the <a href="#">GitHub</a> code sharing platform, allows you to write self-contained pipelines, manage versions and to rapidly reproduce any former configuration.</p>' +
    '<p>It provides out of the box executors for GridEngine, SLURM, LSF, PBS, Moab and HTCondor batch schedulers and for <a href="#">Kubernetes</a>, <a href="#">Amazon AWS</a>, <a href="#">Google Cloud</a> and <a href="#">Microsoft Azure</a> platforms.</p></div>';
  const doc = run(html);
  const ps = [...doc.querySelectorAll("p")];
  assert.equal(text(ps[0]), "Nextflow 支持 Docker 与 Singularity 容器技术。");
  assert.equal(ps[0].querySelectorAll("a").length, 2);
  assert.equal(text(ps[1]), "结合 GitHub 代码共享平台的集成，你可以编写自包含的流程、管理版本，并快速复现任何此前的配置。");
  assert.equal(text(ps[2]), "它开箱即用地提供 GridEngine、SLURM、LSF、PBS、Moab 与 HTCondor 批处理调度器的执行器，以及 Kubernetes、Amazon AWS、Google Cloud 与 Microsoft Azure 平台。");
  assert.equal(ps[2].querySelectorAll("a").length, 4);
});

test("首页后续卡、社区资源与页脚", () => {
  const html = '<div><span>&gt; Next steps</span><h3>Boost your developer experience</h3>' +
    "<h3>Boost Your Workflow with the Nextflow Extension</h3>" +
    "<p>Streamline pipeline development right from your IDE with the official Nextflow extension for Visual Studio Code.</p>" +
    "<a>Install from VS Code Marketplace</a><h3>Got Questions? Ask AI.</h3>" +
    "<p>Explore Seqera's AI-powered assistant to get instant answers about Nextflow, nf-core, and more — right from the source.</p>" +
    "<a>Ask Seqera AI</a><a>Check out the documentation</a>" +
    "<p>The Nextflow reference manual is available at the above link.</p><a>Get Started</a>" +
    "<a>Look at the examples</a><p>See example code to get a feel for how Nextflow pipelines work.</p>" +
    "<a>Follow the training</a><p>Check out the Nextflow training portal for video and written exercies to get started with Nextflow.</p>" +
    "<h3>Confused? Ask the community</h3><p>Get help on the Seqera Community Forum.</p>" +
    "<h3>Report bugs or request features</h3><p>Bug reports help Nextflow improve, so please report any issue you may have!</p>" +
    "<h3>Find pipelines</h3><p>Browse open-source pipelines that you can use today, developed by the Nextflow community.</p>" +
    "<a>Training portal</a><a>Community Forum</a>" +
    "<p>© 2026 Seqera. All Rights Reserved.</p></div>";
  const doc = run(html);
  const hs = [...doc.querySelectorAll("h3")].map(text);
  assert.deepEqual(hs, ["提升开发者体验", "用 Nextflow 扩展提升你的工作流", "有疑问？问 AI。",
    "有困惑？问问社区", "报告缺陷或请求新功能", "查找流程"]);
  const links = [...doc.querySelectorAll("a")].map(text);
  assert.deepEqual(links, ["从 VS Code 市场安装", "询问 Seqera AI", "查看文档", "开始使用",
    "查看示例", "参加培训", "培训门户", "社区论坛"]);
  assert.equal(text(doc.querySelector("span")), "> 后续步骤");
  assert.equal(text([...doc.querySelectorAll("p")].pop()), "© 2026 Seqera。保留所有权利。");
});

test("文档站：顶部导航、侧边栏与面包屑", () => {
  const html = '<div><a>Skip to main content</a><button>Search</button><a>Log In</a><a>Sign Up</a>' +
    "<a>Help</a><a>Forum</a><a>Support Portal</a><a>Nextflow Slack</a>" +
    "<h3>Company</h3><a>Contact us</a><a>Submit Feedback</a>" +
    "<a>Cloud</a><a>Enterprise</a><a>Platform API</a><a>Changelog</a>" +
    "<nav><a>Getting started</a><a>Overview</a><a>Installation</a><a>Environment setup</a>" +
    "<a>Your first script</a><a>Running pipelines</a><a>Developing pipelines</a><a>Modules</a>" +
    "<a>Software dependencies</a><a>Storage</a><a>Plugins</a><a>Language reference</a>" +
    "<a>Runtime reference</a><a>Updates</a><a>Contributing</a><a>Tutorials</a><a>Guides</a></nav>" +
    "<a>Home</a><button>On this page</button></div>";
  const doc = run(html);
  const links = [...doc.querySelectorAll("a")].map(text);
  assert.deepEqual(links.slice(0, 4), ["跳到主要内容", "登录", "注册", "帮助"]);
  assert.ok(links.includes("支持门户"));
  assert.ok(links.includes("联系我们"));
  assert.ok(links.includes("提交反馈"));
  assert.deepEqual(links.filter((x) => ["云平台", "企业版", "平台 API", "更新日志"].includes(x)).length, 4);
  const nav = [...doc.querySelectorAll("nav a")].map(text);
  assert.deepEqual(nav, ["入门指南", "概览", "安装", "环境配置", "第一个脚本", "运行流程", "开发流程", "模块",
    "软件依赖", "存储", "插件", "语言参考", "运行时参考", "更新", "贡献", "教程", "指南"]);
  assert.equal(text(doc.querySelector("h3")), "公司");
  assert.equal(text(doc.querySelectorAll("button")[1]), "本页内容");
  assert.equal(text(doc.querySelectorAll("a")[links.length - 1]), "首页");
});

test("文档首页正文：长段落模板保留 -resume 代码", () => {
  const html = "<main><article><p>Many scientific and data-intensive analyses are a chain of command-line tools that pass data to each other as files, rather than through databases or APIs. These pipelines run over thousands of inputs, each step can take hours, and each tool needs specific software versions. Running that reliably means moving files to where the work runs, splitting the work into parallel jobs, submitting them to a cluster or cloud, retrying failures, and keeping track of what has already finished. Nextflow handles this for you. You write each step in any language, and Nextflow stages each task's input files into its own working directory, whether they are stored locally or in cloud object storage. It runs every file through the pipeline in parallel, can give each task its own container, and runs the same pipeline on a laptop, an HPC cluster, or the cloud with only a configuration change. There is no server to deploy, and if a run fails, <code>-resume</code> picks up where it stopped.</p>" +
    "<p>Nextflow is a workflow system for creating scalable, portable, and reproducible workflows. Its dataflow programming model lets you describe how data moves between steps, and Nextflow works out what can run in parallel. As well as containers, it supports package managers such as Conda and Spack for managing software.</p>" +
    "<h2>Get started</h2><p>To get started with Nextflow:</p></article></main>";
  const doc = run(html);
  const ps = [...doc.querySelectorAll("p")];
  assert.match(text(ps[0]), /^许多科学与数据密集型分析都是由命令行工具串联而成/);
  assert.match(text(ps[0]), /如果运行失败，-resume 会从上次中断处继续。$/);
  assert.equal(ps[0].querySelector("code").textContent, "-resume");
  assert.match(text(ps[1]), /^Nextflow 是一个用于创建可扩展、可移植、可重复工作流的工作流系统。/);
  assert.match(text(ps[1]), /Conda 与 Spack 等包管理器/);
  assert.equal(text(doc.querySelector("h2")), "开始使用");
  assert.equal(text(ps[2]), "要开始使用 Nextflow：");
});

test("文档首页列表模板：链接原位保留，链接文字一并翻译", () => {
  const html = "<ul>" +
    '<li>See the Nextflow <a href="/overview">overview</a> to learn key concepts</li>' +
    '<li>Download and <a href="/install">install</a> Nextflow</li>' +
    '<li>Set up an <a href="/env">environment</a> with the <a href="/env#vscode">Nextflow VS Code extension</a></li>' +
    '<li>Run <a href="/first">your first script</a></li></ul>';
  const doc = run(html);
  const lis = [...doc.querySelectorAll("li")];
  assert.equal(text(lis[0]), "参见 Nextflow 概览，了解关键概念");
  assert.equal(lis[0].querySelector("a").getAttribute("href"), "/overview");
  assert.equal(text(lis[1]), "下载并安装 Nextflow");
  assert.equal(text(lis[2]), "用 Nextflow VS Code 扩展搭建环境");
  assert.equal(lis[2].querySelectorAll("a").length, 2);
  assert.equal(text(lis[3]), "运行第一个脚本");
});

test("文档首页社区/贡献/许可模板与引用保留", () => {
  const html = '<div><p>To continue learning about Nextflow, visit the <a href="https://training.nextflow.io">Nextflow community training portal</a> and find a training course that is right for you. Seqera, the company that develops Nextflow, also runs a variety of training events. See <a href="https://seqera.io/events/">Seqera Events</a> for more information.</p>' +
    '<p>You can post questions in the <a href="#">Nextflow community forum</a> or the <a href="#">Nextflow Slack</a>. Bugs and feature requests should be reported as <a href="#">GitHub issues</a>.</p>' +
    '<p>The <a href="#">nf-core</a> project is a community effort aggregating high-quality Nextflow workflows that can be used by everyone.</p>' +
    '<p>Contributions to Nextflow are welcome. See <a href="#">Contributing</a> for details.</p>' +
    '<p>Nextflow is released under the Apache 2.0 license. Nextflow is a <a href="#">registered trademark</a>.</p>' +
    '<p>If you use Nextflow in your work, please cite:</p>' +
    "<ul><li>P. Di Tommaso, et al. Nextflow enables reproducible computational workflows. Nature Biotechnology 35, 316–319 (2017) doi:10.1038/nbt.3820</li></ul></div>";
  const doc = run(html);
  const ps = [...doc.querySelectorAll("p")];
  assert.equal(text(ps[0]), "要继续学习 Nextflow，请访问 Nextflow 社区培训门户，找到适合你的培训课程。开发 Nextflow 的公司 Seqera 也会举办各种培训活动。更多信息请参见 Seqera 活动。");
  assert.equal(text(ps[1]), "你可以在 Nextflow 社区论坛或 Nextflow Slack 中提问。缺陷与功能请求应通过 GitHub 议题报告。");
  assert.equal(text(ps[2]), "nf-core 项目是一项社区努力，汇聚了人人可用的高质量 Nextflow 工作流。");
  assert.equal(text(ps[3]), "欢迎为 Nextflow 贡献。详情请参见贡献。");
  assert.equal(text(ps[4]), "Nextflow 采用 Apache 2.0 许可证发布。Nextflow 是注册商标。");
  assert.equal(text(ps[5]), "如果你在工作中使用 Nextflow，请引用：");
  assert.equal(text(doc.querySelector("li")), "P. Di Tommaso, et al. Nextflow enables reproducible computational workflows. Nature Biotechnology 35, 316–319 (2017) doi:10.1038/nbt.3820");
});

test("安装页：标题、步骤说明、告警与版本标记", () => {
  const html = "<html><head><title>Installation | Seqera Docs</title></head><body><article>" +
    "<h1>Installation</h1>" +
    "<h2>Requirements</h2>" +
    "<p>To install Java with SDKMAN:</p><p>Open a new terminal.</p>" +
    "<div>warning</div>" +
    "<p>Nextflow updates its executable during the self-install process. An update can fail if the executable is placed in a directory with restricted permissions.</p>" +
    "<h3>Install without Java</h3><div>Added in version 27.04</div>" +
    "<h3>Standalone distribution (legacy)</h3><div>Deprecated in version 27.04</div></article></body></html>";
  const doc = run(html);
  assert.equal(doc.title, "安装 | Seqera 文档");
  assert.equal(text(doc.querySelector("h1")), "安装");
  assert.equal(text(doc.querySelector("h2")), "要求");
  assert.equal(text(doc.querySelector("p")), "使用 SDKMAN 安装 Java：");
  assert.equal(text(doc.querySelectorAll("div")[0]), "警告");
  assert.match(text(doc.querySelectorAll("p")[2]), /^Nextflow 在自安装过程中会更新其可执行文件。/);
  assert.equal(text(doc.querySelector("h3")), "无需 Java 的安装");
  assert.deepEqual([...doc.querySelectorAll("div")].slice(1).map(text), ["新增于 27.04 版本", "已于 27.04 版本弃用"]);
});

test("安装页 8 槽模板：内联 code 全部原位保留", () => {
  const html = '<article><p>Ensure the directory <code>$HOME/.local/bin/</code> is included in your <code>PATH</code> variable. Add the directory to <code>PATH</code> by adding <code>export PATH="$PATH:$HOME/.local/bin"</code> to your shell configuration file, such as <code>~/.bashrc</code> or <code>~/.zshrc</code>. Alternatively, move the <code>nextflow</code> executable to a directory already in your <code>PATH</code>.</p>' +
    '<p>Nextflow can be used on any POSIX-compatible system (Linux, macOS, etc), and on Windows through <a href="#">WSL</a>. This page describes how to install Nextflow.</p>' +
    '<p>New versions of Nextflow are released regularly. See <a href="#">Updating Nextflow</a> for more information about Nextflow release cadence, how to update Nextflow, and how select your version of Nextflow.</p></article>';
  const doc = run(html);
  const ps = [...doc.querySelectorAll("p")];
  assert.equal(text(ps[0]), '确保目录 $HOME/.local/bin/ 已包含在 PATH 变量中。把 export PATH="$PATH:$HOME/.local/bin" 加入 shell 配置文件（例如 ~/.bashrc 或 ~/.zshrc），即可将该目录加入 PATH。或者，把 nextflow 可执行文件移到已在 PATH 中的目录。');
  assert.equal(ps[0].querySelectorAll("code").length, 8);
  assert.equal(text(ps[1]), "Nextflow 可用于任何兼容 POSIX 的系统（Linux、macOS 等）；在 Windows 上可通过 WSL 使用。本页介绍如何安装 Nextflow。");
  assert.equal(text(ps[2]), "Nextflow 新版本会定期发布。有关 Nextflow 发布节奏、如何更新 Nextflow 以及如何选择 Nextflow 版本的更多信息，请参见更新 Nextflow。");
});

test("博客列表：标题与筛选按钮、页脚解决方案翻中文，文章题录保留", () => {
  const html = '<html><head><title>Nextflow | Seqera</title></head><body><section><h1>The Seqera Blog</h1>' +
    "<button>Platform</button><button>Open Source</button><button>Resources</button><button>Solutions</button><button>Company</button>" +
    "<button>View All</button><button>Community</button>" +
    "<h2>Introducing Nextflow Frontier</h2>" +
    "<p>Nextflow Frontier is a recursive closed-loop discovery system for the unsolved problems in life sciences.</p>" +
    "<span>Evan Floden</span><span>Oct 13, 2026</span>" +
    "<h5>Solutions</h5><a>Image Processing</a><a>Protein Analysis</a><a>Drug Discovery</a>" +
    "<a>Biopharma</a><a>Clinical Diagnostics</a><a>Public Research</a><a>Agriculture</a>" +
    "<h5>Social Media</h5><a>Bluesky</a><a>Twitter / X</a><a>GitHub</a>" +
    "<p>Seqera. All Rights Reserved.</p></section></body></html>";
  const doc = run(html);
  assert.equal(doc.title, "Nextflow | Seqera");
  assert.equal(text(doc.querySelector("h1")), "Seqera 博客");
  const btns = [...doc.querySelectorAll("button")].map(text);
  assert.deepEqual(btns, ["平台", "开源", "资源", "解决方案", "公司", "查看全部", "社区"]);
  assert.equal(text(doc.querySelector("h2")), "Introducing Nextflow Frontier");
  assert.match(text(doc.querySelector("p")), /^Nextflow Frontier is a recursive/);
  assert.equal(text(doc.querySelector("span")), "Evan Floden");
  const links = [...doc.querySelectorAll("a")].map(text);
  assert.deepEqual(links.slice(0, 7), ["图像处理", "蛋白质分析", "药物发现", "生物制药", "临床诊断", "公共研究", "农业"]);
  assert.deepEqual(links.slice(-3), ["Bluesky", "Twitter / X", "GitHub"]);
  assert.equal(text(doc.querySelectorAll("h5")[0]), "解决方案");
  assert.equal(text(doc.querySelectorAll("h5")[1]), "社交媒体");
  assert.equal(text(doc.querySelectorAll("p")[1]), "Seqera。保留所有权利。");
});

test("通用规则：时间、版本标记、版权与直达链接", () => {
  const html = "<div><span>Updated 11 months ago</span><span>Updated 2 years ago</span>" +
    "<span>Updated 3 days ago</span><span>Direct link to Requirements</span>" +
    "<span>Direct link to Install without Java</span>" +
    "<p>Copyright © 2026 Seqera. All rights reserved.</p></div>";
  const doc = run(html);
  const spans = [...doc.querySelectorAll("span")].map(text);
  assert.deepEqual(spans, ["11 个月前更新", "2 年前更新", "3 天前更新", "要求的直达链接", "无需 Java 的安装的直达链接"]);
  assert.equal(text(doc.querySelector("p")), "版权所有 © 2026 Seqera。保留所有权利。");
});

test("残留抽样：代码块、命令行、参数、算子与专名保持原样", () => {
  const html = "<div><pre><code>nextflow run nf-core/rnaseq -profile docker</code></pre>" +
    "<code>-resume</code><code>-with-docker</code><code>map</code><code>collect</code>" +
    "<p>nf-core/rnaseq</p><p>BCFtools</p><p>samtools</p><p>pipeline</p><p>workflow</p>" +
    "<p>linux/amd64</p><p>198 KB</p><p>120k downloads</p></div>";
  const doc = run(html);
  assert.equal(text(doc.querySelector("pre code")), "nextflow run nf-core/rnaseq -profile docker");
  assert.deepEqual([...doc.querySelectorAll("code")].slice(1).map(text), ["-resume", "-with-docker", "map", "collect"]);
  assert.deepEqual([...doc.querySelectorAll("p")].map(text),
    ["nf-core/rnaseq", "BCFtools", "samtools", "pipeline", "workflow", "linux/amd64", "198 KB", "120k downloads"]);
});

test("首页终端示例组件：前置条件、步骤标签与安装说明模板", () => {
  const html = '<div class="terminal-wrapper"><h2>Check prerequisites</h2><p>Java 17 or later is required</p>' +
    "<p>Make sure Java 17 or later is installed on your computer by using the command:</p>" +
    '<p>If you have trouble installing or upgrading Java, see our <a href="#requirements">Requirements</a> for more information.</p>' +
    "<div>Step 1</div><div>Step 2</div><div>Step 3</div>" +
    "<h2>Set up</h2><p>Dead easy to install</p><p>Enter this command in your terminal:</p>" +
    '<p>Nextflow can also be installed from <a href="#">Bioconda</a> or downloaded from <a href="#">GitHub</a>. See <a href="#">Installation</a> for more information.</p>' +
    "<h2>Launch</h2><p>Try a simple demo</p>" +
    "<p>Run the classic Hello world by entering the following command:</p>" +
    '<p>Make the binary executable and move it to a directory in your PATH. See <a href="#">Installation</a> for more information.</p></div>';
  const doc = run(html);
  const hs = [...doc.querySelectorAll("h2")].map(text);
  assert.deepEqual(hs, ["检查前置条件", "安装配置", "运行"]);
  const ps = [...doc.querySelectorAll("p")].map(text);
  assert.equal(ps[0], "需要 Java 17 或更高版本");
  assert.equal(ps[1], "请先确认电脑上已安装 Java 17 或更高版本，可使用以下命令：");
  assert.equal(ps[2], "如果安装或升级 Java 遇到问题，请参阅要求以了解更多信息。");
  assert.deepEqual([...doc.querySelectorAll("div")].filter((d) => /^第 \d 步$/.test(text(d))).map(text), ["第 1 步", "第 2 步", "第 3 步"]);
  assert.equal(ps[3], "安装极其简单");
  assert.equal(ps[4], "在终端中输入以下命令：");
  assert.equal(ps[5], "Nextflow 也可以从 Bioconda 安装，或从 GitHub 下载。更多信息请参见安装。");
  assert.equal(ps[6], "试试简单示例");
  assert.equal(ps[7], "输入以下命令，运行经典的 Hello world：");
  assert.equal(ps[8], "让该二进制文件可执行，并把它移到 PATH 中的某个目录。更多信息请参见安装。");
});

test("词库结构：无自映射、译文含汉字、规则锚定且捕获组有引用", () => {
  assert.ok(Object.keys(book.exact).length >= 190);
  assert.ok(book.rules.length >= 12);
  assert.ok(book.templates.length >= 25);
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
    if (t.pat.length >= 20) assert.ok(t.pat.length <= 2200, "模板 pat 超长");
    const patSlots = (t.pat.match(/\{\{(\d+)\}\}/g) || []).map((x) => Number(x.replace(/[{}]/g, "")));
    const zhSlots = (t.zh.match(/\{\{(\d+)\}\}/g) || []).map((x) => Number(x.replace(/[{}]/g, "")));
    assert.ok(patSlots.length > 0, "模板 pat 至少一个槽位");
    assert.deepEqual(patSlots.slice().sort((a, b) => a - b), zhSlots.slice().sort((a, b) => a - b),
      "占位符数量必须一致：" + t.pat.slice(0, 40));
    for (let i = 0; i < zhSlots.length; i++) assert.equal(zhSlots.slice().sort((a, b) => a - b)[i], i + 1);
  }
});
