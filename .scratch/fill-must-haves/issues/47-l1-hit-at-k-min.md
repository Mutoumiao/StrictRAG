# L1 Hit@k 最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 46

## Question

补 P4 门禁包第一刀：有 `expectedDocIds` 的 L1 题算 Hit@k，写入报告与账本。这是本批唯一一张执行工单。

权威：[裁定敏感解禁后下一步](./46-after-sensitive-unlock-order.md)。P3b 可动手最小闭环已齐。`DEPT_ACL_ENFORCE` **默认仍关**。角色 principal 仍留雾。人签仍图外。

口径：

- 只对带**非空** `expectedDocIds` 的题计分；缺字段 / `null` / `[]` 不计分（不进分母）
- evidence = 该次 ask 实际 `evidence_snapshot` 的 `docId` 列表（rerank 后进 verify 的集合；k = 该列表长度）
- 单题 hit = expected 与 evidence **字符串全等**有交集
- 总率 = hits / scored；scored=0 → `null`
- **不**改 2×2、**不**进 `signoffEligible`、**不**当硬门下限
- **不**做逻辑 id → uuid 映射（仍按 fixtures README：live 前由人换成当前库 uuid）

### 做

- `@strict-rag/contracts` 纯函数：`hitAtKCase` / `accumulateHitAtK` / `hitAtKRate`（与 2×2 并列，api 再导出）
- CLI `runL1Golden`：从 `graph.evidence_snapshot` 取 docId；报告含 `hitAtK` / `hitAtKHits` / `hitAtKScored`；每题 `hitAtK: boolean | null`；md 写出总率
- worker `runL1Batch`：gold 带 `expectedDocIds`；execute 可回 `evidenceDocIds`；同算并写入 `reportJson`
- `POST /internal/eval/execute-ask` 回 `evidenceDocIds`（id 数组；可与现有 `evidenceTexts` 并列）。worker HTTP execute 读该字段
- `EvalRunSchema` 可选 `hitAtK` / `hitAtKHits` / `hitAtKScored`；明细行可选 `hitAtK`。GET list/detail 从 `reportJson` 映出（不新迁列）
- admin 评测跑批结果行：L1 有 scored 时展示 Hit@k；无 scored 不装齐
- 测例：
  - 纯函数：无 expected → null；命中；未命中；空 evidence 未命中；分母 0 → 总率 null
  - CLI：带 expected 且 snapshot 含该 docId → hitAtK=1；不含 → 0；无 expected 总率 null 且 2×2 不变
  - worker batch：同口径
  - 契约：EvalRun 可带 hitAtK；未知字段仍拒
  - 内口：200 含 `evidenceDocIds` 数组
  - admin：有 hitAtK 的 run 可见该率
- 覆盖分册 C4 能测的 Then 回写（逻辑 id 映射仍缺口）

### 不做

- 人签 / `businessPass` / 改 `signoffEligible`
- τ 扫描 / Judge AUROC / 再认证流程
- 多模型 fallback / 双轨看板 / 数据面板增强 / 在线抽样
- 逻辑 id 映射表 / 自动 reindex
- 仓库默认开 `DEPT_ACL_ENFORCE` / 角色 principal
- 在线编写 / P3a / 默认开 rewrite / LangGraph / E2E / B8

收工：`.trellis/spec/` api / contracts / worker / admin；`docs/module-status/` 对应包；`docs/testing/coverage/03-ops.md` C4。禁止 push。禁止 `task.py create`。

写代码前读 `.trellis/spec/api/backend/l1-eval.md`、`.trellis/spec/guides/testing.md`。测例落 `tests/<能力>/`，文件头简体中文，登记 index。

## Answer

L1 Hit@k 最小闭环已落地。

- 纯函数：`hitAtKCase` / `accumulateHitAtK` / `hitAtKRate` / `parseExpectedDocIds`。无非空 expected → 不计分；hit = evidence.docId 字符串全等交集；scored=0 → 总率 null。脏名单（非数组 / 非字符串元素）抛错，不当无名单。
- CLI / worker 批跑写入 `hitAtK` / `hitAtKHits` / `hitAtKScored` 与每题 `hitAtK`。不改 2×2、不进 `signoffEligible`。
- 内口回 `evidenceDocIds`；worker HTTP execute 下传。GET eval run 从 `reportJson` 映出。admin L1 有 scored 时展示 Hit@k。
- 覆盖 C4：缺实现 → 部分测。逻辑 id→uuid 映射仍缺口。

未做：人签、τ 扫描、AUROC、再认证、多模型 fallback、双轨看板、默认开强制、角色 principal。未 `task.py create`。未 push。

证据：`packages/contracts/src/eval/l1-matrix.ts` · `apps/api/src/scripts/run-l1-golden.ts` · `apps/worker/src/eval/run-l1-batch.ts` · `apps/api/src/routes/eval.ts` · `apps/admin/src/app/(ops)/eval/_components/eval-workspace.tsx` · `packages/contracts/tests/eval/l1-hit-at-k.test.ts` · `apps/api/tests/eval/l1-cli.test.ts`。

## Comments

- 2026-09-08 认领并执行。权威切边见 [裁定敏感解禁后下一步](./46-after-sensitive-unlock-order.md)。
- 审查指出非数组名单会被当成无名单踢出分母；加载边界改为 `parseExpectedDocIds` 抛错。
