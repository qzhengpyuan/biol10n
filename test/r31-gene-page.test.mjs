// r31：NCBI Gene 页面界面残留（分区标题、侧栏 Links、Download 下拉、Tools 工具栏、Related information）
// 词条全部取自 https://www.ncbi.nlm.nih.gov/gene/672 真实渲染 DOM（2026-11-23 实测），不含基因符号/登录号/数据值。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const dict = read("../dict/gene.json");
const common = read("../dict/common.json");
const entries = Object.entries(dict.exact || {});
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;

const engineSrc = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(engineSrc + "; return createEngine;")();

// config/sites.json 的 ncbi-gene 实际装载：common + ncbi + gene + gene2 + ncbi-footer
function siteData() {
  const books = ["common", "ncbi", "gene", "gene2", "ncbi-footer"].map((n) => read("../dict/" + n + ".json"));
  const exact = {};
  const rules = [];
  for (const b of books) { Object.assign(exact, b.exact || {}); rules.push(...(b.rules || [])); }
  return { exact, rules, templates: [] };
}

function boot(html) {
  const dom = new JSDOM("<body>" + html + "</body>", { url: "https://www.ncbi.nlm.nih.gov/gene/672" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: siteData(),
    site: { scope: "body", block: "pre, code, kbd, samp, textarea" }
  });
  engine.start();
  return dom.window.document;
}

// 本轮新增的词条与期望译法（键均在渲染 DOM 原文中出现过）
const ADDED = {
  "Related pseudogene(s)": "相关假基因",
  "Potential readthrough": "潜在通读",
  "Suppressed Reference Sequence(s)": "已抑制的参考序列",
  "Review record(s) in Gene": "在 Gene 中查看评审记录",
  "Included gene:": "包含基因：",
  "My NCBI help": "My NCBI 帮助",
  "Download FASTA": "下载 FASTA",
  "Download GenBank Flat File": "下载 GenBank 平面文件",
  "Printer-Friendly PDF/SVG": "适合打印的 PDF/SVG",
  "Flip Strands": "翻转链",
  "Set Origin": "设置原点",
  "Sequence Text View": "序列文本视图",
  "BLAST and Primer Search": "BLAST 与引物检索",
  "Configure Track Hubs": "配置轨道集线器",
  "NCBI Recommended Track Sets": "NCBI 推荐轨道集",
  "My NCBI Track Collections": "我的 NCBI 轨道集合",
  "Go to position/range": "转到位置/范围",
  "Find on Sequence": "在序列中查找",
  "Enter sequence position or range": "输入序列位置或范围",
  "(possible range formats are 10k-20k, -20--10, -10k:-5, 5 to 515, -1m..1m):": "（可用范围格式：10k-20k、-20--10、-10k:-5、5 to 515、-1m..1m）："
};

test("r31：新增词条逐条落地且不重复 common 册已有的键", () => {
  const missing = [];
  for (const [en, zh] of Object.entries(ADDED)) {
    if (dict.exact[en] !== zh) missing.push(en + " => " + JSON.stringify(dict.exact[en]));
    if ((common.exact || {})[en] !== undefined) missing.push("与 common 重复: " + en);
  }
  assert.deepEqual(missing, []);
});

test("r31：新增词条键为英文、值含汉字、长度不超 80", () => {
  const bad = [];
  for (const en of Object.keys(ADDED)) {
    const zh = dict.exact[en];
    if (!zh || !zh.trim()) bad.push("空译文: " + en);
    if (CJK.test(en)) bad.push("键含中文: " + en);
    if (!CJK.test(zh)) bad.push("译文不含汉字: " + en + " => " + zh);
    if (en.length > 80) bad.push("键过长: " + en);
    if (zh.length > 60) bad.push("值过长（应改用 rules）: " + en + " => " + zh);
  }
  assert.deepEqual(bad, []);
});

