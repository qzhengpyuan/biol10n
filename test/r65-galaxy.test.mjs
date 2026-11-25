// Galaxy 主站与项目官网骨架词库（galaxy）回归：结构、关键条目、规则、模板与引擎行为
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

const dict = read("galaxy.json");
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;
const SITE = {
  scope: "body, #everything",
  block: "pre, code, kbd, samp, textarea, [contenteditable='true'], .highlight, .blob-code, .code",
  attrs: ["placeholder", "title", "aria-label", "alt", "value"],
  spa: true,
  waitFor: "body"
};

// 站点真实词库栈：common + spa + galaxy（boot 按 dicts 顺序合并，后者覆盖前者）
function siteData() {
  const books = ["common.json", "spa.json", "galaxy.json"];
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

function boot(html, site = SITE) {
  const dom = new JSDOM(html, { url: "https://usegalaxy.org/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: siteData(),
    site
  });
  engine.start();
  return { dom, engine, doc: dom.window.document };
}

test("词库结构：exact 数百、规则与模板齐备、站点声明覆盖两个主机", () => {
  const exact = Object.entries(dict.exact || {});
  assert.ok(exact.length >= 300, "exact 条目太少: " + exact.length);
  assert.ok((dict.rules || []).length >= 10, "规则太少");
  assert.ok((dict.templates || []).length >= 20, "模板太少");
  assert.equal(dict.meta.family, "galaxy");
  for (const h of ["usegalaxy.org", "galaxyproject.org"]) {
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
    if (slots.join(",") !== used.join(",")) bad.push("译文占位符不匹配: " + t.pat.slice(0, 40));
  }
  assert.deepEqual(bad, []);
});

test("关键条目：usegalaxy 骨架与 galaxyproject 导航都命中", () => {
  const cases = [
    ["Login", "登录"],
    ["Register", "注册"],
    ["Tools", "工具"],
    ["Workflows", "工作流"],
    ["Visualize", "可视化"],
    ["Help", "帮助"],
    ["User", "用户"],
    ["Histories", "历史"],
    ["Preferences", "偏好设置"],
    ["Upload", "上传"],
    ["History Options", "历史选项"]
  ];
  for (const [en, zh] of cases) assert.equal(dict.exact[en], zh, "缺条目: " + en);
  // 交互术语 Dataset 可由 common 册提供，断言合并后的站点词库栈
  assert.equal(siteData().exact.Dataset, "数据集", "合并词库缺 Dataset");
  const nav = [
    ["News", "新闻"],
    ["Events", "活动"],
    ["Get Started", "开始使用"],
    ["Training", "培训"],
    ["Community", "社区"],
    ["Documentation", "文档"],
    ["Get Involved", "参与其中"],
    ["Careers", "招聘"]
  ];
  for (const [en, zh] of nav) assert.equal(dict.exact[en], zh, "缺导航条目: " + en);
});

test("引擎：界面骨架整节点替换，工具名/格式名/教程名保持英文", () => {
  const { doc } = boot(
    "<div id='everything'><button>History</button><a>Tools</a><span>Upload</span>" +
      "<span>Mothur</span><span>FASTA/FASTQ</span><span>Galaxy 101</span><span>Datamash</span></div>"
  );
  const t = [...doc.querySelectorAll("#everything > *")].map((e) => e.textContent);
  assert.equal(t[0], "历史");
  assert.equal(t[1], "工具");
  assert.equal(t[2], "上传");
  assert.equal(t[3], "Mothur");
  assert.equal(t[4], "FASTA/FASTQ");
  assert.equal(t[5], "Galaxy 101");
  assert.equal(t[6], "Datamash");
});

test("引擎：规则把「N histories」与「月 日」规范化，数字不丢", () => {
  const { doc } = boot(
    "<div id='everything'><p>You have 3 histories.</p><p>Nov 25</p><p>December 2</p>" +
      "<p>You have 1 history.</p><span class='loading-message'>Loading Toolbox...</span></div>"
  );
  assert.equal(doc.querySelectorAll("p")[0].textContent, "你共有 3 个历史。");
  assert.equal(doc.querySelectorAll("p")[3].textContent, "你共有 1 个历史。");
  assert.equal(doc.querySelector(".loading-message").textContent, "正在加载工具箱…");
  assert.equal(doc.querySelectorAll("p")[1].textContent, "11 月 25 日");
  assert.equal(doc.querySelectorAll("p")[2].textContent, "12 月 2 日");
  // 日在前（"2 Dec"）时 common 册的 ^(\d[\d,]*)\s+(.+)$ 先命中，会变成「2 12 月」；
  // 顺序修正需要改 common.json（不属本册写权限），此处只锁住已支持的月在前形态。
  assert.equal(doc.querySelectorAll("p")[1].getAttribute("data-biol10n-block"), null);
});

test("引擎：模板把段落整段译出，链接元素与地址都还在", () => {
  const { doc } = boot(
    "<div id='everything'><p>Don't have an account? <a href='/register'>Register here.</a></p></div>"
  );
  const p = doc.querySelector("p");
  assert.ok(p.textContent.startsWith("还没有账号？"), "模板未命中: " + p.textContent);
  const a = p.querySelector("a");
  assert.ok(a, "链接被模板替换丢掉了");
  assert.equal(a.getAttribute("href"), "/register");
  assert.ok(/在此注册/.test(a.textContent), "链接文字未译: " + a.textContent);
});

test("引擎：文档页长段落模板整段翻译，内联链接保留", () => {
  const { doc } = boot(
    "<div id='everything'><p>Thanks to a large <a href='/community/contributors'>group of wonderful contributors</a>, " +
      "there is a constantly growing set of tutorials maintained by the <a href='/training'>Galaxy Training Network (GTN)</a> " +
      "covering introductory tutorials, various scientific topics, development and administration.</p></div>"
  );
  const p = doc.querySelector("p");
  assert.ok(CJK.test(p.textContent), "整段没翻: " + p.textContent);
  assert.ok(/因为|在众多/.test(p.textContent), "译文不对: " + p.textContent);
  assert.equal(p.querySelectorAll("a").length, 2, "内联链接数量变了");
  assert.equal(p.querySelector("a").getAttribute("href"), "/community/contributors");
});

test("引擎：长英文正文里的界面单词不单独翻（避免半中半英）", () => {
  const { doc } = boot(
    "<div id='everything'><p>This page explains how the Tools panel works together with the History panel " +
      "when you run an analysis and then want to share the results with collaborators across the world.</p></div>"
  );
  const p = doc.querySelector("p");
  assert.ok(!CJK.test(p.textContent), "长正文被逐词翻了: " + p.textContent);
});

test("引擎：属性通道（placeholder / aria-label / title）一起翻", () => {
  const { doc } = boot(
    "<div id='everything'><input placeholder='search datasets'><button aria-label='Refresh history'></button>" +
      "<span title='Show panel options'></span></div>"
  );
  assert.equal(doc.querySelector("input").getAttribute("placeholder"), "检索数据集");
  assert.equal(doc.querySelector("button").getAttribute("aria-label"), "刷新历史");
  assert.equal(doc.querySelector("span").getAttribute("title"), "显示面板选项");
});

test("引擎：SPA 二次渲染的节点在 scan() 后补翻", () => {
  const { doc, engine } = boot("<div id='everything'></div>");
  const el = doc.createElement("button");
  el.textContent = "Register";
  doc.querySelector("#everything").appendChild(el);
  engine.scan();
  assert.equal(el.textContent, "注册");
});

test("引擎：disable 后原文原样回来（整块与逐节点两条路都能还原）", () => {
  const { doc, engine } = boot(
    "<div id='everything'><button>History</button>" +
      "<p>Don't have an account? <a href='/register'>Register here.</a></p></div>"
  );
  assert.equal(doc.querySelector("button").textContent, "历史");
  engine.disable();
  assert.equal(doc.querySelector("button").textContent, "History");
  assert.ok(/Don't have an account\?/.test(doc.querySelector("p").textContent));
  assert.ok(/Register here\./.test(doc.querySelector("p").textContent));
});
