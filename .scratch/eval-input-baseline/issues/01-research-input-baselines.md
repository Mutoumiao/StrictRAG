# 01 · 研究：三条输入基线的现状面（库内对账可达性 / 题源差异影响面 / 三键消费方与历史行）

Type: research
Status: claimed
Parent: ../map.md

## Question

把本图三条判据线各自的**现状面**核清，落到能做裁定的粒度：

1. **账本 ↔ 库内文档存在性**：`documents` 表在 api 侧与 worker 侧分别有哪些现成读取入口（按 `id` 批量取、按 `kbId` 列、是否已滤租户）；账本条目里的 `title` 与库里 `title` 的口径是否可比（入库 CLI 写账本时怎么取的标题）；「存在但标题/来源漂移」与「不存在」是否要分成两种信号；两侧同时加对账的**回归面**有多少（哪些既有测例会打红，列文件与 it 名）。
2. **两条入口的题源差异**：api CLI 读 `fixtures/l1/gold.yaml`、worker 读 DB `gold_questions` 的**真实差异面** —— 两侧题集字段（`caseKey` / `type` / `expectedDocIds` / 题干）各是什么、`gold_questions` 由谁写入（是否有文件 → DB 的现成灌题入口）、两侧题集在今天的默认数据下**条目数与内容**是否已经不同、`l1QuestionIdsHash` 这类哈希在报告里到底锚住哪一侧；「两侧题集不同」若变成信号，今天有哪个字段/位置可以承载它（`reportJson` 顶层？`signoff` 快照？）。
3. **映射来源三键的形状定案依据**：`EvalRunSchema` 三键的全部**消费方**（admin / web / DTO / 测试）；`eval_runs` 表里**历史行**的实际规模（能否真查：本机 Docker 可用，但若无真库则以「迁移文件 + 代码侧写入点」推断，并写明未核）；把三键收紧为必填的**真实代价**（历史行 parse 失败会打到哪个路径）。

**判据**：每一条结论都要能指到源码路径（行号写在工单里，不写进 module-status）。未核实项必须显式标「未核实」，不许用「大概 / 应该」。

## Answer

（待研究子代理回填）

## Comments
