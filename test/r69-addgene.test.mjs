
// Addgene（dict/addgene.json）回归：首页 hero/检索栏/统计句/公告条、四大分区与页脚导航、
// 教学资源页六个面板、存放指南页步骤模板、分子生物学参考页的跳转导航/图注/元件与类型表/氨基酸表、
// 实验方案索引页的分区与表格。站点栈按 config/sites.json 里登记的 dicts 取。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/addgene.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site =
  sites.find((s) => s.id === "addgene") || {
    id: "addgene",
    name: "Addgene",
    hosts: ["addgene.org", "www.addgene.org"],
    dicts: ["common", "addgene"],
    scope: "body"
  };

const CJK = /[\u4e00-\u9fff]/;
const U = "https://www.addgene.org/";

const data = { exact: {}, rules: [], templates: [] };
for (const id of site.dicts) {
  const p = path.join(root, "../dict", id + ".json");
  if (!fs.existsSync(p)) continue;
  const b = JSON.parse(fs.readFileSync(p, "utf8"));
  Object.assign(data.exact, b.exact || {});
  data.rules = data.rules.concat(b.rules || []);
  data.templates = data.templates.concat(b.templates || []);
}

function run(html, url) {
  const dom = new JSDOM(html, { url: url || U });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return dom.window.document;
}
const text = (el) => el.textContent.replace(/\s+/g, " ").trim();

test("词库结构：family/sites/area、条数、键值形态、模板槽位连续", () => {
  assert.equal(book.meta.family, "addgene");
  assert.ok(book.meta.sites.includes("www.addgene.org"));
  assert.ok(book.meta.area.length > 0 && book.meta.note.length > 0, "meta 说明要有内容");
  const keys = Object.keys(book.exact);
  assert.ok(keys.length >= 300, "exact 只有 " + keys.length + " 条");
  assert.ok(book.templates.length >= 35, "templates 太少: " + book.templates.length);

  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(!CJK.test(k), "键里不能有中文: " + k);
    assert.ok(CJK.test(v), "译文里必须有中文: " + k + " -> " + v);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "键首尾不能有空白: " + JSON.stringify(k));
    assert.equal(v, v.trim(), "值首尾不能有空白: " + JSON.stringify(k));
    assert.ok(!/https?:\/\/|@[\w.-]+\.\w+/.test(v), "译文里不能有 URL/邮箱: " + k);
  }
  for (const t of book.templates) {
    const used = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.ok(used.length >= 1, "模板要带槽位: " + t.pat);
    used.slice().sort((a, b) => a - b).forEach((n, i) => assert.equal(n, i + 1, "槽位必须从 1 连续: " + t.pat));
    const zhUsed = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.deepEqual(zhUsed.slice().sort((a, b) => a - b), used.slice().sort((a, b) => a - b), "译文槽位要与原文一致: " + t.pat);
    assert.ok(t.pat.length >= 20, "模板原文太短（引擎不接受 <20 字符）: " + t.pat);
    assert.ok(!CJK.test(t.pat), "模板原文里不能有汉字: " + t.pat);
    assert.ok(CJK.test(t.zh), "模板译文要有中文: " + t.pat);
  }
});

test("首页 hero 与检索栏：标题、两个标签、示例词保留、衍生下拉选项", () => {
  const doc = run(
    '<main><div class="hero"><h1>Powering Scientific Sharing</h1>' +
      '<ul class="nav nav-tabs"><li><button>Search</button></li><li><button>Search by Sequence</button></li></ul>' +
      '<form id="search-bar"><label class="visually-hidden">Search</label>' +
      '<input placeholder="e.g. 74218, Cas9, transformation protocol"></form>' +
      '<p class="mb-3">Not exactly sure? Browse our catalog!</p>' +
      '<ul class="list-group"><li><a>Plasmids</a></li><li><a>Pooled Libraries</a></li>' +
      "<li><a>Antibodies</a></li><li><a>Viral Services</a></li></ul></div></main>"
  );
  assert.equal(text(doc.querySelector("h1")), "驱动科学共享");
  assert.deepEqual([...doc.querySelectorAll("button")].map((e) => text(e)), ["检索", "按序列检索"]);
  assert.equal(
    doc.querySelector("input").getAttribute("placeholder"),
    "e.g. 74218, Cas9, transformation protocol",
    "占位符是检索示例（编号/基因名/文档名），保持原样"
  );
  assert.equal(text(doc.querySelector("p.mb-3")), "不太确定要找什么？浏览我们的目录！");
  assert.deepEqual(
    [...doc.querySelectorAll("li a")].map((e) => text(e)),
    ["质粒", "混合文库", "抗体", "病毒服务"]
  );
});

test("首页按序列检索：表单标签与三个下拉的选项", () => {
  const doc = run(
    '<main><form>' +
      '<label class="form-label">Sequence Type</label><select><option>Nucleotide</option><option>Protein</option></select>' +
      '<label class="form-label">BLAST Database</label><select>' +
      "<option>All Addgene Plasmids</option><option>Bacterial Expression Plasmids</option>" +
      "<option>Mammalian Expression Plasmids</option><option>Empty Backbone Plasmids</option></select>" +
      '<label class="form-label">BLAST Algorithm</label><select>' +
      "<option>megablast</option><option>blastn</option><option>blastn-short</option></select>" +
      '<label class="visually-hidden">Search plasmids by sequence</label>' +
      '<p class="form-text">Enter a sequence to perform a BLAST-based search of Addgene plasmid sequence databases.</p>' +
      '<a><span class="text">Information</span></a></form></main>'
  );
  assert.deepEqual([...doc.querySelectorAll("label")].map((e) => text(e)), [
    "序列类型",
    "BLAST 数据库",
    "BLAST 算法",
    "按序列检索质粒"
  ]);
  const sels = [...doc.querySelectorAll("select")];
  assert.deepEqual([...sels[0].children].map(text), ["核苷酸", "蛋白质"]);
  assert.deepEqual([...sels[1].children].map(text), [
    "全部 Addgene 质粒",
    "细菌表达质粒",
    "哺乳动物表达质粒",
    "空载体骨架质粒"
  ]);
  assert.deepEqual([...sels[2].children].map(text), ["megablast", "blastn", "blastn-short"], "算法名是命令，不动");
  assert.equal(
    text(doc.querySelector("p.form-text")),
    "输入一条序列，对 Addgene 质粒序列数据库执行基于 BLAST 的检索。"
  );
  assert.equal(text(doc.querySelector("span.text")), "信息");
});

