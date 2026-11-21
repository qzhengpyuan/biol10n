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
