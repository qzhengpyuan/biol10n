// r55：0.12.0 的四个阅读辅助功能
// 中英互查（选中即查）、按英文名找控件、双语对照、阅读位置记忆。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/ui.js"), "utf8");

function boot(html, url) {
  const dom = new JSDOM(html, { url: url || "https://docs.gdc.cancer.gov/" });
  global.window = dom.window;
  global.document = dom.window.document;
  const factory = new Function(src + "; return { createBioL10nUI };")();
  return { dom, factory, doc: dom.window.document, win: dom.window };
}

function fakeEngine() {
  const e = {
    stats: { enabled: true, nodes: 0, hitExact: 0, hitRule: 0, attrHit: 0, titleHit: 0, paras: 0, tpl: 0, inline: 0, miss: 0 },
    disable() { e.stats.enabled = false; },
    enable() { e.stats.enabled = true; },
    originalText(el) { return (el && el.getAttribute && el.getAttribute("data-orig")) || null; },
    englishText() { return "Hello"; }
  };
  return e;
}

function openPop(doc, win) {
  const badge = doc.querySelector(".bl-badge");
  badge.dispatchEvent(new win.PointerEvent("pointerdown", { button: 0, bubbles: true }));
  badge.dispatchEvent(new win.PointerEvent("pointerup", { button: 0, bubbles: true }));
  return doc.querySelector(".bl-pop");
}

test("快捷菜单有双语对照、阅读位置与英文名检索框", () => {
  const { factory, doc, win } = boot("<main><p>你好</p></main>");
  try {
    const ui = factory.createBioL10nUI({ site: { id: "x", name: "X" }, dicts: [], version: "0.12.0" });
    const pop = openPop(doc, win);
    assert.match(pop.textContent, /双语对照/);
    assert.match(pop.textContent, /记住阅读位置/);
    assert.ok(pop.querySelector(".bl-find input"), "应有英文名输入框");
  } finally { win.close(); }
});

test("中英互查：英文查中文、中文查英文都能命中", () => {
  const { factory, doc, win } = boot("<main></main>");
  try {
    const ui = factory.createBioL10nUI({
      site: { id: "x", name: "X" }, dicts: [], version: "0.12.0",
      dict: { "Data Portal": "数据门户", "Cohort Builder": "队列构建器" }
    });
    assert.deepEqual(ui.lookupPair("Data Portal"), { en: "Data Portal", zh: "数据门户" });
    assert.deepEqual(ui.lookupPair("数据门户"), { en: "Data Portal", zh: "数据门户" });
    assert.equal(ui.lookupPair("不存在"), null);
  } finally { win.close(); }
});

test("选中即查：选中英文后浮出中英对照，点别处收起", async () => {
  const { factory, doc, win } = boot("<main><p>数据门户</p></main>");
  try {
    const ui = factory.createBioL10nUI({
      site: { id: "x", name: "X" }, dicts: [], version: "0.12.0",
      dict: { "Data Portal": "数据门户" }
    });
    Object.defineProperty(win, "getSelection", { value: () => ({ toString: () => "数据门户" }), configurable: true });
    doc.body.dispatchEvent(new win.MouseEvent("mouseup", { bubbles: true, clientX: 60, clientY: 60 }));
    await new Promise((r) => setTimeout(r, 80));
    const pop = doc.querySelector(".bl-sel");
    assert.ok(pop, "应浮出选中查询");
    assert.match(pop.textContent, /Data Portal/);
    doc.body.dispatchEvent(new win.PointerEvent("pointerdown", { bubbles: true }));
    assert.equal(doc.querySelector(".bl-sel"), null, "点别处应收起");
  } finally { win.close(); }
});

