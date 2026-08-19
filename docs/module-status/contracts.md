# @strict-rag/contracts · 模块状态

| 字段 | 内容 |
|------|------|
| 路径 | `packages/contracts` |
| 成熟度 | **可联调**（支撑 P0/P1 入库 + S2 问答/会话/反馈/成员 + B1–B6 运营契约 + **B12 策略码 / ingest job**；**非**全量 OpenAPI） |
| 默认依赖模式 | 纯库；无运行时开关 |
| 关联模块 | 被 `api` · `worker` · `web` · `admin` 消费；是全仓错误码、响应信封、队列名与 **可写分片策略集** 的唯一来源 |
| 最近更新 | 2026-08-18（P3b-COL 列表项带部门字段 · P3b-KBINH `deptInheritDown`） |
| Spec | `.trellis/spec/contracts/library/` |
| PRD | `prds/05-api` · 各域契约与 PRD 短名对齐 |

## 一句话状态

共享的 **Zod 契约 + BizCode + 队列名 + ApiResponse 信封**：P1 入库、S2 问答路径、B1–B6 运营域，以及 **分片策略真源 / 入库 job payload** 均有代码导出。另提供测试子路径 `@strict-rag/contracts/testing`（**不是**生产 API）。**不是**覆盖全产品域的完整 OpenAPI。

---

## 已具备能力

### 公共
- `BizCode`：对外 `error.code` 短名（`common/biz-code.ts`；与 PRD §4 对齐）
- `ApiResponse` 等响应信封（`common/response.ts`）

### 系统 / 鉴权 / 异步
- health / ready 响应 schema（`system/health.contract`）
- session 鉴权契约：AuthMe / TokenPair（`auth/session.contract`）
- 队列名 SSOT：`QUEUE_NAMES.PROBE` · `INGEST`（`async/queues.ts`；BullMQ 禁 `:`）
- **入库 job payload（08-12）**：`IngestJobDataSchema`（`docId` · `kbId` · `tenantId` · `stage` ∈ scan/parse/chunk/embed/es_index · 可选 `indexVersion` / `requestId` / `attemptHint`）；默认 `INGEST_JOB_DEFAULT_ATTEMPTS=3` · `INGEST_JOB_BACKOFF_MS=2000`（`async/ingest-job.ts`，经 `async/queues` 再导出）

### 入库 + 分片策略（B12）
- 文档 body 及列表 / 详情 / 审批 / 扫描等成功响应的 data 形状（`ingest/document.contract`）
- **complete / reindex body 可选 `chunkStrategy`**；reindex 成功 data 含 `chunkStrategy` + `strategyChanged`
- 分片 list query / item / response + detail（`ingest/chunk.contract`；list **不含** body）
- **策略码 SSOT**（`ingest/chunk-strategy.ts`）：
  - `KNOWN`：`structure_paragraph` · `fixed_window` · `heading_sections`（含未实现 roadmap）
  - **`IMPLEMENTED`：仅 `structure_paragraph`**（可写库 / worker 可执行 ⊆ 此集）
  - `DEFAULT_CHUNK_STRATEGY` · `isImplementedChunkStrategy`
  - **禁止**把 KNOWN 未实现码当成可写入已交付

### 问答（S2）
- ask 请求 / 响应、拒答 reason、流式 `data-status` 形状（`ask/ask.contract` · `ask/reason`；`AskResponse` = 同步 JSON ≡ 流式 `data-ask-final`）
- **`AskRequestSchema`**：`question`（1–8000 字）· `sessionId` · 顶层 `scope` · `options`，`.strict()`
- **`AskOptionsSchema`**：仅 `stream` / `debug` / `mode` / `locale` 四字段，`.strict()` 拒绝 `tauClaim` / `retrieveK` / `scope`（ADR-050）
- **`AskScopeSchema`**：顶层 `docTypes`（≤32 个、每个 1–64 字），**禁止**塞进 options（B11）
- 会话外壳 + 列表包装 + `SessionListQuerySchema`（`ask/session.contract`）
- 反馈 + 队列列表包装 + `FeedbackQueueQuerySchema`（`ask/feedback.contract`）
- KB 成员 + 邀请 / 移除（`ask/member.contract`）
- 契约单测：`ask/ask.contract.test.ts` 等

### 测试辅助（仅 Vitest）
- 子路径 **`@strict-rag/contracts/testing`** → `src/testing.ts`（**未**挂主 `index` 生产面）
- `makeAnsweredFinal` / `makeAbstainedFinal`（`ask/fixtures.ts`）；**R10** `ask/fixtures.test.ts`
- 消费方：web `src/test/fixtures/ask.ts` re-export

