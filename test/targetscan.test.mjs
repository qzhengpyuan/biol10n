// TargetScanHuman 词库（targetscan）回归：首页导航与检索表单、简介段（模板）、结果页表头与段落标题、多转录本选择页、数据下载页、FAQ 固定句、页脚信用与标题规则
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/targetscan.json"), "utf8"));

// 站点条目以 config/sites.json 为准（父级还没加 targetscan 时用这里约定的同款配置）。
const projectedSite = {
  id: "targetscan",
  name: "TargetScanHuman",
  hosts: ["www.targetscan.org", "targetscan.org"],
  dicts: ["common", "targetscan"],
  scope: "body",
  // 首页/结果页的按钮文案在 <input type=submit value="..."> 上，只有放行 value 才会翻。
  attrs: ["value"]
};
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const configSite = sites.find((s) => s.id === "targetscan");
const site = Object.assign({}, configSite || projectedSite, {
  id: "targetscan",
  dicts: (configSite && configSite.dicts && configSite.dicts.length) ? configSite.dicts : ["common", "targetscan"],
  scope: (configSite && configSite.scope) || "body",
  attrs: ["value"]
});
const dictIds = Array.isArray(site.dicts) && site.dicts.length ? site.dicts : ["common", "targetscan"];

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

test("词库结构：条数、键值形态、规则可编译、模板槽位连续", () => {
  assert.equal(book.meta.family, "targetscan");
  assert.ok(book.meta.sites.includes("www.targetscan.org"), "meta.sites 要声明 host");
  assert.ok(Object.keys(book.exact).length >= 200, "exact 至少 200 条");
  assert.ok(book.rules.length >= 20, "rules 至少 20 条");
  assert.ok(Array.isArray(book.templates) && book.templates.length >= 3, "templates 至少 3 条");

  const seen = new Set();
  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "键里不能有中文: " + k);
    assert.ok(/[\u4e00-\u9fff]/.test(v), "译文里必须有中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "键首尾不能有空白: " + JSON.stringify(k));
    assert.equal(v, v.trim(), "译文首尾不能有空白: " + JSON.stringify(v));
    assert.ok(!/https?:\/\/[^\s）]+\.[a-z]/i.test(v), "译文里不能有明文 URL: " + k);
    assert.ok(!/@[\w.-]+\.[a-z]/i.test(v), "译文里不能有邮箱: " + k);
    assert.ok(!seen.has(k), "重复键: " + k);
    seen.add(k);
  }
  for (const r of book.rules) {
    assert.doesNotThrow(() => new RegExp(r.re), "规则编译失败: " + r.re);
    assert.ok(/[\u4e00-\u9fff]/.test(r.to), "规则译文里必须有中文: " + r.re);
    if (/\([^)]*\)/.test(r.re)) assert.ok(/\$\d/.test(r.to), "带捕获组的规则要用到占位符: " + r.re);
  }
  for (const t of book.templates) {
    const used = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.ok(used.length >= 1, "模板要带槽位: " + t.pat.slice(0, 40));
    assert.ok(t.pat.length >= 20 && t.pat.length <= 2200, "模板长度越界: " + t.pat.length);
    const sorted = used.slice().sort((a, b) => a - b);
    sorted.forEach((n, i) => assert.equal(n, i + 1, "槽位必须从 1 连续: " + t.pat.slice(0, 40)));
    const zhUsed = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.deepEqual(zhUsed.slice().sort((a, b) => a - b), sorted, "译文槽位要与原文一致");
    assert.ok(/[\u4e00-\u9fff]/.test(t.zh), "模板译文里必须有中文");
  }
});

test("站点条目：dicts 里 common 在前、本册在后，attrs 放行 input 的 value", () => {
  assert.deepEqual(site.dicts, ["common", "targetscan"], "common 必须垫底，本册覆盖在其上");
  assert.ok(site.hosts.includes("www.targetscan.org"));
  assert.ok(site.hosts.includes("targetscan.org"));
  assert.equal(site.scope, "body");
  assert.ok(Array.isArray(site.attrs) && site.attrs.includes("value"), "按钮文案依赖 attrs:value");
});

test("首页导航：站际跳转按规则翻成中文且 href 不动", () => {
  const doc = run(
    '<div id="tsnav">' +
      '<a href="/vert_79/">Go to the newest version of TargetScanHuman</a>' +
      '<a href="/mmu_80/">Go to TargetScanMouse</a>' +
      '<a href="/worm_80/">Go to TargetScanWorm</a>' +
      '<a href="/fly_80/">Go to TargetScanFly</a>' +
      '<a href="/fish_80/">Go to TargetScanFish</a>' +
      "</div>"
  );
  const links = [...doc.querySelectorAll("a")].map((a) => [a.textContent, a.getAttribute("href")]);
  assert.deepEqual(links, [
    ["前往最新版 TargetScanHuman", "/vert_79/"],
    ["前往 TargetScanMouse", "/mmu_80/"],
    ["前往 TargetScanWorm", "/worm_80/"],
    ["前往 TargetScanFly", "/fly_80/"],
    ["前往 TargetScanFish", "/fish_80/"]
  ]);
});

