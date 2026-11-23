// r30 UCSC 页面补译：hgGene 的 UniProt 小节标签与疾病图例、hgTracks 轨道检索面板。
// 口径：只翻固定标签/图例/面板骨架；基因名、疾病名、组装名、格式名等数据保持原文（见末尾「不翻」用例）。
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
const site = sites.find((s) => s.id === "ucsc");
const extra = JSON.parse(fs.readFileSync(path.join(root, "../dict/ucsc-extra.json"), "utf8"));

function load() {
  const exact = {};
  const rules = [];
  const templates = [];
  for (const n of site.dicts) {
    const d = JSON.parse(fs.readFileSync(path.join(root, "../dict/" + n + ".json"), "utf8"));
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
    templates.push(...(d.templates || []));
  }
  return { exact, rules, templates };
}

function run(html, url = "https://genome.ucsc.edu/cgi-bin/hgGene?db=hg38&hgg_gene=BRCA1") {
  const dom = new JSDOM(html, { url });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: load(),
    site
  });
  engine.start();
  return dom.window.document;
}

test("hgGene UniProt 小节标签（BRCA1/CFTR/EGFR/TTN/HBB/ALB/INS 实测）逐条翻译", () => {
  const doc = run(
    '<div id="uniProt">' +
      "<b>CATALYTIC ACTIVITY:</b><b>ENZYME REGULATION:</b><b>PATHWAY:</b><b>POLYMORPHISM:</b>" +
      "<b>MISCELLANEOUS:</b><b>MASS SPECTROMETRY:</b><b>CAUTION:</b><b>PHARMACEUTICAL:</b>" +
      "<b>DESCRIPTION:</b><b>FUNCTION:</b>" +
      "</div>"
  );
  const labels = [...doc.querySelectorAll("b")].map((e) => e.textContent);
  assert.deepEqual(labels, [
    "催化活性：",
    "酶调控：",
    "通路：",
    "多态性：",
    "其他信息：",
    "质谱：",
    "注意事项：",
    "药物信息：",
    "描述：",
    "功能："
  ]);
});

test("hgGene 疾病关联图例整句翻译", () => {
  const doc = run('<table class="disease"><tr><td><small>* = Manually curated disease association</small></td></tr></table>');
  assert.equal(doc.querySelector("small").textContent, "* = 人工策展的疾病关联");
});

test("hgTracks 轨道检索面板：标题、字段名、说明与帮助链接", () => {
  const doc = run(
    '<div class="trackSearch">' +
      '<div class="windowSize">Search for Tracks in the Human Dec. 2013 (GRCh38/hg38) Assembly</div>' +
      "<b>Track Name:</b><b>Data Format:</b>" +
      "<b>Include Public Hub Search Results:</b>" +
      "<table><tr><td>NOTE: Including public hubs in results may be slow</td></tr></table>" +
      '<div class="subheadingBar windowSize">About Track Search</div>' +
      "<a>more help</a>" +
      "</div>",
    "https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38&position=chr17:43044295-43125364&hgt_tSearch=track+search"
  );
  assert.equal(
    doc.querySelector("div.windowSize").textContent,
    "在 Human Dec. 2013 (GRCh38/hg38) 组装体中检索轨道",
    "组装名是数据，保留原文，只翻骨架"
  );
  const bs = [...doc.querySelectorAll("b")].map((e) => e.textContent);
  assert.deepEqual(bs, ["轨道名称：", "数据格式：", "包含公共 Hub 检索结果："]);
  assert.equal(doc.querySelector("td").textContent, "注意：在结果中包含公共 Hub 可能较慢");
  assert.equal(doc.querySelector(".subheadingBar").textContent, "关于轨道检索");
  assert.equal(doc.querySelector("a").textContent, "更多帮助");
});

test("轨道检索标题规则只吃 Assembly 结尾，其他句式原样", () => {
  const doc = run(
    "<div>" +
      "<span>Search for Tracks in the Mouse Dec. 2011 (GRCm38/mm10) Assembly</span>" +
      "<span>Search for Tracks</span>" +
      "<span>Search for Tracks in the genome</span>" +
      "</div>",
    "https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38&hgt_tSearch=track+search"
  );
  const spans = [...doc.querySelectorAll("span")].map((e) => e.textContent);
  assert.deepEqual(spans, [
    "在 Mouse Dec. 2011 (GRCm38/mm10) 组装体中检索轨道",
    "Search for Tracks",
    "Search for Tracks in the genome"
  ]);
});

test("数据不翻：基因名、疾病名、物种名、accession、格式选项、组装名单独出现", () => {
  const doc = run(
    '<table class="data">' +
      "<tr><td>BRCA1</td><td>breast cancer</td><td>D. melanogaster</td><td>NM_007294.4</td>" +
      "<td>Human Dec. 2013 (GRCh38/hg38)</td><td>Alignment binary (bam) - binary SAM</td>" +
      "<td>KEGG - Kyoto Encyclopedia of Genes and Genomes</td><td>MalaCards</td></tr>" +
      "</table>"
  );
  const tds = [...doc.querySelectorAll("td")].map((e) => e.textContent);
  assert.deepEqual(tds, [
    "BRCA1",
    "breast cancer",
    "D. melanogaster",
    "NM_007294.4",
    "Human Dec. 2013 (GRCh38/hg38)",
    "Alignment binary (bam) - binary SAM",
    "KEGG - Kyoto Encyclopedia of Genes and Genomes",
    "MalaCards"
  ]);
});

test("新增词条完整性：本次 15 条 exact 与 1 条规则都在，规则可编译", () => {
  const added = {
    "CATALYTIC ACTIVITY:": "催化活性：",
    "ENZYME REGULATION:": "酶调控：",
    "PATHWAY:": "通路：",
    "POLYMORPHISM:": "多态性：",
    "MISCELLANEOUS:": "其他信息：",
    "MASS SPECTROMETRY:": "质谱：",
    "CAUTION:": "注意事项：",
    "PHARMACEUTICAL:": "药物信息：",
    "* = Manually curated disease association": "* = 人工策展的疾病关联",
    "Track Name:": "轨道名称：",
    "Data Format:": "数据格式：",
    "Include Public Hub Search Results:": "包含公共 Hub 检索结果：",
    "NOTE: Including public hubs in results may be slow": "注意：在结果中包含公共 Hub 可能较慢",
    "About Track Search": "关于轨道检索",
    "more help": "更多帮助"
  };
  for (const [k, v] of Object.entries(added)) {
    assert.equal(extra.exact[k], v, "缺词条: " + k);
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "键里不能有中文: " + k);
    assert.ok(/[\u4e00-\u9fff]/.test(extra.exact[k]), "译文里必须有中文: " + k);
  }
  const rule = extra.rules.find((r) => r.re === "^Search for Tracks in the (.+) Assembly$");
  assert.ok(rule, "缺轨道检索标题规则");
  assert.equal(rule.to, "在 $1 组装体中检索轨道");
  for (const r of extra.rules) assert.doesNotThrow(() => new RegExp(r.re));
  for (const k of Object.keys(extra.exact)) {
    assert.notEqual(k, extra.exact[k], "自映射: " + k);
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "键里不能有中文: " + k);
  }
});
