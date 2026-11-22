// AlphaFold DB / PDBe 补词回归（r22 P1-6）：两站首页与 /about 页的界面骨架、固定说明句、页脚与版权块
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

const afBook = JSON.parse(fs.readFileSync(path.join(root, "../dict/alphafold.json"), "utf8"));
const pdbeBook = JSON.parse(fs.readFileSync(path.join(root, "../dict/pdbe.json"), "utf8"));

// config/sites.json 里缺条目时用同款配置兜底（与 alphafold/pdbe 两册的既有测试一致）。
const afSite = sites.find((s) => s.id === "alphafold") || {
  id: "alphafold",
  hosts: ["alphafold.ebi.ac.uk"],
  dicts: ["common", "string-atlas", "alphafold"],
  scope: "body"
};
const pdbeSite = sites.find((s) => s.id === "pdbe") || {
  id: "pdbe",
  hosts: ["www.ebi.ac.uk"],
  path: "^/pdbe",
  dicts: ["common", "string-atlas", "pdbe"],
  scope: "body"
};

function stackData(site) {
  const data = { exact: {}, rules: [], templates: [] };
  for (const id of site.dicts) {
    const p = path.join(root, "../dict", id + ".json");
    if (!fs.existsSync(p)) continue;
    const b = JSON.parse(fs.readFileSync(p, "utf8"));
    Object.assign(data.exact, b.exact || {});
    data.rules = data.rules.concat(b.rules || []);
    data.templates = data.templates.concat(b.templates || []);
  }
  return data;
}

function run(site, html) {
  const dom = new JSDOM("<body>" + html + "</body>", { url: "https://" + site.hosts[0] + "/" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data: stackData(site), site });
  engine.start();
  return dom.window.document;
}
const text = (doc) => doc.body.textContent.replace(/\s+/g, " ").trim();

test("两册结构：条数、键值形态、规则可编译、模板槽位连续", () => {
  const books = [
    { book: afBook, family: "alphafold", host: "alphafold.ebi.ac.uk", minExact: 245, minRules: 22, minTpl: 8 },
    { book: pdbeBook, family: "pdbe", host: "www.ebi.ac.uk", minExact: 195, minRules: 8, minTpl: 2 }
  ];
  for (const { book, family, host, minExact, minRules, minTpl } of books) {
    assert.equal(book.meta.family, family);
    assert.ok(book.meta.sites.includes(host), family + " 的 meta.sites 要声明 host");
    assert.ok(Object.keys(book.exact).length >= minExact, family + " exact 条数不足: " + Object.keys(book.exact).length);
    assert.ok(book.rules.length >= minRules, family + " rules 条数不足");
    assert.ok(Array.isArray(book.templates) && book.templates.length >= minTpl, family + " templates 条数不足");
    for (const [k, v] of Object.entries(book.exact)) {
      assert.ok(!/[\u4e00-\u9fff]/.test(k), "键里不能有中文: " + k);
      assert.ok(/[\u4e00-\u9fff]/.test(v), "译文里必须有中文: " + k);
      assert.notEqual(k, v, "自映射: " + k);
      assert.equal(k, k.trim(), "键首尾不能有空白: " + JSON.stringify(k));
      assert.equal(v, v.trim(), "值首尾不能有空白: " + JSON.stringify(k));
      assert.ok(!/@[\w.-]+\.[a-z]/i.test(v), "译文里不能有邮箱: " + k);
    }
    for (const r of book.rules) {
      assert.ok(new RegExp(r.re).source.length > 0);
      assert.ok(/[\u4e00-\u9fff]/.test(r.to), "规则译文里必须有中文: " + r.re);
      if (/\([^)]*\)/.test(r.re)) assert.ok(/\$\d/.test(r.to), "带捕获组的规则要用到占位符: " + r.re);
    }
    for (const t of book.templates) {
      const used = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
      assert.ok(used.length >= 1, "模板要带槽位: " + t.pat);
      assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, "模板长度越界: " + t.pat.length);
      used.slice().sort((a, b) => a - b).forEach((n, i) => assert.equal(n, i + 1, "槽位必须从 1 连续: " + t.pat));
      const zhUsed = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
      assert.deepEqual(zhUsed.slice().sort((a, b) => a - b), used.slice().sort((a, b) => a - b), "译文槽位要与原文一致");
    }
  }
});