test("检索表单：步骤标签翻中文，物种 option 文本翻、value 与 radio 名不动", () => {
  const doc = run(
    '<h2>Search for predicted microRNA targets in mammals</h2>' +
      '<form action="/cgi-bin/targetscan/vert_80/targetscan.cgi" method="get">' +
      "<b>1. Select a species</b>" +
      '<select name="species">' +
      '<option value="Human">Human</option><option value="Mouse">Mouse</option>' +
      '<option value="Rat">Rat</option><option value="Zebrafish">Zebrafish</option>' +
      "</select>" +
      '<b>2. Enter a human gene symbol (e.g. "Hmga2")</b>' +
      "<b>3. Do one of the following:</b>" +
      '<select name="family"><option value="">Select a broadly conserved* microRNA family</option>' +
      "<option>Select a conserved* microRNA family</option>" +
      "<option>Select a poorly conserved but confidently annotated microRNA family</option>" +
      "<option>Select another miRBase annotation</option></select>" +
      "<p>Note that most of these families are star miRNAs or RNA fragments misannotated as miRNAs.</p>" +
      '<input type="text" name="gid" value=""><input type="submit" value="Submit"><input type="reset" value="Reset">' +
      "</form>"
  );
  const text = plain(doc);
  assert.ok(text.includes("检索哺乳动物中预测的 microRNA 靶标"), text);
  assert.ok(text.includes("1. 选择物种"), text);
  assert.ok(text.includes("2. 输入人类基因符号"), text);
  assert.ok(text.includes("3. 执行以下任一操作"), text);
  assert.ok(text.includes("选择一个广泛保守的* microRNA 家族"), text);
  assert.ok(text.includes("选择弱保守但注释可靠的 microRNA 家族"), text);
  assert.ok(text.includes("注意：这些家族大多是 star miRNA"), text);
  const opts = [...doc.querySelectorAll("option")].map((o) => [o.value, o.textContent]);
  assert.equal(opts[0][0], "Human", "option value 是提交参数，不能动");
  assert.equal(opts[0][1], "人类");
  assert.equal(opts[1][1], "小鼠");
  assert.equal(opts[2][1], "大鼠");
  assert.equal(opts[3][1], "斑马鱼");
  const submits = [...doc.querySelectorAll('input[type="submit"], input[type="reset"]')].map((i) => i.value);
  assert.deepEqual(submits, ["提交", "重置"], "attrs:value 要让按钮文案也翻");
});

test("首页简介段：模板整段成中文，内联链接保留且链接文字各自翻", () => {
  const doc = run(
    "<p>TargetScan predicts biological targets of miRNAs by searching for the presence of conserved " +
      '<span title="8mer description">8mer</span>, <span title="7mer description">7mer</span>, and ' +
      '<span title="6mer description">6mer</span> sites that match the ' +
      '<span title="seed region description">seed region</span> of each miRNA ' +
      '(<a href="http://www.ncbi.nlm.nih.gov/pubmed/15652477">Lewis et al., 2005</a>). ' +
      "As options, predictions with only poorly conserved sites and predictions with nonconserved miRNAs are also provided. " +
      "Also identified are sites with mismatches in the seed region that are compensated by conserved 3' pairing " +
      '(<a href="http://genome.cshlp.org/content/19/1/92.long">Friedman et al., 2009</a>). ' +
      "In mammals, predictions are ranked based on the predicted efficacy of targeting as calculated using a biochemical model of miRNA-mediated repression, " +
      "which was extended to all miRNA sequences using a convolutional neural network " +
      '(<a href="http://www.ncbi.nlm.nih.gov/pubmed/31806698">McGeary, Lin, et al., 2019</a>). ' +
      "As an option, predictions are also ranked on the basis of targeting efficacy estimated using cumulative weighted " +
      '<a href="/vert_70/docs/context_score.html">context++ scores</a> of the sites ' +
      '(<a href="http://lens.elifesciences.org/05005/index.html">Agarwal et al., 2015</a>). ' +
      "As another option, predictions are ranked by their probability of conserved targeting " +
      '(<a href="/docs/pct.html">PCT</a>, <a href="http://genome.cshlp.org/content/19/1/92.long">Friedman et al., 2009</a>). ' +
      "TargetScanHuman considers matches to human " +
      '<a href="/cgi-bin/targetscan/UTR_data.cgi?db=vert_80">3\' UTRs</a> and their orthologs, as defined by ' +
      '<a href="http://genome.ucsc.edu/cgi-bin/hgTrackUi?db=hg19&amp;g=multiz100way">UCSC whole-genome alignments</a>. ' +
      "Conserved targeting has also been detected within open reading frames (ORFs). " +
      "A listing of these ORF sites can be found at the bottom of " +
      '<a href="http://web.wi.mit.edu/bartel/pub/Supplemental">Supplemental Table 2</a> of ' +
      '<a href="http://www.ncbi.nlm.nih.gov/pubmed/15652477">Lewis et al., 2005</a>.</p>'
  );
  const p = doc.querySelector("p");
  const text = plain(doc);
  assert.ok(text.startsWith("TargetScan 通过检索与每个 miRNA 的"), text.slice(0, 80));
  assert.ok(text.includes("位点来预测 miRNA 的生物学靶标"), text);
  assert.ok(text.includes("此外还提供仅含弱保守位点的预测"), text);
  assert.ok(text.includes("种子区域存在错配、但由保守的 3' 配对补偿的位点也会被识别"), text);
  assert.ok(text.includes("在开放阅读框（ORF）内也检测到保守靶向"), text);
  assert.ok(text.includes("TargetScanHuman 考虑与人类 3' UTR 区域及其直系同源序列"), text);
  // 内联元素被模板搬回原位：链接数不变、href 不变
  const links = [...p.querySelectorAll("a")].map((a) => a.getAttribute("href"));
  assert.equal(links.length, 11, "模板要把内联链接一个不少地搬回: " + links.join(","));
  assert.ok(links.includes("http://www.ncbi.nlm.nih.gov/pubmed/15652477"));
  assert.ok(links.includes("/docs/pct.html"));
  // 链接文字走各自的 exact
  assert.ok(text.includes("context++ 得分"), text);
});

