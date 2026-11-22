// r22 P2-1 / P2-3 标签级残留回归：
//   1. MedGen 记录页：dt「MedGen UID:」、h3「Curated」（含帮助图标）、span.bold「PMID:」
//   2. GTR 基因页：dd「Chromosome: …」、dt「Sequence:」、隐藏 tooltip「Gene links to PubMed …」
//   3. PubMed 帮助页：裸锚「PubMed Central」、「Linked Discoveries™」、h3「Cookies」
// 说明：MedGen 长引文行里的「PMID:」由引擎正文保护（src/engine.js:639）挡在 translate 之前，
// 词库无法处理，本文件用「已知限制」用例把这个行为钉住，避免以后误判为词表缺失。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const readBook = (id) => JSON.parse(fs.readFileSync(path.join(root, "../dict", id + ".json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;

// 站点条目以 config/sites.json 为准；父级还没接线时用这里约定的同款配置。
const projected = {
  "ncbi-medgen": {
    id: "ncbi-medgen",
    name: "NCBI MedGen",
    hosts: ["www.ncbi.nlm.nih.gov"],
    path: "^/medgen",
    dicts: ["common", "ncbi", "medgen-gtr", "clinvar-core", "ncbi-new2", "ncbi-footer", "ncbi-deep2"],
    scope: "body"
  },
  "ncbi-gtr": {
    id: "ncbi-gtr",
    name: "NCBI GTR",
    hosts: ["www.ncbi.nlm.nih.gov"],
    path: "^/gtr",
    dicts: ["common", "ncbi", "medgen-gtr", "ncbi-new2", "gene", "seq", "ncbi-footer", "ncbi-deep2"],
    scope: "body"
  },
  "pubmed-help": {
    id: "pubmed-help",
    name: "PubMed Help",
    hosts: ["pubmed.ncbi.nlm.nih.gov"],
    path: "^/help",
    dicts: ["common", "ncbi", "ncbi-help"],
    scope: "body"
  }
};

function siteOf(id) {
  const configSite = sites.find((s) => s.id === id);
  const fallback = projected[id];
  return Object.assign({}, configSite || fallback, {
    id,
    dicts: (configSite && configSite.dicts && configSite.dicts.length) ? configSite.dicts : fallback.dicts,
    scope: (configSite && configSite.scope) || "body"
  });
}

const stacks = {};
function stackOf(id) {
  if (stacks[id]) return stacks[id];
  const site = siteOf(id);
  const data = { exact: {}, rules: [], templates: [] };
  for (const bookId of site.dicts) {
    const b = readBook(bookId);
    Object.assign(data.exact, b.exact || {});
    data.rules = data.rules.concat(b.rules || []);
    data.templates = data.templates.concat(b.templates || []);
  }
  return (stacks[id] = { site, data });
}

