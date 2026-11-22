// Gene Ontology 主站 + AmiGO 2 词库回归：导航/文档页/下载页/统计页/检索与条目页
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const books = {
  geneontology: JSON.parse(fs.readFileSync(path.join(root, "../dict/geneontology.json"), "utf8")),
  amigo: JSON.parse(fs.readFileSync(path.join(root, "../dict/amigo.json"), "utf8")),
  common: JSON.parse(fs.readFileSync(path.join(root, "../dict/common.json"), "utf8"))
};

// config/sites.json 由维护者统一挂站；测试在条目尚未合入时按同一份栈自建，合入后自动走真实配置。
const fallback = {
  geneontology: { id: "geneontology", hosts: ["geneontology.org"], dicts: ["common", "geneontology"], scope: "body" },
  amigo: { id: "amigo", hosts: ["amigo.geneontology.org"], dicts: ["common", "geneontology", "amigo"], scope: "body", spa: true, waitFor: "#results-area" }
};

function siteOf(id) {
  return sites.find((s) => s.id === id) || fallback[id];
}

function stackOf(id) {
  const site = siteOf(id);
  const exact = {}, rules = [], templates = [];
  for (const d of site.dicts) {
    const b = books[d] || JSON.parse(fs.readFileSync(path.join(root, "../dict", d + ".json"), "utf8"));
    Object.assign(exact, b.exact || {});
    rules.push(...(b.rules || []));
    templates.push(...(b.templates || []));
  }
  return { site, value: { exact, rules, templates } };
}

function run(id, html) {
  const dom = new JSDOM(html);
  const { site, value } = stackOf(id);
  const engine = createEngine({ document: dom.window.document, window: dom.window, data: value, site });
  engine.start();
  return dom.window.document;
}

function texts(doc, sel) {
  return [...doc.querySelectorAll(sel)].map((e) => e.textContent.trim().replace(/\s+/g, " "));
}

test("词库结构：条数、键值形态、规则可编译、模板槽位连续", () => {
  for (const [id, min] of [["geneontology", 300], ["amigo", 100]]) {
    const b = books[id];
    assert.ok(b.meta.sites.length >= 1, id + " meta.sites");
    assert.ok(Object.keys(b.exact).length >= min, id + " exact 至少 " + min + " 条");
    assert.ok(b.rules.length >= 2, id + " rules 至少 2 条");
    assert.ok(Array.isArray(b.templates), id + " templates 必须是数组");
    const seen = new Set();
    for (const [k, v] of Object.entries(b.exact)) {
      assert.ok(!/[\u4e00-\u9fff]/.test(k), "键里不能有中文: " + k);
      assert.ok(/[\u4e00-\u9fff]/.test(v), "译文里必须有中文: " + k);
      assert.notEqual(k, v, "自映射: " + k);
      assert.equal(k, k.trim(), "键首尾不能有空白: " + JSON.stringify(k));
      assert.equal(v, v.trim(), "译文首尾不能有空白: " + JSON.stringify(k));
      assert.ok(!seen.has(k), "重复键: " + k);
      assert.ok(!/https?:\/\/|@[A-Za-z0-9.-]+\.[a-z]{2,}/i.test(v), "译文不能含 URL/邮箱: " + k);
      seen.add(k);
    }
    for (const r of b.rules) {
      assert.ok(new RegExp(r.re).source.length > 0, "规则可编译: " + r.re);
      assert.ok(/[\u4e00-\u9fff]/.test(r.to), "规则译文里必须有中文: " + r.re);
      assert.ok(/\$\d/.test(r.to), "规则译文要用到占位符: " + r.re);
    }
    for (const t of b.templates) {
      const used = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])).sort((a, c) => a - c);
      assert.ok(used.length >= 1, "模板要带槽位: " + t.pat);
      used.forEach((n, i) => assert.equal(n, i + 1, "槽位必须从 1 连续: " + t.pat));
      const zh = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])).sort((a, c) => a - c);
      assert.deepEqual(zh, used, "译文槽位要与原文一致: " + t.pat);
    }
  }
});

