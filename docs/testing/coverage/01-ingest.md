# 覆盖分册 · ingest

> 入口：[../coverage.md](../coverage.md)
> 期望原文：[prds/10-delivery/03-acceptance-scenarios.md](../../../prds/10-delivery/03-acceptance-scenarios.md) 剧本 E/L/M/Q/V/AA
>
> 判定以测例断言为准。默认 mock ES / mock scan **不得**写成生产 ES 或真杀毒已测。L8 主锚在 api corpus（P0 R7），worker / db 只作生命周期附录，不按三份已测重复计。

## 剧本 E · 入库与生命周期

阶段口径：lifecycle / 双闸属 **P2必签**；近重复、删除/archived 三存对齐以源码为准。

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| E1 | ready+active 可查（ES 可查文号） | P2必签 | 单测 | 部分测 | api | apps/api/tests/ask/ready-active-corpus.test.ts（R7：仅 `ready∧active` 进检索集）；packages/db/tests/retrieve/ready-active-gate.test.ts（附录） | 阻塞方：真 ES 部署（B8 / OPS-1）。未断言入库后 ES 可查文号；默认 `RETRIEVE_ES_MODE=mock`，mock ES 只比对 chunkId 集合 → 离线最多断言 bulk 载荷含正文，≠ 生产 ES |
| E2 | supersede 旧版：lifecycle=superseded，ask 不得引用旧版 | P2必签 | 单测 | 部分测 | api | apps/api/tests/ingest/document-supersede.test.ts（POST 写两列；替代后 `filterDocsForRetrieve` 只留后继）；apps/api/tests/ask/ready-active-corpus.test.ts（`superseded` 被滤） | 阻塞方：真 ES 命中（同 E1）。写两列 + 只留后继 + `superseded` 被滤已测；未与 ES 命中串联。PATCH lifecycle 仍可无后继废止 |
| E3 | 删除/archived：ES/Mongo/PG 对齐 | 源码为准 | 单测 | 部分测 | api · worker | packages/db/tests/retrieve/ready-active-gate.test.ts（`lifecycle=archived` 不可检）；apps/api/tests/ingest/document-delete.test.ts（DELETE archived 入队 purge；PATCH 不入队；语料不含该文）；apps/worker/tests/ingest/purge.test.ts（对象 + mock ES drop） | PATCH archived 仍不入队。无 PG 硬删 / chunk 清扫 / HTTP ES `_delete_by_query`。默认 mock ES |
| E4 | 跨 doc 近重复：指标可见；pending_review 可人工处理 | 源码为准 | 单测 | 已测 | worker · api | `cross-doc-dedupe.test.ts` · `cross-doc-skip-index.test.ts`（同 KB Jaccard≥0.9 skip_index + 报告冲突对；archived/跨 KB 不比）· `apps/worker/tests/ingest/cross-doc-pending-review.test.ts`（pending_review 落库入审、不入 manifest）· `apps/api/tests/ingest/dedupe-conflict-resolve.test.ts`（人工二选一 HTTP：winner=this/other、非待审 400、坏 body 400） | —（生产 MinHash LSH 非本阶段） |
| E5 | L1 故障 → L0 回退仍 ready | P2必签 | 单测 | 已测 | worker | `apps/worker/tests/ingest/contextualize-fallback-ready.test.ts`：正例 `context_source=l1_llm`；HTTP 500 / 503、畸形响应、空白输出、AbortError 五类故障 → `l0_fallback` 且文档仍 `ready`。附 `context-mode-obey.test.ts`（快照 / 缺省 `l0_template` 记 `l0`） | —（真 Gateway / 真 429 属 B4 live，不在本行 Then） |
| E6 | 无 active 文档时 ask → 200 `status=abstained` `reason=kb_not_ready` | P2必签 | 注入 | 已测 | api | apps/api/tests/ask/http-stream.test.ts（`kb_not_ready → 200` 拒答信封，同步+SSE；`KB_NOT_READY` 不进 `error.code`）；apps/api/tests/ask/retrieve-run.test.ts（空 corpus / 无 ready∧active → `kb_not_ready`） | — |

## 剧本 L · 入库末段双就绪与清单冻结（P2必签 · ADR-038）

