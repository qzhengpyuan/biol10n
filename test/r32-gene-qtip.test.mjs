// r32：NCBI Gene 页面 ExtJS 工具栏气泡（data-qtip）补译回归。
// 原文全部取自 https://www.ncbi.nlm.nih.gov/gene/672 真实渲染 DOM（2026-11-23 CDP 实测；
// 点击「Configure tracks」「Tools」后工具栏里新出现的按钮也一并收）。不含基因名/登记号/数据值。
// 通道：站点配置 ncbi-gene.attrs 已声明 "data-qtip"，属性通道把属性值原样交给词表（命中才翻）。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const sites = read("../config/sites.json").sites;
const site = sites.find((s) => s.id === "ncbi-gene");
const gene = read("../dict/gene.json");
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;

const engineSrc = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(engineSrc + "; return createEngine;")();

// 与 config/sites.json 的 ncbi-gene.dicts 同序装载：common → ncbi → gene → gene2 → ncbi-footer
function siteData() {
  const exact = {};
  const rules = [];
  const templates = [];
  for (const n of site.dicts) {
    const b = read("../dict/" + n + ".json");
    Object.assign(exact, b.exact || {});
    rules.push(...(b.rules || []));
    templates.push(...(b.templates || []));
  }
  return { exact, rules, templates };
}

// —— 实测原文（data-qtip 的 value，逐字，含 HTML 与 &nbsp; 字面量）——
const Q_CHROM = '<b>NC_000017.11: Homo sapiens chromosome 17, GRCh38.p14 Primary Assembly</b><br><br>43,189,231&nbsp;-&nbsp;43,025,389<br>163,843&nbsp;nt&nbsp;shown,&nbsp;reverse complement';
const Q_GOTO = '<b>Go to position/range:</b><br>Range formats are 10k-20k, -20--10, -10k:-5, 5 to 515, -1m..1m <br><br><b>Search:</b><br>Feature name, component name, HGVS, SNP rs id, track info, or sequence (nucleotide regexp with IUPAC equivalents, PROSITE patterns)';

const QTIPS = [
  "Go back",
  "Back",
  Q_CHROM,
  Q_GOTO,
  "Pan left",
  "Pan right",
  "Zoom Out",
  "Zoom In",
  "Zoom To Sequence",
  'Switch ON mode "show All" for Gene tracks',
  "Switch to slim mode",
  "Open Entrez View",
  "Tools",
  "Configure tracks",
  "Download",
  "Reload View",
  "Help",
  "Feedback",
  "Configure current set of tracks",
  "Configure Remote Track Hubs and Tracks",
  "Go To Position/Range",
  "Search features, components or sequences",
  "Flip Sequence Strands",
  "Create New Sequence Text View"
];

// 应翻成什么（键=实测原文，值=期望译法）
const EXPECT = {
  "Go back": "返回",
  "Back": "返回",
  "Pan left": "向左平移",
  "Pan right": "向右平移",
  "Zoom Out": "缩小",
  "Zoom In": "放大",
  "Zoom To Sequence": "缩放到序列",
  'Switch ON mode "show All" for Gene tracks': "为 Gene 轨道开启“show All”模式",
  "Switch to slim mode": "切换到精简模式",
  "Open Entrez View": "打开 Entrez 视图",
  "Tools": "工具",
  "Configure tracks": "配置轨道",
  "Download": "下载",
  "Reload View": "重新加载视图",
  "Help": "帮助",
  "Feedback": "反馈",
  "Configure current set of tracks": "配置当前轨道集",
  "Configure Remote Track Hubs and Tracks": "配置远程轨道集线器与轨道",
  "Go To Position/Range": "转到位置/范围",
  "Search features, components or sequences": "检索特征、元件或序列",
  "Flip Sequence Strands": "翻转序列链",
  "Create New Sequence Text View": "新建序列文本视图",
  [Q_GOTO]: '<b>转到位置/范围：</b><br>范围格式：10k-20k、-20--10、-10k:-5、5 to 515、-1m..1m<br><br><b>检索：</b><br>特征名称、组件名称、HGVS、SNP rs 编号、轨道信息或序列（核苷酸正则表达式，支持 IUPAC 等价符号与 PROSITE 模式）'
};

