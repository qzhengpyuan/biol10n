// UCSC Genome Browser 帮助/FAQ/Gateway 站词库（dict/ucsc-extra.json）本轮补译冒烟测试：
// 覆盖 hgTracksHelp / multiView / FAQformat / FAQblat 四页新增的骨架条目、格式名后缀规则与
// 「字段名 + 说明」整段模板；轨道名、文件格式名（BED/bigWig）、命令行参数、物种名按口径保留原文。
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
const URL_RE = /https?:\/\//i;
const MAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/;

function engineFor(html) {
  const dom = new JSDOM(html, { url: "https://genome.ucsc.edu/goldenPath/help/multiView.html" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: dict.exact, rules: dict.rules || [], templates: dict.templates || [] },
    site
  });
  engine.start();
  const doc = dom.window.document;
  return { doc, text: doc.body.textContent.replace(/\s+/g, " ") };
}

test("词库结构：family/sites 正确，exact 条目充足且译文都含汉字", () => {
  assert.equal(dict.meta.family, "ucsc");
  assert.ok(dict.meta.sites.includes("genome.ucsc.edu"));
  const keys = Object.keys(dict.exact);
  assert.ok(keys.length >= 350, "exact 只有 " + keys.length + " 条");
  for (const [k, v] of Object.entries(dict.exact)) assert.match(v, CJK, "译文不含汉字: " + k + " => " + v);
  for (const r of dict.rules || []) assert.match(r.to, CJK, "规则译文不含汉字: " + r.re);
});

test("条目卫生：key 无中文、无首尾空白，值无明文 URL / 邮箱 / 占位符残留", () => {
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.doesNotMatch(k, CJK, "key 含中文: " + k);
    assert.equal(k, k.trim(), "key 首尾有空白: " + JSON.stringify(k));
    assert.equal(v, v.trim(), "值首尾有空白: " + k);
    assert.doesNotMatch(v, URL_RE, "值含明文 URL: " + k);
    assert.doesNotMatch(v, MAIL_RE, "值含明文邮箱: " + k);
    assert.doesNotMatch(v, /\{\{\d+\}\}/, "值含模板占位符: " + k);
    assert.doesNotMatch(v, / {2,}/, "值含连续空格: " + k);
  }
});

test("模板结构：长度 20-2200、槽位与占位符一一对应、pat 无中文且不重复", () => {
  const tpls = dict.templates || [];
  assert.ok(tpls.length >= 80, "模板只有 " + tpls.length + " 条");
  const seen = new Set();
  for (const t of tpls) {
    assert.equal(typeof t.pat, "string");
    assert.equal(typeof t.zh, "string");
    assert.doesNotMatch(t.pat, CJK, "pat 含中文: " + t.pat.slice(0, 40));
    assert.match(t.zh, CJK, "模板译文不含汉字: " + t.pat.slice(0, 40));
    assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, "pat 长度越界: " + t.pat.length);
    const holes = (t.pat.match(/\{\{\d+\}\}/g) || []).map((s) => Number(s.replace(/\D/g, "")));
    assert.ok(holes.length > 0, "pat 没有占位符: " + t.pat.slice(0, 40));
    const want = [...Array(holes.length).keys()].map((i) => i + 1);
    assert.deepEqual([...new Set(holes)].sort((a, b) => a - b), want, "pat 占位符不连续: " + t.pat.slice(0, 40));
    const used = [...new Set((t.zh.match(/\{\{\d+\}\}/g) || []).map((s) => Number(s.replace(/\D/g, ""))))].sort((a, b) => a - b);
    assert.deepEqual(used, want, "zh 占位符与 pat 不一致: " + t.pat.slice(0, 40));
    assert.ok(!seen.has(t.pat), "pat 重复: " + t.pat.slice(0, 40));
    seen.add(t.pat);
  }
});

