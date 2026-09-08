# Judge AUROC 最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 50

## Question

补 P4 门禁包第三刀：独立 Judge 校准集按 `(score, label)` 算 AUROC，写出 `judgeAuroc`。这是本批唯一一张执行工单。

权威：[裁定 L1 τ 扫描后下一步](./50-after-l1-tau-sweep-order.md)。在线编写仍 P2.x。仓库默认强制仍关。角色 principal 仍留雾。人签仍图外。

口径：

- **不**用 `gold.yaml` 的 `type` / ask `outcome` 冒充 supported 真值（题型 ≠ claim 是否被证据支持）
- 校准集独立文件 `fixtures/l1/judge-calibration.json`：`{ cases: [{ id, claim, evidence, label }] }`；`label` 仅 `supported` | `unsupported`（或 0/1）；脏标签抛错
- 分数源 = 可注入打分器按题返回 `[0,1]`；缺打分器 / 非有限 / 越界 → 该题跳过（与 `parseMinSupport` 同）
- **AUROC** = Mann-Whitney：`(#{pos>neg} + 0.5×平局) / (nPos×nNeg)`；任一类 scored=0 → `null`（禁止写成 1 或 0.5）
- 挂现有 L1 批跑报告字段 `judgeAuroc`（number|null），与 Hit@k / tau* 同路径；**不**新开 HTTP `runType=verifier_calib`
- 本跑实际 2×2 / coverage / `signoffEligible` / `signedPackage` **不**因 AUROC 改变；**不**拿实测值去比 `judgeAurocMin` 翻签字
- 无打分器时 `judgeAuroc=null`（工程种子；≠ live 校准 PASS）

### 做

- `@strict-rag/contracts` 纯函数：`parseJudgeLabel` / `parseJudgeCalibration` / `auroc` / `judgeAurocFromScored`（与 2×2、Hit@k、τ 扫描并列；api 再导出）
- 仓根 `fixtures/l1/judge-calibration.json`：两侧 label 都有；README 登记。不是 gold 题面
- CLI `runL1Golden`：可选 `scoreJudge` + `judgeCalibPath` / 预解析 cases；报告含 `judgeAuroc`；md/stdout 写该字段
- worker `runL1Batch`：同可选打分器；写入 `reportJson`
- `EvalRunSchema` 可选 `judgeAuroc`（number|null）。GET list/detail 从 `reportJson` 映出（不新迁列）
- admin 评测 L1 跑批行：有 `judgeAuroc` 字段时展示（数字或「无」）；L2 不装
- 测例：
  - 纯函数：完美排序 → 1；倒置 → 0；单类 / 无分 → null；脏标签抛错
  - 校准 JSON 合法解析；缺 id/claim/evidence 拒
  - CLI：注入打分器 → 报告有 judgeAuroc；不注入 → null；本跑 2×2 仍按真实 outcome
  - worker batch：同口径
  - 契约：EvalRun 可带 judgeAuroc；未知字段仍拒
  - extraStatsFromReport 从 reportJson 映出
  - admin：有 judgeAuroc 的 L1 run 可见该值
- 覆盖分册 C3 能测的 Then 回写（UAT 真跑 / 接签字公式仍缺口）

### 不做

- 新 HTTP `verifier_calib` runType / 单独入队
- 用黄金题型或 answered/abstained 当 label
- 把 `judgeAuroc >= 0.65` 写入 `signoffEligible` / `evaluateAdr046Bind` / `businessPass`
- 写 `TAU_CLAIM` / 公开 ask 传 τ / 默认开 live LLM 校准
- 再认证流程 / 多模型 fallback / 双轨看板 / 数据面板增强
- 仓库默认开 `DEPT_ACL_ENFORCE` / 角色 principal
- 在线编写 / P3a / 默认开 rewrite / LangGraph / E2E / B8
- 人签 / `businessPass`

收工：`.trellis/spec/` api / worker；`docs/module-status/` 对应包；`docs/testing/coverage/03-ops.md` C3。禁止 push。禁止 `task.py create`。

写代码前读 `.trellis/spec/api/backend/l1-eval.md`、`.trellis/spec/guides/testing.md`。测例落 `tests/<能力>/`，文件头简体中文，登记 index。

## Answer

Judge AUROC 最小闭环已落地。

- 纯函数：`parseJudgeLabel` / `parseJudgeCalibration` / `auroc` / `judgeAurocFromScored`。label 仅 `supported|unsupported|0|1`；脏值抛错。Mann-Whitney；单类或无有效分 → null。校准 JSON 必须双侧 label。
- 夹具：`fixtures/l1/judge-calibration.json`。**不用** gold type / ask outcome 当真值。
- CLI / worker：可注入 `scoreJudge`；无打分器 → `judgeAuroc=null`。打分数组长度必须等于校准题，短数组抛错。显式空校准集不回落仓根夹具。不改本跑 2×2、不进 `signoffEligible`、不比 `judgeAurocMin`。
- GET eval run 从 `reportJson` 映出 `judgeAuroc`。admin L1 展示数字或「无」。
- 覆盖 C3：缺实现 → 部分测。未新开 `verifier_calib` 入队。

未做：live judge 真跑、再认证、多模型 fallback、双轨看板、接签字公式、默认开强制、角色 principal。未 `task.py create`。未 push。

证据：`packages/contracts/src/eval/l1-matrix.ts` · `apps/api/src/scripts/run-l1-golden.ts` · `apps/worker/src/eval/run-l1-batch.ts` · `apps/admin/src/app/(ops)/eval/_components/eval-workspace.tsx` · `packages/contracts/tests/eval/l1-judge-auroc.test.ts` · `apps/api/tests/eval/l1-cli.test.ts` · `apps/worker/tests/eval/run-l1-batch.test.ts`。

## Comments

- 2026-09-08 认领并执行。权威切边见 [裁定 L1 τ 扫描后下一步](./50-after-l1-tau-sweep-order.md)。
- 审查指出 worker 短分数会用子集写成 1、空校准集回落夹具、label 别名过宽；已收紧并补测。
