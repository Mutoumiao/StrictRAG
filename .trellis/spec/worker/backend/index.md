# @strict-rag/worker · BullMQ 异步消费者

> 路径：`apps/worker` · **无 HTTP 端口**  
> 现状：probe 队列 + ingest 状态机（scan→parse→chunk→embed→es）；mock 模式可联调。

---

## Pre-Development Checklist

- [ ] 任务是否 Phase 0（进程可起 + noop 探针）或 Phase 1+ 入库？  
- [ ] 是否与 api 共用 `@strict-rag/db`？  
- [ ] 队列 payload 是否有 contracts/Zod？  
- [ ] 是否避免在 worker 实现 HTTP API？  

## Quality Check

- [ ] `pnpm --filter @strict-rag/worker check-types` · `lint`  
- [ ] 失败任务可观测、可重试策略与 PRD 一致  

---

## 指南索引

| 指南 | 说明 |
|------|------|
| [directory-structure](./directory-structure.md) | 现状与目标 |
| [quality-guidelines](./quality-guidelines.md) | 质量与禁项 |

## 依赖

`@strict-rag/contracts` · `@strict-rag/db`

## PRD 映射

- `prds/06-async/01-bullmq-jobs.md`  
- `prds/04-pipelines/01-offline-ingest.md`
