// UCSC 帮助页长尾（dict/ucsc-extra.json）深翻测试：BED/PSL/GFF/GTF/twoBit 字段说明、
// hgTracksHelp 的 FTP/URL 说明、FAQblat 的 BLAT 介绍与 In-Silico PCR。
// 口径：字段名（chromStart/blockSizes/repMatch…）、格式名（BED/bigWig/PSL/GFF/CRAM）、
// 程序名与命令行参数一律保留原文，说明文字整句翻，不许半中半英。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/ucsc-extra.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "ucsc");

const CJK = /[\u4e00-\u9fff]/;
const CJK_ANY = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const URL_RE = /https?:\/\//i;
const MAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/;

function run(html) {
  const dom = new JSDOM(html, { url: "https://genome.ucsc.edu/FAQ/FAQformat.html" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: dict.exact, rules: dict.rules || [], templates: dict.templates || [] },
    site
  });
  engine.start();
  const doc = dom.window.document;
  const text = doc.body.textContent.replace(/\s+/g, " ").trim();
  return { doc, text };
}

test("词库结构：family/站点正确，三通道数量不低于本轮基线", () => {
  assert.equal(dict.meta.family, "ucsc");
  assert.ok(dict.meta.sites.includes("genome.ucsc.edu"));
  const nExact = Object.keys(dict.exact).length;
  const nRules = (dict.rules || []).length;
  const nTpl = (dict.templates || []).length;
  assert.ok(nExact >= 447, "exact 只有 " + nExact + " 条，本轮基线 447");
  assert.ok(nRules >= 24, "rules 只有 " + nRules + " 条，本轮基线 24");
  assert.ok(nTpl >= 248, "templates 只有 " + nTpl + " 条，本轮基线 248");
});

test("条目卫生：key 无中文与首尾空白，译文含汉字且不含明文 URL/邮箱/占位符", () => {
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.doesNotMatch(k, CJK, "key 含中文: " + k);
    assert.equal(k, k.trim(), "key 首尾有空白: " + JSON.stringify(k));
    assert.match(v, CJK, "译文不含汉字: " + k);
    assert.equal(v, v.trim(), "值首尾有空白: " + k);
    assert.doesNotMatch(v, URL_RE, "值含明文 URL: " + k);
    assert.doesNotMatch(v, MAIL_RE, "值含明文邮箱: " + k);
    assert.doesNotMatch(v, /\{\{\d+\}\}/, "exact 值含模板占位符: " + k);
  }
  for (const r of dict.rules || []) {
    assert.match(r.re, /^\^.*\$$/, "rule 未锚定: " + r.re);
    assert.match(r.to, CJK, "规则译文不含汉字: " + r.re);
    const groups = (r.re.match(/\((?!\?)/g) || []).length;
    if (groups > 0) assert.match(r.to, /\$\d/, "rule 有捕获组但译文没有 $n: " + r.re);
  }
});

test("模板结构：pat 无 CJK、长度 20-2200、槽位连续、zh 含汉字且不重复", () => {
  const seen = new Set();
  for (const t of dict.templates || []) {
    assert.ok(t && typeof t.pat === "string" && typeof t.zh === "string", "模板字段缺失: " + JSON.stringify(t));
    assert.doesNotMatch(t.pat, CJK_ANY, "pat 含汉字: " + t.pat);
    assert.ok(t.pat.length >= 20, "pat 短于 20 字符（引擎会整条拒收）: " + t.pat);
    assert.ok(t.pat.length <= 2200, "pat 超过 2200 字符: " + t.pat.slice(0, 60) + "…");
    assert.equal(t.pat, t.pat.trim(), "pat 首尾有空白: " + JSON.stringify(t.pat));
    assert.ok(!seen.has(t.pat), "pat 重复: " + t.pat);
    seen.add(t.pat);
    assert.match(t.zh, CJK, "zh 不含汉字: " + t.pat.slice(0, 60));
    const slotsInPat = new Set((t.pat.match(/\{\{(\d+)\}\}/g) || []).map((m) => Number(m.slice(2, -2))));
    const maxSlot = slotsInPat.size ? Math.max(...slotsInPat) : 0;
    for (let i = 1; i <= maxSlot; i += 1) {
      assert.ok(slotsInPat.has(i), "pat 槽位不连续，缺 {{" + i + "}}: " + t.pat.slice(0, 80));
    }
    const slotsInZh = (t.zh.match(/\{\{(\d+)\}\}/g) || []).map((m) => Number(m.slice(2, -2)));
    for (const s of slotsInZh) assert.ok(s <= maxSlot, "zh 引用了 pat 里不存在的槽位 {{" + s + "}}: " + t.pat.slice(0, 60));
  }
});

test("BED 字段说明整段翻：chromStart/chromEnd 保留字段名，说明文字全中文", () => {
  const { text } = run(
    '<ul><li><strong>chromStart</strong> - The starting position of the feature in the chromosome or scaffold. The first base in a chromosome is numbered 0.</li>' +
    '<li><strong>chromEnd</strong> - The ending position of the feature in the chromosome or scaffold.</li></ul>'
  );
  assert.match(text, /chromStart/, "字段名 chromStart 应保留原文");
  assert.match(text, /起始位置/, "chromStart 说明未翻: " + text);
  assert.match(text, /结束位置/, "chromEnd 说明未翻: " + text);
  assert.doesNotMatch(text, /The starting position of the feature/, "仍残留英文原句");
});

