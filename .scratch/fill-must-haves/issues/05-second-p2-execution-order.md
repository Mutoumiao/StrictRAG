# 裁定第二批 P2 执行顺序

Type: grilling
Label: wayfinder:grilling
Status: resolved
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

## Answer

按端到端能力切（已锁，不重开）。第二批只收运营一条路，两张执行工单：

- [策略三层最小闭环](./06-strategy-three-layer-min.md) — 开放前沿。两张表 + 种子已实现码；catalog / schema / for-upload / 库启用 PATCH；设置弹窗启用 + recommended；上传人选；complete 选择规则（≥2 未选 → 400，仅 1 个可自动）；写入策略码 + 参数快照。
- [文档运营余量最小闭环](./07-document-ops-remainder-min.md) — `Blocked by` 策略三层最小闭环。Reindex 列表按钮 + ≥2 人选；类型列 + PATCH（码属于该库已有枚举）；双轴运营标签；lifecycle 补 `archived` / `superseded`。

第三批不在本回合拆执行工单，挂 grilling：[裁定第三批 P2 执行顺序](./08-third-p2-execution-order.md)，`Blocked by` 上述两张。

本批明确不做：评测底线、ask 审计与引用、web 消费余量、检索语义补钉；未进 §6 的半接线（入库报告、Webhook、LangGraph、三平面配额、`/me/permissions`、成员 PUT、在线编写、修改日志、超管引导、末位超管前端提示）；两张执行工单各自「明确不做」。B8 / B9 / QUAL-2、人签、P2.5 及更晚。08-06 指针随第一张执行工单写。

未改产品代码。

## Comments

- 2026-08-28 按图顺序认领本工单。本回合只锁第二批范围、顺序与切边，不写产品代码。
- Q1：第二批只收运营一条路：文档运营余量 + 策略三层。评测底线、ask 审计与引用、web 消费余量、检索语义补钉留后批。
- Q2：未进 §6 的半接线一律不进本批（入库报告、Webhook、LangGraph、三平面配额、`/me/permissions`、成员 PUT、在线编写、修改日志、超管引导、末位超管前端提示）。
- Q3：策略三层先做；文档运营余量写真实 Blocked-by（人选策略依赖 catalog）。
- Q4：策略三层 = 最小闭环（两张表 + catalog/for-upload + 设置弹窗启用/recommended + 上传人选 + 参数快照）。不做平台 CRUD 页、动态 paramSchema 引擎、新算法、OCR、自动全库 reindex、策略审计查询面。
- Q5：文档运营余量 = 最小闭环（Reindex 人选、类型列+PATCH、双轴运营标签、archived/superseded）。不做生效区间、DELETE、替代联动、上传标部门、类型分区 CRUD、GET /doc-types、编写、入库报告、策略审计展示。
- Q6：本回合建两张执行工单，外加 grilling「裁定第三批 P2 执行顺序」；后者 Blocked-by 策略三层最小闭环与文档运营余量最小闭环。5–8 不在本回合拆成执行工单。08-06 指针随第一张执行工单写。
- 2026-08-28 用户确认落盘：关本工单；建策略三层最小闭环、文档运营余量最小闭环、裁定第三批 P2 执行顺序。
