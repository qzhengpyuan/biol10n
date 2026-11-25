// r56 GDC 文档站补译（数据字典 / 数据模型 / API 入门 / 关键术语 / MAF·VCF 文件格式 / 数据提交概览）。
// 实测来源（2026-11-25，CDP 9227，docs.gdc.cancer.gov 原始英文 DOM，TreeWalker 取 6–400 字符文本节点）：
//   https://docs.gdc.cancer.gov/Data_Dictionary/
//   https://docs.gdc.cancer.gov/Data/Data_Model/GDC_Data_Model/
//   https://docs.gdc.cancer.gov/API/Users_Guide/Getting_Started/
//   https://docs.gdc.cancer.gov/API/Users_Guide/Appendix_B_Key_Terms/
//   https://docs.gdc.cancer.gov/Data/File_Formats/MAF_Format/
//   https://docs.gdc.cancer.gov/Data/File_Formats/VCF_Format/
//   https://docs.gdc.cancer.gov/Data_Submission_Portal/Users_Guide/Data_Submission_Overview/
// 口径：正文固定说明句逐条进 exact；句中被内联链接切断的整段进 templates（{{n}} 与第 n 个内联元素一一对应）；
// 流程名（BWA with BQSR、STAR 2-Pass Genome…）与登录号（GSE/PRJNA/PXD/rs…）一律不翻，由用例锁住。
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
const SITE = sites.find((s) => s.id === "gdc-docs");
const BOOK = JSON.parse(fs.readFileSync(path.join(root, "../dict/gdc-docs.json"), "utf8"));
const CJK = /[\u3400-\u9fff]/;

function load() {
  const exact = {};
  const rules = [];
  const templates = [];
  for (const n of SITE.dicts) {
    const d = JSON.parse(fs.readFileSync(path.join(root, "../dict/" + n + ".json"), "utf8"));
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
    templates.push(...(d.templates || []));
  }
  return { exact, rules, templates };
}
const DATA = load();

const URLS = {
  dd: "https://docs.gdc.cancer.gov/Data_Dictionary/",
  dm: "https://docs.gdc.cancer.gov/Data/Data_Model/GDC_Data_Model/",
  api: "https://docs.gdc.cancer.gov/API/Users_Guide/Getting_Started/",
  terms: "https://docs.gdc.cancer.gov/API/Users_Guide/Appendix_B_Key_Terms/",
  maf: "https://docs.gdc.cancer.gov/Data/File_Formats/MAF_Format/",
  vcf: "https://docs.gdc.cancer.gov/Data/File_Formats/VCF_Format/",
  sub: "https://docs.gdc.cancer.gov/Data_Submission_Portal/Users_Guide/Data_Submission_Overview/"
};

function boot(html, key = "dd") {
  const dom = new JSDOM(html, { url: URLS[key] });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data: DATA, site: SITE });
  engine.start();
  return { engine, doc: dom.window.document };
}

// r56 新增 exact（原文逐字取自上述页面文本节点）
const NEW_EXACT = {
  "The name of the node.": "节点的名称。",
  "Unique Keys:": "唯一键：",
  "Integer: A field that only accepts whole numbers.": "整数：仅接受整数的字段。",
  "Comprehensive list of unique keys and links between properties.": "属性之间的唯一键与链接综合列表。",
  "This column displays the Category and Node hierarchy for the search value.": "本列显示检索值的类别与节点层级。",
  "Entities, Properties, and Links": "实体、属性与链接",
  "Working with the GDC Data Model": "使用 GDC 数据模型",
  "Directed Acyclic Graph (DAG)": "有向无环图（DAG）",
  "System properties": "系统属性",
  "Get the API status and version information": "获取 API 状态与版本信息",
  "Used to download GDC data": "用于下载 GDC 数据",
  "Access Control List": "访问控制列表",
  "Comma Seperated Values": "逗号分隔值",
  "Definition": "定义",
  "The GDC MAF file format is based on the TCGA Mutation Annotation Format specifications, with additional columns included.":
    "GDC MAF 文件格式基于 TCGA 突变注释格式规范，并增加了额外的列。",
  "Read depth across this locus in tumor BAM": "肿瘤 BAM 中该位点的读取深度",
  "The chromosome on which the variant is located": "变异所在的染色体",
  "Colon-separated values that describe the tumor sample": "描述肿瘤样本的冒号分隔值",
  "File Lifecycle": "文件生命周期",
  "Request Data Harmonization - Submitter Activity": "申请数据协调处理 - 提交者活动"
};

// ---------------- 结构与词库 ----------------

test("gdc-docs 词库：r56 新增条目就位，计数不回退", () => {
  assert.equal(BOOK.meta.family, "gdc");
  assert.deepEqual(BOOK.meta.sites, ["gdc.cancer.gov"]);
  assert.ok(SITE.dicts.includes("gdc-docs"));
  assert.ok(Object.keys(BOOK.exact).length >= 810, "exact 条数不足（r56 后应 ≥810）");
  assert.ok(BOOK.templates.length >= 105, "模板条数不足（r56 后应 ≥105）");
  assert.ok(BOOK.rules.length >= 12, "规则条数不应回退");
});

