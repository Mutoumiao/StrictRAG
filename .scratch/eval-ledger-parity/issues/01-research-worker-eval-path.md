# worker 评测路径与账本接缝：现状面核实（决策所需事实）

Label: wayfinder:research
Type: research
Status: open

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

<!-- 收口时填：要点 + 正文链接 -->
