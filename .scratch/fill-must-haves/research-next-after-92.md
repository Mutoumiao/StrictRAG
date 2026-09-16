# 工单 92 之后下一批候选 · 证据级盘点

| 字段 | 内容 |
|------|------|
| 类型 | research（只读；未改任何 `src/` / 测试 / PRD / spec / `docs/module-status`） |
| 日期 | 2026-09-16 |
| 前置阅读 | `.scratch/fill-must-haves/map.md` · `docs/agents/issue-tracker.md` · `docs/agents/domain.md` · `prds/12-delivery-guides/14-模块需求功能表.md`（0.4.34） · `docs/module-status/{api,worker,admin,web,ui}.md` |
| 口径 | 「必须具备」= 冻结 PRD 要求最终产品有这条能力，**不是**声称源码已实现；IS 一律以源码为准 |

## 0. 结论速览

| # | 候选 | 功能表口径 | 硬前置 | 规模 | 建议 |
|---|------|-----------|--------|------|------|
| 1 | 跨文档去重 `dedupe_cross_doc_rate` / 「高度重复」提示 | 必出指标；「高度重复」提示 | **拆两半**：rate 无前置；阈值**无任何 PRD 给出** | S（rate）/ 需决定（提示） | 只做 rate |
| 2 | metrics `fallback` / `node_used` 维 | P2 指标骨架「含 fallback 与 node_used」 | 无（llm 维数据已在 `meta`；rerank 维需从网关客户端透出） | S–M | **可开工** |
| 3 | 入库报告 L0 vs L1 Hit@k | 「**可**抽样对照」 | **有**：无「同一文档 L0/L1 两份可检索数据」载体（ADR-053 禁同 version 双索引） | M+ | 不开工 |
| 4 | 在线编写余量（BlockNote / editor-draft） | P2.x；P2 明确「可没有」 | **有**：staging 落点 + `submit-approval` 语义未冻 | M–L | 不开工 |
| 5 | MD/TXT 更严体积档 + 魔数嗅探 | P1「MD/TXT 可更严」；**魔数无 PRD 依据** | 无（complete 已把对象字节读进内存） | S | **可开工**（保守版） |
| 6 | 真 L1 `contextualize` | P1；ADR-013 生产默认 L1 | 无硬前置（worker 已有 `embed-http` 同型先例） | M | **可开工** |
| 7 | 入场 `aclPrincipals` 剩余面 | P3b | 无硬前置（ACL 端点部分）；角色 principal / 默认开**锁死** | S–M | 可做端点 |
| 8 | `pending_review` | P1「须人工二选一」 | **有**：落点 + 人工决定入口 + KB 策略面三处未冻 | M–L | 不开工 |
| 9 | QUAL-G3 `gold.yaml` 审核闸 | **功能表无此行**；出自测试覆盖表 | **有**：审核主体/落点/`gold.yaml` 与运营表关系未冻 | S–M | 不开工 |
| 10 | admin 原生 `<select>` 站规债 | 站规（地图 Notes），非功能表 | 无 | S–M | **可开工（首选）** |

---

## 候选 1 · 同 KB 跨文档去重 `dedupe_cross_doc_rate` / 「高度重复」提示

### 功能表原文要求

- §5.4 召回精度链（第 403 行）：「→ 文档内去重 + **默认同 KB 跨文档去重**」
- §6 worker（第 473 行）逐字：「去重：文档内必做；同 KB 跨文档默认 on（MinHash/simhash 量级）；动作默认 `skip_index`，可选 `downrank` / `pending_review`（须人工二选一，禁止无提示静默丢条款）。跨 KB 默认不做。searchable chunk 集被去重清空 → 不得 ready；**剩余 searchable chunk 占比低于阈值时，在入库报告标「高度重复」并提示运营人工确认（阈值以数据 PRD 为准）**。重试消费冻结 manifest，禁止重试路径重新分块；换策略 = 新 `indexVersion`。」
- §4.3 文档运营动作（第 299 行）：「入库报告 | 文档页抽屉或同页：去重冲突对、L0/L1、跨 doc skip；`pending_review` 须人工二选一 | P1」

### PRD 依据

| 条款 | 关键句 |
|------|--------|
| `prds/04-pipelines/01-offline-ingest.md` §5「去重」表（227–233） | 「同 KB 跨文档｜**是（默认真）**｜on｜MinHash LSH 或 simhash；阈值建议 Jaccard≈0.9」 |
| 同文 §5.1（235–243） | 动作三档；「跨 doc 命中时入库报告必须可点开冲突对；禁止无提示静默丢条款」 |
| 同文 §5.2「指标（入库报告必出）」（245–250） | 逐字：``dedupe_doc_internal_dropped`` · ``dedupe_cross_doc_dropped`` · ``dedupe_cross_doc_rate`` · ``contextualize_l1_ok`` / ``contextualize_l0_fallback`` |
| ADR-014（`prds/11-decisions/00-adr-index.md`:100–105） | 「doc 内去重必做；同 KB 跨 doc MinHash/simhash 默认 on，默认动作 `skip_index`」 |
| `prds/03-data/01-postgresql-schema.md` §3.2 chunks（245–251） | `content_hash`「对账 / 近重复」· `duplicate_of`「跨 doc 去重命中权威 chunk；冲突待审可 `dedupe_status=pending_review`」· `searchable`「bool；duplicate skip 时 false」 |
| `prds/10-delivery/01-phased-roadmap.md`:32 | 「doc 内 + 跨 doc 去重（默认 on；冲突可 pending_review）」 |
| `prds/08-quality/02-evaluation-and-gates.md`:211 | 「跨 doc 去重策略变更 → 2×2 + Hit@k」（再认证触发） |

**「高度重复」阈值：任何 PRD 都没有给。** `prds/03-data` 全文搜不到阈值/占比/ratio 的相关定义（仅有 schema 章节）；功能表写「阈值以数据 PRD 为准」而数据 PRD 未写 → **这一半是「挂到不存在的来源」**，属隐藏前置（见下）。

### 现状（IS · 源码证据）

已有：
- 判定与动作：`apps/worker/src/ingest/cross-doc-dedupe.ts:9-10`（`CROSS_DOC_SHINGLE_N=3` / `CROSS_DOC_JACCARD_MIN=0.9`）；`:19-23` 冲突对形状 `action: 'skip_index'`（字面量收窄，无 `downrank` / `pending_review`）；`:52-66` `findCrossDocConflict` 命中即返回 `skip_index`；`:70-113` 语料仅取同 KB、`status=ready`、`lifecycle∈{draft,active}`、当前 `indexVersion`。
- 调用点：`apps/worker/src/ingest/pipeline.ts:515-540`（`crossDocDropped += 1` + `conflictPairs.push`，命中即 `continue`，**不进 manifest / 不写向量 / 不写 ES**）；`:585-592`（去重清空 → `EMPTY_CHUNKS` + 报告落行）；`:603-625`（manifest 冻结 + 报告落行）。
- 落库：`apps/worker/src/ingest/ingest-report.ts:14-31`（快照字段：`chunkCount` / `internalDropped` / `crossDocDropped` / `conflictPairs` / `contextSource` / 双就绪 / 对账——**无 rate、无 searchable 占比**）；`:44-64` 插入映射。
- 表：`packages/db/src/schema/kb/ingest-reports.ts:15-33`（列 `internal_dropped` / `cross_doc_dropped` / `conflict_pairs` …；**无 rate 列**）。
- 契约：`packages/contracts/src/ingest/ingest-report.contract.ts:16-39`（`.strict()`）；`packages/contracts/tests/ingest/ingest-report-contract.test.ts:53-56` 明确断言「拒绝 Hit@k 与 pending_review 装齐字段」。
- 出口：`apps/api/src/services/ingest-reports.ts:36-49`（`toIngestReportItem`，无派生 rate）；`apps/api/src/routes/ingest-report.ts:30-38`（库级 GET，原样返回已落库行）。

