// NCBI 两套页脚（经典 Simple NCBI Directory / NLM 新版）+ Structure 记录页固定字段（dict/ncbi-footer.json）回归
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
const dict = read("ncbi-footer.json");
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;
const SITE = { scope: "body" };
// 与 config/sites.json 的 ncbi-structure 一致（banner 是长正文块，靠 proseExempt 放行）
const SITE_STRUCTURE = {
  scope: "body",
  proseExempt: ".usa-banner, .usa-media_block-body, [class*=disclaimer], #mmdb-update-banner, .pop-warnning"
};

// 真实页面片段（CDP 取回，剔掉 <style> 与 SVG 图标；节点边界与原文一致）
const LEGACY_FOOTER = "<div class=\"subfooter\"><h2 class=\"offscreen_noflow\">Simple NCBI Directory</h2><ul class=\"foot_list\" id=\"getting_started\"><li><h3>Getting Started</h3></li><li><a href=\"/Education/\">NCBI Education</a></li><li><a href=\"/books/NBK3831/\">NCBI Help Manual</a></li><li><a href=\"/books/NBK21101/\">NCBI Handbook</a></li><li><a href=\"/guide/training-tutorials/\">Training &amp; Tutorials</a></li></ul><ul class=\"foot_list\" id=\"resources\"><li><h3>Resources</h3></li><li><a href=\"/guide/chemicals-bioassays/\">Chemicals &amp; Bioassays</a></li><li><a href=\"/guide/data-software/\">Data &amp; Software</a></li><li><a href=\"/guide/dna-rna/\">DNA &amp; RNA</a></li><li><a href=\"/guide/domains-structures/\">Domains &amp; Structures</a></li><li><a href=\"/guide/genes-expression/\">Genes &amp; Expression</a></li><li><a href=\"/guide/genetics-medicine/\">Genetics &amp; Medicine</a></li><li><a href=\"/guide/genomes-maps/\">Genomes &amp; Maps</a></li><li><a href=\"/guide/homology/\">Homology</a></li><li><a href=\"/guide/literature/\">Literature</a></li><li><a href=\"/guide/proteins/\">Proteins</a></li><li><a href=\"/guide/sequence-analysis/\">Sequence Analysis</a></li><li><a href=\"/guide/taxonomy/\">Taxonomy</a></li><li><a href=\"/guide/training-tutorials/\">Training &amp; Tutorials</a></li><li><a href=\"/guide/variation/\">Variation</a></li></ul><ul class=\"foot_list\" id=\"popular\"><li><h3>Popular</h3></li><li><a href=\"/pubmed/\">PubMed</a></li><li><a href=\"/nucleotide/\">Nucleotide</a></li><li><a href=\"//blast.ncbi.nlm.nih.gov/\">BLAST</a></li><li><a href=\"//www.pubmedcentral.nih.gov/\" class=\"newdomain\">PubMed Central</a></li><li><a href=\"/gene/\">Gene</a></li><li><a href=\"/books/\">Bookshelf</a></li><li><a href=\"/protein/\">Protein</a></li><li><a href=\"//pubchem.ncbi.nlm.nih.gov/\">PubChem</a></li><li><a href=\"/omim/\">OMIM</a></li><li><a href=\"/genome/\">Genome</a></li><li><a href=\"/snp/\">SNP</a></li><li><a href=\"/Structure/\">Structure</a></li></ul><ul class=\"foot_list\" id=\"featured\"><li><h3>Featured</h3></li><li><a href=\"/Genbank/\">GenBank</a></li><li><a href=\"/refseq/\">Reference Sequences</a></li><li><a href=\"/mapview/\">Map Viewer</a></li><li><a href=\"/genomeprj\">Genome Projects</a></li><li><a href=\"/genome/guide/human/\">Human Genome</a></li><li><a href=\"/genome/guide/mouse/\">Mouse Genome</a></li><li><a href=\"/genomes/FLU/\">Influenza Virus</a></li><li><a href=\"/tools/primer-blast/\">Primer-BLAST</a></li><li><a href=\"/Traces/sra/\">Sequence Read Archive</a></li></ul><ul class=\"foot_list\" id=\"info\"><li><h3>NCBI Information</h3></li><li><a href=\"/About/\">About NCBI</a></li><li><a href=\"/CBBresearch/\">Research at NCBI</a></li><li><a href=\"/books/NBK1969/\">NCBI Newsletter</a></li><li><a href=\"/Ftp/\">NCBI FTP Site</a></li><li><a href=\"//www.facebook.com/ncbi.nlm\" role=\"button\" aria-expanded=\"false\" target=\"_blank\">NCBI on Facebook</a></li><li><a href=\"//twitter.com/ncbi\" role=\"button\" aria-expanded=\"false\" target=\"_blank\">NCBI on Twitter</a></li><li><a href=\"//www.youtube.com/ncbinlm\" role=\"button\" aria-expanded=\"false\" target=\"_blank\">NCBI on YouTube</a></li></ul></div><div id=\"ncbifooter\" class=\"contact_info\" style=\"margin-bottom:0;padding-bottom:1rem;\"><div id=\"footer-contents-right\"><div id=\"nlm_thumb_logo\"><a href=\"https://www.nlm.nih.gov\" title=\"NLM\">NLM</a></div><div id=\"nih_thumb_logo\"><a href=\"https://www.nih.gov\" title=\"NIH\">NIH</a></div><div id=\"hhs_thumb_logo\"><a href=\"https://www.hhs.gov\" title=\"DHHS\">DHHS</a></div><div id=\"usagov_thumb_logo\"><a href=\"https://www.usa.gov\" title=\"USA.gov\">USA.gov</a></div></div><div id=\"footer-contents-left\"><p class=\"address vcard\"><span class=\"url\"><a class=\"fn url newdomain\" href=\"https://www.ncbi.nlm.nih.gov\">National Center for Biotechnology Information</a>,</span> <span class=\"org url newdomain\"><a href=\"https://www.nlm.nih.gov/\">U.S. National Library of Medicine</a></span><span class=\"adr\"><span class=\"street-address\">8600 Rockville Pike</span>, <span class=\"locality\">Bethesda</span><span class=\"region\">MD</span>, <span class=\"postal-code\">20894</span><span class=\"country-name\">USA</span></span></p><a href=\"https://www.ncbi.nlm.nih.gov/home/about/policies.shtml\">Policies and Guidelines</a> | <a href=\"https://www.ncbi.nlm.nih.gov/home/about/contact.shtml\">Contact</a></div></div>";
const NLM_FOOTER = "\n\t<section class=\"icon-section\">\n\t\t<div id=\"icon-section-header\" class=\"icon-section_header\">Follow NCBI</div>\n\t\t<div class=\"grid-container container\">\n\t\t\t<div class=\"icon-section_container\">\n\t\t\t\t<a class=\"footer-icon\" id=\"footer_twitter\" href=\"https://twitter.com/ncbi\" aria-label=\"Twitter\">\n\t\t\t\t\t\n\t\t\t\t</a>\n\t\t\t\t<a class=\"footer-icon\" id=\"footer_facebook\" href=\"https://www.facebook.com/ncbi.nlm\" aria-label=\"Facebook\"></a>\n\t\t\t\t<a class=\"footer-icon\" id=\"footer_linkedin\" href=\"https://www.linkedin.com/company/ncbinlm\" aria-label=\"LinkedIn\"></a>\n\t\t\t\t<a class=\"footer-icon\" id=\"footer_github\" href=\"https://github.com/ncbi\" aria-label=\"GitHub\"></a>\n\t\t\t\t<a class=\"footer-icon\" id=\"footer_blog\" href=\"https://ncbiinsights.ncbi.nlm.nih.gov/\" aria-label=\"Blog\">\n\t\t\t\t\t\n\t\t\t\t</a>\n\t\t\t</div>\n\t\t</div>\n\t</section>\n\t\n\t<section class=\"container-fluid bg-primary\">\n\t\t<div class=\"container pt-5\">\n\t\t\t<div class=\"row mt-3\">\n\t\t\t\t<div class=\"col-lg-3 col-12\">\n\t\t\t\t\t<p><a class=\"text-white\" href=\"https://www.nlm.nih.gov/socialmedia/index.html\">Connect with NLM</a></p>\n\t\t\t\t\t<ul class=\"list-inline social_media\">\n\t\t\t\t\t\t<li class=\"list-inline-item\"><a href=\"https://twitter.com/NLM_NIH\" aria-label=\"Twitter\" target=\"_blank\" rel=\"noopener noreferrer\">\n\t\t\t\t\t\t\t\n\t\t\t\t\t\t</a></li>\n\t\t\t\t\t\t<li class=\"list-inline-item\"><a href=\"https://www.facebook.com/nationallibraryofmedicine\" aria-label=\"Facebook\" rel=\"noopener noreferrer\" target=\"_blank\">\n\t\t\t\t\t\t\t\n\t\t\t\t\t\t</a></li>\n\t\t\t\t\t\t<li class=\"list-inline-item\"><a href=\"https://www.youtube.com/user/NLMNIH\" aria-label=\"Youtube\" target=\"_blank\" rel=\"noopener noreferrer\">\n\t\t\t\t\t\t\t\n\t\t\t\t\t\t</a></li>\n\t\t\t\t\t</ul>\n\t\t\t\t</div>\n\t\t\t\t<div class=\"col-lg-3 col-12\">\n\t\t\t\t\t<p class=\"address_footer text-white\">National Library of Medicine<br>\n\t\t\t\t\t\t<a href=\"https://www.google.com/maps/place/8600+Rockville+Pike,+Bethesda,+MD+20894/@38.9959508,-77.101021,17z/data=!3m1!4b1!4m5!3m4!1s0x89b7c95e25765ddb:0x19156f88b27635b8!8m2!3d38.9959508!4d-77.0988323\" class=\"text-white\" target=\"_blank\" rel=\"noopener noreferrer\">8600 Rockville Pike<br>\n\t\t\t\t\t\t\tBethesda, MD 20894</a></p>\n\t\t\t\t</div>\n\t\t\t\t<div class=\"col-lg-3 col-12 centered-lg\">\n\t\t\t\t\t<p><a href=\"https://www.nlm.nih.gov/web_policies.html\" class=\"text-white\">Web Policies</a><br>\n\t\t\t\t\t\t<a href=\"https://www.nih.gov/institutes-nih/nih-office-director/office-communications-public-liaison/freedom-information-act-office\" class=\"text-white\">FOIA</a><br>\n\t\t\t\t\t\t<a href=\"https://www.hhs.gov/vulnerability-disclosure-policy/index.html\" class=\"text-white\" id=\"vdp\">HHS Vulnerability Disclosure</a></p>\n\t\t\t\t</div>\n\t\t\t\t<div class=\"col-lg-3 col-12 centered-lg\">\n\t\t\t\t\t<p><a class=\"supportLink text-white\" href=\"https://support.nlm.nih.gov/?pagename=nlmcatalogstaticpages%3ANONE%3ANONE%3ANONE\" data-pinger-pagename-param=\"true\">Help</a><br>\n\t\t\t\t\t\t<a href=\"https://www.nlm.nih.gov/accessibility.html\" class=\"text-white\">Accessibility</a><br>\n\t\t\t\t\t\t<a href=\"https://www.nlm.nih.gov/careers/careers.html\" class=\"text-white\">Careers</a></p>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t<div class=\"row\">\n\t\t\t\t<div class=\"col-lg-12 centered-lg\">\n\t\t\t\t\t<nav class=\"bottom-links\">\n\t\t\t\t\t\t<ul class=\"mt-3\">\n\t\t\t\t\t\t\t<li>\n\t\t\t\t\t\t\t\t<a class=\"text-white\" href=\"//www.nlm.nih.gov/\">NLM</a>\n\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t\t<li>\n\t\t\t\t\t\t\t\t<a class=\"text-white\" href=\"https://www.nih.gov/\">NIH</a>\n\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t\t<li>\n\t\t\t\t\t\t\t\t<a class=\"text-white\" href=\"https://www.hhs.gov/\">HHS</a>\n\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t\t<li>\n\t\t\t\t\t\t\t\t<a class=\"text-white\" href=\"https://www.usa.gov/\">USA.gov</a>\n\t\t\t\t\t\t\t</li>\n\t\t\t\t\t\t</ul>\n\t\t\t\t\t</nav>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t</div>\n\t</section>\n\t<script type=\"text/javascript\" src=\"/portal/portal3rc.fcgi/rlib/js/InstrumentOmnitureBaseJS/InstrumentNCBIConfigJS/InstrumentNCBIBaseJS/InstrumentPageStarterJS.js?v=1\"> </script>    \n\t<script type=\"text/javascript\" src=\"/portal/portal3rc.fcgi/static/js/hfjs2.js\"> </script>\n";
const STRUCTURE_RECORD = "<div id=\"centerColumn\"><div id=\"mmdb-update-banner\">An updated version of the MMDB Structure Summary page is available!<a href=\"https://www.ncbi.nlm.nih.gov/structure/labs/mmdb/structure/1TUP\">Try it now</a> and provide feedback using the on-page button. <br>Note that the new version may change without advance notice while it is being evaluated.<button type=\"button\" aria-label=\"close banner\">x</button></div><table border=\"0\" cellpadding=\"4\" cellspacing=\"4\"><tbody><tr><td class=\"H4 pdbid-download\">PDB ID: </td><td><a id=\"pdb_id_link\" class=\"link\" href=\"http://www.rcsb.org/pdb/explore/explore.do?structureId=1TUP\" title=\"PDB ID\">1TUP</a><a id=\"download-pdb-file\" class=\"__button\" href=\"https://files.rcsb.org/download/1TUP.pdb\" title=\"Download PDB file\" download=\"1TUP.pdb\">Download</a></td></tr><tr><td class=\"H4 property-name\">MMDB ID: </td><td style=\"font-weight:bold\"><span class=\"info-item\">242790</span></td></tr><tr><td class=\"H4 property-name\">PDB Deposition Date: </td><td><span id=\"depositionterm\">1995/7/11</span></td></tr><tr><td class=\"H4 property-name\">Experimental Method: </td><td class=\"TEXT\" nowrap=\"\"><div id=\"expmethod\"><span title=\"x-ray diffraction\" class=\"info-item\">x-ray diffraction</span></div></td></tr><tr><td class=\"H4 property-name\">Resolution: </td><td class=\"TEXT\" id=\"resolution\" nowrap=\"\">2.2&nbsp; Å</td></tr><tr><td class=\"H4 property-name\">Similar Structures: </td><td><div id=\"vast-button-holder\"><button class=\"__button\" id=\"vast_button\" type=\"submit\">VAST+</button></div></td></tr></tbody></table><div align=\"center\" id=\"annotblock\"><div class=\"formbox\" id=\"authormethod\"><div id=\"bublock0\"><div class=\"biotext\" id=\"bublock0_unit_name\">Biological Unit for 1TUP: pentameric; determined by author</div><div class=\"struc_block_title\">Molecular Graphic</div></div><table><tbody><tr><td class=\"annotation-cell\"><div class=\"graph-annot\"><div class=\"molecule-name\" title=\"Protein (P53 Tumor Suppressor )\">Protein (P53 Tumor Suppressor )</div><a href=\"/protein/1310960\" class=\"mol-svg-left-text-anchor\" title=\"These proteins can be viewed as a sequence record in the Entrez Protein database\">3 Proteins</a></div></td></tr></tbody></table></div></div></div>";
const SPA_SUMMARY = "<div class=\"MuiPaper-root MuiAlert-root\" role=\"alert\"><div class=\"MuiAlert-message\"><div class=\"MuiTypography-root MuiAlertTitle-root\">Welcome to the updated version of the Structure Summary page!</div>Please let us know about your experience <a class=\"MuiLink-root\" href=\"https://nlmenterprise.co1.qualtrics.com/jfe/form/SV_5iL6W3r2A7vY52R\">here.</a><br>Use this link to navigate back to the old <a class=\"MuiLink-root\" href=\"https://www.ncbi.nlm.nih.gov/Structure/mmdb/mmdbsrv.cgi?dps=0&amp;uid=242790\">Molecular Modeling Database Page</a></div></div><div class=\"MuiGrid2-root\"><button class=\"MuiButton-root\" type=\"button\">3D View</button><a class=\"MuiButton-root\" href=\"https://www.ncbi.nlm.nih.gov/Structure/icn3d/full.html?bu=1&amp;showanno=1&amp;source=full-feature&amp;mmdbid=242790\" target=\"_blank\" rel=\"noopener noreferrer\">Full Viewer</a><button class=\"MuiButton-root\" type=\"button\">More information</button><button class=\"MuiButton-root\" type=\"button\">Download Structure Data</button><button class=\"MuiButton-root\" type=\"button\">Default Biological Assembly</button></div><div class=\"MuiToolbar-root MuiTablePagination-toolbar\"><p class=\"MuiTablePagination-selectLabel\">Rows per page:</p><div class=\"MuiSelect-select\">5</div></div><div class=\"MuiTableContainer-root\"><div>View Similar Structures</div><table><thead><tr><th>Label</th><th>Count</th><th>Molecule</th><th>Graphical Display</th><th>Organism</th></tr></thead><tbody><tr><td>3</td><td>PROTEIN (P53 TUMOR SUPPRESSOR)</td><td>219</td></tr></tbody></table><div>View All Similar Structures</div></div>";

