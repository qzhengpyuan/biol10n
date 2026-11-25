// NCBI Bookshelf 章节阅读页长尾（dict/books.json 的 r61 深挖册）：
// 章节导航、页面工具条、表格标题与表头、图注前缀、脚注标签，以及 ul.toc / .bk_sec 的保护。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/books.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "ncbi-books");

const CJK = /[\u4e00-\u9fff]/;

// 本章节页长尾新增的词条（顺序无关，只做存在性校验）
const DEEP_EXACT = {
  "GeneReviews Links": "GeneReviews 链接",
  "Key Sections in this GeneReview": "本 GeneReview 的关键章节",
  "Glossary": "术语表",
  "Resource Materials": "资源材料",
  "Author List": "作者列表",
  "For Current/Prospective Authors": "面向现任作者与准作者",
  "Personnel": "人员",
  "Download/Link to": "下载/链接到",
  "Contact Us": "联系我们",
  "GeneReviews by Title": "按书名浏览 GeneReviews",
  "GeneReviews Advanced Search": "GeneReviews 高级检索",
  "Bookshelf Copyright Notice": "Bookshelf 版权声明",
  "Related OMIM records": "相关 OMIM 记录",
  "PubMed Central citations": "PubMed Central 引用",
  "Links to PubMed": "PubMed 链接",
  "Locus Links": "基因座链接",
  "Gene(s)": "基因",
  "Disorder": "疾病",
  "Features of Disorder": "疾病特征",
  Evaluation: "评估",
  "System/Concern": "系统/关注点",
  "Manifestation/Concern": "表现/关注点",
  "Considerations/Other": "注意事项/其他",
  "Chromosome Locus": "染色体位点",
  "Locus-Specific Databases": "基因座特异性数据库",
  "DNA Nucleotide Change": "DNA 核苷酸变化",
  "Predicted Protein Change": "预测蛋白质变化",
  "Comment [Reference]": "注释 [参考文献]"
};

// 运行时按 sites.json 的 dicts 顺序合并（common 打底、books 覆盖），与 boot.js 一致；
// 章节页的导航与工具条文案多数来自 common/ncbi，只喂 books 会测出假阴性。
const merged = { exact: {}, rules: [], templates: [] };
for (const id of site.dicts || ["common"]) {
  const d = JSON.parse(fs.readFileSync(path.join(root, "../dict", id + ".json"), "utf8"));
  Object.assign(merged.exact, d.exact || {});
  for (const r of d.rules || []) merged.rules.push(r);
  for (const t of d.templates || []) merged.templates.push(t);
}

function engineFor(html, url) {
  const dom = new JSDOM(html, { url: url || "https://www.ncbi.nlm.nih.gov/books/NBK1440/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: merged,
    site
  });
  engine.start();
  return { doc: dom.window.document, engine };
}

test("词库卫生：exact 全部含汉字、key 不含中文、值里没有明文 URL/邮箱", () => {
  const keys = Object.keys(dict.exact);
  assert.ok(keys.length >= 190, "exact 只有 " + keys.length + " 条");
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.match(v, CJK, "译文不含汉字: " + k + " => " + v);
    assert.doesNotMatch(k, CJK, "key 含中文: " + k);
    assert.doesNotMatch(v, /https?:\/\//i, "值含明文 URL: " + k);
    assert.doesNotMatch(v, /[\w.+-]+@[\w-]+\.[\w.]+/, "值含明文邮箱: " + k);
  }
});

test("章节页长尾条目存在且译文与原条目口径一致", () => {
  for (const [k, v] of Object.entries(DEEP_EXACT)) {
    assert.equal(dict.exact[k], v, "条目不符: " + k);
  }
  for (const r of dict.rules) assert.doesNotThrow(() => new RegExp(r.re), "坏正则: " + r.re);
  for (const r of dict.rules) assert.match(r.to, CJK, "规则译文不含汉字: " + r.re);
  for (const t of dict.templates || []) {
    assert.match(t.zh, CJK, "模板译文不含汉字: " + t.pat);
    assert.match(t.pat, /\{\{1\}\}/, "模板没有占位符: " + t.pat);
  }
});

