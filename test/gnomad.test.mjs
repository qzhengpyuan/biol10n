// gnomAD 浏览器词库（dict/gnomad.json）冒烟测试：导航、首页、基因页约束区、变异页字段、下载页与帮助页
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/gnomad.json"), "utf8"));
const common = JSON.parse(fs.readFileSync(path.join(root, "../dict/common.json"), "utf8"));
const spa = JSON.parse(fs.readFileSync(path.join(root, "../dict/spa.json"), "utf8"));

// sites.json 尚未登记 gnomAD，这里按推荐条目构造站点配置（dicts 顺序与建议一致）
const site = {
  id: "gnomad",
  name: "gnomAD",
  hosts: ["gnomad.broadinstitute.org"],
  dicts: ["common", "spa", "gnomad"],
  scope: "body",
  spa: true,
  waitFor: "body"
};

// 站点实际加载的是 common + spa（本册接入后再加上本册），合并后的词表才是页面真实行为
const all = {
  exact: Object.assign({}, common.exact, spa.exact, dict.exact),
  rules: [...(common.rules || []), ...(spa.rules || []), ...dict.rules],
  templates: [...(common.templates || []), ...(spa.templates || []), ...dict.templates]
};

const CJK = /[\u4e00-\u9fff]/;

function engineFor(html, url) {
  const dom = new JSDOM(html, { url: url || "https://gnomad.broadinstitute.org/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: all,
    site
  });
  engine.start();
  return { doc: dom.window.document, engine };
}

const anyEngine = engineFor("<p>x</p>").engine;
function covers(k) {
  return k in all.exact || anyEngine.translateText(k) !== null;
}
function text(el) {
  return el.textContent.replace(/\s+/g, " ").trim();
}

test("词库结构：family/sites 正确，exact 有足够条目且译文都含汉字", () => {
  assert.equal(dict.meta.family, "gnomad");
  assert.deepEqual(dict.meta.sites, ["gnomad.broadinstitute.org"]);
  const keys = Object.keys(dict.exact);
  assert.ok(keys.length >= 180, "exact 只有 " + keys.length + " 条");
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.notEqual(v, k, "自映射: " + k);
    assert.match(v, CJK, "译文不含汉字: " + k + " => " + v);
  }
  assert.ok(dict.rules.length >= 5, "规则太少");
  for (const r of dict.rules) {
    assert.doesNotThrow(() => new RegExp(r.re), "坏正则: " + r.re);
    assert.match(r.to, CJK, "规则译文不含汉字: " + r.re);
    assert.ok(/\((?!\?)/.test(r.re), "规则没有捕获组: " + r.re);
  }
  const tpl = dict.templates || [];
  for (const t of tpl) {
    assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, "模板 pat 长度越界: " + t.pat.length);
    assert.match(t.zh, CJK, "模板译文不含汉字: " + t.pat);
    const slots = (t.pat.match(/\{\{\d+\}\}/g) || []).length;
    assert.ok(slots >= 1, "模板没有槽位: " + t.pat);
    for (let i = 1; i <= slots; i++) assert.ok(t.pat.includes("{{" + i + "}}"), "槽位不连续: " + t.pat);
    assert.equal((t.zh.match(/\{\{\d+\}\}/g) || []).length, slots, "译文槽位数不一致: " + t.pat);
    assert.doesNotMatch(t.zh, /[\w.+-]+@[\w-]+\.[\w.]+/, "模板译文含明文邮箱: " + t.pat);
  }
});

test("条目卫生：key 不含中文、首尾无空白，值里没有明文 URL / 邮箱", () => {
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.doesNotMatch(k, CJK, "key 含中文: " + k);
    assert.equal(k, k.trim(), "key 首尾有空白: " + JSON.stringify(k));
    assert.equal(v, v.trim(), "值首尾有空白: " + k);
    assert.doesNotMatch(v, /https?:\/\//i, "值含明文 URL: " + k);
    assert.doesNotMatch(v, /[\w.+-]+@[\w-]+\.[\w.]+/, "值含明文邮箱: " + k);
    assert.doesNotMatch(k, /[\r\n]/, "key 含换行: " + k);
  }
});

