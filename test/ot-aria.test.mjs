// Open Targets Platform 词库（opentargets）属性通道回归：Read more 族、社交、分页、图表 aria、组织名、数据源标签与"不该翻"的数据串
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/opentargets.json"), "utf8"));

// 站点条目以 config/sites.json 为准；OT 不声明 attrs，走引擎默认通道（title/aria-label/alt/placeholder）。
const projectedSite = {
  id: "opentargets",
  name: "Open Targets Platform",
  hosts: ["platform.opentargets.org"],
  dicts: ["common", "spa", "opentargets"],
  scope: "body",
  spa: true,
  waitFor: "main, #root"
};
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const configSite = sites.find((s) => s.id === "opentargets");
const site = Object.assign({}, projectedSite, configSite || {}, {
  id: "opentargets",
  dicts: (configSite && configSite.dicts && configSite.dicts.length) ? configSite.dicts : ["common", "spa", "opentargets"],
  scope: (configSite && configSite.scope) || "body"
});
const dictIds = Array.isArray(site.dicts) && site.dicts.length ? site.dicts : ["common", "spa", "opentargets"];

const data = { exact: {}, rules: [], templates: [] };
for (const id of dictIds) {
  const b = JSON.parse(fs.readFileSync(path.join(root, "../dict", id + ".json"), "utf8"));
  Object.assign(data.exact, b.exact || {});
  data.rules = data.rules.concat(b.rules || []);
  data.templates = data.templates.concat(b.templates || []);
}

function run(html) {
  const dom = new JSDOM("<body>" + html + "</body>");
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return dom.window.document;
}
function plain(doc) {
  return doc.body.textContent.replace(/\s+/g, " ").trim();
}
function text(el) {
  return el.textContent.replace(/\s+/g, " ").trim();
}

test("词库结构：条数、键值形态、规则可编译、模板槽位连续", () => {
  assert.equal(book.meta.family, "opentargets");
  assert.ok(book.meta.sites.includes("platform.opentargets.org"), "meta.sites 要声明 host");
  assert.ok(Object.keys(book.exact).length >= 400, "exact 至少 400 条");
  assert.ok(book.rules.length >= 24, "rules 至少 24 条");
  assert.ok(book.templates.length >= 32, "templates 至少 32 条");

  const seen = new Set();
  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "键里不能有中文: " + k);
    assert.ok(/[\u4e00-\u9fff]/.test(v), "译文里必须有中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "键首尾不能有空白: " + JSON.stringify(k));
    assert.equal(v, v.trim(), "译文首尾不能有空白: " + JSON.stringify(v));
    assert.ok(!/https?:\/\/[^\s）]+\.[a-z]/i.test(v), "译文里不能有明文 URL: " + k);
    assert.ok(!seen.has(k), "重复键: " + k);
    seen.add(k);
  }
  for (const r of book.rules) {
    const re = new RegExp(r.re);
    assert.ok(re.source.length > 0);
    assert.ok(/[\u4e00-\u9fff]/.test(r.to), "规则译文里必须有中文: " + r.re);
    if (/\([^)]*\)/.test(r.re)) assert.ok(/\$\d/.test(r.to), "带捕获组的规则要用到占位符: " + r.re);
  }
  for (const t of book.templates) {
    const used = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.ok(used.length >= 1, "模板要带槽位: " + t.pat);
    assert.ok(t.pat.length >= 10 && t.pat.length <= 2200, "模板长度越界: " + t.pat.length);
    const sorted = used.slice().sort((a, b) => a - b);
    sorted.forEach((n, i) => assert.equal(n, i + 1, "槽位必须从 1 连续: " + t.pat));
    const zhUsed = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.deepEqual(zhUsed.slice().sort((a, b) => a - b), sorted, "译文槽位要与原文一致");
  }
});

