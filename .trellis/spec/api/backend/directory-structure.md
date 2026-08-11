# api · 目录结构

## 当前（S2 最小）

```text
apps/api/src/
  index.ts                 # 启动 + SIGINT/SIGTERM → closeDb/closeQueue
  app.ts                   # createApp：requestId → secure → timeout → bodyLimit → auth → routes → notFound/onError
  env.ts                   # Zod env（+ API_REQUEST_TIMEOUT_MS · API_JSON_BODY_LIMIT_BYTES …）
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
    chunks.ts              # B1 分片只读 list/detail（ADR-052）
    members.ts             # 成员 list/invite/delete
    ask.ts                 # POST …/ask 同步 + AI SDK UI Message Stream
    sessions.ts            # 会话壳（无 rewrite）
    feedback.ts            # 反馈队列
    kb-settings.ts         # B2 知识库设置
    model-gateway.ts       # B3 模型供应商 + 平台绑定
    platform-users-roles.ts # B4
    departments.ts         # B5
    dashboard.ts           # B6 数据面板只读 summary
  middleware/
    request-id.ts          # X-Request-Id
    timeout.ts             # 可关全局 timeout；ask except
    body-limit.ts          # JSON 体限；上传/complete except
    on-error.ts            # 全局 throw 兜底
  # secureHeaders / notFound 直接在 app.ts 内联
  services/
    documents.ts · chunks.ts · members.ts · sessions.ts · feedback.ts · kb-settings.ts · model-gateway.ts
    platform-users-roles.ts · departments.ts · dashboard.ts
    db.ts · storage.ts · queue.ts
    ask/                   # executeAsk · session-guard · traces 落库
    gateway/               # chat · embed · rerank；B3-W：bindings.ts + getGatewayForTenant
    retrieve/              # 混合检索 · 双闸门 · RRF · es-sparse（OPS-1 http 切片）
  eval/
    l1-matrix.ts           # L1 2×2 纯函数（A–D · coverage）；error 不计格
    l1-matrix.test.ts
  scripts/
    run-l1-golden.ts       # L1 批跑 CLI：串行 executeAsk(skipTrace) → artifacts/；可选 persist eval_runs
    run-l1-golden.test.ts  # loadGold · mock execute 注入（CI 不跑 live LLM）
    seed-es-sparse-probe.ts # OPS-1：PG chunks → ES bulk + sample search
  obs/                     # metrics · rate-limit · memory/ask tracer
  gates/                   # 上传体积 · 审批 scan
  ready/checks.ts
  lib/response.ts · pg-error.ts
  logger.ts
```

仓根 fixture / 产物（非 `src/`）：

```text
fixtures/l1/gold.yaml      # JSON 形；≥60（ans30+una30；非签字真跑）
fixtures/l1/RACI.md · README.md · sample-report.md
docs/ops/live-retrieve-profile.md
artifacts/                 # gitignore；l1-last-run.{json,md}
```

## 职责

| 职责 | 说明 |
|------|------|
| HTTP | Hono + Node（**非**默认 CF Workers） |
| 身份 | Bearer access；refresh rotation（见 [auth-authorization](./auth-authorization.md)） |
| 授权 | 权限码；**禁止** role 字符串单独放行 |
| Ask | 始终 KB 成员闸；SQL/图/Prompt 不在 route 内展开（见 [ask-pipeline](./ask-pipeline.md)） |
| L1 评测 | 纯矩阵 + CLI 批跑；**非** HTTP 自调用；见 [l1-eval](./l1-eval.md) |
| 入队 | BullMQ；重活在 worker |
| 契约 | `@strict-rag/contracts` |
| 流 | 依赖 `ai`（catalog）；见 [ask-pipeline](./ask-pipeline.md) 流协议 |

前缀：`/api/v1`；鉴权：`/api/v1/auth/*`；指标：`GET /metrics`（骨架无鉴权）。

## 脚本

| 脚本 | 说明 |
|------|------|
| `dev` / `start` | tsx 起服 :4000 |
| `test` | vitest（auth · graph · ask · retrieve · chunks · sessions · feedback · obs · **eval/l1** · **scripts/run-l1-golden** …） |
| `check-types` / `lint` | tsc · eslint |
| L1 CLI（tsx） | `L1_KB_ID=… pnpm --filter @strict-rag/api exec tsx src/scripts/run-l1-golden.ts` |
