// HPO 首页/关于页/术语页剩余界面文案（r26）：hero 整段（4 个链接要保）、
// 新闻区不可用横幅、关于页前两段、导航二级菜单、术语页固定标签。
// 英文原串全部取自真实 DOM（25s 抓取），hero 与关于页段落走 templates 通道保住 <a>/<em>。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/hpo.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "hpo");
assert.ok(site, "config/sites.json 里应有 hpo 站点");

// 生产上 hpo 与 common 一起加载：按站点 dicts 顺序合并，再叠加本册。
const exact = {};
for (const name of site.dicts) {
  const p = path.join(root, "../dict", name + ".json");
  if (!fs.existsSync(p)) continue;
  Object.assign(exact, JSON.parse(fs.readFileSync(p, "utf8")).exact || {});
}
Object.assign(exact, dict.exact);

function boot(html = "<p>hi</p>") {
  const dom = new JSDOM(html, { url: "https://hpo.jax.org/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact, rules: dict.rules, templates: dict.templates },
    site: { scope: "body", block: "pre, code", attrs: [], rescan: [], ...site }
  });
  engine.start();
  return { dom, engine, doc: dom.window.document };
}
const tr = (s) => boot().engine.translateText(s);
const flat = (el) => el.textContent.replace(/\s+/g, " ").trim();

// ---- 词库结构 ----
test("r26 词库：标准序列化、末尾换行、键无中文", () => {
  const raw = fs.readFileSync(path.join(root, "../dict/hpo.json"), "utf8");
  assert.ok(raw.endsWith("\n"), "dict/hpo.json 应以换行结尾");
  assert.equal(raw, JSON.stringify(dict, null, 2) + "\n", "dict/hpo.json 应是 2 空格缩进的标准序列化");
  for (const k of Object.keys(dict.exact)) assert.ok(!/[\u4e00-\u9fff]/.test(k), "exact 的键必须是英文原串：" + k);
});

test("r26 词库：新增模板占位符 1..N 一一对应", () => {
  const nums = (s) => (s.match(/\{\{(\d+)\}\}/g) || []).map((x) => Number(x.replace(/\D/g, "")));
  for (const t of dict.templates) {
    const a = nums(t.pat).sort((x, y) => x - y);
    const b = nums(t.zh).sort((x, y) => x - y);
    assert.deepEqual(b, a, "模板占位符不一致: " + t.pat.slice(0, 50));
    assert.ok(a.length > 0, "模板缺占位符: " + t.pat.slice(0, 50));
    assert.ok(a.every((n, i) => n === i + 1), "占位符必须是 1..N：" + t.pat.slice(0, 50));
  }
});

// ---- 1) 首页 hero 整段（192 字符首节点 + 4 个链接，共 9 个子节点） ----
const HERO =
  "<p>The Human Phenotype Ontology (HPO) provides a standardized vocabulary of phenotypic abnormalities encountered in human disease. " +
  "Each term in the HPO describes a phenotypic abnormality, such as " +
  '<a routerLink="/browse/term/HP:0001631" href="/browse/term/HP:0001631">Atrial septal defect</a>. ' +
  "The HPO is currently being developed using the medical literature, Orphanet, DECIPHER, and OMIM. " +
  "HPO currently contains over 18,000 terms and over 156,000 annotations to hereditary diseases. " +
  "The HPO project and others have developed software for phenotype-driven differential diagnostics, genomic diagnostics, and translational research. " +
  "The HPO is a central component of one of the " +
  '<a href="https://www.ga4gh.org/howwework/driver-projects.html" target="__blank">13 driver projects</a> in the ' +
  '<a href=" https://www.ga4gh.org/" target="__blank">Global Alliance for Genomics and Health</a> (GA4GH) ' +
  '<a href="https://www.ga4gh.org/about-us/strategic-road-map/">strategic roadmap</a>.</p>';

const HERO_ZH =
  "人类表型本体（HPO）提供了一套标准化词汇，用于描述人类疾病中遇到的表型异常。HPO 中的每个术语都描述一种表型异常，例如Atrial septal defect。" +
  "HPO 目前依据医学文献、Orphanet、DECIPHER 与 OMIM 进行开发。HPO 现收录超过 18,000 个术语和超过 156,000 条遗传病注释。" +
  "HPO 项目及其他团队已开发出用于表型驱动的鉴别诊断、基因组诊断与转化研究的软件。" +
  "HPO 是13 个驱动项目中某一项目的核心组成部分，该项目属于全球基因组学与健康联盟（GA4GH）的战略路线图。";

