// PubMed 站词库（dict/pubmed2.json）补译测试：剪贴板页、LinkOut 分类、排序按钮
// 这些界面文字只在 PubMed 自己的组件里整节点出现，与 ncbi / ncbi-help 册不重叠，故单独成篇。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/pubmed2.json"), "utf8"));

// scope 放 body：剪贴板页的提示条与对话框都在 main 之外
const site = {
  id: "pubmed-test",
  hosts: ["pubmed.ncbi.nlm.nih.gov"],
  scope: "body",
  spa: false,
  rescan: false,
  proseGuard: true,
  proseMax: 120
};

function mount(inner, url = "https://pubmed.ncbi.nlm.nih.gov/clipboard/") {
  const dom = new JSDOM('<div id="root">' + inner + "</div>", { url });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: dict.exact, rules: dict.rules, templates: dict.templates },
    site
  });
  engine.start();
  return { dom, doc: dom.window.document, engine };
}

function zh(text) {
  return String(text).replace(/\s+/g, " ").trim();
}

test("补译条目齐备：剪贴板四条文案、LinkOut 分类、两个属性、排序按钮成对", () => {
  const want = {
    "Clipboard items": "剪贴板条目",
    "No items in clipboard.": "剪贴板中没有条目。",
    "Your clipboard expires after eight hours of inactivity.": "剪贴板闲置八小时后过期。",
    "Your entire clipboard is about to be cleared.": "您的整个剪贴板即将被清除。",
    "Research Materials": "研究材料",
    "Dismiss expiration warning": "关闭过期提醒",
    "Delete All From Clipboard Dialog": "全部从剪贴板删除对话框",
    "Change to ascending order": "改为升序排列",
    "Change to descending order": "改为降序排列"
  };
  for (const [k, v] of Object.entries(want)) assert.equal(dict.exact[k], v, "缺少或值不符：" + k);
});

test("剪贴板页：空剪贴板与清空确认的整句文案全部译出", () => {
  const { doc, dom } = mount(
    '<main><h2 class="usa-sr-only">Clipboard items</h2>' +
      '<div class="results-amount">No items in clipboard.</div></main>' +
      '<div class="clipboard-alert"><p class="usa-alert-text">Your clipboard expires after eight hours of inactivity.</p></div>' +
      '<div class="overlay" aria-label="Delete All From Clipboard Dialog"><div class="dialog">' +
      '<div class="confirm-delete-clipboard-text">Your entire clipboard is about to be cleared.</div></div></div>'
  );
  assert.equal(zh(doc.querySelector("h2.usa-sr-only").textContent), "剪贴板条目");
  assert.equal(zh(doc.querySelector(".results-amount").textContent), "剪贴板中没有条目。");
  assert.equal(zh(doc.querySelector("p.usa-alert-text").textContent), "剪贴板闲置八小时后过期。");
  assert.equal(
    zh(doc.querySelector(".confirm-delete-clipboard-text").textContent),
    "您的整个剪贴板即将被清除。"
  );
  dom.window.close();
});

test("剪贴板页：过期警告的关闭按钮 title 与删除对话框 aria-label 译出，其余属性不动", () => {
  const { doc, dom } = mount(
    '<div class="clipboard-alert"><a class="alert-dismiss" role="button" href="#" ' +
      'title="Dismiss expiration warning" aria-label="Dismiss">x</a></div>' +
      '<div class="overlay" aria-label="Delete All From Clipboard Dialog" role="dialog">' +
      '<button class="confirm-delete">OK</button></div>'
  );
  const dismiss = doc.querySelector(".alert-dismiss");
  assert.equal(dismiss.getAttribute("title"), "关闭过期提醒");
  assert.equal(dismiss.getAttribute("href"), "#", "href 必须保留");
  assert.equal(dismiss.getAttribute("aria-label"), "Dismiss", "未收词条的属性保持原样");
  const overlay = doc.querySelector(".overlay");
  assert.equal(overlay.getAttribute("aria-label"), "全部从剪贴板删除对话框");
  assert.equal(overlay.getAttribute("role"), "dialog", "role 必须保留");
  dom.window.close();
});

