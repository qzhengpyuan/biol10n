// r50：正文里嵌 <button> 的整段说明可以走模板（按钮当槽位，替换后原按钮放回原位）
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();

const PAT =
  'The {{1}} button below the tracks image, or the shortcut {{2}}, {{3}} and not just the DNA sequence. Every annotation flips to the minus strand, which makes a gene transcribed right to left far easier to read.';
const ZH =
  "轨道图像下方的{{1}}按钮，或快捷键 {{2}}，会{{3}}，而不只是 DNA 序列。所有注释都会翻转到负链，这让从右向左转录的基因读起来容易得多。";

const data = {
  exact: { Reverse: "反向", '"r" then "v"': "「r」再「v」", "reverse complements the entire display": "将整个显示区反向互补" },
  rules: [],
  templates: [{ pat: PAT, zh: ZH }]
};

function boot(html) {
  const dom = new JSDOM(html, { url: "https://genome.ucsc.edu/" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site: { id: "ucsc", dicts: [] } });
  engine.start();
  return dom.window.document;
}

test("带 <button> 的整段说明走模板，按钮节点保留在原地", () => {
  const doc = boot(
    '<div><p>The <button>Reverse</button> button below the tracks image, or the shortcut <b>"r" then "v"</b>, <b>reverse complements the entire display</b> and not just the DNA sequence. Every annotation flips to the minus strand, which makes a gene transcribed right to left far easier to read.</p></div>'
  );
  const p = doc.querySelector("p");
  assert.equal(p.querySelectorAll("button").length, 1, "按钮必须保留");
  assert.equal(p.querySelector("button").textContent, "反向");
  assert.match(p.textContent, /轨道图像下方的反向按钮/);
  assert.match(p.textContent, /「r」再「v」/);
  assert.match(p.textContent, /将整个显示区反向互补/);
  assert.doesNotMatch(p.textContent, /below the tracks image/, "整段不该留英文尾巴");
});

test("按钮里有子元素时不当作槽位（宁可不匹配）", () => {
  const doc = boot(
    '<div><p>The <button><span>Reverse</span></button> button below the tracks image, or the shortcut <b>"r" then "v"</b>, <b>reverse complements the entire display</b> and not just the DNA sequence.</p></div>'
  );
  assert.doesNotMatch(doc.querySelector("p").textContent, /轨道图像下方/);
});
