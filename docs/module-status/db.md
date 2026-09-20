# @strict-rag/db · 模块状态

| 字段 | 内容 |
|------|------|
| 路径 | `packages/db` |
| 成熟度 | **可联调**（schema + client + 检索谓词底座；**无**业务服务层） |
| 默认依赖模式 | 需要调用方提供 `DATABASE_URL`；时间列使用本地格式字符串（见 ORM PRD） |
| 关联模块 | `api` 与 `worker` 共用 client / schema；检索闸门谓词被 api retrieve 复用 |
| 最近更新 | 2026-09-20（`drizzle/meta/0021_snapshot.json` 基线快照落盘（26 表），`db:generate` 恢复可用；**验收在仓外副本达成**，仓库侧只多该未跟踪文件）；2026-09-19（`documents.active_index_version`，migration `0020`；`chunks.duplicate_of` / `dedupe_status`，migration `0021`；均**无默认**）；2026-09-17（`ingest_reports.contextualize_l1_ok` / `contextualize_l0_fallback`，migration `0019`，无默认）；2026-09-16（`ingest_reports.dedupe_cross_doc_rate`，migration `0018`；`ask_traces.citations`，migration `0017`；均无默认） |
| Spec | `.trellis/spec/db/backend/` |
| PRD | `prds/03-data` · `prds/02-engineering/02-orm-drizzle.md` |

## 一句话状态

Drizzle schema + client：**知识库 / 文档 / 分片 / 向量(jsonb) / 入库任务表 / 入库报告表 / 设置修改日志表 / 成员**、**问答会话 / 轨迹 / 反馈 / eval_runs**、**模型供应商 / 绑定**、**平台角色（codes_json）/ 用户角色**、**permission_definitions（启动字典）** 以及 **部门 / 用户部门** 表均已落地；并提供默认检索双闸谓词（`ready ∧ active`）与生效窗口纯函数。**不等于**生产级迁移运维全集、完整任务账本/锁、或权限三表终态（求值仍 `codes_json`）。

---

## 已具备能力

### Client / 工具
- `createDb`（`client.ts`；可选 `statementTimeoutMs` / `lockTimeoutMs`，传 0 表示不设置）
- 分端约定：api 15s/10s · worker 0（ARCH-P0-4；由调用方传入）
- `formatLocalDateTime`（写库时间本地格式串）
- `baseColumns` 共用列（`schema/_shard/base-columns.ts`）：`id`（uuid v7）+ `createdAt`/`createdBy`/`updatedAt`/`updatedBy`（本地时间串）
- 包导出：`.` · `./schema` · `./client`（`package.json`）

### Schema · system
- `schema_meta` · `users`（含兼容锚点 `platformRole` 文本字段）
- **B3**：`model_providers` · `model_bindings`（migration `0003_b3_model_gateway`）
- **B4**：`platform_roles` · `user_roles`（migration `0004_b4_platform_roles`；权限码存 **`codes_json` string[]**；独立角色-权限关联表未迁）
- **ADR-056 字典**：`permission_definitions`（migration `0012_permission_definitions`；主键为权限码 + kind/scope/description/source；kind 含 catalog `page+action`；**不是**运行时求值）
- **B5**：`departments` · `user_departments`（migration `0005_b5_departments`）

