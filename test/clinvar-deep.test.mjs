// ClinVar 剩余英文词库（dict/clinvar-deep.json）校验 + 引擎行为测试
// 覆盖：/clinvar/docs/submit/ 提交概览整页、变异页汇总说明与时间线标签、首页简介句
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/clinvar-deep.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "ncbi-clinvar");

// 生产上 common 与本册一起加载：规则里的 requireHit 依赖 common 的月份词条
const commonDict = JSON.parse(fs.readFileSync(path.join(root, "../dict/common.json"), "utf8"));

function mount(html, url = "https://www.ncbi.nlm.nih.gov/clinvar/docs/submit/") {
  const dom = new JSDOM(html, { url });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: dict.exact, rules: dict.rules, templates: dict.templates },
    site
  });
  engine.start();
  return dom.window.document;
}

// ---------------- 结构校验 ----------------

test("词库可解析，exact/rules/templates 三类都有内容", () => {
  assert.equal(dict.meta.family, "clinvar");
  assert.ok(Object.keys(dict.exact).length > 30, "exact 条目应多于 30 条");
  assert.ok(dict.rules.length >= 3, "rules 至少 3 条");
  assert.ok(dict.templates.length >= 8, "templates 至少 8 条");
});

test("关键条目存在（提交概览正文、变异页标签、时间线）", () => {
  const want = {
    "ClinVar welcomes submissions from:": "ClinVar 欢迎以下来源提交数据：",
    "clinical testing labs": "临床检测实验室",
    "ClinVar does not accept submissions directly from patients or patient family members.":
      "ClinVar 不接受患者本人或患者家属的直接提交。",
    "Somatic - Clinical impact": "体细胞 - 临床影响",
    "Somatic - Oncogenicity": "体细胞 - 致癌性",
    "Clinical impact": "临床影响",
    "Platform name": "平台名称",
    "more": "更多",
    "(less)": "（收起）"
  };
  for (const [k, v] of Object.entries(want)) {
    assert.equal(dict.exact[k], v, "缺少或值不符：" + k);
  }
  // 变异页那段「最后更新」说明（含弯引号）必须原样收进词表
  const lastUpd = Object.keys(dict.exact).find((k) => k.startsWith("This date represents the last time"));
  assert.ok(lastUpd, "缺少「This date represents …」说明句");
  assert.ok(/“most recent submission”/.test(lastUpd), "弯引号必须与页面原文一致");
});

test("rule 正则可编译，且能按预期改写实测原文", () => {
  for (const r of dict.rules) {
    assert.doesNotThrow(() => new RegExp(r.re), "坏正则：" + r.re);
    assert.ok(r.to.length > 0);
  }
  const tier = dict.rules.find((r) => r.re.includes("Tier I"));
  const hits = new RegExp(tier.re).exec("Tier I (Strong) for 15 tumor types");
  assert.ok(hits, "Tier I 规则应命中原文");
  assert.equal(tier.to.replace(/\$(\d)/g, (_, d) => hits[Number(d)]), "对 15 种肿瘤类型属 I 级（强）证据");
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

test("key 里没有中文，value 里没有明文 URL / 邮箱", () => {
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "key 含中文：" + k);
    assert.ok(!/https?:\/\/|[\w.+-]+@[\w-]+\.\w+/.test(v), "value 含 URL/邮箱：" + k);
  }
  for (const t of dict.templates) {
    assert.ok(!/https?:\/\/|[\w.+-]+@[\w-]+\.\w+/.test(t.zh), "译文含 URL/邮箱：" + t.pat.slice(0, 40));
  }
});

// ---------------- 引擎行为 ----------------

