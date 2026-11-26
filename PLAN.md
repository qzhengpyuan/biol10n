# 工作计划（当前状态）

> 最后更新：2026-11-26，对应版本 0.16.4。
> 这份文件是给「接手这个仓库的人（或新会话）」看的：现状、怎么做、坑在哪、还剩什么。
> 设计初稿与里程碑演进见 git 历史里的旧版本。

## 约束（不变量，任何改动都不能破）

1. **MIT 协议**：不整份复制 GPL 仓库的词库/代码。通用界面词（Search→搜索）是公共常识可独立撰写；
   任何成批抄来的词条都属于衍生作品，与 MIT 冲突。词条只从公开通用译法与自建采集来。
2. **离线**：最终脚本不发任何网络请求，不用 `@require/@resource/@connect`，不带模型。
3. **只改文本**：仅替换文本节点 `nodeValue` 与白名单属性，不增删元素、不改样式与事件。
4. **不翻专有名词**：基因/蛋白符号、变异命名、物种拉丁名、accession、序列、坐标、文件名、数据值原样保留。
5. **宁可留英文，不可半中半英**：整块留英文可接受；一句里半英半中是缺陷。

## 现状（2026-11-26）

| 项 | 值 |
|---|---|
| 版本 | 0.16.4 |
| 词库 | 114 册 / 35161 exact / 1798 规则 / 2183 模板 |
| 覆盖站点 | 91 个（`config/sites.json`） |
| 单测 | 2275 条全绿（`npm test`，约 175 s） |
| 产物 | `dist/biol10n.user.js` 2,144,217 字节（约 2094 KB） |
| 发布 | GitHub `qzhengpyuan/biol10n`（public）；脚本猫 script id `9127`（未公开，仅直链） |
| 本机 | ScriptCat 扩展 id 不写死（`tools/apply.mjs` 从安装页 URL 反查，机器上装多个也不装错）；`node tools/apply.mjs` 装，需 CDP 9227 |

远端状态：main 与 release 两个分支，release 只放 `biol10n.user.js` + README。
0.16.0–0.16.4 已于 2026-11-26 推送（main 与 release 同版本对齐，release 头 = v0.16.4）。

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
| `tools/` | `release.mjs`（发版）、`apply.mjs`（装本机）、`dict-lint.mjs`（跨册冲突/卫生）、`attr-scan.mjs`（属性普查）、`miss-report.mjs`（真实页面「仍是英文」清单 + 截图）、`readme-sync.mjs`（把 README 词库表/合计/体积同步成当前值；`--check` 只报差异） |

## 发版链（一字不改地按顺序跑）

```bash
cd /mnt/E/code/biol10n
# 1. 改 package.json 的 version（ScriptCat 同版本不生效，必须 bump）
# 2. 构建 + 全量测试
npm run build && npm test
# 3. 生成 dist 并过 dist-fresh 闸门
node tools/release.mjs
# 4. 提交并推送两个分支
git commit -am "0.16.x：……" && git push origin main release
# 5. 装到本机 ScriptCat（浏览器 CDP 9227 必须先起）
node tools/apply.mjs
```

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
待办（按优先级）：

1. **gdc / cBioPortal 补译**：上轮子代理被 dsh 重启打断，没留下改动，整批重做（口径同 `CDP_PORT=92xx INJECT=1 node tools/miss-report.mjs`）。
2. **GreasyFork**：尚未发布（要不要发待定）。
3. **`tools/miss-report.mjs` 支持「SPA 站先跳首页」**：CELLxGENE 的 `/datasets`、`/collections` 直连时 `<main>` 是空的
   （SSR 只有 header，客户端不 hydrate），直接 navigate 会把这页误判成「只有 22 个节点、无缺口」。
4. **SCP 换时段复测**：`singlecell.broadinstitute.org` 的两个 JS bundle 昨天要 90 s 以上还没下完，研究列表没渲染，
   app 内文案没取证（站壳已 100% 中文）。
5. **`new` 徽章与 string-atlas 译法统一**：ucsc 册 `new`→新建 与 cellxgene 的 `NEW` 徽章要一起改；
   `string-atlas` 册里「Expression Atlas」译作「表达图谱」还是保留品牌，得单独定，别在子代理里各改各的。
6. **Europe PMC 关于页 `.highlight` 被全局 block 跳过**：先实测该站 `.highlight` 是否也用于检索词高亮；
   若两种用途并存，只能加 `scopedExact` 白名单，不能整站去掉 `.highlight`。
7. **性能余量**：`walk` 里剩余开销大半是 jsdom 的接口包装（真实浏览器不存在）；
   若还要做，方向是「只翻视口附近 + 空闲补」（IntersectionObserver + 分片），风险中等。
## 踩过的坑（每条都真实踩过，改之前先看）

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

## 验收标准

- `npm test` 全绿（2275 条，当前）
- `node tools/dict-lint.mjs` 跨册冲突数不增加（当前基线 57 组）
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
