// NCBI Guide（/guide、/guide/all、/guide/sitemap、/home/about、/guide/browsers）补词回归（r56）
// 覆盖：资源目录说明整句、带内联链接的整段模板、sitemap 悬停说明（title 属性）、浏览器建议页、
// 「How do I …」任务条目、访问键规则，以及「资源名保留英文」的反向约束。
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
const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/ncbi-guide.json"), "utf8"));
const allDicts = fs
  .readdirSync(path.join(root, "../dict"))
  .filter((f) => f.endsWith(".json") && f !== "ncbi-guide.json")
  .map((f) => ({ id: f.replace(/\.json$/, ""), data: JSON.parse(fs.readFileSync(path.join(root, "../dict", f), "utf8")) }));

const site = sites.find((s) => s.id === "ncbi-guide") || {
  id: "ncbi-guide",
  hosts: ["www.ncbi.nlm.nih.gov"],
  path: "^(/guide|/home/about)",
  dicts: ["common", "ncbi", "ncbi-guide", "ncbi-new2", "ncbi-footer"],
  scope: "body",
  proseExempt: ".usa-banner, .usa-media_block-body, [class*=disclaimer]"
};

function stackData() {
  const data = { exact: {}, rules: [], templates: [] };
  for (const id of site.dicts) {
    const p = path.join(root, "../dict", id + ".json");
    if (!fs.existsSync(p)) continue;
    const b = JSON.parse(fs.readFileSync(p, "utf8"));
    Object.assign(data.exact, b.exact || {});
    data.rules = data.rules.concat(b.rules || []);
    data.templates = data.templates.concat(b.templates || []);
  }
  return data;
}

function run(html) {
  const dom = new JSDOM("<body>" + html + "</body>", { url: "https://www.ncbi.nlm.nih.gov/guide/" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data: stackData(), site });
  engine.start();
  return dom.window.document;
}
const flat = (doc) => doc.body.textContent.replace(/\s+/g, " ").trim();
const CJK = /[\u3400-\u9fff]/;

test("词库结构：条数、键值形态、短词与自映射拦截", () => {
  assert.equal(book.meta.family, "ncbi-guide");
  assert.ok(book.meta.sites.includes("www.ncbi.nlm.nih.gov"), "meta.sites 要声明 host");
  const exactCount = Object.keys(book.exact).length;
  assert.ok(exactCount >= 300, "exact 条数不足: " + exactCount);
  assert.ok(book.templates.length >= 10, "templates 条数不足: " + book.templates.length);
  assert.ok(book.rules.length >= 4, "rules 条数不足: " + book.rules.length);
  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(!CJK.test(k), "键里不能有中文: " + k);
    assert.ok(CJK.test(v), "译文里必须有中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "键首尾不能有空白: " + JSON.stringify(k));
    assert.equal(v, String(v).trim(), "值首尾不能有空白: " + JSON.stringify(k));
    assert.ok(k.length > 3, "不要单独收 3 字符以内的短词: " + JSON.stringify(k));
  }
});

test("规则是对象形态、可编译，且访问键规则命中", () => {
  for (const r of book.rules) {
    assert.equal(typeof r, "object");
    assert.equal(typeof r.re, "string");
    assert.equal(typeof r.to, "string");
    assert.ok(CJK.test(r.to), "规则译文里必须有中文: " + r.re);
    assert.ok(new RegExp(r.re).source.length > 0, "规则必须可编译: " + r.re);
    if (/\([^)]*\)/.test(r.re)) assert.ok(/\$\d/.test(r.to), "带捕获组的规则要用到占位符: " + r.re);
  }
  const doc = run("<p>Accesskey + 3</p>");
  assert.equal(flat(doc), "访问键 + 3");
});

test("模板槽位连续、原文无汉字、译文有汉字且不留英文句点", () => {
  for (const t of book.templates) {
    const used = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    const zhUsed = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.ok(used.length >= 1, "模板要带槽位: " + t.pat.slice(0, 40));
    assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, "模板长度越界: " + t.pat.length);
    assert.ok(!CJK.test(t.pat), "模板原文里不能有汉字: " + t.pat.slice(0, 40));
    assert.ok(CJK.test(t.zh), "模板译文里必须有中文: " + t.pat.slice(0, 40));
    assert.deepEqual(used.slice().sort((a, b) => a - b), used, "槽位必须从 1 连续: " + t.pat.slice(0, 40));
    assert.deepEqual(zhUsed.slice().sort((a, b) => a - b), used, "译文槽位要与原文一致: " + t.pat.slice(0, 40));
    assert.ok(!/[a-z]\.$/.test(t.zh.replace(/\{\{\d+\}\}/g, "")), "译文不要以英文句点结尾: " + t.pat.slice(0, 40));
    assert.ok(!/ (the|and|of|for|with) /i.test(t.zh), "译文里不要留英文连接词: " + t.zh.slice(0, 40));
  }
});

