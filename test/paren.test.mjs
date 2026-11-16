import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";

const root = path.dirname(new URL(import.meta.url).pathname);
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();

function boot(html) {
  const dom = new JSDOM(html, { url: "https://www.cbioportal.org/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: {}, rules: [] },
    site: { scope: "", block: "pre, code", attrs: [] }
  });
  engine.scan();
  return { text: dom.window.document.querySelector("p").textContent, engine };
}

test("被链接切开的全角开括号 + 半角闭括号会补配对", () => {
  const { text } = boot('<p><span>全部样本</span>（<a href="#">1084 样本/患者</a>) - TP53</p>');
  assert.equal(text, "全部样本（1084 样本/患者） - TP53");
});

test("配对正常的半角括号不动", () => {
  const { text } = boot('<p>Total (1084 samples) - TP53</p>');
  assert.equal(text, "Total (1084 samples) - TP53");
});

test("已经配对的全角括号不重复处理", () => {
  const { text } = boot('<p>全部样本（<a href="#">1084</a>）- TP53</p>');
  assert.equal(text, "全部样本（1084）- TP53");
});
