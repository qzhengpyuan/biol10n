// gnomAD 基因页 / 变异页第二轮补译：页签、表头、图注、提示与 aria-label。
// 词条必须按真实 DOM 节点边界写：gnomAD 是 React SPA，句子被插值切成多个**纯文本节点**
//（中间没有元素），所以整句只能走模板通道，或按切开的片段逐条收词。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();

const gnomad = JSON.parse(fs.readFileSync(path.join(root, "../dict/gnomad.json"), "utf8"));
const common = JSON.parse(fs.readFileSync(path.join(root, "../dict/common.json"), "utf8"));
const spa = JSON.parse(fs.readFileSync(path.join(root, "../dict/spa.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8"));
const gnomadSite = sites.sites.find((s) => s.id === "gnomad");

// 站点实际挂载的三册（config/sites.json 的 dicts: common, spa, gnomad）
const DATA = {
  exact: { ...common.exact, ...spa.exact, ...gnomad.exact },
  rules: [...(common.rules || []), ...(spa.rules || []), ...(gnomad.rules || [])],
  templates: [...(common.templates || []), ...(spa.templates || []), ...(gnomad.templates || [])]
};
const SITE = { scope: "body", block: "pre, code", attrs: [] };

function boot(build, url = "https://gnomad.broadinstitute.org/gene/ENSG00000141510") {
  const dom = new JSDOM("<body></body>", { url });
  const doc = dom.window.document;
  const t = (s) => doc.createTextNode(s);
  const el = (tag, attrs = {}, kids = []) => {
    const e = doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    for (const k of kids) e.appendChild(typeof k === "string" ? t(k) : k);
    return e;
  };
  for (const n of build({ doc, t, el })) doc.body.appendChild(n);
  const engine = createEngine({ document: doc, window: dom.window, data: DATA, site: SITE });
  engine.scan();
  return { doc, engine, dom };
}

// —— 真实 DOM：ClinVar 轨道那句说明。React 把句子切成 6 个纯文本节点，
//    中间夹一个「Note」徽标 <span> 与一个 <a>region view</a>，整句只能靠模板放回链接。
function clinvarNote({ t, el }) {
  const p = el("p", {}, [
    el("span", { level: "info", class: "Badge__BadgeWrapper-sc-j4izdp-1 jbxYNc" }, ["Note"]),
    " Only variants located in or within 75 base pairs of",
    " ",
    "a coding exon (CDS)",
    " are shown here. To see variants ",
    "in UTRs or introns",
    ", use the ",
    el("a", { class: "Link-sc-14lgydv-0 jtwqlm", href: "/region/17-7661779-7687538" }, ["region view"]),
    "."
  ]);
  return [el("div", { class: "sc-dntSTA jogHOX" }, [p])];
}

test("ClinVar 轨道说明句：模板整段替换，徽标与 region view 链接都留在原位", () => {
  const { doc } = boot(clinvarNote);
  const p = doc.querySelector("p");
  assert.equal(
    p.textContent,
    "说明：此处仅显示位于编码外显子（CDS）内或其 75 个碱基对范围内的变异。若要查看 UTR 或内含子中的变异，请使用区域视图。"
  );
  const a = p.querySelector("a");
  assert.equal(a.getAttribute("href"), "/region/17-7661779-7687538", "链接不能丢");
  assert.equal(a.textContent, "区域视图");
  assert.equal(p.querySelector("span").textContent, "说明", "徽标 span 保留且已翻");
});

test("ClinVar 说明句只在 75 碱基这个真实句式上命中，阈值变了就整句留英文（不许半中半英）", () => {
  const { doc } = boot(({ t, el }) => {
    const p = el("p", {}, [
      el("span", { level: "info", class: "Badge__BadgeWrapper-sc-j4izdp-1 jbxYNc" }, ["Note"]),
      " Only variants located in or within 100 base pairs of",
      " ",
      "a coding exon (CDS)",
      " are shown here. To see variants ",
      "in UTRs or introns",
      ", use the ",
      el("a", { href: "/region/17-7661779-7687538" }, ["region view"]),
      "."
    ]);
    return [el("div", { class: "sc-dntSTA jogHOX" }, [p])];
  });
  const para = doc.querySelector("p");
  // 模板按 75 这个真实阈值逐字符匹配：阈值一变就整段不替换（引擎另有「句内零星英文」通道会翻徽标/链接，
  // 那是引擎既有行为，不归词库管；这里只钉住「模板不许误配别的数字」）。
  assert.equal(para.hasAttribute("data-biol10n-tpl"), false, "模板只认 75 这个句式");
  assert.match(para.textContent, /Only variants located in or within 100 base pairs of/, "正文句子本身不替换");
});

test("表格说明段：正文 + <button>transcript view</button> 模板整段替换，按钮不被抹掉", () => {
  const { doc } = boot(({ t, el }) => {
    const btn = el("button", { type: "button", class: "Button__TextButton-sc-1eobygi-3 dcgzGu" }, ["transcript view"]);
    const p = el("p", {}, [
      "The table below shows the HGVS consequence and VEP annotation for each variant's most severe consequence across all transcripts in this gene. Cases where the most severe consequence occurs in a",
      " ",
      "non-MANE Select transcript (or non-canonical transcript if no MANE Select transcript exists)",
      " ",
      "are denoted with †. To see consequences in a specific transcript, use the",
      " ",
      btn,
      "."
    ]);
    return [el("section", { class: "sc-fYRIQK kYKSXg" }, [p])];
  });
  const p = doc.querySelector("p");
  assert.equal(
    p.textContent,
    "下表展示每个变异在该基因全部转录本中最严重后果的 HGVS 变异后果与 VEP 注释。若最严重后果出现在非 MANE Select 转录本（或不存在 MANE Select 转录本时的非规范转录本）中，会以 † 标注。若要查看特定转录本中的后果，请使用转录本视图。"
  );
  const btn = p.querySelector("button");
  assert.ok(btn, "transcript view 是按钮，模板必须把它放回原位");
  assert.equal(btn.getAttribute("type"), "button");
});

test("ClinVar 发布说明夹着浏览器本地化日期：整句留英文，不制造半中半英", () => {
  // 日期节点由浏览器 locale 渲染成汉字，整块已经混了中文，再把 release. 翻成「版本。」会出现
  // 「from ClinVar's 2026年10月11日版本。」这种半中半英 —— 两个键都不收，整句保持英文。
  const { doc } = boot(({ t, el }) => [
    el("p", { class: "sc-eQaGpr jGwfMv" }, [
      "Data displayed here is from ClinVar's",
      " ",
      "2026年10月11日",
      " ",
      "release."
    ])
  ]);
  const txt = doc.querySelector("p").textContent;
  assert.equal(txt, "Data displayed here is from ClinVar's 2026年10月11日 release.");
});

test("short variants 表：VEP 后果 3' UTR 与约束指标 Z = / o/e = 在单元格里翻", () => {
  const { doc } = boot(({ t, el }) => {
    const row = el("div", { class: "grid-row", role: "row" }, [
      el("div", { class: "grid-cell" }, [el("span", {}, [el("span", {}, ["17-7661882-C-T"])])]),
      el("div", { class: "grid-cell" }, [el("span", { color: "rgb(115, 171, 61)", class: "sc-zOxLx fCMolg" }, ["G"])]),
      el("div", { class: "grid-cell" }, [el("span", {}, [el("span", {}, ["3' UTR"])])])
    ]);
    const table = el("table", { class: "Table__BaseTable-sc-7fgtt2-0" }, [
      el("tbody", {}, [
        el("tr", {}, [
          el("td", {}, ["Z = ", "0.65", el("br"), "o/e = ", "0.92 (0.81 - 1.04)"])
        ])
      ])
    ]);
    return [row, table];
  });
  assert.equal(doc.querySelectorAll(".grid-cell")[2].textContent, "3' 非翻译区（UTR）");
  assert.equal(doc.querySelectorAll(".grid-cell")[1].textContent, "G", "来源徽标 G 是数据，不翻");
  assert.equal(doc.querySelectorAll(".grid-cell")[0].textContent, "17-7661882-C-T", "变异 ID 不翻");
  const td = doc.querySelector("td");
  assert.match(td.textContent, /Z 分数 = 0\.65/, "Z 分数标签");
  assert.match(td.textContent, /观测\/期望 = 0\.92 \(0\.81 - 1\.04\)/, "o/e 标签，数值原样");
});

test("ClinVar / 表头筛选器里的 only 按钮翻成「仅」，不碰正文里的 Only / only 片段", () => {
  const { doc } = boot(({ t, el }) => [
    el("div", { class: "sc-jVxTAy bZdNUp" }, [
      el("label", { class: "Checkbox__Label" }, ["pLoF"]),
      " ",
      el("button", { type: "button" }, ["only"])
    ])
  ]);
  assert.equal(doc.querySelector("button").textContent, "仅");
  assert.equal(doc.querySelector("label").textContent, "pLoF", "pLoF 是审编状态缩写，保留");
});

test("变异页 aria-label：Copy link to … 用 requireHit 规则翻，段名没词条就整条留英文", () => {
  const { doc } = boot(({ el }) => [
    el("section", {}, [
      el("a", { "aria-label": "Copy link to Related Variants", href: "#related-variants" }, [""]),
      el("a", { "aria-label": "Copy link to ClinVar", href: "#clinvar" }, [""]),
      el("a", { "aria-label": "Copy link to Totally New Section", href: "#x" }, [""]),
      el("a", { "aria-label": "More datasets", href: "/datasets" }, [""])
    ])
  ], "https://gnomad.broadinstitute.org/variant/17-7676154-G-A");
  const labels = [...doc.querySelectorAll("a")].map((a) => a.getAttribute("aria-label"));
  assert.deepEqual(labels, [
    "复制「相关变异」的链接",
    "复制 ClinVar 的链接",
    "Copy link to Totally New Section",
    "更多数据集"
  ]);
});

test("变异页 ClinVar 区块：字段标签 ClinVar Variation ID / Conditions / Last evaluated 翻", () => {
  const { doc } = boot(({ el }) => [
    el("section", {}, [
      el("dl", {}, [
        el("div", {}, [el("dt", {}, ["ClinVar Variation ID"]), el("dd", {}, ["864652"])]),
        el("div", {}, [el("dt", {}, ["Conditions"]), el("dd", {}, [el("a", {}, ["Li-Fraumeni syndrome"])])]),
        el("div", {}, [el("dt", {}, ["Last evaluated"]), el("dd", {}, ["2024年9月19日"])])
      ])
    ])
  ], "https://gnomad.broadinstitute.org/variant/17-7676154-G-A");
  const dts = [...doc.querySelectorAll("dt")].map((d) => d.textContent);
  assert.deepEqual(dts, ["ClinVar 变异 ID", "疾病条件", "最近评估日期"]);
  assert.equal(doc.querySelector("dd a").textContent, "Li-Fraumeni syndrome", "疾病名来自 ClinVar 数据，不翻");
});

test("变异页「See all 2 submissions」按钮被计数切成两个文本节点，两段都翻，计数原样", () => {
  const { doc } = boot(({ el }) => [
    el("p", {}, [
      el("button", { type: "button", class: "Button__TextButton-sc-1eobygi-3 dcgzGu" }, ["See ", "all 2 submissions"])
    ])
  ], "https://gnomad.broadinstitute.org/variant/17-7676154-G-A");
  assert.equal(doc.querySelector("button").textContent, "查看全部 2 条提交");
});

test("变异页 SpliceAI 说明：预计算句两段各自整条命中（正文块里 ≥40 字符才放行）", () => {
  const { doc } = boot(({ el }) => [
    el("div", { class: "sc-ctAsvE jlatYZ" }, [
      el("span", { level: "info", class: "Badge__BadgeWrapper-sc-j4izdp-1 jbxYNc" }, ["Note"]),
      " The SpliceAI and Pangolin predictions displayed here were precomputed by ",
      el("a", { href: "https://gnomad.broadinstitute.org/news/2023-11-gnomad-v4-0/" }, ["Illumina and Invitae"]),
      ". For more detailed and up to date SpliceAI and Pangolin predictions, please visit our ",
      el("a", { href: "https://spliceailookup.broadinstitute.org/" }, ["SpliceAI Lookup browser"]),
      "."
    ])
  ], "https://gnomad.broadinstitute.org/variant/17-7676154-G-A");
  const txt = doc.querySelector("div").textContent;
  assert.match(txt, /此处显示的 SpliceAI 与 Pangolin 预测由以下机构预计算：\s*Illumina and Invitae/, "前半句：句子收在冒号上，机构名整段留给链接");
  assert.match(txt, /。如需更详细、最新的 SpliceAI 与 Pangolin 预测，请访问我们的/, "后半句");
  assert.match(txt, /Illumina and Invitae/, "机构名是品牌，保留");
  assert.ok(!/were precomputed by|please visit our/.test(txt), "不许残留英文从句");
});

test("变异页 No variant 徽标 / Exome variants 图例 / 样本单位行翻，SVG 数值轴不碰", () => {
  const { doc } = boot(({ el }) => [
    el("div", {}, [
      el("span", { level: "error", class: "Badge__BadgeWrapper-sc-j4izdp-1 lfovgr" }, ["No variant"]),
      el("p", {}, ["Value: ", "1.989e+9 (exome samples)"]),
      el("p", {}, ["Site quality approximation for all singleton variants."])
    ])
  ], "https://gnomad.broadinstitute.org/variant/17-7676154-G-A");
  const spans = doc.querySelectorAll("span");
  assert.equal(spans[0].textContent, "无变异");
  assert.equal(doc.querySelectorAll("p")[0].textContent, "值： 1.989e+9（外显子组样本）");
  assert.equal(doc.querySelectorAll("p")[1].textContent, "全部单例变异的位点质量近似值。");
});

test("数据与品牌一律不翻：变异 ID / HGVSp / 基因符号 / 预测器名 / 版本串", () => {
  const { doc } = boot(({ el }) => [
    el("div", {}, [
      el("li", {}, ["p.Pro72Leu"]),
      el("li", {}, ["Pangolin: -0.0100"]),
      el("li", {}, ["PolyPhen (max): 0.00300"]),
      el("h4", {}, [el("a", {}, ["TP53"])]),
      el("div", {}, ["gnomAD v4.1.2"]),
      el("li", {}, ["2gs0 (ENSP_mappings)"])
    ])
  ], "https://gnomad.broadinstitute.org/variant/17-7676154-G-A");
  assert.equal(doc.querySelector("li").textContent, "p.Pro72Leu");
  const lis = [...doc.querySelectorAll("li")].map((x) => x.textContent);
  assert.deepEqual(lis, ["p.Pro72Leu", "Pangolin: -0.0100", "PolyPhen (max): 0.00300", "2gs0 (ENSP_mappings)"]);
  assert.equal(doc.querySelector("h4 a").textContent, "TP53");
});

test("跨册卫生：新收的词条与先例同值，词库没有自映射", () => {
  const bio = JSON.parse(fs.readFileSync(path.join(root, "../dict/biomart.json"), "utf8"));
  const clinvarCore = JSON.parse(fs.readFileSync(path.join(root, "../dict/clinvar-core.json"), "utf8"));
  assert.equal(gnomad.exact["3' UTR"], bio.exact["3' UTR"], "VEP 后果术语与 biomart 同值");
  assert.equal(gnomad.exact["Conditions"], clinvarCore.exact["Conditions"], "ClinVar 字段与 clinvar-core 同值");
  assert.equal(gnomad.exact["Last evaluated"], clinvarCore.exact["Last evaluated"]);
  assert.equal(gnomad.exact["Feedback"], common.exact["Feedback"]);
  assert.ok(["参见", "查看"].includes(gnomad.exact["See"]), "See 只能沿用既有译法");
  for (const [k, v] of Object.entries(gnomad.exact)) assert.notEqual(k, v, "自映射条目：" + k);
});

test("站点配置未被动过：gnomad 仍是 spa 站，scope=body，dicts 三册", () => {
  assert.equal(gnomadSite.spa, true);
  assert.equal(gnomadSite.waitFor, "#root");
  assert.equal(gnomadSite.scope, "body");
  assert.deepEqual(gnomadSite.dicts, ["common", "spa", "gnomad"]);
});
test("图形图例 Exome variants 翻，MANE 行的「Select transcript for 基因」按规则翻、基因名原样", () => {
  const { doc } = boot(({ el }) => [
    el("div", {}, [
      el("svg", {}, [el("text", {}, ["Exome variants"])]),
      el("div", { class: "sc-zOxLx iIStns" }, [
        el("a", { href: "https://www.ncbi.nlm.nih.gov/refseq/MANE/" }, ["MANE"]),
        " Select transcript for TP53"
      ])
    ])
  ], "https://gnomad.broadinstitute.org/variant/17-7676154-G-A");
  assert.equal(doc.querySelector("svg text").textContent, "外显子组变异");
  assert.equal(doc.querySelector(".sc-zOxLx").textContent, "MANE TP53 的精选转录本");
});
