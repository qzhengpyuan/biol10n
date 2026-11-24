// r41：四册补译回归（STRING 面板骨架 / TargetScan AND-OR / NCBI 缩放气泡 / UCSC 替代序列名提示）。
// 原文均取自真实渲染 DOM（2026-11-23 CDP 9227 实测，__BIOL10N.disable() 还原英文）：
//   STRING  https://string-db.org/network/9606.ENSP00000269305  .ppi_enrichment_hint / .enrichments_closing_remarks
//   TargetScan https://www.targetscan.org/vert_80/
//   NCBI Gene https://www.ncbi.nlm.nih.gov/gene/672  data-qtip
//   UCSC https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38&position=chr1  data-tooltip / mouseovertext
// 不翻的数据：基因名/登录号/组装名/坐标区间/类别名全称/组织名+TPM 数值。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const sites = read("../config/sites.json").sites;
const siteOf = (id) => {
  const s = sites.find((x) => x.id === id);
  assert.ok(s, "config/sites.json 里应有站点 " + id);
  return s;
};
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;

const engineSrc = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(engineSrc + "; return createEngine;")();

// 与 config/sites.json 的 dicts 同序装载（引擎合并词表的顺序）
function siteData(site) {
  const exact = {};
  const rules = [];
  const templates = [];
  for (const n of site.dicts) {
    const b = read("../dict/" + n + ".json");
    Object.assign(exact, b.exact || {});
    rules.push(...(b.rules || []));
    templates.push(...(b.templates || []));
  }
  return { exact, rules, templates };
}

function boot(site, html, url) {
  const dom = new JSDOM("<!doctype html><html><body>" + html + "</body></html>", { url });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: siteData(site),
    site
  });
  engine.start();
  return { dom, doc: dom.window.document, engine };
}

/* ───────────────────────── STRING ───────────────────────── */

// 实测原文 DOM（.ppi_enrichment_hint）：文本 / SPAN.emphasis not / 文本 / BR /
// 文本 / SPAN(onclick) what does that mean? / 文本 ")" —— 括号是半角
const ONCLICK = 'return load_info_window (event, "Interaction Enrichment", "interactions_not_significant");';
const HINT_HTML =
  '<div class="ppi_enrichment_hint">' +
  "your network does " +
  '<span class="emphasis">not</span>' +
  " have significantly more " +
  "<br>" +
  "interactions than expected (" +
  '<span onclick=\'' + ONCLICK + "\'>what does that mean?</span>" +
  ")" +
  "</div>";

// 实测原文 DOM（.enrichments_closing_remarks）：类别列表是裸文本节点，不是元素
const CATEGORIES =
  "Local Network Cluster (STRING), Disease-gene Associations (DISEASES), " +
  "Hallmark Gene Set (Molecular Signatures DB), Fission Yeast Phenotype Ontology (Monarch), " +
  "GWAS Catalog, Protein Domains (Pfam), Protein Domains and Features (InterPro).";
const CLOSING_HTML =
  '<div class="enrichments_closing_remarks">\n There were ' +
  "<span>no</span>" +
  " significant pathway enrichments observed in the following categories:" +
  "<br>" +
  " " + CATEGORIES +
  "</div>";

test("r41 STRING 词库：新增两条模板与 not/no 两词条，槽位自洽", () => {
  const d = read("../dict/string-atlas.json");
  assert.equal(d.exact["not"], "并不");
  assert.equal(d.exact["no"], "未");
  for (const [k, v] of [["not", "并不"], ["no", "未"]]) {
    assert.ok(CJK.test(v), "译文要有汉字: " + k);
    assert.notEqual(k, v);
  }
  const hint = d.templates.find((t) => t.pat.indexOf("your network does ") === 0);
  assert.ok(hint, "缺少 .ppi_enrichment_hint 整句模板");
  // 否定词在原文里是内联 SPAN，模板只把它留成槽位；中文句子的否定要靠 exact not 落进槽位
  assert.match(hint.pat, /\{\{1\}\}/);
  assert.ok(!CJK.test(hint.pat), "pat 必须是英文原文");
  assert.ok(CJK.test(hint.zh));
  const slots = (s) => {
    const set = new Set();
    for (const m of s.matchAll(/\{\{(\d+)\}\}/g)) set.add(Number(m[1]));
    return [...set].sort((a, b) => a - b);
  };
  assert.deepEqual(slots(hint.pat), slots(hint.zh), "zh 用到的槽位必须与 pat 一一对应");
  assert.deepEqual(slots(hint.pat), [1, 2, 3]);

  const closing = d.templates.find((t) => t.pat.indexOf("There were ") === 0);
  assert.ok(closing, "缺少 .enrichments_closing_remarks 模板");
  assert.ok(!CJK.test(closing.pat));
  assert.deepEqual(slots(closing.pat), slots(closing.zh));
  // 类别名是数据（数据源给的类别全称），模板原样保留，不进槽位、不翻
  assert.ok(closing.pat.indexOf(CATEGORIES) >= 0, "pat 必须原样包含类别列表");
  assert.ok(closing.zh.indexOf(CATEGORIES) >= 0, "类别列表必须原样嵌进译文");
  assert.ok(!CJK.test(closing.zh.slice(closing.zh.indexOf("Local Network Cluster"))), "类别列表里不能出现汉字");
});

