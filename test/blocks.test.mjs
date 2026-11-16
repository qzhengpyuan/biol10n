import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";

const root = path.dirname(new URL(import.meta.url).pathname);
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();

test("整块替换在 disable 后还原原文", () => {
  const dom = new JSDOM('<div id="help"><p>Original <a href="/x">link</a> text.</p></div>', { url: "https://example.org/" });
  const doc = dom.window.document;
  const before = doc.querySelector("#help p").innerHTML;
  const engine = createEngine({
    document: doc,
    window: dom.window,
    data: { exact: {}, rules: [] },
    site: { scope: "", block: "pre, code", attrs: [], blocks: [{ sel: "#help p", text: "替换后的整段话" }] }
  });
  engine.scan();
  assert.equal(doc.querySelector("#help p").textContent, "替换后的整段话");
  assert.ok(doc.querySelector("#help p").hasAttribute("data-biol10n-block"));
  engine.disable();
  assert.equal(doc.querySelector("#help p").textContent, "Original link text.");
  assert.equal(doc.querySelector("#help p").innerHTML, before);
  assert.equal(doc.querySelector("#help p").hasAttribute("data-biol10n-block"), false);
});

test("重复 scan 不会把已替换的块当成原文存下来", () => {
  const dom = new JSDOM('<div id="b"><p>Hello world</p></div>', { url: "https://example.org/" });
  const doc = dom.window.document;
  const engine = createEngine({
    document: doc,
    window: dom.window,
    data: { exact: {}, rules: [] },
    site: { scope: "", block: "pre", attrs: [], blocks: [{ sel: "#b p", text: "中文" }] }
  });
  engine.scan();
  engine.scan();
  assert.equal(doc.querySelector("#b p").textContent, "中文");
  engine.disable();
  assert.equal(doc.querySelector("#b p").textContent, "Hello world");
});
