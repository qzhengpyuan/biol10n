// Ensembl 补译（r56）：FAQ/帮助导航、FTP 下载页固定说明、站点骨架与模板通道
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const extra = JSON.parse(fs.readFileSync(path.join(root, "../dict/ensembl-extra.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "ensembl");

/** 按站点词库列表合并（与生产一致），这样 {{1}} 里的专有链接也能走词表。 */
function loadSiteDicts() {
  const exact = {}, rules = [], templates = [];
  for (const id of site.dicts) {
    const p = path.join(root, "../dict", id + ".json");
    if (!fs.existsSync(p)) continue;
    const d = JSON.parse(fs.readFileSync(p, "utf8"));
    Object.assign(exact, d.exact || {});
    if (d.rules) rules.push(...d.rules);
    if (d.templates) templates.push(...d.templates);
  }
  return { exact, rules, templates };
}

function run(html, scans = 2) {
  const data = loadSiteDicts();
  const dom = new JSDOM(html, { url: "https://www.ensembl.org/" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  for (let i = 1; i < scans; i++) engine.scan();
  return { dom, doc: dom.window.document, engine };
}

function runExtra(html) {
  const dom = new JSDOM(html, { url: "https://www.ensembl.org/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: extra.exact, rules: extra.rules, templates: extra.templates },
    site
  });
  engine.start();
  return { dom, doc: dom.window.document, engine };
}

test("词库结构：rules 为对象、templates 为对象、译文含汉字且无自映射", () => {
  assert.ok(Array.isArray(extra.rules), "rules 必须是数组");
  for (const r of extra.rules) {
    assert.equal(typeof r, "object", "rules 条目必须是对象: " + JSON.stringify(r));
    assert.ok(!Array.isArray(r), "rules 不能写成 [\"^正则$\", \"替换\"] 数组");
    assert.equal(typeof r.re, "string");
    assert.equal(typeof r.to, "string");
    assert.match(r.to, /[\u4e00-\u9fff]/, "规则译文必须含汉字: " + r.re);
  }
  assert.ok(Array.isArray(extra.templates) && extra.templates.length >= 4, "模板太少");
  for (const t of extra.templates) {
    assert.equal(typeof t.pat, "string", "templates 条目必须是对象: " + JSON.stringify(t));
    assert.equal(typeof t.zh, "string");
    assert.match(t.zh, /[\u4e00-\u9fff]/, "模板译文必须含汉字: " + t.pat);
    const slots = (t.pat.match(/\{\{\d+\}\}/g) || []).map((s) => s.replace(/[{}]/g, ""));
    const zhSlots = (t.zh.match(/\{\{\d+\}\}/g) || []).map((s) => s.replace(/[{}]/g, ""));
    assert.deepEqual(zhSlots, slots, "占位符必须一一对应: " + t.pat);
  }
  const bad = [];
  for (const [en, zh] of Object.entries(extra.exact)) {
    if (/[\u3400-\u4dbf\u4e00-\u9fff]/.test(en)) bad.push("键含中文: " + en);
    if (en !== en.trim() || zh !== zh.trim()) bad.push("首尾空白: " + en);
    if (en === zh) bad.push("自映射: " + en);
    if (!/[\u4e00-\u9fff]/.test(zh)) bad.push("译文无汉字: " + en);
  }
  assert.deepEqual(bad, []);
});

test("新增条目不与本册其它词库重复（避免同站两册打架）", () => {
  const others = ["ensembl", "ensembl2", "ensembl-tpl", "common", "anatomy", "spa"]
    .map((id) => JSON.parse(fs.readFileSync(path.join(root, "../dict", id + ".json"), "utf8")).exact || {});
  const dup = Object.keys(extra.exact).filter((k) => others.some((o) => k in o));
  assert.deepEqual(dup, []);
});

test("FAQ 左栏与分组标题整条翻译", () => {
  const { doc, dom } = run(
    "<ul>" +
      '<li><a href="/faq">Frequently Asked Questions</a></li>' +
      '<li><a href="/topics">Help topics</a></li>' +
      '<li><a href="/export">Export, uploads and downloads</a></li>' +
      '<li><a href="/other">Other data</a></li>' +
    "</ul>"
  );
  assert.deepEqual([...doc.querySelectorAll("li a")].map((e) => e.textContent), [
    "常见问题", "帮助主题", "导出、上传与下载", "其他数据"
  ]);
  dom.window.close();
});

test("FAQ 问题条目：整句翻成中文，专有名词保留", () => {
  const { engine, dom } = run("<div></div>");
  assert.equal(engine.translateText("What is a genome assembly?"), "什么是基因组组装？");
  assert.equal(engine.translateText("How do I cite Ensembl?"), "如何引用 Ensembl？");
  assert.equal(engine.translateText("What is an LRG?"), "什么是 LRG？");
  assert.equal(engine.translateText("Can I view syntenic regions in Ensembl?"), "我可以在 Ensembl 中查看共线性区域吗？");
  assert.equal(engine.translateText("What is GENCODE?"), "什么是 GENCODE？");
  const rna = engine.translateText("How can I view RNASeq data in Ensembl?");
  assert.match(rna, /RNA-seq/, "RNASeq 按通用写法译作 RNA-seq");
  const reg = engine.translateText("How is Ensembl regulatory annotation generated?");
  assert.match(reg, /Ensembl 调控注释/);
  dom.window.close();
});

test("FAQ 页脚整段走模板，两个链接都在", () => {
  const { doc, dom } = run(
    '<p id="x">If you have any other questions about Ensembl, please do not hesitate to <a href="/helpdesk">contact our HelpDesk</a>. You may also like to subscribe to the <a href="/dev">developers\' mailing list</a>.</p>'
  );
  const p = doc.getElementById("x");
  assert.match(p.textContent, /^如果对 Ensembl 还有其他问题/, p.textContent);
  assert.match(p.textContent, /联系我们的帮助台/, p.textContent);
  assert.match(p.textContent, /开发者邮件列表/, p.textContent);
  assert.doesNotMatch(p.textContent, /questions|subscribe|mailing/, "整段必须是中文");
  assert.equal(p.querySelectorAll("a").length, 2, "链接不能丢");
  assert.equal(p.querySelectorAll("a")[0].getAttribute("href"), "/helpdesk");
  dom.window.close();
});

test("FAQ 问题条目成组收录（抽查 10 条，键值一一对应）", () => {
  const pairs = {
    "What human genome assembly and coordinate system is Ensembl using?": "Ensembl 使用哪个人类基因组组装与坐标系统？",
    "What haplotypes and assembly patches can I see for human?": "人类可以查看哪些单倍型与组装补丁？",
    "How does Ensembl determine homology relationships?": "Ensembl 如何判定同源关系？",
    "Can I install a local copy of the Ensembl database(s)?": "我可以安装一份本地 Ensembl 数据库吗？",
    "Which transcript should I use?": "我应该使用哪个转录本？",
    "What do the different biotypes in Ensembl mean?": "Ensembl 中不同的生物类型是什么意思？",
    "Does Ensembl report variation alleles on the forward strand or reverse strand?": "Ensembl 报告变异等位基因时使用正链还是反链？",
    "How do I view clone sets, such as BACs?": "如何查看克隆集，例如 BAC？",
    "What are the differences between BLAST and BLAT?": "BLAST 与 BLAT 有什么区别？",
    "I have an Ensembl ID, what can I tell about it from the ID?": "我有一个 Ensembl ID，从 ID 本身能看出什么？"
  };
  for (const [en, zh] of Object.entries(pairs)) {
    assert.equal(extra.exact[en], zh, "缺条目或译文不一致: " + en);
  }
});

test("FTP「所有数据库压缩存放」整段走模板，格式名保持英文", () => {
  const { doc, dom } = run(
    '<p id="z">To facilitate storage and download all databases are <a href="/gnuzip">GNU Zip</a> (gzip, *.gz) compressed.</p>'
  );
  const t = doc.getElementById("z").textContent;
  assert.match(t, /为便于存储与下载/);
  assert.match(t, /GNU Zip/, "格式名保留原文");
  assert.match(t, /（gzip、\*\.gz）形式压缩/);
  dom.window.close();
});

test("两级模板：「Looking for … See our …」两轮扫描后不再半中半英", () => {
  const html =
    '<p id="l"><strong>Looking for <a href="/dumps">MySQL dumps</a> to install databases locally?</strong> See our <a href="/install">web installation instructions</a> for full details.</p>';
  const { doc, dom } = run(html);
  const t = doc.getElementById("l").textContent;
  assert.match(t, /需要在本地安装数据库，正在寻找/, t);
  assert.match(t, /完整详情请参见我们的网页安装说明/, t);
  assert.doesNotMatch(t, /Looking for|See our|full details/, "不允许残留英文片段");
  assert.equal(doc.getElementById("l").querySelectorAll("a").length, 2);
  dom.window.close();
});

test("FTP 表头提示文本（title 属性）翻成中文", () => {
  const { doc, dom } = runExtra(
    '<a id="m" title="Masked and unmasked genome sequences associated with the assembly (contigs, chromosomes etc.)">x</a>' +
    '<a id="c" title="Coding sequences for Ensembl or &quot;ab initio&quot; predicted genes">y</a>'
  );
  const m = doc.getElementById("m").getAttribute("title");
  assert.match(m, /掩码与非掩码基因组序列/);
  assert.match(m, /染色体/);
  const c = doc.getElementById("c").getAttribute("title");
  assert.match(c, /编码序列/);
  assert.match(c, /ab initio/, "方法名保留原文");
  dom.window.close();
});

test("站点骨架短标签：Show / Favourite / More ▼ / 启用 JS 提示", () => {
  const { engine, dom } = run("<div></div>");
  assert.equal(engine.translateText("Show"), "显示");
  assert.equal(engine.translateText("Favourite"), "收藏");
  assert.equal(engine.translateText("More ▼"), "更多 ▼");
  assert.equal(
    engine.translateText("Please enable javascript to view the Ensembl app"),
    "请启用 JavaScript 以查看 Ensembl 应用"
  );
  assert.equal(engine.translateText("Ensembl name and logo policy"), "Ensembl 名称与徽标政策");
  dom.window.close();
});

test("数据与专名不翻：物种学名、格式名、品牌与 API 名保持英文", () => {
  const { engine, dom } = run("<div></div>");
  for (const keep of ["Homo sapiens", "Mus musculus", "FASTA", "BAM/BigWig", "BioMart", "EMBL-EBI", "Compara API", "Ensembl VEP"]) {
    assert.equal(engine.translateText(keep), null, "不应翻译: " + keep);
  }
  dom.window.close();
});

test("占位符对不上的段落保持英文（宁可不翻也不丢链接）", () => {
  const bad = { pat: "Each directory on {{1}} contains a {{2}} file, explaining the directory structure.", zh: "{{1}} 上的每个目录都包含 README 文件。" };
  const dom = new JSDOM(
    '<p id="d">Each directory on <a href="https://ftp.ensembl.org">https://ftp.ensembl.org</a> contains a <a href="/readme">README</a> file, explaining the directory structure.</p>'
    , { url: "https://www.ensembl.org/" }
  );
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: extra.exact, rules: [], templates: [bad] },
    site
  });
  engine.start();
  assert.match(dom.window.document.getElementById("d").textContent, /Each directory on/);
  assert.equal(engine.stats.tpl, 0);
  dom.window.close();
});