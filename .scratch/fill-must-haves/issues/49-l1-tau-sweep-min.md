# L1 τ 扫描最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 48

## Question

补 P4 门禁包第二刀：L1 批跑按 claim `minSupport` 离线扫 τ 网格，写出 tau*。这是本批唯一一张执行工单。

权威：[裁定 L1 Hit@k 后下一步](./48-after-l1-hit-at-k-order.md)。在线编写仍 P2.x。仓库默认强制仍关。角色 principal 仍留雾。人签仍图外。

口径：

- **不**新开 HTTP `runType=tau_sweep`（schema 字面量仍闲置）；扫网格挂在现有 L1 `golden_2x2` 批跑上，与 Hit@k 同路径
- 分数源 = 该题 ask 实际 `minSupport`（min 否决：`min(claimScores)`）。`unsupported_claims` 也必须带回分数，否则只能加严不能放松
- 无分数（未进 judge / 解析失败 / error）→ 该 τ 下保持原 outcome，不可变成 answered
- error 在每一档仍出格
- 网格冻结：`0.30` 到 `0.90` 步长 `0.05`（含端点）
- 每档重算 2×2；`coverage=A/(A+B)`；`cRate=C/(C+D)`；任一分母为 0 → 该档该率 `null`
- **tau\*** = 网格中满足 `coverage≥0.4` ∧ `cRate≤0.05`（试点硬门）的**最大** τ；没有则 `null`
- 本跑实际 2×2 / coverage / `signoffEligible` **仍按 env `TAU_CLAIM` 的真实 outcome**，扫描不改格、不进签字公式
- **不**写 `TAU_CLAIM`、**不**让公开 ask 传 τ、**不**自动把 tau* 接到运行时

### 做

- `@strict-rag/contracts` 纯函数：`cRate` / `parseMinSupport` / `outcomeAtTau` / `sweepTau`（与 2×2、Hit@k 并列；api 再导出）
- 图 `finalize`：`unsupported_claims` 且已算出 `minSupport` 时带回该值（与 `verified` 相同）；其它拒答原因仍不带
- CLI `runL1Golden`：从 `graph.minSupport` 取分；报告含 `tauStar`（number|null）与 `tauSweep` 网格；md/stdout 写 tau*
- worker `runL1Batch`：execute 可回 `minSupport`；同算并写入 `reportJson`
- `POST /internal/eval/execute-ask` 回 `minSupport`（缺则 `null`）。worker HTTP execute 读该字段
- `EvalRunSchema` 可选 `tauStar`（number|null）。GET list/detail 从 `reportJson` 映出（不新迁列）
- admin 评测 L1 跑批行：有 `tauStar` 字段时展示（数字或「无」）；L2 不装
- 测例：
  - 纯函数：无分数保持原 outcome；有分可随 τ 翻转 answered/abstained；error 出格；缺不可答分母 → tauStar null；满足硬门取最大 τ
  - CLI：注入带 minSupport 的 answered / unsupported_claims → 报告有 tauStar；本跑 2×2 仍按真实 outcome
  - worker batch：同口径
  - 契约：EvalRun 可带 tauStar；未知字段仍拒
  - 内口：200 含 `minSupport`（verified / unsupported_claims）
  - 图：min 否决拒答仍带回 minSupport
  - admin：有 tauStar 的 L1 run 可见该值
- 覆盖分册 C2 能测的 Then 回写（UAT 真跑 / 写 env 仍缺口）

### 不做

- 新 HTTP `tau_sweep` runType / 单独入队
- 写 `TAU_CLAIM` / 公开 ask 传 τ / 设置页滑块
- 把 tau* 写入 `signoffEligible` 或改本跑 2×2
- Judge AUROC / 再认证流程 / 多模型 fallback / 双轨看板 / 数据面板增强
- 仓库默认开 `DEPT_ACL_ENFORCE` / 角色 principal
- 在线编写 / P3a / 默认开 rewrite / LangGraph / E2E / B8
- 人签 / `businessPass`

收工：`.trellis/spec/` api / contracts / worker / admin；`docs/module-status/` 对应包；`docs/testing/coverage/03-ops.md` C2。禁止 push。禁止 `task.py create`。

写代码前读 `.trellis/spec/api/backend/l1-eval.md`、`.trellis/spec/guides/testing.md`。测例落 `tests/<能力>/`，文件头简体中文，登记 index。

## Answer

L1 τ 扫描最小闭环已落地。

- 纯函数：`cRate` / `parseMinSupport` / `outcomeAtTau` / `sweepTau`。有 `minSupport` 才随 τ 翻转；无分数保持原 outcome；error 出格；网格 `0.30…0.90` 步长 `0.05`；tau* = 试点 coverageMin∧cRateMax 的最大 τ。整批无分数 → tauStar null（不得把原格碰巧过门写成 0.9）。
- 图 `finalize`：`unsupported_claims` 带回 minSupport。CLI / worker 批跑写入 `tauStar` / `tauSweep`。不改本跑 2×2、不进 `signoffEligible`、不写 `TAU_CLAIM`。
- 内口回 `minSupport`；worker HTTP execute 下传。GET eval run 从 `reportJson` 映出 `tauStar`。admin L1 展示数字或「无」。
- 覆盖 C2：缺实现 → 部分测。未新开 `tau_sweep` 入队。

未做：AUROC、再认证、多模型 fallback、双轨看板、写 env、默认开强制、角色 principal。未 `task.py create`。未 push。

证据：`packages/contracts/src/eval/l1-matrix.ts` · `apps/api/src/graph/run.ts` · `apps/api/src/scripts/run-l1-golden.ts` · `apps/worker/src/eval/run-l1-batch.ts` · `apps/api/src/routes/eval.ts` · `apps/admin/src/app/(ops)/eval/_components/eval-workspace.tsx` · `packages/contracts/tests/eval/l1-tau-sweep.test.ts` · `apps/api/tests/eval/l1-cli.test.ts` · `apps/api/tests/ask/min-veto.test.ts`。

## Comments

- 2026-09-08 认领并执行。权威切边见 [裁定 L1 Hit@k 后下一步](./48-after-l1-hit-at-k-order.md)。
- 审查指出无分数时原格过门会把 tau* 写成网格上沿 0.9；`sweepTau` 改为 scored=0 → null，并补测。
