// cBioPortal 文档站词库（dict/cbio-docs.json）校验 + 引擎行为测试
// 覆盖：全站侧边栏/页头页脚、首页、About Us、Supported Data Types、API 与 API 客户端、Deployment、Development、User Guide
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/cbio-docs.json"), "utf8"));

// 文档站还没接线，测试用最小 site 定义；scope 放到 body，才能同时覆盖 main 之外的侧边栏与页头
const site = {
  id: "cbio-docs-test",
  hosts: ["docs.cbioportal.org"],
  scope: "body",
  spa: false,
  rescan: false
};

function mount(inner, url = "https://docs.cbioportal.org/") {
  const dom = new JSDOM('<div id="root">' + inner + "</div>", { url });
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

test("词库可解析，meta 与三类条目齐全", () => {
  assert.equal(dict.meta.family, "cbioportal");
  assert.deepEqual(dict.meta.sites, ["docs.cbioportal.org"]);
  assert.ok(Object.keys(dict.exact).length >= 150, "exact 条目应不少于 150 条，实际 " + Object.keys(dict.exact).length);
  assert.ok(dict.rules.length >= 2, "rules 至少 2 条");
  assert.ok(dict.templates.length >= 20, "templates 至少 20 条，实际 " + dict.templates.length);
});

test("exact 键值卫生：无中文键、译文为中文、非自映射、无明文 URL/邮箱、无首尾空白", () => {
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.ok(!/[\u3400-\u9fff]/.test(k), "key 含中文：" + k);
    assert.ok(/[\u3400-\u9fff]/.test(v), "value 无中文：" + k);
    assert.notEqual(k, v, "自映射：" + k);
    assert.ok(!/https?:\/\/|[\w.+-]+@[\w-]+\.\w+/.test(v), "value 含明文 URL/邮箱：" + k);
    assert.equal(k, k.trim(), "key 首尾空白：" + JSON.stringify(k));
    assert.equal(v, v.trim(), "value 首尾空白：" + JSON.stringify(v));
  }
});

test("关键条目存在（导航、页头页脚、首页、内页标题、表格表头）", () => {
  const want = {
    Home: "首页",
    "About Us": "关于我们",
    "Supported Data Types": "支持的数据类型",
    "User Guide": "用户指南",
    Deployment: "部署",
    Development: "开发",
    "Frequently Asked Questions": "常见问题",
    Filter: "筛选",
    "Edit this page": "编辑此页面",
    "Welcome to the documentation for cBioPortal!": "欢迎来到 cBioPortal 文档！",
    "Portal User": "门户用户",
    "Instance Maintainer": "实例维护者",
    "Quick Links": "快速链接",
    "Molecular Data": "分子数据",
    "External Viewer Integration": "外部查看器集成",
    Assay: "检测方法",
    "Processed Data": "处理后数据",
    TBD: "待定",
    "API and API Clients": "API 与 API 客户端",
    "Deployment Overview": "部署概览",
    Alumni: "校友",
    "Current:": "当前：",
  };
  for (const [k, v] of Object.entries(want)) assert.equal(dict.exact[k], v, "缺少或值不符：" + k);
});

test("含零宽空格的导航键按站点原文登记（normalize 会把它折叠成空格）", () => {
  assert.equal(dict.exact["List of RF\u200bCs"], "RFC 列表");
  assert.equal(dict.exact["List of Active RF\u200bCs"], "活跃 RFC 列表");
  assert.equal(dict.exact["Click\u200bHouse Setup"], "ClickHouse 设置");
  // 键里不能是普通空格冒充零宽
  assert.ok(!Object.keys(dict.exact).includes("List of RF Cs"));
});

