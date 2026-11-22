// GTEx 门户首页 / 数据集页 / 文档页骨架词库（gtex-home）回归：结构、关键条目、规则与模板
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

const dict = read("gtex-home.json");
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;
const SITE = { scope: "body", block: "pre, code", rescan: false };

// 站点真实词库栈：common + anatomy + spa + gtex + gtex-home
function siteData() {
  const books = ["common.json", "anatomy.json", "spa.json", "gtex.json", "gtex-home.json"];
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

function boot(html) {
  const dom = new JSDOM(html, { url: "https://gtexportal.org/home/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: siteData(),
    site: SITE
  });
  engine.start();
  return { dom, engine, doc: dom.window.document };
}

test("词库结构：exact 上百、规则与模板齐备、字段规整", () => {
  const exact = Object.entries(dict.exact || {});
  assert.ok(exact.length >= 120, "exact 条目太少: " + exact.length);
  assert.ok((dict.rules || []).length >= 3, "规则太少");
  assert.ok((dict.templates || []).length >= 20, "模板太少");
  const bad = [];
  for (const [en, zh] of exact) {
    if (!en || en !== en.trim()) bad.push("键首尾空白: " + JSON.stringify(en));
    if (CJK.test(en)) bad.push("键含中文: " + en);
    if (!zh || zh !== zh.trim()) bad.push("空译文: " + en);
    if (!CJK.test(zh)) bad.push("译文无中文: " + en);
    if (en === zh) bad.push("自映射: " + en);
    if (/https?:\/\/|www\.|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(zh)) bad.push("译文含 URL/邮箱: " + en);
  }
  assert.deepEqual(bad, []);
});

test("规则：正则合法、译文有中文、捕获组与占位符对得上", () => {
  const bad = [];
  for (const r of dict.rules || []) {
    if (!r.re || !r.to) { bad.push("缺字段: " + JSON.stringify(r)); continue; }
    let re;
    try { re = new RegExp(r.re); } catch (e) { bad.push("正则非法: " + r.re); continue; }
    if (!CJK.test(r.to)) bad.push("规则译文无中文: " + r.re);
    if (/https?:\/\/|www\./.test(r.to)) bad.push("规则译文含 URL: " + r.re);
    const slotNums = [...r.to.matchAll(/\$(\d)/g)].map((m) => Number(m[1]));
    const groupCount = (re.source.match(/\((?!\?)/g) || []).length;
    for (const n of slotNums) if (n > groupCount) bad.push("占位符超出捕获组: " + r.re);
  }
  assert.deepEqual(bad, []);
});

test("模板：pat 真实长度、占位符编号连续且与译文一致", () => {
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

test("关键条目：导航、数据集页与文档页骨架都命中", () => {
  const cases = [
    ["Single Cell", "单细胞"],
    ["Downloading Adult GTEx data", "下载成人 GTEx 数据"],
    ["Related pages", "相关页面"],
    ["V10 Release", "V10 版本"],
    ["Bulk tissue expression", "批量组织表达"],
    ["Metadata Files", "元数据文件"],
    ["Please cite usage of GTEx data as follows:", "引用 GTEx 数据时请按以下格式："]
  ];
  for (const [en, zh] of cases) assert.equal(dict.exact[en], zh, "缺条目: " + en);
});

test("引擎：exact 命中整节点，文件名与编号不动", () => {
  const { doc } = boot(
    "<main><h2>Downloading Adult GTEx data</h2><p>Related pages</p>" +
      '<span>GTEx_Analysis_2026-05-19_v11_RNASeQCv2.4.3_gene_reads.gct.gz</span>' +
      "<p>chr1:12345-67890</p></main>"
  );
  assert.equal(doc.querySelector("h2").textContent, "下载成人 GTEx 数据");
  assert.equal(doc.querySelector("p").textContent, "相关页面");
  assert.equal(doc.querySelector("span").textContent, "GTEx_Analysis_2026-05-19_v11_RNASeQCv2.4.3_gene_reads.gct.gz");
  assert.equal(doc.querySelectorAll("p")[1].textContent, "chr1:12345-67890");
});

test("引擎：规则按捕获组把组织名一起译出，不出现半中半英", () => {
  const { doc } = boot(
    "<main><p>Gene read counts for Brain - Cortex.</p><p>Gene TPMs for Adipose - Subcutaneous.</p></main>"
  );
  const [a, b] = doc.querySelectorAll("p");
  assert.match(a.textContent, /基因读取计数。$/);
  assert.doesNotMatch(a.textContent, /Brain|Cortex/);
  assert.match(b.textContent, /基因 TPM。$/);
  assert.doesNotMatch(b.textContent, /Adipose|Subcutaneous/);
});

test("引擎：被 <a> 切碎的段落走模板，链接保留", () => {
  const { doc } = boot(
    "<main><p>The project's goals are described in: <a href=\"#paper\">The GTEx marker paper.</a></p></main>"
  );
  const p = doc.querySelector("p");
  assert.match(p.textContent, /本项目目标见：/);
  const a = p.querySelector("a");
  assert.ok(a, "链接节点必须保留");
  assert.equal(a.getAttribute("href"), "#paper");
});

test("引擎：数据集页 Related pages 列表项整句成中文", () => {
  const { doc } = boot(
    '<main><ul><li>The <a href="#tss">Tissue Sampling Sites page</a> shows more information about our tissue sampling procedures.</li></ul></main>'
  );
  const li = doc.querySelector("li");
  assert.match(li.textContent, /介绍了我们组织采样流程的更多信息。/);
  assert.ok(li.querySelector("a"), "链接节点必须保留");
});

test("数据集与版本名不译：GTEx Analysis V*、GENCODE v*、reads 统一为读段", () => {
  for (const v of ["V11", "V10", "V9", "V8", "V7", "V6p", "V6", "V4"]) {
    assert.equal(dict.exact["GTEx Analysis " + v], undefined, "数据集名被翻: " + v);
  }
  for (const [k, val] of Object.entries(dict.exact)) {
    assert.ok(!/分析\s*V\d/.test(val), "译文里出现版本名翻译: " + k + " => " + val);
    assert.ok(!/读取/.test(val), "reads 应统一为读段: " + k + " => " + val);
  }
});
