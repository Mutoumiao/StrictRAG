# QUAL-AC7：KB 绑 judge 必须被拒

Type: task
Status: open
Blocked by: 02

## Question

剧本 AC7：「KB 尝试绑 `judge` → 400 / 403；judge 仅平台级」。IS：KB PUT 走平台 bindings schema，**未禁** `judge`。

请在不改 `ApiResponse` 信封的前提下，于 KB 模型绑定写路径**拒绝** `purpose = judge`：

1. 按 PRD 原文定 400 还是 403，答案里给出处（`prds/05-api` / `prds/07-models` 相关行）。
2. 该拒绝要与既有平台级绑定能力对齐：平台绑 judge 行为**逐位不变**。
3. admin KB 设置页若已有绑定下拉（HALF-KBSET 已落），judge 不得出现在可选项里；下拉必须用 `@strict-rag/ui` 关闭列表。

补测：KB 绑 judge 被拒（含错误码断言）+ 平台绑 judge 不变 + 其它 purpose 不变。

## Answer

<!-- 解析时写 -->
