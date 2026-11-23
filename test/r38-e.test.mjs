// r38-e 词库补译：Expression Atlas（dict/string-atlas.json）、GEO（dict/geo-extra.json）、
// KEGG 发布说明（dict/kegg-docs.json）。
// 原文取自真实渲染 DOM（CDP 9227，无扩展的 incognito 上下文核对过 gxa 原始节点形状）：
//   https://www.ebi.ac.uk/gxa/experiments/E-MTAB-3358/Results
//     <li>Sex: all</li> / <li>Sample lot number: all</li> / <li>Tissue supergroup: all</li>（各 3 个文本节点）
//     <div id="dataProvider"> 里的 "Raw Data Provider:" 文本节点 + a.thick-link[title="'Experiment Data Provider'"]
//   https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE1000
//     <td nowrap>Lab</td>（提交者信息表行标签）、<td class="message">Processed data included within Sample table</td>
//   https://www.kegg.jp/kegg/docs/relnote.html
//     <h3 class="txt3">KEGG Release Notes</h3>、<h4>Current release</h4>、<h4>Past releases</h4>
// 说明：relnote 页的「See also … and …」两个链接与 DBGET 菜单里的 Help/Addendum 夹在英文长块内，
// 引擎的正文保护（inLongProse）按设计不翻这类句内短链，本轮只落词条不改引擎/站点配置。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const createEngine = new Function(
  fs.readFileSync(path.join(root, "../src/engine.js"), "utf8") + "; return createEngine;"
)();
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const loadBook = (id) => JSON.parse(fs.readFileSync(path.join(root, "../dict/" + id + ".json"), "utf8"));

const atlas = loadBook("string-atlas");
const geo = loadBook("geo-extra");
const kegg = loadBook("kegg-docs");
const common = loadBook("common");

const CJK = /[\u3400-\u9fff]/;

// 按 config/sites.json 的 dict 组装配运行时词表（与生产一致）
function siteData(siteId) {
  const cfg = sites.find((s) => s.id === siteId);
  assert.ok(cfg, "缺少站点配置 " + siteId);
  const data = { exact: {}, rules: [], templates: [] };
  for (const id of cfg.dicts) {
    const d = loadBook(id);
    Object.assign(data.exact, d.exact || {});
    data.rules.push(...(d.rules || []));
    data.templates.push(...(d.templates || []));
  }
  return { site: cfg, data };
}

function mount(siteId, html, url) {
  const { site, data } = siteData(siteId);
  const dom = new JSDOM(html, { url });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data,
    site: { ...site, spa: false, waitFor: "" }
  });
  engine.start();
  return dom.window.document;
}

const norm = (el) => String(el.textContent || "").replace(/\s+/g, " ").trim();

test("词库条目：三册新增键齐全，键无中文、译文含中文", () => {
  assert.equal(atlas.exact["Sex"], "性别");
  assert.equal(atlas.exact["Sample lot number"], "样本批号");
  assert.equal(atlas.exact["Tissue supergroup"], "组织超类");
  assert.equal(atlas.exact["Raw Data Provider:"], "原始数据提供方：");
  assert.equal(atlas.exact["'Experiment Data Provider'"], "'实验数据提供方'");

  assert.equal(geo.exact["Lab"], "实验室");
  assert.equal(geo.exact["Processed data included within Sample table"], "处理后的数据包含在样本表中");

  assert.equal(kegg.exact["KEGG Release Notes"], "KEGG 发布说明");
  assert.equal(kegg.exact["Current release"], "当前版本");
  assert.equal(kegg.exact["Past releases"], "过往版本");
  assert.equal(kegg.exact["GenomeNet release notes archive"], "GenomeNet 发布说明存档");
  assert.equal(kegg.exact["past announcements"], "历史公告");
  assert.equal(kegg.exact["Addendum"], "附录");

  // Help 已在 common/kegg 两册，kegg-docs 不重复收录
  assert.equal(kegg.exact["Help"], undefined);
  assert.equal(common.exact["Help"], "帮助");

  for (const [book, key, val] of [
    [atlas, "Sex", "性别"],
    [atlas, "Sample lot number", "样本批号"],
    [geo, "Lab", "实验室"],
    [kegg, "Addendum", "附录"]
  ]) {
    assert.ok(!CJK.test(key), "键含中文: " + key);
    assert.ok(CJK.test(val), "译文无汉字: " + key);
  }
});

test("Expression Atlas：三条筛选规则已锚定且带捕获组回填", () => {
  const byRe = new Map(atlas.rules.map((r) => [r.re, r.to]));
  assert.equal(byRe.get("^Sex: (.+)$"), "性别：$1");
  assert.equal(byRe.get("^Sample lot number: (.+)$"), "样本批号：$1");
  assert.equal(byRe.get("^Tissue supergroup: (.+)$"), "组织超类：$1");
  for (const re of ["^Sex: (.+)$", "^Sample lot number: (.+)$", "^Tissue supergroup: (.+)$"]) {
    assert.ok(re.startsWith("^") && re.endsWith("$"), "规则未锚定: " + re);
  }
});

