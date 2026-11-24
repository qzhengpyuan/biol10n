// r22 P2-2 零散缺词回归：BioStudies 下载菜单与关联信息、ENA 记录页 General/环境标签与读段工具悬浮提示、
// Expasy 帮助页检索字段、Rfam FAQ 四问、HPO 首页路线图与新闻/工具卡、AmiGO PubMed 检索说明句、
// ClinPGx hero 模板、Europe PMC 重要提示横幅与页脚链接。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const createEngine = new Function(fs.readFileSync(path.join(root, "../src/engine.js"), "utf8") + "; return createEngine;")();
const CJK = /[\u4e00-\u9fff]/;
const book = (id) => JSON.parse(fs.readFileSync(path.join(root, "../dict/" + id + ".json"), "utf8"));

// 本轮新增的条目：结构测试只对这些要求"值含汉字"，不替册内既有条目背书
// （例如 expasy 里既有的 "of" → "/" 是老的日期片段映射）。
const NEW_KEYS = {
  biostudies: ["[Cite]", "Preprint describing the project", "Link to ENA processed reads", "Data on users homepage"],
  ena: [
    "environment by taxonomy",
    "Download file report in json",
    "Download file report in tsv (Tab Separated Values)",
    "Download selected files in the browser",
    "Get download commands for all files in this column in a script",
    "Show read files report for this record"
  ],
  expasy: ["UniProt AC", "PDB ID", "RefSeq AC", "Ensembl ID", "ChEBI ID"],
  rfam: [
    "What are Rfam full alignments?",
    "How can I submit data to Rfam?",
    "What is a DESC file in Rfam?",
    "I want to access alignments in Stockholm format from the Rfam API."
  ],
  hpo: [
    "strategic roadmap",
    "13 driver projects",
    "Global Alliance for Genomics and Health",
    "October Data Update",
    "2.0.4 Medical Actions",
    "Exomiser",
    "Genomiser",
    "Profile Search",
    "Phenopackets"
  ],
  amigo: ["PubMed ID", "PubMed ID search", "takes you to summary information and all GO annotations for the"],
  pharmgkb: [],
  europepmc: [
    "Important Message",
    "We are sorry, we are unable to retrieve the citation details for this record.",
    "Bluesky",
    "YouTube"
  ]
};

// 站点条目以 config/sites.json 为准；父级还没加某个站时退回到同款最小配置。
const projected = {
  biostudies: { hosts: ["www.ebi.ac.uk"], dicts: ["common", "string-atlas", "string-atlas2", "biostudies"], scope: "body" },
  ena: { hosts: ["www.ebi.ac.uk"], dicts: ["common", "ena"], scope: "body", spa: true, waitFor: "#content app-root" },
  expasy: { hosts: ["www.expasy.org"], dicts: ["common", "expasy"], scope: "body" },
  rfam: { hosts: ["rfam.org", "docs.rfam.org"], dicts: ["common", "rfam"], scope: "body" },
  hpo: { hosts: ["hpo.jax.org"], dicts: ["common", "hpo"], scope: "body", spa: true },
  amigo: { hosts: ["amigo.geneontology.org"], dicts: ["common", "geneontology", "amigo"], scope: "body", spa: true },
  pharmgkb: { hosts: ["www.pharmgkb.org", "www.clinpgx.org"], dicts: ["common", "clingen", "clingen2", "pharmgkb"], scope: "body", spa: true },
  europepmc: { hosts: ["europepmc.org", "www.europepmc.org"], dicts: ["common", "europepmc"], scope: "body", attrs: ["value"], spa: true }
};
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const siteOf = (id) => {
  const cfg = sites.find((s) => s.id === id);
  return Object.assign({ id }, projected[id], cfg || {});
};

const dataCache = new Map();
function dataOf(id) {
  if (dataCache.has(id)) return dataCache.get(id);
  const site = siteOf(id);
  const data = { exact: {}, rules: [], templates: [] };
  for (const dictId of site.dicts || []) {
    const b = JSON.parse(fs.readFileSync(path.join(root, "../dict", dictId + ".json"), "utf8"));
    Object.assign(data.exact, b.exact || {});
    data.rules = data.rules.concat(b.rules || []);
    data.templates = data.templates.concat(b.templates || []);
  }
  dataCache.set(id, data);
  return data;
}
function run(siteId, html, extra) {
  const site = Object.assign(siteOf(siteId), extra || {});
  const dom = new JSDOM("<body>" + html + "</body>");
  const engine = createEngine({ document: dom.window.document, window: dom.window, data: dataOf(siteId), site });
  engine.start();
  return dom.window.document;
}
const text = (doc) => doc.body.textContent.replace(/\s+/g, " ").trim();

