// PubChem + dbGaP 词库（dict/pubchem-dbgap.json）冒烟测试：PubChem 首页、化合物记录页、检索结果页与 dbGaP 首页
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/pubchem-dbgap.json"), "utf8"));
const common = JSON.parse(fs.readFileSync(path.join(root, "../dict/common.json"), "utf8"));
const ncbi = JSON.parse(fs.readFileSync(path.join(root, "../dict/ncbi.json"), "utf8"));

// sites.json 里 PubChem / dbGaP 尚未登记，这里按推荐条目构造站点配置（dicts 顺序与建议一致）
const site = {
  id: "pubchem-dbgap",
  name: "PubChem + dbGaP",
  hosts: ["pubchem.ncbi.nlm.nih.gov", "dbgap.ncbi.nlm.nih.gov"],
  dicts: ["common", "ncbi", "pubchem-dbgap"],
  scope: "body"
};

// 站点实际加载 common + ncbi（本册接入后再加本册），合并后的词表才是页面真实行为
const all = {
  exact: Object.assign({}, common.exact, ncbi.exact, dict.exact),
  rules: [...(common.rules || []), ...(ncbi.rules || []), ...dict.rules],
  templates: [...(common.templates || []), ...(ncbi.templates || []), ...dict.templates]
};

const CJK = /[\u4e00-\u9fff]/;

function engineFor(html, url) {
  const dom = new JSDOM(html, { url: url || "https://pubchem.ncbi.nlm.nih.gov/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: all,
    site
  });
  engine.start();
  return { doc: dom.window.document, engine };
}

const anyEngine = engineFor("<p>x</p>").engine;
function covers(k) {
  return k in all.exact || anyEngine.translateText(k) !== null;
}
function text(el) {
  return el.textContent.replace(/\s+/g, " ").trim();
}

test("词库结构：family/sites 正确，exact 条目够多且译文都含汉字", () => {
  assert.equal(dict.meta.family, "pubchem-dbgap");
  assert.deepEqual(dict.meta.sites, ["pubchem.ncbi.nlm.nih.gov", "dbgap.ncbi.nlm.nih.gov"]);
  const keys = Object.keys(dict.exact);
  assert.ok(keys.length >= 480, "exact 只有 " + keys.length + " 条");
  // 三条纯缩写字段标签（SMILES / InChIKey / InChI）没有可译汉字，只统一成全角冒号
  const acronymOnly = new Set(["SMILES:", "InChIKey:", "InChI:"]);
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.notEqual(v, k, "自映射: " + k);
    if (acronymOnly.has(k)) assert.equal(v, k.replace(/:$/, "："), "缩写标签只换全角冒号: " + k);
    else assert.match(v, CJK, "译文不含汉字: " + k + " => " + v);
  }
  assert.ok(dict.rules.length >= 3, "规则太少");
  for (const r of dict.rules) {
    assert.doesNotThrow(() => new RegExp(r.re), "坏正则: " + r.re);
    assert.match(r.to, CJK, "规则译文不含汉字: " + r.re);
    assert.ok(/\((?!\?)/.test(r.re), "规则没有捕获组: " + r.re);
  }
  const tpl = dict.templates || [];
  assert.ok(tpl.length >= 2, "模板太少");
  for (const t of tpl) {
    assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, "模板 pat 长度越界: " + t.pat.length);
    assert.match(t.zh, CJK, "模板译文不含汉字: " + t.pat);
    const slots = (t.pat.match(/\{\{\d+\}\}/g) || []).length;
    assert.ok(slots >= 1, "模板没有槽位: " + t.pat);
    for (let i = 1; i <= slots; i++) assert.ok(t.pat.includes("{{" + i + "}}"), "槽位不连续: " + t.pat);
    assert.equal((t.zh.match(/\{\{\d+\}\}/g) || []).length, slots, "译文槽位数不一致: " + t.pat);
    assert.doesNotMatch(t.zh, /[\w.+-]+@[\w-]+\.[\w.]+/, "模板译文含明文邮箱: " + t.pat);
  }
});

