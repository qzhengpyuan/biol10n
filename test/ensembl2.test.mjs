// Ensembl 剩余英文词库（dict/ensembl2.json）校验 + 引擎行为测试
// 覆盖：BioMart 文档首页 / how_to_use_biomart / combining_species_datasets / r_package /
//       restful / perl_api 五个子页，以及 /biomart/martview 界面上的英文
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/ensembl2.json"), "utf8"));
// 生产上 common 与本册一起加载：martview 的 Count/Results/BioMart 等基础词来自 common
const commonDict = JSON.parse(fs.readFileSync(path.join(root, "../dict/common.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "ensembl");

const DOC = '<div id="content">';
function mount(html, url = "https://jun2026.archive.ensembl.org/info/data/biomart/index.html") {
  const dom = new JSDOM(html, { url });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: { ...commonDict.exact, ...dict.exact }, rules: dict.rules, templates: dict.templates },
    site
  });
  engine.start();
  return dom.window.document;
}

// ---------------- 结构校验 ----------------

test("词库可解析，站点与三类条目齐全", () => {
  assert.equal(dict.meta.family, "ensembl2");
  assert.ok(dict.meta.sites.includes("www.ensembl.org"));
  assert.ok(dict.meta.sites.includes("*.archive.ensembl.org"), "archive 站点必须登记（文档页现在都在 archive 上）");
  assert.ok(Object.keys(dict.exact).length > 100, "exact 条目应多于 100 条");
  assert.ok(dict.rules.length >= 1);
  assert.ok(dict.templates.length >= 12, "templates 至少 12 条");
});

test("关键条目存在（文档首页 / how-to / martview）", () => {
  const want = {
    "BioMart tutorials and FAQs": "BioMart 教程与常见问题",
    "Extracting data with BioMart": "使用 BioMart 提取数据",
    "BioMart data mining tool": "BioMart 数据挖掘工具",
    "BioMart R package, RESTful access and API": "BioMart R 包、RESTful 访问与 API",
    "BiomaRt, Bioconductor R package": "BiomaRt：Bioconductor R 包",
    "BioMart RESTful access (Perl and wget)": "BioMart RESTful 访问（Perl 与 wget）",
    "Combining multiple species datasets": "合并多个物种数据集",
    "What is BioMart": "什么是 BioMart",
    "Select a mart database (a type of data)": "选择 mart 数据库（一类数据）",
    "Display and retrieve your query": "显示并获取查询结果",
    "None selected": "未选择",
    "[None selected]": "[未选择]",
    "- CHOOSE DATABASE -": "- 选择数据库 -",
    "- CHOOSE DATASET -": "- 选择数据集 -",
    "View in archive site": "在存档站点查看",
    "BioMart tutorial": "BioMart 教程"
  };
  for (const [k, v] of Object.entries(want)) assert.equal(dict.exact[k], v, "缺少或值不符：" + k);
});

test("带引号的说明句原样收进词表（页面原文含半角引号）", () => {
  const keys = Object.keys(dict.exact);
  assert.ok(keys.some((k) => k.includes('Clicking on the "Count" button')));
  assert.ok(keys.some((k) => k.includes('"Compressed web file (notify by email)"')));
  assert.ok(keys.some((k) => k.startsWith('. As shown in the image below, filter on human chromosome 1')));
});

test("rule 可编译且只命中单独的 New", () => {
  for (const r of dict.rules) {
    assert.doesNotThrow(() => new RegExp(r.re), "坏正则：" + r.re);
    assert.ok(r.to.length > 0);
  }
  const rule = dict.rules.find((r) => r.re === "^New$");
  assert.ok(rule, "缺少 ^New$ 规则");
  assert.equal(rule.to, "新建");
  assert.ok(new RegExp(rule.re).test("New"));
  assert.ok(!new RegExp(rule.re).test("New dataset"));
  assert.ok(!new RegExp(rule.re).test("Renew"));
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

test("key 里没有中文，value 里没有明文 URL / 邮箱，也没有自映射", () => {
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "key 含中文：" + k);
    assert.equal(k, k.trim(), "key 有首尾空白：" + k);
    assert.notEqual(k, v, "自映射：" + k);
    assert.ok(!/https?:\/\/|[\w.+-]+@[\w-]+\.\w+/.test(v), "value 含 URL/邮箱：" + k);
  }
  for (const t of dict.templates) {
    assert.ok(!/https?:\/\/|[\w.+-]+@[\w-]+\.\w+/.test(t.zh), "译文含 URL/邮箱：" + t.pat.slice(0, 40));
  }
});

