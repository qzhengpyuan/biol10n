// r28 MeSH 树号 / 合节点的「Year introduced」与 CDD 内容页补词
// 词库：dict/mesh.json、dict/ncbi-struct.json
// 原文取自 2026-11-23 实测页面（https://www.ncbi.nlm.nih.gov/mesh/D005665、
// https://www.ncbi.nlm.nih.gov/Structure/cdd/cddsrv.cgi?uid=cd00003）。
// 断言口径：translateText(原文) 必须等于实测译文；数据串（蛋白名、物种、登录号）必须返回 null。
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
const meshDict = JSON.parse(fs.readFileSync(path.join(root, "../dict/mesh.json"), "utf8"));
const structDict = JSON.parse(fs.readFileSync(path.join(root, "../dict/ncbi-struct.json"), "utf8"));

const CJK = /[\u4e00-\u9fff]/;

function site(id) {
  const s = sites.find((x) => x.id === id);
  assert.ok(s, "config/sites.json 缺站点 " + id);
  return s;
}

function load(names) {
  const exact = {}, rules = [], templates = [];
  for (const n of names) {
    const d = JSON.parse(fs.readFileSync(path.join(root, "../dict/" + n + ".json"), "utf8"));
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
    templates.push(...(d.templates || []));
  }
  return { exact, rules, templates };
}

function boot(cfg, html, url) {
  const dom = new JSDOM(html, { url });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: load(cfg.dicts),
    site: cfg
  });
  engine.start();
  return { engine, doc: dom.window.document };
}

// ---------------- MeSH ----------------

test("mesh 词库：树号标签与两条规则就位，规则首尾锚定", () => {
  assert.equal(meshDict.meta.family, "mesh");
  assert.equal(meshDict.exact["Tree Number(s):"], "树号：");
  const res = meshDict.rules.map((r) => r.re);
  assert.ok(res.includes("^Tree Number\\(s\\):\\s*(.+)$"), "树号规则应容忍冒号后无空格");
  assert.ok(res.includes("^(.+) Year introduced: (.+)$"), "缺「正文句 + Year introduced」合节点规则");
  for (const r of meshDict.rules) {
    assert.ok(r.re.startsWith("^") && r.re.endsWith("$"), "规则必须锚定: " + r.re);
    assert.doesNotThrow(() => new RegExp(r.re), "规则无法编译: " + r.re);
    assert.ok(!CJK.test(r.re), "规则 re 含中文: " + r.re);
    assert.ok(CJK.test(r.to), "规则译文没有中文: " + r.re);
  }
});

test("MeSH 合节点：正文句原样保留，只翻尾部 Year introduced", () => {
  const cfg = site("ncbi-mesh");
  const { engine } = boot(cfg, "<body></body>", "https://www.ncbi.nlm.nih.gov/mesh/D005665");
  const scope = "A benzoic-sulfonamide-furan. It is a diuretic with fast onset and short duration that is used for EDEMA and chronic RENAL INSUFFICIENCY.";
  assert.equal(
    engine.translateText(scope + " Year introduced: 1967(1965)"),
    scope + " 引入年份：1967（1965）"
  );
  // 任务书给的最小形态
  assert.equal(
    engine.translateText("A sulfamyl diuretic. Year introduced: 1991(1975)"),
    "A sulfamyl diuretic. 引入年份：1991（1975）"
  );
  // 实测 div.brieflinkpopdesc：定义被截断成 ... 后接年份
  assert.equal(
    engine.translateText("An ionophorous, polyether antibiotic from Streptomyces chartreusensis. It binds and transports CALCIUM and other divalent cations across membranes and uncouples oxidative phos... Year introduced: 1991(1975)"),
    "An ionophorous, polyether antibiotic from Streptomyces chartreusensis. It binds and transports CALCIUM and other divalent cations across membranes and uncouples oxidative phos... 引入年份：1991（1975）"
  );
  // 实测副主题词 popup：四连点结尾
  assert.equal(
    engine.translateText("Used with drugs for dosage forms, routes of administration, frequency and duration of administration, quantity of medication, and the effects of these factors.... Year introduced: 1966"),
    "Used with drugs for dosage forms, routes of administration, frequency and duration of administration, quantity of medication, and the effects of these factors.... 引入年份：1966"
  );
  // 独立节点的年份照旧（common 的标点规则把半角括号换成全角，与实测页面一致）
  assert.equal(engine.translateText("Year introduced: 1967(1965)"), "引入年份：1967（1965）");
  // 没有标签的正文句不能被吞
  assert.equal(engine.translateText("A sulfamyl diuretic."), null);
  assert.equal(engine.translateText(scope), null);
});

