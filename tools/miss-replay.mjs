#!/usr/bin/env node
// 漏翻报告回放：把 research/miss-*.json 里某个站点的文本清单，按 config/sites.json 的
// missNoise（普通条目=子串、re:=不敏感正则、rec:=敏感正则）过滤一遍，打印剩余条数与样本。
// 用途：改名单前先预览收益（--candidates 传候选条目），改完后再跑一次看真实剩余。
// 为什么不走浏览器：报告里已是真实页面的文本清单，回放是纯字符串运算，秒级。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(fs.readFileSync(path.join(root, "config/sites.json"), "utf8"));

export function pickSite(url, sites = cfg.sites) {
  let h = "", p = "/";
  try { const u = new URL(url); h = u.hostname; p = u.pathname; } catch (e) { return null; }
  for (const s of sites) {
    const ok = (s.hosts || []).some((x) => x === h || (x.charAt(0) === "*" && h.slice(-(x.length - 1)) === x.slice(1)));
    if (!ok) continue;
    if (s.path && !new RegExp(s.path).test(p)) continue;
    return s;
  }
  return null;
}

export function compileNoise(list) {
  const rules = [];
  for (const raw of list || []) {
    const n = String(raw || "").trim();
    if (!n) continue;
    const low = n.toLowerCase();
    if (low.startsWith("rec:")) { try { rules.push({ re: new RegExp(n.slice(4)), cs: true }); } catch (e) {} }
    else if (low.startsWith("re:")) { try { rules.push({ re: new RegExp(n.slice(3), "i") }); } catch (e) {} }
    else rules.push({ sub: low });
  }
  return rules;
}

export function isNoise(t, rules) {
  if (!rules || !rules.length) return false;
  const raw = String(t).trim();
  const s = raw.toLowerCase();
  for (const r of rules) {
    if (r.re) { if (r.re.test(r.cs ? raw : s)) return true; }
    else if (s.indexOf(r.sub) >= 0) return true;
  }
  return false;
}

export function findReport(siteId, dir = path.join(root, "research")) {
  const hits = [];
  for (const f of fs.readdirSync(dir)) {
    if (!/^miss-.*\.json$/.test(f)) continue;
    let j;
    try { j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch (e) { continue; }
    const s = pickSite(j.url || "");
    if (!s || s.id !== siteId) continue;
    hits.push({ file: path.join(dir, f), url: j.url || "", texts: j.texts || [], attrs: j.attrs || [], mtime: fs.statSync(path.join(dir, f)).mtimeMs });
  }
  hits.sort((a, b) => b.texts.length - a.texts.length || b.mtime - a.mtime);
  return hits;
}

function main(argv) {
  const args = argv.slice(2);
  if (!args.length || args.includes("--help")) {
    console.log("用法: node tools/miss-replay.mjs <siteId> [--report 文件] [--candidates 候选JSON] [--top 40] [--json]");
    console.log("      node tools/miss-replay.mjs --list");
    return;
  }
  if (args[0] === "--list") {
    const bySite = new Map();
    for (const f of fs.readdirSync(path.join(root, "research"))) {
      if (!/^miss-.*\.json$/.test(f)) continue;
      let j; try { j = JSON.parse(fs.readFileSync(path.join(root, "research", f), "utf8")); } catch (e) { continue; }
      const s = pickSite(j.url || "");
      if (!s) continue;
      const cur = bySite.get(s.id) || { n: 0, files: 0 };
      cur.n = Math.max(cur.n, (j.texts || []).length);
      cur.files++;
      bySite.set(s.id, cur);
    }
    for (const [id, v] of [...bySite.entries()].sort((a, b) => b[1].n - a[1].n)) console.log(String(v.n).padStart(6), id, "报告", v.files, "份");
    return;
  }
  const siteId = args[0];
  const site = cfg.sites.find((s) => s.id === siteId);
  if (!site) { console.error("没有这个站点:", siteId); process.exitCode = 2; return; }
  const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const top = Number(opt("--top") || 40);
  const asJson = args.includes("--json");
  const candFile = opt("--candidates");
  const cands = candFile ? JSON.parse(fs.readFileSync(candFile, "utf8")) : [];
  const reports = opt("--report") ? [{ file: opt("--report"), url: "", texts: JSON.parse(fs.readFileSync(opt("--report"), "utf8")).texts || [], attrs: [], mtime: 0 }] : findReport(siteId);
  if (!reports.length) { console.log("#", siteId, "没有可用报告"); return; }
  const rep = reports[0];
  const rules = compileNoise([].concat(site.missNoise || [], cands));
  const texts = (rep.texts || []).map((t) => Array.isArray(t) ? String(t[0]) : String(t));
  const kept = texts.filter((t) => !isNoise(t, rules));
  const attrs = (rep.attrs || []).map((a) => Array.isArray(a) ? String(a[1]) : String(a));
  const keptAttrs = attrs.filter((t) => !isNoise(t, rules));
  const out = { site: siteId, report: rep.file, url: rep.url, texts: texts.length, filtered: texts.length - kept.length, kept: kept.length, attrs: attrs.length, attrsFiltered: attrs.length - keptAttrs.length, candidates: cands.length, remaining: kept };
  if (asJson) { console.log(JSON.stringify(out, null, 2)); return; }
  console.log("#", siteId, "报告:", path.relative(root, rep.file), rep.url ? "\n  " + rep.url : "");
  if (cands.length) console.log("候选条目", cands.length, "条（只在本次回放生效）");
  console.log("文本", texts.length, "→ 被滤", out.filtered, "→ 剩余", kept.length);
  if (attrs.length) console.log("属性", attrs.length, "→ 被滤", out.attrsFiltered, "→ 剩余", keptAttrs.length);
  const cnt = new Map();
  for (const t of kept) cnt.set(t, (cnt.get(t) || 0) + 1);
  console.log("-- 剩余样本（按出现次数）");
  for (const [t, n] of [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, top)) console.log("  " + String(n).padStart(5), String(t).slice(0, 120));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv);
