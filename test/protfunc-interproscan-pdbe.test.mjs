// 蛋白/结构/功能注释集群长尾补译回归（InterPro InterProScan 页 · PDBe 条目页 · AlphaFold 条目页 · Reactome 检索占位符）
// 只翻界面与固定标签：成员库名、工具名、accession、统计量、结构标题保持英文。
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
const siteOf = (id) => sites.find((s) => s.id === id);
const book = (n) => JSON.parse(fs.readFileSync(path.join(root, "../dict/" + n + ".json"), "utf8"));
const interpro = book("interpro");
const pdbe = book("pdbe");
const alphafold = book("alphafold");
const reactome = book("reactome");
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

function run(html, siteId, url) {
  const site = siteOf(siteId);
  assert.ok(site, "sites.json 里找不到站点: " + siteId);
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

const text = (el) => String(el.textContent || "").replace(/\s+/g, " ").trim();

// ---------------- 结构校验 ----------------

// InterPro InterProScan 关于页：分块句子逐段登记（整句由多段文本节点拼成）
const NEW_INTERPRO = {
  "Download the latest version": "下载最新版本",
  "Linux (64-bit) -": "Linux（64 位）—",
  "System requirements": "系统要求",
  "Download InterProScan": "下载 InterProScan",
  "Web services": "Web 服务",
  "We provide access to InterProScan via": "我们通过以下方式提供对 InterProScan 的访问：",
  "We also provide access to InterProScan via": "我们还通过以下方式提供对 InterProScan 的访问：",
  "SOAP-based": "基于 SOAP 的",
  "web services.": "Web 服务。",
  "Web based tools": "基于 Web 的工具",
  "Source code": "源代码",
  "Github repository": "GitHub 仓库",
  "Previous releases": "历史版本",
  "Follow us & reporting bugs": "关注我们与报告问题",
  "contact us": "联系我们",
  "problem.": "问题。",
  "Online training courses": "在线培训课程",
  "Tel: +44 (0)1223 49 44 44": "电话：+44 (0)1223 49 44 44",
  "InterProScan is the software package that allows sequences to be scanned against InterPro's": "InterProScan 是一个软件包，可将序列与 InterPro 的",
  "member database signatures.": "成员数据库特征签名进行比对。"
};

// PDBe 条目页：3D 查看器降级提示、日期说明 tooltip、属性通道
const NEW_PDBE = {
  "3D viewer paused due to slow connection": "因连接缓慢，3D 视图已暂停",
  "Loading may take longer than usual.": "加载时间可能比平时更长。",
  "Load 3D anyway": "仍然加载 3D",
  "3D viewer paused": "3D 视图已暂停",
  "Important dates related to this PDB entry": "与此 PDB 条目相关的重要日期",
  "Date when the coordinates were deposited to the PDB archive": "坐标提交到 PDB 归档的日期",
  "Date when the coordinates were released in the PDB archive": "坐标在 PDB 归档中发布的日期",
  "Date of the current version or last minor or major revision of a PDB entry": "PDB 条目当前版本或最近一次修订的日期",
  "Entry percentile scores": "条目百分位得分",
  "help icon": "帮助图标",
  "Column with Header Selection": "带表头选择的列",
  "or": "或"
};

const NEW_ALPHAFOLD = {
  "help icon": "帮助图标",
  "Select all on page": "全选本页"
};

test("新增条目逐条在册（InterProScan 页 / PDBe 条目页 / AlphaFold 条目页）", () => {
  const missInterpro = Object.entries(NEW_INTERPRO).filter(([k, v]) => interpro.exact[k] !== v);
  const missPdbe = Object.entries(NEW_PDBE).filter(([k, v]) => pdbe.exact[k] !== v);
  const missAf = Object.entries(NEW_ALPHAFOLD).filter(([k, v]) => alphafold.exact[k] !== v);
  assert.deepEqual(missInterpro, [], "interpro 缺条目或被改值");
  assert.deepEqual(missPdbe, [], "pdbe 缺条目或被改值");
  assert.deepEqual(missAf, [], "alphafold 缺条目或被改值");
  assert.ok(Object.keys(interpro.exact).length >= 360);
  assert.ok(Object.keys(pdbe.exact).length >= 220);
  assert.ok(Object.keys(alphafold.exact).length >= 430);
});

test("条目卫生：键无中文/无首尾空白，值含中文、非自映射、不含 URL 与邮箱", () => {
  const bad = [];
  for (const [bookId, d] of Object.entries({ interpro, pdbe, alphafold })) {
    for (const [k, v] of Object.entries(d.exact)) {
      if (CJK.test(k)) bad.push(bookId + " 键含中文: " + k);
      if (k !== k.trim()) bad.push(bookId + " 键首尾空白: " + JSON.stringify(k));
      if (v !== v.trim()) bad.push(bookId + " 值首尾空白: " + k);
      if (!CJK.test(v)) bad.push(bookId + " 值无中文: " + k);
      if (k === v) bad.push(bookId + " 自映射: " + k);
      if (/https?:\/\/|[\w.+-]+@[\w-]+\.\w+/.test(v)) bad.push(bookId + " 值含 URL/邮箱: " + k);
    }
  }
  assert.deepEqual(bad, []);
});

test("rules 必须 ^…$ 锚定、$n 引用的捕获组真实存在；templates 占位符 1..N 连续", () => {
  for (const [bookId, d] of Object.entries({ interpro, pdbe, alphafold, reactome })) {
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
      assert.ok(CJK.test(t.zh), bookId + " 模板译文无中文: " + t.pat);
    }
  }
});

