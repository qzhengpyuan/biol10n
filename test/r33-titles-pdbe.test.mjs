// r33：三处站点标题 + PDBe 全局页头页脚
// ① BioStudies 收藏集页标题 "Collections < BioStudies < EMBL-EBI"
// ② Europe PMC 文章页标题尾段 " - Abstract - Europe PMC"
// ③ PDBe 全局页头的 Skip to main content 与页脚 Research: / Services: / Training
// 线上原文（CDP 9227 实测，2026-11-24）：
//   https://www.ebi.ac.uk/biostudies/collections → Collections < BioStudies < EMBL-EBI
//   https://europepmc.org/article/MED/34887591 → The power of genetic diversity in genome-wide
//     association studies of lipids. - Abstract - Europe PMC
//   https://www.ebi.ac.uk/pdbe/documentation → a.visually-hidden "Skip to main content"、
//     h5 "Research:" / "Services:" / "Training"（Training 原文无冒号）
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;

const books = {};
for (const id of ["common", "string-atlas", "string-atlas2", "biostudies", "europepmc", "pdbe"]) {
  books[id] = JSON.parse(fs.readFileSync(path.join(root, "../dict", id + ".json"), "utf8"));
}

/** 按 config/sites.json 的 dicts 顺序拼词库栈（与线上注入顺序一致）。 */
function stackData(siteId, fallback) {
  const site = sites.find((s) => s.id === siteId) || { dicts: fallback };
  const data = { exact: {}, rules: [], templates: [] };
  for (const id of site.dicts) {
    const b = books[id];
    if (!b) continue;
    Object.assign(data.exact, b.exact || {});
    data.rules = data.rules.concat(b.rules || []);
    data.templates = data.templates.concat(b.templates || []);
  }
  return data;
}

const SITE = {
  biostudies: { id: "biostudies", hosts: ["www.ebi.ac.uk"], path: "^/biostudies", scope: "body" },
  europepmc: { id: "europepmc", hosts: ["europepmc.org"], scope: "body" },
  pdbe: { id: "pdbe", hosts: ["www.ebi.ac.uk"], path: "^/pdbe", scope: "body" }
};

/** 起引擎：title 是 <title> 原文（线上实测值），html 是正文片段。 */
function boot(siteId, fallbackDicts, title, html) {
  const dom = new JSDOM(html || "<body><p>placeholder</p></body>", {
    url: "https://" + SITE[siteId].hosts[0] + "/"
  });
  dom.window.document.title = title;
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: stackData(siteId, fallbackDicts),
    site: SITE[siteId]
  });
  engine.start();
  return { doc: dom.window.document, engine, title: dom.window.document.title };
}

const BS_TITLE = "Collections < BioStudies < EMBL-EBI";
const EPMC_TITLE =
  "The power of genetic diversity in genome-wide association studies of lipids. - Abstract - Europe PMC";
const PDBE_TITLE =
  "PDB 1cbs: CRYSTAL STRUCTURE OF CELLULAR RETINOIC-ACID-BINDING PROTEINS I AND II IN COMPLEX WITH ALL-TRANS-RETINOIC ACID AND A SYNTHETIC RETINOID | Protein Data Bank in Europe - PDBe";

test("词库结构：三条新增条目都在、形态正确", () => {
  const bsRule = books.biostudies.rules.find((r) => r.re === "^Collections( < BioStudies < EMBL-EBI)$");
  assert.ok(bsRule, "biostudies 缺收藏集页标题规则");
  assert.equal(bsRule.to, "收藏集$1", "面包屑尾巴用 $1 原样带出");
  assert.equal(BS_TITLE.replace(/^Collections/, "收藏集"), "收藏集 < BioStudies < EMBL-EBI");

  const epRule = books.europepmc.rules.find((r) => r.re === "^(.+) - Abstract - Europe PMC$");
  assert.ok(epRule, "europepmc 缺文章页 Abstract 尾段规则");
  assert.equal(epRule.to, "$1 - 摘要 - Europe PMC");
  assert.ok(new RegExp(epRule.re).test(EPMC_TITLE), "规则要能匹配线上标题");

  // PDBe 三处导航词：值与 string-atlas（同一条 EMBL-EBI 全局页头页脚）一致
  const sa = books["string-atlas"].exact;
  assert.equal(books.pdbe.exact["Research:"], sa["Research:"]);
  assert.equal(books.pdbe.exact["Services:"], sa["Services:"]);
  assert.equal(books.pdbe.exact["Training"], sa["Training"]);
  assert.equal(books.pdbe.exact["Skip to main content"], "跳到主要内容");

  for (const id of ["biostudies", "europepmc", "pdbe"]) {
    for (const [k, v] of Object.entries(books[id].exact)) {
      assert.notEqual(k, v, id + " 自映射: " + k);
      // 值可以全拉丁（BibTex（Mendeley…）、Pfam 这类名字），但不能为空
      assert.ok(typeof v === "string" && v.trim(), id + " 译文为空: " + k);
    }
    for (const r of books[id].rules) {
      assert.ok(/^\^/.test(r.re) && /\$$/.test(r.re), id + " 规则未锚定: " + r.re);
      assert.ok(/[\u4e00-\u9fff]/.test(r.to), id + " 规则缺中文: " + r.re);
      if (r.re.includes("(.+)")) assert.ok(/\$1/.test(r.to), id + " 规则丢了捕获组: " + r.re);
    }
  }
});

