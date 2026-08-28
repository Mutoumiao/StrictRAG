# 裁定第三批 P2 执行顺序

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
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

## Answer

按端到端能力切（已锁，不重开）。第三批是 P2 收官批，四块全收、串行：

- [检索语义补钉](./09-retrieval-semantics-patch.md) — 开放前沿。ES 查询期 `tenantId` filter、`buildAclFilter`、sparse reason、档位 retrieveK、正文批取 Mongo。
- [ask 审计与引用](./10-ask-audit-citations.md) — `Blocked by` 检索语义补钉。`GET /ask/:requestId`、web 引用点回。
- [web 消费余量](./11-web-consumption-remainder.md) — `Blocked by` ask 审计与引用。档位 UI、无库空态、建议动作主按钮、配额文案、反馈类别。
- [评测底线](./12-eval-floor.md) — `Blocked by` web 消费余量。gold-questions + eval 入队 + admin 薄页 + 结果查询。

本批明确不做：未进 §6 的半接线（入库报告、失败 Webhook、LangGraph、三平面配额、`/me/permissions`、成员 PUT、在线编写、修改日志、超管引导、末位超管前端提示）；前两批执行工单各自「明确不做」（平台策略 CRUD、paramSchema 动态表单、生效区间、DELETE/替代联动、类型分区 CRUD、上传标部门、GET /doc-types、策略审计展示、编辑器草稿等）。B8 / B9 / QUAL-2、人签、P2.5 及更晚。

**LangGraph 硬性标准**：技术栈冻结清单（`prds/01-architecture/02-tech-stack-frozen.md`）要求编排用 LangGraph.js；源码现为线性状态机、未采用官方图，**需后续重构为官方 LangGraph.js**。本工单冻结此项；不进 P2 执行工单，另起路线。已在地图 Not yet specified 标注。

未改产品代码。

## Comments

- 2026-08-28 按图顺序认领本工单。本回合只锁第三批范围、顺序与切边，不写产品代码。
- Q1：四块全收，作为 P2 收官批。
- Q2：未进 §6 的半接线（入库报告、失败 Webhook、LangGraph、三平面配额、`/me/permissions`、成员 PUT、在线编写、修改日志、超管引导、末位超管前端提示）不进本批。
- Q3：前两批执行工单「明确不做」全部维持。
- Q4：四块串行：检索语义补钉 → ask 审计与引用 → web 消费余量 → 评测底线，每张 `Blocked by` 前一张。
- Q5–Q8：四块切边按推荐（做 / 不做见四张子工单正文）。
- Q9：LangGraph 为硬性标准；源码未采用官方图，已在地图 Not yet specified 与工单 Answer 各标一处，注明后续需重构。
- 2026-08-28 用户确认落盘：关本工单；建检索语义补钉、ask 审计与引用、web 消费余量、评测底线四张执行工单。