function run(id, html) {
  const { site, data } = stackOf(id);
  const dom = new JSDOM("<body>" + html + "</body>", { url: "https://www.ncbi.nlm.nih.gov/" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return dom.window.document;
}
function translate(id, text) {
  const { site, data } = stackOf(id);
  const dom = new JSDOM("<body></body>");
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  return engine.translateText(text);
}
const text = (el) => el.textContent.replace(/\s+/g, " ").trim();

const deep2 = readBook("ncbi-deep2");
const ncbi = readBook("ncbi");
const helpBook = readBook("ncbi-help");

test("词库结构：本次新增条目与规则形态", () => {
  // ncbi-deep2：MedGen / GTR 标签
  assert.equal(deep2.exact["MedGen UID:"], "MedGen 唯一标识符：");
  assert.equal(deep2.exact["Sequence:"], "序列：");
  assert.equal(
    deep2.exact["Gene links to PubMed derived from omim_pubmed_cited links"],
    "由 omim_pubmed_cited 链接派生的 Gene 到 PubMed 链接"
  );

  // Curated 用规则不用 exact：spa 册已有 Curated -> 人工审校，exact 会跨册撞值。
  assert.ok(!Object.prototype.hasOwnProperty.call(deep2.exact, "Curated"), "Curated 不得写成 exact，避免与 spa 册冲突");
  const curated = deep2.rules.find((r) => r.re === "^(Curated)$");
  assert.ok(curated, "Curated 要有整词规则");
  assert.equal(curated.to, "人工整理");

  const chromComplement = deep2.rules.find((r) => r.re.startsWith("^Chromosome: "));
  assert.ok(chromComplement, "Chromosome 要有规则");
  assert.match(chromComplement.re, /complement/, "首个 Chromosome 规则针对带 complement 的形态");

  // ncbi-help：三处
  assert.equal(helpBook.exact["PubMed Central"], "PubMed Central（PMC）");
  assert.equal(helpBook.exact["Linked Discoveries™"], "关联发现™");
  assert.equal(helpBook.exact["Cookies"], "Cookie 说明");
  // 锚点已带（PMC），后面那截不能在值里重复括号。
  assert.equal(helpBook.exact['(PMC), search "pubmed pmc"[sb].'], "的引文，请检索“pubmed pmc”[sb]。");

  // ncbi：两种 PMID 冒号形态归一。
  const pmid = ncbi.rules.find((r) => r.re === "^PMID:?$");
  assert.ok(pmid, "PMID 要有冒号可选规则");
  assert.equal(pmid.to, "PMID：");

  // 三册里本次新增的值必须含汉字、非自映射、无首尾空白；键不含中文。
  // 例外：PubMed Central 是全册一贯保留英文的专名（既有长句译文都写成「PubMed Central（PMC）…
  // 是美国国立卫生研究院…」），本次只补上（PMC）标记，值里没有汉字。
  const added = [
    [deep2.exact, "MedGen UID:"],
    [deep2.exact, "Sequence:"],
    [deep2.exact, "Gene links to PubMed derived from omim_pubmed_cited links"],
    [helpBook.exact, "Linked Discoveries™"],
    [helpBook.exact, "Cookies"]
  ];
  for (const [book, key] of added) {
    const value = book[key];
    assert.ok(/[\u4e00-\u9fff]/.test(value), "译文要有汉字: " + key + " -> " + value);
    assert.notEqual(key, value, "自映射: " + key);
    assert.equal(value, value.trim(), "值首尾不能有空白: " + key);
  }
  for (const [book, key] of added) assert.ok(!/[\u4e00-\u9fff]/.test(key), "键里不能有中文: " + key);
  for (const [book, key] of [...added, [helpBook.exact, "PubMed Central"]]) {
    assert.equal(book[key], String(book[key]).trim(), "值首尾不能有空白: " + key);
  }
  for (const r of [curated, chromComplement, pmid]) {
    assert.doesNotThrow(() => new RegExp(r.re), "规则要能编译: " + r.re);
  }
  // PMID 是检索标识，全站一贯译法就是保留英文 + 全角冒号（ncbi 册既有 exact 同款），
  // 这条规则只做「半角/全角冒号归一」，值里没有汉字。
  assert.equal(pmid.to, "PMID：");
});

test("MedGen：dt「MedGen UID:」译出，dd 的 44287 不动（deep2 覆盖 medgen-gtr 的英文值）", () => {
  const doc = run(
    "ncbi-medgen",
    '<dl class="details"><dt>MedGen UID: </dt><dd>44287</dd></dl>'
  );
  const dt = doc.querySelector("dt");
  const dd = doc.querySelector("dd");
  assert.equal(text(dt), "MedGen 唯一标识符：");
  assert.equal(text(dd), "44287");
  assert.ok(!text(dt).includes("MedGen UID"), "不得残留 MedGen UID");
});

test("MedGen：h3「Curated」（含帮助图标）译出，data-section 属性不被改", () => {
  const doc = run(
    "ncbi-medgen",
    '<h3 class="subhead" data-section="Curated">Curated' +
      '<a class="help jig-ncbi-popper" href="#guidelinesHelpCurated" role="button">' +
      '<img class="pulldown" src="icon.png" alt=""></a></h3>'
  );
  const h3 = doc.querySelector("h3");
  assert.equal(text(h3), "人工整理");
  assert.equal(h3.getAttribute("data-section"), "Curated", "data-section 是数据属性，不能跟着翻");
});

test("MedGen：短行「PMID:」归一成「PMID：」", () => {
  const doc = run(
    "ncbi-medgen",
    '<div class="rslt"><span class="jig-ncbiinpagenav" data-val="1">1: </span>' +
      '<span class="title">Some article title</span> ' +
      '<span class="bold">PMID: </span><span>26864382</span></div>'
  );
  assert.equal(text(doc.querySelector("span.bold")), "PMID：");
  assert.ok(text(doc.body).includes("26864382"), "PMID 数字不动");
});

test("MedGen：长引文行的「PMID:」被正文保护挡住 —— 已知限制，不是词表问题", () => {
  // src/engine.js:639：块文本超过 proseMax 后，短标签整块 recordMiss 直接返回，
  // 规则 ^PMID:?$ 到不了这里；要改成「全站统一」得动 engine/site 配置（不在本册词库范围内）。
  // 真实引文行结构（/medgen/44287 的 div.portlet_content.ln）：PMID 标签前面紧挨着
  // 以「doi: … .」结尾的文本节点，inLongProse 因「前文以 . 结尾」判定成句子成分。
  const doc = run(
    "ncbi-medgen",
    '<div class="portlet_content ln"><span class="medgenPMauthor">Jia WN, Chen ZX, Shen X, Wang YL, ' +
      "Chen XY, Xiao YB, Li LZ, Huo QY, Zhang YL, Chen TH, Zhang M, Jiang YX</span><br>" +
      '<span class="medgenPMjournal">Invest Ophthalmol Vis Sci</span>\n' +
      "2026 May 1;67(5):27.\ndoi: 10.1167/iovs.67.5.27.\n" +
      '<span class="bold">PMID: </span>' +
      '<a href="https://pubmed.ncbi.nlm.nih.gov/42126156/">42126156</a></div>'
  );
  const bold = doc.querySelector("div.portlet_content.ln span.bold");
  assert.equal(text(bold), "PMID:", "正文保护内的短标签保持英文（引擎行为，词库改不动）");
});

test("GTR：dd「Chromosome: …」译出，登录号与坐标原样", () => {
  const doc = run(
    "ncbi-gtr",
    '<dl class="details"><dd>Chromosome: 17; NC_000017.11 (43044295..43170327, complement)</dd></dl>'
  );
  const dd = doc.querySelector("dd");
  assert.equal(text(dd), "染色体：17；NC_000017.11（43044295..43170327，互补链）");
  assert.ok(text(dd).includes("NC_000017.11"), "登录号必须原样");
  assert.ok(text(dd).includes("43044295..43170327"), "坐标必须原样");
  assert.ok(!/Chromosome/.test(text(dd)), "不得残留 Chromosome");

  // 正链形态（没有 complement）与 X 染色体也要走结构化规则，而不是只把冒号换掉。
  assert.equal(translate("ncbi-gtr", "Chromosome: 7; NC_000007.14 (55019017..55211628)"),
    "染色体：7；NC_000007.14（55019017..55211628）");
  assert.equal(translate("ncbi-gtr", "Chromosome: X; NC_000023.11 (1..2, complement)"),
    "染色体：X；NC_000023.11（1..2，互补链）");
  assert.equal(translate("ncbi-gtr", "Chromosome: 7"), "染色体：7");
});

test("GTR：dt「Sequence:」译出，FASTA 链接文本不动", () => {
  const doc = run(
    "ncbi-gtr",
    '<dl class="details"><dt>Sequence: </dt><dd><a href="/gtr/genes/672/NC_000017.11?report=fasta">FASTA</a></dd></dl>'
  );
  assert.equal(text(doc.querySelector("dt")), "序列：");
  assert.equal(text(doc.querySelector("dd a")), "FASTA");
});

test("GTR：隐藏 tooltip 的「Gene links to PubMed …」译出，omim_pubmed_cited 保留", () => {
  const doc = run(
    "ncbi-gtr",
    '<div class="brieflinkpop" aria-hidden="true" style="display:none">' +
      "Gene links to PubMed derived from omim_pubmed_cited links</div>"
  );
  const pop = text(doc.querySelector("div.brieflinkpop"));
  assert.equal(pop, "由 omim_pubmed_cited 链接派生的 Gene 到 PubMed 链接");
  assert.ok(pop.includes("omim_pubmed_cited"), "来源标识不能翻");
});

test("PubMed 帮助页：裸锚「PubMed Central」补上（PMC），整句不重复括号", () => {
  const doc = run(
    "pubmed-help",
    "<p>To restrict retrieval to citations that have a free full text article available in " +
      '<a href="https://www.ncbi.nlm.nih.gov/pmc/">PubMed Central</a> (PMC), search "pubmed pmc"[sb]. </p>'
  );
  const p = text(doc.querySelector("p"));
  assert.equal(p, '要将检索限定为具有免费全文、且该全文收录于 PubMed Central（PMC）的引文，请检索“pubmed pmc”[sb]。');
  assert.ok(!p.includes("PubMed Central （PMC）"), "（PMC）前不能有空格");
  assert.ok(!p.includes("（PMC）（PMC）"), "括号不能重复");
});

test("PubMed 帮助页：「Linked Discoveries™」与 h3「Cookies」译出", () => {
  const doc = run(
    "pubmed-help",
    '<h3 class="subheading" id="linked-discoveries">Linked Discoveries™</h3>' +
      '<p><a href="/help/#linked-discoveries">Linked Discoveries™</a></p>' +
      '<h3 class="subheading" id="help-cookies">Cookies</h3>'
  );
  assert.equal(text(doc.querySelector("#linked-discoveries")), "关联发现™");
  assert.equal(text(doc.querySelector("p a")), "关联发现™");
  assert.equal(text(doc.querySelector("#help-cookies")), "Cookie 说明");
  assert.equal(doc.querySelector("#help-cookies").getAttribute("id"), "help-cookies", "锚点 id 不动");
});

test("不该翻的：URL、DOI、纯数字行保持原样", () => {
  const doc = run(
    "ncbi-gtr",
    "<dl><dd>https://www.ncbi.nlm.nih.gov/gtr/</dd><dd>10.1002/em.21943</dd><dd>26864382</dd></dl>"
  );
  const dds = [...doc.querySelectorAll("dd")].map(text);
  assert.equal(dds[0], "https://www.ncbi.nlm.nih.gov/gtr/");
  assert.equal(dds[1], "10.1002/em.21943");
  assert.equal(dds[2], "26864382");
});