function boot(html, url, site) {
  const dom = new JSDOM("<!doctype html><html><body>" + html + "</body></html>", {
    url: url || "https://www.ncbi.nlm.nih.gov/"
  });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: dict.exact, rules: dict.rules, templates: dict.templates },
    site: site || SITE
  });
  engine.start();
  return dom.window.document;
}

const SKIP = new Set(["SCRIPT", "STYLE", "SVG", "NOSCRIPT", "CODE", "PRE"]);
// 只数「仍然是英文的文本节点」，用来量化加词前后的残留
function englishTexts(doc) {
  const out = [];
  const walker = doc.createTreeWalker(doc.body, 4);
  let node;
  while ((node = walker.nextNode())) {
    let p = node.parentElement, skip = false;
    while (p) {
      if (SKIP.has(String(p.tagName || "").toUpperCase())) { skip = true; break; }
      p = p.parentElement;
    }
    if (skip) continue;
    const s = node.nodeValue.replace(/\s+/g, " ").trim();
    if (s && /[A-Za-z]/.test(s) && !CJK.test(s)) out.push(s);
  }
  return out.sort();
}

function applyRule(reStr, to, input, lookup) {
  const m = new RegExp(reStr).exec(input);
  if (!m) return null;
  return to.replace(/\$(\d)/g, (_, d) => {
    const seg = m[Number(d)] ?? "";
    return lookup && Object.prototype.hasOwnProperty.call(lookup, seg) ? lookup[seg] : seg;
  });
}