test("提交概览：整段正文、小节标题与来源列表翻成中文", () => {
  const doc = mount(
    '<div id="maincontent">' +
      "<p>Are you new to ClinVar submission? Read about the benefits of submitting to ClinVar and an overview of how submission works.</p>" +
      "<h4>Provide broad access</h4>" +
      "<p>ClinVar is a freely available database that is updated weekly. Submitting data to ClinVar makes it available to the worldwide clinical genetics ecosystem, so that laboratories and clinicians have up-to-date variant classifications from many sources.</p>" +
      "<p>ClinVar welcomes submissions from:</p>" +
      "<ul><li>clinical testing labs</li><li>research labs</li><li>genetics clinics</li><li>patient registries</li><li>locus-specific databases</li></ul>" +
      "<p>ClinVar does not accept submissions directly from patients or patient family members.</p>" +
      "</div>"
  );
  assert.match(doc.querySelector("p").textContent, /^刚接触 ClinVar 提交？/);
  assert.equal(doc.querySelector("h4").textContent, "提供广泛可用的数据");
  const ps = [...doc.querySelectorAll("p")].map((p) => p.textContent);
  assert.match(ps[1], /ClinVar 是一个每周更新的免费数据库/);
  assert.ok(!/freely available database/.test(ps[1]));
  assert.match(ps[2], /欢迎以下来源提交数据/);
  const lis = [...doc.querySelectorAll("li")].map((li) => li.textContent);
  assert.deepEqual(lis, ["临床检测实验室", "研究实验室", "遗传学诊所", "患者登记库", "位点特异性数据库"]);
  assert.match(ps[3], /不接受患者本人或患者家属的直接提交/);
});

test("提交概览：含链接的整句走模板，链接与邮箱地址都保住", () => {
  const doc = mount(
    '<div id="maincontent">' +
      '<p>Read <a href="/clinvar/docs/submission_get_started/">more specific instructions on how to get started with submission to ClinVar</a>, and contact us at <a href="mailto:clinvar@ncbi.nlm.nih.gov">clinvar@ncbi.nlm.nih.gov</a> with any questions.</p>' +
      "<p>Patients may also consider sharing their genetic testing results with a patient registry that submits deidentified data to ClinVar, like <a href=\"https://genomeconnect.org/\">GenomeConnect</a>.</p>" +
      "</div>"
  );
  const ps = [...doc.querySelectorAll("p")];
  assert.match(ps[0].textContent, /^阅读关于如何开始向 ClinVar 提交的更具体说明，如有任何问题请联系clinvar@ncbi\.nlm\.nih\.gov。$/);
  assert.equal(ps[0].querySelectorAll("a").length, 2);
  assert.equal(ps[0].querySelectorAll("a")[0].getAttribute("href"), "/clinvar/docs/submission_get_started/");
  assert.equal(ps[0].querySelectorAll("a")[1].getAttribute("href"), "mailto:clinvar@ncbi.nlm.nih.gov");
  assert.match(ps[1].textContent, /患者登记库，例如GenomeConnect。/);
});

test("首页简介：内联链接句走模板", () => {
  const doc = mount(
    '<div class="about-us"><span>ClinVar is a freely accessible, public archive of reports of human variations classified for diseases and drug responses, with supporting evidence. See the <a href="https://www.ncbi.nlm.nih.gov/clinvar/docs/news/"> latest release notes and articles about new features. </a> </span></div>',
    "https://www.ncbi.nlm.nih.gov/clinvar/"
  );
  const span = doc.querySelector("span");
  assert.match(span.textContent, /^ClinVar 是一个可自由访问的公开档案库/);
  // 链接文本自带首尾空白（页面原文如此），渲染时是一个空格，这里只断言前后文
  assert.match(span.textContent, /请参阅\s*latest release notes and articles about new features\.\s*$/);
  assert.equal(span.querySelector("a").getAttribute("href"), "https://www.ncbi.nlm.nih.gov/clinvar/docs/news/");
});

