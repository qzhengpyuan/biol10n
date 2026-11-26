// ProteomeXchange（www.proteomexchange.org）词库回归：首页（使命、公开数据、数据提交、订阅、成员仓库、
// 发表文献、全球核心生物数据资源）、/submission 提交入口、/subscribe 订阅方式、/contact 协调人页、页脚。
// 站点是纯静态 GitHub Pages（仓库里只有 index / submission / contact 三页，subscribe 由站点补上，
// 实测四页可访问；/datasets、/help 都不存在，数据浏览在 ProteomeCentral，另一个 host）。
// 带链接的整段必须走模板通道：链接节点、href、可点击性都要原样保留。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/proteomexchange.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "proteomexchange");
assert.ok(site, "config/sites.json 必须有 id=proteomexchange 的站点条目");

function loadStack() {
  const exact = {}, rules = [], templates = [];
  for (const id of site.dicts) {
    const b = JSON.parse(fs.readFileSync(path.join(root, "../dict", id + ".json"), "utf8"));
    Object.assign(exact, b.exact || {});
    rules.push(...(b.rules || []));
    templates.push(...(b.templates || []));
  }
  return { exact, rules, templates };
}

function boot(html) {
  const dom = new JSDOM("<body>" + html + "</body>");
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: loadStack(),
    site: { ...site, rescan: false }
  });
  engine.start();
  return { doc: dom.window.document, engine };
}

const squash = (s) => String(s).replace(/\s+/g, " ").trim();

// 首页：照 index.html 的真实结构（h2 里带 octicon 锚点、段落里夹链接）。
const HOME = [
  '<section class="main-content">',
  '<h2><a id="welcome-to-github-pages" class="anchor" href="#welcome-to-github-pages" aria-hidden="true"><span aria-hidden="true" class="octicon octicon-link"></span></a>Mission</h2>',
  '<p>The ProteomeXchange Consortium was established to provide globally coordinated standard data submission and dissemination pipelines involving the main proteomics repositories, and to encourage open data policies in the field. Please review our <a href="docs/guidelines_px.pdf">Data Submission Guidelines</a>, <a href="docs/reprocessed_guidelines_px.pdf">Guidelines for Reprocessed datasets</a> and <a href="pxcollaborativeagreement_2024.pdf">PX Membership Agreement</a>.</p>',
  '<p>See also the <a href="http://www.nature.com/nbt/journal/v32/n3/full/nbt.2839.html">original Nature Biotechnology publication</a> and the <a href="https://academic.oup.com/nar/article-lookup/doi/10.1093/nar/gkw936">2017</a>, <a href="https://academic.oup.com/nar/article/48/D1/D1145/5612546">2020</a> and <a href="https://academic.oup.com/nar/article/51/D1/D1539/6825347"> 2023</a> update papers.</p>',
  '<h2>Public Data</h2>',
  '<p>Public PXD datasets can be browsed over at <a href="http://proteomecentral.proteomexchange.org/cgi/GetDataset">ProteomeCentral</a>. An <a href="https://groups.google.com/forum/feed/proteomexchange/msgs/rss_v2_0.xml">RSS feed</a> is also available.</p>',
  '<h2>Data Submission</h2>',
  '<p>ProteomeXchange fully supports both MS/MS proteomics and SRM data submission. Submissions of other types of proteomics data is also possible using the Partial Submission mechanism.</p>',
  '<h2>Subscribe</h2>',
  '<p>Subscribe to receive all new ProteomeXchange announcements!</p>',
  '<h2>Member repositories</h2>',
  '<p>The current members of the Consortium are: <a href="http://www.ebi.ac.uk/pride/archive/">PRIDE</a> (EMBL-EBI, Cambridge, UK), <a href="http://www.peptideatlas.org/">PeptideAtlas</a> (ISB, Seattle, WA, USA) (both of them are the founding members),  <a href="http://massive.ucsd.edu/ProteoSAFe/static/massive.jsp">MassIVE</a> (UCSD, San Diego, CA, USA), <a href="http://jpost.org/">jPOST</a> (various institutions, Japan), <a href="http://www.iprox.org/">iProx</a> (National Center for Protein Sciences, Beijing, China) and <a href="https://panoramaweb.org/project/home/begin.view?">Panorama Public</a> (University of Washington, Seattle, WA, USA)”.</p>',
  '<h2>Publication</h2>',
  '<p>Deutsch EW, Bandeira N, Perez-Riverol Y, Sharma V, Carver JJ, Mendoza L, Kundu DJ, Wang S, Bandla C, Kamatchinathan S, Hewapathirana S, Pullman BS, Wertz J, Sun Z, Kawano S, Okuda S, Watanabe Y, MacLean B, MacCoss MJ, Zhu Y, Ishihama Y, Vizcaíno JA. The ProteomeXchange consortium at 10 years: 2023 update. Nucleic Acids Res. 2023 Jan 6;51(D1):D1539-D1548. doi: 10.1093/nar/gkac1040. PMID: 36370099; PMCID: PMC9825490. (<a href="https://academic.oup.com/nar/article/51/D1/D1539/6825347">Manuscript</a>)</p>',
  '<h2>Global Biodata Coalition</h2>',
  '<p>ProteomeXchange is a Global Core Biodata Resource, which are those biodata resources that are of fundamental importance to the wider biological and life sciences community and the long term preservation of biological data</p>',
  '<footer class="site-footer">',
  '<span class="site-footer-credits">This page was developed by ProteomeXchange Team <a href="contact/">Contact Us</a></span>',
  '</footer>',
  '</section>'
].join("\n");

