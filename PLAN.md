# 工作计划（当前状态）

> 最后更新：2026-11-28，对应版本 0.17.5（本地，未推送）。
> 这份文件是给「接手这个仓库的人（或新会话）」看的：现状、怎么做、坑在哪、还剩什么。
> 设计初稿与里程碑演进见 git 历史里的旧版本。

## 约束（不变量，任何改动都不能破）

1. **MIT 协议**：不整份复制 GPL 仓库的词库/代码。通用界面词（Search→搜索）是公共常识可独立撰写；
   任何成批抄来的词条都属于衍生作品，与 MIT 冲突。词条只从公开通用译法与自建采集来。
2. **离线**：最终脚本不发任何网络请求，不用 `@require/@resource/@connect`，不带模型。
3. **只改文本**：仅替换文本节点 `nodeValue` 与白名单属性，不增删元素、不改样式与事件。
4. **不翻专有名词**：基因/蛋白符号、变异命名、物种拉丁名、accession、序列、坐标、文件名、数据值原样保留。
5. **宁可留英文，不可半中半英**：整块留英文可接受；一句里半英半中是缺陷。

## 现状（2026-11-28）

| 项 | 值 |
|---|---|
| 版本 | 0.17.6（本地，未推送） |
| 词库 | 118 册 / 36338 exact / 1893 规则 / 2251 模板 |
| 覆盖站点 | 95 个（`config/sites.json`） |
| 单测 | 2493 条全绿（`npm test`，约 172 s） |
| 产物 | `dist/biol10n.user.js` 2,228,370 字节（约 2176 KB） |
| 发布 | GitHub `qzhengpyuan/biol10n`（public）；脚本猫 script id `9127`（已公开，站内搜「BioL10n」可得，线上 v0.17.3） |
| 本机 | ScriptCat 扩展 id 不写死（`tools/apply.mjs` 从安装页 URL 反查，机器上装多个也不装错）；`node tools/apply.mjs` 装，需 CDP 9227 |

远端状态：main 与 release 两个分支，release 只放 `biol10n.user.js` + README。
0.16.0–0.17.2 已推送（main 与 release 同版本对齐，release 头 = v0.17.2）；0.17.3–0.17.6 只存在于本地工作树，未经用户要求不推；脚本猫线上仍是 v0.17.3（改公开时一并发布）。

## 结构

| 位置 | 作用 |
|---|---|
| `src/engine.js` | 引擎：哪些节点翻、被标签切碎的句子怎么拼、何时跳过、性能 |
| `src/boot.js` | 注入入口：按 host 选站点、懒加载词库、挂观察器/热键/悬浮球 |
| `src/ui.js` | 悬浮球与设置面板、阅读辅助（原文卡、双语对照、选中即查、英文名定位、位置记忆、漏翻记录） |
| `build.mjs` | 把词库内联成单文件；含三条断言（词库全内嵌、有册必须挂站、@match 覆盖全部 host） |
| `config/sites.json` | 站点表：hosts / path / dicts / scope / skip / attrs / spa / rescan / scopedExact 等 |
| `dict/*.json` | 词库册：`exact` / `rules` / `templates`（格式见 `docs/engine-design.md`） |
| `test/*.test.mjs` | jsdom 回放 + 静态断言；每批词条都要配一个测试文件 |
| `tools/` | `release.mjs`（发版）、`apply.mjs`（装本机）、`dict-lint.mjs`（跨册冲突/卫生）、`attr-scan.mjs`（属性普查）、`miss-report.mjs`（真实页面「仍是英文」清单 + 截图）、`readme-sync.mjs`（把 README 词库表/合计/体积同步成当前值；`--check` 只报差异）、`miss-replay.mjs`（用已有漏翻报告回放名单收益：`npm run miss:replay -- <siteId>`，`--candidates` 预览候选、`--list` 看各站报告量） |

## 发版链（一字不改地按顺序跑）

```bash
cd /mnt/E/code/biol10n
# 1. 改 package.json 的 version（ScriptCat 同版本不生效，必须 bump）
# 2. 构建 + 全量测试
npm run build && npm test
# 3. 生成 dist 并过 dist-fresh 闸门
node tools/release.mjs
# 4. 只提交到本地（见下条硬规则，不要 push）
git commit -am "0.16.x：……"
# 5. 装到本机 ScriptCat（浏览器 CDP 9227 必须先起）
node tools/apply.mjs
```

**【硬】未经用户明确要求，不执行 `git push`**（2026-11-27 用户原话：「以后我没有让你push就不要push，只许commit到本地」）。
**【硬】即使得到推送许可，也不许「改一点小更改就推」**（2026-11-28 用户原话：「以后不要没完成一点小更改就推送」）：攒够一个稳定批次再推一次，一次会话里反复 push 算违规。
发版照旧改版本、构建、测试、`release.mjs`、本地 commit、`apply.mjs`；要不要推到 GitHub 由用户当次说了算。
推送时两个分支一起：`git push origin main release`。

**脚本猫 webhook 会自动同步**：改 README 也必须走一次 release，否则商店页显示旧 README。

## 当前进度与待办

已完成：引擎（精确/规则/模板/跳过/正文保护/可逆）、17 站起步扩到 91 站、悬浮球与六项阅读辅助、
性能两轮优化（大表格页首扫 3.3 s → 0.93 s，重扫 1.2 s → 0.35 s）。

本轮（2026-11-26，0.16.3）收掉的：

- **推送**：main `5e4ed75..33fbfcc`、release `02f41f6..ed1b890`，0.16.0–0.16.2 三个欠账一次补齐；本机 ScriptCat 装到 0.16.3。
- **CELLxGENE `/datasets` 实机复核**（直连 headless + document-start 注入 dist）：首扫 **526 ms**、
  全量重扫 **1026 ms**（单轮约 19.3k 节点 / 4637 精确命中 / 812 规则），此前基线 7007 ms；
  口径 = `__BIOL10N.timing().start`（boot → engine.start）与 `disable()/enable()` 后轮询到 nodes 稳定。
- **cBioPortal 文档站恢复复核**：站点已能打开，侧栏/页头/首页/FAQ/内页标题译文正确，正文按设计留英文（FAQ 页 401 节点、21 精确命中，剩 0 条界面英文）。
  补了 Retype 内置 404 页与通知句 6 条：`Document not found` / `File Not Found` / `Please see the` /
  `troubleshooting` / `guide for assistance.` / `User guide free icon`（整句词条匹配不到，是因为站点把句子拆在
  `Please see the` + `<a>troubleshooting</a>` + `guide for assistance.` 三个节点里）。

本轮（2026-11-26 晚，0.16.4）收掉的：

- **七路并行补译**（每个子代理独占 CDP 端口 + 私有 `OUT=` 构建，只改自己那几册 dict 与一个 test 文件）：
  pubmed、ensembl、hpa、atlas（CELLxGENE / Expression Atlas / SCP）、epmc（Europe PMC / UniProt）、
  ncbi（NCBI 系 + SRA）、protfunc（InterProScan / PDBe / 元素周期表）。合计 +338 exact、+26 规则、+11 模板。
  dsh 重启打断了最后三个（gdc / ncbi / protfunc）：ncbi、protfunc 的产出已落盘并经复核收下，**gdc 没留下任何改动**，下一轮重做。
