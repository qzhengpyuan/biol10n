// UCSC Variant Annotation Integrator 站词库（dict/ucsc-vai.json）冒烟测试：
// 表单骨架、区段说明、SO 术语说明与 HGVS 选项；dbNSFP/PolyPhen-2/SIFT 等工具名与 hgVai track 名保持原文。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/ucsc-vai.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "ucsc");

const CJK = /[\u4e00-\u9fff]/;
const URL_RE = /https?:\/\//i;
const MAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/;

function engineFor(html, url) {
  const dom = new JSDOM(html, { url: url || "https://genome.ucsc.edu/cgi-bin/hgVai" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: dict.exact, rules: dict.rules || [], templates: dict.templates || [] },
    site
  });
  engine.start();
  return { doc: dom.window.document, engine };
}

test("词库结构：family/sites 正确，exact 条目充足且译文都含汉字", () => {
  assert.equal(dict.meta.family, "ucsc");
  assert.ok(dict.meta.sites.includes("genome.ucsc.edu"));
  const keys = Object.keys(dict.exact);
  assert.ok(keys.length >= 130, "exact 只有 " + keys.length + " 条");
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.match(v, CJK, "译文不含汉字: " + k + " => " + v);
  }
  for (const r of dict.rules || []) assert.match(r.to, CJK, "规则译文不含汉字: " + r.re);
});

test("条目卫生：key 无中文、无首尾空白，值无明文 URL / 邮箱", () => {
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.doesNotMatch(k, CJK, "key 含中文: " + k);
    assert.equal(k, k.trim(), "key 首尾有空白: " + JSON.stringify(k));
    assert.equal(v, v.trim(), "值首尾有空白: " + k);
    assert.doesNotMatch(v, URL_RE, "值含明文 URL: " + k);
    assert.doesNotMatch(v, MAIL_RE, "值含明文邮箱: " + k);
  }
});

test("模板结构：长度 20-2200、槽位与占位符一一对应、无中文、pat 不重复", () => {
  const tpls = dict.templates || [];
  assert.ok(tpls.length >= 15, "模板只有 " + tpls.length + " 条");
  const seen = new Set();
  for (const t of tpls) {
    assert.equal(typeof t.pat, "string");
    assert.equal(typeof t.zh, "string");
    assert.doesNotMatch(t.pat, CJK, "pat 含中文: " + t.pat.slice(0, 40));
    assert.match(t.zh, CJK, "模板译文不含汉字: " + t.pat.slice(0, 40));
    assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, "pat 长度越界: " + t.pat.length);
    const holes = (t.pat.match(/\{\{\d+\}\}/g) || []).map((s) => Number(s.replace(/\D/g, "")));
    assert.ok(holes.length > 0, "pat 没有占位符: " + t.pat.slice(0, 40));
    assert.deepEqual(holes, [...Array(holes.length).keys()].map((i) => i + 1), "pat 占位符不连续: " + t.pat.slice(0, 40));
    const used = [...new Set((t.zh.match(/\{\{\d+\}\}/g) || []).map((s) => Number(s.replace(/\D/g, ""))))].sort((a, b) => a - b);
    assert.deepEqual(used, holes, "zh 占位符与 pat 不一致: " + t.pat.slice(0, 40));
    assert.ok(!seen.has(t.pat), "pat 重复: " + t.pat.slice(0, 40));
    seen.add(t.pat);
  }
});

test("关键条目存在：基因组/区域、Select Variants/Genes、HGVS、SO 与输出区段", () => {
  const must = [
    "Select Genome Assembly and Region",
    "Change selected genome:",
    "Current Genome:",
    "region to annotate",
    "Select Variants",
    "Select Genes",
    "Select Regulatory Annotations",
    "Select More Annotations (optional)",
    "HGVS variant nomenclature",
    "Include HGVS genomic (g.) terms in output",
    "Include HGVS protein (p.) terms (if applicable) in output",
    "Transcript status",
    "Known variation",
    "Configure Output",
    "output format:",
    "file type returned:",
    "Using the Variant Annotation Integrator",
    "Submitting your variant calls",
    "Protein-coding gene transcript effect predictions",
    "Sequence Ontology (SO)",
    "SO term",
    "Optional annotations",
    "Output format"
  ];
  for (const k of must) assert.ok(k in dict.exact, "缺少条目: " + k);
});