test("词库里不收录 ID / 物种名 / 格式名", () => {
  const keys = Object.keys(dict.exact);
  const bad = keys.filter((k) => /^ENS[GTP]\d|^rs\d|genes \(GRC|^(FASTA|TSV|XML|URL|Perl|List)$/.test(k));
  assert.deepEqual(bad, []);
});

// ---------------- 引擎行为 ----------------

test("文档首页：带链接的段落走模板，链接与译文都保留", () => {
  const doc = mount(
    DOC +
      "<p>Tables of Ensembl data can be downloaded via the highly customisable " +
      '<a href="/biomart/martview">BioMart data mining tool</a>. The easy-to-use web-based tool allows extraction of data without any programming knowledge or understanding of the underlying database structure.</p></div>'
  );
  const p = doc.querySelector("#content p");
  assert.match(p.textContent, /^Ensembl 数据表可通过高度可定制的 BioMart 数据挖掘工具下载。/);
  assert.match(p.textContent, /无需编程知识，也不必了解底层数据库结构即可提取数据。$/);
  assert.equal(p.querySelector("a").getAttribute("href"), "/biomart/martview");
});

test("文档首页：FAQ 列表项的中文尾巴与链接分别命中", () => {
  const doc = mount(
    DOC +
      '<ul><li><a href="/Help/Faq">BioMart FAQs</a>: BioMart Frequently Asked Questions.<ul>' +
      '<li><a href="/Help/Faq?id=215">How can I download all the proteins in the human proteome? Do I use BioMart?</a></li>' +
      "</ul></li>" +
      '<li><a href="/info/website/tutorials/">BioMart tutorials</a>: BioMart short videos and written materials.</li></ul></div>'
  );
  const lis = [...doc.querySelectorAll("#content > ul > li")].map((li) => li.textContent.replace(/\s+/g, " ").trim());
  assert.match(lis[0], /^BioMart 常见问题：BioMart 常见问题。/);
  assert.equal(lis[1], "BioMart 教程：BioMart 短视频与书面材料。");
  assert.equal(doc.querySelector("#content ul ul a").textContent, "如何下载人类蛋白质组中的全部蛋白质？我需要用 BioMart 吗？");
});

test("how-to：步骤标题与正文整块翻成中文", () => {
  const doc = mount(
    DOC +
      "<h2>1. Select a mart database (a type of data)</h2>" +
      "<p>First, select a mart database which will correspond to the type of data you are interested in. In Ensembl, you can choose data from one of our four mart databases:</p>" +
      "<h2>4. Select mart attributes (desired output)</h2>" +
      "<p>The marts are available for the following species:</p></div>"
  );
  const h2 = [...doc.querySelectorAll("h2")].map((h) => h.textContent);
  assert.deepEqual(h2, ["1. 选择 mart 数据库（一类数据）", "4. 选择 mart 属性（所需输出）"]);
  const ps = [...doc.querySelectorAll("p")].map((p) => p.textContent);
  assert.match(ps[0], /^首先选择一个 mart 数据库/);
  assert.equal(ps[1], "这些 mart 适用于以下物种：");
});

test("how-to：物种列表项走模板，链接文本也翻成中文", () => {
  const doc = mount(
    DOC +
      "<ul><li>Ensembl Genes: All the Ensembl species, full list on the " +
      '<a href="/info/about/species.html">species page</a>.</li>' +
      "<li>Ensembl Variation: We only have a subset of our species which have variation data available, full list on the " +
      '<a href="/info/about/variation_species.html">variation species page</a>.</li></ul></div>'
  );
  const lis = [...doc.querySelectorAll("#content li")];
  assert.match(lis[0].textContent, /^Ensembl Genes：Ensembl 全部物种，完整列表见物种页面。$/);
  assert.match(lis[1].textContent, /^Ensembl Variation：我们只有部分物种有变异数据，完整列表见变异物种页面。$/);
  assert.equal(lis[0].querySelector("a").getAttribute("href"), "/info/about/species.html");
  assert.equal(lis[1].querySelector("a").textContent, "变异物种页面");
});

test("how-to：结尾双链接句走模板，两个链接都保留", () => {
  const doc = mount(
    DOC +
      "<p>BioMart tutorials, multiple dataset query, Perl API, RESTful and Bioconductor R package access documentations can be found on " +
      '<a href="/info/data/biomart/">the following page</a>. If you have any questions, you can email Ensembl helpdesk ' +
      '<a href="/info/about/contact.html">using our web form</a>.</p></div>'
  );
  const p = doc.querySelector("p");
  assert.equal(p.textContent, "BioMart 教程、多数据集查询、Perl API、RESTful 与 Bioconductor R 包访问文档见以下页面。如有任何疑问，可通过我们的网页表单向 Ensembl 帮助台发邮件。");
  const as = [...p.querySelectorAll("a")];
  assert.equal(as.length, 2);
  assert.equal(as[0].getAttribute("href"), "/info/data/biomart/");
  assert.equal(as[1].getAttribute("href"), "/info/about/contact.html");
});

test("combining：两处带链接的长句分别走模板与片段词条", () => {
  const doc = mount(
    DOC +
      "<p>The BioMart interface allow you to link two different species datasets together to get combined results back from BioMart. First, go to the " +
      '<a href="/biomart/martview">Ensembl BioMart page</a>. As shown in the image below, ' +
      '<a href="/biomart/martview?x=1">filter on human chromosome 1 and select the Ensembl Gene and Transcript IDs, HGNC IDs and symbols attributes.</a></p>' +
      "</div>"
  );
  const p = doc.querySelector("p");
  assert.match(p.textContent, /^BioMart 界面允许你把两个不同的物种数据集关联起来，从而获得合并后的结果。首先进入 Ensembl BioMart 页面。/);
  assert.match(p.textContent, /如下图所示，筛选人类 1 号染色体，并选择 Ensembl 基因与转录本 ID、HGNC ID 与符号属性。$/);
  assert.equal(p.querySelectorAll("a").length, 2);
});

test("r_package：模板句保住 R 软件链接", () => {
  const doc = mount(
    DOC +
      '<p>First make sure you have installed the <a href="https://www.r-project.org/">R software</a> on your computer.</p>' +
      "<p>Then, run the following commands to install the Bioconductor BiomaRt R package:</p></div>"
  );
  const ps = [...doc.querySelectorAll("p")];
  assert.equal(ps[0].textContent, "首先请确认你的电脑上已安装 R 软件。");
  assert.equal(ps[0].querySelector("a").getAttribute("href"), "https://www.r-project.org/");
  assert.match(ps[1].textContent, /^然后运行以下命令安装 Bioconductor 的 BiomaRt R 包：$/);
});

test("restful：单链接句与双链接句都走模板，片段词条补齐两侧", () => {
  const doc = mount(
    DOC +
      "<p>Finally run the biomart-perl/scripts/webExample.pl Perl script with the xml file obtained in the " +
      '<a href="#biomartxml">"Obtaining the BioMart xml"</a> section:</p>' +
      "<p>Then either use " +
      '<a href="#wget">the wget command</a> or ' +
      '<a href="#biomartperlapi">the BioMart Perl script</a>. If the query successfuly ran, you will get a "[success]" after running the wget or BioMart perl script:</p></div>'
  );
  const ps = [...doc.querySelectorAll("p")];
  assert.equal(ps[0].textContent, "最后用通过 「获取 BioMart xml」 一节获得的 xml 文件运行 biomart-perl/scripts/webExample.pl 这个 Perl 脚本：");
  assert.match(ps[1].textContent, /^然后使用 wget 命令或 BioMart Perl 脚本。/);
  assert.match(ps[1].textContent, /看到「\[success\]」：$/);
  assert.deepEqual([...ps[1].querySelectorAll("a")].map((a) => a.getAttribute("href")), ["#wget", "#biomartperlapi"]);
});

test("perl_api：带两个链接的长句走模板", () => {
  const doc = mount(
    DOC +
      "<p>You can easily obtain a BioMart Perl script from the BioMart interface. For example, " +
      '<a href="/biomart/martview">navigate to the Ensembl gene mart on the Ensembl website</a>, apply your required filters and select the attribute you are interested in. ' +
      '<a href="/biomart/martview?y=2">As shown in the example below, filter on the human Ensembl Gene ID "ENSG00000139618" and select the Ensembl Gene, Transcript IDs, HGNC IDs and symbols and Uniprot Swissprot accessions attribute</a>. ' +
      'The BioMart Perl script can be downloaded from the BioMart result page accessible via the "Results" button. To get your BioMart query in Perl, just click on the "Perl" button as indicated by the red box in the image below:</p></div>'
  );
  const p = doc.querySelector("p");
  assert.match(p.textContent, /^在 BioMart 界面中可以轻松获取 BioMart Perl 脚本。例如，在 Ensembl 网站上进入 Ensembl 基因 mart，应用所需的筛选条件并选择你感兴趣的属性。/);
  assert.match(p.textContent, /只需点击下图红框所示的「Perl」按钮：$/);
  assert.equal(p.querySelectorAll("a").length, 2);
});

test("martview：占位符、数据库/数据集下拉与三句说明全部翻成中文", () => {
  const doc = mount(
    DOC +
      '<div class="mart_summarypanel_listitem2">[None selected]</div>' +
      "<table><tbody><tr><td>None selected</td></tr></tbody></table>" +
      '<select name="databasemenu"><option value="">- CHOOSE DATABASE -</option><option value="1">Ensembl Genes 116</option></select>' +
      '<select name="datasetmenu_3"><option value="">- CHOOSE DATASET -</option><option value="2">Human genes (GRCh38.p14)</option></select>' +
      "<p>In order to maintain service for all users, BioMart browser sessions running for more than 5 minutes are terminated. If you have queries that you think will run longer than this, please choose have the results emailed to you.</p>" +
      "<p>Datasets -> Filters (filtering and inputs) -> Attributes (desired output) -> Results</p>" +
      '<p><a href="/biomart/martview">BioMart tutorial</a> | <a href="#">YouTube</a></p>' +
      '<div class="modal_link"><a href="#">View in archive site</a></div></div>',
    "https://jun2026.archive.ensembl.org/biomart/martview/abc123"
  );
  assert.equal(doc.querySelector(".mart_summarypanel_listitem2").textContent, "[未选择]");
  assert.equal(doc.querySelector("td").textContent, "未选择");
  const opts = [...doc.querySelectorAll("option")].map((o) => o.textContent);
  assert.deepEqual(opts, ["- 选择数据库 -", "Ensembl Genes 116", "- 选择数据集 -", "Human genes (GRCh38.p14)"]);
  const ps = [...doc.querySelectorAll("p")].map((p) => p.textContent);
  assert.match(ps[0], /^为保障所有用户的服务，BioMart 浏览器会话运行超过 5 分钟即会终止。/);
  assert.equal(ps[1], "数据集 -> 筛选（筛选条件与输入） -> 属性（所需输出） -> 结果");
  assert.match(ps[2], /^BioMart 教程/);
  assert.equal(doc.querySelector(".modal_link a").textContent, "在存档站点查看");
});

test("martview：New 页签走规则翻成新建，其它文案不动", () => {
  const doc = mount(
    DOC +
      '<a id="new_button_tag" class="mart_btn_new" href="#">New</a>' +
      '<a id="count_button_tag" href="#">Count</a>' +
      '<a id="results_button_tag" href="#">Results</a></div>',
    "https://jun2026.archive.ensembl.org/biomart/martview/abc123"
  );
  assert.equal(doc.querySelector("#new_button_tag").textContent, "新建");
  assert.equal(doc.querySelector("#count_button_tag").textContent, "计数");
  assert.equal(doc.querySelector("#results_button_tag").textContent, "结果");
});