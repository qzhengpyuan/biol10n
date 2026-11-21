// r14：数字冒号的 exact 被掩码打死；块模板 tab 残留
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const engineSrc = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(engineSrc + "; return createEngine;")();
const help = JSON.parse(fs.readFileSync(path.join(root, "../dict/ncbi-help.json"), "utf8"));

function boot(data, html) {
  const dom = new JSDOM(html);
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data,
    site: { scope: "body", block: "pre, code" }
  });
  engine.start();
  return dom.window.document;
}

const CITATION =
  'collects all input elements into a single string and returns the closest matching documents. It is sufficient to supply a raw citation string, such as: "The role of drag in insect hovering. J. Exp. Biol. 2004;207:4147–4155."';

test("含数字冒号的整句仍走 exact 表（掩码只作用于规则）", () => {
  const doc = boot(
    { exact: help.exact, rules: help.rules },
    '<p><code>method=heuristic</code> ' + CITATION + "</p>"
  );
  const text = doc.querySelector("p").textContent;
  assert.match(text, /将所有输入元素合并为一个字符串/);
  assert.doesNotMatch(text, /collects all input elements/);
});

test("日期区间句（1999:2000）同样命中 exact", () => {
  const doc = boot(
    { exact: help.exact, rules: help.rules },
    "<p>To enter a date range, insert a colon (:) between each date, e.g., 1999:2000 [mhda] or 2000/03:2000/04 [mhda].</p>"
  );
  assert.match(doc.querySelector("p").textContent, /输入日期范围/);
});

test("时间冒号不被规则全角化", () => {
  const doc = boot(
    { exact: {}, rules: [{ re: "^(.+):\s*(.+)$", to: "$1：$2" }] },
    "<p>Time: 09:15</p>"
  );
  assert.match(doc.querySelector("p").textContent, /09:15/);
});

test("中文标签 + tab + 英文正文 能被补翻", () => {
  const doc = boot(
    { exact: { "Change pathway type": "更改通路类型" }, rules: [] },
    "<dl><dd>通路图\tChange pathway type</dd></dl>"
  );
  assert.equal(doc.querySelector("dd").textContent, "通路图\t更改通路类型");
});
test("skip 块里的界面标签通过 skipFree 放行，块内其它文字仍跳过", () => {
  const dom = new JSDOM(
    '<div class="resc"><p class="title">Breast cancer dataset</p><dl class="rprtid"><dt>Accession:</dt><dd>GSE331160</dd></dl></div>'
  );
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: { "Accession:": "登录号：", "Breast cancer dataset": "乳腺癌数据集" }, rules: [] },
    site: { scope: "body", block: "pre, code", skip: ".resc", skipFree: [".rprtid dt"] }
  });
  engine.start();
  const doc = dom.window.document;
  assert.equal(doc.querySelector("dt").textContent, "登录号：");
  assert.equal(doc.querySelector("p.title").textContent, "Breast cancer dataset");
});