test("词库结构：family/sites、条目量级、规则与模板字段", () => {
  assert.equal(dict.meta.family, "ncbi-footer");
  assert.equal(dict.meta.version, "0.1.0");
  assert.ok(dict.meta.sites.includes("www.ncbi.nlm.nih.gov"), "meta.sites 缺 www.ncbi.nlm.nih.gov");
  const exact = Object.keys(dict.exact || {});
  assert.ok(exact.length >= 70, "exact 条目太少: " + exact.length);
  assert.ok(Array.isArray(dict.rules) && dict.rules.length >= 2, "规则太少");
  assert.ok(Array.isArray(dict.templates), "templates 必须是数组");
  // 两套页脚的标签都是完整文本节点；机构名与地址按口径保留英文，没有需要模板拼装的切开标签。
  assert.equal(dict.templates.length, 0, "页脚没有需要 templates 的切开标签");
});

test("条目卫生：key 无中文/无自映射/无首尾空白；值有中文且无 URL、邮箱、占位符", () => {
  const seen = new Set();
  const bad = [];
  for (const [k, v] of Object.entries(dict.exact || {})) {
    if (!k || CJK.test(k)) bad.push("key 含中文或为空: " + k);
    if (k !== k.trim()) bad.push("key 首尾空白: " + JSON.stringify(k));
    if (!v || v !== String(v).trim()) bad.push("值空或首尾空白: " + k);
    // "PDB ID：" 这种只带全角标点的译文也算已本地化
    if (!CJK.test(v) && !/[\u3000-\u303f\uff00-\uffef]/.test(v)) bad.push("值无中文: " + k);
    if (k === v) bad.push("自映射: " + k);
    if (/https?:\/\/|www\.|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(v)) bad.push("值含 URL/邮箱: " + k);
    if (/\{\{\d+\}\}/.test(v)) bad.push("exact 里混入占位符: " + k);
    const normalized = k.replace(/\s+/g, " ").trim().toLowerCase();
    if (seen.has(normalized)) bad.push("规范化后重复: " + k);
    seen.add(normalized);
  }
  assert.deepEqual(bad, []);
});

