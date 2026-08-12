# worker · 质量指南

## 硬规则

| 规则 | 说明 |
|------|------|
| 无对外 HTTP 业务 API | 运维探针若需要，按 PRD 最小化，勿做成第二 api |
| 共享 schema | 只通过 `@strict-rag/db` |
| 幂等 / 重试 | **全文** → [ingest-idempotency](./ingest-idempotency.md)（X-04）；失败不得静默 ready；**禁**重试重分块 |
| 双就绪 | embed + es_index 等条件不满足不得 `ready`（入库 PRD） |
| 队列名 SSOT | `@strict-rag/contracts` 的 `QUEUE_NAMES`；**禁止 `:`**（BullMQ 拒绝） |
| 本地对象路径 | 相对 `STORAGE_LOCAL_DIR` 须锚定 monorepo 根，与 api 一致 |
| 扫描在 parse 前 | `stage=scan` 通过后才 `parse` / 写 manifest（ADR-039） |
| 分片策略 | 读 `documents.chunkStrategy`；**禁止**第二注册表；**仅**执行 contracts `IMPLEMENTED_CHUNK_STRATEGIES`（X-03） |

## 技术债：QUAL-2 / DEC-SCAN（2026-08-12）

> task `08-11-qual-scan-engine` **已归档为延期安全债**，**不是**「杀毒引擎完成」。

| 允许 | 禁止 |
|------|------|
| dev / 演示用 `INGEST_SCAN_MODE=mock_clean` 或 `mock_infected` | 宣称「生产杀毒 / 剧本 M 全绿」 |
| 把「真引擎未接」写在 module-status 技术债 | 本 task 冒充 QUAL-2 产品验收完成 |
| 生产前 **新建** 实现 task 接 ClamAV（或等价） | 改仓库默认扫过路径当已清债 |

### Scenario: 扫描模式启动闸 + mock 路径（X-01 / X-02）

> 实现：`apps/worker/src/scan-mode-policy.ts` · `env.ts` · pipeline `scan`  
> PRD：`04-pipelines` §2.1 · ADR-039 · DEC-SCAN / QUAL-2

#### 1. 启动矩阵（fail-closed）

| APP_ENV \ MODE | `mock_clean` | `mock_infected` | `off` | `on`（真引擎位） |
|----------------|:------------:|:---------------:|:-----:|:----------------:|
| `development` / `test` | ✅ | ✅ | ✅ | ❌ 启动失败 |
| `staging` / `production` | ❌ | ❌ | ❌ | ❌ 启动失败（引擎未接） |

- **X-01**：prod/staging **禁止** mock/off 灰态 worker 存活。  
- **X-02**：`on` **≠** mock_clean；QUAL-2 未清前 **任何** APP_ENV 设 `on` → 启动失败。  
- QUAL-2 清债后：`on` + 引擎健康检查通过才允许 staging/production 启动（实现另 task）。

#### 2. 运行时 scan 阶段

| MODE | 行为 |
|------|------|
| `mock_clean` | → parse（仅 non-prod 可启动） |
| `mock_infected` | 删对象 → `failed` · `MALWARE` |
| `off` | 跳过扫 → parse（日志标明 skipped；仅 non-prod） |
| `on` | 防御：`failed` · `SCAN_ENGINE_UNAVAILABLE`（不得 clean） |

前置：`approvalStatus === 'approved'`，否则 `NOT_APPROVED`（ADR-048）。

#### 3. Tests / 清债门槛

- `scan-mode-policy.test.ts`：启动矩阵  
- mock_infected 删对象 + MALWARE  
- **清债 QUAL-2**：真引擎路径 · infected 删+审计 · 剧本 M · prod 启动健康检查 · **新建 task**

#### 4. Wrong vs Correct

```text
// Wrong — INGEST_SCAN_MODE=on 当已接 ClamAV / 与 mock_clean 同路
// Wrong — APP_ENV=production + mock_clean 宣称合规
// Correct — dev 用 mock_*|off；prod 未接引擎则 worker 起不来
// Correct — module-status：QUAL-2 安全债；生产前新建实现
```

