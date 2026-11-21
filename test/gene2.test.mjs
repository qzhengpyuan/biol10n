// NCBI Gene 剩余英文补充词库（gene2）：结构、规则锚定、模板占位符与引擎落地
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const dict = read("../dict/gene2.json");
const entries = Object.entries(dict.exact || {});
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;
const BARE_URL = /(https?:\/\/|www\.[\w-]+|[\w.+-]+@[\w-]+\.[\w.]+)/i;

const engineSrc = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(engineSrc + "; return createEngine;")();

// 站点实际装载：common + ncbi + gene + gene2（config/sites.json 的 ncbi-gene 需由 lead 追加 gene2）
function siteData() {
  const books = ["../dict/common.json", "../dict/ncbi.json", "../dict/gene.json"].map(read);
  return {
    exact: Object.assign({}, ...books.map((b) => b.exact || {}), dict.exact),
    rules: [].concat(...books.map((b) => b.rules || []), dict.rules || []),
    templates: [].concat(...books.map((b) => b.templates || []), dict.templates || [])
  };
}

function boot(html) {
  const dom = new JSDOM(html, { url: "https://www.ncbi.nlm.nih.gov/gene/7157" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: siteData(),
    site: {
      scope: "body",
      block: "pre, code, kbd, samp, textarea",
      proseExempt: ".usa-banner, .usa-media_block-body, [class*=disclaimer]",
      attrs: ["placeholder", "title", "aria-label", "alt", "value"]
    }
  });
  engine.start();
  return dom.window.document;
}

test("gene2 词库：规模与结构", () => {
  assert.equal(dict.meta.family, "gene");
  assert.ok(entries.length >= 35, "exact 条目过少: " + entries.length);
  assert.ok(Array.isArray(dict.rules) && dict.rules.length >= 6, "规则过少");
  assert.ok(Array.isArray(dict.templates) && dict.templates.length >= 2, "模板过少");
});

test("gene2 词库：键唯一、键英文、值含汉字、无裸 URL/邮箱、无自映射", () => {
  assert.equal(new Set(Object.keys(dict.exact)).size, entries.length, "键重复");
  const bad = [];
  for (const [en, zh] of entries) {
    if (!en || en !== en.trim()) bad.push("键首尾空白: " + JSON.stringify(en));
    if (CJK.test(en)) bad.push("键含中文: " + en);
    if (typeof zh !== "string" || !zh.trim()) bad.push("空译文: " + en);
    if (!CJK.test(zh)) bad.push("译文不含汉字: " + en + " => " + zh);
    if (BARE_URL.test(zh)) bad.push("译文含裸 URL/邮箱: " + en + " => " + zh);
    if (en === zh) bad.push("自映射: " + en);
  }
  assert.deepEqual(bad.slice(0, 8), []);
});

test("gene2 词库：规则全部锚定、可编译、译文含汉字", () => {
  const bad = [];
  for (const r of dict.rules) {
    if (!r || typeof r.re !== "string" || typeof r.to !== "string") { bad.push("规则缺 re/to"); continue; }
    if (!/^\^/.test(r.re) || !/\$$/.test(r.re)) bad.push("未锚定: " + r.re);
    try { new RegExp(r.re); } catch (e) { bad.push("无法编译: " + r.re); }
    if (!CJK.test(r.to)) bad.push("译文无汉字: " + r.re);
    if (!/\$1/.test(r.to)) bad.push("未使用捕获组: " + r.re);
  }
  assert.deepEqual(bad, []);
});

test("gene2 词库：模板占位符合法、长度合规、键里没有占位符", () => {
  const bad = [];
  for (const t of dict.templates) {
    if (typeof t.pat !== "string" || typeof t.zh !== "string") { bad.push("模板缺 pat/zh"); continue; }
    if (t.pat.length < 20 || t.pat.length > 2200) bad.push("pat 长度越界: " + t.pat.length);
    if (CJK.test(t.pat)) bad.push("pat 含中文: " + t.pat.slice(0, 40));
    if (!CJK.test(t.zh)) bad.push("zh 无中文: " + t.pat.slice(0, 40));
    const pk = (t.pat.match(/\{\{(\d+)\}\}/g) || []).sort();
    const zk = (t.zh.match(/\{\{(\d+)\}\}/g) || []).sort();
    if (JSON.stringify(pk) !== JSON.stringify(zk)) bad.push("占位符不一致: " + t.pat.slice(0, 40));
  }
  for (const [en] of entries) if (/\{\{\d+\}\}/.test(en)) bad.push("exact 键含占位符: " + en);
  assert.deepEqual(bad, []);
});

test("引擎：区块说明句与控件提示落地", () => {
  const doc = boot(
    "<div>" +
      "<p>The following sections contain reference sequences that belong to a specific genome build.</p>" +
      "<p>In addition, your package will include a detailed data report in both TSV and JSONL formats.</p>" +
      "<p><a href='/nuccore/NR_176326.1'>NR_176326.1</a> RNA Sequence</p>" +
      "<li>Publication: <a href='/pubmed/26076956'>PMID 26076956</a></li>" +
      "<div class='brieflinkpop'>Link to related protein entry</div>" +
      "<div class='brieflinkpop'>BioAssays related to the gene by protein target or RNAi target</div>" +
      "</div>"
  );
  const text = doc.body.textContent;
  for (const zh of ["以下各节包含属于特定基因组组装版本的参考序列", "此外，数据包中还会包含一份", "RNA 序列", "文献：", "链接到相关蛋白质条目", "与该基因相关的生物测定"]) {
    assert.ok(text.includes(zh), "缺少译文: " + zh);
  }
  for (const en of ["The following sections contain reference sequences", "In addition, your package", "RNA Sequence", "Publication:", "Link to related protein entry"]) {
    assert.ok(!text.includes(en), "英文残留: " + en);
  }
});

