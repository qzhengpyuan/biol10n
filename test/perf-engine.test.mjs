// 引擎性能基准：不是"必须跑多快"的硬指标，而是防止扫描退化到"网页卡死几秒"。
// 2000 行 × 6 单元格的合成表格（约 3.6 万元素 / 3.4 万文本节点）上：
//   优化前 start 约 3300 ms、重扫约 1200 ms；
//   现在约 930 / 350 ms（-72% / -71%）。
// 重复内容页（2000 行 × 10 单元格，同一批词反复出现）：
//   优化前 first 约 2300 ms、重扫约 540 ms；现在约 550 / 175 ms。
// 上限按 3–4 倍余量给（慢机器/CI 抖动不会误报），超过说明出现了 O(n²) 之类的回退。
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

function makeEngine(html) {
  const dom = new JSDOM(html, { url: "https://docs.gdc.cancer.gov/Data/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: data(),
    site: { scope: "body", block: "pre, code", rescan: false, attrs: ["title", "alt", "placeholder", "aria-label"] }
  });
  return { dom, engine };
}

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

function repHtml(rows) {
  const keys = ["Data Category", "File Name", "Project ID", "Open", "Search", "Download", "Sample Type", "Submit", "Analyze", "Documentation"];
  let html = "<table><tbody>";
  for (let i = 0; i < rows; i++) {
    html += "<tr>" + keys.map((k) => "<td><span>" + k + "</span></td>").join("") + "</tr>";
  }
  return html + "</tbody></table>";
}

test("引擎性能：3.6 万节点的表格首扫与重扫不退化", () => {
  const { dom, engine } = makeEngine(pageHtml(2000));
  const t0 = Date.now();
  engine.start();
  const first = Date.now() - t0;
  const elCount = dom.window.document.querySelectorAll("*").length;
  assert.ok(elCount > 25000, "合成页元素数不足：" + elCount);
  assert.ok(engine.stats.hitExact > 100, "首扫命中数异常：" + engine.stats.hitExact);

  const t1 = Date.now();
  engine.scan();
  const second = Date.now() - t1;

  // 只报数字，方便对照历史；上限留 3–4 倍余量
  console.log("perf: elements=" + elCount + " first=" + first + "ms rescan=" + second + "ms");
  assert.ok(first < 4000, "首扫耗时退化：" + first + "ms");
  assert.ok(second < 1500, "重扫耗时退化：" + second + "ms");
});

test("引擎性能：重复内容的大页面（同一批词 2 万次）不退化", () => {
  const { dom, engine } = makeEngine(repHtml(2000));
  const t0 = Date.now();
  engine.start();
  const first = Date.now() - t0;
  const elCount = dom.window.document.querySelectorAll("*").length;
  assert.ok(elCount > 40000, "合成页元素数不足：" + elCount);
  assert.ok(engine.stats.hitExact > 5000, "重复内容命中数异常：" + engine.stats.hitExact);

  const t1 = Date.now();
  engine.scan();
  const second = Date.now() - t1;

  console.log("perf-rep: elements=" + elCount + " first=" + first + "ms rescan=" + second + "ms");
  assert.ok(first < 3000, "首扫耗时退化：" + first + "ms");
  assert.ok(second < 1200, "重扫耗时退化：" + second + "ms");
});
// 首扫分片（scanBudgetMs）：同样的大表上，start() 的同步阻塞应降到预算附近，
// 而最终覆盖率必须与不分片完全一致（分片只改节奏，不改结果）。
test("分片首扫：同步阻塞降到预算附近，最终覆盖与不分片一致", async () => {
  const html = repHtml(2000);
  const plain = makeEngine(html);
  plain.engine.start();
  const fullHits = plain.engine.stats.hitExact;
  plain.dom.window.close();

  const dom = new JSDOM(html, { url: "https://docs.gdc.cancer.gov/Data/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: data(),
    site: { scope: "body", block: "pre, code", rescan: false, attrs: ["title", "alt", "placeholder", "aria-label"] },
    scanBudgetMs: 120
  });
  const t0 = Date.now();
  engine.start();
  const first = Date.now() - t0;
  console.log("perf-slice: first=" + first + "ms backlog=" + engine.stats.backlog);
  assert.ok(first < 600, "分片首扫同步阻塞过长：" + first + "ms");
  assert.ok(engine.stats.backlog > 0, "大表首扫应留下 backlog");
  const t1 = Date.now();
  while (engine.stats.backlog > 0 && Date.now() - t1 < 30000) await new Promise((r) => setTimeout(r, 50));
  assert.equal(engine.stats.backlog, 0, "backlog 未在 30s 内补完");
  assert.equal(engine.stats.hitExact, fullHits, "分片后的最终命中数应与不分片一致");
  dom.window.close();
});
