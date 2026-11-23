// UCSC 长英文句 r25 回归：
// 1) r18–r24 反复报的四条（251 字符轨道集说明、ENIGMA/InSiGHT 两条列表项、研究用途免责声明）
//    已经在 r22 落进 dict/ucsc.json，这里按「整句」锁住，防止再退回半句/截断前缀；
// 2) r25 实测线上 hgTracks 仍为英文的三条长 tooltip（mouseovertext 公告，89–98 字符、以句号收尾），
//    新增词条必须命中且不改链接；
// 3) 首页两段长说明走模板通道（ucsc-tpl），中文语序重排后链接 href 必须原样。
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

function siteFor(id, fallbackDicts) {
  const cfg = sites.find((s) => s.id === id) || {};
  const site = {
    id,
    hosts: cfg.hosts || ["genome.ucsc.edu", "www.genome.ucsc.edu"],
    dicts: Array.isArray(cfg.dicts) && cfg.dicts.length ? cfg.dicts : fallbackDicts,
    scope: cfg.scope || "body",
    proseExempt: cfg.proseExempt || "#descriptionText",
    valueText: true,
    attrs: Array.isArray(cfg.attrs) && cfg.attrs.length ? cfg.attrs : ["mouseovertext"]
  };
  return site;
}

const ucscSite = siteFor("ucsc", ["common", "anatomy", "spa", "ucsc", "ucsc-extra", "ucsc-tpl", "ucsc-vai", "ucsc-hggene"]);
const ucscData = { exact: {}, rules: [], templates: [] };
for (const id of ucscSite.dicts) {
  const b = readDict(id);
  Object.assign(ucscData.exact, b.exact || {});
  ucscData.rules = ucscData.rules.concat(b.rules || []);
  ucscData.templates = ucscData.templates.concat(b.templates || []);
}

function boot(html, { url = "https://www.genome.ucsc.edu/cgi-bin/hgTracks?db=hg38", data = ucscData } = {}) {
  const dom = new JSDOM("<body>" + html + "</body>", { url });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site: ucscSite });
  engine.start();
  return { doc: dom.window.document, engine };
}
const plain = (el) => el.textContent.replace(/\s+/g, " ").trim();

const book = readDict("ucsc");
const extra = readDict("ucsc-extra");

// 线上 div#recTrackSetsPopup 原文（单行、无换行，251 字符）
const LONG =
  "These links provide track sets selected and pre-configured for specific user scenarios. " +
  "They are designed to be useful at different genomic loci. " +
  "Clicking a link below will create a browser window with these tracks visible, without changing the locus.";
const LONG_ZH =
  "这些链接提供针对特定用户场景挑选并预先配置好的轨道集。它们旨在适用于不同的基因组位点。单击下方任一链接将新建一个显示这些轨道的浏览器窗口，且不改变当前位点。";
const DISCLAIMER =
  "This tool is for research use only. For personal medical or genetic advising, consult a qualified physician.";
const ENIGMA_DESC =
  "Assess potential disease contribution of variants on BRCA1 and BRCA2 according to the ENIGMA VCEP guidelines";
const INSIGHT_DESC =
  "Assess potential disease contribution of variants on MLH1, MSH2, MSH6, and PMS2 according to the InSiGHT VCEP guidelines";
const DESCRIPTIONS = [
  "Assess potential disease contributions of single nucleotide variants in coding regions",
  "Assess potential disease contributions of structural variants in coding regions",
  "Investigate functional aspects of non-coding variants",
  "Examine if variants are present in an exon required for the function of the expressed gene product",
  "Evaluate if annotations are on potential low confidence regions due to high homology or other reported concerns",
  ENIGMA_DESC,
  INSIGHT_DESC
];

// r25 实测（CDP 9227，25s）：这三条是 hgTracks 轨道链接的 mouseovertext，线上仍为整段英文。
const R25 = [
  [
    "COSMIC data is now updated on the COSMIC track (not COSMIC Regions). See news archive for details.",
    "COSMIC 数据现已更新到 COSMIC 轨道（不再是 COSMIC Regions）。详情请参阅新闻存档。"
  ],
  [
    "Please see the ENCODE4 Regulation track for the latest data. See news archive for details.",
    "最新数据请参阅 ENCODE4 Regulation 轨道。详情请参阅新闻存档。"
  ],
  [
    "ClinGen CNV data are now updated on ClinVar Variants track. See news archive for details.",
    "ClinGen CNV 数据现已更新到 ClinVar Variants 轨道。详情请参阅新闻存档。"
  ]
];

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
  "<p><span>NM_000546.6</span> <span>chr17:7660000-7680000</span> <span>rs28934578</span></p>" +
  "</main>";

