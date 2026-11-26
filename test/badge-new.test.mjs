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

// 「new」在页面上有两种身份：
//   ① 结果/数据条目的徽章（CELLxGENE、cBioPortal、PubMed、GDC 的 miss 清单里都有），意思是「新增」；
//   ② UCSC track 配置菜单里的 `new` 按钮，意思是「新建」。
// 不能把它写成 common 的 exact：引擎有小写兜底索引（lowerIndex），common 里的小写键会被页面上的
// Title-case `New` 命中，抢在 Ensembl 站内规则 `^New$ → 新建` 之前，把页签翻成「新增」。
// 现在的做法是 common 只放一条**大小写敏感**的规则 `^new$`（只命中全小写的徽章文本），
// UCSC 继续用自己册里的 exact（exact 优先级高于规则）。

test("common 用规则而不是 exact 处理小写 new 徽章", () => {
  assert.equal(common.exact.new, undefined, "不能进 exact，否则小写兜底会波及 Title-case");
  const rule = (common.rules || []).find((r) => r.re === "^new$");
  assert.ok(rule, "common 里应有 ^new$ 规则");
  assert.equal(rule.to, "新增");
});

test("ucsc 保留自己的 new→新建（exact 优先于规则）", () => {
  assert.equal(ucsc.exact.new, "新建");
});

test("没有任何册在 exact 里定义小写 new（否则跨册冲突会涨）", () => {
  const dir = path.join(root, "../dict");
  const owners = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    if (d.exact && Object.prototype.hasOwnProperty.call(d.exact, "new")) owners.push(f);
  }
  assert.deepEqual(owners, ["ucsc.json"]);
});

const SITE = { scope: "body", block: "pre, code", attrs: [] };

function boot(html, data, url) {
  const dom = new JSDOM(html, { url: url || "https://cellxgene.cziscience.com/datasets" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site: SITE });
  engine.scan();
  return dom.window.document;
}

const BADGE_HTML = '<body><div class="dataset"><a href="/d/1">Kras mutant</a><span class="badge">new</span></div></body>';

test("徽章节点 new 翻成新增（CELLxGENE / cBioPortal 场景）", () => {
  const doc = boot(BADGE_HTML, { exact: common.exact, rules: common.rules, templates: [] });
  assert.equal(doc.querySelector(".badge").textContent, "新增");
  assert.equal(doc.querySelector("a").textContent, "Kras mutant", "数据集名不在翻译面内");
});

test("Title-case New 不被 ^new$ 规则命中（Ensembl 页签仍走自己的规则）", () => {
  const data = { exact: common.exact, rules: [...common.rules, { re: "^New$", to: "新建" }], templates: [] };
  const doc = boot("<body><p><span id=a>New</span><span id=b>new</span></p></body>", data, "https://www.ensembl.org/");
  assert.equal(doc.getElementById("a").textContent, "新建");
  assert.equal(doc.getElementById("b").textContent, "新增");
});

test("ucsc 站点栈里 new 命中自己册的 exact → 新建", () => {
  const data = { exact: { ...common.exact, ...ucsc.exact }, rules: [...common.rules, ...(ucsc.rules || [])], templates: [] };
  const doc = boot("<body><div class=\"trackMenu\"><button>new</button></div></body>", data, "https://genome.ucsc.edu/");
  assert.equal(doc.querySelector("button").textContent, "新建");
});

test("代码块里的 new 不动（block 生效）", () => {
  const doc = boot("<body><pre>new</pre><code>new</code></body>", { exact: common.exact, rules: common.rules, templates: [] });
  assert.equal(doc.querySelector("pre").textContent, "new");
  assert.equal(doc.querySelector("code").textContent, "new");
});
