// NCBI Gene 第二轮补译（gene2）：LinkOut 面板标签、分析日期规则、与 seq/gene 册的译法一致性
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

// 站点实际装载顺序（config/sites.json 的 ncbi-gene）；漏接 gene2 会在这里被顶出来
function siteBooks() {
  const sites = read("../config/sites.json");
  const list = Array.isArray(sites) ? sites : sites.sites;
  const site = list.find((s) => s.id === "ncbi-gene");
  assert.ok(site, "config/sites.json 缺少 ncbi-gene");
  return site.dicts;
}

function siteData() {
  const books = siteBooks().map((id) => read("../dict/" + id + ".json"));
  return {
    exact: Object.assign({}, ...books.map((b) => b.exact || {})),
    rules: [].concat(...books.map((b) => b.rules || [])),
    templates: [].concat(...books.map((b) => b.templates || []))
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
      attrs: ["placeholder", "title", "aria-label", "alt", "value", "data-qtip"]
    }
  });
  engine.start();
  return dom.window.document;
}

test("gene2：站点接线与规模", () => {
  assert.ok(siteBooks().includes("gene2"), "ncbi-gene 未接 gene2");
  assert.equal(dict.meta.family, "gene");
  assert.ok(entries.length >= 50, "exact 条目过少: " + entries.length);
  assert.ok(dict.rules.length >= 7, "规则过少: " + dict.rules.length);
  assert.ok(dict.templates.length >= 2, "模板过少: " + dict.templates.length);
});

