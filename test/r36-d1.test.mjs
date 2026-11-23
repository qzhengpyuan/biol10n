// r36-d1：模板通道逐条试（Europe PMC 评论提示 / BioStudies 引文行与 ORCID / PRIDE 作者角色与引文分隔）
// 原文全部取自真实渲染 DOM（CDP 9227，BioL10n 0.10.40 在 2026-11-24 采集）。
// 本文件只锁已落库的改动；两条被引擎限制挡下的（ENA 裸 and、EPMC 整句模板）写在 research/r36-d1.md。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();

const readBook = (id) => JSON.parse(fs.readFileSync(path.join(root, "../dict", id + ".json"), "utf8"));

/** 按站点线上的册叠取词库数据 */
function stack(ids) {
  const exact = {}, rules = [], templates = [];
  for (const id of ids) {
    const d = readBook(id);
    Object.assign(exact, d.exact || {});
    if (d.rules) rules.push(...d.rules);
    if (d.templates) templates.push(...d.templates);
  }
  return { exact, rules, templates };
}

const EPMC = stack(["common", "europepmc"]);
const BST = stack(["common", "string-atlas", "string-atlas2", "biostudies"]);
const PRIDE = stack(["common", "spa", "pride"]);

function boot(html, data) {
  const dom = new JSDOM("<body>" + html + "</body>", { url: "https://europepmc.org/article/MED/34887591" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data,
    site: { scope: "body", block: "pre, code" }
  });
  engine.start();
  return { dom, engine, doc: dom.window.document };
}

const text = (el) => String((el && el.textContent) || "").replace(/\s+/g, " ").trim();

// ---------- Europe PMC：文章页通知条 ----------

// 真实 DOM：注释节点被链切成「固定前缀 + <a>引文</a> + " + 题录」
const EPMC_COMMENT = [
  '<div class="notificationList"><div class="notification-list">',
  '<span class="notification small informative"><i class="fas fa-info-circle"></i>',
  'A comment on this article appears in "<a href="/article/MED/35314811" class="">Diversity in human genetics studies accelerates discovery and improves health care.</a>"',
  "Nat Rev Cardiol. 2022 May;19(5):289-290. doi: 10.1038/s41569-022-00696-8..",
  "</span></div></div>"
].join("\n");

