// ClinGen 深页（工作组导航 / 基因事实页 / 检索表格工具条）与 ClinPGx 基因页（clingen2）回归
// 词库只补原文逐字存在的界面串：基因符号、accession、数据库品牌、专家组名一律不动。
// 运行：node --test test/clingen2.test.mjs
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

const dict = read("clingen2.json");
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;
const SITE = { scope: "body", block: "pre, code", rescan: false };

// 线上真实栈：common + clingen（骨架）+ clingen2（本册）
function siteData() {
  const books = ["common.json", "clingen.json", "clingen2.json"];
  const exact = {}, rules = [], templates = [];
  for (const f of books) {
    if (!fs.existsSync(path.join(root, "../dict", f))) continue;
    const d = read(f);
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
    templates.push(...(d.templates || []));
  }
  return { exact, rules, templates };
}

function boot(html, url) {
  const dom = new JSDOM(html, { url: url || "https://clinicalgenome.org/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: siteData(),
    site: SITE
  });
  engine.start();
  return { dom, engine, doc: dom.window.document };
}

// 只跑单条规则（捕获组按见证词表翻译一次），用来断言规则行为
function applyRule(reStr, to, input, lookup) {
  const m = new RegExp(reStr).exec(input);
  if (!m) return null;
  return to.replace(/\$(\d)/g, (_, d) => {
    const seg = m[Number(d)] ?? "";
    return lookup && Object.prototype.hasOwnProperty.call(lookup, seg) ? lookup[seg] : seg;
  });
}

test("词库结构：三个 host 齐备、条目量级、字段规整", () => {
  const sites = dict.meta.sites || [];
  for (const h of ["clinicalgenome.org", "www.clinicalgenome.org", "search.clinicalgenome.org", "clinpgx.org", "www.clinpgx.org"]) {
    assert.ok(sites.includes(h), "meta.sites 缺主机: " + h);
  }
  const exact = Object.entries(dict.exact || {});
  assert.ok(exact.length >= 100, "exact 条目太少: " + exact.length);
  assert.ok((dict.rules || []).length >= 4, "规则太少");
  assert.ok((dict.templates || []).length >= 3, "模板太少");

  const bad = [];
  for (const [en, zh] of exact) {
    if (!en || en !== en.trim()) bad.push("键首尾空白: " + JSON.stringify(en));
    if (CJK.test(en)) bad.push("键含中文: " + en);
    if (!zh || zh !== zh.trim()) bad.push("空译文或首尾空白: " + en);
    if (!CJK.test(zh)) bad.push("译文无中文: " + en);
    if (en === zh) bad.push("自映射: " + en);
    if (/https?:\/\/|www\.|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(zh)) bad.push("译文含 URL/邮箱: " + en);
    if (/\{\{\d+\}\}/.test(zh)) bad.push("exact 里混入占位符: " + en);
  }
  assert.deepEqual(bad, []);
});