缺：
- `dedupe_cross_doc_rate` 全仓 grep **零命中**（`rg 'dedupe_cross_doc_rate'` 无匹配）——PRD 要求的三个 `dedupe_*` 指标名一个都没落成字段。
- `chunks` 表无 `content_hash` / `duplicate_of` / `searchable` / `dedupe_status` 列（`packages/db/src/schema/kb/chunks.ts:6-19` 只有 `preview/bodyText/contextPrefix/tokenCount/mongoBodyId/meta`）；PRD §3.2 的四列全缺 → **落库层没有「被 skip 的 chunk 实体」**，只有计数 + 冲突对。
- 「高度重复」提示：无字段、无 UI、无阈值来源。

### 可动手性

- **`dedupe_cross_doc_rate` 一半：无前置**。最小闭环 = `ingestReports` 加 rate 列（或由 api 派生）+ `IngestReportItemSchema` 加字段 + admin 行展开展示。需要**在工单里写明口径**（PRD 只给名字不给公式）：建议 `crossDocDropped / (chunkCount + internalDropped + crossDocDropped)`，并在工单正文写明这是本轮口径而非 PRD 公式。
- **「高度重复」一半：有隐藏前置** —— 阈值「以数据 PRD 为准」，而 `prds/03-data` 未写任何阈值/占比定义；同时「剩余 searchable chunk 占比」的分子分母在现有落库形状下**不可直接计算**（缺 `searchable` 列，只能近似成 `chunkCount/total`）。硬做会同时发明「阈值数字」与「占比口径」两件事，触到「不发明未冻字段」的纪律。

### 被冻结 / 不许动

不触及。注意 `pending_review` 属候选 8，本轮不要连带做。

### 规模与验证

- 规模：**S**（≤1 包主导 + 契约/DB/API 各一处；≤3 文件）。
- 验证：worker 侧 `apps/worker/tests/ingest/ingest-report.test.ts`（现有断言「不含 hitAtK」，可加 rate 断言）；契约侧 `packages/contracts/tests/ingest/ingest-report-contract.test.ts`；api 侧 `apps/api/tests/ingest/ingest-report-http.test.ts`；DB 侧 `packages/db/tests/ingest/ingest-reports-schema.test.ts`。全部为纯单测，无需真集群。

---

## 候选 2 · metrics 的 `fallback` / `node_used` 维

### 功能表原文要求

- §10.3 可观测（第 576 行）逐字：「指标骨架 | `ask_*` / `llm_call_*` / `rerank_*`（含 fallback 与 node_used） | P2；完整直方图可 P4」
- §5.1 横切（第 355 行附近）：「请求日志上下文 | tenant / kb / user / requestId 可关联 Langfuse | P2」

### PRD 依据

| 条款 | 关键句 |
|------|--------|
| `prds/10-delivery/01-phased-roadmap.md`:85 | 「**指标骨架**：至少 `ask_*` / `llm_call_*` / **`rerank_*`**（含 fallback 与 node_used）可导出（完整直方图可 P4）」 |
| `prds/07-models/01-model-gateway.md` §5.1.1:214 | 「观测 ｜ `rerank_fail_total`、`rerank_fallback_used_total`、**`rerank_node_used{provider,model}`**、`rerank_latency_p95{node}`、`rerank_failover_rate_1h`；备用顶上超阈告警」 |
| 同文:235 | 「**fallback 可观测** ｜ `meta.fallbackUsed=true`；Langfuse generation metadata 记 `from_model`/`to_model`/`reason`」 |
| 同文 §9.2:530 附近 | 「同模型重试 429/timeout/5xx；`maxAttempts=2` 含首跳」 |
| `prds/08-quality/03-langfuse-observability.md`:49 | 「generations: 每次 Gateway 调用（含 fallback 元数据）」 |

属**必须级**：功能表与路线图都把「含 fallback 与 node_used」写在 P2 指称骨架里。

### 现状（IS · 源码证据）

已有：
- 计数器设施：`apps/api/src/obs/metrics.ts:39-51`（`metricInc` / `metricGet` / `metricsSnapshot`，标签排序拼 key）；出口 `apps/api/src/app.ts:80` `GET /metrics`（无鉴权）。
- ask 维：`obs/metrics.ts:63-69`（`ask_total{status,reason,plane}` / `ask_ok|ask_fail{reason,plane}`）；三平面配额 `:148-155`。
- llm 维：`obs/metrics.ts:140-142` `recordLlmCall(purpose, ok)` → `llm_call_total{purpose,ok,plane}`——**无 fallback 维**。
- rerank 维：`obs/metrics.ts:144-146` `recordRerank(ok, kind?)` → `rerank_total{ok,plane,kind?}`——**无 node / provider / fallback 维**。
- fallback 真值**已存在但被丢**：`apps/api/src/graph/run.ts:567-575`（包装 `gateway.chat` 时只取 `res.text`，`res.meta.fallbackUsed` 未使用）；`apps/api/src/services/gateway/types.ts:18-27`（`ChatResult.meta = { provider, model, attempt, fallbackUsed, latencyMs }`）；`http-client.ts:134-145` 与 `mock-client.ts:60-70` 都正确填 `fallbackUsed: ni > 0`。
- rerank 节点真值**存在但不出接口**：`apps/api/src/services/gateway/http-client.ts:197-259`（`for (let ei …)` 遍历 `cfg.rerankEndpoints`，`m = resolveRerankModel`；失败后继续下一 endpoint，但返回类型是裸 `RerankHit[]`）；`mock-client.ts:105-141` 同构；`types.ts:30-34` `rerank(...): Promise<RerankHit[]>`——**无 meta**。
- 现有测例：`apps/api/tests/obs/metrics.test.ts:22-37`（按标签聚合 ask / llm / rerank，含 `plane=ask`）。

缺：
- `llm_call_total` 无 `fallback` 标签（数据在手，`graph/run.ts` 一处即可补）。
- `rerank_total` 无 `node`；`rerank_fallback_used_total` / `rerank_fail_total` 不存在（PRD 07 §5.1.1 点名三个名字）。
- rerank 「node」的定义：rerank 没有 DB `ModelRef`（`resolve.ts:44-49` `purposeEndpoints.rerank` 只有 `baseUrl/apiKey/model`），所以 `provider` 需落到「端点 / 索引」上的口径——**这是口径选择，不是硬前置**。

### 可动手性

- **无硬前置，可最小闭环**。两条实现路线：
  - `llm_call_total{fallback}`：改 `graph/run.ts:567-575` 把 `res.meta.fallbackUsed` 传进 `recordLlmCall`（签名加可选参数）——**1 文件级**。
  - `rerank_*`：路线 A（小）：在 `createHttpGateway` / `createMockGateway` 的 rerank 分支内打点（`ei` 即 node、`m` 即 model、`ei>0` 即 fallback）——但把 metrics 放进 transport 层；路线 B（大）：`GatewayClient.rerank` 返回 `{hits, meta}`，会牵动 `retrieve.ts:261-276` 与所有注入 fake（`apps/api/tests/**` 多处）。**推荐路线 A**，并在工单写明「node = 绑定端点（provider 取端点标识/序位），不与 DB ModelRef 同义」。
- 需注意：`retrieve.ts:264/266/274` 已经在调用点打 `recordRerank(ok, kind)`，若客户端也打点，**必须避免同一次调用双计**（择一）。

### 被冻结 / 不许动

不触及任何锁定项。唯一红线：**不得**顺手把 `recordAskResult` / 三分面语义改掉（`ask_total{plane}` 已被 `apps/api/tests/obs/quota-planes.test.ts` 钉住）。

### 规模与验证

- 规模：**S–M**（1 主要包 `apps/api`，2–4 文件；若走路线 B 升 M）。
- 验证：`apps/api/tests/obs/metrics.test.ts` 扩断言（现有文件已按标签聚合，可直接钉 fallback/node 两维）；`apps/api/tests/gateway/generate-fallback.test.ts`（已有 fallback 触发路径可复用）；rerank 双节点测试 `apps/api/tests/gateway/resolve-mock.test.ts`。无需真集群。

---

## 候选 3 · 入库报告 L0 vs L1 Hit@k

### 功能表原文要求

