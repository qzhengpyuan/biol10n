// HPA（hpa2 册）回归：癌症/亚细胞/帮助页补译与图表 tooltip 规则，附「数据不动」保护
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
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;

// config/sites.json 里没有 hpa 条目时用等价定义兜底（正式条目存在则用真实配置）
const site = sites.find((s) => s.id === "hpa") || {
  id: "hpa",
  hosts: ["www.proteinatlas.org"],
  dicts: ["common", "hpa", "anatomy", "onco", "hpa2", "fill-r19"],
  scope: "body"
};

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

function run(html) {
  const dom = new JSDOM("<body>" + html + "</body>");
  const engine = createEngine({ document: dom.window.document, window: dom.window, data: stackData(), site });
  engine.start();
  return dom.window.document;
}

test("词库结构：条数、键值形态、rules/templates 形状与槽位连续性", () => {
  assert.equal(book.meta.family, "hpa");
  assert.ok(book.meta.sites.includes("www.proteinatlas.org"));
  assert.ok(Object.keys(book.exact).length >= 170, "exact 至少 170 条");
  assert.ok(book.rules.length >= 10, "rules 至少 10 条");
  assert.ok(book.templates.length >= 30, "templates 至少 30 条");

  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "键里不能有中文: " + k);
    assert.ok(/[\u4e00-\u9fff]/.test(v), "译文里必须有中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "键首尾不能有空白: " + JSON.stringify(k));
    assert.equal(v, v.trim(), "译文首尾不能有空白: " + JSON.stringify(k));
  }
  for (const r of book.rules) {
    assert.equal(typeof r, "object", "rules 必须是对象");
    assert.ok(!Array.isArray(r), "rules 不能写成数组: " + JSON.stringify(r));
    assert.equal(typeof r.re, "string");
    assert.equal(typeof r.to, "string");
    assert.ok(new RegExp(r.re).source.length > 0);
    assert.ok(/[\u4e00-\u9fff]/.test(r.to), "规则译文里必须有中文: " + r.re);
  }
  for (const t of book.templates) {
    assert.equal(typeof t, "object", "templates 必须是对象");
    assert.ok(!Array.isArray(t), "templates 不能写成数组");
    assert.equal(typeof t.pat, "string");
    assert.equal(typeof t.zh, "string");
    assert.ok(/[\u4e00-\u9fff]/.test(t.zh), "模板译文里必须有中文: " + t.pat);
    const used = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.ok(used.length >= 1, "模板要带槽位: " + t.pat);
    used.slice().sort((a, b) => a - b).forEach((n, i) => assert.equal(n, i + 1, "槽位必须从 1 连续: " + t.pat));
    const zhUsed = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.deepEqual(zhUsed.slice().sort((a, b) => a - b), used.slice().sort((a, b) => a - b), "译文槽位要与原文一致");
  }
});

test("癌症页：区块标题与图表标签", () => {
  const doc = run(
    "<h2>THE CANCER PROTEOMES</h2><h2>HUMAN CANCER</h2>" +
      "<h3>Hallmarks of cancer</h3><h3>Cancer statistics</h3>" +
      "<span>PROGNOSTIC AND DIFFERENTIALLY ABUNDANT GENES</span>" +
      "<span>Prognostic genes (TCGA)</span><span>Differential abundance (MS)</span>" +
      "<span>TCGA dataset</span><span>(Transcriptomics)</span><span>(Mass spectrometry)</span>" +
      "<span>(Immunohistochemistry)</span><span>TCGA only</span><span>TCGA + validation</span>"
  );
  assert.deepEqual([...doc.querySelectorAll("h2")].map((e) => e.textContent), ["癌症蛋白质组", "人类癌症"]);
  assert.deepEqual([...doc.querySelectorAll("h3")].map((e) => e.textContent), ["癌症标志", "癌症统计"]);
  const spans = [...doc.querySelectorAll("span")].map((e) => e.textContent);
  assert.deepEqual(spans, [
    "预后与差异丰度基因",
    "预后基因（TCGA）",
    "差异丰度（MS）",
    "TCGA 数据集",
    "（转录组学）",
    "（质谱）",
    "（免疫组织化学）",
    "仅 TCGA",
    "TCGA + 验证"
  ]);
});

