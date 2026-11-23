// r29 GDC 文档站补词：/about-gdc、/about-data 各小节、/analyze-data、/access-data、/submit-data、/support
// 词库：dict/gdc-docs.json
// 原文取自 2026-11-23 实测页面（CDP 9227，页面已装 0.10.31，关闭汉化后读原始英文 DOM；
// 模板 pat 由与 src/engine.js buildTemplate 同构的探测脚本在页面里逐段比对得出）。
// 断言口径：exact 用 translateText 逐条比对；带链接的长段用真实 DOM 走模板通道，
// 并检查 href/节点数量未变；品牌缩写、邮箱、文件名等数据串必须返回 null。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();

const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const cfg = sites.find((s) => s.id === "gdc-docs");
const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/gdc-docs.json"), "utf8"));
const CJK = /[\u4e00-\u9fff]/;

function load(names) {
  const exact = {}, rules = [], templates = [];
  for (const n of names) {
    const d = JSON.parse(fs.readFileSync(path.join(root, "../dict/" + n + ".json"), "utf8"));
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
    templates.push(...(d.templates || []));
  }
  return { exact, rules, templates };
}

function boot(html, url = "https://gdc.cancer.gov/about-gdc") {
  const dom = new JSDOM("<body>" + html + "</body>", { url });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: load(cfg.dicts),
    site: cfg
  });
  engine.start();
  return { engine, doc: dom.window.document };
}

const plain = (el) => el.textContent.replace(/\s+/g, " ").trim();

// ---------------- 结构与词库 ----------------

test("gdc-docs 词库：meta 与新增条数就位", () => {
  assert.equal(book.meta.family, "gdc");
  assert.deepEqual(book.meta.sites, ["gdc.cancer.gov"]);
  assert.equal(cfg.hosts[0], "gdc.cancer.gov");
  assert.ok(cfg.dicts.includes("gdc-docs"), "gdc-docs 应加载本册");
  assert.ok(Object.keys(book.exact).length >= 346, "exact 条数不足");
  assert.ok(book.templates.length >= 49, "模板条数不足");
});

test("gdc-docs 词库：模板占位符 1..N 连续，pat 无汉字、zh 有汉字", () => {
  for (const t of book.templates) {
    assert.equal(typeof t.pat, "string", "pat 缺失");
    assert.equal(typeof t.zh, "string", "zh 缺失");
    assert.ok(!CJK.test(t.pat), "pat 含中文: " + t.pat.slice(0, 60));
    assert.ok(CJK.test(t.zh), "zh 无中文: " + t.pat.slice(0, 60));
    const used = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.ok(used.length > 0, "模板没有占位符: " + t.pat.slice(0, 60));
    const sorted = used.slice().sort((a, b) => a - b);
    sorted.forEach((n, i) => assert.equal(n, i + 1, "占位符不连续: " + t.pat.slice(0, 60)));
    assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, "pat 长度越界: " + t.pat.length);
  }
});

test("gdc-docs 词库：规则锚定且可编译，译文含中文", () => {
  for (const r of book.rules) {
    assert.ok(r.re.startsWith("^") && r.re.endsWith("$"), "规则必须锚定: " + r.re);
    assert.doesNotThrow(() => new RegExp(r.re), "规则无法编译: " + r.re);
    assert.ok(!CJK.test(r.re), "规则 re 含中文: " + r.re);
    assert.ok(CJK.test(r.to) || r.to === "$1 »", "规则译文没有中文: " + r.re);
  }
});

// ---------------- 长说明句（exact） ----------------

test("about-gdc：三段落整段命中", () => {
  const { engine } = boot("<p>x</p>");
  const out = engine.translateText(
    "The National Cancer Institute’s (NCI’s) Genomic Data Commons (GDC) is a data sharing platform that promotes precision medicine in oncology. It is not just a database or a tool; it is an expandable knowledge network supporting the import and standardization of genomic and clinical data from cancer research programs."
  );
  assert.ok(out && out.startsWith("美国国家癌症研究所（NCI）的基因组数据共享平台（GDC）"));
  assert.ok(out.includes("可扩展的知识网络"));
  const t2 = engine.translateText(
    "The GDC contains NCI-generated data from some of the largest and most comprehensive cancer genomic datasets, including The Cancer Genome Atlas (TCGA) and Therapeutically Applicable Research to Generate Effective Therapies (TARGET). For the first time, these datasets have been processed using a common set of bioinformatics pipelines, so that the data can be directly compared."
  );
  assert.ok(t2 && t2.includes("癌症基因组图谱（TCGA）"));
  assert.ok(t2.includes("可以直接比较"));
});

