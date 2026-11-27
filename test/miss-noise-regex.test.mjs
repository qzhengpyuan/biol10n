// missNoise 正则条目：「re:」开头的站级噪音名单条目按正则匹配，普通条目仍是子串匹配。
// 目的：登录号、基因组坐标、测序平台名这类取值枚举不完，用形状（正则）覆盖，命令行漏翻清单才不会
// 被上千条 ID 淹没；同时保证写坏的正则不会把整页漏翻收集搞崩。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const uiSrc = fs.readFileSync(path.join(root, "../src/ui.js"), "utf8");
const cfg = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8"));

function boot(html) {
  const dom = new JSDOM(html, { url: "https://www.uniprot.org/uniprotkb/P04637/entry" });
  global.window = dom.window;
  global.document = dom.window.document;
  const factory = new Function(uiSrc + "; return { createBioL10nUI };")();
  return { factory, doc: dom.window.document, win: dom.window };
}

function collect(html, missNoise) {
  const { factory, win } = boot(html);
  try {
    const ui = factory.createBioL10nUI({ site: { id: "x", name: "X", missNoise }, dicts: [], version: "0.16.7" });
    return ui.collectMisses().map((x) => x.t);
  } finally { win.close(); }
}

const PAGE = "<main><p>P04637</p><p>Getting Started</p><p>BWA with BQSR</p></main>";

test("re: 条目按正则过滤，普通条目仍按子串过滤", () => {
  const texts = collect(PAGE, ["re:^P[0-9]{5}$", "BWA"]);
  assert.deepEqual(texts, ["Getting Started"]);
});

test("写坏的正则被跳过，不抛错也不误滤", () => {
  const texts = collect(PAGE, ["re:(", "re:^P[0-9]{5}$"]);
  assert.ok(!texts.includes("P04637"), "正常条目照常生效");
  assert.ok(texts.includes("Getting Started"));
  assert.ok(texts.includes("BWA with BQSR"), "坏正则不影响其他条目");
});

test("正则不自动锚定：加了 ^ $ 只吃纯 ID，不加就按子串吃", () => {
  const page = "<main><p>P04637</p><p>P04637 entry page overview</p></main>";
  const loose = collect(page, ["re:P[0-9]{5}"]);
  assert.deepEqual(loose, [], "不锚定时会连整句一起吃掉");
  const tight = collect(page, ["re:^P[0-9]{5}$"]);
  assert.deepEqual(tight, ["P04637 entry page overview"], "锚定后只吃纯 ID");
});

test("命令行工具与页面面板用同一套语义", () => {
  const toolSrc = fs.readFileSync(path.join(root, "../tools/miss-report.mjs"), "utf8");
  assert.match(toolSrc, /slice\(0, 3\)/, "工具也认 re: 前缀");
  assert.match(toolSrc, /new RegExp\(n\.slice\(3\)/, "工具也把条目当正则编译");
  assert.match(toolSrc, /includes\(r\.sub\)/, "普通条目仍是子串匹配");
});

test("配置里的名单条目都能用：正则可编译、普通条目不是通用界面词", () => {
  const uiWords = ["data", "tool", "search", "query", "download", "summary", "new", "all", "view", "help", "submit", "result"];
  const sites = (cfg.sites || []).filter((s) => Array.isArray(s.missNoise) && s.missNoise.length);
  assert.ok(sites.length >= 10, "至少 10 个站点有站级名单，实际 " + sites.length);
  for (const site of sites) {
    assert.equal(new Set(site.missNoise).size, site.missNoise.length, site.id + " 名单有重复条目");
    for (const raw of site.missNoise) {
      assert.equal(typeof raw, "string");
      const n = raw.trim();
      assert.ok(n.length >= 3, site.id + " 的条目太短: " + JSON.stringify(raw));
      if (n.slice(0, 3).toLowerCase() === "re:") {
        assert.doesNotThrow(() => new RegExp(n.slice(3)), site.id + " 的正则写坏了: " + n);
      } else {
        assert.ok(!uiWords.includes(n.toLowerCase()), site.id + " 不该把通用界面词放进名单: " + n);
      }
    }
  }
});

test("本轮覆盖的站点都装上了名单", () => {
  const want = ["uniprot", "ncbi-snp", "pubchem", "cellxgene", "hpa", "cbioportal", "clinicaltrials", "ucsc", "ncbi-blast"];
  for (const id of want) {
    const site = (cfg.sites || []).find((s) => s.id === id);
    assert.ok(site, "缺站点 " + id);
    assert.ok(Array.isArray(site.missNoise) && site.missNoise.length >= 2, id + " 没有站级名单");
  }
});
