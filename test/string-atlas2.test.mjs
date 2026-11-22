// Expression Atlas (www.ebi.ac.uk/gxa) 骨架 + STRING 增量词库（dict/string-atlas2.json）回归
// 站点真实词库栈 = common + string-atlas + 本册（两站共用同一套 dicts）
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

const dict = read("string-atlas2.json");
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;
const SITE = { scope: "body", block: "pre, code", rescan: false };

function siteData() {
  const exact = {}, rules = [], templates = [];
  for (const f of ["common.json", "string-atlas.json", "string-atlas2.json"]) {
    const d = read(f);
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
    templates.push(...(d.templates || []));
  }
  return { exact, rules, templates };
}

function boot(html, url) {
  const dom = new JSDOM(html, { url: url || "https://www.ebi.ac.uk/gxa/home" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: siteData(),
    site: SITE
  });
  engine.start();
  return { dom, engine, doc: dom.window.document };
}

test("词库结构：两站、条数、字段规整", () => {
  assert.deepEqual(dict.meta.family, "string-atlas2");
  assert.equal(dict.meta.version, "0.1.0");
  assert.deepEqual([...dict.meta.sites].sort(), ["string-db.org", "www.ebi.ac.uk"]);
  const exact = Object.entries(dict.exact || {});
  assert.ok(exact.length >= 40, "exact 太少: " + exact.length);
  assert.ok((dict.rules || []).length >= 8, "规则太少: " + (dict.rules || []).length);
  assert.ok((dict.templates || []).length >= 3, "模板太少: " + (dict.templates || []).length);
  const bad = [];
  for (const [en, zh] of exact) {
    if (!en || en !== en.trim()) bad.push("键首尾空白: " + JSON.stringify(en));
    if (/\s\s/.test(en)) bad.push("键含连续空白（normalize 后失配）: " + JSON.stringify(en));
    if (CJK.test(en)) bad.push("键含中文: " + en);
    if (!zh || zh !== zh.trim()) bad.push("空译文: " + en);
    if (!CJK.test(zh)) bad.push("译文无中文: " + en);
    if (en === zh) bad.push("自映射: " + en);
    if (/https?:\/\/|www\.|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(zh)) bad.push("译文含 URL/邮箱: " + en);
    if (en.length > 240) bad.push("键过长: " + en.length + " " + en.slice(0, 40));
  }
  assert.deepEqual(bad, []);
});

