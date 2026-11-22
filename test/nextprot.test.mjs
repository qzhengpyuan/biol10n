// neXtProt 归档页（dict/nextprot.json）回归。
// www.nextprot.org 已于 2025 年整体 301 到 https://www.expasy.org/archives/nextprot，
// SPA、/entry/NX_*、检索与文档页均已下线，本册只覆盖归档页，并与 expasy 册同栈加载。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/nextprot.json"), "utf8"));
const SITES = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const URL_ARCHIVE = "https://www.expasy.org/archives/nextprot";

const CJK = /[\u4e00-\u9fff]/;
const FALLBACK = {
  id: "nextprot",
  hosts: ["www.expasy.org", "expasy.org", "www.nextprot.org", "nextprot.org"],
  path: "^/archives/nextprot",
  dicts: ["common", "expasy", "nextprot"],
  scope: "body",
  attrs: ["placeholder", "title", "aria-label", "alt", "value"]
};
const site = SITES.find((s) => s.id === "nextprot") || FALLBACK;

const dicts = new Map();
const load = (id) => {
  if (!dicts.has(id)) {
    const p = path.join(root, "../dict", id + ".json");
    dicts.set(id, fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null);
  }
  return dicts.get(id);
};
const data = { exact: {}, rules: [], templates: [] };
for (const id of site.dicts) {
  const b = load(id);
  if (!b) continue;
  Object.assign(data.exact, b.exact || {});
  data.rules = data.rules.concat(b.rules || []);
  data.templates = data.templates.concat(b.templates || []);
}

function run(html, url) {
  const dom = new JSDOM(html, { url: url || URL_ARCHIVE });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return dom.window.document;
}
const text = (el) => el.textContent.replace(/\s+/g, " ").trim();

test("词库结构：family/sites、条数、键值形态与模板槽位", () => {
  assert.equal(book.meta.family, "nextprot");
  assert.ok(book.meta.sites.includes("www.expasy.org"), "覆盖主机是 expasy（归档页在这里）");
  assert.match(book.meta.note, /nextprot\.org/, "meta.note 要写明 301 到归档页这件事");
  const keys = Object.keys(book.exact);
  assert.ok(keys.length >= 10, "exact 只有 " + keys.length + " 条");
  assert.ok(book.templates.length >= 8, "templates 太少: " + book.templates.length);
  assert.deepEqual(book.rules, [], "归档页没有带变量的句式，不该有 rules");
  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(!CJK.test(k), "键里不能有中文: " + k);
    assert.ok(CJK.test(v), "译文里必须有中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "键首尾不能有空白: " + JSON.stringify(k));
    assert.equal(v, v.trim(), "值首尾不能有空白: " + JSON.stringify(k));
    assert.ok(!/https?:\/\/|@[\w.-]+\.\w+/.test(v), "译文里不能有 URL/邮箱: " + k);
  }
  for (const t of book.templates) {
    const slots = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
    assert.ok(slots.length >= 1, "模板要带槽位: " + t.pat);
    slots.forEach((n, i) => assert.equal(n, i + 1, "槽位必须从 1 连续: " + t.pat));
    const zhSlots = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
    assert.deepEqual(zhSlots, slots, "译文槽位要与原文一致: " + t.pat);
    assert.ok(t.pat.length >= 20, "模板原文太短（引擎不接受 <20 字符）: " + t.pat);
  }
});

test("退役公告：标题句与两句正文整段成中文，neXtProt 名称保持原样", () => {
  const doc = run(
    "<div>" +
      "<h1>neXtProt</h1>" +
      "<p>Established in 2010, the neXtProt knowledgebase was created to capture insights from emerging omics studies " +
      "by performing deep curation of clinically relevant disease mutations. It employed cutting-edge semantic technologies " +
      "to integrate data from genomics, transcriptomics, and proteomics.</p>" +
      "<strong>After 14 years, neXtProt has reached its end of life and no longer provides data or services. " +
      "Thank you for your support and trust!</strong>" +
      "<p>Though neXtProt services have ended, we’ve ensured that its data and tools remain accessible for future research.</p>" +
      "</div>"
  );
  assert.equal(text(doc.querySelector("h1")), "neXtProt", "项目名不翻");
  assert.equal(
    text(doc.querySelector("strong")),
    "历经 14 年，neXtProt 已终止服务，不再提供数据或服务。感谢你的支持与信任！"
  );
  const ps = [...doc.querySelectorAll("p")];
  assert.match(text(ps[0]), /^neXtProt 知识库创建于 2010 年，旨在通过对临床相关疾病突变进行深度策展/);
  assert.match(text(ps[0]), /它采用前沿的语义技术整合基因组学、转录组学与蛋白质组学数据。$/);
  assert.equal(text(ps[1]), "尽管 neXtProt 的服务已经结束，我们已确保其数据与工具仍可供后续研究使用。");
});