// r32 新增到 dict/gene.json 的词条（8 条 exact + 1 条 rule）
const ADDED = {
  "Configure current set of tracks": "配置当前轨道集",
  "Configure Remote Track Hubs and Tracks": "配置远程轨道集线器与轨道",
  "Create New Sequence Text View": "新建序列文本视图",
  "Flip Sequence Strands": "翻转序列链",
  "Open Entrez View": "打开 Entrez 视图",
  "Search features, components or sequences": "检索特征、元件或序列",
  'Switch ON mode "show All" for Gene tracks': "为 Gene 轨道开启“show All”模式",
  "Switch to slim mode": "切换到精简模式"
};

/** 起 DOM：每个 qtip 挂在一个 .x-btn 样式的 <a> 上（ExtJS 工具栏按钮的真实形态） */
function boot(qtips, siteOverride, extraHtml) {
  const dom = new JSDOM("<!doctype html><html><body><div id=\"root\">" + (extraHtml || "") + "</div></body></html>", {
    url: "https://www.ncbi.nlm.nih.gov/gene/672"
  });
  const doc = dom.window.document;
  const rootEl = doc.getElementById("root");
  qtips.forEach((q, i) => {
    const a = doc.createElement("a");
    a.id = "b" + i;
    a.className = "x-btn x-unselectable x-box-item x-toolbar-item x-btn-default-toolbar-small";
    a.setAttribute("data-qtip", q);
    rootEl.appendChild(a);
  });
  const engine = createEngine({
    document: doc,
    window: dom.window,
    data: siteData(),
    site: siteOverride || site
  });
  engine.start();
  return { dom, doc, engine };
}

const qtipOf = (doc, i) => doc.getElementById("b" + i).getAttribute("data-qtip");

test("r32 站点配置：ncbi-gene 把 data-qtip 加进属性通道，且不是默认通道", () => {
  assert.ok(site, "config/sites.json 里应有 ncbi-gene 站点");
  assert.ok((site.attrs || []).includes("data-qtip"), "ncbi-gene.attrs 应声明 data-qtip");
  // 属性通道是追加：默认的 title/aria-label/alt 仍然要在（这里直接验行为，见下一条）
  const { doc } = boot(["Pan left"]);
  assert.equal(qtipOf(doc, 0), "向左平移");
});

test("r32 词库：8 条 exact 在 gene.json 里，值与其它册无冲突，译文是中文", () => {
  for (const [en, zh] of Object.entries(ADDED)) {
    assert.equal(gene.exact[en], zh, "词条缺失或被改动: " + en);
    assert.ok(CJK.test(zh), "译文要有汉字: " + zh);
    assert.notEqual(en, zh, "自映射: " + en);
    assert.equal(zh, zh.trim(), "值首尾不能有空白: " + en);
    assert.ok(zh.length <= 60, "exact 值超过 60 字符（该改用 rules）: " + en);
    // 同一站点装载的其它册不能有同名键（会触发 dict-lint 跨册冲突 / 抢译）
    for (const n of ["common", "ncbi", "gene2", "ncbi-footer"]) {
      const other = read("../dict/" + n + ".json");
      assert.equal((other.exact || {})[en], undefined, "与 " + n + " 册重复: " + en);
    }
  }
});

test("r32 词库：长帮助句（HTML 气泡）由一条锚定规则整串翻，不靠分段拼", () => {
  const rule = (gene.rules || []).find((r) => r.re.indexOf("Go to position/range:</b>") >= 0);
  assert.ok(rule, "缺少长帮助句规则");
  const re = new RegExp(rule.re);
  // 整串命中（实测原文，含 "1m..1m <br>" 之间的空格）
  assert.match(Q_GOTO, re);
  assert.match(rule.to, CJK, "规则译文要是中文");
  // 反例：同一条工具栏上的坐标气泡不能被这条规则吃掉
  assert.doesNotMatch(Q_CHROM, re);
  // 反例：去掉 <b> 的纯文本片段不该命中（规则只认完整气泡）
  assert.doesNotMatch("Go to position/range: Range formats are 10k-20k", re);
});

test("r32 属性通道：按站点配置（含新 attrs）逐条翻真实 data-qtip 原文", () => {
  const { doc } = boot(QTIPS);
  for (const q of QTIPS) {
    const i = QTIPS.indexOf(q);
    if (q === Q_CHROM) continue; // 坐标气泡保持英文，见下一条用例
    assert.equal(qtipOf(doc, i), EXPECT[q], "未按预期翻译: " + q.slice(0, 60));
  }
});

