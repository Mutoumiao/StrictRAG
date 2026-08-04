# `@strict-rag/api`

Hono + Node HTTP API。

## Phase 0

- `GET /health` — 进程存活
- `GET /ready` — PG / Redis（硬依赖）+ 可选 ES / Gateway 探测

## 本地

```bash
# 依赖
docker compose -f docker/docker-compose.yml up -d
cp .env.example .env
pnpm db:migrate

# 起服（端口 4000）
pnpm --filter @strict-rag/api dev

curl -sS http://127.0.0.1:4000/health
curl -sS http://127.0.0.1:4000/ready
```
