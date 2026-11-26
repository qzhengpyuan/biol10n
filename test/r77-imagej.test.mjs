// ImageJ / Fiji Wiki（imagej.net）词库回归：首页与导航框架、Fiji/ImageJ2 介绍页、Downloads 页、Learn 介绍页、Plugins 页。
// 站点是 Jekyll 文档站：左侧 #left-column 是整站导航树（移动端复制同一棵树），#toc 是页内目录，
// #right-column 是 Vital statistics 表与角色 tooltip；正文长段按口径整段留英文，只吃导航/表头/提示框/固定说明句。
// 带链接的整段必须走模板通道：链接节点、href、可点击性都要原样保留（模板把所有槽位按 {{n}} 放回）。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/imagej.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "imagej");
assert.ok(site, "config/sites.json 必须有 id=imagej 的站点条目");

function loadStack() {
  const exact = {}, rules = [], templates = [];
  for (const id of site.dicts) {
    const b = JSON.parse(fs.readFileSync(path.join(root, "../dict", id + ".json"), "utf8"));
    Object.assign(exact, b.exact || {});
    rules.push(...(b.rules || []));
    templates.push(...(b.templates || []));
  }
  return { exact, rules, templates };
}

function boot(html) {
  const dom = new JSDOM("<!doctype html><html><body>" + html + "</body></html>", { url: "https://imagej.net/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: loadStack(),
    site: { ...site, rescan: false }
  });
  engine.start();
  return { doc: dom.window.document, engine };
}

const squash = (s) => String(s).replace(/\s+/g, " ").trim();
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;

// 站点框架：顶栏（搜索框 + 主题切换）、page-info、左侧导航、Vital statistics、页内目录、页脚。
const FRAME = [
  '<header class="top-bar"><form class="search" role="search">',
  '<input type="search" aria-label="Search" placeholder="Search ImageJ.net"/>',
  '<button type="submit" title="Search">Submit</button>',
  '<button type="reset" title="Clear search">Clear</button></form>',
  '<button class="theme-toggle" title="Toggle light/dark mode" aria-label="Toggle light/dark mode"></button></header>',
  '<nav class="page-info"><a href="/mediawiki/index.php?title=Software/Fiji&amp;action=history">Page history</a>',
  '<a href="/mediawiki/index.php?title=Software/Fiji&amp;action=edit">Edit this page</a>',
  '<a href="/help#how-do-i-edit-this-website">How do I edit this website?</a></nav>',
  '<aside id="left-column"><h3>ImageJ Docs</h3><details open><summary>Software</summary><ul>',
  '<li><a href="/software/imagej2">ImageJ2</a></li><li><a href="/software/fiji">Fiji</a></li>',
  '<li><a href="/downloads">Downloads</a></li></ul></details>',
  '<details><summary>Learn</summary><ul><li><a href="/learn">Learn</a></li><li><a href="/plugins">Plugins</a></li></ul></details></aside>',
  '<aside id="right-column"><table class="vital-statistics"><tbody>',
  '<tr><th>Source</th><td>GitHub</td></tr><tr><th>License</th><td>Public domain</td></tr>',
  '<tr><th>Release</th><td>2.16.0</td></tr><tr><th>Date</th><td>Thu, 24 Oct 2024</td></tr>',
  '<tr><th>Development status</th><td>Active</td></tr><tr><th>Support status</th><td>Active</td></tr>',
  '<tr><th>Discussion</th><td>Image.sc Forum</td></tr></tbody></table>',
  '<div class="role"><span class="tooltip">Team<span class="tooltiptext">The people who make ImageJ work.</span></span></div></aside>',
  '<nav id="toc"><h2>Page contents</h2></nav>',
  '<footer><a href="https://forum.image.sc/tag/imagej">Forum</a><a href="https://github.com/imagej">GitHub</a>',
  '<a href="/accessibility">Accessibility</a><span>Design: HTML5 UP</span></footer>'
].join("\n");

