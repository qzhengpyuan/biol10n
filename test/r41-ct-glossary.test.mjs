// r41：ClinicalTrials.gov 术语表（#glossary）里「内联前缀 + 尾部 <p>/<ul>」形态的定义。
//
// 这 11 条定义的真实 DOM 是：前缀文本 + <span class="term"> 术语链接 … 然后接 <p>/<ul>。
// 逐节点翻会留下 "A type of / that indicates the age …" 这类碎片；整段 exact 又会把术语链接抹掉。
// 引擎的模板通道（r41 起）对这类容器只给「内联前缀」建模板，尾部块级节点替换后原序挂回，
// 所以这里用页面里抓下来的真实 outerHTML 断言：模板命中、译文整句、尾部 <p>/<ul> 与术语链接都在原位。
// 另两条前缀是单一文本节点、没有内联槽位（Results database / Sort studies by），走整节点 exact。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(here, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const book = JSON.parse(fs.readFileSync(path.join(here, "../dict/clinicaltrials.json"), "utf8"));

// 站点配置以 config/sites.json 为准（与线上加载一致）
const sites = JSON.parse(fs.readFileSync(path.join(here, "../config/sites.json"), "utf8")).sites;
const configSite = sites.find((s) => s.id === "clinicaltrials") || {};
const site = Object.assign({
  id: "clinicaltrials",
  dicts: ["common", "clinicaltrials"],
  scope: "body",
  attrs: ["value"]
}, configSite, {
  id: "clinicaltrials",
  dicts: (configSite.dicts && configSite.dicts.length) ? configSite.dicts : ["common", "clinicaltrials"],
  scope: configSite.scope || "body",
  attrs: ["value", "title", "aria-label"]
});

const data = { exact: {}, rules: [], templates: [] };
for (const id of site.dicts) {
  const b = JSON.parse(fs.readFileSync(path.join(here, "../dict", id + ".json"), "utf8"));
  Object.assign(data.exact, b.exact || {});
  data.rules = data.rules.concat(b.rules || []);
  data.templates = data.templates.concat(b.templates || []);
}

