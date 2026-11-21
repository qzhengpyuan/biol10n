// NCBI Taxonomy 词库（dict/taxonomy.json）冒烟测试
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/taxonomy.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "ncbi-taxonomy");

function mount(html, url) {
  const dom = new JSDOM(html, { url: url || "https://www.ncbi.nlm.nih.gov/datasets/taxonomy/9606/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: dict.exact, rules: dict.rules, templates: dict.templates },
    site
  });
  engine.start();
  return dom.window.document;
}

test("词库结构：family/sites、条目数、rule 合法", () => {
  assert.equal(dict.meta.family, "taxonomy");
  assert.ok(dict.meta.sites.includes("www.ncbi.nlm.nih.gov"));
  assert.ok(site, "config/sites.json 里应有 ncbi-taxonomy 站点");
  assert.equal(site.path, "^/(Taxonomy|datasets/taxonomy)");
  assert.ok(Object.keys(dict.exact).length >= 100);
  assert.ok(Array.isArray(dict.rules) && dict.rules.length >= 1);
  for (const r of dict.rules) {
    assert.doesNotThrow(() => new RegExp(r.re), "坏规则: " + r.re);
    assert.equal(typeof r.to, "string");
  }
  assert.ok(Array.isArray(dict.templates));
});

test("key 里没有中文，值里没有明文 URL/邮箱", () => {
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "key 含中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "key 首尾空白: " + k);
    assert.ok(!/https?:\/\//i.test(v), "值含 URL: " + k);
    assert.ok(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(v), "值含邮箱: " + k);
  }
});

test("关键条目存在（页面实测原文）", () => {
  const want = [
    "NCBI Datasets",
    "Command-line tools",
    "NCBI Taxonomy ID",
    "Taxonomic rank",
    "Current scientific name",
    "Mitochondrial genetic code",
    "Translation table 2 (Vertebrate Mitochondrial)",
    "View taxonomic details",
    "Browse taxonomy",
    "BLAST all sequences",
    "View full lineage",
    "Lineage",
    "Variation resources",
    "External links",
    "From Type Material",
    "Projects and samples",
    "Gene type",
    "Pseudogenes",
    "Small-RNAs",
    "All SRA experiments",
    "Protein sequences",
    "3D structures",
    "Kingdom",
    "Phylum",
    "Order",
    "Genus",
    "(great apes)",
    "Information about genomic variation and its relationship to human health",
    "Database of small-scale sequence variations",
    "The Genetic Codes",
    "Differences from the Standard Code:",
    "Initiation Codon:",
    "Systematic Range:",
    "Click here to change format",
    "1. The Standard Code (transl_table=1)",
    "25. Candidate Division SR1 and Gracilibacteria Code (transl_table=25)",
    "The following genetic codes are described here:",
    "Other examples can be found in the following references:",
    "Last update of the Genetic Codes: Sep. 23, 2024"
  ];
  for (const k of want) assert.ok(Object.prototype.hasOwnProperty.call(dict.exact, k), "缺条目: " + k);
});

test("物种页基本信息：定义列表与按钮翻成中文", () => {
  const doc = mount(
    '<main><dl>' +
      "<dt>NCBI Taxonomy ID</dt><dd>9606</dd>" +
      "<dt>Taxonomic rank</dt><dd>species</dd>" +
      "<dt>Current scientific name</dt><dd>Homo sapiens</dd>" +
      "<dt>Common name</dt><dd>human</dd>" +
      "<dt>Genetic code</dt><dd>Translation table 1 (Standard)</dd>" +
      "<dt>Mitochondrial genetic code</dt><dd>Translation table 2 (Vertebrate Mitochondrial)</dd>" +
      "</dl>" +
      '<a href="/x">View taxonomic details</a><a href="/y">View full lineage</a>' +
      '<a href="/z">Browse all 2,589 genomes</a>' +
      "</main>"
  );
  const dts = [...doc.querySelectorAll("dt")].map((e) => e.textContent);
  assert.deepEqual(dts, ["NCBI 分类学 ID", "分类学等级", "当前学名", "常用名", "遗传密码表", "线粒体遗传密码表"]);
  const dds = [...doc.querySelectorAll("dd")].map((e) => e.textContent);
  assert.deepEqual(dds, ["9606", "species", "Homo sapiens", "human", "翻译表 1（标准）", "翻译表 2（脊椎动物线粒体）"]);
  const links = [...doc.querySelectorAll("a")].map((e) => e.textContent);
  assert.deepEqual(links, ["查看分类学详情", "查看完整谱系", "浏览全部 2,589 个基因组"]);
});

