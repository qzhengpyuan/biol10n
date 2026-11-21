// fill-r19（r19 补漏：GTEx 数据集页 / HPA 单细胞页 / PubMed 首页公告）回归：结构、条数、关键条目、模板槽位与渲染
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, "../dict", f), "utf8"));

const dict = read("fill-r19.json");
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;

// 三个站点的真实词库栈，末尾接本册
const STACKS = {
  gtex: ["common", "anatomy", "spa", "gtex", "gtex-home", "fill-r19"],
  hpa: ["common", "hpa", "anatomy", "onco", "hpa2", "fill-r19"],
  pubmed: ["common", "ncbi", "ncbi-help", "pubmed2", "fill-r19"]
};
const HOSTS = {
  gtex: "https://gtexportal.org/home/downloads/adult-gtex/overview",
  hpa: "https://www.proteinatlas.org/humanproteome/single+cell",
  pubmed: "https://pubmed.ncbi.nlm.nih.gov/"
};
const SITE = { scope: "body", block: "pre, code", rescan: false };

function siteData(site) {
  const exact = {}, rules = [], templates = [];
  for (const id of STACKS[site]) {
    const file = path.join(root, "../dict", id + ".json");
    if (!fs.existsSync(file)) continue;
    const d = read(id + ".json");
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
    templates.push(...(d.templates || []));
  }
  return { exact, rules, templates };
}

function boot(site, html) {
  const dom = new JSDOM(html, { url: HOSTS[site] });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: siteData(site),
    site: SITE
  });
  engine.start();
  return { dom, engine, doc: dom.window.document };
}

test("词库结构：three hosts、条数、字段规整", () => {
  assert.deepEqual((dict.meta.sites || []).slice().sort(), [
    "gtexportal.org",
    "pubmed.ncbi.nlm.nih.gov",
    "www.proteinatlas.org"
  ]);
  const exact = Object.entries(dict.exact || {});
  assert.equal(exact.length, 37, "exact 条数应为 37，实为 " + exact.length);
  assert.equal((dict.templates || []).length, 20, "templates 条数应为 20");
  assert.deepEqual(dict.rules || [], [], "本册不新增规则（动态串走模板）");

  const bad = [];
  for (const [en, zh] of exact) {
    if (!en || en !== en.trim()) bad.push("键首尾空白: " + JSON.stringify(en));
    if (CJK.test(en)) bad.push("键含中文: " + en);
    if (!zh || zh !== zh.trim()) bad.push("空译文: " + en);
    if (!CJK.test(zh)) bad.push("译文无中文: " + en);
    if (en === zh) bad.push("自映射: " + en);
    if (/https?:\/\/|www\./.test(zh)) bad.push("译文含 URL: " + en);
  }
  assert.deepEqual(bad, []);
});

