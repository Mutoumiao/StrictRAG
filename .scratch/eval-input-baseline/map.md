# 让评测跑批的输入事实基线在两条入口上同一且可检测

Label: wayfinder:map
Status: resolved（前沿：空；工单 01 · 02 · 03 · 04 · 05 · 06 全收口）

## Destination

把评测跑批（L1 黄金集）的**输入**拉回到同一条事实基线上，让「两条入口跑的到底是不是同一件事」从**默认可分歧**变成**可检测**。到达时同时满足三件：

1. **账本 ↔ 库内文档存在性可检测**：账本每条 `logicalId → docId` 在跑批前与当前 KB 的 `documents` 对账；账本指向**已不存在**的文档（或标题漂移）时**响亮失败**，不再静默产生一批假 miss。落点在共享层（contracts 子路径），两条入口**一起接**，不许单侧加一道新的不对称。
2. **两条入口的题源差异被裁定并落地**：今天 api CLI 读文件 `fixtures/l1/gold.yaml`、worker 队列读 DB 表 `gold_questions` —— 两侧的**题集可以不同**，而报告与门禁都只说「Hit@k」。裁定「以谁为准」，并把「两侧题集不同」变成**可检测信号**（或收敛到单一题源）。
3. **报告/契约的映射来源三键定案**：`EvalRunSchema` 的 `docMapSource` / `docMapResolved` / `docMapUnmappedIds` 今天为**可选**（为兼容历史行）。裁定「收紧为必填并回填」或「明示保持可选并写明理由」，不留模糊。

三者是同一件事的三面：**跑批的输入必须是可核对的事实**。**不**改任何门限数字、不改判定公式、不改 `prds/00–11`、不放宽或收紧任何仓库默认开关、不代签。

## Notes

- 域：StrictRAG。**WHAT** 冲突以 `prds/00–11`（当前 0.4.33 编排 / 0.4.32 语义）为准；**IS 以源码为准**，`docs/module-status/` 是它的镜像，`docs/testing/coverage/` 是派生对照表。
- **前图**：[`eval-ledger-parity`](../eval-ledger-parity/map.md)（6/6 已收口，前沿为空）。本图挑的是它 `Not yet specified` **A 段三条**（同一数据工程缺口的其它表现）。前图把「同一个数字在两处含义不同」销掉；本图销的是「**同一个数字底下是不是同一份输入**」。
- **本图立的判据线**：`hitAtK` 这个数字要可信，前提是**输入侧**先可信 —— 账本指向的文档真在库里、两条入口跑的是同一题集。输入不可检时，数字「看起来正常」本身就是坑（结构性假零 / 结构性假高）。
- **每轮先读**：本图 · `docs/agents/issue-tracker.md` · `docs/agents/domain.md` · `prds/08-quality/02-evaluation-and-gates.md` §3 / §6 · `packages/contracts/src/eval/corpus-ledger.ts` · `packages/contracts/src/eval/corpus-ledger-file.ts` · `packages/contracts/src/eval/eval-run.contract.ts` · `apps/api/src/scripts/{run-l1-golden,ingest-eval-corpus}.ts` · `apps/api/src/eval/corpus-map.ts` · `apps/worker/src/eval/{consumer,persist,run-l1-batch}.ts` · `docs/ops/{operable-stack,real-stack-evidence}.md`。写代码前读 `.trellis/spec/` 对应包（`api/backend/l1-eval.md` · `worker` 包 index · `packages/contracts` index）。
- **本图携带执行**：工单可直接改代码、补测例、回写镜像。同一缺口**禁止**再 `task.py create` 平行实现任务。
- **只在本分支（`main`）**：不建 worktree，不新建分支。
- **门禁**：每收一张工单跑 `pnpm check-types` + `pnpm lint`（零 warning）+ 相关包测试；收口跑全仓 `pnpm test --concurrency=1`（前图实测：并发抢 CPU 会让 web 包超时假红）。测例只进 `<包>/tests/<能力>/<意图>.test.ts(x)`，文件头「目标 / 需求 / 被测 / 简介」必须简体中文，并登记该包 `tests/index.md`。
- **不改仓库默认开关**：`AUTH_ENFORCE` / `DEPT_ACL_ENFORCE` / `DEPT_INHERIT_DOWN` / `RETRIEVE_ES_MODE` / `INGEST_ES_MODE` / `SESSION_REWRITE_ENABLED` / OCR 的默认值一律不动。
- **不改 `prds/00–11`**；**不改任何门限数字**（`PILOT_HARD_GATES` 六键一字不动）；**不动** `computeSignoffEligible` / `computeL2SignoffEligible` / `evaluateAdr046Bind` / `hitAtKCase` 本体。
- **本图特有的「不许」**：
  - **不许**把「账本对不上库」降级成「无账本」或「该门不适用」：对不上必须**响亮失败**（与 `CorpusLedgerError` 同族），两者混成一个出口 = 把一道新鲜的闸改常开。
  - **不许**在 worker 侧另写一套账本 / 对账逻辑 —— 复用 `@strict-rag/contracts/eval-corpus-ledger` 与 `eval-corpus-ledger-file` 子路径。
  - **不许**把「缺映射 / 未映射」变成 `null`（`hitAtK == null` 的语义是 PRD 的「有标注时」）。
  - **不许**改 `fixtures/` 的**数据文件**（两份 `README.md` 可改）。
  - **不许**做模糊 / 子串 / 前缀匹配 —— 只认账本里的精确 uuid。