test("AlphaFold 本册收词：导航、首页固定件、引用与版权块、页脚（不只靠 string-atlas）", () => {
  const want = {
    "About us": "关于我们",
    Training: "培训",
    Research: "研究",
    Services: "服务",
    Downloads: "下载",
    "Protein Structure Database": "蛋白质结构数据库",
    "See our updates – October 2026": "查看我们的更新 – 2026 年 10 月",
    "high accuracy": "高精度",
    limitations: "局限性",
    "FAQs,": "常见问题",
    "open source code": "开源代码",
    "If you use this resource, please cite the following papers:": "如使用本资源，请引用以下论文：",
    "AlphaFold Data Provided by GDM:": "AlphaFold 数据由 GDM 提供：",
    "For AlphaFold Data provided by third party data providers:": "第三方数据提供方提供的 AlphaFold 数据：",
    "AlphaMissense Copyright (2023) DeepMind Technologies Limited.": "AlphaMissense 数据版权（2023）DeepMind Technologies Limited。",
    "People and groups": "人员与团队",
    "Full contact details": "完整联系方式",
    "Copyright © EMBL 2023": "版权所有 © EMBL 2023",
    "EMBL-EBI is part of the": "EMBL-EBI 是以下机构的一部分：",
    "European Molecular Biology Laboratory": "欧洲分子生物学实验室",
    "Back to AlphaFold Protein Structure Database homepage": "返回 AlphaFold 蛋白质结构数据库主页",
    "Previous cards": "上一组卡片",
    "Next cards": "下一组卡片"
  };
  for (const [k, v] of Object.entries(want)) {
    assert.equal(afBook.exact[k], v, "alphafold 册缺词或译法不一致: " + k);
  }
});

test("AlphaFold 首页：导航与固定件在页面上真的翻成中文", () => {
  const doc = run(
    afSite,
    '<nav><a href="/about">About us</a><a href="/training">Training</a><a href="/research">Research</a>' +
      '<a href="/services">Services</a><a href="/download">Downloads</a><a href="/api-docs">API</a></nav>' +
      '<div class="afLogoSubtitle"><span>Protein Structure Database</span></div>' +
      '<a href="/#news"><span>See our updates – October 2026</span></a>' +
      '<button aria-label="Previous cards"></button><button aria-label="Next cards"></button>' +
      '<a title="Back to AlphaFold Protein Structure Database homepage" href="/">AlphaFold</a>'
  );
  const nav = [...doc.querySelectorAll("nav a")].map((e) => e.textContent);
  // API 不译：既有 test/alphafold.test.mjs 已把导航里的 API 钉为原文，本册不再收该键
  assert.deepEqual(nav, ["关于我们", "培训", "研究", "服务", "下载", "API"]);
  assert.equal(doc.querySelector(".afLogoSubtitle span").textContent, "蛋白质结构数据库");
  assert.equal(doc.querySelector('#news, a[href="/#news"]').textContent, "查看我们的更新 – 2026 年 10 月");
  const btns = [...doc.querySelectorAll("button")];
  assert.deepEqual(btns.map((b) => b.getAttribute("aria-label")), ["上一组卡片", "下一组卡片"]);
  assert.equal(doc.querySelector("a[title]").getAttribute("title"), "返回 AlphaFold 蛋白质结构数据库主页");
  assert.equal(doc.querySelector("a[title]").getAttribute("href"), "/", "链接地址不能改");
});

test("AlphaFold 引用与版权块：正文固定说明句 + data copyright 规则", () => {
  const doc = run(
    afSite,
    "<div class='cite'>" +
      "<p>If you use this resource, please cite the following papers:</p>" +
      "<p>AlphaFold Data Provided by GDM:</p>" +
      "<p>AlphaFold Data Copyright (2022) DeepMind Technologies Limited.</p>" +
      "<p>For AlphaFold Data provided by third party data providers:</p>" +
      "<p>Kinetoplastid data copyright (2025) Wheeler Lab</p>" +
      "</div>"
  );
  const ps = [...doc.querySelectorAll(".cite p")].map((e) => e.textContent);
  assert.deepEqual(ps, [
    "如使用本资源，请引用以下论文：",
    "AlphaFold 数据由 GDM 提供：",
    "AlphaFold 数据版权（2022）DeepMind Technologies Limited。",
    "第三方数据提供方提供的 AlphaFold 数据：",
    "Kinetoplastid 数据版权（2025）Wheeler Lab。"
  ]);
});