test("全站导航与页脚：GO 主站五个下拉菜单、文档入口、页脚", () => {
  const doc = run("geneontology",
    '<nav class="navbar"><ul>' +
      '<a>About</a><a>Ontology</a><a>Annotations</a><a>Downloads</a><a>Help</a>' +
      '<a>About the GO</a><a>Who we are</a><a>Collaborations</a><a>Annotation contributors</a>' +
      '<a>Scientific literature</a><a>GO citation policy and license</a>' +
      '<a>Gene Ontology overview</a><a>Cross-references of external classification systems to GO</a>' +
      '<a>Guide to GO subsets</a><a>Contributing to the ontology</a>' +
      '<a>PAN-GO human functionome</a><a>Introduction to GO annotations</a><a>Guide to GO evidence codes</a>' +
      '<a>Contributing GO annotations</a><a>GO Association File (GAF) format</a>' +
      '<a>Download ontology</a><a>Download annotations</a><a>Download GO-CAMs</a>' +
      '<a>Search Documentation</a><a>Frequently Asked Questions</a>' +
      '<a>GO Archives & Deprecated Products/Formats</a><a>Citation Policy & Terms</a><a>Contact Us</a>' +
      "</ul></nav>" +
      '<footer><a>Home</a><a>Contact us</a><a>Citation and Terms of Use</a><a>Open Biological Ontologies Foundry</a>' +
      "<p>Copyright © 1999-2026 Member of the<a href=\"https://obofoundry.org/\">Open Biological Ontologies Foundry</a></p></footer>"
  );
  const as = texts(doc, "nav a").concat(texts(doc, "footer a"));
  assert.equal(as[0], "关于");
  assert.equal(as[1], "本体");
  assert.equal(as[2], "注释");
  assert.equal(as[3], "下载");
  assert.equal(as[4], "帮助");
  assert.equal(as[5], "关于 GO");
  assert.equal(as[6], "我们是谁");
  assert.equal(as[7], "合作");
  assert.equal(as[8], "注释贡献者");
  assert.equal(as[9], "科学文献");
  assert.equal(as[10], "GO 引用政策与许可");
  assert.equal(as[11], "基因本体概览");
  assert.equal(as[12], "外部分类系统与 GO 的交叉引用");
  assert.equal(as[13], "GO 子集指南");
  assert.equal(as[14], "为本体做贡献");
  assert.equal(as[15], "PAN-GO 人类功能组");
  assert.equal(as[16], "GO 注释简介");
  assert.equal(as[17], "GO 证据代码指南");
  assert.equal(as[18], "贡献 GO 注释");
  assert.equal(as[19], "GO 关联文件（GAF）格式");
  assert.equal(as[20], "下载本体");
  assert.equal(as[21], "下载注释");
  assert.equal(as[22], "下载 GO-CAM");
  assert.equal(as[23], "检索文档");
  assert.equal(as[24], "常见问题");
  assert.equal(as[25], "GO 存档与已弃用的产物/格式");
  assert.equal(as[26], "引用政策与条款");
  assert.equal(as[27], "联系我们");
  const foot = texts(doc, "footer a").slice(0, 4);
  assert.deepEqual(foot, ["首页", "联系我们", "引用与使用条款", "开放生物本体联盟"]);
  assert.equal(doc.querySelector("footer p").textContent, "版权所有 © 1999-2026，成员：开放生物本体联盟");
  assert.equal(doc.querySelector("footer p a").getAttribute("href"), "https://obofoundry.org/", "页脚链接不能改");
});

