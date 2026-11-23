// r25 属性通道补词（gdc / interpro / ucsc）：只覆盖本次新增的界面固定文案。
// 断言口径：translateText(原串) 必须返回登记译文；未登记串必须返回 null（防误伤）。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();

function load(...names) {
  const exact = {};
  const rules = [];
  const templates = [];
  for (const n of names) {
    const d = JSON.parse(fs.readFileSync(path.join(root, "../dict/" + n + ".json"), "utf8"));
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
    templates.push(...(d.templates || []));
  }
  return { exact, rules, templates };
}

function boot(data) {
  const dom = new JSDOM("<p>x</p>", { url: "https://example.org/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data,
    site: { scope: "", block: "pre, code", attrs: ["placeholder", "title", "aria-label"], rescan: [] }
  });
  engine.start();
  return { engine, dom };
}

const cases = {
  gdc: {
    dicts: ["common", "onco", "spa", "gdc", "gdc2"],
    entries: {
      "GDC Docs": "GDC 文档",
      "GDC Data Submission Portal": "GDC 数据提交门户",
      "GDC Publications": "GDC 论文",
      "GDC Collaborations": "GDC 合作",
      "GDC Data Dictionary": "GDC 数据字典",
      "GDC Reference Files": "GDC 参考文件",
      "GDC Data Quality": "GDC 数据质量",
      "GDC Component Library": "GDC 组件库",
      "Request Data Submission": "申请数据提交",
      "Data Types and File Formats": "数据类型与文件格式",
      "Data Standards": "数据标准",
      "Enter the terms you wish to search for.": "输入要检索的词。",
      "(opens in a new window)": "（在新窗口中打开）",
      "(link is external)": "（外部链接）",
      "(link sends email)": "（邮件链接）",
      "Site header": "站点页头",
      "Official government website": "美国政府官方网站",
      "Genomic Data Commons Homepage": "基因组数据共享平台首页",
      "main navigation": "主导航",
      "Subscribe to RSS Feed for In the News": "订阅「新闻动态」的 RSS 源"
    }
  },
  interpro: {
    dicts: ["common", "spa", "interpro"],
    entries: {
      "link to external site": "外部站点链接",
      "Give this job a local title (only visible on this browser)": "为这个作业起一个本地标题（仅在本浏览器可见）"
    }
  },
  ucsc: {
    dicts: ["common", "anatomy", "spa", "ucsc", "ucsc-extra", "ucsc-tpl", "ucsc-vai", "ucsc-hggene"],
    entries: {
      "List all possible keyboard shortcuts": "列出所有可用的键盘快捷键"
    }
  }
};

test("r25 新增词条逐条命中，且译文含汉字", () => {
  for (const [site, spec] of Object.entries(cases)) {
    const data = load(...spec.dicts);
    const { engine } = boot(data);
    for (const [srcText, want] of Object.entries(spec.entries)) {
      assert.equal(data.exact[srcText], want, site + " 词库缺条目：" + srcText);
      assert.equal(engine.translateText(srcText), want, site + " 未命中：" + srcText);
      assert.match(want, /[\u4e00-\u9fff]/, site + " 译文不含汉字：" + srcText);
    }
  }
});

test("英文原文保持可逆：同站未登记串不翻", () => {
  for (const spec of Object.values(cases)) {
    const { engine } = boot(load(...spec.dicts));
    // 负例要求"任何册里都没有这个键"：DocBotchatbot 已在 r35 收进 interpro 册，换成仍未登记的串
    for (const s of ["AddToAny Utility Frame", "GENCODE V50"]) {
      if (s in spec.entries) continue;
      assert.equal(engine.translateText(s), null, "不该命中：" + s);
    }
  }
});

test("gdc-docs 站点注入后，aria-label / title / placeholder 全部命中", () => {
  const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
  const site = sites.find((s) => s.id === "gdc-docs");
  assert.ok(site, "config/sites.json 缺 gdc-docs 站点");
  assert.ok(site.hosts.includes("gdc.cancer.gov"), "gdc-docs 必须覆盖 gdc.cancer.gov");
  assert.ok(site.dicts.includes("gdc"), "gdc-docs 必须加载 gdc 册");

  const dom = new JSDOM(
    '<a id="a" aria-label="main navigation" title="GDC Docs"></a>' +
      '<header id="h" aria-label="Site header"></header>' +
      '<input id="c" title="Enter the terms you wish to search for.">',
    { url: "https://gdc.cancer.gov/" }
  );
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: load(...site.dicts),
    site
  });
  engine.start();
  const doc = dom.window.document;
  assert.equal(doc.getElementById("a").getAttribute("aria-label"), "主导航");
  assert.equal(doc.getElementById("a").getAttribute("title"), "GDC 文档");
  assert.equal(doc.getElementById("h").getAttribute("aria-label"), "站点页头");
  assert.equal(doc.getElementById("c").getAttribute("title"), "输入要检索的词。");
});

test("ucsc / interpro 的 aria-label 与 placeholder 在 start 后变中文", () => {
  const dom = new JSDOM(
    '<span id="b" title="List all possible keyboard shortcuts"></span>' +
      '<a id="d" aria-label="link to external site"></a>' +
      '<input id="c" placeholder="Give this job a local title (only visible on this browser)">',
    { url: "https://example.org/" }
  );
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: load("common", "ucsc", "interpro"),
    site: { scope: "", block: "pre, code", attrs: ["placeholder", "title", "aria-label"], rescan: [] }
  });
  engine.start();
  const doc = dom.window.document;
  assert.equal(doc.getElementById("b").getAttribute("title"), "列出所有可用的键盘快捷键");
  assert.equal(doc.getElementById("d").getAttribute("aria-label"), "外部站点链接");
  assert.equal(
    doc.getElementById("c").getAttribute("placeholder"),
    "为这个作业起一个本地标题（仅在本浏览器可见）"
  );
});

test("跨册同键同值：Site header 与 pdbe 册一致", () => {
  const gdc = JSON.parse(fs.readFileSync(path.join(root, "../dict/gdc.json"), "utf8"));
  const pdbe = JSON.parse(fs.readFileSync(path.join(root, "../dict/pdbe.json"), "utf8"));
  assert.equal(gdc.exact["Site header"], pdbe.exact["Site header"]);
});
