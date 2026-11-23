// r28：PubChem 属性文案补漏（r26 点名 4 条 + 同区块的 Evidence / 分类浏览器节点属性，共 20 条）
// 与「逐词切分过译」的证据与修法验证。
//
// 过译证据（2026-11-23 实测，https://pubchem.ncbi.nlm.nih.gov/compound/2244 第 10.6 节）：
// 站点把引文渲染成「一个单词一个文本节点、单词之间一个纯空白文本节点」的多节点结构
// （div.text-gray-700 …… .pc-word-break 的 childNodes 共 64 个：US / 空格 / EPA; / 空格 / …），
// 引擎按节点查表，于是 "Volume"（ncbi 册）/ "Submitted" / "Update"（common 册）这类全线通用短词
// 被逐词翻掉，整句变成 "US EPA; Non-confidential Production 卷 Information 已提交 by Companies …"。
// 修法：inLongProse() 里 ctx 取的是外层块容器（inlineRoot(el)）；对「直接躺在块容器里的文本节点」
// 来说 prev/next 兄弟都在块外，永远取不到 "Production" / "Information"，于是被判成「不是正文」放行。
// 把 ctx 改成 inlineRoot(node)、调用点改传节点本身（三行补丁）即可；本用例把补丁在内存里打到
// engine 源码副本上验证，不改 src/engine.js。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, "../dict", f), "utf8"));
const book = read("pubchem-dbgap.json");
const common = read("common.json");
const ncbi = read("ncbi.json");
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = Object.assign(
  { id: "pubchem", scope: "body", dicts: ["common", "ncbi", "pubchem-dbgap"] },
  sites.find((s) => s.id === "pubchem") || {}
);

function siteData() {
  const exact = {}, rules = [], templates = [];
  for (const id of site.dicts) {
    const p = path.join(root, "../dict", id + ".json");
    if (!fs.existsSync(p)) continue;
    const b = JSON.parse(fs.readFileSync(p, "utf8"));
    Object.assign(exact, b.exact || {});
    rules.push(...(b.rules || []));
    templates.push(...(b.templates || []));
  }
  return { exact, rules, templates };
}

/** 用给定 engine 源码起一个页面；prepare(doc) 在 engine.start() 之前跑（用来拆出多文本节点）。 */
function bootWith(srcText, html, prepare, url) {
  const createEngine = new Function(srcText + "; return createEngine;")();
  const dom = new JSDOM("<body>" + html + "</body>", { url: url || "https://pubchem.ncbi.nlm.nih.gov/compound/2244" });
  if (prepare) prepare(dom.window.document);
  const engine = createEngine({ document: dom.window.document, window: dom.window, data: siteData(), site });
  engine.start();
  return { dom, engine, doc: dom.window.document };
}
const boot = (html, prepare) => bootWith(srcEngine, html, prepare);

const CITATION =
  "US EPA; Non-confidential Production Volume Information Submitted by Companies for Chemicals Under the 1986-2002 Inventory Update Rule (IUR).";
const WORD_DIV = "text-gray-700 dark:text-gray-400 text-sm italic pl-4 pc-word-break";

/** 与线上 DOM 一致：一个单词一个文本节点，单词之间一个纯空白文本节点 */
function fillWords(doc) {
  const div = doc.querySelector("div");
  CITATION.split(" ").forEach((w, i) => {
    if (i) div.appendChild(doc.createTextNode(" "));
    div.appendChild(doc.createTextNode(w));
  });
}

/** r28 建议的引擎补丁（三行）：锚点还在才打，src 已被别的修法改过就原样返回 */
function patchInLongProse(src) {
  const anchor = "    if (inLongProse(node.parentElement)) {";
  if (!src.includes(anchor)) return { src, applied: false };
  const out = src
    .replace("    var ctx = inlineRoot(el);\n", "    var ctx = inlineRoot(node);\n")
    .replace(anchor, "    if (inLongProse(node)) {")
    .replace("      prose: inLongProse(node.parentElement),", "      prose: inLongProse(node),");
  return { src: out, applied: out !== src };
}

test("r28 词库：20 条属性/链接文案进 exact（含 r26 点名 4 条）", () => {
  assert.equal(book.meta.family, "pubchem-dbgap");
  assert.ok(Object.keys(book.exact).length >= 539, "exact 条目不足: " + Object.keys(book.exact).length);
  const cases = {
    "What is this information": "这是什么信息",
    "What is this information?": "这是什么信息？",
    "View and refine this dataset in a new browser window": "在新浏览器窗口中查看并细化此数据集",
    "View in Classification Browser": "在分类浏览器中查看",
    "Evidence. Show description": "证据。显示说明",
    "Evidence": "证据",
    "Evidence DOI": "证据 DOI",
    "Evidence PMID:": "证据 PMID：",
    "Successor": "后继化合物",
    "Predecessor": "前体化合物",
    "Predecesssor": "前体化合物",
    "Predecessor Name": "前体名称",
    "Successor Name": "后继名称",
    "Transformation": "转化",
    "Expand This Node": "展开此节点",
    "Collapse This Node": "折叠此节点",
    "Show Description for This Node": "显示此节点的说明",
    "BioAssay Count Linked to This Node": "与此节点关联的生物测定数",
    "Compound Count Linked to This Node": "与此节点关联的化合物数",
    "Compound count is too large to view.": "化合物数量过多，无法查看。",
    "Go to MeSH Tree page about this term": "前往该术语的 MeSH 树页面"
  };
  for (const [k, v] of Object.entries(cases)) assert.equal(book.exact[k], v, "缺少/译错: " + k);
});