test("rules 全部 ^…$ 锚定、可编译，$n 引用的捕获组真实存在", () => {
  for (const r of dict.rules) {
    assert.ok(r.re.startsWith("^") && r.re.endsWith("$"), "未锚定：" + r.re);
    assert.doesNotThrow(() => new RegExp(r.re), "坏正则：" + r.re);
    const groups = (r.re.match(/\((?!\?)/g) || []).length;
    for (const m of r.to.matchAll(/\$(\d)/g)) {
      assert.ok(Number(m[1]) <= groups, "引用了不存在的捕获组 " + m[0] + "：" + r.re);
    }
    assert.ok(/[\u3400-\u9fff]/.test(r.to), "译文必须含中文：" + r.re);
  }
  const top = dict.rules.find((r) => r.re.includes("Top"));
  const hit = new RegExp(top.re).exec("Top 20 results");
  assert.ok(hit, "Top N results 规则应命中搜索面板原文");
  assert.equal(top.to.replace(/\$(\d)/g, (_, d) => hit[Number(d)]), "前 20 条结果");
});

test("templates：pat 不含中文、长度合规、占位符 1..N 连续且与 zh 槽位一致", () => {
  for (const t of dict.templates) {
    assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, "pat 长度越界：" + t.pat.length + " " + t.pat.slice(0, 40));
    assert.ok(!/[\u3400-\u9fff]/.test(t.pat), "pat 不该含中文：" + t.pat.slice(0, 40));
    assert.ok(/[\u3400-\u9fff]/.test(t.zh), "译文必须是中文：" + t.pat.slice(0, 40));
    const slotCount = (t.pat.match(/\{\{\d+\}\}/g) || []).length;
    const used = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
    assert.deepEqual(used, Array.from({ length: slotCount }, (_, i) => i + 1), "占位符不匹配：" + t.pat.slice(0, 60));
    const patSlots = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
    assert.deepEqual(patSlots, Array.from({ length: slotCount }, (_, i) => i + 1), "pat 占位符必须 1..N：" + t.pat.slice(0, 60));
    assert.ok(!/https?:\/\/|[\w.+-]+@[\w-]+\.\w+/.test(t.zh), "模板译文含明文 URL/邮箱：" + t.pat.slice(0, 40));
  }
});

// ---------------- 引擎行为：全局侧边栏 / 页头 / 页脚 ----------------

test("侧边栏：导航项与含零宽空格的分组标题都翻成中文，链接与 href 全部保留", () => {
  const { doc } = mount(
    '<aside id="retype-sidebar-left" class="sidebar">' +
      '<div id="retype-sidebar-filter"><input id="retype-filter-input" type="text" placeholder="Filter" value=""></div>' +
      '<ul class="overflow-y-auto h-full flex-1 pl-3 pt-4">' +
      '<li><div class="relative flex items-center"><a class="flex flex-1 items-center" href="./" aria-current="page"><span class="py-1.5 text-sm">Home</span></a></div></li>' +
      '<li><div class="relative flex items-center"><a class="flex flex-1 items-center" href="./about-us/"><span class="py-1.5 text-sm">About Us</span></a></div></li>' +
      '<li><div class="relative flex items-center"><a class="flex flex-1 items-center" href="./supported-data-types/"><span class="py-1.5 text-sm">Supported Data Types</span></a></div></li>' +
      '<li><div class="relative flex items-center"><a class="flex flex-1 items-center" href="./rfc-list/"><span class="py-1.5 text-sm">List of RF\u200bCs</span></a></div></li>' +
      '<li><div class="relative flex items-center"><a class="flex flex-1 items-center" href="./user-guide/"><span class="py-1.5 text-sm">User Guide</span></a></div></li>' +
      '<li><div class="relative flex items-center"><a class="flex flex-1 items-center" href="./deployment/"><span class="py-1.5 text-sm">Deployment</span></a></div></li>' +
      '<li><div class="relative flex items-center"><a class="flex flex-1 items-center" href="./development/"><span class="py-1.5 text-sm">Development</span></a></div></li>' +
      "</ul>" +
      '<div class="flex items-center"><span>Powered by</span><a href="https://www.retype.app/" target="_blank">cBioPortal</a></div>' +
      "</aside>"
  );
  const spans = [...doc.querySelectorAll("aside ul span")].map((e) => zh(e.textContent));
  assert.deepEqual(spans, ["首页", "关于我们", "支持的数据类型", "RFC 列表", "用户指南", "部署", "开发"]);
  const links = [...doc.querySelectorAll("aside ul a")];
  assert.equal(links.length, 7, "导航链接不能被模板拍平");
  assert.equal(links[0].getAttribute("href"), "./");
  assert.equal(links[3].getAttribute("href"), "./rfc-list/");
  assert.equal(links[6].getAttribute("href"), "./development/");
  assert.equal(zh(doc.querySelector("aside > div:last-child span").textContent), "技术支持");
  assert.equal(zh(doc.querySelector("aside > div:last-child a").textContent), "cBioPortal");
  assert.equal(doc.querySelector("#retype-filter-input").getAttribute("placeholder"), "筛选");
});

