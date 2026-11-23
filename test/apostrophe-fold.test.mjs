// 弯/直撇号与引号归一：词库写 you’ve，站点 DOM 里是 you've（r30 P1-2）。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();

function boot(html, data) {
  const dom = new JSDOM(html, { url: "https://www.ncbi.nlm.nih.gov/clinvar/variation/12881/" });
  const engine = createEngine({
    document: dom.window.document, window: dom.window,
    data: { exact: data.exact || {}, rules: [], templates: [] },
    site: { scope: "body", block: "pre, code" }
  });
  engine.start();
  return { doc: dom.window.document, dom };
}

test("词库用弯撇号、DOM 用直撇号也能命中", () => {
  const { doc, dom } = boot('<p id="p">A lock means you\'ve safely connected</p>', {
    exact: { "A lock means you\u2019ve safely connected": "锁形图标表示您已安全连接" }
  });
  assert.equal(doc.getElementById("p").textContent, "锁形图标表示您已安全连接");
  dom.window.close();
});

test("词库用直撇号、DOM 用弯撇号也能命中", () => {
  const { doc, dom } = boot('<p id="p">A lock means you\u2019ve safely connected</p>', {
    exact: { "A lock means you've safely connected": "锁形图标表示您已安全连接" }
  });
  assert.equal(doc.getElementById("p").textContent, "锁形图标表示您已安全连接");
  dom.window.close();
});

test("弯引号与直引号同样互通", () => {
  const { doc, dom } = boot('<p id="p">Switch ON mode \u201cshow All\u201d for Gene tracks</p>', {
    exact: { 'Switch ON mode "show All" for Gene tracks': "为基因轨道开启「显示全部」模式" }
  });
  assert.match(doc.getElementById("p").textContent, /基因轨道/);
  dom.window.close();
});
