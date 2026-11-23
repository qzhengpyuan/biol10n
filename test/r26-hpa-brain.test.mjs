// HPA 脑资源剩余界面文案（r26）：OPTGROUP 分组名、4 条说明段、附加信息整段模板、
// 脑区图小节标题与环形图图例。英文原串全部取自真实 DOM（原始 HTML 或未翻译的 text 节点）。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/hpa.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "hpa");
assert.ok(site, "config/sites.json 里应有 hpa 站点");

// 生产上 hpa 与 common / anatomy / onco 等册一起加载：这里按站点 dicts 顺序合并，再叠加本册。
const exact = {};
for (const name of site.dicts) {
  const p = path.join(root, "../dict", name + ".json");
  if (!fs.existsSync(p)) continue;
  Object.assign(exact, JSON.parse(fs.readFileSync(p, "utf8")).exact || {});
}
Object.assign(exact, dict.exact);

function boot(html = "<p>hi</p>") {
  const dom = new JSDOM(html, { url: "https://www.proteinatlas.org/humanproteome/brain" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact, rules: dict.rules, templates: dict.templates },
    site: { scope: "body", block: "pre, code", attrs: [], rescan: [], ...site }
  });
  return { dom, engine, doc: dom.window.document };
}

const tr = (s) => boot().engine.translateText(s);

// ---- 词库结构 ----
test("r26 词库：标准序列化、末尾换行、新增键无重复", () => {
  const raw = fs.readFileSync(path.join(root, "../dict/hpa.json"), "utf8");
  assert.ok(raw.endsWith("\n"), "dict/hpa.json 应以换行结尾");
  assert.equal(raw, JSON.stringify(dict, null, 2) + "\n", "dict/hpa.json 应是 2 空格缩进的标准序列化");
  for (const k of Object.keys(dict.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "exact 的键必须是英文原串：" + k);
  }
});

// ---- 1) OPTGROUP 分组名（/humanproteome/brain 与 /humanproteome/single+cell 的全局检索下拉） ----
test("OPTGROUP 分组名：GENE INFO / ANTIBODY VALIDATION / EXTRA", () => {
  assert.equal(tr("GENE INFO"), "基因信息");
  assert.equal(tr("ANTIBODY VALIDATION"), "抗体验证");
  assert.equal(tr("EXTRA"), "更多");
});

test("OPTGROUP label 属性通道：分组名翻、选项提交值不动", () => {
  const { engine, doc } = boot(
    '<select id="q"><optgroup label="GENE INFO"><option value="g">Gene name</option></optgroup>' +
      '<optgroup label="ANTIBODY VALIDATION"><option value="ihc">IHC</option></optgroup>' +
      '<optgroup label="EXTRA"><option value="sort">Sort by</option></optgroup></select>'
  );
  engine.scan();
  const labels = [...doc.querySelectorAll("optgroup")].map((g) => g.getAttribute("label"));
  assert.deepEqual(labels, ["基因信息", "抗体验证", "更多"]);
  const values = [...doc.querySelectorAll("option")].map((o) => o.getAttribute("value"));
  assert.deepEqual(values, ["g", "ihc", "sort"]);
});

// ---- 2) /humanproteome/brain 的 4 条说明段 ----
const P1 = "The Brain Atlas includes data from different regions of the brain, illustrated with a specific color throughout the brain atlas illustrations.";
const P2 = "Each symbol and region name is clickable and will redirect to the selected regional summary page.";
const P3 = "This paragraph provides an overview of proteins elevated in brain from a whole body perspective and proteins elevated in regions of the brain from a whole brain perspective.";
const P4 = "Further details about each brain region are available on the respective regional summary pages, while additional information and illustrative examples of regional and spatial gene expression patterns are presented below.";

test("脑资源 4 条说明段（整段文本通道）", () => {
  assert.equal(tr(P1), "脑图谱包含来自不同脑区的数据，在整套脑图谱插图中以特定颜色标示。");
  assert.equal(tr(P2), "每个符号与脑区名称均可点击，会跳转到所选区域的摘要页。");
  assert.equal(tr(P3), "本段概述两类蛋白质：从全身视角看在脑中表达升高的蛋白质，以及从全脑视角看在各脑区中表达升高的蛋白质。");
  assert.equal(tr(P4), "各脑区的更多细节见相应区域摘要页；区域与空间基因表达模式的补充信息与示例见下文。");
});

