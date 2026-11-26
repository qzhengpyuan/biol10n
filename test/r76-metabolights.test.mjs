// MetaboLights（www.ebi.ac.uk/metabolights）站点词库回归：
// 首页 / 研究检索 / 化合物检索与详情 / 研究详情 / 下载 / 数据政策 / 联系 / ORCID / 提交登录
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
const site = sites.find((s) => s.id === "metabolights");
if (!site) throw new Error("config/sites.json 里找不到 metabolights 站点");

const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/metabolights.json"), "utf8"));
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
  const dom = new JSDOM(html, { url: url || "https://www.ebi.ac.uk/metabolights/" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return dom.window.document;
}
const text = (el) => String(el.textContent || "").replace(/\s+/g, " ").trim();
const texts = (doc, sel) => [...doc.querySelectorAll(sel)].map(text);

test("站点配置：hosts/path/spa 与词库挂载", () => {
  assert.deepEqual(site.hosts, ["www.ebi.ac.uk"]);
  assert.equal(site.path, "^/metabolights");
  assert.equal(site.spa, true);
  assert.ok(site.dicts.includes("metabolights"));
  for (const id of ["common", "string-atlas", "spa"]) assert.ok(site.dicts.includes(id), "缺少 " + id);
});

test("词库结构：条数、键值形态、规则可编译、模板槽位连续", () => {
  assert.equal(book.meta.family, "metabolights");
  assert.ok(book.meta.sites.includes("www.ebi.ac.uk"));
  assert.ok(Object.keys(book.exact).length >= 300, "exact 至少 300 条，实际 " + Object.keys(book.exact).length);
  assert.ok(book.rules.length >= 14, "rules 至少 14 条");
  assert.ok(book.templates.length >= 10, "templates 至少 10 条");

  const seen = new Set();
  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "键里不能有中文: " + k);
    assert.ok(/[\u4e00-\u9fff]/.test(v), "译文里必须有中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "键首尾不能有空白: " + JSON.stringify(k));
    assert.equal(v, v.trim(), "译文首尾不能有空白: " + JSON.stringify(v));
    assert.ok(!seen.has(k), "重复键: " + k);
    seen.add(k);
  }
  for (const r of book.rules) {
    const re = new RegExp(r.re);
    assert.ok(re.source.length > 0);
    assert.ok(/[\u4e00-\u9fff]/.test(r.to), "规则译文里必须有中文: " + r.re);
    assert.ok(/\$\d/.test(r.to), "带捕获组的规则要用到占位符: " + r.re);
  }
  for (const t of book.templates) {
    const used = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.ok(used.length >= 1, "模板要带槽位: " + t.pat);
    const sorted = used.slice().sort((a, b) => a - b);
    sorted.forEach((n, i) => assert.equal(n, i + 1, "槽位必须从 1 连续: " + t.pat));
    const zhUsed = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.deepEqual(zhUsed.slice().sort((a, b) => a - b), sorted, "译文槽位要与原文一致");
    assert.ok(/[\u4e00-\u9fff]/.test(t.zh), "模板译文必须含中文");
  }
});

test("顶栏与面包屑", () => {
  const doc = run(
    '<nav><a>Browse</a><a>Studies</a><a>Compounds</a><a>ORCID Search</a><a>Statistics</a>' +
    "<a>Login/Submit</a><a>Download</a><a>Data Policy</a><a>Guides</a><a>About</a><a>Training</a><a>Announcements</a></nav>"
  );
  assert.deepEqual(texts(doc, "a"), [
    "浏览", "研究", "化合物", "ORCID 检索", "统计", "登录/提交", "下载", "数据政策", "指南", "关于", "培训", "公告"
  ]);
});