test("顶部导航、首页主视觉与示例区块", () => {
  const must = [
    "gnomAD browser",
    "About",
    "Team",
    "Federated",
    "Stats",
    "Policies",
    "Publications",
    "Blog",
    "Changelog",
    "Data",
    "Forum",
    "Contact",
    "Help/FAQ",
    "Genome Aggregation Database",
    "Or",
    "Explore the gnomAD LR beta release",
    "Download gnomAD data",
    "Read gnomAD publications",
    "Find co-occurrence of two variants",
    "Browse tandem repeats in gnomAD",
    "Locate features not yet in gnomAD v4",
    "Please note that the gnomAD v3 genomes are now part of gnomAD v4. For more information, see",
    "\"Should I switch to the latest version of gnomAD?\"",
    "Examples",
    "Gene:",
    "Transcript:",
    "Variant:",
    "Structural variant region:",
    "Copy number variant region:",
    "Mitochondrial variant:",
    "Short tandem repeat",
    "locus:",
    "Regional missense constraint (gnomAD v2, GRCh37):",
    "Variant co-occurrence (gnomAD v2, GRCh37):",
    "New to gnomAD?",
    "Check out these resources to learn about gnomAD and how to use it for variant interpretation.",
    "Using gnomAD - tips and tricks (video)",
    "Six lessons for variant interpretation",
    "About gnomAD",
    "Watch the recording"
  ];
  for (const k of must) assert.ok(covers(k), "缺少条目: " + k);
});

test("基因页：信息卡字段、约束表、ClinVar / gnomAD 变异表控件", () => {
  const must = [
    "Genome build",
    "Ensembl gene ID",
    "MANE Select transcript",
    "Ensembl canonical transcript",
    "Other transcripts",
    "External resources",
    "UCSC Browser",
    "and more",
    "Constraint",
    "Variant co-occurrence",
    "Expected SNVs",
    "Observed SNVs",
    "Constraint metrics",
    "Mean pext",
    "Fraction of individuals with coverage over 20",
    "Include:",
    "Coding regions (CDS)",
    "Untranslated regions (UTRs)",
    "Non-coding transcripts",
    "Show transcripts",
    "Show tissues",
    "Save plot",
    "Zoom in",
    "Zoom out",
    "Metric:",
    "Viewing full gene",
    "ClinVar variants",
    "gnomAD variants",
    "Pathogenic / likely pathogenic",
    "Uncertain significance / conflicting",
    "Benign / likely benign",
    "Missense / Inframe indel",
    "Expand to all variants",
    "Filter to variants present in both gnomAD and ClinVar tracks",
    "Display neighboring variants",
    "Filtered variants",
    "Export variants to CSV",
    "Configure table",
    "Variant ID",
    "VEP Annotation",
    "LoF Curation",
    "Germline classification",
    "Flags",
    "Allele Count",
    "Allele Number",
    "Allele Frequency",
    "Number of Homozygotes",
    "HGVS Consequence",
    "HGVSc Consequence",
    "HGVSp Consequence",
    "Viewing in table",
    "Exomes",
    "Genomes",
    "SNVs",
    "Indels",
    "Restore defaults",
    "Move column up",
    "Move column down",
    "Alternate allele count in high quality genotypes",
    "Total number of called high quality genotypes",
    "Base-level pext score",
    "dbSNP rsIDs"
  ];
  for (const k of must) assert.ok(covers(k), "缺少条目: " + k);
});