test("Expression Atlas：筛选面板的「标签 + 冒号 + 取值」三段文本整行翻成中文", () => {
  const dom = new JSDOM("<body></body>", { url: "https://www.ebi.ac.uk/gxa/experiments/E-MTAB-3358/Results" });
  const doc = dom.window.document;
  const ul = doc.createElement("ul");
  // 真实 DOM 是 Angular 插值产生的三段文本节点（label / ": " / value），childNodes.length === 3
  for (const [label, value] of [["Sex", "all"], ["Sample lot number", "all"], ["Tissue supergroup", "all"]]) {
    const li = doc.createElement("li");
    li.appendChild(doc.createTextNode(label));
    li.appendChild(doc.createTextNode(": "));
    li.appendChild(doc.createTextNode(value));
    ul.appendChild(li);
  }
  doc.body.appendChild(ul);
  const { site, data } = siteData("gxa");
  const engine = createEngine({ document: doc, window: dom.window, data, site: { ...site, spa: false, waitFor: "" } });
  engine.start();
  assert.deepEqual([...doc.querySelectorAll("li")].map(norm), ["性别：全部", "样本批号：全部", "组织超类：全部"]);
});

test("Expression Atlas：单文本节点与纯标签两种形态同样生效", () => {
  const d1 = mount("gxa", "<li>Sex: all</li>", "https://www.ebi.ac.uk/gxa/experiments/E-MTAB-3358/Results");
  assert.equal(norm(d1.querySelector("li")), "性别：全部");
  const d2 = mount("gxa", "<li>Sample lot number</li><li>Tissue supergroup</li>", "https://www.ebi.ac.uk/gxa/");
  assert.deepEqual([...d2.querySelectorAll("li")].map(norm), ["样本批号", "组织超类"]);
});

test("Expression Atlas：数据来源标签与 tooltip 属性翻成中文，项目名保持英文", () => {
  const d = mount(
    "gxa",
    "<div id='dataProvider'>\n  Raw Data Provider:\n  <div>" +
      "<a class='thick-link' title=\"'Experiment Data Provider'\" href='http://fantom.gsc.riken.jp/data/'>The FANTOM5 project</a>" +
      "</div>\n</div>",
    "https://www.ebi.ac.uk/gxa/experiments/E-MTAB-3358/Results"
  );
  const dp = d.querySelector("#dataProvider");
  assert.equal(norm(dp), "原始数据提供方： The FANTOM5 project");
  assert.ok(norm(dp).startsWith("原始数据提供方："));
  const a = d.querySelector("a.thick-link");
  assert.equal(a.getAttribute("title"), "'实验数据提供方'");
  assert.equal(norm(a), "The FANTOM5 project");
});

test("GEO 提交者信息表：Lab 行标签翻成中文，值与其他行不动", () => {
  const d = mount(
    "ncbi-geo",
    "<table><tr><td nowrap>Lab</td><td>Laboratory for Biomedical Materials Research</td></tr>" +
      "<tr><td>Department</td><td>Structural Biology Lab</td></tr></table>",
    "https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE1000"
  );
  const tds = [...d.querySelectorAll("td")].map(norm);
  assert.equal(tds[0], "实验室");
  // 值里带 Lab 的长串、以及以 Lab 结尾的部门名都不许被整词替换
  assert.equal(tds[1], "Laboratory for Biomedical Materials Research");
  assert.equal(tds[3], "Structural Biology Lab");
});

test("GEO 补充文件说明句：td.message 整句翻成中文", () => {
  const d = mount(
    "ncbi-geo",
    "<table><tr><td class='message'>Processed data included within Sample table</td></tr></table>",
    "https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE1000"
  );
  assert.equal(norm(d.querySelector("td.message")), "处理后的数据包含在样本表中");
});

test("KEGG 发布说明：主标题与两个分区标题翻成中文", () => {
  const d = mount(
    "kegg",
    "<h3 class='txt3'>KEGG Release Notes</h3><h4>Current release</h4><h4>Past releases</h4>" +
      "<p>Release 120.0, October 1, 2026</p>",
    "https://www.kegg.jp/kegg/docs/relnote.html"
  );
  assert.equal(norm(d.querySelector("h3")), "KEGG 发布说明");
  assert.deepEqual([...d.querySelectorAll("h4")].map(norm), ["当前版本", "过往版本"]);
  // 版本行只换「Release」词头（kegg.json 既有规则），版本号与日期原样
  assert.equal(norm(d.querySelector("p")), "版本 120.0, October 1, 2026");
});

test("KEGG 独立导航项：Addendum / 存档 / 历史公告 / Help 在短列表里生效", () => {
  const d = mount(
    "kegg",
    "<ul><li><a href='/dbget-bin/www_bfind?ag'>Addendum</a></li>" +
      "<li><a href='/kegg/docs/release.html'>GenomeNet release notes archive</a></li>" +
      "<li><a href='/kegg/docs/announce.html?past'>past announcements</a></li>" +
      "<li><a href='javascript:void(0)'>Help</a></li></ul>",
    "https://www.kegg.jp/kegg/docs/relnote.html"
  );
  assert.deepEqual([...d.querySelectorAll("a")].map(norm), [
    "附录", "GenomeNet 发布说明存档", "历史公告", "帮助"
  ]);
});

test("不翻项：登录号、学名、项目名、长英文说明保持原样", () => {
  const d = mount(
    "kegg",
    "<p>KEGG GENES is a collection of complete genomes (each identified by the organism code or T number).</p>",
    "https://www.kegg.jp/kegg/docs/relnote.html"
  );
  assert.equal(
    norm(d.querySelector("p")),
    "KEGG GENES is a collection of complete genomes (each identified by the organism code or T number)."
  );
});