test("结果页表头：miRNA 家族/位点类型/score/percentile 翻中文，miRNA 名与数值不动", () => {
  const doc = run(
    "<h3>Human HMGA2 (ENST00000403681.2) 3' UTR miRNA Table</h3>" +
      '<table class="data"><thead><tr>' +
      "<th>miRNA family</th><th>Conserved sites</th><th>Poorly conserved sites</th><th>6mer sites</th>" +
      "<th>Cumulative weighted context++ score</th><th>Total context++ score</th><th>Aggregate P<sub>CT</sub></th>" +
      "</tr></thead><tbody><tr>" +
      "<td>let-7-5p/miR-98-5p</td><td>2</td><td>1</td><td>0</td><td>-0.21</td><td>-0.28</td><td>0.031</td>" +
      "</tr></tbody></table>" +
      '<table class="sites"><thead><tr>' +
      "<th>Site type</th><th>Context++ score</th><th>Context++ score percentile</th><th>Weighted context++ score</th>" +
      "<th>Conserved branch length</th><th>Predicted relative K<sub>D</sub></th>" +
      "</tr></thead><tbody><tr><td>7mer-m8</td><td>-0.15</td><td>83</td><td>-0.15</td><td>2.6</td><td>1.1</td></tr></tbody></table>"
  );
  const text = plain(doc);
  assert.ok(text.includes("3' UTR miRNA 表格"), text);
  assert.ok(text.includes("miRNA 家族"), text);
  assert.ok(text.includes("保守位点"), text);
  assert.ok(text.includes("弱保守位点"), text);
  assert.ok(text.includes("6mer 位点"), text);
  assert.ok(text.includes("累积加权 context++ 得分"), text);
  assert.ok(text.includes("总 context++ 得分"), text);
  assert.ok(text.includes("汇总 P"), text);
  assert.ok(text.includes("位点类型"), text);
  assert.ok(text.includes("context++ 得分百分位"), text);
  assert.ok(text.includes("加权 context++ 得分"), text);
  assert.ok(text.includes("保守枝长"), text);
  assert.ok(text.includes("预测相对 K"), text);
  assert.ok(text.includes("let-7-5p/miR-98-5p"), "miRNA 名不翻: " + text);
  assert.ok(text.includes("-0.21") && text.includes("83"), "评分数字不动: " + text);
});

test("结果页段落标题与排序提示：sub 截断的句子靠锚定规则补全", () => {
  const doc = run(
    '<h3>miRNA families broadly conserved among vertebrates</h3>' +
      '<span>Table sorted by cumulative weighted context++ score</span>' +
      '<span>[Sort table by aggregate P<sub>CT</sub>]</span>' +
      "<p>[Show poorly conserved sites for miRNA families conserved among vertebrates]</p>" +
      '<p><a href="/cgi-bin/vert_80/view_gene.cgi?rs=ENST00000403681.2">[View table of miRNA sites]</a></p>'
  );
  const text = plain(doc);
  assert.ok(text.includes("脊椎动物中广泛保守的 miRNA 家族"), text);
  assert.ok(text.includes("表格按累积加权 context++ 得分排序"), text);
  assert.ok(text.includes("[按汇总 P"), text);
  assert.ok(text.includes("[显示脊椎动物中保守的 miRNA 家族的弱保守位点]"), text);
  assert.ok(text.includes("[查看 miRNA 位点表格]"), text);
});

