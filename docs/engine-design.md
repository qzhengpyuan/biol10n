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
6. 祖先带 `translate="no"`（站点自己声明这段别翻，如 UniProt 的示例检索词按钮）。
   例外：站点可在 `config/sites.json` 里给 `translateNoAllow` 列放行选择器，
   命中元素必须在同一层 `translate="no"` 之内才会翻（UniProt 的疾病与变异表就是这样：
   整表 `translate="no"`，但里面的「N 篇文献」证据按钮与 header 的 Align 链接是界面骨架）。
7. `<option>` 只在文字命中下载格式白名单（FASTA / TSV / Excel / JSON / XML / List…）时跳过；
   其余选项照翻文字、**绝不改 `value`** —— 筛选器常常 `value === 显示文字`，
   按“value 与文字相同就不翻”一刀切会把 `Mutagenesis` 这类该翻的筛选项整类留下。

## 属性

默认白名单：`placeholder`、`title`、`aria-label`、`alt`、`data-original-title`、`summary`。
不碰 `class`/`id`/`data-*` 正文、不碰 href。

站级可以用 `attrs` 追加通道（追加不是覆盖），常见的有：
- `value`：只翻 `input[type=button]` 的可见文案；`type=submit` 的 value 是服务器分支依据，永远不动
- `data-qtip` / `data-content` / `data-tooltip` / `mouseovertext`：站点自己实现的 tooltip，不进默认表（避免波及其他站的第三方组件）

## 模板通道的边界（2026-11 实测）

段落被内联元素切成多块时用模板：pat 里 `{{n}}` 是子元素的原位，译文按占位符把原节点放回去。边界：

| 限制 | 值 | 后果 |
|---|---|---|
| pat 长度 | 20–2200 字符 | 短句（如页脚 `Postdocs and PhDs`，pat 15 字符）建不出模板；放宽会在数据页误伤 `X and Y` 双链接串 |
| 槽位 | 至少 1 个非空内联元素 | 纯文本 + `<wbr>` 的段落建不出模板——这类走**段落通道**（整句 exact，Reactome 图例即此例） |
| 容器 | `p, dd, dt, li, td, th, caption, figcaption, blockquote, span, div, h1-h6, small, strong, b, em, i, label, section, article` | 内联容器（`<small>`/`<b>`/`<em>`）也要覆盖，否则写在它们上面的模板永不命中（ENA 检索页实测） |
| 尾部块级子元素 | 内联前缀的模板允许尾部挂块级节点，替换后按原序补回（`tails`） | 整段「文字 + 列表」的结构可以只翻前缀，列表原样保留 |
| 变量 | 只收元素，以及"纯文字的 `<button>`"；不收裸文本 | 题录/引文这类跟着文章变的裸文本无法当槽位，只能翻固定前缀 |

三个通道的分工：exact（整节点）→ 模板（跨内联元素）→ 段落（整块纯文本，长度 100–1800）。写词条前先确认真实 DOM 用哪条，
照报告转述写模板必然对不上（`<b>`/`<wbr>` 会把句子切在不同位置）。

## 幂等与可逆

- 幂等：`WeakSet` 记录已处理的文本节点与属性；站点把同一个文本节点改回英文时（React 筛选后回填），
  `characterData` 变更会把它从集合里删掉重新判一次，不依赖手动重扫。
- 句式模板里带全角标点、而捕获组可能只是英文专名时，规则要写 `"requireHit": true`：
  至少一个捕获组真的命中词表才替换，否则 `Pan-Lung Cancer (TCGA, Nat Genet 2016)`
  会被套成全角括号的半中半英。
- 可逆：`WeakMap` 保存原文，`engine.disable()` 一次性还原（Alt+Shift+L 触发）。
  不写 `data-src` 之类属性，避免污染页面 DOM 和触发站点自身的观察器。

## 性能

- exact 是 `Map`，O(1) 查表，不扫全词库；rules 逐条正则、命中即停；重复出现的同一句英文按输入串缓存结果。
- MutationObserver 监听 `childList/subtree/characterData + attributes`，变更进队列，200 ms 去抖后批量处理；
  `flush` 有 120 ms 时间预算，超过就把剩余节点留到下一拍（页面持续渲染时翻译变渐进式，不再整段卡住）。
- 每批只遍历新增子树，不重扫全页；同一批里祖先已在队列中的节点直接跳过。
- **首扫分片**：`scanBudgetMs`（boot 传 120）让 `scan()` 的 `walk` 只处理前一段文本节点（文档顺序 ≈ 视口顺序），
  剩下的进 backlog，由空闲回调按同样预算补完；不传该选项时行为与以前完全一致（测试/CLI 都整页扫）。
  backlog 用 WeakSet 去重（重扫/rescan 会重复看到同一批节点），`disable()` 时清空。
  分片只改节奏不改结果：最终 `hitExact` 与不分片一致（`test/perf-engine.test.mjs` 钉住）。

扫描本身的耗时（jsdom 合成页，2000 行 × 6 列 ≈ 3.6 万元素 / 3.4 万文本节点）：

| 指标 | 优化前 | 现在 |
|---|---|---|
| 首扫 | 3301 ms | ~930 ms |
| 重扫 | 1200 ms | ~350 ms |
| 重复内容页（4.2 万元素）首扫 | 2310 ms | ~550 ms |
| 同上，开 `scanBudgetMs: 120`（同步阻塞） | — | ~368 ms，其余空闲补 |

保持这个量级的四个前提（改引擎时别退回去）：

1. **元素级缓存**：跳过判定（`skipNodeInner`）、块级归属（`inBlock`）、正文保护（控件/放行块/块容器）
   都是「同一元素一轮只算一次，结论沿祖先继承」；SVG 子树例外，仍逐层判定。
2. **裸标签查集合**：`pre/code/p/li/td` 这类裸标签用 Set，只有复杂选择器才交给 `matches`；
   无属性元素先用 `hasAttributes` 一次挡掉。
3. **属性通道复用元素表**：不再跑全量属性选择器查询，改为在已查好的元素表上逐个 `hasAttribute` 探测。
4. **元素表转真数组**：jsdom 的 NodeList 按下标取值每次都要新建接口包装，三条通道各遍历一遍就白付三次。

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
