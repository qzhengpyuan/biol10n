// 第三批站级不翻名单（0.17.1）：NCBI GEO 的登录号/物种/机构地址、timer2 的基因符号与数据集标签、
// miRBase 的分类树；同时把「站级 skip 也要管漏翻清单」这条补上，并给正则条目加大小写敏感前缀 rec:。
// 注意 ui.collectMisses 只收「带空格的短句」（单个 ASCII 词按 ID/文件名挡掉），所以面板层的断言用多词串。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const uiSrc = fs.readFileSync(path.join(root, "../src/ui.js"), "utf8");
const cfg = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8"));
const site = (id) => cfg.sites.find((s) => s.id === id);

function collect(html, siteCfg, url = "https://example.org/") {
  const dom = new JSDOM(html, { url });
  const prevWin = global.window, prevDoc = global.document;
  global.window = dom.window;
  global.document = dom.window.document;
  try {
    const factory = new Function(uiSrc + "; return { createBioL10nUI };")();
    const ui = factory.createBioL10nUI({
      site: {
        id: siteCfg.id, name: siteCfg.name || siteCfg.id,
        missNoise: siteCfg.missNoise || [],
        skip: siteCfg.skip || "", skipFree: siteCfg.skipFree || []
      },
      dicts: [], version: "0.17.1"
    });
    return ui.collectMisses().map((x) => x.t);
  } finally {
    global.window = prevWin;
    global.document = prevDoc;
    dom.window.close();
  }
}

const has = (list, s) => list.some((x) => x === s);

test("rec: 是大小写敏感正则，re: 仍不敏感", () => {
  const page = "<main><p>Search Gene</p><p>search gene</p></main>";
  const cs = collect(page, { id: "x", missNoise: ["rec:^Search Gene$"] });
  assert.ok(!has(cs, "Search Gene"), "rec: 命中同大小写的串");
  assert.ok(has(cs, "search gene"), "rec: 不吃大小写不同的串");

  const ci = collect(page, { id: "x", missNoise: ["re:^Search Gene$"] });
  assert.deepEqual(ci, [], "re: 大小写不敏感，两条都被滤掉");
});

test("timer2 的基因符号/克隆号用 rec: 写成大小写敏感，不会吃掉界面词", () => {
  const rules = (site("timer2").missNoise || []).filter((x) => x.startsWith("rec:")).map((x) => new RegExp(x.slice(4)));
  assert.ok(rules.length >= 5, "timer2 应有若干大小写敏感正则");
  const hit = (s) => rules.some((r) => r.test(s));
  for (const s of ["TP53", "A1BG-AS1", "AC000003.1", "ABC7-42391500H16.2", "Melanoma_Nathanson_2017", "5S_rRNA"]) {
    assert.ok(hit(s), "应命中：" + s);
  }
  for (const s of ["Search", "Download", "Cancer Type", "Purity", "Immune Infiltration"]) {
    assert.ok(!hit(s), "界面词不该命中：" + s);
  }
});

test("NCBI GEO：物种、机构地址、库名类多词串不进清单，界面词照旧", () => {
  const html = "<main>" +
    "<p>Homo sapiens</p><p>Mus musculus</p><p>8600 Rockville Pike</p><p>Bethesda, MD 20894</p>" +
    "<p>PubChem BioAssay</p><p>Identical Protein Groups</p>" +
    "<p>Add to Clipboard</p><p>Download data: TXT</p><p>Gene expression</p><p>Sample Type</p>" +
    "</main>";
  const out = collect(html, site("ncbi-geo"));
  for (const s of ["Homo sapiens", "Mus musculus", "8600 Rockville Pike", "Bethesda, MD 20894", "PubChem BioAssay"]) {
    assert.ok(!has(out, s), "应被名单滤掉：" + s);
  }
  for (const s of ["Add to Clipboard", "Download data: TXT", "Gene expression", "Sample Type"]) {
    assert.ok(has(out, s), "界面词不该被滤：" + s);
  }
});

test("站级 skip 也管漏翻清单：跳过区块内的文字不列，skipFree 例外照列", () => {
  const html = "<main>" +
    "<ul><li class=\"node\"><span>Metazoa clade</span></li>" +
    "<li class=\"end_node\"><a href=\"?organism=x\">Homo sapiens</a></li></ul>" +
    "<p>Search Gene</p>" +
    "</main>";
  const out = collect(html, { id: "x", skip: "li.node, li.end_node" });
  assert.ok(!has(out, "Metazoa clade"), "skip 区块内不列");
  assert.ok(!has(out, "Homo sapiens"), "skip 区块的子元素同样不列");
  assert.ok(has(out, "Search Gene"), "区块外照常列");

  const freed = collect(
    "<main><li class=\"node\"><span>Metazoa clade</span><span class=\"free\">Search Gene</span></li></main>",
    { id: "x", skip: "li.node", skipFree: ["span.free"] }
  );
  assert.ok(has(freed, "Search Gene"), "skipFree 里的元素照列");
});

test("miRBase 的分类树整块跳过（li.node / li.end_node）", () => {
  const mb = site("mirbase");
  assert.match(mb.skip, /li\.node/);
  assert.match(mb.skip, /li\.end_node/);
});

test("命令行工具与面板口径一致：site.skip / valueText / rec:", () => {
  const toolSrc = fs.readFileSync(path.join(root, "../tools/miss-report.mjs"), "utf8");
  assert.match(toolSrc, /__L10N_SITE_SKIP/, "把站级 skip 传进页面");
  assert.match(toolSrc, /inSiteSkip/, "采集时按 skip 排除");
  assert.match(toolSrc, /siteValueText/, "value 只在按钮或 valueText 站点采集");
  assert.match(toolSrc, /slice\(0, 4\)/, "认 rec: 前缀");
  assert.match(toolSrc, /r\.cs \? raw : s/, "rec: 用原串比、re: 用小写串比");
});
