# worker 评测路径与账本接缝：现状面核实（决策所需事实）

Label: wayfinder:research
Type: research
Status: resolved

## Question

在动任何代码之前，把本图裁决与实现所需的**事实**核清（只读源码 + 只读夹具 + 只读文档，不起服务）。逐项给出**文件 + 行号 + 原样形状**，不确定的明写「未核实」，**禁止**推断填充。

1. **生产路径的完整链**：`POST /knowledge-bases/:kbId/eval/runs`（`apps/api/src/routes/eval.ts`）→ `enqueue`（哪个模块的哪个函数）→ BullMQ 队列名与 job name → worker 侧消费者注册点（哪个文件把 `sr-eval` 队列接到 `handleEvalJob`）→ `handleEvalJob` → `runL1Batch`/`runL2Batch` → `evalPersist.saveReport`/`saveL2Report` → 表 `eval_runs`。逐跳给文件 + 行号。**并确认**：这条链今天有没有被任何测试端到端跑过（`apps/worker/tests/eval/consumer.test.ts` 覆盖到哪一步为止）。
2. **worker 进程的 env 面**：`apps/worker/src/env.ts` 里与评测相关的键全清单（`EVAL_*` / `JUDGE_CALIB_SCORER` / 其它），各自的**默认值与缺省行为**；worker 侧读 env 的时机（模块加载期 vs 每次 job）。参照先例 `EVAL_L2_GOLD_PATH`（`apps/worker/src/eval/persist.ts` 的 `defaultL2GoldPath`）与 `JUDGE_CALIB_SCORER`（`consumer.ts`），说明「worker 的评测输入走进程级 env」是不是本仓既有形状，有没有反例。
3. **`runL1Batch` / `runL2Batch` 的入参面**：两个函数的 opts 全字段（含 `judgeScorerMode` / `humanSpotPath` / `kbId` 等）与各自缺省；`expectedDocIds` 进入 `hitAtKCase` 的**全部**位置（L1 一处、L2 两处？逐处给行号）；报告对象里**哪些键被字面量测试钉住**（列出会被打红的文件与 it）。
4. **落库白名单的完整面**：`persist.saveReport` 与 `saveL2Report` 的 `reportJson` 键清单（逐键），以及**哪几键是硬编码常量**而非取报告真值；`eval_runs` 表的列清单（`packages/db` 的 schema 定义），`reportJson` 列的类型（jsonb？）；`GET …/eval/runs/:runId` 的 DTO 映射函数（`toEvalRunDto`）从 `reportJson` 里**取哪几键**、`.strict()` 会不会拒多余键。
5. **api 侧账本消费的现成资产**：`apps/api/src/eval/corpus-map.ts` 的 `resolveCorpusLedgerForRun` 完整签名与**全部失败分支**（各抛什么、错误消息原文）；`CorpusLedgerError` 的类型与导出位置；`run-l1-golden.ts` 里读账本 + 解析 + 进 `hitAtKCase` 的**精确代码块**（连同 `exit 2` 的处理）；`summarizeDocMap` 的返回形状。**重点**：这些资产里哪些是**纯函数 / 无 api 专属依赖**，可以直接被 worker 复用；哪些带 `repoRoot` / `node:fs` / `process.exit` 之类需要改接线。
6. **worker 侧能否读到账本文件**：worker 进程的工作目录与 `repoRoot` 推导方式（`persist.ts` 用 `path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')` —— 核对这在本仓 workspace 布局下指向哪里）；`artifacts/` 的 gitignore 语义；`docs/ops/` 里有没有把 `artifacts/` 挂进容器的既有做法。
7. **真栈真跑的前置**：要经队列跑一次 L1 需要哪些服务与 env（compose 服务清单、worker 进程怎么起、`EVAL_INTERNAL_TOKEN` / `EVAL_ASK_BASE_URL` 怎么配、`REDIS_URL` / `DATABASE_URL`）；`docs/ops/operable-stack.md` 与 `docs/ops/real-stack-evidence.md` 里现成的拉起与跑批配方（可直接复用的命令块）；`scripts/smoke-half.mjs` 有没有覆盖「入队 → worker 消费」这一段。
8. **侧证**：`docs/module-status/worker.md` 与 `api.md` 里关于 worker 评测路径 / Hit@k / `docHitRate` 的既有措辞（原样摘录）；`docs/testing/coverage/` 里涉及该路径的行（行号 + 现值 + 缺口列原文）；`apps/worker/tests/index.md` 里评测相关的行。

