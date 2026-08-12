# api · Ask 信任路径（code-spec）

> 路径：`apps/api/src/graph/**` · `routes/ask.ts` · `routes/sessions.ts` · `routes/feedback.ts` · `services/{ask,retrieve,gateway}/**` · `obs/**`  
> PRD：`prds/04-pipelines` · `05-api` · `07-models` · `08-quality`  
> 阶段口径：**S2 最小可演示**（非路线图 Phase 2 全文；ES 默认 mock；rewrite 强制关）

---

## Scenario: 单轮 ask（同步 JSON ≡ 流式 data-ask-final）

### 1. Scope / Trigger

| 触发 | 说明 |
|------|------|
| 改 ask 请求/响应字段 | 先改 `@strict-rag/contracts` `ask/*` |
| 改检索闸 / sparse 模式 | `RETRIEVE_ES_MODE` + `packages/db` `isDefaultRetrievable` |
| 改图节点 / 拒答 reason | `graph/run.ts` · `graph/reasons.ts` · contracts `AskReason` |
| 改 Gateway 调用 | `services/gateway/**`；密钥 env 或 DB provider；ask 用 `getGatewayForTenant` |
| 开会话 / 反馈 API | `routes/sessions` · `routes/feedback`；rewrite 仍禁止 |
| 开生产 ES / rewrite | **另建 feature**；B8 / P2.5+；禁止静默打开 |

**S2 焊死边界**：

| 允许 | 禁止（本阶段） |
|------|----------------|
| 单轮 route→retrieve→generate→verify→finalize | CRAG / multi_hop / 官方 LangGraph 图（线性状态机即可） |
| mock sparse（默认）或 OPS-1 `http` ES 切片 + Gateway mock\|http | 宣称生产 ES+IK 全文/多租户已上（≠ B8） |
| B2-W：KB `allowedModes`/`defaultMode`/`docTypes` 入口闸 | 客户端改 τ / 静默放宽 mode 白名单 |
| QUAL-3：rerank 双节点链；全失败拒答 | primary 挂仍假 answered / 跳过 rerank |
| B13：web 提交 feedback · admin 队列 | 把反馈写进 ask 图证据路径 |
| 会话列表/详情壳 · `rewriteUsed=false` | `SESSION_REWRITE_ENABLED=true`（启动失败） |
| 进程内 metrics / memory tracer | 完整 Langfuse 生产接线阻塞 ask |

### 2. Signatures

#### HTTP

| 方法 | 路径 | 中间件 | 说明 |
|------|------|--------|------|
| `POST` | `/api/v1/knowledge-bases/:kbId/ask` | `requireKbMember` **始终** | 同步 JSON；stream → **AI SDK UI Message Stream**（见下） |
| `GET` | `/api/v1/knowledge-bases/:kbId/sessions` | 成员闸 | 列表 |
| `GET` | `/api/v1/knowledge-bases/:kbId/sessions/:sessionId` | 成员闸 + 本人 | 详情/历史壳 |
| `POST` | `/api/v1/ask/:requestId/feedback` | 登录 + 该 trace 的 KB 成员 | B13 web 提交 |
| `GET` | `/api/v1/knowledge-bases/:kbId/feedback-queue` | `feedback.queue` | B13 admin 队列 |
| `PATCH` | `/api/v1/feedback/:feedbackId` | `feedback.queue` | B13 处理/关单 |
| `GET` | `/metrics` | 无鉴权（骨架） | 生产须网关保护 |

```typescript
// routes/ask.ts — 路由只编排
// 1) AskRequestSchema.safeParse
// 2) sessionId 有则 resolveOwnedSession（本人本 KB）
// 3) 限流 ASK_RATE_LIMIT_RPM（0=关）
// 4) executeAsk → 同步 ok() 或 createUIMessageStreamResponse（AI SDK）
```

#### 流协议（AI SDK UI Message Stream · 实现 SSOT）

| 触发 | `Accept: text/event-stream` **或** `options.stream=true` |
|------|----------------------------------------------------------|
| 库 | `ai`：`createUIMessageStream` + `createUIMessageStreamResponse` |
| **禁止** | 自研 `streamSSE` + 命名 `event: final` 解析器；P2 **禁止** `text-delta` 把未校验 token 当 knowledge 答案 |

| part type | 语义 | 客户端 |
|-----------|------|--------|
| `data-status`（transient） | 进度 `phase`；错误时 `phase=error` + code/message | loading / 即时 error 提示 |
| `data-ask-final`（id=`ask-final`） | **完整** `AskResponse`（`AskResponseSchema.parse`） | **唯一**终态答案源；与同步 `data` 字段同源 |