/** 页面里抓下来的原始 outerHTML（未经汉化；`__BIOL10N.disable()` 后取的） */
const DEFS = {
  // Age or age group
  "glossary-content-3": `<div class="glossary__definition" id="glossary-content-3" aria-hidden="true" style="display: none;">A type of <span class="term" data-term="eligibility criteria" tabindex="-1" title="opens glossary for eligibility criteria">eligibility criteria</span> that indicates the age a person must be to participate in a clinical study. This may be indicated by a specific age or the following age groups:<p>The age groups are: </p><ul><li>Child (birth-17)</li><li>Adult (18-64)</li><li style="margin-bottom:-.4em;">Older Adult (65+)</li></ul></div>`,
  // Expanded access
  "glossary-content-27": `<div class="glossary__definition" id="glossary-content-27" aria-hidden="true" style="display: none;">A way for patients with serious diseases or conditions who cannot participate in a clinical trial to gain access to a medical product that has not been approved by the <span class="term" data-term="u.s. food and drug administration (fda)" tabindex="-1" title="opens glossary for u.s. food and drug administration (fda)">U.S. Food and Drug Administration (FDA)</span>. Also called compassionate use.  There are different <span class="term" data-term="expanded access type" tabindex="-1" title="opens glossary for expanded access type">expanded access types</span>. <p style="margin-bottom:-.4em;">For more information, see FDA <a href="https://www.fda.gov/news-events/expanded-access/expanded-access-information-patients" class="usa-link usa-link--external" title="Expanded Access: Information for Patients (opens in a new tab)" aria-label="Expanded Access: Information for Patients (opens in a new tab)" target="_blank" rel="noopener noreferrer" tabindex="-1">Expanded Access: Information for Patients</a>.</p></div>`,
  // Expanded access type
  "glossary-content-29": `<div class="glossary__definition" id="glossary-content-29" aria-hidden="true" style="display: none;">Describes the category of <span class="term" data-term="expanded access" tabindex="-1" title="opens glossary for expanded access">expanded access</span> under <span class="term" data-term="u.s. food and drug administration (fda)" tabindex="-1" title="opens glossary for u.s. food and drug administration (fda)">U.S. Food and Drug Administration (FDA)</span> regulations. There are three types of expanded access: <ul><li><strong>Individual Patients</strong>: Allows a single patient, with a serious disease or condition who cannot participate in a clinical trial, access to a drug or biological product that has not been approved by the <span class="term" data-term="u.s. food and drug administration (fda)" tabindex="-1" title="opens glossary for u.s. food and drug administration (fda)">FDA</span>. This category also includes access in an emergency situation.</li><li><strong>Intermediate-size Population</strong>: Allows more than one patient (but generally fewer patients than through a Treatment IND/Protocol) access to a drug or biological product that has not been approved by the <span class="term" data-term="u.s. food and drug administration (fda)" tabindex="-1" title="opens glossary for u.s. food and drug administration (fda)">FDA</span>.  This type of expanded access is used when multiple patients with the same disease or condition seek access to a specific drug or biological product that has not been approved by the <span class="term" data-term="u.s. food and drug administration (fda)" tabindex="-1" title="opens glossary for u.s. food and drug administration (fda)">FDA</span>.</li><li><strong><a id="treatment-ind" tabindex="-1"></a>Treatment IND/Protocol</strong>: Allows a large, widespread population access to a drug or biological product that has not been approved by the <span class="term" data-term="u.s. food and drug administration (fda)" tabindex="-1" title="opens glossary for u.s. food and drug administration (fda)">FDA</span>. This type of expanded access can only be provided if the product is already being developed for marketing for the same use as the expanded access use.</li></ul></div>`,
  // FDAAA 801 Violations
  "glossary-content-34": `<div class="glossary__definition" id="glossary-content-34" aria-hidden="true" style="display: none;">A FDAAA 801 Violation is shown on a <span class="term" data-term="study record" tabindex="-1" title="opens glossary for study record">study record</span> when the <span class="term" data-term="u.s. food and drug administration (fda)" tabindex="-1" title="opens glossary for u.s. food and drug administration (fda)">U.S. Food and Drug Administration (FDA)</span> has issued a Notice of Noncompliance to the responsible party of an applicable clinical trial. A Notice of Noncompliance indicates that the <span class="term" data-term="u.s. food and drug administration (fda)" tabindex="-1" title="opens glossary for u.s. food and drug administration (fda)">FDA</span> has determined the responsible party was not in compliance with the registration or results reporting requirements for the clinical trial under the <span class="term" data-term="food and drug administration amendments act of 2007, section 801 (fdaaa 801)" tabindex="-1" title="opens glossary for food and drug administration amendments act of 2007, section 801 (fdaaa 801)">Food and Drug Administration Amendments Act of 2007, Section 801 (FDAAA 801)</span>.<p>The National Library of Medicine (NLM) is required by FDAAA 801 to add information to a study record about any FDAAA 801 Violation. This information is provided by the <span class="term" data-term="u.s. food and drug administration (fda)" tabindex="-1" title="opens glossary for u.s. food and drug administration (fda)">FDA</span>. There are three categories of information that may be included:</p><ul><li>Violation: Shown when the <span class="term" data-term="u.s. food and drug administration (fda)" tabindex="-1" title="opens glossary for u.s. food and drug administration (fda)">FDA</span> issues a Notice of Noncompliance and posts the Notice of Noncompliance on its designated webpage. There are three types of violations:<ul><li>Failure to submit required clinical trial information</li><li>Submission of false or misleading clinical trial information</li><li>Failure to submit primary and secondary outcomes</li></ul></li><li>Correction: Shown when the <span class="term" data-term="u.s. food and drug administration (fda)" tabindex="-1" title="opens glossary for u.s. food and drug administration (fda)">FDA</span> confirms that the responsible party has updated the study record to correct the violation and posts the correction notice on its designated webpage.  Because of the time for <span class="term" data-term="u.s. food and drug administration (fda)" tabindex="-1" title="opens glossary for u.s. food and drug administration (fda)">FDA</span> review and processing, there may be a delay between the date when the study record was updated and the addition of correction information to the FDAAA 801 Violation information. </li><li>Penalty: Shown when the <span class="term" data-term="u.s. food and drug administration (fda)" tabindex="-1" title="opens glossary for u.s. food and drug administration (fda)">FDA</span> imposes a penalty for the violation and posts the penalty notice on its designated webpage.</li></ul></div>`,
  // Funder type
  "glossary-content-39": `<div class="glossary__definition" id="glossary-content-39" aria-hidden="true" style="display: none;">Describes the organization that provides funding or support for a clinical study. This support may include activities related to funding, design, implementation, data analysis, or reporting. Organizations listed as <span class="term" data-term="sponsor" tabindex="-1" title="opens glossary for sponsor">sponsors</span> and <span class="term" data-term="collaborator" tabindex="-1" title="opens glossary for collaborator">collaborators</span> for a study are considered the funders of the study. ClinicalTrials.gov refers to four types of funders: <ul><li>U.S. National Institutes of Health</li><li>Other U.S. Federal agencies (for example, <span class="term" data-term="u.s. food and drug administration (fda)" tabindex="-1" title="opens glossary for u.s. food and drug administration (fda)">U.S. Food and Drug Administration (FDA)</span>, Centers for Disease Control and Prevention, or U.S. Department of Veterans Affairs)</li><li>Industry (for example: pharmaceutical and device companies)</li><li>All others (including individuals, universities, and community-based organizations)</li></ul></div>`,
  // Human subjects protection review board
  "glossary-content-42": `<div class="glossary__definition" id="glossary-content-42" aria-hidden="true" style="display: none;">A group of people who review, approve, and monitor the clinical study's <span class="term" data-term="protocol" tabindex="-1" title="opens glossary for protocol">protocol</span>. Their role is to protect the rights and welfare of people participating in a study (referred to as human research subjects), such as reviewing the <span class="term" data-term="informed consent form (icf)" tabindex="-1" title="opens glossary for informed consent form (icf)">informed consent form</span>. The group typically includes people with varying backgrounds, including a community member, to make sure that research activities conducted by an organization are completely and adequately reviewed. Also called an institutional review board, or IRB, or an ethics committee.<p>For more information, see <a title="Who can join clinical research? (opens in a new tab)" target="_blank" rel="noopener noreferrer" href="/study-basics/learn-about-studies#q3" class="usa-link" tabindex="-1">Who can join clinical research?</a> on this site.</p></div>`,
  // Informed consent
  "glossary-content-44": `<div class="glossary__definition" id="glossary-content-44" aria-hidden="true" style="display: none;">The process of learning and discussing the details, including the risks and potential benefits, of a <span class="term" data-term="clinical study" tabindex="-1" title="opens glossary for clinical study">clinical study</span> before deciding whether to take part. <p>For more information, see <a title="What happens during clinical research? (opens in a new tab)" target="_blank" rel="noopener noreferrer" href="/study-basics/learn-about-studies#q6" class="usa-link" tabindex="-1">What happens during clinical research?</a> on this site.</p></div>`,
  // Observational study
  "glossary-content-59": `<div class="glossary__definition" id="glossary-content-59" aria-hidden="true" style="display: none;">A type of <span class="term" data-term="clinical study" tabindex="-1" title="opens glossary for clinical study">clinical study</span> in which participants are identified as belonging to study groups and are assessed for biomedical or health outcomes. Participants may receive diagnostic, therapeutic, or other types of interventions, but the investigator does not assign participants to a specific <span class="term" data-term="intervention/treatment" tabindex="-1" title="opens glossary for intervention/treatment">intervention/treatment</span>.<p>A <span class="term" data-term="patient registry" tabindex="-1" title="opens glossary for patient registry">patient registry</span> is a type of observational study.</p></div>`,
  // Results database
  "glossary-content-88": `<div class="glossary__definition" id="glossary-content-88" aria-hidden="true" style="display: none;">A structured online system, such as the ClinicalTrials.gov results database, that provides the public with access to registration and summary results information for completed or terminated clinical studies. A study with results available on ClinicalTrials.gov is described as having the results "posted." <p><strong>Note:</strong> The ClinicalTrials.gov results database became available in September 2008. Older studies are unlikely to have results available in the database.</p></div>`,
  // Results submitted to ClinicalTrials.gov
  "glossary-content-95": `<div class="glossary__definition" id="glossary-content-95" aria-hidden="true" style="display: none;">Indicates that the study sponsor or investigator has submitted summary results information for a clinical study to ClinicalTrials.gov but the <span class="term" data-term="quality control (qc) review" tabindex="-1" title="opens glossary for quality control (qc) review">quality control (QC) review</span> process has not concluded.<p>The results submitted date indicates when the study sponsor or investigator first submitted summary results information or submitted changes to summary results information. Submissions with changes are typically in response to  QC review comments from the National Library of Medicine (NLM). If there is a date listed for results submitted to ClinicalTrials.gov, but there is not a subsequent date listed for <span class="term" data-term="results returned after quality control review" tabindex="-1" title="opens glossary for results returned after quality control review">results returned after quality control review</span>, this means that the submission is pending review by NLM.</p></div>`,
  // Sort studies by
  "glossary-content-101": `<div class="glossary__definition" id="glossary-content-101" aria-hidden="true" style="display: none;">The Sort studies by option is used to change the order of studies listed on the Search Results page. You can sort by Relevance or Newest First: <ul><li>Relevance: Studies that best match your search terms appear higher in the search results list. This is the default display for all searches.</li><li>Newest First: Studies with the most recent <span class="term" data-term="first posted" tabindex="-1" title="opens glossary for first posted">first posted</span> dates appear higher in the search results list.</li></ul></div>`,
};