test("页头按钮的 aria-label 与页脚翻页条都翻成中文，品牌名保持英文", () => {
  const { doc } = mount(
    '<header class="sticky top-0 z-50 w-full">' +
      '<button id="menu-btn" type="button" aria-label="Open menu"></button>' +
      '<a class="flex items-center" href="./"><span>cBioPortal Docs</span></a>' +
      '<a href="https://github.com/cBioPortal/cbioportal">Github</a>' +
      '<a href="https://github.com/cBioPortal/cbioportal/issues">Issues</a>' +
      '<a href="https://groups.google.com/g/cbioportal">Google Group</a>' +
      '<a href="https://www.cbioportal.org/donate">Donate</a>' +
      '<input id="retype-search-input" type="text" aria-label="Search" placeholder="" autocomplete="off">' +
      '<button id="theme-btn" type="button" aria-label="Change theme"></button>' +
      '<button id="search-btn" type="button" aria-label="Search"><span>Search</span><kbd>Ctrl K</kbd></button>' +
      '<button id="open-contents" type="button" aria-label="Open Contents"></button>' +
      '<button id="close-contents" type="button" aria-label="Close Contents"></button>' +
      "</header>" +
      '<footer id="retype-content-footer"><div class="flex flex-wrap items-center gap-x-4 gap-y-2 mt-14">' +
      '<a id="retype-edit-this-page" href="https://github.com/cbioportal/cbioportal/blob/master/docs/About-Us.md" target="_blank"><span>Edit this page</span></a>' +
      "</div>" +
      '<nav id="retype-nextprev" class="print:hidden flex mt-14">' +
      '<div class="w-1/2"><a href="../about-us/"><span><span>Previous</span><span>About Us</span></span></a></div>' +
      '<div class="w-1/2"><a href="../rfc-list/"><span><span>Next</span><span>List of Active RF\u200bCs</span></span></a></div>' +
      "</nav></footer>"
  );
  const header = doc.querySelector("header");
  const label = (sel) => header.querySelector(sel).getAttribute("aria-label");
  assert.equal(label("#menu-btn"), "打开菜单");
  assert.equal(label("#retype-search-input"), "检索");
  assert.equal(label("#theme-btn"), "更改主题");
  assert.equal(label("#open-contents"), "打开目录");
  assert.equal(label("#close-contents"), "关闭目录");
  assert.equal(zh(header.querySelector("a span").textContent), "cBioPortal 文档");
  assert.equal(zh(header.querySelector('a[href*="issues"]').textContent), "问题");
  assert.equal(zh(header.querySelector('a[href*="groups.google"]').textContent), "Google 群组");
  assert.equal(zh(header.querySelector('a[href*="donate"]').textContent), "捐赠");
  assert.equal(zh(header.querySelector("kbd").textContent), "Ctrl K");
  assert.equal(zh(doc.querySelector("#retype-edit-this-page").textContent), "编辑此页面");
  const pager = [...doc.querySelectorAll("#retype-nextprev span span")].map((e) => zh(e.textContent));
  assert.deepEqual(pager, ["上一页", "关于我们", "下一页", "活跃 RFC 列表"]);
  assert.equal(doc.querySelectorAll("#retype-nextprev a")[1].getAttribute("href"), "../rfc-list/");
});

// ---------------- 引擎行为：首页 ----------------

test("首页：标题、角色卡片与 Quick Links，带链接的反馈句走模板且链接保住", () => {
  const { doc } = mount(
    '<main class="relative pb-12 lg:pt-2"><div class="relative retype-markdown" id="retype-content">' +
      '<h1 id="welcome" class="retype-primary-heading">Welcome to the documentation for cBioPortal!' +
      '<div id="retype-page-actions"><button type="button" title="Copy page as Markdown" aria-label="Copy page as Markdown"><span>Copy</span></button></div></h1>' +
      "<p>We've organized this site by the different roles in the cBioPortal community.</p>" +
      '<div class="homeList">' +
      '<div><a href="user-guide/"><img src="images/user-guide.png" width="125" height="125" alt="User guide  free icon" title="User guide free icon"></a><a href="user-guide/">Portal User</a></div>' +
      '<div><a href="web-api-and-clients/"><img src="images/api.png" alt="User guide  free icon"></a><a href="web-api-and-clients/">API User</a></div>' +
      '<div><a href="deployment/"><img src="images/deployment.png" alt="User guide  free icon"></a><a href="deployment/">Instance Maintainer</a></div>' +
      '<div><a href="development/"><img src="images/develop.png" alt="User guide  free icon"></a><a href="development/">Developer</a></div>' +
      "</div>" +
      '<div id="feedback"><h3><strong>Feedback? Questions?</strong></h3><br>' +
      '<p><a href="https://groups.google.com/g/cbioportal" class="no-link"><span>cBioPortal Google Group</span></a></p><hr>' +
      '<div class="rfclist"><p>We maintain an active <a href="rfc-list/">list of RFCs (Requests for Comments)</a> where we describe new features and solicit community feedback.</p></div></div>' +
      "<hr><h3>Quick Links</h3><ul>" +
      '<li><a href="user-guide/faq/">FAQ</a></li>' +
      '<li><a href="https://www.cbioportal.org/tutorials">Tutorials</a></li>' +
      '<li><a href="web-api-and-clients/">API documentation</a></li>' +
      "</ul></div></main>"
  );
  const h1 = zh(doc.querySelector("h1").childNodes[0].nodeValue);
  assert.equal(h1, "欢迎来到 cBioPortal 文档！");
  assert.equal(zh(doc.querySelector("h1 button").textContent), "复制");
  const cards = [...doc.querySelectorAll(".homeList > div > a:last-child")].map((e) => zh(e.textContent));
  assert.deepEqual(cards, ["门户用户", "API 用户", "实例维护者", "开发者"]);
  assert.equal(zh(doc.querySelector("#feedback strong").textContent), "有反馈？有疑问？");
  assert.equal(zh(doc.querySelector("#feedback p a").textContent), "cBioPortal Google 群组");
  const rfc = doc.querySelector(".rfclist p");
  assert.match(zh(rfc.textContent), /^我们维护一份活跃的RFC（征求意见稿）列表，在其中介绍新功能并征求社区反馈。$/);
  assert.equal(rfc.querySelectorAll("a").length, 1, "模板必须把链接放回译文");
  assert.equal(rfc.querySelector("a").getAttribute("href"), "rfc-list/");
  const quick = [...doc.querySelectorAll("ul li a")].map((e) => zh(e.textContent));
  assert.deepEqual(quick, ["常见问题", "教程", "API 文档"]);
});

