// r31：PubChem 化合物记录页（CID 2244）界面残留补译 —— 分区标题 / 3.1 计算性质表头 /
// 12 安全与危害字段标签 / MeSH 入口词与计数标签。
//
// 实测来源（2026-11-23，CDP 真渲染 DOM，https://pubchem.ncbi.nlm.nih.gov/compound/2244）：
//   · 分区标题残留在 <span class="flex-1"> 里，如 "7.11 DEA Drug and Chemical Information"、
//     "15.3 Springer Nature References"、"13.1.12.2 NIOSH Toxicity Data"；
//   · 3.1 计算性质表头是 <div class="text-left sm:table-cell">…</div>，
//     "Hydrogen Bond Donor Count" / "Monoisotopic Mass" / "Compound Is Canonicalized" 等 14 条仍是英文；
//   · 12.2.1 / 12.3 / 12.7 的字段标签是 <div class="font-semibold">，"Flammability"、
//     "Inhalation First Aid"、"Skin Exposure"、"REL-TWA (Time Weighted Average)" 等；
//   · "MeSH Entry Terms for Aspirin" 与 "73 vendors" / "1,777 items" / "18,249 patents from …" 是
//     带变量的固定说明句，逐条 exact 会随化名/数字翻倍，改成规则。
// 数据值（分子量、同义词、InChIKey、算法名 XLogP3）一律不翻，用例里做了反向保护。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, "../dict", f), "utf8"));
const book = read("pubchem-dbgap.json");
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = Object.assign(
  { id: "pubchem", scope: "body", dicts: ["common", "ncbi", "pubchem-dbgap"] },
  sites.find((s) => s.id === "pubchem") || {}
);

function siteData() {
  const exact = {}, rules = [], templates = [];
  for (const id of site.dicts) {
    const p = path.join(root, "../dict", id + ".json");
    if (!fs.existsSync(p)) continue;
    const b = JSON.parse(fs.readFileSync(p, "utf8"));
    Object.assign(exact, b.exact || {});
    rules.push(...(b.rules || []));
    templates.push(...(b.templates || []));
  }
  return { exact, rules, templates };
}

function boot(html, url) {
  const dom = new JSDOM("<body>" + html + "</body>", {
    url: url || "https://pubchem.ncbi.nlm.nih.gov/compound/2244"
  });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data: siteData(), site });
  engine.start();
  return { dom, engine, doc: dom.window.document };
}

const HEADINGS = {
  "7.11 DEA Drug and Chemical Information": "7.11 DEA 药物与化学品信息",
  "7.12 EMA Drug Information": "7.12 EMA 药物信息",
  "7.13 Therapeutic Uses": "7.13 治疗用途",
  "7.14 Drug Development Summary": "7.14 药物研发摘要",
  "7.15 Drug Warnings": "7.15 药物警告",
  "7.16 Drug Idiosyncrasies": "7.16 药物特异反应",
  "7.17 Reported Fatal Dose": "7.17 报告的致死剂量",
  "7.18 Maximum Drug Dose": "7.18 最大药物剂量",
  "7.19 Drug Targets": "7.19 药物靶点",
  "7.20 Drug-Drug Interactions": "7.20 药物-药物相互作用",
  "7.21 Drug-Food Interactions": "7.21 药物-食物相互作用",
  "13.1.12.1 EPA Human Health Benchmarks for Pharmaceuticals": "13.1.12.1 EPA 药物人体健康基准值",
  "13.1.12.2 NIOSH Toxicity Data": "13.1.12.2 NIOSH 毒性数据",
  "15.3 Springer Nature References": "15.3 Springer Nature 参考文献",
  "15.4 Thieme References": "15.4 Thieme 参考文献",
  "15.5 Wiley References": "15.5 Wiley 参考文献",
  "15.6 Beilstein References": "15.6 Beilstein 参考文献",
  "15.7 Nature Journal References": "15.7 Nature 期刊参考文献"
};

