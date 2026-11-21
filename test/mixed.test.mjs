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

// 回归：cBio 饼图图例带计数与百分比（Mixed Histology (NOS):30 (2.8%)），
// 规则要保留尾部数据并把括号/冒号统一成全角，且不能出现括号错配。
test("NOS 图例带百分比时括号闭合且全角", () => {
  const rules = [
    { re: "^(.+?) \\(NOS\\):(\\d+) \\(([<\\d.]+)%\\)$", to: "$1（非特指）：$2（$3%）", mixed: true },
    { re: "^(.+?) \\(NOS\\):(\\d+)(.*)$", to: "$1（非特指）：$2$3", mixed: true }
  ];
  const { doc } = boot(
    "<p id=a>Mixed Histology (NOS):30 (2.8%)</p><p id=b>Infiltrating Carcinoma (NOS):1 (<0.1%)</p>",
    { exact: { "Mixed Histology": "混合组织学", "Infiltrating Carcinoma": "浸润性癌" }, rules }
  );
  assert.equal(doc.getElementById("a").textContent, "混合组织学（非特指）：30（2.8%）");
  assert.equal(doc.getElementById("b").textContent, "浸润性癌（非特指）：1（<0.1%）");
});


// 回归：真实页面里 tspan 曾被先翻成「（非特指：30 (2.8%）」（括号错配、半角混排），
// mixed 通道要多轮修复：先补冒号，再把末尾 (2.8%） 统一成全角。
test("mixed 通道多轮修复被翻坏的图例括号", () => {
  const rules = [
    { re: "^(.+?)（非特指：(\\d.*)$", to: "$1（非特指）：$2", mixed: true },
    { re: "^(.+?)\\s*\\(([<\\d.]+)%[)）]$", to: "$1（$2%）", mixed: true }
  ];
  const { doc } = boot(
    "<p id=a>混合组织学（非特指：30 (2.8%）</p><p id=b>浸润性癌（非特指：1 (<0.1%）</p>",
    { exact: {}, rules }
  );
  assert.equal(doc.getElementById("a").textContent, "混合组织学（非特指）：30（2.8%）");
  assert.equal(doc.getElementById("b").textContent, "浸润性癌（非特指）：1（<0.1%）");
});

