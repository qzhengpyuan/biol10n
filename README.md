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

## 已知限制

- **正文不翻**：论文摘要、帮助文档的长段落、KEGG 发布说明正文按整句保留英文——逐段翻译既不可维护，也容易把基因名与数值卷进去
- **整句里的短标签会被正文保护挡下**：例如 KEGG 菜单里的 `Help` 夹在 232 字符的英文菜单项里，单独翻会半中半英，宁可留英文
- **极短模板建不出来**：模板要求至少一个内联元素且模式长度 ≥20 字符，所以 ENA 页脚的 `Postdocs and PhDs` 这类两链接夹一个 `and` 的短语保持英文
- **格式码不翻**：PubMed 自定义日期范围的 `MM`/`DD` 占位符是输入格式说明，翻了会和 `MM/DD/YYYY` 冲突
- **通用缩写保持原文**：`API`、`CNA`、`PMID`、`DOI` 这类既出现在界面里又是数据字段名的缩写不翻，避免读屏文本与可见列头不一致

## 安装

脚本目前在脚本猫上处于**未公开**状态：不进搜索、不进列表，只能通过下面的链接安装，测试稳定后会转为公开。

1. 装 Tampermonkey（Chrome / Firefox）或 ScriptCat
2. 打开 [脚本猫页面](https://scriptcat.org/zh-CN/script-show-page/9127) 点安装
   - 或者直接导入源码：[biol10n.user.js](https://raw.githubusercontent.com/qzhengpyuan/biol10n/release/biol10n.user.js)
3. 打开已支持的站点，界面文本自动变中文；右下角「中」字悬浮球上双击、或按 `Alt+Shift+L`，可以随时切回原文（不刷新页面）

ScriptCat 在新版 Chrome（MV3）下还需要在 `chrome://extensions` → 脚本猫详情 → 打开「允许运行用户脚本」，否则脚本装上了也不会执行。这个开关按 profile 保存，重启浏览器后保持开启。

调试：控制台里 `__BIOL10N.stats()` 看命中数与当前站点使用的词库，`__BIOL10N.misses()` 看没翻到的英文，`__BIOL10N.toggle()` 或 `Alt+Shift+L` 切换中英。

## 悬浮球与快捷菜单

页面右下角有一个半透明的「中」字圆钮（可以按住拖动，位置记在本机）：

- **单击**：弹出快捷菜单
  - **切回原文 / 显示中文**：当场切换，不刷新页面。「中」会变成灰色的「英」，再点一次切回来
  - **对照模式（悬停看原文）**：打开后鼠标停在任何一段中文上，浮出它对应的英文原文；适合跟着英文教程操作时逐句比对
  - **本站暂停（记住）**：把这个站加进「默认显示原文」名单，以后打开仍是英文；再取消即可恢复
  - **段落看原文（按住 Alt 点击）**：在本页按住 Alt 点任意段落，就地弹出该段的英文原文卡片，可一键复制；比整页切换精准，也不打断阅读
  - **复制中文 / 复制原文 / 收集漏翻**：有选区就复制选区，没选区复制整页（原文走引擎里的英文快照，不用关脚本刷新）；「收集漏翻」扫出本页仍是英文的短句，存到本机并复制成「原文\t站点\t位置」清单，攒够一批就能并进词库
  - **更多设置与漏翻记录…**：打开下面的完整设置面板
- **双击**：不弹菜单，直接中英切换
- **Alt+Shift+L**：键盘切换；**Alt+Shift+B**：隐藏/显示悬浮球

### 跟教程时的四件辅助

跟着英文教程点按钮时，最麻烦的是「教程里写的是 Submit，页面上已经是中文了」。快捷菜单里另有四项专用功能（都不设快捷键）：

- **英文名定位**：在菜单的输入框里敲教程里的英文（如 `Submit`、`Data Submission`），页面里所有对得上的位置会高亮并滚到第一个，显示「第 n / N 个匹配」，点「下一个」轮换。匹配用的是本页英文原文快照，所以中文界面上一样找得到
- **双语对照**：在每个正文段落、列表项、表头下面附一行灰色英文原文，读中文卡住时不用切整页；导航、页眉页脚、目录不参与，超过 420 字符的段落截断显示
- **选中即查**：用鼠标选中页面上任意中文词或英文词，旁边浮出中英对照小卡（点一下就复制「英文 / 中文」两行）；只认 1–60 字符、不含换行的选中片段
- **记住阅读位置**：长文档看到一半关掉，下次打开同一个页面自动回到上次的位置；每页单独记，最多 80 页，滑动开关在快捷菜单里

## 设置面板

快捷菜单里的「更多设置」打开完整面板：

- **站点与词库**：当前识别到的站点名、域名，以及本站加载了哪几本词库、各多少条
- **统计**：本页已替换的文本数、整条命中 / 规则命中 / 属性命中、漏翻数
- **未翻译文本记录**（默认关闭）：打开后只在本机 localStorage 记录本页没被词库命中的文字（去重、最多 400 条，含所在页面路径），可以逐条点击复制或一键复制全部。用来发现漏网的界面文字，补词库时不用再手工翻页面
- **暂停 / 恢复本页汉化**、**隐藏悬浮按钮**（隐藏后按 Alt+Shift+B 重新显示）

记录默认关闭，不打开就不写任何日志；所有数据只存在本机，不上传。

## 静态文案

除了按钮和表头，站点里那些「不会随数据变化」的固定文案也在覆盖范围内：首页简介、栏目名（Learn / Find / Explore）、免责声明、页脚版权与商标说明。这些整段文字按**整句/整段**进词表，只在人工核对过译文之后才收录——命中就替换，没收录就保持英文，不会出现半句中文。

帮助中心（FAQ、User Guide）这类成篇的文档按需分批覆盖：先目录与高频条目，再按设置面板记录到的实际漏翻补。UCSC 帮助页除左侧目录与章节标题外，正文的步骤说明、列表项与完整句子也整批收录（本版 766 条，覆盖页面主体），HPA About 的资源列表按「链接后的句子」逐条收录，链接本身不被替换、仍可点击；被行内链接切成半句的碎片（如 `Track Hubs for` 这类停在冠词/介词上的残句）一律不翻，留着英文，避免出现「浏览 the Genome Browser mailing list」这种半中半英。PubMed 的 `/help/` 已经整页覆盖（1712 条，检索语法、显示格式、引文、字段表与附录都在内），页面上约 2269 个文本节点被替换，剩下的基本是检索式示例、字段标签与商标专名。`/about/` 这类整页固定说明也逐段收录；被链接、加粗、`<br>` 切碎的整段文字，脚本会按整段的文本查表，命中后整块换成中文，不再留下半句英文。

整段整块替换会连里面的链接一起抹掉，所以还多了一条**模板通道**（0.7.0）：词条存成 `轨道行以单词{{1}}开头，后面跟一个或多个{{2}}对。` 这样的中文模板，`{{n}}` 对应段内第 n 个内联元素（链接、代码、加粗），运行时把原节点放回译文里。占位符必须是 1..N 一一对应，对不上就不替换——宁可留英文，也不丢链接。链接里再套 `<em>`/`<span>`（整节点当一个槽位搬回去）从 0.9.0 起也接受，只有藏了块级元素才放弃。UCSC 帮助页靠这条通道吃下了 49 段带链接的正文，HPA 组织页、RCSB 帮助、Ensembl FTP、PubMed 帮助又陆续收了 37 段，HPA 脑/单细胞/细胞/免疫/亚细胞资源页与 Ensembl API 文档续收 27 段（本版共 1009 条模板）。只收以句末标点收尾的整句——停在介词/冠词上的半句翻译了反而变成「……并在互补的 <链接>」这种半中半英，这类一律不翻。


## 体积与加载

构建时每本词库单独 gzip + base64 打包，运行时按站解压（`DecompressionStream`），不用本站的词库一个字节都不解。

- 单文件产物 **2108 KB**（2,158,435 字节）；词库里 114 个文件共 35252 条词条（含 1800 条规则）+ 2183 条模板，覆盖 91 个站点
- 解压开销在 `document-end` 之后：PubMed 帮助页 24–140 ms、HPA 133–241 ms（三本词库合计约 150 KB 的 base64）
- 整页首次扫描（同时修掉了两处 O(n²)：`querySelector("br")` 与逐节点 `textContent`）：PubMed 帮助页 98–117 ms、HPA 281 ms，脚本整体耗时 34–473 ms
- 大表格页（3.6 万元素 / 3.4 万文本节点的数据集表格）：首扫 3.3 s → **0.93 s**、重扫 1.2 s → **0.35 s**（-72% / -71%）；同一批词反复出现 2 万次的页面：首扫 2.3 s → **0.55 s**、重扫 0.54 s → **0.17 s**。做法：
  - 跳过的判定（`skipNode` / `inBlock` / 正文保护）原本每个文本节点都往上爬一遍祖先链，现在同一元素一轮只算一次，并把结论按「祖先已判定」继承下去；
  - 裸标签（pre/code/p/li/td…）改查集合，只有复杂选择器才交给 `matches`；正文保护的控件判定与块容器定位同样元素级缓存；
  - 属性通道不再跑一次全量属性选择器查询，改为在已查好的元素表上逐个 `hasAttribute` 探测（36k 元素 58ms → 14ms），并复用同一个元素表；
  - 元素表一次查询后转成真数组（jsdom 的 NodeList 按下标取值每次都要新建接口包装，三条通道各遍历一遍就白付三次）；
  - 重复出现的同一句英文按输入串缓存结果，短单元格在 `normalize` 之前先按原串长度挡掉。
  `test/perf-engine.test.mjs` 用两个合成页（3.6 万节点 / 4.2 万节点）守住这个量级，避免以后退回「扫一次卡几秒」
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
- mixed 通道：节点里已经含中文（半翻的图例、被站点脚本拼过的串）时，只跑显式标了 `mixed:true`
  的规则，其它规则一律不碰，避免把中文再翻一次
- repair 通道：标了 `repair:true` 的规则在每个站点每轮扫描结束后**无条件再跑一遍**（不看
  `processed` 标记），用来修被站点图表库二次渲染改坏的串（cBio 饼图图例的括号错配就是这么修的）；
  没有 repair 规则的站点会短路跳过这一步

细节见 [docs/engine-design.md](docs/engine-design.md)。

## 覆盖站点

点开就能看实际效果（这些入口页都是纯英文界面，`<html lang="en">`，没有语言切换；PubMed 另有帮助中心整页覆盖）：

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
| NCBI ClinVar | <https://www.ncbi.nlm.nih.gov/clinvar/> | 临床变异 |
| NCBI 资源站 | <https://www.ncbi.nlm.nih.gov/refseq/> · <https://www.ncbi.nlm.nih.gov/biosample/> · <https://submit.ncbi.nlm.nih.gov/> | RefSeq / BioSample / CCDS / 提交门户 |
| gnomAD | <https://gnomad.broadinstitute.org/> | 人群频率 |
| ClinGen / ClinPGx | <https://clinicalgenome.org/> · <https://www.clinpgx.org/> | 临床基因组学 |
| STRING / Expression Atlas | <https://string-db.org/> · <https://www.ebi.ac.uk/gxa/home> | 互作网络 / 表达图谱 |
| InterPro | <https://www.ebi.ac.uk/interpro/> | 蛋白家族与结构域 |
| Ensembl BioMart | <https://www.ensembl.org/biomart/martview> | 批量数据导出 |
| Europe PMC | <https://europepmc.org/> | 文献检索 |
| Reactome | <https://reactome.org/> | 通路数据库 |
| PRIDE Archive | <https://www.ebi.ac.uk/pride/> | 蛋白质组数据 |
| ENA | <https://www.ebi.ac.uk/ena/browser/home> | 核苷酸序列档案 |
| BioStudies | <https://www.ebi.ac.uk/biostudies/> | 多组学研究仓储 |
| Expasy | <https://www.expasy.org/> | 蛋白与序列分析工具门户 |
| neXtProt（归档） | <https://www.expasy.org/archives/nextprot> | 人类蛋白知识库（已退役） |
| Galaxy | <https://usegalaxy.org/> · <https://galaxyproject.org/> | 数据分析平台 |
| nf-core | <https://nf-co.re/> | Nextflow 流程集合 |
| Bioconductor | <https://bioconductor.org/> | R 生信软件库 |
| BioGRID | <https://thebiogrid.org/> · <https://wiki.thebiogrid.org/> | 蛋白互作数据库 |
| Ensembl Genomes | <https://ensemblgenomes.org/> | 非脊椎动物基因组门户 |
| Expression Atlas | <https://www.ebi.ac.uk/gxa/home> | 基因表达图谱 |
| EMBL-EBI 培训 | <https://www.ebi.ac.uk/training/> | 课程与线上讲座 |

中文资料目前只存在于社区写的教程里，站点本身没有中文界面。各站已翻到的范围与**刻意保留英文**的部分（数据、编号、品牌）见 [docs/coverage.md](docs/coverage.md)。

## 词库

85 个站点、108 册词库按站点分文件，一个站点只加载自己那几本。

| 词库 | 条数 | 规则 | 模板 | 覆盖 |
|---|---|---|---|---|
| addgene | 501 | 2 | 48 |  |
| alphafold | 436 | 30 | 102 | AlphaFold DB（首页、条目页、检索、下载） |
| amigo | 156 | 7 | 2 | AmiGO 2（首页、检索、术语页、浏览） |
| anatomy | 574 | 6 |  | 解剖、组织、细胞类型（多站复用） |
| bioc | 278 | 15 | 30 | Bioconductor 官网（首页、安装、关于、帮助、BiocViews） |
| biogrid | 121 | 8 | 7 | BioGRID 主站与帮助 wiki（检索框、统计、发布） |
| biomart | 338 | 23 |  | Ensembl BioMart（数据集、Filters/Attributes、Results、导出） |
| biostars | 134 | 40 | 7 | Biostars 生信问答站（排序/时限、登录、工具栏、徽章） |
| biostudies | 262 | 26 | 23 | BioStudies（研究详情、集合、帮助、提交） |
| books | 198 | 25 | 7 | NCBI Bookshelf（书架页、检索） |
| cbio-docs | 232 | 4 | 30 | cBioPortal 文档站（Retype 站点） |
| cbioportal | 1189 | 55 |  | cBioPortal |
| cbioportal2 | 86 | 2 | 6 | cBioPortal 补漏（研究页、图表、下载对话框） |
| cellxgene | 144 | 14 | 1 |  |
| clingen | 437 | 10 | 27 | ClinGen 与 ClinPGx |
| clingen2 | 105 | 4 | 3 | ClinGen 与 ClinPGx 补漏（证据、剂量、行动性） |
| clinicaltrials | 734 | 57 | 131 | ClinicalTrials.gov（首页、检索筛选、研究记录、结果页、About） |
| clinvar-core | 264 | 39 | 1 | ClinVar 首页/检索/变异记录/筛选器 |
| clinvar-deep | 40 | 4 | 10 | ClinVar 深页（证据、表型、提交者） |
| clinvar-frag | 86 |  | 36 | ClinVar 切碎句（跨节点拼接） |
| clinvar-help | 608 | 3 | 10 | ClinVar 文档（FAQ、审核状态、字段定义） |
| clinvar-submit | 214 | 8 |  | ClinVar 提交门户与高级检索构建器 |
| clinvar-tip | 41 |  |  | ClinVar 工具提示与气泡 |
| common | 698 | 52 | 1 | 跨站通用界面词与规范化规则 |
| dbvar-bioproject | 201 | 20 | 2 | dbVar / BioProject |
| ebi-home | 61 | 2 | 1 | EMBL-EBI 全局页头页脚与首页（多站复用） |
| ebi-training | 52 | 2 |  | EMBL-EBI 培训（课程、线上讲座、材料） |
| ena | 513 | 28 | 29 | ENA Browser（记录页、检索、序列检索、Webin） |
| ensembl | 394 | 10 | 16 | Ensembl（含新前端、文档、API、VEP、切碎句） |
| ensembl-extra | 452 | 4 | 4 | Ensembl 补充（文档侧栏、API、VEP、镜像安装） |
| ensembl-tpl | 116 |  | 71 | Ensembl 整段模板 |
| ensembl2 | 129 | 1 | 15 | Ensembl 新前端与 BioMart 深层 |
| ensemblgenomes | 34 | 1 | 3 | Ensembl Genomes（细菌/真菌/植物/原生生物门户） |
| europepmc | 263 | 32 | 12 | Europe PMC（检索、过滤面板、文章页、导出与引文） |
| expasy | 318 | 11 | 48 | Expasy 资源门户（工具目录、帮助、新闻） |
| fill-r19 | 37 |  | 20 | GTEx 数据集、HPA 单细胞、PubMed 首页补漏 |
| galaxy | 350 | 18 | 24 | Galaxy 主站与项目官网（usegalaxy.org、galaxyproject.org） |
| gdc | 514 | 20 | 1 | GDC Data Portal |
| gdc-docs | 1114 | 12 | 126 | GDC 文档站（API 指南、数据字典、生信流程） |
| gdc2 | 16 | 3 |  | GDC Data Portal 补漏 |
| gdv | 103 | 6 | 1 | NCBI GDV（基因组数据查看器） |
| gdv2 | 60 | 11 |  | GDV 配置轨道面板、轨道集线器、帮助页 |
| gene | 246 | 37 |  | NCBI Gene |
| gene2 | 42 | 6 | 2 | NCBI Gene 补漏 |
| geneontology | 529 | 2 | 4 | 基因本体资源（首页、文档、下载、工具目录） |
| geo-docs | 432 | 1 | 60 | GEO 文档体系（/geo/info、FAQ、MIAME、提交指南） |
| geo-extra | 199 | 5 |  | GEO / GDS / SRA 检索页补漏 |
| gepia2 | 180 | 9 |  | GEPIA2 |
| gnomad | 245 | 10 | 5 | gnomAD |
| gtex | 536 | 14 | 41 | GTEx Portal（含数据集页与文档） |
| gtex-home | 245 | 13 | 33 | GTEx 首页与文档补漏 |
| gxa | 570 | 54 |  | Expression Atlas（实验页、组织枚举、下载） |
| hpa | 1779 | 139 | 27 | Human Protein Atlas |
| hpa2 | 268 | 12 | 44 | Human Protein Atlas 补漏（组织、单细胞、信息图） |
| hpo | 184 | 10 | 9 | Human Phenotype Ontology（首页、术语页、基因页、注释与下载） |
| imagej | 374 | 2 | 82 | ImageJ / Fiji Wiki（下载、插件、更新站点） |
| intact | 219 | 7 | 56 |  |
| interpro | 369 | 16 | 4 | InterPro（首页、检索、条目、蛋白页、帮助） |
| jaspar | 353 | 17 | 37 |  |
| kegg | 567 | 16 |  | KEGG（含帮助文档与通路图查看页） |
| kegg-docs | 113 | 1 | 3 | KEGG 帮助文档 |
| kegg-docs2 | 89 | 2 | 4 | KEGG 文档补漏（通路、模块、KO） |
| medgen-gtr | 335 | 72 | 2 | MedGen / GTR |
| mesh | 83 | 7 |  | NCBI MeSH |
| metabolights | 315 | 15 | 11 | MetaboLights 代谢组学数据库（实验页、下载、帮助） |
| mirbase | 162 | 22 |  | miRBase |
| misc-extra | 217 | 5 | 3 | UALCAN / GTEx / GEPIA2 补漏 |
| misc-tpl | 32 |  | 83 | 杂项整段模板 |
| ncbi | 1439 | 76 | 2 | PubMed / GEO / BLAST / 页眉页脚与 About、目录站、结构库（Structure/CCD/IPG） |
| ncbi-cat | 162 | 10 | 4 | NCBI 目录站（Guide、NLM Catalog、ORFfinder） |
| ncbi-deep2 | 84 | 14 | 1 | GTR 基因页 / MedGen / BioSample / CCDS / Datasets 深页 |
| ncbi-dirs | 298 | 4 | 26 | RefSeq / BioSample / CCDS / 提交门户 |
| ncbi-footer | 73 | 2 |  | NCBI 全站页脚（mega footer、NLM 新版页脚、Structure 字段） |
| ncbi-guide | 366 | 4 | 12 | NCBI Guide 深页 |
| ncbi-help | 1711 | 5 | 19 | PubMed 帮助中心（FAQ、检索语法、字段表、附录） |
| ncbi-home | 42 | 5 |  | NCBI 首页与全站导航 |
| ncbi-new2 | 158 | 12 | 2 | MedGen / GTR / dbVar / BioProject / Structure / NLM Catalog / ORFfinder / Guide / Datasets 深页 |
| ncbi-struct | 197 | 27 |  | Structure / CCD / IPG 记录页 |
| nextflow | 203 | 15 | 32 | Nextflow 官网与文档站（含 docs.seqera.io） |
| nextprot | 12 |  | 9 | neXtProt 退役归档页 |
| nfcore | 401 | 19 | 52 | nf-core 官网（首页、流程目录、工具、文档） |
| onco | 239 | 9 |  | TCGA 队列、变异类型、生存统计 |
| opentargets | 410 | 24 | 32 | Open Targets Platform（靶点页、疾病页、证据面板、下载） |
| pdbe | 223 | 9 | 2 | PDBe（首页、条目页、检索、下载与文档） |
| pharmgkb | 88 | 8 | 15 | PharmGKB / ClinPGx（首页、基因页、变异页、说明书注释、下载） |
| pmc | 82 | 17 |  | NCBI PMC（首页、页眉页脚、文章骨架） |
| pmc-home | 47 | 5 | 4 | PMC 首页与检索 |
| pride | 394 | 43 | 2 | PRIDE Archive（数据集、文件表、SDRF、帮助文档） |
| proteomexchange | 27 | 1 | 10 | ProteomeXchange 蛋白质组数据联盟（提交与数据集检索） |
| pubchem-dbgap | 738 | 18 | 3 | PubChem 与 dbGaP |
| pubmed2 | 31 | 3 | 1 | PubMed 首页与结果页补漏 |
| rcsb | 723 | 34 | 3 | RCSB PDB（含新版首页与检索） |
| rcsb-home | 17 | 4 | 8 | RCSB PDB 新版首页 |
| reactome | 541 | 58 | 7 | Reactome（通路页、检索、下载、通路浏览器） |
| rfam | 363 | 37 | 31 | Rfam（首页、家族页、检索、下载、帮助文档） |
| scp | 251 | 5 | 7 |  |
| seq | 162 | 15 |  | NCBI Nucleotide / Protein / Assembly |
| seq2 | 37 | 5 | 1 | NCBI Nucleotide / Protein 补漏 |
| snakemake | 207 | 17 | 86 | Snakemake 工作流文档（教程、参考、部署） |
| snp | 123 | 4 | 5 | NCBI dbSNP |
| spa | 136 |  |  | 各站共用的单页应用骨架词 |
| string-atlas | 700 | 43 | 40 | STRING 与 EMBL-EBI Expression Atlas |
| string-atlas2 | 45 | 11 | 7 | STRING / Expression Atlas 补充（下载说明） |
| targetscan | 250 | 33 | 5 | TargetScanHuman（首页、检索、结果表、FAQ、下载） |
| taxonomy | 116 | 6 |  | NCBI Taxonomy |
| timer | 123 | 8 |  | TIMER2.0 / TIMER3 |
| ualcan | 132 | 4 |  | UALCAN |
| ucsc | 1008 | 9 | 49 | UCSC Genome Browser（含 hgTracks/hgVai/hgGene 与切碎句） |
| ucsc-extra | 452 | 24 | 248 | UCSC 补充（hgTracks 工具栏、轨道名、hgTables） |
| ucsc-hggene | 55 | 6 |  | hgGene / hgGeneGraph 基因页正文与控件 |
| ucsc-tpl | 80 | 7 | 75 | UCSC 整段模板 |
| ucsc-vai | 151 |  | 18 | UCSC Variant Annotation Integrator |
| uniprot | 769 | 16 |  | UniProt |
| uniprot2 | 100 | 15 |  | UniProt 补漏（条目页、检索、下载） |

合计 **35252 条 / 1800 条规则 / 2183 条模板**（114 册 / 91 站点）。词库按家族复用，加一个站通常只增 50–300 条。

## 开发

```bash
npm install          # 只装 jsdom（仅测试用）
npm test             # 引擎、面板、站点与产物单测（2,000+ 条）
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
node tools/attr-scan.mjs pubchem "https://pubchem.ncbi.nlm.nih.gov/compound/2244" 14000 --top 3
#   ↑ 属性通道 + 下拉普查：末尾一行给出「option 总数 / 英文数 / select 个数」，
#     长列表（PubChem 215 条、TargetScan 2078 条）不必逐条看，一眼判断是漏翻还是数据值。
node tools/aclass.mjs ensembl        # 词库里有、页面却没翻的 A 类缺口
node tools/scope-check.mjs ensembl "https://www.ensembl.org/"  # scope 选择器命中数，0 命中会告警
node tools/coverage.mjs research/pubmed.html pubmed
node tools/smoke.mjs research/pubmed.html "https://pubmed.ncbi.nlm.nih.gov/?term=brca1" 40
```

贡献方式见 [CONTRIBUTING.md](CONTRIBUTING.md)，同类脚本调研见
[docs/reference-implementations.md](docs/reference-implementations.md)。

## 许可

MIT。词条全部自行撰写，不整份复制 GPL 仓库的词库。