# api · 身份与授权（code-spec）

> 路径：`apps/api/src/auth/**` · `apps/api/src/routes/auth.ts`  
> PRD：`prds/09-security/01-auth-acl-compliance.md` · ADR-051 / 056  
> 参考实现形态：`ai-partner-agent`（双 token + 无感 refresh）；**授权语义不照搬 role 放行**

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

业务路由（示例）：

```typescript
// 可选解析（全站）
app.use('*', attachAuthMiddleware)

// 必须登录
app.use('/api/v1/secure/*', requireAuth('admin'))

// 验码（ADR-051）
app.use('/api/v1/...', requirePermission('doc.upload', {
  expectedApp: 'admin',
  resolveKbMember: async (userId, kbId) => /* kb_members */,
}))
```

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
| `AUTH_ENFORCE` | `false` | `true` 时文档/KB 路由 `requirePermissionWhenEnforced`；默认 false 保 demo-ingest |

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
| 路由（建议补） | dev-login 400 体；/me 无 token 401；refresh replay 401 |
| 前端（建议补） | http 在 `UNAUTHORIZED` 时只并发一次 refresh |

### 7. Wrong vs Correct

#### Wrong

```typescript
// 只认角色字符串
if (!claims.roles.includes('admin_owner')) return c.json({ error: 'no' }, 403)

// 权限只信 JWT 快照、改绑码不重算
const codes = claims.permissionsFromJwt
```

#### Correct

```typescript
const effective = resolveEffectiveCodes({ roleCodes: claims.roles })
if (!hasPermission(effective, 'approval.decide')) {
  return fail(c, BizCode.FORBIDDEN, 'missing permission: approval.decide', 403)
}

// refresh 时用当前角色再 issueTokenPair → session.permissions 更新
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
| 改角色后仍旧权限 | 只信 access 内嵌列表、未 refresh | 续签重算；或 access TTL 短 + 敏感操作查库 |
| admin 能进但 API 403 | 正常（UI≠API）或码未挂模板 | 查 catalog 模板绑码 |

---

## 文件地图

```text
packages/contracts/src/auth/session.contract.ts
packages/admin-catalog/src/{permissions,role-templates,menu-tree}.ts
apps/api/src/auth/
  identity/{jwt,refresh-store,token-service}.ts
  permissions/resolve.ts
  middleware.ts
  types.ts
apps/api/src/routes/auth.ts
apps/admin/src/auth/{client-session,api}.ts
apps/admin/src/lib/http.ts
apps/admin/src/components/auth-guard.tsx
apps/web/src/auth/{client-session,api}.ts
apps/web/src/lib/http.ts
```