test("不翻名单：工具名、SO 标识符与 hgVai track 名不得出现在词库里", () => {
  const banned = [
    "SIFT",
    "PolyPhen-2",
    "MutationTaster",
    "MutationAssessor",
    "GERP++",
    "InterPro",
    "LRT",
    "VEST",
    "dbNSFP",
    "regulatory_region_variant",
    "missense_variant",
    "intron_variant",
    "splice_donor_variant",
    "GENCODE V43",
    "NCBI RefSeq genes, curated subset (NM_*, NR_*, NP_* or YP_*)",
    "MANE Select Plus Clinical: Representative transcript from RefSeq & GENCODE"
  ];
  for (const k of banned) assert.ok(!(k in dict.exact), "不该收的条目: " + k);
  assert.equal(dict.exact["Personal Genome SNP (pgSnp)"], "个人基因组 SNP（pgSnp）", "格式全名可以翻，缩写保留");
});

test("表单骨架：基因组切换、变异来源、基因选择与输出选项", () => {
  const { doc } = engineFor(
    '<div class="searchCell">' +
      '<label for="genomeSearch" class="genomeSearchLabelDefault">Change selected genome:</label>' +
      '<div class="searchCell">Current Genome: <span id="genomeLabel">Dec. 2013 (GRCh38/hg38)</span></div>' +
      '<span>region to annotate</span>' +
      '<div class="sectionLiteHeader">Select Variants</div>' +
      "Your session doesn't have any custom tracks or hub tracks in " +
      '<a href="#1">pgSnp</a> or <a href="#2">VCF</a> format.' +
      '<b>variants: </b><select id="hgva_variantTrack">' +
      '<option value="hgva_internally_generated_sample_variants">Artificial Example Variants</option>' +
      '<option value="hgva_useHgvs">HGVS terms</option>' +
      '<option value="hgva_useVariantIds">Variant Identifiers</option>' +
      '<option value="knownGeneV43">GENCODE V43</option>' +
      "</select>" +
      "<b>maximum number of variants to be processed:</b>" +
      '<div class="sectionLiteHeader">Select Genes</div>' +
      "The gene predictions selected here will be used to determine the effect of each variant on genes, for example intronic, missense, splice site, intergenic etc." +
      '<div class="sectionLiteHeader">Select Regulatory Annotations</div>' +
      "The annotations in this section provide predicted regulatory regions based on various experimental data.  When a variant overlaps an annotation selected here, the consequence term " +
      '<a href="#so">regulatory_region_variant</a>' +
      " will be assigned.  Follow the links to description pages that explain how each dataset was constructed.  Some datasets cover a significant portion of the genome and it may be desirable to filter these annotations by cell type and/or score in order to avoid an overabundance of hits." +
      '<b>filter items</b><div>minimum peak score [0-1000]:</div>' +
      '<div class="sectionLiteHeader">Define Filters</div>' +
      "<b>Functional role</b><div>Include variants annotated as</div>" +
      '<div class="setClearContainer">intergenic</div>' +
      '<div class="setClearContainer">CDS - non-synonymous (missense, stop gain/loss, frameshift etc)</div>' +
      "<div>Include only the variants that overlap:</div>" +
      '<div class="sectionLiteHeader">Configure Output</div>' +
      "<b>output format:</b><b>output file:</b><div>(leave blank to keep output in browser)</div>" +
      "<b>file type returned:</b><div>plain text</div>" +
      '<div>gzip compressed (ignored if output file is blank)</div>'
  );
  const text = doc.body.textContent.replace(/\s+/g, " ");

  assert.equal(doc.querySelector("label").textContent, "更改所选基因组：");
  assert.match(text, /当前基因组：/);
  assert.match(text, /待注释区域/);
  const headers = [...doc.querySelectorAll(".sectionLiteHeader")].map((e) => e.textContent.trim());
  assert.deepEqual(headers, ["选择变异", "选择基因", "选择调控注释", "设置筛选条件", "配置输出"]);

  assert.match(text, /您的会话中没有自定义轨道或 hub 轨道，可用\s*pgSnp\s*.*VCF\s*格式。/);
  const opts = [...doc.querySelectorAll("option")];
  assert.deepEqual(opts.map((o) => o.textContent.trim()), [
    "内置示例变异", "HGVS 术语", "变异标识符", "GENCODE V43"
  ]);
  assert.deepEqual(opts.map((o) => o.value), [
    "hgva_internally_generated_sample_variants", "hgva_useHgvs", "hgva_useVariantIds", "knownGeneV43"
  ], "option value 绝不能改");
  assert.match(text, /变异：/);
  assert.match(text, /待处理变异的最大数量：/);
  assert.match(text, /此处选择的基因预测将用于判定每个变异对基因的影响/);
  assert.match(text, /本节的注释基于多种实验数据提供预测的调控区/);
  assert.equal(doc.querySelector('a[href="#so"]').textContent, "regulatory_region_variant", "SO 标识符保持原文");

  const roles = [...doc.querySelectorAll(".setClearContainer")].map((e) => e.textContent.trim());
  assert.deepEqual(roles, ["基因间", "CDS - 非同义（错义、终止密码子获得/丢失、移码等）"]);
  assert.match(text, /仅包含与以下重叠的变异：/);
  assert.match(text, /输出格式：/);
  assert.match(text, /输出文件：/);
  assert.match(text, /（留空则输出保留在浏览器中）/);
  assert.match(text, /返回的文件类型：/);
  assert.match(text, /纯文本/);
  assert.match(text, /gzip 压缩（输出文件为空时忽略）/);
});