test("经典 mega footer：五栏目录项、政策链接全部收词，数据库品牌按口径不收", () => {
  const want = {
    "Simple NCBI Directory": "NCBI 简明目录",
    "Getting Started": "入门指南",
    "Resources": "资源",
    "Popular": "热门",
    "Featured": "精选",
    "NCBI Information": "NCBI 信息",
    "NCBI Education": "NCBI 教育资源",
    "NCBI Help Manual": "NCBI 帮助手册",
    "NCBI Handbook": "NCBI 手册",
    "Training & Tutorials": "培训与教程",
    "Chemicals & Bioassays": "化学品与生物测定",
    "Data & Software": "数据与软件",
    "DNA & RNA": "DNA 与 RNA",
    "Domains & Structures": "结构域与结构",
    "Genes & Expression": "基因与表达",
    "Genetics & Medicine": "遗传学与医学",
    "Genomes & Maps": "基因组与图谱",
    "Homology": "同源性",
    "Literature": "文献",
    "Proteins": "蛋白质",
    "Sequence Analysis": "序列分析",
    "Taxonomy": "分类学",
    "Variation": "变异",
    "Reference Sequences": "参考序列",
    "Map Viewer": "图谱查看器",
    "Genome Projects": "基因组计划",
    "Human Genome": "人类基因组",
    "Mouse Genome": "小鼠基因组",
    "Influenza Virus": "流感病毒",
    "Primer-BLAST": "引物 BLAST",
    "Sequence Read Archive": "序列读取存档",
    "About NCBI": "关于 NCBI",
    "Research at NCBI": "NCBI 的研究",
    "NCBI Newsletter": "NCBI 通讯",
    "NCBI FTP Site": "NCBI FTP 站点",
    "NCBI on Facebook": "NCBI 的 Facebook",
    "NCBI on Twitter": "NCBI 的 Twitter",
    "NCBI on YouTube": "NCBI 的 YouTube",
    "Write to the Help Desk": "联系帮助台",
    "Policies and Guidelines": "政策与指南",
    "Contact": "联系方式"
  };
  for (const [k, v] of Object.entries(want)) {
    assert.equal(dict.exact[k], v, "条目不符: " + k);
  }
  for (const k of ["PubMed", "Nucleotide", "BLAST", "PubMed Central", "Gene", "Bookshelf", "Protein", "PubChem", "OMIM", "Genome", "SNP", "Structure", "GenBank"]) {
    assert.equal(dict.exact[k], undefined, "数据库品牌不应收词: " + k);
  }
});

