// HPO（hpo.jax.org）词库回归：导航/页脚、术语页、疾病页、错误页、关于与法务页
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/hpo.json"), "utf8"));
const cfg = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8"));
// config/sites.json 里已有 hpo 条目时直接用真实配置；否则按同一份 dicts 栈临时兜底。
const site = cfg.sites.find((s) => s.id === "hpo") || { scope: "body", block: cfg.defaults.block };
const stack = site.dicts || ["common", "hpo"];

function siteData() {
  const exact = {}, rules = [], templates = [];
  for (const id of stack) {
    const file = path.join(root, "../dict", id + ".json");
    if (!fs.existsSync(file)) continue;
    const d = JSON.parse(fs.readFileSync(file, "utf8"));
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
    templates.push(...(d.templates || []));
  }
  return { exact, rules, templates };
}

function run(html) {
  const dom = new JSDOM(html);
  const engine = createEngine({ document: dom.window.document, window: dom.window, data: siteData(), site });
  engine.start();
  return dom.window.document;
}

test("词库结构：meta、条数、键值形态、规则可编译、模板槽位连续", () => {
  assert.equal(book.meta.family, "hpo");
  assert.ok(book.meta.sites.includes("hpo.jax.org"));
  assert.ok(Object.keys(book.exact).length >= 120, "exact 至少 120 条");
  assert.ok(book.rules.length >= 10, "rules 至少 10 条");
  assert.ok(Array.isArray(book.templates) && book.templates.length >= 2, "templates 至少 2 条");

  const seen = new Set();
  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "键里不能有中文: " + k);
    assert.ok(/[\u4e00-\u9fff]/.test(v), "译文里必须有中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "键首尾不能有空白: " + JSON.stringify(k));
    assert.ok(!/https?:\/\/|@/.test(v), "译文不能含明文 URL/邮箱: " + k);
    assert.ok(!seen.has(k), "重复键: " + k);
    seen.add(k);
  }
  for (const r of book.rules) {
    const re = new RegExp(r.re);
    assert.ok(re.source.length > 0);
    assert.ok(/[\u4e00-\u9fff]/.test(r.to), "规则译文里必须有中文: " + r.re);
    if (new RegExp(r.re).source.includes("(")) assert.ok(/\$\d/.test(r.to), "带捕获组的规则要用到占位符: " + r.re);
  }
  for (const t of book.templates) {
    const used = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.ok(used.length >= 1, "模板要带槽位: " + t.pat);
    used.slice().sort((a, b) => a - b).forEach((n, i) => assert.equal(n, i + 1, "槽位必须从 1 连续"));
    const zhUsed = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.deepEqual(zhUsed.slice().sort((a, b) => a - b), used.slice().sort((a, b) => a - b));
  }
});

test("页头导航与页脚链接：数据/文档/工具/资源/资助/免责声明/常见问题", () => {
  const doc = run(
    "<nav>" +
      "<button>About</button><button><span>arrow_drop_down</span><span>Data </span></button>" +
      '<a href="https://obophenotype.github.io/human-phenotype-ontology/">Documentation</a>' +
      "<button><span> Tools </span></button><button>Resources</button><button>Home</button>" +
      "</nav>" +
      "<footer><button>License</button><button>Funding</button><button>Cite</button>" +
      "<button>Disclaimer</button><button>FAQ</button><span>feedback</span></footer>"
  );
  const btns = [...doc.querySelectorAll("button")].map((b) => b.textContent.replace(/\s+/g, " ").trim());
  assert.deepEqual(btns, ["关于", "arrow_drop_down数据", "工具", "资源", "首页", "许可", "资助", "引用", "免责声明", "常见问题"]);
  assert.equal(doc.querySelector("a").textContent, "文档");
  assert.equal(doc.querySelector("footer span").textContent, "反馈");
  assert.equal(doc.querySelector("a").getAttribute("href"), "https://obophenotype.github.io/human-phenotype-ontology/", "外链地址不能改");
});