test("公告横幅模板：链接保留、正文翻中文", () => {
  const doc = run(
    '<p class="vf-banner__text">New Data Submission Updates are now live - Study cloning, alternative licensing, flexible metadata formats and more (' +
    '<a href="https://www.ebi.ac.uk/metabolights/announcements">https://www.ebi.ac.uk/metabolights/announcements</a>).</p>'
  );
  const p = doc.querySelector("p");
  assert.match(text(p), /^新的数据提交功能更新现已上线/);
  assert.match(text(p), /元数据格式等（/);
  const a = p.querySelector("a");
  assert.ok(a, "链接不能丢");
  assert.equal(a.getAttribute("href"), "https://www.ebi.ac.uk/metabolights/announcements");
  assert.equal(text(a), "https://www.ebi.ac.uk/metabolights/announcements", "URL 不翻译");
});

test("首页 hero、检索框与各区块", () => {
  const doc = run(
    '<div><h2>MetaboLights Search</h2><p>Search by Study or Compound centric queries</p>' +
    "<p>Submit and search metabolomics study data</p><a>About MetaboLights</a><a>Take a quick tour</a>" +
    "<h2>Explore MetaboLights</h2><h3>Study Search</h3>" +
    "<p>Fine grained searching inclusive of level of curation, technology used, sample types, organisms and more!</p>" +
    "<h3>Compound Library</h3><p>Compound centric view of all annotations reported in MetaboLights studies.</p>" +
    "<h2>Tools &amp; Resources</h2><span>New!</span><p>Federated metabolomics search</p>" +
    "<h2>Contribute to MetaboLights</h2>" +
    "<p>Share your metabolomics data with the scientific community. Our team is here to help guide you through the submission process.</p>" +
    "<a>Submit to MetaboLights</a><a>Contact MetaboLights</a>" +
    "<h2>Training &amp; Learning</h2><button>Live training</button><button>On-demand training</button>" +
    "<span>Course at EMBL-EBI</span><h2>Recommended by Leading Journals</h2></div>"
  );
  assert.deepEqual(texts(doc, "h2"), ["MetaboLights 检索", "探索 MetaboLights", "工具与资源", "为 MetaboLights 贡献数据", "培训与学习", "受到领先期刊推荐"]);
  assert.deepEqual(texts(doc, "h3"), ["研究检索", "化合物库"]);
  const ps = texts(doc, "p");
  assert.equal(ps[0], "按研究或以化合物为中心的查询进行检索");
  assert.equal(ps[1], "提交并检索代谢组学研究数据");
  assert.match(ps[2], /^细粒度检索/);
  assert.match(ps[3], /^以化合物为中心/);
  assert.equal(ps[4], "联邦式代谢组学检索");
  assert.match(ps[5], /^与科学界分享/);
  assert.deepEqual(texts(doc, "a"), ["关于 MetaboLights", "快速了解", "提交至 MetaboLights", "联系 MetaboLights"]);
  assert.deepEqual(texts(doc, "button"), ["直播培训", "点播培训"]);
  assert.equal(text(doc.querySelector("span")), "新增！");
});

test("首页 About 整段（含 More about us 链接）按模板翻译", () => {
  const doc = run(
    '<p>MetaboLights is a database for Metabolomics experiments and derived information. The database is cross-species, cross-technique and covers metabolite structures and their reference spectra as well as their biological roles, locations and concentrations, and experimental data from metabolic experiments. MetaboLights is the recommended Metabolomics repository for a number of leading journals. ' +
    '<a href="https://www.ebi.ac.uk/about/people/juan-vizcaino">More about us</a></p>'
  );
  const p = doc.querySelector("p");
  assert.match(text(p), /^MetaboLights 是一个用于代谢组学实验及其衍生信息的数据库。/);
  assert.match(text(p), /还包括代谢实验产生的实验数据。/);
  assert.match(text(p), /MetaboLights 是众多领先期刊推荐的代谢组学存储库。/);
  assert.equal(text(p.querySelector("a")), "进一步了解我们");
  assert.equal(p.querySelector("a").getAttribute("href"), "https://www.ebi.ac.uk/about/people/juan-vizcaino");
});

