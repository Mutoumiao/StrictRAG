# 落：worker 侧批跑按账本解析（L1 + L2，与 api CLI 同名同义）

Label: wayfinder:task
Type: task
Status: open
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

<!-- 收口时填：改了哪些文件 + 测例数 + 反证轮次 + 未做与边界 -->
