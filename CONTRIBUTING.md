# 贡献指南

## 加一个站点

1. 在 `config/sites.json` 里加一段：

```json
{ "id": "example", "hosts": ["www.example.org"], "dicts": ["common", "example"],
  "scope": "main, #content", "spa": false }
```

2. 新建 `dict/example.json`，格式见 `docs/engine-design.md`。
3. 用真实页面量覆盖率：

```bash
curl -sL "https://www.example.org/" -o research/example.html
node tools/coverage.mjs research/example.html example
```

4. 目标：界面区覆盖率 ≥85%，且**误翻为 0**。数据行（物种学名、基因名、编号、通路名）不进词表，也不计入覆盖率。

## 加词条

- **exact**：键是整段界面文本（按钮、字段名、表头）。不要写半截短语。
- **rules**：只给带变量的整句用，必须 `^...$` 锚定，变量写 `$1`。
- **不翻**：基因/蛋白符号、变异命名、物种拉丁名、accession、序列、坐标、数字单位、品牌名（PubMed、NCBI、PMID、DOI）。

## 术语一致性

`dict/common.json` 是唯一数据源。站点词库**不得**对 common 已有的键另起译法；
确有站点语境差异（例如 PubMed 的 Summary 是紧凑记录格式，译「概要」），
在 `docs/terms.json` 的 `allowOverride` 里显式列出。

`node tools/terms.mjs` 会拦下所有未豁免的冲突。

## 提交前

```bash
npm test              # 引擎单测
node tools/check.mjs  # 词库格式、代码红线、术语一致性
npm run build         # 生成 dist/biol10n.user.js
```

## 红线

1. **离线**：脚本里不得出现 `fetch` / `XMLHttpRequest` / `WebSocket` / `GM_*` / `@require` / `@resource` / `@connect`。`tools/check.mjs` 会扫描。
2. **只改文本**：只动文本节点 `nodeValue` 与 `placeholder`/`title`/`aria-label`/`alt`（以及按钮型 input 的 value）。不增删元素、不改样式与事件、不碰用户输入。
3. **不塞隐私**：仓库是公开的。不提交本机路径、用户名、主机名、邮箱（只允许 noreply）、截图、页面采集产物。
4. **许可**：本项目 MIT。通用界面词的译法可自行撰写；**不得成批复制 GPL 仓库（如 github-chinese）的词库**，那会让整个仓库变成 GPL 衍生。