test("r41 STRING .ppi_enrichment_hint：整句模板产出中文骨架，否定词与链接槽位都保住", () => {
  const { doc } = boot(siteOf("string-db"), HINT_HTML, "https://string-db.org/network/9606.ENSP00000269305");
  const el = doc.querySelector(".ppi_enrichment_hint");
  const txt = el.textContent;
  assert.match(txt, /你的网络中的相互作用/);
  assert.match(txt, /显著多于预期/, "不能丢否定词：应是「并不显著多于预期」");
  assert.ok(!/your network does|interactions than expected|significantly more/.test(txt), "英文骨架必须全翻: " + txt);
  // 否定词 SPAN 仍在、且已翻成中文（原先由 common.json 的 No 兜底会错成「否」）
  const em = el.querySelector("span.emphasis");
  assert.ok(em, "强调 SPAN 不能丢");
  assert.equal(em.textContent, "并不");
  // 链接槽位：SPAN 保留 onclick（交互依赖它），文案沿用既有词条
  const link = el.querySelector("span[onclick]");
  assert.ok(link, "「这是什么意思？」的链接 SPAN 不能丢");
  assert.equal(link.getAttribute("onclick"), ONCLICK);
  assert.equal(link.textContent, "这是什么意思？");
  assert.match(txt, /（这是什么意思？）/);
  // BR 槽位保留在句尾
  assert.ok(el.querySelector("br"), "BR 不能丢");
});

test("r41 STRING .enrichments_closing_remarks：只翻骨架，7 个类别名保持英文", () => {
  const { doc } = boot(siteOf("string-db"), CLOSING_HTML, "https://string-db.org/network/9606.ENSP00000269305");
  const el = doc.querySelector(".enrichments_closing_remarks");
  const txt = el.textContent;
  assert.match(txt, /在以下类别中/);
  assert.match(txt, /观察到显著的通路富集/);
  assert.ok(!/There were|significant pathway enrichments observed in the following categories/.test(txt), "英文骨架必须翻: " + txt);
  // 否定词：类目内 SPAN 落在槽位里，由 exact no→未 翻（不能丢「未」变肯定句）
  assert.match(txt, /在以下类别中\s*未\s*观察到/);
  // 类别名是数据，全部保持英文原样
  for (const name of [
    "Local Network Cluster (STRING)",
    "Disease-gene Associations (DISEASES)",
    "Hallmark Gene Set (Molecular Signatures DB)",
    "Fission Yeast Phenotype Ontology (Monarch)",
    "GWAS Catalog",
    "Protein Domains (Pfam)",
    "Protein Domains and Features (InterPro)."
  ]) {
    assert.ok(txt.indexOf(name) >= 0, "类别名不能翻也不能丢: " + name);
  }
  assert.ok(!CJK.test(txt.slice(txt.indexOf("Local Network Cluster"))), "类别列表里不能出现汉字");
  assert.ok(el.querySelector("br"), "BR 不能丢");
});

/* ───────────────────────── TargetScan ───────────────────────── */

test("r41 TargetScan：AND/OR 是 <p> 里的独立文本节点（不是按钮 value），整节点翻成「和/或」", () => {
  const site = siteOf("targetscan");
  // 实测形态：物种表单下方的连接词，纯文本节点，无 input、无 value
  const { doc } = boot(site, "<p>AND/OR</p><form><p>species</p><p>AND</p><p>gene</p></form>", "https://www.targetscan.org/vert_80/");
  assert.equal(doc.querySelectorAll("p")[0].textContent, "和/或");
  assert.equal(doc.querySelectorAll("input").length, 0, "原文不是 input 的 value，本用例不挂按钮");
  assert.equal(read("../dict/targetscan.json").exact["AND/OR"], "和/或");
  // 站点是 funcWords:false：独立的物种/基因连接词 "AND" 被功能词表挡住，词库层面翻不了（已知残留）
  assert.equal(site.funcWords, false);
  assert.equal(doc.querySelectorAll("p")[2].textContent, "AND", "单 AND 属功能词，站点配置明确排除了它");
});

