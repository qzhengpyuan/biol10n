// PDBe 词库（pdbe）回归：首页统计 / 条目页 / 模型质量 / 实验页 / 文档页 / PDB-REDO 与合作伙伴模板
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/pdbe.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;

// config/sites.json 里没有 pdbe 条目时用等价定义兜底；正式条目写进去后自动改用真实配置。
const site = sites.find((s) => s.id === "pdbe") || {
  id: "pdbe",
  hosts: ["www.ebi.ac.uk"],
  path: "^/pdbe",
  dicts: ["common", "pdbe"],
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
  const dom = new JSDOM(html);
  const engine = createEngine({ document: dom.window.document, window: dom.window, data: stackData(), site });
  engine.start();
  return dom.window.document;
}

test("词库结构：条数、键值形态、规则可编译、模板槽位连续", () => {
  assert.equal(book.meta.family, "pdbe");
  assert.ok(book.meta.sites.includes("www.ebi.ac.uk"));
  assert.ok(Object.keys(book.exact).length >= 120, "exact 至少 120 条");
  assert.ok(book.rules.length >= 6, "rules 至少 6 条");
  assert.ok(Array.isArray(book.templates) && book.templates.length >= 2, "templates 至少 2 条");

  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "键里不能有中文: " + k);
    assert.ok(/[\u4e00-\u9fff]/.test(v), "译文里必须有中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "键首尾不能有空白: " + JSON.stringify(k));
  }
  for (const r of book.rules) {
    assert.ok(new RegExp(r.re).source.length > 0);
    assert.ok(/[\u4e00-\u9fff]/.test(r.to), "规则译文里必须有中文: " + r.re);
  }
  for (const t of book.templates) {
    const used = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.ok(used.length >= 1, "模板要带槽位: " + t.pat);
    used.slice().sort((a, b) => a - b).forEach((n, i) => assert.equal(n, i + 1, "槽位必须从 1 连续: " + t.pat));
    const zh = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.deepEqual(zh.slice().sort((a, b) => a - b), used.slice().sort((a, b) => a - b), "译文槽位要与原文一致");
  }
});

test("检索页：Entries 标签与 EMBL-EBI 全局页头（已挂 string-atlas）", () => {
  const doc = run(
    '<div class="tabs"><span class="tab">Entries</span><span class="tab">PDBe-KB</span></div>' +
      '<nav><a>About us</a></nav>'
  );
  assert.equal(doc.querySelector(".tab").textContent, "条目");
  assert.equal(doc.querySelector("nav a").textContent, "关于我们", "全局页头由 string-atlas 负责，本册不重复收");
});

test("首页：档案统计与固定区块", () => {
  const doc = run(
    "<h2>Latest archive statistics</h2><p>Total PDB entries in the archive: 263157</p>" +
      '<div class="stat"><span>Latest Data:</span><span>Latest Entries</span><span>Latest Chemistry</span>' +
      "<span>Latest Biology</span></div><h3>Featured</h3>" +
      "<a>More news</a><a>More publications</a><a>More services</a>"
  );
  assert.equal(doc.querySelector("h2").textContent, "最新档案统计");
  assert.equal(doc.querySelector("p").textContent, "档案中的 PDB 条目总数：263157");
  assert.deepEqual([...doc.querySelectorAll(".stat span")].map((e) => e.textContent), [
    "最新数据：",
    "最新条目",
    "最新化学",
    "最新生物学"
  ]);
  assert.equal(doc.querySelector("h3").textContent, "精选");
  assert.deepEqual([...doc.querySelectorAll("a")].map((e) => e.textContent), ["更多新闻", "更多论文", "更多服务"]);
});

test("条目页：标签页与摘要字段", () => {
  const doc = run(
    '<div class="tabs"><a>Summary</a><a>Model Quality</a><a>Complexes</a><a>Macromolecules</a>' +
      "<a>Ligands and Environments</a><a>Domains</a><a>Text Annotations (AI)</a><a>New</a>" +
      "<a>Citations</a><a>Other Resources</a></div>" +
      "<table><tr><th>Entry title</th><td>CRYSTAL STRUCTURE</td></tr>" +
      "<tr><th>Entry authors</th><td><a>Kleywegt, G.J.</a></td></tr>" +
      "<tr><th>Source organism</th><td><a>Homo sapiens</a></td></tr>" +
      "<tr><th>Primary publication</th><td>Title <a>7704533</a></td></tr>" +
      '<tr><th></th><td><a>Show all authors</a></td></tr>' +
      '<tr><td>Also associated with: <a>pdb_00001cbq</a></td></tr>' +
      "<tr><td><a>Download files</a></td></tr></table>"
  );
  assert.deepEqual([...doc.querySelectorAll(".tabs a")].map((e) => e.textContent), [
    "摘要",
    "模型质量",
    "复合物",
    "大分子",
    "配体与环境",
    "结构域",
    "文本注释（AI）",
    "新增",
    "引文",
    "其他资源"
  ]);
  assert.deepEqual([...doc.querySelectorAll("th")].map((e) => e.textContent), [
    "条目标题",
    "条目作者",
    "来源物种",
    "主要论文",
    ""
  ]);
  assert.equal(doc.querySelector("td").textContent, "CRYSTAL STRUCTURE", "条目标题不翻");
  assert.equal(doc.querySelector("table a").textContent, "Kleywegt, G.J.", "作者名不翻");
  const cells = [...doc.querySelectorAll("td")].map((e) => e.textContent);
  assert.ok(cells.includes("另关联到： pdb_00001cbq"));
  assert.ok(cells.includes("显示全部作者"));
  assert.ok(cells.includes("下载文件"));
});