## Scenario: 分片策略执行（X-03 · 真 SSOT）

> api HOW：[chunk-strategies](../../api/backend/chunk-strategies.md)  
> 实现集合：`@strict-rag/contracts` · `isImplementedChunkStrategy`  
> 切分入口：`apps/worker/src/ingest/pipeline.ts` · `splitByChunkStrategy`

| 规则 | 说明 |
|------|------|
| 只认文档已存码 | `doc.chunkStrategy ?? structure_paragraph` |
| **禁止**静默 fallback | 未实现码 **不得** 当段落切却写 ready |
| 未实现 | `status=failed` · `errorCode=UNSUPPORTED_CHUNK_STRATEGY` · **不写** manifest/chunks |
| 当前实现 | 仅 `structure_paragraph` → `splitParagraphs` |
| 禁止 | worker 内硬编码第二份「可写策略表」绕过 contracts |

```text
// Wrong — 永远 splitParagraphs，manifest.strategy 只记字符串
const pieces = splitParagraphs(text, min);
manifest.strategy = doc.chunkStrategy ?? 'structure_paragraph';

// Correct
const split = splitByChunkStrategy(strategyCode, text, min);
if (!split.ok) → failed + UNSUPPORTED_CHUNK_STRATEGY
```

扩策略：contracts `IMPLEMENTED_*` + 本函数分支 + 测 → 再允许 api 写入。

## 幂等 / 重试（X-04）

> **必读专文**：[ingest-idempotency.md](./ingest-idempotency.md)  
> 摘要：重试 = 同 `(docId, indexVersion)` 重跑 embed/es；**禁止**重试路径 chunk+1 version；MALWARE/NOT_APPROVED 不可重试。  
> **X-04-impl 已落最小幂等**（resume embed / skip 向量 / 透传 version）；账本与分布式锁仍欠——专文 §5；**禁止**宣称生产级幂等已齐。

## 能力矩阵 / 写面（X-05 · X-14）

> **必读**：[ingest-capability-matrix.md](./ingest-capability-matrix.md)  
> 阶段 done/stub/deferred + PG/ES/本地对象/Mongo 谁写谁读；禁止 HOW 假画真 ES/Mongo。

## 日志

与 api 相同：Pino；上下文带 `jobId`、`tenantId`、`kbId`、`documentId` 等。**禁止**把对象全文/密钥打进日志。

## 反模式

- **Bad**：worker 内复制一份 drizzle schema  
- **Bad**：mock ES 失败仍把文档标 ready（验收明确禁止）  
- **Bad**：在 worker 调 LLM 生成用户答案（ask 在 api/图）  
- **Bad**：`INGEST_SCAN_MODE=on` 当已接 ClamAV  
- **Bad**：未实现 `fixed_window` 仍切段落并标 ready  
- **Bad**：embed 失败后重投 `stage=chunk` 抬 indexVersion  
- **Good**：状态机字段与 `prds/04-pipelines/01-offline-ingest.md` 一致  
- **Good**：同 version 重跑 es_index；改策略走 reindex 新 version

## 反模式（联调踩坑）

- **Bad**：队列名写成 `sr:probe`（BullMQ `Queue name cannot contain :`）  
- **Bad**：api/worker 各用进程 cwd 下的 `.data/objects`（parse 读到 0 字 → 假 `needs_ocr`）  
- **Bad**：mock ES 按 `kbId+indexVersion` 聚合并对账「整集合 ≡ 单文档 manifest」→ 同 KB 第 2 篇起 `ES_RECONCILE_FAILED`（假 orphan）  
- **Good**：`sr-probe` / `sr-ingest`；`STORAGE_LOCAL_DIR` 解析到 monorepo 根  
- **Good**：mock ES 按 **`docId+indexVersion`** 对账；集成验收须跑 **≥10 篇同 KB** 而非只测 1 篇  

## 阶段说明

Phase 0/1 已落地：探针队列 + mock 入库状态机（scan→parse→chunk→embed→es）。  
QUAL-2 真杀毒 = **安全债**（DEC-SCAN）；其余 08-11 工程项在 api 侧归档。