test("条目卫生：key 不含中文、首尾无空白，值里没有明文 URL / 邮箱", () => {
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.doesNotMatch(k, CJK, "key 含中文: " + k);
    assert.equal(k, k.trim(), "key 首尾有空白: " + JSON.stringify(k));
    assert.equal(v, v.trim(), "值首尾有空白: " + k);
    assert.doesNotMatch(v, /https?:\/\//i, "值含明文 URL: " + k);
    assert.doesNotMatch(v, /[\w.+-]+@[\w-]+\.[\w.]+/, "值含明文邮箱: " + k);
    assert.doesNotMatch(k, /[\r\n]/, "key 含换行: " + k);
  }
});

test("PubChem 首页：顶栏、检索区、区块标题与资源导航", () => {
  const must = [
    "Here is how you know",
    "Docs",
    "Theme Settings",
    "Quickly find chemical information",
    "Search PubChem",
    "Submit search",
    "Draw",
    "ID File",
    "Try",
    "How to Search",
    "What is PubChem",
    "Tutorials",
    "Citation Guidelines",
    "Explore Resources",
    "Periodic Table of Elements",
    "Classification Browser",
    "Search and Analysis Tools",
    "Chemical Safety Information",
    "Access Data",
    "Data Counts",
    "Data Sources",
    "Contribute",
    "Submissions Portal",
    "Getting Started with Submissions",
    "Data Submission Policy",
    "Chemical Vendor Policy",
    "PubChem Updates",
    "View all updates",
    "See More Statistics",
    "PubChem is the world's largest collection of freely accessible chemical information. Search chemicals by name, molecular formula, structure, and other identifiers. Find chemical and physical properties, biological activities, safety and toxicity information, patents, literature citations and more.",
    "We are constantly adding new data and working on improving interfaces to chemical information. Please check back often!"
  ];
  for (const k of must) assert.ok(covers(k), "缺少条目: " + k);
});

test("PubChem 检索结果页：检索提示、排序项与结果卡片字段", () => {
  const must = [
    "Treating this as a text search.",
    "BEST COMPOUND MATCH",
    "ALL DATA COLLECTIONS TEXT SEARCH",
    "Searching chemical names and synonyms including IUPAC names and InChIKeys across the compound collection. Note that annotations text from compound summary pages is not searched.",
    "Similar Structures Search",
    "Related Records",
    "PubMed (MeSH Keyword)",
    "Compound CID:",
    "MF:",
    "MW:",
    "IUPAC Name:",
    "SMILES:",
    "InChIKey:",
    "InChI:",
    "Create Date:",
    "Tagged by PubChem:",
    "Compound CID - Increasing",
    "Molecular Weight - Decreasing",
    "Complexity - Increasing",
    "H-Bond Donor Count - Decreasing",
    "Polar Area - Increasing",
    "Rotatable Bond Count - Decreasing",
    "Create Date - Most Recent",
    "Annotation Type Count - Increasing",
    "Refine/Filter",
    "Linked Data",
    "Push to Entrez",
    "Title and Summary",
    "COMPRESSION: Zip Only",
    "FIELDS TO DOWNLOAD:",
    "All (default)",
    "Read about supported file formats",
    "Chemical Structure Records",
    "Chemical Structure Images",
    "IMAGE SIZE:",
    "Small",
    "Large",
    "Expand this menu"
  ];
  for (const k of must) assert.ok(covers(k), "缺少条目: " + k);
});

