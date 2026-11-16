import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const src = readFileSync(new URL("../src/engine.js", import.meta.url), "utf8");
const { createEngine } = new Function(src + "\nreturn { createEngine };")();

function run(html, site = {}) {
  const dom = new JSDOM("<body>" + html + "</body>", { url: "https://example.org/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: { Summary: "概要", Search: "检索", "More information": "更多信息" }, rules: [] },
    site: Object.assign({ attrs: ["value", "placeholder"], block: "", proseGuard: true }, site)
  });
  engine.start();
  return dom.window.document;
}

test("<option value> 是提交参数，绝不能翻", () => {
  const doc = run('<select><option value="summary">Summary</option></select>');
  const opt = doc.querySelector("option");
  assert.equal(opt.getAttribute("value"), "summary");
  assert.equal(opt.textContent, "概要");
});

test("submit 按钮的 value 要翻", () => {
  const doc = run('<input type="submit" value="Search">');
  assert.equal(doc.querySelector("input").getAttribute("value"), "检索");
});

test("未聚焦文本框的默认 value：站点没开 valueText 就不翻（避免改掉提交参数）", () => {
  const doc = run('<input type="text" value="Search">');
  assert.equal(doc.querySelector("input").getAttribute("value"), "Search");
});

test("站点开了 valueText 才翻文本框默认值", () => {
  const doc = run('<input type="text" value="Search">', { valueText: true });
  assert.equal(doc.querySelector("input").getAttribute("value"), "检索");
});

test("option 文字与 value 相同视为标识符，不翻（下载格式名）", () => {
  const dom = new JSDOM('<body><select><option value="List">List</option><option value="over">Over-expressed</option></select></body>', { url: "https://example.org/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: { "List": "列表", "Over-expressed": "过表达" }, rules: [] },
    site: { attrs: [], block: "", proseGuard: true }
  });
  engine.start();
  const opts = [...dom.window.document.querySelectorAll("option")];
  assert.equal(opts[0].textContent, "List");
  assert.equal(opts[0].getAttribute("value"), "List");
  assert.equal(opts[1].textContent, "过表达");
  assert.equal(opts[1].getAttribute("value"), "over");
});