test("首页统计句：六个内联数字槽位与整句模板", () => {
  const doc = run(
    '<main><div class="statistics">We distribute <span class="stats">180,473</span> plasmids on behalf of ' +
      '<span class="stats">7,133</span> labs from around the world. Our collection also contains ' +
      '<span class="stats">1,081</span> ready-to-use viral vectors and <span class="stats">287</span> ' +
      "recombinant antibodies. These materials have been requested " +
      '<span class="stats">2,513,963</span> times and shipped to <span class="stats">113</span> countries.</div></main>'
  );
  assert.equal(
    text(doc.querySelector(".statistics")),
    "我们分发 180,473 个质粒，它们来自全球 7,133 个实验室。馆藏还包括 1,081 个即用型病毒载体与 287 种重组抗体。" +
      "这些材料已被申领 2,513,963 次，寄往 113 个国家。"
  );
  assert.deepEqual(
    [...doc.querySelectorAll("span.stats")].map(text),
    ["180,473", "7,133", "1,081", "287", "2,513,963", "113"],
    "数字原样放回"
  );
});

test("首页两条公告：cookie 条与调查条（关闭按钮的 aria-label 走通用册）", () => {
  const doc = run(
    '<div id="messages">' +
      '<div class="alert alert-info"><div>This website uses cookies to ensure you get the best experience. ' +
      "By continuing to use this site, you agree to the use of cookies. " +
      '<button aria-label="Close"></button></div></div>' +
      '<div class="alert alert-warning"><div>How can we better support researchers? ' +
      "<a>Take our survey</a> and enter for a chance to win a $25 reward. " +
      '<button aria-label="Close"></button></div></div>' +
      "</div>"
  );
  const alerts = [...doc.querySelectorAll(".alert")];
  assert.equal(
    text(alerts[0]),
    "本网站使用 Cookie 以确保您获得最佳体验。继续使用本网站，即表示您同意使用 Cookie。"
  );
  assert.equal(
    text(alerts[1]),
    "我们如何更好地支持研究人员？参与我们的问卷调查，还有机会赢取 25 美元奖励。"
  );
  assert.equal(text(alerts[1].querySelector("a")), "参与我们的问卷调查", "槽位里的链接文字也要跟着翻");
  for (const b of doc.querySelectorAll("button")) assert.equal(b.getAttribute("aria-label"), "关闭");
});

test("首页 What's New / About：分区块标题、调查段、Claude 段与三个入口句", () => {
  const doc = run(
    '<main><section><h2 class="text-center">What&#39;s New</h2>' +
      "<h3>Help Shape Addgene's Future</h3>" +
      "<p>Take our 2026 Impact Survey and tell us about your experience with Addgene. Your feedback will help us " +
      "improve our products, services, and resources for researchers worldwide. As a thank-you for participating, " +
      "you can enter a drawing for a $25 reward.</p><p><a>Take the Survey</a></p>" +
      "<h3>Search Addgene with Claude</h3>" +
      "<p>Addgene&#39;s new MCP connector brings our catalog of 177,000+ plasmids and 1,000+ viral vectors into " +
      "Claude and other MCP-compatible AI tools. Search for materials, view item details, and access GenBank " +
      "sequences without leaving Claude.</p><p><a>Learn How to Connect</a></p></section>" +
      "<section><h2>About Addgene</h2>" +
      "<p class=\"lead\">For over 20 years, our nonprofit repository has been making it easier to access useful " +
      "research materials and information.</p><p><a>Discover our mission</a></p>" +
      "<p class=\"lead\">Deposit your plasmids or contribute data — we'll handle storage, distribution, and " +
      "record-keeping, helping you to share your discoveries with other scientists.</p>" +
      "<p class=\"lead\">Request plasmids, antibodies, and <span class=\"text-nowrap\">ready-to-use</span> " +
      "viral preparations for your next experiment.</p>" +
      "<p>Browse <a>plasmids</a>, <a>antibodies</a> or <a>viral preps</a></p>" +
      "<p class=\"lead\">Learn something new from our science guides, eBooks, videos, and blog.</p>" +
      "<p><a>Explore our educational resources</a></p></section></main>"
  );
  assert.deepEqual([...doc.querySelectorAll("h2")].map(text), ["最新动态", "关于 Addgene"]);
  assert.deepEqual([...doc.querySelectorAll("h3")].map(text), ["参与塑造 Addgene 的未来", "在 Claude 中检索 Addgene"]);
  const ps = [...doc.querySelectorAll("p")];
  assert.equal(
    text(ps[0]),
    "参与我们的 2026 影响力调查，告诉我们您使用 Addgene 的体验。您的反馈将帮助我们为全球科研人员改进产品、" +
      "服务与资源。作为感谢，参与即可参加 25 美元奖励抽奖。"
  );
  assert.equal(text(ps[1].querySelector("a")), "参与调查");
  assert.equal(
    text(ps[2]),
    "Addgene 全新的 MCP 连接器把我们的目录（含 177,000 多个质粒与 1,000 多个病毒载体）带入 Claude 及其他兼容 MCP 的 AI 工具。" +
      "无需离开 Claude，即可检索材料、查看条目详情并获取 GenBank 序列。"
  );
  assert.equal(text(ps[3].querySelector("a")), "了解如何接入");
  assert.equal(text(ps[4]), "二十多年来，我们的非营利资源库一直让人们更容易获取有用的研究材料与信息。");
  assert.equal(text(ps[5].querySelector("a")), "了解我们的使命");
  assert.equal(
    text(ps[6]),
    "存放您的质粒或贡献数据，我们会负责保存、分发与记录，帮您把发现分享给其他科学家。"
  );
  assert.equal(text(ps[7]), "为您的下一次实验申领质粒、抗体与即用型病毒制品。");
  assert.equal(text(ps[8]), "浏览质粒、抗体或病毒制品");
  assert.equal(text(ps[9]), "从我们的科学指南、电子书、视频与博客中学点新东西。");
  assert.equal(text(ps[10].querySelector("a")), "浏览我们的教学资源");
});