test("EPMC 评论提示：固定前缀翻成中文，引文链接与题录原样", () => {
  const { dom, doc, engine } = boot(EPMC_COMMENT, EPMC);
  const span = doc.querySelector("span.notification");
  assert.match(text(span), /^本文评论见："/, "前缀应换成中文并保留开引号");
  assert.ok(/Diversity in human genetics studies/.test(text(span)), "引文标题（题录）不翻");
  assert.ok(/Nat Rev Cardiol\. 2022 May;19\(5\):289-290/.test(text(span)), "题录不吞不改");
  assert.equal(span.querySelector("a").getAttribute("href"), "/article/MED/35314811", "引文链接不变");
  assert.equal(engine.stats.tpl, 0, "这条走 exact 通道，不是模板");
  dom.window.close();
});

test("EPMC 评论提示：disable 能还原英文", () => {
  const { dom, engine, doc } = boot(EPMC_COMMENT, EPMC);
  const span = doc.querySelector("span.notification");
  assert.match(text(span), /本文评论见/);
  engine.disable();
  assert.match(text(span), /^A comment on this article appears in "/, "还原成原文");
  assert.ok(span.querySelector("a"), "还原后链接仍在");
  dom.window.close();
});

// ---------- BioStudies：publication 引文行 ----------

// 真实 DOM（S-EPMC516016）：同一 span 里「2004 8 月」「DOI 号」已是中文，Volume / Page 留在英文
const BST_PUBLICATION = [
  '<span class="publication">',
  '         <i><span>BMC bioinformatics</span></i>.',
  '         <span>2004 8 月</span>;',
  '         Volume <span>5</span>.',
  '        ',
  '         Page: <span>109</span>.',
  '            <span class="publication-link">',
  '                <span class="publication-link-type"><i class="fa fa-external-link-alt" aria-hidden="true"></i> DOI 号</span>',
  '                <a href="https://dx.doi.org/10.1186%2F1471-2105-5-109" target="_blank"><span>10.1186/1471-2105-5-109</span></a>',
  '            </span>',
  '            <span class="publication-link">',
  '                <span class="publication-link-type"><i class="fa fa-external-link-alt" aria-hidden="true"></i> PMC</span>',
  '                <a href="https://europepmc.org/articles/PMC516016" target="_blank"><span>PMC516016</span></a>',
  '            </span>',
  '            <span class="publication-link">',
  '                <span class="publication-link-type"><i class="fa fa-external-link-alt" aria-hidden="true"></i> PMID</span>',
  '                <a href="https://europepmc.org/abstract/MED/15307895" target="_blank"><span>15307895</span></a>',
  '            </span>',
  '        ',
  "    </span>"
].join("\n");

test("BioStudies 引文行：七槽位模板整行命中，卷/页中文化", () => {
  const { dom, doc, engine } = boot(BST_PUBLICATION, BST);
  const span = doc.querySelector("span.publication");
  const t = text(span);
  assert.match(t, /；第 5 卷。第 109 页。/, "Volume / Page 换成「第 N 卷」「第 N 页」");
  assert.ok(!/; Volume |Page: /.test(t), "英文标签不再残留");
  assert.match(t, /^BMC bioinformatics\. 2004 8 月/, "刊名与已有中文日期按原位搬回");
  assert.equal(engine.stats.tpl, 1, "模板命中一次");
  dom.window.close();
});

test("BioStudies 引文行：三个出版链接与 href 全部保留", () => {
  const { dom, doc } = boot(BST_PUBLICATION, BST);
  const links = Array.from(doc.querySelectorAll("span.publication a"));
  assert.equal(links.length, 3, "DOI / PMC / PMID 链接不能丢");
  assert.deepEqual(
    links.map((a) => a.getAttribute("href")),
    [
      "https://dx.doi.org/10.1186%2F1471-2105-5-109",
      "https://europepmc.org/articles/PMC516016",
      "https://europepmc.org/abstract/MED/15307895"
    ]
  );
  assert.match(text(doc.querySelector("span.publication")), /DOI 号/);
  dom.window.close();
});

test("BioStudies 引文行：disable 还原成英文原行", () => {
  const { dom, doc, engine } = boot(BST_PUBLICATION, BST);
  const span = doc.querySelector("span.publication");
  engine.disable();
  const t = text(span);
  assert.match(t, /; Volume 5\. Page: 109\./, "还原后 Volume / Page 回来");
  assert.equal(span.querySelectorAll("a").length, 3, "还原后链接仍在");
  dom.window.close();
});

test("BioStudies 引文行：没有 Volume / Page 的行不套模板（形态不同即放手）", () => {
  const html =
    '<span class="publication"><i><span>Nature</span></i>. <span>2019 6 月</span>; <span class="publication-link">' +
    '<span class="publication-link-type"> DOI 号</span><a href="https://dx.doi.org/10.1/x"><span>10.1/x</span></a></span></span>';
  const { dom, doc, engine } = boot(html, BST);
  assert.equal(engine.stats.tpl, 0, "形态不一致时不替换");
  assert.match(text(doc.querySelector("span.publication")), /Nature/, "保持英文原样，不做半翻");
  dom.window.close();
});

// ---------- BioStudies：ORCID 链接的 title 属性 ----------

test("BioStudies ORCID：title 固定句 + URL 走规则通道", () => {
  const html =
    '<a href="https://orcid.org/0000-0002-6982-4660" target="_blank" ' +
    'title="Click to open ORCID profile: https://orcid.org/0000-0002-6982-4660" class="orcid">' +
    '<img alt="https://orcid.org/0000-0002-6982-4660" src="/biostudies/images/orcid.svg"></a>';
  const { dom, doc, engine } = boot(html, BST);
  const a = doc.querySelector("a.orcid");
  assert.equal(a.getAttribute("title"), "点击打开 ORCID 主页：https://orcid.org/0000-0002-6982-4660");
  assert.equal(a.getAttribute("href"), "https://orcid.org/0000-0002-6982-4660", "href 不动");
  assert.equal(engine.stats.attrRule, 1, "走属性规则通道");
  dom.window.close();
});

test("BioStudies ORCID：作者卡的旧写法（无 Click to 前缀）仍能翻", () => {
  const html = '<a title="open ORCID profile: https://orcid.org/0000-0002-1111-2222" href="#">ORCID</a>';
  const { dom, doc } = boot(html, BST);
  assert.equal(doc.querySelector("a").getAttribute("title"), "打开 ORCID 主页：https://orcid.org/0000-0002-1111-2222");
  dom.window.close();
});

// ---------- PRIDE：作者单位后的角色标注、引文分隔标签 ----------

test("PRIDE 作者行：单位保留英文，(lab head) 译成角色标注", () => {
  const html =
    '<p><a href="mailto:lg390@cam.ac.uk">Dr Laurent Gatto</a>' +
    "<span>, Department of Biochemistry, University of Cambridge (lab head)</span></p>";
  const { dom, doc, engine } = boot(html, PRIDE);
  const t = text(doc.querySelector("p"));
  assert.ok(t.endsWith("（实验室负责人）"), "角色标注中文化: " + t);
  assert.ok(t.includes(", Department of Biochemistry, University of Cambridge"), "单位名原样保留");
  assert.equal(engine.stats.hitRule, 1);
  dom.window.close();
});

test("PRIDE 作者行：没有 (lab head) 的纯单位串保持英文", () => {
  const html =
    '<p><a href="mailto:lg390@cam.ac.uk">Dr Laurent Gatto</a>' +
    "<span>, Department of Biochemistry, University of Cambridge</span></p>";
  const { dom, doc } = boot(html, PRIDE);
  assert.equal(text(doc.querySelector("p")), "Dr Laurent Gatto, Department of Biochemistry, University of Cambridge");
  dom.window.close();
});

test("PRIDE 引文行：'; PubMed:' 分隔标签中文化，PMID 链接不动", () => {
  const html =
    "<ul><li><p>Gatto L, Christoforou A; Using R and Bioconductor for proteomics data analysis., " +
    "Biochim Biophys Acta, 2013 May 18, </p>DOI 号 <a>10.1016/j.bbapap.2013.04.032</a> ; PubMed: " +
    "<a>23692960</a></li></ul>";
  const { dom, doc } = boot(html, PRIDE);
  const li = doc.querySelector("li");
  assert.match(text(li), /；PubMed 编号/, "分隔标签中文");
  assert.ok(/23692960/.test(text(li)), "PMID 值不动");
  assert.equal(li.querySelectorAll("a")[1].textContent, "23692960", "PMID 链接文本不变");
  dom.window.close();
});

// ---------- 结构自检：模板槽位必须 1..N 连续，规则的捕获组要用到 ----------

test("新增条目结构：模板槽位连续、规则捕获组被使用", () => {
  const bst = readBook("biostudies");
  const tpl = bst.templates.find((t) => t.pat.startsWith("{{1}}. {{2}}; Volume {{3}}. Page: {{4}}."));
  assert.ok(tpl, "引文行模板已落库");
  const patNums = [...tpl.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  const zhNums = [...tpl.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  assert.deepEqual(patNums, [1, 2, 3, 4, 5, 6, 7], "pat 七槽位顺序");
  assert.deepEqual(zhNums, [1, 2, 3, 4, 5, 6, 7], "zh 七槽位顺序");
  assert.ok(patNums.every((n) => zhNums.includes(n)), "每个槽位都要用到");
  const rule = bst.rules.find((r) => r.re === "^Click to open ORCID profile: (.+)$");
  assert.ok(rule && /\$1/.test(rule.to), "ORCID 规则用到捕获组");
  const pride = readBook("pride");
  assert.equal(pride.exact["; PubMed:"], "；PubMed 编号");
  const labHead = pride.rules.find((r) => r.re === "^(.*) \\(lab head\\)$");
  assert.ok(labHead && /\$1/.test(labHead.to), "(lab head) 规则用到捕获组");
  const epmc = readBook("europepmc");
  assert.equal(epmc.exact['A comment on this article appears in "'], '本文评论见："');
});
