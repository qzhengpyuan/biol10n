// r40：handleSplitText 的规则通道上限由 60 提到 120（r31 T2）
// 覆盖：被 <b>/<a>/<span> 切碎、拼平后 61–120 字符的整句能走规则；
// 拼平后不命中规则的同类长句仍整句留英文（不半中半英）。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();

const data = {
  exact: { "Found an exact match:": "找到精确匹配：" },
  rules: [
    { re: "^Found an exact gene match for (.+) in the following key species:$", to: "在以下关键物种中找到与 $1 精确匹配的基因：" },
    { re: "^Showing (\\d+) of ([\\d,]+) results$", to: "显示第 $1 条，共 $2 条结果" }
  ],
  templates: []
};

function boot(html) {
  const dom = new JSDOM(html, { url: "https://www.ebi.ac.uk/interpro/search/text/p53/" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site: { id: "t", dicts: [] } });
  engine.start();
  return { doc: dom.window.document, engine };
}

test("拼平后 63 字符、被 <b> 切开的整句走规则通道", () => {
  const { doc } = boot('<div><span>Found an exact gene match for <b>P53</b> in the following key species:</span></div>');
  const span = doc.querySelector("span");
  assert.equal(span.textContent, "在以下关键物种中找到与 P53 精确匹配的基因：");
  assert.equal(span.querySelectorAll("b").length, 0, "规则通道会把整块拍平成文本，槽位不再保留");
});

test("拼平后 61–120 字符、不命中规则的句子仍整句留英文", () => {
  const en = "Submitters should first log in through their account and then use the submission portal to upload the data files for review.";
  const { doc } = boot("<div><span>" + en.replace("submission portal", "<b>submission portal</b>") + "</span></div>");
  assert.equal(doc.querySelector("span").textContent, en, "未登记的长句不该被规则拼出半中半英");
});

test("超过 120 字符的拼平文本仍整句不译（长度闸不变）", () => {
  const long = "A".repeat(80) + " and " + "B".repeat(60) + " results";
  const { doc } = boot("<div><span>" + long + "</span></div>");
  assert.equal(doc.querySelector("span").textContent, long);
});

test("短句规则（Showing N of M）不受影响", () => {
  // 被拆开的是同一个元素的直接子节点（<span> 包起来的单节点走不到 handleSplitText）
  const { doc } = boot("<div><p>Showing <b>1</b> of <b>20</b> results</p></div>");
  const p = doc.querySelector("p");
  assert.match(p.textContent, /显示第 1 条，共 20 条结果/);
});