const SUBMISSION = [
  '<section class="main-content">',
  '<h2><a id="creating-pages-manually" class="anchor" href="#creating-pages-manually" aria-hidden="true"><span aria-hidden="true" class="octicon octicon-link"></span></a>Data submission</h2>',
  '<p>ProteomeXchange supports submission of experiments coming from all proteomics data workflows.</p>',
  '<h3><a id="authors-and-contributors" class="anchor" href="#authors-and-contributors" aria-hidden="true"></a>PRIDE - PRoteomics IDEntifications Database</h3>',
  '<a href="http://www.ebi.ac.uk/pride/"><img src="pride_logo.jpg"></a>',
  'The GUI based PX Submission Tool can be <a href="https://github.com/PRIDE-Archive/px-submission-tool/releases/latest/download/px-submission-tool-latest.zip">downloaded</a> to start data upload.',
  '<h3><a id="support-or-contact" class="anchor" href="#support-or-contact" aria-hidden="true"></a>PeptideAtlas - PASSEL</h3>',
  '<p>SRM/MRM data can be submitted to <a href="http://www.peptideatlas.org/passel/">PASSEL</a>.</p>',
  '<h3><a id="support-or-contact-2" class="anchor" href="#support-or-contact-2" aria-hidden="true"></a>MassIVE</h3>',
  '<p>Shotgun proteomics data can be submitted to <a href="http://massive.ucsd.edu/ProteoSAFe/static/massive.jsp">MassIVE</a>.</p>',
  '<footer class="site-footer">',
  '<span class="site-footer-credits">This page was developed by ProteomeXchange Team <a href="contact/">Contact Us</a></span>',
  '</footer>',
  '</section>'
].join("\n");

const SUBSCRIBE = [
  '<section class="main-content">',
  '<h2><a id="creating-pages-manually" class="anchor" href="#creating-pages-manually" aria-hidden="true"></a>How to get subscribed to the announcements of new public ProteomeXchange (PX) datasets</h2>',
  '<p>There are currently three ways for external users to do this:</p>',
  '<ol>',
  '<li>Follow the ProteomeXchange Twitter feed <a href="https://twitter.com/ProteomeXchange">@proteomeXchange</a>',
  '</li>',
  '<li>Using an RSS feed reader. The PX feed URL can be accessed at:',
  '<a href="https://groups.google.com/forum/feed/proteomexchange/msgs/rss_v2_0.xml" target="_blank">https://groups.google.com/forum/feed/proteomexchange/msgs/rss_v2_0.xml</a>',
  '</li>',
  '<li>Getting e-mail updates by joining the ProteomeXchange <a href="https://groups.google.com/forum/#!forum/proteomexchange">Google group. </a>Choose your preferred option for receiving the e-mails with the new datasets.</p></li>',
  '</ol>',
  '</section>'
].join("\n");

