# @strict-rag/worker · 模块状态

| 字段 | 内容 |
|------|------|
| 路径 | `apps/worker` |
| 端口 | 无 HTTP 端口 |
| 成熟度 | **可联调**（P1 入库状态机；**仅** development/test + mock 栈可起；**staging/production 当前无合法扫描配置**） |
| 默认依赖模式 | `APP_ENV=development` · 启动探针 `WORKER_PROBE_ON_START=true` · 扫描 = `mock_clean` · 向量 = `mock`（dims=8，枚举 `mock\|fail`）· ES 索引 = `mock`（枚举 `mock\|fail\|http`，**默认 mock**；`http` 须 `ELASTICSEARCH_URL`）· 对象存储 = 默认本地目录；`STORAGE_MODE=s3` 走 RustFS（S3 兼容） · `S3_BUCKET=strict-rag` · Mongo URL 空则 `mongoDocId=local:` · `INGEST_MIN_EXTRACTED_CHARS=40` · **可运行叠加** `.env.operable.example`（http/s3/mongo；**不**改 Zod 默认） |
| 关联模块 | 由 `api` 入队触发；写库走 `@strict-rag/db`；队列名 / job payload / 可执行策略集来自 `@strict-rag/contracts`；运行需要 Redis + PostgreSQL |
| 最近更新 | 2026-08-29（`sr-eval` 消费者跑 L1 golden；写 `eval_runs`；≠ 签字 PASS） |
| Spec | `.trellis/spec/worker/backend/` |
| PRD | `prds/06-async` · `prds/04-pipelines/01-offline-ingest.md` |

## 一句话状态

BullMQ 消费者：probe + 入库五阶段状态机在 **dev mock 栈**下可跑通；扫描 / 向量 / ES **默认均为 mock**，对象存储读本地目录。**不是**生产级入库链路；**`INGEST_SCAN_MODE=on` 全环境拒启动**，staging/production 同样拒 mock —— 因此在 QUAL-2 清债前，生产向 worker **无法按现有 env 合法启动**。

---

## 已具备能力

### 进程与队列
- Worker 进程入口：仅 BullMQ consumer + 信号退出（**无**业务 HTTP / listen）
- 队列名来自 contracts：`sr-probe` · `sr-ingest` · **`sr-eval`**（`apps/worker/src/queues.ts` · `packages/contracts/src/async/queues.ts`）
- `WORKER_PROBE_ON_START=true`（默认）时启动即向 `sr-probe` 入队 `noop` 探针 job（`reason='worker_start_probe'`），验证 Redis / 队列可用
- 默认 job：`attempts=3` · exponential backoff 2000ms（`INGEST_JOB_*` · `index.ts`）
- 启动：Redis PING；失败 `process.exit(1)`；优雅停机分阶段 close Worker / Queue / Redis / DB
- DB：`statementTimeoutMs=0` / `lockTimeoutMs=0`（入库耗时长；`db.ts`）

### 扫描启动闸（X-01 / X-02）
- 纯函数 `checkScanModeStartupPolicy` + `env` superRefine（`scan-mode-policy.ts` · `env.ts`）
  - **`on`**：任意 `APP_ENV` → **拒启动**（真引擎未接，≠ mock clean）
  - **staging/production** + `mock_*` / `off` → **拒启动**
  - 仅 **development/test** 允许 `mock_clean` / `mock_infected` / `off`
  - 未知 `APP_ENV` / 未知 `INGEST_SCAN_MODE` 同样 **拒启动**（fail-closed）
- 运行时防御：pipeline 遇 `on` → `SCAN_ENGINE_UNAVAILABLE`（不可当作 clean）

