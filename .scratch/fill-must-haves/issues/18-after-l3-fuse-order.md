# 裁定 L3 自动熔断后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-human
Blocked by: 17

## Question

[L3 自动熔断](./17-l3-auto-fuse.md) 已 `resolved`：护栏闩后本进程关 rewrite 路径，`rewrite_dogfood` 不熔。本批 P2.5 剩余必须具备（[web 连续追问消费](./16-web-multiturn-consumption.md) → L3 自动熔断）已收完。这仍不是人签、不是准出 PASS、不是仓库默认打开 rewrite、不是 L3 面板。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官（[裁定 P2 收官后下一步](./13-after-p2-close-order.md)）
- 出口走 L2 归档准出；工程路径 [L2 归档底线](./14-l2-archive-floor.md) 已齐，人签仍图外
- 人签 / 把工程绿写成准出 PASS / 仓库默认打开 rewrite：不进本图执行工单
- P3a 仍等该出口（人签在图外）
- LangGraph 重构另起路线
- B8 / B9 / QUAL-2 不挡更早语义、不进本回合
- L3 面板属 P4，不回写进已关的 L3 工单

候选（来自地图 Not yet specified）：

1. **剩余 P2 半接线**：入库报告、失败 Webhook、三平面配额、`/me/permissions` 路径、成员 PUT、修改日志、超管引导、末位超管前端提示、在线编写（完整体验 P2.x）。先前只为不挡 P2.5 留雾，未划出本图
2. **P3b 尚未齐的强制检索面**：ES 查询期对称、aclPrincipals 全文、敏感解禁、仓库默认开 `DEPT_ACL_ENFORCE`（功能表允许 P2 后并行，不经 P2.5 硬门）
3. **P4**：L1 门禁包签字与再认证、多模型 fallback、双轨看板、数据面板增强（含 L3 Grafana / admin 面板）
4. **本图暂停执行**，等图外 L2 人签

本工单只锁顺序与切边，不写产品代码。

## Answer

L3 自动熔断之后，本图回头收 **剩余 P2 半接线**。本批只做鉴权/成员余量最小闭环。不转 P3b、不跳 P4、不暂停等人签。人签 / 准出 PASS / 仓库默认打开 rewrite / P3a 仍不进执行。

本批两张、串行：

- [鉴权路径与成员 PUT](./19-authz-path-and-member-put.md) — 开放前沿。`GET /api/v1/me/permissions` 与 `/auth/me` 同源；保留 `/auth/me`；`PUT …/members/:userId` 只改 `role`；admin 成员页可改角色。无 `allowedDocIds`。切边见该工单正文。
- [末位超管前端提示](./20-last-superadmin-hint.md) — `Blocked by` 鉴权路径与成员 PUT。用户页唯一 active 超管不可点禁用/剥光角色；API 闸不改。切边见该工单正文。

仍留雾：入库报告、失败 Webhook、三平面配额、修改日志、超管引导页、在线编写、库选择器只列成员库。

未改产品代码。

## Comments

- 2026-08-30 按图顺序认领本工单。开放前沿无执行工单；本回合只锁「L3 自动熔断后下一步」，不写产品代码。
- Q1：选 1。回头收剩余 P2 半接线。不转 P3b、不跳 P4、不暂停等人签。人签 / 准出 PASS / 默认开 rewrite / P3a 仍不进执行。切哪些、怎么拆，下一问再锁。
- Q2：选 1。本批只做鉴权/成员余量最小闭环：`GET /me/permissions` + 成员 PUT + 末位超管前端提示。超管引导页、入库报告、Webhook、三平面配额、修改日志、在线编写留雾。库选择器不并进。拆张与切边下一问。
- Q3：选 2。两张串行：鉴权路径与成员 PUT → 末位超管前端提示。
- Q4：选 1。新增 `GET /api/v1/me/permissions`，有效码与 `/auth/me` 同源；保留 `/auth/me`；测例钉新路径；本批不改 web/admin 客户端。
- Q5：选 1。`PUT …/members/:userId` body 只 `{ role }`；`member.manage`；admin 成员页可改角色；无 `allowedDocIds`。
- Q6：选 1。用户页唯一 active 超管的「禁用」和「剥光超管角色」不可点并出说明；API 400 闸不改；不做启动引导页。
- 2026-08-30 用户确认落盘：关本工单；建 [鉴权路径与成员 PUT](./19-authz-path-and-member-put.md)、[末位超管前端提示](./20-last-superadmin-hint.md)。
