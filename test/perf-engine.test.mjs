// 引擎性能基准：不是"必须跑多快"的硬指标，而是防止扫描退化到"网页卡死几秒"。
// 2000 行 × 6 单元格的合成表格（约 3.6 万元素 / 3.4 万文本节点）上，
// 优化前 start 约 3300 ms、重扫约 1200 ms；现在分别约 2400 / 850。
// 上限按 2 倍余量给（慢机器/CI 抖动不会误报），超过说明有 O(n²) 之类的回退。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, "../dict", f + ".json"), "utf8"));

const BOOKS = ["common", "ncbi", "ncbi-help", "gdc", "gdc-docs"];
const data = () => {
  const exact = {}, rules = [], templates = [];
  for (const f of BOOKS) {
    if (!fs.existsSync(path.join(root, "../dict", f + ".json"))) continue;
    const d = read(f);
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
    templates.push(...(d.templates || []));
  }
  return { exact, rules, templates };
};

function pageHtml(rows) {
  let html = "<table><thead><tr><th>File Name</th><th>Data Category</th><th>Data Type</th><th>Project ID</th><th>File Size</th><th>Access</th></tr></thead><tbody>";
  for (let i = 0; i < rows; i++) {
    html +=
      "<tr><td><span>file_" + i + ".vcf.gz</span></td><td><span>Simple Nucleotide Variation</span></td>" +
      "<td><span>Annotated Somatic Mutation</span></td><td><span>TCGA-AB-1234</span></td>" +
      "<td><span>1." + (i % 9) + " MB</span></td><td><span>Open</span></td></tr>";
  }
  return html + "</tbody></table>";
}

test("引擎性能：3.6 万节点的表格首扫与重扫不退化", () => {
  const rows = 2000;
  const dom = new JSDOM(pageHtml(rows), { url: "https://docs.gdc.cancer.gov/Data/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: data(),
    site: { scope: "body", block: "pre, code", rescan: false, attrs: ["title", "alt", "placeholder", "aria-label"] }
  });

  const t0 = Date.now();
  engine.start();
  const first = Date.now() - t0;
  const elCount = dom.window.document.querySelectorAll("*").length;
  assert.ok(elCount > 25000, "合成页元素数不足：" + elCount);
  assert.ok(engine.stats.hitExact > 100, "首扫命中数异常：" + engine.stats.hitExact);

  const t1 = Date.now();
  engine.scan();
  const second = Date.now() - t1;

  // 只报数字，方便对照历史；上限留 2 倍余量
  console.log("perf: elements=" + elCount + " first=" + first + "ms rescan=" + second + "ms");
  assert.ok(first < 7000, "首扫耗时退化：" + first + "ms");
  assert.ok(second < 2500, "重扫耗时退化：" + second + "ms");
});
