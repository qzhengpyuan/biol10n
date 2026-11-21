// UCSC 模板通道：hgTables 帮助条目 / 轨道说明 / 首页说明段被 <a>/<b>/<em> 切碎后整段翻
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const engineSrc = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(engineSrc + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/ucsc-tpl.json"), "utf8"));

const SITE = { scope: "body", block: "pre, code", attrs: [], proseMax: 120, proseExempt: "#descriptionText" };

function boot(html) {
  const dom = new JSDOM(html, { url: "https://genome.ucsc.edu/cgi-bin/hgTrackUi?db=hg38&g=refGene" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: {
      exact: dict.exact || {},
      rules: dict.rules || [],
      templates: dict.templates || []
    },
    site: SITE
  });
  engine.start();
  return { dom, engine, doc: dom.window.document };
}

const FEEDBACK =
  '<p>Please visit the <a href="/cgi-bin/hgFeedback?topic=RefSeq">Feedback for Gene and Reference Sequences (RefSeq)</a> ' +
  "page to make suggestions, submit additions and corrections, or ask for help concerning RefSeq records.</p>";

test("refGene 反馈句：整段变中文，链接仍在", () => {
  const { engine, doc, dom } = boot(FEEDBACK);
  const p = doc.querySelector("p");
  assert.match(p.textContent, /请访问基因与参考序列（RefSeq）反馈页面/, "整句应换成中文");
  assert.doesNotMatch(p.textContent, /make suggestions/, "英文原句不应残留");
  const a = p.querySelector("a");
  assert.ok(a, "链接节点必须还在");
  assert.equal(a.getAttribute("href"), "/cgi-bin/hgFeedback?topic=RefSeq", "链接地址不变");
  assert.equal(engine.stats.tpl, 1, "模板命中计数");
  dom.window.close();
});

test("hgTables 筛选说明：4 个占位符各就各位，<em> 按钮名保留", () => {
  const html =
    "<li><b>Filter: </b>Restricts the query to only those items that match certain criteria, " +
    "e.g. genes with a single exon. Click the <em>Create</em> button to add a filter, the " +
    "<em>Edit</em> button to modify an existing filter, or the <em>Clear</em> button to remove an " +
    "existing filter.</li>";
  const { engine, doc, dom } = boot(html);
  const li = doc.querySelector("li");
  assert.match(li.textContent, /把查询限定为仅匹配特定条件的条目/, "句子主体应变成中文");
  assert.match(li.textContent, /点击Create按钮可添加筛选器/, "占位符 {{2}} 放回原位");
  assert.doesNotMatch(li.textContent, /Restricts the query/, "英文原句不应残留");
  const ems = [...li.querySelectorAll("em")].map((e) => e.textContent);
  assert.deepEqual(ems, ["Create", "Edit", "Clear"], "三个按钮元素按原顺序保留");
  assert.equal(engine.stats.tpl, 1);
  dom.window.close();
});

test("首页海报段（7 个占位符）：<a>/<b> 全部保留且顺序不变", () => {
  const html =
    '<p>Our <a href="/goldenPath/posters/">Poster Gallery</a> collects more than ' +
    "<b>30 conference posters</b> we have presented since 2015, each a one page tour of a set of " +
    "features. Topics include <b>variant interpretation</b>, <b>track hub storage</b>, " +
    '<a href="/goldenPath/help/quickLift.html">quickLift</a>, <b>pangenome data</b>, and ' +
    "<b>transposable elements</b>, and every one is free to download.</p>";
  const { engine, doc, dom } = boot(html);
  const p = doc.querySelector("p");
  assert.match(p.textContent, /汇集了自 2015 年以来我们展示的/, "整段应换成中文");
  assert.doesNotMatch(p.textContent, /collects more than|one page tour/, "英文原句不应残留");
  assert.equal(p.querySelectorAll("a").length, 2, "两个链接都还在");
  assert.equal(p.querySelectorAll("b").length, 5, "五个加粗片段都还在");
  const links = [...p.querySelectorAll("a")].map((a) => a.getAttribute("href"));
  assert.deepEqual(links, ["/goldenPath/posters/", "/goldenPath/help/quickLift.html"], "链接顺序不变");
  assert.match(p.textContent, /变异解读/, "占位符内容仍按词表翻译");
  assert.equal(engine.stats.tpl, 1);
  dom.window.close();
});

test("exact：轨道说明页的设置项标签", () => {
  const { engine, doc, dom } = boot('<table><tr><td>Track height:</td><td>Type of graph:</td></tr></table>');
  const tds = [...doc.querySelectorAll("td")].map((e) => e.textContent);
  assert.deepEqual(tds, ["轨道高度：", "图形类型："], "两个标签都翻成中文");
  assert.equal(engine.stats.tpl, 0, "没走模板通道");
  dom.window.close();
});

test("rule：Track Settings 页面标题", () => {
  const { doc, dom } = boot("<h1>GENCODE V50 Track Settings</h1>");
  assert.equal(doc.querySelector("h1").textContent, "GENCODE V50 轨道设置");
  dom.window.close();
});

test("rule：容器引导句（轨道属于哪个 composite）", () => {
  const { doc, dom } = boot('<p>This track is part of the track container "NCBI RefSeq".</p>');
  assert.equal(doc.querySelector("p").textContent, "本轨道属于轨道容器“NCBI RefSeq”。");
  dom.window.close();
});

test("disable 能还原原文与子节点", () => {
  const { engine, doc, dom } = boot(FEEDBACK);
  assert.match(doc.querySelector("p").textContent, /请访问/);
  engine.disable();
  const p = doc.querySelector("p");
  assert.equal(
    p.textContent.trim(),
    "Please visit the Feedback for Gene and Reference Sequences (RefSeq) page to make suggestions, submit additions and corrections, or ask for help concerning RefSeq records.",
    "disable 后回到英文原文"
  );
  assert.ok(p.querySelector("a"), "还原后链接仍在");
  dom.window.close();
});

test("链接文字不同也能命中（占位符不含链接文字）", () => {
  const html = '<p>Please visit the <a href="/x">some page</a> page to make suggestions, submit additions and corrections, or ask for help concerning RefSeq records.</p>';
  const { engine, doc, dom } = boot(html);
  // 链接文字不同不影响到 pat（占位符不含链接文字），命中后链接原样放回
  assert.match(doc.querySelector("p").textContent, /请访问some page页面/);
  assert.equal(engine.stats.tpl, 1);
  dom.window.close();
});
