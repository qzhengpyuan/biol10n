// r44 EBI 家族剩余英文补译校验（15 册 + 真实 DOM 片段渲染）
// 片段来源（2026-11-24 用 CDP 9227 打开页面，先 window.__BIOL10N.disable() 再取 outerHTML）：
//   alphafold  https://alphafold.ebi.ac.uk/entry/P00533
//   amigo      https://amigo.geneontology.org/amigo
//   biomart    https://grch37.ensembl.org/biomart/martview
//   biostudies https://www.ebi.ac.uk/biostudies/studies/S-EPMC516016
//   ebi-home   https://www.ebi.ac.uk/about
//   ena        https://www.ebi.ac.uk/ena/browser/search
//   expasy     https://www.expasy.org/
//   geneontology https://geneontology.org/docs/download-annotations/（站点 404 页）
//   interpro   https://www.ebi.ac.uk/interpro/search/text/p53/
//   nextprot   https://www.expasy.org/archives/nextprot
//   pdbe       https://www.ebi.ac.uk/pdbe/entry/search/index?text=1cbs
//   pride      https://www.ebi.ac.uk/pride/archive?keyword=spike
//   reactome   https://reactome.org/documentation
//   rfam       https://rfam.org/search?q=5S
//   uniprot2   https://www.uniprot.org/uniprotkb/P04637/entry
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

const BOOKS = [
  "ebi-home", "interpro", "pride", "ena", "biostudies", "reactome", "alphafold", "pdbe",
  "europepmc", "expasy", "uniprot2", "nextprot", "rfam", "amigo", "geneontology", "biomart"
];
const dicts = {};
for (const id of BOOKS) dicts[id] = JSON.parse(fs.readFileSync(path.join(root, "../dict/" + id + ".json"), "utf8"));

// uniprot2 挂在 uniprot 站；其余册同名
const SITE_OF = { uniprot2: "uniprot", "ebi-home": "embl-ebi" };
function siteOf(id) {
  const siteId = SITE_OF[id] || id;
  const site = sites.find((s) => s.id === siteId);
  assert.ok(site, "sites.json 缺少站点：" + siteId);
  // 关掉 SPA 轮询与延迟补扫，避免定时器拖住测试进程
  return { ...site, spa: false, rescan: false };
}
function mount(id, html, url) {
  const d = dicts[id];
  const dom = new JSDOM("<body>" + html + "</body>", { url: url || "https://www.ebi.ac.uk/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: d.exact, rules: d.rules, templates: d.templates },
    site: siteOf(id)
  });
  engine.start();
  return dom.window.document;
}
function applyRule(id, text) {
  for (const r of dicts[id].rules || []) {
    const m = new RegExp(r.re).exec(text);
    if (m) return r.to.replace(/\$(\d)/g, (_, d) => m[Number(d)] ?? "");
  }
  return null;
}

// ---------------- ① 词库结构 ----------------

test("15 册词库可解析，exact 有内容", () => {
  for (const id of BOOKS) {
    const d = dicts[id];
    assert.equal(typeof d.meta, "object", id + " 缺 meta");
    assert.ok(Object.keys(d.exact || {}).length > 0, id + " exact 为空");
    assert.ok(Array.isArray(d.rules), id + " 缺 rules");
    assert.ok(Array.isArray(d.templates), id + " 缺 templates");
  }
});