const POSTER_HTML =
  '<p id="poster">Our <a href="/about/poster-gallery">Poster Gallery</a> collects more than ' +
  '<a href="/about/posters">30 conference posters</a> we have presented since 2015, each a one page tour of a set of features. ' +
  'Topics include <a href="/help/variant-interpretation">variant interpretation</a>, ' +
  '<a href="/help/track-hubs">track hub storage</a>, <a href="/help/quicklift">quickLift</a>, ' +
  '<a href="/help/pangenome">pangenome data</a>, and <a href="/help/transposable">transposable elements</a>, ' +
  "and every one is free to download.</p>" +
  '<p id="contact">Feel free to <a href="/contact">contact us</a> if you are interested in attending a workshop, ' +
  "or meeting someone from the team to collaborate, get help, or ask any questions at the meetings. " +
  'See our <a href="/about/poster-gallery">Poster Gallery</a>.</p>';

test("词库结构：ucsc 册 exact 键无中文、无首尾空白，模板槽位连续", () => {
  for (const b of [book, extra]) {
    for (const [k, v] of Object.entries(b.exact)) {
      assert.doesNotMatch(k, CJK, "key 含中文: " + k.slice(0, 80));
      assert.equal(k, k.trim(), "key 首尾有空白: " + JSON.stringify(k).slice(0, 80));
      assert.notEqual(k, v, "自映射: " + k.slice(0, 80));
    }
    for (const t of b.templates || []) {
      const slots = (t.pat.match(/\{\{\d+\}\}/g) || []).length;
      assert.ok(slots >= 1, "模板没有槽位: " + t.pat.slice(0, 60));
      for (let i = 1; i <= slots; i++) assert.ok(t.pat.includes("{{" + i + "}}"), "槽位不连续: " + t.pat.slice(0, 60));
      assert.equal((t.zh.match(/\{\{\d+\}\}/g) || []).length, slots, "译文槽位数不一致: " + t.pat.slice(0, 60));
    }
  }
});

test("r24 四条已在册：251 整段、ENIGMA/InSiGHT 列表项、免责声明整句成中文", () => {
  assert.equal(LONG.length, 251, "线上整段就是 251 字符");
  assert.ok(LONG.endsWith("without changing the locus."), "整句必须以末句收尾");

  const { engine } = boot("<p>hi</p>");
  assert.equal(engine.translateText(LONG), LONG_ZH);
  assert.equal(book.exact[LONG], LONG_ZH, "251 整段必须作为 exact 整条存在");
  assert.equal(
    engine.translateText(DISCLAIMER),
    "本工具仅供研究使用。如需个人医学或遗传学方面的建议，请咨询有资质的医生。"
  );
  assert.match(engine.translateText(ENIGMA_DESC), /^根据 ENIGMA VCEP 指南评估 BRCA1 与 BRCA2 上变异对疾病的潜在贡献$/);
  assert.match(engine.translateText(INSIGHT_DESC), /^根据 InSiGHT VCEP 指南评估 MLH1、MSH2、MSH6 与 PMS2 上变异对疾病的潜在贡献$/);

  // 反面：任何只收到半句/截断前缀的写法都不许留在库里（否则整句匹配永远被半句抢先）
  for (const b of [book, extra]) {
    for (const k of Object.keys(b.exact)) {
      if (!k.startsWith("These links provide")) continue;
      assert.equal(k, LONG, "库里存了截断/改写的长句: " + JSON.stringify(k).slice(0, 120));
    }
  }
});

test("推荐轨道集弹窗：整段与 7 条列表成中文，链接 href 不变", () => {
  const { doc } = boot(POPUP_HTML);
  const popup = doc.getElementById("recTrackSetsPopup");
  assert.ok(popup, "弹窗节点在 scope 内");

  const para = popup.querySelector("p");
  assert.equal(plain(para), LONG_ZH, "251 字符整段应整段成中文");
  assert.doesNotMatch(plain(para), /[A-Za-z]{4,}/, "整段不应残留英文单词");

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

  // 链接地址与顺序不变
  const links = [...popup.querySelectorAll("a.recTrackSetLink")];
  assert.deepEqual(
    links.map((a) => a.getAttribute("href")),
    [
      "./hgTracks?rtsLoad=Clinical_SNVs_hg38",
      "./hgTracks?rtsLoad=Clinical_CNVs_hg38",
      "./hgTracks?rtsLoad=Non_Coding_SNVs_hg38",
      "./hgTracks?rtsLoad=Exon_Relevance_hg38",
      "./hgTracks?rtsLoad=Problematic_Regions_hg38",
      "./hgTracks?rtsLoad=BRCA1_BRCA2_ENIGMA_hg38",
      "./hgTracks?rtsLoad=insightVcepHg38"
    ]
  );

  const reset = [...popup.querySelectorAll("p")].find((p) => /hgt\.reset=on/.test(p.innerHTML));
  assert.ok(reset, "重置句还在");
  assert.equal(plain(reset), "返回到默认浏览器轨道。");
  assert.equal(reset.querySelector("a").getAttribute("href"), "./hgTracks?hgt.reset=on");

  assert.match(plain(popup), /本工具仅供研究使用。如需个人医学或遗传学方面的建议，请咨询有资质的医生。$/);
  assert.doesNotMatch(plain(popup), /research use only/);
});