test("站点条目：dicts 里 common 在前、本册最后；不额外声明 attrs", () => {
  assert.deepEqual(site.dicts, ["common", "spa", "opentargets"], "common 垫底、本册覆盖在其上");
  assert.ok(site.hosts.includes("platform.opentargets.org"));
  assert.ok(!site.attrs || site.attrs.length === 0, "aria-label/title 走引擎默认通道，站点不需要补 attrs");
});

test("Read more 族：aria-label 翻成中文，链接文字与 href 不动，机构名保留英文", () => {
  const doc = run(
    '<footer>' +
      '<a href="/community" aria-label="Read more about Community forum on this link">Community forum</a>' +
      '<a href="/privacy" aria-label="Read more about Privacy notice on this link">Privacy notice</a>' +
      '<a href="/terms" aria-label="Read more about Terms of use on this link">Terms of use</a>' +
      '<a href="/docs" aria-label="Read more about Documentation on this link">Documentation</a>' +
      '<a href="https://www.ebi.ac.uk" aria-label="Read more about EMBL-EBI on this link">EMBL-EBI</a>' +
      '<a href="https://creativecommons.org" aria-label="Read more about creative commons license on this link">CC0 1.0</a>' +
      "</footer>"
  );
  const as = [...doc.querySelectorAll("a")];
  assert.equal(as[0].getAttribute("aria-label"), "在链接中进一步了解 社区论坛");
  assert.equal(as[1].getAttribute("aria-label"), "在链接中进一步了解 隐私声明");
  assert.equal(as[2].getAttribute("aria-label"), "在链接中进一步了解 使用条款");
  assert.equal(as[3].getAttribute("aria-label"), "在链接中进一步了解 文档");
  assert.equal(as[4].getAttribute("aria-label"), "在链接中进一步了解 EMBL-EBI", "机构名保留英文");
  assert.equal(as[5].getAttribute("aria-label"), "在链接中进一步了解 知识共享许可协议");
  assert.deepEqual(as.map((a) => a.textContent), ["社区论坛", "隐私声明", "使用条款", "文档", "EMBL-EBI", "CC0 1.0"]);
  assert.deepEqual(as.map((a) => a.getAttribute("href")), ["/community", "/privacy", "/terms", "/docs", "https://www.ebi.ac.uk", "https://creativecommons.org"]);
});

test("Read more 规则是锚定的：换掉 on this link 就不动", () => {
  const doc = run('<a href="/x" aria-label="Read more about Community forum on this page">x</a>');
  assert.equal(doc.querySelector("a").getAttribute("aria-label"), "Read more about Community forum on this page");
});

test("社交链接：aria-label 翻中文，品牌名保留", () => {
  const doc = run(
    '<nav>' +
      '<a href="https://twitter.com/opentargets" aria-label="Go to OpenTargets twitter">t</a>' +
      '<a href="https://linkedin.com" aria-label="Go to OpenTargets linkedin">l</a>' +
      '<a href="https://youtube.com" aria-label="Go to OpenTargets youtube">y</a>' +
      '<a href="https://github.com" aria-label="Go to OpenTargets github">g</a>' +
      "</nav>"
  );
  const labels = [...doc.querySelectorAll("a")].map((a) => a.getAttribute("aria-label"));
  assert.deepEqual(labels, [
    "前往 OpenTargets 的 Twitter",
    "前往 OpenTargets 的 LinkedIn",
    "前往 OpenTargets 的 YouTube",
    "前往 OpenTargets 的 GitHub"
  ]);
});

test("分页：MUI 按钮的 aria-label 与 title 同步翻，表格分页与每页行数下拉", () => {
  const doc = run(
    '<div class="pager">' +
      '<button title="Go to previous page" aria-label="Go to previous page">‹</button>' +
      '<button title="Go to next page" aria-label="Go to next page">›</button>' +
      '<button aria-label="First result page of table">|‹</button>' +
      '<button aria-label="Previous result page of table">‹</button>' +
      '<button aria-label="Next result page of table">›</button>' +
      '<button aria-label="Last result page of table">›|</button>' +
      '<select aria-label="Rows per page select dropdown"><option>10</option></select>' +
      "</div>"
  );
  const btns = [...doc.querySelectorAll("button")];
  assert.equal(btns[0].getAttribute("aria-label"), "上一页");
  assert.equal(btns[0].getAttribute("title"), "上一页");
  assert.equal(btns[1].getAttribute("aria-label"), "下一页");
  assert.equal(btns[1].getAttribute("title"), "下一页");
  assert.deepEqual(btns.slice(2).map((b) => b.getAttribute("aria-label")), [
    "表格第一页",
    "表格上一页",
    "表格下一页",
    "表格最后一页"
  ]);
  assert.equal(doc.querySelector("select").getAttribute("aria-label"), "每页行数下拉选择");
});