test("NLM 新版页脚：社交链接、Web Policies / FOIA / Accessibility；机构名与地址保留英文", () => {
  const want = {
    "Follow NCBI": "关注 NCBI",
    "NCBI RSS feed": "NCBI RSS 订阅",
    "NCBI on LinkedIn": "NCBI 的 LinkedIn",
    "NCBI on X (formerly known as Twitter)": "NCBI 的 X（原 Twitter）",
    "NCBI on GitHub": "NCBI 的 GitHub",
    "Connect with NLM": "联系 NLM",
    "NLM on Facebook": "NLM 的 Facebook",
    "NLM on X (formerly known as Twitter)": "NLM 的 X（原 Twitter）",
    "NLM on YouTube": "NLM 的 YouTube",
    "Web Policies": "网站政策",
    "Web Policies and Notices": "网站政策与声明",
    "FOIA": "《信息自由法》",
    "Freedom of Information Act": "《信息自由法》",
    "HHS Vulnerability Disclosure": "HHS 漏洞披露",
    "Help": "帮助",
    "Accessibility": "无障碍",
    "Careers": "招聘"
  };
  for (const [k, v] of Object.entries(want)) {
    assert.equal(dict.exact[k], v, "条目不符: " + k);
  }
  for (const k of ["National Library of Medicine", "National Center for Biotechnology Information", "U.S. National Library of Medicine", "8600 Rockville Pike", "Bethesda, MD 20894", "NLM", "NIH", "HHS", "USA.gov"]) {
    assert.equal(dict.exact[k], undefined, "机构名/地址不应收词: " + k);
  }
});

