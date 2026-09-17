# `Idempotency-Key`（PRD 05-api §2.7 铁律 6）· 证据级取证

| 字段 | 内容 |
|------|------|
| 类型 | research（只读；未改任何源码 / 配置 / 测试 / PRD / spec / `docs/module-status`） |
| 日期 | 2026-09-17 |
| 前置阅读 | `.scratch/fill-must-haves/map.md` · `issues/92-ask-requestid-replay.md` · `issues/93-after-92-order.md` · `issues/98-after-96-order.md` · `docs/agents/issue-tracker.md` · `prds/05-api/01-http-api-hono.md`（0.4.34） · `prds/04-pipelines/02-online-ask-langgraph.md` · `prds/03-data/04-rustfs-redis.md` · `prds/12-delivery-guides/14-模块需求功能表.md` |
| 口径 | 引文一律逐字；行号为当前 HEAD 实测。「必须具备」严格按功能表与 `prds/00–11` 原文，不用 task/sign-off 叙事代替 |

---

## 0. 结论速览

| # | 结论 | 强度 | 证据 |
|---|------|------|------|
| 1 | 条款**已冻结且明确**：05-api §1 约定表 + §2.7 契约铁律 6；04-pipelines §8 同义重述 | 硬条文 | `prds/05-api/01-http-api-hono.md:21` · `:423`；`prds/04-pipelines/02-online-ask-langgraph.md:379` |
| 2 | 存储落点与 TTL **也已冻结**：Redis `ask:idem:{key}`，TTL **10m** | 硬条文 | `prds/03-data/04-rustfs-redis.md:96` |
| 3 | 功能表**没有** `Idempotency-Key` 行（全表 `幂等|Idempot` 零命中）；它只在 `prds/05-api` / `prds/04-pipelines` 里 | 事实 | `prds/12-delivery-guides/14-模块需求功能表.md` 全文检索无匹配 |
| 4 | 代码层**零实现**：全仓 grep `Idempotency` 无任何请求侧读取；`POST …/ask` 当前同 key 重发会**再跑一张图 + 再写一行 trace** | 事实 | `apps/api/src/routes/ask.ts:169-350`；`packages/db/drizzle/0002_phase2_ask_foundation.sql:43-68` 无唯一索引 |
| 5 | 「还在跑 vs 从未存在」在 API 层**都 404**（trace 只在 finalize 后写） | 事实 | `apps/api/src/services/ask/execute.ts:240-279`；`routes/ask.ts:393-396`；`docs/module-status/api.md:155` |
| 6 | 图**可重入、无共享可变状态**，故铁律 6 的「不得开第二条并行图」是**费用/审计/会话历史**约束，不是状态安全约束 | 事实 | `apps/api/src/graph/state.ts:130-156`；`graph/run.ts:256-266` |
| 7 | 仓内已有**同状态同 DTO 不报错**先例（approve 已批 → 200 同形）与**可注入 Redis store**先例（doc-lock），足以支撑本工单不发明新模式 | 事实 | `apps/api/src/routes/documents/index.ts:451-454`；`apps/worker/src/ingest/doc-lock.ts:37-53` |
| 8 | 定性：**可直接落 task 型**（无需先开决定工单），但工单须显式钉 5 条未冻口径（见 §7.3） | 判断 | 见 §8 |

**一句话**：这不是「要不要做」的开放问题——PRD 已把行为、落点、TTL 三样都冻了，缺的只是实现；但它有一个**必须由工单书面钉死的空白**：命中在途 key 时对外返回什么（PRD 未写）。

---

## 1. PRD 原文与其它冻结条款

### 1.1 §1 约定（写操作总则）

`prds/05-api/01-http-api-hono.md:21` 逐字：

```
| 幂等 | 写操作支持 `Idempotency-Key` |
```

同表上下文（10–23 行的「约定」表）：前缀 `/api/v1`、鉴权 `Authorization: Bearer <JWT>`、租户在 JWT、成功/业务拒答 HTTP **200** + 业务 status、系统错误 4xx/5xx + `error.code`、风格 `Resp.ok`/OpenAPI。

> 注意：此处是**全 API 总则**（「写操作」），ask 的幂等另有 §2.7 铁律 6 专门条文（更具体、更严格）。

### 1.2 §2.7 流式（Phase 2 必达 · ADR-030 · ADR-058 修订 wire）

小节标题 `prds/05-api/01-http-api-hono.md:396`。表内与本主题相关的行（同文 400–404）：

```
| 同步 JSON | **必达**（评测/脚本/集成） |
| SSE / UI Message Stream | **必达**；`Accept: text/event-stream` 或 `options.stream=true` |
| apps/web 默认 | **`stream=true`** |
| **Wire SSOT** | **Vercel AI SDK UI Message Stream**（`createUIMessageStream` / `createUIMessageStreamResponse`） |
| 准确率 | 未 finalize 前 **不得** 把未校验 token 当作最终 knowledge 答案展示（可进度/占位；拒答须作废缓冲） |
```

「契约铁律」六条（同文 416–423）中的**铁律 5 与铁律 6 逐字**：

```
5. 连接中断：服务端仍写 `ask_traces`（若已 finalize）；客户端重拉 `GET /ask/:requestId`（若已提供）。  
6. **幂等**：请求带 `Idempotency-Key` 时，未 finalize 前同 key 可重试/重连；已 finalize 则返回同一 `requestId` 的最终 DTO，**不得**开第二条并行图。  
```

