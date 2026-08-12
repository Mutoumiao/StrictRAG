# api · 身份与授权（code-spec）

> 路径：`apps/api/src/auth/**` · `apps/api/src/routes/auth.ts`  
> PRD：`prds/09-security/01-auth-acl-compliance.md` · ADR-051 / 056  

---

## Scenario: TokenPair 身份 + 权限码授权

### 1. Scope / Trigger

| 触发 | 说明 |
|------|------|
| 新增/改登录、refresh、Bearer 校验 | 跨层身份契约 |
| 新增 API 需登录或验码 | 中间件签名与错误矩阵 |
| 改 env 密钥 / TTL | 生产启动闸 |
| 前端会话存储 / http 拦截器 | admin/web 必须与契约同形 |
| Better Auth 替换签发层 | 须保持 TokenPair 形状或显式适配层 |

**分层焊死**：

| 层 | 职责 | 放行条件 |
|----|------|----------|
| 身份 | 你是谁、会话可否续 | 合法 access Bearer |
| 授权 | 你能做什么 | **有效权限码** 包含 requiredCode（+ kb 成员） |
| 检索 ACL | 你能看见哪篇 | P3；与 RBAC 分离 |

**禁止**：`roles.includes(...)` 单独放行；菜单可见性代替 API 验码；admin/web 共用 localStorage key。

### 2. Signatures

#### HTTP API

| 方法 | 路径 | 中间件 | 说明 |
|------|------|--------|------|
| `POST` | `/api/v1/auth/admin/dev-login` | 无 | 仅 `APP_ENV ∈ {development,test}` |
| `POST` | `/api/v1/auth/web/dev-login` | 无 | 同上 |
| `POST` | `/api/v1/auth/admin/token/refresh` | 无 | body: refreshToken |
| `POST` | `/api/v1/auth/web/token/refresh` | 无 | body: refreshToken |
| `GET` | `/api/v1/auth/me` | `requireAuth()` | 返回主体 + 有效码列表 |
| `GET/POST` | `/api/v1/knowledge-bases/:kbId/members` | `requirePermission('member.manage')` | 列表/邀请；**始终**验码+成员 |
| `DELETE` | `/api/v1/knowledge-bases/:kbId/members/:userId` | 同上 | 移除成员 |

业务路由（示例）：

```typescript
// 可选解析（全站）
app.use('*', attachAuthMiddleware)

// 必须登录
app.use('/api/v1/secure/*', requireAuth('admin'))

// 验码（ADR-051）；:kbId 默认 resolveKbMemberFromDb（请求内缓存）
app.use('/api/v1/...', requirePermission('doc.upload', { expectedApp: 'admin' }))

// ARCH-P1b-1 组合入口（新代码优先）
app.post('/api/v1/kb/:kbId/ask', requireKbScope(), handler) // = requireKbMember
app.get('/api/v1/kb/:kbId/chunks', requireKbScope({ permission: 'chunk.view' }), handler)
app.post('/api/v1/kb/:kbId/documents', requireKbScope({ permission: 'doc.upload', whenEnforced: true }), handler)

// ask / sessions：始终成员闸（与 AUTH_ENFORCE 无关；super_admin 旁路）
app.post('/api/v1/kb/:kbId/ask', requireKbMember(), handler)

// handler 无 path :kbId 时（如 feedback 从 trace 取 kb）
const r = await evaluateKbMember(c, kbIdFromTrace)
const p = await checkPermission(c, 'feedback.queue', { kbId: row.kbId })
```

**ARCH-P1b-1 · KB 作用域组合**

| 符号 | 职责 |
|------|------|
| `lookupKbMembership` | 纯函数；`Map` 缓存同 `(userId, kbId)` 只 resolve 一次（`auth/kb-scope.ts`） |
| `requireKbScope({ permission?, whenEnforced? })` | 组合入口：无码→成员；有码→`requirePermission`；`whenEnforced`→`WhenEnforced` |
| `evaluateKbMember` / `checkPermission(..., { kbId })` | handler 级；路径无 `:kbId` 时覆盖 |
| `ApiVariables.kbMemberCache` | 请求内缓存；跨请求不复用 |

