# 入库报告 dedupe_cross_doc_rate 最小闭环

Type: task
Label: wayfinder:task
Status: pending
Assignee: —
Triage: ready-for-agent
Blocked by: 94

## Question

补入库报告里 PRD 点名、仓库**零命中**的跨文档去重指标。

权威：

- 功能表 §6 worker（第 473 行）：「同 KB 跨文档默认 on…；**剩余 searchable chunk 占比低于阈值时，在入库报告标「高度重复」并提示运营人工确认（阈值以数据 PRD 为准）**」
- `prds/04-pipelines/01-offline-ingest.md` §5.2：入库报告**必出** `dedupe_*` 指标（含 `dedupe_cross_doc_rate`）。
- 功能表 §4.3（第 299 行）：文档页抽屉/同页展示去重冲突对与跨 doc skip。

现状（源码 IS）：

- `rg 'dedupe_cross_doc_rate'` 全仓**零命中**：报告只有计数与冲突对，没有 rate。
- 快照字段：`apps/worker/src/ingest/ingest-report.ts:14-31`（`chunkCount` / `internalDropped` / `crossDocDropped` / `conflictPairs` / `contextSource` / 双就绪 / 对账）。
- 表：`packages/db/src/schema/kb/ingest-reports.ts:15-33`（`internal_dropped` / `cross_doc_dropped` / `conflict_pairs`…，**无 rate 列**）。
- 契约：`packages/contracts/src/ingest/ingest-report.contract.ts:16-39`（`.strict()`）；`packages/contracts/tests/ingest/ingest-report-contract.test.ts:53-56` 已断言「拒绝 Hit@k 与 `pending_review` 装齐字段」——本票新增字段不得破坏该断言口径（那条测例拒的是**别的**字段）。
- 出口：`apps/api/src/services/ingest-reports.ts:36-49` `toIngestReportItem`（无派生 rate）；`apps/api/src/routes/ingest-report.ts:30-38` 库级 GET 原样返回落库行。
- 去重判定：`apps/worker/src/ingest/cross-doc-dedupe.ts:9-10`（`CROSS_DOC_SHINGLE_N=3` / `CROSS_DOC_JACCARD_MIN=0.9`）；`:19-23` 冲突对只有 `action: 'skip_index'`；调用点 `apps/worker/src/ingest/pipeline.ts:515-540`（命中即 `continue`：不进 manifest、不写向量、不写 ES）。

**口径（PRD 只给指标名，本票必须自己钉并在 Answer 复述）**：

- `dedupeCrossDocRate = crossDocDropped / (chunkCount + internalDropped + crossDocDropped)`，即「本轮参与去重的 chunk 总数」为分母；**分子分母都用本轮已落库计数**，不得另起统计口径。
- 分母为 0（空文档 / 全被去重清空）→ 写 **`null`**，**禁止**写 0（不得假装「零重复」）。
- 该 rate 是**报告指标**，**不是** ready 闸：`rate` 高不改变 `ready` 判定、不触发 `pending_review`、不改 `skip_index` 默认动作。

### 做

- 迁移：`ingest_reports` 增 rate 列（**手写 SQL + 手写 `meta/_journal.json` 条目**，`idx` 递增；仓库 `drizzle/meta/` 只留 `0000` 快照，`db:generate` 会重写全量 `CREATE TABLE`，**禁止**提交其产出）。
- worker：计算并落库；保持既有 `crossDocDropped` / `conflictPairs` 语义不变。
- contracts：`IngestReportItemSchema` 增该字段（nullable，缺省如实为 null；`.strict()` 保留）。
- api：回读带出（`toIngestReportItem`）；admin 文档行展开处如实展示（未记录/分母为 0 → 明说未记录，**禁止**显示 0%）。
- 测例：worker（`tests/ingest/ingest-report.test.ts`）· contracts（`tests/ingest/ingest-report-contract.test.ts`）· api（`tests/ingest/ingest-report-http.test.ts`）· db（`tests/ingest/ingest-reports-schema.test.ts`）；禁真集群。

### 不做

- **不做**「高度重复」提示与阈值判断：功能表写「阈值以数据 PRD 为准」，而 `prds/03-data` **没有任何阈值或占比定义** → 本票不发明阈值、不做提示文案、不做 UI 告警。
- **不做** `pending_review`（落点 `chunks.duplicate_of` / `dedupe_status` / `searchable` 与人工决定端点均未冻，另票）。
- 不加 `downrank` 动作（现有冲突对类型只收窄到 `skip_index`）；不引真 MinHash LSH；不改 `retrieval` 闸与默认动作。
- 不改 `prds/00–11`；不 `task.py create`；禁止 push。

收工：`.trellis/spec/worker/backend/` 入库报告节 + `.trellis/spec/db/` 表节 + `.trellis/spec/api/backend/`（若入库报告有专节）；`docs/module-status/{worker,api,contracts,db}.md`。Answer 里写明「只落 rate 数值及其口径，未做阈值提示与 `pending_review`」。

## Comments

- 2026-09-16 由 [裁定 93](./93-after-92-order.md) 排为本批第二张：功能表 / PRD 明文必出，但**只做一半**（rate），另一半（「高度重复」提示）因数据 PRD 未定义阈值而留雾。
