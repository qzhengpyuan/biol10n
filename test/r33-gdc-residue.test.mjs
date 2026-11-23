// r33 GDC 文档站残留收尾（检查方 r30 P2-1）：dict/gdc-docs.json
// 实测来源（2026-11-24，CDP 9227，页面已装扩展、关闭汉化后读原始英文 DOM）：
//   https://gdc.cancer.gov/developers
//     · FAQ 标题 <h3>How long do GDC authentication tokens remain valid?</h3>
//     · FAQ 答句 <p>GDC <a title="Auth Token GDC">authentication tokens</a> remain valid for 30 days.</p>
//     · 顶栏 GDC Apps 折叠项 <a title="API"><span class="icon"/><p>API</p></a>
//     · 页脚 APPLICATIONS 菜单 <a class="menu__link">API</a>
//       这两处「API」按 r29 的品牌缩写口径**不翻**（通用缩写，且只作菜单/页脚标签），
//       记入残留清单而不是给 exact；下面的用例锁住这个决定。
//     · 全站 lightbox：<img class="lb-image" alt="lightbox image">
//   https://gdc.cancer.gov/developers/gdc-application-programming-interface-api（同上导航/页脚）
//   https://gdc.cancer.gov/support（mega menu + lightbox 同源）
//   https://gdc.cancer.gov/about-gdc
//     · <li>Obtain an <a href="/about-gdc/gdc-overview">overview of the GDC and explore GDC 2.0</a></li>
//     · <li>Discover the evolution of the GDC in the <a>Genomic Data Commons Podcast</a>
//       in the <a>NCI Personal Genomics Podcast Series</a></li>
//   https://gdc.cancer.gov/content/i-logged-gdc-portal-yesterday-why-can-i-not-login-gdc-portal-today
//     · 该 FAQ 的 <h1> 与 /developers FAQ 列表共用同一条问句
// 断言口径：exact 用 translateText 逐条比对；带内联元素的答句走模板通道，并检查 href 未变；
// 编号/版本串必须返回 null。
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
const cfg = sites.find((s) => s.id === "gdc-docs");
const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/gdc-docs.json"), "utf8"));
const CJK = /[\u4e00-\u9fff]/;

// 与运行时一致：按站点配置的 dicts 顺序合并（common → gdc-docs → …）
function load() {
  const exact = {}, rules = [], templates = [];
  for (const n of cfg.dicts) {
    const d = JSON.parse(fs.readFileSync(path.join(root, "../dict/" + n + ".json"), "utf8"));
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
    templates.push(...(d.templates || []));
  }
  return { exact, rules, templates };
}
const data = load();

const NEW_KEYS = {
  "GDC and SI": "GDC 与超级智能（SI）",
  "Auth Token GDC": "GDC 认证令牌",
  "authentication tokens": "认证令牌",
  "lightbox image": "灯箱图片",
  "How long do GDC authentication tokens remain valid?": "GDC 认证令牌的有效期是多久？",
  "I logged into the GDC Portal yesterday, why can I not login to the GDC Portal today?": "我昨天登录了 GDC 门户，为什么今天无法登录 GDC 门户？",
  "Obtain an": "获取",
  "overview of the GDC and explore GDC 2.0": "GDC 概览并探索 GDC 2.0",
  "Genomic Data Commons Podcast": "基因组数据共享平台播客",
  "NCI Personal Genomics Podcast Series": "NCI 个人基因组学播客系列"
};

function boot(html, url = "https://gdc.cancer.gov/developers") {
  const dom = new JSDOM("<body>" + html + "</body>", { url });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site: cfg });
  engine.start();
  return { engine, doc: dom.window.document };
}

// ---------------- 结构与词库 ----------------

test("gdc-docs 词库：r33 新增条目就位，计数不回退", () => {
  assert.equal(book.meta.family, "gdc");
  assert.deepEqual(book.meta.sites, ["gdc.cancer.gov"]);
  assert.ok(cfg.dicts.includes("gdc-docs"), "gdc-docs 应加载本册");
  assert.ok(Object.keys(book.exact).length >= 415, "exact 条数不足（r33 后应 ≥415）");
  assert.ok(book.templates.length >= 72, "模板条数不足（r33 后应 ≥72）");
  // r34 为 a[title="email <地址>"] 加了一条 ^email (\S+@\S+)$ 规则（地址留在 $1，词条值不许含邮箱）
  assert.ok(book.rules.length >= 7, "规则条数不应回退");
  for (const [k, v] of Object.entries(NEW_KEYS)) assert.equal(book.exact[k], v, "缺条目或译法不一致：" + k);
});

