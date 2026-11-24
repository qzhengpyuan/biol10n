// r44 NCBI 增补（geo-docs / medgen-gtr / ncbi-dirs / ncbi-cat / ncbi-new2 / dbvar-bioproject / geo-extra）
// 回归点：新增界面词与真实页面长段落模板确实能把英文渲染成中文，同时数据（登录号/物种名/基因名）保持原样。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const common = JSON.parse(fs.readFileSync(path.join(root, "../dict/common.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;

const CJK = /[\u4e00-\u9fff]/;
const load = (id) => JSON.parse(fs.readFileSync(path.join(root, "../dict/" + id + ".json"), "utf8"));

/** 按真实接线（config/sites.json 的 dicts 顺序）合并词库并起引擎 */
function mount(html, siteId) {
  const site = sites.find((s) => s.id === siteId);
  assert.ok(site, "未知站点 " + siteId);
  const exact = { ...common.exact };
  const rules = [...(common.rules || [])];
  const templates = [...(common.templates || [])];
  for (const id of site.dicts || []) {
    const p = path.join(root, "../dict", id + ".json");
    if (!fs.existsSync(p)) continue;
    const d = JSON.parse(fs.readFileSync(p, "utf8"));
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
    templates.push(...(d.templates || []));
  }
  const dom = new JSDOM(html, { url: "https://" + site.hosts[0] + "/" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data: { exact, rules, templates }, site });
  engine.start();
  return dom.window.document;
}
const flat = (s) => String(s || "").replace(/\s+/g, " ").trim();

// 1) 新增词条存在、含汉字、与原键不同
const NEW_EXACT = {
  "geo-docs": ["contact us", "this record", "profile charts", "neighbors links", "DataSet records", "t-test sample comparison tool", "example tracks", "NLM GenBank and SRA data Processing", "MIAME- or MINSEQE", "Reviewer access", "My GEO Profile"],
  "medgen-gtr": ["CPT code", "Clinical category", "e.g.", "Animation of how to search", "Picture of how to search", "Covid-19 image", "Add this filter to your search term.", "Records discoverable in the Genetic Testing Registry (GTR)", "Records with data from Orphanet", "Subset of diseases and clinical features with rich support", "US Edition of SNOMED CT", "Orphanet Rare Disease Ontology (ORDO)", "Online Mendelian Inheritance in Man", "MedlinePlus Genetics"],
  "ncbi-dirs": ["National Center for Biotechnology Information", "Search RefSeq", "Search BioSample", "Submission sections", "GenBank-Genome", "NLM GenBank and SRA Data Processing document"],
  "ncbi-cat": ["RSS feeds", "New/Noteworthy Web (RSS) Feed"],
  "dbvar-bioproject": ["terms"],
  "geo-extra": [
    "Database that groups biomedical literature, small molecules, and sequence data in terms of biological relationships.",
    "URL application programming interface for searching, linking and downloading data within NCBI's Entrez system"
  ]
};

test("① 新增词条：键存在、译文含汉字、与原键不同", () => {
  let checked = 0;
  for (const [id, keys] of Object.entries(NEW_EXACT)) {
    const d = load(id);
    for (const k of keys) {
      assert.ok(Object.prototype.hasOwnProperty.call(d.exact, k), id + " 缺键: " + k);
      const v = d.exact[k];
      assert.notEqual(v, k, "自映射: " + k);
      assert.match(v, CJK, "译文无汉字: " + id + " / " + k + " => " + v);
      assert.equal(k, k.trim());
      assert.equal(v, v.trim());
      checked++;
    }
  }
  assert.ok(checked >= 25, "新增词条只校验了 " + checked + " 条");
});

test("①-b 词条总量只增不减（本次各册）", () => {
  const total = (id) => Object.keys(load(id).exact).length;
  assert.ok(total("geo-docs") >= 427, "geo-docs exact " + total("geo-docs"));
  assert.ok(total("medgen-gtr") >= 335);
  assert.ok(total("ncbi-dirs") >= 298);
  assert.ok(total("ncbi-cat") >= 162);
  assert.ok(total("dbvar-bioproject") >= 201);
  assert.ok(total("geo-extra") >= 155);
});

// 2) 规则：锚定 + 汉字 + 槽位
test("①-c 新规则：^…$ 锚定、译文含汉字，Datasets 问句带 $1", () => {
  const n2 = load("ncbi-new2").rules.find((r) => r.re.includes("What can you learn about"));
  assert.ok(n2, "ncbi-new2 缺 Datasets 问句规则");
  assert.match(n2.re, /^\^.*\$$/, "规则未锚定: " + n2.re);
  assert.match(n2.zh === undefined ? n2.to : n2.to, CJK);
  assert.match(n2.to, /\$1/, "规则译文应带 $1");
  const db = load("dbvar-bioproject").rules.find((r) => r.re.includes("BioProject - NCBI"));
  assert.ok(db, "dbvar-bioproject 缺 BioProject 标题规则");
  assert.match(db.re, /^\^.*\$$/);
  assert.match(db.to, CJK);
});