### Schema · kb（入库主轴）
- `knowledge_bases` · `documents`（含 **`chunkStrategy` / `chunkStrategyParams`** · **`active_index_version`**（migration `0020`；**可空无默认**，NULL = 从未成功激活 / 旧行未回填；只在 `es_index` 成功那次与 `status=ready` **同一条 UPDATE** 写）· **P3b-META** `owner_dept_id` / `visibility_level` 默认 20；**强制未接** · **P3b** `acl_principals` 可空 `uuid[]`，NULL=未设）· `chunks`（含 **`duplicate_of` / `dedupe_status`**，migration `0021`；`dedupe_status` 仅取值 `pending_review`，处理完回 NULL）· `chunk_manifests`
- `chunk_embeddings`：**`embedding` 列为 jsonb `number[]`**（演示 mock 向量；**不是** native pgvector/`vector` 列）
- `ingest_jobs`：schema 已有；**worker** `job-ledger` 按阶段边界最小写（**非**本包服务层；无查询 API；同 doc 锁在 worker Redis 侧）
- `ingest_reports`：doc+indexVersion 唯一；事实列 chunkCount / internalDropped / **crossDocDropped / dedupeCrossDocRate** / conflictPairs / **contextSource** / **contextualizeL1Ok / contextualizeL0Fallback** / 双就绪 / 对账计数（migration `0011_ingest_reports` + `0015_ingest_report_cross_doc` + `0016_ingest_report_context_source` + `0018_ingest_report_dedupe_rate` + `0019_ingest_report_contextualize_counts`）；`dedupe_cross_doc_rate` 与两个 contextualize 计数**均无默认**（NULL = 迁移前旧行未记录，不得读成 0；L1 未开启的本轮写 0）；`conflictPairs` 形状 = `{otherDocId, otherChunkId, action: skip_index|pending_review, heldChunkId?}`；**无** Hit@k 列
- `kb_settings_audits`：tenantId / kbId / actorUserId / diffJson（migration `0013_kb_settings_audits`）；**无**密钥列；**不是** admin_write 全路径落表
- `kb_members`
- **ADR-053**：`chunk_strategy_definitions` · `kb_chunk_strategies`（migration `0009_chunk_strategy_layers`）

### Schema · ask（S2）
- `ask_sessions` · `ask_traces`（含 evidence 快照类型 + **`citations`**）· `ask_feedback`
- `ask_traces.citations`（migration `0017_ask_traces_citations`；**无默认**）：对象数组 = 当轮引用；`[]` = 当时确实零引用；`NULL` = 迁移前旧文未记录（断线重拉时判 `ready=false`，不冒充 answered）
- **B10-followup / P2.5-L2P / P2 底线**：`eval_runs`（L1 `golden_2x2` / L2 `session_multiturn`；L2 signoff_eligible 恒 0；migration `0006_b10_eval_runs` + `0010_eval_floor` 增 status / jobId / errorMessage 列）
- **gold_questions**：运营题面（caseKey 每库唯一；migration `0010_eval_floor`）
- schema 单测：`tests/ask/ask-schema.test.ts`

### Migrations（journal 22 条，idx 0–21）
- `0000_phase0_schema_meta` → `0021_chunks_dedupe_review`（`drizzle/meta/_journal.json`）
- 脚本：`db:generate` / `db:migrate` / `db:studio`（运维产品化流水线 **不**在本包宣称）
- **基线快照（2026-09-20 已补）**：`drizzle/meta/` 现有 `0000_snapshot.json` 与 **`0021_snapshot.json`**（`0001`–`0020` 仍缺，属历史缺口；`generate` 只读排序**末位**快照，故不影响可用性）→ `drizzle-kit generate` **恢复可用**，硬验收 = 跑出 `No schema changes, nothing to migrate 😴`；**该验收在仓外副本达成、未在仓库工作区跑过**（以免把 `0022_*.sql` 写进仓库），复跑：`node <副本>/node_modules/drizzle-kit/bin.cjs generate`（需跑命令坐实，非单测）。`drizzle-kit check` 仍**假绿**、**不得**单独用作验收；已装 `drizzle-kit@0.31.10` **不输出 `IF NOT EXISTS`**，故**禁止**提交 generate 的全量 `CREATE TABLE` 产物（会让 `migrate` 在已建表的库上报 `relation already exists`）。当前有效实践仍是**手写 migration SQL + 手写 journal 条目**

