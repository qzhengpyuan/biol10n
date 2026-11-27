// TIMER3（compbio.cn/timer3）界面补译：站级名单滤掉 3177 条数据后，页面仍剩 30 条英文。
// 逐条判过之后只有 3 条是界面文案，其余是论文题录、作者名、数据集标签、术语与英文正文句：
//   - 界面文案：导航按钮 sCNA（→ 拷贝数改变）、引用句连接词 with（→ 及）、and（→ 和）；
//   - 数据/正文：Cui et al. … / Nucleic Acids Research / 2025;53(W1)… / Hao Cui: / LGG_E_MTAB_6270 /
//     GO:BP / immunedeconv 与各工具名 / ", respectively." —— 一律不进词库。
// 词条必须按真实 DOM 节点边界写：引用句被 <a> 切碎，with / and 各自是独立文本节点；
// 导航按钮 sCNA 是 <button> 里唯一的文本节点。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();

const timer = JSON.parse(fs.readFileSync(path.join(root, "../dict/timer.json"), "utf8"));
const common = JSON.parse(fs.readFileSync(path.join(root, "../dict/common.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8"));
const timerSite = sites.sites.find((s) => s.id === "timer2");

const SITE = { scope: "body", block: "pre, code", attrs: [] };
const DATA = {
  exact: { ...common.exact, ...timer.exact },
  rules: [...(common.rules || []), ...(timer.rules || [])],
  templates: []
};

function boot(html) {
  const dom = new JSDOM("<body>" + html + "</body>", { url: "https://compbio.cn/timer3/" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data: DATA, site: SITE });
  engine.scan();
  return dom.window.document;
}

test("timer 册收了三条界面文案，且都是整节点可命中的短键", () => {
  assert.equal(timer.exact["sCNA"], "拷贝数改变");
  assert.equal(timer.exact["with"], "及");
  assert.equal(timer.exact["and"], "和");
});

test("sCNA 导航按钮翻成「拷贝数改变」（真实页面上 15 个按钮里只有它还是英文）", () => {
  const doc = boot('<div class="box-body"><button class="btn btn-default action-button" id="nav_Immune_sCNA" type="button">sCNA</button></div>');
  assert.equal(doc.getElementById("nav_Immune_sCNA").textContent, "拷贝数改变");
});

test("sCNA 只在整节点命中时翻，长句里的 sCNA 原样（不碰数据/正文）", () => {
  const doc = boot('<div role="main"><p>sCNA (somatic copy number alterations) Module allows a user to compare immune infiltration distribution.</p></div>');
  assert.match(doc.querySelector("p").textContent, /^sCNA \(somatic copy number alterations\)/);
});

test("引用句里的 with / and 按节点边界翻成 及 / 和，链接与工具名不动", () => {
  // 真实 DOM：<li> 的文本节点与 <a> 交替出现，with / and 各自是一个独立文本节点。
  const html = [
    "<ul><li>",
    "若使用本估计结果，人类数据请一并引用 ",
    '<a href="https://doi.org/10.1093/bioinformatics/btz363">immunedeconv</a>',
    " with ",
    '<a href="https://doi.org/10.1186/s13059-016-1028-7">TIMER, </a>',
    '<a href="https://doi.org/10.1038/nmeth.3337">CIBERSORT, </a>',
    '<a href="https://doi.org/10.1002/advs.201902880">ImmuCellAI</a>',
    " and ",
    '<a href="https://doi.org/10.1186/s13059-017-1349-1">ConsensusTME</a>',
    " 等方法。",
    "</li></ul>"
  ].join("");
  const doc = boot(html);
  const li = doc.querySelector("li");
  const txt = li.textContent;
  assert.match(txt, /immunedeconv 及 TIMER, /, "with → 及");
  assert.match(txt, /ImmuCellAI 和 ConsensusTME/, "and → 和");
  assert.ok(!/\bwith\b/.test(txt), "不能残留 with");
  assert.ok(!/\band\b/.test(txt), "不能残留 and");
  const links = [...li.querySelectorAll("a")].map((a) => a.textContent);
  assert.deepEqual(links, ["immunedeconv", "TIMER, ", "CIBERSORT, ", "ImmuCellAI", "ConsensusTME"], "工具名与链接原样保留");
});

test("论文题录 / 作者名 / 数据集标签 / 术语都留英文（数据值不进词库）", () => {
  const html = [
    '<aside><p>Hao Cui: <a href="mailto:a@b.c">a@b.c</a></p>',
    "<p>Cui et al. TIMER3: an enhanced resource for tumor immune analysis. <strong><em>Nucleic Acids Research</em></strong> 2025;53(W1):W534-W541.</p></aside>",
    '<div class="option" data-selectable data-value="LGG_E_MTAB_6270">LGG_E_MTAB_6270</div>',
    '<label class="radio-inline"><span>GO:BP</span></label>'
  ].join("");
  const doc = boot(html);
  assert.equal(doc.querySelector("aside p").textContent, "Hao Cui: a@b.c");
  assert.match(doc.querySelectorAll("aside p")[1].textContent, /^Cui et al\. TIMER3: an enhanced resource/);
  assert.equal(doc.querySelector(".option").textContent, "LGG_E_MTAB_6270");
  assert.equal(doc.querySelector("label span").textContent, "GO:BP");

  // 词库侧同时钉住「这些形状不该有词条」：有词条就会在别的语境里被翻掉。
  for (const key of ["GO:BP", "LGG_E_MTAB_6270", "Nucleic Acids Research", "Hao Cui:", "immunedeconv", ", respectively."]) {
    assert.equal(timer.exact[key], undefined, "数据串不该进 timer 词库：" + key);
  }
});

test("Instruction: 词条在册；站级 proseExempt 把 sCNA 页签的块首标签放行", () => {
  assert.equal(timer.exact["Instruction:"], "说明：");
  // 短块：没有任何正文语境，标签照翻。
  const shortDoc = boot('<div class="col-sm-8"><strong>Instruction:</strong> sCNA 模块</div>');
  assert.equal(shortDoc.querySelector("strong").textContent, "说明：");
  // 真实页的 sCNA 页签：块里是 >120 字的中文说明，且标签后紧跟以 sCNA 开头的句子，
  // 引擎本来把它当「句中的强调徽标」挡掉；站级 proseExempt 是 div[role=main] > strong，
  // 只有裸标签选择器（引擎对无属性元素也试匹配）才放得行。
  const longZh = "sCNA（体细胞拷贝数改变）模块允许用户按基因的 sCNA 状态比较 TCGA 各癌症类型中的免疫浸润分布。" +
    "GISTIC2.0 在基因水平从拷贝数分段图谱中估计 sCNA 信息，包括深度缺失、臂级缺失、二倍体/正常、臂级获得和高扩增。" +
    "给定输入基因后，TIMER3 会显示堆叠柱状图，展示该基因在所有 TCGA 癌症类型中不同 sCNA 状态的相对比例。";
  const longDoc = boot('<div class="col-sm-8" role="main"><br><strong>Instruction:</strong> ' + longZh + "</div>");
  assert.equal(longDoc.querySelector("strong").textContent, "Instruction:", "不带 proseExempt 的站点仍按正文保护挡住");
  // 带上站级 proseExempt（与 config/sites.json 一致）：同一条长块能翻。
  assert.equal(timerSite.proseExempt, "div[role=main] > strong", "站点配置的 proseExempt 被改了？");
  const dom = new JSDOM('<body><div class="col-sm-8" role="main"><br><strong>Instruction:</strong> ' + longZh + "</div></body>", {
    url: "https://compbio.cn/timer3/"
  });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: DATA,
    site: { ...SITE, proseExempt: timerSite.proseExempt }
  });
  engine.scan();
  assert.equal(dom.window.document.querySelector("strong").textContent, "说明：", "站级 proseExempt 应放行块首 strong");
  engine.disable();
  dom.window.close();
});