test("MeSH 树号：带空格 / 无空格 / 只有标签三种形态都翻", () => {
  const cfg = site("ncbi-mesh");
  const { engine } = boot(cfg, "<body></body>", "https://www.ncbi.nlm.nih.gov/mesh/D005665");
  assert.equal(
    engine.translateText("Tree Number(s): D02.065.884.725.300, D02.092.146.807.300, D02.886.590.700.725.300"),
    "树号：D02.065.884.725.300, D02.092.146.807.300, D02.886.590.700.725.300"
  );
  assert.equal(engine.translateText("Tree Number(s):D02.065.884.725.300"), "树号：D02.065.884.725.300");
  assert.equal(engine.translateText("Tree Number(s):"), "树号：");
  // 副主题词页实测值（单节点）
  assert.equal(engine.translateText("Tree Number(s): Y07.010, Y10.010"), "树号：Y07.010, Y10.010");
});

test("MeSH 真实 DOM：brieflinkpopdesc 与段落渲染成中文，正文句保留", () => {
  const cfg = site("ncbi-mesh");
  const scope = "A benzoic-sulfonamide-furan. It is a diuretic with fast onset and short duration that is used for EDEMA and chronic RENAL INSUFFICIENCY.";
  const html =
    '<div class="brieflinkpopdesc">' + scope + " Year introduced: 1967(1965)</div>" +
    '<div id="main"><p class="mesh_year_introduced">Year introduced: 1967(1965)</p>' +
    "<p>Tree Number(s): D02.065.884.725.300, D02.092.146.807.300</p>" +
    "<p>Tree Number(s):</p>" +
    "<p>MeSH Unique ID: D005665</p></div>";
  const { doc } = boot(cfg, html, "https://www.ncbi.nlm.nih.gov/mesh/D005665");
  assert.equal(doc.querySelector(".brieflinkpopdesc").textContent, scope + " 引入年份：1967（1965）");
  const ps = [...doc.querySelectorAll("#main p")].map((p) => p.textContent);
  assert.deepEqual(ps, [
    "引入年份：1967（1965）",
    "树号：D02.065.884.725.300, D02.092.146.807.300",
    "树号：",
    "MeSH 唯一编号：D005665"
  ]);
});

// ---------------- CDD ----------------

test("ncbi-struct 词库：CDD 内容页新条目与新规则就位", () => {
  assert.equal(structDict.meta.family, "ncbi-struct");
  const want = {
    "download alignment data": "下载比对数据",
    "Click on image for an interactive view with Cn3D": "点击图像可用 Cn3D 交互查看",
    "launch Cn3D": "启动 Cn3D",
    "scroll to sequence alignment section": "滚动到序列比对区段",
    "-click to see Superfamily help": "-点击查看超家族帮助"
  };
  for (const [k, v] of Object.entries(want)) {
    assert.equal(structDict.exact[k], v, "缺词条: " + k);
    assert.ok(CJK.test(v), "译文没有中文: " + k);
  }
  for (const r of structDict.rules) {
    assert.ok(r.re.startsWith("^") && r.re.endsWith("$"), "规则必须锚定: " + r.re);
    assert.doesNotThrow(() => new RegExp(r.re), "规则无法编译: " + r.re);
  }
});

test("CDD 站点归属：ncbi-cdd 的 path 覆盖 /cdd 与 /Structure/cdd，并加载 ncbi-struct", () => {
  const cfg = site("ncbi-cdd");
  const pathRe = new RegExp(cfg.path);
  assert.ok(pathRe.test("/Structure/cdd/cddsrv.cgi"), "ncbi-cdd path 应覆盖 /Structure/cdd");
  assert.ok(pathRe.test("/cdd/?term=cd00003"), "ncbi-cdd path 应覆盖 /cdd");
  for (const d of ["common", "ncbi", "ncbi-struct", "ncbi-new2", "ncbi-footer"]) {
    assert.ok(cfg.dicts.includes(d), "ncbi-cdd 应加载 " + d);
  }
});