// ---------------- 引擎行为：Supported Data Types ----------------

test("Supported Data Types：标题、表头与含链接的说明段落，链接全部保住", () => {
  const { doc } = mount(
    '<main><div class="relative retype-markdown" id="retype-content">' +
      '<h1 class="retype-primary-heading">Supported Data Types</h1>' +
      '<h2 id="molecular-data" class="retype-heading-2">Molecular Data</h2>' +
      "<p>cBioPortal is a multimodal cancer data visualization tool and supports a variety of data types. For some data types, we have explicit support; for others, you can leverage generic assay or clinical data to assign arbitrary data to either a sample or patient. Beyond including data directly into cBioPortal, one can also link in additional external viewers specialized for particular data types, or even entirely different dashboards or portals. This combination of structured and flexible data formats, as well as the option to link out to other viewers, allows cBioPortal to be used for many different combinations of clinical data and profiling methods.</p>" +
      '<h2 id="external-viewer-integration" class="retype-heading-2">External Viewer Integration</h2>' +
      '<p>There are several other data types for which there is no native support. However cBioPortal offers a generic way of linking in additional viewers using the <a href="../file-formats/#resource-data">Resource Data Format</a>. Technically this is known as an iframe link. These viewers can be linked at the cohort, patient or individual sample level. Beyond just linking viewers, we also have several suggestions on what kind of derived data can be added from these assays directly into cBioPortal for multimodal analysis. This mainly leverages the <a href="../file-formats/#generic-assay">Generic Assay Format</a>.</p>' +
      "<p>A linked resource can also carry per-item metadata — the stain, magnification or percent tumor cells of an individual slide, say. Those fields become searchable, sortable and filterable columns in the study's Files &amp; Links tab, so a researcher can narrow thousands of linked images down to the few worth opening instead of paging through a list of links. A curator decides how each field is labelled, typed and filtered through the <a href=\"../file-formats/#describing-metadata-columns-with-custom_metadata\">CUSTOM_METADATA contract</a>.</p>" +
      '<h2 id="clinical-data" class="retype-heading-2">Clinical Data</h2>' +
      "<p>The clinical data are free-form de-identified patient and sample attributes. We don't follow a specific ontology, but rely on the authors of the published studies to determine the organization of their clinical data. The only exception is the cancer type categorization which uses the <a href=\"https://oncotree.info\">Oncotree</a> ontology. We do allow encoding of the data type for each column (e.g. numerical, text, etc). More details can be found in the <a href=\"../file-formats/#clinical-data\">Clinical Data File Formats section</a>. We also have a <a href=\"../file-formats/#timeline-data\">timeline format</a> for incorporating treatment information (see e.g. <a href=\"https://genie.cbioportal.org/patient/summary?studyId=nsclc_public_genie_bpc&amp;caseId=GENIE-DFCI-004022\">this</a> AACR GENIE lung cancer case).</p>" +
      "<table><thead><tr><th>Assay</th><th>Processed Data</th><th>cBioPortal Data Type</th><th>Example cBioPortal Study</th><th>External Viewer</th><th>Derived data to load into cBioPortal</th></tr></thead><tbody>" +
      "<tr><td>Bulk DNA Sequencing</td><td>Mutations</td><td>Copy Number Alterations per Gene (CNA)</td><td>MSK-IMPACT (Nat Med, 2017)</td><td>-</td><td>CNA</td></tr>" +
      "<tr><td>Other Assays</td><td>Any sample-level and/or patient-level attributes (e.g. LHA types, microbiome)</td><td>Generic Assay</td><td>TCGA Pancan (Cell, 2018)</td><td>Minerva</td><td>TBD</td></tr>" +
      "</tbody></table></div></main>"
  );
  const hs = [...doc.querySelectorAll("h2")].map((e) => zh(e.textContent));
  assert.deepEqual(hs, ["分子数据", "外部查看器集成", "临床数据"]);
  const ths = [...doc.querySelectorAll("th")].map((e) => zh(e.textContent));
  assert.deepEqual(ths, ["检测方法", "处理后数据", "cBioPortal 数据类型", "cBioPortal 研究示例", "外部查看器", "载入 cBioPortal 的衍生数据"]);
  const ps = [...doc.querySelectorAll("p")];
  // 纯文本长段：段落通道整段替换
  assert.match(zh(ps[0].textContent), /^cBioPortal 是一款多模态癌症数据可视化工具/);
  // 带 2 个链接的模板段
  assert.match(zh(ps[1].textContent), /^还有若干数据类型没有原生支持。/);
  assert.equal(ps[1].querySelectorAll("a").length, 2);
  assert.equal(ps[1].querySelectorAll("a")[1].getAttribute("href"), "../file-formats/#generic-assay");
  // 带 CUSTOM_METADATA 链接的模板段
  assert.match(zh(ps[2].textContent), /链接资源还可以携带逐项元数据/);
  assert.match(zh(ps[2].textContent), /管理员通过 CUSTOM_METADATA 约定决定每个字段如何标注、如何定类型和如何筛选。$/);
  assert.equal(ps[2].querySelectorAll("a").length, 1);
  // 带 4 个链接的临床数据段
  assert.match(zh(ps[3].textContent), /^临床数据是自由格式的去标识化患者与样本属性。/);
  assert.equal(ps[3].querySelectorAll("a").length, 4);
  assert.equal(ps[3].querySelectorAll("a")[0].getAttribute("href"), "https://oncotree.info");
  assert.match(zh(ps[3].textContent), /例如参见这篇 AACR GENIE 肺癌病例）/);
  const tds = [...doc.querySelectorAll("td")].map((e) => zh(e.textContent));
  assert.equal(tds[0], "批量 DNA 测序");
  assert.equal(tds[1], "突变");
  assert.equal(tds[3], "MSK-IMPACT (Nat Med, 2017)");
  assert.equal(tds[4], "-");
  assert.equal(tds[5], "CNA");
  assert.equal(tds[8], "通用检测");
  assert.equal(tds[9], "TCGA Pancan (Cell, 2018)");
  assert.equal(tds[10], "Minerva");
  assert.equal(tds[11], "待定");
});

