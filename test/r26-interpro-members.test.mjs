// r26：InterPro 首页成员库区块——13 个成员库 logo 的 alt 与 12 条成员库简介 aria-label
// （PROSITE profiles 与 PROSITE patterns 两个区块共用同一段简介，故 13 个区块 = 12 条唯一长文）。
// 简介用「整串锚定规则」收录而不是 exact：中文译文远超 60 字符，进 exact 会给 check 增加
// 「值过长」告警；规则按 \u0001 归一化后的属性原文整串命中。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/interpro.json"), "utf8"));
const common = JSON.parse(fs.readFileSync(path.join(root, "../dict/common.json"), "utf8"));
const spa = JSON.parse(fs.readFileSync(path.join(root, "../dict/spa.json"), "utf8"));

const site = {
  id: "interpro",
  name: "InterPro",
  hosts: ["www.ebi.ac.uk"],
  path: "^/interpro",
  dicts: ["common", "spa", "interpro"],
  scope: "body",
  spa: true,
  waitFor: "#root",
  rescan: false
};
const data = {
  exact: Object.assign({}, common.exact, spa.exact, dict.exact),
  rules: [...(common.rules || []), ...(spa.rules || []), ...(dict.rules || [])],
  templates: [...(common.templates || []), ...(spa.templates || []), ...(dict.templates || [])]
};

const CJK = /[\u4e00-\u9fff]/;

// 把属性值挂到真实元素上再让引擎跑一遍（与页面上的 aria-label / alt 同一条属性通道）。
function translateAttr(name, value) {
  const dom = new JSDOM("<span>x</span>", { url: "https://www.ebi.ac.uk/interpro/" });
  const el = dom.window.document.querySelector("span");
  el.setAttribute(name, value);
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return el.getAttribute(name);
}

// 2026-11-23 抓自 https://www.ebi.ac.uk/interpro/ 的成员库区块 aria-label 原文（整串）。
const INTROS = [
  "The CATH-Gene3D database describes protein families and domain architectures in complete genomes. Protein families are formed using a Markov clustering algorithm, followed by multi-linkage clustering according to sequence identity. Mapping of predicted structure and sequence domains is undertaken using hidden Markov models libraries representing CATH and Pfam domains. CATH-Gene3D is based at University College, London, UK.",
  "CDD is a protein annotation resource that consists of a collection of annotated multiple sequence alignment models for ancient domains and full-length proteins. These are available as position-specific score matrices (PSSMs) for fast identification of conserved domains in protein sequences via RPS-BLAST. CDD content includes NCBI-curated domain models, which use 3D-structure information to explicitly define domain boundaries and provide insights into sequence/structure/function relationships, as well as domain models imported from a number of external source databases.",
  "HAMAP stands for High-quality Automated and Manual Annotation of Proteins. HAMAP profiles are manually created by expert curators. They identify proteins that are part of well-conserved protein families or subfamilies. HAMAP is based at the SIB Swiss Institute of Bioinformatics, Geneva, Switzerland.",
  "NCBIfam is a collection of protein families, featuring curated multiple sequence alignments, hidden Markov models (HMMs) and annotation, which provides a tool for identifying functionally related proteins based on sequence homology. NCBIfam is maintained at the National Center for Biotechnology Information (Bethesda, MD). NCBIfam includes models from TIGRFAMs, another database of protein families developed at The Institute for Genomic Research, then at the J. Craig Venter Institute (Rockville, MD, US).",
  "PANTHER is a large collection of protein families that have been subdivided into functionally related subfamilies, using human expertise. These subfamilies model the divergence of specific functions within protein families, allowing more accurate association with function, as well as inference of amino acids important for functional specificity. Hidden Markov models (HMMs) are built for each family and subfamily for classifying additional protein sequences. PANTHER is based at the University of Southern California, CA, US.",
  "Pfam is a large collection of multiple sequence alignments and hidden Markov models covering many common protein domains. Pfam is based at EMBL-EBI, Hinxton, UK.",
  "PIRSF protein classification system is a network with multiple levels of sequence diversity from superfamilies to subfamilies that reflects the evolutionary relationship of full-length proteins and domains. PIRSF is based at the Protein Information Resource, Georgetown University Medical Centre, Washington DC, US.",
  "PRINTS is a compendium of protein fingerprints. A fingerprint is a group of conserved motifs used to characterise a protein family or domain. PRINTS is based at the University of Manchester, UK.",
  "PROSITE is a database of protein families and domains. It consists of biologically significant sites, patterns and profiles that help to reliably identify to which known protein family a new sequence belongs. PROSITE is based at the Swiss Institute of Bioinformatics (SIB), Geneva, Switzerland.",
  "SFLD (Structure-Function Linkage Database) is a hierarchical classification of enzymes that relates specific sequence-structure features to specific chemical capabilities.",
  "SMART (a Simple Modular Architecture Research Tool) allows the identification and annotation of genetically mobile domains and the analysis of domain architectures. SMART is based at EMBL, Heidelberg, Germany.",
  "SUPERFAMILY is a library of profile hidden Markov models that represent all proteins of known structure. The library is based on the SCOP classification of proteins: each model corresponds to a SCOP domain and aims to represent the entire SCOP superfamily that the domain belongs to. SUPERFAMILY is based at the University of Bristol, UK."
];