- §5.2 资源组（第 370 行）：「入库报告 | `GET …/ingest-report` | 去重冲突对、L0/L1、跨 doc skip；**可抽样对照 L0 vs L1 的 Hit@k** | P1–P2」
- §10.2 评测门禁（第 568 行）：「检索层评测（召回门禁）：有 `expectedDocIds` 时 Hit@k 为硬门；试点 k=20、Hit@20 ≥70%。**入库报告可抽样对比 L0 vs L1 的 Hit@k**。关 L1 须在质量看板标注「召回增强关闭」」
- §4.3（第 299 行）：「入库报告 … 去重冲突对、L0/L1、跨 doc skip」

措辞是「**可**抽样对照 / **可**抽样对比」——是必达清单里带「可」的项目，不是「必须每次出数」。

### PRD 依据

| 条款 | 关键句 |
|------|--------|
| `prds/04-pipelines/01-offline-ingest.md` §4.2（218） | 「对比 | 入库报告可抽样对比 L0 vs L1 的检索回归（见评测 Hit@k）」 |
| `prds/04-pipelines/01-offline-ingest.md` §5.2（245–250） | 报告必出指标含 `contextualize_l1_ok` / `contextualize_l0_fallback` |
| `prds/08-quality/02-evaluation-and-gates.md` §3（85–89） | 「Hit@k｜Top-k evidence 命中任一 expectedDocIds｜有标注则硬门（试点默认 k=20，≥70%）」 |
| `prds/08-quality/02-evaluation-and-gates.md`:211 | 「切换 `contextMode` L0↔L1 … 须重跑 2×2 + Hit@k」 |
| `prds/05-api/01-http-api-hono.md`:155 | 「`GET …/ingest-report  # 去重/L1 指标`」 |

### 现状（IS · 源码证据）

已有：
- 报告的 `contextSource`（`l0` / `l0_fallback`）：`apps/worker/src/ingest/pipeline.ts:522-527`（读快照 `contextMode` → `resolveContextSource`）；落库 `apps/worker/src/ingest/ingest-report.ts:38-45`（`keepContextSource`）；API 侧 `apps/api/src/services/ingest-reports.ts:41-45`；契约 `packages/contracts/src/ingest/ingest-report.contract.ts:26`（`contextSource` 枚举 nullable）。
- Hit@k **只有评测侧**：`packages/contracts/src/eval/l1-matrix.ts:107-139`（`hitAtKCase` / `accumulateHitAtK` / `hitAtKRate`，`scored=0 → null`）；worker 批跑 `apps/worker/src/eval/*`（`run-l1-batch`，用例 `apps/worker/tests/eval/run-l1-batch.test.ts:49-71`）；api CLI `apps/api/src/scripts/run-l1-golden.ts`。

缺（关键）：
- 入库报告**结构性拒绝** hit 相关字段：`packages/contracts/tests/ingest/ingest-report-contract.test.ts:53-56`、`packages/db/tests/ingest/ingest-reports-schema.test.ts:30-33`、`apps/worker/tests/ingest/ingest-report.test.ts:50` 三处断言「不含 Hit@k」——即当前设计**有意**把它挡在报告之外。
- 报告与评测之间无任何关联列（无 `evalRunId` / `goldCaseKey` / 查询集引用）。

### 可动手性 —— **有隐藏前置，本轮不建议开工**

表面上看「给报告加个 Hit@k 字段」很小，但实际缺的是**数据载体**：

1. L0 vs L1 对比需要**同一篇文档存在两份可检索结果**。ADR-053 冻结「一篇文档的一个 `indexVersion` **只绑一套**策略（含 `contextMode` 快照）」，`prds/14` §14 又把「同一文档同一 `indexVersion` 并行多策略双索引」列为**非目标**；因此对比只能靠「跑两次 reindex = 两个 version 各自检索」。
2. 生产检索闸只认**当前激活 version**（`packages/contracts` / `apps/api/src/services/retrieve/corpus.ts:63-95`，谓词含 `index_version = 当前激活`），所以两个 version 无法同时被 ask 检索 → 没有「同一题集跑两遍」的现成载体。
3. 还缺「该文档的抽样题集 + `expectedDocIds`」来源：`fixtures/l1/gold.yaml` 是**逻辑 doc id**（`fixtures/l1/README.md`），与生产 `docId` 不直接对应；运营侧 `gold_questions.expectedDocIds` 目前只由反馈回流写入（`apps/api/src/routes/feedback.ts:213-258`，大多为 `null`）。
4. 叠加候选 6 未落（真 L1 不存在，`l1_llm` 现状一律 `l0_fallback`），「L1 侧」现在**没有真数据**。

结论：本项看似能做、实为只能产出假结果（与上一轮 `ask_traces.citations` 同类坑）。**需要先开一张决定工单**钉：①「抽样对照」的载体（离线 CLI 双跑？两 version 定向检索？）；②题集与 `expectedDocIds` 来源；③是否等候选 6 落地后再做。

### 被冻结 / 不许动

- ADR-053「一篇一策略」与 §14「同一 `indexVersion` 双策略双索引」= 冻结非目标，**不得**用「双索引」绕过。
- 「召回相关再认证」语义（`prds/08-quality`:211）不得被本功能替代或放宽。

### 规模与验证

- 规模：**M+**（worker + api + 契约 + 可能的评测面），且验证需要真语料两版索引 → 现阶段**无法用现有单测体系钉住**，需要真集群/真跑。

---

## 候选 4 · 在线编写完整体验余量（BlockNote 编辑器 / `editor-draft` 草稿）

### 功能表原文要求

- §4.3（第 292 行）：「在线编写 | 管理端写制度；提交走同一审批中心；通过后**服务端导出 Markdown** 再入库 | 审批闸 P2；**BlockNote 完整体验 P2.x**」
- §5.2（第 364 行）：「编辑器草稿 | `editor-draft` + `submit-approval` | 与 upload 同一审批中心；禁止旁路直写检索权威 | **P2.x 编辑器**；审批闸 P2 已存在」
- §13 分期（第 715 行附近，P2 列「仍可以没有」）明确把「**BlockNote 完整体验**」列入 P2 可缺
- §14（第 760 行）「延后但**属于最终产品范围**」：含「BlockNote 完整体验」

### PRD 依据

| 条款 | 关键句 |
|------|--------|
| `prds/05-api/01-http-api-hono.md`:141 | 「`POST /api/v1/knowledge-bases/:kbId/documents/editor-draft   # BlockNote 等：存 staging（P2.x）`」 |
| 同文:165 | 「upload / complete / **editor-draft** / submit | `doc.upload` / `doc.editor`」 |
| 同文:218 | 「**editor-draft / 提交发布（P2.x）**：write+ 保存 BlockNote staging；submit 建 ticket；UI **无感**导出 MD」 |
| `prds/03-data/01-postgresql-schema.md` §3.1（~236） | `approval_tickets` 行含「`staging_ref` 编辑器 staging 指针（可选）」 |
| ADR-048（`prds/11-decisions/00-adr-index.md`:1116、1166–1167） | 「P2.x（紧随，不挡 L1 若仅文件上传）：**BlockNote** 编辑 UI + `editor_blocknote` 源 + 服务端 MD 导出；与审批中心同一套票」「P2 签字：可写「入库前审批」；**BlockNote 未交付时不写「在线编辑器必达」**」 |

属**必须级但明标 P2.x / P2 可缺**——不是 P2 阻断项。

### 现状（IS · 源码证据）

已有（Markdown 最小闭环）：
- HTTP：`apps/api/src/routes/documents/index.ts:282-350`（`POST …/documents/write`，`requirePermissionWhenEnforced('doc.editor')`；`contentType: 'text/markdown'`、`sourceType: 'write'`、进 pending、**不入队 scan**）。
- 契约：`packages/contracts/src/ingest/document.contract.ts:114-117`（`WriteDocumentResponseSchema` 固定 `sourceType: 'write'`）；`WriteDocumentBodySchema` 要求 title + markdown。
- admin：`apps/admin/src/app/(ops)/documents/write.services.ts:14-34`（`canSubmitWrite` / `writeAdminDocument`）；`.../documents/_components/documents-workspace.tsx:418-440`、`:775-781`（编写区 + 提交按钮）。
- 测例：`apps/api/tests/ingest/write-document-http.test.ts`、`apps/admin/tests/ops/document-write.test.ts`。