test("模板：占位符与译文槽位一一对应，不含半中半英", () => {
  const problems = [];
  for (const t of dict.templates) {
    const pat = t.pat || "", zh = t.zh || "";
    const ps = [...pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    const zs = [...zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    if (!ps.length) problems.push("无槽位: " + pat.slice(0, 40));
    const expect = ps.map((_, i) => i + 1);
    if (ps.join(",") !== expect.join(",")) problems.push("pat 槽位不连续: " + pat.slice(0, 40));
    if (zs.join(",") !== expect.join(",")) problems.push("zh 槽位与 pat 不一致: " + pat.slice(0, 40));
    if (!CJK.test(zh)) problems.push("译文无中文: " + pat.slice(0, 40));
    if (pat.length < 20) problems.push("pat 过短: " + pat);
  }
  assert.deepEqual(problems, []);
});

test("关键条目：GTEx 描述句、HPA 单细胞说明、PubMed 公告", () => {
  assert.match(
    dict.exact["The Adult Genotype-Tissue Expression (GTEx) project is a comprehensive public resource for the study of tissue-specific gene expression and regulation. Samples were collected from 54 non-diseased tissue sites across nearly 1000 individuals, primarily for molecular assays including WGS, WES, and RNA-Seq."] || "",
    /^成人基因型-组织表达（GTEx）项目/
  );
  assert.match(
    dict.exact["eGenes (genes with one or more significant expression QTLs) and significant variant-gene associations based on permutations. The archive contains a *.egenes.txt.gz and *.signif_variant_gene_pairs.txt.gz file for each tissue. Note that the *.egenes.txt.gz files contain data for all genes tested; to obtain the list of eGenes, select the rows with 'qval' ≤ 0.05."] || "",
    /eGenes（具有一个或多个显著表达 QTL 的基因）/
  );
  assert.equal(dict.exact["Release History page"], "版本历史页面");
  assert.equal(dict.exact["h5ad format"], "h5ad 格式");
  assert.match(
    dict.exact["The Single cell type section, providing the expression profiles across 155 cell types from 34 human tissue types, and cell type specificity based on gene expression."] || "",
    /^「单细胞类型」部分/
  );
  assert.equal(dict.exact["The tissue and cell specific proteome"], "组织与细胞特异性蛋白质组");
  assert.equal(dict.exact["Data Updates Scheduled for 2027 Baseline"], "数据更新定于 2027 基线");
  assert.equal(dict.exact["Introducing Linked Discoveries™!"], "隆重推出 Linked Discoveries™！");
  // PubMed 改版公告条的三条文案已在 ncbi.json 里，缺的是 pubmed 的 scope，不是词条
  assert.ok(!("NIH Websites Are Changing" in dict.exact), "公告条不重复收，见 ncbi.json");
});

test("不翻的类别：文件名、版本号、路径、文献标题都不在本册 exact 里", () => {
  const keys = Object.keys(dict.exact);
  const bad = keys.filter(
    (k) =>
      /\.(gz|tar|tgz|txt|tsv|csv|vcf|bed|gct|bam|pdf|zip|bgz|rds)$/i.test(k) ||
      /^GTEx_Analysis_/.test(k) ||
      /^https?:\/\//.test(k)
  );
  assert.deepEqual(bad, []);
  // 文献标题也不收
  assert.ok(!keys.includes("The World Federation of ADHD International Consensus Statement: 2026 Update."));
  assert.ok(!keys.includes("Hormozdiari et al., Genetics, 2014"));
});

test("引擎（GTEx）：主论文句走模板，链接与论文标题原样保留", () => {
  const { doc } = boot(
    "gtex",
    "<main><p>The main GTEx Consortium paper for this release is: " +
      '<a href="https://doi.org/10.1126/science.aaz1776">The GTEx Consortium atlas of genetic regulatory effects across human tissues</a>' +
      ". Data QC and analysis methods are described extensively in that paper.</p></main>"
  );
  const p = doc.querySelector("p");
  assert.match(p.textContent, /本版本主要的 GTEx 联盟论文为：/);
  assert.match(p.textContent, /该论文对数据质控与分析方法有详尽描述。/);
  assert.doesNotMatch(p.textContent, /Data QC and analysis methods/);
  const a = p.querySelector("a");
  assert.ok(a, "链接节点必须保留");
  assert.equal(a.getAttribute("href"), "https://doi.org/10.1126/science.aaz1776");
  assert.equal(a.textContent, "The GTEx Consortium atlas of genetic regulatory effects across human tissues");
});

test("引擎（GTEx）：AnVIL 段落模板保留三个链接与版本化文件名", () => {
  const { doc } = boot(
    "gtex",
    "<main><p>All variant-gene cis-eQTL associations tested in each tissue (including non-significant associations). " +
      "These data are available in a requester pays bucket on Anvil, at " +
      '<a href="https://console.cloud.google.com/storage/browser/_details/anvil">AnVIL_GTEx_public_data/adult-gtex/bulk-qtl/v11/single-tissue-cis-qtl/</a>. ' +
      "The subdirectory GTEx_Analysis_v11_eQTL_all_associations is ~260 GB. " +
      'Google egress pricing can be found at <a href="https://cloud.google.com/vpc/network-pricing">https://cloud.google.com/vpc/network-pricing</a>. ' +
      'Google documentation for downloading data from a requester-pays bucket can be found at <a href="https://cloud.google.com/storage/docs/requester-pays">https://cloud.google.com/storage/docs/requester-pays</a></p></main>'
  );
  const p = doc.querySelector("p");
  assert.match(p.textContent, /各组织中检测的全部变异-基因顺式 eQTL 关联（含不显著关联）。/);
  assert.match(p.textContent, /Google 出网流量定价见/);
  assert.match(p.textContent, /GTEx_Analysis_v11_eQTL_all_associations 约 260 GB/);
  const links = [...p.querySelectorAll("a")];
  assert.equal(links.length, 3, "三个内联链接都要保留");
  assert.deepEqual(
    links.map((a) => a.getAttribute("href")),
    [
      "https://console.cloud.google.com/storage/browser/_details/anvil",
      "https://cloud.google.com/vpc/network-pricing",
      "https://cloud.google.com/storage/docs/requester-pays"
    ]
  );
});

test("引擎（HPA）：四部分说明段三链接保留；TF 段的 <br> 槽位成立", () => {
  const { doc } = boot(
    "hpa",
    "<main>" +
      "<p>Learn more about each of these four parts down below, and explore the details of each dataset, or serach for a gene and browse the expression details side by side across the different datasets on the gene summary pages. " +
      "More information about the content, the generation and analysis of the data in this resource can be found under respective link or here for " +
      '<a href="/humanproteome/single+cell/single+cell+type/method">single cell type</a>, ' +
      '<a href="/humanproteome/single+cell/dvp/method">DVP</a>, and ' +
      '<a href="/humanproteome/single+cell/tissue+cell+type/method">tissue cell type</a>.</p>' +
      "<div><p><strong>" +
      '<a href="/humanproteome/single+cell/transcription+factor+landscape">Transcription factor landscape</a>' +
      "</strong><br>\n<br>\nExplore the expression landscape of the " +
      '<a href="/search/protein_class%3ATranscription+factors%3BAny">1485</a> ' +
      "transcription factors throughout human cell types representing both normal tissue and cell types, as well as cancer cell lines. </p></div>" +
      "</main>"
  );
  const [intro, tf] = doc.querySelectorAll("p");
  assert.match(intro.textContent, /下面将逐一介绍这四个部分/);
  assert.match(intro.textContent, /的相关说明。/);
  assert.doesNotMatch(intro.textContent, /More information about the content/);
  assert.deepEqual(
    [...intro.querySelectorAll("a")].map((a) => a.getAttribute("href")),
    [
      "/humanproteome/single+cell/single+cell+type/method",
      "/humanproteome/single+cell/dvp/method",
      "/humanproteome/single+cell/tissue+cell+type/method"
    ]
  );

  assert.equal(tf.querySelectorAll("br").length, 2, "<br> 槽位要原样保留");
  assert.match(tf.textContent, /浏览 1485 个转录因子在人体各细胞类型/);
  assert.match(tf.textContent, /表达图谱。/);
  assert.doesNotMatch(tf.textContent, /Explore the expression landscape/);
  const strongLink = tf.querySelector("strong a");
  assert.ok(strongLink, "标题链接必须保留");
  assert.equal(strongLink.getAttribute("href"), "/humanproteome/single+cell/transcription+factor+landscape");
});

test("引擎（PubMed）：公告标题与摘要成中文，文献标题维持英文", () => {
  const { doc } = boot(
    "pubmed",
    "<main>" +
      '<article><a href="/about/">Data Updates Scheduled for 2027 Baseline</a>' +
      '<p class="snippet">There will be no change to the PubMed DTD for 2027. There are two upcoming changes to PubMed data that will take effect when the 2027 PubMed baseline is published.</p></article>' +
      '<article><a href="/about/">New &amp; Noteworthy RSS Feed Has a New URL</a>' +
      '<p class="snippet">PubMed&apos;s New &amp; Noteworthy RSS feed provides another way to stay up to date with the latest news published in the NLM Technical Bulletin for PubMed.</p></article>' +
      '<a href="/?term=adhd">The World Federation of ADHD International Consensus Statement: 2026 Update.</a>' +
      "</main>"
  );
  const [a1, a2] = [...doc.querySelectorAll("a")];
  assert.equal(a1.textContent, "数据更新定于 2027 基线");
  assert.equal(a2.textContent, "New & Noteworthy RSS 订阅源有了新网址");
  const [s1, s2] = [...doc.querySelectorAll("p.snippet")];
  assert.equal(
    s1.textContent,
    "2027 年 PubMed DTD 不会有变化。PubMed 数据有两项即将到来的改动，将在 2027 年 PubMed 基线发布时生效。"
  );
  assert.match(s2.textContent, /^PubMed 的 New & Noteworthy RSS 订阅源/);
  assert.equal(
    doc.querySelector('a[href="/?term=adhd"]').textContent,
    "The World Federation of ADHD International Consensus Statement: 2026 Update."
  );
});

test("引擎（GTEx）：数据集页表格里的 SV 说明句整句成中文", () => {
  const { doc } = boot(
    "gtex",
    "<main><table><tbody><tr><td class=\"desc-col\"><span>Structural Variant (SV) sites only call set of unified LUMPY and Genome STRiP SVs from 147 whole genome sequences (GTEx V6 data) (The SV call set with sample genotypes can be downloaded from dbGaP accession number phs000424.v7.p1)</span></td></tr></tbody></table></main>"
  );
  // 单元格里只有这一个文本节点，段落通道会整格换掉（span 被收进原节点备份），译文落在 td 上
  const td = doc.querySelector("td.desc-col");
  assert.ok(td, "表格单元格必须还在");
  assert.match(td.textContent, /^结构变异（SV）位点仅包含来自 147 个全基因组序列的 LUMPY 与 Genome STRiP SV 统一调用集/);
  assert.match(td.textContent, /dbGaP 登录号 phs000424\.v7\.p1 下载）/);
  assert.doesNotMatch(td.textContent, /sites only call set/);
});
