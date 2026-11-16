import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const src = readFileSync(new URL("../src/engine.js", import.meta.url), "utf8");
const { createEngine } = new Function(src + "\nreturn { createEngine };")();

const DICT = {
  exact: {
    "Tissue enriched": "组织富集",
    "Not detected": "未检出",
    "Cerebral cortex": "大脑皮层",
    "Contact Us": "联系我们"
  },
  rules: []
};

function run(html, site = {}) {
  const dom = new JSDOM("<body>" + html + "</body>", { url: "https://example.org/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: DICT,
    site: Object.assign({ attrs: [], block: "", proseGuard: true, proseMax: 120 }, site)
  });
  engine.start();
  return { doc: dom.window.document, engine };
}

test("SVG 里的 <text>/<tspan> 照翻", () => {
  const { doc } = run(
    '<svg><text>Tissue enriched</text><tspan>Not detected</tspan>' +
      '<path d="M0 0"/><title>Cerebral cortex</title></svg>'
  );
  assert.match(doc.body.textContent, /组织富集/);
  assert.match(doc.body.textContent, /未检出/);
  assert.doesNotMatch(doc.body.textContent, /Tissue enriched/);
});

test("SVG 的 <title>（图表 tooltip）也翻，图形节点不动", () => {
  const { doc } = run('<svg><title>Cerebral cortex</title><path d="M0 0" aria-label="Contact Us"/></svg>');
  assert.match(doc.body.textContent, /大脑皮层/);
});

test("SVG <text> 里被 tspan 拆开的词组按整条翻译（不出现「骨marrow」）", () => {
  const dom = new JSDOM(
    '<body><svg><text><tspan>Bone </tspan><tspan>marrow</tspan></text>' +
      "<text><tspan>Bone</tspan><tspan>marrow</tspan></text></svg></body>",
    { url: "https://example.org/" }
  );
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: { "Bone marrow": "骨髓" }, rules: [] },
    site: { attrs: [], block: "", proseGuard: true }
  });
  engine.start();
  const texts = [...dom.window.document.querySelectorAll("text")].map((t) => t.textContent.trim());
  assert.deepEqual(texts, ["骨髓", "骨髓"]);
});

test("<br> 拆开的标题拼接后整条翻（The Housekeeping<br>Proteome）", () => {
  const dom = new JSDOM(
    "<body><h3>The Housekeeping<br>Proteome</h3><h3>The Tissue and Cell<br>specific Proteome</h3></body>",
    { url: "https://example.org/" }
  );
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: {
      exact: {
        "The Housekeeping Proteome": "管家蛋白质组",
        "The Tissue and Cell specific Proteome": "组织与细胞特异性蛋白质组"
      },
      rules: []
    },
    site: { attrs: [], block: "", proseGuard: true }
  });
  engine.start();
  const hs = [...dom.window.document.querySelectorAll("h3")].map((h) => h.textContent.trim());
  assert.deepEqual(hs, ["管家蛋白质组", "组织与细胞特异性蛋白质组"]);
});

test("proseExempt 让指定块无条件翻（免责声明这类）", () => {
  const long = "This infographic was generated with the help of artificial intelligence. ".repeat(4);
  const { doc } = run('<p class="disc">' + long + "<a>Contact Us</a></p>", { proseExempt: ".disc" });
  assert.match(doc.body.textContent, /联系我们/);
});

test("长标签列表不是正文：超过 120 字符也照翻", () => {
  const items = ["Carbohydrate", "Energy", "Lipid", "Nucleotide", "Amino acid"]
    .map((x) => "<a>" + x + "</a><br>")
    .join("");
  const dom = new JSDOM("<body><p>" + items + "</p></body>", { url: "https://example.org/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: { Carbohydrate: "碳水化合物", Energy: "能量", Lipid: "脂质" }, rules: [] },
    site: { attrs: [], block: "", proseGuard: true }
  });
  engine.start();
  const out = dom.window.document.body.textContent;
  assert.match(out, /碳水化合物/);
  assert.match(out, /能量/);
});

test("文件名里的默认文字（el.value 赋值，无 value 属性）能翻", () => {
  const { doc } = run('<input id="q" type="search">');
  const el = doc.querySelector("#q");
  el.value = "Contact Us";
  const engine = createEngine({
    document: doc,
    window: doc.defaultView,
    data: DICT,
    site: { attrs: ["value"], block: "", proseGuard: true, valueText: true }
  });
  engine.start();
  assert.equal(el.value, "联系我们");
  engine.restore();
  assert.equal(el.value, "Contact Us");
});
