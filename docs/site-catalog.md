# 生物学与医学常用网站总览

> 统计范围：早前整理的 7 份生物信息学学习文档（剪接预测工具、生物设计与模拟软件、工具学习指南、数据库参考两份、BioArchLinux、R 包教程）。
> 标记：`文中` = 7 份文档里已出现；`补充` = 文档未提、按生信/医学科研常用度补入；`PPT` = 学习通课程 PPT 里出现、前两类都没有（核对记录见文末附录）。
> 合计 **205** 个网站：文中 52 个、补充 134 个、课程 PPT 19 个。链接可访问性于 2026-11-16 实测（403/429 多为防火墙或反爬，正常浏览器可打开）。

## 目录

1. 文献检索与论文全文（论文网站）（25）
2. 核酸序列与基因组综合库（11）
3. 变异与临床遗传解读（16）
4. 剪接预测专题（文档 1 的主题，附补充）（10）
5. 蛋白质、结构与相互作用（23）
6. 通路与功能注释（7）
7. 基因、疾病与药物数据库（12）
8. 组学数据与表达谱（13）
9. 肿瘤生信分析平台（14）
10. 序列分析、引物设计与克隆工具（在线）（17）
11. 生信分析平台、流程与可视化（20）
12. 临床试验与监管信息（7）
13. 科研绘图与生物系统建模（6）
14. 学习平台、社区与题库（11）
15. 中文资源与医学资讯（6）
16. RNA 分析专题（二级结构、miRNA 靶标、非编码 RNA）（7）

## 一、文献检索与论文全文（论文网站）

| 网站 | 地址 | 用途 | 来源 |
|---|---|---|---|
| PubMed | https://pubmed.ncbi.nlm.nih.gov/ | NCBI 生物医学文献检索，主流入口，可查 PMID/摘要 | 文中 |
| DOI 解析 | https://doi.org/ | 用 DOI 直达论文出版页，所有引用格式里都出现 | 文中 |
| PubMed Central (PMC) | https://www.ncbi.nlm.nih.gov/pmc/ | 开放获取全文库，bioRxiv 预印本与基金资助论文多在此归档 | 补充 |
| Europe PMC | https://europepmc.org/ | 欧洲版 PubMed，检索式更强，含预印本与专利 | 补充 |
| bioRxiv | https://www.biorxiv.org/ | 生物学预印本（未同行评审），新方法常先发这里 | 补充 |
| medRxiv | https://www.medrxiv.org/ | 医学与临床预印本 | 补充 |
| arXiv q-bio | https://arxiv.org/list/q-bio/recent | 计算生物学/生物物理预印本（生物信息算法类） | 补充 |
| Semantic Scholar | https://www.semanticscholar.org/ | AI 辅助文献检索，可看引用上下文与影响力 | 补充 |
| OpenAlex | https://openalex.org/ | 开放学术元数据，批量抓文献/作者/机构用 | 补充 |
| Crossref | https://www.crossref.org/ | DOI 注册机构，元数据查询，Zotero 元数据来源 | 补充 |
| Unpaywall | https://unpaywall.org/ | 查某篇论文有无合法免费全文（配合 DOI） | 补充 |
| Google Scholar | https://scholar.google.com/ | 跨库检索，引用计数与“被引”追踪；国内需代理 | 补充 |
| ResearchGate | https://www.researchgate.net/ | 作者主页与全文索取，临床/生物医学较活跃 | 补充 |
| Web of Science | https://www.webofscience.com/ | SCI 核心合集，影响因子与引文分析（机构订阅） | 补充 |
| Scopus | https://www.scopus.com/ | Elsevier 文摘库，作者/机构计量分析（机构订阅） | 补充 |
| Dimensions | https://app.dimensions.ai/ | 文献+基金+专利+临床试验一体化检索，免费版够用 | 补充 |
| Lens.org | https://www.lens.org/ | 论文与专利联合检索，做靶点/药物专利调研用 | 补充 |
| 中国知网 CNKI | https://www.cnki.net/ | 中文期刊/学位论文主力库 | 补充 |
| 万方数据 | https://www.wanfangdata.com.cn/ | 中文期刊/学位论文/会议，与知网互补 | 补充 |
| 维普 | http://www.cqvip.com/ | 中文科技期刊库 | 补充 |
| 百度学术 | https://xueshu.baidu.com/ | 中文文献聚合，查被引与免费全文入口方便 | 补充 |
| Zotero | https://www.zotero.org/ | 开源文献管理，浏览器插件一键抓元数据+PDF | 补充 |
| EndNote | https://endnote.com/ | 商业文献管理，Web of Science 生态 | 补充 |
| Mendeley | https://www.mendeley.com/ | 文献管理与 PDF 标注（Elsevier 出品） | 补充 |
| ORCID | https://orcid.org/ | 研究者唯一 ID，投稿/基金申请必备 | 补充 |

