import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();

const common = JSON.parse(fs.readFileSync(path.join(root, "../dict/common.json"), "utf8"));
const ena = JSON.parse(fs.readFileSync(path.join(root, "../dict/ena.json"), "utf8"));
const cfg = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8"));

// `Query` 在 cBioPortal / Ensembl / ENA 这些站都是页签或按钮的标签，
// 旧的「查询式」是把它当检索表达式理解（那是 `Query string` 的语境），标签上读着别扭。
// 句子里的「检索式」保持不变（`ncbi-help` 的 `Query: This column shows previous search strings…` 是另一条键）。

test("common 与 ena 的 Query 都译作「查询」，两册不许再分叉", () => {
  assert.equal(common.exact.Query, "查询");
  assert.equal(ena.exact.Query, "查询");
});

test("句子里的「检索式」不受影响", () => {
  assert.match(common.exact.Query || "", /查询/);
  const nowDashed = Object.entries(common.exact).filter(([k, v]) => k === "Query" && v.includes("式"));
  assert.deepEqual(nowDashed, []);
});

const SITE = { scope: "body", block: "pre, code", attrs: [] };

test("页面上的 Query 页签翻成「查询」", () => {
  const dom = new JSDOM("<body><nav><a>Query</a></nav><p>Select a query</p></body>", { url: "https://www.cbioportal.org/" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data: { exact: common.exact, rules: [], templates: [] }, site: SITE });
  engine.scan();
  assert.equal(dom.window.document.querySelector("nav a").textContent, "查询");
  assert.equal(dom.window.document.querySelector("p").textContent, "Select a query", "正文句子不动");
});

// --- 站级不翻名单（missNoise）---
const gdcDocs = cfg.sites.find((s) => s.id === "gdc-docs");
const noise = (gdcDocs && gdcDocs.missNoise) || [];
const noiseHas = (t) => noise.some((n) => String(t).toLowerCase().includes(String(n).toLowerCase()));

test("gdc-docs 的 missNoise 覆盖实测出现过的流程名/工具名", () => {
  assert.ok(noise.length >= 30, "名单条数 " + noise.length + " 偏少");
  for (const name of [
    "BWA with BQSR",
    "ASCAT2",
    "ABSOLUTE LiftOver",
    "Arriba",
    "MuSE Annotation",
    "VarScan2 Annotation",
    "STAR 2-Pass Genome",
    "CellRanger - 10x Chromium",
    "FPKM-UQ",
    "TCGA Barcode",
    "VCF LiftOver",
    "dbGaP",
    "TCIA",
    "UUID",
  ]) {
    assert.ok(noiseHas(name), "missNoise 漏了 " + name);
  }
});

test("名单不能把该翻的界面词也吃掉", () => {
  for (const bad of ["Data", "Tool", "Search", "Query", "Download", "Summary"]) {
    assert.equal(noiseHas(bad), false, "missNoise 不该包含 " + bad);
  }
});

test("这些流程名也确实没有进任何词库的 exact（否则会被翻成中文）", () => {
  const hits = [];
  const dir = path.join(root, "../dict");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    for (const key of Object.keys(d.exact || {})) {
      if (/^(BWA|ASCAT|MuSE|VarScan2|STAR 2-Pass|CellRanger)/.test(key)) hits.push(f + ":" + key);
    }
  }
  assert.deepEqual(hits, []);
});
