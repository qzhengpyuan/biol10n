// PubMed 站词库（dict/pubmed2.json）结构与引擎行为测试
// 覆盖：检索结果页/条目页/零结果页/高级检索日期筛选/跳页对话框的界面文字
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/pubmed2.json"), "utf8"));

// 测试用最小 site；scope 放 body，才能同时覆盖 main 之外的工具栏与页脚
const site = {
  id: "pubmed-test",
  hosts: ["pubmed.ncbi.nlm.nih.gov"],
  scope: "body",
  spa: false,
  rescan: false
};

function mount(inner, url = "https://pubmed.ncbi.nlm.nih.gov/") {
  const dom = new JSDOM('<div id="root">' + inner + "</div>", { url });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: dict.exact, rules: dict.rules, templates: dict.templates },
    site
  });
  engine.start();
  return { doc: dom.window.document, engine };
}

function zh(text) {
  return String(text).replace(/\s+/g, " ").trim();
}

// ---------------- 结构校验 ----------------

test("词库可解析，meta 与三类条目齐全", () => {
  assert.equal(dict.meta.family, "pubmed");
  assert.deepEqual(dict.meta.sites, ["pubmed.ncbi.nlm.nih.gov"]);
  assert.ok(Object.keys(dict.exact).length >= 31, "exact 条目应不少于 31 条");
  assert.ok(dict.rules.length >= 3, "rules 至少 3 条");
  assert.ok(dict.templates.length >= 1, "templates 至少 1 条");
});

test("exact 键值卫生：无中文键、译文含中文、非自映射、无明文 URL/邮箱、无首尾空白", () => {
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.ok(!/[\u3400-\u9fff]/.test(k), "key 含中文：" + k);
    assert.notEqual(k, v, "自映射：" + k);
    assert.ok(!/https?:\/\/|[\w.+-]+@[\w-]+\.\w+/.test(v), "value 含明文 URL/邮箱：" + k);
    assert.equal(k, k.trim(), "key 首尾空白：" + JSON.stringify(k));
    assert.equal(v, v.trim(), "value 首尾空白：" + JSON.stringify(v));
    // 少数键只是把 ASCII 标点换成全角标点（如 PMCID: → PMCID：）或给出等价符号，不算自映射
    const localized = /[\u3400-\u9fff]/.test(v) || /[：，。；！？（）【】、「」／]/.test(v) || /^(MM|DD|ADD|to)$/.test(k);
    assert.ok(localized, "value 无中文也无全角标点：" + k);
  }
});

test("关键条目存在（条目页、零结果页、日期筛选、跳页对话框）", () => {
  const want = {
    "Graphical abstract": "图形摘要",
    "See this image and copyright information in PMC": "在 PMC 中查看此图像与版权信息",
    "Molecular Biology Databases": "分子生物学数据库",
    "Quoted phrase not found in": "引号短语未收录于",
    "et al.": "等",
  };
  for (const [k, v] of Object.entries(want)) assert.equal(dict.exact[k], v, "缺少或值不符：" + k);
});

test("rules 全部 ^…$ 锚定、可编译，$n 引用的捕获组真实存在", () => {
  for (const r of dict.rules) {
    assert.ok(r.re.startsWith("^") && r.re.endsWith("$"), "未锚定：" + r.re);
    assert.doesNotThrow(() => new RegExp(r.re), "坏正则：" + r.re);
    const groups = (r.re.match(/\((?!\?)/g) || []).length;
    for (const m of r.to.matchAll(/\$(\d)/g)) {
      assert.ok(Number(m[1]) <= groups, "引用了不存在的捕获组 " + m[0] + "：" + r.re);
    }
    assert.ok(/[\u3400-\u9fff]/.test(r.to), "译文必须含中文：" + r.re);
  }
});

test("templates：pat 不含中文、长度合规、占位符 1..N 连续且与 zh 槽位一致", () => {
  for (const t of dict.templates) {
    assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, "pat 长度越界：" + t.pat.length);
    assert.ok(!/[\u3400-\u9fff]/.test(t.pat), "pat 不该含中文：" + t.pat.slice(0, 40));
    assert.ok(/[\u3400-\u9fff]/.test(t.zh), "译文必须是中文：" + t.pat.slice(0, 40));
    const slotCount = (t.pat.match(/\{\{\d+\}\}/g) || []).length;
    const patSlots = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
    const zhSlots = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
    const seq = Array.from({ length: slotCount }, (_, i) => i + 1);
    assert.deepEqual(patSlots, seq, "pat 占位符必须 1..N：" + t.pat.slice(0, 60));
    assert.deepEqual(zhSlots, seq, "zh 占位符必须 1..N 且一一对应：" + t.pat.slice(0, 60));
    assert.ok(!/https?:\/\/|[\w.+-]+@[\w-]+\.\w+/.test(t.zh), "模板译文含明文 URL/邮箱");
  }
});