test("gdc-docs 词库：新增键无自映射、值含中文、键无中文", () => {
  for (const [k, v] of Object.entries(NEW_KEYS)) {
    assert.ok(!CJK.test(k), "键含中文：" + k);
    assert.ok(CJK.test(v), "值不含中文：" + v);
    assert.notEqual(k, v, "自映射：" + k);
    assert.equal(v.trim(), v, "值有首尾空白：" + k);
  }
});

test("FAQ 答句模板：占位符 1..N 对齐，pat 唯一", () => {
  const pat = "GDC {{1}} remain valid for 30 days.";
  const hits = book.templates.filter((t) => t.pat === pat);
  assert.equal(hits.length, 1, "模板应只出现一次");
  assert.equal(hits[0].zh, "GDC {{1}}的有效期为 30 天。");
  const nums = (s) => (s.match(/\{\{(\d+)\}\}/g) || []).map((x) => Number(x.replace(/\D/g, "")));
  assert.deepEqual(nums(hits[0].pat), [1]);
  assert.deepEqual(nums(hits[0].zh), [1]);
});

// ---------------- 逐条词条 ----------------

test("两条 FAQ 问句：列表 h3 与内容页 h1 共用同一条词条", () => {
  const { engine } = boot("<p>x</p>");
  assert.equal(
    engine.translateText("How long do GDC authentication tokens remain valid?"),
    "GDC 认证令牌的有效期是多久？"
  );
  assert.equal(
    engine.translateText("I logged into the GDC Portal yesterday, why can I not login to the GDC Portal today?"),
    "我昨天登录了 GDC 门户，为什么今天无法登录 GDC 门户？"
  );
  const { doc } = boot(
    '<h3><span class="field-content">How long do GDC authentication tokens remain valid?</span></h3>' +
      "<h1>I logged into the GDC Portal yesterday, why can I not login to the GDC Portal today?</h1>"
  );
  assert.equal(doc.querySelector("h3").textContent, "GDC 认证令牌的有效期是多久？");
  assert.equal(doc.querySelector("h1").textContent, "我昨天登录了 GDC 门户，为什么今天无法登录 GDC 门户？");
});

test("顶栏 mega menu：GDC and SI 命中且链接目标不变", () => {
  const { doc } = boot(
    '<div class="tbm-link-container"><ul class="tbm-subnav level-2 items-5">' +
      '<li class="tbm-item level-3"><a href="https://gdc.cancer.gov/content/gdc-and-super-intelligence-si" class="tbm-link level-3"> GDC and SI </a></li>' +
      "</ul></div>"
  );
  const a = doc.querySelector("a.tbm-link");
  assert.equal(a.textContent, " GDC 与超级智能（SI） ");
  assert.equal(a.getAttribute("href"), "https://gdc.cancer.gov/content/gdc-and-super-intelligence-si");
});

test("lightbox：img alt 与同组导航标签全部中文", () => {
  const { doc } = boot(
    '<div id="lightbox" class="lightbox" style="display: none;"><div class="lb-outerContainer"><div class="lb-container">' +
      '<img class="lb-image" alt="lightbox image" src="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==">' +
      '<div class="lb-nav"><a class="lb-prev" href="">Previous</a><a class="lb-next" href="">next</a></div>' +
      '<div class="lb-loader"><a class="lb-cancel">cancel</a></div></div></div>' +
      '<div class="lb-dataContainer"><div class="lb-data"><div class="lb-closeContainer"><a class="lb-close">close</a></div></div></div></div>'
  );
  assert.equal(doc.querySelector("img.lb-image").getAttribute("alt"), "灯箱图片");
  assert.deepEqual(
    [...doc.querySelectorAll(".lb-prev, .lb-next, .lb-cancel, .lb-close")].map((a) => a.textContent),
    ["上一页", "下一页", "取消", "关闭"]
  );
});

