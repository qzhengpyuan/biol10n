// AlphaFold DB 词库（alphafold）回归：首页 / 条目页与检索结果 / 下载页 / API 文档 / FAQ 与关于页标题
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/alphafold.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;

// config/sites.json 里还没有 alphafold 条目时用等价定义兜底；正式条目写进去后自动改用真实配置。
const site = sites.find((s) => s.id === "alphafold") || {
  id: "alphafold",
  hosts: ["alphafold.ebi.ac.uk"],
  dicts: ["common", "string-atlas", "alphafold"],
  scope: "body"
};

function stackData() {
  const data = { exact: {}, rules: [], templates: [] };
  for (const id of site.dicts) {
    let b;
    try {
      b = JSON.parse(fs.readFileSync(path.join(root, "../dict", id + ".json"), "utf8"));
    } catch (e) {
      continue;
    }
    Object.assign(data.exact, b.exact || {});
    data.rules = data.rules.concat(b.rules || []);
    data.templates = data.templates.concat(b.templates || []);
  }
  return data;
}

function run(html) {
  const dom = new JSDOM(html);
  const engine = createEngine({ document: dom.window.document, window: dom.window, data: stackData(), site });
  engine.start();
  return dom.window.document;
}

test("词库结构：条数、键值形态、规则可编译、模板槽位连续", () => {
  assert.equal(book.meta.family, "alphafold");
  assert.ok(book.meta.sites.includes("alphafold.ebi.ac.uk"));
  assert.ok(Object.keys(book.exact).length >= 150, "exact 至少 150 条");
  assert.ok(book.rules.length >= 12, "rules 至少 12 条");
  assert.ok(Array.isArray(book.templates) && book.templates.length >= 3, "templates 至少 3 条");

  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "键里不能有中文: " + k);
    assert.ok(/[\u4e00-\u9fff]/.test(v), "译文里必须有中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "键首尾不能有空白: " + JSON.stringify(k));
  }
  for (const r of book.rules) {
    assert.ok(new RegExp(r.re).source.length > 0);
    assert.ok(/[\u4e00-\u9fff]/.test(r.to), "规则译文里必须有中文: " + r.re);
  }
  for (const t of book.templates) {
    const used = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.ok(used.length >= 1, "模板要带槽位: " + t.pat);
    used.slice().sort((a, b) => a - b).forEach((n, i) => assert.equal(n, i + 1, "槽位必须从 1 连续: " + t.pat));
    const zhUsed = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.deepEqual(zhUsed.slice().sort((a, b) => a - b), used.slice().sort((a, b) => a - b), "译文槽位要与原文一致");
  }
});

test("首页：站点导航、主按钮与固定区块标题", () => {
  const doc = run(
    '<nav class="navbar"><a href="/">EMBL-EBI home</a><a href="/about">About</a><a href="/faqs">FAQs</a>' +
      '<a href="/download">Downloads</a><a href="/api-docs">API</a><a href="/collaborators">Collaborators</a></nav>' +
      '<div class="hero"><h1>AlphaFold</h1><p>Developed by Google DeepMind and EMBL-EBI</p>' +
      '<button>Browse data</button><a href="/training">Go to online course</a><a href="/search-help">See search help</a></div>' +
      "<section><h2>Pandemic Preparedness</h2><h2>Antimicrobial Resistance (AMR)</h2>" +
      "<h2>Neglected Tropical Diseases (NTDs)</h2><h2>WHO Global Health Proteomes</h2>" +
      "<h3>Background</h3><a>View protein</a><a>Find out more</a></section>"
  );
  const nav = [...doc.querySelectorAll("nav a")].map((e) => e.textContent);
  assert.deepEqual(nav, ["EMBL-EBI 主页", "关于", "常见问题", "下载", "API", "合作机构"]);
  assert.equal(doc.querySelector(".hero p").textContent, "由 Google DeepMind 与 EMBL-EBI 开发");
  assert.equal(doc.querySelector("button").textContent, "浏览数据");
  assert.equal(doc.querySelectorAll(".hero a")[0].textContent, "前往在线课程");
  assert.equal(doc.querySelectorAll(".hero a")[1].textContent, "查看检索帮助");
  const hs = [...doc.querySelectorAll("section h2")].map((e) => e.textContent);
  assert.deepEqual(hs, ["大流行病防范", "抗微生物药物耐药性（AMR）", "被忽视的热带病（NTDs）", "WHO 全球健康蛋白质组"]);
  assert.equal(doc.querySelector("section h3").textContent, "背景");
  assert.deepEqual([...doc.querySelectorAll("section a")].map((e) => e.textContent), ["查看蛋白质", "了解更多"]);
});