## 二、核酸序列与基因组综合库

| 网站 | 地址 | 用途 | 来源 |
|---|---|---|---|
| NCBI | https://www.ncbi.nlm.nih.gov/ | 美国国家生物技术信息中心，下属 GenBank/PubMed/BLAST 等全家桶入口 | 文中 |
| Ensembl | https://www.ensembl.org/ | 脊椎动物基因组浏览器与注释（人/小鼠等），REST API 好用 | 文中 |
| UCSC Genome Browser | https://genome.ucsc.edu/ | 基因组浏览器老牌代表，表型/保守性/多组学轨道全 | 文中 |
| GenBank | https://www.ncbi.nlm.nih.gov/genbank/ | 核酸序列公共库（INSDC 成员） | 补充 |
| RefSeq | https://www.ncbi.nlm.nih.gov/refseq/ | NCBI 人工审校的参考序列集，注释与转录本更可靠 | 补充 |
| ENA (EBI) | https://www.ebi.ac.uk/ena | 欧洲核酸归档，原始测序数据另一入口 | 补充 |
| DDBJ | https://www.ddbj.nig.ac.jp/ | 日本核酸数据库，INSDC 第三成员 | 补充 |
| 国家生物信息中心 NGDC | https://ngdc.cncb.ac.cn/ | 中科院北京基因组所，GSA 数据归档、GVM 变异库等，国内上传数据用 | 补充 |
| 国家基因库 CNGB | https://db.cngb.org/ | 深圳国家基因库，生命大数据平台 | 补充 |
| NCBI Genome Data Viewer (GDV) | https://www.ncbi.nlm.nih.gov/gdv/ | 在基因组坐标上逐碱基浏览 NCBI 注释（含多物种），课程第 7 章基因组数据库的主演示界面 | PPT |
| NCBI ORFfinder | https://www.ncbi.nlm.nih.gov/orffinder/ | 按指定密码子表找开放阅读框（ORF），课程第 4 章序列分析实操用 | PPT |

## 三、变异与临床遗传解读

| 网站 | 地址 | 用途 | 来源 |
|---|---|---|---|
| ClinVar | https://www.ncbi.nlm.nih.gov/clinvar/ | 变异-疾病关系与临床意义分级（致病/可能致病等），变异解读第一步 | 文中 |
| OMIM | https://www.omim.org/ | 人类孟德尔遗传在线，基因-表型-疾病条目（部分需订阅） | 文中 |
| dbSNP | https://www.ncbi.nlm.nih.gov/snp/ | 短遗传变异公共目录，rsID 来源 | 文中 |
| gnomAD | https://gnomad.broadinstitute.org/ | 大规模人群等位基因频率，判断罕见/常见的关键依据 | 文中 |
| ClinGen | https://clinicalgenome.org/ | 基因-疾病有效性、剂量敏感性专家共识（ACMG 配套） | 补充 |
| LOVD | https://www.lovd.nl/ | 基因座特异变异数据库集合（LSDB） | 补充 |
| DECIPHER | https://www.deciphergenomics.org/ | CNV/微缺失微重复与表型匹配，临床阵列解读常用 | 补充 |
| HGMD | https://www.hgmd.cf.ac.uk/ | 人类基因突变数据库（商业订阅），文献收录全 | 补充 |
| COSMIC | https://cancer.sanger.ac.uk/cosmic | 体细胞突变/肿瘤驱动基因库，做癌种突变频率必查 | 补充 |
| VarSome | https://varsome.com/ | 一站式变异注释+ACMG 自动分级（有免费额度） | 补充 |
| Franklin (Genoox) | https://franklin.genoox.com/ | 临床级变异解读与 ACMG 报告生成 | 补充 |
| MutationTaster | https://www.mutationtaster.org/ | 错义/剪接变异致病性预测（含剪接位点效应） | 补充 |
| SIFT | https://sift.bii.a-star.edu.sg/ | 基于保守性的氨基酸替换有害性预测 | 补充 |
| PolyPhen-2 | http://genetics.bwh.harvard.edu/pph2/ | 结构+进化信息预测错义变异影响 | 补充 |
| CADD | https://cadd.gs.washington.edu/ | 整合型有害性打分（CADD-PHRED），全基因组变异排序 | 补充 |
| ClinVar 变异查看器（NCBI Variation Viewer） | https://www.ncbi.nlm.nih.gov/variation/view/ | 在基因组坐标上叠加 dbSNP/ClinVar 记录 | 补充 |

## 四、剪接预测专题（文档 1 的主题，附补充）

> 文档《剪接预测工具详细说明》覆盖的工具，各工具的推荐替代/补充列在末尾