test("with / and / sCNA 在别的册里没有不同译法（跨册卫生）", () => {
  const dir = path.join(root, "../dict");
  const owners = {};
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    for (const k of ["with", "and", "sCNA"]) {
      if (d.exact && Object.prototype.hasOwnProperty.call(d.exact, k)) (owners[k] = owners[k] || []).push(f + "=" + d.exact[k]);
    }
  }
  assert.deepEqual(owners["sCNA"], ["timer.json=拷贝数改变"], "sCNA 只在本册定义");
  for (const v of owners["with"] || []) assert.ok(v.endsWith("=及"), "with 只能译「及」：" + v);
  for (const v of owners["and"] || []) assert.ok(v.endsWith("=和"), "and 只能译「和」：" + v);
});

test("站级名单仍把数据集标签/基因符号挡在清单外，且不吃界面词", () => {
  const rules = (timerSite.missNoise || []).map((n) => {
    const low = n.toLowerCase();
    if (low.startsWith("rec:")) return { re: new RegExp(n.slice(4)), cs: true };
    if (low.startsWith("re:")) return { re: new RegExp(n.slice(3), "i") };
    return { sub: low };
  });
  const hit = (t) => rules.some((r) => (r.re ? r.re.test(r.cs ? t : t.toLowerCase()) : t.toLowerCase().includes(r.sub)));
  assert.ok(hit("TP53") && hit("Melanoma_Nathanson_2017"), "基因符号与数据集标签仍在名单里");
  for (const s of ["搜索", "Search", "拷贝数改变", "说明：", "基因", "突变", "结局"]) assert.ok(!hit(s), "界面词不该被名单吃掉：" + s);
});