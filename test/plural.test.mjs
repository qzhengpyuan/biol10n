import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const src = readFileSync(new URL("../src/engine.js", import.meta.url), "utf8");
const { createEngine } = new Function(src + "\nreturn { createEngine };")();

function run(exact, html) {
  const dom = new JSDOM("<body>" + html + "</body>", { url: "https://www.proteinatlas.org/x" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact, rules: [] },
    site: { attrs: [], block: "" }
  });
  engine.start();
  return dom.window.document.body.textContent.trim();
}

test("复数形式能退化到单数条目", () => {
  assert.equal(run({ "Vascular endothelial cell": "血管内皮细胞" }, "<p>Vascular endothelial cells</p>"), "血管内皮细胞");
  assert.equal(run({ Capillary: "毛细血管" }, "<p>Capillaries</p>"), "毛细血管");
});

test("复数退化只在命中时才生效，不误伤", () => {
  assert.equal(run({ Yes: "是" }, "<p>Yes</p>"), "是");
  assert.equal(run({}, "<p>Status</p>"), "Status");
});
