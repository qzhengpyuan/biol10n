// r28：HPA 单细胞页（/humanproteome/single+cell）SVG tooltip 补词 + 标题前缀。
// 页面原文（probe 于 2026-11-23）：<g title="Myonuclei c-0<br>Reliability: High<br>19.1 nCPM<br>Cell count: 1912">
// 引擎对含字面 <br> 的 title 走 translateBrAttr：按段翻、用「 · 」连接；数值随数据变化，走规则。
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
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, "../dict", f + ".json"), "utf8"));

const site = sites.find((s) => s.id === "hpa");
assert.ok(site, "config/sites.json 里应有 hpa 站点");
const hpa = read("hpa");

// 生产上按 sites.json 的 dicts 顺序叠词库，规则命中顺序与线上一致。
// 只解析一次：每个用例都重建一遍 6 册词库会让本文件跑成十几秒。
const HPA_DATA = (() => {
  const exact = {}, rules = [];
  for (const book of site.dicts) {
    const d = read(book);
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
  }
  return { exact, rules };
})();

function boot(html, title) {
  const dom = new JSDOM(html, { url: "https://www.proteinatlas.org/humanproteome/single+cell" });
  if (title) dom.window.document.title = title;
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: HPA_DATA,
    site
  });
  engine.start();
  return { engine, doc: dom.window.document };
}

// ---------------- 词库结构 ----------------

test("hpa 词库 meta 仍指向 proteinatlas.org", () => {
  assert.equal(hpa.meta.family, "hpa");
  assert.deepEqual(hpa.meta.sites, ["proteinatlas.org"]);
  assert.ok(Array.isArray(hpa.rules));
});

test("r28 新增 exact 词条存在且为中文", () => {
  const want = {
    "The human cell proteome": "人类细胞蛋白质组",
    "Cell count": "细胞数",
    "Reliability: High": "可靠性：高",
    "Reliability: Medium": "可靠性：中",
    "Reliability: Low": "可靠性：低"
  };
  for (const [k, v] of Object.entries(want)) {
    assert.equal(hpa.exact[k], v, "缺词条或译法变了: " + k);
    assert.match(v, /[\u4e00-\u9fff]/, "译文必须含汉字: " + k);
  }
});

test("r28 新增规则已锚定、可编译、re 不含中文", () => {
  const added = hpa.rules.filter(
    (r) => r.re === "^(.+) c-(\\d+)$" || r.re === "^Cell count: ([\\d,]+)$"
  );
  assert.equal(added.length, 2, "应有两个新规则");
  for (const r of added) {
    assert.match(r.re, /^\^/, "规则必须锚定句首: " + r.re);
    assert.match(r.re, /\$$/, "规则必须锚定句尾: " + r.re);
    assert.doesNotMatch(r.re, /[\u4e00-\u9fff]/, "re 里不能有中文: " + r.re);
    assert.ok(r.to, "规则必须有 to: " + r.re);
    assert.doesNotThrow(() => new RegExp(r.re), "规则必须能编译: " + r.re);
  }
  const cc = added.find((r) => r.re.startsWith("^Cell count"));
  const cluster = added.find((r) => r.re.startsWith("^(.+) c-"));
  assert.match(cc.to, /[\u4e00-\u9fff]/, "Cell count 规则的 to 必须是中文模板");
  assert.equal(cluster.requireHit, true, "细胞类型 c-N 规则必须 requireHit，未知类型不得硬拼");
  // 数值段只认数字：别把 "Cell count: many" 这类说明句吞进规则
  assert.equal(new RegExp(cc.re).test("Cell count: many"), false);
  assert.equal(new RegExp(cc.re).test("Cell count: 1912"), true);
});

// ---------------- 引擎行为：SVG tooltip ----------------

