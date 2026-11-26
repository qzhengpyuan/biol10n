// Ensembl 新版站点（首访通知 · 物种页 · 存档页）与 UCSC 反爬提示页 / 帮助页断句 补译回归
// 只翻界面与固定标签：物种拉丁名、组装 accession（GRCh38.p14 / GCA_…）、版本+日期链接保持原文。
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
const ensSite = sites.find((s) => s.id === "ensembl");
const ucscSite = sites.find((s) => s.id === "ucsc");
const book = (n) => JSON.parse(fs.readFileSync(path.join(root, "../dict/" + n + ".json"), "utf8"));
const ensExtra = book("ensembl-extra");
const ucscExtra = book("ucsc-extra");
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;

// 与线上一致：把站点声明的册子全部装上（规则/模板挂在哪一册都要能命中）
function loadDicts(site) {
  const exact = {}; const rules = []; const templates = [];
  for (const n of site.dicts) {
    const d = book(n);
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
    templates.push(...(d.templates || []));
  }
  return { exact, rules, templates };
}

function run(html, site, url) {
  const dom = new JSDOM(html, { url });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: loadDicts(site),
    site
  });
  engine.start();
  return dom.window.document;
}

const ens = (html) => run(html, ensSite, "https://www.ensembl.org/");
const ucsc = (html) => run(html, ucscSite, "https://genome.ucsc.edu/");
const text = (el) => String(el.textContent || "").replace(/\s+/g, " ").trim();

// ---------------- 结构校验 ----------------

// 本轮新增的首访通知 / 物种页 / 存档页条目（键 → 值，逐条钉住）
const NEW_ENSEMBL = {
  "Explore genome annotation across the tree of life.": "探索生命之树上的基因组注释。",
  "Welcome to the new Ensembl — home to thousands of genomes ready to explore in our new fast interface.": "欢迎使用新版 Ensembl，这里是数千个基因组的家园，可在全新的高速界面中探索。",
  "You will find genomes we've shared before, plus a growing collection of new species and annotation data.": "你可以找到我们此前分享过的基因组，以及不断新增的物种与注释数据。",
  "We're actively developing this site to expand tools, features, and species coverage. If you rely on features not yet available here, previous Ensembl versions remain accessible via our archives for the long term.": "我们正在积极开发本站，以扩展工具、功能与物种覆盖范围。如果你依赖的功能尚未在此提供，旧版 Ensembl 仍可通过存档长期访问。",
  "During this transition, use whichever Ensembl site best fits your work. The latest archives will continue to receive extended tools support during this time.": "过渡期间，请选用最适合你工作的 Ensembl 站点。最新存档在此期间仍将继续获得扩展的工具支持。",
  "We welcome feedback and questions, please feel free to": "欢迎提供反馈与提问，请随时",
  "Ensembl Archives": "Ensembl 存档",
  "Add a genome": "添加基因组",
  "Remove from list": "从列表中移除",
  "Don't use": "不使用",
  "Use": "使用",
  "Coding genes": "蛋白编码基因",
  "Non-coding genes": "非编码基因",
  "Pseudogenes": "假基因",
  "Example gene": "示例基因",
  "Example location": "示例位置",
  "Example variant": "示例变异",
  "chromosomes or plasmids": "染色体或质粒",
  "short variants": "短变异",
  "Assembly level": "组装水平",
  "Provider": "提供方",
  "Manual annotation": "人工注释",
  "Annotation version": "注释版本",
  "Taxonomy ID": "分类学 ID",
  "Assembly released": "组装发布日期",
  "Get files": "获取文件",
  "Using Ensembl": "使用 Ensembl",
  "Ensembl data": "Ensembl 数据",
  "Release information": "版本信息",
  "Ensembl archives and previous sites": "Ensembl 存档与旧站点",
  "The legacy Ensembl archives for versions 116 and Ensembl Genomes version 63": "116 版与 Ensembl Genomes 63 版的旧版存档",
  "Previous versions of Ensembl (vertebrates)": "Ensembl 旧版本（脊椎动物）",
  "Previous versions of Ensembl Genomes (non-vertebrates)": "Ensembl Genomes 旧版本（非脊椎动物）",
  "- Latest legacy Ensembl version - tool support enabled over Ensembl transition": "— 最新的旧版 Ensembl，过渡期间仍提供工具支持",
  "Special archives - IMPORTANT - will be retired soon": "特殊存档 — 重要 — 即将停用",
  "- Annotation on the mouse GRCm38 assembly": "— 小鼠 GRCm38 组装的注释",
  "- Annotation on the zebrafish Zv9 assembly": "— 斑马鱼 Zv9 组装的注释",
  "- Annotation on the human GRCh37 assembly": "— 人类 GRCh37 组装的注释",
  "- Annotation on the human NCBI36 assembly, zebrafish Zv8 assembly": "— 人类 NCBI36 组装、斑马鱼 Zv8 组装的注释",
  "Data archives on the FTP site": "FTP 站点上的数据存档",
  "We maintain data archives on our FTP sites:": "我们在 FTP 站点上维护数据存档：",
  "Ensembl Vertebrates FTP": "Ensembl 脊椎动物 FTP",
  "Ensembl FTP (this site)": "Ensembl FTP（本站）"
};

