# admin-catalog · SSOT 规则（code-spec）

> 路径：`packages/admin-catalog/src/*`  
> ADR-051 权限码 · ADR-056 catalog

---

## Scenario: 权限码与角色模板 SSOT

### 1. Scope / Trigger

- 新增菜单项 / API 动作  
- 改角色默认能力  
- 前后端任一端需要「能不能点/能不能调」

### 2. Signatures

```typescript
// permissions.ts
PERMISSION_DEFINITIONS: readonly PermissionDef[]
ALL_PERMISSION_CODES: readonly PermissionCode[]
isPermissionCode(code: string): code is PermissionCode
getPermissionDef(code: string): PermissionDef | undefined

// role-templates.ts
ROLE_TEMPLATES: readonly RoleTemplate[]
defaultCodesForRoles(roleCodes: readonly string[]): Set<PermissionCode>
roleBypassesKbMembership(roleCodes: readonly string[]): boolean
getRoleTemplate(code: string): RoleTemplate | undefined

// menu-tree.ts
MENU_TREE: readonly MenuNode[]
ADMIN_IMPLEMENTED_HREFS: ReadonlySet<string>  // 已落地 admin 路由；新页须先 page 再登记
// 当前含：/dashboard /documents /approvals /members /chunks /kb/settings /models /users /roles /departments
filterMenuByCodes(tree, codes: ReadonlySet<string>): MenuNode[]
clipMenuForShell(codes, tree?=MENU_TREE, implemented?=ADMIN_IMPLEMENTED_HREFS): MenuNode[]
collectMenuHrefs(nodes): string[]  // 测试/调试
```

### 3. Contracts

**PermissionDef**

| 字段 | 类型 | 约束 |
|------|------|------|
| `code` | string | 稳定 id，如 `doc.upload` |
| `kind` | `page` \| `action` \| `page+action` | |
| `scope` | `platform` \| `kb` | kb 须成员（超管 bypass） |
| `description` | string | |

**RoleTemplate**

| code | bypassKbMembership | 默认码要点 |
|------|-------------------|------------|
| `super_admin` | true | 全部 `ALL_PERMISSION_CODES` |
| `kb_admin` | false | shell + 文档/审批/成员/配置… |
| `doc_operator` | false | shell + upload/editor；**无** `approval.decide` |
| `web_consumer` | false | **空码**（无 admin.shell） |

**MenuNode**：`permission?: PermissionCode` 控制可见；缺省仅需已登录壳策略。

**壳侧双闸**：`filterMenuByCodes`（有码才显）∩ `ADMIN_IMPLEMENTED_HREFS`（已落地才链）。  
`clipMenuForShell` = 两闸合一；**禁止**在 `apps/admin` 再硬编码 href 白名单。

### 4. Validation & Error Matrix

| 条件 | 结果 |
|------|------|
| 新码未进 `PERMISSION_DEFINITIONS` | **禁止**在 api/admin 字符串字面量放行 |
| 菜单 permission 不在码表 | 编译/评审失败；filter 永不可见 |
| 删码仍被 role 引用 | 须发版+迁移；禁止静默删（ADR-056） |
| 新页已建但未进 `ADMIN_IMPLEMENTED_HREFS` | 有码也**不**进壳导航（防 404） |
| 仅有码、页未落地 | catalog 可有 MENU_TREE 节点；壳经 clip 隐藏 |

### 5. Good / Base / Bad

| 类 | 例 |
|----|-----|
| Good | 新模块先加 `PERMISSION_DEFINITIONS` → 模板绑码 → 菜单 → page → `ADMIN_IMPLEMENTED_HREFS` → `requirePermission` |
| Base | `PERMISSIONS` 导出 = 全部 code 字符串列表（兼容旧名） |
| Bad | admin 本地 `const PERMISSIONS = [...]` 第二份 |
| Bad | admin shell `const implemented = new Set([...])` 第二份白名单 |
| Bad | api `if (code === 'doc.upload')` 字面量与 catalog 漂移 |

### 6. Tests Required

- catalog 导出非空；`super_admin` 默认码包含 `admin.shell` 与 `approval.decide`  
- `doc_operator` 默认不含 `approval.decide`  
- `filterMenuByCodes` 无码节点被裁掉  
- `clipMenuForShell`：三角色可见 href ⊆ implemented；`super_admin` 全码仍不露 `/dashboard`/`users`/`roles`；**含** `/models`（B3）  
- `kb_admin` 默认无 `model.gateway.manage` → clip **无** `/models`  
- 空码 → clip 无叶子  

（api `tests/acl/permission-resolve.test.ts` 已覆盖模板求值。）

### 7. Wrong vs Correct

#### Wrong

```typescript
// apps/admin — 第二份白名单 / 角色公式
const canApprove = user.role === 'kb_admin'
const implemented = new Set(['/documents', '/approvals'])
const menu = filterMenuByCodes(MENU_TREE, codes).filter(...)
```

#### Correct

```typescript
import { clipMenuForShell } from '@strict-rag/admin-catalog'
const menu = clipMenuForShell(new Set(me.permissions))
// API 仍 requirePermission('approval.decide')；菜单可见 ≠ 授权
```

---

## 规则摘要

| 规则 | 说明 |
|------|------|
| 单一注册 | 新码只加本包 |
| 落地 href SSOT | 只改 `ADMIN_IMPLEMENTED_HREFS`，禁止 shell 硬编码 |
| 无 UI 运行时依赖 | 禁止 Next/Hono/React |
| UI ≠ API | 菜单裁剪 ≠ 授权 |
| 壳码 | `admin.shell` 进 admin |
| pure read | 无 shell → 仅 web |