### 知识库设置（B2）
- `AskModeSchema`（`strict` / `balanced` / `fast`）+ `DEFAULT_ALLOWED_MODES` / `DEFAULT_DEFAULT_MODE`（`kb/kb-settings.contract`）
- `KbSettings` / `PatchKbSettingsBodySchema`（strict 白名单 + modes 唯一性 + `dataClass` 默认 internal + `deptInheritDown` 默认 true）（`kb/kb-settings.contract`）
- `DocumentListItem` 含 `ownerDeptId` / `visibilityLevel`（缺省 null / 20；详情 inherit 列表项）
- `DeptCrossGrant` / `CreateDeptCrossGrantBodySchema`（`system/dept-grants.contract`）
- `CompleteUploadBody` 可选 `ownerDeptId` / `visibilityLevel`（P3b-UPL；旧 `{}` 仍合法）
- `qualitySnapshot` · `sessionRewrite` 锁定形状；禁止 τ / rewrite 写键

### 模型网关（B3）
- Provider / Create / Patch / Presets / Binding / Catalog / ModelRef（`system/model-gateway.contract`）
- GET 响应形状含 `hasApiKey`、**不含** apiKey 明文；purpose 类型闸 helper
- **边界**：有 **platform** 绑定契约；**无**独立「KB 绑定 PUT」专用 schema 导出

### 平台用户 / 角色（B4）
- User / Role / Create / Patch / Assign roles / Put permissions / PermissionCatalog（`system/platform-users-roles.contract`）
- **不含** password 字段（strict）

### 部门组织骨架（B5）
- Department / Tree / UserDepartment 等（`system/departments.contract`）

### 数据面板（B6）
- `DashboardSummarySchema`：`kbCount` / `documentCount` / `pendingApprovalCount` / `processReady` / 可选 `askCount24h`（`system/dashboard.contract`）

---

## 明确未做 / 边界

| 项 | 说明 |
|----|------|
| 全量运营域契约 | 跨部门授权 / KB 级模型绑定 **写** / APM 时序等 **无** 独立 schema |
| 生产 OpenAPI 生成与发布流水线 | 以 Zod 源码为准；api 侧 **ARCH-P2-1** 已有 dev 文档面（`apps/api/src/openapi` 读本包 Zod）；**无**独立 CI swagger 发布 |
| 版本化兼容策略文档化 | 契约随能力增量扩展；破坏性变更须先改 PRD |
| 多策略「已实现」全集 | `fixed_window` / `heading_sections` 仅 KNOWN，**非** IMPLEMENTED |

---

## 技术债

| 债 | 影响 | 备注 |
|----|------|------|
| 域文件随功能增长 | 易漏测试 | 新契约建议同域 `*.contract.test.ts` / `chunk-strategy.test.ts` 等 |
| `SESSION_DISABLED` 与 rewrite 语义别名 | 易被误用为「拒绝多会话」 | 代码注释已约束 |
| `AskSse*` 历史命名 | 易与 AI SDK data parts 混淆 | 语义上已是 data-status |
| `ingest-job` 经 queues 再导出 | 新人可能找不到 SSOT 文件 | 路径：`async/ingest-job.ts` |
| 无独立包级集成测试 | 主要靠 api 路由测 + 本包单测 | 当前阶段可接受 |

---

## 证据

| 类型 | 指针 |
|------|------|
| 入口导出 | `packages/contracts/src/index.ts` · `package.json` exports `./testing` |
| 策略 SSOT | `src/ingest/chunk-strategy.ts` · `chunk-strategy.test.ts` |
| 入库 job | `src/async/ingest-job.ts` · `ingest-job.test.ts` · `async/queues.ts` |
| 业务错误码 | `src/common/biz-code.ts` |
| ask fixtures | `src/ask/fixtures.ts` · `fixtures.test.ts`（R10） |
| 入库文档 | `src/ingest/document.contract.ts`（complete/reindex `chunkStrategy`） |
| 分片 | `src/ingest/chunk.contract.ts` |
| 知识库设置 | `src/kb/kb-settings.contract.ts` |
| 运营域 | `src/system/{dashboard,model-gateway,platform-users-roles,departments,health}.contract.ts` |
| 单测 | 同域 `*.test.ts` / `*.contract.test.ts` |
| P0 清单 | `docs/testing/p0-redlines.md`（协作 R10） |
| Task（辅证 · 已归档） | `archive/2026-08/08-05-p2-contracts-schema` · `08-11-b12-chunk-strategies` · `08-12-spec-w1-chunk-strategy-truth` 等 |
