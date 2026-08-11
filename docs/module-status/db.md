# @strict-rag/db · 模块状态

| 字段 | 内容 |
|------|------|
| 路径 | `packages/db` |
| 成熟度 | **可联调**（P1 知识库 / 入库 + S2 问答 + B3 model_* + B4 platform_roles + **B5 departments**；Drizzle → PostgreSQL） |
| 默认依赖模式 | 需要 `DATABASE_URL`；时间列使用本地格式字符串（见 ORM PRD） |
| 关联模块 | `api` 与 `worker` 共用 client / schema；检索闸门谓词被 api 的 retrieve 模块复用 |
| 最近更新 | 2026-08-11（`eval_runs` 表 + migration 0006；L1 文件 gold 仍在 `fixtures/l1`） |
| Spec | `.trellis/spec/db/` |
| PRD | `prds/03-data` · `prds/02-engineering/02-orm-drizzle.md` |

## 一句话状态

Drizzle schema + client：**知识库 / 文档 / 分片 / 向量 / 入库任务 / 成员**、**问答会话 / 轨迹 / 反馈 / eval_runs**、**模型供应商 / 绑定**、**平台角色 / 用户角色** 以及 **部门 / 用户部门** 表均已落地；并提供默认的检索双闸门谓词。**不等于**生产级迁移运维全集，也不是业务签字真跑完成。

---

## 已具备能力

### Client / 工具
- `createDb`（`client.ts`；可选 `statementTimeoutMs` / `lockTimeoutMs` 参数，传 0 表示不设置）
- 分端默认值：api 15s / 10s · worker 0（ARCH-P0-4）
- `formatLocalDateTime`（写库时间使用本地格式串）

### Schema · system
- `schema_meta` · `users`
- **B3**：`model_providers` · `model_bindings`（migration `0003_b3_model_gateway`）
- **B4**：`platform_roles` · `user_roles`（migration `0004_b4_platform_roles`；权限码存 codes_json；tenant + code 联合唯一）
- **B5**：`departments` · `user_departments`（migration `0005_b5_departments`；path 物化存储；is_primary / is_leader 标志）

### Schema · kb（入库主轴）
- `knowledge_bases` · `documents` · `chunks` · `chunk_manifests` · `chunk_embeddings`
- `ingest_jobs` · `kb_members`

### Schema · ask（S2）
- `ask_sessions` · `ask_traces`（含 evidence 快照类型）· `ask_feedback`
- **B10-followup**：`eval_runs`（`retrieve_mode` / 2×2 矩阵 / `report_json`；migration `0006_b10_eval_runs`）
- schema 单测：`schema/ask/ask-schema.test.ts`

### 查询谓词
- 默认检索闸门：`status=ready ∧ lifecycle=active`（`query/retrieval-gate.ts` + 单测）
- 供 api 的 retrieve 模块复用，避免路由内散落闸门条件

---

## 明确未做 / 边界

| 项 | 说明 |
|----|------|
| 部门强制检索 / 跨部门授权 / 文档 owner_dept | 组织表已落地；检索 principals 与授权（grant）表未做 |
| 业务签字 live 真跑数字 | 表 `eval_runs` 已有；题面 gold≥60；**真跑**须 api live profile + B3-W 后重跑（属运行时 / B10-followup 余量） |
| Mongo 正文 / ES 索引本体 | **不在**本包；对象与稀疏索引在其它存储中 |
| 自动 migration 流水线产品化 | schema 已有；运维发布流程不在本状态文档夸大描述 |

---

## 技术债

| 债 | 影响 | 备注 |
|----|------|------|
| pgvector 维度与 mock embed 对齐 | 假向量可以入库、可以检索演示 | 切真实模型时必须对齐向量维度 |
| 时间串使用本地格式 | 跨时区展示需要约定 | 见 ORM PRD |
| schema 变更与 PRD 需要双写 | 漏改容易漂移 | 改表前先改 PRD / ADR |

---

## 证据

| 类型 | 指针 |
|------|------|
| 导出 | `packages/db/src/index.ts` · `schema/index.ts` |
| 知识库表 | `packages/db/src/schema/kb/*` |
| 问答 / 评测表 | `packages/db/src/schema/ask/*` · `eval-runs.ts` · migration `drizzle/0006_b10_eval_runs.sql` |
| 检索闸门 | `packages/db/src/query/retrieval-gate.ts` · `retrieval-gate.test.ts` |
| Client | `packages/db/src/client.ts` |
| Task（已归档） | `.trellis/tasks/archive/2026-08/08-05-p2-contracts-schema/` · `08-04-p1-kb-doc-schema` 等 |
