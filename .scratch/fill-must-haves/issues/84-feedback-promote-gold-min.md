# 反馈回流黄金集最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 83

## Question

补 P2 反馈→黄金集真空：`promoted_to_gold` 只改反馈状态，不写 `gold_questions`；admin 队列无纳入按钮。这是本批唯一一张执行工单。

权威：[裁定 L0/contextMode 后下一步](./83-after-l0-context-mode-order.md)。L0 / contextMode 单控件已齐。仓库默认强制仍关。角色 principal 仍留雾。人签仍图外。

现状（源码）：

- `PatchFeedbackBodySchema` 仅 `{ status }`；`promoted_to_gold` 合法但无副作用
- `apps/api/src/routes/feedback.ts` PATCH 只 `repo.patchStatus`
- `apps/api/src/services/gold-questions.ts` 已有 CRUD；评测页可手建题
- admin `/feedback` 仅忽略 / 已关联文档
- `ask_traces` 有 `raw_question` / `standalone_question`
- 工单 12 明确不做回流；QUAL-G3 针对 `gold.yaml` 工程种子，本张不碰

口径：

- 用户 POST feedback **不得**写黄金集（审核闸 = 运营点纳入）
- PATCH `status=promoted_to_gold` **必须** INSERT `gold_questions`，再改反馈状态
- 须带 `goldType` ∈ `answerable` | `unanswerable` | `false_premise`；缺则 400
- 题面：`standaloneQuestion` trim 非空，否则 `rawQuestion` trim；仍空 → 400，不得用 comment 冒充题面
- comment trim 非空 → `rubric`；否则 rubric null
- `caseKey` = `fb-{feedbackId}`（每库唯一）
- `expectedDocIds` / `expectedChunkIds` **null**（禁止抄当轮 evidence）
- 已是 `promoted_to_gold` 再 PATCH 同状态：200 幂等，不插第二题
- 从其它状态改走：不删已写入的黄金集
- 无 ask trace → 404；晋升另验 `eval.run`（已有 `feedback.queue`）
- admin：open 行 ClosedSelect 题型 +「纳入黄金集」；无 `eval.run` 不展示该按钮；禁止新原生 `<select>`
- 禁止自动入队 `eval/runs`；禁止改 2×2 / `signoffEligible`；禁止写 `fixtures/l1/gold.yaml`
- 测例禁止依赖墙钟、禁止真集群、禁止真 Gateway

### 做

- contracts：PATCH 可含 `goldType`；晋升必须带类型；题面 / caseKey / rubric 纯函数
- api：PATCH 晋升写黄金集；用户提交不写；无题面 400；无 `eval.run` 403；幂等
- admin：队列纳入按钮 + 题型 ClosedSelect
- 测例：
  - contracts：无 goldType 不得 promoted_to_gold；dismissed 可不带；题面优先独立问句
  - api：晋升插入黄金集且状态变更；POST 不插入；无题面 400；无 eval.run 403；重复晋升不第二行
  - admin：有两码才见纳入；点纳入带 goldType；无 eval.run 不见按钮

### 不做

- 写 / 审 `gold.yaml`（QUAL-G3）
- 自动入队评测 / 改 2×2 / 再认证 / 签字包链
- 从 evidence 填 expectedDocIds
- `queued_reindex` 按钮 / 真 reindex
- 角色树状勾选 / 断线重拉 / 参数快照审计 / 入场 aclPrincipals
- 真 L1 Gateway / 通用表单引擎 / BlockNote
- 默认开 `DEPT_ACL_ENFORCE` / 角色 principal / 默认开 OCR / 真引擎
- 改 `prds/00–11`

收工：`.trellis/spec/` api ask-pipeline + admin quality-guidelines / directory-structure + contracts directory-structure；`docs/module-status/` api · admin · contracts。禁止 push。禁止 `task.py create`。

写代码前读 `.trellis/spec/api/backend/ask-pipeline.md`、`.trellis/spec/admin/frontend/quality-guidelines.md`、`.trellis/spec/guides/testing.md`。测例落 `tests/<能力>/`，文件头简体中文，登记 index。

## Answer

反馈回流黄金集最小闭环已落地。

- PATCH `promoted_to_gold` 须 `goldType`，另验 `eval.run`，INSERT `gold_questions`（`caseKey=fb-{feedbackId}`；题面优先独立问句；comment 进 rubric；不抄 evidence）。
- 用户 POST 不写黄金集。无题面 400。无 `eval.run` 403。重复晋升不插第二题。
- admin 队列：两码才见 ClosedSelect 题型 +「纳入黄金集」。不写 gold.yaml，不自动入队评测。

证据：`packages/contracts/src/ask/feedback.contract.ts` · `apps/api/src/routes/feedback.ts` · `apps/admin/src/app/(ops)/feedback/_components/feedback-workspace.tsx` · `packages/contracts/tests/ask/feedback-promote-gold.test.ts` · `apps/api/tests/feedback/promote-gold.test.ts` · `apps/admin/tests/ops/feedback-promote-gold.test.tsx`。

未 `task.py create`。未 push。

## Comments

- 2026-09-15 认领并在主分支执行。权威切边见 [裁定 L0/contextMode 后下一步](./83-after-l0-context-mode-order.md)。
