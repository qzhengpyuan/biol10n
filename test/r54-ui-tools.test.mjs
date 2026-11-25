// r54：0.11.2 新增的「段落看原文 / 复制正文 / 收集漏翻」
// 目的：不整页切换也能看某一段原文；复制中文或英文原文；把残留英文一键收集上报。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/ui.js"), "utf8");

function boot(html, url) {
  const dom = new JSDOM(html, { url: url || "https://www.ncbi.nlm.nih.gov/clinvar/" });
  global.window = dom.window;
  global.document = dom.window.document;
  const factory = new Function(src + "; return { createBioL10nUI };")();
  return { dom, factory, doc: dom.window.document, win: dom.window };
}

function fakeEngine(extra) {
  const e = {
    stats: { enabled: true, nodes: 3, hitExact: 2, hitRule: 0, attrHit: 0, titleHit: 0, paras: 0, tpl: 0, inline: 0, miss: 0 },
    disable() { e.stats.enabled = false; },
    enable() { e.stats.enabled = true; },
    originalText(el) { return (el && el.getAttribute && el.getAttribute("data-orig")) || null; },
    englishText() { return "Hello world from engine"; }
  };
  return Object.assign(e, extra || {});
}

function openPop(ui, doc, win) {
  const badge = doc.querySelector(".bl-badge");
  badge.dispatchEvent(new win.PointerEvent("pointerdown", { button: 0, bubbles: true }));
  badge.dispatchEvent(new win.PointerEvent("pointerup", { button: 0, bubbles: true }));
  return doc.querySelector(".bl-pop");
}

test("快捷菜单新增段落看原文、复制、收集漏翻入口", () => {
  const { factory, doc, win } = boot("<main><p>你好</p></main>");
  try {
    const ui = factory.createBioL10nUI({ site: { id: "x", name: "X" }, dicts: [], version: "0.11.2" });
    const pop = openPop(ui, doc, win);
    const txt = pop.textContent;
    assert.match(txt, /段落看原文/);
    assert.match(txt, /复制中文/);
    assert.match(txt, /复制原文/);
    assert.match(txt, /收集漏翻/);
  } finally { win.close(); }
});

test("复制原文走引擎的 englishText；复制中文取当前 DOM", () => {
  const { factory, doc, win } = boot("<main><p>你好世界</p></main>");
  try {
    const ui = factory.createBioL10nUI({ site: { id: "x", name: "X" }, dicts: [], version: "0.11.2" });
    ui.attach(fakeEngine());
    assert.equal(ui.textOf("en"), "Hello world from engine");
    assert.match(ui.textOf("zh"), /你好世界/);
  } finally { win.close(); }
});

test("没有引擎 englishText 时复制原文回落到当前 DOM，不报错", () => {
  const { factory, doc, win } = boot("<main><p>Fallback text</p></main>");
  try {
    const ui = factory.createBioL10nUI({ site: { id: "x", name: "X" }, dicts: [], version: "0.11.2" });
    ui.attach(fakeEngine({ englishText: undefined }));
    assert.match(ui.textOf("en"), /Fallback text/);
  } finally { win.close(); }
});

test("收集漏翻：只收短英文，跳过中文、代码块与本脚本 UI", () => {
  const html = `<main>
    <p>Getting Started</p>
    <p>这是已经翻译好的中文</p>
    <pre><code>const x = 1;</code></pre>
    <span class="bl-badge">中</span>
    <p>P04637</p>
    <p>Contact support@example.org</p>
  </main>`;
  const { factory, doc, win } = boot(html);
  try {
    const ui = factory.createBioL10nUI({ site: { id: "x", name: "X" }, dicts: [], version: "0.11.2" });
    const list = ui.collectMisses();
    const texts = list.map((x) => x.t);
    assert.ok(texts.includes("Getting Started"), "应收集短英文标签");
    assert.ok(!texts.some((t) => /中文/.test(t)), "中文不应收集");
    assert.ok(!texts.some((t) => /const x/.test(t)), "代码块不应收集");
    assert.ok(!texts.some((t) => /P04637/.test(t)), "纯编号不应收集");
    assert.ok(!texts.some((t) => /support@example/.test(t)), "邮箱不应收集");
  } finally { win.close(); }
});

test("收集漏翻写入本机存储且同一句不重复计数", () => {
  const { factory, doc, win } = boot("<main><p>Getting Started</p><p>Data Portal</p></main>");
  try {
    const ui = factory.createBioL10nUI({ site: { id: "x", name: "X" }, dicts: [], version: "0.11.2" });
    const r1 = ui.reportMisses();
    assert.equal(r1.found, 2);
    assert.equal(r1.added, 2);
    const saved = ui.misses();
    assert.equal(saved.length, 2);
    assert.ok(saved.every((x) => x.host === "www.ncbi.nlm.nih.gov"));
    const r2 = ui.reportMisses();
    assert.equal(r2.found, 2);
    assert.equal(r2.added, 0, "同一页同一句只记一次");
    assert.equal(ui.misses().length, 2);
  } finally { win.close(); }
});

test("按住 Alt 点段落弹出英文原文卡片，Esc 关闭", () => {
  const { factory, doc, win } = boot('<main><p data-orig="Getting Started">入门指南</p></main>');
  try {
    const ui = factory.createBioL10nUI({ site: { id: "x", name: "X" }, dicts: [], version: "0.11.2" });
    ui.attach(fakeEngine());
    const p = doc.querySelector("p");
    p.dispatchEvent(new win.MouseEvent("click", { bubbles: true, altKey: true, clientX: 40, clientY: 40 }));
    const card = doc.querySelector(".bl-card");
    assert.ok(card, "应弹出原文卡片");
    assert.match(card.textContent, /Getting Started/);
    assert.equal(ui.card(), card);
    doc.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    assert.equal(doc.querySelector(".bl-card"), null, "Esc 应关闭卡片");
  } finally { win.close(); }
});

test("不按 Alt 或关掉开关时不弹卡片", () => {
  const { factory, doc, win } = boot('<main><p data-orig="Getting Started">入门指南</p></main>');
  try {
    const ui = factory.createBioL10nUI({ site: { id: "x", name: "X" }, dicts: [], version: "0.11.2" });
    ui.attach(fakeEngine());
    const p = doc.querySelector("p");
    p.dispatchEvent(new win.MouseEvent("click", { bubbles: true, clientX: 40, clientY: 40 }));
    assert.equal(doc.querySelector(".bl-card"), null, "普通点击不该弹卡片");

    const pop = openPop(ui, doc, win);
    const row = [...pop.querySelectorAll(".bl-pop-row")].find((r) => /段落看原文/.test(r.textContent));
    const box = row.querySelector("input");
    box.checked = false;
    box.dispatchEvent(new win.Event("change"));
    p.dispatchEvent(new win.MouseEvent("click", { bubbles: true, altKey: true, clientX: 40, clientY: 40 }));
    assert.equal(doc.querySelector(".bl-card"), null, "关掉开关后 Alt 点击也不弹");
    const saved = JSON.parse(win.localStorage.getItem("biol10n:settings"));
    assert.equal(saved.paraOrig, false);
  } finally { win.close(); }
});
