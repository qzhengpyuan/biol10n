// seq：NCBI Nucleotide / Protein / Assembly 三页共用词库（区块标题、按钮、表头、属性、固定说明句）
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const engineSrc = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(engineSrc + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/seq.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8"));
// 用真实站点配置启动引擎：proseExempt / block / attrs 与线上一致，避免测试环境比线上宽松。
const siteCfg = sites.sites.find((s) => s.id === "ncbi-nuccore");

function boot(html, url = "https://www.ncbi.nlm.nih.gov/nuccore/NM_000546.6") {
  const dom = new JSDOM(html, { url });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: dict.exact, rules: dict.rules || [], templates: dict.templates || [] },
    site: {
      scope: siteCfg.scope,
      block: sites.defaults.block,
      attrs: sites.defaults.attrs,
      proseExempt: siteCfg.proseExempt
    }
  });
  engine.start();
  return { dom, engine, doc: dom.window.document };
}

/** 转一遍，返回指定选择器的 textContent，然后关掉 window 释放定时器。 */
function tr(html, sel, url) {
  const { dom, doc } = boot(html, url);
  const el = doc.querySelector(sel);
  const out = el ? el.textContent : null;
  dom.window.close();
  return out;
}

const GDV =
  "Opens the Genome Data Viewer, NCBI's genome browser, at the genomic location at which this sequence is annotated. View this sequence in the context of other features annotated at the same location and browse to other genome regions.";
const HIGHLIGHT =
  "Opens the Highlight Feature Bar and highlights feature annotations from the FEATURES table of the record. The Highlight Feature Bar can be used to navigate to and highlight other features and provides links to display the highlighted region separately. Links in the FEATURES table will also highlight the corresponding region of the sequence.";
const BIG_RECORD =
  'Due to the large size of this record, sequence and annotated features are not shown. Use the "Customize view" panel to change the display.';

test("区块标题：显示区域 / 自定义视图 / 分析序列 / 参考序列信息", () => {
  const html =
    "<h3>Change region shown</h3><h3>Customize view</h3>" +
    "<h3>Analyze this sequence</h3><h3>Reference sequence information</h3>" +
    "<h3>Genomic context</h3><h3>Bibliography</h3><h3>Sequence information</h3>";
  const { dom, doc } = boot(html);
  const hs = [...doc.querySelectorAll("h3")].map((h) => h.textContent);
  assert.deepEqual(hs, [
    "更改显示区域",
    "自定义视图",
    "分析此序列",
    "参考序列信息",
    "基因组上下文",
    "参考文献",
    "序列信息"
  ]);
  dom.window.close();
});

test("按钮与标签：更新视图 / 运行 BLAST / 下载特征", () => {
  const html =
    '<button id="updateselregion">Update View</button>' +
    '<a class="brieflinkpopperctrl">Run BLAST</a>' +
    '<p class="hint">Download features.</p>' +
    '<label>Show reverse complement</label>';
  const { dom, doc } = boot(html);
  assert.equal(doc.querySelector("button").textContent, "更新视图");
  assert.equal(doc.querySelector("a").textContent, "运行 BLAST");
  assert.equal(doc.querySelector("p.hint").textContent, "下载特征。");
  assert.equal(doc.querySelector("label").textContent, "显示反向互补序列");
  dom.window.close();
});

test("规则：NCBI Reference Sequence 只换标签，accession 原样保留", () => {
  const t = tr("<p class='itemid'>NCBI Reference Sequence: NM_000546.6</p>", "p");
  assert.equal(t, "NCBI 参考序列：NM_000546.6");
});

test("规则：More about the TP53 gene", () => {
  const t = tr("<h3 id='x'>More about the TP53 gene</h3>", "#x");
  assert.equal(t, "关于 TP53 基因的更多信息");
});

test("规则：Also Known As 与 Gene ID", () => {
  const { dom, doc } = boot(
    "<div class='long_info'>Also Known As: BCC7, BMFS5, LFS1, P53,...</div><div>Gene ID:7157</div>"
  );
  assert.equal(doc.querySelector(".long_info").textContent, "又称：BCC7, BMFS5, LFS1, P53,...");
  assert.equal(doc.querySelectorAll("div")[1].textContent, "基因 ID：7157");
  dom.window.close();
});

test("规则：参考序列剪接变体句", () => {
  const t = tr(
    "<div class='long_info'>See 25 reference mRNA sequence splice variants for the TP53 gene.</div>",
    ".long_info"
  );
  assert.equal(t, "查看 TP53 基因的 25 个参考 mRNA 剪接变体。");
});

test("规则：See the genomic reference sequence（基因名与版本号保留）", () => {
  const t = tr(
    "<div class='long_info'>See the genomic reference sequence for the TP53 gene (NG_017013.2).</div>",
    ".long_info"
  );
  assert.equal(t, "查看 TP53 基因的基因组参考序列（NG_017013.2）。");
});

test("规则：See all N structures（requireHit 命中已知单位词）", () => {
  const t = tr("<a class='seemore'>See all 251 structures...</a>", "a");
  assert.equal(t, "查看全部 251 个结构...");
});

test("requireHit：单位词不在词表里就整条放弃，不硬拼", () => {
  const src = "See all 251 widgets...";
  const t = tr("<a class='seemore'>" + src + "</a>", "a");
  assert.equal(t, src, "未知单位词时应保持英文");
});

test("基因句规则对任意基因名/版本号都生效（捕获组是标识符，不带 requireHit）", () => {
  const t = tr(
    "<div class='long_info'>See the genomic reference sequence for the BRCA1 gene (NG_005905.2).</div>",
    ".long_info"
  );
  assert.equal(t, "查看 BRCA1 基因的基因组参考序列（NG_005905.2）。");
});

