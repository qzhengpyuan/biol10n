// NCBI 词库（ncbi）P3 收尾回归：
//   1. 分页「of N」在输入框右侧的片段（真实 /gene/?term=TP53 的 <h3 class="page"> 结构）
//   2. "N of M" 只走数字形态，正文里的 of 不被吃
//   3. DOI 只认带冒号的标签形态，冒号不再被吞
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/ncbi.json"), "utf8"));

// 站点条目以 config/sites.json 为准；父级还没加 ncbi-gene 时用这里约定的同款配置。
const projectedSite = {
  id: "ncbi-gene",
  name: "NCBI Gene",
  hosts: ["www.ncbi.nlm.nih.gov"],
  path: "^/gene",
  dicts: ["common", "ncbi", "gene", "gene2", "ncbi-footer"],
  scope: "body"
};
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const configSite = sites.find((s) => s.id === "ncbi-gene");
const site = Object.assign({}, configSite || projectedSite, {
  id: "ncbi-gene",
  dicts: (configSite && configSite.dicts && configSite.dicts.length) ? configSite.dicts : projectedSite.dicts,
  scope: (configSite && configSite.scope) || "body"
});

const data = { exact: {}, rules: [], templates: [] };
for (const id of site.dicts) {
  const b = JSON.parse(fs.readFileSync(path.join(root, "../dict", id + ".json"), "utf8"));
  Object.assign(data.exact, b.exact || {});
  data.rules = data.rules.concat(b.rules || []);
  data.templates = data.templates.concat(b.templates || []);
}

function run(html) {
  const dom = new JSDOM("<body>" + html + "</body>");
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return dom.window.document;
}
function translate(s) {
  const dom = new JSDOM("<body></body>");
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  return engine.translateText(s);
}

