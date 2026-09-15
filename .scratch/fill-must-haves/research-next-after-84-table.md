# Research: 反馈回流黄金集之后必须具备缺口（功能表权威面）

- **Query**：闭单到 84「反馈回流黄金集最小闭环」为止后，本图目的地（按 `prds/12-delivery-guides/14-模块需求功能表.md` 补完各运行时模块 **必须具备**）里，仍缺、且不依赖人签 / 真引擎选型 / 解锁已锁站规的产品语义缺口有哪些
- **Scope**：mixed（功能表 + `prds/00–11` 摘要 + 源码为真；`docs/module-status/` 仅作镜像参考；`docs/testing/coverage/` 作交叉证据）
- **Date**：2026-09-16

权威分层：`prds/00–11` = WHAT；`prds/12-delivery-guides/`（含功能表）= 派生阅读件，冲突跟 PRD；IS = 源码。已判定闭单序列 01–84（`map.md` Decisions so far 到底 84），前线 grilling = `issues/85-after-feedback-promote-gold-order.md`（claimed）。上一轮同题研究 `research-next-after-78.md` 推荐的 4 项（跨文档去重 → 80、L0/contextMode → 82、反馈回流 → 84）均已落地，本报告不复用其结论。

---

## 0. 结论

**不应暂停，可动手真空未尽。** 上一轮研究列出的候选已被 80 / 82 / 84 全部吃掉；本轮把口径从「上一轮清单」换成「**功能表 + `prds/09-security` / `prds/05-api` / `prds/06-async` / `prds/01-architecture` + 验收剧本 P2 必签行**」重新对齐后，仍有一批从未被本图任何工单覆盖的必须具备行，且都指得到冻结条款、都在源码里可核到「未做」，也不等人签、不选真引擎、不解锁站规。

其中两条**从未在本图出现过**（不在 `map.md` 的已锁清单，也不在 Not yet specified 的雾清单里，只躺在 `.trellis/tasks/08-06-project-backlog/status.md` §2.5.2 的 QUAL-* 指针里，状态「未开始」），最该先补：

**推荐下一张执行工单题目（唯一一张）：**

> **提交者不可自审四眼最小闭环（剧本 V3 / QUAL-V3）**

理由：这是功能表 §4.3 的 P2 行原文，也是 `prds/09-security/01-auth-acl-compliance.md` 表内「禁自审默认（P2）」、`prds/05-api/01-http-api-hono.md` §approve（ADR-048）第 1 条「默认 **拒绝自审**」、ADR-048 #4 四眼原则的落地面；验收剧本 V3 明标 P2 必签且 `docs/testing/coverage/01-ingest.md` 判「**缺实现**」，`docs/testing/coverage/03-ops.md` 与 `prds/12-delivery-guides/04-交付控制台.md` #18 也各点一次「QUAL-V3 未做」。源码核到三层同缺：`approve` 路由不比对提交人（`apps/api/src/routes/documents/index.ts` 约 433–459 行）、`documents.uploaded_by` / `approved_by` 两列在 schema 里有（`packages/db/src/schema/kb/documents.ts` 38–39 行）但全仓无一处写入、admin 审批面无线框中已有的「提交人」列（`03-功能地图.md` §审批中心）。体积小、无外部依赖、在信任环主路径上，是本图最干净的下一张。

其后建议本图连续补 **孤儿清理最小闭环（剧本 L7 / QUAL-L7）**，见 §5。

---

## 1. 已锁、不要当缺口重开