缺：
- `editor-draft` 路由**不存在**（全仓 grep 零命中）；`submit-approval` 路由**不存在**（全仓 grep 零命中）——PRD §2.3 列的两个端点都没落。
- staging 落点**不存在**：无 `approval_tickets` 表、无 `staging_ref` 列（`packages/db/src/schema/` 全量 grep `stagingRef|approvalTickets` 零命中）；审批真相现由 `documents.approval_status` 投影（`packages/db/src/schema/kb/documents.ts:18`），与 PRD §3.1「以 ticket 为准（实现二选一）」的另一种实现。
- BlockNote：**无该依赖**（`apps/admin` 无 blocknote 依赖，产品线稿只在 `product.pen` 出现「在线编写 · BlockNote → 服务端 MD」字样）。
- 编辑器形态是「标题 + Markdown textarea」，草稿自动保存 / 富文本 / 服务端 MD 导出链路均无。

### 可动手性 —— **有隐藏前置，本轮不建议开工**

表面「加个 draft 端点 + 装 BlockNote」即可，实际缺三处设计决定：

1. **staging 落点未冻**：PRD 说「存 staging」，`03-data` 只给了 `approval_tickets.staging_ref`（可选）这一种可能；但本仓没有 ticket 表。新列 / 新表 / RustFS 对象三选一，属**新数据落点**决定（且 `approval_tickets` 与现有 `documents.approval_status` 的「单一权威」关系未收口）。
2. **`submit-approval` 语义未冻**：现在 `write` 已自动进 pending；`editor-draft` + `submit-approval` 两段式的状态机（draft → submitted → pending？）在 05-api 只有一行注释，**没有字段/响应契约**。
3. **BlockNote 是前端新依赖 + 大幅 UI 面**（≥1 新依赖入 `catalog:`、编辑器组件、导出 MD 的服务端链路），且 P2 明确「可没有」。

### 被冻结 / 不许动

- §14 冻结：「**未审批即 scan / 编辑器旁路直写**」禁止 —— 任何编辑器实现**不得**绕审批。
- 地图 Out of scope 同样锁「未审批就 scan」。
- 「人签 / 准出」与 BlockNote 交付无绑定关系（ADR-048 明确 P2 签字可不含 BlockNote）。

### 规模与验证

- 规模：**M–L**（api + db/迁移 + admin + 新依赖）。
- 验证：`documents-workspace.tsx` 有 RTL 面（`apps/admin/tests/ops/documents-workspace.test.tsx`）可钉 UI；api 侧可加 HTTP 测例（沿用 `write-document-http.test.ts` 风格）。**不需要真浏览器**，但 BlockNote 的富文本行为在 jsdom 下保真度有限，真体验需手测。

---

## 候选 5 · 上传的 MD/TXT 更严体积档 + 文件魔数嗅探

### 功能表原文要求

- §5.2（第 363 行）：「文档上传 | `upload-url` → `complete` | complete 权威校验 size/MIME/checksum；默认 50 MiB、天花板 200 MiB（**MD/TXT 可更严**）；MIME 白名单；只登记对象 + 建审批单，禁止直接入队 scan | P2」
- §6（第 471 行）：「文件硬上限：默认 50 MiB / 文件，天花板 200 MiB；**MD/TXT 可更严**。权威闸在 complete Head 对象，禁止只认 key 存在。」
- 审查报告（`prds/12-delivery-guides/14-模块需求功能表-审查报告.md`:167）把「MIME 白名单 + 50 MiB 默认 / 200 MiB 天花板；MD/TXT 可更严」列为 **P1 缺口**。

**文件魔数（magic number）嗅探：功能表与 `prds/00–11` 均无此要求。** 全仓 grep `文件头|magic|%PDF|魔数`（`prds/` 与 `apps/`）零命中；`packages/contracts/tests/ingest/upload-media.test.ts` 的断言口径写明「白名单 SSOT；**不嗅魔数**」。它只出现在 `docs/module-status/api.md:162` 的「明确未做」行。→ 若要做，属**加固而非必达**，本轮应显式标注来源。

### PRD 依据

| 条款 | 关键句 |
|------|--------|
| `prds/09-security/01-auth-acl-compliance.md` §7（353–355） | 「MIME 白名单 ｜ 1–2 ｜ 矩阵内类型（pdf/docx/md/txt…）；禁止可执行与未知 octet-stream 默许」；「**单文件大小 ｜ 1–2 ｜ 默认 50 MiB；可配；硬天花板 200 MiB；可选 MD/TXT 更严（建议 10 MiB）**」；「权威 size 闸 ｜ 1–2 ｜ `complete` Head 对象（size + MIME/扩展名 + checksum）；预签名/前端仅纵深；**同一配置源**」 |
| `prds/05-api/01-http-api-hono.md` §2.3 complete:203-208 | 「服务端校验：实际 size ≤ `INGEST_MAX_FILE_BYTES`（默认 50 MiB，≤ 天花板 200 MiB）、MIME/扩展名白名单、checksum（与登记一致）」 |

「其实 size 闸在 Head」+ 天花板是**必须级**；「MD/TXT 更严」是**可选（建议 10 MiB）**。

### 现状（IS · 源码证据）

已有：
- 体积闸（单一配置源）：`apps/api/src/env.ts:67-69`（`INGEST_MAX_FILE_BYTES` 默认 52_428_800 / `…_CEILING` 默认 209_715_200）；`:176-183` 越天花板拒启动；`apps/api/src/services/storage.ts:246-248` `effectiveMaxUploadBytes() = min(上两者)`；闸函数 `apps/api/src/gates/upload-size.ts:5-12`。
- complete 权威路径：`apps/api/src/services/ingest-complete-pending.ts:169-199`（`headObject` 存在性 + `checkUploadMedia` + `checkUploadByteSize`）；**`:200-209` 已把整个对象读进内存**（`getObjectBuffer` → `createHash('sha256')`）→ 嗅探所需字节**现成在手**。
- MIME 白名单：`packages/contracts/src/ingest/upload-media.ts:6-17`（`ALLOWED_INGEST_CONTENT_TYPES` / `ALLOWED_INGEST_EXTENSIONS`）、`:46-55` `isAllowedIngestMedia`、`:58-72` `resolveIngestContentType`；闸壳 `apps/api/src/gates/upload-media.ts:1-11`（未知 / `octet-stream` → 415）。
- write 路径同闸：`apps/api/src/services/ingest-complete-pending.ts:60-78`（先 media 后 size）。
- 测例：`apps/api/tests/ingest/complete-size.test.ts`、`complete-media.test.ts`、`upload-media.test.ts`。

缺：
- **无按族（MD/TXT）更严上限**：`checkUploadByteSize(head.byteSize, max)` 单一 `max`，`env.ts` 无 `INGEST_MAX_FILE_BYTES_TEXT` 之类的变量；admin 上传侧 `apps/admin/src/app/(ops)/documents/upload.services.ts` 亦无族级上限。
- **无文件头嗅探**：`checkUploadMedia` 只比对声明 MIME + 扩展名，不看字节（声明 `application/pdf` 但内容是任意字节也会过）。

### 可动手性 —— **无硬前置（嗅探需标注来源）**

- MD/TXT 更严档：**S**。做法：`env.ts` 加 `INGEST_MAX_TEXT_FILE_BYTES`（默认留空 = 回落通用上限，避免静默改变现有行为）；闸函数按 `resolveIngestContentType` 判定族后取 `min(通用, 族级)`；`upload-url` 响应可回传 `maxBytes`（PRD §2.3:198 说 `maxBytes` 是纵深非权威）。
  - **一个口径待确认**：PRD 写「可选 / 建议 10 MiB」。若要让默认生效（10 MiB），属改默认口径，建议工单里显式写明「默认是否取 10 MiB」；不确认则默认留空、只提供能力。
