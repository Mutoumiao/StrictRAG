# QUAL-AB8：分片策略「设置」ADR-053 弹窗

Type: task
Status: resolved
Blocked by: 02

## Question

剧本 AB8：「分片策略『设置』打开 ADR-053 弹窗；保存服 AA 语义」。IS：admin 设置页仅**展示**已实现码，无 053 弹窗。

请按 ADR-053 与产品线稿实现弹窗：

1. **参数形状**：以 ADR-053 与 `packages/contracts` 既有策略形状为准，不新发明参数。
2. **保存路径**：走既有 PATCH（88 已落 diff 审计），服务端校验与前端保持一致；保存后旧文档版本与快照**不变**。
3. **站规**：任何下拉必须用 `@strict-rag/ui` 关闭列表（禁止原生 `<select>`）；文案不得宣传未冻能力（不得暗示「旧文档自动切策略」）。
4. **测**：按 admin 既有测法（组件 / 行为测）。**本机无浏览器验证手段**，答案里必须如实写出哪些部分是**未在浏览器验证**的。

## Answer

**裁定：已由前图 06（策略三层）+ 82（L0 模板 / contextMode）收口，本图无新工作。**

证据（详见 [`research/gap-is-b.md`](../research/gap-is-b.md)）：

- 设置页挂载：`apps/admin/src/components/settings-workspace.tsx:452` 渲染 `chunk-strategy-panel.tsx`。
- 「设置」按钮开 `role="dialog"` 的 053 弹窗（面板内），非只读展示。
- 保存走 `PATCH …/chunk-strategies`（`apps/api/src/routes/chunk-strategies.ts:94-131`），有 diff 时落 `kb_settings_audits` —— 即 AA 语义的服务端侧。
- 旧文档版本与快照不变（同 AA1 的现有口径）。
- 测例已登记：`apps/admin/tests/ops/chunk-strategy-panel.test.tsx`。

**残留不在本票**：`apps/admin/src/components/chunk-strategy-panel.tsx:149-163` 仍有 1 处浏览器原生 `<select>`（面板内策略选择），属**站规余量**——图上 Not yet specified 已记（本机无浏览器验证手段，替换的视觉回归不可验）。它不是 AB8 的功能缺口，不挡本图目的地。
