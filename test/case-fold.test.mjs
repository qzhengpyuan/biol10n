// 大小写兜底不能把全大写缩写套到正文小写词上（STRING 的 "does not have" 曾被翻成 "does 非 have"）。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();

const DATA = {
  exact: { NOT: "非", AND: "且", OR: "或", Search: "检索" },
  rules: [], templates: []
};
const SITE = { scope: "body", block: "pre, code", rescan: false };

function boot(text) {
  const dom = new JSDOM('<div id="box"><p id="p">' + text + "</p></div>", { url: "https://string-db.org/network/9606.ENSP1" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data: DATA, site: SITE });
  engine.start();
  return { doc: dom.window.document, engine };
}

test("正文里的小写 not/and/or 不被大写缩写词条套用", () => {
  for (const w of ["not", "and", "or"]) {
    const { doc } = boot("your network does " + w + " have significantly more interactions");
    assert.match(doc.getElementById("p").textContent, new RegExp("does " + w + " have"), w + " 被误翻");
  }
});

test("大写界面标签照常精确命中", () => {
  const { doc } = boot("NOT");
  assert.equal(doc.getElementById("p").textContent, "非");
});

test("普通大小写兜底仍生效（Search / search）", () => {
  const { doc } = boot("search");
  assert.equal(doc.getElementById("p").textContent, "检索");
});