test("癌症页：癌症类型与性别枚举", () => {
  const doc = run(
    "<ul><li>Stomach cancer</li><li>Renal cancer</li><li>Urothelial cancer</li>" +
      "<li>Thymic cancer</li><li>Biliary tract cancer</li><li>Fallopian tube cancer</li>" +
      "<li>Liver and biliary tract</li><li>Head and neck</li><li>Male</li><li>Female</li></ul>"
  );
  assert.deepEqual([...doc.querySelectorAll("li")].map((e) => e.textContent), [
    "胃癌",
    "肾癌",
    "尿路上皮癌",
    "胸腺癌",
    "胆道癌",
    "输卵管癌",
    "肝脏与胆道",
    "头颈部",
    "男性",
    "女性"
  ]);
});

test("癌症页：三段固定说明整段替换（保留 TCGA/Kaplan-Meier 等专名）", () => {
  const doc = run(
    "<p>RNA-seq data from 21 cancer types, generated by The Cancer Genome Atlas (TCGA) and downloaded and processed by the HPA. Genes are classified based on pTPM levels across the 21 cancer types.</p>" +
      "<p>The cancer proteome pages are organized according to normal tissue of origin and each page can be accessed by clicking on a cancer type name or symbol in the figure below. A gene is considered prognostic if correlation analysis of gene expression and clinical outcome resulted in Kaplan-Meier plots with high significance (p&lt;0.001).</p>" +
      "<p>Correlation analysis resulted in more than 10000 prognostic genes. The number of prognostic genes with regard to cancer type and association with the favorable or unfavorable clinical outcome are summarized in the interactive chart below.</p>"
  );
  const ps = [...doc.querySelectorAll("p")].map((e) => e.textContent);
  assert.ok(ps[0].startsWith("由癌症基因组图谱（TCGA）生成"), ps[0]);
  assert.ok(ps[0].endsWith("基因依据其在 21 种癌症类型中的 pTPM 水平分类。"), ps[0]);
  assert.ok(ps[1].startsWith("癌症蛋白质组页面按正常起源组织编排"), ps[1]);
  assert.ok(ps[1].includes("Kaplan-Meier 曲线"), ps[1]);
  assert.ok(ps[1].endsWith("则该基因被视为预后相关基因。"), ps[1]);
  assert.equal(ps[2], "相关性分析得到超过 10000 个预后基因。下图以交互式图表汇总了各癌症类型中与预后良好或预后不良相关的预后基因数量。");
});

test("癌症页：预后图表 tooltip（潜在/已验证 × 有利/不利）", () => {
  const doc = run(
    "<svg>" +
      "<rect title=\"Lung adenocarcinoma, unfavorable - potential prognostic genes: 847\"></rect>" +
      "<rect title=\"Liver hepatocellular carcinoma, unfavorable - validated prognostic genes: 939\"></rect>" +
      "<rect title=\"Kidney renal clear cell carcinoma, favorable - potential prognostic genes: 4791\"></rect>" +
      "<rect title=\"Breast invasive carcinoma, favorable - validated prognostic genes: 5\"></rect>" +
      "</svg>"
  );
  assert.deepEqual([...doc.querySelectorAll("rect")].map((e) => e.getAttribute("title")), [
    "肺腺癌：预后不良的潜在预后基因 847 个",
    "肝细胞癌：预后不良的已验证预后基因 939 个",
    "肾透明细胞癌：预后良好的潜在预后基因 4791 个",
    "乳腺浸润性癌：预后良好的已验证预后基因 5 个"
  ]);
});

test("癌症页：质谱图表 tooltip（上/下调、both CPTAC、CPTAC 单列）", () => {
  const doc = run(
    "<svg>" +
      "<rect title=\"Glioblastoma multiforme, downregulated in ProteinTalks DB: 496\"></rect>" +
      "<rect title=\"Tongue carcinoma, upregulated in ProteinTalks DB: 1705\"></rect>" +
      "<rect title=\"Laryngeal carcinoma, downregulated in both ProteinTalks DB and CPTAC (Head and Neck Squamous Cell Carcinoma): 281\"></rect>" +
      "<rect title=\"Renal cell carcinoma (CPTAC), upregulated: 1101\"></rect>" +
      "</svg>"
  );
  assert.deepEqual([...doc.querySelectorAll("rect")].map((e) => e.getAttribute("title")), [
    "多形性胶质母细胞瘤：在 ProteinTalks DB 中下调 496 个",
    "舌癌：在 ProteinTalks DB 中上调 1705 个",
    "喉癌：在 ProteinTalks DB 与 CPTAC 中均下调 281 个（对应头颈部鳞状细胞癌）",
    "肾细胞癌（CPTAC）：上调 1101 个"
  ]);
});