- **标题递归分段**（`src/engine.js` `splitTitle`）：`titleBySegments` 原先只按一个分隔符切，
  HPA 的 `Search: TP53 - The Human Protein Atlas` 先被 `: ` 切成 `Search` + 剩余整段，
  剩余段因带数字（TP53）被 `keptOk` 放行，结果标题留半截英文。现在未命中词库的段再按其余分隔符拆一层（≤2 层），
  `test/title-nested.test.mjs` 4 条；标题结构与既有规则命中都不变。
- **pubmed 的 scope 扩到 `body`**（commit bf2fbae）：结果页 exact 448→487、条目页 301→358、残留 137 种→104 种，
  漏掉的正是 NCBI 页头页脚那 40 条界面文字；`test/pubmed2.test.mjs` 改为直接读 `config/sites.json`，scope 再漂移会被测出来。
- **`tools/readme-sync.mjs` 修体积行**：原来只改字节数，体积行里那句「N 个文件共 X 条词条（含 Y 条规则）+ Z 条模板，覆盖 S 个站点」
  还是旧值，`--check` 却报「一致」。现在四处一起改。
- **日期占位符裁决**：`MM`/`DD` 与 `YYYY` 同类，都是「填数字」的格式提示，一律不译；
  `pubmed-extra.test.mjs` 里那条「翻成月/日」的断言已改回不译，与 `ncbi-aria.test.mjs` 的既有判据统一。
- **词库卫生**：删除 `pubmed2` 的 `MM`/`DD`（与上一条一致）；`hpa2` 的两条新规则补 `requireHit`（p 值捕获组那条例外，见坑）；
  `test/hpa2.test.mjs` 加例外白名单，`test/kegg-docs2.test.mjs` 的模板数 3→4。
本轮（2026-11-27 凌晨，0.16.5）收掉的：

- **gdc / cBioPortal 补译**（第二轮，上一轮被 dsh 重启打断、零改动）：GDC 门户（首页、Projects、Repository、Downloads、
  CohortBuilder、项目页、cart、manage_sets）+ GDC 文档站 + cBioPortal（首页、datasets、study summary、results），
  三册合计 +41 exact（`gdc2` 8→16、`gdc-docs` 1113→1114、`cbioportal2` 54→86），`test/gdc-cbio-r2.test.mjs` 12 条。
  GDC 门户的两个 8.6 MB Next.js chunk 在本网络必截断，要用 CDP Fetch 回灌本地副本才能渲染（回灌工装留档 `/mnt/E/临时文件/biol10n-gdc-load.mjs`，不入库）。
- **SCP app 内文案**（上一轮记的是「bundle 下不完」）：真因是 HTTP/2 —— h2 下 210 s 节点数恒为 12、
  控制台 `ERR_HTTP2_PROTOCOL_ERROR`、5.4 MB 的 app JS 单连接只下到 2.9 MB 就断；加 `--disable-http2` 后 5.5–6.6 s 下完、节点 12→543。
  `dict/scp.json` +50 exact / +1 规则，`test/r73-scp-app.test.mjs` 12 条；列表页剩 40 条英文全是物种/器官/建库方案/研究名（数据，不翻）。
- **`tools/miss-report.mjs` 加 `VIA_HOME=1`**：SPA 站先开首页再点导航进目标页。CELLxGENE 的 `/datasets`、`/collections`
  直连时 SSR 只吐 header、客户端不 hydrate，直接 navigate 只拿到 22 个节点（看着「没缺口」）；走首页点链接后 19,353 个节点 / 4,667 精确命中。
- **Europe PMC 的 `.highlight` 放出来**：实测该站 `.highlight` 只用于关于页侧栏当前项（1 个），检索页与文章页各 0 个，
  不是检索词高亮。给 `europepmc` 站点加 `block` 覆盖（去掉 `.highlight`），并让 `src/boot.js` 真正支持 `site.block`
  覆盖 `defaults.block`（原先硬取 defaults，站点级覆盖是死配置）。`test/epmc-highlight.test.mjs` 7 条。
- **`new` 徽章统一**：cellxgene / cBioPortal / PubMed / GDC 的徽章是「新增」，UCSC track 菜单的按钮是「新建」。
  common 里放大小写敏感的规则 `^new$`（只命中全小写），UCSC 继续用自己册的 exact（exact 优先于规则）；`test/badge-new.test.mjs` 6 条。
  `string-atlas` 与 `gxa` 的「Expression Atlas」按既有惯例裁决：站内自称翻「表达图谱」，他站引用保留品牌英文（HPA 同处理）。
- **PLAN 去重**：文件曾被贴成同一份两遍、中间一条坑断在半句，已修回单份。
- 验收：`npm test` 2313 条全绿；`dict-lint` 35252 条、跨册冲突 57 组未涨；`dist/biol10n.user.js` 2,147,569 字节。

本轮（2026-11-27 凌晨，0.16.6）收掉的：

- **站级不翻名单接进命令行工具**：`config/sites.json` 的 `missNoise` 原先只给页面内漏翻面板（`src/ui.js` 的 `isNoise`）用，
  `tools/miss-report.mjs` 照样把流程名刷进清单。现在工具按站点 id 读同一份名单过滤：GDC 文档站那页从 53 条降到 1 条
  （余下 `API` 是缩写，故意不进名单——子串匹配会顺带吃掉 `Rapid` 这类词）。
- **gdc-docs 的 missNoise 补到 38 条**：BWA / ASCAT / Arriba / MuSE / VarScan2 / CellRanger / STAR / dbGaP / TCIA / UUID / USA.gov
  等实测出现过的流程名与标识符。
- **`Query` 标签改「查询」**（`common` 与 `ena` 同改，句子里的「检索式」不动）：页签上读「查询式」是把标签当检索表达式了。
- `test/query-noise.test.mjs` 6 条：两册同值、正文句子不动、名单覆盖实测流程名、名单不吃界面词、词库确实没有这些流程名的 exact。

本轮（2026-11-27 下午，0.16.7）收掉的：

- **站级不翻名单支持正则条目**（`"re:"` 前缀）：登录号、基因组坐标、测序平台名、研究显示名这类取值枚举不完，
  现在可以按形状覆盖。`src/ui.js` 与 `tools/miss-report.mjs` 用同一套语义（普通条目子串匹配、`re:` 条目当正则，
  作者自己加 `^`/`$` 决定整串还是子串），正则只编译一次（blast 那条名单一千多字符，逐条 `new RegExp` 太贵）。
  `test/miss-noise-regex.test.mjs` 6 条：正则生效、坏正则跳过不误滤、锚定语义、工具与面板语义一致、配置体检。
- **9 个站补上名单**（`config/sites.json`）：uniprot 30 条（UniProt 登录号 / rs / HGNC / ENS / EBI / GO / PR / VAR_ /
  物种拉丁名 + 库名）、ncbi-blast 3 条（PAM/BLOSUM 矩阵、`BLAST`/`PAM` 这类程序名、物种拉丁名两词式带界面词停用表）、
  ncbi-snp 18 条（坐标 `NC_000017.11:7676153:G:C`、RCV/rs、`gnomAD v4 - Genomes`、蛋白替换 `P (Pro) > L (Leu)`、
  千人基因组等群体名）、pubchem 7 条（`PCLID n`/`CID n`/DOI/LD50/SPLASH）、cellxgene 3 条（10x/Visium/Smart-seq/
  Slide-seq 等平台名、SMBO/SCBO/SL 数据集 id、常见物种）、hpa 3 条（`5.2 nCPM` 数值、41 个细胞系、6 个脑区）、
  cbioportal 2 条（`(MSK, Nature 2024)` 式研究显示名、CNA/RPPA/GISTIC/OQL 缩写）、clinicaltrials 4 条（NCT/NCI 编号、
  NIH 资助号、`City, State, United States, ZIP`）、ucsc 2 条（GENCODE V50 / dbSNP 155 / CADD 1.6 / `chr17:…` 坐标）。