（行号：铁律 1 = 418，2 = 419，3 = 420，4 = 421，**5 = 422**，**6 = 423**；§2.8 从 425 起。）

> 铁律 5 与 6 是**姊妹条**：5 定义了「终态可回读」（工单 92 已交付 `/final`）；6 定义了「重试不重跑」（**本工单**）。工单 92 的 Answer 也如此自陈：「真要区分须按 PRD §2.7 铁律 6 做 `Idempotency-Key`（未做 → 已记入地图雾）」（`issues/92-ask-requestid-replay.md:74`）。

### 1.3 其它域 PRD 的同一口径

| 条款 | 逐字引文 | 说明 |
|------|----------|------|
| `prds/04-pipelines/02-online-ask-langgraph.md:379`（§8 非功能） | `\| 幂等 \| 写操作支持 \`Idempotency-Key\`；**流式**：同 key 在未 finalize 前可重连拉状态；已 finalize 则返回同一 \`requestId\` 结果（见 API） \|` | 与 05-api 铁律 6 **同义**；两句合读可见「重连拉状态」是**拉状态**，不是要求 SSE 真 attach |
| `prds/03-data/04-rustfs-redis.md:96`（§2.1 Redis 用途表） | `\| ask:idem:{key} \| 问答幂等 \| 10m \|` | **落点 + TTL 已冻**（同一张表里另有 `bull:*` / `rl:{tenant}:{route}` / `emb:cache:{hash}` / `kb:cfg:{kbId}` / `lock:reindex:{docId}`） |
| `prds/01-architecture/03-storage-boundaries.md:77` | `\| Redis \| key 含 tenant \|` | Redis 键的隔离要求（与上一条的扁平 `ask:idem:{key}` 并读时须补 tenant；见 §7.2） |
| `prds/01-architecture/03-storage-boundaries.md:31` | 「**禁止**跨库两阶段提交；顺序：**先 PG 记账 → 再副作用 → 失败可重试/对账」 | 与「先 claim 再跑图」还是「跑完再写 key」的次序选择相关 |

### 1.4 明确**不覆盖** ask 请求幂等的条款（避免误用）

| 条款 | 逐字 | 为何不能顶替 |
|------|------|--------------|
| `prds/06-async/01-bullmq-jobs.md:99` | 「embed / es_index / maintenance **必须**带 `docId` + `indexVersion`（幂等键组成部分）。」 | 异步入库 job 幂等，**另一域** |
| `prds/06-async/01-bullmq-jobs.md:159` | 「将该 tenant ready chunks bulk 到新 index；可选双写窗口；`_id=chunkId` 幂等」 | ES 写入幂等，另一域 |
| `prds/02-engineering/01-clhoria-template-alignment.md:74` | 「日志上下文：`requestId, tenantId, userId, kbId?, sessionId?`。」 | 只说日志上下文，不是幂等契约 |
| `prds/11-decisions/00-adr-index.md` | 全文件 grep `Idempotency` **零命中** | **无 ADR 条目**；本主题目前只由 05-api / 04-pipelines / 03-data 三处冻结 |

### 1.5 PRD **未**定义的细节（本报告的关键空白清单）

全仓检索后确认以下细节**无任何冻结条文**：

1. **在途命中时的对外表示**：同 key 未 finalize 时，第二个请求应返回什么（409？202？还是等？）——铁律 6 只写「可重试/重连」，没写响应码/信封。
2. **key 作用域**：是否含 tenant / userId / kbId（03-data 只给 `ask:idem:{key}` 的键形）。
3. **同 key 不同 body**：语义未定义（是否 409、是否忽略 body）。
4. **与限流/成员闸的相对顺序**：未写。
5. **重试是否消耗 ask 配额**（`ASK_RATE_LIMIT_RPM`）：未写。
6. **header 名称之外的形式约束**（长度/允许字符/x-request-id 与它的关系）：未写。
7. `prds/05-api` 与 `prds/04-pipelines` 里**都没有** `X-Request-Id` / `requestId` 传输机制的条款（05-api 全文 grep `X-Request-Id` 零命中）——即「客户端自铸 requestId」这条现状**只是实现约定**，由工单 92 落地并由 spec 记录。

---

## 2. 功能表核对

**结论：`prds/12-delivery-guides/14-模块需求功能表.md` 里没有 `Idempotency-Key` 行，也没有任何「幂等」字样。**

- 对该文件单独 grep `幂等|Idempot` → **No matches found**。
- 该文件里与 ask 可靠性最接近的三处（逐字）：

| 位置 | 逐字原文 | 阶段 |
|------|----------|------|
| §3 web 必须具备（第 234 行） | 「流式回答 \| 默认 SSE；边生成边显示；**断线可按 `requestId` 重拉终态** \| P2」 | P2 必须具备 |
| §5.2 资源组（第 372 行） | 「流式 \| 同 ask，`stream=true` \| wire 对齐 AI SDK；服务端仍写 `ask_traces` \| P2」 | P2 |
| §5.2 资源组（第 371 行） | 「问答 \| `POST …/ask` \| 同步 JSON（`stream=false`）；`sessionId` 可省略（单轮）；无 ready∧active 文档 → 200 + `kb_not_ready`；带合法 sessionId 在 P2 仍走单轮 + 落历史 \| P2」 | P2 |
| §13 分期（第 714 行，P2 行） | 「单轮可信问答 + 验证 + 拒答 + **SSE** + 混合检索逐步 + …」 | P2 结束时须多出来的能力 |