通过：L1–L9 试点必签（L9 可用架构/单测代替人工 UAT）。

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| L1 | 样例 MD/PDF → ready；该 `index_version` 下每个 searchable chunk：PG 向量与 ES 均存在，chunkId 集合一致 | P2必签 | 单测 | 已测 | worker | `apps/worker/tests/ingest/dual-ready-embeddings-parity.test.ts`（MD 样例与「有文本层 PDF」各跑 scan→parse→chunk→embed→es_index → `status=ready`；同一 version 下 chunk 行集 ≡ 冻结 manifest ≡ PG `chunk_embeddings` ≡ mock ES 集，searchable chunk 正文非空）· apps/worker/tests/ingest/dual-ready-index.test.ts（mock ES 集合一致才 reconcile ok）；apps/worker/tests/ingest/embed-es-serial.test.ts（半就绪禁 ready） | —（样例到 ready 与三集对账已断言；默认 `INGEST_ES_MODE=mock`，≠ 生产 ES） |
| L2 | mock ES bulk 失败 → 文档非 ready；默认 ask 检不到（即使向量已写） | P2必签 | 单测 | 已测 | worker | `apps/worker/tests/ingest/es-fail-not-ready.test.ts`（注入 `INGEST_ES_MODE=fail`：向量行已写仍 `esReady=0` / `status=failed` / `ES_INDEX_FAILED`、状态链从未出现 ready、`isDefaultRetrievable` 为 false；对照 mock ES 同夹具才 ready）· apps/worker/tests/ingest/dual-ready-index.test.ts · apps/worker/tests/ingest/embed-es-serial.test.ts | —（「检不到」走 ask 同一 L0 谓词 `isDefaultRetrievable`；ask HTTP 侧见 `apps/api/tests/ask/ready-active-corpus.test.ts`。默认 mock ES，≠ 生产 ES） |
| L3 | 重试 ES 成功 → ready；对账无「仅一边有」告警 | P2必签 | 单测 | 已测 | worker | `apps/worker/tests/ingest/es-retry-recover.test.ts`（fail → 同 version 重试成功 → `ready`；manifest 冻结集不变、`reconcileMissing/reconcileOrphan = 0`、`dualReady=1`；负向：ES 侧多出 chunk → `ES_RECONCILE_FAILED` 且 `reconcileOrphan=1`、不得假 ready）· apps/worker/tests/ingest/idempotency.test.ts | —（重试恢复与「仅一边有」双向对账已断言；默认 mock ES，≠ 生产 ES） |
| L4 | 重索引 N+1：仅 N+1 双就绪后原子切换；瞬间只见 N 或 N+1；N 不被半套污染 | P2必签 | 单测 | 已测 | worker | `apps/worker/tests/ingest/reindex-atomic-switch.test.ts`（v1 在跑 → reindex：chunk/embed 期间 `activeIndexVersion` 仍 1 且 ES 只有 v1；仅 es_index 双就绪那一条 UPDATE 同写 `indexVersion=2` / `activeIndexVersion=2` / `esReady=1` / `status=ready`，激活 patch 恰 1 条；v1 的 chunk / 向量 / ES 集原样保留；负向：新版本 ES 失败 → active 仍 1、不产生 v2 激活 patch） | —（原子切换 + 旧版不被污染 + 失败路径已断言；默认 mock ES，≠ 生产 ES） |
| L5 | 阶段可观测：Bull Board / ingest_jobs 可见 `embedding` → `indexing_es` → `ready` | P2必签 | 单测 | 已测 | worker | `apps/worker/tests/ingest/job-ledger.test.ts`（新增阶段链用例：账本 jobName 依次 `chunk` → `embed` → `es_index`、物理队列恒 `sr-ingest`、终态 `succeeded` 且 payload 带 `nextStage`/`terminal`；文档状态链 `chunking` → `embedding` → `indexing_es` → `ready`）· apps/api/tests/ingest/jobs-query.test.ts（列表映射不改写 status） | —（账本行链序已断言；**无** Bull Board UI，账本行等价可见面；账本仍无 api 入队 `queued`） |
| L6 | 重试不分块：embed 重试前后 chunkId 集合不变（manifest 冻结） | P2必签 | 单测 | 已测 | worker | apps/worker/tests/ingest/idempotency.test.ts（有 version+manifest → `resume_embed` 不抬 version；缺 embedding 只补缺；无 manifest → `NO_MANIFEST`） | — |
| L7 | 孤儿清理护栏：半写非激活 version 被清理 job 清掉；不碰当前激活版 | P2必签 | 单测 | 部分测 | worker | `apps/worker/tests/ingest/orphan-clean.test.ts`（激活版 / 在飞版 / 无激活表示三反例 + 清 v1 双侧正例 + ES 侧不可用跳过）· `orphan-clean-on-failure.test.ts`（failed 触发清理、吞错不改阶段结果）· 源码 `apps/worker/src/ingest/orphan-clean.ts` | 剩「周期触发」未落地（本仓无调度基建）+ 真 ES 侧清理属 B8（`INGEST_ES_MODE != mock` 时整体跳过，见 `orphan-clean.ts:9`）；清理现由 failed 阶段触发 |
| L8 | 双闸门：ready+draft 不进默认检索；发布 active 后可检；非 ready 绝不检 | P2必签 | 单测 | 已测 | api | **主锚** apps/api/tests/ask/ready-active-corpus.test.ts（P0 R7：draft / superseded / 非 ready 被滤，仅 active∧ready 留下）。生命周期附录：apps/worker/tests/ingest/dual-ready-index.test.ts（入库期 mock ES 对账）；packages/db/tests/retrieve/ready-active-gate.test.ts（纯函数）。另 apps/api/tests/ingest/approval-scan.test.ts（非 ready 不得 active）；apps/api/tests/ingest/gates-live.test.ts（非 ready PATCH active → 409 `CONFLICT`，无 Docker 时 skip） | 附录不按三份已测重复计。默认 mock ES，≠ 生产装载后的 ES 命中 |
| L9 | 顺序一致：全仓均为 embed→es_index（无文档间混序） | P2必签 | 单测 | 已测 | worker | `apps/worker/tests/ingest/embed-es-order.test.ts`（两文档串行：`chunk.next.stage` 恒 `embed`、`embed.next.stage` 恒 `es_index`；未 embed 先跑 es_index → `EMBED_NOT_READY` 不写 ES；A 的 es_index 不带 B ready；静态守卫：`'es_index'` 字面量只出现在 `pipeline.ts`、`enqueueNext(…'es_index')` 恰 1 处、`INGEST_STAGES` 中 embed 先于 es_index）· apps/worker/tests/ingest/embed-es-serial.test.ts | —（链序 + 文档间不混序 + 静态入队点唯一已断言；默认 mock 栈，≠ 生产 ES） |