- 对既有报告回放的效果：uniprot 2784→439、hpa 303→98、ncbi-blast 20648→6943、cbioportal 1650→1211、
  clinicaltrials 973→640、cellxgene 2540→2370、pubchem 3783→3601、ncbi-snp 1475→1220、ucsc 321→300；
  剩余条目里仍未动的都是真缺口（`PubChem SID:`、`New Feature`、`Study View`、`Hide group`、`IntAct` 这类）。
- 实机复核（直连 headless 9231 + `INJECT=1`）：UniProt 的 TP53 条目页 9,350 节点、exact 4,007，名单滤掉 2,343 条文本 / 8 条属性；
  余下 414 条里成片的是单字母氨基酸代码与 `dbSNP:` / `PubMed:` 这类字段标签（真缺口，没进名单）。
- 验收：`npm test` 2325 条全绿；`dist/biol10n.user.js` 2,152,797 字节（名单让产物涨约 5 KB）。

本轮（2026-11-27 下午，0.16.8）收掉的：

- **第二批站级名单**（6 站，同一套正则/子串语义）：string-db 4 条（54 个模式生物拉丁名 + EMBL/Ensembl）、
  ena 2 条（`PRJEB…`/`ERR…` 登录号、`.fastq.gz` 类文件名）、gnomad 8 条（gnomAD/CNV/SV 版本串、e 记数 p 值、GRCh37/38、
  ENST、`17_7668434_T_G` 变异 id、`N samples, …` 计数、ExAC/pLoF）、opentargets 7 条（rs、UniProt 登录号、变异 id、VEP/eQTL/SuSiE）、
  pride 4 条（`NT=`/`CT=` 控制注释串、`.raw`/`.mzML` 文件名、`PXD…`）、rfam 3 条（`RF…`/`CL…` 家族号、GO/SO 术语 id、`5S_rRNA` 式符号）。
- 对既有报告回放：string-db 114→56（属性 58→3）、ena 138→65、gnomad 136→90、pride 103→68（属性 65→41）、
  opentargets 246→229、rfam 317→310。rfam 收益小是因为那页大半是真的界面词与文献元数据标签（PMID/doi/Bibcode），属真缺口没进名单。
- 名单覆盖站点数 9→15（另有 gdc-docs 为 0.16.6 所加，合计 16 站）。`test/miss-noise-regex.test.mjs` 的配置体检阈值同步到 16 站。
- 验收：`npm test` 2325 条全绿；`dist/biol10n.user.js` 2,154,479 字节。
本轮（2026-11-27 下午，0.16.9）收掉的：

- **cBioPortal 研究显示名的口径定案：整名不翻。** `/datasets` 一页就有 588 个不同研究名，
  `config/sites.json` 的 `skip` 里本来就排着 `.study-name` / `.dataset-name` / `.studyMeta` / `.headBlock .studyName`，
  说明从一开始就是按「数据集身份」处理的；改成「疾病名翻、队列括号留英文」会撞上引擎设计文档里那条坑
  （`Pan-Lung Cancer (TCGA, Nat Genet 2016)` 被套成全角括号的半中半英），也违反不变量 5。
  疾病词汇另有出口：肿瘤类型选择器/筛选器里的病名早就有中文（`cbioportal.json` 里的「结直肠腺癌」「尤文肉瘤」等）。
- **研究名形态的噪音正则补全**：原来只认 `(TCGA|MSK|TARGET|...)` 开头的括号，现在再补两条通用形态
  ——「逗号 + 期刊/年份」`(…, Nat Med 2017)` 与「团队/会议 + 年份」`(SMC 2018)`，外加 `- iAtlas Harmonized` 后缀；
  `/datasets` 回放从 439 条涨到 675 条被滤，真界面标签（`Study View`、`New Feature`、`Copy-number Alterations (OQL is not in effect)`）一条没误伤。
  `OQL` 从缩写名单里拿掉（它是界面词，词库已有「Onco 查询语言（OQL）」）。
- `test/cbio-study-names.test.mjs` 4 条：skip 名单里确有研究名容器、研究名整名保留无中文、通用形态都能滤、界面标签不误伤。
- 验收：`npm test` 2329 条全绿。
本轮（2026-11-27，0.17.0）收掉的：

- **首扫分片（scanBudgetMs）**：`walk` 原来一次性处理整批文本节点，超长页面（UCSC/GDC 表格 3–6 万节点）
  上一轮同步扫描能把主线程占住几百毫秒。现在引擎接受 `scanBudgetMs`（boot 传 120），`scan()` 开头定一个总截止时间，
  `walk` 到点就把剩下的文本节点排进 backlog，由 `requestIdleCallback`（无则 setTimeout 16ms）按同样预算分批补完。
  文档顺序基本就是从上到下，所以首屏/视口附近的文字天然先翻。
  - backlog 用 WeakSet 去重：每次重扫/路由/rescan 的 `walk` 都会重新看到同一批节点，不去重时 UniProt 9.3k 节点页
    5 秒内能堆到 4 万条（早期实测），全是白跑。
  - jsdom 合成页（2000 行 × 10 列、4.2 万元素）：`start()` 同步阻塞 501 ms → **368 ms**（剩余在空闲回调补完，
    最终 `hitExact` 与不分片完全一致，`test/perf-engine.test.mjs` 最后一条钉住）。
  - 真机（直连 headless + document-start 注入 dist）：UniProt TP53 条目页 9,341 节点，`stats.time.walk` 136 → 75–80 ms；
    `timing.start` 从 ~520 ms 降到 ~190 ms（含页面主线程争用，绝对值随机器波动）。长任务总量被页面自身 React 淹掉，
    该页只有约 100 ms 的引擎侧收益。
  - **没走 IntersectionObserver 的理由**：IO 回调是异步的，可见文字会先以英文出现、下一帧才变中文（闪一下，观感更差）；
    逐块 `observe` 的注册成本随节点数线性涨；而文档顺序已经近似视口顺序，分片拿到大部分收益且不碰布局。
- `test/scan-slices.test.mjs` 3 条：分片留下 backlog 并能补完、默认关闭时一次扫完（`stats.backlog` 恒 0）、
  关闭翻译后不再补 backlog（不会再冒出中文）。
- 验收：`npm test` 2333 条全绿。

本轮（2026-11-27，0.17.1）收掉的（第三批站级名单 + 面板/工具口径对齐）：

- **`skip` 现在也管漏翻清单**：引擎本来就不碰 `site.skip` 区块，但页面内面板（`src/ui.js` 的 `collectMisses`）
  和命令行工具（`tools/miss-report.mjs` 的采集器）各自独立扫 DOM，从来不读 `skip` —— 跳过区块里的文字一直被当漏翻。
  `skip`/`skipFree`（含 `valueText` 的 value 口径）已传进面板与工具：miRBase 分类树、cBioPortal 正文、GEO 结果标题这类
  「引擎明确不翻」的内容不再出现在清单里。