- 判定：
  - 功能表把 ask 的可靠性要求表达为**「断线可按 `requestId` 重拉终态」**（第 234 行）——这项已由工单 92 交付（`GET /ask/:requestId/final`）。
  - **`Idempotency-Key` 不是功能表任何阶段（P0–P5）的入场项**；它是 `prds/00–11` 的冻结条款，出现在地图 `Not yet specified` 首条与「下一批候选未裁定」里（`map.md:127`、`map.md:117` 末尾、`map.md:132`）。
  - 因此按地图口径（「按功能表补必须具备」）它**不是功能表必备**；但按 `prds/00–11` 优先（地图 Notes：「WHAT 冲突以 `prds/00–11` 为准；功能表是派生阅读件，不是接口契约」）它仍是**已冻要求**。地图已把它单列为待裁定项，故仍应在图内处理。

---

## 3. `apps/api` 现状

### 3.1 ask 相关端点全貌

文件：`apps/api/src/routes/ask.ts`（唯一 ask 路由文件；`routes/ask/` 目录**不存在**）。

| 端点 | 行号 | 鉴权 | 现状语义 |
|------|------|------|----------|
| `GET /knowledge-bases/:kbId/ask-modes` | 135–150 | `requireKbMember`（始终） | 读 `allowedModes`/`defaultMode`；失败回全量默认 |
| `GET /knowledge-bases/:kbId/doc-types` | 152–167 | 同上 | 成员读类型枚举 |
| `POST /knowledge-bases/:kbId/ask` | 169–350 | 同上 | 同步 JSON 或 AI SDK UI Message Stream；**无幂等键** |
| `GET /ask/:requestId` | 353–380 | `requireAuth` + `evaluateKbMember`（按 trace 的 kbId） | 审计回溯（`toAskAudit`，**不带 answer**） |
| `GET /ask/:requestId/final` | 386–411 | 同上 | 终态回读（`ready:true|false`）；**无 trace → 404** |

`POST ask` 的编排顺序（同文，逐段）：JSON 解析 → `AskRequestSchema` → KB 存在 → `auth` 存在 → 读 KB 设置（mode / docTypes 闸，失败回默认）→ session 归属 → 限流（`checkLimit`）→ 分叉 sync / stream。

### 3.2 SSE 怎么发（关键：流与执行同生共死）

`apps/api/src/routes/ask.ts:266-350`：

```ts
const wantStream =
  parsed.data.options?.stream === true ||
  (c.req.header('accept') ?? '').includes('text/event-stream');

...
const stream = createUIMessageStream({
  execute: async ({ writer }) => {
    writer.write({ type: 'data-status', data: { phase: 'running', requestId }, transient: true });
    const result = await run({ requestId, kbId, tenantId, userId: auth.userId, membership, body: askBody }, deps.executeDeps);
    const finalBody = AskResponseSchema.parse(result.response);
    writer.write({ type: 'data-status', data: { phase: 'finalize', status: finalBody.status }, transient: true });
    writer.write({ type: 'data-ask-final', id: 'ask-final', data: finalBody });
  },
  onError: () => 'ask failed',
});
return createUIMessageStreamResponse({ stream });
```

要点（全部来自源码）：

- 图**在 SSE 的 `execute` 回调内联跑**（`await run(...)`），**没有**服务端「运行句柄」；响应体一旦断线，这次执行**没有**任何可供第二个请求 attach 的载体。
- `data-status(phase='running')` 带本轮 `requestId`（工单 92 新增，`AskSseStatusSchema.requestId` 见 `packages/contracts/src/ask/ask.contract.ts:92`），但**不带任何幂等键信息**。
- P2 **不推** `text-delta`；唯一终态源是 `data-ask-final`（同文 307–318）。
- execute 抛错 → 仍写 `data-status(phase='error')` + 兜底 `data-ask-final`（`abstained` / `internal_guard`）（同文 326–345）。

### 3.3 `x-request-id` 现在怎么用

`apps/api/src/middleware/request-id.ts:19-26`：

```ts
export const requestIdMiddleware = createMiddleware<{ Variables: ApiVariables }>(async (c, next) => {
  const incoming = c.req.header('x-request-id');
  const requestId = incoming && incoming.trim().length > 0 ? incoming.trim() : randomUUID();
  c.set('requestId', requestId);
  c.set('auth', null);
  c.set('effectiveCodes', new Set());
  c.header('X-Request-Id', requestId);
  await next();
});
```

链路：中间件生成/透传 → `app.use('*', requestIdMiddleware)`（`apps/api/src/app.ts:44`，位于 `attachAuthMiddleware` 之前）→ `POST ask` 取 `c.get('requestId')`（`routes/ask.ts:170`）→ 作为 `response.requestId` 与 `ask_traces.request_id` 落库（`services/ask/execute.ts:242-250`）。

现状语义（`apps/web/src/api/ask.ts:43-46` 注释逐字）：

