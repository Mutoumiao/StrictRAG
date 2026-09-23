# @strict-rag/worker · 模块状态

| 字段 | 内容 |
|------|------|
| 路径 | `apps/worker` |
| 端口 | 无 HTTP 端口 |
| 成熟度 | **可联调**（P1 入库状态机；**仅** development/test + mock 栈可起；**staging/production 当前无合法扫描配置**） |
| 默认依赖模式 | `APP_ENV=development` · 启动探针 `WORKER_PROBE_ON_START=true` · 扫描 = `mock_clean` · 向量 = `mock`（dims=8，枚举 `mock\|fail`）· ES 索引 = `mock`（枚举 `mock\|fail\|http`，**默认 mock**；`http` 须 `ELASTICSEARCH_URL`）· 对象存储 = 默认本地目录；`STORAGE_MODE=s3` 走 RustFS（S3 兼容） · `S3_BUCKET=strict-rag` · Mongo URL 空则 `mongoDocId=local:` · `INGEST_MIN_EXTRACTED_CHARS=40` · `INGEST_OCR_ENABLED=false` · 评测打分器来源 `JUDGE_CALIB_SCORER=off`（= 缺测；worker **无 Gateway 打分客户端**，`http` 只声明不产值）· `INGEST_FAILURE_WEBHOOK_URL` **空=不发** · **可运行叠加** `.env.operable.example`（http/s3/mongo；**不**改 Zod 默认） |
| 关联模块 | 由 `api` 入队触发；写库走 `@strict-rag/db`；队列名 / job payload / 可执行策略集来自 `@strict-rag/contracts`；运行需要 Redis + PostgreSQL |
| 最近更新 | 2026-09-24（**验收对齐：M8 无残留 / 无隔离区专断言落地 + 两条债写明**：① 新增 `tests/ingest/scan-infected-no-residue.test.ts`（infected 处置后对象已删且**不再存在**、无第二落点（无隔离区键）；静态守卫钉住 worker 源树**无** quarantine 落点、object-store 变更面只有 deleteObject），并登记 `tests/index.md`；② 验收剧本 M8 的**审计 sink**（hash + uploaderId + timestamp）在 worker 侧**无落点**记债；③ 验收剧本 R9 的**入库 embed 指标打点**在 worker 侧**零命中**记债 —— 两项均属新增面，本图不建）；2026-09-23（**L2 批跑报告与 api CLI 同构补齐（采集面 · 零容忍区块 · §8 区块），并同步 `saveL2Report` 白名单**：①`L2TurnExecuteResult` 增 `evidenceDocIds` / `answerKind` / `citationCount`（**不加** `minSupport`：L2 行上无 claims，「历史文本被当 claim 送进 verifier」在图上不可观测），`createEvalHttpL2Execute` 从内口回包读这三键（解析与过滤照抄 L1 的 execute；未下发 → 键缺省，**不**冒充 knowledge）；`L2BatchCaseRow` / `L2BatchReport` 与 api **同名同语义**补齐：行键 **6** 个（`expectedDocIds` / `evidenceDocIds` / `docHit` / `answerKind` / `citationCount` / `citationOk`）、报告键 **7** 个（`docHitRate` / `docHitHits` / `docHitScored` / `citationComplete` / `citationCompleteDen` / `zeroToleranceCoverage` / `repro`）。②报告新增 `zeroToleranceCoverage` 区块（PRD §6.2 **四项 → 五处去处：1 处机械判 + 4 处记债**；两侧同源调用 contracts 纯函数）与 §8 `repro` 三键（`l2GoldSetHash` 取真值 = 本跑实际题面集；`sessionStrategyVersion` / `rewritePromptVersion` 恒 `null`）。③`persist.ts` 的 `saveL2Report` 逐键白名单同步加**报告键那 7 个**（**漏键 = 库内静默丢弃且零测试红**，已由测例钉住）。**未做**：worker **无** md 渲染；`docHitRate` 未映射时恒 0、**不得当成绩**；三者**都不进** `computeL2SignoffEligible`（公式一字未动））；2026-09-23（**L1 批跑报告新增三样证据面（与 api CLI 同构）**：①人工抽检账本 `humanSpotPath` 入参（同一份 `HumanSpotLedgerSchema`；不传 = 缺测 `null`；账本坏了抛 `HumanSpotLoadError`，不静默降级成缺测）；②打分器来源 `judgeAurocSource`（读同名 env `JUDGE_CALIB_SCORER`，与 api 共用 `judgeAurocSourceFor`；**worker 无 Gateway 打分客户端**，`http` 只能得「来源 live + 无值」）；③PRD §8 可复现区块 `repro`（与 api 同形状，**worker 只填 `questionIdsHash`**，其余分项 `null`）。`persist.ts` 的 `reportJson` 逐键白名单同步加这三个键（不加 = 静默丢弃，已由同构测例钉住）。**未做**：worker 生产消费者不传 `humanSpotPath` → 生产跑批 `humanSpot` 恒 `null`（缺测，方向安全）；`repro` 的模型 / 档位预算 / τ / 校准集哈希在 worker 侧取不到）；2026-09-23（**评测两包的实测门进判定**：L1 批跑逐题采集 `answerKind` 与 `citations.length`，报告新增引用完整率与其分母；L2 批跑新增近指代（near_coref）通过率与其分母（分母含 `error`，error 不算 pass）；两处均与 api 侧同口径、共用 contracts 的纯函数。worker 落库报告的 `reportJson` 白名单同步补字段。**未验证**：近指代率不含「主题是否正确」与「合法 citation」（无 judge、未采集 `expectedDocIds` 命中），且夹具只有 3 条 near_coref → 该门今天约等于「3/3 全过」）；2026-09-20（**ES sparse bulk 补可见级字段**：mapping 与 bulk source 增 `visibilityLevel`（有值即写；api 侧同形改动在 `es-sparse`），调用点 `ingest/pipeline.ts` 传文档可见级；补测 1 条并同步 2 处 mapping 精确断言。**未验证**：真 ES 集群行为）；2026-09-20（工单 13：ES 第三条查询路径补租户闸——`ingest/es-http.ts` 的 `requireTenantId` + 查询体 `term: tenantId`，调用点 `ingest/pipeline.ts`；补测批 2 入库闸与双就绪 9 个测例文件 + 共享夹具；补测批 4 Mongo 正文护栏）；2026-09-19（剧本 L7 孤儿清理 `orphan-clean.ts`；剧本 E4 `pending_review` 入审；O4 bulk builder 租户闸）；2026-09-17（入库报告落 `contextualize_l1_ok` / `contextualize_l0_fallback`，migration `0019`）；2026-09-16（L1 contextualize 真调用、默认 off；入库报告补跨文档去重率） |
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
- 阶段：`scan → parse → ocr? → chunk → embed → es_index`；旁路 `purge`（`IngestJobData.stage`；`ocr` 仅 `INGEST_OCR_ENABLED` 且无文本层时入队；`purge` 由 DELETE 入队，不要求已审批）
- **scan**：`mock_infected` 删本地对象 + `MALWARE`；`mock_clean` / `off` 放行；审批重检（ADR-048）在**任意阶段**入口先做，未通过 → `NOT_APPROVED`（非仅 scan）
- **parse**：读对象（local 或 `STORAGE_MODE=s3`）；过短 → `needs_ocr` + `NO_TEXT_LAYER`（不交 ocr）；完全无文本层且 OCR 开闸 → enqueue `ocr`；有 `MONGODB_URL` 写 `document_bodies`（`upsertDocumentBody` / `findDocumentBody` / `pingMongo`），否则 `mongoDocId=local:{docId}`；冒烟 `pnpm --filter @strict-rag/worker smoke:mongo`
- **ocr**（P5 开闸）：`INGEST_OCR_ENABLED` 默认 false。可注入 `ocrExtract`；无注入 → `OCR_UNAVAILABLE` 留 `needs_ocr`；低置信 → `needs_review` + `OCR_LOW_CONFIDENCE`；成功且字数达标 → `extractMethod=ocr` 交 chunk。utf8 文本层入队 ocr 拒抽（短页眉不得洗 ready）。运营 reindex 可入队 ocr。staging/prod 开闸无 `INGEST_OCR_ADR_REF` 告警可启动。**≠** 真引擎 / Cloud OCR / 启动自动全库
- **chunk**：**仅** `structure_paragraph`（contracts `IMPLEMENTED_*`）；未实现 → `UNSUPPORTED_CHUNK_STRATEGY`（**不**静默回落）；读 `chunkStrategyParams.contextMode`：L0 prefix 无路径只用标题（禁止字面量 `section`）；`l0_template` 报告 `contextSource=l0`；`l1_llm` / 缺省：**默认（`INGEST_CONTEXTUALIZE_MODE=off`）不调 Gateway，同一 L0 prefix，报告 `l0_fallback`**；置 `http` 时逐块真调 chat（`contextualize-http.ts`，temp=0，PRD §4.1 冻结模板，输出单行且 ≤200 字符），**成功才写 `l1_llm`、任一块失败即回退 L0 并记 `l0_fallback`**（块仍可索引、不阻断），并打 `event=contextualize_summary` 的 `contextualize_l1_ok` / `contextualize_l0_fallback` 计数（**注**：worker 无 metrics 出口，这两个名字只作日志字段，≠ `/metrics` 计数器）。写 chunks（含 `mongoBodyId`）+ `chunk_manifests`；`MONGODB_URL` 非空时另写 Mongo `chunk_bodies`（`upsertChunkBodies`，`_id=chunkId`）；`indexVersion = doc.indexVersion+1` 并重置 `embedReady=0` / `esReady=0`
- **embed**：mock 伪向量 dims=8 · `model=mock-embed`；缺 embedding 行才补写（幂等 skip）
- **es_index**：默认 `mockEsStore`；`INGEST_ES_MODE=http` 时 `ensureSparseIndex` + bulk（写 `tenantId`/`kbId`/`docId`/`chunkId`/`sparseText`，有值才写 `ownerDeptId`；`aclPrincipals` 为数组才写，空数组写哨兵 `__acl_none__`；`visibilityLevel` 有值即写（供 api 查询期做可见级收窄））+ 按 doc 对账（映射对齐 api `es-sparse`）；要求 `embedReady`；双就绪 → `status=ready` **且 `lifecycle='draft'`**（**不是** `active`；默认检索闸 `ready∧active` 仍拦，须运营升 lifecycle），并**在同一条 UPDATE 原子激活 `active_index_version`**（ADR-038 §2.2；全仓唯一写点，失败路径不碰）
- **孤儿清理（L7 · `ingest/orphan-clean.ts`）**：对象 = **单边**（一侧有、另一侧为空）∧ `status != ready` ∧ 非激活 ∧ 非在飞（`documents.index_version`）；护栏「激活版永不删」+ `active_index_version IS NULL` 时**一律不动手**；动作 = PG 向量 + mock ES **双侧**。触发落「文档 `failed`」那一半（`runIngestStage` 失败后 best-effort，吞错不改阶段结果）；**周期调度未落地**（本仓无调度基建）。`INGEST_ES_MODE != mock` 时**整体跳过**（真 ES 侧清理属 B8）。**≠** 生产 ES 双侧清理
- **跨 doc 去重（`cross-doc-dedupe.ts`）**：字 3-gram Jaccard ≥ 0.9（非生产 LSH）；动作由 KB `config_json.crossDocDedupeAction` 决定 —— 默认 `skip_index`（块丢弃、不进 manifest）；`pending_review` 时冲突块**落库入审**（`dupe_status=pending_review` + `duplicate_of`）但**不进 manifest** → 不 embed / 不 ES，报告冲突对带 `heldChunkId` 供运营二选一。兜底：全文都待审 → `EMPTY_CHUNKS`（**不得 ready**）。**≠** `downrank`（PRD 合法值但本仓无实现，写入端 400 拒绝）
- **purge**：清对象（有 key）；`mockEsStore.dropDoc`；Mongo URL 空跳过，有值删该 doc 的 document_bodies / chunk_bodies；回写 `objectKey=null`、`embedReady=0`、`esReady=0`；lifecycle 保持 archived。**≠** HTTP ES `_delete_by_query` / PG 行硬删 / chunk 表清扫
- 对象路径：`{STORAGE_LOCAL_DIR}/{S3_BUCKET}/{objectKey}`