test("规则：正则合法、译文有中文、占位符不超出捕获组", () => {
  const bad = [];
  for (const r of dict.rules || []) {
    if (!r.re || !r.to) { bad.push("缺字段: " + JSON.stringify(r)); continue; }
    let re;
    try { re = new RegExp(r.re); } catch (e) { bad.push("正则非法: " + r.re); continue; }
    if (!CJK.test(r.to)) bad.push("规则译文无中文: " + r.re);
    if (/https?:\/\/|www\./.test(r.to)) bad.push("规则译文含 URL: " + r.re);
    const slots = [...r.to.matchAll(/\$(\d)/g)].map((m) => Number(m[1]));
    const groups = (re.source.match(/\((?!\?)/g) || []).length;
    if (!groups) bad.push("规则没有捕获组: " + r.re);
    for (const n of slots) if (n > groups) bad.push("占位符超出捕获组: " + r.re);
  }
  assert.deepEqual(bad, []);
});

test("模板：占位符编号连续、与译文一一对应、长度合规", () => {
  const bad = [];
  for (const t of dict.templates || []) {
    if (!t.pat || !t.zh) { bad.push("缺字段: " + JSON.stringify(t).slice(0, 60)); continue; }
    if (t.pat.length < 20 || t.pat.length > 2200) bad.push("pat 长度不合规: " + t.pat.length);
    if (!CJK.test(t.zh)) bad.push("模板译文无中文: " + t.pat.slice(0, 40));
    if (/https?:\/\/|www\./.test(t.zh)) bad.push("模板译文含 URL: " + t.pat.slice(0, 40));
    const slots = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    const used = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    if (!slots.length) { bad.push("pat 无占位符: " + t.pat.slice(0, 40)); continue; }
    if (slots.join(",") !== slots.map((_, i) => i + 1).join(",")) bad.push("pat 编号不连续: " + t.pat.slice(0, 40));
    if (slots.join(",") !== used.join(",")) bad.push("译文占位符不匹配: " + t.pat.slice(0, 40));
  }
  assert.deepEqual(bad, []);
});

test("关键条目：工作组导航、基因事实字段、检索工具条、ClinPGx 徽标", () => {
  const cases = [
    ["GenomeConnect", "GenomeConnect 患者门户"],
    ["Interface", "审编接口"],
    ["Actionability", "可操作性"],
    ["AI and Automation", "人工智能与自动化"],
    ["Biocurator", "生物审编员"],
    ["Cancer Variant Interpretation (CVI)", "肿瘤变异解读（CVI）"],
    ["Clinical Domain Working Group Oversight Committee", "临床领域工作组监督委员会"],
    ["Copy Number Variant Interpretation Guidelines", "拷贝数变异解读指南"],
    ["Curated Disease Entity", "已审编疾病实体"],
    ["Data Access, Protection, and Confidentiality (DAPC)", "数据访问、保护与保密（DAPC）"],
    ["Data Platform", "数据平台"],
    ["Dosage Sensitivity Curation", "剂量敏感性审编"],
    ["Education, Coordination and Training", "教育、协调与培训"],
    ["FDA- Regulatory", "FDA 监管事务"],
    ["Germline/Somatic Working Group", "胚系/体细胞工作组"],
    ["HLA Working Group", "HLA 工作组"],
    ["Pharmacogenomics Interpretation Committee", "药物基因组学解读委员会"],
    ["Phenotyping", "表型分析"],
    ["Population Genetics", "群体遗传学"],
    ["Steering Committee", "指导委员会"],
    ["Variant Classification", "变异分类"],
    ["VCEP Management", "VCEP 管理"],
    ["& Annoucements", "与公告"],
    ["pLI and LOEUF metrics based on", "pLI 与 LOEUF 指标基于"],
    ["GRCh37/hg19:", "GRCh37/hg19 坐标："],
    ["External Genomic", "外部基因组"],
    ["Resources", "资源"],
    ["Plus", "正链"],
    ["VIP", "VIP（重点药物基因）"],
    ["ClinPGx Blog", "ClinPGx 博客"],
    ["ClinPGx @ Bluesky", "ClinPGx 在 Bluesky"],
    ["Locus Group", "基因座类别"],
    ["Curation Activity", "审编活动"],
    ["rows per page", "每页行数"],
    ["Gene Validity", "基因有效性"],
    ["non-coding RNA", "非编码 RNA"],
    ["pseudogene", "假基因"]
  ];
  for (const [en, zh] of cases) assert.equal(dict.exact[en], zh, "缺条目: " + en);
});

test("规则行为：结果页标题、最后审编日期、药物基因句式、hg38 参考序列", () => {
  const find = (s) => (dict.rules || []).find((r) => r.re === s);

  const title = find("^(.+) curation results$");
  assert.ok(title, "缺 curation results 标题规则");
  assert.equal(applyRule(title.re, title.to, "BRCA1 curation results", dict.exact), "BRCA1 审编结果");
  assert.equal(applyRule(title.re, title.to, "CYP2C19 curation results", dict.exact), "CYP2C19 审编结果");

  const last = find("^Last Curated: (\\d{2}/\\d{2}/\\d{4})$");
  assert.ok(last, "缺 Last Curated 规则");
  assert.equal(applyRule(last.re, last.to, "Last Curated: 05/30/2025"), "最后审编：05/30/2025");

  const pg = find("^([A-Z][A-Za-z0-9-]*) is one of the key pharmacogenes involved in implementation of pharmacogenomics\\.$");
  assert.ok(pg, "缺药物基因组学句式规则");
  assert.equal(
    applyRule(pg.re, pg.to, "CYP2C19 is one of the key pharmacogenes involved in implementation of pharmacogenomics."),
    "CYP2C19 是药物基因组学落地应用中的关键药物基因之一。"
  );

  const ref = find("^, note that the reference sequence for (\\S+) on hg38 is equivalent to$");
  assert.ok(ref, "缺 hg38 参考序列规则");
  assert.equal(
    applyRule(ref.re, ref.to, ", note that the reference sequence for CYP2C19 on hg38 is equivalent to"),
    "，请注意 CYP2C19 在 hg38 上的参考序列等同于"
  );
});

test("引擎：ClinGen 工作组导航与基因事实页（标题翻、基因符号不动）", () => {
  const { doc } = boot(
    "<html><head><title>BRCA1 curation results</title></head><body>" +
      "<nav><a href='/wg/1'><span>Variant Classification</span></a>" +
      "<a href='/wg/2'><span>VCEP Management</span></a>" +
      "<a href='/wg/3'><span>Pharmacogenomics Interpretation Committee</span></a></nav>" +
      "<main><h1>BRCA1</h1>" +
      "<dl><dt>HGNC Symbol</dt><dd>BRCA1 (HGNC:1100)</dd>" +
      "<dt>Status and Future Work</dt><dd>Ongoing</dd></dl>" +
      "<i>pLI and LOEUF metrics based on</i> <scan>ENST00000357654</scan> <i>transcript</i>" +
      "<div><u>GRCh37/hg19:</u> chr17:41196312-41277381</div>" +
      "<p>3 (Sufficient Evidence for Haploinsufficiency)</p>" +
      "<p>0 (No Evidence for Triplosensitivity)</p>" +
      "<p>The information on this website is not intended for direct diagnostic use or medical decision-making without review by a genetics professional. Individuals should not change their health behavior solely on the basis of information contained on this website. If you have questions about the information contained on this website, please see a healthcare professional.</p>" +
      "</main></body></html>"
  );
  const nav = [...doc.querySelectorAll("nav span")].map((s) => s.textContent);
  assert.deepEqual(nav, ["变异分类", "VCEP 管理", "药物基因组学解读委员会"]);
  assert.equal(doc.title, "BRCA1 审编结果");
  assert.equal(doc.querySelector("h1").textContent, "BRCA1", "基因符号不能被翻");
  const dd = doc.querySelectorAll("dd");
  assert.equal(dd[0].textContent, "BRCA1 (HGNC:1100)", "HGNC 编号保持原样");


  // pLI/LOEUF 说明句与剧transcript 片段都翻，SCAN 元素的转录本号不动
  assert.equal(doc.querySelector("scan").textContent, "ENST00000357654");
  assert.match(doc.body.textContent, /pLI 与 LOEUF 指标基于\s*ENST00000357654\s*转录本/);
  assert.match(doc.body.textContent, /GRCh37\/hg19 坐标：\s*chr17:41196312-41277381/);
  assert.match(doc.body.textContent, /3（单倍剂量不足证据充分）/);
  assert.match(doc.body.textContent, /0（无三倍剂量敏感性证据）/);
  assert.match(doc.body.textContent, /本网站信息在未经遗传学专业人员审核前/);
});

test("引擎：ClinPGx 基因页（链方向、药物基因句式、指南列表模板、页脚社交链接）", () => {
  const { doc } = boot(
    "<body><div class='fact-section'><h3>Location</h3><table><tbody>" +
      "<tr><td><b>Strand</b></td><td>Plus</td></tr>" +
      "<tr><td><b>Cytogenetic</b></td><td>chr10 : q23.33 - q23.33</td></tr>" +
      "</tbody></table></div>" +
      "<div class='fact'><h4>Overview <span class='tag'>VIP</span></h4>" +
      "<p>CYP2C19 is one of the key pharmacogenes involved in implementation of pharmacogenomics.</p>" +
      "<ul><li>It is involved in guidelines for antidepressants, <a href='/chemical/PA1'>clopidogrel</a> and <a href='/chemical/PA2'>voriconazole</a> (<a href='/gene/PA124/guidelines'>go to list of all guidelines with CYP2C19</a>).</li></ul></div>" +
      "<footer><a title='ClinPGx @ YouTube' href='https://youtube.com/x'><span>ClinPGx @ YouTube</span></a>" +
      "<a title='ClinPGx @ Bluesky' href='https://bsky.app/x'><span>ClinPGx @ Bluesky</span></a>" +
      "<a title='ClinPGx Blog' href='/blog'><span>ClinPGx Blog</span></a>" +
      "<p class='font-italic'>The information on this website is not intended for direct diagnostic use or medical decision-making without review by a health care professional. Individuals should not change their health behavior solely on the basis of information contained on this website. If you have questions about the information contained on this website, please see a health care professional.</p></footer>" +
      "</body>",
    "https://www.clinpgx.org/gene/PA124"
  );
  const tds = [...doc.querySelectorAll("td")].map((td) => td.textContent);
  assert.equal(tds[0], "链方向");
  assert.equal(tds[1], "正链", "Plus（正链）必须翻");
  assert.equal(tds[2], "细胞遗传学");
  assert.equal(tds[3], "chr10 : q23.33 - q23.33", "细胞遗传带保持原样");
  assert.equal(doc.querySelector(".tag").textContent, "VIP（重点药物基因）");

  const p = doc.querySelector(".fact p");
  assert.equal(p.textContent, "CYP2C19 是药物基因组学落地应用中的关键药物基因之一。");

  const li = doc.querySelector("li");
  assert.equal(
    li.textContent,
    "它涉及的指南涵盖抗抑郁药、clopidogrel 与 voriconazole（查看全部涉及 CYP2C19 的指南）。"
  );
  const links = li.querySelectorAll("a");
  assert.equal(links.length, 3, "模板必须把三条链接放回原位");
  assert.deepEqual([...links].map((a) => a.getAttribute("href")), ["/chemical/PA1", "/chemical/PA2", "/gene/PA124/guidelines"]);

  const foot = [...doc.querySelectorAll("footer a span")].map((s) => s.textContent);
  assert.deepEqual(foot, ["ClinPGx 在 YouTube", "ClinPGx 在 Bluesky", "ClinPGx 博客"]);
  assert.match(doc.querySelector("footer p").textContent, /本网站信息在未经医疗专业人员审核前/);
});

test("引擎：ClinGen 检索表格工具条与页面偏好说明（模板保留加粗短语）", () => {
  const { doc } = boot(
    "<body><div class='bootstrap-table'><div class='pull-left'>" +
      "<p>Showing 1 to 25 of 45395 rows</p>" +
      "<span class='dropdown'><ul><li>25</li><li>50</li></ul></span> rows per page</div>" +
      "<table><thead><tr><th><div class='th-inner'>Gene Symbol</div></th>" +
      "<th><div class='th-inner'>Locus Group</div></th>" +
      "<th><div class='th-inner'>Curation Activity</div></th></tr></thead></table></div>" +
      "<div class='alert alert-warning' role='alert'><b>Page Preferences</b> allow you to save and restore individual settings to your preference. Currently this <b>new feature</b> allows you to manage table page number, table page size, table search string, and table column sort order. Future releases will also manage advanced filters, column layout, and column search settings.</div>" +
      "</body>",
    "https://search.clinicalgenome.org/kb/genes?query=BRCA1"
  );
  assert.equal(doc.querySelector(".pull-left p").textContent, "显示第 1–25 行，共 45395 行");
  assert.match(doc.querySelector(".pull-left").textContent, /每页行数/);
  assert.deepEqual(
    [...doc.querySelectorAll(".th-inner")].map((th) => th.textContent),
    ["基因符号", "基因座类别", "审编活动"]
  );
  const alert = doc.querySelector(".alert");
  assert.equal(
    alert.textContent,
    "页面偏好设置可用于按你的偏好保存与恢复各项设置。当前这个新功能可管理表格页码、每页行数、表格检索串与列排序。后续版本还将管理高级筛选、列布局与列检索设置。"
  );
  // 两个 <b> 的位置必须保留（模板把内联元素放回去）
  const bolds = [...alert.querySelectorAll("b")].map((b) => b.textContent);
  assert.deepEqual(bolds, ["页面偏好设置", "新功能"]);
});