```
/**
 * 本轮 requestId（随 `x-request-id` 下发，服务端 `requestIdMiddleware` 透传）。
 * 断线后按它重拉终态；**每轮必须换新值**（同 id 两轮会撞 trace）。
 */
```

→ 客户端**每轮自铸新 id**，无「重试用同一 id」的语义。这与 `Idempotency-Key`（标识**一次重试**）是**两种不同概念**，不能互相顶替（见 §8 判定）。

### 3.4 「还在跑 vs 从未存在」在 API 层如何体现（现状：都 404）

- 写 trace 的唯一路径在 finalize **之后**：`apps/api/src/services/ask/execute.ts:240-279`（图跑完 → 组 DTO → 原样落库；落库失败只 `log.warn`，**不阻断** 200）。
- `/final` 无 trace 即 404：`routes/ask.ts:393-396`（`if (!trace) return fail(c, BizCode.NOT_FOUND, 'ask trace not found', 404, { requestId })`）；审计口同理（`routes/ask.ts:359-362`）。
- 故在途请求（trace 未写）与不存在请求**返回值完全一致**。这是 `docs/module-status/api.md:155` 的原文口径：

> 「**无** 起始标记（trace 仍在 finalize 后写），故「还在跑」与「不存在」在 API 层不可辨 —— PRD §2.7 铁律 6 的 `Idempotency-Key` 未做」

- 工单 92 亦已把该残余面写进地图（`map.md:127`）。

### 3.5 补充取证：同 requestId 重复 POST 现在会发生什么（**无任何拦截**）

| 事实 | 证据 |
|------|------|
| `ask_traces.request_id` 是普通列，**无唯一索引** | `packages/db/drizzle/0002_phase2_ask_foundation.sql:43-68`（表定义内无 UNIQUE）；全 `drizzle/` 目录 grep `CREATE UNIQUE INDEX` 共 **10** 条，落在 10 张表（`kb_members` / `dept_cross_grants` / `gold_questions` / `platform_roles` / `user_roles` / `model_bindings` / `kb_chunk_strategies` / `departments` / `user_departments` / `ingest_reports`），**不含 `ask_traces`** |
| 每次落库都 INSERT 新 `id`（uuidv7），`request_id` 只做字段 | `packages/db/src/schema/ask/ask-traces.ts:34-35`（`requestId: text('request_id').notNull()`，无 `unique()`）；`services/ask/traces.ts:45-70` |
| 回读是 `.limit(1)`，故多行时**取哪行不确定** | `services/ask/traces.ts:72-79` |
| 会话历史**由 `ask_traces` 派生**，故重复轮会重复一轮 | `apps/api/src/services/sessions.ts:43-44`（「仅本 session 的 transcript；从 `ask_traces` 拼 user/assistant 轮次」）、`:142`、`:291-294` |

→ 结论：同 key 重发在现状下会 **① 再跑一张完整图（LLM + 检索双花） ② 再写一行同 `request_id` 的 trace（审计/回读非确定） ③ 若带 sessionId，会话历史与 rewrite 近窗多出一轮**。这三点是铁律 6 的实际动机，也说明它**不是**纯形式条款。

---

## 4. 存储现状

### 4.1 `ask_traces` 表结构与写入时机

表定义 `packages/db/src/schema/ask/ask-traces.ts:27-55`，列：`id`(PK) + 基础列（`created_at/created_by/updated_at/updated_by`，见 `_shard/base-columns.ts`）+ `tenant_id` / `kb_id` / `user_id` / `session_id` / `request_id`(text, NOT NULL) / `status` / `reason` / `min_support` / `latency_ms` / `mode` / `raw_question` / `standalone_question` / `rewrite_used` / `session_deepened` / `answer` / `citations`(jsonb, **无默认**，区分「未记录」与「零引用」) / `config_snap` / `graph_trace` / `evidence_snapshot`(jsonb default `[]`) / `langfuse_trace_id`。

写入时机（**只有一处**）：`services/ask/execute.ts:240-279`，在 `runAskGraph` 返回之后、`recordAskResult` 之后；`if (!deps.skipTrace)` 才写；**没有** UPDATE 路径，也没有「开始」INSERT。

→ 即：**只在 finalize 后写，一次，不更新**。表里**没有**任何表示「请求已受理 / 正在跑」的列。

### 4.2 migration 清单（最后一个编号）

`packages/db/drizzle/` 现存 19 个 SQL：

```
0000_phase0_schema_meta.sql          0010_eval_floor.sql
0001_phase1_kb_docs.sql              0011_ingest_reports.sql
0002_phase2_ask_foundation.sql       0012_permission_definitions.sql
0003_b3_model_gateway.sql            0013_kb_settings_audits.sql
0004_b4_platform_roles.sql           0014_p3b_acl_principals.sql
0005_b5_departments.sql              0015_ingest_report_cross_doc.sql
0006_b10_eval_runs.sql               0016_ingest_report_context_source.sql
0007_p3b_doc_dept_meta.sql           0017_ask_traces_citations.sql
0008_p3b_dept_cross_grants.sql       0018_ingest_report_dedupe_rate.sql   ← 最后一个（idx 18，见 meta/_journal.json）
0009_chunk_strategy_layers.sql
```