test("新增词条不引入跨册冲突：同名 key 在其它册里必须同值", () => {
  const dir = path.join(root, "../dict");
  const others = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "books.json")
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
  for (const [k, v] of Object.entries(DEEP_EXACT)) {
    for (const o of others) {
      if (o.exact && k in o.exact) assert.equal(o.exact[k], v, "跨册冲突: " + k + " => " + JSON.stringify(o.exact[k]));
    }
  }
});

test("章节导航：上一页/下一页、目录、相关信息、本页内容、引用本页都译出", () => {
  const { doc, engine } = engineFor(
    '<div class="pagination bk_noprnt"><span class="inactive page_link prev">Previous</span>' +
      '<a class="active page_link next" href="/books/n/handbook2e/editors/" title="Next page in this title">Next</a></div>' +
      '<div class="post-content"><div class="half_rhythm"><a href="/books/about/copyright/">Copyright Notice</a></div>' +
      '<div class="small"><span class="label">Bookshelf ID: NBK143764</span></div></div>' +
      '<div id="rightcolumn"><div class="portlet_title"><h3><span>Related information</span></h3></div>' +
      '<div class="portlet_title"><h3><span>In this page</span></h3></div>' +
      '<ul class="simple-list"><li><a href="/books/NBK1440/">Cite this Page</a></li>' +
      '<li><a href="/books/NBK1440/pdf/">PDF version of this page</a></li></ul></div>'
  );
  assert.equal(doc.querySelector(".page_link.prev").textContent, "上一页");
  assert.equal(doc.querySelector(".page_link.next").textContent, "下一页");
  assert.equal(doc.querySelector(".page_link.next").getAttribute("title"), "本书的下一页");
  assert.equal(doc.querySelector(".post-content a").textContent, "版权声明");
  assert.equal(doc.querySelector(".post-content .label").textContent, "书架 ID：NBK143764");
  const right = doc.querySelector("#rightcolumn").textContent;
  assert.match(right, /相关信息/);
  assert.match(right, /本页内容/);
  assert.match(right, /引用本页/);
  assert.match(right, /本页 PDF 版/);
  assert.equal(engine.translateText("Contents"), "目录");
});

test("页面工具条：版权声明对话框里的版权页链接、分享文案、引文来源行", () => {
  const { doc } = engineFor(
    '<div id="_ncbi_dlg_cpyrght_NBK1440" class="ui-dialog-content">' +
      '<div>This publication is in the public domain. For more information, see the ' +
      '<a href="/books/about/copyright/">Bookshelf Copyright Notice</a>.</div></div>' +
    '<div id="ncbi_share_box"><label id="ncbi_share_label">Share</label>' +
      '<span class="clearfix"><label for="ncbi_share_inp" id="ncbi_share_url_label">URL</label>' +
      '<input type="text" id="ncbi_share_inp"></span></div>' +
    '<div id="_ncbi_dlg_citbx_NBK1440" class="ui-dialog-content"><div class="bk_tt">Barton JC, Parker CJ. HFE-Related Hemochromatosis. 2000 Apr 3 [Updated 2024 Apr 11]. In: ' +
      '<span class="bk_cite_avail"> Available from: https://www.ncbi.nlm.nih.gov/books/NBK1440/</span></div></div>'
  );
  const dlg = doc.querySelector("#_ncbi_dlg_cpyrght_NBK1440 div");
  assert.equal(dlg.textContent, "本出版物属于公有领域。更多信息请参见Bookshelf 版权声明。");
  assert.ok(dlg.querySelector("a"), "版权页链接必须保留");
  assert.match(doc.querySelector("#ncbi_share_box").textContent, /分享/);
  // URL 是地址本身，按口径保留英文
  assert.equal(doc.querySelector("#ncbi_share_url_label").textContent, "URL");
  // 引文里的「作者 / 题名 / 日期 / 期刊」属题录，按口径保持英文
  const cite = doc.querySelector(".bk_tt").textContent;
  assert.match(cite, /^Barton JC, Parker CJ\. HFE-Related Hemochromatosis\. 2000 Apr 3 \[Updated 2024 Apr 11\]\./);
  assert.ok(cite.includes("https://www.ncbi.nlm.nih.gov/books/NBK1440/"), "引文 URL 原样保留");
});

