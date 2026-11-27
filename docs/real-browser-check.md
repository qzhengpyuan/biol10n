# 真实浏览器验收记录（ScriptCat + BrowserOS neo）

验收对象：`dist/biol10n.user.js`（v0.1.1，8 个词库 2681 条 exact / 108 条规则，17 个站点）。
环境：BrowserOS neo（Chrome/155.0.8318.26）影子实例，`DISPLAY=:99`，profile `~/.dsh/agent-browser/neo-profile`，
ScriptCat（脚本猫）1.5.2 以解压方式加载，并在 `chrome://extensions` 打开「允许运行用户脚本」。
脚本通过 `http://127.0.0.1:8765/biol10n.user.js` 安装进脚本猫。

## 指标口径

`nodes` = 引擎实际检查的文本节点与属性数；`exact` = 精确表命中；`rule` = 规则命中；`attrs` = 属性命中。
覆盖率请对照 `tools/coverage.mjs` 的界面骨架口径，不能用全页字符比，因为正文（摘要、通路名、基因名）按设计不翻。

## 结果（v0.1.1）

| 站点 | 页面 | nodes | exact | rule | attrs | 观察 |
|---|---|---|---|---|---|---|
| PubMed | `?term=BRCA1` | 706 | 475 | 11 | 51 | 导航、筛选、按钮、分页基本全中；正文标题不翻（设计如此） |
| HPA | TP53 基因页 | 4601 | 2605 | 25 | 241 | 标题、主导航、侧栏、细胞类型词库 |
| UniProt | P04637 | 10159 | 2100 | 0 | 1 | 章节名、变异注释标签已中文化；正文与数值留英文 |
| KEGG | pathway.html | 870 | 154 | 1 | 0 | 顶栏/子库/分类全中；通路名保留英文 |
| miRBase | 首页 | 408 | 41 | 1 | 3 | 视觉上最完整的一站 |
| BLAST | Blast.cgi | 97 | 61 | 0 | 7 | 页面标题译成「BLAST：基本局部比对搜索工具」 |
| NCBI GDV | 基因组浏览 | 407 | 101 | 1 | 24 | 工具栏与面板标签可读，轨道内容不翻 |
| GTEx | 首页 | 119 | 77 | 0 | 2 | 导航与入口基本中文化 |
| UCSC | 首页 | 151 | 59 | 0 | 1 | 顶栏、工具列表、页脚已中文化 |
| Ensembl | 基因摘要 | 104 | 41 | 0 | 1 | 重 SPA，18 s 仍只渲染出一部分 |
| GEPIA2 | 首页（http） | 128 | 50 | 0 | 0 | 需 http 匹配，修好后注入正常 |
| TIMER3 | 跳转 compbio.cn | 4421 | 53 | 0 | 0 | 跳转域名补进配置后才注入 |
| GDC | 门户首页 | 113 | 3 | 0 | 0 | 页面文字碎片化，命中低 |
| UALCAN | 首页 | 96 | 6 | 0 | 1 | 首页几乎全是介绍段落，属正文不翻 |
| cBioPortal | 首页 | — | — | — | — | 20 s 后仍是空壳，脚本未注入（页面未渲染完成） |

截图见 `docs/shots/`（本地留存，`.gitignore` 已排除）。

## 两轮对比（exact 命中）

| 站点 | 第一轮 | 第二轮 | 变化原因 |
|---|---|---|---|
| HPA | 2166 | 2605 | 补 79 条侧栏/细胞类型/亚细胞条目 + 复数退化 |
| UniProt | 237 | 2100 | 补章节名与变异标签 + spa 词库挂载 + 复数退化 |
| GTEx | 15 | 77 | spa 词库扩充导航与入口 |
| UCSC | 11 | 59 | 原先没挂 spa 词库（配置漏项） |
| Ensembl | 10 | 41 | 补转录本表与页脚条目 |
| GEPIA2 | 未注入 | 50 | 站点配置改 http 协议 |

## 修复清单

1. **构建产物 `@match` 行缺 `// ` 前缀**（致命）：元数据块非法，脚本猫解析不到运行站点，装上也不执行。
   修 `build.mjs`，加 `test/build.test.mjs`（元数据每行必须 `//`、至少 10 条 `@match`、正文 `new Function` 可解析）。
