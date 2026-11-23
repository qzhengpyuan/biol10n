// Rfam 站点（r27）遗留界面文案回归：
// 首页检索框/图表无障碍属性、家族页 R-scape 图例与统计、检索页 facet 与浏览行、模板通道
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, "../dict", f), "utf8"));

const dict = read("rfam.json");
const SITE = { scope: "body", block: "pre, code", rescan: false };

function siteData() {
  const books = ["common.json", "rfam.json"];
  const exact = {}, rules = [], templates = [];
  for (const f of books) {
    if (!fs.existsSync(path.join(root, "../dict", f))) continue;
    const d = read(f);
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
    templates.push(...(d.templates || []));
  }
  return { exact, rules, templates };
}

function boot(html, url) {
  const dom = new JSDOM(html, { url: url || "https://rfam.org/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: siteData(),
    site: SITE
  });
  engine.start();
  return { dom, engine, doc: dom.window.document };
}

test("r27 词库：Rfam 新增 exact 条目齐备", () => {
  assert.ok(Object.keys(dict.exact).length >= 363, "exact 条目不足: " + Object.keys(dict.exact).length);
  assert.ok((dict.rules || []).length >= 36, "规则不足: " + (dict.rules || []).length);
  assert.ok((dict.templates || []).length >= 31, "模板不足: " + (dict.templates || []).length);
  const cases = {
    "Family name, accession, species, author…": "家族名、登录号、物种、作者……",
    "Rfam logo": "Rfam 标志",
    "Graph of Rfam families growth over time": "Rfam 家族数量随时间的变化图",
    "Cis-reg": "顺式调控",
    "snoRNAs": "小核仁 RNA",
    "What files are available in the Rfam FTP site?": "Rfam FTP 站点提供哪些文件？",
    "Can you list the fields that can be retrieved using the Rfam text search API?": "Rfam 文本检索 API 可以取回哪些字段？",
    "Using the Rfam MySQL database, I want to retrieve all rat sequence coordinates annotated with Rfam families.": "我想用 Rfam MySQL 数据库检索所有注释到 Rfam 家族的大鼠序列坐标。",
    "How can I get information about the family RF00360 using the Rfam API?": "如何通过 Rfam API 获取 RF00360 家族的信息？",
    "Visualisation Type:": "可视化类型：",
    "Download Image": "下载图片",
    "Download current image": "下载当前图片",
    "Current Rfam structure": "当前 Rfam 结构",
    "R-scape optimised structure": "R-scape 优化结构",
    "Legend": "图例",
    "Colours": "颜色",
    "Nucleotides": "核苷酸",
    "Statistically significant basepair with covariation": "有共变支持的统计显著碱基对",
    "interactive": "交互式",
    "pan": "平移",
    "zoom": "缩放",
    "hover": "悬停",
    "bits": "比特",
    "Viroids": "类病毒",
    ": A or G": "：A 或 G",
    ": C or U": "：C 或 U"
  };
  const { engine } = boot("<body></body>");
  for (const [en, zh] of Object.entries(cases)) {
    assert.equal(engine.translateText(en), zh, "未命中: " + en);
  }
});

test("r27 规则：检索页标题、R-scape 图片说明与 facet 计数", () => {
  const { engine } = boot("<body></body>");
  assert.equal(engine.translateText("Search: RNase P"), "检索：RNase P");
  assert.equal(engine.translateText("R-scape structure for RF00162"), "RF00162 的 R-scape 结构");
  assert.equal(engine.translateText("ribozyme (24)"), "核酶（24）");
  assert.equal(engine.translateText("97% conserved nucleotide"), "97% 保守核苷酸");
  assert.equal(engine.translateText(", or"), "，或");
  assert.equal(engine.translateText("Powered by"), "技术支持：");
  assert.equal(engine.translateText("CIS-REG"), null, "全大写常量不该被小写兜底误伤");
});

test("r27 jsdom：首页检索框占位符、logo 与图表 aria-label", () => {
  const { doc } = boot(
    '<body><img src="/static/images/rfam_logo.svg" alt="Rfam logo">' +
      '<form action="/search"><input type="search" name="q" placeholder="Family name, accession, species, author…"></form>' +
      '<canvas id="rfam-growth-chart" aria-label="Graph of Rfam families growth over time"></canvas>' +
      "</body>"
  );
  assert.equal(doc.querySelector("img").getAttribute("alt"), "Rfam 标志");
  assert.equal(
    doc.querySelector("input").getAttribute("placeholder"),
    "家族名、登录号、物种、作者……"
  );
  assert.equal(
    doc.querySelector("canvas").getAttribute("aria-label"),
    "Rfam 家族数量随时间的变化图"
  );
});

