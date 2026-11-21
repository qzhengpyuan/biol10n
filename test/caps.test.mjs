import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();

// KEGG dbentry 的平面文件常量必须原样保留：exact 里只有首字母大写形态时，全大写串不许被小写回退吃掉。
const DATA = {
  exact: { Entry: "条目", Name: "名称", Description: "描述", Gene: "基因", Download: "下载", DOI: "DOI 号", IDEA: "想法" },
  rules: []
};
const SITE = { scope: "", block: "", attrs: [] };

function boot(html) {
  const dom = new JSDOM(html, { url: "https://www.genome.jp/kegg/docs/dbentry.html" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data: DATA, site: SITE });
  return { engine, doc: dom.window.document };
}

test("全大写平面文件常量不被小写回退翻译", () => {
  const { engine, doc } = boot("<div><span>ENTRY</span><span>NAME</span><span>DESCRIPTION</span><span>GENE</span></div>");
  engine.start();
  assert.deepEqual([...doc.querySelectorAll("span")].map(s => s.textContent), ["ENTRY", "NAME", "DESCRIPTION", "GENE"]);
});

test("首字母大写形态仍然翻译", () => {
  const { engine, doc } = boot("<div><span>Entry</span><span>Name</span><span>Download</span></div>");
  engine.start();
  assert.deepEqual([...doc.querySelectorAll("span")].map(s => s.textContent), ["条目", "名称", "下载"]);
});

test("exact 里登记的大写形态照旧命中", () => {
  const { engine, doc } = boot("<div><span>DOI</span><span>IDEA</span></div>");
  engine.start();
  assert.deepEqual([...doc.querySelectorAll("span")].map(s => s.textContent), ["DOI 号", "想法"]);
});
