<p align="center"><img src="assets/logo.svg" width="104" alt="BioL10n"></p>

# BioL10n

离线词库驱动的生物医学网站界面汉化脚本（Tampermonkey / ScriptCat）。

仓库地址：<https://github.com/qzhengpyuan/biol10n>
脚本猫脚本站：<https://scriptcat.org/zh-CN/script-show-page/9127>（当前为**未公开**状态，站内搜不到，只能通过这个链接进入）

## 为什么做这个

PubMed、GEO、UCSC、Ensembl、KEGG、HPA、cBioPortal、GDC 这些数据库、论文库、工具库，本身都没有中文界面。老师上课放 PPT、现场点开网站演示时，一个按钮、一个表头没跟上，后面几步就全听不懂了。很多生物学新生不是学不会，而是卡在「不知道这些网站怎么用」这一步——没有人带他们入门，热情在一次次看不懂的英文界面里被磨掉。

学这些工具的第一步，应该是先看懂页面：哪里是检索框、哪一列是物种、这个按钮点下去会发生什么。英语不应该成为学习的门槛，也不该成为放弃的理由。

这个脚本只做这一层：不改网站功能、不搬数据，只把按钮、标题、表头、固定说明句换成中文，让第一次打开这些网站的人先「看懂」，再谈怎么用。

## 它做什么

针对没有中文语言选项的生物信息学与医学站点，用内置词表把界面文本与重复出现的说明性文字替换为中文。不联网、不调用翻译 API、不打包模型、不需要本地服务——一个 `.user.js` 文件，任何设备导入即用。

- **翻**：界面骨架（导航、表头、按钮、表单标签、占位符、aria-label/title）、固定枚举值（性别、物种、组装层级、变异类型、组织名）、固定说明句与帮助文本整块、通用规范化（日期与标点）
- **静态文案**：首页简介、栏目导航、免责声明、页脚商标这类固定整段，人工核对后按整句收录；被行内链接、加粗、行内代码切碎的整段，用带 `{{1}}` 占位符的**模板词条**替换——链接节点原样保留，位置按中文语序重排，仍可点击
- **不翻**：基因与蛋白符号、变异命名（`c.68_69delAG`）、物种拉丁名、accession、序列、坐标、数字单位、通路名、数据库名（UniProt / Pfam / InterPro 等）、下拉选项的 `value`、长正文段落
- **手动豁免**：给任意元素加 `data-biol10n-skip`，该子树（文本与属性）一律不翻，用来就地保护数据集名、专有名词或动态渲染的列表

目标不是把整页英文变成通顺中文，而是让页面结构可读、知道该点哪里。覆盖不到的地方保留英文——**宁可留白，不可翻错**。

## 安装

脚本目前在脚本猫上处于**未公开**状态：不进搜索、不进列表，只能通过下面的链接安装，测试稳定后会转为公开。