test("本册不新增跨册冲突：同名键的译文与其它册一致", () => {
  const clashes = [];
  for (const [k, v] of Object.entries(book.exact)) {
    for (const d of allDicts) {
      const other = d.data.exact && d.data.exact[k];
      if (other && other !== v) clashes.push(k + ": ncbi-guide=" + v + " / " + d.id + "=" + other);
    }
  }
  assert.deepEqual(clashes, [], "跨册同键译文不一致（会新增冲突组）：\n" + clashes.join("\n"));
});

test("资源目录说明整句译出（纯文本段，含专名保留）", () => {
  const cases = [
    [
      "A database providing information on the structure of assembled genomes, assembly names and other meta-data, statistical reports, and links to genomic sequence data.",
      ["已组装基因组", "统计报告"]
    ],
    [
      "A database of citations and abstracts for biomedical literature from MEDLINE and additional life science journals. Links are provided when full text versions of the articles are available via PubMed Central (described below) or other websites.",
      ["生物医学文献", "PubMed Central"]
    ],
    [
      "Finds regions of local similarity between biological sequences. The program compares nucleotide or protein sequences to sequence databases and calculates the statistical significance of matches. BLAST can be used to infer functional and evolutionary relationships between sequences as well as to help identify members of gene families.",
      ["局部相似", "BLAST"]
    ]
  ];
  for (const [en, wants] of cases) {
    const out = flat(run("<p>" + en + "</p>"));
    assert.ok(CJK.test(out), "未译: " + en.slice(0, 40));
    assert.ok(!out.includes(en.slice(0, 24)), "仍保留英文原句: " + en.slice(0, 40));
    for (const w of wants) assert.ok(out.includes(w), "译文缺少专名/关键词 " + w + " ← " + en.slice(0, 30));
  }
});

test("带 5 个内联链接的 GTR 段：整段中文、链接与 href 顺序不变", () => {
  const html =
    "<p>A resource to provide a public, tracked record of reported relationships between human variation and observed health status with supporting evidence. Related information in the " +
    '<a href="/gtr">NIH Genetic Testing Registry (GTR)</a>, <a href="/medgen">MedGen</a>, <a href="/gene">Gene</a>, ' +
    '<a href="/omim">OMIM</a>, <a href="/pubmed">PubMed</a> and other sources is accessible through hyperlinks on the records.</p>';
  const doc = run(html);
  const out = flat(doc);
  assert.ok(out.startsWith("该资源公开"), "整段没走模板通道: " + out.slice(0, 40));
  assert.ok(out.includes("支持证据"), "第二句丢失");
  const hrefs = [...doc.querySelectorAll("p a")].map((a) => a.getAttribute("href"));
  assert.deepEqual(hrefs, ["/gtr", "/medgen", "/gene", "/omim", "/pubmed"], "链接丢失或顺序变了");
  assert.equal(doc.querySelectorAll("p a").length, 5);
});

test("MedGen 段与 OMIM 段：链接保留、译文到位", () => {
  const medgen =
    "<p>A portal to information about medical genetics. MedGen includes term lists from multiple sources and organizes them into concept groupings and hierarchies. Links are also provided to information related to those concepts in the " +
    '<a href="/gtr">NIH Genetic Testing Registry (GTR)</a>, <a href="/clinvar">ClinVar</a>, <a href="/gene">Gene</a>, ' +
    '<a href="/omim">OMIM</a>, <a href="/pubmed">PubMed</a>, and other sources.</p>';
  const d1 = run(medgen);
  assert.ok(flat(d1).startsWith("医学遗传学信息的门户"), "MedGen 段首句未译");
  assert.equal(d1.querySelectorAll("p a").length, 5, "MedGen 段的 5 个链接应全部保留");

  const omim =
    "<p>A database of human genes and genetic disorders. NCBI maintains current content and continues to support its searching and integration with other NCBI databases. However, OMIM now has a new home at " +
    '<a href="https://omim.org">omim.org</a>, and users are directed to this site for full record displays.</p>';
  const d2 = run(omim);
  assert.ok(flat(d2).includes("人类基因与遗传病数据库"), "OMIM 段首句未译");
  assert.ok(flat(d2).includes("OMIM 现已迁至"), "OMIM 段迁移句未译");
  assert.equal(d2.querySelector('p a[href="https://omim.org"]').textContent, "omim.org", "域名链接文字不应改写");
});

