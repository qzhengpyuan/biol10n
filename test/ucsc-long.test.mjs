// UCSC hgTracks「推荐轨道集」弹窗（recTrackSetsPopup）长说明与 RCSB 首页标题回归：
// 1) 251 字符整段说明必须整句收进 exact（r18 起报了三次的漏译）并整段成中文；
// 2) 弹窗里 5 条 >80 字符的轨道集说明与页内免责声明同批收口，链接标签/重置句不破坏；
// 3) 基因登录号、坐标、rsID 等数据不误翻；
// 4) RCSB 首页标题（document.title 与 visually-hidden H1）走 rcsb 册既有的「首页」口径，确认生效。
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
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const CJK = /[\u4e00-\u9fff]/;

// 站点条目以 config/sites.json 为准；lead 接线前（缺条目或 dict 栈没登记）回退到本册约定的同款配置。
const fallbackSites = {
  ucsc: {
    id: "ucsc",
    name: "UCSC Genome Browser",
    hosts: ["genome.ucsc.edu", "www.genome.ucsc.edu"],
    dicts: ["common", "anatomy", "spa", "ucsc", "ucsc-extra", "ucsc-tpl", "ucsc-vai", "ucsc-hggene"],
    scope: "body",
    proseExempt: "#descriptionText",
    valueText: true,
    attrs: ["mouseovertext"]
  },
  "rcsb-pdb": {
    id: "rcsb-pdb",
    name: "RCSB PDB",
    hosts: ["www.rcsb.org", "rcsb.org"],
    dicts: ["common", "spa", "rcsb", "rcsb-home"],
    scope: "header, nav, main, footer, #root, .visually-hidden-focusable, .skip-link",
    spa: true,
    waitFor: "#root",
    valueText: true
  }
};

function siteFor(id, dicts) {
  const fb = fallbackSites[id];
  const cfg = sites.find((s) => s.id === id) || {};
  const site = Object.assign({}, fb, cfg);
  // 只断言本册要覆盖的渲染口径：dict 栈与 scope 以配置为准，配置缺这两项时用回退值。
  if (!Array.isArray(cfg.dicts) || !cfg.dicts.length) site.dicts = dicts;
  if (!cfg.scope) site.scope = fb.scope;
  return site;
}

const ucscSite = siteFor("ucsc", fallbackSites.ucsc.dicts);
const rcsbSite = siteFor("rcsb-pdb", fallbackSites["rcsb-pdb"].dicts);

function stackData(dictIds) {
  const data = { exact: {}, rules: [], templates: [] };
  for (const id of dictIds) {
    const b = readDict(id);
    Object.assign(data.exact, b.exact || {});
    data.rules = data.rules.concat(b.rules || []);
    data.templates = data.templates.concat(b.templates || []);
  }
  return data;
}

const ucscData = stackData(ucscSite.dicts);
const rcsbData = stackData(rcsbSite.dicts);

function run(html, opts) {
  const dom = new JSDOM("<body>" + html + "</body>", { url: opts.url });
  if (opts.title) dom.window.document.title = opts.title;
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: opts.data,
    site: opts.site
  });
  engine.start();
  return dom.window.document;
}
function plain(el) {
  return el.textContent.replace(/\s+/g, " ").trim();
}

const book = readDict("ucsc");
const extra = readDict("ucsc-extra");
const rcsb = readDict("rcsb");

// 线上 https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38 弹窗 div#recTrackSetsPopup 的原文（单行、无换行）
const LONG =
  "These links provide track sets selected and pre-configured for specific user scenarios. " +
  "They are designed to be useful at different genomic loci. " +
  "Clicking a link below will create a browser window with these tracks visible, without changing the locus.";
const LONG_ZH =
  "这些链接提供针对特定用户场景挑选并预先配置好的轨道集。它们旨在适用于不同的基因组位点。单击下方任一链接将新建一个显示这些轨道的浏览器窗口，且不改变当前位点。";

const DESCRIPTIONS = [
  "Assess potential disease contributions of single nucleotide variants in coding regions",
  "Assess potential disease contributions of structural variants in coding regions",
  "Investigate functional aspects of non-coding variants",
  "Examine if variants are present in an exon required for the function of the expressed gene product",
  "Evaluate if annotations are on potential low confidence regions due to high homology or other reported concerns",
  "Assess potential disease contribution of variants on BRCA1 and BRCA2 according to the ENIGMA VCEP guidelines",
  "Assess potential disease contribution of variants on MLH1, MSH2, MSH6, and PMS2 according to the InSiGHT VCEP guidelines"
];
const DISCLAIMER =
  "This tool is for research use only. For personal medical or genetic advising, consult a qualified physician.";