test("条目页：信息行字段名与计数规则（包含 / 实验结构）", () => {
  const doc = run(
    '<div class="info">' +
      '<div class="info-row"><span>Protein</span><article><span>Cellular tumor antigen p53</span></article></div>' +
      '<div class="info-row"><span>Gene</span><article><span>TP53</span></article></div>' +
      '<div class="info-row"><span>Source organism</span><article><span>Homo sapiens (Human) <a>go to search</a></span></article></div>' +
      '<div class="info-row"><span>UniProt</span><article><span>P04637 <a>go to UniProt</a></span></article></div>' +
      '<div class="info-row"><span>Biological function</span><article><span>Multifunctional transcription factor</span></article></div>' +
      '<div class="info-row"><span>Found in</span><article><span> 9 entries in AFDB <a>go to search</a></span></article></div>' +
      '<div class="info-row"><span>Experimental structures</span><article><span>321 structures in PDB for P04637 <a>go to PDBe-KB</a></span></article></div>' +
      "</div>"
  );
  const labels = [...doc.querySelectorAll(".info-row > span")].map((e) => e.textContent);
  assert.deepEqual(labels, ["蛋白质", "基因", "来源物种", "UniProt", "生物学功能", "收录于", "实验结构"]);
  const rows = [...doc.querySelectorAll("article")].map((e) => e.textContent.replace(/\s+/g, " ").trim());
  assert.equal(rows[2], "Homo sapiens (Human) 前往检索");
  assert.equal(rows[3], "P04637 前往 UniProt");
  assert.equal(rows[5], "9 个 AFDB 条目前往检索");
  assert.equal(rows[6], "P04637 在 PDB 中的结构（321 个） 前往 PDBe-KB");
});

test("条目页：标签页、pLDDT 分档与结构域标题", () => {
  const doc = run(
    '<div class="tabs"><span>Summary and Model Confidence</span><span>Domains</span><span>Annotations</span>' +
      "<span>Text Annotations (AI)</span><span>Similar Proteins</span><span>New</span></div>" +
      '<div class="plddt"><span>Average pLDDT</span><b>75.06 (High)</b><span>pLDDT distribution</span>' +
      "<div><span>52.7% Very high</span><span>7.1% High</span><span>10.4% Low</span><span>29.8% Very low</span></div></div>" +
      '<div class="legend"><span>Very high (pLDDT &gt; 90)</span><span>High (90 &gt; pLDDT &gt; 70)</span>' +
      "<span>Low (70 &gt; pLDDT &gt; 50)</span><span>Very low (pLDDT &lt; 50)</span></div>" +
      '<span class="pae-title">Predicted Aligned Error (PAE)</span>' +
      '<div class="domains"><h3>Domains (1)</h3></div><button>Copy sequence</button>'
  );
  const tabs = [...doc.querySelectorAll(".tabs span")].map((e) => e.textContent);
  assert.deepEqual(tabs, ["摘要与模型置信度", "结构域", "注释", "文本注释（AI）", "相似蛋白", "新增"]);
  assert.equal(doc.querySelector(".plddt b").textContent, "75.06（高）");
  assert.deepEqual([...doc.querySelectorAll(".plddt div span")].map((e) => e.textContent), [
    "52.7%（极高）",
    "7.1%（高）",
    "10.4%（低）",
    "29.8%（极低）"
  ]);
  assert.deepEqual([...doc.querySelectorAll(".legend span")].map((e) => e.textContent), [
    "极高（pLDDT > 90）",
    "高（90 > pLDDT > 70）",
    "低（70 > pLDDT > 50）",
    "极低（pLDDT < 50）"
  ]);
  assert.equal(doc.querySelector(".pae-title").textContent, "预测比对误差（PAE）");
  assert.equal(doc.querySelector(".domains h3").textContent, "结构域（1）");
  assert.equal(doc.querySelector("button").textContent, "复制序列");
});

