import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const src = readFileSync(new URL("../src/engine.js", import.meta.url), "utf8");
const { createEngine } = new Function(src + "\nreturn { createEngine };")();

function run(html, site = {}) {
  const dom = new JSDOM("<body>" + html + "</body>", { url: "https://genome.ucsc.edu/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: { "Contact Us": "联系我们", "More news": "更多新闻", "Cite": "引用", "Filters": "筛选" }, rules: [] },
    site: Object.assign({ attrs: [], block: "" }, site)
  });
  engine.start();
  return dom.window.document.body.textContent;
}

test("长段落里的零散单词不翻，避免中英混排", () => {
  const prose = "This page contains responses to frequently asked questions about the browser. ".repeat(4) +
    "<a>Contact Us</a>";
  const out = run("<p>" + prose + "</p>");
  assert.match(out, /Contact Us/);
  assert.doesNotMatch(out, /联系我们/);
});

test("短句/按钮仍然翻", () => {
  assert.match(run("<p>Contact Us</p>"), /联系我们/);
  assert.match(run("<a>More news</a>"), /更多新闻/);
});

test("结果条目的外壳不算段落：按钮与徽标照翻", () => {
  const prose = "This is a long abstract body about BRCA1 and its role in DNA repair. ".repeat(20);
  const html = "<article class=result>" + prose +
    "<button>Cite</button><span>PMID:</span><label>Filters</label></article>";
  const out = run(html);
  assert.match(out, /引用|Cite/);
  assert.match(out, /筛选/);
});

test("可以按站点关掉长正文保护", () => {
  const prose = "x ".repeat(300) + "<a>Contact Us</a>";
  assert.match(run("<p>" + prose + "</p>", { proseGuard: false }), /联系我们/);
});

test("<br> 拼接查不到时不吞掉后半段（Total<br>elevated）", () => {
  const dom = new JSDOM("<body><h3>Total<br>elevated</h3></body>", { url: "https://example.org/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: { elevated: "升高" }, rules: [] },
    site: { attrs: [], block: "", proseGuard: true }
  });
  engine.start();
  assert.match(dom.window.document.querySelector("h3").textContent, /升高/);
});

test("表格单元格里的短标签翻，单元格里的长句仍被正文保护", () => {
  const prose = "This page contains responses to frequently asked questions about the browser. ".repeat(4);
  const html = "<table><tr><td>" + prose + "</td><td>DNA sequence</td></tr></table>";
  const dom = new JSDOM("<body>" + html + "</body>", { url: "https://example.org/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: { "DNA sequence": "DNA 序列" }, rules: [] },
    site: { attrs: [], block: "", proseGuard: true }
  });
  engine.start();
  const tds = [...dom.window.document.querySelectorAll("td")].map((t) => t.textContent);
  assert.equal(tds[1], "DNA 序列");
  assert.match(tds[0], /frequently asked questions/);
});
