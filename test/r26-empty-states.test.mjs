// r26 空态/报错态 + PB 固定句补词：AlphaFold / UniProt / ClinicalTrials / Reactome / GDC
// 断言口径：translateText(原串) 必须返回登记译文；未登记的近似串必须返回 null（防误伤）；
// 站点字典按 config/sites.json 的 dicts 顺序合并，等于线上加载顺序。
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

const book = (name) => JSON.parse(fs.readFileSync(path.join(root, "../dict/" + name + ".json"), "utf8"));

function siteData(id) {
  const site = sites.find((s) => s.id === id);
  assert.ok(site, "sites.json 缺少站点 " + id);
  const exact = {}, rules = [], templates = [];
  for (const n of site.dicts) {
    const d = book(n);
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
    templates.push(...(d.templates || []));
  }
  return { site, data: { exact, rules, templates } };
}

function boot(id, html, url) {
  const { site, data } = siteData(id);
  const dom = new JSDOM(html, { url });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return { engine, doc: dom.window.document };
}

function tx(id, s) {
  const { data } = siteData(id);
  const dom = new JSDOM("<p>x</p>", { url: "https://example.org/" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site: { scope: "", block: "pre, code", attrs: [], rescan: [] } });
  engine.start();
  return engine.translateText(s);
}

// ---------------- 结构 ----------------

test("四册词库可解析，新增条目齐备", () => {
  const af = book("alphafold");
  assert.equal(af.exact["No entry found"], "未找到条目");
  assert.equal(af.exact["Suggestions:"], "建议：");
  assert.equal(af.exact["Check the spelling."], "请检查拼写。");
  assert.equal(
    af.exact["Try searching with a protein or gene name rather than by a specific accession."],
    "尝试用蛋白质或基因名称检索，而不是具体的登录号。"
  );

  const common = book("common");
  assert.equal(common.exact["Sorry, this page can't be found!"], "抱歉，找不到此页面！");
  assert.equal(common.exact["Please check the address bar for any mistakes"], "请检查地址栏是否有误。");
  assert.equal(common.exact["Sorry, we can't find this study"], "抱歉，找不到这项研究。");
  assert.equal(
    common.exact["Please check that the NCT number (ClinicalTrials.gov Identifier) is correct or try going back:"],
    "请检查 NCT 编号（ClinicalTrials.gov 标识符）是否正确，或返回上一页："
  );

  const re = book("reactome");
  assert.equal(re.exact["Definition"], "定义");
  assert.equal(
    re.exact["Details are shown when an item is selected in the pathway diagram above."],
    "在上方通路图中选中条目后会显示详细信息。"
  );

  const gdc = book("gdc");
  assert.equal(gdc.exact["Filter your cohort by:"], "按以下条件筛选队列：");
});

// ---------------- AlphaFold 条目页空态 ----------------

test("AlphaFold 空态四条整串命中", () => {
  assert.equal(tx("alphafold", "No entry found"), "未找到条目");
  assert.equal(tx("alphafold", "Suggestions:"), "建议：");
  assert.equal(tx("alphafold", "Check the spelling."), "请检查拼写。");
  assert.equal(
    tx("alphafold", "Try searching with a protein or gene name rather than by a specific accession."),
    "尝试用蛋白质或基因名称检索，而不是具体的登录号。"
  );
});

test("AlphaFold 空态：未登记的近似串不命中", () => {
  // 无冒号的 Suggestions 在本册没有登记（ucsc / pmc 的值不同，不能借用）
  assert.equal(tx("alphafold", "Suggestions"), null);
  assert.equal(tx("alphafold", "Check the spelling"), null);
  assert.equal(tx("alphafold", "No entries found"), null);
  // 口径：登录号 / 基因名不翻
  assert.equal(tx("alphafold", "Q9I1F6"), null);
  assert.equal(tx("alphafold", "MENFQKVEKIGEGTYGV"), null);
});

test("AlphaFold 条目页空态在 DOM 通道同样生效", () => {
  const html =
    '<div id="app"><p>No entry found</p><p>Suggestions:</p>' +
    "<p>Check the spelling.</p>" +
    "<p>Try searching with a protein or gene name rather than by a specific accession.</p></div>";
  const { doc } = boot("alphafold", html, "https://alphafold.ebi.ac.uk/entry/XXXX");
  const ps = doc.querySelectorAll("#app p");
  assert.equal(ps[0].textContent, "未找到条目");
  assert.equal(ps[1].textContent, "建议：");
  assert.equal(ps[2].textContent, "请检查拼写。");
  assert.equal(ps[3].textContent, "尝试用蛋白质或基因名称检索，而不是具体的登录号。");
});