test("PubChem 化合物记录页：目录、区块标题、表头与谱图字段", () => {
  const must = [
    "2 Names and Identifiers",
    "2.1 Computed Descriptors",
    "2.1.1 IUPAC Name",
    "2.2 Molecular Formula",
    "2.3 Other Identifiers",
    "2.3.2 Deprecated CAS",
    "2.3.3 European Community (EC) Number",
    "2.3.5 UN Number",
    "2.4 Synonyms",
    "2.4.1 MeSH Entry Terms",
    "2.4.2 Depositor-Supplied Synonyms",
    "3 Chemical and Physical Properties",
    "3.1 Computed Properties",
    "3.2 Experimental Properties",
    "3.2.1 Physical Description",
    "3.2.3 Odor",
    "3.2.4 Boiling Point",
    "3.2.5 Melting Point",
    "3.2.6 Flash Point",
    "3.2.7 Solubility",
    "3.2.8 Density",
    "3.2.10 LogP",
    "3.2.13 Dissociation Constants",
    "3.3 SpringerMaterials Properties",
    "3.4 Chemical Classes",
    "4 Spectral Information",
    "4.1 1D NMR Spectra",
    "4.1.1 1H NMR Spectra",
    "4.3 Mass Spectrometry",
    "4.4 UV Spectra",
    "4.5 IR Spectra",
    "5 Related Records",
    "5.2 Related Compounds",
    "5.3 Substances",
    "5.5 Entrez Crosslinks",
    "6 Chemical Vendors",
    "7 Drug and Medication Information",
    "7.1 Drug Indication",
    "7.3 Drug Classes",
    "8 Food Additives and Ingredients",
    "9 Pharmacology and Biochemistry",
    "9.1 Pharmacodynamics",
    "9.4 ATC Code",
    "9.8 Biological Half-Life",
    "9.9 Mechanism of Action",
    "10 Use and Manufacturing",
    "12 Safety and Hazards",
    "12.1 Hazards Identification",
    "12.1.1 GHS Classification",
    "12.3 First Aid Measures",
    "12.5 Accidental Release Measures",
    "12.6 Handling and Storage",
    "12.7 Exposure Control and Personal Protection",
    "13 Toxicity",
    "13.1 Toxicological Information",
    "13.2 Ecological Information",
    "14 Associated Disorders and Diseases",
    "15.1 Consolidated References",
    "16 Patents",
    "17 Interactions and Pathways",
    "18 Biological Test Results",
    "20 Classification",
    "21 Information Sources",
    "Primary Hazards",
    "Molecular Formula",
    "Synonyms",
    "Molecular Weight",
    "Chemical Structure Depiction",
    "CCDC Number",
    "Associated Article",
    "Crystal Structure Data",
    "Property Name",
    "Property Value",
    "Spectra ID",
    "Instrument Type",
    "Solvent",
    "Shifts [ppm]:Intensity",
    "Shifts [ppm] (F2:F1):Intensity",
    "Top 5 Peaks",
    "Ionization Mode",
    "MS Level",
    "Collision Energy",
    "Column Name",
    "Retention Time",
    "Precursor m/z",
    "Same Connectivity Count",
    "Similar Compounds (2D)",
    "Similar Conformers (3D)",
    "Same Parent, Exact Count",
    "PubMed Count",
    "Protein Structures Count",
    "Taxonomy Count",
    "Gene Count",
    "Drug",
    "Indication",
    "Route of Administration",
    "Non-Proprietary Name",
    "Preparations",
    "Dose (mg)",
    "Manufacturer",
    "GHS Hazard Statements",
    "Precautionary Statement Codes",
    "Signal",
    "Periodic Table",
    "Draw Structure",
    "Load from File",
    "Choose search scope",
    "Close popup",
    "What is this information?",
    "Open this section in a new browser window",
    "Get Image",
    "Full screen",
    "ALL SOURCES"
  ];
  for (const k of must) assert.ok(covers(k), "缺少条目: " + k);
});

test("dbGaP 首页：导航、检索框、说明句、统计标签与页脚链接", () => {
  const must = [
    "dbGaP Home",
    "Public Data",
    "Controlled Access",
    "Welcome to dbGaP",
    "Search dbGaP (e.g. phs000001, Lung Cancer)",
    "Need to refine your search criteria?",
    "Go to Advanced Public Search.",
    "Navigating dbGaP",
    "In this section",
    "Find Studies in dbGaP",
    "Search for dbGaP Studies",
    "Download Public Files",
    "Request Controlled Data",
    "Go to Authorized Access",
    "View NIH Policy for dbGaP Request",
    "View Security Procedures (PDF)",
    "View Code of Conduct (PDF)",
    "Submit to dbGaP",
    "Go to Study Registration",
    "Submit Study Data",
    "Review Submission Guide",
    "View Submission Process Overview (PDF)",
    "Explore More Resources",
    "Learn About dbGaP",
    "Contact Us",
    "View FAQs",
    "View Summary Statistics",
    "View dbGaP Tutorials",
    "Latest Updates and Releases",
    "Go to dbGaP's RSS feed",
    "dbGaP Statistics",
    "Released Studies",
    "Study Participants",
    "Registered Users",
    "Registered",
    "Submitters",
    "study page",
    "The database of Genotypes and Phenotypes (dbGaP) was developed to archive and distribute the data and results from studies that have investigated the interaction of genotype and phenotype in humans.",
    "Show menu",
    "Close navigation menu",
    "dbGap Authorized Access Portal",
    "Official websites use .gov",
    "website belongs to an official government organization in the United States."
  ];
  for (const k of must) assert.ok(covers(k), "缺少条目: " + k);
});

