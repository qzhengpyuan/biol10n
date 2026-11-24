// STRING 网络页弹层与网络类型枚举补译（r31）回归：
// 词库结构、网络类型枚举、三个弹层（Network expansion / Warning / Enrichment Table Columns）、
// 变数量说明句规则、否定词残留证明（ppi_enrichment_hint / 富集收尾句保持英文且否定词不丢）与不误翻用例。
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

const dict = read("string-atlas.json");
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;
const SITE = { scope: "body", block: "pre, code", rescan: false };
const URL_NETWORK = "https://string-db.org/network/9606.ENSP00000269305";
const URL_INPUT = "https://string-db.org/cgi/input?input_page_active_form=multiple_identifiers";

function siteData() {
  const books = ["common.json", "string-atlas.json", "string-atlas2.json"];
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
  const dom = new JSDOM(html, { url: url || URL_NETWORK });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: siteData(),
    site: SITE
  });
  engine.start();
  return { dom, engine, doc: dom.window.document };
}

const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();

// 真实渲染得到的弹层正文（string-db.org/cgi/briefexplanation?explanation_topic=…，2026-11-23 取）
const HTML_EXPAND_NETWORK = "<body><div class='enrichment_statistics_warning'>This setting controls how many additional proteins are added to the network beyond your input set. Proteins are selected based on how strongly and specifically they are associated with the proteins currently shown in the network. This setting also changes when you click the <b>'+ more'</b> button.<br/><br/><b>1st shell</b><br/>Proteins are selected based on their associations with the original query proteins. These nodes are shown in color.<br/><br/><b>2nd shell</b><br/>Additional proteins are selected based on their associations with both the input proteins and the first-shell proteins.<br><br><a style='color:var(--string-brand);text-decoration:underline' target=\"_blank\" href='/cgi/help?subpage=scores%237-network-expansion-and-interaction-shells'>Learn more about network expansion</a></div></body>";
const HTML_WARNING = "<body><div class='enrichment_statistics_warning'>You have entered STRING with 1 protein(s), but STRING has added a total of 10 protein(s) to show a network around your input (this occurs by default).<br/>&nbsp;<br/>Now, since the addition of proteins is to some extent based on prior knowledge, you can expect to see some statistical enrichment of annotated functions here.<br/>This is not a problem, but it may not be an intrinsic property of your input. If you want enrichment tests to be statistically fully valid, please enter STRING with an entire set of proteins to begin with, and set both <b>1st shell</b> and <b>2nd shell</b> to <b>none</b> under 'Max number of interactors to show' in the <b>Settings</b> tab. If this is done correctly, this warning here will disappear.</div></body>";
const HTML_COLUMNS = "<body><div class='enrichment_statistics_warning'><b>Count In Network:</b><br/>The first number indicates how many proteins in your network are annotated with a particular term. The second number indicates how many proteins in total (in your network and in the background) have this term assigned. You can click on the numbers to see the network view of the gene sets behind them.<br/><br/><b>Strength:</b><br/>Log10(observed / expected). This measure describes how large the enrichment effect is. It’s the ratio between i) the number of proteins in your network that are annotated with a term and ii) the number of proteins that we expect to be annotated with this term in a random network of the same size.<br/><br/><b>Signal:</b><br/>The signal is defined as a weighted harmonic mean between the observed/expected ratio and -log(FDR). FDR tends to emphasize larger terms due to their potential for achieving lower p-values, while the observed/expected ratio highlights smaller terms, which have a high foreground to background ratio but cannot achieve low FDR values due to their size. The signal measure seeks to balance both metrics for more intuitive ordering of enriched terms.<br/><br/><b>False Discovery Rate:</b><br/>This measure describes how significant the enrichment is. Shown are p-values corrected for multiple testing within each category using the <a style=\"text-decoration:underline;color:inherit\" target=\"_blank\"href=\"https://en.wikipedia.org/wiki/False_discovery_rate\">Benjamini–Hochberg procedure</a>.</div></body>";