## 剧本 M · 上传大小与病毒扫描闸（P2必签 · ADR-039）

通过：M1–M8 试点/staging 必签；M9 开发环境；M10 配置单测可替代部分人工。

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| M1 | 上传 > 50 MiB 合法 PDF：complete 拒绝（413 / `PAYLOAD_TOO_LARGE`）；PG 无成功进入 parse 的 `uploaded` 成功路径 | P2必签 | 单测 | 已测 | api | `apps/api/tests/ingest/complete-size-http.test.ts`（handler 路径：Head 报超限 → 413 `PAYLOAD_TOO_LARGE` + `details={maxBytes,actual}`，且体积闸先于正文读取与落库：`markCompletePending` 零调用、`getObjectBuffer` 零调用 → PG 无 `uploaded` 成功路径；对照：同 handler 限额内 → 200 且落 `pending`）· apps/api/tests/ingest/complete-size.test.ts（纯函数）· apps/api/tests/ingest/gates-live.test.ts（无 Docker 时 skip） | —（413 + 无成功路径已断言；mock 仓 / 无真存储） |
| M2 | ≤ 上限 EICAR 或 mock infected：`scanning` → 不 parse；Mongo 无权威 body；无 `chunk_manifest`；`failed`+`MALWARE`；对象已删；审计可查 | P2必签 | 单测 | 部分测 | worker | `apps/worker/tests/ingest/scan-infected-effects.test.ts`（`mock_infected`：状态链 `['scanning','failed']`、`MALWARE` 不可重试且 `next` 为空、对象 `deleteObject` 已删、manifest / chunks / 向量 / ES / 报告全空、Mongo `upsertDocumentBody` / `upsertChunkBodies` 零调用；对照 `mock_clean` 不删对象并入队 `parse`）· 源码 `mock_infected` 删对象路径（apps/worker/src/ingest/pipeline.ts）· idempotency.test.ts / bull-outcome.test.ts（`MALWARE` 不可重试，禁止当 clean 重投） | 本批已补：不 parse / 无 Mongo body / 无 manifest / 对象已删 逐条断言。**Then 末段「审计可查」仍无落点**（同 M8：仓内无 hash + uploaderId 审计面，只有阶段账本 `failed` 行）→ 本行保持 `部分测`。≠ 真杀毒（QUAL-2 未接） |
| M3 | mock clean：`scanning → parsing → … → 双就绪 ready`（与 A/L 衔接仍绿） | P2必签 | 单测 | 已测 | worker | apps/worker/tests/ingest/mock-clean-stage-chain.test.ts | 内存仓驱动 scan→…→es_index；ready+draft。≠ 生产扫描 / ≠ 真杀毒 |
| M4 | prod/staging 关闭/缺失扫描引擎配置：worker 启动失败（fail closed）；不进入「可上传无扫描」灰态 | P2必签 | 单测 | 已测 | worker | apps/worker/tests/ingest/scan-startup-policy.test.ts（任意 `APP_ENV` 下 `on` 拒绝；staging/production 禁止 `mock_*`/`off`）；apps/worker/tests/ingest/scan-runtime-block.test.ts（运行时 `on` 不得当 clean） | 真引擎仍未接：staging/production 当前无合法扫描配置（见 docs/module-status/worker.md）。≠ 真杀毒已测 |
| M5 | 仅前端改大 limit：complete 仍 Head 校验 → 超大对象不能入库 | P2必签 | 注入 | 已测 | api | `apps/api/tests/ingest/complete-head-authority.test.ts`（客户端声称 `declaredByteSize=1` 不改变判定：Head 超限 → 413 且 `markCompletePending` 零调用；反向对照：Head 合规而客户端声称超大 → 200，服务端不采信客户端声明）· gates-live.test.ts（无 Docker 时 skip） | —（客户端声明两个方向均已对照；mock 仓 / 无真存储） |
| M6 | 预签名无 max body 能力：complete 仍拦超限（不依赖预签名） | P2必签 | 注入 | 已测 | api | `apps/api/tests/ingest/complete-head-authority.test.ts`（upload-url → 201 且回 `maxBytes` 仅展示值；客户端无视提示写超限再 complete → 仍 413、不落 pending）· complete 以 Head 为权威闸（apps/api/src/routes/documents/index.ts） | —（upload-url 的 `maxBytes` 不替代 complete 已断言；无真预签名 / 无真存储） |
| M7 | 引擎瞬时 5xx：有限重试 → 恢复 clean 则 parse；或耗尽 `failed`；不当 clean 静默放行 | P2必签 | 单测 | 缺实现 | worker | 真引擎未接。`on` → `SCAN_ENGINE_UNAVAILABLE` 不可重试（idempotency / scan-runtime-block）；无 5xx 重试矩阵 | ≠ 真杀毒。无引擎 5xx 有限重试 / 耗尽 failed / 禁静默放行 |
| M8 | infected 删除后：RustFS 无残留；无隔离区；审计含 hash + uploaderId + timestamp | P2必签 | 单测 | 部分测 | worker | 源码 `deleteObject` 删本地或 S3 key（apps/worker/src/ingest/object-store.ts）；MALWARE 终态见 M2 测例 | 源码侧待定：先裁清哪一侧错，再决定改源码还是回 PRD 裁口径。`apps/worker/src/ingest/object-store.ts` 只有 `deleteObject`，「审计含 hash + uploaderId + timestamp」无落点；已过期项：`uploaded_by` 已在 `apps/api/src/routes/documents/index.ts:361` 与 `apps/api/src/services/ingest-complete-pending.ts:309` 写入。「对象已删」可离线断言。≠ 真杀毒。禁止写成「待补测」 |
| M9 | dev `INGEST_SCAN_MODE=mock_clean` 可走完 scanning→parsing；单测/文档标非生产 | 开发环境 | 单测 | 已测 | worker | apps/worker/tests/ingest/scan-startup-policy.test.ts（development/test 允许 `mock_clean` / `mock_infected` / `off`） | 允许启动 ≠ 已测走完 parsing。文档/module-status 已标 mock、非生产 |
| M10 | 改配置上限（如 80 MiB）：预签名（若支持）/ complete / 中转同一配置源同步生效 | 配置单测可替代 | 单测 | 部分测 | api | `effectiveMaxUploadBytes()` = min(`INGEST_MAX_FILE_BYTES`, `INGEST_MAX_FILE_BYTES_CEILING`)；upload-url / PUT / complete 共用；complete-size 用默认 52_428_800 | 无「改 80 MiB 三处同步」单测；无预签名 max-body 能力 |