- **写回纪律（前图教训）**：`docs/module-status/*.md` 正文**不写 `路径:行号`**，也不给裸标识符加反引号（会触发 `check:module-status` 的 `5-表` / `3-符号` 误报）；行号只写在 `.scratch/` 工单与 `.trellis/spec/` 里。
- **前图教训（三条必守）**：① 收口声明必须在**最后一次提交之后**复跑 `pnpm check:module-status`，且 `1-路径` / `6-联动` / `7-时效` 三类须为空；② 回写要带**对抗性反向复核**（逐条核「这话在源码里真能指到吗」）；③ 镜像/覆盖表里的加式必须**用脚本按行机械核**。
- **本机限制**：无浏览器 → admin / web 视觉改动不在本图；真模型 live 跑数 / 人签也不在。**Docker Desktop 在本机可用**（前两张图已验证真栈真跑），真跑要预留重启与重跑预算，故障那一跑**必须留痕**。

### 开工基线（2026-10-01 · 逐条核过源码）

| 处 | 今天的样子 |
|---|---|
| 账本契约 | `packages/contracts/src/eval/corpus-ledger.ts`：`CORPUS_LEDGER_VERSION = 1`；条目五键 `logicalId` / `docId` / `title` / `sourceFile` / `sourceSha256`；`parseCorpusLedger` 只机械校验形状 + 版号 + 指纹自洽，**不碰库** |
| 账本读取与新鲜度 | `packages/contracts/src/eval/corpus-ledger-file.ts`：`resolveCorpusLedgerForRun` 只校验 `kbId` 全等 ∧ `corpusFingerprint` 全等（对当前夹具重算），**不校验 docId 是否还在库**（文件头注释自陈「改由人工对账，裁定 4 显式划出」） |
| api 侧账本落点 | `apps/api/src/eval/corpus-map.ts` 是**纯 re-export**；CLI 侧解析点在 `apps/api/src/scripts/run-l1-golden.ts` |
| worker 侧账本落点 | `apps/worker/src/eval/consumer.ts` 的 `docMapPathOf` 判未设置，每次 job 重读；`run-l1-batch.ts` 在 `hitAtKCase` **之前**解析 |
| **题源（关键分歧）** | api CLI：`run-l1-golden.ts` 的 `defaultGoldPath()` → `fixtures/l1/gold.yaml`（文件）；worker 队列：`apps/worker/src/eval/consumer.ts` 的 `persist.loadGold(job.kbId)` → DB 表 `gold_questions`。**两侧题集可以不同，无任何检测** |
| worker 侧已有 DB 句柄 | `apps/worker/src/eval/persist.ts` 持 `getDb()` 并已 `loadGold` / `saveReport` —— 对账所需的库读**已在 worker 进程内** |
| api 侧已有 DB 句柄 | `run-l1-golden.ts` 已 `import { getDb } from '../services/db.js'` 并 `db.insert(evalRuns)` —— 「CLI 侧无 DB 读」的旧前提**已不成立**，两侧同时加对账可达 |
| 报告三键 | `DocMapSummary`（`ledger` / `none` + 计数 + 未映射 id 列表），`EvalRunSchema` 三键为**可选**（前图工单 04 为兼容历史行而降为可选） |
| 不变量 | 判定只在 api 侧；worker 侧批跑结果**不进任何判定**；`signoff_eligible` 是工程口径，非业务 PASS |

## Decisions so far