test("词库结构：分页与 DOI 条目形态、规则可编译", () => {
  assert.equal(book.meta.family, "ncbi");
  assert.ok(book.meta.sites.includes("www.ncbi.nlm.nih.gov"), "meta.sites 要声明 host");

  // 全册只校验「键」侧卫生（值侧的中文要求由 dict-lint 与各册既有单测覆盖：
  // 本册允许 "PubMed Central (PMC)" 这类保持英文的专名）。
  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "键里不能有中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "键首尾不能有空白: " + JSON.stringify(k));
    assert.equal(v, String(v).trim(), "值首尾不能有空白: " + k);
    assert.ok(!/https?:\/\/[^\s）]+\.[a-z]/i.test(v), "译文里不能有明文 URL: " + k);
    assert.ok(!/@[\w.-]+\.[a-z]/i.test(v), "译文里不能有邮箱: " + k);
  }

  // 本次新增条目：值必须有汉字，且不得是 accesscion/邮箱。
  assert.ok(/[\u4e00-\u9fff]/.test(book.exact["DOI:"]), "新增的 DOI 标签译文必须有汉字");

  // DOI 只留带冒号的标签形态：值必须把冒号保留成全角冒号，裸词交给 common 的既有词条。
  assert.equal(book.exact["DOI:"], "DOI 号：", "DOI 标签要保留全角冒号");
  assert.ok(!Object.prototype.hasOwnProperty.call(book.exact, "DOI"), "ncbi 册不再重复定义裸 DOI");

  const pagers = book.rules.filter((r) => /^\^(?:of |\(\\d\+\) of )/.test(r.re));
  const hasOfFragment = pagers.some((r) => r.re === "^of ([\\d,]+)$" && r.to === "/ $1 页");
  const hasOfPages = pagers.some((r) => r.re === "^of ([\\d,]+) pages?$");
  const hasNofMPages = pagers.some((r) => r.re === "^(\\d+) of ([\\d,]+) pages?$");
  assert.ok(hasOfFragment, "输入框右侧的「of N」片段要有规则");
  assert.ok(hasOfPages, "「of N pages」片段要有规则");
  assert.ok(hasNofMPages, "「N of M pages」整句要能整句化");

  for (const r of book.rules) {
    assert.ok(new RegExp(r.re).source.length > 0, "正则必须能编译: " + r.re);
    // 分页规则必须是数字形态：正文里的 of 不会被吃。
    if (/(^|\s)of\b/.test(r.re) && /页/.test(r.to)) {
      assert.ok(/\\d/.test(r.re), "涉及 of 的分页规则必须锚定数字: " + r.re);
    }
  }
  // 本次新增的三条分页规则：译文含汉字且占位符与捕获组对齐。
  for (const r of book.rules) {
    if (!/^of \(|^\(\\d\+\) of \(/.test(r.re)) continue;
    if (!/页/.test(r.to)) continue;
    assert.ok(/[\u4e00-\u9fff]/.test(r.to), "新增分页规则译文必须有中文: " + r.re);
    const groups = (r.re.match(/\(/g) || []).length;
    const slots = (r.to.match(/\$\d/g) || []).length;
    assert.ok(slots >= 1 && slots <= groups, "占位符要与捕获组对齐: " + r.re + " → " + r.to);
  }
});

test("分页：真实 /gene/?term=TP53 的分页框，数字留在 input、文案整句化", () => {
  // 实测原文：<h3 class="page"><label for="pageno">Page </label><input … value="1" last="633"> of 633</h3>
  const html =
    '<h3 class="page"><label for="pageno">Page </label>' +
    '<input name="EntrezSystem2.PEntrez.Gene.Gene_ResultsPanel.Entrez_Pager.cPage" id="pageno" type="text" class="num" sid="1" value="1" last="633">' +
    " of 633</h3>";
  const doc = run(html);
  const h3 = doc.querySelector("h3.page");
  const input = h3.querySelector("input");
  assert.equal(input.getAttribute("value"), "1", "页码数字不能被翻译");
  assert.equal(input.value, "1");
  const label = h3.querySelector("label").textContent.trim();
  assert.equal(label, "第", "Page 标签翻成第");
  const after = h3.lastChild.nodeValue.trim();
  assert.equal(after, "/ 633 页", "输入框右侧是「/ 633 页」，与数字合成「第 1 / 633 页」");
  assert.ok(!/页，共/.test(h3.textContent), "不再出现紧贴输入框的「页，共」: " + h3.textContent);
  assert.equal(h3.textContent.replace(/\s+/g, " ").trim(), "第 / 633 页");
});

test("分页：jig 翻页控件（/gene/7157）的 of 是独立文本节点，不靠裸 of 规则改写", () => {
  // 实测原文（/gene/7157 的 .ui-ncbigrid-paged-pageControl）：
  //   <label>Page</label> <input value="2"> of <span class="ui-ncbigrid-paged-endPage">3</span>
  // 数字在 input 的 value 里、总页数在后面的 span 里，「of」是中间一个独立文本节点，
  // 所以只吃 ^of$ 的规则拿不到任何数字（要翻只能翻成符号），且会波及正文里单独成节点的 of。
  const html =
    '<div class="ui-ncbigrid-paged-pageControl pagination">' +
    '<span class="prev">« 上一页</span> <label for="pg13">Page</label> ' +
    '<input type="text" value="2" size="2" id="pg13"> of ' +
    '<span class="ui-ncbigrid-paged-endPage">3</span> <span class="next">下一页 »</span></div>';
  const doc = run(html);
  const ctl = doc.querySelector(".ui-ncbigrid-paged-pageControl");
  assert.equal(ctl.querySelector("input").value, "2", "页码数字不能被翻译");
  assert.equal(ctl.querySelector("input").getAttribute("value"), "2");
  assert.equal(ctl.querySelector("label").textContent.trim(), "第", "Page 标签翻成第");
  assert.equal(ctl.querySelector(".ui-ncbigrid-paged-endPage").textContent.trim(), "3", "总页数原样");
  // 已知限制：这一处仍是「第 [2] of 3」。修它需要引擎把 input 邻接片段拼起来，
  // 或在 config/sites.json 里对 .ui-ncbigrid-paged-pageControl 做 block/skip（不在本册范围）。
  assert.ok(/\bof\b/.test(ctl.textContent), "裸 of 片段保持英文，不加会波及正文的规则: " + ctl.textContent);
});

test("分页片段：of N / of N pages 都收成斜杠式", () => {
  assert.equal(translate("of 633"), "/ 633 页");
  assert.equal(translate("of 2 pages"), "/ 2 页");
  assert.equal(translate("of 1"), "/ 1 页");
  // 千分位保留
  assert.equal(translate("of 12,345"), "/ 12,345 页");
});

test("整句化：N of M pages 走数字形态，不再整句留英文", () => {
  const out = translate("1 of 2 pages");
  assert.ok(/页$/.test(out), "整句要落到中文页码: " + out);
  assert.ok(/^1\s*\/\s*2\s*页$/.test(out) || out === "第 1 / 2 页", "页码形态: " + out);
  assert.ok(!/\bof\b/.test(out), "不能再留 of: " + out);
});

test("N of M 收窄：正文里的 of 与既有计数规则都不受影响", () => {
  // 正文：一律不动（这里逐句断言，避免被长正文保护之外的分支改写）
  assert.equal(translate("The role of p53 in cancer"), null);
  assert.equal(translate("one of these days"), null);
  // 既有整句规则不回退
  assert.equal(translate("Page 3 of 748"), "第 3 页，共 748 页");
  assert.equal(translate("Showing 5 of 26 (by status, accession number)"), "显示 5 条，共 26 条（按状态、登录号）");
  // 计数节点仍走数字拆分，但不再产出「页，共」这种页码措辞
  const count = translate("5 of 26");
  assert.equal(count, "5 / 26 页");
});

test("DOI：只认带冒号的标签，冒号保留；URL 与正文不动", () => {
  assert.equal(translate("DOI:"), "DOI 号：");
  assert.equal(translate("doi:"), "DOI 号：");
  assert.equal(translate("https://doi.org/10.1038/s41586-020-2008-3"), null);
  assert.equal(translate("For best results when searching by DOI or other article identifier, use double quotes."), null);
  // 裸 DOI 仍由 common 的既有词条处理（本册不重复定义，避免两册同 key 冲突）
  assert.equal(translate("DOI"), "DOI 号");
});

test("渲染：DOI 标签与分页同页共存时互不干扰", () => {
  const doc = run(
    '<div class="citation"><span>DOI:</span> <span>10.1038/s41586-020-2008-3</span></div>' +
      '<h3 class="page"><label for="pageno2">Page </label><input id="pageno2" type="text" value="2" last="633"> of 633</h3>'
  );
  const cite = doc.querySelector(".citation");
  assert.equal(cite.querySelectorAll("span")[0].textContent, "DOI 号：");
  assert.equal(cite.querySelectorAll("span")[1].textContent, "10.1038/s41586-020-2008-3", "DOI 值原样");
  const h3 = doc.querySelector("h3.page");
  assert.equal(h3.querySelector("input").value, "2");
  assert.ok(/^ Page |^第/.test(" " + h3.querySelector("label").textContent) || h3.querySelector("label").textContent.trim() === "第");
  assert.ok(!/页，共/.test(h3.textContent));
});
