// r26 GTEx 其余三页（tissue/eQTL dashboard/gene）补词回归：
// 1) gene 页 eQTL/sQTL 表头三条 gtooltip 说明（"…" 前带冒号的文本节点）走规则通道，
//    整句命中且不得只翻半句；
// 2) gene 页单细胞视图的 SVG 轴标签、细胞类型大写枚举与 eQTL 仪表盘结果图轴标签/检验标签；
// 3) 组织名、登录号、变异 ID、基因符号、基因型与样本数等标识保持原样；
// 4) 本册 exact 值不超过 60 字符（check.mjs 的「词条值过长」阈值），新规则必须首尾锚定。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();

const readDict = (n) => JSON.parse(fs.readFileSync(path.join(root, "../dict", n + ".json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const cfg = sites.find((s) => s.id === "gtex");
assert.ok(cfg, "config/sites.json 缺少 gtex 站点");

const gtexSite = {
  id: "gtex",
  hosts: cfg.hosts,
  dicts: cfg.dicts,
  scope: cfg.scope,
  spa: cfg.spa,
  attrs: cfg.attrs || []
};
const gtexData = { exact: {}, rules: [], templates: [] };
for (const id of gtexSite.dicts) {
  const b = readDict(id);
  Object.assign(gtexData.exact, b.exact || {});
  gtexData.rules = gtexData.rules.concat(b.rules || []);
  gtexData.templates = gtexData.templates.concat(b.templates || []);
}

function boot(html, { url = "https://gtexportal.org/home/gene/ENSG00000141510" } = {}) {
  const dom = new JSDOM("<body><main>" + html + "</main></body>", { url });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data: gtexData, site: gtexSite });
  engine.start();
  return { doc: dom.window.document, engine };
}
const plain = (el) => el.textContent.replace(/\s+/g, " ").trim();

const book = readDict("gtex-home");

// 线上文本节点原文：<b>标准化效应量（NES）</b> 后面紧跟以冒号开头的整句说明。
const NES_TOOLTIP =
  ":The slope of the linear regression of normalized expression data versus the three genotype categories using single-tissue eQTL analysis, representing eQTL effect size. The normalized expression values are based on quantile normalization within each tissue, followed by inverse quantile normalization for each gene across samples.";
const M_TOOLTIP =
  ":The posterior probability that an eQTL effect exists in each tissue tested in the cross-tissue meta-analysis. The m-value ranges between 0 and 1 (Han and Eskin, PLoS Genetics 8(3): e1002555, 2012).";
const T_TOOLTIP =
  ":From a t-test that compares observed beta from single-tissue eQTL analysis to a null beta of 0.";

test("gene 页三条 eQTL 表头 tooltip 整句翻译", () => {
  const { doc } = boot(
    "<div><b>Normalized Effect Size (NES)</b>" + NES_TOOLTIP + "</div>" +
    "<div><b>m-value</b>" + M_TOOLTIP + "</div>" +
    "<div><b>P-Value</b>" + T_TOOLTIP + "</div>"
  );
  const t = plain(doc.body);
  assert.match(t, /线性回归所得的斜率/);
  assert.match(t, /后验概率/);
  assert.match(t, /t 检验/);
  assert.doesNotMatch(t, /The slope of the linear regression/);
  assert.doesNotMatch(t, /The posterior probability/);
  assert.doesNotMatch(t, /From a t-test that compares/);
});

test("gene 页单细胞轴标签与细胞类型大写枚举", () => {
  const { doc } = boot(
    "<svg><text>ln(counts per 10k + 1)</text></svg>" +
    "<svg><text>ADIPOCYTE</text><text>FIBROBLAST</text><text>MELANOCYTE</text><text>UNKNOWN</text></svg>"
  );
  const t = plain(doc.body);
  assert.match(t, /ln（每万计数 \+ 1）/);
  assert.match(t, /脂肪细胞/);
  assert.match(t, /成纤维细胞/);
  assert.match(t, /黑素细胞/);
  assert.match(t, /未知/);
});

test("eQTL 仪表盘结果图：pvalue 标签与归一化表达轴", () => {
  const { doc } = boot(
    "<svg><text class=\"violin-group-label\">pvalue: 7.88e-1</text><text>Norm. Expression</text></svg>"
  );
  const t = plain(doc.body);
  assert.match(t, /P 值：7\.88e-1/);
  assert.match(t, /标准化表达量/);
  assert.doesNotMatch(t, /pvalue:/);
});

test("基因页 Entrez 链接与 dGTEx 数据来源行", () => {
  const { doc } = boot(
    "<a>Entrez Gene</a><div>Data Source: dGTEx v1</div>"
  );
  const t = plain(doc.body);
  assert.match(t, /Entrez 基因/);
  assert.match(t, /数据来源：dGTEx v1/);
});

test("标识与纯数据保持原样（基因/登录号/变异/基因型/样本数/UBERON）", () => {
  const { doc } = boot(
    "<div>TP53</div><div>ENSG00000141510.19</div><div>rs35850753</div>" +
    "<div>chr17_8580874_A_C_b38</div><div>UBERON:0001114</div>" +
    "<svg><text>CC</text><text>CT</text><text>TT</text><text>(248)</text></svg>"
  );
  const t = plain(doc.body);
  for (const s of ["TP53", "ENSG00000141510.19", "rs35850753", "chr17_8580874_A_C_b38", "UBERON:0001114", "(248)"]) {
    assert.ok(t.includes(s), s + " 不应被翻译");
  }
  assert.doesNotMatch(t, /[\u4e00-\u9fff]/);
});

test("r26 新增 exact 值不超过 60 字符，新规则首尾锚定", () => {
  const added = [
    "Entrez Gene",
    "ln(counts per 10k + 1)",
    "ADIPOCYTE",
    "FIBROBLAST",
    "MELANOCYTE",
    "UNKNOWN",
    "Norm. Expression",
    "Data Source: dGTEx v1"
  ];
  for (const k of added) {
    const v = book.exact[k];
    assert.ok(typeof v === "string" && v.trim(), "词条缺失或值为空: " + k);
    assert.ok(v.length <= 60, "词条值过长（应改用 rules）: " + k);
  }
  const newRules = (book.rules || []).slice(-4);
  for (const r of newRules) {
    assert.ok(/^\^/.test(r.re) && /\$$/.test(r.re), "规则未锚定: " + r.re);
    assert.ok(/[\u4e00-\u9fff]/.test(r.to), "规则译文不含中文: " + r.re.slice(0, 40));
    assert.doesNotThrow(() => new RegExp(r.re), "规则无法编译: " + r.re);
  }
});