- 魔数嗅探：**S**，字节已在 `ingest-complete-pending.ts:200` 手上。保守版：只对**魔法唯一**的类型硬判（PDF `%PDF-`；DOCX/ZIP `PK\x03\x04`；DOC/OLE `D0 CF 11 E0`；md/txt 要求合法 UTF-8 且无 NUL），不一致 → 415 / 400，并**只在声明类型已知时判**以免误杀。
  - **必须标注**：「魔数嗅探无 PRD 依据」，本轮若做应作为 ADR-039 的加固增量在工单里说明，**不得**回写成 PRD 必达；且需注意误杀风险（带 BOM 的 md、无扩展名 txt）。
  - 若只做「更严体积档」，则该项可整体不做，避免发明。

### 被冻结 / 不许动

- 「真引擎选型（ES/IK/RustFS/杀毒）」锁死 —— **不要**顺手把真实杀毒 / 扫描引擎拉进来（QUAL-2 仍在债表）。
- §14「未审批就 scan」不得因上传加固而松动。

### 规模与验证

- 规模：**S**（`apps/api` 为主，≤4 文件：`env.ts` / `gates/*` / `ingest-complete-pending.ts` / `storage.ts`，外加契约与 admin 展示可省）。
- 验证：`apps/api/tests/ingest/complete-size.test.ts`（已有 size 闸测例，可扩族级用例）、`complete-media.test.ts`（可加魔数用例）、`apps/api/tests/env/defaults.test.ts`（新 env 默认值）。纯单测，无需真集群。

---

## 候选 6 · 真 L1 `contextualize`（worker 侧 L0 模板 → 真 LLM contextualize）

### 功能表原文要求

- §0 检索核（第 68–69 行）：「情境前缀 | **L0 规则前缀；L1 可选 LLM `contextualize`** | `sparseText = contextPrefix + "\n" + body`；embed 用 prefix+body」
- §6 worker（第 463 行）：「`ingest.contextualize` | 可选 L1 LLM 前缀 | 失败/触顶 回退 L0，块仍可索引；禁止 skip chunk 仍 ready；关 L1 须 `contextMode=l0_template` | **P1**」
- §9.1（第 516 行）：「contextualize | 入库 L1 | **P1**」
- §10.2（第 567 行）：「召回相关再认证（须重跑 2×2 + Hit@k，不得当换皮）：… 切换 `contextMode` L0↔L1 …」

### PRD 依据

| 条款 | 关键句 |
|------|--------|
| ADR-013（`prds/11-decisions/00-adr-index.md`:95-98） | 「生产默认 **L1 LLM contextualize**（Gateway `purpose=contextualize`），失败回退 **L0 标题路径模板**；允许 KB 显式关 L1 … 须打点 `context_source`」 |
| `prds/04-pipelines/01-offline-ingest.md` §4（194–198） | 「L0｜模板｜`contextPrefixTemplate`，如 `{doc_title} / {section_path}`；无路径时仅用 doc_title｜MVP 兜底；L1 失败回退」「L1｜LLM｜经 Model Gateway，`purpose=contextualize`，temp=0；输出 ≤25 词单句，置于 body 前｜**默认推荐**（`contextMode=l1_llm`）」 |
| 同文 §4.1（199–209） | 已冻提示模板：`文档标题: {title}` / `文档摘要/前缀: {doc_excerpt 最多 N 字}` / `块正文: {chunk}` / 「只输出这一句，不要引号与解释」 |
| 同文 §4.2（210–218） | 「失败 → 回退 L0，块仍可索引；`chunks.context_source = l0_fallback`」「成功 → `context_source = l1_llm`；原文 body 不变，仅 prefix」「批处理…结果 checkpoint，重跑可跳过已有 prefix」「费用：按 tenant 打点」 |
| 同文「Phase 约束」（220–224） | 「Phase 1 出口：至少 L0 全量可用；**建议 L1 可开关且默认 on**」 |
| `prds/03-data/01-postgresql-schema.md`:246 | 「context_source | `l0_template` / `l1_llm` / `l0_fallback`」 |

属**必须级（P1 入场）**。

### 现状（IS · 源码证据）

已有：
- chunk 阶段读快照并写 prefix：`apps/worker/src/ingest/pipeline.ts:522-527`（`parseContextMode(doc.chunkStrategyParams?.contextMode)` → `resolveContextSource` → `l0ContextPrefix(doc.title)`）；写入 `:551-553`（`contextPrefix: prefix`）。
- 契约明确**故意**不落 `l1_llm`：`packages/contracts/src/ingest/chunk-strategy.ts:43-48`（`CONTEXT_MODES=['l0_template','l1_llm']` 但 `CONTEXT_SOURCES=['l0','l0_fallback']`，注释「l1_llm 成功要等 Gateway contextualize，禁止先写」）；`:71-73` `resolveContextSource(mode) = mode==='l0_template' ? 'l0' : 'l0_fallback'`；`:50-54` 默认参数 `contextMode: 'l1_llm'`。
- **worker 侧已有真 HTTP 网关调用先例**：`apps/worker/src/ingest/embed-http.ts:9-36`（OpenAI 兼容 `/embeddings`，可注入 `fetchImpl`）；调用点 `pipeline.ts:693-714`（`INGEST_EMBED_MODE==='http'` → `GATEWAY_BASE_URL` + `GATEWAY_API_KEY` + `GATEWAY_EMBED_MODEL`，失败 `EMBED_FAILED`）。→ 「worker 没有网关客户端」这一前置**不成立**，同型模式可直接复制。
- env：`apps/worker/src/env.ts:32-33,47`（`GATEWAY_BASE_URL` / `GATEWAY_API_KEY` / `GATEWAY_EMBED_MODEL`；**无** `GATEWAY_CHAT_MODEL` / `GATEWAY_MODE` / contextualize 开关）。
- 测例：`apps/worker/tests/ingest/context-mode-obey.test.ts`（服从快照写 L0 prefix）；覆盖表 `docs/testing/coverage/03-ops.md:93`（R7「contextualize 429 耗尽 → L0 索引；`contextualize_l0_fallback`」标「延后 / 无 contextualize 实现」）。

缺：
- 无 `purpose=contextualize` 的 chat 调用（worker 内 grep `contextualize` 零命中）；无 `contextualize-http.ts` 同型模块。
- `CONTEXT_SOURCES` 不含 `l1_llm` → 即使调通也无处落库（需扩契约 + DB 校验 + 报告 `keepContextSource` 白名单 `ingest-report.ts:38-45` + api mapper `services/ingest-reports.ts:41-45`）。
- 指标 `contextualize_l1_ok` / `contextualize_l0_fallback`（PRD 04 §5.2 / §4.2）全仓 grep 零命中。
- **无** per-block checkpoint（PRD §4.2「结果 checkpoint，重跑可跳过已有 prefix」）；现有幂等只在 manifest / embed 层（`apps/worker/src/ingest/idempotency.ts`）。

### 可动手性 —— **无硬前置，可最小闭环（注意默认口径）**

- 最小闭环 = 新增 `apps/worker/src/ingest/contextualize-http.ts`（照 `embed-http.ts` 同型：可注入 `fetchImpl`，temp=0，prompt 用 §4.1 冻结模板）+ env 开关（如 `INGEST_CONTEXTUALIZE_MODE=mock|http|off`，**默认 off/mock 以保 CI**）+ `pipeline.ts` chunk 段按块调用、失败回退 L0（`l0_fallback`）、成功写 `l1_llm` + 扩 `CONTEXT_SOURCES` + 报告/metrics 同步。
- **一处口径待确认（非硬前置）**：ADR-013 与 PRD §4「建议默认 on」——是否把默认改为真 L1？建议本轮**默认关 / 显式开启**（无真 Gateway 时默认 on 只会全量落 `l0_fallback`，反而污染报告），把「默认开」留给配置/运营决定。
- 成本与限流：PRD §4.2「按 tenant 打点」+ ADR-044「L1/入库归 ingest 平面」；地图已把 `embed TPM / maxEmbedCalls` 划出，故本轮只做「失败回退 + 打点」，**不要**顺手加库级 TPM 硬闸。

