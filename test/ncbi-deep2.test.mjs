// NCBI 深页补漏词库（ncbi-deep2）回归：结构、规则/模板、以及 GTR 基因页 / MedGen 记录页 / BioSample / CCDS / Datasets 基因组页的 jsdom 渲染
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, "../dict", f), "utf8"));

const dict = read("ncbi-deep2.json");
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;
const SITE = { scope: "body", block: "pre, code", rescan: false };

// 站点真实词库栈：按各页 config/sites.json 里挂的册子 + 本册
function stack(...books) {
  const exact = {}, rules = [], templates = [];
  for (const f of books) {
    const p = path.join(root, "../dict", f + ".json");
    if (!fs.existsSync(p)) continue;
    const d = read(f + ".json");
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
    templates.push(...(d.templates || []));
  }
  exact && Object.assign(exact, dict.exact || {});
  rules.push(...(dict.rules || []));
  templates.push(...(dict.templates || []));
  return { exact, rules, templates };
}

function boot(html, books, url) {
  const dom = new JSDOM(html, { url: url || "https://www.ncbi.nlm.nih.gov/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: stack(...books),
    site: SITE
  });
  engine.start();
  return { dom, engine, doc: dom.window.document };
}

// 只跑单条规则（捕获组按词表翻一层），用来断言规则行为
function applyRule(reStr, to, input, lookup) {
  const m = new RegExp(reStr).exec(input);
  if (!m) return null;
  return to.replace(/\$(\d)/g, (_, d) => {
    const seg = m[Number(d)] ?? "";
    return lookup && Object.prototype.hasOwnProperty.call(lookup, seg) ? lookup[seg] : seg;
  });
}
const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();

test("词库结构：主机、条目量级、字段规整", () => {
  assert.deepEqual(dict.meta.sites, ["www.ncbi.nlm.nih.gov"]);
  assert.equal(dict.meta.family, "ncbi-deep2");
  assert.match(dict.meta.version, /^\d+\.\d+\.\d+$/);
  const exact = Object.entries(dict.exact || {});
  assert.ok(exact.length >= 60, "exact 条目太少: " + exact.length);
  assert.ok((dict.rules || []).length >= 10, "规则太少: " + (dict.rules || []).length);
  assert.ok((dict.templates || []).length >= 1, "缺模板");

  const bad = [];
  for (const [en, zh] of exact) {
    if (!en || en !== en.trim()) bad.push("键首尾空白: " + JSON.stringify(en));
    if (CJK.test(en)) bad.push("键含中文: " + en);
    if (!zh || zh !== zh.trim()) bad.push("空译文或首尾空白: " + en);
    if (!CJK.test(zh) && !/^[A-Za-z0-9 .,%()（）:：\-]+$/.test(zh)) bad.push("译文既无中文也非占位串: " + en);
    if (en === zh) bad.push("自映射: " + en);
    if (/https?:\/\/|www\.[a-z]/i.test(zh)) bad.push("译文含 URL: " + en);
    if (/\{\{\d+\}\}/.test(zh)) bad.push("exact 里混入占位符: " + en);
  }
  assert.deepEqual(bad, []);
});