test("r28 属性通道：title / aria-label / alt 实际被替换", () => {
  const { doc } = boot(
    '<button title="What is this information">i</button>' +
      '<a title="View and refine this dataset in a new browser window">View in Classification Browser</a>' +
      '<button aria-label="Evidence. Show description">Evidence</button>' +
      '<img alt="Successor" src="/x.png">' +
      '<img alt="Predecesssor" src="/y.png">' +
      '<button title="Expand This Node">+</button>' +
      '<button title="Collapse This Node">-</button>' +
      '<button title="Show Description for This Node">?</button>' +
      '<a title="BioAssay Count Linked to This Node">3</a>' +
      '<a title="Compound Count Linked to This Node">4</a>' +
      '<p title="Compound count is too large to view.">n/a</p>' +
      '<a title="Go to MeSH Tree page about this term">MeSH Tree</a>'
  );
  const els = doc.body.children;
  assert.equal(els[0].getAttribute("title"), "这是什么信息");
  assert.equal(els[1].getAttribute("title"), "在新浏览器窗口中查看并细化此数据集");
  assert.equal(els[2].getAttribute("aria-label"), "证据。显示说明");
  assert.equal(els[3].getAttribute("alt"), "后继化合物");
  assert.equal(els[4].getAttribute("alt"), "前体化合物");
  assert.equal(els[5].getAttribute("title"), "展开此节点");
  assert.equal(els[6].getAttribute("title"), "折叠此节点");
  assert.equal(els[7].getAttribute("title"), "显示此节点的说明");
  assert.equal(els[8].getAttribute("title"), "与此节点关联的生物测定数");
  assert.equal(els[9].getAttribute("title"), "与此节点关联的化合物数");
  assert.equal(els[10].getAttribute("title"), "化合物数量过多，无法查看。");
  assert.equal(els[11].getAttribute("title"), "前往该术语的 MeSH 树页面");
});

test("r28 文本通道：Evidence 按钮文字与分类浏览器链接文字也翻", () => {
  const { doc } = boot(
    '<button class="pc-word-break">Evidence</button>' +
      '<a href="#x">View in Classification Browser</a>' +
      '<span>Evidence DOI</span>' +
      '<span>Evidence PMID:</span>'
  );
  const [b, a, s1, s2] = doc.body.children;
  assert.equal(b.textContent, "证据");
  assert.equal(a.textContent, "在分类浏览器中查看");
  assert.equal(s1.textContent, "证据 DOI");
  assert.equal(s2.textContent, "证据 PMID：");
});

test("r28 不删全线通用短词：Volume / Submitted / Update 仍在原册", () => {
  assert.equal(ncbi.exact["Volume"], "卷");
  assert.equal(common.exact["Submitted"], "已提交");
  assert.equal(common.exact["Update"], "更新");
  const { engine } = boot("<p>x</p>");
  assert.equal(engine.translateText("Volume"), "卷");
  assert.equal(engine.translateText("Submitted"), "已提交");
  assert.equal(engine.translateText("Update"), "更新");
});

test("r28 过译：整句作为单个文本节点时本来就不翻（所以整句 exact 修不了逐词切分）", () => {
  const { engine, doc } = boot('<div class="pc-word-break">' + CITATION + "</div>");
  assert.equal(engine.translateText(CITATION), null);
  assert.equal(doc.querySelector("div").textContent, CITATION, "整句单节点不应被翻译");
});

test("r28 过译修法：inLongProse 以文本节点自身取上下文后，逐词切分保持英文且短行照旧翻", () => {
  const patched = patchInLongProse(srcEngine); // applied=false 表示 src 已被别的修法改过，按已修复验收
  const { doc } = bootWith(patched.src, '<div class="' + WORD_DIV + '"></div>', fillWords);
  const div = doc.querySelector("div");
  assert.equal(String(div.textContent), CITATION, "逐词切分的英文引文仍被逐词翻掉了: " + div.textContent);
  // 反例保护：同 class 的短行（Computed by …）必须继续翻
  const { doc: doc2 } = bootWith(patched.src, '<div class="' + WORD_DIV + '">Computed by PubChem 2.2 (PubChem release 2025.04.14)</div>');
  assert.equal(doc2.querySelector("div").textContent, "由 PubChem 2.2 计算（PubChem 版本 2025.04.14）");
});
