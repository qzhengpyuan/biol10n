import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();

function boot(html, data, site = {}) {
  const dom = new JSDOM(html, { url: "https://example.org/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data,
    site: { scope: "", block: "pre, code", attrs: [], ...site }
  });
  engine.start();
  return { engine, doc: dom.window.document };
}

// 半翻节点「乳腺浸润性癌（NOS）」含中文，主通道整条跳过；
// 只有词库里标了 mixed:true 的规则可以改它（cBio 的 NOS）。
test("mixed 规则能修半翻的中文（英文缩写）节点", () => {
  const rules = [
    { re: "^(.+?) \\(NOS\\):(\\d+)$", to: "$1（非特指）：$2", mixed: true },
    { re: "^(.+?)（NOS）(.*)$", to: "$1（非特指）$2", mixed: true }
  ];
  const { engine, doc } = boot(
    "<p id=a>乳腺浸润性癌（NOS）</p><p id=b>Mixed Histology (NOS):30</p>",
    { exact: { "Mixed Histology": "混合组织学" }, rules }
  );
  assert.equal(doc.getElementById("a").textContent, "乳腺浸润性癌（非特指）");
  assert.equal(doc.getElementById("b").textContent, "混合组织学（非特指）：30");
  assert.equal(engine.stats.mixed, 1); // 纯英文那条走普通通道，只有半翻那条计 mixed
});

test("mixed 规则不会碰纯中文节点", () => {
  const rules = [{ re: "^(.+?)（NOS）(.*)$", to: "$1（非特指）$2", mixed: true }];
  const { doc } = boot("<p id=a>乳腺浸润性癌</p>", { exact: {}, rules });
  assert.equal(doc.getElementById("a").textContent, "乳腺浸润性癌");
});
