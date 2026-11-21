// ClinGen（主站 + search 检索应用）与 ClinPGx 骨架词库（clingen）回归：结构、关键条目、规则与 jsdom 渲染
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

const dict = read("clingen.json");
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;
const SITE = { scope: "body", block: "pre, code", rescan: false };

// 站点真实词库栈：common + clingen
function siteData() {
  const books = ["common.json", "clingen.json"];
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
  const dom = new JSDOM(html, { url: url || "https://www.clinicalgenome.org/" });
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

test("词库结构：两站主机齐备、条目量级、字段规整", () => {
  const sites = dict.meta.sites || [];
  for (const h of ["www.clinicalgenome.org", "clinicalgenome.org", "search.clinicalgenome.org", "www.clinpgx.org", "clinpgx.org"]) {
    assert.ok(sites.includes(h), "meta.sites 缺主机: " + h);
  }
  const exact = Object.entries(dict.exact || {});
  assert.ok(exact.length >= 350, "exact 条目太少: " + exact.length);
  assert.ok((dict.rules || []).length >= 6, "规则太少");
  assert.ok((dict.templates || []).length >= 20, "模板太少");

  const bad = [];
  for (const [en, zh] of exact) {
    if (!en || en !== en.trim()) bad.push("键首尾空白: " + JSON.stringify(en));
    if (CJK.test(en)) bad.push("键含中文: " + en);
    if (/^\s|\s$/.test(zh) || !zh) bad.push("空译文或首尾空白: " + en);
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

test("关键条目：导航、检索占位符、表头、字段标签、固定枚举值", () => {
  const cases = [
    ["Curation Activities", "审编活动"],
    ["Gene-Disease Validity", "基因-疾病有效性"],
    ["Clinical Actionability", "临床可操作性"],
    ["Search in table", "在表格中检索"],
    ["Enter a gene symbol or HGNC ID (Examples: ADNP, HGNC:15766)", "输入基因符号或 HGNC ID（示例：ADNP，HGNC:15766）"],
    ["Showing 1 to 25 of 3739 rows", undefined],
    ["Last Eval.", "最后评估"],
    ["HGNC Approved Name", "HGNC 批准名称"],
    ["Included MIM Phenotypes", "纳入的 MIM 表型"],
    ["Definitive", "明确"],
    ["No Known Disease Relationship", "无已知疾病关联"],
    ["Animal Model Only", "仅动物模型"],
    ["Drug Label Annotations", "药品说明书注释"],
    ["Search ClinPGx by gene, drug, or variant", "按基因、药物或变异检索 ClinPGx"],
    ["Has PGx", "含 PGx"],
    ["Precision Guidance", "精准指导"]
  ];
  for (const [en, zh] of cases) {
    if (zh === undefined) { assert.ok(!(en in dict.exact), "计数句不该进 exact: " + en); continue; }
    assert.equal(dict.exact[en], zh, "缺条目: " + en);
  }
});

test("规则行为：计数、分页、说明书标题、表格计数表头", () => {
  const find = (s) => (dict.rules || []).find((r) => r.re === s);
  const rows = find("^Showing (\\d+) to (\\d+) of ([\\d,]+) rows$");
  assert.ok(rows, "缺 Showing ... rows 规则");
  assert.equal(applyRule(rows.re, rows.to, "Showing 1 to 25 of 3739 rows"), "显示第 1–25 行，共 3739 行");

  const page = find("^to page (\\d+)$");
  assert.ok(page, "缺 to page 规则");
  assert.equal(applyRule(page.re, page.to, "to page 12"), "第 12 页");

  const title = find("^Annotation of (FDA|EMA|HCSC) Drug Label for (.+) and (.+)$");
  assert.ok(title, "缺说明书标题规则");
  assert.equal(
    applyRule(title.re, title.to, "Annotation of FDA Drug Label for mycophenolic acid and HPRT1"),
    "FDA 药品说明书注释：mycophenolic acid 与 HPRT1"
  );
  // 贪婪 $2 必须切在最后一个 " and "，药名里带 and 也不能错切
  assert.equal(
    applyRule(title.re, title.to, "Annotation of EMA Drug Label for Drug A and Drug B and CYP2D6"),
    "EMA 药品说明书注释：Drug A and Drug B 与 CYP2D6"
  );

  const count = find("^(FDA|EMA|HCSC) \\((\\d[\\d,]*)\\)$");
  assert.ok(count, "缺表头计数规则");
  assert.equal(applyRule(count.re, count.to, "FDA (541)"), "FDA（541 份）");
  assert.equal(applyRule(count.re, count.to, "HCSC (393)"), "HCSC（393 份）");

  const excerpt = find("^Excerpt from the (.+) drug label:$");
  assert.ok(excerpt, "缺说明书摘录规则");
  assert.equal(
    applyRule(excerpt.re, excerpt.to, "Excerpt from the mycophenolic acid (Myfortic) drug label:"),
    "摘自 mycophenolic acid (Myfortic) 药品说明书："
  );

  const remove = find("^Remove (.+) from search$");
  assert.ok(remove, "缺移除检索词规则");
  assert.equal(applyRule(remove.re, remove.to, "Remove CYP2D6 from search"), "从检索中移除 CYP2D6");

  const act = find("^(Definitive|Strong|Moderate|Limited|Disputed|Refuted) Actionability$");
  assert.ok(act, "缺可操作性等级规则");
  assert.equal(applyRule(act.re, act.to, "Definitive Actionability", dict.exact), "明确可操作性");
  assert.equal(applyRule(act.re, act.to, "Limited Actionability", dict.exact), "有限可操作性");
});

test("引擎：ClinGen 检索结果页骨架成中文，基因符号与编号不动", () => {
  const { doc } = boot(
    "<header><nav><a href='/curation-activities/'>Curation Activities</a><a href='/working-groups/'>Working Groups</a></nav></header>" +
      "<main>" +
      "<input placeholder='Enter a gene symbol or HGNC ID (Examples: ADNP, HGNC:15766)'>" +
      "<table><thead><tr><th>Gene</th><th>Disease</th><th>MOI</th><th>Classification</th><th>Last Eval.</th></tr></thead>" +
      "<tbody><tr><td>BRCA1</td><td>Fanconi anemia, complementation group S</td><td>AD</td><td>Definitive</td><td>08/29/2024</td></tr></tbody></table>" +
      "<p>Showing 1 to 25 of 3739 rows</p>" +
      "<h3>Manage Page Preferences</h3>" +
      "<p>BRCA1 (HGNC:1100) and MONDO:0011450</p>" +
      "</main>"
  );
  const nav = doc.querySelectorAll("nav a");
  assert.equal(nav[0].textContent, "审编活动");
  assert.equal(nav[1].textContent, "工作组");
  assert.equal(doc.querySelector("input").getAttribute("placeholder"), "输入基因符号或 HGNC ID（示例：ADNP，HGNC:15766）");

  assert.deepEqual(
    [...doc.querySelectorAll("th")].map((th) => th.textContent),
    ["基因", "疾病", "遗传方式", "分类", "最后评估"]
  );
  const tds = [...doc.querySelectorAll("td")].map((td) => td.textContent);
  assert.equal(tds[0], "BRCA1", "基因符号不能被翻");
  assert.equal(tds[1], "Fanconi anemia, complementation group S", "疾病专名保持英文");
  assert.equal(tds[2], "AD", "MOI 两字母代码保持原样");
  assert.equal(tds[3], "明确");
  assert.equal(tds[4], "08/29/2024", "日期保持原样");

  assert.equal(doc.querySelectorAll("p")[0].textContent, "显示第 1–25 行，共 3739 行");
  assert.equal(doc.querySelector("h3").textContent, "管理页面偏好设置");
  assert.equal(doc.querySelectorAll("p")[1].textContent, "BRCA1 (HGNC:1100) and MONDO:0011450");
});

test("引擎：ClinPGx 占位符与页脚模板，链接保留、药名与基因名不动", () => {
  const { doc } = boot(
    "<body>" +
      "<input placeholder='Search ClinPGx by gene, drug, or variant'>" +
      "<h1>CYP2D6</h1>" +
      "<h4>Names & Symbols</h4>" +
      "<p>The use of ClinPGx data is governed by our <a href='/page/dataUsagePolicy'>data usage policy</a>.</p>" +
      "<p>Annotation of FDA Drug Label for mycophenolic acid and HPRT1</p>" +
      "<span>PA128</span>" +
      "</body>",
    "https://www.clinpgx.org/gene/PA128/"
  );
  assert.equal(doc.querySelector("input").getAttribute("placeholder"), "按基因、药物或变异检索 ClinPGx");
  assert.equal(doc.querySelector("h1").textContent, "CYP2D6", "基因符号不能被翻");
  assert.equal(doc.querySelector("h4").textContent, "名称与符号");

  const footer = doc.querySelectorAll("p")[0];
  assert.equal(footer.textContent, "ClinPGx 数据的使用受我们的数据使用政策约束。");
  const link = footer.querySelector("a");
  assert.ok(link, "模板必须把 <a> 放回原位");
  assert.equal(link.getAttribute("href"), "/page/dataUsagePolicy");

  assert.equal(doc.querySelectorAll("p")[1].textContent, "FDA 药品说明书注释：mycophenolic acid 与 HPRT1");
  assert.equal(doc.querySelector("span").textContent, "PA128", "PharmGKB 编号不能被翻");
});

test("引擎：说明书列表页两槽位模板，两条链接都保留", () => {
  const { doc } = boot(
    "<body><p>ClinPGx annotates regulatory agency-approved drug labels containing PGx information. " +
      "Read <a href='/page/faqs'>more</a> about ClinPGx drug label annotations, the drug label sources, PGx Levels and the &quot;tags&quot; found in the table below. " +
      'FDA, EMA and HCSC labels are annotated when found on the FDA <a href="https://www.fda.gov/drugs/x">Table of Pharmacogenomic Biomarkers in Drug Labels</a>. ' +
      "Labels from other regulatory agencies were annotated as collaborations and are not routinely updated.</p></body>",
    "https://www.clinpgx.org/labelAnnotations"
  );
  const p = doc.querySelector("p");
  const text = p.textContent;
  assert.match(text, /^ClinPGx 注释监管机构批准的/);
  assert.match(text, /FDA、EMA 与 HCSC/);
  const links = p.querySelectorAll("a");
  assert.equal(links.length, 2, "两个内联链接都必须保留");
  assert.equal(links[0].getAttribute("href"), "/page/faqs");
  assert.equal(links[1].getAttribute("href"), "https://www.fda.gov/drugs/x");
  assert.match(links[1].textContent, /药物基因组学生物标志物表/);
});
