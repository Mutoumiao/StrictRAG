# QUAL-ACL-CAP：allowedDocIds 超限拒答（含存废判定）

Type: task
Status: open
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

<!-- 解析时写 -->
