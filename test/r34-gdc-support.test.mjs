// r34 GDC /support 页残留补词：帮助台两句、订阅提示前缀、GDC 数据门户简介模板，
// 以及处理/批准/开发者工具/文档图标/YouTube 教程/应用 alt/email 前缀等属性残片。
// 原文全部取自 gdc.cancer.gov/support 真实渲染 DOM（0.10.39 实测），断言口径与既有 r* 测试一致：
// exact 逐条命中且含汉字；模板用真实段落 HTML 跑 jsdom，链接保留；未登记串保持 null。
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
const SITE = sites.find((s) => s.id === "gdc-docs");

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

const DATA = load(...SITE.dicts);

function boot(html) {
  const dom = new JSDOM(html, { url: "https://gdc.cancer.gov/support" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data: DATA, site: SITE });
  engine.start();
  return { dom, engine, doc: dom.window.document };
}

const HELP_MAIL = 'support@nci-gdc.datacommons.io';
const HELP_ANALYSIS = `<p id="p">For assistance with GDC query, download, submission and analysis of data, please contact the GDC Help Desk (<a href="mailto:${HELP_MAIL}" class="mailto" data-extlink="">${HELP_MAIL}<svg focusable="false" width="1em" height="1em" class="mailto" data-extlink-placement="append" viewBox="0 10 70 20" role="img"><title>mailto</title><path d="M56 14H8c-1.1 0-2 0.9-2 2v32c0 1.1 0.9 2 2 2h48c1.1 0 2-0.9 2-2V16C58 14.9 57.1 14 56 14z"></path></svg></a>).</p>`;
const HELP_SUBMIT = `<p id="p">For assistance with GDC query, download and submission of data, please contact the GDC Help Desk (<a href="mailto:${HELP_MAIL}" class="mailto" data-extlink="">${HELP_MAIL}<svg focusable="false" width="1em" height="1em" class="mailto" data-extlink-placement="append" viewBox="0 10 70 20" role="img"><title>mailto</title><path d="M56 14H8z"></path></svg></a>).</p>`;

const PORTAL_EN = '<p id="p">The <a href="https://portal.gdc.cancer.gov">GDC Data Portal</a> is a robust web-based platform that allows users to search, analyze, and download data for custom cohorts from cancer genomic studies. For detailed instructions on using the GDC Data Portal, please see our <a href="https://docs.gdc.cancer.gov/Data_Portal/Users_Guide/Video_Tutorials/">GDC Tutorial Videos</a> which are also available in the <a href="https://www.youtube.com/playlist?list=PLaXJeOudgf60aE6tqrZcIhm9B4Ivxar4a" class="ext">NCI GDC YouTube Playlist</a>.</p>';
// 同一段在「上一轮已把链接译成中文、句末标点已本地化成 。」的 DOM 上（实测残句状态）
const PORTAL_CN_LINKS = '<p id="p">The <a href="https://portal.gdc.cancer.gov">GDC 数据门户</a> is a robust web-based platform that allows users to search, analyze, and download data for custom cohorts from cancer genomic studies. For detailed instructions on using the GDC Data Portal, please see our <a href="https://docs.gdc.cancer.gov/Data_Portal/Users_Guide/Video_Tutorials/">GDC 教程视频</a> which are also available in the <a href="https://www.youtube.com/playlist?list=PLaXJeOudgf60aE6tqrZcIhm9B4Ivxar4a" class="ext">NCI GDC YouTube 播放列表</a>。</p>';

const PORTAL_ZH = "GDC 数据门户是一个稳健的基于网页的平台，允许用户检索、分析与下载癌症基因组研究中自定义队列的数据。有关使用 GDC 数据门户的详细说明，请参阅我们的GDC 教程视频，这些视频也可在NCI GDC YouTube 播放列表中获取。";

const NEW_EXACT = {
  processed: "处理",
  "approved by the GDC and registered in dbGaP": "经 GDC 批准并在 dbGaP 中注册",
  "developer tools": "开发者工具",
  "GDC Data": "GDC 数据",
  "doc icon": "文档图标",
  "youtube tutorial": "YouTube 教程",
  "GDC Applications": "GDC 应用",
  "To receive timely updates about GDC Releases, maintenance windows, and other news and announcements, please": "如需及时了解 GDC 版本发布、维护窗口及其他新闻与公告，请"
};