test("AlphaFold 计数规则：portal 卡片 entries 与既有 AFDB 规则并存", () => {
  const doc = run(
    afSite,
    '<div class="cards"><p class="portal-card-entries">514,962 entries</p>' +
      "<p>21,654,079 entries</p>" +
      '<p><span>Found in</span><span>9 entries in AFDB</span></p></div>'
  );
  assert.deepEqual([...doc.querySelectorAll(".portal-card-entries")].map((e) => e.textContent), ["514,962 个条目"]);
  const txt = text(doc);
  assert.ok(txt.includes("21,654,079 个条目"), txt);
  assert.ok(txt.includes("9 个 AFDB 条目"), "既有规则不能被新规则挤掉: " + txt);
});

test("AlphaFold 模板：CASP 段整段翻，三个链接原位保留", () => {
  const doc = run(
    afSite,
    '<p class="large-text">In <a href="https://predictioncenter.org/casp14/zscores_final.cgi">CASP14</a>, ' +
      "AlphaFold was the top-ranked protein structure prediction method by a large margin, producing predictions with " +
      '<a href="/faq#faq-3">high accuracy</a>. While the system still has some <a href="/faq#faq-6">limitations</a>, ' +
      "the CASP results suggest AlphaFold has immediate potential to help us understand the structure of proteins and advance biological research. </p>"
  );
  const p = doc.querySelector("p");
  const t = p.textContent.replace(/\s+/g, " ").trim();
  assert.ok(t.startsWith("在CASP14中，AlphaFold 以显著优势成为排名第一的蛋白质结构预测方法"), t);
  assert.ok(t.includes("其预测达到高精度"), t);
  assert.ok(t.includes("仍存在一些局限性"), t);
  assert.ok(!/top-ranked protein structure prediction method/.test(t), "整段不该留英文: " + t);
  const links = [...p.querySelectorAll("a")];
  assert.equal(links.length, 3, "三个链接都不能丢");
  assert.deepEqual(links.map((a) => a.getAttribute("href")), [
    "https://predictioncenter.org/casp14/zscores_final.cgi",
    "/faq#faq-3",
    "/faq#faq-6"
  ]);
});

test("AlphaFold 模板：开源代码段与 FAQ 段（邮箱与 FAQ 链接保留）", () => {
  const doc = run(
    afSite,
    '<p class="normal-text">If your use case isn\'t covered by the database, you can generate your own AlphaFold predictions using this ' +
      '<a href="https://github.com/deepmind/alphafold/">open source code</a>, which also supports multimer prediction. </p>' +
      '<p class="faq-line">Let us know how the AlphaFold Protein Structure Database has been useful in your research, ' +
      "or if you have questions not answered in the <a href=\"/faq\">FAQs,</a> at " +
      '<a href="mailto:alphafold@deepmind.com">alphafold@deepmind.com</a>. </p>'
  );
  const [p1, p2] = [...doc.querySelectorAll("p")];
  const t1 = p1.textContent.replace(/\s+/g, " ").trim();
  assert.ok(t1.includes("你可以使用这份开源代码自行生成 AlphaFold 预测"), t1);
  assert.equal(p1.querySelector("a").getAttribute("href"), "https://github.com/deepmind/alphafold/");
  const t2 = p2.textContent.replace(/\s+/g, " ").trim();
  assert.ok(t2.includes("问题发送到常见问题"), t2);
  assert.ok(t2.includes("alphafold@deepmind.com"), "邮箱是数据，不能被翻掉: " + t2);
  assert.equal(p2.querySelectorAll("a")[1].getAttribute("href"), "mailto:alphafold@deepmind.com");
});

