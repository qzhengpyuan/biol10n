// EMBL-EBI 首页（dict/ebi-home.json）回归：hero、检索占位符、经济影响报告卡片、活动卡片与日期句、
// 招聘/使命卡片、关于 EMBL 的两段（一段带「20 member states」链接的模板）、页脚法务行，以及必须保持
// 英文的新闻标题、课程详情正文与品牌名。站点词库栈按 config/sites.json 的 embl-ebi 再追加本册。
// 取证：Chrome 影子实例 CDP 9227 抓的真实 DOM（https://www.ebi.ac.uk/，2026-11-23）
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
const book = read("ebi-home.json");
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8"));
const site = sites.sites.find((s) => s.id === "embl-ebi");
const defaults = sites.defaults || {};

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;
const U = "https://www.ebi.ac.uk/";

// 站点词库栈：sites.json 里登记的那几册 + 本册。lead 把 ebi-home 接进 sites.json 之后，
// Set 会去重，两种状态下都成立。
const stack = [...new Set((site.dicts || ["common"]).concat("ebi-home"))];
const data = { exact: {}, rules: [], templates: [] };
for (const id of stack) {
  const p = path.join(root, "../dict", id + ".json");
  if (!fs.existsSync(p)) continue;
  const d = JSON.parse(fs.readFileSync(p, "utf8"));
  Object.assign(data.exact, d.exact || {});
  data.rules = data.rules.concat(d.rules || []);
  data.templates = data.templates.concat(d.templates || []);
}

const cfg = {
  scope: site.scope || "",
  block: defaults.block || "",
  attrs: [...(defaults.attrs || []), ...(site.attrs || [])],
  funcWords: site.funcWords !== false,
  proseGuard: site.proseGuard !== false,
  proseMax: site.proseMax || 120,
  proseExempt: site.proseExempt || "",
  rescan: false
};

function run(html) {
  const dom = new JSDOM('<div id="wrap">' + html + "</div>", { url: U });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site: cfg });
  engine.start();
  return dom.window.document;
}
const text = (el) => el.textContent.replace(/\s+/g, " ").trim();

