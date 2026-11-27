// 第五批站级不翻名单（0.17.3）：KEGG 的通路列表整块 skip（通路名是内容，名单治不了），
// Europe PMC 的题录/作者/卷期/资助编号/PMID/DOI 形状进 missNoise；品牌与库名一律整串锚定。
// 判据同前几批：被滤掉的必须是数据（题录、标识符、机构名），不是界面词。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const uiSrc = fs.readFileSync(path.join(root, "../src/ui.js"), "utf8");
const cfg = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8"));
const version = JSON.parse(fs.readFileSync(path.join(root, "../package.json"), "utf8")).version;
const site = (id) => cfg.sites.find((s) => s.id === id);

function collect(html, siteCfg, url = "https://example.org/") {
  const dom = new JSDOM(html, { url });
  const prevWin = global.window, prevDoc = global.document;
  global.window = dom.window;
  global.document = dom.window.document;
  try {
    const factory = new Function(uiSrc + "; return { createBioL10nUI };")();
    const ui = factory.createBioL10nUI({
      site: {
        id: siteCfg.id, name: siteCfg.name || siteCfg.id,
        missNoise: siteCfg.missNoise || [],
        skip: siteCfg.skip || "", skipFree: siteCfg.skipFree || []
      },
      dicts: [], version
    });
    return ui.collectMisses().map((x) => x.t);
  } finally {
    global.window = prevWin;
    global.document = prevDoc;
    dom.window.close();
  }
}

// 与 src/ui.js 的 isNoise / tools/miss-report.mjs 同一套语义：普通条目子串、re: 不敏感正则、
// rec: 敏感正则。这里单独实现一份，才能在「面板只收带空格的短句」之外直接验名单本身。
function noiseMatcher(siteCfg) {
  const rules = [];
  for (const raw of siteCfg.missNoise || []) {
    const n = String(raw || "").trim();
    if (!n) continue;
    const low = n.toLowerCase();
    if (low.slice(0, 4) === "rec:") rules.push({ re: new RegExp(n.slice(4)), cs: true });
    else if (low.slice(0, 3) === "re:") rules.push({ re: new RegExp(n.slice(3), "i"), cs: false });
    else rules.push({ sub: low });
  }
  return (t) => {
    const raw = String(t).trim(), s = raw.toLowerCase();
    return rules.some((r) => (r.re ? r.re.test(r.cs ? raw : s) : s.includes(r.sub)));
  };
}

const has = (list, s) => list.some((x) => x === s);

test("KEGG：通路列表整块跳过，容器外的标题与分类页签照旧进清单", () => {
  const html = "<main>" +
    "<h2 class=\"txt3\">KEGG PATHWAY Database</h2>" +
    "<h4 id=\"metabolism\">1. Metabolism</h4>" +
    "<div class=\"list\"><dl>" +
    "<dt>01100 <span class=\"small\">M</span></dt>" +
    "<dd><a href=\"/pathway/map01100\">Metabolic pathways</a> <span class=\"new\">Title changed!</span></dd>" +
    "</dl></div>" +
    "<p>Search Gene</p>" +
    "</main>";
  const withoutSkip = collect(html, { id: "kegg", name: "KEGG" });
  assert.ok(has(withoutSkip, "Metabolic pathways"), "对照组：不加 skip 时通路名在清单里");
  assert.ok(has(withoutSkip, "Title changed!"), "对照组：列表里的更新徽标也在清单里");

  // 只开 skip、不给 skipFree：列表里的东西（通路名 + 徽标）整块消失
  const skipOnly = collect(html, { id: "kegg", name: "KEGG", skip: site("kegg").skip });
  assert.ok(!has(skipOnly, "Metabolic pathways"), "通路名是内容，skip 后不列");
  assert.ok(!has(skipOnly, "Title changed!"), "列表里的徽标也在 skip 范围内（真配置再由 skipFree 逐个放行）");
  for (const s of ["KEGG PATHWAY Database", "1. Metabolism"]) {
    assert.ok(has(skipOnly, s), "容器外的标题/页签仍应列出：" + s);
  }

  const out = collect(html, site("kegg"));
  for (const s of ["KEGG PATHWAY Database", "1. Metabolism", "Search Gene"]) {
    assert.ok(has(out, s), "容器外的标题/页签仍应列出：" + s);
  }
});

test("KEGG：skipFree 保住容器里的界面徽标与标题类，但放不出通路名", () => {
  const kg = site("kegg");
  assert.equal(kg.skip, "div.list", "通路列表容器选择器");
  assert.ok((kg.skipFree || []).includes("div.list span.new"), "Title changed! / New! 徽标在容器内，要照翻");

  const html = "<main><div class=\"list\">" +
    "<h4 class=\"txt3\">Pathway Maps</h4>" +
    "<dl><dt>00010</dt><dd><a href=\"/pathway/map00010\">Glycolysis</a> <span class=\"new\">New!</span></dd></dl>" +
    "</div></main>";
  const out = collect(html, kg);
  assert.ok(!has(out, "Glycolysis"), "通路名仍被 skip 挡住");
  assert.ok(has(out, "New!"), "span.new 徽标由 skipFree 放行");
  assert.ok(has(out, "Pathway Maps"), "h4.txt3 标题类由 skipFree 放行");
});

