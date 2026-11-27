// ChEMBL（www.ebi.ac.uk/chembl/）站点词库回归：站点接线、词条、规则、模板、噪音名单。
// 取证：Chrome 影子实例 CDP 9262 直连抓的真实 DOM 文本节点
//   https://www.ebi.ac.uk/chembl/                                   （首页：导航 / 气泡图 / 侧栏资源）
//   https://www.ebi.ac.uk/chembl/search_results/aspirin             （检索结果：筛选器 / 表头 / 分页）
//   https://www.ebi.ac.uk/chembl/explore/compound/CHEMBL25          （化合物报告卡：字段标签 / 表头 / 代谢图）
// 断言按真实节点边界写：表头是 th > span，导航是 span，代谢图说明是 li 里两个 <b>，
// 气泡图多行标签是每行一个独立 <text>（不是 tspan）。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const createEngine = new Function(
  fs.readFileSync(path.join(root, "../src/engine.js"), "utf8") + "; return createEngine;"
)();
const readDict = (f) => JSON.parse(fs.readFileSync(path.join(root, "../dict", f), "utf8"));
const sitesCfg = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8"));
const SITES = sitesCfg.sites;
const cfg = SITES.find((s) => s.id === "chembl");
const dict = readDict("chembl.json");
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;

// 词库栈按站点声明的 dicts 顺序合并：后册覆盖前册 exact，rules/templates 拼接
function siteData() {
  const exact = {}, rules = [], templates = [];
  for (const f of cfg.dicts) {
    const d = readDict(f + ".json");
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
    templates.push(...(d.templates || []));
  }
  return { exact, rules, templates };
}

const SITE = {
  scope: cfg.scope || "body",
  funcWords: true,
  proseGuard: true,
  proseMax: 120,
  punctFix: true,
  block: "",
  // 与 boot 一致：站级 attrs 是在 defaults 上追加
  attrs: [...((sitesCfg.defaults && sitesCfg.defaults.attrs) || [])],
  rescan: false,
  scopedExact: cfg.scopedExact || [],
  missNoise: cfg.missNoise || []
};

function boot(html, url = "https://www.ebi.ac.uk/chembl/explore/compound/CHEMBL25") {
  const dom = new JSDOM(html, { url });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: siteData(),
    site: SITE
  });
  engine.start();
  return { dom, engine, doc: dom.window.document };
}

/** 站点表里「第一个同时命中 hosts 与 path 的条目」，与 src/boot.js 的 pick() 同口径。 */
function pick(url) {
  const u = new URL(url);
  for (const s of SITES) {
    const hosts = s.hosts || [];
    const hitHost = hosts.some((h) => (h.startsWith("*") ? u.hostname.endsWith(h.slice(1)) : u.hostname === h));
    if (!hitHost) continue;
    if (s.path && !new RegExp(s.path).test(u.pathname)) continue;
    return s.id;
  }
  return null;
}

// ---------------------------------------------------------------- 站点接线

test("chembl 只吃 /chembl 路径，不抢占同域其它项目", () => {
  assert.deepEqual(cfg.hosts, ["www.ebi.ac.uk"]);
  assert.equal(cfg.dicts.join(","), "common,chembl");
  const re = new RegExp(cfg.path);
  for (const p of ["/chembl", "/chembl/", "/chembl/search_results/aspirin", "/chembl/explore/compound/CHEMBL25"]) {
    assert.ok(re.test(p), "应匹配 " + p);
  }
  for (const p of ["/training/", "/chemblx/", "/chembl-search", "/intact/", "/metabolights/", "/"]) {
    assert.ok(!re.test(p), "不应匹配 " + p);
  }
});

test("embl-ebi（吃整个 www.ebi.ac.uk）必须排在 chembl 之后", () => {
  const iChembl = SITES.findIndex((s) => s.id === "chembl");
  const iEbi = SITES.findIndex((s) => s.id === "embl-ebi");
  assert.ok(iChembl >= 0 && iEbi >= 0);
  assert.ok(iChembl < iEbi, "chembl 必须插在 embl-ebi 之前，否则被无 path 的 embl-ebi 抢走");
  // 顺带确认：先于 chembl 的同域站点各自带窄 path，不会被 chembl 抢
  for (const s of SITES.slice(0, iChembl)) {
    if (!(s.hosts || []).includes("www.ebi.ac.uk")) continue;
    assert.ok(s.path, s.id + " 与 chembl 同域却没有 path");
    assert.ok(!new RegExp(s.path).test("/chembl/explore/compound/CHEMBL25"), s.id + " 会吞掉 /chembl 路径");
  }
});

