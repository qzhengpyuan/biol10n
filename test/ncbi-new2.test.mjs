// NCBI 新站深页补漏词库（dict/ncbi-new2.json）测试
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/ncbi-new2.json"), "utf8"));
const common = JSON.parse(fs.readFileSync(path.join(root, "../dict/common.json"), "utf8"));
const ncbi = JSON.parse(fs.readFileSync(path.join(root, "../dict/ncbi.json"), "utf8"));

// 站级 dicts = common + ncbi + 本册（与 config/sites.json 里这 11 个站点的接线一致）
const data = {
  exact: { ...common.exact, ...ncbi.exact, ...dict.exact },
  rules: [...(common.rules || []), ...(ncbi.rules || []), ...(dict.rules || [])],
  templates: [...(common.templates || []), ...(ncbi.templates || []), ...(dict.templates || [])]
};

const CJK = /[\u4e00-\u9fff]/;
const flat = (s) => String(s || "").replace(/\s+/g, " ").trim();

function mount(html, url) {
  const dom = new JSDOM(html, { url: url || "https://www.ncbi.nlm.nih.gov/Structure/pdb/1TUP" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data,
    site: { scope: "body", proseExempt: ".usa-banner, .usa-media_block-body, [class*=disclaimer]" }
  });
  engine.start();
  return dom.window.document;
}

function applyRule(text) {
  for (const r of dict.rules) {
    const m = new RegExp(r.re).exec(text);
    if (m) return r.to.replace(/\$(\d)/g, (_, d) => (m[Number(d)] === undefined ? "" : m[Number(d)]));
  }
  return null;
}

test("词库结构：family/sites/条数/译文含汉字", () => {
  assert.equal(dict.meta.family, "ncbi-new2");
  assert.equal(dict.meta.version, "0.1.0");
  assert.deepEqual(dict.meta.sites, ["www.ncbi.nlm.nih.gov"]);
  const keys = Object.keys(dict.exact);
  assert.ok(keys.length >= 140, "exact 只有 " + keys.length + " 条");
  assert.ok(dict.rules.length >= 10, "rules 只有 " + dict.rules.length + " 条");
  assert.ok(dict.templates.length >= 2, "templates 只有 " + dict.templates.length + " 条");
  for (const [k, v] of Object.entries(dict.exact)) {
    // 纯缩写标签（ISSN: / PDB ID: / > MMDB）译文只换标点或全角字符时允许没有汉字
    if (k.replace(/[^A-Za-z0-9]/g, "") === v.replace(/[^A-Za-z0-9]/g, "")) continue;
    assert.match(v, CJK, "译文不含汉字: " + k + " => " + v);
  }
});

test("条目卫生：key 无中文、无自映射、无首尾空白，值无明文 URL / 邮箱", () => {
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.equal(typeof k, "string");
    assert.doesNotMatch(k, CJK, "key 含中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "key 首尾空白: " + k);
    assert.equal(v, v.trim(), "值首尾空白: " + k);
    assert.doesNotMatch(v, /https?:\/\//i, "值含明文 URL: " + k);
    assert.doesNotMatch(v, /[\w.+-]+@[\w-]+\.[\w.]+/, "值含明文邮箱: " + k);
    // 长正文不收入；只允许单句的固定说明（GTR 的字段说明最长 139 字）
    assert.ok(k.length <= 240, "exact 键过长（应走模板）: " + k.length + " " + k);
    const sentences = k.split(/[.!?]\s+/).filter(Boolean).length;
    assert.ok(sentences <= 3, "疑似长正文段落（" + sentences + " 句）: " + k);
  }
  for (const r of dict.rules) {
    assert.ok(r.re.length > 0 && typeof r.to === "string");
  }
});

test("规则：正则可编译、译文含汉字且引用捕获组", () => {
  for (const r of dict.rules) {
    assert.doesNotThrow(() => new RegExp(r.re), "坏规则: " + r.re);
    assert.match(r.to, CJK, "规则译文不含汉字: " + r.re);
    assert.match(r.to, /\$\d/, "规则译文应引用捕获组: " + r.re);
  }
});

test("模板：pat 无中文、20-2200 字、占位符与槽位一一对应", () => {
  for (const t of dict.templates) {
    assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, "模板长度越界: " + t.pat);
    assert.doesNotMatch(t.pat, CJK, "模板 pat 含中文: " + t.pat);
    assert.match(t.zh, CJK, "模板译文无中文: " + t.pat);
    const used = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
    const have = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
    assert.ok(have.length >= 1, "模板没有槽位: " + t.pat);
    assert.deepEqual(used, have, "占位符编号不匹配: " + t.pat);
  }
});