// ---------------- UniProt 404 ----------------

test("UniProt 404 两条命中（直引号，第二条无句点）", () => {
  assert.equal(tx("uniprot", "Sorry, this page can't be found!"), "抱歉，找不到此页面！");
  assert.equal(tx("uniprot", "Please check the address bar for any mistakes"), "请检查地址栏是否有误。");
  // 弯引号形态归一后与直引号同键（r30 P1-2 撇号折叠）
  assert.equal(tx("uniprot", "Sorry, this page can\u2019t be found!"), "抱歉，找不到此页面！");
});

test("UniProt 404 在 DOM 通道同样生效", () => {
  const html = '<div id="err"><h2>Sorry, this page can\'t be found!</h2><p>Please check the address bar for any mistakes</p></div>';
  const { doc } = boot("uniprot", html, "https://www.uniprot.org/uniprotkb/XXXXXX/entry");
  assert.equal(doc.querySelector("#err h2").textContent, "抱歉，找不到此页面！");
  assert.equal(doc.querySelector("#err p").textContent, "请检查地址栏是否有误。");
});

// ---------------- ClinicalTrials 研究页报错 ----------------

test("ClinicalTrials 找不到研究两条命中", () => {
  assert.equal(tx("clinicaltrials", "Sorry, we can't find this study"), "抱歉，找不到这项研究。");
  assert.equal(
    tx("clinicaltrials", "Please check that the NCT number (ClinicalTrials.gov Identifier) is correct or try going back:"),
    "请检查 NCT 编号（ClinicalTrials.gov 标识符）是否正确，或返回上一页："
  );
});

test("ClinicalTrials：NCT 编号属于数据不翻，近似句不误伤", () => {
  assert.equal(tx("clinicaltrials", "NCT99999999"), null);
  assert.equal(tx("clinicaltrials", "Sorry, we can't find this trial"), null);
  assert.equal(tx("clinicaltrials", "Sorry, we can't find the requested web page."), "抱歉，找不到你请求的网页。");
});

// ---------------- Reactome 通路浏览器固定句 ----------------

test("Reactome：Definition 与详情面板占位句命中", () => {
  assert.equal(tx("reactome", "Definition"), "定义");
  assert.equal(
    tx("reactome", "Details are shown when an item is selected in the pathway diagram above."),
    "在上方通路图中选中条目后会显示详细信息。"
  );
});

test("Reactome：通路总览整句命中（换行/缩进归一后同样命中）", () => {
  const oneLine =
    "The pathways overview offers an intuitive overview of dataset analysis results in the context of the Reactome hierarchical pathway structure, allowing both a quick \u201Cfirst glance\u201D and rapid zooming in on interesting results.";
  const wrapped =
    "The pathways overview offers an intuitive overview of dataset analysis results in the context of\n        the Reactome hierarchical pathway structure, allowing both a quick \u201Cfirst glance\u201D and rapid zooming\n        in on interesting results.";
  const want = "通路总览以 Reactome 通路层级结构为背景，直观呈现数据集分析结果，便于快速“初览”并迅速放大到关注的结果。";
  assert.equal(tx("reactome", oneLine), want);
  assert.equal(tx("reactome", wrapped), want);
  // 截断到 “in the context of” 的前缀不是真实 DOM 整串，不能登记成词条
  assert.equal(
    tx("reactome", "The pathways overview offers an intuitive overview of dataset analysis results in the context of"),
    null
  );
});

test("Reactome：GO 术语弹层在 DOM 里显示「定义」", () => {
  const html = '<div id="go"><span class="gwt-Label">Definition</span></div>';
  const { doc } = boot("reactome", html, "https://reactome.org/PathwayBrowser/#/R-HSA-1640170");
  assert.equal(doc.querySelector("#go .gwt-Label").textContent, "定义");
});

// ---------------- GDC 队列筛选面板 ----------------

test("GDC：Filter your cohort by: 命中", () => {
  assert.equal(tx("gdc", "Filter your cohort by:"), "按以下条件筛选队列：");
  // 只登记了带冒号的整串；无冒号不是真实 DOM 串
  assert.equal(tx("gdc", "Filter your cohort by"), null);
});

test("GDC：面板文案在 DOM 通道生效", () => {
  const html = '<div id="panel"><span class="label">Filter your cohort by:</span><span>No filters currently applied.</span></div>';
  const { doc } = boot("gdc", html, "https://portal.gdc.cancer.gov/analysis_page?app=Repository");
  assert.equal(doc.querySelector("#panel .label").textContent, "按以下条件筛选队列：");
  assert.equal(doc.querySelectorAll("#panel span")[1].textContent, "当前未应用任何筛选条件。");
});