test("LinkOut 分类：Research Materials 与既有分类各自成词", () => {
  const { doc, dom } = mount(
    '<main><section class="linkout"><h3 class="linkout-category">Research Materials</h3>' +
      '<ul><li><a href="https://example.org/">Addgene</a></li></ul></section>' +
      '<section class="linkout"><h3 class="linkout-category">Medical</h3></section>' +
      '<section class="linkout"><h3 class="linkout-category">Molecular Biology Databases</h3></section></main>'
  );
  const cats = [...doc.querySelectorAll(".linkout-category")].map((e) => zh(e.textContent));
  assert.deepEqual(cats, ["研究材料", "医学", "分子生物学数据库"]);
  // 资源名是专有名词，整体保留
  assert.equal(zh(doc.querySelector(".linkout-links a, ul a").textContent), "Addgene");
  dom.window.close();
});

test("排序按钮：升序/降序两个 title 成对译出，data 属性与按钮结构不动", () => {
  const { doc, dom } = mount(
    '<div class="sort-dropdown"><button class="sort-order-icon" aria-label="Sort order" ' +
      'title="Change to ascending order" data-sort-order="asc"></button>' +
      '<button class="sort-order-icon" aria-label="Sort order" ' +
      'title="Change to descending order" data-sort-order="desc"></button></div>'
  );
  const btns = [...doc.querySelectorAll("button.sort-order-icon")];
  assert.equal(btns[0].getAttribute("title"), "改为升序排列");
  assert.equal(btns[1].getAttribute("title"), "改为降序排列");
  assert.equal(btns[0].getAttribute("data-sort-order"), "asc");
  assert.equal(btns[1].getAttribute("data-sort-order"), "desc");
  dom.window.close();
});

// ---------------- 负例：新词条不得在英文正文里被翻出来 ----------------

test("负例：摘要正文里被 <b> 包住的 Research Materials / Clipboard items 不翻", () => {
  const { doc, dom } = mount(
    '<main><div class="abstract-content"><p>The curation team assembled a detailed catalogue that ' +
      'covers <b>Research Materials</b> and other curated entries used by the annual review process, ' +
      'and the portal also links <b>Clipboard items</b> into every saved collection for later reuse.</p></div></main>'
  );
  const p = doc.querySelector("p");
  assert.match(zh(p.textContent), /Research Materials/, "正文里的 Research Materials 必须保持英文");
  assert.match(zh(p.textContent), /Clipboard items/, "正文里的 Clipboard items 必须保持英文");
  dom.window.close();
});

test("负例：跳页对话框的 of 与文章页 Keywords: 保持原样（本册不收录）", () => {
  const { doc, dom } = mount(
    '<div class="overlay"><div class="dialog jump-to-page-dialog"><form action="/">' +
      '<div class="page-input"><input id="jump" value="1"> of <span class="total-pages">2,637</span></div>' +
      '</form></div></div>' +
      '<main><p><strong class="sub-title">Keywords:</strong> ESAM; BRCA1</p></main>'
  );
  const pageInput = doc.querySelector(".page-input");
  const ofNode = [...pageInput.childNodes].map((n) => String(n.nodeValue || "").trim()).find((t) => t === "of");
  assert.equal(ofNode, "of", "of 在界面里保持英文（写 / 会与 ensembl/expasy 的既有译法冲突）");
  assert.equal(zh(doc.querySelector(".sub-title").textContent), "Keywords:");
  dom.window.close();
});

test("负例：长正文里单独出现的 Research Materials 链接文字也不翻", () => {
  const { doc, dom } = mount(
    '<main><div class="full-text"><p>Researchers uploaded the final version of the manuscript and ' +
      'then asked the repository team to attach <a href="/rm/">Research Materials</a> before the release date.</p></div></main>'
  );
  assert.match(zh(doc.querySelector(".full-text p").textContent), /Research Materials/);
  dom.window.close();
});
