# 覆盖分册 · ingest

> 入口：[../coverage.md](../coverage.md)
> 期望原文：[prds/10-delivery/03-acceptance-scenarios.md](../../../prds/10-delivery/03-acceptance-scenarios.md) 剧本 E/L/M/Q/V/AA
>
> 判定以测例断言为准。默认 mock ES / mock scan **不得**写成生产 ES 或真杀毒已测。L8 主锚在 api corpus（P0 R7），worker / db 只作生命周期附录，不按三份已测重复计。

## 剧本 E · 入库与生命周期

阶段口径：lifecycle / 双闸属 **P2必签**；近重复、删除/archived 三存对齐以源码为准。

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| E1 | ready+active 可查（ES 可查文号） | P2必签 | 单测 | 部分测 | api | apps/api/tests/ask/ready-active-corpus.test.ts（R7：仅 `ready∧active` 进检索集）；packages/db/tests/retrieve/ready-active-gate.test.ts（附录） | 未断言入库后 ES 可查文号。默认 `RETRIEVE_ES_MODE=mock`，≠ 生产 ES |
| E2 | supersede 旧版：lifecycle=superseded，ask 不得引用旧版 | P2必签 | 单测 | 部分测 | api | apps/api/tests/ask/ready-active-corpus.test.ts（`superseded` 被滤）；schema 有 `supersedes_doc_id` / `superseded_by_doc_id` | 无 supersede 写路径测；无「发布新版 → 旧版 superseded + ask 不引旧版」；PATCH lifecycle 可写该枚举但无联动 |
| E3 | 删除/archived：ES/Mongo/PG 对齐 | 源码为准 | 单测 | 部分测 | db | packages/db/tests/retrieve/ready-active-gate.test.ts（`lifecycle=archived` 不可检） | 无删除 API；无 archived 后 ES/Mongo/PG 三存对齐；api corpus 夹具未覆盖 archived |
| E4 | 跨 doc 近重复：指标可见；pending_review 可人工处理 | 源码为准 | 单测 | 缺实现 | worker | 源码仅 chunk 内 `seen` 正文去重（apps/worker/src/ingest/pipeline.ts）；无跨 doc / 无 `pending_review` / 无抑制指标 | 跨 doc 近重复、指标、人工 pending_review 均未做 |
| E5 | L1 故障 → L0 回退仍 ready | P2必签 | 单测 | 缺实现 | worker | 无 contextualize / L1 LLM prefix；chunk 写死模板 `contextPrefix`（`${title} / section`） | 无 L1 故障注入、无 L0 回退仍 ready |
| E6 | 无 active 文档时 ask → 200 `status=abstained` `reason=kb_not_ready` | P2必签 | 注入 | 已测 | api | apps/api/tests/ask/http-stream.test.ts（`kb_not_ready → 200` 拒答信封，同步+SSE；`KB_NOT_READY` 不进 `error.code`）；apps/api/tests/ask/retrieve-run.test.ts（空 corpus / 无 ready∧active → `kb_not_ready`） | — |

## 剧本 L · 入库末段双就绪与清单冻结（P2必签 · ADR-038）