test("搜索框占位、示例提示与无障碍标签（属性通道）", () => {
  const doc = run(
    '<div><input placeholder="Search for phenotypes, diseases or genes..." />' +
      "<strong>e.g. <a>Arachnodactyly</a></strong>" +
      '<mat-select aria-label="Language Selection"><option>English</option></mat-select>' +
      '<button aria-label="Give Feedback"></button>' +
      '<img alt="Human Phenotype Ontology logo" src="x.png" />' +
      '<img alt="The Jackson Laboratory logo" src="y.png" /></div>'
  );
  assert.equal(doc.querySelector("input").getAttribute("placeholder"), "搜索表型、疾病或基因……");
  assert.equal(doc.querySelector("strong").textContent, "例如 Arachnodactyly", "示例词是数据，原样保留");
  assert.equal(doc.querySelector("mat-select").getAttribute("aria-label"), "语言选择");
  assert.equal(doc.querySelector("option").textContent, "英文");
  assert.equal(doc.querySelector("button").getAttribute("aria-label"), "提供反馈");
  const alts = [...doc.querySelectorAll("img")].map((i) => i.getAttribute("alt"));
  assert.deepEqual(alts, ["人类表型本体标志", "Jackson 实验室标志"]);
});

test("首页：标题、工具卡固定说明句、邮件列表与新闻入口", () => {
  const doc = run(
    "<div>" +
      "<h2>The Human Phenotype Ontology</h2>" +
      "<p>Evaluate variants based on the predicted pathogenicity.</p>" +
      "<p>Rank disease differential diagnosis by clinical features.</p>" +
      "<p>Analyze genome sequence data for non-coding variants.</p>" +
      "<p>Discover diseases with a phenotype profile.</p>" +
      "<span>A Global Alliance for Genomics and Health (GA4GH) international standard for phenotypic data exchange.</span>" +
      "<h4>HPO Mailing List!</h4>" +
      "<p>Get official announcements and updates from the core developers.</p>" +
      "<a>Learn More About HPO</a><a>View All News</a><span>News &amp; Updates</span>" +
      "<span>[Offline]</span>" +
      "<a>See all results for 'Marfan'</a>" +
      "<h4>Phenotypes - 1 of 1 displayed</h4>" +
      "<h4>Diseases - 9 of 9 displayed</h4>" +
      "</div>"
  );
  assert.equal(doc.querySelector("h2").textContent, "人类表型本体");
  assert.deepEqual([...doc.querySelectorAll("p")].map((p) => p.textContent), [
    "评估变异的预测致病性。",
    "按临床特征对疾病鉴别诊断排序。",
    "分析基因组序列数据中的非编码变异。",
    "通过表型谱发现疾病。",
    "获取核心开发者的官方公告与更新。"
  ]);
  assert.equal(
    doc.querySelector("span").textContent,
    "全球基因组学与健康联盟（GA4GH）的表型数据交换国际标准。"
  );
  assert.equal(doc.querySelector("h4").textContent, "HPO 邮件列表！");
  const links = [...doc.querySelectorAll("a")].map((a) => a.textContent);
  assert.deepEqual(links, ["进一步了解 HPO", "查看全部新闻", "查看“Marfan”的全部结果"]);
  assert.deepEqual([...doc.querySelectorAll("h4")].slice(1).map((h) => h.textContent), [
    "表型：显示 1 / 1",
    "疾病：显示 9 / 9"
  ]);
});

test("术语页：关联分区标签与表格表头", () => {
  const doc = run(
    '<div class="associations">' +
      "<span>Disease Associations</span><span>Gene Associations [Inferred]</span>" +
      "<span>Medical Actions</span><span>LOINC Associations</span>" +
      "<span>Export Associations</span><span>Translate your language</span>" +
      "<table><thead><tr><th>Disease Id</th><th>Disease Name</th></tr>" +
      "<tr><th>Gene Id</th><th>Gene Symbol</th></tr></thead></table>" +
      "<p>Synonyms:</p>" +
      "</div>"
  );
  const spans = [...doc.querySelectorAll("span")].map((s) => s.textContent);
  assert.deepEqual(spans, [
    "疾病关联",
    "基因关联 [推断]",
    "医学处置",
    "LOINC 关联",
    "导出关联",
    "翻译你的语言"
  ]);
  const ths = [...doc.querySelectorAll("th")].map((t) => t.textContent);
  assert.deepEqual(ths, ["疾病编号", "疾病名称", "基因编号", "基因符号"]);
  assert.equal(doc.querySelector("p").textContent, "同义词：");
});