test("分页文本：Rows per page: 标签翻中文，数字选项保持", () => {
  const doc = run('<div><label>Rows per page:</label><select><option>10</option><option>20</option></select></div>');
  const text = plain(doc);
  assert.ok(text.includes("每页行数："), text);
  assert.ok(text.includes("10") && text.includes("20"), "选项数字不翻: " + text);
});

test("图表 aria：ECharts 生成的坐标轴/图元标签在 SVG 里也翻", () => {
  const doc = run(
    '<svg width="300" height="200">' +
      '<g aria-label="x-axis tick"><text>0</text></g>' +
      '<g aria-label="y-axis tick label"><text>10</text></g>' +
      '<g aria-label="x-axis label"><text>Score</text></g>' +
      '<g aria-label="crosshair rule"><line x1="1" y1="1" x2="2" y2="2"></line></g>' +
      '<g aria-label="crosshair text"><text>1.2</text></g>' +
      '<g aria-label="x-grid"><line x1="0" y1="0" x2="0" y2="1"></line></g>' +
      '<g aria-label="bar"><rect width="4" height="9"></rect></g>' +
      '<g aria-label="dot"><circle r="2"></circle></g>' +
      '<g aria-label="tick"><line></line></g>' +
      "</svg>"
  );
  const labels = [...doc.querySelectorAll("g")].map((g) => g.getAttribute("aria-label"));
  assert.deepEqual(labels, [
    "X 轴刻度",
    "Y 轴刻度标签",
    "X 轴标签",
    "十字准线",
    "十字准线文本",
    "X 轴网格",
    "柱形",
    "数据点",
    "刻度"
  ]);
});

test("视图切换与其它控件文案", () => {
  const doc = run(
    '<div role="group">' +
      '<button aria-label="Switch to table view">表</button>' +
      '<button aria-label="Switch to chart view">图</button>' +
      '<div aria-label="toggle view"></div>' +
      '<div aria-label="simple tabs example"></div>' +
      '<button aria-label="open header menu">≡</button>' +
      '<div aria-label="Subcellular location sources"></div>' +
      '<input aria-label="date-range-slider" type="range">' +
      "</div>"
  );
  assert.equal(doc.querySelectorAll("button")[0].getAttribute("aria-label"), "切换到表格视图");
  assert.equal(doc.querySelectorAll("button")[1].getAttribute("aria-label"), "切换到图表视图");
  const divs = [...doc.querySelectorAll("div[aria-label]")].map((d) => d.getAttribute("aria-label"));
  assert.deepEqual(divs, ["切换视图", "标签页示例", "亚细胞定位来源"]);
  assert.equal(doc.querySelectorAll("button")[2].getAttribute("aria-label"), "打开页头菜单");
  assert.equal(doc.querySelector("input").getAttribute("aria-label"), "日期范围滑块");
});

