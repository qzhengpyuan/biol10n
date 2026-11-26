/**
 * Broad Single Cell Portal 应用内长尾补译回归（r73）。
 * 覆盖本轮实地取证到的界面文案：分面筛选浮层 / 检索帮助弹窗 / 文本检索说明 /
 * 研究页可视化卡片 / 差异表达面板 / 书签与下载弹窗 / 错误面板 / react-select 控件。
 * 站点栈按 config/sites.json 里 scp 登记的 dicts 取（common → spa → scp）。
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
  const dom = new JSDOM(html, { url: url || 'https://singlecell.broadinstitute.org/single_cell/app/studies' });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return { doc: dom.window.document, engine };
}
const doc = (html) => render(html).doc;

test('新增词条卫生：译文含汉字、键无中文、无自映射、无首尾空白', () => {
  const keys = [
    'Available Filters', 'Search for a filter', 'No options', 'Select one...', 'Select...',
    'No results found.', 'Faceted search', 'Text search', 'Expression visuals', 'Clustering visuals',
    'Customize', 'Save colors', 'Reset to defaults', 'Continuous color scale', 'Order expression by',
    'Scaled mean expression', 'Exploratory differential expression', 'No DE results for:',
    'Genes not found:', 'Corresponding cluster:', 'Associated annotation', 'Associated clustering',
    'All bookmarks', 'Bookmark name', 'No files selected', 'Dense matrix', 'Sparse matrix (.mtx)',
    'Ideogram Files', 'Coordinate Label File', 'Computational method', 'Something went wrong.',
    'Refresh the page', 'Request Exemption'
  ];
  for (const k of keys) {
    assert.ok(k in dict.exact, '缺词条: ' + k);
    assert.match(dict.exact[k], CJK, '译文不含汉字: ' + k);
    assert.equal(dict.exact[k], dict.exact[k].trim(), '译文有首尾空白: ' + k);
    assert.equal(k, k.trim(), '键有首尾空白: ' + k);
  }
});

test('分面筛选浮层：标题、筛选框占位符与 react-select 默认文案', () => {
  const d = doc(
    "<div class='filters-box-searchable'><div class='filters-box-header'><span>Available Filters</span></div>" +
      "<div class='filters-search-bar'><input placeholder='Search for a filter'></div>" +
      "<div class='menu-notice'>No options</div>" +
      "<div class='css-1jqq78o-placeholder'>Select one...</div>" +
      "<div class='css-1jqq78o-placeholder'>Select...</div></div>"
  );
  assert.equal(text(d.querySelector('.filters-box-header span')), '可用筛选');
  assert.equal(d.querySelector('input').getAttribute('placeholder'), '检索筛选条件');
  assert.deepEqual([...d.querySelectorAll('.menu-notice, .css-1jqq78o-placeholder')].map(text),
    ['无选项', '请选择一项', '选择……']);
});

test('react-select 已选条目：Remove <标签> 的 aria-label 走规则，标签本身不动', () => {
  const d = doc(
    "<div class='select__multi-value'><div aria-label='Remove X343 (section 1)'>X343 (section 1)</div>" +
      "<div aria-label='Remove Arteriolar EC'>Arteriolar EC</div></div>"
  );
  assert.deepEqual([...d.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label')),
    ['移除 X343 (section 1)', '移除 Arteriolar EC']);
  assert.deepEqual([...d.querySelectorAll('div > div')].map(text), ['X343 (section 1)', 'Arteriolar EC']);
});

test('检索帮助弹窗（分面检索）：标题与首段成句，正文长句整段留英文', () => {
  const d = doc(
    "<div class='modal-dialog'><h4 class='text-center'>Faceted search</h4><br>" +
      "<p>Single Cell Portal supports searching on facets of studies by ontology classifications. This lets users search for studies using metadata that may not appear in titles or descriptions.</p>" +
      "<p>For more detailed information, visit our <a href='https://singlecell.zendesk.com/hc/en-us/articles/360061006431-Search-Studies'>documentation</a>. " +
      "Study authors looking to make their studies more accessible can read our <a href='https://singlecell.zendesk.com/hc/en-us/articles/4406379107355-Metadata-powered-Advanced-Search'>metadata guide</a>.</p></div>"
  );
  assert.equal(text(d.querySelector('h4')), '分面检索');
  const [p1, p2] = d.querySelectorAll('p');
  assert.match(text(p1), /^Single Cell Portal 支持按本体分类对研究做分面检索/);
  // 弹窗正文里剩下的长句没有可整段替换的边界（文本直接挂在 modal div 下），
  // 整段保留英文，避免只翻链接文字变成半中半英。
  assert.match(text(p2), /^For more detailed information, visit our documentation\./);
  assert.equal(p2.querySelectorAll('a').length, 2, '链接丢了');
  assert.match(p2.querySelector('a').getAttribute('href'), /Search-Studies$/);
});

test('文本检索说明面板：标题与六条说明整句翻译', () => {
  const d = doc(
    "<div class='advanced-search-help'><h4 class='text-center'>Text search</h4>" +
      "<p>Use the search box below to perform a text-based search on study titles, descriptions, accessions, authors*, and metadata.</p>" +
      "<ul><li>A search without quotes (i.e. not wrapped in \") will return any study that contains any of the specified terms.</li>" +
      "<li>To search for an exact phrase within studies use quotes around the entire phrase like:</li>" +
      "<li>To search for studies that contain an exact phrase and/or the other search terms, combine single terms and quoted phrases like:</li></ul>" +
      "<p>* Structured data for authors is new in SCP, and many studies lack it, so author search results may be limited.</p>" +
      "<p>You can find studies directly by entering their accessions as terms: SCP1 SCP101 SCP1234</p></div>"
  );
  assert.equal(text(d.querySelector('h4')), '文本检索');
  const [p1, p2, p3] = d.querySelectorAll('p');
  assert.match(text(p1), /^用下方检索框对研究的标题、描述、登录号、作者\* 和元数据进行文本检索。$/);
  assert.deepEqual([...d.querySelectorAll('li')].map(text), [
    '不加引号的检索（即不用 " 包裹）会返回包含所列任一检索词的研究。',
    '若要检索研究中的某个精确短语，请用引号把整个短语包起来，例如：',
    '若要检索同时包含某个精确短语和/或其他检索词的研究，可以把单个检索词与带引号的短语组合起来，例如：'
  ]);
  assert.match(text(p2), /^\* SCP 中作者的结构化数据是新功能/);
  assert.match(text(p3), /^您可以直接把登录号作为检索词来查找研究：SCP1 SCP101 SCP1234$/);
});

test('研究页可视化卡片：表达图/聚类图有无状态与配色控件', () => {
  const d = doc(
    "<div class='summary'><span class='success'>Expression visuals</span>" +
      "<span class='success'>Clustering visuals</span>" +
      "<span class='warning'>No expression visuals</span>" +
      "<span class='warning'>No clustering visuals</span>" +
      "<a role='button' class='customize-color-palette'>Customize</a>" +
      "<a class='legend-color-picker-reset'>Reset to defaults</a>" +
      "<div class='legend-color-picker-actions'>Save colors</div>" +
      "<label>Continuous color scale</label></div>"
  );
  assert.deepEqual([...d.querySelectorAll('span')].map(text),
    ['表达图', '聚类图', '暂无表达图', '暂无聚类图']);
  assert.deepEqual([...d.querySelectorAll('a')].map(text), ['自定义', '恢复默认']);
  assert.equal(text(d.querySelector('.legend-color-picker-actions')), '保存配色');
  assert.equal(text(d.querySelector('label')), '连续色阶');
});

test('差异表达面板：探索性差异表达、无结果提示与关联聚类控件', () => {
  const d = doc(
    "<section><h5>Exploratory differential expression</h5>" +
      "<div class='no-results'>No DE results for:</div>" +
      "<div class='genes-missing'>Genes not found:</div>" +
      "<label class='labeled-select'>Scaled mean expression</label>" +
      "<label class='labeled-select'>Order expression by</label>" +
      "<label class='labeled-select'>Corresponding cluster:</label>" +
      "<label class='labeled-select'>Computational method</label>" +
      "<label class='labeled-select'>Associated annotation</label>" +
      "<label class='labeled-select'>Associated clustering</label>" +
      "<span class='hint'>Corresponding clusters</span></section>"
  );
  assert.equal(text(d.querySelector('h5')), '探索性差异表达');
  assert.equal(text(d.querySelector('.no-results')), '无差异表达结果：');
  assert.equal(text(d.querySelector('.genes-missing')), '未找到基因：');
  assert.deepEqual([...d.querySelectorAll('label')].map(text),
    ['缩放平均表达', '表达排序依据', '对应聚类：', '计算方法', '关联注释', '关联聚类']);
  assert.equal(text(d.querySelector('.hint')), '对应聚类');
});

test('书签与批量下载弹窗：标题、列名、文件类型与空态', () => {
  const d = doc(
    "<div class='bookmarks'><span class='action'>All bookmarks</span>" +
      "<label for='bookmark-name'>Bookmark name</label>" +
      "<div class='empty'>You do not have any saved bookmarks</div></div>" +
      "<div class='bookmark-form'><label>Expression visuals</label></div>" +
      "<div class='download-modal'><button class='btn btn-primary' disabled>No files selected</button>" +
      "<div class='file-types'><label>Dense matrix</label><label>Sparse matrix (.mtx)</label>" +
      "<label>Ideogram Files</label><label>Coordinate Label File</label></div>" +
      "<div class='text-center'>File download events</div></div>"
  );
  assert.equal(text(d.querySelector('.action')), '全部书签');
  assert.equal(text(d.querySelector('label[for=bookmark-name]')), '书签名称');
  assert.equal(text(d.querySelector('.empty')), '您还没有保存的书签');
  assert.match(text(d.querySelector('button')), /^未选择文件$/);
  assert.deepEqual([...d.querySelectorAll('.file-types label')].map(text),
    ['稠密矩阵', '稀疏矩阵（MTX）', '核型图文件', '坐标标签文件']);
  assert.equal(text(d.querySelector('.text-center')), '文件下载事件');
});

test('错误与空状态：出了问题、刷新页面、未找到结果与申请豁免', () => {
  const d = doc(
    "<div class='error-boundary alert-danger'><span class='font-italic'>Something went wrong.</span></div>" +
      "<div class='error-panel'><a class='sync-validation-refresh'>Refresh the page</a></div>" +
      "<div class='no-results'>No results found.</div>" +
      "<a class='action' href='https://singlecell.zendesk.com/hc/en-us/requests/new'>Request Exemption</a>" +
      "<div class='stat-hint' title='Users per month who viewed this study.'></div>"
  );
  assert.equal(text(d.querySelector('.font-italic')), '出现了问题。');
  assert.equal(text(d.querySelector('.sync-validation-refresh')), '刷新页面');
  assert.equal(text(d.querySelector('.no-results')), '未找到结果。');
  assert.equal(text(d.querySelector('.action')), '申请豁免');
  assert.equal(d.querySelector('[title]').getAttribute('title'), '每月查看该研究的用户数。');
});

test('故意保留：细胞类型、物种、算法名、参数与本体值原样留英文', () => {
  const d = doc(
    "<div><span class='legend-label'>Arteriolar EC</span><span>Homo sapiens</span>" +
      "<span class='cluster-title'>UMAP</span><span class='detail'>subsample[100000]</span>" +
      "<a>SCP3885</a><span>10x Xenium</span><span>MERFISH</span><span>abdomen</span>" +
      "<span>Uber-anatomy ontology</span><span>identity</span></div>"
  );
  assert.deepEqual([...d.querySelectorAll('span, a')].map(text),
    ['Arteriolar EC', 'Homo sapiens', 'UMAP', 'subsample[100000]', 'SCP3885',
      '10x Xenium', 'MERFISH', 'abdomen', 'Uber-anatomy ontology', 'identity']);
});

test('不半中半英：新增译文里只允许 SCP/API 这类专名与 .mtx 扩展名', () => {
  const allow = new Set(['scp', 'api', 'h5ad', 'mtx', 'gzip', 'webgl', 'hca', 'rest', 'terra']);
  const bad = [];
  for (const [k, v] of Object.entries(dict.exact)) {
    const bare = v.replace(/https?:\/\/\S+/g, ' ');
    const words = (bare.match(/[A-Za-z][A-Za-z0-9.+#/-]*/g) || [])
      .filter((w) => /^[a-z]/.test(w) && w.length > 2 && !allow.has(w.toLowerCase()));
    if (words.length) bad.push(k + ' => ' + v + ' ⟵ ' + words.join(','));
  }
  assert.deepEqual(bad, []);
});

test('disable 后新增段原文原样回来（含模板段与属性）', () => {
  const { doc: d, engine } = render(
    "<div class='filters-box-header'><span>Available Filters</span></div>" +
      "<input placeholder='Search for a filter'>" +
      "<div class='select__multi-value'><div aria-label='Remove X343 (section 1)'>X343 (section 1)</div></div>"
  );
  assert.equal(text(d.querySelector('.filters-box-header span')), '可用筛选');
  assert.equal(d.querySelector('input').getAttribute('placeholder'), '检索筛选条件');
  assert.equal(d.querySelector('[aria-label]').getAttribute('aria-label'), '移除 X343 (section 1)');
  engine.disable();
  assert.equal(text(d.querySelector('.filters-box-header span')), 'Available Filters');
  assert.equal(d.querySelector('input').getAttribute('placeholder'), 'Search for a filter');
  assert.equal(d.querySelector('[aria-label]').getAttribute('aria-label'), 'Remove X343 (section 1)');
});