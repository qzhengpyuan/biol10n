// 站点 scope 选择器体检：给站点 id 与 URL，逐个选择器报命中数，0 命中即告警（会静默回退 body）。
// 用法: node tools/scope-check.mjs <siteId> <url> [waitMs]
// 依赖 CDP 9227 上的浏览器实例与 /mnt/E/临时文件/probe.mjs 的调用约定。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const PROBE = process.env.PROBE || "/mnt/E/临时文件/probe.mjs";
const [siteId, url, waitArg] = process.argv.slice(2);
if (!siteId || !url) { console.error("用法: node tools/scope-check.mjs <siteId> <url> [waitMs]"); process.exit(2); }
const waitMs = Number(waitArg || 15000);

const sites = JSON.parse(fs.readFileSync(path.join(root, "config/sites.json"), "utf8"));
const site = sites.sites.find((s) => s.id === siteId);
if (!site) { console.error("未知站点: " + siteId); process.exit(2); }
const sels = String(site.scope || "").split(",").map((s) => s.trim()).filter(Boolean);
const list = JSON.stringify(sels);
const extra = [
  "const sels = " + list + ";",
  "const out = sels.map(function(sel){ var n = 0; try { n = document.querySelectorAll(sel).length; } catch (e) { n = -1; } return { sel: sel, n: n }; });",
  "return { scope: out, textLen: (document.body ? document.body.innerText.length : -1) };"
].join("\n");

const r = spawnSync(process.execPath, [PROBE, url, String(waitMs), extra], { encoding: "utf8" });
if (r.status !== 0) { console.error(r.stderr || "probe 失败"); process.exit(1); }
let out;
try { out = JSON.parse(r.stdout); } catch (e) { console.error("probe 输出不是 JSON:\n" + String(r.stdout).slice(0, 400)); process.exit(1); }
const scope = (out.extra && out.extra.scope) || [];
let zero = 0;
for (const s of scope) {
  const mark = s.n === 0 ? "0 命中（回退 body？）" : s.n < 0 ? "选择器非法" : String(s.n);
  if (s.n <= 0) zero++;
  console.log("  " + (s.sel + "                                        ").slice(0, 42) + " " + mark);
}
console.log("[" + siteId + "] scope 选择器 " + scope.length + " 个，0 命中 " + zero + " 个；页面文本 " + (out.extra ? out.extra.textLen : "?") + " 字符");
process.exit(zero ? 1 : 0);
