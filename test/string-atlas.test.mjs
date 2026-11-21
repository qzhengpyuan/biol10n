// STRING (string-db.org) / EMBL-EBI Expression Atlas (ebi.ac.uk/gxa) 骨架词库（string-atlas）回归：
// 结构、关键条目、规则行为、模板占位与 3 个真实 DOM 片段的 jsdom 渲染用例
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

const dict = read("string-atlas.json");
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;
const SITE = { scope: "body", block: "pre, code", rescan: false };

// 站点真实词库栈：common + string-atlas
function siteData() {
  const books = ["common.json", "string-atlas.json"];
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

function boot(html, url) {
  const dom = new JSDOM(html, { url: url || "https://string-db.org/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: siteData(),
    site: SITE
  });
  engine.start();
  return { dom, engine, doc: dom.window.document };
}

test("词库结构：两个站点、exact 数百、规则与模板齐备、字段规整", () => {
  assert.deepEqual(dict.meta.sites, ["string-db.org", "www.ebi.ac.uk"]);
  const exact = Object.entries(dict.exact || {});
  assert.ok(exact.length >= 400, "exact 条目太少: " + exact.length);
  assert.ok((dict.rules || []).length >= 15, "规则太少: " + (dict.rules || []).length);
  assert.ok((dict.templates || []).length >= 25, "模板太少: " + (dict.templates || []).length);
  const bad = [];
  for (const [en, zh] of exact) {
    if (!en || en !== en.trim()) bad.push("键首尾空白: " + JSON.stringify(en));
    if (/\s\s/.test(en)) bad.push("键含连续空白（normalize 后会失配）: " + JSON.stringify(en));
    if (CJK.test(en)) bad.push("键含中文: " + en);
    if (!zh || zh !== zh.trim()) bad.push("空译文: " + en);
    if (!CJK.test(zh)) bad.push("译文无中文: " + en);
    if (en === zh) bad.push("自映射: " + en);
    if (/https?:\/\/|www\.|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(zh)) bad.push("译文含 URL/邮箱: " + en);
  }
  assert.deepEqual(bad, []);
});

test("规则：正则锚定、译文有中文、$n 不超出捕获组，且不抢 common 的通用数字规则", () => {
  const bad = [];
  for (const r of dict.rules || []) {
    if (!r.re || !r.to) { bad.push("缺字段: " + JSON.stringify(r)); continue; }
    let re;
    try { re = new RegExp(r.re); } catch (e) { bad.push("正则非法: " + r.re); continue; }
    if (!/^\^/.test(r.re)) bad.push("规则未以 ^ 锚定: " + r.re);
    if (!/\$$/.test(r.re)) bad.push("规则未以 $ 锚定: " + r.re);
    if (!CJK.test(r.to)) bad.push("规则译文无中文: " + r.re);
    if (/https?:\/\/|www\./.test(r.to)) bad.push("规则译文含 URL: " + r.re);
    const slotNums = [...r.to.matchAll(/\$(\d)/g)].map((m) => Number(m[1]));
    const groupCount = (re.source.match(/\((?!\?)/g) || []).length;
    if (groupCount === 0) bad.push("规则没有捕获组: " + r.re);
    for (const n of slotNums) if (n > groupCount) bad.push("占位符超出捕获组: " + r.re);
  }
  assert.deepEqual(bad, []);
});

test("模板：pat 长度合规、占位符编号连续、−与译文槽位对齐", () => {
  const bad = [];
  for (const t of dict.templates || []) {
    if (!t.pat || !t.zh) { bad.push("缺字段: " + JSON.stringify(t).slice(0, 60)); continue; }
    if (t.pat.length < 20 || t.pat.length > 2200) bad.push("pat 长度不合规: " + t.pat.length + " " + t.pat.slice(0, 40));
    if (!CJK.test(t.zh)) bad.push("模板译文无中文: " + t.pat.slice(0, 40));
    const slots = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    const n = slots.length;
    if (n < 1) bad.push("模板无槽位: " + t.pat.slice(0, 40));
    const uniq = [...new Set(slots)].sort((a, b) => a - b);
    if (uniq.join(",") !== Array.from({ length: n }, (_, i) => i + 1).join(",")) bad.push("占位符编号不连续: " + t.pat.slice(0, 40));
    const zhSlots = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    const zhUniq = [...new Set(zhSlots)].sort((a, b) => a - b);
    if (zhUniq.join(",") !== uniq.join(",")) bad.push("译文槽位与 pat 不一致: " + t.pat.slice(0, 40));
    if (/\{\{[^}]*\}\}/.test(t.zh.replace(/\{\{\d+\}\}/g, ""))) bad.push("译文有非法占位: " + t.zh);
  }
  assert.deepEqual(bad, []);
});

test("关键条目：STRING 表单/结果页与 GXA 首页/列表/下载页骨架", () => {
  const cases = {
    "Protein by name": "按名称查蛋白质",
    "Multiple proteins": "多个蛋白质",
    "Proteins by sequences": "按序列查蛋白质",
    "Protein Name:": "蛋白质名：",
    "Welcome to STRING": "欢迎使用 STRING",
    "Experiment Design": "实验设计",
    "Legend": "图例",
    "Viewers": "视图",
    "Evidence": "证据",
    "Browse experiments": "浏览实验",
    "Featured experiments": "精选实验",
    "Entries per page:": "每页条目数：",
    "jump to page": "跳转到页",
    "rows per page": "每页行数",
    "Choose genome browser": "选择基因组浏览器",
    "Any": "任意"
  };
  const { engine } = boot("<body></body>");
  for (const [en, zh] of Object.entries(cases)) {
    assert.equal(engine.translateText(en), zh, "未命中: " + en);
  }
});

test("规则行为：计数/分页/排序/服务器负载等动态串", () => {
  const { engine } = boot("<body></body>");
  const cases = [
    ["page 1 of 3", "第 1 页，共 3 页"],
    ["all 11 proteins", "全部 11 个蛋白质"],
    ["Other names: H. sapiens, human, man", "其他名称：H. sapiens, human, man"],
    ["low (12%)", "低（12%）"],
    ["medium (55%)", "中（55%）"],
    ["high (98%)", "高（98%）"],
    ["Showing 10 results from a total of 4562 experiments (page 1 of 457).", "显示 10 条结果，共 4562 个实验（第 1 页，共 457 页）。"],
    ["Selected: 17 / 43", "已选：17 / 43"],
    ["Showing 34 of 2,589 genes found:", "共找到 2,589 个基因，显示其中 34 个："],
    ["Baseline: 1,234", "基线：1,234"],
    ["Differential: 345", "差异：345"],
    ["5 rows", "5 行"],
    ["Protein Nam\u200ce:", "蛋白名："],
    ["TP53: highlight it and its interactions", "TP53：高亮它及其相互作用"],
    ["AURKA: highlight its interaction with TP53", "AURKA：高亮其与 TP53 的相互作用"],
    ["12 mio", "12 百万"],
    ["5 bln", "5 十亿"],
    ["> 3.2 bln", ">3.2 十亿"]
  ];
  for (const [en, zh] of cases) {
    assert.equal(engine.translateText(en), zh, "规则未命中: " + en);
  }
  // 不能抢 common 的通用数字规则：20 per page 由 common 处理，本册不参与
  assert.equal(engine.translateText("20 per page"), "每页 20 条");
});

test("jsdom：STRING 首页 hero（含 <br> 槽位）、示例链接、ELIXIR 认定句", () => {
  const { doc } = boot(
    '<body>' +
      '<h2>Protein-Protein Interaction Networks<br>Functional Enrichment Analysis</h2>' +
      '<span class="example_small">(examples:&nbsp;&nbsp;<a href="#">#1</a>&nbsp;&nbsp;<a href="#">#2</a>&nbsp;&nbsp;<a href="#">#3</a>)</span>' +
      '<div class="elixir_cdr_message">STRING is a Core Data Resource as designated by ' +
      '<a href="https://globalbiodata.org/">Global Biodata Coalition</a> and ' +
      '<a href="https://www.elixir-europe.org/">ELIXIR</a>.</div>' +
      "</body>",
    "https://string-db.org/"
  );
  const h2 = doc.querySelector("h2");
  assert.equal(h2.textContent, "蛋白质-蛋白质相互作用网络功能富集分析");
  assert.ok(h2.querySelector("br"), "<br> 应保留");
  const ex = doc.querySelector(".example_small");
  assert.equal(ex.textContent, "（示例：#1 #2 #3）");
  assert.equal(ex.querySelectorAll("a").length, 3);
  const cdr = doc.querySelector(".elixir_cdr_message");
  assert.equal(cdr.textContent, "STRING 是由Global Biodata Coalition和ELIXIR认定的核心数据资源。");
  assert.equal(cdr.querySelectorAll("a").length, 2);
});

test("jsdom：GXA 列表页统计句 + 分页 aria + cookie 声明句", () => {
  const { doc } = boot(
    '<body>' +
      '<div class="small-6 columns padding-top-medium">Showing 10 results from a total of 4562 experiments (page 1 of 457).</div>' +
      '<button aria-label="jump to page" title="rows per page">x</button>' +
      '<div id="data-protection-banner"><div class="columns">This website requires cookies, and the limited processing ' +
      "of your personal data in order to function. By using the site you are agreeing to this as outlined in our " +
      '<a href="https://www.ebi.ac.uk/data-protection/privacy-notice/embl-ebi-public-website">Privacy Notice</a> and ' +
      '<a href="https://www.ebi.ac.uk/about/terms-of-use">Terms of Use</a>.</div></div>' +
      "</body>",
    "https://www.ebi.ac.uk/gxa/experiments"
  );
  assert.equal(
    doc.querySelector(".small-6").textContent,
    "显示 10 条结果，共 4562 个实验（第 1 页，共 457 页）。"
  );
  const btn = doc.querySelector("button");
  assert.equal(btn.getAttribute("aria-label"), "跳转到页");
  assert.equal(btn.getAttribute("title"), "每页行数");
  const banner = doc.querySelector("#data-protection-banner .columns");
  assert.equal(
    banner.textContent,
    "本网站需要使用 Cookie 并对您的个人数据做有限处理才能运行。使用本网站即表示您同意我们隐私声明和使用条款中所述的做法。"
  );
  assert.equal(banner.querySelectorAll("a").length, 2);
});

test("jsdom：GXA 实验结果页基因计数 + Selected 计数 + 下载按钮 aria", () => {
  const { doc } = boot(
    '<body>' +
      '<div style="display:inline-block;width:30%">Showing 34 of 2,589 genes found:</div>' +
      '<div>Selected: 17 / 43</div>' +
      '<button aria-label="Download" role="button"><span class="caret"></span></button>' +
      "</body>",
    "https://www.ebi.ac.uk/gxa/experiments/E-MTAB-4045/Results"
  );
  const cells = [...doc.querySelectorAll("div")].map((d) => d.textContent.trim());
  assert.ok(cells.includes("共找到 2,589 个基因，显示其中 34 个："), "基因计数句未译");
  assert.ok(cells.includes("已选：17 / 43"), "Selected 句未译");
  assert.equal(doc.querySelector("button").getAttribute("aria-label"), "下载");
});
