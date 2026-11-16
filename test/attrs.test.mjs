import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const src = readFileSync(new URL("../src/engine.js", import.meta.url), "utf8");
const { createEngine } = new Function(src + "\nreturn { createEngine };")();

function boot(html, prep) {
  const dom = new JSDOM("<body>" + html + "</body>", { url: "https://www.proteinatlas.org/" });
  if (prep) prep(dom.window.document);
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: { "Please describe what is wrong...": "请描述哪里有问题...", Search: "检索" }, rules: [] },
    site: { attrs: ["placeholder", "value"], block: "pre, code, textarea" }
  });
  engine.start();
  return dom.window.document;
}

test("textarea 的 placeholder 也要翻", () => {
  const doc = boot("<textarea placeholder='Please describe what is wrong...'></textarea>");
  assert.equal(doc.querySelector("textarea").getAttribute("placeholder"), "请描述哪里有问题...");
});

test("submit 按钮的 value 要翻（文本框默认值需要站点开 valueText）", () => {
  const doc = boot("<input type=submit value='Search'><input type=text value='Search'>");
  const [submit, text] = doc.querySelectorAll("input");
  assert.equal(submit.value, "检索");
  assert.equal(text.value, "Search");
});

test("正在输入（已聚焦）的文本框不动", () => {
  const doc = boot("<input type=text value='Search'>", (d) => d.querySelector("input").focus());
  assert.equal(doc.querySelector("input").value, "Search");
});

test("代码块里的文本仍不翻", () => {
  const doc = boot("<pre>Search</pre>");
  assert.equal(doc.querySelector("pre").textContent, "Search");
});