1. 装 Tampermonkey（Chrome / Firefox）或 ScriptCat
2. 打开 [脚本猫页面](https://scriptcat.org/zh-CN/script-show-page/9127) 点安装
   - 或者直接导入源码：[biol10n.user.js](https://raw.githubusercontent.com/qzhengpyuan/biol10n/release/biol10n.user.js)
3. 打开已支持的站点，界面文本自动变中文；`Alt+Shift+L` 一键切回英文对比

ScriptCat 在新版 Chrome（MV3）下还需要在 `chrome://extensions` → 脚本猫详情 → 打开「允许运行用户脚本」，否则脚本装上了也不会执行。这个开关按 profile 保存，重启浏览器后保持开启。

调试：控制台里 `__BIOL10N.stats()` 看命中数与当前站点使用的词库，`__BIOL10N.misses()` 看没翻到的英文，`__BIOL10N.toggle()` 或 `Alt+Shift+L` 切换中英。

## 设置面板

页面右下角有一个半透明的「中」字圆钮，点开是设置面板：

- **站点与词库**：当前识别到的站点名、域名，以及本站加载了哪几本词库、各多少条
- **统计**：本页已替换的文本数、整条命中 / 规则命中 / 属性命中、漏翻数
- **未翻译文本记录**（默认关闭）：打开后只在本机 localStorage 记录本页没被词库命中的文字（去重、最多 400 条，含所在页面路径），可以逐条点击复制或一键复制全部。用来发现漏网的界面文字，补词库时不用再手工翻页面
- **暂停 / 恢复本页汉化**、**隐藏悬浮按钮**（隐藏后按 Alt+Shift+B 重新显示）

记录默认关闭，不打开就不写任何日志；所有数据只存在本机，不上传。

## 静态文案

除了按钮和表头，站点里那些「不会随数据变化」的固定文案也在覆盖范围内：首页简介、栏目名（Learn / Find / Explore）、免责声明、页脚版权与商标说明。这些整段文字按**整句/整段**进词表，只在人工核对过译文之后才收录——命中就替换，没收录就保持英文，不会出现半句中文。

帮助中心（FAQ、User Guide）这类成篇的文档按需分批覆盖：先目录与高频条目，再按设置面板记录到的实际漏翻补。UCSC 帮助页除左侧目录与章节标题外，正文的步骤说明、列表项与完整句子也整批收录（本版 766 条，覆盖页面主体），HPA About 的资源列表按「链接后的句子」逐条收录，链接本身不被替换、仍可点击；被行内链接切成半句的碎片（如 `Track Hubs for` 这类停在冠词/介词上的残句）一律不翻，留着英文，避免出现「浏览 the Genome Browser mailing list」这种半中半英。PubMed 的 `/help/` 已经整页覆盖（1704 条，检索语法、显示格式、引文、字段表与附录都在内），页面上约 2269 个文本节点被替换，剩下的基本是检索式示例、字段标签与商标专名。`/about/` 这类整页固定说明也逐段收录；被链接、加粗、`<br>` 切碎的整段文字，脚本会按整段的文本查表，命中后整块换成中文，不再留下半句英文。

整段整块替换会连里面的链接一起抹掉，所以还多了一条**模板通道**（0.7.0）：词条存成 `轨道行以单词{{1}}开头，后面跟一个或多个{{2}}对。` 这样的中文模板，`{{n}}` 对应段内第 n 个内联元素（链接、代码、加粗），运行时把原节点放回译文里。占位符必须是 1..N 一一对应，对不上就不替换——宁可留英文，也不丢链接。链接里再套 `<em>`/`<span>`（整节点当一个槽位搬回去）从 0.9.0 起也接受，只有藏了块级元素才放弃。UCSC 帮助页靠这条通道吃下了 49 段带链接的正文，HPA 组织页、RCSB 帮助、Ensembl FTP、PubMed 帮助又陆续收了 37 段，HPA 脑/单细胞/细胞/免疫/亚细胞资源页与 Ensembl API 文档续收 27 段（本版共 113 条模板）。只收以句末标点收尾的整句——停在介词/冠词上的半句翻译了反而变成「……并在互补的 <链接>」这种半中半英，这类一律不翻。


## 体积与加载

构建时每本词库单独 gzip + base64 打包，运行时按站解压（`DecompressionStream`），不用本站的词库一个字节都不解。

- 单文件产物 **615 KB**（优化前 812 KB，−24%）；gzip 后 445 KB；词库里 19 本共 12021 条词条 + 113 条模板，压缩前纯 JSON 有 1109 KB
- 解压开销在 `document-end` 之后：PubMed 帮助页 24–140 ms、HPA 133–241 ms（三本词库合计约 150 KB 的 base64）
- 整页首次扫描（同时修掉了两处 O(n²)：`querySelector("br")` 与逐节点 `textContent`）：PubMed 帮助页 98–117 ms、HPA 281 ms，脚本整体耗时 34–473 ms
- 需要支持 `DecompressionStream` 的浏览器：Chrome/Edge 80+、Firefox 113+、Safari 16.4+。不支持时脚本不启用，控制台给一条提示
- 调试：`__BIOL10N.timing()` 看词库解压与首次扫描耗时，`__BIOL10N.stats().time` 看各阶段拆分


## 设计

核心决定是：**只在整个文本节点命中词表时才替换**。因此句子里夹带的 `BRCA1`、`p.Val600Glu` 不会被切开、也不会被误译；代价是句子必须整体进词表或用模板覆盖。

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
- 整段替换：`p`/`li`/`td` 这类不嵌套块的容器，按整段 `textContent` 查表，命中就整块换成中文
  （词条是被链接切碎的段落时，逐节点永远打不中）

细节见 [docs/engine-design.md](docs/engine-design.md)。

## 覆盖站点

点开就能看实际效果（17 个入口页都是纯英文界面，`<html lang="en">`，没有语言切换；PubMed 另有帮助中心整页覆盖）：

| 站点 | 链接 | 类型 |
|---|---|---|
| PubMed | <https://pubmed.ncbi.nlm.nih.gov/> | 文献检索 |
| NCBI GEO | <https://www.ncbi.nlm.nih.gov/geo/> | 基因表达数据 |
| NCBI GDV | <https://www.ncbi.nlm.nih.gov/gdv/browser/genome/> | 基因组浏览器 |
| NCBI BLAST | <https://blast.ncbi.nlm.nih.gov/Blast.cgi> | 序列比对 |
| UCSC Genome Browser | <https://genome.ucsc.edu/> | 基因组浏览器 |
| KEGG | <https://www.genome.jp/kegg/> | 通路数据库 |
| Human Protein Atlas | <https://www.proteinatlas.org/> | 蛋白表达图谱 |
| miRBase | <https://www.mirbase.org/> | miRNA 数据库 |
| Ensembl | <https://www.ensembl.org/> | 基因组注释 |
| UniProt | <https://www.uniprot.org/> | 蛋白序列与功能 |
| RCSB PDB | <https://www.rcsb.org/> | 蛋白结构 |
| GTEx Portal | <https://gtexportal.org/home/> | 组织表达 |
| GDC Data Portal | <https://portal.gdc.cancer.gov/> | TCGA 数据门户 |
| cBioPortal | <https://www.cbioportal.org/> | 肿瘤基因组 |
| GEPIA2 | <http://gepia2.cancer-pku.cn/> | 表达与生存分析 |
| UALCAN | <https://ualcan.path.uab.edu/> | 肿瘤表达分析 |
| TIMER2.0 / 3.0 | <https://timer.cistrome.org/> · <https://compbio.cn/timer3/> | 免疫浸润分析 |
| PubMed 帮助中心 | <https://pubmed.ncbi.nlm.nih.gov/help/> | 使用文档（FAQ / 检索语法 / 附录） |

中文资料目前只存在于社区写的教程里，站点本身没有中文界面。

## 词库

19 本词库按站点分文件，一个站点只加载自己那几本。

| 词库 | 条数 | 规则 | 覆盖 |
|---|---|---|---|
| common | 660 | 45 | 跨站通用界面词与规范化规则 |
| hpa | 1703 | 117 | Human Protein Atlas（含 About 与脑/单细胞/细胞/免疫/亚细胞资源页正文） |
| ncbi | 1350 | 68 | PubMed / GEO / BLAST / GDV（含首页、页脚与 About 静态文案） |
| ncbi-help | 1704 | 1 | PubMed 帮助中心（FAQ、检索语法、字段表、附录） |
| anatomy | 574 | 6 | 解剖、组织、细胞类型（HPA / GTEx / UCSC / Ensembl） |
| kegg | 546 | 16 | KEGG（含通路图查看页控件） |
| gdc | 485 | 20 | GDC Data Portal |
| rcsb | 632 | 31 | RCSB PDB |
| uniprot | 773 | 16 | UniProt（含条目页 GO 术语、化学修饰名、亚细胞定位） |
| cbioportal | 1126 | 47 | cBioPortal（含首页队列列表标签、新闻条目与图表控件） |
| ensembl | 389 | 4 | Ensembl（含新前端、帮助页与 API 文档） |
| onco | 238 | 9 | TCGA 队列、变异类型、生存统计 |
| ucsc | 937 | 5 | UCSC Genome Browser（含帮助页正文、浏览器工具栏与上岗提示、检索框提示、轨道可见性与快捷键面板） |
| gepia2 | 175 | 9 | GEPIA2 |
| mirbase | 159 | 22 | miRBase |
| gtex | 165 | 11 | GTEx Portal |
| spa | 136 | 0 | 各站共用的单页应用骨架词 |
| ualcan | 128 | 4 | UALCAN |
| timer | 123 | 8 | TIMER2.0 / TIMER3 |

合计 **12021 条 / 439 条规则 / 113 条模板**。词库按家族复用，加一个站通常只增 50–200 条。

## 开发

```bash
npm install          # 只装 jsdom（仅测试用）
npm test             # 引擎、面板与产物单测（103 条）
node tools/check.mjs # 词库格式、代码红线、术语一致性
node tools/terms.mjs # 术语一致性单独校验
npm run build        # 生成 dist/biol10n.user.js（单文件、内联全部词库）
node tools/apply.mjs # 构建并装进本机 ScriptCat（浏览器已开 CDP 时）

# 发版：构建产物推到 release 分支，webhook 通知脚本猫同步
node tools/release.mjs
git push origin release
```

真实页面残留报告 / 覆盖率 / 冒烟测试（前两个需要浏览器开着 CDP 9227）：

```bash
node tools/miss-report.mjs ensembl "https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=ENSG00000141510"
node tools/aclass.mjs ensembl        # 词库里有、页面却没翻的 A 类缺口
node tools/scope-check.mjs ensembl "https://www.ensembl.org/"  # scope 选择器命中数，0 命中会告警
node tools/coverage.mjs research/pubmed.html pubmed
node tools/smoke.mjs research/pubmed.html "https://pubmed.ncbi.nlm.nih.gov/?term=brca1" 40
```

贡献方式见 [CONTRIBUTING.md](CONTRIBUTING.md)，同类脚本调研见
[docs/reference-implementations.md](docs/reference-implementations.md)。

## 许可

MIT。词条全部自行撰写，不整份复制 GPL 仓库的词库。