test("引擎：属性通道（placeholder / title）落地", () => {
  const doc = boot(
    "<div>" +
      "<input id='q' placeholder='Enter text to narrow down the list'>" +
      "<input id='n' placeholder='Name your file'>" +
      "<a id='f' title='Goto First Page' href='#'>1</a>" +
      "<a id='p' title='Goto Previous Page' href='#'>prev</a>" +
      "<span id='nn' title='Inactive Goto Next Page'>next</span>" +
      "<span id='nl' title='Inactive Goto Last Page'>last</span>" +
      "</div>"
  );
  assert.equal(doc.getElementById("q").getAttribute("placeholder"), "输入文本以缩小列表范围");
  assert.equal(doc.getElementById("n").getAttribute("placeholder"), "为文件命名");
  assert.equal(doc.getElementById("f").getAttribute("title"), "首页");
  assert.equal(doc.getElementById("p").getAttribute("title"), "上一页");
  assert.equal(doc.getElementById("nn").getAttribute("title"), "下一页（不可用）");
  assert.equal(doc.getElementById("nl").getAttribute("title"), "末页（不可用）");
});

test("引擎：坐标、组装与剂量证据句式规则", () => {
  const doc = boot(
    "<div>" +
      "<div>NC_000017.11 (7668421..7687490, complement)</div>" +
      "<div>7668421..7687490 complement</div>" +
      "<div>NC_000017.11 Reference GRCh38.p14 Primary Assembly</div>" +
      "<div>NC_060941.1 Alternate T2T-CHM13v2.0</div>" +
      "<div>No evidence available (Last evaluated 2021-11-10)</div>" +
      "<div>Sufficient evidence for dosage pathogenicity (Last evaluated 2021-11-10)</div>" +
      "</div>"
  );
  const text = doc.body.textContent;
  assert.match(text, /NC_000017\.11（7668421\.\.7687490，互补链）/);
  assert.match(text, /7668421\.\.7687490 互补链/);
  assert.match(text, /NC_000017\.11 参考 GRCh38\.p14 主要组装/);
  assert.match(text, /NC_060941\.1 替代 T2T-CHM13v2\.0/);
  assert.match(text, /暂无证据（最近评估于 2021-11-10）/);
  assert.match(text, /剂量致病性证据充分（最近评估于 2021-11-10）/);
});

test("引擎：模板通道命中且保留内联链接", () => {
  const doc = boot(
    "<div>" +
      "<p id='lo'>The following <a href='https://www.ncbi.nlm.nih.gov/projects/linkout/index.html'>LinkOut</a> resources are supplied by external providers. These providers are responsible for maintaining the links.</p>" +
      "<p id='rs'> These reference sequences are curated independently of the genome\n" +
      "                annotation cycle, so their versions may not match the RefSeq versions in the current\n" +
      "                genome build. Identify version mismatches by comparing the version of the RefSeq in\n" +
      "                this section to the one reported in <a href='#genomic-regions'>Genomic regions, transcripts, and products</a> above. </p>" +
      "</div>"
  );
  const lo = doc.getElementById("lo");
  assert.ok(lo.textContent.includes("以下 "), lo.textContent);
  assert.ok(lo.textContent.includes("资源由外部提供方提供，相应链接由这些提供方负责维护。"), lo.textContent);
  assert.equal(lo.querySelectorAll("a").length, 1, "模板丢了链接");
  assert.equal(lo.querySelector("a").getAttribute("href"), "https://www.ncbi.nlm.nih.gov/projects/linkout/index.html");

  const rs = doc.getElementById("rs");
  assert.ok(rs.textContent.includes("这些参考序列独立于基因组注释周期"), rs.textContent);
  assert.ok(rs.textContent.includes("中报告的版本来识别版本不一致"), rs.textContent);
  assert.equal(rs.querySelectorAll("a").length, 1, "模板丢了链接");
  assert.equal(rs.querySelector("a").getAttribute("href"), "#genomic-regions");
  assert.ok(rs.textContent.includes("基因组区域、转录本与产物"), "锚文本未翻译: " + rs.textContent);
});

test("引擎：基因符号、登录号、GO 术语、文献标题不被翻译", () => {
  const doc = boot(
    "<div>" +
      "<h1>TP53 tumor protein p53 [ Homo sapiens (human) ]</h1>" +
      "<span>NM_000546.6</span><span>P04637</span><span>17p13.1</span>" +
      "<span>enables protein binding</span>" +
      "<span>Li-Fraumeni syndrome</span>" +
      "<span>UniSTS:158212</span>" +
      "<a>GRAIL1 Stabilizes Misfolded Mutant p53 through a Ubiquitin Ligase-Independent, Chaperone Regulatory Function.</a>" +
      "</div>"
  );
  const texts = [...doc.querySelectorAll("span")].map((s) => s.textContent);
  assert.deepEqual(texts, ["NM_000546.6", "P04637", "17p13.1", "enables protein binding", "Li-Fraumeni syndrome", "UniSTS:158212"]);
  assert.match(doc.querySelector("h1").textContent, /TP53 tumor protein p53 \[ Homo sapiens \(human\) \]/);
  assert.match(doc.querySelector("a").textContent, /^GRAIL1 Stabilizes/);
});
