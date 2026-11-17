import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";

const root = path.dirname(new URL(import.meta.url).pathname);
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();

const LONG = "PubMed comprises more than 40 million citations for biomedical literature from MEDLINE, life science journals, and online books.";
const SITE = { scope: "", block: "pre, code", attrs: [], proseMax: 120 };

function boot(html, exact, onMiss) {
  const dom = new JSDOM(html, { url: "https://pubmed.ncbi.nlm.nih.gov/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact, rules: [] },
    site: SITE,
    onMiss
  });
  return { dom, engine, doc: dom.window.document };
}

test("长段落命中整句时照翻", () => {
  const html = "<p><b>" + LONG + "</b> and the sentence continues in this paragraph with more text here.</p>";
  const { engine, doc } = boot(html, { [LONG]: "中文长句。" });
  engine.start();
  assert.match(doc.querySelector("b").textContent, /中文长句。/, "长句应被整条命中");
});

test("长段落没收录时保持英文并记为 prose 漏翻", () => {
  const misses = [];
  const html = "<p><b>" + LONG + "</b> and the sentence continues in this paragraph with more text here.</p>";
  const { engine, doc } = boot(html, {}, (t, ctx) => misses.push({ t, ctx }));
  engine.start();
  assert.match(doc.querySelector("b").textContent, /PubMed comprises/);
  assert.ok(misses.some((m) => m.ctx.prose === true), "应记录为正文内漏翻");
  assert.ok(engine.stats.miss >= 1);
});

test("正文里的短链接不被单独翻成中文", () => {
  const html = "<p>This paragraph is deliberately long so that it is definitely treated as prose body text by the guard, longer than the one hundred and twenty character threshold. Please see <a>Contact Us</a> for help with anything else.</p>";
  const { engine, doc } = boot(html, { "Contact Us": "联系我们" });
  engine.start();
  assert.equal(doc.querySelector("a").textContent, "Contact Us");
});
