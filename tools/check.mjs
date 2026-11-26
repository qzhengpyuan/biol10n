// 项目自检：词库格式、词条质量、代码红线、站点配置
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const R = (p) => path.join(root, p);
let errors = 0;
let warns = 0;
const err = (m) => { errors++; console.log("  ✖ " + m); };
const warn = (m) => { warns++; console.log("  ⚠ " + m); };

const CJK = /[\u4e00-\u9fff]/;
// 不含任何个人标识：只匹配通用形式的绝对路径与邮箱
const LOCAL_PATH = /(\/mnt\/|\/home\/|\/Users\/[^/\s]+|C:\\\\Users\\\\)/i;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/gi;
const BAD_VALUE = /(\/mnt\/|\/home\/|\/Users\/[^/\s]+|C:\\\\Users\\\\|[\w.+-]+@[\w-]+\.[\w.]+)/i;

// ---------- 1. 词库 ----------
console.log("[1] 词库 dict/*.json");
const dictDir = R("dict");
const files = fs.existsSync(dictDir) ? fs.readdirSync(dictDir).filter((f) => f.endsWith(".json")) : [];
const seen = new Map();
let totalExact = 0;
for (const f of files) {
  const p = path.join(dictDir, f);
  let d;
  try { d = JSON.parse(fs.readFileSync(p, "utf8")); }
  catch (e) { err(f + " 不是合法 JSON: " + e.message); continue; }
  if (!d.meta || !d.meta.family) err(f + " 缺少 meta.family");
  const exact = d.exact || {};
  const keys = Object.keys(exact);
  totalExact += keys.length;
  for (const k of keys) {
    const v = exact[k];
    if (CJK.test(k)) err(f + " 词条键含中文: " + k);
    if (typeof v !== "string" || !v.trim()) err(f + " 词条值为空: " + k);
    else if (!CJK.test(v) && !/^[A-Za-z0-9 ()/+-]+$/.test(v)) warn(f + " 词条值不像中文: " + k + " => " + v);
    if (BAD_VALUE.test(String(v))) err(f + " 词条值含本机信息: " + k);
    if (seen.has(k) && seen.get(k) !== v) warn("跨词库同键不同译法: " + k + " (" + seen.get(k) + " / " + v + ")");
    seen.set(k, v);
    if (v.length > 60) warn(f + " 词条值过长（应改用 rules）: " + k);
  }
  for (const r of d.rules || []) {
    if (!r.re || !r.to) { err(f + " 规则缺 re/to"); continue; }
    if (!/^\^/.test(r.re) || !/\$$/.test(r.re)) warn(f + " 规则未锚定: " + r.re);
    try { new RegExp(r.re); } catch (e) { err(f + " 规则无法编译: " + r.re); }
    // repair 规则是"修半翻文本"的，键里本来就带中文（cBio 的「（非特指：」），不算违规
    if (CJK.test(r.re) && !r.repair) err(f + " 规则含中文: " + r.re);
  }
  // 模板词条：pat 是带 {{n}} 占位符的英文整段，zh 是同样占位符的中文；占位符必须 1..N 一一对应
  for (const t of d.templates || []) {
    if (!t || typeof t.pat !== "string" || typeof t.zh !== "string") { err(f + " 模板缺 pat/zh"); continue; }
    if (CJK.test(t.pat)) err(f + " 模板 pat 含中文: " + t.pat.slice(0, 60));
    if (!CJK.test(t.zh)) err(f + " 模板 zh 不含中文: " + t.pat.slice(0, 60));
    // 模板原文里本来就有联系邮箱（Addgene 的 help@addgene.org、NCBI 的 info@ncbi.nlm.nih.gov）时，
    // 译文照抄该邮箱是正确行为（test/r44、r69 明确断言「邮箱不应被改写」）；只拦译文自己编出来的地址。
    if (LOCAL_PATH.test(t.zh)) err(f + " 模板 zh 含本机路径: " + t.pat.slice(0, 60));
    for (const mail of t.zh.match(EMAIL) || []) {
      if (!t.pat.includes(mail)) err(f + " 模板 zh 含 pat 里没有的邮箱: " + t.pat.slice(0, 60) + " → " + mail);
    }
    const nums = (s) => (s.match(/\{\{(\d+)\}\}/g) || []).map((x) => Number(x.replace(/\D/g, "")));
    const a = nums(t.pat), b = nums(t.zh);
    if (!a.length) err(f + " 模板 pat 没有占位符: " + t.pat.slice(0, 60));
    if (a.slice().sort((x, y) => x - y).join(",") !== b.slice().sort((x, y) => x - y).join(",")) {
      err(f + " 模板占位符不一致: " + t.pat.slice(0, 50) + " / " + t.zh.slice(0, 50));
    }
  }
  console.log("    " + f.padEnd(22) + keys.length + " 条 / " + (d.rules || []).length + " 条规则 / " + (d.templates || []).length + " 条模板");
}
console.log("    合计 " + totalExact + " 条 exact");