## 剧本 Q · OCR 节奏与扫描件硬闸（P2契约 · ADR-043）

通过：Q1–Q5、Q10 为 **P2必签**；Q6–Q9、Q11–Q12 在启用 OCR 或 P5 开闸时签。

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| Q1 | 纯扫描 PDF 且 OCR 关 → `needs_ocr` + `NO_TEXT_LAYER`；默认 ask 检不到；admin 列表可见 | P2必签 | 单测 | 已测 | worker · api · admin | apps/worker/tests/ingest/pdf-text.test.ts（无算子 PDF → null）；apps/worker/tests/ingest/extract-text.test.ts（pdf 字节 → `NO_TEXT_LAYER`，不当 utf8 垃圾）；apps/worker/tests/ingest/ocr-gate.test.ts（关闸不入队 ocr）；源码 parse 写 `status=needs_ocr`；`apps/api/tests/ask/needs-ocr-not-retrievable.test.ts`（`needs_ocr` 即使 lifecycle=active 也不进语料 → ask 200 拒答 `kb_not_ready`、零引用；对照置 ready 后可答）；`apps/admin/tests/ops/documents-needs-ocr.test.tsx`（列表显示「需 OCR」+ `needs_ocr · draft`、向量/稀疏未就绪、不得出现「上架 active」） | —（三条 Then 均已断言；`INGEST_OCR_ENABLED` 默认 false；默认 mock ES，≠ 真 OCR 引擎） |
| Q2 | 有文本层制度 PDF → 可 ready（双就绪后）；active 后成员 ask 可检索 | P2必签 | 单测 | 已测 | worker · api | `apps/worker/tests/ingest/pdf-text-to-ready.test.ts`（有文本层 PDF 跑 scan→parse→chunk→embed→es_index → `extractMethod=pdf_text`、双就绪 `ready` 但 `lifecycle=draft`；chunk ≡ 向量 ≡ mock ES 三集一致；`isDefaultRetrievable` draft 拒 / active 放行）· apps/worker/tests/ingest/pdf-text.test.ts（未压缩 Tj 可抽出文本层）· ask 侧对照 `apps/api/tests/ask/needs-ocr-not-retrievable.test.ts`（ready ∧ active 才可作答并引用） | —（ready + 双就绪 + 上架后可检已断言；默认 mock ES，≠ 生产 ES） |
| Q3 | 「仅页眉 ~20 字符」夹具 → 不得 ready；不得物化成功用的空/近空 manifest | P2必签 | 单测 | 已测 | worker | apps/worker/tests/ingest/header-too-short.test.ts | ~20 字 → needs_ocr + NO_TEXT_LAYER；不得 chunk/ready / 成功 manifest |
| Q4 | parse 后全文过短（< 阈值 / `minPassageChars` 量级）→ 不得进 chunk/ready | P2必签 | 单测 | 已测 | worker | `apps/worker/tests/ingest/header-too-short.test.ts`（低于 `INGEST_MIN_EXTRACTED_CHARS` 默认 40 → `needs_ocr` + `NO_TEXT_LAYER`，不得 chunk / ready）· `split-paragraphs.test.ts`（过短片段丢弃、空白壳 → `[]`） | — |
| Q5 | `ingest.scan` 与 `ingest.ocr` 逻辑 stage 隔离（interim 单物理队列不混 stage）；`MALWARE` 与 `OCR_*` / `NO_TEXT_LAYER` 不混用 | P2必签 | 契约+单测 | 已测 | contracts · worker | `packages/contracts/tests/async/ingest-job.test.ts`（stage 闭集无重复、无点号伪 stage、每个 stage 可单独解析为 job 载荷；`QUEUE_NAMES.INGEST='sr-ingest'` 且不与任何逻辑 stage 重名）· `apps/worker/tests/ingest/ocr-gate.test.ts`（注入三态：scan 感染只出 `MALWARE`、parse 无文本层出 `NO_TEXT_LAYER`、ocr stage 出 `OCR_UNAVAILABLE`，互不相等；`NON_RETRYABLE_INGEST_CODES` 内 `OCR_*` 四码与 `MALWARE` 分列且无重复） | —（stage 隔离与错误码分码两侧均已断言；无独立物理 `ingest.ocr` 队列属 interim 折叠，非缺口；≠ 真引擎） |
| Q6 | 若启用 OCR：body 在 chunk_manifest 物化前定稿；禁 ready 后 patch body | 启用 OCR 或 P5 | 单测 | 延后 | worker | 无 OCR 引擎；无 ready 后 patch body 路径 | 待 OCR 开闸再签 |
| Q7 | `needs_ocr` 文档 OCR 上线后重跑 → 新 indexVersion 全链路 + 双就绪 + 原子切换；旧 version 无脏残留 | 启用 OCR 或 P5 | 单测 | 部分测 | worker · api | apps/api/tests/ingest/ocr-rerun-http.test.ts（needs_ocr/needs_review reindex 入队 ocr）；apps/worker/tests/ingest/ocr-rerun.test.ts（注入全链 ready 且抬 version；失败不抬；utf8 拒抽） | 注入抽取器；≠ 真引擎。无启动自动全库。无旧 version 孤儿清理（L7 仍缺实现） |
| Q8 | （OCR 已启）低置信夹具 → `failed` / `needs_review`，非 ready | 启用 OCR 或 P5 | 单测 | 部分测 | worker | apps/worker/tests/ingest/ocr-gate.test.ts（注入低置信 → `needs_review` + `OCR_LOW_CONFIDENCE`） | 注入抽取器；≠ 真引擎低置信。无 `failed` 终态（用 needs_review） |
| Q9 | staging `INGEST_OCR_ENABLED=true` 无 `INGEST_OCR_ADR_REF` → 启动告警；dev 可 dogfood 标 `dogfood_ocr` | 启用 OCR 或 P5 | 单测 | 部分测 | worker | apps/worker/tests/ingest/ocr-gate.test.ts（`ocrStartupWarning`）；`index.ts` 启动 warn | 纯函数告警；无进程启动 listen 测。无 `dogfood_ocr` 标签字段 |
| Q10 | P2 部署不因缺 OCR 引擎启动失败（对照缺杀毒引擎 fail closed） | P2必签 | 单测 | 已测 | worker | `apps/worker/tests/ingest/scan-vs-ocr-startup.test.ts`（对照断言：杀毒侧 `on` 在任何 `APP_ENV` 拒启动、staging/production 连 `mock_*`/`off` 也拒；OCR 侧未开闸与 dev 开闸无告警、staging 缺 `INGEST_OCR_ADR_REF` 只 warn；`env.ts` `superRefine` 只挂 scan 策略 + 栈校验、不含 OCR，`INGEST_OCR_ENABLED` 默认 false；OCR 告警不得升级为 `process.exit`）· worker env 无 OCR 必填 · extract-text / pdf-text 不依赖 OCR 引擎 | —（启动口径对照已断言；纯函数 + 源码读，非真进程 listen） |
| Q11 | （前瞻）敏感 KB Cloud OCR 明文 → 拒或策略跳过 OCR 只收文本层 | 启用 OCR 或 P5 | 单测 | 延后 | api | 无 Cloud OCR | 待 OCR 开闸再签 |
| Q12 | 文档：OCR 默认 P5；提前须会签+ADR 有书面痕迹 | 启用 OCR 或 P5 | 文档护栏 | 延后 | — | PRD ADR-043 / 入库 §2.2 已写默认 P5；无 docs-guard 锁该句 | 待 P5 / 提前会签时签；无护栏测 |