test("变异页：字段表头、区块标题、祖先群体枚举", () => {
  const must = [
    "Copy variant ID",
    "Gene page",
    "Region size",
    "Include non-coding genes",
    "Regional genomic constraint (1kb scale)",
    "Z Score",
    "not constrained",
    "constrained",
    "External Resources",
    "Report an issue with this variant",
    "Genetic Ancestry Group Frequencies",
    "Genetic Ancestry Group",
    "African/African American",
    "Middle Eastern",
    "Remaining",
    "Admixed American",
    "European (non-Finnish)",
    "South Asian",
    "Ashkenazi Jewish",
    "East Asian",
    "European (Finnish)",
    "Amish",
    "Grpmax Filtering AF",
    "(95% confidence)",
    "Related Variants",
    "Other Alternate Alleles",
    "This variant is multiallelic. Other alternate alleles are:",
    "Liftover",
    "Nearby Variants",
    "View variants located within 20 bases of this variant.",
    "In Silico Predictors",
    "Genomic Constraint of Surrounding 1kb Region",
    "Age Distribution",
    "Variant carriers",
    "All individuals",
    "Include heterozygous variant carriers",
    "Include homozygous variant carriers",
    "Compare to all individuals",
    "Sequencing types:",
    "Exome and Genome",
    "Genotype Quality Metrics",
    "Genotype quality",
    "Allele balance for heterozygotes",
    "Site Quality Metrics",
    "Metric distribution",
    "All metric values",
    "Value:",
    "Site quality approximation for all variants with 0.002 <= AF < 0.005.",
    "Note: These are site-level quality metrics, they may be unpredictable for multi-allelic sites.",
    "This variant does not have non coding constraint data for the surrounding region.",
    "Read Data",
    "Load read data",
    "Always load read data",
    "Variant not found",
    "View surrounding region",
    "Load coverage of surrounding region",
    "0-4 Stars",
    ">=1 Stars",
    ">=3 Stars",
    "4 Stars"
  ];
  for (const k of must) assert.ok(covers(k), "缺少条目: " + k);
});

test("下载页：发行版本标签、区块标题与固定说明句", () => {
  const must = [
    "Download Overview",
    "Core Dataset vs Secondary Analyses",
    "Core Dataset",
    "Variants",
    "Joint Frequency",
    "All sites allele numbers",
    "Browser Tables",
    "Browser variants",
    "Browser gene models",
    "Genetic ancestry group classification",
    "Structural variants",
    "Copy number variants",
    "Proportion expressed across transcripts (pext)",
    "De novo variants (DNVs)",
    "Secondary Analyses",
    "Loss-of-function curation results",
    "HGDP + 1KG callset",
    "Mitochondrial DNA (mtDNA)",
    "Local ancestry",
    "Short tandem repeats",
    "Genomic constraint",
    "HGDP + 1KG tutorials",
    "Mitochondrial constraint",
    "Variants (GRCh38 liftover)",
    "Structural variants (GRCh38 liftover)",
    "Linkage disequilibrium",
    "Ancestry classification",
    "Regional Missense Constraint",
    "Multi-nucleotide variants (MNVs)",
    "Pre-QC plotting tables",
    "Post-QC plotting tables",
    "MNVs genome wide",
    "Other",
    "Resources",
    "Show URL for",
    "Copy URL for",
    "Download from",
    "Files can be browsed and downloaded using",
    "gnomAD variants are also available as a",
    "Warning",
    "Data sections",
    "v4 Downloads",
    "v3 Downloads",
    "v2 Liftover Downloads",
    "v2 Downloads",
    "ExAC Downloads",
    "Original release:",
    "gnomAD database and features created and maintained by the gnomAD production team."
  ];
  for (const k of must) assert.ok(covers(k), "缺少条目: " + k);
});

test("帮助页与关于页：目录、问答控件、分区标题", () => {
  const must = [
    "gnomAD Help",
    "Table of contents",
    "Frequently asked questions",
    "Search gnomAD help",
    "Show all answers in this section",
    "Hide all answers in this section",
    "Technical details",
    "Mitochondrial DNA",
    "Topic not found",
    "See all help topics",
    "Funding",
    "Current Funding",
    "Past Funding",
    "Data Contributors",
    "Contributing projects",
    "Search variant table"
  ];
  for (const k of must) assert.ok(covers(k), "缺少条目: " + k);
});

