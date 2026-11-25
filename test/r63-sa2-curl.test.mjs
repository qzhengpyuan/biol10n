// r63：Expression Atlas 下载页的 curl 整段模板
// 旧模板按 3 个槽位写死，实际 <p> 有 7 个槽位（curl 的 <code>、三个 <br>、
// 命令的 <code>、两个 <code>&lt;accessionN&gt;</code>），永远配不上，
// 段落被碎片词条（"For example:"）翻成「英文前缀 + 例如：+ 英文尾巴」。
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
const site = sites.find((s) => s.id === "gxa");
const data = { exact: {}, rules: [], templates: [] };
for (const id of site.dicts) {
  const b = JSON.parse(fs.readFileSync(path.join(root, "../dict", id + ".json"), "utf8"));
  Object.assign(data.exact, b.exact || {});
  data.rules = data.rules.concat(b.rules || []);
  data.templates = data.templates.concat(b.templates || []);
}

const HTML = `<p id="p">
            You can also download multiple experiment files as a single ZIP archive using the command line with <code>curl</code>.<br>
            For example:<br>
            <code>
                curl -O "https://<span id="atlas-host">www.ebi.ac.uk</span>/gxa/experiments/download/zip?accession=&lt;accession1&gt;&amp;accession=&lt;accession2&gt;"
            </code>
            <br>
            Replace <code>&lt;accession1&gt;</code> and <code>&lt;accession2&gt;</code> with the experiment accessions you wish to download.
        </p>`;

function run() {
  const dom = new JSDOM("<body>" + HTML + "</body>", { url: "https://www.ebi.ac.uk/gxa/download" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data,
    site: { id: "gxa", hosts: ["www.ebi.ac.uk"], path: "^/gxa", scope: "body" }
  });
  engine.start();
  const p = dom.window.document.getElementById("p");
  return { p, text: p.textContent.replace(/\s+/g, " ").trim(), doc: dom.window.document, engine };
}

test("curl 段整段变中文，不再是「英文前缀 + 例如：+ 英文尾巴」", () => {
  const { text } = run();
  assert.match(text, /您也可以使用命令行/);
  assert.match(text, /单个 ZIP 归档/);
  assert.match(text, /例如：/);
  assert.match(text, /替换为您要下载的实验登录号/);
  assert.ok(!/You can also download/.test(text), "英文前缀必须消失");
  assert.ok(!/with experiment accessions/.test(text), "英文尾巴必须消失");
});

test("7 个内联槽位一个不丢：curl、命令、两个 accession 与三个换行", () => {
  const { p } = run();
  assert.equal(p.querySelectorAll("br").length, 3, "三个 <br> 必须原位保留");
  const codes = [...p.querySelectorAll("code")].map((c) => c.textContent.trim());
  assert.equal(codes.length, 4, "四个 <code> 必须保留");
  assert.equal(codes[0], "curl");
  assert.match(codes[1], /curl -O/);
  assert.match(codes[1], /www\.ebi\.ac\.uk/);
  assert.match(codes[1], /<accession1>/);
  assert.equal(codes[2], "<accession1>");
  assert.equal(codes[3], "<accession2>");
  assert.ok(!/<span id="atlas-host">/.test(p.textContent), "span 只剩文本，不再包标签");
});

test("词库里那条模板是 7 槽位形态，旧的 3 槽位版本已不存在", () => {
  const tpls = JSON.parse(fs.readFileSync(path.join(root, "../dict/string-atlas2.json"), "utf8")).templates;
  const pats = tpls.map((t) => t.pat);
  assert.ok(pats.some((p) => p.includes("{{7}}") && /command line with \{\{1\}\}/.test(p)));
  assert.ok(!pats.some((p) => p.includes("command line with curl. For example: {{1}}")));
});
