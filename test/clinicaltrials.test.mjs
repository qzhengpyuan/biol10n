// ClinicalTrials.gov 词库（clinicaltrials）回归：顶栏/.gov 横幅、检索页与筛选面板、研究记录字段与结局表、结果页表标签、About 文档、模板与 requireHit 属性
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

// 站点条目以 config/sites.json 为准（父级还没加 clinicaltrials 时用这里约定的同款配置）。
const projectedSite = {
  id: "clinicaltrials",
  name: "ClinicalTrials.gov",
  hosts: ["clinicaltrials.gov", "www.clinicaltrials.gov"],
  dicts: ["common", "clinicaltrials"],
  scope: "body",
  attrs: ["value"],
  spa: true,
  waitFor: "app-root .search-results, app-root .record-header, app-root main"
};
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const configSite = sites.find((s) => s.id === "clinicaltrials");
// attrs:["value"] 是硬性要求：检索页/研究页的按钮文案在 input 的 value 上。
const site = Object.assign({}, configSite || projectedSite, {
  id: "clinicaltrials",
  dicts: (configSite && configSite.dicts && configSite.dicts.length) ? configSite.dicts : ["common", "clinicaltrials"],
  scope: (configSite && configSite.scope) || "body",
  attrs: ["value"]
});
const dictIds = Array.isArray(site.dicts) && site.dicts.length ? site.dicts : ["common", "clinicaltrials"];

const data = { exact: {}, rules: [], templates: [] };
for (const id of dictIds) {
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

test("词库结构：条数、键值形态、规则可编译、模板槽位连续", () => {
  assert.equal(book.meta.family, "clinicaltrials");
  assert.ok(book.meta.sites.includes("clinicaltrials.gov"), "meta.sites 要声明 host");
  assert.ok(Object.keys(book.exact).length >= 400, "exact 至少 400 条");
  assert.ok(book.rules.length >= 25, "rules 至少 25 条");
  assert.ok(Array.isArray(book.templates), "templates 必须是数组");

  const seen = new Set();
  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "键里不能有中文: " + k);
    assert.ok(/[\u4e00-\u9fff]/.test(v), "译文里必须有中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "键首尾不能有空白: " + JSON.stringify(k));
    assert.ok(!/https?:\/\/[^\s）]+\.[a-z]/i.test(v), "译文里不能有明文 URL: " + k);
    assert.ok(!/@[\w.-]+\.[a-z]/i.test(v), "译文里不能有邮箱: " + k);
    assert.ok(!seen.has(k), "重复键: " + k);
    seen.add(k);
  }
  for (const r of book.rules) {
    const re = new RegExp(r.re);
    assert.ok(re.source.length > 0);
    assert.ok(/[\u4e00-\u9fff]/.test(r.to), "规则译文里必须有中文: " + r.re);
    if (/\([^)]*\)/.test(r.re)) assert.ok(/\$\d/.test(r.to), "带捕获组的规则要用到占位符: " + r.re);
  }
  for (const t of book.templates) {
    const used = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.ok(used.length >= 1, "模板要带槽位: " + t.pat);
    assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, "模板长度越界: " + t.pat.length);
    const sorted = used.slice().sort((a, b) => a - b);
    sorted.forEach((n, i) => assert.equal(n, i + 1, "槽位必须从 1 连续: " + t.pat));
    const zhUsed = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.deepEqual(zhUsed.slice().sort((a, b) => a - b), sorted, "译文槽位要与原文一致");
  }
});

test("站点条目：dicts 里 common 在前、本册在后", () => {
  assert.deepEqual(site.dicts, ["common", "clinicaltrials"], "common 必须垫底，本册覆盖在其上");
  assert.ok(site.hosts.includes("clinicaltrials.gov"));
  assert.ok(Array.isArray(site.attrs) && site.attrs.includes("value"), "input 按钮文案依赖 attrs:value");
});

