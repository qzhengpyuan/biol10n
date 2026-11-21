import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();

const SITE = { scope: "", block: "pre, code", attrs: [], proseMax: 120 };

function boot(html, data) {
  const dom = new JSDOM(html, { url: "https://genome.ucsc.edu/goldenPath/help/hgTracksHelp.html" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: data.exact || {}, rules: [], templates: data.templates || [] },
    site: SITE
  });
  return { dom, engine, doc: dom.window.document };
}

const HTML = '<p>The full publication list is available <a href="/about/publications">here</a>.</p>';
const TPL = { pat: "The full publication list is available {{1}}.", zh: "完整出版物列表见{{1}}。" };

test("带链接的段落按模板整段替换，链接保留", () => {
  const { engine, doc, dom } = boot(HTML, { templates: [TPL], exact: { here: "此处" } });
  engine.start();
  const p = doc.querySelector("p");
  assert.match(p.textContent, /完整出版物列表见/, "段落应换成中文");
  const a = p.querySelector("a");
  assert.ok(a, "链接节点必须还在");
  assert.equal(a.getAttribute("href"), "/about/publications", "链接地址不变");
  assert.equal(engine.stats.tpl, 1, "模板命中计数");
  dom.window.close();
});

test("占位符对不上时不替换", () => {
  const bad = { pat: "The full publication list is available {{1}}.", zh: "完整出版物列表见此处。" };
  const { engine, doc, dom } = boot(HTML, { templates: [bad] });
  engine.start();
  assert.match(doc.querySelector("p").textContent, /publication list/, "占位符缺失应保持英文");
  assert.equal(engine.stats.tpl, 0);
  dom.window.close();
});

test("占位符顺序错乱（{{2}} 先出现）也不替换", () => {
  const t = { pat: "The full publication list is available {{1}}.", zh: "见{{2}}。" };
  const { engine, doc, dom } = boot(HTML, { templates: [t] });
  engine.start();
  assert.match(doc.querySelector("p").textContent, /publication list/);
  dom.window.close();
});

test("disable 能还原原文与子节点", () => {
  const { engine, doc, dom } = boot(HTML, { templates: [TPL], exact: { here: "此处" } });
  engine.start();
  assert.match(doc.querySelector("p").textContent, /完整出版物列表见/);
  engine.disable();
  const p = doc.querySelector("p");
  assert.equal(p.textContent, "The full publication list is available here.", "disable 后回到英文");
  assert.ok(p.querySelector("a"), "还原后链接仍在同位置");
  dom.window.close();
});

test("块内有嵌套块时不走模板", () => {
  const html = '<ul><li>Some text here <a href="/x">link</a><ul><li>nested</li></ul> tail text.</li></ul>';
  const t = { pat: "Some text here {{1}} tail text.", zh: "文字{{1}}结尾。" };
  const { engine, doc, dom } = boot(html, { templates: [t] });
  engine.start();
  assert.match(doc.querySelector("li").textContent, /Some text here/, "含嵌套块的 li 不处理");
  assert.equal(engine.stats.tpl, 0);
  dom.window.close();
});

test("没有 templates 数据时一切照旧", () => {
  const { engine, doc, dom } = boot(HTML, {});
  engine.start();
  assert.equal(engine.stats.tpl, 0);
  assert.match(doc.querySelector("p").textContent, /publication list/);
  dom.window.close();
});
test("code 槽位也能走模板（代码文本保持英文）", () => {
  const html = '<p>A track line begins with the word <code>track</code>, followed by one or more <code>attribute=value</code> pairs.</p>';
  const t = { pat: "A track line begins with the word {{1}}, followed by one or more {{2}} pairs.", zh: "轨道行以单词{{1}}开头，后面跟一个或多个{{2}}对。" };
  const { engine, doc, dom } = boot(html, { templates: [t] });
  engine.start();
  assert.match(doc.querySelector("p").textContent, /轨道行以单词track开头/, "code 槽位按占位符回填");
  assert.equal(doc.querySelectorAll("code").length, 2, "两个 code 节点都保留");
  dom.window.close();
});
test("链接里再套 <em> 也按模板替换，链接与 em 都保留", () => {
  const html = '<p>In addition to the data in the brain resource there is also data on <a href="/retina">the <em>human retina</em></a>.</p>';
  const t = { pat: "In addition to the data in the brain resource there is also data on {{1}}.", zh: "除脑资源中的数据外，还有{{1}}的数据。" };
  const { engine, doc, dom } = boot(html, { templates: [t] });
  engine.start();
  const p = doc.querySelector("p");
  assert.match(p.textContent, /除脑资源中的数据外/, "嵌套内联不应阻止模板替换");
  const a = p.querySelector("a");
  assert.ok(a && a.querySelector("em"), "链接与内部 em 都要保留");
  assert.equal(a.getAttribute("href"), "/retina");
  dom.window.close();
});

test("链接里藏块级元素时放弃替换", () => {
  const html = '<p>In addition there is also data on <a href="/x"><div>block</div></a>.</p>';
  const t = { pat: "In addition there is also data on {{1}}.", zh: "此外还有{{1}}。" };
  const { engine, doc, dom } = boot(html, { templates: [t] });
  engine.start();
  assert.match(doc.querySelector("p").textContent, /In addition/, "块级嵌套必须保持英文");
  assert.equal(engine.stats.tpl, 0);
  dom.window.close();
});

test("段落里夹注释节点不影响模板匹配", () => {
  const html = '<p>ClinVar reports <!-- faq --> <a href="/c/">stats</a> for submissions.</p>';
  const t = { pat: "ClinVar reports {{1}} for submissions.", zh: "ClinVar 报告{{1}}的提交。" };
  const { engine, doc, dom } = boot(html, { templates: [t] });
  engine.start();
  assert.match(doc.querySelector("p").textContent, /ClinVar 报告/, "注释节点应被忽略，模板照常命中");
  assert.ok(doc.querySelector("p a"), "链接保留");
  assert.equal(engine.stats.tpl, 1);
  dom.window.close();
});
