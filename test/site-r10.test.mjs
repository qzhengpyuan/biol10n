import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8"));
const cbp = JSON.parse(fs.readFileSync(path.join(root, "../dict/cbioportal.json"), "utf8"));
const site = (sites.sites || sites).find((s) => s.id === "cbioportal");

function boot(html) {
  const dom = new JSDOM(html, { url: "https://www.cbioportal.org/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: cbp.exact, rules: cbp.rules },
    site: { scope: "", block: "pre, code", attrs: [], skip: site.skip }
  });
  engine.start();
  return dom.window.document;
}

// 检查方 r10：.headBlock 整块 skip 会挡住查询按钮，但数据集名必须保持英文。
test("cBio headBlock 内按钮翻译、数据集名不翻", () => {
  const doc = boot(
    "<div class='headBlock'>" +
      "<button type='button'>Modify Query</button>" +
      "<div class='styles-module__summary__x'><h3>Breast Invasive Carcinoma (TCGA, PanCancer Atlas)</h3></div>" +
      "<span>samples/patients</span>" +
      "</div>"
  );
  assert.equal(doc.querySelector("button").textContent, "修改查询");
  assert.equal(doc.querySelector("h3").textContent, "Breast Invasive Carcinoma (TCGA, PanCancer Atlas)");
  assert.equal(doc.querySelector("span").textContent, "样本/患者");
});

test("RCSB 带数字的多选提示整条翻译", () => {
  const rcsb = JSON.parse(fs.readFileSync(path.join(root, "../dict/rcsb.json"), "utf8"));
  const dom = new JSDOM("<small id=s>Use CTRL or Shift keys to select more than one file (2 files max)</small>");
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: rcsb.exact, rules: rcsb.rules },
    site: { scope: "", block: "pre, code", attrs: [] }
  });
  engine.start();
  assert.equal(dom.window.document.getElementById("s").textContent, "使用 CTRL 或 Shift 键可选择多个文件（上限：2 个）");
});

test("GTEx 外显子图题冒号后不留空格", () => {
  const gtex = JSON.parse(fs.readFileSync(path.join(root, "../dict/gtex.json"), "utf8"));
  const dom = new JSDOM("<p id=p>Exon Expression of TP53: ENSG00000141510.19 tumor protein p53</p>");
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: gtex.exact, rules: gtex.rules },
    site: { scope: "", block: "pre, code", attrs: [] }
  });
  engine.start();
  assert.equal(dom.window.document.getElementById("p").textContent, "TP53 的外显子表达：ENSG00000141510.19 tumor protein p53");
});
