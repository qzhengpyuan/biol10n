// r49：handleSplitText 的整句 exact 上限由 120 放到 400
// 背景：ClinVar 帮助页把一句话用 <b>/<i> 切成 2–3 段，拼平后 120–300 字符；
// 只要人工核对过的整句在词库里，就应该拼平替换（规则通道仍限 120，避免长正文靠规则拼出半中半英）。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();

const SENT =
  "The data in ClinVar's web site are updated weekly, on Mondays. The comprehensive data extractions occur weekly, so that data on the web is in sync with data downloaded as XML.";
const CN = "ClinVar 网站上的数据每周一更新。全面数据提取每周进行，因此网页上的数据与以 XML 下载的数据保持同步。";

const data = { exact: { [SENT]: CN }, rules: [], templates: [] };

function boot(html) {
  const dom = new JSDOM(html, { url: "https://www.ncbi.nlm.nih.gov/clinvar/docs/maintenance_use/" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site: { id: "t", dicts: [] } });
  engine.start();
  return { doc: dom.window.document, engine };
}

test("拼平后 180 字符、被 <b> 切开的整句命中 exact 时整块替换", () => {
  const { doc } = boot(
    "<div><p>The data in ClinVar's web site are updated weekly, on Mondays. The <b>comprehensive data extractions</b> occur weekly, so that data on the web is in sync with data downloaded as XML.</p></div>"
  );
  const p = doc.querySelector("p");
  assert.equal(p.textContent, CN);
  assert.equal(p.querySelectorAll("b").length, 0, "整块替换后不再保留内联标签");
});

test("同长度但 exact 未收录时仍整句留英文", () => {
  const en = SENT.replace("weekly, on Mondays", "weekly, on Tuesdays");
  const { doc } = boot("<div><p>" + en.replace("comprehensive data extractions", "<b>comprehensive data extractions</b>") + "</p></div>");
  assert.equal(doc.querySelector("p").textContent, en);
});

test("超过 400 字符的拼平文本一律不拼（长度闸）", () => {
  const long = SENT + " " + "Extra sentence padding here to exceed the cap. ".repeat(4);
  const { doc } = boot("<div><p>" + long + "</p></div>");
  assert.equal(doc.querySelector("p").textContent.trim(), long.trim());
});