// ---------------- 引擎行为：About Us ----------------

test("About Us：机构段走模板，6 个机构链接与 href 全部保留", () => {
  const { doc } = mount(
    '<main><div class="relative retype-markdown" id="retype-content"><h1 class="retype-primary-heading">About Us</h1>' +
      "<p>The cBioPortal for Cancer Genomics was originally developed at <a href=\"https://www.mskcc.org/\">Memorial Sloan Kettering Cancer Center</a> (MSK). The <a href=\"https://www.cbioportal.org\">public cBioPortal site</a> is hosted by the <a href=\"https://www.mskcc.org/research/molecular-oncology\">Center for Molecular Oncology</a> at MSK. The cBioPortal software is now available under an open source license via <a href=\"https://github.com/cBioPortal/\">GitHub</a>. The software is now developed and maintained by a multi-institutional team, consisting of MSK, the Dana Farber Cancer Institute, Princess Margaret Cancer Centre in Toronto, Children's Hospital of Philadelphia, <a href=\"https://thehyve.nl\">The Hyve</a> and <a href=\"https://www.se4.bio/\">SE4BIO</a> in the Netherlands, and Bilkent University in Ankara, Turkey.</p>" +
      '<h3 id="alumni">Alumni</h3><ul><li>Tim Kuijpers</li></ul>' +
      '<h2 id="funding">Funding for the cBioPortal for Cancer Genomics is or has been provided by:</h2>' +
      '<h3 id="current">Current:</h3><ul><li>NCI, through <a href=\"https://itcr.nci.nih.gov/funded-project/cbioportal-cancer-genomics\">ITCR grant NCI-U24CA274633</a> and <a href=\"https://humantumoratlas.org/\">HTAN grant NCI-U24CA233243</a></li><li>Marie-José and Henry R. Kravis Center for Molecular Oncology at MSK</li></ul>' +
      "</div></main>"
  );
  const about = doc.querySelector("p");
  assert.match(zh(about.textContent), /^cBioPortal 癌症基因组学平台最初由 Memorial Sloan Kettering Cancer Center（MSK）开发。/);
  assert.equal(about.querySelectorAll("a").length, 6, "模板不能吞掉机构链接");
  assert.equal(about.querySelectorAll("a")[1].getAttribute("href"), "https://www.cbioportal.org");
  assert.equal(about.querySelectorAll("a")[5].getAttribute("href"), "https://www.se4.bio/");
  assert.equal(zh(doc.querySelector("h3").textContent), "校友");
  assert.equal(zh(doc.querySelectorAll("h2")[0].textContent), "以下机构为 cBioPortal 癌症基因组学项目提供过或正在提供资助：");
  assert.equal(zh(doc.querySelectorAll("h3")[1].textContent), "当前：");
  const fundingLi = doc.querySelectorAll("ul")[1].querySelector("li");
  assert.match(zh(fundingLi.textContent), /^NCI，通过\s*ITCR grant NCI-U24CA274633\s*与\s*HTAN grant NCI-U24CA233243$/);
  assert.equal(fundingLi.querySelectorAll("a").length, 2);
  // 纯机构名保持英文
  assert.equal(zh(doc.querySelectorAll("ul")[1].querySelectorAll("li")[1].textContent), "Marie-José and Henry R. Kravis Center for Molecular Oncology at MSK");
});