通过：L1–L9 试点必签（L9 可用架构/单测代替人工 UAT）。

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| L1 | 样例 MD/PDF → ready；该 `index_version` 下每个 searchable chunk：PG 向量与 ES 均存在，chunkId 集合一致 | P2必签 | 单测 | 部分测 | worker | apps/worker/tests/ingest/dual-ready-index.test.ts（mock ES 集合一致才 reconcile ok）；apps/worker/tests/ingest/embed-es-serial.test.ts（半就绪禁 ready） | 无样例 MD/PDF 跑到 ready；无 PG `chunk_embeddings` 与 ES 同集对账。默认 `INGEST_ES_MODE=mock`，≠ 生产 ES |
| L2 | mock ES bulk 失败 → 文档非 ready；默认 ask 检不到（即使向量已写） | P2必签 | 单测 | 部分测 | worker | apps/worker/tests/ingest/dual-ready-index.test.ts（ES 空 reconcile 失败）；apps/worker/tests/ingest/embed-es-serial.test.ts（`embedReady=1,esReady=0` 不得 ready）。源码 `INGEST_ES_MODE=fail` 写 `ES_INDEX_FAILED` 且 `esReady=0` | 无 pipeline 注入 `fail` → `status≠ready`；无「向量已写仍检不到」ask 串联 |
| L3 | 重试 ES 成功 → ready；对账无「仅一边有」告警 | P2必签 | 单测 | 部分测 | worker | apps/worker/tests/ingest/idempotency.test.ts（同 version 再 bulkIndex reconcile 仍 ok；半套不得假 ok） | 无「失败后重试成功 → ready」；无「仅一边有」告警 |
| L4 | 重索引 N+1：仅 N+1 双就绪后原子切换；瞬间只见 N 或 N+1；N 不被半套污染 | P2必签 | 单测 | 部分测 | worker | 源码 chunk 抬 `indexVersion` 并重置 `embedReady/esReady`；es_index 双就绪才 `status=ready`（仍 draft） | 无 N+1 原子切换测；无切换瞬间只见 N 或 N+1；无半套污染负向 |
| L5 | 阶段可观测：Bull Board / ingest_jobs 可见 `embedding` → `indexing_es` → `ready` | P2必签 | 单测 | 部分测 | worker | apps/worker/tests/ingest/job-ledger.test.ts（stage 开始/结束、es_index terminal）；apps/api/tests/ingest/jobs-query.test.ts（列表映射不改写 status） | 无 embedding→indexing_es→ready 链序断言；无 Bull Board；账本无 api 入队 `queued` |
| L6 | 重试不分块：embed 重试前后 chunkId 集合不变（manifest 冻结） | P2必签 | 单测 | 已测 | worker | apps/worker/tests/ingest/idempotency.test.ts（有 version+manifest → `resume_embed` 不抬 version；缺 embedding 只补缺；无 manifest → `NO_MANIFEST`） | — |
| L7 | 孤儿清理护栏：半写非激活 version 被清理 job 清掉；不碰当前激活版 | P2必签 | 单测 | 缺实现 | worker | 仅对账报告 orphan（apps/worker/tests/ingest/es-http.test.ts · dual-ready-index.test.ts）；无清理 job | 无孤儿清理 job；无「不碰激活版」负向 |
| L8 | 双闸门：ready+draft 不进默认检索；发布 active 后可检；非 ready 绝不检 | P2必签 | 单测 | 已测 | api | **主锚** apps/api/tests/ask/ready-active-corpus.test.ts（P0 R7：draft / superseded / 非 ready 被滤，仅 active∧ready 留下）。生命周期附录：apps/worker/tests/ingest/dual-ready-index.test.ts（入库期 mock ES 对账）；packages/db/tests/retrieve/ready-active-gate.test.ts（纯函数）。另 apps/api/tests/ingest/approval-scan.test.ts（非 ready 不得 active）；apps/api/tests/ingest/gates-live.test.ts（非 ready PATCH active → 409 `CONFLICT`，无 Docker 时 skip） | 附录不按三份已测重复计。默认 mock ES，≠ 生产装载后的 ES 命中 |
| L9 | 顺序一致：全仓均为 embed→es_index（无文档间混序） | P2必签 | 单测 | 部分测 | worker | apps/worker/tests/ingest/embed-es-serial.test.ts（本地 `canMarkReady`：半就绪禁止）；源码 embed 成功才 `enqueueNext(..., 'es_index')`，es_index 要求 `embedReady=1` | 测例未扫 pipeline 源码顺序、未禁文档间混序；无配置/静态断言「全仓均为 embed→es_index」 |

## 剧本 M · 上传大小与病毒扫描闸（P2必签 · ADR-039）

