// 漏翻回放工具与面板/采集器共用同一套名单语义，这里钉住三种条目的匹配规则，
// 避免哪天 ui.js 改了而 tools/miss-replay.mjs 没跟上（两边口径不一致会让回放的收益数字失真）。
import test from "node:test";
import assert from "node:assert/strict";
import { compileNoise, isNoise, pickSite } from "../tools/miss-replay.mjs";

const hit = (list, s) => isNoise(s, compileNoise(list));

test("普通条目：大小写不敏感的子串匹配", () => {
  assert.equal(hit(["pubmed"], "PubMed SID"), true);
  assert.equal(hit(["PUBMED"], "Go to PubMed"), true);
  assert.equal(hit(["pubmed"], "Public data"), false);
});

test("re: 正则大小写不敏感（输入先转小写）", () => {
  assert.equal(hit(["re:^search$"], "Search"), true);
  assert.equal(hit(["re:^search$"], "SEARCH"), true);
  assert.equal(hit(["re:^search$"], "Search all"), false);
});

test("rec: 正则大小写敏感：基因符号不会被 Search 顺手吃掉", () => {
  assert.equal(hit(["rec:^[A-Z][A-Z0-9]*$"], "TP53"), true);
  assert.equal(hit(["rec:^[A-Z][A-Z0-9]*$"], "Search"), false);
  assert.equal(hit(["re:^[A-Z][A-Z0-9]*$"], "Search"), true, "不敏感正则本就会吃掉 Search，写名单的人要自己知道");
});

test("坏正则跳过、空条目忽略，不抛异常", () => {
  assert.equal(hit(["re:[", "", "  "], "anything"), false);
});

test("pickSite 按顺序匹配，path 窄的站点先命中", () => {
  const sites = [
    { id: "wide", hosts: ["www.ebi.ac.uk"] },
    { id: "chembl", hosts: ["www.ebi.ac.uk"], path: "^/chembl" },
  ];
  assert.equal(pickSite("https://www.ebi.ac.uk/chembl/", sites).id, "wide", "顺序决定谁赢，config 里要把窄的插前面");
  assert.equal(pickSite("https://www.ebi.ac.uk/chembl/", [sites[1], sites[0]]).id, "chembl");
  assert.equal(pickSite("https://www.ebi.ac.uk/training/", [sites[1], sites[0]]).id, "wide");
});