test("r27 jsdom：家族页 R-scape 图例与显著碱基对统计", () => {
  const { doc } = boot(
    '<body><div class="ss-legend ss-rscape-legend">' +
      "<h4>Legend</h4>" +
      "<ul><li class=\"legend-label\">Colours</li>" +
      "<li><span class=\"legend-color significant-basepair\"></span>Statistically significant basepair with covariation</li>" +
      "<li><span class=\"legend-color conserved-97\"></span>97% conserved nucleotide</li>" +
      "<li class=\"legend-label\">Nucleotides</li>" +
      "<li><strong>R</strong>: A or G</li>" +
      "<li><strong>Y</strong>: C or U</li></ul>" +
      '<p class="ss-legend-tip"><strong>Tip</strong> The diagrams are <strong>interactive</strong> ' +
      "- you can <strong>pan</strong> and <strong>zoom</strong> to see more details or <strong>hover</strong> " +
      "over nucleotides and basepairs.</p>" +
      "</div>" +
      '<p class="ss-rscape-stats-inline"><strong>22</strong> out of <strong>34</strong> ' +
      "basepairs are significant at E-value=0.05</p>" +
      '<h3>Current Rfam structure</h3><h3>R-scape optimised structure</h3>' +
      '<label for="image-type-select">Visualisation Type:</label>' +
      '<button title="Download current image">Download Image</button>' +
      "</body>",
    "https://rfam.org/family/RF00001"
  );
  assert.equal(doc.querySelector("h4").textContent, "图例");
  const lis = [...doc.querySelectorAll("li")].map((li) => li.textContent);
  assert.deepEqual(lis, [
    "颜色",
    "有共变支持的统计显著碱基对",
    "97% 保守核苷酸",
    "核苷酸",
    "R：A 或 G",
    "Y：C 或 U"
  ]);
  assert.equal(
    doc.querySelector(".ss-legend-tip").textContent.replace(/\s+/g, ""),
    "提示这些图是交互式的——可以平移和缩放查看更多细节，或将鼠标悬停在核苷酸和碱基对上。"
  );
  assert.equal(
    doc.querySelector(".ss-rscape-stats-inline").textContent.replace(/\s+/g, " ").trim(),
    "34 个碱基对中有 22 个在 E 值 = 0.05 时显著"
  );
  const h3 = [...doc.querySelectorAll("h3")].map((h) => h.textContent);
  assert.deepEqual(h3, ["当前 Rfam 结构", "R-scape 优化结构"]);
  assert.equal(doc.querySelector("label").textContent, "可视化类型：");
  assert.equal(doc.querySelector("button").textContent, "下载图片");
  assert.equal(doc.querySelector("button").getAttribute("title"), "下载当前图片");
});

test("r27 jsdom：检索页浏览行、facet 计数与 EBI Search 署名", () => {
  const { doc } = boot(
    '<body><p class="rfam-search-browse">Browse: <a href="/a">Families</a>, <a href="/b">Clans</a>, ' +
      'or <a href="/c">Families with 3D structures</a></p>' +
      '<label class="rfam-facet__label"><input type="checkbox"> ribozyme (24)</label>' +
      '<p class="rfam-facet__powered-by">Powered by <a href="https://www.ebi.ac.uk">EBI Search</a></p>' +
      '<p class="vf-text"> See the <a class="vf-link" href="/help">sequence search documentation</a> ' +
      "for help getting started. </p>" +
      "</body>",
    "https://rfam.org/search?q=RNase+P"
  );
  assert.equal(
    doc.querySelector(".rfam-search-browse").textContent.replace(/\s+/g, " ").trim(),
    "浏览：家族，家族簇，或具有三维结构的家族"
  );
  assert.equal(doc.querySelector(".rfam-facet__label").textContent.trim(), "核酶（24）");
  assert.match(
    doc.querySelector(".rfam-facet__powered-by").textContent.replace(/\s+/g, " ").trim(),
    /^技术支持： ?EBI Search$/
  );
  const lastP = [...doc.querySelectorAll("p")].pop();
  assert.equal(lastP.textContent.replace(/\s+/g, " ").trim(), "入门帮助请参阅序列检索文档。");
  assert.equal(lastP.querySelector("a").getAttribute("href"), "/help");
});

test("r27 jsdom：R-scape 长说明段整段替换", () => {
  const text =
    "R-scape is a method for evaluating covariation in multiple sequence alignments while accounting for " +
    "phylogenetic context. It aims to infer the secondary structure with the highest number of statistically " +
    "supported covarying base pairs. This page shows the R-scape analysis of two structures: the secondary " +
    "structure from the Rfam SEED alignment, and a new, R-scape-optimised structure with covariation. The " +
    "latter can be especially valuable for RNA families with predicted secondary structures or limited " +
    "experimental structural support.";
  const { doc } = boot('<body><p class="rfam-rscape-intro">' + text + "</p></body>", "https://rfam.org/family/RF00001");
  const out = doc.querySelector("p").textContent;
  assert.ok(out.startsWith("R-scape 是一种评估多序列比对中共变的方法"), "未整段替换: " + out.slice(0, 40));
  assert.ok(out.includes("统计支持共变碱基对数量最多的二级结构"));
});