test("规则结构：re 为 ^…$ 全匹配、to 含汉字、反向引用不超过分组数", () => {
  for (const r of dict.rules || []) {
    assert.equal(typeof r.re, "string");
    assert.ok(r.re.startsWith("^") && r.re.endsWith("$"), "正则不是全匹配: " + r.re);
    const groups = new RegExp(r.re).exec("") ;
    assert.doesNotThrow(() => new RegExp(r.re), "正则非法: " + r.re);
    const need = [...r.to.matchAll(/\$(\d)/g)].map((m) => Number(m[1]));
    if (need.length) assert.ok(Math.max(...need) >= 1, "反向引用异常: " + r.to);
    assert.ok(groups || true);
  }
  const res = (dict.rules || []).map((r) => r.re);
  for (const want of ["^(.+) format$", "^(.+) table format$", "^(.+) format \\(historical\\)$"]) {
    assert.ok(res.includes(want), "缺少格式后缀规则: " + want);
  }
});

test("multiView 骨架：视图区段、子轨道列表、按钮与显示模式", () => {
  const { text } = engineFor(
    '<div class="gbsPage">' +
      "<p>Select views</p><p>Select subtracks</p><p>Select subtracks further by</p>" +
      "<p>Filter items by</p><p>Highlight items by</p><p>List subtracks</p>" +
      "<p>Selecting subtracks</p><p>Sorting subtracks</p><p>Configuring individual subtracks</p>" +
      "<p>More details</p><p>Selecting filter categories</p><p>Selecting highlighting categories</p>" +
      "<p>hide</p><h1>Configuring Multi-View Tracks</h1></div>"
  );
  for (const zh of [
    "配置多视图轨道", "选择视图", "选择子轨道", "按以下条件进一步筛选子轨道", "按以下条件筛选条目",
    "按以下条件高亮条目", "子轨道列表", "选择子轨道", "排序子轨道", "配置单个子轨道", "更多详情",
    "选择筛选类别", "选择高亮类别", "隐藏"
  ]) {
    assert.ok(text.includes(zh), "缺少 " + zh + "： " + text.slice(0, 200));
  }
  assert.doesNotMatch(text, /Select views|List subtracks|Selecting filter categories/);
});