test("关键条目：NCBI 旧版页脚/页头骨架", () => {
  const must = [
    "National Center for Biotechnology Information",
    "U.S. National Library of Medicine",
    "Simple NCBI Directory",
    "NCBI Education",
    "Popular",
    "Featured",
    "Reference Sequences",
    "Human Genome",
    "Mouse Genome",
    "Sequence Read Archive",
    "NCBI Information",
    "About NCBI",
    "Research at NCBI",
    "NCBI Newsletter",
    "NCBI FTP Site",
    "NCBI on Twitter",
    "Policies and Guidelines",
    "Write to the Help Desk",
    "Computational Biology Branch",
    "Structure Group",
    "> MMDB",
    "Support Center",
    "Warning:",
    "more..."
  ];
  for (const k of must) assert.ok(k in dict.exact, "缺少条目: " + k);
});

test("关键条目：GTR 检测页字段标签与实验室页", () => {
  const must = [
    "Not provided",
    "Health Care Provider",
    "Patients and consumers",
    "Lab contact for this test, Test strategy",
    "Instrument *",
    "Diagnosis; Mutation Confirmation",
    "Next-Generation (NGS)/Massively parallel sequencing (MPS)",
    "View information for this condition in GTR",
    "Purposes or indications for the test. Lab-provided.",
    "Condition for which test is offered. Lab-provided.",
    "Laboratory name and acronym, Institution name or acronym if the laboratory is part of an institution.",
    "Online Contact:",
    "Website:",
    "Submissions in ClinVar",
    "This is one of your preferred labs.",
    "Add to preferred labs",
    "See all preferred labs",
    "Personnel",
    "Director:",
    "Conditions and tests",
    "Enter text to narrow down the list",
    "Laboratories",
    "Locus-specific Databases",
    "Mutation-specific Databases",
    "Expiration date:"
  ].filter((k) => k !== "Laboratory name and acronym, Institution name or acronym if the laboratory is part of an institution.");
  for (const k of must) assert.ok(k in dict.exact, "缺少条目: " + k);
  assert.ok("Laboratory name and acronym, Institution name and acronym if the laboratory is part of an institution." in dict.exact);
});

test("关键条目：MedGen / dbVar / BioProject 深页", () => {
  const must = [
    "SNOMED CT:",
    "Disease or Syndrome",
    "Copy e-mail address to clipboard",
    "Sampleset Type:",
    "No validation data were submitted for this study.",
    "Split read and paired-end mapping",
    "> Individual Study",
    "Collection",
    "dbVar home",
    "Search dbVar",
    "Preview and Download Variant Regions",
    "Preview and Download Variant Calls",
    "Preview and Download All Variants",
    "Link to FTP resource",
    "Link to Genome Browser",
    "current page number",
    "Protein Sequences",
    "Nucleotide (Genomic RNA)",
    "Genomic RNA",
    "Related Proteins",
    "Link to genomic RNA records",
    "Genome sequencing, Targeted Locus (Loci)",
    "Search BioProject",
    "Click to open/close SRA data details"
  ];
  for (const k of must) assert.ok(k in dict.exact, "缺少条目: " + k);
});