const CASES = [
  { id: "glossary-content-3", tpl: true, spans: ["eligibility criteria"], tail: { p: 1, ul: 1, ulLi: 3 }, must: ["用于说明参加临床研究所需的年龄","年龄组包括：","老年人（65 岁及以上）"], not: ["A type of","that indicates the age","The age groups are"] },
  { id: "glossary-content-27", tpl: true, spans: ["u.s. food and drug administration (fda)","expanded access type"], tail: { p: 1, ul: 0, ulLi: 0 }, must: ["同情用药","扩展可及类型","更多信息请参见"], not: ["A way for patients","Also called compassionate use"] },
  { id: "glossary-content-29", tpl: true, spans: ["expanded access","u.s. food and drug administration (fda)"], tail: { p: 0, ul: 1, ulLi: 3 }, must: ["扩展可及分为以下三种类型","个体患者"], not: ["Describes the category of","There are three types"] },
  { id: "glossary-content-34", tpl: true, spans: ["study record","u.s. food and drug administration (fda)","u.s. food and drug administration (fda)","food and drug administration amendments act of 2007, section 801 (fdaaa 801)"], tail: { p: 1, ul: 1, ulLi: 3, nestedLi: 3 }, must: ["FDAAA 801 违规","违规通知","违规分为以下三种类型","未提交所需的临床试验信息","纠正：","罚款："], not: ["A FDAAA 801 Violation","Notice of Noncompliance","Shown when the"] },
  { id: "glossary-content-39", tpl: true, spans: ["sponsor","collaborator"], tail: { p: 0, ul: 1, ulLi: 4 }, must: ["资助方分为以下四种类型","产业界"], not: ["Describes the organization","four types of funders"] },
  { id: "glossary-content-42", tpl: true, spans: ["protocol","informed consent form (icf)"], tail: { p: 1, ul: 0, ulLi: 0 }, must: ["机构审查委员会（IRB）","知情同意书"], not: ["A group of people who review","Also called an institutional review board"] },
  { id: "glossary-content-44", tpl: true, spans: ["clinical study"], tail: { p: 1, ul: 0, ulLi: 0 }, must: ["了解并讨论某项","的过程。"], not: ["The process of learning"] },
  { id: "glossary-content-59", tpl: true, spans: ["clinical study","intervention/treatment"], tail: { p: 1, ul: 0, ulLi: 0 }, must: ["观察性研究的一种"], not: ["A type of 临床研究","in which participants"] },
  { id: "glossary-content-88", tpl: false, spans: [], tail: { p: 1, ul: 0, ulLi: 0 }, must: ["结果“已张贴”","ClinicalTrials.gov 结果数据库"], not: ["A structured online system"] },
  { id: "glossary-content-95", tpl: true, spans: ["quality control (qc) review"], tail: { p: 1, ul: 0, ulLi: 0 }, must: ["流程尚未结束"], not: ["Indicates that the study sponsor"] },
  { id: "glossary-content-101", tpl: false, spans: [], tail: { p: 0, ul: 1, ulLi: 2 }, must: ["研究排序方式","最新优先"], not: ["The Sort studies by"] },
];