test("词库结构：八册条目可解析、键值形态合法、规则与模板可用", () => {
  const floors = { biostudies: 232, ena: 493, expasy: 177, rfam: 306, hpo: 145, amigo: 141, pharmgkb: 73, europepmc: 237 };
  for (const [id, floor] of Object.entries(floors)) {
    const b = book(id);
    assert.ok(Object.keys(b.exact).length >= floor, id + " exact 至少 " + floor + " 条");
    for (const [k, v] of Object.entries(b.exact)) {
      assert.ok(!CJK.test(k), id + " 键里不能有中文: " + k);
      assert.notEqual(k, v, id + " 自映射: " + k);
      assert.equal(k, k.trim(), id + " 键首尾不能有空白: " + JSON.stringify(k));
      assert.equal(v, String(v).trim(), id + " 译文首尾不能有空白: " + k);
      assert.ok(!/https?:\/\/[^\s）]+\.[a-z]/i.test(v), id + " 译文里不能有明文 URL: " + k);
      assert.ok(!/@[\w.-]+\.[a-z]/i.test(v), id + " 译文里不能有邮箱: " + k);
    }
    for (const k of NEW_KEYS[id] || []) {
      assert.ok(b.exact[k] !== undefined, id + " 缺新条目: " + k);
      assert.ok(CJK.test(b.exact[k]), id + " 新条目译文里必须有中文: " + k);
      assert.notEqual(k, b.exact[k], id + " 新条目不能自映射: " + k);
    }
    for (const r of b.rules || []) {
      assert.ok(new RegExp(r.re).source.length > 0, id + " 规则要能编译: " + r.re);
      assert.ok(CJK.test(r.to), id + " 规则译文里必须有中文: " + r.re);
    }
    for (const t of b.templates || []) {
      const used = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
      assert.ok(used.length >= 1, id + " 模板要带槽位: " + t.pat);
      assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, id + " 模板长度越界: " + t.pat.length);
      const sorted = used.slice().sort((a, b) => a - b);
      sorted.forEach((n, i) => assert.equal(n, i + 1, id + " 槽位必须从 1 连续: " + t.pat));
      const zhUsed = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
      assert.deepEqual(zhUsed.slice().sort((a, b) => a - b), sorted, id + " 译文槽位要与原文一致");
    }
  }
  const ena = book("ena");
  // exact 里 General 已有 gdc/gepia2/ncbi-help 三种译法，直接加键会多一组跨册冲突；改走本册规则。
  const generalRule = ena.rules.find((r) => /^\^General\(/.test(r.re));
  assert.ok(generalRule, "ENA 的 General 段标题走规则");
  assert.ok(generalRule.to.startsWith("概要"), "规则译文: " + generalRule.to);
  assert.ok(/\$1/.test(generalRule.to), "ena 册的规则必须用到捕获组（既有测试的约定）");
});

test("BioStudies 研究页：[Cite] 与关联信息三条链接描述", () => {
  const doc = run(
    "biostudies",
    '<div id="download-source"><a id="cite" title="Cite" class="source-icon source-icon-cite openModal">[Cite]</a>' +
      '<a href="https://x/S-BSST1.json" title="Download Study as JSON">{JSON}</a></div>' +
      "<table><tbody>" +
      '<tr><td><a href="http://biorxiv.org/content/early/2016/06/14/050237">http://biorxiv.org/content/early/2016/06/14/050237</a></td><td><span>Preprint describing the project</span></td></tr>' +
      '<tr><td><a href="http://www.ebi.ac.uk/ena/data/view/PRJEB14304">http://www.ebi.ac.uk/ena/data/view/PRJEB14304</a></td><td><span>Link to ENA processed reads</span></td></tr>' +
      '<tr><td><a href="http://lungen.bioinformatics.ic.ac.uk/data/">http://lungen.bioinformatics.ic.ac.uk/data/</a></td><td><span>Data on users homepage</span></td></tr>' +
      "</tbody></table>"
  );
  const t = text(doc);
  assert.ok(t.includes("[引用]"), t);
  assert.ok(t.includes("描述该项目的预印本"), t);
  assert.ok(t.includes("链接到 ENA 处理后的读段"), t);
  assert.ok(t.includes("用户主页上的数据"), t);
  assert.ok(!/Preprint describing the project|Link to ENA processed reads|Data on users homepage/.test(t), "三条描述不该留英文: " + t);
  assert.equal(doc.querySelector("#cite").getAttribute("title"), "引用", "title 通道复用 common 的 Cite");
  assert.equal(doc.querySelectorAll("table td a")[0].getAttribute("href"), "http://biorxiv.org/content/early/2016/06/14/050237", "URL 不动");
});