// ---------------- 引擎行为：API ----------------

test("API 页：带 code / 链接的段落走模板，代码块与代码片段保持英文", () => {
  const { doc } = mount(
    '<main><div class="relative retype-markdown" id="retype-content"><h1 class="retype-primary-heading">API and API Clients</h1>' +
      "<p>cBioPortal provides a REST API for programmatic access to the data. The visualizations one can see on the website leverage the same API. By connecting to the API directly, anyone can build their own visualizations/reports.</p>" +
      '<p>Please see the full reference documentation for the API <a href="https://www.cbioportal.org/api/swagger-ui/index.html">here</a>.</p>' +
      '<p>In addition to the REST API, cBioPortal exposes a <strong><a href="../ai-integrations/mcp/">Model Context Protocol (MCP)</a></strong> endpoint so AI assistants and agents can query the data directly. A hosted instance backed by the cBioPortal database is available at:</p>' +
      '<pre translate="no" class="language-none"><code class="language-none">https://mcp.cbioportal.org/db/mcp</code></pre>' +
      '<p>The cBioPortal REST API is described using Swagger/OpenAPI, which allows one to generate a client in most programming languages. One can use the command line tool <code translate="no">curl</code> for downloading data on the command line or use another language such as <code translate="no">Python</code> or <code translate="no">R</code> to make visualizations. We list some common examples below, but if your language is not listed, there is likely a client generator available elsewhere (see e.g. <a href="https://swagger.io/tools/swagger-codegen/">https://swagger.io/tools/swagger-codegen/</a>). Do reach out if you\'d like us to add a language.</p>' +
      '<h3 id="r-clients">R clients</h3>' +
      "<p>There are multiple ways to access the API using R. Below are two recommended R packages to access cBioPortal data.</p>" +
      '<p><em>Maintainers: <a href="https://github.com/LiNk-NY">Marcel Ramos Pérez</a>, <a href="https://github.com/lwaldron">Levi Waldron</a></em></p>' +
      '<p>For a comprehensive user guide to <code translate="no">cBioportalData</code> see: <a href="https://waldronlab.io/cBioPortalData/articles/cBioPortalData.html">https://waldronlab.io/cBioPortalData/articles/cBioPortalData.html</a></p>' +
      '<p>Although we recommend <a href="../#cbioportaldata-recommended">cBioPortalData</a> or <a href="../#cbioportalR-recommended">cbioportalR</a> for most use cases, it is possible to connect to the API directly using <a href="https://github.com/bergant/rapiclient">rapiclient</a>:</p>' +
      '<p>There are multiple ways to access the API using Python. One can use the <code translate="no">bravado</code> package to access the API directly, or use the <code translate="no">cbio_py</code> client, which provides a simple wrapper for the API and returns data in a format that is easy to work with.</p>' +
      "<p><em>Maintainer: Yelp</em></p>" +
      '<p>See the <code translate="no">cbio_py</code> documentation: <a href="https://pypi.org/project/cbio-py/">https://pypi.org/project/cbio-py/</a>.</p>' +
      "</div></main>"
  );
  const ps = [...doc.querySelectorAll("p")];
  assert.match(zh(ps[0].textContent), /^cBioPortal 提供 REST API，用于以编程方式访问数据。/);
  assert.equal(zh(ps[1].textContent), "API 的完整参考文档请见此处。");
  assert.equal(ps[1].querySelector("a").getAttribute("href"), "https://www.cbioportal.org/api/swagger-ui/index.html");
  assert.match(zh(ps[2].textContent), /^除 REST API 外，cBioPortal 还提供\s*模型上下文协议（MCP）\s*端点/);
  assert.equal(ps[2].querySelectorAll("a").length, 1);
  assert.equal(doc.querySelector("pre code").textContent, "https://mcp.cbioportal.org/db/mcp", "代码块整块不翻");
  const swagger = ps[3];
  assert.match(zh(swagger.textContent), /^cBioPortal REST API 使用 Swagger\/OpenAPI 描述/);
  assert.deepEqual([...swagger.querySelectorAll("code")].map((e) => e.textContent), ["curl", "Python", "R"]);
  assert.equal(swagger.querySelectorAll("a").length, 1);
  assert.equal(swagger.querySelector("a").getAttribute("href"), "https://swagger.io/tools/swagger-codegen/");
  const maintainers = ps[5];
  assert.match(zh(maintainers.textContent), /^维护者：Marcel Ramos Pérez、Levi Waldron$/);
  assert.equal(maintainers.querySelectorAll("a").length, 2);
  const guide = ps[6];
  assert.match(zh(guide.textContent), /^关于 cBioportalData 的完整用户指南请见：https:\/\/waldronlab\.io/);
  assert.equal(guide.querySelector("a").getAttribute("href"), "https://waldronlab.io/cBioPortalData/articles/cBioPortalData.html");
  const recommend = ps[7];
  assert.match(zh(recommend.textContent), /^尽管对大多数用例我们推荐 cBioPortalData 或 cbioportalR，也可以使用 rapiclient 直接连接 API：$/);
  assert.equal(recommend.querySelectorAll("a").length, 3);
  const py = ps[8];
  assert.match(zh(py.textContent), /^使用 Python 访问 API 有多种方式。/);
  assert.deepEqual([...py.querySelectorAll("code")].map((e) => e.textContent), ["bravado", "cbio_py"]);
  assert.equal(zh(ps[9].textContent), "维护者：Yelp");
  assert.equal(zh(ps[10].textContent), "参见 cbio_py 文档：https://pypi.org/project/cbio-py/。");
  assert.equal(zh(doc.querySelector("h3").textContent), "R 客户端");
});