产物：`research/01-worker-eval-surface.md`（分节 + 表格，每条**带路径与行号**）。只读，不改任何文件。

## Answer

**已解**。正文（332 行，8 组问题逐组带证据 + 回归面清单 + 未核实清单）：[`../research/01-worker-eval-surface.md`](../research/01-worker-eval-surface.md)。主控已独立复核其中三条最要紧的事实（契约子路径导出、`corpus-map.ts` 的相对 import、`defaultRepoRoot` 的层数）。

要点：

- **调用链**：`routes/eval.ts:238` → `enqueue`（`services/queue.ts:60` 的 `enqueueEval`，绑定于 `routes/eval.ts:114`）→ 队列 `sr-eval` / job 名 `golden_2x2` → worker 注册点 `index.ts:113` → `handleEvalJob`（`consumer.ts:16`）→ `runL1Batch`(`:96`) / `runL2Batch`(`:52`) → `persist.ts:101` / `:153` → 表 `eval_runs`。
- **本图最重要的新事实**：**这条链从未被端到端跑过** —— api 侧测试注入假 `enqueue`，worker 侧测试注入内存 persist，中间的 BullMQ / 真 PG / 真 HTTP 无人贯通。故工单 05 会是**第一次**真跑这条链。
- **env 面**：worker 评测相关键只有 4 个（`EVAL_ASK_BASE_URL` / `EVAL_INTERNAL_TOKEN` / `EVAL_L2_GOLD_PATH` / `JUDGE_CALIB_SCORER`），**无 `L1_DOC_MAP` / `L2_DOC_MAP`**；`env` 在**模块加载期**一次求值。既有形状支持「评测输入走进程级 env」（`persist.ts:29-32` · `consumer.ts:103`）；**反例**：`retrieveMode` / `maxCases` / `runType` 是**随 job 下发**的（`eval-job.ts:17-20`）。
- **比对点共 3 处**：L1 `run-l1-batch.ts:176`；L2 `run-l2-batch.ts:193`（正常）与 `:219`（error）。两个批跑函数的 opts **都没有账本参数**。
- **落库**：`saveReport` 27 键 / `saveL2Report` 23 键，三键硬编码在 `persist.ts:146-148` 与 `:190-192`；`reportJson` 列是 **jsonb**。
- **第二条新事实（立图时未料）**：`toEvalRunDto`（`services/eval-runs.ts:203`，经 `extraStatsFromReport` `:95` + `casesFromReport` `:132`）**不透出 `docMap*` 与 `repro`** —— 即便 worker 落了真值，经 API 也只能看到 `hitAtK` 三个数字，看不到「映射来源」。已作为工单 02 第 8 组的裁定项。
- **复用可行性**：`corpus-ledger.ts` 三个函数是**纯函数**（只依赖 `node:crypto`），worker **可直接 import**；而 `corpus-map.ts`（相对 import `./corpus-fixtures.js`）与 `corpus-fixtures.ts`（`node:fs` + `repoRoot`）**不能直接复用** → 共享落点须裁定（工单 02 第 1b 组）。
- **账本可达性零障碍**：docker compose **无任何 host 目录挂载**（只有 pg/es/mongo/rustfs 四个命名卷），api 与 worker 都在 host 跑 → worker 直读 host 文件系统；`repoRoot` 从 `apps/worker/src/eval` 上溯 4 层 = 仓库根，与 api 侧同式同根。
- **回归面**：直接钉住报告键集 / 落库白名单的 **12 条 it（8 个文件）** + **2 条语义钉子** = 常规范畴内最可能打红 **14 条**；若把 `corpus-map` / `corpus-fixtures` 上移或改签名，另有 **31 条 it（跨 api / contracts）** 的条件面。
- **未核实 8 条**（原样转给工单 05 与 02）：真跑的实际 env 组合 · 经队列一次 L1 的端到端行为 · jsonb 回读等价性 · `services/eval-runs.ts:285-330` 的 SQL 谓词真 PG 行为 · worker→`/internal/eval/execute-ask` 真链路 · 账本↔库内文档运行时不变量 · worker 侧共享落点（属待裁）· 本机 Docker 稳定性。
