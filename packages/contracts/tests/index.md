# @strict-rag/contracts · 测试导航

> HOW：`.trellis/spec/guides/testing.md`  
> 本包主责：Zod 形状与错误码短名。HTTP 接线在 api/web/admin。  
> **存货不是覆盖。** 本表只登记本包 `src/` 与 `tests/` 下的 `*.test.ts(x)`；漏行即红。测全了没有看 `docs/testing/p0-redlines.md` 与 `docs/testing/coverage.md`（期望原文仍是验收剧本）。

## 能力

| 目录 | 能力 | 需求锚点 |
|------|------|----------|
| `ask/` | ask 请求/响应/options/scope、测试工厂 | `prds/05-api` · ADR-050 · P0 R10 |
| `ingest/` | 文档/分片/任务契约、分片策略枚举 | `prds/04-pipelines` · B12 |
| `kb/` | KB 设置形状 | B2 |
| `system/` | 部门、面板、模型网关、平台用户 | B3–B6 |
| `async/` | 入库任务 DTO | `prds/06-async` |

## 测例

| 文件 | 目标 | 需求锚点 | 被测 | 简介 | 状态 |
|------|------|----------|------|------|------|
| `ask/audit-contract.test.ts` | GET /ask/:requestId 审计 DTO 只含当时 snapshot 元数据与 graph_trace，禁止夹带正文。 | prds/05-api §2.9 · 功能表 §5.2 引用回溯 | `AskAuditResponseSchema · EvidenceSnapshotItemSchema` | 审计回溯形状；不是断线重拉 AskResponse。 | 现行 |
| `ask/contract.test.ts` | AskOptions 只接受白名单字段，拒绝 tauClaim 与嵌套 scope，scope 必须顶层。 | ADR-050 · prds/05-api §1.1 | `AskOptionsSchema · AskScopeSchema · AskRequestSchema · AskReasonSchema · CreateFeedbackBodySchema · InviteMemberBodySchema` | Ask 请求 / options / scope 形状 SSOT。 | 现行 |
| `ask/fixtures.test.ts` | 共享 answered / abstained 工厂必须能通过 AskResponseSchema，禁止夹具与契约分叉。 | P0 R10 | `makeAnsweredFinal · makeAbstainedFinal · AskResponseSchema` | @strict-rag/contracts/testing 工厂与响应 schema 对齐。 | 现行 |
| `async/ingest-job.test.ts` | 入库任务 DTO 必须覆盖全阶段，拒绝空 docId 与非法 stage。 | prds/06-async | `IngestJobDataSchema · INGEST_STAGES · INGEST_JOB_DEFAULT_ATTEMPTS` | 入库任务载荷形状与阶段枚举的单一来源。 | 现行 |
| `ingest/chunk-contract.test.ts` | 分片只读 DTO 列表不得含 body，详情必须含 body，查询 limit 有默认与上限。 | ADR-052 | `ChunkListQuerySchema · ChunkListItemSchema · ChunkDetailSchema · ChunkListResponseSchema` | 分片只读 DTO 形状。 | 现行 |
| `ingest/chunk-strategy.test.ts` | 分片策略默认码必须已实现，路线图码已知但未实现，未知码不得当已实现。 | B12 | `DEFAULT_CHUNK_STRATEGY · isImplementedChunkStrategy · CHUNK_STRATEGY_CODES` | 策略枚举与未实现边界。 | 现行 |
| `ingest/chunk-strategy-catalog-contract.test.ts` | 分片策略三层 HTTP 契约必须带 for-upload query 与库启用 PATCH，缺字段或非法族应拒绝。 | 功能表 §4.5 · ADR-053 | `ForUploadQuerySchema · PatchKbChunkStrategiesBodySchema · docFamilyFromContentType` | 最小闭环 DTO；不含平台 CRUD 页。 | 现行 |
| `ingest/document-contract.test.ts` | 文档 / 知识库 DTO 与完成上传、补丁元数据必须接受合法部门可见级并拒非法值。 | 入库 HTTP | `CreateKbBodySchema · KnowledgeBaseListItemSchema · VisibilityLevelSchema · CompleteUploadBodySchema · PatchDocumentMetaBodySchema · DocumentDetailSchema · DocumentListItemSchema` | 文档 DTO 含列表 docType；PATCH 可写类型。 | 现行 |
| `kb/settings-contract.test.ts` | KB 设置 PATCH 仅白名单且拒阈值字段，GET 必须锁定 rewrite 关闭；成员档位口不得夹带 τ。 | B2 · 功能表 §3 问答档位 | `PatchKbSettingsBodySchema · KbSettingsSchema · AskModesSchema` | KB 设置形状与 sessionRewrite 锁定；ask-modes 仅 allowedModes/defaultMode。 | 现行 |
| `system/dashboard-contract.test.ts` | 面板 summary 必须含四项指标，拒绝未知字段。 | B6 | `DashboardSummarySchema` | 面板 summary 形状。 | 现行 |
| `system/departments-contract.test.ts` | 部门创建 / 补丁 / 用户部门绑定 DTO 必须严格字段且补丁非空。 | B5 | `CreateDepartmentBodySchema · PatchDepartmentBodySchema · PutUserDepartmentsBodySchema` | 部门 DTO 形状。 | 现行 |
| `system/dept-grants-contract.test.ts` | 跨部门 grant DTO 只接受合法可见级、uuid 与本地时间 expiresAt。 | DEPT_ACL | `CreateDeptCrossGrantBodySchema · ListDeptCrossGrantsQuerySchema` | grant DTO 形状。 | 现行 |
| `system/model-gateway-contract.test.ts` | 模型网关写入口可含 apiKey、读出口只有 hasApiKey，绑定 ref 可解析。 | B3 | `CreateModelProviderBodySchema · ModelProviderSchema · parseModelRef · formatModelRef · requiredModelTypeForPurpose · PutPlatformBindingsBodySchema` | 网关绑定 DTO。 | 现行 |
| `system/platform-users-roles-contract.test.ts` | 平台用户角色 DTO 拒 password、角色码须 snake_case、补丁非空。 | B4 | `CreatePlatformUserBodySchema · PatchPlatformUserBodySchema · CreatePlatformRoleBodySchema · AssignUserRolesBodySchema · PutRolePermissionsBodySchema` | 平台用户角色 DTO。 | 现行 |

## 待处理

（无。`src/` 下已无 `*.test.ts(x)`。）