test("组织名：可见文本与 aria-label 两条通道都翻；数据里的基因名不动", () => {
  const doc = run(
    '<div class="tissues">' +
      "<span>liver</span><span>lung</span><span>kidney</span><span>heart</span><span>brain</span>" +
      "<span>thyroid gland</span><span>lymph node</span><span>skin of body</span><span>bone element</span>" +
      '<span aria-label="adipose tissue"></span><span aria-label="saliva-secreting gland"></span>' +
      "</div>" +
      '<div class="genes"><span>TP53</span><span>MDM2</span><span>Q00987</span></div>'
  );
  const body = plain(doc);
  ["肝", "肺", "肾", "心脏", "脑", "甲状腺", "淋巴结", "体表皮肤", "骨"].forEach((zh) => {
    assert.ok(body.includes(zh), "缺组织译名 " + zh + ": " + body);
  });
  const spans = [...doc.querySelectorAll(".tissues span")];
  assert.equal(spans[9].getAttribute("aria-label"), "脂肪组织");
  assert.equal(spans[10].getAttribute("aria-label"), "唾液腺");
  assert.deepEqual([...doc.querySelectorAll(".genes span")].map((s) => s.textContent), ["TP53", "MDM2", "Q00987"], "基因名与 UniProt 登录号不翻");
});

test("数据串不翻：Score/ID 提示、ID: 登录号、坐标、快捷键", () => {
  const doc = run(
    '<div class="nodes">' +
      '<div title="Score: 0.8846829052014947 ID: ENSG00000104881">x</div>' +
      '<div title="ID: ENSG00000141510">y</div>' +
      '<div title="TP53">z</div>' +
      '<span>Chr17: 7661779-7687546,-</span>' +
      '<span>Ctrl+K</span>' +
      "</div>"
  );
  const divs = [...doc.querySelectorAll(".nodes div")];
  assert.equal(divs[0].getAttribute("title"), "Score: 0.8846829052014947 ID: ENSG00000104881");
  assert.equal(divs[1].getAttribute("title"), "ID: ENSG00000141510");
  assert.equal(divs[2].getAttribute("title"), "TP53");
  const nodesText = text(doc.querySelector(".nodes"));
  assert.ok(nodesText.includes("Chr17: 7661779-7687546,-"), nodesText);
  assert.ok(nodesText.includes("Ctrl+K"), nodesText);
});

test("数据源与基因组坐标说明：Source 规则与既有 exact 并存", () => {
  const doc = run(
    '<div class="src">' +
      '<span aria-label="Source: UniProt, Entrez"></span>' +
      '<span aria-label="Source: HGNC"></span>' +
      '<span aria-label="Source: HGNC, UniProt, Entrez"></span>' +
      '<span aria-label="Gene body: build | chromosome:start-end,strand"></span>' +
      '<span aria-label="Canonical transcript: build | chromosome:start-end,strand"></span>' +
      '<p>Source:</p>' +
      "</div>"
  );
  const spans = [...doc.querySelectorAll(".src span")];
  assert.equal(spans[0].getAttribute("aria-label"), "来源：UniProt, Entrez");
  assert.equal(spans[1].getAttribute("aria-label"), "来源：HGNC");
  assert.equal(spans[2].getAttribute("aria-label"), "来源：HGNC, UniProt, Entrez");
  assert.equal(spans[3].getAttribute("aria-label"), "基因体：build | chromosome:start-end,strand");
  assert.equal(spans[4].getAttribute("aria-label"), "经典转录本：build | chromosome:start-end,strand");
  assert.equal(text(doc.querySelector(".src p")), "来源：");
});

test("证据角色与实验方法标签（固定枚举）翻中文", () => {
  const doc = run(
    '<div class="ev">' +
      '<span aria-label="unspecified role"></span>' +
      '<span aria-label="enzyme target"></span>' +
      '<span aria-label="competitor"></span>' +
      '<span aria-label="ubiquitinase assay"></span>' +
      '<span aria-label="western blot"></span>' +
      '<span aria-label="Ensembl variant effect predictor"></span>' +
      '<span aria-label="SuSiE fine-mapped credible set with in-sample LD"></span>' +
      '<span aria-label="Variant effect on protein function"></span>' +
      '<span aria-label="UniProt SigP or TMHMM"></span>' +
      '<span aria-label="Beta with respect to the ALT allele"></span>' +
      '<span>In vitro</span><span>ubiquitination</span>' +
      "</div>"
  );
  const spans = [...doc.querySelectorAll(".ev span")];
  assert.deepEqual(spans.slice(0, 10).map((s) => s.getAttribute("aria-label")), [
    "未指定角色",
    "酶靶点",
    "竞争物",
    "泛素化酶实验",
    "蛋白质印迹",
    "Ensembl 变异效应预测器",
    "SuSiE 使用样本内 LD 精细定位的可信集",
    "变异对蛋白功能的影响",
    "UniProt SigP 或 TMHMM",
    "相对于 ALT 等位基因的 Beta 值"
  ]);
  const text = plain(doc);
  assert.ok(text.includes("体外"), text);
  assert.ok(text.includes("泛素化"), text);
});

