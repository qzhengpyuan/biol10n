/**
 * Bioconductor 官网词库（dict/bioc.json）冒烟测试。
 * 覆盖：首页 / 安装页 / 关于页 / 帮助页 / BiocViews 分类页的骨架、模板槽位、计数规则与故意保留。
 * 站点栈按 config/sites.json 里 bioc 登记的 dicts 取（common 在前，bioc 在后）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, '../src/engine.js'), 'utf8');
const createEngine = new Function(srcEngine + '; return createEngine;')();
const dict = JSON.parse(fs.readFileSync(path.join(root, '../dict/bioc.json'), 'utf8'));
const sites = JSON.parse(fs.readFileSync(path.join(root, '../config/sites.json'), 'utf8')).sites;
const site = sites.find((s) => s.id === 'bioc');
if (!site) throw new Error('config/sites.json 里找不到 bioc 站点');

const data = { exact: {}, rules: [], templates: [] };
for (const id of site.dicts) {
  const p = path.join(root, '../dict', id + '.json');
  if (!fs.existsSync(p)) continue;
  const b = JSON.parse(fs.readFileSync(p, 'utf8'));
  Object.assign(data.exact, b.exact || {});
  data.rules = data.rules.concat(b.rules || []);
  data.templates = data.templates.concat(b.templates || []);
}

const CJK = /[\u4e00-\u9fff]/;
const text = (el) => String(el.textContent).replace(/\s+/g, ' ').trim();

function render(html, url) {
  const dom = new JSDOM(html, { url: url || 'https://bioconductor.org/' });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return dom.window.document;
}

// 站上每页共用的页头页脚骨架（nav 标签 + 检索框 + 页脚声明）
const HEADER = [
  '<header><nav>',
  '<a class=\'brand\' href=\'/\'>Home</a>',
  '<button>About</button><button>Learn</button><button>Packages</button>',
  '<button>Developers</button><button>Funding</button><button>Donate</button>',
  '<input type=\'search\' placeholder=\'Search\' aria-label=\'Search icon\'>',
  '<button class=\'cta\'>Get Started</button><button aria-label=\'Menu\'>Menu</button>',
  '</nav></header>'
].join('');
const FOOTER = '<footer><p>Contact us: <a href=\'https://support.bioconductor.org\'>support.bioconductor.org</a></p>' +
  '<p>Copyright &copy; 2003 - 2026 Bioconductor</p></footer>';

test('词库结构：family/sites 正确，三张表都有内容，译文都含汉字', () => {
  assert.equal(dict.meta.family, 'bioconductor');
  assert.ok(dict.meta.sites.includes('bioconductor.org'));
  const keys = Object.keys(dict.exact);
  assert.ok(keys.length >= 250, 'exact 只有 ' + keys.length + ' 条');
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.match(v, CJK, '译文不含汉字: ' + k + ' => ' + v);
  }
  assert.ok(dict.rules.length >= 6, 'rules 只有 ' + dict.rules.length + ' 条');
  assert.ok(dict.templates.length >= 25, 'templates 只有 ' + dict.templates.length + ' 条');
  for (const r of dict.rules) assert.match(r.to, CJK, '规则译文不含汉字: ' + r.re);
});

test('条目卫生：key 无中文、值无明文 URL/邮箱、无自映射与首尾空白', () => {
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.doesNotMatch(k, CJK, 'key 含中文: ' + k);
    assert.doesNotMatch(v, /https?:\/\//i, '值含明文 URL: ' + k);
    assert.doesNotMatch(v, /[\w.+-]+@[\w-]+\.[\w.]+/, '值含明文邮箱: ' + k);
    assert.notEqual(k, v, '自映射: ' + k);
    assert.equal(k, k.trim(), 'key 有首尾空白: ' + JSON.stringify(k));
    assert.equal(v, v.trim(), '值有首尾空白: ' + JSON.stringify(k));
  }
});

test('模板形态：pat 无汉字、长度合规，zh 占位符与 pat 一一对应', () => {
  for (const t of dict.templates) {
    assert.ok(t.pat && t.zh, '模板缺字段');
    assert.doesNotMatch(t.pat, CJK, 'pat 含汉字: ' + t.pat);
    assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, 'pat 长度异常(' + t.pat.length + '): ' + t.pat.slice(0, 40));
    const patSlots = new Set((t.pat.match(/\{\{\d+\}\}/g) || []).map((s) => s.replace(/[{}]/g, '')));
    const zhSlots = new Set((t.zh.match(/\{\{\d+\}\}/g) || []).map((s) => s.replace(/[{}]/g, '')));
    assert.deepEqual([...zhSlots].sort(), [...patSlots].sort(), '占位符不匹配: ' + t.pat.slice(0, 60));
  }
});

test('规则：版权行、包数标题、分类计数、去重下载数都走规则并保留数字', () => {
  const one = (html) => text(render('<main>' + html + '</main>').querySelector('p, h1, h2'));
  assert.equal(one('<p>Copyright &copy; 2003 - 2026 Bioconductor</p>'), '版权所有 © 2003 - 2026 Bioconductor');
  assert.equal(one('<h1>Bioconductor 3.23 Packages</h1>'), 'Bioconductor 3.23 软件包');
  assert.equal(one('<h2>All packages — 3818</h2>'), '全部软件包 — 3818 个');
  assert.equal(one('<p>45546715 distinct</p>'), '去重下载 45546715 次');
  assert.equal(one('<p>2 years ago</p>'), '2 年前');
  assert.equal(one('<p>just now</p>'), '刚刚');
});

test('页头页脚骨架：导航、检索占位、菜单与版权行', () => {
  const d = render(HEADER + '<main><p>x</p></main>' + FOOTER);
  const labels = [...d.querySelectorAll('nav a, nav button')].map((el) => text(el));
  assert.deepEqual(labels, ['首页', '关于', '学习', '软件包', '开发者', '资助', '捐赠', '开始使用', '菜单']);
  assert.equal(d.querySelector('input').getAttribute('placeholder'), '检索');
  const menu = [...d.querySelectorAll('nav button')].find((b) => b.getAttribute('aria-label') === '菜单');
  assert.ok(menu, '菜单按钮的 aria-label 没翻译');
  assert.equal(d.querySelector('input').getAttribute('aria-label'), '搜索图标');
  const footer = text(d.querySelector('footer'));
  assert.match(footer, /联系我们：/);
  assert.match(footer, /support\.bioconductor\.org/);
  assert.match(footer, /版权所有 © 2003 - 2026 Bioconductor/);
});
test('首页 hero：拆行标题整句压平，mark 高亮不再单独保留', () => {
  const d = render('<main><h1 class="hero">Open source <br class="mobile-break" />software for <br /><mark>Bioinformatics</mark></h1></main>');
  const h1 = d.querySelector('h1');
  assert.equal(text(h1), '面向生物信息学的开源软件');
  assert.equal(h1.querySelectorAll('mark').length, 0);
});

test('首页使命段：br 作为槽位保留，整段译成中文', () => {
  const d = render('<main><p>The Bioconductor project aims to develop and share open source software for precise and repeatable analysis of biological data.<br /> We foster an inclusive and collaborative community of developers and data scientists.</p></main>');
  const p = d.querySelector('p');
  assert.equal(p.querySelectorAll('br').length, 1);
  const s = text(p);
  assert.match(s, /^Bioconductor 项目旨在开发并共享开源软件/);
  assert.match(s, /我们培育一个包容、协作的开发者与数据科学家社区。$/);
});

test('首页顶部绿框：img 槽位保留，Software/Annotation/Experiment 成句', () => {
  const d = render('<main><ul class="boxes"><li><p><img src="logo.svg" alt="logo" /> <a href="/p/software">Software</a>, <a href="/p/annotation">Annotation</a> and <a href="/p/experiment">Experiment</a> Packages</p></li></ul></main>');
  const p = d.querySelector('p');
  assert.equal(p.querySelectorAll('img').length, 1);
  assert.equal(text(p), '软件、注释和实验软件包');
});

test('首页 About 区：Docker images / AnVIL / Working Group 三个模板', () => {
  const d = render('<main><p>Bioconductor provides <a href="/help/docker/">Docker images</a> for every release and provides support for Bioconductor use in <a href="https://anvil.bioconductor.org">AnVIL</a>.</p><p>Consider joining a <a href="https://workinggroups.bioconductor.org/index.html">Bioconductor Working Group</a> to get involved with different areas of interest in the project.</p></main>');
  const [p1, p2] = d.querySelectorAll('p');
  assert.equal(text(p1), 'Bioconductor 为每个版本提供 Docker 镜像，并支持在 AnVIL 中使用 Bioconductor。');
  assert.equal(text(p2), '考虑加入 Bioconductor 工作组，参与项目中不同兴趣领域的工作。');
  assert.equal(p1.querySelectorAll('a').length, 2);
});

test('首页 Packages 卡：Discover 模板保留 2418，发布公告与社区横幅', () => {
  const d = render('<main><p class="text-large">Discover <a href="/packages/release/BiocViews.html#___Software">2418</a> software packages available in Bioconductor release 3.23.</p><p class="text-large">Bioconductor 3.23 <a href="/news/bioc_3_23_release/">release announcement</a></p><p class="text-large">Join our ever-growing community and discover how Bioconductor can <mark class="text-gradient">improve your pipeline</mark></p></main>');
  const [p1, p2, p3] = d.querySelectorAll('p');
  assert.equal(text(p1), '浏览 Bioconductor 3.23 版本提供的 2418 个软件包。');
  assert.equal(p1.querySelector('a').textContent, '2418');
  assert.equal(text(p2), 'Bioconductor 3.23 发布公告');
  assert.equal(text(p3), '加入我们不断壮大的社区，了解 Bioconductor 如何改善您的分析流程');
  assert.equal(p3.querySelectorAll('mark').length, 0);
});

test('安装页：标题与两段版本说明（数字保留）', () => {
  const html = '<main><h1 class="get-started-h1">Get started</h1><h4>1. Install R</h4><h4>2. Get the latest version of Bioconductor</h4><p>The current release of Bioconductor is version 3.23; it works with R version 4.6.0. Users of older R and Bioconductor must update their installation to take advantage of new features and to access packages that have been added to Bioconductor since the last release.</p><p>The development version of Bioconductor is version 3.24; it works with R version 4.6.0. More recent &#39;devel&#39; versions of R (if available) will be supported during the next Bioconductor release cycle.</p></main>';
  const d = render(html, 'https://bioconductor.org/install/');
  assert.equal(text(d.querySelector('h1')), '开始使用');
  assert.deepEqual([...d.querySelectorAll('h4')].map((h) => text(h)), ['1. 安装 R', '2. 获取最新版本的 Bioconductor']);
  const [p1, p2] = d.querySelectorAll('p');
  assert.equal(text(p1), 'Bioconductor 当前发布版本为 3.23，可与 R 版本 4.6.0 配合使用。使用旧版 R 与 Bioconductor 的用户必须更新安装，才能用上新功能，并访问自上一版本以来新增到 Bioconductor 的软件包。');
  assert.match(text(p2), /^Bioconductor 的开发版本为 3.24，可与 R 版本 4.6.0 配合使用。/);
});

test('安装页：Step 3 模板保留 help.start() / ?mean 代码槽位', () => {
  const d = render('<main><p>As a first step with R, start the R help browser by typing <strong>help.start()</strong> in the R command window. For help on any function, e.g. the “mean” function, type <strong>?mean</strong>.</p></main>', 'https://bioconductor.org/install/');
  const p = d.querySelector('p');
  assert.deepEqual([...p.querySelectorAll('strong')].map((s) => s.textContent), ['help.start()', '?mean']);
  assert.equal(text(p), '作为 R 的第一步，在 R 命令窗口中键入 help.start() 启动 R 帮助浏览器。如需查看任意函数的帮助，例如“mean”函数，请键入 ?mean。');
});

test('安装页：更改版本一句保留 BiocManager 简介文档链接', () => {
  const d = render('<main><p>It may be possible to change the Bioconductor version of an existing installation; <a href="https://cran.r-project.org/web/packages/BiocManager/vignettes/BiocManager.html">see the ‘Changing version’ section of the BiocManager vignette.</a></p></main>', 'https://bioconductor.org/install/');
  const p = d.querySelector('p');
  assert.equal(p.querySelectorAll('a').length, 1);
  assert.equal(text(p), '可以更改现有安装的 Bioconductor 版本；请参阅 BiocManager 简介文档中「更改版本」一节。');
});

test('安装页：更新参数 ask=FALSE 保留，旧版说明保留 LegacyInstall 路径', () => {
  const d = render('<main><p>Use the argument <strong>ask=FALSE</strong> to update old packages without being prompted. Read the help page for ?install for additional details.</p><p>It is always recommended to update to the most current version of R and Bioconductor. If this is not possible and <strong>R &lt; 3.5.0</strong> , please use the scripts from <a href="https://github.com/Bioconductor/LegacyInstall">Bioconductor/LegacyInstall</a>.</p></main>', 'https://bioconductor.org/install/');
  const [p1, p2] = d.querySelectorAll('p');
  assert.equal(p1.querySelector('strong').textContent, 'ask=FALSE');
  assert.equal(text(p1), '使用参数 ask=FALSE 可在不出现提示的情况下更新旧软件包。更多细节请阅读 ?install 的帮助页面。');
  assert.match(text(p2), /^始终建议更新到最新版本的 R 与 Bioconductor。/);
  assert.match(text(p2), /Bioconductor\/LegacyInstall 中的脚本。$/);
});

test('安装页：Why use 标题与 install() 参数说明成句', () => {
  const d = render('<main><h3>Why use BiocManager::install()?</h3><p>The install() function (in the BiocManager package) has arguments that change its default behavior; type ?install for further help.</p></main>', 'https://bioconductor.org/install/');
  assert.equal(text(d.querySelector('h3')), '为什么要用 BiocManager::install()？');
  assert.equal(text(d.querySelector('p')), 'BiocManager 软件包中的 install() 函数带有可更改其默认行为的参数；键入 ?install 可获取更多帮助。');
});
test('关于页：标题、使命整段、项目目标三条', () => {
  const mission = 'The mission of the Bioconductor project is to develop, support, and disseminate free open source software that facilitates rigorous and reproducible analysis of data from current and emerging biological assays. We are dedicated to building a diverse, collaborative, and welcoming community of developers and data scientists.';
  const html = '<main><h1>About Bioconductor</h1><h2>Release and Core Development</h2><p>' + mission + '</p><h2>Project Goals</h2><ul>' +
    '<li>To provide widespread access to a broad range of powerful statistical and graphical methods for the analysis of genomic data.</li>' +
    '<li>To further scientific understanding by producing high-quality <a href="/help/docs">documentation</a> and reproducible research.</li>' +
    '<li>To <a href="/help/courses">train</a> researchers on computational and statistical methods for the analysis of genomic data.</li></ul></main>';
  const d = render(html, 'https://bioconductor.org/about/');
  assert.equal(text(d.querySelector('h1')), '关于 Bioconductor');
  assert.equal(text(d.querySelectorAll('h2')[0]), '发布与核心开发');
  assert.match(text(d.querySelector('p')), /^Bioconductor 项目的使命是开发、支持并传播自由开源软件/);
  const goals = [...d.querySelectorAll('li')].map((li) => text(li));
  assert.match(goals[0], /为基因组数据分析提供广泛可及、种类丰富的强大统计与图形方法/);
  assert.equal(goals[1], '通过产出高质量文档与可重复研究，促进科学理解。');
  assert.equal(goals[2], '就基因组数据分析的计算与统计方法培训研究人员。');
});

test('关于页：快速统计的计数行与标签', () => {
  const html = '<main><h2>Quick Stats</h2><p>Last updated <abbr title="2023-12-21">"2023-12-18"</abbr></p>' +
    '<p class="text-large">3691 total</p><p class="text-large"><mark>Release Packages</mark></p>' +
    '<p class="text-large">18999 active</p><p class="text-large"><mark>Support Site Members</mark></p>' +
    '<p class="text-large">45546715 distinct</p><p class="text-large"><mark>Software Downloads in 2023</mark></p></main>';
  const d = render(html, 'https://bioconductor.org/about/');
  assert.equal(text(d.querySelector('h2')), '快速统计');
  const ps = [...d.querySelectorAll('p')].map((p) => text(p));
  assert.match(ps[0], /^最后更新/);
  assert.equal(ps[1], '3691 总计');
  assert.equal(ps[2], '发布软件包');
  assert.equal(ps[3], '18999 启用');
  assert.equal(ps[4], '支持站点成员');
  assert.equal(ps[5], '去重下载 45546715 次');
  assert.equal(ps[6], '2023 年软件下载量');
});

test('关于页：咨询委员会英文原句保留（Technical 与既有册译法冲突，故意不翻）', () => {
  const d = render('<main><p><a href="/about/boards">Scientific</a>, <a href="/about/boards">Technical</a> and <a href="/about/boards">Community</a> Advisory Boards provide project oversight.</p></main>', 'https://bioconductor.org/about/');
  assert.equal(text(d.querySelector('p')), 'Scientific, Technical and Community Advisory Boards provide project oversight.');
});

test('帮助页：页头、检索说明与 See 模板', () => {
  const html = '<main><h1 class="format-bold">Learn</h1>' +
    '<h2>Find out all you need to know about Bioconductor and its packages</h2>' +
    '<p class="text-large">Whether you&#39;re a new user seeking to get started or an experienced developer, our knowledge base provides you with the necessary tools and insights to navigate Bioconductor packages effortlessly.</p>' +
    '<h4>Developers</h4><p class="text-large">See <a href="/developers/">Developers Section</a> for more information</p></main>';
  const d = render(html, 'https://bioconductor.org/help/');
  assert.equal(text(d.querySelector('h1')), '学习');
  assert.equal(text(d.querySelector('h2')), '了解关于 Bioconductor 及其软件包的全部所需信息');
  assert.match(text(d.querySelectorAll('p')[0]), /^无论您是刚入门的新用户/);
  assert.equal(text(d.querySelectorAll('p')[1]), '更多信息请参见开发者专区');
});

test('BiocViews 分类页：面包屑、标题规则、说明模板、筛选条与分类树', () => {
  const html = '<main><ul class="breadcrumbs"><li><a href="/">Home</a></li><li>Bioconductor 3.23</li></ul>' +
    '<h1>Bioconductor 3.23 Packages</h1>' +
    '<p>Looking for something older? See <a href="/packages/release/BiocViews.html#past">past releases</a> or the <a href="/removed">packages removed from Bioconductor</a>.</p>' +
    '<div class="bvf-topbar"><p class="format-bold">Bioconductor</p><p class="format-bold">3.23</p><p class="format-bold">(Release)</p><a class="brand-border-button"><span class="span-brand">Go to</span></a></div>' +
    '<div class="bvf-search"><label class="sr-only" for="bvf-q">Search packages and categories</label><input id="bvf-q" placeholder="Search packages by name, title, or category…"></div>' +
    '<nav class="bvf-tree"><ul><li><div class="bvf-term bvf-active"><button class="bvf-name">All packages<span class="bvf-count">(3818)</span></button></div></li>' +
    '<li><div class="bvf-term"><button class="bvf-chevron" aria-label="Collapse Software">v</button><button class="bvf-name">Software<span class="bvf-count">(2431)</span></button></div></li>' +
    '<li><div class="bvf-term"><button class="bvf-chevron" aria-label="Expand AnnotationData">&gt;</button><button class="bvf-name">AnnotationData<span class="bvf-count">(928)</span></button></div></li></ul></nav>' +
    '<h2 class="bvf-heading">All packages — 3818</h2>' +
    '<div class="package-fragment"><p><a href="/packages/limma">limma</a></p><span class="bvf-badge">Annotation</span></div></main>';
  const d = render(html, 'https://bioconductor.org/packages/release/BiocViews.html');
  assert.deepEqual([...d.querySelectorAll('.breadcrumbs li')].map((li) => text(li)), ['首页', 'Bioconductor 3.23']);
  assert.equal(text(d.querySelector('h1')), 'Bioconductor 3.23 软件包');
  assert.equal(text(d.querySelector('section p, main p')), '想找更早的版本？请参阅既往版本或已从 Bioconductor 移除的软件包。');
  assert.match(text(d.querySelector('.bvf-topbar')), /（正式版）/);
  assert.match(text(d.querySelector('.bvf-topbar')), /前往/);
  assert.equal(text(d.querySelector('label')), '搜索软件包与分类');
  assert.equal(d.querySelector('input').getAttribute('placeholder'), '按名称、标题或分类搜索软件包…');
  assert.deepEqual([...d.querySelectorAll('button.bvf-name')].map((b) => text(b)), ['全部软件包（3818）', '软件（2431）', '注释数据（928）']);
  assert.deepEqual([...d.querySelectorAll('button.bvf-chevron')].map((b) => b.getAttribute('aria-label')), ['收起软件', '展开注释数据']);
  assert.equal(text(d.querySelector('.bvf-heading')), '全部软件包 — 3818 个');
  assert.equal(text(d.querySelector('.bvf-badge')), '注释');
});

test('BiocViews：包名与包描述保持英文，不误翻', () => {
  const d = render('<main><div class="package-fragment"><p><a href="/packages/DESeq2">DESeq2</a></p><p>Differential expression analysis of count data</p></div>' +
    '<div class="package-fragment"><p><a href="/packages/edgeR">edgeR</a></p><p>Empirical analysis of digital gene expression data in R</p></div></main>', 'https://bioconductor.org/packages/release/BiocViews.html');
  const all = [...d.querySelectorAll('a, p')].map((el) => text(el));
  assert.ok(all.includes('DESeq2'), '包名 DESeq2 被翻译了');
  assert.ok(all.includes('edgeR'), '包名 edgeR 被翻译了');
  assert.ok(all.includes('Differential expression analysis of count data'), '包描述被翻译了');
});

test('不半中半英：词条里的英文只允许代码标识或既有专名', () => {
  const allow = new Set(['devel', 'git', 'install', 'mean', 'org']);
  const bad = [];
  for (const [k, v] of Object.entries(dict.exact)) {
    const words = (v.match(/[A-Za-z][A-Za-z0-9.+#\/-]*/g) || []).filter((w) => /^[a-z]/.test(w) && w.length > 2 && !allow.has(w));
    if (words.length) bad.push(k + ' => ' + v + ' ⟵ ' + words.join(','));
  }
  assert.deepEqual(bad, []);
});

test('故意保留：品牌、包名、邮箱与 URL 原样留在英文', () => {
  const d = render('<main><p>AnVIL</p><p>Bioconductor 3.23</p><p>limma</p><p><a href="mailto:maintainer@bioconductor.org">maintainer@bioconductor.org</a></p><p>support.bioconductor.org</p></main>', 'https://bioconductor.org/about/');
  const ps = [...d.querySelectorAll('p')].map((p) => text(p));
  assert.deepEqual(ps, ['AnVIL', 'Bioconductor 3.23', 'limma', 'maintainer@bioconductor.org', 'support.bioconductor.org']);
});
test('BiocViews 表格：caption 与表头（Package 因跨册冲突保持英文）', () => {
  const d = render('<main><table><caption class="sr-only">Package names and titles</caption>' +
    '<thead><tr><th scope="col">Package</th><th scope="col">Title</th></tr></thead></table></main>', 'https://bioconductor.org/packages/release/BiocViews.html');
  assert.equal(text(d.querySelector('caption')), '软件包名称与标题');
  assert.deepEqual([...d.querySelectorAll('th')].map((th) => text(th)), ['Package', '标题']);
});