| 网站 | 地址 | 用途 | 来源 |
|---|---|---|---|
| ESEfinder 3.0 | https://esefinder.ahc.umn.edu/cgi-bin/tools/ESE3/esefinder.cgi | 外显子剪接增强子（ESE）预测，SR 蛋白结合位点评分；原站已下线，用明尼苏达镜像 | 文中 |
| GeneBe MaxEntScan | https://genebe.net | MaxEntScan 可视化在线版（原 Burge 实验室页面已下线） | 文中 |
| Kipoi MaxEntScan 模型 | https://kipoi.org/models/MaxEntScan/ | MaxEntScan 的 Kipoi 模型封装，可脚本批量跑 | 文中 |
| BDGP NNSPLICE | https://www.fruitfly.org/seq_tools/splice.html | 经典剪接位点预测，BDGP 已于 2026-01-01 停运，建议自托管 GitHub 版本 | 文中 |
| SpliceAid-F | http://srv00.recas.ba.infn.it/SpliceAidF/ | 实验验证的 RBP/ESE/ESS 结合位点知识库 | 文中 |
| RBPmap | https://rbpmap.technion.ac.il/ | RNA 结合蛋白结合位点预测（文档标注可能无法访问） | 文中 |
| CISBP-RNA | http://cisbp-rna.ccbr.utoronto.ca/ | RBP 基序数据库，RBPmap 的基序来源 | 文中 |
| bio.tools | https://bio.tools/ | 生信工具注册库，按功能查替代工具（如查 SpliceAid2 条目） | 文中 |
| SpliceAI | https://spliceailookup.broadinstitute.org/ | Illumina 深度学习剪接预测，现为变异注释事实标准之一 | 补充 |
| Human Splicing Finder | https://hsf.genomnis.com/ | 综合剪接位点/ESE/ESS 预测套件（HSF 3.1） | 补充 |

## 五、蛋白质、结构与相互作用

| 网站 | 地址 | 用途 | 来源 |
|---|---|---|---|
| UniProt | https://www.uniprot.org/ | 蛋白序列与功能注释权威库（Swiss-Prot/TrEMBL） | 文中 |
| SWISS-MODEL | https://swissmodel.expasy.org/ | 同源建模服务器，给序列出三维结构 | 文中 |
| Human Protein Atlas (HPA) | https://www.proteinatlas.org/ | 人蛋白表达图谱：组织/细胞/单细胞/病理图谱+抗体数据 | 文中 |
| PDB (RCSB) | https://www.rcsb.org/ | 实验解析的蛋白/核酸三维结构总库，结构文件下载起点 | 补充 |
| PDBsum | https://www.ebi.ac.uk/thornton-srv/databases/pdbsum/ | 结构摘要与相互作用示意，快速看懂一个 PDB 条目 | 补充 |
| InterPro / Pfam | https://www.ebi.ac.uk/interpro/ | 蛋白家族与结构域注释，Pfam 已并入 | 补充 |
| PROSITE | https://prosite.expasy.org/ | 功能位点/模式（motif）数据库 | 补充 |
| STRING | https://string-db.org/ | 蛋白-蛋白相互作用网络，做 PPI 图与富集 | 补充 |
| BioGRID | https://thebiogrid.org/ | 实验证据的 PPI 与遗传互作库，可下载交互组 | 补充 |
| IntAct | https://www.ebi.ac.uk/intact/ | 分子相互作用数据库（EBI） | 补充 |
| PhosphoSitePlus | https://www.phosphosite.org/ | 磷酸化等翻译后修饰位点库 | 补充 |
| AlphaFold DB | https://alphafold.ebi.ac.uk/ | 预测蛋白结构库，按 UniProt 条目查现成模型 | 文中 |
| Mol* | https://molstar.org/ | 网页端大分子可视化（PDB 官方查看器内核），可嵌入网页 | 补充 |
| ChimeraX | https://www.cgl.ucsf.edu/chimerax/ | 结构可视化与建模（Chimera 后继），比 PyMOL 免费友好 | 补充 |
| VMD | https://www.ks.uiuc.edu/Research/vmd/ | 分子动力学轨迹可视化与分析 | 补充 |
| PyMOL | https://pymol.org/ | 老牌分子可视化，出发表级结构图 | 文中 |
| NGL Viewer | https://nglviewer.org/ | 浏览器内 3D 结构查看与分享，无需安装 | 文中 |
| Avogadro | https://avogadro.cc/ | 小分子三维构建与编辑 | 文中 |
| Rosetta Commons | https://www.rosettacommons.org/ | 蛋白结构预测/设计/对接套件 | 文中 |
| Coot | https://www2.mrc-lmb.cam.ac.uk/personal/pemsley/coot/ | 晶体学电子密度图下手动建模 | 文中 |
| DeProteo | https://devpost.com/software/deproteo | LLM+Diffusion 的蛋白设计框架（前沿项目，非成熟服务） | 文中 |
| ExPASy | https://www.expasy.org/ | SIB 蛋白分析门户，ProtParam/ProtScale/SWISS-MODEL 等工具的入口，课程第 5 章从这里进 | PPT |
| DTU Health Tech 服务器套件 | https://services.healthtech.dtu.dk/ | SignalP（信号肽）、TMHMM（跨膜区）、NetPhos（磷酸化位点）等在线预测，课程第 5 章用 | PPT |

