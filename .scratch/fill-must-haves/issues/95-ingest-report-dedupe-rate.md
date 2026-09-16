# 入库报告 dedupe_cross_doc_rate 最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
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

## Answer

**口径（本票钉的，PRD 只给指标名）**：`dedupeCrossDocRate = crossDocDropped / (chunkCount + internalDropped + crossDocDropped)`（分母 = 本轮**参与去重的切片总数** = 存活 + 文档内丢弃 + 跨文档丢弃）。**分母为 0 → 落 `NULL`**（不是 0），旧行同样是 `NULL` 且原样回读。

**做了什么**

- db：`ingest_reports` 增 `dedupe_cross_doc_rate` real（**无默认**）+ 手写迁移 `packages/db/drizzle/0018_ingest_report_dedupe_rate.sql` 与 `meta/_journal.json` 条目 idx 18（`db:generate` 仍不可用，见地图工程债）。
- worker（`apps/worker/src/ingest/ingest-report.ts`）：新增纯函数 `dedupeCrossDocRate({chunkCount, internalDropped, crossDocDropped})`，在 `buildIngestReportInsert` 内**由同一份计数派生**并写列；`buildIngestReportPatch` 同步带上 —— 因此同 version 的更新（`persistIngestReport` 合并既有计数）也会得到与计数一致的 rate，**不会出现「rate 与计数分叉」的行**。两条 `persistIngestReport` 调用点（清空/冻结）无需改动。
- contracts：`IngestReportItemSchema` 增 `dedupeCrossDocRate: number.min(0).max(1).nullable()`（`.strict()` 保留；缺字段仍拒）。
- api：`toIngestReportItem` 原样回读（`?? null`，不把 null 填成 0）；`listByKb` select 带出该列。
- admin：`report.services.ts` 新增 `dedupeRateLabel()`（数值 → `20.0%`；null/undefined/NaN → 「未记录（本轮无参与去重的切片）」），文档行展开的入库报告行追加「跨文档去重率 …」。**禁止把 null 显示成 0%**（那会把「没参与去重」说成「零重复」）。

**没做什么 / 边界**

- **未做「高度重复」提示与阈值判断**：功能表写「阈值以数据 PRD 为准」，而 `prds/03-data` **没有任何阈值或占比定义**；本票不发明阈值、不做提示文案、不做 UI 告警。
- 未做 `pending_review`（`chunks` 的 `duplicate_of` / `dedupe_status` / `searchable` 三列与人工决定端点均未冻）；未加 `downrank`；未引真 MinHash LSH；未动默认 `skip_index` 与检索闸；未改 `prds/00–11`。
- 本票**没有**把 rate 接到 `ready` 判定上（它只是报告指标）。

**验证**

- 包内：`contracts tests/ingest/ingest-report-contract.test.ts` 4 通过 · `worker tests/ingest/ingest-report.test.ts` 5 通过 · `api tests/ingest/ingest-report-map.test.ts` + `ingest-report-http.test.ts` 6 通过 · `admin tests/ops/ingest-report.test.tsx` 5 通过。
- 顺手修的既有断言：admin 那条 `findByText(/…跨文档去重 1 · 情境 l0/)` 因为新插入「跨文档去重率」文本而必然失配 → 已按新形态更新（测试先红后绿，不是放宽）。
- 全仓：见地图本轮收口处的门禁数字（`pnpm check-types` / `pnpm lint` 既有 7 条 warning / `pnpm test` 全绿）。
- 回写：`.trellis/spec/worker/backend/ingest-capability-matrix.md`（capability 表 + 存储表两行）· `.trellis/spec/db/backend/database-guidelines.md`（迁移 Gotcha 补 `0018`）· `.trellis/spec/admin/frontend/quality-guidelines.md`（入库报告入口规约补「未记录 ≠ 0%」）；`docs/module-status/{worker,api,contracts,db,admin}.md`；四个包的 `tests/index.md` 行文。

## Comments

- 2026-09-16 由 [裁定 93](./93-after-92-order.md) 排为本批第二张：功能表 / PRD 明文必出，但**只做一半**（rate），另一半（「高度重复」提示）因数据 PRD 未定义阈值而留雾。
- 2026-09-16 完成。切边：rate 只作报告指标，不接 ready 闸；不做提示与 `pending_review`。
