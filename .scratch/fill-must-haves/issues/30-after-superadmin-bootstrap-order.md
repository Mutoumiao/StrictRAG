# 裁定启动引导超管后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-human
Blocked by: 29

## Question

[启动引导超管](./29-superadmin-bootstrap.md) 已 `resolved`。api listen 前对默认租户跑 ADR-056 引导：upsert `permission_definitions`、超管角色写成 catalog 全码、无 active 超管按 env 创建（或缺则失败）。这是 env 创建，不是引导页。密码登录 HTTP 未做。PUT/PATCH 把超管码改少的写路径锁未做（重启补回）。这仍不是人签、不是准出 PASS、不是仓库默认打开 rewrite。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官（[裁定 P2 收官后下一步](./13-after-p2-close-order.md)）
- 出口走 L2 归档准出；工程路径 [L2 归档底线](./14-l2-archive-floor.md) 已齐，人签仍图外
- 人签 / 把工程绿写成准出 PASS / 仓库默认打开 rewrite：不进本图执行工单
- P3a 仍等该出口（人签在图外）
- LangGraph 重构另起路线
- B8 / B9 / QUAL-2 不挡更早语义、不进本回合
- 启动引导切边（引导页 / 密码登录 / role_permissions 终态 / worker 引导）不并进已关工单

候选（来自地图 Not yet specified）：

1. **剩余 P2 半接线**：失败 Webhook、三平面配额、修改日志、在线编写（完整体验 P2.x）、写路径锁超管全码
2. **P3b 尚未齐的强制检索面**：ES 查询期对称、aclPrincipals 全文、敏感解禁、仓库默认开 `DEPT_ACL_ENFORCE`
3. **P4**：L1 门禁包签字与再认证、多模型 fallback、双轨看板、数据面板增强
4. **本图暂停执行**，等图外 L2 人签

本工单只锁顺序与切边，不写产品代码。

## Answer

启动引导超管之后，本图继续收 **剩余 P2 半接线**。本批只做写路径锁超管全码。不转 P3b、不跳 P4、不暂停等人签。人签 / 准出 PASS / 仓库默认打开 rewrite / P3a 仍不进执行。

本批一张：

- [写路径锁超管全码](./31-lock-superadmin-full-codes.md) — 开放前沿。PUT `/admin/roles/:roleId/permissions` 与 PATCH `/admin/roles/:roleId`（带 `codes`）不得把 `super_admin.codesJson` 改成不等于 catalog 全码；全码幂等 200。admin 角色页编辑超管时勾选与保存不可点并出说明。切边见该工单正文。

仍留雾：失败 Webhook、三平面配额、修改日志、在线编写。

未改产品代码。

## Comments

- 2026-09-07 按图顺序认领本工单。开放前沿无执行工单；本回合只锁「启动引导超管后下一步」，不写产品代码。用户授权本图全程自行决策（AFK 覆盖 HITL grilling）。
- Q1：选 1。继续收剩余 P2 半接线。不转 P3b、不跳 P4、不暂停等人签。人签 / 准出 PASS / 默认开 rewrite / P3a 仍不进执行。切哪些、怎么拆，下一问再锁。
- Q2：选 写路径锁超管全码。这是 [启动引导超管](./29-superadmin-bootstrap.md) / [裁定 web 下拉换 ui 关闭列表后下一步](./28-after-web-select-order.md) Q11 明确留雾的同一能力余量。失败 Webhook、三平面配额、修改日志、在线编写留雾。在线编写仍是完整体验 P2.x。
- Q3：选 1。一张执行工单覆盖 API 写路径闸 + admin 角色页不可点。不拆两张。
- Q4：选 1。闸打在 PUT permissions 与 PATCH（仅当 body 带 `codes`）。比较用集合相等（顺序无关）对照 `ALL_PERMISSION_CODES`。少码 400 `RULE_VIOLATION`。全码（含乱序）200。PATCH 不带 codes 只改 name 200。禁用系统超管角色闸不改。
- Q5：选 1。其它系统角色 / 自定义角色仍可改码。不把锁扩到 `kb_admin` 等模板。
- Q6：选 1。admin 编辑 `super_admin`：勾选禁用、保存禁用、出说明「超管角色锁定 catalog 全码」。仍可点开查看。不改用户页末位超管提示。
- Q7：选 1。测例钉 PUT 改少 400、PUT 全码 200、PATCH 带 codes 改少 400、PATCH 不带 codes 改 name 200、admin 不可点。不测 bootstrap、不测末位超管 400、不做浏览器 E2E。
- Q8：选 1。不改启动引导补码、不改密码登录、不做 `role_permissions` 终态、不改末位超管闸。重启补回仍在；本张补的是写路径当场拒绝。
- 2026-09-07 自行确认落盘：关本工单；建 [写路径锁超管全码](./31-lock-superadmin-full-codes.md)。