test("规则行为：PubChem 计算标注与版本号不被 common 抢占", () => {
  assert.equal(anyEngine.translateText("Computed by PubChem"), "由 PubChem 计算");
  assert.equal(anyEngine.translateText("Computed by Foo"), "由 Foo 计算");
  assert.equal(
    anyEngine.translateText("Computed by Cactvs 3.4.8.18 (PubChem release 2025.04.14)"),
    "由 Cactvs 3.4.8.18 计算（PubChem 版本 2025.04.14）"
  );
  assert.equal(
    anyEngine.translateText("Computed by PubChem (release 2025.04.14)"),
    "由 PubChem 计算（版本 2025.04.14）"
  );
  assert.equal(anyEngine.translateText("PubChem release 2025.04.14"), "PubChem 版本 2025.04.14");
  assert.equal(anyEngine.translateText("release 2025.04.14"), "版本 2025.04.14");
  // 通用计数规则仍由 common 负责，本册不重复收：命中 common 的既有译文
  assert.equal(anyEngine.translateText("145 results"), "共 145 条结果");
  assert.equal(anyEngine.translateText("1 of 32 items"), "第 1 项，共 32 项");
});

test("首页渲染：主标题、检索按钮、检索框 placeholder、区块标题与排序项", () => {
  const { doc } = engineFor(
    "<div>" +
      '<header><a href="/docs">Docs</a><a href="/settings">Theme Settings</a></header>' +
      "<h1>Quickly find chemical information</h1>" +
      '<input id="q" placeholder="Search PubChem">' +
      "<button>Submit search</button><button>Draw</button><button>ID File</button>" +
      '<a href="/search">Try</a>' +
      "<h2>What is PubChem</h2>" +
      "<p>PubChem is the world's largest collection of freely accessible chemical information. Search chemicals by name, molecular formula, structure, and other identifiers. Find chemical and physical properties, biological activities, safety and toxicity information, patents, literature citations and more.</p>" +
      "<p>We are constantly adding new data and working on improving interfaces to chemical information. Please check back often!</p>" +
      "<h2>PubChem Updates</h2><a href=\"/updates\">View all updates</a>" +
      "<h3>Explore Resources</h3>" +
      "<a href=\"/periodic-table\">Periodic Table of Elements</a><a href=\"/classify\">Classification Browser</a>" +
      "<a href=\"/search\">Search and Analysis Tools</a><a href=\"/safety\">Chemical Safety Information</a>" +
      "<div><span>145 results</span>" +
      "<select><option>Molecular Weight - Increasing</option><option>XLogP - Decreasing</option></select></div>" +
      "</div>"
  );
  assert.equal(text(doc.querySelector("h1")), "快速查找化学信息");
  assert.deepEqual([...doc.querySelectorAll("a")].map(text).slice(0, 5), ["文档", "主题设置", "试一试", "查看全部更新", "元素周期表"]);
  assert.deepEqual([...doc.querySelectorAll("button")].map(text), ["提交检索", "绘制", "ID 文件"]);
  assert.equal(doc.querySelector("input").getAttribute("placeholder"), "检索 PubChem");
  assert.deepEqual([...doc.querySelectorAll("h2, h3")].map(text), ["什么是 PubChem", "PubChem 更新", "浏览资源"]);
  assert.deepEqual([...doc.querySelectorAll("option")].map(text), ["分子量 - 递增", "XLogP - 递减"]);
  const ps = [...doc.querySelectorAll("p")].map(text);
  assert.equal(
    ps[0],
    "PubChem 是世界上最大的免费可访问化学信息集合。可按名称、分子式、结构及其他标识符检索化学品。还可查找化学与物理性质、生物活性、安全与毒性信息、专利、文献引用等内容。"
  );
  assert.equal(ps[1], "我们一直在不断添加新数据并改进化学信息的界面。请经常回来查看！");
  // 通用计数规则归 common，本册不重复收
  assert.equal(text(doc.querySelector("span")), "共 145 条结果");
});

