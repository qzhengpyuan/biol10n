// dbSNP 词库：首页骨架、检索筛选器、RefSNP 记录页与词表自检
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const snp = JSON.parse(fs.readFileSync(path.join(root, "../dict/snp.json"), "utf8"));
const site = {
  id: "ncbi-snp",
  hosts: ["www.ncbi.nlm.nih.gov"],
  path: "^/snp",
  scope: "main, #maincontent",
  proseExempt: ".usa-banner, .usa-media_block-body, [class*=disclaimer]"
};

function run(html) {
  const dom = new JSDOM("<main id='maincontent'>" + html + "</main>", { url: "https://www.ncbi.nlm.nih.gov/snp/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: snp.exact, rules: snp.rules, templates: snp.templates },
    site
  });
  engine.start();
  return dom.window.document;
}

test("首页：栏目标题与固定链接翻成中文", () => {
  const d = run(
    "<h2>Access Data</h2><h2>Variation Databases</h2><h2>dbSNP News and Announcements</h2>" +
      "<span class='tagline'>Database of short genetic variations</span>" +
      "<a>Overview of dbSNP</a><a>About Reference SNP (rs)</a><a>dbSNP 25th Anniversary</a>" +
      "<a>Hold Until Published (HUP) Policies</a><a>Submission Search</a><a>Variation Services</a>" +
      "<a>Tutorials on GitHub</a><a>Factsheet</a><a>Web Search</a><a>eUtils API</a><a>FTP Download</a>"
  );
  assert.deepEqual([...d.querySelectorAll("h2")].map((e) => e.textContent), [
    "获取数据", "变异数据库", "dbSNP 新闻与公告"
  ]);
  assert.equal(d.querySelector(".tagline").textContent, "简短遗传变异数据库");
  assert.deepEqual([...d.querySelectorAll("a")].map((e) => e.textContent), [
    "dbSNP 概览", "关于参考 SNP（rs）", "dbSNP 25 周年",
    "暂缓发布（HUP）政策", "提交检索", "变异服务",
    "GitHub 教程", "情况说明书", "网页检索", "eUtils 接口", "FTP 下载"
  ]);
});

test("首页：简介整段翻成中文", () => {
  const d = run(
    "<div class='dbdescription'>dbSNP contains human single nucleotide variations, microsatellites, and small-scale insertions and deletions along with publication, population frequency, molecular consequence, and genomic and RefSeq mapping information for both common variations and clinical mutations.</div>"
  );
  const t = d.querySelector(".dbdescription").textContent;
  assert.match(t, /收录人类单核苷酸变异、微卫星以及小规模插入和缺失/);
  assert.match(t, /基因组和 RefSeq 映射信息/);
  assert.doesNotMatch(t, /single nucleotide variations/);
});

test("首页检索表：说明列整句与内嵌链接都保留", () => {
  const d = run(
    "<table><tr><td>All of dbSNP (then use filters on results page)</td><td><a>all[sb]</a></td></tr>" +
      "<tr><td>Genomic location of a single position or range on GRCh38.  See the <a href='/a'>announcement</a> and the <a href='/b'>guide</a> for using GRCh37 coordinates</td><td><a href='/c'>6[Chromosome]</a></td></tr>" +
      "<tr><td>Global or study-wide minor allele frequency (GMAF) of a single frequency or range<br>(Note the required zero padding frequency as shown in example for 0.001 and 0.01)</td><td><a>00000.0010</a></td></tr></table>"
  );
  const tds = [...d.querySelectorAll("td")];
  assert.equal(tds[0].textContent, "全部 dbSNP（然后在结果页使用筛选器）");
  assert.equal(
    tds[2].textContent,
    "GRCh38 上单个位置或范围的基因组定位。参见公告以及使用 GRCh37 坐标的指南。"
  );
  assert.equal(tds[2].querySelectorAll("a")[0].getAttribute("href"), "/a");
  assert.equal(tds[2].querySelectorAll("a")[1].getAttribute("href"), "/b");
  assert.equal(tds[2].querySelectorAll("a")[0].textContent, "公告");
  assert.equal(tds[4].querySelector("br").tagName, "BR", "中间的 <br> 必须保留");
  assert.match(tds[4].textContent, /^全球或全研究范围的次要等位基因频率（GMAF）/);
  assert.match(tds[4].textContent, /补足前导零/);
});

