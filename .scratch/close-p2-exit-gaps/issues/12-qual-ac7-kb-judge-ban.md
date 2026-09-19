# QUAL-AC7：KB 绑 judge 必须被拒

Type: task
Status: resolved
Blocked by: 02

## Question

剧本 AC7：「KB 尝试绑 `judge` → 400 / 403；judge 仅平台级」。IS：KB PUT 走平台 bindings schema，**未禁** `judge`。

请在不改 `ApiResponse` 信封的前提下，于 KB 模型绑定写路径**拒绝** `purpose = judge`：

1. 按 PRD 原文定 400 还是 403，答案里给出处（`prds/05-api` / `prds/07-models` 相关行）。
2. 该拒绝要与既有平台级绑定能力对齐：平台绑 judge 行为**逐位不变**。
3. admin KB 设置页若已有绑定下拉（HALF-KBSET 已落），judge 不得出现在可选项里；下拉必须用 `@strict-rag/ui` 关闭列表。

补测：KB 绑 judge 被拒（含错误码断言）+ 平台绑 judge 不变 + 其它 purpose 不变。

## Answer

**裁定：已由前图 78（KB 消费绑定最小闭环）收口，本图无新工作。**

证据（详见 [`research/gap-is-b.md`](../research/gap-is-b.md)）：

- KB 绑定白名单 schema：`packages/contracts/src/models/model-gateway.contract.ts:172-190` + `KB_CONSUME_PURPOSES`（`:48`）—— `judge` **不在** KB 可绑 purpose 内。
- 写路径：`apps/api/src/routes/kb-settings.ts:187-210` 对越界 purpose 直接返回 **400 `VALIDATION_ERROR`**（不是 403，因为这是入参白名单拒绝，不是权限不足）。
- 测例：`apps/api/tests/kb/kb-consume-bindings-http.test.ts:81-97` 已断言 KB 绑 `judge` 被拒。
- 平台级绑 `judge` 路径不变：`apps/api/src/routes/model-gateway.ts:170-190`。
- admin KB 设置页不列 `judge`：`apps/admin/src/components/settings-workspace.tsx:459`。

结论：AC7 的 Then 已满足。§2.5.2 的登记系滞后（其实现在 2026-08-24 之前已落）。
