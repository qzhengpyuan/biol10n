// clinvar-frag：ClinVar 首页与 docs 里被内联元素切碎的整句（模板通道）+ 提示碎片（exact）
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const engineSrc = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(engineSrc + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/clinvar-frag.json"), "utf8"));

function boot(html) {
  const dom = new JSDOM(html, { url: "https://www.ncbi.nlm.nih.gov/clinvar/docs/faq/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: dict.exact, rules: dict.rules || [], templates: dict.templates },
    site: { scope: "body", block: "pre, code" }
  });
  engine.start();
  return { dom, engine, doc: dom.window.document };
}

test("VCV 页 MANE 提示句整段变中文，MANE 链接仍在", () => {
  const { dom, engine, doc } = boot(
    '<p> Transcripts from the Matched Annotation from the NCBI and EMBL-EBI (<a href="https://www.ncbi.nlm.nih.gov/refseq/MANE/">MANE</a>) collaboration. </p>'
  );
  const p = doc.querySelector("p");
  assert.match(p.textContent, /转录本来自/, "整句应换成中文");
  assert.match(p.textContent, /协作项目/, "句尾也应换成中文");
  assert.doesNotMatch(p.textContent, /Transcripts from the Matched/);
  const a = p.querySelector("a");
  assert.ok(a, "链接节点必须还在");
  assert.equal(a.getAttribute("href"), "https://www.ncbi.nlm.nih.gov/refseq/MANE/");
  assert.equal(a.textContent, "MANE", "品牌名保持英文");
  assert.ok(engine.stats.tpl >= 1, "模板命中计数应增加");
  dom.window.close();
});

test("首页 Get help 句整段变中文，mailto 链接仍在", () => {
  const { dom, doc } = boot(
    '<p>Get help from a ClinVar expert. Send an email to <a href="mailto:clinvar@ncbi.nlm.nih.gov">clinvar@ncbi.nlm.nih.gov</a>.</p>'
  );
  const p = doc.querySelector("p");
  assert.match(p.textContent, /如需 ClinVar 专家协助，请发送电子邮件至/, "整句应换成中文");
  assert.doesNotMatch(p.textContent, /Get help from a ClinVar expert/);
  const a = p.querySelector("a");
  assert.ok(a, "邮件链接必须还在");
  assert.equal(a.getAttribute("href"), "mailto:clinvar@ncbi.nlm.nih.gov");
  assert.equal(a.textContent, "clinvar@ncbi.nlm.nih.gov", "邮箱地址不翻");
  dom.window.close();
});

test("FAQ Please see 句整段变中文，链接仍在", () => {
  const { dom, doc } = boot(
    '<p>Please see <a href="/clinvar/docs/faq_submissions/">our FAQ about submissions</a> for questions about the submission process.</p>'
  );
  const p = doc.querySelector("p");
  assert.match(p.textContent, /有关提交流程的问题，请参阅/, "整句应换成中文");
  assert.doesNotMatch(p.textContent, /for questions about the submission process/);
  const a = p.querySelector("a");
  assert.ok(a, "链接必须还在");
  assert.equal(a.getAttribute("href"), "/clinvar/docs/faq_submissions/");
  dom.window.close();
});

test("FAQ FTP 双链接长句整段变中文，两个链接都保留", () => {
  const { dom, doc } = boot(
    '<p>Or you can get the data from the FTP site. You can look in the <a href="https://ftp.ncbi.nlm.nih.gov/pub/clinvar/tab_delimited/variant_summary.txt.gz">VCF file</a> or the <a href="https://ftp.ncbi.nlm.nih.gov/pub/clinvar/tab_delimited/variant_summary.txt.gz">variant_summary.txt</a> file for your gene of interest and parse the protein expressions to order by protein location.</p>'
  );
  const p = doc.querySelector("p");
  assert.match(p.textContent, /FTP 站点获取数据/, "整句应换成中文");
  assert.doesNotMatch(p.textContent, /Or you can get the data from the FTP site/);
  const links = p.querySelectorAll("a");
  assert.equal(links.length, 2, "两个链接都要保留");
  assert.equal(links[1].textContent, "variant_summary.txt", "文件名不翻");
  dom.window.close();
});

test("检索词未找到提示（被 span 切成多段）能变中文", () => {
  const { dom, doc } = boot(
    '<div class="hanging-indent-4x ignored-words-section"><b> The following term<span class="plural">s were</span><span class="singular"> was</span> not found in ClinVar:&nbsp;</b> <span id="ignored-words"><span>zzzzqqq</span></span></div>'
  );
  const b = doc.querySelector("b");
  assert.match(b.textContent, /以下术语/, "The following term 应翻成中文");
  assert.match(b.textContent, /在 ClinVar 中未找到/, "were/was 段应翻成中文");
  assert.match(b.textContent, /：/, "冒号段应换成全角");
  assert.doesNotMatch(b.textContent, /The following term|not found in ClinVar/);
  assert.equal(doc.querySelector("#ignored-words span").textContent, "zzzzqqq", "检索词本身不翻");
  dom.window.close();
});

test("FAQ 标题 exact 整条替换", () => {
  const { dom, doc } = boot(
    "<h3>2. Why are there different classification for the same variant?</h3>"
  );
  assert.equal(
    doc.querySelector("h3").textContent,
    "2. 为什么同一变异会有不同的分类？"
  );
  dom.window.close();
});

test("词表自检：模板占位符一一对应、无中文 pat、总条数达标", () => {
  assert.ok(dict.templates.length >= 25, "模板数量");
  assert.ok(Object.keys(dict.exact).length >= 60, "exact 数量");
  assert.ok(dict.templates.length + Object.keys(dict.exact).length >= 100, "合计条数");
  const cjk = /[\u4e00-\u9fff]/;
  for (const t of dict.templates) {
    assert.doesNotMatch(t.pat, cjk, "pat 不应含中文: " + t.pat.slice(0, 60));
    const slots = (t.pat.match(/\{\{\d+\}\}/g) || []).length;
    const used = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.equal(used.length, slots, "占位符个数必须与 pat 一致: " + t.pat.slice(0, 60));
    used.forEach((v, i) => assert.equal(v, i + 1, "占位符顺序必须 1..N: " + t.pat.slice(0, 60)));
  }
});

test("无关英文段落不受影响", () => {
  const { dom, doc } = boot("<p>This paragraph is not part of the ClinVar dictionary at all.</p>");
  assert.match(doc.querySelector("p").textContent, /not part of the ClinVar dictionary/);
  dom.window.close();
});
