// 构建：把引擎、站点配置与全部词库合成一个离线 .user.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const readJSON = (p) => JSON.parse(read(p));

const pkg = readJSON("package.json");
const sites = readJSON("config/sites.json");

const dictDir = path.join(root, "dict");
const dict = {};
for (const f of fs.readdirSync(dictDir).filter((f) => f.endsWith(".json")).sort()) {
  const id = f.replace(/\.json$/, "");
  try {
    dict[id] = readJSON(path.join("dict", f));
  } catch (e) {
    console.error("词典解析失败，跳过:", f, e.message);
  }
}

// 册数校验：sites.json 引用的每一册都必须真的内嵌进产物，否则该站会静默退化一整轮。
// （0.9.96 踩过：4 册被跳过，pubmed2/hpa2/gdc2/gdv 当轮白跑。）
const refs = new Set();
for (const s of sites.sites) for (const d of s.dicts || []) refs.add(d);
const missing = [...refs].filter((d) => !dict[d]).sort();
if (missing.length) {
  console.error("构建中止：sites.json 引用了不存在的词库:", missing.join(", "));
  process.exit(1);
}
const unused = Object.keys(dict).filter((d) => !refs.has(d)).sort();
if (unused.length) {
  // 有册没挂站 = 这一册永远不进产物，等于白写；0.9.96 与 0.9.99 各漏过一次，故这里直接失败。
  console.error("构建中止：dict/ 下这些册没有被任何站点引用:", unused.join(", "));
  process.exit(1);
}

// 词条形状校验：rules 必须是 {"re","to"} 对象、templates 必须是 {"pat","zh"}。
// 写成 ["正则","替换"] 数组时构建不报错，但运行期 translateRules 会直接抛 TypeError，
// 整个站的翻译当场瘫掉（0.12.7 开发 ebi-training 时踩到，靠单测才发现）。
for (const id of Object.keys(dict)) {
  const d = dict[id];
  (d.rules || []).forEach((r, i) => {
    if (!r || typeof r.re !== "string" || typeof r.to !== "string") {
      console.error("构建中止：" + id + ".rules[" + i + "] 必须是 {\"re\":\"…\",\"to\":\"…\"}，实际 " + JSON.stringify(r));
      process.exit(1);
    }
  });
  (d.templates || []).forEach((t, i) => {
    if (!t || typeof t.pat !== "string" || typeof t.zh !== "string") {
      console.error("构建中止：" + id + ".templates[" + i + "] 必须是 {\"pat\":\"…\",\"zh\":\"…\"}，实际 " + JSON.stringify(t));
      process.exit(1);
    }
  });
}

const hosts = new Set();
for (const s of sites.sites) for (const h of s.hosts) hosts.add(h);
const matchLines = [];
for (const s of sites.sites) {
  const protos = s.protocols && s.protocols.length ? s.protocols : ["https"];
  for (const h of s.hosts) for (const p of protos) matchLines.push("// @match        " + p + "://" + h + "/*");
}
const matches = [...new Set(matchLines)].join("\n");

// 发布分支只放单文件产物，商店同步与手动安装都读这个地址
const RAW_URL = "https://raw.githubusercontent.com/qzhengpyuan/biol10n/release/biol10n.user.js";

const header = [
  "// ==UserScript==",
  "// @name         BioL10n 生物医学网站中文化",
  "// @name:en      BioL10n",
  "// @namespace    biol10n",
  "// @version      " + pkg.version,
  "// @description  离线词库驱动的生物医学网站界面汉化：只替换界面文本，不联网、不调用翻译 API",
  "// @author       BioL10n contributors",
  "// @license      MIT",
  "// @homepageURL  https://github.com/qzhengpyuan/biol10n",
  "// @icon         https://raw.githubusercontent.com/qzhengpyuan/biol10n/main/assets/icon-48.png",
  "// @icon64       https://raw.githubusercontent.com/qzhengpyuan/biol10n/main/assets/icon-64.png",
  "// @downloadURL  " + RAW_URL,
  "// @updateURL    " + RAW_URL,
  "// @run-at       document-end",
  "// @grant        none",
  matches,
  "// ==/UserScript==",
  ""
].join("\n");