test("email 前缀走规则：邮箱地址保留，只翻 email 这个词", () => {
  const engine = boot("<p>x</p>").engine;
  // 词库红线：exact 值不得含邮箱地址，所以这条只能写成规则（$1 原样带回地址）
  assert.equal(DATA.rules.some((r) => r.re === "^email (\\S+@\\S+)$" && r.to === "发送邮件至 $1"), true);
  assert.equal(engine.translateText("email support@nci-gdc.datacommons.io"), "发送邮件至 support@nci-gdc.datacommons.io");
  assert.equal(engine.translateText("email help@example.org"), "发送邮件至 help@example.org");
  assert.equal(engine.translateText("contact support@nci-gdc.datacommons.io"), null);
});

test("r34 新增 exact 逐条命中，译文含汉字", () => {
  const engine = boot("<p>x</p>").engine;
  for (const [srcText, want] of Object.entries(NEW_EXACT)) {
    assert.equal(DATA.exact[srcText], want, "词库缺条目：" + srcText);
    assert.equal(engine.translateText(srcText), want, "未命中：" + srcText);
    assert.match(want, /[\u3400-\u9fff]/, "译文不含汉字：" + srcText);
  }
});

test("帮助台两句模板：整段中文、mailto 链接与邮箱原样保留", () => {
  for (const [html, want] of [
    [HELP_ANALYSIS, "如需协助进行 GDC 数据的查询、下载、提交与分析，请联系 GDC 帮助台（" + HELP_MAIL + "）。"],
    [HELP_SUBMIT, "如需协助进行 GDC 数据的查询、下载与提交，请联系 GDC 帮助台（" + HELP_MAIL + "）。"]
  ]) {
    const { doc } = boot(html);
    const p = doc.getElementById("p");
    // svg 图标自带 <title>（Drupal 的 "(link sends email)"），textContent 会把它算进去；
    // 这里只比对可见文字，图标存在性单独断言。
    const clone = p.cloneNode(true);
    clone.querySelectorAll("svg").forEach((s) => s.remove());
    assert.equal(clone.textContent, want);
    assert.equal(p.querySelectorAll("a").length, 1);
    assert.ok(p.querySelector("a svg"), "mailto 图标应留在链接里");
    assert.equal(p.querySelector("a").getAttribute("href"), "mailto:" + HELP_MAIL);
    assert.equal(p.getAttribute("data-biol10n-tpl"), "1");
  }
});

test("GDC 数据门户简介模板：英文态整段成中文，三个链接原位保留", () => {
  const { doc } = boot(PORTAL_EN);
  const p = doc.getElementById("p");
  assert.equal(p.textContent, PORTAL_ZH);
  const links = p.querySelectorAll("a");
  assert.equal(links.length, 3);
  assert.equal(links[0].getAttribute("href"), "https://portal.gdc.cancer.gov");
  assert.equal(links[0].textContent, "GDC 数据门户");
  assert.equal(links[1].getAttribute("href"), "https://docs.gdc.cancer.gov/Data_Portal/Users_Guide/Video_Tutorials/");
  assert.equal(links[1].textContent, "GDC 教程视频");
  assert.equal(links[2].getAttribute("href"), "https://www.youtube.com/playlist?list=PLaXJeOudgf60aE6tqrZcIhm9B4Ivxar4a");
  assert.equal(links[2].textContent, "NCI GDC YouTube 播放列表");
  assert.equal(p.getAttribute("data-biol10n-tpl"), "1");
});

test("同一段在链接已中文化、句末为 。 的残留 DOM 上也能整段替换", () => {
  const { doc } = boot(PORTAL_CN_LINKS);
  const p = doc.getElementById("p");
  assert.equal(p.textContent, PORTAL_ZH);
  assert.equal(p.querySelectorAll("a").length, 3);
});