通过：M1–M8 试点/staging 必签；M9 开发环境；M10 配置单测可替代部分人工。

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| M1 | 上传 > 50 MiB 合法 PDF：complete 拒绝（413 / `PAYLOAD_TOO_LARGE`）；PG 无成功进入 parse 的 `uploaded` 成功路径 | P2必签 | 单测 | 部分测 | api | apps/api/tests/ingest/complete-size.test.ts（`checkUploadByteSize(max+1)` → `PAYLOAD_TOO_LARGE`）；apps/api/tests/ingest/gates-live.test.ts（绕过 PUT 直写超限对象，complete → 413，无 Docker 时 skip） | 无「PG 无 uploaded 成功路径」断言；complete-size 只测纯函数，不经 handler / 不写库 |
| M2 | ≤ 上限 EICAR 或 mock infected：`scanning` → 不 parse；Mongo 无权威 body；无 `chunk_manifest`；`failed`+`MALWARE`；对象已删；审计可查 | P2必签 | 单测 | 部分测 | worker | 源码 `mock_infected` 删本地对象并 `MALWARE`（apps/worker/src/ingest/pipeline.ts）；apps/worker/tests/ingest/idempotency.test.ts / bull-outcome.test.ts（`MALWARE` 不可重试，禁止当 clean 重投） | ≠ 真杀毒（QUAL-2 未接）。无 pipeline 注入测删对象 / 无 Mongo body / 无 manifest；无审计 hash+uploaderId |
| M3 | mock clean：`scanning → parsing → … → 双就绪 ready`（与 A/L 衔接仍绿） | P2必签 | 单测 | 已测 | worker | apps/worker/tests/ingest/mock-clean-stage-chain.test.ts | 内存仓驱动 scan→…→es_index；ready+draft。≠ 生产扫描 / ≠ 真杀毒 |
| M4 | prod/staging 关闭/缺失扫描引擎配置：worker 启动失败（fail closed）；不进入「可上传无扫描」灰态 | P2必签 | 单测 | 已测 | worker | apps/worker/tests/ingest/scan-startup-policy.test.ts（任意 `APP_ENV` 下 `on` 拒绝；staging/production 禁止 `mock_*`/`off`）；apps/worker/tests/ingest/scan-runtime-block.test.ts（运行时 `on` 不得当 clean） | 真引擎仍未接：staging/production 当前无合法扫描配置（见 docs/module-status/worker.md）。≠ 真杀毒已测 |
| M5 | 仅前端改大 limit：complete 仍 Head 校验 → 超大对象不能入库 | P2必签 | 注入 | 部分测 | api | apps/api/tests/ingest/gates-live.test.ts（绕过 HTTP PUT 直写超限，complete 仍 413）；complete 走 `headObject` + `checkUploadByteSize` | 默认 CI 无 Docker 则 skip；无「只改前端 limit」对照 |
| M6 | 预签名无 max body 能力：complete 仍拦超限（不依赖预签名） | P2必签 | 注入 | 部分测 | api | 同 M5：complete 以 Head 为权威闸（apps/api/src/routes/documents/index.ts）；upload-url 回 `maxBytes` 但不替代 complete | 无「预签名无 max body」专用断言；gates-live 可 skip |
| M7 | 引擎瞬时 5xx：有限重试 → 恢复 clean 则 parse；或耗尽 `failed`；不当 clean 静默放行 | P2必签 | 单测 | 缺实现 | worker | 真引擎未接。`on` → `SCAN_ENGINE_UNAVAILABLE` 不可重试（idempotency / scan-runtime-block）；无 5xx 重试矩阵 | ≠ 真杀毒。无引擎 5xx 有限重试 / 耗尽 failed / 禁静默放行 |
| M8 | infected 删除后：RustFS 无残留；无隔离区；审计含 hash + uploaderId + timestamp | P2必签 | 单测 | 部分测 | worker | 源码 `deleteObject` 删本地或 S3 key（apps/worker/src/ingest/object-store.ts）；MALWARE 终态见 M2 测例 | ≠ 真杀毒。无残留/隔离区断言；无 hash+uploaderId+timestamp 审计；`uploaded_by` 列未在 complete 写入 |
| M9 | dev `INGEST_SCAN_MODE=mock_clean` 可走完 scanning→parsing；单测/文档标非生产 | 开发环境 | 单测 | 已测 | worker | apps/worker/tests/ingest/scan-startup-policy.test.ts（development/test 允许 `mock_clean` / `mock_infected` / `off`） | 允许启动 ≠ 已测走完 parsing。文档/module-status 已标 mock、非生产 |
| M10 | 改配置上限（如 80 MiB）：预签名（若支持）/ complete / 中转同一配置源同步生效 | 配置单测可替代 | 单测 | 部分测 | api | `effectiveMaxUploadBytes()` = min(`INGEST_MAX_FILE_BYTES`, `INGEST_MAX_FILE_BYTES_CEILING`)；upload-url / PUT / complete 共用；complete-size 用默认 52_428_800 | 无「改 80 MiB 三处同步」单测；无预签名 max-body 能力 |

## 剧本 Q · OCR 节奏与扫描件硬闸（P2契约 · ADR-043）

