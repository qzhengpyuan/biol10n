// NLM Catalog + ORFfinder 词库（dict/ncbi-cat.json）测试
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/ncbi-cat.json"), "utf8"));
// Lead 另行接线 config/sites.json；测试里用等价的站级对象，不依赖接线是否已提交
const site = { path: "^/(nlmcatalog|orffinder)", hosts: ["www.ncbi.nlm.nih.gov"] };

// 真实接线里 site.dicts 至少含 common；这里按同样方式合并，避免测到环境差异
const common = JSON.parse(fs.readFileSync(path.join(root, "../dict/common.json"), "utf8"));
const data = {
  exact: { ...common.exact, ...dict.exact },
  rules: [...(common.rules || []), ...(dict.rules || [])],
  templates: [...(common.templates || []), ...(dict.templates || [])]
};

function mount(html, url) {
  const dom = new JSDOM(html, { url: url || "https://www.ncbi.nlm.nih.gov/nlmcatalog/0410462" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return dom.window.document;
}

test("词库结构：family/sites、条目数、rule 合法、templates 齐全", () => {
  assert.equal(dict.meta.family, "ncbi-cat");
  assert.ok(dict.meta.sites.includes("www.ncbi.nlm.nih.gov"));
  assert.ok(Object.keys(dict.exact).length >= 140, "条目数应 >= 140");
  assert.ok(Array.isArray(dict.rules) && dict.rules.length >= 8);
  assert.ok(Array.isArray(dict.templates) && dict.templates.length >= 3);
  for (const r of dict.rules) {
    assert.doesNotThrow(() => new RegExp(r.re), "坏规则: " + r.re);
    assert.equal(typeof r.to, "string");
    assert.ok(/\$[1-9]/.test(r.to), "规则译文应引用捕获组: " + r.re);
  }
});

test("key 里没有中文，值里没有明文 URL/邮箱，无自映射与首尾空白", () => {
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "key 含中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "key 首尾空白: " + k);
    assert.equal(v, v.trim(), "值首尾空白: " + k);
    assert.ok(!/https?:\/\//i.test(v), "值含 URL: " + k);
    assert.ok(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(v), "值含邮箱: " + k);
  }
});

test("模板：pat 为英文原文、20-2200 字、占位符与槽位一一对应", () => {
  for (const t of dict.templates) {
    assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, "模板长度越界: " + t.pat.slice(0, 40));
    assert.ok(!/[\u4e00-\u9fff]/.test(t.pat), "模板 pat 含中文: " + t.pat.slice(0, 40));
    assert.ok(/[\u4e00-\u9fff]/.test(t.zh), "模板译文无中文: " + t.pat.slice(0, 40));
    const used = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
    const have = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
    assert.deepEqual(used, have, "占位符不匹配: " + t.pat.slice(0, 40));
  }
});

test("关键条目存在（页面实测原文）", () => {
  const want = [
    "Collections of the National Library of Medicine",
    "Using NLM Catalog",
    "How to Search for Journals",
    "NLM Catalog FAQs",
    "Journal Lists by FTP",
    "Broad Subject Terms",
    "NLM Catalog Advanced Search Builder",
    "Journals referenced in the NCBI DBs",
    "Journals currently indexed in MEDLINE",
    "Currently indexed",
    "NLM collection only",
    "Title Abbreviation",
    "Country of Publication",
    "Not currently indexed for MEDLINE",
    "[Serial]",
    "[Book]",
    "[Electronic Resource]",
    "NLM Title Abbreviation:",
    "Title(s):",
    "Other Title(s):",
    "Related Title:",
    "Publication Start Year:",
    "Latest Publisher:",
    "Electronic Links:",
    "Selectively In:",
    "Current Indexing Status:",
    "Current Subset:",
    "Broad Subject Term(s):",
    "Publication Type(s):",
    "Collection Status:",
    "Author(s):",
    "Copyright Date:",
    "Contents:",
    "Access not provided by NLM",
    "Not in the NLM Collection",
    "PubMed: Selected citations only",
    "Author Manuscripts in PMC.",
    "Add to history",
    "Select Field",
    "Personal Full Name as Subject",
    "Publication End Year",
    "Open Reading Frame Finder",
    "(click to set values, then click Submit button) :",
    "Enter accession number, gi, or nucleotide sequence in FASTA format:",
    "Choose Search Parameters",
    "Minimal ORF length (nt):",
    "Genetic code:",
    "ORF start codon to use:",
    "Any sense codon",
    "Ignore nested ORFs:",
    "If checked - ignore the ORFs completely placed within another",
    "Start Search / Clear",
    "Accepted Input Formats",
    "1. Standard",
    "33. Cephalodiscidae Mitochondrial UAA-Tyr Code"
  ];
  for (const k of want) assert.ok(Object.prototype.hasOwnProperty.call(dict.exact, k), "缺词条: " + k);
});

test("规则：分页、每页条数、排序、已选条目", () => {
  const r = (s) => {
    const dom = new JSDOM("<body></body>");
    const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
    return engine.translateText(s);
  };
  assert.equal(r("Items: 1 to 20 of 14958"), "第 1 至 20 项，共 14958 项");
  assert.equal(r("20 per page"), "每页 20 条");
  assert.equal(r("of 748"), "共 748 页");
  assert.equal(r("Page 3 of 748"), "第 3 页，共 748 页");
  assert.equal(r("Select item 531490"), "选择条目 531490");
  assert.equal(r("Sort by Publication Date"), "按出版日期排序");
  assert.equal(r("Sort by Author"), "按作者排序");
  assert.equal(r("Sort by Title Abbreviation"), "按刊名缩写排序");
  assert.equal(r("1 selected item: 410462"), "已选 1 项：410462");
  assert.equal(r("Search: Nature"), "检索：Nature");
  assert.equal(r("Previous 200"), "前 200 条");
  assert.equal(r("Next 200"), "后 200 条");
});

test("记录页 dl：字段标签翻、值不翻", () => {
  const doc = mount(
    '<div><dl class="nlmcat_dl">' +
      "<dt>NLM Title Abbreviation:</dt><dd>Nature</dd>" +
      "<dt>Title(s):</dt><dd>Nature.</dd>" +
      "<dt>Other Title(s):</dt><dd>NATURE (LOND)</dd>" +
      "<dt>MeSH:</dt><dd>Science*</dd>" +
      "<dt>Current Indexing Status:</dt><dd>Currently indexed for MEDLINE.</dd>" +
      "</dl></div>",
    "https://www.ncbi.nlm.nih.gov/nlmcatalog/0410462"
  );
  const txt = doc.querySelector(".nlmcat_dl").textContent.replace(/\s+/g, "");
  assert.ok(txt.includes("NLM刊名缩写："), txt);
  assert.ok(txt.includes("题名："), txt);
  assert.ok(txt.includes("其他题名："), txt);
  assert.ok(txt.includes("MeSH主题词："), txt);
  assert.ok(txt.includes("当前被MEDLINE收录。"), txt);
  assert.ok(txt.includes("Nature"), "值不应被翻译");
  assert.ok(txt.includes("NATURE(LOND)"), "其他题名值不应被翻译");
  assert.ok(txt.includes("Science*"), "MeSH 值不应被翻译");
});

test("记录页长说明：模板保留 PMC 链接", () => {
  const doc = mount(
    '<dl class="nlmcat_dl"><dt>Current Indexing Status:</dt><dd>Not currently indexed for MEDLINE. ' +
      "Citations are for articles where the manuscript was deposited in PubMed Central (PMC) in compliance with public access policies. " +
      'For further information, see <a href="/pmc/about/authorms/">Author Manuscripts in PMC.</a></dd></dl>'
  );
  const dd = doc.querySelector("dd");
  assert.ok(dd.textContent.includes("当前未被 MEDLINE 收录。"), dd.textContent);
  assert.ok(dd.textContent.includes("更多信息请见"), dd.textContent);
  assert.ok(dd.textContent.includes("PMC 中的作者手稿"), dd.textContent);
  const a = dd.querySelector("a");
  assert.ok(a && a.getAttribute("href") === "/pmc/about/authorms/", "链接必须保留");
});

test("ORFfinder 首页与表单", () => {
  const doc = mount(
    '<div id="intro_text"><h1>Open Reading Frame Finder</h1>' +
      '<p class="textj">This web version of the ORF finder is limited to the subrange of the query sequence up to 50 kb long. ' +
      "Stand-alone version, which doesn't have query sequence length limitation, is available for " +
      '<a href="https://ftp.ncbi.nlm.nih.gov/">Linux x64</a>.</p></div>' +
      '<form><fieldset><legend>Enter Query Sequence</legend>' +
      '<label for="id_acc">Enter accession number, gi, or nucleotide sequence in FASTA format:</label>' +
      '<div class="helpbox">Enter query sequence in the text area. No hyphens are allowed. To determine the format of the input automatically, ' +
      "certain conventions are required with regard to the input of identifiers. See " +
      '<a href="https://blast.ncbi.nlm.nih.gov/">Accepted Input Formats</a> for more details.</div>' +
      '<label for="id_orffrom">From:</label><input id="id_orffrom">' +
      '<label for="id_orfto">To:</label><input id="id_orfto">' +
      "</fieldset><fieldset><legend>Choose Search Parameters</legend>" +
      '<label for="id_minlen">Minimal ORF length (nt):</label>' +
      '<label for="id_gcode">Genetic code:</label>' +
      '<select id="id_gcode"><option value="1">1. Standard</option><option value="2">2. Vertebrate Mitochondrial</option></select>' +
      '<label for="id_startcdn">ORF start codon to use:</label>' +
      '<label for="id_startcdn_0">"ATG" only</label><label for="id_startcdn_1">"ATG" and alternative initiation codons</label>' +
      '<label for="id_startcdn_2">Any sense codon</label>' +
      '<label for="id_nested">Ignore nested ORFs:</label>' +
      "<legend>Start Search / Clear</legend></fieldset></form>",
    "https://www.ncbi.nlm.nih.gov/orffinder/"
  );
  const t = doc.body.textContent.replace(/\s+/g, " ");
  assert.ok(t.includes("开放阅读框查找器"), t);
  assert.ok(t.includes("网页版 ORF finder 仅限查询序列 50 kb 以内的子区间。"), t);
  assert.ok(t.includes("Linux x64 平台下载"), t);
  assert.ok(t.includes("输入查询序列"), t);
  assert.ok(t.includes("输入登录号、gi 或 FASTA 格式的核苷酸序列："), t);
  assert.ok(t.includes("详见可接受的输入格式。"), t);
  assert.ok(t.includes("起始："), t);
  assert.ok(t.includes("选择检索参数"), t);
  assert.ok(t.includes("最小 ORF 长度（nt）："), t);
  assert.ok(t.includes("遗传密码表："), t);
  assert.ok(t.includes("1. 标准"), t);
  assert.ok(t.includes("2. 脊椎动物线粒体"), t);
  assert.ok(t.includes("ORF 起始密码子："), t);
  assert.ok(t.includes("仅 “ATG”"), t);
  assert.ok(t.includes("“ATG” 及替代起始密码子"), t);
  assert.ok(t.includes("任何有意义密码子"), t);
  assert.ok(t.includes("忽略嵌套 ORF："), t);
  assert.ok(t.includes("开始检索 / 清除"), t);
  // option 的 value 属性绝不能被改
  assert.equal(doc.querySelector('option').getAttribute("value"), "1");
});

test("检索结果页：分页与结果计数落成中文", () => {
  const doc = mount(
    '<div class="title_and_pager"><h2>Search results</h2>' +
      '<h3 class="result_count">Items: 1 to 20 of 14958</h3>' +
      '<div class="pagination"><span>&lt;&lt; First</span><span>&lt; Prev</span>' +
      '<h3 class="page"><label for="pageno">Page</label><input id="pageno"> of 748</h3>' +
      '<a>Next &gt;</a><a>Last &gt;&gt;</a></div></div>' +
      '<div class="rprt"><label>Select item 531490</label><span class="indexing_status">Not currently indexed for MEDLINE</span>' +
      '<dl class="rprtid"><dt>NLM ID:</dt><dd>9919260412706676</dd><dd>[Serial]</dd></dl></div>',
    "https://www.ncbi.nlm.nih.gov/nlmcatalog/?term=Nature"
  );
  const t = doc.body.textContent.replace(/\s+/g, " ");
  assert.ok(t.includes("检索结果"), t);
  assert.ok(t.includes("第 1 至 20 项，共 14958 项"), t);
  assert.ok(t.includes("共 748 页"), t);
  assert.ok(t.includes("选择条目 531490"), t);
  assert.ok(t.includes("当前未被 MEDLINE 收录"), t);
  assert.ok(t.includes("[连续出版物]"), t);
  assert.ok(t.includes("9919260412706676"), "NLM ID 值不应被翻译");
});