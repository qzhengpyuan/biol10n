// Human Protein Atlas title/tooltip 词库（dict/hpa.json）校验 + 引擎行为测试
// 覆盖：/humanproteome/brain 的空间转录组学图注与按钮 tooltip、脑区图例计数、
//       /humanproteome/cancer 与 /humanproteome/pathology 的环形图图例与预后标签、
//       /humanproteome/tissue 与 /about 的 "Group enriched (...)<br>Detected in ..." 图例 tooltip。
// 每条英文原串都是用 CDP 从真实 DOM 的 [title] 属性里抓下来的（未翻译 = miss 的那批）。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/hpa.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "hpa");
assert.ok(site, "config/sites.json 里应有 hpa 站点");

// 生产上 hpa 与 common / anatomy / onco 等册一起加载：规则槽位里的细胞类型名、癌种名、器官名
// 来自 anatomy.json / onco.json，这里按站点的 dicts 顺序合并，渲染真实加载顺序。
const exact = {};
for (const name of site.dicts) {
  const p = path.join(root, "../dict", name + ".json");
  if (!fs.existsSync(p)) continue;
  Object.assign(exact, JSON.parse(fs.readFileSync(p, "utf8")).exact || {});
}
Object.assign(exact, dict.exact);

const dom = new JSDOM("<p>hi</p>", { url: "https://www.proteinatlas.org/" });
const engine = createEngine({
  document: dom.window.document,
  window: dom.window,
  data: { exact, rules: dict.rules, templates: dict.templates },
  site: { scope: "body", block: "pre, code", attrs: [], rescan: [], ...site }
});
engine.start();

/** 属性通道走的正是 translateText（normalize + translate），所以这里测的就是 title tooltip 的真实路径。 */
const tr = (s) => engine.translateText(s);

test("词库结构：新增键无重复、无中文键、2 空格缩进、末尾换行", () => {
  const raw = fs.readFileSync(path.join(root, "../dict/hpa.json"), "utf8");
  assert.ok(raw.endsWith("\n"), "dict/hpa.json 应以换行结尾");
  assert.equal(raw, JSON.stringify(dict, null, 2) + "\n", "dict/hpa.json 应是 2 空格缩进的标准序列化");
  for (const k of Object.keys(dict.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "exact 的键必须是英文原串：" + k);
  }
});

// ---- /humanproteome/brain ----
test("脑蛋白质组：按钮与图注 tooltip", () => {
  assert.equal(tr("Explore the human brain proteome."), "探索人类脑蛋白质组。");
  assert.equal(tr("Spatial transcriptomics - human brain."), "空间转录组学 - 人脑。");
  assert.equal(tr("Learn about the different celltypes in the brain."), "了解脑中的不同细胞类型。");
  assert.equal(
    tr("Spatial distribution of astrocyte marker glia fibrillary acidic protein GFAP transcripts in the white matter and grey matter of the cerebellum"),
    "星形胶质细胞标志物胶质纤维酸性蛋白 GFAP 转录本在小脑白质与灰质中的空间分布"
  );
  assert.equal(
    tr("Spatial distribution of N-terminal EF-hand calcium binding protein 1 (NECAB1) transcripts in the hippocampus and dentate gyrus."),
    "N 端 EF 手型钙结合蛋白 1（NECAB1）转录本在海马与齿状回中的空间分布。"
  );
  assert.equal(
    tr("Immunofluorescent staining of the neuronal specific protein N-terminal EF-hand calcium binding protein 1 (NECAB1) in mouse hippocampus"),
    "小鼠海马中神经元特异性蛋白 N 端 EF 手型钙结合蛋白 1（NECAB1）的免疫荧光染色"
  );
});

test("脑区图例计数（数字保留，只翻类别）", () => {
  assert.equal(tr("1913 elevated in brain"), "1913 在脑中升高");
  assert.equal(tr("3994 elevated in other but expressed in brain"), "3994 在其他组织中升高但在脑中表达");
  assert.equal(tr("9441 low tissue specificity but expressed in brain"), "9441 低组织特异性但在脑中表达");
  assert.equal(tr("3783 not detected in brain"), "3783 在脑中未检出");
  assert.equal(tr("1031 not detected in any tissue"), "1031 在任何组织中均未检出");
});

// ---- 环形图图例：<b>细胞类型/癌种</b><br>类别<br> N genes ----
test("细胞类型与癌种的基因数图例（requireHit：名字没收录就整条不动）", () => {
  assert.equal(tr("<b>Astrocytes</b><br>Cell type enhanced<br> 128 genes"), "<b>星形胶质细胞</b><br>细胞类型增强<br>128 个基因");
  assert.equal(tr("<b>Oligodendrocytes</b><br>Cell type enriched<br> 88 genes"), "<b>少突胶质细胞</b><br>细胞类型富集<br>88 个基因");
  assert.equal(
    tr("<b>Glioblastoma Multiforme</b><br>Cancer enhanced<br> 441 genes"),
    "<b>多形性胶质母细胞瘤</b><br>癌症增强<br>441 个基因"
  );
  assert.equal(tr("<b>Thyroid Carcinoma</b><br>Cancer enriched<br> 45 genes"), "<b>甲状腺癌</b><br>癌症富集<br>45 个基因");
  // 未收录的细胞类型/癌种不硬翻，避免半中半英
  assert.equal(tr("<b>Unknown Cells</b><br>Cell type enhanced<br> 5 genes"), null);
  assert.equal(tr("<b>Made Up Cancer</b><br>Cancer enriched<br> 9 genes"), null);
});