### 评测消费者（P2 底线 + L2 归档底线）
- sr-eval concurrency=1：L1 读 gold_questions（含 `expectedDocIds`）→ runL1Batch（2×2 + Hit@k + 离线 τ 扫描 + 可选 Judge AUROC + 引用完整率 + **可选人工抽检账本** + **§8 `repro` 区块**）；L2 读 fixtures/l2 → runL2Batch 多轮窗 + 近指代通过率 + **采集面（`docHit` / 引用数 / `answerKind`）** + **`zeroToleranceCoverage` 处置档位区块** + **§8 `repro` 三键**；回写 eval_runs（eval/consumer.ts）
- 默认 execute：HTTP POST /api/v1/internal/eval/execute-ask（EVAL_ASK_BASE_URL + EVAL_INTERNAL_TOKEN）；读 `evidenceDocIds` 计 Hit@k；读 `minSupport` 计 tau*；读 `answerKind` / `citationCount` 计引用完整率（内口未下发时保持缺省，**不**冒充 knowledge）；L2 可带 sessionId/sessionWindow；空 token 记 error
- **L1 证据面（与 api CLI 同构）**：打分器来源由同名 env `JUDGE_CALIB_SCORER` 声明（默认 off = 缺测）；worker **无 Gateway 打分客户端** → 默认 `judgeAuroc=null`，只有 mock 会真出值（值只打印、不进判定）；`humanSpotPath` 入参读同一份文件账本（不传 = 缺测），而**生产消费者不传** → 生产跑批 `humanSpot` 恒 `null`；`repro` 只填 `questionIdsHash`（源 = DB `gold_questions.case_key` 全量），模型 / 档位预算 / τ / 校准集哈希 = `null`（记债）
- **L2 报告面（与 api CLI 同构）**：两侧报告 / 行键集的唯一锚点 = contracts `L2_EVIDENCE_REPORT_KEYS`（**7** 键）/ `L2_EVIDENCE_ROW_KEYS`（**6** 键）；worker 侧多一条硬纪律 —— `saveL2Report` 是**逐键白名单**，加键必须同步（漏键在库内**静默消失、零测试红**，已由同构测例钉住）。`docHit` 无标注题 → `null` 不计分；**未映射（夹具逻辑 id vs `documents.id` uuid）时 `docHitRate` 恒 0，不得当成绩**；`citationOk` 只对 `knowledge` 判词（`chitchat` / 未下发 → `null`），`false` **不进** `failReasons`；`zeroToleranceCoverage` 里 `mechanical` 必带命中数（与 `zeroToleranceHits` 同源）、`debt` 必为 `null`。三者（采集面 / 零容忍区块 / `repro`）**都不进** `computeL2SignoffEligible`。worker **无** md 渲染（只写 `reportJson`）
- **禁止** import apps/api；**禁止** mock 覆盖率当签字 PASS；工程 signoffEligible ≠ 准出；**引用完整率与近指代通过率已进工程公式**（L1 引用完整率进 api 侧 ADR-046 放行判定；L2 近指代率进 signoffEligible），Hit@k / tau* / AUROC 只进 **api 侧 ADR-046 放行判定**、仍**不**进本包的工程公式；**不**写 `TAU_CLAIM`；无 在线抽样

