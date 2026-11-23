// PubMed 帮助页补词（dict/ncbi-help.json）：LinkOut / Cookie / E-Utilities 两种形态
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "pubmed-help");
assert.ok(site, "config/sites.json 缺少 pubmed-help 站点");

const readBook = (id) => JSON.parse(fs.readFileSync(path.join(root, "../dict", id + ".json"), "utf8"));
const dict = readBook("ncbi-help");
const data = { exact: {}, rules: [], templates: [] };
for (const id of site.dicts) {
  const b = readBook(id);
  Object.assign(data.exact, b.exact || {});
  data.rules = data.rules.concat(b.rules || []);
  data.templates = data.templates.concat(b.templates || []);
}

function boot(html) {
  const dom = new JSDOM("<body>" + html + "</body>", { url: "https://pubmed.ncbi.nlm.nih.gov/help/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data,
    site
  });
  engine.start();
  return { doc: dom.window.document, engine };
}

test("新增条目：LinkOut / Cookie / cookie / E-Utilities / E-utilities", () => {
  assert.equal(dict.exact["LinkOut"], "LinkOut");
  assert.equal(dict.exact["Cookie"], "Cookie");
  assert.equal(dict.exact["cookie"], "Cookie");
  assert.equal(dict.exact["E-Utilities"], "E-utilities");
  assert.equal(dict.exact["E-utilities"], "E-utilities");
  for (const k of ["LinkOut", "Cookie", "cookie", "E-Utilities", "E-utilities"]) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "键含中文: " + k);
    assert.equal(dict.exact[k], String(dict.exact[k]).trim(), "值首尾空白: " + k);
  }
});

// 帮助页同时有裸锚「PubMed Central」和「PubMed Central (PMC)」两种写法；
// 前者在 ncbi-help，后者在 ncbi 册，合并后必须得到同一个结果、不能叠加括号。
test("PubMed Central 两种形态都能翻且不冲突", () => {
  const { engine } = boot("<p>x</p>");
  assert.equal(engine.translateText("PubMed Central"), "PubMed Central（PMC）");
  assert.equal(engine.translateText("PubMed Central (PMC)"), "PubMed Central（PMC）");
});

test("帮助页中文句内链接：只换链接词，LinkOut 保持专名", () => {
  const { doc, engine } = boot(
    "<p>大多数 PubMed 记录包含 <a href=\"#\">LinkOut</a> 资源，这些网站包括出版商与聚合服务商。</p>" +
      "<li>您的网页浏览器必须接受 <a href=\"#help-cookies\">cookie</a> 才能使用剪贴板。</li>" +
      "<p>用户应使用 <a href=\"#\">E-Utilities</a>。用户必须遵守相关规定。</p>" +
      "<p><a href=\"#\">E-utilities</a> 是一组工具，可在常规 NCBI 网页检索界面之外访问数据。</p>"
  );
  const links = [...doc.querySelectorAll("a")].map((a) => a.textContent);
  assert.deepEqual(links, ["LinkOut", "Cookie", "E-utilities", "E-utilities"]);
  assert.equal(
    doc.querySelectorAll("p")[0].textContent,
    "大多数 PubMed 记录包含 LinkOut 资源，这些网站包括出版商与聚合服务商。"
  );
  assert.equal(engine.translateText("cookie"), "Cookie");
  assert.equal(engine.translateText("E-Utilities"), "E-utilities");
});
