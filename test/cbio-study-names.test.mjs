// cBioPortal 研究显示名的处理口径：整名不翻（数据集身份，不是界面词）。
// 目的：把这条口径钉在测试里——别有人给某条研究名加半中半英的译文，
// 也别让「研究名形态」的噪音正则吃掉真界面标签。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const engineSrc = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(engineSrc + "; return createEngine;")();
const common = JSON.parse(fs.readFileSync(path.join(root, "../dict/common.json"), "utf8"));
const cbio = JSON.parse(fs.readFileSync(path.join(root, "../dict/cbioportal.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "cbioportal");

const STUDY_NAMES = [
  "Breast Invasive Carcinoma (TCGA, PanCancer Atlas)",
  "MSK-IMPACT Clinical Sequencing Cohort (MSK, Nat Med 2017)",
  "Metastatic Solid Cancers (UMich, Nature 2017)",
  "Acute Lymphoblastic Leukemia (St Jude, Nat Genet 2016)",
  "Breast Cancer (SMC 2018)"
];

const UI_LABELS = [
  "Study View", "Patient View", "Results View", "New Feature",
  "Onco Query Language (OQL)", "Copy-number Alterations (OQL is not in effect)",
  "mRNA expression (RNA Seq V2 RSEM)", "Treatment per Sample (pre/post)"
];

function isNoise(text) {
  const s = String(text).toLowerCase();
  return (site.missNoise || []).some((raw) => {
    const n = String(raw).trim();
    if (n.slice(0, 3).toLowerCase() !== "re:") return s.includes(n.toLowerCase());
    return new RegExp(n.slice(3), "i").test(s);
  });
}

test("站点 skip 名单里明确排除了研究名容器（整名不翻的落点）", () => {
  const skip = String(site.skip || "");
  for (const sel of [".study-name", ".dataset-name", ".studyMeta"]) {
    assert.ok(skip.includes(sel), "skip 里应包含 " + sel);
  }
});

test("研究显示名原样保留：整名英文，不出现半中半英", () => {
  const html = "<div id=\"root\"><main>" + STUDY_NAMES.map((n) => "<a class=\"study-name\">" + n + "</a>").join("") + "</main></div>";
  const dom = new JSDOM(html, { url: "https://www.cbioportal.org/datasets" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: Object.assign({}, common.exact, cbio.exact), rules: [], templates: [] },
    site: Object.assign({}, site, { rescan: false })
  });
  engine.start();
  const got = [...dom.window.document.querySelectorAll("a.study-name")].map((a) => a.textContent);
  assert.deepEqual(got, STUDY_NAMES, "研究名必须一字不改");
  assert.ok(got.every((t) => !/[\u4e00-\u9fff]/.test(t)), "研究名里不该出现中文");
});

test("研究名形态进漏翻清单前被滤掉（含不同队列写法）", () => {
  for (const name of STUDY_NAMES) assert.ok(isNoise(name), "应被名单滤掉: " + name);
  assert.ok(isNoise("Metastatic Melanoma (UCLA, Cell 2016) - iAtlas Harmonized"), "iAtlas 后缀也要滤");
});

test("名单不会误伤真界面标签", () => {
  for (const label of UI_LABELS) assert.equal(isNoise(label), false, "不该被滤掉: " + label);
});
