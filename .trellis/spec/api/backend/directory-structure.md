# api · 目录结构

## 当前（S2 最小）

```text
apps/api/
  tests/
    index.md               # 本包测例导航（HOW：guides/testing.md）
  src/
    index.ts                 # 启动 + SIGINT/SIGTERM → closeDb/closeQueue
    app.ts                   # createApp：requestId → secure → timeout → bodyLimit → auth → adminWriteAudit → routes → notFound/onError
    env.ts                   # Zod env（+ API_REQUEST_TIMEOUT_MS · API_JSON_BODY_LIMIT_BYTES …）
    auth/
      types.ts
      middleware.ts          # attachAuth · requireAuth · requirePermission · WhenEnforced · requireKbMember · requireKbScope · evaluateKbMember · isAuthEnforceEnabled
      kb-scope.ts            # ARCH-P1b-1：lookupKbMembership 请求内缓存纯函数
      role-hydrate.ts        # B4-W：DB 角色 ≤5s 缓存 · ROLE_LOAD_TIMEOUT · vitest 默认 null loader
      # QUAL-1 测例在 tests/auth/enforce-401.test.ts
      identity/              # 双 JWT 过渡
        jwt.ts · refresh-store.ts · token-service.ts
      permissions/resolve.ts # 有效码求值 · super_admin 旁路成员
    graph/                   # 单轮信任路径（线性状态机）
      run.ts · state.ts · prompts.ts · parse.ts · route-rules.ts
      budget.ts · reasons.ts · tracer.ts
      # ask 图测例在 tests/ask/（min-veto / verify-required / rewrite-* 等）
    routes/
      auth.ts                # dev-login · refresh · me · bootstrap ensureUserRoleCodes
      documents/             # ARCH-P1a 试点：按域目录（P1 入库 + B12 complete/reindex 闸 + P3b-META PATCH + complete 可写部门）
        index.ts             # export documentRoutes · PATCH / complete 写部门两字段 · GET 列表 enforce 时同滤
        mappers.ts           # toListItem / toDetail 纯函数
      chunks.ts              # B1 分片只读 list/detail（ADR-052）
      members.ts             # 成员 list/invite/delete
      ask.ts                 # POST …/ask 同步 + AI SDK UI Message Stream（B2-W mode/docTypes）
      sessions.ts            # 会话壳（rewrite 默认关；图边在 graph/run.ts）
      feedback.ts            # B13：POST/PATCH 用 evaluateKbMember / checkPermission({ kbId })
      kb-settings.ts         # B2/B2-W 知识库设置
      chunk-strategies.ts    # ADR-053 catalog / schema / for-upload / PATCH
      model-gateway.ts       # B3 模型供应商 + 平台绑定
      platform-users-roles.ts # B4（写路径 invalidateRoleCache）
      departments.ts         # B5
      dashboard.ts           # B6 数据面板只读 summary
    openapi/                 # ARCH-P2-1：OpenAPI 3.1 文档 + Scalar HTML（dev/test 默认开）
      document.ts            # buildOpenApiDocument · components 自 contracts Zod toJSONSchema
      routes.ts              # GET /api/v1/openapi.json · /api/v1/docs · OPENAPI_DOCS_ENABLED
    middleware/
      request-id.ts          # X-Request-Id · ApiVariables.kbMemberCache?
      timeout.ts             # 可关全局 timeout；ask except
      body-limit.ts          # JSON 体限；上传/complete except
      on-error.ts            # 全局 throw 兜底
      admin-write-audit.ts   # ARCH-P1b-2 管理写路径 Pino 操作日志（不落表）
    # secureHeaders / notFound 直接在 app.ts 内联
    services/
      documents.ts · kb-list.ts · chunks.ts · chunk-strategies.ts  # B12 注册表
      members.ts · sessions.ts · feedback.ts · kb-settings.ts · model-gateway.ts
      platform-users-roles.ts · departments.ts · dashboard.ts
      db.ts · storage.ts · queue.ts
      ask/                   # executeAsk · session-window（近窗裁剪）· session-guard · traces 落库
      gateway/               # chat · embed · rerank；B3-W bindings + QUAL-3 dual endpoints
      retrieve/              # 混合检索 · 双闸门 · RRF · es-sparse（OPS-1 http 切片）
    eval/
      l1-matrix.ts           # L1 2×2 纯函数（A–D · coverage）；error 不计格
      l2-gold.ts             # L2 多轮题面加载 / 覆盖（纯函数）
      l2-fingerprint.ts      # P2.5-L2S：rewrite prompt+model 指纹（纯函数；≠ 准出）
      adr046-snapshot.ts     # ADR-046 配置快照绑定 + 硬门单向 + 四要素 / businessPass 闸
      # 评测测例在 tests/eval/
    scripts/
      run-l1-golden.ts       # L1 批跑 CLI：串行 executeAsk(skipTrace) → artifacts/；可选 persist eval_runs
      run-l2-golden.ts       # L2 批跑 CLI：进程内窗 + 末轮机械分；signoffEligible 恒 false
      # CLI 测例在 tests/eval/l1-cli.test.ts · l2-cli.test.ts
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
fixtures/l1/RACI.md · README.md · sample-report.md  # B10-RACI owner 表
fixtures/l2/gold.yaml      # JSON 形；≥15；run_type=session_multiturn；signoffEligible=false
fixtures/l2/RACI.md · README.md · sample-report.md
fixtures/l2/corpus/        # 差旅/餐补/请假短制度草案（本窗不入库）
docs/ops/live-retrieve-profile.md   # OPS-1
docs/ops/at-rest-checklist.md       # OPS-2
docs/ops/feedback-sla.md            # B13 运营 SLA
artifacts/                 # gitignore；l1-last-run.{json,md}
```