test("模板：提交变异段的整段译文保留 pgSnp / VCF / 自定义轨道 / 轨道 Hub 链接", () => {
  const { doc } = engineFor(
    "<p>In order to use the VAI, you must provide variant calls in either the " +
      '<a href="#pg">Personal Genome SNP (pgSnp)</a> or <a href="#vcf">VCF</a> format. ' +
      "pgSnp-formatted variants may be uploaded as a " +
      '<a href="#ct">Custom Track</a>. Compressed and indexed VCF files must be on a web server ' +
      "(HTTP, HTTPS or FTP) and configured as Custom Tracks, or if you happen to have a " +
      '<a href="#th">Track Hub</a>, as hub tracks.</p>'
  );
  const p = doc.querySelector("p");
  assert.match(p.textContent, /要使用 VAI，您必须以\s*个人基因组 SNP（pgSnp）\s*或\s*VCF\s*格式提供变异检出结果。/);
  assert.match(p.textContent, /压缩并建立索引的 VCF 文件必须放在 Web 服务器（HTTP、HTTPS 或 FTP）上并配置为自定义轨道/);
  const links = [...p.querySelectorAll("a")];
  assert.deepEqual(links.map((a) => a.getAttribute("href")), ["#pg", "#vcf", "#ct", "#th"]);
  assert.deepEqual(links.map((a) => a.textContent), ["个人基因组 SNP（pgSnp）", "VCF", "自定义轨道", "轨道 Hub"]);
});

test("模板：dbNSFP 预测器条目整段翻译，工具名与文献链接保留", () => {
  const { doc } = engineFor(
    "<ul><li><b>" +
      '<a href="#sift">SIFT (Sorting Intolerant From Tolerant)</a></b> ' +
      "uses sequence homology and the physical properties of amino acids to predict whether an amino acid substitution affects protein function. " +
      'Scores less than 0.05 are classified as Damaging ("D" in output); higher scores are classified as Tolerated ("T"). ' +
      '(<a href="#ng">Ng and Henikoff, 2003</a>)</li></ul>'
  );
  const li = doc.querySelector("li");
  assert.match(li.textContent, /利用序列同源性和氨基酸的物理性质预测某个氨基酸替换是否影响蛋白质功能/);
  assert.match(li.textContent, /评分小于 0.05 判定为有害/);
  assert.equal(li.querySelector("b a").textContent, "SIFT (Sorting Intolerant From Tolerant)", "工具名保持原文");
  assert.equal(li.querySelectorAll("a")[1].textContent, "Ng and Henikoff, 2003", "文献保持原文");
  assert.equal(li.querySelectorAll("a")[1].getAttribute("href"), "#ng");
});

