// GDC Data Portal 剩余英文词库（dict/gdc2.json）校验 + 引擎行为测试
// 覆盖：/analysis_page?app=Downloads 的「意外错误」弹窗、表头排序后的无障碍提示（sr-only）
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/gdc2.json"), "utf8"));
const gdcDict = JSON.parse(fs.readFileSync(path.join(root, "../dict/gdc.json"), "utf8"));
const commonDict = JSON.parse(fs.readFileSync(path.join(root, "../dict/common.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "gdc");

const URL_DL = "https://portal.gdc.cancer.gov/analysis_page?app=Downloads";
const data = {
  exact: { ...commonDict.exact, ...gdcDict.exact, ...dict.exact },
  rules: [...commonDict.rules, ...gdcDict.rules, ...dict.rules],
  templates: [...(gdcDict.templates || []), ...(dict.templates || [])]
};

function mount(html, url = URL_DL) {
  const dom = new JSDOM(html, { url });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return dom.window.document;
}

// ---------------- 结构校验 ----------------

test("词库可解析，属于 gdc 站点，三类容器齐备", () => {
  assert.equal(dict.meta.family, "gdc");
  assert.ok(dict.meta.sites.includes("portal.gdc.cancer.gov"), "sites 必须含 portal.gdc.cancer.gov");
  assert.ok(Object.keys(dict.exact).length >= 2);
  assert.ok(dict.rules.length >= 2);
  assert.ok(Array.isArray(dict.templates));
});

test("关键条目存在（错误弹窗标题与正文、表头排序无障碍提示）", () => {
  assert.equal(dict.exact["Unexpected Error"], "意外错误");
  const body =
    "An unexpected error has occurred. Your saved cohorts are being recovered, but your cart and sets may be lost.";
  assert.equal(
    dict.exact[body],
    "发生了意外错误。你保存的队列正在恢复，但数据车与集合可能会丢失。"
  );
  const asc = dict.rules.find((r) => r.re.includes("ascending"));
  const desc = dict.rules.find((r) => r.re.includes("descending"));
  assert.ok(asc && desc, "缺少升序/降序两条排序提示规则");
  assert.equal(asc.to, "表格已按 $1 升序排序。");
  assert.equal(desc.to, "表格已按 $1 降序排序。");
});

test("key 里没有中文，value 里没有明文 URL / 邮箱", () => {
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "key 含中文：" + k);
    assert.ok(!/https?:\/\/|[\w.+-]+@[\w-]+\.\w+/.test(v), "value 含 URL/邮箱：" + k);
  }
  for (const r of dict.rules) {
    assert.ok(!/https?:\/\/|[\w.+-]+@[\w-]+\.\w+/.test(r.to), "rule 译文含 URL/邮箱：" + r.re);
  }
});

// ---------------- 规则 ----------------

test("排序提示正则合法，且只命中真实句式", () => {
  for (const r of dict.rules) {
    assert.doesNotThrow(() => new RegExp(r.re), "坏正则：" + r.re);
  }
  const asc = new RegExp(dict.rules.find((r) => r.re.includes("ascending")).re);
  const m = asc.exec("Table sorted by File Name in ascending order.");
  assert.ok(m, "升序提示应命中");
  assert.equal(m[1], "File Name");
  const desc = new RegExp(dict.rules.find((r) => r.re.includes("descending")).re);
  assert.equal(desc.exec("Table sorted by Cases in descending order.")[1], "Cases");
  assert.equal(asc.test("Table sorted by File Name in reverse order."), false, "不该命中其他句式");
});

// ---------------- 引擎行为 ----------------

test("错误弹窗：标题与整句正文翻成中文，确定按钮与结构保留", () => {
  const doc = mount(
    '<section role="dialog" data-modal-content="true" aria-modal="true">' +
      '<header class="mantine-Modal-header"><h2 class="mantine-Modal-title">Unexpected Error</h2></header>' +
      '<div class="mantine-Modal-body">' +
      '<p class="py-2 px-4">An unexpected error has occurred. Your saved cohorts are being recovered, but your cart and sets may be lost.</p>' +
      '<div data-testid="modal-button-container"><button type="button"><span><span>确定</span></span></button></div>' +
      "</div></section>"
  );
  assert.equal(doc.querySelector("h2").textContent, "意外错误");
  const p = doc.querySelector("p").textContent;
  assert.match(p, /^发生了意外错误。/);
  assert.match(p, /数据车与集合可能会丢失。$/);
  assert.equal(doc.querySelector("button").textContent, "确定");
  assert.equal(doc.querySelectorAll('[role="dialog"]').length, 1);
});

test("表头排序提示：列名随捕获翻译，无需另收列名词条", () => {
  const doc = mount(
    '<div class="overflow-y-auto">' +
      '<div class="sr-only">Table sorted by File Name in ascending order.</div>' +
      "</div>"
  );
  assert.equal(doc.querySelector(".sr-only").textContent, "表格已按 文件名 升序排序。");
});

test("列名走 gdc 词库（大小写与原文一致才译），行数据原样不动", () => {
  const doc = mount(
    '<div class="overflow-y-auto">' +
      '<div class="sr-only">Table sorted by Cases in descending order.</div>' +
      "<table><tbody><tr>" +
      "<td><button><span>25ab28a6-8841-4048-8950-6ca724320b41.wxs.Pindel.aliquot.maf.gz</span></button></td>" +
      "<td><button><span>CPTAC-3</span></button></td>" +
      "<td>35.99 kB</td>" +
      "</tr></tbody></table>" +
      "</div>"
  );
  assert.equal(doc.querySelector(".sr-only").textContent, "表格已按 病例 降序排序。");
  const tds = [...doc.querySelectorAll("td")].map((e) => e.textContent);
  assert.equal(tds[0], "25ab28a6-8841-4048-8950-6ca724320b41.wxs.Pindel.aliquot.maf.gz");
  assert.equal(tds[1], "CPTAC-3");
  assert.equal(tds[2], "35.99 kB");
});

test("未收的句式不动（不误伤分面枚举与文件名）", () => {
  const doc = mount(
    '<div id="facet"><span class="font-content">bcr auxiliary xml</span></div>' +
      '<div class="sr-only">Table sorted by File Name in ascending order</div>'
  );
  assert.equal(doc.querySelector(".font-content").textContent, "bcr auxiliary xml");
  // 缺少结尾句点 => 规则不命中
  assert.equal(doc.querySelector(".sr-only").textContent, "Table sorted by File Name in ascending order");
});
