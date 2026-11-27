// STRING 网络页 focus bar / 下载页（/cgi/download）/ 页脚 增量词库回归（dict/string-atlas2.json）
// 站点真实词库栈 = common + string-atlas + 本册；jsdom 按**真实 DOM 节点边界**挂载（句子常被 <i>/<b> 切开）。
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
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/;
const SITE = { scope: "body", block: "pre, code", rescan: false };

function siteData() {
  const exact = {}, rules = [], templates = [];
  for (const f of ["common.json", "string-atlas.json", "string-atlas2.json"]) {
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

const DL = "https://string-db.org/cgi/download?species_text=Homo+sapiens";

// ---- 真实节点边界：focus bar（选中蛋白后的浮动操作条）----
const FOCUS_HTML =
  '<body><div id="nt_focus_bar" class="nt_focus_bar nt_open"><b>TP53</b>' +
  '<button class="nt_button" title="the proteins highlighted in the picture as a network of their own, in a new tab">open as new network</button>' +
  '<button class="nt_button" title="show in network">show in list</button>' +
  '<button class="nt_button clear" title="clear the selection (Esc)">clear</button>' +
  '</div></body>';

test("jsdom：网络页 focus bar（按钮文字 + title 属性两条通道）", () => {
  const { doc } = boot(FOCUS_HTML, "https://string-db.org/network/9606.ENSP00000269305");
  const bar = doc.querySelector("#nt_focus_bar");
  assert.equal(bar.querySelector("b").textContent, "TP53", "蛋白名不得被翻");
  const btns = [...bar.querySelectorAll("button")];
  assert.equal(btns[0].textContent, "作为新网络打开");
  assert.equal(btns[0].getAttribute("title"), "将图中高亮的蛋白质作为独立网络在新标签页中打开");
  assert.equal(btns[1].textContent, "在列表中显示");
  assert.equal(btns[1].getAttribute("title"), "在网络中显示");
  assert.equal(btns[2].getAttribute("title"), "清除选择（Esc）");
});

// ---- 下载页：设置单元格（<strong> 标签 + <br> + 正文，真实结构）----
const SETTINGS_HTML =
  '<body><div id="download_advanced_settings_wrapper">' +
  '<div class="download_page_organism_select_table_row">' +
  '<div class="download_page_organism_select_table_cell"><strong>Restrict data to a specific organism:</strong><br>' +
  'You can restrict the downloaded data to contain only the information related to your organism of interest. ' +
  'The filtered files will be prefixed with the taxonomic identifier of the selected species. Choose an organism here: </div>' +
  '<div><select id="speciesList" class="organism_choice_box_select"><option>Homo sapiens</option>' +
  '<option>reset (all organisms)</option></select></div></div>' +
  '<div class="download_page_organism_select_table_row">' +
  '<div class="download_page_organism_select_table_cell"><strong>Filter interactions based on the combined confidence score:</strong><br>' +
  'While all links in STRING are meaningful, some analyses might require only higher-confidence interactions, ' +
  'excluding the more exploratory part of the interaction spectrum. This can reduce file sizes by up to 90%. ' +
  '<i>Note:</i> Confidence scores in the files below are multiplied by 1000.</div>' +
  '<div class="data_settings_select_wrap"><select id="min_download_score_select" class="download_data_settings_select">' +
  '<option>all interactions (0.150)</option></select></div></div>' +
  '<div class="download_page_organism_select_table_row">' +
  '<div class="data_settings_select_wrap"><select id="filter_redundant_pairs_select">' +
  '<option>includes AB and BA pairs</option><option>includes AB pairs only</option></select></div></div>' +
  '<div class="download_page_organism_select_table_row">' +
  '<div class="data_settings_select_wrap"><select id="delimiter_type_select">' +
  '<option>TXT (space separated)</option><option>TSV (tab separated)</option><option>CSV (comma separated)</option></select></div></div>' +
  '<a class="as_label_left" href="#"><span class="advanced_plus_sign">+&nbsp;</span>Need more options? Click here.</a>' +
  '</div>' +
  '<h2>Files too large?</h2></body>';

test("jsdom：下载页设置区（物种限制 / 置信度 / 冗余对 / 分隔符 下拉项）", () => {
  const { doc, engine } = boot(SETTINGS_HTML, DL);
  const cells = [...doc.querySelectorAll(".download_page_organism_select_table_cell")];
  const labels = cells.map((c) => c.querySelector("strong").textContent);
  assert.deepEqual(labels, ["限制为特定物种的数据：", "按综合可信度得分筛选互作："]);
  // 长说明整句替换（不能半中半英）
  assert.match(cells[0].textContent, /您可以将下载的数据限制为只包含与所关注物种相关的信息/);
  assert.match(cells[0].textContent, /在此选择物种：/);
  assert.match(cells[1].textContent, /这最多可将文件缩小 90%/);
  assert.match(cells[1].textContent, /下方文件中的可信度得分均乘以 1000。/);
  // 物种名不得被翻
  assert.equal(doc.querySelector("#speciesList option").textContent, "Homo sapiens");
  const opts = [...doc.querySelectorAll("option")].map((o) => o.textContent);
  assert.deepEqual(opts.slice(1), [
    "重置（全部物种）",
    "全部互作（0.150）",
    "包含 AB 与 BA 对",
    "仅包含 AB 对",
    "TXT（空格分隔）",
    "TSV（制表符分隔）",
    "CSV（逗号分隔）"
  ]);
  assert.equal(doc.querySelector("h2").textContent, "文件太大？");
  // 「+ Need more options?」的加号是 <span> 槽位，必须留在原位
  const more = doc.querySelector("a.as_label_left");
  assert.equal(more.textContent.replace(/\s+/g, " ").trim(), "+ 需要更多选项？点此。");
  assert.ok(engine);
});

// ---- 下载页：表标题/表头/数据行（文件名与体积是数据，不译）----
const TABLE_HTML =
  '<body><div class="download_table_headline"><h2>Interaction Data</h2></div>' +
  '<div class="download_table"><div class="download_table_header_row">' +
  '<div>File</div><div>Description</div><div>Access</div></div>' +
  '<div class="download_table_data_row">' +
  '<div><a class="download_file" href="#">.protein.links.v12.5.txt.gz</a></div>' +
  '<div><span>59.9 MB</span></div>' +
  '<div>protein network data (full network, scored links between proteins)</div>' +
  '<div><a href="#">(see documentation)</a></div>' +
  '</div>' +
  '<div class="download_table_data_row">' +
  '<div><a class="download_file" href="#">.protein.orthology.v12.5.txt.gz</a></div>' +
  '<div><span class="autocolor_new_span">New</span></div>' +
  '<div>hierarchical eggNOG orthologous groups and their proteins</div>' +
  '</div>' +
  '<div class="download_table_data_row">' +
  '<div><a class="download_file" href="#">database.schema.v12.5.pdf</a></div>' +
  '<div><span>coming soon</span></div>' +
  '<div>STRING database schema</div>' +
  '</div>' +
  '<div class="download_table_headline"><h2>Accessory Data</h2></div>' +
  '<div class="download_table_headline"><h2>Full Database Dumps</h2></div></body>';

test("jsdom：下载页表标题/表头/描述列（文件名、体积、[HD] 类数据不译）", () => {
  const { doc } = boot(TABLE_HTML, DL);
  const heads = [...doc.querySelectorAll(".download_table_headline h2")].map((h) => h.textContent);
  assert.deepEqual(heads, ["互作数据", "附属数据", "完整数据库转储"]);
  const th = [...doc.querySelectorAll(".download_table_header_row div")].map((d) => d.textContent);
  assert.equal(th[0], "文件");
  assert.equal(th[2], "访问");
  const rows = [...doc.querySelectorAll(".download_table_data_row")];
  const desc = rows.map((r) => r.children[2].textContent);
  assert.deepEqual(desc, [
    "蛋白质网络数据（完整网络，蛋白质之间带得分的链接）",
    "eggNOG 层次直系同源组及其蛋白质",
    "STRING 数据库模式"
  ]);
  // 文件名与体积是数据：整条保持英文
  for (const a of doc.querySelectorAll(".download_file")) assert.equal(CJK.test(a.textContent), false, "文件名被翻了: " + a.textContent);
  assert.equal(doc.querySelectorAll(".download_table_data_row")[0].children[0].textContent, ".protein.links.v12.5.txt.gz");
  assert.equal(doc.querySelectorAll(".download_table_data_row")[0].children[1].textContent, "59.9 MB");
  assert.equal(doc.querySelector(".autocolor_new_span").textContent, "新增");
  assert.equal(rows[0].querySelector("a[href]").closest(".download_table_data_row"), rows[0]);
  assert.equal(rows[0].children[3].textContent, "（见文档）");
  assert.equal(rows[2].children[1].textContent, "即将推出");
});

// ---- 由 <i> 切开的段落：碎片不译（否则半中半英），只译独立成句的尾巴 ----
const SPLIT_HTML =
  '<body><div class="download_page_organism_select_table_cell">' +
  '<strong>Remove redundant interaction pairs (AB-BA):</strong><br>' +
  'By default, the <i>links files</i> encode interactions in both directions (AB and BA). However, since ' +
  'functional and physical interactions are symmetric, recording them once (AB) is sufficient without losing ' +
  'information. This reduces <i>links file</i> sizes by 50%. This does not apply to regulatory links, where ' +
  'column order signifies directionality (A-&gt;B).<i>Note:</i> This choice does not impact the content or file size.' +
  '</div></body>';

test("jsdom：<i> 切开的段落只译标签与独立末句，碎片保持英文", () => {
  const { doc } = boot(SPLIT_HTML, DL);
  const cell = doc.querySelector(".download_page_organism_select_table_cell");
  assert.equal(cell.querySelector("strong").textContent, "去重互作对（AB-BA）：");
  // 被 <i> 切开的那几句无法整句命中，保持英文（宁可留英文，不可半中半英）
  const its = [...cell.querySelectorAll("i")].map((i) => i.textContent);
  assert.ok(its.includes("links files"), "<i> 碎片不得被单独翻译: " + its.join(" | "));
  assert.ok(its.includes("links file"), "<i> 碎片不得被单独翻译: " + its.join(" | "));
  for (const t of its) assert.equal(CJK.test(t), false, "碎片被译成中文会半中半英: " + t);
  assert.match(cell.textContent, /By default, the/);
  assert.match(cell.textContent, /This reduces/);
});

// ---- 页脚：Access 译，机构专名保留 ----
const FOOT_HTML =
  '<body><div id="footer"><div class="column"><h2><a href="#">Access</a></h2></div>' +
  '<ul><li id="SIB_logo"><a href="#">SIB - Swiss Institute of Bioinformatics</a></li>' +
  '<li id="CPR_logo"><a href="#">CPR - Novo Nordisk Foundation Center Protein Research</a></li>' +
  '<li id="EMBL_logo"><a href="#">EMBL - European Molecular Biology Laboratory</a></li>' +
  '<li><a href="#">ELIXIR</a></li></ul>' +
  '<div class="elixir_cdr_message">STRING is a Core Data Resource as designated by ELIXIR.</div></div></body>';

test("jsdom：页脚 Access 译出，SIB/CPR/EMBL/ELIXIR 机构名保持原文", () => {
  const { doc } = boot(FOOT_HTML, "https://string-db.org/");
  assert.equal(doc.querySelector("#footer h2 a").textContent, "访问");
  assert.equal(doc.querySelector("#SIB_logo a").textContent, "SIB - Swiss Institute of Bioinformatics");
  assert.equal(doc.querySelector("#CPR_logo a").textContent, "CPR - Novo Nordisk Foundation Center Protein Research");
  assert.equal(doc.querySelector("#EMBL_logo a").textContent, "EMBL - European Molecular Biology Laboratory");
  assert.equal(doc.querySelectorAll("#footer li a")[3].textContent, "ELIXIR");
});

// ---- 词库卫生：新增条目整条匹配、无半中半英碎片 ----
test("词库结构：新增条目合规（无中文键、无连续空白、键长 ≤240、译文含汉字）", () => {
  const dict = read("string-atlas2.json");
  assert.equal(dict.meta.family, "string-atlas2");
  const exact = Object.entries(dict.exact || {});
  assert.ok(exact.length >= 100, "exact 太少: " + exact.length);
  const bad = [];
  for (const [en, zh] of exact) {
    if (!en || en !== en.trim()) bad.push("键首尾空白: " + JSON.stringify(en));
    if (/\s\s/.test(en)) bad.push("键含连续空白: " + JSON.stringify(en));
    if (CJK.test(en)) bad.push("键含中文: " + en);
    if (!zh || zh !== zh.trim()) bad.push("译文首尾空白: " + en);
    if (!CJK.test(zh)) bad.push("译文无中文: " + en);
    if (en.length > 240) bad.push("键过长: " + en.length + " " + en.slice(0, 40));
  }
  assert.deepEqual(bad, []);
});

test("词库行为：新条目整条命中，且不误伤内容/碎片", () => {
  const { engine } = boot("<body></body>", DL);
  const cases = [
    ["Files too large?", "文件太大？"],
    ["reset (all organisms)", "重置（全部物种）"],
    ["New", "新增"],
    ["coming soon", "即将推出"],
    ["(see documentation)", "（见文档）"],
    ["File", "文件"],
    ["Access", "访问"],
    ["Accessory Data", "附属数据"],
    ["Interaction Data", "互作数据"],
    ["CSV (comma separated)", "CSV（逗号分隔）"],
    ["hierarchical STRING clusters tree (represented as child-parent relationship)", "STRING 层次聚类树（以子-父关系表示）"],
    ["LCA orthologous groups (COGs,NOGs,KOGs,...) and their proteins", "LCA 直系同源组（COG、NOG、KOG 等）及其蛋白质"],
    ["full database, part III: interaction evidence (but: excluding license-restricted data)", "完整数据库，第三部分：互作证据（不含许可受限数据）"]
  ];
  for (const [en, zh] of cases) assert.equal(engine.translateText(en), zh, "未命中: " + en);
  // 碎片与数据不得被单独替换（translateText 未命中返回 null）
  for (const en of ["links files", "links file", "By default, the", "1.9 MB", "ENSP00000269305", "Homo sapiens", ".protein.links.v12.5.txt.gz"]) {
    assert.equal(engine.translateText(en), null, "不该译: " + en);
  }
});