test("规则正则与动态串行为", () => {
  const { engine } = engineFor("<p>x</p>");
  const cases = [
    // 单数形式由本册规则命中；复数形式会先被 common 的括号规则翻成「N 碱基」，
    // 本册译法与之保持一致（不带「个」），同一句式只出一种中文写法
    ["Insertion (1 base)", "插入（1 碱基）"],
    ["Insertion (2 bases)", "插入（2 碱基）"],
    ["Deletion (24 bases)", "缺失（24 碱基）"],
    ["Deletion (1 base)", "缺失（1 碱基）"],
    ["ClinVar variants (1549)", "ClinVar 变异（1549）"],
    ["ClinVar variants (0)", "ClinVar 变异（0）"],
    ["gnomAD v4.1.2 variants (8839)", "gnomAD v4.1.2 变异（8839）"],
    ["This variant falls on 4 transcripts in 1 gene.", "该变异位于 1 个基因的 4 个转录本上。"],
    ["This variant falls on 1 transcript in 1 gene.", "该变异位于 1 个基因的 1 个转录本上。"],
    ["Over 20", "超过 20"],
    ["Zoom in 1.5x", "放大 1.5x"],
    ["Zoom out 3x", "缩小 3x"]
  ];
  for (const [src, want] of cases) assert.equal(engine.translateText(src), want, "原文: " + src);
  // 与 common 的通用规则不抢：带数字的样本数走通用规则，本册不收
  assert.ok(!Object.keys(dict.exact).some((k) => /^[\d,]+ samples/.test(k)), "样本数不该收进 exact");
});

test("首页渲染：导航、示例列表、讲座横幅（链接保留）", () => {
  const { doc } = engineFor(
    '<div><nav><a href="/about">About</a><a href="/team">Team</a><a href="/federated">Federated</a><a href="/stats">Stats</a>' +
      '<a href="/policies">Policies</a><a href="/publications">Publications</a><a href="/news/">Blog</a><a href="/news/changelog/">Changelog</a>' +
      '<a href="/data">Data</a><a href="/contact">Contact</a><a href="/help">Help/FAQ</a></nav>' +
      '<h1>Genome Aggregation Database</h1>' +
      '<a href="/downloads">Download gnomAD data</a><a href="/publications">Read gnomAD publications</a>' +
      '<a href="/variant-cooccurrence">Find co-occurrence of two variants</a>' +
      '<h2>Examples</h2><ul><li>Gene: <a href="/gene/ENSG00000169174">PCSK9</a></li>' +
      '<li>Variant: <a href="/variant/1-55051215-G-GA">1-55051215-G-GA</a></li>' +
      '<li>locus: <a href="/short-tandem-repeat/ATXN1">ATXN1</a></li></ul>' +
      '<div class="banner">Missed our recent talk on common misconceptions about gnomAD? ' +
      '<a href="https://example.org/rec">Watch the recording</a> covering what the resource is, ' +
      'what metadata are available, and the types of studies it includes.</div></div>'
  );
  assert.deepEqual(
    [...doc.querySelectorAll("nav a")].map(text),
    ["关于", "团队", "联邦数据", "统计", "政策", "论文", "博客", "更新日志", "数据", "联系方式", "帮助/常见问题"]
  );
  assert.equal(doc.querySelector("h1").textContent, "基因组聚集数据库");
  const links = [...doc.querySelectorAll("a")].map(text);
  assert.ok(links.includes("下载 gnomAD 数据"));
  assert.ok(links.includes("阅读 gnomAD 发表文献"));
  assert.ok(links.includes("查找两个变异的共现"));
  assert.deepEqual(
    [...doc.querySelectorAll("li")].map((x) => x.textContent.replace(/\s+/g, "")),
    ["基因：PCSK9", "变异：1-55051215-G-GA", "位点：ATXN1"]
  );
  const banner = doc.querySelector(".banner");
  assert.equal(
    banner.textContent,
    "错过了我们近期关于 gnomAD 常见误解的讲座？观看录像，内容涵盖该资源是什么、有哪些元数据以及包含哪些类型的研究。"
  );
  assert.equal(banner.querySelector("a").getAttribute("href"), "https://example.org/rec", "链接不能丢");
});

