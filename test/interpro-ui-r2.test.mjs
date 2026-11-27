// InterPro 界面补译（r2）：条目页筛选/表头、计数行、面包屑、成员库标签与 react-select 播报
// 采自 https://www.ebi.ac.uk/interpro/ 首页、/entry/InterPro/IPR000001/ 条目页（含 protein、structure 标签页）、
// /search/text/ 文本检索页。节点边界照真实 DOM：整句被 React 插值切成多个文本节点时按整句整条命中。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/interpro.json"), "utf8"));
const site = sites.find((s) => s.id === "interpro");

function stackData(site) {
  const data = { exact: {}, rules: [], templates: [] };
  for (const id of site.dicts) {
    const p = path.join(root, "../dict", id + ".json");
    if (!fs.existsSync(p)) continue;
    const b = JSON.parse(fs.readFileSync(p, "utf8"));
    Object.assign(data.exact, b.exact || {});
    data.rules = data.rules.concat(b.rules || []);
    data.templates = data.templates.concat(b.templates || []);
  }
  return data;
}

// build(doc) 可选：需要按真实文本节点边界搭 DOM 时在里面自己拼
function run(html, build) {
  const dom = new JSDOM("<body>" + html + "</body>", { url: "https://www.ebi.ac.uk/interpro/" });
  const doc = dom.window.document;
  if (build) build(doc);
  const engine = createEngine({ document: doc, window: dom.window, data: stackData(site), site });
  engine.start();
  return doc;
}
const flat = (doc) => doc.body.textContent.replace(/\s+/g, " ").trim();

test("词库结构：界面词条在位、规则可编译、计数行规则覆盖三种名词", () => {
  for (const [k, v] of Object.entries({
    "UniProt Curation": "UniProt 审编",
    "reviewed": "已审编",
    "unreviewed": "未审编",
    "Predicted structure": "预测结构",
    "Matches": "匹配",
    "This entry matches these proteins:": "本条目匹配以下蛋白质：",
    "This entry matches these structures:": "本条目匹配以下结构：",
    "PROSITE profiles:": "PROSITE 谱：",
    "text": "文本",
    "domain architecture": "结构域架构"
  })) {
    assert.equal(book.exact[k], v, "interpro 册缺词条: " + k);
  }
  assert.ok(book.rules.length >= 19, "规则数回退");
  for (const r of book.rules) {
    assert.doesNotThrow(() => new RegExp(r.re), "坏正则: " + r.re);
    assert.equal(typeof r.to, "string");
  }
  const counters = book.rules.filter((r) => /^第 \$\d - \$\d 项/.test(r.to));
  assert.equal(counters.length, 3, "计数行规则应为 entries / proteins / structures 三条");
  const re = new RegExp(counters[0].re);
  assert.ok(re.test("1 - 20 of 9k entries"));
  assert.ok(!re.test("of 9k entries"));
  // skip 与 dicts 是站点配置里人工核对过的项，词库改动不能把它们挤掉
  assert.equal(site.skip, "span.journal");
  assert.ok(site.dicts.includes("interpro"));
});

test("条目页 protein/structure 标签页：整句被切成多个文本节点时按整句命中", () => {
  // 真实 DOM：<p> 下是 4 个平级文本节点（React 插值边界），不是被 <b>/<a> 包住的元素
  const build = (doc) => {
    const p = doc.createElement("p");
    ["This ", "entry", " matches", " these proteins:"].forEach((t) => p.appendChild(doc.createTextNode(t)));
    doc.body.appendChild(p);
  };
  const doc = run("", build);
  assert.equal(flat(doc), "本条目匹配以下蛋白质：");
  assert.doesNotMatch(flat(doc), /This|matches|these proteins/);

  const build2 = (doc) => {
    const p = doc.createElement("p");
    ["This ", "entry", " matches", " these structures:"].forEach((t) => p.appendChild(doc.createTextNode(t)));
    doc.body.appendChild(p);
  };
  assert.equal(flat(run("", build2)), "本条目匹配以下结构：");
});

