# QUAL-G3：提名黄金集审核闸（含存废判定）

Type: task
Status: open
Blocked by: 02

## Question

剧本 G3：「提名黄金集须测试 / 产品审核后才进 `gold.yaml`」。IS：状态枚举有 `promoted_to_gold`；**无审核闸**、无「未审不得进 `gold.yaml`」。前图 84 已把运营表回流纳入写 `gold_questions`（须 `goldType` + `eval.run`），但那份 ≠ `gold.yaml`。

**本票允许以「划出范围」收口，但必须给证据。** 先判定本项是否在范围内：

- 前图裁定 93 记录过「QUAL-G3 功能表无此行」的观点；请在 `prds/12-delivery-guides/14-模块需求功能表.md` 中检索 `gold` / `黄金集` / 审核 相关行，确认功能表**有没有**对应行。
- 同时给出 G3 剧本原文行（`prds/10-delivery/03-acceptance-scenarios.md`）与 `docs/testing/coverage.md` 的现行口径（「运营表回流已部分测；`gold.yaml` 审核闸仍缺」）。

判定分支：

- **做**：落审核闸——谁审（角色 / 权限码）、什么状态才算已审、未审时 `gold.yaml` 生成必须**拒绝或跳过并明示**；补测含「未审不得进」的反例。
- **划出**：写清理由（功能表无对应行 + 现状口径），关闭本票并在图上记一行 Out of scope。

## Answer

<!-- 解析时写 -->
