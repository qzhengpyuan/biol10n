// NCBI 长尾补译：PubChem 周期表 / 文档索引、SRA 首页与运行页、PubMed 高级检索「刷新」句
// 口径：只翻界面标签（导航、表头、字段名、按钮、tooltip/title/aria-label）；
// 元素符号、登录号、物种拉丁名、平台名、文件格式、测序统计数值按设计保留英文。
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
const pubchemSite = sites.find((s) => s.id === "pubchem");
const geoSite = sites.find((s) => s.id === "ncbi-geo");
const pubmedSite = sites.find((s) => s.id === "pubmed");
const book = (n) => JSON.parse(fs.readFileSync(path.join(root, "../dict/" + n + ".json"), "utf8"));
const pubchem = book("pubchem-dbgap");
const geoExtra = book("geo-extra");
const ncbi = book("ncbi");
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;

function loadDicts(site) {
  const exact = {}; const rules = []; const templates = [];
  for (const n of site.dicts) {
    const d = book(n);
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
    templates.push(...(d.templates || []));
  }
  return { exact, rules, templates };
}

function run(html, site, url) {
  const dom = new JSDOM(html, { url });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: loadDicts(site),
    site
  });
  engine.start();
  return dom.window.document;
}

const pub = (html) => run(html, pubchemSite, "https://pubchem.ncbi.nlm.nih.gov/periodic-table/");
const sra = (html) => run(html, geoSite, "https://www.ncbi.nlm.nih.gov/sra/SRR000001");
const pm = (html) => run(html, pubmedSite, "https://pubmed.ncbi.nlm.nih.gov/advanced/");
const text = (el) => String(el.textContent || "").replace(/\s+/g, " ").trim();

// ---------------- 结构校验 ----------------

const NEW_PUBCHEM = {
  "MENU": "菜单",
  "TABLE": "表格",
  "LIST": "列表",
  "GAME": "游戏",
  "Display Property/Trend": "显示属性/趋势",
  "Plot": "绘制图表",
  "Chemical Group / Family": "化学组 / 族",
  "Metal / Metalloid / Nonmetal": "金属 / 类金属 / 非金属",
  "Standard State": "标准状态",
  "Electron Configuration": "电子构型",
  "Oxidation States": "氧化态",
  "Electronegativity (Pauling Scale)": "电负性（鲍林标度）",
  "Year Discovered": "发现年份",
  "Atomic Weight": "原子量",
  "Atomic Weight, u": "原子量，u",
  "Atomic Radius (van der Waals), pm": "原子半径（范德华），pm",
  "Ionization Energy, eV": "电离能，eV",
  "Electron Affinity, eV": "电子亲和能，eV",
  "Melting Point, K": "熔点，K",
  "Boiling Point, K": "沸点，K",
  "Density, g/cm³": "密度，g/cm³",
  "Periodic table background and properties": "元素周期表背景与性质",
  "Display Property": "显示属性",
  "Atomic Radius (van der Waals)": "原子半径（范德华）",
  "Ionization Energy": "电离能",
  "Electron Affinity": "电子亲和能",
  "Melting Point": "熔点",
  "Boiling Point": "沸点",
  "Density": "密度",
  "Exploring Property Trends": "探索性质趋势",
  "Chemical Element Data in PubChem": "PubChem 中的化学元素数据",
  "Printable Images of the Periodic Table": "元素周期表的可打印图片",
  "Why Arrange Elements in a Table?": "为什么把元素排列成表格？",
  "Does the Modern Periodic Table Change? If So, How and Who Does That?": "现代元素周期表会变化吗？如果会，怎样变化、由谁负责？",
  "Explore PubChem Documentation": "浏览 PubChem 文档",
  "ALL DOCS": "全部文档",
  "All docs": "全部文档",
  "Search Documents": "检索文档",
  "Data Organization": "数据组织",
  "Search and Tools": "检索与工具",
  "Bioactivity and Targets": "生物活性与靶点",
  "Submissions Overview": "提交概览",
  "Policy and Guidelines": "政策与指南"
};