test("历史段：Additionally 段覆盖 HPP 参考资源与 2011–2023 时间点", () => {
  const doc = run(
    "<p>Additionally, neXtProt developed advanced tools to facilitate the exploration and querying of this data, " +
      "making it accessible to both general and specialized protein research. Between 2011 and 2023, it was recognized " +
      "as the primary reference resource for the Human Proteome Project (HPP). These achievements made neXtProt a powerful " +
      "tool for advancing our understanding of the human proteome and its implications in health and disease.</p>"
  );
  const t = text(doc.querySelector("p"));
  assert.match(t, /^此外，neXtProt 还开发了先进工具，便于探索与查询这些数据/);
  assert.match(t, /2011 年至 2023 年间，它被公认为人类蛋白质组计划（HPP）的主要参考资源。/);
  assert.match(t, /这些成果使 neXtProt 成为推进人类蛋白质组认识及其在健康与疾病中意义的强大工具。$/);
});

test("数据获取清单：Zenodo 八条模板 + DOI 链接与 href 都保持原样", () => {
  const doc = run(
    "<div>" +
      "<h2>Accessing Archived neXtProt Data and Source Code</h2>" +
      "<strong>Retrieve Data on Zenodo</strong>" +
      "<ul>" +
      '<li><a href="https://doi.org/10.5281/zenodo.14163587">DOI 10.5281/zenodo.14163587</a>: ' +
      "Latest release (September 2023) with extensive metadata.</li>" +
      '<li><a href="https://zenodo.org/communities/sib-swiss">SIB Swiss Institute of Bioinformatics - Biodata Resources Zenodo community</a>: ' +
      "neXtProt data releases prior to September 2023.</li>" +
      '<li><a href="https://doi.org/10.5281/zenodo.14355521">DOI 10.5281/zenodo.14355521</a>: Protein kinase function portal.</li>' +
      '<li><a href="https://doi.org/10.5281/zenodo.14356359">DOI 10.5281/zenodo.14356359</a>; ' +
      "Ion channels variants portal.</li>" +
      "</ul></div>"
  );
  assert.equal(text(doc.querySelector("h2")), "获取已归档的 neXtProt 数据与源代码");
  assert.equal(text(doc.querySelector("strong")), "在 Zenodo 获取数据");
  const lis = [...doc.querySelectorAll("li")];
  assert.equal(text(lis[0]), "DOI 10.5281/zenodo.14163587：最新发布（2023 年 9 月），含丰富元数据。");
  assert.equal(
    text(lis[1]),
    "SIB Swiss Institute of Bioinformatics - Biodata Resources Zenodo community：2023 年 9 月之前的 neXtProt 数据发布。"
  );
  assert.equal(text(lis[2]), "DOI 10.5281/zenodo.14355521：蛋白激酶功能门户。");
  assert.equal(text(lis[3]), "DOI 10.5281/zenodo.14356359：离子通道变异门户。", "分号那一条走的是另一条模板");
  assert.equal(lis[0].querySelector("a").getAttribute("href"), "https://doi.org/10.5281/zenodo.14163587");
  assert.equal(text(lis[0].querySelector("a")), "DOI 10.5281/zenodo.14163587", "DOI 是数据，不翻");
});

test("源码清单：GitHub 仓库条目 + Main repository 标签", () => {
  const doc = run(
    "<div><strong>Explore Source Code on GitHub</strong><ul>" +
      '<li><a href="https://github.com/calipho-sib">Main repository</a>: Comprehensive neXtProt projects and resources.</li>' +
      '<li><a href="https://github.com/calipho-sib/feature-viewer">Feature Viewer</a>: ' +
      "Interactive protein feature visualization tool.</li>" +
      '<li><a href="https://github.com/calipho-sib/nextprot-api">nextprot-api</a>: neXtProt functional proteome project .</li>' +
      "</ul></div>"
  );
  assert.equal(text(doc.querySelector("strong")), "在 GitHub 查看源代码");
  const lis = [...doc.querySelectorAll("li")];
  assert.equal(text(lis[0]), "主仓库：neXtProt 项目与资源的汇总。");
  assert.equal(text(lis[1]), "Feature Viewer：交互式蛋白质特征可视化工具。", "Feature Viewer 是工具名，保持英文");
  assert.equal(text(lis[2]), "nextprot-api：neXtProt 功能蛋白质组项目。");
  assert.equal(lis[1].querySelector("a").getAttribute("href"), "https://github.com/calipho-sib/feature-viewer");
});

