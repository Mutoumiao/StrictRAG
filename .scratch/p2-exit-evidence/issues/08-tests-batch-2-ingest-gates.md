# 补测批 2 · 入库闸与双就绪（worker 为主）

Type: task
Status: resolved
Blocked by: —

## Question

把覆盖表 P2 必签余量中「入库闸与双就绪」这 19 行补到有实质断言：**L1 · L2 · L3 · L4 · L5 · L9 · M1 · M2 · M5 · M6 · Q1 · Q2 · Q5 · Q10 · V1 · V2 · V6 · V8 · AA6**。

预计约 20 条 `it`。落点（worker 为主体，另涉 api / contracts / admin 各一两处）见 `research/coverage-partial-tests.md` 末节的批 2 清单，例如新建 `apps/worker/tests/ingest/dual-ready-embeddings-parity.test.ts` · `es-fail-not-ready.test.ts` · `es-retry-recover.test.ts` · `reindex-atomic-switch.test.ts` · `embed-es-order.test.ts` · `scan-infected-effects.test.ts` · `pdf-text-to-ready.test.ts` · `scan-vs-ocr-startup.test.ts`，api 侧新建 `apps/api/tests/ingest/complete-size-http.test.ts` · `complete-head-authority.test.ts` · `complete-no-scan-enqueue.test.ts` · `no-forged-ready.test.ts` · `reindex-version.test.ts`。

L4 与 AA6 共用同一 `reindex` 夹具，一次搭好覆盖两行。worker 内存 db + mock ES 已足够离线跑全链（参考 `contextualize-fallback-ready.test.ts` 的写法）。

约束：默认 `RETRIEVE_ES_MODE=mock` / `INGEST_ES_MODE=mock` 下写测，**不得**为了凑绿把 mock 结果标成生产 ES 已验；双就绪 ∧ active 检索闸不得放宽；测例登记各包 `tests/index.md`。

## Answer

19 行全部补到实质断言，新增 **38 条 `it`**；四包测试 + `check-types` + `lint` 全绿。新增共享夹具 `apps/worker/tests/ingest/_support/ingest-harness.ts`（内存 db + mock ES 全链跑法，非测例、按闸口径不入表）。

**按行**