const NEW_GEO = {
  "SRA - Now available on the cloud": "SRA 现已上云",
  "How to submit": "如何提交",
  "How to search and download": "如何检索与下载",
  "How to use SRA in the cloud": "如何在云上使用 SRA",
  "Submit to SRA": "提交至 SRA",
  "Tools and Software": "工具与软件",
  "Download SRA Toolkit": "下载 SRA Toolkit",
  "SRA Toolkit Documentation": "SRA Toolkit 文档",
  "SRA Run Browser": "SRA 运行浏览器",
  "Related Resources": "相关资源",
  "Submission Portal": "提交门户",
  "dbGaP Home": "dbGaP 主页",
  "Send results to Run selector": "将结果发送至 Run selector",
  "View results as an expanded interactive table using the RunSelector.": "使用 RunSelector 以可展开的交互式表格查看结果。",
  "All experiments": "全部实验",
  "All runs": "全部运行",
  "Design:": "设计：",
  "none provided": "未提供",
  "Submitted by:": "提交者：",
  "show Abstract": "显示摘要",
  "hide Abstract": "隐藏摘要",
  "Library:": "文库：",
  "Instrument:": "仪器：",
  "Layout:": "布局：",
  "Spot descriptor:": "测序点描述符：",
  "Runs:": "运行：",
  "forward": "正向",
  "reverse": "反向",
  "Run": "运行",
  "# of Spots": "测序点数",
  "# of Bases": "碱基数",
  "Links to BioProject": "BioProject 链接",
  "BioSample links": "BioSample 链接",
  "Full text articles in PMC": "PMC 中的全文文章",
  "Links to PubMed articles": "PubMed 文章链接",
  "Links to Taxonomy": "分类学链接",
  "Link to BioProject": "BioProject 链接",
  "Link to SRA Study": "SRA 研究链接",
  "Link to BioSample": "BioSample 链接",
  "Technical Read, Adapter": "技术读段，接头",
  "Application Read, Forward": "应用读段，正向",
  "Technical Read, Linker": "技术读段，连接子",
  "Application Read, Reverse": "应用读段，反向",
  "All runs for this experiment": "此实验的全部运行"
};

test("新增条目逐条在册（PubChem 周期表/文档索引、SRA 首页与运行页）", () => {
  const missPub = Object.entries(NEW_PUBCHEM).filter(([k, v]) => pubchem.exact[k] !== v);
  const missGeo = Object.entries(NEW_GEO).filter(([k, v]) => geoExtra.exact[k] !== v);
  assert.deepEqual(missPub, [], "pubchem-dbgap 缺条目或被改值");
  assert.deepEqual(missGeo, [], "geo-extra 缺条目或被改值");
  assert.ok(Object.keys(pubchem.exact).length >= 730);
  assert.ok(Object.keys(geoExtra.exact).length >= 190);
});

test("条目卫生：键无中文/无首尾空白，值含中文、非自映射、不含 URL 与邮箱", () => {
  const bad = [];
  for (const [bookId, d] of Object.entries({ "pubchem-dbgap": pubchem, "geo-extra": geoExtra })) {
    for (const [k, v] of Object.entries(d.exact)) {
      if (CJK.test(k)) bad.push(bookId + " 键含中文: " + k);
      if (k !== k.trim()) bad.push(bookId + " 键首尾空白: " + JSON.stringify(k));
      if (v !== v.trim()) bad.push(bookId + " 值首尾空白: " + k);
      // 与 dict-lint 同口径：纯标点/纯品牌的值允许（如 "SMILES:" → "SMILES："），只要不是原样照抄
      if (!CJK.test(v) && !/[：，。、；！？（）「」]/.test(v)) bad.push(bookId + " 值无中文: " + k);
      if (k === v) bad.push(bookId + " 自映射: " + k);
      if (/https?:\/\/|[\w.+-]+@[\w-]+\.\w+/.test(v)) bad.push(bookId + " 值含 URL/邮箱: " + k);
    }
  }
  assert.deepEqual(bad, []);
});

