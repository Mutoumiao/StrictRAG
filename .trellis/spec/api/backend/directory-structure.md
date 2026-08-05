# api · 目录结构

## 当前（S2 最小）

```text
apps/api/src/
  index.ts                 # 启动
  app.ts                   # createApp：requestId → attachAuth → routes
  env.ts                   # Zod env（JWT · AUTH · GATEWAY · RETRIEVE · SESSION_REWRITE · OBS）
  auth/
    types.ts
    middleware.ts          # attachAuth · requireAuth · requirePermission · WhenEnforced · requireKbMember
    identity/              # 双 JWT 过渡
      jwt.ts · refresh-store.ts · token-service.ts
    permissions/resolve.ts # 有效码求值 · super_admin 旁路成员
  graph/                   # 单轮信任路径（线性状态机）
    run.ts · state.ts · prompts.ts · parse.ts · route-rules.ts
    budget.ts · reasons.ts · tracer.ts · graph.test.ts
  routes/
    auth.ts                # dev-login · refresh · me
    documents.ts           # P1 入库
    members.ts             # 成员 list/invite/delete
    ask.ts                 # POST …/ask 同步+SSE
    sessions.ts            # 会话壳（无 rewrite）
    feedback.ts            # 反馈队列
  middleware/request-id.ts
  services/
    documents.ts · members.ts · sessions.ts · feedback.ts · db.ts · storage.ts · queue.ts
    ask/                   # executeAsk · session-guard · traces 落库
    gateway/               # chat · embed · rerank（mock|http）
    retrieve/              # 混合检索 · 双闸门 · RRF · scoring
  obs/                     # metrics · rate-limit · memory/ask tracer
  gates/                   # 上传体积 · 审批 scan
  ready/checks.ts
  lib/response.ts
  logger.ts
```

## 职责

| 职责 | 说明 |
|------|------|
| HTTP | Hono + Node（**非**默认 CF Workers） |
| 身份 | Bearer access；refresh rotation（见 [auth-authorization](./auth-authorization.md)） |
| 授权 | 权限码；**禁止** role 字符串单独放行 |
| Ask | 始终 KB 成员闸；SQL/图/Prompt 不在 route 内展开（见 [ask-pipeline](./ask-pipeline.md)） |
| 入队 | BullMQ；重活在 worker |
| 契约 | `@strict-rag/contracts` |

前缀：`/api/v1`；鉴权：`/api/v1/auth/*`；指标：`GET /metrics`（骨架无鉴权）。

## 脚本

| 脚本 | 说明 |
|------|------|
| `dev` / `start` | tsx 起服 :4000 |
| `test` | vitest（auth · graph · ask · retrieve · sessions · feedback · obs …） |
| `check-types` / `lint` | tsc · eslint |