test("词库形状：rules 是对象、templates 是对象、译文含汉字、无自映射", () => {
  for (const r of BOOK.rules) {
    assert.equal(typeof r, "object", "rules 必须是对象");
    assert.equal(typeof r.re, "string", "rules 缺 re：" + JSON.stringify(r));
    assert.equal(typeof r.to, "string", "rules 缺 to：" + JSON.stringify(r));
  }
  for (const t of BOOK.templates) {
    assert.equal(typeof t, "object", "templates 必须是对象");
    assert.equal(typeof t.pat, "string");
    assert.equal(typeof t.zh, "string");
    assert.match(t.zh, CJK, "模板译文不含汉字：" + t.pat.slice(0, 50));
  }
  for (const [k, v] of Object.entries(BOOK.exact)) {
    assert.equal(typeof v, "string");
    assert.match(v, CJK, "译文不含汉字：" + k);
    assert.notEqual(k, v, "自映射：" + k);
    assert.ok(!CJK.test(k), "键含中文：" + k);
    assert.equal(v.trim(), v, "值有首尾空白：" + k);
  }
});

test("r56 新增 exact 逐条命中（词库 + 引擎两条路径）", () => {
  const { engine } = boot("<p>x</p>");
  for (const [en, zh] of Object.entries(NEW_EXACT)) {
    assert.equal(BOOK.exact[en], zh, "词库缺条目或译法不一致：" + en);
    assert.equal(engine.translateText(en), zh, "引擎未命中：" + en);
  }
});

test("短词护栏：r56 新增键长度都 > 3（避免污染长句）", () => {
  for (const en of Object.keys(NEW_EXACT)) {
    assert.ok(en.length > 3, "过短的键：" + en);
  }
});

test("模板占位符：所有模板 {{n}} 从 1 连续、zh 与 pat 数量一致", () => {
  for (const t of BOOK.templates) {
    const nums = (s) => [...s.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    const a = nums(t.pat);
    if (!a.length) continue;
    const b = nums(t.zh);
    assert.equal(b.length, a.length, "占位符数量不一致：" + t.pat.slice(0, 60));
    assert.deepEqual([...new Set(b)].sort((x, y) => x - y), a.map((_, i) => i + 1), "占位符编号不连续：" + t.pat.slice(0, 60));
  }
});

test("跨册同键：r56 新增 exact 与其它册的译法一致（不新增冲突）", () => {
  const dir = path.join(root, "../dict");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json") && x !== "gdc-docs.json")) {
    const other = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    for (const k of Object.keys(NEW_EXACT)) {
      if (k in (other.exact || {})) assert.equal(other.exact[k], NEW_EXACT[k], "跨册冲突：" + f + " / " + k);
    }
  }
});

// ---------------- 模板渲染 ----------------

test("数据模型整段：链接全部保留，正文整段中文", () => {
  const html =
    '<p id="p">Although the GDC Data Model may contain some cyclic elements, it can be helpful to think of it as a ' +
    '<a href="/Encyclopedia/pages/Directed_Acyclic_Graph/">Directed Acyclic Graph (DAG)</a> composed of interconnected ' +
    '<a href="/Encyclopedia/pages/Entity/">entities</a>. Each entity in the GDC has a set of properties and links.</p>';
  const { doc } = boot(html, "dm");
  const p = doc.getElementById("p");
  assert.match(p.textContent, /尽管 GDC 数据模型可能包含一些循环元素/);
  assert.match(p.textContent, /相互连接的/);
  const links = [...p.querySelectorAll("a")];
  assert.equal(links.length, 2, "链接数量被改变");
  assert.deepEqual(
    links.map((a) => a.getAttribute("href")).sort(),
    ["/Encyclopedia/pages/Directed_Acyclic_Graph/", "/Encyclopedia/pages/Entity/"],
    "链接地址被改变或丢失"
  );
  for (const a of links) assert.match(a.textContent, CJK, "链接文字未译：" + a.getAttribute("href"));
});

test("数据字典外部标准整段：三个链接保留，译文完整", () => {
  const html =
    '<p id="p">All properties and values in the GDC Data Dictionary include references to external standards defined and maintained by the ' +
    '<a href="https://evs.nci.nih.gov/ftp1/NCI_Thesaurus/">NCI Thesaurus</a> (NCIt) and the ' +
    '<a href="https://cadsr.cancer.gov/">Cancer Data Standards Registry and Repository</a> (caDSR). Both of these standards are operated by groups at ' +
    '<a href="https://cbiit.cancer.gov/">NCI\'s Center for Bioinformatics and Information Technology</a> (CBIIT).</p>';
  const { doc } = boot(html, "dd");
  const p = doc.getElementById("p");
  assert.match(p.textContent, /GDC 数据字典中的所有属性与取值都引用了由/);
  assert.match(p.textContent, /这两个标准均由/);
  assert.equal(p.querySelectorAll("a").length, 3);
  assert.equal(p.querySelectorAll("a")[2].getAttribute("href"), "https://cbiit.cancer.gov/");
  assert.match(p.querySelectorAll("a")[2].textContent, CJK);
});