test("顶栏与页脚：导航项翻成中文且 href 不动", () => {
  const doc = run(
    '<nav class="usa-nav"><ul>' +
      '<li><a href="/find-studies">Find Studies</a></li>' +
      '<li><a href="/study-basics">Study Basics</a></li>' +
      '<li><a href="/submit-studies">Submit Studies</a></li>' +
      '<li><a href="/data-api">Data and API</a></li>' +
      '<li><a href="/policy">Policy</a></li>' +
      '<li><a href="/about-site">About this site</a></li>' +
      "</ul></nav>" +
      '<footer><a href="/about-site/disclaimer">Disclaimer</a><a href="/about-site/accessibility">Accessibility</a></footer>'
  );
  const links = [...doc.querySelectorAll("a")].map((a) => [a.textContent, a.getAttribute("href")]);
  assert.deepEqual(links, [
    ["查找研究", "/find-studies"],
    ["研究基础知识", "/study-basics"],
    ["提交研究", "/submit-studies"],
    ["数据与 API", "/data-api"],
    ["政策", "/policy"],
    ["关于本站", "/about-site"],
    ["免责声明", "/about-site/disclaimer"],
    ["无障碍", "/about-site/accessibility"]
  ]);
});

test(".gov 官方横幅：固定说明句", () => {
  const doc = run(
    '<section class="usa-banner"><p>An official website of the United States government</p>' +
      "<button>Here’s how you know</button>" +
      "<p><strong>Official websites use .gov</strong></p>" +
      "<p>A <strong>.gov</strong> website belongs to an official government organization in the United States.</p>" +
      "</section>"
  );
  const text = plain(doc);
  assert.ok(text.includes("美国政府官方网站"), text);
  assert.ok(text.includes("识别方法"), text);
  assert.ok(text.includes("官方网站使用 .gov"), text);
  assert.ok(text.includes("网站属于美国官方政府机构"), text);
});

test("检索页头部：保存研究/版本号/研究总数走规则", () => {
  const doc = run(
    '<div class="search-header"><p>My Saved Studies (0)</p>' +
      "<span>Revision: v3.8.1</span>" +
      "<p>All 124,968 studies</p></div>"
  );
  const text = plain(doc);
  assert.ok(text.includes("我的已保存研究（0）"), text);
  assert.ok(text.includes("版本：v3.8.1"), text);
  assert.ok(text.includes("全部 124,968 项研究"), text);
});

test("检索详情行：Viewing 被 strong 打断也翻成中文", () => {
  const doc = run(
    '<p><strong>Search Details: </strong><span>Viewing 1-10 out of <strong>124,968</strong> studies for: cancer</span></p>'
  );
  const text = plain(doc);
  assert.ok(text.includes("检索详情"), text);
  assert.ok(text.includes("显示第 1–10 项，共 124,968 项研究"), text);
  assert.ok(text.includes("检索词：cancer"), "检索词是用户输入，保留原文: " + text);
});

test("筛选面板：标签翻中文、计数是独立节点保持原样", () => {
  const doc = run(
    '<fieldset class="filters"><legend>Status</legend>' +
      '<label><input type="checkbox"><span>Recruiting</span><span class="count">(18,907)</span></label>' +
      '<label><input type="checkbox"><span>Not yet recruiting</span><span class="count">(6,523)</span></label>' +
      '<label><input type="checkbox"><span>Completed</span><span class="count">(53,908)</span></label>' +
      "</fieldset>" +
      '<div class="actions"><button>Apply filters</button><button>More filters</button><button>Clear Filters (1)</button></div>'
  );
  const text = plain(doc);
  assert.ok(text.includes("状态"), text);
  assert.ok(text.includes("招募中"), text);
  assert.ok(text.includes("尚未招募"), text);
  assert.ok(text.includes("已完成"), text);
  assert.ok(text.includes("(18,907)") && text.includes("(6,523)"), "计数不该被翻掉: " + text);
  assert.ok(text.includes("应用筛选条件"), text);
  assert.ok(text.includes("更多筛选"), text);
  assert.ok(text.includes("清除筛选条件（1）"), text);
});