**工程债（影响本工单写迁移时的手法）**：`packages/db/drizzle/meta/` 只留 `0000_snapshot.json`，`db:generate` 会重写 26 张表全量 `CREATE TABLE`；现行做法是**手写 SQL + 手写 `_journal.json` 条目**（工单 92 的 Answer 与 `map.md:132`「工程债（迁移工具）」均已记录）。

### 4.3 有没有适合承载「请求中状态 / 幂等键」的现成表或列

**没有。** 逐项排除：

| 候选 | 结论 | 证据 |
|------|------|------|
| `ask_traces` 加列（起始标记 / 幂等键） | 无现成列；且地图已提示「加起始标记会污染 `status`/审计口径」 | `ask-traces.ts:27-55`；`map.md:127` |
| `ask_sessions` | 只有线程壳（`tenant_id/kb_id/user_id/title/status`），**无消息表**，transcript 由 traces 派生 | `packages/db/src/schema/ask/ask-sessions.ts:7-15`；`services/sessions.ts:43` |
| `ask_feedback` | 反馈，另一域 | `packages/db/src/schema/ask/ask-feedback.ts:9-` |
| 任意 `idem*` / `request*` 表 | **不存在**；26 个 schema 文件全览（`_shard/base-columns.ts` + 25 张表）无此物 | `packages/db/src/schema/` 目录清单 |
| Redis | **PRD 已指定**（`ask:idem:{key}`，10m）；但 `apps/api` 目前对 Redis 只有两处用途：BullMQ `Queue` 连接、`/ready` ping。**没有**通用 KV 读写助手 | `prds/03-data/04-rustfs-redis.md:96`；`apps/api/src/services/queue.ts:23-25`；`apps/api/src/ready/checks.ts:28-44` |

---

## 5. 图形与并行度

### 5.1 `runAskGraph` 的执行方式（可重入、无共享状态）

`apps/api/src/graph/run.ts:256-266`：

```ts
export async function runAskGraph(input: AskGraphInput, deps: GraphDeps): Promise<AskGraphResult> {
  const tracer = deps.tracer ?? noopTracer;
  const budget = deps.budgetOverride ?? budgetForMode(input.mode ?? 'balanced');
  let state = initState(input);
  ...
```

- 状态**每次调用新建**：`graph/state.ts:130-156` `initState()` 返回全新对象（`evidence: []` / `citations: []` / `llmCalls: 0` …）。
- 之后所有变更都是**局部不可变重赋值**（`state = { ...state, ... }`），未发现模块级可变单例。
- 唯一的模块级副作用是**观测计数器**（`recordLlmCall`，`run.ts:566-577` 的 `chatFromGateway`）与 tracer 注入（外部传入）。
- 依赖全走 `deps` 注入（`retrieve` / `chat` / `tracer` / `loadSessionWindow`），`graph/index.ts` 汇总导出。

→ 图**可重入、并发安全**；两张图并行不会有状态串扰。

### 5.2 「不得开第二条并行图」在代码上意味着什么

不是状态安全，而是四条可观测/可计费后果：

1. **LLM 与检索双花**：每张图按 `budgetForMode` 计 `maxLLMCalls` / `maxRetrieveCalls`（`run.ts:262-263`、`graph/budget.ts`），第二条图是**真调用真花钱**。
2. **同一 `requestId` 两行 trace**：落库无唯一约束（见 §3.5）。
3. **会话历史被污染**：transcript 由 traces 派生（`services/sessions.ts:43`），重复轮会让 rewrite 近窗（`execute.ts:159-172` → `clipSessionWindow`）多出内容。
4. **指标双计**：`recordAskResult` / `recordL3Ask` / `recordLlmCall`（`execute.ts:220-239`）各计一次。

**现状**：没有任何「运行中登记」——既**不拒绝**同 key 第二次请求，也**不复用**第一次结果。即铁律 6 目前**完全未实现**，「不得开第二条并行图」这条硬性「不得」在代码上**没有任何执行点**。

---

## 6. 既有幂等先例（可否复用）

