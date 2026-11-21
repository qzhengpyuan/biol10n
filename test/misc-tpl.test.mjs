// misc-tpl：GEPIA2 / UALCAN / TIMER 被内联元素切碎的说明句（模板通道）
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const engineSrc = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(engineSrc + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/misc-tpl.json"), "utf8"));

function boot(html, data = {}) {
  const dom = new JSDOM(html);
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: {
      exact: data.exact || dict.exact,
      rules: data.rules || [],
      templates: data.templates || dict.templates
    },
    site: { scope: "body", block: "pre, code" }
  });
  engine.start();
  return { engine, doc: dom.window.document, dom };
}

test("GEPIA2 首页声明句：两个 <span> 回填，整段变中文", () => {
  const { engine, doc, dom } = boot(
    '<p>Statement: All the datasets on the server are <span style="color:red;">computed by a standard pipeline</span> and are compatible with each other. Use the <span style="color:red;">Google Chrome </span>browser for best visualization quality.</p>'
  );
  const p = doc.querySelector("p");
  assert.match(p.textContent, /声明：服务器上的所有数据集由标准流程计算/, "整段应换成中文");
  assert.doesNotMatch(p.textContent, /All the datasets on the server/);
  const spans = p.querySelectorAll("span");
  assert.equal(spans.length, 2, "两个 span 都保留");
  assert.match(spans[0].getAttribute("style"), /color:\s*red/, "span 属性不变");
  assert.equal(spans[1].textContent, "Google Chrome ", "品牌名原样回填");
  assert.equal(engine.stats.tpl, 1);
  dom.window.close();
});

test("GEPIA2 参数说明：<strong> 标签位保留，句子其余部分变中文", () => {
  const { engine, doc, dom } = boot("<li><strong>Gene</strong>: Input a gene of interest.</li>");
  const li = doc.querySelector("li");
  assert.match(li.textContent, /：输入感兴趣的基因。/, "说明句应译出");
  assert.equal(li.querySelector("strong").textContent, "Gene", "槽位内容不被模板改写");
  assert.equal(engine.stats.tpl, 1);
  dom.window.close();
});

test("GEPIA2 log2FC 句：<sub> 保留，句子译成中文", () => {
  const { doc, dom } = boot(
    "<p>The expression data are first log<sub>2</sub>(TPM+1) transformed for differential analysis.</p>"
  );
  const p = doc.querySelector("p");
  assert.match(p.textContent, /表达数据首先经 log2\(TPM\+1\) 转换/, "含下标的整句应命中模板");
  assert.equal(p.querySelector("sub").textContent, "2", "下标节点仍在");
  dom.window.close();
});

test("UALCAN 步骤句：<font>Step 1:</font> 与说明文字拆开也能整句翻", () => {
  const { engine, doc, dom } = boot(
    '<p><font style="font-weight:bold;">Step 1:</font> Go to analysis page of UALCAN and choose cancer of interest from left panel by clicking it.</p>'
  );
  const p = doc.querySelector("p");
  assert.match(p.textContent, /前往 UALCAN 分析页面/, "步骤说明应译出");
  assert.equal(p.querySelector("font").getAttribute("style"), "font-weight:bold;", "font 属性保留");
  assert.equal(engine.stats.tpl, 1);
  dom.window.close();
});

test("TIMER3 更新列表：四个 <br> 槽位回填，四条要点都变中文", () => {
  const html =
    '<p style="font-size:90%">1. TIMER3 integrates 15 state-of-the-art immune deconvolution algorithms, including both human-specific and mouse-specific methods. <br> 2. TIMER3 integrates 32 immunotherapy-related public RNA-seq datasets and enables ROC curve-based evaluation of immune biomarker predictive efficacy. <br> 3. TIMER3 has introduced an updated gene signature analysis module, enabling comprehensive analysis of GO:BP, KEGG, and HALLMARK gene signatures. <br> 4. TIMER3 now features updates, including customizable cancer type selection, gene alias search functionality, and expanded prognostic analysis metrics. <br> </p>';
  const { engine, doc, dom } = boot(html);
  const p = doc.querySelector("p");
  assert.match(p.textContent, /整合了 15 种最先进的免疫去卷积算法/);
  assert.match(p.textContent, /免疫治疗相关的公共 RNA-seq 数据集/);
  assert.match(p.textContent, /基因特征分析模块/);
  assert.match(p.textContent, /可自定义的癌症类型选择/);
  assert.equal(p.querySelectorAll("br").length, 4, "换行节点一个不少");
  assert.equal(engine.stats.tpl, 1);
  dom.window.close();
});

test("带 <a> 的方括号说明：链接保留且 href 不变", () => {
  const { doc, dom } = boot(
    '<p><span style="color:red">Differential thresholds</span>: [See detail of differential analysis methods <a href="#methods">here</a>]</p>'
  );
  const p = doc.querySelector("p");
  assert.match(p.textContent, /差异分析方法详情见/);
  const a = p.querySelector("a");
  assert.ok(a, "链接节点必须还在");
  assert.equal(a.getAttribute("href"), "#methods");
  assert.equal(a.textContent, "here", "槽位文本原样");
  dom.window.close();
});

test("中文译文占位符少一个时不替换（宁可留英文也不丢链接）", () => {
  const bad = { pat: "{{1}}: Input a gene of interest.", zh: "输入感兴趣的基因。" };
  const { engine, doc, dom } = boot("<li><strong>Gene</strong>: Input a gene of interest.</li>", {
    templates: [bad],
    exact: {}
  });
  assert.match(doc.querySelector("li").textContent, /Input a gene of interest/);
  assert.equal(engine.stats.tpl, 0);
  dom.window.close();
});

test("词表里的短标签（exact）仍然生效", () => {
  const { doc, dom } = boot("<h4>Box Plots</h4><label>Gene Expression:</label>");
  assert.equal(doc.querySelector("h4").textContent, "箱线图");
  assert.equal(doc.querySelector("label").textContent, "基因表达：");
  dom.window.close();
});

test("dict 结构自检：模板占位符连续且与中文一一对应", () => {
  for (const t of dict.templates) {
    const used = [];
    const re = /\{\{(\d+)\}\}/g;
    let m;
    while ((m = re.exec(t.zh))) used.push(Number(m[1]));
    const sorted = used.slice().sort((a, b) => a - b);
    sorted.forEach((v, i) => assert.equal(v, i + 1, "占位符必须 1..N 连续：" + t.pat.slice(0, 60)));
    const nPat = (t.pat.match(/\{\{(\d+)\}\}/g) || []).length;
    assert.equal(used.length, nPat, "中英占位符数量一致：" + t.pat.slice(0, 60));
    assert.doesNotMatch(t.pat, /[\u4e00-\u9fff]/, "pat 不应含中文");
    assert.match(t.zh, /[\u4e00-\u9fff]/, "zh 必须是中文");
  }
});
