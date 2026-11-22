// Rfam 词库（rfam）aria 回归：DocBot 聊天组件骨架、导航/轮播按钮、社媒链接与"数据不动"边界。
// 清单来自实战探测（https://rfam.org/ 与 /family/RF00001，禁用 BioL10n 后取原始英文）：
// 聊天窗 13 条 + 导航/轮播/社媒 10 条 + 拼接形 aria-label "DocBotchatbot" 1 条。
// "Dismiss banner" 不新增词条：既有小写条目 "dismiss banner" 靠大小写折叠命中，这里用断言锁住。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dictPath = path.join(root, "../dict/rfam.json");
const book = JSON.parse(fs.readFileSync(dictPath, "utf8"));
const rawDict = fs.readFileSync(dictPath, "utf8");
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "rfam") || {
  id: "rfam",
  hosts: ["rfam.org", "www.rfam.org", "docs.rfam.org"],
  dicts: ["common", "rfam"],
  scope: "body",
  skip: "#rfam-wiki-article"
};
const stack = site.dicts && site.dicts.includes("rfam") ? site.dicts : ["common", "rfam"];
const data = { exact: {}, rules: [], templates: [] };
for (const name of stack) {
  const d = JSON.parse(fs.readFileSync(path.join(root, "../dict", name + ".json"), "utf8"));
  Object.assign(data.exact, d.exact || {});
  data.rules.push(...(d.rules || []));
  data.templates.push(...(d.templates || []));
}

function run(html) {
  const dom = new JSDOM("<body>" + html + "</body>");
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return dom.window.document;
}
const aria = (doc, sel) => {
  const el = doc.querySelector(sel);
  return el ? el.getAttribute("aria-label") : null;
};
const text = (doc, sel) => {
  const el = doc.querySelector(sel);
  return el ? el.textContent.replace(/\s+/g, " ").trim() : "";
};

// 本案新增的 24 条 exact（"Dismiss banner" 走大小写折叠，不进词表）
const ADDED = {
  "DocBotchatbot": "DocBot 聊天机器人",
  "Chatbot header": "聊天机器人标题栏",
  "Chatbot selector": "聊天机器人选择器",
  "Chat options": "聊天选项",
  "Minimize chatbot": "最小化聊天机器人",
  "Close chatbot": "关闭聊天机器人",
  "Open chat": "打开聊天",
  "Chat messages": "聊天消息",
  "Chat message input": "聊天消息输入框",
  "Send message": "发送消息",
  "Disclaimer banner": "免责声明横幅",
  "close notification banner": "关闭通知横幅",
  "footnote": "脚注",
  "Close dialog": "关闭对话框",
  "Toggle navigation": "切换导航",
  "Breadcrumb": "面包屑导航",
  "Previous projects": "上一组项目",
  "Next projects": "下一组项目",
  "Previous families": "上一组家族",
  "Next families": "下一组家族",
  "Rfam on X": "Rfam 的 X",
  "Rfam on Bluesky": "Rfam 的 Bluesky",
  "Rfam on LinkedIn": "Rfam 的 LinkedIn",
  "Rfam on GitHub": "Rfam 的 GitHub"
};

test("词库结构：新增 24 条齐全、无重复键、值与中文形态合规", () => {
  for (const [k, v] of Object.entries(ADDED)) {
    assert.equal(book.exact[k], v, "词条缺失或值不符: " + k);
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "键里不能有中文: " + k);
    assert.ok(/[\u4e00-\u9fff]/.test(book.exact[k]), "译文里必须有中文: " + k);
    assert.notEqual(k, book.exact[k], "自映射: " + k);
    assert.equal(k, k.trim(), "键首尾不能有空白: " + JSON.stringify(k));
    assert.equal(book.exact[k], book.exact[k].trim(), "译文首尾不能有空白: " + k);
  }
  // 社媒品牌名（X / Bluesky / LinkedIn / GitHub）保持原样，只翻 "Rfam 的"
  assert.equal(book.exact["Rfam on X"], "Rfam 的 X", "X 是品牌不是字母，不能翻成别的");
  // 大小写折叠已覆盖的条目不重复登记
  assert.equal(book.exact["Dismiss banner"], undefined, "不要新增 Dismiss banner，大小写折叠会命中");
  assert.equal(book.exact["dismiss banner"], "关闭横幅");
  // 原始 JSON 里 exact 段的键数 == 解析后的键数（防同册重复键被 JSON.parse 静默吞掉）
  const exactBlock = rawDict.slice(rawDict.indexOf('"exact": {'), rawDict.indexOf('\n  "rules"'));
  const rawKeys = exactBlock.match(/^    "[^"]+":/gm) || [];
  assert.equal(rawKeys.length, Object.keys(book.exact).length, "exact 段有重复键");
  assert.ok(Object.keys(book.exact).length >= 300, "exact 条目数掉了");
});