| 机制 | 路径 | 语义 | 复用价值 |
|------|------|------|----------|
| 入库 job 幂等（纯函数） | `apps/worker/src/ingest/idempotency.ts:63-101` `decideChunkPath` / `:120-127` `missingEmbeddingChunkIds` | 幂等键 = `(docId, indexVersion)`；有 manifest → `resume_embed` 不重分块；无 manifest → `NO_MANIFEST` | **思路可借**（「同键要么复用要么明确失败，不得重跑」），但对象是 job 不是 HTTP 请求 |
| Redis 分布式锁（**最佳模板**） | `apps/worker/src/ingest/doc-lock.ts:37-53` `createIoredisDocLock`、`:17-25` `DocLockStore` 接口、`:66-90` `tryAcquireDocLock`/`releaseDocLock`、`:99-113` `withDocLock` | `SET key token EX ttl NX`；释放用 Lua 校验 token；**store 可注入**（单测不需要真 Redis） | **直接可借的形态**：api 侧同样应有「可注入 store + ioredis 适配」两个实现，才能纯单测 |
| 进程内固定窗口 | `apps/api/src/obs/rate-limit.ts:5`（注释「进程内 Map，非集群」）、`:13` `RateLimitStore` 可注入、`:17-22` `RateLimitOptions`、`docs/ops/rate-limit-and-metrics.md:45` | 每窗口计数；**实例间不共享** | 只可借「可注入 store」形态；**语义不可借**（它不是幂等） |
| 上传 checksum | `apps/api/src/services/storage.ts:103`、`:189`（`sha256` of body）；`services/ingest-complete-pending.ts:214-222`（`declared !== actual` → 400） | 内容完整性（声明 vs 实算），**不是请求去重** | **不可复用为请求键**。且 complete 以路径 `docId` 为资源身份、无「已 complete」闸（`ingest-complete-pending.ts:157-335` 无该分支），属「资源级重复执行」而非「请求级幂等」 |
| 跨文档去重 | `apps/worker/src/ingest/cross-doc-dedupe.ts`（字 3-gram Jaccard ≥ 0.9 → `skip_index`） | **内容**近重复，语义完全不同 | 不可复用 |
| 审批幂等（**风格先例**） | `apps/api/src/routes/documents/index.ts:451-454`：`if (doc.approvalStatus === 'approved') return ok(c, { docId, approvalStatus: 'approved' })` | **同状态 → 200 同形，不报错** | 正是铁律 6「已 finalize 则返回同一 DTO」的**仓内风格参照**；本工单照此办即可 |
| 终态同形重建（**核心可复用件**） | `apps/api/src/services/ask/traces.ts:173-217` `toAskFinal`；契约 `packages/contracts/src/ask/ask.contract.ts:156-183`（`AskFinalReadySchema` / `AskFinalPendingSchema` / `AskFinalResponseSchema` 判别联合） | 由落库行重建与在线 `data-ask-final` **同形**的 `AskResponse`；不可同形 → `ready:false` + message | **可直接复用**：铁律 6 的「返回同一 requestId 的最终 DTO」不需要新契约 |
| Redis 键规划 | `prds/03-data/04-rustfs-redis.md:96` `ask:idem:{key}` TTL 10m | 落点已冻 | **不必发明落点** |

---

## 7. 风险与边界

### 7.1 会牵动的既有测试与契约（实现时需一并核对）

| 文件 | 为何会动 |
|------|----------|
| `apps/api/tests/ask/http-stream.test.ts` | POST ask 的同步/SSE 行为矩阵（`buildApp` 直接挂 `createAskRoutes`，若路由新增幂等分支需补注入点） |
| `apps/api/tests/ask/http-validation.test.ts` | POST ask 校验/鉴权/session 闸（新增 header 解析不得破既有 400/403/404） |
| `apps/api/tests/ask/final-replay.test.ts` | 404 语义、「无 trace 与 `ready=false` 可辨」、「`running` part 带本轮 requestId」——**新态（在途命中）必须与这三条并存不冲突** |
| `apps/api/tests/ask/final-mapper.test.ts` | `toAskFinal` 判别分支（复用它的新调用点不得放宽 `ready` 判据） |
| `apps/api/tests/ask/execute-trace.test.ts` | trace 落库与「历史不进 evidence」；若改为「finalize 后写 key」需钉次序 |
| `apps/api/tests/ask/mode-doc-types-gate.test.ts` · `http-ask-modes.test.ts` | 幂等短路与 mode/docTypes 闸的相对顺序会改这些断言的前提 |
| `apps/api/tests/obs/rate-limit.test.ts` · `obs/quota-planes.test.ts` | 重试是否消耗配额（若短路放在限流前/后，计数语义变；`ask_total{plane}` 已被钉） |
| `apps/api/tests/env/openapi-document.test.ts` · `env/openapi-routes.test.ts` | 若把 `Idempotency-Key` 写进 OpenAPI `parameters`，这两个文件是契约面 |
| `apps/api/tests/env/defaults.test.ts` | 若新增 env 开关（本报告建议**不加** env，行为只在带 header 时触发） |
| `apps/web/tests/ask/request-id-header.test.ts` | 客户端已铸 `x-request-id`；若 web 同时下发 `Idempotency-Key`，该文件契约需扩（现断言「无请求号时不下发该头」） |
| `apps/web/tests/ask/reconnect-final-replay.test.ts` | 「断线只重拉一次 `/final`、不重发提问」——若引入「409 → 轮询」会让语义与计数变 |
| `apps/web/tests/ask/stream-ready-no-final.test.ts` | 原有 error 兜底路径；工单 92 已明确它「不自动重拉」，不要被本工单顺手改 |
| `packages/contracts/tests/ask/final-contract.test.ts` · `ask/contract.test.ts` | `AskFinalResponseSchema` / `AskRequestSchema`（后者是 `.strict()`，见下） |
| `apps/api/src/openapi/document.ts:577-626` | `POST /ask` 的 OpenAPI 节点（如需登记 header） |

**契约红线**：`AskRequestSchema` 是 `.strict()`（`packages/contracts/src/ask/ask.contract.ts:26-33`），把幂等键塞进 body 会**破契约**；PRD 原文亦明写它是请求头（`Idempotency-Key`）。

### 7.2 多实例部署

