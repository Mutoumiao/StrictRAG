# 裁定第二批 P2 执行顺序

Type: grilling
Label: wayfinder:grilling
Status: claimed
Assignee: grok
Triage: ready-for-human
Blocked by: 03, 04

## Question

在 [空库拒答对齐 200](./03-align-kb-not-ready-200.md) 与 [建库闭环](./04-create-kb-closed-loop.md) 都 `resolved` 之后，裁定 **第二批 P2 语义** 做哪些、什么顺序、每张执行工单的边界，以及明确再留后批的半接线。

切法已锁（不要重开）：按端到端能力切，不按运行时模块切。第一批已收空库拒答与建库闭环，不要把它们再排进来。

候选能力块（来自 [inventory-p2.md](../inventory-p2.md) §6 未做部分，及第一批明确划出的消费面）：

1. 文档运营余量（Reindex 人选策略、docType、双轴标签、lifecycle）
2. 策略三层（表 + catalog HTTP + 设置弹窗 + 上传人选）
3. 评测底线（gold-questions + 入队 + admin 薄页）
4. ask 审计与引用（`GET /ask/:requestId`；引用点回）
5. web 消费余量（档位、无可用库空态、建议动作主按钮、配额文案、反馈类别）
6. 检索语义补钉（`tenantId` filter、ACL filter、sparse reason、档位 retrieveK、Mongo 正文）

另有未进 §6 的半接线（ingest-report、失败 Webhook、LangGraph、三平面配额、`/me/permissions` 路径、成员 PUT 等）是否进本批，本工单一起锁。

约束（已锁）：只处理 P2 语义；B8 / B9 / QUAL-2 与人签不进；不提前切 P2.5 / P3a / P3b / P4 / P5 执行工单；本图是执行面，后续执行工单仍建在 `.scratch/fill-must-haves/issues/`。

本工单只锁顺序与切边，不写产品代码。决议后把第二批执行工单建为本图子工单。

## Comments

- 2026-08-28 按图顺序认领本工单。本回合只锁第二批范围、顺序与切边，不写产品代码。
- Q1：第二批只收运营一条路：文档运营余量 + 策略三层。评测底线、ask 审计与引用、web 消费余量、检索语义补钉留后批。