- **`rec:` 前缀（大小写敏感正则）**：`re:` 编译时带 `i`，基因符号那种「全大写才算」的形状没法写。
  新增 `rec:`，且 `isNoise` 不再先把输入转小写再比（否则 `^[A-Z]` 永远匹配不上）。
- **timer2（TIMER3）**：9 条 `rec:` 正则覆盖基因符号（`TP53`、`A1BG-AS1`）、克隆登录号（`AC000003.1`、`ABC7-42391500H16.2`）、
  数据集标签（`Melanoma_Nathanson_2017`）、`5S_rRNA`、`[DOI]/[PubMed]`；实测该页 3,210 条文本 → **30 条**。
- **NCBI GEO**：25 条（GSE/GSM/GDS/GPL 登录号、GCA 组装号、13 个模式生物、NCBI 库名、NLM/NIH/HHS/USA.gov、
  NCBI 地址、`MM/DD` 占位符、`GitHub`/`Youtube` 图标 aria-label）；实测 `/gds/?term=BRCA1` 44 条 → **7 条**，属性 13 条 → **0 条**。
  `Add to Clipboard`、`Download data: TXT`、`Start from citation` 这些界面词没有被吃掉（词库已有译文，属真覆盖）。
- **miRBase**：`skip` 加 `li.node, li.end_node`（分类树与物种叶节点），实测 `/browse/` 文本 2 条 → **0 条**。
- 命令行的属性采集口径同步引擎：`value` 只收 submit/button/reset（或站点声明 `valueText` 的文本框），
  hidden 与 option 的值不再进清单；含 `@`/URL 的文本按面板口径排除。
- `test/miss-noise-batch3.test.mjs` 6 条：`rec:` 大小写敏感、timer2 正则不吃界面词、GEO 多词串过滤、`skip` 与 `skipFree` 对清单生效、
  miRBase 配置、命令行与面板口径一致。
- 验收：`npm test` 2339 条全绿。

本轮（2026-11-27，0.17.2）收掉的（四个子代理并行补译 + 引擎两处判据修复）：

- **并行分工**：timer2(TIMER3)/geo(NCBI GEO)/rcsb(RCSB PDB)/interpro 四个子代理各占一个 CDP 端口与 profile、各自 `OUT=/tmp/<name>.user.js` 私有构建，
  只改自己的词库册 + 建一个自己的测试文件，禁改 `config/sites.json`/`src/`/`package.json`/README/PLAN/tools、禁 commit；名单与引擎改动由主会话统一收口。
  四路并行没有互相踩：字典册不重叠，`dict-lint` 跨册冲突全程 57 组。
- **timer2**：`dict/timer.json` +3 exact（`sCNA`→拷贝数改变、`with`→及、`and`→和）；`test/timer3-ui.test.mjs` 8 条。
  实机 30 条 → **27 条**，余下全是题录/正文。
- **ncbi-geo**：`dict/geo-extra.json` +48 exact / +8 规则；`test/geo-ui-r2.test.mjs` 10 条。
  数据集页 45/19 → **10/1**，系列页 26/1 → **26/0**；`Single`→单连接（原先被小写兜底误译成「单端」）。
- **rcsb-pdb**：`dict/rcsb.json` +15 改 2（页脚资助声明按真实节点边界逐段补齐、实体分组 aria-label、新闻卡标题与 alt）；`test/rcsb-ui-r2.test.mjs` 7 条。
  首页 53→41、结构页 75→67、高级检索 30→22（属性 15→12）。
- **interpro**：`dict/interpro.json` +13 exact / +3 规则（UniProt 审编状态、匹配句、PROSITE 谱、计数行规则）；`test/interpro-ui-r2.test.mjs` 7 条。
  protein 页 75→66、structure 页 50→45、检索页 14→11。
- **引擎修复 1 — `proseExempt` 能命中无属性元素**：`proseHitAbove()` 以前只在元素 `hasAttributes()` 时才试 `matches()`，
  于是 `div[role=main] > strong` 这种带裸标签的放行选择器对 `<strong>` 永远不生效（timer2 的 `Instruction:` 页签因此一直留英文）。
  现在按选择器自身判断：条目里去掉 属性/类/ID/伪类 后还剩标签名（`proseExemptNeedsBare`）才对无属性元素试匹配，
  NCBI 那种纯 `.usa-banner` 选择器仍走原来的快路径。timer2 站补 `proseExempt: "div[role=main] > strong"` 后该页签已翻。
- **引擎修复 2 — 句内分隔符不再制造半中半英**：`inLongProse` 的「前文以字母结尾 ⇒ 句中」判据把 `/` 当断点，
  于是 `…marked in red / blue, respectively.` 里 red 被挡住、blue 被放行成「蓝色」。正解不是把 `/&|` 塞进字符类
  （那样 KEGG 的 `A | B | C` 标签行和 NCBI mega footer 会整片退回英文，实测踩过），而是**先剥掉末尾分隔符**再看最后一个字符。
- **ncbi-geo 打开 value 通道**：`attrs: ["value"]`（默认属性表是追加不是覆盖）+ `geo-extra` 补 `Display`→显示；
  引擎对 `value` 本来就只翻 submit/button/reset（文本框要站点显式 `valueText`），GDSbrowser 的 `Display`/`Go` 按钮因此能翻。
- **第四批站级名单**：timer2 追加 10 条（题录 `rec:^[A-Z][a-z]+ et al\\. `、期刊名、卷期页码、作者名（带 Search/Read 等界面词负向前瞻）、`GO:BP`、工具包名、`, respectively.`），回放 3218→**16 条**；
  ncbi-geo 追加 11 条（`to`、`(Submitter supplied)`、隐藏 mega-menu 的品牌名、`GDSBrowser`、`protocol`、`A/B/vs`）；
  rcsb-pdb 15 条（PDB ID、`pdb_0000xxxx`、UniProt、作者、链号、实体 ID、晶胞、空间群、期刊、物种白名单、InChIKey、ENSG、品牌白名单、已译标签、Examples 芯片），
  实测 130 条残留滤掉 90 条；interpro 6 条（`PMID:`、`doi:`、IPR 号、`9k` 计数、成员库号前缀、格式名）。
  新增 `test/timer-noise.test.mjs` 3 条钉住「名单滤数据但不吃界面词」。
- 删掉 interpro 的 `PMID:`→`PMID：`（只有标点差异，值无汉字，卫生测试报错）。
- 新增 `test/prose-fixes.test.mjs` 4 条：裸标签 `proseExempt` 生效、纯类/属性选择器不误伤、斜杠后的句内短词保持英文、独立短标签仍翻。
- 验收：`npm test` **2378 条全绿**；`dict-lint` 114 册 / 35332 条 / 跨册冲突 57 组；产物 2,167,698 字节。

本轮（2026-11-27 深夜，0.17.3，本地未推送）收掉的（三个子代理并行 + 名单收紧）：

