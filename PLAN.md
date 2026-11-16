# 工作计划

## 约束（不变量）

1. **MIT 协议**：不整份复制 GPL 仓库的词库/代码。通用界面词（Search→搜索）是公共常识可独立撰写；
   任何成批抄来的词条都属于衍生作品，与 MIT 冲突。词条只从公开通用译法与自建采集来。
2. **离线**：最终脚本不发任何网络请求，不用 `@require/@resource/@connect`，不带模型。
3. **只改文本**：仅替换文本节点 `nodeValue` 与白名单属性，不增删元素、不改样式与事件。
4. **不翻专有名词**：基因/蛋白符号、变异命名、物种拉丁名、accession、序列、坐标原样保留。

## 工作流

| 编号 | 内容 | 产出 | 负责人 | 状态 |
|---|---|---|---|---|
| W1 | 引擎：整节点精确匹配 + 锚定模板 + 跳过规则 + 幂等/可逆 + 观察器 | `src/engine.js` | lead | 已完成，10 条单测通过 |
| W2 | 构建与自检：把词库内联成单文件、红线检查 | `build.mjs` `tools/check.mjs` | lead | 已完成，可出 12 KB 脚本 |
| W3 | 通用界面词库 | `dict/common.json` | 子代理 dict-common | 进行中 |
| W4 | NCBI 家族词库（PubMed/GEO/BLAST/GDV） | `dict/ncbi.json` | 子代理 dict-ncbi | 进行中 |
| W5 | KEGG / HPA / miRBase 词库 | `dict/kegg.json` 等 | 子代理 dict-sites | 进行中 |
| W6 | 站点配置与回归：每站 scope/spa/waitFor + 真实页面验收 | `config/sites.json` | lead | 骨架已建，7 站 |
| W7 | SPA 站点适配（Ensembl、cBioPortal、UniProt、GDV 实测） | 站点配置 + 补词 | lead | 未开始 |
| W8 | 术语一致性门禁（terms.json + 校验） | `tools/terms.mjs` | lead | 未开始 |
| W9 | 发布：README/CONTRIBUTING/issue 模板/GreasyFork | 仓库文档 | lead | 未开始 |

## 里程碑

- **M1（可试用）**：引擎 + 3 个服务端渲染站（PubMed/KEGG/HPA）+ 1000 条词库，装上能看出差别
- **M2（NCBI 家族完整）**：PubMed/GEO/BLAST/GDV 四站，家族词库 1500 条
- **M3（覆盖常用站）**：再加 Ensembl/UCSC/cBioPortal/UniProt/miRBase，30 站以内
- **M4（发布）**：GreasyFork + GitHub Release，仓库自带 CI

## 验收标准

- `npm test` 全绿
- `npm run lint`（`tools/check.mjs`）0 错误
- 真实页面抽查 20 个文本节点：**误翻 0 条**（宁留英文不可翻错）
- 页面加载后 1 s 内不出现明显卡顿（观察器批量处理生效）

## 风险与对策

| 风险 | 对策 |
|---|---|
| 站点改版导致选择器失效 | 每站配置独立，出问题只改一行；issue 模板收集失效站点 |
| 词库膨胀到 MB 级 | 词库按家族拆分，只加载当前站需要的；超过 500 KB 再考虑 `@resource` 打包 |
| 术语漂移（同词两译） | `terms.json` 唯一数据源 + CI 校验，只拦新增 |
| 误翻基因名 | 整节点匹配从机制上避免；再对 `code/pre` 与全大写短词做二次保护 |
| SPA 抖动 | 200 ms 去抖 + 只处理新增子树 |
