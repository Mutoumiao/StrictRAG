# @strict-rag/contracts · 测试导航

> HOW：`.trellis/spec/guides/testing.md`  
> 本包主责：Zod 形状与错误码短名。HTTP 接线在 api/web/admin。  
> **存货不是覆盖。** 本表只登记本包 `src/` 与 `tests/` 下的 `*.test.ts(x)`；漏行即红。测全了没有看 `docs/testing/p0-redlines.md` 与 `docs/testing/coverage.md`（期望原文仍是验收剧本）。

## 能力

| 目录 | 能力 | 需求锚点 |
|------|------|----------|
| `ask/` | ask 请求/响应/options/scope、测试工厂 | `prds/05-api` · ADR-050 · P0 R10 |
| `ingest/` | 文档/分片/任务契约、分片策略枚举、入库报告 | `prds/04-pipelines` · B12 · 功能表 §5.2 |
| `kb/` | KB 设置形状 | B2 |
| `system/` | 部门、面板、模型网关、平台用户 | B3–B6 |
| `async/` | 入库 / 评测任务 DTO | `prds/06-async` |
| `eval/` | 黄金集 / eval run 形状、2×2 与 L2 工程公式 | `prds/05-api` §2.8 · `prds/08-quality` |

## 测例

| 文件 | 目标 | 需求锚点 | 被测 | 简介 | 状态 |
|------|------|----------|------|------|------|
| `ask/audit-contract.test.ts` | GET /ask/:requestId 审计 DTO 只含当时 snapshot 元数据与 graph_trace，禁止夹带正文。 | prds/05-api §2.9 · 功能表 §5.2 引用回溯 | `AskAuditResponseSchema · EvidenceSnapshotItemSchema` | 审计回溯形状；不是断线重拉 AskResponse。 | 现行 |
| `ask/contract.test.ts` | AskOptions 只接受白名单字段，拒绝 tauClaim 与嵌套 scope，scope 必须顶层。 | ADR-050 · prds/05-api §1.1 | `AskOptionsSchema · AskScopeSchema · AskRequestSchema · AskReasonSchema · CreateFeedbackBodySchema · InviteMemberBodySchema · UpdateMemberBodySchema` | Ask 请求 / options / scope 形状 SSOT；成员 PUT 只接受 role。 | 现行 |
| `ask/feedback-promote-gold.test.ts` | 晋升黄金集必须带题型；题面只来自当时 ask。 | ADR-019 · prds/05-api §2.6 · 功能表 §4.1 | `PatchFeedbackBodySchema · deriveGoldQuestionText · goldCaseKeyFromFeedbackId` | 运营回流契约；不是 gold.yaml。 | 现行 |
| `ask/final-contract.test.ts` | 断线重拉终态 DTO 二态可辨，ready=false 不得夹带 response 或审计字段。 | 功能表 §3 断线重拉终态 · prds/05-api §2.7 契约铁律 5 | `AskFinalResponseSchema · AskSseStatusSchema` | ready=true 才允许 response；ready=false 必带 message；running part 可带本轮 requestId。 | 现行 |
| `ask/fixtures.test.ts` | 共享 answered / abstained 工厂必须能通过 AskResponseSchema，禁止夹具与契约分叉。 | P0 R10 | `makeAnsweredFinal · makeAbstainedFinal · AskResponseSchema` | @strict-rag/contracts/testing 工厂与响应 schema 对齐。 | 现行 |
| `async/eval-job.test.ts` | 评测 job payload 必须带 tenant/kb/run，拒绝缺字段与非法 retrieveMode。 | prds/06-async eval.run | `EvalJobDataSchema · QUEUE_NAMES.EVAL · EVAL_JOB_NAME` | api 入队与 worker 消费同一形状；只跑 golden_2x2。 | 现行 |
| `async/ingest-job.test.ts` | 入库任务 DTO 必须覆盖全阶段，拒绝空 docId 与非法 stage。 | prds/06-async · 剧本 Q5 | `IngestJobDataSchema · INGEST_STAGES · INGEST_JOB_DEFAULT_ATTEMPTS` | 含逻辑 stage ocr / purge；物理队列仍 sr-ingest。 | 现行 |
| `eval/gold-contract.test.ts` | 黄金集与评测 run DTO 必须严格字段，拒绝 τ 与空补丁。 | prds/05-api §2.8 · 功能表 §4.1 / §5.2 | `GoldQuestionSchema · CreateGoldQuestionBodySchema · PatchGoldQuestionBodySchema · CreateEvalRunBodySchema · EvalRunSchema` | P2 评测底线 wire 形状；可带 Hit@k / tauStar / judgeAuroc；不是签字包。 | 现行 |
| `eval/l1-hit-at-k.test.ts` | 有 expectedDocIds 的 L1 题必须按 evidence 交集计 Hit@k，无名单不计分。 | 覆盖 C4 · prds/08-quality | `hitAtKCase · accumulateHitAtK · hitAtKRate · parseExpectedDocIds` | 不进 2×2 / signoffEligible；脏名单抛错。 | 现行 |
| `eval/l1-judge-auroc.test.ts` | Judge 校准必须按 (score, label) 算 AUROC，单类或无分数不得写成 1。 | 覆盖 C3 · prds/08-quality | `parseJudgeLabel · parseJudgeCalibration · auroc · judgeAurocFromScored` | 不用 gold type 冒充 supported；不进 2×2 / signoffEligible。 | 现行 |
| `eval/l1-tau-sweep.test.ts` | L1 必须能按 minSupport 离线扫 τ 网格得到 tau*，无分数不得因降 τ 变成 answered。 | 覆盖 C2 · prds/08-quality | `cRate · parseMinSupport · outcomeAtTau · sweepTau` | 不改本跑 2×2 / signoffEligible；不是写 TAU_CLAIM。 | 现行 |
| `eval/l2-matrix.test.ts` | L2 工程 signoffEligible 必须 live ∧ 九类齐 ∧ 零容忍=0 ∧ ≥15；mock 必 false。 | 功能表 §10.2 · prds/08-quality §6.2 | `computeL2SignoffEligible · historyLeaked · acceptHit · nextSessionId` | 工程公式 ≠ 准出 PASS。 | 现行 |
| `ingest/chunk-contract.test.ts` | 分片只读 DTO 列表不得含 body，详情必须含 body，查询 limit 有默认与上限。 | ADR-052 | `ChunkListQuerySchema · ChunkListItemSchema · ChunkDetailSchema · ChunkListResponseSchema` | 分片只读 DTO 形状。 | 现行 |
| `ingest/chunk-strategy.test.ts` | 分片策略默认码必须已实现，路线图码已知但未实现，未知码不得当已实现。 | B12 | `DEFAULT_CHUNK_STRATEGY · isImplementedChunkStrategy · CHUNK_STRATEGY_CODES` | 策略枚举与未实现边界。 | 现行 |
| `ingest/context-mode.test.ts` | L0 模板必须用标题（有路径才拼接）；非法 contextMode 不得当已实现 L1。 | 入库 PRD §4 · 功能表 §4.5 / §6 | `parseContextMode · l0ContextPrefix · resolveContextSource · invalidContextModeOverride` | 本轮无 Gateway；l1_llm 只表示回退 L0。 | 现行 |
| `ingest/chunk-strategy-catalog-contract.test.ts` | 分片策略三层 HTTP 契约必须带 for-upload query 与库启用 PATCH，缺字段或非法族应拒绝。 | 功能表 §4.5 · ADR-053 | `ForUploadQuerySchema · PatchKbChunkStrategiesBodySchema · docFamilyFromContentType` | 最小闭环 DTO；不含平台 CRUD 页。 | 现行 |
| `ingest/document-contract.test.ts` | 文档 / 知识库 DTO 与完成上传、补丁元数据必须接受合法部门可见级并拒非法值。 | 入库 HTTP | `CreateKbBodySchema · KnowledgeBaseListItemSchema · VisibilityLevelSchema · CompleteUploadBodySchema · WriteDocumentBodySchema · WriteDocumentResponseSchema · PatchDocumentMetaBodySchema · DocumentDetailSchema · DocumentListItemSchema · ReindexDocumentResponseSchema · SupersedeDocumentBodySchema · SupersedeDocumentResponseSchema · DeleteDocumentResponseSchema` | 文档 DTO 含列表 docType / aclPrincipals / 生效区间 / 替代边；complete / PATCH 可写名单三态；PATCH 可写本地时间串窗口；complete 可选 64 位 checksumSha256；write 须 title+markdown 且 sourceType=write；reindex stage 可 chunk 或 ocr；supersede 须 successorDocId；DELETE 响应 archived + purgeEnqueued。 | 现行 |
| `ingest/upload-media.test.ts` | 入库只接受矩阵内 MIME/扩展名，未知与 octet-stream 必须拒绝；文本族须可辨。 | ADR-039 · 功能表 §5.2 / §6 · prds/09-security §7 | `isAllowedIngestMedia · resolveIngestContentType · isTextIngestContentType` | 白名单 SSOT；不嗅魔数；文本族是「更严体积档」判据。 | 现行 |
| `ingest/ingest-report-contract.test.ts` | 入库报告 DTO 须含跨 doc skip、情境来源与去重率（0–1 或 null），仍拒绝 Hit@k / 未知字段。 | prds/05-api GET ingest-report · 功能表 §5.2 · 入库 PRD §4 / §5 | `IngestReportItemSchema` | 跨文档去重 + contextSource + dedupeCrossDocRate；不是 pending_review / 不是 L1 成功。 | 现行 |
| `kb/settings-contract.test.ts` | KB 设置 PATCH 仅白名单且拒阈值字段，GET 必须锁定 rewrite 关闭；成员档位口不得夹带 τ。 | B2 · 功能表 §3 问答档位 · ADR-050 · ADR-054 | `PatchKbSettingsBodySchema · KbSettingsSchema · AskModesSchema · KbDocTypesSchema · KbDocTypeCatalogSchema` | KB 设置形状与 sessionRewrite 锁定；ask-modes 仅 allowedModes/defaultMode；doc-types 仅 items；类型分区 catalog 与 docTypes 互斥。 | 现行 |
| `kb/settings-audit-contract.test.ts` | 知识库设置修改日志 DTO 只含 id / kbId / actorUserId / createdAt / diff，拒绝密钥字段。 | 功能表 §4.2 | `KbSettingsAuditItemSchema` | 最小闭环形状；不是 admin_write 全路径落表。 | 现行 |
| `system/dashboard-contract.test.ts` | 面板 summary 必须含四项指标且拒未知字段；双轨 tracks 不得塞进 summary。 | B6 · 剧本 I4 | `DashboardSummarySchema / DashboardTracksSchema` | summary 冻结 ≤5；质量/延迟独立信封。 | 现行 |
| `system/departments-contract.test.ts` | 部门创建 / 补丁 / 用户部门绑定 DTO 必须严格字段且补丁非空。 | B5 | `CreateDepartmentBodySchema · PatchDepartmentBodySchema · PutUserDepartmentsBodySchema` | 部门 DTO 形状。 | 现行 |
| `system/dept-grants-contract.test.ts` | 跨部门 grant DTO 只接受合法可见级、uuid 与本地时间 expiresAt。 | DEPT_ACL | `CreateDeptCrossGrantBodySchema · ListDeptCrossGrantsQuerySchema` | grant DTO 形状。 | 现行 |
| `system/model-gateway-contract.test.ts` | 模型网关写入口可含 apiKey、读出口只有 hasApiKey，绑定 ref 可解析。 | B3 · ADR-055 · 工单「KB 消费绑定最小闭环」 | `CreateModelProviderBodySchema · ModelProviderSchema · parseModelRef · formatModelRef · requiredModelTypeForPurpose · PutPlatformBindingsBodySchema · PutKbConsumeBindingsBodySchema` | 网关绑定 DTO；KB PUT 拒 judge。 | 现行 |
| `system/platform-users-roles-contract.test.ts` | 平台用户角色 DTO 拒 password、角色码须 snake_case、补丁非空。 | B4 | `CreatePlatformUserBodySchema · PatchPlatformUserBodySchema · CreatePlatformRoleBodySchema · AssignUserRolesBodySchema · PutRolePermissionsBodySchema` | 平台用户角色 DTO。 | 现行 |

## 待处理

（无。`src/` 下已无 `*.test.ts(x)`。）