## 剧本 V · 审批中心与入库闸（P2必签 upload · ADR-048）

通过：V1–V6、V8 为 **P2必签**；V7 随 BlockNote 交付签。

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| V1 | write complete 合法文件：对象登记；`approval_status=pending`；无 `ingest.scan` job | P2必签 | 注入 | 已测 | api | `apps/api/tests/ingest/complete-no-scan-enqueue.test.ts`（complete 200 → `approval_status=pending` / `status=uploaded`、`markCompletePending` 恰 1 次、`enqueueIngest` **零调用**；对照：未批 `POST /scan` → 403 且不入队，批后 → 200 且只入队 `{stage:'scan'}`）· 源码 complete 只 `markCompletePending`，不 `enqueueIngest` · gates-live.test.ts（无 Docker 时 skip） | —（「未入队 scan job」已直断言；mock 队列，无真 Redis） |
| V2 | 未审批时查文档：非 ready；默认 ask 不可检 | P2必签 | 单测 | 已测 | api | `apps/api/tests/ask/pending-not-retrievable.test.ts`（pending ∧ uploaded ∧ draft：`filterDocsForRetrieve` 为空 → ask 200 拒答 `kb_not_ready`、`answer=''`、零引用；已 ready 但未上架同样不可检；对照 ready ∧ active 才 answered 并引用该文档）· apps/api/tests/ingest/approval-scan.test.ts（pending/none/rejected 不可 scan；uploaded/needs_ocr 不得 active）· gates-live.test.ts（非 ready PATCH active → 409） | —（未审批 / 未上架 / 对照三条均已断言；默认 mock ES） |
| V3 | 提交人 approve 自己的 ticket（默认配置）→ 拒绝（禁自审） | P2必签 | 单测 | 已测 | api | `apps/api/tests/ingest/no-self-approve.test.ts`：自审 approve / reject 均 403 且不写库；他人 approve 200 并记审批人；无 actor 时不误伤 | — |
| V4 | 另一 kb admin approve → 入队 scan；其后 M/L 链可绿 | P2必签 | 注入 | 部分测 | api | `apps/api/tests/ingest/approve-then-scan.test.ts`（approve 200 → scan 200 + `enqueueIngest({stage:'scan'})`）· `no-self-approve.test.ts:116`（他人 approve 200）· approvals-workspace.test.tsx（有 decide 可点通过） | 前半「approve → 入队 scan」已测；Then 后半「其后 M/L 链可绿」**仍无由该 approve 起步的串联**，只有分段证据（M3 内存链 + L1/L6/L8/L9，见各行）；未断言 approve 之后跑完整条 M/L |
| V5 | admin reject：不 scan；可重提 | P2必签 | 单测 | 部分测 | api | apps/api/tests/ingest/reject-http.test.ts | 源码侧待定：先裁清哪一侧错，再决定改源码还是回 PRD 裁口径。`apps/api/src/routes/documents/index.ts` 无 rejected→pending 重提端点（PRD 未定义该端点）；已测部分：reject 200 后 scan 403 且不入队。禁止写成「待补测」 |
| V6 | 伪造「跳过审批直写 ready」API → 不存在或 403 | P2必签 | 单测 | 已测 | api | `apps/api/tests/ingest/no-forged-ready.test.ts`（PATCH `/documents/:docId` 夹带 `status=ready` → 400 且不写仓；`PATCH /documents/:docId/status` 无路由 → 404；未批 `POST /scan` → 403 `FORBIDDEN` 且 `enqueueIngest` 零调用）· 无 PATCH status=ready 路由；worker 任意 stage 未批准 → `NOT_APPROVED`（不可重试）· canEnqueueScan 未批为 false | —（夹带 / 无路由 / 未批闸三条负向均已断言） |
| V7 | BlockNote 提交发布 → approve：服务端导出 MD；编辑者 UI 无强制导出步骤；进 scan 链 | P2.x | 单测 | 部分测 | api · admin | apps/api/tests/ingest/write-document-http.test.ts（Markdown write → pending + `sourceType=write`，不入队 scan）；apps/admin/tests/ops/document-write.test.ts · documents-workspace.test.tsx（`doc.editor` 编写区） | 无 BlockNote；无草稿 HTTP；仍走审批后 scan，不自动入队 |
| V8 | approve 后跳过 scan 标 ready → 禁止 | P2必签 | 单测 | 已测 | api | `apps/api/tests/ingest/no-forged-ready.test.ts`（approve 200 后 `PATCH …/lifecycle {lifecycle:'active'}` → 409 `CONFLICT` 且不写 lifecycle；同轮夹带 `status=ready` → 400 且不写仓）· apps/api/tests/ingest/approval-scan.test.ts（仅 `status=ready` 可 active）· ready 仅 worker es_index 双就绪写入 | —（approve ≠ ready 的 HTTP 负向已断言；ready 仍只由 worker 双就绪写） |