| 项 | 口径 |
|----|------|
| 同 KB 跨文档去重 / 报告冲突对 | 工单 80 已落（`cross-doc-dedupe.test.ts` · `cross-doc-skip-index.test.ts`；报告 `crossDocDropped` + `conflictPairs` 已在 admin 行展开可见） |
| L0 模板真用快照 / `contextMode` 单控件 | 工单 82 已落（worker `parseContextMode` + `resolveContextSource`；admin 策略弹窗单控件标「召回增强关闭」） |
| 反馈回流黄金集 | 工单 84 已落（PATCH `promoted_to_gold` 须 `goldType` + `eval.run`，INSERT `gold_questions`） |
| KB 消费绑定三档 | 工单 78 已落（PUT 只收 generate/embed/rerank；judge 400） |
| 上传表单标部门 / 可见级 | 工单 76 已落（`toCreateDocAclFields` + complete 带字段） |
| 类型分区 CRUD | 工单 74 已落（settings catalog `{code,label,sort,enabled}`） |
| 上传 MIME 白名单 + checksum | 工单 72 已落（complete/upload-url/PUT 拒未知 MIME 与 octet-stream） |
| 文档类型成员面 | 工单 70 已落（`GET /doc-types` + `no_docs_in_scope` + web ClosedSelect；B11 类型引导 UI 亦已接） |
| 删除与 purge | 工单 68 已落（DELETE → archived → 入队 purge；`apps/worker/src/ingest/purge.ts`） |
| 替代联动 / 生效区间 / 在线编写 Markdown | 工单 66 / 64 / 62 已落 |
| P5 OCR 开闸与历史 `needs_ocr` 重跑 | 工单 57 / 59 已落（默认关；注入抽取器） |
| P4 双轨看板 / τ 扫描 / Judge AUROC / Hit@k / generate fallback | 工单 55 / 49 / 51 / 47 / 53 已落 |
| P3b 可动手最小闭环（ES 部门 / principals 对称、敏感解禁、`aclPrincipals` 全文） | 工单 39 / 41 / 43 / 45 已落；**仓库默认开** `DEPT_ACL_ENFORCE`、角色 principal 仍锁 |
| P5 暂停解除的前提（在线编写最小闭环） | 工单 62 已落 |
| 剧本 AB8 / AC7 / E4 / E5 | 已分别由 78（KB 禁绑 judge）/ 06+82（053 弹窗）/ 80 / 82 落地；`status.md` §2.5.2 对 AC7/AB8/E4/E5 的「未开始」是**滞后**，以源码为准 |
| `GET /me/permissions` / 成员 PUT role / 末位超管 / 超管引导 / 写路径锁超管全码 | 工单 19 / 20 / 29 / 31 已落 |
| 创建库 / 库选择器 / admin 顶栏 KB 选择器 | 工单 04 / 24 / 26 已落 |
| 入库报告最小闭环 / 失败 Webhook / 三平面配额 / 修改日志 | 工单 22 / 37 / 35 / 33 已落 |
| 评测底线（gold-questions CRUD + `eval/runs` 入队 + admin `/eval`） | 工单 12 已落 |

---

## 2. 功能表入场行对照

### 2.1 已齐（不要再开）

- **web §3**：登录 JWT、只列成员库、无库空态阻断、多会话壳、显式建会话、无会话单轮、历史回看不当证据、提问输入、档位（读 `ask-modes`）、类型 scope（B11）、SSE 默认、拒答卡按 reason、建议动作主按钮、429 配额文案、反馈四类、引用点回当时快照、`coref_unresolved` 卡
- **admin §4.1/§4.2/§4.3**：面板薄页（`dashboard.view` 闸 + B6 摘要 + I4 双轨）、文档双轴运营标签、分片只读点拉、审批通过/驳回、成员、设置（基本信息 / 类型分区 / 档位 / KB 消费三档 / 改写锁只读 / 修改日志可查）、反馈队列+纳入黄金集、评测页、模型供应商 Key 不明文、用户 CRUD、部门组织树 + 用户归属（**含主部门 `isPrimary` / 兼任多部门 / 负责人 `isLeader`**：`PUT /admin/users/:id/departments` + `apps/admin/.../departments-workspace.tsx`）、自定角色 CRUD + 超管锁全码、末位超管提示
- **api §5**：`/me/permissions`、白名单 options、ask 同步+SSE、`kb_not_ready` 200、三平面配额、成员闸+检索再断言、混合检索 dense∥sparse→RRF→硬 rerank（`sparse_unavailable` / `rerank_unavailable`）、档位预算（fast 60/10）、Mongo 批取正文、`GET /ask/:requestId`、`scope.docTypes`、`GET /doc-types`、生效区间、supersede、DELETE+purge、ES 查询期 `tenantId`+`kbId` `buildAclFilter`、部门 / principals terms（默认关）、上传体积+MIME+checksum、`approval.decide` 码闸、`ACL_DOC_IDS_MAX` 常量
- **worker §6**：scan→parse→(ocr)→chunk→embed→es_index 状态机、双就绪才 ready、manifest 冻结、重试不分块、L0 服从快照、跨 doc `skip_index`、purge、OCR 开闸+历史重跑、失败 Webhook、`eval.run`（L1/L2）
- **§10 质量**：min 否决、批量 judge、claim_split 失败整答拒、非法 citation 剥离后拒、闲聊不进 verify、路由禁词闸、L1 账本 + 2×2 + Hit@k + τ 扫描 + Judge AUROC + `signoffEligible`