既有 `requirePermission` / `requireKbMember` / `requirePermissionWhenEnforced` **保留**且走同一缓存。

**AUTH_ENFORCE vs 成员闸**：

| 路由类 | 默认 | 说明 |
|--------|------|------|
| 入库 documents | `requirePermissionWhenEnforced` | false 时 demo-ingest 无 token |
| members / ask / sessions / **chunks** / **kb settings** | `requirePermission` / `requireKbMember` / `requireKbScope` | **始终**登录+码/成员；不改 AUTH 默认；chunks=`chunk.view`；settings=`kb.config.write` |

#### 权限求值

```typescript
// apps/api/src/auth/permissions/resolve.ts
resolveEffectiveCodes({ roleCodes, extraGrants?, extraDenies? }): Set<PermissionCode>
hasPermission(effective, required): boolean
canEnterAdminShell(effective): boolean  // 'admin.shell'
canAccessKbScoped({ roleCodes, effective, requiredCode, isKbMember }): boolean
```

#### 身份签发（过渡；可被 Better Auth 替换）

```typescript
// apps/api/src/auth/identity/token-service.ts
issueTokenPair({ userId, app, roles, tenantId?, email?, sessionId? }): Promise<TokenPairResponse>
refreshTokenPair(refreshToken, expectedApp?): Promise<TokenPairResponse>
verifyBearerAccess(authorizationHeader, expectedApp?): Promise<AccessTokenClaims>
```

#### 角色 hydrate（B4-W · task `08-11-b4-w-jwt-db-roles`）

```typescript
// apps/api/src/auth/role-hydrate.ts
hydrateAuthz({ userId, tenantId?, claimsRoles, nowMs? }): Promise<HydratedAuthz>
// 身份 = JWT；roles / effectiveCodes = DB user_roles∪platform_roles.codesJson（启用）
// 缓存 ≤5s 进程内（ROLE_CACHE_TTL_MS）；写路径 invalidateRoleCache(userId|全表)
// 单实例假设：多实例无共享失效 → 最多 ~5s 脏读（**未**做 Redis 广播）
// loader 超时 ROLE_LOAD_TIMEOUT_MS（test/VITEST=500ms，其它=3000ms）→ 回退 claims，不拖死请求
// vitest 默认 RoleAuthzLoader = async () => null（不连 PG；role-hydrate 测例 inject memory）
// dev/test 空绑或 loader null → claims；production 空绑 = 空权限（不回退 claims 模板）
ensureUserRoleCodes({ userId, tenantId?, roleCodes, repo? }) // dev-login bootstrap
setRoleAuthzLoader(fn | null) // 测例注入；null = 恢复 defaultRoleAuthzLoader
createDbRoleAuthzLoader(repo)
```

中间件：`attachAuth` / `ensureAuth` 验 JWT 后调用 `hydrateAuthz`，**覆盖** `auth.roles` 与 `effectiveCodes`。  
写路径：`platform-users-roles` 改绑 / 改角色码 → `invalidateRoleCache`。

> **Gotcha**：单测若未 `setRoleAuthzLoader`，hydrate **不会**打 PG（避免 departments 等测例被半开连接挂死）。需要 DB 语义时必须 inject。

#### 权限数据模型 · Runtime Truth（X-10 · DEC-X1 默认）

> **DEC-X1 默认（未开 ADR 前）**：以 **现状 schema + hydrate** 为 Runtime Truth 焊死 HOW；**不**假装已落地 PRD 理想三表。终态若迁三表 → **须 ADR → 改 PRD → 再改 schema**。

| 层 | 真相 | 非真相 |
|----|------|--------|
| **码字典 SSOT** | `@strict-rag/admin-catalog` `PERMISSION_DEFINITIONS` | contracts / 前端硬编码全集 |
| **角色模板（种子默认）** | admin-catalog `ROLE_TEMPLATES` | JWT `roles` 列表本身 |
| **运行时有效码** | PG：`user_roles` ⋈ 启用的 `platform_roles.codes_json` → `hydrateAuthz` | access JWT 内嵌 roles 当放行条件 |
| **身份** | access JWT `sub` / `sid` / `app` | — |

##### Schema Delta（有意偏差 · 已接受过渡）