function render(html) {
  const dom = new JSDOM('<body><div id="glossary" class="glossary"><div class="glossary__content">' +
    '<ul class="js-glossary-list"><li class="glossary__item">' +
    '<button class="data-glossary-term glossary__term">Term</button>' + html +
    "</li></ul></div></div></body>");
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  const el = dom.window.document.querySelector(".glossary__definition");
  return { el, engine, doc: dom.window.document };
}

const flat = (el) => String(el.textContent || "").replace(/\s+/g, " ").trim();
// 连续 4 个英文单词 = 还有整句没翻；单个专名（ClinicalTrials.gov、FDA、NCT…）不算
const ENGLISH_SENTENCE = /[A-Za-z][A-Za-z'\-]{1,}(?:\s+[A-Za-z][A-Za-z'\-]{1,}){3,}/;
const CJK = /[\u4e00-\u9fff]/;

test("术语表：内联前缀 + 尾部块级节点的定义整句汉化，不留碎片英文", () => {
  for (const c of CASES) {
    const { el } = render(DEFS[c.id]);
    assert.ok(el, c.id + " 没找到定义元素");
    const text = flat(el);
    assert.ok(CJK.test(text), c.id + " 没有中文: " + text.slice(0, 80));
    assert.ok(!ENGLISH_SENTENCE.test(text), c.id + " 仍残留英文整句: " + text.slice(0, 200));
    for (const s of c.not) assert.ok(!text.includes(s), c.id + " 不该留英文片段「" + s + "」: " + text.slice(0, 160));
    for (const s of c.must) assert.ok(text.includes(s), c.id + " 缺译文「" + s + "」: " + text.slice(0, 160));
  }
});