// 3) 模板卫生：pat 20–2200、无中文、zh 含中文、占位符 1..N 不重不漏
test("①-d 模板：pat 长度/无中文，zh 含中文，占位符与 pat 槽位一一对应", () => {
  const dicts = ["geo-docs", "medgen-gtr", "ncbi-dirs", "dbvar-bioproject"];
  let count = 0;
  for (const id of dicts) {
    for (const t of load(id).templates || []) {
      assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, "模板长度越界: " + id + " / " + t.pat.slice(0, 60));
      assert.doesNotMatch(t.pat, CJK, "pat 含中文: " + t.pat.slice(0, 60));
      assert.match(t.zh, CJK, "zh 无中文: " + t.pat.slice(0, 60));
      const have = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
      const used = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
      assert.deepEqual(used, have, "占位符不匹配: " + t.pat.slice(0, 60));
      assert.ok(have.length >= 1, "模板没有槽位: " + t.pat.slice(0, 60));
      count++;
    }
  }
  assert.ok(count >= 30, "校验模板只有 " + count + " 条");
});

// 4) 真实 DOM 片段：GEO FAQ 长段落（外层 <p> + 内联 <a>，取自 /geo/info/faq.html）
const GEO_P0 = `<p>
        The Gene Expression Omnibus (GEO) is a public repository that archives and freely distributes 
        comprehensive sets of microarray, next-generation sequencing, and other forms of high-throughput 
        functional genomic data submitted by the scientific community. In addition to data storage, 
        a collection of web-based interfaces and applications are available to help users query and 
        download the studies and gene expression patterns stored in GEO. For more information about various aspects of GEO, 
        please see our <a href="/geo/info/">documentation</a> listings and 
        <a href="https://pmc.ncbi.nlm.nih.gov/search/?term=10767856,4944384,3531084,3341798,3013736,2686538,2270403,1669752,1619900,1619899,539976,99122[UID]">publications</a>. 
    </p>`;
const GEO_P3 = `<p>
        Many journals require accession numbers for microarray or sequence data before acceptance of a paper for publication. 
        Also, reviewers and editors may need access to your data during the review process. 
        Thus, data should be deposited in GEO before a manuscript describing the data is sent to a journal for review. 
        GEO processing times is approximately 5 business days after completion of submission, 
        but may take longer around 
        <a href="https://en.wikipedia.org/wiki/Federal_holidays_in_the_United_States">federal holidays</a>, so it is important to 
        make your submission well in advance of when you require the accession numbers for your manuscript. 
        Your records may <a href="#holduntilpublished">remain private</a> until your manuscript (or preprint) is publicly available. 
        Once your submissions have been approved by GEO staff, you can <a href="/geo/info/linking.html">cite</a> the GEO accession number(s) 
        in your manuscript and you can generate a reviewer <a href="#revieweraccess">access token</a> 
        by which editors and reviewers can access your private GEO records. 
       </p>`;
const GEO_P5 = `<p>
        The GEO database has a flexible and open design that
        is responsive to developing trends. If you have questions about whether
        GEO can accept your data type, please do not hesitate to 
        <a href="mailto:geo@ncbi.nlm.nih.gov">contact us</a>.
    </p>`;

test("② GEO FAQ 真实段落：整段渲染为中文，链接节点保留", () => {
  const doc = mount("<body>" + GEO_P0 + "</body>", "ncbi-geo");
  const p = doc.querySelector("p");
  assert.match(flat(p.textContent), /基因表达综合数据库（GEO）是/);
  assert.match(flat(p.textContent), /归档并免费分发/);
  assert.doesNotMatch(flat(p.textContent), /The Gene Expression Omnibus \(GEO\) is a public repository/);
  assert.equal(p.querySelectorAll("a").length, 2, "模板替换后链接应保留");

  const doc3 = mount("<body>" + GEO_P3 + "</body>", "ncbi-geo");
  const t3 = flat(doc3.querySelector("p").textContent);
  assert.match(t3, /许多期刊要求在论文被接收发表前/);
  assert.match(t3, /记录可以保持私有/);
  assert.equal(doc3.querySelectorAll("p a").length, 4);

  const doc5 = mount("<body>" + GEO_P5 + "</body>", "ncbi-geo");
  assert.match(flat(doc5.querySelector("p").textContent), /GEO 数据库采用灵活开放的设计/);
  assert.match(flat(doc5.querySelector("p").textContent), /联系我们/);
});

