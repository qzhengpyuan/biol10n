// r26：r25 P2-1 标题修复回归——STRING 首页、EMBL-EBI 首页、GTR 基因页、ClinVar 404，
// 外加 BioMart 空标题取证（站点自身 <title></title> 为空，不是脚本写坏，不加词）。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, "../dict", f + ".json"), "utf8"));

function siteById(id) {
  const site = sites.find((s) => s.id === id);
  assert.ok(site, "缺站点配置: " + id);
  return site;
}

// 按站点 config 里的 dicts 顺序叠词库，保证规则命中顺序与线上一致。
function dataFor(id) {
  const site = siteById(id);
  const exact = {}, rules = [];
  for (const book of site.dicts) {
    const d = read(book);
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
  }
  return { site, exact, rules };
}

function boot(id, title) {
  const { site, exact, rules } = dataFor(id);
  const dom = new JSDOM("<p>x</p>", { url: "https://example.org/" });
  dom.window.document.title = title;
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact, rules },
    site: { scope: "", block: "pre, code", attrs: [], rescan: [], ...site }
  });
  engine.start();
  return { engine, doc: dom.window.document, title: dom.window.document.title };
}

test("STRING 首页标题整条中文（品牌 STRING 保留）", () => {
  const t = "STRING: functional protein association networks";
  const { title, engine } = boot("string-db", t);
  assert.equal(title, "STRING：功能蛋白关联网络");
  assert.equal(engine.stats.titleHit, 1);
});

test("EMBL-EBI 首页标题翻成中文（| 分段，品牌保留）", () => {
  const { title, engine } = boot("embl-ebi", "EMBL-EBI homepage | EMBL-EBI");
  assert.equal(title, "EMBL-EBI 首页 | EMBL-EBI");
  assert.equal(engine.stats.titleHit, 1);
});

test("GTR 基因页标题：基因名保留，NIH 遗传检测登记库段翻中文", () => {
  const t = "BRCA1 BRCA1 DNA repair associated - NIH Genetic Testing Registry (GTR) - NCBI";
  const { title, engine } = boot("ncbi-gtr", t);
  assert.equal(title, "BRCA1 BRCA1 DNA repair associated - NIH 遗传检测登记库（GTR） - NCBI");
  assert.equal(engine.stats.titleRule, 1);
});

test("ClinVar 404 标题按规则兜底（含 DOM 里的双空格形态）", () => {
  const a = boot("ncbi-clinvar", "404 Not Found - - ClinVar - NCBI");
  assert.equal(a.title, "404 未找到 - ClinVar - NCBI");
  assert.equal(a.engine.stats.titleRule, 1);
  const b = boot("ncbi-clinvar", "404 Not Found -  - ClinVar - NCBI");
  assert.equal(b.title, "404 未找到 - ClinVar - NCBI");
});

test("BioMart 空标题保持为空：站点自身 <title></title>，引擎不写不入账", () => {
  const { title, engine } = boot("biomart", "");
  assert.equal(title, "");
  assert.equal(engine.stats.titleHit, undefined);
  assert.equal(engine.stats.titleRule, undefined);
});

test("站点配置挂对了册：标题修复写进对应 dict", () => {
  assert.ok(siteById("string-db").dicts.includes("string-atlas"));
  assert.ok(siteById("embl-ebi").dicts.includes("string-atlas"));
  assert.ok(siteById("ncbi-gtr").dicts.includes("medgen-gtr"));
  assert.ok(siteById("ncbi-clinvar").dicts.includes("clinvar-core"));
  assert.equal(read("string-atlas").exact["STRING: functional protein association networks"], "STRING：功能蛋白关联网络");
  assert.equal(read("string-atlas").exact["EMBL-EBI homepage"], "EMBL-EBI 首页");
  assert.ok(read("medgen-gtr").rules.some((r) => r.re.includes("NIH Genetic Testing Registry \\(GTR\\)")));
  assert.ok(read("clinvar-core").rules.some((r) => /\^404 Not Found/.test(r.re)));
});
