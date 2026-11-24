// r44 临床/结构库补译：ClinicalTrials 干预类型与操作名、PubChem 字段标签与 Showing 分页、
// ClinPGx 药物基因表条目、UCSC 首页组装说明段（模板）、GDC 公告条、ClinGen 空表提示。
// DOM 片段均取自真实页面 outerHTML（CDP 抓取，先 __BIOL10N.disable() 回原始英文）。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const common = read("../dict/common.json");
const ct = read("../dict/clinicaltrials.json");
const pubchem = read("../dict/pubchem-dbgap.json");
const pgkb = read("../dict/pharmgkb.json");
const ucsc = read("../dict/ucsc-extra.json");
const gdc2 = read("../dict/gdc2.json");
const clingen = read("../dict/clingen.json");

const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();

function boot(html, url, books, attrs) {
  const dom = new JSDOM(html, { url });
  const data = { exact: {}, rules: [], templates: [] };
  for (const b of books) {
    Object.assign(data.exact, b.exact || {});
    data.rules.push(...(b.rules || []));
    data.templates.push(...(b.templates || []));
  }
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data,
    site: { scope: "body", funcWords: true, attrs: attrs || ["placeholder", "title", "aria-label", "alt", "value"] }
  });
  engine.start();
  return { dom, engine, doc: dom.window.document };
}

const hasCJK = (s) => /[\u3400-\u9fff]/.test(s);

// ---- ① 词条层：新键存在、含汉字、与原键不同 ----
const CT_KEYS = {
  "Other Names:": "其他名称：",
  "Given IV": "静脉给药",
  "Procedure": "操作",
  "Biopsy": "活检",
  "Biospecimen Collection": "生物样本采集",
  Radiation: "放射治疗",
  "mm/dd/yyyy": "月/日/年"
};
test("r44 词条：clinicaltrials 新键存在、含汉字、与原键不同", () => {
  for (const [k, v] of Object.entries(CT_KEYS)) {
    assert.ok(Object.prototype.hasOwnProperty.call(ct.exact, k), "缺键 " + k);
    assert.equal(ct.exact[k], v, "译文不符 " + k);
    assert.ok(hasCJK(v), "缺汉字 " + k);
    assert.notEqual(k, v, "自映射 " + k);
  }
});

const PC_KEYS = {
  "PubChem SID:": "PubChem 物质编号：",
  "External ID": "外部 ID",
  "Chemical Vendors": "化学品供应商",
  "Selected evidence": "选定证据",
  "Name matches:": "名称匹配：",
  "Exposure Route": "暴露途径",
  "Trade Name": "商品名"
};
test("r44 词条：pubchem-dbgap 新键存在、含汉字、与原键不同", () => {
  for (const [k, v] of Object.entries(PC_KEYS)) {
    assert.ok(Object.prototype.hasOwnProperty.call(pubchem.exact, k), "缺键 " + k);
    assert.equal(pubchem.exact[k], v, "译文不符 " + k);
    assert.ok(hasCJK(v));
    assert.notEqual(k, v);
  }
});

test("r44 词条：pharmgkb / gdc2 / ucsc-extra / clingen 新键在位", () => {
  for (const k of ["Pharmacogene Tables", "Allele Definition Table", "Diplotype-Phenotype Table", "Workflow Diagram"]) {
    assert.ok(hasCJK(pgkb.exact[k] || ""), "pharmgkb 缺 " + k);
  }
  assert.equal(gdc2.exact["Attention GDC Users:"], "GDC 用户请注意：");
  assert.equal(gdc2.exact["not applicable"], "不适用");
  assert.equal(gdc2.exact.open, "公开");
  assert.equal(ucsc.exact["Add Custom Tracks"], "添加自定义轨道");
  assert.equal(clingen.exact["No matching records found"], "未找到匹配记录");
});

// ---- 规则/模板结构：锚定、$1、汉字；模板 {{n}} 1..N 不重不漏 ----
test("r44 结构：本册新增规则均 ^…$ 锚定、含 $1 与汉字", () => {
  const rules = [
    ...gdc2.rules.filter((r) => /Maintenance will be conducted/.test(r.re)),
    ...pubchem.rules.filter((r) => r.re.startsWith("^Showing"))
  ];
  assert.equal(rules.length, 3, "新增规则条数不对: " + rules.length);
  for (const r of rules) {
    assert.ok(r.re.startsWith("^") && r.re.endsWith("$"), "未锚定: " + r.re);
    assert.match(r.to, /\$1/, "缺 $1: " + r.to);
    assert.ok(hasCJK(r.to), "缺汉字: " + r.to);
  }
});