test("首页推荐语：大段引文整段留英文，只有按钮翻", () => {
  const quote =
    "Addgene has been an exceptionally useful resource for us, both because they can be trusted to supply our " +
    "plasmids to other labs efficiently, and because we ourselves are constantly ordering reagents of interest " +
    "that other labs have deposited. Keep up the good work!";
  const doc = run(
    '<main><div class="testimonials"><section><h2>Scientists <img alt="Love"> Addgene</h2>' +
      "<blockquote>" + quote + "</blockquote>" +
      "<p>Dr. Anjana Rao</p><p>La Jolla Institute for Immunology <span>(La Jolla, CA)</span></p>" +
      "<p><a>See what others are saying</a></p></section></div></main>"
  );
  assert.equal(text(doc.querySelector("blockquote")), quote, "引文是受访者原话，整段不拆开翻");
  assert.equal(text(doc.querySelector("p a")), "看看别人怎么说");
  assert.equal(text(doc.querySelector("p")), "Dr. Anjana Rao", "人名不动");
});

test("首页每日工具：三个小标题与两个标签翻，质粒名/抗体名/用途句不动", () => {
  const doc = run(
    '<main><section><h2>Tools of the Day</h2>' +
      '<div class="tool-of-the-day"><h3>Plasmid</h3><div><p class="tool-name"><a>pMRX-IP-mGFP-NCOA4</a></p>' +
      "<p><strong>Depositor:</strong> <a>Noboru Mizushima</a></p>" +
      "<p><strong>Purpose:</strong> Stable expression of mEGFP-NCOA4 in mammalian cells</p></div></div>" +
      '<div class="tool-of-the-day"><h3>Viral Prep</h3><div><p class="tool-name"><a>pAAV-hSyn-Kir2.1Mut-2A-mSca…</a></p>' +
      "</div></div>" +
      '<div class="tool-of-the-day"><h3>Antibody</h3><div><p class="tool-name"><a>Anti-Lhx6.1 [N228A/16R]</a></p>' +
      "</div></div></section></main>"
  );
  assert.equal(text(doc.querySelector("h2")), "每日工具");
  assert.deepEqual([...doc.querySelectorAll("h3")].map(text), ["质粒", "病毒制品", "抗体"]);
  assert.deepEqual([...doc.querySelectorAll("strong")].map(text), ["存放者：", "用途："]);
  assert.deepEqual(
    [...doc.querySelectorAll(".tool-name a")].map(text),
    ["pMRX-IP-mGFP-NCOA4", "pAAV-hSyn-Kir2.1Mut-2A-mSca…", "Anti-Lhx6.1 [N228A/16R]"]
  );
  assert.equal(
    text(doc.querySelectorAll("p")[2]),
    "用途： Stable expression of mEGFP-NCOA4 in mammalian cells",
    "用途是作者自述，整句留英文"
  );
});

test("首页页脚：三块订阅区、标语、栏目与通用链接", () => {
  const doc = run(
    '<footer><div><h2>Get Our Newsletter</h2><p>Keep up with the latest Addgene news, releases, and more.</p>' +
      "<a>Sign Up</a></div>" +
      "<div><h2>Subscribe to Our Blog</h2><p>Learn about new materials in the repository and helpful community " +
      "resources.</p><a>Subscribe</a></div>" +
      "<div><h2>Contact Addgene</h2><p>Have questions about your order, deposit, or a material?</p>" +
      "<a>Contact Us</a></div>" +
      "<h2>Powering Scientific Sharing</h2>" +
      "<h3>Addgene is a nonprofit repository for plasmids, viral vectors, and antibodies developed by the global " +
      "research community.</h3>" +
      "<h3>About Our Repository</h3><ul><li><a>About Us</a></li><li><a>Careers</a></li><li><a>Leadership</a></li>" +
      "<li><a>Financial Conflicts of Interest</a></li><li><a>Biosafety</a></li></ul>" +
      "<h3>Browse Our Catalog</h3><h4>General Reagents</h4><h4>Plasmid Collections</h4>" +
      "<h3>Education</h3><h3>Tools</h3><p>Stay connected!</p>" +
      "<ul><li><a>Contact</a></li><li><a>Cookies &amp; Privacy Policy</a></li><li><a>Accessibility</a></li>" +
      "<li><a>Terms of Use</a></li></ul></footer>"
  );
  assert.deepEqual([...doc.querySelectorAll("h2")].map(text), [
    "订阅我们的通讯",
    "订阅我们的博客",
    "联系 Addgene",
    "驱动科学共享"
  ]);
  assert.equal(
    text(doc.querySelector("h3")),
    "Addgene 是一家非营利资源库，收录全球研究界开发的质粒、病毒载体与抗体。"
  );
  assert.deepEqual([...doc.querySelectorAll("h3")].map(text).slice(1), [
    "关于我们的资源库",
    "浏览我们的目录",
    "教育",
    "工具"
  ]);
  assert.deepEqual([...doc.querySelectorAll("h4")].map(text), ["通用试剂", "质粒合集"]);
  assert.deepEqual([...doc.querySelectorAll("ul a")].map(text), [
    "关于我们",
    "招聘",
    "领导团队",
    "财务利益冲突",
    "生物安全",
    "联系方式",
    "Cookie 与隐私政策",
    "无障碍",
    "使用条款"
  ]);
  assert.ok(
    [...doc.querySelectorAll("p")].some((p) => text(p) === "保持联系！"),
    "页脚末尾的一句要翻"
  );
});