test("模板槽位保留内联字段名：src/srcSize 说明翻成中文，字段名走槽位不被吞掉", () => {
  const { text } = run(
    '<ul>' +
    '<li><strong>src</strong> -- The name of one of the source sequences for the alignment. For sequences that are resident in a browser assembly, the form \'database.chromosome\' allows automatic creation of links to other assemblies. Non-browser sequences are typically referenced by the species name alone.</li>' +
    '<li><strong>srcSize</strong> -- The size of the entire source sequence, not just the parts involved in the alignment.</li>' +
    '</ul>'
  );
  assert.match(text, /src -- 比对的源序列之一的名称/, "src 模板未生效: " + text);
  assert.match(text, /srcSize -- 整个源序列的长度/, "srcSize 模板未生效: " + text);
  assert.doesNotMatch(text, /The name of one of the source sequences/, "仍残留英文原句");
});

test("PSL 字段行整句翻：blockCount/blockSizes 字段名保留，句意中文", () => {
  const { text } = run(
    '<ul><li><strong>blockCount</strong> - Number of blocks in the alignment (a block contains no gaps)</li>' +
    '<li><strong>blockSizes</strong> - Comma-separated list of sizes of each block. If the query is a protein and the target the genome, blockSizes are in amino acids. See below for more information on protein query PSLs.</li></ul>'
  );
  assert.match(text, /blockCount/, "blockCount 字段名应保留");
  assert.match(text, /比对中的区块数/, "blockCount 说明未翻: " + text);
  assert.match(text, /blockSizes/, "blockSizes 字段名应保留");
  assert.doesNotMatch(text, /Comma-separated list of sizes of each block/, "仍残留英文原句");
});

test("twoBit 字段表翻完，数值/位表示原样保留", () => {
  const { text } = run(
    '<ul><li><strong>signature</strong> - the number 0x1A412743 in the architecture of the machine that created the file</li>' +
    '<li><strong>offset</strong> - the 32-bit offset of the sequence data relative to the start of the file, not aligned to any 4-byte padding boundary</li></ul>'
  );
  assert.match(text, /0x1A412743/, "十六进制数值必须原样保留");
  assert.match(text, /创建该文件的机器架构/, "signature 说明未翻: " + text);
  assert.match(text, /32 位偏移量/, "offset 说明未翻: " + text);
  assert.doesNotMatch(text, /the architecture of the machine/, "仍残留英文原句");
});

test("格式名与程序名不翻：BED/bigWig/CRAM/BAM/PSL/GFF 保持原文", () => {
  const { text } = run(
    '<p>The datasets for the built-in microarray tracks are stored in BED15 format. Use bigWig or bigBed for large data, CRAM or BAM for alignments, and PSL or GFF for text.</p>'
  );
  for (const name of ["BED15", "bigWig", "bigBed", "CRAM", "BAM", "PSL", "GFF"]) {
    assert.ok(text.includes(name), "格式名 " + name + " 被改动或吞掉: " + text);
  }
});

test("BLAT 帮助页标题与说明成句翻：Using the -ooc flag 之类短标题拆 exact 后能拼成中文", () => {
  const { text } = run(
    '<p><em>Using the</em> <tt>-ooc</tt> <em>flag</em></p>' +
    '<p>Try using <em>-fine</em>.</p>'
  );
  assert.match(text, /使用/, "Using the 未翻: " + text);
  assert.match(text, /-ooc/, "命令行参数 -ooc 必须保留");
  assert.match(text, /选项/, "flag 未翻: " + text);
  assert.doesNotMatch(text, /Try using/, "Try using 未翻: " + text);
  assert.match(text, /-fine/, "命令行参数 -fine 必须保留");
});

test("单词 no 不做全局替换：独立 no（是/否答案）保留原文，规则不越界改 normal/nothing", () => {
  assert.equal(run("<p>no</p>").text, "no", "独立 no 被误翻");
  assert.equal(run("<p>normal nothing note</p>").text, "normal nothing note", "规则越界改了别的单词");
  assert.match(run("<p>Set this to no if unused.</p>").text, /no/, "成句里的 no 不应被拆成中文单词");
});

test("不产出半中半英：抽查整句译文里不残留成段英文子句", () => {
  const { text } = run(
    '<ul><li><strong>leftStatus</strong> -- A character that specifies the relationship between the sequence in this block and the sequence that appears in the previous block.</li>' +
    '<li><strong>rightCount</strong> -- Usually the number of bases in the aligning species between the end of this alignment and the start of the next one.</li></ul>'
  );
  assert.doesNotMatch(text, /A character that specifies the relationship/, "leftStatus 仍留英文");
  assert.doesNotMatch(text, /Usually the number of bases in the aligning species/, "rightCount 仍留英文");
  assert.match(text, /leftStatus/, "leftStatus 字段名应保留");
  assert.match(text, /rightCount/, "rightCount 字段名应保留");
});

test("页面级冒烟：混排真实片段后，成句说明全中文且字段名仍在", () => {
  const html = [
    '<h2>BED format</h2>',
    '<ul>',
    '<li><strong>blockCount</strong> - The number of blocks (exons) in the BED line.</li>',
    '<li><strong>strand</strong> - Defines the strand. Either "." (=no strand) or "+" or "-".</li>',
    '<li><strong>chromStart</strong> - The starting position of the feature in the chromosome or scaffold. The first base in a chromosome is numbered 0.</li>',
    '</ul>'
  ].join("");
  const { text } = run(html);
  assert.match(text, /区块（外显子）数量/, "blockCount 说明未翻: " + text);
  assert.match(text, /定义链/, "strand 说明未翻: " + text);
  assert.match(text, /起始位置/, "chromStart 说明未翻: " + text);
  assert.match(text, /编号为 0/, "chromStart 里第一个碱基编号规则未翻: " + text);
  assert.equal(/The number of blocks|Defines the strand|The starting position/.test(text), false, "仍有整句英文: " + text);
});
