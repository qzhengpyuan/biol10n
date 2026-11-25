// CZ CELLxGENE Discover（dict/cellxgene.json）回归：顶栏与页脚、首页主标语/统计/内容导航/七段卡片说明/CTA/
// 「幕后」H2 模板、订阅块、数据集与合集列表的表头计数 chip 与筛选器、开发阶段枚举、基因表达查询页控件、
// 四条文档标题；以及必须保持英文的数据值（数据集名、物种、组织、疾病、检测平台、登录号）。
// 取证：Chrome 影子实例 CDP 9227 + SSR HTML/chunk（2026-11-26）。
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
const book = read("cellxgene.json");
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8"));
const site = sites.sites.find((s) => s.id === "cellxgene");
const defaults = sites.defaults || {};

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;
const U = "https://cellxgene.cziscience.com/";

// 站点词库栈：sites.json 里登记的那几册（lead 接线后 Set 会去重，两种状态都成立）
const stack = [...new Set((site.dicts || ["common"]).concat("cellxgene"))];
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

function run(html, url) {
  const dom = new JSDOM('<div id="wrap">' + html + "</div>", { url: url || U });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site: cfg });
  engine.start();
  return dom.window.document;
}
const text = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : null);
const q = (doc, sel) => text(doc.querySelector(sel));
const allText = (doc, sel) => [...doc.querySelectorAll(sel)].map((e) => text(e));

