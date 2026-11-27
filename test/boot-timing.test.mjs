// 注入门控：0.17.5 曾改成「body 出现就开工」，独立复核（冷缓存 A/B + 可见中文时点探针）
// 显示没有稳定收益（静态页 first ≈ ready，差值小于运行间抖动；SPA 正文本来就要等数据），
// 且在流式页面（body 下裸文本先到、首元素晚到）会把半句先翻掉，故 0.17.6 回退。
// 这里守两件事：门控仍然等 body 有内容；timing 仍保留 ready/load 相位拆分（诊断用）。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const boot = fs.readFileSync(path.join(root, "../src/boot.js"), "utf8");
const gate = boot.slice(boot.indexOf("function whenBodyReady"), boot.indexOf("whenBodyReady(function"));

test("whenBodyReady 仍等 body 有内容（早启动已回退）", () => {
  assert.ok(gate.length > 0, "没找到 whenBodyReady");
  assert.match(gate, /document\.body\.childElementCount > 0/, "门控丢了 childElementCount 判据，会退回早启动");
  assert.match(gate, /document\.readyState !== "loading"/, "门控丢了 readyState 判据");
  assert.doesNotMatch(gate, /if \(document\.body\) \{ go\(\); return; \}/, "不能只看 body 存在就开工");
});

test("6 秒兜底与 DOMContentLoaded 兜底都在", () => {
  assert.match(gate, /tries > 12/, "兜底应为 12 次（6 秒）");
  assert.match(gate, /document\.addEventListener\("DOMContentLoaded", go\)/);
});

test("timing 拆出 ready / load 两个相位（回退后保留）", () => {
  assert.match(boot, /var timing = \{ ready: 0, load: 0, dict: 0, start: 0 \};/);
  assert.match(boot, /timing\.ready = /, "没记 ready");
  assert.match(boot, /timing\.load = Math\.round\(tNow - tDict\)/, "没记纯词库耗时 load");
});