test("ENA 记录页：General 段标题、environment by taxonomy、按钮文案", () => {
  const doc = run(
    "ena",
    '<span class="section-heading">General</span><span>environment by taxonomy</span>' +
      '<button title="Download selected files in the browser">Download selected files</button>' +
      '<button title="Get download commands for all files in this column in a script">Get download script</button>' +
      '<button title="Show read files report for this record">Show More Read Files</button>'
  );
  const t = text(doc);
  assert.ok(t.includes("概要"), "General 段标题走规则: " + t);
  assert.ok(t.includes("按分类学的环境"), t);
  assert.ok(t.includes("下载选中文件"), t);
  assert.ok(t.includes("获取下载脚本"), t);
  const btns = [...doc.querySelectorAll("button")];
  assert.equal(btns[0].getAttribute("title"), "在浏览器中下载选中文件");
  assert.equal(btns[1].getAttribute("title"), "获取此列全部文件的下载命令脚本");
  assert.equal(btns[2].getAttribute("title"), "显示此记录的读段文件报告");
});

test("ENA 悬浮提示的真实载体是 mattooltip：当前 config 未声明 attrs，默认通道翻不到", () => {
  const ena = book("ena");
  for (const s of [
    "Download file report in json",
    "Download file report in tsv (Tab Separated Values)",
    "Download selected files in the browser",
    "Get download commands for all files in this column in a script",
    "Show read files report for this record"
  ]) {
    assert.ok(ena.exact[s] && CJK.test(ena.exact[s]), "词库要收录: " + s);
  }
  // 引擎默认 attrs = placeholder / title / aria-label / alt / data-original-title；
  // 站点没有声明 attrs 时只用这套默认值，而 ENA 这五条挂在 Angular Material 的 mattooltip 上。
  const cfgAttrs = (sites.find((s) => s.id === "ena") || {}).attrs || [];
  const live = run("ena", '<button mattooltip="Download file report in json">JSON</button>');
  if (cfgAttrs.includes("mattooltip")) {
    // 配置补齐之后：线上即时生效（这条断言是"缺口被填上"的验收点）。
    assert.equal(live.querySelector("button").getAttribute("mattooltip"), "以 JSON 格式下载文件报告");
  } else {
    // 当前 config 未声明 attrs：默认通道（placeholder/title/aria-label/alt/data-original-title）碰不到 mattooltip。
    assert.equal(live.querySelector("button").getAttribute("mattooltip"), "Download file report in json", "默认通道不碰 mattooltip");
    // 同一份词库在 attrs 声明了 mattooltip 时立刻生效——回信里的结论依据。
    const withAttr = run("ena", '<button mattooltip="Download file report in json">JSON</button>', { attrs: ["mattooltip"] });
    assert.equal(withAttr.querySelector("button").getAttribute("mattooltip"), "以 JSON 格式下载文件报告");
  }
  const tsv = run("ena", '<button mattooltip="Download file report in tsv (Tab Separated Values)">TSV</button>', { attrs: ["mattooltip"] });
  assert.equal(tsv.querySelector("button").getAttribute("mattooltip"), "以 TSV（制表符分隔值）格式下载文件报告");
});

test("Expasy 帮助页：五个检索字段标签", () => {
  const doc = run("expasy", "<ul><li><span>UniProt AC</span></li><li><span>PDB ID</span></li><li><span>RefSeq AC</span></li><li><span>Ensembl ID</span></li><li><span>ChEBI ID</span></li></ul>");
  const items = [...doc.querySelectorAll("li span")].map((s) => s.textContent);
  assert.deepEqual(items, ["UniProt 登录号", "PDB 编号", "RefSeq 登录号", "Ensembl 编号", "ChEBI 编号"]);
});