### 2.2 仍缺或半接线、且可动手

| # | 缺口 | 入场分层 | 判定 | 权威出处（文件名 + 章节） |
|---|------|----------|------|---------------------------|
| 1 | **提交者不可自审**：`approve` 不比提交人、`uploaded_by`/`approved_by` 从不写入、admin 审批面无「提交人」 | **P2** | **缺（三层同缺）**；剧本 V3 标「缺实现」 | 功能表 §4.3「审批通过 / 驳回」行 · §4.4 三角色；`prds/09-security/01-auth-acl-compliance.md`（「**禁自审默认**：提交者默认不可批自己的单（P2）」）；`prds/05-api/01-http-api-hono.md` §approve（ADR-048）第 1 条「默认 **拒绝自审**」；`prds/11-decisions/00-adr-index.md` ADR-048 #4（四眼；`allowSelfApprove` 默认关）；`prds/10-delivery/03-acceptance-scenarios.md` 剧本 V3；`packages/db/src/schema/kb/documents.ts` 38–39 行（列在、无写入方）；`docs/testing/coverage/01-ingest.md` V3=缺实现；`docs/testing/coverage/03-ops.md` 剧本 V 行；`prds/12-delivery-guides/04-交付控制台.md` #18；`prds/12-delivery-guides/02-产品说明.md` 旅程 2 与 §10.4 设计禁忌 |
| 2 | **孤儿清理 job**（`ingest.maintenance`：半套非激活 `indexVersion` 双侧清理 + 「激活版永不删」护栏） | **P1–P2** | **缺**；当前只对账报数（`reconcileOrphan`），无清理入口 | 功能表 §6 `ingest.maintenance` 行 · §13 P1 行「孤儿护栏」；`prds/06-async/01-bullmq-jobs.md` §5「孤儿清理（`ingest.maintenance` · ADR-038）」；`prds/01-architecture/03-storage-boundaries.md` §2.4「孤儿清理（ADR-038 · **必须**）」；`prds/04-pipelines/01-offline-ingest.md` §3.4 / §6；ADR-038「孤儿清理护栏」；剧本 L7；`docs/testing/coverage/01-ingest.md` L7=缺实现；`apps/worker/src/ingest/purge.ts`（仅按文档 purge，非按 version 清孤儿） |
| 3 | **跨文档去重率指标 / 「高度重复」运营提示**（`dedupe_cross_doc_rate`） | P1–P2 | 半接线：计数已出，**率与阈值提示缺** | `prds/04-pipelines/01-offline-ingest.md` §5.2「指标（入库报告必出）：`dedupe_doc_internal_dropped` / `dedupe_cross_doc_dropped` / `dedupe_cross_doc_rate` / `contextualize_l1_ok` / `contextualize_l0_fallback`」；功能表 §6 去重末段「剩余 searchable chunk 占比低于阈值 → 标『高度重复』并提示运营人工确认」；剧本 E4；`packages/contracts/src/ingest/ingest-report.contract.ts`（只有 `internalDropped` / `crossDocDropped`） |
| 4 | **分片策略 PATCH 的服务端修改日志**（谁 / 何时 / 旧→新 / kbId） | **P2** | 缺：`PATCH …/chunk-strategies` 不写审计（settings PATCH 已写，策略 PATCH 漏） | 功能表 §4.2 末段「保存须写服务端修改日志，且运营**可查**…设置变更**无审批**」· §4.5；`prds/00-product/05-frontend-ia.md` §2.2「审计：可写保存 → 服务端修改日志」；剧本 AA1「200；有 **审计日志**；旧文档 chunk 边界/version 不变」；`apps/api/src/routes/chunk-strategies.ts` PATCH（`applyKbChunkStrategyPatch` 内无审计）；对照 `apps/api/src/routes/kb-settings.ts` + `services/kb-settings-audit.ts` 已有 `settings-audit` |
| 5 | **角色与权限「树状勾选」** | **P2** | 半接线：页头已写「树状授码」，实现是 `catalog.map` 扁平勾选 | 功能表 §4.1「角色与权限｜树状勾选菜单/操作码；超管锁全码」· §4.4；`prds/00-product/05-frontend-ia.md` §2.4「**编辑 = 树**（L1/L2 菜单 + 操作）勾选 code」；`prds/09-security/01-auth-acl-compliance.md` 表「角色树 UI｜P2 必达」；`packages/admin-catalog/src/menu-tree.ts` 已有 `MENU_TREE` 可直接用；`apps/admin/src/app/(ops)/roles/_components/roles-workspace.tsx` 扁平勾选 |
| 6 | **文档绑定策略参数快照只读审计** | **P2** | 缺（DB 列有、HTTP/UI 无） | 功能表 §4.5「文档绑定｜本 `indexVersion` 一套 `chunkStrategy` + 参数快照（写入 job/meta，**只读审计**）」；`packages/db/src/schema/kb/documents.ts` 44 行 `chunkStrategyParams`；`packages/contracts` 无对应字段、admin 文档详情不展示 |
| 7 | **质量只读「签字包链」** | **P2** | 半接线：只有 `gatePackageId` + `effectiveAt`，无链 | 功能表 §4.2「质量｜**只读**｜`tauClaim` + 签字包 **id/链**」；`prds/00-product/01-vision-and-success.md` 门禁治理表「配置↔签字包绑定」「加严包四要素」；ADR-046；`packages/contracts/src/kb/kb-settings.contract.ts` `QualitySnapshotSchema` |
| 8 | **断线按 `requestId` 重拉终态** | **P2** | 缺（工单 10 划出，地图 Notes 亦标「仍后批」，需显式重开） | 功能表 §3「流式回答｜默认 SSE…**断线可按 `requestId` 重拉终态**｜P2」；`apps/web/src/api/ask.ts` 注释明写「非断线重拉」；`apps/api/src/routes/ask.ts` GET 回审计形不是终态 `AskResponse` |
| 9 | **citation chunk 级去重**（重叠段被多 chunk 命中不重复计引用） | **P2** | 缺：`validIds` 未去重，重复 `chunkId` 会出多条引用 | 功能表 §10.1「citation 清洗｜非法 id 剥离…同一原文句不重复计为多个引用（**chunk 级去重**）」；`apps/api/src/graph/run.ts` 约 396–418 行 `parsed.citations.filter(...)` 后直接 `map` |
| 10 | **指标骨架 `fallback` / `node_used` 维** | **P2**（可 P4 补直方图） | 半接线：Gateway `meta.fallbackUsed` 已有，metrics 无该维 | 功能表 §10.3「指标骨架｜`ask_*` / `llm_call_*` / `rerank_*`（**含 fallback 与 node_used**）」；`apps/api/src/services/gateway/types.ts` `meta.fallbackUsed`；`apps/api/src/obs/metrics.ts` 无 `fallback` / `node` 标签 |
| 11 | **入库报告可抽样对比 L0 vs L1 的 Hit@k** | P1–P2 | 半接线（口径弱）：报告已有 `contextSource`，无 L0/L1 Hit@k 对照 | 功能表 §5.2「入库报告｜…**可抽样对照 L0 vs L1 的 Hit@k**」· §10.2「入库报告可抽样对比 L0 vs L1 的 Hit@k」；`IngestReportItemSchema` 无相关字段 |