- **引擎：`<mark>` 高亮切开的片段不再半翻**。InterPro 检索结果里 `<a><span></span><mark>Protein</mark><span> kinase-like …</span></a>`：
  `<mark>` 不在 `INLINE` 表里 → `inlineRoot` 停在 mark 内 → `nextTextAfter/prevTextBefore` 读到空串 → 片段被当独立标签翻成「蛋白质 kinase-like …」。
  修法（`src/engine.js`，+88 行）：`markRun()` 把 `<mark>` 还原成它所在的整条行内文本流（向上穿内联祖先取根，再在块级容器内向两侧收连续内联节点，遇块级/控件/图片停，流 > 400 字符按整段正文处理）；
  `handleTextNode` 在正文保护之前判：`flow !== text` 时对整条流查表——整条有译文且容器纯内联就整段替换（走 `blockOriginals`，restore 可还原），否则登记漏翻、片段保持英文；`flow === text`（`<mark>Download</mark>` 这种整词高亮）走原通道。
  `test/mark-split.test.mjs` 7 条。真实页面：修前标题「蛋白质 kina e domain」、说明段「ubiquitin-蛋白质 liga e」→ 修后整条英文。
  其他站：Europe PMC 无 `<mark>`；EBI Search / Ensembl 检索 / PRIDE / Expression Atlas 探测均为 0；NCBI/PubMed 被 reCAPTCHA 挡，未取证（修复在引擎层，自动覆盖）。
- **kegg 通路名不再进漏翻清单**：`skip: "div.list"` + `skipFree: ["div.list span.new", "h2.txt3", "h4.txt3"]`（`div.list` 里唯一的界面文字是 3 个 `span.new` 徽标）。
  历史报告回放 653 → **23 条**（其余是 `.list2` 散文拆句与品牌/图例词，skip 治不了）。**未实机取证**（genome.jp 与代理均连不上），依据是两份静态副本 + 报告；连通后要抽 module/brite/ko/entry 三页复核 `div.list` 是否仍纯内容。
- **europepmc 25 条站级名单**：品牌/库名整串锚定（Europe PMC / MEDLINE / PubMed / PMC / EMBL-EBI / ORCID / Wellcome Trust / NLM…）、作者、卷期页、PMID/MED/PMCID/DOI/ORCID、日期、资助编号、机构地址。
  回放 687 → **198 条**。有两条形状刻意不收：光秃秃的期刊缩写（`Int J Mol Sci`、`Nat Commun`）与 Title Case 短语——它们和 `Gene Expression`、`Show More`、`Advanced Search` 同形，收了会把真界面缺口藏起来（`test/miss-noise-batch5.test.mjs` 7 条钉住）。
- **PubMed 剪贴板与排序**：`dict/pubmed2.json` +9 exact（Clipboard items、No items in clipboard.、两次过期提醒、Research Materials（沿用 gene.json 译法）、Dismiss expiration warning、两个排序提示）；
  `test/pubmed-extra2.test.mjs` 8 条；`/clipboard/` 实机 27 → 23 条。未收：跳页 `of`（会与 ensembl/expasy 的 `of`→`/` 形成第 58 组冲突）、`Keywords:`（既有测试锁英文）、`My NCBI account settings`（长句里该走模板）。
- 新增 `test/mark-split.test.mjs` 7 条、`test/miss-noise-batch5.test.mjs` 7 条、`test/pubmed-extra2.test.mjs` 8 条。
- 验收：`npm test` **2400 条全绿**；`dict-lint` 114 册 / 35341 条 / 跨册冲突 57 组；产物 2,174,703 字节。

本轮（2026-11-28 凌晨，0.17.4，本地未推送）收掉的（三个子代理并行补译 + 域名漏配修复）：

- **string-db**（子代理 sdb，只改 `dict/string-atlas2.json`，45 → 107 exact）：网络页 focus bar（`open as new network` / `show in list` + 3 个 title）、
  下载页 `/cgi/download`（物种限制/置信度/去重/分隔符四组设置、6 个下拉项、3 张表表头与 32 条描述列、`New`/`coming soon`）、页脚 `Access`。
  下载页漏翻 151 → 84（剩 62 条是文件名与体积，数据不翻）；`test/string-db-r2.test.mjs` 7 条。
- **gnomAD**（子代理 gnomad2，`dict/gnomad.json`）：exact 245 → 266、模板 5 → 7；基因页未翻 236 → 161，其中真界面文案 43 → 9，内容类 60 处一处没动；
  变异页属性 13 → 0（`Copy link to X` 全部翻出）；`test/gnomad-r2.test.mjs` 15 条。移除 2 条 `Data displayed here is from ClinVar's…`：
  发布日期被浏览器 locale 渲染成「2026年10月11日」，再翻必半中半英，整句留英文。
- **NCBI Gene**（子代理 gene2，`dict/gene2.json` +12 exact +1 规则）：LinkOut/Research Materials 面板（Find Quality Antibodies、Find Recombinant Proteins
  and Peptides、Order … clone、Get Plasmids - Addgene、reagents、Probe、NEW）、`^Analysis date: (.+)$ → 分析日期：$1`；`test/ncbi-gene-r2.test.mjs` 9 条。
  **未实机取证**：NCBI 对 headless 全挡 reCAPTCHA（672/7157 都是 nodes 0），依据 `research/miss-gene.json`（TP53 页 713 种）与 attrs 报告。
- **string-db 中国区域名漏配（真 bug）**：`www.string-db.org` 302 到 `cn.string-db.org`，而 `config/sites.json` 的 hosts 没有这个域名
  → 中国用户的页面脚本**根本不注入**（实测 `window.__BIOL10N === undefined`）。已加 hosts，`@match` 现为 string-db.org / www / cn 三条。
  cn 域直连时 Cloudflare 对 headless 直接 403（挑战页），真浏览器可用；`curl` 已验证 302 目标。