test("基因页渲染：约束表、ClinVar 计数、GNOMAD 变异表控件与约束说明模板", () => {
  const { doc } = engineFor(
    '<div><dl><dt>Genome build</dt><dd>hg38</dd><dt>Ensembl gene ID</dt><dd>ENSG00000141510</dd>' +
      '<dt>MANE Select transcript</dt><dt>Ensembl canonical transcript</dt><dt>Other transcripts</dt><dt>External resources</dt></dl>' +
      '<p>Constraint metrics based on MANE Select transcript (<a href="/transcript/ENST00000269305">ENST00000269305.9</a>).</p>' +
      '<table><thead><tr><th>Category</th><th>Expected SNVs</th><th>Observed SNVs</th><th>Constraint metrics</th>' +
      '<th>Synonymous</th><th>Missense</th><th>pLoF</th></tr></thead></table>' +
      '<h2>ClinVar variants</h2><div>ClinVar variants (1549)</div>' +
      '<h2>gnomAD variants</h2><span>gnomAD v4.1.2 variants (2041)</span><span>Viewing in table</span>' +
      '<label><input type="checkbox">Exomes</label><label><input type="checkbox">Genomes</label>' +
      '<label><input type="checkbox">SNVs</label><label><input type="checkbox">Indels</label>' +
      '<label><input type="checkbox">Filtered variants</label><label><input type="checkbox">Display neighboring variants</label>' +
      '<button>Export variants to CSV</button><button>Configure table</button><button>and more</button>' +
      '<label><input type="checkbox">Filter to variants present in both gnomAD and ClinVar tracks</label>' +
      '<label>Filter by <a href="#">review status</a>: <select id="clinvar-star-filter">' +
      '<option>0-4 Stars</option><option>&gt;=1 Stars</option><option>4 Stars</option></select></label></div>'
  );
  assert.deepEqual(
    [...doc.querySelectorAll("dt")].map(text),
    ["基因组版本", "Ensembl 基因 ID", "MANE 精选转录本", "Ensembl 规范转录本", "其他转录本", "外部资源"]
  );
  assert.deepEqual(
    [...doc.querySelectorAll("th")].map(text),
    ["类别", "期望 SNV 数", "观测 SNV 数", "约束指标", "同义", "错义", "pLoF"]
  );
  const note = doc.querySelector("p");
  assert.equal(note.textContent, "约束指标基于 MANE Select 转录本（ENST00000269305.9）。");
  assert.equal(note.querySelector("a").getAttribute("href"), "/transcript/ENST00000269305");
  const divs = [...doc.querySelectorAll("div")].map(text);
  assert.ok(divs.includes("ClinVar 变异（1549）"), "ClinVar 计数未翻: " + divs.join("/"));
  const spans = [...doc.querySelectorAll("span")].map(text);
  assert.ok(spans.includes("gnomAD v4.1.2 变异（2041）"));
  assert.ok(spans.includes("表格视图"));
  const labels = [...doc.querySelectorAll("label")].map((x) => x.textContent.replace(/\s+/g, " ").trim());
  for (const want of ["外显子组", "基因组", "单核苷酸变异", "插入缺失", "已过滤变异", "显示邻近变异", "筛选同时出现在 gnomAD 与 ClinVar 轨道中的变异"]) {
    assert.ok(labels.includes(want), "缺少标签 " + want + " 实际: " + labels.join("|"));
  }
  assert.ok(labels.some((x) => /^筛选依据审核状态/.test(x)), "Filter by review status 未翻: " + labels.join("|"));
  assert.deepEqual([...doc.querySelectorAll("option")].map(text), ["0-4 星", "≥1 星", "4 星"]);
  const buttons = [...doc.querySelectorAll("button")].map(text);
  assert.ok(buttons.includes("导出变异为 CSV"));
  assert.ok(buttons.includes("配置表格"));
  assert.ok(buttons.includes("以及更多"));
});

