# @strict-rag/worker · 测试导航

> HOW：`.trellis/spec/guides/testing.md`  
> 本包主责：入库状态机与扫描闸。入队 HTTP 在 api。  
> **存货不是覆盖。** 本表只登记本包 `src/` 与 `tests/` 下的 `*.test.ts(x)`；漏行即红。测全了没有看 `docs/testing/p0-redlines.md` 与 `docs/testing/coverage.md`（期望原文仍是验收剧本）。

## 能力

| 目录 | 能力 | 需求锚点 |
|------|------|----------|
| `ingest/` | 扫描→解析→分片→向量→稀疏索引 | `prds/04-pipelines/01-offline-ingest.md` |
| `env/` | 启动闸、可运行环境 | X-01/X-02 · DEC-SCAN |

## 测例

| 文件 | 目标 | 需求锚点 | 被测 | 简介 | 状态 |
|------|------|----------|------|------|------|
| `env/operable-overlay.test.ts` | operable overlay 与 .env.example 叠加后栈组合必须合法。 | OPS-STACK | `parseEnvAssignments · stackEnvIssues` | 解析赋值跳过注释；example 与 overlay last-wins 对齐 docker 骨架。 | 现行 |
| `env/stack-env.test.ts` | 非法 worker 栈环境组合不得通过启动校验。 | 基建: worker stackEnvIssues | `stackEnvIssues` | http 无 URL、s3 无 endpoint 失败；mock+local 与带 URL 的 http 合法。 | 现行 |
| `ingest/bull-outcome.test.ts` | 入库错误码须正确映射为可重试或不可恢复。 | prds/06-async | `assertIngestBullOutcome` | EMBED_FAILED 可重试；MALWARE 不可恢复；无码 complete。 | 现行 |
| `ingest/chunk-strategy-loud-fail.test.ts` | 已实现策略可切；未实现不得静默改走段落切。 | X-03 · B12 | `splitByChunkStrategy` | structure_paragraph 可切；fixed_window 报 UNSUPPORTED_CHUNK_STRATEGY。 | 现行 |
| `ingest/doc-lock.test.ts` | 同文档入库互斥，忙则 DOC_LOCK_BUSY。 | X-04 | `tryAcquireDocLock · releaseDocLock · withDocLock · createIoredisDocLock` | Redis SET NX EX；Lua 按 token 释放；非 Redlock。 | 现行 |
| `ingest/dual-ready-index.test.ts` | 未 ready∧active 不得进 mock ES 索引。 | 质量红线双就绪（入库期；R7 主锚仍在 api corpus） | `mockEsStore 双就绪` | mock ES 对账缺块失败；集合一致才 ok；文档间不污染。 | 现行 |
| `ingest/embed-es-serial.test.ts` | embed 与稀疏索引串行就绪，禁并行假完成。 | X-03 · prds/04-pipelines | `pipeline 串行就绪` | embedReady 与 esReady 须同时为 1。 | 现行 |
| `ingest/embed-http.test.ts` | embed HTTP 客户端须按 Gateway 契约取向量。 | prds/07-models | `embedTextsHttp · mockEmbedVector` | mock 维数稳定；POST /embeddings；空 baseUrl 失败。 | 现行 |
| `ingest/es-http.test.ts` | 稀疏索引 HTTP 配置与对账不得静默错配。 | OPS-1 | `esHttpConfigFromEnv · sparseTextForChunk · reconcileIndexed` | 空 URL 为 null；chunk 文本拼接；missing/orphan。 | 现行 |
| `ingest/extract-text.test.ts` | utf8 文本层可抽；PDF 不得当 utf8 垃圾返回。 | prds/04-pipelines/01-offline-ingest.md | `hasUtf8TextLayer · decodeUtf8Text · extractUtf8TextLayer` | txt/md 按类型或扩展名；pdf 走 NO_TEXT_LAYER。 | 现行 |
| `ingest/header-too-short.test.ts` | 仅页眉约 20 字不得 parse 成功、不得 ready。 | 剧本 Q3 · prds/10-delivery/03-acceptance-scenarios.md · ADR-043 | `runIngestStage` parse 字数闸 | 过短全文 needs_ocr + NO_TEXT_LAYER；不得物化成功 manifest。 | 现行 |
| `ingest/idempotency.test.ts` | 重试不重分块；半套稀疏索引不得假完成。 | X-04 | `decideChunkPath · missingEmbeddingChunkIds · mockEsStore · isIngestErrorRetryable` | indexVersion 路径、缺 embedding 补齐、retry 矩阵。 | 现行 |
| `ingest/job-ledger.test.ts` | ingest_jobs 阶段账本须记录开始/结束与失败码。 | X-04 | `buildStageStartRow · buildStageEndPatch · recordStageStart · recordStageEnd` | 最小账本行、成功链、失败码、pipeline 接线。 | 现行 |
| `ingest/mongo-body.test.ts` | 空 Mongo URL 不得真连，走 local id。 | prds/03-data | `localMongoDocId · upsertDocumentBody · findDocumentBody · pingMongo` | 空 url 返回 local:docId / null / false。 | 现行 |
| `ingest/mock-clean-stage-chain.test.ts` | mock_clean 须从 scanning 走到双就绪 ready。 | 剧本 M3 · prds/10-delivery/03-acceptance-scenarios.md · ADR-039 | `runIngestStage` | 默认 mock ES；≠ 生产扫描 / ≠ 真杀毒。 | 现行 |
| `ingest/object-store.test.ts` | 本地对象存储可读 utf8 与原始字节，缺 key 不得抛。 | STORAGE · prds/03-data | `readObjectText · readObjectBytes · storeConfigFromEnv` | 本地目录读写；s3 模式映射。 | 现行 |
| `ingest/pdf-text.test.ts` | PDF 文本层可抽取；扫描件无文本层须返回空。 | prds/04-pipelines/01-offline-ingest.md | `isPdfObject · extractPdfTextLayer` | 本地 mini PDF fixture 抽 Tj 文本；无算子返回 null。 | 现行 |
| `ingest/queue-names.test.ts` | 入库与探测队列名常量不得漂移。 | prds/06-async | `QUEUE_NAMES` | 暴露 sr-probe / sr-ingest。 | 现行 |
| `ingest/scan-runtime-block.test.ts` | 扫描模式运行时拦截与启动策略一致。 | X-02 | `isScanModeRuntimeBlocked（pipeline 接线）` | on 运行时拦截不得当 clean。 | 现行 |
| `ingest/scan-startup-policy.test.ts` | 扫描模式启动闸与运行时拦截一致；on 未接引擎须失败。 | X-01/X-02 | `checkScanModeStartupPolicy · isScanModeRuntimeBlocked` | development 允许 mock；任意 APP_ENV 下 on 拒绝；staging/production 禁止 mock/off。 | 现行 |
| `ingest/split-paragraphs.test.ts` | 段落切分过滤过短文本。 | prds/04-pipelines/01-offline-ingest.md | `splitParagraphs` | 按空行切段并丢掉过短片段。 | 现行 |

## 待处理

（无。`src/` 下已无 `*.test.ts(x)`。）