test("检索结果页：分页、筛选分档与结果卡字段", () => {
  const doc = run(
    '<div class="results"><h2>Showing all search results for P04637</h2>' +
      '<div class="count">1 - 9 of 9 results</div>' +
      '<div class="filter"><span>Entry type</span><label><span>Monomers (9)</span></label>' +
      '<span>Status</span><label><span>Reviewed (Swiss-Prot) (9)</span></label>' +
      "<span>Reference proteome</span>" +
      "<label><span>Show predictions for sequences found only in UniProt reference proteomes  (9)</span></label>" +
      "<span>Organisms</span><span>Popular</span><span>Global quality score</span><span>Average pLDDT</span>" +
      "<button>Apply range</button></div>" +
      '<div class="card"><span>Monomer</span><span>AF-P04637-F1</span><span>Version v6</span>' +
      "<span>Google DeepMind dataset</span><span>Sequence length</span><b>214</b>" +
      "<span>Global quality</span><span>average pLDDT</span><b>82.94 (High)</b><a>go to PDBe-KB</a></div></div>"
  );
  assert.equal(doc.querySelector("h2").textContent, "显示 P04637 的全部检索结果");
  assert.equal(doc.querySelector(".count").textContent, "1 - 9，共 9 条结果");
  const filterTexts = [...doc.querySelectorAll(".filter span")].map((e) => e.textContent);
  assert.deepEqual(filterTexts, [
    "条目类型",
    "单体（9）",
    "状态",
    "已审核（Swiss-Prot）（9）",
    "参考蛋白质组",
    "只显示 UniProt 参考蛋白质组中序列的预测（9）",
    "物种",
    "热门",
    "全局质量评分",
    "平均 pLDDT"
  ]);
  assert.equal(doc.querySelector(".filter button").textContent, "应用范围");
  const card = [...doc.querySelectorAll(".card > span")].map((e) => e.textContent);
  assert.deepEqual(card, ["单体", "AF-P04637-F1", "版本 v6", "Google DeepMind 数据集", "序列长度", "全局质量", "平均 pLDDT"]);
  assert.equal(doc.querySelector(".card b:last-of-type").textContent, "82.94（高）");
});

test("下载页：表头、下载按钮与 Swiss-Prot 分节", () => {
  const doc = run(
    "<h2>Model organism proteomes</h2><h2>Global health proteomes</h2>" +
      "<p>Compressed prediction files for model organism proteomes:</p>" +
      '<table><thead><tr><th>Species</th><th>Common Name</th><th>Reference Proteome</th>' +
      "<th>Predicted Structures</th><th>Download</th></tr></thead>" +
      "<tbody><tr><td>Homo sapiens</td><td>Human</td><td>UP000005640</td><td>23,586</td>" +
      '<td><a href="/download/UP000005640">Download (4,938 MB)</a></td></tr></tbody></table>' +
      "<h2>Compressed prediction files for Swiss-Prot:</h2>" +
      "<table><tr><th>File type</th><th>Predicted Structures</th><th>Download</th></tr>" +
      "<tr><td>Swiss-Prot (CIF files)</td><td>550,122</td><td>Download (38,207 MB)</td></tr></table>"
  );
  assert.deepEqual([...doc.querySelectorAll("h2")].map((e) => e.textContent), [
    "模式生物蛋白质组",
    "全球健康蛋白质组",
    "Swiss-Prot 的压缩预测文件："
  ]);
  assert.equal(doc.querySelector("p").textContent, "模式生物蛋白质组的压缩预测文件：");
  const th = [...doc.querySelectorAll("thead th")].map((e) => e.textContent);
  assert.deepEqual(th, ["物种", "常用名", "参考蛋白质组", "预测结构数", "下载"]);
  assert.equal(doc.querySelector("tbody td").textContent, "Homo sapiens", "物种学名不翻");
  assert.equal(doc.querySelector("tbody a").textContent, "下载（4,938 MB）");
  assert.equal(doc.querySelector("tbody a").getAttribute("href"), "/download/UP000005640", "下载链接不能改");
  const lastRow = [...doc.querySelectorAll("table:last-of-type td")].map((e) => e.textContent);
  assert.equal(lastRow[0], "Swiss-Prot（CIF 文件）");
  assert.equal(lastRow[2], "下载（38,207 MB）");
});

