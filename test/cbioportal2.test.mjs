// cBioPortal 剩余英文词库（dict/cbioportal2.json）校验 + 引擎行为测试
// 覆盖：/webAPI 静态文档页、/datasets 表头与说明句、结果页「下载」「突变」标签页、首页页脚与用户评价
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/cbioportal2.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const baseSite = sites.find((s) => s.id === "cbioportal");
// 关掉延迟补扫：测试只验证一次扫描的翻译结果，不等 45 秒的 rescan 定时器
const site = { ...baseSite, rescan: false };

function mount(inner, url = "https://www.cbioportal.org/webAPI") {
  const dom = new JSDOM('<div id="root"><main id="mainColumn">' + inner + "</main></div>", { url });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: dict.exact, rules: dict.rules, templates: dict.templates },
    site
  });
  engine.start();
  return { doc: dom.window.document, engine };
}

function zh(text) {
  return String(text).replace(/\s+/g, " ").trim();
}

// ---------------- 结构校验 ----------------

test("词库可解析，exact/rules/templates 三类都有内容", () => {
  assert.equal(dict.meta.family, "cbioportal2");
  assert.ok(dict.meta.sites.includes("cbioportal.org"));
  assert.ok(Object.keys(dict.exact).length >= 45, "exact 条目应不少于 45 条");
  assert.ok(dict.rules.length >= 1, "rules 至少 1 条");
  assert.ok(dict.templates.length >= 4, "templates 至少 4 条");
});

test("key 里没有中文，value 里没有明文 URL / 邮箱", () => {
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "key 含中文：" + k);
    assert.ok(!/https?:\/\/|[\w.+-]+@[\w-]+\.\w+/.test(v), "value 含 URL/邮箱：" + k);
  }
  for (const t of dict.templates) {
    assert.ok(!/https?:\/\/|[\w.+-]+@[\w-]+\.\w+/.test(t.zh), "译文含 URL/邮箱：" + t.pat.slice(0, 40));
  }
});

test("关键条目存在（页脚、webAPI、数据集页、下载页、突变页）", () => {
  const want = {
    "HELP": "帮助",
    "INFO": "信息",
    "CONTACT": "联系",
    "Linking to Us": "链接到我们",
    "Download Documentation": "下载文档",
    "Columns": "列",
    "Tumor mRNA (microarray)": "肿瘤 mRNA（微阵列）",
    "Protein Mass Spectrometry": "蛋白质质谱",
    "Treatment Count": "治疗数",
    "Downloadable Data Files": "可下载的数据文件",
    "Download Help": "下载帮助",
    "Copy-number Alterations (OQL is not in effect)": "拷贝数改变（OQL 未生效）",
    "Tab Delimited Format": "制表符分隔格式",
    "Transposed Matrix": "转置矩阵",
    "Virtual Study": "虚拟研究",
    "Altered": "已改变",
    "Custom Driver Tiers": "自定义驱动分级",
    "Start Pos": "起始位置",
    "End Pos": "终止位置",
    "Variant Reads": "变异读数",
    "Oncogenic / Likely Oncog. / Resistance": "致癌 / 可能致癌 / 耐药"
  };
  for (const [k, v] of Object.entries(want)) {
    assert.equal(dict.exact[k], v, "缺少或值不符：" + k);
  }
  // 首页用户评价整段（含首尾 ASCII 双引号，页面原文如此）
  const quote = Object.keys(dict.exact).find((k) => k.startsWith('"Whenever bench scientists ask me'));
  assert.ok(quote, "缺少首页用户评价整段");
  assert.ok(quote.endsWith('painful."'), "评价段必须以页面原文的结尾引号收尾");
  assert.ok(!/[\u4e00-\u9fff]/.test(quote), "英文原串里不该出现中文");
});