test("DocBot 聊天窗：14 处 aria-label（含拼接形）与按钮文字全部中文化，图标按钮文字不误伤", () => {
  const doc = run(
    '<button class="vf-chatbot-fab" aria-label="Open chat"></button>' +
      '<div class="vf-chatbot-modal-container" aria-label="DocBotchatbot">' +
      '<div class="vf-chatbot-modal__header" aria-label="Chatbot header">' +
      '<div class="vf-chatbot-modal__header-left" aria-label="Chatbot selector"><span title="Rfam">DocBot</span></div>' +
      '<button class="docbot-menu__trigger" aria-label="Chat options"></button>' +
      '<button class="vf-chatbot-modal__minimize" aria-label="Minimize chatbot"></button>' +
      '<button class="vf-chatbot-modal__close" aria-label="Close chatbot"></button>' +
      "</div>" +
      '<div class="vf-chatbot-modal__messages" aria-label="Chat messages">' +
      "<p>Hello! How can I help you today?</p>" +
      "</div>" +
      '<div class="vf-chatbot-modal__disclaimer" aria-label="Disclaimer banner">' +
      '<button class="beta-close" aria-label="close notification banner">dismiss banner</button>' +
      "</div>" +
      '<div class="vf-chatbot-modal__input-container" aria-label="Chat message input">' +
      '<textarea placeholder="Ask me"></textarea>' +
      "</div>" +
      '<button class="vf-chatbot-modal__send-button" aria-label="Send message"></button>' +
      '<div class="vf-chatbot-modal__footnote" aria-label="footnote"><a href="/privacy">Privacy Notice</a></div>' +
      "</div>" +
      '<div class="vf-chatbot-dialog">' +
      '<button class="vf-chatbot-dialog__close" aria-label="Close dialog"></button>' +
      '<button class="keep">Keep chat open</button><button class="del">Close and delete</button>' +
      "</div>"
  );
  assert.equal(aria(doc, ".vf-chatbot-fab"), "打开聊天");
  assert.equal(aria(doc, ".vf-chatbot-modal-container"), "DocBot 聊天机器人", "拼接形 aria-label 要整条覆盖");
  assert.equal(aria(doc, ".vf-chatbot-modal__header"), "聊天机器人标题栏");
  assert.equal(aria(doc, ".vf-chatbot-modal__header-left"), "聊天机器人选择器");
  assert.equal(aria(doc, ".docbot-menu__trigger"), "聊天选项");
  assert.equal(aria(doc, ".vf-chatbot-modal__minimize"), "最小化聊天机器人");
  assert.equal(aria(doc, ".vf-chatbot-modal__close"), "关闭聊天机器人");
  assert.equal(aria(doc, ".vf-chatbot-modal__messages"), "聊天消息");
  assert.equal(aria(doc, ".vf-chatbot-modal__disclaimer"), "免责声明横幅");
  assert.equal(aria(doc, ".beta-close"), "关闭通知横幅");
  assert.equal(aria(doc, ".vf-chatbot-modal__input-container"), "聊天消息输入框");
  assert.equal(aria(doc, ".vf-chatbot-modal__send-button"), "发送消息");
  assert.equal(aria(doc, ".vf-chatbot-modal__footnote"), "脚注");
  assert.equal(aria(doc, ".vf-chatbot-dialog__close"), "关闭对话框");
  // 同块的可见文字与占位符
  assert.equal(text(doc, ".vf-chatbot-modal__messages p"), "你好！今天有什么可以帮你？");
  assert.equal(doc.querySelector("textarea").getAttribute("placeholder"), "问我");
  assert.equal(text(doc, ".beta-close"), "关闭横幅");
  assert.equal(text(doc, ".keep"), "保持聊天打开");
  assert.equal(text(doc, ".del"), "关闭并删除");
  assert.equal(text(doc, ".vf-chatbot-modal__footnote a"), "隐私声明");
  // 选择器标题是产品名，保持原样
  assert.equal(text(doc, ".vf-chatbot-modal__header-left span"), "DocBot");
});