### 幂等 / 重试（X-04 最小）
- `idempotency.ts`：带 `indexVersion` + 有 manifest → **resume_embed，禁重分块**；有 version 无 manifest → `NO_MANIFEST`
- 可重试（普通 Error → BullMQ attempts）：`EMBED_FAILED` / `ES_INDEX_FAILED` / `ES_RECONCILE_FAILED` / `DOC_LOCK_BUSY` 等
- 不可重试（`UnrecoverableError`）：`MALWARE` / `NOT_APPROVED` / `UNSUPPORTED_CHUNK_STRATEGY` / `DOC_NOT_FOUND` / `EMPTY_CHUNKS` / `MISSING_INDEX_VERSION` / `EMBED_NOT_READY` / `UNKNOWN_STAGE` / `IDEMPOTENT_CHUNK_FORBIDDEN`（`bull-outcome.ts`）
- 未知 errorCode **fail-closed 不重试**
- **账本最小**：`job-ledger.ts` 每 stage 先 insert `running`、结束时写 `succeeded`/`failed`（写失败仅记 warn 日志，不阻断）；**未做** api 入队写 / 查询 API
- **失败 Webhook 最小**：`INGEST_FAILURE_WEBHOOK_URL` 空则不发；仅 `recordStageEnd` 见 `errorCode` 时 POST JSON（`event=ingest.failed` + tenantId/kbId/docId/stage/errorCode/at，可选 jobId）；超时约 3s、只一次；非 2xx/网络错 warn **不抛**、**不阻断**账本。无 HMAC / 无重试队列 / 无 ask webhook / 无正文与对象路径
- **入库报告**：`ingest-report.ts` 按 `docId+indexVersion` 落可查询行（双就绪成功；文档内去重清空失败；**同 KB 跨 doc skip_index 冲突对**；**跨文档去重率 `dedupeCrossDocRate`（与计数同源派生；分母 0 → null，不写 0）**；**情境来源 l0 / l0_fallback / l1_llm** + **`contextualizeL1Ok` / `contextualizeL0Fallback`（PRD 04 §5.2「指标必出」；与 `contextSource` 同口径：L1 被请求但本轮未实际调用时整轮计回退；后阶段不得复写已记录值）**；对账失败不标双就绪）；写失败 warn 不阻断；**有** `pending_review` 冲突对（带 `heldChunkId`）但**无**（worker 侧）自动处置（人工二选一见 api `POST …/dedupe-conflicts/:chunkId/resolve`） / 聚合指标 / 审阅面；**不含** Hit@k / 「高度重复」阈值提示（数据 PRD 无阈值）
- **同 doc 锁最小**：`doc-lock.ts` 用 Redis `SET NX EX`（默认 TTL 180s）+ token 安全释放；`index.ts` 持锁再跑 stage；抢锁失败 `DOC_LOCK_BUSY` 可重试；**非** Redlock