### 2.3 看起来像缺口、本回合不当执行工单

| 项 | 为何不进 |
|----|----------|
| 剧本 B1-A4 `allowedDocIds` > `ACL_DOC_IDS_MAX` → `acl_filter_too_large` | 工单 19 明确不做 `allowedDocIds`（ADR-009 已关成员大列表）；PRD 主路径已免全库 docId terms |
| 剧本 R4 / R6 / R10（`maxEmbedCalls` 启动 warning / ingest embed TPM 触顶 / staging 缺平面配额 fail-closed） | 工单 35 明确划出「embed TPM / maxEmbedCalls / staging fail-closed」；且 `prds/README.md` 0.4.18 / ADR-044 记「P2 **无** `maxEmbedCalls`」；R10 属部署闸而非应用功能。**注意**：剧本 R 标 R4/R6/R10 为 P2 必签，与 35 的切边有张力，留 §5 供裁定 |
| 剧本 P2（local/dev 同模 judge≡judge_aux → 仅 warning） | 剧本 P 通过口径写明「P1、P3、P4、P6 试点/代码门禁必签；**P2**/P5/P7–P11 在启用 online_sample 或 staging 配置演练时签」。现实现一律拒同模（更严），不是必须具备交付项 |
| 剧本 K5 / I5（非成员 `platform_admin` 读 Langfuse → 无 evidence 明文） | 审计通道部分已由工单 10 按 KB 成员闸落地（`GET /ask/:requestId`）；剩余 Langfuse 侧信道需 SDK 接入（观测基建，非产品语义缺口），工单 10 已划出「Langfuse SDK（另列技术债）」 |
| 剧本 O4（无 `tenantId` 的 ES query/bulk builder 必须失败） | **行为已具备**：`apps/api/src/services/retrieve/es-sparse.ts` `buildAclFilter` 查询期强制 `tenantId`+`kbId`，mapping/bulk 同字段（工单 09）；剩「静态门禁/断言」属测试债，不是产品能力缺口 |
| `QUAL-G3` 写 / 审 `gold.yaml` 审核闸 | 工单 84 明确不做「写 / 审 `gold.yaml`（QUAL-G3）」；`map.md` Not yet specified 亦标「仍后批」。且 `gold.yaml` 是评测工程种子，不是运行时语义 |
| 剧本 E4 的 `pending_review` 人工二选一 | 工单 80 切边「无 `pending_review` / 无生产 LSH」；默认动作是 `skip_index`，属可选动作 |
| 数据面板标「召回增强关闭」 | 工单 82 已在分片策略弹窗打该文案；功能表 §4.1 该行入场写「P2 权限必达，**可视化增强 P4**」，面板侧标注归 P4 |
| MD/TXT 更严体积档 / 魔数嗅探 | PRD 写「**可**更严 / 可选分档」；`prds/00–11` 无魔数条款，ADR-039 权威是 size + MIME/扩展名 + checksum（72 已落） |
| 上传面（创建时）带 `aclPrincipals` | 工单 76 切边；且 admin 文档详情 PATCH 已能编辑名单与 `[]`（`documents-workspace.tsx`），P3b 的 `GET/PUT …/documents/:id/acl` 端点仍属 P3b |
| `pending_review` / 真 L1 `contextualize` / BlockNote / `editor-draft` / 通用 `paramSchema` 表单引擎 / fallbacks 多行 / 平台策略 CRUD 页 | 均为已关工单的明确切边或 `map.md` Not yet specified 的后批项；除 BlockNote 外都依赖「换真模型/换真引擎」或运营扩展，不进本回合 |
| LangGraph.js 官方图重构 | `map.md` Not yet specified：技术栈硬性标准，源码现为线性状态机，**另起路线** |
| 数据面板增强 / Grafana 时序 / `tau_sweep`·`verifier_calib` 独立入队 / live judge | P4 雾；`map.md` 已锁「P4 可动手代码真空已尽」 |
| 真 ES+IK（B8）/ 真 RustFS·Mongo（B9）/ 真杀毒 QUAL-2（剧本 M7） | 基础设施缺口，按 `map.md` Notes 不挡更早阶段语义，不进本回合 |
| 用户页主部门 / 兼任 / 负责人 | **已具备**：`PUT /api/v1/admin/users/:id/departments` 收 `isPrimary`/`isLeader`/多部门，admin 部门页可填可读（IA §2.4 该行已满足），只是不在「用户」页画 |