test("API 文档页：端点说明、Schemas 与固定介绍段", () => {
  const doc = run(
    "<h2>Programmatic access API endpoints</h2><span>1.0.0</span><span>OAS3</span>" +
      "<p>Welcome to the interactive documentation page for the AlphaFold Protein Structure Database Application Programming Interface (API). The API provides a convenient and efficient way for developers to programmatically access metadata related to all the archived AlphaFold predictions.</p>" +
      '<div class="op"><span>GET</span><span>/prediction/{qualifier}</span><p>Get all models for a UniProt accession or a model ID</p></div>' +
      '<div class="op"><span>GET</span><span>/complex/{qualifier}</span><p>Get complex details for a UniProt accession or a model ID</p></div>' +
      '<div class="op"><span>GET</span><span>/sequence/summary</span><p>Get Sequence Summary</p></div>' +
      "<h3>Schemas</h3><span>AnnotationResponse</span><span>ModelFormat</span>"
  );
  assert.equal(doc.querySelector("h2").textContent, "程序化访问 API 端点");
  const ps = [...doc.querySelectorAll("p")].map((e) => e.textContent);
  assert.ok(ps[0].startsWith("欢迎使用 AlphaFold 蛋白质结构数据库应用程序接口（API）的交互式文档页面。"));
  assert.ok(ps[0].endsWith("以程序化访问所有已归档 AlphaFold 预测的相关元数据。"));
  assert.equal(ps[1], "获取某个 UniProt 登录号或模型 ID 的全部模型");
  assert.equal(ps[2], "获取某个 UniProt 登录号或模型 ID 的复合物详情");
  assert.equal(ps[3], "获取序列摘要");
  assert.equal(doc.querySelector("h3").textContent, "数据结构");
  assert.deepEqual([...doc.querySelectorAll(".op span")].map((e) => e.textContent), [
    "GET",
    "/prediction/{qualifier}",
    "GET",
    "/complex/{qualifier}",
    "GET",
    "/sequence/summary"
  ], "HTTP 方法与路径是标识，保持原样");
});

test("模板：许可句整段替换，链接与 href 保留", () => {
  const doc = run(
    '<p class="licence">Data is available for academic and commercial use, under a ' +
      '<a href="https://creativecommons.org/licenses/by/4.0/">CC-BY-4.0</a> licence.</p>'
  );
  const p = doc.querySelector("p");
  assert.equal(p.textContent, "CC-BY-4.0 许可下，数据可供学术与商业使用。");
  const a = p.querySelector("a");
  assert.equal(a.textContent, "CC-BY-4.0");
  assert.equal(a.getAttribute("href"), "https://creativecommons.org/licenses/by/4.0/", "链接地址不能改");
});

test("控件属性：搜索框 placeholder 与查看器 title 提示", () => {
  const doc = run(
    '<input id="q" placeholder="Search for protein, gene, UniProt accession or organism or sequence search">' +
      '<button title="Report an issue">?</button>' +
      '<span title="Screenshot / State Snapshot"></span>' +
      '<span title="Toggle Expanded Viewport"></span>'
  );
  assert.equal(doc.querySelector("input").getAttribute("placeholder"), "搜索蛋白质、基因、UniProt 登录号、物种，或进行序列检索");
  assert.equal(doc.querySelector("button").getAttribute("title"), "报告问题");
  assert.equal(doc.querySelectorAll("span")[0].getAttribute("title"), "截图/状态快照");
  assert.equal(doc.querySelectorAll("span")[1].getAttribute("title"), "切换扩展视口");
});

test("Mol* 查看器控件与 WebGL 提示", () => {
  const doc = run(
    "<div class='viewer'><button>Fullscreen</button><button>Reset Zoom</button><button>Orient Axes</button>" +
      "<button>Export Animation</button><button>Load File(s)</button><button>Measurements</button>" +
      "<span>Nothing Loaded</span><span>Nothing Focused</span></div>" +
      "<p>WebGL does not seem to be available.</p>" +
      "<p>This can be caused by an outdated browser, graphics card driver issue, or bad weather. Sometimes, just restarting the browser helps. Also, make sure hardware acceleration is enabled in your browser.</p>"
  );
  const btns = [...doc.querySelectorAll(".viewer button")].map((e) => e.textContent);
  assert.deepEqual(btns, ["全屏", "重置缩放", "定向坐标轴", "导出动画", "载入文件", "测量"]);
  assert.deepEqual([...doc.querySelectorAll(".viewer span")].map((e) => e.textContent), ["未载入对象", "无聚焦对象"]);
  const ps = [...doc.querySelectorAll("p")].map((e) => e.textContent);
  assert.equal(ps[0], "WebGL 似乎不可用。");
  assert.equal(ps[1], "原因可能是浏览器过旧、显卡驱动问题，或天气不好。有时重启浏览器即可解决。另请确认浏览器已启用硬件加速。");
});

test("首页 CTA：培训与常见问题入口（列表型链接文本）", () => {
  const doc = run(
    '<div class="cta"><a>Online training course</a><a>View all frequently asked questions</a><a>View all on-demand training</a></div>'
  );
  assert.deepEqual([...doc.querySelectorAll(".cta a")].map((e) => e.textContent), [
    "在线培训课程",
    "查看全部常见问题",
    "查看全部按需培训"
  ]);
});

