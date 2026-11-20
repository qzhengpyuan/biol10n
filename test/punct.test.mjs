import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const src = readFileSync(new URL("../src/engine.js", import.meta.url), "utf8");
const { createEngine } = new Function(src + "\nreturn { createEngine };")();

function run(html, site = {}) {
  const dom = new JSDOM("<body>" + html + "</body>", { url: "https://example.org/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: { "More information": "更多信息" }, rules: [] },
    site: Object.assign({ attrs: [], block: "", proseGuard: true }, site)
  });
  engine.start();
  return dom.window.document.body.innerHTML;
}

test("中文链接后面的英文句号变成中文句号", () => {
  const out = run("<p><a>More information</a>.</p>");
  assert.match(out, /更多信息<\/a>。/);
  assert.equal(out.includes("</a>."), false);
});

test("英文语境里的句号不动", () => {
  const out = run("<p>See the list of tools.</p>");
  assert.match(out, /tools\./);
});

test("可以在站点上关掉标点本地化", () => {
  const out = run("<p><a>More information</a>.</p>", { punctFix: false });
  assert.match(out, /更多信息<\/a>\./);
});

test("跨元素的重复句号被吞掉、中文之间的换行缩进被裁掉", () => {
  const html = '<h5>表达中位数： <span>肿瘤</span> 和\n                        <span>正常</span>\n 样本（身体图谱）</h5>' +
    '<p><span>肿瘤缩写。</span>。</p>';
  const dom = new JSDOM("<body>" + html + "</body>", { url: "https://example.org/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: { exact: {}, rules: [] },
    site: { attrs: [], block: "", proseGuard: true }
  });
  engine.start();
  const h5 = dom.window.document.querySelector("h5").textContent;
  assert.doesNotMatch(h5, /\n/);
  assert.doesNotMatch(h5, / {2,}/);
  const p = dom.window.document.querySelector("p").textContent;
  assert.equal(p, "肿瘤缩写。");
});
test("时间里的冒号不变成全角", () => {
  const out = run("<p><b>时间</b>: <span>09</span>:<span>15</span></p>");
  // 时间后面的冒号正常全角化
  assert.match(out, /时间<\/b>：/);
  // 09:15 中间的冒号必须保持半角（否则时间被毁成 09：15）
  assert.match(out, /09<\/span>:<span>15/);
});
