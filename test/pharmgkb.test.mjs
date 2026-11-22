// PharmGKB/ClinPGx 深页词库（pharmgkb）回归：检索筛选面板、变异页频率表、说明书注释页、下载页、404 页
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/pharmgkb.json"), "utf8"));
const cfg = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8"));
const sites = cfg.sites;

// 站点条目可能还没进 config/sites.json：有 pharmgkb 条目就用它，否则退回 clinpgx（同一个 SPA，
// pharmgkb.org 现在 301 到 clinpgx.org）。attrs 补上 data-tooltip-content：ClinPGx 的说明气泡走
// 这个属性，站点条目里需要显式声明（见交付说明）。
const pgkb =
  sites.find((s) => s.id === "pharmgkb") ||
  sites.find((s) => (s.hosts || []).includes("www.pharmgkb.org"));
const clinpgx = sites.find((s) => s.id === "clinpgx");
// pharmgkb.org 会 301 到 clinpgx.org，页面实际命中的是 clinpgx 条目，
// 所以词库栈要把 clinpgx 条目的词库也算进来（真实运行时两册同时加载）。
const site = {
  ...(clinpgx || pgkb),
  attrs: [...new Set([...(clinpgx?.attrs || []), ...(pgkb?.attrs || []), "data-tooltip-content"])]
};

// 真实词库栈：站点条目里列出的词库 + 本册（本册放最后，同键以本册为准）
const stack = [...new Set([...(clinpgx?.dicts || []), ...(pgkb?.dicts || []), "pharmgkb"])];
const exact = {}, rules = [], templates = [];
for (const id of stack) {
  const f = path.join(root, "../dict", id + ".json");
  if (!fs.existsSync(f)) continue;
  const b = JSON.parse(fs.readFileSync(f, "utf8"));
  Object.assign(exact, b.exact || {});
  if (b.rules) rules.push(...b.rules);
  if (b.templates) templates.push(...b.templates);
}
Object.assign(exact, book.exact);
rules.unshift(...book.rules);
templates.push(...book.templates);

function run(html) {
  const dom = new JSDOM(html);
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact, rules, templates },
    site: {
      scope: "",
      block: cfg.defaults.block,
      attrs: [...(cfg.defaults.attrs || []), ...(site.attrs || [])],
      proseGuard: true,
      proseMax: 120
    }
  });
  engine.start();
    return dom.window.document;
}

test("词库结构：条数、键值形态、规则可编译、模板槽位连续", () => {
  assert.equal(book.meta.family, "pharmgkb");
  assert.ok(book.meta.sites.includes("www.pharmgkb.org"));
  assert.ok(Object.keys(book.exact).length >= 60, "exact 至少 60 条");
  assert.ok(book.rules.length >= 6, "rules 至少 6 条");
  assert.ok(book.templates.length >= 8, "templates 至少 8 条");

  const seen = new Set();
  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "键里不能有中文: " + k);
    assert.ok(/[\u4e00-\u9fff]/.test(v), "译文里必须有中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "键首尾不能有空白: " + JSON.stringify(k));
    assert.ok(!seen.has(k), "重复键: " + k);
    assert.ok(!/https?:\/\/|\S+@\S+/.test(v), "译文里不能有明文 URL/邮箱: " + v);
    seen.add(k);
  }
  for (const r of book.rules) {
    assert.ok(new RegExp(r.re).source.length > 0);
    assert.ok(/[\u4e00-\u9fff]/.test(r.to), "规则译文里必须有中文: " + r.re);
    assert.ok(/\$\d/.test(r.to), "带捕获组的规则要用到占位符: " + r.re);
  }
  for (const t of book.templates) {
    const used = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.ok(used.length >= 1, "模板要带槽位: " + t.pat);
    used.slice().sort((a, b) => a - b).forEach((n, i) => assert.equal(n, i + 1, "槽位必须从 1 连续: " + t.pat));
    const zhUsed = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.deepEqual(zhUsed.slice().sort((a, b) => a - b), used.slice().sort((a, b) => a - b), "译文槽位要与原文一致");
    assert.ok(!/[\u4e00-\u9fff]/.test(t.pat), "模板原文不能含中文: " + t.pat.slice(0, 40));
  }
});

