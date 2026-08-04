# `@strict-rag/worker`

BullMQ 异步消费者。

## Phase 0

- 连接 Redis
- 队列 `sr-probe` + `noop` job
- 启动时可自投递探针（`WORKER_PROBE_ON_START=true`）

## 本地

```bash
docker compose -f docker/docker-compose.yml up -d
cp .env.example .env
pnpm --filter @strict-rag/worker dev
```

日志应出现 `probe job completed`。