test("研究检索页：工具条、排序、分面标题、表头", () => {
  const doc = run(
    '<div><span>Study Search</span><span>Advanced search</span><span>Export search</span><span>Share this search</span>' +
    "<button>Clause Builder</button><button>Query String</button><button>+ Add clause</button>" +
    "<button>Match All</button><button>Match Any</button><button>Manually Apply</button><button>Auto</button>" +
    "<p>Add a clause to narrow results by specific field values.</p><button>Clear filters</button><h3>Sort</h3>" +
    "<select><option>Relevance</option><option>Release Date (Asc)</option><option>Modified Time (Desc)</option>" +
    "<option>Submission Date (Asc)</option><option>Study Size (Desc)</option></select>" +
    '<h3>Biology</h3><span class="facet-title">Organism</span><span class="facet-title">Organism Part</span>' +
    '<span class="facet-title">Variant</span><span class="facet-title">Sample Type</span><span class="facet-title">Kingdom</span>' +
    '<span class="facet-title">Phylum</span><span class="facet-title">Family</span><span class="facet-title">Genus</span>' +
    '<span class="facet-title">Methods</span><span class="facet-title">Technology</span><span class="facet-title">Technique</span>' +
    '<span class="facet-title">Design Descriptor</span><span class="facet-title">Factor</span><span class="facet-title">Study Size</span>' +
    '<span class="facet-title">Release Date</span><span class="facet-title">Country</span><span class="facet-title">Status</span>' +
    '<span class="facet-title">Curation</span><span class="facet-title">Files</span><span class="facet-title">Raw Files</span>' +
    '<span class="facet-title">Derived Files</span><button>Expand all</button><button>Use in compound search</button>' +
    "<div>Study</div><div>Released</div><div>Last Revision</div><div>Organisms</div><div>Organism Parts</div>" +
    "<div>Technologies</div><div>Principal Investigator</div><div>Publications</div><div>Design Descriptors</div>" +
    "<div>Curation</div></div>"
  );
  assert.deepEqual(texts(doc, "span").slice(0, 4), ["研究检索", "高级检索", "导出检索", "分享本次检索"]);
  assert.deepEqual(texts(doc, "button"), [
    "条件构建器", "查询字符串", "+ 添加条件", "全部匹配", "任一匹配", "手动应用", "自动",
    "清除筛选条件", "全部展开", "在化合物检索中使用"
  ]);
  assert.equal(text(doc.querySelector("p")), "添加条件，按特定字段值缩小结果范围。");
  assert.deepEqual(texts(doc, "option"), ["相关度", "发布日期（升序）", "修改时间（降序）", "提交日期（升序）", "研究大小（降序）"]);
  assert.equal(text(doc.querySelector("h3")), "排序");
  const titles = texts(doc, ".facet-title");
  assert.deepEqual(titles, [
    "物种", "生物体部位", "变异", "样本类型", "界", "门", "家族", "属", "方法", "技术", "技术",
    "设计描述符", "因素", "研究大小", "发布日期", "国家", "状态", "审编", "文件", "原始文件", "衍生文件"
  ]);
  const divs = texts(doc, "div");
  assert.deepEqual(divs.slice(-10), ["研究", "发布日期", "最后修订", "物种", "生物体部位", "技术", "主要研究者", "论文", "设计描述符", "审编"]);
});

test("检索页分页条：Page/of/Go/Per page/Showing/Table/Detailed", () => {
  const doc = run(
    '<div><label>Page</label><span>of</span><span>Per page</span><span>Showing</span>' +
    "<button>Go</button><button>Table</button><button>Detailed</button></div>"
  );
  assert.deepEqual(texts(doc, "label"), ["页"]);
  assert.deepEqual(texts(doc, "button"), ["跳转", "表格", "详细"]);
  assert.deepEqual(texts(doc, "span"), ["of", "每页条数", "Showing"]);
});