test("检索页类型筛选：实体类型与注释类型两栏、复选框文字", () => {
  const doc = run(
    '<div class="searchFilter"><h4>Filter by Type</h4>' +
      "<section><header>Entity Types</header>" +
      '<div><label><input type="checkbox" value="chemical">&nbsp;Drug</label></div>' +
      '<div><label><input type="checkbox" value="gene">&nbsp;Gene</label></div>' +
      '<div><label><input type="checkbox" value="haplotype">&nbsp;Named Allele</label></div>' +
      "</section><section><header>Annotation Types</header>" +
      '<div><label><input type="checkbox" value="guidelineAnnotation">&nbsp;Clinical Guideline Annotation</label></div>' +
      '<div><label><input type="checkbox" value="variantAnnotation">&nbsp;Variant Annotation</label></div>' +
      "</section></div>"
  );
  const headers = [...doc.querySelectorAll("header")].map((e) => e.textContent);
  assert.deepEqual(headers, ["实体类型", "注释类型"]);
  const labels = [...doc.querySelectorAll("label")].map((e) => e.textContent.replace(/\u00a0/g, "").trim());
  assert.deepEqual(labels, ["药物", "基因", "命名等位基因", "临床指南注释", "变异注释"]);
  assert.equal(doc.querySelector('input[value="chemical"]').getAttribute("value"), "chemical", "提交值不能改");
});

test("检索页结果说明句：查询词保留、整句译出；分页按钮文字按数量替换", () => {
  const doc = run(
    "<div>" +
      '<p>These are the matches for "CYP2D6" in the title, name, alternate name or description. Pathways are also matched based on their components.</p>' +
      '<nav aria-label="pagination"><a href="?offset=20"><span class="sr-only">Next 20 results</span></a></nav>' +
      '<div class="hit"><span>Star Allele</span><span>CYP2D6*4</span><span>Named Allele</span></div>' +
      "</div>"
  );
  assert.equal(
    doc.querySelector("p").textContent,
    "这些是 “CYP2D6” 在标题、名称、别名或描述中的匹配结果。通路按其组成部分匹配。"
  );
  assert.equal(doc.querySelector(".sr-only").textContent, "下一页 20 条结果");
  const hit = [...doc.querySelectorAll(".hit span")].map((e) => e.textContent);
  assert.deepEqual(hit, ["星号等位基因", "CYP2D6*4", "命名等位基因"], "等位基因名保持原样");
});

test("变异页事实卡片：标签、类型与分类枚举值", () => {
  const doc = run(
    '<div class="fact-section">' +
      '<div class="fact"><h4><div class="factLabel__content">Associated Genes</div></h4><span><a href="/gene/PA128">CYP2D6</a></span></div>' +
      '<div class="fact"><h4><div class="factLabel__content">Type</div></h4><span>Snp</span></div>' +
      '<div class="fact"><h4><div class="factLabel__content">Classification</div></h4><span>Intronic</span></div>' +
      '<div class="fact"><h4><div class="factLabel__content">Aliases</div></h4><ul><li>NC_000022.10:g.42526694G&gt;A</li></ul></div>' +
      '<div class="fact"><h4><div class="factLabel__content">ID</div></h4><span>PA166156062</span></div>' +
      "</div>"
  );
  const labels = [...doc.querySelectorAll(".factLabel__content")].map((e) => e.textContent);
  assert.deepEqual(labels, ["相关基因", "类型", "分类", "别名", "编号"]);
  const values = [...doc.querySelectorAll(".fact > span")].map((e) => e.textContent);
  assert.equal(values[0], "CYP2D6", "基因名保持原样");
  assert.equal(values[1], "单核苷酸多态性（SNP）");
  assert.equal(values[2], "内含子区");
  assert.equal(doc.querySelector("ul li").textContent, "NC_000022.10:g.42526694G>A", "HGVS 别名不能改");
});

test("变异页频率表：表头、排序按钮、人群折叠控件与说明气泡", () => {
  const doc = run(
    '<div class="fact-section"><h3 class="fact-section-header">Variant Frequencies </h3>' +
      '<table><thead><tr><th>Assembly</th><th>Sequence</th><th>Position</th><th>Alleles</th><th>Source</th>' +
      '<th>Populations</th>' +
      '<th><button type="button">A Frequency</button></th><th><button type="button">A Observed</button></th>' +
      "</tr></thead><tbody><tr><td>dbSnp</td><td>GRCh38</td></tr></tbody></table>" +
      '<a data-tooltip-content="Population Definitions" href="/page/populationMappings">info</a>' +
      '<button type="button" aria-label="Collapse All populations">v</button>' +
      '<button type="button" aria-label="not sorted">s</button>' +
      "</div>"
  );
  assert.equal(doc.querySelector("h3").textContent.trim(), "变异频率");
  const ths = [...doc.querySelectorAll("th")].map((e) => e.textContent.trim());
  assert.deepEqual(ths, ["组装", "序列", "位置", "等位基因", "来源", "群体", "等位基因频率", "等位基因观测数"]);
  const tip = doc.querySelector("a[data-tooltip-content]");
  assert.equal(tip.getAttribute("data-tooltip-content"), "人群定义");
  assert.equal(tip.getAttribute("href"), "/page/populationMappings", "链接不能改");
  assert.equal(doc.querySelector("td").textContent, "dbSNP 数据库");
  const aria = [...doc.querySelectorAll("button[aria-label]")].map((e) => e.getAttribute("aria-label"));
  assert.deepEqual(aria, ["折叠全部人群", "未排序"]);
});