test("项目发布整段：三个链接保留，六个月内发布译出", () => {
  const html =
    '<p id="p">Project release occurs after the data has been harmonized, and allows users to access this data with the ' +
    '<a href="https://portal.gdc.cancer.gov">GDC Data Portal</a> and other ' +
    '<a href="/Data/Data_Access_Processes_and_Tools/">GDC Data Access Tools</a>. The GDC will release data according to ' +
    '<a href="/Data_Sharing_Policies/">GDC Data Sharing Policies</a>. Data must be released within six months after GDC data processing has been completed, or the submitter may request earlier release.</p>';
  const { doc } = boot(html, "sub");
  const p = doc.getElementById("p");
  assert.match(p.textContent, /项目发布在数据协调处理完成后进行/);
  assert.match(p.textContent, /六个月内发布/);
  const links = p.querySelectorAll("a");
  assert.equal(links.length, 3);
  assert.equal(links[0].getAttribute("href"), "https://portal.gdc.cancer.gov");
  assert.equal(links[2].getAttribute("href"), "/Data_Sharing_Policies/");
});

test("数据字典查看器引言：单链接模板生效并保留链接", () => {
  const html = '<p id="p">The <a href="/Data_Dictionary/viewer/">GDC Data Dictionary Viewer</a> is a user-friendly interface for accessing the dictionary. It includes the following functionality:</p>';
  const { doc } = boot(html, "dd");
  const p = doc.getElementById("p");
  assert.match(p.textContent, /是访问字典的易用界面，包含以下功能/);
  assert.equal(p.querySelectorAll("a").length, 1);
  assert.equal(p.querySelector("a").getAttribute("href"), "/Data_Dictionary/viewer/");
});

test("未登记的英文段落保持原样（模板不误伤）", () => {
  const html = '<p id="p">This paragraph is not part of the GDC Data Dictionary and must stay untouched for now.</p>';
  const { doc } = boot(html, "dd");
  assert.equal(doc.getElementById("p").textContent, "This paragraph is not part of the GDC Data Dictionary and must stay untouched for now.");
});

// ---------------- 不翻口径 ----------------

test("流程名与工具名不翻：missNoise 词条与品牌缩写保持英文", () => {
  const { engine } = boot("<p>x</p>");
  for (const s of ["BWA with BQSR", "STAR 2-Pass Genome", "STAR 2-Pass Chimeric", "MuTect2", "CellRanger - 10x Chromium", "ABSOLUTE LiftOver", "VarScan2 Annotation"]) {
    assert.equal(DATA.exact[s], undefined, "流程名不该进 exact：" + s);
    assert.equal(engine.translateText(s), null, "流程名被翻译了：" + s);
  }
  for (const s of ["API", "UUID", "dbGaP", "TCGA Barcode", "GDC API"]) {
    assert.equal(DATA.exact[s], undefined, "品牌/缩写不该进 exact：" + s);
    assert.equal(engine.translateText(s), null, "品牌/缩写被翻译了：" + s);
  }
});

test("登录号与坐标串不翻：GSE/PRJNA/PXD/rs/SRR 一律返回 null", () => {
  const { engine } = boot("<p>x</p>");
  for (const s of ["GSE12345", "PRJNA123456", "PXD000001", "rs1234567", "SRR1234567", "GRCh38.d1.vd1"]) {
    assert.equal(engine.translateText(s), null, "登录号被翻译了：" + s);
  }
});

test("属性通道：title 工具提示按词库译，API 与 href 不动", () => {
  const html =
    '<a id="a" href="https://gdc.cancer.gov/developers" title="API">API</a>' +
    '<a id="b" href="https://docs.gdc.cancer.gov/Data_Dictionary/viewer/" title="Click to see the full image."><img alt="CDE Details"></a>';
  const { doc } = boot(html, "dd");
  assert.equal(doc.getElementById("a").getAttribute("href"), "https://gdc.cancer.gov/developers");
  assert.equal(doc.getElementById("a").getAttribute("title"), "API", "API 不该被翻译");
  assert.equal(doc.getElementById("b").getAttribute("href"), "https://docs.gdc.cancer.gov/Data_Dictionary/viewer/");
  assert.equal(doc.getElementById("b").getAttribute("title"), "点击查看完整图片", "title 未按词库翻译");
  assert.equal(doc.querySelector("img").getAttribute("alt"), "CDE Details", "未登记的 alt 应保持原样");
});