| PRD/理想（摘要） | 当前 schema | 代理行为 |
|------------------|-------------|---------|
| 角色 ↔ 权限 规范化关联表 | **`platform_roles.codes_json: string[]`** | 角色行内嵌码数组；写路径校验 ⊆ catalog |
| 用户 ↔ 角色 | `user_roles` 多对多 | **已对齐** |
| 每次请求算有效码 | `hydrateAuthz` + ≤5s 缓存 | **已对齐**（多实例脏读 ≤TTL） |
| JWT 带全量 codes | JWT **仅** roles 模板锚点 | 放行看 hydrate 后 `effectiveCodes` |

##### 放行判定（Runtime）

```text
Bearer access 验签
  → hydrateAuthz（DB 优先；超时/dev 空绑规则见上）
  → requirePermission(code) / requireKbMember
  → 菜单 clip：admin-catalog filterMenuByCodes(effectiveCodes)
```

| 禁项 | 正确 |
|------|------|
| 只信 JWT `roles` 字符串放行 | 信 `effectiveCodes`（hydrate 后） |
| 在 api 复制第二份权限码表 | 改 catalog + DB 角色 `codes_json` |
| 把 `codes_json` 当终态却写「已符合 PRD 三表」 | HOW 标明过渡；迁表走 DEC-X1 ADR |
| 改角色后不 `invalidateRoleCache` | 写路径必失效 |

##### 交叉

- catalog：[admin-catalog catalog-ssot](../../admin-catalog/library/catalog-ssot.md)  
- schema：`packages/db/src/schema/system/platform-roles.ts`  
- 产品终态确认：挂账 **DEC-X1**（确认前勿当三表已交付）

#### Access JWT claims

| claim | 类型 | 说明 |
|-------|------|------|
| `sub` | string | userId |
| `sid` | string | sessionId |
| `app` | `'admin' \| 'web'` | 子站隔离 |
| `roles` | string[] | **模板锚点**，非放行条件 |
| `tenantId` | string? | 可选 |
| `email` | string? | 可选 |
| `jti` | string | access 每次签发唯一（防同秒撞车） |

Refresh JWT：`sub` · `sid` · `app` · `jti`（落库/内存状态，用于 rotation）。

### 3. Contracts

#### Request / Response（`@strict-rag/contracts` · `auth/session.contract.ts`）

**DevLoginRequest**

| 字段 | 类型 | 约束 |
|------|------|------|
| `email` | string | email |
| `roleTemplate` | enum? | `super_admin` \| `kb_admin` \| `doc_operator` \| `web_consumer` |
| `tenantId` | string? | 可选 |

**TokenRefreshRequest**

| 字段 | 类型 |
|------|------|
| `refreshToken` | string min 1 |

**TokenPairResponse (`data`)**

| 字段 | 类型 |
|------|------|
| `accessToken` | string |
| `refreshToken` | string |
| `tokenType` | `'Bearer'` |
| `expiresInSec` | int > 0 |
| `refreshExpiresInSec` | int > 0 |
| `session` | AuthSession |

**AuthSession**

| 字段 | 类型 | 说明 |
|------|------|------|
| `sessionId` | string | |
| `userId` | string | |
| `app` | admin \| web | |
| `roles` | string[] | 锚点 |
| `permissions` | string[] | **快照**（菜单裁剪）；API 仍服务端再算 |
| `tenantId` | string? | |
| `email` | string? | |
| `expiresAtMs` | int | refresh 窗口 |

**GET /auth/me `data`**

| 字段 | 类型 |
|------|------|
| `userId` · `sessionId` · `app` · `roles` · `permissions` · `email?` · `tenantId?` | 同语义 |

#### Environment

| Key | 默认 | 约束 |
|-----|------|------|
| `JWT_ACCESS_SECRET` | `dev-only-access-secret-change-me` | min 16；**production 禁止含 dev-only** |
| `JWT_REFRESH_SECRET` | `dev-only-refresh-secret-change-me` | 同上 |
| `ACCESS_TOKEN_TTL_SEC` | `900` | int > 0 |
| `REFRESH_TOKEN_TTL_SEC` | `604800` | int > 0 |
| `AUTH_ENFORCE` | `false` | `true` 时文档/KB 路由 `requirePermissionWhenEnforced`；默认 false 保 demo-ingest；**禁止**改仓库默认 on |
| （运行时） | `isAuthEnforceEnabled()` | **优先**读 `process.env.AUTH_ENFORCE`（`vi.stubEnv` 即时生效，无需重载 Zod env）→ 回退模块 `env`；QUAL-1 已归档 |
#### Hono Variables