test("词库结构与站点栈：条数、键值形态、规则可编译、模板槽位连续", () => {
  assert.equal(book.meta.family, "imagej");
  assert.deepEqual(book.meta.sites, ["imagej.net", "www.imagej.net"]);
  assert.deepEqual(site.dicts, ["common", "imagej"]);
  assert.deepEqual(site.hosts, ["imagej.net", "www.imagej.net"]);
  assert.ok(Object.keys(book.exact).length >= 300, "exact 至少 300 条，实际 " + Object.keys(book.exact).length);
  assert.ok(book.templates.length >= 75, "模板至少 75 条，实际 " + book.templates.length);
  // 日期由 common 的通用日期规则兜住，本册只允许「单标签别名」规则：
  // 与其它册同键异义、又不能进 exact 的界面词（Contribute / Process）走 ^词$ 形式，
  // 这样不会影响其它站点的译文，也不增加跨册 exact 冲突。
  const labelRules = (book.rules || []).filter((r) => /^\^[^$(){}\[\]?*+|]+\$$/.test(r.re));
  assert.equal(
    (book.rules || []).length,
    labelRules.length,
    "本册只允许单标签别名规则，不允许日期/捕获组类规则"
  );
  const seen = new Set();
  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(!CJK.test(k), "键里不能有中文: " + k);
    assert.ok(CJK.test(v), "译文里必须有中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "键首尾不能有空白: " + JSON.stringify(k));
    assert.equal(v, String(v).trim(), "译文首尾不能有空白: " + JSON.stringify(k));
    assert.ok(!/https?:\/\/|@[a-z0-9.-]+\.[a-z]{2,}/i.test(v), "译文不能含网址/邮箱: " + k);
    assert.ok(!seen.has(k), "重复键: " + k);
    seen.add(k);
  }
  for (const r of book.rules) {
    assert.ok(r.re.startsWith("^") && r.re.endsWith("$"), "规则必须首尾锚定: " + r.re);
    assert.doesNotThrow(() => new RegExp(r.re), "规则正则必须能编译: " + r.re);
    assert.ok(CJK.test(r.to), "规则译文里必须有中文: " + r.re);
    // 单标签别名规则（^Contribute$）没有捕获组，也不该出现占位符；
    // 其余带捕获组的规则必须把每个捕获组都用上。
    if (/\$\d/.test(r.to)) continue;
    assert.ok(!/\([^)]*\)/.test(r.re), "规则有捕获组却没用到占位符: " + r.re);
  }
  const pats = new Set();
  for (const t of book.templates) {
    assert.ok(!CJK.test(t.pat), "模板 pat 不能含汉字: " + t.pat);
    assert.ok(CJK.test(t.zh), "模板译文必须含中文: " + t.pat);
    assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, "模板 pat 长度越界: " + t.pat);
    assert.ok(!pats.has(t.pat), "模板 pat 重复: " + t.pat);
    pats.add(t.pat);
    const need = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
    const got = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
    assert.deepEqual(need, need.map((_, i) => i + 1), "pat 槽位必须 1..N: " + t.pat);
    assert.deepEqual(got, need, "zh 槽位必须与 pat 一致: " + t.pat);
  }
});

test("exact 通道：全量命中，且不改动插件名 / 版本号 / URL", () => {
  const { engine } = boot("");
  for (const [en, zh] of Object.entries(book.exact)) {
    assert.equal(engine.translateText(en), zh, "未命中: " + en);
  }
  for (const keep of ["BoneJ", "TrackMate", "2.16.0", "https://ij.imjoy.io", "ImgLib2", "SCIFIO"]) {
    const out = engine.translateText(keep);
    assert.ok(out === null || out === keep, "不该翻的保持英文: " + keep + " -> " + out);
  }
});

test("左侧导航长树：顶层与二级标签全覆盖，箭头符号随文字保留", () => {
  const { engine } = boot("");
  const want = {
    "Contribute": "参与贡献",
    "IDEs": "集成开发环境",
    "Users ▼": "用户 ▼",
    "▲ Community ▲": "▲ 社区 ▲",
    "▼ Developers": "▼ 开发者",
    "Public domain": "公有领域",
    "Raspberry Pi": "树莓派",
    "Changing Location of Plugins Directory": "更改插件目录位置",
    "Why Open Source?": "为什么选择开源？",
    "Voxelization": "体素化",
    "on a Mac": "在 Mac 上"
  };
  for (const [en, zh] of Object.entries(want)) {
    assert.equal(engine.translateText(en), zh, "导航标签未翻: " + en);
  }
  // 插件名、平台名、许可名保持英文
  for (const keep of ["BoneJ", "ImgLib2", "Maven", "NetBeans", "MIT License", "Zeiss LSM"]) {
    const out = engine.translateText(keep);
    assert.ok(out === null || out === keep, "不该翻的保持英文: " + keep + " -> " + out);
  }
});