test("按英文名找控件：高亮并可按「下一个」轮换", () => {
  const html = `<main>
    <div><button data-orig="Submit">提交</button></div>
    <div><button data-orig="Submit All">全部提交</button></div>
    <div><button data-orig="Cancel">取消</button></div>
  </main>`;
  const { factory, doc, win } = boot(html);
  try {
    const ui = factory.createBioL10nUI({ site: { id: "x", name: "X" }, dicts: [], version: "0.12.0" });
    ui.attach(fakeEngine());
    openPop(doc, win);
    const n = ui.findEnglish("Submit");
    assert.equal(n, 2, "应命中两个 Submit 控件");
    assert.equal(doc.querySelectorAll(".bl-hit").length, 2);
    assert.equal(doc.querySelectorAll(".bl-hit-cur").length, 1, "当前命中只标一个");
    const hint = doc.querySelector(".bl-find-hint");
    assert.match(hint.textContent, /1 \/ 2/);
    ui.nextHit();
    assert.match(doc.querySelector(".bl-find-hint").textContent, /2 \/ 2/);
    assert.equal(doc.querySelectorAll(".bl-hit").length, 2, "轮换后两个命中仍在");
  } finally { win.close(); }
});

test("双语对照：中文段落下方出现英文原文，关掉即移除", async () => {
  const html = '<main><p data-orig="The GDC supports several cancer genome programs.">GDC 支持多项癌症基因组计划。</p></main>';
  const { factory, doc, win } = boot(html);
  try {
    const ui = factory.createBioL10nUI({ site: { id: "x", name: "X" }, dicts: [], version: "0.12.0" });
    ui.attach(fakeEngine());
    const pop = openPop(doc, win);
    const row = [...pop.querySelectorAll(".bl-pop-row")].find((r) => /双语对照/.test(r.textContent));
    const box = row.querySelector("input");
    box.checked = true;
    box.dispatchEvent(new win.Event("change"));
    const dual = doc.querySelector(".bl-dual");
    assert.ok(dual, "应插入双语行");
    assert.match(dual.textContent, /cancer genome programs/);
    assert.equal(JSON.parse(win.localStorage.getItem("biol10n:settings")).dual, true);

    box.checked = false;
    box.dispatchEvent(new win.Event("change"));
    assert.equal(doc.querySelector(".bl-dual"), null, "关掉后应移除");
  } finally { win.close(); }
});

test("阅读位置：离开时写入，进入时恢复", () => {
  const { factory, doc, win } = boot("<main><p>长文档</p></main>", "https://docs.gdc.cancer.gov/Data/");
  try {
    const ui = factory.createBioL10nUI({ site: { id: "x", name: "X" }, dicts: [], version: "0.12.0" });
    let y = 1500;
    Object.defineProperty(win, "pageYOffset", { get: () => y, configurable: true });
    ui.saveScroll();
    const saved = JSON.parse(win.localStorage.getItem("biol10n:scroll"));
    assert.equal(saved["/Data/"].y, 1500);

    let called = null;
    win.scrollTo = (x, yy) => { called = yy; };
    y = 0;
    const restored = ui.restoreScroll(true);
    assert.equal(restored, 1500);
    assert.equal(called, 1500, "应滚回记忆位置");
  } finally { win.close(); }
});

test("关掉阅读位置记忆后不再写入", () => {
  const { factory, doc, win } = boot("<main><p>x</p></main>", "https://docs.gdc.cancer.gov/A/");
  try {
    const ui = factory.createBioL10nUI({ site: { id: "x", name: "X" }, dicts: [], version: "0.12.0" });
    Object.defineProperty(win, "pageYOffset", { get: () => 900, configurable: true });
    const pop = openPop(doc, win);
    const row = [...pop.querySelectorAll(".bl-pop-row")].find((r) => /记住阅读位置/.test(r.textContent));
    const box = row.querySelector("input");
    box.checked = false;
    box.dispatchEvent(new win.Event("change"));
    ui.saveScroll();
    assert.equal(win.localStorage.getItem("biol10n:scroll"), null);
  } finally { win.close(); }
});