// ---------------- 引擎行为：Deployment / Development / User Guide ----------------

test("Deployment / Development：带链接的说明句走模板，技术名保持英文", () => {
  const { doc } = mount(
    '<main><div class="relative retype-markdown" id="retype-content">' +
      '<h1 class="retype-primary-heading">Deployment</h1>' +
      '<h2 id="deployment-overview" class="retype-heading-2">Deployment Overview</h2>' +
      '<p>Private instances of cBioPortal are maintained by institutions and companies <a href="https://www.cbioportal.org/installations">around the world</a>.</p>' +
      "<p>As of v7, the only officially supported method to deploy cBioPortal is through Docker. The source code of cBioPortal is <a href=\"https://github.com/cBioPortal/cbioportal\">available</a> on GitHub under the terms of the <a href=\"https://www.apache.org/licenses/LICENSE-2.0\">Apache License 2.0</a>.</p>" +
      "<p>v7 replaced MySQL with <a href=\"https://clickhouse.com/\">ClickHouse</a>, which is now the only supported database. Run it self-hosted, as the Docker Compose setup does by default, or on <a href=\"https://clickhouse.com/cloud\">ClickHouse Cloud</a>, which is what backs cbioportal.org and genie.cbioportal.org.</p>" +
      "<p>Please note that installing a local version requires system administration skills; for example, installing and configuring Docker and ClickHouse. With limited resources, we cannot provide technical support on system administration.</p>" +
      '<h1 class="retype-primary-heading">Development</h1>' +
      '<p>cBioPortal is an open source project hosted on <a href="https://www.github.com/cbioportal/cbioportal">Github</a>. The core team will consider pull requests from any source.</p>' +
      '<p><a href="http://www.github.com/cbioportal/cbioportal-frontend">Frontend</a> (Typescript, React, Mobx)</p>' +
      '<p><a href="http://www.github.com/cbioportal/cbioportal">Backend</a> (Java, Spring, ClickHouse, MongoDB)</p>' +
      "</div></main>"
  );
  const ps = [...doc.querySelectorAll("p")];
  assert.equal(zh(ps[0].textContent), "cBioPortal 的私有实例由世界各地的机构与企业维护。");
  assert.equal(ps[0].querySelector("a").getAttribute("href"), "https://www.cbioportal.org/installations");
  assert.match(zh(ps[1].textContent), /^截至 v7，官方唯一支持的 cBioPortal 部署方式是通过 Docker。/);
  assert.match(zh(ps[1].textContent), /Apache License 2\.0 的条款在 GitHub 上可用。$/);
  assert.equal(ps[1].querySelectorAll("a").length, 2);
  assert.match(zh(ps[2].textContent), /^v7 用 ClickHouse 取代了 MySQL，它现在是唯一支持的数据库。/);
  assert.equal(ps[2].querySelectorAll("a").length, 2);
  assert.equal(zh(ps[2].querySelectorAll("a")[1].textContent), "ClickHouse Cloud");
  assert.match(zh(ps[3].textContent), /^请注意，安装本地版本需要系统管理技能/);
  assert.match(zh(ps[4].textContent), /^cBioPortal 是一个托管在 Github 上的开源项目。核心团队会考虑来自任何来源的拉取请求。$/);
  assert.equal(ps[4].querySelector("a").getAttribute("href"), "https://www.github.com/cbioportal/cbioportal");
  assert.equal(zh(ps[5].textContent), "前端 (Typescript, React, Mobx)");
  assert.equal(zh(ps[6].textContent), "后端 (Java, Spring, ClickHouse, MongoDB)");
  const hs = [...doc.querySelectorAll("h2")].map((e) => zh(e.textContent));
  assert.deepEqual(hs, ["部署概览"]);
});

