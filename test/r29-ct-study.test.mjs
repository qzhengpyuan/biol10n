// ClinicalTrials.gov 研究详情页（r29）：Overview/Results/Eligibility/Contacts 各 tab 与展开项、
// 研究设计块（strong + ctg-glossary-ref + ctg-enum-value 三层切开）、结果页统计分析与年龄段/种族枚举、
// 被术语表自定义元素切断的参与标准残句、PI 免责模板（两个 <br> 槽位）、以及不该翻的边界。
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

function run(html) {
  const dom = new JSDOM("<body>" + html + "</body>");
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return dom.window.document;
}
function plain(doc) {
  return doc.body.textContent.replace(/\s+/g, " ").trim();
}

test("词库结构：新增条目齐全、规则锚定、模板槽位连续", () => {
  assert.equal(book.meta.family, "clinicaltrials");
  assert.ok(book.meta.sites.includes("clinicaltrials.gov"));
  assert.ok(Object.keys(book.exact).length >= 655, "exact 至少 655 条，实际 " + Object.keys(book.exact).length);
  assert.ok(book.rules.length >= 53, "rules 至少 53 条，实际 " + book.rules.length);
  assert.ok(book.templates.length >= 120, "templates 至少 120 条，实际 " + book.templates.length);

  const expected = {
    "No Results Posted": "未发布结果",
    "Study Start": "研究开始",
    "Primary Completion": "主要完成",
    "Study Completion": "研究完成",
    "Intervention/Treatment": "干预/治疗",
    "Parallel Assignment": "平行分配",
    "Open Label": "开放标签",
    "None (Open Label)": "无（开放标签）",
    "Primary Purpose": "主要目的",
    "Investigators": "研究者",
    "Study Chair": "研究主席",
    "Years and older": "岁及以上",
    "Name/Title": "姓名/职称",
    "Organization": "机构",
    "Phone": "电话",
    "Period Title": "阶段标题",
    "Received Treatment": "已接受治疗",
    "Not Completed": "未完成",
    "Physician Decision": "医生决定",
    "Withdrawal by Subject": "受试者退出",
    "Disease severity": "疾病严重程度",
    "Statistical Analysis Overview": "统计分析概览",
    "Type of Statistical Test": "统计检验类型",
    "Estimation Parameter": "估计参数",
    "All-Cause Mortality": "全因死亡率",
    "<=18 years": "≤18 岁",
    "Between 18 and 65 years": "18 至 65 岁之间",
    ">=65 years": "≥65 岁",
    "Hispanic or Latino": "西班牙裔或拉丁裔",
    "Native Hawaiian or Other Pacific Islander": "夏威夷原住民或其他太平洋岛民",
    "Confidence Interval": "置信区间",
    "Title Acronym": "标题缩写"
  };
  for (const [k, v] of Object.entries(expected)) assert.equal(book.exact[k], v, "缺词条或译文不符: " + k);

  const seen = new Set();
  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "键里不能有中文: " + k);
    assert.ok(/[\u4e00-\u9fff]/.test(v), "译文里必须有中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.ok(!seen.has(k), "重复键: " + k);
    seen.add(k);
  }
  for (const r of book.rules) {
    const re = new RegExp(r.re);
    assert.ok(/^\^.*\$$/.test(re.source), "规则必须整串锚定: " + r.re);
    assert.ok(!/[\u4e00-\u9fff]/.test(r.re), "规则里不能有中文: " + r.re);
    assert.ok(/[\u4e00-\u9fff]/.test(r.to), "规则译文里必须有中文: " + r.re);
    if (/\([^)]*\)/.test(r.re)) assert.ok(/\$\d/.test(r.to), "带捕获组的规则要用占位符: " + r.re);
  }
  for (const t of book.templates) {
    const used = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
    used.forEach((n, i) => assert.equal(n, i + 1, "槽位必须从 1 连续: " + t.pat));
    const zh = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
    assert.deepEqual(zh, used, "译文槽位要与原文一致: " + t.pat);
  }
});

