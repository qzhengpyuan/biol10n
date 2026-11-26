// GDC / cBioPortal 第二轮界面长尾词库（dict/gdc2.json、dict/cbioportal2.json、dict/gdc-docs.json）校验 + 引擎行为测试
// 覆盖：GDC 数据车空态、/manage_sets 空态整句（内联 <b>/<a>）、队列构建器 aria-label 排序按钮、
//       GDC 文档站搜索初始化提示、cBioPortal 结果页 OncoPrint 轨道菜单/注释筛选面板/带计数的 Clinical 标签页
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const readDict = (id) => JSON.parse(fs.readFileSync(path.join(root, "../dict", id + ".json"), "utf8"));
const gdc2 = readDict("gdc2");
const cbio2 = readDict("cbioportal2");
const gdcDocs = readDict("gdc-docs");
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;

// 与运行期一致的取法：按站点 dicts 顺序合并，后面的册覆盖前面的 key
function dataFor(siteId) {
  const site = sites.find((s) => s.id === siteId);
  const exact = {};
  const rules = [];
  const templates = [];
  for (const id of site.dicts) {
    const d = readDict(id);
    Object.assign(exact, d.exact || {});
    if (d.rules) rules.push(...d.rules);
    if (d.templates) templates.push(...d.templates);
  }
  return { exact, rules, templates };
}

const gdcSite = { ...sites.find((s) => s.id === "gdc"), rescan: false };
const docsSite = { ...sites.find((s) => s.id === "gdc-docs"), rescan: false };
const cbioSite = { ...sites.find((s) => s.id === "cbioportal"), rescan: false };
const gdcData = dataFor("gdc");
const docsData = dataFor("gdc-docs");
const cbioData = dataFor("cbioportal");

function mount({ html, url, site, data }) {
  const dom = new JSDOM(html, { url });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return dom.window.document;
}
const mountGdc = (inner) =>
  mount({ html: "<div>" + inner + "</div>", url: "https://portal.gdc.cancer.gov/", site: gdcSite, data: gdcData });
const mountCbio = (inner) =>
  mount({
    html: '<div id="root"><div class="cbioportal-frontend">' + inner + "</div></div>",
    url: "https://www.cbioportal.org/results?Action=Submit&cancer_study_list=laml_tcga&case_set_id=laml_tcga_all&gene_list=TP53",
    site: cbioSite,
    data: cbioData
  });
const mountDocs = (inner) =>
  mount({ html: inner, url: "https://docs.gdc.cancer.gov/Data/Introduction/", site: docsSite, data: docsData });
const zh = (t) => String(t).replace(/\s+/g, " ").trim();

// ---------------- 结构校验 ----------------

test("三本词库可解析，站点归属正确，三类容器齐备", () => {
  assert.equal(gdc2.meta.family, "gdc");
  assert.ok(gdc2.meta.sites.includes("portal.gdc.cancer.gov"));
  assert.ok(Object.keys(gdc2.exact).length >= 16);
  assert.ok(gdc2.rules.length >= 3);
  assert.ok(Array.isArray(gdc2.templates));

  assert.equal(cbio2.meta.family, "cbioportal2");
  assert.ok(cbio2.meta.sites.includes("cbioportal.org"));
  assert.ok(Object.keys(cbio2.exact).length >= 70);
  assert.ok(Array.isArray(cbio2.rules));

  assert.equal(gdcDocs.meta.family, "gdc");
  assert.ok(gdcDocs.meta.sites.includes("gdc.cancer.gov"));
});

test("key 不含中文，value 不含 URL/邮箱，且译文含中文", () => {
  for (const d of [gdc2, cbio2]) {
    for (const [k, v] of Object.entries(d.exact)) {
      assert.ok(!/[\u4e00-\u9fff]/.test(k), "key 含中文：" + k);
      assert.ok(!/https?:\/\/|[\w.+-]+@[\w-]+\.\w+/.test(v), "value 含 URL/邮箱：" + k);
      assert.ok(/[\u4e00-\u9fff]/.test(v), "译文不含中文：" + k + " -> " + v);
    }
    for (const r of d.rules || []) {
      assert.doesNotThrow(() => new RegExp(r.re), "坏正则：" + r.re);
      assert.ok(/[\u4e00-\u9fff]/.test(r.to), "规则译文不含中文：" + r.re);
    }
  }
});