const PROPERTY_NAMES = {
  "Hydrogen Bond Donor Count": "氢键供体数",
  "Hydrogen Bond Acceptor Count": "氢键受体数",
  "Rotatable Bond Count": "可旋转键数",
  "Monoisotopic Mass": "单同位素质量",
  "Topological Polar Surface Area": "拓扑极性表面积",
  "Heavy Atom Count": "重原子数",
  "Formal Charge": "形式电荷",
  "Isotope Atom Count": "同位素原子数",
  "Defined Atom Stereocenter Count": "已定义原子立体中心数",
  "Undefined Atom Stereocenter Count": "未定义原子立体中心数",
  "Defined Bond Stereocenter Count": "已定义键立体中心数",
  "Undefined Bond Stereocenter Count": "未定义键立体中心数",
  "Covalently-Bonded Unit Count": "共价键合单元数",
  "Compound Is Canonicalized": "化合物已规范化"
};

const FIELD_LABELS = {
  "Flammability": "易燃性",
  "Inhalation First Aid": "吸入急救",
  "Skin First Aid": "皮肤急救",
  "Eye First Aid": "眼睛急救",
  "Ingestion First Aid": "摄入急救",
  "Inhalation Exposure": "吸入暴露",
  "Skin Exposure": "皮肤暴露",
  "Eye Exposure": "眼睛暴露",
  "Ingestion Exposure": "摄入暴露",
  "REL-TWA (Time Weighted Average)": "REL-TWA（时间加权平均）",
  "TLV-TWA (Time Weighted Average)": "TLV-TWA（时间加权平均）",
  "Associated Occupational Diseases with Exposure to the Compound": "接触该化合物相关的职业病",
  "Route of Elimination": "消除途径",
  "Volume of Distribution": "分布容积",
  "Clearance": "清除率",
  "ATCvet Code": "ATCvet 代码",
  "Sources/Uses": "来源/用途"
};

test("r31 词库：49 条条目进 pubchem 册（分区标题 18 + 计算性质表头 14 + 字段标签 17）", () => {
  assert.equal(book.meta.family, "pubchem-dbgap");
  const all = Object.assign({}, HEADINGS, PROPERTY_NAMES, FIELD_LABELS);
  assert.equal(Object.keys(all).length, 49, "用例自身条目数不对: " + Object.keys(all).length);
  for (const [k, v] of Object.entries(all)) assert.equal(book.exact[k], v, "缺少/译错: " + k);
  assert.ok(Object.keys(book.exact).length >= 588, "exact 条目不足 588: " + Object.keys(book.exact).length);
});

test("r31 词库：5 条新规则锚定且带占位符", () => {
  const want = [
    "^MeSH Entry Terms for (.+)$",
    "^([\\d,]+) vendors$",
    "^([\\d,]+) items$",
    "^([\\d,]+) articles$",
    "^([\\d,]+) patents from ([\\d,]+) patent families$"
  ];
  for (const re of want) {
    const hit = book.rules.find((r) => r.re === re);
    assert.ok(hit, "缺规则: " + re);
    assert.ok(hit.to.includes("$1"), "规则译文缺 $1: " + re);
    assert.ok(/[\u4e00-\u9fff]/.test(hit.to), "规则译文不是中文: " + re);
  }
  assert.equal(book.rules.length, 10, "规则总数应为 10: " + book.rules.length);
});

test("r31 分区标题：7.11–7.21 / 15.3–15.7 / 13.1.12.x 的 span.flex-1 实际换成中文", () => {
  const html = Object.keys(HEADINGS)
    .map((k) => '<div class="py-px"><span class="flex-1">' + k + "</span></div>")
    .join("");
  const { doc, dom } = boot(html);
  const spans = doc.querySelectorAll("span.flex-1");
  assert.equal(spans.length, Object.keys(HEADINGS).length);
  Object.entries(HEADINGS).forEach(([k, v], i) => {
    assert.equal(spans[i].textContent, v, "标题未翻: " + k);
  });
  dom.window.close();
});