test("首页：主标题、四个版块、检索表单与富集分析控件", () => {
  const doc = run("geneontology",
    "<main>" +
      "<h1>THE GENE ONTOLOGY RESOURCE</h1>" +
      "<p>The mission of the GO Consortium is to develop a comprehensive, computational model of biological systems, ranging from the molecular to the organism level, across the multiplicity of species in the tree of life.</p>" +
      "<h2>ONTOLOGY</h2><h2>ANNOTATION</h2><h2>GO-CAM</h2><h2>TOOLS & GUIDES</h2>" +
      '<div><input type="radio" name="searchtype" value="all"> Any &nbsp;' +
      '<input type="radio" name="searchtype" value="ontology"> Ontology &nbsp;' +
      '<input type="radio" name="searchtype" value="geneproduct"> Gene Product</div>' +
      '<input placeholder="Search GO term or Gene Product in AmiGO ..." title="Hint: add a space after completing a word to narrow the search.">' +
      '<select><option>biological process</option><option>molecular function</option><option>cellular component</option></select>' +
      "<h3>GO Enrichment Analysis</h3><span>Powered by PANTHER</span>" +
      '<textarea placeholder="Your gene IDs here..."></textarea>' +
      "<p>Hint: works with UniProt ID/ACs, Gene Names, Gene Symbols, MOD IDs, Ensembl IDs, and more</p>" +
      "<p>PAN-GO enrichment can be found here</p>" +
      "<h3>GO Ontology Overview</h3><a>Browse in AmiGO</a><a>Download</a>" +
      "<h3>GO Annotations Overview</h3><a>PAN-GO Functionome</a><a>Browse GO-CAMs</a>" +
      "<h3>GO Tools Overview</h3><a>GO APIs Guide</a>" +
      "</main>"
  );
  assert.equal(doc.querySelector("h1").textContent, "基因本体资源");
  assert.equal(
    doc.querySelector("main p").textContent,
    "GO 联盟的使命是构建一个涵盖生命之树众多物种、从分子层面到生物体层面的综合计算模型。"
  );
  assert.deepEqual(texts(doc, "h2"), ["本体", "注释", "GO-CAM", "工具与指南"]);
  const div = doc.querySelector("div");
  const radios = texts(doc, "div");
  assert.match(radios[0], /任意/);
  assert.match(radios[0], /本体/);
  assert.match(radios[0], /基因产物/);
  assert.equal(doc.querySelector("input[placeholder]").getAttribute("placeholder"), "在 AmiGO 中检索 GO 术语或基因产物……");
  assert.equal(doc.querySelector("input[placeholder]").getAttribute("title"), "提示：输完一个词后加空格可缩小检索范围。");
  assert.deepEqual(texts(doc, "option"), ["生物学过程", "分子功能", "细胞组分"]);
  assert.equal(doc.querySelector("textarea").getAttribute("placeholder"), "在此输入基因 ID……");
  assert.equal(texts(doc, "h3")[0], "GO 富集分析");
  assert.equal(texts(doc, "span")[0], "由 PANTHER 提供支持");
  assert.equal(texts(doc, "main p")[1], "提示：支持 UniProt ID/AC、基因名、基因符号、MOD ID、Ensembl ID 等");
  assert.equal(texts(doc, "main p")[2], "PAN-GO 富集分析见此处");
  assert.deepEqual(texts(doc, "h3").slice(1), ["GO 本体概览", "GO 注释概览", "GO 工具概览"]);
});

test("首页计数行模板：版本日期与四项统计按槽位回填", () => {
  const doc = run("geneontology",
    "<p>Current release <span>2026-08-05</span>: <span>38,092</span> GO terms | " +
      "<span>15,129,348</span> annotations<br><span>1,783,055</span> gene products | " +
      "<span>172</span> species <span>(<a href=\"/stats.html\">see statistics</a>)</span></p>"
  );
  const p = doc.querySelector("p");
  const line = p.textContent.replace(/\s+/g, " ").trim();
  assert.match(line, /^当前版本 2026-08-05/);
  assert.match(line, /38,092 个 GO 术语/);
  assert.match(line, /15,129,348 条注释/);
  assert.match(line, /1,783,055 个基因产物/);
  assert.match(line, /172 个物种/);
  assert.match(line, /查看统计/);
  assert.equal(doc.querySelector("a").getAttribute("href"), "/stats.html", "统计链接不能改");
  assert.equal(doc.querySelector("a").textContent, "查看统计");
});

