# 落：worker 侧批跑按账本解析（L1 + L2，与 api CLI 同名同义）

Label: wayfinder:task
Type: task
Status: resolved
Blocked by: 02

## Question

按工单 02 的裁定，把 worker 侧评测批跑接上账本解析，使**两条入口对同一数字给同一含义**。范围：

1. **解析落点**：在 `hitAtKCase` **之前**、按裁定选定的时机（`handleEvalJob` 每次 job / 进程启动）加载并校验账本；**必须复用** `@strict-rag/contracts/eval-corpus-ledger` 与 `apps/api/src/eval/corpus-map.ts` 的同款判定，不许另写一套。
2. **三态语义**：未设置 → 与今天逐位一致；设置但不可解析 / `kbId` 不符 / 语料指纹不符 → **job 失败**（按裁定措辞写 `errorMessage`，状态落 `failed`）；设置且自洽 → 解析后比对。
3. **L1 与 L2**：`runL1Batch`（`expectedDocIds` 一处）与 `runL2Batch`（正常分支与 error 分支两处）都要接；L2 的 `docHit` 三态（`null` / `true` / `false`）语义**保持今天不变**，只是解析后的 id 参与比对。
4. **报告字段**：两条批跑的报告对象按裁定补上（或复用）映射来源三键，取值来自本次解析结果（未设置时恰为 `none` / `0` / `[]`）。
5. **测例**：只进 `apps/worker/tests/eval/<意图>.test.ts`，文件头「目标 / 需求 / 被测 / 简介」简体中文，登记 `apps/worker/tests/index.md`。至少覆盖：① 未设置 → 报告三键为 `none/0/[]` 且 `hitAtK` 与今天逐位一致（反证）；② 设置且自洽 → 逻辑 id 解析为 uuid 后命中数变真；③ `kbId` 不符 → job 失败且错误信息点名（**不许**降级成「未设置」）；④ 指纹不符 → 同上；⑤ L2 error 分支同样受解析影响；⑥ 账本文件不存在 / 形状非法 → 失败而非静默。
6. **回归面**：工单 01 列出的被字面量钉住的文件与 it 必须一并按新形状更新（不许用 `as any` / `@ts-ignore`）；`apps/worker/tests/eval/consumer.test.ts` 与各 `run-*-batch*.test.ts` 要能通过。

**不许**：改任何判定公式（`computeSignoffEligible` / `computeL2SignoffEligible` / `evaluateAdr046Bind`）；改仓库默认开关；把缺映射写成 `null`；放宽已有断言。

## Answer

**已解**（与工单 04 同一批实现，由一名实现子代理完成，主控逐条独立复核）。门禁：`check-types` 8/8 · `lint` 8/8 · `contracts` 35 文件 / 298 通过 · `worker` 61 文件 / 275 通过 · `api` 182 文件 / 1134 通过（3 skipped）。

- **复用落点（裁定 1b）**：新增 `packages/contracts/src/eval/corpus-ledger-file.ts`（`corpus-fixtures.ts` + `corpus-map.ts` 逐位搬家，9 个导出）；`packages/contracts/package.json` 加 `"./eval-corpus-ledger-file"` 子路径。**主入口 `src/index.ts` 未引入**（已核实，避免 `node:fs` 进 web/admin 客户端打包图）。`apps/api/src/eval/corpus-fixtures.ts` 与 `corpus-map.ts` 改为**纯 re-export**，原导出名一个不少 → api 侧既有测试与源码的 **import 路径一个字未改**。
- **`defaultRepoRoot` 改必填入参**：`defaultRepoRoot(fromFile: string)`；api 侧 6 个调用点（源码 2 + 测试 4）显式传 `import.meta.url`。主控独立验算：`apps/worker/src/eval` · `apps/api/src/scripts` · `apps/api/tests/eval` · `apps/api/src/eval` 四处上溯 4 层**都落在仓库根**。
- **env（裁定 1）**：`apps/worker/src/env.ts` 加 `L1_DOC_MAP` / `L2_DOC_MAP`（`optional().default('')`）；**未动** `EvalJobDataSchema` 与 `POST /eval/runs` 请求体。
- **时机与三态（裁定 2 / 3）**：`consumer.ts` 的 `docMapPathOf` 把「空 / 纯空白」判为**未设置**；路径取自 env 快照，**文件内容每次 job 重读**（读在批跑函数内、模块顶层不读）。设置但不可用 → `resolveCorpusLedgerForRun` 抛 `CorpusLedgerError`（原文复用）→ `handleEvalJob` 既有 `try/catch` → `markFailed` + `ok:false`；**未降级成「未设置」**。
- **两条批跑（裁定 5）**：`runL1Batch` / `runL2Batch` 各加 `docMapPath?` / `repoRoot?`，在 `hitAtKCase` **之前**解析（L1 一处；L2 正常分支与 error 分支**两处**都经 `expectedForHit`）；报告都加三键（来自 `summarizeDocMap`），形状与 api CLI 一致。
- **一处裁定追认**：工单 02 第 2 组的「在 `handleEvalJob` 内读」与工单 03 的「在 `hitAtKCase` 之前读」在**物理位置**上有歧义，实现选了后者（读在批跑函数内、由 consumer 每 job 传路径）。主控决定**追认**：它满足全部实质不变量（路径取 env 快照、内容每 job 重读、不读在模块顶层、抛错仍被 `handleEvalJob` 的 try 捕获），且与 api 侧 `runL1Golden` **同构**（后者也是在函数内读）。
- **测例**：新增 4 文件 21 个 it（`apps/worker/tests/eval/run-l1-batch-doc-map.test.ts` 8 · `run-l2-batch-doc-map.test.ts` 8 · `consumer-doc-map.test.ts` 2 · `apps/api/tests/eval/eval-run-dto-doc-map.test.ts` 3）；改写 `apps/worker/tests/eval/persist-doc-map-keys.test.ts`（2 → 4 it）。均已登记两份 `tests/index.md`（存货闸已过）。
- **反证 5 条**（逐条撤线看变红后还原）：撤 consumer 的 L1 路径 / 把 `saveReport` 的 `docMapSource` 写回 `'none'` / 把 `toEvalRunDto` 的 `docMapSource` 写死 / 把 L2 error 分支退回直比 / 撤 `runL1Batch` 的 `resolveExpectedDocIds` —— 各自对应用例变红。
- **诚实边界（子代理自陈，主控保留）**：L2 error 分支因证据恒空、解析与否**数值上不可区分**，故该条用「行为 + 源码形状守卫（`hitAtKCase(c.expectedDocIds` 在 `run-l2-batch.ts` 中为 0 处）」两半钉住 —— 守卫是对源码文本的断言，不是纯行为证据。`EvalRunSchema` 三键设为**可选**是为兼容历史行；若要收紧为必填须先回填历史行。
