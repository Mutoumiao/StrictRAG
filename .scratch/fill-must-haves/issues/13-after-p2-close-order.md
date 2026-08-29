# 裁定 P2 收官后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-human
Blocked by: 12

## Question

[评测底线](./12-eval-floor.md) 已 `resolved`，第三批四块（检索补钉 → ask 审计 → web 消费 → 评测底线）收完。裁定 **下一步** 做哪条、是否还开 P2 半接线执行工单，还是转向 P2.5 二元出口。

候选（来自地图 Not yet specified，及第三批明确不做）：

1. 未进第三批的 P2 半接线（入库报告、失败 Webhook、三平面配额、`/me/permissions` 路径、成员 PUT、在线编写、修改日志、超管引导、末位超管前端提示）
2. **P2.5 二元出口**：L2 归档准出，还是产品书面永久关 rewrite
3. 先停执行、只把第三批收口给人签（B10 人签不进本图）

约束（已锁）：本图是执行面；B8 / B9 / QUAL-2 与人签不进；不提前切 P3a；LangGraph 重构另起路线。本工单只锁顺序与切边，不写产品代码。

## Answer

第三批即本图 **P2 语义收官**。剩余 P2 半接线留在本图雾里，不挡开 P2.5，也不划出本图。不暂停给人签。

下一步 **P2.5 二元出口 = L2 归档准出**（不走书面永久关 rewrite）。人签 / 把工程绿写成准出 PASS / 仓库默认打开 rewrite：不进本图执行工单。

本图下一张执行工单只有一张：

- [L2 归档底线](./14-l2-archive-floor.md) — 开放前沿。`POST eval/runs` 入队 `session_multiturn`；worker `sr-eval` 跑多轮；admin `/eval` 回读；`signoffEligible` 工程公式；未归档禁止写产品默认开。切边见该工单正文。

未改产品代码。

## Comments

- 2026-08-29 按图顺序认领本工单。本回合只锁「P2 收官后下一步」的顺序与切边，不写产品代码。
- Q1：选 2。第三批即本图 P2 语义收官；下一步转向 P2.5 二元出口。剩余半接线留在本图雾里，不挡开 P2.5，不划出本图。选项 3 否决。
- Q2：选 1。出口走 L2 归档准出，不走书面永久关 rewrite。本图不伪造 PASS；人签仍不进执行工单。
- Q3：选 1。本图下一张执行工单只收「L2 归档底线」（HTTP 入队 + worker + admin 回读 + 工程 signoffEligible + 未归档禁止默认开）。切边按推荐；不拆两张、不整包 P2.5、不只焊闸。
- 2026-08-29 用户确认落盘：关本工单；建 [L2 归档底线](./14-l2-archive-floor.md)。
