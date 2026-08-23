# worker · 目录结构

## 当前（P1 入库状态机 + mock 扫描）

```text
apps/worker/
  package.json
  tsconfig.json
  eslint.config.js
  tests/
    index.md                 # 本包测例导航
  src/
    index.ts                 # BullMQ workers · 优雅退出 · 无 HTTP
    env.ts                   # Zod：INGEST_* · STORAGE_* · APP_ENV
    logger.ts
    db.ts
    queues.ts                # QUEUE_NAMES · IngestJobData
    scan-mode-policy.ts      # X-01/X-02 启动矩阵纯函数
    ingest/
      pipeline.ts            # 状态机 scan→parse→chunk→embed→es_index
      idempotency.ts         # X-04 幂等纯函数
      job-ledger.ts          # ingest_jobs 阶段账本（最小）
      doc-lock.ts            # 同 doc Redis SET NX 锁（最小；非 Redlock）
      es-store.ts            # mock ES（进程内 Map）
      # 遗留 *.test.ts（待迁 tests/ingest/）
    # 复用 @strict-rag/db · @strict-rag/contracts
```

> 写面 / 阶段能力表 → [ingest-capability-matrix](./ingest-capability-matrix.md)。  
> IS：`docs/module-status/worker.md`。

## 职责

| 职责 | 说明 |
|------|------|
| BullMQ consumers | 入库 / 探针；重活不在 api |
| 与 api 分工 | api 入队 + HTTP；worker 消费 |
| **无 HTTP**（X-21） | `index.ts` 仅起 worker；**禁止**业务 HTTP server |
| 扫描闸 | `scan` 在 parse/manifest **前**；见 [quality-guidelines](./quality-guidelines.md) DEC-SCAN |
| 分片 | 读 `documents.chunkStrategy`（仅 IMPLEMENTED；X-03） |
| 幂等/重试/锁 | [ingest-idempotency](./ingest-idempotency.md)（X-04）；payload `indexVersion`；`doc-lock` 同 doc 互斥 |
| 能力/写面 | [ingest-capability-matrix](./ingest-capability-matrix.md)（X-05 · X-14 · X-20） |

### Placement Rules（X-21 · 与 api 对称）

| 放这里 | 勿放 |
|--------|------|
| `ingest/pipeline.ts` 状态机 | 新 Hono route / 第二套 HTTP 写库 |
| `scan-mode-policy` / `idempotency` 纯函数 | 把策略注册表抄进 worker |
| `queues.ts` + contracts `QUEUE_NAMES` | 硬编码带 `:` 的队列名 |
| 共享类型 → `@strict-rag/contracts` / `db` | `import` from `apps/api` |

## 环境锚点（摘）

| Key | 默认 | 说明 |
|-----|------|------|
| `INGEST_SCAN_MODE` | `mock_clean` | `mock_clean` \| `mock_infected` \| `off` \| `on`；**启动闸**见 quality X-01/X-02（prod 禁 mock；`on` 未接引擎禁启动） |
| `APP_ENV` | `development` | 与 scan mode 交叉校验 |
| `STORAGE_LOCAL_DIR` | 相对 monorepo 根 | 与 api 同锚，禁 cwd 分叉 |
| 队列名 | `sr-ingest` 等 | **禁止** `:` |

## 交叉引用

- 质量 / 扫描债：[quality-guidelines](./quality-guidelines.md)  
- 分片策略 HOW（api）：[chunk-strategies](../../api/backend/chunk-strategies.md)  
- IS：`docs/module-status/worker.md`  
- PRD：`prds/06-async` · `prds/04-pipelines/01-offline-ingest.md`  
