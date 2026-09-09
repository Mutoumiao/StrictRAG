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
- 顺序：本图 P2 语义已收官（第三批）；P2.5 出口走 **L2 归档准出**（工程路径 [L2 归档底线](./issues/14-l2-archive-floor.md) 已齐，人签仍图外）。鉴权/成员余量、入库报告、库选择器、admin 顶栏、web 关闭列表、启动引导超管、写路径锁超管全码、修改日志、三平面配额、失败 Webhook 已齐。在线编写留雾（P2.x）。P3b 可动手最小闭环已齐（ES 部门对称、aclPrincipals、ES principals、敏感解禁）。本图已转向 P4；L1 Hit@k、τ 扫描、Judge AUROC、generate fallback 与双轨看板已齐。下一张裁定开放。P3a 仍等 L2 人签。不默认开 `DEPT_ACL_ENFORCE`。不加角色 principal。
- **站规（UI）**：web / admin 新下拉必须基于 `@strict-rag/ui` 关闭列表，禁止浏览器原生 `<select>` 外壳（含现有 ui `Select`）。`Button` / `Input` / `Textarea` 仍走 ui 包。本规不改 GET / 鉴权语义。
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
- [评测底线](./issues/12-eval-floor.md) — gold-questions CRUD + admin `/eval`；`POST eval/runs` 入队 `sr-eval`；worker 跑 L1；GET 回读 2×2。回流黄金集 / 签字包 / 看板 / 多模型 fallback / 在线抽样划出。
- [裁定 P2 收官后下一步](./issues/13-after-p2-close-order.md) — 第三批即 P2 语义收官；出口走 L2 归档准出；下一张只做 L2 归档底线。剩余 P2 半接线留雾；人签 / 默认开 rewrite / 永久关不进执行。
- [L2 归档底线](./issues/14-l2-archive-floor.md) — HTTP 入队 session_multiturn + worker 多轮窗 + admin 跑 L2；工程 signoffEligible；未归档禁止默认开 rewrite。准出人签 / 默认开 / 连续追问 UI 划出。
- [裁定 L2 归档底线后下一步](./issues/15-after-l2-floor-order.md) — 继续补 P2.5 剩余必须具备；本批串行 web 连续追问消费 → L3 自动熔断。不回补 P2 半接线、不转 P3b、不等人签。
- [web 连续追问消费](./issues/16-web-multiturn-consumption.md) — `coref_unresolved` 拒答卡 + 主按钮「用完整问题重述」回填不重发；禁止宣传连续追问 / 准出。
- [L3 自动熔断](./issues/17-l3-auto-fuse.md) — 三 kind 闩后进程内关 rewrite 路径；`rewrite_dogfood` 不熔；不写 env / 窗 / 面板。
- [裁定 L3 自动熔断后下一步](./issues/18-after-l3-fuse-order.md) — 回头收剩余 P2 半接线；本批串行鉴权路径与成员 PUT → 末位超管前端提示。不转 P3b、不跳 P4、不等人签。
- [鉴权路径与成员 PUT](./issues/19-authz-path-and-member-put.md) — `GET /me/permissions` 与 `/auth/me` 同源；PUT members 只改 `role`；admin 可改角色；无 `allowedDocIds`。
- [末位超管前端提示](./issues/20-last-superadmin-hint.md) — 用户页唯一 active 超管禁用/剥超管角色不可点并出说明；API 400 闸不改。
- [裁定末位超管前端提示后下一步](./issues/21-after-last-superadmin-order.md) — 继续剩余 P2；本批只做入库报告最小闭环。不转 P3b、不跳 P4、不等人签。
- [入库报告最小闭环](./issues/22-ingest-report-min.md) — worker 落可查询报告；库级 GET；admin 文档行展开；只写真事。
- [裁定入库报告最小闭环后下一步](./issues/23-after-ingest-report-order.md) — 继续剩余 P2；本批只做库选择器只列成员库。不转 P3b、不跳 P4、不等人签。
- [库选择器只列成员库](./issues/24-kb-picker-members-only.md) — web 原生下拉只列本次 GET 可见库；空态开通成员；失败重试无输入；脏缓存不采用。
- [裁定库选择器只列成员库后下一步](./issues/25-after-kb-picker-order.md) — 继续剩余 P2；本批只做 admin 顶栏当前 KB 选择器。站规：新下拉必须用 ui 关闭列表。web 回改另张。不转 P3b、不跳 P4、不等人签。
- [admin 顶栏当前 KB 选择器](./issues/26-admin-kb-picker.md) — ui `ClosedSelect` + admin 顶栏只列本次 GET；禁止粘贴；空态/失败/未选中三套文案；脏缓存不采用；建库成功选中新建库。web 回改仍是下一张。
- [web 下拉换 ui 关闭列表](./issues/27-web-select-ui-library.md) — web 知识库与档位改用同一 `ClosedSelect`；过滤/空态/失败/脏缓存语义不变。
- [裁定 web 下拉换 ui 关闭列表后下一步](./issues/28-after-web-select-order.md) — 继续剩余 P2；本批只做启动引导超管（env 创建，不是页）。不转 P3b、不跳 P4、不等人签。
- [启动引导超管](./issues/29-superadmin-bootstrap.md) — listen 前对默认租户 upsert `permission_definitions`、超管角色写成 catalog 全码、无 active 超管按 env 创建或缺则失败。不是引导页、不是密码登录。
- [裁定启动引导超管后下一步](./issues/30-after-superadmin-bootstrap-order.md) — 继续剩余 P2；本批只做写路径锁超管全码。不转 P3b、不跳 P4、不等人签。
- [写路径锁超管全码](./issues/31-lock-superadmin-full-codes.md) — PUT/PATCH 改少 `super_admin` 绑码 400；全码幂等 200；admin 角色页勾选/保存不可点。
- [裁定写路径锁超管全码后下一步](./issues/32-after-superadmin-codes-lock-order.md) — 继续剩余 P2；本批只做修改日志最小闭环。不转 P3b、不跳 P4、不等人签。
- [修改日志最小闭环](./issues/33-settings-audit-min.md) — PATCH 有 diff 落 `kb_settings_audits`；GET settings-audit 可查询；admin 设置页一节。ARCH-P1b-2 仍是 Pino、不落表。
- [裁定修改日志最小闭环后下一步](./issues/34-after-settings-audit-order.md) — 继续剩余 P2；本批只做三平面配额最小闭环。不转 P3b、不跳 P4、不等人签。
- [三平面配额最小闭环](./issues/35-quota-planes-min.md) — ask/ingest 分 store 固定窗口（默认 0=关）互不阻断；ask 触顶 429 `RATE_LIMITED` + `ask_quota_exhausted`；指标带 `plane`；aux 只留常量。embed TPM / maxEmbedCalls / staging fail-closed 划出。
- [裁定三平面配额最小闭环后下一步](./issues/36-after-quota-planes-order.md) — 继续剩余 P2；本批只做失败 Webhook 最小闭环。在线编写仍 P2.x。不转 P3b、不跳 P4、不等人签。
- [失败 Webhook 最小闭环](./issues/37-ingest-failure-webhook-min.md) — env 可选 URL，空不发；`recordStageEnd` 失败 POST `ingest.failed` JSON 一次；超时约 3s；失败 warn 不阻断。HMAC / 重试队列 / admin 页 / ask webhook 划出。
- [裁定失败 Webhook 最小闭环后下一步](./issues/38-after-ingest-webhook-order.md) — 在线编写留雾（P2.x）；转向 P3b；本批只做 ES 查询期部门对称。不默认开强制、不解禁。
- [ES 查询期部门对称最小闭环](./issues/39-es-dept-query-filter-min.md) — mapping/bulk 写可选 `ownerDeptId`；enforce 开且非超管 ES terms 收窄；关或超管仍只 tenantId+kbId；PG 可见级闸保留。默认仍关强制。
- [裁定 ES 查询期部门对称后下一步](./issues/40-after-es-dept-filter-order.md) — 在线编写留雾；继续 P3b；本批只做 aclPrincipals 全文最小闭环。不默认开强制、不解禁、不跳 P4、不等人签。
- [aclPrincipals 全文最小闭环](./issues/41-acl-principals-min.md) — 可空用户 uuid 数组；null=成员可读；`[]`=非超管不可读；列表/详情/chunks/retrieve 同滤；不跟部门强制。无角色码 / 无 ES terms / 无默认开。
- [裁定 aclPrincipals 全文最小闭环后下一步](./issues/42-after-acl-principals-order.md) — 在线编写留雾；继续 P3b；本批只做 ES 查询期 principals 对称。不默认开强制、不解禁、不加角色码、不跳 P4、不等人签。
- [ES 查询期 principals 对称最小闭环](./issues/43-es-principals-query-filter-min.md) — mapping/bulk 写 keyword；null 不写；`[]` 写哨兵；非超管 should 收窄；不跟部门强制。PG 闸保留。无角色码 / 无默认开。
- [裁定 ES 查询期 principals 对称后下一步](./issues/44-after-es-principals-order.md) — 在线编写留雾；继续 P3b；本批只做敏感解禁。不默认开强制、不加角色码、不跳 P4、不等人签。
- [敏感解禁最小闭环](./issues/45-sensitive-complete-unlock-min.md) — sensitive complete 须 ACL 就绪：部门路径或显式名单（含 `[]`）；`null` 仍挡。complete 可同写名单。无默认开 / 无角色码。
- [裁定敏感解禁后下一步](./issues/46-after-sensitive-unlock-order.md) — 在线编写留雾；P3b 可动手闭环已齐，默认开强制与角色 principal 仍锁；转向 P4；本批只做 L1 Hit@k。不等人签。
- [L1 Hit@k 最小闭环](./issues/47-l1-hit-at-k-min.md) — 有非空 `expectedDocIds` 按 evidence `docId` 交集计 Hit@k；不改 2×2 / `signoffEligible`。脏名单抛错。逻辑 id 映射仍缺口。
- [裁定 L1 Hit@k 后下一步](./issues/48-after-l1-hit-at-k-order.md) — 在线编写留雾；P3b 站规仍锁；继续 P4；本批只做 L1 τ 扫描。不写 env、不新开 `tau_sweep` 入队。
- [L1 τ 扫描最小闭环](./issues/49-l1-tau-sweep-min.md) — 按 minSupport 离线扫网格得 tau*；无分数不得写成网格上沿。不改 2×2 / `signoffEligible`、不写 env。
- [裁定 L1 τ 扫描后下一步](./issues/50-after-l1-tau-sweep-order.md) — 在线编写留雾；P3b 站规仍锁；继续 P4；本批只做 Judge AUROC。不用黄金题型当 label、不新开 `verifier_calib` 入队。
- [Judge AUROC 最小闭环](./issues/51-l1-judge-auroc-min.md) — 独立校准集 Mann-Whitney 得 judgeAuroc；无打分器或单类为 null。不改 2×2 / `signoffEligible`、不接 `judgeAurocMin`。
- [裁定 Judge AUROC 后下一步](./issues/52-after-l1-judge-auroc-order.md) — 在线编写留雾；P3b 站规仍锁；继续 P4；本批只做 generate fallback。不做再认证 / 双轨看板 / 数据面板。不加 `GENERATE_MIN_NODES`。
- [generate 多模型 fallback 最小闭环](./issues/53-generate-fallback-min.md) — 绑定 generate fallbacks 运行时 opt-in 切链；切到备用才 `fallbackUsed=true`。无 `GENERATE_MIN_NODES`；图层不二次计费。
- [裁定 generate fallback 后下一步](./issues/54-after-generate-fallback-order.md) — 在线编写留雾；P3b 站规仍锁；继续 P4；本批只做双轨看板。不做再认证 / 数据面板增强。不改 B6 信封。
- [双轨看板最小闭环](./issues/55-dual-dashboard-tracks-min.md) — 独立 tracks GET；质量=最近一笔 L1 工程账本；延迟=24h avg/p95。不改 B6 summary。≠ APM / ≠ 准出。