// 5) GTR 高级检索帮助弹窗（<div> + 两个 <b> 槽位，取自 /gtr/ 页面）
test("② GTR 帮助弹窗：div 模板渲染为中文，CPT/临床类别槽位也翻", () => {
  const html = `<body><div id="advanced-search-help">Use the advanced search to build a more powerful query. You can find tests by many GTR fields including newly added fields, <b>CPT code</b> and <b>Clinical category</b>. Use the Boolean options AND, OR, and NOT to further refine your results.</div></body>`;
  const doc = mount(html, "ncbi-gtr");
  const text = flat(doc.body.textContent);
  assert.match(text, /使用高级检索可构建更强大的查询/);
  assert.match(text, /CPT 代码/);
  assert.match(text, /临床类别/);
  assert.doesNotMatch(text, /Use the advanced search to build a more powerful query/);
  assert.equal(doc.querySelectorAll("b").length, 2, "槽位元素应保留");
});

// 6) 提交门户 FAQ 段落（<p> + 一个文档链接，取自 submit.ncbi.nlm.nih.gov）
test("② 提交门户 FAQ：段落模板渲染为中文，邮箱原样保留", () => {
  const html = `<body><p>
                Please read the <a rel="noopener help" target="_blank" href="https://www.ncbi.nlm.nih.gov/sra/docs/sequence-data-processing/">
                NLM GenBank and SRA Data Processing document</a> which describes how sequence data are
                processed and made available to the public, responsibilities of the data submitter,
                responsibilities of NCBI, and defines data status. You may write to info@ncbi.nlm.nih.gov if you
                have questions about your submitted data or if you have questions about the document.
			</p></body>`;
  const doc = mount(html, "ncbi-submit");
  const text = flat(doc.body.textContent);
  assert.match(text, /请阅读 NLM GenBank 与 SRA 数据处理文档/);
  assert.match(text, /序列数据如何处理并向公众开放/);
  assert.match(text, /info@ncbi\.nlm\.nih\.gov/, "邮箱不应被改写");
  assert.equal(doc.querySelectorAll("a").length, 1);
});

// 7) dbVar 检索示例小标题（<h2> + <a>terms</a>）与 BioProject 首页标题
test("② dbVar 小标题/BioProject 标题：中文渲染", () => {
  const doc = mount(`<body><div class="portlet_title"><h2>Search Examples (additional <a href="/dbvar/content/help/#entrezsearch">terms</a>)</h2></div></body>`, "ncbi-dbvar");
  const text = flat(doc.querySelector("h2").textContent);
  assert.match(text, /检索示例（补充/);
  assert.match(text, /术语/);
  assert.equal(doc.querySelectorAll("h2 a").length, 1);

  const doc2 = mount("<head><title>Home - BioProject - NCBI</title></head><body><h1>BioProject</h1></body>", "ncbi-bioproject");
  assert.equal(doc2.title, "首页 - BioProject - NCBI", "BioProject 首页标题未翻");
});

// 8) Datasets 固定问句：句式翻成中文，物种名留在原位
test("② Datasets 问句：中文句式 + 物种名保持英文", () => {
  const doc = mount("<body><h3 class=\"MuiTypography-root\">What can you learn about Canis lupus familiaris (dog) in NCBI Datasets?</h3></body>", "ncbi-datasets");
  const text = flat(doc.querySelector("h3").textContent);
  assert.match(text, /在 NCBI Datasets 中，您可以了解/);
  assert.match(text, /哪些信息？/);
  assert.match(text, /Canis lupus familiaris \(dog\)/, "物种名应保持原文");
  assert.doesNotMatch(text, /What can you learn about/);
});

// 9) 负例：数据与专名保持英文（物种名、登录号、基因名、机构地址）
test("③ 负例：物种名/登录号/基因名/地址不翻", () => {
  const html = `<body>
    <dl><dd class="lng_ln">Homo sapiens</dd><dd class="lng_ln">Mus musculus</dd></dl>
    <div class="acc"><a href="/geo/query/acc.cgi?acc=GPL24676">GPL24676</a><span>GSE303191</span></div>
    <p class="note">The <b>BRCA1</b> gene encodes a protein.</p>
    <p class="addr">8600 Rockville Pike, Bethesda, MD 20894</p>
  </body>`;
  const doc = mount(html, "ncbi-geo");
  const text = flat(doc.body.textContent);
  for (const keep of ["Homo sapiens", "Mus musculus", "GPL24676", "GSE303191", "BRCA1", "8600 Rockville Pike", "Bethesda, MD 20894"]) {
    assert.ok(text.includes(keep), "不应改动数据：" + keep);
  }
});