// ---------------- InterPro：InterProScan 关于页 ----------------

const INTERPRO_SCAN_HTML =
  '<div id="root"><main><section class="BreadCrumbs"><a class="breadcrumb-link">About</a></section>' +
  '<section><h3>InterProScan</h3>' +
  '<p>InterProScan is the software package that allows sequences to be scanned against InterPro\'s \nmember database signatures.\n</p>' +
  '</section>' +
  '<section><h4>Download the latest version <small>(5.78-109.0)</small></h4>' +
  '<div><span class="icon"></span> Linux (64-bit) - <div style="display: inline;">System requirements</div><br>' +
  '<small><ul><li>Older versions of InterProScan are not supported anymore.</li></ul></small></div>' +
  '<div class="download"><a class="button" href="https://ftp.ebi.ac.uk/pub/software/unix/iprscan/5/">Download InterProScan</a>' +
  '<div class="metadata">Version 5.78-109.0 - 6.6GB compressed</div></div>' +
  '</section>' +
  '<section><h4>Web services</h4>' +
  '<p>We provide access to InterProScan via <a href="https://www.ebi.ac.uk/rest">RESTful</a> service</p>' +
  '<p>We also provide access to InterProScan via <a href="https://www.ebi.ac.uk/soap">SOAP-based</a> web services.</p>' +
  '</section>' +
  '<section><h4>Web based tools</h4><p>Web access using the <a href="https://interpro-documentation.readthedocs.io/">sequence search</a> box on the InterPro website, for the analysis \nof single protein sequences in FASTA format with a maximum length of 40,000 amino acids.</p></section>' +
  '<section><h4>Source code</h4><p>You can find, clone, and download the full InterProScan source code on the \n<a href="https://github.com/ebi-pf-team/interproscan">Github repository</a>.</p></section>' +
  '<section><h4>Previous releases</h4><p>To ensure you have the latest data and software enhancements we always recommend you download the latest version of InterProScan.</p></section>' +
  '<section><h4>Follow us &amp; reporting bugs</h4>' +
  '<p>If you want to submit a question or report a bug, please <a href="https://www.ebi.ac.uk/support/interpro">contact us</a>, providing as much information as possible so that we can recreate the \nproblem.</p></section>' +
  '<footer><p><a class="vf-footer__link">EMBL-EBI, Wellcome Genome Campus, Hinxton, Cambridgeshire, CB10 1SD, UK.</a>' +
  '<a class="vf-footer__link" href="tel:00441223494444">Tel: +44 (0)1223 49 44 44</a></p></footer>' +
  '</main></div>';