test("Structure 记录页固定字段：旧页与新 SPA 的按钮/标签", () => {
  const want = {
    "PDB ID:": "PDB ID：",
    "MMDB ID:": "MMDB ID：",
    "3D View": "三维视图",
    "Full Viewer": "完整查看器",
    "full-featured 3D viewer": "功能完整的三维查看器",
    "VAST+": "VAST+ 结构比对",
    "close banner": "关闭横幅",
    "Try it now": "立即试用",
    "x-ray diffraction": "X 射线衍射",
    "Download Structure Data": "下载结构数据",
    "Rows per page:": "每页行数：",
    "View Similar Structures": "查看相似结构",
    "View All Similar Structures": "查看全部相似结构",
    "More information": "更多信息",
    "Welcome to the updated version of the Structure Summary page!": "结构摘要页已推出更新版本！"
  };
  for (const [k, v] of Object.entries(want)) {
    assert.equal(dict.exact[k], v, "条目不符: " + k);
  }
  // 页面原文用半角冒号（normalize 后还会吃掉尾空白），译文用全角冒号
  assert.ok(dict.exact["PDB ID:"].includes("："));
  assert.ok(dict.exact["MMDB ID:"].includes("："));
});

test("规则：Biological Unit for / Protein (…) 命中页面原文", () => {
  const bu = "^Biological Unit for (\\S+): (.+?); determined by author$";
  assert.equal(
    applyRule(bu, "$1 的生物学单元：$2；由作者确定", "Biological Unit for 1TUP: pentameric; determined by author", null),
    "1TUP 的生物学单元：pentameric；由作者确定"
  );
  assert.equal(
    applyRule("^Protein \\((.+?)\\s*\\)$", "蛋白质（$1）", "Protein (P53 Tumor Suppressor )", null),
    "蛋白质（P53 Tumor Suppressor）"
  );
  assert.equal(applyRule(bu, "$1 的生物学单元：$2；由作者确定", "Biological Unit for 1TUP", null), null, "缺 determined by author 不应命中");
  assert.equal(applyRule("^Protein \\((.+?)\\s*\\)$", "蛋白质（$1）", "Protein: P53", null), null, "不是 Protein (…) 形态不应命中");
});

