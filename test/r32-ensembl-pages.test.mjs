// r32：Ensembl 新版前端（2024+）基因页 / 变异页 / 文档索引页残留补译
// 只覆盖界面骨架、固定枚举与固定说明句；ID、物种名、外部库名保持英文。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const extra = JSON.parse(fs.readFileSync(path.join(root, "../dict/ensembl-extra.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "ensembl");

const ADDED = [
  "Most severe consequence",
  "Protein altering variant",
  "Features",
  "Associations",
  "Reference sequence",
  "forward strand",
  "reverse complement",
  "Alternative allele(s)",
  "Ref",
  "Alt",
  "Change tolerance",
  "In this region",
  "Transcript strand allele",
  "Reference strand allele",
  "Transcript consequence",
  "Transcript biotype",
  "Protein impact",
  "Position in CDS",
  "Position in transcript",
  "Transcript position in gene",
  "Location in transcript",
  "Genomic sequence",
  "Search this genome",
  "Find a feature in the selected genome",
  "Show/hide rows",
  "HGNC Symbol"
];

function run(html) {
  const dom = new JSDOM(html);
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: extra.exact, rules: extra.rules },
    site
  });
  engine.start();
  return dom.window.document;
}

const norm = (s) => s.replace(/\s+/g, " ").trim();

test("新增词条：都在本册、键值规整、与其它 ensembl 册不重复", () => {
  const missing = ADDED.filter((k) => !(k in (extra.exact || {})));
  assert.deepEqual(missing, [], "缺词条");

  const bad = [];
  for (const en of ADDED) {
    const zh = extra.exact[en];
    if (en !== en.trim()) bad.push("键首尾空白: " + JSON.stringify(en));
    if (/[\u3400-\u4dbf\u4e00-\u9fff]/.test(en)) bad.push("键含中文: " + en);
    if (!zh || zh !== zh.trim()) bad.push("空译文: " + en);
    if (en === zh) bad.push("自映射: " + en);
  }
  assert.deepEqual(bad, []);

  const others = ["ensembl", "ensembl2", "ensembl-tpl", "common", "spa"].map((id) =>
    JSON.parse(fs.readFileSync(path.join(root, "../dict", id + ".json"), "utf8"))
  );
  const dup = ADDED.filter((en) => others.some((b) => en in (b.exact || {})));
  assert.deepEqual(dup, [], "与兄弟册重复的键");
});

test("变异页摘要条：最严重后果、正链、参考序列、替代等位基因", () => {
  const doc = run(
    '<div class="topbar__StandardAppLayout__rVqCZ">' +
      "<div class=\"strip__VariantSummaryStrip__iQ6m7\">" +
      '<div class="section__VariantSummaryStrip__iQ6m7"><span class="label__VariantSummaryStrip__iQ6m7">变异</span><span>rs699</span></div>' +
      '<div class="section__VariantSummaryStrip__iQ6m7"><span class="label__VariantSummaryStrip__iQ6m7">Most severe consequence</span><span>missense_variant</span></div>' +
      '<div class="section__VariantSummaryStrip__iQ6m7"><span>SNV</span><span>A</span><span>C,G,T</span></div>' +
      '<div class="section__VariantSummaryStrip__iQ6m7"><span>1:230,710,048</span></div>' +
      "</div>" +
      '<div class="container__VariantViewTab__+mpVh"><button class="button__TabButton__qEgBA" disabled="">rs699</button>' +
      '<div class="bottomRow__VariantViewTab__+mpVh"><span class="label__VariantViewTab__+mpVh">Protein altering variant</span></div></div>' +
      '<div class="left__AlternativeAlleles__JbHfC"><span class="label__AlternativeAlleles__JbHfC">Alternative allele(s)</span>' +
      '<span class="alleleLength__AlternativeAlleles__JbHfC">1<span class="alleleLengthUnit__AlternativeAlleles__JbHfC">碱基</span></span></div>' +
      '<div class="referenceSequenceLabel__VariantImage__79W6J">Reference sequence</div>' +
      '<div class="strandLabel__VariantImage__79W6J">forward strand</div>' +
      "</div>"
  );
  const labels = [...doc.querySelectorAll("span")]
    .filter((e) => /label__(VariantSummaryStrip|VariantViewTab|AlternativeAlleles)/.test(e.className))
    .map((e) => e.textContent);
  assert.deepEqual(labels, ["变异", "最严重后果", "蛋白改变型变异", "替代等位基因"]);
  assert.equal(doc.querySelector(".referenceSequenceLabel__VariantImage__79W6J").textContent, "参考序列");
  assert.equal(doc.querySelector(".strandLabel__VariantImage__79W6J").textContent, "正链");
  // 变异类型与等位基因串是数据，保持原样
  const cells = [...doc.querySelectorAll(".section__VariantSummaryStrip__iQ6m7 > span")].map((e) => e.textContent);
  assert.ok(cells.includes("SNV") && cells.includes("C,G,T") && cells.includes("1:230,710,048"));
});