test("首页 hero 整段：走 templates，四个链接原位保留", () => {
  const { engine, doc } = boot(HERO);
  const p = doc.querySelector("p");
  assert.equal(p.getAttribute("data-biol10n-tpl"), "1", "整段应由模板通道替换");
  assert.equal(flat(p), HERO_ZH);
  const links = [...p.querySelectorAll("a")];
  assert.equal(links.length, 4, "四个链接必须保留");
  assert.deepEqual(links.map((a) => a.getAttribute("href")), [
    "/browse/term/HP:0001631",
    "https://www.ga4gh.org/howwework/driver-projects.html",
    " https://www.ga4gh.org/",
    "https://www.ga4gh.org/about-us/strategic-road-map/"
  ]);
  // 表型术语（数据）保持英文，界面链接译成中文
  assert.equal(links[0].textContent.trim(), "Atrial septal defect");
  assert.equal(links[1].textContent.trim(), "13 个驱动项目");
  assert.equal(links[2].textContent.trim(), "全球基因组学与健康联盟");
  assert.equal(links[3].textContent.trim(), "战略路线图");
  assert.ok(!/phenotypic abnormalities encountered/.test(p.textContent), "英文原段不应残留");
  assert.ok(engine.stats.tpl >= 1, "模板命中要记账");
});

test("首页 hero：重扫与关闭都不破坏链接（SPA rescan / disable）", () => {
  const { engine, doc } = boot(HERO);
  const p = doc.querySelector("p");
  engine.scan();
  assert.equal(flat(p), HERO_ZH, "重扫后不应二次替换或丢链接");
  assert.equal(p.querySelectorAll("a").length, 4);
  engine.disable();
  assert.equal(p.querySelectorAll("a").length, 4, "关闭后链接仍在");
  assert.ok(p.textContent.includes("provides a standardized vocabulary of phenotypic abnormalities"));
  assert.ok(p.textContent.includes("strategic roadmap"));
});

// ---- 2) 新闻区不可用横幅（文案被 <a> 切成三段） ----
const NEWS =
  '<div class="ng-star-inserted"> Temporarily Unavailable. Please <a routerLink="/contact" href="/contact">contact us </a> if this does not return soon. </div>';

test("新闻区不可用横幅：整段成中文且保留 contact 链接", () => {
  const { doc } = boot(NEWS);
  const box = doc.querySelector("div");
  assert.equal(box.getAttribute("data-biol10n-tpl"), "1");
  assert.match(flat(box), /^暂时不可用。若稍后仍未恢复，请联系我们\s*。$/);
  const a = box.querySelector("a");
  assert.equal(a.getAttribute("href"), "/contact");
  assert.equal(a.textContent.trim(), "联系我们");
  assert.ok(!/Temporarily Unavailable/.test(box.textContent));
});

// ---- 3) 关于页第一段（<em>compute</em> + 两个链接） ----
const P1 =
  "<p>The Human Phenotype Ontology (HPO) project provides an ontology of medically relevant phenotypes, disease-phenotype annotations, and the algorithms that operate on these. " +
  "The HPO can be used to support differential diagnostics, translational research, and a number of applications in computational biology by providing the means to " +
  "<em>compute</em> over the clinical phenotype. The HPO is being used for computational deep phenotyping and precision medicine as well as integration of clinical data into translational research. " +
  '<a routerLink="/faq" href="/faq">Deep phenotyping</a> can be defined as the precise and comprehensive analysis of phenotypic abnormalities in which the individual components of the phenotype are observed and described. ' +
  "The HPO is being increasingly adopted as a standard for phenotypic abnormalities by diverse groups such as international rare disease organizations, registries, clinical labs, biomedical resources, and clinical software tools and will thereby contribute toward nascent efforts at global data exchange for identifying disease etiologies (" +
  '<a href="https://www.ncbi.nlm.nih.gov/pubmed/27899602">Köhler et al, 2017</a>).</p>';