test("头部导航：四大分区与材料/应用/研究领域三列", () => {
  const doc = run(
    '<header><li class="dropdown-products-applications">Products &amp; Applications</li>' +
      "<li>Services</li><li>Deposit</li><li>Support</li><li>About</li>" +
      "<span>Materials</span><span>Applications</span><span>Research Areas &amp; Organisms</span>" +
      "<a>Plasmids</a><a>AAV Preps</a><a>Lentiviral Preps</a><a>Antibodies</a><a>Pooled Libraries</a>" +
      "<a>Plasmid Kits</a><a>Base Edit</a><a>Prime Edit</a><a>CRISPR Guide</a>" +
      "<a>Fluorescent Proteins</a><a>Optogenetics</a><a>Chemogenetics</a>" +
      "<a>Empty Backbones</a><a>Tet-Regulated Expression</a><a>Genetic Code Expansion</a>" +
      "<a>Zebrafish</a><a>Worm</a><a>Featured Collections</a>" +
      "<a>Pre‐Publication Depositing</a><a>Transfection‐Ready DNA</a><a>On‐Demand AAV</a>" +
      "<a>Data Hub</a><a>Developers Portal</a><a>MCP Connector</a><a>Sequence Analyzer</a>" +
      "<a>Educational Resources</a><a>Help Center</a><a>Who We Are</a><a>Work With Us</a></header>"
  );
  assert.deepEqual(
    [...doc.querySelectorAll("li")].map(text),
    ["产品与应用", "服务", "提交", "支持", "关于"]
  );
  assert.deepEqual([...doc.querySelectorAll("span")].map(text), [
    "材料",
    "应用",
    "研究领域与模式生物"
  ]);
  const nav = [...doc.querySelectorAll("a")].map(text);
  for (const want of [
    "质粒",
    "AAV 制品",
    "慢病毒制品",
    "抗体",
    "混合文库",
    "质粒试剂盒",
    "碱基编辑",
    "先导编辑",
    "CRISPR 指南",
    "荧光蛋白",
    "光遗传学",
    "化学遗传学",
    "空载体骨架",
    "Tet 调控表达",
    "遗传密码扩展",
    "斑马鱼",
    "线虫",
    "精选合集",
    "发表前存放",
    "转染级 DNA",
    "按需 AAV",
    "数据枢纽",
    "开发者门户",
    "MCP 连接器",
    "序列分析器",
    "教育资源",
    "帮助中心",
    "我们是谁",
    "与我们合作"
  ]) {
    assert.ok(nav.includes(want), "导航缺译: " + want);
  }
});

test("教学资源页：六个面板标题与说明模板，书名/播放列表标题留英文", () => {
  const doc = run(
    '<main><div class="container"><h1>Educational Resources</h1>' +
      "<p>From eBooks to videos and blog posts to protocols, our educational resources cover a wide range of " +
      "topics in molecular biology, laboratory research, and career development.</p>" +
      '<div><section class="panel"><div class="panel-heading"><h2><a>eBooks</a></h2></div><div class="panel-body">' +
      '<p><a><b>Download</b> any of our eBooks</a> to learn about popular topics related to our collections. ' +
      "Titles include: </p><ul><li>Plasmids 101</li><li>CRISPR 101</li></ul></div></section>" +
      '<section class="panel"><div class="panel-heading"><h2><a>Videos</a></h2></div><div class="panel-body">' +
      '<p><a><b>Watch</b> our collection of video content</a>, including protocols, tips on using Addgene’s ' +
      "materials, and career advice. Playlists include: </p></div></section>" +
      '<section class="panel"><div class="panel-heading"><h2><a>Blog</a></h2></div><div class="panel-body">' +
      "<p><a><b>Read</b> about plasmids in Addgene’s repository</a>, and related molecular biology techniques. " +
      "Topics include: </p></div></section>" +
      '<section class="panel"><div class="panel-heading"><h2><a>Molecular Biology</a></h2></div><div class="panel-body">' +
      "<p><a><b>Learn</b> about plasmids, sequencing, vectors, and restriction enzymes</a> to assist with your " +
      "molecular biology research. Topics include: </p></div></section>" +
      '<section class="panel"><div class="panel-heading"><h2><a>Protocols</a></h2></div><div class="panel-body">' +
      "<p><a><b>Find</b> written and video protocols</a> for a wide range of applications in molecular biology, " +
      "plasmid cloning, and virus, including: </p></div></section>" +
      '<section class="panel"><div class="panel-heading"><h2><a>Guides</a></h2></div><div class="panel-body">' +
      "<p><a><b>Browse</b> our in-depth instructional content</a> on subjects such as: </p></div></section>" +
      "</div></div></main>"
  );
  assert.equal(text(doc.querySelector("h1")), "教育资源");
  assert.equal(
    text(doc.querySelector("main p")),
    "从电子书到视频、从博客文章到实验方案，我们的教学资源涵盖分子生物学、实验室研究与职业发展的广泛主题。"
  );
  assert.deepEqual([...doc.querySelectorAll(".panel-heading h2")].map(text), [
    "电子书",
    "视频",
    "博客",
    "分子生物学",
    "实验方案",
    "指南"
  ]);
  const bodies = [...doc.querySelectorAll(".panel-body p")].map(text);
  assert.equal(bodies[0], "下载我们的任何电子书，了解与我们的合集相关的热门主题。书名包括：");
  assert.equal(bodies[1], "观看我们的视频内容合集，包括实验方案、Addgene 材料使用技巧与职业建议。播放列表包括：");
  assert.equal(bodies[2], "阅读 Addgene 库中的质粒，并了解相关的分子生物学技术。主题包括：");
  assert.equal(bodies[3], "学习质粒、测序、载体与限制性内切酶，为您的分子生物学研究提供帮助。主题包括：");
  assert.equal(bodies[4], "查找文字与视频实验方案，适用于分子生物学、质粒克隆与病毒等广泛领域，包括：");
  assert.equal(bodies[5], "浏览我们的深入教学内容，涵盖以下主题：");
  assert.deepEqual([...doc.querySelectorAll("li")].map(text), ["Plasmids 101", "CRISPR 101"], "书名是产品名，不拆");
});