通过：Q1–Q5、Q10 为 **P2必签**；Q6–Q9、Q11–Q12 在启用 OCR 或 P5 开闸时签。

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| Q1 | 纯扫描 PDF 且 OCR 关 → `needs_ocr` + `NO_TEXT_LAYER`；默认 ask 检不到；admin 列表可见 | P2必签 | 单测 | 部分测 | worker | apps/worker/tests/ingest/pdf-text.test.ts（无算子 PDF → null）；apps/worker/tests/ingest/extract-text.test.ts（pdf 字节 → `NO_TEXT_LAYER`，不当 utf8 垃圾）；源码 parse 写 `status=needs_ocr`；db 闸 `needs_ocr` 不可检 | 无 pipeline 夹具断言文档 `needs_ocr`；无 ask 检不到串联；无 admin 列表可见 `needs_ocr`。无 `INGEST_OCR_ENABLED` 开关（默认即无引擎） |
| Q2 | 有文本层制度 PDF → 可 ready（双就绪后）；active 后成员 ask 可检索 | P2必签 | 单测 | 部分测 | worker | apps/worker/tests/ingest/pdf-text.test.ts（未压缩 Tj 可抽出文本层） | 无「有文本层 PDF → ready → active → ask 可检索」；抽出文本 ≠ 双就绪 |
| Q3 | 「仅页眉 ~20 字符」夹具 → 不得 ready；不得物化成功用的空/近空 manifest | P2必签 | 单测 | 已测 | worker | apps/worker/tests/ingest/header-too-short.test.ts | ~20 字 → needs_ocr + NO_TEXT_LAYER；不得 chunk/ready / 成功 manifest |
| Q4 | parse 后全文过短（< 阈值 / `minPassageChars` 量级）→ 不得进 chunk/ready | P2必签 | 单测 | 部分测 | worker | apps/worker/tests/ingest/split-paragraphs.test.ts（过短片段丢弃、空白壳 → `[]`）；源码全文 < 阈值走 `needs_ocr` | 无「全文 < `INGEST_MIN_EXTRACTED_CHARS` → 不得 chunk/ready」直测 |
| Q5 | `ingest.scan` 与 `ingest.ocr` 逻辑 stage 隔离（interim 单物理队列不混 stage）；`MALWARE` 与 `OCR_*` / `NO_TEXT_LAYER` 不混用 | P2必签 | 契约 | 部分测 | contracts | packages/contracts/tests/async/ingest-job.test.ts（`INGEST_STAGES = scan,parse,chunk,embed,es_index`，无 ocr）；apps/worker/tests/ingest/queue-names.test.ts（仅 `sr-ingest`）；idempotency：`MALWARE` 与 `NO_TEXT_LAYER` 分码且均不可重试 | 无 `ingest.ocr` 逻辑 stage；无「scan/ocr 串 stage」负向；无 `OCR_*` 码 |
| Q6 | 若启用 OCR：body 在 chunk_manifest 物化前定稿；禁 ready 后 patch body | 启用 OCR 或 P5 | 单测 | 延后 | worker | 无 OCR 引擎；无 ready 后 patch body 路径 | 待 OCR 开闸再签 |
| Q7 | `needs_ocr` 文档 OCR 上线后重跑 → 新 indexVersion 全链路 + 双就绪 + 原子切换；旧 version 无脏残留 | 启用 OCR 或 P5 | 单测 | 延后 | worker | 无 OCR 重跑路径 | 待 OCR 开闸再签 |
| Q8 | （OCR 已启）低置信夹具 → `failed` / `needs_review`，非 ready | 启用 OCR 或 P5 | 单测 | 延后 | worker | 无低置信 OCR | 待 OCR 开闸再签 |
| Q9 | staging `INGEST_OCR_ENABLED=true` 无 `INGEST_OCR_ADR_REF` → 启动告警；dev 可 dogfood 标 `dogfood_ocr` | 启用 OCR 或 P5 | 单测 | 延后 | worker | env 无 `INGEST_OCR_ENABLED` / `INGEST_OCR_ADR_REF` | 待 OCR 开闸再签 |
| Q10 | P2 部署不因缺 OCR 引擎启动失败（对照缺杀毒引擎 fail closed） | P2必签 | 单测 | 部分测 | worker | worker env 无 OCR 必填；启动闸只约束 `INGEST_SCAN_MODE`（scan-startup-policy.test.ts）；extract-text / pdf-text 不依赖 OCR 引擎 | 无「缺 OCR 引擎仍可启动」与「缺杀毒 fail-closed」对照的显式启动单测 |
| Q11 | （前瞻）敏感 KB Cloud OCR 明文 → 拒或策略跳过 OCR 只收文本层 | 启用 OCR 或 P5 | 单测 | 延后 | api | 无 Cloud OCR | 待 OCR 开闸再签 |
| Q12 | 文档：OCR 默认 P5；提前须会签+ADR 有书面痕迹 | 启用 OCR 或 P5 | 文档护栏 | 延后 | — | PRD ADR-043 / 入库 §2.2 已写默认 P5；无 docs-guard 锁该句 | 待 P5 / 提前会签时签；无护栏测 |