test("详情页 tab 与 Overview 标签：Results 徽标与三个日期标签", () => {
  const doc = run(
    '<nav class="tabs"><ul>' +
      '<li><a href="/study/NCT02750826?tab=overview">Overview</a></li>' +
      '<li><a href="/study/NCT02750826?tab=results"><span>Results</span><span class="badge">No Results Posted</span></a></li>' +
      "</ul></nav>" +
      '<div class="study-overview"><div class="study-overview-item-title">Study Start ' +
      '<span class="item-title-exp"> (<span><span class="ctg-enum-value">Actual</span></span>)</span></div>' +
      '<div class="study-overview-item-title">Primary Completion ' +
      '<span class="item-title-exp"> (<span><span class="ctg-enum-value">Estimated</span></span>)</span></div>' +
      '<div class="study-overview-item-title">Study Completion ' +
      '<span class="item-title-exp"> (<span><span class="ctg-enum-value">Estimated</span></span>)</span></div>' +
      '<div class="study-overview-item-title">Enrollment <span class="item-title-exp"> (Actual)</span></div></div>'
  );
  const titles = [...doc.querySelectorAll(".study-overview-item-title")].map((d) => d.textContent.replace(/\s+/g, " ").trim());
  assert.ok(titles[0].includes("研究开始"), titles[0]);
  assert.ok(titles[0].includes("实际"), titles[0]);
  assert.ok(titles[1].includes("主要完成"), titles[1]);
  assert.ok(titles[1].includes("预计"), titles[1]);
  assert.ok(titles[2].includes("研究完成"), titles[2]);
  assert.ok(titles[3].includes("入组人数"), titles[3]);
  const text = plain(doc);
  assert.ok(text.includes("未发布结果"), text);
  assert.ok(!/Study Start|Primary Completion|No Results Posted/.test(text), "研究记录标签不能再是英文: " + text);
});

test("研究设计块：Primary Purpose 按真实 DOM（strong + ctg-glossary-ref + ctg-enum-value）翻", () => {
  // 真实结构见 https://clinicaltrials.gov/study/NCT02750826 的 Study Design：
  //   <div class="section-content"><strong>Primary Purpose <ctg-glossary-ref><i class="icon-display"></i></ctg-glossary-ref> : </strong>
  //   <span class="section-content"><ctg-enum-value><span>Treatment</span></ctg-enum-value></span></div>
  const doc = run(
    '<div class="section-content">' +
      '<strong>Primary Purpose <ctg-glossary-ref term="primary purpose">' +
      '<i class="icon-display" aria-label="opens glossary for primary purpose"><svg></svg></i></ctg-glossary-ref> : </strong>' +
      '<span class="section-content"><ctg-enum-value><span>Treatment</span></ctg-enum-value></span></div>' +
      '<div class="section-content"><strong>Intervention Model</strong> : <span>Parallel Assignment</span></div>' +
      '<div class="section-content"><strong>Masking</strong> : <span>None (Open Label)</span></div>'
  );
  // 内层 span 也带 .section-content，直接按 body 的顶层子节点取三行
  const rows = [...doc.body.children].map((d) => d.textContent.replace(/\s+/g, " ").trim());
  assert.ok(rows[0].includes("主要目的"), rows[0]);
  // 取值 "Treatment" 在 common 里被定为「处理组」，单节点翻不到「治疗」；这里锁住现状，避免悄悄改口径
  assert.ok(rows[0].includes("处理组"), rows[0]);
  assert.ok(rows[1].includes("平行分配"), rows[1]);
  assert.ok(rows[2].includes("无（开放标签）"), rows[2]);
});

test("设计块整串规则：扁平后的 Primary Purpose : X 命中枚举规则，裸 Treatment 不误伤", () => {
  const pairs = [
    ["Treatment", "主要目的：治疗"],
    ["Prevention", "主要目的：预防"],
    ["Diagnostic", "主要目的：诊断"],
    ["Supportive Care", "主要目的：支持性照护"],
    ["Screening", "主要目的：筛查"],
    ["Health Services Research", "主要目的：卫生服务研究"],
    ["Basic Science", "主要目的：基础科学"],
    ["Other", "主要目的：其他"]
  ];
  for (const [en, zh] of pairs) {
    const doc = run('<div class="flat">Primary Purpose : ' + en + "</div>");
    assert.equal(plain(doc), zh, en);
  }
  // 裸 Treatment 走 common（处理组），规则锚定整串，不会把组别名也改掉
  const doc = run("<table><tbody><tr><td>Placebo</td><td>Treatment</td></tr></tbody></table>");
  assert.deepEqual([...doc.querySelectorAll("td")].map((td) => td.textContent), ["安慰剂", "处理组"]);
});