test("变异页渲染：标题、表头、区块标题与祖先群体枚举", () => {
  const { doc } = engineFor(
    '<div><h1><span>Insertion (1 base)</span><span>G</span><span>GA</span><span>GRCh38</span></h1>' +
      '<button>Copy variant ID</button><button>Gene page</button>' +
      '<table><thead><tr><th>Exomes</th><th>Genomes</th><th>Total</th><th>Filters</th><th>Allele Count</th>' +
      '<th>Allele Number</th><th>Allele Frequency</th><th>Grpmax Filtering AF</th><th>(95% confidence)</th>' +
      '<th>Number of homozygotes</th></tr></thead><tbody><tr><td><span>Pass</span></td></tr></tbody></table>' +
      '<p>This variant falls on 4 transcripts in 1 gene.</p>' +
      '<h2>External Resources</h2><h2>Related Variants</h2><h3>Other Alternate Alleles</h3>' +
      '<p>This variant is multiallelic. Other alternate alleles are:</p>' +
      '<h2>In Silico Predictors</h2><h2>Genomic Constraint of Surrounding 1kb Region</h2>' +
      '<p>This variant does not have non coding constraint data for the surrounding region.</p>' +
      '<h2>Age Distribution</h2><span>Variant carriers</span><span>All individuals</span><span>Exome</span><span>Genome</span>' +
      '<label><input type="checkbox">Include heterozygous variant carriers</label>' +
      '<label><input type="checkbox">Include homozygous variant carriers</label>' +
      '<label><input type="checkbox">Compare to all individuals</label>' +
      '<label>Sequencing types:</label><option>Exome and Genome</option>' +
      '<h2>Genotype Quality Metrics</h2><div>Genotype quality</div><div>Depth</div><div>Allele balance for heterozygotes</div>' +
      '<h2>Site Quality Metrics</h2><div>Metric distribution</div><div>All metric values</div>' +
      '<h2>Read Data</h2><button>Load read data</button><button>Always load read data</button>' +
      '<h2>Genetic Ancestry Group Frequencies</h2><button>African/African American</button><button>Middle Eastern</button>' +
      '<button>Remaining</button><button>European (non-Finnish)</button><button>Ashkenazi Jewish</button></div>'
  );
  assert.match(doc.querySelector("h1").textContent, /^插入（1 碱基）/);
  const buttons = [...doc.querySelectorAll("button")].map(text);
  for (const want of ["复制变异 ID", "基因页面", "加载读取数据", "始终加载读取数据", "非洲/非裔美国人", "中东", "其余", "欧洲（非芬兰）", "德系犹太人"]) {
    assert.ok(buttons.includes(want), "缺少按钮 " + want + " 实际: " + buttons.join("|"));
  }
  assert.deepEqual(
    [...doc.querySelectorAll("th")].map(text),
    ["外显子组", "基因组", "总计", "筛选条件", "等位基因计数", "等位基因总数", "等位基因频率", "组最大过滤 AF", "（95% 置信区间）", "纯合子数量"]
  );
  assert.equal(doc.querySelector("td span").textContent, "通过");
  const hs = [...doc.querySelectorAll("h2")].map(text);
  for (const want of ["外部资源", "相关变异", "计算机预测工具", "周边 1kb 区域的基因组约束", "年龄分布", "基因型质量指标", "位点质量指标", "读取数据", "遗传祖先群体频率"]) {
    assert.ok(hs.includes(want), "缺少标题 " + want + " 实际: " + hs.join("|"));
  }
  const ps = [...doc.querySelectorAll("p")].map(text);
  assert.deepEqual(ps, [
    "该变异位于 1 个基因的 4 个转录本上。",
    "该变异为多等位基因。其他替代等位基因：",
    "该变异没有周边区域的非编码约束数据。"
  ]);
  assert.deepEqual(
    [...doc.querySelectorAll("label")].map(text),
    ["包含杂合变异携带者", "包含纯合变异携带者", "与全部个体比较", "测序类型："]
  );
});

