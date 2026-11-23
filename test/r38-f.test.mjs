// r38/f 轮：cBioPortal 分子谱名、ClinVar SPDI 属性、dbSNP 下载/分享属性、UCSC Base、miRBase 图标与序列框
// 原文均由 CDP 9227 上的真实渲染 DOM 采集（r37-sweep §二/§六），不是从 HTML 源码猜的。
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

const dicts = {
  cbioportal: JSON.parse(fs.readFileSync(path.join(root, "../dict/cbioportal.json"), "utf8")),
  "clinvar-core": JSON.parse(fs.readFileSync(path.join(root, "../dict/clinvar-core.json"), "utf8")),
  snp: JSON.parse(fs.readFileSync(path.join(root, "../dict/snp.json"), "utf8")),
  "ucsc-extra": JSON.parse(fs.readFileSync(path.join(root, "../dict/ucsc-extra.json"), "utf8")),
  mirbase: JSON.parse(fs.readFileSync(path.join(root, "../dict/mirbase.json"), "utf8"))
};

/** 本轮新增键（原文逐字来自渲染 DOM） */
const ADDED = {
  cbioportal: {
    "Capped relative linear copy-number values": "截顶的相对线性拷贝数值",
    "mRNA expression (microarray)": "mRNA 表达（微阵列）",
    "mRNA expression z-scores relative to diploid samples (microarray)": "相对于二倍体样本的 mRNA 表达 z 分数（微阵列）",
    "mRNA expression z-scores relative to all samples (log microarray)": "相对于全部样本的 mRNA 表达 z 分数（对数微阵列）",
    "Phosphoprotein site level expression (mass spectrometry by CPTAC)": "磷酸化蛋白位点水平表达（CPTAC 质谱）",
    "Protein level z-scores (mass spectrometry by CPTAC)": "蛋白质水平 z 分数（CPTAC 质谱）"
  },
  "clinvar-core": {
    "Sequence Position Deletion Insertion": "序列位置 缺失 插入"
  },
  snp: {
    "Download in API JSON format": "以 API JSON 格式下载",
    "Share on Google+": "分享到 Google+"
  },
  "ucsc-extra": {
    Base: "碱基层级"
  },
  mirbase: {
    "RNAcentral logo": "RNAcentral 标志",
    "The University of Manchester's Faculty of Biology, Medicine and Health Homepage": "曼彻斯特大学 生物学、医学与健康学部主页",
    "Enter a single RNA/DNA sequence (10–7000 nucleotides, with an optional description in FASTA format) or job id. Note: sequences >1,000 nucleotides may take a few minutes to complete.":
      "输入单条 RNA/DNA 序列（10–7000 个核苷酸，可带 FASTA 格式描述）或任务号。注意：超过 1,000 个核苷酸的序列可能需要数分钟才能完成。"
  }
};

function siteOf(id) {
  const found = sites.find((s) => (s.dicts || []).includes(id));
  assert.ok(found, "config/sites.json 里找不到引用词库 " + id + " 的站点");
  // 关掉延迟补扫：测试只验证一次扫描的结果，不等站点自己的 rescan 定时器
  return { ...found, rescan: false };
}

function run(id, html, site) {
  const d = dicts[id];
  const dom = new JSDOM(html, { url: "https://example.org/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: d.exact, rules: d.rules, templates: d.templates },
    site: site || siteOf(id)
  });
  engine.start();
  return dom.window.document;
}

const zh = (s) => String(s).replace(/\s+/g, " ").trim();

// ---------------- 词库结构 ----------------

test("五册词库可解析，本轮 13 条新键逐字就位且值正确", () => {
  let n = 0;
  for (const [id, entries] of Object.entries(ADDED)) {
    for (const [k, v] of Object.entries(entries)) {
      assert.equal(dicts[id].exact[k], v, id + " 缺少或值与预期不符：" + k);
      n++;
    }
  }
  assert.equal(n, 13, "本轮新增键应为 13 条");
});

test("新键在该册内只出现一次（物理行不重复，JSON 里没有同名键）", () => {
  for (const [id, entries] of Object.entries(ADDED)) {
    const raw = fs.readFileSync(path.join(root, "../dict", id + ".json"), "utf8");
    for (const k of Object.keys(entries)) {
      const occurrences = raw.split(JSON.stringify(k)).length - 1;
      assert.equal(occurrences, 1, id + " 里键重复或没写进文件：" + k);
    }
  }
});

