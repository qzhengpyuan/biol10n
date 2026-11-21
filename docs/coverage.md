# 覆盖情况与已知保留项

> 记录时间：2026-11-21（v0.9.63）。这是快照，不是承诺：站点改版后需重新实测。

## 判定口径

- **界面骨架**：按钮、菜单、表单标签、表头、分页、提示语 → 必须中文。
- **固定说明句 / 整块**：帮助页、FAQ、免责声明、页脚说明 → 整段进词库后翻译。
- **数据与专名 → 保持英文**：基因名、accession（GSE/GPL/GSM/PRJNA/rs/P04637）、物种学名（Homo sapiens、Mus musculus）、癌种缩写、细胞系名、作者与单位、DOI、邮箱、文件格式名（BAM/FASTQ/BED/TSV）、工具与数据库品牌（BLAST、GEO、Ensembl、UniProtKB、BioGPS、AlphaFold、Galaxy、GREAT、OncoPrint）。
- **公式与变量**：ln(counts per 10k + 1)、Log2、p 值符号等不翻。

## 各站状态（v0.9.63 实测）

| 站点 | 状态 | 已知保留英文 |
|---|---|---|
| PubMed | 界面、文章页引文对话框、高级检索、帮助中心 | 论文标题、作者、期刊名、邮编、GitHub/YouTube 品牌 |
| NCBI GEO | 页头页脚、检索页、数据集页 | 样本标题、GPL/GSM 编号、作者、机构、邮箱 |
| NCBI GDV | 页头页脚、工具条 | 数据集编号、NLM/NIH/HHS/USA.gov |
| NCBI BLAST | 表单与结果页骨架 | 数据库名、算法参数名 |
| UCSC | 网关、hgGene、Table Browser、轨道页 | 组装名（GRCh38/hg38）、 consortium 名、作者、格式名 |
| KEGG | 通路列表导航、通路图查看器帮助（36 条）、帮助页 6 段说明 | 通路名（数据）、BlastKOALA/GhostKOALA、DBGET；3 段长正文保持英文 |
| HPA | 基因页、组织页、单细胞页 | 细胞系名、抗体号、IntAct/OpenCell 等库名 |
| miRBase | 首页与 hairpin 页 | miRNA 名、序列、accession、作者 |
| Ensembl | 基因页、变异页、404 页 | 转录本/蛋白 ID、HGNC 号、EMBL-EBI、Europe PMC |
| UniProt | 条目页（含 tbody[translate=no] 内的按钮） | accession、蛋白名、物种学名、文献信息 |
| RCSB PDB | 检索页、条目页、下载面板、facet | PDB ID、配体名、作者、物种学名、方法缩写组合 |
| GTEx | 门户首页、基因页、外显子面板、细胞类型 | GTEx/eQTL/IGV/HuBMAP/PCA 等品牌缩写、TPM、数学轴标签 |
| GDC | 项目页、仓库页、分析页 | UUID、TCGA 条码、JSON/TSV/API |
| cBioPortal | 首页、数据集页、研究页、结果页、图表图例 | 研究名（数据集）、癌种缩写（NOS 之外的 BRCA 等）、OncoPrint |
| GEPIA2 | 首页与表单 | 工具名、TCGA 缩写、实验室名 |
| UALCAN | 首页与表单 | 癌种缩写、PMID |
| TIMER2.0 / 3.0 | 首页与表单 | 去卷积工具名（CIBERSORT、EPIC 等）、邮箱 |
| PubMed 帮助中心 | FAQ / 检索语法 / 附录整页 | 示例检索式、字段标签本身 |

## 引擎层面已解决的坑（回归测试覆盖）

- 半翻节点的 NOS 图例（mixed + repair 通道）：tests/mixed.test.mjs、tests/nos.test.mjs。
- 时间冒号不被全角化：tests/time-colon.test.mjs。
- 站点 skip 对属性通道同样生效：tests/site-skip.test.mjs。
- 整块 skip 与细粒度 skip（cBio headBlock）：tests/site-r10.test.mjs。
- 标题翻译的命中记账与回滚：tests/title-stats.test.mjs。

## 复测方法

```bash
node tools/miss-report.mjs <siteId> <url>   # 生成 research/miss-<siteId>.json
node tools/aclass.mjs <siteId>              # 词库有、页面没翻（A 类缺口）
node tools/scope-check.mjs <siteId> <url>   # scope 选择器 0 命中告警
```

需要 CDP 9227 上的浏览器（agent 用 `~/.dsh/agent-browser/start-neo-wayland.sh`）。
