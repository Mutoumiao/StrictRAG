# 裁定 K5：非成员读 trace / 审计的闸与其冲突

Type: grilling
Status: resolved
Blocked by: 02

## Question

剧本 K5：「非 `kb_member` 的 `platform_admin` 读 Langfuse / 审计 → **不得**看到该 KB 的 evidence 明文」。

核查结论：**真未做**，且存在一处**反向钉死的既有断言**：

- `/ask/:requestId` 与 `/final` 有成员闸（`apps/api/src/routes/ask.ts:448/460`），但 `super_admin` 旁路成员闸（`apps/api/src/auth/middleware.ts:239-242` + `role-templates.ts:81-83`）。
- `platform_admin` 正是超管的平台角色标签（`apps/api/src/auth/auth.ts:55`、`superadmin-bootstrap.ts:178`）。
- `apps/api/tests/audit/http-audit.test.ts:226-236` 把「超管可读 evidence preview」钉成**正向断言**。

请先钉事实再裁定：

1. **PRD 原文**：给出 K5 的剧本原文行（`prds/10-delivery/03-acceptance-scenarios.md`）与 05-api / 08-quality 中关于 trace / 审计读取权限的冻结语义行；确认 K5 要求的「无明文」指的是 **trace / 审计出口**，还是也包括 ask 回读端点。
2. **列出全部出口**：逐个判定谁可能带出该 KB 的 evidence 明文（Langfuse span 内容、Pino 日志字段、`ask_traces` 回读、`/metrics`、admin 审计面），标出哪些今天**已经**有闸。
3. **裁定**：K5 的闸加在哪一层、按什么口径（遮蔽 / 拒绝 / 脱敏）；与映射表 #15「非成员且非超管不可 ask；超管全权」是否冲突——若冲突，说明 K5 是否只覆盖 **trace / 审计** 而不动 ask 的既有语义。
4. **既有断言怎么办**：`http-audit.test.ts:226-236` 那条正向断言是本图要改的（说明改法），还是 K5 不触及它（说明为什么）。

答案须落到可编码精度；**不得**放宽既有成员闸与鉴权语义。

## Answer

全量取证见 [`research/k5-trace-exits.md`](../research/k5-trace-exits.md)（只读核查，未改任何源码）。

### 一、K5 字面只覆盖 trace / 审计出口

- 剧本 K5 原文：`prds/10-delivery/03-acceptance-scenarios.md:171`（I5 见 `:560`）。
- **「审计口」就是 `GET /ask/:requestId`**：`prds/05-api/01-http-api-hono.md:435/438/441`；它回的 evidence 快照含 preview 明文（截断 200 字，`apps/api/src/services/ask/traces.ts:116-141` · `packages/contracts/src/ask/ask.contract.ts:110`）。
- **`GET /ask/:requestId/final` ≠ 审计口**：源码注释与 module-status 显式如此标注（`apps/api/src/routes/ask.ts:477-479` · `docs/module-status/api.md:155`），它是断线重拉口，**不在 K5 文本范围**。

### 二、出口逐条判定：今天没有任何一条能泄漏该 KB 明文

| 出口 | 判定 | 依据 |
|------|------|------|
| `GET /ask/:requestId`（审计口） | 有成员闸 + 恒强制登录 | `routes/ask.ts:460` · `auth/middleware.ts:137-145` |
| `GET /ask/:requestId/final` | 同上 | `routes/ask.ts:490` |
| Langfuse | **只有 mock，且没有读取面**：`LANGFUSE_ENABLED` 默认 `false`（`apps/api/src/env.ts:149-153`），tracer 只打 span 名与 scores 日志，无 SDK、无 HTTP 读取入口（`apps/api/src/obs/ask-tracer.ts:65-74`） | 同左 |
| memory tracer | 进程内 Map，**无任何 HTTP 路由引用**（`obs/memory-tracer.ts:21` · `obs/index.ts:47-48`） | 同左 |
| Pino 日志 | 16 处 `log.*` 均不带正文（`apps/api/src/logger.ts:20-31`） | 同左 |
| `GET /metrics` | 无鉴权但标签只有枚举计数（`apps/api/src/app.ts:80` · `obs/metrics.ts`） | 同左 |
| admin 写日志 | 明示**不含 body**（`middleware/admin-write-audit.ts:50`） | 同左 |
| 数据面板 | 只回计数（`routes/dashboard.ts:27/34`） | 同左 |
| 会话详情 | 按 `userId` 归属（`routes/sessions.ts:91` · `services/sessions.ts:120-140`） | 同左 |

**授权判定只认角色码**：旁路只认 `super_admin`（`auth/middleware.ts:240` · `packages/admin-catalog/src/role-templates.ts:81-83`）。因此**非成员且角色码非 `super_admin` 的平台账号在两个口上都已 403**，并有测例钉住：`apps/api/tests/ask/http-audit.test.ts:200-209` · `tests/ask/final-replay.test.ts:233-242`。

### 三、裁定

1. **K5 与映射表 #15 不冲突。** #15 的允许方是 `super_admin`（`prds/09-security/01-auth-acl-compliance.md:103/252`），K5 约束的是 `platform_admin`（ADR-035 语义，`prds/09-security/01-auth-acl-compliance.md:8/331-335`）—— 二者在 09-security §5 被**显式并列区分**。表面「冲突」来自源码把超管的 `users.platform_role` 列值写成 `'platform_admin'`（`routes/auth.ts:55` · `services/superadmin-bootstrap.ts:178`），而**授权路径从不读 `platform_role`**。所以「改 `http-audit.test.ts` 那条超管正向断言」是**误判** —— **不动它**。
2. **本图无新实现**：K5 今天要防的出口都已 403，且 Langfuse 无读取面可加闸。
3. **真正的缺实现落点记入雾中**：**未来接真 Langfuse 读取面**时必须带成员过滤 / 哈希载体（`prds/08-quality/03-langfuse-observability.md:141/148/151/173`）。届时按「只加严」补闸，不动 ask 既有语义。

**结论**：K5 收口为「今天已具备，无新增工作」；下游 [08](./08-qual-k5-langfuse-acl.md) 随之关闭。