---

## 3. 可动手候选（按「卡住产品路径」排序）

### 3.1 【推荐下一张】提交者不可自审四眼最小闭环（剧本 V3 / QUAL-V3）

- **功能表定位**：§4.3「审批通过 / 驳回｜提交者默认不可自审；驳回后仍禁止跑流水线」**P2**；§4.4 三角色默认（普通文档人员**默认不能**自审）；§4.1 审批中心
- **PRD 条款**：`prds/09-security/01-auth-acl-compliance.md`「禁自审默认｜提交者默认不可批自己的单（P2）」；`prds/05-api/01-http-api-hono.md` §approve（ADR-048）「鉴权 KB admin；校验 ticket pending；**默认拒绝自审**」；ADR-048 #4「**禁止**提交人审批**自己的** ticket（四眼；单 admin 租户可配置 `allowSelfApprove` 显式打开并审计，默认 **关**）」；`prds/03-data/01-postgresql-schema.md` 审批表「`decided_by` / `decided_at`；**默认 ≠ submitted_by**」；`prds/00-product/02-scope-and-non-goals.md`「普通文档人员默认自审通过入库｜禁止」；`prds/10-delivery/03-acceptance-scenarios.md` 剧本 V3
- **源码证据**
  - `apps/api/src/routes/documents/index.ts` 约 433–459 行：`POST /documents/:docId/approve` 只判 `approvalStatus`，**不比对提交人**
  - `packages/db/src/schema/kb/documents.ts` 38–39 行：`uploaded_by` / `approved_by` 列在，全仓 grep 无写入方（`services/documents.ts` `approve()` 只写 `approvalStatus` + `approvedAt`）
  - `apps/admin/src/app/(ops)/approvals/_components/approvals-workspace.tsx`：无「提交人」列（`03-功能地图.md` §审批中心线框有该列）
  - `docs/testing/coverage/01-ingest.md` V3 = 缺实现；`docs/testing/coverage/03-ops.md` 与 `04-交付控制台.md` #18 标 QUAL-V3