test("新键无中文、无首尾空白、值含中文、不含网址与邮箱", () => {
  const cjk = /[\u4e00-\u9fff]/;
  for (const [id, entries] of Object.entries(ADDED)) {
    for (const [k, v] of Object.entries(entries)) {
      assert.ok(!cjk.test(k), id + " 键含中文：" + k);
      assert.equal(k, k.trim(), id + " 键有首尾空白：" + JSON.stringify(k));
      assert.equal(v, v.trim(), id + " 值有首尾空白：" + k);
      assert.match(v, cjk, id + " 值应含中文：" + k);
      assert.notEqual(k, v, id + " 不应自映射：" + k);
      assert.doesNotMatch(v, /https?:\/\/|[\w.+-]+@[\w-]+\.[\w.]+/, id + " 值含网址/邮箱：" + k);
    }
  }
});

// ---------------- cBioPortal ----------------

test("cBioPortal：6 个分子谱名整节点翻成中文", () => {
  const doc = run(
    "cbioportal",
    '<div id="root"><main id="mainColumn">' +
      '<div class="rowColumn">Capped relative linear copy-number values</div>' +
      '<div class="rowColumn">mRNA expression (microarray)</div>' +
      '<div class="rowColumn">mRNA expression z-scores relative to diploid samples (microarray)</div>' +
      '<div class="rowColumn">mRNA expression z-scores relative to all samples (log microarray)</div>' +
      '<div class="rowColumn">Phosphoprotein site level expression (mass spectrometry by CPTAC)</div>' +
      '<div class="rowColumn">Protein level z-scores (mass spectrometry by CPTAC)</div>' +
      "</main></div>"
  );
  assert.deepEqual(
    [...doc.querySelectorAll(".rowColumn")].map((e) => zh(e.textContent)),
    Object.values(ADDED.cbioportal)
  );
});

test("cBioPortal：分子谱单元格里的样本数与百分比不动", () => {
  const doc = run(
    "cbioportal",
    '<div id="root"><main id="mainColumn"><div class="tables-module__row">' +
      '<div class="rowColumn">Capped relative linear copy-number values</div>' +
      "<div>1,080</div><div>97.5%</div>" +
      "</div></main></div>"
  );
  const cells = [...doc.querySelectorAll("div")].map((e) => zh(e.textContent)).filter(Boolean);
  assert.ok(cells.includes("截顶的相对线性拷贝数值"));
  assert.ok(cells.includes("1,080"));
  assert.ok(cells.includes("97.5%"));
});

test("cBioPortal：未收录的同族名整串保持英文，不拼半中半英", () => {
  const doc = run(
    "cbioportal",
    '<div id="root"><main id="mainColumn">' +
      '<div class="rowColumn">mRNA expression z-scores relative to normal samples (microarray)</div>' +
      "</main></div>"
  );
  assert.equal(
    zh(doc.querySelector(".rowColumn").textContent),
    "mRNA expression z-scores relative to normal samples (microarray)"
  );
});

// ---------------- ClinVar ----------------

test("ClinVar：dt.hashelp 的 title 属性翻成中文，已汉化的可见文本不动", () => {
  const doc = run(
    "clinvar-core",
    '<dl><dt class="hashelp" title="Sequence Position Deletion Insertion">规范 SPDI</dt>' +
      "<dd>NC_000019.10:44908821:C:T</dd></dl>"
  );
  const dt = doc.querySelector("dt");
  assert.equal(dt.textContent, "规范 SPDI", "可见文本已是中文，不能再动");
  assert.equal(dt.getAttribute("title"), "序列位置 缺失 插入");
  assert.equal(doc.querySelector("dd").textContent, "NC_000019.10:44908821:C:T", "SPDI 值保持原样");
});

// ---------------- dbSNP ----------------