### 被冻结 / 不许动

- 「真引擎选型」锁死 —— contextualize 走 **HTTP OpenAI 兼容**（§0 模型访问表），**不得**在 worker 内 `new` 厂商 SDK / 加载本地权重。
- 不得把 `l1_llm` 当成「已实现」写进 module-status 而不指源码。

### 规模与验证

- 规模：**M**（`apps/worker` 主导 + `packages/contracts` 一处枚举 + api 报告白名单一处；约 6–8 文件）。
- 验证：可完全用现有单测体系钉住——`apps/worker/tests/ingest/context-mode-obey.test.ts` 扩「http 成功写 `l1_llm` / 失败回退 `l0_fallback`」；新增 `contextualize-http.test.ts`（注入 `fetchImpl`，429/超时/空输出三例，对齐 `embed-http` 的测法）；契约 `packages/contracts/tests/ingest/context-mode.test.ts` 扩枚举。**不需要真 LLM 集群**（注入 fake fetch 即可），live 真跑另算。

---

## 候选 7 · 入场 `aclPrincipals` 的剩余面

### 功能表原文要求

- §11 安全与权限（第 592 行）：「文档 ACL | `aclPrincipals` 进索引；dense 与 ES 对称 filter；`[]` = 不可读；收紧须 reindex | **P3b**」
- §5.2（第 382 行）：「文档 ACL | `GET/PUT …/documents/:id/acl` | principals；缺省字段语义见安全 PRD | **P3b**（P2 可无端点，但禁止导入敏感语料）」
- §4.3（第 293 行）：「部门与可见级别 | 上传/编辑/列表可标所属部门、可见级别 | P2 字段；检索强制 P3b」

### PRD 依据

| 条款 | 关键句 |
|------|--------|
| `prds/09-security/01-auth-acl-compliance.md` §3.6（207–210） | 「其他 doc_acl ｜ user 显式 principals 等 ｜ P3b 可叠加」 |
| 同文 §3.6.1（213–221） | 「dense ∥ ES ｜ 共用 `buildAclFilter`；禁止仅 ES 滤、dense 裸召回」「P3b 缺省 ｜ **字段缺失 = 成员可读；`[]` = 成员不可读**」 |
| `prds/05-api/01-http-api-hono.md` §2.4（231–236） | 「### 2.4 文档 ACL（Phase 3；P2 可无端点但不可导入敏感库）」+ 端点 `GET/PUT /api/v1/documents/:docId/acl` |
| `prds/03-data/01-postgresql-schema.md` §3.1 | `documents.acl_principals` 列语义（与实现一致） |

### 现状（IS · 源码证据）

已有：
- 判定函数：`apps/api/src/services/retrieve/doc-acl.ts:1-20`（`null` = 可读；`[]` = 不可读；否则按 `userId` 命中）。
- 查询/详情/分片同一闸：`apps/api/src/routes/documents/index.ts:739-741`（详情 403）；`apps/api/src/services/chunks.ts:30,60-66`（分片列表带 `aclPrincipals` 后滤）；语料 `apps/api/src/services/retrieve/corpus.ts:86-95`（部门滤**之后**再 `filterDocsForAclPrincipals`）。
- 写面：`PATCH /documents/:docId` 支持 `aclPrincipals` 三态（`routes/documents/index.ts:679-685` → `services/documents.ts:276`）；complete / write 也可带（`services/ingest-complete-pending.ts:238-255`、`routes/documents/index.ts:305-345`）。
- 索引侧：`apps/api/src/services/retrieve/es-sparse.ts:31-52`（mapping `aclPrincipals: keyword`、`[]` 写哨兵 `__acl_none__`、`should` = 缺字段可读 ∪ `term userId`）；worker bulk 同构（`apps/worker/src/ingest/es-http.ts`，见 module-status worker:68-69 行）。
- ES 结果与 PG 语料求交：`apps/api/src/services/retrieve/retrieve.ts:196-197`（`sparseRanked.filter((id) => byId.has(id))`）→ **PG 现值是权威**，故「收紧」即时生效；索引侧滞后不构成泄漏。
- 测例：`apps/api/tests/acl/doc-acl-principals.test.ts`、`documents-acl-principals.test.ts`、`apps/api/tests/ask/es-principals-query-filter.test.ts`、`apps/api/tests/ingest/sensitive-complete.test.ts`、`packages/db/tests/ingest/documents-schema.test.ts`。

缺（剩余面）：
1. **`GET/PUT /api/v1/documents/:docId/acl` 端点不存在**（PRD 05-api §2.4 冻结；全仓无 `/acl` 路由）。现状靠 `PATCH /documents/:docId` 的多用途入口代偿。
2. **admin 侧无用户选择器**：名单靠 Textarea 逗号/换行手填 uuid（`apps/admin/src/app/(ops)/documents/_components/documents-workspace.tsx`，见 module-status admin:38）；无用户下拉。
3. **收紧时的 reindex 未做**（覆盖表 `docs/testing/coverage/02-acl.md:43` B2-2 标「延后」）——注意：PG 闸即时生效 + ES 结果与 PG 求交，所以**安全上不是洞**，只是索引与现值不一致；若要做需在工单里说清「不是修洞」。
4. dense 单路负向夹具缺（`docs/testing/coverage/02-acl.md:44` B2-3）。
5. 相邻但不同项：`allowedDocIds` / `ACL_DOC_IDS_MAX` / `acl_filter_too_large` 缺实现（`docs/testing/coverage/02-acl.md:36` B1-A4；`packages/contracts/src/ask/reason.ts:23` 有码、`apps/api/src/graph/reasons.ts:93` 有文案、`retrieve.ts` 从不返回）——属**成员 `allowedDocIds` 面**，不是 `aclPrincipals`，本轮若要碰需单独裁。

### 可动手性

- **端点 + admin 选择器：无硬前置**（S–M）。PUT body 形状可在「§3.6.1：字段缺失 = 成员可读；`[]` = 成员不可读」上直接定为 `{ aclPrincipals: string[] | null }`，与现有 `PATCH` 三态一致；权限可复用现有 `doc.view` / `doc.editor` 组合。**但**：P3b 的完整入场被两个锁定项挡住（见下），端点是 P3b 的**提前子面**，工单需写明「不改变仓库默认检索语义、不默认开强制」。
- reindex-on-tighten：**有隐藏前提**（要先说清它解决的不是安全问题，而是索引一致性；且需决定用哪种 reindex 触发路径，触到 ADR-053「改配置不自动全库 reindex」语义）。

### 被冻结 / 不许动

- 「仓库默认开 `DEPT_ACL_ENFORCE`」、「角色 principal」、「ADR-057 全文未上」——**锁死，不得提议解锁**。
- §14 / §11：「敏感语料（薪酬/纪要/未脱敏人事）在 ACL 就绪前禁止入池」——不得因本项开敏感库口子。
- P3b 的另一半（部门强制默认开）不在本图范围。

### 规模与验证

- 规模：**S–M**（`apps/api` 路由 + 契约 + admin；约 4–6 文件）。
- 验证：现有测例可钉——`apps/api/tests/acl/documents-acl-principals.test.ts`（三态）、`apps/api/tests/acl/doc-acl-principals.test.ts`；新增 acl 端点的 HTTP 测例沿用同风格；admin 侧 `documents-workspace.test.tsx` 有 RTL 面。无需真集群（memory repo 已有先例）。

---

## 候选 8 · `pending_review`（入库报告 / 状态机）

### 功能表原文要求

- §4.3（第 299 行）：「入库报告 | 文档页抽屉或同页：去重冲突对、L0/L1、跨 doc skip；**`pending_review` 须人工二选一** | P1」
- §6（第 473 行）：「动作默认 `skip_index`，可选 `downrank` / `pending_review`（**须人工二选一，禁止无提示静默丢条款**）」
- 审查报告（`prds/12-delivery-guides/14-模块需求功能表-审查报告.md`:154）：「跨 doc 去重 `pending_review` 人工二选一 | P1 | 入库 PRD §5.1」

### PRD 依据