test("r31 词库结构：规模、键值规整与新增条目", () => {
  const exact = Object.entries(dict.exact || {});
  assert.ok(exact.length >= 690, "exact 条目不足: " + exact.length);
  assert.ok((dict.rules || []).length >= 39, "规则不足: " + (dict.rules || []).length);
  assert.ok((dict.templates || []).length >= 37, "模板流失: " + (dict.templates || []).length);
  const bad = [];
  for (const [en, zh] of exact) {
    if (en !== en.trim()) bad.push("键首尾空白: " + JSON.stringify(en));
    if (/\s\s/.test(en)) bad.push("键含连续空白: " + JSON.stringify(en));
    if (CJK.test(en)) bad.push("键含中文: " + en);
    if (!zh || zh !== zh.trim()) bad.push("空译文/首尾空白: " + en);
    if (!CJK.test(zh)) bad.push("译文无中文: " + en);
    if (en === zh) bad.push("自映射: " + en);
    if (/https?:\/\/|www\./.test(zh)) bad.push("译文含 URL: " + en);
  }
  for (const r of dict.rules || []) {
    let re;
    try { re = new RegExp(r.re); } catch (e) { bad.push("正则非法: " + r.re); continue; }
    if (!/^\^/.test(r.re) || !/\$$/.test(r.re)) bad.push("未锚定: " + r.re);
    const groups = (re.source.match(/\((?!\?)/g) || []).length;
    for (const m of r.to.matchAll(/\$(\d)/g)) if (Number(m[1]) > groups) bad.push("占位符越界: " + r.re);
  }
  for (const t of dict.templates || []) {
    const slots = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    const uniq = [...new Set(slots)].sort((a, b) => a - b);
    if (uniq.join(",") !== Array.from({ length: slots.length }, (_, i) => i + 1).join(",")) bad.push("槽位不连续: " + t.pat.slice(0, 40));
    const zhSlots = [...new Set([...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
    if (zhSlots.join(",") !== uniq.join(",")) bad.push("译文槽位不一致: " + t.pat.slice(0, 40));
  }
  assert.deepEqual(bad, []);

  const added = {
    "Regulatory": "调控",
    "button.": "按钮时的行为。",
    "Now, since the addition of proteins is to some extent based on prior knowledge, you can expect to see some statistical enrichment of annotated functions here.":
      "由于添加蛋白质在一定程度上基于已有知识，您在这里可能会看到注释功能带来的一些统计富集。",
    "This setting controls how many additional proteins are added to the network beyond your input set. Proteins are selected based on how strongly and specifically they are associated with the proteins currently shown in the network. This setting also changes when you click the":
      "该设置控制除输入集合之外还向网络中额外添加多少蛋白质。蛋白质按其与当前网络中蛋白质关联的强度与特异性选取。此设置也会改变点击",
    "This measure describes how significant the enrichment is. Shown are p-values corrected for multiple testing within each category using the":
      "该指标描述富集的显著性。所显示的 P 值是每个类别内做多重检验校正后的值，校正方法为"
  };
  for (const [k, v] of Object.entries(added)) assert.equal(dict.exact[k], v, "新增条目缺失: " + k.slice(0, 40));
});

test("r31 网络类型枚举：输入页预览里的 Regulatory", () => {
  // 多标识符输入页左侧网络预览的「Type」取值是 Physical / Regulatory（实际渲染到的 dd 原文）。
  const { doc, engine } = boot(
    '<body><div class="net_legend"><dl class="net_stats">' +
      "<div><dt>Type</dt><dd>Physical</dd></div>" +
      "<div><dt>Type</dt><dd>Regulatory</dd></div>" +
      "<div><dt>Species</dt><dd>Homo sapiens</dd></div></dl></div></body>",
    URL_INPUT
  );
  const dds = [...doc.querySelectorAll("dd")].map((d) => d.textContent);
  assert.deepEqual(dds, ["物理", "调控", "Homo sapiens"], "物种名不翻");
  assert.equal(engine.translateText("Regulatory"), "调控");
  assert.equal(engine.translateText("Regulatory subnetwork"), "调控子网络");
});

test("r31 弹层 Network expansion：说明句 + 按钮字面量 + 两壳定义", () => {
  const { doc } = boot(HTML_EXPAND_NETWORK);
  const text = norm(doc.body.textContent);
  assert.match(text, /^该设置控制除输入集合之外还向网络中额外添加多少蛋白质。/);
  assert.match(text, /此设置也会改变点击 '\+ more' 按钮时的行为。/);
  assert.match(text, /第一层按与原始查询蛋白质的关联程度选取蛋白质。这些节点以彩色显示。/);
  assert.match(text, /第二层按与输入蛋白质及第一层蛋白质的关联程度选取额外蛋白质。/);
  assert.match(text, /进一步了解网络扩展$/);
  const link = doc.querySelector("a");
  assert.equal(link.textContent, "进一步了解网络扩展");
  assert.equal(link.getAttribute("href"), "/cgi/help?subpage=scores%237-network-expansion-and-interaction-shells");
  assert.equal(link.getAttribute("target"), "_blank");
  assert.equal(doc.querySelectorAll("b").length, 3, "三处加粗标签保留");
});

test("r31 弹层 Enrichment Table Columns：末段整句与假发现率方法链接", () => {
  const { doc } = boot(HTML_COLUMNS);
  const text = norm(doc.body.textContent);
  assert.match(text, /^网络内数量：/);
  assert.match(text, /假发现率：该指标描述富集的显著性。所显示的 P 值是每个类别内做多重检验校正后的值，校正方法为 Benjamini–Hochberg procedure。$/);
  const link = [...doc.querySelectorAll("a")].find((a) => /Benjamini/.test(a.textContent));
  assert.ok(link, "方法名链接应保留");
  assert.equal(link.textContent, "Benjamini–Hochberg procedure");
  assert.equal(link.getAttribute("href"), "https://en.wikipedia.org/wiki/False_discovery_rate");
});

test("r31 弹层 Warning：前两句收掉，第三段保持整段英文（不制造逐词混排）", () => {
  const { doc } = boot(HTML_WARNING);
  const text = norm(doc.body.textContent);
  assert.match(text, /^您向 STRING 输入了 1 个蛋白质，但 STRING 额外添加了共 10 个蛋白质以显示您输入周围的网络（这是默认行为）。/);
  assert.match(text, /由于添加蛋白质在一定程度上基于已有知识，您在这里可能会看到注释功能带来的一些统计富集。/);
  // 第三段夹着 <b>1st shell</b> 等设置项标签：首扫时右邻仍是英文，prose guard 会挡住标签；
  // 若把 and / to 这类单功能词也收进词表，/cgi/access 的英文正文会被塞进「与」（见下一条用例），
  // 因此这一段整体留英文，只做「整段中文 / 整段英文」的取舍。
  assert.match(text, /This is not a problem, but it may not be an intrinsic property of your input\./);
  assert.equal(dict.exact["and"], undefined, "and 不得进词表（会污染英文正文）");
  assert.equal(dict.exact["to"], undefined, "to 不得进词表");
});

test("r31 规则：变数量的 STRING 输入说明句", () => {
  const { engine } = boot("<body></body>");
  assert.equal(
    engine.translateText(
      "You have entered STRING with 1 protein(s), but STRING has added a total of 10 protein(s) to show a network around your input (this occurs by default)."
    ),
    "您向 STRING 输入了 1 个蛋白质，但 STRING 额外添加了共 10 个蛋白质以显示您输入周围的网络（这是默认行为）。"
  );
  assert.equal(
    engine.translateText(
      "You have entered STRING with 7 protein(s), but STRING has added a total of 33 protein(s) to show a network around your input (this occurs by default)."
    ),
    "您向 STRING 输入了 7 个蛋白质，但 STRING 额外添加了共 33 个蛋白质以显示您输入周围的网络（这是默认行为）。"
  );
  assert.equal(engine.translateText("You have entered STRING with 7 proteins."), null, "不该命中别的句子");
});

test("r41 否定词未丢：ppi_enrichment_hint 走模板换中文骨架，not 落在强调 span 里且语义不丢", () => {
  // 真实 DOM（2026-11-24 CDP 实测，__BIOL10N.disable() 后取原始 HTML）：
  // 结尾是半角 ")"；被翻译后的页面里 punctFix 才会把它改成 "）"，验模板必须用原始 DOM。
  const { doc } = boot(
    '<body><div class="legend_headline">Network stats</div>' +
      '<div class="ppi_enrichment_hint">your network does <span class="emphasis">not</span> have significantly more <br>' +
      'interactions than expected (<span style="text-decoration:underline;cursor:pointer;" ' +
      'onclick="return load_info_window (event, &quot;Interaction Enrichment&quot;, &quot;interactions_not_significant&quot;);">' +
      "what does that mean?</span>)</div></body>"
  );
  const hint = doc.querySelector(".ppi_enrichment_hint");
  const text = norm(hint.textContent);
  assert.equal(text, "你的网络中的相互作用并不显著多于预期（这是什么意思？）", "整句未按模板汉化: " + text);
  assert.doesNotMatch(text, /does|significantly|than expected/, "不得留英文骨架");
  const em = hint.querySelector("span.emphasis");
  assert.equal(em.textContent, "并不", "否定词改由强调 span 承载（not → 并不），仍是独立节点");
  const link = hint.querySelector('span[onclick]');
  assert.equal(link.textContent, "这是什么意思？", "「这是什么意思？」沿用既有条目");
  assert.match(link.getAttribute("onclick"), /interactions_not_significant/, "内联事件不动");
  assert.equal(hint.querySelectorAll("br").length, 1, "换行保留");
});

test("r41 否定词未丢：富集收尾句只翻骨架，7 个类别裸文本原样英文", () => {
  const { doc } = boot(
    '<body><div class="enrichments_closing_remarks">\n There were <span>no</span> significant pathway enrichments observed in the following categories:' +
      "<br> Local Network Cluster (STRING), Disease-gene Associations (DISEASES), Hallmark Gene Set (Molecular Signatures DB), " +
      "Fission Yeast Phenotype Ontology (Monarch), GWAS Catalog, Protein Domains (Pfam), Protein Domains and Features (InterPro).</div></body>"
  );
  const div = doc.querySelector(".enrichments_closing_remarks");
  const text = norm(div.textContent);
  assert.equal(
    text,
    "在以下类别中未观察到显著的通路富集： Local Network Cluster (STRING), Disease-gene Associations (DISEASES), " +
      "Hallmark Gene Set (Molecular Signatures DB), Fission Yeast Phenotype Ontology (Monarch), GWAS Catalog, " +
      "Protein Domains (Pfam), Protein Domains and Features (InterPro).",
    "骨架未汉化或类别名被误翻: " + text
  );
  assert.equal(div.querySelector("span").textContent, "未", "否定词 no → 未，仍在独立 span 里");
  assert.equal(div.querySelectorAll("br").length, 1, "换行保留");
});

test("r31 不误翻：蛋白名、登录号、编号、机构名与专有名", () => {
  const { engine } = boot("<body></body>");
  for (const s of [
    "TP53",
    "ENSP00000269305",
    "Homo sapiens",
    "GO:0009299",
    "hsa04218",
    "SIB - Swiss Institute of Bioinformatics",
    "EMBL - European Molecular Biology Laboratory",
    "WikiPathways",
    "FDR",
    "[HD]",
    "1st shell",
    "1st shell and 2nd shell"
  ]) {
    const got = engine.translateText(s);
    if (s === "1st shell") { assert.equal(got, "第一层"); continue; }
    assert.equal(got, null, "不应翻译: " + s);
  }
});

test("r31 单功能词不污染英文正文（robots.txt and sitemap_index.xml）", () => {
  const { doc, engine } = boot(
    '<body><div class="footer_text_page_boring">For a description of the robots policy and crawling rules, please see ' +
      '<a href="/robots.txt">robots.txt</a> and <a href="/sitemap_index.xml">sitemap_index.xml</a>. ' +
      "This sentence is deliberately long so that the prose guard engages, as it only applies to blocks longer than one hundred and twenty characters.</div></body>"
  );
  const text = norm(doc.querySelector(".footer_text_page_boring").textContent);
  assert.match(text, /robots\.txt and sitemap_index\.xml/, "and 不得被翻成「与」塞进英文正文");
  assert.doesNotMatch(text, CJK);
  assert.equal(engine.translateText("and"), null);
  assert.equal(engine.translateText("to"), null);
});