test("本轮关键条目存在（GDC 数据车/集合空态、文档搜索、cBioPortal 轨道菜单与注释面板）", () => {
  const want = [
    [gdc2, "Your cart is empty.", "你的数据车为空。"],
    [gdc2, "Manage your saved sets", "管理已保存的集合"],
    [gdc2, "No saved sets available", "暂无已保存的集合"],
    [gdc2, "Create Set", "创建集合"],
    [gdc2, "Mutation Frequency app", "突变频率应用"],
    [gdc2, "Sort Cases numerically", "按数值排序病例"],
    [gdcDocs, "Initializing search", "正在初始化搜索"],
    [cbio2, "Sort a-Z", "按 A 到 Z 排序"],
    [cbio2, "Sort Z-a", "按 Z 到 A 排序"],
    [cbio2, "Don't sort track", "不对轨道排序"],
    [cbio2, "Show Gaps (w/%)", "显示空白（含百分比）"],
    [cbio2, "Ignore VUS", "忽略意义未明变异"],
    [cbio2, "Color by", "着色依据"],
    [cbio2, "Show only drivers", "仅显示驱动突变"],
    [cbio2, "Open in JupyterNoteBook", "在 JupyterNoteBook 中打开"]
  ];
  for (const [book, k, v] of want) assert.equal(book.exact[k], v, "缺少或值不符：" + k);
});

// ---------------- GDC 引擎行为 ----------------

test("数据车空态：整句翻成中文，按钮与结构保留", () => {
  const doc = mountGdc(
    '<div class="flex flex-col items-center py-10"><h2 class="text-lg">Your cart is empty.</h2>' +
      '<a class="btn" href="/analysis_page?app=Repository">Go to Repository</a></div>'
  );
  assert.equal(zh(doc.querySelector("h2").textContent), "你的数据车为空。");
  assert.equal(doc.querySelector("a").getAttribute("href"), "/analysis_page?app=Repository");
});

test("/manage_sets 空态整句：内联 <b> 与 <a> 之间接得上，输出全中文", () => {
  const doc = mountGdc(
    '<p class="py-2 text-sm">Create gene and mutation sets using the ' +
      '<b>Create Set</b> button or from the ' +
      '<a data-testid="link-mutation-frequency" href="/analysis_page?app=MutationFrequencyApp">Mutation Frequency app</a>.</p>'
  );
  const p = doc.querySelector("p");
  const text = zh(p.textContent);
  assert.match(text, /创建基因与突变集合/);
  assert.match(text, /创建集合/);
  assert.match(text, /突变频率应用/);
  assert.equal(/[A-Za-z]{3,}/.test(text), false, "整句里不该再有英文单词：" + text);
  assert.equal(p.querySelector("b").textContent, "创建集合");
  const a = p.querySelector("a");
  assert.equal(a.textContent, "突变频率应用");
  assert.equal(a.getAttribute("data-testid"), "link-mutation-frequency");
});

test("队列构建器排序按钮的 aria-label 翻成中文", () => {
  const doc = mountGdc('<button class="sort" aria-label="Sort Cases numerically"><span>25</span></button>');
  assert.equal(doc.querySelector("button").getAttribute("aria-label"), "按数值排序病例");
});

test("数据与专有名词原样不动（项目编号、文件 UUID、测序类型）", () => {
  const doc = mountGdc(
    '<table><tbody><tr><td>TCGA-BRCA</td>' +
      '<td>25ab28a6-8841-4048-8950-6ca724320b41.wxs.Pindel.aliquot.maf.gz</td>' +
      '<td>WGS</td><td>158ff989</td></tr></tbody></table>'
  );
  const tds = [...doc.querySelectorAll("td")].map((e) => e.textContent);
  assert.deepEqual(tds, [
    "TCGA-BRCA",
    "25ab28a6-8841-4048-8950-6ca724320b41.wxs.Pindel.aliquot.maf.gz",
    "WGS",
    "158ff989"
  ]);
});

