# QUAL-ACL-CAP：allowedDocIds 超限拒答（含存废判定）

Type: task
Status: resolved
Blocked by: 02

## Question

剧本 B1-A4：「显式 `allowedDocIds` 且 `len > 5000` → `acl_filter_too_large`；**不截断、无假 `answered`**」。

**本票允许以「划出范围」收口，但必须给证据。** 先判定本项是否仍应实现：

- 前图裁定 103 已把 `allowedDocIds` 下调为雾：语义已冻（ADR-009 决策 3 / 05-api / ES PRD §4.4），但 ES PRD 自标「debug / 评测 / 迁移 · **可选**」，且客户端禁传、仓库无任一此类调用者。
- 请给出**证据行**：`packages/contracts` 现有码与 reasons 文案、`retrieve` 现状（`acl_filter_too_large` 是否**从不**返回）、调用者搜索（是否真无生产者）、以及 §2.5.2 与功能表对 B1-A4 的原文行。

判定分支：

- **做**：在 retrieve 入参闸对显式名单长度做上限检查，超限按契约返回该拒答 reason，**不截断**、不落 `answered`；补测含边界 5000 / 5001 与「未传名单不触发」。
- **划出**：写清理由（无生产者 + 可选标注），关闭本票并在图上记一行 Out of scope。

## Answer

**裁定：划出范围（不做实现）。**

证据（详见 [`research/gap-is-b.md`](../research/gap-is-b.md)）：

- 契约码只在 `packages/contracts/src/ask/reason.ts:23`，文案只在 `apps/api/src/graph/reasons.ts:93` —— 都是**声明**，不是闸。
- 全仓 `allowedDocIds` 共 10 处命中，逐处核对后**全是文档或负向测试**（`packages/contracts/tests/ask/contract.test.ts:113`、`apps/api/tests/members/members-http.test.ts:204`），DB schema 无该列，`ACL_DOC_IDS_MAX` **0 命中**。
- `retrieve` 侧无任何返回 `acl_filter_too_large` 的出口 → 该 reason 今天**不可达**。

结论：与前图裁定 103 同口径 —— 语义已冻但**无生产者**，实现入参闸等于造一条无人调用的半接线，且会给未来的真实生产者预设一个未经产品确认的上限数字。**不做**；`allowedDocIds` 仍在图上 Not yet specified 的「准入条件：先指名真实生产者」条目下。