test("帮助与关于页标题（含弯引号原文）", () => {
  const doc = run(
    "<h1>Frequently asked questions</h1><button>Collapse all</button>" +
      "<h3>How does AlphaFold work?</h3>" +
      "<h3>What if I can’t find the protein I’m interested in?</h3>" +
      "<h3>How can I download and use the Predicted Aligned Error (PAE) file?</h3>" +
      "<h3>What is The Encyclopedia of Domains (TED)?</h3>" +
      "<h2>Paper &amp; methodologies</h2>" +
      "<h3>Why does being able to predict a protein’s 3D structure matter?</h3>" +
      "<h3>What’s new?</h3><h2>About Google DeepMind</h2>"
  );
  const hs = [...doc.querySelectorAll("h1, h2, h3")].map((e) => e.textContent);
  assert.deepEqual(hs, [
    "常见问题",
    "AlphaFold 是如何工作的？",
    "如果找不到感兴趣的蛋白质怎么办？",
    "如何下载并使用预测比对误差（PAE）文件？",
    "结构域百科（TED）是什么？",
    "论文与方法",
    "为什么能够预测蛋白质的三维结构很重要？",
    "最新动态",
    "关于 Google DeepMind"
  ]);
  assert.equal(doc.querySelector("button").textContent, "全部收起");
});

test("数据不动：登录号、基因名、物种、条目标题、邮箱、数值", () => {
  const doc = run(
    '<div class="meta"><span>AF-P04637-F1</span><span>P04637</span><span>TP53</span><span>Homo sapiens</span>' +
      "<span>82.94</span><span>10.2210/pdb1cbs/pdb</span>" +
      '<a href="mailto:alphafold@deepmind.com">alphafold@deepmind.com</a>' +
      "<span>Cellular tumor antigen p53</span><span>214</span></div>"
  );
  const texts = [...doc.querySelectorAll(".meta span")].map((e) => e.textContent);
  assert.deepEqual(texts, ["AF-P04637-F1", "P04637", "TP53", "Homo sapiens", "82.94", "10.2210/pdb1cbs/pdb", "Cellular tumor antigen p53", "214"]);
  assert.equal(doc.querySelector("a").textContent, "alphafold@deepmind.com");
});

test("帮助：检索建议整句、三条建议 LI 与 previous FAQ 链接模板", () => {
  const doc = run(
    '<div class="faq-content"><h3>What if I can’t find the protein I’m interested in?</h3>' +
      "<p>If you can’t find the structure you’re looking for, here are some suggestions to improve your search results:</p>" +
      "<ul>" +
      "<li>Try searching by protein or gene name rather than specific UniProt accession.</li>" +
      "<li>If running a sequence search, the input query should contain at least 20 amino acids, and only standard amino acids are accepted.</li>" +
      "<li>Sequence search is the most reliable method for finding entries, especially since many proteins don’t have a specific name.</li>" +
      '<li>Check that the protein or complex isn’t excluded by any of the criteria coveredin a <a href="/faq#faq-4">previous FAQ</a>.</li>' +
      "</ul>" +
      '<p>Not all proteins or complexes are included in the AlphaFold DB. In some cases, you may need to generate a prediction separately using the <a href="https://github.com/google-deepmind/alphafold">source code</a>, which supports predicting multimer structures.</p>' +
      "</div>"
  );
  assert.equal(doc.querySelector("h3").textContent, "如果找不到感兴趣的蛋白质怎么办？");
  assert.equal(
    doc.querySelector(".faq-content > p").textContent,
    "如果找不到你要的结构，可参考以下建议改进检索结果："
  );
  assert.deepEqual([...doc.querySelectorAll("li")].map((e) => e.textContent), [
    "尝试用蛋白质或基因名称检索，而不是具体的 UniProt 登录号。",
    "如果进行序列检索，输入的查询应至少包含 20 个氨基酸，且只接受标准氨基酸。",
    "序列检索是查找条目最可靠的方法，尤其因为许多蛋白质并没有特定名称。",
    "请确认该蛋白质或复合物未被上一个常见问题中列出的任一标准排除。"
  ]);
  const faqA = doc.querySelectorAll("li a")[0];
  assert.equal(faqA.textContent, "上一个常见问题");
  assert.equal(faqA.getAttribute("href"), "/faq#faq-4", "链接地址不能改");
  const tail = doc.querySelectorAll(".faq-content > p")[1];
  assert.equal(
    tail.textContent,
    "并非所有蛋白质或复合物都收录在 AlphaFold DB 中。某些情况下，你需要用源代码单独生成预测，它支持预测多聚体结构。"
  );
  assert.equal(tail.querySelector("a").getAttribute("href"), "https://github.com/google-deepmind/alphafold");
});

