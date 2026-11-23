// r26 ClinVar 页头/检索表单属性与 404 标题规则回归：
//   1. dict/clinvar-core.json 的 6 条属性文案（aria-label / title），词条与引擎落地都要测
//   2. 404 标题规则只命中错误页整串，不能误伤真实记录的标题
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const core = JSON.parse(fs.readFileSync(path.join(root, "../dict/clinvar-core.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "ncbi-clinvar");
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;

/** 起一个最小 DOM 并跑一遍引擎，返回 document */
function run(html) {
  const dom = new JSDOM(html);
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: core.exact, rules: core.rules },
    site
  });
  engine.start();
  return dom.window.document;
}

const WANT = {
  "Show menu": "显示菜单",
  "Close navigation menu": "关闭导航菜单",
  "Scroll to the top of this page": "回到本页顶部",
  "hide search form": "隐藏检索表单",
  "show search form": "显示检索表单",
  "close search form": "关闭检索表单"
};

test("词库：ClinVar 页头与检索表单 6 条属性文案齐全、值为中文", () => {
  for (const [k, v] of Object.entries(WANT)) {
    assert.equal(core.exact[k], v, "词条缺失或被改动: " + k);
    assert.ok(CJK.test(v), "译文要有汉字: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(v, v.trim(), "值首尾不能有空白: " + k);
  }
});

test("属性通道：变异页页头按钮 aria-label 与表单 title 落地", () => {
  const doc = run(
    '<button type="button" class="usa-menu-btn" aria-label="Show menu" data-testid="navMenuButton"></button>' +
      '<button type="button" class="usa-nav__close" aria-label="Close navigation menu" data-testid="navCloseButton"></button>' +
      '<span class="title"><a title="Scroll to the top of this page" href="#">本页内容</a></span>' +
      '<span class="header-buttons">' +
      '<a class="show-form show-hide" title="hide search form"><i class="fa fa-angle-down"></i></a>' +
      '<a class="hide-form show-hide" title="show search form"><i class="fa fa-angle-up"></i></a>' +
      '<a class="close-popup" title="close search form"><i class="fa-solid fa-x"></i></a>' +
      "</span>"
  );
  const buttonLabels = [...doc.querySelectorAll("button")].map((el) => el.getAttribute("aria-label"));
  assert.deepEqual(buttonLabels, ["显示菜单", "关闭导航菜单"]);
  const titles = [...doc.querySelectorAll("a[title]")].map((el) => el.getAttribute("title"));
  assert.deepEqual(titles, ["回到本页顶部", "隐藏检索表单", "显示检索表单", "关闭检索表单"]);
  // 已有译法的锚文本不能被属性通道带歪
  assert.equal(doc.querySelector("a[title]").textContent, "本页内容");
});

test("404 标题规则只命中错误页整串", () => {
  const rule = core.rules.find((r) => r.re === "^404 Not Found\\s+-\\s+-\\s+ClinVar\\s+-\\s+NCBI$");
  assert.ok(rule, "404 标题规则应保留");
  const re = new RegExp(rule.re);
  // 错误页整串（NCBI 的实际形态是「404 Not Found - - ClinVar - NCBI」）
  assert.match("404 Not Found  - - ClinVar - NCBI", re);
  assert.match("404 Not Found - - ClinVar - NCBI", re);
  // 真实记录的标题不含 404，不能被改成「404 未找到」
  assert.doesNotMatch("VCV000044287.64 - ClinVar - NCBI", re);
  assert.doesNotMatch("NM_000546.6(TP53):c.215C>G (p.Pro72Arg) - ClinVar - NCBI", re);
  // 正文里出现的 404 字样也不能整句命中
  assert.doesNotMatch("Error 404 Not Found - - ClinVar - NCBI (see above)", re);
  assert.doesNotMatch("404 Not Found", re);
});

test("真实记录标题经引擎后保持原样", () => {
  const doc = run('<h1 class="title">VCV000044287.64 - ClinVar - NCBI</h1>');
  assert.equal(doc.querySelector("h1").textContent, "VCV000044287.64 - ClinVar - NCBI");
  const doc404 = run('<h1 class="title">404 Not Found  - - ClinVar - NCBI</h1>');
  assert.equal(doc404.querySelector("h1").textContent, "404 未找到 - ClinVar - NCBI");
});
// ---------- gene：Linked Discoveries™ 区块标题 ----------
const geneDict = JSON.parse(fs.readFileSync(path.join(root, "../dict/gene.json"), "utf8"));
const commonDict = JSON.parse(fs.readFileSync(path.join(root, "../dict/common.json"), "utf8"));
const ncbiDict = JSON.parse(fs.readFileSync(path.join(root, "../dict/ncbi.json"), "utf8"));
const gene2Dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/gene2.json"), "utf8"));
const footerDict = JSON.parse(fs.readFileSync(path.join(root, "../dict/ncbi-footer.json"), "utf8"));

function bootGene(html) {
  const dom = new JSDOM(html, { url: "https://www.ncbi.nlm.nih.gov/gene/7157" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: {
      exact: { ...commonDict.exact, ...ncbiDict.exact, ...geneDict.exact, ...gene2Dict.exact, ...footerDict.exact },
      rules: [
        ...(commonDict.rules || []),
        ...(ncbiDict.rules || []),
        ...(geneDict.rules || []),
        ...(gene2Dict.rules || []),
        ...(footerDict.rules || [])
      ],
      templates: []
    },
    site: sites.find((s) => s.id === "ncbi-gene")
  });
  engine.start();
  return dom.window.document;
}

test("gene：Linked Discoveries™ 与纯文本标题都译成「关联发现」", () => {
  assert.equal(geneDict.exact["Linked Discoveries™"], "关联发现™", "gene 册要补带 ™ 的真实串");
  assert.ok(CJK.test(geneDict.exact["Linked Discoveries™"]));
  const doc = bootGene(
    '<h4 class="title">Linked Discoveries™</h4>' +
      '<h4 class="title">Linked Discoveries</h4>' +
      '<a title="Explore related research with NLM Linked Discoveries">x</a>'
  );
  const h = [...doc.querySelectorAll("h4")].map((e) => e.textContent);
  assert.deepEqual(h, ["关联发现™", "关联发现"]);
  assert.equal(doc.querySelector("a").getAttribute("title"), "借助 NLM Linked Discoveries 探索相关研究");
});

// ---------- PubMed 帮助页：PMCID 标签 ----------
const helpDict = JSON.parse(fs.readFileSync(path.join(root, "../dict/ncbi-help.json"), "utf8"));

function bootHelp(html) {
  const dom = new JSDOM(html, { url: "https://pubmed.ncbi.nlm.nih.gov/help/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: {
      exact: { ...commonDict.exact, ...ncbiDict.exact, ...helpDict.exact },
      rules: [...(commonDict.rules || []), ...(ncbiDict.rules || []), ...(helpDict.rules || [])],
      templates: []
    },
    site: sites.find((s) => s.id === "pubmed-help")
  });
  engine.start();
  return dom.window.document;
}

test("ncbi-help：参考文献列表里的 PMCID 编号规则落地，编号本身不动", () => {
  const rule = helpDict.rules.find((r) => r.re.startsWith("^PMCID: ") && r.re.endsWith("$"));
  assert.ok(rule, "PMCID 编号规则应保留");
  assert.equal(rule.to, "PMCID：$1");
  const doc = bootHelp(
    '<ul><li>Smith J. A paper title. J Test. 2020. <a href="#">PMCID: PMC3168323</a></li></ul>'
  );
  assert.equal(doc.querySelector("a").textContent, "PMCID：PMC3168323");
});

test("ncbi-help：附录里的专名/字段标签保持英文（不被误翻）", () => {
  const doc = bootHelp('<h4 id="coverage-medline">MEDLINE</h4><h4 id="isbn">ISBN [isbn]</h4><h4 id="pmid">PMID [pmid]</h4>');
  const h = [...doc.querySelectorAll("h4")].map((e) => e.textContent);
  assert.deepEqual(h, ["MEDLINE", "ISBN [isbn]", "PMID [pmid]"]);
});