test("模板：HGVS 命名与转录本状态说明整段翻译，链接保留", () => {
  const { doc } = engineFor(
    "<table><tr><td>The " + '<a href="#hgvs">Human Genome Variation Society (HGVS)</a> has established a ' +
      '<a href="#varnomen">sequence variant nomenclature</a>, an international standard used to report variation ' +
      "in genomic, transcript and protein sequences.</td></tr></table>" +
      "<ul><li><b>GENCODE tags:</b> when GENCODE Genes are selected in the \"Select Genes\" section, any " +
      '<a href="#tags">GENCODE tags</a> associated with a transcript can be added to output.</li></ul>'
  );
  const td = doc.querySelector("td");
  assert.match(td.textContent, /该 Human Genome Variation Society \(HGVS\) 已确立\s*序列变异命名规范/);
  assert.match(td.textContent, /这是用于报告基因组、转录本和蛋白质序列变异的国际标准。/);
  assert.equal(td.querySelectorAll("a")[1].textContent, "序列变异命名规范");
  const li = doc.querySelector("li");
  assert.equal(li.querySelector("b").textContent, "GENCODE 标签：");
  assert.equal(li.querySelector("a").textContent, "GENCODE 标签");
  assert.match(li.textContent, /当在“选择基因”部分选择 GENCODE Genes 时，任何与转录本关联的\s*GENCODE 标签\s*都可加入输出。/);
});

test("SO 术语说明表：术语名保持英文，说明整句翻译", () => {
  const { doc } = engineFor(
    '<table class="stdTbl"><tbody><tr><th>SO term</th><th>description</th></tr>' +
      '<tr><td><a href="#so1">intergenic_variant</a></td>' +
      "<td>A sequence variant located in the intergenic region, between genes.</td></tr>" +
      '<tr><td><a href="#so2">frameshift_variant</a></td>' +
      "<td>A sequence variant which causes a disruption of the translational reading frame, because the number of nucleotides inserted or deleted is not a multiple of three.</td></tr>" +
      "</tbody></table>"
  );
  const ths = [...doc.querySelectorAll("th")].map((t) => t.textContent);
  assert.deepEqual(ths, ["SO 术语", "说明"]);
  const cells = [...doc.querySelectorAll("td")];
  assert.equal(cells[0].textContent, "intergenic_variant", "SO 标识符不翻");
  assert.equal(cells[1].textContent, "位于基因间区（基因之间）的序列变异。");
  assert.equal(cells[2].textContent, "frameshift_variant");
  assert.match(cells[3].textContent, /^由于插入或删除的核苷酸数不是三的倍数而破坏翻译阅读框的序列变异。$/);
});

test("文档段落：dissclaimer、筛选与输出格式整段翻译", () => {
  const { doc } = engineFor(
    "<p>The VAI is only a research tool and should never be used to make any kind of medical decision. " +
      "We urge users seeking information about a personal medical or genetic condition to consult with a qualified physician " +
      "for diagnosis and for answers to personal questions.</p>" +
      "<h2>Output format</h2>" +
      "<p>The volume of unrestricted output can be quite large, making it difficult to identify variants of particular interest. " +
      "Several filters can be applied to keep only those variants that have specific properties.</p>" +
      '<div id="disclaimerDialog">This tool is for research use only. While this tool is open to the public, users seeking information about a personal medical or genetic condition are urged to consult with a qualified physician for diagnosis and for answers to personal questions.</div>'
  );
  const text = doc.body.textContent;
  assert.match(text, /VAI 只是研究工具，绝不应被用于做出任何形式的医疗决策/);
  assert.match(text, /不加限制时输出量可能相当大，难以找出特别关注的变异/);
  assert.match(text, /本工具仅供研究使用。/);
  assert.equal(doc.querySelector("h2").textContent, "输出格式");
});
