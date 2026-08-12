# @strict-rag/worker · BullMQ 异步消费者

> 路径：`apps/worker` · **无 HTTP 端口**  
> 现状：probe + ingest 状态机（scan→parse→chunk→embed→es）；默认 `INGEST_SCAN_MODE=mock_clean`；**QUAL-2 真杀毒 = 安全债**（DEC-SCAN，非本进程「已完成」）。

---

## Pre-Development Checklist

- [ ] 任务是否 Phase 0（进程可起 + noop 探针）或 Phase 1+ 入库？  
- [ ] 是否与 api 共用 `@strict-rag/db`？  
- [ ] 队列 payload 是否有 contracts/Zod？  
- [ ] 是否避免在 worker 实现 HTTP API？  
- [ ] 改 scan 时是否读 [quality-guidelines](./quality-guidelines.md) DEC-SCAN（`on`≠ClamAV）？  
- [ ] chunk 是否尊重文档 `chunkStrategy`（api B12），未另造注册表？  

## Quality Check

- [ ] `pnpm --filter @strict-rag/worker check-types` · `lint` · `test`  
- [ ] 失败任务可观测、可重试策略与 PRD 一致  
- [ ] 提交说明勿写「生产杀毒已上 / QUAL-2 完成」  

---

## 指南索引

| 指南 | 说明 |
|------|------|
| [directory-structure](./directory-structure.md) | 现状树 · env 锚点 |
| [quality-guidelines](./quality-guidelines.md) | 质量 · **DEC-SCAN 债** · 联调禁项 |

## 依赖

`@strict-rag/contracts` · `@strict-rag/db`

## PRD 映射

- `prds/06-async/01-bullmq-jobs.md`  
- `prds/04-pipelines/01-offline-ingest.md` · ADR-039  
- IS：`docs/module-status/worker.md`
