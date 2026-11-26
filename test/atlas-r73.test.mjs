// atlas 长尾补译（2026-11-26）回归：
// 1) CZ CELLxGENE：数据集行的「Download Data」弹窗（标签页/基因矩阵/层级化数据格式/永久下载链接/数据集模式）、
//    CellGuide 首屏三段与搜索框占位符、CellGuide 整条标题规则；
// 2) Expression Atlas：检索结果页（Results for 标题、基线表达标签页、Show anatomograms、Filter your results、
//    因子标题「物种 — 因子」、「Showing N experiments:」、排序三项）与不翻清单；
// 3) Single Cell Portal：站壳 alt（logo）。
// 取证：直连 headless Chrome（CDP 9246）+ 注入私有构建，SPA 站用站内跳转进入 /datasets（直达渲染为空）。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8"));
const defaults = sites.defaults || {};
const read = (id) => JSON.parse(fs.readFileSync(path.join(root, "../dict", id + ".json"), "utf8"));
const books = { cellxgene: read("cellxgene"), gxa: read("gxa"), scp: read("scp") };
const CJK = /[\u3400-\u9fff]/;

// 按 sites.json 登记的册栈拼出运行时词库（子代理不改 sites.json，栈现读）
function stack(id) {
  const site = sites.sites.find((s) => s.id === id);
  const data = { exact: {}, rules: [], templates: [] };
  for (const bid of [...new Set(site.dicts || [id])]) {
    const p = path.join(root, "../dict", bid + ".json");
    if (!fs.existsSync(p)) continue;
    const d = JSON.parse(fs.readFileSync(p, "utf8"));
    Object.assign(data.exact, d.exact || {});
    data.rules = data.rules.concat(d.rules || []);
    data.templates = data.templates.concat(d.templates || []);
  }
  const cfg = {
    scope: site.scope || "",
    block: defaults.block || "",
    attrs: [...(defaults.attrs || []), ...(site.attrs || [])],
    funcWords: site.funcWords !== false,
    proseGuard: site.proseGuard !== false,
    proseMax: site.proseMax || 120,
    proseExempt: site.proseExempt || "",
    rescan: false
  };
  return { site, data, cfg };
}

function mount(id, html, url) {
  const { site, data, cfg } = stack(id);
  const dom = new JSDOM("<div id=\"root\">" + html + "</div>", { url });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site: cfg });
  engine.start();
  return dom.window.document;
}
const text = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : null);
const q = (doc, sel) => text(doc.querySelector(sel));

// ---------------- 结构 ----------------

test("三册 meta 与新增条目齐备", () => {
  assert.equal(books.cellxgene.meta.family, "cellxgene");
  assert.equal(books.gxa.meta.family, "ebi");
  assert.equal(books.scp.meta.family, "scp");
  const cxgWant = [
    "Download Data", "Browser", "Gene Matrix", "Download Details",
    "Hierarchical data format used to store annotated data matrices, typically for single-cell omics data, including gene expression, metadata, and embeddings.",
    "This download link permanently references", "this version",
    "of the dataset. If this dataset is updated, a new download link will be created that permanently references the next version of this dataset.",
    "The", "dataset schema",
    "describes the required metadata embedded in all datasets submitted to CZ CELLxGENE Discover.",
    "Search cell types or tissues", "CellGuide is a", "comprehensive resource for", "knowledge about cell types"
  ];
  for (const k of cxgWant) assert.ok(books.cellxgene.exact[k], "CELLxGENE 缺键：" + k);
  assert.ok(books.cellxgene.rules.some((r) => r.re === "^CellGuide Cell Types and Cell Tissues - CZ CELLxGENE$"), "缺 CellGuide 标题规则");
  const gxaWant = [
    "Results for", "Baseline expression", "Show anatomograms", "Filter your results",
    "Individual", "Sampling site", "Sampling time point", "Somite stage", "Clinical information",
    "Alphabetical order", "Expression rank", "By experiment type",
    "Transcriptomics", "RNA interference", "genetic modification", "Below cutoff", "High", "Medium", "Low"
  ];
  for (const k of gxaWant) assert.ok(books.gxa.exact[k], "GXA 缺键：" + k);
  for (const f of ["Organism part", "Developmental stage", "Cell type", "Sampling time point", "Strain"]) {
    if (f === "Strain") continue; // Strain 跨册取值不一致（菌株/品系），本轮按「宁可留英文」跳过
    assert.ok(books.gxa.rules.some((r) => r.re === "^(.+) — " + f + "$"), "缺因子标题规则：" + f);
  }
  assert.ok(books.gxa.rules.some((r) => r.re === "^Showing ([\\d,]+) experiments?:$"), "缺 Showing N experiments 规则");
  assert.ok(books.scp.exact["Single Cell Portal logo"] && books.scp.exact["Broad logo"], "SCP 缺 alt 条目");
});

