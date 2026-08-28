# P2 必须具备 · 缺口盘点

对照：`prds/12-delivery-guides/14-模块需求功能表.md` 入场含 P2 的行。  
权威：源码 > `docs/module-status/`。功能表与 `prds/00–11` 冲突时跟 PRD。  
口径：只判 **P2 产品语义**。默认 mock ES / `AUTH_ENFORCE` 关 / B8·B9·QUAL-2 未换生产默认 **不记缺口**。半接线 **不算齐**。  
不做：改产品代码；P2.5 默认开 rewrite、P3a Full 图、P3b 强制检索、P4 看板、P5 OCR。

日期：2026-08-28。

---

## 0. 怎么用这份清单

- **缺**：P2 行在源码里没有对应能力（页 / 路由 / 闸）。
- **半接线**：有壳或主路径，但缺关键语义（错 HTTP、缺字段、缺运营交互、错 reason）。
- **齐**：源码可核对该行 P2 语义。PRD 写明本阶段就是壳的（部门、面板薄）标「齐（壳）」。
- 第一批动手顺序见工单「裁定第一批 P2 执行顺序」。第二批见「裁定第二批 P2 执行顺序」。

`docs/module-status/` **已滞后**：仍写 admin 无上传 / 无 docTypes、api 无 KB 绑定 PUT。源码已有上传、settings docTypes、`PUT …/model-bindings`。下文以源码为准。

---

## 1. 跟 PRD 的冲突（跟 `00–11`，不改功能表）

| 题 | 功能表 / PRD | 源码 | 本盘判定 |
|----|----------------|------|----------|
| 空库 ask | `prds/05-api/01-http-api-hono.md`：冻结 **200 + `status=abstained` + `reason=kb_not_ready`**；`KB_NOT_READY` 不得用于 ask 主路径 | `apps/api/src/services/ask/execute.ts`：200；测例 `kb_not_ready → 200` 拒答信封（工单「空库拒答对齐 200」已纠） | **齐**（HTTP 语义；`prds/00–11` 残留 409 表未改） |
| 问答编排 | 技术栈冻结 + 功能表 §0：**LangGraph.js** | `apps/api/src/graph/run.ts` 注释：线性状态机替代 | **半接线**（流程节点在，编排库不在） |

---

## 2. 总览（只计 P2 语义行）

| 判定 | 主要落点 |
|------|----------|
| **缺** | Reindex UI；文档类型标注 UI；评测 HTTP+admin 页；`GET /ask/:requestId`；ingest-report；失败 Webhook；ES 查询强制 `tenantId`；web 档位；web 无库空态；在线编写页 |
| **半接线** | `/me/permissions` 走 `/auth/me`；成员无 PUT/`allowedDocIds`；策略仅进程内闸；KB 绑定可碰 judge；对称 ACL / 生效区间 / Mongo 正文；scan 外的 maintenance；Langfuse 无 SDK；web 库选择器/引用点回/建议动作/配额文案 |
| **齐（含壳）** | 登录 JWT；会话壳+rewrite 关；ask 同步+SSE；空库 200+`kb_not_ready`；成员闸；verify/min 否决/claim_split；硬 rerank 失败不 answered；分片只读；审批闸；反馈 API；用户/角色/部门壳；面板权限；Key 不明文 |

人签（B10 业务 PASS）按地图 Notes **不是代码缺口**，未列入。

---

## 3. 缺（P2 语义真空）

