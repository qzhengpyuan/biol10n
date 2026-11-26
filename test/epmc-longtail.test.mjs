// Europe PMC / UniProt 长尾补译（dict/europepmc.json、dict/uniprot.json、dict/uniprot2.json）
// 覆盖：EPMC 页脚资助句、关于页资助句与「下一步」要点、高级检索 NOT 说明；
//       UniProt 异构体说明句规则、帮助页按钮、关键词分面。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;

const epmcDict = JSON.parse(fs.readFileSync(path.join(root, "../dict/europepmc.json"), "utf8"));
const uniprotDict = JSON.parse(fs.readFileSync(path.join(root, "../dict/uniprot.json"), "utf8"));
const uniprot2Dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/uniprot2.json"), "utf8"));

const epmcSite = { ...sites.find((s) => s.id === "europepmc"), spa: false, rescan: false };
const uniprotSite = { ...sites.find((s) => s.id === "uniprot"), spa: false, rescan: false };

function mergeDicts(names) {
  const exact = {}, rules = [], templates = [];
  for (const n of names) {
    const d = JSON.parse(fs.readFileSync(path.join(root, "../dict", n + ".json"), "utf8"));
    Object.assign(exact, d.exact || {});
    for (const r of d.rules || []) rules.push(r);
    for (const t of d.templates || []) templates.push(t);
  }
  return { exact, rules, templates };
}

const epmcData = mergeDicts(epmcSite.dicts);
const uniprotData = mergeDicts(uniprotSite.dicts);

function mount(site, data, inner, url) {
  const dom = new JSDOM("<body>" + inner + "</body>", { url });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data,
    site
  });
  engine.start();
  return dom.window.document;
}

function mountEpmc(inner) {
  return mount(epmcSite, epmcData, inner, "https://europepmc.org/about");
}

function mountUniprot(inner) {
  return mount(uniprotSite, uniprotData, inner, "https://www.uniprot.org/uniprotkb/P04637/entry");
}

function text(doc) {
  return String(doc.body.textContent).replace(/\s+/g, " ").trim();
}

// ---------------- 结构校验 ----------------

test("欧洲 PMC：新增词条存在且格式合法", () => {
  const want = {
    "Support by a group of international science": "Europe PMC 的运行得益于一批国际科学",
    "makes Europe PMC possible.": "的支持。",
    "refines a search, one term must be present, while the other term is excluded from the results.": "精炼检索，一个词必须出现，另一个词从结果中排除。",
    "containing preprint abstracts and full text for preprints on COVID-19": "收录关于 COVID-19 预印本的摘要与全文",
    "from various life science databases text-mined from publications.": "来自各生命科学数据库，经文献文本挖掘得到。"
  };
  for (const [k, v] of Object.entries(want)) assert.equal(epmcDict.exact[k], v, k);
  assert.ok(Object.keys(epmcDict.exact).length >= 250, "exact 条目应不少于 250 条");
});

// 纯专名 + 全角标点的既有译文（与 ncbi-help 等册对齐，改任一册都会新增跨册冲突）
const PROPER_ONLY = new Set([
  "BibTex (Mendeley, Papers)",
  "RIS (EndNote, Mendeley, Refworks)",
  "PubMed Central (PMC)"
]);

test("Europe PMC：exact 卫生（无中文键、译文含中文、非自映射、无 URL/邮箱、无首尾空白）", () => {
  for (const [k, v] of Object.entries(epmcDict.exact)) {
    assert.ok(!/[\u3400-\u9fff]/.test(k), "key 含中文：" + k);
    if (!PROPER_ONLY.has(k)) assert.ok(/[\u3400-\u9fff]/.test(v), "value 无中文：" + k);
    assert.notEqual(k, v, "自映射：" + k);
    assert.ok(!/https?:\/\/|[\w.+-]+@[\w-]+\.\w+/.test(v), "value 含明文 URL/邮箱：" + k);
    assert.equal(k, k.trim(), "key 首尾空白：" + JSON.stringify(k));
    assert.equal(v, v.trim(), "value 首尾空白：" + JSON.stringify(v));
  }
});