- **为何可动手**：不等人签、不选引擎、不解锁站规（不碰 `DEPT_ACL_ENFORCE`、不碰 rewrite、不碰 OCR）；actor 已有（`c.get('auth')` → `AuthPrincipal.userId`，`apps/api/src/middleware/request-id.ts` / `admin-write-audit.ts` 已在用）；`reject` 路径已保证「驳回后仍禁止跑流水线」（`canEnqueueScan` 只认 `approved`）
- **建议切边**
  - **做**：`complete`（upload 源）与 `write`（editor 源 / Markdown 提交）写 `uploaded_by`；`approve` 写 `approved_by` + `approved_at`；approve/reject 比对 `actor.userId === doc.uploadedBy` → **403 + 明确业务码**（默认禁自审）；无 actor（`AUTH_ENFORCE` 关 / 无令牌）时**不误伤**：不比对、不编造提交人（口径与现有 `requirePermissionWhenEnforced` 一致）；admin 审批面回显提交人（无提交人显「—」）；测例落 `apps/api/tests/ingest/` + admin `tests/ops/`
  - **不做**：`allowSelfApprove` 显式开关（ADR-048 允许但非必须，且属「放宽」方向）；独立审批工单表（现状 ponytail：无 ticket 表）；`approval.view` 之外的审计管理台；`approve` 自动入队 scan（V4 现状是两步）；不改 `prds/00–11`
- **体积**：小（contracts 可选字段 + complete/write 两处写入 + approve/reject 比对 + admin 一列 + 3–5 条测例）
- **排序理由**：唯一同时满足「P2 必签 + 冻结 PRD 明文 + 剧本明标缺实现 + 在信任环主路径 + 体积小 + 从未被本图任何工单覆盖」的行。它也是 P3b 之后「敏感语料入池」的合规前提之一（人签虽在图外，闸必须先在）

### 3.2 【推荐第二张】孤儿清理最小闭环（剧本 L7 / QUAL-L7）

- **功能表定位**：§6 `ingest.maintenance`「删除、对账、reindex、**半套孤儿清理**、ES 租户迁移｜**孤儿不得 silently 变可检索**」**P1–P2**；§13 P1 行「孤儿护栏」
- **PRD 条款**：`prds/06-async/01-bullmq-jobs.md` §5「孤儿清理（`ingest.maintenance` · ADR-038）」：触发=周期（建议每日）+ 文档 `failed`；对象=单边有向量或 ES 文档且 `status != ready` 且非活跃重试窗口；护栏=**删前断言 `indexVersion != documents.当前激活 index_version`；激活版永不清理**；动作=PG embeddings + ES 双侧；指标 `orphan_cleaned_count` + 误拦 warning。`prds/01-architecture/03-storage-boundaries.md` §2.4「孤儿清理（ADR-038 · **必须**）」同口径。`prds/04-pipelines/01-offline-ingest.md` §3.4/§6「`failed` 可触发孤儿清理候选；清理不碰当前激活 version」
- **源码证据**
  - 只有对账报数：`apps/worker/src/ingest/es-http.ts` `reconcileIndexed` / `es-store.ts` `reconcile` 回 `{missing, orphan}`；`ingest-report.ts` 落 `reconcileOrphan` 计数；无任何清理入口
  - `apps/worker/src/ingest/purge.ts` 是**按文档** purge（archive 流程），不是按 `(docId, indexVersion)` 清非激活半套
  - `apps/worker/src` 无 maintenance / orphan 模块（目录仅 ingest / eval / scripts）；`docs/testing/coverage/01-ingest.md` L7 = 缺实现