const NEW_KEYS = {
  "ebi-home": {
    "Our culture": "我们的文化",
    "What are EMBL-EBI's missions?": "EMBL-EBI 的使命是什么？",
    "We provide freely available data and bioinformatics services.": "我们提供可自由获取的数据与生物信息学服务。",
    "Leadership": "领导团队",
    "Enabling genomic medicine": "推动基因组医学"
  },
  interpro: {
    "TextSearch": "文本检索",
    "What kinds of information can be searched with InterPro text search?": "InterPro 文本检索可以搜索哪些类型的信息？"
  },
  pride: {
    "Connections": "关联",
    "Reanalyses": "再分析",
    "Disease free": "无疾病",
    "prideArchiveType:": "PRIDE 存档类型："
  },
  ena: {
    "xref": "交叉引用",
    "The European Nucleotide Archive (ENA)": "欧洲核苷酸档案库（ENA）"
  },
  biostudies: {
    "FTP": "FTP 下载",
    "Data Submission Portal": "数据提交门户",
    "Translational quantitative systems toxicology": "转化定量系统毒理学"
  },
  reactome: {
    "For Users": "面向用户",
    "Tutorial workshop": "教程工作坊",
    "Get Started": "开始使用",
    "Pathways and Networks Overview": "通路与网络概览"
  },
  alphafold: {
    "Reviewed": "已审阅",
    "Interface quality": "界面质量",
    "Homodimer": "同源二聚体",
    "Heterodimer": "异源二聚体",
    "Search results (max 10 000)": "检索结果（最多 10 000 条）"
  },
  pdbe: {
    "Search filters :": "检索筛选：",
    "Current:": "当前：",
    "X-ray diffraction": "X 射线衍射",
    "Compounds": "化合物"
  },
  expasy: {
    "Database of molecular replacements for ligand design": "配体设计用分子替换数据库",
    "Pharmacokinetics properties and druglikeness": "药代动力学性质与类药性",
    "Protein model quality estimation": "蛋白质模型质量评估"
  },
  uniprot2: {
    "Isoform": "异构体",
    "Strongly reduced phosphorylation.": "磷酸化显著降低。",
    "Constitutively activated kinase.": "激酶持续激活。"
  },
  nextprot: {},
  amigo: {
    "[Search]": "[检索]",
    "[Statistics]": "[统计]",
    "Your genes here...": "在此输入你的基因……",
    "Search for annotations, term, and gene products for the inputted text.": "按输入文本检索注释、术语与基因产物。"
  },
  geneontology: {
    "Oops, that's a no GO !": "哎呀，这里没有 GO！",
    "(404 Page Not Found)": "（404 页面未找到）",
    "Powered by": "技术支持",
    "Site search": "站内检索"
  },
  biomart: {
    "None selected": "未选择",
    "Search terms": "检索词"
  }
};

test("新键存在、含汉字、与原键不同", () => {
  for (const [id, want] of Object.entries(NEW_KEYS)) {
    const d = dicts[id];
    for (const [k, v] of Object.entries(want)) {
      assert.equal(d.exact[k], v, id + " 缺少或值不符：" + k);
      assert.notEqual(k, v, id + " 自映射：" + k);
      assert.match(v, /[\u4e00-\u9fff]/, id + " 译文无汉字：" + k);
    }
  }
});

test("新增键跨册同键同译文（不制造 dict-lint 冲突）", () => {
  const all = {};
  for (const f of fs.readdirSync(path.join(root, "../dict")).filter((x) => x.endsWith(".json"))) {
    all[f.replace(/\.json$/, "")] = JSON.parse(fs.readFileSync(path.join(root, "../dict", f), "utf8"));
  }
  for (const [id, want] of Object.entries(NEW_KEYS)) {
    for (const [k, v] of Object.entries(want)) {
      for (const [book, d] of Object.entries(all)) {
        if (book === id || !d.exact || !Object.prototype.hasOwnProperty.call(d.exact, k)) continue;
        assert.equal(d.exact[k], v, "跨册同键异译：" + k + "（" + book + " vs " + id + "）");
      }
    }
  }
});

// ---------------- ② 真实 DOM 片段渲染 ----------------

test("AlphaFold 结构页：界面质量/Reviewed/聚合体计数变中文", () => {
  const doc = mount(
    "alphafold",
    '<div class="resultLeftCol columns leftcol-container">Interface quality </div>' +
      '<div class="label-tooltip badgeSvgFirst"><img alt="reviewed" src="assets/img/reviewed.svg" class="badgeSvg">' +
      '<span class="label-tooltip-text hide-for-small-only"> Reviewed </span></div>' +
      '<ul class="vf-list entry-type-sub-list"><li class="vf-list__item-facet"><a class="vf-link"> Homodimers (1) </a></li></ul>' +
      '<div class="text-block">2 copies of P00533-2</div>' +
      '<div class="text-block">1 copy of Q8WWG1</div>',
    "https://alphafold.ebi.ac.uk/entry/P00533"
  );
  const t = doc.body.textContent.replace(/\s+/g, " ");
  assert.match(t, /界面质量/);
  assert.match(t, /已审阅/);
  assert.match(t, /同源二聚体（1）/);
  assert.match(t, /P00533-2 的 2 个副本/);
  assert.match(t, /Q8WWG1 的 1 个副本/);
});

