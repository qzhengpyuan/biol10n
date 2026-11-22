import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();

function boot(html, title, { exact = {}, rules = [], site = {} } = {}) {
  const dom = new JSDOM(html, { url: "https://example.org/" });
  dom.window.document.title = title;
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact, rules },
    site: { scope: "", block: "pre, code", attrs: [], rescan: [], ...site }
  });
  engine.start();
  return { engine, doc: dom.window.document };
}

// 回归：标题只翻了一半被 titleAcceptable 拒掉时，不能留下 titleRule / titleHit 的假计数
// （GEO 数据集页曾报 titleRule:8 但标题全英文）。
test("标题被拒绝时不留下 titleRule 计数", () => {
  const rules = [{ re: "^(.+) - (.+) - (.+)$", to: "$1 - $2 - $3", requireHit: true }];
  const { engine, doc } = boot("<p>hi</p>", "breast cancer - GEO DataSets - NCBI", {
    exact: { "breast cancer": "乳腺癌" },
    rules
  });
  assert.equal(doc.title, "breast cancer - GEO DataSets - NCBI");
  assert.equal(engine.stats.titleRule, undefined);
  assert.equal(engine.stats.titleHit, undefined);
});

// 命中标题必须记账，否则覆盖统计看不见标题翻译。
test("标题整条命中时记 titleHit", () => {
  const { engine, doc } = boot("<p>hi</p>", "GTEx Portal", {
    exact: { "GTEx Portal": "GTEx 门户" }
  });
  assert.equal(doc.title, "GTEx 门户");
  assert.equal(engine.stats.titleHit, 1);
});
// 目录站标题：品牌名（dbVar / MeSH / MedGen / ORFfinder）在 TITLE_BRANDS 里才放行，
// 否则 titleAcceptable 会把「首页 - dbVar - NCBI」整条丢掉。
test("目录站标题的分段品牌名放行", () => {
  const { doc } = boot("<p>hi</p>", "Home - dbVar - NCBI", { exact: { Home: "首页" } });
  assert.equal(doc.title, "首页 - dbVar - NCBI");
});

test("MeSH / ORFfinder / MedGen 标题同样放行", () => {
  const a = boot("<p>hi</p>", "Home - MeSH - NCBI", { exact: { Home: "首页" } });
  assert.equal(a.doc.title, "首页 - MeSH - NCBI");
  const b = boot("<p>hi</p>", "ORFfinder Home - NCBI", { exact: { "ORFfinder Home": "ORFfinder 首页" } });
  assert.equal(b.doc.title, "ORFfinder 首页 - NCBI");
  const c = boot("<p>hi</p>", "Medgen web - NCBI", { exact: { "Medgen web": "MedGen 网页" } });
  assert.equal(c.doc.title, "MedGen 网页 - NCBI");
});

// r21：非 NCBI 新站的标题品牌不在白名单，整条标题被丢弃（Europe PMC / InterPro / Reactome / PRIDE / Expasy）。
test("非 NCBI 新站品牌与保留分段都放行", () => {
  const { engine, doc } = boot("<p>hi</p>", "Home - Europe PMC", { exact: { Home: "首页" } });
  assert.match(doc.title, /首页/);
  assert.match(doc.title, /Europe PMC/);
});

test("保留分段不含品牌名时仍然拒绝半截标题", () => {
  const { engine, doc } = boot("<p>hi</p>", "breast cancer - GEO 数据集 - NCBI", { exact: {} });
  assert.equal(doc.title, "breast cancer - GEO 数据集 - NCBI");
});

test("< 作为标题分隔符（Plant experiments < Expression Atlas < EMBL-EBI）", () => {
  const { engine, doc } = boot("<p>hi</p>", "Plant experiments < Expression Atlas < EMBL-EBI", { exact: { "Plant experiments": "植物实验" } });
  assert.match(doc.title, /植物实验/);
});

// r21：功能词不能做大小写折叠，否则正文里的 from/and 会被标签词 From/AND 吃掉。
test("功能词不做大小写折叠（from 不匹配 From）", () => {
  const { doc } = boot("<p>from</p><p>From</p>", "t", { exact: { From: "从" } });
  const ps = doc.querySelectorAll("p");
  assert.equal(ps[0].textContent, "from", "小写正文词不该被折叠命中");
  assert.equal(ps[1].textContent, "从", "同形大写标签仍翻");
});

// r21 后续：整条标题被规则命中时，槽位里剩下的英文是数据（检索词、基因名），不整条退回。
test("规则命中的标题保留槽位英文", () => {
  const rules = [{ re: "^Search ClinicalTrials\\.gov for: (.+) \\| Card Results \\| ClinicalTrials\\.gov$", to: "检索 ClinicalTrials.gov：$1 | 卡片结果 | ClinicalTrials.gov" }];
  const { doc } = boot("<p>hi</p>", "Search ClinicalTrials.gov for: cancer | Card Results | ClinicalTrials.gov", { exact: {}, rules });
  assert.equal(doc.title, "检索 ClinicalTrials.gov：cancer | 卡片结果 | ClinicalTrials.gov");
});