### 入库流水线（`ingest/pipeline.ts`）
- 阶段：`scan → parse → chunk → embed → es_index`（`IngestJobData.stage`）
- **scan**：`mock_infected` 删本地对象 + `MALWARE`；`mock_clean` / `off` 放行；审批重检（ADR-048）在**任意阶段**入口先做，未通过 → `NOT_APPROVED`（非仅 scan）
- **parse**：读对象（local 或 `STORAGE_MODE=s3`）；过短 → `needs_ocr` + `NO_TEXT_LAYER`；有 `MONGODB_URL` 写 `document_bodies`（`upsertDocumentBody` / `findDocumentBody` / `pingMongo`），否则 `mongoDocId=local:{docId}`；冒烟 `pnpm --filter @strict-rag/worker smoke:mongo`
- **chunk**：**仅** `structure_paragraph`（contracts `IMPLEMENTED_*`）；未实现 → `UNSUPPORTED_CHUNK_STRATEGY`（**不**静默回落）；写 chunks（含 `mongoBodyId`）+ `chunk_manifests`；`MONGODB_URL` 非空时另写 Mongo `chunk_bodies`（`upsertChunkBodies`，`_id=chunkId`）；`indexVersion = doc.indexVersion+1` 并重置 `embedReady=0` / `esReady=0`
- **embed**：mock 伪向量 dims=8 · `model=mock-embed`；缺 embedding 行才补写（幂等 skip）
- **es_index**：默认 `mockEsStore`；`INGEST_ES_MODE=http` 时 `ensureSparseIndex` + bulk（写 `tenantId`/`kbId`/`docId`/`chunkId`/`sparseText`）+ 按 doc 对账（映射对齐 api `es-sparse`）；要求 `embedReady`；双就绪 → `status=ready` **且 `lifecycle='draft'`**（**不是** `active`；默认检索闸 `ready∧active` 仍拦，须运营升 lifecycle）
- 对象路径：`{STORAGE_LOCAL_DIR}/{S3_BUCKET}/{objectKey}`

### 评测消费者（P2 底线）
- `sr-eval` concurrency=1：读 `gold_questions` → 串行 `runL1Batch` → 回写 `eval_runs`（`eval/consumer.ts`）
- 默认 execute：HTTP `POST /api/v1/internal/eval/execute-ask`（`EVAL_ASK_BASE_URL` + `EVAL_INTERNAL_TOKEN`）；空 token 记 error
- **禁止** import `apps/api`；**禁止** mock 覆盖率当签字 PASS；无 τ 扫描 / 在线抽样

### 幂等 / 重试（X-04 最小）
- `idempotency.ts`：带 `indexVersion` + 有 manifest → **resume_embed，禁重分块**；有 version 无 manifest → `NO_MANIFEST`
- 可重试（普通 Error → BullMQ attempts）：`EMBED_FAILED` / `ES_INDEX_FAILED` / `ES_RECONCILE_FAILED` / `DOC_LOCK_BUSY` 等
- 不可重试（`UnrecoverableError`）：`MALWARE` / `NOT_APPROVED` / `UNSUPPORTED_CHUNK_STRATEGY` / `DOC_NOT_FOUND` / `EMPTY_CHUNKS` / `MISSING_INDEX_VERSION` / `EMBED_NOT_READY` / `UNKNOWN_STAGE` / `IDEMPOTENT_CHUNK_FORBIDDEN`（`bull-outcome.ts`）
- 未知 errorCode **fail-closed 不重试**
- **账本最小**：`job-ledger.ts` 每 stage 先 insert `running`、结束时写 `succeeded`/`failed`（写失败仅记 warn 日志，不阻断）；**未做** api 入队写 / 查询 API
- **同 doc 锁最小**：`doc-lock.ts` 用 Redis `SET NX EX`（默认 TTL 180s）+ token 安全释放；`index.ts` 持锁再跑 stage；抢锁失败 `DOC_LOCK_BUSY` 可重试；**非** Redlock

### 基础设施
- 环境变量校验、Pino 日志、与 api 共用 `@strict-rag/db`
- `GATEWAY_*` 出现在 worker `env.ts` **仅占位校验**；**pipeline 未调用**网关做真实 embed

---

## 明确未做 / 边界