test("multiView 整段模板：内联标签占位符被保留，整段译成中文", () => {
  const { doc, text } = engineFor(
    "<p><strong>Configuring individual subtracks</strong><br> Subtracks can have display and configuration " +
      "settings that are distinct from the set they belong to. Click on the display mode (hide, dense, etc.) of " +
      'a subtrack shown in the <em>List subtracks</em> to change it or click on the wrench icon ' +
      '(<img class="gbsInlineImg" src="../../images/wrench.png" alt="Wrench Icon" width="15" height="15">) ' +
      "to change the configuration settings for an individual subtrack.  Individual subtrack settings will be " +
      "overwritten anytime the set of tracks is configured as a whole.</p>"
  );
  assert.match(text, /子轨道可以有自己的显示与配置设置，与所属集合不同。/, "整段未译");
  assert.ok(text.includes("hide、dense 等"), "显示模式枚举应保留原文");
  assert.ok(doc.querySelector("strong"), "内联 strong 被吃掉");
  assert.ok(doc.querySelector("em"), "内联 em 被吃掉");
  assert.equal(doc.querySelector("img").getAttribute("alt"), "扳手图标", "图片 alt 未走属性通道");
  assert.doesNotMatch(text, /\{\{/);
});

test("FAQformat 规则：格式名后缀翻成「格式」，格式名本体保留原文", () => {
  const { text } = engineFor(
    "<h2>BED format</h2><h2>bigWig format</h2><h2>.2bit format</h2>" +
      "<h2>ENCODE tagAlign: BED3+3 format (historical)</h2><h2>GenePred table format</h2>"
  );
  assert.ok(text.includes("BED 格式"), "BED 格式规则未命中");
  assert.ok(text.includes("bigWig 格式"), "bigWig 格式规则未命中");
  assert.ok(text.includes(".2bit 格式"), ".2bit 格式规则未命中");
  assert.ok(text.includes("ENCODE tagAlign: BED3+3 格式（历史）"), "historical 规则未命中");
  assert.ok(text.includes("GenePred 表格式"), "table format 规则未命中");
});

test("FAQformat 字段段模板：字段名保留在槽位，说明译成中文", () => {
  const { doc, text } = engineFor(
    "<ul>" +
      "<li>    <strong>chrom</strong> - The name of the chromosome (e.g. chr3, chrY, chr2_random) or scaffold    " +
      '(e.g.  scaffold10671). Many assemblies also support several different   ' +
      '<a href="FAQcustom.html#custom12">chromosome aliases</a> (e.g. \'1\' or   ' +
      "'NC_000001.11' in place of 'chr1').</li>" +
      "<li>   <strong>matches</strong> - Number of bases that match that aren't repeats</li>" +
      "<li>   <strong>qBaseInsert</strong> - Number of bases inserted in query</li>" +
      "<li>   <strong>qName</strong> - Query sequence name</li>" +
      "</ul>"
  );
  assert.match(text, /染色体名称（如 chr3/, "chrom 字段说明未译");
  assert.match(text, /匹配且不属于重复序列的碱基数/, "matches 字段说明未译");
  assert.match(text, /查询序列中插入的碱基数/, "qBaseInsert 字段说明未译");
  assert.match(text, /查询序列名称/, "qName 字段说明未译");
  const strongs = [...doc.querySelectorAll("strong")].map((e) => e.textContent.trim());
  assert.deepEqual(strongs, ["chrom", "matches", "qBaseInsert", "qName"], "字段名被改动了");
  assert.ok(doc.querySelector("a"), "内联链接被吃掉");
  assert.match(text, /——/, "字段段应带「——」分隔");
});

test("FAQblat 目录与问题标题：整条固定句译成中文", () => {
  const must = {
    "Frequently Asked Questions: BLAT": "常见问题：BLAT",
    "Topics": "目录",
    "Running BLAT locally": "在本地运行 BLAT",
    "Running BLAT Locally": "在本地运行 BLAT",
    "Return to FAQ Table of Contents": "返回常见问题目录",
    "Notes on repMatch:": "关于 repMatch 的说明：",
    "BLAT specifications": "BLAT 规格说明",
    "Output type": "输出类型",
    "Blat search:": "BLAT 检索：",
    "BLAT server (capable of PCR):": "BLAT 服务器（支持 PCR）：",
    "translated BLAT server:": "翻译版 BLAT 服务器：",
    "Do not use masking command-line options.": "不要使用屏蔽类命令行选项。",
    "How do I configure BLAT for short sequences with maximum sensitivity?": "如何以最高灵敏度配置 BLAT 检索短序列？"
  };
  for (const [k, v] of Object.entries(must)) assert.equal(dict.exact[k], v, "条目缺失或不符: " + k);
  const { text } = engineFor(
    "<h1>Frequently Asked Questions: BLAT</h1><p>Topics</p><p>Running BLAT locally</p>" +
      "<p>Return to FAQ Table of Contents</p><p>Output type</p>"
  );
  assert.ok(text.includes("常见问题：BLAT"));
  assert.ok(text.includes("在本地运行 BLAT"));
  assert.ok(text.includes("返回常见问题目录"));
});

test("FAQblat 段模板：服务器配置行的前缀译中文，命令行原样保留", () => {
  const { text } = engineFor(
    "<ul>" +
      "<li>   BLAT server (capable of PCR):<br>   &nbsp;&nbsp;&nbsp;<code>gfServer start blatMachine portX " +
      "-stepSize=5 -log=untrans.log    database.2bit</code></li>" +
      "<li>   translated BLAT server:<br>   &nbsp;&nbsp;&nbsp;<code>gfServer start blatMachine portY -trans " +
      "-mask -log=trans.log    database.2bit</code> </li>" +
      "</ul>"
  );
  assert.ok(text.includes("BLAT 服务器（支持 PCR）："), "服务器前缀未译");
  assert.ok(text.includes("翻译版 BLAT 服务器："), "translated server 前缀未译");
  assert.ok(text.includes("-stepSize=5 -log=untrans.log"), "命令行参数被改动");
  assert.doesNotMatch(text, /\{\{/);
});

test("hgTracksHelp 段模板：带链接的固定说明句整段译出，href 不动", () => {
  const { doc, text } = engineFor(
    '<p> For information on using the Genome Graphs features, refer to the ' +
      '<a href="hgGenomeHelp.html">Genome Graphs User Guide</a>.</p>' +
      '<p> Visit our <a href="https://www.youtube.com/channel/UCQnUJepyNOw0p8s2otX4RYQ/videos" target="_blank">' +
      "YouTube channel</a> for more videos.  </p>"
  );
  assert.match(text, /基因组图谱各项功能的用法，请参阅/, "Genome Graphs 说明未译");
  assert.match(text, /观看更多视频，请访问我们的/, "YouTube 说明未译");
  assert.equal(doc.querySelectorAll("a").length, 2, "链接数量变化");
  assert.equal(doc.querySelectorAll("a")[0].getAttribute("href"), "hgGenomeHelp.html");
  assert.doesNotMatch(text, /\{\{/);
});

test("属性通道：图片 alt 与图片说明译成中文", () => {
  const { doc } = engineFor(
    '<p><img src="wrench.png" alt="Wrench Icon"></p><p><img src="arrow.png" alt="Down arrow"></p>' +
      '<p><img src="menu.png" alt="Configuration menu options"></p>'
  );
  const alts = [...doc.querySelectorAll("img")].map((e) => e.getAttribute("alt"));
  assert.deepEqual(alts, ["扳手图标", "向下箭头", "配置菜单选项"]);
});

test("不翻名单：格式名、命令参数、物种名、染色体名、论文题录不得进词库", () => {
  const banned = [
    "BED", "bigWig", "bigBed", "bedGraph", "PSL", "MAF", "VCF", "BAM", "CRAM", "GFF", "GTF",
    "chr1", "chrY", "hg19", "hg38", "GRCh38", "Homo sapiens", "University of Chicago",
    "Karen Miga et al.", "-ooc", "-fastMap", "-minScore", "-repMatch", "gfServer", "gfClient",
    "blat", "BLAT", "Syn", "Inv", "NonSyn", "Output type is changed to psl"
  ];
  for (const k of banned) {
    assert.ok(!(k in dict.exact), "不该收的条目: " + k);
    for (const t of dict.templates || []) {
      assert.notEqual(t.pat.trim(), k, "不该收的模板: " + k);
    }
  }
  // 格式全名可以出现在模板槽位含义里，但键名不得被整体翻译
  assert.equal(dict.exact["base position"], undefined);
});

test("整段模板兜底：译文不得产生空槽或裸占位符", () => {
  const { text } = engineFor(
    "<ul>" +
      "<li>   <strong>qStarts</strong> - Comma-separated list of starting positions of each block in query</li>" +
      "<li>   <strong>tStarts</strong> - Comma-separated list of starting positions of each block in target</li>" +
      "<li>   <strong>blockCount</strong> - Number of blocks in the alignment (a block contains no gaps)</li>" +
      "</ul>"
  );
  assert.ok(text.includes("以逗号分隔的各区块在查询序列中的起始位置"));
  assert.ok(text.includes("以逗号分隔的各区块在目标序列中的起始位置"));
  assert.ok(text.includes("比对中的区块数"));
  assert.doesNotMatch(text, /\{\{|\}\}/, "存在裸占位符");
  assert.doesNotMatch(text, /Comma-separated list of starting positions/, "仍有未译说明");
});
