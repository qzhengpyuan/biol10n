import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(root, "src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();
const sites = JSON.parse(fs.readFileSync(path.join(root, "config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "alphafold");

function loadData(dicts) {
  const data = { exact: {}, rules: [], templates: [] };
  for (const id of dicts) {
    const d = JSON.parse(fs.readFileSync(path.join(root, "dict", id + ".json"), "utf8"));
    Object.assign(data.exact, d.exact || {});
    data.rules = data.rules.concat(d.rules || []);
    data.templates = data.templates.concat(d.templates || []);
  }
  return data;
}
const data = loadData(site.dicts);

function boot(html) {
  const dom = new JSDOM("<!doctype html><html><body>" + html + "</body></html>", { url: "https://alphafold.ebi.ac.uk/faq" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return dom.window.document;
}
const txt = (doc) => (doc.body.textContent || "").replace(/\s+/g, " ").trim();

// FAQ 问题标题（h3，整段 exact）
test("FAQ 问题标题整条翻译", () => {
  const doc = boot("<h3>What are proteins?</h3><h3>What’s new?</h3>");
  assert.equal(doc.querySelectorAll("h3")[0].textContent, "什么是蛋白质？");
  assert.equal(doc.querySelectorAll("h3")[1].textContent, "最新动态");
});

// 被内联链接切碎的整句走 templates：链接文字保留原文、句子其余部分翻成中文
test("带内联链接的许可条款整句走模板", () => {
  const doc = boot('<p>Data is available for academic and commercial use, under a Creative Commons Attribution 4.0 (<a href="https://creativecommons.org/licenses/by/4.0/">CC-BY 4.0</a>) licence terms.</p>');
  const p = doc.querySelector("p").textContent;
  assert.match(p, /知识共享署名 4\.0/);
  assert.match(p, /CC-BY 4\.0/, "许可缩写是数据，保留原文");
});

// 长 li 里被 <a> 切碎的两段：含嵌套 <ul> 不能走整块模板，按文本节点补
test("更新记录长 li 的分段翻译（含受影响登录号清单链接）", () => {
  const doc = boot(
    '<ul><li>Nov 2022: updated a set of structures affected by a temporary numerical bug (miscompilation) in the previous July release (<a href="/download">list of affected accessions</a>, N.B. 160 MiB). This temporary issue resulted in low accuracy predictions with correspondingly low pLDDT for ~4% of the total structure predictions available in the database. This release includes:<ul><li>Updated coordinates for affected structures.</li><li>Minor metadata changes in the mmCIF files</li></ul></li></ul>'
  );
  const t = txt(doc);
  assert.match(t, /2022 年 11 月：更新了一批/);
  assert.match(t, /受影响登录号清单/);
  assert.match(t, /pLDDT 相应较低/);
  assert.match(t, /本次更新包含/);
  assert.match(t, /mmCIF 文件中的少量元数据变更/);
});

// ipSAE 说明段（b 标签后可翻的 810 字符正文节点）
test("ipSAE 说明段翻译、指标名保留", () => {
  const doc = boot(
    '<ul><li><b>ipSAE</b> (interaction prediction Score from Aligned Errors) is an ipTM-like metric derived from AlphaFold’s predicted aligned error (PAE) between residues of different chains in the predicted complex. For each pair of chains the score only considers residue pairs that have a PAE < 10 Å and are within 15 Å of distance in the predicted structure. This restricts the calculation to interface regions where AlphaFold predicts a more reliable relative positioning. The retained PAE values are converted into TM-like confidence values and averaged to calculate the score. ipSAE recalculates its scaling based on the number of residues that pass the PAE and distance cutoff, rather than on the full chain lengths. As a result, ipSAE is less influenced by disordered regions or non-interacting domains. For more details, see: <a href="#">x</a></li></ul>'
  );
  const t = txt(doc);
  assert.match(t, /基于比对误差的相互作用预测得分/);
  assert.match(t, /预测比对误差（PAE）/);
  assert.match(t, /ipSAE/);
});

// TED 质量指标：加粗小标签与长 li 说明
test("TED 质量标签与 Qscore 说明翻译", () => {
  const doc = boot(
    "<ul><li><b>Domain index:</b> This number indicates the order in which a domain appears in the protein sequence, starting from the N-terminal residue.</li>" +
    "<li><b>Note that Qscore is a float quality metric from 0-100 calculated as a weighted average between the following parameters:</b></li>" +
    "<li>a) Minimum value between the query and the target coverage by Foldseek scans vs CATH SSG5 domains (50% weight). For more information about SSG5 domains, refer to the paper:</li></ul>"
  );
  const t = txt(doc);
  assert.match(t, /结构域编号：/);
  assert.match(t, /Qscore 是 0-100 的浮点质量指标/);
  assert.match(t, /CATH SSG5 结构域之间的覆盖率较小值/);
});

// PAE 说明段的 JSON 代码示例：变量名与字段名属纯数据，JS 对象结构保持英文原样
test("PAE 代码示例不翻、字段名保留", () => {
  const doc = boot(
    '<pre><code>[{"predicted_aligned_error": [[0, 1, 4, 7, 9, ...], ...], # Shape: (num_res, num_res). "max_predicted_aligned_error": 31.75}]</code></pre>'
  );
  const t = doc.querySelector("code").textContent;
  assert.match(t, /predicted_aligned_error/);
  assert.match(t, /num_res/);
  assert.match(t, /max_predicted_aligned_error/);
});

// 空态整页：4 条 exact + 含 FAQ 链接的模板，全部写在本册（不混进 common）
test("空态：No entry found 与建议列表全部翻译", () => {
  const doc = boot(
    '<h3 class="noentry-title">No entry found</h3>' +
    '<div class="progress-suggestions"><p>Suggestions:</p><ul>' +
    '<li>Check the spelling.</li>' +
    '<li>Try searching with a protein or gene name rather than by a specific accession.</li>' +
    '<li>Check whether your protein may be excluded for one of the reasons outlined in our <a href="/faq">FAQs</a>.</li>' +
    "</ul></div>"
  );
  const t = txt(doc);
  assert.match(t, /未找到条目/);
  assert.match(t, /建议：/);
  assert.match(t, /请检查拼写。/);
  assert.match(t, /尝试用蛋白质或基因名称检索，而不是具体的登录号。/);
  assert.match(t, /请确认你的蛋白质是否因我们常见问题中列出的某项原因而被排除。/);
});

test("空态词条落在 alphafold.json 而非 common", () => {
  const af = JSON.parse(fs.readFileSync(path.join(root, "dict/alphafold.json"), "utf8"));
  const common = JSON.parse(fs.readFileSync(path.join(root, "dict/common.json"), "utf8"));
  assert.equal(af.exact["No entry found"], "未找到条目");
  assert.equal(af.exact["Suggestions:"], "建议：");
  assert.equal(common.exact["No entry found"], undefined);
  assert.ok(af.templates.some((x) => /FAQs/.test(x.pat) && /\{\{1\}\}/.test(x.pat)));
});

// 口径：物种名、登录号、邮箱、数据集名不翻
test("口径内的数据保持原文", () => {
  const doc = boot(
    '<p>Trypanosoma and Leishmania protein structures</p>' +
    "<p>Q9I1F6</p>" +
    '<p>Contact <a href="mailto:afdbhelp@ebi.ac.uk">afdbhelp@ebi.ac.uk</a></p>' +
    "<p>AllTheBacteria</p>"
  );
  const t = txt(doc);
  assert.match(t, /Trypanosoma and Leishmania/);
  assert.match(t, /Q9I1F6/);
  assert.match(t, /afdbhelp@ebi\.ac\.uk/);
  assert.match(t, /AllTheBacteria/);
});
