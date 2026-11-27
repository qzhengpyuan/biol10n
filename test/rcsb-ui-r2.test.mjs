// RCSB PDB 第二轮界面补译（dict/rcsb.json）：页脚资助声明按真实节点边界补齐机构名与连接词、
// 结构页「实体分组」入口的 aria-label 整句、首页新闻卡标题与配图 alt。
// 边界项（正文句子、<sup> 碎片、品牌名）刻意留英文，本文件把它们钉成「不翻」的判据。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const readDict = (n) => JSON.parse(fs.readFileSync(path.join(root, "../dict", n + ".json"), "utf8"));
const dict = readDict("rcsb");
const common = readDict("common");
const spa = readDict("spa");
const rcsbHome = readDict("rcsb-home");

// config/sites.json 里 rcsb-pdb 的 dicts 是 ["common","spa","rcsb","rcsb-home"]，这里保持一致
const site = {
  id: "rcsb-pdb",
  name: "RCSB PDB",
  hosts: ["www.rcsb.org", "rcsb.org"],
  dicts: ["common", "spa", "rcsb", "rcsb-home"],
  scope: "header, nav, main, footer, #root, .visually-hidden-focusable, .skip-link",
  spa: true,
  waitFor: "#root",
  valueText: true
};

const all = {
  exact: Object.assign({}, common.exact, spa.exact, dict.exact, rcsbHome.exact),
  rules: [...(common.rules || []), ...(spa.rules || []), ...(dict.rules || []), ...(rcsbHome.rules || [])],
  templates: [...(common.templates || []), ...(spa.templates || []), ...(dict.templates || []), ...(rcsbHome.templates || [])]
};

const CJK = /[\u4e00-\u9fff]/;

function engineFor(html, url) {
  const dom = new JSDOM(html, { url: url || "https://www.rcsb.org/" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data: all, site });
  engine.start();
  return { doc: dom.window.document, engine };
}

const anyEngine = engineFor("<p>x</p>").engine;
const text = (el) => el.textContent.replace(/\s+/g, " ").trim();

test("词库结构：本册站点/家族不变，新增条目都在 exact 且译文含汉字", () => {
  assert.equal(dict.meta.family, "rcsb");
  for (const host of ["www.rcsb.org", "rcsb.org"]) assert.ok(dict.meta.sites.includes(host), "缺站点: " + host);
  const must = [
    "U.S. National Science Foundation",
    "(DBI-2321666), the",
    "US Department of Energy",
    "(DE-SC0019749), and the",
    "National Cancer Institute",
    "National Institute of Allergy and Infectious Diseases",
    "National Institute of General Medical Sciences",
    "National Institutes of Health",
    "under grant R01GM157729. RCSB PDB uses resources of the National Energy Research Scientific Computing Center (",
    "), a Department of Energy User Facility.",
    "December 1: World AIDS Day",
    "PDB-101 Focus: Biotechnology",
    "Image for PDB-101 Focus: Biotechnology",
    "Image for Harmonization of NMR Data Deposition: Adoption of unified NMR data and PDBx/mmCIF",
    "This entity has been grouped together with similar entities from other structures. Use the links below to navigate to the corresponding group pages and explore the characteristics of similar entities."
  ];
  for (const k of must) {
    assert.ok(k in dict.exact, "缺条目: " + k);
    assert.match(dict.exact[k], CJK, "译文不含汉字: " + k + " => " + dict.exact[k]);
  }
});