## 六、通路与功能注释

| 网站 | 地址 | 用途 | 来源 |
|---|---|---|---|
| KEGG | https://www.genome.jp/kegg/ | 通路图与基因功能映射（部分功能改为订阅） | 补充 |
| Reactome | https://reactome.org/ | 人工审校的通路库，可下载 SBML/通路矩阵 | 补充 |
| WikiPathways | https://www.wikipathways.org/ | 社区维护通路，覆盖物种多 | 补充 |
| Gene Ontology | https://geneontology.org/ | GO 术语与注释文件（BP/MF/CC），富集分析底座 | 补充 |
| MSigDB | https://www.gsea-msigdb.org/gsea/msigdb | GSEA 官方基因集库（Hallmark/KEGG/Reactome 集合） | 补充 |
| PANTHER | http://www.pantherdb.org/ | 基因家族分类与富集分析 | 补充 |
| MetaCyc | https://metacyc.org/ | 代谢通路库，微生物/代谢组学常用 | 补充 |

## 七、基因、疾病与药物数据库

| 网站 | 地址 | 用途 | 来源 |
|---|---|---|---|
| GeneCards | https://www.genecards.org/ | 人类基因综合信息卡，一个基因的入口页 | 文中 |
| TTD | https://db.idrblab.net/ttd/ | 治疗靶点数据库，靶点-药物-适应症对应关系 | 文中 |
| MalaCards | https://www.malacards.org/ | 人类疾病综合卡（GeneCards 同厂），查病比查基因更贴临床 | 补充 |
| Orphanet | https://www.orpha.net/ | 罕见病与孤儿药权威目录（欧洲） | 补充 |
| HPO | https://hpo.jax.org/ | 人类表型标准术语（HPO 词表），表型驱动诊断与 Exomiser 必需 | 补充 |
| DrugBank | https://go.drugbank.com/ | 药物-靶点-机制综合库（学术版需申请） | 补充 |
| ChEMBL | https://www.ebi.ac.uk/chembl/ | 生物活性分子与靶点数据，做化合物筛选/构效分析 | 补充 |
| PubChem | https://pubchem.ncbi.nlm.nih.gov/ | 化合物结构与生物测定数据总库 | 补充 |
| PharmGKB | https://www.pharmgkb.org/ | 药物基因组学知识（基因-药物-剂量），CPIC 指南来源 | 补充 |
| DGIdb | https://www.dgidb.org/ | 药物-基因互作聚合，做候选靶点成药性评估 | 补充 |
| CTD | https://ctdbase.org/ | 化合物-基因-疾病关系库，毒理与环境暴露也收 | 补充 |
| DisGeNET | https://www.disgenet.org/ | 基因-疾病关联证据聚合（含评分） | 补充 |

## 八、组学数据与表达谱

| 网站 | 地址 | 用途 | 来源 |
|---|---|---|---|
| GEO | https://www.ncbi.nlm.nih.gov/geo/ | 基因表达/芯片/RNA-seq 数据集总库，找公开数据重分析第一站 | 补充 |
| SRA | https://www.ncbi.nlm.nih.gov/sra | 原始测序读段归档，配合 SRA Toolkit 下载 | 补充 |
| ArrayExpress / BioStudies | https://www.ebi.ac.uk/biostudies/arrayexpress | EBI 的功能基因组学数据归档 | 补充 |
| Expression Atlas | https://www.ebi.ac.uk/gxa/ | 已统一处理的差异表达结果，免自己跑流程 | 补充 |
| GTEx Portal | https://gtexportal.org/ | 正常组织 eQTL 与表达谱，做组织特异表达/孟德尔随机化常用 | 补充 |
| Human Cell Atlas | https://www.humancellatlas.org/ | 人类细胞图谱计划数据入口 | 补充 |
| Single Cell Portal | https://singlecell.broadinstitute.org/ | Broad 单细胞数据集浏览器 | 补充 |
| CZ CELLxGENE | https://cellxgene.cziscience.com/ | 单细胞数据统一格式浏览与在线分析 | 补充 |
| PanglaoDB | https://panglaodb.se/ | 单细胞标记基因与细胞类型速查 | 补充 |
| PRIDE | https://www.ebi.ac.uk/pride/ | 蛋白质组学原始数据与鉴定结果归档 | 补充 |
| MetaboLights | https://www.ebi.ac.uk/metabolights/ | 代谢组学数据归档 | 补充 |
| dbGaP | https://www.ncbi.nlm.nih.gov/gap/ | 受控访问的人类基因型-表型数据（需授权） | 补充 |
| EGA | https://ega-archive.org/ | 欧洲基因组-表型受控访问归档 | 补充 |