test("变异页固定说明句与数据来源：链接保留、数据库名原名", () => {
  const doc = run(
    '<div class="fact-section"><h3>Alleles</h3>' +
      "<small>These are alleles tracked in ClinPGx. They may not reflect all observed alleles in other systems.</small>" +
      '<p>Based on data from the <a href="https://gnomad.broadinstitute.org/">Genomes Aggregation Database</a> (gnomAD).</p>' +
      "</div>"
  );
  assert.equal(
    doc.querySelector("small").textContent,
    "这些是 ClinPGx 收录的等位基因，可能并不涵盖其他系统中观测到的全部等位基因。"
  );
  assert.equal(doc.querySelector("p").textContent, "数据来自 Genomes Aggregation Database (gnomAD).");
  assert.equal(doc.querySelector("p a").getAttribute("href"), "https://gnomad.broadinstitute.org/", "外链不能改");
});

test("说明书注释页：摘录句规则、FDA 关联表字段与免责句", () => {
  const doc = run(
    '<section id="prescribing"><h3>Prescribing Information</h3>' +
      "<p>Excerpts from the abacavir (ZIAGEN) drug label:</p></section>" +
      '<div class="section"><h3>FDA PGx Associations</h3><table><thead><tr>' +
      "<th>Drug</th><th>Gene</th><th>Affected Subgroup</th><th>Interaction Description</th></tr></thead>" +
      "<tbody><tr><td>Recommendations</td><td>Abacavir</td><td>HLA-B</td><td>*57:01 allele positive</td></tr></tbody></table></div>" +
      "<small>The contents of this page have not been endorsed by the FDA and are the sole responsibility of ClinPGx.</small>"
  );
  assert.equal(doc.querySelector("p").textContent, "来自 abacavir (ZIAGEN) 药品说明书的摘录：");
  const ths = [...doc.querySelectorAll("th")].map((e) => e.textContent);
  assert.deepEqual(ths, ["药物", "基因", "受影响亚组", "相互作用描述"]);
  const tds = [...doc.querySelectorAll("td")].map((e) => e.textContent);
  assert.deepEqual(tds, ["建议", "Abacavir", "HLA-B", "*57:01 allele positive"], "药物名与基因名是数据");
  assert.equal(doc.querySelector("small").textContent, "本页内容未获 FDA 认可，责任完全由 ClinPGx 承担。");
});

test("说明书注释页：证据段、核对提示与 FDA 关联表出处", () => {
  const doc = run(
    "<div>" +
      "<h3>Evidence for Summary Annotations</h3>" +
      "<p>This annotation has been used as evidence for the following summary annotations.</p>" +
      "<p>Verify all entered information and recommendations that are retrieved before implementing in a healthcare setting</p>" +
      '<table class="stylized-table"><caption>From the <a href="/fdaPgxAssociations">FDA Table of Pharmacogenetic Associations</a>:</caption></table>' +
      "<h3>Variants Discussed on Label</h3>" +
      "</div>"
  );
  const hs = [...doc.querySelectorAll("h3")].map((e) => e.textContent);
  assert.deepEqual(hs, ["摘要注释的证据", "说明书中讨论的变异"]);
  const ps = [...doc.querySelectorAll("p")].map((e) => e.textContent);
  assert.equal(ps[0], "该注释已作为以下摘要注释的证据。");
  assert.equal(ps[1], "在医疗场景中实施前，请先核实检索到的全部输入信息与建议");
  assert.equal(doc.querySelector("caption").textContent, "来自 FDA 药物遗传学关联表：");
  assert.equal(doc.querySelector("caption a").getAttribute("href"), "/fdaPgxAssociations");
});

