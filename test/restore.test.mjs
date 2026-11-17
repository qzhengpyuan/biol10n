import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";

const root = path.dirname(new URL(import.meta.url).pathname);
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();

function boot(html, site = {}) {
  const dom = new JSDOM(html, { url: "https://example.org/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: { "Brain": "脑", "Cases (in thousands)": "病例数（千例）" }, rules: [] },
    site: { scope: "", block: "pre, code", attrs: [], ...site }
  });
  engine.scan();
  return { engine, doc: dom.window.document };
}

test("SVG 文字关闭后逐节点还原", () => {
  const html = '<svg><g><text><tspan>Cases (in thousands)</tspan></text>' +
    '<text><tspan>Brain</tspan></text></g></svg>';
  const { engine, doc } = boot(html);
  const texts = [...doc.querySelectorAll("text")].map(t => t.textContent);
  assert.ok(texts.includes("病例数（千例）") && texts.includes("脑"), texts.join("|"));
  engine.disable();
  const back = [...doc.querySelectorAll("text")].map(t => t.textContent);
  assert.deepEqual(back, ["Cases (in thousands)", "Brain"]);
});

test("整块替换里的 <b> 在关闭后跟着还原", () => {
  const html = '<div id="x"><p><b>Warning</b>: data is provisional.</p></div>';
  const { engine, doc } = boot(html, { blocks: [{ sel: "#x p", text: "警告：数据为临时性数据。" }] });
  assert.equal(doc.querySelector("#x p").textContent, "警告：数据为临时性数据。");
  assert.equal(doc.querySelector("#x p b"), null);
  engine.disable();
  assert.equal(doc.querySelector("#x p b").textContent, "Warning");
  assert.equal(doc.querySelector("#x p").textContent, "Warning: data is provisional.");
});

test("整块替换与普通词条混排时逐个还原", () => {
  const html = '<div id="c"><p>English sentence.</p><p>Brain</p></div>';
  const { engine, doc } = boot(html, { blocks: [{ sel: "#c p:first-child", text: "中文句子。" }] });
  assert.equal(doc.querySelectorAll("#c p")[0].textContent, "中文句子。");
  assert.equal(doc.querySelectorAll("#c p")[1].textContent, "脑");
  engine.disable();
  assert.equal(doc.querySelectorAll("#c p")[0].textContent, "English sentence.");
  assert.equal(doc.querySelectorAll("#c p")[1].textContent, "Brain");
});