test("替代资源指引：标题、Please refer to、HPP Portal 条目", () => {
  const doc = run(
    "<div><h2>Looking for human protein information?</h2><p>Please refer to:</p><ul>" +
      '<li><a href="https://www.uniprot.org/">human reviewed (Swiss-Prot) data</a> in UniProt</li>' +
      '<li><a href="https://hppportal.net/">HPP Portal</a>, a knowledge hub to support the HPP Grand Challenge</li>' +
      "</ul></div>"
  );
  assert.equal(text(doc.querySelector("h2")), "想找人类蛋白质信息？");
  assert.equal(text(doc.querySelector("p")), "请参阅：");
  const lis = [...doc.querySelectorAll("li")];
  assert.equal(text(lis[0]), "human reviewed (Swiss-Prot) data in UniProt", "UniProt 链接文字是数据源说明，整句保留");
  assert.equal(text(lis[1]), "HPP Portal，支持 HPP 宏大挑战的知识枢纽");
});

test("与 expasy 册同栈：页头导航与页脚跟着翻（本册不含这些键）", () => {
  assert.ok(!("Terms of Use" in book.exact), "页脚文案由 expasy 册提供，不能在本册重复定义");
  const doc = run(
    "<div><nav><a>Home</a><a>About</a><a>Help</a><a>News</a></nav>" +
      "<footer>Expasy is operated by the <a>SIB Swiss Institute of Bioinformatics</a> | " +
      '<a href="/terms-of-use">Terms of Use</a> <a href="#top">Back to the top</a></footer></div>'
  );
  assert.deepEqual([...doc.querySelectorAll("nav a")].map((e) => text(e)), ["首页", "关于", "帮助", "新闻"]);
  const links = [...doc.querySelectorAll("footer a")].map((e) => text(e));
  assert.deepEqual(links, ["SIB Swiss Institute of Bioinformatics", "使用条款", "返回顶部"]);
  assert.match(text(doc.querySelector("footer")), /^Expasy 由以下机构运营：/);
});

test("数据不动：DOI/PMID/PMCID/作者串/项目名", () => {
  const doc = run(
    '<table class="refs"><tr>' +
      "<td>10.1093/nar/gkz995</td><td>PMC7145669</td><td>PMID: 31691833</td>" +
      "<td>Zahn-Zabal M, Michel PA, Gateau A, Nikitin F, Schaeffer M, Audot E</td>" +
      "<td>neXtProt</td><td>HPP</td><td>Homo sapiens</td><td>NX_P04637</td>" +
      "</tr></table>"
  );
  assert.deepEqual(
    [...doc.querySelectorAll("td")].map((e) => text(e)),
    [
      "10.1093/nar/gkz995",
      "PMC7145669",
      "PMID: 31691833",
      "Zahn-Zabal M, Michel PA, Gateau A, Nikitin F, Schaeffer M, Audot E",
      "neXtProt",
      "HPP",
      "Homo sapiens",
      "NX_P04637"
    ]
  );
});

test("站点路由：/archives/nextprot 命中本册，普通资源页仍归 expasy（pick 顺序）", () => {
  // 与 src/boot.js 的 pick() 同构：hosts 匹配 → path 正则 → 第一条生效
  const route = (url) => {
    const u = new URL(url);
    for (const s of [site, { id: "expasy", hosts: ["www.expasy.org", "expasy.org"], dicts: ["common", "expasy"] }]) {
      const ok = s.hosts.some((h) => h === u.host) ;
      if (!ok) continue;
      if (s.path && !new RegExp(s.path).test(u.pathname)) continue;
      return s.id;
    }
    return null;
  };
  assert.equal(route("https://www.expasy.org/archives/nextprot"), "nextprot");
  assert.equal(route("https://www.expasy.org/archives/nextprot?x=1"), "nextprot");
  assert.equal(route("https://www.expasy.org/resources/bgee"), "expasy");
  assert.equal(route("https://www.expasy.org/"), "expasy");
});

test("跨册一致：本册键不与 expasy/common 撞不同译法（lint 冲突防线）", () => {
  const others = [load("expasy"), load("common")];
  for (const other of others) {
    if (!other) continue;
    for (const [k, v] of Object.entries(book.exact)) {
      if (k in (other.exact || {})) {
        assert.equal(v, other.exact[k], "跨册同键不同值会被 lint 判冲突: " + k);
      }
    }
  }
});