test("下载页：说明整句、归档链接规则与引用来源", () => {
  const doc = run(
    "<div>" +
      "<div>Downloads contain information from our annotations.</div>" +
      "<div>Relationships summarized from ClinPGx annotations.</div>" +
      '<a href="/x">About summary annotation archive</a>' +
      '<a href="/y">About Clinical Guideline Annotations archive</a>' +
      "<p>Data from <em>Some paper title</em> (PMID:<a href=\"/pmid/1\">12345678</a>)</p>" +
      "<p>Compiled October 2020</p>" +
      "</div>"
  );
  const divs = [...doc.querySelectorAll("div > div")].map((e) => e.textContent);
  assert.equal(divs[0], "下载文件包含我们注释的信息。");
  assert.equal(divs[1], "由 ClinPGx 注释汇总的关系数据。");
  const links = [...doc.querySelectorAll("a")].map((e) => e.textContent);
  assert.equal(links[0], "关于摘要注释归档");
  assert.equal(links[1], "关于临床指南注释归档");
  const ps = [...doc.querySelectorAll("p")].map((e) => e.textContent);
  assert.equal(ps[0], "数据来自Some paper title（PMID：12345678）", "论文标题保持原样，PMID 前缀按全角排版");
  assert.equal(ps[1], "编译于 2020 年 10 月");
});

test("下载页：格式说明模板把链接放回原位", () => {
  const doc = run(
    "<div>" +
      '<h4>Clinical Guideline Annotations</h4><p>Detailed clinical guideline annotations in <a href="http://www.json.org">JSON</a> format:</p>' +
      '<p>Pathways data in <a href="http://biopax.org">BioPAX XML</a>, <a href="http://en.wikipedia.org/wiki/Tab-separated_values">TSV</a>, and <a href="https://json.org/">JSON</a> formats:</p>' +
      "</div>"
  );
  const ps = [...doc.querySelectorAll("p")];
  assert.equal(ps[0].textContent, "临床指南注释详情（JSON 格式）：");
  assert.equal(ps[1].textContent, "通路数据（BioPAX XML、TSV、JSON 格式）：");
  assert.equal(ps[1].querySelectorAll("a").length, 3, "三个格式链接都要留在译文里");
  assert.equal(ps[1].querySelector("a").getAttribute("href"), "http://biopax.org");
});

test("下载页：长说明段模板（团队邮箱链接原位）与关注论文存档", () => {
  const doc = run(
    "<div>" +
      '<p>ClinPGx data and knowledge are available as download files. We have found that it is often critical for users to check with our team at <a href="mailto:feedback@clinpgx.org">feedback@clinpgx.org</a> before embarking on a large project using these data to be sure that the files and data we make available are being interpreted correctly. We generally do not need to be a co-author on such analyses; we just want to make sure that there is a correct understanding of our data before lots of resources are spent.</p>' +
      '<p>This is an archive of all papers of interest (aka Curators Favorite Papers) from May 2006 to April 2017. All future papers of interest will be integrated into the <a href="https://blog.clinpgx.org">ClinPGx Blog</a>.</p>' +
      "</div>"
  );
  const ps = [...doc.querySelectorAll("p")];
  assert.match(ps[0].textContent, /^ClinPGx 的数据与知识以可下载文件的形式提供。/);
  assert.match(ps[0].textContent, /通过 feedback@clinpgx\.org 与我们团队确认/);
  assert.equal(ps[0].querySelector("a").getAttribute("href"), "mailto:feedback@clinpgx.org", "邮箱链接不能改");
  assert.equal(
    ps[1].textContent,
    "这是 2006 年 5 月至 2017 年 4 月全部关注论文（即策展人精选论文）的存档。今后所有关注论文都将整合到ClinPGx 博客中。"
  );
  assert.equal(ps[1].querySelector("a").getAttribute("href"), "https://blog.clinpgx.org");
});

