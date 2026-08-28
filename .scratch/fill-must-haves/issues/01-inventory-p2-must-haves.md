# 盘点 P2 必须具备缺口

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent

## Question

对照 `prds/12-delivery-guides/14-模块需求功能表.md` 里 **入场 = P2**（含「P2 契约 / P2 底线 / P2 权限必达」这类仍属 P2 语义）的必须具备行，核对当前仓库 **IS**，产出一份可点名的缺口清单，供后续工单裁定第一批动手顺序。

范围：

- 模块：web、admin、api、worker、contracts、db、admin-catalog、Gateway / 模型绑定、质量与观测里入场为 P2 的行。
- 口径（本图已锁）：按入场分层。只判 **P2 产品语义是否齐**，不要把「仓库默认仍 mock / AUTH 默认关 / B8 B9 QUAL-2 未换生产默认」写成 P2 语义缺口。
- 权威：源码 > `docs/module-status/` > 功能表派生叙述。功能表与 `prds/00–11` 冲突时记一笔并跟 PRD，不在本工单改 PRD。
- 「已齐」= 源码可核对该行 P2 语义（接口 / 闸 / 页 / 测）。「半接线」单独一列，不算齐。「可演示 / S2 最小 / P-HALF 已完成」不得直接抄成已齐。
- 不写入场晚于 P2 的行（P2.5 rewrite 默认开、P3a Full 图、P3b 强制检索、P4 看板、P5 OCR）。P2 已冻但主路径关的 rewrite 规格：只确认「关」与会话壳，不把「默认开」当 P2 缺口。
- 本工单 **不改产品代码**。清单写成资产文件并在本工单链接，不要把整表贴进工单正文。

建议资产路径：`.scratch/fill-must-haves/inventory-p2.md`。

每行至少包含：功能表定位（节/行名）、入场原文、IS 证据路径、判定（齐 / 半接线 / 缺）、一句话缺口。

## Answer

P2 语义盘点已写成资产：[inventory-p2.md](../inventory-p2.md)。

要点：

- 信任环主路径（ask 双通道、verify、硬 rerank、会话壳且 rewrite 关、审批闸、分片只读）**语义大体齐**；默认 mock 不记缺口。
- **缺**集中在：建库 UI、Reindex UI、docType 标注、评测 HTTP+运营页、`GET /ask/:requestId`、ingest-report、策略三层表、web 档位与无库空态、ES 查询期 `tenantId`、失败 Webhook。
- **半接线**高影响：空库 ask 走 409，与 PRD 冻结的 200+`kb_not_ready` 冲突（跟 PRD）；`/me/permissions` 落在 `/auth/me`；建库无 `initialAdminUserId`；KB 绑定可碰 judge；对称 ACL / Mongo 正文未齐。
- `docs/module-status/` 滞后，未按状态文抄齐。

未改产品代码。未切第一批执行工单（留给 [裁定第一批 P2 执行顺序](./02-first-p2-execution-order.md)）。

## Comments

- 2026-08-28 认领并完成盘点；资产见 `inventory-p2.md`。