## 九、肿瘤生信分析平台

| 网站 | 地址 | 用途 | 来源 |
|---|---|---|---|
| TCGA | https://www.cancer.gov/ccg/research/genome-sequencing/tcga | 癌症基因组图谱计划主页，数据入口见 GDC | 文中 |
| GDC Data Portal | https://portal.gdc.cancer.gov/ | TCGA/CPTAC 数据下载与在线探索（含 API） | 文中 |
| cBioPortal | https://www.cbioportal.org/ | 肿瘤队列突变/拷贝数/表达可视化，无需下载数据 | 文中 |
| GEPIA2 | http://gepia2.cancer-pku.cn/ | TCGA+GTEx 表达与生存分析网页工具（北大团队） | 文中 |
| TIMER2.0 | http://timer.comp-genomics.org/ | 肿瘤免疫浸润分析（多种去卷积算法） | 文中 |
| UALCAN | https://ualcan.path.uab.edu/ | TCGA 表达与临床分期关联分析 | 文中 |
| LinkedOmics | https://www.linkedomics.org/ | TCGA 多组学关联分析（含激酶/ miRNA 靶标） | 文中 |
| TNMplot | https://tnmplot.com/ | 肿瘤 vs 正常组织的表达差异与箱线图速查 | 文中 |
| UCSC Xena | https://xenabrowser.net/ | 多队列组学数据统一浏览（TCGA/GTEx/CCLE） | 补充 |
| Kaplan-Meier Plotter | https://kmplot.com/ | 在线生存分析（乳腺癌/肺癌等），出 KM 曲线 | 补充 |
| SEER | https://seer.cancer.gov/ | 美国癌症登记统计，发病率/生存率流行病学数据 | 补充 |
| GLOBOCAN | https://gco.iarc.who.int/ | 全球癌症负担统计（IARC） | 补充 |
| IARC | https://www.iarc.who.int/ | 国际癌症研究机构，致癌物分类与癌症数据 | 补充 |
| TISCH | http://tisch.comp-genomics.org/ | 肿瘤免疫单细胞转录组可视化（TIMER 团队出品），课程文献里用到 | PPT |

## 十、序列分析、引物设计与克隆工具（在线）

| 网站 | 地址 | 用途 | 来源 |
|---|---|---|---|
| NCBI BLAST | https://blast.ncbi.nlm.nih.gov/Blast.cgi | 序列相似性搜索（blastn/blastp/tblastn 等） | 补充 |
| Primer-BLAST | https://www.ncbi.nlm.nih.gov/tools/primer-blast/ | 引物设计+特异性校验一步完成 | 补充 |
| Primer3Plus | https://www.primer3plus.com/ | Primer3 网页界面，参数可控的引物设计 | 补充 |
| IDT OligoAnalyzer | https://www.idtdna.com/pages/tools/oligoanalyzer | 引物/寡核苷酸 Tm、二级结构、二聚体检查 | 补充 |
| Benchling | https://www.benchling.com/ | 在线质粒图谱/序列编辑与实验记录（学术免费版） | 补充 |
| SnapGene | https://www.snapgene.com/ | 分子克隆设计与模拟（商业，学生版便宜） | 补充 |
| Addgene | https://www.addgene.org/ | 质粒库与载体图谱，查现成构建 | 补充 |
| Clustal Omega | https://www.ebi.ac.uk/jdispatcher/msa/clustalo | 多序列比对（EBI 在线） | 补充 |
| MAFFT | https://mafft.cbrc.jp/alignment/server/ | 多序列比对，长序列/大量序列更稳 | 补充 |
| MUSCLE | https://www.ebi.ac.uk/jdispatcher/msa/muscle | 快速多序列比对 | 补充 |
| T-Coffee | https://www.ebi.ac.uk/Tools/msa/tcoffee/ | 一致性比对（慢但准），EBI 在线版 | 补充 |
| iTOL | https://itol.embl.de/ | 进化树在线美化与注释，出发表级树图 | 补充 |
| IQ-TREE | http://www.iqtree.org/ | 最大似然建树（网页服务 + 本地命令行） | 补充 |
| EMBOSS | https://www.ebi.ac.uk/Tools/emboss/ | 经典序列分析工具集网页版（翻译/ORF/限制酶等） | 补充 |
| JASPAR | https://jaspar.elixir.no/ | 转录因子结合位点（PFM/PWM）矩阵库，找启动子调控元件用，课程第 4 章讲到 | PPT |
| VectorBee | https://www.vectorbee.com/en/ | 在线质粒图谱查看/克隆设计（轻量版 Benchling），课程第 4 章演示 | PPT |
| MEGA | https://www.megasoftware.net/ | 图形化多序列比对与系统发生树构建（NJ/ML），课程第 3 章用 MEGA7 演示 | PPT |