test("存放指南页：标题、三步骤模板与支持段", () => {
  const doc = run(
    '<main><div class="container"><h1>Depositing Plasmids With Addgene</h1>' +
      '<p>Everything we distribute was first deposited by a scientist like you! Join <span>7,133</span> labs ' +
      "around the world who have deposited materials with Addgene. Enter your data, ship your samples to Addgene, " +
      "and we'll handle the rest.</p>" +
      "<section><h2>What to Expect</h2>" +
      "<p><strong>Depositing materials with Addgene is easy and free!</strong> Learn more about the " +
      "<a>benefits of depositing</a>.</p><ol>" +
      "<li><p>Decide which plasmids you want to deposit. We support deposits of published, " +
      "<a>pre-publication</a>, or unpublished materials.</p></li>" +
      "<li><p>Enter your plasmid details and sequences online. We'll ask for a general description and useful " +
      "details like the gene/insert name, mutations, antibiotic resistance, and growth conditions. See our " +
      "<a>deposit process guide</a> to learn more.</p></li>" +
      "<li><p>Ship your samples to our lab in the form of <a>liquid DNA or bacteria</a>.</p></li></ol>" +
      "<p>Still have questions? Our knowledgeable support team can provide help throughout the deposit process. " +
      "See our <a>Help Center Articles</a> or email <a><span class=\"__cf_email__\">[email protected]</span></a>.</p>" +
      "</section></div></main>"
  );
  assert.equal(text(doc.querySelector("h1")), "向 Addgene 存放质粒");
  assert.equal(text(doc.querySelector("h2")), "流程概览");
  assert.equal(
    text(doc.querySelector("main p")),
    "我们分发的一切最初都由像您这样的科学家存放！加入来自世界各地、已向 Addgene 存放材料的 7,133 个实验室。" +
      "录入数据、把样品寄给 Addgene，其余交给我们。"
  );
  const strong = doc.querySelector("strong");
  assert.equal(text(strong), "向 Addgene 存放材料既简单又免费！");
  assert.equal(text(strong.parentElement), "向 Addgene 存放材料既简单又免费！进一步了解存放的好处。");
  const steps = [...doc.querySelectorAll("ol li p")].map(text);
  assert.equal(steps[0], "确定要存放哪些质粒。我们接受已发表、发表前或未发表材料的存放。");
  assert.equal(
    steps[1],
    "在线录入质粒详情与序列。我们会要求一份总体描述，以及基因/插入片段名称、突变、抗生素抗性、培养条件等有用信息。" +
      "参见存放流程指南了解更多。"
  );
  assert.equal(steps[2], "把样品以液体 DNA 或细菌的形式寄到我们的实验室。");
  assert.equal(
    text(doc.querySelectorAll("section > p")[1]),
    "还有疑问？我们专业的支持团队可在整个存放过程中提供帮助。参见帮助中心文章，或发邮件至 [email protected]。"
  );
});

test("分子生物学参考页：标题、跳转导航、分区标题与图注", () => {
  const doc = run(
    '<main><nav><ul id="jump-nav"><li>Jump To:</li>' +
      "<li><a>Origins of Molecular Genetics</a></li><li><a>The Genetic Code</a></li>" +
      "<li><a>Recombinant DNA</a></li><li><a>Working with Plasmids</a></li>" +
      "<li><a>Plasmid Elements</a></li><li><a>Types of Plasmids</a></li><li><a>Molecular Cloning</a></li>" +
      "<li><a>Common Bacteria Strains for Propagating Plasmids</a></li><li><a>Common Antibiotics</a></li>" +
      "<li><a>DNA Sequencing</a></li><li><a>Sanger Sequencing</a></li>" +
      "<li><a>Next-generation Sequencing</a></li><li><a>Long-read Sequencing</a></li>" +
      "<li><a>Reference Tables</a></li><li><a>Additional Resources</a></li></ul></nav>" +
      "<h1>Molecular Biology Reference</h1>" +
      "<h2>Origins of Molecular Genetics</h2><h3>The Genetic Code</h3>" +
      "<h3>Plasmids and Recombinant DNA Technology</h3>" +
      "<figure><figcaption>Figure 1: Creation of recombinant DNA.</figcaption></figure>" +
      "<h2>Working with Plasmids</h2><h3>Plasmid Elements</h3>" +
      "<figure><figcaption>Figure 2: General structure of a plasmid.</figcaption></figure>" +
      "<h3>Types of Plasmids</h3><h3>Molecular Cloning</h3>" +
      "<h3>Common Bacteria Strains for Propagating Plasmids</h3>" +
      "<h3>Common Antibiotics for Plasmid Selection</h3>" +
      "<h2>DNA Sequencing for Plasmid Verification</h2>" +
      "<h3>Sanger Sequencing</h3><h3>Next-generation Sequencing</h3><h3>Long-read Sequencing</h3>" +
      "<figure><figcaption>Figure 3: Summary of Sanger sequencing. Created with BioRender.com.</figcaption></figure>" +
      "<h2>Resources</h2><h2>Additional Resources</h2></main>"
  );
  assert.equal(text(doc.querySelector("h1")), "分子生物学参考");
  const jump = [...doc.querySelectorAll("#jump-nav li")].map(text);
  assert.equal(jump[0], "跳至：");
  assert.deepEqual(jump.slice(1), [
    "分子遗传学的起源",
    "遗传密码",
    "重组 DNA",
    "质粒操作",
    "质粒元件",
    "质粒类型",
    "分子克隆",
    "用于扩增质粒的常用细菌菌株",
    "常用抗生素",
    "DNA 测序",
    "Sanger 测序",
    "新一代测序",
    "长读长测序",
    "参考表",
    "其他资源"
  ]);
  assert.deepEqual([...doc.querySelectorAll("h2")].map(text), [
    "分子遗传学的起源",
    "质粒操作",
    "用于质粒验证的 DNA 测序",
    "资源",
    "其他资源"
  ]);
  assert.deepEqual([...doc.querySelectorAll("h3")].map(text), [
    "遗传密码",
    "质粒与重组 DNA 技术",
    "质粒元件",
    "质粒类型",
    "分子克隆",
    "用于扩增质粒的常用细菌菌株",
    "用于质粒筛选的常用抗生素",
    "Sanger 测序",
    "新一代测序",
    "长读长测序"
  ]);
  assert.deepEqual([...doc.querySelectorAll("figcaption")].map(text), [
    "图 1：重组 DNA 的构建。",
    "图 2：质粒的一般结构。",
    "图 3：Sanger 测序概述。由 BioRender.com 制作。"
  ]);
});

