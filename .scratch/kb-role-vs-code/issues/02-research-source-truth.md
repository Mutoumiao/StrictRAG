# 02 · research：源码实况（role 读取点与被点名的 role 条件路径）

Type: research
Status: resolved
Blocked by: 无

## 结果

### 表一 · 谁读 `kb_members.role`

全仓**唯一**一处把该列查出来的 SQL：

| 文件:行 | 符号 | 用途 |
|---------|------|------|
| `apps/api/src/services/members.ts:98` | `membersRepo.list()` 的 `.select({ …, role: kbMembers.role, … })` | 仅供 `GET /knowledge-bases/:kbId/members` |
| `apps/api/src/routes/members.ts:51` | `role: r.role as KbMember['role']` | 消费上值并回吐响应（**纯 TS cast，无运行时校验**） |
| `packages/contracts/src/ask/member.contract.ts:20-29` | `KbMemberSchema` / `type KbMember` | 类型契约；**全仓无任何 `.parse()` 调用**该 schema |

写入点只有三处：`apps/api/src/services/documents.ts:53`（建库硬编码 `'admin' satisfies KbMemberRole`）、`services/members.ts:144-151`（invite，来自 body）、`services/members.ts:160-168`（`updateRole`）。

DDL：`packages/db/src/schema/kb/kb-members.ts:16` `role: text('role').notNull().default('read')`（列注释在 `:7`：「库内锚点；**运行时授权以权限码为准**」）；迁移 `packages/db/drizzle/0002_phase2_ask_foundation.sql:25`；快照 `packages/db/drizzle/meta/0021_snapshot.json:1886-1890`（带 default `'read'`）；同文件 `:1920` `"checkConstraints": {}` —— **DB 层无 CHECK**。

**明确不读的位置**：`apps/worker/src`、`apps/web/src` 里的 `role` 全是 LLM 消息角色或 ARIA `role=`（已逐处核对）；`docker/` 无 SQL；全仓 `from/insert/update/delete(kbMembers)` 仅 7 处，集中在 `services/members.ts` 与 `services/documents.ts`。

### 表二 · 被条款点名的 role 条件判定

| 条款 | 源码里有没有 | 证据 |
|------|--------------|------|
| ADR-035 §5（read 不得上传/删文档/改成员/config/评测） | **无** | 无任何按 role 值的判定；role 值在**类型上**进不了鉴权链路 |
| ADR-035 §7（write 只能删自己上传的；删他人仅 kb admin） | **无** | `apps/api/src/services/document-delete.ts:13-21` `evaluateDocumentDelete(doc: { id: string } \| null)` —— **入参只有 id**，无 actor、无 `uploadedBy`、无 role；`routes/documents/index.ts:698-735` 删除全流程逐行读完，`uploadedBy` **在读路径之外从不参与删除判定**（全仓读 `uploadedBy` 仅 `documents/index.ts:491,532` 的 ADR-048 自审闸 + `mappers.ts:48` 响应字段） |
| ADR-045 焊死 #1（handler 按矩阵校验 role） | **半有半无** | handler 级成员纵深闸**确实存在**（`auth/doc-scope.ts:42-54` + `documents/index.ts` 15 处调用），但判据是 boolean，**不校验 role 值** |
| ADR-045 焊死 #3（对某 KB 的写按该行 role） | **无** | 「read-only KB」在源码中**没有对应物**：`packages/db/src/schema/kb/knowledge-bases.ts:9-15` 无只读开关列；`knowledge_bases.status` 无任何鉴权路径读它做写拦截 |
| ADR-035 §6（建库写入首任 `role=admin`） | **有** | `services/documents.ts:48-55` 事务内硬编码 `role: 'admin'`；body 契约无 role 字段（`packages/contracts/src/ingest/document.contract.ts:23-27`） |
| ADR-035 §3（role 取值与校验） | **半有半无** | 枚举定义齐（`contracts/…/member.contract.ts:4-5`、`services/members.ts:10`）；HTTP 边界有 Zod（`routes/members.ts:63,106`）；**DB 无 CHECK**；读取侧 `MemberListRow.role: string`（`services/members.ts:15`）+ cast；改 role 只有 `member.manage` 一个码（`routes/members.ts:36`），**无**「不得移除最后一个 admin」「不得自我降级」类判定 |

### 为什么 role 传不出来（类型层面的根因）

| 位置 | 签名 |
|------|------|
| `apps/api/src/auth/middleware.ts:26` | `export type ResolveKbMember = (userId: string, kbId: string) => Promise<boolean>;` |
| `apps/api/src/auth/kb-scope.ts:6` | `export type ResolveKbMemberFn = (userId: string, kbId: string) => Promise<boolean>;` |
| `apps/api/src/auth/permissions/resolve.ts:43-54` | `canAccessKbScoped({ roleCodes, effective, requiredCode, isKbMember })` —— 入参**无 role**；此处的 `roleCodes` 是**平台角色码**（`super_admin` 等），**不是** `kb_members.role` |
| `apps/api/src/auth/kb-scope.ts:16-28` | `lookupKbMembership({ …, cache: Map<string, boolean>, … }): Promise<boolean>` |
| `apps/api/src/auth/middleware.ts:158-160` | `GateResult` **不含角色字段** |
| `apps/api/src/services/members.ts:84-91` | `isMember` 的 SQL 只 `select({ id: kbMembers.id })` —— **不取 role 列** |
| `apps/api/src/auth/permissions/resolve.ts:7-11` | 注释自认：「放行唯一条件：有效码包含 requiredCode（+ kb 成员上下文，超管旁路）。**禁止只判断 role 字符串**」 |

### 最接近的替代判定（实际生效的闸）

| 条款动作 | 实际闸（权限码） | 定义行 |
|----------|------------------|--------|
| 上传 | `doc.upload` | `routes/documents/index.ts:198,244,278,548` |
| 删文档 | `doc.lifecycle` | `routes/documents/index.ts:701` |
| 改成员 | `member.manage` | `routes/members.ts:36` |
| 改 config | `kb.config.write` | `routes/kb-settings.ts:89`；`routes/chunk-strategies.ts:45` |
| 跑评测 | `eval.run` | `routes/eval.ts:117` |

`read` 之所以过不去，只因 `web_consumer` 模板 `defaultCodes: []`（`packages/admin-catalog/src/role-templates.ts:59-62`），而 `kb_admin` 模板含上述全部码（同文件 `:24-34`）。**这是「模板默认绑码」，不是 role 判定**，且可经角色树授码（`role-templates.ts:5-6` 注释）。

## 未验证

本工单为**只读静态调查**，未运行任何测试或构建。`apps/api/tests/**` 中 role 相关断言只核到接口形状。