test("VEP 后果枚举：No sequence alteration / 3 prime utr variant", () => {
  const doc = run('<div class="vep"><span>No sequence alteration</span><span>3 prime utr variant</span><span>3 prime UTR</span></div>');
  const spans = [...doc.querySelectorAll(".vep span")].map((s) => s.textContent);
  assert.deepEqual(spans, ["无序列改变", "3′ UTR 变异", "3′ 非翻译区"]);
});

test("CC0 许可图片规则", () => {
  const doc = run(
    '<img alt="cc0 license image 1" src="cc0.png"><img aria-label="cc0 license image 2" src="cc0.png">'
  );
  assert.equal(doc.querySelectorAll("img")[0].getAttribute("alt"), "CC0 许可标志 1");
  assert.equal(doc.querySelectorAll("img")[1].getAttribute("aria-label"), "CC0 许可标志 2");
});

test("页脚 CC0 整句模板：链接保住、句子翻成中文", () => {
  const doc = run(
    '<span class="cap">' +
      '<a href="https://platform.opentargets.org/" aria-label="Read more about Open Targets Platform on this link">Open Targets Platform</a>' +
      " is marked with " +
      '<a href="http://creativecommons.org/publicdomain/zero/1.0?ref=chooser-v1" aria-label="Read more about creative commons license on this link">CC0 1.0</a>' +
      "</span>"
  );
  const span = doc.querySelector(".cap");
  assert.equal(plain(doc), "Open Targets Platform 采用 CC0 1.0 许可协议");
  const as = [...span.querySelectorAll("a")];
  assert.equal(as.length, 2, "模板替换不能把链接吃掉");
  assert.equal(as[0].getAttribute("href"), "https://platform.opentargets.org/");
  assert.equal(as[1].getAttribute("href"), "http://creativecommons.org/publicdomain/zero/1.0?ref=chooser-v1");
  assert.equal(as[0].textContent, "Open Targets Platform");
  assert.equal(as[1].textContent, "CC0 1.0");
  assert.equal(as[0].getAttribute("aria-label"), "在链接中进一步了解 Open Targets Platform");
});

test("长证据句不翻：药物基因组学 sup 的整句说明保持英文", () => {
  const sentence =
    "Patients with breast cancer and the TT genotype may have a decreased risk of developing neutropenia when treated with cyclophosphamide, epirubicin and fluorouracil as compared to patients with the CC or CT genotypes. Other genetic and clinical factors may also affect a patient's risk of developing neutropenia.";
  const doc = run('<table><tbody><tr><td>rs4244285</td><td><sup aria-label="' + sentence + '">i</sup></td></tr></tbody></table>');
  assert.equal(doc.querySelector("sup").getAttribute("aria-label"), sentence);
});

test("搜索框 placeholder：Search all columns... 翻中文，Search... 走既有词条", () => {
  const doc = run('<input placeholder="Search all columns..."><input placeholder="Search...">');
  const ins = [...doc.querySelectorAll("input")];
  assert.equal(ins[0].getAttribute("placeholder"), "搜索所有列...");
  assert.equal(ins[1].getAttribute("placeholder"), "搜索...");
});

test("Logo alt 与既有译法一致", () => {
  const doc = run('<img alt="logo" src="logo.png">');
  assert.equal(doc.querySelector("img").getAttribute("alt"), "标志");
});
