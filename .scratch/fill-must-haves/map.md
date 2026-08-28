# 按功能表补全必须具备

Label: wayfinder:map
Status: open

## Destination

从当前仓库现状出发，按 `prds/12-delivery-guides/14-模块需求功能表.md` 把各运行时模块的 **必须具备** 缺口补完，覆盖该表最终产品范围（P0–P5 入场项，含 P2.5 rewrite 出口、P3a Full 图、P3b 文档 ACL / 部门强制、P4 门禁包、P5 OCR）。本图携带执行。齐的口径按入场分层：该阶段先把产品语义做齐；换生产默认（B8 真 ES+IK、B9 真 RustFS、QUAL-2 真杀毒）是后续基础设施缺口，不挡更早阶段的语义行。

## Notes

- 域：StrictRAG。WHAT 冲突以 `prds/00–11` 为准；功能表是派生阅读件，不是接口契约。IS 以源码为准，`docs/module-status/` 是镜像。术语用功能表与 `prds/00-product/03-glossary.md`（必须具备、入场、拒答、双闸门、session 壳、rewrite 等）。不要为了缺文件去建 `CONTEXT.md` / `docs/adr/`。
- 每轮先读：本图、`docs/agents/issue-tracker.md`、`docs/agents/domain.md`、功能表、相关包的 `docs/module-status/`。写代码前读 `.trellis/spec/` 对应包。执行完成后跑 skill `update-module-status`。
- **覆盖「只做决策」**：工单可以动手补缺口，不只锁决策。
- **本图是执行面**：缺口只在 `.scratch/fill-must-haves/` 工单上做完。`.trellis/tasks/08-06-project-backlog/` 只留指针和勾选。同一缺口禁止再 `task.py create` 平行实现任务。这只覆盖本图，不改全仓其它流程。
- 顺序：先收仍未达 P2 必须具备语义的行，再开 P2.5；P3a 仍等 P2.5 二元出口（L2 归档准出或书面永久关 rewrite）；P3b 可在 P2 后并行，但不抽走 P2 余量。
- 人签（B10 业务 PASS）不是代码缺口，不进本图执行工单。
- 引用工单用标题，不要只写编号。一回合只解决一张工单（research 除外）。
- 开放工单不列在本图正文，用 `.scratch/fill-must-haves/issues/` 扫描：未 `resolved`、无未完成的 `Blocked by`、`Status` 不是 `claimed`。

## Decisions so far

- [盘点 P2 必须具备缺口](./issues/01-inventory-p2-must-haves.md) — P2 语义主路径大体齐；缺口在建库/Reindex/策略三层/评测 HTTP/引用回溯/空库 409 与 web 档位空态。全文 [inventory-p2.md](./inventory-p2.md)。
- [裁定第一批 P2 执行顺序](./issues/02-first-p2-execution-order.md) — 按能力切；第一批只做空库拒答对齐 200 与建库闭环（并行前沿，编号先取空库）；第二批 grilling 等这两张都完成。
- [空库拒答对齐 200](./issues/03-align-kb-not-ready-200.md) — 空库 ask 同步+SSE 改为 200 + `abstained` + `kb_not_ready`；web 走拒答卡；08-06 只留指针。
- [建库闭环](./issues/04-create-kb-closed-loop.md) — 建库必填首位库管并写入成员；租户令牌覆盖；admin 顶栏入口。
- [裁定第二批 P2 执行顺序](./issues/05-second-p2-execution-order.md) — 第二批只做策略三层最小闭环 → 文档运营余量最小闭环（真实挡住）；第三批 grilling 等这两张都完成。
- [策略三层最小闭环](./issues/06-strategy-three-layer-min.md) — 两张表 + catalog/for-upload + 设置启用/recommended + 上传人选 + 参数快照。
- [文档运营余量最小闭环](./issues/07-document-ops-remainder-min.md) — Reindex 人选、类型列+PATCH、双轴运营标签、archived/superseded。
- [裁定第三批 P2 执行顺序](./issues/08-third-p2-execution-order.md) — 四块全收串行：检索补钉→ask 审计→web 消费→评测；未进 §6 半接线与前批明确不做全划出；LangGraph 硬性标准、源码需重构。
- [检索语义补钉](./issues/09-retrieval-semantics-patch.md) — ES 查询期 tenantId+kbId、sparse_unavailable、档位 retrieveK 60/10、Mongo chunk_bodies 批取；dense 查询期 WHERE / 生效区间 / 召回扩展划出。
- [ask 审计与引用](./issues/10-ask-audit-citations.md) — `GET /ask/:requestId` 成员闸回读当时 evidence_snapshot + graph_trace；web 引用点回快照；断线重拉 / 审计管理台 / Langfuse SDK 划出。
- [web 消费余量](./issues/11-web-consumption-remainder.md) — 档位读 ask-modes 并传 mode；无库空态阻断；建议动作主按钮；429 配额文案；反馈报错/缺文档。库选择器只列成员库 / 在线编写划出。

## Not yet specified

- 未进第三批的 P2 半接线：入库报告、失败 Webhook、三平面配额、`/me/permissions` 路径、成员 PUT、在线编写、修改日志、超管引导、末位超管前端提示（Q2 划出，不进第三批执行工单）
- LangGraph 编排重构：技术栈冻结为 LangGraph.js（硬性标准）；源码现为线性状态机（`apps/api/src/graph/run.ts`），需后续重构为官方 LangGraph.js。不进 P2 执行工单，另起路线
- P2 语义收齐后的 **P2.5 二元出口**：L2 归档准出，还是产品书面永久关 rewrite（壳可留，standalone 能力仍须交付）
- P3a Full 图（CRAG / multi_hop）；硬门在 P2.5 出口
- P3b 尚未齐的强制检索面：ES 查询期对称、aclPrincipals 全文、敏感解禁、仓库默认开 `DEPT_ACL_ENFORCE`
- P4：L1 门禁包签字与再认证、多模型 fallback、双轨看板、数据面板增强
- P5：OCR 开闸、容量、熔断生产调优、在线抽样常态化、CoVe / 超长异步
- 基础设施缺口的切入时机：B8 / B9 / QUAL-2（不挡 P2 语义，但最终产品仍须收）

## Out of scope

- 功能表 §14 冻结非目标（微调私有权重、跨会话记忆、客户端调 τ、未审批就 scan、同一 `indexVersion` 双策略双索引等）
- 用本图改 `prds/00–11` 已冻语义（须 ADR → 改 PRD → 升版本）
- 未冻召回扩展冒充必达（parent-child / HyDE / 文档多样性 / 生成式模型冒充 rerank）
- 为同一缺口再建 Trellis 实现任务
- 把可演示 / S2 最小 / P-HALF 已完成当成「最终必须具备已齐」
- 双就绪自动升 `lifecycle=active`
- 改全仓 Trellis 开工纪律（仅本图覆盖）
