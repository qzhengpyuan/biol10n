import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const src = readFileSync(new URL("../src/engine.js", import.meta.url), "utf8");
const { createEngine } = new Function(src + "\nreturn { createEngine };")();

// cBioPortal 的 ^(.+): (.+)$ 命中 "Time: 09:15" 后，$2 里的时间冒号会被
// ^(.+):\\s*([\\d,]+)$ 一起换成全角，页面显示成「时间：09：15」。
const rules = [
  { re: "^(.+): (.+)$", to: "$1：$2", requireHit: true },
  { re: "^(.+):\\s*([\\d,]+)$", to: "$1：$2" }
];

function run(html) {
  const dom = new JSDOM("<body>" + html + "</body>", { url: "https://example.org/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: { "Time": "时间" }, rules },
    site: { attrs: [], block: "", proseGuard: true }
  });
  engine.start();
  return dom.window.document.body.textContent;
}

test("规则翻出来的时间保留半角冒号", () => {
  const out = run("<p>Time: 09:15</p>");
  assert.match(out, /时间：09:15/);
  assert.equal(out.includes("09：15"), false);
});

test("独立的时间文本不被规则改成全角", () => {
  const out = run("<p>09:15</p>");
  assert.match(out, /09:15/);
  assert.equal(out.includes("09：15"), false);
});