test("模型质量：摘要标题、两项质量维度与百分位说明句", () => {
  const doc = run(
    "<h3>PDB model quality summary</h3><span>Model geometry</span><span>Fit model/data</span><span>New</span>" +
      "<p>Percentile-sliders comparing the quality scores of a model with other models in the archive.</p>"
  );
  assert.equal(doc.querySelector("h3").textContent, "PDB 模型质量摘要");
  assert.deepEqual([...doc.querySelectorAll("span")].map((e) => e.textContent), ["模型几何", "模型与数据拟合", "新增"]);
  assert.equal(doc.querySelector("p").textContent, "以百分位滑块把某模型的质量评分与档案中的其他模型作比较。");
});

test("实验页：子标签、表头与指标行（离群值规则 + 不可用 + 单位保留）", () => {
  const doc = run(
    '<div class="tabs"><a>Validation information</a><a>Timeline</a><a>Model quality</a><a>Experimental information</a>' +
      "<a>Crystal information</a><a>Software</a><a>Data quality</a><a>Refinement</a></div>" +
      "<table><tr><th>Metric</th><th>Value</th></tr>" +
      "<tr><td>Bond lengths in protein, DNA, RNA molecules</td><td>0 outliers of 1107 (0.00%)</td></tr>" +
      "<tr><td>Ramachandran outliers in protein molecules</td><td>3 outliers of 123 (2.44%)</td></tr>" +
      "<tr><td>RMSD bond length [Å]</td><td>Not available</td></tr>" +
      "<tr><td>Wilson B [Å²]</td><td>72.96 Å²</td></tr>" +
      "<tr><td>Resolution [Å]</td><td>8 - 1.8 Å</td></tr></table>"
  );
  assert.deepEqual([...doc.querySelectorAll(".tabs a")].map((e) => e.textContent), [
    "验证信息",
    "时间线",
    "模型质量",
    "实验信息",
    "晶体信息",
    "软件",
    "数据质量",
    "精修"
  ]);
  assert.deepEqual([...doc.querySelectorAll("th")].map((e) => e.textContent), ["指标", "值"]);
  const rows = [...doc.querySelectorAll("tr")].slice(1).map((tr) => [...tr.children].map((td) => td.textContent));
  assert.deepEqual(rows, [
    ["蛋白质、DNA、RNA 分子中的键长", "0 个离群值，共 1107 个（0.00%）"],
    ["蛋白质分子中的 Ramachandran 离群值", "3 个离群值，共 123 个（2.44%）"],
    ["RMSD 键长 [Å]", "不可用"],
    ["Wilson B 因子 [Å²]", "72.96 Å²"],
    ["分辨率 [Å]", "8 - 1.8 Å"]
  ], "数值与单位保持原样，只翻标签与句式");
});

test("规则：Data scaling / Overall / Released / X-ray 衍射", () => {
  const doc = run(
    "<h4>Data scaling #1</h4><h4>Overall</h4><h4>Outer shell</h4>" +
      "<span>Released 2019-05-15</span><span>X-ray diffraction • 1.8 Å</span>"
  );
  assert.deepEqual([...doc.querySelectorAll("h4")].map((e) => e.textContent), ["数据缩放 #1", "总体", "外层"]);
  assert.deepEqual([...doc.querySelectorAll("span")].map((e) => e.textContent), [
    "发布于 2019-05-15",
    "X 射线衍射 • 1.8 Å"
  ]);
});

test("模板：PDB-REDO 说明句整段替换，链接与 href 保留", () => {
  const doc = run(
    '<p class="redo">The sliders show the change in model quality between original PDB entry and the PDB-REDO entry. ' +
      '<a href="https://pdb-redo.eu/db/1cbs">PDB-REDO</a> is an external service, it is not a part of PDBe.</p>'
  );
  const p = doc.querySelector("p");
  assert.equal(p.textContent, "滑块显示原始 PDB 条目与 PDB-REDO 条目之间模型质量的变化。PDB-REDO 是外部服务，不属于 PDBe。");
  assert.equal(p.querySelector("a").getAttribute("href"), "https://pdb-redo.eu/db/1cbs", "链接地址不能改");
});