test("r31：新增规则锚定、可编译，且命中计数与对话框说明句", () => {
  const added = dict.rules.slice(-3);
  for (const r of added) {
    assert.match(r.re, /^\^/, "未锚定: " + r.re);
    assert.match(r.re, /\$$/, "未以 $ 结尾: " + r.re);
    assert.doesNotThrow(() => new RegExp(r.re), "无法编译: " + r.re);
    assert.ok(CJK.test(r.to), "译文无汉字: " + r.re);
  }
  const doc = boot(
    "<dt>37 found</dt><dt>1 found</dt>" +
    "<div>Enter sequence position or range (possible range formats are 10k-20k, -20--10, -10k:-5, 5 to 515, -1m..1m)</div>" +
    "<div>Or enter name of feature, component, HGVS, SNP rs id, or sequence (nucleotide regexp with IUPAC equivalents, PROSITE patterns):</div>"
  );
  const text = doc.body.textContent;
  assert.match(text, /找到 37 项/);
  assert.match(text, /找到 1 项/);
  assert.ok(text.includes("输入序列位置或范围（可用范围格式：10k-20k、-20--10、-10k:-5、5 to 515、-1m..1m）"));
  assert.ok(text.includes("或输入特征、组件、HGVS、SNP rs 编号或序列的名称"));
  assert.ok(!text.includes("possible range formats"));
  assert.ok(!text.includes("Or enter name of feature"));
});

test("r31：分区标题与目录（Related pseudogene(s) / Potential readthrough / Suppressed）落地", () => {
  const doc = boot(
    "<div>" +
      '<h3><span class="ui-ncbitoggler-master-text">Related pseudogene(s)</span></h3>' +
      "<dt>1 found</dt><a>Review record(s) in Gene</a>" +
      '<h3><span class="ui-ncbitoggler-master-text">Potential readthrough</span></h3>' +
      "<dl><dt>Included gene:</dt><dd><a>BRCA1-OT1</a></dd></dl>" +
      "<h3>Suppressed Reference Sequence(s)</h3>" +
      '<ul class="portlet brieflink dis-table-of-contents"><li><a>Related pseudogene(s)</a></li><li><a>Potential readthrough</a></li></ul>' +
      "</div>"
  );
  const text = doc.body.textContent;
  for (const zh of ["相关假基因", "潜在通读", "已抑制的参考序列", "找到 1 项", "在 Gene 中查看评审记录", "包含基因："]) {
    assert.ok(text.includes(zh), "缺少译文: " + zh);
  }
  for (const en of ["Related pseudogene(s)", "Potential readthrough", "Suppressed Reference Sequence(s)", "Review record(s) in Gene", "Included gene:"]) {
    assert.ok(!text.includes(en), "英文残留: " + en);
  }
});

test("r31：侧栏 Links 列表与 Related information 链接落地", () => {
  const doc = boot(
    "<div>" +
      '<div class="portlet brieflink dis-general-info"><h3>一般信息</h3>' +
      "<a>关于 Gene</a><a>常见问题</a><a>FTP 站点</a><a>帮助</a><a>My NCBI help</a><a>NCBI 手册</a><a>统计</a></div>" +
      '<div class="portlet dis-related-info brieflink"><h3>相关信息</h3><a>三维结构</a><a>Book</a><a>SNP</a></div>' +
      '<div class="portlet brieflink dis-links-to-other-res"><h3>其他资源链接</h3><a>HGNC</a></div>' +
      "</div>"
  );
  const text = doc.body.textContent;
  assert.ok(text.includes("一般信息"));
  assert.ok(text.includes("My NCBI 帮助"));
  assert.ok(!text.includes("My NCBI help"));
  assert.ok(text.includes("相关信息"));
  assert.ok(text.includes("其他资源链接"));
});

