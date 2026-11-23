// r24 P0-1：箭头在中间时 head/tail 都是空串、core === s，同 depth 递归会无限自调用。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();

function boot(exact = {}, rules = []) {
  const dom = new JSDOM("<p>hi</p>", { url: "https://example.org/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact, rules },
    site: { scope: "", block: "pre, code", attrs: [], rescan: [] }
  });
  engine.start();
  return engine;
}

test("箭头在中间不自递归爆栈：原样返回 null", () => {
  const engine = boot({}, []);
  assert.equal(engine.translateText("cancer \u2192 Tumours"), null);
  assert.equal(engine.translateText("IRGRERFEMF \u2192 DQTSFQKENC"), null);
});

test("首尾箭头剥离后仍能命中词表", () => {
  const engine = boot({ "or browse all datasets": "或浏览全部数据集" }, []);
  assert.equal(engine.translateText("or browse all datasets \u2192"), "或浏览全部数据集 \u2192");
  assert.equal(engine.translateText("\u2192 PageTab"), null);
});

test("词表里带箭头的整条优先命中", () => {
  const engine = boot({ "or browse all datasets \u2192": "或浏览全部数据集 \u2192" }, []);
  assert.equal(engine.translateText("or browse all datasets \u2192"), "或浏览全部数据集 \u2192");
});
