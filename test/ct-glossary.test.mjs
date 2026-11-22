// ClinicalTrials.gov 术语表（#glossary）定义回归：整句定义、被 .term 内联链接切开的模版、
// 资助方类型清单的括号误伤（Industry）、父任务点名补的固定文案。
// 术语名本身由 clinicaltrials.test.mjs 覆盖，这里只管「定义句子」。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/clinicaltrials.json"), "utf8"));

const projectedSite = {
  id: "clinicaltrials",
  name: "ClinicalTrials.gov",
  hosts: ["clinicaltrials.gov", "www.clinicaltrials.gov"],
  dicts: ["common", "clinicaltrials"],
  scope: "body",
  attrs: ["value"],
  spa: true
};
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const configSite = sites.find((s) => s.id === "clinicaltrials");
const site = Object.assign({}, configSite || projectedSite, {
  id: "clinicaltrials",
  dicts: (configSite && configSite.dicts && configSite.dicts.length) ? configSite.dicts : ["common", "clinicaltrials"],
  scope: (configSite && configSite.scope) || "body",
  attrs: ["value"]
});

const data = { exact: {}, rules: [], templates: [] };
for (const id of site.dicts) {
  const b = JSON.parse(fs.readFileSync(path.join(root, "../dict", id + ".json"), "utf8"));
  Object.assign(data.exact, b.exact || {});
  data.rules = data.rules.concat(b.rules || []);
  data.templates = data.templates.concat(b.templates || []);
}

/** 术语表面板：<li class="glossary__item"> 里包一个术语按钮 + 定义 div */
function item(term) {
  return '<li class="glossary__item"><button class="data-glossary-term glossary__term">' + term +
    '</button><div class="glossary__definition" aria-hidden="true" style="display: none;">';
}
function run(html) {
  const dom = new JSDOM('<body><div id="glossary" class="glossary">' + html + "</div></body>");
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return dom.window.document;
}
function text(doc, sel) {
  const el = doc.querySelector(sel);
  return el ? el.textContent.replace(/\s+/g, " ").trim() : "";
}

test("术语表定义：纯文本整句进 exact，整句完整不截断", () => {
  const full = [
    "A measure of all deaths, due to any cause, that occur during a clinical study.",
    "Data collected at the beginning of a clinical study for all participants and for each arm or comparison group. These data include demographics, such as age, sex/gender, race and ethnicity, and study-specific measures (for example, systolic blood pressure, prior antidepressant treatment).",
    "The disease, disorder, syndrome, illness, or injury that is being studied. On ClinicalTrials.gov, conditions may also include other health-related issues, such as lifespan, quality of life, and health risks.",
    "The number of participants in a clinical study. The \"estimated\" enrollment is the target number of participants that the researchers need for the study."
  ];
  for (const k of full) {
    assert.ok(k in book.exact, "定义整句缺条目: " + k.slice(0, 60));
    assert.ok(/[\u4e00-\u9fff]/.test(book.exact[k]), "定义译文要有中文: " + k.slice(0, 40));
    assert.ok(!/\.\.\.$/.test(k), "定义不能截断: " + k.slice(0, 60));
  }
  // 单文本节点的定义走 exact：渲染后整句是中文，且不留英文整句
  const doc = run(item("Enrollment") +
    "The number of participants in a clinical study. The \"estimated\" enrollment is the target number of participants that the researchers need for the study.</div></li>");
  assert.equal(text(doc, ".glossary__definition"),
    "临床研究中参与者的人数。“预计”入组人数是研究者为该项研究所需要的目标参与者人数。");
  assert.ok(!/participants in a clinical study/.test(text(doc, ".glossary__definition")));
});