- [01 · 研究：三条输入基线的现状面](./issues/01-research-input-baselines.md) — 三个角色互斥的子代理并行核实（[01a 库内对账可达性](./research/01a-ledger-db-reachability.md) · [01b 题源差异](./research/01b-case-source-divergence.md) · [01c 三键消费面](./research/01c-docmap-keys-consumers.md)）。要点：**只查「存在」不够** —— 重跑入库会生成新 uuid、旧行落 `superseded` 却仍在库（存在性对账放行必然假 miss）；**题源确实分歧**（文件 60 题 vs DB 默认空，全仓无「文件 → DB」灌题入口）；**三键确认不进任何判定**、admin/web 零命中、收紧代价仅 1 个 it；**回归面量化**为 15 个 it / 5 个文件。一条**修正**：地图原写「CLI 侧无 DB 读」不成立，两侧 CLI 都已 import `getDb`。
- [02 · 裁定：账本 ↔ 库内对账的落点与失效语义](./issues/02-dec-ledger-db-reconcile.md) — 纯函数进 `corpus-ledger.ts`、I/O 编排进 `corpus-ledger-file.ts`，库读走**必填注入函数**（contracts 不引 `@strict-rag/db`）；**只要用了账本就必须对账**（未设账本 → 逐位一致）；**三类失效**（`missing` / `not_retrievable` / `title_mismatch`）各自可分辨且全部响亮失败，其中 `not_retrievable` 是本裁定的核心（抓重跑入库后的陈旧账本）；**三键收紧为必填**。
- [03 · 裁定：题源以谁为准 / 差异怎么可检测](./issues/03-dec-case-source-ruling.md) — 文件 = 基线题面、DB = 运行期题集，**并存是产品设计**、本图不收敛；可检测信号 = `repro` 新增 `goldSource`（`file` / `db` / null=未标注）与 `goldSetMatchesRepoFile`（与仓内基线逐位比，读不到 → null），复用既有 `l1QuestionIdsHash`；**不进判定、不进签字快照**（新增必达项须 ADR）。
- [04 · 落：对账 + 题源信号](./issues/04-task-reconcile-and-signal.md) — 纯函数进 `corpus-ledger.ts`（`diffLedgerAgainstDocs` / `formatLedgerReconcileError`）、I/O 编排进 `corpus-ledger-file.ts`（`resolveCorpusLedgerForRun` 改 async + 必填 `lookupDocs`）；api 加 `listDocRefsByIds`、worker 加 `eval/doc-refs.ts`，四入口缺省即真库；`EvalRunSchema` 三键收紧为必填。**两个对抗性验证代理独立复核**，逐条处置五处发现（陈旧注释 / 库读失败未包装 / 账本 docId 不去重 / 模板值冒充 `file` / 缺测例）。**八组反证**逐条见红后还原复跑全绿。
- [05 · 真栈真跑：对账与题源信号](./issues/05-task-real-stack-verify.md) — 真 compose 五服务（复用前图命名卷）上跑通：正向 `hitAtK=30/30` 且 `goldSetMatchesRepoFile=true`；**坏账本三档全部 exit 2**（不存在 docId / 库内某篇临时 `superseded` 或 `failed` / title 改一字符），消息逐字点名 logicalId + docId + 实测姿态；队列侧同一坏账本 → job `failed` 且 `error_message` 是对账原文（主控用 `psql` 复核该行）；`L1_GOLD_PATH` 指改过一个 id 的副本 → 出报告但信号翻 `false`。**N2 复现的正是「旧账本仍查得到旧行、却已不可检索」** —— 只查存在会放行一批必然假 miss。

### 目的地达成（2026-10-01）

**「让评测跑批的输入事实基线在两条入口上同一且可检测」已达成**：

1. **账本 ↔ 库内文档存在性可检测**：跑批解析账本这一步**必带库内对账**（`kbId` → 语料指纹 → 对账，前两档仍早于任何库读）；三类失效（`missing` / `not_retrievable` / `title_mismatch`）各自可分辨、**一律响亮失败**，消息点名逻辑 id + 文档 id + 实测姿态；**未设账本 → 完全不进对账**，与今天逐位一致。落点在共享层、两条入口**一起接**，且缺省即真库（生产不可绕）。
2. **题源差异被裁定并落地**：文件 = 基线题面 / DB = 运行期题集，**并存是产品设计**（本图不收敛）；`repro` 新增 `goldSource` 与 `goldSetMatchesRepoFile`，让「同一个 `hitAtK` 底下是不是同一份题集」第一次可检测。
3. **三键定案**：`EvalRunSchema` 的映射来源三键**收紧为必填**（`toEvalRunDto` 恒回填，历史行读路径零影响；唯一会红的 1 个裸构造测例已补键）。