test("术语页：语言选择器固定枚举值（option 文字翻、value 不动）", () => {
  const langs = ["English", "Chinese", "Czech", "Dutch", "French", "German", "Italian", "Japanese", "Spanish", "Turkish"];
  const doc = run(
    "<mat-select>" + langs.map((l) => '<option value="' + l + '">' + l + "</option>").join("") + "</mat-select>"
  );
  const opts = [...doc.querySelectorAll("option")];
  assert.deepEqual(opts.map((o) => o.textContent), [
    "英文", "中文", "捷克语", "荷兰语", "法语", "德语", "意大利语", "日语", "西班牙语", "土耳其语"
  ]);
  assert.deepEqual(opts.map((o) => o.getAttribute("value")), langs, "option 的 value 不能改");
});

test("术语页：空状态句、后代数量与层级按钮", () => {
  const doc = run(
    "<div>" +
      "<span>No. Descendants</span><span>Hierarchy</span>" +
      "<p>No medical actions found for HP:0001166</p>" +
      "<p>No LOINC associations found for HP:0001166</p>" +
      "<p>No disease associations found for</p>" +
      "<p>Ontology Annotation Network Error.</p><p>Please report this issue.</p>" +
      "</div>"
  );
  const spans = [...doc.querySelectorAll("span")].map((s) => s.textContent);
  assert.deepEqual(spans, ["后代数量", "层级"]);
  assert.deepEqual([...doc.querySelectorAll("p")].map((p) => p.textContent), [
    "未找到 HP:0001166 的医学处置",
    "未找到 HP:0001166 的 LOINC 关联",
    "未找到疾病关联",
    "本体注释网络错误。",
    "请报告此问题。"
  ]);
});

test("疾病页：关联表头、注释计数与关联总数句", () => {
  const doc = run(
    '<div class="associations">' +
      '<h3 class="category-title">Other <span>[ 1 annotation ]</span></h3>' +
      '<h3 class="category-title">Inheritance <span>[ 3 annotations ]</span></h3>' +
      "<table><thead><tr><th>Term Identifier</th><th>Term Name</th><th>Onset</th><th>Frequency</th><th>Source(s)</th></tr>" +
      "<tr><th>Gene Identifier</th><th>Gene Symbol</th><th>MaXo Id</th><th>MaXo Name</th><th>Relation</th><th>Target</th></tr></thead></table>" +
      "<p>178 disease associations.</p><p>1 gene associations.</p><p>3 medical actions.</p>" +
      "<p class=\"report\">Report Entry Issue</p>" +
      "</div>"
  );
  const h3 = [...doc.querySelectorAll("h3")].map((h) => h.textContent.replace(/\s+/g, " ").trim());
  assert.deepEqual(h3, ["其他 [ 1 条注释 ]", "遗传方式 [ 3 条注释 ]"]);
  const ths = [...doc.querySelectorAll("th")].map((t) => t.textContent);
  assert.deepEqual(ths, [
    "术语标识符", "术语名称", "起病年龄", "频率", "来源",
    "基因标识符", "基因符号", "MaXo 编号", "MaXo 名称", "关系", "靶点"
  ]);
  assert.deepEqual([...doc.querySelectorAll("p")].map((p) => p.textContent), [
    "178 疾病关联", "1 基因关联", "3 医学处置", "报告条目问题"
  ]);
  assert.equal(doc.querySelector(".report").textContent, "报告条目问题");
});