| 定位 | 入场原文 | IS 证据 | 判定 | 一句话缺口 |
|------|----------|---------|------|------------|
| §3 无可用知识库 | P2 | `apps/web/src/components/ask-panel.tsx`：`kbOptions` 空仍渲染提问表 | 缺 | 无「找管理员开通成员」阻断空态 |
| §3 问答档位 | P2 | web `ask.ts` options 仅 `stream:true`；面板无 mode | 缺 | 不读 `allowedModes`、不传 `mode` |
| §4.1 / §4.3 创建知识库 | P2 | admin 顶栏 KB 选择器旁有建库入口（`kb.create`）；`CreateKbBodySchema` 必填 `initialAdminUserId`（工单「建库闭环」） | 齐（入口） | 成员 PUT / 向导配策略仍后批 |
| §4.3 Reindex | P2 | admin 无 reindex 调用；api `POST …/reindex` 已有 | 缺 | 权限码闲置，列表无按钮 |
| §4.3 文档类型标注 | P2 | 文档 PATCH 仅部门/可见级；列表无 `docType` | 缺 | 无法标注/校验类型 |
| §4.2 修改日志可查 | P2 | settings 仅 GET/PATCH，无运营查询面 | 缺 | 谁/何时/旧→新不可查 |
| §4.5 平台注册表 | P2 | 有 `chunk_strategy_definitions` 种子表；无运营 CRUD 页（工单「策略三层最小闭环」明确不做） | 齐（种子表） | 运营扩展任意新 code 仍后批 |
| §4.5 库启用 | P2 | 有 `kb_chunk_strategies` + 设置弹窗启用/recommended（工单「策略三层最小闭环」） | 齐（启用） | paramSchema 动态表单仍后批 |
| §4.1 黄金集/跑批 UI | P2 底线 | `eval.run` 有码，无 `/eval` href/页 | 缺 | 运营不能维护题、不能入队跑批 |
| §4.3 在线编写页 | 审批闸 P2；完整体验 P2.x | 无 editor 路由；无 BlockNote | 缺（页）/ P2.x 可后 | 无编写入口；BlockNote 不并进 P2 必做 |
| §5.2 引用回溯 | P2 | 仅内部 `getAskTraceByRequestId`；无 `GET /ask/:requestId` | 缺 | 不能按权限回溯 evidence_snapshot |
| §5.2 黄金集/评测 HTTP | P2 | 仅 CLI `run-l1-golden.ts`；无 gold-questions / `eval/runs` / `GET /jobs/:id` | 缺 | API 不入队、worker 无 eval 消费者 |
| §5.2 入库报告 | P1–P2 | 仅 `GET …/ingest-jobs`；worker 管道内有 `ingestReport` 对象未导出 HTTP | 缺 | 无冲突对 / L0L1 / skip 报告 |
| §5.2 编辑器草稿 HTTP | P2.x 编辑器 | 无 `editor-draft` | 缺 | 与审批闸分开：闸已有，草稿协议无 |
| §8 ES `tenantId` filter | P2 共享索引必须强制 | `es-sparse.ts` / `es-http.ts` 查询与 mapping 只有 `kbId` | 缺 | 事后交 PG 不能代替查询期租户 filter |
| §9 三平面配额 | P2 | 仅 `ASK_RATE_LIMIT_RPM` | 缺 | 无 ingest / aux 隔离 |
| §10.3 失败 Webhook | P2 契约 | 全仓无业务 webhook | 缺 | 无失败告警契约 |

---

## 4. 半接线（有能力、语义不齐）

### 4.1 web

| 定位 | 入场 | 证据 | 判定 | 缺口 |
|------|------|------|------|------|
| 知识库切换 | P2 | `listKnowledgeBases` + datalist，仍可手填任意 uuid | 半接线 | 不是「只列成员库」的切换器 |
| 新建会话 | P2 | 有显式 `POST /sessions`；`data-ask-final.sessionId` 会回绑 | 半接线 | 单轮后可能被挂上会话（api 侧未隐式建库，见 §5 齐） |
| 流式回答 | P2 | 默认 SSE；终态等 `data-ask-final` | 半接线 | 无按 `requestId` 断线重拉 |
| 引用卡片 | P2 | 展示本轮 citations，闲聊不挂 | 半接线 | 不可点回分片详情 |
| 库无现行文档 | P2 | 服务端 200 + `abstained` + `kb_not_ready`；web 拒答卡（工单「空库拒答对齐 200」） | 齐（拒答信封） | 建议动作仍只列表、无主按钮（后批） |
| 建议动作 | P2 | `suggestedActions` 仅列表 | 半接线 | 无按 reason 的主按钮 |
| 配额触顶 | P2 | 失败不装 answered；不识别 429 | 半接线 | 无配额文案 |
| 答案反馈 | P2 | 赞/踩有；answered/abstained 可提交 | 半接线 | 无报错/缺文档类别 |

### 4.2 admin

| 定位 | 入场 | 证据 | 判定 | 缺口 |
|------|------|------|------|------|
| 文档页 | P2 | 列表有 status×lifecycle 列、上传、上架 | 半接线 | 无类型列、编写、Reindex、入库报告入口 |
| 知识库设置 | P2 禁空壳 | 页非空 | 半接线 | 策略/类型/绑定分区不齐（见下） |
| 反馈队列 | P2 | dismiss / linked_doc | 半接线 | 无回流黄金集；IA 未拆「反馈」一级 |
| 平台模型绑定 | P2 | purpose 下拉 | 半接线 | 无 rerank 链节点校验；不禁 judge=aux 同模 |
| 角色授码 | P2 树状；超管锁全码 | 扁平勾选 | 半接线 | 非菜单树；超管仍可点授码 |
| 文档类型分区 | P2 枚举 CRUD | 逗号字符串 | 半接线 | 无排序/启用/逐条 |
| 分片策略分区 | P2 弹窗+paramSchema | 弹窗启用 + recommended（工单「策略三层最小闭环」） | 齐（最小弹窗） | 无动态 paramSchema 表单 |
| KB 消费绑定 | P2 generate/embed/rerank | 仅 embed.primary | 半接线 | 无 generate/rerank、无跟随平台 |
| 质量只读 | P2 τ+签字包链 | tauClaim / gatePackageId | 半接线 | 无链展示 |
| 上传 | P2 预签名→审批；策略可选 | upload-url→complete；for-upload 人选 | 半接线 | 上传不标部门/类型（策略人选已收） |
| 状态双轴 | P2 运营标签 | 分列原串 | 半接线 | 未映射「现行可问」等标签 |
| 生命周期 | P2 四态+生效区间 | 仅 active↔draft | 半接线 | 无废止/替代/归档/区间 |
| 文档绑定策略 | P2 一篇一策略 | 写死 `structure_paragraph` | 半接线 | 无人选、无审计展示 |
| 超管引导 | P2 | 仅 dev-login 选 super_admin | 半接线 | 无启动引导超管 |
| 末位超管 | P2 | 闸在 api；admin 无提示 | 半接线 | 前端可点禁用 |

