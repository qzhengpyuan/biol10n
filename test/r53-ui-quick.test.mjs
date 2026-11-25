// r53：悬浮球快捷菜单（0.11.0）
// 目的：不关脚本、不刷新页面就能切回原文；对照模式悬停看英文；本站暂停可记住。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/ui.js"), "utf8");

function boot(html, url) {
  const dom = new JSDOM(html, { url: url || "https://pubmed.ncbi.nlm.nih.gov/" });
  global.window = dom.window;
  global.document = dom.window.document;
  const factory = new Function(src + "; return { createBioL10nUI, bioL10nReadSettings };")();
  return { dom, factory, doc: dom.window.document, win: dom.window };
}

function fakeEngine() {
  const e = {
    stats: { enabled: true, nodes: 3, hitExact: 2, hitRule: 0, attrHit: 0, titleHit: 0, paras: 0, tpl: 0, inline: 0, miss: 0 },
    disable() { e.stats.enabled = false; },
    enable() { e.stats.enabled = true; },
    originalText() { return "Hello world"; }
  };
  return e;
}

test("单击悬浮球打开快捷菜单，再点关闭", () => {
  const { factory, doc, win } = boot("<main><p>Hello</p></main>");
  try {
    factory.createBioL10nUI({ site: { id: "pubmed", name: "PubMed" }, dicts: [], version: "0.11.0" });
    const badge = doc.querySelector(".bl-badge");
    badge.dispatchEvent(new win.PointerEvent("pointerdown", { button: 0, bubbles: true, clientX: 5, clientY: 5 }));
    badge.dispatchEvent(new win.PointerEvent("pointerup", { button: 0, bubbles: true, clientX: 5, clientY: 5 }));
    const pop = doc.querySelector(".bl-pop");
    assert.ok(pop, "应弹出快捷菜单");
    assert.match(pop.textContent, /切回原文/);
    assert.match(pop.textContent, /对照模式/);
    assert.match(pop.textContent, /本站暂停/);
  } finally { win.close(); }
});

test("快捷菜单的切换按钮改引擎状态并更新球上的字", () => {
  const { factory, doc, win } = boot("<main></main>");
  try {
    const ui = factory.createBioL10nUI({ site: { id: "x", name: "X" }, dicts: [], version: "0" });
    const eng = fakeEngine();
    ui.attach(eng);
    ui.toggleLanguage();
    assert.equal(eng.stats.enabled, false);
    assert.equal(doc.querySelector(".bl-badge").textContent, "英");
    ui.toggleLanguage();
    assert.equal(eng.stats.enabled, true);
    assert.equal(doc.querySelector(".bl-badge").textContent, "中");
  } finally { win.close(); }
});

test("本站暂停会写进设置，下次打开该站直接是原文", () => {
  const { factory, doc, win } = boot("<main></main>", "https://www.ncbi.nlm.nih.gov/clinvar/");
  try {
    const ui = factory.createBioL10nUI({ site: { id: "ncbi-clinvar", name: "ClinVar" }, dicts: [], version: "0" });
    const eng = fakeEngine();
    ui.attach(eng);
    assert.equal(eng.stats.enabled, true);
    // 勾上「本站暂停（记住）」
    const boxes = [...doc.querySelectorAll(".bl-pop-row input")];
    ui.toggleLanguage; // 触发快捷菜单构建
    const badge = doc.querySelector(".bl-badge");
    badge.dispatchEvent(new win.PointerEvent("pointerdown", { button: 0, bubbles: true }));
    badge.dispatchEvent(new win.PointerEvent("pointerup", { button: 0, bubbles: true }));
    const rows = [...doc.querySelectorAll(".bl-pop-row")];
    const pauseRow = rows.find((r) => /本站暂停/.test(r.textContent));
    const box = pauseRow.querySelector("input");
    box.checked = true;
    box.dispatchEvent(new win.Event("change"));
    assert.equal(eng.stats.enabled, false);
    const saved = JSON.parse(win.localStorage.getItem("biol10n:settings"));
    assert.ok(saved.paused.includes("www.ncbi.nlm.nih.gov"));

    // 新开一次（模拟刷新）：attach 时应直接是英文
    const eng2 = fakeEngine();
    const ui2 = factory.createBioL10nUI({ site: { id: "ncbi-clinvar", name: "ClinVar" }, dicts: [], version: "0" });
    ui2.attach(eng2);
    assert.equal(eng2.stats.enabled, false);
  } finally { win.close(); }
});

test("对照模式的开关会持久化", () => {
  const { factory, doc, win } = boot("<main></main>");
  try {
    factory.createBioL10nUI({ site: { id: "x", name: "X" }, dicts: [], version: "0" });
    const badge = doc.querySelector(".bl-badge");
    badge.dispatchEvent(new win.PointerEvent("pointerdown", { button: 0, bubbles: true }));
    badge.dispatchEvent(new win.PointerEvent("pointerup", { button: 0, bubbles: true }));
    const row = [...doc.querySelectorAll(".bl-pop-row")].find((r) => /对照模式/.test(r.textContent));
    const box = row.querySelector("input");
    box.checked = true;
    box.dispatchEvent(new win.Event("change"));
    const saved = JSON.parse(win.localStorage.getItem("biol10n:settings"));
    assert.equal(saved.contrast, true);
  } finally { win.close(); }
});
