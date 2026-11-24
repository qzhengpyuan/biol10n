// r32 报告收口：AlphaFold www 变体、HPA 两句 <br /> 染色说明、Cloudflare 质询页不翻、build-meta 新鲜度字段。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const sites = read("../config/sites.json").sites;
const hpa = read("../dict/hpa.json");
const common = read("../dict/common.json");
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const bootSrc = fs.readFileSync(path.join(root, "../src/boot.js"), "utf8");

const SENT1 = "Multiplex immunofluorescence staining of FCAMR in kidney shows microvilli localization in proximal tubules.";
const SENT2 = "Immunohistochemical staining of PAX8, located to the nucleus of the follicular cells of the thyroid gland.";

function hpaEngine() {
  const dom = new JSDOM("<body></body>", { url: "https://www.proteinatlas.org/ENSG00000107404" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: {
      exact: Object.assign({}, common.exact, hpa.exact),
      rules: [...(common.rules || []), ...(hpa.rules || [])],
      templates: [...(common.templates || []), ...(hpa.templates || [])]
    },
    site: { scope: "body", funcWords: true }
  });
  engine.start();
  return engine;
}

test("r32 T4-1：AlphaFold 的 www 变体已进 hosts", () => {
  const af = sites.find((s) => s.id === "alphafold");
  assert.ok(af, "缺 alphafold 站点");
  assert.deepEqual(af.hosts, ["alphafold.ebi.ac.uk", "www.alphafold.ebi.ac.uk"]);
});

test("r32 P2-1：HPA 两句带 <br /> 的染色说明能整句翻", () => {
  const engine = hpaEngine();
  assert.equal(engine.translateText(SENT1), "FCAMR 在肾脏的多重免疫荧光染色显示微绒毛定位于近端小管。");
  assert.equal(engine.translateText(SENT2), "PAX8 的免疫组化染色定位于甲状腺滤泡细胞的细胞核。");
  // 既有规则不能被新条目顶掉
  assert.equal(
    engine.translateText("Immunohistochemical staining of TP53 in breast cancer."),
    "乳腺癌中 TP53 的免疫组化染色"
  );
});

test("r32 P2-1 引擎：<br> 属性先试整串，再逐段（HPA 的句子被 <br /> 从中间切开）", () => {
  const dom = new JSDOM('<body><div id="t" title="' + SENT1.replace(" shows", "<br /> shows") + '"></div></body>', {
    url: "https://www.proteinatlas.org/ENSG00000107404"
  });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: {
      exact: Object.assign({}, common.exact, hpa.exact),
      rules: [...(common.rules || []), ...(hpa.rules || [])],
      templates: []
    },
    site: { scope: "body", attrs: ["title"], funcWords: true }
  });
  engine.start();
  const el = dom.window.document.getElementById("t");
  assert.equal(el.getAttribute("title"), "FCAMR 在肾脏的多重免疫荧光染色显示微绒毛定位于近端小管。");
});

test("r32 P2-2：Cloudflare 质询页在启动处就退出，不注入引擎", () => {
  assert.match(bootSrc, /function isChallengePage\(\)/, "缺 isChallengePage");
  assert.match(bootSrc, /if \(isChallengePage\(\)\) return;/, "isChallengePage 没有在启动处生效");
  for (const s of ["Ray ID", "cf-challenge-running", "#challenge-form", "请稍候", "Just a moment"]) {
    assert.ok(bootSrc.includes(s), "守护条件缺 " + s);
  }
});

test("r32 T1-2：build-meta 带 dictCount / dictMtimeMax", () => {
  const meta = read("../dist/build-meta.json");
  assert.equal(typeof meta.dictCount, "number");
  assert.equal(typeof meta.dictMtimeMax, "string");
  assert.match(meta.dictMtimeMax, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(meta.dictCount >= 90, "册数不对: " + meta.dictCount);
});
