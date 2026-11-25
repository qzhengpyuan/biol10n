// JASPAR 词库（jaspar）回归：结构、规范、关键条目、规则、模板与引擎行为
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, "../dict", f), "utf8"));

const dict = read("jaspar.json");
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;
const SITE = { scope: "body", spa: true };

// 站点真实词库栈：common + spa + jaspar（boot 按 dicts 顺序合并，后者覆盖前者）
function siteData() {
  const books = ["common.json", "spa.json", "jaspar.json"];
  const exact = {}, rules = [], templates = [];
  for (const f of books) {
    if (!fs.existsSync(path.join(root, "../dict", f))) continue;
    const d = read(f);
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
    templates.push(...(d.templates || []));
  }
  return { exact, rules, templates };
}

function boot(html) {
  const dom = new JSDOM(html, { url: "https://jaspar.elixir.no/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: siteData(),
    site: SITE
  });
  engine.start();
  return { dom, engine, doc: dom.window.document };
}

test("词库结构：exact 三百余、规则与模板齐备、站点声明覆盖新旧两个主机", () => {
  const exact = Object.entries(dict.exact || {});
  assert.ok(exact.length >= 330, "exact 条目太少: " + exact.length);
  assert.ok((dict.rules || []).length >= 10, "规则太少: " + (dict.rules || []).length);
  assert.ok((dict.templates || []).length >= 30, "模板太少: " + (dict.templates || []).length);
  assert.equal(dict.meta.family, "jaspar");
  for (const h of ["jaspar.genereg.net", "jaspar.elixir.no"]) {
    assert.ok(dict.meta.sites.includes(h), "缺主机声明: " + h);
  }
});

test("exact：键无中文、无首尾空白，译文有中文、无自映射、无 URL/邮箱", () => {
  const bad = [];
  for (const [en, zh] of Object.entries(dict.exact || {})) {
    if (!en || en !== en.trim()) bad.push("键首尾空白: " + JSON.stringify(en));
    if (CJK.test(en)) bad.push("键含中文: " + en);
    if (!zh || zh !== String(zh).trim()) bad.push("空译文或首尾空白: " + en);
    if (!CJK.test(zh)) bad.push("译文无中文: " + en);
    if (en === zh) bad.push("自映射: " + en);
    if (/https?:\/\/|www\.|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(zh)) bad.push("译文含 URL/邮箱: " + en);
  }
  assert.deepEqual(bad, []);
});