test("计数行：整个 span 成句，不再留 of", () => {
  const html =
    '<span class="header-total-results"><span>1</span> - <span>20</span> of ' +
    '<strong><span title="Approximately 9k">9k</span></strong> entries</span>';
  assert.equal(flat(run(html)), "第 1 - 20 项，共 9k 条目");
  assert.equal(flat(run(html.replaceAll("9k", "20k").replace("entries", "proteins"))), "第 1 - 20 项，共 20k 蛋白质");
  assert.equal(flat(run(html.replaceAll("9k", "139").replace("entries", "structures"))), "第 1 - 20 项，共 139 结构");
});

test("筛选面板与表头：UniProt Curation / reviewed / unreviewed / Predicted structure / Matches", () => {
  const html =
    '<div class="filters-and-table"><nav><div class="filters-panel"><header>Filter By</header>' +
    '<div class="filter-container"><button class="toggle"><span class="arrow">▸</span>' +
    '<span class="button-label">UniProt Curation</span></button>' +
    '<div><label><input type="radio" checked><span>all</span><span class="filter-label">20k</span></label>' +
    '<label><input type="radio"><span>reviewed</span><span class="filter-label">97</span></label>' +
    '<label><input type="radio"><span>unreviewed</span><span class="filter-label">20k</span></label></div></div>' +
    '</div></nav>' +
    '<table><thead><tr><th><div class="table-header"><span>Accession</span></div></th>' +
    '<th><div class="table-header"><span>Predicted structure</span></div></th>' +
    '<th class="matchColumn"><div class="table-header"><span>Matches</span></div></th></tr></thead></table></div>';
  const text = flat(run(html));
  assert.match(text, /筛选依据/);
  assert.match(text, /UniProt 审编/);
  assert.match(text, /已审编97/);
  assert.match(text, /未审编20k/);
  assert.match(text, /预测结构/);
  assert.match(text, /匹配/);
  assert.doesNotMatch(text, /Predicted structure|unreviewed|UniProt Curation|Filter By/);
});

test("面包屑与成员库标签：text / domain architecture / PROSITE profiles: / PMID:", () => {
  const html =
    '<nav class="breadcrumbs"><a class="breadcrumb-link" href="/interpro/search/">search</a>' +
    '<span>/</span><a class="breadcrumb-link" href="/interpro/search/text/">text</a></nav>' +
    '<a class="breadcrumb-link">domain architecture</a>' +
    '<span class="db-name">PROSITE profiles: </span>' +
    '<span class="db-name">CDD: </span>' +
    '<span>PMID:</span>';
  const text = flat(run(html));
  assert.match(text, /检索/);
  assert.match(text, /文本/);
  assert.match(text, /结构域架构/);
  assert.match(text, /PROSITE 谱：/);
  assert.match(text, /CDD:/, "成员库名 CDD 是品牌，保持原样");
  // PMID 是标识符前缀、不是界面文案：catalog 里留 ASCII，避免 miss-report 永久误报
  assert.match(text, /PMID:/);
  assert.doesNotMatch(text, /PROSITE profiles/);
});

test("react-select 播报文本（sr-only）：选中与聚焦提示整条替换", () => {
  const html =
    '<span id="react-select-8-live-region" class="css-7pg0cj-a11yText">' +
    '<span id="aria-selection">option , selected.</span><span id="aria-focused"></span>' +
    '<span id="aria-guidance">Select is focused ,type to refine list, press Down to open the menu, </span></span>';
  assert.equal(flat(run(html)), "选项，已选中。下拉列表已聚焦，输入以筛选列表，按向下方向键打开菜单，");
});

test("数据不误翻：条目名、登录号、成员库条目号、期刊名（站点 skip）保持英文", () => {
  const html =
    '<div class="title"><h3>Kringle</h3><span>IPR000001</span></div>' +
    '<ul class="md-list"><li><span class="db-name">CDD: </span><a><small><div>cd00108</div></small></a></li>' +
    '<li><span class="db-name">Pfam: </span><a><small><div>PF00051</div></small></a></li></ul>' +
    '<p class="cite">Patthy L. <span class="journal">Nucleic Acids Research</span> 41, 657-63.</p>';
  const text = flat(run(html));
  assert.match(text, /Kringle/);
  assert.match(text, /IPR000001/);
  assert.match(text, /cd00108/);
  assert.match(text, /PF00051/);
  assert.match(text, /Nucleic Acids Research/, "skip=span.journal 的期刊名不能被翻");
  // 整词命中不能把正文句子拆开：context 里含 text 也不动
  assert.equal(flat(run("<p>context menus</p>")), "context menus");
});
