import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();

function boot(html, { exact = {}, rules = [], site = {} } = {}) {
  const dom = new JSDOM(html, { url: "https://example.org/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact, rules },
    site: { scope: "", block: "pre, code", attrs: [], ...site }
  });
  engine.scan();
  return { engine, doc: dom.window.document };
}

// 回归：PubMed 检索结果标题被高亮 <b> 切碎后曾出现「…Breast Cancer 治疗」。
// 站点 skip 里写了 .docsum-title 就必须整条不动。
test("site skip 里的检索结果标题整条保持英文", () => {
  const html =
    '<a class="docsum-title" href="/1">Molecular Targets for <b>Breast</b> <b>Cancer</b> Treatment</a>' +
    '<a class="docsum-title" href="/2"><b>Male</b> Breast Cancer: a Review</a>';
  const { doc } = boot(html, {
    exact: { Treatment: "处理组", Male: "男性", "Breast Cancer": "乳腺癌" },
    site: { skip: ".docsum-title" }
  });
  const links = doc.querySelectorAll("a.docsum-title");
  assert.match(links[0].textContent, /Treatment/);
  assert.match(links[1].textContent, /Male/);
});

// 回归：cBio 研究摘要页 h3 的数据集名（.headBlock > div[class*=summary] > h3）必须留英文
test("cBio 摘要页数据集名不被翻译", () => {
  const html =
    '<div class="headBlock"><div class="styles-module__summary__x1"><h3>Breast Invasive Carcinoma (TCGA, PanCancer Atlas)</h3></div></div>';
  const { doc } = boot(html, {
    exact: { Breast: "乳腺", "Breast Invasive Carcinoma": "乳腺浸润性癌", "PanCancer Atlas": "泛癌图谱" },
    site: { skip: ".headBlock, [class*=summary] h3" }
  });
  assert.equal(doc.querySelector("h3").textContent, "Breast Invasive Carcinoma (TCGA, PanCancer Atlas)");
});

// 回归：GTEx 细胞类型「上皮细胞（ALVEOLAR TYPE I）」不得半中半英。
// 括号规则要求所有带字母的捕获组都命中，$2 没命中时整条放弃。
test("括号规则在括号内未命中时整条放弃", () => {
  const rules = [{ re: "^(.+?)\\s*\\((.+)\\)$", to: "$1（$2）", requireHit: true }];
  const { doc } = boot("<div><span>Epithelial cell (ALVEOLAR TYPE I)</span></div>", {
    exact: { "Epithelial cell": "上皮细胞" },
    rules
  });
  assert.equal(doc.querySelector("span").textContent, "Epithelial cell (ALVEOLAR TYPE I)");
});

test("括号规则两侧都命中时正常替换", () => {
  const rules = [{ re: "^(.+?)\\s*\\((.+)\\)$", to: "$1（$2）", requireHit: true }];
  const { doc } = boot("<div><span>Epithelial cell (Basal keratinocyte)</span></div>", {
    exact: { "Epithelial cell": "上皮细胞", "Basal keratinocyte": "基底角质细胞" },
    rules
  });
  assert.equal(doc.querySelector("span").textContent, "上皮细胞（基底角质细胞）");
});

test("data-biol10n-skip 子树保持英文（文本与属性都不动）", () => {
  const html =
    '<div data-biol10n-skip><h3>Breast Invasive Carcinoma</h3><a aria-label="Open study page" href="/s">Study</a></div>' +
    '<p><span>Save</span></p>';
  const { doc } = boot(html, { exact: { "Breast Invasive Carcinoma": "乳腺浸润性癌", Study: "研究", Save: "保存", "Open study page": "打开研究页面" }, site: {} });
  assert.equal(doc.querySelector("h3").textContent, "Breast Invasive Carcinoma");
  assert.equal(doc.querySelector("a").getAttribute("aria-label"), "Open study page");
  assert.equal(doc.querySelector("p span").textContent, "保存");
});


// 回归：GDV 页面用模板拼出「Showing GCF_… instead of undefined」，
// 捕获组里出现 undefined 时整条规则放弃，保持英文，不产出「…而非 undefined」。
test("站点模板残句里的 undefined 让规则整条放弃", () => {
  const rules = [{ re: "^Showing (.+) instead of (.+)$", to: "显示 $1 而非 $2", requireHit: true }];
  const { doc } = boot("<div><span>Showing GCF_000001405.40 instead of undefined</span></div>", {
    exact: { Showing: "显示" },
    rules
  });
  assert.equal(doc.querySelector("span").textContent, "Showing GCF_000001405.40 instead of undefined");
});