test("rules：锚定、正则合法、译文有中文、$n 不超捕获组", () => {
  const bad = [];
  for (const r of dict.rules || []) {
    if (!r.re || !r.to) { bad.push("缺字段: " + JSON.stringify(r)); continue; }
    let re;
    try { re = new RegExp(r.re); } catch (e) { bad.push("正则非法: " + r.re); continue; }
    if (!/^\^/.test(r.re) || !/\$$/.test(r.re)) bad.push("未锚定: " + r.re);
    if (!CJK.test(r.to)) bad.push("规则译文无中文: " + r.re);
    if (/https?:\/\/|www\./.test(r.to)) bad.push("规则译文含 URL: " + r.re);
    const groupCount = (re.source.match(/\((?!\?)/g) || []).length;
    for (const m of r.to.matchAll(/\$(\d)/g)) if (Number(m[1]) > groupCount) bad.push("占位符超出捕获组: " + r.re);
  }
  assert.deepEqual(bad, []);
});

test("templates：pat 长度与空白规范、占位符编号连续且与译文一致、pat 无中文", () => {
  const bad = [];
  for (const t of dict.templates || []) {
    if (!t.pat || !t.zh) { bad.push("缺字段: " + JSON.stringify(t).slice(0, 60)); continue; }
    if (t.pat.length < 20 || t.pat.length > 2200) bad.push("pat 长度不合规: " + t.pat.length);
    if (t.pat !== t.pat.replace(/\s+/g, " ").trim()) bad.push("pat 空白不规范: " + t.pat.slice(0, 40));
    if (CJK.test(t.pat)) bad.push("pat 含中文: " + t.pat.slice(0, 40));
    if (!CJK.test(t.zh)) bad.push("模板译文无中文: " + t.pat.slice(0, 40));
    const slots = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    const used = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    if (!slots.length) { bad.push("pat 无占位符: " + t.pat.slice(0, 40)); continue; }
    if (slots.join(",") !== slots.map((_, i) => i + 1).join(",")) bad.push("pat 编号不连续: " + t.pat.slice(0, 40));
    if (used.slice().sort((a, b) => a - b).join(",") !== slots.map((_, i) => i + 1).join(",")) bad.push("译文占位符不匹配: " + t.pat.slice(0, 40));
  }
  assert.deepEqual(bad, []);
});

test("关键条目：侧栏/顶栏、矩阵页字段、下载页 tab 都命中", () => {
  const cases = [
    ["Download Data", "下载数据"],
    ["Browse JASPAR CORE", "浏览 JASPAR CORE"],
    ["Search by profile", "按配置文件检索"],
    ["Unvalidated Profiles", "未验证配置文件"],
    ["External tools", "外部工具"],
    ["FAQ", "常见问题"],
    ["Documentation", "文档"],
    ["Add to cart", "加入购物车"],
    ["Matrix ID:", "矩阵 ID："],
    ["Sequence logo", "序列标识图"],
    ["Binding sites information", "结合位点信息"],
    ["Frequency matrix", "频率矩阵"],
    ["When should it be used?", "何时使用？"],
    ["Download JASPAR data", "下载 JASPAR 数据"],
    ["Individual PFMs (zip)", "单个 PFM（zip）"],
    ["Single batch file (txt)", "单一批量文件（txt）"],
    ["Radial tree [zip]", "径向树 [zip]"],
    ["Clustering summary [zip]", "聚类摘要 [zip]"],
    ["Vertebrates", "脊椎动物"],
    ["Fungi", "真菌"]
  ];
  for (const [en, zh] of cases) assert.equal(dict.exact[en], zh, "缺条目: " + en);
  // 交互词由 common 册提供，断言合并后的站点词库栈
  assert.equal(siteData().exact.Download, "下载", "合并词库缺 Download");
});

test("引擎：界面骨架整节点替换，TF 名/矩阵 ID/物种拉丁名保持英文", () => {
  const { doc } = boot(
    "<div><button>Download Data</button><a>Browse JASPAR CORE</a><span>Add to cart</span>" +
      "<span>Arnt</span><span>MA0004.1</span><span>Mus musculus</span><span>JASPAR CORE</span></div>"
  );
  const t = [...doc.querySelectorAll("div > *")].map((e) => e.textContent);
  assert.equal(t[0], "下载数据");
  assert.equal(t[1], "浏览 JASPAR CORE");
  assert.equal(t[2], "加入购物车");
  assert.equal(t[3], "Arnt");
  assert.equal(t[4], "MA0004.1");
  assert.equal(t[5], "Mus musculus");
  assert.equal(t[6], "JASPAR CORE");
});

test("引擎：计数规则把购物车与总数规范化，数字不丢", () => {
  const { doc } = boot(
    "<div><p>You have 3 profile(s) in cart.</p><p>You have 1 profile(s) in your cart.</p>" +
      "<p>Total 4572 profiles</p></div>"
  );
  const p = doc.querySelectorAll("p");
  assert.equal(p[0].textContent, "购物车中有 3 个配置文件。");
  assert.equal(p[1].textContent, "购物车中有 1 个配置文件。");
  assert.equal(p[2].textContent, "共 4572 个配置文件");
});

test("引擎：新闻日期「15 May. 2017」整节点翻成中文日期", () => {
  const { doc } = boot("<div><p>15 May. 2017</p><p>2 February 2026</p></div>");
  const p = doc.querySelectorAll("p");
  assert.equal(p[0].textContent, "2017 年 5 月 15 日");
  assert.equal(p[1].textContent, "2026 年 2 月 2 日");
});

test("引擎：矩阵页 H1 与「profile(s) found / 分页」模板整句翻出，内联元素保留", () => {
  const { doc } = boot(
    "<div><h1>Detailed information of matrix profile <b>MA0004.1</b></h1>" +
      "<p><b>4 </b> profile(s) found</p>" +
      "<span>Showing <b>10 </b> profiles of page <b>1</b> from <b>458</b> pages</span></div>"
  );
  const h1 = doc.querySelector("h1");
  assert.equal(h1.textContent, "矩阵配置文件 MA0004.1 的详细信息");
  assert.equal(h1.querySelector("b").textContent, "MA0004.1", "内联 <b> 被模板丢掉");
  const found = doc.querySelector("p");
  assert.equal(found.textContent, "找到 4 个配置文件");
  assert.equal(found.querySelector("b").textContent, "4 ");
  const span = doc.querySelector("div > span");
  assert.ok(/显示第 1 页的 10 个配置文件，共 458 页/.test(span.textContent), "分页模板未命中: " + span.textContent);
  assert.equal(span.querySelectorAll("b").length, 3, "分页模板的 <b> 数量变了");
});

test("引擎：下载页「Download PFM data in the X collection.」模板整句翻出", () => {
  const { doc } = boot("<div><p>Download PFM data in the <b>CORE</b> collection.</p></div>");
  const p = doc.querySelector("p");
  assert.equal(p.textContent, "下载 CORE 合集中的 PFM 数据。");
  assert.equal(p.querySelector("b").textContent, "CORE");
});

test("引擎：长英文正文里的界面单词不单独翻（避免半中半英）", () => {
  const { doc } = boot(
    "<div><p>This page explains how the Tools panel works together with the History panel " +
      "when you run an analysis and then want to share the results with collaborators across the world.</p></div>"
  );
  const p = doc.querySelector("p");
  assert.ok(!CJK.test(p.textContent), "长正文被逐词翻了: " + p.textContent);
});

test("引擎：disable 后原文原样回来", () => {
  const { doc, engine } = boot("<div><button>Download Data</button><p><b>4 </b> profile(s) found</p></div>");
  assert.equal(doc.querySelector("button").textContent, "下载数据");
  engine.disable();
  assert.equal(doc.querySelector("button").textContent, "Download Data");
  assert.equal(doc.querySelector("p").textContent, "4  profile(s) found");
});