test("PRIDE 检索页：Connections/Reanalyses 与采集方式枚举变中文", () => {
  const doc = mount(
    "pride",
    '<span data-v-5ae9759b="">Connections</span><span data-v-5ae9759b="">Reanalyses</span>' +
      '<label class="ivu-checkbox-wrapper"><span class="ivu-checkbox-inner"></span><input type="checkbox" class="ivu-checkbox-input">' +
      '<span class="ivu-checkbox-label-text"><span class="facet-value-label" title="Data-dependent acquisition">Data-dependent acquisition</span></span></label>' +
      '<div class="facet-value-label">Bottom-up proteomics</div>' +
      '<div class="dataset-count">· 1,413 datasets</div>',
    "https://www.ebi.ac.uk/pride/archive?keyword=spike"
  );
  const t = doc.body.textContent.replace(/\s+/g, " ");
  assert.match(t, /关联/);
  assert.match(t, /再分析/);
  assert.match(t, /Data-dependent acquisition/, "采集方式枚举是 PRIDE 受控值，保持英文");
  assert.match(t, /Bottom-up proteomics/, "实验类型值保持英文");
  assert.doesNotMatch(t, /数据依赖型采集|自下而上蛋白质组学/);
  assert.match(t, /· 1,413 个数据集/);
});

test("PDBe 检索页与 InterPro 检索页：筛选标题、卡片标签变中文", () => {
  const pdbe = mount(
    "pdbe",
    '<h4 _ngcontent-ng-c328729662="">Search filters :</h4>' +
      '<div class="noResultText"><strong _ngcontent-ng-c2731079154="">Use \'Advanced search\' form to search Entries</strong></div>',
    "https://www.ebi.ac.uk/pdbe/entry/search/index?text=1cbs"
  );
  assert.match(pdbe.body.textContent, /检索筛选：/);
  assert.match(pdbe.body.textContent, /使用“高级检索”表单检索条目/);

  const ipr = mount(
    "interpro",
    '<div class="card-tag Card_styles__card-tag___bf tag-tool Card_styles__tag-tool___dd">TextSearch</div>',
    "https://www.ebi.ac.uk/interpro/search/text/p53/"
  );
  assert.match(ipr.body.textContent, /文本检索/);
});

test("AmiGO 首页：图标 alt / 输入框 title 与 placeholder 变中文", () => {
  const doc = mount(
    "amigo",
    '<img src="/static/images/magnifying-glass.50.png" title="Advanced Search page." class="img-rounded img-responsive amigo-landing-img" alt="[Search]">' +
      '<textarea id="landing_gene_input" class="form-control" rows="2" name="input" placeholder="Your genes here..."></textarea>' +
      '<input type="text" title="Input any PubMed ID (e.g. PMID:123456)." class="form-control" name="ref_id" placeholder="E.g. PMID:123456" value="" id="reference-search-query">',
    "https://amigo.geneontology.org/amigo"
  );
  assert.equal(doc.querySelector("img").getAttribute("alt"), "[检索]");
  assert.equal(doc.querySelector("img").getAttribute("title"), "高级检索页面。");
  assert.equal(doc.querySelector("textarea").getAttribute("placeholder"), "在此输入你的基因……");
  assert.equal(doc.querySelector("input[type=text]").getAttribute("placeholder"), "例如 PMID:123456");
  assert.equal(doc.querySelector("input[type=text]").getAttribute("title"), "输入任意 PubMed ID（例如 PMID:123456）。");
});

