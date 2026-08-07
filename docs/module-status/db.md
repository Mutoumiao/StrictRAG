# @strict-rag/db · 模块状态

| 字段 | 内容 |
|------|------|
| 路径 | `packages/db` |
| 成熟度 | **可联调**（P1 KB/入库 + S2 ask + B3 model_* + B4 platform_roles + **B5 departments**；Drizzle → PG） |
| 默认依赖模式 | 需 `DATABASE_URL`；时间列为本地格式串（见 ORM PRD） |
| 关联模块 | `api` · `worker` 共用 client/schema；检索闸被 api retrieve 复用 |
| 最近更新 | 2026-08-07 |
| Spec | `.trellis/spec/db/` |
| PRD | `prds/03-data` · `prds/02-engineering/02-orm-drizzle.md` |

## 一句话

Drizzle schema + client：**知识库/文档/分片/向量/入库任务/成员**、**ask 会话/轨迹/反馈**、**模型供应商/绑定**、**平台角色/用户角色** 与 **部门/用户部门** 表已落地；提供默认检索双闸谓词。**≠** 生产迁移运维全集或全文评测仓。

---

## 已具备能力

### Client / 工具
- `createDb`（`client.ts`；可选 `statementTimeoutMs` / `lockTimeoutMs`，0=不设）
- 分端默认：api 15s/10s · worker 0（ARCH-P0-4）
- `formatLocalDateTime`（写库时间本地串）

### Schema · system
- `schema_meta` · `users`
- **B3**：`model_providers` · `model_bindings`（migration `0003_b3_model_gateway`）
- **B4**：`platform_roles` · `user_roles`（migration `0004_b4_platform_roles`；codes_json；tenant+code 唯一）
- **B5**：`departments` · `user_departments`（migration `0005_b5_departments`；path 物化；is_primary/is_leader）

### Schema · kb（入库主轴）
- `knowledge_bases` · `documents` · `chunks` · `chunk_manifests` · `chunk_embeddings`
- `ingest_jobs` · `kb_members`

### Schema · ask（S2）
- `ask_sessions` · `ask_traces`（含 evidence 快照类型）· `ask_feedback`
- schema 单测：`schema/ask/ask-schema.test.ts`

### 查询谓词
- 默认检索闸：`status=ready ∧ lifecycle=active`（`query/retrieval-gate.ts` + 单测）
- 供 api retrieve 复用，避免路由内散落闸条件

---

## 明确未做 / 边界

| 项 | 说明 |
|----|------|
| 部门强制检索 / cross-grant / 文档 owner_dept | 组织表已落；检索 principals 与 grant 表未做 |
| 评测集 / 黄金集表 | backlog B10 |
| Mongo body / ES 索引本体 | **不在**本包；对象与稀疏索引在其它存储 |
| 自动 migration 流水线产品化 | 有 schema；运维发布流程不在本状态文档夸大 |

---

## 技术债

| 债 | 影响 | 备注 |
|----|------|------|
| pgvector / 维数与 mock embed 对齐 | 假向量可入库可检索演示 | 切真模型须对齐 dims |
| 时间串本地格式 | 跨时区展示需约定 | 见 ORM PRD |
| schema 变更与 PRD 双写 | 漏改易漂移 | 改表先 PRD/ADR |

---

## 证据

| 类型 | 指针 |
|------|------|
| 导出 | `packages/db/src/index.ts` · `schema/index.ts` |
| KB 表 | `packages/db/src/schema/kb/*` |
| Ask 表 | `packages/db/src/schema/ask/*` |
| 检索闸 | `packages/db/src/query/retrieval-gate.ts` · `retrieval-gate.test.ts` |
| Client | `packages/db/src/client.ts` |
| Task（归档） | `.trellis/tasks/archive/2026-08/08-05-p2-contracts-schema/` · `08-04-p1-kb-doc-schema` 等 |
