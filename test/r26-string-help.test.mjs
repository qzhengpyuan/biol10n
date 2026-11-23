// STRING 帮助/文档页与网络页遗留界面文案（r26）回归：
// 词库结构、帮助导航/页脚、文档标题、网络页聚类与断开节点选项、规则与模板 + jsdom 渲染用例
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
const SITE = { scope: "body", block: "pre, code", rescan: false };

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

test("r26 词库：新增帮助/网络页条目齐备", () => {
  assert.ok(Object.keys(dict.exact).length >= 560, "exact 条目不足: " + Object.keys(dict.exact).length);
  const cases = {
    "STRING Help": "STRING 帮助",
    "Help Center": "帮助中心",
    "User documentation": "用户文档",
    "Getting started": "入门指南",
    "What is a STRING network?": "什么是 STRING 网络？",
    "Protein window": "蛋白质窗口",
    "STRING Videos": "STRING 视频",
    "Developer documentation": "开发者文档",
    "External data": "外部数据",
    "Robot access": "机器人访问",
    "Video introduction/tutorials:": "视频介绍/教程：",
    "Next »": "下一页 »",
    "Top ↑": "返回顶部 ↑",
    "Search docs": "搜索文档",
    "main navigation": "主导航",
    "top navigation": "顶部导航",
    "breadcrumbs navigation": "面包屑导航",
    "footer navigation": "页脚导航",
    "k-means clustering": "k 均值聚类",
    "Disconnected nodes": "非连通节点",
    "Distributed": "分散",
    "Bottom grid": "底部网格",
    "Arrange clusters and disconnected components in a grid": "将聚类与非连通组件按网格排列",
    "Starting Point": "起点",
    "Navigation Buttons": "导航按钮",
    "Data Settings": "数据设置",
    "View Settings": "视图设置",
    "Tables / Exports": "表格 / 导出",
    "Conserved Neighborhood": "保守邻域",
    "Text mining": "文本挖掘",
    "Red line - indicates the presence of fusion evidence": "红线——表示存在融合证据",
    "Green line - neighborhood evidence": "绿线——邻域证据",
    "Blue line - cooccurrence evidence": "蓝线——共现证据",
    "Purple line - experimental evidence": "紫线——实验证据",
    "Yellow line - textmining evidence": "黄线——文本挖掘证据",
    "Light blue line - database evidence": "浅蓝线——数据库证据",
    "Black line - coexpression evidence.": "黑线——共表达证据。",
    "low confidence - 0.15 (or better),": "低可信度——0.15（或更高），",
    "medium confidence - 0.4,": "中等可信度——0.4，",
    "high confidence - 0.7,": "高可信度——0.7，",
    "highest confidence - 0.9.": "最高可信度——0.9。",
    "Protein Window": "蛋白质窗口",
    "Domain and Structure": "结构域与结构",
    "STRING API": "STRING API 接口",
    "Quick start": "快速开始",
    "Common conventions": "通用约定",
    "Regulatory and typed networks": "调控网络与分型网络",
    "Mapping identifiers": "标识符映射",
    "Getting STRING network image": "获取 STRING 网络图像",
    "Linking to the network on STRING webpage": "链接到 STRING 网页上的网络",
    "Linking to the search results page": "链接到检索结果页",
    "Embedding the interactive network": "嵌入交互式网络",
    "Getting the STRING network interactions": "获取 STRING 网络互作",
    "Getting functional enrichment": "获取功能富集",
    "Retrieving functional annotation": "检索功能注释",
    "Getting gene set descriptions": "获取基因集描述",
    "Getting protein-protein interaction enrichment": "获取蛋白质-蛋白质互作富集",
    "Getting current STRING version": "获取当前 STRING 版本",
    "Additional information about the API": "关于 API 的补充信息",
    "Obtain your API Key": "获取您的 API 密钥",
    "Submit a new job": "提交新任务",
    "Check job status and retrieve the results": "查看任务状态并获取结果",
    "Remove a Job": "删除任务",
    "...but before you start coding:": "…但在开始编码之前：",
    "How are the scores computed?": "得分是如何计算的？",
    "How to cite STRING?": "如何引用 STRING？",
    "How do I link to STRING networks?": "如何链接到 STRING 网络？",
    "Are the colors assigned to nodes significant?": "节点分配的颜色有意义吗？",
    "What are the 1st and 2nd shell interactors?": "第一层与第二层互作蛋白是什么？",
    "How do I map my proteins to STRING identifiers?": "如何将我的蛋白质映射到 STRING 标识符？",
    "Limitation on the number of proteins?": "蛋白质数量有限制吗？",
    "Problems to download large files?": "下载大文件有问题？"
  };
  const { engine } = boot("<body></body>");
  for (const [en, zh] of Object.entries(cases)) {
    assert.equal(engine.translateText(en), zh, "未命中: " + en);
  }
});