```typescript
// ApiVariables（request-id 初始化）
{
  requestId: string
  auth: AuthPrincipal | null      // attachAuth 始终写入
  effectiveCodes: Set<string>     // 未登录为空 Set
}
```

### 4. Validation & Error Matrix

| 条件 | HTTP | BizCode | message 语义 |
|------|------|---------|--------------|
| body 不符合 Zod | 400 | `VALIDATION_ERROR` | invalid body |
| 非 development 调 dev-login | 404 | `NOT_FOUND` | not available |
| web_consumer 调 admin dev-login | 403 | `FORBIDDEN` | web_consumer cannot login admin |
| 无/坏 Bearer 调 requireAuth 或 /me | 401 | `UNAUTHORIZED` | access token required/invalid |
| refresh 无效/过期/未知 jti | 401 | `UNAUTHORIZED` | refresh token … |
| refresh **replay**（used 后再用） | 401 | `UNAUTHORIZED` | refresh token replay；**整 session 吊销** |
| 缺权限码 | 403 | `FORBIDDEN` | `missing permission: {code}` |
| kb scope 且非成员且非超管 | 403 | `FORBIDDEN` | not a knowledge base member |
| expectedApp 不匹配 | 403 | `FORBIDDEN` | wrong application context |
| admin 壳无 `admin.shell` | 403 | `FORBIDDEN` | admin.shell required |

信封：统一 `ok: false, error: { code, message, details? }, meta`。

### 5. Good / Base / Bad Cases

| 类 | 场景 |
|----|------|
| **Good** | admin dev-login → `super_admin` → 含 `admin.shell` + 全码；refresh 得新 access；旧 refresh 再刷 → 401 + session 吊销 |
| **Good** | `doc_operator` 有 `doc.upload`、无 `approval.decide` |
| **Good** | `web_consumer` 无 `admin.shell`；admin Guard 拒绝 |
| **Base** | `AUTH_ENFORCE=false`：入库路由仍可无 Bearer 演示 |
| **Base** | `attachAuth` 无 header → `auth=null`，不中断公开路由 |
| **Bad** | handler 内 `if (roles.includes('super_admin')) return` 且不验码 |
| **Bad** | admin/web 共用 `localStorage` key 导致 token 串用 |
| **Bad** | 仅前端藏菜单、API 不 `requirePermission` |

### 6. Tests Required

| 测试 | 断言点 |
|------|--------|
| `auth/permissions/resolve.test.ts` | super_admin 全码；doc_operator 无 approval.decide；web_consumer 无 shell；union/deny；kb 成员 AND |
| `auth/identity/token-service.test.ts` | issue+verify；refresh 轮换 access 不同；replay 抛 `AuthIdentityError`；app 错配拒绝 |
| `auth/role-hydrate.test.ts` | B4-W DB 覆盖 JWT、缓存/invalidate、bootstrap、timeout→claims、成员 403 回归 |
| `auth/auth-enforce.redline.test.ts` | QUAL-1（已归档）：`vi.stubEnv` enforce=true 无 Bearer → 401 UNAUTHORIZED；默认仍关；unstub 还原 |
| 路由（建议补） | dev-login 400 体；/me 无 token 401；refresh replay 401 |
| 前端（建议补） | http 在 `UNAUTHORIZED` 时只并发一次 refresh |

### 7. Wrong vs Correct

#### Wrong

```typescript
// 只认角色字符串
if (!claims.roles.includes('admin_owner')) return c.json({ error: 'no' }, 403)

// 权限只信 JWT 快照、改绑码不重算
const codes = claims.permissionsFromJwt

// 跳过 hydrate，直接用 JWT roles 当 effectiveCodes
c.set('effectiveCodes', new Set(claims.roles))
```

#### Correct（X-26 · 展示 hydrate）