test("引擎冒烟：经典 mega footer 真实 markup 渲染，品牌/机构/地址保持英文", () => {
  const doc = boot(LEGACY_FOOTER, "https://www.ncbi.nlm.nih.gov/Structure/pdb/1TUP");
  const text = doc.body.textContent;
  for (const zh of [
    "NCBI 简明目录", "入门指南", "资源", "热门", "精选", "NCBI 信息",
    "NCBI 教育资源", "NCBI 帮助手册", "NCBI 手册", "培训与教程",
    "化学品与生物测定", "数据与软件", "DNA 与 RNA", "结构域与结构", "基因与表达",
    "遗传学与医学", "基因组与图谱", "同源性", "文献", "蛋白质", "序列分析",
    "分类学", "变异", "参考序列", "图谱查看器", "基因组计划", "人类基因组",
    "小鼠基因组", "流感病毒", "引物 BLAST", "序列读取存档", "关于 NCBI",
    "NCBI 的研究", "NCBI 通讯", "NCBI FTP 站点", "NCBI 的 Facebook",
    "NCBI 的 Twitter", "NCBI 的 YouTube", "政策与指南", "联系方式"
  ]) {
    assert.ok(text.includes(zh), "页脚缺少译文: " + zh);
  }
  assert.deepEqual(englishTexts(doc), ["8600 Rockville Pike","BLAST","Bethesda","Bookshelf","DHHS","GenBank","Gene","Genome","MD","NIH","NLM","National Center for Biotechnology Information","Nucleotide","OMIM","Protein","PubChem","PubMed","PubMed Central","SNP","Structure","U.S. National Library of Medicine","USA","USA.gov"], "经典页脚剩余英文应只有数据库品牌、机构名与地址");
});