// ---------------- 引擎行为：条目页 ----------------

test("条目页：图形摘要标签、PMC 版权提示句、LinkOut 分类都翻成中文", () => {
  const { doc } = mount(
    '<main><div class="caption-wrap"><div class="figure-label"><strong>Graphical abstract</strong></div>' +
      '<a class="figure-caption-link" href="/pmc/articles/PMC7000000/figure/F1/">See this image and copyright information in PMC</a></div>' +
      '<section class="linkout"><h3 class="linkout-category">Molecular Biology Databases</h3>' +
      '<ul class="linkout-links"><li><a href="https://www.ebi.ac.uk/">EMBL-EBI</a></li></ul></section></main>'
  );
  assert.equal(zh(doc.querySelector(".figure-label strong").textContent), "图形摘要");
  const pmc = doc.querySelector(".figure-caption-link");
  assert.equal(zh(pmc.textContent), "在 PMC 中查看此图像与版权信息");
  assert.equal(pmc.getAttribute("href"), "/pmc/articles/PMC7000000/figure/F1/", "链接不能被模板拍平");
  assert.equal(zh(doc.querySelector(".linkout-category").textContent), "分子生物学数据库");
  // 数据库名是专有名词，整体保留
  assert.equal(zh(doc.querySelector(".linkout-links a").textContent), "EMBL-EBI");
});

test("条目页：作者串里的 et al. 翻成等，摘要正文放行英文", () => {
  const { doc } = mount(
    '<main><div id="abstract"><strong class="sub-title">Keywords:</strong>' +
      '<div class="abstract-content"><p>BRCA1 and BRCA2 variants.</p></div></div>' +
      '<div class="authors-list"><a class="full-name">Smith J</a><span class="citation-separator">et al.</span></div></main>'
  );
  // Keywords: 由 test/pubmed2.test.mjs:166 明确「本册不收录」，这里只锁住现状
  assert.equal(zh(doc.querySelector(".sub-title").textContent), "Keywords:");
  assert.equal(zh(doc.querySelector(".citation-separator").textContent), "等");
  // 摘要正文按设计保留英文
  assert.equal(zh(doc.querySelector(".abstract-content p").textContent), "BRCA1 and BRCA2 variants.");
});

// ---------------- 引擎行为：零结果页 ----------------