test("CDD 内容页：aria-label / title / alt 全通道命中（实测属性值）", () => {
  const cfg = site("ncbi-cdd");
  const html =
    '<a id="help" title="-click to see Superfamily help"></a>' +
    '<button id="dl" aria-label="download alignment data"></button>' +
    '<img id="cn3d" alt="Click on image for an interactive view with Cn3D">' +
    '<table><tr><td id="launch" aria-label="launch Cn3D"></td></tr></table>' +
    '<span id="act" aria-label="active feature 0"></span>' +
    '<a id="f1" aria-label="feature 1"></a>' +
    '<a id="f4" aria-label="feature 4"></a>' +
    '<a id="jump" aria-label="scroll to sequence alignment section"></a>' +
    '<img id="site" alt="Conserved site includes 18 residues -Click on image for an interactive view with Cn3D">' +
    '<div id="box" title="Conserved site include 18 residues "></div>' +
    '<span id="fn">Feature 1:</span>' +
    '<select id="slc"><option>Hypertext</option><option>Plain Text</option><option>mFasta</option><option>Compact Hypertext</option></select>';
  const { doc } = boot(cfg, html, "https://www.ncbi.nlm.nih.gov/Structure/cdd/cddsrv.cgi?uid=cd00003");
  assert.equal(doc.getElementById("help").getAttribute("title"), "-点击查看超家族帮助");
  assert.equal(doc.getElementById("dl").getAttribute("aria-label"), "下载比对数据");
  assert.equal(doc.getElementById("cn3d").getAttribute("alt"), "点击图像可用 Cn3D 交互查看");
  assert.equal(doc.getElementById("launch").getAttribute("aria-label"), "启动 Cn3D");
  assert.equal(doc.getElementById("act").getAttribute("aria-label"), "活动特征 0");
  assert.equal(doc.getElementById("f1").getAttribute("aria-label"), "特征 1");
  assert.equal(doc.getElementById("f4").getAttribute("aria-label"), "特征 4");
  assert.equal(doc.getElementById("jump").getAttribute("aria-label"), "滚动到序列比对区段");
  assert.equal(
    doc.getElementById("site").getAttribute("alt"),
    "保守位点包含 18 个残基 - 点击图像可用 Cn3D 交互查看"
  );
  assert.equal(doc.getElementById("box").getAttribute("title"), "保守位点包含 18 个残基");
  assert.equal(doc.getElementById("fn").textContent, "特征 1：");
  // 输出格式是数据不是界面：引擎 FORMAT_OPTION 主动跳过 Plain Text / mFasta
  assert.deepEqual([...doc.querySelectorAll("option")].map((o) => o.textContent), [
    "超文本",
    "Plain Text",
    "mFasta",
    "紧凑超文本"
  ]);
});

test("CDD 页标题：域名前缀规则化，家族名保留", () => {
  const cfg = site("ncbi-cdd");
  const { doc, engine } = boot(
    cfg,
    "<body><p>x</p></body>",
    "https://www.ncbi.nlm.nih.gov/Structure/cdd/cddsrv.cgi?uid=cd00003"
  );
  assert.equal(
    engine.translateText("CDD Conserved Protein Domain Family: PNPsynthase"),
    "CDD 保守蛋白结构域家族：PNPsynthase"
  );
  // 真实 <title> 走 translateTitle 通道
  const dom = new JSDOM(
    "<head><title>CDD Conserved Protein Domain Family: PNPsynthase</title></head><body><p>x</p></body>",
    { url: "https://www.ncbi.nlm.nih.gov/Structure/cdd/cddsrv.cgi?uid=cd00003" }
  );
  const eng2 = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: load(cfg.dicts),
    site: cfg
  });
  eng2.start();
  assert.equal(dom.window.document.title, "CDD 保守蛋白结构域家族：PNPsynthase");
});

test("CDD 数据串不翻：蛋白名、物种、PDB 标题、格式名", () => {
  const cfg = site("ncbi-cdd");
  const { engine } = boot(cfg, "<body></body>", "https://www.ncbi.nlm.nih.gov/Structure/cdd/cddsrv.cgi?uid=cd00003");
  const data = [
    "Pyridoxal phosphate biosynthetic protein pdxJ (PNP synthase)",
    "pyridoxal phosphate biosynthetic protein [Leptospira interrogans serovar Lai str. 56601]",
    "Escherichia coli",
    "Sinorhizobium meliloti",
    "cd00003: PNPsynthase",
    "mFasta"
  ];
  for (const s of data) assert.equal(engine.translateText(s), null, "不该命中: " + s);
  // 导出的既有译法不能被这次改动带偏
  assert.equal(engine.translateText("Download alignment"), "下载比对");
  assert.equal(engine.translateText("Conserved Protein Domain Family"), "保守蛋白结构域家族");
  assert.equal(engine.translateText("View in Cn3D"), "在 Cn3D 中查看");
});