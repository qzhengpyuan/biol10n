// r29 UCSC 悬停说明与 hgTracks 右键菜单：新增 exact/rules 只覆盖界面固定句。
// 口径：轨道名、基因名、编号、坐标、HTML tooltip 里的数据一律保留（见文件末尾的「不翻」用例）。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "ucsc");

function load() {
  const exact = {};
  const rules = [];
  const templates = [];
  for (const n of site.dicts) {
    const d = JSON.parse(fs.readFileSync(path.join(root, "../dict/" + n + ".json"), "utf8"));
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
    templates.push(...(d.templates || []));
  }
  return { exact, rules, templates };
}

function boot() {
  const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", {
    url: "https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38"
  });
  const doc = dom.window.document;
  const engine = createEngine({ document: doc, window: dom.window, data: load(), site });
  return { dom, doc, engine };
}

test("hgTracks 轨道标签 mouseovertext：Base Position 换行提示 + 高亮菜单提示", () => {
  const { doc, engine } = boot();
  const root = doc.getElementById("root");
  const a = doc.createElement("a");
  a.id = "highlightHereMenu";
  a.setAttribute("mouseovertext", "Base Position \nclick or right click to configure...");
  root.appendChild(a);
  const b = doc.createElement("a");
  b.setAttribute(
    "mouseovertext",
    "Add a highlight that covers the entire currently shown region, using the default color. Keyboard shortcut memo is "
  );
  root.appendChild(b);
  const btn = doc.createElement("button");
  btn.id = "highlightThis";
  btn.setAttribute(
    "mouseovertext",
    "Add a highlight that covers the entire region shown&lt;br&gt;&lt;i&gt;Keyboard shortcut:&lt;/i&gt; h, then m"
  );
  root.appendChild(btn);
  // 轨道名本身不翻（同一元素上只有轨道名时保持英文）
  const name = doc.createElement("a");
  name.className = "trackLink";
  name.setAttribute("mouseovertext", "GENCODE V50");
  root.appendChild(name);

  engine.start();

  assert.equal(a.getAttribute("mouseovertext"), "碱基位置：点击或右键单击可配置");
  assert.equal(
    b.getAttribute("mouseovertext"),
    "添加一个覆盖当前整个显示区域的高亮，使用默认颜色。键盘快捷键提示："
  );
  assert.equal(
    btn.getAttribute("mouseovertext"),
    "添加一个覆盖当前整个显示区域的高亮。键盘快捷键：先按 h，再按 m"
  );
  assert.equal(name.getAttribute("mouseovertext"), "GENCODE V50", "轨道名不翻");
});

test("hgTracks 右键菜单固定项：轨道菜单与轨道集菜单", () => {
  const { doc, engine } = boot();
  const root = doc.getElementById("root");
  const texts = [
    " Hide all other tracks ",
    " Move to top ",
    " Move to bottom ",
    " Configure GENCODE V50",
    " Configure OMIM track set...",
    " Track Description GENCODE V50",
    " Change Track Color",
    " Reset filters to defaults",
    " View image"
  ];
  const holders = texts.map((t) => {
    const row = doc.createElement("div");
    row.className = "context-menu-item";
    const inner = doc.createElement("div");
    inner.className = "context-menu-item-inner";
    inner.textContent = t;
    row.appendChild(inner);
    root.appendChild(row);
    return inner;
  });

  engine.start();

  assert.deepEqual(
    holders.map((e) => e.textContent.trim()),
    [
      "隐藏其他所有轨道",
      "移至顶部",
      "移至底部",
      "配置 GENCODE V50",
      "配置 OMIM 轨道集……",
      "轨道说明：GENCODE V50",
      "更改轨道颜色",
      "将过滤器重置为默认值",
      "查看图像"
    ]
  );
});

test("规则不外溢：Configure track 仍走整条 exact，单独 Base Position 不变", () => {
  const { doc, engine } = boot();
  const root = doc.getElementById("root");
  const span = doc.createElement("span");
  span.textContent = "Configure track";
  root.appendChild(span);
  const alone = doc.createElement("span");
  alone.textContent = "Base Position";
  root.appendChild(alone);

  engine.start();

  assert.equal(span.textContent, "配置轨道");
  assert.equal(alone.textContent, "碱基位置", "整条词条命中，与规则无关");
});

test("属性内 HTML 分段翻译：标签原样保留、只翻文本段", () => {
  const { doc, engine } = boot();
  const root = doc.getElementById("root");
  const graphEdge = doc.createElement("area");
  graphEdge.setAttribute(
    "title",
    "<b>INS-PRKAG1</b> <ul><li>No curated information<li>Text-mining: 49 abstracts e.g. <i>In order to characterise interactions ...</i></ul> <small>Click link to show details</small>"
  );
  root.appendChild(graphEdge);
  const graphGene = doc.createElement("area");
  graphGene.setAttribute(
    "title",
    "<b>protein kinase, AMP-activated, gamma 1 non-catalytic subunit</b> <br> Regulatory/other subunit, kinase modulator"
  );
  root.appendChild(graphGene);
  const itemTip = doc.createElement("area");
  itemTip.setAttribute(
    "title",
    "<b>Transcript:</b> ENST00001112636.1<br><b>Strand:</b> +<br><b>Intron:</b> Intron 1 of 3&nbsp;&nbsp;<b>Length:</b> 122920 bp<br>"
  );
  root.appendChild(itemTip);

  engine.start();

  assert.equal(
    graphEdge.getAttribute("title"),
    "<b>INS-PRKAG1</b> <ul><li>无人工策展信息<li>文本挖掘：49 篇摘要，例如 <i>In order to characterise interactions ...</i></ul> <small>点击链接查看详情</small>",
    "固定说明句翻、标签与摘要正文原样"
  );
  assert.equal(
    graphGene.getAttribute("title"),
    "<b>protein kinase, AMP-activated, gamma 1 non-catalytic subunit</b> <br> Regulatory/other subunit, kinase modulator",
    "基因全名与蛋白类型是数据，保持原文"
  );
  assert.equal(
    itemTip.getAttribute("title"),
    "<b>转录本：</b> ENST00001112636.1<br><b>链：</b> +<br><b>内含子：</b> 第 1 个（共 3 个）&nbsp;&nbsp;<b>长度：</b> 122920 bp<br>",
    "标签逐个翻，accession/坐标/长度值保留，&nbsp; 缩进不变"
  );
});