const interproDoc = () => run(INTERPRO_SCAN_HTML, "interpro", "https://www.ebi.ac.uk/interpro/about/interproscan/");

test("InterProScan 页：标题/卡片/小节标题逐个翻译，按钮与链接文字保留 href", () => {
  const doc = interproDoc();
  const heads = [...doc.querySelectorAll("h3, h4")].map(text);
  assert.deepEqual(heads, ["InterProScan", "下载最新版本（5.78-109.0）", "Web 服务", "基于 Web 的工具", "源代码", "历史版本", "关注我们与报告问题"]);
  const btn = doc.querySelector("a.button");
  assert.equal(text(btn), "下载 InterProScan");
  assert.equal(btn.getAttribute("href"), "https://ftp.ebi.ac.uk/pub/software/unix/iprscan/5/");
});

test("InterProScan 页：被换行切开的段落拼成完整中文（不出现半中半英）", () => {
  const doc = interproDoc();
  const ps = [...doc.querySelectorAll("section > p")].map(text);
  assert.ok(ps.some((t) => t === "InterProScan 是一个软件包，可将序列与 InterPro 的成员数据库特征签名进行比对。"), ps.join(" | "));
  // 这句被 <a>RESTful</a> 切开，拼接时引擎会在节点边界保留一个空格，故允许「： 」之间有一个空格
  assert.ok(ps.some((t) => /^我们通过以下方式提供对 InterProScan 的访问： ?RESTful 服务$/.test(t)), ps.join(" | "));
  assert.ok(ps.some((t) => t === "我们还通过以下方式提供对 InterProScan 的访问：基于 SOAP 的 Web 服务。"), ps.join(" | "));
  assert.ok(ps.some((t) => t.startsWith("如果你想提问或报告问题，请") && t.endsWith("问题。")), ps.join(" | "));
});

test("InterProScan 页：正文里没有残留的界面英文（成员库名/工具名/地址除外）", () => {
  const doc = interproDoc();
  const body = text(doc.querySelector("main"));
  for (const en of ["Download the latest", "System requirements", "Web based tools", "Source code",
    "Previous releases", "Follow us", "contact us", "Web services", "Github repository"]) {
    assert.ok(!body.includes(en), "仍有英文: " + en);
  }
  // 页脚地址与电话属于专有/数据，只翻标签
  assert.ok(body.includes("EMBL-EBI, Wellcome Genome Campus, Hinxton, Cambridgeshire, CB10 1SD, UK."));
  assert.ok(body.includes("电话：+44 (0)1223 49 44 44"));
});

test("InterProScan 页：成员库名与版本号保持英文（IPR/版本/工具名不翻）", () => {
  const doc = interproDoc();
  const body = text(doc.querySelector("main"));
  for (const keep of ["InterProScan", "RESTful", "SOAP", "5.78-109.0", "6.6GB compressed"]) {
    assert.ok(body.includes(keep), "不该翻的丢了: " + keep);
  }
});

// ---------------- PDBe：3D 查看器降级 + 日期 tooltip ----------------

const PDBE_HTML =
  '<div id="root"><main><div class="molstar-not-loaded">' +
  '<h4 class="heading-4">3D viewer paused due to slow connection</h4>' +
  '<p>Loading may take longer than usual.</p>' +
  '<button class="vf-button">Load 3D anyway</button>' +
  '<img alt="3D viewer paused" src="x.png">' +
  '<img alt="help icon" src="y.png">' +
  '<img alt="Entry percentile scores" src="z.png">' +
  '</div>' +
  '<div class="cdk-describedby-message-container">' +
  '<div role="tooltip">Important dates related to this PDB entry</div>' +
  '<div role="tooltip">Date when the coordinates were deposited to the PDB archive</div>' +
  '<div role="tooltip">Date when the coordinates were released in the PDB archive</div>' +
  '<div role="tooltip">Date of the current version or last minor or major revision of a PDB entry</div>' +
  '</div>' +
  '<section class="chips"><div class="left">示例： <a class="pdbe-chip-bg" href="/pdbe/entry/pdb/2dn2">2dn2</a>' +
  '<span>or <a class="sequence-anchor" href="/pdbe/entry/search/">输入序列进行检索</a></span></div></section>' +
  '<input aria-label="Column with Header Selection">' +
  '</main></div>';