// ---------- 2. 代码红线 ----------
console.log("[2] 代码红线");
const FORBIDDEN = [
  ["fetch(", "网络请求"], ["XMLHttpRequest", "网络请求"], ["WebSocket", "网络请求"],
  ["sendBeacon", "网络请求"], ["eval(", "字符串求值"], ["new Function", "字符串求值"],
  ["innerHTML", "写入 HTML"], ["outerHTML", "写入 HTML"], ["insertAdjacentHTML", "写入 HTML"],
  ["document.cookie", "身份数据"], ["GM_", "特权接口"], ["@require", "远程依赖"],
  ["@resource", "远程依赖"], ["@connect", "网络请求"]
];
for (const f of ["src/engine.js", "src/boot.js"]) {
  const code = fs.readFileSync(R(f), "utf8");
  for (const [needle, why] of FORBIDDEN) {
    if (code.includes(needle)) err(f + " 出现 " + needle + "（" + why + "）");
  }
}

// ---------- 3. 站点配置 ----------
console.log("[3] 站点配置");
try {
  const sites = JSON.parse(fs.readFileSync(R("config/sites.json"), "utf8"));
  for (const s of sites.sites) {
    if (!s.id) err("站点缺 id");
    if (!s.hosts || !s.hosts.length) err(s.id + " 缺 hosts");
    for (const h of s.hosts || []) {
      if (h === "*") { err(s.id + " 主机名过宽: " + h); continue; }
      // 通配只允许是本站某个具体域名的子域，如 *.archive.ensembl.org 对应 ensembl.org
      if (h.startsWith("*.")) {
        const base = h.slice(1);
        const owned = (s.hosts || []).some((o) => !o.startsWith("*") && base.endsWith("." + o));
        if (!owned) err(s.id + " 通配主机名没有对应的具体域名: " + h);
      }
    }
    for (const d of s.dicts || []) {
      if (!fs.existsSync(path.join(dictDir, d + ".json"))) warn(s.id + " 引用的词库不存在: " + d);
    }
  }
  console.log("    " + sites.sites.length + " 个站点");
} catch (e) { err("config/sites.json 解析失败: " + e.message); }

// ---------- 3.5 术语一致性 ----------
console.log("[3.5] 术语一致性");
{
  const p = path.join(root, "docs/terms.json");
  if (fs.existsSync(p)) {
    const terms = JSON.parse(fs.readFileSync(p, "utf8"));
    const allow = new Set(terms.allowOverride || []);
    let bad = 0;
    for (const f of files) {
      if (("dict/" + f) === terms.source) continue;
      const d = JSON.parse(fs.readFileSync(path.join(dictDir, f), "utf8"));
      for (const [k, v] of Object.entries(d.exact || {})) {
        if (!(k in (terms.canonical || {}))) continue;
        if (allow.has(k)) continue;
        if (v !== terms.canonical[k]) { err(f + " 术语不一致: " + k + " " + v + " ≠ " + terms.canonical[k]); bad++; }
      }
    }
    console.log("    " + (bad ? bad + " 处不一致" : "一致"));
  } else {
    console.log("    尚无 docs/terms.json");
  }
}

// ---------- 4. 构建产物 ----------
console.log("[4] 构建产物");
const dist = R("dist/biol10n.user.js");
if (fs.existsSync(dist)) {
  const size = fs.statSync(dist).size;
  console.log("    dist/biol10n.user.js  " + (size / 1024).toFixed(1) + " KB");
  if (size > 2 * 1024 * 1024) warn("脚本超过 2 MB，考虑拆分词库");
  const head = fs.readFileSync(dist, "utf8").slice(0, 400);
  if (!/@license\s+MIT/.test(head)) err("缺少 MIT 声明");
} else {
  console.log("    尚未构建（npm run build）");
}

console.log("\n结果：" + (errors ? "✖ " + errors + " 个错误" : "✔ 无错误") + (warns ? "，⚠ " + warns + " 个提示" : ""));
process.exit(errors ? 1 : 0);