test("r44 结构：新增模板 pat 20–2200 字符、{{n}} 1..N 不重不漏", () => {
  const want = [
    "The best way to find an assembly is the {{1}} on our {{2}}. If your assembly of interest is not available, you can {{3}} as long as it has a {{4}} or {{5}} accession.",
    "Allele function assignments using {{1}}, evidence summaries and references used",
    "Calculated allele frequencies for {{1}}, and references used"
  ];
  const tpls = want.map((p) => {
    const t = [...ucsc.templates, ...pgkb.templates].find((x) => x.pat === p);
    assert.ok(t, "缺模板: " + p);
    return t;
  });
  assert.equal(tpls.length, 3, "新增模板条数不对: " + tpls.length);
  for (const t of tpls) {
    assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, "pat 长度越界: " + t.pat.length);
    const patSlots = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    const zhSlots = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.ok(patSlots.length > 0, "pat 缺占位符");
    assert.deepEqual([...new Set(zhSlots)].sort((a, b) => a - b), patSlots.slice().sort((a, b) => a - b), "zh 槽位与 pat 不匹配: " + t.pat);
    assert.equal(zhSlots.length, new Set(zhSlots).size, "zh 槽位重复: " + t.zh);
    assert.ok(hasCJK(t.zh));
  }
});

// ---- ② 真实 DOM 片段渲染 ----
// ClinicalTrials.gov /study/NCT01810913：结果页「Other Names:」列表（含 ul/li 与数据项 BIOPSY_TYPE/Bx）
const CT_OTHER_NAMES =
  '<div _ngcontent-ng-c4178052656="">Other Names: <ul _ngcontent-ng-c4178052656="" class="bullet-list-content"><li _ngcontent-ng-c4178052656="">Biopsy</li><li _ngcontent-ng-c4178052656="">BIOPSY_TYPE</li><li _ngcontent-ng-c4178052656="">Bx</li><!----></ul></div>';

test("r44 DOM：ClinicalTrials「Other Names:」标签与 Biopsy 列表项翻成中文", () => {
  const { doc } = boot(CT_OTHER_NAMES, "https://clinicaltrials.gov/study/NCT01810913", [common, ct]);
  const div = doc.querySelector("div");
  assert.match(div.textContent, /其他名称：/, "标签未翻: " + div.textContent);
  assert.match(div.textContent, /活检/, "Biopsy 未翻: " + div.textContent);
  assert.match(div.textContent, /BIOPSY_TYPE/, "数据项不该动");
  assert.match(div.textContent, /Bx/, "缩写不该动");
});

// 结果页干预类型枚举（Angular 自定义元素 ctg-enum-value + span）
const CT_ENUM =
  '<ctg-enum-value _ngcontent-ng-c1525990560="" path="protocolSection.armsInterventionsModule.interventions.type" _nghost-ng-c4292062698=""><!----><span _ngcontent-ng-c4292062698="">Procedure</span><!----></ctg-enum-value>';

test("r44 DOM：ClinicalTrials 干预类型 Procedure 翻成「操作」", () => {
  const { doc } = boot(CT_ENUM, "https://clinicaltrials.gov/study/NCT01810913", [common, ct]);
  const span = doc.querySelector("span");
  assert.equal(span.textContent, "操作");
});

// 用药说明列表项：<li><p>Given IV</p></li>
test("r44 DOM：ClinicalTrials「Given IV」整句翻成「静脉给药」", () => {
  const { doc } = boot('<li _ngcontent-ng-c4178052656=""><p _ngcontent-ng-c4178052656="">Given IV</p></li>', "https://clinicaltrials.gov/study/NCT01810913", [common, ct]);
  assert.equal(doc.querySelector("p").textContent, "静脉给药");
});

// 链接 title 上的「(opens in a new tab)」：$1 命中词表才替换（requireHit）
test("r44 DOM：链接 title 的 (opens in a new tab) 在后缀命中时才本地化", () => {
  const html =
    '<a title="Biopsy (opens in a new tab)" href="/dictionary#Biopsy">Biopsy</a>' +
    '<a title="Atezolizumab (opens in a new tab)" href="/dictionary#Atezolizumab">Atezolizumab</a>';
  const { doc } = boot(html, "https://clinicaltrials.gov/study/NCT01810913", [common, ct]);
  const [bio, ate] = doc.querySelectorAll("a");
  assert.equal(bio.getAttribute("title"), "活检（在新标签页打开）");
  assert.equal(ate.getAttribute("title"), "Atezolizumab (opens in a new tab)", "药名不在词表时整条必须留英文");
});

