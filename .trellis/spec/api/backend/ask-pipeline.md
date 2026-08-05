# api · Ask 信任路径（code-spec）

> 路径：`apps/api/src/graph/**` · `routes/ask.ts` · `routes/sessions.ts` · `routes/feedback.ts` · `services/{ask,retrieve,gateway}/**` · `obs/**`  
> PRD：`prds/04-pipelines` · `05-api` · `07-models` · `08-quality`  
> 阶段口径：**S2 最小可演示**（非路线图 Phase 2 全文；ES 默认 mock；rewrite 强制关）

---

## Scenario: 单轮 ask（同步 JSON ≡ SSE final）

### 1. Scope / Trigger

| 触发 | 说明 |
|------|------|
| 改 ask 请求/响应字段 | 先改 `@strict-rag/contracts` `ask/*` |
| 改检索闸 / sparse 模式 | `RETRIEVE_ES_MODE` + `packages/db` `isDefaultRetrievable` |
| 改图节点 / 拒答 reason | `graph/run.ts` · `graph/reasons.ts` · contracts `AskReason` |
| 改 Gateway 调用 | `services/gateway/**`；密钥仅 env |
| 开会话 / 反馈 API | `routes/sessions` · `routes/feedback`；rewrite 仍禁止 |
| 开生产 ES / rewrite | **另建 feature**；B8 / P2.5+；禁止静默打开 |

**S2 焊死边界**：

| 允许 | 禁止（本阶段） |
|------|----------------|
| 单轮 route→retrieve→generate→verify→finalize | CRAG / multi_hop / 官方 LangGraph 图（线性状态机即可） |
| mock sparse + Gateway mock\|http | 宣称生产 ES+IK 已上（`http` 枚举预留 ≠ 已交付） |
| 会话列表/详情壳 · `rewriteUsed=false` | `SESSION_REWRITE_ENABLED=true`（启动失败） |
| 进程内 metrics / memory tracer | 完整 Langfuse 生产接线阻塞 ask |

### 2. Signatures

#### HTTP

| 方法 | 路径 | 中间件 | 说明 |
|------|------|--------|------|
| `POST` | `/api/v1/knowledge-bases/:kbId/ask` | `requireKbMember` **始终** | 同步 JSON；`Accept: text/event-stream` 或 `options.stream=true` → SSE |
| `GET` | `/api/v1/knowledge-bases/:kbId/sessions` | 成员闸 | 列表 |
| `GET` | `/api/v1/knowledge-bases/:kbId/sessions/:sessionId` | 成员闸 + 本人 | 详情/历史壳 |
| `POST` | `/api/v1/knowledge-bases/:kbId/feedback` 等 | 见 feedback 路由 | 队列/提交 |
| `GET` | `/metrics` | 无鉴权（骨架） | 生产须网关保护 |

```typescript
// routes/ask.ts — 路由只编排
// 1) AskRequestSchema.safeParse
// 2) sessionId 有则 resolveOwnedSession（本人本 KB）
// 3) 限流 ASK_RATE_LIMIT_RPM（0=关）
// 4) executeAsk → 同步 ok() 或 streamSSE
```

#### 编排分层

```text
routes/ask.ts
  → services/ask/execute.ts   # 组 GraphDeps · 落 ask_traces · 映射 AskResponse
    → graph/run.ts            # 线性状态机（非 LangGraph.js）
      → services/retrieve     # 双闸门 + RRF + rerank
      → services/gateway      # chat / embed / rerank
```

| 符号 | 位置 | 职责 |
|------|------|------|
| `executeAsk(params, deps?)` | `services/ask/execute.ts` | 业务入口；HTTP 200/409 决策 |
| `runAskGraph(input, deps)` | `graph/run.ts` | 状态机；产出 `AskGraphResult` |
| `runRetrieve(...)` | `services/retrieve` | ready∧active · RRF · rerank |
| `getGateway()` | `services/gateway` | mock \| http client |
| `isDefaultRetrievable` | `@strict-rag/db` | **唯一**默认检索闸谓词 |

#### 图结果 → HTTP

| graph / reason | HTTP | 响应 status |
|----------------|------|-------------|
| `verified` / `chitchat` | 200 | `answered` |
| 业务拒答（空证据、min 否决、rerank 挂等） | 200 | `abstained` + `reason` |
| KB 未就绪等 | 409 | failure 信封 / 映射见 execute |
| 非成员 | 403 | 中间件 |
| body 非法 / options 夹带未知字段 | 400 | `VALIDATION_ERROR` |
| session 不存在或不属于本人 | 404 | `NOT_FOUND` |

### 3. Contracts

#### Request（`AskRequestSchema` · **strict**）

| 字段 | 类型 | 约束 |
|------|------|------|
| `question` | string | 1–8000 |
| `sessionId` | uuid \| null | 可选；有则须归属校验 |
| `scope` | `{ docTypes?: string[] }` | **顶层**；max 32 docTypes |
| `options` | 见下 | **仅**四字段；`.strict()` |

`options` **仅允许**：`stream` · `debug` · `mode`(`fast|balanced|strict`) · `locale`。  
禁止：`tauClaim` · `retrieveK` · 把 `scope` 塞进 options（ADR-050）。

#### Response（同步 ≡ SSE `final` 事件 data）

| 字段 | 说明 |
|------|------|
| `requestId` · `status`(`answered\|abstained`) · `answer` · `reason` | 必有 |
| `citations[]` | **仅**本轮 evidence；拒答时 `[]` |
| `minSupport` | 仅 verified 有意义 |
| `suggestedActions` · `userMessage` | 拒答文案/动作 |
| `sessionId` · `mode` · `latencyMs` | 壳字段 |
| `debug` | 仅 `options.debug=true`；须含 `rewriteUsed: false`（P2） |

