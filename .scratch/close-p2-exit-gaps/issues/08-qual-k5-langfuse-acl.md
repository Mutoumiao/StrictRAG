# QUAL-K5：非成员 platform_admin 读 trace / 审计无明文

Type: task
Status: open
Blocked by: 02

## Question

剧本 K5：「非 kb_member 的 platform_admin 读 Langfuse / 审计 → 无该 KB evidence 明文」。IS：Langfuse 默认关（`LANGFUSE_ENABLED` 走 mock export），无非成员读 trace 的明文 ACL。

第一步**先钉事实**：列出仓库现有的 trace / 审计输出面（Langfuse span、Pino 结构化日志、`ask_traces` 回读端点、`/metrics`、admin 审计面等），逐个判定它是否可能带出该 KB 的 evidence 明文。

第二步按事实决定最小实现：凡可能带明文的出口，对**非该 KB 成员**的 platform_admin 一律**遮蔽或拒绝**（按 PRD 原文定口径）；**不得**用「默认关」当作已具备（默认关不等于有闸）。

补测：非成员 platform_admin 拿不到明文；成员与超管行为**逐位不变**。**禁止改鉴权语义（只加严）。**

## Answer

<!-- 解析时写 -->