test("r26 规则：帮助页版权年份与网络页永久链接", () => {
  const { engine } = boot("<body></body>");
  assert.equal(
    engine.translateText("Copyright © 2000-2022 CPR, EMBL, SIB, KU, and UZH. All rights reserved."),
    "版权所有 © 2000-2022 CPR、EMBL、SIB、KU 与 UZH。保留所有权利。"
  );
  assert.equal(
    engine.translateText(
      "A shareable, permanent link to your network. The address shown in your browser expires after three days; this link keeps working after your session has ended, and opens the network in STRING version 12.5."
    ),
    "指向您网络的可分享永久链接。浏览器地址栏中的地址三天后过期；此链接在会话结束后仍然有效，并以 STRING 12.5 版本打开该网络。"
  );
});

test("r26 jsdom：帮助页导航与无障碍属性", () => {
  const { doc } = boot(
    '<body><nav aria-label="main navigation">' +
      '<a href=".">User documentation</a>' +
      '<a href="getting_started/">Getting started</a>' +
      '<a href="faq/">frequently asked questions</a>' +
      '<a href="api/">External data</a>' +
      '<a href="next/">Next »</a>' +
      "</nav>" +
      '<input type="text" name="q" placeholder="Search docs">' +
      '<div aria-label="breadcrumbs navigation"><a href=".">Docs</a> » 首页</div>' +
      '<div aria-label="footer navigation"><a href="x">Top ↑</a></div>' +
      "</body>",
    "https://string-db.org/help/"
  );
  const nav = doc.querySelector("nav");
  assert.equal(nav.getAttribute("aria-label"), "主导航");
  const links = [...nav.querySelectorAll("a")].map((a) => a.textContent);
  assert.deepEqual(links, ["用户文档", "入门指南", "常见问题", "外部数据", "下一页 »"]);
  assert.equal(doc.querySelector("input").getAttribute("placeholder"), "搜索文档");
  assert.equal(doc.querySelector('[aria-label="面包屑导航"]').getAttribute("aria-label"), "面包屑导航");
  assert.equal(doc.querySelector('[aria-label="页脚导航"]').getAttribute("aria-label"), "页脚导航");
  assert.equal(doc.querySelector('[aria-label="页脚导航"] a').textContent, "返回顶部 ↑");
});

test("r26 jsdom：k-means 被 <i> 切开的标签拼回后翻译", () => {
  const { doc } = boot(
    '<body><div class="view_settings_checkbox_wrap clustering_method_marker">' +
      '<input id="clustering_kmeans" name="network_clustering_algorithm" type="radio" value="kmeans">' +
      "<label for=\"clustering_kmeans\"><i>k</i>-means&nbsp;clustering</label>" +
      "</div></body>",
    "https://string-db.org/network/9606.ENSP00000269305"
  );
  assert.equal(doc.querySelector("label").textContent, "k 均值聚类");
});

test("r26 jsdom：断开节点下拉框与网格排列复选框", () => {
  const { doc } = boot(
    '<body><div class="view_settings_checkbox_wrap view_settings_dropdown_row">' +
      '<select id="disconnected_nodes" name="disconnected_nodes">' +
      '<option id="disconnected_nodes_distributed" value="distributed" selected="selected">Distributed</option>' +
      '<option id="disconnected_nodes_hidden" value="hidden">隐藏</option>' +
      '<option id="disconnected_nodes_bottom" value="bottom">Bottom grid</option>' +
      "</select>" +
      '<label for="disconnected_nodes">Disconnected nodes</label>' +
      "</div>" +
      '<div class="view_settings_checkbox_wrap"><input id="component_grid" type="checkbox">' +
      '<label for="component_grid">Arrange clusters and disconnected components in a grid</label></div>' +
      "</body>",
    "https://string-db.org/network/9606.ENSP00000269305"
  );
  const opts = [...doc.querySelectorAll("option")].map((o) => o.textContent);
  assert.deepEqual(opts, ["分散", "隐藏", "底部网格"]);
  assert.equal(doc.querySelector('label[for="disconnected_nodes"]').textContent, "非连通节点");
  assert.equal(
    doc.querySelector('label[for="component_grid"]').textContent,
    "将聚类与非连通组件按网格排列"
  );
});

test("r26 jsdom：帮助页固定说明句模板保留链接与换行", () => {
  const { doc } = boot(
    '<body><div class="section">' +
      '<h1 id="help-center">Help Center</h1>' +
      "<p>The help contains information how to use STRING's website and API. Please read it and check " +
      '<a href="./faq/">frequently asked questions</a> before requesting support.</p>' +
      '<p>For any further questions, suggestions, and feedback, please use our <br> ' +
      '<strong><a target="_blank" href="https://string-db.org/cgi/support">support request form</a>.</strong></p>' +
      "</div></body>",
    "https://string-db.org/help/"
  );
  const ps = [...doc.querySelectorAll("p")];
  assert.equal(ps[0].textContent, "本帮助介绍如何使用 STRING 网站与 API。请在请求支持前阅读并查看常见问题。");
  assert.equal(ps[0].querySelectorAll("a").length, 1);
  assert.equal(ps[1].textContent, "如有更多问题、建议或反馈，请使用支持请求表单。");
  assert.equal(ps[1].querySelector("a").getAttribute("href"), "https://string-db.org/cgi/support");
  assert.equal(ps[1].querySelector("br") !== null, true, "换行应保留");
});