test("变异页：提交数「N out of M」与参与的提交数整句", () => {
  const doc = mount(
    '<div id="germline-somatic-info">' +
      '<span class="contrib-text"><span class="contrib-count"><a href="#new-submission-germline">6 out of 22</a></span> submissions contributed to this classification</span>' +
      "</div>",
    "https://www.ncbi.nlm.nih.gov/clinvar/variation/13961/"
  );
  const span = doc.querySelector(".contrib-text");
  assert.equal(span.textContent.replace(/\s+/g, " ").trim(), "22 条中的 6 条提交记录参与了该分类");
  assert.equal(span.querySelector("a").getAttribute("href"), "#new-submission-germline");
});

test("变异页：三种汇总说明（胚系/体细胞临床影响/致癌性）走模板并保住规则链接", () => {
  const doc = mount(
    '<div id="maincontent">' +
      '<p>The aggregate germline classification for this variant, typically for a monogenic or Mendelian disorder as in <a href="https://pubmed.ncbi.nlm.nih.gov/25741868/">the ACMG/AMP guidelines</a>, or for response to a drug. This value is calculated by NCBI based on data from submitters. <a href="/clinvar/docs/review_status/">阅读汇总分类的计算规则</a>.</p>' +
      '<p>The aggregate oncogenicity classification for this variant for one or more tumor types, using <a href="https://pubmed.ncbi.nlm.nih.gov/36063163/">the ClinGen/CGC/VICC terminology</a>. This value is calculated by NCBI based on data from submitters. <a href="/clinvar/docs/review_status/">阅读汇总分类的计算规则</a>.</p>' +
      "</div>",
    "https://www.ncbi.nlm.nih.gov/clinvar/variation/13961/"
  );
  const ps = [...doc.querySelectorAll("p")];
  assert.match(ps[0].textContent, /^该变异的汇总胚系分类，通常针对单基因或孟德尔遗传病（参见the ACMG\/AMP guidelines）/);
  assert.match(ps[0].textContent, /该值由 NCBI 根据提交者的数据计算。阅读汇总分类的计算规则。$/);
  assert.equal(ps[0].querySelectorAll("a")[0].getAttribute("href"), "https://pubmed.ncbi.nlm.nih.gov/25741868/");
  assert.match(ps[1].textContent, /^该变异针对一种或多种肿瘤类型的汇总致癌性分类/);
  assert.equal(ps[1].querySelectorAll("a").length, 2);
});

test("变异页：审核状态提示整段（星号说明 + 断言标准列说明）走模板", () => {
  const doc = mount(
    '<div id="germline-sub-review-status-icon" class="smaller pointer-triangle-parent"><p>Stars represent the review status, or the level of review supporting the submitted (SCV) record. This value is calculated by NCBI based on data from the submitter. <a href="/clinvar/docs/review_status/">阅读审核状态的计算规则</a>. This column also includes a link to the submitter’s assertion criteria if provided, and the collection method.</p></div>',
    "https://www.ncbi.nlm.nih.gov/clinvar/variation/12881/"
  );
  const p = doc.querySelector("p");
  assert.match(p.textContent, /^星号表示审核状态，即支持该提交（SCV）记录的审核级别。/);
  assert.match(p.textContent, /该列还包括提交者的断言标准（如有提供）及检测方法的链接。$/);
  assert.ok(!/This column also includes/.test(p.textContent));
});

