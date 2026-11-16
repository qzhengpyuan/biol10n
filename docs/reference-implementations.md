# 同类脚本调研：词库驱动的界面汉化

调研时间 2026-11-16。目标形态：**离线、自带词库、只做界面文本替换**的 Tampermonkey / ScriptCat 脚本。在线机翻类扩展（沉浸式翻译、TWP 等）不在对标范围，但记录其边界作为反例。

## 一、最值得对标的两个仓库

### 1. maboloshi/github-chinese（38.6k★，GPL-3.0）

把 GitHub 界面汉化做到工业级的项目，几乎是这类脚本的事实标准。

**结构**

- `main.user.js`（约 62 KB）只放引擎与配置；`locals.js`（约 2.1 MB）放词库，通过
  `@require https://raw.githubusercontent.com/.../locals.js?v<版本号>` 加载
  —— 词库更新不需要用户重装脚本，代价是必须联网拉词库。
- 词库规模（作者 2026-11 自述）：**69,533 条词条 / 14,442 个唯一英文键 / 13,597 个唯一中文串**。
- 词库是 JS 对象而非 JSON：`I18N.conf`（`rePagePath` 页面正则、忽略规则）+ `I18N.dict`（词条）。
  用 JS 而不是 JSON，是为了能直接写正则和注释。

**运行方式**

```js
// @run-at document-start
OBSERVER_CONFIG: { childList: true, subtree: true, characterData: true,
  attributeFilter: ['value', 'placeholder', 'aria-label', 'data-confirm'] }
```

- MutationObserver 同时监听子节点、文本节点变化和**属性变化**（占位符、无障碍标签、确认文案）。
- 页面路由切换要单独处理（GitHub 是 Turbo/React 混合），仓库里有 `navigation-history` 测试。

**工程化程度**（这是它比一般汉化脚本强的地方）

- 单测覆盖：正则预筛（regexp-prefilter）、观察器批处理（observer-batching）、翻译缓存、词库懒加载、页面识别、二步验证页专有处理、输入框不误伤、用户标识跳过。
- `tools/perf/` 下有成套 CDP 探针与压测脚本，用来量真实页面的耗时。
- `docs/terminology.md` 里写着一个很值的教训：**702 个英文键存在 ≥2 种译法**（例如 Credentials 被译成「凭证」46 次、「凭据」3 次）。
  作者为此加了 `docs/terms.json` 术语表 + `script/check-terms.mjs` 校验 + `terms-baseline.json` 存量豁免，CI 只拦新增违规。

**可借鉴 / 不借鉴**

- 借鉴：词库与引擎分离、正则预筛、观察器批处理、翻译缓存、术语一致性门禁、单测清单。
- 不借鉴：`@require` 远程词库（我们需要离线）；可选在线引擎（它接了讯飞听见翻仓库简介）——我们不做。

### 2. asiananlee/zh-cn-userscripts（离线单文件的规范范本）

**每个站点一个 `.user.js`，单文件直接安装**，没有构建、没有依赖。用 `@grant none`，
禁止 `@require` / `@resource` / `@connect`，禁止 `fetch` / `eval` / `innerHTML` / 动态插元素。
这条规则把「不联网」写成了可被 CI 检查的硬约束。

**代码结构（值得直接照抄的骨架）**

```js
COMMON_EXACT   // 精确词条：整段文本规范化后查表
COMMON_RULES   // 锚定模板：带变量的句子，用占位符
SCOPES[]       // 按路径分区的 { id, slug, path, exact, rules, overrides, fragments }
ATTRS          // 属性白名单
BLOCK          // 要跳过的区域选择器
// 引擎：匹配 → 跳过判断 → 写入 → 调试输出 → MutationObserver → 路由监听
```

**行为约束（写进规范，CI 可查）**

- 只改两样东西：文本节点的 `nodeValue`，以及白名单属性（`placeholder`、`title`、`aria-label`、`alt`、按钮型 `input` 的 `value`）。
- 不新增、不删除、不移动元素，不改样式、不改事件。
- 不读、不改用户输入；危险操作（删除、付款、停用）的确认文案译文必须与原文等价。
- 调试输出默认关闭，打开后也只能打印「词典未命中的界面文字」，且必须脱敏（网址、邮箱、数字、日期换占位符），条数上限 100 条。
- 仓库隐私清单：不提交本机路径、邮箱（只允许 noreply）、截图、采集产物。

## 二、其他参考

| 仓库 | 星标 | 形态 | 说明 |
|---|---|---|---|
| nancheung/notion-zh_CN | 118 | 单文件 354 KB | 词库内联，最简形态；小站点够用 |
| JuZi2319/Github-To-Chinese | 11 | 单文件 | GitHub 汉化的另一实现，覆盖设置页/个人主页 |
| Mbilse/Github-for-Chinese | 5 | 单文件 | 同上，早期复刻 |
| lumenbloom/Youhou | 2 | 单文件 | HuggingFace 汉化，说明这套做法可迁移到任意站 |
| GoodWay0223/devin-zh | 2 | 单文件 | 写明「共享词典、兼容检查和回滚」，思路与我们接近 |
| izscc/AIstudio-zh | 4 | 单文件 | 单站小脚本 |
| takeez/vgen-chinese | 0 | 单文件 | 单站小脚本 |

共同点：全部是**本地词表 + 文本节点替换**，没有一个依赖机翻 API；规模大的都做了词库与引擎分离。

反例：沉浸式翻译、TWP 这类扩展走在线机翻（或本地模型），质量高但需要网络/几十 MB 模型，与「各设备复用、装完就能用」的目标冲突。

## 三、对本项目的结论

1. **引擎保持小、词库独立演进**。首发可把词库内联在 `.user.js` 里（单文件、零配置）；
   当词库超过 500 KB 再考虑 `@resource` 打包（Tampermonkey/ScriptCat 用 base64 资源，不需要联网）。
2. **一开始就上结构约束**：`COMMON_EXACT` / `COMMON_RULES` / `SCOPES` / `ATTRS` / `BLOCK` 五段式，站点差异只写配置。
3. **术语一致性门禁要早做**。不用等词库到 7 万条：几百条时就该有
   `terms.json`（键 → 唯一译法）+ 一个 20 行的校验脚本，否则半年后就是 700 个键打架。
4. **缺词收集要脱敏**。调试模式只记「未命中的界面短语」，不记页面全文、不记用户输入。
5. **性能三件套**：首字母分桶的正则预筛、观察器 150–300 ms 去抖 + 批量处理、已处理节点缓存（WeakMap）。
6. **测试清单可直接抄 github-chinese 的**：观察器批处理、翻译缓存、路由切换、页面识别、正则预筛、输入框不误伤、用户标识跳过。