test("检索结果页：筛选分组、枚举值与结果卡片标签", () => {
  const d = run(
    "<h3>Validation Status</h3><h3>Publication</h3><h3>Function Class</h3><h3>Global MAF</h3>" +
      "<label>Variation Class</label><label>Chromosome Range</label><label>Start Value</label><label>End Value</label>" +
      "<a>drug response</a><a>risk factor</a><a>by-ALFA</a><a>by-cluster</a><a>by-frequency</a>" +
      "<a>PubMed Cited</a><a>PubMed Linked</a>" +
      "<dt>Variant type:</dt><dd>SNV</dd><dt>Functional Consequence:</dt><dt>Validated:</dt><dt>MAF:</dt><dt>HGVS:</dt>" +
      "<a>[Show Flanks]</a><a>...more</a>"
  );
  assert.deepEqual([...d.querySelectorAll("h3")].map((e) => e.textContent), [
    "验证状态", "发表文献", "功能类别", "全球 MAF"
  ]);
  assert.deepEqual([...d.querySelectorAll("label")].map((e) => e.textContent), [
    "变异类别", "染色体范围", "起始值", "结束值"
  ]);
  assert.deepEqual([...d.querySelectorAll("a")].map((e) => e.textContent), [
    "药物反应", "风险因素", "按 ALFA 验证", "按聚类验证", "按频率验证",
    "PubMed 被引", "PubMed 关联", "[显示侧翼序列]", "更多…"
  ]);
  assert.deepEqual([...d.querySelectorAll("dt")].map((e) => e.textContent), [
    "变异类型：", "功能后果：", "已验证：", "MAF（次要等位基因频率）：", "HGVS 名称："
  ]);
  assert.equal(d.querySelector("dd").textContent, "SNV", "等位/变异类型值保持原样");
});

test("检索结果数：规则把「Items: N」换成中文并回填数字", () => {
  const d = run("<h3 class='result_count'>Items: 2</h3><h3>Items: 1,234</h3>");
  assert.deepEqual([...d.querySelectorAll("h3")].map((e) => e.textContent), ["条目：2", "条目：1,234"]);
});

test("记录页：欢迎提示整句模板，三个链接原样保留", () => {
  const d = run(
    "<p class='usa-alert-text'>All alleles are reported in the <a href='/orient'>Forward orientation</a>.  Click on the " +
      "<a href='#variant_details'>Variant Details tab</a> for details on Genomic Placement, Gene, and Amino Acid changes.  HGVS names are in the " +
      "<a href='#hgvs_tab'>HGVS tab</a>.</p>"
  );
  const p = d.querySelector("p");
  assert.equal(
    p.textContent,
    "所有等位基因均按正向取向报告。点击变异详情标签页可查看基因组定位、基因和氨基酸变化的详情。HGVS 名称见HGVS 标签页。"
  );
  const as = [...p.querySelectorAll("a")];
  assert.deepEqual(as.map((a) => a.getAttribute("href")), ["/orient", "#variant_details", "#hgvs_tab"]);
});

test("记录页：ALFA 频率说明整段模板，标题与链接都保留", () => {
  const d = run(
    "<p id='popfreq_tp'><font size='5' color='blue'><strong><a href='/snp/docs/gsr/alfa'>ALFA Allele Frequency</a></strong></font><br/>" +
      "\nThe ALFA project provide aggregate allele frequency from dbGaP.  More information is available on the project <a href='/snp/docs/gsr/alfa'>page</a> including descriptions, data access, and terms of use. " +
      "</p>"
  );
  const p = d.querySelector("#popfreq_tp");
  assert.match(p.textContent, /ALFA 项目提供来自 dbGaP 的汇总等位基因频率/);
  assert.match(p.textContent, /更多信息见项目页面。/);
  assert.equal(p.querySelectorAll("a")[1].getAttribute("href"), "/snp/docs/gsr/alfa");
  assert.ok(p.querySelector("br"), "<br> 必须保留");
});

test("记录页：标签页、汇总字段与人群频率表头", () => {
  const d = run(
    "<a>Variant Details</a><a>Flanks</a>" +
      "<dt>Variation Type</dt><dd>SNV</dd><dt>Gene : Consequence</dt><dd>APOE : Missense Variant</dd>" +
      "<dt>Genomic View</dt><dd><a>See rs on genome</a></dd>" +
      "<h2>rs7412</h2><p>Current Build <span>157</span></p>" +
      "<table><tr><th>Group</th><th>Sample Size</th><th>Ref Allele</th><th>Alt Allele</th>" +
      "<th>Ref HMOZ</th><th>Alt HMOZ</th><th>HTRZ</th><th>HWEP</th></tr>" +
      "<tr><td>Sub</td><td>Study-wide</td><td>temporarily unavailable</td><td>not provided</td></tr></table>"
  );
  assert.deepEqual([...d.querySelectorAll("a")].map((e) => e.textContent), ["变异详情", "侧翼序列", "在基因组上查看 rs"]);
  assert.deepEqual([...d.querySelectorAll("dt")].map((e) => e.textContent), ["变异类型", "基因：后果", "基因组视图"]);
  assert.equal(d.querySelectorAll("dd")[1].textContent, "APOE : Missense Variant", "基因与后果是数据，不翻");
  assert.equal(d.querySelector("p").textContent, "当前构建版本 157");
  assert.deepEqual([...d.querySelectorAll("th")].map((e) => e.textContent), [
    "分组", "样本量", "参考等位基因", "替代等位基因", "参考纯合子", "替代纯合子", "杂合子", "HWE P 值"
  ]);
  assert.deepEqual([...d.querySelectorAll("tbody td")].map((e) => e.textContent), [
    "亚组", "全研究范围", "暂时不可用", "未提供"
  ]);
});

