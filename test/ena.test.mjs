// ENA Browser（dict/ena.json）回归：记录页字段名与表头、分页与占位规则、检索分面、
// 首页/文档页骨架、ELIXIR-GBC 横幅与 cookie 模板、提交与支持页固定句、数据不动。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/ena.json"), "utf8"));
const common = JSON.parse(fs.readFileSync(path.join(root, "../dict/common.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;

// sites.json 里的 ENA 条目由维护者合入时添加；未添加时用同一份配置对象，保证测试自带闭环。
// dicts 顺序与 InterPro / Expression Atlas 一致：common 在前，本册最后（后加载者覆盖）。
const siteCfg = sites.find((s) => s.id === "ena") || {
  id: "ena",
  name: "ENA Browser",
  hosts: ["www.ebi.ac.uk"],
  path: "^/ena/",
  dicts: ["common", "ena"],
  scope: "body",
  proseExempt: ""
};
const site = Object.assign({}, siteCfg, { spa: false, waitFor: null, rescan: false });

const all = {
  exact: Object.assign({}, common.exact, book.exact),
  rules: [...(common.rules || []), ...book.rules],
  templates: [...(common.templates || []), ...book.templates]
};
const CJK = /[\u4e00-\u9fff]/;

function run(html) {
  const dom = new JSDOM(html, { url: "https://www.ebi.ac.uk/ena/browser/home" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: all,
    site
  });
  engine.start();
  return dom.window.document;
}

function text(el) {
  return el.textContent.replace(/\s+/g, " ").trim();
}

test("词库结构：family/sites、条数、键值卫生、规则带捕获组、模板槽位连续", () => {
  assert.equal(book.meta.family, "ena");
  assert.deepEqual(book.meta.sites, ["www.ebi.ac.uk"]);
  const keys = Object.keys(book.exact);
  assert.ok(keys.length >= 400, "exact 只有 " + keys.length + " 条");
  assert.ok(book.rules.length >= 20, "rules 只有 " + book.rules.length + " 条");
  assert.ok(book.templates.length >= 20, "templates 只有 " + book.templates.length + " 条");

  for (const [k, v] of Object.entries(book.exact)) {
    assert.doesNotMatch(k, CJK, "key 含中文: " + k);
    assert.match(v, CJK, "译文不含中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "key 首尾有空白: " + JSON.stringify(k));
    assert.equal(v, v.trim(), "译文首尾有空白: " + k);
    assert.doesNotMatch(v, /https?:\/\//i, "译文含明文 URL: " + k);
    assert.doesNotMatch(v, /[\w.+-]+@[\w-]+\.[\w.]+/, "译文含明文邮箱: " + k);
    if (k in common.exact) assert.equal(v, common.exact[k], "与 common 译法不一致: " + k);
  }
  for (const r of book.rules) {
    const re = new RegExp(r.re);
    assert.ok(re.source.length > 0);
    assert.match(r.to, CJK, "规则译文不含中文: " + r.re);
    assert.ok(/\$\d/.test(r.to), "带捕获组的规则要用到占位符: " + r.re);
  }
  for (const t of book.templates) {
    const slots = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.ok(slots.length >= 1, "模板没有槽位: " + t.pat);
    slots.slice().sort((a, b) => a - b).forEach((n, i) => assert.equal(n, i + 1, "槽位必须从 1 连续: " + t.pat));
    const zh = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.deepEqual(zh.slice().sort((a, b) => a - b), slots.slice().sort((a, b) => a - b), "译文槽位与原文不一致: " + t.pat);
  }
  // 站点栈：common 在前、本册最后
  assert.deepEqual(site.dicts.slice(-1), ["ena"], "本册必须在 dicts 末尾");
  assert.equal(site.dicts[0], "common", "common 必须在前");
});

test("项目记录页：标题规则、字段名、表头、分页标签", () => {
  const doc = run(
    '<div id="content"><app-root>' +
      '<h3 class="record-title">Project: PRJEB402</h3>' +
      '<div class="record-description">Coccolithophore community</div>' +
      '<div class="attribute"><div class="attribute-name">Secondary Study Accession:</div><div class="attribute-value">PRJEB402</div></div>' +
      '<div class="attribute"><div class="attribute-name">Study Title:</div><div class="attribute-value">Marine microbial</div></div>' +
      '<div class="attribute"><div class="attribute-name">Center Name:</div><div class="attribute-value">UNIVERSITY OF OULU</div></div>' +
      '<div class="attribute"><div class="attribute-name">Keywords:</div><div class="attribute-value">metagenome</div></div>' +
      '<h4 class="tab-header well">Component Projects</h4>' +
      "<table><thead><tr><th>Accession</th><th>Title/Description</th><th>Study Accession</th></tr></thead></table>" +
      '<div class="mat-paginator-page-size-label">Items per page:</div>' +
      '<div class="mat-paginator-range-label">1 - 10 of 29</div>' +
      '<button aria-label="Previous page"></button>' +
      '<button aria-label="Last page"></button>' +
      "</app-root></div>"
  );
  assert.equal(text(doc.querySelector("h3.record-title")), "项目：PRJEB402", "登录号保持原样");
  assert.equal(text(doc.querySelector(".record-description")), "Coccolithophore community", "记录描述是数据，不翻");
  const names = [...doc.querySelectorAll(".attribute-name")].map(text);
  assert.deepEqual(names, ["次级研究登录号：", "研究标题：", "中心名称：", "关键词："]);
  const values = [...doc.querySelectorAll(".attribute-value")].map(text);
  assert.deepEqual(values, ["PRJEB402", "Marine microbial", "UNIVERSITY OF OULU", "metagenome"], "字段值不动");
  assert.equal(text(doc.querySelector("h4.tab-header")), "组成项目");
  assert.deepEqual([...doc.querySelectorAll("th")].map(text), ["登录号", "标题/描述", "研究登录号"]);
  assert.equal(text(doc.querySelector(".mat-paginator-page-size-label")), "每页条目数：");
  assert.equal(text(doc.querySelector(".mat-paginator-range-label")), "第 1 - 10 条，共 29 条");
  const btns = [...doc.querySelectorAll("button")].map((b) => b.getAttribute("aria-label"));
  assert.deepEqual(btns, ["上一页", "最后一页"]);
});

test("样本与分类单元页：字段名、ORCID 提示、分类阶元与样本名不动", () => {
  const doc = run(
    '<div id="content"><app-root>' +
      '<h3 class="record-title">Sample: SAMEA115718193</h3>' +
      '<div class="attribute"><div class="attribute-name">Sample Accession:</div><div class="attribute-value">SAMEA115718193</div></div>' +
      '<div class="attribute"><div class="attribute-name">Sample Alias:</div><div class="attribute-value">Input(histone)-293T</div></div>' +
      '<div class="attribute"><div class="attribute-name">Scientific Name:</div><div class="attribute-value">Homo sapiens (human)</div></div>' +
      '<div class="attribute"><div class="attribute-name">Checklist:</div><div class="attribute-value">ERC000014</div></div>' +
      '<div class="attribute"><div class="attribute-name">Broad Scale Environmental Context:</div><div class="attribute-value">terrestrial</div></div>' +
      '<div class="attribute"><div class="attribute-name">Instrument Model:</div><div class="attribute-value">Illumina HiSeq 2000</div></div>' +
      '<button title="Show button to claim this record to ORCID &amp; display current claims (if any)"></button>' +
      '<div class="taxon">Eukaryota</div><div class="taxon">Homo sapiens</div>' +
      "</app-root></div>"
  );
  assert.equal(text(doc.querySelector("h3.record-title")), "样本：SAMEA115718193");
  const names = [...doc.querySelectorAll(".attribute-name")].map(text);
  assert.deepEqual(names, ["样本登录号：", "样本别名：", "学名：", "检查表：", "大尺度环境背景：", "测序仪型号："]);
  const values = [...doc.querySelectorAll(".attribute-value")].map(text);
  assert.deepEqual(values, ["SAMEA115718193", "Input(histone)-293T", "Homo sapiens (human)", "ERC000014", "terrestrial", "Illumina HiSeq 2000"]);
  const btn = doc.querySelector("button");
  assert.equal(btn.getAttribute("title"), "显示把此记录声明到 ORCID 的按钮，并展示当前已有的声明（如有）");
  assert.deepEqual([...doc.querySelectorAll(".taxon")].map(text), ["Eukaryota", "Homo sapiens"], "分类阶元不翻");
  const ran = run(
    '<div id="content"><app-root><h3 class="record-title">Taxon: 9606</h3>' +
      '<div class="attribute"><div class="attribute-name">Tax Division:</div><div class="attribute-value">HUM</div></div>' +
      "</app-root></div>"
  );
  assert.equal(text(ran.querySelector("h3.record-title")), "分类单元：9606");
});

test("序列页：字段名、拓扑结构等值不动、格式选项不翻", () => {
  const doc = run(
    '<div id="content"><app-root>' +
      '<h3 class="record-title">Sequence: BN000065</h3>' +
      '<div class="attribute"><div class="attribute-name">Mol Type:</div><div class="attribute-value">genomic DNA</div></div>' +
      '<div class="attribute"><div class="attribute-name">Topology:</div><div class="attribute-value">linear</div></div>' +
      '<div class="attribute"><div class="attribute-name">Dataclass:</div><div class="attribute-value">STD</div></div>' +
      '<div class="attribute"><div class="attribute-name">Tax Division:</div><div class="attribute-value">HUM</div></div>' +
      '<div class="attribute"><div class="attribute-name">Md5 Checksum:</div><div class="attribute-value">1f2b0707efee994266ec93a7d8bc7311</div></div>' +
      "<select><option>EMBL</option><option>FASTA</option></select>" +
      '<a title="View up to the first 1000 lines in EMBL Flatfile format. For larger records, use the Download link">EMBL</a>' +
      "</app-root></div>"
  );
  assert.equal(text(doc.querySelector("h3.record-title")), "序列：BN000065");
  const names = [...doc.querySelectorAll(".attribute-name")].map(text);
  assert.deepEqual(names, ["分子类型：", "拓扑结构：", "数据类别：", "分类部门：", "MD5 校验和："]);
  assert.deepEqual([...doc.querySelectorAll("option")].map(text), ["EMBL", "FASTA"], "文件格式选项不翻");
  assert.equal(
    doc.querySelector("a").getAttribute("title"),
    "最多可查看前 1000 行 EMBL 平面文件格式；更大的记录请使用下载链接"
  );
});

test("文本检索分面：分面词与括号串、计数与登录号不动", () => {
  const doc = run(
    '<div id="content"><app-root><div class="facets">' +
      "<b>Assembly</b><ul><li><a>Assembly</a> (42)</li><li><a>Coding (Standard)</a> (11)</li>" +
      "<li><a>Non-coding (TSA)</a> (7)</li><li><a>Sequence (Standard)</a> (9)</li></ul>" +
      "<b>Experiment</b><ul><li><a>Experiment</a> (12)</li></ul>" +
      "<b>Run</b><ul><li><a>Run</a> (5)</li></ul>" +
      "<b>Study</b><ul><li><a>Study</a> (3)</li></ul>" +
      "</div>" +
      "<table><tr><td>PRJEB402</td><td>Histone H3K27ac</td></tr></table>" +
      "</app-root></div>"
  );
  const links = [...doc.querySelectorAll("li a")].map(text);
  assert.deepEqual(links, ["组装", "编码（标准）", "非编码（TSA）", "序列（标准）", "实验", "运行", "研究"]);
  assert.deepEqual([...doc.querySelectorAll("b")].map(text), ["组装", "实验", "运行", "研究"]);
  assert.equal(text(doc.querySelector("li")), "组装 (42)", "计数节点保持原样");
  const tds = [...doc.querySelectorAll("td")].map(text);
  assert.deepEqual(tds, ["PRJEB402", "Histone H3K27ac"], "登录号与结果标题不动");
});

test("固定句式规则：记录未找到、分页、全部结果、版权、电话、节点加载", () => {
  const doc = run(
    '<div id="content"><app-root>' +
      '<h3 class="record-title">Record not found: PRJEB999</h3>' +
      '<div class="mat-paginator-range-label">0 of 0</div>' +
      '<div class="p2">1 - 10 of 29</div>' +
      '<a class="all">View all 42 results.</a>' +
      '<div class="cpy">Copyright © EMBL 2026</div>' +
      "<div class=\"tel\">Tel: +44 (0)1223 49 44 44</div>" +
      '<div class="load">Loaded (0/undefined) children</div>' +
      '<button class="exp" aria-label="Expand all the ancestors and children of 9606?"></button>' +
      '<div class="exi">Existence: 5 Extension: 5</div>' +
      "</app-root></div>"
  );
  assert.equal(text(doc.querySelector("h3")), "记录未找到：PRJEB999");
  assert.equal(text(doc.querySelector(".mat-paginator-range-label")), "共 0 条");
  assert.equal(text(doc.querySelector(".p2")), "第 1 - 10 条，共 29 条");
  // 括号形态「1 - 1 of 1 (1 total)」的括号由引擎的括号通道单独处理，规则拿不到括号内文本，故不下断言
  assert.equal(text(doc.querySelector(".all")), "查看全部 42 条结果。");
  assert.equal(text(doc.querySelector(".cpy")), "版权所有 © EMBL 2026");
  assert.equal(text(doc.querySelector(".tel")), "电话：+44 (0)1223 49 44 44");
  assert.equal(text(doc.querySelector(".load")), "已加载（0/undefined）个子节点");
  assert.equal(doc.querySelector(".exp").getAttribute("aria-label"), "展开 9606 的全部祖先和子节点？", "属性通道不受长正文保护限制");
  assert.equal(text(doc.querySelector(".exi")), "存在：5 延伸：5");
});

test("首页骨架：输入占位符（属性通道）、检索按钮与文档卡片", () => {
  const doc = run(
    '<div id="content"><app-root>' +
      '<input type="text" placeholder="Search ENA guides...">' +
      '<input type="text" placeholder="Enter accession">' +
      '<span class="button-text">Free Text<br>Search<br>&nbsp;</span>' +
      '<span class="button-text">Advanced<br>Search<br>&nbsp;</span>' +
      '<span class="button-text">Cross <br>References<br>&nbsp;</span>' +
      '<h4>The European Nucleotide Archive (ENA)</h4>' +
      "</app-root></div>"
  );
  const ph = [...doc.querySelectorAll("input")].map((e) => e.getAttribute("placeholder"));
  assert.deepEqual(ph, ["检索 ENA 指南……", "输入登录号"]);
  const cards = [...doc.querySelectorAll(".button-text")].map(text);
  assert.deepEqual(cards, ["自由文本检索", "高级检索", "交叉引用"], "<br> 拼断的卡片标题整串命中");
  assert.equal(text(doc.querySelector("h4")), "The European Nucleotide Archive (ENA)", "资源名保留英文");
});

test("首页横幅与 cookie 条：模板替换保留链接", () => {
  const doc = run(
    '<div id="content"><app-root>' +
      '<h5><span class="elixir-banner-name">The European Nucleotide Archive (ENA)</span> is part of the ELIXIR infrastructure</h5>' +
      '<div class="gbc">The ENA is an ELIXIR Core Data Resource.</div>' +
      '<div class="alert alert-info">We recommend that you subscribe to the <a href="https://listserver.ebi.ac.uk/mailman/listinfo/ena-announce" target="_blank">ENA-announce mailing list</a> for updates on ENA services.<br></div>' +
      '<p class="vf-banner__text">This website requires cookies, and the limited processing of your personal data in order to function. By using the site you are agreeing to this as outlined in our <a target="_blank" href="assets/privacy-notice/ena-presentation.pdf">Privacy Notice<span class="link-pdf"></span></a> and <a target="_blank" href="https://www.ebi.ac.uk/about/terms-of-use">Terms of Use</a>.</p>' +
      "</app-root></div>"
  );
  assert.equal(text(doc.querySelector("h5")), "The European Nucleotide Archive (ENA) 是 ELIXIR 基础设施的一部分");
  assert.equal(text(doc.querySelector(".gbc")), "ENA 是 ELIXIR 核心数据资源。");
  const alert = doc.querySelector(".alert");
  assert.equal(text(alert), "建议订阅 ENA-announce 邮件列表，获取 ENA 服务的最新动态。");
  assert.equal(alert.querySelector("a").getAttribute("href"), "https://listserver.ebi.ac.uk/mailman/listinfo/ena-announce", "链接地址不能改");
  const cookie = doc.querySelector(".vf-banner__text");
  assert.equal(
    text(cookie),
    "本网站需要使用 cookie，并对您的个人数据进行有限处理才能正常运行。使用本网站即表示您同意我们的隐私声明与使用条款中所述的条款。"
  );
  const links = [...cookie.querySelectorAll("a")].map((a) => a.getAttribute("href"));
  assert.deepEqual(links, ["assets/privacy-notice/ena-presentation.pdf", "https://www.ebi.ac.uk/about/terms-of-use"], "模板不能丢链接");
  assert.equal(text(doc.querySelector(".link-pdf")), "", "模板替换后图标 span 仍在");
});

test("文档页：检索方式卡片与 EBI Search 说明句", () => {
  const doc = run(
    '<div id="content"><app-root>' +
      '<div class="card"><a href="/ena/browser/text-search"><span class="button-text">Free Text<br>Search<br>&nbsp;</span></a>' +
      "<p>Search documents</p></div>" +
      '<p>Uses <a href="https://www.ebi.ac.uk/ebisearch">EBI Search</a> to perform a free text search across ENA data. For more detailed usage please refer to the <a href="https://www.ebi.ac.uk/ebisearch/documentation.ebi">help &amp; documentation section</a>.</p>' +
      '<a href="/ena/browser/sequence-search"><span class="button-text">Sequence<br>Similarity<br>Search&nbsp;</span></a>' +
      '<a href="/ena/browser/sva"><span class="button-text">Sequence<br>Version<br>Archive&nbsp;</span></a>' +
      "</app-root></div>"
  );
  const p = doc.querySelector("p[class]") || [...doc.querySelectorAll("p")].pop();
  assert.equal(
    text(p),
    "使用 EBI Search 对 ENA 数据进行自由文本检索。更详细的用法请参阅help & documentation section。"
  );
  assert.equal(p.querySelector("a").getAttribute("href"), "https://www.ebi.ac.uk/ebisearch");
  const as = [...doc.querySelectorAll("a")].map(text);
  assert.ok(as.includes("序列相似性检索"), "Similarity 卡片命中: " + as.join("|"));
  assert.ok(as.includes("序列版本档案"), "Version Archive 卡片命中: " + as.join("|"));
});

test("提交页：三条提交途径（粗体标题 + 正文）与表格说明", () => {
  const doc = run(
    '<div id="content"><app-root>' +
      "<p><b>Interactive Submissions</b> are completed by filling out web forms directly in your browser and downloading template spreadsheets that can be completed off-line and uploaded to ENA. This is often the most accessible submission route.</p>" +
      "<p><b>Command Line Submissions</b> use our bespoke Webin-CLI program. This validates your submissions entirely before you complete them, allowing you maximum control of the process.</p>" +
      "<p><b>Programmatic Submissions</b> are completed by preparing your submissions as XML documents and either sending them to ENA using a program such as cURL or using the <a href=\"/ena/submit/webin\">Webin API</a>.</p>" +
      "<p>The table below outlines what can be submitted through each submission route. It is also recommended that you familiarise yourself with our <a href=\"/ena/browser/about/data-access\">data availability policy</a>.</p>" +
      "<p>Welcome to the general guide for the European Nucleotide Archive submission. Please take a moment to view this introduction and consider the options available to you before you begin your submission.</p>" +
      "</app-root></div>"
  );
  const ps = [...doc.querySelectorAll("p")].map(text);
  assert.equal(
    ps[0],
    "交互式提交：在浏览器中直接填写网页表单，并下载可离线填写、再上传到 ENA 的模板表格来完成。这通常是最容易上手的提交途径。"
  );
  assert.equal(
    ps[1],
    "命令行提交：使用我们专用的 Webin-CLI 程序。它会在您完成提交之前完整校验提交内容，让您对整个流程拥有最大的控制权。"
  );
  assert.equal(
    ps[2],
    "程序化提交：把提交内容准备成 XML 文档，再用 cURL 之类的程序发送给 ENA，或使用Webin API。"
  );
  assert.equal(ps[3], "下表列出了各提交途径可提交的内容。同时建议您先熟悉我们的数据可用性政策。");
  assert.equal(doc.querySelector("p a").getAttribute("href"), "/ena/submit/webin");
  assert.equal(
    ps[4],
    "欢迎查阅 European Nucleotide Archive 提交通用指南。开始提交前，请先花一点时间阅读本简介，并了解可用的选项。"
  );
});

test("支持页：告警句、单选标签、隐私说明与表单", () => {
  const doc = run(
    '<div id="content"><app-root>' +
      '<div class="alert alert-info">Please refer <a href="https://www.ebi.ac.uk/ena/browser/service-status"><b>ENA Services dashboard</b></a> to check ongoing issues before raising the ticket.</div>' +
      '<div class="alert alert-warning">ENA helpdesk response time is approximately 3 weeks</div>' +
      '<label class="mat-radio-label"><span class="mat-radio-label-content">downloading data (FTP/Aspera/IP whitelisting)</span></label>' +
      '<label class="mat-radio-label"><span class="mat-radio-label-content">uploading or submitting data</span></label>' +
      "<p>To directly report issues related to <b>downloading data (FTP/Aspera/IP whitelisting)</b>, please use this <a href=\"https://embl.service-now.com/sp\">form</a>. For issues related to <b>uploading or submitting data</b>, please continue with the form below.</p>" +
      "</app-root></div>"
  );
  assert.equal(
    text(doc.querySelector(".alert-info")),
    "提交工单前请先查看ENA 服务状态看板，确认是否有正在进行的问题。"
  );
  assert.equal(doc.querySelector(".alert-info a").getAttribute("href"), "https://www.ebi.ac.uk/ena/browser/service-status");
  assert.equal(text(doc.querySelector(".alert-warning")), "ENA 帮助台的响应时间约为 3 周");
  assert.deepEqual([...doc.querySelectorAll(".mat-radio-label-content")].map(text), [
    "下载数据（FTP/Aspera/IP 白名单）",
    "上传或提交数据"
  ]);
  assert.equal(
    text(doc.querySelector("p")),
    "如需直接报告与下载数据（FTP/Aspera/IP 白名单）相关的问题，请使用此表单（表单）。与上传或提交数据相关的问题请继续填写下面的表单。"
  );
});

test("Webin 登录页与工具入口", () => {
  const doc = run(
    '<div id="content"><app-root>' +
      "<h2>Welcome to the Webin submission Portal.</h2>" +
      "<p>Please provide your Webin credentials</p>" +
      '<label>Password</label><input type="password">' +
      "<button>Login</button>" +
      '<a href="/ena/submit/webin/login/reset">Forgot Password ?</a>' +
      "<h3>Submit to ENA using Webin Portal</h3>" +
      "<h3>Submit to ENA using Webin-CLI</h3>" +
      "<h3>Source Attribute Helper</h3>" +
      "</app-root></div>"
  );
  assert.equal(text(doc.querySelector("h2")), "欢迎使用 Webin 提交门户。");
  assert.equal(text(doc.querySelector("p")), "请提供您的 Webin 凭据");
  assert.equal(text(doc.querySelector("label")), "密码");
  assert.equal(text(doc.querySelector("button")), "登录");
  assert.equal(text(doc.querySelector("a")), "忘记密码？");
  assert.deepEqual([...doc.querySelectorAll("h3")].map(text), [
    "使用 Webin 门户向 ENA 提交",
    "使用 Webin-CLI 向 ENA 提交",
    "来源属性助手"
  ]);
});

test("数据不动：登录号、物种学名、URL、日期、用户名与单位", () => {
  const doc = run(
    '<div id="content"><app-root>' +
      '<div class="rec"><span>PRJEB402</span><span>SAMEA115718193</span><span>ERR550384</span></div>' +
      '<div class="tax"><span>Homo sapiens</span><span>Eukaryota</span><span>Homo sapiens neanderthalensis</span></div>' +
      '<div class="org"><span>UNIVERSITY OF OULU</span><span>61.9241 N 25.7482 E</span></div>' +
      '<div class="date"><span>Aug 4, 2026, 5:15:33 PM</span><span>13-MAY-2016</span></div>' +
      '<div class="num"><span>42</span><span>1e-200</span><span>1f2b0707efee994266ec93a7d8bc7311</span></div>' +
      '<div class="mail"><span>datasubs@ebi.ac.uk</span></div>' +
      "</app-root></div>"
  );
  const pick = (sel) => [...doc.querySelectorAll(sel + " span")].map(text);
  assert.deepEqual(pick(".rec"), ["PRJEB402", "SAMEA115718193", "ERR550384"]);
  assert.deepEqual(pick(".tax"), ["Homo sapiens", "Eukaryota", "Homo sapiens neanderthalensis"]);
  assert.deepEqual(pick(".org"), ["UNIVERSITY OF OULU", "61.9241 N 25.7482 E"]);
  assert.deepEqual(pick(".date"), ["Aug 4, 2026, 5:15:33 PM", "13-MAY-2016"]);
  assert.deepEqual(pick(".num"), ["42", "1e-200", "1f2b0707efee994266ec93a7d8bc7311"]);
  assert.deepEqual(pick(".mail"), ["datasubs@ebi.ac.uk"]);
});