test("dbSNP：下载按钮 title 与 Google+ 分享图标 alt", () => {
  const doc = run(
    "snp",
    '<ul><li title="Download in API JSON format">下载</li></ul>' +
      '<div class="share"><img src="/snp/static/snp2redesign/images/gplus.png" alt="Share on Google+"></div>'
  );
  const li = doc.querySelector("li");
  assert.equal(li.textContent, "下载", "按钮可见文本已是中文");
  assert.equal(li.getAttribute("title"), "以 API JSON 格式下载");
  const img = doc.querySelector("img");
  assert.equal(img.getAttribute("alt"), "分享到 Google+");
  assert.match(img.getAttribute("alt"), /Google\+/, "Google+ 是品牌名，保留原文");
});

// ---------------- UCSC ----------------

test("UCSC：Base 词条已收录，value 通道启用后按钮值翻成中文、倍率值不动", () => {
  // 注：ucsc 站点配置的 attrs 目前没有 "value"，submit 按钮的值不会进属性通道；
  // 这里显式补上 value，验证词条与引擎能力（启用动作在 config/sites.json，本轮不改）。
  const site = { ...siteOf("ucsc-extra"), attrs: [...(siteOf("ucsc-extra").attrs || []), "value"] };
  const doc = run(
    "ucsc-extra",
    '<div><input type="submit" name="hgt.out1" value="1.5x">' +
      '<input type="submit" name="hgt.out4" value="100x">' +
      '<input type="submit" name="hgt.inBase" value="Base"></div>',
    site
  );
  const inputs = [...doc.querySelectorAll("input")];
  assert.equal(inputs[0].getAttribute("value"), "1.5x", "倍率不是文案，不翻");
  assert.equal(inputs[2].getAttribute("name"), "hgt.inBase", "提交参数名不能动");
  assert.equal(inputs[2].getAttribute("value"), "碱基层级");
});

// ---------------- miRBase ----------------

test("miRBase：两个图标 alt 翻成中文，机构名与 RNAcentral 品牌保留", () => {
  const doc = run(
    "mirbase",
    '<main class="container"><img src="/static/images/uom_logo.png" alt="The University of Manchester\'s Faculty of Biology, Medicine and Health Homepage">' +
      '<img src="https://rnacentral.org/static/img/logo/rnacentral-logo.png" alt="RNAcentral logo"></main>'
  );
  const imgs = [...doc.querySelectorAll("img")];
  assert.equal(imgs[0].getAttribute("alt"), "曼彻斯特大学 生物学、医学与健康学部主页");
  assert.equal(imgs[1].getAttribute("alt"), "RNAcentral 标志");
});

test("miRBase：弯撇号写法同样命中校徽 alt", () => {
  const doc = run(
    "mirbase",
    '<main class="container"><img src="/static/images/uom_logo.png" alt="The University of Manchester\u2019s Faculty of Biology, Medicine and Health Homepage"></main>'
  );
  assert.equal(
    doc.querySelector("img").getAttribute("alt"),
    "曼彻斯特大学 生物学、医学与健康学部主页"
  );
});

test("miRBase：175+ 字符的序列框 placeholder 整条翻成中文，数字区间原样", () => {
  const key = Object.keys(ADDED.mirbase).find((k) => k.startsWith("Enter a single RNA/DNA sequence"));
  assert.ok(key.length > 170, "这条 placeholder 应超过 170 字符，实际 " + key.length);
  const doc = run("mirbase", '<main class="container"><textarea placeholder="' + key + '"></textarea></main>');
  const ph = doc.querySelector("textarea").getAttribute("placeholder");
  assert.equal(ph, ADDED.mirbase[key]);
  assert.match(ph, /10–7000/, "序列长度区间保持原文（含 en dash）");
  assert.match(ph, /1,000/, "千位阈值保持原文");
  // 只允许 RNA / DNA / FASTA 三个术语保留英文；句子骨架不能残留
  assert.doesNotMatch(ph, /Enter a single|nucleotides|Note:|sequences /, "不应残留英文句子");
});

test("miRBase：词条对 page 上其余英文不越权（物种名、任务号不动）", () => {
  const doc = run(
    "mirbase",
    '<main class="container"><div><span>Homo sapiens</span><span>hsa-miR-21</span><span>MI0000077</span></div></main>'
  );
  assert.deepEqual([...doc.querySelectorAll("span")].map((e) => e.textContent), [
    "Homo sapiens",
    "hsa-miR-21",
    "MI0000077"
  ]);
});