test("规则：变异查看器链接与软件版本句回填动态部分", () => {
  const d = run("<a>See rs7412 in Variation Viewer</a><div>Software version is: 0.0.0.post104.dev0+e4e5e77</div>");
  assert.equal(d.querySelector("a").textContent, "在变异浏览器中查看 rs7412");
  assert.equal(d.querySelector("div").textContent, "软件版本：0.0.0.post104.dev0+e4e5e77");
});

test("数据保持原样：rsID、登录号、等位基因、物种名与检索式都不动", () => {
  const d = run(
    "<dd>rs7412</dd><dd>NC_000019.10:44908821:C:T</dd><dd>C>T</dd><dd>Homo sapiens</dd>" +
      "<table><tr><td>19:44908822 (GRCh38)</td><td>APOE</td><td>missense_variant,coding_sequence_variant</td></tr></table>" +
      "<a>6[Chromosome] AND (1500000:3000000[Base Position] )</a>"
  );
  assert.deepEqual([...d.querySelectorAll("dd")].map((e) => e.textContent), [
    "rs7412", "NC_000019.10:44908821:C:T", "C>T", "Homo sapiens"
  ]);
  assert.deepEqual([...d.querySelectorAll("td")].map((e) => e.textContent), [
    "19:44908822 (GRCh38)", "APOE", "missense_variant,coding_sequence_variant"
  ]);
  assert.equal(d.querySelector("a").textContent, "6[Chromosome] AND (1500000:3000000[Base Position] )");
});

test("词表自检：条数、汉字、无邮箱与裸网址、键无首尾空白", () => {
  const keys = Object.keys(snp.exact);
  assert.ok(keys.length >= 40, "exact 条数应 ≥ 40，实际 " + keys.length);
  const cjk = /[\u4e00-\u9fff]/;
  for (const [k, v] of Object.entries(snp.exact)) {
    assert.equal(typeof v, "string", "译文必须是字符串: " + k);
    assert.ok(k.trim().length > 0, "英文键不应为空");
    assert.equal(k, k.trim(), "英文键不应有首尾空白: " + JSON.stringify(k));
    assert.equal(v, v.trim(), "译文不应有首尾空白: " + k.slice(0, 60));
    assert.notEqual(k, v, "不应自映射: " + k.slice(0, 60));
    assert.match(v, cjk, "译文应含汉字: " + k.slice(0, 60));
    assert.doesNotMatch(v, /[\w.+-]+@[\w-]+\.[\w.]+/, "译文不应含邮箱: " + k.slice(0, 60));
    assert.ok(!v.includes("http"), "译文不应含网址: " + k.slice(0, 60));
    assert.ok(!v.includes(".gov"), "译文不应含 .gov 链接: " + k.slice(0, 60));
  }
  assert.ok(Array.isArray(snp.rules), "rules 必须是数组");
  assert.ok(Array.isArray(snp.templates), "templates 必须是数组");
});

test("词表自检：规则可编译、模板占位符 1..N 一一对应", () => {
  const cjk = /[\u4e00-\u9fff]/;
  for (const r of snp.rules) {
    const re = new RegExp(r.re);
    assert.ok(re instanceof RegExp, "规则应可编译: " + r.re);
    assert.match(r.to, cjk, "规则译文应含汉字: " + r.re);
    const groups = new RegExp(r.re + "|").exec("").length - 1;
    for (const m of r.to.matchAll(/\$(\d)/g)) {
      assert.ok(Number(m[1]) <= groups, "引用不存在的捕获组: " + r.re);
    }
  }
  for (const t of snp.templates) {
    assert.doesNotMatch(t.pat, cjk, "pat 不应含中文: " + t.pat.slice(0, 60));
    assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, "pat 长度不合规: " + t.pat.length);
    assert.match(t.zh, cjk, "模板译文应含汉字");
    const slots = (t.pat.match(/\{\{\d+\}\}/g) || []).length;
    const used = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.equal(used.length, slots, "占位符个数必须与 pat 一致: " + t.pat.slice(0, 60));
    used.forEach((v, i) => assert.equal(v, i + 1, "占位符顺序必须 1..N: " + t.pat.slice(0, 60)));
  }
});
