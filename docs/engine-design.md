# 引擎设计

## 一句话

只做两件事：把**整个文本节点**的英文换成中文，把**白名单属性**的英文换成中文。不重建 DOM、不改样式、不碰用户输入、不发网络请求。

## 匹配模型：整节点精确匹配 + 锚定模板

这是本项目最关键的一个决定。

```text
文本节点 "Search"                    → 查 exact 表 → "搜索"
文本节点 "Showing 1 of 20 results"   → 过 rules   → "显示第 1 条，共 20 条结果"
文本节点 "Search results for BRCA1"  → 都没有      → 原样保留（并记入缺词表）
```

因为**只在整节点命中时才替换**，句子里夹带的基因名、变异命名、accession 天然不会被动：
词表里没有 "Search results for BRCA1"，这个节点就一个字都不改。这比"先分词再逐词替换"安全得多，
也是「误翻率为 0」这个目标能成立的原因——宁可留英文，不可翻错。

代价是覆盖率：句子必须整体进词表或用模板覆盖，否则整句留英文。这是有意接受的取舍。

## 词条形式

| 类型 | 例 | 用途 |
|---|---|---|
| exact | `"Advanced search": "高级检索"` | 界面词、字段名、表头、按钮 |
| rules | `{"re": "^Showing (\\d+) of ([\\d,]+) results$", "to": "显示第 $1 条，共 $2 条结果"}` | 带变量的重复句，必须 `^...$` 锚定 |

词条键是**规范化后**的文本：`\\s+` 折叠为单空格、去掉首尾空白、全角空格转半角。
命中前还会再试两档退化：去掉行首项目符号、去掉句尾标点（`Search:` 能命中 `Search`）。

## 跳过规则

按顺序判断，任一命中就不再处理该节点：

1. 节点已被处理过（WeakSet，幂等，SPA 反复渲染不会翻两遍）
2. 文本已含中日韩字符（已翻过，或页面本来就是中文）
3. 文本以规范化后长度 < 2，或完全不含字母（纯数字、坐标、符号）
4. 祖先在 `pre, code, kbd, samp, textarea, [contenteditable]` 或站点自定义 BLOCK 选择器内
5. 祖先带 `data-l10n-scope="off"`（站点配置里用来排除个别区域）

## 属性

只碰白名单：`placeholder`、`title`、`aria-label`、`alt`，以及 `input[type=submit|button|reset]` 的 `value`。
不碰 `value` 正文、不碰 `class`/`id`/`data-*`、不碰 href。

## 幂等与可逆

- 幂等：`WeakSet` 记录已处理的文本节点与属性。
- 可逆：`WeakMap` 保存原文，`engine.disable()` 一次性还原（Alt+Shift+L 触发）。
  不写 `data-src` 之类属性，避免污染页面 DOM 和触发站点自身的观察器。

## 性能

- exact 是 `Map`，O(1) 查表，不扫全词库；rules 只有几十条，逐条正则、命中即停。
- MutationObserver 监听 `childList/subtree/characterData + attributes`，变更进队列，200 ms 去抖后批量处理。
- 每批只遍历新增子树，不重扫全页。

## 站点配置

`config/sites.json` 每站一段，新增站点不改引擎：

```json
{ "id": "pubmed", "hosts": ["pubmed.ncbi.nlm.nih.gov"], "dicts": ["common", "ncbi"],
  "scope": "main, #search-results", "spa": false }
```

- `scope`：只在正文容器内扫，避免动到导航/工具条里的专有内容
- `spa` + `waitFor`：客户端渲染站点（Ensembl、cBioPortal、UniProt、GDV）等目标元素出现再扫
- `dicts`：按站点家族复用词库（NCBI 家族四个站共用 `ncbi`）

## 测试

`node --test test/`，jsdom 跑真实 DOM。覆盖：精确命中与空白保留、模板变量、中文不重复处理、code/pre 跳过、
专有名词保留、属性替换、幂等、动态节点、disable 还原、缺词记录。

## 已知边界

- 跨域 iframe 内的文本（UCSC 的浏览器视图）需要脚本在 iframe 里再执行一次，靠 `@match` 覆盖子域名或 `allFrames`
- 画布/Canvas 渲染的文字（部分基因组浏览器）无法处理
- 站点改版会让 `scope` 选择器失效，需要回归测试