**该被记住的三句话**：① **「存在」不等于「可检索」** —— 重跑入库会生成新 uuid、旧行落 `superseded` 却仍在库，只查存在会放行一批必然假 miss，锚点必须选可检索姿态；② **「查不到」与「查不了」是两回事** —— 库不可达时把错误吞掉，等于把一道新鲜的闸改常开；③ **信号不是闸** —— `goldSetMatchesRepoFile` 如实标注、不进判定；把它升成必达项是改冻结语义，须 ADR，不许顺手做。

**门禁（最后一次提交之后复跑）**：`check-types` 8/8 · `lint` 8/8 零 warning · 全仓 `test --concurrency=1` 11/11 包 · `check:module-status` **39 条**（`1-路径` / `6-联动` / `7-时效` 三类为空，与基线同）。**提交（本地，未 push）**：`5db80ab` 立图 · `e6a7144` 工单 01/02/03 · `08d0099` 工单 04 实现 · `dd1cf83` 工单 04 收口修复 · 工单 05/06 收口。

## Not yet specified

<!-- 收口后剩下的雾，按「谁挡谁」分组，供下一张图挑一个当目的地 -->

### A · 本图显式划出的四条

- **把「两侧题集不同」接成硬门**：`goldSetMatchesRepoFile` 今天是**信号**（如实标注、不进任何判定、不进签字快照）。要做成必达项（例如「准出所用题集须与仓内基线逐位相同」）属**改冻结语义** —— ADR-046 快照的必达元素由 `prds/08-quality` 定义，新增一项须 ADR → 改 PRD → 升 `prds/README.md` 版本。**落点已经就位**（字段在 `repro` 里、真栈上可真跑），缺的只是那一次裁定。
- **两条入口的题源仍未收敛**：文件 `fixtures/l1/gold.yaml`（60 题、RACI 审核产物）与 DB 表 `gold_questions`（运营自管 + 反馈晋升，默认空）并存是**产品设计**，本图只让差异可见。若日后要收敛（DB 为准 → 加「文件 → DB」灌题入口；文件为准 → worker 改读文件），须先裁产品面与归属包。
- **worker 侧的 `goldSetMatchesRepoFile` 未在真跑里验**：本图只在 api CLI 真跑里读了 `true` 与 `false` 两档；worker 侧同一函数由注入桩覆盖。落点廉价（起 worker + 一次 `POST /eval/runs`）。
- **`loadGold` 丢掉两列**：DB 的 `expected_chunk_ids` 与 `rubric` 在 worker 的 `EvalGoldCase` 里没有位置（今天无消费方）。要接须先有消费方（例如按 chunk 计分的门）。

### B · 同族但本图未碰的口子

- **L2 侧的对账未真跑**：`L2_DOC_MAP` 走同一接缝（源码同构、单测覆盖），但本图未在真栈跑 L2；L2 的 `docHitRate` 至今无真跑档。
- **对账只查一个方向**：今天查的是「账本点名的文档在不在库、可不可检索」；**不查**「库里有而账本没记」。反方向的现实后果是：重跑入库后新 uuid 未进账本 → 新文档永远不在期望集里，`hitAtK` 被**低估**。要不要做成双向，或让入库入口顺手自洽产账本，须先裁。
- **`EvalRunSchema` 收紧后历史行的语义压平**：历史行仍读作 `none / 0 / []`（那时确实没有账本，语义正确）。若将来要区分「历史行」与「真 none」，须先有版本标记。

### C · 承接前图、本图未动的清单

- 簇 **8**（`CorpusLoader` 未传 tenantId）· 簇 **11**（`loadVisibilityContext` 请求级缓存）· 簇 **13**（`kb_members.role` 完整性债）· 簇 **22**（`drizzle/meta` 类型/默认值级走查）· 簇 **24 余量**（多租户独立索引）· 簇 **31 余量**（覆盖表剩余 59 行 `部分测`）· 簇 **32**（`/prds` 与 `.trellis/tasks/` 不在版本库）· 簇 **37 余量**（真 ES 上 reindex 覆盖旧 principals）。

## Out of scope

- **改 `prds/00–11` 已冻语义**（含任何门限数字与判定公式）：须 ADR → 改 PRD → 升版。
- **真模型 live 跑数 / 人签 / ≥100 真标注校准集**：须真 Gateway key + 人。
- **B8 真 ES+IK / 多租户独立索引 / B9 真 RustFS / QUAL-2 真杀毒**：前图已裁。
- **P2.5 准出 / rewrite 默认开 / admin / web 的视觉与交互改动**：本机无浏览器验证手段。
- **改仓库默认开关**。