test("关于页第一段：<em>compute</em> 与两个链接都留在原位", () => {
  const { doc } = boot(P1);
  const p = doc.querySelector("p");
  assert.equal(p.getAttribute("data-biol10n-tpl"), "1");
  const text = flat(p);
  assert.ok(text.includes("提供对临床表型进行计算的手段"), "em 槽位应译成「计算」：" + text);
  assert.ok(text.includes("深度表型分析可定义为对表型异常进行精确而全面的分析"));
  assert.ok(text.includes("（Köhler et al, 2017）"), "文献引用保持原文");
  assert.equal(p.querySelector("em").textContent.trim(), "计算");
  const links = [...p.querySelectorAll("a")];
  assert.equal(links.length, 2);
  assert.equal(links[0].getAttribute("href"), "/faq");
  assert.equal(links[0].textContent.trim(), "深度表型分析");
  assert.equal(links[1].textContent.trim(), "Köhler et al, 2017");
});

// ---- 4) 关于页第二段（三处本体术语链接是数据，保持英文） ----
const P2 =
  "<p>The HPO currently contains over 18,000 terms arranged in a directed acyclic graph and are connected by is-a (subclass-of) edges, such that a term represents a more specific or limited instance of its parent term(s). " +
  "All relationships in the HPO are is-a relationships, i.e. simple class-subclass relationships. For instance, " +
  '<a routerLink="/browse/term/HP:0000517" href="/browse/term/HP:0000517"><em>Abnormal lens morphology</em></a> is-a ' +
  '<a href="/browse/term/HP:0012372"><em>Abnormal eye morphology</em></a>. ' +
  "The relationships are transitive, meaning that they are inherited up all paths to the root. " +
  '<a href="/browse/term/HP:0000118"><em>Phenotypic abnormality</em></a> is the main subontology of the HPO and contains descriptions of clinical abnormalities. ' +
  "Additional subontologies are provided to describe inheritance patterns, onset/clinical course and modifiers of abnormalities.</p>";

test("关于页第二段：术语链接是数据保持英文，句式整段成中文", () => {
  const { doc } = boot(P2);
  const p = doc.querySelector("p");
  const text = flat(p);
  assert.ok(text.includes("例如，Abnormal lens morphology 是 Abnormal eye morphology 的子类"), text);
  assert.ok(text.includes("Phenotypic abnormality 是 HPO 的主要子本体"));
  assert.ok(text.includes("这些关系具有传递性"));
  assert.equal(p.querySelectorAll("a").length, 3, "三个术语链接必须保留");
  assert.deepEqual([...p.querySelectorAll("a")].map((a) => a.getAttribute("href")), [
    "/browse/term/HP:0000517",
    "/browse/term/HP:0012372",
    "/browse/term/HP:0000118"
  ]);
});

// ---- 5) 导航二级菜单（Data / Tools 下拉，由 Angular overlay 渲染） ----
test("导航二级菜单：Data 与 Tools 的分组与条目", () => {
  assert.equal(tr("Annotations"), "注释");
  assert.equal(tr("Translation"), "翻译");
  assert.equal(tr("Translations"), "翻译");
  assert.equal(tr("Layperson Synonyms"), "通俗同义词");
  assert.equal(tr("Genomic Tools"), "基因组工具");
  assert.equal(tr("Phenomic Tools"), "表型组工具");
  assert.equal(tr("Other HPO Browsers"), "其他 HPO 浏览器");
});

test("导航二级菜单：产品名保留英文，冒号后的说明翻", () => {
  assert.equal(tr("Genomiser: Analyze non-coding variants"), "Genomiser：分析非编码变异");
  assert.equal(tr("Exomiser: Prioritize variants from VCF"), "Exomiser：为 VCF 中的变异排定优先级");
  assert.equal(tr("Phenomizer: Clinical diagnostics"), "Phenomizer：临床诊断");
  assert.equal(tr("PhenoGramViz: Evaluation of CNV's"), "PhenoGramViz：CNV 评估");
  assert.equal(tr("LOINC2HPO: Integration of Laboratory Tests"), "LOINC2HPO：实验室检查整合");
});

