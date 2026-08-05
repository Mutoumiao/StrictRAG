# @strict-rag/admin-catalog · 模块状态

| 字段 | 内容 |
|------|------|
| 路径 | `packages/admin-catalog` |
| 成熟度 | **可联调**（权限码 + 角色模板 + 菜单树 SSOT；UI 仅消费子集） |
| 默认依赖模式 | 纯库；无运行时开关 |
| 关联模块 | `api` 权限求值 · `admin` 菜单裁剪；**不能**替代服务端验码 |
| 最近更新 | 2026-08-05 |
| Spec / ADR | ADR-051 · ADR-056 |
| PRD | `prds/09-security` 权限相关 |

## 一句话

运营侧 **权限码定义、角色模板默认绑码、admin 菜单树** 的代码 SSOT；admin 壳只展示已实现 href，catalog 本身可超前登记未做页面。

---

## 已具备能力

- **权限码**：`PERMISSION_DEFINITIONS` / `PERMISSIONS` / `isPermissionCode`（platform + kb 作用域）
- **角色模板**：`super_admin` · `kb_admin` · `doc_operator` · `web_consumer`；`defaultCodesForRoles` · `roleBypassesKbMembership`
- **菜单树**：`MENU_TREE` + `filterMenuByCodes`（按有效码裁剪）
- 单测：`catalog.test.ts`

---

## 明确未做 / 边界

| 项 | 说明 |
|----|------|
| 动态角色绑码持久化 UI | 模板是种子；运行时以用户角色并集为准（api） |
| 菜单项对应全量页面 | catalog 含 dashboard/chunks/settings/users/roles/models 等；**admin 未全部落地** |
| 替代 API 鉴权 | 前端裁剪只影响可见性 |

---

## 证据

| 类型 | 指针 |
|------|------|
| 入口 | `packages/admin-catalog/src/index.ts` |
| 权限 / 角色 / 菜单 | `permissions.ts` · `role-templates.ts` · `menu-tree.ts` |
| 单测 | `packages/admin-catalog/src/catalog.test.ts` |
| 消费方 | `apps/admin/src/components/admin-shell.tsx` · `apps/api/src/auth/permissions/` |