const POPUP_HTML =
  '<main id="mainContent">' +
  '<div style="display:none;" id="recTrackSetsPopup" title="Recommended Track Sets">' +
  "<p>" + LONG + "</p>" +
  '<ul class="indent">' +
  '<li><a class="recTrackSetLink" href="./hgTracks?rtsLoad=Clinical_SNVs_hg38">Clinical SNVs</a>: <small>' + DESCRIPTIONS[0] + "</small></li>" +
  '<li><a class="recTrackSetLink" href="./hgTracks?rtsLoad=Clinical_CNVs_hg38">Clinical CNVs</a>: <small>' + DESCRIPTIONS[1] + "</small></li>" +
  '<li><a class="recTrackSetLink" href="./hgTracks?rtsLoad=Non_Coding_SNVs_hg38">Non-coding SNVs</a>: <small>' + DESCRIPTIONS[2] + "</small></li>" +
  '<li><a class="recTrackSetLink" href="./hgTracks?rtsLoad=Exon_Relevance_hg38">Determine Exon Relevance</a>: <small>' + DESCRIPTIONS[3] + "</small></li>" +
  '<li><a class="recTrackSetLink" href="./hgTracks?rtsLoad=Problematic_Regions_hg38">Problematic Regions</a>: <small>' + DESCRIPTIONS[4] + "</small></li>" +
  '<li><a class="recTrackSetLink" href="./hgTracks?rtsLoad=BRCA1_BRCA2_ENIGMA_hg38">ENIGMA BRCA1/BRCA2 VCEP</a>: <small>' + DESCRIPTIONS[5] + "</small></li>" +
  '<li><a class="recTrackSetLink" href="./hgTracks?rtsLoad=insightVcepHg38">InSiGHT Lynch Syndrome VCEP</a>: <small>' + DESCRIPTIONS[6] + "</small></li>" +
  "</ul>" +
  '<p>Return to <a href="./hgTracks?hgt.reset=on">Default</a> browser tracks.</p>' +
  "<p><small><em>" + DISCLAIMER + "</em></small></p>" +
  "</div>" +
  // 数据守门：基因登录号 / 坐标 / rsID 一律原样
  "<p><span>NM_000546.6</span> <span>chr17:7660000-7680000</span> <span>rs28934578</span></p>" +
  "</main>";

test("词库结构：exact 无中文键且值含汉字、规则可编译、模板槽位连续", () => {
  for (const b of [book, extra, rcsb]) {
    assert.equal(typeof b.meta.family, "string");
    assert.ok(Array.isArray(b.meta.sites) && b.meta.sites.length);
    for (const [k, v] of Object.entries(b.exact)) {
      assert.doesNotMatch(k, CJK, "key 含中文: " + k);
      assert.equal(k, k.trim(), "key 首尾有空白: " + JSON.stringify(k));
      assert.notEqual(k, v, "自映射: " + k);
    }
    for (const r of b.rules || []) {
      assert.doesNotThrow(() => new RegExp(r.re), "坏正则: " + r.re);
      assert.ok(CJK.test(r.to) || /\$\d/.test(r.to), "规则译文既无汉字也没用占位符: " + r.re);
    }
    for (const t of b.templates || []) {
      const slots = (t.pat.match(/\{\{\d+\}\}/g) || []).length;
      assert.ok(slots >= 1, "模板没有槽位: " + t.pat);
      for (let i = 1; i <= slots; i++) assert.ok(t.pat.includes("{{" + i + "}}"), "槽位不连续: " + t.pat);
      assert.equal((t.zh.match(/\{\{\d+\}\}/g) || []).length, slots, "译文槽位数不一致: " + t.pat);
    }
  }
});

