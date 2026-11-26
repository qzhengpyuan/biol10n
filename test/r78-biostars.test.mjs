// Biostars 问答站（biostars.org）词库回归
// 站点是 Django 服务端渲染：翻的只有界面骨架（排序/时限/分页、登录与注册提示、工具栏按钮、
// 徽章与奖项名、侧栏栏目），帖子标题、正文、用户名、标签内容属用户数据，一律不翻。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/biostars.json"), "utf8"));
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const site = sites.find((s) => s.id === "biostars");
const CJK = /[\u4e00-\u9fff]/;

assert.ok(site, "config/sites.json 必须有 id=biostars 的站点条目");
assert.deepEqual(site.hosts, ["biostars.org", "www.biostars.org"]);

function stack() {
  const data = { exact: {}, rules: [], templates: [] };
  for (const id of site.dicts) {
    const b = JSON.parse(fs.readFileSync(path.join(root, "../dict", id + ".json"), "utf8"));
    Object.assign(data.exact, b.exact || {});
    data.rules = data.rules.concat(b.rules || []);
    data.templates = data.templates.concat(b.templates || []);
  }
  return data;
}

function boot(html) {
  const dom = new JSDOM("<body>" + html + "</body>", { url: "https://www.biostars.org/" });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: stack(),
    site: { id: "biostars", hosts: ["www.biostars.org"], scope: "body" }
  });
  engine.start();
  return { doc: dom.window.document, engine };
}

const squash = (s) => String(s).replace(/\s+/g, " ").trim();

test("词库卫生：exact 自映射、规则锚定、规则译文含中文", () => {
  for (const [k, v] of Object.entries(book.exact)) {
    assert.notEqual(k, v, "自映射: " + k);
    assert.ok(String(v).trim(), "译文为空: " + k);
  }
  for (const r of book.rules) {
    assert.match(r.re, /^\^/, "规则未以 ^ 锚定: " + r.re);
    assert.match(r.re, /\$$/, "规则未以 $ 收尾: " + r.re);
    // 有的规则只补全角冒号（"Comment: xxx" → "$1：$2"），译文本身不含汉字但已中文化
    assert.ok(CJK.test(r.to) || /[：，。；！？（）「」]/.test(r.to), "规则译文既无中文也无全角标点: " + r.re);
    if (r.re.includes("(.+)")) assert.ok(/\$1/.test(r.to), "规则丢了捕获组: " + r.re);
  }
});

test("排序与时限选择器：Sort / Limit 的界面标签翻成中文", () => {
  const { doc } = boot(
    '<select name="sort"><option>Sort : Rank</option><option>Sort : Views</option></select>' +
      '<select name="limit"><option>Limit : all time</option><option>Limit : this week</option></select>'
  );
  const opts = [...doc.querySelectorAll("option")].map((o) => squash(o.textContent));
  // 枚举值由更具体的规则翻成中文（Rank→综合排名、all time→全部时间）
  assert.deepEqual(opts, ["排序：综合排名", "排序：浏览量", "时间范围：全部时间", "时间范围：本周"]);
});

test("相对时间：3 days ago 与写作/更新行都要中文化，数字与单位边界正确", () => {
  const { doc } = boot(
    '<span class="ago">3 days ago</span><span class="by">written 2 hours ago by</span>' +
      '<span class="upd">updated 5 months ago by</span>'
  );
  const texts = [...doc.querySelectorAll("span")].map((s) => squash(s.textContent));
  assert.equal(texts[0], "3 天前");
  assert.equal(texts[1].trim(), "写于 2 小时前 ·");
  assert.equal(texts[2].trim(), "更新于 5 个月前 ·");
});

test("登录与注册提示整句翻，邮箱输入框 placeholder 保留字段语义", () => {
  const { doc } = boot(
    '<div class="login"><p>Click the link below to log in or sign up automatically:</p>' +
      '<input placeholder="Enter your email"><a href="/accounts/login/">Email Login</a>' +
      '<a href="/accounts/signup/">Email Signup</a><p>Forgot your password?</p></div>'
  );
  const p = [...doc.querySelectorAll("p")].map((x) => squash(x.textContent));
  assert.equal(p[0], "点击下方链接即可自动登录或注册：");
  assert.equal(p[1], "忘记密码？");
  const links = [...doc.querySelectorAll("a")].map((a) => squash(a.textContent));
  assert.deepEqual(links, ["邮箱登录", "邮箱注册"]);
});

test("帖子标题与正文属用户内容，不被替换", () => {
  const title = "How to align RNA-seq reads with STAR on a 32 GB machine";
  const body = "I am trying to align paired-end reads and keep running out of memory.";
  const { doc } = boot('<h1 class="post-title">' + title + '</h1><p class="post-body">' + body + "</p>");
  assert.equal(squash(doc.querySelector(".post-title").textContent), title);
  assert.equal(squash(doc.querySelector(".post-body").textContent), body);
});

test("工具栏与徽章名：ADD REPLY / Bookmark / Badges 等界面词翻中文", () => {
  const { doc } = boot(
    '<div class="tools"><a>ADD REPLY</a><a>ADD COMMENT</a><a>Bookmark</a></div>' +
      "<ul><li>Badges</li><li>Awards</li><li>Community</li><li>Forum</li></ul>"
  );
  const tools = [...doc.querySelectorAll(".tools a")].map((a) => squash(a.textContent));
  assert.deepEqual(tools, ["添加回复", "添加评论", "书签"]);
  const items = [...doc.querySelectorAll("li")].map((li) => squash(li.textContent));
  assert.deepEqual(items, ["徽章", "奖项", "社区", "论坛"]);
});