### 基础设施
- 环境变量校验、Pino 日志、与 api 共用 `@strict-rag/db`
- `GATEWAY_*` 除 embed 外，另用于 **L1 contextualize**（`INGEST_CONTEXTUALIZE_MODE=http` + `GATEWAY_CHAT_MODEL`）；**默认 off**，未开时不调网关

---

## 明确未做 / 边界

| 项 | 说明 |
|----|------|
| 真实杀毒 / 生产扫描 | mock only；`on` 拒启动；QUAL-2 安全债 |
| 真实 embedding | 默认 `INGEST_EMBED_MODE=mock`；dims=8 与生产模型无关 |
| 真实 ES + IK 索引 | 默认可 `INGEST_ES_MODE=http` bulk（标准分词，写 `tenantId`/`kbId`/`ownerDeptId`/`aclPrincipals`/`visibilityLevel` 供查询期隔离与可见级收窄）；**无** IK 插件 / 多租户 Router |
| 真 RustFS / Mongo 正文 | `STORAGE_MODE=s3` + `MONGODB_URL` 可写；默认仍本地 + `local:` |
| OCR / 复杂版式 | 开闸 opt-in + 注入抽取器；历史 needs_ocr 可由 reindex 入队 ocr；默认关；**无**真 Tesseract / Cloud / 启动自动全库 |
| HTTP API | **禁止**业务 HTTP |
| `ingest_jobs` 完整运维账本 | **最小 stage 写已有**；无查询面 / 无 api 入队 `queued` |
| 入库报告完整语义 | 跨 doc `skip_index`（字 3-gram Jaccard≥0.9）+ 冲突对（可含 `pending_review` + `heldChunkId`）+ contextSource + **跨文档去重率** 已落；**无**（worker 侧）自动处置（人工二选一见 api `POST …/dedupe-conflicts/:chunkId/resolve`） / 聚合指标 / 审阅面 / 生产 LSH / Hit@k / 「高度重复」阈值提示 |
| 真 L1 contextualize | **已落但默认关**：`INGEST_CONTEXTUALIZE_MODE=http` 时逐块真调 chat（temp=0，PRD §4.1 模板），成功写 `l1_llm`、任一块失败回退 L0（`l0_fallback`）；**默认 off**（无真 Gateway 时 on 只会全量假 `l0_fallback`）；**无** per-chunk checkpoint（重跑不跳过已有 prefix）；worker **无** metrics 出口（`contextualize_*` 只作日志字段） |
| dual-ready 自动 `lifecycle=active` | 终态 draft；检索默认可检索性另闸 |
| purge 生产三存 | mock ES drop + 对象删 + 可选 Mongo；**无** HTTP ES `_delete_by_query` / PG 硬删 / chunk 清扫 |
| 失败 Webhook 加固 | **最小 POST 已有**；无 HMAC / 重试队列 / admin·KB URL / ask 拒答 webhook |
| L1 抽检 / §8 可复现（worker 侧） | `humanSpotPath` 入参已有，但**生产消费者不传** → 生产跑批 `humanSpot` 恒 `null`（缺测，方向安全）；`repro` 只填 `questionIdsHash`，模型 / 档位 / τ / 校准集哈希取不到（记债） |
| L2 报告面（worker 侧） | 报告与 api CLI 同构已落（采集面 / `zeroToleranceCoverage` / §8 `repro`）；`docHitRate` 未映射时**恒 0**（夹具写逻辑 id、`documents` 无 `external_id`）→ 不得当成绩；PRD §6.2 四项 → **五处去处只有 1 处机械判**、另 4 处记债；`repro` 两个版本键恒 `null`；三者**都不进** `computeL2SignoffEligible`；区块与 `repro` **不透** `…/eval/runs` DTO；worker **无** md 渲染（只写 `reportJson`） |

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
| 失败重试 / 死信 | 仅 BullMQ attempts + 日志；无业务 DLQ 面板 | 对照 PRD 异步章节。失败 Webhook 只一次 warn，≠ 重试队列 |
| 失败 Webhook 加固 | 无 HMAC、无 admin/KB URL、无 ask 拒答 webhook | 最小闭环已接；空 URL 默认不发 |
| worker 抽检来源未接生产路径 | 生产跑批 `humanSpot` 恒 `null`（缺测 → 该硬门不放行，方向安全） | 销账 = 消费者按 run 提供账本路径并透传 `humanSpotPath` |
| worker `repro` 分项不足 | 模型 / 档位预算 / τ / 校准集哈希在 worker 取不到 | 销账 = 内口回传档位 + worker 侧校准集路径 |
| worker `saveL2Report` 逐键白名单 | 漏键 = 新字段在库内**静默丢弃、零测试红**；报告与库内不一致时读到的人会以为「本来就没有」 | 加 L2 报告键必须**三处齐改**：contracts `L2_EVIDENCE_REPORT_KEYS` + 本白名单 + 两侧同构测例（`tests/eval/run-l2-batch-evidence-collection.test.ts` 逐键比对 `set` 载荷；`tests/eval/run-l2-batch-repro.test.ts` 专钉 `repro`） |
| **infected 处置后的审计面（hash + uploaderId + timestamp）无落点（验收剧本 M8）** | Then 要求 infected 删除后 RustFS 无残留 / 无隔离区 / 审计含 hash + uploaderId + timestamp；前两截有专断言（`tests/ingest/scan-infected-no-residue.test.ts`），第三截**无落点** | 「审计」sink 未裁（表 / Pino / Langfuse 三者未定，PRD 只列字段）+ 真扫描引擎（QUAL-2）未接、无真 hash 可写 → 销账条件 = 两项就位后实现审计写入并补测。**禁止**拿阶段账本的 failed 行冒充该审计面 |
| **入库 embed 无指标打点（验收剧本 R9）** | Then 要求「入库 embed 走 plane=ingest」，而 `apps/worker/src` 对 metric / plane **零命中** → worker 入库链无任何打点；plane=ingest 仅见于 api 侧 complete 路径 | 销账条件 = ① worker 侧指标面落地；② 真 Redis / 配额基建（embed TPM）。属**新增基建**（非收紧非等价），本图不建；裁定见 wayfinder 图 acceptance-divergence |