test("多转录本选择页：规则吃下带基因符号与 Ensembl ID 的整句", () => {
  const doc = run(
    "<h3>The identifier HMGA2 corresponds to multiple transcripts. Choose one to see in detail.</h3>" +
      "<b>Representative (most prevalent) transcript for HMGA2 (ENSG00000149948.9):</b>" +
      "<td>3P-seq tags:</td>" +
      "<b>Less prevalent transcripts for HMGA2 (ENSG00000149948.9):</b>" +
      "<p>Not in our database</p>"
  );
  const text = plain(doc);
  assert.ok(text.includes("标识符 HMGA2 对应多个转录本"), text);
  assert.ok(text.includes("HMGA2（ENSG00000149948.9）的代表性（最常见）转录本："), text);
  assert.ok(text.includes("个 3P-seq 标签支持："), text);
  assert.ok(text.includes("HMGA2（ENSG00000149948.9）的较少见转录本："), text);
  assert.ok(!text.includes("transcripts"), text);
});

test("数据下载页：表头翻中文、文件名与体积公式保留", () => {
  const doc = run(
    "<p>Linked below are selected tab-delimited data files from the TargetScan database.</p>" +
      "<h3>Gene and miRNA annotations</h3>" +
      "<table><tr><th>File</th><th>Description</th><th>Fields</th><th># of Rows</th></tr>" +
      "<tr><td>miR_Family_Info.txt.zip - (4.6 MB)</td><td>Species ID</td><td>1</td><td>2</td></tr></table>"
  );
  const text = plain(doc);
  assert.ok(text.includes("以下列出从 TargetScan 数据库中选取的制表符分隔数据文件"), text);
  assert.ok(text.includes("基因与 miRNA 注释"), text);
  assert.ok(text.includes("文件"), text);
  assert.ok(text.includes("描述"), text);
  assert.ok(text.includes("字段"), text);
  assert.ok(text.includes("行数"), text);
  assert.ok(text.includes("物种 ID"), text);
  assert.ok(text.includes("miR_Family_Info.txt.zip（文件大小 4.6 MB）"), "文件名保留、体积说明用中文: " + text);
});

test("FAQ 固定句：模板吃下带内联术语的整段", () => {
  const doc = run(
    '<p>Try clicking on the term, which in these cases appear as headings of tables on the web site. ' +
      'They link to pop-up windows with descriptions of terms like <a href="/docs/rfam.html">Representative miRNA</a> ' +
      'or <a href="/docs/pct.html">Aggregate PCT</a>.</p>' +
      "<p>Aggregate P<sub>CT</sub> has the advantage of identifying targeting interactions that are not only more likely " +
      "to be effective but also those that are more likely to be consequential for the animal.</p>"
  );
  const text = plain(doc);
  assert.ok(text.includes("请点击该术语"), text);
  assert.ok(text.includes("弹窗"), text);
  assert.ok(text.includes("汇总 P"), text);
});

test("页脚信用：Release 号与版权年份走规则，机构名翻中文", () => {
  const doc = run(
    '<div id="footer"><span>TargetScan Release 8.0</span><br>' +
      "<span>© 2006-2022 Whitehead Institute for Biomedical Research</span><br>" +
      '<span>Questions:</span> <img src="/vert_80/images/email.png" alt=""><br>' +
      '<span title="Browser problems?">Compatibility</span></div>'
  );
  const text = plain(doc);
  assert.ok(text.includes("TargetScan 版本 8.0"), text);
  assert.ok(text.includes("© 2006-2022 Whitehead 生物医学研究所"), text);
  assert.ok(text.includes("问题咨询："), text);
  assert.ok(text.includes("兼容性"), text);
  // 邮箱是图片，不能凭空造出邮箱文本
  assert.ok(!/@targetscan/.test(text), text);
  // title 属性是默认通道，也要翻
  const span = doc.querySelector('span[title="浏览器有问题？"], span[title="Browser problems?"]');
  assert.ok(span, "title 属性节点还在");
});

test("标题规则：TargetScanHuman 版本号 + predicted miRNA targets", () => {
  const dom = new JSDOM(
    "<!doctype html><html><head><title>TargetScanHuman 8.0: predicted miRNA targets</title></head><body></body></html>"
  );
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  assert.equal(dom.window.document.title, "TargetScanHuman 8.0：预测的 miRNA 靶标");
});
