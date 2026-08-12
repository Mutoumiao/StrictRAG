# worker · 入库幂等与重试契约（X-04 · ADR-038）

> **WHAT**：`prds/06-async/01-bullmq-jobs.md` §2–3 · `prds/04-pipelines/01-offline-ingest.md` §6 · ADR-038  
> **HOW**：本文约束 agent 改 `queues` / `ingest/pipeline` / 入队方时的禁止项与目标语义。  
> **实现 task**：目标契约落地见挂账 follow-up（本文关闭的是 **HOW 空白**，不是生产级幂等已齐）。

---

## 1. 一句话

- **重试** = 对 **同一** `(docId, indexVersion)` 的 **embed / es_index** 再跑。  
- **变更切块/正文/策略** = **新** `indexVersion` 全链路（scan…chunk…），**不是**重试。  
- **禁止**在「重试」路径里再次 `chunk` 抬 version、堆行、双写向量。

---

## 2. Job payload（目标契约）

```typescript
// apps/worker/src/queues.ts · 目标形状
type IngestJobData = {
  docId: string;
  kbId: string;
  tenantId: string;
  stage: IngestStage; // scan | parse | chunk | embed | es_index
  /** embed / es_index **必须**带；chunk 成功物化后下游必填 */
  indexVersion?: number;
  /** 可选：链路追踪 */
  requestId?: string;
  attemptHint?: number;
};
```

| 阶段 | 必填字段 | 幂等键（逻辑） |
|------|----------|----------------|
| scan / parse | `tenantId, docId, kbId, stage` | 文档 + 阶段（无 version） |
| chunk | 同上；**首次物化**才升 version | 见 §3.2 |
| embed / es_index | 上表 + **`indexVersion`** | `(docId, indexVersion, stage)` |

**入队方（api）纪律**：

| 入口 | stage | indexVersion |
|------|-------|----------------|
| approve 后首入队 | `scan` | 省略 |
| reindex | `chunk`（或产品定的起点） | 省略 → chunk **新建** version；**禁止**把 reindex 当 embed 重试 |
| 内部 chain | 下一 stage | 透传；chunk→embed **必须**写入新 version |

物理队列现状：`sr-ingest` + `stage` 折叠（逻辑 stage 仍上表）。拆物理队列见挂账 X-20，**不**解除本幂等语义。

---

## 3. 分阶段幂等规则（目标）

### 3.1 scan / parse

| 规则 | 要求 |
|------|------|
| 重复 scan | 已 clean 且未改对象 → 可 no-op 进 parse；**不得**把 infected 再当 clean |
| MALWARE | **不可重试**（见 §4） |
| parse 无文本层 | → `needs_ocr` + `NO_TEXT_LAYER`；**不可**当 ready 重试 |

### 3.2 chunk（最易踩坑）

| 规则 | 要求 |
|------|------|
| **首次物化** | 新 `indexVersion = (current\|\|0)+1`；写 chunks + **冻结** `chunk_manifests` |
| **禁止重试重分块** | job 若已是 embed/es 失败后的恢复，**不得**再进 chunk 抬 version |
| reindex / 策略变更 | **显式**新产品意图 → 允许新 version 全链路；manifest 新行；旧 online 未切换前不可检索新版 |
| 半套失败 | 有 manifest 但 embed 未齐 → 重试从 **embed** 起，payload 带 **已有** `indexVersion` |

```text
// Wrong — 每次进 chunk 都 +1 version + insert
const indexVersion = (doc.indexVersion || 0) + 1;
await insert chunks + manifest;

// Correct（目标）
// 1) 若 job.indexVersion 已设且 manifest 存在 → 禁止再 chunk；应转 embed
// 2) 仅「新建 indexVersion」路径（首跑 / reindex）才 +1 并物化
// 3) embed/es 只消费冻结 manifest(chunkIds)
```

### 3.3 embed / es_index

| 规则 | 要求 |
|------|------|
| 串行 | 同 `(docId, indexVersion)`：**embed → es_index**；禁止并行 fan-out（ADR-038） |
| 幂等写 | 同一 version 重跑 → **upsert** 或「已存在则 skip」，禁止无脑 insert 双行 |
| ready | 仅 dense∧sparse 双就绪；任一路失败 **不得** ready |
| 清单 | 只认冻结 `chunk_manifests` 的 `chunkIds`；**禁止**重算切块 |

### 3.4 activate / ready

| 规则 | 要求 |
|------|------|
| 切换 | 双就绪后更新 `documents` 状态；lifecycle active 仍是检索第二闸 |
| 重试 | 不得污染**已激活** online version 的半套写 |

---

## 4. errorCode × retryable 矩阵（目标）