test("分子生物学参考页：质粒元件表与质粒类型表", () => {
  const doc = run(
    '<main><table id="plasmid-elements-table"><thead><tr><th>Plasmid Element</th><th>Description</th></tr></thead>' +
      "<tbody><tr><td>Antibiotic Resistance Gene</td>" +
      "<td>Allows for selection of plasmid-containing bacteria by providing a survival advantage to the bacterial host.</td></tr>" +
      "<tr><td>Multiple Cloning Site (MCS)</td><td>A short segment of DNA which contains several restriction enzyme " +
      "sites, enabling easy insertion of DNA by restriction enzyme digestion and ligation. As a general rule, the " +
      "restriction sites in the MCS are unique and not located elsewhere in the plasmid backbone. In expression " +
      "plasmids, the MCS is often located downstream from a promoter to drive expression of the inserted gene.</td></tr>" +
      "<tr><td>Insert</td><td>The gene, promoter, or other DNA fragment cloned into the MCS. The insert is " +
      "typically the genetic element being studied using a particular plasmid.</td></tr>" +
      "<tr><td>Selectable Marker</td><td>Used to select for cells that have successfully taken up the plasmid and " +
      "can be used to study the insert. This is different than selecting for bacterial cells that have taken up the " +
      "plasmid. The selectable marker is typically in the form of another antibiotic resistance gene under the " +
      "control of a non-bacterial promoter or a fluorescent protein to select or sort the cells by visualization " +
      "or flow cytometry.</td></tr></tbody></table>" +
      '<table id="types"><thead><tr><th>Plasmid Type</th><th>Description</th><th>Addgene Resource(s)</th></tr></thead>' +
      "<tbody><tr><td>Cloning Plasmids</td><td>Used to facilitate the cloning of DNA fragments. Cloning vectors " +
      "tend to be very simple, often containing only a bacterial resistance gene, origin of replication, and an " +
      "MCS. They are small and optimized to help in the initial cloning of a DNA fragment. Commonly used cloning " +
      "vectors include Gateway entry vectors and TOPO cloning vectors.</td><td>Empty Backbones, Cloning Kits</td></tr>" +
      "<tr><td>Reporter Plasmids</td><td>Used for studying the function of genetic elements. These plasmids " +
      "contain a reporter gene (e.g., luciferase or GFP) that offers a readout of the activity of the genetic " +
      "element. For instance, a promoter of interest could be inserted upstream of the luciferase gene to " +
      "determine the level of transcription driven by that promoter.</td><td></td></tr></tbody></table></main>"
  );
  const tables = [...doc.querySelectorAll("table")];
  assert.deepEqual([...tables[0].querySelectorAll("th")].map(text), ["质粒元件", "描述"]);
  const cells0 = [...tables[0].querySelectorAll("tbody tr")];
  assert.deepEqual([...cells0[0].children].map(text), [
    "抗生素抗性基因",
    "通过为细菌宿主提供生存优势，筛选出含质粒的细菌。"
  ]);
  assert.equal(
    text(cells0[1].children[1]),
    "一段含多个限制性酶切位点的短 DNA，可通过酶切与连接方便地插入 DNA。通常 MCS 中的酶切位点是唯一的，" +
      "不出现在质粒骨架的其他位置。在表达质粒中，MCS 常位于启动子下游，以驱动插入基因的表达。"
  );
  assert.equal(text(cells0[2].children[0]), "插入");
  assert.ok(/^用于筛选成功摄取质粒、可用于研究插入片段的细胞。/.test(text(cells0[3].children[1])));
  assert.deepEqual([...tables[1].querySelectorAll("th")].map(text), ["质粒类型", "描述", "Addgene 资源"]);
  const rows = [...tables[1].querySelectorAll("tbody tr")];
  assert.equal(text(rows[0].children[0]), "克隆质粒");
  assert.ok(/^用于帮助克隆 DNA 片段。/.test(text(rows[0].children[1])));
  assert.equal(text(rows[1].children[0]), "报告质粒");
  assert.ok(/^用于研究遗传元件的功能。/.test(text(rows[1].children[1])));
});