// 卫生只查本轮新增的条目：册里既有条目有自己的历史（个别值带尾随空格），不在本轮改动范围
const ADDED = [
  "U.S. National Science Foundation",
  "(DBI-2321666), the",
  "US Department of Energy",
  "(DE-SC0019749), and the",
  "National Cancer Institute",
  "National Institute of Allergy and Infectious Diseases",
  "National Institute of General Medical Sciences",
  "National Institutes of Health",
  "under grant R01GM157729. RCSB PDB uses resources of the National Energy Research Scientific Computing Center (",
  "), a Department of Energy User Facility.",
  "of the",
  "December 1: World AIDS Day",
  "PDB-101 Focus: Biotechnology",
  "Image for December 1: World AIDS Day",
  "Image for PDB-101 Focus: Biotechnology",
  "Image for Harmonization of NMR Data Deposition: Adoption of unified NMR data and PDBx/mmCIF",
  "This entity has been grouped together with similar entities from other structures. Use the links below to navigate to the corresponding group pages and explore the characteristics of similar entities."
];
test("条目卫生：本轮新增词条 key 无中文/无换行/无连续空白，值无明文 URL 与邮箱", () => {
  for (const k of ADDED) {
    const v = dict.exact[k];
    assert.ok(v !== undefined, "缺条目: " + k);
    assert.doesNotMatch(k, CJK, "key 含中文: " + k);
    assert.equal(k, k.trim(), "key 首尾有空白: " + JSON.stringify(k));
    assert.equal(k, k.replace(/\s+/g, " "), "key 有连续空白: " + JSON.stringify(k));
    assert.doesNotMatch(k, /[\r\n]/, "key 含换行: " + JSON.stringify(k));
    assert.equal(v, v.trim(), "值首尾有空白: " + k);
    assert.doesNotMatch(v, /https?:\/\//i, "值含明文 URL: " + k);
    assert.doesNotMatch(v, /[\w.+-]+@[\w-]+\.[\w.]+/, "值含明文邮箱: " + k);
  }
});

// 真实页脚的节点边界：整段被 7 个 <a> 切成十来个文本节点，词条必须逐节点写，
// 整句当一条写永远匹配不到（PLAN「踩过的坑」里 ncbi/protfunc 的同类问题）。
const FOOTER_HTML =
  "<footer><p>RCSB PDB Core Operations are funded by the " +
  '<a href="https://www.nsf.gov">U.S. National Science Foundation</a>' +
  " (DBI-2321666), the " +
  '<a href="https://www.energy.gov">US Department of Energy</a>' +
  " (DE-SC0019749), and the " +
  '<a href="https://www.cancer.gov">National Cancer Institute</a>, ' +
  '<a href="https://www.niaid.nih.gov">National Institute of Allergy and Infectious Diseases</a>, and ' +
  '<a href="https://www.nigms.nih.gov">National Institute of General Medical Sciences</a> of the ' +
  '<a href="https://www.nih.gov">National Institutes of Health</a>' +
  " under grant R01GM157729. RCSB PDB uses resources of the National Energy Research Scientific Computing Center (" +
  '<a href="https://www.nersc.gov">NERSC</a>' +
  "), a Department of Energy User Facility.</p></footer>";

test("页脚资助声明：逐节点译完，整段不再残留英文机构名与连接词，链接全部保留", () => {
  const { doc } = engineFor(FOOTER_HTML);
  const p = text(doc.querySelector("footer p"));
  for (const zh of [
    "美国国家科学基金会",
    "资助编号 DBI-2321666",
    "美国能源部",
    "资助编号 DE-SC0019749",
    "美国国家癌症研究所",
    "美国国家过敏症和传染病研究所",
    "美国国家普通医学科学研究所",
    "美国国立卫生研究院",
    "资助编号 R01GM157729",
    "国家能源研究科学计算中心（NERSC）",
    "美国能源部的用户设施"
  ]) assert.ok(p.includes(zh), "缺中文片段「" + zh + "」: " + p);
  for (const en of ["National ", "Foundation", "Department of Energy", "under grant", "User Facility", "Core Operations"]) {
    assert.ok(!p.includes(en), "仍残留英文「" + en + "」: " + p);
  }
  assert.equal(doc.querySelectorAll("footer p a").length, 7, "链接节点不能丢");
  assert.equal(doc.querySelector("footer p a[href='https://www.nersc.gov']").textContent, "NERSC", "NERSC 链接文字保持原样");
});

test("结构页「实体分组」入口：aria-label 整句翻译（属性通道）", () => {
  const sentence =
    "This entity has been grouped together with similar entities from other structures. Use the links below to navigate to the corresponding group pages and explore the characteristics of similar entities.";
  const { doc } = engineFor('<main><a class="grp" aria-label="' + sentence + '" href="#group">i</a></main>');
  const got = doc.querySelector(".grp").getAttribute("aria-label");
  assert.ok(CJK.test(got), "aria-label 未翻译: " + got);
  assert.equal(got, dict.exact[sentence]);
  assert.ok(!/grouped together|similar entities from other structures/.test(got), "仍有英文: " + got);
});

test("首页新闻卡：12 月 1 日艾滋病日 / PDB-101 专题·生物技术 的标题与配图 alt", () => {
  const { doc } = engineFor(
    "<main>" +
    "<h3>December 1: World AIDS Day</h3>" +
    "<h3>PDB-101 Focus: Biotechnology</h3>" +
    '<img alt="Image for PDB-101 Focus: Biotechnology">' +
    '<img alt="Image for Harmonization of NMR Data Deposition: Adoption of unified NMR data and PDBx/mmCIF">' +
    '<img alt="Image for December 1: World AIDS Day">' +
    "</main>"
  );
  const h3 = [...doc.querySelectorAll("h3")].map(text);
  assert.equal(h3[0], "12 月 1 日：世界艾滋病日");
  assert.equal(h3[1], "PDB-101 专题：生物技术");
  const alts = [...doc.querySelectorAll("img")].map((i) => i.getAttribute("alt"));
  assert.equal(alts[0], "PDB-101 专题：生物技术的图片");
  assert.equal(alts[1], "NMR 数据存缴的统一：采用统一的 NMR 数据与 PDBx/mmCIF 的图片");
  assert.equal(alts[2], "12 月 1 日：世界艾滋病日的图片");
});

// 这些是"看起来该翻但不能翻"的：正文句子按块留英文（宁可留英文，不可半中半英），
// <sup> 碎片离开数字没有意义，品牌/物种/示例值属于数据。钉住它们，防止后来者硬塞半句译文。
test("边界项保持英文：正文句子片段、<sup> 碎片、品牌与示例值不单独翻", () => {
  for (const keep of [
    "Watch the documentary",
    "to learn about the challenge and emotional complexity of the fight to control HIV infection",
    "th",
    "MyPDB",
    "Homo sapiens",
    "Target Zero",
    "PDB-101 materials explore how researchers are using biology in industry"
  ]) assert.equal(anyEngine.translateText(keep), null, "不该被翻: " + keep);
});

test("of the 只在 rcsb 册内改成顿号，不污染 common/spa（跨册副作用检查）", () => {
  assert.equal(dict.exact["of the"], "、");
  assert.ok(!("of the" in common.exact), "common 不该有 of the");
  assert.ok(!("of the" in spa.exact), "spa 不该有 of the");
  assert.ok(!("of the" in rcsbHome.exact), "rcsb-home 不该有 of the");
});