// 词库不直接写成 JS 对象字面量：那样脚本一加载（哪怕不是本站）就会把所有词库全部解析一遍。
// 这里每本词库单独 gzip + base64 存成字符串，boot 先按 hostname 认出站点，
// 再只用 DecompressionStream 解压该站用到的那几本（meta 只在构建期用，运行期丢掉）。
const dictSrc = {};
for (const id of Object.keys(dict)) {
  const d = dict[id];
  delete d.meta;
  dictSrc[id] = zlib.gzipSync(Buffer.from(JSON.stringify(d), "utf8"), { level: 9 }).toString("base64");
}

const engine = read("src/engine.js");
const ui = read("src/ui.js");
const boot = read("src/boot.js")
  .replace("__BIOL10N_DICT__", () => JSON.stringify(dictSrc))
  .replace("__BIOL10N_SITES__", () => JSON.stringify(sites))
  .replace("__BIOL10N_VERSION__", () => pkg.version);

const out = header + "\n" + engine + "\n" + ui + "\n" + boot;
fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.writeFileSync(path.join(root, "dist/biol10n.user.js"), out);

// 构建指纹：单测拿它和磁盘词库比，防止「盘上改了、dist 还是旧的」这种假修复
// （检查方 r22 的 P0-2 就是这样连着两轮报的）。
let _exact = 0, _rules = 0, _tpl = 0;
for (const id of Object.keys(dict)) {
  const d = dict[id];
  _exact += Object.keys(d.exact || {}).length;
  _rules += (d.rules || []).length;
  _tpl += (d.templates || []).length;
}
// 词库总指纹：条数相同但内容变了（改一条删一条）时也能抓到（r25 P0-1）
  const { createHash } = await import("node:crypto");
  const hash = createHash("sha256");
  for (const f of fs.readdirSync(path.join(root, "dict")).filter((x) => x.endsWith(".json")).sort()) {
    const raw = fs.readFileSync(path.join(root, "dict", f));
    hash.update(f + ":" + raw.length + ":" + createHash("sha256").update(raw).digest("hex"));
  }
  hash.update("sites:" + createHash("sha256").update(fs.readFileSync(path.join(root, "config/sites.json"))).digest("hex"));
  const buildFingerprint = hash.digest("hex").slice(0, 24);
  const stamp = {
  version: pkg.version,
  books: Object.keys(dict).length,
  sites: sites.sites.length,
  exact: _exact, rules: _rules, templates: _tpl,
  // 逐册条数：dist-fresh 红的时候直接点名是哪几册改了没重建（r26 P0-2 的排查成本就在这里）
  perBook: Object.fromEntries(Object.keys(dict).sort().map((id) => {
    const d = dict[id];
    return [id, [Object.keys(d.exact || {}).length, (d.rules || []).length, (d.templates || []).length]];
  })),
  bytes: Buffer.byteLength(out, "utf8"),
  fingerprint: buildFingerprint,
  builtAt: new Date().toISOString(),
  // r32 T1-2：把词库的新鲜度写进产物，安装端点开 build-meta 就能看出
  //「这份 dist 是不是比词库旧」——之前只能靠 mtime 反推，每轮都要白测一次。
  dictCount: Object.keys(dict).length,
  dictMtimeMax: (() => {
    let mx = 0;
    for (const f of fs.readdirSync(path.join(root, "dict"))) {
      if (!f.endsWith(".json")) continue;
      mx = Math.max(mx, fs.statSync(path.join(root, "dict", f)).mtimeMs);
    }
    return new Date(mx).toISOString();
  })()
};
fs.writeFileSync(path.join(root, "dist/build-meta.json"), JSON.stringify(stamp, null, 2) + "\n");

const kb = (out.length / 1024).toFixed(1);
console.log("已生成 dist/biol10n.user.js  (" + kb + " KB, " +
  Object.keys(dict).length + " 个词库, " + sites.sites.length + " 个站点)");