test("下拉属性：Method / Resolution / Source / PDB 只换标签", () => {
  const { dom, doc } = boot(
    "<div class='desc'><div>PDB: 9R2Q</div><div>Source: Homo sapiens, synthetic construct</div>" +
      "<div>Method: Electron Microscopy</div><div>Resolution: 3.2 Å</div></div>"
  );
  const divs = [...doc.querySelectorAll(".desc div")].map((x) => x.textContent);
  assert.deepEqual(divs, [
    "PDB：9R2Q",
    "来源：Homo sapiens, synthetic construct",
    "方法：Electron Microscopy",
    "分辨率：3.2 Å"
  ]);
  dom.window.close();
});

test("固定说明句整句变中文（不受正文保护影响）", () => {
  assert.match(tr("<div class='brieflinkpop'>" + GDV + "</div>", ".brieflinkpop"), /在 NCBI 基因组浏览器 Genome Data Viewer 中打开/);
  assert.doesNotMatch(tr("<div class='brieflinkpop'>" + GDV + "</div>", ".brieflinkpop"), /NCBI's genome browser/);
  assert.match(tr("<div class='brieflinkpop'>" + BIG_RECORD + "</div>", ".brieflinkpop"), /由于该记录体积过大/);
});

test("长提示句（>120 字符）也能整句换掉", () => {
  const t = tr("<div class='brieflinkpop'>" + HIGHLIGHT + "</div>", ".brieflinkpop");
  assert.match(t, /打开高亮特征栏/);
  assert.doesNotMatch(t, /Highlight Feature Bar can be used/);
});

test("装配页属性与统计表头", () => {
  const html =
    "<dl><dt>NCBI RefSeq assembly</dt><dd>GCF_000001405.40</dd>" +
    "<dt>Submitted GenBank assembly</dt><dd>GCA_000001405.29</dd>" +
    "<dt>Taxon</dt><dd>Homo sapiens</dd><dt>Assembly type</dt><dd>haploid with alt loci</dd></dl>" +
    "<h2>Assembly statistics</h2><table><tr><td>Genome size</td><td>3.1 Gb</td>" +
    "<td>Number of scaffolds</td><td>Scaffold N50</td><td>GC percent</td></tr></table>";
  const { dom, doc } = boot(html);
  const dts = [...doc.querySelectorAll("dt")].map((x) => x.textContent);
  assert.deepEqual(dts, ["NCBI RefSeq 组装", "提交的 GenBank 组装", "分类单元", "组装类型"]);
  assert.equal(doc.querySelector("dd").textContent, "GCF_000001405.40", "accession 不翻");
  assert.deepEqual([...doc.querySelectorAll("dd")].slice(1, 3).map((x) => x.textContent), [
    "GCA_000001405.29",
    "Homo sapiens"
  ]);
  assert.equal(doc.querySelector("h2").textContent, "组装统计");
  const tds = [...doc.querySelectorAll("td")].map((x) => x.textContent);
  assert.deepEqual(tds, ["基因组大小", "3.1 Gb", "支架数量", "支架 N50", "GC 含量"], "指标名照翻，读数据不动");
  dom.window.close();
});

test("装配页统计：BUSCO 标签与未定位 scaffold 句", () => {
  const { dom, doc } = boot(
    "<div><span>Single_copy 97.9%</span><span>Duplicated 0.9%</span>" +
      "<span>Fragmented 0.5%</span><span>Missing 0.7%</span></div>" +
      "<p class='note'>This genome assembly includes 127 unplaced scaffolds</p>"
  );
  assert.deepEqual([...doc.querySelectorAll("span")].map((x) => x.textContent), [
    "单拷贝 97.9%",
    "重复 0.9%",
    "片段化 0.5%",
    "缺失 0.7%"
  ]);
  assert.equal(doc.querySelector("p.note").textContent, "该基因组组装包含 127 个未定位 scaffold");
  dom.window.close();
});

test("词表自检：条数、汉字、无自映射、无邮箱/网址", () => {
  const keys = Object.keys(dict.exact);
  assert.ok(keys.length >= 120, "exact 条数应 ≥ 120，实际 " + keys.length);
  const cjk = /[\u4e00-\u9fff]/;
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.ok(k.trim().length > 0, "英文键不应为空");
    assert.doesNotMatch(k, cjk, "键不应含中文: " + k);
    assert.notEqual(k, v, "不应自映射: " + k.slice(0, 60));
    assert.match(v, cjk, "译文应含汉字: " + k.slice(0, 60));
    assert.doesNotMatch(v, /[\w.+-]+@[\w-]+\.[\w.]+/, "译文不应含邮箱: " + k.slice(0, 60));
    assert.ok(!/https?:\/\//.test(v), "译文不应含网址: " + k.slice(0, 60));
    assert.ok(!/\\.gov\b/.test(v), "译文不应含 .gov 链接: " + k.slice(0, 60));
  }
  assert.ok(Array.isArray(dict.rules) && dict.rules.length > 0, "句式应写进 rules");
  assert.ok(Array.isArray(dict.templates), "templates 必须是数组");
  const selfRule = dict.rules.filter((r) => r.requireHit);
  assert.ok(selfRule.length >= 1, "带单位词的句式应带 requireHit，实际 " + selfRule.length);
  for (const r of dict.rules) {
    assert.match(r.re, /^\^/, "规则应 ^ 锚定: " + r.re);
    assert.match(r.re, /\$$/, "规则应 $ 锚定: " + r.re);
    assert.doesNotThrow(() => new RegExp(r.re), "规则应可编译: " + r.re);
  }
});

test("无关英文段落不受影响", () => {
  const src = "This paragraph is not part of the NCBI sequence dictionary.";
  assert.equal(tr("<p>" + src + "</p>", "p"), src);
});
