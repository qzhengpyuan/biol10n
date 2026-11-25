// EMBL-EBI Training 点播培训站（www.ebi.ac.uk/training/online/）新站回归：
// 站点按 path ^/training 命中，词表 ebi-training 覆盖首页 hero、筛选条、Ada 聊天弹层与页脚。
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
const site = sites.find((s) => s.id === "ebi-training");
if (!site) throw new Error("config/sites.json 里找不到 ebi-training 站点");

const data = { exact: {}, rules: [], templates: [] };
for (const id of site.dicts) {
  const p = path.join(root, "../dict", id + ".json");
  if (!fs.existsSync(p)) continue;
  const b = JSON.parse(fs.readFileSync(p, "utf8"));
  Object.assign(data.exact, b.exact || {});
  data.rules = data.rules.concat(b.rules || []);
  data.templates = data.templates.concat(b.templates || []);
}

function run(html, url) {
  const dom = new JSDOM(html, { url: url || "https://www.ebi.ac.uk/training/online/" });
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return dom.window.document;
}
const text = (el) => el.textContent.replace(/\s+/g, " ").trim();

test("站点配置：path 命中 /training，且排在 embl-ebi 兜底站之前", () => {
  assert.equal(site.hosts[0], "www.ebi.ac.uk");
  assert.equal(site.path, "^/training");
  assert.ok(site.dicts.includes("ebi-training"));
  const order = sites.map((s) => s.id);
  assert.ok(order.indexOf("ebi-training") < order.indexOf("embl-ebi"));
});

test("首页 hero 整句翻成中文，链接结构不变", () => {
  const html = '<main><p>Discover our online tutorials and webinar library, designed and delivered by EMBL-EBI experts and our wider training faculty. Openly accessible and available whenever you need them - enabling you to learn flexibly at your own pace, wherever you may be.</p></main>';
  const doc = run(html);
  const p = doc.querySelector("p");
  assert.match(text(p), /^浏览我们的在线教程与网络研讨会库/);
  assert.match(text(p), /按自己的节奏灵活学习。$/);
  assert.ok(!/Discover our/.test(text(p)));
});

test("筛选项与类型标签命中", () => {
  const html = '<div><span>Recent first</span><span>Less than 1 hour</span><span>More than 3 hours</span><span>Recorded webinar</span><span>Online tutorial</span><span>Collection</span></div>';
  const doc = run(html);
  const spans = [...doc.querySelectorAll("span")].map(text);
  assert.deepEqual(spans, ["最新优先", "1 小时以内", "3 小时以上", "录制网络研讨会", "在线教程", "合集"]);
});

test("Showing N out of M 规则命中并保留数字", () => {
  const html = '<div><p>Showing 3 out of 57 in on-demand training</p></div>';
  const doc = run(html);
  assert.equal(text(doc.querySelector("p")), "点播培训共 57 项，当前显示 3 项");
});

test("Ada 聊天弹层：开场白与示例问题翻中文，品牌 Ada 保留", () => {
  const html = '<div><button>Ask Ada</button>' +
    "<p>Hello, I'm here to help you explore bioinformatics by answering questions and guiding you to relevant EMBL-EBI on-demand training resources.</p>" +
    "<p>Try asking me:</p><ul><li>Getting started in bioinformatics?</li><li>What is a molecular network?</li><li>Predicting protein structures?</li><li>How can I submit my proteomics data?</li></ul></div>";
  const doc = run(html);
  assert.equal(text(doc.querySelector("button")), "询问 Ada");
  assert.match(text(doc.querySelectorAll("p")[0]), /^你好，我可以回答问题/);
  assert.match(text(doc.querySelectorAll("p")[0]), /EMBL-EBI 点播培训资源/);
  assert.equal(text(doc.querySelectorAll("p")[1]), "可以试着问我：");
  assert.deepEqual([...doc.querySelectorAll("li")].map(text), [
    "刚接触生物信息学，从哪里开始？",
    "什么是分子网络？",
    "想预测蛋白质结构？",
    "如何提交我的蛋白质组学数据？"
  ]);
});

test("关闭聊天的确认弹层翻中文", () => {
  const html = '<div><p>Close chat and delete conversation?</p><p>Are you sure you want to close the chat?</p>' +
    "<p>Your current conversation history will be permanently deleted.</p>" +
    "<button>Keep chat open</button><button>Close and delete</button></div>";
  const doc = run(html);
  assert.deepEqual([...doc.querySelectorAll("p")].map(text), [
    "关闭聊天并删除对话？",
    "确定要关闭聊天吗？",
    "当前对话历史将被永久删除。"
  ]);
  assert.deepEqual([...doc.querySelectorAll("button")].map(text), ["保持聊天打开", "关闭并删除"]);
});

test("页脚机构说明翻中文", () => {
  const html = "<footer><p>EMBL-EBI Training is part of the ELIXIR infrastructure</p>" +
    "<p>The EMBL-EBI Training Programme contributes to the ELIXIR Training Platform</p>" +
    "<p>European Molecular Biology Laboratory</p></footer>";
  const doc = run(html);
  assert.deepEqual([...doc.querySelectorAll("p")].map(text), [
    "EMBL-EBI 培训是 ELIXIR 基础设施的组成部分",
    "EMBL-EBI 培训计划为 ELIXIR 培训平台提供支持",
    "欧洲分子生物学实验室"
  ]);
});

test("品牌与课程名保持英文", () => {
  const html = "<div><p>EMBL-EBI</p><p>EMBL-EBI Training</p><p>ELIXIR</p><p>A guide to UniProt for students and biological scientists</p><p>A beginner’s guide to interpreting results from biostatistics</p></div>";
  const doc = run(html);
  const ps = [...doc.querySelectorAll("p")].map(text);
  assert.equal(ps[0], "EMBL-EBI");
  assert.equal(ps[1], "EMBL-EBI Training");
  assert.equal(ps[2], "ELIXIR");
  assert.equal(ps[3], "A guide to UniProt for students and biological scientists");
  assert.equal(ps[4], "A beginner’s guide to interpreting results from biostatistics");
});

test("词库结构合法、meta 指向站点", () => {
  const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/ebi-training.json"), "utf8"));
  assert.equal(book.meta.sites[0], "www.ebi.ac.uk");
  assert.ok(Object.keys(book.exact).length >= 25);
  for (const [en, zh] of Object.entries(book.exact)) {
    assert.ok(en.trim().length > 0, "英文键不能为空");
    assert.match(zh, /[\u4e00-\u9fff]/, "译文必须含汉字：" + en);
  }
});
