// r35-c：HPA 组织页左侧菜单「ANTIBODIES / AND / VALIDATION」与多重成像缩略图 alt。
// 英文原串全部取自真实渲染 DOM（CDP 9227，https://www.proteinatlas.org/ENSG00000141510-TP53/tissue）：
//   <span><a href="/ENSG00000141510-TP53/summary/antibody">
//     <div style="...">ANTIBODIES<br>AND<br>VALIDATION</div>
//     <img style="..." src="/images_static/validation_antibody.png"></a></span>
// 服务端 HTML 里是 AND，`hpa.json` 的 "AND": "与" 已把它译成「与」，于是页面上呈
// 「ANTIBODIES 与 VALIDATION」半翻；两个全大写词没有键（引擎对全大写串不回退小写）。
// 多重成像缩略图：<img src="//images.proteinatlas.org/ih_multiplex/.../200x200.jpg" alt="Multiplex image" class="rounded"> ×2。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "hpa");
assert.ok(site, "config/sites.json 里应有 hpa 站点");

// 生产上按 sites.json 的 dicts 顺序叠词库（common → hpa → anatomy → onco → hpa2 → fill-r19）。
const DATA = (() => {
  const exact = {}, rules = [], templates = [];
  for (const book of site.dicts) {
    const p = path.join(root, "../dict", book + ".json");
    if (!fs.existsSync(p)) continue;
    const d = JSON.parse(fs.readFileSync(p, "utf8"));
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
    templates.push(...(d.templates || []));
  }
  return { exact, rules, templates };
})();
const hpa = JSON.parse(fs.readFileSync(path.join(root, "../dict/hpa.json"), "utf8"));

function boot(html) {
  const dom = new JSDOM(html, { url: "https://www.proteinatlas.org/ENSG00000141510-TP53/tissue" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data: DATA, site });
  engine.start();
  return { engine, doc: dom.window.document };
}
const tr = (s) => boot("<p>x</p>").engine.translateText(s);

// ---------------- 词库结构 ----------------

test("r35-c 词库：标准序列化、末尾换行、键里没有汉字", () => {
  const raw = fs.readFileSync(path.join(root, "../dict/hpa.json"), "utf8");
  assert.ok(raw.endsWith("\n"), "dict/hpa.json 应以换行结尾");
  assert.equal(raw, JSON.stringify(hpa, null, 2) + "\n", "dict/hpa.json 应是 2 空格缩进的标准序列化");
  for (const k of Object.keys(hpa.exact)) assert.ok(!/[\u4e00-\u9fff]/.test(k), "exact 的键必须是英文原串：" + k);
});

test("r35-c 新增 exact：侧菜单全大写菜单项与多重成像 alt", () => {
  assert.equal(hpa.exact.ANTIBODIES, "抗体");
  assert.equal(hpa.exact.VALIDATION, "验证");
  assert.equal(hpa.exact["Multiplex image"], "多重成像图");
  // 首字母大写的老键必须保留：表格列名仍走大小写兜底。
  assert.equal(hpa.exact.Antibodies, "抗体");
  assert.equal(hpa.exact.Validation, "验证");
});

// ---------------- 引擎行为 ----------------

test("真实 DOM 结构：菜单三个文本节点分别翻译，连接词沿用 hpa 的 AND=与", () => {
  const html =
    '<div id="sidemenu"><span style="margin-top:15px;">' +
    '<a href="/ENSG00000141510-TP53/summary/antibody">' +
    '<div id="menu-av" style="margin:5px 70px 5px 0px; font-size:13px; text-align:center;">ANTIBODIES<br>AND<br>VALIDATION</div>' +
    '<img style="height:28px;" src="/images_static/validation_antibody.png"></a></span></div>';
  const { doc } = boot(html);
  const menu = doc.getElementById("menu-av");
  assert.equal(menu.innerHTML, "抗体<br>与<br>验证");
  assert.equal(menu.textContent, "抗体与验证");
});

test("多重成像缩略图 alt：Multiplex image → 多重成像图（同一页两张图同串）", () => {
  const html =
    '<div id="tissue">' +
    '<a href="/ENSG00000141510-TP53/tissue/testis#multiplex"><img src="//images.proteinatlas.org/ih_multiplex/39239/20460579_2A_2_5_749_200x200.jpg" alt="Multiplex image" class="rounded"></a>' +
    '<a href="/ENSG00000141510-TP53/tissue/testis#multiplex"><img src="//images.proteinatlas.org/ih_multiplex/39239/20463129_1A_2_6_1511_200x200.jpg" alt="Multiplex image" class="rounded"></a>' +
    "</div>";
  const { doc } = boot(html);
  const alts = [...doc.images].map((img) => img.getAttribute("alt"));
  assert.deepEqual(alts, ["多重成像图", "多重成像图"]);
});

test("同页其它属性与正文不受影响（未登记的串保持原样）", () => {
  assert.equal(tr("ANTIBODIES"), "抗体");
  assert.equal(tr("VALIDATION"), "验证");
  assert.equal(tr("Multiplex image"), "多重成像图");
  // 没登记的串仍然返回 null（不替换），确认新增全大写键没有放宽未命中串的处理。
  assert.equal(tr("HPA"), null);
});