test("r32 不翻清单：坐标/组装/nt 数气泡与登记号原样保留", () => {
  const { doc } = boot([Q_CHROM, "NC_000017.11", "43,189,231 - 43,025,389", "163,843 nt shown, reverse complement"]);
  // 染色体气泡：组装名、坐标区间、nt 数都是数据，整串不翻
  assert.equal(qtipOf(doc, 0), Q_CHROM);
  // 裸登记号 / 纯坐标串：没有可翻的界面词，保持英文
  assert.equal(qtipOf(doc, 1), "NC_000017.11");
  assert.equal(qtipOf(doc, 2), "43,189,231 - 43,025,389");
  // 数据句（nt shown, reverse complement）不在词表里，保持英文
  assert.equal(qtipOf(doc, 3), "163,843 nt shown, reverse complement");
});

test("r32 译法的英文残留是有意保留：轨道名 Gene 与模式字面量 show All、范围格式里的 5 to 515", () => {
  const { doc } = boot(QTIPS);
  const onMode = qtipOf(doc, QTIPS.indexOf('Switch ON mode "show All" for Gene tracks'));
  // 轨道名与「show All」是界面里的枚举字面量，不硬翻（翻了会和轨道模式下拉框里的值对不上）
  assert.match(onMode, /Gene/);
  assert.match(onMode, /show All/);
  assert.equal(onMode, "为 Gene 轨道开启“show All”模式");
  const goto = qtipOf(doc, QTIPS.indexOf(Q_GOTO));
  // 范围示例保留原写法（与既有 placeholder 规则「5 to 515」一致），只把外壳翻成中文
  assert.match(goto, /10k-20k/);
  assert.match(goto, /5 to 515/);
  assert.ok(!/Range formats are|Feature name, component name|Search:/.test(goto), "外壳句必须全翻: " + goto);
});

test("r32 不声明 attrs 时 data-qtip 不动（翻译确实来自新属性通道，不是 title 通道）", () => {
  const noAttr = Object.assign({}, site);
  delete noAttr.attrs;
  const { doc } = boot(
    ["Pan left", "Zoom In", 'Switch ON mode "show All" for Gene tracks'],
    noAttr,
    '<a id="t0" title="Pan left"></a>'
  );
  assert.equal(qtipOf(doc, 0), "Pan left", "站点没声明 data-qtip 时属性通道不该碰它");
  assert.equal(qtipOf(doc, 1), "Zoom In");
  assert.equal(qtipOf(doc, 2), 'Switch ON mode "show All" for Gene tracks');
  // 同一次运行里默认通道照旧：title 仍然被翻（说明上面没翻不是因为引擎没跑）
  assert.equal(doc.getElementById("t0").getAttribute("title"), "向左平移");
});

test("r32 运行时挂载：ExtJS 在按钮建好后 setAttribute('data-qtip') 也能翻（MutationObserver 属性过滤）", async () => {
  const { doc, engine } = boot([]);
  const rootEl = doc.getElementById("root");
  const a = doc.createElement("a");
  a.className = "x-btn";
  rootEl.appendChild(a);
  // 先挂节点、后补气泡（ExtJS 的 tooltip 注册顺序），走 attributes 分支
  a.setAttribute("data-qtip", "Pan left");
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(a.getAttribute("data-qtip"), "向左平移");
  // 后来插入的新按钮（childList 分支）同样要翻
  const b = doc.createElement("a");
  b.className = "x-btn";
  b.setAttribute("data-qtip", "Zoom To Sequence");
  rootEl.appendChild(b);
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(b.getAttribute("data-qtip"), "缩放到序列");
  assert.equal(engine.stats.attrs > 0, true, "属性通道应有命中计数");
});

test("r32 关闭翻译后 data-qtip 还原英文（可逆，不污染页面）", () => {
  const { doc, engine } = boot(["Pan left", Q_GOTO]);
  assert.equal(qtipOf(doc, 0), "向左平移");
  engine.restore();
  assert.equal(qtipOf(doc, 0), "Pan left");
  assert.equal(qtipOf(doc, 1), Q_GOTO);
});