test("变异页概览折叠区：Ref/Alt、变化耐受度、此区域内", () => {
  const doc = run(
    '<div class="accordionItemDefault__Accordion__5htTk">' +
      '<div class="entityViewerAccordionHeader__VariantOverview__OPfUo" role="heading">In this region</div>' +
      '<section><div class="sectionHead__VariantOverview__OPfUo">Change tolerance</div>' +
      '<div class="row__VariantOverview__OPfUo"><div class="label__VariantOverview__OPfUo">CADD</div><div>2.542</div></div></section>' +
      '<div class="row__VariantOverview__OPfUo"><div class="label__VariantOverview__OPfUo">Ref</div><div>A</div></div>' +
      '<div class="row__VariantOverview__OPfUo"><div class="label__VariantOverview__OPfUo">Alt</div><div>C,G,T</div></div>' +
      '<div class="labelValueWrapper__VariantOverview__OPfUo"><div class="label__VariantOverview__OPfUo">VCF</div><div>C,G,T</div></div>' +
      "</div>"
  );
  assert.equal(norm(doc.querySelector(".entityViewerAccordionHeader__VariantOverview__OPfUo").textContent), "此区域内");
  assert.equal(norm(doc.querySelector(".sectionHead__VariantOverview__OPfUo").textContent), "变化耐受度");
  const labels = [...doc.querySelectorAll("div.label__VariantOverview__OPfUo")].map((e) => e.textContent);
  assert.deepEqual(labels, ["CADD", "参考", "替代", "VCF"]);
});

test("变异页转录本影响表：列头整条翻译，ID 不动", () => {
  const doc = run(
    '<div class="section__VariantOverview__OPfUo">' +
      "<div><span>1:230,710,048</span><span class=\"featureDetails__VariantOverview__OPfUo\">forward strand</span></div></div>" +
      '<div class="row__TranscriptConsequences__r9oMv">' +
      '<div class="left__TranscriptConsequences__r9oMv"><span class="label__VariantViewTab__+mpVh">Transcript strand allele</span><span>G</span></div>' +
      '<div class="left__TranscriptConsequences__r9oMv"><span class="label__VariantViewTab__+mpVh">Reference strand allele</span><span>C</span></div>' +
      '<div class="left__TranscriptConsequences__r9oMv">CDS</div>' +
      "<div class=\"middle__TranscriptConsequences__r9oMv\"><span class=\"smallLight__TranscriptConsequenceDetails__z6sSJ\">Position in CDS</span> <span class=\"small__TranscriptConsequenceDetails__z6sSJ\">776 / 1,431</span></div>" +
      "<div class=\"middle__TranscriptConsequences__r9oMv\"><span class=\"smallLight__TranscriptConsequenceDetails__z6sSJ\">Position in transcript</span> <span class=\"small__TranscriptConsequenceDetails__z6sSJ\">4,075 / 11,600</span></div>" +
      '<div class="middle__TranscriptConsequences__r9oMv">ENST00000366667.6</div>' +
      '<div class="middle__TranscriptConsequences__r9oMv"><span>...AAGACTGGCTGCTCCCTGATGGGAGCCAGTGTGGACAGC...G</span><span>reverse complement</span></div>' +
      "</div>" +
      "<table><thead><tr><th>Transcript consequence</th><th>Transcript biotype</th><th>Protein impact</th></tr></thead>" +
      "<tbody><tr><td>missense_variant</td><td>protein_coding</td><td>ENSP00000355627.5</td></tr></tbody></table>" +
      '<div class="label__VariantOverview__OPfUo">Transcript position in gene</div>' +
      '<div class="label__VariantOverview__OPfUo">Location in transcript</div>'
  );
  const labels = [...doc.querySelectorAll("span")]
    .filter((e) => /label__VariantViewTab/.test(e.className))
    .map((e) => e.textContent);
  assert.deepEqual(labels, ["转录本链等位基因", "参考链等位基因"]);
  const small = [...doc.querySelectorAll("span.smallLight__TranscriptConsequenceDetails__z6sSJ")].map((e) => e.textContent);
  assert.deepEqual(small, ["CDS 中位置", "转录本中位置"]);
  assert.deepEqual([...doc.querySelectorAll("th")].map((e) => e.textContent), ["转录本后果", "转录本生物类型", "蛋白质影响"]);
  // 后果词、转录本 ID、蛋白 ID 都是数据，不能翻
  assert.deepEqual(
    [...doc.querySelectorAll("td")].map((e) => e.textContent),
    ["missense_variant", "protein_coding", "ENSP00000355627.5"]
  );
  assert.equal(doc.querySelector(".featureDetails__VariantOverview__OPfUo").textContent, "正链");
  const lab = [...doc.querySelectorAll("div.label__VariantOverview__OPfUo")].map((e) => e.textContent);
  assert.deepEqual(lab, ["基因内转录本位置", "转录本内位置"]);
  assert.ok(doc.body.textContent.includes("ENST00000366667.6"));
  const rc = [...doc.querySelectorAll("span")].filter((e) => /AAGACTGGCTGCTCCCTGATGGGAGCCAGTGTGGACAGC/.test(e.textContent) === false && e.textContent === "反向互补");
  assert.equal(rc.length, 1, "reverse complement 未翻");
  assert.ok(doc.body.textContent.includes("...AAGACTGGCTGCTCCCTGATGGGAGCCAGTGTGGACAGC...G"), "序列保持原样");
});

