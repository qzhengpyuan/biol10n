# BioL10n

离线词库驱动的生物医学网站界面汉化脚本（Tampermonkey / ScriptCat）。

针对没有中文语言选项的生物信息学与医学站点（PubMed、GEO、UCSC、Ensembl、KEGG、HPA、miRBase 等），
用内置词表把界面文本与重复出现的说明性文字替换为中文。不联网、不调用翻译 API、不打包模型、
不需要本地服务——一个 `.user.js` 文件，任何设备导入即用。

## 安装

1. 装 Tampermonkey（Chrome/Firefox）或 ScriptCat
2. 打开 [`dist/biol10n.user.js`](dist/biol10n.user.js)，脚本管理器会提示安装
3. 打开已支持的站点，界面文本自动变中文；`Alt+Shift+L` 一键切回英文对比

调试：控制台里 `__BIOL10N.stats()` 看命中数，`__BIOL10N.misses()` 看没翻到的英文。

## 范围

- **翻**：界面标签、按钮、表头、字段名、图例、反复出现的数据说明句
- **不翻**：基因与蛋白符号、变异命名（`c.68_69delAG`）、物种拉丁名、accession、序列、坐标、数字单位、通路名

目标不是把整页英文变成通顺中文，而是让页面结构可读、知道该点哪里。
覆盖不到的地方保留英文——**宁可留白，不可翻错**。

## 设计

核心决定是：**只在整个文本节点命中词表时才替换**。因此句子里夹带的 `BRCA1`、`p.Val600Glu`
不会被切开、也不会被误译；代价是句子必须整体进词表或用模板覆盖。

- exact：整节点精确匹配（含大小写兜底、句尾标点退化）
- rules：`^...$` 锚定的句式模板，`$1` 会在词表里二次查表
- 只改文本节点与白名单属性（`placeholder`/`title`/`aria-label`/`alt`），不重建 DOM
- 幂等（WeakSet）与可逆（WeakMap 存原文）
- SPA 站点挂 MutationObserver（200 ms 去抖）+ pushState/replaceState 路由钩子

细节见 [docs/engine-design.md](docs/engine-design.md)。

## 词库

| 词库 | 条数 | 规则 | 覆盖 |
|---|---|---|---|
| common | 617 | 37 | 跨站通用界面词 |
| ncbi | 492 | 27 | PubMed / GEO / BLAST / GDV |
| anatomy | 498 | 6 | 解剖、组织、细胞类型（HPA / GTEx / UCSC） |
| kegg | 254 | 11 | KEGG |
| hpa | 248 | 9 | Human Protein Atlas |
| onco | 222 | 9 | TCGA 队列、变异类型、生存统计 |
| mirbase | 124 | 9 | miRBase |

合计 **2455 条**。词库分家族复用，加一个站通常只增 50–200 条。

实测覆盖率（真实页面、只算界面骨架，排除数据行）：
PubMed 75.5%、miRBase 91.7%、HPA 62.0%、KEGG 19.5%（KEGG 页面主体是通路名，属数据不翻）。

## 开发

```bash
npm install          # 只装 jsdom（仅测试用）
npm test             # 引擎单测（15 条）
node tools/check.mjs # 词库格式、代码红线、术语一致性
node tools/terms.mjs # 术语一致性单独校验
npm run build        # 生成 dist/biol10n.user.js（单文件、内联全部词库）

# 覆盖率与冒烟测试（需要先抓一份页面 HTML）
node tools/coverage.mjs research/pubmed.html pubmed
node tools/smoke.mjs research/pubmed.html "https://pubmed.ncbi.nlm.nih.gov/?term=brca1" 40
```

贡献方式见 [CONTRIBUTING.md](CONTRIBUTING.md)，同类脚本调研见
[docs/reference-implementations.md](docs/reference-implementations.md)。

## 许可

MIT。词条全部自行撰写，不整份复制 GPL 仓库的词库。