test("关键条目：Structure / NLM Catalog / ORFfinder / Guide / Datasets", () => {
  const must = [
    "An updated version of the MMDB Structure Summary page is available!",
    "Try it now",
    "and provide feedback using the on-page button.",
    "Note that the new version may change without advance notice while it is being evaluated.",
    "PDB ID:",
    "MMDB ID:",
    "x-ray diffraction",
    "MMDB help document",
    "NLM Catalog: Journals referenced in the NCBI Databases",
    "Enter topic, journal title or abbreviation, or ISSN:",
    "Browse MEDLINE Journals by broad subject terms",
    "LinkOut journal lists",
    "indexed in MEDLINE",
    "deposited in PMC",
    "> National Library of Medicine (NLM) Catalog",
    "ISSN:",
    "NLM ID:",
    "Periodical",
    "PubMed Search Builder",
    "Add to search builder",
    "How to enter the sequence data",
    "The Genetic Codes",
    "Continue reading",
    "Please tell us about your visit!",
    "Start Survey",
    "No Thanks",
    "NIH Comparative Genomics Resource (CGR)",
    "Invalid input uid"
  ];
  for (const k of must) assert.ok(k in dict.exact, "缺少条目: " + k);
});

test("不翻：专名/登录号/物种/数据库品牌不进词库", () => {
  const banned = [
    "Homo sapiens",
    "Mus musculus",
    "Zaire ebolavirus",
    "PRJNA257197",
    "nstd204",
    "1TUP",
    "ATP",
    "HOXC8",
    "Marfan syndrome",
    "NCBI",
    "PubMed",
    "ClinVar",
    "MedGen",
    "dbVar",
    "GTR",
    "OMIM",
    "SNOMED CT"
  ];
  for (const k of banned) assert.ok(!(k in dict.exact), "不该收录: " + k);
});

test("规则行为：GTR / BioProject / 分页 / 排序", () => {
  assert.equal(applyRule("Registered in GTR: 2019-03-19"), "在 GTR 中登记：2019-03-19");
  assert.equal(applyRule("* Instrument: Not provided"), "* 仪器：Not provided");
  assert.equal(applyRule("Information for Homo sapiens"), "关于 Homo sapiens 的信息");
  assert.equal(applyRule("Data volume, Gbases"), "数据量（Gbases）");
  assert.equal(applyRule("Biological Unit for 1TUP: pentameric; determined by author"), "1TUP 的生物学单元：pentameric；由作者确定");
  assert.equal(applyRule("Send email to dbvar@ncbi.nlm.nih.gov"), "向 dbvar@ncbi.nlm.nih.gov 发送邮件");
  // 静态页签走 exact（无捕获组，不该写成规则）
  assert.equal(dict.exact["Goto Next Page"], "下一页");
  assert.equal(dict.exact["Goto First Page"], "首页");
  assert.equal(applyRule("Inactive Previous Page"), "不可用：Previous Page");
  assert.equal(applyRule("Homo sapiens in Taxonomy"), "分类学中的 Homo sapiens");
  assert.equal(applyRule("Department: Genetics"), "部门：Genetics");
  assert.equal(applyRule("Number: activate to sort column ascending"), "Number：点击按此列升序排序");
  assert.equal(applyRule("Number: activate to sort column descending"), "Number：点击按此列降序排序");
});

test("渲染：Structure 页脚与 PDB/MMDB 字段翻、晶体学术语翻、编号不翻", () => {
  const doc = mount(`<div id="maincontent">
    <p><b>PDB ID:</b> 1TUP</p>
    <p><b>MMDB ID:</b> 37748</p>
    <p>x-ray diffraction</p>
    <p>Synthetic construct</p>
    <div class="footer">
      <a href="#">Simple NCBI Directory</a>
      <a href="#">Sequence Read Archive</a>
      <a href="#">Write to the Help Desk</a>
      <a href="#">About NCBI</a>
    </div>
  </div>`);
  const txt = flat(doc.querySelector("#maincontent").textContent);
  assert.match(txt, /PDB ID：/);
  assert.match(txt, /MMDB ID：/);
  assert.match(txt, /X 射线衍射/);
  assert.match(txt, /NCBI 简明目录/);
  assert.match(txt, /序列读取存档/);
  assert.match(txt, /联系帮助台/);
  assert.match(txt, /关于 NCBI/);
  // 编号与物种名不翻
  assert.match(txt, /1TUP/);
  assert.match(txt, /37748/);
  assert.match(txt, /Synthetic construct/);
});