test("词库结构：meta、exact/rules/templates 形态与条数", () => {
  assert.equal(book.meta.family, "cellxgene");
  assert.ok(book.meta.sites.includes("cellxgene.cziscience.com"));
  assert.ok(book.meta.area.length > 0 && book.meta.note.length > 0, "meta 说明要有内容");

  const keys = Object.keys(book.exact);
  assert.ok(keys.length >= 120, "exact 只有 " + keys.length + " 条");
  assert.ok(book.rules.length >= 5, "rules 只有 " + book.rules.length + " 条");
  assert.ok(book.templates.length >= 1, "templates 太少");

  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(!CJK.test(k), "键里不能有中文: " + k);
    assert.ok(CJK.test(v), "译文里必须有中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "键首尾不能有空白: " + k);
    assert.equal(v, v.trim(), "值首尾不能有空白: " + k);
    assert.ok(!/https?:\/\/|@[\w.-]+\.\w+/.test(v), "译文里不能有 URL/邮箱: " + k);
  }

  for (const r of book.rules) {
    assert.doesNotThrow(() => new RegExp(r.re), "坏正则: " + r.re);
    assert.ok(/^\^/.test(r.re) && /\$$/.test(r.re), "规则要锚定: " + r.re);
    assert.ok(CJK.test(r.to), "规则译文里必须有中文: " + r.re);
    const groups = (r.re.match(/\(\?/g) || []).length ? 0 : (r.re.match(/\((?!\?)/g) || []).length;
    const used = [...r.to.matchAll(/\$(\d)/g)].map((m) => Number(m[1]));
    for (const n of used) assert.ok(n >= 1 && n <= groups, "捕获组越界 " + r.re + " → " + r.to);
    if (groups > 0) assert.ok(used.length > 0, "有捕获组就要用 $n: " + r.re);
  }

  for (const t of book.templates) {
    assert.ok(!CJK.test(t.pat), "模板 pat 里不能有中文: " + t.pat);
    assert.ok(CJK.test(t.zh), "模板 zh 里必须有中文: " + t.pat);
    const slots = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.ok(slots.length > 0, "模板要有槽位: " + t.pat);
    assert.deepEqual(slots, slots.map((_, i) => i + 1), "槽位要 1..N 连续: " + t.pat);
    assert.ok(t.pat.length >= 20, "模板 pat 太短: " + t.pat);
    for (const n of slots) assert.ok(t.zh.includes("{{" + n + "}}"), "zh 缺槽位 {{" + n + "}}: " + t.pat);
  }
});

test("顶栏与页脚：导航、页脚链接、合作方与订阅块", () => {
  const doc = run(
    '<header><a>Application</a><a>Collections</a><a>Datasets</a><a>Gene Expression</a><a>Cell Guide</a>' +
      '<a>Differential Expression</a><a>Census</a><a>API</a><a>Models</a><a>Help &amp; Documentation</a></header>' +
      '<footer><div class="links"><a>Github</a><a>Careers</a><a>Privacy</a><a>Terms</a><a>Sitemap</a><a>Contact Us</a></div>' +
      '<p class="partner">In partnership with:</p>' +
      '<div class="nl"><a href="/subscribe">Subscribe</a>' +
      '<p>to our newsletter to receive updates about new features. Send us feedback with this <a href="/survey">quick survey.</a></p></div></footer>'
  );
  assert.deepEqual(allText(doc, "header a"), [
    "应用", "收藏集", "数据集", "基因表达", "细胞指南", "差异表达", "Census", "API", "模型", "帮助与文档"
  ]);
  assert.deepEqual(allText(doc, "footer .links a"), ["Github", "招聘", "隐私", "条款", "站点地图", "联系我们"]);
  assert.equal(q(doc, "footer .partner"), "合作伙伴：");
  assert.equal(q(doc, ".nl > a"), "订阅");
  assert.equal(q(doc, ".nl p"), "订阅我们的新闻通讯，获取新功能动态。欢迎通过这份快速问卷。");
});

test("首页：主标语、统计三项、内容导航与卡片说明", () => {
  const doc = run(
    '<h1>Discover the mechanisms of human health</h1>' +
      '<p class="hero">Download and visually explore data to understand the functionality of human tissues at the cellular level with Chan Zuckerberg CELL by GENE Discover (CZ CELLxGENE Discover).</p>' +
      '<div class="stats"><span>unique cells</span><span>datasets</span><span>cell types</span></div>' +
      '<nav class="tiles"><a>Differential Expression</a><a>Explorer</a><a>Census</a><a>Cell Guide</a><a>Collections &amp; Datasets</a><a>Gene Expression</a><a>Annotate</a></nav>' +
      '<section><div><h3>Differential Expression</h3><p>Select two custom cell groups based on metadata to find their top differentially expressed genes. Leverage millions of cells from the integrated CZ CELLxGENE corpus for powerful analysis.</p></div>' +
      '<div><h3>Census</h3><p>Census provides access to any custom slice of standardized cell data available on CZ CELLxGENE Discover in R and Python.</p></div>' +
      '<div><h3>Cell Guide</h3><p>Explore an interactive encyclopedia of 700+ cell types that provides detailed definitions, marker genes, lineage, and relevant datasets in one place.</p></div>' +
      '<div><h3>Collections</h3><p>Browse and download hundreds of standardized data collections and 1,000+ datasets characterizing the functionality of healthy mouse and human tissues.</p></div>' +
      '<div><h3>Gene Expression</h3><p>Visualize the expression of genes and gene sets using a normalized view of our data corpus of over 35 million cells.</p></div>' +
      '<div><h3>Annotate</h3><p>Expedite cell type characterization and eliminate communication overhead by empowering tissue experts to directly explore and annotate datasets.</p></div></section>'
  );
  assert.equal(q(doc, "h1"), "探索人类健康的机制");
  assert.equal(
    q(doc, ".hero"),
    "借助 Chan Zuckerberg CELL by GENE Discover（CZ CELLxGENE Discover），下载并以可视化方式探索数据，在细胞层面理解人体组织的功能。"
  );
  assert.deepEqual(allText(doc, ".stats span"), ["唯一细胞", "数据集", "细胞类型"]);
  assert.deepEqual(allText(doc, ".tiles a"), ["差异表达", "探索器", "Census", "细胞指南", "收藏集与数据集", "基因表达", "注释"]);
  assert.equal(q(doc, "section div:nth-child(1) h3"), "差异表达");
  assert.equal(
    q(doc, "section div:nth-child(1) p"),
    "基于元数据选择两个自定义细胞分组，找出差异表达最显著的基因。借助整合后的 CZ CELLxGENE 语料库中数百万个细胞，开展有力的分析。"
  );
  assert.equal(q(doc, "section div:nth-child(2) p"), "Census 让你在 R 与 Python 中访问 CZ CELLxGENE Discover 上任意自定义切片的标准化细胞数据。");
  assert.equal(q(doc, "section div:nth-child(3) p"), "浏览收录 700 多种细胞类型的交互式百科，在一处获取详细定义、标记基因、谱系与相关数据集。");
  assert.equal(
    q(doc, "section div:nth-child(4) p"),
    "浏览并下载数百个标准化数据收藏集与 1,000 多个数据集，它们刻画了健康小鼠与人体组织的功能。"
  );
  assert.equal(q(doc, "section div:nth-child(5) p"), "以我们超过 3,500 万个细胞的数据语料的归一化视图，可视化基因与基因集的表达。");
  assert.equal(q(doc, "section div:nth-child(6) p"), "让组织专家直接探索与注释数据集，从而加快细胞类型鉴定、减少沟通开销。");
  for (const p of allText(doc, "section p")) {
    assert.ok(CJK.test(p), "卡片说明没翻: " + p);
    assert.ok(!/\b[a-z]{4,}\b/.test(p.replace(/CELLxGENE|Discover|Census|Python|Chan|Zuckerberg|corpus/g, "")), "半中半英: " + p);
  }
});

test("首页：CTA、幕后 H2 模板、论文区与新闻区标题", () => {
  const doc = run(
    '<div class="cta"><a>Explore the application</a><a>Explore a multi-tissue atlas</a><a>Explore the studies</a><a>Browse tutorials</a>' +
      '<a>See quick start tutorial</a><a>Search for a cell type or tissue</a><a>Browse datasets</a><a>Explore the tool</a><a>Explore CZ CELLxGENE Annotate</a></div>' +
      '<h2 class="bts">Behind-the-scenes of<!-- --> <span>Chan Zuckerberg</span> <!-- -->CELLxGENE</h2>' +
      '<p class="video">Watch a behind-the-scenes look at CZ CELLxGENE and explore how the platform can help scientists quickly surface important information that could lead to discoveries in treating disease.</p>' +
      '<section class="pubs"><h2>Publications</h2><a>Read More</a><a>Explore Datasets</a></section>' +
      '<h2 class="news">CELL X GENE IN THE NEWS</h2>'
  );
  assert.deepEqual(allText(doc, ".cta a"), [
    "探索该应用", "探索多组织图谱", "浏览相关研究", "浏览教程", "查看快速入门教程",
    "检索细胞类型或组织", "浏览数据集", "探索工具", "探索 CZ CELLxGENE Annotate"
  ]);
  assert.equal(q(doc, ".bts"), "Chan Zuckerberg CELLxGENE 的幕后");
  assert.equal(
    q(doc, ".video"),
    "观看 CZ CELLxGENE 的幕后花絮，了解该平台如何帮助科学家快速发掘重要信息，从而推动疾病治疗领域的发现。"
  );
  assert.equal(q(doc, ".pubs h2"), "论文");
  assert.deepEqual(allText(doc, ".pubs a"), ["阅读更多", "探索数据集"]);
  assert.equal(q(doc, ".news"), "CELLxGENE 新闻报道");
});

test("数据集列表：表头计数、筛选 chip、侧栏筛选器与空态", () => {
  const doc = run(
    '<table><thead><tr><th><div>Datasets</div><div class="chip">2299 of 2299</div></th>' +
      '<th>Tissue</th><th>Disease</th><th>Assay</th><th>Organism</th><th>Cells</th></tr></thead>' +
      '<tbody><tr><td>Tabula Sapiens - Lung</td><td>lung</td><td>normal</td><td>10x 3\' v3</td>' +
      '<td>Homo sapiens</td><td>1,234</td></tr></tbody></table>' +
      '<div class="chips"><span>11 tissues</span><span>6 diseases</span><span>3 assays</span></div>' +
      '<aside><label>Assay</label><label>Cell Count</label><label>Cell Type</label><label>Cell Class</label>' +
      '<label>Cell Subclass</label><label>Consortia</label><label>Curator</label><label>Development Stage</label>' +
      '<label>Disease</label><label>Self-Reported Ethnicity</label><label>Gene Count</label><label>Organism</label>' +
      '<label>Publication</label><label>Publication Date</label><label>Status</label><label>Sex</label>' +
      '<label>Suspension Type</label><label>Tissue</label><label>System</label><label>Organ</label></aside>' +
      '<p class="hint">There are no values that meet the current filter criteria</p>' +
      '<p class="hint2">Self-Reported Ethnicity only applies to Homo sapiens which is not selected in the Organism filter.</p>' +
      '<div class="empty"><h3>No Results</h3><span>No consortium</span></div>'
  );
  assert.deepEqual(allText(doc, "th"), ["数据集2299 / 2299 条", "组织", "疾病", "检测方法", "物种", "细胞数"]);
  assert.deepEqual(allText(doc, ".chips span"), ["11 个组织", "6 种疾病", "3 种检测方法"]);
  assert.deepEqual(allText(doc, "aside label"), [
    "检测方法", "细胞数", "细胞类型", "细胞大类", "细胞亚类", "联盟", "策展人", "发育阶段",
    "疾病", "自报族裔", "基因数量", "物种", "发表文献", "出版日期", "状态", "性别",
    "悬液类型", "组织", "System", "器官"
  ]);
  assert.equal(q(doc, ".hint"), "没有符合当前筛选条件的值");
  assert.equal(q(doc, ".hint2"), "自报族裔仅适用于智人（Homo sapiens），当前物种筛选中未选择智人。");
  assert.equal(q(doc, ".empty h3"), "无结果");
  assert.equal(q(doc, ".empty span"), "无联盟");
  // 数据值原样保留：数据集名、组织、疾病、检测平台、物种、细胞数
  assert.deepEqual(allText(doc, "tbody td"), ["Tabula Sapiens - Lung", "lung", "normal", "10x 3\' v3", "Homo sapiens", "1,234"]);
});

test("合集列表：表头计数、创建入口、撤回提示与空发表文献", () => {
  const doc = run(
    '<table><thead><tr><th><div>Collections</div><div class="chip">408 of 408</div></th>' +
      '<th>Publication</th><th>Tissue</th><th>Disease</th><th>Organism</th></tr></thead>' +
      '<tbody><tr><td>No publication</td><td>lung</td><td>normal</td><td>Homo sapiens</td></tr></tbody></table>' +
      '<div class="actions"><button>Create Collection</button><a>Create an account or sign-in to get started</a></div>' +
      '<div role="status">This collection was withdrawn. You\'ve been redirected to Collections.</div>' +
      '<p class="err">Failed to load collection information</p>'
  );
  assert.deepEqual(allText(doc, "th"), ["收藏集408 / 408 条", "发表文献", "组织", "疾病", "物种"]);
  assert.equal(q(doc, "tbody td"), "无发表文献");
  assert.equal(q(doc, "button"), "创建收藏集");
  assert.equal(q(doc, ".actions a"), "创建账户或登录以开始");
  assert.equal(q(doc, "[role=status]"), "该收藏集已撤回，你已被重定向到收藏集列表。");
  assert.equal(q(doc, ".err"), "无法加载收藏集信息");
});

test("开发阶段枚举：人 14 段 + 小鼠 9 段（含 en dash 与连字符两种写法）", () => {
  const stages = [
    ["Prenatal (conception–birth)", "产前（受孕至出生）"],
    ["Embryonic human (0–56 days)", "人胚胎期（0–56 天）"],
    ["Fetal (>56 days–birth)", "胎儿期（56 天以上至出生）"],
    ["Postnatal human", "人出生后"],
    ["Pediatric (0-15 years)", "儿童（0-15 岁）"],
    ["Newborn human (0-28 days)", "新生儿（0-28 天）"],
    ["Infant (28 days-1 year)", "婴儿（28 天至 1 岁）"],
    ["Child (1-5 years)", "幼儿（1-5 岁）"],
    ["Juvenile (5-15 years)", "少年（5-15 岁）"],
    ["Adult (15+ years)", "成人（15 岁以上）"],
    ["Young adult (15-40 years)", "青年（15-40 岁）"],
    ["Middle aged (40-60 years)", "中年（40-60 岁）"],
    ["Late adult (60+ years)", "老年（60 岁以上）"],
    ["Prenatal", "产前"],
    ["Embryonic mouse", "小鼠胚胎期"],
    ["Fetal (TS23–26)", "小鼠胎儿期（TS23–26）"],
    ["Postnatal mouse", "小鼠出生后"],
    ["Immature (0-6 weeks)", "未成熟（0-6 周）"],
    ["Mature (6+ weeks)", "成熟（6 周以上）"],
    ["Prime adult (6 weeks-18 months)", "壮年（6 周至 18 个月）"],
    ["Young adult (6 weeks-10 months)", "青年（6 周至 10 个月）"],
    ["Middle aged (10-18 months)", "中年（10-18 个月）"],
    ["Late adult (18+ months)", "老年（18 个月以上）"]
  ];
  for (const [en, zh] of stages) {
    const doc = run("<span>" + en + "</span>");
    assert.equal(q(doc, "span"), zh, en);
  }
  // 连字符别名：DOM 里出现半角连字符时同一段也要翻
  const alias = run("<span>Fetal (>56 days-birth)</span><span>Fetal (TS23-26)</span>");
  assert.deepEqual(allText(alias, "span"), ["胎儿期（56 天以上至出生）", "小鼠胎儿期（TS23–26）"]);
});

test("基因表达查询页：筛选/分组/排序/色阶控件、占位符与未找到基因规则", () => {
  const doc = run(
    '<div class="bar"><button>Filters</button><button>Group By</button><button>None</button>' +
      '<button>View Options</button><button>Sort Cell Types</button><button>Cell Ontology</button>' +
      '<button>Hierarchical</button><button>Sort Genes</button><button>As Entered</button>' +
      '<button>Color Scale</button><button>Scaled</button><button>Unscaled</button>' +
      '<button>Download</button><button>Share</button><button>Citation</button><button>Source Data</button></div>' +
      '<div class="filters"><label>Disease</label><label>Self-Reported Ethnicity</label><label>Publication</label>' +
      '<label>Sex</label><label>Tissue</label><label>Organism</label><label>Specificity</label></div>' +
      '<input placeholder="Search cell types" /><input placeholder="Add Genes" />' +
      '<h3>Gene Expression</h3><h4>Expressed in Cells (%)</h4><div class="marks2"><span>Cell Count</span></div>' +
      '<div class="marks"><button>Clear Genes</button><span>No Marker Genes</span><span>No options</span></div>' +
      '<p class="m1">No reliable marker genes for this cell type.</p>' +
      '<p class="m2">Cell types within Blood are closely related, so we are unable to generate high value marker genes at this time.</p>' +
      '<p class="m3">You can add multiple genes using a comma-separated list. Press enter to add.</p>' +
      '<p class="m4">This will reset the dot plot and remove all selected genes and filters.</p>' +
      '<p class="m5">Source Data for Gene Expression</p>' +
      '<p class="m6">We regularly expand our single cell data corpus to improve results. Downloaded data and figures may differ in the future.</p>' +
      '<p class="notfound">Gene not found: TP53</p>'
  );
  assert.deepEqual(allText(doc, ".bar button"), [
    "筛选条件", "分组依据", "无", "视图选项", "细胞类型排序", "细胞本体", "层级结构",
    "基因排序", "按输入顺序", "色阶", "缩放", "不缩放", "下载", "分享", "引文", "源数据"
  ]);
  assert.deepEqual(allText(doc, ".filters label"), ["疾病", "自报族裔", "发表文献", "性别", "组织", "物种", "特异性"]);
  assert.deepEqual([...doc.querySelectorAll("input")].map((e) => e.getAttribute("placeholder")), ["检索细胞类型", "添加基因"]);
  assert.equal(q(doc, "h3"), "基因表达");
  assert.equal(q(doc, "h4"), "表达细胞占比（%）");
  assert.deepEqual(allText(doc, ".marks span"), ["无标记基因", "无选项"]);
  assert.equal(q(doc, ".marks2 span"), "细胞数");
  assert.equal(q(doc, ".marks button"), "清除基因");
  assert.equal(q(doc, ".m1"), "该细胞类型暂无可靠的标记基因。");
  assert.equal(q(doc, ".m2"), "血液中的细胞类型彼此亲缘很近，因此目前无法生成高价值的标记基因。");
  assert.equal(q(doc, ".m3"), "可用逗号分隔一次添加多个基因，按回车添加。");
  assert.equal(q(doc, ".m4"), "这将重置点图，并移除所有已选基因与筛选条件。");
  assert.equal(q(doc, ".m5"), "基因表达的源数据");
  assert.equal(q(doc, ".m6"), "我们会持续扩充单细胞数据语料以改进结果，下载的数据与图表可能随版本变化。");
  assert.equal(q(doc, ".notfound"), "未找到基因：TP53");
});

test("文档标题：四个页面各按整条规则命中", () => {
  const titles = [
    ["CZ CELLxGENE Discover - Cellular Visualization Tool", "CZ CELLxGENE Discover - 细胞可视化工具"],
    ["Datasets - CZ CELLxGENE Discover", "数据集 - CZ CELLxGENE Discover"],
    ["Collections - CZ CELLxGENE Discover", "收藏集 - CZ CELLxGENE Discover"],
    ["Gene Expression - CZ CELLxGENE Discover", "基因表达 - CZ CELLxGENE Discover"]
  ];
  for (const [en, zh] of titles) {
    const dom = new JSDOM(
      "<!doctype html><html><head><title>" + en + "</title></head><body><p>Hello</p></body></html>",
      { url: U }
    );
    const engine = createEngine({ document: dom.window.document, window: dom.window, data, site: cfg });
    engine.start();
    assert.equal(dom.window.document.title, zh, en);
  }
});

test("不翻清单：物种/组织/疾病/平台/数据集名/登录号/品牌", () => {
  const keep = [
    "Homo sapiens", "lung", "normal", "blood", "retina", "Adult", "Simulated",
    "10x 3\' v3", "Tabula Sapiens - Lung", "Space Ranger",
    "PMID: 35549404", "10.1038/s41586-022-04569-5", "E-MTAB-1234",
    "Github", "Census", "API", "System"
  ];
  for (const s of keep) {
    const doc = run("<span>" + s + "</span>");
    assert.equal(q(doc, "span"), s, "不该翻: " + s);
  }
});

test("译文不半中半英：exact 值里除专名外没有连续小写英文词，模板 zh 同理", () => {
  const allow = /CELLxGENE|CELL by GENE Discover|CZ CELLxGENE Discover|Census|Python|Chan Zuckerberg|Annotate|Homo sapiens/g;
  for (const [k, v] of Object.entries(book.exact)) {
    const rest = v.replace(allow, "");
    assert.equal(rest.match(/[a-z]{4,}/), null, "半中半英: " + k + " → " + v);
  }
  for (const t of book.templates) {
    const rest = t.zh.replace(/\{\{\d+\}\}/g, "").replace(allow, "");
    assert.equal(rest.match(/[a-z]{4,}/), null, "模板半中半英: " + t.pat);
  }
});