test("亚细胞页：细胞器与资源标签", () => {
  const doc = run(
    "<p>Nucleus</p><p>Endomembrane system</p><p>Endomembrane System</p>" +
      "<p>Organelle</p><p>Secretory</p><p>Secreted Proteins</p><p>- Secreted proteins</p>" +
      "<p>Cell cycle dependent transcriptome and proteome</p><p>A Journey through the Cell</p>"
  );
  assert.deepEqual([...doc.querySelectorAll("p")].map((e) => e.textContent), [
    "细胞核",
    "内膜系统",
    "内膜系统",
    "细胞器",
    "分泌型",
    "分泌蛋白",
    "- 分泌蛋白",
    "细胞周期依赖的转录组与蛋白质组",
    "细胞之旅"
  ]);
});

test("亚细胞页：图注 title 与 alt", () => {
  const doc = run(
    "<span title=\"Secreted proteins\"></span><span title=\"Rods and rings\"></span>" +
      "<img alt=\"Metabolic proteome\"><img alt=\"Subcell location UMAP\">"
  );
  assert.equal(doc.querySelectorAll("span")[0].getAttribute("title"), "分泌蛋白");
  assert.equal(doc.querySelectorAll("span")[1].getAttribute("title"), "杆环结构");
  assert.equal(doc.querySelector("img").getAttribute("alt"), "代谢蛋白质组");
  assert.equal(doc.querySelectorAll("img")[1].getAttribute("alt"), "亚细胞定位 UMAP");
});

test("帮助页：分区标题与 FAQ 问句", () => {
  const doc = run(
    "<h2>Programmatic data access</h2><h1>FAQ</h1><h2>Data questions</h2><h2>General questions</h2>" +
      "<p>How can I download your data?</p>" +
      "<p>Is it possible to save the result of a search?</p>" +
      "<p>How are the reliability scores set?</p>" +
      "<p>How do I cite the Human Protein Atlas?</p>" +
      "<p>In the Tissue Atlas, some tissues are denoted 1 and 2, e.g. stomach 1 and stomach 2. What do the numbers mean?</p>"
  );
  assert.equal(doc.querySelector("h1").textContent, "常见问题");
  assert.deepEqual([...doc.querySelectorAll("h2")].map((e) => e.textContent), ["程序化数据访问", "数据问题", "通用问题"]);
  assert.deepEqual([...doc.querySelectorAll("p")].map((e) => e.textContent), [
    "如何下载你们的数据？",
    "可以保存检索结果吗？",
    "可靠性评分是如何设定的？",
    "如何引用人类蛋白质图谱？",
    "在组织图谱中，有些组织标注为 1 和 2（例如胃 1 与胃 2），这些数字是什么意思？"
  ]);
});

test("帮助页：模板替换整句且保留链接与 href", () => {
  const doc = run(
    "<p>If you want to programmatically access data more information can be found on the <a href=\"/api\">following page</a></p>" +
      "<p>Yes, please see <a href=\"/about/licence\">the licence &amp; citation page</a> for full details.</p>" +
      "<p>Please cite one of our publications as stated in the <a href=\"/about/licence\">Data usage policy</a>.</p>" +
      "<p>The protein scores of the specific cell types are available in the <a href=\"/about/download\">xml files</a>.</p>"
  );
  const ps = [...doc.querySelectorAll("p")];
  assert.equal(ps[0].textContent, "如需以程序方式访问数据，更多信息请见以下页面");
  assert.equal(ps[0].querySelector("a").getAttribute("href"), "/api", "链接地址不能改");
  assert.equal(ps[1].textContent, "可以，详见许可与引用页面。");
  assert.equal(ps[1].querySelector("a").getAttribute("href"), "/about/licence");
  assert.equal(ps[2].textContent, "请按数据使用政策所述引用我们的某篇论文。");
  assert.equal(ps[3].textContent, "特定细胞类型的蛋白质评分可在 XML 文件中获取。");
  assert.equal(ps[3].querySelector("a").getAttribute("href"), "/about/download");
});

