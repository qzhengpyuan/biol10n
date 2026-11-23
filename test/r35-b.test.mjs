// r35-b：Reactome 通路浏览器说明句 / 配色选项 / 品牌图标 alt，InterPro PROSITE Doc 标题、
// DocBot 聊天容器 aria-label、ELIXIR 页脚 logo alt，以及 DocBot 建议问句的归属判定。
// 原文全部取自 CDP 9227 实测渲染 DOM（2026-11-24，BioL10n 0.10.39）：
// - https://reactome.org/PathwayBrowser/#/R-HSA-109582
//     <td>Background literature references...</td>（折叠表，可见）
//     <select class="gwt-ListBox"><option value="Lighter">Lighter</option><option value="Darker">Darker</option></select>
//       （「相互作用分子配色方案」，图例面板里；value 是提交参数）
//     <img class="headerLogo" src="static/images/logo.png" alt="Reactome logo">
//     <img src="static/images/outage_icon.png" alt="Reactome outage icon">
// - https://www.ebi.ac.uk/interpro/entry/InterPro/IPR000001/
//     <h5>PROSITE Doc <div style="display: inline;"><span class="font-s ... icon EBI-Icon-fonts_fonts__icon___e2 ..." data-icon=""></span></div></h5>
//     <div class="vf-content vf-chatbot-modal-container" aria-label="DocBotchatbot" ...>（点开 DocBot 后可见）
//     <img src="//ebi.emblstatic.net/web_guidelines/EBI-Framework/v1.4/images/logos/ELIXIR/elixir-cdr.gif"
//          class="logo ElixirFooter_style__logo___f2" alt="Elixir logo">（共享 EBI 页脚）
//     <div class="vf-chatbot-action-prompt" data-vf-js-chatbot-welcome-suggestion="How do additional endpoint blocks filter API results?">
//       <a href="#" class="vf-chatbot-action-prompt__link" role="button">How do additional endpoint blocks filter API results?</a></div>
// 归属判定：「How do additional endpoint blocks filter API results?」实测只出现在 InterPro 的 DocBot 建议集里
// （同批实测 Rfam「Is it possible to have access to the Rfam database?」、MGnify「How do I find a
// metagenome's taxonomic profile in MGnify?」，ENA / PRIDE / BioStudies / Europe PMC / AlphaFold /
// PDBe / Expression Atlas / ChEMBL 页面上没有 DocBot）。DocBot 题库接口
// （https://www.ebi.ac.uk/docbot/api/get_predefined_questions?team=<id>，2026-11-24 全 25 个 team 逐个查过）
// 里该问句只出现在 interpro（16 题）与 all_services（490 题的 EBI 全局池）两个池，没有任何第二个站点级池，
// 未达「≥2 个 EBI 站默认渲染」的门槛，故落 interpro.json（与 rfam.json 收 Rfam 池问句的做法一致）。
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
const common = JSON.parse(fs.readFileSync(path.join(root, "../dict/common.json"), "utf8"));
const reactome = JSON.parse(fs.readFileSync(path.join(root, "../dict/reactome.json"), "utf8"));
const interpro = JSON.parse(fs.readFileSync(path.join(root, "../dict/interpro.json"), "utf8"));
const rfam = JSON.parse(fs.readFileSync(path.join(root, "../dict/rfam.json"), "utf8"));

function dataFor(siteId) {
  const site = sites.find((s) => s.id === siteId);
  const exact = {};
  const rules = [];
  const templates = [];
  for (const n of site.dicts) {
    const d = JSON.parse(fs.readFileSync(path.join(root, "../dict/" + n + ".json"), "utf8"));
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
    templates.push(...(d.templates || []));
  }
  return { site, data: { exact, rules, templates } };
}

function boot(siteId, html, url) {
  const { site, data } = dataFor(siteId);
  const dom = new JSDOM(html, { url });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return { dom, engine, doc: dom.window.document, data };
}

const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();
const CJK = /[\u3400-\u9fff]/;

const REACTOME_URL = "https://reactome.org/PathwayBrowser/#/R-HSA-109582";
const INTERPRO_URL = "https://www.ebi.ac.uk/interpro/entry/InterPro/IPR000001/";

const NEW_EXACT = {
  reactome: {
    "Background literature references...": "背景文献参考……",
    "Lighter": "浅色",
    "Darker": "深色",
    "Reactome logo": "Reactome 标志",
    "Reactome outage icon": "Reactome 服务中断图标"
  },
  interpro: {
    "PROSITE Doc": "PROSITE 文档",
    "Elixir logo": "ELIXIR 标志",
    "DocBotchatbot": "DocBot 聊天机器人",
    "How do additional endpoint blocks filter API results?": "额外的端点块如何筛选 API 结果？"
  }
};