test("User Guide：正文两段翻成中文", () => {
  const { doc } = mount(
    '<main><div class="relative retype-markdown" id="retype-content"><h1 class="retype-primary-heading">User Guide</h1>' +
      "<p>The cBioPortal for Cancer Genomics is a resource for interactive exploration of multidimensional cancer genomics data sets. The goal of cBioPortal is to significantly lower the barriers between complex genomic data and cancer researchers by providing rapid, intuitive, and high-quality access to molecular profiles and clinical attributes from large-scale cancer genomics projects, and therefore to empower researchers to translate these rich data sets into biologic insights and clinical applications.</p>" +
      "<p>The following section guides users in performing queries and analysis on any instance of cBioportal.</p></div></main>"
  );
  const ps = [...doc.querySelectorAll("p")].map((e) => zh(e.textContent));
  assert.match(ps[0], /^cBioPortal 癌症基因组学平台是用于交互式探索多维癌症基因组学数据集的资源。/);
  assert.match(ps[1], /^以下内容指导用户在任何 cBioportal 实例上执行查询与分析。$/);
});

// ---------------- 负例：不翻的东西保持英文 ----------------

test("负例：代码块、品牌缩写、参数与 URL 保持英文", () => {
  const { doc } = mount(
    '<main><div class="relative retype-markdown" id="retype-content">' +
      '<pre translate="no" class="language-none"><code class="language-none">Home\nSearch\nAssay\nDeployment</code></pre>' +
      "<p>cBioPortal</p><p>ClickHouse</p><p>OQL</p><p>MCP</p><p>webservice.do</p><p>MSK-IMPACT (Nat Med, 2017)</p><p>Ctrl K</p>" +
      '<p><code translate="no">cbioportal.org/api</code></p>' +
      "</div></main>"
  );
  assert.equal(zh(doc.querySelector("pre code").textContent).replace(/\s+/g, " "), "Home Search Assay Deployment");
  const texts = [...doc.querySelectorAll("p")].map((e) => zh(e.textContent));
  assert.deepEqual(texts, ["cBioPortal", "ClickHouse", "OQL", "MCP", "webservice.do", "MSK-IMPACT (Nat Med, 2017)", "Ctrl K", "cbioportal.org/api"]);
});

test("负例：下载格式名与纯数字/ID 不被误翻", () => {
  const { doc } = mount(
    '<main><div class="relative retype-markdown" id="retype-content">' +
      "<table><tbody><tr><td>JSON</td><td>CSV</td><td>MAF</td><td>VCF</td><td>NCI-U24CA274633</td><td>v7</td></tr></tbody></table>" +
      "</div></main>"
  );
  const tds = [...doc.querySelectorAll("td")].map((e) => zh(e.textContent));
  assert.deepEqual(tds, ["JSON", "CSV", "MAF", "VCF", "NCI-U24CA274633", "v7"]);
});

// ---------------- rules 行为 ----------------

test("rules：搜索面板的 Top N results / N results 按数字改写", () => {
  const { doc } = mount(
    '<main><div class="relative retype-markdown" id="retype-content">' +
      "<p>Top 20 results</p><p>3 results</p><p>1 result</p><p>Sorry, no results found.</p>" +
      "</div></main>"
  );
  const ps = [...doc.querySelectorAll("p")].map((e) => zh(e.textContent));
  assert.deepEqual(ps, ["前 20 条结果", "3 条结果", "1 条结果", "抱歉，未找到结果。"]);
});