const CONTACT = [
  '<section class="main-content">',
  '<h2><a id="contact" class="anchor" href="#contact" aria-hidden="true"></a>Contact</h2>',
  '<p>Please contact the following ProteomeXchange Partner Repository Coordinators in case you have questions or comments.</p>',
  '<h3>PRIDE - PRoteomics IDEntifications Database</h3>',
  '<p>Juan Antonio Vizcaino, PhD</p>',
  '<ul><li>Proteomics Team Leader</li><li>juan [at] ebi.ac.uk</li></ul>',
  '<h3>PeptideAtlas - PASSEL</h3>',
  '<p>Eric Deutsch, PhD</p>',
  '<ul><li>Senior Research Scientist (Institute for Systems Biology, Seattle, USA)</li><li>edeutsch [at] systemsbiology.org</li></ul>',
  '<h3>MassIVE</h3>',
  '<p>Nuno Bandeira, PhD</p>',
  '<ul><li>Associate Professor - Skaggs School of Pharmacy and Pharmaceutical Sciences; Executive Director - Center for Computational Mass Spectrometry, University of California, San Diego</li><li>nbandeira [at] ucsd.edu</li></ul>',
  '<h3>jPOST</h3>',
  '<p>Prof. Yasushi Ishihama</p>',
  '<ul><li>Professor at University of Kyoto</li><li>yishiham@pharm.kyoto-u.ac.jp</li></ul>',
  '<h3>iProx</h3>',
  '<p>Prof. Yunping Zhu</p>',
  '<ul><li>Professor at National Center for Protein Sciences, Beijing, China</li><li>zhuyunping@gmail.com</li></ul>',
  '<footer class="site-footer">',
  '<span class="site-footer-credits">This page was developed by ProteomeXchange Team <a href="contact/">Contact Us</a></span>',
  '</footer>',
  '</section>'
].join("\n");

test("词库结构与站点栈：条数、键值形态、规则可编译、模板槽位连续", () => {
  assert.equal(book.meta.family, "proteomexchange");
  assert.equal(book.meta.version, "0.1.0");
  assert.deepEqual(book.meta.sites, ["proteomexchange.org", "www.proteomexchange.org"]);
  assert.ok(Object.keys(book.exact).length >= 25, "exact 至少 25 条，实际 " + Object.keys(book.exact).length);
  assert.ok(book.rules.length >= 1, "rules 至少 1 条");
  assert.ok(book.templates.length >= 8, "templates 至少 8 条，实际 " + book.templates.length);
  assert.ok(site.dicts.includes("proteomexchange"));
  assert.ok(site.dicts.indexOf("common") < site.dicts.indexOf("proteomexchange"));
  assert.deepEqual(site.hosts, ["proteomexchange.org", "www.proteomexchange.org"]);

  const seen = new Set();
  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "键里不能有中文: " + k);
    assert.ok(/[\u4e00-\u9fff]/.test(v), "译文里必须有中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "键首尾不能有空白: " + JSON.stringify(k));
    assert.equal(v, String(v).trim(), "译文首尾不能有空白: " + JSON.stringify(k));
    assert.ok(!/https?:\/\/|@[a-z0-9.-]+\.[a-z]{2,}/i.test(v), "译文不能含网址/邮箱: " + k);
    assert.ok(!seen.has(k), "重复键: " + k);
    seen.add(k);
  }
  for (const r of book.rules) {
    const re = new RegExp(r.re);
    assert.ok(re.source.length > 0);
    assert.ok(/[\u4e00-\u9fff]/.test(r.to), "规则译文里必须有中文: " + r.re);
    if (/(^|[^\\])\(/.test(r.re)) assert.ok(/\$\d/.test(r.to), "带捕获组的规则要用到占位符: " + r.re);
  }
  const pats = new Set();
  for (const t of book.templates) {
    const used = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.ok(used.length >= 1, "模板至少一个槽位: " + t.pat);
    const sorted = used.slice().sort((a, b) => a - b);
    sorted.forEach((n, i) => assert.equal(n, i + 1, "槽位必须 1..N 连续: " + t.pat));
    assert.ok(!/[\u4e00-\u9fff]/.test(t.pat), "模板 pat 不能含汉字: " + t.pat);
    assert.ok(/[\u4e00-\u9fff]/.test(t.zh), "模板译文必须含中文: " + t.pat);
    assert.ok(t.pat.length >= 20, "模板 pat 太短: " + t.pat);
    assert.ok(!pats.has(t.pat), "模板 pat 重复: " + t.pat);
    pats.add(t.pat);
    const inZh = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
    assert.deepEqual(inZh, sorted, "译文槽位与 pat 不一致: " + t.pat);
  }
});

