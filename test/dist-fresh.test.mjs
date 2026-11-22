// 构建指纹：dist/build-meta.json 必须与磁盘词库、package.json 版本一致。
// 检查方 r22 P0-2：多轮「盘上改了词库、dist 还是旧构建」，真机自然不生效；这条单测把漂移变成红灯。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const metaPath = path.join(root, "dist/build-meta.json");

test("dist 构建指纹与磁盘词库一致", () => {
  assert.ok(fs.existsSync(metaPath), "缺少 dist/build-meta.json，先 npm run build");
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const sites = JSON.parse(fs.readFileSync(path.join(root, "config/sites.json"), "utf8"));
  const files = fs.readdirSync(path.join(root, "dict")).filter((f) => f.endsWith(".json"));
  let exact = 0, rules = 0, tpl = 0;
  for (const f of files) {
    const d = JSON.parse(fs.readFileSync(path.join(root, "dict", f), "utf8"));
    exact += Object.keys(d.exact || {}).length;
    rules += (d.rules || []).length;
    tpl += (d.templates || []).length;
  }
  assert.equal(meta.version, pkg.version, "dist 版本落后于 package.json，重新构建");
  assert.equal(meta.books, files.length, "册数不一致");
  assert.equal(meta.sites, sites.sites.length, "站点数不一致");
  assert.equal(meta.exact, exact, "exact 条数不一致（词库改完没重新构建）");
  assert.equal(meta.rules, rules, "rules 条数不一致");
  assert.equal(meta.templates, tpl, "templates 条数不一致");
  const bytes = fs.statSync(path.join(root, "dist/biol10n.user.js")).size;
  assert.equal(meta.bytes, bytes, "dist 字节数与指纹不符");
});