test("化合物记录页渲染：目录按钮、区块标题、表头字段与计算标注规则", () => {
  const { doc } = engineFor(
    "<div>" +
      '<div class="toc"><button>1 Structures</button><button>2 Names and Identifiers</button><button>3 Chemical and Physical Properties</button></div>' +
      '<div><span class="flex-1">2.1 Computed Descriptors</span></div>' +
      '<div><span class="flex-1">2.1.1 IUPAC Name</span></div>' +
      '<div><span class="flex-1">2.3.3 European Community (EC) Number</span></div>' +
      '<div><span class="flex-1">2.4.2 Depositor-Supplied Synonyms</span></div>' +
      "<div>" +
      '<div class="table-cell">Property Name</div><div class="table-cell">Property Value</div>' +
      '<div class="table-cell">Molecular Weight</div><div class="table-cell">180.16 g/mol</div>' +
      '<div class="table-cell">Compound CID:</div><div class="table-cell">2244</div>' +
      '<div class="table-cell">IUPAC Name:</div><div class="table-cell">2-acetoxybenzoic acid</div>' +
      '<div class="table-cell">Computed by Cactvs 3.4.8.18 (PubChem release 2025.04.14)</div>' +
      '<div class="table-cell">Computed by PubChem</div>' +
      "</div>" +
      "<h3>Spectra ID</h3><h3>Instrument Type</h3><h3>Top 5 Peaks</h3>" +
      "<h3>Similar Compounds (2D)</h3><h3>1D NMR Spectra</h3>" +
      "<h3>Primary Hazards</h3><h3>Chemical Structure Depiction</h3>" +
      "<h3>Preparations</h3><h3>Dose (mg)</h3>" +
      '<div><div>FIELDS TO DOWNLOAD:</div><div>COMPRESSION: Zip Only</div><div>IMAGE SIZE:</div></div>' +
      "<button>Get Image</button><button>Full screen</button>" +
      '<div id="menu-btn" title="Expand this menu">Expand this menu</div>' +
      "</div>",
    "https://pubchem.ncbi.nlm.nih.gov/compound/2244"
  );
  // "1 Structures" 走 common 的计数规则 + ncbi 的 Structures 词条
  assert.deepEqual([...doc.querySelectorAll(".toc button")].map(text), ["1 结构", "2 名称与标识符", "3 化学与物理性质"]);
  assert.deepEqual(
    [...doc.querySelectorAll(".flex-1")].map(text),
    ["2.1 计算描述符", "2.1.1 IUPAC 名称", "2.3.3 欧洲共同体（EC）编号", "2.4.2 提交者提供的同义词"]
  );
  assert.deepEqual([...doc.querySelectorAll("h3")].map(text), [
    "谱图 ID",
    "仪器类型",
    "前 5 个峰",
    "相似化合物（2D）",
    "一维 NMR 谱",
    "主要危害",
    "化学结构图示",
    "制剂",
    "剂量（mg）"
  ]);
  const cells = [...doc.querySelectorAll(".table-cell")].map(text);
  for (const want of [
    "属性名称",
    "属性值",
    "分子量",
    "180.16 g/mol",
    "化合物 CID：",
    "2244",
    "IUPAC 名称：",
    "由 Cactvs 3.4.8.18 计算（PubChem 版本 2025.04.14）",
    "由 PubChem 计算"
  ]) {
    assert.ok(cells.includes(want), "缺少单元格 " + want + " 实际: " + cells.join("|"));
  }
  const divs = [...doc.querySelectorAll("div")].map(text);
  for (const want of ["要下载的字段：", "压缩：仅 Zip", "图像尺寸：", "展开此菜单"]) {
    assert.ok(divs.includes(want), "缺少文本 " + want + " 实际: " + divs.slice(0, 20).join("|"));
  }
  assert.equal(doc.querySelector("#menu-btn").getAttribute("title"), "展开此菜单");
  assert.deepEqual([...doc.querySelectorAll("button")].map(text), ["1 结构", "2 名称与标识符", "3 化学与物理性质", "获取图像", "全屏"]);
});

