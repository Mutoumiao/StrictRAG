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

## 身份 / 授权

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

- `AUTH_ENFORCE=false`（默认）：**入库** API 无鉴权，供 `pnpm demo:ingest`（**勿改默认 true**，否则 demo 全 401）
- `AUTH_ENFORCE=true`：入库 API 挂 `requirePermissionWhenEnforced`（须 Bearer + 权限码；`:kbId` 路径另查 `kb_members`，`super_admin` 旁路）
- `/auth/me` 始终 `requireAuth`
- **ask / members / sessions**（设计 §9.1）：**始终**登录 + 成员闸，与 `AUTH_ENFORCE` 无关；`demo:ingest` 不走这些路由

### 成员 API（S2-1）

| 方法 | 路径 | 权限 |
|------|------|------|
| GET | `/api/v1/knowledge-bases/:kbId/members` | `member.manage` + 成员 |
| POST | `/api/v1/knowledge-bases/:kbId/members` | 同上；body: `{ userId? \| email?, role? }` |
| DELETE | `/api/v1/knowledge-bases/:kbId/members/:userId` | 同上 |

```bash
# 1) 开发登录（主体 upsert 到 users；需 PG migrate）
TOKEN=$(curl -sS -X POST http://127.0.0.1:4000/api/v1/auth/admin/dev-login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@example.com","roleTemplate":"super_admin"}' \
  | jq -r '.data.accessToken')

# 2) 邀请成员（super_admin 可不在 kb_members）
curl -sS -X POST "http://127.0.0.1:4000/api/v1/knowledge-bases/$KB_ID/members" \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"email":"reader@example.com","role":"read"}'
```

ask 演示：先 seed `kb_members` + Bearer；入库演示继续 `AUTH_ENFORCE=false` 无 token。

目标身份可换 Better Auth；**TokenPair 形状 + 验码层**保持。