test("引擎：exact 全量命中，仓库名 / 登录号 / 邮箱 / DOI / 题录保持英文", () => {
  const { engine } = boot("");
  for (const [en, zh] of Object.entries(book.exact)) {
    assert.equal(engine.translateText(en), zh, "未命中: " + en);
  }
  for (const kept of [
    "PRIDE", "PeptideAtlas", "MassIVE", "jPOST", "iProx", "Panorama Public", "PASSEL", "ProteomeCentral",
    "EMBL-EBI", "ISB", "UCSD", "PXD000001", "PXD016999",
    "10.1093/nar/gkac1040", "PMID: 36370099", "PMC9825490",
    "Juan Antonio Vizcaino, PhD", "Prof. Yasushi Ishihama", "juan [at] ebi.ac.uk",
    "https://groups.google.com/forum/feed/proteomexchange/msgs/rss_v2_0.xml", "@proteomeXchange",
    "EMBL-EBI, Cambridge, UK",
    "PRIDE - PRoteomics IDEntifications Database",
    "Deutsch EW, Bandeira N, Perez-Riverol Y, Sharma V, Carver JJ, Mendoza L",
    "Manuscript", "XML"
  ]) {
    assert.equal(engine.translateText(kept), null, "不该翻的却被翻: " + kept);
  }
  assert.equal(engine.translateText("Data submission"), "数据提交");
  assert.equal(engine.translateText("Contact"), "联系方式", "Contact 由 common 的既有条目负责，本册不重复登记");
});

test("规则通道：只补 common 兜不住的计数形态（本站没有动态计数）", () => {
  const { engine } = boot("");
  // common 的通用数字规则是「数字 + 词」，词命中就收工；带 new/public 修饰、整词查不到的形态才落到本册
  assert.equal(engine.translateText("3 new datasets"), "3 个数据集");
  assert.equal(engine.translateText("42,876 datasets"), "42,876 数据集");
  // 成员仓库计数由 common 的「$1 + 词」通用规则兜底，本册不重复登记规则，避免两条规则抢同一串
  assert.equal(engine.translateText("5 member repositories"), "5 成员仓库");
});

test("首页：使命段模板命中，三个链接与 href 原样保留", () => {
  const { doc } = boot(HOME);
  const ps = [...doc.querySelectorAll("p")];
  assert.equal(
    squash(ps[0].textContent),
    "ProteomeXchange 联盟的成立旨在为主要蛋白质组学数据仓库提供全球协调的标准数据提交与分发流程，并推动该领域的开放数据政策。请参阅我们的数据提交指南、重处理数据集指南和 PX 成员协议。"
  );
  const links = [...ps[0].querySelectorAll("a")];
  assert.deepEqual(links.map((a) => squash(a.textContent)), ["数据提交指南", "重处理数据集指南", "PX 成员协议"]);
  assert.deepEqual(links.map((a) => a.getAttribute("href")), [
    "docs/guidelines_px.pdf",
    "docs/reprocessed_guidelines_px.pdf",
    "pxcollaborativeagreement_2024.pdf"
  ]);
  assert.deepEqual([...doc.querySelectorAll("h2")].slice(0, 4).map((e) => squash(e.textContent)), ["使命", "公开数据", "数据提交", "订阅"]);
});