test("about-data：警告框与驱动因素段落命中", () => {
  const { engine } = boot("<p>x</p>");
  assert.ok(
    engine.translateText(
      "Data made available through the GDC is for research purposes only. The GDC provides researchers with access to standardized clinical, proteomic, epigenomics, and genomic data from cancer studies to enable exploratory analysis that cannot be considered definitive for outcomes."
    ).includes("仅用于研究目的")
  );
  assert.ok(
    engine
      .translateText(
        "The GDC assists researchers in exploratory analysis by identifying changes in cancer cells that may play an important role in cancer development. Through the GDC knowledge base, researchers can leverage data maintained in the GDC to assist in identifying both high- and low-frequency cancer drivers such as:"
      )
      .endsWith("例如：")
  );
});

test("analyze-data：工具说明条目与小标题命中", () => {
  const { engine } = boot("<p>x</p>");
  const pairs = {
    "Build cohorts and perform gene and variant level analysis on the cohort": "在队列上构建队列并开展基因与变异层面分析",
    "Visualize most frequently mutated genes and somatic mutations for a cohort": "可视化队列中最高频的突变基因与体细胞突变",
    "Visualize the top most variably expressed genes in a cohort": "可视化队列中表达变异最大的基因",
    "Use clinical variables to perform basic statistical analysis of a cohort": "使用临床变量对队列进行基础统计分析",
    "Compare custom gene or case sets by visualizing set similarities and differences": "通过可视化集合的相似性与差异，比较自定义基因集或病例集",
    "Explore the GDC Data Analysis Processes and Tools »": "探索 GDC 数据分析流程与工具 »",
    "Submitted Data": "提交的数据",
    "Generated Data": "生成的数据",
    "Submitted Data Types": "提交的数据类型",
    "Generated Data Types": "生成的数据类型",
    "Introduction": "简介",
    "More about Data Harmonization and Generation": "了解数据统一与生成的更多信息",
    "Data Submission Processes": "数据提交流程",
    "Learn More": "了解更多",
    "User Guide": "用户指南",
    "Data Validation & Integrity Checks": "数据校验与完整性检查",
    "Methylation Array Analysis": "甲基化芯片分析"
  };
  for (const [en, zh] of Object.entries(pairs)) assert.equal(engine.translateText(en), zh, "缺词条: " + en);
});

test("support：上一轮未收的四条整句命中", () => {
  const { engine } = boot("<p>x</p>");
  assert.equal(
    engine.translateText(
      "Documentation highlighting the ways in which data can be submitted and a step-by-step procedure for the preparation, validation and submission of data to the GDC."
    ),
    "说明数据可提交的方式，以及向 GDC 准备、校验与提交数据的分步流程。"
  );
  assert.ok(
    engine
      .translateText(
        "Details the process of developing applications for the GDC Data Portal and describes the structure of the GDC Data Portal and GDC Application Software Development Kit (SDK)."
      )
      .startsWith("详述为 GDC 数据门户开发应用的过程")
  );
  assert.ok(
    engine
      .translateText(
        "Provides instructions and working code examples on using the GDC API to develop applications that interface with the GDC."
      )
      .startsWith("提供使用 GDC API 开发对接 GDC 的应用的说明")
  );
  assert.ok(
    engine
      .translateText(
        "This video introduces users to the Application Programming Interface (API), which drives the GDC Data Portals and allows users to query, download, and submit data."
      )
      .startsWith("本视频介绍应用程序编程接口（API）")
  );
});

// ---------------- 模板通道（真实 DOM） ----------------