test("日期通道：Vital statistics 的发布日交给 common 通用规则，输出中文日期", () => {
  const { engine } = boot("");
  assert.equal(engine.translateText("Thu, 24 Oct 2024"), "2024 年 10 月 24 日（周四）");
  assert.equal(engine.translateText("Tue, 1 Mar 2022"), "2022 年 3 月 1 日（周二）");
});

test("页面框架：顶栏按钮、page-info、左侧导航、Vital statistics 表头与角色 tooltip", () => {
  const { doc, engine } = boot(FRAME);
  const bar = doc.querySelector(".top-bar");
  assert.equal(bar.querySelector("input").getAttribute("aria-label"), "检索");
  assert.equal(squash(bar.querySelector("button[type=submit]").getAttribute("title")), "检索");
  assert.equal(squash(bar.querySelector(".theme-toggle").getAttribute("aria-label")), "切换浅色/深色模式");
  const info = [...doc.querySelectorAll(".page-info a")].map((a) => squash(a.textContent));
  assert.deepEqual(info, ["页面历史", "编辑此页面", "如何编辑本网站？"]);
  const left = doc.querySelector("#left-column");
  assert.equal(squash(left.querySelector("h3").textContent), "ImageJ 文档");
  assert.equal(squash(left.querySelector("summary").textContent), "软件");
  const heads = [...doc.querySelectorAll(".vital-statistics th")].map((th) => squash(th.textContent));
  assert.deepEqual(heads, ["来源", "许可", "版本号", "日期", "开发状态", "支持状态", "讨论"]);
  assert.equal(squash(doc.querySelector("#right-column .tooltip").firstChild.textContent), "团队");
  assert.equal(squash(doc.querySelector("#toc h2").textContent), "页内目录");
  const foot = [...doc.querySelectorAll("footer a")].map((a) => squash(a.textContent));
  assert.deepEqual(foot, ["论坛", "GitHub", "无障碍"]);
  assert.equal(engine.translateText("ImageJ Docs"), "ImageJ 文档");
});

// Fiji 页：首段 + 两行 li（Users / Developers）+ 许可段 + 贡献段，全部带链接。
const FIJI = [
  '<div class="md-content"><p><a href="https://fiji.sc/">Fiji</a> is an image processing package—a “batteries-included” distribution of <a href="/software/imagej2">ImageJ2</a>, bundling a lot of plugins which facilitate scientific image analysis.</p>',
  '<ul><li><strong>For users</strong> - Fiji is <a href="/software/fiji/downloads">easy to install</a> and has an automatic update function, bundles a <a href="/list-of-extensions">lot of plugins</a> and offers comprehensive <a href="/learn">documentation</a>.</li>',
  '<li><strong>For developers</strong> - Fiji is an open source project hosted in a <a href="/develop/git">Git</a> version control <a href="https://github.com/fiji/fiji/">repository</a>, with access to the source code of all internals, libraries and plugins, and eases the <a href="/develop">development</a> and <a href="/scripting">scripting</a> of plugins.</li></ul>',
  '<p>Fiji is released as <a href="/licensing">open source</a> under the <a href="https://www.gnu.org/licenses/gpl.html">GNU General Public License</a>.</p>',
  '<p>Fiji is supported by several laboratories and institutions:</p>',
  '<ul><li>The <a href="/people/fjug">Jug</a> lab at the <a href="/orgs/human-technopole">Human Technopole</a>.</li>',
  '<li>The <a href="/people/axtimwalde">Saalfeld</a> lab at <a href="/orgs/janelia">Janelia Research Campus</a>.</li></ul>',
  '<p>Fiji is an <a href="/licensing/open-source">open source</a> project, so everybody is welcome to contribute with plugins, patches, bug reports, tutorials, documentation, and artwork.</p></div>'
].join("\n");