### 4.3 api / 图 / 网关

| 定位 | 入场 | 证据 | 判定 | 缺口 |
|------|------|------|------|------|
| 空库 ask | P2 | `execute.ts` 200 + `kb_not_ready`（工单「空库拒答对齐 200」） | 齐 | `prds/00–11` 残留 409 表未改（地图禁止用本图改冻结文） |
| `GET /me/permissions` | P2 | `GET /api/v1/auth/me` 带 permissions | 半接线 | 路径不是 PRD 短名 |
| 建库 | P2 `initialAdminUserId` | `CreateKbBodySchema` 必填；写入 `kb_members(role=admin)`（工单「建库闭环」） | 齐 | 成员 PUT / `allowedDocIds` 仍后批 |
| 成员 | P2 GET/PUT/DELETE | 仅 GET/POST/DELETE | 半接线 | 无 PUT；无 `allowedDocIds` |
| 上传 complete | P2 MIME/checksum | 有体积闸 | 半接线 | 无 MIME 白名单、无 checksum |
| 审批资源 | P2 列表/详情 | 按文档 approve/reject | 半接线 | 无独立审批工单资源 |
| 文档 DELETE/supersede | P2 | lifecycle 枚举含 superseded | 半接线 | 无 DELETE、无替代联动 |
| 分片策略 HTTP | P2 列表/schema/for-upload | catalog / schema / for-upload / PATCH（工单「策略三层最小闭环」） | 齐（最小 HTTP） | 无平台定义 CRUD |
| 文档类型 GET | P2 | settings 内 docTypes；scope 真过滤 | 半接线 | 无 `GET …/doc-types` |
| 限流 | P2 分维 | 仅 ask 窗，默认 RPM=0 | 半接线 | complete 无限流维 |
| 健康检查 | P0/P2 | `/health`、`/ready`、`/metrics` | 半接线 | 不是 `/health/ready`；metrics 裸奔 |
| ACL 对称 filter | P2 | PG 语料闸 + ES 仅 kbId | 半接线 | 无 `buildAclFilter`、无生效区间、无 `ACL_DOC_IDS_MAX` |
| dense | P1 索引；P2 进 ask | 滤后进程内 cosine | 半接线 | 不是查询期 pgvector+WHERE |
| 稀疏失败 reason | P2 | retrieve 失败不装 answered | 半接线 | reason 不是 `sparse_unavailable` |
| 档位预算 | P2 | 客户端不能改阈值 | 半接线 | 服务端未按 fast 60/10 改 retrieveK |
| 正文 | P2 Mongo 批取 | PG `body_text` | 半接线 | 未批取 Mongo |
| 空证据细分 | P2 | `low_retrieval` / `kb_not_ready` | 半接线 | 无 `no_docs_in_scope` |
| rewrite 误开 | P2 可 400 | 默认关；env 开则真跑 | 半接线 | 未 L2 却开不会 400 |
| 创建库 tenant | P2 令牌权威 | POST 忽略 body `tenantId`，令牌覆盖（无令牌回落默认租户） | 齐 | — |
| KB 绑定 judge | P2 禁覆盖 judge* | PUT 未禁；generate 可预填 judge | 半接线 | 消费端隔离不完整 |
| fetch-models | P2 | 无上游代理 | 半接线 | 仅本地清单 |
| LangGraph | §0 必须采用 | 线性 `run.ts` | 半接线 | 节点在、官方图不在 |
| route purpose | P2 | `route-rules.ts` 纯规则 | 半接线 | 不调 LLM `route`（规则+禁词闸本身符合路由防误） |

### 4.4 worker / 共享 / 质量