- **为何可动手**：mock ES 是进程内 `es-store`（按 `docId + indexVersion` 键），PG 有 chunks/embeddings 行；worker 已有 reindex 与 purge 的 job 形态可复用；工单 59 也把「旧 version 无脏残留」列为依赖
- **建议切边**
  - **做**：`ingest.maintenance` 逻辑 stage（或同队列新 `type`）清孤儿；**护栏**先查 `index_version != 当前激活`，激活版**永不**清；双侧（PG 该 version 的 chunks/embeddings 行 + mock ES 该 version 文档）；触发入口至少覆盖「文档转 `failed` 时」与「显式可触发」（周期调度可先留常量/不入调度器）；误拦记 warning；报告/日志出 `orphan_cleaned_count`
  - **不做**：真 ES `_delete_by_query` / 生产 Router 迁移（B8）；ES 租户索引迁移（ADR-041）整段；PG 硬删文档行；调度器 cron 基础设施
- **体积**：中（worker 新 job + 双侧清理适配 + 护栏负向测例 + index 登记）
- **排序理由**：三份 PRD（功能表 / 异步 / 存储边界）都把它写成「必须」，剧本 L7 标缺实现且 84 之后仍无人认领；不修则长期运营内存/存储堆积且对账告警永久噪音；但它不挡单篇「上传 → 问答」主路径，故排第二

### 3.3 其余可动手候选（本批不建议一起做）

| 序 | 候选 | 功能表定位 | 为何可动手 | 建议切边（做 / 不做） | 体积 |
|----|------|-----------|-----------|----------------------|------|
| 3 | 入库报告重复率 + 「高度重复」提示 | §6 去重末段 · §5.2 入库报告 | 内部/跨 doc 计数已出，只差率与阈值提示 | 做：`crossDocRate`（跨 doc dropped / 总 searchable）进报告契约 + admin 行展示 + 低于阈值提示文案；不做：`pending_review` / `downrank` / 阈值进 env 调优 | 小 |
| 4 | 分片策略 PATCH 审计 + 「旧文档 version 不变」 | §4.2 末段 · §4.5 · 剧本 AA1 | 审计表与查询面已有（33），只差策略 PATCH 接进去 | 做：策略 PATCH 写 `kb_settings_audits`（旧→新 items 摘要）；补「PATCH 后旧文档 `index_version` 不变」断言；不做：通用 paramSchema 表单引擎 | 小 |
| 5 | 角色树状勾选 | §4.1 · §4.4 · IA §2.4 | `MENU_TREE` 已有，纯前端分组改造 | 做：按菜单树分组渲染勾选（超管锁全码保持 31）；不做：改鉴权语义 / 改码表 | 小 |
| 6 | 文档绑定策略参数快照只读审计 | §4.5 文档绑定行 | DB 列已有，缺 HTTP 字段与展示 | 做：详情契约加只读快照 + admin 只读展示码与 JSON；不做：参数可编辑回写（改切块必须 reindex） | 小 |
| 7 | 断线按 `requestId` 重拉终态 | §3 流式回答 | 终态应答对象已存在（同 ask），差「按 id 取终态」与 web 重挂 | 做：终态 `AskResponse` 重拉接口 + web 断线重挂；**禁止**用 audit 快照冒充 answered；不做：审计管理台 | 中 |
| 8 | quality 签字包链 | §4.2 质量行 | 只读展示，数据来自 `eval_runs` 绑定 | 做：`QualitySnapshot` 加链（基线 / 加严包 id 序列）；不做：写 τ / 人签 / 再认证 | 小 |
| 9 | citation chunk 级去重 | §10.1 citation 清洗 | 一处 `Set` 去重 | 做：`validIds` 按 `chunkId` 去重后再映射；不做：句级 `[chunkId]` 生成改造（另属 08 划出面） | 小 |
| 10 | 指标 `fallback` / `node_used` 维 | §10.3 指标骨架 | `meta.fallbackUsed` 已在，只需打点透传 | 做：`llm_call_*` / `ask_*` 加 `fallback` / `node` 标签；不做：完整直方图（P4） | 小 |

---

## 4. 仍留雾（依赖人签 / 选型 / 解锁站规）