test("support：隐私说明段模板替换后链接与 href 原样", () => {
  const html =
    '<p id="privacy">Submitting GDC support requests requires the submission of Personally Identifiable Information (PII). Please see the <a href="/gdc-privacy-policy">GDC Privacy Policy</a> and <a href="/privacy-act-notification-statement">GDC Privacy Act Notification</a> for additional information.</p>';
  const { doc } = boot(html, "https://gdc.cancer.gov/support");
  const p = doc.getElementById("privacy");
  assert.ok(plain(p).startsWith("提交 GDC 支持请求需要提交个人可识别信息（PII）"), plain(p));
  const links = [...p.querySelectorAll("a")];
  assert.equal(links.length, 2);
  assert.equal(links[0].getAttribute("href"), "/gdc-privacy-policy");
  assert.equal(links[1].getAttribute("href"), "/privacy-act-notification-statement");
  assert.equal(links[0].textContent, "GDC 隐私政策");
  assert.equal(links[1].textContent, "GDC 隐私法通知");
});

test("support：文档卡片（图标 + 链接 + 换行）整段命中，图标与链接不动", () => {
  const html =
    '<p id="card"><img src="/system/files/inline-images/icon-doc.png" alt="doc icon"><a href="http://docs.gdc.cancer.gov/Data_Submission_Portal/Users_Guide/Checklist/">GDC Data Submission Portal User’s Guide »</a><br>Documentation highlighting the ways in which data can be submitted and a step-by-step procedure for the preparation, validation and submission of data to the GDC.</p>';
  const { doc } = boot(html, "https://gdc.cancer.gov/support");
  const p = doc.getElementById("card");
  assert.ok(plain(p).includes("说明数据可提交的方式"), plain(p));
  assert.equal(p.querySelectorAll("img").length, 1);
  const a = p.querySelector("a");
  assert.equal(a.getAttribute("href"), "http://docs.gdc.cancer.gov/Data_Submission_Portal/Users_Guide/Checklist/");
  assert.equal(a.textContent, "GDC 数据提交门户用户指南 »");
  assert.equal(p.querySelectorAll("br").length, 1);
});

test("submit-data：dbGaP 注册后流程长段模板命中，四个链接保留", () => {
  const html =
    '<p id="flow">Once the study has been registered in dbGaP, the GDC will setup the project in the GDC. Provided the Subject IDs are registered in <a href="/about-data/data-dictionary">dbGaP</a> and data submitters have dbGaP submitter privileges, data can then be uploaded and validated within the GDC. After validation, data is submitted to the GDC for processing. The GDC will process applicable data sets (see <a href="/node/144">Data Harmonization</a> for additional details). After data processing has been completed, the user can release their data to the GDC, which must occur six (6) months after GDC data processing, per <a href="/submit-data/data-submission-policies">GDC Data Submission Policies</a>. Data is then made available through <a href="/access-data/data-access-processes-and-tools">GDC Data Access Tools</a> as open or controlled access per dbGaP authorization policies associated with the data set.</p>';
  const { doc } = boot(html, "https://gdc.cancer.gov/submit-data/data-submission-processes-and-tools");
  const p = doc.getElementById("flow");
  assert.ok(plain(p).startsWith("研究在 dbGaP 注册后，GDC 将在 GDC 中建立项目"), plain(p));
  assert.ok(plain(p).includes("六个月后"));
  const links = [...p.querySelectorAll("a")];
  assert.equal(links.length, 4);
  assert.deepEqual(
    links.map((a) => a.getAttribute("href")),
    [
      "/about-data/data-dictionary",
      "/node/144",
      "/submit-data/data-submission-policies",
      "/access-data/data-access-processes-and-tools"
    ]
  );
});