test("rule 正则可编译，且能按预期改写实测原文", () => {
  for (const r of dict.rules) {
    assert.doesNotThrow(() => new RegExp(r.re), "坏正则：" + r.re);
    assert.ok(r.to.length > 0);
  }
  const lvl = dict.rules.find((r) => r.re.includes("Level"));
  const hit = new RegExp(lvl.re).exec("Level 3A");
  assert.ok(hit, "Level 规则应命中 OncoKB 分级原文");
  assert.equal(lvl.to.replace(/\$(\d)/g, (_, d) => hit[Number(d)]), "3A 级");
  const hitR = new RegExp(lvl.re).exec("Level R2");
  assert.ok(hitR, "耐药分级 Level R2 也要能命中");
  assert.equal(lvl.to.replace(/\$(\d)/g, (_, d) => hitR[Number(d)]), "R2 级");
});

test("template pat 长度合规、占位符与中文一一对应、原文不含中文", () => {
  for (const t of dict.templates) {
    assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, "pat 长度越界：" + t.pat.slice(0, 40));
    assert.ok(!/[\u4e00-\u9fff]/.test(t.pat), "pat 不该含中文：" + t.pat.slice(0, 40));
    const slotCount = (t.pat.match(/\{\{\d+\}\}/g) || []).length;
    const used = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
    assert.deepEqual(used, Array.from({ length: slotCount }, (_, i) => i + 1), "占位符不匹配：" + t.pat.slice(0, 40));
    assert.ok(/[\u4e00-\u9fff]/.test(t.zh), "译文必须是中文：" + t.pat.slice(0, 40));
  }
});

// ---------------- 引擎行为 ----------------

test("页脚三段标题翻成中文", () => {
  const { doc } = mount(
    '<footer id="footer"><nav class="footer-layout">' +
      "<div class=\"footer-elem\"><h3>HELP</h3><ul><li><a>教程</a></li></ul></div>" +
      "<div class=\"footer-elem\"><h3>INFO</h3></div>" +
      "<div class=\"footer-elem\"><h3>CONTACT</h3></div>" +
      "</nav></footer>"
  );
  assert.deepEqual([...doc.querySelectorAll("h3")].map((e) => zh(e.textContent)), ["帮助", "信息", "联系"]);
});

