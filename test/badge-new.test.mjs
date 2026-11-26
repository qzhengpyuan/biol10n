import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();

const common = JSON.parse(fs.readFileSync(path.join(root, "../dict/common.json"), "utf8"));
const ucsc = JSON.parse(fs.readFileSync(path.join(root, "../dict/ucsc.json"), "utf8"));

// 「new」在页面上的两种身份：
//   ① 结果/数据条目的徽章（CELLxGENE、cBioPortal、PubMed 的 miss 清单里都有），意思是「新增」；
//   ② UCSC track 配置菜单里的 `new` 按钮，意思是「新建」。
// 旧版把它只写在 dict/ucsc.json 里，而引擎有小写兜底索引（lowerIndex），
// 于是 ① 在别的站也会命中 ucsc 的「新建」——徽章变成动词。现在把通用义放进 common，
// 站点特有的「新建」留给 ucsc 自己按选择器 scopedExact 处理（当前该按钮没有单独词条）。

test("common 里 new 译作「新增」", () => {
  assert.equal(common.exact.new, "新增");
});

test("ucsc 不再私藏 new（否则小写兜底会把徽章翻成「新建」）", () => {
  assert.equal(ucsc.exact.new, undefined);
});

test("没有别的册再定义小写 new，跨册冲突不会涨", () => {
  const dir = path.join(root, "../dict");
  const owners = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    if (d.exact && Object.prototype.hasOwnProperty.call(d.exact, "new")) owners.push(f);
  }
  assert.deepEqual(owners, ["common.json"]);
});

const SITE = { scope: "body", block: "pre, code", attrs: [] };

function boot(html, data) {
  const dom = new JSDOM(html, { url: "https://cellxgene.cziscience.com/datasets" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site: SITE });
  engine.scan();
  return dom.window.document;
}

test("独立徽章节点 new 翻成新增（CELLxGENE / cBioPortal 场景）", () => {
  const doc = boot('<body><div class="dataset"><a href="/d/1">Kras mutant</a><span class="badge">new</span></div></body>', {
    exact: common.exact,
    rules: [],
    templates: []
  });
  assert.equal(doc.querySelector(".badge").textContent, "新增");
  assert.equal(doc.querySelector("a").textContent, "Kras mutant", "数据集名不在翻译面内");
});

test("大写 New 仍是新增，二者一致", () => {
  const doc = boot("<body><p><span>New</span></p></body>", { exact: { ...common.exact, New: "新增" }, rules: [], templates: [] });
  assert.equal(doc.querySelector("span").textContent, "新增");
});

test("代码块里的 new 不动（block 生效）", () => {
  const doc = boot("<body><pre>new</pre><code>new</code></body>", { exact: common.exact, rules: [], templates: [] });
  assert.equal(doc.querySelector("pre").textContent, "new");
  assert.equal(doc.querySelector("code").textContent, "new");
});