test("4 条说明段在真实 <p> 结构里整段替换", () => {
  const { engine, doc } = boot(
    '<div class="helpText"><p>' + P1 + '</p><p>' + P2 + "</p></div>" + '<div class="helpText"><p>' + P3 + "</p></div>" + "<div><p>" + P4 + "</p></div>"
  );
  engine.scan();
  const paras = [...doc.querySelectorAll("p")].map((p) => p.textContent);
  assert.deepEqual(paras, [
    "脑图谱包含来自不同脑区的数据，在整套脑图谱插图中以特定颜色标示。",
    "每个符号与脑区名称均可点击，会跳转到所选区域的摘要页。",
    "本段概述两类蛋白质：从全身视角看在脑中表达升高的蛋白质，以及从全脑视角看在各脑区中表达升高的蛋白质。",
    "各脑区的更多细节见相应区域摘要页；区域与空间基因表达模式的补充信息与示例见下文。"
  ]);
});

// ---- 附加信息整段：三条链接要留在原位，不能被整段纯文本替换抹掉 ----
const ADD_HTML =
  '<div class="learnbody"><p>In addition to the data provided in the brain resource there is also data on ' +
  '<a href="/humanproteome/tissue/retina"><strong>human retina</strong></a>, the ' +
  '<a href="/humanproteome/evolutionary"><strong>evolutionary resource</strong></a> includes the regional brain comparison across different mammalian species, and the ' +
  '<a href="/humanproteome/single+cell"><strong>single cell resource</strong></a> includes expression profiles for a selection of neuronal and non-neuronal cell-types of the central nervous system. </p></div>';

test("附加信息段：模板通道保留三条链接并整段成中文", () => {
  const { engine, doc } = boot(ADD_HTML);
  engine.scan();
  const p = doc.querySelector(".learnbody p");
  assert.equal(
    p.textContent.replace(/\s+/g, " ").trim(),
    "除了脑资源提供的数据之外，还有以下数据：人视网膜；进化资源涵盖不同哺乳动物物种间的脑区比较，单细胞资源则提供中枢神经系统部分神经元与非神经元细胞类型的表达谱。"
  );
  const links = [...p.querySelectorAll("a")];
  assert.equal(links.length, 3, "三条链接必须在译文里原位保留");
  assert.deepEqual(links.map((a) => a.getAttribute("href")), [
    "/humanproteome/tissue/retina",
    "/humanproteome/evolutionary",
    "/humanproteome/single+cell"
  ]);
  // 关闭后必须还原成原始英文与原始链接结构
  engine.disable();
  assert.ok(p.textContent.includes("human retina"));
  assert.ok(p.textContent.includes("single cell resource"));
});

// ---- 3) 该页其余英文界面段：小节标题、图例、区块标题 ----
test("脑资源小节标题与区块标题", () => {
  assert.equal(tr("Regional expression in the mammalian brain and mouse immunofluorescence protein profiles"), "哺乳动物脑的区域表达与小鼠免疫荧光蛋白质谱");
  assert.equal(tr("THE BRAIN"), "人脑");
  assert.equal(tr("BRAIN REGIONS"), "脑区");
  assert.equal(tr("BRAIN SUMMARY"), "脑摘要");
  assert.equal(tr("BRAIN EXPRESSION"), "脑表达");
});

test("SVG 环形图图例", () => {
  assert.equal(tr("Elevated in brain"), "在脑中升高");
  assert.equal(tr("Elevated in other but expressed in brain"), "在其他组织升高但在脑中表达");
  assert.equal(tr("Low tissue specificity but expressed in brain"), "低组织特异性但在脑中表达");
  assert.equal(tr("Not detected in brain"), "脑中未检出");
  assert.equal(tr("Not detected in any tissue"), "任何组织中均未检出");
});

test("SVG <text> 图例走 graph 通道（tspan 拆词也要成句）", () => {
  const { engine, doc } = boot(
    '<svg><text><tspan>Elevated in </tspan><tspan>brain</tspan></text><text>Not detected in any tissue</text></svg>'
  );
  engine.scan();
  const texts = [...doc.querySelectorAll("svg text")].map((t) => t.textContent.replace(/\s+/g, " ").trim());
  assert.ok(texts[0].includes("在脑中升高"), "tspan 拆词后应成中文：" + texts[0]);
  assert.equal(texts[1], "任何组织中均未检出");
});

// 该资源页的 Methods Summary 句是「in this resource」变体（词库里原有的是「in the resource」），
// 链接把句子切成「…on the」+ <a>Methods Summary</a>，逐节点翻完应是完整中文。
test("Methods Summary 句（含链接）逐节点合成完整中文", () => {
  const { engine, doc } = boot(
    '<p>More information about the specific content and the generation and analysis of the data in this resource can be found on the ' +
      '<a href="/humanproteome/brain/method">Methods Summary</a>.</p>'
  );
  engine.scan();
  const p = doc.querySelector("p");
  assert.equal(p.textContent.replace(/\s+/g, " ").trim(), "有关该资源的具体内容以及数据生成与分析方法的更多信息，见方法摘要。");
  assert.equal(p.querySelector("a").getAttribute("href"), "/humanproteome/brain/method");
});