test("404 与检索页：空状态整句、检索框、清除按钮", () => {
  const doc = run("geneontology",
    "<main><h1>Oops, that's a no GO ! (404 Page Not Found)</h1>" +
      "<p>The page you are looking for does not exist but you can find what you were looking for below:</p>" +
      "<h2>Search GO Documentation</h2>" +
      '<input placeholder="Search" title="Search"><button>Clear</button></main>'
  );
  assert.equal(doc.querySelector("h1").textContent, "糟糕，此页不存在！（404 页面未找到）");
  assert.equal(
    doc.querySelector("p").textContent,
    "您要查找的页面不存在，但可以在下方找到所需内容："
  );
  assert.equal(doc.querySelector("h2").textContent, "检索 GO 文档");
  assert.equal(doc.querySelector("input[placeholder]").getAttribute("placeholder"), "检索");
  assert.equal(doc.querySelector("button").textContent, "清除");
});

test("文档页标题与标签：本体概览、证据代码名称、下载表头", () => {
  const doc = run("geneontology",
    "<main>" +
      "<h2>GO aspects</h2><h2>Molecular Function</h2><h2>Cellular Component</h2><h2>Biological Process</h2>" +
      "<h2>Root Terms</h2><h2>Mandatory elements</h2><h2>Optional elements</h2>" +
      "<b>Accession (also known as Unique identifier)</b><b>Term name</b><b>Definition</b><b>Synonyms</b><b>Comment</b>" +
      "<h2>Experimental evidence codes</h2>" +
      "<li>Inferred from Experiment (EXP)</li><li>Inferred from Direct Assay (IDA)</li>" +
      "<li>Inferred from High Throughput Mutant Phenotype (HMP)</li><li>Inferred from Electronic Annotation (IEA)</li>" +
      "<h2>Download the ontology</h2>" +
      "<table><thead><tr><th>File Name</th><th>Description</th><th>Download <br>.obo file</th><th>Download <br>.json file</th><th>Download <br>.owl file</th></tr></thead></table>" +
      "<h2>Most users want: go-basic</h2>" +
      "</main>"
  );
  assert.deepEqual(texts(doc, "h2"), [
    "GO 方面", "分子功能", "细胞组分", "生物学过程", "根术语", "必需要素", "可选要素",
    "实验证据代码", "下载本体", "多数用户需要：go-basic"
  ]);
  assert.deepEqual(texts(doc, "b"), ["登录号（又称唯一标识符）", "术语名称", "定义", "同义词", "评论"]);
  assert.deepEqual(texts(doc, "li"), [
    "从实验推断（EXP）", "从直接测定推断（IDA）",
    "从高通量突变表型推断（HMP）", "从电子注释推断（IEA）"
  ]);
  assert.deepEqual(texts(doc, "th"), ["文件名", "描述", "下载 .obo 文件", "下载 .json 文件", "下载 .owl 文件"]);
});

test("文档页固定说明句：InterProScan 推荐句与下载步骤标题", () => {
  const doc = run("geneontology",
    "<main>" +
      '<p>We recommend using <i class="fa"></i> <strong><a href="https://interproscan-docs.readthedocs.io/">InterProScan</a></strong> for unannotated organisms.</p>' +
      "<h2>1. Commonly studied organisms</h2>" +
      "<h2>2. All other organisms</h2>" +
      "<h2>3. If you cannot find annotations for your organism for download as described above</h2>" +
      "<h2>4. If your organism’s genome sequence is not yet publicly available</h2>" +
      "<h3>Required Files</h3><h3>Citing GO</h3><h3>Error or omission?</h3>" +
      "<p>Most tools that use GO annotations take two input files:</p>" +
      "</main>"
  );
  assert.equal(
    doc.querySelector("p").textContent,
    "我们建议使用 InterProScan 处理未注释物种。"
  );
  assert.equal(doc.querySelector("p a").getAttribute("href"), "https://interproscan-docs.readthedocs.io/", "链接不能改");
  assert.deepEqual(texts(doc, "h2"), [
    "1. 常用研究物种", "2. 其他所有物种",
    "3. 如果按上述方法仍找不到可下载的物种注释",
    "4. 如果你的物种基因组序列尚未公开"
  ]);
  assert.deepEqual(texts(doc, "h3"), ["必需文件", "引用 GO", "错误或遗漏？"]);
  assert.equal(texts(doc, "p")[1], "大多数使用 GO 注释的工具需要两个输入文件：");
});

