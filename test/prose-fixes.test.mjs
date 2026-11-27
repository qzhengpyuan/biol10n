// 正文保护的两个判据修复：
// ① proseExempt 只在元素有属性时才试匹配 ⇒ 裸标签（<strong>）永远放行不了；
// ② 斜杠/与号/竖线后不算句子内部 ⇒ 同一英文句里一半中文一半英文。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + '; return createEngine;')();

const EXACT = { Search: "检索", Instruction: "说明", blue: "蓝色", red: "红色", Gene: "基因" };

function makeEngine(html, site) {
  const dom = new JSDOM(html, { url: "https://example.org/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: EXACT, rules: [], templates: [] },
    site: { scope: "body", rescan: false, ...site }
  });
  return { dom, engine };
}

const longEnough = "Cell type fractions were estimated for all samples in this cohort and are shown below as a table of relative abundances across every cell type considered here.";

test("proseExempt 能命中无属性的 <strong>（裸标签选择器）", () => {
  const html =
    "<div role=\"main\"><p>" + longEnough + "</p><strong>Instruction</strong> about the copy number change panel used by this module.</div>";
  const { dom, engine } = makeEngine(html, { proseExempt: "div[role=main] > strong" });
  engine.start();
  const strong = dom.window.document.querySelector("strong");
  assert.equal(strong.textContent, "说明", "proseExempt 裸标签应能放行");
  engine.disable();
  dom.window.close();
});

test("proseExempt 全为类/属性选择器时不匹配无属性元素（保持原有判据）", () => {
  const html =
    "<div role=\"main\"><p>" + longEnough + "</p><strong>Instruction</strong> about the copy number change panel used by this module.</div>";
  const { dom, engine } = makeEngine(html, { proseExempt: ".usa-banner, [class*=disclaimer]" });
  engine.start();
  const strong = dom.window.document.querySelector("strong");
  assert.equal(strong.textContent, "Instruction", "无关的 proseExempt 不该放行");
  engine.disable();
  dom.window.close();
});

test("斜杠后的短词与字母后的短词判据一致：同句一半中文一半英文要避免", () => {
  const html = "<div><p>" + longEnough + " The two classes are marked in red / <b>blue</b>, respectively.</p></div>";
  const { dom, engine } = makeEngine(html, {});
  engine.start();
  const b = dom.window.document.querySelector("b");
  assert.equal(b.textContent, "blue", "斜杠后的句内短词应保持英文");
  engine.disable();
  dom.window.close();
});

test("独立成块的短标签仍然照翻（不被新判据误伤）", () => {
  const html = "<div><p>" + longEnough + "</p><p><b>blue</b></p></div>";
  const { dom, engine } = makeEngine(html, {});
  engine.start();
  const b = dom.window.document.querySelector("b");
  assert.equal(b.textContent, "蓝色");
  engine.disable();
  dom.window.close();
});