| 条款 | 关键句 |
|------|--------|
| `prds/04-pipelines/01-offline-ingest.md` §5.1（235–243） | 「`pending_review`｜**近似但可能效力不同**（管理员标记或启发式）：不静默 skip，入审队列，**双方可暂均 index 或均不 index（KB 策略）**；须人工二选一」；「跨 doc 命中时入库报告必须可点开冲突对」 |
| `prds/03-data/01-postgresql-schema.md` §3.2（249–251） | 「`duplicate_of` ｜ 跨 doc 去重命中权威 chunk；**冲突待审**可 `dedupe_status=pending_review`」「`searchable` ｜ bool；duplicate skip 时 false」 |
| `prds/10-delivery/01-phased-roadmap.md`:32 | 「doc 内 + 跨 doc 去重（默认 on；冲突可 pending_review）」 |
| ADR-014（`prds/11-decisions/00-adr-index.md`:100-105） | 「偶发「近似但需并存」条款可用 `downrank` 或白名单」 |

### 现状（IS · 源码证据）

已有：
- 动作字面量**收窄为唯一值**：`apps/worker/src/ingest/cross-doc-dedupe.ts:19-23`（`action: 'skip_index'`）、`:52-66`（命中即返回该动作）；契约 `packages/contracts/src/ingest/ingest-report.contract.ts:5-13`（注释明写「pending_review / downrank 不在本形状」），并被 `packages/contracts/tests/ingest/ingest-report-contract.test.ts:57-60` 断言拒绝 `action:'downrank'`。
- 行为：命中即 `continue`（不写 chunk、不进 manifest、不写向量 / ES）——`apps/worker/src/ingest/pipeline.ts:534-541`。
- admin 只读展示冲突对：`apps/admin/src/app/(ops)/documents/_components/documents-workspace.tsx` 行展开（见 module-status admin:41），**无任何决定按钮**。

缺：
1. **无 KB 策略面**：`crossDocDedupeAction` 全仓 grep 零命中（无 env、无 KB config、无策略参数位）。
2. **无落点**：`chunks` 表无 `duplicate_of` / `dedupe_status` / `searchable` / `content_hash`（`packages/db/src/schema/kb/chunks.ts:6-19`）→ 「冲突待审的实体」无处存，只有报告里的 `conflictPairs` 计数对。
3. **无人工决定入口**：05-api §2.3 端点表里**没有任何**去重审核端点（唯二相关的是 `GET …/ingest-report` 只读）；也没有「审队列」表。
4. **无检索语义**：`searchable=false` 的「双闸门之外再一层」不存在；若 pending 期间双方都不索引，需与「searchable chunk 集被清空 → 不得 ready」（§6）协调，这套语义未实现。

### 可动手性 —— **有隐藏前置，本轮不建议开工**

表面「加个字段 + 加个按钮」很小，实际至少要三处**未冻接口/落点**先钉：

1. **安全落点**：`duplicate_of` / `dedupe_status` / `searchable` 三列（03-data 已命名）+ 迁移，还是复用 `ingest_reports.conflictPairs` 加状态？→ 需决定工单。
2. **人工决定的 API 形状**：05-api 未冻（谁有权？`doc.view`+ 还是新码？决定后「双方均 index / 均不 index」怎么表达？审批中心复用还是新队列？）；PRD 又明确「本表也不发明字段」。
3. **KB 策略面**：`crossDocDedupeAction` 作为 KB 级配置，落在 `kb_chunk_strategies` 还是 `config_json`？ADR-053 的三层对象没有这个键。
4. 连带：一旦有了 `searchable`，`loadCorpusFromDb`（`apps/api/src/services/retrieve/corpus.ts:63-95`）、ES bulk（worker / api 两侧）都要跟改，否则「均不 index」语义落不了地。

### 被冻结 / 不许动

不触及锁定项；但要注意 §6「searchable chunk 集被去重清空 → 不得 ready」不得因 pending 而放宽。

### 规模与验证

- 规模：**M–L**（db/迁移 + worker + contracts + api + admin）。
- 验证：可在 `apps/worker/tests/ingest/cross-doc-skip-index.test.ts` / `cross-doc-dedupe.test.ts` 上扩三动作用例；api 侧需新 HTTP 测例；admin RTL 有 documents 面。**但前置未解前无法开工**，无验证对象。

---

## 候选 9 · QUAL-G3 `gold.yaml` 审核闸

### 功能表原文要求

**功能表里没有这一条。** 全表检索「gold.yaml」零命中；最接近的是：
- §4.1 反馈队列（第 261 行）：「反馈 | 反馈队列 | `feedback.queue` | 差评/缺文档集中处理，**回流补库或黄金集** | P2」
- §12.4（第 668–678 行）：「纳入黄金集 → eval.run」
- §10.2（第 557 行）：「评测 | 黄金集 / 跑批 | `eval.run` | 标准考题维护 + 批量跑问答出报告 | P2 底线；门禁包完整化 P4」

本项实际出自 **测试覆盖表**：`docs/testing/coverage/03-ops.md:27` G3「提名黄金集须测试/产品审核后才进 gold | P2必签 | 部分测 | …**缺：未审不得进 `gold.yaml`（QUAL-G3 工程种子仍缺口）**」，以及 `docs/testing/coverage.md:84`「G3→QUAL-G3（运营表回流已部分测；**gold.yaml** 审核闸仍缺）」。

### PRD 依据

| 条款 | 关键句 |
|------|--------|
| `prds/08-quality/02-evaluation-and-gates.md` §1.1（52–65） | RACI：「提名进入黄金集 ｜ 知识管理员提议」「**审核入库黄金集 ｜ 测试 + 产品（R/A）；业务方 C**」「拒绝滥用题 ｜ 测试」 |
| 同文 §1（39–47） | 黄金集字段：`id` / `question` / `type` / `expectedDocIds` / `expectedChunkIds` / `rubric`；**无审核字段** |
| `fixtures/l1/RACI.md`（第 26–36 行） | 「§2 题面审核记录（可归档）」= **手写 markdown 表格**（日期 / 审核人 / 范围 / 结论）——即当前「审核」的落地形态 |
| ADR-019（`prds/11-decisions/00-adr-index.md` 反馈闭环） | 运营黄金集写入路径（见 api `routes/feedback.ts`） |

属「测试必签项」，但**PRD 没写实现形态**（谁审、审在哪、怎么挡）。

### 现状（IS · 源码证据）

已有：
- 运营表回流：`apps/api/src/routes/feedback.ts:213-258`（PATCH `promoted_to_gold` 须 `eval.run` + `goldType` → `goldService.create` 直插 `gold_questions`）。
- 运营表结构：`packages/db/src/schema/ask/gold-questions.ts:9-24`（`caseKey/question/type/expectedDocIds/expectedChunkIds/rubric`；**无 `reviewedBy` / `reviewedAt` / `reviewStatus`**）。
- 文件黄金集：`fixtures/l1/gold.yaml`（**静态仓库文件**，CLI 读取 `apps/api/src/scripts/run-l1-golden.ts:206,269-281`；无写入路径）+ `fixtures/l1/RACI.md`（手写审核记录）。
- 测例口径：`apps/api/tests/index.md:105`「审核闸 = 队列点纳入；**不写 gold.yaml**、不入队评测」；`apps/api/tests/feedback/promote-gold.test.ts:3` 同义。

缺：
- **运营黄金集与 `gold.yaml` 之间没有任何数据通道**（既不导出也不引用）→ 「未审不得进 gold.yaml」当前**无对象可挡**。
- 无审核状态字段、无审核角色/码、无审核动作端点。
- 覆盖表自己也写明「运营表回流已部分测；gold.yaml 审核闸仍缺」。

### 可动手性 —— **有隐藏前置，本轮不建议开工**