test("下载页表格与格式说明模板：GO 文件格式三种、下载链接文字不动", () => {
  const doc = run("geneontology",
    "<main>" +
      "<p>Gene ontology file formats: Files are available in the <a href='https://owlcollab.github.io/oboformat/doc/obo-syntax.html'>OBO</a>, <a href='https://www.w3.org/TR/owl2-overview/'>OWL</a> and JSON formats. Three versions of the ontology are available as described below.</p>" +
      "<h2>GO subset files</h2><h2>Cross-references of GO to other classification systems</h2>" +
      "<p>Download go-basic.obo - Recommended for most GO annotation tools</p>" +
      "<table><tr><th>File Name</th><th>Description</th><td>go-basic</td><td>NA</td></tr></table>" +
      "</main>"
  );
  assert.equal(
    doc.querySelector("p").textContent,
    "基因本体文件格式：提供 OBO、OWL 和 JSON 格式。本体有三个版本，说明如下。"
  );
  assert.equal(doc.querySelectorAll("p a")[0].textContent, "OBO", "格式名保持原样");
  assert.equal(doc.querySelector("h2").textContent, "GO 子集文件");
  assert.equal(texts(doc, "h2")[1], "GO 与其他分类系统的交叉引用");
  assert.equal(texts(doc, "p")[1], "下载 go-basic.obo — 推荐用于大多数 GO 注释工具");
  assert.deepEqual(texts(doc, "th"), ["文件名", "描述"]);
  assert.deepEqual(texts(doc, "td"), ["go-basic", "NA"], "文件名与 NA 不翻");
});

test("统计页：字段名成对翻译，物种下拉只翻 All", () => {
  const doc = run("geneontology",
    "<main><h1>Release statistics</h1>" +
      "<label>Species filter:</label>" +
      "<select><option>All</option><option>Homo sapiens</option><option>Mus musculus</option></select>" +
      "<table><tr><th>Property</th><th>Value</th></tr>" +
      "<tr><td>Valid terms</td><td>38,092</td></tr>" +
      "<tr><td>Obsoleted terms</td><td>21</td></tr>" +
      "<tr><td>Merged terms</td><td>123</td></tr>" +
      "<tr><td>Number of annotations</td><td>15,129,348</td></tr>" +
      "<tr><td>Annotated species with over 1,000 annotations</td><td>45</td></tr>" +
      "<tr><td>Changes in GO terms between releases</td><td># created</td></tr>" +
      "</table></main>"
  );
  assert.equal(doc.querySelector("h1").textContent, "版本统计");
  assert.equal(doc.querySelector("label").textContent, "物种筛选：");
  assert.deepEqual(texts(doc, "option"), ["全部", "Homo sapiens", "Mus musculus"]);
  assert.deepEqual(texts(doc, "th"), ["属性", "值"]);
  assert.deepEqual(texts(doc, "td"), [
    "有效术语", "38,092", "已弃用术语", "21", "合并术语", "123",
    "注释数", "15,129,348", "注释数超过 1,000 的已注释物种", "45",
    "各版本间 GO 术语的变化", "新建数"
  ]);
});

