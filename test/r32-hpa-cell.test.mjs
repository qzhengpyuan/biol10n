// r32：HPA 单细胞资源页与组织资源页残留（单细胞类型图、深度视觉蛋白质组图、
// 组织菜单、邻近基因表排序提示、图像染色说明）的补词与规则。
// 英文原串全部取自真实渲染 DOM：
//   /humanproteome/single+cell        单细胞资源首页（DVP / 批量 RNA 解卷积三张柱图 tooltip）
//   /ENSG00000141510-TP53/single+cell 单细胞类型基因页（54 个「细胞类型 - N nCPM」小标题、组织菜单）
//   /humanproteome/tissue             组织资源页（多重免疫荧光与免疫组化图像说明）
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, "../dict", f + ".json"), "utf8"));

const site = sites.find((s) => s.id === "hpa");
assert.ok(site, "config/sites.json 里应有 hpa 站点");
const hpa = read("hpa");

// 生产上按 sites.json 的 dicts 顺序叠词库：细胞类型名、器官名、Tau 评分等来自 anatomy / hpa2。
// 只解析一次，避免每个用例重建 6 册词库。
const HPA_DATA = (() => {
  const exact = {}, rules = [], templates = [];
  for (const book of site.dicts) {
    const d = read(book);
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
    templates.push(...(d.templates || []));
  }
  Object.assign(exact, hpa.exact);
  return { exact, rules, templates };
})();

function boot(html, title) {
  const dom = new JSDOM(html, { url: "https://www.proteinatlas.org/humanproteome/single+cell" });
  if (title) dom.window.document.title = title;
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: HPA_DATA,
    site
  });
  engine.start();
  return { engine, doc: dom.window.document };
}

const tr = (s) => boot("<p>x</p>").engine.translateText(s);

// ---------------- 词库结构 ----------------

test("r32 词库：标准序列化、末尾换行、键里没有汉字", () => {
  const raw = fs.readFileSync(path.join(root, "../dict/hpa.json"), "utf8");
  assert.ok(raw.endsWith("\n"), "dict/hpa.json 应以换行结尾");
  assert.equal(raw, JSON.stringify(hpa, null, 2) + "\n", "dict/hpa.json 应是 2 空格缩进的标准序列化");
  for (const k of Object.keys(hpa.exact)) assert.ok(!/[\u4e00-\u9fff]/.test(k), "exact 的键必须是英文原串：" + k);
});

test("r32 新增 exact：组织菜单的大写器官名（DOM 原文全部大写）", () => {
  // #menu_tissues 里 35 个器官中有一半是大写形态（BREAST / KIDNEY …），
  // anatomy.json 只有首字母大写（Breast / Kidney），引擎对全大写串不回退小写，必须逐个登记。
  const want = {
    BREAST: "乳腺",
    COLON: "结肠",
    ENDOMETRIUM: "子宫内膜",
    EPIDIDYMIS: "附睾",
    ESOPHAGUS: "食管",
    EYE: "眼",
    KIDNEY: "肾脏",
    LIVER: "肝脏",
    LUNG: "肺",
    OVARY: "卵巢",
    PANCREAS: "胰腺",
    PLACENTA: "胎盘",
    PROSTATE: "前列腺",
    RECTUM: "直肠",
    SKIN: "皮肤",
    SPLEEN: "脾脏",
    STOMACH: "胃",
    TESTIS: "睾丸",
    THYMUS: "胸腺",
    TONGUE: "舌",
    VASCULATURE: "血管系统"
  };
  for (const [k, v] of Object.entries(want)) {
    assert.equal(hpa.exact[k], v, "缺词条或译法变了: " + k);
    assert.match(v, /[\u4e00-\u9fff]/, "译文必须含汉字: " + k);
  }
});

test("r32 新增 exact：图标说明与 Tau 表头", () => {
  assert.equal(hpa.exact["Show tissue menu"], "显示组织菜单");
  assert.equal(hpa.exact["RSS feed"], "RSS 订阅源");
  // 原译（RNA tau 分数：/ 蛋白质 tau 分数：）与同册「Tau 评分」不一致，且 tau 留了半截英文
  assert.equal(hpa.exact["RNA tau score:"], "RNA Tau 评分：");
  assert.equal(hpa.exact["Protein tau score:"], "蛋白质 Tau 评分：");
});