test("订阅提示：英文前缀译成中文，链接与句末标点就位", () => {
  const { doc } = boot('<p id="p">To receive timely updates about GDC Releases, maintenance windows, and other news and announcements, please <a href="https://list.nih.gov/cgi-bin/wa.exe?SUBED1=gdc-users-l&amp;A=1" class="ext">Join the GDC User Listserv</a>.</p>');
  const p = doc.getElementById("p");
  assert.equal(p.textContent, "如需及时了解 GDC 版本发布、维护窗口及其他新闻与公告，请加入 GDC 用户邮件列表。");
  assert.equal(p.querySelector("a").getAttribute("href"), "https://list.nih.gov/cgi-bin/wa.exe?SUBED1=gdc-users-l&A=1");
});

test("正文里的 processed / approved / developer tools 链接在中文句子里补翻", () => {
  const { doc } = boot(
    '<p id="p">GDC 数据提交门户是一个平台，允许研究者向 GDC 提交数据，这些数据将经过<a id="a1" href="/about-data/gdc-data-processing">processed</a>并发布给研究界。项目需先<a id="a2" href="/submit-data/requesting-data-submission">approved by the GDC and registered in dbGaP</a>。</p>' +
      '<p id="q">GDC 提供<a id="a3" href="/developers">developer tools</a>，例如用于开发在 GDC 中运行的应用的框架。</p>'
  );
  assert.equal(doc.getElementById("a1").textContent, "处理");
  assert.equal(doc.getElementById("a2").textContent, "经 GDC 批准并在 dbGaP 中注册");
  assert.equal(doc.getElementById("a3").textContent, "开发者工具");
  assert.equal(doc.querySelector("#p a#a1").getAttribute("href"), "/about-data/gdc-data-processing");
});

test("GDC Data 卡片标题在长正文容器里单独翻成 GDC 数据", () => {
  const { doc } = boot(
    '<div class="link_description"><h3 id="h">GDC Data</h3><p>GDC enables researchers to access standardized clinical and genomic data from large-scale cancer studies funded by NCI and other programs.</p></div>'
  );
  assert.equal(doc.getElementById("h").textContent, "GDC 数据");
});

test("gdc-docs 属性：alt / iframe title / a title 命中，API 与 USA.gov 保持原样", () => {
  const { doc, engine } = boot(
    '<img id="i" alt="doc icon">' +
      '<iframe id="f" title="youtube tutorial"></iframe>' +
      '<a id="ap" alt="GDC Applications">GDC 应用</a>' +
      '<a id="em" href="mailto:' + HELP_MAIL + '" title="email ' + HELP_MAIL + '">' + HELP_MAIL + '</a>' +
      '<a id="api" title="API"></a>' +
      '<a id="usa" href="https://www.usa.gov/">USA.gov</a>'
  );
  assert.equal(doc.getElementById("i").getAttribute("alt"), "文档图标");
  assert.equal(doc.getElementById("f").getAttribute("title"), "YouTube 教程");
  assert.equal(doc.getElementById("ap").getAttribute("alt"), "GDC 应用");
  assert.equal(doc.getElementById("em").getAttribute("title"), "发送邮件至 " + HELP_MAIL);
  assert.equal(doc.getElementById("api").getAttribute("title"), "API");
  assert.equal(doc.getElementById("usa").textContent, "USA.gov");
  assert.equal(engine.translateText("API"), null);
  assert.equal(engine.translateText("USA.gov"), null);
});

test("新增键不与其他册冲突，模板占位符 1..N 一一对应", () => {
  const files = fs.readdirSync(path.join(root, "../dict")).filter((f) => f.endsWith(".json"));
  for (const f of files) {
    if (f === "gdc-docs.json") continue;
    const other = JSON.parse(fs.readFileSync(path.join(root, "../dict", f), "utf8"));
    for (const k of Object.keys(NEW_EXACT)) {
      if (k in (other.exact || {})) {
        assert.equal(other.exact[k], NEW_EXACT[k], "跨册同键不同值：" + f + " / " + k);
      }
    }
  }
  const tpls = JSON.parse(fs.readFileSync(path.join(root, "../dict/gdc-docs.json"), "utf8")).templates;
  for (const t of tpls) {
    const used = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    if (!used.length) continue;
    const zhUsed = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.deepEqual(
      [...new Set(zhUsed)].sort((a, b) => a - b),
      used.map((_, i) => i + 1),
      "模板占位符不连续或数量不符：" + t.pat.slice(0, 60)
    );
  }
});