test("模板通道命中容器：前缀替换后打 data-biol10n-tpl，尾部 <p>/<ul> 原序保留", () => {
  for (const c of CASES) {
    const { el } = render(DEFS[c.id]);
    const tpl = el.getAttribute("data-biol10n-tpl");
    if (c.tpl) assert.equal(tpl, "1", c.id + " 应走模板通道（前缀模板），实际 tpl=" + tpl);
    // 尾部块级节点：数量与顺序都要原样回来
    const p = el.querySelectorAll(":scope > p");
    const ul = el.querySelectorAll(":scope > ul");
    assert.equal(p.length, c.tail.p, c.id + " 尾部 <p> 数量不对");
    assert.equal(ul.length, c.tail.ul, c.id + " 尾部 <ul> 数量不对");
    if (c.tail.ulLi) assert.equal(el.querySelectorAll(":scope > ul > li").length, c.tail.ulLi, c.id + " 尾部列表项数量不对");
    // 尾部块级节点必须接在前缀译文之后（不是被塞回前缀中间）
    if (c.tail.p || c.tail.ul) {
      const last = el.lastElementChild;
      assert.ok(last && (last.tagName === "P" || last.tagName === "UL"), c.id + " 尾部块级节点不在末尾");
    }
  }
});

test("术语链接原位保留：span.term 数量与 data-term 目标不变，链接文字已汉化", () => {
  for (const c of CASES) {
    const { el } = render(DEFS[c.id]);
    const spans = [...el.children].filter((n) => n.classList && n.classList.contains("term"));
    assert.equal(spans.length, c.spans.length, c.id + " 顶层术语链接数量变了");
    // zh 允许为中文语序调整槽位顺序（例如“说明{{2}}法规下{{1}}的类别”），所以按多重集比较
    const terms = spans.map((s) => s.getAttribute("data-term"));
    assert.deepEqual(terms.slice().sort(), c.spans.slice().sort(), c.id + " 术语链接目标变了");
    // 与词库既有约定一致：FDA / IRB 这类通用缩写保留原文，其余术语链接必须已汉化
    for (const s of spans) {
      const t = String(s.textContent || "").trim();
      assert.ok(CJK.test(t) || /^[A-Z][A-Z0-9()\/ .-]{0,14}$/.test(t), c.id + " 术语链接仍是英文: " + t);
    }
  }
});