| errorCode / 终态 | 可自动重试？ | 下一动作 |
|------------------|--------------|----------|
| `MALWARE` | **否** | 结束；对象已删；禁 clean 重试 |
| `NOT_APPROVED` | **否** | 等人审；勿自动 requeue |
| `NO_TEXT_LAYER` / `needs_ocr` | **否**（无 OCR） | 停在 needs_ocr；补 OCR = **新 version 全链路** |
| `UNSUPPORTED_CHUNK_STRATEGY` | **否** | 改策略码后 **reindex 新 version** |
| `EMPTY_CHUNKS` | **否** | 查 parse/策略；非瞬时 |
| `SCAN_ENGINE_UNAVAILABLE` | **否**（配置债） | 修 env / QUAL-2；勿当 clean |
| `EMBED_FAILED`（瞬时/mock fail） | **是** | 同 `indexVersion` 重跑 **embed** |
| `ES_INDEX_FAILED` / `ES_RECONCILE_FAILED` | **是** | 同 version 重跑 **es_index**（清单不变） |
| `NO_MANIFEST` | **否**（数据半套） | 查是否误从 embed 起；可能需 reindex 新 version |
| 模型/ES 429·5xx | **是**（有限次） | 指数退避；耗尽 → failed |

BullMQ：业务层应设 `attempts` / backoff 与上表一致；**不可重试**码应 `UnrecoverableError` 或等价，避免毒丸重投。

---

## 5. 当前 IS（2026-08-12 · X-04-impl 后）

> 完成度以 `docs/module-status/worker.md` 为准。下表区分 **已落地最小幂等** vs **仍欠**。

| 项 | 状态 | 说明 |
|----|:----:|------|
| `IngestJobData` SSOT | **已** | `@strict-rag/contracts` Zod + 类型；api/worker 共引 |
| `indexVersion` 透传 | **已** | chunk→embed→es；embed/es 缺 version → `MISSING_INDEX_VERSION` |
| chunk 禁重分块 | **已** | `job.indexVersion` + 已有 manifest → resume embed |
| 首跑/reindex 物化 | **已** | 无 `indexVersion` 时仍 `(doc\|\|0)+1`（reindex 故意新 version） |
| embed 同 version 幂等 | **已** | 跳过已有 `chunkId` 向量行 |
| es 同 version 重跑 | **已** | mock set 合并 |
| retryable → BullMQ | **已** | `classifyIngestBullOutcome` + `assertIngestBullOutcome`：retryable 抛 Error；其它 `UnrecoverableError`；attempts=3 |
| `ingest_jobs` 阶段账本 | **最小已** | worker `job-ledger.ts`：每 stage 尝试 insert `running` → end `succeeded`/`failed`；写失败 warn 不阻断；**无** api 入队写、无查询 API |
| 生产级并发锁 | **欠** | 同 doc 并行双 job 未加分布式锁 |

**实现 task**：`08-12-spec-w1-ingest-idempotency-impl`（幂等）· `08-12-ingest-jobs-ledger-min`（账本最小）。  
**禁止**：把「最小幂等/最小账本」写成「生产级重试/账本/锁已齐」。

---

## 6. Wrong vs Correct（评审句式）

```text
// Wrong — BullMQ 自动重试整个 job，从 chunk 再跑，version 狂涨
// Wrong — embed 失败后 api 再 enqueue stage=chunk
// Wrong — 重试路径 splitParagraphs 再 insert 一批 chunk
// Correct — embed 失败：enqueue { stage:'embed', indexVersion: N }
// Correct — 用户改策略 / reindex：新 indexVersion 全链路，旧 manifest 冻结保留
// Correct — MALWARE / NOT_APPROVED：不重试
```

---

## 7. 测试（实现 follow-up 最低集）

| ID | 断言 |
|----|------|
| R-I-idem-1 | 同 version 二次 embed 不双倍向量行（或 upsert 后计数稳定） |
| R-I-idem-2 | 模拟「重试误进 chunk」→ 不抬 version / 或明确 failed |
| R-I-idem-3 | ES fail 后同 version 重跑 es 可 ready；中途不得 ready |
| R-I-idem-4 | MALWARE 不进入 parse 且不可 requeue clean |

---

## 8. 交叉引用

- 扫描闸：[quality-guidelines](./quality-guidelines.md) X-01/X-02  
- 策略执行：同文 X-03 · [api chunk-strategies](../../api/backend/chunk-strategies.md)  
- 队列名：`@strict-rag/contracts` `QUEUE_NAMES`  
- 挂账实现债：`08-12-spec-arch-review-backlog` · follow-up `spec-w1-ingest-idempotency-impl`（未建则新建）