test("r35-b 新增 exact 落盘、译文含汉字、品牌原样、无自映射", () => {
  for (const [siteId, entries] of Object.entries(NEW_EXACT)) {
    const book = siteId === "reactome" ? reactome : interpro;
    const { engine, data } = boot(siteId, "<p>x</p>", siteId === "reactome" ? REACTOME_URL : INTERPRO_URL);
    for (const [srcText, want] of Object.entries(entries)) {
      assert.equal(book.exact[srcText], want, siteId + " 词库缺条目：" + srcText);
      assert.equal(data.exact[srcText], want, siteId + " 站点词库未合并到：" + srcText);
      assert.equal(engine.translateText(srcText), want, siteId + " 未命中：" + srcText);
      assert.match(want, CJK, siteId + " 译文不含汉字：" + srcText);
      assert.notEqual(srcText, want, "自映射：" + srcText);
      assert.ok(srcText.length <= 80, "key 超过 80 字符：" + srcText);
      assert.ok(want.length <= 60, "值超过 60 字符（应改走 rules）：" + want);
      assert.doesNotMatch(want, /https?:\/\//i, "值含明文 URL：" + srcText);
      assert.doesNotMatch(want, /[\w.+-]+@[\w-]+\.[\w.]+/, "值含明文邮箱：" + srcText);
      if (siteId === "interpro" && srcText in common.exact) {
        assert.equal(want, common.exact[srcText], "与 common 译法打架：" + srcText);
      }
    }
  }
  // 品牌名不落中文：整串之外的单品牌词不应被翻
  const { engine: rm } = boot("reactome", "<p>x</p>", REACTOME_URL);
  assert.equal(rm.translateText("Reactome"), null);
  assert.equal(rm.translateText("Lighter gray"), null, "「Lighter」不该泛化成前缀规则");
  const { engine: ip } = boot("interpro", "<p>x</p>", INTERPRO_URL);
  assert.equal(ip.translateText("PROSITE"), null);
  assert.equal(ip.translateText("DocBot"), null);
  assert.equal(ip.translateText("Elixir"), null);
});

test("DocBot 建议问句归属：只落 interpro.json 不进 common；跨册同键译法一致", () => {
  const q = "How do additional endpoint blocks filter API results?";
  // 只在一个站点级题库（interpro）实测渲染；另一个池是 EBI 全局 all_services → 不进 common.json
  assert.equal(common.exact[q], undefined, "该问句不该进 common.json（仅 InterPro 出现）");
  assert.equal(reactome.exact[q], undefined, "该问句不该进 reactome.json");
  assert.equal(interpro.exact[q], "额外的端点块如何筛选 API 结果？");
  // DocBotchatbot 与 rfam 册同串，译法必须一致（dict-lint 的跨册冲突判据）
  assert.equal(interpro.exact["DocBotchatbot"], rfam.exact["DocBotchatbot"]);
});

test("Reactome：折叠表 TD 说明句翻成中文，句末省略号跟随站点习惯", () => {
  const html =
    '<div id="container"><a class="header" href="#"><table><tbody>' +
    '<tr><td align="center" style="width: 16px;"><img src="data:image/png;base64,AAAA" width="16" height="16" class="gwt-Image"></td>' +
    "<td>Background literature references...</td></tr>" +
    "</tbody></table></a></div>";
  const { doc } = boot("reactome", html, REACTOME_URL);
  const td = doc.querySelector("tbody tr td:last-child");
  assert.equal(norm(td.textContent), "背景文献参考……", "说明句未汉化：" + norm(td.textContent));
  assert.doesNotMatch(td.textContent, /Background literature/);
  // 同行的箭头图标（base64 gwt-Image）不该被碰
  const img = doc.querySelector("td img");
  assert.equal(img.getAttribute("src"), "data:image/png;base64,AAAA");
  assert.equal(img.getAttribute("width"), "16");
});

test("Reactome：相互作用分子配色选项翻成中文，OPTION value 提交参数不动", () => {
  // 实测 DOM：整个「配色方案」面板（div.GCR0SYYDOW）在图例未展开时是隐藏的，
  // 但同面板里已有的词条（Colour Profiles / Diagram Colour Profile: / Standard）已经生效，
  // 说明该子树会被扫到，Lighter/Darker 落在同一棵子树里。
  const html =
    '<div class="GCR0SYYDOW" style="position: absolute; inset: 0px;">' +
    '<div class="GCR0SYYDPW">Colour Profiles</div>' +
    '<div><div class="GCR0SYYDNW">Diagram Colour Profile:</div>' +
    '<select class="gwt-ListBox"><option value="Standard">Standard</option><option value="Modern">Modern</option></select></div>' +
    '<div><div class="GCR0SYYDNW">Interactors Colour Profile:</div>' +
    '<select class="gwt-ListBox"><option value="Lighter">Lighter</option><option value="Darker">Darker</option></select></div>' +
    "</div>";
  const { doc } = boot("reactome", html, REACTOME_URL);
  assert.equal(norm(doc.querySelector(".GCR0SYYDPW").textContent), "配色方案");
  assert.deepEqual([...doc.querySelectorAll(".GCR0SYYDNW")].map((d) => norm(d.textContent)),
    ["通路图配色方案：", "相互作用分子配色方案："], "面板标签未汉化");
  const selects = [...doc.querySelectorAll("select")];
  // 同容器里既有选项已被词条接管（Standard→标准），Modern 是专有主题名保留
  assert.deepEqual([...selects[0].options].map((o) => norm(o.textContent)), ["标准", "Modern"]);
  assert.deepEqual([...selects[1].options].map((o) => norm(o.textContent)), ["浅色", "深色"], "选项文案未汉化");
  // value 是 GWT 提交参数：翻了会让配色方案失效
  assert.deepEqual([...selects[1].options].map((o) => o.getAttribute("value")), ["Lighter", "Darker"], "OPTION value 被改掉了");
});

test("Reactome：两张品牌图 alt 翻成中文，src 保留 Reactome 品牌名", () => {
  const html =
    '<div id="header"><a href="/" title="返回首页">' +
    '<img class="headerLogo" src="static/images/logo.png" alt="Reactome logo"></a></div>' +
    '<div id="outage"><img src="static/images/outage_icon.png" alt="Reactome outage icon"></div>';
  const { doc } = boot("reactome", html, REACTOME_URL);
  const logo = doc.querySelector("img.headerLogo");
  assert.equal(logo.getAttribute("alt"), "Reactome 标志", "header logo alt 未汉化：" + logo.getAttribute("alt"));
  assert.equal(logo.getAttribute("src"), "static/images/logo.png", "logo 图片路径被改");
  const outage = doc.querySelector("#outage img");
  assert.equal(outage.getAttribute("alt"), "Reactome 服务中断图标", "outage alt 未汉化：" + outage.getAttribute("alt"));
  assert.equal(outage.getAttribute("src"), "static/images/outage_icon.png");
});

test("InterPro：H5「PROSITE Doc」只翻文字，内联图标 span 与 data-icon 保留", () => {
  const html =
    '<div id="root"><section class="entry-profile">' +
    '<h5>PROSITE Doc <div style="display: inline;"><span class="font-s styles_interpro-vf__font-s___fe icon EBI-Icon-fonts_fonts__icon___e2 styles_interpro-vf__icon___a7 icon-common EBI-Icon-fonts_fonts__icon-common___e1" data-icon=""></span></div></h5>' +
    "</section></div>";
  const { doc } = boot("interpro", html, INTERPRO_URL);
  const h5 = doc.querySelector("h5");
  assert.equal(norm(h5.textContent), "PROSITE 文档", "H5 标题未汉化：" + norm(h5.textContent));
  const span = h5.querySelector("span");
  assert.ok(span, "图标 span 被删掉了");
  assert.equal(span.getAttribute("data-icon"), "", "data-icon 被改动");
  assert.ok(/EBI-Icon-fonts_fonts__icon___e2/.test(span.className), "图标 class 被改动：" + span.className);
  // 品牌 PROSITE 保留，不能整串丢掉
  assert.match(norm(h5.textContent), /^PROSITE 文档$/);
});

test("InterPro：聊天容器 aria-label 粘词「DocBotchatbot」翻成 DocBot 聊天机器人", () => {
  const html =
    '<div id="root"><div class="vf-content vf-chatbot-modal-container" ' +
    'data-vf-js-chatbot-modal-container="true" aria-label="DocBotchatbot" role="dialog">' +
    '<div role="region" aria-label="聊天机器人标题栏" class="vf-chatbot-modal__header"></div></div></div>';
  const { doc } = boot("interpro", html, INTERPRO_URL);
  const modal = doc.querySelector(".vf-chatbot-modal-container");
  assert.equal(modal.getAttribute("aria-label"), "DocBot 聊天机器人", "aria-label 未汉化：" + modal.getAttribute("aria-label"));
  assert.equal(modal.getAttribute("data-vf-js-chatbot-modal-container"), "true", "data-* 钩子被改动");
  assert.equal(modal.getAttribute("role"), "dialog");
});

test("InterPro：共享 EBI 页脚 ELIXIR logo alt 翻成「ELIXIR 标志」，图片地址保留", () => {
  const html =
    '<div id="root"><footer class="yaml _style__elixir-footer___a0"><div class="vf-footer__inner">' +
    '<div class="vf-flag__media"><span><img src="//ebi.emblstatic.net/web_guidelines/EBI-Framework/v1.4/images/logos/ELIXIR/elixir-cdr.gif" ' +
    'class="logo ElixirFooter_style__logo___f2" alt="Elixir logo"></span></div>' +
    "</div></footer></div>";
  const { doc } = boot("interpro", html, INTERPRO_URL);
  const img = doc.querySelector("img");
  assert.equal(img.getAttribute("alt"), "ELIXIR 标志", "ELIXIR logo alt 未汉化：" + img.getAttribute("alt"));
  assert.equal(img.getAttribute("src"), "//ebi.emblstatic.net/web_guidelines/EBI-Framework/v1.4/images/logos/ELIXIR/elixir-cdr.gif");
  assert.equal(img.className, "logo ElixirFooter_style__logo___f2", "class 被改动");
});

test("InterPro：DocBot 建议问句翻成中文，data-* 里的机器值与 href 不动", () => {
  const q = "How do additional endpoint blocks filter API results?";
  const html =
    '<div id="root"><div class="vf-chatbot-welcome-suggestions">' +
    '<div class="vf-chatbot-action-prompt" data-vf-js-chatbot-welcome-suggestion="' + q + '">' +
    '<a href="#" class="vf-chatbot-action-prompt__link" role="button">' + q + "</a></div></div></div>";
  const { doc } = boot("interpro", html, INTERPRO_URL);
  const a = doc.querySelector("a.vf-chatbot-action-prompt__link");
  assert.equal(norm(a.textContent), "额外的端点块如何筛选 API 结果？", "建议问句未汉化：" + norm(a.textContent));
  assert.equal(a.getAttribute("href"), "#", "href 被改动");
  assert.equal(a.getAttribute("role"), "button");
  // data-* 是站点读取的发送内容，不在默认属性通道里
  const wrap = doc.querySelector(".vf-chatbot-action-prompt");
  assert.equal(wrap.getAttribute("data-vf-js-chatbot-welcome-suggestion"), q, "data-* 机器值被汉化");
});

test("disable() 后 Reactome / InterPro 的文本与属性都还原英文", () => {
  const rmHtml =
    '<div id="container"><table><tbody><tr><td>Background literature references...</td></tr></tbody></table>' +
    '<select class="gwt-ListBox"><option value="Lighter">Lighter</option><option value="Darker">Darker</option></select>' +
    '<img class="headerLogo" src="static/images/logo.png" alt="Reactome logo">' +
    '<img src="static/images/outage_icon.png" alt="Reactome outage icon"></div>';
  const rm = boot("reactome", rmHtml, REACTOME_URL);
  assert.equal(norm(rm.doc.querySelector("td").textContent), "背景文献参考……");
  assert.deepEqual([...rm.doc.querySelectorAll("option")].map((o) => norm(o.textContent)), ["浅色", "深色"]);
  assert.equal(rm.doc.querySelector("img.headerLogo").getAttribute("alt"), "Reactome 标志");
  rm.engine.disable();
  assert.equal(norm(rm.doc.querySelector("td").textContent), "Background literature references...", "说明句未还原");
  assert.deepEqual([...rm.doc.querySelectorAll("option")].map((o) => norm(o.textContent)), ["Lighter", "Darker"], "选项未还原");
  assert.equal(rm.doc.querySelector("img.headerLogo").getAttribute("alt"), "Reactome logo", "logo alt 未还原");
  assert.equal(rm.doc.querySelectorAll("img")[1].getAttribute("alt"), "Reactome outage icon", "outage alt 未还原");
  assert.deepEqual([...rm.doc.querySelectorAll("option")].map((o) => o.getAttribute("value")), ["Lighter", "Darker"]);

  const ipHtml =
    '<div id="root"><h5>PROSITE Doc <div style="display: inline;"><span class="icon" data-icon=""></span></div></h5>' +
    '<div aria-label="DocBotchatbot" class="vf-content vf-chatbot-modal-container" role="dialog"></div>' +
    '<img class="logo ElixirFooter_style__logo___f2" alt="Elixir logo" src="elixir-cdr.gif"></div>';
  const ip = boot("interpro", ipHtml, INTERPRO_URL);
  assert.equal(norm(ip.doc.querySelector("h5").textContent), "PROSITE 文档");
  assert.equal(ip.doc.querySelector("[aria-label]").getAttribute("aria-label"), "DocBot 聊天机器人");
  assert.equal(ip.doc.querySelector("img").getAttribute("alt"), "ELIXIR 标志");
  ip.engine.disable();
  assert.equal(norm(ip.doc.querySelector("h5").textContent), "PROSITE Doc", "H5 未还原");
  assert.equal(ip.doc.querySelector("[aria-label]").getAttribute("aria-label"), "DocBotchatbot", "aria-label 未还原");
  assert.equal(ip.doc.querySelector("img").getAttribute("alt"), "Elixir logo", "logo alt 未还原");
});
