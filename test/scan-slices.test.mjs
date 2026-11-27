// 首扫分片：大页面上 walk 只处理前一段，其余进 backlog 由空闲回调补完。
// 分片开关是引擎选项（scanBudgetMs），默认关闭 ⇒ 既有测试与 CLI 行为不变。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(src + "; return createEngine;")();
const dict = JSON.parse(fs.readFileSync(path.join(root, "../dict/common.json"), "utf8"));

function makeEngine(html, opts) {
  const dom = new JSDOM(html, { url: "https://example.org/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: dict.exact || {}, rules: dict.rules || [], templates: dict.templates || [] },
    site: { scope: "body", rescan: false },
    ...opts
  });
  return { dom, engine };
}

const total = 1200;
function page() {
  let h = "<main>";
  for (let i = 0; i < total; i++) h += "<p>Search</p>";
  return h + "</main>";
}

const settled = async (fn, ms = 5000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (fn()) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return false;
};

test("分片首扫：预算用完时留 backlog，空闲回调把它补完", async () => {
  const { dom, engine } = makeEngine(page(), { scanBudgetMs: 1 });
  engine.start();
  const ps = dom.window.document.querySelectorAll("p");
  const cn = () => Array.from(ps).filter((p) => /中/.test(p.textContent) || p.textContent !== "Search").length;
  // 预算 1ms：不可能一次扫完 1200 个节点
  assert.ok(engine.stats.backlog > 0, "应留下 backlog，实际 " + engine.stats.backlog);
  assert.ok(cn() < total, "首扫不应一次翻完");
  assert.ok(await settled(() => engine.stats.backlog === 0 && cn() === total), "backlog 未在 5s 内补完");
  engine.disable();
  dom.window.close();
});

test("分片首扫：默认关闭时一次扫完，stats.backlog 恒为 0", () => {
  const { dom, engine } = makeEngine(page());
  engine.start();
  assert.equal(engine.stats.backlog, 0);
  const ps = dom.window.document.querySelectorAll("p");
  assert.ok(Array.from(ps).every((p) => p.textContent !== "Search"), "默认应一次翻完");
  engine.disable();
  dom.window.close();
});

test("关闭翻译后不再补 backlog", async () => {
  const { dom, engine } = makeEngine(page(), { scanBudgetMs: 1 });
  engine.start();
  const left = engine.stats.backlog;
  assert.ok(left > 0);
  engine.disable();
  assert.equal(engine.stats.backlog, 0, "关闭后 backlog 应清零");
  await new Promise((r) => setTimeout(r, 150));
  const ps = dom.window.document.querySelectorAll("p");
  assert.ok(Array.from(ps).every((p) => p.textContent === "Search"), "关闭后不应再出现译文");
  dom.window.close();
});