// PubChem compound/2244：Substances by Category 行的「External ID: <a>」
const PC_EXTERNAL_ID =
  '<div>External ID: <a href="https://en.cato-chem.com/goodsDetail/CATO/C1343073" target="_parent" class="regular-link" rel="nofollow" data-ga-action="content-link" data-ga-label="Content Link: Substances-by-Category; External ID" title="">C1343073</a></div>';

test("r44 DOM：PubChem「External ID:」标签翻中文、供应商编号保持原样", () => {
  const { doc } = boot(PC_EXTERNAL_ID, "https://pubchem.ncbi.nlm.nih.gov/compound/2244", [common, pubchem]);
  const div = doc.querySelector("div");
  assert.match(div.textContent, /外部 ID：/, "标签未翻: " + div.textContent);
  assert.match(div.textContent, /C1343073/, "编号必须保持原样");
  assert.equal(div.querySelector("a").textContent, "C1343073");
});

// 「Showing 3 of 25 <a><span>View More Co-Occurrence and Evidence Data</span></a>」
const PC_SHOWING =
  '<div class="flex-1 font-semibold">Showing 3 of 25 <a href="#section=Chemical-Co-Occurrences-in-Literature&amp;fullscreen=true" target="_blank" class="pc-minimal-button pc-icon-button" rel="nofollow" data-ga-action="content-link" data-ga-label="Content Link" title=""><span>View More Co-Occurrence and Evidence Data</span><svg xmlns="http://www.w3.org/2000/svg" class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg></a></div>';

test("r44 DOM：PubChem「Showing 3 of 25」走规则、链接文案翻中文", () => {
  const { doc } = boot(PC_SHOWING, "https://pubchem.ncbi.nlm.nih.gov/compound/2244", [common, pubchem]);
  const div = doc.querySelector("div");
  assert.match(div.textContent, /显示 3 项，共 25 项/, "分页句未翻: " + div.textContent);
  assert.match(div.textContent, /查看更多共现与证据数据/, "链接未翻: " + div.textContent);
  assert.ok(!/Showing 3 of 25/.test(div.textContent), "旧英文残留");
});

// 「Name matches: <span>clopidogrel</span> <span>aspirin</span>」—— 药名是数据
test("r44 DOM：PubChem「Name matches:」翻中文、下游药名不动", () => {
  const html =
    '<div class="text-xs text-gray-700 dark:text-gray-400">Name matches: <span class="font-semibold">clopidogrel</span> <span class="italic">aspirin</span></div>';
  const { doc } = boot(html, "https://pubchem.ncbi.nlm.nih.gov/compound/2244", [common, pubchem]);
  const div = doc.querySelector("div");
  assert.match(div.textContent, /名称匹配：/);
  assert.match(div.textContent, /clopidogrel/);
  assert.match(div.textContent, /aspirin/);
});

// ClinPGx /page/pgxGeneRef：<li>Allele function assignments using <a>…</a>, evidence summaries and references used</li>
const PG_ALLELE =
  '<li>Allele function assignments using <a href="https://cpicpgx.org/resources/term-standardization/" target="_blank" class="link" tabindex="0" rel="noopener noreferrer external">CPIC standardized terms<span class="screen-reader-text">(opens in new window)</span></a>, evidence summaries and references used</li>';
const PG_FREQ =
  '<li>Calculated allele frequencies for <a class="link" tabindex="0" href="/page/biogeographicalGroups">ClinPGx biogeographical groups</a>, and references used</li>';

test("r44 DOM：ClinPGx 药物基因表两句（含内联链接）整段走模板", () => {
  const { doc } = boot(PG_ALLELE + PG_FREQ, "https://www.clinpgx.org/page/pgxGeneRef", [common, pgkb]);
  const lis = doc.querySelectorAll("li");
  assert.match(lis[0].textContent, /等位基因功能分配/, "第一句未翻: " + lis[0].textContent);
  assert.match(lis[0].textContent, /证据摘要与所用参考文献/);
  assert.ok(lis[0].querySelector("a"), "链接必须保留");
  assert.match(lis[1].textContent, /计算得到的等位基因频率/, "第二句未翻: " + lis[1].textContent);
  assert.match(lis[1].textContent, /ClinPGx 生物地理分组/, "槽位链接文案未翻: " + lis[1].textContent);
  assert.ok(lis[1].querySelector("a[href='/page/biogeographicalGroups']"), "链接地址必须保留");
});

