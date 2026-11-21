// UniProt 剩余英文词库（dict/uniprot2.json）校验 + 引擎行为测试
// 覆盖：条目页化学/名称/序列小标签与固定说明句、论文页分面与计数、外部链接页表头、首页短语、特征视图提示
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/uniprot2.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "uniprot");

// 测试里关掉 SPA 轮询与延迟补扫，避免定时器拖住进程；扫描逻辑本身不受影响
const testSite = { ...site, spa: false, rescan: false };

const DISCLAIMER =
  "Any medical or genetic information present in this entry is provided for research, educational and informational purposes only. " +
  "It is not in any way intended to be used as a substitute for professional medical advice, diagnosis, treatment or care. " +
  "Our staff consists of biologists and biochemists that are not trained to give medical advice.";

function mount(html, url = "https://www.uniprot.org/uniprotkb/P04637/entry") {
  const dom = new JSDOM("<main>" + html + "</main>", { url });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: dict.exact, rules: dict.rules, templates: dict.templates },
    site: testSite
  });
  engine.start();
  return dom.window.document;
}

// ---------------- 结构校验 ----------------

test("词库可解析，exact/rules 有内容", () => {
  assert.equal(dict.meta.family, "uniprot");
  assert.ok(Object.keys(dict.exact).length >= 60, "exact 条目应不少于 60 条");
  assert.ok(dict.rules.length >= 8, "rules 至少 8 条");
  assert.ok(Array.isArray(dict.templates));
});

test("关键条目存在（标签、说明句、论文页、外部链接页、首页）", () => {
  const want = {
    Ligand: "配体",
    "Short name": "简称",
    "Sequence processing": "序列加工",
    "Genomic RNA": "基因组 RNA",
    "Hide reaction details": "隐藏反应详情",
    "Sequence problems.": "序列问题。",
    "The displayed sequence is further processed into a mature form.": "所显示的序列会进一步加工为成熟形式。",
    "Disease susceptibility is associated with variants affecting the gene represented in this entry": "疾病易感性与本条目所代表基因的变异相关",
    "No title available.": "暂无标题。",
    "Submitted to EMBL/GenBank/DDBJ databases": "提交至 EMBL/GenBank/DDBJ 数据库",
    "PDB ENTRY": "PDB 条目",
    RESOLUTION: "分辨率",
    "The buzz": "热点",
    "Please interact with the page to view the Feature Viewer": "请与页面交互以查看特征视图"
  };
  for (const [k, v] of Object.entries(want)) assert.equal(dict.exact[k], v, "缺少或值不符：" + k);
  assert.ok(dict.exact[DISCLAIMER], "免责声明整段必须收进词表");
  assert.match(dict.exact[DISCLAIMER], /仅供研究、教育与参考/);
});

test("rule 正则可编译，且能按实测原文改写", () => {
  for (const r of dict.rules) {
    assert.doesNotThrow(() => new RegExp(r.re), "坏正则：" + r.re);
    assert.ok(r.to.length > 0);
  }
  const apply = (text) => {
    for (const r of dict.rules) {
      const m = new RegExp(r.re).exec(text);
      if (m) return r.to.replace(/\$(\d)/g, (_, d) => m[Number(d)]);
    }
    return null;
  };
  assert.equal(apply("Chromosome 17"), "17 号染色体");
  assert.equal(apply("Chromosome X"), "X 号染色体");
  assert.equal(apply("Computationally mapped (11,519)"), "计算映射（11,519）");
  assert.equal(apply("Large scale (10,118)"), "大规模（10,118）");
  assert.equal(apply("Small scale (1,641)"), "小规模（1,641）");
  assert.equal(apply("Cited in 99+"), "被引用 99+ 次");
  assert.equal(apply("Mapped to 2"), "映射到 2");
  assert.equal(apply("10 GO annotations based on evolutionary models"), "10 条基于演化模型的 GO 注释");
  assert.equal(apply("77 NDEx IQuery Curated Pathways"), "77 条 NDEx IQuery 精选通路");
  assert.equal(apply("352510498 antibodies from 69 providers"), "352510498 个抗体，来自 69 家供应商");
  assert.equal(apply("67 sequenced antibodies"), "67 个已测序抗体");
  // 不能误伤数字以外的写法
  assert.equal(apply("Chromosome 17q"), null);
});

