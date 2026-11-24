// r42 ClinVar/NCBI 的 .gov 横幅第二段（Secure .gov websites use HTTPS …）：
// 真实 DOM 里整段被 <strong>/<br>/span.icon-lock(SVG)/<strong> 切成 9 个节点，
// 逐节点翻只能得到 "A 锁 ( 锁锁定挂锁图标) or …" 的混排，故整段走模板。
// 原文取自 2026-11-24 CDP 实测（__BIOL10N.disable() 后的 outerHTML）。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const sites = read("../config/sites.json").sites;
const clinvar = sites.find((s) => s.id === "ncbi-clinvar");
assert.ok(clinvar, "config/sites.json 里应有 ncbi-clinvar");

const books = clinvar.dicts.map((n) => read("../dict/" + n + ".json"));
const data = {
  exact: Object.assign({}, ...books.map((b) => b.exact || {})),
  rules: books.flatMap((b) => b.rules || []),
  templates: books.flatMap((b) => b.templates || [])
};

const SVG =
  '<span class="icon-lock"><svg xmlns="http://www.w3.org/2000/svg" width="52" height="64" viewBox="0 0 52 64" ' +
  'class="usa-banner__lock-image" role="graphics-symbol" aria-labelledby="banner-lock-description" focusable="false">' +
  '<title id="banner-lock-title">Lock</title><desc id="banner-lock-description">Locked padlock icon</desc>' +
  '<path fill="#000000" fill-rule="evenodd" d="M26 0c10.493 0 19 8.507 19 19v9z"></path></svg></span>';

// 真实 DOM 的换行缩进原样保留：模板 pat 里的空白会被 normalize 折叠，但节点分割点不能变
const BANNER =
  '<div class="usa-banner__guidance tablet:grid-col-6"><img class="usa-banner__icon usa-media-block__img" src="/clinvar/static/img/icon-https.svg" alt="" aria-hidden="true">' +
  '<div class="usa-media-block__body"><p>\n                            ' +
  "<strong>Secure .gov websites use HTTPS</strong>\n                            <br>\n                            A " +
  "<strong>lock</strong> (\n                            " + SVG +
  ") or <strong>https://</strong> means you've safely\n                                connected to the .gov website. Share sensitive\n" +
  "                                information only on official, secure websites.\n                        </p></div></div>";

function boot(html) {
  const dom = new JSDOM("<body>" + html + "</body>", { url: "https://www.ncbi.nlm.nih.gov/clinvar/variation/12881/" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site: clinvar });
  engine.start();
  return dom.window.document;
}

const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();

test("模板存在且锚定真实 DOM 形态", () => {
  const tpl = data.templates.find((t) => /means you've safely connected to the .gov website/.test(t.pat));
  assert.ok(tpl, "缺 .gov 横幅模板");
  assert.equal(
    tpl.pat,
    "{{1}} {{2}} A {{3}} ( {{4}}) or {{5}} means you've safely connected to the .gov website. " +
      "Share sensitive information only on official, secure websites."
  );
  assert.equal((tpl.zh.match(/\{\{\d+\}\}/g) || []).length, 5, "槽位数应为 5");
  assert.doesNotMatch(tpl.pat, /[\u4e00-\u9fff]/);
});

test("整段换成中文，SVG 锁图标与 <br> 保留，句子里不再有 A / or", () => {
  const doc = boot(BANNER);
  const p = doc.querySelector(".usa-banner__guidance p");
  assert.equal(p.getAttribute("data-biol10n-tpl"), "1", "未走模板通道");
  assert.equal(p.querySelectorAll("svg").length, 1, "SVG 锁图标丢了");
  assert.equal(p.querySelectorAll("br").length, 1, "换行丢了");
  const text = norm(p.textContent);
  assert.match(text, /^安全的 \.gov 网站使用 HTTPS 锁/, "前半句未汉化: " + text);
  assert.match(text, /表示您已安全连接到 \.gov 网站。/, "后半句未汉化: " + text);
  assert.doesNotMatch(text, /means you|Share sensitive|belongs to an official/);
});

test("第一段（Official websites use .gov）不受影响，仍按词条翻", () => {
  const doc = boot(
    '<div class="usa-banner__guidance"><div class="usa-media-block__body"><p>\n <strong>Official websites use .gov</strong>\n <br>\n A <strong>.gov</strong> ' +
      "website belongs to an official\n government organization in the United States.\n </p></div></div>"
  );
  const text = norm(doc.querySelector(".usa-banner__guidance p").textContent);
  assert.match(text, /美国政府官方网站使用 \.gov/, "第一段未汉化: " + text);
  assert.match(text, /美国官方政府机构/, "第二句未汉化: " + text);
  assert.doesNotMatch(text, /belongs to an official|government organization/);
});
