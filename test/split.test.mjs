import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";

const root = path.dirname(new URL(import.meta.url).pathname);
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();

function boot(html, exact = { "Horizontal Axis": "横轴", "Vertical Axis": "纵轴" }, site = {}) {
  const dom = new JSDOM(html, { url: "https://www.cbioportal.org/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact, rules: [] },
    site: { scope: "", block: "pre, code", attrs: [], ...site }
  });
  engine.scan();
  return { engine, doc: dom.window.document };
}

test("被拆成两个文本节点的标签能整串命中", () => {
  const { doc } = boot('<h4 class="tab-title">Horizontal\nAxis</h4>');
  assert.equal(doc.querySelector("h4").textContent, "横轴");
});

test("关闭后恢复成原来的两个文本节点", () => {
  const { engine, doc } = boot('<h4 class="tab-title">Vertical\nAxis</h4>');
  assert.equal(doc.querySelector("h4").textContent, "纵轴");
  engine.disable();
  assert.equal(doc.querySelector("h4").textContent, "Vertical\nAxis");
});

test("脚注被拆成「¹ 」+ 长句两段，整条命中词表时也能拼合", () => {
  const s = "¹ Structural variants are shown instead of copy number alterations when a sample has both.";
  const dom = new JSDOM("<div></div>", { url: "https://www.cbioportal.org/" });
  const div = dom.window.document.querySelector("div");
  div.appendChild(dom.window.document.createTextNode("¹ "));
  div.appendChild(dom.window.document.createTextNode(s.slice(2)));
  const engine = createEngine({
    document: dom.window.document, window: dom.window,
    data: { exact: { [s]: "¹ 当样本同时具有结构变异与拷贝数改变时，显示结构变异。" }, rules: [] },
    site: { scope: "", block: "pre, code", attrs: [] }
  });
  engine.scan();
  assert.equal(div.textContent, "¹ 当样本同时具有结构变异与拷贝数改变时，显示结构变异。");
  engine.disable();
  assert.equal(div.textContent, "¹ " + s.slice(2));
});

test("带子元素的容器不走这条路径（保留 <input>）", () => {
  const html = '<div>Interacting gene<br><input type="text"></div>';
  const { doc } = boot(html, { "Interacting gene": "相互作用基因" });
  assert.equal(doc.querySelector("input") !== null, true);
});

test('translate="no" 里的拆分子句仍然不翻', () => {
  const html = '<div translate="no"><span>Horizontal\nAxis</span></div>';
  const { doc } = boot(html);
  assert.equal(doc.querySelector("span").textContent, "Horizontal\nAxis");
});

test("子元素全是内联标签时也拼成一串（UALCAN 校名被 <font> 切段）", () => {
  const html = '<div id="u"><font>University</font> of <font>Alabama</font> at <font>Birmingham</font></div>';
  const { doc } = boot(html, { "University of Alabama at Birmingham": "阿拉巴马大学伯明翰分校" });
  assert.equal(doc.querySelector("#u").textContent, "阿拉巴马大学伯明翰分校");
});

test("含 <a> 的容器不拍平，链接保留", () => {
  const html = '<div id="l"><a href="/x">Protein</a> Atlas Info</div>';
  const { doc } = boot(html, { "Protein Atlas Info": "蛋白质图谱信息" });
  assert.equal(doc.querySelector("#l a") !== null, true);
  assert.equal(doc.querySelector("#l a").textContent, "Protein");
});