test("化合物检索页：排序、分面、卡片标签与 '更多' 规则", () => {
  const doc = run(
    '<div id="c"><span>Compound Search</span><button>Apply</button><span>Available data</span>' +
    "<span>Species</span><span>Pathways</span><span>Reactions</span><span>Literature</span><span>MS spectra</span>" +
    "<span>Grid</span><span>List</span><div>Formula</div><div>Exact mass</div><div>Charge</div>" +
    "<div>Organisms (6)</div><div>Organism Parts (8)</div><div>Studies (13)</div><div>Definition</div>" +
    "<span>Add to compound batch</span><button>Show 1 more organisms</button>" +
    "<button>Show 2 more parts</button><button>Show 5 more studies</button><button>+13 more</button></div>"
  );
  assert.equal(text(doc.querySelector("span")), "化合物检索");
  assert.equal(text(doc.querySelector("button")), "应用");
  const spans = texts(doc, "span");
  assert.deepEqual(spans.slice(1), ["可用数据", "物种", "通路", "反应", "文献", "MS 谱图", "网格", "列表", "加入化合物批次"]);
  const divs = texts(doc, "#c > div");
  assert.deepEqual(divs, ["分子式", "精确质量", "电荷", "物种（6）", "生物体部位（8）", "研究（13）", "定义"]);
  assert.deepEqual(texts(doc, "button").slice(1), ["再显示 1 个物种", "再显示 2 个部位", "再显示 5 项研究", "另有 13 项"]);
});

test("化合物详情页：字段标签、页签与操作", () => {
  const doc = run(
    '<div id="cd"><p>Reported in</p><div>studies</div><span>— show accessions</span><p>Formula:</p><p>Exact Mass:</p>' +
    "<p>Synonyms:</p><a>View on ChEBI</a><a>Find studies with this compound</a><a>Add to batch</a>" +
    "<div>Summary</div><div>Reactions</div><div>Spectra</div><div>Pathways</div><div>Biology</div><div>Literature</div>" +
    "<div>Name</div><div>ID</div><div>ChEBI ID</div><div>Formula</div><div>Exact mass</div><div>Average mass</div>" +
    "<div>IUPAC Names</div><div>Definition</div><div>Structurally Similar Compounds</div></div>"
  );
  const ps = texts(doc, "p");
  assert.deepEqual(ps, ["报告于", "分子式：", "精确质量：", "同义词："]);
  assert.deepEqual(texts(doc, "a"), ["在 ChEBI 中查看", "查找含此化合物的研究", "加入批次"]);
  const divs = texts(doc, "#cd > div");
  assert.deepEqual(divs, [
    "项研究", "摘要", "反应", "谱图", "通路", "生物学", "文献",
    "名称", "编号", "ChEBI 编号", "分子式", "精确质量", "平均质量", "IUPAC 名称", "定义", "结构相似化合物"
  ]);
  assert.equal(text(doc.querySelector("span")), "— 显示登录号");
});

test("研究详情页：元数据标签、页签、策展图例与 ELIXIR 横幅", () => {
  const doc = run(
    '<div id="sd"><div>Loading metadata files...</div><button>Login</button><span>Accession</span><span>Category</span>' +
    "<span>License</span><span>Status</span><span>Public</span><span>Curation</span><span>Release Date</span><span>Revision</span>" +
    "<a>Overview</a><a>Samples</a><a>Protocols</a><a>Metabolites</a><a>Files</a>" +
    "<p>Study Description (Abstract)</p><p>Publications</p><span>published</span>" +
    "<p>Design Descriptors (Keywords)</p><p>Funding</p><small>No funding information defined.</small>" +
    "<p>Related Datasets</p><small>No related datasets defined.</small>" +
    "<h2>Add Funding Details</h2><label>Funder Organization</label><label>Funder ID</label><label>Grant Identifier</label>" +
    "<button>Add Funding</button><h2>Add Related Dataset</h2><label>Related Dataset Repository</label>" +
    "<label>Related Dataset Accession Number</label><label>Related Dataset URL</label><label>Related Data Description</label>" +
    "<button>Add Dataset</button><span>This service</span><h5>is part of the ELIXIR infrastructure</h5>" +
    "<p>MetaboLights is an ELIXIR Recommended Deposition Database</p>" +
    "<p>You can find the MetaboLights' study curation status definitions below:</p>" +
    "<table><tr><td>The study was created but has not passed MetaboLights Validation Framework v2.</td></tr>" +
    "<tr><td>The study has passed MetaboLights Validation Framework v2.</td></tr>" +
    "<tr><td>The study has been curated by MetaboLights.</td></tr></table></div>"
  );
  assert.equal(text(doc.querySelector("#sd > div")), "正在加载元数据文件…");
  assert.deepEqual(texts(doc, "span").slice(0, 8), ["登录号", "类别", "许可", "状态", "公开", "审编", "发布日期", "修订"]);
  assert.deepEqual(texts(doc, "a"), ["概览", "样本", "实验方案", "代谢物", "文件"]);
  assert.deepEqual(texts(doc, "small"), ["未提供资助信息。", "未定义相关数据集。"]);
  assert.deepEqual(texts(doc, "label"), ["资助机构", "资助机构 ID", "资助编号", "相关数据集仓库", "相关数据集登录号", "相关数据集 URL", "相关数据描述"]);
  assert.ok(texts(doc, "h2").includes("添加资助详情"));
  assert.ok(texts(doc, "h2").includes("添加相关数据集"));
  assert.deepEqual(texts(doc, "td"), [
    "该研究已创建，但尚未通过 MetaboLights 验证框架 v2。",
    "该研究已通过 MetaboLights 验证框架 v2。",
    "该研究已由 MetaboLights 完成策展。"
  ]);
  assert.equal(text(doc.querySelector("h5")), "是 ELIXIR 基础设施的一部分");
});