test("首页：另见更新论文、公开数据、成员仓库三段模板", () => {
  const { doc } = boot(HOME);
  const ps = [...doc.querySelectorAll("p")];
  assert.equal(
    squash(ps[1].textContent),
    "另见 Nature Biotechnology 原始论文，以及 2017、2020 和 2023 年的更新论文。"
  );
  assert.deepEqual([...ps[1].querySelectorAll("a")].map((a) => a.getAttribute("href")), [
    "http://www.nature.com/nbt/journal/v32/n3/full/nbt.2839.html",
    "https://academic.oup.com/nar/article-lookup/doi/10.1093/nar/gkw936",
    "https://academic.oup.com/nar/article/48/D1/D1145/5612546",
    "https://academic.oup.com/nar/article/51/D1/D1539/6825347"
  ]);
  assert.equal(
    squash(ps[2].textContent),
    "公开的 PXD 数据集可在 ProteomeCentral 浏览。也可使用 RSS 订阅源。"
  );
  assert.deepEqual([...ps[2].querySelectorAll("a")].map((a) => squash(a.textContent)), ["ProteomeCentral", "RSS 订阅源"]);
  assert.equal(squash(ps[3].textContent), "ProteomeXchange 全面支持 MS/MS 蛋白质组学数据与 SRM 数据提交。其他类型的蛋白质组学数据也可通过「部分提交」机制提交。");
  assert.equal(squash(ps[4].textContent), "订阅以接收所有新的 ProteomeXchange 公告！");
  const members = ps[5];
  assert.deepEqual([...members.querySelectorAll("a")].map((a) => squash(a.textContent)), [
    "PRIDE", "PeptideAtlas", "MassIVE", "jPOST", "iProx", "Panorama Public"
  ]);
  assert.deepEqual([...members.querySelectorAll("a")].map((a) => a.getAttribute("href")), [
    "http://www.ebi.ac.uk/pride/archive/",
    "http://www.peptideatlas.org/",
    "http://massive.ucsd.edu/ProteoSAFe/static/massive.jsp",
    "http://jpost.org/",
    "http://www.iprox.org/",
    "https://panoramaweb.org/project/home/begin.view?"
  ]);
  assert.equal(
    squash(members.textContent),
    "本联盟目前的成员包括：PRIDE（EMBL-EBI，英国剑桥）、PeptideAtlas（ISB，美国华盛顿州西雅图）（两者均为创始成员）、MassIVE（UCSD，美国加利福尼亚州圣迭戈）、jPOST（多家机构，日本）、iProx（中国北京国家蛋白质科学中心）以及 Panorama Public（美国华盛顿州西雅图华盛顿大学）。"
  );
});

test("首页：发表文献整段与 Manuscript 链接保持英文，核心资源段整句翻", () => {
  const { doc } = boot(HOME);
  const ps = [...doc.querySelectorAll("p")];
  const citation = ps[6];
  assert.ok(squash(citation.textContent).startsWith("Deutsch EW, Bandeira N,"), "题录不翻");
  assert.ok(squash(citation.textContent).endsWith("PMC9825490. (Manuscript)"), "题录末尾的链接标签与括号不翻");
  assert.equal(citation.querySelector("a").getAttribute("href"), "https://academic.oup.com/nar/article/51/D1/D1539/6825347");
  assert.equal(ps[7].querySelectorAll("a").length, 0);
  assert.equal(
    squash(ps[7].textContent),
    "ProteomeXchange 是全球核心生物数据资源（Global Core Biodata Resource），这类资源对更广泛的生物与生命科学界具有根本重要性，并关乎生物数据的长期保存。"
  );
  assert.deepEqual([...doc.querySelectorAll("h2")].slice(4).map((e) => squash(e.textContent)), ["成员仓库", "发表文献", "全球生物数据联盟"]);
});