| 定位 | 入场 | 证据 | 判定 | 缺口 |
|------|------|------|------|------|
| 策略注册表（worker 侧） | P2 | 仅 `structure_paragraph` + contracts 常量 | 半接线 | 与 §4.5 缺表同一缺口 |
| `ingest.maintenance` | P1–P2 | reindex 再入队；无独立维护 job | 半接线 | 无孤儿清理/租户迁移运维面 |
| `eval.run` 架构 | P2 底线 | api 进程内 CLI | 半接线 | 不是「API 入队 / worker 跑批」 |
| admin-catalog 评测 | P2 | 有 `eval.run` 码、无菜单 | 半接线 | 裁不出评测页 |
| 约束生成 | P2 每句 `[chunkId]` | JSON citations / insufficient 旗标 | 半接线 | 不是句级引用 + `INSUFFICIENT_EVIDENCE` |
| citation 去重 | P2 | 非法剥离+空引用拒 | 半接线 | 无重叠句归属/chunk 去重 |
| 单一真相 | P2 Mongo | 图内 evidence 自洽 | 半接线 | PG 演示正文 |
| Langfuse | P2 | mock export 日志 | 半接线 | 无 SDK / generation / dataset |
| 指标骨架 | P2 | ask/llm/rerank counters | 半接线 | 无 fallback/node_used；metrics 无鉴权 |
| Pino/Sentry | P0–P2 | Pino 有 | 半接线 | 无 Sentry（可选） |
| ui 业务件 | P0–P2 | 原子件+主题 | 半接线 | 引用卡/拒答不在 ui 包（web 自绘，不挡问答语义） |
| db 策略三层 | 随阶段长表 | 无三层表 | 半接线 | 见 §4.5 缺 |

### 4.5 齐（压缩，供对照，不要再当缺口）

**web**：登录 JWT；多会话列表；无会话单轮（可省略 sessionId）；历史回看且不当证据；提问输入；docTypes 契约可传 scope；拒答展示；闲聊不挂引用。

**admin**：面板进页+`dashboard.view`（壳）；分片只读点击拉全文；审批通过/驳回；成员邀请/移除；顶栏建库（`kb.create`，名称+首位库管）；模型供应商 CRUD 且 Key 不明文；用户 CRUD；部门壳；档位 allowedModes/defaultMode；rewrite 锁只读；三角色默认码表；不挂空壳系统设置；上传进审批的主路径存在。

**api**：options 白名单；ask 同步+SSE 且写 traces；会话仅创建/读取、省略 sessionId 合法、ask **不**隐式建会话；成员闸+检索再断言；mode∈allowedModes；混合路径 dense∥sparse→RRF→硬 rerank；rerank 失败不 answered；合法 draft 必 verify；claim_split 失败整答拒；闲聊不进 verify；分片 GET 无 PATCH body；reindex HTTP；反馈 POST+队列；模型目录；用户/角色/permission-catalog；部门树+grant 壳；Key GET 不明文。

**worker**：scan 状态机；infected 不得当 clean；未审批不得 scan；mock 杀毒按口径不记缺口；双就绪后 lifecycle 仍 draft。

**质量**：min 否决；批量 judge；路由禁词闸；L1 工程 CLI+2×2（人签不是缺口）。

---

## 5. 明确不算本盘 P2 缺口

- 仓库默认 mock ES / mock embed / mock scan、`AUTH_ENFORCE` 默认关
- B8 生产 ES+IK 集群、B9 真 RustFS 默认、QUAL-2 真杀毒
- rewrite 默认开 / L2 准出 / 连续追问卖点
- BlockNote 完整体验（P2.x）
- 文档 ACL 端点、部门强制默认开、敏感解禁（P3b）
- 数据面板可视化增强、质量/延迟双看板（P4）
- OCR（P5）
- 会话 PATCH/DELETE（P2 冻结仅创建读取）

---

## 6. 给下一张工单的可读切口（不裁定顺序）

盘点后能独立成执行块的方向（切法由「裁定第一批 P2 执行顺序」锁）：

1. **空库拒答语义**：**已收**（工单「空库拒答对齐 200」：200 + `kb_not_ready`；web 拒答卡）  
2. **建库闭环**：**已收**（工单「建库闭环」：`initialAdminUserId` + 令牌租户 + 顶栏入口）  
3. **文档运营余量**：**已排入第二批**（工单「文档运营余量最小闭环」，挡住策略三层最小闭环）  
4. **策略三层**：**已收**（工单「策略三层最小闭环」：表 + catalog/for-upload + 设置启用/recommended + 上传人选 + 参数快照）  
5. **评测底线**：gold-questions + eval 入队 + admin 薄页（CLI 已有，不算齐）  
6. **ask 审计与引用**：`GET /ask/:requestId`；web 引用点回  
7. **web 消费余量**：档位、无库空态、建议动作主按钮、配额文案、反馈类别  
8. **检索语义补钉**（仍属 P2，不是换生产默认）：`tenantId` filter、`buildAclFilter`、sparse reason、档位 retrieveK、Mongo 正文  

基础设施 B8/B9/QUAL-2 仍按分层 **不进** 上述 P2 语义批。