test("Fiji 页：首段与两行 li 走模板通道，链接与 href 原样保留", () => {
  const { doc } = boot(FIJI);
  const p = doc.querySelector(".md-content p");
  assert.equal(squash(p.textContent), "Fiji 是一款图像处理软件包，即 ImageJ2 的“开箱即用”发行版，捆绑了大量插件，便于开展科学图像分析。");
  assert.equal(p.querySelectorAll("a").length, 2, "Fiji 与 ImageJ2 两个链接都要保住");
  const hrefs = [...p.querySelectorAll("a")].map((a) => a.getAttribute("href"));
  assert.deepEqual(hrefs, ["https://fiji.sc/", "/software/imagej2"], "两个槽位链接必须按原位放回");
  const lis = [...doc.querySelectorAll(".md-content li")];
  assert.equal(squash(lis[0].textContent), "面向用户 —— Fiji 安装简单，带自动更新功能，捆绑了大量插件，并提供详尽的文档。");
  assert.equal(lis[0].querySelectorAll("a").length, 3, "三个链接都要保住");
  assert.equal(squash(lis[1].textContent), "面向开发者 —— Fiji 是开源项目，托管在 Git 版本控制下的代码仓库中，可获取全部内部实现、库与插件的源代码，并简化插件的开发与脚本。");
  assert.ok(/\u5f00\u53d1\u8005/.test(lis[1].textContent));
});

test("Fiji 页：许可段与贡献段整句翻，实验室名 / 机构名保持英文", () => {
  const { doc } = boot(FIJI);
  const ps = [...doc.querySelectorAll(".md-content p")];
  assert.equal(squash(ps[1].textContent), "Fiji 以开源形式发布，采用GNU 通用公共许可证。");
  assert.equal(squash(ps[2].textContent), "Fiji 由以下多个实验室和机构提供支持：");
  assert.equal(squash(ps[3].textContent), "Fiji 是开源项目，欢迎所有人以插件、补丁、缺陷报告、教程、文档和美术作品的形式参与贡献。");
  assert.equal(ps[3].querySelector("a").getAttribute("href"), "/licensing/open-source");
  const lis = [...doc.querySelectorAll(".md-content li")];
  assert.equal(squash(lis[2].textContent), "Jug 实验室，隶属于 Human Technopole。");
  assert.equal(squash(lis[3].textContent), "Saalfeld 实验室，位于 Janelia Research Campus。");
});

// Downloads 页：版本对比表 + 系统要求 + Web 应用说明。
const DOWNLOADS = [
  '<div class="md-content"><h2>Where is ImageJ2?</h2>',
  '<p>Due to the current way that the core ImageJ update site is organized, ImageJ2 does not currently have a standalone download. The ImageJ2 team is working on changing this, but in the meantime please use the <a href="/software/fiji">Fiji</a> distribution of ImageJ, which is built on top of ImageJ2 and bundles many extra useful plugins.</p>',
  '<table class="plain top help-me-decide"><tr><th><a href="/software/imagej">ImageJ</a></th><th><a href="/software/imagej2">ImageJ2</a></th></tr>',
  '<tr><td><ul><li>Lightweight (ImageJ is a single JAR file)</li><li>Small download (81 MB)</li>',
  '<li>Simple software architecture is <a href="https://imagej.net/ij/developer/">approachable for non-programmers</a></li>',
  '<li><a href="/licensing/#a-note-about-imagej">No copyright whatsoever</a></li><li>Very stable and mature</li>',
  '<li><a href="/people/rasband">Responsive and experienced maintainer</a> fixes bugs quickly</li></ul></td>',
  '<td><ul><li><a href="/presentations">More powerful</a></li><li>Robust <a href="/develop/architecture">software architecture</a></li>',
  '<li>Advanced <a href="/scripting">scripting</a> features</li><li><a href="/licensing">Licensed as permissive open source</a></li>',
  '<li><a href="/libs/imagej-legacy">Backwards compatible with the original ImageJ</a></li>',
  '<li><a href="/plugins/updater">ImageJ Updater</a> lets you install plugins from <a href="/update-sites">ImageJ update sites</a></li>',
  '<li><a href="/scripting/python">Works from Python</a>, including from Jupyter Notebooks</li></ul></td></tr></table>',
  '<div class="download"><ul class="sysreq"><li>Windows 10 or later, x86-64 or arm64</li>',
  '<li>macOS 11 “Big Sur” or later, Apple Silicon or Intel</li>',
  '<li>Ubuntu 22.04 LTS or later, x86-64 or arm64</li></ul></div>',
  '<h2>ImageJ web app</h2>',
  '<p>In lieu of downloading and installing a desktop application, you can run ImageJ in your web browser (on desktops or mobile devices).</p></div>'
].join("\n");