test("提交页：SRM/Shotgun 模板命中，跨链接的 GUI 整句按口径保留英文", () => {
  const { doc } = boot(SUBMISSION);
  assert.equal(squash(doc.querySelector("h2").textContent), "数据提交");
  const ps = [...doc.querySelectorAll("p")];
  assert.equal(squash(ps[0].textContent), "ProteomeXchange 支持提交来自所有蛋白质组学数据工作流的实验。");
  assert.equal(squash(ps[1].textContent), "SRM/MRM 数据可提交至 PASSEL。");
  assert.equal(ps[1].querySelector("a").getAttribute("href"), "http://www.peptideatlas.org/passel/");
  assert.equal(squash(ps[2].textContent), "鸟枪法蛋白质组学数据可提交至 MassIVE。");
  assert.equal(ps[2].querySelector("a").getAttribute("href"), "http://massive.ucsd.edu/ProteoSAFe/static/massive.jsp");
  assert.deepEqual([...doc.querySelectorAll("h3")].map((e) => squash(e.textContent)), [
    "PRIDE - PRoteomics IDEntifications Database",
    "PeptideAtlas - PASSEL",
    "MassIVE"
  ]);
  const section = doc.querySelector("section.main-content");
  const flat = squash(section.textContent);
  assert.ok(flat.includes("The GUI based PX Submission Tool can be downloaded to start data upload."), "整句保持英文: " + flat);
  assert.equal(doc.querySelector('a[href*="px-submission-tool"]').textContent, "downloaded", "链接文字不动");
});

test("订阅页：三个条目走模板通道，@句柄与订阅源 URL 不动", () => {
  const { doc } = boot(SUBSCRIBE);
  assert.equal(
    squash(doc.querySelector("h2").textContent),
    "如何订阅新的公开 ProteomeXchange（PX）数据集公告"
  );
  assert.equal(squash(doc.querySelector("p").textContent), "目前外部用户有三种方式：");
  const lis = [...doc.querySelectorAll("li")];
  assert.equal(lis.length, 3);
  assert.equal(squash(lis[0].textContent), "关注 ProteomeXchange 的 Twitter 动态 @proteomeXchange");
  assert.equal(lis[0].querySelector("a").getAttribute("href"), "https://twitter.com/ProteomeXchange");
  assert.equal(squash(lis[1].textContent), "使用 RSS 阅读器。PX 订阅源地址：https://groups.google.com/forum/feed/proteomexchange/msgs/rss_v2_0.xml");
  assert.equal(
    lis[1].querySelector("a").getAttribute("href"),
    "https://groups.google.com/forum/feed/proteomexchange/msgs/rss_v2_0.xml"
  );
  assert.equal(
    squash(lis[2].textContent),
    "通过加入 ProteomeXchange 的 Google 群组 获取电子邮件更新；请选择你接收新数据集邮件的方式。"
  );
  assert.equal(lis[2].querySelector("a").getAttribute("href"), "https://groups.google.com/forum/#!forum/proteomexchange");
});

test("联系页：职务与机构说明翻中文，人名 / 邮箱 / 仓库名不动", () => {
  const { doc } = boot(CONTACT);
  assert.equal(squash(doc.querySelector("h2").textContent), "联系方式", "Contact 由 common 译");
  const ps = [...doc.querySelectorAll("p")];
  assert.equal(squash(ps[0].textContent), "如有问题或建议，请联系以下 ProteomeXchange 合作伙伴仓库协调人。");
  assert.deepEqual(ps.slice(1).map((e) => squash(e.textContent)), [
    "Juan Antonio Vizcaino, PhD", "Eric Deutsch, PhD", "Nuno Bandeira, PhD", "Prof. Yasushi Ishihama", "Prof. Yunping Zhu"
  ]);
  const lis = [...doc.querySelectorAll("li")].map((e) => squash(e.textContent));
  assert.deepEqual(lis, [
    "蛋白质组学团队负责人", "juan [at] ebi.ac.uk",
    "资深研究科学家（美国西雅图系统生物学研究所）", "edeutsch [at] systemsbiology.org",
    "副教授——Skaggs 药学与药物科学学院；执行主任——计算质谱中心，加利福尼亚大学圣迭戈分校", "nbandeira [at] ucsd.edu",
    "京都大学教授", "yishiham@pharm.kyoto-u.ac.jp",
    "中国北京国家蛋白质科学中心教授", "zhuyunping@gmail.com"
  ]);
  assert.deepEqual([...doc.querySelectorAll("h3")].map((e) => squash(e.textContent)), [
    "PRIDE - PRoteomics IDEntifications Database", "PeptideAtlas - PASSEL", "MassIVE", "jPOST", "iProx"
  ]);
});