test("结果页「组别」规则：Arm 1: 名称 翻成 组别 1：名称，人数保持", () => {
  const doc = run(
    '<table class="results"><tbody>' +
      "<tr><td>Arm/Group Title</td><td><span>Arm 1: Health Education Program</span></td><td><span>Arm 2: Usual Care</span></td></tr>" +
      "<tr><td>Overall Number of Participants Analyzed</td><td>3136</td><td>2045</td></tr>" +
      "</tbody></table>"
  );
  const text = plain(doc);
  assert.ok(text.includes("组别 1：Health Education Program"), text);
  assert.ok(text.includes("组别 2：Usual Care"), text);
  assert.ok(text.includes("3136") && text.includes("2045"), "人数是数据不该动: " + text);
});

test("结果页参与流程/不良事件表标签", () => {
  const doc = run(
    '<table class="flow"><thead><tr>' +
      "<th>Period Title</th><th>Started</th><th>Received Treatment</th><th>Not Completed</th>" +
      "</tr></thead><tbody><tr><td>Overall Study</td><td>1062</td><td>1059</td><td>3</td></tr></tbody></table>" +
      '<ul class="reasons"><li>Physician Decision</li><li>Transferred to another hospital</li><li>Withdrawal by Subject</li></ul>' +
      '<div class="ae"><span>Disease severity</span><span>Mild-to-moderate disease severity</span>' +
      "<span>Severe disease severity</span></div>"
  );
  const text = plain(doc);
  for (const zh of ["阶段标题", "已开始", "已接受治疗", "未完成", "医生决定", "转至其他医院",
    "受试者退出", "疾病严重程度", "轻至中度疾病严重程度", "重度疾病严重程度"]) {
    assert.ok(text.includes(zh), "缺 " + zh + " : " + text);
  }
  assert.ok(text.includes("1062") && text.includes("1059"), text);
});

test("结果页统计分析块：估计方法与检验类型标签", () => {
  const doc = run(
    '<section class="statistical"><h3>Statistical Analysis Overview</h3>' +
      "<div><span>Comparison Group Selection</span><span>Primary</span></div>" +
      "<div><span>Type of Statistical Test</span><span>Superiority</span></div>" +
      "<div><span>Statistical Test of Hypothesis</span><span>Log Rank</span></div>" +
      "<div><span>Method of Estimation</span><span>Cox Proportional Hazard</span></div>" +
      "<div><span>Estimation Parameter</span><span>Hazard Ratio</span></div>" +
      "<div><span>Estimated Value</span><span><span>P-Value</span> 0.031</span></div>" +
      "<div><span>Confidence Interval</span> 95% <span>1.02 to 1.48</span></div>" +
      "<div><span>Estimation Comments</span></div></section>"
  );
  const text = plain(doc);
  for (const zh of ["统计分析概览", "比较组选择", "主要", "统计检验类型", "优效性", "假设检验",
    "估计方法", "估计参数", "估计值", "P 值", "置信区间", "估计说明"]) {
    assert.ok(text.includes(zh), "缺 " + zh + " : " + text);
  }
  // 检验名（Log Rank / Cox Proportional Hazard）沿用册内既有口径：clinicaltrials.test.mjs 的
  // 「Placebo, Remdesivir | 优效性 | Log Rank」一条也把检验名钉成英文，这里保持一致
  assert.ok(text.includes("Log Rank") && text.includes("Cox Proportional Hazard"), "检验名不翻: " + text);
  assert.ok(text.includes("风险比"), "Estimation Parameter 取值 Hazard Ratio 复用 onco 册的译法: " + text);
  assert.ok(text.includes("0.031") && text.includes("1.02 to 1.48"), "数值不动: " + text);
});

test("年龄与种族/民族枚举：<=18 years 等整串翻，人数不动", () => {
  const doc = run(
    '<table class="demographics"><tbody>' +
      "<tr><td>&lt;=18 years</td><td>0</td></tr>" +
      "<tr><td>Between 18 and 65 years</td><td>2412</td></tr>" +
      "<tr><td>&gt;=65 years</td><td>724</td></tr>" +
      "<tr><td>Asian</td><td>310</td></tr>" +
      "<tr><td>White</td><td>2917</td></tr>" +
      "<tr><td>Native Hawaiian or Other Pacific Islander</td><td>12</td></tr>" +
      "<tr><td>Hispanic or Latino</td><td>289</td></tr>" +
      "<tr><td>Not Hispanic or Latino</td><td>2847</td></tr>" +
      "</tbody></table>"
  );
  const cells = [...doc.querySelectorAll("td:nth-child(1)")].map((td) => td.textContent);
  assert.deepEqual(cells, [
    "≤18 岁",
    "18 至 65 岁之间",
    "≥65 岁",
    "亚裔",
    "白人",
    "夏威夷原住民或其他太平洋岛民",
    "西班牙裔或拉丁裔",
    "非西班牙裔或拉丁裔"
  ]);
  assert.ok(plain(doc).includes("2917"), "人数不动");
});