test("引擎冒烟：NLM 新版页脚真实 markup 渲染，地址与机构缩写保持英文", () => {
  const doc = boot(NLM_FOOTER, "https://www.ncbi.nlm.nih.gov/nlmcatalog/journals/0000000");
  const text = doc.body.textContent;
  for (const zh of ["关注 NCBI", "联系 NLM", "网站政策", "《信息自由法》", "HHS 漏洞披露", "帮助", "无障碍", "招聘"]) {
    assert.ok(text.includes(zh), "页脚缺少译文: " + zh);
  }
  assert.deepEqual(englishTexts(doc), ["8600 Rockville Pike","Bethesda, MD 20894","HHS","NIH","NLM","National Library of Medicine","USA.gov"], "新版页脚剩余英文应只有地址与 NLM/NIH/HHS/USA.gov");
});

test("引擎冒烟：Structure 记录页片段——固定字段、rules 与 aria-label", () => {
  const doc = boot(STRUCTURE_RECORD, "https://www.ncbi.nlm.nih.gov/Structure/pdb/1TUP", SITE_STRUCTURE);
  const text = doc.body.textContent;
  for (const zh of ["PDB ID：", "MMDB ID：", "X 射线衍射", "VAST+ 结构比对", "1TUP 的生物学单元：pentameric；由作者确定", "蛋白质（P53 Tumor Suppressor）", "立即试用"]) {
    assert.ok(text.includes(zh), "记录页缺少译文: " + zh);
  }
  assert.equal(doc.querySelector("#vast_button").textContent, "VAST+ 结构比对");
  assert.equal(doc.querySelector(".molecule-name").getAttribute("title"), "蛋白质（P53 Tumor Suppressor）", "title 属性也要跟着翻");
  assert.equal(doc.querySelector("#mmdb-update-banner button").getAttribute("aria-label"), "关闭横幅", "aria-label 走属性通道");
  // banner 整块是长正文，靠配置里的 proseExempt 放行后链接文字才会翻；
  // 没有 proseExempt 时引擎会挡住这句里的短节点（已在本册词条测试里单独验证）。
  // 属于别的册（ncbi-struct/ncbi-new2）的字段本册不重复收
  assert.ok(text.includes("PDB Deposition Date:"), "本册不收 ncbi-struct 已覆盖的字段");
});

test("引擎冒烟：新版 Structure Summary（SPA）按钮与分页标签", () => {
  const doc = boot(SPA_SUMMARY, "https://www.ncbi.nlm.nih.gov/structure/labs/mmdb/structure/1TUP");
  const text = doc.body.textContent;
  for (const zh of ["结构摘要页已推出更新版本！", "三维视图", "完整查看器", "更多信息", "下载结构数据", "每页行数：", "查看相似结构", "查看全部相似结构"]) {
    assert.ok(text.includes(zh), "SPA 页缺少译文: " + zh);
  }
  // 不翻的：标识符、表格数据、长句里的链接文字
  assert.ok(text.includes("PROTEIN (P53 TUMOR SUPPRESSOR)"), "大写分子名不翻");
  assert.ok(text.includes("here."), "长句里的短链接被正文保护拦住是预期行为");
});