test("Rfam FAQ：四问整句", () => {
  const doc = run(
    "rfam",
    "<h3>What are Rfam full alignments?</h3><h3>How can I submit data to Rfam?</h3>" +
      "<h3>What is a DESC file in Rfam?</h3>" +
      "<p>I want to access alignments in Stockholm format from the Rfam API.</p>"
  );
  const t = text(doc);
  assert.ok(t.includes("什么是 Rfam 完整比对（FULL 比对）？"), t);
  assert.ok(t.includes("如何向 Rfam 提交数据？"), t);
  assert.ok(t.includes("Rfam 中的 DESC 文件是什么？"), t);
  assert.ok(t.includes("我想通过 Rfam API 获取 Stockholm 格式的比对。"), t);
});

test("HPO 首页：GA4GH 路线图句、两条新闻标题、四张工具卡", () => {
  const doc = run(
    "hpo",
    '<p>The HPO is a central component of one of the <strong>13 driver projects</strong> in the ' +
      '<a href="https://www.ga4gh.org/">Global Alliance for Genomics and Health</a> (GA4GH) <a href="/roadmap">strategic roadmap</a>.</p>' +
      '<div class="news"><h3>October Data Update</h3><h3>2.0.4 Medical Actions</h3></div>' +
      '<div class="tools"><h4>Exomiser</h4><h4>Genomiser</h4><h4>Profile Search</h4><h4>Phenopackets</h4></div>'
  );
  const t = text(doc);
  assert.ok(t.includes("13 个驱动项目"), t);
  assert.ok(t.includes("全球基因组学与健康联盟"), t);
  assert.ok(t.includes("战略路线图"), t);
  assert.ok(t.includes("10 月数据更新"), t);
  assert.ok(t.includes("2.0.4 医学处置"), t);
  assert.ok(t.includes("Exomiser 外显子组分析工具"), t);
  assert.ok(t.includes("Genomiser 基因组分析工具"), t);
  assert.ok(t.includes("表型谱检索"), t);
  assert.ok(t.includes("Phenopackets 表型数据包"), t);
  assert.equal(doc.querySelector("a").getAttribute("href"), "https://www.ga4gh.org/", "链接不动");
});

test("AmiGO 首页：PubMed 检索说明句（strong + 链接夹断也能成句）", () => {
  const doc = run(
    "amigo",
    '<div class="panel-body"><img src="/static/images/library.50.png" alt="[PMID Search]">' +
      "<strong>PubMed ID search</strong> takes you to summary information and all GO annotations for the " +
      '<a href="https://pubmed.ncbi.nlm.nih.gov/">PubMed ID</a>.</div>'
  );
  const t = text(doc);
  assert.ok(t.includes("PubMed 编号检索"), t);
  assert.ok(t.includes("将带你前往摘要信息与该编号的全部 GO 注释"), t);
  assert.ok(!/takes you to summary information/.test(t), "说明句不该留英文: " + t);
  assert.equal(doc.querySelector("a").getAttribute("href"), "https://pubmed.ncbi.nlm.nih.gov/");
  assert.equal(doc.querySelector("img").getAttribute("alt"), "[PMID 检索]", "图标 alt 属 UI 说明，与说明句一同中文化");
});

test("ClinPGx hero：模板整段替换，彩色品牌 span 保留", () => {
  const b = book("pharmgkb");
  const tpl = (b.templates || []).find((t) => /is a comprehensive resource supporting/.test(t.pat));
  assert.ok(tpl, "hero 模板要在册");
  assert.ok(/\{\{1\}\}\{\{2\}\}/.test(tpl.pat), "模板要带品牌槽位");
  const doc = run(
    "pharmgkb",
    '<p><span class="blue">Clin</span><span class="red">PGx</span> is a comprehensive resource supporting the clinical implementation of ' +
      "pharmacogenomics (PGx), the study of how genetic variation affects medication response. We provide expert curation of PGx genes, " +
      "variants, drugs, and gene\u2013drug relationships, plus guidelines and tools that make PGx accessible, understandable, and actionable " +
      "in clinical practice. ClinPGx is home to the Clinical Pharmacogenetics Implementation Consortium (" +
      '<span class="red">CPI</span><span class="blue">C</span>).</p>'
  );
  const p = doc.querySelector("p");
  const t = text(doc);
  assert.equal(p.getAttribute("data-biol10n-tpl"), "1", "走模板通道: " + p.outerHTML);
  assert.ok(/综合/.test(t), t);
  assert.ok(t.includes("临床药物遗传学实施联盟"), t);
  assert.equal(doc.querySelectorAll("span.blue").length, 2, "品牌 span 不丢");
  assert.equal(doc.querySelectorAll("span.red").length, 2, "品牌 span 不丢");
  assert.ok(!/is a comprehensive resource/.test(t), "hero 不该留英文: " + t);
});

