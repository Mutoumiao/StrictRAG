# 鉴权路径与成员 PUT

Type: task
Label: wayfinder:task
Status: resolved
Triage: ready-for-agent
Blocked by: 18

## Question

补鉴权路径与成员 PUT：PRD 短名 `GET /me/permissions` 要对齐；成员角色要能改。这是剩余 P2 半接线里鉴权/成员余量的第一张执行工单。

权威：[裁定 L3 自动熔断后下一步](./18-after-l3-fuse-order.md)；`prds/05-api/01-http-api-hono.md`（`GET /api/v1/me/permissions` · `PUT …/members/:userId`）。

### 做

- 新增 `GET /api/v1/me/permissions`：有效码与 `GET /auth/me` 同源（角色并集）
- **保留** `GET /auth/me`；本批不改 web/admin 登录客户端
- 测例钉新路径（超管含 `admin.shell` 等；非只文档宣称）
- `PUT /api/v1/knowledge-bases/:kbId/members/:userId`，body **只** `{ role: read|write|admin }`
- 始终 `member.manage` + KB 成员闸（与现有 GET/POST/DELETE 同）
- admin 成员页可改角色

### 不做

- 废掉 `/auth/me` 或迁移 web/admin `fetchAuthMe`
- `allowedDocIds` / 检索 ACL 闸 / `acl_filter_too_large`
- 末位超管前端提示（后一张）
- 启动引导超管页
- 入库报告 / Webhook / 三平面配额 / 修改日志 / 在线编写 / 库选择器
- P3a / P3b / P4
- 人签 / 准出 PASS / 默认开 rewrite
- LangGraph 重构

收工：skill `update-module-status`；`.trellis/tasks/08-06-project-backlog/` 只补指针，禁止 `task.py create`。

写代码前读 `.trellis/spec/` 对应包（api、admin）。

## Answer

新增 `GET /api/v1/me/permissions`：`data.permissions` 与 `GET /auth/me` 同源（角色并集有效码）；保留 `/auth/me`；本批未改 web/admin 登录客户端。测例钉超管含 `admin.shell` / `dashboard.view` / `role.perm.manage`。

`PUT /api/v1/knowledge-bases/:kbId/members/:userId` body **只** `{ role: read|write|admin }`（`.strict()` 拒 `allowedDocIds`）；始终 `member.manage` + KB 成员闸。admin 成员页行内下拉可改角色。

未做：废 `/auth/me`、检索 ACL / `allowedDocIds`、末位超管提示、启动引导。未 `task.py create`。

证据：`apps/api/src/routes/auth.ts`（`meRoutes`）· `apps/api/src/routes/members.ts` · `apps/admin/src/app/(ops)/members/` · `apps/api/tests/acl/me-permissions.test.ts` · `apps/admin/tests/ops/members-workspace.test.tsx` · `docs/module-status/api.md`。

## Comments

- 2026-08-30 认领本工单并执行。开放前沿即本张。