test("表格标题前缀：Table A. / Table B. 与数字表号、图注前缀同口径", () => {
  const { doc, engine } = engineFor(
    '<div class="tbl"><span class="label">Table A.</span><div class="caption"><p>HFE-Related Hemochromatosis: Genes and Databases</p></div></div>' +
      '<div class="tbl"><span class="label">Table B.</span></div>' +
      '<div class="tbl"><span class="label">Table 6.</span></div>' +
      '<div class="fig"><span class="label">Figure 1.</span><p class="float-caption">Use of serum ferritin concentration to direct management.</p></div>'
  );
  const labels = [...doc.querySelectorAll("span.label")].map((s) => s.textContent.trim());
  assert.deepEqual(labels, ["表 A.", "表 B.", "表 6.", "图 1."]);
  // 表题正文是章节内容（长正文），保持英文
  assert.equal(doc.querySelector(".caption p").textContent, "HFE-Related Hemochromatosis: Genes and Databases");
  assert.equal(engine.translateText("Table 6."), "表 6.");
  assert.equal(engine.translateText("Figure 1."), "图 1.");
  assert.equal(engine.translateText("Table A."), "表 A.");
});

test("表头（纯文本）：GeneReviews 固定表头逐列译出，基因名与 MOI 保持原文", () => {
  const { doc } = engineFor(
    '<table><thead><tr><th>Gene(s)</th><th>Disorder</th><th>MOI</th><th>Features of Disorder</th></tr>' +
      '<tr><th>System/Concern</th><th>Evaluation</th><th>Manifestation/Concern</th><th>Considerations/Other</th></tr></thead>' +
      '<tbody><tr><th>Chromosome Locus</th><th>Locus-Specific Databases</th><th>DNA Nucleotide Change</th>' +
      '<th>Predicted Protein Change</th><th>Comment [Reference]</th></tr></tbody></table>'
  );
  const ths = [...doc.querySelectorAll("th")].map((t) => t.textContent.trim());
  assert.deepEqual(ths, [
    "基因", "疾病", "MOI", "疾病特征",
    "系统/关注点", "评估", "表现/关注点", "注意事项/其他",
    "染色体位点", "基因座特异性数据库", "DNA 核苷酸变化", "预测蛋白质变化", "注释 [参考文献]"
  ]);
});

test("表头（被 <i>/<sup> 切碎）：模板把内联子元素原位放回，不产生半中半英", () => {
  const { doc } = engineFor(
    '<table><thead><tr>' +
      '<th>Overlapping w/<i>HFE</i> HC</th>' +
      '<th>Distinguishing from <i>HFE</i> HC</th>' +
      '<th>Proportion of Pathogenic Alleles&nbsp;<sup>2</sup> Identified by Method</th>' +
      '</tr></thead></table>'
  );
  const ths = [...doc.querySelectorAll("th")];
  assert.equal(ths[0].textContent, "与 HFE HC 重叠");
  assert.equal(ths[0].querySelector("i").textContent, "HFE");
  assert.equal(ths[1].textContent, "与 HFE HC 鉴别");
  assert.equal(ths[1].querySelector("i").textContent, "HFE");
  assert.equal(ths[2].textContent, "按方法识别的致病等位基因占比2");
  assert.equal(ths[2].querySelector("sup").textContent, "2", "脚注上标必须留在原位");
});

test("固定说明句（被链接切碎）：视频介绍与版本说明两条模板", () => {
  const { doc } = engineFor(
    '<ul class="simple-list">' +
      '<li class="half_rhythm"><div>Please see the ' +
      '<a href="https://www.youtube.com/watch?v=BCG-M5k-gvE" role="button">E-utilities Introduction</a>' +
      ' video for a brief introduction.</div></li>' +
      '<li class="half_rhythm"><div>Please see the ' +
      '<a href="/books/n/helpeutils/chapter4/#chapter4.Release_Notes">Release Notes</a>' +
      ' for details and changes.</div></li></ul>'
  );
  const divs = [...doc.querySelectorAll("li > div")];
  assert.equal(divs[0].textContent, "请观看E-utilities Introduction视频了解简要介绍。");
  assert.ok(divs[0].querySelector("a"), "视频链接必须保留");
  assert.equal(
    divs[0].querySelector("a").getAttribute("href"),
    "https://www.youtube.com/watch?v=BCG-M5k-gvE"
  );
  assert.equal(divs[1].textContent, "详情与变更请参见版本说明。");
  assert.ok(divs[1].querySelector("a"), "版本说明链接必须保留");
});