test("dbGaP 首页渲染：说明段、检索框 placeholder、帮助句模板、统计数字与 .gov 横幅模板", () => {
  const { doc } = engineFor(
    "<div>" +
      "<h1>Welcome to dbGaP</h1>" +
      "<p>The database of Genotypes and Phenotypes (dbGaP) was developed to archive and distribute the data and results from studies that have investigated the interaction of genotype and phenotype in humans.</p>" +
      '<input id="s" placeholder="Search dbGaP (e.g. phs000001, Lung Cancer)">' +
      '<p>Need to refine your search criteria? <a href="https://dbgap.ncbi.nlm.nih.gov/search/">Go to Advanced Public Search.</a></p>' +
      "<h2>Navigating dbGaP</h2><h3>In this section</h3>" +
      "<h2>Find Studies in dbGaP</h2>" +
      '<a href="/search">Search for dbGaP Studies</a><a href="/files">Download Public Files</a>' +
      "<h2>Request Controlled Data</h2>" +
      '<a href="/authorized">Go to Authorized Access</a><a href="/policy">View NIH Policy for dbGaP Request</a>' +
      "<h2>Submit to dbGaP</h2>" +
      '<a href="/register">Go to Study Registration</a><a href="/submit">Submit Study Data</a>' +
      "<h2>Latest Updates and Releases</h2>" +
      "<div><span>3.5K</span><span>Released Studies</span></div>" +
      "<div><span>8.4M</span><span>Study Participants</span></div>" +
      "<div><span>47.5K</span><span>Registered Users</span></div>" +
      "<div><span>4.8K</span><span>Registered</span><span>+</span><span>Submitters</span></div>" +
      "<p>" +
      "<strong>Official websites use .gov</strong>" +
      "    <br>" +
      "    A" +
      "    <strong>.gov</strong> website belongs to an official" +
      "    government organization in the United States." +
      "</p>" +
      "<p>\n" +
      "                            <strong>Secure .gov websites use HTTPS</strong>\n" +
      "                            <br>\n" +
      "                            A <strong>lock</strong> (\n" +
      '                            <span class="icon-lock">\n' +
      "                                <svg><title>Lock</title><desc>\n                                    Locked padlock icon\n                                    </desc></svg>\n" +
      "</span>) or <strong>https://</strong> means you've safely\n" +
      "                                connected to the .gov website. Share sensitive\n" +
      "                                information only on official, secure websites.\n" +
      "                            </p>" +
      "</div>",
    "https://dbgap.ncbi.nlm.nih.gov/home/"
  );
  assert.equal(text(doc.querySelector("h1")), "欢迎使用 dbGaP");
  assert.equal(doc.querySelector("input").getAttribute("placeholder"), "检索 dbGaP（例如 phs000001、肺癌）");
  const ps = [...doc.querySelectorAll("p")].map(text);
  assert.equal(
    ps[0],
    "基因型与表型数据库（dbGaP）用于归档和分发研究基因型与表型在人体中相互作用的研究所产生数据与结果。"
  );
  // 单槽位模板：链接原样留在译文里
  assert.equal(ps[1], "需要细化检索条件？前往高级公开检索。");
  assert.equal(doc.querySelectorAll("p")[1].querySelector("a").getAttribute("href"), "https://dbgap.ncbi.nlm.nih.gov/search/");
  // 三槽位模板：<strong> 与 <br> 按 DOM 顺序回填
  assert.equal(ps[2], "官方网站使用 .gov凡以 .gov 结尾的网站均属于美国官方政府机构。");
  assert.ok(ps[2].includes(".gov"), "横幅槽位没回填: " + ps[2]);
  assert.equal(doc.querySelectorAll("p")[2].querySelector("strong").textContent.trim(), "官方网站使用 .gov");
  // 第二条横幅的末句在 common 册（r30 P1-2 把它从 clinicaltrials 下沉），撇号折叠后直引号 DOM 也命中
  assert.equal(
    ps[3],
    "Secure .gov websites use HTTPS A lock ( Lock Locked padlock icon ) or HTTPS 表示您已安全连接到 .gov 网站。仅在官方、安全网站上分享敏感信息。"
  );
  assert.deepEqual([...doc.querySelectorAll("h2, h3")].map(text), [
    "浏览 dbGaP",
    "本节内容",
    "在 dbGaP 中查找研究",
    "申请受控数据",
    "向 dbGaP 提交数据",
    "最新更新与发布"
  ]);
  assert.deepEqual([...doc.querySelectorAll("a")].map(text).slice(0, 6), [
    "前往高级公开检索。",
    "检索 dbGaP 研究",
    "下载公开文件",
    "前往授权访问",
    "查看 NIH 的 dbGaP 数据申请政策",
    "前往研究注册"
  ]);
  // 统计数字标签（数字本身是统计值，保持原样）
  const stats = [...doc.querySelectorAll("div")].map(text).filter((t) => /K|M/.test(t) && t.length < 24);
  assert.deepEqual(stats, ["3.5K已发布研究", "8.4M研究参与者", "47.5K注册用户", "4.8K已注册+提交者"]);
});