| 项 | 说明 |
|----|------|
| 真实杀毒 / 生产扫描 | mock only；`on` 拒启动；QUAL-2 安全债 |
| 真实 embedding | 默认 `INGEST_EMBED_MODE=mock`；dims=8 与生产模型无关 |
| 真实 ES + IK 索引 | 默认可 `INGEST_ES_MODE=http` bulk（标准分词，写 `tenantId` 供共享索引查询期隔离）；**无** IK 插件 / 多租户 Router |
| 真 RustFS / Mongo 正文 | `STORAGE_MODE=s3` + `MONGODB_URL` 可写；默认仍本地 + `local:` |
| OCR / 复杂版式 | 仅标 `needs_ocr`，不续跑 OCR 引擎 |
| HTTP API | **禁止**业务 HTTP |
| `ingest_jobs` 完整运维账本 | **最小 stage 写已有**；无查询面 / 无 api 入队 `queued` |
| dual-ready 自动 `lifecycle=active` | 终态 draft；检索默认可检索性另闸 |

---

## 技术债

| 债 | 影响 | 备注 |
|----|------|------|
| **【安全债 · QUAL-2】真杀毒未接** | 生产收真实上传前必须清 | **DEC-SCAN**：dev 允许 mock；**X-01/X-02 已焊**。清债 = 真引擎 + `on` 健康检查放行 prod + 审计 + 剧本 M。**禁止**宣称已生产杀毒 |
| **prod-like 无法合法启动** | staging/production 既禁 mock 又禁未接的 `on` | 进生产前必须走 QUAL-2 放行路径 |
| mock 扫描 + mock 向量 + mock ES | 入库「可演示 ≠ 生产可信」 | 与 api 检索 mock 同源问题族 |
| **幂等+账本+锁最小已接 · 运维查询仍欠** | stage 行可写；同 doc SET NX 互斥；无运维查询面 / 非 Redlock | HOW `ingest-idempotency.md` · `job-ledger.ts` · `doc-lock.ts` · task `08-12-ingest-doc-lock-min` |
| 入库 ES 默仍 mock | 可运行栈须显式 `INGEST_ES_MODE=http` | 与 api `RETRIEVE_ES_MODE=http` 共用索引名；≠ IK |
| 分块策略极简 | 检索质量上限低 | 扩策略：先 worker 实现 + 扩 contracts `IMPLEMENTED_*` |
| `GATEWAY_*` 死配置 | 易误读「已接网关 embed」 | pipeline 未用 |
| 失败重试 / 死信 | 仅 BullMQ attempts + 日志；无业务 DLQ 面板 | 对照 PRD 异步章节 |

---

## 证据

| 类型 | 指针 |
|------|------|
| 入口 / 队列 | `apps/worker/src/index.ts` · `queues.ts` · `db.ts` |
| 流水线 | `apps/worker/src/ingest/pipeline.ts` · `es-store.ts` · `es-http.ts` · `mongo-body.ts` |
| 扫描闸 | `apps/worker/src/scan-mode-policy.ts` · `tests/ingest/scan-startup-policy.test.ts` · `env.ts` superRefine |
| 幂等 / 重试 / 锁 | `ingest/idempotency.ts` · `doc-lock.ts` · `job-ledger.ts` · `tests/ingest/{idempotency,doc-lock,job-ledger,bull-outcome}.test.ts` |
| 策略 SSOT | `packages/contracts/src/ingest/chunk-strategy.ts`（`IMPLEMENTED_*`） |
| job 契约 | `packages/contracts/src/async/ingest-job.ts` |
| 环境变量默认值 | `apps/worker/src/env.ts` |
| 单测 | `apps/worker/tests/ingest/` · `tests/env/`——**不是**入库 E2E；导航 `apps/worker/tests/index.md` |
| Task（辅证 · 已归档） | `08-04-p1-*` · `08-12-spec-w1-scan-failclosed` · `08-12-spec-w1-chunk-strategy-truth` · `08-12-spec-w1-ingest-idempotency-impl` · `08-12-ingest-jobs-ledger-min` · `08-12-ingest-doc-lock-min` · QUAL-2：`08-11-qual-scan-engine` |