// UCSC 首页组装说明段：<p>The best way … <b>search box</b> on our <a>Gateway page</a>. …</p>
const UCSC_PARA =
  '<p style="margin: 0; font-size: 14px; line-height: 1.5; color: #333;">\n  The best way to find an assembly is the <b>search box</b> on our <a href="/cgi-bin/hgGateway" target="_blank">Gateway page</a>. If your assembly of interest is not available, you can <a href="/assemblySearch.html" target="_blank">request nearly any Genbank assembly</a> as long as it has a <b>GCA</b> or <b>GCF</b> accession.\n  </p>';

test("r44 DOM：UCSC 首页组装说明整段走模板，内联链接与 GCA/GCF 保留", () => {
  const { doc } = boot(UCSC_PARA, "https://genome.ucsc.edu/", [common, ucsc]);
  const p = doc.querySelector("p");
  const t = p.textContent;
  assert.match(t, /查找组装版本的最佳方式/, "段落未翻: " + t);
  assert.match(t, /搜索框/, "槽位 <b>search box</b> 未翻: " + t);
  assert.match(t, /网关页/, "槽位链接未翻: " + t);
  assert.match(t, /GCA/);
  assert.match(t, /GCF/);
  assert.equal(p.querySelectorAll("a").length, 2, "链接个数必须不变");
});

// GDC 门户公告条：<p><strong>Attention GDC Users:</strong> Maintenance will be …</p>
const GDC_BANNER =
  "<p><strong>Attention GDC Users:</strong> Maintenance will be conducted on GDC's infrastructure today Nov 23, 2026 from 4:30PM to 5:30PM CT. During this time, intermittent connectivity loss to the GDC portal and API is expected. We apologize for any inconvenience.</p>";

test("r44 DOM：GDC 公告条标题与正文都本地化，GDC/API 专名保留", () => {
  const { doc } = boot(GDC_BANNER, "https://portal.gdc.cancer.gov/", [common, gdc2]);
  const t = doc.querySelector("p").textContent;
  assert.match(t, /GDC 用户请注意：/, "标题未翻: " + t);
  assert.match(t, /GDC 基础设施将于今日/, "正文未翻: " + t);
  assert.match(t, /美国中部时间/);
  assert.match(t, /GDC 门户与 API/);
  assert.ok(!/Maintenance will be conducted/.test(t), "旧英文残留");
});

// ClinGen 基因检索表空状态（DataTables 默认文案）
test("r44 DOM：ClinGen 空表提示翻成「未找到匹配记录」", () => {
  const html = '<table><tbody><tr class="odd"><td valign="top" colspan="6" class="dataTables_empty">No matching records found</td></tr></tbody></table>';
  const { doc } = boot(html, "https://search.clinicalgenome.org/kb/genes", [common, clingen]);
  assert.equal(doc.querySelector("td").textContent, "未找到匹配记录");
});

// ---- ③ 负例：数据/专名保持英文 ----
test("r44 负例：城市地址、NCT 号、基因名、登录号、DOI 一律不动", () => {
  const html =
    '<div title="Birmingham, Alabama, United States, 35233">Birmingham, Alabama, United States, 35233</div>' +
    "<span>NCT01810913</span><span>TP53</span><span>ENSP00000269305</span><span>10.1126/science.aaz1776</span>";
  const { doc } = boot(html, "https://clinicaltrials.gov/study/NCT01810913", [common, ct]);
  const div = doc.querySelector("div");
  assert.equal(div.getAttribute("title"), "Birmingham, Alabama, United States, 35233");
  assert.equal(div.textContent, "Birmingham, Alabama, United States, 35233");
  const spans = [...doc.querySelectorAll("span")].map((s) => s.textContent);
  assert.deepEqual(spans, ["NCT01810913", "TP53", "ENSP00000269305", "10.1126/science.aaz1776"]);
});

test("r44 负例：PubChem 数据源名与化合物名不翻", () => {
  const html = '<div><span>DrugBank</span><span>ChEMBL</span><span>Hazardous Substances Data Bank (HSDB)</span><span>Aspirin</span></div>';
  const { doc } = boot(html, "https://pubchem.ncbi.nlm.nih.gov/compound/2244", [common, pubchem]);
  const texts = [...doc.querySelectorAll("span")].map((s) => s.textContent);
  assert.deepEqual(texts, ["DrugBank", "ChEMBL", "Hazardous Substances Data Bank (HSDB)", "Aspirin"]);
});