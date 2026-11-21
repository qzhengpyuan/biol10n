// r15：元数据块被贪婪规则吞并、标题品牌白名单、tooltip 子树、模板通道扩到 td/span
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const engineSrc = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(engineSrc + "; return createEngine;")();

function boot(data, html, site) {
  const dom = new JSDOM(html);
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data,
    site: site || { scope: "body", block: "pre, code" }
  });
  engine.start();
  return dom.window.document;
}

test("同块多个「标签:」时不做 <br> 拼接，子节点各自翻译", () => {
  const data = {
    exact: {},
    rules: [
      { re: "^Accession: (.+)$", to: "登录号：$1" },
      { re: "^First in ClinVar: (.+)$", to: "首次收录于 ClinVar：$1" },
      { re: "^Last updated: (.+)$", to: "最后更新：$1" }
    ]
  };
  const doc = boot(
    data,
    '<div class="smaller">Accession: SCV000679704.1<br>First in ClinVar: Oct 21, 2017<br>Last updated: Oct 21, 2017</div>'
  );
  const t = doc.querySelector("div").textContent;
  assert.match(t, /登录号：SCV000679704.1/);
  assert.match(t, /首次收录于 ClinVar：/);
  assert.match(t, /最后更新：/);
  assert.doesNotMatch(t, /Last updated:/);
});

test("元数据块拼接被放过时，单标签 <br> 仍按整段翻", () => {
  const doc = boot(
    { exact: { "The Housekeeping Proteome": "管家蛋白质组" }, rules: [] },
    "<h3>The Housekeeping<br>Proteome</h3>"
  );
  assert.equal(doc.querySelector("h3").textContent, "管家蛋白质组");
});

test("<br> 拼接跳过 tooltip / sr-only 子树", () => {
  const doc = boot(
    { exact: { "Global minor allele frequency (GMAF)": "全球次要等位基因频率（GMAF）" }, rules: [] },
    '<dt><span>Global minor allele <br>frequency (GMAF)</span><span class="usa-sr-only">Help icon for GMAF</span></dt>'
  );
  assert.match(doc.querySelector("dt").textContent, /全球次要等位基因频率（GMAF）/);
});

test("ClinVar 标题能通过品牌白名单", () => {
  const doc = boot(
    { exact: { Home: "首页", "Review status in ClinVar": "ClinVar 中的审核状态" }, rules: [] },
    "<html><head><title>ClinVar - Home</title></head><body></body></html>"
  );
  assert.equal(doc.title, "ClinVar - 首页");
  const doc2 = boot(
    { exact: { "Review status in ClinVar": "ClinVar 中的审核状态" }, rules: [] },
    "<html><head><title>Review status in ClinVar</title></head><body></body></html>"
  );
  assert.equal(doc2.title, "ClinVar 中的审核状态");
});

test("模板通道覆盖 td 里被 <a> 切开的句子", () => {
  const data = {
    exact: {},
    rules: [],
    templates: [
      { pat: "There are one or more submitted records with a classification but without {{1}}.", zh: "有多条提交记录给出了分类，但没有{{1}}。" }
    ]
  };
  const doc = boot(
    data,
    '<table><tr><td>There are one or more submitted records with a classification but without <a href="#">criteria</a>.</td></tr></table>'
  );
  const td = doc.querySelector("td");
  assert.match(td.textContent, /有多条提交记录给出了分类/);
  assert.ok(td.querySelector("a"), "链接必须保留");
});