test("r25 新增三条长 tooltip：整句成中文，mouseovertext/title 通道都命中，链接不变", () => {
  const { engine } = boot("<p>hi</p>");
  for (const [en, zh] of R25) {
    assert.ok(en.length >= 80, "线上这三条都 ≥80 字符: " + en.length);
    assert.match(en, /\.$/, "只收以句号收尾的整句");
    assert.equal(book.exact[en], zh, "新词条必须在 ucsc 册: " + en.slice(0, 40));
    assert.equal(engine.translateText(en), zh, "translateText 必须整句命中: " + en.slice(0, 40));
    assert.doesNotMatch(zh, /https?:\/\//i);
  }

  // 站点 attrs 里挂了 mouseovertext（hgTracks 轨道链接用它），DEFAULT_ATTRS 里还有 title
  const attrs = ["mouseovertext", "title"];
  for (const en of R25.map(([k]) => k)) {
    const zh = book.exact[en];
    const html = attrs
      .map(
        (a, i) =>
          '<p><a id="l' + i + '" href="./hgTrackUi?db=hg38&g=cosmicRegions" ' + a + '="' + en + '">COSMIC</a></p>'
      )
      .join("");
    const { doc } = boot(html);
    attrs.forEach((a, i) => {
      const el = doc.getElementById("l" + i);
      assert.equal(el.getAttribute(a), zh, a + " 通道未翻译: " + en.slice(0, 40));
      assert.equal(el.getAttribute("href"), "./hgTrackUi?db=hg38&g=cosmicRegions", "属性翻译不能改 href");
    });
  }

  // 轨道名（COSMIC Regions / ENCODE4 Regulation / ClinVar Variants）保留英文原名
  assert.match(book.exact[R25[0][0]], /COSMIC Regions/);
  assert.match(book.exact[R25[1][0]], /ENCODE4 Regulation/);
  assert.match(book.exact[R25[2][0]], /ClinVar Variants/);
});

test("首页长说明走模板：中文语序重排、链接 href 原样", () => {
  const { doc } = boot(POSTER_HTML, { url: "https://genome.ucsc.edu/" });
  const poster = plain(doc.getElementById("poster"));
  assert.match(poster, /^我们的海报展廊汇集了自 2015 年以来我们展示的30 张会议海报/);
  assert.match(poster, /主题包括变异解读、轨道 Hub 存储、quickLift、泛基因组数据与转座元件，全部可免费下载。$/);
  assert.doesNotMatch(poster, /collects more than|Topics include|free to download/);

  const href = (id) => [...doc.getElementById(id).querySelectorAll("a")].map((a) => a.getAttribute("href"));
  assert.deepEqual(href("poster"), [
    "/about/poster-gallery",
    "/about/posters",
    "/help/variant-interpretation",
    "/help/track-hubs",
    "/help/quicklift",
    "/help/pangenome",
    "/help/transposable"
  ]);
  assert.equal([...doc.getElementById("poster").querySelectorAll("a")].length, 7, "模板不能丢链接");

  const contact = plain(doc.getElementById("contact"));
  assert.match(contact, /^欢迎联系我们——若您有兴趣参加工作坊/);
  assert.match(contact, /请参阅我们的海报展廊。$/);
  assert.doesNotMatch(contact, /Feel free to|workshop|Poster Gallery/);
  assert.deepEqual(href("contact"), ["/contact", "/about/poster-gallery"]);
});

test("数据守门：登录号、坐标、rsID 不参与翻译，词库不把数据当键", () => {
  const { doc } = boot(POPUP_HTML);
  const spans = [...doc.querySelectorAll("span")].map(plain);
  assert.deepEqual(spans, ["NM_000546.6", "chr17:7660000-7680000", "rs28934578"]);

  for (const b of [book, extra]) {
    for (const k of Object.keys(b.exact)) {
      assert.doesNotMatch(k, /^(NM_|NR_|NP_|chr[0-9XY]+:\d+-\d+$|rs\d+$)/, "数据被当成词条: " + k.slice(0, 60));
    }
  }
});