test("Europe PMC：重要提示横幅、致歉句、页脚关注链接与合作段落", () => {
  const doc = run(
    "europepmc",
    '<div class="important-message"><h4>Important Message</h4>' +
      "<p>We are sorry, we are unable to retrieve the citation details for this record.</p></div>" +
      '<p class="h2">Follow us</p>' +
      '<a href="http://blog.europepmc.org/" class="action"><i class="fas fa-blog"></i><br>News blog</a>' +
      '<a href="//europepmc.github.io/techblog/" class="action"><i class="fas fa-cogs"></i><br>Technical blog</a>' +
      '<a href="https://bsky.app/profile/europepmc.org" class="action"><i class="fas fa-bluesky"></i><br>Bluesky</a>' +
      '<a href="//www.youtube.com/user/EuropePMC" class="action"><i class="fas fa-youtube"></i><br>YouTube</a>' +
      // 站点把 .partnership-and-funding 写进 proseExempt，这段页脚说明才不会被长正文保护跳过
      '<div class="partnership-and-funding"><p>Europe PMC is developed by <a href="https://www.ebi.ac.uk/">EMBL-EBI</a> with support from the ' +
      "<a href=\"https://europepmc.org/Funders/\">Europe PMC Funders' Group</a>, in collaboration with the " +
      '<a href="https://www.nlm.nih.gov/">National Library of Medicine (NLM)</a>, as part of the ' +
      '<a href="https://www.ncbi.nlm.nih.gov/pmc/about/pmci/">PubMed Central International</a> archive network.</p></div>'
  );
  const t = text(doc);
  assert.ok(t.includes("重要提示"), t);
  assert.ok(t.includes("抱歉，我们无法获取该记录的引文详情。"), t);
  assert.ok(t.includes("关注我们"), t);
  assert.ok(t.includes("新闻博客") && t.includes("技术博客"), t);
  assert.ok(t.includes("Bluesky 社交平台"), t);
  assert.ok(t.includes("YouTube 视频平台"), t);
  // 页脚合作段落由既有模板整段翻，机构名按站点惯例保持原文（europepmc.test.mjs 已定下这条口径）。
  assert.ok(t.includes("Europe PMC 由") && t.includes("存档网络的一部分"), "合作段落模板: " + t);
  assert.ok(t.includes("EMBL-EBI") && t.includes("National Library of Medicine (NLM)"), "机构名保持原文: " + t);
  assert.ok(t.includes("Europe PMC 资助方小组"), t);
  assert.ok(!/Important Message|We are sorry/.test(t), "横幅不该留英文: " + t);
  assert.deepEqual([...doc.querySelectorAll("a")].map((a) => a.getAttribute("href")), [
    "http://blog.europepmc.org/",
    "//europepmc.github.io/techblog/",
    "https://bsky.app/profile/europepmc.org",
    "//www.youtube.com/user/EuropePMC",
    "https://www.ebi.ac.uk/",
    "https://europepmc.org/Funders/",
    "https://www.nlm.nih.gov/",
    "https://www.ncbi.nlm.nih.gov/pmc/about/pmci/"
  ], "href 一律不动");
});

test("不该翻的：登录号、文件名、姓名、机构名", () => {
  const doc = run(
    "biostudies",
    '<ul class="kept"><li>S-BSST1</li><li>LAMB_denoised_reads.fna</li><li>Dr Michael Cox</li>' +
      "<li>Imperial College London</li><li>PMC516016</li><li>E-MTAB-8373</li></ul>"
  );
  const items = [...doc.querySelectorAll(".kept li")].map((li) => li.textContent);
  assert.deepEqual(items, ["S-BSST1", "LAMB_denoised_reads.fna", "Dr Michael Cox", "Imperial College London", "PMC516016", "E-MTAB-8373"]);
});