---

## 证据

| 类型 | 指针 |
|------|------|
| 入口 / 队列 | `apps/worker/src/index.ts` · `queues.ts` · `db.ts` |
| 流水线 | `apps/worker/src/ingest/pipeline.ts` · `cross-doc-dedupe.ts` · `es-store.ts` · `es-http.ts` · `mongo-body.ts` · `ingest-report.ts` · `failure-webhook.ts` |
| 扫描闸 | `apps/worker/src/scan-mode-policy.ts` · `tests/ingest/scan-startup-policy.test.ts` · `env.ts` superRefine |
| 幂等 / 重试 / 锁 | `ingest/idempotency.ts` · `doc-lock.ts` · `job-ledger.ts` · `tests/ingest/{idempotency,doc-lock,job-ledger,bull-outcome}.test.ts` |
| 失败 Webhook | `ingest/failure-webhook.ts` · `job-ledger.ts` `recordStageEnd` · `tests/ingest/failure-webhook.test.ts` |
| 评测证据面（抽检 / 来源 / §8） | `eval/human-spot.ts`（`HumanSpotLoadError`）· `eval/run-l1-batch.ts`（`humanSpotPath` / `judgeAurocSource` / `repro`）· `eval/persist.ts`（`reportJson` 白名单）· `eval/consumer.ts` · `tests/eval/run-l1-batch-human-spot.test.ts` · `tests/eval/run-l1-batch-judge-source.test.ts` · `tests/eval/run-l1-batch-repro.test.ts` |
| L2 报告面（采集面 / 零容忍 / §8） | `eval/run-l2-batch.ts` · `eval/execute-ask-http.ts`（`createEvalHttpL2Execute`）· `eval/persist.ts`（`saveL2Report` 白名单）· `tests/eval/run-l2-batch-evidence-collection.test.ts` · `tests/eval/l2-zero-tolerance-coverage.test.ts` · `tests/eval/run-l2-batch-repro.test.ts` |
| ES sparse bulk | `ingest/es-http.ts` mapping/bulk 含可选 `ownerDeptId` / `aclPrincipals` / `visibilityLevel` · `tests/ingest/es-http.test.ts` |
| 策略 SSOT | `packages/contracts/src/ingest/chunk-strategy.ts`（`IMPLEMENTED_*`） |
| job 契约 | `packages/contracts/src/async/ingest-job.ts` |
| 环境变量默认值 | `apps/worker/src/env.ts` |
| 单测 | `apps/worker/tests/ingest/` · `tests/env/`——**不是**入库 E2E；导航 `apps/worker/tests/index.md` |
| Task（辅证 · 已归档） | `08-04-p1-*` · `08-12-spec-w1-scan-failclosed` · `08-12-spec-w1-chunk-strategy-truth` · `08-12-spec-w1-ingest-idempotency-impl` · `08-12-ingest-jobs-ledger-min` · `08-12-ingest-doc-lock-min` · QUAL-2：`08-11-qual-scan-engine` |