test("成员库简介 aria-label 整串翻成中文", () => {
  assert.equal(INTROS.length, 12, "简介条数不是 12");
  for (const s of INTROS) {
    const out = translateAttr("aria-label", s);
    assert.notEqual(out, s, "简介未翻译: " + s.slice(0, 60));
    assert.match(out, CJK, "译文不含汉字: " + s.slice(0, 60));
    assert.ok(out.length > 40, "译文过短: " + s.slice(0, 60));
    // 机构名/地址按口径保留英文
    assert.doesNotMatch(out, /依托于 [\u4e00-\u9fff]/, "机构名被翻译: " + out.slice(-40));
  }
});

test("12 条简介用整串锚定规则收录，不进 exact（避免新增值过长告警）", () => {
  for (const s of INTROS) {
    assert.equal(dict.exact[s], undefined, "简介不该进 exact: " + s.slice(0, 50));
    const hit = dict.rules.some((r) => {
      const re = new RegExp(r.re);
      return re.test(s) && r.re.startsWith("^(") && r.re.endsWith(")$");
    });
    assert.ok(hit, "缺少整串锚定规则: " + s.slice(0, 50));
  }
  for (const r of dict.rules) {
    assert.match(r.to, CJK, "规则译文不含汉字: " + r.re.slice(0, 40));
    assert.ok(/\((?!\?)/.test(r.re), "规则没有捕获组: " + r.re.slice(0, 40));
  }
});

const MEMBER_LOGOS = {
  "cathgene3d member database logo": "CATH-Gene3D 成员数据库标志",
  "cdd member database logo": "CDD 成员数据库标志",
  "hamap member database logo": "HAMAP 成员数据库标志",
  "ncbifam member database logo": "NCBIfam 成员数据库标志",
  "panther member database logo": "PANTHER 成员数据库标志",
  "pfam member database logo": "Pfam 成员数据库标志",
  "pirsf member database logo": "PIRSF 成员数据库标志",
  "prints member database logo": "PRINTS 成员数据库标志",
  "profile member database logo": "PROSITE profiles 成员数据库标志",
  "prosite member database logo": "PROSITE patterns 成员数据库标志",
  "sfld member database logo": "SFLD 成员数据库标志",
  "smart member database logo": "SMART 成员数据库标志",
  "ssf member database logo": "SUPERFAMILY 成员数据库标志"
};

test("成员库 logo 的 alt 保留英文简称，只翻 member database logo", () => {
  const keys = Object.keys(MEMBER_LOGOS);
  assert.equal(keys.length, 13, "成员库 logo 不是 13 个");
  for (const [alt, zh] of Object.entries(MEMBER_LOGOS)) {
    assert.equal(translateAttr("alt", alt), zh, "logo alt 未按预期翻译: " + alt);
    const name = alt.replace(" member database logo", "");
    assert.ok(!/[\u4e00-\u9fff]/.test(name), "简称不应含中文: " + name);
  }
});

test("页脚资助方 logo 与 footnote 的通用词", () => {
  assert.equal(translateAttr("alt", "X logo"), "X 标志");
  assert.equal(translateAttr("alt", "EMBL logo"), "EMBL 标志");
  assert.equal(translateAttr("alt", "Wellcome Trust logo"), "Wellcome Trust 标志");
  assert.equal(translateAttr("alt", "BBSRC logo"), "BBSRC 标志");
  assert.equal(translateAttr("aria-label", "footnote"), "脚注");
});

test("成员库区块的 title（约 Nk）仍按既有规则翻译", () => {
  assert.equal(translateAttr("title", "Approximately 53k"), "约 53k");
});

test("成员库区块整合：同一卡片里的 aria-label / alt / title 三条属性都翻", () => {
  const html = '<div class="home_styles__memberdb-block___eb">' +
    '<a data-testid="member-database-pfam" title="Approximately 53k">' +
    '<span aria-label="Pfam is a large collection of multiple sequence alignments and hidden Markov models covering many common protein domains. Pfam is based at EMBL-EBI, Hinxton, UK.">' +
    '<img alt="pfam member database logo" src="/interpro/assets/images/pfam_logo.490.png">' +
    "</span></a></div>";
  const dom = new JSDOM(html, { url: "https://www.ebi.ac.uk/interpro/" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  const a = dom.window.document.querySelector("a");
  const span = dom.window.document.querySelector("span");
  const img = dom.window.document.querySelector("img");
  assert.equal(a.getAttribute("title"), "约 53k");
  assert.match(span.getAttribute("aria-label"), /^Pfam 是一个大型集合/);
  assert.equal(img.getAttribute("alt"), "Pfam 成员数据库标志");
  assert.equal(engine.stats.attrRule, 2, "title 与 aria-label 都走规则");
  assert.equal(engine.stats.attrHit, 1, "logo alt 走 exact");
});