test("pick() 实测：ChEMBL 三页落到 chembl，EMBL-EBI 其它项目不受影响", () => {
  assert.equal(pick("https://www.ebi.ac.uk/chembl/"), "chembl");
  assert.equal(pick("https://www.ebi.ac.uk/chembl/search_results/aspirin"), "chembl");
  assert.equal(pick("https://www.ebi.ac.uk/chembl/explore/compound/CHEMBL25"), "chembl");
  assert.equal(pick("https://www.ebi.ac.uk/training/"), "ebi-training");
  assert.equal(pick("https://www.ebi.ac.uk/intact/"), "intact");
  assert.equal(pick("https://www.ebi.ac.uk/"), "embl-ebi");
  assert.notEqual(pick("https://www.ebi.ac.uk/chembl/"), "embl-ebi");
});

test("词库册 meta 与站点 id 对齐", () => {
  assert.equal(dict.meta && dict.meta.family, "chembl");
  assert.ok(JSON.stringify(dict.meta).includes("www.ebi.ac.uk/chembl"));
  assert.ok(Object.keys(dict.exact).length > 150, "条目数过少，疑似文件被截断");
});

// ---------------------------------------------------------------- 词库卫生

test("exact 全是中文、rules 全部 ^...$ 锚定且不重复、templates 有占位符", () => {
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.ok(CJK.test(v), "译文缺中文：" + k + " => " + v);
    assert.equal(v.trim(), v, "译文有首尾空白：" + k);
  }
  const seen = new Set();
  for (const r of dict.rules) {
    assert.ok(r.re.startsWith("^") && r.re.endsWith("$"), "规则未锚定：" + r.re);
    // requireHit 的结构性规则（"12. Foo" → "$1. $2"）只保留编号、译文全靠捕获组，不算缺中文
    const structural = r.requireHit && !/[A-Za-z]/.test(r.to.replace(/\$\d/g, ""));
    if (!structural) assert.ok(CJK.test(r.to), "规则译文缺中文：" + r.re);
    assert.ok(!seen.has(r.re), "规则重复：" + r.re);
    seen.add(r.re);
    new RegExp(r.re); // 能编译
  }
  for (const t of dict.templates) {
    assert.match(t.pat, /\{\{1\}\}/, "模板缺槽位：" + t.pat);
    assert.ok(CJK.test(t.zh), "模板译文缺中文：" + t.pat);
  }
});

test("与 common 的 exact 没有同键不同值的冲突（dict-lint 口径不增加）", () => {
  const common = readDict("common.json").exact || {};
  const bad = Object.keys(dict.exact).filter((k) => common[k] && common[k] !== dict.exact[k]);
  assert.deepEqual(bad, []);
});

// ---------------------------------------------------------------- exact：真实节点边界

test("导航与首页文案（span 文本节点）", () => {
  const { doc } = boot(
    '<div class="nav"><span>Search in ChEMBL</span><span>Advanced Search</span><span>Chemical Biology Resources</span>' +
      "<span>Downloads</span><span>Web Services</span><span>More</span></div>"
  );
  assert.deepEqual(
    [...doc.querySelectorAll(".nav span")].map((e) => e.textContent),
    ["在 ChEMBL 中检索", "高级检索", "化学生物学资源", "下载", "Web 服务", "更多"]
  );
});

test("检索结果表头：th > span 边界（Vuetify v-data-table-header）", () => {
  const { doc } = boot(
    '<table><thead><tr class="v-data-table-header">' +
      '<th class="text-start sortable"><span>Compound</span></th>' +
      '<th class="text-start sortable"><span>Name</span></th>' +
      '<th class="text-start sortable"><span>Synonyms</span></th>' +
      "</tr></thead></table>"
  );
  assert.deepEqual(
    [...doc.querySelectorAll("th span")].map((e) => e.textContent),
    ["化合物", "名称", "同义词"]
  );
});