test("参与标准（Eligibility）：被 ctg-glossary-ref 切开的残句按短语拼回中文", () => {
  const doc = run(
    '<div class="usa-prose"><div>Researchers look for people who fit a certain description, called ' +
      '<span><span class="glossary-link">eligibility criteria</span></span>. Some examples of these criteria are ' +
      "a person's general health condition or prior treatments.</div></div>"
  );
  const text = plain(doc);
  assert.ok(text.includes("研究者寻找符合特定描述的人，即"), text);
  assert.ok(text.includes("合格性标准"), text);
  assert.ok(text.includes("。这些标准的例子包括个人的总体健康状况或既往治疗。"), text);
  assert.ok(!/Researchers look for people|Some examples of these criteria/.test(text), "残句不能留英文: " + text);
});

test("Collaborators 规则：与其它册的「合作机构」不冲突", () => {
  const doc = run(
    '<section class="contacts"><h3>Collaborators</h3><h3>Investigators</h3>' +
      "<table><tbody><tr><td>Study Chair</td><td>Smith, John, M.D.</td></tr></tbody></table>" +
      "<p>This is where you will find people and organizations involved with this study.</p></section>"
  );
  const text = plain(doc);
  assert.ok(text.includes("合作方"), text);
  assert.equal(book.exact["Collaborator"], "合作方", "单数名词与 Collaborators 同义复用");
  assert.ok(text.includes("研究者"), text);
  assert.ok(text.includes("研究主席"), text);
  assert.ok(text.includes("这里列出了参与本研究的人员与组织。"), text);
  assert.ok(text.includes("Smith, John, M.D."), "人名是数据: " + text);
});

test("结果页 Principal Investigator 免责段：模板保留两个 <br>，其余不动", () => {
  const doc = run(
    '<div class="text-block">Principal Investigators are NOT employed by the organization sponsoring the study.<br><br>' +
      "There IS an agreement between Principal Investigators and the Sponsor (or its agents) that restricts the PI's " +
      "rights to discuss or publish trial results after the trial is completed</div>"
  );
  const block = doc.querySelector(".text-block");
  const text = plain(doc);
  assert.ok(text.includes("主要研究者不受开展研究的组织雇用。"), text);
  assert.ok(text.includes("主要研究者与申办方（或其代理机构）之间存在协议"), text);
  assert.equal(block.querySelectorAll("br").length, 2, "模板必须把两个 <br> 原样保留");
  assert.ok(!/Principal Investigators are NOT|There IS an agreement/.test(text), "整段不能残留英文: " + text);
});

test("检索页 Title Acronym 标签（左栏筛选的缩写字段）", () => {
  const doc = run(
    '<label class="usa-label" for="acronym">Title Acronym</label><input id="acronym" value="">' +
      '<div class="filter"><span>Study Type</span><span>Interventional</span></div>'
  );
  const text = plain(doc);
  assert.ok(text.includes("标题缩写"), text);
  assert.ok(text.includes("研究类型"), text);
});

test("不该翻的：NCT 号、药名、机构、日期、病名、论文题录", () => {
  const doc = run(
    '<ul class="kept"><li>NCT02750826</li><li>Kadcyla</li><li>Trastuzumab Emtansine</li>' +
      "<li>Karmanos Cancer Institute</li><li>2016-04-01</li><li>3136</li>" +
      "<li>Breast Neoplasms</li><li>Trastuzumab Emtansine Versus Trastuzumab in HER2-Positive Breast Cancer</li></ul>"
  );
  const items = [...doc.querySelectorAll(".kept li")].map((li) => li.textContent);
  assert.deepEqual(items, [
    "NCT02750826",
    "Kadcyla",
    "Trastuzumab Emtansine",
    "Karmanos Cancer Institute",
    "2016-04-01",
    "3136",
    "Breast Neoplasms",
    "Trastuzumab Emtansine Versus Trastuzumab in HER2-Positive Breast Cancer"
  ]);
});