| 事实 | 证据 |
|------|------|
| 仓库现状**非集群假定**：限流与 metrics 都是进程内 | `apps/api/src/obs/rate-limit.ts:5` 注释「进程内 Map，非集群」；`docs/ops/rate-limit-and-metrics.md:45`「**进程内 Map，实例间不共享**」；`:74`「把 L1 Map 当集群配额 → 多副本各自窗口，可被打穿」 |
| 跨实例互斥在 worker 侧**才**用 Redis | `apps/worker/src/ingest/doc-lock.ts`（`SET NX EX`） |
| Redis 已是 api 的**硬依赖** | `apps/api/src/env.ts:26`（`REDIS_URL` 必填）；`apps/api/src/ready/checks.ts:133`（`hardDown = postgres === 'down' \|\| redis === 'down'`） |

推演：

- **若用进程内 Map 实现**：多副本下同 key 落到不同副本 → 仍开第二条图，**直接违反铁律 6 的硬性「不得」**；且 `ask:idem:{key}` 的 10m 语义要求跨副本共享。→ 不可接受（与 `docs/ops/rate-limit-and-metrics.md:74` 同型错误）。
- **若用 Redis 实现**：跨实例正确；不新增依赖类别（Redis 已是硬依赖）；`prds/03-data/04-rustfs-redis.md:96` 也已指定该落点。
- **键形注意**：`prds/01-architecture/03-storage-boundaries.md:77` 要求「Redis key 含 tenant」，而 `prds/03-data` 的写法是扁平的 `ask:idem:{key}`；工单须写明键前缀**包含 tenant**（并建议含 userId / kbId，理由见 §7.3 的安全点）。
- **TTL 边界**：10m 后同 key 会重新开图（**必须写明**，否则会被读成「永久幂等」）。

### 7.3 必须在工单里钉死的 5 条未冻口径

1. **在途命中的对外表示**（PRD 无）：建议 409 `CONFLICT`（PRD §4 错误表已有 `CONFLICT | 409 | 状态冲突（如 supersede）`，`prds/05-api/01-http-api-hono.md:559`）+ `details.requestId`，客户端据此转 `/ask/:requestId/final` 回读。
2. **键作用域**：`tenant + user + kb + key`（不加 user 则他人可用同 key 探得他人 DTO）。
3. **同 key 不同 body**：PRD 未定；最不发明的读法是「key 即身份、不比对 body」，须在工单写明是**本轮口径**而非 PRD 公式。
4. **顺序**：成员闸 + KB 一致 + mode/docTypes 闸**必须在前**（否则越权者可借他人 key 拿 DTO）；限流与幂等短路的先后须择一并写明（默认建议：短路在限流**之前**，重试不消耗配额）。
5. **安全**：命中复用**必须**重跑成员闸与「同 user / 同 kb」归属校验；跨用户 / 跨 KB 不得命中。

---

## 8. 结论

### 8.1 定性：research 型已产出结论 → **可直接落 task 型**

判据（三条同时成立）：

1. **行为已冻且无歧义**（`prds/05-api/01-http-api-hono.md:423`、`prds/04-pipelines/02-online-ask-langgraph.md:379`）。
2. **落点与 TTL 已冻**（`prds/03-data/04-rustfs-redis.md:96`），不需要新数据落点决定——这与地图上两张「需先开决定工单」的项（孤儿清理的「激活 version 表示」、签字包链的「数据来源」）**性质不同**：那两张缺的是**事实来源**，这张只缺**实现**。
3. **可复用件齐**：终态同形重建已有（`toAskFinal`）、契约已有（`AskFinalResponseSchema`）、可注入 Redis store 有先例（doc-lock）、审批幂等的「同状态同 DTO」风格有先例（`routes/documents/index.ts:451-454`）。

唯一需要「决定」的是 §7.3 的 5 条口径，其中只有第 1 条（在途表示）会外显到 wire。按仓内既有做法（如工单 95 对 `dedupe_cross_doc_rate` 公式的处理：「PRD 只给名字，本仓钉公式」），**可以在工单正文里作为本轮口径钉死并注明出处**，不必另开决定工单。

### 8.2 最小实现形态建议

- **入口**：`POST …/ask`，在「成员闸 + KB 一致 + mode/docTypes 闸」**之后**读 `Idempotency-Key`；**不带该头 → 行为与今天逐位相同**（零回填、零回退）。
- **新模块**：`apps/api/src/services/ask/idempotency.ts`——纯函数 + 可注入 `AskIdemStore`（`claim(key, requestId, ttlSec)` / `getRequestId(key)`），生产侧 ioredis 适配（照 `createIoredisDocLock` 的形态），测试侧内存实现。
- **键**：`sr:ask:idem:{tenantId}:{userId}:{kbId}:{rawKey}`，TTL **600s**（沿用冻结的 10m 与 `ask:idem` 前缀，补齐 tenant 要求）。
- **流程（三态）**：
  1. `claim` 成功 → 本轮即新建，跑图；`status` 仍由 `runAskGraph` 决定。
  2. `claim` 失败（已有 requestId）→ **不跑图** → 复用 `toAskFinal`：
     - `ready=true` → 200 同形 DTO（流式则写 `data-ask-final`）；
     - 无 trace（在途）→ 409 `CONFLICT` + `details.requestId`。
  3. 终态落库成功后（`saveAskTrace` 的 `await` 返回后）再写 finalized 标记；或**更省一步**：Redis 只存 `key → requestId`，finalize 与否直接以 `ask_traces` 存在性判定（TTL 到期即自然解除）。