test("r32 新增规则：全部锚定、可编译、re 不含中文", () => {
  // 三类：中文模板（needCjk）、只重排已翻捕获组（$1 $2 $3 / $1 - $2）以前者为准
  const wantRe = {
    "^([^<]+) ([\\d.]+) (nCPM|nTPM)$": false,
    "^<b>(.+)</b><br><b>(.+)</b><br>Intensity:([\\d.,]+[kKMGT]?)<br>Organ: (.+)$": true,
    "^(.+ cells) - (.+)$": false,
    "^Immunohistochemical staining of (\\S+) in (.+?)\\.?$": true,
    "^Immunohistochemical staining of (\\S+)$": true,
    "^Protein: (.+)$": true,
    "^(Neighbour|Description|Correlation|Cluster)i .*?: No sort applied, sorting is disabled$": true
  };
  for (const [re, needCjk] of Object.entries(wantRe)) {
    const hit = hpa.rules.filter((r) => r.re === re);
    assert.equal(hit.length, 1, "缺少规则（或写得不一样）: " + re);
    assert.match(re, /^\^/, "规则必须锚定句首: " + re);
    assert.match(re, /\$$/, "规则必须锚定句尾: " + re);
    assert.doesNotMatch(re, /[\u4e00-\u9fff]/, "re 里不能有中文: " + re);
    assert.doesNotThrow(() => new RegExp(re), "规则必须能编译: " + re);
    if (needCjk) assert.match(hit[0].to, /[\u4e00-\u9fff]/, "to 必须是中文模板: " + re);
    else assert.match(hit[0].to, /\$1/, "纯重排规则必须保留捕获组: " + re);
  }
  // 带单位 nCPM 的规则不能 requireHit：nCPM 本身不可翻，requireHit 会让规则永远不命中
  const cpM = hpa.rules.find((r) => r.re === "^([^<]+) - ([\\d.]+) (nCPM|nTPM)$");
  assert.ok(cpM, "缺少「细胞类型 - N nCPM」规则");
  assert.notEqual(cpM.requireHit, true, "该规则若 requireHit，nCPM 段会让整条规则永不命中");
});

// ---------------- 引擎行为：单细胞图的 nCPM 小标题与柱图 tooltip ----------------

test("单细胞类型小标题：H4「细胞类型 - N nCPM」翻细胞类型、数值与单位原样", () => {
  const cases = [
    ["Acinar cells - 19.0 nCPM", "腺泡细胞 - 19.0 nCPM"],
    ["Neutrophils - 21.5 nCPM", "中性粒细胞 - 21.5 nCPM"],
    ["B-cells - 55.8 nCPM", "B 细胞 - 55.8 nCPM"],
    ["Pancreatic islet cells - 9.0 nCPM", "胰岛细胞 - 9.0 nCPM"]
  ];
  for (const [input, want] of cases) assert.equal(tr(input), want, input);
});

test("柱图 tooltip 段：「细胞类型 N nCPM」（空格分隔）也翻", () => {
  assert.equal(tr("Rod photoreceptor cells 11.4 nCPM"), "视杆细胞 11.4 nCPM");
  assert.equal(tr("Retinal bipolar cells 11.1 nCPM"), "视网膜双极细胞 11.1 nCPM");
  assert.equal(tr("Schwann cells 0.0 nCPM"), "施万细胞 0.0 nCPM");
});

test("多段 tooltip（含 <br>）不被 nCPM 整串规则截胡，仍按段翻", () => {
  // 真实原文：Glial cells<br>Vasculature<br><br>Schwann cells 18.8 nCPM
  const title = "Glial cells<br>Heart muscle<br><br>Schwann cells 10.9 nCPM";
  const { doc } = boot('<svg><g id="g" title="' + title + '"></g></svg>');
  const out = doc.getElementById("g").getAttribute("title");
  assert.match(out, /胶质细胞/, "首段细胞类型要翻");
  assert.match(out, /心肌/, "器官段要翻");
  assert.match(out, /施万细胞 10\.9 nCPM/, "带数值的末段要翻，数值与单位原样");
  assert.doesNotMatch(out, /cells|Glial|Heart/, "不应留英文细胞类型/器官名: " + out);
});

test("未知细胞类型保持英文（规则不硬拼）", () => {
  assert.equal(tr("Zzzunknown cells - 12.0 nCPM"), "Zzzunknown cells - 12.0 nCPM");
  assert.equal(tr("Zzzunknown cells 12.0 nCPM"), "Zzzunknown cells 12.0 nCPM");
});

test("深度视觉蛋白质组 tooltip：小数/千/百万/十亿强度值都翻", () => {
  const cases = [
    [
      "<b>Neurons</b><br><b>Brain</b><br>Intensity:140.7M<br>Organ: Neurons",
      "<b>神经元</b><br><b>脑</b><br>强度：140.7M<br>器官：神经元"
    ],
    [
      "<b>Astrocytes and Neuropil</b><br><b>Brain</b><br>Intensity:6.2G<br>Organ: Glial cells",
      "<b>星形胶质细胞与神经毡</b><br><b>脑</b><br>强度：6.2G<br>器官：胶质细胞"
    ],
    [
      "<b>Large ducts</b><br><b>Salivary gland</b><br>Intensity:515.7k<br>Organ: Specialized epithelial cells",
      "<b>大导管</b><br><b>唾液腺</b><br>强度：515.7k<br>器官：特化上皮细胞"
    ],
    [
      "<b>Pancreatic islets</b><br><b>Pancreas</b><br>Intensity:5.5M<br>Organ: Endocrine cells",
      "<b>胰岛</b><br><b>胰腺</b><br>强度：5.5M<br>器官：内分泌细胞"
    ]
  ];
  for (const [input, want] of cases) assert.equal(tr(input), want, input);
});

