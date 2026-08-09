# `@strict-rag/api`

Hono + Node HTTP API。

## Phase 0

- `GET /health` — 进程存活
- `GET /ready` — PG / Redis（硬依赖）+ 可选 ES / Gateway 探测
- `GET /metrics` — 进程内指标骨架快照（P2 · #11）

## 可观测 / 限流（S2 · #11）

| 项 | 说明 |
|----|------|
| **Memory tracer** | `OBS_MEMORY_TRACE=true`（默认）：每次 ask 记录 `kb.ask` 主链 span（route→…→finalize） |
| **Langfuse** | `LANGFUSE_ENABLED=true` 时打 mock export 日志；真 SDK 后接；关开关不影响 ask |
| **限流** | `ASK_RATE_LIMIT_RPM`（默认 **0**=关）；试点可设 `30`；超限 **429** `RATE_LIMITED` |
| **指标** | `ask_total` / `ask_ok` / `ask_fail` · `llm_call_total` · `rerank_total` · `ask_rate_limited_total` |
| **日志上下文** | `requestId, tenantId, userId, kbId, sessionId?`（ask 路径） |

```bash
# 指标快照
curl -sS http://127.0.0.1:4000/metrics | jq .

# 试点限流示例
ASK_RATE_LIMIT_RPM=30 pnpm --filter @strict-rag/api dev
```

span 名（设计 §14）：`ask.route` · `ask.retrieve` · `ask.generate` · `ask.claim_split` · `ask.verify` · `ask.finalize`。  
score：`answered` · `min_support` · `reason_code` · `latency_ms`。

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

## L1 黄金集批跑（B10 工程底座）

> **工程 dogfood ≠ 业务签字**。`mode=mock` 时 2×2 数字禁止写入签字页。

| 项 | 说明 |
|----|------|
| Gold | 仓根 `fixtures/l1/gold.yaml`（≥30；逻辑 doc id 见 `fixtures/l1/README.md`） |
| 样例报告 | `fixtures/l1/sample-report.md` |
| 最近跑 | `artifacts/l1-last-run.{json,md}`（gitignore） |
| 矩阵 | `src/eval/l1-matrix.ts`（纯函数；单测进 CI） |
| CLI | `src/scripts/run-l1-golden.ts` → **executeAsk + skipTrace**（禁止第二套图） |

```bash
# CI 默认：矩阵 + mock 集成测（不跑真 LLM）
pnpm --filter @strict-rag/api test

# 手动截断冒烟（N≥5 可文档；需已入库的 L1_KB_ID）
L1_KB_ID=<kb-uuid> L1_MAX_CASES=5 \
  pnpm --filter @strict-rag/api exec tsx src/scripts/run-l1-golden.ts

# 全量 30（本地；真 Gateway / live ES 时数字才有签字参考意义）
L1_KB_ID=<kb-uuid> pnpm --filter @strict-rag/api exec tsx src/scripts/run-l1-golden.ts
```

| 环境变量 | 用途 |
|----------|------|
| `L1_KB_ID` | **必填**（CLI）测试库 |
| `L1_MAX_CASES` | 截断题数 |
| `L1_TENANT_ID` / `L1_USER_ID` | 可选；脚本有默认 |
| `L1_GOLD_PATH` / `L1_OUT_DIR` | 可选覆盖路径 |
| `RETRIEVE_ES_MODE` | 报告头 mode：`mock` \| `live`（http） |

完整签字规模 / `eval_runs` 表 → backlog **B10-followup**。

## 模型 Gateway（S2 · #4）

路径：`src/services/gateway/`（chat / embed / rerank）。

| 模式 | 条件 |
|------|------|
| `mock` | 无 `GATEWAY_BASE_URL` 或 `GATEWAY_MODE=mock`（CI 默认） |
| `http` | OpenAI 兼容：`/chat/completions` · `/embeddings` · `/rerank` |

- 同模型 `maxAttempts=2`（429 / timeout / 5xx / network）；auth 不重试  
- 全链失败抛 `GatewayError` → `mapGatewayFailureToAskReason`（rerank→`rerank_unavailable`，禁止假 answered）  
- `RERANK_MIN_NODES`：dev/test=1；staging/prod=2（需 `GATEWAY_RERANK_FALLBACK_URL`）  

```ts
import { getGateway, mapGatewayFailureToAskReason } from './services/gateway/index.js';
// graph 侧：catch GatewayError → abstain + reason，勿吞掉当 answered
```
