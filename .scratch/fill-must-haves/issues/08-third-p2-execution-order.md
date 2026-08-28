# 裁定第三批 P2 执行顺序

Type: grilling
Label: wayfinder:grilling
Status: open
Triage: ready-for-human
Blocked by: 06, 07

## Question

在 [策略三层最小闭环](./06-strategy-three-layer-min.md) 与 [文档运营余量最小闭环](./07-document-ops-remainder-min.md) 都 `resolved` 之后，裁定 **第三批 P2 语义** 做哪些、什么顺序、每张执行工单的边界，以及明确再留后批的半接线。

切法已锁（不要重开）：按端到端能力切。第一批已收空库拒答与建库闭环；第二批已收策略三层最小闭环与文档运营余量最小闭环。不要把它们再排进来。

候选能力块（来自 [inventory-p2.md](../inventory-p2.md) §6 未做部分，及前两批明确划出的消费/半接线）：

1. 评测底线（gold-questions + 入队 + admin 薄页）
2. ask 审计与引用（`GET /ask/:requestId`；引用点回）
3. web 消费余量（档位、无可用库空态、建议动作主按钮、配额文案、反馈类别）
4. 检索语义补钉（`tenantId` filter、ACL filter、sparse reason、档位 retrieveK、Mongo 正文）

另有未进 §6 的半接线，以及第二批「明确不做」留下的面（入库报告、Webhook、LangGraph、三平面配额、`/me/permissions`、成员 PUT、平台策略 CRUD、paramSchema 动态表单、生效区间、DELETE/替代联动、类型分区 CRUD、在线编写等）是否进本批，本工单一起锁。

约束（已锁）：只处理 P2 语义；B8 / B9 / QUAL-2 与人签不进；不提前切 P2.5 / P3a / P3b / P4 / P5 执行工单；本图是执行面，后续执行工单仍建在 `.scratch/fill-must-haves/issues/`。

本工单只锁顺序与切边，不写产品代码。决议后把第三批执行工单建为本图子工单。

## Comments