test("下载页：FTP 说明模板与帮助句模板保留链接", () => {
  const doc = run(
    '<div><h1>Download Data</h1><p>Access MetaboLights experiment data via FTP</p><h2>Public FTP Server</h2>' +
    "<p>All public MetaboLights experiments can be downloaded from our public FTP site. You will need an FTP client software like " +
    '<a href="https://filezilla-project.org/">FileZilla</a> to access and download data. Each public study can be found in the corresponding MTBLS-id folder.</p>' +
    "<p>For more information on how to download data from MetaboLights, please check our " +
    '<a href="/metabolights/training">training resources</a> or <a href="/metabolights/contact">contact us</a>.</p>' +
    "<table><tr><th>Setting</th><th>Value</th></tr><tr><td>Server</td><td>ftp.ebi.ac.uk</td></tr><tr><td>Directory</td><td>/pub/</td></tr></table>" +
    "<a>Open FTP in Browser</a><p>Need Help?</p></div>"
  );
  assert.equal(text(doc.querySelector("h1")), "下载数据");
  assert.equal(text(doc.querySelector("h2")), "公共 FTP 服务器");
  const ps = texts(doc, "p");
  assert.equal(ps[0], "通过 FTP 访问 MetaboLights 实验数据");
  assert.match(ps[1], /^所有公开的 MetaboLights 实验均可从我们的公共 FTP 站点下载。/);
  assert.match(ps[1], /FTP 客户端软件/);
  assert.match(ps[2], /^有关如何从 MetaboLights 下载数据的更多信息/);
  assert.equal(ps[3], "需要帮助？");
  const links = [...doc.querySelectorAll("p a")].map(text);
  assert.deepEqual(links, ["FileZilla", "培训资源", "联系我们"]);
  assert.equal(doc.querySelector('a[href="/metabolights/contact"]').getAttribute("href"), "/metabolights/contact");
  assert.deepEqual(texts(doc, "th"), ["设置", "值"]);
  const tds = texts(doc, "td");
  assert.deepEqual([tds[0], tds[2]], ["服务器", "目录"]);
  assert.equal(text(doc.querySelector("table + a")), "在浏览器中打开 FTP");
});

