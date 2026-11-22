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