test("access-data：开放/受控段与工具段模板命中", () => {
  const html =
    '<p id="oc">Some data in the GDC is open access, which means that no authentication or authorization is necessary to access it. Other data is controlled access, which means that dbGaP authorization and eRA Commons authentication are necessary for access. Whether a dataset is open or controlled is determined according to <a href="/access-data/data-access-policies">Data Access Policies</a> in a process that is driven by informed consent of research participants.</p>' +
    '<p id="tool">For large, high volume data, users can download the data using the <a href="/access-data/gdc-data-transfer-tool">GDC Data Transfer Tool</a>, which is a client-based tool designed for efficient data transfer. To download multiple files at once with the Data Transfer Tool, the user can create and download a manifest within the GDC Data Portal. To download controlled access data the user can download a token from the GDC Data Portal. A GDC Application Programming Interface (API) is also available to download data programmatically.</p>';
  const { doc } = boot(html, "https://gdc.cancer.gov/access-data/data-access-processes-and-tools");
  const oc = doc.getElementById("oc");
  assert.ok(plain(oc).startsWith("GDC 中部分数据为开放访问"), plain(oc));
  assert.ok(plain(oc).includes("知情同意驱动"));
  assert.equal(oc.querySelector("a").getAttribute("href"), "/access-data/data-access-policies");
  assert.equal(oc.querySelector("a").textContent, "数据访问政策");
  const tool = doc.getElementById("tool");
  assert.ok(plain(tool).startsWith("对于大体量数据"), plain(tool));
  assert.equal(tool.querySelectorAll("a").length, 1);
});

test("data-quality：BBRB 段与 MD5 校验项模板命中", () => {
  const html =
    '<p id="bbrb">The GDC obtains datasets from NCI programs that ensure high quality by accepting only tissues that have extensive information on their sources and have undergone stringent material processing quality control. The GDC obtains datasets from other NCI-supported programs that adhere to high quality standards for handling biospecimens and associated analytes and recommends that non-NCI supported programs submitting data to GDC follow Biospecimen Best Practices. Organizations wishing to submit data to the GDC should visit the <a href="https://brb.nci.nih.gov/">NCI Biorepositories and Biospecimen Research Branch (BBRB) site</a> for recommended tissue collection strategies for generating high quality datasets.</p>' +
    '<ul><li id="md5"><strong>Verification of MD5 Checksum</strong> - Comparison of the provided MD5 Checksum with the MD5 Checksum of the file submitted to the GDC.</li></ul>';
  const { doc } = boot(html, "https://gdc.cancer.gov/about-data/gdc-data-quality");
  const bbrb = doc.getElementById("bbrb");
  assert.ok(plain(bbrb).startsWith("GDC 从 NCI 计划获取数据集"), plain(bbrb));
  assert.ok(plain(bbrb).includes("生物样本最佳实践"));
  assert.equal(bbrb.querySelector("a").getAttribute("href"), "https://brb.nci.nih.gov/");
  const li = doc.getElementById("md5");
  assert.ok(plain(li).startsWith("MD5 校验和验证 - 将提供的 MD5 校验和"), plain(li));
});

test("submit-data：表格标题与图注模板命中（BR 槽位）", () => {
  const html =
    '<p id="web"><br>GDC Data Submission Portal<br>(Web-Based)</p>' +
    '<p id="cli"><br>GDC Data Transfer Tool (Client-Based)</p>' +
    '<div id="req"><a href="https://dbgap.ncbi.nlm.nih.gov/">Authorization</a> required for access</div>';
  const { doc } = boot(html, "https://gdc.cancer.gov/access-data/data-access-processes-and-tools");
  assert.equal(doc.querySelectorAll("#web br").length, 2);
  assert.ok(plain(doc.getElementById("web")).includes("GDC 数据提交门户"));
  assert.ok(plain(doc.getElementById("web")).includes("（网页版）"));
  assert.ok(plain(doc.getElementById("cli")).includes("GDC 数据传输工具（客户端）"));
  assert.ok(plain(doc.getElementById("req")).startsWith("访问需要"), plain(doc.getElementById("req")));
});

// ---------------- 数据串不翻 ----------------

test("品牌缩写、邮箱、文件名、机构名不翻", () => {
  const { engine } = boot("<p>x</p>");
  const data = [
    "API",
    "GDC API",
    "TCGA",
    "TARGET",
    "dbGaP",
    "eRA Commons",
    "support@nci-gdc.datacommons.io",
    "GRCh38.d1.vd1.fa.tar.gz",
    "BWA, Picard Tools, GATK, MuSE, MuTect2, VarScan2, Pindel, CaVEMan, Strelka2, SvABA",
    "Methylation Array Gene Annotation File (v36)"
  ];
  for (const s of data) assert.equal(engine.translateText(s), null, "不该命中: " + s);
});