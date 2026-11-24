// 主角（lead）本轮的补充：分类学页的物种介绍句（5 个文本节点、无内联元素）。
// 原文取自 2026-11-24 CDP 实测（__BIOL10N.disable() 后）：H6 直接子节点是
// ["Human (", "Homo sapiens", ") is a species of primate in the family ", "Hominidae", " (great apes)."]
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const taxonomy = read("../dict/taxonomy.json");
const common = read("../dict/common.json");

const SENT =
  "Human (Homo sapiens) is a species of primate in the family Hominidae (great apes).";

test("taxonomy：物种介绍句整句替换（5 个文本节点拼平后命中 exact）", () => {
  const html =
    '<body><h6 id="t">Human (Homo sapiens) is a species of primate in the family Hominidae (great apes).</h6></body>';
  const dom = new JSDOM(html, { url: "https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=9606" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: {
      exact: Object.assign({}, common.exact, taxonomy.exact),
      rules: [...(common.rules || []), ...(taxonomy.rules || [])],
      templates: [...(common.templates || []), ...(taxonomy.templates || [])]
    },
    site: { scope: "body", funcWords: true }
  });
  engine.start();
  assert.equal(
    dom.window.document.getElementById("t").textContent,
    "人（Homo sapiens）是灵长类中人科（大型猿类）的物种。"
  );
});

test("taxonomy：地位不改 —— 拉丁学名与作者年份仍原样", () => {
  assert.equal(taxonomy.exact["Homo sapiens"], undefined, "拉丁学名不该进词表");
  assert.equal(taxonomy.exact["Linnaeus, 1758"], undefined, "命名人与年份不该进词表");
  assert.ok(taxonomy.exact[SENT], "缺物种介绍句");
});

test("books：章内小节标题（Scope/Dataflow/Data Model/Related Tools …）已补译，且不动 TOC 跳过规则", () => {
  const books = read("../dict/books.json");
  const want = {
    "Scope": "范围",
    "Dataflow": "数据流程",
    "Data Model": "数据模型",
    "Data Sources": "数据来源",
    "Related Tools": "相关工具",
    "Clustering Methods": "聚类方法",
    "Manual Curation": "人工校订",
    "Cluster Display": "聚类展示"
  };
  for (const [k, v] of Object.entries(want)) {
    assert.equal(books.exact[k], v, "缺译或译错: " + k);
  }
  // 目录链接仍由 config 的 skip 放掉：词表里有键不等于会去翻 TOC
  const site = read("../config/sites.json").sites.find((s) => s.id === "ncbi-books");
  assert.ok(site, "缺 ncbi-books 站点");
  assert.match(site.skip, /ul\.toc a\.toc-item/, "TOC 跳过规则丢了");
  // 拉丁学名/命名人不得进词表（分类学口径）
  assert.equal(books.exact["Homo sapiens"], undefined);
});