## 职责

| 职责 | 说明 |
|------|------|
| HTTP | Hono + Node（**非**默认 CF Workers） |
| 身份 | Bearer access；refresh rotation（见 [auth-authorization](./auth-authorization.md)） |
| 授权 | 权限码；**禁止** role 字符串单独放行 |
| Ask | 始终 KB 成员闸；B2-W mode/docTypes；SQL/图/Prompt 不在 route 内展开（见 [ask-pipeline](./ask-pipeline.md)） |
| 分片策略 | B12 注册表 + complete/reindex 闸；见 [chunk-strategies](./chunk-strategies.md) |
| L1 评测 | 纯矩阵 + CLI 批跑；**非** HTTP 自调用；见 [l1-eval](./l1-eval.md) |
| 入队 | BullMQ；重活在 worker |
| 契约 | `@strict-rag/contracts` |
| 流 | 依赖 `ai`（catalog）；见 [ask-pipeline](./ask-pipeline.md) 流协议 |

前缀：`/api/v1`；鉴权：`/api/v1/auth/*`；指标：`GET /metrics`（骨架无鉴权）。

## Placement Rules（X-30）

| 新增能力 | 默认落点 | 禁止 |
|----------|----------|------|
| HTTP 路由 | 默认 `routes/<domain>.ts` + `app.ts` 挂载；**ARCH-P1a 试点**域目录 = `routes/documents/`（`index.ts` 导出 Hono） | route 内 SQL / 长 Prompt / ES DSL；**禁止**同 PR 全量搬家其它域 |
| 业务编排 | `services/<domain>.ts` 或 `services/<domain>/` | 在 `routes` 堆事务 |
| 身份/验码 | `auth/**` | handler 私写 JWT 解析 |
| Ask 图 | `graph/**` + `services/ask` + `services/retrieve` | 第二套平行图抄本；文档/库外回溯判定在 `session-window.ts`，提权在 `retrieve.ts`（RRF 后、rerank 前），禁 intent LLM |
| 契约类型 | `@strict-rag/contracts` | apps 内 `type XxxResponse` |
| OpenAPI / Scalar（ARCH-P2-1） | `openapi/document.ts` + `openapi/routes.ts`；schema **只**从 contracts Zod 派生 | 平行手写字段表当 SSOT；OpenAPIHono 全量重写 route；宣称生产发布流水线 |
| 入库重活 | **enqueue** → worker | api 内跑 chunk/embed |
| 评测 CLI | `eval/` + `scripts/run-l1-golden.ts` + `scripts/run-l2-golden.ts` | HTTP 自调用假 L1/L2；L2 可选 persist `eval_runs`（`session_multiturn`）；**禁止**当准出 |
| L2 题面 | `eval/l2-gold.ts` + 仓根 `fixtures/l2/` | 改 gold 形状；开仓库默认 rewrite |
| 观测 | `obs/**` | 业务 route 打无结构 console 当指标 |
| 中间件 | `middleware/**` 或 `app.ts` 薄编排 | 每个 route 复制 timeout/bodyLimit |

**判定顺序**：contracts 有无类型？→ service 有无编排？→ 是否应在 worker？→ 最后才加 route。

## 脚本

| 脚本 | 说明 |
|------|------|
| `dev` / `start` | tsx 起服 :4000 |
| `test` | vitest（auth · graph · ask · retrieve · chunks · sessions · feedback · obs · **eval/l1** · **eval/l2-gold** · **scripts/run-l1-golden** · **scripts/run-l2-golden** …） |
| `check-types` / `lint` | tsc · eslint |
| L1 CLI（tsx） | `L1_KB_ID=… pnpm --filter @strict-rag/api exec tsx src/scripts/run-l1-golden.ts` |
| L2 CLI（tsx） | `L2_KB_ID=… pnpm --filter @strict-rag/api exec tsx src/scripts/run-l2-golden.ts`（**≠** 准出） |