test("r31 Properties 折叠区：3.1 计算性质表头单元格翻成中文", () => {
  const html =
    '<div class="flex">' +
    Object.keys(PROPERTY_NAMES)
      .map((k) => '<div class="text-left sm:table-cell">' + k + "</div>")
      .join("") +
    "</div>";
  const { doc, dom } = boot(html);
  const cells = doc.querySelectorAll("div.text-left");
  assert.equal(cells.length, Object.keys(PROPERTY_NAMES).length);
  Object.entries(PROPERTY_NAMES).forEach(([k, v], i) => {
    assert.equal(cells[i].textContent, v, "表头未翻: " + k);
  });
  dom.window.close();
});

test("r31 Safety and Hazards：12.2/12.3/12.7 的 font-semibold 字段标签翻成中文", () => {
  const html = Object.keys(FIELD_LABELS)
    .map((k) => '<div class="font-semibold">' + k + "</div>")
    .join("");
  const { doc, dom } = boot(html);
  const labels = doc.querySelectorAll("div.font-semibold");
  assert.equal(labels.length, Object.keys(FIELD_LABELS).length);
  Object.entries(FIELD_LABELS).forEach(([k, v], i) => {
    assert.equal(labels[i].textContent, v, "字段标签未翻: " + k);
  });
  dom.window.close();
});

test("r31 规则：MeSH 入口词表头按化名套模板", () => {
  const { engine, dom } = boot(
    '<div class="font-semibold">MeSH Entry Terms for Aspirin</div>' +
      '<div class="font-semibold">MeSH Entry Terms for Ecotrin</div>'
  );
  assert.equal(engine.translateText("MeSH Entry Terms for Aspirin"), "Aspirin 的 MeSH 入口词");
  assert.equal(engine.translateText("MeSH Entry Terms for Acylpyrin"), "Acylpyrin 的 MeSH 入口词");
  dom.window.close();
});

test("r31 规则：条目/供应商/文章/专利计数标签翻成中文且数字原样", () => {
  const cases = {
    "73 vendors": "73 个供应商",
    "1,777 items": "1,777 个条目",
    "82,764 items": "82,764 个条目",
    "24,968 articles": "24,968 篇文章",
    "18,249 patents from 14,073 patent families": "18,249 项专利，来自 14,073 个专利族"
  };
  const { engine, dom } = boot("<p>x</p>");
  for (const [k, v] of Object.entries(cases)) assert.equal(engine.translateText(k), v, "计数标签未翻: " + k);
  dom.window.close();
});

test("r31 不翻数据：分子量 / 同义词 / InChIKey / 算法名 / 化合物名保持原样", () => {
  const { engine, doc, dom } = boot(
    '<div class="wrap-break-word space-y-1">180.16 g/mol</div>' +
      '<div class="text-left sm:table-cell">XLogP3</div>' +
      '<div class="wrap-break-word space-y-1">BSYNRYMUTXBXSQ-UHFFFAOYSA-N</div>' +
      '<ul><li><a class="regular-link">ACETYLSALICYLIC ACID</a></li>' +
      '<li><a class="regular-link">aspirin</a></li></ul>' +
      '<h1 class="short">Aspirin</h1>'
  );
  for (const s of ["180.16 g/mol", "XLogP3", "BSYNRYMUTXBXSQ-UHFFFAOYSA-N", "ACETYLSALICYLIC ACID", "aspirin"]) {
    assert.equal(engine.translateText(s), null, "数据值被翻了: " + s);
  }
  assert.equal(doc.querySelector("h1").textContent, "Aspirin", "化合物名被翻了");
  assert.equal(doc.querySelector("div.wrap-break-word").textContent, "180.16 g/mol");
  dom.window.close();
});

test("r31 不误伤相邻区块：4.3.3 的仪器名与 12.1.1 的 H/P 代码保持英文", () => {
  const { doc, dom } = boot(
    '<div class="wrap-break-word space-y-1">QExactive Orbitrap HF-X (Thermo Scientific)</div>' +
      '<a class="regular-link pubchem-internal-link">H302</a>' +
      '<a class="regular-link pubchem-internal-link">P305+P351+P338</a>'
  );
  assert.equal(doc.querySelector("div").textContent, "QExactive Orbitrap HF-X (Thermo Scientific)");
  const links = doc.querySelectorAll("a");
  assert.equal(links[0].textContent, "H302");
  assert.equal(links[1].textContent, "P305+P351+P338");
  dom.window.close();
});