test("下载页渲染：发行版本导航、区块标题与多槽位说明模板", () => {
  const { doc } = engineFor(
    '<div><nav><a href="#summary">Summary</a><a href="#v4">v4 Downloads</a><a href="#v3">v3 Downloads</a>' +
      '<a href="#v2-liftover">v2 Liftover Downloads</a><a href="#v2">v2 Downloads</a><a href="#exac">ExAC Downloads</a></nav>' +
      '<h2>Download Overview</h2>' +
      '<p>gnomAD data is available for download through <a href="https://cloud.google.com/public-datasets">Google Cloud Public Datasets</a>, ' +
      'and the <a href="https://registry.opendata.aws/">Registry of Open Data on AWS</a>. We recommend using <a href="https://hail.is/">Hail</a>, ' +
      'our <a href="https://github.com/broadinstitute/gnomad_methods">Hail utilities for gnomAD</a>, and the ' +
      '<a href="https://github.com/broadinstitute/gnomad-toolbox">gnomAD toolbox</a> to work with this data.</p>' +
      '<p>In addition to the files listed below, <a href="https://terra.bio">Terra</a> has ' +
      '<a href="https://terra.bio/demo">a demo workspace for working with gnomAD data</a>.</p>' +
      '<h3>Core Dataset vs Secondary Analyses</h3>' +
      '<p>Secondary Analyses are additional analyses developed in collaboration with laboratories of the ' +
      '<a href="/about">gnomAD steering committee</a>.</p>' +
      '<h2>Core Dataset</h2><p>gnomAD database and features created and maintained by the gnomAD production team.</p>' +
      '<h2>Variants</h2><h2>Joint Frequency</h2><h2>All sites allele numbers</h2><h2>Browser Tables</h2><h2>Coverage</h2>' +
      '<h2>Genetic ancestry group classification</h2><h2>Constraint</h2><h2>Structural variants</h2><h2>Copy number variants</h2>' +
      '<h2>Proportion expressed across transcripts (pext)</h2><h2>De novo variants (DNVs)</h2><h2>ClinVar</h2><h2>Resources</h2>' +
      '<h2>Secondary Analyses</h2><h2>Loss-of-function curation results</h2><h2>HGDP + 1KG callset</h2>' +
      '<h2>Mitochondrial DNA (mtDNA)</h2><h2>Local ancestry</h2><h2>Short tandem repeats</h2><h2>Genomic constraint</h2>' +
      '<h2>HGDP + 1KG tutorials</h2><h2>Mitochondrial constraint</h2><h2>Variants (GRCh38 liftover)</h2>' +
      '<h2>Structural variants (GRCh38 liftover)</h2><h2>Linkage disequilibrium</h2><h2>Ancestry classification</h2>' +
      '<h2>Regional Missense Constraint</h2><h2>Multi-nucleotide variants (MNVs)</h2>' +
      '<h2>Pre-QC plotting tables</h2><h2>Post-QC plotting tables</h2><h2>MNVs genome wide</h2><h2>Other</h2>' +
      '<li>Show URL for</li><li>Copy URL for</li><span>Download from</span></div>'
  );
  assert.deepEqual(
    [...doc.querySelectorAll("nav a")].map(text),
    ["摘要", "v4 下载", "v3 下载", "v2 坐标转换下载", "v2 下载", "ExAC 下载"]
  );
  const ps = [...doc.querySelectorAll("p")].map(text);
  assert.equal(
    ps[0],
    "gnomAD 数据可通过 Google Cloud Public Datasets 和 Registry of Open Data on AWS 下载。我们建议使用 Hail、我们的 gnomAD Hail 工具集以及 gnomAD toolbox 来处理这些数据。"
  );
  assert.equal(ps[1], "除下列文件外，Terra 还提供用于处理 gnomAD 数据的演示工作区。");
  assert.equal(ps[2], "二次分析是与 gnomAD 指导委员会的实验室合作开发的其他分析。");
  assert.equal(ps[3], "gnomAD 数据库及其功能由 gnomAD 生产团队创建与维护。");
  assert.equal(doc.querySelector("p a").getAttribute("href"), "https://cloud.google.com/public-datasets", "模板里的链接不能丢");
  const hs = [...doc.querySelectorAll("h2, h3")].map(text);
  for (const want of ["下载概览", "核心数据集与二次分析", "核心数据集", "变异", "联合频率", "全部位点等位基因数", "浏览器表格", "覆盖度",
    "遗传祖先群体分类", "约束", "结构变异", "拷贝数变异", "跨转录本表达比例（pext）", "新发变异（DNV）", "资源", "二次分析",
    "功能丧失审编结果", "HGDP + 1KG 调用集", "线粒体 DNA（mtDNA）", "局部祖先", "短串联重复", "基因组约束", "HGDP + 1KG 教程",
    "线粒体约束", "变异（GRCh38 坐标转换）", "结构变异（GRCh38 坐标转换）", "连锁不平衡", "祖先分类", "区域错义约束",
    "多核苷酸变异（MNV）", "QC 前绘图表", "QC 后绘图表", "全基因组 MNV", "其他"]) {
    assert.ok(hs.includes(want), "缺少标题 " + want + " 实际: " + hs.join("|"));
  }
  assert.deepEqual([...doc.querySelectorAll("li")].map(text), ["显示 URL：", "复制 URL："]);
  assert.equal(text(doc.querySelector("span")), "从以下位置下载");
});