test("规则：正则合法、译文有中文、占位符不超出捕获组", () => {
  const bad = [];
  // 纯品牌标签（OMIM®:）与整串单词标签（Release）不含汉字、也没有捕获组，属有意为之
  const BRAND_ROWS = new Set(["^OMIM®:$", "^Release$"]);
  for (const r of dict.rules || []) {
    if (!r.re || !r.to) { bad.push("缺字段: " + JSON.stringify(r)); continue; }
    let re;
    try { re = new RegExp(r.re); } catch (e) { bad.push("正则非法: " + r.re); continue; }
    if (!CJK.test(r.to) && !BRAND_ROWS.has(r.re)) bad.push("规则译文无中文: " + r.re);
    if (/https?:\/\/|www\./.test(r.to)) bad.push("规则译文含 URL: " + r.re);
    const slots = [...r.to.matchAll(/\$(\d)/g)].map((m) => Number(m[1]));
    const groups = (re.source.match(/\((?!\?)/g) || []).length;
    if (!groups && !BRAND_ROWS.has(r.re)) bad.push("规则没有捕获组: " + r.re);
    for (const n of slots) if (n > groups) bad.push("占位符超出捕获组: " + r.re);
  }
  assert.deepEqual(bad, []);
});

test("模板：占位符编号连续、与译文一一对应、长度合规", () => {
  const bad = [];
  for (const t of dict.templates || []) {
    if (!t.pat || !t.zh) { bad.push("缺字段: " + JSON.stringify(t)); continue; }
    if (t.pat.length < 20 || t.pat.length > 2200) bad.push("pat 长度不合规: " + t.pat.length);
    if (!CJK.test(t.zh)) bad.push("模板译文无中文: " + t.pat.slice(0, 40));
    if (/https?:\/\/|www\./.test(t.zh)) bad.push("模板译文含 URL: " + t.pat.slice(0, 40));
    const slots = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    const used = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    if (!slots.length) { bad.push("pat 无占位符: " + t.pat.slice(0, 40)); continue; }
    if (slots.join(",") !== slots.map((_, i) => i + 1).join(",")) bad.push("pat 编号不连续");
    if (slots.join(",") !== used.join(",")) bad.push("译文占位符不匹配: " + t.pat.slice(0, 40));
  }
  assert.deepEqual(bad, []);
});

test("关键条目：GTR / MedGen / BioSample / CCDS / Datasets 三类形态齐备", () => {
  const must = [
    // GTR
    "See all available tests in GTR for this gene", "See labs", "Triplosensitivity",
    "Haploinsufficency", "Total number of exons:", "Genomic Sequence", "Graphics",
    "MedGen:", "OMIM:", "GeneReviews:", "Copy number response", "Genomic context",
    "Related articles in PubMed", "Content on this page", "Go to nucleotide",
    // MedGen（记录页字段标签）
    "Synonyms:", "Modes of inheritance:", "Gene (location):", "Orphanet:",
    "Term Hierarchy", "Suggested Reading", "Recent systematic reviews",
    "Disease characteristics", "Additional descriptions", "Finding",
    "Congenital Abnormality", "Anatomical Abnormality",
    // BioSample
    "Package", "Attributes", "HapMap (table)", "Full XML (text)",
    "BioProject links", "Links to SRA experiments", "Links to Taxonomy",
    // CCDS
    "for", "in", "and",
    // Datasets 基因组
    "NCBI Datasets", "Genomic data available from NCBI Datasets", "Annotated",
    "Latest eukaryotic RefSeq annotations", "Annotation in progress", "Freeze date",
    "Recently completed", "Try examples:", "All Genomes"
  ];
  const BRAND_KEYS = new Set(["MedGen:", "OMIM:", "GeneReviews:", "Orphanet:"]);
  for (const k of must) {
    assert.ok(Object.prototype.hasOwnProperty.call(dict.exact, k), "缺条目: " + k);
    if (!BRAND_KEYS.has(k)) assert.ok(CJK.test(dict.exact[k]), "译文无中文: " + k);
  }
  // 原文拼写如此（Haploinsufficency），不得"顺手修正"成正确拼写
  assert.ok(!("Haploinsufficiency" in dict.exact), "不得收录拼写正确的变体");
  // OMIM®: 被 <span class="superscript">®</span> 拆开，只能走规则
  assert.ok((dict.rules || []).some((r) => r.re === "^OMIM®:$"), "缺 OMIM®: 规则");
  // 页面全角冒号变体（词库半角版命不中的形态）
  assert.equal(dict.exact["Synonyms："], "同义词：");
  assert.equal(dict.exact["Modes of inheritance："], "遗传方式：");
  assert.equal(dict.exact["Gene (location)："], "基因（位置）：");
});

test("规则行为：Gene ID / 基因类型 / 基因记录链接 / 证据句 / Release", () => {
  const find = (s) => (dict.rules || []).find((r) => r.re === s);
  const gid = find("^Gene ID: (\\d+), updated on (.+)$");
  assert.ok(gid, "缺 Gene ID 规则");
  assert.equal(applyRule(gid.re, gid.to, "Gene ID: 672, updated on 17-Nov-2026"), "基因 ID：672，更新于 17-Nov-2026");

  const gt = find("^Gene type: (.+)$");
  assert.ok(gt, "缺 Gene type 规则");
  assert.equal(applyRule(gt.re, gt.to, "Gene type: protein coding", dict.exact), "基因类型：蛋白编码");

  const rec = find("^Go to complete Gene record for (.+)$");
  assert.ok(rec, "缺完整基因记录规则");
  assert.equal(applyRule(rec.re, rec.to, "Go to complete Gene record for BRCA1"), "前往 BRCA1 的完整基因记录");

  const vv = find("^Go to Variation Viewer for (.+) variants$");
  assert.ok(vv, "缺变异查看器规则");
  assert.equal(applyRule(vv.re, vv.to, "Go to Variation Viewer for BRCA1 variants"), "前往 BRCA1 变异的变异查看器");
  assert.equal(applyRule(vv.re, vv.to, "Go to Variation Viewer for TP53 variants"), "前往 TP53 变异的变异查看器");

  const nev = find("^No evidence available \\(Last evaluated (.+)\\)$");
  assert.ok(nev, "缺无证据规则");
  assert.equal(applyRule(nev.re, nev.to, "No evidence available (Last evaluated 2021-09-23)"), "暂无证据（最后评估：2021-09-23）");

  const rel = find("^Release$");
  assert.ok(rel, "缺 Release 规则（exact 会与既有词库跨册冲突，故走规则）");
  assert.equal(applyRule(rel.re, rel.to, "Release"), "版本");
  assert.equal(applyRule(rel.re, rel.to, "Release date"), null, "规则必须只命中裸 Release");
});

test("引擎：GTR 基因页（整串标签、计数规则、基因符号保留）", () => {
  const { doc } = boot(
    "<div class='rprt'><h1 class='g_title'>BRCA1 DNA repair associated</h1>" +
      "<span class='geneid'>Gene ID: 672, updated on 17-Nov-2026</span><br>" +
      "<span class='geneid'>Gene type: protein coding</span></div>" +
      "<div class='extra_links'><ul>" +
      "<li><a href='/gtr/genes/672/'>See all available tests in GTR for this gene</a></li>" +
      "<li><a href='/gene/672/'>Go to complete Gene record for BRCA1</a></li>" +
      "<li><a href='/variation/view/'>Go to Variation Viewer for BRCA1 variants</a></li>" +
      "</ul></div>" +
      "<table><tbody>" +
      "<tr><td>Copy number response<div><span>Triplosensitivity</span>" +
      "<div><p>No evidence available (Last evaluated 2021-09-23)</p></div></div></td></tr>" +
      "<tr><td>Haploinsufficency<div><p>Sufficient evidence for dosage pathogenicity (Last evaluated 2021-09-23)</p></div></td></tr>" +
      "<tr><td><a href='/gtr/?gene=672'>See labs</a></td></tr>" +
      "</tbody></table>" +
      "<dl class='chr_location'><dt>Location:</dt><dd>17q21.31</dd>" +
      "<dt>Total number of exons:</dt><dd>31</dd></dl>" +
      "<div class='choose'><label class='label' for='acc'>Genomic Sequence</label></div>" +
      "<p class='note-link'><strong>Go to nucleotide</strong><a href='/nuccore/x'>Graphics</a></p>",
    ["common", "medgen-gtr", "ncbi-new2", "ncbi-dirs"]
  );
  const text = norm(doc.body.textContent);
  assert.match(text, /基因 ID：672，更新于 17-Nov-2026/);
  assert.match(text, /基因类型：蛋白编码/);
  assert.ok(!text.includes("Gene ID:"), "Gene ID 标签没翻");
  assert.doesNotMatch(text, /Gene type:/);

  const links = [...doc.querySelectorAll(".extra_links a")].map((a) => a.textContent);
  assert.equal(links[0], "在 GTR 中查看该基因的全部可用检测");
  assert.equal(links[1], "前往 BRCA1 的完整基因记录", "基因符号必须原样保留");
  assert.equal(links[2], "前往 BRCA1 变异的变异查看器");
  assert.equal(doc.querySelector("h1").textContent, "BRCA1 DNA repair associated", "基因全名不得翻");

  assert.ok(text.includes("查看实验室"), "See labs 没翻");
  assert.ok(text.includes("三倍体敏感性"));
  assert.ok(text.includes("单倍剂量不足"));
  assert.ok(text.includes("暂无证据（最后评估：2021-09-23）"));
  assert.ok(text.includes("剂量致病性证据充分（最后评估：2021-09-23）"));
  assert.ok(text.includes("外显子总数：31"));
  assert.equal(doc.querySelector("label.label").textContent, "基因组序列");
  assert.equal(doc.querySelectorAll("p.note-link a")[0].textContent, "图形");
  assert.equal(doc.querySelectorAll("p.note-link strong")[0].textContent, "前往核苷酸记录");
  assert.equal(doc.querySelector("dd").textContent, "17q21.31", "细胞遗传学位置不得翻");
});

test("引擎：MedGen 记录页（标签逐条命中、OMIM 拆分、help 图标保留）", () => {
  const { doc } = boot(
    "<div class='aux'><dl class='rprtid'><dt>MedGen UID: </dt><dd>44287</dd>" +
      "<dt><span class='dotprefix'> •</span>Concept ID: </dt><dd><a href='/medgen/docs/overview/'>C0024796</a></dd>" +
      "<dd>Disease or Syndrome</dd></dl></div>" +
      "<table class='medgenTable'><tbody>" +
      "<tr><td>Synonyms:</td><td>FBN1-Related Marfan Syndrome; MFS</td></tr>" +
      "<tr><td><span class='bold'>SNOMED CT: </span></td><td>Marfan syndrome (19346006)</td></tr>" +
      "<tr><td>Modes of inheritance:</td><td><strong>Autosomal dominant inheritance</strong></td></tr>" +
      "<tr><td><a class='help jig-ncbi-popper s_TOP' data-jig='ncbipopper' href='#target-gene-loc' role='button' aria-expanded='false'>Gene (location):<img class='pulldown' src='//static.pubmed.gov/x.png'></a></td><td>FBN1 (15q21.1)</td></tr>" +
      "<tr><td>Monarch Initiative:</td><td><a href='https://monarchinitiative.org/disease/MONDO:0007947'>MONDO:0007947</a></td></tr>" +
      "<tr><td>OMIM<span class='superscript'>®</span>:</td><td>154700</td></tr>" +
      "<tr><td>Orphanet:</td><td>ORPHA558</td></tr>" +
      "<tr><td>Term Hierarchy</td><td>Suggested Reading</td></tr>" +
      "</tbody></table>" +
      "<div class='divPopper rprt'><dl><dd>Finding</dd><dd>Congenital Abnormality</dd><dd>Anatomical Abnormality</dd></dl></div>" +
      "<div class='spaceAbove nowrap'>See: <a href='/medgen/2047'>Aortic aneurysm</a></div>",
    ["common", "medgen-gtr", "ncbi-new2", "clinvar-core"]
  );
  const tds = [...doc.querySelectorAll("td")];
  const labels = tds.filter((_, i) => i % 2 === 0).map((td) => norm(td.textContent));
  const values = tds.filter((_, i) => i % 2 === 1).map((td) => norm(td.textContent));
  assert.equal(labels[0], "同义词：");
  assert.equal(labels[1], "SNOMED CT：", "SNOMED CT 由 ncbi-new2 覆盖");
  assert.equal(labels[2], "遗传方式：");
  assert.equal(labels[3], "基因（位置）：", "help 链接里的标签必须整条命中");
  assert.equal(labels[4], "Monarch Initiative：", "MedGen 记录页标签由 medgen-gtr 覆盖");
  assert.equal(labels[5], "OMIM®：", "被 superscript 拆开的整串只能靠规则 + 整块拼接");
  assert.equal(labels[6], "Orphanet：");
  assert.equal(labels[7], "术语层级");
  assert.equal(values[7], "推荐阅读");
  assert.equal(values[3], "FBN1 (15q21.1)", "基因与位置不得翻");
  assert.equal(values[5], "154700", "OMIM 编号不得翻");

  const help = doc.querySelector("a.help");
  assert.equal(help.textContent, "基因（位置）：");
  assert.ok(help.querySelector("img.pulldown"), "help 图标不能丢");
  assert.ok(!doc.querySelector("td .superscript"), "OMIM 上标被并入整串后不留残片");

  const dd = [...doc.querySelectorAll("dd")].map((x) => x.textContent);
  assert.ok(dd.includes("发现"));
  assert.ok(dd.includes("先天性异常"));
  assert.ok(dd.includes("解剖学异常"));
  assert.ok(norm(doc.querySelector("dt").textContent).startsWith("MedGen UID"));
  assert.match(norm(doc.body.textContent), /参见：\s*Aortic aneurysm/);
  assert.match(norm(doc.body.textContent), /疾病或综合征/);
});

test("引擎：BioSample 记录页（字段标签、下载格式、相关链接气泡）", () => {
  const { doc } = boot(
    "<div class='rprt'><h2 class='title'>16S rRNA gene sequencing of Mus musculus microbiota</h2>" +
      "<dl><dt>Identifiers</dt><dd>BioSample: SAMN15590423</dd>" +
      "<dt>Organism</dt><dd>mouse metagenome</dd>" +
      "<dt>Package</dt><dd><a>MIMARKS: survey, host-associated; version 6.0</a></dd>" +
      "<dt>Attributes</dt><dd>not applicable</dd></dl>" +
      "<fieldset class='format'><legend>Format</legend><ul>" +
      "<li><label>HapMap (table)</label></li><li><label>BioSample ID list</label></li></ul></fieldset>" +
      "<div class='submenu file'><select><option>Full XML (text)</option></select></div>" +
      "<ul class='brieflinkpopper'><li><a>BioProject</a><div class='brieflinkpop'>BioProject links</div></li>" +
      "<li><a>SRA</a><div class='brieflinkpop'>Links to SRA experiments</div></li>" +
      "<li><a>Taxonomy</a><div class='brieflinkpop'>Links to Taxonomy</div></li></ul></div>",
    ["common", "ncbi-dirs", "ensembl-extra"]
  );
  const dts = [...doc.querySelectorAll("dt")].map((x) => x.textContent);
  assert.deepEqual(dts, ["标识符", "物种", "数据包", "属性"]);
  assert.equal(doc.querySelectorAll("dl dd")[0].textContent, "BioSample: SAMN15590423", "样本登录号不得翻");

  const labels = [...doc.querySelectorAll("label")].map((x) => x.textContent);
  assert.equal(labels[0], "HapMap（表格）");
  assert.equal(labels[1], "BioSample ID 列表");

  const opts = [...doc.querySelectorAll("option")].map((x) => x.textContent);
  assert.equal(opts[0], "完整 XML（文本）");
  assert.equal(doc.querySelector("option").getAttribute("value"), null, "option 的 value 不动");

  const pops = [...doc.querySelectorAll(".brieflinkpop")].map((x) => x.textContent);
  assert.deepEqual(pops, ["BioProject 链接", "SRA 实验链接", "分类学链接"]);
});

test("引擎：CCDS 检索表单（for / in / and 三个单词标签）", () => {
  const { doc } = boot(
    "<table><tbody><tr>" +
      "<td class='SMALL1'><label for='search'>Search</label></td>" +
      "<td class='SMALL1'><select><option>All</option><option>CCDS ID</option></select></td>" +
      "<td class='SMALL1'><label for='for'>for</label></td>" +
      "<td class='SMALL1'><input id='DATA'></td>" +
      "<td class='SMALL1'><label for='in'>in</label></td>" +
      "<td class='SMALL1'><select><option>All Organisms</option><option>Homo sapiens</option></select></td>" +
      "<td class='SMALL1'><label for='and'>and</label></td>" +
      "<td class='SMALL1'><select><option>All Releases</option><option>Current Releases</option></select></td>" +
      "</tr></tbody></table>" +
      "<p><a href='/CCDS/CcdsBrowse.cgi'>Entrez Gene</a></p>",
    ["common", "ncbi-dirs"]
  );
  const labels = [...doc.querySelectorAll("td.SMALL1 label")].map((x) => x.textContent);
  assert.deepEqual(labels, ["检索", "查找", "在", "和"]);
  assert.equal(doc.querySelector("input#DATA").id, "DATA", "输入框本身不动");
  const opts = [...doc.querySelectorAll("option")].map((x) => x.textContent);
  assert.deepEqual(opts, ["全部", "CCDS ID", "全部物种", "Homo sapiens", "全部版本", "当前版本"]);
  assert.equal(doc.querySelectorAll("p a")[0].textContent, "Entrez 基因");
});

test("引擎：Datasets 基因组页（From the … (EGAP) 模板保住链接、Release 规则）", () => {
  const { doc } = boot(
    "<div><h1>Genome</h1>" +
      "<p>Search by taxonomic name or ID, Assembly name, BioProject, BioSample, WGS or Nucleotide accession</p>" +
      "<p class='example'>Try examples:</p>" +
      "<a id='nav' href='/datasets/'>NCBI Datasets</a>" +
      "<h2>Genomic data available from NCBI Datasets</h2>" +
      "<p>Click below to learn more about the genomic data available from NCBI Datasets.</p>" +
      "<a href='/datasets/genome/?taxon=2759'>Annotated</a>" +
      "<h2>Latest eukaryotic RefSeq annotations</h2>" +
      "<div class='src'><span>From the <a href='/genome/annotation_euk/process/'>NCBI Eukaryotic Genome Annotation Pipeline</a> (EGAP)</span></div>" +
      "<h3>Annotation in progress</h3>" +
      "<div class='Content'><span class='Title'>Release</span></div>" +
      "<div class='Content'><span class='Title'>Freeze date</span></div>" +
      "<div class='Content'><span class='Title'>Release date</span></div>" +
      "<h3>Recently completed</h3><p>All Genomes</p></div>",
    ["common", "seq", "seq2", "ncbi-new2"]
  );
  const text = norm(doc.body.textContent);
  assert.equal(doc.getElementById("nav").textContent, "NCBI 数据集");
  assert.ok(text.includes("NCBI Datasets 提供的基因组数据"));
  assert.ok(text.includes("点击下方了解更多关于 NCBI Datasets 提供的基因组数据。"));
  assert.ok(text.includes("已注释"));
  assert.ok(text.includes("最新真核 RefSeq 注释"));
  assert.ok(text.includes("注释进行中"));
  assert.ok(text.includes("冻结日期"));
  assert.ok(text.includes("发布日期"));
  assert.ok(text.includes("最近完成"));
  assert.ok(text.includes("试试这些示例："));
  assert.ok(text.includes("全部基因组"));
  assert.ok(text.includes("按分类学名称或 ID、组装名称、BioProject、BioSample、WGS 或核苷酸登录号检索"));

  // 模板：只替换文字，<a> 节点与 href 必须原样放回
  const src = doc.querySelector("div.src");
  assert.equal(norm(src.textContent), "来自NCBI 真核基因组注释流程（EGAP）");
  const a = src.querySelector("a");
  assert.ok(a, "模板必须保留内联链接");
  assert.equal(a.getAttribute("href"), "/genome/annotation_euk/process/");
  assert.equal(norm(a.textContent), "NCBI 真核基因组注释流程");

  // Release 走规则（exact 会与 ensembl/kegg/uniprot 三册冲突），裸 Release 才翻
  const titles = [...doc.querySelectorAll("span.Title")].map((x) => x.textContent);
  assert.deepEqual(titles, ["版本", "冻结日期", "发布日期"]);
});
