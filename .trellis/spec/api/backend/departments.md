# api · 部门组织壳（code-spec · B5）

> 路径：`apps/api/src/routes/departments.ts` · `services/departments.ts`  
> PRD：`prds/05-api` §2.12 · ADR-057  
> 切片：**最小**（树 CRUD + 用户归属）；grant 表可存（检索不读）；`DEPT_ACL_ENFORCE` **默认关**精确匹配；**≠** 继承 / **≠** grant 消费 / **≠** ES

---

## Scenario: 部门树与用户归属

### 1. Scope / Trigger

- 新增/改部门组织树 API
- 用户主部门 / 兼任 / 负责人归属
- 禁环、禁用部门不可新挂用户

### 2. Signatures

| 方法 | 路径 | 中间件 |
|------|------|--------|
| GET/POST | `/api/v1/admin/departments` | `requirePermission('dept.manage')` |
| GET | `/api/v1/admin/departments/tree` | 同上（**须先于** `:deptId`） |
| GET/PATCH/DELETE | `/api/v1/admin/departments/:deptId` | 同上 |
| GET/PUT | `/api/v1/admin/users/:userId/departments` | `requirePermission('user.manage')` |

```typescript
// services/departments.ts
createMemoryDepartmentsRepoWithUsers(): MemoryDepartmentsRepo // + registerUser
wouldCreateCycle(deptId, newParentId, byId): boolean
buildDepartmentTree(rows): DepartmentTreeNode[]
validateAssignmentList(assignments): { ok: true } | { ok: false; message }
pathFor(parentPath, id): string // `/uuid/` 或 `/uuid/uuid/`
recomputeSubtreePaths(rootId, newRootPath, byId)
```

DB：`departments` · `user_departments`（`packages/db` · migration `0005_b5_departments`）

### 3. Contracts

- DTO：`@strict-rag/contracts` · `departments.contract.ts`
- 权限：`dept.manage`（树）· `user.manage`（归属）
- 文档 `ownerDeptId` / `visibilityLevel` **字段已落**（GET 详情回读 · `PATCH /documents/:docId` 只写这两列 · `doc.editor` 始终验码）
- `dept_cross_grants` 表 + `GET/POST/DELETE /admin/dept-cross-grants`（`dept.manage`）；**retrieve 不读此表**
- `DEPT_ACL_ENFORCE` 默认 false；开时 `filterDocsForDeptAcl` 精确匹配（预览与 retrieve 同函数）；**无**祖先 / **无** grant / **无** ES

### 4. Validation & Error Matrix

| 条件 | HTTP | code |
|------|------|------|
| 无 manage 码 | 403 | FORBIDDEN |
| body Zod 失败 | 400 | VALIDATION_ERROR |
| parent 不存在 | 400 | VALIDATION_ERROR |
| PATCH 成环 | 400 | RULE_VIOLATION |
| 禁用部门新挂用户 | 400 | RULE_VIOLATION |
| 双 primary / 无 primary（非空） | 400 | VALIDATION_ERROR |
| DELETE 有子/有用户 | 400 | RULE_VIOLATION |
| 部门/用户不存在 | 404 | NOT_FOUND |

### 5. Good / Base / Bad

- **Good**：根+子 POST → 201；一主多兼任 PUT → 200  
- **Base**：GET tree 排序与嵌套  
- **Bad**：kb_admin 列部门 → 403；父挂到子 → 400；禁用部挂人 → 400

### 6. Tests Required

`apps/api/src/routes/departments.test.ts`（真实 Hono + memory repo）：

- 无码 403（dept / user 归属）
- 树 CRUD + tree
- 成环 400
- 禁用部门归属 / active 归属
- 双 primary / 合法归属 + GET
- DELETE 有子、有用户、空叶

### 7. Wrong vs Correct

#### Wrong
```typescript
// 宣称 ADR-057 全文已上，或默认 DEPT_ACL_ENFORCE=true
if (env.DEPT_ACL_ENFORCE) { /* 仅精确匹配；无继承/grant/ES */ }
```

#### Correct
```typescript
routes.get('/admin/departments', requirePermission('dept.manage'), ...)
// 组织可配；检索仍成员全库（默认）
```
