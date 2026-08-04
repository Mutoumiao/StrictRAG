# api · 目录结构

## 当前

```text
apps/api/src/
  index.ts              # 启动
  app.ts                # createApp：requestId → attachAuth → routes
  env.ts                # Zod env（含 JWT_* · AUTH_ENFORCE）
  auth/
    types.ts
    middleware.ts       # attachAuth · requireAuth · requirePermission · WhenEnforced
    identity/           # 双 JWT 过渡（可换 Better Auth）
      jwt.ts
      refresh-store.ts  # MVP 进程内；生产迁 Redis/PG
      token-service.ts
    permissions/
      resolve.ts        # 有效码求值
  routes/
    auth.ts             # dev-login · refresh · me
    documents.ts        # Phase1 入库（默认可不强制登录）
  middleware/request-id.ts
  services/             # 业务；SQL 不进 route
  lib/response.ts
```

## 职责

| 职责 | 说明 |
|------|------|
| HTTP | Hono + Node（**非**默认 CF Workers） |
| 身份 | Bearer access；refresh rotation（见 [auth-authorization](./auth-authorization.md)） |
| 授权 | 权限码；**禁止** role 字符串单独放行 |
| 入队 | BullMQ；重活在 worker |
| 契约 | `@strict-rag/contracts` |

前缀：`/api/v1`；鉴权路由：`/api/v1/auth/*`。

## 脚本

| 脚本 | 说明 |
|------|------|
| `dev` / `start` | tsx 起服 :4000 |
| `test` | vitest（含 auth 求值与 token rotation） |
| `check-types` / `lint` | tsc · eslint |