test("导航二级菜单：菜单项在真实 <button> 结构里替换", () => {
  const { engine, doc } = boot(
    '<div class="cdk-overlay-container"><button role="menuitem"><span class="mat-mdc-menu-item-text"> Ontology</span></button>' +
      '<button role="menuitem"><span class="mat-mdc-menu-item-text"> Annotations</span></button>' +
      '<button role="menuitem"><span class="mat-mdc-menu-item-text">Profile Search</span></button>' +
      '<button role="menuitem"><span class="mat-mdc-menu-item-text">Genomic Tools</span></button>' +
      '<button role="menuitem"><span class="mat-mdc-menu-item-text"> Other HPO Browsers</span></button></div>'
  );
  engine.scan();
  assert.deepEqual([...doc.querySelectorAll("span.mat-mdc-menu-item-text")].map((s) => s.textContent.trim()), [
    "本体",
    "注释",
    "表型谱检索",
    "基因组工具",
    "其他 HPO 浏览器"
  ]);
});

// ---- 6) 术语页与导出对话框的固定标签 ----
test("术语页固定标签：Comment: / Organ abnormality", () => {
  assert.equal(tr("Comment:"), "注释：");
  assert.equal(tr("Organ abnormality"), "器官异常");
  const { engine, doc } = boot(
    '<mat-card-content><div><strong>Comment:</strong> This is the root of the phenotypic abnormality subontology of the HPO.</div>' +
      '<div><i class="ng-star-inserted">Organ abnormality</i></div></mat-card-content>'
  );
  engine.scan();
  assert.equal(doc.querySelector("strong").textContent, "注释：");
  assert.equal(doc.querySelector("i").textContent, "器官异常");
  // 术语定义是数据，保持英文
  assert.ok(doc.body.textContent.includes("This is the root of the phenotypic abnormality subontology of the HPO."));
});

test("导出关联对话框：提问句与疾病页错误句", () => {
  assert.equal(tr("Which association would you like to download?"), "要下载哪一类关联？");
  assert.equal(tr("Could not find requested disease id."), "未找到所请求的疾病编号。");
  const { engine, doc } = boot(
    '<mat-dialog-container><h4>HP:0000118</h4><p class="w-full">Which association would you like to download?</p>' +
      '<button>Diseases</button><button>Genes</button></mat-dialog-container>'
  );
  engine.scan();
  assert.equal(doc.querySelector("p").textContent, "要下载哪一类关联？");
  assert.equal(doc.querySelector("h4").textContent, "HP:0000118", "本体 ID 是数据，保持原样");
  assert.deepEqual([...doc.querySelectorAll("button")].map((b) => b.textContent), ["疾病", "基因"]);
});

// ---- 7) 首页工具卡片与关于页按钮 ----
test("工具卡片标题与关于页按钮", () => {
  assert.equal(tr("Phenomizer"), "Phenomizer 表型诊断工具");
  assert.equal(tr("Contribute"), "贡献数据");
  assert.equal(tr("Feedback & Happy Holidays!"), "反馈与节日快乐！");
});
// ---- 8) /data/ontology 与 /data/annotations 的下载页 ----
test("下载页：标题、历史版本入口与三个格式横幅", () => {
  assert.equal(tr("Download Ontology"), "下载本体");
  assert.equal(tr("Older Versions"), "历史版本");
  assert.equal(tr("Download latest hp.obo"), "下载最新的 hp.obo");
  assert.equal(tr("Download latest hp.owl"), "下载最新的 hp.owl");
  assert.equal(tr("Download latest hp.json"), "下载最新的 hp.json");
  assert.equal(tr("Download Annotations"), "下载注释");
  assert.equal(tr("Click here for more information about the contents and formats of our files"), "点击此处了解我们文件的内容与格式");
});

