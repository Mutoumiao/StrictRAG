# 核定 embed TPM（R6）的口径

Type: research
Status: resolved
Blocked by: 02

## Question

剧本 R4–R10 中的 R6「mock embed TPM」在 HEAD 上**真未做**（全仓源码 0 命中），且前图 35 当时把它划出。核查提示「口径未定」，所以先研究再实现。

请给出：

1. **PRD 原文行**：R6 在 `prds/10-delivery/03-acceptance-scenarios.md` 的原文，以及 `prds/07-models` / `prds/06-async` / `prds/08-quality` 中关于 **embed TPM（tokens per minute）** 的冻结语义行（若只有一处，如实说明）。
2. **口径**：TPM 是「按调用次数折算」还是「按真实 token 数」？mock embed（`INGEST_EMBED_MODE=mock`）**没有真实 token 消耗**，此时 TPM 该按什么计数——按文本长度估算、按固定权重、还是不计数只留结构？给出 PRD 依据；**若 PRD 未定义，明说未定义**，并给出「最小且不发明语义」的落法建议。
3. **与既有平面配额的关系**：现有 ask / ingest 固定窗口（`apps/api/src/services/rate-limit.ts:21-25`）与 `plane` 指标（`apps/api/src/obs/metrics.ts:58-67`）的现状，R6 是否复用它。
4. **建议**：`可直接开工`（给出最小断言形状）/ `需先出决定`（指出必须由人裁的那一点）/ `应划出范围`。

产出写到 `research/embed-tpm.md`，并在票内 Answer 给出结论摘要。

## Answer

全量取证见 [`research/embed-tpm.md`](../research/embed-tpm.md)（只读核查）。

### 一、R6 的 Then 要拆成两半，其中一半已具备

R6 原文 `prds/10-delivery/03-acceptance-scenarios.md:304`：「mock embed TPM 触顶 → 队列堆积 + 告警；文档 **非 ready** 直至清单全 embed；**无**半套 ready」，契约来源 ADR-044（`prds/11-decisions/00-adr-index.md:909-910`）· `prds/07-models/01-model-gateway.md:308` · `prds/06-async/01-bullmq-jobs.md:23`。

- **R6-a「非 ready 直至清单全 embed / 无半套 ready / 不静默丢 chunk」——已具备 + 证据**：`es_index` 段硬闸 `doc.embedReady !== 1 → EMBED_NOT_READY` 且置 `failed`（`apps/worker/src/ingest/pipeline.ts:806-811`）；embed 失败置 `failed` + `embedReady=0`（`:686-696`）；双就绪才 `ready`（`:936-941`）；测例 `tests/ingest/idempotency.test.ts`（半套稀疏索引不得假完成）· `tests/ingest/dual-ready-index.test.ts` · 本轮新增的 `tests/ingest/contextualize-fallback-ready.test.ts`（全链断言 `embedReady/esReady = 1` 才 `ready`）；入库报告有 `dualReady` 字段。
- **R6-b「TPM 触顶 → 反压 + 堆积告警」——无口径、无生产者**。

### 二、口径未定义（不是「待实现」，是「没得实现」）

- PRD 全仓 `TPM` 命中 22 行**全是指代，无一行给计数口径**；唯一与 token 计数有关的定义 `prds/04-pipelines/01-offline-ingest.md:150` 只约束**分块**。→ **「embed TPM」在契约层未定义**。
- IS：mock embed 走 `pipeline.ts:770` 的 `mockEmbedVector`（`embed-http.ts:3-5`），**既不产生 token，也不产生上游 429**；worker 全仓无配额/反压/计数逻辑；`ingest_embed_backlog` **全仓 0 命中**；api 侧 `plane=ingest` 只挂在 `ingest_complete_total`（`apps/api/src/obs/metrics.ts:184-186`），入库 embed 未打点（覆盖表 `docs/testing/coverage/03-ops.md:95` 已如实登记）；**worker metrics 出口前图已裁定不开端口**（功能表 `:34`/`:206` 把「Worker 对外 HTTP」写进禁止列）。

### 三、裁定

**R6-b 划出范围**（本图不做），理由：

1. 计数口径 PRD 未定义 —— 直接开工只能要么发明口径（`mock` 模式下没有真 token，按文本长度估算是**发明**），要么复用 api 侧 ingest RPM（那是**进程内 Map、多副本不共享**，运维文档已把它列为否决项「把 L1 Map 当集群配额」）。
2. 堆积告警的载体（`ingest_embed_backlog`）在 worker 侧**没有出口**，而 worker metrics 出口已被前图明确裁定不开 → 硬做只能造名不副实的假指标或半接线，正是本仓明令忌讳的。

**准入条件（写入 Not yet specified）**：① PRD 给出 TPM 计数口径（或 ADR 声明 mock 模式不计数）；② worker 观测出口的决策改变（或把堆积计数落进入库报告，与 105 的两计数同型）。两条都满足才开票。

**R6-a 就地登记为已具备**（映射表口径改按「无半套 ready」这一半记已具备 + 证据）。