const NEW_UCSC = {
  "The Genome Browser is protecting itself from bots. This will just take a few seconds.": "基因组浏览器正在防范机器人访问，只需稍等几秒。",
  "To make programmatic queries, see our FAQ: https://genome.ucsc.edu/FAQ/FAQdownloads.html#CAPTCHA.": "如需进行程序化查询，请参阅常见问题里的 CAPTCHA 说明。",
  "Only the most recent assemblies are fully active. The data for older assemblies may be available on our": "只有最新的组装才是完全可用的，较旧组装的数据可能位于我们的",
  "If you encounter difficulties displaying your annotation, read the section": "如果显示注释时遇到困难，请阅读"
};

test("新增条目逐条在册（Ensembl 首访通知/物种页/存档页，UCSC 反爬页与帮助页断句）", () => {
  const missEns = Object.entries(NEW_ENSEMBL).filter(([k, v]) => ensExtra.exact[k] !== v);
  const missUcsc = Object.entries(NEW_UCSC).filter(([k, v]) => ucscExtra.exact[k] !== v);
  assert.deepEqual(missEns, [], "ensembl-extra 缺条目或被改值");
  assert.deepEqual(missUcsc, [], "ucsc-extra 缺条目或被改值");
  assert.ok(Object.keys(ensExtra.exact).length >= 440);
  assert.ok(Object.keys(ucscExtra.exact).length >= 440);
});

test("条目卫生：键无中文/无首尾空白，值含中文、非自映射、不含 URL 与邮箱", () => {
  const bad = [];
  for (const [bookId, d] of Object.entries({ "ensembl-extra": ensExtra, "ucsc-extra": ucscExtra })) {
    for (const [k, v] of Object.entries(d.exact)) {
      if (CJK.test(k)) bad.push(bookId + " 键含中文: " + k);
      if (k !== k.trim()) bad.push(bookId + " 键首尾空白: " + JSON.stringify(k));
      if (v !== v.trim()) bad.push(bookId + " 值首尾空白: " + k);
      if (!CJK.test(v)) bad.push(bookId + " 值无中文: " + k);
      if (k === v) bad.push(bookId + " 自映射: " + k);
      if (/https?:\/\/|[\w.+-]+@[\w-]+\.\w+/.test(v)) bad.push(bookId + " 值含 URL/邮箱: " + k);
    }
  }
  assert.deepEqual(bad, []);
});