test("词库结构：family/sites、条数、键值形态、规则锚定可编译、模板槽位连续", () => {
  assert.equal(book.meta.family, "ebi-home");
  assert.ok(book.meta.sites.includes("www.ebi.ac.uk"));
  assert.ok(book.meta.area.length > 0 && book.meta.note.length > 0, "meta 说明要有内容");
  const keys = Object.keys(book.exact);
  assert.ok(keys.length >= 30, "exact 只有 " + keys.length + " 条");
  assert.ok(book.rules.length >= 1, "rules 太少");
  assert.ok(book.templates.length >= 1, "templates 太少");

  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(!CJK.test(k), "键里不能有中文: " + k);
    assert.ok(CJK.test(v), "译文里必须有中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "键首尾不能有空白: " + JSON.stringify(k));
    assert.equal(v, v.trim(), "值首尾不能有空白: " + JSON.stringify(v));
    assert.ok(!/https?:\/\/|@[\w.-]+\.\w+/.test(v), "译文里不能有 URL/邮箱: " + k);
  }
  for (const r of book.rules) {
    assert.doesNotThrow(() => new RegExp(r.re), "坏正则: " + r.re);
    assert.ok(/^\^/.test(r.re) && /\$$/.test(r.re), "规则要锚定: " + r.re);
    assert.ok(CJK.test(r.to), "规则译文里必须有中文: " + r.re);
    // 无捕获组的规则（孤立连词）直接给译文；有捕获组的必须用到占位符
    if (new RegExp(r.re).exec("") || /(?<!\\)\(/.test(r.re)) {
      if (/\([^?]/.test(r.re)) assert.ok(/\$\d/.test(r.to), "带捕获组的规则要用到占位符: " + r.re);
    }
  }
  for (const t of book.templates) {
    const used = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.ok(used.length >= 1, "模板要带槽位: " + t.pat.slice(0, 40));
    const sorted = used.slice().sort((a, b) => a - b);
    sorted.forEach((n, i) => assert.equal(n, i + 1, "槽位必须从 1 连续: " + t.pat.slice(0, 40)));
    const zhUsed = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.deepEqual(zhUsed.slice().sort((a, b) => a - b), sorted, "译文槽位要与原文一致");
    assert.ok(t.pat.length >= 20, "模板原文太短（引擎不接受 <20 字符）");
  }
});

test("hero 与检索框：kicker/subheading/占位符翻，标题与品牌名保持原样", () => {
  const doc = run(
    '<section class="vf-hero"><div class="vf-hero__content">' +
      "<p class=\"vf-hero__kicker\">EMBL's European Bioinformatics Institute</p>" +
      '<h1 class="vf-hero__heading">EMBL-EBI</h1>' +
      '<p class="vf-hero__subheading">Unleashing the potential of big data in biology</p>' +
      '<input name="query" type="search" placeholder="Find a gene, protein or chemical" id="searchitem">' +
      '<select name="db" id="db"><optgroup label="Science search"><option value="genomes">Genomes &amp; metagenomes</option></optgroup></select>' +
      "</div></section>"
  );
  assert.equal(text(doc.querySelector(".vf-hero__kicker")), "EMBL 欧洲生物信息学研究所");
  assert.equal(text(doc.querySelector(".vf-hero__subheading")), "释放生物学大数据的潜力");
  assert.equal(text(doc.querySelector("h1")), "EMBL-EBI", "机构名不翻");
  assert.equal(doc.querySelector("input").getAttribute("placeholder"), "检索基因、蛋白质或化合物");
  // OPTGROUP 的分组名走引擎的 label 通道（不在默认属性表里，引擎单独处理）
  assert.equal(doc.querySelector("optgroup").getAttribute("label"), "科学检索");
});

test("经济影响报告卡片：标题、说明与「Read report」链接（链接文字带尾随空格）", () => {
  const doc = run(
    '<section class="vf-hero"><div class="vf-hero__content">' +
      '<h2 class="vf-hero__heading">EMBL-EBI economic impact report</h2>' +
      '<p class="vf-hero__subheading">Explore the economic and scientific value of the open data resources managed by EMBL-EBI</p>' +
      '<a class="vf-hero__link" href="https://www.ebi.ac.uk/about/our-impact/2026-impact-report/">Read report </a>' +
      "</div></section>"
  );
  assert.equal(text(doc.querySelector("h2")), "EMBL-EBI 经济影响报告");
  assert.equal(
    text(doc.querySelector(".vf-hero__subheading")),
    "了解 EMBL-EBI 所管理的开放数据资源在经济与科学上的价值"
  );
  const a = doc.querySelector("a");
  assert.equal(text(a), "阅读报告");
  assert.equal(a.getAttribute("href"), "https://www.ebi.ac.uk/about/our-impact/2026-impact-report/");
});

test("活动卡片：日期区间规则、「课程/线上」标签与课程名翻，隐藏的课程详情正文不动", () => {
  const desc =
    "In this course, we will guide you through the core technology, data analysis approaches, tools, and " +
    "resources used in RNA sequencing (RNA-seq) and transcriptomics. Our goal is to support you as you build " +
    "a shared understanding of the field, whether your background is in biology, computer science, or data analysis.";
  const doc = run(
    '<section class="vf-summary-container"><div class="vf-grid">' +
      '<article class="vf-summary vf-summary--event">' +
      '<p class="vf-summary__date">22 Feb 2027 - 26 Feb 2027</p>' +
      '<h3 class="vf-summary__title"><a class="vf-link vf-summary__link" href="https://www.ebi.ac.uk/training/events/x-2027">Introduction to RNA-seq and functional interpretation </a></h3>' +
      '<p class="vf-summary__text">' + desc + "</p>" +
      '<p class="vf-summary__text">Course</p>' +
      '<p class="vf-summary__location">Virtual</p>' +
      "</article>" +
      '<article class="vf-summary vf-summary--event">' +
      '<p class="vf-summary__date">08 Mar 2027 - 12 Mar 2027</p>' +
      '<h3 class="vf-summary__title"><a class="vf-link vf-summary__link" href="https://www.ebi.ac.uk/training/events/y-2027">Introduction to multi-omics data integration and visualisation</a></h3>' +
      '<p class="vf-summary__text">Course</p>' +
      '<p class="vf-summary__location">EMBL-EBI</p>' +
      "</article></div></section>"
  );
  const dates = [...doc.querySelectorAll(".vf-summary__date")].map((e) => text(e));
  // 日期里的前导零不改写（"08 Mar" 原样给出 08），只重排语序、换月名
  assert.deepEqual(dates, ["2027 年 2 月 22 日 – 2027 年 2 月 26 日", "2027 年 3 月 08 日 – 2027 年 3 月 12 日"]);
  assert.deepEqual(
    [...doc.querySelectorAll("h3")].map((e) => text(e)),
    ["RNA 测序与功能解读入门", "多组学数据整合与可视化入门"]
  );
  assert.deepEqual([...doc.querySelectorAll(".vf-summary__text")].map((e) => text(e)), [desc, "课程", "课程"]);
  assert.deepEqual(
    [...doc.querySelectorAll(".vf-summary__location")].map((e) => text(e)),
    ["线上", "EMBL-EBI"]
  );
});

test("新闻卡片：标题正文保持英文，卡片图片 alt 翻", () => {
  const doc = run(
    '<article class="vf-summary vf-summary--news">' +
      '<span class="vf-summary__date">11 November 2026</span>' +
      '<img src="x.png" alt="News image" class="vf-summary__image">' +
      '<h3 class="vf-summary__title"><a class="vf-summary__link" href="/about/news/x">Ewan Birney awarded ‘Lombardy is Research’ prize</a></h3>' +
      "</article>"
  );
  assert.equal(doc.querySelector("img").getAttribute("alt"), "新闻图片");
  assert.equal(text(doc.querySelector("h3")), "Ewan Birney awarded ‘Lombardy is Research’ prize", "新闻标题是正文，不翻");
});

test("招聘区：区块标题与三张卡片（标题 + 说明）", () => {
  const doc = run(
    '<section id="wp-block-careers"><div class="vf-card-container__inner">' +
      '<h2 class="vf-section-header__heading"><a class="vf-section-header__heading--is-link" href="/careers">Careers</a></h2>' +
      '<article class="vf-card"><a class="vf-card__link" href="/careers/recruitment">Recruitment: What to expect</a>' +
      '<p class="vf-card__text">Everything you need to know about EMBL-EBI’s recruitment process.</p></article>' +
      '<article class="vf-card"><a class="vf-card__link" href="/careers/working">Careers at EMBL-EBI</a>' +
      '<p class="vf-card__text">Focus your energy and skills on something that really matters: using technology to contribute to discoveries that benefit humankind.</p></article>' +
      '<article class="vf-card"><a class="vf-card__link" href="/careers/international">International applicants</a>' +
      '<p class="vf-card__text">We recruit staff from all over the world and offer exemption from UK immigration restrictions.</p></article>' +
      "</div></section>"
  );
  assert.equal(text(doc.querySelector("h2")), "招聘");
  assert.deepEqual(
    [...doc.querySelectorAll(".vf-card__link")].map((e) => text(e)),
    ["招聘流程：会经历什么", "在 EMBL-EBI 工作", "国际申请人"]
  );
  assert.deepEqual(
    [...doc.querySelectorAll(".vf-card__text")].map((e) => text(e)),
    [
      "关于 EMBL-EBI 招聘流程，你需要了解的一切。",
      "把精力与技能投入真正重要的事：用技术推动造福人类的发现。",
      "我们面向全球招聘，并提供英国入境限制的豁免。"
    ]
  );
});

test("使命区：区块标题、五张卡片标题与说明、ELIXIR 卡", () => {
  const doc = run(
    '<section id="wp-block-1"><h2 class="vf-section-header__heading">EMBL-EBI missions</h2>' +
      '<article class="vf-card"><a class="vf-card__link" href="/about/our-impact">We are EMBL-EBI: Our impact</a>' +
      '<p class="vf-card__text">The European Bioinformatics Institute (EMBL-EBI) is part of EMBL, Europe’s flagship laboratory for the life sciences. More about EMBL-EBI and our impact.</p></article>' +
      '<article class="vf-card"><a class="vf-card__link" href="/services">Data resources</a>' +
      '<p class="vf-card__text">Explore our open data resources to enrich your research. Browse data, perform analyses or share your own results.</p></article>' +
      '<article class="vf-card"><a class="vf-card__link" href="/research">Research</a>' +
      '<p class="vf-card__text">Find out about our research groups, postdoctoral schemes and PhD Programme.</p></article>' +
      '<article class="vf-card"><a class="vf-card__link" href="/training">Training</a>' +
      '<p class="vf-card__text">Access a wealth of world-leading training in bioinformatics and scientific service provision, regardless of your career stage or sector.</p></article>' +
      '<article class="vf-card"><a class="vf-card__link" href="/industry">Industry</a>' +
      '<p class="vf-card__text">Explore our knowledge-exchange Industry Programme and take part in translational partnerships and projects.</p></article>' +
      '<article class="vf-card"><a class="vf-card__link" href="/elixir">ELIXIR</a>' +
      '<p class="vf-card__text">We support, as an ELIXIR node, the coordination of biological data provision throughout Europe.</p></article>' +
      "</section>"
  );
  assert.equal(text(doc.querySelector("h2")), "EMBL-EBI 使命");
  const texts = [...doc.querySelectorAll(".vf-card__text")].map((e) => text(e));
  assert.equal(
    texts[0],
    "欧洲生物信息学研究所（EMBL-EBI）隶属于 EMBL，后者是欧洲生命科学的旗舰实验室。进一步了解 EMBL-EBI 与我们的影响。"
  );
  assert.equal(texts[1], "利用我们的开放数据资源丰富你的研究：浏览数据、开展分析，或分享自己的结果。");
  assert.equal(texts[2], "了解我们的研究组、博士后计划与博士项目。");
  assert.equal(
    texts[3],
    "无论处于哪个职业阶段、来自哪个领域，都能获得世界一流的生物信息学与科研服务培训。"
  );
  assert.equal(texts[4], "了解我们的知识交流产业计划，参与转化合作与项目。");
  assert.equal(texts[5], "作为 ELIXIR 节点，我们支持协调全欧洲的生物数据供给。");
  assert.equal(text(doc.querySelector('a[href="/elixir"]')), "ELIXIR", "品牌名不翻");
});

test("关于 EMBL：带 <br> 与「20 member states」链接的整段走模板，链接保留；下一段整条 exact", () => {
  const doc = run(
    '<div class="vf-content">' +
      "<p><br>EMBL’s European Bioinformatics Institute is one of the six sites of the European Molecular Biology " +
      "Laboratory (EMBL). With over&nbsp;<a href=\"https://www.embl.org/about/member-states/\">20 member states</a>" +
      "&nbsp;and thousands of scientists and engineers working together, EMBL is a powerhouse of biological expertise.</p>" +
      "<p>EMBL is an intergovernmental organisation, headquartered in Heidelberg. It was founded in 1974 with the " +
      "mission of promoting molecular biology research in Europe, training young scientists, and developing new technologies.</p>" +
      "</div>"
  );
  const [first, second] = [...doc.querySelectorAll("p")];
  assert.equal(
    text(first),
    "EMBL 欧洲生物信息学研究所是欧洲分子生物学实验室（EMBL）六个站点之一。EMBL 拥有超过 20 个成员国，" +
      "以及数千名并肩工作的科学家和工程师，是生物学专业实力的汇聚之地。"
  );
  const a = first.querySelector("a");
  assert.ok(a, "链接节点必须保留");
  assert.equal(text(a), "20 个成员国");
  assert.equal(a.getAttribute("href"), "https://www.embl.org/about/member-states/");
  assert.equal(
    text(second),
    "EMBL 是一个政府间组织，总部位于海德堡。它成立于 1974 年，使命是推动欧洲的分子生物学研究、培养青年科学家并开发新技术。"
  );
});

test("页脚「博士后 and 博士生」：孤立连词就地换「和」，两侧链接不动", () => {
  const doc = run(
    '<ul class="vf-links__list"><li class="vf-list__item vf-footer__notice">' +
      '<a class="vf-list__link" href="//www.ebi.ac.uk/research/postdocs">博士后</a> and ' +
      '<a class="vf-list__link" href="//www.ebi.ac.uk/research/eipp">博士生</a></li></ul>'
  );
  assert.equal(text(doc.querySelector("li")), "博士后和博士生");
  assert.equal(doc.querySelectorAll("a").length, 2, "两条链接都要保留");
});

test("页脚法务行：地址与电话翻，机构全称保持英文", () => {
  const doc = run(
    '<footer class="vf-footer"><p class="vf-footer__legal">' +
      '<span class="vf-footer__legal-text"><a class="vf-footer__link" href="https://maps.example/">EMBL-EBI, Wellcome Genome Campus, Hinxton, Cambridgeshire, CB10 1SD, UK.</a></span>' +
      '<span class="vf-footer__legal-text"><a class="vf-footer__link" href="tel:00441223494444">Tel: +44 (0)1223 49 44 44</a></span>' +
      '<span class="vf-footer__legal-text">EMBL-EBI is part of: <a class="vf-footer__link" href="https://www.embl.org">European Molecular Biology Laboratory</a></span>' +
      "</p></footer>"
  );
  const links = [...doc.querySelectorAll("a")].map((e) => text(e));
  assert.equal(links[0], "英国剑桥郡欣克斯顿 Wellcome 基因组园区 EMBL-EBI，CB10 1SD");
  assert.equal(links[1], "电话：+44 (0)1223 49 44 44");
  assert.equal(links[2], "European Molecular Biology Laboratory", "机构全称不翻");
});
