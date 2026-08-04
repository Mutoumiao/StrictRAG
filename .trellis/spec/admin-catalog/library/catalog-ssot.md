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
filterMenuByCodes(tree, codes: ReadonlySet<string>): MenuNode[]
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

### 4. Validation & Error Matrix

| 条件 | 结果 |
|------|------|
| 新码未进 `PERMISSION_DEFINITIONS` | **禁止**在 api/admin 字符串字面量放行 |
| 菜单 permission 不在码表 | 编译/评审失败；filter 永不可见 |
| 删码仍被 role 引用 | 须发版+迁移；禁止静默删（ADR-056） |

### 5. Good / Base / Bad

| 类 | 例 |
|----|-----|
| Good | 新模块先加 `PERMISSION_DEFINITIONS` → 模板绑码 → 菜单 → `requirePermission` |
| Base | `PERMISSIONS` 导出 = 全部 code 字符串列表（兼容旧名） |
| Bad | admin 本地 `const PERMISSIONS = [...]` 第二份 |
| Bad | api `if (code === 'doc.upload')` 字面量与 catalog 漂移 |

### 6. Tests Required

- catalog 导出非空；`super_admin` 默认码包含 `admin.shell` 与 `approval.decide`  
- `doc_operator` 默认不含 `approval.decide`  
- `filterMenuByCodes` 无码节点被裁掉  

（api `resolve.test.ts` 已覆盖模板求值。）

### 7. Wrong vs Correct

#### Wrong

```typescript
// apps/admin
const canApprove = user.role === 'kb_admin'
```

#### Correct

```typescript
import { filterMenuByCodes, MENU_TREE } from '@strict-rag/admin-catalog'
const menu = filterMenuByCodes(MENU_TREE, new Set(me.permissions))
// API 仍 requirePermission('approval.decide')
```

---

## 规则摘要

| 规则 | 说明 |
|------|------|
| 单一注册 | 新码只加本包 |
| 无 UI 运行时依赖 | 禁止 Next/Hono/React |
| UI ≠ API | 菜单裁剪 ≠ 授权 |
| 壳码 | `admin.shell` 进 admin |
| pure read | 无 shell → 仅 web |