要落地必须先定三件事，且都在**未冻接口/角色**区：
1. **审核主体**：RACI 写「测试 + 产品」，但 `packages/admin-catalog` 的权限码里没有对应角色；用哪个码（`eval.run`？新码？）→ 需决定。
2. **落点**：`gold_questions` 加 `reviewedBy/reviewedAt`，还是单独审核表 / 复用审批中心（ADR-048 那套只服务入库，不服务评测题）→ 需决定。
3. **`gold.yaml` 与运营表的关系**：是「运营表导出到 gold.yaml（需人工/自动导出流程）」，还是「`gold.yaml` 仅工程 seed、审核闸只约束运营表」？现状是后者（且测试断言「不写 gold.yaml」）。**若不先改这个定位，所谓「审核闸」只能产出假结果**（与工单 92 的 `ask_traces.citations` 坑同型）。
4. 与锁定项相邻：地图锁「人签 / 准出」——本题不是签字包，但语义上与「谁有权让题进门禁集」重叠，**建议与准出议题一起裁**。

### 被冻结 / 不许动

- 「人签 / 准出」锁死：**不得**借本项实现签字包或改 `signoffEligible` 公式。
- 不得把「运营表已回流」写成「gold 审核闸已齐」。

### 规模与验证

- 规模：**S–M**（若只做字段+校验）／**M**（若含导出链路）。
- 验证：可单测钉（`apps/api/tests/feedback/promote-gold.test.ts` 扩「未审不得进」；契约 `packages/contracts/tests/ask/feedback-promote-gold.test.ts`）。**但前置未解前不开工**。

---

## 候选 10 · 站规债：admin 原生 `<select>` + 旧 ui `Select` 清扫

### 功能表原文要求

**功能表无此行**——这是**站规**，出处是地图 Notes：
- `.scratch/fill-must-haves/map.md`「站规（UI）」：「web / admin 新下拉必须基于 `@strict-rag/ui` **关闭列表**，禁止浏览器原生 `<select>` 外壳（含现有 ui `Select`）。`Button` / `Input` / `Textarea` 仍走 ui 包。本规不改 GET / 鉴权语义。」
- `map.md`「Not yet specified · 站规债（UI）」：「admin 仍有 20 处原生 `<select>` + 4 处旧 ui `Select`（documents 7 · departments 6 · models 3 · settings 2 · chunk-strategy-panel 1 · eval 1；login / chunks / members 用旧 ui `Select`）；**web 已清零**。是站规余量，不是功能表语义，可另批清扫」

### PRD 依据

无 PRD 必备级条款（功能表 §4 只写一级/二级菜单与权限码，不规定下拉实现）。**明说：这一项没有 `prds/00–11` 依据，依据是地图站规本身。**

### 现状（IS · 源码证据）

**原生 `<select>` 20 处（grep `<select` 计数 = 20，与地图一致）**：

| 文件 | 处数 | 行号 |
|------|------|------|
| `apps/admin/src/app/(ops)/documents/_components/documents-workspace.tsx` | 7 | 702 / 805 / 842 / 931 / 963 / 1002 / 1136 |
| `apps/admin/src/app/(ops)/departments/_components/departments-workspace.tsx` | 6 | 345 / 433 / 467 / 519 / 549 / 567 |
| `apps/admin/src/app/(ops)/models/_components/models-workspace.tsx` | 3 | 320 / 406 / 475 |
| `apps/admin/src/app/(ops)/kb/settings/_components/settings-workspace.tsx` | 2 | 254 / 320 |
| `apps/admin/src/app/(ops)/kb/settings/_components/chunk-strategy-panel.tsx` | 1 | 148 |
| `apps/admin/src/app/(ops)/eval/_components/eval-workspace.tsx` | 1 | 215 |

**旧 ui `Select` 4 处（3 文件）**：`apps/admin/src/app/login/page.tsx:56`；`apps/admin/src/app/(ops)/members/_components/members-workspace.tsx:158,197`；`apps/admin/src/app/(ops)/chunks/_components/chunks-workspace.tsx:169`（import 自 `@strict-rag/ui/components/ui/select`）。

web 侧已清零：`apps/web/src` grep `<select` 与 `ui/select` **零命中**。

目标组件已存在：`packages/ui/src/components/ui/closed-select.tsx:1-145`（`ClosedSelect`，按钮 + `role="listbox"`，不可输入不可搜；`options: {value,label}[]`，空值可用 `value: ''` 表达「不选/库级」）；admin 已有 5 个文件在用它（`components/admin-shell.tsx:18,135`、`feedback-workspace.tsx:13,136`、`documents-workspace.tsx:25,665,685,760,1100`、`settings-workspace.tsx:21,462`、`chunk-strategy-panel.tsx:11,177`）。

### 可动手性 —— **无前置，纯机械替换（首选）**

- 每个站点的 `options` 都来自已有数据（部门列表、类型枚举、模型目录、用户列表、黄金集题型、档位…），`ClosedSelect` 契约足够；需要「可清空」的站点用 `value: ''` 选项即可。
- **注意**：`ClosedSelect` 不能输入/搜索 → 若某处原本靠原生 `<select>` 承载「自由输入值」（如 models 的 dims 输入旁的下拉、documents 的 uuid 粘贴），必须保留 `Input`/`Textarea`（地图站规明确 `Input`/`Textarea` 仍走 ui 包），**不得**把自由输入强行塞进关闭列表。
- 语义红线：**不改 GET / 鉴权语义**（map 站规原话）；不得顺手改任何请求参数。

### 被冻结 / 不许动

- 站规本身不得反向放宽（不许新增原生 `<select>`）。
- 不得借此改 API 契约或权限码。

### 规模与验证

- 规模：**S–M**（7 文件、24 处替换；无新逻辑）。可拆两张（原生 select / 旧 Select）或一张。
- 验证：`pnpm --filter @strict-rag/admin test`（RTL 面已覆盖：`tests/ops/documents-workspace.test.tsx`、`kb-settings-workspace.test.tsx`、`chunk-strategy-panel.test.tsx`、`members-workspace.test.tsx`、`departments-workspace.test.tsx`、`eval-workspace.test.tsx`）；`chunks` / `models` / `login` **无 RTL 覆盖**（module-status admin:135 技术债；`apps/admin/tests/ops/` 无对应文件），这三处替换需靠 `pnpm check-types` + 手测。**无需真浏览器**。

---

## 附：本轮明确**不得**提议解锁的项（候选是否触及）

| 锁定项（来源：map Out of scope / Notes） | 触及的候选 |
|------------------------------------------|------------|
| 默认开 `DEPT_ACL_ENFORCE` | 候选 7（端点部分**不要求**开，勿顺手开） |
| 角色 principal | 候选 7（`aclPrincipals` 只做 **用户 uuid**） |
| 默认开 OCR | 无关 |
| 默认开 rewrite | 无关 |
| 真引擎选型（ES / IK / RustFS / 杀毒） | 候选 6（必须走 HTTP 兼容 Gateway）、候选 5（勿拉真杀毒） |
| 人签 / 准出 | 候选 9（审核闸**不得**冒充签字包）、候选 3（Hit@k 不得进签字公式） |
| LangGraph 重构 | 无关 |
| ES 租户迁移 ADR-041 | 无关 |
| `prds/00–11` 冻结条款 | 候选 3（ADR-053 一 version 一策略）、候选 8（searchable 语义）、候选 4（审批闸） |

## 附：不确定项（需更多证据才能下结论）

1. **候选 1 「高度重复」阈值**：`prds/03-data` 确有章节但我只读到 §6 与 §7；若阈值定义在别处（如 `prds/04-pipelines` 其它小节或 ADR 正文），证据是我未找到的那份文本。当前 grep（`阈值|占比|ratio` 于 `prds/03-data`）只命中 schema 章节的无关行。
2. **候选 3「抽样对照」的预期形态**：PRD 三处都写「可」，未说明是入 API 报告还是离线报告；本报告按「报告字段」理解，若产品意图是离线 CLI 对照，则前置会小很多（仅需离线双跑脚本）。
3. **候选 2 的 rerank `provider` 语义**：PRD 07 §5.1.1 写 `rerank_node_used{provider,model}`，但 rerank 绑定没有 DB provider 维度（`resolve.ts:44-49`），provider 究竟取哪个标识（端点序位 / URL / 绑定 provider id）需产品/工程一句话定义。