## 剧本 AA · 分片策略与 reindex（P2必签 · ADR-053 / ADR-059）

通过：AA1–AA7 **P2必签**；AA8 与 OCR 开关环境一致即可。

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| AA1 | 改 KB 某策略参数并保存：200；有审计日志；旧文档 chunk 边界/version 不变 | P2必签 | 单测 | 已测 | api | `apps/api/tests/kb/chunk-strategy-preserves-docs.test.ts`（PATCH 参数后既有文档 `index_version` / chunk 边界逐字段不变 + 审计一行 + 反向对照「什么改动文件流程」）；另 `tests/kb/chunk-strategies-http.test.ts`（启用/recommended 可写）；admin 弹窗声明不自动 reindex | —（旧文档不变 + 审计已断言；动态 paramSchema 引擎与审计查询面不在本张最小闭环） |
| AA2 | 新上传类型仅 1 策略 → 自动该策略；流水线用其参数快照 | P2必签 | 单测 | 已测 | api | `tests/ingest/reindex-strategy.test.ts`（complete 未带 → 200 auto + params 快照）；`chunk-strategies.test.ts` 绑定仅 1 个自动 | 可写集仍仅 `structure_paragraph` |
| AA3 | 新上传类型 ≥2 策略且未选 → 400 | P2必签 | 契约 | 已测 | api | `tests/ingest/chunk-strategies.test.ts`（`resolveBindChunkStrategy` ≥2 未传 → required） | P2 仅 1 个已实现，HTTP 多策略要等第二套 worker 算法 |
| AA4 | 同上选 recommended 或另一策略 → 200 进审批/流水线；文档记录 `chunk_strategy` | P2必签 | 注入 | 已测 | api | complete 显式已实现 → 200 落库；for-upload 带 `recommendedCode`；未实现码 400 | 可写集仅 `structure_paragraph` |
| AA5 | 文档列表点 Reindex，类型多策略且 body 无 `chunkStrategy` → 400 `VALIDATION_ERROR` | P2必签 | 注入 | 已测 | api | apps/api/tests/ingest/reindex-strategy.test.ts（reindex 未带 → 400，message `/chunkStrategy is required/i`，不写库）；路由 `BizCode.VALIDATION_ERROR` | 测例未直断言 `error.code=VALIDATION_ERROR`（status 400 + 文案已覆盖） |
| AA6 | 传合法 `chunkStrategy` 后 reindex：新 indexVersion；成功后检索用新切块 | P2必签 | 注入 | 部分测 | api · worker | `apps/api/tests/ingest/reindex-version.test.ts`（reindex → 200，入队载荷恰为 `{docId,kbId,tenantId,stage:'chunk'}` 且**不带** `indexVersion`（带旧 version 会走 idempotency `resume_embed` 跳过重分块）；响应 DTO 无 `indexVersion`；api 不改文档 version / ready 位）· `apps/worker/tests/ingest/reindex-atomic-switch.test.ts`（worker 侧 v1→v2：仅双就绪那一条 UPDATE 抬 `indexVersion` 并原子切 `activeIndexVersion`）· apps/api/tests/ingest/reindex-strategy.test.ts | 本批已补「api 入队契约 + worker 抬版本」两侧。**Then 末段「成功后检索用新切块」仍无测例**（语料按 `doc.indexVersion` 过滤在 `apps/api/src/services/retrieve/corpus.ts:110` 有实现，无断言）→ 本行保持 `部分测` |
| AA7 | 无 `kb.config.write` 改策略配置 → 403 | P2必签 | 单测 | 已测 | api | `tests/kb/chunk-strategies-http.test.ts`（`doc_operator` 列表 403）；settings 总闸仍在 `settings-http.test.ts` | — |
| AA8 | OCR 策略在 OCR 未启用时：不可选或选后 `needs_ocr`（服 043）；不因此 P2 启引擎 | 与 OCR 开关一致 | 单测 | 延后 | api | `KNOWN_CHUNK_STRATEGY_CODES` 无 OCR 策略；worker 无 OCR 引擎（对照 Q10） | 无 OCR 策略码可选；待 OCR 开闸与开关对齐 |