- **L1** `dual-ready-embeddings-parity`：MD 与有文本层 PDF 走 `scan→parse→chunk→embed→es_index` 到 ready，断言 `chunk 行 ≡ manifest ≡ PG chunk_embeddings ≡ mock ES 集`（同 `indexVersion`）、逐块正文非空。
- **L2** `es-fail-not-ready`：`INGEST_ES_MODE=fail` → `ES_INDEX_FAILED`、`esReady=0`、`status=failed`，**向量已写仍不可检索**；对照 mock ES 才 ready。
- **L3** `es-retry-recover`：失败后同 version 重试成功 → ready 且对账 `missing/orphan=0`、**不重分块**；负向多块 → `ES_RECONCILE_FAILED` + `orphan=1`。
- **L4** `reindex-atomic-switch`：v1 在跑时重索引 —— chunk/embed 期间 `activeIndexVersion` **仍是 1**、ES 只见完整 v1；仅双就绪那条 UPDATE 同时写 `indexVersion/activeIndexVersion/esReady/status=ready`（**唯一一条激活 patch**）；失败路径不动激活版。
- **L5** `job-ledger` 补 1 条：账本 inserted `chunk→embed→es_index`（队列均 `sr-ingest`）、updated 落 `nextStage` 链与 `terminal`、文档 `statusSeq = chunking→embedding→indexing_es→ready`。
- **L9** `embed-es-order`：两文档串行链恒为 embed→es_index；未 embed 就 es_index → `EMBED_NOT_READY`；静态守卫钉死「`'es_index'` 字面量只在 `pipeline.ts`」「`INGEST_STAGES` 顺序」「`embedReady!==1 → EMBED_NOT_READY`」。
- **M1** `complete-size-http`：Head 超限 → 413 且 `markCompletePending` **零调用**、正文未读；限额内对照 200。
- **M5/M6** `complete-head-authority`：`declaredByteSize` 声称小仍 413、声称超大也放行合规对象；upload-url 的 `maxBytes` 只是展示值，**不替代 Head 闸**。
- **M2** `scan-infected-effects`：mock infected → `MALWARE`、对象已删、无 manifest/向量/Mongo 正文、`statusSeq=scanning→failed`（不进 parse）；对照 mock_clean 不删对象。
- **Q2** `pdf-text-to-ready`：PDF 文本层 → `extractMethod=pdf_text` → 双就绪 ready 且三集合一致。
- **Q1** `ask/needs-ocr-not-retrievable`：`needs_ocr ∧ active` 语料装载为空 → 200 `kb_not_ready`、无 citation；`admin/ops/documents-needs-ocr`：列表显示「需 OCR」、不出「上架 active」。
- **Q5** `contracts/async/ingest-job` 补 1 条（stage 不重复、scan 先于 ocr、物理队列 `sr-ingest` 不与 stage 重名）+ `worker/ocr-gate` 补 1 条（`MALWARE` 与 `OCR_*` 码表分列不重复）。
- **Q10** `scan-vs-ocr-startup`：`on` 任意 APP_ENV 拒绝、staging/production 连 mock/off 也拒绝；OCR 侧未开闸在 dev 无告警、staging 缺 ADR_REF 只告警；并静态守卫 `env.ts` / `index.ts` 的挂载点。
- **V1** `complete-no-scan-enqueue`：complete 200 → `approval_status=pending` 且 `enqueueIngest` **零调用**。
- **V2** `ask/pending-not-retrievable`：pending/uploaded/draft 语料为空 → `kb_not_ready`；ready 但 draft 仍不可检。
- **V6/V8** `no-forged-ready`：PATCH 夹带 `status=ready` → 400 且 `patchMeta` 零调用；`/documents/:docId/status` → 404；未批 scan 403 不入队；approve 后 PATCH active → 409、再夹带 status 仍 400。
- **AA6** `reindex-version`：入队载荷 `stage=chunk` 且键集恰为 `docId/kbId/tenantId/stage`（**无 `indexVersion`**，避免 idempotency 走 `resume_embed`）；响应 DTO 无该字段。

**四处「无法断言」如实记录（未写假绿）**

1. **L5 半句「api 入队写 `queued` 行」无落点**：`apps/api/src/services/queue.ts:57-61` 的 `enqueueIngest` 只 `q.add(stage, data)`、**不写 `ingest_jobs`**；api 侧只读 worker 写的行。要坐实须先裁口径（是否让 api 入队即写账本）→ 属源码变更。
2. **L2/L3/Q2 的「ask 检不到」串联受落点约束**：worker 侧以 `isDefaultRetrievable`（`packages/db/src/query/retrieval-gate.ts`）+ 既有 api 装载主锚表达，未另建 api 用例。
3. **V6 的 Then 写「不存在或 403」，实测为 400 + 404**（schema 无 `status` 字段即拒）——**没有**为凑 403 去放宽 schema。
4. **Q10 的「缺 OCR 引擎仍可启动」不真启进程**（真进程非单测），以启动校验层对照 + 源码守卫表达。

**验证**：worker **47 文件 / 212 通过**（原 39/193）· api **155 / 935 + 3 skip**（原 148/919）· contracts **27 / 225**（+1）· admin **36 / 175**（+2）；`check-types` 8/8；`lint` 8/8 零 warning。四份 `tests/index.md` 已登记。

**边界**：默认 mock 未被标成生产 ES / 真杀毒；「双就绪 ∧ active 检索闸」「门禁只加严不放宽」未放宽；未改任何源码。

**连带**：本批落地后按工单 [12](./12-research-writeback-countercheck.md) 的反向复核结论，`coverage/01-ingest.md` 的 19 行由 `部分测` 改为 `已测`（其中 V4 因 Then 含「其后 M/L 链可绿」而**退回 `部分测`**并写明分段证据）。