test("页脚模板：三个页面统一「制作 · 联系我们」，链接仍可点", () => {
  for (const page of [HOME, SUBMISSION, CONTACT]) {
    const { doc } = boot(page);
    const span = doc.querySelector("span.site-footer-credits");
    assert.equal(squash(span.textContent), "本页面由 ProteomeXchange 团队制作 · 联系我们");
    assert.equal(span.querySelector("a").getAttribute("href"), "contact/");
    assert.equal(squash(span.querySelector("a").textContent), "联系我们");
  }
});

// 残留口径：TreeWalker 文本节点，trim ≤80 字符、含字母、不含汉字，
// 跳过 script/style/pre/code/svg/noscript 与 [data-biol10n-ui]。
const CJK = /[\u3400-\u4DBF\u4E00-\u9FFF]/;
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "SVG", "TEXTAREA"]);

function residual(doc) {
  const out = [];
  const w = doc.createTreeWalker(doc.body, 4 /* SHOW_TEXT */);
  let n;
  while ((n = w.nextNode())) {
    let el = n.parentElement, skip = false;
    while (el && el !== doc.body) {
      if (SKIP_TAGS.has(String(el.tagName || "").toUpperCase())) { skip = true; break; }
      if (el.hasAttribute && el.hasAttribute("data-biol10n-ui")) { skip = true; break; }
      el = el.parentElement;
    }
    if (skip) continue;
    const t = squash(n.nodeValue);
    if (!t || t.length > 80) continue;
    if (!/[A-Za-z]/.test(t)) continue;
    if (CJK.test(t)) continue;
    out.push(t);
  }
  return out;
}

test("残留口径：四页只剩故意保留的英文（仓库名 / 人名 / 邮箱 / URL / 题录链接）", () => {
  const home = boot(HOME);
  assert.deepEqual(residual(home.doc).sort(), [
    "jPOST", "iProx", "Manuscript", "MassIVE", "Panorama Public", "PeptideAtlas", "PRIDE", "ProteomeCentral"
  ].sort());

  const sub = boot(SUBMISSION);
  assert.deepEqual(residual(sub.doc).sort(), [
    "PRIDE - PRoteomics IDEntifications Database",
    "PeptideAtlas - PASSEL",
    "The GUI based PX Submission Tool can be",
    "downloaded",
    "to start data upload.",
    "MassIVE",
    "MassIVE",
    "PASSEL"
  ].sort());

  const sb = boot(SUBSCRIBE);
  assert.deepEqual(residual(sb.doc).sort(), [
    "@proteomeXchange",
    "https://groups.google.com/forum/feed/proteomexchange/msgs/rss_v2_0.xml"
  ].sort());

  const ct = boot(CONTACT);
  assert.deepEqual(residual(ct.doc).sort(), [
    "PRIDE - PRoteomics IDEntifications Database", "Juan Antonio Vizcaino, PhD", "juan [at] ebi.ac.uk",
    "PeptideAtlas - PASSEL", "Eric Deutsch, PhD", "edeutsch [at] systemsbiology.org",
    "MassIVE", "Nuno Bandeira, PhD", "nbandeira [at] ucsd.edu",
    "jPOST", "Prof. Yasushi Ishihama", "yishiham@pharm.kyoto-u.ac.jp",
    "iProx", "Prof. Yunping Zhu", "zhuyunping@gmail.com"
  ].sort());
});