test("分子生物学参考页：菌株表与抗生素表（菌株名/供应商/基因型/浓度全部原样）", () => {
  const genotype = "F- mcrA Δ(mrr-hsdRMS-mcrBC) Phi80lacZΔM15 Δ-lacX74 recA1 araΔ139 D(ara-leu)7697 galU galK rpsL (StrR) endA1 nupG";
  const doc = run(
    '<main><table id="strains"><thead><tr><th>Strain</th><th>Vendor(s)</th><th>Genotype</th></tr></thead><tbody>' +
      "<tr><td>BL21</td><td>Invitrogen; New England BioLabs</td><td>" + genotype + "</td></tr>" +
      "<tr><td>DB3.1</td><td>Invitrogen</td><td>F- gyrA462 endA Δ(sr1-recA) mcrB mrr hsdS20</td></tr>" +
      "</tbody></table>" +
      '<table id="abx"><thead><tr><th>Antibiotic</th><th>Recommended Stock Concentration</th>' +
      "<th>Recommended Working Concentration</th></tr></thead><tbody>" +
      "<tr><td>Ampicillin</td><td>100 mg/mL</td><td>100 µg/mL</td></tr>" +
      "<tr><td>Chloramphenicol</td><td>25 mg/mL<br> (dissolve in Ethanol)</td><td>25 µg/mL</td></tr>" +
      "<tr><td>Kanamycin</td><td>50 mg/mL</td><td>50 µg/mL</td></tr>" +
      "</tbody></table></main>"
  );
  const [strains, abx] = [...doc.querySelectorAll("table")];
  assert.deepEqual([...strains.querySelectorAll("th")].map(text), ["菌株", "供应商", "基因型"]);
  const srow = strains.querySelector("tbody tr");
  assert.equal(text(srow.children[0]), "BL21");
  assert.equal(text(srow.children[1]), "Invitrogen; New England BioLabs");
  assert.equal(text(srow.children[2]), genotype, "基因型是数据，不翻");
  assert.deepEqual([...abx.querySelectorAll("th")].map(text), [
    "抗生素",
    "推荐母液浓度",
    "推荐工作浓度"
  ]);
  const arows = [...abx.querySelectorAll("tbody tr")].map((tr) => [...tr.children].map(text));
  assert.deepEqual(arows[0], ["氨苄青霉素", "100 mg/mL", "100 µg/mL"]);
  assert.deepEqual(arows[1], ["氯霉素", "25 mg/mL（溶于乙醇）", "25 µg/mL"]);
  assert.deepEqual(arows[2], ["卡那霉素", "50 mg/mL", "50 µg/mL"]);
});

test("分子生物学参考页：氨基酸表与表位标签表（三字母码/密码子/标签序列原样）", () => {
  const doc = run(
    '<main><table id="aa"><thead><tr><th>Name</th><th>Three Letter Code</th><th>Single Letter Code</th>' +
      "<th>Codons (RNA)</th></tr></thead><tbody>" +
      "<tr><td>Alanine</td><td>Ala</td><td>A</td><td>GCU, GCC, GCA, GCG</td></tr>" +
      "<tr><td>Arginine</td><td>Arg</td><td>R</td><td>CGU, CGC, CGA, CGG, AGA, AGG</td></tr>" +
      "<tr><td>Methionine</td><td>Met</td><td>M</td><td>AUG</td></tr>" +
      "</tbody></table>" +
      '<table id="tags"><thead><tr><th>Tag</th><th>Amino Acid Sequence</th></tr></thead><tbody>' +
      "<tr><td>FLAG</td><td>DYKDDDDK</td></tr><tr><td>Myc</td><td>EQKLISEEDL</td></tr>" +
      "<tr><td>SV40 NLS</td><td>PKKKRKV or PKKKRKVG</td></tr></tbody></table></main>"
  );
  const [aa, tags] = [...doc.querySelectorAll("table")];
  assert.deepEqual([...aa.querySelectorAll("th")].map(text), [
    "名称",
    "三字母代码",
    "单字母代码",
    "密码子（RNA）"
  ]);
  const rows = [...aa.querySelectorAll("tbody tr")].map((tr) => [...tr.children].map(text));
  assert.deepEqual(rows[0], ["丙氨酸", "Ala", "A", "GCU, GCC, GCA, GCG"]);
  assert.deepEqual(rows[1], ["精氨酸", "Arg", "R", "CGU, CGC, CGA, CGG, AGA, AGG"]);
  assert.deepEqual(rows[2], ["甲硫氨酸", "Met", "M", "AUG"]);
  assert.deepEqual([...tags.querySelectorAll("th")].map(text), ["标签", "氨基酸序列"]);
  assert.deepEqual(
    [...tags.querySelectorAll("tbody tr")].map((tr) => [...tr.children].map(text)),
    [
      ["FLAG", "DYKDDDDK"],
      ["Myc", "EQKLISEEDL"],
      ["SV40 NLS", "PKKKRKV or PKKKRKVG"]
    ]
  );
});