test("整数强度（原有规则）不受新规则影响：Intensity:0", () => {
  assert.equal(
    tr("<b>Alveolar cells type 1</b><br><b>Lung</b><br>Intensity:0<br>Organ: Specialized epithelial cells"),
    "<b>1 型肺泡细胞</b><br><b>肺</b><br>强度：0<br>器官：特化上皮细胞"
  );
});

test("tooltip 走属性通道：<g title> 上的三段式 tooltip 整串替换", () => {
  const { doc } = boot(
    '<svg><g id="g" title="<b>Neurons</b><br><b>Brain</b><br>Intensity:140.7M<br>Organ: Neurons"></g></svg>'
  );
  assert.equal(
    doc.getElementById("g").getAttribute("title"),
    "<b>神经元</b><br><b>脑</b><br>强度：140.7M<br>器官：神经元"
  );
});

// ---------------- 引擎行为：组织菜单与图标说明 ----------------

test("组织菜单：大写器官名按链接文字翻，链接与 href 不动", () => {
  const { doc } = boot(
    '<div id="menu_tissues">' +
      '<a id="a1" href="/ENSG00000141510-TP53/single+cell/breast"><span id="s1">BREAST</span></a>' +
      '<a id="a2" href="/ENSG00000141510-TP53/single+cell/kidney"><span id="s2">KIDNEY</span></a>' +
      "</div>"
  );
  assert.equal(doc.getElementById("s1").textContent, "乳腺");
  assert.equal(doc.getElementById("s2").textContent, "肾脏");
  assert.equal(doc.getElementById("a1").getAttribute("href"), "/ENSG00000141510-TP53/single+cell/breast");
});

test("组织菜单图标 alt：Show tissue menu → 显示组织菜单", () => {
  const { doc } = boot('<img id="m" class="menu_icon" alt="Show tissue menu" src="menu.png">');
  assert.equal(doc.getElementById("m").getAttribute("alt"), "显示组织菜单");
});

// ---------------- 引擎行为：邻近基因表的排序提示 ----------------

test("排序提示：表头帮助文本被粘进 title 时先剥掉再翻", () => {
  // tablesorter 用 $(th).text() 生成 title，把表头标签、帮助图标字母 i 与隐藏帮助文本粘成一串
  assert.equal(
    tr("Neighbouri Gene name according to HGNC.: No sort applied, sorting is disabled"),
    "邻近基因：未应用排序，排序已禁用"
  );
  assert.equal(
    tr("Correlationi Correlation between the selected gene and neighboring gene. Correlation is calculated as Spearman correlation in PCA space based on the RNA-seq expression data.: No sort applied, sorting is disabled"),
    "相关性：未应用排序，排序已禁用"
  );
  // 没有帮助文本的普通表头仍走原规则
  assert.equal(tr("Gene: No sort applied, sorting is disabled"), "基因：未应用排序，排序已禁用");
});

// ---------------- 引擎行为：图像染色说明与细胞类型-功能 tooltip ----------------

test("免疫组化图像说明：基因 + 器官，器官走词表", () => {
  assert.equal(tr("Immunohistochemical staining of GFAP in cerebral cortex."), "大脑皮层中 GFAP 的免疫组化染色");
  assert.equal(tr("Immunohistochemical staining of DCD"), "免疫组化染色：DCD");
  // 说明句里带拼写粘连（skeletal myocytesshown）时整条留英文，不拼半中半英
  assert.equal(
    tr("Immunohistochemical staining of MYH2, located in skeletal myocytesshown here in the skeletal muscle."),
    null
  );
});

test("深度视觉蛋白质组 tooltip：Protein 标签翻、数值 token 原样", () => {
  assert.equal(tr("Protein: ND"), "蛋白质：未检出", "ND 走词表（未检出）");
  assert.equal(tr("Protein: 42.5"), "蛋白质：42.5");
});

test("细胞类型 - 功能 tooltip：Foveolar cells - Mucosal defense", () => {
  const { doc } = boot('<div id="d" title="Foveolar cells - Mucosal defense"></div>');
  assert.equal(doc.getElementById("d").getAttribute("title"), "胃小凹细胞 - 黏膜防御");
});

// ---------------- 不该翻的东西 ----------------

test("基因符号、细胞系名、单位、邮箱一律不动", () => {
  for (const s of ["TP53", "HeLa", "MT", "nCPM", "contact@proteinatlas.org", "Tumor protein p53"]) {
    assert.equal(tr(s), null, "不该翻: " + s);
  }
});
