# BioL10n

离线词库驱动的生物医学网站界面汉化脚本（Tampermonkey / ScriptCat）。

针对没有中文语言选项的生物信息学与医学站点（PubMed、GEO、UCSC、Ensembl、KEGG、HPA、miRBase 等），
用内置词表把界面文本与重复出现的说明性文字替换为中文。不联网、不调用翻译 API、不打包模型、
不需要本地服务——一个 `.user.js` 文件，任何设备导入即用。

## 安装

1. 装 Tampermonkey（Chrome/Firefox）或 ScriptCat
2. 打开 [v0.1.1 发布包](https://github.com/qzhengpyuan/biol10n/releases/latest/download/biol10n.user.js)，脚本管理器会提示安装
3. 打开已支持的站点，界面文本自动变中文；`Alt+Shift+L` 一键切回英文对比

ScriptCat 在新版 Chrome（MV3）下还需要在 `chrome://extensions` → 脚本猫详情 → 打开「允许运行用户脚本」，
否则脚本装上了也不会执行。这个开关按 profile 保存，重启浏览器后保持开启。

调试：控制台里 `__BIOL10N.stats()` 看命中数与当前站点使用的词库，`__BIOL10N.misses()` 看没翻到的英文，
`__BIOL10N.toggle()` 或 `Alt+Shift+L` 切换中英。

## 范围

- **翻**：界面骨架（导航、表头、按钮、表单标签、占位符、aria-label/title）、固定枚举值（性别、物种、组装层级、变异类型、组织名）、固定说明句与帮助文本整块、通用规范化（日期与标点）
- **不翻**：基因与蛋白符号、变异命名（`c.68_69delAG`）、物种拉丁名、accession、序列、坐标、数字单位、通路名、数据库名（UniProt / Pfam / InterPro 等）、下拉选项的 `value`、长正文段落

目标不是把整页英文变成通顺中文，而是让页面结构可读、知道该点哪里。
覆盖不到的地方保留英文——**宁可留白，不可翻错**。

## 设计

核心决定是：**只在整个文本节点命中词表时才替换**。因此句子里夹带的 `BRCA1`、`p.Val600Glu`
不会被切开、也不会被误译；代价是句子必须整体进词表或用模板覆盖。

- **先认站、再取词库**：`config/sites.json` 按 hostname + path 匹配站点，命中后只解析该站用到的
  那几个词库（`build.mjs` 把每本词库序列化成一段 JSON 字符串，`boot.js` 的 `parseDict()` 按需
  `JSON.parse`）。全量解析约 3.1 ms，单站约 0.25 ms；认不出的站点直接不初始化。
- exact：整节点精确匹配（含大小写兜底、句尾标点退化）
- rules：`^...$` 锚定的句式模板，`$1` 会在词表里二次查表
- blocks：整块替换（帮助面板、页脚这类跨节点段落），可带 `match` 筛选
- 只改文本节点与白名单属性（`placeholder`/`title`/`aria-label`/`alt`，以及可选的可见 value），不重建 DOM
- 幂等（WeakSet）与可逆（WeakMap 存原文）；`translate="no"` 的区域不碰
- SPA 站点挂 MutationObserver（去抖）+ pushState/replaceState 路由钩子，切页后自动重扫
- 跨节点拼接：`<br>` 打断的句子、分散在多个 `<tspan>` 的 SVG 文字、被 `<span>` 切碎的标签，
  都先拼再查表；末尾统一跑一遍空白与标点清理（`cleanupPass`）

细节见 [docs/engine-design.md](docs/engine-design.md)。

## 词库

18 本词库按站点分文件，一个站点只加载自己那几本。

| 词库 | 条数 | 规则 | 覆盖 |
|---|---|---|---|
| common | 657 | 43 | 跨站通用界面词与规范化规则 |
| hpa | 1536 | 117 | Human Protein Atlas |
| ncbi | 1269 | 53 | PubMed / GEO / BLAST / GDV |
| anatomy | 574 | 6 | 解剖、组织、细胞类型（HPA / GTEx / UCSC / Ensembl） |
| kegg | 491 | 16 | KEGG |
| rcsb | 460 | 31 | RCSB PDB |
| gdc | 452 | 20 | GDC Data Portal |
| uniprot | 437 | 15 | UniProt |
| cbioportal | 388 | 45 | cBioPortal |
| ensembl | 329 | 4 | Ensembl（含新前端与帮助页） |
| onco | 235 | 9 | TCGA 队列、变异类型、生存统计 |
| ucsc | 212 | 5 | UCSC Genome Browser |
| gepia2 | 175 | 9 | GEPIA2 |
| mirbase | 158 | 22 | miRBase |
| gtex | 145 | 11 | GTEx Portal |
| spa | 136 | 0 | 各站共用的单页应用骨架词 |
| ualcan | 124 | 4 | UALCAN |
| timer | 123 | 8 | TIMER2.0 / TIMER3 |

合计 **7901 条 / 418 条规则**，17 个站点。词库按家族复用，加一个站通常只增 50–200 条。

支持站点：PubMed、NCBI GEO / GDV / BLAST、UCSC、KEGG、HPA、miRBase、Ensembl、UniProt、
RCSB PDB、GTEx、GDC、cBioPortal、GEPIA2、UALCAN、TIMER2.0/3.0。

## 开发

```bash
npm install          # 只装 jsdom（仅测试用）
npm test             # 引擎与产物单测（67 条）
node tools/check.mjs # 词库格式、代码红线、术语一致性
node tools/terms.mjs # 术语一致性单独校验
npm run build        # 生成 dist/biol10n.user.js（单文件、内联全部词库）
node tools/apply.mjs # 构建并装进本机 ScriptCat（浏览器已开 CDP 时）

# 真实页面残留报告 / 覆盖率 / 冒烟测试（前两个需要浏览器开着 CDP 9227）
node tools/miss-report.mjs ensembl "https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=ENSG00000141510"
node tools/coverage.mjs research/pubmed.html pubmed
node tools/smoke.mjs research/pubmed.html "https://pubmed.ncbi.nlm.nih.gov/?term=brca1" 40
```

贡献方式见 [CONTRIBUTING.md](CONTRIBUTING.md)，同类脚本调研见
[docs/reference-implementations.md](docs/reference-implementations.md)。

## 许可

MIT。词条全部自行撰写，不整份复制 GPL 仓库的词库。