test("Downloads 页：对比表逐条翻，产品名与「Support for headless execution」整条留英文", () => {
  const { doc } = boot(DOWNLOADS);
  const items = [...doc.querySelectorAll("table.help-me-decide li")].map((li) => squash(li.textContent));
  assert.deepEqual(items, [
    "轻量（ImageJ 是单个 JAR 文件）",
    "下载体积小（81 MB）",
    "软件架构简单，对非程序员友好",
    "完全无版权限制",
    "非常稳定成熟",
    "响应迅速、经验丰富的维护者能快速修复缺陷",
    "更强大",
    "Robust software architecture",   // 槽位前只有 6 个字符，建不成模板：整条留英文，不做半句
    "高级脚本功能",
    "以宽松开源许可发布",
    "向后兼容原始 ImageJ",
    "ImageJ 更新器让你从ImageJ 更新站点安装插件",
    "可从 Python 调用，包括在 Jupyter Notebooks 中使用"
  ]);
  const hrefs = [...doc.querySelectorAll("table.help-me-decide a")].map((a) => a.getAttribute("href"));
  assert.ok(hrefs.includes("/update-sites") && hrefs.includes("/people/rasband"), "对比表链接不能丢");
});

test("Downloads 页：系统要求三行整句翻、Web 应用段模板命中", () => {
  const { doc } = boot(DOWNLOADS);
  const req = [...doc.querySelectorAll(".sysreq li")].map((li) => squash(li.textContent));
  assert.deepEqual(req, [
    "Windows 10 或更高版本，x86-64 或 arm64",
    "macOS 11 “Big Sur” 或更高版本，Apple Silicon 或 Intel",
    "Ubuntu 22.04 LTS 或更高版本，x86-64 或 arm64"
  ]);
  const ps = [...doc.querySelectorAll(".md-content p")].map((p) => squash(p.textContent));
  assert.ok(ps.includes("你无需下载安装桌面应用，直接在网页浏览器里（桌面或移动设备）就能运行 ImageJ。"), "Web 应用整句: " + ps.join(" | "));
});

// ImageJ2 页：使命五条、重写与兼容性说明、SCIFIO 段、组件库清单。
const IMAGEJ2 = [
  '<div class="md-content"><h2>Mission</h2><ul>',
  '<li><strong>Design</strong> the next generation of ImageJ, driven by the needs of the community.</li>',
  '<li><strong>Collaborate</strong> across organizations, fostering open development through sharing and reuse.</li>',
  '<li><strong>Broaden</strong> ImageJ’s usefulness and relevance across many disciplines of the scientific community.</li>',
  '<li><strong>Maintain</strong> backwards compatibility with existing ImageJ functionality.</li>',
  '<li><strong>Unify</strong> online resources to a central location for the ImageJ community.</li></ul>',
  '<p>ImageJ2 is a rewrite of <a href="/software/imagej">ImageJ</a> for multidimensional image data, with a focus on scientific imaging. Its central goal is to broaden the paradigm of ImageJ beyond the limitations of the <a href="/software/imagej">original ImageJ application</a>, to support the next generation of multidimensional scientific imaging.</p>',
  '<p>ImageJ2 uses the <a href="/libs/scifio">SCIFIO</a> library (SCientific Image Format Input and Output) by default for most image input tasks. You can change this behavior at any time by running <span class="bc"><span>Edit</span> › <span>Options</span> › <span>ImageJ2</span></span> and modifying the <em>Use SCIFIO when opening files</em> option.</p>',
  '<p>The following software component libraries form the core of ImageJ2:</p><ul>',
  '<li><a href="/libs/imagej-common">ImageJ Common</a> - The core image data model, using ImgLib2.</li>',
  '<li><a href="/plugins/updater">ImageJ Updater</a> - A mechanism to update individual plugins and libraries within ImageJ2.</li>',
  '<li><a href="/libs/imagej-legacy">ImageJ Legacy</a> - Provides complete backwards compatibility with the original ImageJ.</li></ul></div>'
].join("\n");

