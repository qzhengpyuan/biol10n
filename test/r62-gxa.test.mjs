// r62：Expression Atlas（www.ebi.ac.uk/gxa）实验页词库
// 现象（0.13.5 实测）：gxa 站只挂了 common/anatomy/string-atlas/string-atlas2；
// anatomy.json 存的是首字母大写形态（"Lymph node"），而实验页的 tissue 下拉、
// Experiment Design 表格、Highcharts 本体图 SVG 全部是小写（"lymph node"），
// 大小写兜底只能命中解剖册已有的词 ⇒ brain meninx / caudate nucleus / smooth muscle
// tissue 这类整片留英文；AGE 的 "62 year" 又被 common 的 ^(\d…)\s+(.+)$ 规则把
// year 翻成"年份"，显示成"62 年份"。r62 在 dict/gxa.json 补齐小写组织/细胞类型/
// 性别/发育阶段枚举 + 年龄单位规则，并把 "year" 单独钉成"岁"。
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
const site = sites.find((s) => s.id === "gxa");
const gxa = JSON.parse(fs.readFileSync(path.join(root, "../dict/gxa.json"), "utf8"));
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;

// 按站点声明的 dicts 顺序合并（与 dist 里的运行时一致）
const data = { exact: {}, rules: [], templates: [] };
const books = {};
for (const id of site.dicts) {
  const b = JSON.parse(fs.readFileSync(path.join(root, "../dict", id + ".json"), "utf8"));
  books[id] = b;
  Object.assign(data.exact, b.exact || {});
  data.rules = data.rules.concat(b.rules || []);
  data.templates = data.templates.concat(b.templates || []);
}

