// 构建：把引擎、站点配置与全部词库合成一个离线 .user.js
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = path.dirname(new URL(import.meta.url).pathname);
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

const kb = (out.length / 1024).toFixed(1);
console.log("已生成 dist/biol10n.user.js  (" + kb + " KB, " +
  Object.keys(dict).length + " 个词库, " + sites.sites.length + " 个站点)");