const pdbeDoc = () => run(PDBE_HTML, "pdbe", "https://www.ebi.ac.uk/pdbe/entry/pdb/1cbs/experiment");

test("PDBe 条目页：3D 查看器降级提示与按钮译成中文", () => {
  const doc = pdbeDoc();
  const box = doc.querySelector(".molstar-not-loaded");
  assert.equal(text(box.querySelector("h4")), "因连接缓慢，3D 视图已暂停");
  assert.equal(text(box.querySelector("p")), "加载时间可能比平时更长。");
  assert.equal(text(box.querySelector("button")), "仍然加载 3D");
});

test("PDBe 条目页：tooltip 与图片替代文字走属性/文本通道后不再留英文", () => {
  const doc = pdbeDoc();
  const tips = [...doc.querySelectorAll("[role=tooltip]")].map(text);
  assert.deepEqual(tips, [
    "与此 PDB 条目相关的重要日期",
    "坐标提交到 PDB 归档的日期",
    "坐标在 PDB 归档中发布的日期",
    "PDB 条目当前版本或最近一次修订的日期"
  ]);
  const alts = [...doc.querySelectorAll("img")].map((el) => el.getAttribute("alt"));
  assert.deepEqual(alts, ["3D 视图已暂停", "帮助图标", "条目百分位得分"]);
  assert.equal(doc.querySelector("input").getAttribute("aria-label"), "带表头选择的列");
});

test("PDBe 条目页：示例链接之间只剩「或」，检索链接与 href 保留", () => {
  const doc = pdbeDoc();
  const span = doc.querySelector(".chips span");
  assert.equal(text(span), "或输入序列进行检索");
  assert.equal(span.querySelector("a").getAttribute("href"), "/pdbe/entry/search/");
  assert.equal(text(doc.querySelector(".pdbe-chip-bg")), "2dn2");
});

// ---------------- AlphaFold：置信度标签与卡片控件 ----------------

test("AlphaFold 条目页：0.76 (Confident) 这类置信度标签按规则译成中文", () => {
  const doc = run('<app-root><div><span>0.76 (Confident)</span><span>0.91 (Very high)</span></div></app-root>',
    "alphafold", "https://alphafold.ebi.ac.uk/entry/P00533");
  const got = [...doc.querySelectorAll("span")].map(text);
  assert.deepEqual(got, ["0.76（可信）", "0.91（极高）"]);
});

test("AlphaFold 条目页：Select all on page / help icon 走属性通道", () => {
  const doc = run('<app-root><input type="checkbox" title="Select all on page"><img alt="help icon" src="h.png"></app-root>',
    "alphafold", "https://alphafold.ebi.ac.uk/entry/P00533");
  assert.equal(doc.querySelector("input").getAttribute("title"), "全选本页");
  assert.equal(doc.querySelector("img").getAttribute("alt"), "帮助图标");
});

// ---------------- Reactome：检索示例占位符 ----------------

test("Reactome 检索框占位符：e.g. 列表加中文前缀，示例词原样保留", () => {
  const doc = run('<div id="root"><input class="search" placeholder="e.g. O95631, NTN1, signaling by EGFR, glucose"></div>',
    "reactome", "https://reactome.org/");
  assert.equal(doc.querySelector("input").getAttribute("placeholder"), "例如 O95631, NTN1, signaling by EGFR, glucose");
});