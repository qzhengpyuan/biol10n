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

test("默认不记录、只显示悬浮按钮", () => {
  const { factory, doc, win } = boot("<main><p>Hello</p></main>");
  try {
    const ui = factory.createBioL10nUI({ site: { id: "pubmed", name: "PubMed" }, dicts: [{ id: "ncbi", count: 12 }], version: "0.3.0" });
    assert.equal(ui.settings.log, false);
    assert.ok(doc.querySelector(".bl-badge"), "应有悬浮按钮");
    assert.equal(doc.querySelector(".bl-panel"), null, "面板默认关闭");
    ui.addMiss("Not translated sentence", { tag: "P" });
    assert.equal(ui.entries().length, 0, "记录关闭时不应收集");
  } finally { win.close(); }
});

test("打开面板后能看到站点与词库", () => {
  const { factory, doc, win } = boot("<main><p>Hello</p></main>");
  try {
    const ui = factory.createBioL10nUI({ site: { id: "pubmed", name: "PubMed" }, dicts: [{ id: "ncbi", count: 12 }], version: "0.3.0" });
    ui.toggle(true);
    const panel = doc.querySelector(".bl-panel");
    assert.ok(panel);
    assert.match(panel.textContent, /PubMed/);
    assert.match(panel.textContent, /ncbi 12 条/);
  } finally { win.close(); }
});

test("开启记录后收集漏翻、去重并按站点持久化", () => {
  const { factory, doc, win } = boot("<main></main>");
  try {
    const ui = factory.createBioL10nUI({ site: { id: "pubmed", name: "PubMed" }, dicts: [], version: "0.3.0" });
    ui.toggle(true);
    const box = doc.querySelector(".bl-panel input[type=checkbox]");
    assert.ok(box, "面板里应有记录开关");
    box.checked = true;
    box.dispatchEvent(new win.Event("change"));
    assert.equal(ui.settings.log, true);
    ui.addMiss("Some missing label", { tag: "SPAN" });
    ui.addMiss("Some missing label", { tag: "SPAN" });
    ui.addMiss("Another missing label", { tag: "SPAN" });
    assert.equal(ui.entries().length, 2, "同页同文应去重");
    const saved = JSON.parse(win.localStorage.getItem("biol10n:settings"));
    assert.equal(saved.log, true);
  } finally { win.close(); }
});

test("中文与超长文本不进入记录", () => {
  const { factory, doc, win } = boot("<main></main>");
  try {
    const ui = factory.createBioL10nUI({ site: { id: "x", name: "X" }, dicts: [], version: "0" });
    ui.toggle(true);
    const box = doc.querySelector(".bl-panel input[type=checkbox]");
    box.checked = true;
    box.dispatchEvent(new win.Event("change"));
    ui.addMiss("已经是中文的句子", {});
    ui.addMiss("x".repeat(401), {});
    assert.equal(ui.entries().length, 0);
  } finally { win.close(); }
});

test("被标记为数据区的文本不记录", () => {
  const { factory, win } = boot("<main></main>");
  try {
    const ui = factory.createBioL10nUI({ site: { id: "x", name: "X" }, dicts: [], version: "0" });
    ui.toggle(true);
    const box = win.document.querySelector(".bl-panel input[type=checkbox]");
    box.checked = true;
    box.dispatchEvent(new win.Event("change"));
    ui.addMiss("Article title in results", { skipLog: true });
    assert.equal(ui.entries().length, 0);
  } finally { win.close(); }
});