test("AlphaFold 页脚：栏目、版权与 EMBL 从属句", () => {
  const doc = run(
    afSite,
    '<footer><ul><li><a href="/about/people">People and groups</a></li></ul>' +
      "<p>Copyright © EMBL 2023</p>" +
      '<p>EMBL-EBI is part of the <a href="//www.embl.org">European Molecular Biology Laboratory</a></p>' +
      '<p><a href="//www.ebi.ac.uk/about/contact">Full contact details</a></p></footer>'
  );
  const txt = text(doc);
  assert.ok(txt.includes("人员与团队"), txt);
  assert.ok(txt.includes("版权所有 © EMBL 2023"), txt);
  assert.ok(txt.includes("EMBL-EBI 是以下机构的一部分：欧洲分子生物学实验室"), txt);
  assert.ok(txt.includes("完整联系方式"), txt);
  assert.equal(doc.querySelector("footer a[href='//www.embl.org']").getAttribute("href"), "//www.embl.org");
});

test("PDBe 本册收词：EMBL 六站点块、研究方向、页脚与关于页", () => {
  const want = {
    "Skip to main content": "跳到主要内容",
    "More about EMBL": "进一步了解 EMBL",
    "Six sites": "六个站点",
    "represent EMBL in Europe.": "代表 EMBL 在欧洲的布局。",
    "Tissue biology and disease modelling": "组织生物学与疾病建模",
    "Structural biology": "结构生物学",
    "Main laboratory": "主实验室",
    "Epigenetics and neurobiology": "表观遗传学与神经生物学",
    "EMBL-EBI: European Bioinformatics Institute": "EMBL-EBI：欧洲生物信息研究所",
    Bluesky: "Bluesky 社交平台",
    "People and groups": "人员与团队",
    "Full contact details": "完整联系方式",
    "EMBL-EBI is part of the": "EMBL-EBI 是以下机构的一部分：",
    "European Molecular Biology Laboratory": "欧洲分子生物学实验室",
    "Copyright © EMBL 2026": "版权所有 © EMBL 2026",
    Objectives: "目标",
    Activities: "主要工作",
    "PDBe News": "PDBe 新闻",
    "Site header": "站点页头",
    "At least 3 characters": "至少 3 个字符",
    "Share Buttons": "分享按钮",
    mail: "邮件"
  };
  for (const [k, v] of Object.entries(want)) {
    assert.equal(pdbeBook.exact[k], v, "pdbe 册缺词或译法不一致: " + k);
  }
});

test("PDBe 首页：EMBL 六站点块与研究方向名翻成中文", () => {
  const doc = run(
    pdbeSite,
    '<a href="#main-content">Skip to main content</a>' +
      '<div class="embl-block"><h3 class="inline">Six sites</h3><p>represent EMBL in Europe.</p>' +
      '<h3><a href="//embl.org">More about EMBL</a></h3>' +
      "<h5><a>Barcelona</a></h5><p>Tissue biology and disease modelling</p>" +
      "<h5><a>Grenoble</a></h5><p>Structural biology</p>" +
      "<h5><a>Heidelberg</a></h5><p>Main laboratory</p>" +
      "<h5><a>Hinxton</a></h5><p>EMBL-EBI: European Bioinformatics Institute</p>" +
      "<h5><a>Rome</a></h5><p>Epigenetics and neurobiology</p></div>"
  );
  const txt = text(doc);
  assert.ok(txt.includes("跳到主要内容"), txt);
  assert.ok(txt.includes("六个站点"), txt);
  assert.ok(txt.includes("代表 EMBL 在欧洲的布局。"), txt);
  assert.ok(txt.includes("进一步了解 EMBL"), txt);
  const dirs = [...doc.querySelectorAll(".embl-block p")].map((e) => e.textContent);
  assert.deepEqual(dirs, [
    "代表 EMBL 在欧洲的布局。",
    "组织生物学与疾病建模",
    "结构生物学",
    "主实验室",
    "EMBL-EBI：欧洲生物信息研究所",
    "表观遗传学与神经生物学"
  ]);
  assert.deepEqual([...doc.querySelectorAll(".embl-block h5 a")].map((e) => e.textContent), [
    "Barcelona",
    "Grenoble",
    "Heidelberg",
    "Hinxton",
    "Rome"
  ], "站点城市名是数据，不翻");
});