test("gene2：键唯一、键英文、值含汉字、无裸 URL/自映射", () => {
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

test("gene2：规则全部锚定、可编译、用捕获组且译文含汉字", () => {
  const bad = [];
  for (const r of dict.rules) {
    if (!r || typeof r.re !== "string" || typeof r.to !== "string") { bad.push("规则缺 re/to"); continue; }
    if (!/^\^/.test(r.re) || !/\$$/.test(r.re)) bad.push("未锚定: " + r.re);
    try { new RegExp(r.re); } catch { bad.push("无法编译: " + r.re); }
    if (!CJK.test(r.to)) bad.push("译文无汉字: " + r.re);
    if (!/\$1/.test(r.to)) bad.push("未使用捕获组: " + r.re);
  }
  assert.deepEqual(bad, []);
});

test("gene2：与 seq / gene 册同键同值（不改既有译法）", () => {
  const seq = read("../dict/seq.json").exact;
  const gene = read("../dict/gene.json").exact;
  // 同一 LinkOut 面板在 Nucleotide / Protein 页有先例，值必须一模一样，否则 dict-lint 报跨册冲突
  for (const k of ["Find Quality Antibodies", "reagents", "Dryad Digital Repository"]) {
    assert.ok(k in seq, "seq 册缺少先例: " + k);
    assert.equal(dict.exact[k], seq[k], "与 seq 册译法不一致: " + k);
  }
  assert.equal(dict.exact["NEW"], gene["New"], "NEW 与 gene 册的 New 应同值");
});

test("引擎：LinkOut 面板标签在 <a>/<td>/<span> 三种节点边界都落地", () => {
  const doc = boot(
    "<table class='linkout'>" +
      "<tr><td><a id='addgene' href='https://www.addgene.org/'>Get Plasmids - Addgene</a></td></tr>" +
      "<tr><td><a id='orf' href='https://www.genscript.com/'>Order full-length ORF clone</a></td></tr>" +
      "<tr><td><a id='prom' href='https://www.genscript.com/p'>Order promoter clone</a></td></tr>" +
      "<tr><td><a id='shrna' href='https://www.genscript.com/s'>Order shRNA clones</a></td></tr>" +
      "<tr><td id='ab'>Find Quality Antibodies</td></tr>" +
      "<tr><td><span id='rp'>Find Recombinant Proteins and Peptides</span></td></tr>" +
      "<tr><td id='reag'>reagents</td></tr>" +
      "<tr><td id='review'>reagent review</td></tr>" +
      "<tr><td id='probe'>Probe</td></tr>" +
      "<tr><td><sup id='new'>NEW</sup></td></tr>" +
      "<tr><td>PubChem BioAssay</td></tr>" +
      "<tr><td id='dryad'>Dryad Digital Repository</td></tr>" +
      "</table>"
  );
  const want = {
    addgene: "获取质粒 - Addgene",
    orf: "订购全长 ORF 克隆",
    prom: "订购启动子克隆",
    shrna: "订购 shRNA 克隆",
    ab: "查找优质抗体",
    rp: "查找重组蛋白与多肽",
    reag: "试剂",
    review: "试剂评价",
    probe: "探针",
    new: "新增"
  };
  for (const [id, zh] of Object.entries(want)) {
    assert.equal(doc.getElementById(id).textContent, zh, "译文不对: " + id);
  }
  assert.ok(doc.body.textContent.includes("PubChem 生物测定"), "缺 PubChem BioAssay 译文");
  assert.equal(doc.getElementById("dryad").textContent, "Dryad 数字存储库", "资源名译法与 seq 册不一致");
  assert.equal(doc.getElementById("addgene").getAttribute("href"), "https://www.addgene.org/", "链接被改");
  assert.equal(doc.getElementById("orf").getAttribute("href"), "https://www.genscript.com/", "链接被改");
});

test("引擎：HPA 表达块的分析日期只翻标签、日期原样保留", () => {
  const doc = boot(
    "<div class='rprt'><div>HPA RNA-seq normal tissues</div>" +
      "<div id='d'>Analysis date: Mon Apr 2 22:54:59 2018</div>" +
      "<div>RNA sequencing of total RNA from 20 human tissues</div></div>"
  );
  const d = doc.getElementById("d").textContent;
  assert.ok(d.startsWith("分析日期："), "标签未翻: " + d);
  assert.ok(d.includes("Mon Apr 2 22:54:59 2018"), "日期被改动: " + d);
  // 同块的数据集名与实验描述是内容，保持英文
  assert.ok(doc.body.textContent.includes("HPA RNA-seq normal tissues"));
  assert.ok(doc.body.textContent.includes("RNA sequencing of total RNA from 20 human tissues"));
});

test("引擎：厂商广告与资源名整条留英文（含基因符号/品牌）", () => {
  const doc = boot(
    "<div>" +
      "<a id='buy'>Buy TP53/p53 Primary Monoclonal Antibodies</a>" +
      "<a id='buy2'>Buy TP53/p53 Recombinant Rabbit Monoclonal Antibodies</a>" +
      "<div id='gs'>GenScript latest version of gene cDNA ORF Clone</div>" +
      "<div id='efp'>Human eFP Browser</div>" +
      "<div id='labome'>ExactAntigen/Labome</div>" +
      "<div id='hpa'>HPA RNA-seq normal tissues</div>" +
      "</div>"
  );
  const ids = ["buy", "buy2", "gs", "efp", "labome", "hpa"];
  const before = ["Buy TP53/p53 Primary Monoclonal Antibodies", "Buy TP53/p53 Recombinant Rabbit Monoclonal Antibodies", "GenScript latest version of gene cDNA ORF Clone", "Human eFP Browser", "ExactAntigen/Labome", "HPA RNA-seq normal tissues"];
  ids.forEach((id, i) => assert.equal(doc.getElementById(id).textContent, before[i], "内容被误翻: " + before[i]));
});

test("引擎：内容（异构体名、GO 术语、登录号、病名、坐标）不被翻译", () => {
  const doc = boot(
    "<div>" +
      "<div id='iso'>breast cancer type 1 susceptibility protein isoform 3</div>" +
      "<div id='go'>enables protein binding</div>" +
      "<div id='acc'>NP_009227.1</div>" +
      "<div id='acc2'>AC135721</div>" +
      "<div id='disease'>Li-Fraumeni syndrome</div>" +
      "<div id='band'>17p13.1</div>" +
      "<div id='coord'>NC_000017.11: 7.7M..7.7M (24,790 nt) C</div>" +
      "<div id='probe'>Probe signal intensity</div>" +
      "</div>"
  );
  const same = ["iso", "go", "acc", "acc2", "disease", "band", "coord", "probe"];
  for (const id of same) {
    const text = doc.getElementById(id).textContent;
    assert.ok(!CJK.test(text), "内容被翻成中文: " + text);
  }
  assert.equal(doc.getElementById("iso").textContent, "breast cancer type 1 susceptibility protein isoform 3");
  assert.equal(doc.getElementById("probe").textContent, "Probe signal intensity", "exact 之外的含 Probe 句子不该动");
});

test("引擎：LinkOut 说明句模板仍命中且保留内联链接", () => {
  const doc = boot(
    "<p id='lo'>The following <a href='https://www.ncbi.nlm.nih.gov/projects/linkout/index.html'>LinkOut</a> resources are supplied by external providers. These providers are responsible for maintaining the links.</p>"
  );
  const lo = doc.getElementById("lo");
  assert.ok(lo.textContent.includes("资源由外部提供方提供，相应链接由这些提供方负责维护。"), lo.textContent);
  assert.equal(lo.querySelectorAll("a").length, 1, "模板丢了链接");
});