test("导航/轮播/社媒：aria-label 全部中文化，href 与品牌名不动", () => {
  const doc = run(
    '<header><button class="rfam-nav-toggle" aria-label="Toggle navigation">☰</button></header>' +
      '<nav class="vf-breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a></nav>' +
      '<section class="rfam-carousel">' +
      '<button class="prev-projects rfam-carousel-btn" aria-label="Previous projects">‹</button>' +
      '<button class="next-projects rfam-carousel-btn" aria-label="Next projects">›</button>' +
      "</section>" +
      '<section class="rfam-carousel">' +
      '<button class="prev-families rfam-carousel-btn" aria-label="Previous families">‹</button>' +
      '<button class="next-families rfam-carousel-btn" aria-label="Next families">›</button>' +
      "</section>" +
      '<footer class="vf-footer">' +
      '<a class="sx" aria-label="Rfam on X" href="https://x.com/RfamDB"></a>' +
      '<a class="sb" aria-label="Rfam on Bluesky" href="https://bsky.app/profile/rfamdb.bsky.social"></a>' +
      '<a class="sl" aria-label="Rfam on LinkedIn" href="https://www.linkedin.com/company/embl-ebi-rna-resources"></a>' +
      '<a class="sg" aria-label="Rfam on GitHub" href="https://github.com/Rfam"></a>' +
      "</footer>"
  );
  assert.equal(aria(doc, ".rfam-nav-toggle"), "切换导航");
  assert.equal(aria(doc, ".vf-breadcrumbs"), "面包屑导航");
  assert.equal(aria(doc, ".prev-projects"), "上一组项目");
  assert.equal(aria(doc, ".next-projects"), "下一组项目");
  assert.equal(aria(doc, ".prev-families"), "上一组家族");
  assert.equal(aria(doc, ".next-families"), "下一组家族");
  assert.equal(aria(doc, ".sx"), "Rfam 的 X");
  assert.equal(aria(doc, ".sb"), "Rfam 的 Bluesky");
  assert.equal(aria(doc, ".sl"), "Rfam 的 LinkedIn");
  assert.equal(aria(doc, ".sg"), "Rfam 的 GitHub");
  const hrefs = [...doc.querySelectorAll("footer a")].map((a) => a.getAttribute("href"));
  assert.deepEqual(hrefs, [
    "https://x.com/RfamDB",
    "https://bsky.app/profile/rfamdb.bsky.social",
    "https://www.linkedin.com/company/embl-ebi-rna-resources",
    "https://github.com/Rfam"
  ]);
  // 轮播按钮的箭头字形不是文字，原样保留
  assert.equal(text(doc, ".prev-projects"), "‹");
  assert.equal(text(doc, ".next-families"), "›");
  assert.equal(text(doc, ".vf-breadcrumbs a"), "首页");
});

test("大小写折叠：关闭横幅按钮 aria-label 用 Title Case 也命中既有小写条目", () => {
  const doc = run(
    '<button class="beta-close" aria-label="Dismiss banner">×</button>' +
      '<button class="beta-close2" aria-label="dismiss banner">×</button>'
  );
  assert.equal(aria(doc, ".beta-close"), "关闭横幅");
  assert.equal(aria(doc, ".beta-close2"), "关闭横幅");
  // "×" 是图标字形，不该变成标点或中文
  assert.equal(text(doc, ".beta-close"), "×");
});

test("数据边界：维基引用区的 title、登录号与家族名保持原样", () => {
  const doc = run(
    '<div id="rfam-wiki-article">' +
      '<a class="mw-editsection-visualeditor" title="Edit section: Biosynthesis" href="/w/1"></a>' +
      "<a class=\"mw-redirect\" title=\"Doi (identifier)\" href=\"/doi\"></a>" +
      '<a title="Edit section&apos;s source code: Structure" href="/w/2"></a>' +
      '<span class="Z3988" title="ctx_ver=Z39.88-2004&amp;rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Ajournal"></span>' +
      "<p>The 5S ribosomal RNA (5S rRNA) is an approximately 120 nucleotide-long ribosomal RNA molecule with a mass of 40 kDa.</p>" +
      "</div>" +
      '<p class="family" aria-label="RF00001"><span>RF00001</span> <span>5S_rRNA</span></p>'
  );
  const titles = [...doc.querySelectorAll("#rfam-wiki-article [title]")].map((el) => el.getAttribute("title"));
  assert.deepEqual(titles, [
    "Edit section: Biosynthesis",
    "Doi (identifier)",
    "Edit section's source code: Structure",
    "ctx_ver=Z39.88-2004&rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Ajournal"
  ]);
  const en = "The 5S ribosomal RNA (5S rRNA) is an approximately 120 nucleotide-long ribosomal RNA molecule with a mass of 40 kDa.";
  assert.equal(doc.querySelector("#rfam-wiki-article p").textContent, en, "维基正文一个字都不该动");
  assert.equal(aria(doc, ".family"), "RF00001", "登录号不能翻");
  assert.deepEqual([...doc.querySelectorAll(".family span")].map((el) => el.textContent), ["RF00001", "5S_rRNA"]);
});