test("帮助页：多槽位模板（双链接 / <br> 槽位）保留控件与换行", () => {
  const doc = run(
    "<p>Yes, you can download the protocol for both <a href=\"/download/IHC_protocol.pdf\">IHC</a> and <a href=\"/download/IF_protocol.pdf\">IF</a>.</p>" +
      "<p>TPM-tables of the RNA data can be found on our <a href=\"/about/download\">download page</a>.<br> Due to GDPR legislation we do currently not provide human tissue RNA-Seq data in raw format. We are working on making the raw RNA-Seq data available through a secure federated EGA repository where access can be managed. Timelines for this is however uncertain.</p>"
  );
  const ps = [...doc.querySelectorAll("p")];
  assert.equal(ps[0].textContent, "可以，IHC 与 IF 的实验方案均可下载。");
  const links = [...ps[0].querySelectorAll("a")];
  assert.equal(links.length, 2);
  assert.equal(links[0].getAttribute("href"), "/download/IHC_protocol.pdf");
  assert.equal(links[1].getAttribute("href"), "/download/IF_protocol.pdf");
  assert.ok(ps[1].textContent.startsWith("RNA 数据的 TPM 表可在我们的下载页面上找到。"), ps[1].textContent);
  assert.ok(ps[1].textContent.includes("出于 GDPR 法规，我们目前不提供原始格式的人体组织 RNA-Seq 数据。"), ps[1].textContent);
  assert.equal(ps[1].querySelector("br") !== null, true, "<br> 槽位要保留");
  assert.equal(ps[1].querySelector("a").getAttribute("href"), "/about/download");
});

test("帮助页：长段说明模板（Kaplan-Meier）整段替换并保留末尾链接", () => {
  // 这句在线上帮助页里就是一段：节点被 <a> 切两段，只能靠词库模板整段替换；
  // 段落原文从词库 pat 取，保证与线上句子逐字一致（改词库 pat 会立刻反映到这条用例）。
  const pat = book.templates.find((t) => t.pat.startsWith("The Kaplan-Meier plot shows")).pat;
  const doc = run("<p>" + pat.replace("{{1}}", '<a href="/x">article</a>') + "</p>");
  const p = doc.querySelector("p");
  assert.ok(p.textContent.startsWith("Kaplan-Meier 曲线展示不同时间点的生存概率"), p.textContent.slice(0, 40));
  assert.ok(p.textContent.endsWith("我们推荐阅读这篇文章"), p.textContent.slice(-30));
  assert.equal(p.querySelector("a").getAttribute("href"), "/x");
  assert.equal(p.getAttribute("data-biol10n-tpl"), "1", "整段走模板通道，子节点才不会被拍平");
});

test("数据不动：基因名、细胞系、抗体/平台名、邮箱、URL、数值", () => {
  const doc = run(
    "<span>TP53</span><span>TP53INP1</span><span>TP53TG3</span><span>A-431</span><span>HeLa</span>" +
      "<span>SomaScan</span><span>ProteinTalks DB</span><span>HPA</span><span>847</span>" +
      "<a href=\"mailto:contact@proteinatlas.org\">contact@proteinatlas.org</a>" +
      "<a href=\"/ENSG00000121410.xml\">https://www.proteinatlas.org/ENSG00000121410.xml</a>"
  );
  assert.deepEqual([...doc.querySelectorAll("span")].map((e) => e.textContent), [
    "TP53",
    "TP53INP1",
    "TP53TG3",
    "A-431",
    "HeLa",
    "SomaScan",
    "ProteinTalks DB",
    "HPA",
    "847"
  ]);
  assert.equal(doc.querySelectorAll("a")[0].textContent, "contact@proteinatlas.org");
  assert.equal(doc.querySelectorAll("a")[0].getAttribute("href"), "mailto:contact@proteinatlas.org");
  assert.equal(doc.querySelectorAll("a")[1].textContent, "https://www.proteinatlas.org/ENSG00000121410.xml");
});