## 剧本 V · 审批中心与入库闸（P2必签 upload · ADR-048）

通过：V1–V6、V8 为 **P2必签**；V7 随 BlockNote 交付签。

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| V1 | write complete 合法文件：对象登记；`approval_status=pending`；无 `ingest.scan` job | P2必签 | 注入 | 部分测 | api | 源码 complete 只 `markCompletePending`（pending + uploaded），不 `enqueueIngest`；apps/api/tests/ingest/reindex-strategy.test.ts（complete 200 且 `chunkStrategy` 落库）；apps/api/tests/ingest/gates-live.test.ts（complete 200 后未批 scan → 403） | 无断言「未入队 scan job」；gates-live 可 skip |
| V2 | 未审批时查文档：非 ready；默认 ask 不可检 | P2必签 | 单测 | 部分测 | api | apps/api/tests/ingest/approval-scan.test.ts（pending/none/rejected 不可 scan；uploaded/needs_ocr 不得 active）；ready-active-corpus / db 闸非 ready 不可检；gates-live 非 ready PATCH active → 409 | 无「未审批文档 ask 不可检」直连 |
| V3 | 提交人 approve 自己的 ticket（默认配置）→ 拒绝（禁自审） | P2必签 | 单测 | 缺实现 | api | approve 路由不比对提交人；`uploaded_by` / `approved_by` 列未在 complete/approve 写入（packages/db/src/schema/kb/documents.ts 有列） | 无禁自审；无提交人≠审批人断言 |
| V4 | 另一 kb admin approve → 入队 scan；其后 M/L 链可绿 | P2必签 | 注入 | 部分测 | api | approve 只改 `approval_status=approved`，scan 另 `POST …/scan`；canEnqueueScan('approved')=true（approval-scan.test.ts）；admin ops/approvals-workspace.test.tsx（有 decide 可点通过；有 `doc.upload` 显示入队 scan；**不替代 api 闸**） | approve 不自动入队；无「另一 kb_admin 通过后 scan 200」HTTP；无 M/L 衔接 |
| V5 | admin reject：不 scan；可重提 | P2必签 | 单测 | 部分测 | api | apps/api/tests/ingest/reject-http.test.ts | reject 200 后 scan 403 且不入队。**无独立重提 API**（rejected→pending） |
| V6 | 伪造「跳过审批直写 ready」API → 不存在或 403 | P2必签 | 单测 | 部分测 | api | 无 PATCH status=ready 路由；worker 任意 stage 未批准 → `NOT_APPROVED`（不可重试）；canEnqueueScan 未批为 false | 无对伪造直写 ready 路径的 404/403 负向测 |
| V7 | BlockNote 提交发布 → approve：服务端导出 MD；编辑者 UI 无强制导出步骤；进 scan 链 | P2.x | 单测 | 延后 | api | 仓内无 BlockNote；sourceType 默认 `upload` | 非本阶段；无服务端导出 MD |
| V8 | approve 后跳过 scan 标 ready → 禁止 | P2必签 | 单测 | 部分测 | api | apps/api/tests/ingest/approval-scan.test.ts（仅 `status=ready` 可 active）；ready 仅 worker es_index 双就绪写入 | 无「approve 后直标 ready」负向 HTTP |

## 剧本 AA · 分片策略与 reindex（P2必签 · ADR-053 / ADR-059）

通过：AA1–AA7 **P2必签**；AA8 与 OCR 开关环境一致即可。

