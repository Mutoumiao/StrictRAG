# worker · 质量指南

## 硬规则

| 规则 | 说明 |
|------|------|
| 无对外 HTTP 业务 API | 运维探针若需要，按 PRD 最小化，勿做成第二 api |
| 共享 schema | 只通过 `@strict-rag/db` |
| 幂等 / 重试 | 按 BullMQ 与入库状态机；失败不得静默标 ready |
| 双就绪 | embed + es_index 等条件不满足不得 `ready`（入库 PRD） |
| 队列名 SSOT | `@strict-rag/contracts` 的 `QUEUE_NAMES`；**禁止 `:`**（BullMQ 拒绝） |
| 本地对象路径 | 相对 `STORAGE_LOCAL_DIR` 须锚定 monorepo 根，与 api 一致 |
| 扫描在 parse 前 | `stage=scan` 通过后才 `parse` / 写 manifest（ADR-039） |
| 分片策略 | 读文档已存 `chunkStrategy`；**禁止** worker 自建第二注册表绕过 api B12 |

## 技术债：QUAL-2 / DEC-SCAN（2026-08-12）

> task `08-11-qual-scan-engine` **已归档为延期安全债**，**不是**「杀毒引擎完成」。

| 允许 | 禁止 |
|------|------|
| dev / 演示用 `INGEST_SCAN_MODE=mock_clean` 或 `mock_infected` | 宣称「生产杀毒 / 剧本 M 全绿」 |
| 把「真引擎未接」写在 module-status 技术债 | 本 task 冒充 QUAL-2 产品验收完成 |
| 生产前 **新建** 实现 task 接 ClamAV（或等价） | 改仓库默认扫过路径当已清债 |

### Scenario: mock 扫描闸（当前实现）

#### 1. Scope / Trigger

- 改 `ingest` 状态机 scan 阶段、删除对象、errorCode
- 改 `INGEST_SCAN_MODE` 语义（尤其 `on`）

#### 2. Signatures / Env

| Key | 值 | 行为 |
|-----|-----|------|
| `INGEST_SCAN_MODE` | `mock_clean`（默认） | 记 clean → enqueue `parse` |
| | `mock_infected` | 删本地对象（best-effort）→ `status=failed` · `errorCode=MALWARE` · **done** |
| | `on` | **当前 ≠ 真 ClamAV**；与 clean 同路径（ADR 预留位；**禁止**对外说已接引擎） |

前置：`approvalStatus === 'approved'`，否则 `NOT_APPROVED` 失败（ADR-048）。

#### 3. Validation / 结果矩阵

| 条件 | 文档状态 | errorCode |
|------|----------|-----------|
| 未审批进入 scan | failed | `NOT_APPROVED` |
| mock_infected | failed | `MALWARE` |
| mock_clean / on（现状） | → parse | null |

#### 4. Tests / 清债门槛

- 现有：mock_infected 删对象 + MALWARE 路径可单测/集成
- **清债时须**：真引擎路径 · infected 删+标识 · 剧本 M 关键路径 · **新建 task**（勿复活已归档 08-11-qual-scan-engine 当完成）

#### 5. Wrong vs Correct

```text
// Wrong — 文档写「QUAL-2 已完成 · 生产可扫毒」
// Correct — module-status：mock_scan 安全债；生产前新建 QUAL-2 实现
```

## 日志

与 api 相同：Pino；上下文带 `jobId`、`tenantId`、`kbId`、`documentId` 等。**禁止**把对象全文/密钥打进日志。

## 反模式

- **Bad**：worker 内复制一份 drizzle schema  
- **Bad**：mock ES 失败仍把文档标 ready（验收明确禁止）  
- **Bad**：在 worker 调 LLM 生成用户答案（ask 在 api/图）  
- **Bad**：`INGEST_SCAN_MODE=on` 当已接 ClamAV  
- **Good**：状态机字段与 `prds/04-pipelines/01-offline-ingest.md` 一致  

## 反模式（联调踩坑）

- **Bad**：队列名写成 `sr:probe`（BullMQ `Queue name cannot contain :`）  
- **Bad**：api/worker 各用进程 cwd 下的 `.data/objects`（parse 读到 0 字 → 假 `needs_ocr`）  
- **Bad**：mock ES 按 `kbId+indexVersion` 聚合并对账「整集合 ≡ 单文档 manifest」→ 同 KB 第 2 篇起 `ES_RECONCILE_FAILED`（假 orphan）  
- **Good**：`sr-probe` / `sr-ingest`；`STORAGE_LOCAL_DIR` 解析到 monorepo 根  
- **Good**：mock ES 按 **`docId+indexVersion`** 对账；集成验收须跑 **≥10 篇同 KB** 而非只测 1 篇  

## 阶段说明

Phase 0/1 已落地：探针队列 + mock 入库状态机（scan→parse→chunk→embed→es）。  
QUAL-2 真杀毒 = **安全债**（DEC-SCAN）；其余 08-11 工程项在 api 侧归档。