test("BioMart / BioStudies / neXtProt / EBI 关于页 / Expasy：真实片段渲染", () => {
  const bm = mount(
    "biomart",
    '<a id="new_button_tag" class="mart_btn_new" title="Start a new query">New</a>' +
      '<td width="100%" height="100%" valign="top" align="left">None selected</td>',
    "https://www.ensembl.org/biomart/martview"
  );
  assert.match(bm.body.textContent, /新建/);
  assert.match(bm.body.textContent, /未选择/);

  const bs = mount(
    "biostudies",
    '<a id="ftp-link" href="ftp://ftp.ebi.ac.uk/pub/databases/biostudies/S-EPMC/016/S-EPMC516016" target="_blank" title="Open FTP Folder" class="source-icon source-icon-ftp">FTP</a>' +
      '<div class="collection-desc">Translational quantitative systems toxicology</div>',
    "https://www.ebi.ac.uk/biostudies/studies/S-EPMC516016"
  );
  assert.match(bs.body.textContent, /FTP 下载/);
  assert.match(bs.body.textContent, /转化定量系统毒理学/);

  const nx = mount(
    "nextprot",
    '<a href="https://hppportal.net/" target="_blank">HPP Portal</a>' +
      '<a href="https://www.uniprot.org/uniprotkb?query=Human&amp;facets=model_organism%3A9606%2Creviewed%3Atrue" target="_blank">human reviewed (Swiss-Prot) data</a>',
    "https://www.expasy.org/archives/nextprot"
  );
  assert.match(nx.body.textContent, /HPP Portal/, "HPP Portal 是项目名，保留英文");
  assert.match(nx.body.textContent, /human reviewed \(Swiss-Prot\) data/, "数据源描述整句保留");

  const ebi = mount(
    "ebi-home",
    '<a href="/about/our-culture" class="vf-navigation__link">Our culture</a>' +
      '<h2 class="vf-section-header__heading">\n      \n          What are EMBL-EBI\'s missions?      </h2>' +
      '<p class="wp-block-paragraph"><strong>We provide freely available data and bioinformatics services.</strong></p>',
    "https://www.ebi.ac.uk/about"
  );
  assert.match(ebi.body.textContent, /我们的文化/);
  assert.match(ebi.body.textContent, /EMBL-EBI 的使命是什么？/);
  assert.match(ebi.body.textContent, /我们提供可自由获取的数据与生物信息学服务。/);

  const ex = mount(
    "expasy",
    '<div class="text-sm leading-snug mt-1">Database of molecular replacements for ligand design</div>' +
      '<div class="text-sm leading-snug mt-1">Pharmacokinetics properties and druglikeness</div>',
    "https://www.expasy.org/"
  );
  assert.match(ex.body.textContent, /配体设计用分子替换数据库/);
  assert.match(ex.body.textContent, /药代动力学性质与类药性/);
});

test("Reactome / Gene Ontology / ENA：文档页与 404 页真实片段", () => {
  const rct = mount(
    "reactome",
    '<a href="/userguide" target="_self" style="color: #FFFFFF;">\n\n              For Users\n            </a>' +
      '<a href="/docs/training/Reactome_Website.pdf"><span>Tutorial workshop</span></a>',
    "https://reactome.org/documentation"
  );
  assert.match(rct.body.textContent, /面向用户/);
  assert.match(rct.body.textContent, /教程工作坊/);

  const go = mount(
    "geneontology",
    '<h1>Oops, that\'s a no GO !</h1><p>(404 Page Not Found)</p>' +
      '<i style="width: 100%; display: block; font-size: 14px;">Powered by <a href="https://pantherdb.org" style="color: white" target="blank">PANTHER</a></i>',
    "https://geneontology.org/docs/download-annotations/"
  );
  const goText = go.body.textContent.replace(/\s+/g, " ");
  assert.match(goText, /哎呀，这里没有 GO！/);
  assert.match(goText, /（404 页面未找到）/);
  assert.match(goText, /技术支持/);

  const ena = mount(
    "ena",
    '<div class="elixir-banner"><span class="elixir-banner-name">The European Nucleotide Archive (ENA)</span></div>',
    "https://www.ebi.ac.uk/ena/browser/search"
  );
  assert.match(ena.body.textContent, /欧洲核苷酸档案库（ENA）/);
});

test("UniProt 条目页：变异效应标准短语与 Isoform 标签", () => {
  // 取自 https://www.uniprot.org/uniprotkb/P00533/entry 与 P04637/entry 的变异表与同工型列表
  const doc = mount(
    "uniprot2",
    '<div class="variants-table"><div>Strongly reduced phosphorylation.</div><div>Reduced phosphorylation.</div>' +
      '<div>Constitutively activated kinase.</div></div>' +
      '<div class="isoform-label"><span>Isoform</span></div>',
    "https://www.uniprot.org/uniprotkb/P04637/entry"
  );
  const t = doc.body.textContent;
  assert.match(t, /磷酸化显著降低。/);
  assert.match(t, /磷酸化降低。/);
  assert.match(t, /激酶持续激活。/);
  assert.match(t, /异构体/);
  assert.ok(!/Strongly reduced phosphorylation/.test(t), "标准短语应整条命中");
});