test("AmiGO 导航、首页工具卡片与固定提示气泡", () => {
  const doc = run("amigo",
    '<nav><a title="The AmiGO 2 landing page.">Home</a>' +
      '<a>Search</a><a>Annotations</a><a>Ontology</a><a>Genes and gene products</a>' +
      '<a>Browse</a><a>Tools &amp; Resources</a><a>Help</a><a>Feedback</a><a>About</a>' +
      '<a title="Gene Ontology front page">AmiGO 2</a></nav>' +
      '<input placeholder="Quick search" title="Hint: add a space after completing a word to narrow the search."><button>Search</button>' +
      "<h3>PubMed Search</h3><p>PubMed ID search takes you to summary information and all GO annotations for the PubMed ID.</p>" +
      "<h3>Search Templates</h3><p>Use predefined templates to explore Gene Ontology data.</p>" +
      "<h3>Advanced Search</h3><p>Interactively search the Gene Ontology data for annotations, gene products, and terms using a powerful search syntax and filters.</p>" +
      "<h3>Browse the Ontology</h3><p>Use the drill-down browser to view the ontology structure with annotation counts.</p>" +
      "<h3>Term Enrichment Service</h3><button>Submit</button>" +
      "<h3>Statistics</h3><p>View the most recent statistics about the Gene Ontology data in AmiGO.</p>" +
      "<h3>And Much More...</h3>"
  );
  assert.deepEqual(texts(doc, "nav a"), [
    "首页", "检索", "注释", "本体", "基因与基因产物", "浏览", "工具与资源", "帮助", "反馈", "关于", "AmiGO 2"
  ]);
  assert.equal(doc.querySelector("nav a").getAttribute("title"), "AmiGO 2 首页。");
  assert.equal(doc.querySelectorAll("nav a")[10].getAttribute("title"), "基因本体首页");
  assert.equal(doc.querySelector("input[placeholder]").getAttribute("placeholder"), "快速检索");
  assert.equal(doc.querySelector("input[placeholder]").getAttribute("title"), "提示：输完一个词后加空格可缩小检索范围。");
  assert.deepEqual(texts(doc, "h3"), [
    "PubMed 检索", "检索模板", "高级检索", "浏览本体", "术语富集服务", "统计", "还有更多……"
  ]);
  assert.equal(texts(doc, "p")[0], "PubMed ID 检索会带您查看该 PubMed ID 的摘要信息和全部 GO 注释。");
  assert.equal(texts(doc, "p")[1], "使用预定义模板探索基因本体数据。");
  assert.equal(texts(doc, "p")[2], "使用强大的检索语法和筛选条件，交互式检索基因本体中的注释、基因产物与术语。");
  assert.equal(texts(doc, "p")[3], "使用逐层浏览视图查看本体结构及注释计数。");
  assert.equal(texts(doc, "p")[4], "查看 AmiGO 中基因本体数据的最新统计。");
  assert.deepEqual(texts(doc, "button"), ["检索", "提交"]);
});

test("AmiGO 检索页：筛选面板、总数规则、分页与结果表表头", () => {
  const doc = run("amigo",
    '<main><h4>Filter results</h4>' +
      "<div>Total term(s): 327; showing: 1-10</div>" +
      "<div>Total annotations: 13360; showing: 1-10</div>" +
      "<table><thead><tr><th>User filters</th><th>Your search is pinned to these filters</th></tr></thead></table>" +
      "<h4>Ontology source</h4><h4>Ontology ID space</h4><div>Nothing to filter.</div><h4>Subset</h4><h4>Obsoletion</h4>" +
      '<textarea placeholder="Free-text filter"></textarea>' +
      "<button>«First</button><button>&lt;Prev</button><button>Next></button><button>Last»</button>" +
      "<button>Custom DL <small>(up to 100000)</small></button><button>Bookmark</button>" +
      "<table><thead><tr><th>Term</th><th>Definition</th><th>Synonyms</th><th>Alt ID</th></tr></thead></table>" +
      "<button>more...</button><button>less</button></main>"
  );
  assert.equal(texts(doc, "h4")[0], "筛选结果");
  assert.equal(texts(doc, "div")[0], "术语总数：327；显示：1-10");
  assert.equal(texts(doc, "div")[1], "注释总数：13360；显示：1-10");
  assert.deepEqual(texts(doc, "th"), ["用户筛选条件", "您的检索固定使用以下筛选条件", "术语", "定义", "同义词", "备用 ID"]);
  assert.equal(texts(doc, "h4")[1], "本体来源");
  assert.equal(texts(doc, "h4")[2], "本体 ID 空间");
  assert.equal(texts(doc, "div")[2], "没有可筛选的内容。");
  assert.equal(texts(doc, "h4")[3], "子集");
  assert.equal(texts(doc, "h4")[4], "弃用");
  assert.equal(doc.querySelector("textarea").getAttribute("placeholder"), "自由文本筛选");
  assert.deepEqual(texts(doc, "button"), [
    "«首页", "‹上一页", "下一页›", "末页»", "自定义下载（最多 100000 条）", "书签", "更多…", "收起"
  ]);
});

