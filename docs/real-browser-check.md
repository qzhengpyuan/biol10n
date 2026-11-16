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