test("ImageJ2 页：使命五条走模板，机构名 / 产品名保持英文", () => {
  const { doc } = boot(IMAGEJ2);
  const items = [...doc.querySelectorAll(".md-content ul")[0].querySelectorAll("li")].map((li) => squash(li.textContent));
  assert.deepEqual(items, [
    "设计下一代 ImageJ，以社区需求为驱动。",
    "协作跨机构，通过共享与复用来推动开放开发。",
    "拓宽ImageJ 在科学界众多学科中的实用性与相关性。",
    "保持与现有 ImageJ 功能的向后兼容性。",
    "统一分散的在线资源，汇聚到 ImageJ 社区的集中位置。"
  ]);
});

test("ImageJ2 页：SCIFIO 段与组件库清单，产品名与带 <span> 的菜单路径原样保留", () => {
  const { doc } = boot(IMAGEJ2);
  const ps = [...doc.querySelectorAll(".md-content p")].map((p) => squash(p.textContent));
  const rewrite = ps.find((x) => x.startsWith("ImageJ2 是针对多维图像数据重写的 ImageJ"));
  assert.ok(rewrite, "重写说明整句要翻: " + ps.join(" | "));
  assert.ok(rewrite.includes("原始 ImageJ 应用"), "original ImageJ application 槽位要译: " + rewrite);
  const scifio = ps.find((x) => x.includes("科学图像格式输入与输出"));
  assert.ok(scifio, "SCIFIO 段要翻且不能留拉丁展开: " + ps.join(" | "));
  assert.ok(scifio.includes("打开文件时使用 SCIFIO"), "em 槽位“Use SCIFIO when opening files”要译: " + scifio);
  assert.ok(ps.includes("以下软件组件库构成 ImageJ2 的核心："));
  const comps = [...doc.querySelectorAll(".md-content ul")[1].querySelectorAll("li")].map((li) => squash(li.textContent));
  assert.equal(comps[0], "ImageJ Common - 核心图像数据模型，使用 ImgLib2。");
  assert.equal(comps[1], "ImageJ 更新器 - 用于在 ImageJ2 内更新单个插件与库的机制。");
  assert.equal(comps[2], "ImageJ Legacy - 提供对原始 ImageJ 的完整向后兼容。");
  assert.equal(doc.querySelectorAll(".md-content ul")[1].querySelectorAll("a").length, 3);
});

// Plugins 页：审核提示框、两个说明段、四个层级、安装段。
const PLUGINS = [
  '<div class="md-content"><div class="notice notice-info"><div class="notice-icon"><img alt="" src="/media/icons/info.svg" width="32"></div>',
  '<div class="notice-content"><p>The content of this page has not been vetted since shifting away from MediaWiki. If you’d like to help, check out the <a href="/events/wiki-grand-opening/how-to-help">how to help guide</a>!</p></div></div>',
  '<p>ImageJ has been extended with thousands of <a href="https://en.wikipedia.org/wiki/Plug-in_(computing)">plugins</a>: special-purpose software components that extend ImageJ’s functionality—e.g., by offering additional commands via menu entries.</p>',
  '<div class="notice notice-info"><div class="notice-content"><p>You can browse the <a href="/list-of-extensions">list of available ImageJ extensions</a>.</p></div></div>',
  '<h2>Tiers of plugins</h2><p>There are four tiers of plugins:</p><ol>',
  '<li>Core ImageJ plugins, bundled with the base ImageJ distribution. (more than 1000 as of this writing)</li>',
  '<li>Core Fiji plugins, bundled with the <a href="/software/fiji">Fiji</a> distribution of ImageJ. (nearly 1000 additional plugins as of this writing)</li>',
  '<li>Plugins installable from an ImageJ <a href="/update-sites">update site</a>.</li>',
  '<li>Additional plugins available from various online sources, which must be manually installed.</li></ol>',
  '<h2>Installing plugins</h2><p>The ImageJ <a href="/plugins/updater">Updater</a> is the best way to install and update plugins. Simply <a href="/update-sites">add the update site</a> containing your plugins of interest, and they will be installed automatically for you. If the plugin is not available via update site, but packaged as <em>.jar</em> file, or as unpackaged directory with <em>.class</em> files, see <a href="#installing-plugins-manually">Installing plugins manually</a> below.</p></div>'
].join("\n");