test("基因类型表与序列统计表头翻成中文，数字保留", () => {
  const doc = mount(
    '<main><table><thead><tr><th>Gene type</th><th>Count</th></tr></thead><tbody>' +
      "<tr><td>Non-coding</td><td>22,811</td></tr>" +
      "<tr><td>Protein-coding</td><td>20,576</td></tr>" +
      "<tr><td>Pseudogenes</td><td>17,510</td></tr>" +
      "<tr><td>Small-RNAs</td><td>2,815</td></tr>" +
      "</tbody></table>" +
      '<div><span>All nucleotide sequences</span><span>29,920,136</span></div>' +
      "<div><span>Genomic sequences</span><span>16,973,347</span></div>" +
      "<div><span>mRNA sequences</span><span>9,951,646</span></div>" +
      "<div><span>Protein sequences</span><span>2,187,010</span></div>" +
      "<div><span>3D structures</span><span>82,436</span></div>" +
      "<div><span>All SRA experiments</span><span>7,326,395</span></div>" +
      "</main>"
  );
  const ths = [...doc.querySelectorAll("th")].map((e) => e.textContent);
  assert.deepEqual(ths, ["基因类型", "Count"]);
  const tds = [...doc.querySelectorAll("td")].map((e) => e.textContent);
  assert.deepEqual(tds, ["非编码", "22,811", "蛋白编码", "20,576", "假基因", "17,510", "小 RNA", "2,815"]);
  const spans = [...doc.querySelectorAll("div span:first-child")].map((e) => e.textContent);
  assert.deepEqual(spans, ["全部核苷酸序列", "基因组序列", "mRNA 序列", "蛋白序列", "三维结构", "全部 SRA 实验"]);
  const nums = [...doc.querySelectorAll("div span:last-child")].map((e) => e.textContent);
  assert.deepEqual(nums, ["29,920,136", "16,973,347", "9,951,646", "2,187,010", "82,436", "7,326,395"]);
});

test("谱系：等级名翻成中文，学名与俗名保留", () => {
  const doc = mount(
    '<main><h3>Lineage</h3><ul>' +
      '<li><a href="/1">Eukaryota</a><span>(eukaryotes)</span><span>Domain</span></li>' +
      '<li><a href="/2">Metazoa</a><span>(animals)</span><span>Kingdom</span></li>' +
      '<li><a href="/3">Chordata</a><span>(chordates)</span><span>Phylum</span></li>' +
      '<li><a href="/4">Mammalia</a><span>(mammals)</span><span>Class</span></li>' +
      '<li><a href="/5">Primates</a><span>Order</span></li>' +
      '<li><a href="/6">Hominidae</a><span>(great apes)</span><span>Family</span></li>' +
      '<li><a href="/7">Homo</a><span>Genus</span></li>' +
      "</ul></main>"
  );
  assert.equal(doc.querySelector("h3").textContent, "谱系");
  const names = [...doc.querySelectorAll("li a")].map((e) => e.textContent);
  assert.deepEqual(names, ["Eukaryota", "Metazoa", "Chordata", "Mammalia", "Primates", "Hominidae", "Homo"]);
  const captions = [...doc.querySelectorAll("li span:last-child")].map((e) => e.textContent);
  // Family / Domain 与 common 的「家族 / 结构域」撞名，改用本册规则在分类学语境翻成「科 / 域」
  assert.deepEqual(captions, ["域", "界", "门", "纲", "目", "科", "属"]);
  // 只取「学名 + 俗名 + 等级」三段的条目；单段条目是 Rank 本身
  const gloss = [...doc.querySelectorAll("li")]
    .filter((li) => li.querySelectorAll("span").length === 2)
    .map((li) => li.querySelectorAll("span")[0].textContent);
  assert.deepEqual(gloss, [
    "（真核生物）",
    "（动物）",
    "（脊索动物）",
    "（哺乳动物）",
    "（大型猿类）"
  ]);
});

