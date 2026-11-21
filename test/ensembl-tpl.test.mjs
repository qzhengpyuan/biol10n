// Ensembl 文档/工具页模板词库（ensembl-tpl）回归：被 <a>/<code>/<em>/<strong>/<span> 切碎的长句
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const tpl = JSON.parse(fs.readFileSync(path.join(root, "../dict/ensembl-tpl.json"), "utf8"));

const SITE = { scope: "body", block: "pre, code", rescan: false };
const DATA = { exact: tpl.exact, rules: tpl.rules || [], templates: tpl.templates };
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;

function boot(html, data) {
  const dom = new JSDOM(html, { url: "https://www.ensembl.org/info/docs/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: data || DATA,
    site: SITE
  });
  engine.start();
  return { dom, engine, doc: dom.window.document };
}

test("词库规模与条目规整：exact 上百、templates 五十以上", () => {
  const exact = Object.entries(tpl.exact || {});
  const templates = tpl.templates || [];
  assert.ok(exact.length >= 100, "exact 条目太少: " + exact.length);
  assert.ok(templates.length >= 50, "模板太少: " + templates.length);
  const bad = [];
  for (const [en, zh] of exact) {
    if (!en || en !== en.trim()) bad.push("键首尾空白: " + JSON.stringify(en));
    if (CJK.test(en)) bad.push("键含中文: " + en);
    if (!zh || zh !== zh.trim()) bad.push("空译文: " + en);
    if (!CJK.test(zh)) bad.push("译文无中文: " + en);
    if (en === zh) bad.push("自映射: " + en);
  }
  for (const t of templates) {
    if (!t.pat || !t.zh) bad.push("模板缺字段: " + JSON.stringify(t).slice(0, 60));
    if (!CJK.test(t.zh)) bad.push("模板译文无中文: " + t.pat.slice(0, 40));
    if (t.pat.length < 20 || t.pat.length > 2200) bad.push("pat 长度不合规: " + t.pat.length);
  }
  assert.deepEqual(bad, []);
});

test("模板占位符：编号从 1 连续、与译文顺序一致", () => {
  const bad = [];
  for (const t of tpl.templates) {
    const slots = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    const used = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    if (!slots.length) { bad.push("pat 无占位符: " + t.pat.slice(0, 40)); continue; }
    if (slots.join(",") !== slots.map((_, i) => i + 1).join(",")) bad.push("pat 编号不连续: " + t.pat.slice(0, 40));
    if (slots.join(",") !== used.join(",")) bad.push("译文占位符不匹配: " + t.pat.slice(0, 40));
  }
  assert.deepEqual(bad, []);
});

test("与已发布的 Ensembl 词库不重复", () => {
  const other = {};
  for (const f of ["ensembl", "ensembl-extra", "common"]) {
    const j = JSON.parse(fs.readFileSync(path.join(root, "../dict/" + f + ".json"), "utf8"));
    for (const k of Object.keys(j.exact || {})) other[k] = f;
  }
  const dup = Object.keys(tpl.exact).filter((k) => k in other);
  assert.deepEqual(dup, [], "重复键: " + dup.join(" | "));
});

test("开源声明整句：长句变中文，GitHub 链接保留", () => {
  const { dom, engine, doc } = boot(
    '<p>All of the software created by the Ensembl project is open source\n' +
      'and freely available to download from our \n' +
      '<a rel="external" href="https://github.com/Ensembl">GitHub repository</a>.</p>'
  );
  const p = doc.querySelector("p");
  assert.match(p.textContent, /Ensembl 项目创建的所有软件都是开源的/);
  assert.doesNotMatch(p.textContent, /All of the software/);
  const a = p.querySelector("a");
  assert.ok(a, "链接节点必须还在");
  assert.equal(a.getAttribute("href"), "https://github.com/Ensembl");
  assert.equal(engine.stats.tpl, 1);
  dom.window.close();
});

test("安装网页代码整句：两个链接都还在原位", () => {
  const { dom, doc } = boot(
    '<p>You can also run a local copy of this website by \n' +
      '<a href="/info/docs/webcode/">installing our codebase</a> and associated Perl \n' +
      "dependencies. Please note that this is a non-trivial task, and we only support \n" +
      "installation on Linux. For help with other operating systems as well as general\n" +
      "support with custom development, we recommend joining our developers' \n" +
      '<a rel="external" href="/info/about/contact/mailing.html">mailing list</a>. ' +
      "The web code runs on Perl version 5.26.</p>"
  );
  const p = doc.querySelector("p");
  assert.match(p.textContent, /在本地运行本网站的一份副本/);
  assert.doesNotMatch(p.textContent, /local copy of this website/);
  const links = [...p.querySelectorAll("a")];
  assert.equal(links.length, 2);
  assert.deepEqual(links.map((a) => a.getAttribute("href")), ["/info/docs/webcode/", "/info/about/contact/mailing.html"]);
  dom.window.close();
});