| ID | 期望摘要 | 阶段 | 形态 | 覆盖 | 主包 | 证据 | 缺口 |
|----|----------|------|------|------|------|------|------|
| AA1 | 改 KB 某策略参数并保存：200；有审计日志；旧文档 chunk 边界/version 不变 | P2必签 | 单测 | 缺实现 | api | PATCH 可写启用/recommended（`tests/kb/chunk-strategies-http.test.ts`）；admin 弹窗声明不自动 reindex。无 paramOverrides 运营表单、无「旧文档 version 不变」断言 | 动态 paramSchema 引擎与审计查询面不在本张最小闭环 |
| AA2 | 新上传类型仅 1 策略 → 自动该策略；流水线用其参数快照 | P2必签 | 单测 | 已测 | api | `tests/ingest/reindex-strategy.test.ts`（complete 未带 → 200 auto + params 快照）；`chunk-strategies.test.ts` 绑定仅 1 个自动 | 可写集仍仅 `structure_paragraph` |
| AA3 | 新上传类型 ≥2 策略且未选 → 400 | P2必签 | 契约 | 已测 | api | `tests/ingest/chunk-strategies.test.ts`（`resolveBindChunkStrategy` ≥2 未传 → required） | P2 仅 1 个已实现，HTTP 多策略要等第二套 worker 算法 |
| AA4 | 同上选 recommended 或另一策略 → 200 进审批/流水线；文档记录 `chunk_strategy` | P2必签 | 注入 | 已测 | api | complete 显式已实现 → 200 落库；for-upload 带 `recommendedCode`；未实现码 400 | 可写集仅 `structure_paragraph` |
| AA5 | 文档列表点 Reindex，类型多策略且 body 无 `chunkStrategy` → 400 `VALIDATION_ERROR` | P2必签 | 注入 | 已测 | api | apps/api/tests/ingest/reindex-strategy.test.ts（reindex 未带 → 400，message `/chunkStrategy is required/i`，不写库）；路由 `BizCode.VALIDATION_ERROR` | 测例未直断言 `error.code=VALIDATION_ERROR`（status 400 + 文案已覆盖） |
| AA6 | 传合法 `chunkStrategy` 后 reindex：新 indexVersion；成功后检索用新切块 | P2必签 | 注入 | 部分测 | api | apps/api/tests/ingest/reindex-strategy.test.ts（显式已实现 → 200 入队 `stage=chunk`）；worker 首跑/reindex 抬 `indexVersion` 并冻结 manifest | 无新 indexVersion 断言；无「检索用新切块」 |
| AA7 | 无 `kb.config.write` 改策略配置 → 403 | P2必签 | 单测 | 已测 | api | `tests/kb/chunk-strategies-http.test.ts`（`doc_operator` 列表 403）；settings 总闸仍在 `settings-http.test.ts` | — |
| AA8 | OCR 策略在 OCR 未启用时：不可选或选后 `needs_ocr`（服 043）；不因此 P2 启引擎 | 与 OCR 开关一致 | 单测 | 延后 | api | `KNOWN_CHUNK_STRATEGY_CODES` 无 OCR 策略；worker 无 OCR 引擎（对照 Q10） | 无 OCR 策略码可选；待 OCR 开闸与开关对齐 |

## 本分册计数

行数须与上表合计一致（E6 + L9 + M10 + Q12 + V8 + AA8 = **53**）。

| 覆盖 | 行数 | ID |
|------|------|-----|
| 已测 | 12 | E6 L6 L8 M3 M4 M9 Q3 AA2 AA3 AA4 AA5 AA7 |
| 部分测 | 27 | E1 E2 E3 L1 L2 L3 L4 L5 L9 M1 M2 M5 M6 M8 M10 Q1 Q2 Q4 Q5 Q10 V1 V2 V4 V5 V6 V8 AA6 |
| 缺测 | 0 | — |
| 缺实现 | 6 | E4 E5 L7 M7 V3 AA1 |
| 延后 | 8 | Q6 Q7 Q8 Q9 Q11 Q12 V7 AA8 |
| UAT | 0 | — |
| **合计** | **53** | E1–E6 L1–L9 M1–M10 Q1–Q12 V1–V8 AA1–AA8 |

P2 必签且覆盖为 `缺测` / `部分测` 的行，才是下一批补测清单。`延后` / `缺实现` / `UAT` 不进欠债清单。