test("实验方案索引页：五个分区、表格表头与一句话说明", () => {
  const doc = run(
    '<main><div class="container"><h1>Addgene Protocols</h1>' +
      "<p class=\"section-mb-3\">On this page you'll find practical lab protocols that you can use for a wide " +
      "range of applications, with videos for select protocols in the right-hand column. You can find even more " +
      "video content on the <a>Addgene Video Page</a>. We hope that you'll find these protocols useful in your " +
      "own work. Please feel free to email us at <a>[email protected]</a> with any questions.</p>" +
      '<ul class="addgene-nav-list"><li><a>Intro to the Lab Bench</a></li><li><a>Basic Molecular Biology</a></li>' +
      "<li><a>Plasmid Cloning</a></li><li><a>Virus</a></li><li><a>Antibodies</a></li></ul>" +
      '<section><h2>Intro to the Lab Bench</h2>' +
      "<p>Introductory techniques designed to help you get started in the lab.</p>" +
      "<table><thead><tr><th>Name</th><th>Description</th><th>Link to Video</th></tr></thead><tbody>" +
      "<tr><td><a>Making LB Agar Plates</a></td><td>Create plates to culture bacteria in the lab</td>" +
      "<td><a>Watch the Video!</a></td></tr>" +
      "<tr><td><a>Pipetting</a></td><td>Learn about selecting the correct pipettor and pipette tip, how to " +
      "dispense liquids, and how to handle the pipette</td><td></td></tr></tbody></table></section>" +
      "<section><h2>Basic Molecular Biology</h2>" +
      "<p>These protocols are the building blocks for many more complicated procedures.</p>" +
      "<table><thead><tr><th>Name</th><th>Description</th></tr></thead><tbody>" +
      "<tr><td><a>DNA Ligation</a></td><td>Assemble DNA using DNA ligase</td></tr>" +
      "<tr><td><a>Antibiotic Concentrations for Bacterial Selection</a></td>" +
      "<td>Over-Agar Antibiotic Plating</td></tr></tbody></table></section>" +
      "<section><h2>Plasmid Cloning</h2><p>Protocols for constructing and analyzing your plasmids.</p></section>" +
      "<section><h2>Virus</h2><p>Protocols for titering and testing your virus preparations.</p></section>" +
      "<section><h2>Antibodies</h2><p>Protocols for common antibody applications.</p></section></div></main>"
  );
  assert.equal(text(doc.querySelector("h1")), "Addgene 实验方案");
  assert.equal(
    text(doc.querySelector("p.section-mb-3")),
    "本页汇集可用于广泛领域的实用实验室方案，右栏为部分方案的视频。更多视频内容见 Addgene 视频页面。" +
      "希望这些方案对您的工作有所帮助。如有任何问题，欢迎发邮件至 [email protected]。"
  );
  assert.deepEqual([...doc.querySelectorAll("ul li")].map(text), [
    "实验台入门",
    "基础分子生物学",
    "质粒克隆",
    "病毒",
    "抗体"
  ]);
  assert.deepEqual([...doc.querySelectorAll("h2")].map(text), [
    "实验台入门",
    "基础分子生物学",
    "质粒克隆",
    "病毒",
    "抗体"
  ]);
  assert.deepEqual([...doc.querySelectorAll("section p")].map(text), [
    "帮助您在实验室起步的入门技术。",
    "这些方案是许多更复杂操作的基石。",
    "构建与分析质粒的实验方案。",
    "测定滴度与检测病毒制备的实验方案。",
    "常见抗体应用的实验方案。"
  ]);
  const ths = [...doc.querySelectorAll("th")].map(text);
  assert.deepEqual(ths, ["名称", "描述", "视频链接", "名称", "描述"]);
  const rows = [...doc.querySelectorAll("tbody tr")];
  assert.equal(text(rows[0].children[0]), "Making LB Agar Plates", "方案名是题录，不翻");
  assert.equal(text(rows[0].children[1]), "制作平板用于在实验室培养细菌");
  assert.equal(text(rows[0].children[2].querySelector("a")), "观看视频！");
  assert.ok(/^了解如何选择正确的移液器与吸头/.test(text(rows[1].children[1])));
  assert.equal(text(rows[2].children[1]), "用 DNA 连接酶组装 DNA");
});

test("数据不动：基因名、质粒名、Addgene 编号、邮箱、URL", () => {
  const doc = run(
    "<main><table><tbody><tr>" +
      "<td>Cas9</td><td>pEGFP-N1</td><td>#12345</td><td>pMRX-IP-mGFP-NCOA4</td>" +
      "<td>[email protected]</td>" +
      '<td><a href="https://www.addgene.org/12345/">https://www.addgene.org/12345/</a></td>' +
      "<td>E. coli</td><td>Homo sapiens</td><td>10.1038/nature12373</td>" +
      "</tr></tbody></table></main>"
  );
  assert.deepEqual(
    [...doc.querySelectorAll("td")].slice(0, 8).map(text),
    ["Cas9", "pEGFP-N1", "#12345", "pMRX-IP-mGFP-NCOA4", "[email protected]", "https://www.addgene.org/12345/", "E. coli", "Homo sapiens"]
  );
  assert.equal(doc.querySelector("a").getAttribute("href"), "https://www.addgene.org/12345/");
});
test("旧浏览器提示条：整句模板 + 末尾 Learn more 链接", () => {
  const doc = run(
    '<div class="alert alert-warning"><p>' +
      "Please note: Your browser does not fully support some of the features used on Addgene's website. If you " +
      "run into any problems registering, depositing, or ordering please contact us at help@addgene.org. " +
      '<a href="/browser/">Learn more</a></p></div>'
  );
  const p = doc.querySelector("p");
  assert.equal(
    text(p),
    "请注意：您的浏览器不能完全支持 Addgene 网站的部分功能。若在注册、存放或订购时遇到问题，" +
      "请联系我们：help@addgene.org。了解更多"
  );
  assert.equal(p.querySelector("a").getAttribute("href"), "/browser/", "链接地址不动");
});

test("表格控件与动态条数：DataTables 的 Show/entries 与计数规则", () => {
  const doc = run(
    '<main><div class="dataTables_length"><label>Show <select>' +
      "<option>10</option><option>25</option><option>All</option></select> entries</label></div>" +
      '<div class="dataTables_filter"><label>Search table: <input></label></div>' +
      '<div class="dataTables_info">Showing 1 to 18 of 18 entries</div>' +
      '<div class="dataTables_info" id="empty">Showing 0 to 0 of 0 entries</div></main>'
  );
  const label = doc.querySelector(".dataTables_length label");
  assert.equal(text(label), "显示 1025全部条");
  assert.deepEqual([...doc.querySelectorAll("option")].map(text), ["10", "25", "全部"]);
  assert.equal(text(doc.querySelector(".dataTables_filter label")), "检索表格：");
  const info = [...doc.querySelectorAll(".dataTables_info")].map(text);
  assert.equal(info[0], "显示第 1 至 18 条，共 18 条");
  assert.equal(info[1], "没有匹配的记录");
});