test("规则按实测原文改写（AlphaFold 聚合体 / PRIDE 计数 / Rfam 结构图 alt）", () => {
  assert.equal(applyRule("alphafold", "Homodimers (1)"), "同源二聚体（1）");
  assert.equal(applyRule("alphafold", "Heterodimers (5)"), "异源二聚体（5）");
  assert.equal(applyRule("alphafold", "Multimers (6)"), "多聚体（6）");
  assert.equal(applyRule("alphafold", "1 copy of P00533"), "P00533 的 1 个副本");
  assert.equal(applyRule("alphafold", "2 copies of P00533-2"), "P00533-2 的 2 个副本");
  assert.equal(applyRule("pride", "· 1,413 datasets"), "· 1,413 个数据集");
  assert.equal(applyRule("rfam", "RF00001 secondary structure"), "RF00001 二级结构");

  const rfam = mount("rfam", '<img alt="RF00001 secondary structure" src="/img/a.png">', "https://rfam.org/family/RF00001");
  assert.equal(rfam.querySelector("img").getAttribute("alt"), "RF00001 二级结构");

  // 规则不外溢
  assert.equal(applyRule("alphafold", "Homodimers of EGFR"), null);
  assert.equal(applyRule("alphafold", "P00533-2"), null);
  assert.equal(applyRule("pride", "1413 datasets"), "1413 个数据集"); // 只吃带 · 的词条与无前缀短语
  assert.equal(applyRule("rfam", "RF00001"), null);
});

// ---------------- ③ 负例：数据/专名保持英文 ----------------

test("负例：登录号、蛋白名、物种名、文件名、DOI 保持英文", () => {
  const af = mount(
    "alphafold",
    '<div class="entry-id">P00533</div><div class="protein-name">Epidermal growth factor receptor</div>' +
      '<div class="organism">Homo sapiens</div><div class="complex">2 copies of P00533</div>',
    "https://alphafold.ebi.ac.uk/entry/P00533"
  );
  assert.equal(af.querySelector(".entry-id").textContent, "P00533");
  assert.equal(af.querySelector(".protein-name").textContent, "Epidermal growth factor receptor");
  assert.equal(af.querySelector(".organism").textContent, "Homo sapiens");

  const pr = mount(
    "pride",
    '<div class="accession">PXD000001</div>' +
      '<div class="file">TMT_Erwinia_1uLSike_Top10HCD_isol2_45stepped_60min_01.raw</div>' +
      '<div class="doi">10.6019/PXD000001</div>',
    "https://www.ebi.ac.uk/pride/archive/projects/PXD000001"
  );
  assert.equal(pr.querySelector(".accession").textContent, "PXD000001");
  assert.equal(pr.querySelector(".file").textContent, "TMT_Erwinia_1uLSike_Top10HCD_isol2_45stepped_60min_01.raw");
  assert.equal(pr.querySelector(".doi").textContent, "10.6019/PXD000001");

  const bs = mount(
    "biostudies",
    '<a title="1471-2105-5-109-S1.eps">1471-2105-5-109-S1.eps</a><div class="species">Homo sapiens</div>',
    "https://www.ebi.ac.uk/biostudies/studies/S-EPMC516016"
  );
  assert.equal(bs.querySelector("a").textContent, "1471-2105-5-109-S1.eps");
  assert.equal(bs.querySelector(".species").textContent, "Homo sapiens");

  const ipr = mount("interpro", '<span class="acc">IPR000001</span><div class="name">Kringle</div>', "https://www.ebi.ac.uk/interpro/entry/InterPro/IPR000001/");
  assert.equal(ipr.querySelector(".acc").textContent, "IPR000001");
  assert.equal(ipr.querySelector(".name").textContent, "Kringle");

  // 属性里的机器值不翻：option value / input value
  const pdb = mount(
    "pdbe",
    '<select><option value="1cbs">1cbs</option></select><input type="hidden" value="X-ray diffraction">',
    "https://www.ebi.ac.uk/pdbe/entry/pdb/1cbs"
  );
  assert.equal(pdb.querySelector("option").textContent, "1cbs");
  assert.equal(pdb.querySelector("input").getAttribute("value"), "X-ray diffraction");
});