test("规则：正则锚定、译文含汉字、$n 不越界", () => {
  const bad = [];
  for (const r of dict.rules || []) {
    if (!r.re || !r.to) { bad.push("缺字段: " + JSON.stringify(r)); continue; }
    let re;
    try { re = new RegExp(r.re); } catch (e) { bad.push("正则非法: " + r.re); continue; }
    if (!/^\^/.test(r.re)) bad.push("未以 ^ 锚定: " + r.re);
    if (!/\$$/.test(r.re)) bad.push("未以 $ 锚定: " + r.re);
    if (!CJK.test(r.to)) bad.push("译文无中文: " + r.re);
    const groupCount = (re.source.match(/\((?!\?)/g) || []).length;
    for (const m of r.to.matchAll(/\$(\d)/g)) {
      if (Number(m[1]) > groupCount) bad.push("占位符超出捕获组: " + r.re);
    }
  }
  assert.deepEqual(bad, []);
});

test("模板：pat 长度合规、槽位连续、译文槽位一致", () => {
  const bad = [];
  for (const t of dict.templates || []) {
    if (!t.pat || !t.zh) { bad.push("缺字段"); continue; }
    if (t.pat.length < 20 || t.pat.length > 2200) bad.push("pat 长度不合规: " + t.pat.length);
    if (CJK.test(t.pat)) bad.push("pat 含中文: " + t.pat.slice(0, 40));
    if (!CJK.test(t.zh)) bad.push("译文无中文: " + t.pat.slice(0, 40));
    const slots = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    const uniq = [...new Set(slots)].sort((a, b) => a - b);
    if (!slots.length) bad.push("无槽位: " + t.pat.slice(0, 40));
    if (uniq.join(",") !== slots.length ? uniq.join(",") !== slots.map((_, i) => i + 1).join(",") : false) {
      bad.push("占位符编号不连续: " + t.pat.slice(0, 40));
    }
    const zhSlots = [...new Set([...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
    if (zhSlots.join(",") !== uniq.join(",")) bad.push("译文槽位与 pat 不一致: " + t.pat.slice(0, 40));
  }
  assert.deepEqual(bad, []);
});

test("关键条目：GXA 骨架（导航/植物实验/结果页/下载页/关于页）", () => {
  const cases = {
    "Browse plant experiments": "浏览植物实验",
    "See more…": "展开更多…",
    "Hide…": "收起…",
    "EMBL-EBI: European Bioinformatics Institute": "EMBL-EBI：欧洲生物信息研究所",
    "Postdocs & PhDs": "博士后与博士生",
    "EMBL-EBI Intranet for staff": "EMBL-EBI 员工内网",
    "Terms of use": "使用条款",
    "Plots": "图表",
    "Most specific": "最特异",
    "Up- or downregulated": "上调或下调",
    "Upregulated only": "仅上调",
    "Downregulated only": "仅下调",
    "Comparisons": "比较组",
    "Log2-fold change": "log2 倍数变化",
    "Adjusted p-value": "校正 P 值",
    "Expression level in tpms": "表达水平（TPM）",
    "Read publication": "阅读文献",
    "Analysis Results": "分析结果",
    "Full Experiment Archive (FTP)": "完整实验归档（FTP）",
    "Expression values across all genes (tpms)": "全部基因的表达值（TPM）",
    "Expression values across all genes (fpkms)": "全部基因的表达值（FPKM）",
    "Summary of the expression results for this experiment ready to view in R": "可在 R 中查看的本实验表达结果摘要",
    "Heatmap of aggregated expression data": "聚合表达数据的热图",
    "Experiment Design (tsv)": "实验设计（TSV）",
    "Access intermediate analysis files and bulk outputs on our FTP site.": "在我们的 FTP 站点访问中间分析文件与批量输出。",
    "About Expression Atlas": "关于 Expression Atlas",
    "All data are manually curated": "全部数据均经人工整理"
  };
  const { engine } = boot("<body></body>", "https://www.ebi.ac.uk/gxa/home");
  for (const [en, zh] of Object.entries(cases)) {
    assert.equal(engine.translateText(en), zh, "未命中: " + en);
  }
});

test("关键条目：STRING 增量（Select 按钮 / Global Biodata Coalition / Physical）", () => {
  const { engine, doc } = boot(
    "<body><div><button class=\"minibutton organism_choice_box_select_button\">Select</button></div>" +
      "<div class=\"elixir_cdr_message\">STRING is a Core Data Resource as designated by " +
      '<a href="https://globalbiodata.org/">Global Biodata Coalition</a> and ' +
      '<a href="https://www.elixir-europe.org/">ELIXIR</a>.</div>' +
      "<div>Type:Physical</div></body>",
    "https://string-db.org/"
  );
  assert.equal(doc.querySelector("button").textContent, "选择");
  assert.equal(engine.translateText("Physical"), "物理");
  assert.equal(engine.translateText("Type:Physical"), "类型：物理");
  // 大小写变体由引擎的小写兜底统一命中（同一词条只写一条）
  assert.equal(engine.translateText("GLOBAL BIODATA COALITION"), "全球生物数据联盟");
  const cdr = doc.querySelector(".elixir_cdr_message");
  assert.equal(
    cdr.textContent,
    "STRING 是由全球生物数据联盟和ELIXIR认定的核心数据资源。"
  );
  assert.equal(cdr.querySelectorAll("a").length, 2, "认定句里的两个链接必须保留");
});

test("规则行为：实验头字段、比较组/基因型、类型、互作伙伴", () => {
  const { engine } = boot("<body></body>", "https://www.ebi.ac.uk/gxa/experiments/E-MTAB-4045/Results");
  const cases = [
    ["Organism: Glycine max", "生物：Glycine max"],
    ["Organism part: all", "生物体部位：全部"],
    ["Genotype: all", "基因型：全部"],
    ["Comparison name: all", "比较组名称：全部"],
    ["1 more partners – show all", "还有 1 个互作伙伴 — 显示全部"],
    ["RNA-Seq mRNA differential", "RNA-Seq mRNA 差异"],
    ["Proteomics baseline", "蛋白质组学 基线"]
  ];
  for (const [en, zh] of cases) assert.equal(engine.translateText(en), zh, "规则未命中: " + en);
  // 不能抢掉已有的计数规则
  assert.equal(engine.translateText("Showing 34 of 2,589 genes found:"), "共找到 2,589 个基因，显示其中 34 个：");
});

test("jsdom：植物实验页简介（6 槽位模板，链接与加粗都留在原位）", () => {
  const { doc } = boot(
    '<body><div class="small-11 columns"><p> Thanks to funding from the ' +
      '<a href="http://www.gramene.org/">Gramene</a> project, Expression Atlas contains <b>1026</b> ' +
      '<a href="/gxa/experiments?kingdom=plants">plant experiments</a>, studying e.g. ' +
      '<a href="/gxa/experiments?species=Arabidopsis+thaliana">Arabidopsis</a>, ' +
      '<a href="/gxa/experiments?species=Oryza+sativa">rice</a>, and ' +
      '<a href="/gxa/experiments?species=Zea+mays">maize</a>. </p>' +
      "<p> The <i>baseline</i> experiments, are either RNA-seq or proteomics, and display expression levels of gene products under 'normal' conditions (e.g. normal rice tissues). Each experiment is manually curated to a high standard, and RNA expression levels are calculated using the " +
      '<a href="https://github.com/nunofonseca/irap">iRAP</a> pipeline. </p></div></body>',
    "https://www.ebi.ac.uk/gxa/plant/experiments"
  );
  const ps = doc.querySelectorAll("p");
  const p0 = ps[0];
  assert.match(p0.textContent, /本项目由Gramene项目资助/);
  assert.match(p0.textContent, /研究物种如Arabidopsis、rice和maize/);
  assert.match(p0.textContent, /收录 1026 个植物实验/);
  assert.equal(p0.querySelectorAll("a").length, 5, "句子里的 5 个链接必须保留");
  assert.ok(p0.querySelector("b"), "<b>1026</b> 必须保留");
  const p1 = ps[1];
  assert.match(p1.textContent, /^基线实验或为 RNA-seq/);
  assert.match(p1.textContent, /使用 iRAP 流程计算。$/);
  assert.equal(p1.querySelector("a").textContent, "iRAP");
});

test("jsdom：下载页被 <img> 图标切碎的整段说明（整段替换，不半中半英）", () => {
  const { doc } = boot(
    '<body><div id="main-content-area"><h3>Differential expression results</h3><p> You can download filtered ' +
      'expression results as a TSV file clicking on the <img src="/gxa/x.png" alt="TSV" class="icon"/> button. ' +
      'Genes for which the log<sub>2</sub> fold change is 0 are not included. </p>' +
      "<p> For all differential experiments, click on the <img src=\"/gxa/y.png\" alt=\"analytics\" class=\"icon\"/> " +
      "button to download all the analytics in the experiment. </p></div></body>",
    "https://www.ebi.ac.uk/gxa/download"
  );
  const ps = doc.querySelectorAll("#main-content-area p");
  assert.equal(ps[0].textContent.trim(), "点击 TSV 图标即可将筛选后的表达结果下载为 TSV 文件；log2 倍数变化为 0 的基因不包含在内。");
  assert.equal(ps[1].textContent.trim(), "对于全部差异实验，点击 analytics 图标即可下载该实验的全部分析结果。");
  assert.match(doc.querySelector("#main-content-area h3").textContent, /差异表达结果/);
});

test("jsdom：实验页选项卡 / Select 按钮 / 结果页计数", () => {
  const { doc } = boot(
    '<body><ul class="tabs"><li class="tabs-title">Results</li><li class="tabs-title">Plots</li>' +
      '<li class="tabs-title">Experiment Design</li><li class="tabs-title">Supplementary Information</li>' +
      '<li class="tabs-title">Downloads</li></ul>' +
      '<div class="row column margin-bottom-medium">Select</div>' +
      '<div class="row column"><button class="btn btn-lg btn-default">Select</button></div>' +
      '<div class="margin-top-medium"><ul class="small"><li>Organism part: all</li>' +
      "<li>Developmental stage: early maturation stage</li></ul></div>" +
      '<div>Initially showing:</div></body>',
    "https://www.ebi.ac.uk/gxa/experiments/E-MTAB-4045/Results"
  );
  const tabs = [...doc.querySelectorAll(".tabs-title")].map((t) => t.textContent.trim());
  assert.deepEqual(tabs, ["结果", "图表", "实验设计", "补充信息", "下载"]);
  const texts = [...doc.querySelectorAll("div")].map((d) => d.textContent.trim());
  assert.ok(texts.includes("选择"), "Select 按钮未译");
  assert.ok(
    texts.some((t) => t.includes("生物体部位：全部")),
    "Organism part 未译: " + texts.filter(Boolean).slice(0, 8).join(" | ")
  );
  const li = [...doc.querySelectorAll("li")].map((x) => x.textContent.trim());
  assert.ok(li.includes("发育阶段：early maturation stage"), "Developmental stage 未译: " + li.join(" | "));
});

test("jsdom：下载页两条 <img>+<sub> 短说明（图片与下标各占槽位）", () => {
  const { doc } = boot(
    '<body><div id="main-content-area"><p>' +
      'For two-channel microarray experiments you can download the log<sub>2</sub> fold changes using' +
      ' the <img src="/gxa/resources/images/download/download-fc.png" alt="log2 fold changes" align="bottom" class="icon">' +
      ' button.</p>' +
      '<p>For RNA-seq experiments you can download the raw counts generated by' +
      ' <a href="http://www-huber.embl.de/users/anders/HTSeq/doc/count.html">htseq-count</a> using the' +
      ' <img src="/gxa/resources/images/download/download-raw-counts.png" alt="raw counts" align="bottom" class="icon">' +
      ' button.</p></div></body>',
    "https://www.ebi.ac.uk/gxa/download"
  );
  const ps = doc.querySelectorAll("#main-content-area p");
  const norm = (s) => s.replace(/\s+/g, " ").trim();
  assert.equal(norm(ps[0].textContent), "对于双通道微阵列实验，点击按钮即可下载 log2 倍数变化。");
  assert.equal(ps[0].querySelectorAll("img").length, 1, "图标按钮必须留在原位");
  assert.equal(ps[0].querySelectorAll("sub").length, 1, "log2 的下标不能被吃掉");
  assert.equal(ps[0].querySelector("sub").textContent, "2");
  assert.equal(norm(ps[1].textContent), "对于 RNA-seq 实验，点击按钮即可下载由htseq-count生成的原始计数。");
  assert.equal(ps[1].querySelectorAll("img").length, 1);
  const a = ps[1].querySelector("a");
  assert.equal(a.textContent, "htseq-count");
  assert.equal(a.getAttribute("href"), "http://www-huber.embl.de/users/anders/HTSeq/doc/count.html");
});
