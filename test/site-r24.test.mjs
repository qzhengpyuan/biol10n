// r24 P1-4/P1-5：NCBI 首页与 EMBL-EBI 通用页没有兜底站，整页零注入。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const ids = sites.map((s) => s.id);

test("NCBI 首页有兜底站，且排在 /search 之前", () => {
  const i = ids.indexOf("ncbi-root");
  const j = ids.indexOf("ncbi-search");
  assert.ok(i >= 0, "缺 ncbi-root");
  assert.ok(i < j, "ncbi-root 必须排在 ncbi-search 之前");
  const site = sites[i];
  assert.deepEqual(site.hosts, ["www.ncbi.nlm.nih.gov"]);
  const re = new RegExp(site.path);
  assert.ok(re.test("/"), "首页 / 未命中");
  assert.ok(re.test("/home/"), "/home/ 未命中");
  assert.ok(!re.test("/gene/7157"), "不该吞掉具体站");
  assert.ok(site.dicts.includes("ncbi-home") && site.dicts.includes("ncbi-footer"));
});

test("EMBL-EBI 兜底站存在且排在最后（不遮挡具体子站）", () => {
  const i = ids.indexOf("embl-ebi");
  assert.ok(i >= 0, "缺 embl-ebi");
  const sub = ["gxa", "interpro", "pride", "ena", "biostudies", "pdbe"].map((id) => ids.indexOf(id));
  for (const j of sub) assert.ok(j >= 0 && j < i, "兜底站必须排在具体 embl-ebi 子站之后");
  const site = sites[i];
  assert.deepEqual(site.hosts, ["www.ebi.ac.uk"]);
  assert.ok(!site.path, "兜底站不设 path");
  assert.ok(site.dicts.includes("string-atlas"));
});

test("正文守卫只在链接区豁免，不整站关掉", () => {
  for (const id of ["alphafold", "pdbe", "gxa"]) {
    const site = sites.find((s) => s.id === id);
    assert.ok(site.proseExempt && /nav/.test(site.proseExempt), id + " 缺 proseExempt");
    assert.notEqual(site.proseGuard, false, id + " 不该整站关掉正文守卫");
  }
});

test("发版脚本在 build 之后校验 dist 指纹", () => {
  const src = fs.readFileSync(path.join(root, "../tools/release.mjs"), "utf8");
  const bi = src.indexOf('["build.mjs"]');
  const gi = src.indexOf("dist-fresh.test.mjs");
  assert.ok(bi >= 0 && gi > bi, "dist-fresh 必须在 build 之后执行");
});