// r24 补词：PubChem 化合物页 3D Conformer（结构查看器）面板整组按钮与选项。
// 取证：https://pubchem.ncbi.nlm.nih.gov/compound/2244 的真实 DOM（.pc-conformer-viewer /
// .pc-conformer-sidebar / .pc-conformer-options），节点文本与 title/aria-label 属性逐条对照。
const CONFORMER_3D = {
  Display: "显示",
  "Model style": "模型样式",
  "Ball and Stick": "球棍模型",
  Sticks: "棍状模型",
  "Wire-Frame": "线框模型",
  "Space-Filling": "空间填充模型",
  "Show Hydrogens": "显示氢原子",
  Animate: "自动旋转",
  "Conformer ID": "构象 ID",
  "Conformer ID:": "构象 ID：",
  Modify: "修改",
  "Modify:": "修改：",
  "View More": "查看更多",
  "View More...": "查看更多…",
  "See also": "另见",
  "Interactive 3D chemical structure": "可交互三维化学结构",
  "Use this structure as input to structure search": "将此结构用作结构检索的输入",
  "Download an image of this structure": "下载此结构的图像",
  "Download the coordinates of this structure": "下载此结构的坐标",
  "Change the 3D display options": "更改 3D 显示选项",
  "View structure in full screen": "全屏查看结构"
};

test("3D Conformer 面板：模型样式、开关、标签与工具提示都有译文且整串命中", () => {
  for (const [en, zh] of Object.entries(CONFORMER_3D)) {
    assert.equal(dict.exact[en], zh, "词库缺条目: " + en);
    assert.equal(anyEngine.translateText(en), zh, "整串不命中: " + en);
  }
});

// React 会把 "Conformer ID:" / "Modify:" 拆成两个文本节点（"Conformer ID" + ":"），
// 面板按钮也会把 "View More..." 拆成 "View " / "More" / "..."，这里按真实结构造 DOM。
function renderConformer(html) {
  const dom = new JSDOM(html, { url: "https://pubchem.ncbi.nlm.nih.gov/compound/2244" });
  const doc = dom.window.document;
  const split = (id, parts) => {
    const el = doc.getElementById(id);
    if (!el) return;
    el.textContent = "";
    for (const p of parts) el.appendChild(doc.createTextNode(p));
  };
  split("cil", ["Conformer ID", ":"]);
  split("mod", ["Modify", ":"]);
  split("vm-split", ["View ", "More", "..."]);
  const engine = createEngine({ document: doc, window: dom.window, data: all, site });
  engine.start();
  return { doc, engine };
}

