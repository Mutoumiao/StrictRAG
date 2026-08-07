# @strict-rag/admin-catalog · 模块状态

| 字段 | 内容 |
|------|------|
| 路径 | `packages/admin-catalog` |
| 成熟度 | **可联调**（权限码 + 角色模板 + 菜单树 + **壳 clip SSOT**） |
| 默认依赖模式 | 纯库；无运行时开关 |
| 关联模块 | `api` 权限求值 · `admin` 菜单裁剪；**不能**替代服务端验码 |
| 最近更新 | 2026-08-07 |
| Spec / ADR | ADR-051 · ADR-056 · `.trellis/spec/admin-catalog/library/catalog-ssot.md` |
| PRD | `prds/09-security` 权限相关 |

## 一句话

运营侧 **权限码、角色模板、菜单树、已落地 href** 的代码 SSOT；壳用 `clipMenuForShell`（码 ∩ 已实现），catalog 可超前登记未做页面。

---

## 已具备能力

- **权限码**：`PERMISSION_DEFINITIONS` / `PERMISSIONS` / `isPermissionCode`（platform + kb 作用域）
- **角色模板**：`super_admin` · `kb_admin` · `doc_operator` · `web_consumer`；`defaultCodesForRoles` · `roleBypassesKbMembership`
- **菜单树**：`MENU_TREE` + `filterMenuByCodes`（按有效码裁剪）
- **壳 clip（B7）**：`ADMIN_IMPLEMENTED_HREFS` + `clipMenuForShell` + `collectMenuHrefs`；五条落地：`/documents` · `/approvals` · `/members` · `/chunks` · `/kb/settings`
- 单测：`catalog.test.ts`（含三角色 clip + super_admin 不露未落地）

---

## 明确未做 / 边界

| 项 | 说明 |
|----|------|
| 动态角色绑码持久化 UI | 模板是种子；运行时以用户角色并集为准（api） |
| 菜单项对应全量页面 | catalog 含 dashboard/users/roles/models 等；**admin 未落地**（B3–B6）；clip 隐藏 |
| 替代 API 鉴权 | 前端裁剪只影响可见性 |

---

## 证据

| 类型 | 指针 |
|------|------|
| 入口 | `packages/admin-catalog/src/index.ts` |
| 权限 / 角色 / 菜单 | `permissions.ts` · `role-templates.ts` · `menu-tree.ts` |
| 单测 | `packages/admin-catalog/src/catalog.test.ts` |
| 消费方 | `apps/admin/src/components/admin-shell.tsx` · `apps/api/src/auth/permissions/` |
| Task | `.trellis/tasks/archive/2026-08/08-07-b7-menu-clip-complete/`（本地 trellis 树） |
