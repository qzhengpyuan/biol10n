// ClinicalTrials.gov 词库（clinicaltrials）属性回归：术语表族 aria/title（opens|Opens glossary for X）、
// 导航/页脚/分页/官方横幅的固定 aria-label、组合列名，以及"数据不翻"的边界。
// 术语名（X）本身走既有 exact 与本册新增的 ^phase$ 锚定规则；未收录术语整条保持英文（requireHit）。
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
/** 取属性；没有就返回 null，方便断言"没被动过" */
function attr(doc, sel, name) {
  const el = doc.querySelector(sel);
  return el ? el.getAttribute(name) : null;
}

test("词库结构：术语表族两条规则（大小写）+ 固定 aria 条目 + 括号整条", () => {
  const lower = book.rules.find((r) => r.re === "^opens glossary for (.+)$");
  const upper = book.rules.find((r) => r.re === "^Opens glossary for (.+)$");
  assert.ok(lower, "缺小写 opens glossary for 规则");
  assert.ok(upper, "缺大写 Opens glossary for 规则");
  for (const r of [lower, upper]) {
    assert.equal(r.to, "打开 $1 的术语说明", "术语说明句式固定");
    assert.equal(r.requireHit, true, "术语没进词表时不能拼出半中半英");
    new RegExp(r.re);
  }
  // 术语名 phase 与小写形态冲突（hpa 册 Phase=时相），本册用锚定规则而不是 exact
  assert.equal(book.exact.phase, undefined, "phase 不走 exact，避免与别的册抢大小写兜底");
  const phaseRule = book.rules.find((r) => r.re === "^phase$");
  assert.ok(phaseRule && phaseRule.to === "研究阶段", "缺 ^phase$ 锚定规则");

  const fixed = [
    ["Official website of the United States government", "美国政府官方网站"],
    ["Primary navigation", "主导航"],
    ["Footer navigation", "页脚导航"],
    ["Breadcrumbs", "面包屑导航"],
    ["Pagination", "页码"],
    ["Alert", "提示"],
    ["Agency identifier", "机构标识"],
    ["Agency description", "机构说明"],
    ["Important links", "重要链接"],
    ["Government information and services", "政府信息与服务"],
    ["From Age", "起始年龄"],
    ["To Age", "结束年龄"],
    ["Title,Title Acronym", "标题,标题缩写"],
    ["Sponsor,Collaborator", "申办方,合作方"],
    ["Open glossary", "打开术语表"],
    ["Close glossary", "关闭术语表"],
    ["Download current study", "下载当前研究"],
    ["Save current study to My Saved Studies", "将当前研究保存到我的已保存研究"]
  ];
  for (const [k, v] of fixed) {
    assert.equal(book.exact[k], v, "缺固定 aria 条目: " + k);
  }
  // 括号被 common 的 ^(.+?)\s*\((.+)\)$ 先吃掉会让"的术语说明"跑到括号后面，
  // 这两条术语必须整条登记，不能只靠通用规则拼。
  for (const t of ["clinicaltrials.gov identifier (nct number)", "interventional study (clinical trial)"]) {
    for (const head of ["opens glossary for ", "Opens glossary for "]) {
      const k = head + t;
      assert.ok(k in book.exact, "缺括号术语整条: " + k);
      assert.ok(/[\u4e00-\u9fff]/.test(book.exact[k]), "整条译文要有中文: " + k);
      assert.ok(book.exact[k].endsWith("的术语说明"), "整条译文句式要与规则一致: " + k);
    }
  }
});

test("术语表族 aria-label：小写 opens glossary for X 翻成「打开 X 的术语说明」", () => {
  const doc = run(
    '<div class="search-filters">' +
      '<label>Condition/disease<i class="icon-display" aria-label="opens glossary for condition/disease"></i></label>' +
      '<label>Eligibility<i class="icon-display" aria-label="opens glossary for eligibility criteria"></i></label>' +
      '<label>Phase<i class="icon-display" aria-label="opens glossary for phase"></i></label>' +
      '<label>Sponsor<i class="icon-display" aria-label="opens glossary for sponsor"></i></label>' +
      "</div>"
  );
  const got = [...doc.querySelectorAll("i.icon-display")].map((i) => i.getAttribute("aria-label"));
  assert.deepEqual(got, [
    "打开 疾病/病症 的术语说明",
    "打开 合格性标准 的术语说明",
    "打开 研究阶段 的术语说明",
    "打开 申办方 的术语说明"
  ]);
});

test("术语表族 title：大写 Opens glossary for X 同句式，图标按钮 title 也翻", () => {
  const doc = run(
    '<button class="show-glossary" title="Open glossary">Glossary</button>' +
      '<button class="js-glossary-close" title="Close glossary">Close</button>' +
      '<i class="icon-display" title="Opens glossary for study status"></i>' +
      '<i class="icon-display" title="Opens glossary for clinicaltrials.gov identifier (nct number)"></i>' +
      '<i class="icon-display" title="Opens glossary for phase 1"></i>'
  );
  assert.equal(attr(doc, "button.show-glossary", "title"), "打开术语表");
  assert.equal(attr(doc, "button.js-glossary-close", "title"), "关闭术语表");
  const icons = [...doc.querySelectorAll("i.icon-display")].map((i) => i.getAttribute("title"));
  assert.deepEqual(icons, [
    "打开 研究状态 的术语说明",
    "打开 ClinicalTrials.gov 标识符（NCT 编号） 的术语说明",
    "打开 1 期 的术语说明"
  ]);
});