test("r31：Download 下拉与 Tools 工具栏菜单落地", () => {
  const doc = boot(
    "<div>" +
      // 页面级 Download Datasets 下拉
      '<h4 class="download-datasets-popper">下载数据集</h4>' +
      "<ul><li>Gene Sequences (FASTA)</li><li>Transcript sequences (FASTA)</li><li>Protein sequences(FASTA)</li></ul>" +
      // 序列查看器 Download 菜单
      '<div class="x-menu"><span class="x-menu-item-text">Download FASTA</span>' +
      '<span class="x-menu-item-text">Download GenBank Flat File</span>' +
      '<span class="x-menu-item-text">下载轨道数据</span>' +
      '<span class="x-menu-item-text">Printer-Friendly PDF/SVG</span></div>' +
      // Tools 菜单
      '<div class="x-menu"><span class="x-menu-item-text">前往</span><span class="x-menu-item-text">检索</span>' +
      '<span class="x-menu-item-text">Flip Strands</span><span class="x-menu-item-text">标记</span>' +
      '<span class="x-menu-item-text">Set Origin</span><span class="x-menu-item-text">Sequence Text View</span>' +
      '<span class="x-menu-item-text">BLAST and Primer Search</span><span class="x-menu-item-text">偏好设置</span></div>' +
      // Tracks 菜单
      '<div class="x-menu"><span class="x-menu-item-text">配置轨道</span>' +
      '<span class="x-menu-item-text">Configure Track Hubs</span>' +
      '<span class="x-menu-item-text">NCBI Recommended Track Sets</span>' +
      '<span class="x-menu-item-text">My NCBI Track Collections</span></div>' +
      "</div>"
  );
  const text = doc.body.textContent;
  for (const zh of ["下载数据集", "下载 FASTA", "下载 GenBank 平面文件", "适合打印的 PDF/SVG", "翻转链", "设置原点", "序列文本视图", "BLAST 与引物检索", "配置轨道集线器", "NCBI 推荐轨道集", "我的 NCBI 轨道集合"]) {
    assert.ok(text.includes(zh), "缺少译文: " + zh);
  }
  for (const en of ["Download FASTA", "Download GenBank Flat File", "Printer-Friendly PDF/SVG", "Flip Strands", "Set Origin", "Sequence Text View", "BLAST and Primer Search", "Configure Track Hubs", "NCBI Recommended Track Sets", "My NCBI Track Collections"]) {
    assert.ok(!text.includes(en), "英文残留: " + en);
  }
});

test("r31：Go to / Find 对话框标题与提示落地", () => {
  const doc = boot(
    '<div class="x-window"><div class="x-title">Go to position/range</div>' +
    "<div>Enter sequence position or range</div>" +
    "<div>(possible range formats are 10k-20k, -20--10, -10k:-5, 5 to 515, -1m..1m):</div>" +
    "<a>确定</a><a>取消</a></div>" +
    '<div class="x-window"><div class="x-title">Find on Sequence</div>' +
    "<div>Enter sequence position or range (possible range formats are 10k-20k, -20--10, -10k:-5, 5 to 515, -1m..1m)</div>" +
    "<div>Or enter name of feature, component, HGVS, SNP rs id, or sequence (nucleotide regexp with IUPAC equivalents, PROSITE patterns):</div></div>"
  );
  const text = doc.body.textContent;
  assert.ok(text.includes("转到位置/范围"));
  assert.ok(text.includes("在序列中查找"));
  assert.ok(text.includes("输入序列位置或范围"));
  assert.ok(text.includes("（可用范围格式：10k-20k、-20--10、-10k:-5、5 to 515、-1m..1m）："));
  assert.ok(!text.includes("Go to position/range"));
  assert.ok(!text.includes("Find on Sequence"));
  assert.ok(!text.includes("possible range formats"));
});

test("r31：基因符号、登录号、坐标与项目号不被翻译", () => {
  const doc = boot(
    "<div><span>BRCA1</span><span>NM_000546.6</span><span>NC_000017.11</span>" +
      "<span>P38398.2</span><span>PRJNA270632</span><span>17q21.31</span>" +
      "<span>Furosemide</span><span>All MeSH Categories</span><span>bevonium [Supplementary Concept]</span></div>"
  );
  const spans = [...doc.querySelectorAll("span")].map((s) => s.textContent);
  assert.deepEqual(spans, ["BRCA1", "NM_000546.6", "NC_000017.11", "P38398.2", "PRJNA270632", "17q21.31", "Furosemide", "All MeSH Categories", "bevonium [Supplementary Concept]"]);
});