test("帮助：PAE 文件格式四段固定说明（字段名保留英文）", () => {
  const doc = run(
    "<p>The PAE is displayed as an interactive plot for each of the structure predictions. If you need the raw data with PAE for all residue pairs, you can download the PAE as a JSON file using the button at the top of the structure page.</p>" +
      "<p>This file is in a custom format and it isn’t supported by any existing software – you will have to use Python or another programming language to analyse or plot the information that is contained in it.</p>" +
      '<p>We updated the PAE JSON file format on 28th July 2022 to reduce file size by 4x. Please ensure you read the 2D matrix of PAE values from the predicted_aligned_error field instead of the removed 1D "distances" field and avoid using the old "residue1" and "residue2" fields.</p>' +
      '<p>If you are using a script or third party tool to read the PAE JSON file programmatically and you are seeing errors (e.g. missing field "distance"), check with the author of the program whether the latest PAE JSON format is supported.</p>'
  );
  const ps = [...doc.querySelectorAll("p")].map((e) => e.textContent);
  assert.equal(ps[0], "每个结构预测的 PAE 都会以交互式图表显示。若需要包含所有残基对 PAE 的原始数据，可用结构页顶部的按钮把 PAE 下载为 JSON 文件。");
  assert.equal(ps[1], "该文件采用自定义格式，现有软件均不支持 – 你需要用 Python 或其他编程语言分析或绘制其中的信息。");
  assert.ok(ps[2].startsWith("我们已于 2022 年 7 月 28 日更新 PAE JSON 文件格式"), ps[2]);
  assert.ok(ps[2].includes("从 predicted_aligned_error 字段读取"), "字段名保留英文");
  assert.ok(ps[2].endsWith('避免使用旧的 "residue1" 与 "residue2" 字段。'), ps[2]);
  assert.ok(ps[3].includes('缺少 "distance" 字段'), "字段名保留英文");
  assert.ok(ps[3].endsWith("是否支持最新的 PAE JSON 格式。"));
});

test("首页：取数报错态与 AI 注释发布说明（What’s new）", () => {
  const doc = run(
    '<div class="error-banner">Currently, we are experiencing an issue fetching data. Please try again later.</div>' +
      "<p>AI-derived residue annotations – October 2026</p>" +
      "<p>AlphaFold Database now integrates AI-derived residue-level annotations from the scientific literature, providing biological context for individual residues alongside predicted protein structures. A transformer-based named entity recognition (NER) model identifies protein residues and point mutations in structural biology publications and links experimentally supported annotations to UniProt reference sequences.</p>" +
      "<p>Annotations are transferred from experimentally validated PDB structures to AlphaFold models using the SIFTS framework, ensuring that literature-derived residue annotations are supported by experimental evidence.</p>" +
      "<p>This release enables users to navigate directly from residues in AlphaFold predictions to publications describing their function, interactions, and experimentally observed mutations, making it easier to interpret predicted structures in their biological context.</p>" +
      '<p class="img-caption"><a href="/faq#faq-45">Learn how residue function annotations are generated and mapped to AlphaFold structures</a></p>'
  );
  assert.equal(doc.querySelector(".error-banner").textContent, "目前我们在获取数据时遇到问题。请稍后重试。");
  const ps = [...doc.querySelectorAll("p")].map((e) => e.textContent);
  assert.equal(ps[0], "AI 生成的残基注释 – 2026 年 10 月");
  assert.ok(ps[1].startsWith("AlphaFold 数据库现已整合来自科学文献的 AI 生成残基级注释"), ps[1]);
  assert.ok(ps[1].endsWith("并把有实验支持的注释链接到 UniProt 参考序列。"), ps[1]);
  assert.ok(ps[2].startsWith("注释通过 SIFTS 框架从经实验验证的 PDB 结构转移到 AlphaFold 模型"), ps[2]);
  assert.ok(ps[3].startsWith("本次发布让用户可以从 AlphaFold 预测中的残基直接跳转"), ps[3]);
  assert.equal(ps[4], "了解残基功能注释如何生成并映射到 AlphaFold 结构");
  assert.equal(doc.querySelector(".img-caption a").getAttribute("href"), "/faq#faq-45");
});

