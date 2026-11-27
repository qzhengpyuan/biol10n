// 早启动：翻译从 body 出现就开始，不等 body 有内容。旧判据要等 childElementCount > 0 或
// readyState 不是 loading，实测 RCSB 结构页要 8.1 秒才满足（SPA 空壳先到、内容后挂载），
// 这段时间界面全英文；改成只看 body 存在后 RCSB 1.1 秒、UniProt 84 毫秒。
// jsdom 里 body 总是同步存在、readyState 也很快到位，无法复现「流式 HTML 先到 body 后填内容」，
// 所以这里守的是判据本身（源码层面），真实站点的前后数字记在 PLAN.md。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const boot = fs.readFileSync(path.join(root, "../src/boot.js"), "utf8");
const gate = boot.slice(boot.indexOf("function whenBodyReady"), boot.indexOf("whenBodyReady(function"));

test("whenBodyReady 只看 body 是否存在，不再等子节点", () => {
  assert.ok(gate.length > 0, "没找到 whenBodyReady");
  assert.doesNotMatch(gate, /childElementCount/, "判据又退回等 body 有内容了");
  assert.doesNotMatch(gate, /readyState !== "loading"/, "不该再等 readyState");
  assert.match(gate, /if \(document\.body\) \{ go\(\); return; \}/, "body 已在时应立即开工");
});

test("body 晚到时 100ms 轮询、24 秒兜底", () => {
  assert.match(gate, /\}, 100\);/, "轮询间隔应为 100ms");
  assert.match(gate, /tries > 240/, "兜底应为 240 次（24 秒）");
  assert.match(gate, /document\.addEventListener\("DOMContentLoaded", go\)/, "缺 DOMContentLoaded 兜底");
});

test("timing 拆出 ready / load 两个相位", () => {
  assert.match(boot, /var timing = \{ ready: 0, load: 0, dict: 0, start: 0 \};/);
  assert.match(boot, /timing\.ready = /, "没记 ready");
  assert.match(boot, /timing\.load = Math\.round\(tNow - tDict\)/, "没记纯词库耗时 load");
});
