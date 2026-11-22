// NCBI Structure / CDD / IPG 站内界面词库（dict/ncbi-struct.json）冒烟测试
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/ncbi-struct.json"), "utf8"));

const site = {
  id: "ncbi-struct",
  hosts: ["www.ncbi.nlm.nih.gov"],
  path: "^/(structure|cdd|ipg)",
  scope: "body"
};

function mount(html, url) {
  const dom = new JSDOM(html, { url: url || "https://www.ncbi.nlm.nih.gov/structure/?term=1TUP" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: dict.exact, rules: dict.rules, templates: dict.templates },
    site
  });
  engine.start();
  return dom.window.document;
}

function applyRules(text) {
  const exact = dict.exact[text];
  if (exact !== undefined) return exact;
  for (const r of dict.rules) {
    const re = new RegExp(r.re);
    const m = re.exec(text);
    if (!m) continue;
    return r.to.replace(/\$(\d)/g, function (_, d) {
      return m[Number(d)] === undefined ? "" : m[Number(d)];
    });
  }
  return null;
}

test("词库结构：family/sites、条目数、规则合法、无模板", () => {
  assert.equal(dict.meta.family, "ncbi-struct");
  assert.ok(dict.meta.sites.includes("www.ncbi.nlm.nih.gov"));
  assert.ok(Object.keys(dict.exact).length >= 150, "条目数应 >= 150，实际 " + Object.keys(dict.exact).length);
  assert.ok(Array.isArray(dict.rules) && dict.rules.length >= 10);
  for (const r of dict.rules) {
    assert.doesNotThrow(() => new RegExp(r.re), "坏规则: " + r.re);
    assert.equal(typeof r.to, "string");
    assert.ok(/\$\d/.test(r.to) || !/\(/.test(r.re), "带捕获组的规则应在译文里用 $n: " + r.re);
  }
  assert.ok(Array.isArray(dict.templates));
  assert.equal(dict.templates.length, 0, "这三站没有段落被切碎的模板，templates 应为空");
});

test("key 无中文/无自映射/无首尾空白；值有中文且无明文 URL、邮箱", () => {
  const seen = new Set();
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "key 含中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "key 首尾空白: " + k);
    assert.equal(v, String(v).trim(), "值首尾空白: " + k);
    assert.ok(k.length > 1 && k.length <= 400, "key 长度异常: " + k);
    assert.ok(/[\u4e00-\u9fff]/.test(v), "值没有中文: " + k);
    assert.ok(!/https?:\/\//i.test(v), "值含 URL: " + k);
    assert.ok(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(v), "值含邮箱: " + k);
    const n = k.replace(/\s+/g, " ").trim().toLowerCase();
    assert.ok(!seen.has(n), "规范化后重复: " + k);
    seen.add(n);
  }
  for (const r of dict.rules) {
    assert.ok(!/[\u4e00-\u9fff]/.test(r.re), "规则里含中文: " + r.re);
    assert.ok(/[\u4e00-\u9fff]/.test(r.to), "规则译文没有中文: " + r.re);
    assert.ok(!/https?:\/\//i.test(r.to), "规则译文含 URL: " + r.re);
  }
});

test("关键条目存在且与页面实测原文一致（Structure 首页与 MMDB 记录页）", () => {
  const want = {
    // structure/ 首页
    "Three dimensional structures": "三维结构",
    "Using Structure": "使用 Structure",
    "How to (Quick Start) Guides": "操作指南（快速入门）",
    "Discover": "探索",
    "Structure Tools": "结构工具",
    "Macromolecular Resources Overview": "大分子资源概览",
    "iCn3D (web-based 3D viewer)": "iCn3D（网页版三维查看器）",
    "Cn3D (3D viewer application)": "Cn3D（三维查看器程序）",
    "More Resources": "更多资源",
    "NCBI Structure Group Resources & Research": "NCBI 结构组资源与研究",
    "Search Structure": "检索 Structure",
    // structure/?term=1TUP
    "Download PDB file": "下载 PDB 文件",
    "PDB Deposition Date:": "PDB 提交日期：",
    "Updated in MMDB:": "MMDB 更新日期：",
    "Experimental Method:": "实验方法：",
    "Resolution:": "分辨率：",
    "Source Organism:": "来源物种：",
    "Similar Structures:": "相似结构：",
    "Download sequence data": "下载序列数据",
    "Biological Unit": "生物学单元",
    "Asymmetric Unit": "不对称单元",
    "Molecular Graphic": "分子图形",
    "Download Cn3D": "下载 Cn3D",
    "Interactions": "相互作用",
    "Download Stucture Data": "下载结构数据",
    "Data Set:": "数据集：",
    "alpha-Carbons": "α-碳原子",
    "Single 3D structure": "单个三维结构",
    "SS Diagram": "二级结构图",
    "Domain Families": "结构域家族",
    "Specific Hits": "特异命中",
    "Super Families": "超家族",
    "Citing MMDB": "引用 MMDB",
    "Enter PDB ID or MMDB ID": "输入 PDB ID 或 MMDB ID",
    "molecular graphic help": "分子图形帮助",
    "-Select icon for molecule information": "-选择图标可查看分子信息"
  };
  for (const [k, v] of Object.entries(want)) {
    assert.equal(dict.exact[k], v, "条目不符: " + k);
  }
  // 页内公告条与 WebGL 提示被 <a>/<br>/<button> 切成短片段，引擎正文保护只放行 >=40 字符的整句，
  // 逐条收词会留下中英混排；按"拿不准整条不收"整块放弃（需要站点 proseExempt 才能整段翻）。
  for (const k of [
    "An updated version of the MMDB Structure Summary page is available!",
    "Try it now",
    "and provide feedback using the on-page button.",
    "This MMDB page requires WebGL in order to interactively view 3D structures."
  ]) {
    assert.equal(dict.exact[k], undefined, "半句不应单独收词: " + k);
  }
  // 原文把 Structure 拼错成 Stucture，词条必须保留这个拼写才能命中
  assert.ok(!("Download Structure Data" in dict.exact), "不应登记订正拼写的 key");
});

test("关键条目存在（CDD 首页/条目页/检索结果）", () => {
  const want = {
    "Protein building blocks": "蛋白质构建单元",
    "Using CDD": "使用 CDD",
    "Quick Start Guide": "快速入门指南",
    "How To Guides": "操作指南",
    "CDD Tools": "CDD 工具",
    "Overview of CDD Resources": "CDD 资源概览",
    "CDART (domain architectures)": "CDART（结构域架构）",
    "SPARCLE (protein labeling engine)": "SPARCLE（蛋白标注引擎）",
    "Batch CD-Search": "批量 CD-Search",
    "Structure Group Home Page": "结构组主页",
    "Entrez Structure (Molecular Modeling Database)": "Entrez Structure（分子建模数据库）",
    "Conserved Protein Domain Family": "保守蛋白结构域家族",
    "Download alignment": "下载比对",
    "Representatives": "代表序列",
    "Specific Protein": "特定蛋白",
    "Related Protein": "相关蛋白",
    "Related Structure": "相关结构",
    "Architectures": "架构",
    "Superfamily:": "超家族：",
    "PSSM-Id:": "PSSM 编号：",
    "Threshold Bit Score:": "阈值比特分数：",
    "Aligned Rows:": "比对行数：",
    "Conserved Features/Sites": "保守特征/位点",
    "PubMed References": "PubMed 参考文献",
    "Scroll to Sequence Alignment Display": "滚动到序列比对显示",
    "Sub-family Hierarchy": "亚家族层级",
    "Interactive Display with CDTree": "用 CDTree 交互展示",
    "Sequence Alignment": "序列比对",
    "include consensus sequence": "包含一致序列",
    "Row Display:": "行显示：",
    "Color Bits:": "着色强度：",
    "Type Selection:": "类型选择：",
    "top listed sequences": "列表中靠前的序列",
    "the most diverse members": "多样性最高的成员",
    "View in Cn3D": "在 Cn3D 中查看",
    "Superfamily Members": "超家族成员",
    "Accession ▲": "登录号升序 ▲",
    "PSSM Length ▼": "PSSM 长度降序 ▼"
  };
  for (const [k, v] of Object.entries(want)) {
    assert.equal(dict.exact[k], v, "条目不符: " + k);
  }
});

test("关键条目存在（IPG 首页/检索结果/记录页）", () => {
  const want = {
    "Getting Started": "入门指南",
    "Frequently Asked Questions": "常见问题",
    "Related Resources": "相关资源",
    "Conserved Domain Database": "保守结构域数据库",
    "Search Identical Protein Groups": "检索 Identical Protein Groups",
    "Source databases": "来源数据库",
    "Division": "类群",
    "Protein count bins": "蛋白数量区间",
    "Protein count": "蛋白数量",
    "Molecular weight": "分子量",
    "Sequence length": "序列长度",
    "Creation date": "创建日期",
    "Custom range...": "自定义范围...",
    "Custom date range": "自定义日期范围",
    "Start Value": "起始值",
    "End Value": "结束值",
    "Additional filters": "更多筛选条件",
    "Search fields": "检索字段",
    "Choose Destination": "选择目标位置",
    "Create File": "创建文件",
    "Add to Clipboard": "添加到剪贴板",
    "Add to Collections": "添加到收藏集",
    "Taxonomic Groups": "分类群",
    "Top Organisms": "常见物种",
    "Turn recording back on": "重新开启记录",
    "Your browsing activity is empty.": "您的浏览活动为空。",
    "Activity recording is turned off.": "活动记录已关闭。",
    "Vertebrates": "脊椎动物",
    "Invertebrates": "无脊椎动物",
    "Plants and Fungi": "植物与真菌",
    "Prokaryotes": "原核生物",
    "RefSeq Selected Product:": "RefSeq 选定产物：",
    "Taxonomic Group:": "分类群：",
    "Assembly Accessions:": "组装登录号：",
    "Protein Accessions:": "蛋白登录号：",
    "CDS Regions:": "CDS 区域：",
    "Total Rows:": "总行数：",
    "CDS Region in Nucleotide": "核苷酸中的 CDS 区域",
    "Strain": "菌株",
    "Graphics": "图形"
  };
  for (const [k, v] of Object.entries(want)) {
    assert.equal(dict.exact[k], v, "条目不符: " + k);
  }
});

test("规则命中页面实测原文（表驱动）", () => {
  const cases = [
    ["» All references (2)", "» 全部参考文献（2）"],
    ["Proteins (3 molecules)", "蛋白质（3 个分子）"],
    ["Nucleotides(2 molecules)", "核苷酸（2 个分子）"],
    ["Chemicals and Non-standard biopolymers (3 molecules)", "化学小分子与非标准生物聚合物（3 个分子）"],
    ["3 Proteins", "3 个蛋白质"],
    ["1 Nucleotide", "1 个核苷酸"],
    ["Molecular Components in 1TUP", "1TUP 的分子组成"],
    ["up to 5", "最多 5 行"],
    ["All 24 rows", "全部 24 行"],
    ["25 rows", "25 行"],
    ["0.5 bit", "0.5 比特"],
    ["2 links", "2 个链接"],
    ["is a member of the superfamily", "属于超家族"],
    ["is part of a hierarchy of related CD models.", "属于相关 CD 模型的层级体系。"],
    ["cd00001 Sequence Cluster", "cd00001 序列簇"],
    ["Items: 6", "共 6 项"],
    ["1 sequence, including", "1 条序列，包括"],
    ["16 sequences, including", "16 条序列，包括"]
  ];
  for (const [input, expected] of cases) {
    assert.equal(applyRules(input), expected, "规则未命中或译文不符: " + input);
  }
  assert.equal(dict.exact["PDB ID:"], undefined, "纯标识+冒号不值得单独收词条");
  // 不该被规则接住的条目
  assert.equal(applyRules("3 aa protein (whip scorpions)"), null, "物种/类群名不翻");
  assert.equal(applyRules("PTS_IIB_man"), null, "结构域名不翻");
});

test("引擎冒烟：真实页面片段渲染成中文", () => {
  const html = [
    '<div id="html">',
    '<h2 class="res_tagline">Three dimensional structures</h2>',
    '<div class="dbdescription">Three dimensional structures provide a wealth of information on the biological function and the evolutionary history of macromolecules. They can be used to examine sequence-structure-function relationships, interactions, active sites, and more.</div>',
    '<input title="Search Structure" />',
    '<h4 class="property-name">PDB Deposition Date:</h4>',
    '<table><tbody><tr><td class="tlst">PSSM-Id:</td><td>25 rows</td></tr>',
    '<tr><td class="butbl_inner_tbl_tit">Proteins (3 molecules)</td></tr>',
    '<caption>Molecular Components in 1TUP</caption></tbody></table>',
    '<a title="Click to create an email alert for this search">Create alert</a>',
    '<h3>Source databases</h3>',
    '<span class="strview-form-title">Format:</span>',
    '<h2>Conserved Protein Domain Family</h2>',
    '<div class="regulartext">is part of a hierarchy of related CD models.</div>',
    "</div>"
  ].join("");
  const doc = mount(html);
  const text = doc.body.textContent;
  for (const zh of [
    "三维结构",
    "三维结构为认识大分子的生物学功能与演化历史提供了丰富信息",
    "PDB 提交日期：",
    "PSSM 编号：",
    "25 行",
    "蛋白质（3 个分子）",
    "1TUP 的分子组成",
    "来源数据库",
    "格式：",
    "保守蛋白结构域家族",
    "属于相关 CD 模型"
  ]) {
    assert.ok(text.includes(zh), "页面上没有出现译文: " + zh);
  }
  assert.equal(doc.querySelector("input").getAttribute("title"), "检索 Structure");
  assert.equal(
    doc.querySelector("a[title]").getAttribute("title"),
    "点击为此检索创建邮件提醒"
  );
  // 不该翻的技术词保持原样
  assert.ok(text.includes("CD"), "CD 不应被改写");
});

test("结构记录页：特征区标签与位点句", () => {
  const doc = mount(
    '<div><h3>Features</h3><span class="chem">Chemical</span>' +
      '<div>DNA binding site</div><div>zinc binding site</div><div>dimerization site</div>' +
      "<div>location: 146, residue: N</div><div>helix 185-194</div><div>strand 9-12</div></div>"
  );
  const txt = doc.body.textContent;
  assert.match(txt, /特征/);
  assert.match(txt, /化学物质/);
  assert.match(txt, /锌结合位点/);
  assert.match(txt, /二聚化位点/);
  assert.match(txt, /位置：146，残基：N/);
  assert.match(txt, /螺旋 185-194/);
  assert.match(txt, /β 折叠股 9-12/);
});