test("帮助：检索框四示例、反馈邮箱与许可条款（多槽位模板）", () => {
  const doc = run(
    '<p class="q1">The search bar at the top of the page accepts queries based on protein name (e.g. <a>Free fatty acid receptor 2</a>), gene name (e.g. <a>At1g58602</a>), UniProt accession (e.g. <a>Q9I1F6</a>), or organism name (e.g. <a href="./search/organismScientificName/x">E. coli</a>).</p>' +
      '<p class="q2">We would love to hear your feedback and understand how the database has been useful in your research. Share your stories with us at <a href="mailto:alphafold@deepmind.com">alphafold@deepmind.com</a>.</p>' +
      '<p class="q3">Data is available for academic and commercial use, under a Creative Commons Attribution 4.0 (<a href="https://creativecommons.org/licenses/by/4.0/">CC-BY 4.0</a>) licence terms.</p>'
  );
  assert.equal(
    doc.querySelector(".q1").textContent,
    "页面顶部的检索框接受基于蛋白质名称（如 Free fatty acid receptor 2）、基因名称（如 At1g58602）、UniProt 登录号（如 Q9I1F6）或物种名称（如 E. coli）的检索。"
  );
  assert.deepEqual([...doc.querySelectorAll(".q1 a")].map((e) => e.textContent), [
    "Free fatty acid receptor 2",
    "At1g58602",
    "Q9I1F6",
    "E. coli"
  ], "蛋白质名 / 基因名 / 登录号 / 物种名不翻");
  assert.equal(doc.querySelectorAll(".q1 a")[3].getAttribute("href"), "./search/organismScientificName/x");
  assert.equal(
    doc.querySelector(".q2").textContent,
    "我们很希望听到你的反馈，了解该数据库在你的研究中发挥了哪些作用。欢迎把故事分享到 alphafold@deepmind.com。"
  );
  assert.equal(doc.querySelector(".q2 a").getAttribute("href"), "mailto:alphafold@deepmind.com");
  assert.equal(doc.querySelector(".q3").textContent, "在知识共享署名 4.0（CC-BY 4.0）许可条款下，数据可供学术与商业使用。");
  assert.equal(doc.querySelector(".q3 a").getAttribute("href"), "https://creativecommons.org/licenses/by/4.0/");
});

test("帮助：结构页标签、TED、AlphaMissense 与 mmCIF 说明等固定句", () => {
  const doc = run(
    "<p>When browsing search results, each entry displays key information to help you identify and prioritise the most relevant structures.</p>" +
      "<p>From the main search page, you can browse entries by the following categories:</p>" +
      "<p>Structure pages for multimers have five tabs: Summary and Model Confidence, Macromolecules, Domains, Annotations, and Similar Proteins. The Summary and Model Confidence tab displays basic information about the complex (drawn from UniProt where available), together with AlphaFold prediction outputs and confidence measures.</p>" +
      "<p>TED provides a powerful framework for understanding how protein domains are organised and it is a valuable resource for evolutionary, structural and functional studies.</p>" +
      "<p>Note that AlphaMissense does not predict the change in protein structure, or biophysical properties such as stability, upon mutation. Instead, it uses related protein sequences and protein structure as contextual information to estimate pathogenicity.</p>" +
      "<p>Note that the PDB and mmCIF files contain coordinates for all regions, regardless of their pLDDT score. It is up to the user to interpret the model judiciously, in accordance with the guidance above.</p>"
  );
  const ps = [...doc.querySelectorAll("p")].map((e) => e.textContent);
  assert.equal(ps[0], "浏览检索结果时，每个条目都会显示关键信息，帮助你识别并优先关注最相关的结构。");
  assert.equal(ps[1], "在主检索页面上，你可以按以下类别浏览条目：");
  assert.ok(ps[2].startsWith("多聚体的结构页有五个标签页：摘要与模型置信度、大分子、结构域、注释与相似蛋白。"), ps[2]);
  assert.ok(ps[3].startsWith("TED 为理解蛋白质结构域如何组织提供了有力框架"), ps[3]);
  assert.ok(ps[4].startsWith("注意 AlphaMissense 不预测突变后蛋白质结构的变化"), ps[4]);
  assert.ok(ps[5].startsWith("注意 PDB 与 mmCIF 文件包含所有区域的坐标"), ps[5]);
});