// ---- /humanproteome/cancer 与 /pathology ----
test("癌症图例与预后标签 tooltip", () => {
  assert.equal(tr("Cancer methods"), "癌症方法");
  assert.equal(tr("Subcellular methods"), "亚细胞方法");
  assert.equal(tr("RNA: TCGA"), "RNA：TCGA");
  assert.equal(tr("RNA: TCGA + validation"), "RNA：TCGA + 验证");
  assert.equal(tr("Protein (MS): ProteinTalks DB + CPTAC"), "蛋白质（MS）：ProteinTalks DB + CPTAC");
  assert.equal(tr("Protein (MS): ProteinTalks DB only"), "蛋白质（MS）：仅 ProteinTalks DB");
  assert.equal(tr("IHC: data available"), "IHC：有数据");
  assert.equal(tr("IHC: cholangiocarcinoma, part of liver cancer"), "IHC：胆管癌，属于肝癌的一部分");
  assert.equal(tr("Skin Cutaneous Melanoma<br>Potential prognostic - unfavorable"), "皮肤黑色素瘤<br>潜在预后 - 不良");
  assert.equal(
    tr("Pancreatic Adenocarcinoma<br>Validated prognostic - unfavorable"),
    "胰腺腺癌<br>经验证预后 - 不良"
  );
});

// ---- /about 与 /humanproteome/tissue 的 RNA 特异性图例 ----
test("Group/Tissue enriched 图例的 <br>Detected in ... 尾巴", () => {
  assert.equal(tr("Group enriched (Kidney, Lymphoid tissue)<br>Detected in some"), "组富集（肾脏、淋巴组织）<br>部分检出");
  assert.equal(tr("Tissue enriched (Testis)<br>Detected in single"), "组织富集（睾丸）<br>单一检出");
});

test("新闻页订阅链接", () => {
  assert.equal(tr("Subscribe - RSS"), "订阅 - RSS");
  assert.equal(tr("Subscribe - X"), "订阅 - X");
});

test("原有 tooltip 不被新规则抢走", () => {
  // 脑区环形图的两位形态（"<b>抑制性</b><br>1431 genes" 上就是这样）保持原行为
  assert.equal(tr("Inhibitory<br>1431 genes"), "抑制性<br>1431 个基因");
  // 带 <b> 的同形串原本只翻 genes 尾巴，新规则不该把它抢成别的形态
  assert.equal(tr("<b>Inhibitory</b><br>1431 genes"), "<b>Inhibitory</b><br>1431 个基因");
  // 基因名 + 脑区的图片标题是数据，仍不翻
  assert.equal(tr("GFAP - Cerebellum"), null);
});

// 跨册一致性：本册新增的键若在别的册里也有，必须同值（不同值会被 lint 判冲突）。
test("新增键不与其它册撞不同译法", () => {
  const names = fs.readdirSync(path.join(root, "../dict")).filter((f) => f.endsWith(".json") && f !== "hpa.json");
  const added = [
    "Explore the human brain proteome.",
    "Spatial transcriptomics - human brain.",
    "Learn about the different celltypes in the brain.",
    "Spatial distribution of astrocyte marker glia fibrillary acidic protein GFAP transcripts in the white matter and grey matter of the cerebellum",
    "Spatial distribution of N-terminal EF-hand calcium binding protein 1 (NECAB1) transcripts in the hippocampus and dentate gyrus.",
    "Immunofluorescent staining of the neuronal specific protein N-terminal EF-hand calcium binding protein 1 (NECAB1) in mouse hippocampus",
    "Cancer methods",
    "Subcellular methods",
    "RNA: TCGA",
    "RNA: TCGA + validation",
    "Protein (MS): ProteinTalks DB + CPTAC",
    "Protein (MS): ProteinTalks DB only",
    "IHC: data available",
    "IHC: cholangiocarcinoma, part of liver cancer",
    "Cancer enhanced",
    "Cancer enriched",
    "Potential prognostic - unfavorable",
    "Validated prognostic - unfavorable"
  ];
  for (const name of names) {
    const other = JSON.parse(fs.readFileSync(path.join(root, "../dict", name), "utf8")).exact || {};
    for (const k of added) {
      if (k in other) assert.equal(other[k], dict.exact[k], "跨册同键不同值：" + name + " / " + k);
    }
  }
});