### 查询谓词
- 默认检索闸门：`status==='ready' && lifecycle==='active'`（`query/retrieval-gate.ts` + 单测）
- 生效窗口：`isWithinEffectiveWindow`（缺界不限；`from <= now < to`；`query/effective-window.ts`）
- **实现不含** `indexVersion` 过滤（以代码为准；文件头若写 indexVersion 属注释债）
- 供 api retrieve 复用，避免路由内散落闸门条件

---

## 明确未做 / 边界

| 项 | 说明 |
|----|------|
| 部门强制检索 / 跨部门授权 | 文档部门列 `0007`；`dept_cross_grants` `0008`；过滤在 api 默认关（开时精确 ∪ 祖先 + grant 精确 ∪ 祖先部门子树；超管可绕过；列表同滤；可关继承） |
| 权限三表终态 | 字典表 `permission_definitions` 已落；求值仍 `codes_json`；规范化角色-权限关联表迁表须 ADR |
| `ingest_jobs` 完整运维账本 | 表有；worker 最小写；查询面无（锁见 worker Redis） |
| 业务签字 live 真跑数字 | 表 `eval_runs` 可落库；真跑属 api/ops |
| Mongo 正文 / ES 索引本体 | **不在**本包 |
| 原生 pgvector 列 + ANN 索引 | 当前 jsonb mock 向量 |
| 自动 migration 流水线产品化 | 仅有 drizzle-kit 脚本 |

---

## 技术债

| 债 | 影响 | 备注 |
|----|------|------|
| embedding 为 jsonb mock 维 | 假向量可入库、可演示；切真模型须改列/维数策略 | 与 worker dims=8 对齐演示 |
| 「pgvector」口头称呼易误导 | 源码是 jsonb，不是 pgvector 扩展列 | 写 IS/对外说明时用 jsonb |
| `retrieval-gate` 注释 vs 实现 | 注释若提 indexVersion 而代码未滤 | **以代码为准** |
| `ingest_jobs` 最小写 ≠ 生产账本 | 易被抬成熟度 | 查询 / 入队 queued 仍欠；锁最小见 worker `doc-lock` |
| 时间串本地格式 | 跨时区展示需约定 | 见 ORM PRD |
| schema 与 PRD 双写 | 漏改易漂移 | 改表前先 ADR/PRD |

---

## 证据

| 类型 | 指针 |
|------|------|
| 导出 | `packages/db/src/index.ts` · `schema/index.ts` |
| 知识库表 | `packages/db/src/schema/kb/*`（`documents.ts` · `chunk-embeddings.ts` · `ingest-jobs.ts` · `ingest-reports.ts` · `kb-settings-audits.ts`） |
| 设置修改日志 | `schema/kb/kb-settings-audits.ts` · migration `drizzle/0013_kb_settings_audits.sql` · `tests/kb/settings-audits-schema.test.ts` |
| 问答 / 评测表 | `packages/db/src/schema/ask/*` · `eval-runs.ts` · `gold-questions.ts` · migration `drizzle/0006_b10_eval_runs.sql` · `0010_eval_floor.sql` · `0017_ask_traces_citations.sql` |
| 平台 / 部门 | `schema/system/platform-roles.ts` · `departments.ts` |
| 权限码字典 | `schema/system/permission-definitions.ts` · migration `drizzle/0012_permission_definitions.sql` · `tests/acl/permission-definitions-schema.test.ts` |
| 检索闸门 | `packages/db/src/query/retrieval-gate.ts` · `query/effective-window.ts` · `tests/retrieve/ready-active-gate.test.ts` · `tests/retrieve/effective-window.test.ts`（导航 `packages/db/tests/index.md`） |
| Client | `packages/db/src/client.ts` · `time.ts` |
| Journal | `packages/db/drizzle/meta/_journal.json` |
| Task（辅证 · 已归档） | `08-04-p1-kb-doc-schema` · `08-05-p2-contracts-schema` · `08-11-b10-followup-eval-runs` 等 |