test("NIHMS 段：PubMed Central 链接保留，制度性句子译出", () => {
  const html =
    "<p>The NIH Manuscript Submission (NIHMS) System is used to submit manuscripts that arise from NIH funding to the " +
    '<a href="/pmc/">PubMed Central</a> digital archive, in accordance with the NIH Public Access Policy and the law it implements. ' +
    "The law and Public Access Policy are intended to ensure that the public has access to the published results of NIH-funded research.</p>";
  const doc = run(html);
  const out = flat(doc);
  assert.ok(out.includes("NIH 稿件提交"), "NIHMS 句未译");
  assert.ok(out.includes("公共获取政策"), "公共获取政策句未译");
  assert.equal(doc.querySelector('p a[href="/pmc/"]').textContent, "PubMed Central");
});

test("sitemap 悬停说明（title 属性）译出且 href 不变", () => {
  const html = '<p><a href="/sview" title="An interactive, online display format for sequences, with an embeddable web version available.">Sequence Viewer</a></p>';
  const doc = run(html);
  const a = doc.querySelector("p a");
  assert.equal(a.getAttribute("href"), "/sview");
  const title = a.getAttribute("title");
  assert.ok(CJK.test(title), "title 未翻译: " + title);
  assert.ok(title.includes("可嵌入"), "title 译文不完整: " + title);
});

test("浏览器建议页：Please see the … 模板译出，链接文字也走中文", () => {
  const html = '<p>Please see the <a href="https://support.mozilla.org/js">JavaScript support page for Firefox</a>.</p>';
  const doc = run(html);
  const out = flat(doc);
  assert.ok(out.startsWith("请参阅"), "句首未走模板: " + out);
  assert.ok(out.includes("Firefox 的 JavaScript 支持页面"), "链接文字未译: " + out);
  assert.equal(doc.querySelectorAll("p a").length, 1);
});

test("How do I … 任务条目与访问键列表：条目译出、相邻专名保留", () => {
  const out1 = flat(run("<li><a href=\"/guide/all/#b\">Find the function of a gene or gene product</a></li>"));
  assert.equal(out1, "查找基因或基因产物的功能");
  const out2 = flat(run("<li>Automate BLAST searches performed on NCBI servers</li>"));
  assert.ok(out2.includes("自动化"), "任务条目未译: " + out2);
  assert.ok(out2.includes("BLAST"), "BLAST 应保留");
});

test("资源名与登录号类专名不被误翻", () => {
  const names = ["PubMed", "GenBank", "RefSeq", "dbGaP", "OMIM", "PubChem", "SRA", "ClinVar", "dbVar", "GTR"];
  for (const n of names) {
    const out = flat(run("<p>" + n + "</p>"));
    assert.equal(out, n, "资源名不应被翻译: " + n + " → " + out);
  }
  const acc = flat(run("<p>GSE12345</p>"));
  assert.equal(acc, "GSE12345");
});

test("页脚机构与地址不翻，正文说明句不受影响", () => {
  const html = "<p>8600 Rockville Pike Bethesda, MD 20894</p><p>NLM</p><p>NIH</p><p>HHS</p><p>USA.gov</p>";
  const out = flat(run(html));
  assert.ok(out.includes("8600 Rockville Pike"), "地址被翻: " + out);
  for (const n of ["NLM", "NIH", "HHS", "USA.gov"]) assert.ok(out.includes(n), n + " 被翻: " + out);
});

test("模板通道与 exact 通道不互相打架：同一段落只产出一种语言", () => {
  const docs = [
    '<p>Please see the <a href="/x">NLM Privacy Policy</a>.</p>',
    "<p>A registry and results database of publicly- and privately-supported clinical studies of human participants conducted around the world.</p>",
    '<p>Subscribe to Web/RSS feeds for updates about NCBI resources.</p>'
  ];
  for (const html of docs) {
    const out = flat(run(html));
    assert.ok(CJK.test(out), "未译: " + html);
    assert.ok(!/\b(the|and|of|for|with)\b/.test(out.replace(/[A-Za-z0-9.\-/]+/g, " ")), "残留英文连接词: " + out);
  }
});
