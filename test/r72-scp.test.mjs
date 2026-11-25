/**
 * Broad Single Cell Portal 词库（dict/scp.json）回归。
 * 覆盖：列表页 / 研究页（概要、探索）/ 收藏集 / 隐私政策 / 错误页 / 下载弹窗的骨架、
 * 计数规则、模板槽位、属性通道与故意保留（研究名、作者、物种、细胞类型、登录号）。
 * 站点栈按 config/sites.json 里 scp 登记的 dicts 取（common → spa → scp，后者覆盖前者）。
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
const dict = JSON.parse(fs.readFileSync(path.join(root, '../dict/scp.json'), 'utf8'));
const sites = JSON.parse(fs.readFileSync(path.join(root, '../config/sites.json'), 'utf8')).sites;
const site = sites.find((s) => s.id === 'scp');
if (!site) throw new Error('config/sites.json 里找不到 scp 站点');

const data = { exact: {}, rules: [], templates: [] };
for (const id of site.dicts) {
  const p = path.join(root, '../dict', id + '.json');
  if (!fs.existsSync(p)) continue;
  const b = JSON.parse(fs.readFileSync(p, 'utf8'));
  Object.assign(data.exact, b.exact || {});
  data.rules = data.rules.concat(b.rules || []);
  data.templates = data.templates.concat(b.templates || []);
}

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;
const text = (el) => String(el.textContent).replace(/\s+/g, ' ').trim();

function render(html, url) {
  const dom = new JSDOM(html, { url: url || 'https://singlecell.broadinstitute.org/single_cell' });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return { doc: dom.window.document, engine };
}
const doc = (html, url) => render(html, url).doc;

test('词库结构：family/sites 正确，三张表都有内容，译文都含汉字', () => {
  assert.equal(dict.meta.family, 'scp');
  assert.ok(dict.meta.sites.includes('singlecell.broadinstitute.org'));
  const keys = Object.keys(dict.exact);
  assert.ok(keys.length >= 150, 'exact 只有 ' + keys.length + ' 条');
  assert.ok(dict.rules.length >= 1, 'rules 只有 ' + dict.rules.length + ' 条');
  assert.ok(dict.templates.length >= 5, 'templates 只有 ' + dict.templates.length + ' 条');
  const unitOnly = new Set(['x (um)', 'y (um, negated)']);
  for (const [k, v] of Object.entries(dict.exact)) {
    if (!unitOnly.has(k)) assert.match(v, CJK, '译文不含汉字: ' + k + ' => ' + v);
    assert.equal(k, k.trim(), 'key 有首尾空白: ' + JSON.stringify(k));
    assert.equal(v, v.trim(), '译文有首尾空白: ' + JSON.stringify(k));
    assert.doesNotMatch(k, CJK, 'key 含中文: ' + k);
    assert.notEqual(k, v, '自映射: ' + k);
  }
});

test('词条卫生：值里没有裸邮箱；唯一的 URL 是 WebGL 提示里的官方地址', () => {
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.doesNotMatch(v, /[\w.+-]+@[\w-]+\.[\w.]+/, '值含邮箱: ' + k);
    if (/https?:\/\//.test(v)) {
      assert.equal(k, 'WebGL is not supported by your browser - visit https://get.webgl.org for more info', '不该有别的 URL 值: ' + k);
    }
  }
});

test('规则：锚定、正则合法、译文有中文、$n 不超捕获组', () => {
  for (const r of dict.rules) {
    assert.equal(typeof r.re, 'string');
    assert.equal(typeof r.to, 'string');
    const re = new RegExp(r.re);
    assert.match(r.re, /^\^/, '未锚定行首: ' + r.re);
    assert.match(r.re, /\$$/, '未锚定行尾: ' + r.re);
    assert.match(r.to, CJK);
    const groups = (re.source.match(/\((?!\?)/g) || []).length;
    for (const m of r.to.matchAll(/\$(\d)/g)) assert.ok(Number(m[1]) <= groups, '占位符超出捕获组: ' + r.re);
  }
});

test('模板形态：pat 无汉字、长度合规、占位符与译文一一对应', () => {
  for (const t of dict.templates) {
    assert.ok(t.pat && t.zh, '模板缺字段');
    assert.doesNotMatch(t.pat, CJK, 'pat 含汉字: ' + t.pat.slice(0, 50));
    assert.equal(t.pat, t.pat.replace(/\s+/g, ' ').trim(), 'pat 空白不规范: ' + t.pat.slice(0, 50));
    assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, 'pat 长度异常: ' + t.pat.length);
    assert.match(t.zh, CJK);
    const patSlots = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    const zhSlots = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.ok(patSlots.length > 0, 'pat 没有槽位: ' + t.pat.slice(0, 40));
    assert.deepEqual(patSlots, patSlots.map((_, i) => i + 1), 'pat 槽位不连续: ' + t.pat.slice(0, 40));
    assert.deepEqual(zhSlots, patSlots, '译文槽位不匹配: ' + t.pat.slice(0, 40));
  }
});

test('页头与页脚：导航、帮助菜单、登录与版权行', () => {
  const d = doc(
    "<nav><span class='sr-only'>Toggle navigation</span><a class='dropdown-toggle'>Help</a>" +
      "<a>Documentation</a><a>Contact us</a><a>Request a feature</a><a>Portal source code</a>" +
      "<a>REST API documentation</a><a>New features</a><a class='check-upload'>Create study</a>" +
      "<a class='left-border-0-5'>Sign in</a></nav>" +
      "<footer><div class='footer-text-block'>© 2026 The Broad Institute of MIT and Harvard</div>" +
      "<a>Privacy Policy</a><a>Terms of Service</a><a>Portal whitepaper</a></footer>"
  );
  const labels = [...d.querySelectorAll('nav a')].map((a) => text(a));
  assert.deepEqual(labels, ['帮助', '文档', '联系我们', '请求新功能', '门户源码', 'REST API 文档', '新功能', '创建研究', '登录']);
  assert.equal(text(d.querySelector('.sr-only')), '切换导航');
  const foot = [...d.querySelectorAll('footer a')].map((a) => text(a));
  assert.deepEqual(foot, ['隐私政策', '服务条款', '门户白皮书']);
  assert.match(text(d.querySelector('.footer-text-block')), /^© 2026 布罗德研究所/);
});

test('列表页：结果计数模板保留数字、分页规则、细胞与基因计数', () => {
  const d = doc(
    "<div class='results-header'><div class='col-md-4 results-totals'><strong>1073</strong> total studies found</div>" +
      "<div class='pagination'><span class='currentPage'>Page 1 of 108</span></div></div>" +
      "<table class='result-table'><tbody><tr><td><span class='badge cell-count'>1006165 Cells</span></td></tr></tbody></table>"
  );
  const totals = d.querySelector('.results-totals');
  assert.equal(text(totals), '共找到 1073 项研究');
  assert.equal(text(totals.querySelector('strong')), '1073');
  assert.equal(text(d.querySelector('.currentPage')), '第 1 页，共 108 页');
  assert.equal(text(d.querySelector('.badge')), '1006165 个细胞');
});

test('列表页：卡片表头、more... 与截断续读标记', () => {
  const d = doc(
    "<table class='cohort-table'><tr><th class='cohort-th'>Disease</th><th class='cohort-th'>Organ</th>" +
      "<th class='cohort-th'>Species</th><th class='cohort-th'>Sex</th><th class='cohort-th'>Library preparation protocol</th></tr></table>" +
      "<div><span class='badge'>3</span> <span>more...</span></div>" +
      "<div><span class='studyDescription'>Some abstract text</span> <span class='detail'>...(continued)</span></div>"
  );
  assert.deepEqual([...d.querySelectorAll('th')].map((t) => text(t)), ['疾病', '器官', '物种', '性别', '文库制备方案']);
  assert.equal(text(d.querySelectorAll('div')[0]), '3 更多…');
  assert.equal(text(d.querySelector('.detail')), '…（续）');
});

test('列表页：分面栏、更多分面与选项菜单', () => {
  const d = doc(
    "<div class='metadata-search-wrap'><span class='metadata-search search-title'>Search by filters</span>" +
      "<a>organ</a><a>species</a><a>disease</a><a>cell type</a>" +
      "<span id='more-facets-button'><a>More facets</a></span></div>" +
      "<div id='search-options-menu'><ul><li>Include HCA results</li><li>Has raw counts</li>" +
      "<li>Has differential expression</li><li>Has spatial data</li></ul></div>"
  );
  assert.equal(text(d.querySelector('.search-title')), '按条件筛选');
  assert.deepEqual([...d.querySelectorAll('.metadata-search-wrap a')].map((a) => text(a)), ['器官', '物种', '疾病', '细胞类型', '更多分面']);
  assert.deepEqual([...d.querySelectorAll('#search-options-menu li')].map((li) => text(li)),
    ['包含 HCA 结果', '含原始计数', '含差异表达', '含空间数据']);
});

test('列表页：分页按钮的 aria-label 与检索占位符走属性通道', () => {
  const d = doc(
    "<div class='pagination'><button class='paginate-start' aria-label='Page to start'></button>" +
      "<button aria-label='Page back'></button><button aria-label='Page next'></button>" +
      "<button aria-label='Page to end'></button></div>" +
      "<button aria-label='Search keywords'></button><input placeholder='Search'>"
  );
  assert.deepEqual([...d.querySelectorAll('button')].map((b) => b.getAttribute('aria-label')),
    ['首页', '上一页', '下一页', '末页', '检索关键词']);
  assert.equal(d.querySelector('input').getAttribute('placeholder'), '检索');
});

test('研究页：标签页、计数徽标、通讯作者与相关论文', () => {
  const d = doc(
    "<ul><li class='study-nav'><a>Summary</a></li><li class='study-nav'><a>Explore</a></li>" +
      "<li class='study-nav'><a>Download</a></li></ul>" +
      "<span class='badge'>1402 total cells</span><span class='badge'>25392 genes</span>" +
      "<h5>Corresponding authors</h5><span>Naomi Habib</span><h5>Related publications</h5>"
  );
  assert.deepEqual([...d.querySelectorAll('.study-nav a')].map((a) => text(a)), ['概要', '探索', '下载']);
  assert.deepEqual([...d.querySelectorAll('.badge')].map((b) => text(b)), ['1402 个细胞', '25392 个基因']);
  assert.deepEqual([...d.querySelectorAll('h5')].map((h) => text(h)), ['通讯作者', '相关论文']);
  assert.equal(text(d.querySelector('span:not(.badge)')), 'Naomi Habib', '作者名被翻了');
});

test('研究页探索区：选项、聚类/注释、选细胞与图型按钮', () => {
  const d = doc(
    "<section class='explore'><span class='options-label'>OPTIONS</span>" +
      "<label class='labeled-select'>Clustering</label><label class='labeled-select'>Spatial groups</label>" +
      "<label class='labeled-select'>Annotation</label><label>Selecting Cells</label>" +
      "<li>Drag on a scatter plot to select a group of cells.</li>" +
      "<button class='btn btn-primary'>Create</button><button class='btn btn-secondary'>Cancel</button>" +
      "<a class='action'>Manage all</a><button>Filter plotted cells</button>" +
      "<label class='labeled-select'>Plot type</label><div>Violin plot</div>" +
      "<label class='labeled-select'>Data points</label><div>None</div>" +
      "<label class='labeled-select'>Row centering</label><label class='labeled-select'>Fit options</label>" +
      "<button class='action'>Reset view</button><button class='action'>Get link</button>" +
      "<label class='labeled-select'>Precomputed heatmaps</label><div>None selected...</div></section>"
  );
  assert.equal(text(d.querySelector('.options-label')), '选项');
  assert.deepEqual([...d.querySelectorAll('label.labeled-select')].map((l) => text(l)),
    ['聚类', '空间分组', '注释', '图表类型', '数据点', '行中心化', '拟合选项', '预计算热图']);
  assert.equal(text(d.querySelector("li")), '在散点图上拖拽以选择一组细胞。');
  assert.deepEqual([...d.querySelectorAll('button.btn')].map((b) => text(b)), ['创建', '取消']);
  assert.equal(text(d.querySelector('a.action')), '全部管理');
  assert.equal(text(d.querySelector('button:not(.btn)')), '筛选绘制的细胞');
  assert.deepEqual([...d.querySelectorAll('div')].slice(0, 3).map((x) => text(x)), ['小提琴图', '无', '未选择…']);
});

test('研究页：图例点数 tooltip 与下载提示走规则/词条', () => {
  const d = doc(
    "<span class='num-points' title='1717 points in this group'>1717</span>" +
      "<a href='#study-download' title='Please sign in to download data'>Download</a>" +
      "<div>WebGL is not supported by your browser - visit https://get.webgl.org for more info</div>"
  );
  assert.equal(d.querySelector('.num-points').getAttribute('title'), '1717 个点（本组）');
  assert.equal(d.querySelector('a').getAttribute('title'), '请登录后下载数据');
  assert.match(text(d.querySelector('div')), /^您的浏览器不支持 WebGL/);
});

test('研究页：绘图类型与离群值选项', () => {
  const d = doc(
    "<section><a class='stateful-link'>Show all</a><a class='stateful-link'>Hide all</a></section>" +
      "<label>Distribution</label><label>Heatmap</label><label>Scatter</label>" +
      "<label>Correlation</label><label>Dot plot</label>" +
      "<div>Box plot</div><div>Outliers</div><div>All</div>"
  );
  assert.deepEqual([...d.querySelectorAll('a')].map((a) => text(a)), ['显示全部', '全部隐藏']);
  assert.deepEqual([...d.querySelectorAll('label')].map((l) => text(l)),
    ['分布', '热图', '散点图', '相关性', '点图']);
  assert.deepEqual([...d.querySelectorAll('div')].map((x) => text(x)), ['箱线图', '离群值', '全部']);
});

test('收藏集页：面包屑、说明模板保留邮箱链接、N studies 规则', () => {
  const d = doc(
    "<a>Home</a><h2>/ Collections</h2>" +
      "<p>Collections are curated groups of studies that share a common research theme. If your organization is interested in creating a collection in SCP, contact us at " +
      "<a href='mailto:scp-support@broadinstitute.zendesk.com'>scp-support@broadinstitute.zendesk.com</a></p>" +
      "<div class='collections-name'>68 studies</div>"
  );
  assert.equal(text(d.querySelector('a')), '首页');
  assert.equal(text(d.querySelector('h2')), '/ 收藏集');
  const p = d.querySelector('p');
  assert.match(text(p), /^收藏集是围绕同一研究主题精选的研究组/);
  assert.match(text(p), /联系我们$/);
  assert.equal(p.querySelectorAll('a').length, 1, '邮箱链接丢了');
  assert.match(p.querySelector('a').getAttribute('href'), /^mailto:/);
  assert.equal(text(d.querySelector('.collections-name')), '68 项研究');
});

test('隐私政策：标题、小节与整段成句（含 Google 登录段）', () => {
  const d = doc(
    "<h1>Single Cell Portal Privacy Policy</h1><h3>Information gathering</h3>" +
      "<p>The Broad Institute Single Cell Portal receives and stores information related to user's Google profiles, including email addresses, user IDs, and OAuth tokens. This information is gathered as part of the standard Google sign-in process.</p>" +
      "<h3>Publicly Uploaded Information</h3><h3>Security</h3><h3>Changes</h3>"
  );
  assert.equal(text(d.querySelector('h1')), 'Single Cell Portal 隐私政策');
  assert.deepEqual([...d.querySelectorAll('h3')].map((h) => text(h)), ['信息收集', '公开上传的信息', '安全', '更改']);
  assert.match(text(d.querySelector('p')), /^布罗德研究所 Single Cell Portal 接收并存储/);
  assert.match(text(d.querySelector('p')), /标准 Google 登录过程中收集。$/);
});

test('隐私政策：说明段与联系方式模板整段翻译、内联链接保留', () => {
  const d = doc(
    "<p class='lead'>The following discloses our information gathering and dissemination practices for the Broad Institute Single Cell Portal website (" +
      "<a href='https://singlecell.broadinstitute.org/single_cell'>https://singlecell.broadinstitute.org/single_cell</a>)</p>" +
      "<p>If you have any questions about this privacy statement, the practices of this site, or your dealings with this site, you can contact us through " +
      "<a href='/help'>our help desk</a>.</p>"
  );
  const [p1, p2] = d.querySelectorAll('p');
  assert.match(text(p1), /^以下说明布罗德研究所 Single Cell Portal 网站（/);
  assert.equal(p1.querySelectorAll('a').length, 1);
  assert.equal(p1.querySelector('a').getAttribute('href'), 'https://singlecell.broadinstitute.org/single_cell');
  assert.match(text(p2), /^如果您对本隐私声明/);
  assert.match(text(p2), /联系我们。$/);
  assert.equal(text(p2.querySelector('a')), '我们的帮助台');
});

test('服务条款：小节标题与同意句', () => {
  const d = doc(
    "<h1>Terms of service</h1><h3>Will these Terms ever change?</h3><h3>What about my privacy?</h3>" +
      "<h3>Conduct</h3><h3>Registration</h3><h3>User Uploaded Content</h3>" +
      "<h3>Data Retention Policy</h3><h3>Storage Amount</h3><h3>Public Studies</h3>" +
      "<h3>Private Studies</h3><h3>Data Embargoes</h3>" +
      "<p>By accessing and using SCP, you agree that you will:</p>" +
      "<p>By accessing and using SCP, you agree that you will NOT:</p>"
  );
  assert.equal(text(d.querySelector('h1')), '服务条款');
  assert.deepEqual([...d.querySelectorAll('h3')].map((h) => text(h)),
    ['这些条款会变更吗？', '我的隐私如何处理？', '行为规范', '注册', '用户上传内容',
      '数据保留政策', '存储容量', '公开研究', '私有研究', '数据禁发期']);
  assert.deepEqual([...d.querySelectorAll('p')].map((p) => text(p)),
    ['访问并使用 SCP 即表示您同意：', '访问并使用 SCP 即表示您同意不会：']);
});

test('错误页：道歉句、支持邮箱句与 Terra 条款确认', () => {
  const d = doc(
    "<h3>We're sorry, but something went wrong.</h3>" +
      "<p>This error has been reported to support staff. If you require immediate assistance, please send an email to " +
      "<a href='mailto:scp-support@broadinstitute.zendesk.com'>scp-support@broadinstitute.zendesk.com</a></p>" +
      "<p>Please also ensure you have accepted the <a href='/tos'>Terra Terms of Service</a>.</p>"
  );
  assert.equal(text(d.querySelector('h3')), '抱歉，出现了问题。');
  const [p1, p2] = d.querySelectorAll('p');
  assert.match(text(p1), /^该错误已报告给支持人员。如需立即协助，请发送邮件至 scp-support@broadinstitute\.zendesk\.com$/);
  assert.match(text(p2), /^另请确认您已接受 Terra 服务条款/);
  assert.equal(p1.querySelectorAll('a').length, 1, '支持邮箱链接丢了');
});

test('下载弹窗：步骤、列名、总大小与按钮', () => {
  const d = doc(
    "<div class='download-modal'><h3><span class='badge'>1</span> Select files</h3>" +
      "<h3><span class='badge'>2</span> Get terminal command</h3>" +
      "<div>Files are downloaded via the command line. Once you confirm your files selection, you will get a command to use on your terminal.</div>" +
      "<table><thead><tr><td>Study name</td><td>Matrix</td><td>Clustering</td><td>Metadata</td><td>Project Manifest</td></tr></thead></table>" +
      "<div class='download-size-message'><label>Total size</label><span>1.2 GB</span></div>" +
      "<footer><button>CANCEL</button><button>BACK</button><button>DONE</button></footer></div>"
  );
  assert.deepEqual([...d.querySelectorAll('h3')].map((h) => text(h)), ['1 选择文件', '2 获取终端命令']);
  assert.match(text(d.querySelector('.download-modal div')), /^文件通过命令行下载/);
  assert.deepEqual([...d.querySelectorAll('thead td')].map((t) => text(t)),
    ['研究名称', '矩阵', '聚类', '元数据', '项目清单']);
  assert.equal(text(d.querySelector('.download-size-message label')), '总大小');
  assert.deepEqual([...d.querySelectorAll('footer button')].map((b) => text(b)), ['取消', '返回', '完成']);
});

test('下载弹窗：HCA 区段与列说明 tooltip', () => {
  const d = doc(
    "<div><span class='detail'>Available under the <a href='https://data.humancellatlas.org/about/data-use-agreement'>HCA Data Use Agreement</a></span>" +
      "<h4>Human Cell Atlas studies</h4>" +
      "<span title='Expression matrix files, including processed or raw count files.'></span></div>"
  );
  const detail = d.querySelector('.detail');
  assert.equal(text(detail), '遵循 HCA 数据使用协议');
  assert.equal(detail.querySelectorAll('a').length, 1);
  assert.equal(text(d.querySelector('h4')), '人类细胞图谱研究');
  assert.equal(d.querySelector('span[title]').getAttribute('title'), '表达矩阵文件，包括处理后或原始计数文件。');
});

test('研究列表主页：横幅与统计行', () => {
  const d = doc(
    "<p class='scp-banner-position'>Reducing barriers and accelerating single-cell research</p>" +
      "<span class='counts-text'>Featuring<br> <span class='green-count'>1073</span> studies<br> " +
      "<span class='blue-count'>90,212,802</span> cells</span>" +
      "<a class='btn btn-primary'>Browse collections</a><a>Search studies</a><a>Search genes</a>"
  );
  assert.equal(text(d.querySelector('.scp-banner-position')), '降低门槛，加速单细胞研究');
  const counts = text(d.querySelector('.counts-text'));
  assert.match(counts, /^已收录/);
  assert.match(counts, /1073 项研究/);
  assert.match(counts, /90,212,802 个细胞/);
  assert.deepEqual([...d.querySelectorAll('a')].map((a) => text(a)), ['浏览收藏集', '检索研究', '检索基因']);
});

test('基因检索页：标题、占位符与输入提示', () => {
  const d = doc(
    "<span class='text-search search-title'>Search by genes</span>" +
      "<input placeholder='Genes (e.g. &quot;PTEN NF2&quot;)'>" +
      "<div class='css-1jqq78o-placeholder'>Search gene(s) and find plots</div>"
  );
  assert.equal(text(d.querySelector('.search-title')), '按基因检索');
  assert.equal(d.querySelector('input').getAttribute('placeholder'), '基因（例如 "PTEN NF2"）');
  assert.equal(text(d.querySelector('.css-1jqq78o-placeholder')), '检索基因并查看图表');
});

test('属性通道：加载/更新/删除提示条与白皮书提示', () => {
  const d = doc(
    "<h4>Loading... Please Wait</h4><h4>Deleting... Please Wait</h4><h4>Updating Study... Please wait</h4>" +
      "<a title='Read the Single Cell Portal whitepaper!'></a>" +
      "<a title='Groups of studies with a common research theme'></a>" +
      "<a title='Learn about new Single Cell Portal features!'></a>"
  );
  assert.deepEqual([...d.querySelectorAll('h4')].map((h) => text(h)),
    ['正在加载…请稍候', '正在删除…请稍候', '正在更新研究…请稍候']);
  assert.deepEqual([...d.querySelectorAll('a')].map((a) => a.getAttribute('title')),
    ['阅读 Single Cell Portal 白皮书！', '围绕同一研究主题的研究合集', '了解 Single Cell Portal 的新功能！']);
  assert.deepEqual([...d.querySelectorAll('a')].map((a) => a.getAttribute('title')),
    ['阅读 Single Cell Portal 白皮书！', '围绕同一研究主题的研究合集', '了解 Single Cell Portal 的新功能！']);
});

test('故意保留：研究名、作者、物种、细胞类型、登录号与 DOI 原样留英文', () => {
  const d = doc(
    "<h1 class='study-header'>Human Choroid Plexus (Xenium Spatial Transcriptomics)</h1>" +
      "<a>SCP3885</a><span class='legend-label'>Arteriolar EC</span><span>Homo sapiens</span>" +
      "<p>Habib N, Li Y, Heidenreich M, Swiech L, Avraham-Davidi I, Trombetta J</p>" +
      "<a>DOI: 10.1126/science.aad7038</a><span class='detail'>subsample[100000]</span>" +
      "<span class='cluster-title'>UMAP</span>"
  );
  assert.equal(text(d.querySelector('.study-header')), 'Human Choroid Plexus (Xenium Spatial Transcriptomics)');
  assert.equal(text(d.querySelector('a')), 'SCP3885');
  assert.equal(text(d.querySelector('.legend-label')), 'Arteriolar EC');
  assert.equal(text(d.querySelector('span:not(.legend-label):not(.cluster-title):not(.detail)')), 'Homo sapiens');
  assert.match(text(d.querySelector('p')), /^Habib N, Li Y/);
  assert.equal(text(d.querySelector('.detail')), 'subsample[100000]');
  assert.equal(text(d.querySelector('.cluster-title')), 'UMAP');
});

test('长英文摘要整段保留（不做逐词翻译）', () => {
  const abstract =
    'Single cell RNA-Seq provides rich information about cell types and states. However, it is difficult to capture rare dynamic processes, such as adult neurogenesis, because isolation of rare neurons from adult tissue is challenging and markers for each phase are limited.';
  const d = doc('<p>' + abstract + '</p>');
  assert.equal(text(d.querySelector('p')), abstract);
});

test('不半中半英：译文里只允许专名与代码标识', () => {
  const allow = new Set([
    'single', 'cell', 'portal', 'hca', 'rest', 'api', 'webgl', 'https', 'get', 'webgl.org', 'get.webgl.org',
    'google', 'cloud', 'storage', 'platform', 'oauth', 'aes', 'id', 'mit', 'terra', 'harvard',
    'broad', 'institute', 'fastq', 'bam', 'bai', 'scp'
  ]);
  const bad = [];
  for (const [k, v] of Object.entries(dict.exact)) {
    const words = (v.match(/[A-Za-z][A-Za-z0-9.+#/-]*/g) || []).filter((w) => /^[a-z]/.test(w) && w.length > 2 && !allow.has(w.toLowerCase()));
    if (words.length) bad.push(k + ' => ' + v + ' ⟵ ' + words.join(','));
  }
  assert.deepEqual(bad, []);
});

test('SPA 重渲染：新挂的节点在 scan() 后补翻', () => {
  const { doc: d, engine } = render('<div id="content"></div>');
  const h = d.createElement('h3');
  h.textContent = 'Corresponding authors';
  d.querySelector('#content').appendChild(h);
  engine.scan();
  assert.equal(h.textContent, '通讯作者');
});

test('disable 后原文原样回来（含模板段与属性）', () => {
  const { doc: d, engine } = render(
    "<div class='results-totals'><strong>1073</strong> total studies found</div>" +
      "<input placeholder='Search'>"
  );
  assert.equal(text(d.querySelector('.results-totals')), '共找到 1073 项研究');
  assert.equal(d.querySelector('input').getAttribute('placeholder'), '检索');
  engine.disable();
  assert.equal(text(d.querySelector('.results-totals')), '1073 total studies found');
  assert.equal(d.querySelector('input').getAttribute('placeholder'), 'Search');
});