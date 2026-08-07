# api · 平台用户与角色（code-spec · B4）

> 路径：`apps/api/src/routes/platform-users-roles.ts` · `services/platform-users-roles.ts`  
> PRD：`prds/05-api` §2.11 · ADR-056  
> 切片：**最小**（CRUD + 授码 + 最后超管闸）；**≠** JWT 读 DB 角色 / bootstrap env / 部门

---

## Scenario: 平台用户 / 角色授码

### 1. Scope / Trigger

- 新增运营账号管理、角色树绑码
- 改 `user.manage` / `role.perm.manage` 闸
- 最后超管保护

### 2. Signatures

| 方法 | 路径 | 中间件 |
|------|------|--------|
| GET/POST | `/api/v1/admin/users` | `requirePermission('user.manage')` |
| GET/PATCH | `/api/v1/admin/users/:userId` | 同上 |
| POST | `/api/v1/admin/users/:userId/roles` | 同上 · body `{ roleIds }` |
| GET/POST | `/api/v1/admin/roles` | `requirePermission('role.perm.manage')` |
| GET/PATCH | `/api/v1/admin/roles/:roleId` | 同上 |
| PUT | `/api/v1/admin/roles/:roleId/permissions` | 同上 · body `{ codes }` |
| GET | `/api/v1/admin/permission-catalog` | 须 `user.manage` **或** `role.perm.manage` |

```typescript
// services/platform-users-roles.ts
createMemoryPlatformUsersRolesRepo(): PlatformUsersRolesRepo
validatePermissionCodes(codes): { ok: true; codes } | { ok: false; invalid }
wouldRemoveLastSuperAdmin({ targetUserId, targetStatus, targetRoleIds, nextStatus, nextRoleIds, allUsers, userRoleMap, rolesById }): boolean
// super_admin = 持有 code==='super_admin' 且 enabled 的角色；active 用户
```

DB：`platform_roles` · `user_roles`（`packages/db` · migration `0004_b4_platform_roles`）

### 3. Contracts

- DTO：`@strict-rag/contracts` · `platform-users-roles.contract.ts`
- 权限码 SSOT：`@strict-rag/admin-catalog` · `isPermissionCode` / `PERMISSION_DEFINITIONS` / `ROLE_TEMPLATES` 种子
- GET 用户/角色**无密码字段**；本切片 Create 亦无 password

### 4. Validation & Error Matrix

| 条件 | HTTP | code |
|------|------|------|
| 无对应 manage 码 | 403 | FORBIDDEN |
| body Zod 失败 | 400 | VALIDATION_ERROR |
| codes 含未知权限 | 400 | VALIDATION_ERROR · details.invalid |
| role code 冲突 | 409 | CONFLICT |
| email 冲突 | 409 | CONFLICT |
| 未知 roleId | 400 | VALIDATION_ERROR |
| 最后 active super_admin 禁用/剥权 | 400 | RULE_VIOLATION |
| 用户/角色不存在 | 404 | NOT_FOUND |

### 5. Good / Base / Bad

- **Good**：super_admin POST 自定义角色 + 合法 codes → 201；两超管禁用其一 → 200  
- **Base**：list roles 含四系统种子  
- **Bad**：kb_admin 调 users → 403；唯一超管 strip roles → 400；`not.a.real.code` → 400

### 6. Tests Required

`apps/api/src/routes/platform-users-roles.test.ts`（真实 Hono + memory repo）：

- 无码 403（users / roles）
- 四系统角色 + 自定义合法/非法码
- PUT permissions 合法/非法
- POST user 绑角色；列表 roleCodes
- 最后超管 / 双超管
- permission-catalog 码集 + 无码 403

### 7. Wrong vs Correct

#### Wrong
```typescript
if (auth.roles.includes('super_admin')) { /* 放行写用户 */ }
// 或 JWT 尚未读 user_roles 却宣称登录权限已随管理台变更
```

#### Correct
```typescript
routes.post('/admin/users', requirePermission('user.manage'), handler)
// 最后超管：wouldRemoveLastSuperAdmin(...) → RULE_VIOLATION
// 登录仍 roleTemplate；DB 角色为管理面（债：JWT 消费 DB）
```

### Design Decision: 超管判定

**Context**：ADR-056 最后超管保护。  
**Decision**：以角色 **code === `super_admin`**（启用）且用户 **active** 计数；不单靠权限码并集（避免自定义全码角色误判为「系统超管」种子）。  
**债**：dev-login / JWT 仍写死 roleTemplate，不读 `user_roles`。