test("UniProt：新增 exact 与 rules 存在且格式合法", () => {
  assert.equal(uniprot2Dict.exact["Load more articles"], "加载更多文章");
  assert.equal(uniprot2Dict.exact["Allergen"], "过敏原");
  const res = uniprot2Dict.rules.map((r) => r.re);
  assert.ok(res.includes("^There are ([\\d,]+) potential isoforms mapped to this entry$"), "缺少潜在异构体规则");
  assert.ok(res.includes("^This entry describes (\\d+) isoforms produced by (.+)\\.$"), "缺少异构体描述规则");
  for (const r of uniprot2Dict.rules) {
    assert.ok(r.re.startsWith("^") && r.re.endsWith("$"), "规则必须锚定：" + r.re);
    const groups = (r.re.match(/\((?!\?)/g) || []).length;
    const refs = [...new Set([...r.to.matchAll(/\$(\d)/g)].map((m) => Number(m[1])))];
    for (const n of refs) assert.ok(n <= groups, "$ 引用越界：" + r.re);
  }
});

test("UniProt：导致半中半英的碎片词条已删除", () => {
  for (const k of ["This entry describes", "produced by", "isoform 1-mediated", "mapped to this entry"]) {
    assert.equal(uniprotDict.exact[k], undefined, "应已删除：" + k);
  }
});

// ---------------- 引擎行为 ----------------

test("EPMC 页脚资助句：三个节点拼成一句中文，不留英文残片", () => {
  const doc = mountEpmc(
    '<div id="supporters-section"><p class="h2">Supporters</p>' +
      "<p>Support by a group of international science <a href=\"#\">funders</a> makes Europe PMC possible.</p></div>"
  );
  const p = doc.querySelectorAll("#supporters-section p")[1];
  const out = String(p.textContent).replace(/\s+/g, " ").trim();
  assert.equal(out, "Europe PMC 的运行得益于一批国际科学资助机构的支持。");
  // 只允许专名 Europe PMC 留在句首，不得残留 funders / makes 这类英文单词
  assert.ok(!/\b(funders|makes|possible|science)\b/.test(out), "不应残留英文单词：" + out);
});

test("EPMC 关于页：资助方段落与「下一步」要点整段为中文", () => {
  const doc = mountEpmc(
    '<div id="supporters-section"><p>Support by a group of international science <a href="#">funders</a> makes Europe PMC possible.</p></div>' +
    '<ul><li><b>Publishing innovation</b>: Building on emerging trends in scholarly communication, from including preprints to integrating ORCIDs.</li></ul>' +
    '<li><b>Reproducible science</b>: Supporting open data re-use by linking publications with underlying data.</li>' +
    '<li><b>Text &amp; data mining</b>: Enabling data-driven discovery by offering more efficient ways to read and process scientific literature with the help of text-mining and machine learning technologies.</li>'
  );
  const li = doc.querySelector("li");
  const out = String(li.textContent).replace(/\s+/g, " ").trim();
  assert.match(out, /^出版创新：/, "要点应整行中文：" + out);
  assert.ok(!/[a-z]{3,}/.test(out), "不应残留英文小写单词：" + out);
});

test("EPMC 高级检索：NOT 说明句译成中文", () => {
  const doc = mountEpmc(
    '<div class="diagram"><p><span>NOT</span>refines a search, one term must be present, while the other term is excluded from the results.</p></div>'
  );
  const out = String(doc.querySelector(".diagram p").textContent).replace(/\s+/g, " ").trim();
  assert.equal(out, "非精炼检索，一个词必须出现，另一个词从结果中排除。");
});

test("EPMC 关于页下载清单：预印本子集与登录号两条整句中文", () => {
  const doc = mountEpmc(
    '<ul><li><a href="#">Preprints subset</a> containing preprint abstracts and full text for preprints on COVID-19</li>' +
    '<li><a href="#">Accession numbers</a> from various life science databases text-mined from publications.</li></ul>'
  );
  const lis = [...doc.querySelectorAll("li")].map((li) => String(li.textContent).replace(/\s+/g, " ").trim());
  assert.equal(lis[0], "预印本子集收录关于 COVID-19 预印本的摘要与全文");
  assert.equal(lis[1], "登录号来自各生命科学数据库，经文献文本挖掘得到。");
});

test("UniProt 异构体计数句：整句中文，不再半中半英", () => {
  const doc = mountUniprot("<p>There are 17 potential isoforms mapped to this entry</p>");
  assert.equal(text(doc), "本条目映射了 17 个潜在异构体。");
});

test("UniProt 异构体说明句：规则命中被 strong/span 切开的整句", () => {
  const doc = mountUniprot(
    "<p>This entry describes <strong>9</strong> <span>isoforms</span> produced by " +
      "<strong>Alternative promoter usage &amp; Alternative splicing</strong>.</p>"
  );
  assert.equal(text(doc), "本条目描述了由选择性启动子使用与选择性剪接产生的 9 个异构体。");
});

test("UniProt 帮助页按钮与关键词分面译成中文", () => {
  const doc = mountUniprot('<button class="button secondary">Load more articles</button><li><label>Allergen<span> (1)</span></label></li>');
  assert.equal(doc.querySelector("button").textContent.trim(), "加载更多文章");
  assert.match(String(doc.querySelector("label").textContent), /过敏原/);
});