test("文档页：文件格式段落与链接标题", () => {
  const doc = run(
    "<h2>File formats</h2>" +
      "<p>The following links provide information about the format, dictionaries and related software tools used by the Worldwide Protein Data Bank (wwPDB) to define data content for depositon, annotation and archiving of PDB entries.</p>" +
      "<a>PDBx/mmCIF dictionary resources</a><a>PDB file format documentation</a>" +
      "<h2>Deposition</h2><a>wwPDB processing procedures and policies document</a><a>PDB deposition FAQs</a>" +
      "<h2>SIFTS - Structure Integration with Function, Taxonomy and Sequence</h2>" +
      "<h3>Methodology</h3><a>Accessing SIFTS information</a>"
  );
  assert.deepEqual([...doc.querySelectorAll("h2")].map((e) => e.textContent), [
    "文件格式",
    "数据提交",
    "SIFTS - 结构、功能、分类与序列整合"
  ]);
  assert.equal(
    doc.querySelector("p").textContent,
    "以下链接提供有关全球蛋白质数据库（wwPDB）用于定义 PDB 条目提交、注释与归档数据内容的格式、数据字典及相关软件工具的信息。"
  );
  assert.deepEqual([...doc.querySelectorAll("a")].map((e) => e.textContent), [
    "PDBx/mmCIF 数据字典资源",
    "PDB 文件格式文档",
    "wwPDB 处理流程与政策文件",
    "PDB 提交常见问题",
    "获取 SIFTS 信息"
  ]);
  assert.equal(doc.querySelector("h3").textContent, "方法学");
});

test("模板：wwPDB 合作伙伴整段替换，五个链接全部保留", () => {
  const doc = run(
    '<p class="partners">PDBe is a founding member of the Worldwide Protein Data Bank (wwPDB) which collects, organises and disseminates data on biological macromolecular structures.&nbsp;wwPDB Partners:&nbsp;' +
      '<a href="https://www.rcsb.org/">RCSB PDB,&nbsp;</a><a href="https://www.pdbj.org/">PDBj</a>,&nbsp;' +
      '<a href="https://bmrb.io/">BMRB</a>, <a href="https://emdb-empiar.org">EMDB</a>. ' +
      '<a href="https://www.ebi.ac.uk/pdbe/about">Read more about PDBe.</a></p>'
  );
  const p = doc.querySelector("p");
  const text = p.textContent;
  assert.ok(text.includes("全球蛋白质数据库（wwPDB）的创始成员"), text);
  assert.ok(text.includes("负责收集、整理并分发生物大分子结构数据"), text);
  assert.ok(text.includes("进一步了解 PDBe。"), text);
  const links = [...p.querySelectorAll("a")];
  assert.equal(links.length, 5, "五个链接都不能丢");
  assert.deepEqual(links.map((a) => a.getAttribute("href")), [
    "https://www.rcsb.org/",
    "https://www.pdbj.org/",
    "https://bmrb.io/",
    "https://emdb-empiar.org",
    "https://www.ebi.ac.uk/pdbe/about"
  ]);
});

test("控件属性：检索框 placeholder 与按钮 title", () => {
  const doc = run(
    '<input id="byid" placeholder="View PDBe entry by PDB entry ID">' +
      '<input id="seq" placeholder="enter sequence to search">' +
      '<a title="Download files">x</a><a title="View files">y</a>'
  );
  assert.equal(doc.querySelector("#byid").getAttribute("placeholder"), "按 PDB 条目 ID 查看 PDBe 条目");
  assert.equal(doc.querySelector("#seq").getAttribute("placeholder"), "输入序列进行检索");
  assert.equal(doc.querySelectorAll("a")[0].getAttribute("title"), "下载文件");
  assert.equal(doc.querySelectorAll("a")[1].getAttribute("title"), "查看文件");
});

test("数据不动：条目 ID、登录号、物种、DOI、作者、统计数", () => {
  const doc = run(
    '<div class="meta"><span>1cbs</span><span>pdb_00001cbs</span><span>Homo sapiens</span>' +
      "<span>10.1016/s0969-2126(94)00125-1</span><span>Kleywegt, G.J.</span><span>263157</span></div>"
  );
  assert.deepEqual([...doc.querySelectorAll(".meta span")].map((e) => e.textContent), [
    "1cbs",
    "pdb_00001cbs",
    "Homo sapiens",
    "10.1016/s0969-2126(94)00125-1",
    "Kleywegt, G.J.",
    "263157"
  ]);
});

test("规则：Patterson 峰固定说明句（长整句）", () => {
  const doc = run(
    "<p>The largest off-origin peak in the Patterson function is 5.39% of the height of the origin peak. No significant pseudotranslation is detected.</p>"
  );
  assert.equal(
    doc.querySelector("p").textContent,
    "Patterson 函数中最大的离原点峰高为原点峰高的 5.39%。未检测到显著的伪平移。"
  );
});