test("Plugins 页：审核提示框与「浏览扩展列表」提示整句翻，链接保留", () => {
  const { doc } = boot(PLUGINS);
  const notices = [...doc.querySelectorAll(".notice p")].map((p) => squash(p.textContent));
  assert.equal(notices[0], "本页内容自迁出 MediaWiki 后尚未审核。如果你想帮忙，请参阅如何帮忙指南！");
  assert.equal(notices[1], "你可以浏览可用的 ImageJ 扩展列表。");
  assert.equal(doc.querySelector(".notice a").getAttribute("href"), "/events/wiki-grand-opening/how-to-help");
  const intro = squash(doc.querySelectorAll(".md-content > p")[0].textContent);
  assert.equal(intro, "ImageJ 已通过数千个插件得到扩展：这些专用软件组件以各种方式扩展 ImageJ 的功能，例如通过菜单项提供额外命令。");
});

test("Plugins 页：四个层级与安装段模板，.jar / .class 与 update site 链接原样", () => {
  const { doc } = boot(PLUGINS);
  const tiers = [...doc.querySelectorAll("ol li")].map((li) => squash(li.textContent));
  assert.equal(tiers[0], "核心 ImageJ 插件，随基础 ImageJ 发行版捆绑提供（截至本文撰写时超过 1000 个）");
  assert.equal(tiers[1], "Fiji 核心插件，随 ImageJ 的 Fiji 发行版捆绑提供（截至本文撰写时接近 1000 个额外插件）。");
  assert.equal(tiers[2], "可从 ImageJ 更新站点安装的插件。");
  assert.equal(tiers[3], "来自各类在线来源的额外插件，需手动安装。");
  const installP = [...doc.querySelectorAll(".md-content p")].find((p) => /安装与更新插件的最佳方式/.test(p.textContent));
  assert.ok(installP, "安装段应走模板通道");
  const install = squash(installP.textContent);
  assert.ok(install.startsWith("ImageJ 更新器是安装与更新插件的最佳方式。"), "安装段模板: " + install);
  assert.ok(install.includes("请参见下文的手动安装插件"), "Installing plugins manually 槽位要译: " + install);
  assert.ok(install.includes("以 .jar 文件或含 .class 文件的未打包目录形式提供"), ".jar / .class 文件名不翻: " + install);
  // 原文这段只有三个 <a>（Updater / add the update site / Installing plugins manually），
  // 另有两个 <em>（.jar、.class）也是槽位；旧断言数成 4 个链接，与源码 DOM 不符。
  assert.equal(installP.querySelectorAll("a").length, 3, "三个链接都要保住");
  assert.deepEqual(
    [...installP.querySelectorAll("em")].map((e) => e.textContent.trim()),
    [".jar", ".class"],
    "两个文件名 <em> 槽位要原样保留"
  );
});

test("口径：正文长段与代码块整段留英文，不做半中半英", () => {
  const { doc } = boot('<div class="md-content"><p>If the plugin you want is not distributed via an ImageJ update site, please encourage the plugin’s maintainer to do so! Anyone can create a <a href="/update-sites/setup">hosted update site</a> on <a href="http://sites.imagej.net/">sites.imagej.net</a>, to easily share and maintain updated plugins.</p><pre><code>javac -cp "$IJ_DIR/jars/*" MyCoolPlugin_.java</code></pre></div>');
  const p = squash(doc.querySelector("p").textContent);
  assert.ok(!CJK.test(p) || /[\u4e00-\u9fff]/.test(p), "句段要么整段中文要么整段英文");
  const code = doc.querySelector("pre code").textContent;
  assert.ok(code.includes("javac -cp"), "命令行原样保留: " + code);
});