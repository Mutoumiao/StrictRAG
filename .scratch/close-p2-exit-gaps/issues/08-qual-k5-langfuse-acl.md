# QUAL-K5：非成员 platform_admin 读 trace / 审计无明文

Type: task
Status: resolved
Blocked by: 18

## Question

剧本 K5：「非 kb_member 的 platform_admin 读 Langfuse / 审计 → 无该 KB evidence 明文」。IS：Langfuse 默认关（`LANGFUSE_ENABLED` 走 mock export），无非成员读 trace 的明文 ACL。

第一步**先钉事实**：列出仓库现有的 trace / 审计输出面（Langfuse span、Pino 结构化日志、`ask_traces` 回读端点、`/metrics`、admin 审计面等），逐个判定它是否可能带出该 KB 的 evidence 明文。

第二步按事实决定最小实现：凡可能带明文的出口，对**非该 KB 成员**的 platform_admin 一律**遮蔽或拒绝**（按 PRD 原文定口径）；**不得**用「默认关」当作已具备（默认关不等于有闸）。

补测：非成员 platform_admin 拿不到明文；成员与超管行为**逐位不变**。**禁止改鉴权语义（只加严）。**

## Answer

**裁定：今天已具备，本图无新增工作。**

前置 [18](./18-dec-k5-trace-acl.md) 已把出口逐条查完（证据 [`research/k5-trace-exits.md`](../research/k5-trace-exits.md)）：

- K5 文本范围内的两个口（审计口 `GET /ask/:requestId` · 终态口 `GET /ask/:requestId/final`）**都有成员闸且恒强制登录**；旁路只认角色码 `super_admin`，因此**非成员且非超管的平台账号都已 403**，并有测例钉住（`apps/api/tests/ask/http-audit.test.ts:200-209` · `tests/ask/final-replay.test.ts:233-242`）。
- 其余出口（Langfuse 只有 mock 且**无读取面** · memory tracer 无 HTTP 引用 · Pino 不带正文 · `/metrics` 只有枚举计数 · admin 写日志明示不含 body · 数据面板只回计数 · 会话详情按 `userId` 归属）**都不落该 KB evidence 明文**。
- `http-audit.test.ts` 那条「超管可读 preview」正向断言**不改** —— 超管是 #15 明文允许的，K5 约束的是 `platform_admin`，二者在 `prds/09-security/01-auth-acl-compliance.md:8/331-335` 被显式区分。

**真正的缺实现**在**未来接真 Langfuse 读取面**时（`prds/08-quality/03-langfuse-observability.md:141/148/151/173`），已记入地图 Not yet specified：届时必须带成员过滤 / 哈希载体，且只加严、不动 ask 既有语义。