test("首页：门户卡片说明、EMBL-EBI 署名句与数据集说明", () => {
  const doc = run(
    '<div class="portal"><span>Pandemic Preparedness</span>' +
      "<p>Protein structure predictions from human and animal viruses with pandemic potential to support research on viral mechanisms, vaccines, and antiviral development.</p></div>" +
      '<div class="portal"><p>Protein structure predictions from the 30 WHO priority global health proteomes. Supports research on pathogens of major global public health importance.</p></div>' +
      "<p>EMBL-EBI expects attribution (e.g., in publications, services, or products) for any of its online services, databases, or software in accordance with good scientific practice.</p>" +
      "<p>Note: A given structure may be associated with further publications. For authoritative information regarding the relevant publication(s), please consult the dataset collection or the structure metadata provided on the entry page.</p>"
  );
  assert.equal(doc.querySelector(".portal span").textContent, "大流行病防范");
  const desc = [...doc.querySelectorAll(".portal p")].map((e) => e.textContent);
  assert.equal(desc[0], "来自具有大流行潜力的人类与动物病毒的蛋白质结构预测，用于支持病毒机制、疫苗与抗病毒药物研发等研究。");
  assert.equal(desc[1], "来自 30 个 WHO 重点全球健康蛋白质组的蛋白质结构预测。支持对具有重大全球公共卫生意义的病原体的研究。");
  const tail = [...doc.querySelectorAll("p")].slice(-2).map((e) => e.textContent);
  assert.ok(tail[0].startsWith("按照良好科学实践，EMBL-EBI 期望其任何在线服务"), tail[0]);
  assert.ok(tail[1].startsWith("注意：某个结构可能还关联其他出版物。"), tail[1]);
});

test("帮助：数据集提交与开放工具包说明（长句模板保留链接）", () => {
  const doc = run(
    '<p>Eligible datasets must use AlphaFold 2 or AlphaFold multimer and be on a coherent theme. To apply to contribute a dataset or check with the AFDB team if your data qualify, please email <a href="mailto:afdbhelp@ebi.ac.uk">afdbhelp@ebi.ac.uk</a> describing the nature and quality of your dataset and providing a scientific justification for including them in the database. If the dataset is deemed suitable for integration into AFDB, we will contact the contributing team and will follow up with the submitter for additional information.</p>' +
      '<p>We do not currently have functionality to deposit individual structure predictions. If you have generated AlphaFold structure predictions that you would like to make available to the community, you can take a look at the <a href="https://rdmkit.elixir-europe.org/structural_bioinformatics.html">Research Data Management</a> kit being developed by the ELIXIR 3D-BioInfo community that describes guidelines on how to make models and the relevant metadata available according to FAIR principles.</p>' +
      '<p class="ted"><a href="https://ted.cathdb.info/about">The Encyclopedia of Domains (TED)</a> is a resource dedicated to identifying and classifying structural domains within the AlphaFold Protein Structure Database (AFDB) using deep learning-based domain parsing and structure comparison.</p>' +
      '<p class="plan">We plan to continue updating the database with structures for newly discovered protein sequences, and to improve features and functionality in response to user feedback. Please follow <a href="https://twitter.com/GoogleDeepMind">Google DeepMind</a>\'s and <a href="https://twitter.com/emblebi">EMBL-EBI</a>’s social channels for updates.</p>'
  );
  const ps = [...doc.querySelectorAll("p")].map((e) => e.textContent);
  assert.ok(ps[0].startsWith("合格的数据集必须使用 AlphaFold 2 或 AlphaFold 多聚体"), ps[0]);
  assert.ok(ps[0].includes("请发邮件至 afdbhelp@ebi.ac.uk"), ps[0]);
  assert.equal(doc.querySelectorAll("p")[0].querySelector("a").getAttribute("href"), "mailto:afdbhelp@ebi.ac.uk");
  assert.ok(ps[1].startsWith("我们目前没有提交单个结构预测的功能。"), ps[1]);
  assert.ok(ps[1].includes("正在编写的 Research Data Management 工具包"), ps[1]);
  assert.equal(doc.querySelectorAll("p")[1].querySelector("a").getAttribute("href"), "https://rdmkit.elixir-europe.org/structural_bioinformatics.html");
  assert.equal(
    doc.querySelector(".ted").textContent,
    "The Encyclopedia of Domains (TED) 是一个致力于使用基于深度学习的结构域解析与结构比较，识别并分类 AlphaFold 蛋白质结构数据库（AFDB）中结构域的资源。"
  );
  assert.equal(doc.querySelector(".ted a").getAttribute("href"), "https://ted.cathdb.info/about");
  assert.equal(
    doc.querySelector(".plan").textContent,
    "我们计划持续用新发现蛋白质序列的结构更新数据库，并根据用户反馈改进功能。请关注 Google DeepMind 与 EMBL-EBI 的社交渠道获取更新。"
  );
  assert.equal(doc.querySelectorAll(".plan a")[1].getAttribute("href"), "https://twitter.com/emblebi");
});