2. **协议写死 https**：站点配置支持 `protocols`，GEPIA2 改 `["http"]`（其 https 端口直接断开）。
3. **TIMER 跳转域名缺失**：`timer.cistrome.org` 跳到 `compbio.cn/timer3/`，补进 `timer2` 的 hosts。
4. **复数不命中**：引擎加复数退化（`ies→y`、`s`、`es`），只在退化后能查到时才用，`test/plural.test.mjs` 覆盖。
5. **词库扩充**：新增 `dict/spa.json`（136 条，UniProt/Ensembl/GTEx/GDC/UCSC/RCSB 的界面标签），HPA +79 条，onco +15 条（GEPIA 菜单）。
6. **UCSC 漏挂词库**：`config/sites.json` 里 ucsc 只挂了 common，补 `spa`。

## 仍未解决

- Ensembl 是重 SPA：18 s 仍只渲染一部分，注入时机受页面自身渲染速度限制。
- GDC 首页文字被拆成大量碎片节点，命中率低；cBioPortal 在 20 s 内连壳子都没渲染完。
- `September 2026`、`More about miRBase →` 这类「月份+年份」「短语+箭头」需要补规则。
- 正文型站点（UALCAN 首页）界面元素本就少，覆盖率天然低。

## 复现

```bash
cd dist && python3 -m http.server 8765 --bind 127.0.0.1
# 浏览器里打开 http://127.0.0.1:8765/biol10n.user.js → 脚本猫「安装」
```

脚本猫需要 `chrome://extensions` → 扩展详情 → 打开「允许运行用户脚本」，否则 MV3 下用户脚本不会执行。
这个开关存在 profile 里，重启浏览器后保持开启。

## 影子实例上的持久化配置

- 解压后的扩展从 `/tmp/sc/ext` 迁到 `~/.dsh/agent-browser/extensions/scriptcat`（`/tmp` 重启即失）。
- 浏览器启动脚本增加了两个启动参数（改动前的脚本在本地做了备份，备份不入库）：
  `--load-extension=<profile 目录>/extensions/scriptcat` 与
  `--disable-features=DisableLoadExtensionCommandLineSwitch`（Chrome 137 起需要显式关掉这条 feature 才能命令行加载扩展）。
- 验收期间的探针脚本 `SC Probe` 已删除（`chrome.storage.local` 里 `script:`/`scriptCode:` 记录一并清掉），PubMed 不再带 `data-sc-probe`。

## 2026-11-26 复核（v0.16.3）

环境换了：neo 影子实例走系统代理（FlClash 7897），外网站点（cellxgene、docs.cbioportal.org）打不开，
所以这一轮改用**直连 headless + document-start 注入构建产物**，页面渲染与引擎口径与脚本猫一致：

```bash
google-chrome --headless=new --no-proxy-server --remote-debugging-port=9231 \
  --user-data-dir=/tmp/biol10n-chk-profile-9231 about:blank &
cd /mnt/E/code/biol10n
CDP_PORT=9231 INJECT=1 node tools/miss-report.mjs cbio-docs 'https://docs.cbioportal.org/user-guide/faq/' 9000
```

| 站点 | 页面 | 结果 |
|---|---|---|
| CZ CELLxGENE | `/datasets` | 首扫 **526 ms**（此前 7007 ms）；全量重扫 **1026 ms**；单轮 19,286 节点 / 4,637 精确 / 812 规则；标题「数据集 - CZ CELLxGENE Discover」 |
| cBioPortal 文档站 | 首页 | 42 节点 / 33 精确 / 1 规则；侧栏、页头、页脚全中文，标题「欢迎来到 cBioPortal 文档！」 |
| cBioPortal 文档站 | FAQ | 401 节点 / 21 精确；正文（prose）按设计留英文，剩 0 条界面英文 |
| cBioPortal 文档站 | 不存在的路径（404） | 标题「文件未找到」、正文「文档未找到」、通知句「更多信息请参阅故障排查指南以获取帮助。」；新增 6 条词条后剩 0 条界面英文 |

新增词条：`Document not found`、`File Not Found`、`Please see the`、`troubleshooting`、`guide for assistance.`、`User guide free icon`。
注意整句词条 `Please see the troubleshooting guide for assistance.` 匹配不到 —— Retype 把句子拆成三个节点，
必须逐段登记；`Please see the` 的值与其他册对齐（`更多信息请参阅`），否则 `dict-lint` 跨册冲突会从 57 涨到 58。

## 2026-11-27 复核（v0.16.5 途中）