test("404 页：标题、错误码、两段求助模板（外链与站内）与落款", () => {
  const doc = run(
    "<div>" +
      "<h1>Resource Not Found</h1>" +
      '<p class="error-code">Error Code: 404</p>' +
      "<p>The page you requested cannot be found.</p>" +
      '<p>If you arrived at this page via a link from another site please <a href="mailto:feedback@clinpgx.org?subject=x">let us know</a> so that we can work with them to fix the issue.</p>' +
      '<p>If you arrived at this page via a link from within ClinPGx, please <a href="mailto:feedback@clinpgx.org?subject=y">let us know</a> so that we may correct the error.</p>' +
      "<p>Our apologies for the inconvenience,<br>The ClinPGx Team</p>" +
      "</div>"
  );
  assert.equal(doc.querySelector("h1").textContent, "未找到页面");
  assert.equal(doc.querySelector(".error-code").textContent, "错误代码：404");
  const ps = [...doc.querySelectorAll("p:not(.error-code)")].map((e) => e.textContent);
  assert.equal(ps[0], "无法找到你请求的页面。");
  assert.equal(ps[1], "如果你是经由其他网站的链接到达本页，请告知我们，以便我们与对方协作修复该问题。");
  assert.equal(ps[2], "如果你是经由 ClinPGx 站内链接到达本页，请告知我们，以便我们更正该错误。");
  assert.equal(ps[3], "对由此带来的不便我们深表歉意，ClinPGx 团队", "落款被 br 分成两段，拼起来是完整一句");
  assert.equal(doc.querySelectorAll("p:not(.error-code)")[3].querySelector("br").nextSibling.nodeValue, "ClinPGx 团队");
  assert.ok(doc.querySelectorAll("p:not(.error-code) a")[0].getAttribute("href").startsWith("mailto:feedback@clinpgx.org"));
});

test("基因页概览：指南句、命名句与等位基因定义表说明（模板带链接）", () => {
  const doc = run(
    "<div><ul>" +
      '<li>It is involved in guidelines for <a href="/guidelineAnnotation/PA166104996">codeine</a> and other opioids, antidepressants, and tamoxifen <a href="/gene/PA128/prescribingInfo">go to list of all guidelines with CYP2D6</a>.</li>' +
      '<li>the nomenclature has been set by <a href="https://www.pharmvar.org/gene/CYP2D6">PharmVar</a>.</li>' +
      '<li>See the <a href="/page/cyp2d6RefMaterials">Gene-specific Information Tables</a> for Allele Definitions (for which variants comprise which star alleles), Allele function assignments (normal function, no function, decreased or increased function etc) and Diplotype-Phenotype Table (for how the alleles combine to form metabolizer phenotypes for PM, NM, UM).</li>' +
      "</ul></div>"
  );
  const lis = [...doc.querySelectorAll("li")].map((e) => e.textContent);
  assert.equal(lis[0], "涉及codeine以及其他阿片类药物、抗抑郁药和他莫昔芬的用药指南。查看涉及 CYP2D6 的全部指南。");
  assert.equal(lis[1], "命名由PharmVar设定。");
  assert.match(lis[2], /^请参见基因专属信息表，了解等位基因定义/);
  assert.match(lis[2], /PM、NM、UM 等代谢者表型）。$/);
  assert.equal(doc.querySelectorAll("li")[0].querySelector("a").getAttribute("href"), "/guidelineAnnotation/PA166104996");
});

test("基因页固定句式：表型转换与强抑制剂（基因名走捕获组）", () => {
  const doc = run(
    "<div><ul>" +
      "<li>CYP2D6 is the most studied CYP for phenoconversion, where a drug-drug interaction mimics a metabolizer phenotype.</li>" +
      '<li>are strong inhibitors of CYP2D6 as per <a href="/x">Flockhart Table</a>.</li>' +
      "</ul></div>"
  );
  const lis = [...doc.querySelectorAll("li")].map((e) => e.textContent);
  assert.equal(lis[0], "CYP2D6 是研究表型转换（药物-药物相互作用模拟代谢者表型）最多的 CYP。");
  assert.equal(lis[1].trim(), "是 CYP2D6 的强抑制剂，依据 Flockhart 表。");
});

test("数据不动：基因名、药物名、HGVS、rsID、PMID、人群与机构名", () => {
  const doc = run(
    '<table class="data"><tr>' +
      "<td>CYP2D6</td><td>codeine</td><td>paroxetine</td>" +
      "<td>NC_000022.11:g.42130692G>A</td><td>rs1065852</td><td>PA166156062</td>" +
      "<td>PMID: 37757824</td><td>HLA-B*57:01</td><td>Pharmacogene Variation Consortium</td>" +
      "<td>African/African American</td><td>Ashkenazi Jewish</td><td>gnomAD v4</td>" +
      "</tr></table>"
  );
  const tds = [...doc.querySelectorAll("td")].map((e) => e.textContent);
  assert.deepEqual(tds, [
    "CYP2D6",
    "codeine",
    "paroxetine",
    "NC_000022.11:g.42130692G>A",
    "rs1065852",
    "PA166156062",
    "PMID: 37757824",
    "HLA-B*57:01",
    "Pharmacogene Variation Consortium",
    "African/African American",
    "Ashkenazi Jewish",
    "gnomAD v4"
  ]);
});