test("零结果页：被 <a> 切成三段的提示句逐段译出，链接与 href 保留", () => {
  const { doc } = mount(
    '<main><div class="altered-search-explanation"><div class="usa-alert-text">' +
      '<p>Quoted phrase not found in <a href="/?term=%22zzzqqqxxyy%22">phrase index</a>: "zzzqqqxxyy"</p>' +
      '</div></div></main>',
    "https://pubmed.ncbi.nlm.nih.gov/?term=zzzqqqxxyy"
  );
  const p = doc.querySelector(".usa-alert-text p");
  assert.equal(zh(p.childNodes[0].nodeValue), "引号短语未收录于");
  assert.equal(p.querySelectorAll("a").length, 1);
  assert.equal(p.querySelector("a").getAttribute("href"), "/?term=%22zzzqqqxxyy%22");
  // 链接文字由 ncbi-help 册负责（本测试只装 pubmed2），检索词本身不翻
  assert.equal(zh(p.querySelector("a").textContent), "phrase index");
  assert.match(zh(p.textContent), /zzzqqqxxyy"$/);
});

// ---------------- 引擎行为：属性通道 ----------------

test("日期筛选下拉的 placeholder MM / DD / YYYY 一律不翻（格式占位符，与 ncbi-aria 的既有判据一致）", () => {
  const { doc } = mount(
    '<main><div class="date-range"><input type="text" class="form-control" id="start-year" placeholder="YYYY">' +
      '<input type="text" class="form-control" id="start-month" placeholder="MM">' +
      '<input type="text" class="form-control" id="start-day" placeholder="DD"></div></main>'
  );
  // 只翻 MM/DD 而留下 YYYY 会让三个输入框一半中文一半英文；这三个都是「填数字」的格式提示，
  // 统一留英文（test/ncbi-aria.test.mjs 早已按此断言）。
  assert.equal(doc.querySelector("#start-month").getAttribute("placeholder"), "MM");
  assert.equal(doc.querySelector("#start-day").getAttribute("placeholder"), "DD");
  assert.equal(doc.querySelector("#start-year").getAttribute("placeholder"), "YYYY");
});

// ---------------- rules 行为 ----------------

test("rules：被忽略检索词、被引次数、参考文献条数按数字改写", () => {
  const { doc } = mount(
    '<main><div class="alerts"><p id="ignored">The following terms were ignored: zzz, qqq</p></div>' +
      '<div class="citedby"><p id="cited">Cited by 1,234 articles</p><p id="cited1">Cited by 1 article</p></div>' +
      '<div class="refs"><p id="refs">Show all 42 references</p></div></main>'
  );
  assert.equal(zh(doc.querySelector("#ignored").textContent), "以下检索词已被忽略：zzz, qqq");
  assert.equal(zh(doc.querySelector("#cited").textContent), "被引 1,234 次");
  assert.equal(zh(doc.querySelector("#cited1").textContent), "被引 1 次");
  assert.equal(zh(doc.querySelector("#refs").textContent), "显示全部 42 条参考文献");
});

// ---------------- templates 行为 ----------------

test("templates：NLM 预印本说明走模板，内联链接与其中文字都保住", () => {
  const { doc } = mount(
    '<main><div class="ncbi-alerts"><p class="preprint-note">The National Library of Medicine is ' +
      '<a href="/pmc/preprints/">running a pilot</a> to include preprints that result from research funded by NIH in PMC and PubMed.</p></div></main>'
  );
  const p = doc.querySelector(".preprint-note");
  assert.equal(zh(p.textContent), "美国国家医学图书馆正在开展试点，将 NIH 资助研究产生的预印本纳入 PMC 和 PubMed。");
  assert.equal(p.querySelectorAll("a").length, 1, "模板必须把链接放回译文");
  assert.equal(p.querySelector("a").getAttribute("href"), "/pmc/preprints/");
  assert.equal(zh(p.querySelector("a").textContent), "开展试点");
});

// ---------------- 负例：不翻的东西保持英文 ----------------

test("负例：PMID、基因符号、筛选参数、出版类型选项名保持英文", () => {
  const { doc } = mount(
    '<main><div class="results-amount"><span>1,234 results</span></div>' +
      '<div class="docsum-pmid">PMID: 36996813</div>' +
      '<div class="gene">BRCA1 TP53 EGFR</div>' +
      '<input type="hidden" name="filter" value="pubt.review">' +
      '<select id="format"><option value="pubmed">PubMed</option><option value="csv">CSV</option>' +
      '<option value="medline">MEDLINE</option></select>' +
      '<div class="citation">Nat Genet. 2020 Mar;52(3):294-305. doi: 10.1038/s41588-020-0592-7.</div></main>'
  );
  assert.equal(zh(doc.querySelector(".docsum-pmid").textContent), "PMID: 36996813");
  assert.equal(zh(doc.querySelector(".gene").textContent), "BRCA1 TP53 EGFR");
  assert.equal(doc.querySelector('input[name="filter"]').getAttribute("value"), "pubt.review");
  assert.deepEqual([...doc.querySelectorAll("option")].map((e) => zh(e.textContent)), ["PubMed", "CSV", "MEDLINE"]);
  assert.equal(
    zh(doc.querySelector(".citation").textContent),
    "Nat Genet. 2020 Mar;52(3):294-305. doi: 10.1038/s41588-020-0592-7."
  );
});

test("负例：一条译文里不得中英混排（新词条译文不含 ASCII 单词）", () => {
  // 允许的例外：品牌/专有名词整体保留（PMC、MeSH、NIH、PubMed、LinkOut 之类）
  const allow = /^(PMID|PMC|NLM|NCBI|MeSH|NIH)/;
  for (const [k, v] of Object.entries(dict.exact)) {
    if (allow.test(k)) continue;
    const asciiWords = (v.match(/[A-Za-z]{2,}/g) || []).filter((w) => !/^(PMC|MeSH|NIH|PubMed|LinkOut|DOI|CSV|MEDLINE|ET)$/.test(w));
    assert.equal(asciiWords.length, 0, "译文里出现英文单词（半中半英）：" + k + " → " + v);
  }
});