test("被 .term 链接切开的定义：模板整句翻，链接原位保留", () => {
  const pat = "A type of {{1}} that indicates whether people who do not have the {{2}} being studied can participate in that clinical study.";
  const tpl = book.templates.find((t) => t.pat === pat);
  assert.ok(tpl, "缺 Accepts healthy volunteers 的定义模板");
  const zhUsed = [...tpl.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  assert.deepEqual(zhUsed, [1, 2], "译文槽位要与原文一致");

  const doc = run(item("Accepts healthy volunteers") +
    'A type of <span class="term" data-term="eligibility criteria">eligibility criteria</span> that indicates whether people who do not have the ' +
    '<span class="term" data-term="condition/disease">condition/disease</span> being studied can participate in that clinical study.</div></li>');
  const def = doc.querySelector(".glossary__definition");
  assert.equal(def.textContent.replace(/\s+/g, " ").trim(),
    "一种合格性标准，用于说明没有所研究疾病/病症的人是否可以参加该临床研究。");
  // 两个内联术语链接都还在原位，文本也翻成中文（不是把链接吞掉）
  const terms = [...def.querySelectorAll("span.term")];
  assert.equal(terms.length, 2, "术语链接数量不能变");
  assert.deepEqual(terms.map((s) => s.textContent), ["合格性标准", "疾病/病症"]);
  assert.deepEqual(terms.map((s) => s.getAttribute("data-term")), ["eligibility criteria", "condition/disease"]);
  assert.ok(!/[A-Za-z]/.test(def.textContent), "整句不该留英文: " + def.textContent);
});

test("含 5 个内联术语的定义：一次性整句替换，术语逐个命中", () => {
  const doc = run(item("Arm type") +
    "A general description of the clinical trial arm. It identifies the role of the intervention that participants receive. Types of arms include " +
    '<span class="term">Experimental arm</span>, <span class="term">Active comparator arm</span>, ' +
    '<span class="term">Placebo comparator arm</span>, <span class="term">Sham comparator arm</span>, and ' +
    '<span class="term">No intervention arm</span>.</div></li>');
  const def = doc.querySelector(".glossary__definition");
  assert.equal(def.textContent.replace(/\s+/g, " ").trim(),
    "对临床试验组别的一般性描述，用于说明参与者所接受干预措施的作用。组别类型包括试验组、阳性对照臂、安慰剂对照臂、假手术对照臂和无干预组。");
  assert.equal(def.querySelectorAll("span.term").length, 5);
  assert.ok(!/[A-Za-z]/.test(def.textContent), "整句不该留英文: " + def.textContent);
});

test("定义里的多句长文：模板按整段匹配，不被规则拆成半中半英", () => {
  const doc = run(item("Data Monitoring Committee (DMC)") +
    'A group of independent scientists who monitor the safety and scientific integrity of a ' +
    '<span class="term">clinical trial</span>. The DMC can recommend to the sponsor that the trial be stopped if it is not effective, ' +
    "is harming participants, or is unlikely to serve its scientific purpose. Members are chosen based on the scientific skills and " +
    "knowledge needed to monitor the particular trial. Also called a data safety and monitoring board, or DSMB.</div></li>");
  const t = text(doc, ".glossary__definition");
  assert.ok(t.startsWith("一组独立科学家，负责监查临床试验的安全性与科学完整性。"), t.slice(0, 80));
  assert.ok(t.includes("也称为数据安全与监查委员会（DSMB）"), "结尾整句要翻: " + t.slice(-40));
  // DSMB/DMC 这类缩写保留是刻意的，只挡英文叙述词
  assert.ok(!/scientists|monitor|recommend|chosen|scientific purpose/.test(t), "不该留英文叙述: " + t);
});

test("资助方类型清单：Industry 整条走 exact，不被括号规则拆成半中半英", () => {
  // 词条本身就是整条（含括号说明），common 的 ^(.+?)\s*\((.+)\)$ 只换括号、
  // 括号内的说明照旧英文，所以这行必须整条登记，不能靠括号拆分。
  assert.equal(book.exact["Industry (for example: pharmaceutical and device companies)"],
    "产业界（例如：制药与器械公司）");

  const doc = run('<li class="glossary__item"><button class="glossary__term">Funder type</button>' +
    '<div class="glossary__definition">ClinicalTrials.gov refers to four types of funders: <ul>' +
    "<li>U.S. National Institutes of Health</li>" +
    '<li>Other U.S. Federal agencies (for example, <span class="term">U.S. Food and Drug Administration (FDA)</span>, ' +
    "Centers for Disease Control and Prevention, or U.S. Department of Veterans Affairs)</li>" +
    "<li>Industry (for example: pharmaceutical and device companies)</li>" +
    "<li>All others (including individuals, universities, and community-based organizations)</li></ul></div></li>");
  const lis = [...doc.querySelectorAll(".glossary__definition li")].map((li) => li.textContent.replace(/\s+/g, " ").trim());
  assert.deepEqual(lis, [
    "美国国立卫生研究院",
    "其他美国联邦机构（例如美国食品药品监督管理局（FDA）、美国疾病控制与预防中心或美国退伍军人事务部）",
    "产业界（例如：制药与器械公司）",
    "其他所有（含个人、大学与社区组织）"
  ]);
  assert.ok(!lis.some((s) => /Industry|for example|pharmaceutical/.test(s)), "清单里不该留英文: " + lis.join(" / "));
});

test("含嵌套列表的定义：列表项照翻，<ul> 结构与坑位不动", () => {
  // 引擎的模板通道只接受纯内联结构（含 <ul>/<p> 的块不整体替换），
  // 所以这里只保证列表项与结构：整块替换会把列表抹掉。
  const doc = run('<li class="glossary__item"><button class="glossary__term">Expanded access status</button>' +
    '<div class="glossary__definition"><ul>' +
    '<li><strong>Available:</strong> <span class="term">Expanded access</span> is currently available for this investigational treatment, ' +
    "and patients who are not participants in the clinical study may be able to gain access to the drug, biologic, or medical device being studied.</li>" +
    '<li><strong>No longer available:</strong> <span class="term">Expanded access</span> was available for this intervention previously ' +
    "but is not currently available and will not be available in the future.</li></ul></div></li>");
  const def = doc.querySelector(".glossary__definition");
  assert.equal(def.querySelectorAll("ul > li").length, 2, "列表结构不能丢");
  const first = def.querySelector("ul > li").textContent.replace(/\s+/g, " ").trim();
  assert.ok(first.includes("该在研治疗"), first);
  assert.ok(first.includes("药物、生物制品或医疗器械"), first);
  assert.ok(!/investigational treatment/.test(first), "列表项整句要翻: " + first);
});

test("父任务点名的固定文案与枚举", () => {
  const want = {
    "Delay Results Type": "延迟结果类型",
    "ClinicalTrials.gov identifier": "ClinicalTrials.gov 标识符",
    "and/or": "和/或",
    "Who can join clinical research?": "谁可以参加临床研究？",
    "What happens during clinical research?": "临床研究期间会发生什么？",
    "Failure to submit required clinical trial information": "未提交所需的临床试验信息"
  };
  for (const [k, v] of Object.entries(want)) {
    assert.equal(book.exact[k], v, "缺条目: " + k);
  }
  // and/or 嵌在标题里也要能翻（"Title and/or Title Acronym" 的 and/or 是独立文本节点）
  const doc = run('<h3>Sponsor and/or Collaborator</h3><p>Failure to submit required clinical trial information</p>');
  const body = doc.body.textContent.replace(/\s+/g, " ").trim();
  assert.ok(body.includes("和/或"), body);
  assert.ok(body.includes("未提交所需的临床试验信息"), body);
});

test("术语表定义里的示例值不翻：NCT 号、缩写、专有名词", () => {
  const doc = run(item("Title acronym") +
    "The acronym or initials used to identify a clinical study (not all studies have one). For example, the title acronym for the " +
    "Women's Health Initiative is \"WHI.\"</div></li>");
  const t = text(doc, ".glossary__definition");
  assert.ok(t.includes("WHI"), "示例缩写不翻: " + t);
  assert.ok(t.includes("Women's Health Initiative"), "项目专名不翻: " + t);
  assert.ok(t.startsWith("用于标识某项临床研究的缩写或首字母"), t.slice(0, 40));

  const doc2 = run(item("NCT number") +
    'A unique identification code given to each clinical <span class="term">study</span> registered on ClinicalTrials.gov. ' +
    'The format is "NCT" followed by an 8-digit number (for example, NCT00000419). Also called the ' +
    '<span class="term">ClinicalTrials.gov identifier (NCT number)</span>.</div></li>');
  const t2 = text(doc2, ".glossary__definition");
  assert.ok(t2.includes("NCT00000419"), "示例编号不翻: " + t2);
  assert.ok(t2.includes("ClinicalTrials.gov"), "站点名不翻: " + t2);
  assert.ok(!/unique identification code/.test(t2), "释义要翻: " + t2);
});