- **契约**：**不**改 `AskRequestSchema`；只在 `apps/api/src/openapi/document.ts` 的 `POST /ask` 节点 `parameters` 里登记 `Idempotency-Key`（in: header, required: false）。
- **安全**：命中复用前重跑成员闸 + 归属校验（§7.3 第 5 条）。
- **规模**：**S–M**（`apps/api` 主导，约 4–6 文件；contracts / OpenAPI 各一处；web 可留后续）。
- **验证**：纯单测即可，**不需要真 Redis**（注入内存 store）——新 `apps/api/tests/ask/idempotency-key.test.ts`：同 key 重放不跑图且 DTO 与在线深等 / 在途 409 / 无 key 行为不变 / 跨用户与跨 KB 不命中 / 非成员仍 403 / 限流计数不被重试吞掉（口径钉住）。**禁止**真 Gateway / 真集群 / 墙钟。

### 8.3 三档判定

| 档 | 项 | 理由 |
|----|----|------|
| **必须做** | 「同 key 不开第二条并行图」+「已 finalize 返回同一 `requestId` 的最终 DTO」 | `prds/05-api/01-http-api-hono.md:423` 与 `prds/04-pipelines/02-online-ask-langgraph.md:379` **双处冻结**；现状零实现（§5.2）；不做则同 requestId 会污染 trace / 会话历史 / 指标并双花 LLM（§3.5、§5.2） |
| **必须做** | 在途命中的**可辨别**表达（409 + `details.requestId` 或等价），使「还在跑」与「不存在」可分 | 这是工单 92 明确留下的残余面（`issues/92-ask-requestid-replay.md:74`、`map.md:127`）；且 429/409 的分辨不改变 `/final` 既有 404 语义 |
| **必须做** | key 作用域含 tenant（+ user / kb）与命中时的成员闸重验 | `prds/01-architecture/03-storage-boundaries.md:77`（Redis key 含 tenant）+ 越权读取防护 |
| **可暂缓** | SSE **真重连 attach**（把断线客户端接回同一条在途 run / 多订阅者） | PRD 用词是「可重试/重连**拉状态**」（04-pipelines:379），且铁律 5 已把客户端路径定为「重拉 `GET /ask/:requestId`（若已提供）」（05-api:422）。用 409 + `/final` 回读即可满足最小闭环，不必须改流式架构 |
| **可暂缓** | 在途态的运维/admin 可见面（幂等命中计数、指标维、日志字段） | 功能表无此行；`/metrics` 骨架不含 ask 幂等维（`docs/ops/rate-limit-and-metrics.md:91` 的指标名例中无此类目），做了属加固 |
| **可暂缓** | web 侧闭环保（发 `Idempotency-Key` + 409 后轮询 `/final`） | 可拆为后续一张；`apps/web/src/api/ask.ts:43-46` 现有契约是「每轮换新 id」，改它有独立回归面（`request-id-header.test.ts` / `reconnect-final-replay.test.ts`） |
| **不该做** | 把幂等键塞进 ask **body** | `AskRequestSchema.strict()`（`packages/contracts/src/ask/ask.contract.ts:26-33`）会拒；PRD 明写是请求头 |
| **不该做** | 用**进程内 Map** 实现幂等 | 多副本下违反铁律 6 的硬性「不得」（§7.2；同 `docs/ops/rate-limit-and-metrics.md:74` 已否决的错误形态） |
| **不该做** | 用 `x-request-id` **顶替** `Idempotency-Key` + 要求客户端每轮复用同一 id | 两者语义不同（前者标识「这一轮」、后者标识「这次请求的重试」）；且现有 web 契约明写「每轮必须换新值（同 id 两轮会撞 trace）」（`apps/web/src/api/ask.ts:43-46`），反向改会破既有 trace 关联 |
| **不该做** | 借本工单改 ask 图 / min 否决 / verify / 门禁 / `SESSION_REWRITE_ENABLED` / 加起始标记进 `status` | 铁律 1–4 与 08-quality、ADR-047 的冻结语义；工单 92 也把「起始标记」列为未做且会污染审计口径（`map.md:127`） |
| **不该做** | 改 `prds/00–11` 或发明 `ask:idem` 以外的 Redis 键结构 | 冻结条款；落点已冻（03-data:96） |

---

## 附：不确定项（需更多证据才能下结论）

1. **在途也表示**：PRD 只说「可重试/重连」，未给 wire。本报告建议 409 `CONFLICT`，理由是 §4 错误表已有该码且语义为「状态冲突」；若产品意图是「第二个请求阻塞等待首个完成」（等同长轮询），实现与客户端都会不一样。
2. **`ask:idem:{key}` 的 `{key}` 是谁**：03-data 的键形没说是否含 tenant/user/kb。本报告按 `01-architecture/03-storage-boundaries.md:77`「Redis key 含 tenant」补 tenant，并额外建议含 user/kb——这是**推导**，不是 PRD 原文。
3. **ask 是否属 §1 的「写操作」**：从 §2.7 铁律 6 专门覆盖 ask 看，结论不受影响；但若有人主张 §1 的「写操作」不含 ask，本条仍由铁律 6 独立成立。
4. **TTL 10m 的语义**：未检索到任何材料说明 10m 是「同一轮的重试窗口」还是「缓存生命周期上限」；本报告按前者理解（与「已 finalize 则返回同一 DTO」一致）。