test("requireHit 边界：词表没收录的术语整条保持英文，不拼半中半英", () => {
  const doc = run('<i class="icon-display" aria-label="opens glossary for unlisted zzz term"></i>');
  assert.equal(attr(doc, "i.icon-display", "aria-label"), "opens glossary for unlisted zzz term");
});

test("固定 aria-label：官方横幅、导航、面包屑、页脚机构区、分页", () => {
  const doc = run(
    '<section class="usa-banner" aria-label="Official website of the United States government"></section>' +
      '<nav class="usa-nav" aria-label="Primary navigation"></nav>' +
      '<nav class="usa-breadcrumb" aria-label="Breadcrumbs"></nav>' +
      '<nav class="usa-pagination" aria-label="Pagination"></nav>' +
      '<nav class="usa-footer__nav" aria-label="Footer navigation"></nav>' +
      '<div class="ncbi-alerts" role="alert" aria-label="Alert"></div>' +
      '<section class="usa-identifier__section--masthead" aria-label="Agency identifier"></section>' +
      '<div class="usa-identifier__section--agency" aria-label="Agency description"></div>' +
      '<nav class="usa-identifier__required-links" aria-label="Important links"></nav>' +
      '<section class="usa-identifier__section--usagov" aria-label="Government information and services"></section>'
  );
  const pairs = [
    ["section.usa-banner", "美国政府官方网站"],
    ["nav.usa-nav", "主导航"],
    ["nav.usa-breadcrumb", "面包屑导航"],
    ["nav.usa-pagination", "页码"],
    ["nav.usa-footer__nav", "页脚导航"],
    ["div.ncbi-alerts", "提示"],
    ["section.usa-identifier__section--masthead", "机构标识"],
    ["div.usa-identifier__section--agency", "机构说明"],
    ["nav.usa-identifier__required-links", "重要链接"],
    ["section.usa-identifier__section--usagov", "政府信息与服务"]
  ];
  for (const [sel, want] of pairs) assert.equal(attr(doc, sel, "aria-label"), want, sel);
});

test("筛选面板：年龄单位选择器与组合列名的 aria-label", () => {
  const doc = run(
    '<select class="usa-select age-select" aria-label="From Age"><option value="y">Years Old</option></select>' +
      '<select class="usa-select age-select" aria-label="To Age"><option value="y">Years Old</option></select>' +
      '<input class="usa-input" aria-label="Title,Title Acronym">' +
      '<input class="usa-input" aria-label="Sponsor,Collaborator">'
  );
  const sels = [...doc.querySelectorAll("select.age-select")].map((s) => s.getAttribute("aria-label"));
  assert.deepEqual(sels, ["起始年龄", "结束年龄"]);
  const inputs = [...doc.querySelectorAll("input.usa-input")].map((i) => i.getAttribute("aria-label"));
  assert.deepEqual(inputs, ["标题,标题缩写", "申办方,合作方"]);
  assert.deepEqual([...doc.querySelectorAll("option")].map((o) => o.getAttribute("value")), ["y", "y"], "option value 不许翻");
});

test("数据不翻：研究程序列、论文题录、地址、NCT 号与品牌名保持原文", () => {
  const cite =
    "Beigel JH, Tomashek KM, Dodd LE. Remdesivir for the Treatment of Covid-19 - Final Report. " +
    "N Engl J Med. 2020 Nov 5;383(19):1813-1826. doi: 10.1056/NEJMoa2007764. (opens in a new tab)";
  const doc = run(
    '<input type="checkbox" aria-label="Select A Phase II Clinical Study of HRS-7058 in Patients With Advanced Malignant Tumour">' +
      '<a class="publication-references-item" aria-label="' + cite + '"></a>' +
      '<button class="location-pin" title="Birmingham, Alabama, United States, 35233"></button>' +
      '<span class="record-id" aria-label="NCT04280705"></span>' +
      '<a class="usa-link--external" aria-label="MedlinePlus (opens in a new tab)"></a>' +
      '<a class="usa-link--external" aria-label="Remdesivir (opens in a new tab)"></a>'
  );
  assert.equal(attr(doc, 'input[type="checkbox"]', "aria-label"),
    "Select A Phase II Clinical Study of HRS-7058 in Patients With Advanced Malignant Tumour",
    "研究程序列不翻");
  assert.equal(attr(doc, "a.publication-references-item", "aria-label"), cite, "论文题录不翻");
  assert.equal(attr(doc, "button.location-pin", "title"), "Birmingham, Alabama, United States, 35233", "地址不翻");
  assert.equal(attr(doc, "span.record-id", "aria-label"), "NCT04280705", "NCT 号不翻");
  assert.equal(attr(doc, "a.usa-link--external", "aria-label"), "MedlinePlus (opens in a new tab)", "品牌名不硬翻");
});