- **站级名单**：`ncbi-gene` 28 条（EC / AC 登录号 / 证据代码 / RefSeq 登录号 / UniProt / MGI / isoform / GO 前缀 / 物种 / 品牌库名），
  回放 TP53 页 713 种 → 243 种（界面哨兵 59 条 0 误滤）；`gnomad` 补 19 条（`[GEA]`、pLI、HGVSc/HGVSp、SiteQuality、inbreeding_coeff、AS_*、dbSNP(/ClinVar(、品牌）；
  `string-db` 补 4 条（`[HD]`、`k`、ENSP 登录号、SIB/CPR/ELIXIR）。刻意不收：NCBI 的 `of`（分页片段，译「/」不含汉字过不了卫生断言）、
  gnomAD 的裸基因符号正则（会连 NEW/RNA/GEO 一起吃掉）。
- **规则必须有捕获组的既有断言**撞上两条静态串：SpliceAI 说明句移到 exact；`^only$`（ClinVar 表头筛选按钮）保留为规则，
  理由是 kegg 册已把 `only` 定义为「（仅搜索此项）」，进 exact 会多一组跨册冲突；`test/gnomad.test.mjs` 只对这一条加了例外并写明原因。
- 验收：`npm test` **2431 条全绿**；`dict-lint` 114 册 / 35436 条 / 跨册冲突 57 组未涨；产物 2,181,427 字节。

本轮（2026-11-28 凌晨，0.17.5 → 0.17.6）收掉的（冷启动相位拆分 + 早启动尝试与回退）：

- **先量再改**：`src/boot.js` 的 `timing` 拆成 `ready`（脚本注入 → body 可翻）/ `load`（本站词库解压解析）/
  `dict`（ready+load）/ `start`（译完首扫）。实测本站词库解压解析只要 4–85 ms（UniProt 85、RCSB 31、cellxgene 4），
  旧版 507–863 ms 的 `dict` 里绝大部分是等 DOM 的时间 —— 这组字段保留，供以后判断冷启动慢在哪一段。
- **0.17.5 的早启动**：把门控从「body 有子节点或 readyState 非 loading」改成「body 存在即开工」。
  初测 UniProt 863 → 256 ms、RCSB 8,107 → 2,004 ms；**独立复核否定了这个结论**：
  冷缓存 A/B（同浏览器顺序跑 old→new，另有 `Network.setCacheDisabled` 轮）里 RCSB old 2,545–2,743 vs new 2,298–2,936 ms，
  UniProt old 101–176 vs new 158–187 ms，区间重叠；可见中文时点探针显示静态页 `first ≈ ready`，但 ready 差值小于 run 间抖动，
  SPA（UniProt）正文 1.2–2.3 s 才出现，门控提前不改变用户看到中文的时刻。
- **早启动引入的窄回归**：流式页面「body 下裸文本先到、首元素晚到」时，新门控会把 `Search` 先翻成「检索」，
  后续 ` results for TP53` 到达后成为「检索 results for TP53」；旧门控整块留英文。合成用例可稳定复现。
- **处理：0.17.6 回退门控**，保留 `ready`/`load` 相位字段；`test/boot-timing.test.mjs` 3 条钉住「不能再退回只看 body」。
  复核用的是重建的旧门控产物（源码文本替换），旧门控 0.17.4 原产物未留档。
- 复核顺带确认：6 站混合语抽查 old/new 完全一致（onlyNew = 0），无半句；`reactome` 站点本身 2.4 s 就会翻，此前「15 秒不翻」的记录不再复现。

本轮（2026-11-28 凌晨，0.17.6 后段）收掉的（四个子代理并行补译新站）：

- **ChEMBL**（`dict/chembl.json` 258 条：211 exact / 43 rules / 4 模板；站点插在 `embl-ebi` 之前、只吃 `^/chembl(/|$)`）：
  首页/检索/报告卡命中 54→72、128→265、104→302；`/training/` 与基线逐项一致（没抢 `embl-ebi`）。
  遗留：`All (6 more)` 被 common 的括号规则抢先译成「全部（6 更多）」；`From` 表头被 common 的「从」覆盖；气泡图多行标签逐行收。
- **MSigDB / GSEA**（`dict/msigdb.json` 437 条：360/24/53）：11 个页面实测界面漏翻 0 条；
  `collection_details.jsp` 的长散文 63 条整段留英文（设计内）。词条含 46 条名单，压掉作者/期刊/日期/物种/登录号噪音。
- **Enrichr**（`dict/enrichr.json` 143 条：135/3/5；站点 `spa` + `waitFor` + 5 组 `scopedExact`）：
  首页/文库/结果表/帮助漏翻 549→257（余下 218 条是数据库专名）、314→0、26→0；结果页 3,005 命中 + 460 模板。
  取证时本网络不通 jQuery/DataTables CDN，子代理预注入本地副本才拉起表格；真实用户环境不需要。
- **medRxiv**（`dict/medrxiv.json` 204 条：196/4/4）：首页/检索/文章页漏翻 63→0、252→0、193→0；
  `skip` 掉结果标题、作者、机构与正文 `.highwire-markup`，剩余属性 2 条是上一篇/下一篇标题（元数据）。
  风险：`inlineExact: true` 全站放开正文保护，三页实测无误翻，若日后发现应改成选择器级。
- **合并口径**：四册都按多数册译法对齐跨册冲突（Collections/Collection/Overview/Release notes/See、Pathology/Pediatrics/Surgery/Subject/Through/Data availability、Gene Id/Nursing/Transplantation/Publisher/Order by/not 等），
  唯一保留的是 `Terms`（Enrichr 表头=条目数 vs cBioPortal 条款，语义不同，记 1 组有意冲突）；`dict-lint` 57 → **58 组**。
- **README**：`readme-sync.mjs` 只改数字不增行，四册要手工补表行（本轮的坑）。
- 验收：`npm test` **2493 条全绿**；118 册 / 36338 exact / 1893 规则 / 2251 模板 / 95 站；产物 2,228,370 字节。

待办（按优先级）：

1. **GreasyFork**：没有发布 API，只能登录后走网页表单，本机无账号凭据 —— 要么在 `:99` 登录一次、由会话驱动表单，
   要么维持现状（GitHub release 分支 raw 直链安装）。
2. **性能余量（分片已做，剩非 walk 阶段）**：0.17.0 的分片只覆盖 `walk` 里的文本节点；`blocks`/`paras`/`templates`/`cleanup`
   四段仍在同一次同步扫描里跑完（4.2 万元素合成页上合计约 200 ms）。要再压就把这四段也切成任务单元，
   判据同样是「最终覆盖率不变 + `test/perf-engine.test.mjs` 的三条不退化」。
3. **SCP 未覆盖**：上传向导（登录后才有：AnnData 上传、Terra 授权、`Validating...`）、书签弹窗实渲染、DE 绘图控件（Plotly 需真实数据）。
4. **cBioPortal 研究显示名**：已定案「整名不翻」（0.16.9，理由见上；`test/cbio-study-names.test.mjs` 钉住），此项结案。
5. **GDC `/projects`、`/repository`、`/annotations`**：前两个是客户端渲染空壳，第三个要登录，本轮没取证。
6. **kegg `div.list` 待实机复核**（0.17.3 只做了静态回放）：genome.jp 网络恢复后抽 module / brite / ko / entry 三页，
   确认 `div.list` 里除 3 个 `span.new` 徽标外没有界面文字；若某页整块是界面控件，改成更窄的容器选择器或给该页单独 skipFree。
7. **`<mark>` 修复的后验**：0.17.3 已在 InterPro 真实页面验证整条保持英文；剩余站点里 EBI Search / Ensembl 检索 / PRIDE / Expression Atlas 探测都是 0 个 `<mark>`，
   NCBI / PubMed 被 reCAPTCHA 挡未取证 —— 有代理时补一次，确认没有新形状（`<mark>` 跨多个块级元素时不适用）。
8. **发布面**：脚本猫 `9127` 已公开、线上 v0.17.3；本机装了 0.17.6。GitHub main/release 头仍是 v0.17.2，
   0.17.3–0.17.6 只在本地 —— **【硬】未获明确要求不 push，且不许改一点就推**（用户 2026-11-28：「以后不要没完成一点小更改就推送」）。
   GreasyFork 用户说先算了，暂缓。
9. **NCBI Gene 实机取证**：0.17.4 的 12 条是静态证据推导（672/7157 全被 reCAPTCHA 挡，curl 也只拿到挑战页）。
   有真实浏览器/可用代理时跑一次 `miss-report ncbi-gene`，确认没有再漏的界面词，也确认 `of` 分页片段是否值得做跨节点模板。
10. **cn.string-db.org 的 Cloudflare**：加 hosts 后中国用户能用，但 headless 直连被 403 挑战页，无法自动回归；
   回归时用真浏览器或比对 `www` 的 302 目标即可。
11. **kegg 仍不可达**：`genome.jp` 2026-11-28 复测仍是 000（15 s 超时），`div.list` 的 skip 只能继续挂静态回放；europepmc 也仍是 403 / Cloudflare 挑战。
12. **`common.json` 的 `Profile`→「个人资料」**：InterPro 成员库语境应是「谱」，但同键改全域会牵动别的站，
   现在只能靠 `PROSITE profiles` 这类复合键挡；要动就三处一起核对（common / interpro / 其他含 Profile 的册）。
13. **ChEMBL 两个 common 抢先命中**：`All (6 more)` → 「全部（6 更多）」、`From` 表头 → 「从」。要修得动 common 的括号规则或给 common 加站点级豁免，
    牵动面大，先记在这里；jsdom 下 `scopedExact` 对 Vuetify 表头无效（真实页走 inline/段落路径），已删死配置。
14. **medRxiv `inlineExact: true` 的后验**：三页实测无误翻；若发现正文短句被误翻，改成选择器级 `inlineExact`。
15. **Enrichr 取证环境**：结果表依赖 jQuery 1.9.1 + DataTables 1.9.4 CDN，本网络直连被断；复测要么走真实浏览器，要么像子代理那样预注入本地副本。

## 踩过的坑（每条都真实踩过，改之前先看）

- **`tools/miss-report.mjs` 会覆盖 `research/` 里的同名报告**：`research/` 不在 git 里，覆盖就找不回来。要让子代理先建目标目录再备份（`mkdir -p` 之后 `cp`），
  或者干脆用不同站 id 落新文件；0.17.4 就发生过一次（备份目录不存在、`cp -n` 静默失败，改前基线只剩主会话记录的数字）。
- **词库规则必须有捕获组**（`test/gnomad.test.mjs` 这类断言）：静态整句该进 exact，进 rules 会红。只有「进 exact 会撞跨册冲突」的单词才值得开例外，
  例外要在测试里写明原因与原键（现行唯一一条：gnomAD 的 `^only$`，kegg 已占用 `only`→「（仅搜索此项）」）。
- **hosts 漏地域域名 = 脚本不注入**：站点按 IP 302 到 `cn.*` / `www.*` 时，`config/sites.json` 的 hosts 与生成的 `@match` 必须都覆盖，
  否则用户看到的是纯英文页面且控制台无任何错误。判据：`curl -D -` 看 `location`，再用 headless 确认 `window.__BIOL10N` 是否存在。
- **headless 被 Cloudflare / reCAPTCHA 挡 ≠ 站点不可用**：NCBI Gene 与 `cn.string-db.org` 都是 403/挑战页，但 `curl` 与真浏览器正常；
  结论只能写「未实机取证」，并注明用的静态证据。

- **规则里的 `$1`**：bash 内联 `node -e` 会被 shell 吃掉，必须写成 `.mjs` 脚本文件再执行。
- **新站接线的顺序**：先写 stub 词库 → 进 `config/sites.json` → 再补词。没挂站的册会让 `build.mjs` 直接 exit 1。
- **同一 host 多站**：`www.ebi.ac.uk` 靠 path 排序，新 EBI 站必须插在 `embl-ebi` 之前（boot 取首个匹配）。
- **规则挂错词库**：页面由 site 的 `dicts` 决定，规则写进别的册等于没写（`/guide/` 归 `ncbi-guide`，不是 `ncbi-help`）。
- **单词级词条**：只适合导航标签；放进通用册会漏进正文句子（「GDC Data Transfer Tool」→「…工具」）。
   正文里的单词要用整句词条，或 `scopedExact` 限定到具体选择器。
- **模板通道**：pat 必须与真实 DOM 的空白逐字符对齐；验模板前先 `__BIOL10N.disable()`，否则旧引擎处理过的 DOM 会让判据失真。
- **跨册同键不同值**：`tools/dict-lint.mjs` 会报冲突；往 `common` 下沉前先 `grep` 全库。
- **子代理不能改 `config/sites.json`**：接线、版本号、发版一律由 lead 做，否则会出现「词库写了但站点没启用」。
- **`apply.mjs` 同版本无效**：ScriptCat 按版本号判断是否更新。
- **`document-end` 在某些页面不注入**（HTML 流不结束）：脚本已改 `document-start` + `whenBodyReady()`，别改回去。
- **复核用 CDP 探测脚本**：`node /mnt/E/临时文件/probe.mjs <URL> <waitMs> "<函数体必须 return>"`（每次 createTarget）。
- **实机复核别走 neo 的系统代理**：neo 影子实例吃 FlClash 代理，外网站点（cellxgene、cbioportal 文档站）
  表现为空壳/报错，而 curl 直连正常。正解是起一个直连 headless 再注入构建产物：
  `google-chrome --headless=new --no-proxy-server --remote-debugging-port=9231 --user-data-dir=/tmp/biol10n-chk-profile-9231 about:blank &`
  然后 `CDP_PORT=9231 INJECT=1 node tools/miss-report.mjs <siteId> <url>`（`INJECT=1` 在 document-start 注入
  `dist/biol10n.user.js`，等价脚本猫，口径可比）。
- **CDP 端口别贪手边的号**：9229 上已常驻别人的 Vivaldi（带 mpognobbkildjkofajifpdfhcoklimli 扩展），
  撞上去会往别人浏览器里开标签页。新实例一律用 9231 起。
- **scope 写窄会整片漏掉页头页脚**：PubMed 的 scope 原为 `main` + 几个根，NCBI 页头页脚约 40 条界面文字
  （`An official website of the United States government`、`Log in`、`Follow NCBI`、`Web Policies`）全在外面，
  而 `dict/ncbi.json` 里早有词条。2026-11-26 把 `pubmed` 的 scope 改成 `body`：结果页 exact 448→487、
  条目页 301→358、残留 137 种→104 种，半中半英抽查全是品牌名整体保留（无新增缺陷）。
  同属 NCBI 的 `ncbi-blast` 仍是窄 scope（`main, #blastapp, .blastpage`），其余 NCBI 站本来就是 `body`。
- **Ensembl 基因页会 308 跳转**：`/Homo_sapiens/Gene/Summary?g=…` 与 `/Gene/Sequence?g=…` 现在都跳到
  `/feature-explorer/GCA_000001405.29/gene:ENSG…`，两者是同一份 DOM；审「Sequence 页」看起来没变化不是漏翻。
- **UCSC 的 `hgGateway`/`hgTracks` 有 Cloudflare Turnstile**：headless 直连只能拿到 813 字节挑战页，
  伪装 UA 也过不去。审这两页要用 `:99` 上带登录态的浏览器，或按例外处理。
- **`<head>` 里的 `<link title>` 是噪音**：Retype/Docusaurus 每页都有 `<link rel=alternate title=Sitemap>`，
  旧版 miss-report 会把它当「漏翻」报出来；已按 `closest("head")` 过滤。

- **标题分段只按一个分隔符切会半中半英**：HPA 的 `Search: TP53 - The Human Protein Atlas` 先被 `: ` 切开，
  剩余段因为带数字（TP53）就被 `keptOk` 整体放行。修法是 `splitTitle` 递归再拆（≤2 层），
  别改成「所有分隔符都试一遍再挑最不像英文的」——那会把 `Collections < BioStudies < EMBL-EBI` 这类结构打乱。
- **子代理写的测试必须照真实 DOM 的节点边界挂载**：ncbi 与 protfunc 这轮都踩过——把
  `Click 'Refresh' to clear items from the table, or click the 'X' …` 整句挂成一个文本节点，
  或把 `InterProScan is … against InterPro's \nmember database signatures.` 整段挂一个节点，
  测出来永远失败，但真实页面上这些句子是被 `<button>` / `<a>` 切开的，词库键也就该按切开的写。
- **换行不是节点边界**：`normalize()` 会把 `\s+` 折成一个空格，HTML 源码里的换行在 DOM 里仍属同一个文本节点；
  按源码换行拆出来的键永远匹配不到。拆分只能按元素边界（`<a>`/`<button>`/`<strong>`），不能按行。
- **格式占位符不译**：`MM` / `DD` / `YYYY` 这类「填数字」的 placeholder 一律留英文；
  只翻 `MM`/`DD` 而留下 `YYYY` 会让三个输入框一半中文一半英文（`ncbi-aria.test.mjs` 早有判据）。
- **`requireHit` 的例外只有「捕获组永远翻译不动」的固定句式**：hpa2 的 `^Non-significant (p<…)$` 与
  `^(.+) is a prognostic marker in:$` 捕获组分别是 p 值与基因符号，加 `requireHit` 会让整条规则失效；
  这类要写进测试的例外白名单并注明理由，不要为了过测试硬加标志。
- **`readme-sync` 只改字节数会造出「假一致」**：体积行里同时嵌着词条数/规则数/模板数/站数，
  少改一处 `--check` 照样报一致，但 README 上就有一半是旧数字（0.16.4 已修）。
- **HTTP/2 会把大 bundle 掐断**：SCP 的 5.4 MB app JS、GDC 门户的两个 8.6 MB Next.js chunk，在本网络走 h2 时
  单连接只下到一半就 `ERR_HTTP2_PROTOCOL_ERROR`，页面永远空白，看起来像「站点慢」或「SPA 没 hydrate」。
  取证实例一律加 `--disable-http2`；GDC 那种必截断的还要用 CDP Fetch 拦 document 请求、回灌本地副本
  （工装 `/mnt/E/临时文件/biol10n-gdc-load.mjs`）。
- **`common` 里的小写 exact 会被 Title-case 命中**：引擎有 `lowerIndex` 小写兜底，在 `common` 写 `"new": "新增"`
  会让页面上的 `New`（Ensembl 页签 / Biomart 按钮）抢在站内规则 `^New$ → 新建` 之前被翻成「新增」，
  两套既有测试直接红。小写词要通用化时用**大小写敏感的规则**（`^new$`），不要进 exact。
- **`re:` 正则编译带 `i`，`isNoise` 又先把输入转小写**：写 `^[A-Z][A-Z0-9]*$` 想匹配基因符号时，
  `Search`/`Download` 也会命中。要大小写敏感就得用 `rec:`（且拿原串比），别用 `re:` 凑。
- **`site.skip` 只作用于引擎，不作用于清单**：面板与命令行各自扫 DOM，加 skip 区块时两处都要跟（0.17.1 已接通）。
- **`missNoise` 的普通条目是子串匹配，短词会吃掉界面词**：`PubChem` 会连 `PubChem SID:` 这类字段标签一起滤掉，
  `BLAST` 会吃掉 `blastn suite`，`AGR` 会吃掉 `agreement`。短词/通用词一律写成锚定正则（`re:^PubChem$`），
  只有品牌全名（`UniProt`、`CellRanger`）才用子串。加完名单回放报告，确认被滤掉的都是数据。
- **拉丁生物学名不能用 `^[A-Z][a-z]+ [a-z]+$` 一把梭**：NCBI BLAST 的表单两词串里混着 `Reset page`、`Template type`、
  `Search results`、`blastn suite` 这类真界面文字。现行写法带一张界面词停用表（page/type/result/suite/…），
  以后看到界面标签从清单里消失，先往停用表加词，别删整条规则。
- **正则条目不要自动加锚点**：`re:P[0-9]{5}` 按子串命中（会连整句一起滤），`re:^P[0-9]{5}$` 才只吃纯 ID。
  工具与页面面板都按「作者写什么就是什么」执行，测试 `test/miss-noise-regex.test.mjs` 固定了这条语义。
- **验收顺序：先 `npm run build` 再 `readme-sync`**：`readme-sync` 会把 `dist/biol10n.user.js` 的字节数写进 README，
  顺序反了会写进旧字节数，`readme-stats` 照报不一致。
- **`proseExempt` 的选择器带裸标签才需要特别处理**：`proseHitAbove()` 现在按选择器判断要不要对无属性元素试 `matches()`
  （`proseExemptNeedsBare`：去掉 `[attr]`/`.class`/`#id`/`:pseudo` 后还剩标签名即为真）。写 `.usa-banner` 这类选择器时
  仍走快路径；写 `div[role=main] > strong` 这类时会对每个元素多一次 `matches()`，超大页面上要量一下 `timing.blocks`。
- **`/` `&` `|` 不能直接塞进 `inLongProse` 的「前文以字母结尾」字符类**：KEGG 的 `A | B | C` 标签行、
  NCBI mega footer 的 `… | Contact Us | …` 会整片被当正文挡住退回英文。正解是先剥末尾分隔符再看最后一个字符
  （`prv.replace(/[\s\/&|]+$/, "")`）：`red / blue` 仍按句内挡住，标签行剥完是汉字照翻。
- **`dict/*.json` 里不能写注释**：`// …` 会让 `require()` 直接 SyntaxError（0.17.2 踩过，删掉那行才恢复）；
  需要解释就写到 `PLAN.md` 或对应 `.md`。
- **并行子代理的收口顺序**：每个代理只改自己的 `dict/*.json` 与新建一个 `test/*.test.mjs`，
  名单（`config/sites.json`）、引擎（`src/`）、README/PLAN 一律由主会话改；
  交回后先跑各自测试 → 再看 `dict-lint` 是否仍 57 组 → 统一 `npm run build` + `npm run readme` + `npm test`，
  否则中途的 `readme-stats` / `dist 指纹` 必然红（它们读的是磁盘词库与 dist 的一致性）。

- **`readme-sync.mjs` 只改数字不增行**：新增词库册后 README 表要手工补一行（`| 册名 | exact | rules | templates | 说明 |`），否则 `readme-stats` 报「缺行」，合计行却已经是新值，看起来像「数字对不上」实为缺行。
- **新站点插进 `config/sites.json` 要看顺序**：`pick()` 取第一个匹配，宽路径（无 `path` 的 `embl-ebi`）会把窄路径（`/chembl`）吃掉；窄的必须插在宽的之前，并在同域其他路径上回归一次。
- **新册会带出跨册冲突**：同一英文键在不同册用了不同中文（`See` 查看/参见、`Publisher` 出版商/出版者）会让 `dict-lint` 计数上涨；先对齐多数册的写法，语义确实不同才保留并在 PLAN 记账。

## 验收标准

- `npm test` 全绿（2493 条，当前）
- `node tools/dict-lint.mjs` 跨册冲突数不增加（当前基线 58 组；Enrichr 的 `Terms` 是有意保留的 1 组）
- 真实页面抽查：误翻 0 条；半中半英 0 条；英文残留只允许是专有名词/标识符/数据
- 大表格页（`test/perf-engine.test.mjs`）：首扫 < 4000 ms、重扫 < 1500 ms

## 风险与对策

| 风险 | 对策 |
|---|---|
| 站点改版导致选择器失效 | 每站配置独立，出问题只改一行 |
| 词库膨胀 | 已按站点拆册 + 运行时懒加载（`parseDict` 只解析当前站用到的册） |
| 术语漂移（同词两译） | `tools/dict-lint.mjs` 拦冲突，只拦新增 |
| 误翻基因名/编号 | 整节点匹配机制 + 全部大写短词保护 + 词库卫生测试 |
| SPA 抖动 | MutationObserver 去抖 + `flush` 120 ms 时间预算（超时留到下一拍） |
| 大页面卡顿 | 元素级缓存 + 属性通道复用元素表 + 元素表转真数组（见 `docs/engine-design.md`） |