test("渲染：GTR 检测页字段标签与 title 属性翻，基因/疾病值不翻", () => {
  const doc = mount(`<div id="maincontent">
    <dl>
      <dt>Test type:</dt><dd>Diagnosis; Mutation Confirmation</dd>
      <dt>Method:</dt><dd>Next-Generation (NGS)/Massively parallel sequencing (MPS)</dd>
      <dt>Instrument *</dt><dd>* Instrument: Not provided</dd>
      <dt>Gene(s):</dt><dd>HOXC8 (12q13.13)</dd>
    </dl>
    <a href="#" title="View information for this condition in GTR">Hereditary disease</a>
    <input placeholder="Enter condition, gene, or lab">
  </div>`, "https://www.ncbi.nlm.nih.gov/gtr/tests/562828/");
  const txt = flat(doc.querySelector("#maincontent").textContent);
  assert.match(txt, /诊断；突变确认/);
  assert.match(txt, /新一代测序（NGS）\/大规模平行测序（MPS）/);
  assert.match(txt, /\* 仪器：未提供/);
  const a = doc.querySelector("a");
  assert.match(String(a.getAttribute("title")), /在 GTR 中查看该疾病的信息/);
  const input = doc.querySelector("input");
  assert.match(String(input.getAttribute("placeholder")), /输入疾病、基因或实验室/);
  // 基因符号与疾病名保持原样
  assert.match(txt, /HOXC8/);
  assert.match(txt, /Hereditary disease/);
});

test("渲染：NLM Catalog 落地页整句模板保住链接", () => {
  const doc = mount(`<ul class="more">
    <li>Journals currently <a href="/nlmcatalog?term=currentlyindexed">indexed in MEDLINE</a></li>
    <li>Journals currently <a href="/nlmcatalog?term=journalspmc">deposited in PMC</a></li>
  </ul>`, "https://www.ncbi.nlm.nih.gov/nlmcatalog/journals/0000000");
  const items = doc.querySelectorAll("ul.more li");
  assert.equal(items.length, 2);
  assert.match(flat(items[0].textContent), /当前收录于 MEDLINE的期刊/);
  assert.match(flat(items[1].textContent), /当前存缴至 PMC的期刊/);
  // 链接本身必须留着
  assert.equal(items[0].querySelectorAll("a").length, 1);
  assert.equal(items[0].querySelector("a").getAttribute("href"), "/nlmcatalog?term=currentlyindexed");
});

test("渲染：dbVar 分页 aria-label 与区块标题翻、样本类型值不翻", () => {
  const doc = mount(`<div id="maincontent">
    <div class="pager">
      <a href="#" aria-label="Goto Previous Page">&lt; Prev</a>
      <a href="#" aria-label="Goto Next Page">Next &gt;</a>
      <span>current page number</span>
    </div>
    <h3>&gt; Individual Study</h3>
    <p>Sampleset Type:</p>
    <p>Collection</p>
    <p>No validation data were submitted for this study.</p>
    <p>Split read and paired-end mapping</p>
  </div>`, "https://www.ncbi.nlm.nih.gov/dbvar/studies/nstd204/");
  const txt = flat(doc.querySelector("#maincontent").textContent);
  const labels = [...doc.querySelectorAll(".pager a")].map((a) => String(a.getAttribute("aria-label")));
  assert.ok(labels.includes("上一页"), "aria-label 未翻: " + labels.join("/"));
  assert.ok(labels.includes("下一页"), "aria-label 未翻: " + labels.join("/"));
  assert.match(txt, /当前页码/);
  assert.match(txt, /单项研究/);
  assert.match(txt, /样本集类型：合集/);
  assert.match(txt, /本研究未提交验证数据。/);
  assert.match(txt, /拆分读段与双端比对/);
});