test("Auth Token GDC：链接的 title 属性翻中文，锚文本与 href 不动", () => {
  const { doc } = boot(
    '<div class="views-field views-field-body"><div class="field-content">' +
      '<p>GDC <a href="https://docs.gdc.cancer.gov/Data/Data_Security/Data_Security/#token-expiration" title="Auth Token GDC">authentication tokens</a> remain valid for 30 days.</p>' +
      "</div></div>"
  );
  const a = doc.querySelector("p a");
  assert.equal(a.getAttribute("title"), "GDC 认证令牌");
  assert.equal(a.getAttribute("href"), "https://docs.gdc.cancer.gov/Data/Data_Security/Data_Security/#token-expiration");
  assert.equal(doc.querySelector("p").textContent, "GDC 认证令牌的有效期为 30 天。");
});

test("独立 API：按品牌缩写口径保持英文（残留，不设词条）", () => {
  const { engine, doc } = boot(
    '<a id="app" href="/developers/gdc-application-programming-interface-api" title="API" target="_blank">' +
      '<span class="icon icon-gdc-portal-api"></span><p>API</p></a>' +
      '<nav id="block-gdc-foundation-gdcfooterapplications"><h2 class="block-title">APPLICATIONS</h2>' +
      '<ul class="menu menu--level-1"><li class="menu__item menu__item--link menu__item--level-1">' +
      '<a class="menu__link menu__link--link menu__link--level-1" href="/developers/gdc-application-programming-interface-api">API</a></li></ul></nav>'
  );
  assert.equal(engine.translateText("API"), null, "API 是通用缩写，不设 exact");
  const app = doc.getElementById("app");
  assert.equal(app.querySelector("p").textContent, "API");
  assert.equal(app.getAttribute("title"), "API");
  assert.equal(app.getAttribute("href"), "/developers/gdc-application-programming-interface-api");
  const foot = doc.querySelector("nav .menu__link");
  assert.equal(foot.textContent, "API");
  assert.equal(foot.getAttribute("href"), "/developers/gdc-application-programming-interface-api");
});

test("about-gdc：Obtain an + 链接文本拼成完整中文，链接目标不变", () => {
  const { doc } = boot(
    '<ul class="more"><li id="l1">Obtain an <a href="/about-gdc/gdc-overview">overview of the GDC and explore GDC 2.0</a></li></ul>',
    "https://gdc.cancer.gov/about-gdc"
  );
  const li = doc.getElementById("l1");
  assert.equal(li.textContent, "获取 GDC 概览并探索 GDC 2.0");
  assert.equal(li.querySelector("a").getAttribute("href"), "/about-gdc/gdc-overview");
});

test("about-gdc 播客句：模板语序重排 + 两个槽位链接文本变中文", () => {
  const { doc } = boot(
    '<ul class="more"><li id="l2">Discover the evolution of the GDC in the ' +
      '<a href="https://www.cancer.gov/ccg/blog/personal-genomics-podcast/genomic-data-commons">Genomic Data Commons Podcast</a>' +
      " in the " +
      '<a href="https://www.cancer.gov/ccg/blog/personal-genomics-podcast">NCI Personal Genomics Podcast Series</a></li></ul>',
    "https://gdc.cancer.gov/about-gdc"
  );
  const li = doc.getElementById("l2");
  assert.equal(li.textContent, "在 NCI 个人基因组学播客系列的基因组数据共享平台播客中了解 GDC 的发展历程");
  const links = [...li.querySelectorAll("a")];
  assert.equal(links.length, 2, "链接不能丢");
  assert.deepEqual(links.map((a) => a.textContent), ["NCI 个人基因组学播客系列", "基因组数据共享平台播客"]);
  assert.deepEqual(links.map((a) => a.getAttribute("href")), [
    "https://www.cancer.gov/ccg/blog/personal-genomics-podcast",
    "https://www.cancer.gov/ccg/blog/personal-genomics-podcast/genomic-data-commons"
  ]);
});

// ---------------- 不该翻的东西 ----------------

test("数据串与专名：编号、版本、裸词不翻译", () => {
  const { engine } = boot("<p>x</p>");
  for (const s of ["API", "API v1", "GDC API", "TCGA-02-0001", "lightbox", "GDC 2.0", "Auth Token"]) {
    assert.equal(engine.translateText(s), null, "不该命中：" + s);
  }
});
