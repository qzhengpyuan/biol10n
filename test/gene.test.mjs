// NCBI Gene 词库：规模与质量、规则锚定、引擎落地与数据保护
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const dict = read("../dict/gene.json");
const entries = Object.entries(dict.exact || {});
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;
const BARE_URL = /(https?:\/\/|www\.[\w-]+|[\w.+-]+@[\w-]+\.[\w.]+)/i;

const engineSrc = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(engineSrc + "; return createEngine;")();

// 站点实际装载的三本词库（config/sites.json 的 ncbi-gene）：common + ncbi + gene
function siteData() {
  const common = read("../dict/common.json");
  const ncbi = read("../dict/ncbi.json");
  return {
    exact: { ...common.exact, ...ncbi.exact, ...dict.exact },
    rules: [...(common.rules || []), ...(ncbi.rules || []), ...(dict.rules || [])],
    templates: []
  };
}

function boot(html) {
  const dom = new JSDOM(html, { url: "https://www.ncbi.nlm.nih.gov/gene/7157" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: siteData(),
    site: { scope: "body", block: "pre, code, kbd, samp, textarea" }
  });
  engine.start();
  return dom.window.document;
}

test("Gene 词库：规模与结构", () => {
  assert.equal(dict.meta.family, "gene");
  assert.ok(entries.length >= 150, "exact 条目过少: " + entries.length);
  assert.ok(Array.isArray(dict.rules) && dict.rules.length >= 10, "规则过少");
  assert.ok(Array.isArray(dict.templates));
});

test("Gene 词库：键唯一、键英文、值含汉字、无裸 URL/邮箱", () => {
  assert.equal(new Set(Object.keys(dict.exact)).size, entries.length, "键重复");
  const bad = [];
  for (const [en, zh] of entries) {
    if (!en || en !== en.trim()) bad.push("键首尾空白: " + JSON.stringify(en));
    if (CJK.test(en)) bad.push("键含中文: " + en);
    if (typeof zh !== "string" || !zh.trim()) bad.push("空译文: " + en);
    if (!CJK.test(zh)) bad.push("译文不含汉字: " + en + " => " + zh);
    if (BARE_URL.test(zh)) bad.push("译文含裸 URL/邮箱: " + en + " => " + zh);
  }
  assert.deepEqual(bad.slice(0, 8), []);
});

test("Gene 词库：规则全部锚定、可编译、译文含汉字", () => {
  const bad = [];
  for (const r of dict.rules) {
    if (!r || typeof r.re !== "string" || typeof r.to !== "string") { bad.push("规则缺 re/to"); continue; }
    if (!/^\^/.test(r.re) || !/\$$/.test(r.re)) bad.push("未锚定: " + r.re);
    try { new RegExp(r.re); } catch (e) { bad.push("无法编译: " + r.re); }
    if (!CJK.test(r.to)) bad.push("译文无汉字: " + r.re);
  }
  assert.deepEqual(bad, []);
});

test("Gene 词库：英文捕获段有 requireHit 保护", () => {
  const guarded = dict.rules.filter((r) => r.requireHit);
  assert.ok(guarded.length >= 2, "带 requireHit 的规则过少: " + guarded.length);
});

test("引擎：分区标题与筛选器落地", () => {
  const doc = boot(
    "<div>" +
      "<h2>Result Filters</h2><h3>Gene sources</h3><h3>Chromosome locations</h3>" +
      "<a>Show additional filters</a><div>Send to:</div><button>Create File</button>" +
      "<div>Full Report</div><div>Gene Table</div><div>GeneRIF</div><div>UI List</div>" +
      "<div>Gene summary</div><div>Genomic context</div><div>Bibliography</div>" +
      "<div>Genomic regions, transcripts, and products</div>" +
      "<div>General gene information</div><div>Related sequences</div>" +
      "<div>Sequence information</div><div>Feature viewer</div><div>Exon count</div>" +
      "</div>"
  );
  const text = doc.body.textContent;
  for (const zh of ["结果筛选", "基因来源", "染色体位置", "显示更多筛选条件", "发送至", "创建文件", "完整报告", "基因表", "基因功能参考文献", "UI 列表", "基因摘要", "基因组上下文", "参考文献", "基因组区域、转录本与产物", "基因一般信息", "相关序列", "序列信息", "特征视图", "外显子数"]) {
    assert.ok(text.includes(zh), "缺少译文: " + zh);
  }
  for (const en of ["Result Filters", "Gene sources", "Send to:", "Create File", "Gene Table"]) {
    assert.ok(!text.includes(en), "英文残留: " + en);
  }
});

test("引擎：句式规则命中（IDs、计数、染色体、排序、状态）", () => {
  const doc = boot(
    "<div>" +
      "<span>Gene ID: 7157, updated on 17-Nov-2026</span>" +
      "<div>Gene ID: 7157</div>" +
      "<div>See all 20407 citations in Pubmed</div>" +
      "<div>See all GeneRIFs (9567)</div>" +
      "<div>See all (20407) citations in PubMed</div>" +
      "<div>See also 932 discontinued or replaced items.</div>" +
      "<div>Showing 5 of 368 (by status, accession number)</div>" +
      "<span>Chromosome 17, NC_000017.11 (7668421..7687490, complement)</span>" +
      "<span>Chromosome 17 - NC_000017.11</span>" +
      "<span>D11S3114 (e-PCR)</span>" +
      "<div>Status: REVIEWED</div>" +
      '<a aria-label="Function: activate to sort column ascending">sort</a>' +
      "</div>"
  );
  const text = doc.body.textContent;
  assert.match(text, /基因 ID：7157，更新于 17-Nov-2026/);
  assert.match(text, /基因 ID：7157/);
  assert.match(text, /查看 PubMed 中全部 20407 条引用/);
  assert.match(text, /查看全部 GeneRIF（9567）/);
  assert.match(text, /查看 PubMed 中全部（20407）条引用/);
  assert.match(text, /另见 932 条已停用或替换的条目。/);
  assert.match(text, /显示 5 条，共 368 条（按状态、登录号）/);
  assert.match(text, /染色体 17，NC_000017.11（7668421..7687490，互补链）/);
  assert.match(text, /染色体 17 - NC_000017.11/);
  assert.match(text, /D11S3114（电子 PCR）/);
  assert.match(text, /状态：已审核/);
  assert.equal(doc.querySelector("a").getAttribute("aria-label"), "功能：升序排序");
});

test("引擎：requireHit 挡住未收录的英文捕获段", () => {
  const doc = boot('<a aria-label="Zzyzx: activate to sort column ascending">x</a>');
  assert.equal(doc.querySelector("a").getAttribute("aria-label"), "Zzyzx: activate to sort column ascending");
});

test("引擎：基因符号、登录号、坐标等数据不被翻译", () => {
  const doc = boot(
    "<div><span>TP53</span><span>P04637</span><span>NM_000546.6</span>" +
      "<span>NC_000017.11</span><span>7668421..7687490</span><span>17p13.1</span></div>"
  );
  const spans = [...doc.querySelectorAll("span")].map((s) => s.textContent);
  assert.deepEqual(spans, ["TP53", "P04637", "NM_000546.6", "NC_000017.11", "7668421..7687490", "17p13.1"]);
});