test("模板 pat 与真实 DOM 的内联前缀一致（防词条与页面结构漂移）", () => {
  const INLINE = new Set(["A","ABBR","B","BDI","BDO","BR","CITE","CODE","DATA","DEL","DFN","EM","I","INS","KBD","MARK","Q","S","SAMP","SMALL","SPAN","FONT","STRONG","SUB","SUP","TIME","U","VAR","WBR","IMG"]);
  const norm = (s) => s
    .replace(/[\u00a0\u2000-\u200b\u3000]/g, " ")
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  const prefixPat = (html) => {
    const dom = new JSDOM("<body>" + html + "</body>");
    const el = dom.window.document.querySelector(".glossary__definition");
    const parts = [];
    let slots = 0;
    for (let c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) { parts.push(String(c.nodeValue || "")); continue; }
      if (c.nodeType === 8) continue;
      if (c.nodeType !== 1) break;
      if (!INLINE.has(c.tagName)) break;                 // 尾部块级节点从这里开始
      if (!String(c.textContent || "").trim()) continue;  // 空图标不占槽位
      slots++;
      parts.push("{{" + slots + "}}");
    }
    return { pat: norm(parts.join("")), slots };
  };
  for (const c of CASES) {
    const { pat, slots } = prefixPat(DEFS[c.id]);
    if (!slots) {
      // 没有内联槽位：建不出模板，前缀是单一文本节点 → 整节点 exact
      assert.equal(c.tpl, false, c.id + " 无槽位却按模板断言");
      assert.ok(Object.prototype.hasOwnProperty.call(book.exact, pat), c.id + " 缺整节点 exact 词条");
      continue;
    }
    const t = book.templates.find((x) => x.pat === pat);
    assert.ok(t, c.id + " 缺模板（pat 与真实 DOM 前缀不一致）: " + pat.slice(0, 90));
    const nums = (s) => (s.match(/\{\{(\d+)\}\}/g) || []).map((x) => Number(x.replace(/\D/g, "")));
    assert.deepEqual(nums(t.zh).sort(), nums(t.pat).sort(), c.id + " 模板槽位与原文不一致");
    assert.ok(CJK.test(t.zh), c.id + " 模板译文没有中文");
  }
});

test("FDAAA 801 违规：内层 <li>（自身还带 <ul>）同样整句汉化，内层列表 3 项不丢", () => {
  const { el } = render(DEFS["glossary-content-34"]);
  const outer = el.querySelector(":scope > ul");
  assert.ok(outer, "外层列表丢了");
  const lis = [...outer.children];
  assert.equal(lis.length, 3);
  assert.equal(lis[0].getAttribute("data-biol10n-tpl"), "1", "内层 <li> 应命中模板（前缀 + 尾部嵌套列表）");
  assert.equal(lis[0].querySelectorAll("ul > li").length, 3, "内层违规类型列表丢了");
  assert.ok(flat(lis[0]).includes("违规分为以下三种类型"), flat(lis[0]).slice(0, 120));
  assert.ok([...lis[0].querySelectorAll("ul > li")].every((li) => CJK.test(flat(li))), "内层列表项要是中文");
});
