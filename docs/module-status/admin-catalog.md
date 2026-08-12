# @strict-rag/admin-catalog · 模块状态

| 字段 | 内容 |
|------|------|
| 路径 | `packages/admin-catalog` |
| 成熟度 | **可联调**（权限码 + 角色模板 + 菜单树 + **外壳裁剪 SSOT**） |
| 默认依赖模式 | 纯库；无运行时开关 |
| 关联模块 | 被 `api` 的权限求值和 `admin` 的菜单裁剪消费；**不能**替代服务端权限校验 |
| 最近更新 | 2026-08-12（`ADMIN_IMPLEMENTED_HREFS` 含 `/feedback` · 11 条） |
| Spec / ADR | ADR-051 · ADR-056 · `.trellis/spec/admin-catalog/library/catalog-ssot.md` |
| PRD | `prds/09-security` 权限相关 |

## 一句话状态

运营侧**权限码、角色模板、菜单树、已落地 href** 的代码级唯一事实来源（SSOT）；外壳使用 `clipMenuForShell` 做菜单裁剪（取"权限码 ∩ 已实现页面"的交集），catalog 允许超前登记尚未实现的页面。

---

## 已具备能力

- **权限码**：`PERMISSION_DEFINITIONS` / `PERMISSIONS` / `isPermissionCode`（覆盖 platform 与 kb 两个作用域）
- **角色模板**：`super_admin` · `kb_admin` · `doc_operator` · `web_consumer`；配套 `defaultCodesForRoles` · `roleBypassesKbMembership`
- **菜单树**：`MENU_TREE` + `filterMenuByCodes`（按有效权限码裁剪）
- **外壳裁剪（B7 + B3–B6 + B13）**：`ADMIN_IMPLEMENTED_HREFS` + `clipMenuForShell` + `collectMenuHrefs`；已落地 **十一条**：`/dashboard` · `/documents` · `/approvals` · `/members` · `/chunks` · `/kb/settings` · `/models` · `/users` · `/roles` · `/departments` · **`/feedback`**
- 菜单树 `MENU_TREE` 含 `/feedback`（码 `feedback.queue`）；kb_admin 模板含 `feedback.queue`
- 单测：`catalog.test.ts`（kb_admin clip 含 `/feedback` 等；super_admin clip 覆盖全部 `ADMIN_IMPLEMENTED_HREFS`）

---

## 明确未做 / 边界

| 项 | 说明 |
|----|------|
| 动态角色绑码的运行时消费 | 角色模板是种子；B4 写 DB + **B4-W** api 每请求 hydrate（本包仍只提供码表/菜单） |
| 菜单项对应全量页面 | **dashboard / users / roles / models / departments 已落地（薄）**；APM 等仍非目标 |
| 替代 API 鉴权 | 前端裁剪只影响菜单可见性，不构成安全边界 |

---

## 证据

| 类型 | 指针 |
|------|------|
| 入口 | `packages/admin-catalog/src/index.ts` |
| 权限 / 角色 / 菜单 | `permissions.ts` · `role-templates.ts` · `menu-tree.ts` |
| 单测 | `packages/admin-catalog/src/catalog.test.ts` |
| 消费方 | `apps/admin/src/components/admin-shell.tsx` · `apps/api/src/auth/permissions/` |
| Task（辅证 · 归档） | `08-09-b6-dashboard-shell` · `08-11-b13-feedback-ui` · B7 等 |