/* ───────────────────────── NCBI Gene ───────────────────────── */

test("r41 NCBI Gene：gene2.json 显式登记大写 Zoom In / Zoom Out（与 ncbi.json 同译法）", () => {
  const g2 = read("../dict/gene2.json");
  assert.equal(g2.exact["Zoom In"], "放大");
  assert.equal(g2.exact["Zoom Out"], "缩小");
  const site = siteOf("ncbi-gene");
  const { doc } = boot(
    site,
    '<a id="a" data-qtip="Zoom In"></a><a id="b" data-qtip="Zoom Out"></a><a id="c" data-qtip="Zoom To Sequence"></a>',
    "https://www.ncbi.nlm.nih.gov/gene/672"
  );
  assert.equal(doc.getElementById("a").getAttribute("data-qtip"), "放大");
  assert.equal(doc.getElementById("b").getAttribute("data-qtip"), "缩小");
  assert.equal(doc.getElementById("c").getAttribute("data-qtip"), "缩放到序列");
});

/* ───────────────────────── UCSC ───────────────────────── */

// 实测原文（data-tooltip 与 mouseovertext 同一串）：数据段 1, CM000663.2, NC_000001.11 不翻
const UCSC_TIP =
  "<b>Alternate sequence names</b>: 1, CM000663.2, NC_000001.11<br><br>" +
  "Alternative sequence names can be used in the position box, custom tracks, track hubs, bigBed, bigWig, and similar files. " +
  'See the <a href="/goldenPath/help/assemblyHubHelp.html#chromAlias">docs page</a> for more information';

test("r41 UCSC：工具提示 HTML 整串走属性通道（translateHtmlAttr），说明句翻、序列别名数据不翻", () => {
  const site = siteOf("ucsc");
  const html =
    '<span id="s1" data-tooltip="' + UCSC_TIP.replace(/"/g, "&quot;") + '"></span>' +
    '<span id="s2" mouseovertext="' + UCSC_TIP.replace(/"/g, "&quot;") + '"></span>';
  const { doc } = boot(site, html, "https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38&position=chr1");
  for (const id of ["s1", "s2"]) {
    const v = doc.getElementById(id).getAttribute(id === "s1" ? "data-tooltip" : "mouseovertext");
    assert.match(v, /<b>替代序列名称<\/b>/, "标题要翻: " + v.slice(0, 60));
    assert.match(v, /1, CM000663.2, NC_000001.11/, "序列别名是数据，原样保留");
    assert.match(v, /替代序列名称可用于位置框、自定义轨道、轨道 Hub、bigBed、bigWig 及类似文件。参见/);
    assert.match(v, /<a href="\/goldenPath\/help\/assemblyHubHelp.html#chromAlias">文档页面<\/a>/, "链接与 href 必须保住");
    assert.match(v, /了解更多信息/);
    assert.ok(!/can be used in the position box|for more information|See the/.test(v), "英文说明句必须全翻: " + v);
  }
  // 词库层：规则只认完整说明句（其它语种的同类句子/片段不被套用）
  const d = read("../dict/ucsc-extra.json");
  assert.equal(d.exact["Alternate sequence names"], "替代序列名称");
  const rule = d.rules.find((r) => r.re.indexOf("^Alternative sequence names can be used") === 0);
  assert.ok(rule, "缺少说明句规则");
  const re = new RegExp(rule.re);
  assert.doesNotMatch("Alternative sequence names can be used in the position box", re, "规则必须锚定整句");
  assert.doesNotMatch("Gene names can be used in the position box, custom tracks, track hubs, bigBed, bigWig, and similar files. See the", re);
});

test("r41 UCSC：组织名 + TPM 数值行是数据，不翻", () => {
  const site = siteOf("ucsc");
  const data = "Liver 12.3 TPM, Kidney 4.1 TPM";
  const { doc } = boot(site, '<span id="t" data-tooltip="' + data + '"></span>', "https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38");
  assert.equal(doc.getElementById("t").getAttribute("data-tooltip"), data);
});