test("ul.toc 保护：章节目录标题保持英文，日期行照旧译出（common 不越界）", () => {
  const { doc } = engineFor(
    '<ul class="simple-list toc toc-toggle">' +
      '<li><a class="toc-item" href="/books/n/handbook2e/editors/">Editors and Reviewers</a></li>' +
      '<li><a class="toc-item" href="/books/n/handbook2e/fm.history/">A Brief History of NCBI’s Formation and Growth</a>' +
      '<div>Kent Smith.</div></li>' +
      '<li><a class="toc-item" href="/books/n/handbook2e/Literature/">Literature</a>' +
      '<ul class="simple-list toc bktoc_lst_exp"><li><a class="toc-item" href="/books/n/handbook2e/AboutLiterature/">Introduction</a></li>' +
      '<li><a class="toc-item" href="/books/n/handbook2e/Summary/">Summary</a></li></ul>' +
      '<div class="small">Created: Nov 14, 2013.</div></li></ul>'
  );
  const titles = [...doc.querySelectorAll("ul.toc a.toc-item")].map((a) => a.textContent);
  assert.deepEqual(titles, [
    "编辑与审稿人", // skipFree：编辑名单页是界面入口
    "A Brief History of NCBI’s Formation and Growth",
    "Literature",
    "Introduction",
    "Summary"
  ]);
  // 章节标题是正文，不能被 common 的单字词条（Introduction/Summary）二次翻坏
  assert.equal(doc.querySelectorAll(".toc-item")[3].textContent, "Introduction");
  assert.equal(doc.querySelectorAll(".toc-item")[4].textContent, "Summary");
  assert.equal(doc.querySelector(".small").textContent, "创建于 2013 年 11 月 14 日。");
});

test(".bk_sec 正文保护：段落正文不翻，标题只由 common 处理一次、不再叠翻", () => {
  const { doc, engine } = engineFor(
    '<div class="bk_sec"><h2>Introduction</h2>' +
      '<p>The HFE gene encodes a protein that regulates iron absorption in the small intestine.</p>' +
      '<p>Table 1 lists the methods used to identify pathogenic alleles in this chapter.</p></div>'
  );
  const ps = [...doc.querySelectorAll(".bk_sec p")].map((p) => p.textContent);
  assert.equal(ps[0], "The HFE gene encodes a protein that regulates iron absorption in the small intestine.");
  // 正文里的 Table 1 是句内引用：宁可留英文，也不要「…see 表 1 for…」的半中半英
  assert.equal(ps[1], "Table 1 lists the methods used to identify pathogenic alleles in this chapter.");
  assert.equal(doc.querySelector(".bk_sec h2").textContent, "简介", "标题由 common 翻一次");
  assert.equal(engine.translateText("简介"), null, "已是中文的标题不得再叠翻");
});

test("不翻清单：书名/题录/作者/机构/章节标题/表格题名/DOI 保持原文", () => {
  const { engine } = engineFor("<p>x</p>");
  const keep = [
    "The NCBI Handbook [Internet]. 2nd edition.",
    "Adam MP, Bick S, Mirzaa GM, et al., editors.",
    "Seattle (WA): University of Washington, Seattle; 1993-2026.",
    "A Brief History of NCBI’s Formation and Growth",
    "Searching a Database",
    "HFE-Related Hemochromatosis: Treatment of Manifestations",
    "Molecular Genetic Testing Used in HFE-Related Hemochromatosis",
    "MOI",
    "doi: 10.1038/ng.2007.52",
  ];
  for (const s of keep) {
    assert.equal(engine.translateText(s), null, "不该翻: " + s);
  }
  // PMID 这类登录号：只允许标签本地化，编号必须原样
  assert.equal(engine.translateText("PMID: 20301613"), "PMID：20301613");
});

test("工具条按钮不再二次翻：已译中文标题、已译按钮保持稳定", () => {
  const { engine } = engineFor("<p>x</p>");
  assert.equal(engine.translateText("引用本页"), null);
  assert.equal(engine.translateText("本页 PDF 版"), null);
  assert.equal(engine.translateText("Gem"), null);
});