## 十一、生信分析平台、流程与可视化

| 网站 | 地址 | 用途 | 来源 |
|---|---|---|---|
| Galaxy Project | https://galaxyproject.org/ | 图形化生信分析平台，无需编程跑常见流程 | 文中 |
| Bioconductor | https://www.bioconductor.org/ | R 生信包集合（DESeq2/limma/clusterProfiler 等都在此） | 文中 |
| BioArchLinux | https://bioarchlinux.org/ | 面向生信的 Arch 第三方软件仓库（pacman 装 BLAST/samtools 等） | 文中 |
| Kipoi | https://kipoi.org/ | 基因组学深度学习模型库（含剪接/转录因子模型） | 文中 |
| Metascape | https://metascape.org/ | 富集分析+通路+PPI 一站式网页工具 | 补充 |
| DAVID | https://david.ncifcrf.gov/ | 经典功能富集工具（当日实测超时，需代理或换 Metascape） | 补充 |
| Enrichr | https://maayanlab.cloud/Enrichr/ | 最易用的在线富集（基因集库多、出图快） | 补充 |
| GSEA | https://www.gsea-msigdb.org/gsea/ | 基因集富集分析官方站（含桌面软件下载） | 补充 |
| GEO2R | https://www.ncbi.nlm.nih.gov/geo/geo2r/ | 直接在 GEO 页面上做差异表达分析 | 补充 |
| NetworkAnalyst | https://www.networkanalyst.ca/ | 表达数据→网络→富集的可视化流水线 | 补充 |
| Bioconda | https://bioconda.github.io/ | conda 生信软件频道（装工具的事实标准） | 补充 |
| Cytoscape | https://cytoscape.org/ | 网络分析与可视化（PPI/通路图出图） | 补充 |
| ImageJ / Fiji | https://imagej.net/ | 显微图像定量分析（细胞计数、荧光强度） | 补充 |
| IGV | https://igv.org/ | 基因组浏览器桌面版/网页版，看 BAM/VCF 必备 | 补充 |
| TBtools | https://github.com/CJ-Chen/TBtools-II | 国产生信小工具合集（序列处理/热图/GO 富集），点鼠标就行 | 补充 |
| Galaxy 主站 (usegalaxy.org) | https://usegalaxy.org/ | Galaxy 官方公共服务器，注册即用（有配额），课程第 9 章测序实战在此跑 | PPT |
| Galaxy 中国站 (usegalaxy.cn) | https://usegalaxy.cn/ | 国内镜像（中科院体系），免代理、速度快，课程 PPT 推荐入口 | PPT |
| FastQC | https://www.bioinformatics.babraham.ac.uk/projects/fastqc/ | 测序原始数据质量评估，命令行+GUI 都有，课程第 9 章质控第一步 | PPT |
| Chipster | https://chipster.csc.fi/ | 芬兰 CSC 的图形化分析平台（RNA-seq/变异），课程 PPT 提到且集成 FastQC | PPT |
| PRINSEQ | http://prinseq.sourceforge.net/ | 测序数据过滤与统计（web + 命令行），课程第 9 章过滤用 | PPT |

## 十二、临床试验与监管信息

| 网站 | 地址 | 用途 | 来源 |
|---|---|---|---|
| ClinicalTrials.gov | https://clinicaltrials.gov/ | 全球临床试验注册库（美国） | 补充 |
| 中国临床试验注册中心 ChiCTR | http://www.chictr.org.cn/ | 中国临床试验注册（WHO ICTRP 一级注册机构） | 补充 |
| WHO ICTRP | https://www.who.int/clinical-trials-registry-platform | 世卫组织临床试验注册平台，一次搜多国注册库 | 补充 |
| FDA | https://www.fda.gov/ | 美国药监，药品/器械审批与指南 | 补充 |
| EMA | https://www.ema.europa.eu/ | 欧洲药监局，审批文件（EPAR）公开度高 | 补充 |
| NMPA | https://www.nmpa.gov.cn/ | 国家药监局，国内药品/器械审批 | 补充 |
| CDE 药审中心 | https://www.cde.org.cn/ | 药品审评中心，受理与审评信息公开 | 补充 |

## 十三、科研绘图与生物系统建模

