# 裁定 K5：非成员读 trace / 审计的闸与其冲突

Type: grilling
Status: open
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

<!-- 解析时写 -->