// 只对本轮新增的键做卫生检查：旧册里存在 "x (um)": "x（μm）" 这类纯单位条目（有意不带中文），
// 不属于本轮范围，也不该被这条断言误伤。
const ADDED = {
  cellxgene: [
    "Download Data", "Browser", "Gene Matrix", "Download Details",
    "Hierarchical data format used to store annotated data matrices, typically for single-cell omics data, including gene expression, metadata, and embeddings.",
    "This download link permanently references", "this version",
    "of the dataset. If this dataset is updated, a new download link will be created that permanently references the next version of this dataset.",
    "The", "dataset schema",
    "describes the required metadata embedded in all datasets submitted to CZ CELLxGENE Discover.",
    "Search cell types or tissues", "CellGuide is a", "comprehensive resource for", "knowledge about cell types"
  ],
  gxa: [
    "Results for", "Baseline expression", "Show anatomograms", "Filter your results",
    "Individual", "Sampling site", "Sampling time point", "Somite stage", "Clinical information",
    "Alphabetical order", "Expression rank", "By experiment type",
    "Transcriptomics", "RNA interference", "genetic modification", "Below cutoff", "High", "Medium", "Low"
  ],
  scp: ["Single Cell Portal logo", "Broad logo"]
};

test("三册新增词条卫生：无中文键、译文含中文、非自映射、无 URL/邮箱、无首尾空白", () => {
  for (const [name, book] of Object.entries(books)) {
    for (const k of ADDED[name]) {
      const v = book.exact[k];
      assert.ok(v, name + " 缺键：" + k);
      assert.ok(!CJK.test(k), name + " 键含中文：" + k);
      assert.ok(CJK.test(v), name + " 译文无中文：" + k);
      assert.notEqual(k, v, name + " 自映射：" + k);
      assert.equal(k, k.trim(), name + " 键首尾空白：" + k);
      assert.equal(v, v.trim(), name + " 译文首尾空白：" + k);
      assert.ok(!/https?:\/\/|@[\w.-]+\.\w+/.test(v), name + " 译文含 URL/邮箱：" + k);
    }
    for (const r of book.rules || []) {
      assert.doesNotThrow(() => new RegExp(r.re), name + " 坏正则：" + r.re);
      assert.ok(/^\^/.test(r.re) && /\$$/.test(r.re), name + " 规则未锚定：" + r.re);
      assert.ok(CJK.test(r.to), name + " 规则译文无中文：" + r.re);
      // 捕获组数：先剔掉非捕获/断言前缀，再数左括号（比 r71 的「有 (? 就算 0 组」更准）
      const plain = r.re.replace(/\(\?[:=!]|\(\?<[=!]/g, "");
      const groups = (plain.match(/\(/g) || []).length;
      for (const m of r.to.matchAll(/\$(\d)/g)) assert.ok(Number(m[1]) >= 1 && Number(m[1]) <= groups, name + " 捕获组越界：" + r.re);
    }
  }
});
// ---------------- CELLxGENE：数据集行「下载」弹窗 ----------------

test("CELLxGENE 下载弹窗：标题/标签页/基因矩阵/格式说明/永久链接/数据集模式全部成中文，URL 与文件格式保留", () => {
  const doc = mount(
    "cellxgene",
    '<div role="dialog" data-testid="download-dialog">' +
      '<p class="dlg-title">Download Data</p>' +
      '<div role="tablist"><button role="tab" type="button"><span>Browser</span></button></div>' +
      '<label>名称</label>' +
      '<div class="name">A developmental blueprint for human retinal ganglion cell diversity and connectivity</div>' +
      '<label>Gene Matrix</label>' +
      '<span>.h5ad (AnnData v0.10)</span><span class="file-size">2 GB</span>' +
      '<p class="data-type-description">Hierarchical data format used to store annotated data matrices, typically for single-cell omics data, including gene expression, metadata, and embeddings.</p>' +
      '<label>Download Details</label>' +
      '<code>https://datasets.cellxgene.cziscience.com/b2689e0d-300d-4f4d-b156-65cd2e4dd619.h5ad</code>' +
      '<span>复制</span>' +
      '<p class="perm">This download link permanently references<b>this version</b></p>' +
      '<p class="perm2">of the dataset. If this dataset is updated, a new download link will be created that permanently references the next version of this dataset.</p>' +
      '<p class="schema">The<a href="#">dataset schema</a>describes the required metadata embedded in all datasets submitted to CZ CELLxGENE Discover.</p>' +
      '<button>取消</button><button>下载</button>' +
    "</div>",
    "https://cellxgene.cziscience.com/datasets"
  );
  assert.equal(q(doc, ".dlg-title"), "下载数据");
  assert.equal(q(doc, '[role="tab"]'), "浏览");
  assert.equal(q(doc, "label:nth-of-type(1)"), "名称");
  const labels = [...doc.querySelectorAll("label")].map((e) => text(e));
  assert.deepEqual(labels, ["名称", "基因矩阵", "下载详情"]);
  // 文件格式、体积、URL 是数据，保留原样
  assert.equal(q(doc, ".file-size"), "2 GB");
  assert.ok(q(doc, "code").includes("datasets.cellxgene.cziscience.com"));
  // 长句说明与拆成三个节点的永久链接句
  assert.equal(q(doc, ".data-type-description"),
    "用于存储带注释数据矩阵的层级化数据格式，常见于单细胞组学数据，包含基因表达、元数据与嵌入向量。");
  assert.equal(text(doc.querySelector(".perm")) + text(doc.querySelector(".perm2")),
    "此下载链接永久指向此版本的数据集。如果数据集更新，将生成一个永久指向该数据集下一版本的新下载链接。");
  // 「The + <a>dataset schema</a> + describes …」三段拼回一句完整中文
  assert.equal(q(doc, ".schema"),
    "该数据集模式说明了提交至 CZ CELLxGENE Discover 的所有数据集必须内嵌的元数据。");
  // 整块里不该再出现英文界面词
  const flat = text(doc.querySelector('[role="dialog"]'));
  for (const en of ["Download Data", "Gene Matrix", "Download Details", "Hierarchical data format", "This download link", "dataset schema"]) {
    assert.ok(!flat.includes(en), "弹窗仍残留英文：" + en);
  }
});

test("CELLxGENE 下载弹窗：数据值（数据集名、.h5ad、2 GB、URL）一律不翻", () => {
  const doc = mount(
    "cellxgene",
    '<div role="dialog"><div class="name">Tabula Sapiens - Lung</div>' +
      '<span class="f">.h5ad (AnnData v0.10)</span><span class="s">2 GB</span>' +
      '<span class="e">ENSG00000251423</span><span class="o">Homo sapiens</span></div>',
    "https://cellxgene.cziscience.com/datasets"
  );
  assert.equal(q(doc, ".name"), "Tabula Sapiens - Lung");
  assert.equal(q(doc, ".f"), ".h5ad (AnnData v0.10)");
  assert.equal(q(doc, ".s"), "2 GB");
  assert.equal(q(doc, ".e"), "ENSG00000251423");
  assert.equal(q(doc, ".o"), "Homo sapiens");
});

// ---------------- CELLxGENE：CellGuide 首屏与标题 ----------------

test("CELLxGENE CellGuide：首屏三行说明与搜索框占位符成中文", () => {
  const doc = mount(
    "cellxgene",
    '<div class="hero"><div class="l1">CellGuide is a</div>' +
      '<div class="l2">comprehensive resource for</div>' +
      '<div class="l3">knowledge about cell types</div></div>' +
      '<input id="cg-search" type="text" placeholder="Search cell types or tissues">' +
      '<label for="cg-search">Search cell types or tissues</label>',
    "https://cellxgene.cziscience.com/cellguide"
  );
  assert.equal(q(doc, ".l1"), "本指南是");
  assert.equal(q(doc, ".l2"), "一个全面的资源库，提供");
  assert.equal(q(doc, ".l3"), "细胞类型的知识");
  assert.equal(doc.querySelector("#cg-search").getAttribute("placeholder"), "搜索细胞类型或组织");
  assert.equal(q(doc, "label"), "搜索细胞类型或组织");
});

test("CELLxGENE 标题：CellGuide 整条命中规则", () => {
  const en = "CellGuide Cell Types and Cell Tissues - CZ CELLxGENE";
  const zh = "细胞指南：细胞类型与组织 - CZ CELLxGENE";
  const { site, data, cfg } = stack("cellxgene");
  const dom = new JSDOM("<!doctype html><html><head><title>" + en + "</title></head><body><p>Hello</p></body></html>", { url: "https://cellxgene.cziscience.com/cellguide" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site: cfg });
  engine.start();
  assert.equal(dom.window.document.title, zh);
});
// ---------------- Expression Atlas：检索结果页 ----------------

test("GXA 检索结果页：标题、标签页、控件、因子标题、排序与实验类型全部成中文", () => {
  const doc = mount(
    "gxa",
    '<h3 class="gxaSearchTermDescription">Results for <span class="searchterm">BRCA1</span></h3>' +
      '<a class="tab" href="#baseline">Baseline expression</a>' +
      '<label class="anatomogram"><input type="checkbox" checked>Show anatomograms</label>' +
      '<h4 class="filter-title">Filter your results</h4>' +
      '<h5 class="sp-h">Homo sapiens — Organism part</h5>' +
      '<h5 class="sp-dev">Oryctolagus cuniculus — Developmental stage</h5>' +
      '<label class="f-ind">Individual</label>' +
      '<label class="f-site">Sampling site</label>' +
      '<label class="f-time">Sampling time point</label>' +
      '<label class="f-somite">Somite stage</label>' +
      '<label class="f-clin">Clinical information</label>' +
      '<div class="showing">Showing 35 experiments:</div>' +
      '<div class="showing1">Showing 1 experiment:</div>' +
      '<button class="sort">By experiment type</button>' +
      '<a class="alpha">Alphabetical order</a>' +
      '<a class="rank">Expression rank</a>' +
      '<span class="etype">Transcriptomics</span>' +
      '<span class="lvl-h">High</span><span class="lvl-m">Medium</span><span class="lvl-l">Low</span>' +
      '<span class="lvl-b">Below cutoff</span>' +
      '<span class="etype-rnai">RNA interference</span>' +
      '<span class="etype-gm">genetic modification</span>',
    "https://www.ebi.ac.uk/gxa/search?geneQuery=BRCA1"
  );
  // 真实 DOM 里 "Results for " 与 <span>BRCA1</span> 之间那个空格是独立文本节点，替换后仍留着，
  // 中文与拉丁文之间带一个空格也符合排版习惯，故按实际渲染断言。
  assert.equal(q(doc, ".gxaSearchTermDescription"), "检索结果： BRCA1", "基因符号要留在检索标题里");
  assert.equal(q(doc, ".tab"), "基线表达");
  assert.equal(q(doc, ".anatomogram"), "显示人体图谱");
  assert.equal(q(doc, ".filter-title"), "筛选结果");
  // 物种拉丁名保留，因子名翻成中文（em dash 原样）
  assert.equal(q(doc, ".sp-h"), "Homo sapiens — 生物体部位");
  assert.equal(q(doc, ".sp-dev"), "Oryctolagus cuniculus — 发育阶段");
  assert.equal(q(doc, ".f-ind"), "个体");
  assert.equal(q(doc, ".f-site"), "采样部位");
  assert.equal(q(doc, ".f-time"), "采样时间点");
  assert.equal(q(doc, ".f-somite"), "体节期");
  assert.equal(q(doc, ".f-clin"), "临床信息");
  assert.equal(q(doc, ".showing"), "显示 35 个实验：");
  assert.equal(q(doc, ".showing1"), "显示 1 个实验：");
  assert.equal(q(doc, ".sort"), "按实验类型");
  assert.equal(q(doc, ".alpha"), "按字母顺序");
  assert.equal(q(doc, ".rank"), "按表达量排序");
  assert.equal(q(doc, ".etype"), "转录组学");
  assert.equal(q(doc, ".lvl-h"), "高");
  assert.equal(q(doc, ".lvl-m"), "中");
  assert.equal(q(doc, ".lvl-l"), "低");
  assert.equal(q(doc, ".lvl-b"), "低于阈值");
  assert.equal(q(doc, ".etype-rnai"), "RNA 干扰");
  assert.equal(q(doc, ".etype-gm"), "基因修饰");
});

test("GXA 不翻清单：物种拉丁名、实验名、因子组合、基因符号、化合物", () => {
  const keep = [
    "Homo sapiens", "Mus musculus", "Arabidopsis thaliana",
    "GTEX - organism part", "HDBR developing brain - 9 post conception weeks",
    "compound, genotype", "cell line, disease, passage", "genotype, infect, time",
    "BRCA1", "ENSG00000139618", "valproic acid", "zinc finger"
  ];
  const body = keep.map((s, i) => '<span class="k' + i + '">' + s + "</span>").join("");
  const doc = mount("gxa", body, "https://www.ebi.ac.uk/gxa/search");
  keep.forEach((s, i) => assert.equal(q(doc, ".k" + i), s, "不该翻：" + s));
});

// ---------------- Single Cell Portal：站壳 ----------------

test("SCP 站壳：导航与页脚成中文，logo alt 也翻，社媒品牌名保留", () => {
  const doc = mount(
    "scp",
    '<nav><a href="/single_cell">New features</a><a href="/single_cell/study">Create study</a>' +
      '<a href="/single_cell/sign_in">Sign in</a><a href="/single_cell/contact">Contact us</a>' +
      '<a href="/single_cell/browse_collections">Browse collections</a></nav>' +
      '<footer><a href="/privacy_policy">Privacy Policy</a><a href="/terms">Terms of Service</a>' +
      '<a href="/single_cell/portal_whitepaper">Portal whitepaper</a></footer>' +
      '<img class="logo-scp" src="scp.png" alt="Single Cell Portal logo">' +
      '<img class="logo-broad" src="broad.png" alt="Broad logo">' +
      '<a class="yt" href="#" aria-label="YouTube">YT</a>' +
      '<a class="bsky" href="#" aria-label="Bluesky">BS</a>',
    "https://singlecell.broadinstitute.org/single_cell"
  );
  const nav = [...doc.querySelectorAll("nav a")].map((e) => text(e));
  assert.deepEqual(nav, ["新功能", "创建研究", "登录", "联系我们", "浏览收藏集"]);
  const foot = [...doc.querySelectorAll("footer a")].map((e) => text(e));
  assert.deepEqual(foot, ["隐私政策", "服务条款", "门户白皮书"]);
  assert.equal(doc.querySelector(".logo-scp").getAttribute("alt"), "Single Cell Portal 徽标");
  assert.equal(doc.querySelector(".logo-broad").getAttribute("alt"), "Broad 徽标");
  // 社媒品牌名是专有名词，保持英文
  assert.equal(doc.querySelector(".yt").getAttribute("aria-label"), "YouTube");
  assert.equal(doc.querySelector(".bsky").getAttribute("aria-label"), "Bluesky");
});
