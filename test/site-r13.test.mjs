// 检查方 r13/r14：skip 块内的按钮属性仍翻（attrSkipFree）
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const cb = JSON.parse(fs.readFileSync(path.join(root, "../dict/cbioportal.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "cbioportal");

test("cBio 数据集名保持英文，下载链接 aria-label 仍翻", () => {
  const dom = new JSDOM(
    '<div class="headBlock"><div class="styles-module__summary__x"><h3><span>Breast Invasive Carcinoma (TCGA, PanCancer Atlas)</span>' +
      '<a class="dataset-table-download-link" aria-label="Download Study brca_tcga_pan_can_atlas_2018" href="#">dl</a></h3></div></div>'
  );
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: cb.exact, rules: cb.rules },
    site
  });
  engine.start();
  const doc = dom.window.document;
  assert.equal(doc.querySelector("h3 span").textContent, "Breast Invasive Carcinoma (TCGA, PanCancer Atlas)");
  assert.equal(doc.querySelector("a").getAttribute("aria-label"), "下载研究 brca_tcga_pan_can_atlas_2018");
});