test("研究记录头部：字段名翻中文，NCT 号与机构名保持原文", () => {
  const doc = run(
    '<div class="record-header"><h1>Adaptive COVID-19 Treatment Trial (ACTT)</h1>' +
      "<p><span>ClinicalTrials.gov ID</span><span>NCT04280705</span></p>" +
      "<p><span>Sponsor</span><span>National Institute of Allergy and Infectious Diseases (NIAID)</span></p>" +
      "<p><span>Information provided by</span><span>National Institute of Allergy and Infectious Diseases (NIAID)</span><span>(Responsible Party)</span></p>" +
      "<p><span>Last Update Posted</span><span>2022-03-14</span></p>" +
      "<p><span>Completed</span></p></div>"
  );
  const text = plain(doc);
  assert.ok(text.includes("Adaptive COVID-19 Treatment Trial (ACTT)"), "研究标题不翻: " + text);
  assert.ok(text.includes("ClinicalTrials.gov 编号"), text);
  assert.ok(text.includes("NCT04280705"), "NCT 号不翻: " + text);
  assert.ok(text.includes("申办方"), text);
  assert.ok(text.includes("信息提供方"), text);
  assert.ok(text.includes("责任方"), text);
  assert.ok(text.includes("最后更新发布"), text);
  assert.ok(text.includes("已完成"), text);
  assert.ok(text.includes("National Institute of Allergy and Infectious Diseases (NIAID)"), "机构名不翻: " + text);
});

test("研究字段区：分区标题、Phase、统计分析序号、关键词提供方", () => {
  const doc = run(
    '<section class="study-details"><h2>Study Overview</h2>' +
      "<h3>Contacts and Locations</h3><h3>Eligibility Criteria</h3><h3>Study Design</h3>" +
      "<h3>Arms and Interventions</h3><h3>Outcome Measures</h3>" +
      "<p>Phase</p><p>Statistical Analysis 1</p>" +
      "<p>Keywords Provided by <span>NIAID</span></p>" +
      "<p>Show all 6 locations</p><p>This study has 60 locations</p></section>"
  );
  const text = plain(doc);
  assert.ok(text.includes("研究概览"), text);
  assert.ok(text.includes("联系人与地点"), text);
  assert.ok(text.includes("合格性标准"), text);
  assert.ok(text.includes("研究设计"), text);
  assert.ok(text.includes("研究分组与干预措施"), text);
  assert.ok(text.includes("结局指标"), text);
  assert.ok(text.includes("研究阶段"), text);
  assert.ok(text.includes("统计分析 1"), text);
  assert.ok(text.includes("关键词提供方"), text);
  assert.ok(text.includes("显示全部 6 个地点"), text);
  assert.ok(text.includes("本研究有 60 个地点"), text);
});

test("结果页表格：时间范围表头、统计量组合、比较类型、结局类型", () => {
  const doc = run(
    "<table><thead><tr><th>Time Frame</th></tr></thead><tbody>" +
      "<tr><td>| Time Frame:</td></tr>" +
      "<tr><td>Mean (Standard Deviation) | Unit of measure: years</td></tr>" +
      "<tr><td>Median (95% Confidence Interval) | Unit of Measure: Days</td></tr>" +
      "<tr><td>Placebo, Remdesivir | Superiority | Log Rank</td></tr>" +
      "<tr><td>Secondary</td></tr>" +
      "<tr><td>Adverse Event Reporting Description</td></tr>" +
      "</tbody></table>"
  );
  const text = plain(doc);
  assert.ok(text.includes("| 时间范围："), text);
  assert.ok(text.includes("均值（标准差）| 计量单位：年"), text);
  assert.ok(text.includes("中位数（95% 置信区间）| 计量单位：天"), text);
  assert.ok(text.includes("Placebo, Remdesivir | 优效性 | Log Rank"), "分组名与检验名不翻: " + text);
  assert.ok(text.includes("次要"), text);
  assert.ok(text.includes("不良事件报告说明"), text);
});