- **人签**：L2 归档准出 / 准出 PASS / 对外宣传连续追问；P3a Full 图（CRAG + multi_hop，硬门是 L2 准出）；P4 L1 门禁包人签与再认证 / 数据面板增强 / 独立 `tau_sweep`·`verifier_calib` 入队 / τ* 接运行时 / live judge / Grafana 时序
- **站规解锁**：仓库默认开 `DEPT_ACL_ENFORCE`、加角色 principal
- **真引擎选型**：P5 真 OCR / Cloud OCR / 容量 / 熔断生产调优 / 在线抽样常态化 / CoVe / 超长异步 / 启动自动全库 `needs_ocr` 重跑；真 L1 `contextualize`（Gateway 费用路径，含 P1 真跑）
- **基础设施**：B8 真 ES+IK（含 IK 词典 / 同义词 / 字段权重调优）、B9 真 RustFS·Mongo 生产、QUAL-2 真杀毒（剧本 M7 的 5xx 重试矩阵）
- **另起路线**：LangGraph.js 官方图重构（`apps/api/src/graph/run.ts` 仍线性状态机）
- **P2.x 余量**：BlockNote / `editor-draft` / web 用户编辑器完整形态
- **观测基建**：Langfuse SDK 真接入（含剧本 K5/I5 的 Langfuse 侧信道纪律）

---

## 5. 给 85 的裁定建议

1. **不选** 85 题面的五个候选（BlockNote 余量 / P5 真引擎 / 解锁 P3b 站规 / 暂停 / P4 人签雾）：它们要么依赖人签或选型，要么是地图已锁的雾。
2. **本批做 2 张，连续、不回补已关工单**：
   - **第一张（先做）**：`提交者不可自审四眼最小闭环（V3 / QUAL-V3）`，切边见 §3.1。
   - **第二张（紧后）**：`孤儿清理最小闭环（L7 / QUAL-L7）`，切边见 §3.2。
3. 两张都不新建 Trellis 实现 task（`status.md` 只补指针勾选），都落 `.scratch/fill-must-haves/issues/` 并在收工跑 `update-module-status`。
4. **不要**把 §3.3 的十项并进这两张；它们更适合下一轮 grilling 按 2–3 张一批处理，优先序按 §3.3 表序（3 → 4 → 5 → 6）。
5. 需要 85 顺带锁一条**张力**：剧本 R 把 R4/R6/R10 标为 P2 必签，而工单 35 已把「`maxEmbedCalls` / embed TPM / staging fail-closed」划出。建议明确写「维持 35 切边，R4/R6/R10 归部署与计量基建，不在本图重开」，避免以后每轮都被当成新缺口。
6. **不要**在本图重开：默认开 `DEPT_ACL_ENFORCE`、角色 principal、默认开 OCR、默认开 rewrite、真引擎、人签、`pending_review`、`gold.yaml` 审核闸、LangGraph 重构。
7. **暂停**只有在本报告 §3 的候选也耗尽时才合理；当前不是。

---

## Caveats / Not Found

- `docs/testing/coverage.md` 与各分册的汇总表登记日 **2026-08-24**，对 E4 / E5 / AB8 / AC7 的「缺实现」**已滞后**（分别由工单 80 / 82 / 06+82 / 78 落地）。本报告以源码为准，并在 §1 点名这四处滞后。
- `.trellis/tasks/08-06-project-backlog/status.md` §2.5.2 对 QUAL-AC7 / QUAL-AB8 / QUAL-E4 / QUAL-E5 同样滞后（写「未开始」）；对 QUAL-V3 / QUAL-L7 / QUAL-K5 / QUAL-AA1 / QUAL-ACL-CAP / QUAL-TENANT-Q / QUAL-PLANE / QUAL-G3 的「未开始」与源码一致，已核实。
- 未找到 `prds/00–11` 里把「审批提交人 / 审批人」列名写进接口契约的章节（只有 `prds/03-data/01-postgresql-schema.md` 的审批表字段与 ADR-048 的口径）；工单 3.1 若落地，字段命名须按 ADR-048 的 `submitted_by` / `decided_by` 口径对照现有 `documents.uploaded_by` / `approved_by` 列择一并写进 `.trellis/spec/`，**不改** `prds/00–11`。
- §2.2 第 11 项（入库报告 L0 vs L1 Hit@k）只找到功能表 §5.2/§10.2 的表述，未在 `prds/04-pipelines/01-offline-ingest.md` 找到对应必须条款，故判定为「口径弱」半接线，不推荐做执行工单。
- 未核查 web/admin 全部原生 `<select>` 残留（站规余量），按 `map.md` Notes 属 UI 余量，不是功能表语义缺口。
- 本报告只新建本文件；未改任何产品代码、测例、`prds/`、`docs/`、`map.md`、`issues/*.md`，未执行任何 `git` 写操作。
