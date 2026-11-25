// r52：originalText()——点击「对照」时不必关脚本刷新就能看到英文原文
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();

const EN = "The data in ClinVar's web site are updated weekly, on Mondays.";
const data = { exact: { [EN]: "ClinVar 网站上的数据每周一更新。" }, rules: [], templates: [] };

function boot(html) {
  const dom = new JSDOM(html, { url: "https://www.ncbi.nlm.nih.gov/clinvar/docs/x/" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site: { id: "t", dicts: [] } });
  engine.start();
  return { doc: dom.window.document, engine };
}

test("整块替换后 originalText 仍能取到英文原文", () => {
  const { doc, engine } = boot("<div><p>" + EN + "</p></div>");
  const p = doc.querySelector("p");
  assert.equal(p.textContent, "ClinVar 网站上的数据每周一更新。");
  assert.equal(engine.originalText(p), EN);
});

test("逐节点替换也能从后代的原文推出来", () => {
  const { doc, engine } = boot("<div><p><span>" + EN + "</span></p></div>");
  const span = doc.querySelector("span");
  assert.equal(span.textContent, "ClinVar 网站上的数据每周一更新。");
  assert.equal(engine.originalText(span), EN);
});