test("规则只整段匹配：Classification 不被 Class 规则误伤", () => {
  const doc = mount('<main><p>Classification</p><p>Class</p><p>Browse all 76 genomes</p></main>');
  const ps = [...doc.querySelectorAll("p")].map((e) => e.textContent);
  assert.deepEqual(ps, ["Classification", "纲", "浏览全部 76 个基因组"]);
});

test("遗传密码表页：标题、等级行与表格标题翻成中文", () => {
  const doc = mount(
    "<div>" +
      "<h1>The Genetic Codes</h1>" +
      "<h2>2. The Vertebrate Mitochondrial Code (transl_table=2)</h2>" +
      "<h4>Differences from the Standard Code:</h4>" +
      "<h4>Initiation Codon:</h4>" +
      "<h4>Alternative Initiation Codons:</h4>" +
      "<h4>Initiation Codons: AUG</h4>" +
      "<h4>Systematic Range:</h4>" +
      "<strong>Systematic Range</strong>" +
      '<a href="#SG2">2. The Vertebrate Mitochondrial Code</a>' +
      '<p>Click here to change format</p>' +
      "<p>The following genetic codes are described here:</p>" +
      '<font>Last update of the Genetic Codes: Sep. 23, 2024</font>' +
      "<p>30. Peritrich Nuclear Code (transl_table=30)</p>" +
      "</div>",
    "https://www.ncbi.nlm.nih.gov/Taxonomy/Utils/wprintgc.cgi"
  );
  assert.equal(doc.querySelector("h1").textContent, "遗传密码表");
  assert.equal(doc.querySelector("h2").textContent, "2. 脊椎动物线粒体遗传密码表（transl_table=2）");
  const h4 = [...doc.querySelectorAll("h4")].map((e) => e.textContent);
  assert.deepEqual(h4, [
    "与标准遗传密码表的差异：",
    "起始密码子：",
    "替代起始密码子：",
    "起始密码子：AUG",
    "分类范围："
  ]);
  assert.equal(doc.querySelector("strong").textContent, "分类范围");
  assert.equal(doc.querySelector("a").textContent, "2. 脊椎动物线粒体遗传密码表");
  assert.equal(doc.querySelectorAll("p")[0].textContent, "点击此处切换显示格式");
  assert.equal(doc.querySelectorAll("p")[1].textContent, "下面介绍下列遗传密码表：");
  assert.equal(doc.querySelector("font").textContent, "遗传密码表最后更新：2024 年 9 月 23 日");
  assert.equal(doc.querySelectorAll("p")[2].textContent, "30. Peritrich 核遗传密码表（transl_table=30）");
});

test("数据不翻：学名、命名人、登录号、组装名、类群拉丁名", () => {
  const doc = mount(
    "<main>" +
      "<h1>Homo sapiens</h1>" +
      "<p>Homo sapiens Linnaeus, 1758</p>" +
      "<p>Linnaeus, 1758</p>" +
      "<p>GCF_000001405.40</p>" +
      "<p>GRCh38.p14</p>" +
      "<p>Mus musculus Linnaeus, 1758</p>" +
      "<p>house mouse</p>" +
      "<p>Genome Reference Consortium (2022).</p>" +
      "</main>"
  );
  const ps = [...doc.querySelectorAll("p")].map((e) => e.textContent);
  assert.deepEqual(ps, [
    "Homo sapiens Linnaeus, 1758",
    "Linnaeus, 1758",
    "GCF_000001405.40",
    "GRCh38.p14",
    "Mus musculus Linnaeus, 1758",
    "house mouse",
    "Genome Reference Consortium (2022)."
  ]);
});