test("3D Conformer 面板渲染：sr-only 标签、模型单选、开关、拆分节点、属性与 WebGL 提示模板", () => {
  const { doc } = renderConformer(
    '<div class="pc-conformer-viewer">' +
      '<div class="pc-gray-toolbar">' +
        '<button title="Use this structure as input to structure search"><span class="sr-only">Structure Search</span></button>' +
        '<button title="Download an image of this structure"><span class="sr-only">Get Image</span></button>' +
        '<button title="Download the coordinates of this structure"><span class="sr-only">Download Coordinates</span></button>' +
        '<button title="Change the 3D display options"><span class="sr-only">Display</span></button>' +
      "</div>" +
      '<div class="pc-conformer-sidebar">' +
        '<div class="pc-conformer-details"><span id="cil"></span><span class="whitespace-nowrap">16BA995300030001</span></div>' +
        '<div class="pc-conformer-display-label">Display options</div>' +
        '<div class="sr-only">Model style</div>' +
        '<div class="pc-conformer-models" role="radiogroup">' +
          '<button role="radio" aria-checked="true"><span>Ball and Stick</span></button>' +
          '<button role="radio" aria-checked="false"><span>Sticks</span></button>' +
          '<button role="radio" aria-checked="false"><span>Wire-Frame</span></button>' +
          '<button role="radio" aria-checked="false"><span>Space-Filling</span></button>' +
        "</div>" +
        '<button role="checkbox" aria-checked="true"><span>Show Hydrogens</span></button>' +
        '<button role="checkbox" aria-checked="false"><span>Animate</span></button>' +
      "</div>" +
      '<div class="pc-conformer-canvas">' +
        '<canvas aria-label="Interactive 3D chemical structure"></canvas>' +
        '<button title="View structure in full screen"><span class="sr-only">Full screen</span></button>' +
        '<button title="Zoom in"><span class="sr-only">Zoom in</span></button>' +
        '<button title="Zoom out"><span class="sr-only">Zoom out</span></button>' +
      "</div>" +
    "</div>" +
    '<p id="webgl">This feature requires WebGL, but your browser either does not support it or has it disabled. Please visit <a href="https://get.webgl.org/">https://get.webgl.org/</a> for more information.</p>' +
    '<div class="dates"><span id="mod"></span><span>2026-11-21</span></div>' +
    '<p><a class="regular-link" href="#section=Other-Relationships">See also</a>: Acetaminophen; Aspirin</p>' +
    '<div><button id="vm-split"></button><button id="vm-single">View More...</button></div>',
    "https://pubchem.ncbi.nlm.nih.gov/compound/2244"
  );

  // sr-only 标签：图标按钮的可读名
  assert.deepEqual(
    [...doc.querySelectorAll(".pc-gray-toolbar .sr-only")].map(text),
    ["结构检索", "获取图像", "下载坐标", "显示"]
  );
  assert.equal(text(doc.querySelector(".pc-conformer-display-label")), "显示选项");
  assert.equal(text(doc.querySelector(".pc-conformer-sidebar > .sr-only")), "模型样式");
  // 模型样式单选组
  assert.deepEqual(
    [...doc.querySelectorAll('[role="radio"]')].map(text),
    ["球棍模型", "棍状模型", "线框模型", "空间填充模型"]
  );
  assert.deepEqual(
    [...doc.querySelectorAll('[role="checkbox"]')].map(text),
    ["显示氢原子", "自动旋转"]
  );
  // 拆分文本节点：React 的两段式标签要拼回整条
  assert.equal(text(doc.querySelector(".pc-conformer-details")), "构象 ID：16BA995300030001");
  assert.equal(text(doc.querySelector(".dates")), "修改：2026-11-21");
  // 画布按钮
  assert.deepEqual(
    [...doc.querySelectorAll(".pc-conformer-canvas button")].map(text),
    ["全屏", "放大", "缩小"]
  );
  // 工具提示走 title 属性
  assert.deepEqual(
    [...doc.querySelectorAll(".pc-gray-toolbar button")].map((b) => b.getAttribute("title")),
    ["将此结构用作结构检索的输入", "下载此结构的图像", "下载此结构的坐标", "更改 3D 显示选项"]
  );
  assert.equal(
    doc.querySelector(".pc-conformer-canvas button").getAttribute("title"),
    "全屏查看结构"
  );
  assert.equal(doc.querySelector(".pc-conformer-canvas canvas").getAttribute("aria-label"), "可交互三维化学结构");
  // "View More..." 的整条节点与拆分节点都要翻
  assert.equal(text(doc.getElementById("vm-single")), "查看更多…");
  assert.equal(text(doc.getElementById("vm-split")), "查看更多…");
  // 正文里的 See also 标签链接
  const seeAlso = doc.querySelector('p a[href="#section=Other-Relationships"]');
  assert.equal(text(seeAlso), "另见");
  // WebGL 不可用时的整段提示走模板，链接原样保留
  const webgl = text(doc.getElementById("webgl"));
  assert.equal(webgl, "此功能需要 WebGL，但你的浏览器不支持或已禁用它。请访问 https://get.webgl.org/ 了解更多信息。");
  assert.equal(doc.getElementById("webgl").querySelector("a").getAttribute("href"), "https://get.webgl.org/");
});