test("数据政策页：标题、固定标签与 Last updated 规则", () => {
  const doc = run(
    '<div><h1>Data Policy</h1><p>Guidelines for submitted datasets to MetaboLights</p>' +
    "<p>Last updated: 25 September 2026 (Version 1.0.2)</p>" +
    "<h2>A) General Statements</h2><h2>B) Private Data</h2><h2>C) Public Data</h2><h2>D) Sensitive Datasets</h2>" +
    "<h2>Data Reuse Guidelines</h2><strong>Dataset Licenses:</strong><strong>Data availability:</strong>" +
    "<strong>Release date:</strong><strong>Note:</strong><strong>Update of public datasets:</strong>" +
    "<strong>Removal of public datasets:</strong><strong>Pre-prints:</strong>" +
    '<p>Questions about our data policy? <a href="/metabolights/contact">Contact the MetaboLights team</a></p></div>'
  );
  assert.equal(text(doc.querySelector("h1")), "数据政策");
  assert.equal(text(doc.querySelectorAll("p")[0]), "提交至 MetaboLights 的数据集指南");
  const updated = text(doc.querySelectorAll("p")[1]);
  assert.ok(updated.startsWith("最后更新："), updated);
  assert.ok(updated.includes("（版本 1.0.2）"), updated);
  assert.deepEqual(texts(doc, "h2"), ["A) 总体说明", "B) 私有数据", "C) 公开数据", "D) 敏感数据集", "数据复用指南"]);
  assert.deepEqual(texts(doc, "strong"), ["数据集许可：", "数据可用性：", "发布日期：", "说明：", "公开数据集的更新：", "公开数据集的移除：", "预印本："]);
  const last = text(doc.querySelectorAll("p")[2]);
  assert.match(last, /^对数据政策有疑问？/);
  assert.equal(text(doc.querySelectorAll("p")[2].querySelector("a")), "联系 MetaboLights 团队");
});

test("联系页：反馈整段模板与快捷入口", () => {
  const doc = run(
    '<div><h1>Contact Us</h1><p>Get in touch with the MetaboLights team</p><h2>Give Us Feedback</h2>' +
    "<p>We are always looking at ways to improve MetaboLights. Please send your feedback in the form " +
    '<a href="https://www.ebi.ac.uk/about/contact/support/metabolights">here</a> or email us directly at ' +
    '<a href="mailto:metabolights-help@ebi.ac.uk">metabolights-help@ebi.ac.uk</a></p>' +
    "<a>Send Email</a><h2>Quick Links</h2><a>Statistics</a><a>Scientific Advisory Board</a></div>"
  );
  assert.equal(text(doc.querySelector("h1")), "联系我们");
  assert.equal(text(doc.querySelectorAll("p")[0]), "与 MetaboLights 团队取得联系");
  assert.equal(text(doc.querySelector("h2")), "提供反馈");
  const p = doc.querySelectorAll("p")[1];
  assert.match(text(p), /^我们始终在寻求改进 MetaboLights 的方法。/);
  assert.match(text(p), /请通过此处的表单发送反馈/);
  assert.equal(text(p.querySelectorAll("a")[0]), "此处");
  assert.equal(text(p.querySelectorAll("a")[1]), "metabolights-help@ebi.ac.uk", "邮箱不翻译");
  assert.equal(text(doc.querySelectorAll("h2")[1]), "快速链接");
});

test("ORCID 与提交登录页", () => {
  const doc = run(
    '<div><h1>ORCID Search</h1><p>Enter an ORCID (e.g. 0000-0002-1825-0097) to see studies.</p>' +
    "<p>Sign in to MetaboLights</p><label>Email</label><label>Remember me</label><button>Sign In</button>" +
    "<p>Do not have a MetaboLights account?</p><a>Register</a></div>"
  );
  assert.equal(text(doc.querySelector("h1")), "ORCID 检索");
  assert.equal(text(doc.querySelector("p")), "输入 ORCID（例如 0000-0002-1825-0097）以查看研究。");
  assert.deepEqual(texts(doc, "label"), ["电子邮件", "记住我"]);
  assert.equal(text(doc.querySelector("button")), "登录");
  assert.equal(texts(doc, "p")[1], "登录 MetaboLights");
  assert.equal(texts(doc, "p")[2], "还没有 MetaboLights 账户？");
  assert.equal(text(doc.querySelector("a")), "注册");
});