#### Env（ask 相关 · `apps/api/src/env.ts`）

| Key | 默认 | 说明 |
|-----|------|------|
| `TAU_CLAIM` | `0.5` | 验证门槛 **唯一**源；禁止客户端覆盖 |
| `RETRIEVE_ES_MODE` | `mock` | `http` 预留；未实现 B8 前运行即拒或未交付 |
| `GATEWAY_MODE` | 空→按 URL 推断 | 无 `GATEWAY_BASE_URL` → mock |
| `SESSION_REWRITE_ENABLED` | `false` | **`true` → 启动失败** |
| `ASK_RATE_LIMIT_RPM` | `0` | 0=关闭 |
| `AUTH_ENFORCE` | `false` | **不影响** ask 成员闸（始终 enforce 成员） |
| `LANGFUSE_ENABLED` | `false` | 真 SDK 不阻塞 ask |
| `OBS_MEMORY_TRACE` | `true` | 进程内 tracer |

### 4. Validation & Error Matrix

| 条件 | 结果 |
|------|------|
| JSON 非法 / Zod 失败 | 400 `VALIDATION_ERROR` |
| options 含未知键（strict） | 400 |
| KB 不存在 | 404 |
| 非成员（非 super_admin 旁路） | 403 |
| sessionId 存在但不归属 | 404 |
| 超 RPM | 429（限流开启时） |
| rerank 不可用 / 失败 | `abstained` + reason（如 `rerank_unavailable`）；**禁止** answered |
| 空证据 / 库外 | `abstained` |
| claim min 不达标 | `abstained`（min 否决） |
| 非法 citation 剥光 | 拒答路径；不进 answered |
| Gateway 超时/错误 | 映射 `mapGatewayFailureToAskReason`；稳定 reason |
| `RETRIEVE_ES_MODE=http` 未实现 | 不得 silent fallback 到假 ES 还宣称生产 |

### 5. Good / Base / Bad Cases

- **Good**：成员问库内 ready∧active 文档 → `answered` + citations ⊆ evidence  
- **Good**：库外题 → `abstained`；citations `[]`  
- **Good**：SSE 与同步 JSON 字段一致；web 只信 `final`  
- **Base**：`options` 省略 → 默认 mode/stream 行为；`rewriteUsed=false`  
- **Bad**：客户端传 `tauClaim` / 把 `scope` 放进 options → 400  
- **Bad**：rerank 挂仍 `answered`  
- **Bad**：把会话历史文本塞进 evidence_snapshot  
- **Bad**：`SESSION_REWRITE_ENABLED=true` 启动成功（必须拒绝）

### 6. Tests Required

| 层 | 断言点 |
|----|--------|
| contracts | `AskRequestSchema` 拒未知 options；scope 顶层 OK |
| graph | 库内 verified · 库外 abstained · min 否决 · rerank 失败拒答 |
| retrieve | 非 ready/非 active 不可见；RRF 顺序；mock 模式可测 |
| ask 路由 | 非成员 403；非法 body 400；session 归属 404；SSE final ≡ 同步 shape |
| sessions | 跨 session 零共享；历史 ≠ evidence |
| gateway | mock/http 选择；失败 reason 映射 |
| env | `SESSION_REWRITE_ENABLED=true` 校验失败 |
| web | `ask-sse-parse` 只应用 final；三态 UI |

证据路径：`apps/api/src/**/*.test.ts`（`graph` · `ask` · `retrieve` · `sessions` · `feedback` · `obs`）。

### 7. Wrong vs Correct

#### Wrong

```typescript
// 路由内写 ES DSL / 长 Prompt；客户端可关 verify
app.post('/ask', async (c) => {
  const { tauClaim, historyAsEvidence } = await c.req.json();
  const answer = await llm(historyAsEvidence, { skipVerify: true, tauClaim });
  return c.json({ status: 'answered', answer });
});
```

#### Correct

```typescript
// 契约 strict → executeAsk → runAskGraph；拒答走 reason
const parsed = AskRequestSchema.safeParse(raw);
if (!parsed.success) return fail(c, BizCode.VALIDATION_ERROR, '...', 400);
const { httpStatus, response } = await executeAsk({
  requestId, kbId, tenantId, userId, membership, body: parsed.data,
});
return c.json(okEnvelope(response), httpStatus);
```

---

## Design Decision: 线性状态机 vs LangGraph.js

**Context**：S2 只需单轮信任环；官方图增加依赖与调试成本。

**Decision**：`graph/run.ts` 线性状态机；注释标明 multi_hop/CRAG 再上官方图。

**Extensibility**：保持 `GraphDeps` 注入（retrieve / chat / tracer / budgetOverride）以便单测与后续换引擎。

---

## Design Decision: 检索 mock 默认

**Context**：生产 ES+IK（B8）未交付；P1 入库 ES 亦为 mock。

**Decision**：`RETRIEVE_ES_MODE=default mock`（PG chunk 文本替身）；`http` 枚举预留。

**禁止话术**：「生产 Elasticsearch 已上」。

---

## 交叉引用

- 质量红线：[guides/quality-redlines](../../guides/quality-redlines.md)  
- 鉴权成员闸：[auth-authorization](./auth-authorization.md)  
- 契约：`packages/contracts/src/ask/*`  
- 检索闸：`packages/db/src/query/retrieval-gate.ts`  
- IS 镜像：`docs/module-status/api.md`