test("疾病页：表型分类标题与频率枚举值", () => {
  const doc = run(
    "<div>" +
      ["Inheritance", "Growth", "Head and neck", "Eye", "Cardiovascular"].map((c) => "<h3 class=\"category-title\">" + c + "</h3>").join("") +
      ["Skeletal system", "Skin, Hair, and Nails", "Respiratory System", "Nervous System", "Musculature"].map((c) => "<h3 class=\"category-title\">" + c + "</h3>").join("") +
      "<table><tbody>" +
      ["Occasional", "Very rare", "Frequent", "Very frequent"].map((f) => "<tr><td>" + f + "</td></tr>").join("") +
      "</tbody></table>" +
      "</div>"
  );
  assert.deepEqual([...doc.querySelectorAll("h3")].map((h) => h.textContent), [
    "遗传方式", "生长", "头颈部", "眼", "心血管",
    "骨骼系统", "皮肤、毛发与甲", "呼吸系统", "神经系统", "肌肉"
  ]);
  assert.deepEqual([...doc.querySelectorAll("td")].map((t) => t.textContent), [
    "偶发", "极罕见", "常见", "极常见"
  ]);
});

test("错误页与基因缺号页：固定错误句、示例术语提示、报告问题", () => {
  const doc = run(
    "<div>" +
      "<p>Sorry, we could not find that page. Please ensure your URL is correct or the term you are looking for exists when searching.</p>" +
      "<p>If you believe this is a mistake please let us know on our issue tracker.</p>" +
      "<p>Could not find requested entrez id 2200.</p>" +
      "<p>Please ensure the query is valid by searching, otherwise please try our sample terms</p>" +
      "<span>Report Issue</span><i>or</i>" +
      "</div>"
  );
  assert.deepEqual([...doc.querySelectorAll("p")].map((p) => p.textContent), [
    "抱歉，未找到该页面。请确认 URL 是否正确，或检索的术语确实存在。",
    "如果你认为这是错误，请通过我们的问题跟踪器告知。",
    "未找到所请求的 Entrez ID 2200。",
    "请通过检索确认查询有效，否则请尝试我们的示例术语"
  ]);
  assert.equal(doc.querySelector("span").textContent, "报告问题");
  assert.equal(doc.querySelector("i").textContent, "或");
});

test("关于页：分区标题、入口按钮与常见问题", () => {
  const doc = run(
    "<div>" +
      "<h2>Who we are!</h2><span>Deep phenotyping</span><a>Köhler et al, 2017</a>" +
      "<button>Explore Ontology</button><button>HPO on Science Direct</button>" +
      "<a>Browse</a><a>Publications</a><a>Cite Us</a>" +
      "<h2>Where it started!</h2><h2 class=\"contact-banner-title\">Still have some questions?</h2>" +
      "<a>Frequently Asked Questions</a><a>Contact us</a>" +
      "</div>"
  );
  assert.deepEqual([...doc.querySelectorAll("h2")].map((h) => {
    // 首屏 h2 会带上图标连字文本，这里只看文字节点
    return h.textContent.replace(/\s+/g, " ").trim();
  }), ["我们是谁！", "从何而来！", "还有疑问？"]);
  assert.equal(doc.querySelector("span").textContent, "深度表型分析");
  assert.equal(doc.querySelector("a").textContent, "Köhler et al, 2017", "文献引用保持原样");
  assert.deepEqual([...doc.querySelectorAll("button")].map((b) => b.textContent), ["浏览本体", "ScienceDirect 上的 HPO"]);
  const links = [...doc.querySelectorAll("a")].map((a) => a.textContent);
  assert.deepEqual(links, ["Köhler et al, 2017", "浏览", "论文", "引用我们", "常见问题", "联系我们"]);
});

test("新闻页：月份下拉（规则）与固定句", () => {
  const doc = run(
    "<div>" +
      "<span>Select Month</span>" +
      '<select><option>December 2025</option><option>October 2025</option><option>Feburary 2022</option></select>' +
      "<time>December 29, 2025</time>" +
      "<p>Thanks, The HPO Team.</p>" +
      "<a>Feedback Form &amp; Happy Holidays!</a>" +
      "<span>News &amp; Updates</span>" +
      "</div>"
  );
  assert.equal(doc.querySelector("span").textContent, "选择月份");
  assert.deepEqual([...doc.querySelectorAll("option")].map((o) => o.textContent), [
    "2025 年 12 月", "2025 年 10 月", "2022 年 2 月"
  ]);
  assert.equal(doc.querySelector("time").textContent, "2025 年 12 月 29 日");
  assert.equal(doc.querySelector("p").textContent, "感谢，HPO 团队。");
  assert.equal(doc.querySelector("a").textContent, "反馈表与节日快乐！");
});