test("模板：免责声明段被子 strong 打断仍整段翻掉", () => {
  const doc = run(
    '<button class="usa-button"><p class="usa-alert__text">' +
      "ClinicalTrials.gov is a website and online database of clinical research studies and information about their results. " +
      "The National Library of Medicine (NLM) maintains the website. " +
      "<strong>The study sponsor or investigator submits information</strong> about their study to ClinicalTrials.gov and " +
      "<strong>is responsible for the safety, science, and accuracy</strong> of any study they list. </p></button>"
  );
  const text = plain(doc);
  assert.ok(text.includes("网站与在线数据库"), text);
  assert.ok(text.includes("美国国家医学图书馆（NLM）"), text);
  assert.ok(text.includes("研究申办方或研究者向 ClinicalTrials.gov 提交其研究信息"), text);
  assert.ok(text.includes("并对所列任一研究的安全性、科学性与准确性负责"), text);
  assert.ok(!/ClinicalTrials\.gov is a website/.test(text), "整段不该留英文");
});

test("固定说明句与链接夹断的句子：逐文本节点翻", () => {
  const doc = run(
    '<label class="location-label">Search by address, city, state, zip code, or country. For information on using this field, see the</label>' +
      '<div class="disclaimer-note"><p>Read our full <a href="/about-site/disclaimer">disclaimer</a> for details.</p></div>' +
      '<div class="eligibility"><p>Before joining a study, talk to your health care professional about possible risks and benefits. To learn more about taking part in studies, read <a href="/study-basics/learn-about-studies">Learn About Studies</a>.</p></div>'
  );
  const text = plain(doc);
  assert.ok(text.includes("可按地址、城市、州、邮政编码或国家检索"), text);
  assert.ok(text.includes("有关此字段的用法，参见"), text);
  assert.ok(text.includes("阅读完整的免责声明"), text);
  assert.ok(text.includes("了解详情"), text);
  assert.ok(text.includes("参加研究前，请与您的医疗保健专业人员讨论可能的风险与获益"), text);
  assert.ok(text.includes("请阅读了解研究"), text);
});

test("属性规则 requireHit：命中词表的 aria-label 翻，未命中的英文标题原样保留", () => {
  const doc = run(
    '<a href="/about-site" title="About ClinicalTrials.gov (opens in a new tab)" aria-label="About ClinicalTrials.gov (opens in a new tab)">About ClinicalTrials.gov</a>' +
      '<a href="/study/NCT04280705" title="Randomized Trial (opens in a new tab)">Randomized Trial</a>'
  );
  const [a, b] = [...doc.querySelectorAll("a")];
  assert.equal(a.getAttribute("title"), "关于 ClinicalTrials.gov（在新标签页打开）");
  assert.equal(a.getAttribute("aria-label"), "关于 ClinicalTrials.gov（在新标签页打开）");
  assert.equal(a.textContent, "关于 ClinicalTrials.gov");
  assert.equal(b.getAttribute("title"), "Randomized Trial (opens in a new tab)", "没命中词表的标题不能硬翻");
  assert.equal(b.textContent, "Randomized Trial");
});

test("不该翻的：药名、疾病 MeSH 名、城市、论文标题", () => {
  const doc = run(
    '<ul class="kept"><li>remdesivir</li><li>Remdesivir</li><li>Pneumonia, Viral</li>' +
      "<li>Baltimore, Maryland, United States, 21201-1509</li>" +
      "<li>Remdesivir for the Treatment of Covid-19 - Final Report</li>" +
      "<li>NCT04280705</li></ul>"
  );
  const items = [...doc.querySelectorAll(".kept li")].map((li) => li.textContent);
  assert.deepEqual(items, [
    "remdesivir",
    "Remdesivir",
    "Pneumonia, Viral",
    "Baltimore, Maryland, United States, 21201-1509",
    "Remdesivir for the Treatment of Covid-19 - Final Report",
    "NCT04280705"
  ]);
});