## Not yet specified

- 剩余 P2 半接线（P2 代码真空已出雾）：在线编写（完整体验 P2.x）
- LangGraph 编排重构：技术栈冻结为 LangGraph.js（硬性标准）；源码现为线性状态机（`apps/api/src/graph/run.ts`），需后续重构为官方 LangGraph.js。另起路线
- P3a Full 图（CRAG / multi_hop）；硬门在 L2 归档准出（工程路径是 L2 归档底线；人签不进本图）
- P3b 尚未齐的强制检索面：仓库默认开 `DEPT_ACL_ENFORCE`、角色 principal
- P4 其余：L1 门禁包人签与再认证、数据面板增强；独立 `tau_sweep` / `verifier_calib` 入队、把 tau* 接到运行时、live judge 真跑、Grafana 时序仍缺口
- P5：OCR 开闸、容量、熔断生产调优、在线抽样常态化、CoVe / 超长异步
- 基础设施缺口的切入时机：B8 / B9 / QUAL-2（不挡更早语义，但最终产品仍须收）

## Out of scope

- 功能表 §14 冻结非目标（微调私有权重、跨会话记忆、客户端调 τ、未审批就 scan、同一 `indexVersion` 双策略双索引等）
- 用本图改 `prds/00–11` 已冻语义（须 ADR → 改 PRD → 升版本）
- 未冻召回扩展冒充必达（parent-child / HyDE / 文档多样性 / 生成式模型冒充 rerank）
- 为同一缺口再建 Trellis 实现任务
- 把可演示 / S2 最小 / P-HALF 已完成当成「最终必须具备已齐」
- 双就绪自动升 `lifecycle=active`
- 改全仓 Trellis 开工纪律（仅本图覆盖）