test("key 里没有中文，value 里没有明文 URL / 邮箱", () => {
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "key 含中文：" + k);
    assert.ok(!/https?:\/\/|[\w.+-]+@[\w-]+\.\w+/.test(v), "value 含 URL/邮箱：" + k);
    assert.ok(/[\u4e00-\u9fff]/.test(v), "value 必须是中文：" + k);
  }
  for (const t of dict.templates) {
    assert.ok(!/https?:\/\/|[\w.+-]+@[\w-]+\.\w+/.test(t.zh), "模板译文含 URL/邮箱");
  }
});

// ---------------- 引擎行为 ----------------

test("条目页：标签、计数规则、关键词都翻成中文", () => {
  const doc = mount(
    '<div class="card"><div class="decorated-list-item__title tiny">Ligand</div></div>' +
      "<ul><li>Chromosome 17</li><li>Chromosome X</li></ul>" +
      "<div>Computationally mapped (11,519)</div>" +
      "<div>Large scale (10,118)</div>" +
      "<div>Small scale (1,641)</div>" +
      "<div>Cited in 99+</div>" +
      "<div>Mapped to 2</div>" +
      "<div>10 GO annotations based on evolutionary models</div>" +
      "<div>67 sequenced antibodies</div>" +
      "<ul><li>#Activator</li><li>#Kinase</li><li>#Apoptosis</li></ul>" +
      "<button>Hide reaction details</button>"
  );
  const text = doc.body.textContent;
  for (const zh of ["配体", "17 号染色体", "X 号染色体", "计算映射（11,519）", "大规模（10,118）", "小规模（1,641）", "被引用 99+ 次", "映射到 2", "10 条基于演化模型的 GO 注释", "67 个已测序抗体", "激活因子", "激酶", "凋亡", "隐藏反应详情"]) {
    assert.ok(text.includes(zh), "缺少译文：" + zh);
  }
});

test("条目页：说明句整段翻译，且不碰蛋白名/证据代码/rsID", () => {
  const doc = mount(
    "<h4>Disease susceptibility is associated with variants affecting the gene represented in this entry</h4>" +
      "<p>" + DISCLAIMER + "</p>" +
      "<div>NUCLEOTIDE SEQUENCE [MRNA] (ISOFORM 1)</div>" +
      "<div>dbSNP:rs730882023</div>" +
      "<div>Cellular tumor antigen p53</div>"
  );
  const h4 = doc.querySelector("h4").textContent;
  assert.match(h4, /疾病易感性/);
  const p = doc.querySelector("p").textContent;
  assert.match(p, /^本条目中的任何医学或遗传学信息/);
  assert.match(p, /未接受过提供医疗建议的培训。$/);
  assert.ok(!/Any medical or genetic information/.test(p));
  // 数据类内容保持英文
  assert.equal(doc.querySelectorAll("div")[0].textContent, "NUCLEOTIDE SEQUENCE [MRNA] (ISOFORM 1)");
  assert.equal(doc.querySelectorAll("div")[1].textContent, "dbSNP:rs730882023");
  assert.equal(doc.querySelectorAll("div")[2].textContent, "Cellular tumor antigen p53");
});

test("论文页 / 外部链接页 / 首页短语", () => {
  const doc = mount(
    "<div>Study type</div><div>Submission</div><div>Submitted to EMBL/GenBank/DDBJ databases</div>" +
      "<div>No title available.</div><table><thead><tr><th>PDB ENTRY</th><th>RESOLUTION</th></tr></thead></table>" +
      "<div>X-ray</div><div>NMR</div><h3>The buzz</h3>" +
      "<p>Please interact with the page to view the Feature Viewer</p>"
  );
  const text = doc.body.textContent;
  for (const zh of ["研究类型", "提交", "提交至 EMBL/GenBank/DDBJ 数据库", "暂无标题。", "PDB 条目", "分辨率", "X 射线", "核磁共振", "热点", "请与页面交互以查看特征视图"]) {
    assert.ok(text.includes(zh), "缺少译文：" + zh);
  }
});
