// ClinicalTrials.gov 深页（r30）：结果页基线特征枚举 / 指标类型 / 天数时间范围 / 入组人数括号，
// 检索页排序控件与 RSS、下载两个弹窗，记录历史页的版本表说明与模块列。
// 词条一律取自真实渲染 DOM（NCT04280705 结果页、search?cond=cancer&aggFilters=status:rec、
// NCT01810913 记录历史）；统计检验名与 MedDRA 事件术语沿用既有口径不翻。
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

test("词库结构：r30 新增条目齐全、规则整串锚定、模板槽位连续", () => {
  assert.equal(book.meta.family, "clinicaltrials");
  assert.ok(Object.keys(book.exact).length >= 689, "exact 至少 689 条，实际 " + Object.keys(book.exact).length);
  assert.ok(book.rules.length >= 55, "rules 至少 55 条，实际 " + book.rules.length);
  assert.ok(book.templates.length >= 120, "templates 至少 120 条，实际 " + book.templates.length);

  const expected = {
    // 结果页：基线特征里的种族枚举（与 cbioportal 册同译法）
    "American Indian or Alaska Native": "美洲印第安人或阿拉斯加原住民",
    "Black or African American": "黑人/非裔美国人",
    // 结果页：入组人数后面的括号是独立文本节点，必须整串收
    "Enrollment (": "入组人数（",
    // 检索页：排序控件与两个弹窗
    "Newest First": "最新优先",
    "Results to Download": "可下载的结果",
    "Studies may not be in the same order as in the search results": "研究顺序可能与检索结果中的顺序不同",
    "Note: Excel will incorrectly open a CSV file if any cell has more than 32,767 characters.": "注意：若任一单元格超过 32,767 个字符，Excel 会错误地打开该 CSV 文件。",
    "New studies first posted in the last 14 days": "最近 14 天内首次发布的新研究",
    "New and existing studies added or modified (last update posted) in the last 14 days": "最近 14 天内新增或修改（最后更新发布）的新建与已有研究",
    "Number of locations in the city": "该城市的地点数量",
    // 记录历史页：版本表与模块列
    "Study Record Versions": "研究记录版本",
    "This table shows all the versions of this study record arranged in order by submitted date.": "此表按提交日期顺序列出该研究记录的所有版本。",
    "To view one version of the study record, click the submitted date.": "要查看研究记录的某个版本，请点击提交日期。",
    "Data that is changed in the study record is color coded:": "研究记录中发生更改的数据以颜色标示：",
    "Deletions from the study record are shown crossed out in": "研究记录中的删除内容以删除线标示，颜色为",
    "red highlights": "红色高亮",
    "Additions to the study record are shown in": "研究记录中的新增内容以",
    "green highlights": "绿色高亮",
    "Date submitted": "提交日期",
    "Changes": "更改",
    "Compare": "比较",
    "None (earliest version on record)": "无（记录中最早的版本）",
    "Contacts/Locations": "联系人与地点",
    "Eligibility": "合格性标准",
    "Sponsor/Collaborators": "申办方/合作方",
    "Study Identification": "研究标识信息",
    "Study Description": "研究描述",
    "Oversight": "监管"
  };
  for (const [k, v] of Object.entries(expected)) assert.equal(book.exact[k], v, "缺词条或译文不符: " + k);

  const seen = new Set();
  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "键里不能有中文: " + k);
    assert.ok(/[\u4e00-\u9fff]/.test(v), "译文里必须有中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "键首尾不能有空白: " + JSON.stringify(k));
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

test("结果页基线特征：种族枚举补齐，计数不动", () => {
  // 真实 DOM：<table class="usa-table"><tbody><tr><td class="sticky-col"><span>American Indian or Alaska Native</span></td><td>12</td></tr>
  const doc = run(
    '<table class="baseline"><tbody>' +
      "<tr><td class=\"sticky-col\"><span>American Indian or Alaska Native</span></td><td>12</td></tr>" +
      "<tr><td class=\"sticky-col\"><span>Black or African American</span></td><td>309</td></tr>" +
      "<tr><td class=\"sticky-col\"><span>More than one race</span></td><td>27</td></tr>" +
      "<tr><td class=\"sticky-col\"><span>Hispanic or Latino</span></td><td>289</td></tr>" +
      "</tbody></table>"
  );
  const cells = [...doc.querySelectorAll("td:nth-child(1)")].map((td) => td.textContent.trim());
  assert.deepEqual(cells, ["美洲印第安人或阿拉斯加原住民", "黑人/非裔美国人", "多个种族", "西班牙裔或拉丁裔"]);
  const nums = [...doc.querySelectorAll("td:nth-child(2)")].map((td) => td.textContent);
  assert.deepEqual(nums, ["12", "309", "27", "289"], "人数是数据不该动");
});

test("结果页指标类型：Number 走专用规则，其余取值不受影响", () => {
  const cases = [
    ["Measure Type: Number | Unit of measure: participants", "指标类型：数值 | 计量单位：参与者"],
    ["Measure Type: Count of Participants | Unit of measure: Participants", "指标类型：参与者计数 | 计量单位：参与者"],
    ["Measure Type: Number (95% Confidence Interval) | Unit of Measure: percentage of participants", "指标类型：数值（95% 置信区间） | 计量单位：参与者百分比"],
    ["Measure Type: Number (95% Confidence Interval) | Unit of Measure: Proportion of participants", "指标类型：数值（95% 置信区间） | 计量单位：参与者比例"]
  ];
  for (const [en, zh] of cases) {
    const doc = run('<div class="group-description"><ctg-group-header>' + en + "</ctg-group-header></div>");
    assert.equal(plain(doc), zh, en);
  }
  // 专用规则只吃 Measure Type 这一串，裸 Number 不会被翻成「数值」
  const doc = run('<p><span>Number</span></p>');
  assert.equal(plain(doc), "Number", "裸 Number 保持原样（别的册里是编号/数量）");
});

test("结果页时间范围：Day 1 through Day 29 按固定句式翻，数字不动", () => {
  const pairs = [
    ["Day 1 through Day 29", "第 1 天至第 29 天"],
    ["Day 1 through Day 10", "第 1 天至第 10 天"],
    ["Day 1 through Day 15", "第 1 天至第 15 天"],
    ["Day 30 through Day 45", "第 30 天至第 45 天"]
  ];
  for (const [en, zh] of pairs) {
    const doc = run('<div class="group-info"><ctg-group-header>' + en + "</ctg-group-header></div>");
    assert.equal(plain(doc), zh, en);
  }
  // 置信区间括号里的 to 是数据范围，不动
  const doc = run('<td class="data-cell"><span class="cell-spread">(13 to 18)</span></td>');
  assert.equal(plain(doc), "(13 to 18)");
});

test("结果页 Study Design：Enrollment 后面挂着枚举值时整串翻，枚举值跟着翻", () => {
  const doc = run(
    '<div class="module-details-title margin-bottom-1">Enrollment (' +
      "<span><ctg-enum-value><span>Actual</span></ctg-enum-value></span>)</div>"
  );
  assert.equal(plain(doc), "入组人数（实际）");
});

test("检索页排序控件（Display 下拉）：标签与两个排序项都翻", () => {
  // 真实 DOM（点开 Display 后渲染）：<span class="sort-header"><label class="sort-label usa-label">Sort studies by</label>...
  const doc = run(
    '<ctg-search-display-options><form>' +
      '<span class="sort-header"><label for="sort-options" class="sort-label usa-label">Sort studies by</label>' +
      '<ctg-glossary-ref term="sort studies by"><i class="icon-display" aria-label="opens glossary for sort studies by" title="Opens glossary for sort studies by"></i></ctg-glossary-ref>&nbsp; </span>' +
      '<div class="radio-group">' +
      '<div class="usa-radio"><input type="radio" id="@relevance" value="@relevance"><label class="usa-radio__label" for="@relevance">Relevance</label></div>' +
      '<div class="usa-radio"><input type="radio" id="StudyFirstPostDate" value="StudyFirstPostDate"><label class="usa-radio__label" for="StudyFirstPostDate">Newest First</label></div>' +
      "</div></form></ctg-search-display-options>"
  );
  const labels = [...doc.querySelectorAll("label")].map((l) => l.textContent.trim());
  assert.deepEqual(labels, ["研究排序方式", "相关度", "最新优先"]);
  const i = doc.querySelector("i.icon-display");
  assert.equal(i.getAttribute("title"), "打开 研究排序方式 的术语说明");
  // value 是提交参数，不能动
  assert.equal(doc.querySelector('input[value="StudyFirstPostDate"]').getAttribute("value"), "StudyFirstPostDate");
});

test("检索页 RSS 弹窗：两条 Include 选项整句翻（<strong> 内联被拍平）", () => {
  const doc = run(
    '<div class="usa-modal"><div class="usa-modal__content">' +
      '<div class="usa-modal__main">' +
      '<h2 class="usa-modal__heading">Create RSS Feed</h2>' +
      "<p>Get updates on your search for:</p>" +
      '<div class="usa-radio"><input type="radio" id="StudyFirstPostDate" value="StudyFirstPostDate">' +
      '<label class="usa-radio__label rss-form" for="StudyFirstPostDate">New studies <strong>first posted</strong> in the last 14 days</label></div>' +
      '<div class="usa-radio"><input type="radio" id="LastUpdatePostDate" value="LastUpdatePostDate">' +
      '<label class="usa-radio__label rss-form" for="LastUpdatePostDate"> New and existing studies <strong>added</strong> or ' +
      "<strong>modified</strong> (<strong>last update posted</strong>) in the last 14 days </label></div>" +
      '<div class="usa-modal__footer"><button class="usa-button">Copy RSS Link</button></div>' +
      "</div></div></div>"
  );
  const text = plain(doc);
  assert.ok(text.includes("创建 RSS 订阅源"), text);
  assert.ok(text.includes("获取以下检索的更新："), text);
  const labels = [...doc.querySelectorAll("label.rss-form")].map((l) => l.textContent.replace(/\s+/g, " ").trim());
  assert.deepEqual(labels, [
    "最近 14 天内首次发布的新研究",
    "最近 14 天内新增或修改（最后更新发布）的新建与已有研究"
  ]);
  assert.ok(text.includes("复制 RSS 链接"), text);
  assert.ok(!/New studies|New and existing|in the last 14 days/.test(text), "弹窗里不该留英文: " + text);
});

test("检索页下载弹窗：分区标题、Excel 提示、顺序说明翻；Top 保留英文", () => {
  const doc = run(
    '<div class="usa-modal"><div class="usa-modal__main">' +
      '<h2 class="usa-modal__heading">What would you like to download?</h2>' +
      '<section><div class="section-label">File Format</div></section>' +
      "<section><div class=\"section-label\">Results to Download</div>" +
      '<div class="option"><label class="usa-radio__label">All 18,907 studies</label></div>' +
      '<div class="option last-option"><label class="usa-radio__label">Top</label><input type="number" class="usa-input top-input"></div>' +
      '<div class="margin-top-1">Studies may not be in the same order as in the search results</div></section>' +
      '<section><div class="section-label">Data Fields</div>' +
      '<span>Select fields (9):</span>' +
      '<label class="usa-checkbox__label">NCT Number</label>' +
      '<label class="usa-checkbox__label">Study Documents</label>' +
      '<div class="margin-top-1">Note: Excel will incorrectly open a CSV file if any cell has more than 32,767 characters.</div>' +
      "</section>" +
      '<div class="usa-modal__footer"><button class="usa-button primary-button">Download</button></div>' +
      "</div></div>"
  );
  const text = plain(doc);
  for (const zh of ["您要下载什么？", "文件格式", "可下载的结果", "全部 18,907 项研究", "数据字段",
    "选择字段（9）：", "NCT 编号", "研究文档", "注意：若任一单元格超过 32,767 个字符",
    "研究顺序可能与检索结果中的顺序不同", "下载"]) {
    assert.ok(text.includes(zh), "缺 " + zh + " : " + text);
  }
  // Top 是单数单词，别的册里已钉成「顶部」；本处语义是「前 N 项」，为免跨册冲突保持英文
  assert.ok(text.includes("Top"), "Top 保留英文: " + text);
  assert.equal(book.exact["Top"], undefined, "不要在本册新增 Top，会和 kegg/misc-extra 的「顶部」冲突");
});

test("记录历史页：版本表标题与三句固定说明翻，删除线结构保留", () => {
  const doc = run(
    '<ctg-study-record-versions-card><ctg-card title="Study Record Versions">' +
      '<h2 class="card-header">Study Record Versions</h2>' +
      '<div class="info"><ul>' +
      "<li>This table shows all the versions of this study record arranged in order by submitted date. </li>" +
      '<li class="no-bullet"><ul class="sub-list">' +
      "<li>To view one version of the study record, click the submitted date.</li>" +
      '<li>To compare two versions, select them using the check boxes and click "Compare" at the bottom of the list. ' +
      "<ul><li> Data that is changed in the study record is color coded: " +
      '<ul><li> Deletions from the study record are shown crossed out in ' +
      '<span class="ctg-diff-removed"><s>red highlights</s></span>. </li>' +
      "<li> Additions to the study record are shown in " +
      '<span class="ctg-diff-added">green highlights</span>. </li>' +
      "</ul></li></ul></li>" +
      "</ul></li></ul></div></ctg-card></ctg-study-record-versions-card>"
  );
  const text = plain(doc);
  for (const zh of ["研究记录版本", "此表按提交日期顺序列出该研究记录的所有版本。",
    "要查看研究记录的某个版本，请点击提交日期。",
    "要比较两个版本，请用复选框选中它们，再点击列表底部的“比较”。",
    "研究记录中发生更改的数据以颜色标示：",
    "研究记录中的删除内容以删除线标示，颜色为", "红色高亮",
    "研究记录中的新增内容以", "绿色高亮"]) {
    assert.ok(text.includes(zh), "缺 " + zh + " : " + text);
  }
  assert.ok(!/This table shows all|To view one version|To compare two versions|color coded/.test(text), "固定说明不能留英文: " + text);
  // 删除线是说明本身的一部分，不能被拍平掉
  const removed = doc.querySelector(".ctg-diff-removed");
  assert.ok(removed && removed.querySelector("s"), "删除线 <s> 必须保留");
  assert.equal(removed.querySelector("s").textContent.trim(), "红色高亮");
});

test("记录历史页：版本表的表头与模块列翻，日期列保留 YYYY-MM-DD 格式位", () => {
  const doc = run(
    "<table class=\"usa-table\"><thead><tr class=\"head-row\">" +
      '<th class="select-cell"></th><th class="version-col"> Version </th>' +
      '<th class="date-col"> Date submitted<br>(YYYY-MM-DD) </th>' +
      '<th class="module-cell"><div class="module-header"> Changes </div></th>' +
      "</tr></thead><tbody><tr><td></td><td>1</td><td>2019-01-23</td>" +
      "<td><ctg-history-changes-module-cell><div><ul class=\"no-bullet\">" +
      "<li>None (earliest version on record)</li></ul></div></ctg-history-changes-module-cell></td></tr>" +
      "<tr><td></td><td>2</td><td>2020-11-19</td>" +
      "<td><ctg-history-changes-module-cell><div><ul class=\"no-bullet\">" +
      "<li>Contacts/Locations</li><li>Eligibility</li><li>Sponsor/Collaborators</li>" +
      "<li>Study Identification</li><li>Study Description</li><li>Oversight</li>" +
      "</ul></div></ctg-history-changes-module-cell></td></tr>" +
      "</tbody></table>" +
      '<button class="usa-button primary-button">Compare</button>'
  );
  const heads = [...doc.querySelectorAll("th")].map((th) => th.textContent.replace(/\s+/g, " ").trim());
  assert.equal(heads[0], "");
  assert.equal(heads[1], "版本");
  assert.ok(heads[2].includes("提交日期"), heads[2]);
  assert.ok(heads[2].includes("YYYY-MM-DD"), "日期格式位保留: " + heads[2]);
  assert.equal(heads[3], "更改");
  const modules = [...doc.querySelectorAll("ctg-history-changes-module-cell li")].map((li) => li.textContent.trim());
  assert.deepEqual(modules, [
    "无（记录中最早的版本）",
    "联系人与地点", "合格性标准", "申办方/合作方",
    "研究标识信息", "研究描述", "监管"
  ]);
  assert.equal(doc.querySelector("button.primary-button").textContent, "比较");
  // 日期本身是数据
  assert.ok(plain(doc).includes("2019-01-23") && plain(doc).includes("2020-11-19"));
});

test("不该翻的：MedDRA 事件术语、结局指标标题、地区枚举、检验名、NCT 号", () => {
  // 既有口径：系统器官分类（SOC）有整条词条（"Respiratory, thoracic and mediastinal disorders"），
  // 具体事件术语（MedDRA PT）与结局指标标题属于研究数据，保持英文。
  const doc = run(
    '<div class="ae"><span class="group-title">Respiratory, thoracic and mediastinal disorders</span>' +
      '<table><tbody><tr><td class="sticky-col"><span>Acute respiratory failure</span></td></tr>' +
      "<tr><td class=\"sticky-col\"><span>Septic shock</span></td></tr>" +
      "<tr><td class=\"sticky-col\"><span>Anaemia</span></td></tr></tbody></table></div>" +
      '<div class="group-title">Time to Recovery</div>' +
      '<div class="group-title">39. 14-day Participant Mortality</div>' +
      '<div class="group-description">Placebo, Remdesivir | Superiority | Log Rank</div>' +
      '<table><tbody><tr><td class="sticky-col"><span>Greece</span></td></tr>' +
      "<tr><td class=\"sticky-col\"><span>South Korea</span></td></tr>" +
      "<tr><td class=\"sticky-col\"><span>United Kingdom</span></td></tr></tbody></table>" +
      "<p>NCT04280705</p>"
  );
  const text = plain(doc);
  for (const keep of ["Acute respiratory failure", "Septic shock", "Anaemia",
    "Time to Recovery", "14-day Participant Mortality", "Log Rank",
    "Greece", "South Korea", "United Kingdom", "NCT04280705"]) {
    assert.ok(text.includes(keep), "不该翻的: " + keep + " | " + text);
  }
  // SOC 标题沿用册内既有词条
  assert.ok(text.includes("呼吸系统、胸及纵隔疾病"), "SOC 标题照既有词条翻: " + text);
  assert.ok(text.includes("优效性"), "比较类型仍要翻: " + text);
});
