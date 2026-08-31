# 启动引导超管

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 28

## Question

补 ADR-056 启动引导超管（剧本 AD1–AD3）。这是剩余 P2 半接线里本批唯一一张执行工单。术语是 **env 创建第一位超管**，不是引导页。

权威：[裁定 web 下拉换 ui 关闭列表后下一步](./28-after-web-select-order.md)；ADR-056；功能表 §4.4；验收剧本 AD1–AD3。无超管口径与末位超管闸相同：默认租户没有 `status=active` 且持有 **启用中** `super_admin` 角色的用户。

### 做

- 新建 PG 表 `permission_definitions`（Drizzle schema + 迁移）。列：`code` PK、`kind`、`scope`、`description`、`source`（catalog）。`kind` 存 catalog 原值（含 `page+action`），不把 PRD 二分枚举盖过 `admin-catalog`。
- 引导只针对 `DEV_DEFAULT_TENANT`。抽可单测的引导函数；`index.ts` 在 listen **之前** `await`；失败 `process.exit` 非 0。`createApp()` **不**自动跑。
- 每次引导：把 catalog 全码 upsert 进 `permission_definitions`（新增补齐、已存在更新元数据）。**不**静默删表里多出来的码。
- 每次引导：`super_admin` 角色 `codesJson` **精确等于** `ALL_PERMISSION_CODES`；没有该角色行则按种子插入。其它系统角色绑码不重写。
- 无 active 超管：`SUPER_ADMIN_EMAIL` 与 `SUPER_ADMIN_PASSWORD` 缺一则引导失败（所有 `APP_ENV`）。两字段在 env Zod 里保持可选，只在这条分支校验。
- 邮箱不存在：创建 active 超管，写不可逆 `password_hash`（Node 标准库，不新引入身份框架），`platformRole=platform_admin`，`isPlatformOperator=1`，绑 `super_admin`。
- 邮箱已有用户：复用该行，绑 `super_admin`、`status` 置 `active`、标运营账号；**不改** `password_hash`（空哈希也不用 env 填）。
- 已有 active 超管：不覆盖用户、不改哈希，仍补码与 upsert catalog。
- 测例（`apps/api`，直接调引导函数；AD2 断言抛错，不必真 `process.exit`）：
  - AD1：空库 + 两 env → 有 active 超管；表内码 = catalog 全量；超管 `codesJson` = 全码
  - AD2：无超管且缺任一 env → 引导失败
  - AD3：已有超管再跑 → `password_hash` 不变；超管码仍全
  - 同邮箱非超管用户被绑上超管，哈希不变
  - `createApp()` 后库里仍无超管
  - 已有 `kb_admin` 自定义绑码，引导后不被模板覆盖
  - upsert 更新 catalog 元数据；表里多出来的码不删

### 不做

- admin 启动引导页 / 改密 UI
- 密码登录 HTTP / 改 `dev-login` / 上 Better Auth
- 改末位超管 400 闸
- PUT/PATCH 把超管码改少的写路径锁（重启补回；留雾）
- `role_permissions` 终态三表；运行时求值仍 `codesJson`，不切到 `permission_definitions`
- 扫全部 `tenantId` / 建 `tenants` 表 / 按请求补引导
- worker 启动引导
- 失败 Webhook / 三平面配额 / 修改日志 / 在线编写
- P3a / P3b / P4
- 人签 / 准出 PASS / 默认开 rewrite
- LangGraph 重构
- 浏览器 E2E

收工：skill `update-module-status`；`.trellis/tasks/08-06-project-backlog/` 只补指针，禁止 `task.py create`。

写代码前读 `.trellis/spec/` 对应包（api、db、admin-catalog）。

## Answer

api `index.ts` listen 前对 `DEV_DEFAULT_TENANT` 跑 ADR-056 引导：upsert `permission_definitions`（migration `0012`；kind 存 catalog 原值含 `page+action`；不静默删）、`super_admin.codesJson` 精确等于 `ALL_PERMISSION_CODES`、无 active 超管则按 `SUPER_ADMIN_EMAIL`+`SUPER_ADMIN_PASSWORD` 创建（scrypt 写 `password_hash`）或缺则失败。已有超管不改哈希。复用同邮箱用户绑超管且不改哈希。`createApp()` 不跑。其它系统角色绑码不重写。

未做：引导页、密码登录 HTTP、PUT 锁超管全码、`role_permissions` 终态、worker 引导。

测例：`apps/api/tests/acl/superadmin-bootstrap.test.ts`；schema：`packages/db/tests/acl/permission-definitions-schema.test.ts`。

## Comments

- 2026-08-31 认领并执行。权威切边见 [裁定 web 下拉换 ui 关闭列表后下一步](./28-after-web-select-order.md)。
- 落盘：引导函数 + listen 前调用；08-06 只补指针；未 `task.py create`；未 push。