test("rules 必须 ^…$ 锚定、$n 引用的捕获组真实存在；templates 占位符 1..N 连续", () => {
  for (const [bookId, d] of Object.entries({ "pubchem-dbgap": pubchem, "geo-extra": geoExtra })) {
    for (const r of d.rules || []) {
      assert.ok(r.re.startsWith("^") && r.re.endsWith("$"), bookId + " 规则未锚定: " + r.re);
      const n = (r.re.match(/(?<!\\)\((?!\?)/g) || []).length;
      const used = [...r.to.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
      for (const u of used) assert.ok(u >= 1 && u <= n, bookId + " 规则引用了不存在的捕获组 $" + u + ": " + r.re);
      assert.ok(!/https?:\/\//.test(r.to), bookId + " 规则译文含 URL: " + r.re);
    }
    for (const t of d.templates || []) {
      const patNums = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
      const zhNums = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
      const uniq = [...new Set(patNums)].sort((a, b) => a - b);
      assert.deepEqual(uniq, uniq.map((_, i) => i + 1), bookId + " 模板占位符不连续: " + t.pat);
      assert.deepEqual([...new Set(zhNums)].sort((a, b) => a - b), uniq, bookId + " 模板中英占位符不对应: " + t.pat);
      assert.ok(!CJK.test(t.pat), bookId + " 模板 pat 含中文: " + t.pat);
      assert.ok(CJK.test(t.zh), bookId + " 模板译文无中文: " + t.pat);
      assert.ok(t.pat.length <= 2200, bookId + " 模板过长: " + t.pat.slice(0, 40));
    }
  }
});

// ---------------- PubChem：元素周期表 ----------------

test("PubChem 周期表：导航页签与属性选择器译成中文", () => {
  const doc = pub(
    '<main><nav><a href="/">MENU</a><a>TABLE</a><a>LIST</a><a>GAME</a></nav>' +
    '<div><label>Display Property/Trend</label><select><option>Atomic Weight</option><option>Density, g/cm³</option></select></div>' +
    '<div><span>Plot</span></div></main>'
  );
  const got = [...doc.querySelectorAll("a, label, option, span")].map(text).join("|");
  for (const zh of ["菜单", "表格", "列表", "游戏", "显示属性/趋势", "原子量", "密度，g/cm³", "绘制图表"]) {
    assert.ok(got.includes(zh), "缺译文: " + zh + " 实际: " + got);
  }
  assert.ok(!/MENU|TABLE|GAME|Atomic Weight|Display Property/.test(got), "仍有英文标签: " + got);
});

test("PubChem 周期表：趋势图例与图注标签逐个翻译，单位保留", () => {
  const doc = pub(
    '<article><section><i>Display Property</i>' +
    '<div><span>Atomic Radius (van der Waals)</span><span>Ionization Energy</span><span>Electron Affinity</span>' +
    '<span>Melting Point</span><span>Boiling Point</span><span>Density</span></div>' +
    '<h2>Exploring Property Trends</h2><h2>Chemical Element Data in PubChem</h2>' +
    '<h2>Printable Images of the Periodic Table</h2>' +
    '<h2>Why Arrange Elements in a Table?</h2>' +
    '<h2>Does the Modern Periodic Table Change? If So, How and Who Does That?</h2></section></article>'
  );
  const got = [...doc.querySelectorAll("i, span, h2")].map(text).join("|");
  for (const zh of ["显示属性", "原子半径（范德华）", "电离能", "电子亲和能", "熔点", "沸点", "密度",
    "探索性质趋势", "PubChem 中的化学元素数据", "元素周期表的可打印图片",
    "为什么把元素排列成表格？", "现代元素周期表会变化吗？如果会，怎样变化、由谁负责？"]) {
    assert.ok(got.includes(zh), "缺译文: " + zh + " 实际: " + got);
  }
  assert.ok(!/Exploring Property Trends|Atomic Radius|Boiling Point/.test(got), "仍有英文: " + got);
});

test("PubChem 周期表：元素符号、原子量与单位是数据，保持原样", () => {
  const doc = pub(
    '<main><div class="grid"><span>H</span><span>He</span><span>Li</span><span>Cl</span></div>' +
    '<div><span>1.008 u</span><span>35.45 u</span><span>g/cm³</span></div></main>'
  );
  const got = [...doc.querySelectorAll("span")].map(text);
  assert.deepEqual(got, ["H", "He", "Li", "Cl", "1.008 u", "35.45 u", "g/cm³"]);
});

// ---------------- PubChem：文档索引 ----------------

test("PubChem 文档索引：页头、章节标题与检索框 placeholder 翻译", () => {
  const doc = pub(
    '<main><h1>Explore PubChem Documentation</h1><a>ALL DOCS</a>' +
    '<input class="search" placeholder="Search Documents">' +
    '<button title="All docs">x</button>' +
    '<h2>Data Organization</h2><h2>Search and Tools</h2><h2>Bioactivity and Targets</h2>' +
    '<h2>Submissions Overview</h2><h2>Policy and Guidelines</h2></main>'
  );
  assert.equal(text(doc.querySelector("h1")), "浏览 PubChem 文档");
  assert.equal(text(doc.querySelector("a")), "全部文档");
  assert.equal(doc.querySelector("input").getAttribute("placeholder"), "检索文档", "placeholder 属性通道没接通");
  assert.equal(doc.querySelector("button").getAttribute("title"), "全部文档", "title 属性通道没接通");
  const heads = [...doc.querySelectorAll("h2")].map(text);
  assert.deepEqual(heads, ["数据组织", "检索与工具", "生物活性与靶点", "提交概览", "政策与指南"]);
});

// ---------------- SRA：首页导航 ----------------

test("SRA 首页：提交/检索/云/工具四组入口与相关资源整体翻译", () => {
  const doc = sra(
    '<div id="doc"><h3>SRA - Now available on the cloud</h3><ul>' +
    '<li><a>How to submit</a></li><li><a>How to search and download</a></li>' +
    '<li><a>How to use SRA in the cloud</a></li><li><a>Submit to SRA</a></li></ul>' +
    '<h3>Tools and Software</h3><ul><li><a>Download SRA Toolkit</a></li>' +
    '<li><a>SRA Toolkit Documentation</a></li><li><a>SRA Run Browser</a></li></ul>' +
    '<h3>Related Resources</h3><ul><li><a>Submission Portal</a></li><li><a>dbGaP Home</a></li></ul></div>'
  );
  const got = [...doc.querySelectorAll("h3, a")].map(text).join("|");
  for (const zh of ["SRA 现已上云", "如何提交", "如何检索与下载", "如何在云上使用 SRA", "提交至 SRA",
    "工具与软件", "下载 SRA Toolkit", "SRA Toolkit 文档", "SRA 运行浏览器", "相关资源",
    "提交门户", "dbGaP 主页"]) {
    assert.ok(got.includes(zh), "缺译文: " + zh + " 实际: " + got);
  }
  assert.ok(!/How to submit|Tools and Software|Related Resources/.test(got), "仍有英文: " + got);
});

// ---------------- SRA：运行记录页 ----------------

test("SRA 运行页：设计/提交者/文库/仪器/布局与摘要开关逐项翻译", () => {
  const doc = sra(
    '<div id="doc"><dl><dt>Design:</dt><dd>none provided</dd>' +
    '<dt>Submitted by:</dt><dd>454 Life Sciences (454MSC)</dd>' +
    '<dt>Library:</dt><dd>SID2748</dd><dt>Instrument:</dt><dd>454 GS FLX</dd>' +
    '<dt>Layout:</dt><dd>PAIRED</dd><dt>Spot descriptor:</dt><dd>forward</dd><dd>reverse</dd>' +
    '<dt>Runs:</dt><dd>7</dd></dl>' +
    '<a>show Abstract</a><a>hide Abstract</a>' +
    '<h4>Links to BioProject</h4><h4>BioSample links</h4><h4>Full text articles in PMC</h4>' +
    '<h4>Links to PubMed articles</h4><h4>Links to Taxonomy</h4></div>'
  );
  const got = [...doc.querySelectorAll("dt, a, h4")].map(text).join("|");
  for (const zh of ["设计：", "提交者：", "文库：", "仪器：", "布局：", "测序点描述符：", "运行：",
    "显示摘要", "隐藏摘要", "BioProject 链接", "BioSample 链接", "PMC 中的全文文章",
    "PubMed 文章链接", "分类学链接"]) {
    assert.ok(got.includes(zh), "缺译文: " + zh + " 实际: " + got);
  }
  const dds = [...doc.querySelectorAll("dd")].map(text);
  assert.equal(dds[0], "未提供");
  assert.deepEqual(dds.slice(5, 7), ["正向", "反向"], "spot descriptor 方向标签应译成正向/反向");
  assert.ok(dds.includes("454 Life Sciences (454MSC)"), "提交机构名必须保留");
  assert.ok(dds.includes("454 GS FLX"), "仪器型号必须保留");
  assert.ok(dds.includes("PAIRED"), "受控词表取值 PAIRED 保持原样");
});

test("SRA 运行页：表头与图标 title 走属性通道", () => {
  const doc = sra(
    '<table><thead><tr><th>Run</th><th># of Spots</th><th># of Bases</th></tr></thead>' +
    '<tbody><tr><td>SRR000001</td><td>1.1M</td><td>80.6M</td></tr></tbody></table>' +
    '<span title="Technical Read, Adapter">x</span><span title="Application Read, Forward">y</span>' +
    '<span title="Technical Read, Linker">z</span><span title="Application Read, Reverse">w</span>' +
    '<a title="All runs for this experiment">+</a>'
  );
  const ths = [...doc.querySelectorAll("th")].map(text);
  assert.deepEqual(ths, ["运行", "测序点数", "碱基数"]);
  const td = [...doc.querySelectorAll("td")].map(text);
  assert.deepEqual(td, ["SRR000001", "1.1M", "80.6M"], "登录号与统计数值必须保留");
  const titles = [...doc.querySelectorAll("span, a")].map((e) => e.getAttribute("title"));
  assert.deepEqual(titles, ["技术读段，接头", "应用读段，正向", "技术读段，连接子", "应用读段，反向", "此实验的全部运行"]);
});

// ---------------- 历史半中半英条目（lead 复核） ----------------

test("PubMed 高级检索：Click 'Refresh'… 与页面按钮译文一致（用「刷新」而非 Refresh）", () => {
  assert.equal(ncbi.exact["Refresh"], "刷新");
  assert.equal(ncbi.exact["Click 'Refresh' to clear items from the table,"], "点击「刷新」清除表中的项目，");
  assert.equal(ncbi.exact["or click the 'X' to go back to the table."], "或点击「X」返回表格。");
  // 真实 DOM 里这句被 <button>Refresh</button> 切成两个文本节点，词库也按两个节点登记；
  // 这里照实拆开挂载，整句挂一个节点是测不出词库的。
  const doc = pm(
    '<div class="search-history"><p><span>Click \u0027Refresh\u0027 to clear items from the table, </span>' +
    '<button>Refresh</button><span>or click the \u0027X\u0027 to go back to the table.</span></p></div>'
  );
  const p = text(doc.querySelector("p"));
  assert.ok(!/Click|go back/.test(p), "句子里仍留着英文界面文字: " + p);
  assert.ok(p.includes("点击「刷新」清除表中的项目，"), p);
  assert.ok(p.includes("或点击「X」返回表格。"), p);
  assert.equal(text(doc.querySelector("button")), "刷新");
});

test("PubMed 高级检索：Add with AND/OR/NOT 保留布尔运算符原文（与 books/europepmc/clinvar-help 先例一致）", () => {
  for (const op of ["AND", "OR", "NOT"]) {
    assert.equal(ncbi.exact["Add with " + op], "以 " + op + " 添加");
  }
  const doc = pm(
    '<div class="builder"><button>Add with AND</button><button>Add with OR</button><button>Add with NOT</button></div>'
  );
  const got = [...doc.querySelectorAll("button")].map(text);
  assert.deepEqual(got, ["以 AND 添加", "以 OR 添加", "以 NOT 添加"]);
});