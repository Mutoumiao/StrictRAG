# worker · 目录结构

## 当前（P1 入库状态机 + mock 扫描）

```text
apps/worker/
  package.json
  tsconfig.json
  eslint.config.js
  src/
    index.ts              # BullMQ workers · 优雅退出 · 无 HTTP
    env.ts                # Zod（含 INGEST_SCAN_MODE · STORAGE_* · ES mock 等）
    logger.ts
    queues/               # 连接与 QUEUE_NAMES 对齐 contracts
    ingest/
      pipeline.ts         # 状态机 scan→parse→chunk→embed→es
      processors / stages # 按 stage 拆分（以源码为准）
    # 复用 @strict-rag/db · @strict-rag/contracts
```

> 旧 scaffold 句「仅 echo」已过时；以本树 + `docs/module-status/worker.md` 为准。

## 职责

| 职责 | 说明 |
|------|------|
| BullMQ consumers | 入库 / 探针；重活不在 api |
| 与 api 分工 | api 入队 + HTTP；worker 消费 |
| 扫描闸 | `scan` 在 parse/manifest **前**；见 [quality-guidelines](./quality-guidelines.md) DEC-SCAN |
| 分片 | 读 `documents.chunkStrategy`（api B12 写入） |

## 环境锚点（摘）

| Key | 默认 | 说明 |
|-----|------|------|
| `INGEST_SCAN_MODE` | `mock_clean` | `mock_clean` \| `mock_infected` \| `on`（**`on` ≠ 真 ClamAV**，当前同 clean 路径） |
| `STORAGE_LOCAL_DIR` | 相对 monorepo 根 | 与 api 同锚，禁 cwd 分叉 |
| 队列名 | `sr-ingest` 等 | **禁止** `:` |

## 交叉引用

- 质量 / 扫描债：[quality-guidelines](./quality-guidelines.md)  
- 分片策略 HOW（api）：[chunk-strategies](../../api/backend/chunk-strategies.md)  
- IS：`docs/module-status/worker.md`  
- PRD：`prds/06-async` · `prds/04-pipelines/01-offline-ingest.md`  