// ---------------- GDC 文档站 ----------------

test("文档站搜索初始化提示翻成中文", () => {
  const doc = mountDocs(
    '<div class="md-search-result">' +
      '<div class="md-search-result__meta">Initializing search</div>' +
      '<ol class="md-search-result__list"></ol></div>'
  );
  assert.equal(zh(doc.querySelector(".md-search-result__meta").textContent), "正在初始化搜索");
});

// ---------------- cBioPortal 引擎行为 ----------------

test("OncoPrint 轨道下拉菜单：排序与空白项翻成中文，<li> 结构保留", () => {
  const doc = mountCbio(
    '<ul class="dropdown-menu">' +
      '<li class="clickable">Sort a-Z</li>' +
      '<li class="clickable">Sort Z-a</li>' +
      "<li class='clickable'>Don't sort track</li>" +
      '<li class="clickable">Show Gaps</li>' +
      '<li class="clickable">Show Gaps (w/%)</li>' +
      '<li class="clickable">Edit Colors</li></ul>'
  );
  const items = [...doc.querySelectorAll("li")].map((e) => zh(e.textContent));
  assert.deepEqual(items, [
    "按 A 到 Z 排序",
    "按 Z 到 A 排序",
    "不对轨道排序",
    "显示空白",
    "显示空白（含百分比）",
    "编辑颜色"
  ]);
});

test("注释/筛选面板：驱动注释与 VUS 复选框翻成中文，input 属性不动", () => {
  const doc = mountCbio(
    '<div class="panel"><h5>Color by</h5>' +
      '<label><input data-test="sortIgnoreVUS" type="checkbox" value="10.1"> Ignore VUS</label>' +
      '<div><span>Driver annotations:</span><span>Hotspots</span></div>' +
      '<label><input type="checkbox"> Show only drivers</label>' +
      '<label><input type="checkbox"> Show only somatic</label></div>'
  );
  assert.equal(zh(doc.querySelector("h5").textContent), "着色依据");
  const labels = [...doc.querySelectorAll("label")].map((e) => zh(e.textContent));
  assert.deepEqual(labels, ["忽略意义未明变异", "仅显示驱动突变", "仅显示体细胞突变"]);
  const cb = doc.querySelector('input[data-test="sortIgnoreVUS"]');
  assert.equal(cb.getAttribute("type"), "checkbox");
  assert.equal(cb.getAttribute("value"), "10.1");
  assert.equal(zh(doc.querySelector(".panel div").textContent), "驱动注释：热点");
});

test("结果页带计数的 Clinical 标签页：文字翻中文，计数 <span> 保留", () => {
  const doc = mountCbio(
    '<div class="tab-title">Clinical<span style="padding-left: 5px;"><span class="oncoprintDropdownCount">65</span></span></div>'
  );
  const div = doc.querySelector(".tab-title");
  assert.equal(zh(div.textContent), "临床65");
  assert.equal(div.querySelector(".oncoprintDropdownCount").textContent, "65");
});

// 注：laml_tcga 这类「已知研究显示名」在 cbioportal.json 里本就有规则译成中文（既有行为，非本轮改动），
// 因此负向用例改用词库未收录的研究名，验证新的界面词不会误伤研究名。
test("专有名词与数据不翻（OncoPrint 标签、未收录研究名、临床属性名）", () => {
  const doc = mountCbio(
    '<div class="tabs"><span class="tab">OncoPrint</span></div>' +
      '<h3>Adenoid Cystic Carcinoma (TEST, Cohort ABC)</h3>' +
      '<table><tbody><tr><td>Basophils Cell Count</td><td>FAB</td></tr></tbody></table>'
  );
  assert.equal(zh(doc.querySelector(".tab").textContent), "OncoPrint");
  assert.equal(zh(doc.querySelector("h3").textContent), "Adenoid Cystic Carcinoma (TEST, Cohort ABC)");
  const tds = [...doc.querySelectorAll("td")].map((e) => e.textContent);
  assert.deepEqual(tds, ["Basophils Cell Count", "FAB"]);
});