# 写路径锁超管全码

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 30

## Question

锁超管角色写路径：`super_admin.codesJson` 必须保持 catalog 全码。这是剩余 P2 半接线里本批唯一一张执行工单。启动引导重启会补回全码；本张补的是 PUT/PATCH 当场拒绝改少。

权威：[裁定启动引导超管后下一步](./30-after-superadmin-bootstrap-order.md)；ADR-056；功能表 §4.4；[启动引导超管](./29-superadmin-bootstrap.md) 明确留雾的写路径锁。无超管口径与末位超管闸分开：本张只锁角色绑码，不改用户禁用/剥角色。

### 做

- **API**：`PUT /api/v1/admin/roles/:roleId/permissions` 与 `PATCH /api/v1/admin/roles/:roleId`（仅当 body 带 `codes`）若目标角色 `code === super_admin` 且 `codes` 集合不等于 `ALL_PERMISSION_CODES` → 400 `RULE_VIOLATION`（message 含 `cannot reduce super_admin permission codes`）。比较顺序无关、先走现有未知码校验。
- 全码（含乱序/去重后相等）→ 200，写回全码。
- `PATCH` 不带 `codes`（只改 name 等）→ 200，不碰码。禁用系统 `super_admin` 角色的现闸不改。
- 其它系统角色与自定义角色仍可改码。
- **admin**：角色页编辑 `super_admin` 时权限勾选不可点、保存不可点，并出说明「超管角色锁定 catalog 全码」。仍可点开查看。不改用户页末位超管提示。
- 测例：
  - api：PUT 改少 400；PUT 全码 200；PATCH 带 codes 改少 400；PATCH 不带 codes 改 name 200
  - admin RTL：超管勾选/保存不可点并出说明；其它角色仍可授码

### 不做

- 改启动引导补码 / 改 `createApp()` 不跑
- 密码登录 HTTP / 引导页 / 改密 UI
- 改末位超管 400 闸或用户页提示
- `role_permissions` 终态三表；运行时求值仍 `codesJson`
- 把锁扩到其它系统角色模板
- 失败 Webhook / 三平面配额 / 修改日志 / 在线编写
- P3a / P3b / P4
- 人签 / 准出 PASS / 默认开 rewrite
- LangGraph 重构
- 浏览器 E2E

收工：更新 `.trellis/spec/` 对应包；回写 `docs/module-status/`；`.trellis/tasks/08-06-project-backlog/` 只补指针（目录若无则跳过），禁止 `task.py create`。

写代码前读 `.trellis/spec/` 对应包（api / admin）。

## Answer

PUT `/admin/roles/:roleId/permissions` 与 PATCH（带 `codes`）把 `super_admin` 绑码改成不等于 `ALL_PERMISSION_CODES` → 400 `RULE_VIOLATION`（`cannot reduce super_admin permission codes`）。全码（乱序）200。PATCH 不带 codes 改 name 200。其它角色仍可改码。禁用系统超管角色闸未改。

admin 角色页编辑 `super_admin`：勾选禁用、保存禁用、说明「超管角色锁定 catalog 全码」。仍可点开查看。用户页末位超管提示未改。

测例：`apps/api/tests/acl/platform-users-roles.test.ts`；`apps/admin/tests/ops/superadmin-codes-lock.test.tsx`。

未做：引导页、密码登录、`role_permissions` 终态、Webhook / 配额 / 修改日志。未 `task.py create`。

## Comments

- 2026-09-07 认领并执行。权威切边见 [裁定启动引导超管后下一步](./30-after-superadmin-bootstrap-order.md)。
- 落盘：API 写路径闸 + admin 不可点；08-06 目录不在本 worktree，未补指针；未 `task.py create`；未 push。