test("BioStudies 收藏集页：标题按分段翻成「收藏集 < BioStudies < EMBL-EBI」", () => {
  const { doc, engine, title } = boot(
    "biostudies",
    ["common", "string-atlas", "string-atlas2", "biostudies"],
    BS_TITLE,
    "<body><h1>Collections</h1><p>BioStudies is a recommended ELIXIR Deposition Database</p></body>"
  );
  assert.equal(title, "收藏集 < BioStudies < EMBL-EBI");
  // 引擎把 BioStudies 收进 TITLE_BRANDS 后，这条标题走分段（Collections 直译 + 品牌保留），
  // 不再需要 biostudies 册那条整条规则；同一机制顺带覆盖 Studies / Error 等同族标题。
  assert.equal(engine.stats.titleHit, 1, "标题要记成直译命中（否则覆盖统计看不见）");
  // 品牌名保留，不收进译文
  assert.ok(title.includes("BioStudies"));
  assert.ok(title.includes("EMBL-EBI"));
  // 同页正文的 Collections 仍走 exact
  assert.equal(doc.querySelector("h1").textContent, "收藏集");
});

test("BioStudies 首页标题（只有品牌名）保持原样", () => {
  const { title } = boot("biostudies", ["common", "string-atlas", "string-atlas2", "biostudies"], "BioStudies < EMBL-EBI");
  assert.equal(title, "BioStudies < EMBL-EBI", "没有可翻分段时不该动标题");
});

test("Europe PMC 文章页：题录保留英文，只翻 Abstract 尾段", () => {
  const { engine, title } = boot(
    "europepmc",
    ["common", "europepmc"],
    EPMC_TITLE,
    "<body><h1>The power of genetic diversity in genome-wide association studies of lipids.</h1><h3>Abstract</h3></body>"
  );
  assert.equal(
    title,
    "The power of genetic diversity in genome-wide association studies of lipids. - 摘要 - Europe PMC"
  );
  // 题录部分逐字保留（口径：标题、作者、期刊、日期、ID 不翻）
  assert.ok(title.startsWith("The power of genetic diversity in genome-wide association studies of lipids."));
  assert.ok(!/Abstract/.test(title), "尾段应已翻成中文");
  assert.equal(engine.stats.titleRule, 1);
});

test("Europe PMC 检索结果页标题规则不被新规则挤掉", () => {
  const { title } = boot("europepmc", ["common", "europepmc"], "p53 - Search results - Europe PMC");
  assert.equal(title, "p53 - 检索结果 - Europe PMC");
});

test("PDBe 全局页头页脚：Skip to main content 与 Research: / Services: / Training", () => {
  const html =
    "<body>" +
    '<a class="visually-hidden focusable skip-link" href="#main">Skip to main content</a>' +
    "<footer><h5 class=\"inline underline\">Research:</h5>" +
    "<h5 class=\"inline underline\">Services:</h5>" +
    "<h5 class=\"inline underline\">Training</h5></footer>" +
    "</body>";
  const { doc } = boot("pdbe", ["common", "string-atlas", "pdbe"], "Documentation | Protein Data Bank in Europe", html);
  assert.equal(doc.querySelector("a").textContent, "跳到主要内容");
  const h5 = [...doc.querySelectorAll("h5")].map((x) => x.textContent.trim());
  assert.deepEqual(h5, ["研究：", "服务：", "培训"]);
});

test("PDBe 条目标题规则仍然生效（品牌换成中文，PDB 条目名与全大写标题保留）", () => {
  const { engine, title } = boot("pdbe", ["common", "string-atlas", "pdbe"], PDBE_TITLE);
  assert.ok(title.includes("| 欧洲蛋白质数据库 - PDBe"), "标题尾部落款要翻: " + title);
  assert.ok(title.startsWith("PDB 1cbs：CRYSTAL STRUCTURE OF CELLULAR RETINOIC-ACID-BINDING PROTEINS"), "条目标题保留");
  assert.equal(engine.stats.titleRule, 1);
});