test("新增条目卫生：新 key 无中文/无首尾空白，译文含汉字且不带 URL 与邮箱", () => {
  const added = [LONG, ...DESCRIPTIONS, DISCLAIMER];
  for (const k of added) {
    const v = book.exact[k];
    assert.ok(typeof v === "string", "缺条目: " + k.slice(0, 60));
    assert.doesNotMatch(k, CJK, "key 含中文: " + k);
    assert.equal(k, k.trim());
    assert.equal(v, v.trim(), "译文首尾有空白: " + k.slice(0, 60));
    assert.match(v, CJK, "译文不含汉字: " + k.slice(0, 60));
    assert.notEqual(v, k, "自映射: " + k.slice(0, 60));
    assert.doesNotMatch(v, /https?:\/\//i, "译文含明文 URL: " + k.slice(0, 60));
    assert.doesNotMatch(v, /[\w.+-]+@[\w-]+\.[\w.]+/, "译文含明文邮箱: " + k.slice(0, 60));
  }
});

test("长句按真实整句收口：251 字符、三句完整，库里不留截断前缀", () => {
  assert.equal(LONG.length, 251, "线上整段就是 251 字符（r18 报的就是这一句）");
  assert.ok(LONG.startsWith("These links provide track sets"));
  assert.ok(LONG.endsWith("without changing the locus."), "整句必须以末句收尾，不能只收前一段");
  assert.equal(book.exact[LONG], LONG_ZH);

  // 反面：任何只收到半句的写法都不许留在库里（否则整句匹配永远被半句抢先）
  for (const b of [book, extra]) {
    for (const k of Object.keys(b.exact)) {
      if (!k.startsWith("These links provide")) continue;
      assert.equal(k, LONG, "库里存了截断/改写的长句: " + JSON.stringify(k));
    }
  }
});

test("弹窗整段翻译：说明段 + 7 条轨道集描述 + 免责声明全部成中文", () => {
  const doc = run(POPUP_HTML, { site: ucscSite, data: ucscData, url: "https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38" });
  const popup = doc.getElementById("recTrackSetsPopup");
  assert.ok(popup, "弹窗节点在 scope 内");
  const paras = popup.querySelectorAll("p");
  assert.equal(plain(paras[0]), LONG_ZH, "251 字符整段应整段成中文");
  assert.doesNotMatch(plain(paras[0]), /[A-Za-z]{4,}/, "整段不应残留英文单词");

  const items = [...popup.querySelectorAll("li")].map(plain);
  assert.equal(items.length, 7);
  assert.match(items[0], /^临床 SNV[:：]\s*评估编码区单核苷酸变异对疾病的潜在贡献$/);
  assert.match(items[1], /^临床 CNV[:：]\s*评估编码区结构变异对疾病的潜在贡献$/);
  assert.match(items[2], /^非编码 SNV[:：]\s*研究非编码变异的功能影响$/);
  assert.match(items[3], /^判定外显子相关性[:：]\s*检查变异是否位于所表达基因产物发挥功能所必需的外显子上$/);
  assert.match(items[4], /^问题区域[:：]\s*评估注释是否位于因高度同源性或其他已报告问题而可能置信度偏低的区域$/);
  assert.match(items[5], /^ENIGMA BRCA1\/BRCA2 VCEP[:：]\s*根据 ENIGMA VCEP 指南评估 BRCA1 与 BRCA2 上变异对疾病的潜在贡献$/);
  assert.match(items[6], /^InSiGHT Lynch Syndrome VCEP[:：]\s*根据 InSiGHT VCEP 指南评估 MLH1、MSH2、MSH6 与 PMS2 上变异对疾病的潜在贡献$/);
  for (const t of items) assert.doesNotMatch(t, /Assess potential|Evaluate if|Examine if|Investigate functional/, "描述残留英文: " + t);

  // 免责声明整块替换（引擎会把 <p><small><em> 折成 <p data-biol10n-block>）
  assert.match(plain(popup), /本工具仅供研究使用。如需个人医学或遗传学方面的建议，请咨询有资质的医生。$/);
  assert.doesNotMatch(plain(popup), /research use only/);
});

test("弹窗里的链接标签与重置句不被破坏：href 保留、文案成中文", () => {
  const doc = run(POPUP_HTML, { site: ucscSite, data: ucscData, url: "https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38" });
  const popup = doc.getElementById("recTrackSetsPopup");
  const first = popup.querySelector("a.recTrackSetLink");
  assert.equal(first.textContent.trim(), "临床 SNV");
  assert.equal(first.getAttribute("href"), "./hgTracks?rtsLoad=Clinical_SNVs_hg38", "链接地址不能改");

  const reset = [...popup.querySelectorAll("p")].find((p) => /hgt\.reset=on/.test(p.innerHTML));
  assert.ok(reset, "重置句还在");
  assert.equal(plain(reset), "返回到默认浏览器轨道。");
  assert.equal(reset.querySelector("a").getAttribute("href"), "./hgTracks?hgt.reset=on");
  assert.ok(!/Return to|browser tracks/.test(plain(reset)));
});

test("数据守门：登录号、坐标、rsID 不参与翻译", () => {
  const doc = run(POPUP_HTML, { site: ucscSite, data: ucscData, url: "https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38" });
  const spans = [...doc.querySelectorAll("span")].map(plain);
  assert.deepEqual(spans, ["NM_000546.6", "chr17:7660000-7680000", "rs28934578"]);

  // 词库层面也不许出现把这类数据当键的条目
  for (const b of [book, extra]) {
    for (const k of Object.keys(b.exact)) {
      assert.doesNotMatch(k, /^(NM_|NR_|NP_|chr[0-9XY]+:\d+-\d+$|rs\d+$)/, "数据被当成词条: " + k);
    }
  }
});

test("RCSB 首页标题：document.title 与 visually-hidden H1 都走「首页」", () => {
  const doc = run(
    '<main id="main"><div id="maincontentcontainer">' +
      '<h1 class="visually-hidden">RCSB Protein Data Bank Home Page</h1>' +
      "</div></main>" +
      '<footer><nav><a href="/">Homepage</a></nav></footer>',
    {
      site: rcsbSite,
      data: rcsbData,
      url: "https://www.rcsb.org/",
      title: "RCSB PDB: Homepage"
    }
  );
  assert.equal(doc.title, "RCSB PDB：首页", "浏览器标签页标题要成中文，品牌名保留");
  assert.equal(plain(doc.querySelector("h1.visually-hidden")), "RCSB Protein Data Bank 首页");
  assert.equal(plain(doc.querySelector("footer a")), "首页", "「Homepage」单节点靠 rcsb 册既有条目");
  assert.equal(rcsb.exact.Homepage, "首页", "rcsb 册里这条口径没有变");
});