| 路径 | 行为 |
|------|------|
| 成功 | status → finalize + `data-ask-final` |
| `httpStatus===409`（kb_not_ready） | data-status error + **仍写** data-ask-final（abstained） |
| execute 抛错 | **必须** data-status `phase=error` + data-ask-final（`status=abstained` · `reason=internal_guard` · `answer=''` · `citations=[]`）；**禁止**只写 status 无 final（客户端会卡 loading） |
| 同步非流 | 仍 `ok/fail` 信封；409 → `BizCode.KB_NOT_READY` |

> **Gotcha**：`createUIMessageStream` 的 `execute` 内 catch **不能**只 `writer.write(data-status error)` 就 return——只订阅 final 的客户端会永久 loading。终态用 `internal_guard` 拒答 shape，**不是** answered。

> **PRD 漂移债**：`prds/05-api` §2.7 仍写 event 名 `phase/token/error/final`。实现以本文 + contracts 为准；改 WHAT 须 ADR 回写 00–11，**禁止**再实现旧 event 解析器。

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
| `getGateway()` / `getGatewayForTenant` | `services/gateway` | env 单例；ask 主路径 tenant + platform + **KB** 绑定 |
| `resolveAskMode` / `assertScopeDocTypesAllowed` | kb-settings 域 | B2-W：mode 白名单 + scope⊆docTypes |
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

#### Response（同步 JSON ≡ 流式 `data-ask-final` data）

| 字段 | 说明 |
|------|------|
| `requestId` · `status`(`answered\|abstained`) · `answer` · `reason` | 必有 |
| `citations[]` | **仅**本轮 evidence；拒答时 `[]` |
| `minSupport` | 仅 verified 有意义 |
| `suggestedActions` · `userMessage` | 拒答文案/动作 |
| `sessionId` · `mode` · `latencyMs` | 壳字段 |
| `debug` | 仅 `options.debug=true`；须含 `rewriteUsed: false`（P2） |

流内 `internal_guard` final：`userMessage` 可提示稍后重试；**禁止** `status=answered`。

#### Env（ask 相关 · `apps/api/src/env.ts`）

| Key | 默认 | 说明 |
|-----|------|------|
| `TAU_CLAIM` | `0.5` | 验证门槛 **唯一**源；禁止客户端覆盖 |
| `RETRIEVE_ES_MODE` | `mock` | `http` = ES sparse 切片（OPS-1；需 `ELASTICSEARCH_URL`）；失败 loud，禁回落 mock |
| `ELASTIC_INDEX` | `strict_rag_dev` | 仅 `http` 模式；**≠** 多租户 B8 |
| `GATEWAY_MODE` | 空→按 URL 推断 | 无 `GATEWAY_BASE_URL` → mock |
| `GATEWAY_RERANK_FALLBACK_URL` | 空 | QUAL-3 第二 rerank 节点 |
| `RERANK_MIN_NODES` | 按 `APP_ENV` | staging/prod 默认 2；dev/test 默认 1；见 [model-gateway](./model-gateway.md) §9 |
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
| `options.mode` ∉ KB `allowedModes` | 400（B2-W） |
| `scope.docTypes` 超出 KB 白名单 | 400（B2-W；空白名单=不限） |
| KB 不存在 | 404 |
| 非成员（非 super_admin 旁路） | 403 |
| sessionId 存在但不归属 | 404 |
| 超 RPM | 429（限流开启时） |
| rerank 不可用 / 双节点全失败 | `abstained` + `rerank_unavailable`；**禁止** answered（QUAL-3） |
| 空证据 / 库外 | `abstained` |
| claim min 不达标 | `abstained`（min 否决） |
| 非法 citation 剥光 | 拒答路径；不进 answered |
| Gateway 超时/错误 | 映射 `mapGatewayFailureToAskReason`；稳定 reason |
| `RETRIEVE_ES_MODE=http` ES 失败/无 URL | `internal_guard`；不得 silent fallback mock 冒充 live |
| feedback 无码 / 非成员 | 403；SLA 见 `docs/ops/feedback-sla.md` |

### 5. Good / Base / Bad Cases

- **Good**：成员问库内 ready∧active 文档 → `answered` + citations ⊆ evidence  
- **Good**：库外题 → `abstained`；citations `[]`  
- **Good**：流 `data-ask-final` 与同步 JSON 字段一致；web 只信 schema 校验后的 final  
- **Good**：execute throw → 流内仍有 `data-ask-final` + `internal_guard`（不卡 loading）  
- **Base**：`options` 省略 → 默认 mode/stream 行为；`rewriteUsed=false`  
- **Bad**：客户端传 `tauClaim` / 把 `scope` 放进 options → 400  
- **Bad**：rerank 挂仍 `answered`  
- **Bad**：stream catch **只**写 `data-status` error、无 final  
- **Bad**：把会话历史文本塞进 evidence_snapshot  
- **Bad**：`SESSION_REWRITE_ENABLED=true` 启动成功（必须拒绝）

### 6. Tests Required