## 本分册计数

行数须与上表合计一致（E6 + L9 + M10 + Q12 + V8 + AA8 = **53**）。2026-09-20 按行级「阶段 + 覆盖」机械重数（第三轮：批 2 补测把 L1–L5 / L9 / M1 / M2 / M5 / M6 / Q1 / Q2 / Q5 / Q10 / V1 / V2 / V6 / V8 / AA6 由 `部分测` 起普遍上移；其中 **M2 / AA6 因 Then 仍有未断言的一截而保持 `部分测`**；V4 由 `已测` 退回 `部分测`）。

| 覆盖 | 行数 | ID |
|------|------|-----|
| 已测 | 34 | E4 E5 E6 L1 L2 L3 L4 L5 L6 L8 L9 M1 M3 M4 M5 M6 M9 Q1 Q2 Q3 Q4 Q5 Q10 V1 V2 V3 V6 V8 AA1 AA2 AA3 AA4 AA5 AA7 |
| 部分测 | 14 | E1 E2 E3 L7 M2 M8 M10 Q7 Q8 Q9 V4 V5 V7 AA6 |
| 缺测 | 0 | — |
| 缺实现 | 1 | M7 |
| 延后 | 4 | Q6 Q11 Q12 AA8 |
| UAT | 0 | — |
| **合计** | **53** | E1–E6 L1–L9 M1–M10 Q1–Q12 V1–V8 AA1–AA8 |

P2 必签且覆盖为 `缺测` / `部分测` 的行，才是下一批补测清单。`延后` / `缺实现` / `UAT` 不进欠债清单。