test("rules 必须 ^…$ 锚定、$n 引用的捕获组真实存在；templates 占位符 1..N 连续且与中文一一对应", () => {
  for (const [bookId, d] of Object.entries({ "ensembl-extra": ensExtra, "ucsc-extra": ucscExtra })) {
    for (const r of d.rules || []) {
      assert.ok(r.re.startsWith("^") && r.re.endsWith("$"), bookId + " 规则未锚定: " + r.re);
      const n = (r.re.match(/(?<!\\)\((?!\?)/g) || []).length;
      const used = [...r.to.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
      for (const u of used) assert.ok(u >= 1 && u <= n, bookId + " 规则引用了不存在的捕获组 $" + u + ": " + r.re);
      assert.ok(!/https?:\/\//.test(r.to), bookId + " 规则译文含 URL: " + r.re);
    }
    for (const t of d.templates || []) {
      const patNums = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
      const zhNums = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
      const uniq = [...new Set(patNums)].sort((a, b) => a - b);
      assert.deepEqual(uniq, uniq.map((_, i) => i + 1), bookId + " 模板占位符不连续: " + t.pat);
      assert.deepEqual([...new Set(zhNums)].sort((a, b) => a - b), uniq, bookId + " 模板中英占位符不对应: " + t.pat);
      assert.ok(!CJK.test(t.pat), bookId + " 模板 pat 含中文: " + t.pat);
      assert.ok(CJK.test(t.zh), bookId + " 模板译文无中文: " + t.pat);
      assert.ok(t.pat.length <= 2200, bookId + " 模板过长: " + t.pat.slice(0, 40));
    }
  }
});

// ---------------- Ensembl：新版首访通知（CommunicationPanel） ----------------

const NOTICE_HTML =
  '<div class="root__Root__8fRu3"><div class="panelBody__CommunicationPanel__VVo7B">' +
  '<div class="container__Notification__9pBLP" data-nosnippet="true">' +
  '<p class="strong__FirstVisitNotification__FQQUO">Explore genome annotation across the tree of life.</p>' +
  '<p>Welcome to the new Ensembl — home to thousands of genomes ready to explore in our new fast interface.</p>' +
  '<p>You will find genomes we\u2019ve shared before, plus a growing collection of new species and annotation data.</p>' +
  '<p>We\u2019re actively developing this site to expand tools, features, and species coverage. If you rely on features not yet available here, previous Ensembl versions remain accessible via our archives for the long term.</p>' +
  '<p><a href="/help/articles/archives" data-discover="true">Ensembl Archives</a></p>' +
  '<p>During this transition, use whichever Ensembl site best fits your work. The latest archives will continue to receive extended tools support during this time.</p>' +
  '<p>We welcome feedback and questions, please feel free to <a href="/contact-us" data-discover="true">Contact us</a>.</p>' +
  '</div></div></div>';

test("Ensembl 首访通知：六段说明与链接整体译成中文，无英文残留", () => {
  const doc = ens(NOTICE_HTML);
  const ps = [...doc.querySelectorAll("p")];
  assert.equal(ps.length, 7);
  const en = ps.map(text).filter((t) => /[A-Za-z]{3,}/.test(t.replace(/Ensembl|EMBL-EBI/g, "")));
  assert.deepEqual(en, [], "仍有英文段落");
  assert.equal(text(ps[0]), "探索生命之树上的基因组注释。");
  assert.ok(text(ps[1]).startsWith("欢迎使用新版 Ensembl"));
  assert.ok(text(ps[2]).startsWith("你可以找到我们此前分享过的基因组"));
  assert.ok(text(ps[3]).includes("旧版 Ensembl 仍可通过存档长期访问"));
  assert.equal(text(ps[4]), "Ensembl 存档");
  assert.ok(text(ps[4]).length > 0 && !/Archives/.test(text(ps[4])));
  assert.ok(text(ps[5]).startsWith("过渡期间"));
});

test("Ensembl 首访通知：反馈句被 <a> 切开也要拼成完整中文（不出现半中半英）", () => {
  const doc = ens(NOTICE_HTML);
  const last = [...doc.querySelectorAll("p")].at(-1);
  assert.equal(text(last), "欢迎提供反馈与提问，请随时联系我们。");
  const a = last.querySelector("a");
  assert.equal(a.getAttribute("href"), "/contact-us", "链接节点必须保留");
});

// ---------------- Ensembl：物种页（Info/Index） ----------------

test("Ensembl 物种页：用量切换、统计块、侧栏字段逐个翻译", () => {
  const doc = ens(
    '<div class="root__Root__8fRu3">' +
    '<div class="topbarContents__SpeciesPage__SarRD"><button class="button__AddButton__ouI">Add a genome</button></div>' +
    '<div class="speciesUsageToggle__SpeciesUsageToggle__Eq2Nk"><span>Use</span><span>Don\u2019t use</span></div>' +
    '<div class="speciesRemove__SpeciesTitleArea__hai3S"><button class="deleteButtonWithLabel__DeleteButton__Rh0w"><span>Remove from list</span></button></div>' +
    '<div class="collapsedContentGrid__SpeciesMainView__90Ao1">' +
    '<span class="title__SpeciesMainView__90Ao1">Coding genes</span>' +
    '<span class="title__SpeciesMainView__90Ao1">Non-coding genes</span>' +
    '<span class="title__SpeciesMainView__90Ao1">Pseudogenes</span>' +
    '</div>' +
    '<div class="summaryStat__SpeciesMainView__90Ao1"><span class="unit__SpeciesMainView__90Ao1">chromosomes or plasmids</span></div>' +
    '<div class="summaryStat__SpeciesMainView__90Ao1"><span class="unit__SpeciesMainView__90Ao1">short variants</span></div>' +
    '<div class="exampleLink__SpeciesMainView__90Ao1"><button class="wrapper__ViewInAppPopup__UkGeA"><span>Example gene</span></button></div>' +
    '<div class="exampleLink__SpeciesMainView__90Ao1"><button class="wrapper__ViewInAppPopup__UkGeA"><span>Example location</span></button></div>' +
    '<div class="exampleLink__SpeciesMainView__90Ao1"><button class="wrapper__ViewInAppPopup__UkGeA"><span>Example variant</span></button></div>' +
    '<section class="section__SpeciesPageSidebar__Ru04q">' +
    '<div class="field__SpeciesPageSidebar__Ru04q"><span class="label__SpeciesPageSidebar__Ru04q">Assembly level</span></div>' +
    '<div class="field__SpeciesPageSidebar__Ru04q"><span class="label__SpeciesPageSidebar__Ru04q">Provider</span></div>' +
    '<div class="field__SpeciesPageSidebar__Ru04q"><span class="label__SpeciesPageSidebar__Ru04q">Manual annotation</span></div>' +
    '<div class="field__SpeciesPageSidebar__Ru04q"><span class="label__SpeciesPageSidebar__Ru04q">Annotation version</span></div>' +
    '<div class="field__SpeciesPageSidebar__Ru04q"><span class="label__SpeciesPageSidebar__Ru04q">Taxonomy ID</span></div>' +
    '<div class="field__SpeciesPageSidebar__Ru04q"><span class="label__SpeciesPageSidebar__Ru04q">Assembly released</span></div>' +
    '<button class="getFiles__SpeciesPageSidebar__Ru04q"><span>Get files</span></button>' +
    '</section></div>'
  );
  const labels = [...doc.querySelectorAll("span.label__SpeciesPageSidebar__Ru04q, button, button span, .title__SpeciesMainView__90Ao1, .unit__SpeciesMainView__90Ao1, .speciesUsageToggle__SpeciesUsageToggle__Eq2Nk span")].map(text);
  const got = labels.join("|");
  for (const zh of ["使用", "不使用", "从列表中移除", "蛋白编码基因", "非编码基因", "假基因",
    "染色体或质粒", "短变异", "示例基因", "示例位置", "示例变异", "组装水平", "提供方",
    "人工注释", "注释版本", "分类学 ID", "组装发布日期", "获取文件", "添加基因组"]) {
    assert.ok(got.includes(zh), "缺译文: " + zh + " 实际: " + got);
  }
  assert.ok(!/Coding genes|Pseudogenes|Get files|Assembly level/.test(got), "仍有英文标签: " + got);
});

test("Ensembl 物种页：物种拉丁名、组装 accession 保持英文", () => {
  const doc = ens(
    '<div class="root__Root__8fRu3"><div class="speciesName__SpeciesName__wGNHt"><span>GRCh38.p14</span></div>' +
    '<span class="scientificName__SpeciesPageSidebar__Ru04q">Homo sapiens</span>' +
    '<a class="link__ExternalLink__V298G">GCA_000001405.29</a>' +
    '<a class="link__ExternalLink__V298G">GENCODE</a></div>'
  );
  const got = [...doc.querySelectorAll("span, a")].map(text);
  assert.deepEqual(got, ["GRCh38.p14", "Homo sapiens", "GCA_000001405.29", "GENCODE"]);
});

// ---------------- Ensembl：存档页（help/articles/archives） ----------------

test("Ensembl 存档页：面包屑/标题/列表/FTP 段整体翻译", () => {
  const doc = ens(
    '<div class="root__Root__8fRu3">' +
    '<div class="helpMenu__HelpMenu__HSq1N"><span class="topMenuItem__HelpMenu__HSq1N">Using Ensembl</span>' +
    '<span class="topMenuItem__HelpMenu__HSq1N">Ensembl data</span></div>' +
    '<div class="breadcrumbs__Breadcrumbs__Y4d2P"><span class="breadcrumb__Breadcrumbs__Y4d2P">Release information</span></div>' +
    '<article><h1>Ensembl archives and previous sites</h1>' +
    '<h2>The legacy Ensembl archives for versions 116 and Ensembl Genomes version 63</h2>' +
    '<ul><li><a>Ensembl 116: Jun 2026</a></li>' +
    '<li>- Latest legacy Ensembl version - tool support enabled over Ensembl transition</li></ul>' +
    '<h2>Previous versions of Ensembl (vertebrates)</h2>' +
    '<ul><li>- Annotation on the mouse GRCm38 assembly</li>' +
    '<li>- Annotation on the zebrafish Zv9 assembly</li></ul>' +
    '<h2>Special archives - IMPORTANT - will be retired soon</h2>' +
    '<h2>Data archives on the FTP site</h2>' +
    '<p>We maintain data archives on our FTP sites:</p>' +
    '<ul><li><a>Ensembl Vertebrates FTP</a></li><li><a>Ensembl FTP (this site)</a></li></ul></article></div>'
  );
  const body = text(doc.body);
  for (const zh of ["使用 Ensembl", "Ensembl 数据", "版本信息", "Ensembl 存档与旧站点",
    "116 版与 Ensembl Genomes 63 版的旧版存档", "— 最新的旧版 Ensembl，过渡期间仍提供工具支持",
    "Ensembl 旧版本（脊椎动物）", "— 小鼠 GRCm38 组装的注释", "— 斑马鱼 Zv9 组装的注释",
    "特殊存档 — 重要 — 即将停用", "FTP 站点上的数据存档", "我们在 FTP 站点上维护数据存档：",
    "Ensembl 脊椎动物 FTP", "Ensembl FTP（本站）"]) {
    assert.ok(body.includes(zh), "缺译文: " + zh);
  }
  assert.ok(body.includes("Ensembl 116: Jun 2026"), "版本+日期链接应保持原文");
});

// ---------------- UCSC：反爬提示页 ----------------

test("UCSC 反爬提示页（hgGateway / hgTracks 撞到 Cloudflare 挑战时）：两段整译", () => {
  const doc = ucsc(
    '<html><body><h4>The Genome Browser is protecting itself from bots. This will just take a few seconds.</h4>' +
    '<small>To make programmatic queries, see our FAQ: https://genome.ucsc.edu/FAQ/FAQdownloads.html#CAPTCHA.</small></body></html>'
  );
  assert.equal(text(doc.querySelector("h4")), "基因组浏览器正在防范机器人访问，只需稍等几秒。");
  assert.equal(text(doc.querySelector("small")), "如需进行程序化查询，请参阅常见问题里的 CAPTCHA 说明。");
});

// ---------------- UCSC：hgTracksHelp 里被链接切开的句子 ----------------

test("hgTracksHelp 断句：Only the most recent assemblies…（下载页链接保留）", () => {
  const doc = ucsc(
    '<div class="gbsPage"><ul><li><span>Only the most recent assemblies are fully active. The data for older assemblies may be available on our</span> ' +
    '<a href="/downloads.html">downloads page</a></li></ul></div>'
  );
  const li = doc.querySelector("li");
  assert.ok(text(li).startsWith("只有最新的组装才是完全可用的，较旧组装的数据可能位于我们的"), text(li));
  const a = li.querySelector("a");
  assert.equal(a.getAttribute("href"), "/downloads.html", "链接节点必须保留");
  assert.ok(!/Only the most recent/.test(text(li)));
});

test("hgTracksHelp 断句：If you encounter difficulties… 与紧随其后的中文小节名成句", () => {
  const doc = ucsc(
    '<div class="gbsPage"><p>If you encounter difficulties displaying your annotation, read the section ' +
    '<a href="#ctTrouble">troubleshooting</a>.</p></div>'
  );
  const p = text(doc.querySelector("p"));
  assert.ok(p.startsWith("如果显示注释时遇到困难，请阅读"), p);
  assert.ok(!/If you encounter difficulties/.test(p));
});

// ---------------- 规则 / 模板通道必须真的接通 ----------------

test("规则通道：ensembl-extra 的 What's new in release N?", () => {
  const doc = ens('<div class="root__Root__8fRu3"><p><span>What\u2019s new in release 115?</span></p></div>');
  assert.equal(text(doc.querySelector("span")), "版本 115 有什么新内容？");
});

test("规则通道：ucsc-extra 的 Exon N of M / Intron N of M", () => {
  const doc = ucsc("<div><p><span>Exon 3 of 12</span><span>Intron 2 of 7</span></p></div>");
  const got = [...doc.querySelectorAll("span")].map(text);
  assert.deepEqual(got, ["第 3 个（共 12 个）", "第 2 个（共 7 个）"]);
});

test("模板通道：ensembl-extra Looking for {{1}} to install databases locally? 保住链接", () => {
  const doc = ens('<div class="root__Root__8fRu3"><p>Looking for <a href="/info/data/ftp/">FTP files</a> to install databases locally?</p></div>');
  const p = doc.querySelector("p");
  assert.ok(text(p).startsWith("需要在本地安装数据库，正在寻找"), text(p));
  assert.ok(text(p).endsWith("？"), text(p));
  assert.equal(p.querySelector("a").getAttribute("href"), "/info/data/ftp/", "模板替换后链接不能丢");
});

test("模板通道：ucsc-extra Using the {{1}} flag", () => {
  const doc = ucsc('<div class="gbsPage"><p>Using the <em>-minScore</em> flag</p></div>');
  assert.equal(text(doc.querySelector("p")), "使用 -minScore 选项");
});