function makeEngine(html, url) {
  const dom = new JSDOM(html, { url: url || "https://www.ebi.ac.uk/gxa/experiments/E-MTAB-3358/Results" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return { dom, doc: dom.window.document, engine };
}

const plain = makeEngine("<!doctype html><body><p>placeholder</p></body>");
function tr(s) {
  return plain.engine.translateText(s);
}

// ---- 词库形状 ----

test("gxa 册挂在 www.ebi.ac.uk/gxa 上，且只有本册负责这站", () => {
  assert.equal(site.hosts.includes("www.ebi.ac.uk"), true);
  assert.match(site.path, /gxa/);
  assert.equal(gxa.meta.family, "ebi");
  assert.deepEqual(gxa.meta.sites, ["www.ebi.ac.uk/gxa"]);
});

test("exact 规模与形态：小写组织枚举是主体，译文全中文、无自映射、无首尾空白", () => {
  const keys = Object.keys(gxa.exact);
  assert.ok(keys.length >= 500, "exact 只有 " + keys.length + " 条");
  for (const k of keys) {
    assert.equal(k, k.trim(), "键有首尾空白: " + JSON.stringify(k));
    assert.equal(/[\u3400-\u4dbf\u4e00-\u9fff]/.test(k), false, "键里混了汉字: " + k);
    assert.notEqual(gxa.exact[k], k, "自映射: " + k);
    assert.ok(CJK.test(gxa.exact[k]), "译文没有中文: " + k + " => " + gxa.exact[k]);
  }
});

test("rules 形态：^…$ 锚定、to 含中文、捕获组编号不越界", () => {
  assert.ok(Array.isArray(gxa.rules) && gxa.rules.length >= 30, "rules 太少: " + gxa.rules.length);
  for (const r of gxa.rules) {
    assert.equal(typeof r.re, "string");
    assert.equal(typeof r.to, "string");
    assert.ok(r.re.startsWith("^"), "规则没锚定开头: " + r.re);
    assert.ok(r.re.endsWith("$"), "规则没锚定结尾: " + r.re);
    assert.ok(CJK.test(r.to), "规则译文没有中文: " + r.re + " => " + r.to);
    const re = new RegExp(r.re);
    const groups = new RegExp(r.re + "|").exec("").length - 1;
    for (const m of r.to.matchAll(/\$(\d)/g)) {
      assert.ok(Number(m[1]) <= groups, "规则引用了不存在的捕获组 $" + m[1] + ": " + r.re);
    }
    assert.ok(re);
  }
});

test("templates 本册留空（download 页 curl 段的槽位数由 string-atlas2 负责，见报告）", () => {
  assert.deepEqual(gxa.templates, []);
});

// ---- 小写组织枚举（本轮主要缺口） ----

const TISSUES = {
  "lymph node": "淋巴结",
  "bone marrow": "骨髓",
  "smooth muscle tissue": "平滑肌组织",
  "brain meninx": "脑膜",
  "caudate nucleus": "尾状核",
  "diencephalon": "间脑",
  "frontal cortex": "额叶皮层",
  "skeletal muscle tissue": "骨骼肌组织",
  "small intestine": "小肠",
  "heart left ventricle": "左心室",
  "whole organism": "整个生物体",
  "adipose tissue": "脂肪组织"
};

test("实验页 tissue 下拉/表格里的小写组织名都翻", () => {
  for (const [en, zh] of Object.entries(TISSUES)) {
    assert.equal(tr(en), zh, "小写组织没翻: " + en);
  }
});

test("性别/发育阶段/细胞类型枚举的常用值都翻", () => {
  const CASES = {
    "male": "男性",
    "female": "女性",
    "not available": "未提供",
    "adult": "成年",
    "fetal": "胎儿",
    "seedling": "幼苗",
    "late embryo": "晚期胚胎",
    "zygote": "受精卵",
    "normal": "正常",
    "other": "其他"
  };
  for (const [en, zh] of Object.entries(CASES)) {
    assert.equal(tr(en), zh, en + " 没翻");
  }
});

// ---- 实机 DOM 夹具：表头 / option / SVG 图表 / 标签页 ----

const PAGE = `<!doctype html><html><body>
<table><thead><tr><th>Run</th><th>Assay</th><th>Experiment</th><th>Species</th></tr></thead>
<tbody><tr><td>DRR009489</td><td>RNA-seq of coding RNA</td><td>E-MTAB-3358</td><td>Homo sapiens</td></tr></tbody></table>
<select id="tissue"><option>lymph node</option><option>bone marrow</option><option>smooth muscle tissue</option></select>
<table><tbody><tr><td><a href="#">brain meninx</a></td><td>caudate nucleus</td></tr></tbody></table>
<svg width="200" height="40"><text x="5" y="20"><tspan>bone </tspan><tspan>marrow</tspan></text></svg>
<svg width="200" height="40"><text x="5" y="20">smooth muscle tissue</text></svg>
<label>Chart type</label><label>Colour by</label><label>Gene query</label><label>Clustering</label>
<p>Showing 21 genes:</p><p>27 or 29 year</p><p>Homo sapiens</p><p>ENSG00000141510</p>
<div class="tabs"><span>Experiment Design</span><span>Supplementary Information</span><span>Downloads</span></div>
</body></html>`;

const { doc } = makeEngine(PAGE);
const text = (sel) => Array.from(doc.querySelectorAll(sel)).map((e) => e.textContent);

test("下载表表头翻干净", () => {
  assert.deepEqual(text("th"), ["运行", "检测方法", "实验", "物种"]);
});

test("tissue 下拉的 option 翻干净（往 options 里写中文会破坏筛选值？这里只翻显示文本）", () => {
  assert.deepEqual(text("option"), ["淋巴结", "骨髓", "平滑肌组织"]);
});

test("Experiment Design 表格单元格里的组织名翻干净，链接文本一起翻", () => {
  const cells = text("tbody tr td").slice(4);
  assert.deepEqual(cells, ["脑膜", "尾状核"]);
  assert.equal(doc.querySelector("a").textContent, "脑膜");
});

test("Highcharts 本体图的 SVG <text>/<tspan> 会翻，tspan 按空格切开时能拼回整词", () => {
  assert.deepEqual(text("svg text"), ["骨髓", "平滑肌组织"]);
});

test("图表控件标签与标签页翻干净", () => {
  assert.deepEqual(text("label"), ["图表类型", "着色依据", "基因查询", "聚类"]);
  assert.deepEqual(text(".tabs span"), ["实验设计", "补充信息", "下载"]);
});

// ---- 年龄/基因数规则 ----

test("AGE 枚举的「数字 + 单位」按岁/个月/周/天/小时翻，不再出现「62 年份」", () => {
  assert.equal(tr("62 year"), "62 岁");
  assert.equal(tr("6 month"), "6 个月");
  assert.equal(tr("37 week"), "37 周");
  assert.equal(tr("3 day"), "3 天");
  assert.equal(tr("2 hour"), "2 小时");
  assert.equal(tr("530-680 minute"), "530 至 680 分钟");
});

test("区间/并列/带修饰的年龄也能翻", () => {
  assert.equal(tr("27 or 29 year"), "27 或 29 岁");
  assert.equal(tr("10 to 12 week"), "10 至 12 周");
  assert.equal(tr("17.9 week"), "17.9 周");
  assert.equal(tr("over 90 year"), "90 岁以上");
  assert.equal(tr("Over 90 year"), "90 岁以上");
});

test("胚胎/出生后/幼虫/Carnegie 这类分期规则可用", () => {
  assert.equal(tr("embryonic day 14.5"), "胚胎第 14.5 天");
  assert.equal(tr("postnatal day 7"), "出生后第 7 天");
  assert.equal(tr("post natal day 1 to 2"), "出生后第 1 至 2 天");
  assert.equal(tr("larval day 5"), "幼虫第 5 天");
  assert.equal(tr("Carnegie Stage 14"), "卡内基分期 14");
  assert.equal(tr("4 weeks post conception"), "受孕后 4 周");
  assert.equal(tr("3 days after fertilization"), "受精后 3 天");
});

test("「Showing N genes:」按基因数翻", () => {
  assert.equal(tr("Showing 21 genes:"), "显示 21 个基因：");
  assert.equal(tr("Showing 1,204 genes:"), "显示 1,204 个基因：");
});

test("捕获组里的发育阶段会二次翻译（adult → 成年）", () => {
  assert.equal(tr("stage 13 to 14"), "第 13 至 14 期");
  assert.equal(tr("embryo stage 7"), "胚胎期 7");
});

// ---- 口径：该留英文的留英文 ----

test("物种拉丁名 / 基因符号 / Ensembl ID / 实验 accession 一律不动", () => {
  for (const s of ["Homo sapiens", "Mus musculus", "ENSG00000141510", "E-MTAB-3358", "DRR009489", "GAPDHP75", "RNA-seq of coding RNA"]) {
    assert.equal(tr(s), null, "不该翻的翻了: " + s);
  }
});

test("故意留英文的脏值/专名不硬翻", () => {
  for (const s of ["arm", "NSM", "left side of right pacemaker cell", "gastrula shield", "pharyngula prim-5", "LP.04 four leaves visible stage"]) {
    assert.equal(tr(s), null, "这些应保留英文: " + s);
  }
});

// ---- 跨册一致性（同站其它册已有的键必须同译，否则站点内自相矛盾） ----

test("同站其它册里已有的同键必须同译（不引入站内冲突）", () => {
  const others = ["common", "anatomy", "string-atlas", "string-atlas2"];
  const clashes = [];
  for (const id of others) {
    const ex = books[id].exact || {};
    for (const [k, v] of Object.entries(gxa.exact)) {
      if (k in ex && ex[k] !== v) clashes.push(id + ": " + k + " → " + ex[k] + " / gxa → " + v);
    }
  }
  assert.deepEqual(clashes, []);
});

test("同一批术语在 gxa 与 anatomy 之间大小写不打架（小写形态是补的，不是改的）", () => {
  const check = [["lymph node", "Lymph node"], ["bone marrow", "Bone marrow"], ["smooth muscle tissue", "Smooth muscle tissue"]];
  for (const [lower, upper] of check) {
    const anatomy = books.anatomy.exact || {};
    if (upper in anatomy && lower in gxa.exact) {
      assert.equal(gxa.exact[lower], anatomy[upper], "大小写两种形态译法不一致: " + lower);
    }
  }
});

test("搜索后端不可用时的 400 报错页：整句与返回链接都中文化，链接与 href 保留", () => {
  const { doc } = makeEngine(
    '<div role="main"><div class="row"><div class="small-6 small-centered columns">' +
      '<h4>错误<span style="color:indianred;font-weight: bold;">400</span></h4>' +
      "<div><h5>The Expression Atlas Solr server could not be reached.</h5></div>" +
      '<h5 class="margin-top-xlarge">Go back to <a href="/gxa/home">Expression Atlas home page</a>.</h5>' +
      "</div></div></div>",
    "https://www.ebi.ac.uk/gxa/search"
  );
  const h5 = [...doc.querySelectorAll("h5")].map((h) => h.textContent.replace(/\s+/g, " ").trim());
  assert.equal(h5[0], "无法连接到 Expression Atlas 的 Solr 服务器。");
  // 句末的英文句点由 punctFix 统一成全角句号
  assert.equal(h5[1], "返回 Expression Atlas 首页。");
  assert.equal(doc.querySelector("h5 a").getAttribute("href"), "/gxa/home");
});
