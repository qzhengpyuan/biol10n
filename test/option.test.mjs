import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";

const root = path.dirname(new URL(import.meta.url).pathname);
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();

const DATA = {
  exact: {
    Mutagenesis: "诱变",
    "Binding site": "结合位点",
    FASTA: "FASTA 格式",
    List: "列表",
    Align: "比对",
    Human: "人类"
  },
  rules: [{ re: "^(\\d+) publications?$", to: "$1 篇文献" }]
};

function boot(html, siteExtra = {}) {
  const dom = new JSDOM(html, { url: "https://www.uniprot.org/uniprotkb/P04637/entry" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: DATA,
    site: { scope: "", block: "pre, code, textarea", attrs: ["title", "aria-label"], ...siteExtra }
  });
  engine.scan();
  return { engine, doc: dom.window.document };
}

test("筛选器选项翻文字、绝不改 value", () => {
  const { doc } = boot('<select><option value="All">All</option><option value="Mutagenesis">Mutagenesis</option></select>');
  const opts = [...doc.querySelectorAll("option")];
  assert.equal(opts[0].textContent, "All");            // All 不在词表里，保持原样
  assert.equal(opts[1].textContent, "诱变");
  assert.equal(opts[1].getAttribute("value"), "Mutagenesis");
});

test("下载格式名不翻（即使 value 与文字相同）", () => {
  const { doc } = boot('<select><option value="FASTA">FASTA</option><option value="List">List</option><option value="TSV">TSV</option></select>');
  assert.deepEqual([...doc.querySelectorAll("option")].map(o => o.textContent), ["FASTA", "List", "TSV"]);
});

test('translate="no" 的普通文本仍不翻', () => {
  const { doc } = boot('<div translate="no"><span>Human</span></div>');
  assert.equal(doc.querySelector("span").textContent, "Human");
});

test('translate="no" 里命中原生控件放行（translateNoAllow）', () => {
  const html = '<div translate="no"><button class="evidence-tag">1 publication</button><a href="/align">Align</a><span>Human</span></div>';
  const { doc } = boot(html, { translateNoAllow: ['button.evidence-tag', 'a[href="/align"]'] });
  assert.equal(doc.querySelector("button").textContent, "1 篇文献");
  assert.equal(doc.querySelector("a").textContent, "比对");
  assert.equal(doc.querySelector("span").textContent, "Human");
});

test("allowlist 只在同一层 translate=no 内生效", () => {
  const html = '<div translate="no"><span><button class="evidence-tag">1 publication</button></span></div>';
  const { doc } = boot(html, { translateNoAllow: ['button.evidence-tag'] });
  assert.equal(doc.querySelector("button").textContent, "1 篇文献");
});