test("变异页：体细胞分级短句、时间线标签、更多/收起", () => {
  const doc = mount(
    '<div id="maincontent">' +
      '<div class="single-item-value"><a href="#new-conditions-somatic">Tier I (Strong)&nbsp;for 15 tumor types</a>' +
      '<div class="sub_clinical_impact_summary"><a href="#new-conditions-somatic">+lower levels of evidence for 5 other tumor types</a></div></div>' +
      '<table class="timeline-table"><tbody><tr><td>Somatic - Clinical impact</td><td>Somatic - Oncogenicity</td></tr></tbody></table>' +
      '<div><span>Clinical impact</span></div>' +
      '<table id="submissions-somatic-list-clinical-impact-thead"><thead><tr><th>Clinical impact (# of submissions)</th></tr></thead></table>' +
      '<div class="assertion-list"><span>more</span> <a class="evidence_less" href="#">(less)</a></div>' +
      '<div id="id_first"><span>Platform name</span></div>' +
      "</div>",
    "https://www.ncbi.nlm.nih.gov/clinvar/variation/13961/"
  );
  const links = [...doc.querySelectorAll(".single-item-value a")].map((a) => a.textContent.trim());
  assert.deepEqual(links, ["对 15 种肿瘤类型属 I 级（强）证据", "另有 5 种肿瘤类型的较低级别证据"]);
  const tds = [...doc.querySelectorAll(".timeline-table td")].map((t) => t.textContent);
  assert.deepEqual(tds, ["体细胞 - 临床影响", "体细胞 - 致癌性"]);
  assert.equal(doc.querySelector("div > span").textContent, "临床影响");
  assert.equal(doc.querySelector("th").textContent, "临床影响（提交数）");
  assert.equal(doc.querySelector(".assertion-list span").textContent, "更多");
  assert.equal(doc.querySelector(".evidence_less").textContent, "（收起）");
  assert.equal(doc.querySelector("#id_first span").textContent, "平台名称");
});

test("变异页：「最后更新时间」说明整段翻成中文", () => {
  const doc = mount(
    '<div id="main_content"><p>This date represents the last time this VCV record was updated. The update may be due to an update to one of the included submitted records (SCVs), or due to an update that ClinVar made to the variant such as adding HGVS expressions or a rs number. So this date may be different from the date of the “most recent submission” reported at the top of this page.</p></div>',
    "https://www.ncbi.nlm.nih.gov/clinvar/variation/12881/"
  );
  const p = doc.querySelector("p").textContent;
  assert.match(p, /^该日期表示这条 VCV 记录最后一次更新的时间。/);
  assert.match(p, /「最近一次提交」日期不同。$/);
});

test("提交列表行首的「Oct 2024 by」日期整串翻成中文（月份走 common 词表）", () => {
  const dom = new JSDOM(
    '<div class="assertion-list"><div class="submitter-info smaller">Oct 2024 by <a href="#x">ClinGen Epilepsy Sodium Channel Variant Curation Expert Panel</a></div></div>',
    { url: "https://www.ncbi.nlm.nih.gov/clinvar/variation/12881/" }
  );
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: {
      exact: { ...commonDict.exact, ...dict.exact },
      rules: [...commonDict.rules, ...dict.rules],
      templates: dict.templates
    },
    site
  });
  engine.start();
  const doc = dom.window.document;
  const text = doc.querySelector(".submitter-info").textContent.replace(/\s+/g, " ").trim();
  assert.match(text, /^2024 年 10 月由 \S/, "实际输出：" + text);
  assert.equal(doc.querySelector(".submitter-info a").getAttribute("href"), "#x");
});

test("数据不翻：变异名、登录号、基因名、疾病名原样保留", () => {
  const doc = mount(
    '<div id="maincontent"><table><tbody>' +
      "<tr><td>NM_004333.6(BRAF):c.1799T&gt;A (p.Val600Glu)</td><td>VCV000013961.143</td><td>BRAF</td></tr>" +
      "<tr><td>Carcinoma of colon</td><td>Melanoma</td><td>RS113488022</td></tr>" +
      "</tbody></table></div>",
    "https://www.ncbi.nlm.nih.gov/clinvar/variation/13961/"
  );
  const tds = [...doc.querySelectorAll("td")].map((e) => e.textContent);
  assert.deepEqual(tds, [
    "NM_004333.6(BRAF):c.1799T>A (p.Val600Glu)",
    "VCV000013961.143",
    "BRAF",
    "Carcinoma of colon",
    "Melanoma",
    "RS113488022"
  ]);
});