```typescript
// attachAuth / ensureAuth 路径（示意）
const claims = await verifyBearerAccess(authorization, expectedApp)
const hydrated = await hydrateAuthz({
  userId: claims.sub,
  tenantId: claims.tenantId,
  claimsRoles: claims.roles,
})
// 身份 = JWT；放行码 = DB（或策略回退）后的 effectiveCodes
c.set('auth', {
  userId: claims.sub,
  roles: hydrated.roles,           // DB 覆盖后的角色锚点
  /* … */
})
c.set('effectiveCodes', hydrated.effectiveCodes)

// 业务闸
if (!hasPermission(c.get('effectiveCodes'), 'approval.decide')) {
  return fail(c, BizCode.FORBIDDEN, 'missing permission: approval.decide', 403)
}
// 写角色/绑码后：invalidateRoleCache(userId)
```

---

## Design Decision: 双 JWT 过渡 vs Better Auth

**Context**：需要 localStorage + 无感刷新与参考项目对齐；最终身份希望 Better Auth（微信等）。

**Options**：
1. 直接只接 Better Auth  
2. 先双 JWT 过渡 + TokenPair 契约，再换签发  
3. 自研到底  

**Decision**：选 **2**。  
- 客户端与 contracts 稳定  
- 授权层（catalog + requirePermission）永不绑身份库  
- Better Auth 替换 `identity/token-service` 或挂 `/api/auth/*`，适配器吐出同一 `TokenPairResponse`（或 http 适配 BA token）

**Extensibility**：refresh 存储从进程 Map → Redis/PG；`resolveKbMember` 接 `kb_members` 表。

---

## Design Decision: 有效码 = 角色绑码并集（非 role 放行）

**Context**：参考项目用 `roles.includes`；PRD ADR-051 要求以码为准。

**Decision**：`defaultCodesForRoles`（admin-catalog 模板）∪ grants − denies；超管 `bypassKbMembership` 仅作用于 **kb scope**。

---

## 前端配套（交叉）

| App | storage key | refresh 路径 | Guard |
|-----|-------------|--------------|-------|
| admin | `strict-rag:admin:client-session` | `/api/v1/auth/admin/token/refresh` | `AdminAuthGuard` 须 `admin.shell` |
| web | `strict-rag:web:client-session` | `/api/v1/auth/web/token/refresh` | 登录壳；无 shell |

http：`UNAUTHORIZED` → **单飞** refresh → 重试；失败 `clearClientSession`。

---

## Common Mistakes

| 症状 | 原因 | 修复 |
|------|------|------|
| 同秒 refresh 后 access 字符串相同（测试误失败） | JWT 无 jti 且 iat 相同 | access 签发必须 `setJti(uuidv7())` |
| demo-ingest 全 401 | 误开 `AUTH_ENFORCE` 且业务已挂 requireAuth | 本地保持 false，或脚本带 token |
| 改角色后仍旧权限 | 只信 access 内嵌列表、未 invalidate | B4-W：`invalidateRoleCache` + 每请求 hydrate；缓存 ≤5s |
| vitest 全套 hang 在 departments/model-gateway | hydrate 默认打真 PG | vitest 默认 null loader；需 DB 时 `setRoleAuthzLoader` |
| admin 能进但 API 403 | 正常（UI≠API）或码未挂模板 | 查 catalog 模板绑码 |

---

## 文件地图

```text
packages/contracts/src/auth/session.contract.ts
packages/admin-catalog/src/{permissions,role-templates,menu-tree}.ts
apps/api/src/auth/
  identity/{jwt,refresh-store,token-service}.ts
  permissions/resolve.ts
  role-hydrate.ts          # B4-W DB 角色 + ≤5s 缓存
  kb-scope.ts              # ARCH-P1b-1 成员缓存纯函数
  middleware.ts            # attachAuth · require* · requireKbScope · evaluateKbMember
  types.ts
apps/api/src/routes/auth.ts
apps/admin/src/auth/{client-session,api}.ts
apps/admin/src/lib/http.ts
apps/admin/src/components/auth-guard.tsx
apps/web/src/auth/{client-session,api}.ts
apps/web/src/lib/http.ts
```
