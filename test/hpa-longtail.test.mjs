// HPA 长尾补译（dict/hpa.json、dict/hpa2.json）：癌症页表头与图表交互、帮助气泡整段模板、
// 亚细胞/脑/细胞系页残留标签、以及三处页面标题规则。附「链接与 href 不被模板抹掉」的保护断言。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/hpa2.json"), "utf8"));
const main = JSON.parse(fs.readFileSync(path.join(root, "../dict/hpa.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "hpa");
assert.ok(site, "config/sites.json 里应有 hpa 站点");

// 生产上按 site.dicts 依次叠加：链接文字由 hpa/common 等册翻成中文，本册只补句子骨架。
function stackData() {
  const data = { exact: {}, rules: [], templates: [] };
  for (const id of site.dicts) {
    let b;
    try {
      b = JSON.parse(fs.readFileSync(path.join(root, "../dict", id + ".json"), "utf8"));
    } catch (e) {
      continue;
    }
    Object.assign(data.exact, b.exact || {});
    data.rules = data.rules.concat(b.rules || []);
    data.templates = data.templates.concat(b.templates || []);
  }
  return data;
}

function mount(html, url = "https://www.proteinatlas.org/ENSG00000141510-TP53/cancer") {
  const dom = new JSDOM(html, { url });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: stackData(),
    site
  });
  engine.start();
  return dom.window.document;
}

const zh = (s) => String(s).replace(/\s+/g, " ").trim();
const body = (doc) => zh(doc.body.textContent);
// 「有没有剩下的英文单词」：≥3 个连续小写字母（mRNA / TCGA / IHC 这类缩写不算）
const hasEnglishWord = (s) => /[a-z]{3,}/.test(s);

// ---------------- 结构校验 ----------------

test("词库结构：条数与三类条目的形态", () => {
  assert.equal(book.meta.family, "hpa");
  assert.ok(book.meta.sites.includes("www.proteinatlas.org"));
  assert.ok(Object.keys(book.exact).length >= 260, "exact 至少 260 条，实际 " + Object.keys(book.exact).length);
  assert.ok(book.rules.length >= 12, "rules 至少 12 条，实际 " + book.rules.length);
  assert.ok(book.templates.length >= 44, "templates 至少 44 条，实际 " + book.templates.length);
});

test("新增 exact 键值卫生：无中文键、译文含中文、非自映射、无 URL/邮箱、无首尾空白", () => {
  const keys = [
    "IMMUNOHISTOCHEMISTRY DATA",
    "PROGNOSTIC SUMMARY",
    "PROTEIN STAINING SUMMARY",
    "CANCER PROTEOME (TUMOR VS ADJACENT NORMAL)",
    "RNA category",
    "Protein cancer category:",
    "Drag to zoom, double-click to reset",
    "Hide points",
    "Without outliers",
    "Toggle channels",
    "View proteome in REACTOME",
    "Please wait until image is loaded before changing channels",
    "Cell lines ordered by organ of phenotypic resemblance.",
    "Niche specificity",
    "Detected in one or more regions but not spatially distinctive in any",
    "Cell line categories"
  ];
  for (const k of keys) {
    const v = book.exact[k];
    assert.equal(typeof v, "string", "缺少键：" + k);
    assert.ok(!/[\u3400-\u9fff]/.test(k), "键里不能有中文：" + k);
    assert.ok(/[\u3400-\u9fff]/.test(v), "译文里必须有中文：" + k);
    assert.notEqual(k, v, "自映射：" + k);
    assert.ok(!/https?:\/\/|[\w.+-]+@[\w-]+\.\w+/.test(v), "译文含 URL/邮箱：" + k);
    assert.equal(k, k.trim(), "键首尾空白：" + JSON.stringify(k));
    assert.equal(v, v.trim(), "译文首尾空白：" + JSON.stringify(k));
  }
});

test("新增模板：pat 不含中文、占位符 1..N 连续且与 zh 一一对应", () => {
  const pats = [
    "Summary of data presented in the {{1}}, with representative images of protein expression in cancer (left) and correlation between mRNA expression and patient survival (right). Images are clickable and redirect to pages with more data.",
    "A summary of RNA categories for human tissues, cell lines and cancer tissues. Categories for {{1}} include tissue enriched, group enriched, tissue enhanced, low tissue specificity and not detected. Categories for {{2}} include detected in single, detected in some, detected in many, detected in all and not detected.",
    "The CAGE method is described in detail {{1}}.",
    "Please refer to the {{1}} of this section for more details."
  ];
  for (const pat of pats) {
    const t = book.templates.find((x) => x.pat === pat);
    assert.ok(t, "缺少模板：" + pat.slice(0, 40));
    assert.ok(!/[\u3400-\u9fff]/.test(t.pat), "pat 不该含中文：" + pat.slice(0, 40));
    const slots = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    const used = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
    assert.deepEqual([...slots].sort((a, b) => a - b), slots, "pat 占位符必须 1..N：" + pat.slice(0, 40));
    assert.deepEqual(used, slots, "zh 占位符要与 pat 一致：" + pat.slice(0, 40));
  }
});

// ---------------- 癌症（cancer）页 ----------------

test("癌症页：区块标题与分类表标签翻成中文", () => {
  const doc = mount(
    "<table><tbody>" +
      "<tr><th><span>IMMUNOHISTOCHEMISTRY DATA</span></th></tr>" +
      "<tr><th><span>PROGNOSTIC SUMMARY</span></th></tr>" +
      "<tr><th><span>PROTEIN STAINING</span></th></tr>" +
      "<tr><th><span>PROTEIN STAINING SUMMARY</span></th></tr>" +
      "<tr><th><span>CANCER PROTEOME (TUMOR VS ADJACENT NORMAL)</span></th></tr>" +
      "<tr><th><span>TUMOR VS ADJACENT NON-TUMOR</span></th></tr>" +
      "<tr><th><span>RNA category</span></th><th><span>Protein category</span></th></tr>" +
      "<tr><td>Consensus (normal tissue):</td><td>低组织特异性</td></tr>" +
      "<tr><td>Cell line (cancer):</td><td>癌症特异性低</td></tr>" +
      "<tr><td>TCGA (cancer):</td><td>ProteinTalks DB (cancer):</td></tr>" +
      "<tr><td>Protein cancer category:</td><td>Reliability score -</td></tr>" +
      "<tr><td>RNA specificity</td><td>RNA distribution</td></tr>" +
      "</tbody></table>"
  );
  const ths = [...doc.querySelectorAll("th")].map((e) => zh(e.textContent));
  assert.deepEqual(ths, [
    "免疫组织化学数据",
    "预后摘要",
    "蛋白质染色",
    "蛋白质染色摘要",
    "癌症蛋白质组（肿瘤与癌旁正常组织）",
    "肿瘤与癌旁非肿瘤组织",
    "RNA 类别",
    "蛋白质类别"
  ]);
  const tds = [...doc.querySelectorAll("td")].map((e) => zh(e.textContent));
  assert.deepEqual(tds, [
    "共识（正常组织）：",
    "低组织特异性",
    "细胞系（癌症）：",
    "癌症特异性低",
    "TCGA（癌症）：",
    "ProteinTalks DB（癌症）：",
    "蛋白质癌症类别：",
    "可靠性评分 -",
    "RNA 特异性",
    "RNA 分布"
  ]);
});

test("癌症页：图表提示与图例按钮（拖动缩放、显示隐藏点/线、离群值）", () => {
  const doc = mount(
    "<div>" +
      "<span>Drag to zoom, double-click to reset</span>" +
      "<button>Hide points</button><button>Show points</button>" +
      "<button>Hide lines</button><button>Show lines</button>" +
      "<label>Without outliers</label><label>With outliers</label>" +
      "<span>Potential prognostic - favorable</span>" +
      "</div>"
  );
  const spans = [...doc.querySelectorAll("span")].map((e) => zh(e.textContent));
  assert.deepEqual(spans, ["拖动可缩放，双击可重置", "潜在预后 - 有利"]);
  assert.deepEqual([...doc.querySelectorAll("button")].map((e) => zh(e.textContent)), [
    "隐藏数据点",
    "显示数据点",
    "隐藏连线",
    "显示连线"
  ]);
  assert.deepEqual([...doc.querySelectorAll("label")].map((e) => zh(e.textContent)), [
    "不含离群值",
    "含离群值"
  ]);
});

test("PROGNOSTIC SUMMARY 帮助气泡两段：整段中文，链接节点与 href 原样保留", () => {
  const doc = mount(
    "<div id=\"help_309\" style=\"display: none\"><div class=\"helpText\">" +
      "<p>Summary of data presented in the <a href=\"/humanproteome/cancer\">Cancer resource</a>, with representative images of protein expression in cancer (left) and correlation between mRNA expression and patient survival (right). Images are clickable and redirect to pages with more data.</p>" +
      "<p>This section contains <a href=\"/humanproteome/cancer/method#how\">mRNA data</a> and <a href=\"/humanproteome/cancer/method#what\">correlation analysis</a> of mRNA expression and patient survival . The protein expression data is derived from antibody-based protein profiling using immunohistochemistry.</p>" +
      "</div></div>"
  );
  const ps = [...doc.querySelectorAll("#help_309 p")];
  assert.equal(ps.length, 2);
  for (const p of ps) {
    const t = zh(p.textContent);
    assert.ok(/[\u3400-\u9fff]/.test(t), "整段应含中文：" + t.slice(0, 40));
    assert.ok(!hasEnglishWord(t), "不该再剩下英文单词：" + t);
  }
  assert.match(zh(ps[0].textContent), /^本页汇总了癌症资源中展示的数据/);
  assert.match(zh(ps[1].textContent), /^本节包含mRNA 数据与相关性分析/);
  const links = [...doc.querySelectorAll("#help_309 a")];
  assert.equal(links.length, 3, "三个链接都不能被模板抹掉");
  assert.equal(links[0].getAttribute("href"), "/humanproteome/cancer");
  assert.equal(links[1].getAttribute("href"), "/humanproteome/cancer/method#how");
  assert.equal(zh(links[1].textContent), "mRNA 数据");
});

test("RNA 类别帮助气泡三段：整段中文，七个链接槽位全部保住", () => {
  const doc = mount(
    "<div id=\"help_126\" style=\"display: none\"><div class=\" helpText\">" +
      "<p>A summary of RNA categories for human tissues, cell lines and cancer tissues. Categories for <a href=\"/a\">RNA specificity</a> include tissue enriched, group enriched, tissue enhanced, low tissue specificity and not detected. Categories for <a href=\"/b\">RNA distribution</a> include detected in single, detected in some, detected in many, detected in all and not detected.</p>" +
      "<p>Human tissue RNA category is based on the <a href=\"/c\">consensus</a> dataset, which is a combination of RNA data from human tissues from three sources: <a href=\"/d\">HPA</a>, <a href=\"/e\">GTEX</a> and <a href=\"/f\">FANTOM5</a>. Cell line RNA category is based on RNA data from <a href=\"/g\">cell lines</a>. More information can be found about the <a href=\"/h\">normalization</a> and <a href=\"/i\">classification</a> of these datasets.</p>" +
      "<p>Cancer tissue RNA category is based on RNA data from the <a href=\"https://cancergenome.nih.gov/\" target=\"_blank\">The Cancer Genome Atlas</a>.</p>" +
      "</div></div>"
  );
  const ps = [...doc.querySelectorAll("#help_126 p")];
  assert.equal(ps.length, 3);
  const texts = ps.map((p) => zh(p.textContent));
  assert.match(texts[0], /^汇总人体组织、细胞系与癌症组织的 RNA 类别。RNA 特异性的类别包括/);
  assert.match(texts[1], /^人类组织 RNA 类别基于共识数据集/);
  assert.match(texts[2], /^癌症组织 RNA 类别基于癌症基因组图谱（TCGA）的 RNA 数据。$/);
  for (const t of texts) assert.ok(!hasEnglishWord(t), "不该再剩下英文单词：" + t);
  const links = [...doc.querySelectorAll("#help_126 a")];
  assert.equal(links.length, 10, "七个槽位 + 三段里的链接都要在");
  assert.equal(links[6].getAttribute("href"), "/g");
  assert.equal(links[9].getAttribute("target"), "_blank");
});

test("PROTEIN STAINING 帮助段：here / histological dictionary 两个链接保留", () => {
  const doc = mount(
    "<div id=\"help_401\" style=\"display: none\"><div class=\" helpText\">" +
      "<p>Antibody staining in 20 different cancers is summarized by a selection of four standard cancer tissue samples representative of the overall staining pattern. From left: colorectal cancer, breast cancer, prostate cancer and lung cancer. An additional fifth image can be added as a complement. The assay and annotation is described <a href=\"/humanproteome/tissue/method/ih+imaging#ih\">here</a>. Note that samples used for immunohistochemistry by the Human Protein Atlas do not correspond to samples in the TCGA dataset. For histological reference, visit the <a href=\"/learn/dictionary/pathology\">histological dictionary</a>.</p>" +
      "</div></div>"
  );
  const p = doc.querySelector("#help_401 p");
  const t = zh(p.textContent);
  assert.match(t, /^20 种癌症中的抗体染色/);
  assert.ok(!hasEnglishWord(t), "不该再剩下英文单词：" + t);
  const links = [...doc.querySelectorAll("#help_401 a")];
  assert.equal(links.length, 2);
  assert.equal(zh(links[0].textContent), "此处");
  assert.equal(zh(links[1].textContent), "组织学词典");
  assert.equal(links[1].getAttribute("href"), "/learn/dictionary/pathology");
});

// ---------------- 其余页面里被链接切碎的句子 ----------------

test("亚细胞页：分析所用细胞系一句整段中文，链接保留", () => {
  const doc = mount(
    "<div><p>Cell line used for analysis. Read more about the <a href=\"/learn/cellines\">cell lines</a> in the Human Protein Atlas.</p></div>",
    "https://www.proteinatlas.org/ENSG00000141510-TP53/subcellular"
  );
  const p = doc.querySelector("p");
  const t = zh(p.textContent);
  assert.ok(!hasEnglishWord(t), "不该再剩下英文单词：" + t);
  assert.ok(/[\u3400-\u9fff]/.test(t));
  assert.equal(doc.querySelectorAll("p a").length, 1);
});

test("脑页：CAGE 方法句与未整理脑数据句都整段中文", () => {
  const doc = mount(
    "<div><p>The CAGE method is described in detail <a href=\"/fantom\">here</a>.</p>" +
      // 页面上的链接文字是 "tissue atlas"（由 hpa 册译成「组织图谱」），href 指向 tissue 页
      "<p>Non curated brain data available in the <a href=\"/ENSG00000141510-TP53/tissue\">tissue atlas</a>.</p></div>",
    "https://www.proteinatlas.org/ENSG00000141510-TP53/brain"
  );
  const ps = [...doc.querySelectorAll("p")].map((e) => zh(e.textContent));
  assert.equal(ps[0], "CAGE 方法的详细说明见此处。");
  assert.equal(ps[1], "组织图谱中提供未经整理的脑数据。");
  assert.equal(doc.querySelectorAll("p a").length, 2);
});

test("细胞系页：Please refer to the … of this section 整段中文", () => {
  const doc = mount(
    "<div><p>Please refer to the <a href=\"/humanproteome/cell+line/method\">method</a> of this section for more details.</p></div>",
    "https://www.proteinatlas.org/ENSG00000141510-TP53/cell+line"
  );
  const t = zh(doc.querySelector("p").textContent);
  assert.equal(t, "更多细节请参阅本节的方法。");
  assert.equal(doc.querySelector("p a").getAttribute("href"), "/humanproteome/cell+line/method");
});

// ---------------- 亚细胞 / 脑 / 细胞系页的残留标签 ----------------

test("亚细胞页：通道切换、缩略图与细胞系排序说明", () => {
  const doc = mount(
    "<div><button>Toggle channels</button><span>Compare selected</span><span>Target protein</span>" +
      "<a href=\"#\">View proteome in REACTOME</a><span>Thumbnail 10x</span><span>Thumbnail 40x</span>" +
      "<p>Please wait until image is loaded before changing channels</p>" +
      "<p>Cell lines ordered by organ of phenotypic resemblance.</p>" +
      "<p>Cell lines in alphabetically order.</p>" +
      "<span>siRNA VALIDATION</span><span>Subcellular proteome</span></div>",
    "https://www.proteinatlas.org/ENSG00000141510-TP53/subcellular"
  );
  assert.equal(zh(doc.querySelector("button").textContent), "切换通道");
  const spans = [...doc.querySelectorAll("span")].map((e) => zh(e.textContent));
  assert.deepEqual(spans, ["比较所选", "目标蛋白", "缩略图 10x", "缩略图 40x", "siRNA 验证", "亚细胞蛋白质组"]);
  assert.equal(zh(doc.querySelector("a").textContent), "在 Reactome 中查看蛋白质组");
  const ps = [...doc.querySelectorAll("p")].map((e) => zh(e.textContent));
  assert.deepEqual(ps, [
    "请等待图像加载完成后再切换通道",
    "细胞系按表型相似器官排序。",
    "细胞系按字母顺序排列。"
  ]);
});

test("脑页：区域/脑域特异性表头与微环境标签", () => {
  const doc = mount(
    "<div><span>Regional specificity</span><span>Domain specificity</span>" +
      "<span>Regional distribution</span><span>Niche specificity</span><span>Highest nCPM</span>" +
      "<table><tbody><tr><td>Detected in one or more regions but not spatially distinctive in any</td></tr>" +
      "<tr><td>Low niche specificity in all niches.</td></tr></tbody></table>" +
      "<span>Human gene name</span></div>",
    "https://www.proteinatlas.org/ENSG00000141510-TP53/brain"
  );
  assert.deepEqual([...doc.querySelectorAll("span")].map((e) => zh(e.textContent)), [
    "脑区特异性",
    "脑域特异性",
    "脑区分布",
    "微环境特异性",
    "最高 nCPM",
    "人类基因名"
  ]);
  assert.deepEqual([...doc.querySelectorAll("td")].map((e) => zh(e.textContent)), [
    "在一个或多个脑区检出，但在任一处都不具空间特异性",
    "各微环境的微环境特异性均低。"
  ]);
});

test("细胞系页：分组标题与分布表头", () => {
  const doc = mount(
    "<div><span>CELL LINE GROUPS</span><span>COMMON CELL LINES</span><span>CELL LINE DATA</span>" +
      "<span>Cell line categories</span><span>Cell line distribution</span><span>Human cell lines</span></div>",
    "https://www.proteinatlas.org/ENSG00000141510-TP53/cell+line"
  );
  assert.deepEqual([...doc.querySelectorAll("span")].map((e) => zh(e.textContent)), [
    "细胞系分组",
    "常见细胞系",
    "细胞系数据",
    "细胞系类别",
    "细胞系分布",
    "人类细胞系"
  ]);
});

// ---------------- 标题与规则 ----------------

// 检索页标题（"Search: TP53 - The Human Protein Atlas"）翻不全，是引擎 titleBySegments 的
// 已知限制：它先按 ": " 切段、召回 common 册的 "Search"→检索，拼出的 "检索：TP53 - The Human
// Protein Atlas" 又被 keptOk 放行（TP53 带数字 ⇒ 同段内的 The/Human/Protein/Atlas 一律算可保留），
// 于是整条标题规则永远轮不到。要修得动 src/engine.js（本子任务范围外）或 common 册（别人的册）。
test("标题：脑组织表达页的 <title> 翻成中文（不再半中半英）", () => {
  const brain = mount("<title>Brain tissue expression of TP53 - Summary - The Human Protein Atlas</title><body></body>");
  assert.equal(brain.title, "脑组织表达 - TP53 - 摘要 - 人类蛋白质图谱");
  const brain2 = mount("<title>Brain tissue expression of TP53 - The Human Protein Atlas</title><body></body>");
  assert.equal(brain2.title, "脑组织表达 - TP53 - 人类蛋白质图谱");
});

test("规则：Non-significant (p<…) 与「是以下癌症的预后标志物」", () => {
  const doc = mount(
    "<div><span>Non-significant (p<7e-4)</span><span>Non-significant (p<0.05)</span>" +
      "<p>TP53 is a prognostic marker in:</p></div>",
    "https://www.proteinatlas.org/ENSG00000141510-TP53/cancer"
  );
  assert.deepEqual([...doc.querySelectorAll("span")].map((e) => zh(e.textContent)), [
    "不显著（p<7e-4）",
    "不显著（p<0.05）"
  ]);
  assert.equal(zh(doc.querySelector("p").textContent), "TP53 是以下癌症的预后标志物：");
});

test("数据不动：癌症类型与基因名保持原样（不做词条级误翻）", () => {
  const doc = mount(
    "<div><span>Breast cancer (BRCA)</span><span>Glioblastoma</span>" +
      "<span>Tumor protein p53</span><span>ENSG00000141510.19</span></div>",
    "https://www.proteinatlas.org/ENSG00000141510-TP53/cancer"
  );
  const spans = [...doc.querySelectorAll("span")].map((e) => zh(e.textContent));
  assert.equal(spans[1], "Glioblastoma", "癌症类型名不在本批词条里，应保持英文");
  assert.equal(spans[2], "Tumor protein p53", "蛋白全名是专有名词，保持英文");
  assert.equal(spans[3], "ENSG00000141510.19", "Ensembl ID 必须原样");
});
