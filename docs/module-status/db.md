# @strict-rag/db · 模块状态

| 字段 | 内容 |
|------|------|
| 路径 | `packages/db` |
| 成熟度 | **可联调**（schema + client + 检索谓词底座；**无**业务服务层） |
| 默认依赖模式 | 需要调用方提供 `DATABASE_URL`；时间列使用本地格式字符串（见 ORM PRD） |
| 关联模块 | `api` 与 `worker` 共用 client / schema；检索闸门谓词被 api retrieve 复用 |
| 最近更新 | 2026-08-17（`dept_cross_grants` 已落；enforce 开时 api 读精确 grant） |
| Spec | `.trellis/spec/db/backend/` |
| PRD | `prds/03-data` · `prds/02-engineering/02-orm-drizzle.md` |

## 一句话状态

Drizzle schema + client：**知识库 / 文档 / 分片 / 向量(jsonb) / 入库任务表 / 成员**、**问答会话 / 轨迹 / 反馈 / eval_runs**、**模型供应商 / 绑定**、**平台角色（codes_json）/ 用户角色** 以及 **部门 / 用户部门** 表均已落地；并提供默认检索双闸谓词（`ready ∧ active`）。**不等于**生产级迁移运维全集、完整任务账本/锁、或权限三表终态。

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
- **B4**：`platform_roles` · `user_roles`（migration `0004_b4_platform_roles`；权限码存 **`codes_json` string[]**；**无** permission / role_permission / grant 三表）
- **B5**：`departments` · `user_departments`（migration `0005_b5_departments`）

### Schema · kb（入库主轴）
- `knowledge_bases` · `documents`（含 **`chunkStrategy` / `chunkStrategyParams`** · **P3b-META** `owner_dept_id` / `visibility_level` 默认 20；**强制未接**）· `chunks` · `chunk_manifests`
- `chunk_embeddings`：**`embedding` 列为 jsonb `number[]`**（演示 mock 向量；**不是** native pgvector/`vector` 列）
- `ingest_jobs`：schema 已有；**worker** `job-ledger` 按阶段边界最小写（**非**本包服务层；无查询 API；同 doc 锁在 worker Redis 侧）
- `kb_members`

### Schema · ask（S2）
- `ask_sessions` · `ask_traces`（含 evidence 快照类型）· `ask_feedback`
- **B10-followup / P2.5-L2P**：`eval_runs`（L1 `golden_2x2` / L2 `session_multiturn`；L2 `signoff_eligible` 恒 0；migration `0006_b10_eval_runs`）
- schema 单测：`schema/ask/ask-schema.test.ts`

### Migrations（journal 8 条）
- `0000_phase0_schema_meta` → `0007_p3b_doc_dept_meta`（`drizzle/meta/_journal.json`）
- 脚本：`db:generate` / `db:migrate` / `db:studio`（运维产品化流水线 **不**在本包宣称）

### 查询谓词
- 默认检索闸门：`status==='ready' && lifecycle==='active'`（`query/retrieval-gate.ts` + 单测）
- **实现不含** `indexVersion` 过滤（以代码为准；文件头若写 indexVersion 属注释债）
- 供 api retrieve 复用，避免路由内散落闸门条件

---

## 明确未做 / 边界

| 项 | 说明 |
|----|------|
| 部门强制检索 / 跨部门授权 | 文档部门列 `0007`；`dept_cross_grants` `0008`；过滤在 api 默认关（开时精确 ∪ 祖先 + 精确 grant；超管可绕过；列表同滤；可关继承） |
| 权限三表终态 | 现为 `codes_json` 过渡；迁表须 ADR |
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
| 知识库表 | `packages/db/src/schema/kb/*`（`documents.ts` · `chunk-embeddings.ts` · `ingest-jobs.ts`） |
| 问答 / 评测表 | `packages/db/src/schema/ask/*` · `eval-runs.ts` · migration `drizzle/0006_b10_eval_runs.sql` |
| 平台 / 部门 | `schema/system/platform-roles.ts` · `departments.ts` |
| 检索闸门 | `packages/db/src/query/retrieval-gate.ts` · `retrieval-gate.test.ts` |
| Client | `packages/db/src/client.ts` · `time.ts` |
| Journal | `packages/db/drizzle/meta/_journal.json` |
| Task（辅证 · 已归档） | `08-04-p1-kb-doc-schema` · `08-05-p2-contracts-schema` · `08-11-b10-followup-eval-runs` 等 |