test("PDBe 页脚与关于页：版权、联系方式、Objectives/Activities", () => {
  const doc = run(
    pdbeSite,
    '<footer><p>Copyright © EMBL 2026</p>' +
      '<p>EMBL-EBI is part of the <a href="//www.embl.org">European Molecular Biology Laboratory</a></p>' +
      '<p><a href="//www.ebi.ac.uk/about/contact">Full contact details</a></p>' +
      '<ul><li><a href="/pdbe/about/people">People and groups</a></li><li><a href="/pdbe/news">PDBe News</a></li></ul></footer>' +
      '<div class="about"><h3 class="item-header">Objectives</h3><h3 class="item-header">Activities</h3></div>'
  );
  const txt = text(doc);
  assert.ok(txt.includes("版权所有 © EMBL 2026"), txt);
  assert.ok(txt.includes("EMBL-EBI 是以下机构的一部分：欧洲分子生物学实验室"), txt);
  assert.ok(txt.includes("完整联系方式"), txt);
  assert.ok(txt.includes("人员与团队"), txt);
  assert.ok(txt.includes("PDBe 新闻"), txt);
  assert.deepEqual([...doc.querySelectorAll(".about h3")].map((e) => e.textContent), ["目标", "主要工作"]);
});

test("PDBe 属性通道：站点页头、输入框说明与分享按钮", () => {
  const doc = run(
    pdbeSite,
    '<header aria-label="Site header"></header>' +
      '<input id="q" title="At least 3 characters" placeholder="Ex. - hemoglobin, BRCA1_HUMAN">' +
      '<a title="Share Buttons" href="#share"></a>' +
      '<a aria-label="mail" href="mailto:pdbe@ebi.ac.uk"></a>' +
      '<a title="The homepage for the PDB Art project" href="/pdbe/pdb-art"></a>'
  );
  assert.equal(doc.querySelector("header").getAttribute("aria-label"), "站点页头");
  const input = doc.querySelector("input");
  assert.equal(input.getAttribute("title"), "至少 3 个字符");
  assert.equal(input.getAttribute("placeholder"), "例：hemoglobin、BRCA1_HUMAN");
  const links = [...doc.querySelectorAll("a")];
  assert.equal(links[0].getAttribute("title"), "分享按钮");
  assert.equal(links[1].getAttribute("aria-label"), "邮件");
  assert.equal(links[2].getAttribute("title"), "PDB 艺术项目主页");
  assert.equal(links[2].getAttribute("href"), "/pdbe/pdb-art");
});

test("数据不动：登录号、作者、蛋白名、DOI、邮箱与数值", () => {
  const af = run(
    afSite,
    '<div class="meta"><span>AF-P04637-F1</span><span>P04637</span><span>Homo sapiens</span>' +
      "<span>Bertoni D.</span><span>CC-BY-4.0</span>" +
      '<a href="mailto:afdbhelp@ebi.ac.uk">afdbhelp@ebi.ac.uk</a>' +
      "<span>Q8I3H7: May protect the malaria parasite against attack by the immune system. Mean pLDDT 85.57.</span></div>"
  );
  assert.deepEqual([...af.querySelectorAll(".meta span")].map((e) => e.textContent), [
    "AF-P04637-F1",
    "P04637",
    "Homo sapiens",
    "Bertoni D.",
    "CC-BY-4.0",
    "Q8I3H7: May protect the malaria parasite against attack by the immune system. Mean pLDDT 85.57."
  ]);
  assert.equal(af.querySelector("a").textContent, "afdbhelp@ebi.ac.uk");

  const pd = run(
    pdbeSite,
    '<div class="meta"><span>1cbs</span><span>pdb_00001cbs</span><span>Homo sapiens</span>' +
      "<span>10.1016/s0969-2126(94)00125-1</span><span>Kleywegt, G.J.</span><span>263157</span>" +
      "<span>Nucleic acids research,</span></div>"
  );
  assert.deepEqual([...pd.querySelectorAll(".meta span")].map((e) => e.textContent), [
    "1cbs",
    "pdb_00001cbs",
    "Homo sapiens",
    "10.1016/s0969-2126(94)00125-1",
    "Kleywegt, G.J.",
    "263157",
    "Nucleic acids research,"
  ]);
});
