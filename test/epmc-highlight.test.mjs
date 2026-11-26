import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();

const sitesCfg = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8"));
const epmc = sitesCfg.sites.find((s) => s.id === "europepmc");
const bootSrc = fs.readFileSync(path.join(root, "../src/boot.js"), "utf8");
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/europepmc.json"), "utf8"));

// Europe PMC 关于页的侧栏「当前项」是 div.highlight（实测 /about 只有 1 个 .highlight，
// 检索页 0 个、文章页 0 个，站点不用它做检索词高亮）。全局 blocklist 里有 .highlight，
// 于是这条界面文案被整块跳过；给站点加 block 覆盖把它放出来。

test("默认 blocklist 仍拦 .highlight，其它站不受影响", () => {
  assert.ok(sitesCfg.defaults.block.includes(".highlight"));
  const pubmed = sitesCfg.sites.find((s) => s.id === "pubmed");
  assert.equal(pubmed.block, undefined, "只有 europepmc 该覆盖 block，别的站保持继承默认");
});

test("europepmc 的站点级 block 去掉了 .highlight，其余默认项都在", () => {
  assert.ok(epmc, "config/sites.json 里应有 europepmc 站点");
  assert.ok(typeof epmc.block === "string" && epmc.block.length > 0);
  assert.equal(epmc.block.includes(".highlight"), false);
  for (const sel of ["pre", "code", "kbd", "samp", "textarea", ".blob-code", ".code"]) {
    assert.ok(epmc.block.includes(sel), "站点覆盖不能把 " + sel + " 也弄丢");
  }
  assert.ok(epmc.block.includes("[contenteditable='true']"));
});

test("boot 会把 site.block 传给引擎（否则站点级覆盖是死配置）", () => {
  assert.match(bootSrc, /block: site\.block \|\| \(SITES\.defaults && SITES\.defaults\.block\) \|\| ""/);
});

const SITE_BASE = {
  scope: "body",
  attrs: [],
  proseGuard: true,
  proseMax: 120,
  proseExempt: ""
};

function boot(html, block) {
  const dom = new JSDOM(html, { url: "https://europepmc.org/about" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: dict.exact || {}, rules: dict.rules || [] },
    site: { ...SITE_BASE, block }
  });
  engine.scan();
  return dom.window.document;
}

const HTML =
  '<body><div class="sidebar"><div class="highlight"><a href="/about">' +
  "What is Europe PMC?</a></div></div></body>";

test("用默认 blocklist 时侧栏当前项保持英文（复现旧行为）", () => {
  const doc = boot(HTML, sitesCfg.defaults.block);
  assert.equal(doc.querySelector(".highlight").textContent.trim(), "What is Europe PMC?");
});

test("用站点覆盖后侧栏当前项翻成中文", () => {
  const doc = boot(HTML, epmc.block);
  assert.equal(doc.querySelector(".highlight").textContent.trim(), "什么是 Europe PMC？");
});

test("覆盖后 code / pre 仍然跳过，别顺手把代码块放开", () => {
  const doc = boot("<body><pre>Hello world</pre><code>Hello</code></body>", epmc.block);
  assert.equal(doc.querySelector("pre").textContent, "Hello world");
  assert.equal(doc.querySelector("code").textContent, "Hello");
});

test("词库里这条 must 存在（否则放开 .highlight 也翻不出来）", () => {
  assert.equal(dict.exact["What is Europe PMC?"], "什么是 Europe PMC？");
});
