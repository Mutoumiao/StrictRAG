# 裁定 L2 归档底线后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-human
Blocked by: 14

## Question

[L2 归档底线](./14-l2-archive-floor.md) 已 `resolved`：运营能入队多轮、能看账本、没有合格归档就不能写产品默认开。这是 P2.5 二元出口（L2 归档准出）的**工程路径**，不是人签、不是准出 PASS、不是仓库默认打开 rewrite。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官（[裁定 P2 收官后下一步](./13-after-p2-close-order.md)）
- 出口走 L2 归档准出，不走书面永久关 rewrite
- 人签 / 把工程绿写成准出 PASS / 仓库默认打开 rewrite：不进本图执行工单
- P3a 仍等该出口（人签在图外）
- LangGraph 重构另起路线
- B8 / B9 / QUAL-2 不挡更早语义、不进本回合

候选（来自地图 Not yet specified）：

1. **P2.5 阶段剩余必须具备**：web 连续追问消费（含 `coref_unresolved` 主按钮）、L3 自动熔断（面板仍属 P4）
2. **剩余 P2 半接线**：入库报告、失败 Webhook、三平面配额、`/me/permissions` 路径、成员 PUT、修改日志、超管引导、末位超管前端提示、在线编写
3. **P3b 尚未齐的强制检索面**：ES 查询期对称、aclPrincipals 全文、敏感解禁、仓库默认开 `DEPT_ACL_ENFORCE`（功能表允许 P2 后并行，不经 P2.5 硬门）
4. **本图暂停执行**，等图外 L2 人签

本工单只锁顺序与切边，不写产品代码。

## Answer

L2 归档底线之后，本图继续补 **P2.5 阶段剩余必须具备**。不回补 P2 半接线、不转 P3b、不暂停等人签。人签 / 准出 PASS / 仓库默认打开 rewrite / P3a 仍不进执行。

本批两张、串行：

- [web 连续追问消费](./16-web-multiturn-consumption.md) — 开放前沿。`coref_unresolved` 拒答卡 + 主按钮「用完整问题重述」；禁止宣传连续追问 / 准出。切边见该工单正文。
- [L3 自动熔断](./17-l3-auto-fuse.md) — `Blocked by` web 连续追问消费。进程内关 rewrite 路径；`rewrite_dogfood` 不熔断。切边见该工单正文。

未改产品代码。

## Comments

- 2026-08-30 按图顺序认领本工单。开放前沿无执行工单；本回合只锁「L2 归档底线后下一步」，不写产品代码。
- Q1：选 1。继续补 P2.5 阶段剩余必须具备（web 连续追问消费、L3 自动熔断）。不回补 P2 半接线、不转 P3b、不暂停等人签。人签 / 默认开 rewrite / P3a 仍不进执行。
- Q2：选 3。本批两张、串行：web 连续追问消费 → L3 自动熔断（后一张 Blocked by 前一张）。切边下一问。
- Q3：选 1。web 连续追问消费按推荐切边（coref_unresolved 拒答卡+主按钮；不宣传、不默认开、不补 J3/J4）。
- Q4：选 1。L3 自动熔断按推荐切边（进程内关 rewrite 路径；rewrite_dogfood 不熔断；不写 env/库、不收窄窗、不做面板）。
- 2026-08-30 用户确认落盘：关本工单；建 [web 连续追问消费](./16-web-multiturn-consumption.md)、[L3 自动熔断](./17-l3-auto-fuse.md)。