test("页脚：机构句、地址、cookie 横幅与声明", () => {
  const doc = run(
    '<footer><span class="vf-footer__legal-text">EMBL-EBI is part of the' +
    '<a href="//www.embl.org">European Molecular Biology Laboratory</a></span>' +
    "<span class=\"vf-footer__legal-text\"><a>EMBL-EBI, Wellcome Genome Campus, Hinxton, Cambridgeshire, CB10 1SD, UK.</a></span>" +
    '<p class="vf-footer__notice"><a>EMBL-EBI is the home for big data in biology. We help scientists exploit complex information to make discoveries that benefit humankind.</a></p>' +
    '<div>This website requires cookies, and the limited processing of your personal data in order to function. By using the site you are agreeing to this as outlined in our ' +
    '<a>Privacy Notice</a> and <a>Terms of Use</a>.</div>' +
    "<a>I agree, dismiss this banner</a></footer>"
  );
  const span = doc.querySelectorAll("span.vf-footer__legal-text")[0];
  assert.equal(text(span), "EMBL-EBI 是欧洲分子生物学实验室的组成部分");
  const addr = doc.querySelectorAll("span.vf-footer__legal-text")[1].querySelector("a");
  assert.equal(text(addr), "英国剑桥郡欣克斯顿 Wellcome 基因组园区 EMBL-EBI，CB10 1SD");
  assert.match(text(doc.querySelector("p.vf-footer__notice")), /^EMBL-EBI 是生物学大数据之家。/);
  const cookie = doc.querySelector("div");
  assert.match(text(cookie), /^本网站需要使用 Cookie/);
  assert.deepEqual([...cookie.querySelectorAll("a")].map(text), ["隐私声明", "使用条款"]);
  assert.equal(text(doc.querySelector("footer > a")), "我同意，关闭此提示");
});

test("DocBot 聊天骨架", () => {
  const doc = run(
    "<div><p>Try asking me:</p><p>Hello! How can I help you today?</p><span>New conversation</span>" +
    "<span>Download conversation</span><h2>Close chat and delete conversation?</h2>" +
    "<p>Are you sure you want to close the chat?</p><p>Your current conversation history will be permanently deleted.</p>" +
    "<button>Keep chat open</button><button>Close and delete</button>" +
    "<p>Please rate responses using the thumbs up/down buttons to help us improve DocBot.</p></div>"
  );
  assert.deepEqual(texts(doc, "p"), [
    "可以试着问我：", "你好！今天有什么可以帮你？",
    "确定要关闭聊天吗？", "当前对话历史将被永久删除。",
    "请使用点赞/点踩按钮评价回答，帮助我们改进 DocBot。"
  ]);
  assert.deepEqual(texts(doc, "button"), ["保持聊天打开", "关闭并删除"]);
  assert.equal(text(doc.querySelector("h2")), "关闭聊天并删除对话？");
  assert.deepEqual(texts(doc, "span"), ["新建对话", "下载对话"]);
});

test("身份与数据保持原文：登录号、物种、仪器、格式、论文与公告正文", () => {
  const doc = run(
    "<div><p>Homo sapiens</p><p>Mus musculus</p><p>MTBLS15584</p><p>MTBLC10</p><p>CHEBI:10</p>" +
    "<p>Thermo Scientific Q Exactive HFX Hybrid Quadrupole-Orbitrap mass spectrometer</p>" +
    "<p>mzML</p><p>nmrML</p><p>ISA-Tab</p><p>DOI: 10.1093/nar/gkag1199</p>" +
    "<p>Building on the improvements introduced earlier in 2026 to enhance the submission process:</p>" +
    "<p>A metabolomic study of urinary changes in type 2 diabetes in human compared to the control group</p></div>"
  );
  assert.deepEqual(texts(doc, "p"), [
    "Homo sapiens", "Mus musculus", "MTBLS15584", "MTBLC10", "CHEBI:10",
    "Thermo Scientific Q Exactive HFX Hybrid Quadrupole-Orbitrap mass spectrometer",
    "mzML", "nmrML", "ISA-Tab", "DOI: 10.1093/nar/gkag1199",
    "Building on the improvements introduced earlier in 2026 to enhance the submission process:",
    "A metabolomic study of urinary changes in type 2 diabetes in human compared to the control group"
  ]);
});