test("下载页：附加资源区与四类注释横幅", () => {
  assert.equal(tr("Additional resources"), "其他资源");
  assert.equal(tr("MAxO Annotations"), "MAxO 注释");
  assert.equal(tr("Genes To Phenotype"), "基因到表型");
  assert.equal(tr("Phenotype To Genes"), "表型到基因");
  assert.equal(tr("Genes to Disease"), "基因到疾病");
  const { engine, doc } = boot(
    '<div class="download-banner"><h3 class="download-banner-title">MAxO Annotations</h3></div>' +
      '<div class="download-banner"><h3 class="download-banner-title">Genes To Phenotype</h3></div>' +
      '<div class="download-banner"><h3 class="download-banner-title">Phenotype To Genes</h3></div>' +
      '<div class="download-banner"><h3 class="download-banner-title">Genes to Disease</h3></div>'
  );
  engine.scan();
  assert.deepEqual([...doc.querySelectorAll("h3")].map((h) => h.textContent), [
    "MAxO 注释",
    "基因到表型",
    "表型到基因",
    "基因到疾病"
  ]);
});

// ---- 9) /data/api 的卡片标题 ----
test("API 页：两张卡片标题", () => {
  assert.equal(tr("Ontology Service"), "本体服务");
  assert.equal(tr("Ontology Annotation Network"), "本体注释网络");
});

// ---- 10) /browse/profile-search ----
test("表型谱检索页：说明句与步骤条", () => {
  assert.equal(tr("This tool will find diseases that share your profile of phenotypes."), "本工具会找出与你的表型谱共享特征的疾病。");
  assert.equal(tr("Build Phenotype List"), "构建表型列表");
  assert.equal(tr("Your Annotations"), "你的注释");
  const { engine, doc } = boot(
    '<h1 class="center">Profile Search</h1><h4 class="center">This tool will find diseases that share your profile of phenotypes.</h4>' +
      '<div class="mat-step-text-label">Build Phenotype List</div><div class="mat-step-text-label">Your Annotations</div>'
  );
  engine.scan();
  assert.equal(doc.querySelector("h1").textContent, "表型谱检索");
  assert.deepEqual([...doc.querySelectorAll(".mat-step-text-label")].map((d) => d.textContent), ["构建表型列表", "你的注释"]);
});

// ---- 11) /tools/hpo-browser：三个外部浏览器的说明段（产品名是链接，原位保留） ----
test("其他 HPO 浏览器：OLS / Ontobee / BioPortal 说明段保留链接", () => {
  const { engine, doc } = boot(
    '<h2>The Ontology Lookup Service (OLS)</h2>' +
      '<p> The <a href="https://www.ebi.ac.uk/ols/ontologies/hp" target="_blank">OLS</a> is a repository for biomedical ontologies that aims to provide a single point of access to the latest ontology versions. You can browse the ontologies through the website as well as programmatically via the OLS API. </p>' +
      '<h2>Ontobee</h2>' +
      '<p><a href="http://www.ontobee.org/ontology/HP" target="_blank">Ontobee</a> is a linked-data server designed for ontologies. Ontobee is aimed to facilitate ontology data sharing, visualization, query, integration, and analysis.</p>' +
      '<h3>BioPortal</h3>' +
      '<p><a href="https://bioportal.bioontology.org/ontologies/HP" target="_blank">BioPortal</a> is the ontology browser of the National Center for Biomedical Ontology.</p>'
  );
  engine.scan();
  const ps = [...doc.querySelectorAll("p")];
  assert.equal(ps.length, 3);
  assert.equal(
    flat(ps[0]),
    "OLS 是生物医学本体的存储库，旨在为最新本体版本提供单一访问入口。你既可以浏览网站上的本体，也可以通过 OLS API 以编程方式访问。"
  );
  assert.equal(flat(ps[1]), "Ontobee 是专为本体设计的关联数据服务器，旨在促进本体数据的共享、可视化、查询、整合与分析。");
  assert.equal(flat(ps[2]), "BioPortal 是 National Center for Biomedical Ontology 的本体浏览器。");
  // 产品名链接原样保留，href 不变
  assert.deepEqual(ps.map((p) => p.querySelector("a").textContent.trim()), ["OLS", "Ontobee", "BioPortal"]);
  assert.deepEqual(ps.map((p) => p.querySelector("a").getAttribute("href")), [
    "https://www.ebi.ac.uk/ols/ontologies/hp",
    "http://www.ontobee.org/ontology/HP",
    "https://bioportal.bioontology.org/ontologies/HP"
  ]);
  assert.equal(tr("The Ontology Lookup Service (OLS)"), "本体查询服务（OLS）");
});