test("AmiGO 条目页：术语信息区、注释表表头与父/子术语标题规则", () => {
  const doc = run("amigo",
    "<main><h1>apoptotic process</h1>" +
      "<h4>Term Information</h4>" +
      "<b>Accession</b><b>Name</b><b>Synonyms</b><b>Alternate IDs</b><b>Definition</b><b>Comment</b><b>History</b>" +
      "<h4>Graph Views</h4><h4>Inferred Tree View</h4><h4>Neighborhood</h4><h4>Mappings</h4>" +
      "<h4>Parents of apoptotic process (GO:0006915)</h4>" +
      "<h4>Children of apoptotic process (GO:0006915)</h4>" +
      "<table><thead><tr><th>Gene/product</th><th>Gene/product name</th><th>Evidence with</th><th>Isoform</th><th>Reference</th><th>Date</th></tr></thead></table>" +
      "<table><thead><tr><th>Ontology (aspect)</th><th>Organism</th><th>Type</th><th>Evidence</th><th>Contributor</th></tr></thead></table>" +
      "<table><thead><tr><th>GO class (including \"regulates\")</th><th>GO class (direct)</th><th>Annotation qualifier</th><th>Annotation extension</th><th>PANTHER family</th></tr></thead></table>" +
      "<p>View this term in<a href='https://www.ebi.ac.uk/QuickGO/term/GO:0006915'>QuickGO</a></p>" +
      '<img alt="Graph of GO:0006915 from QuickGO">' +
      "</main>"
  );
  assert.equal(doc.querySelector("h1").textContent, "apoptotic process", "GO 术语名保持原样");
  assert.equal(texts(doc, "h4")[0], "术语信息");
  assert.deepEqual(texts(doc, "b"), ["登录号", "名称", "同义词", "备用 ID", "定义", "评论", "历史"]);
  assert.deepEqual(texts(doc, "h4").slice(1), [
    "图形视图", "推断树视图", "邻域", "映射",
    "父术语：apoptotic process（GO:0006915）",
    "子术语：apoptotic process（GO:0006915）"
  ]);
  assert.deepEqual(texts(doc, "th").slice(0, 6), ["基因/产物", "基因/产物名称", "证据", "异构体", "参考", "日期"]);
  assert.deepEqual(texts(doc, "th").slice(6, 11), ["本体（方面）", "物种", "类型", "证据", "贡献者"]);
  assert.deepEqual(texts(doc, "th").slice(11), ["GO 类（含“调节”）", "GO 类（直接）", "注释限定词", "注释扩展", "PANTHER 家族"]);
  assert.match(texts(doc, "p")[0], /^在以下位置查看此术语/);
  assert.equal(doc.querySelector("p a").getAttribute("href"), "https://www.ebi.ac.uk/QuickGO/term/GO:0006915", "QuickGO 链接不能改");
});

test("数据不动：GO 登录号、基因名、物种学名、蛋白 accession 与 URL", () => {
  const doc = run("amigo",
    "<table><tr><td>GO:0006915</td><td>GO:0008150</td><td>apoptotic process</td>" +
      "<td>Homo sapiens</td><td>Mus musculus</td><td>UniProtKB:Q76MJ5</td>" +
      "<td>PMID:21494263</td><td>10.1038/s41588-019-0500-1</td>" +
      '<td><a href="https://amigo.geneontology.org/amigo/term/GO:0006915">GO:0006915</a></td></tr></table>'
  );
  assert.deepEqual(texts(doc, "td"), [
    "GO:0006915", "GO:0008150", "apoptotic process", "Homo sapiens", "Mus musculus",
    "UniProtKB:Q76MJ5", "PMID:21494263", "10.1038/s41588-019-0500-1", "GO:0006915"
  ]);
  assert.equal(doc.querySelector("a").getAttribute("href"), "https://amigo.geneontology.org/amigo/term/GO:0006915");
});
