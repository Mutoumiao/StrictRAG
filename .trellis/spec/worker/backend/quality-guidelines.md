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

## 日志

与 api 相同：Pino；上下文带 `jobId`、`tenantId`、`kbId`、`documentId` 等。

## 反模式

- **Bad**：worker 内复制一份 drizzle schema  
- **Bad**：mock ES 失败仍把文档标 ready（验收明确禁止）  
- **Bad**：在 worker 调 LLM 生成用户答案（ask 在 api/图）  
- **Good**：状态机字段与 `prds/04-pipelines/01-offline-ingest.md` 一致  

## 反模式（联调踩坑）

- **Bad**：队列名写成 `sr:probe`（BullMQ `Queue name cannot contain :`）  
- **Bad**：api/worker 各用进程 cwd 下的 `.data/objects`（parse 读到 0 字 → 假 `needs_ocr`）  
- **Bad**：mock ES 按 `kbId+indexVersion` 聚合并对账「整集合 ≡ 单文档 manifest」→ 同 KB 第 2 篇起 `ES_RECONCILE_FAILED`（假 orphan）  
- **Good**：`sr-probe` / `sr-ingest`；`STORAGE_LOCAL_DIR` 解析到 monorepo 根  
- **Good**：mock ES 按 **`docId+indexVersion`** 对账；集成验收须跑 **≥10 篇同 KB** 而非只测 1 篇  

## 阶段说明

Phase 0/1 已落地：探针队列 + mock 入库状态机（scan→parse→chunk→embed→es）。