test("API 安装三种方式整句：三个内联链接全部保留", () => {
  const { dom, doc } = boot(
    "<p>There are two ways of installing the Perl API. You can \n" +
      '<a href="https://github.com/Ensembl/ensembl">clone it from GitHub using Git</a> ' +
      "if you have that available, or you can download the files in gzipped TAR format from our \n" +
      '<a href="https://ftp.ensembl.org/pub/">FTP site</a>. You will also need \n' +
      '<a href="https://metacpan.org/release/BioPerl">BioPerl 1.6.924 core modules</a> (bioperl-live).</p>'
  );
  const p = doc.querySelector("p");
  assert.match(p.textContent, /安装 Perl API 有两种方式/);
  assert.match(p.textContent, /gzip 压缩的 TAR 格式文件/);
  const links = [...p.querySelectorAll("a")];
  assert.equal(links.length, 3);
  assert.equal(links[0].textContent, "用 Git 从 GitHub 克隆");
  assert.equal(links[1].getAttribute("href"), "https://ftp.ensembl.org/pub/");
  dom.window.close();
});

test("强调句 IMPORTANT/must：两个 strong 保留，& 实体不丢", () => {
  const { dom, doc } = boot(
    "<p><strong>IMPORTANT:</strong> You <strong>must</strong> encode any = &amp; or ; " +
      "characters in your URL for the attachment to work correctly.</p>"
  );
  const p = doc.querySelector("p");
  assert.equal(p.textContent, "重要：为了让附加正常工作，您必须对 URL 中的 =、&、; 字符进行编码。");
  const strong = [...p.querySelectorAll("strong")].map((e) => e.textContent);
  assert.deepEqual(strong, ["重要：", "必须"]);
  dom.window.close();
});

test("VEP 说明句：span 作为槽位回填，整段变中文", () => {
  const { dom, doc } = boot(
    "<p>\n" +
      '    <span style="color:#006;font-weight:bold">Ensembl VEP predicts the effect of your variants</span> ' +
      "(SNPs, insertions,\n    deletions, CNVs or structural variants) on gene transcripts and\n" +
      "    protein sequence, as well as regulatory regions.\n" +
      "    It reports reference data including gene and variant phenotype associations and " +
      "population allele frequencies to facilitate variant prioritisation and interpretation.</p>"
  );
  const p = doc.querySelector("p");
  assert.match(p.textContent, /（SNP、插入、缺失、CNV 或结构变异）对基因转录本与蛋白质序列/);
  assert.match(p.textContent, /群体等位基因频率/);
  const span = p.querySelector("span");
  assert.ok(span, "span 必须保留");
  assert.equal(span.style.fontWeight, "bold");
  dom.window.close();
});

test("code 槽位保持英文：物种名与 meta 键原样回填", () => {
  const { dom, doc } = boot(
    "<p>If you intend to use the compara API, you need to use the species' production name. " +
      "This is normally the binomial name lowercased with spaces replaced by underscores " +
      "e.g. <i>Homo sapiens</i> should be <code>homo_sapiens</code>. " +
      "Check your database's meta table for the meta key <code>species.production_name</code></p>"
  );
  const p = doc.querySelector("p");
  assert.match(p.textContent, /物种的生产名称/);
  assert.deepEqual([...p.querySelectorAll("code")].map((e) => e.textContent), [
    "homo_sapiens",
    "species.production_name"
  ]);
  assert.equal(p.querySelector("i").textContent, "Homo sapiens", "物种学名不翻");
  dom.window.close();
});

test("无内联元素的长段落走 exact：整段中文且不留英文", () => {
  const { dom, engine, doc } = boot(
    "<p>The Ensembl codebase is highly complex, consisting of many hundreds of modules. " +
      "The following notes should help you begin to find your way around!</p>"
  );
  const text = doc.querySelector("p").textContent;
  assert.match(text, /Ensembl 代码库非常复杂/);
  assert.doesNotMatch(text, /hundreds of modules/);
  assert.equal(engine.stats.tpl, 0, "exact 通道不应记模板命中");
  dom.window.close();
});

test("disable 之后原文与链接原样回来", () => {
  const { dom, engine, doc } = boot(
    '<p>All of the software created by the Ensembl project is open source\n' +
      'and freely available to download from our \n' +
      '<a rel="external" href="https://github.com/Ensembl">GitHub repository</a>.</p>'
  );
  assert.match(doc.querySelector("p").textContent, /开源/);
  engine.disable();
  const p = doc.querySelector("p");
  assert.equal(
    p.textContent.replace(/\s+/g, " ").trim(),
    "All of the software created by the Ensembl project is open source and freely available to download from our GitHub repository."
  );
  assert.equal(p.querySelector("a").getAttribute("href"), "https://github.com/Ensembl");
  dom.window.close();
});

test("译文占位符少一个时不替换（宁可留英文也不丢链接）", () => {
  const pat = tpl.templates.find((t) => t.pat.includes("{{1}}") && t.pat.includes("Ensembl project")).pat;
  const broken = [{ pat, zh: "Ensembl 项目创建的所有软件都是开源的。" }];
  const { dom, engine, doc } = boot(
    '<p>All of the software created by the Ensembl project is open source\n' +
      'and freely available to download from our \n' +
      '<a rel="external" href="https://github.com/Ensembl">GitHub repository</a>.</p>',
    { exact: {}, rules: [], templates: broken }
  );
  assert.match(doc.querySelector("p").textContent, /All of the software/, "缺占位符必须放弃替换");
  assert.equal(engine.stats.tpl, 0);
  dom.window.close();
});