| 网站 | 地址 | 用途 | 来源 |
|---|---|---|---|
| BioRender | https://www.biorender.com/ | 科研示意图/机制图在线绘制（有免费模板额度） | 文中 |
| Blender | https://www.blender.org/ | 三维建模与渲染，做分子/细胞动画 | 文中 |
| CellOrganizer | https://cellorganizer.org/ | 从显微图像学习并生成细胞/细胞器模型 | 文中 |
| CompuCell3D | https://compucell3d.org/ | 多细胞/组织尺度模拟（格点模型） | 文中 |
| PhysiCell | http://physicell.org/ | agent-based 多细胞仿真框架 | 文中 |
| Venn 在线绘制（UGent webtools） | https://bioinformatics.psb.ugent.be/webtools/Venn/ | 基因集韦恩图在线出图，课程第 10 章数据呈现用（原址 2026-11-16 实测 404，备选见下方备注） | PPT |

## 十四、学习平台、社区与题库

| 网站 | 地址 | 用途 | 来源 |
|---|---|---|---|
| EMBL-EBI Training | https://www.ebi.ac.uk/training/ | EBI 官方在线课程与网络研讨会，免费 | 文中 |
| Coursera | https://www.coursera.org/ | UCSD 生物信息学专项等系统课程 | 文中 |
| R-exercises | https://www.r-exercises.com/ | R 练习题（文档推荐的刷题站） | 文中 |
| Swirl | https://swirlstats.com/ | 在 R 控制台里交互式学 R | 文中 |
| Play with Docker | https://labs.play-with-docker.com/ | 浏览器里练 Docker，无需本地装 | 文中 |
| LeetCode 中文站 | https://leetcode.cn/ | 算法刷题（文档讨论过它与生信的关系：练代码不是练生信） | 文中 |
| Rosalind | https://rosalind.info/ | 生信专属编程题库——可以理解为“生信的 LeetCode”，按难度递进 | 补充 |
| Biostars | https://www.biostars.org/ | 生信问答社区，报错和流程问题多半有人踩过 | 补充 |
| SEQanswers | http://seqanswers.com/ | 测序技术/实验设计的英文论坛 | 补充 |
| Galaxy Training Network | https://training.galaxyproject.org/ | GTN 教程库，覆盖 RNA-seq/变异/单细胞全流程 | 补充 |
| edX | https://www.edx.org/ | 大学课程平台（哈佛/ MIT 生物统计等） | 补充 |

## 十五、中文资源与医学资讯

| 网站 | 地址 | 用途 | 来源 |
|---|---|---|---|
| 丁香园 | https://www.dxy.cn/ | 临床医学社区，病例与指南讨论 | 补充 |
| 梅斯医学 MedSci | https://www.medsci.cn/ | 医学资讯、指南解读与科研工具 | 补充 |
| 生物谷 Bioon | https://www.bioon.com/ | 生物医药行业资讯与会议 | 补充 |
| 小木虫 | http://muchong.com/ | 科研经验/投稿/实验求助论坛 | 补充 |
| 科学网 | https://www.sciencenet.cn/ | 科研博客与学术动态 | 补充 |
| 生信之家 (plob.org) | https://www.plob.org/ | 中文生信教程与工具用法文章站，课程第 5 章给过文章链接 | PPT |

## 十六、RNA 分析专题（二级结构、miRNA 靶标、非编码 RNA）

> 课程第 6 章「RNA 分析」相关内容，原表未单列，本次补入

| 网站 | 地址 | 用途 | 来源 |
|---|---|---|---|
| miRBase | https://www.mirbase.org/ | miRNA 序列与命名权威库（miR-xxx 编号来源），课程第 6 章用 | PPT |
| TargetScan | https://www.targetscan.org/vert_80/ | miRNA 靶基因预测（保守位点法），课程 microRNA 实操示例用 | PPT |
| NONCODE | http://www.noncode.org/ | 非编码 RNA 综合库（39 个物种），课程第 4/6 章讲 lncRNA 时提到 | PPT |
| miRAlign | http://bioinfo.au.tsinghua.edu.cn/miralign/ | 清华的 miRNA 比对/注释工具，课程实操示例里的入口（2026-11-16 实测无法访问，已停服） | PPT |
| ViennaRNA / RNAfold | https://www.tbi.univie.ac.at/RNA/ | RNA 二级结构最小自由能预测（RNAfold 网页版），RNAstructure 同类的经典选择 | 补充 |
| mfold / UNAFold | http://unafold.rna.albany.edu/?q=mfold | 最老的 RNA 折叠网页服务器，可出结构图，课程文献对比过它的准确率 | 补充 |
| RNAstructure | https://rna.urmc.rochester.edu/RNAstructure.html | Mathews 实验室的折叠与结构分析套件（Windows/Linux） | 补充 |

## 附：学习通课程 PPT 核对结果（2026-11-16 补）