test("法务页：标题、固定说明句与模板（保留链接）", () => {
  const doc = run(
    "<div>" +
      "<h2>Funding and Grant Support</h2>" +
      "<p>The HPO project gratefully acknowledges funding from a number of sources since its inception in 2007.</p>" +
      "<h2>Citation</h2>" +
      "<p>Please cite our <a href=\"https://pubmed.ncbi.nlm.nih.gov/37953324/\">most recent article</a> if you use the HPO for published work.</p>" +
      "<h2>Warranty, Disclaimer, and Copyright Notice</h2>" +
      "<p>By using this site, you signify your assent to the Terms and Conditions set forth below. If you do not agree to all of these Terms and Conditions of use, do not use this site.</p>" +
      "<ul><li>That neither the content of the HPO file(s) nor the logical relationships embedded within the HPO file(s) be altered in any way. (Content additions and modifications have to be suggested using our <a href=\"https://github.com/obophenotype/human-phenotype-ontology/issues\">issue tracker</a>.)</li></ul>" +
      "<h2>Request a Feature or Report a Bug</h2>" +
      "<p>This page is under construction and being reviewed.</p>" +
      "</div>"
  );
  assert.deepEqual([...doc.querySelectorAll("h2")].map((h) => h.textContent), [
    "资助与基金支持", "引文", "保证、免责声明与版权声明", "请求新功能或报告缺陷"
  ]);
  const ps = [...doc.querySelectorAll("p")].map((p) => p.textContent);
  assert.equal(ps[0], "HPO 项目自 2007 年创建以来获得多方资助，特此致谢。");
  assert.equal(ps[1], "如果你在已发表工作中使用 HPO，请引用我们的最新文章。");
  assert.equal(ps[1].includes("most recent article"), false);
  assert.equal(ps[2], "使用本网站即表示你同意下述条款与条件。若不同意全部使用条款，请勿使用本网站。");
  assert.equal(ps[3], "本页面正在建设中，尚在审核。");
  const li = doc.querySelector("li");
  assert.equal(
    li.textContent,
    "HPO 文件的内容及其内嵌的逻辑关系不得以任何方式更改。（内容的新增与修改须通过我们的 issue tracker 提出。）"
  );
  assert.equal(li.querySelector("a").getAttribute("href"), "https://github.com/obophenotype/human-phenotype-ontology/issues", "模板替换不能丢链接");
});

test("数据不动：基因名、HPO/OMIM/ORPHA 编号、疾病名、外部链接", () => {
  const doc = run(
    "<table><tbody><tr>" +
      "<td>FBN1</td><td>TP53</td><td>HP:0001166</td><td>OMIM:154700</td><td>ORPHA:558</td>" +
      "<td>NCBIGene:2200</td><td>MONDO:0007947</td><td>Marfan syndrome</td>" +
      "<td>Cutis laxa, autosomal recessive, type IB</td><td>Homo sapiens</td>" +
      '<td><a href="https://www.omim.org/entry/154700">OMIM</a></td>' +
      "</tr></tbody></table>"
  );
  assert.deepEqual([...doc.querySelectorAll("td")].map((t) => t.textContent), [
    "FBN1", "TP53", "HP:0001166", "OMIM:154700", "ORPHA:558",
    "NCBIGene:2200", "MONDO:0007947", "Marfan syndrome",
    "Cutis laxa, autosomal recessive, type IB", "Homo sapiens", "OMIM"
  ]);
  assert.equal(doc.querySelector("a").getAttribute("href"), "https://www.omim.org/entry/154700");
});
