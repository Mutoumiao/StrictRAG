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

## 身份 / 授权（参考 ai-partner-agent）

| 层 | 说明 |
|----|------|
| 身份 | 双 JWT（access+refresh）+ rotation；开发 `POST /api/v1/auth/admin/dev-login` |
| 授权 | `@strict-rag/admin-catalog` 权限码 + `requirePermission` |
| 前端 | admin/web：`localStorage` 会话 + http 无感 refresh |

```bash
# 开发登录（仅 development）
curl -sS -X POST http://127.0.0.1:4000/api/v1/auth/admin/dev-login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@example.com","roleTemplate":"super_admin"}'
```

业务入库路由默认 `AUTH_ENFORCE=false` 仍可无鉴权演示；`/auth/me` 与细权限路由用 Bearer。
目标身份实现可替换为 Better Auth，**TokenPair 形状 + 验码层保持**。