test("单细胞页原文 tooltip：四段全翻，用「 · 」连接，数值与 nCPM 原样保留", () => {
  const title = "Myonuclei c-0<br>Reliability: High<br>19.1 nCPM<br>Cell count: 1912";
  const { doc } = boot(
    '<svg><g id="g" title="' + title + '"></g><text id="t" aria-label="' + title + '"></text></svg>'
  );
  const want = "肌核 c-0 · 可靠性：高 · 19.1 nCPM · 细胞数：1912";
  // 页面同一份 tooltip 同时挂在 <g title> 与 <text aria-label> 上，两条属性通道都要覆盖
  assert.equal(doc.getElementById("g").getAttribute("title"), want);
  assert.equal(doc.getElementById("t").getAttribute("aria-label"), want);
});

test("Cell count / nCPM 数值随数据变化（规则而非整串词条）", () => {
  const cases = [
    ["Myonuclei c-7", "Reliability: High", "7125.8", "884",
      "肌核 c-7 · 可靠性：高 · 7125.8 nCPM · 细胞数：884"],
    ["Mast cells c-27", "Reliability: Low", "0.0", "0",
      "肥大细胞 c-27 · 可靠性：低 · 0.0 nCPM · 细胞数：0"],
    ["NK-cells c-26", "Reliability: Medium", "35.2", "15",
      "NK 细胞 c-26 · 可靠性：中 · 35.2 nCPM · 细胞数：15"]
  ];
  const html = cases
    .map((c, i) => '<g id="g' + i + '" title="' + c[0] + "<br>" + c[1] + "<br>" + c[2] + " nCPM<br>Cell count: " + c[3] + '"></g>')
    .join("");
  const { doc } = boot("<svg>" + html + "</svg>");
  cases.forEach((c, i) => {
    assert.equal(doc.getElementById("g" + i).getAttribute("title"), c[4]);
  });
});

test("词表里没有的细胞类型保留英文，其余段落照翻（不回退整条）", () => {
  const title = "Zzzunknown cells c-3<br>Reliability: Medium<br>2.0 nCPM<br>Cell count: 12";
  const { doc } = boot('<svg><g id="g" title="' + title + '"></g></svg>');
  assert.equal(
    doc.getElementById("g").getAttribute("title"),
    "Zzzunknown cells c-3 · 可靠性：中 · 2.0 nCPM · 细胞数：12"
  );
});

test("只有 Reliability 与 Cell count 两段的短 tooltip 也能整段拼出中文", () => {
  const { doc } = boot('<svg><g id="g" title="Reliability: Low<br>Cell count: 7"></g></svg>');
  assert.equal(doc.getElementById("g").getAttribute("title"), "可靠性：低 · 细胞数：7");
});

test("Reliability 未知取值不硬拼（宁可留英文）", () => {
  const { doc } = boot('<svg><g id="g" title="Reliability: Uncertain<br>Cell count: 7"></g></svg>');
  const out = doc.getElementById("g").getAttribute("title");
  assert.match(out, /Reliability: Uncertain/, "未知枚举值保持英文");
  assert.match(out, /细胞数：7/, "同一条里的可翻段仍要翻");
});

test("重复扫描幂等：译文不会被二次处理", () => {
  const { doc, engine } = boot('<svg><g id="g" title="Myonuclei c-1<br>Reliability: High<br>40.3 nCPM<br>Cell count: 1584"></g></svg>');
  const first = doc.getElementById("g").getAttribute("title");
  engine.scan();
  assert.equal(doc.getElementById("g").getAttribute("title"), first);
  assert.equal(first, "肌核 c-1 · 可靠性：高 · 40.3 nCPM · 细胞数：1584");
});

// ---------------- 引擎行为：标题前缀 ----------------

test("标题前缀补全：The human cell proteome → 人类细胞蛋白质组", () => {
  const { doc, engine } = boot("<p>x</p>", "The human cell proteome - The Human Protein Atlas");
  assert.equal(doc.title, "人类细胞蛋白质组 - 人类蛋白质图谱");
  assert.ok(engine.stats.titleHit >= 1, "标题应记一次命中");
});