test("报告卡字段标签（含全角冒号的 exact）", () => {
  const { doc } = boot('<dl><dd><span>AlogP:</span></dd><dd><span>Structure search</span></dd><dd><span>Similar Compounds</span></dd></dl>');
  assert.deepEqual(
    [...doc.querySelectorAll("dd span")].map((e) => e.textContent),
    ["AlogP 值：", "结构检索", "相似化合物"]
  );
});

// ---------------------------------------------------------------- rules

test("分页/计数规则", () => {
  assert.equal(boot("<div>Showing 1-20 out of 30 records</div>").doc.body.textContent.trim(), "显示第 1–20 条，共 30 条记录");
  assert.equal(boot("<div>1 - 20 out of 30</div>").doc.body.textContent.trim(), "第 1–20 条，共 30 条");
  assert.equal(boot("<div>1 out of 683</div>").doc.body.textContent.trim(), "第 1 条，共 683 条");
});

test("标题规则：带 - ChEMBL 的必须被专门规则接住（不能被通用条目录成“aspirin - ChEMBL”的检索结果）", () => {
  assert.equal(
    boot("<div>Search results for aspirin - ChEMBL</div>").doc.body.textContent.trim(),
    "“aspirin”的检索结果 - ChEMBL"
  );
  assert.equal(boot("<h1>Search results for aspirin</h1>").doc.body.textContent.trim(), "“aspirin”的检索结果");
});

test("带数据的规则：登录号/相似度/文献数保持标识符原样", () => {
  assert.equal(boot("<div>CHEMBL25 (Parent)</div>").doc.body.textContent.trim(), "CHEMBL25（母体）");
  assert.equal(boot("<div>Structure of aspirin</div>").doc.body.textContent.trim(), "aspirin 的结构");
  assert.equal(boot("<div>Sources (3):</div>").doc.body.textContent.trim(), "数据来源（3）：");
  assert.equal(
    boot("<div>Compounds with at least 85% similarity.</div>").doc.body.textContent.trim(),
    "相似度至少 85% 的化合物。"
  );
  assert.equal(
    boot("<div>Documents related to aspirin (12 items)</div>").doc.body.textContent.trim(),
    "与 aspirin 相关的文献（12 条）"
  );
});

test("requireHit 正反例：捕获组是词库里的界面词才翻，是属性名（AlogP）就整条放弃", () => {
  const th = (label, text) =>
    '<table><thead><tr><th aria-label="' + label + '"><span>' + text + "</span></th></tr></thead></table>";
  const sorted = boot(th("Name: Not sorted. Activate to sort ascending.", "Name"));
  assert.equal(sorted.doc.querySelector("th").getAttribute("aria-label"), "名称：未排序。激活后按升序排序。");

  const keepsData = boot(th("AlogP: Not sorted. Activate to sort ascending.", "AlogP"));
  // AlogP 是描述符名（数据），不该翻；规则整条放弃，aria-label 保持英文
  assert.equal(keepsData.doc.querySelector("th").getAttribute("aria-label"), "AlogP: Not sorted. Activate to sort ascending.");
});

test("错误占位（接口失败时的空错误串）", () => {
  // 引擎的 punctFix 会吞掉句末重复标点，实际渲染是「错误」而不是「错误。」
  assert.equal(boot("<div>Error: .</div>").doc.body.textContent.trim(), "错误");
  assert.equal(boot("<div>Error: . Please try again.</div>").doc.body.textContent.trim(), "错误。请重试。");
});

// ---------------------------------------------------------------- templates

test("代谢关系图说明模板：两个 <b> 槽位与链接都保留", () => {
  const { doc } = boot(
    "<ul><li><b>Drag</b> to move around the visualization, and <b>scroll</b> to zoom in and out.</li></ul>"
  );
  const li = doc.querySelector("li");
  assert.equal([...li.querySelectorAll("b")].map((b) => b.textContent).join("|"), "拖动|滚动");
  assert.equal(li.textContent.trim(), "拖动即可在可视化中移动，滚动即可放大或缩小。");
});