test("基因页下载/查找面板与表格操作菜单", () => {
  const doc = run(
    '<div class="panel__DownloadPanel__x">' +
      '<div class="option__DownloadPanel__x">Genomic sequence</div>' +
      '<div class="option__DownloadPanel__x">cDNA</div>' +
      '<div class="option__DownloadPanel__x">CDS</div>' +
      "</div>" +
      "<h3>Search this genome</h3>" +
      "<p>Find a feature in the selected genome</p>" +
      '<select class="selectResetDefaults__SimpleSelect__4Zwss">' +
      '<option data-placeholder="true" value="">操作</option>' +
      '<option value="show_hide_columns">显示/隐藏列</option>' +
      '<option value="show_hide_rows">Show/hide rows</option>' +
      '<option value="download_all_data">下载此表</option>' +
      "</select>" +
      '<div class="row__ExternalReferences__x"><div>HGNC Symbol</div><div>HGNC:11998</div></div>' +
      '<div class="row__ExternalReferences__x"><div>Expression Atlas</div><div>ENSG00000141510</div></div>'
  );
  assert.deepEqual([...doc.querySelectorAll("div.option__DownloadPanel__x")].map((e) => e.textContent), [
    "基因组序列",
    "cDNA",
    "CDS"
  ]);
  assert.equal(doc.querySelector("h3").textContent, "搜索此基因组");
  assert.equal(doc.querySelector("p").textContent, "在所选基因组中查找特征");
  assert.deepEqual([...doc.querySelectorAll("option")].map((e) => e.textContent), ["操作", "显示/隐藏列", "显示/隐藏行", "下载此表"]);
  const rows = [...doc.querySelectorAll("div.row__ExternalReferences__x > div:first-child")].map((e) => e.textContent);
  assert.deepEqual(rows, ["HGNC 符号", "Expression Atlas"], "外部库专名保持英文");
});

test("表格分页「Showing 30 /30 rows」走规则，行数不动", () => {
  const doc = run(
    '<div class="rowsCount__TableHeader__nG9pM">' +
      '<span><span class="rowsCountText__TableHeader__nG9pM">Showing </span>' +
      '<span class="rowsCountNumberProminent__TableHeader__nG9pM">30</span>' +
      '<span class="rowsCountText__TableHeader__nG9pM"> /</span></span>' +
      '<span><span>30</span><span class="rowsCountText__TableHeader__nG9pM"> rows</span></span>' +
      "</div>"
  );
  const txt = norm(doc.querySelector(".rowsCount__TableHeader__nG9pM").textContent);
  assert.equal(txt, "显示 30 /30 行");
});