| 层 | 断言点 |
|----|--------|
| contracts | `AskRequestSchema` 拒未知 options；scope 顶层 OK |
| graph | 库内 verified · 库外 abstained · min 否决 · rerank 失败拒答 |
| retrieve | 非 ready/非 active 不可见；RRF 顺序；mock 模式可测；`http` 失败 loud |
| ask 路由 | 非成员 403；非法 body 400；mode/docTypes 闸；session 归属 404；`data-ask-final` ≡ 同步 shape |
| ask 流异常 | **`execute` mock throw** → 正文含 `data-ask-final`；payload `reason==='internal_guard'` · `status==='abstained'` · `answer===''`；且存在 `data-status` `phase=error` |
| sessions | 跨 session 零共享；历史 ≠ evidence；list query 非法 limit → 400 |
| feedback | queue query 非法 status → 400；合法 status 过滤；无 `feedback.queue` → 403 |
| gateway | mock/http；QUAL-3 dual endpoints；失败 reason 映射 |
| env | `SESSION_REWRITE_ENABLED=true` 校验失败；`RERANK_MIN_NODES` 与 endpoint 数 |
| web | `useChat` + `data-ask-final`；B13 FeedbackBar → `createAskFeedback`；三态 UI；无自写 SSE |

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

// stream catch 只推 status → 客户端永久 loading
} catch (err) {
  writer.write({ type: 'data-status', data: { phase: 'error', code: 'INTERNAL' }, transient: true });
  // 缺少 data-ask-final
}
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

// stream catch：status error + 拒答形 final（AskResponseSchema.parse）
} catch (err) {
  writer.write({
    type: 'data-status',
    data: { phase: 'error', code: BizCode.INTERNAL, message: 'ask failed' },
    transient: true,
  });
  writer.write({
    type: 'data-ask-final',
    id: 'ask-final',
    data: AskResponseSchema.parse({
      requestId,
      status: 'abstained',
      answer: '',
      reason: 'internal_guard',
      citations: [],
      suggestedActions: [],
      userMessage: '服务暂时不可用，请稍后重试',
    }),
  });
}
```

---

## Design Decision: 线性状态机 vs LangGraph.js

**Context**：S2 只需单轮信任环；官方图增加依赖与调试成本。

**Decision**：`graph/run.ts` 线性状态机；注释标明 multi_hop/CRAG 再上官方图。

**Extensibility**：保持 `GraphDeps` 注入（retrieve / chat / tracer / budgetOverride）以便单测与后续换引擎。

---

## Design Decision: 检索 mock 默认

**Context**：生产 ES+IK（B8）未交付；P1 入库 ES 亦为 mock。

**Decision**：`RETRIEVE_ES_MODE=default mock`（PG chunk 文本替身）；`http` = OPS-1 ES BM25 切片（`es-sparse.ts`）；全文 B8 仍延期。签字 profile：`docs/ops/live-retrieve-profile.md`。

**禁止话术**：「生产 Elasticsearch 已上」。

---

## Design Decision: B2-W mode / docTypes 在 ask 入口而非仅 UI

**Context**：settings 写路径已有，但 ask 不读则配置无效。

**Decision**：`executeAsk` / route 读 KB `config_json` → `resolveAskMode` + `assertScopeDocTypesAllowed`；非法 **400**（非静默改 mode）。

**Related**：[kb-settings](./kb-settings.md)。

---

## Design Decision: 批跑 / 单测使用 skipTrace

**Context**：L1 黄金集与大量 graph 单测若落 `ask_traces`，污染库表且拖慢。

**Decision**：`ExecuteAskDeps.skipTrace: true` 跳过 `saveAskTrace`；route 生产路径 **不**传（默认落库）。  
L1 批跑 **强制** skipTrace；细节见 [l1-eval](./l1-eval.md)。

```ts
// Good — 评测 / 重注入单测
await executeAsk(params, { skipTrace: true, graphDeps: { ... } });

// Bad — 批跑默认落库
await executeAsk(params); // 30+ 题 × 多次迭代 → traces 噪声
```

---

## 交叉引用

- 质量红线：[guides/quality-redlines](../../guides/quality-redlines.md)  
- P0 自动化清单：`docs/testing/p0-redlines.md`（R7 corpus · R8 min · R9 verify 负向）  
- L1 黄金集工程 seed：[l1-eval](./l1-eval.md)  
- 鉴权成员闸：[auth-authorization](./auth-authorization.md)  
- 契约：`packages/contracts/src/ask/*` · 测试工厂 `@strict-rag/contracts/testing`  
- 检索闸纯函数：`packages/db/src/query/retrieval-gate.ts`（底层）  
- 检索闸 **生产装载**：`apps/api/src/services/retrieve/corpus.ts` · `filterDocsForRetrieve`（P0 R7 主锚）  
- IS 镜像：`docs/module-status/api.md`
