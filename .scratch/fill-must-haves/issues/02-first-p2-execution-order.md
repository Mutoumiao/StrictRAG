# 裁定第一批 P2 执行顺序

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-human
Blocked by: 01

## Question

在 [盘点 P2 必须具备缺口](./01-inventory-p2-must-haves.md) 的清单上，裁定 **第一批要动手补的 P2 语义缺口**：做哪些、什么顺序、每张后续执行工单的切法（按模块或按端到端能力），以及本批明确不做的半接线（留到后一批）。

约束（已锁，不要重开）：

- 只处理 P2 语义缺口；B8 / B9 / QUAL-2 与人签不进本批。
- 本图是执行面：后续执行工单建在 `.scratch/fill-must-haves/issues/`，不要为同一缺口再建 Trellis 实现任务。
- 按入场分层：本批判齐的标准是 P2 产品语义，不是生产默认依赖。
- 不要提前切 P2.5 / P3a / P3b / P4 / P5 的执行工单；那些仍在迷雾里，除非盘点证明某行其实是 P2 语义缺口被误标。

本工单只锁顺序与切法，不写产品代码。决议后把第一批执行工单建为本图子工单并接上阻塞边。

## Answer

按端到端能力切，不按运行时模块切。第一批只做两张执行工单，均为开放前沿（不写假阻塞），编号小的先取：

- [空库拒答对齐 200](./03-align-kb-not-ready-200.md) — 同步/SSE 改为 200+`abstained`+`kb_not_ready`；web 拒答展示；改测例与覆盖镜像。不做主按钮、无可用库空态、不改 `prds/00–11` 残留 409 表。
- [建库闭环](./04-create-kb-closed-loop.md) — 必填 `initialAdminUserId` 写入库管成员；`tenantId` 令牌覆盖；admin 挂选择器或文档域；首位库管预填当前用户可改。不做成员 PUT、超管引导、建库向导。

第二批不在本回合拆执行工单，挂 grilling：[裁定第二批 P2 执行顺序](./05-second-p2-execution-order.md)，`Blocked by` 上述两张。

本批明确不做：§6 其余 6 块；未进 §6 的半接线（ingest-report、Webhook、LangGraph、三平面配额、`/me/permissions`、成员 PUT 等）；B8 / B9 / QUAL-2、人签、P2.5 及更晚。08-06 指针随第一张执行工单写。

未改产品代码。

## Comments

- 2026-08-28 按图顺序认领本工单。本回合只锁顺序与切法，不写产品代码。
- Q1：执行工单按端到端能力切（跨 web / admin / api / worker），对齐盘点 §6 的能力方向；不按运行时模块分包切。
- Q2：第一批只收空库拒答语义 + 建库闭环。§6 其余 6 块及未进 §6 的半接线留后批。
- Q3：两张都是开放前沿，不写假 Blocked by；空库拒答编号更小，无票名时按编号先取。
- Q4：空库拒答工单只对齐主路径——同步/SSE 改为 200+abstained+kb_not_ready+冻结文案；web 走拒答展示；改测例与覆盖镜像。不做建议动作主按钮、无可用库空态、不改 prds/00–11 残留 409 表。
- Q5：建库闭环 = API 必填 initialAdminUserId 并写入库管成员；tenantId 令牌覆盖；admin 挂在已有选择器或文档域（有 kb.create 才显示）；表单名称+首位库管（预填当前用户可改）。不做成员 PUT、超管引导、建库向导配策略/类型/绑定。
- Q6：本回合建两张第一批执行工单，外加一张 grilling「裁定第二批 P2 执行顺序」；后者 Blocked by 空库拒答与建库闭环。3–8 不在本回合拆成执行工单。08-06 指针随第一张执行工单写。
- 2026-08-28 用户确认落盘：关本工单；建空库拒答对齐 200、建库闭环、裁定第二批 P2 执行顺序。