两条工具/配置变化来自这一轮的实测：

1. **SPA 站必须走「首页再点导航」**：CELLxGENE 的 `/datasets`、`/collections` 直连时 SSR 只吐 header、客户端不 hydrate，
   直接 `Page.navigate` 拿到的是 22 个节点、3 条文本的假页面（看着「没有缺口」）；先在首页等渲染，再 `click` 导航链接，
   同一页是 19,353 个节点 / 4,667 精确命中。`tools/miss-report.mjs` 现在支持：

```bash
CDP_PORT=9231 INJECT=1 VIA_HOME=1 node tools/miss-report.mjs cellxgene https://cellxgene.cziscience.com/datasets 18000
```

   找不到对应链接时退化为 `history.pushState` + `popstate`（日志里会打「导航方式: click / pushState」）。

2. **Europe PMC 的 `.highlight` 不是检索词高亮**：关于页 `/about` 只有 1 个 `.highlight`（侧栏当前项 `What is Europe PMC?`），
   检索页 `/search?query=BRCA1` 与文章页 `/article/MED/…` 各 0 个、也没有 `<mark>`。全局 blocklist 里的 `.highlight` 会把它整块跳过，
   所以给 `europepmc` 站点加了一条 `block` 覆盖（去掉 `.highlight`，其余默认项照旧），并在 `src/boot.js` 让 `site.block` 真正生效。
   复核同一页：exact 134→136、文本 63→62，侧栏当前项变中文，代码块仍跳过。

   Cloudflare：Europe PMC 用 headless（带或不带 `--no-proxy-server`）都会停在「请稍候…」挑战页；
   用 `:99` 上的**非 headless** Chrome（`--no-proxy-server`）能过，命令：

```bash
env -u WAYLAND_DISPLAY -u WAYLAND_SOCKET DISPLAY=:99 google-chrome \
  --user-data-dir=/tmp/biol10n-chk-epmc2 --remote-debugging-port=9235 --no-proxy-server \
  --window-size=1280,900 about:blank &
```

   STRING（`string-db.org`）即使非 headless 也过不去 Cloudflare（页面一直是「请稍候…」，等 40 s 不变）。

## 2026-11-28 冷启动相位实测（v0.17.5 → 0.17.6）

`__BIOL10N.timing()` 拆成四个相位，先分清「等 DOM」与「解压词库」再谈优化：

| 字段 | 含义 |
|---|---|
| `ready` | 脚本注入 → `whenBodyReady` 放行 |
| `load` | 本站词库解压 + JSON.parse |
| `dict` | `ready + load` |
| `start` | 首扫（walk）结束 |

实测（直连 headless、document-start 注入 dist）：

| 页面 | ready | load | dict | start |
|---|---|---|---|---|
| UniProt TP53 条目 | 250 ms | 6 ms | 256 ms | 270 ms |
| RCSB 1TUP | 1,931 ms | 72 ms | 2,004 ms | 2,036 ms |
| CELLxGENE /datasets | 101 ms | 4 ms | 105 ms | 122 ms |
| GDC 文档首页 | 1,701 ms | 14 ms | 1,716 ms | 1,759 ms |

结论：词库解压只要 4–85 ms，旧版 507–863 ms 的 `dict` 里绝大部分是等 DOM，不是词库。

### 早启动尝试（0.17.5）与回退（0.17.6）

0.17.5 把门控改成「body 存在即开工」，初测 UniProt 863 → 256 ms、RCSB 8,107 → 2,004 ms。
独立复核（冷缓存 A/B + 可见中文探针）推翻了收益：RCSB old 2,545–2,743 vs new 2,298–2,936 ms、
UniProt old 101–176 vs new 158–187 ms，区间重叠；静态页 `first ≈ ready`，差值小于抖动；
SPA 正文 1.2–2.3 s 才出现，提前门控不改变用户看到中文的时刻。
且流式页面（body 下裸文本先到）会先翻半句：`Search` → 「检索」，随后 ` results for TP53` 到达成「检索 results for TP53」。
0.17.6 因此回退门控，只保留 `ready`/`load` 字段；`test/boot-timing.test.mjs` 钉住回退后的判据。

复核方法（可复现）：同一 headless Chrome 内顺序跑 old→new 会互相预热，必须另开 `Network.setCacheDisabled` 轮；
仅看 `timing()` 不够，还要挂 MutationObserver 记录 body 内首个 CJK 文本的时刻（`first`）。