test("Europe PMC：名单全是锚定正则，品牌/库名不用子串", () => {
  const ep = site("europepmc");
  assert.ok(Array.isArray(ep.missNoise) && ep.missNoise.length >= 20, "名单应有足够条目");
  for (const n of ep.missNoise) {
    assert.match(n, /^(?:re|rec):/, "Europe PMC 名单不允许裸子串：" + n);
  }
  const hit = noiseMatcher(ep);
  for (const brand of ["Europe PMC", "MEDLINE", "PubMed", "PMC", "EMBL-EBI"]) {
    assert.ok(hit(brand), "品牌整串应命中：" + brand);
  }
  assert.ok(!hit("Europe PMC is hosted by EMBL’s European Bioinformatics Institute ("), "整串锚定不吃带上下文的句子");
  assert.ok(!hit("Preprints in Europe PMC"), "子串式品牌名不再误伤句子");
});

test("Europe PMC：题录/作者/卷期/资助编号/PMID/DOI 形状进名单", () => {
  const hit = noiseMatcher(site("europepmc"));
  const filtered = [
    "Genes (Basel)", "Nature", "bioRxiv",
    "Nat Commun, (1):2981", "Science, (5828):1198-1202",
    "Willer CJ", "Romano F", "Van den Steen G", "Pithana Sai Venkata Vijay C", "Karanlık H",
    "ENSA Genomics Consortium", "Genes & Health Research Team",
    ", (1):168277", ", 9(11):e033810,", ", 19-65", ", 9:e48376,", ", S1525-1578(26)00199-6,",
    "PMID: 34887591", "| PMCID: PMC6887091", "PMCID: PMC8730582", "MED: 37714298",
    "https://doi.org/10.1038/s41586-021-04064-3", "0000-0001-5004-419X", "09 Dec 2021",
    "Medical Research Council (15)", "National Institute for Health Research (NIHR) (5)",
    "VA Palo Alto Health Care System, Palo Alto, CA, USA.",
    "Institute for Maternal and Child Health, IRCCS \"Burlo Garofolo\", Trieste, Italy."
  ];
  for (const t of filtered) assert.ok(hit(t), "应被名单滤掉：" + t);
  // 光秃秃的期刊缩写（Int J Mol Sci / Nat Commun）故意不进名单：它们与 Title Case 界面词
  // （Gene Expression、Show More、Advanced Search）同形，加规则就会把真界面缺口一起藏起来。
  // 带卷期页的形态（Nat Commun, (1):2981）另有规则，仍被滤掉。
  for (const t of ["Int J Mol Sci", "Nat Commun", "Gene Expression", "Show More"]) {
    assert.equal(hit(t), false, "歧义形状不该被名单吃掉：" + t);
  }
});

test("Europe PMC：真界面缺口不被名单吃掉", () => {
  const hit = noiseMatcher(site("europepmc"));
  const ui = [
    "Advanced search", "Search syntax reference", "Grant finder", "Developer resources",
    "API case studies", "Mission & roadmap", "Help using Europe PMC", "What is Europe PMC?",
    "Annotations panel", "Annotations API", "Articles API", "Grants API",
    "Annotations Submission System", "Open access subset", "External content", "bulk downloads",
    "Europe PMC will continue to focus development in these key areas:",
    "This article has been corrected. See", "A comment on this article appears in",
    "There was an unexpected error (type=Not Found, status=404).",
    "Support by a group of international science", "Background", "Conclusions", "Abstract", "Full text"
  ];
  for (const t of ui) assert.ok(!hit(t), "界面词不该被滤：" + t);
});

test("两站名单里的正则都能编译，且 rec: 不会误吃同形界面词", () => {
  for (const id of ["kegg", "europepmc"]) {
    for (const n of site(id).missNoise || []) {
      const body = n.replace(/^(?:re|rec):/, "");
      assert.doesNotThrow(() => new RegExp(body), id + " 名单正则写坏：" + n);
    }
  }
  const hit = noiseMatcher(site("europepmc"));
  // rec: 大小写敏感：作者形状不该把全小写的句子片段当人名
  assert.ok(!hit("search Results"), "小写短语不该命中作者形状");
  assert.ok(!hit("Annotations API"), "UI 缩写不作人名尾巴");
});

test("命令行工具沿用同一份站级名单", () => {
  const toolSrc = fs.readFileSync(path.join(root, "../tools/miss-report.mjs"), "utf8");
  assert.match(toolSrc, /siteNoise/, "工具读站点 missNoise");
  assert.match(toolSrc, /data\.texts\.filter/, "采集后按名单过滤清单");
});