> 核对对象：课程资料包中的 37 个 PDF（第 1、3、4、5、6、7、8、9、10 章）。共出现 44 个不同域名。

### A. 课程提到、原表没有的站点（本次新增 22 条）

| 网站 | 出现在课程哪一章 | 处理 |
|---|---|---|
| NCBI GDV | 第 7 章 基因组数据库（出现 45 次，是主演示界面） | 已补入 |
| NCBI ORFfinder | 第 4 章 序列分析 | 已补入 |
| ExPASy | 第 5 章 蛋白质序列分析 | 已补入 |
| DTU Health Tech（SignalP/TMHMM/NetPhos） | 第 5 章 | 已补入 |
| JASPAR | 第 4 章 序列比对与结构预测 | 已补入 |
| VectorBee | 第 4 章 | 已补入 |
| MEGA | 第 3 章 建树（MEGA7 演示） | 已补入 |
| usegalaxy.org | 第 9 章 测序数据实战 | 已补入 |
| usegalaxy.cn（Galaxy 中国站） | 第 4 章 非编码 RNA 分析 | 已补入 |
| FastQC | 第 9 章 测序结果分析 | 已补入 |
| Chipster | 第 9 章 | 已补入 |
| PRINSEQ | 第 9 章 | 已补入 |
| TISCH | 第 8/10 章文献 | 已补入 |
| PSB-UGent Venn 工具 | 第 10 章 数据呈现 | 已补入（原址 404，见 B） |
| miRBase | 第 6 章 microRNA | 已补入 |
| TargetScan | 第 6 章 microRNA 实操 | 已补入 |
| NONCODE | 第 6 章非编码 RNA | 已补入 |
| miRAlign（清华） | 第 6 章 microRNA 实操 | 已补入并标注停服 |
| 生信之家 plob.org | 第 5 章给的文章链接 | 已补入 |
| ViennaRNA / mfold / RNAstructure | 第 6 章扩展阅读（综述 PDF） | 已补入（来源记为“补充”） |
| Ensembl Blog (ensembl.info) | 第 4 章引用过 2011 年一篇博文 | 不单列，正文已给 ensembl.org |

### B. 课程里已失效/不可达的链接（2026-11-16 实测）

| 链接 | 状态 | 替代 |
|---|---|---|
| http://bioinfo.au.tsinghua.edu.cn/miralign/ | 无法访问（连不上） | TargetScan / miRBase 查靶标，或 ENCORI(starBase) |
| http://bioinformatics.psb.ugent.be/webtools/Venn/ | 404（站点改版） | 韦恩图改用 jvenn (http://jvenn.toulouse.inrae.fr/app/index.html) 或 Venny 2.1 (https://bioinfogp.cnb.csic.es/tools/venny/) |
| https://rna.tbi.univie.ac.at/（RNAfold 网页版） | 超时不可达 | 用 https://www.tbi.univie.ac.at/RNA/ 或本地 ViennaRNA 包 |

### C. 课程提到且原表已有的站点（核对通过）

NCBI、Ensembl、UCSC Genome Browser、GEO、GEO2R、cBioPortal、TCGA、DAVID、PANTHER、Metascape、STRING、Cytoscape、HPA、UALCAN、KM Plotter、PubChem、RCSB PDB、Bioconductor、Galaxy、KEGG、GO、BLAST、Enrichr、doi.org、CNKI。
## 附：文中提到但已失效/受限的站点

| 站点 | 原地址 | 状态 | 替代 |
|---|---|---|---|
| ESEfinder 原站 | http://exon.cshl.edu/ESE/ | 已下线 | 明尼苏达镜像（见第四节） |
| MaxEntScan 原站 | http://genes.mit.edu/burgelab/maxent/Xmaxentscan_scoreseq.html | 已下线 | GeneBe 在线版 / Kipoi 模型 / GitHub(Congenica) |
| BDGP NNSPLICE | https://www.fruitfly.org/seq_tools/splice.html | 2026-01-01 停运，站点将下线 | 自托管 github.com/bdgp/bdgp-splice-promoter-tools |
| RBPmap | https://rbpmap.technion.ac.il/ | 可能无法访问 | CISBP-RNA 基序 + 本地软件 |
| DAVID | https://david.ncifcrf.gov/ | 2026-11-16 实测超时（需代理） | Metascape / Enrichr |

## 附：文档里提到但不属于“网站”的工具（不单列链接）

ClustalX2、BioEdit、Lasergene (DNASTAR)、GeneForge、ESSkip、Minigene 报告系统 —— 属本地软件或需自建环境，入口见对应文档。

## 附：未收录说明

全文下载类灰色渠道（Sci-Hub 等）不在本表；需要合法获取全文时优先 PubMed Central / Unpaywall / 机构订阅。