test("剩余三条模板（Reset 按钮 / 点节点 / 点连线）", () => {
  assert.equal(
    boot("<div>Click the <b>Reset</b> button to return to the initial view.</div>").doc.body.textContent.trim(),
    "点击重置按钮可返回初始视图。"
  );
  assert.equal(
    boot("<div>Click on a <b>node</b> to view details about the compound.</div>").doc.body.textContent.trim(),
    "点击节点可查看该化合物的详细信息。"
  );
  // 代谢图的 <b>link</b> 指图上的边；common 已把 link 译作「链接」并优先于本册规则，
  // 改它要新增跨册冲突（验收要求不增加），所以这里保留 common 的「链接」
  assert.equal(
    boot("<div>Click on a <b>link</b> to see details of the metabolism conversion between compounds.</div>")
      .doc.body.textContent.trim(),
    "点击链接可查看化合物之间代谢转化的详细信息。"
  );
});

// ---------------------------------------------------------------- SVG 气泡图

test("气泡图多行标签是各自独立的 <text>，逐行翻译后整块仍是中文", () => {
  const { doc } = boot(
    "<svg><g><text>Drug</text><text>Mechanisms</text></g><g><text>Cell</text><text>Lines</text></g></svg>"
  );
  assert.deepEqual([...doc.querySelectorAll("svg text")].map((t) => t.textContent.trim()), ["药物", "机制", "细胞", "系"]);
});

// ---------------------------------------------------------------- 不翻数据

test("专有名词与数据值一律保持英文", () => {
  const data = [
    "ASPIRIN",
    "CHEMBL25",
    "DB00945",
    "C9H8O4",
    "Homo sapiens",
    "IC50",
    "Ki",
    "J Med Chem",
    "acetylsalicylic acid",
    "ACETYLSALICYLIC ACID (WHO-IP)",
    "N02BA01",
    "PubMed"
  ];
  for (const s of data) {
    assert.equal(boot("<div>" + s + "</div>").doc.body.textContent.trim(), s, "不该翻：" + s);
  }
});

test("界面词整块保留中文、不出现半中半英（节点内一处未命中就整块不动）", () => {
  // 说明句里有词库没有的机构缩写时，整句留英文而不是翻一半
  const s = "The ChEMBL team thanks our collaborators for their support.";
  assert.equal(boot("<p>" + s + "</p>").doc.body.textContent.trim(), s);
});

// ---------------------------------------------------------------- missNoise

// 与 src/ui.js 的 noiseRuleSet()/isNoise() 同语义：rec: 大小写敏感正则，re: 大小写不敏感正则，其余子串
function compileNoise(list) {
  return list.map((n) => {
    const t = String(n).trim();
    const low = t.toLowerCase();
    if (low.startsWith("rec:")) return { re: new RegExp(t.slice(4)), cs: true };
    if (low.startsWith("re:")) return { re: new RegExp(t.slice(3), "i"), cs: false };
    return { sub: low };
  });
}
const NOISE = compileNoise(cfg.missNoise || []);
function isNoise(text) {
  const raw = String(text).trim();
  const low = raw.toLowerCase();
  return NOISE.some((r) => (r.re ? r.re.test(r.cs ? raw : low) : low.includes(r.sub)));
}

test("数据形状进噪音名单（登录号 / ATC / 本体 / 截断串 / 单字母图例）", () => {
  const noise = [
    "CHEMBL25",
    "CHEBI:15377",
    "D00045",
    "EFO:0000270",
    "HP:0001945",
    "MONDO:0005148",
    "GO:0004601",
    "N02BA01",
    "N02 -",
    "N -",
    "Aspirin (25)",
    "Nervous system | …",
    "This is a truncated cell…",
    "S:",
    "P:",
    "undefined"
  ];
  for (const s of noise) assert.ok(isNoise(s), "应被噪音名单吃掉：" + s);
});

test("真界面词不被噪音名单误伤", () => {
  const ui = [
    "Showing 1-20 out of 30 records",
    "Search results for aspirin",
    "Compounds similar to aspirin",
    "Advanced Search",
    "Max Phase",
    "Bioactivity Summary",
    "Not sorted",
    "Include data from Alt. Forms",
    "Please try again.",
    "Download CSV",
    "Filter by",
    "View 3D"
  ];
  for (const s of ui) assert.ok(!isNoise(s), "不该被噪音名单吃掉：" + s);
});