test("/webAPI：标题、说明句与三条参数列表（strong + 链接都保住）", () => {
  const { doc } = mount(
    "<h1>Web API</h1>" +
      '<p>API documentation is now at <a target="_blank" href="https://docs.cbioportal.org/web-api-and-clients/">docs.cbioportal.org</a></p>' +
      '<h2 id="linking-to-us">Linking to Us</h2>' +
      "<p>Once you have a cancer_study_id, it is very easy to create stable links from your web site to the cBio Portal. Stable links must point to ln, and can include the following parameters:</p>" +
      "<ul>" +
      '<li><strong>q</strong>=[a query following <a href="oql" target="_blank">Onco Query Language</a>, e.g. a space separated list of HUGO gene symbols] (required)</li>' +
      "<li><strong>cancer_study_id</strong>=[cancer study ID] (if not specified, do a cross cancer query)</li>" +
      "<li><strong>report</strong>=[report to display; can be one of: full (default), oncoprint_html]</li>" +
      "</ul>" +
      "<p>For example, here is a link to the TCGA GBM data for EGFR and NF1:</p>" +
      '<p><a href="ln?cancer_study_id=gbm_tcga&amp;q=EGFR+NF1">ln?cancer_study_id=gbm_tcga&amp;q=EGFR+NF1</a></p>' +
      "<p>And a link to TP53 mutations across a curated set of non-redundant studies:</p>"
  );
  assert.equal(zh(doc.querySelector("h2").textContent), "链接到我们");
  const ps = [...doc.querySelectorAll("p")];
  assert.match(zh(ps[0].textContent), /^API 文档现已移至 docs\.cbioportal\.org$/);
  assert.equal(ps[0].querySelector("a").getAttribute("href"), "https://docs.cbioportal.org/web-api-and-clients/");
  assert.match(zh(ps[1].textContent), /^有了 cancer_study_id 之后/);
  assert.match(zh(ps[1].textContent), /并可包含以下参数：$/);
  const lis = [...doc.querySelectorAll("li")];
  assert.match(zh(lis[0].textContent), /^q=\[遵循Onco 查询语言的查询/);
  assert.match(zh(lis[0].textContent), /（必填）$/);
  assert.equal(lis[0].querySelector("a").getAttribute("href"), "oql");
  assert.equal(zh(lis[1].textContent), "cancer_study_id=[癌症研究 ID]（未指定时进行跨癌种查询）");
  assert.equal(zh(lis[2].textContent), "report=[要显示的报表；可为：full（默认）、oncoprint_html]");
  assert.match(zh(ps[2].textContent), /^例如，以下是指向 EGFR 与 NF1 的 TCGA GBM 数据的链接：$/);
  assert.match(zh(ps[4].textContent), /^以下是指向精选的非冗余研究集中 TP53 突变的链接：$/);
});

test("/datasets：说明句走模板，下载链接与 href 都保住", () => {
  const { doc } = mount(
    "<p>The table below lists the number of available samples per cancer study and data type. It also provides links to download the data for each study. For alternative ways of downloading, see the " +
      '<a href="https://docs.cbioportal.org/5.2-datasets/downloads#introduction">Download Documentation</a>.</p>' +
      '<button class="btn-sm dropdown-toggle btn btn-default">Columns <span class="caret"></span></button>',
    "https://www.cbioportal.org/datasets"
  );
  const p = doc.querySelector("p");
  assert.match(zh(p.textContent), /^下表列出每项癌症研究与每种数据类型可用的样本数/);
  assert.match(zh(p.textContent), /其他下载方式请参见下载文档。$/);
  assert.equal(p.querySelector("a").getAttribute("href"), "https://docs.cbioportal.org/5.2-datasets/downloads#introduction");
  assert.equal(zh(doc.querySelector("button").textContent), "列");
});

test("结果页「下载」标签页：数据文件行、链接文字与表格标题", () => {
  const { doc } = mount(
    '<h2 class="forceHeaderStyle h4">Downloadable Data Files</h2>' +
      '<a href="https://docs.cbioportal.org/user-guide/faq/#how-do-i-download-data">Download Help</a>' +
      "<table><tbody>" +
      "<tr><td>Copy-number Alterations (OQL is not in effect)</td><td>" +
      '<a><i class="fa fa-cloud-download"></i>Tab Delimited Format</a><span>|</span><a><i class="fa fa-cloud-download"></i>Transposed Matrix</a></td></tr>' +
      "<tr><td>Mutations (OQL is not in effect)</td><td></td></tr>" +
      "<tr><td>Structural Variants (OQL is not in effect)</td><td></td></tr>" +
      '<tr><td>Altered samples</td><td><a><i class="fa fa-pie-chart"></i>Virtual Study</a></td></tr>' +
      "<tr><td>Unaltered samples</td><td></td></tr>" +
      "<tr><td>Sample matrix: List of all samples where 1=altered and 0=unaltered</td><td></td></tr>" +
      "<tr><td>来自 GISTIC 的推定臂水平拷贝数</td><td>Tracks added in the OncoPrint tab can be downloaded here.</td></tr>" +
      "</tbody></table>" +
      '<h2 class="forceHeaderStyle h4">Gene Alteration Frequency</h2>' +
      "<table><thead><tr><th>Gene Symbol</th><th>Num Samples Altered</th><th>Percent Samples Altered</th></tr></thead></table>" +
      '<h2 class="forceHeaderStyle h4">Type of Genetic Alterations Across All Samples</h2>' +
      "<table><thead><tr><th>Altered</th></tr></thead></table>",
    "https://www.cbioportal.org/results/download?cancer_study_list=brca_tcga_pan_can_atlas_2018&gene_list=TP53"
  );
  const tds = [...doc.querySelectorAll("td")].map((e) => zh(e.textContent));
  assert.equal(tds[0], "拷贝数改变（OQL 未生效）");
  assert.equal(tds[1], "制表符分隔格式|转置矩阵");
  assert.equal(tds[2], "突变（OQL 未生效）");
  assert.equal(tds[4], "结构变异（OQL 未生效）");
  assert.equal(tds[6], "发生改变的样本");
  assert.equal(tds[8], "未改变的样本");
  assert.equal(tds[10], "样本矩阵：列出所有样本，1 表示发生改变，0 表示未改变");
  assert.equal(tds[13], "在 OncoPrint 标签页中添加的轨道可在此下载。");
  assert.ok([...doc.querySelectorAll("td a")].some((a) => zh(a.textContent) === "虚拟研究"), "Virtual Study 链接应翻成中文");
  const h2 = [...doc.querySelectorAll("h2")].map((e) => zh(e.textContent));
  assert.deepEqual(h2, ["可下载的数据文件", "基因改变频率", "所有样本中遗传改变的类型"]);
  const th = [...doc.querySelectorAll("th")].map((e) => zh(e.textContent));
  assert.deepEqual(th, ["基因符号", "改变样本数", "改变样本占比", "已改变"]);
});

test("结果页「突变」标签页：列名与筛选项", () => {
  const { doc } = mount(
    '<div class="dropdown-menu"><ul class="list-unstyled">' +
      "<li><label>Custom Driver</label></li>" +
      "<li><label>Custom Driver Tiers</label></li>" +
      "<li><label>Functional Impact</label></li>" +
      "<li><label>Variant Type</label></li>" +
      "<li><label>Center</label></li>" +
      "<li><label>Start Pos</label></li>" +
      "<li><label>End Pos</label></li>" +
      "<li><label>Variant Reads</label></li>" +
      "<li><label>Ref Reads</label></li>" +
      "</ul></div>" +
      '<div class="categoricalFilterMenu"><div class="option">Oncogenic / Likely Oncog. / Resistance</div>' +
      '<div class="option">Likely Neutral</div><div class="option">Inconclusive</div>' +
      '<div class="option">Level 1</div><div class="option">Level 3A</div><div class="option">Level R2</div>' +
      '<div class="option">Recurrent (or recurrent + 3D) hotspot</div><div class="option">3D clustered hotspot</div>' +
      '<div class="option">Not a known hotspot</div>' +
      '<div class="option">In CIViC, with oncogenic activity info</div>' +
      '<div class="option">In CIViC, no oncogenic activity info</div></div>' +
      '<button class="btn">Compare</button>',
    "https://www.cbioportal.org/results/mutations?cancer_study_list=brca_tcga_pan_can_atlas_2018&gene_list=TP53"
  );
  const labels = [...doc.querySelectorAll("label")].map((e) => zh(e.textContent));
  assert.deepEqual(labels, [
    "自定义驱动", "自定义驱动分级", "功能影响", "变异类型", "中心",
    "起始位置", "终止位置", "变异读数", "参考读数"
  ]);
  const opts = [...doc.querySelectorAll(".option")].map((e) => zh(e.textContent));
  assert.deepEqual(opts, [
    "致癌 / 可能致癌 / 耐药", "可能中性", "不确定",
    "1 级", "3A 级", "R2 级",
    "复发性（或复发性 + 3D）热点", "3D 聚集热点", "非已知热点",
    "CIViC 中有致癌活性信息", "CIViC 中无致癌活性信息"
  ]);
  assert.equal(zh(doc.querySelector("button").textContent), "比较");
});

test("首页用户评价：长段落（正文保护阈值之上）整段替换成中文", () => {
  const quote = Object.keys(dict.exact).find((k) => k.startsWith('"Whenever bench scientists ask me'));
  const { doc } = mount(
    '<div class="testimonials-module__testimonial__rRuSR"><div class="testimonial-blockquote">' +
      "<p>" + quote + "</p><cite>--博士后研究员，俄勒冈健康与科学大学</cite></div></div>",
    "https://www.cbioportal.org/"
  );
  const p = zh(doc.querySelector("p").textContent);
  assert.match(p, /^“每当一线实验科学家问我/);
  assert.match(p, /它让数据查询轻松了许多。”$/);
  assert.ok(!/Whenever bench scientists/.test(p), "评价原文应被整段替换");
});

test("数据文件里没有的整句不会被逐词硬翻（对照组）", () => {
  const { doc, engine } = mount("<p>Some unrelated English sentence that is not in the dictionary at all.</p>");
  assert.equal(doc.querySelector("p").textContent, "Some unrelated English sentence that is not in the dictionary at all.");
  assert.equal(engine.translateText("HELP"), "帮助");
  assert.equal(engine.translateText("Tab Delimited Format"), "制表符分隔格式");
  assert.equal(engine.translateText("Level 4"), "4 级");
});