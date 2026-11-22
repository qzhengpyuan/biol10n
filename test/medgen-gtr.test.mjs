// NCBI MedGen / GTR 站词库（dict/medgen-gtr.json）冒烟测试：站点导航、记录页字段、检索页筛选与分页
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/medgen-gtr.json"), "utf8"));
const common = JSON.parse(fs.readFileSync(path.join(root, "../dict/common.json"), "utf8"));
const ncbi = JSON.parse(fs.readFileSync(path.join(root, "../dict/ncbi.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "ncbi-medgen");

// 站点实际加载的是 common + ncbi（本册接入后再加上本册），合并后的词表才是页面真实行为
const all = {
  exact: Object.assign({}, ncbi.exact, common.exact, dict.exact),
  rules: [...(common.rules || []), ...(ncbi.rules || []), ...dict.rules],
  templates: [...(common.templates || []), ...(ncbi.templates || []), ...(dict.templates || [])]
};

const CJK = /[\u4e00-\u9fff]/;

function engineFor(html, url, s) {
  const dom = new JSDOM(html, { url: url || "https://www.ncbi.nlm.nih.gov/medgen/1053035" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: all,
    site: s || site
  });
  engine.start();
  return { doc: dom.window.document, engine };
}

// 站点实际行为：条目或规则任一命中即算「有译文」
const anyEngine = engineFor("<p>x</p>").engine;
function covers(k) {
  return k in all.exact || anyEngine.translateText(k) !== null;
}

test("词库结构：family/sites 正确，exact 有足够条目且译文都含汉字", () => {
  assert.equal(dict.meta.family, "medgen-gtr");
  assert.ok(dict.meta.sites.includes("www.ncbi.nlm.nih.gov"));
  const keys = Object.keys(dict.exact);
  assert.ok(keys.length >= 200, "exact 只有 " + keys.length + " 条");
  let cjk = 0;
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.notEqual(v, k, "自映射: " + k);
    if (CJK.test(v)) { cjk++; continue; }
    // 纯标签类条目（MedGen 唯一标识符：/ PT Provider:）只换全角标点，允许无汉字
    assert.match(v, /[：（）]/, "译文既无汉字也无全角标点: " + k + " => " + v);
    assert.match(k, /:$/, "无汉字译文必须是冒号结尾的标签: " + k);
  }
  assert.ok(cjk >= Object.keys(dict.exact).length * 0.95, "含汉字条目太少: " + cjk);
  const tpl = dict.templates || [];
  assert.ok(Array.isArray(tpl), "templates 必须是数组");
  for (const t of tpl) {
    assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, "模板 pat 长度越界: " + t.pat.length);
    assert.match(t.zh, CJK, "模板译文不含汉字: " + t.pat);
    const slots = (t.pat.match(/\{\{\d+\}\}/g) || []).length;
    assert.ok(slots >= 1, "模板没有槽位: " + t.pat);
    for (let i = 1; i <= slots; i++) assert.ok(t.pat.includes("{{" + i + "}}"), "槽位不连续: " + t.pat);
    assert.equal((t.zh.match(/\{\{\d+\}\}/g) || []).length, slots, "译文槽位数不一致: " + t.pat);
    assert.doesNotMatch(t.zh, /[\w.+-]+@[\w-]+\.[\w.]+/, "模板译文含明文邮箱: " + t.pat);
  }
  for (const r of dict.rules) {
    assert.match(r.to, CJK, "规则译文不含汉字: " + r.re);
  }
});

test("条目卫生：key 里没有中文，值里没有明文 URL / 邮箱，首尾无空白", () => {
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.doesNotMatch(k, CJK, "key 含中文: " + k);
    assert.equal(k, k.trim(), "key 首尾有空白: " + JSON.stringify(k));
    assert.equal(v, v.trim(), "值首尾有空白: " + k);
    assert.doesNotMatch(v, /https?:\/\//i, "值含明文 URL: " + k);
    assert.doesNotMatch(v, /[\w.+-]+@[\w-]+\.[\w.]+/, "值含明文邮箱: " + k);
  }
});

test("MedGen 站点骨架：导航、首页区块、页脚说明句", () => {
  const must = [
    "MedGen Home",
    "MedGen Data Processing and Curation",
    "Definition Sources",
    "List of Professional Guidelines",
    "Searching MedGen",
    "Navigating MedGen records",
    "Connecting You to Medical Genetics Information",
    "Access/Download data",
    "Search for clinical concepts",
    "Disease names, IDs, keywords or genes",
    "More search options",
    "Quick links",
    "Phenotypes caused by CFTR",
    "Records in Mondo",
    "All MedGen records",
    "Download MedGen data via FTP reports",
    "Report of preferred names and identifiers used in GTR and ClinVar:",
    "Report gene-disease relationships used in ClinVar, Gene, GTR and MedGen:",
    "API / programmatic access",
    "Coverage of MedGen terms by source",
    "Primary Backbone",
    "Ontologies & Clinical Sources",
    "MedGen Curated",
    "Resources",
    "Patients",
    "Clinicians",
    "NIH Genetic Testing Registry (GTR)",
    "Medical Genetics Summaries",
    "NCBI's disclaimer policy",
    "Need Help? Contact MedGen.",
    "Email MedGen",
    "MedlinePlus Genetics (GHR)",
    "Genetic and Rare Diseases (GARD) Information Center"
  ];
  for (const k of must) assert.ok(covers(k), "缺少条目: " + k);
});

test("MedGen 记录页字段：Concept ID / Definition / 语义类型值不翻", () => {
  const must = [
    "MedGen UID:",
    "Concept ID:",
    "Monarch Initiative:",
    "Definition",
    "Professional guidelines",
    "Recent clinical studies",
    "Etiology",
    "Diagnosis",
    "Therapy",
    "Prognosis",
    "Clinical prediction guides",
    "Supplemental Content",
    "Table of contents",
    "Clinical resources",
    "Practice guidelines",
    "Consumer resources",
    "Related information",
    "Recent activity",
    "Go to:",
    "Free PMC Article",
    "View more",
    "View version history"
  ];
  for (const k of must) assert.ok(covers(k), "缺少条目: " + k);
  assert.ok(!("Disease or Syndrome" in dict.exact), "语义类型值不该进词库");
  assert.ok(!("Neoplastic Process" in dict.exact), "语义类型值不该进词库");
  assert.ok(!("BRCA1-related cancer predisposition" in dict.exact), "疾病名不该进词库");
});

test("MedGen 检索页：筛选面板、检索详情、每页条数", () => {
  const must = [
    "Search results",
    "Filter your results:",
    "Find related data",
    "Search details",
    "See more...",
    "Turn Off",
    "Items per page",
    "Summary",
    "Full Report",
    "Summary (Text)",
    "Summary (XML)",
    "Send to:",
    "Choose Destination"
  ];
  for (const k of must) assert.ok(covers(k), "缺少条目: " + k);
});

test("GTR 首页：检索框说明、帮助入口、内容分类与提交信息", () => {
  const must = [
    "Genetic Testing Registry",
    "Enter a gene, condition or laboratory and select from the autocomplete menu or enter the text of your search query.",
    "More help",
    "Advanced Search",
    "IMPORTANT NOTE:",
    "Watch how to search GTR",
    "About GTR®",
    "How to use GTR",
    "Frequently asked questions",
    "GTR in the community",
    "Contact us and provide feedback",
    "GTR Data",
    "FTP: Download GTR data and documents",
    "Worldwide Lab Participation in GTR",
    "GTR labs by country",
    "Microbe tests in GTR",
    "Find COVID-19 tests",
    "Find all microbe tests",
    "Search GeneReviews",
    "Find GTR Content",
    "Biochemical genetic tests",
    "Cancer tests",
    "Cardiovascular tests",
    "CGH tests",
    "Cytogenetic tests",
    "Human genome and Whole exome tests",
    "Mitochondrial genome tests",
    "Pharmacogenetic tests",
    "Single gene tests",
    "All GTR data",
    "Submitting Information to GTR",
    "Access the Submission User Interface",
    "How to submit data",
    "Code of Conduct",
    "Submission templates",
    "Locate a Genetics Professional",
    "ABGC Directory",
    "ABMGG Directory",
    "NSGC Directory",
    "NCI Cancer Genetics Services Directory",
    "ACMG Genetics Clinics Database",
    "Resources Included in GTR",
    "See a list of all related resources"
  ];
  for (const k of must) assert.ok(covers(k), "缺少条目: " + k);
});

test("GTR 检测列表：筛选分组、表头、固定枚举值", () => {
  const must = [
    "NIH Genetic Testing Registry",
    "Filters",
    "New filters have been added to narrow your search:",
    "Test type",
    "Test target",
    "Test purpose",
    "Test method",
    "Test service",
    "Specimen type",
    "Certification",
    "Lab service",
    "Laboratory location",
    "Other countries",
    "Finding tests for",
    "Lab name",
    "Tests matching your search",
    "Labs matching your search",
    "Tests names and labs",
    "Genes, analytes, and microbes",
    "Drug Response",
    "Monitoring",
    "Mutation Confirmation",
    "Pre-symptomatic",
    "Predictive",
    "Prognostic",
    "Recurrence",
    "Risk Assessment",
    "Screening",
    "Therapeutic management",
    "Biochemical Genetics",
    "Cytogenetics",
    "Molecular Genetics",
    "Immunohistochemistry",
    "Fluorescence in situ hybridization (FISH)",
    "Deletion/duplication analysis",
    "Detection of homozygosity",
    "Methylation analysis",
    "Microsatellite instability testing (MSI)",
    "Mutation scanning of select exons",
    "Mutation scanning of the entire coding region",
    "RNA analysis",
    "Sequence analysis of select exons",
    "Targeted variant analysis",
    "Clinical Testing/Confirmation of Mutations Identified Previously",
    "Confirmation of research findings",
    "Custom Deletion/Duplication Testing",
    "Custom mutation-specific/Carrier testing",
    "Custom Prenatal Testing",
    "Custom Sequence Analysis",
    "Data Storage and Backup",
    "Genetic counseling",
    "Identity Testing",
    "Maternal cell contamination study (MCC)",
    "Preimplantation Genetic Diagnosis (PGD)",
    "Result interpretation",
    "Uniparental Disomy (UPD) Testing",
    "X-Chromosome Inactivation Studies",
    "Whole Exome Sequencing",
    "Whole Genome Sequencing",
    "Amniocytes",
    "Buccal swab",
    "Cell-free DNA",
    "Dried blood spot (DBS) card",
    "Peripheral (whole) blood",
    "CLIA certified",
    "CAP certification",
    "NYS CLEP certification",
    "UI List"
  ];
  for (const k of must) assert.ok(covers(k), "缺少条目: " + k);
  // 实验室名 / 国家州名不翻
  for (const k of ["Ambry Genetics", "GeneDx", "Mayo Clinic Laboratories", "Alabama (1)", "United States"]) {
    assert.ok(!(k in dict.exact), "机构名/地名不该进词库: " + k);
  }
});

test("GTR 检测记录页：分区标题与字段标签", () => {
  const must = [
    "GTR Home",
    "Classic view of this page",
    "On this page",
    "At a Glance",
    "Ordering Information",
    "Test Targets",
    "Methodology",
    "Clinical Information",
    "Technical Information",
    "Regulatory Approval",
    "Additional Information",
    "Clinical Genetic Test",
    "offered by",
    "View lab's test page",
    "View lab's website",
    "GTR Test Accession:",
    "Test purpose:",
    "Target population:",
    "Clinical validity:",
    "Clinical utility:",
    "Offered by:",
    "Test short name:",
    "Specimen Source:",
    "View specimen requirements",
    "Who can order:",
    "Test Order Code:",
    "Lab contact:",
    "Contact Policy:",
    "How to Order:",
    "Order URL",
    "Test additional service:",
    "Test development:",
    "Informed consent required:",
    "Test strategy:",
    "Pre-test genetic counseling required:",
    "Post-test genetic counseling required:",
    "Decline to answer",
    "Total conditions:",
    "Total genes:",
    "Total methods:",
    "Condition/Phenotype",
    "Identifier",
    "Lab-provided information",
    "Associated Condition",
    "Germline or Somatic",
    "Allele (Lab-provided)",
    "Variant in NCBI",
    "Method Category",
    "Instrument",
    "Variant Interpretation:",
    "Recommended fields not provided:",
    "Test Procedure:",
    "Test Confirmation:",
    "Availability:",
    "Tests performed",
    "Entire test performed in-house",
    "Test performance comments",
    "Analytical Validity:",
    "Proficiency testing (PT):",
    "Method used for proficiency testing:",
    "Formal PT program",
    "PT Provider:",
    "Software used to interpret novel variations",
    "Laboratory's policy on reporting novel variations",
    "FDA Review:",
    "FDA exercises enforcement discretion",
    "Suggested reading:",
    "Molecular resources:",
    "Like what you see?",
    "Genetic Counselor",
    "Licensed Physician",
    "Test developed by laboratory (no manufacturer test name)",
    "Exon(s): Full coding sequence and flanking introns",
    "INHERITED DISEASE",
    "INHERITED DISEASE SUSCEPTIBILITY",
    "CANCER",
    "SYNDROMIC DISEASE",
    "Avoidance of invasive testing",
    "Establish or confirm diagnosis",
    "Guidance for management",
    "Predictive risk information for patient and/or family members"
  ];
  for (const k of must) assert.ok(covers(k), "缺少条目: " + k);
});

test("规则正则合法，且在真实原文上给出预期译文", () => {
  for (const r of dict.rules) assert.doesNotThrow(() => new RegExp(r.re), "坏正则: " + r.re);
  const { engine } = engineFor("<p>x</p>");
  const cases = [
    ["Items: 14", "条目：14"],
    ["All (49)", "全部（49）"],
    ["Records in GTR (14)", "GTR 中的记录（14）"],
    ["Records in Orphanet (5)", "Orphanet 中的记录（5）"],
    ["Diseases (11)", "疾病（11）"],
    ["Recommended for clinicians (14)", "推荐给临床医生（14）"],
    ["See all (2)", "查看全部（2）"],
    ["All 687 Gene records", "全部 687 条基因记录"],
    ["See brca1 in MedGen (8)", "在 MedGen 中查看 brca1（8）"],
    ["Search all 63465 tests, 29487 conditions, 18772 genes, and 341 labs", "检索全部 63465 项检测、29487 种疾病、18772 个基因和 341 家实验室"],
    ["Page 1 of 31", "第 1 页，共 31 页"],
    ["Single gene tests (93)", "单基因检测（93）"],
    ["Panels (2-10 genes) (97)", "组合检测（2-10 个基因）（97）"],
    ["Panels (>11 genes) (427)", "组合检测（>11 个基因）（427）"],
    ["Exomes (42)", "外显子组（42）"],
    ["Genomes (1)", "基因组（1）"],
    ["Clinical (615)", "临床（615）"],
    ["Research (3)", "科研（3）"],
    ["Enter text above to search from 7359 gene symbols", "在上方输入文字，从 7359 个基因符号中检索"],
    ["Enter text above to search from 6956 condition names", "在上方输入文字，从 6956 个疾病名称中检索"],
    ["Conditions (2):", "疾病（2）："],
    ["Genes (1):", "基因（1）："],
    ["Methods (2):", "方法（2）："],
    ["Last updated in GTR: 2026-02-05", "GTR 中最后更新：2026-02-05"],
    [", last updated: 2025-02-07", "，最后更新：2025-02-07"],
    [", registered in GTR: 2013-07-09", "，在 GTR 中登记：2013-07-09"],
    ["Last annual review date for the lab: 2026-02-06", "实验室上次年度审核日期：2026-02-06"],
    ["Amniocytes (21)", "羊水细胞（21）"],
    ["Peripheral (whole) blood (346)", "外周（全）血（346）"],
    ["CLIA certified (411)", "CLIA 认证（411）"],
    ["NYS CLEP certification (202)", "NYS CLEP 认证（202）"],
    ["View citations (1)", "查看引用（1）"],
    ["View citations (12)", "查看引用（12）"]
  ];
  for (const [src, want] of cases) {
    assert.equal(engine.translateText(src), want, "原文: " + src);
  }
  assert.match(engine.translateText("Mode of inheritance: Autosomal dominant inheritance"), /^遗传方式：/);
  assert.match(engine.translateText("Test purpose: Diagnosis; Mutation Confirmation"), /^检测目的：/);
});

test("跨册改写条目走规则：Conditions / Send to: / Research / Prognostic", () => {
  const { engine } = engineFor("<p>x</p>");
  assert.equal(engine.translateText("Conditions"), "疾病");
  assert.equal(engine.translateText("Send to:"), "发送到：");
  assert.equal(engine.translateText("Research"), "科研");
  assert.equal(engine.translateText("Prognostic"), "预后性");
});

test("MedGen 记录页渲染：字段标签翻、值（ID / 语义类型 / 疾病名）不翻", () => {
  const { doc } = engineFor(
    '<div id="maincontent"><h1>BRCA1-related cancer predisposition</h1>' +
      '<dl class="rprt"><dt>MedGen 唯一标识符：</dt><dd>1053035</dd><dt>Concept ID:</dt><dd>CN377757</dd></dl>' +
      '<div class="rprt_section"><h2>Definition</h2><p>Hereditary cancer predisposition due to variation(s) in the BRCA1 gene.</p></div>' +
      '<div class="rprt_section"><h2>Professional guidelines</h2><p>See all (2)</p></div>' +
      '<div><span class="label">Monarch Initiative:</span> <a href="#">MONDO:0700268</a></div>' +
      '<div class="goto"><a href="#">Go to:</a></div>' +
      '<h2>Recent clinical studies</h2><h3>Etiology</h3><h3>Diagnosis</h3><h3>Therapy</h3><h3>Prognosis</h3>' +
      '<h2>Supplemental Content</h2><h2>Table of contents</h2><h2>Clinical resources</h2></div>'
  );
  const dts = [...doc.querySelectorAll("dt")].map((x) => x.textContent);
  assert.deepEqual(dts, ["MedGen 唯一标识符：", "概念 ID："]);
  assert.equal(doc.querySelector("h1").textContent, "BRCA1-related cancer predisposition", "疾病名不该被翻");
  const heads = [...doc.querySelectorAll("h2, h3")].map((x) => x.textContent);
  assert.ok(heads.includes("定义"), "Definition 未翻: " + heads.join("/"));
  assert.ok(heads.includes("专业指南"));
  assert.ok(heads.includes("近期临床研究"));
  assert.ok(heads.includes("病因学"));
  assert.ok(heads.includes("诊断"));
  assert.ok(heads.includes("治疗"));
  assert.ok(heads.includes("预后"));
  assert.ok(heads.includes("补充内容"));
  assert.match(doc.querySelector(".goto a").textContent, /^跳转到：/);
  assert.equal([...doc.querySelectorAll(".rprt_section p")].map((x) => x.textContent).join("|"), "Hereditary cancer predisposition due to variation(s) in the BRCA1 gene.|查看全部（2）");
  assert.equal(doc.querySelector(".label").textContent, "Monarch Initiative：");
  assert.match(doc.body.textContent, /CN377757/);
});

test("GTR 检测列表渲染：筛选标签（计数在 span 内 / 在文本内两种写法）都翻", () => {
  const gtr = sites.find((s) => s.id === "ncbi-gtr");
  const { doc, engine } = engineFor(
    '<div id="maincontent"><h2>Filters</h2>' +
      '<h3>Test type</h3><label><input type="checkbox">Clinical <span class="count">(615)</span></label>' +
      '<label><input type="checkbox">Research <span class="count">(3)</span></label>' +
      '<h3>Test target</h3><label><input type="checkbox">Single gene tests (93)</label>' +
      '<label><input type="checkbox">Panels (2-10 genes) (97)</label>' +
      '<label><input type="checkbox">Exomes (42)</label>' +
      '<h3>Test purpose</h3><label><input type="checkbox">Diagnosis <span class="count">(526)</span></label>' +
      '<h3>Specimen type</h3><label><input type="checkbox">Amniocytes (21)</label>' +
      '<p>Page 1 of 31</p>' +
      '<table><thead><tr><th>Lab name</th><th>Tests matching your search</th><th>Conditions</th><th>Methods</th></tr></thead></table></div>',
    "https://www.ncbi.nlm.nih.gov/gtr/all/tests/?term=BRCA1",
    gtr
  );
  const labels = [...doc.querySelectorAll("label")].map((x) => x.textContent.replace(/\s+/g, " ").trim());
  assert.deepEqual(labels, [
    "临床 (615)",
    "科研 (3)",
    "单基因检测（93）",
    "组合检测（2-10 个基因）（97）",
    "外显子组（42）",
    "诊断 (526)",
    "羊水细胞（21）"
  ]);
  assert.equal(doc.querySelector("p").textContent, "第 1 页，共 31 页");
  const th = [...doc.querySelectorAll("th")].map((x) => x.textContent);
  assert.deepEqual(th, ["实验室名称", "与您检索匹配的检测", "疾病", "方法"]);
  assert.equal(engine.translateText("Mayo Clinic Laboratories"), null, "实验室名不该被翻");
});
test("模板：MedGen 规划公告句（邮箱是内联元素，只能走槽位）", () => {
  const { doc } = engineFor(
    '<div class="notice"><span>We are planning the future of MedGen. Contact us at ' +
      '<a href="#">medgen_help@ncbi.nlm.nih.gov</a> to tell us how it can work better for you.</span></div>'
  );
  assert.equal(
    doc.querySelector(".notice").textContent,
    "我们正在规划 MedGen 的未来。请通过 medgen_help@ncbi.nlm.nih.gov 告诉我们如何让它更好地为您服务。"
  );
  // 词库里不允许出现明文邮箱，邮箱只能由页面内联元素带出来
  for (const v of Object.values(dict.exact)) assert.doesNotMatch(v, /@ncbi\.nlm\.nih\.gov/);
  for (const t of dict.templates || []) assert.doesNotMatch(t.zh, /@ncbi\.nlm\.nih\.gov/);
});
