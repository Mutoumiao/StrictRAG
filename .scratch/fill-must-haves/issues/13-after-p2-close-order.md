# 裁定 P2 收官后下一步

Type: grilling
Label: wayfinder:grilling
Status: open
Triage: ready-for-human
Blocked by: 12

## Question

[评测底线](./12-eval-floor.md) 已 `resolved`，第三批四块（检索补钉 → ask 审计 → web 消费 → 评测底线）收完。裁定 **下一步** 做哪条、是否还开 P2 半接线执行工单，还是转向 P2.5 二元出口。

候选（来自地图 Not yet specified，及第三批明确不做）：

1. 未进第三批的 P2 半接线（入库报告、失败 Webhook、三平面配额、`/me/permissions` 路径、成员 PUT、在线编写、修改日志、超管引导、末位超管前端提示）
2. **P2.5 二元出口**：L2 归档准出，还是产品书面永久关 rewrite
3. 先停执行、只把第三批收口给人签（B10 人签不进本图）

约束（已锁）：本图是执行面；B8 / B9 / QUAL-2 与人签不进；不提前切 P3a；LangGraph 重构另起路线。本工单只锁顺序与切边，不写产品代码。
