# 问答 `Idempotency-Key` 最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 103

## 目标

把 `prds/05-api/01-http-api-hono.md` §2.7 **契约铁律 6** 落地：

> 6. **幂等**：请求带 `Idempotency-Key` 时，未 finalize 前同 key 可重试/重连；已 finalize 则返回同一 `requestId` 的最终 DTO，**不得**开第二条并行图。

同义条款另见 `prds/04-pipelines/02-online-ask-langgraph.md` §8（「流式：同 key 在未 finalize 前可重连拉状态；已 finalize 则返回同一 `requestId` 结果」）与 §1 写操作总则（`prds/05-api/01-http-api-hono.md:21`）。落点与 TTL 也已冻：Redis `ask:idem:{key}`，**10m**（`prds/03-data/04-rustfs-redis.md:96`）。

现状零实现（取证见 [research-idempotency-key.md](../research-idempotency-key.md)）：同 key 重发会再跑一张完整图（LLM + 检索双花）、再写一行同 `request_id` 的 trace、带 sessionId 时还会多一轮会话历史。

## 本工单钉死的口径（PRD 未写，本仓本轮定，须在 Answer 注明是仓内口径）

1. **在途命中 → 409 `CONFLICT` + `details.requestId`**（PRD §4 错误表已有该码；客户端据此转 `GET /ask/:requestId/final` 回读）。不发明 202/长轮询。
2. **键作用域**：`sr:ask:idem:{tenantId}:{userId}:{kbId}:{rawKey}` —— 含 tenant（`prds/01-architecture/03-storage-boundaries.md:77`「Redis key 含 tenant」）+ user + kb，跨用户 / 跨 KB **构造上不可命中**。TTL 600s。
3. **同 key 不同 body**：key 即身份，**不比对 body**（PRD 无定义）；命中即复用首次结果。
4. **次序**：成员闸 / KB 一致 / mode / docTypes 闸**在前**；幂等短路在**限流之前**（重试不消耗配额）。
5. **不带该 header → 与今天逐位相同**（零回填、零回退）；**不加 env 开关**。
6. **失败释放**：claim 只在终态落库后保留；跑图抛错（trace 未写）→ 释放 claim，允许同 key 重试。
7. **header 形式**：trim 后空 → 视为未带；长度 > 200 → 400 `VALIDATION_ERROR`（不得静默降级成「无幂等」）。

## 实现

- 新增 `apps/api/src/services/ask/idempotency.ts`：`AskIdemStore` 最小面（`setNxEx` / `get` / 释放）+ 内存实现 + ioredis 适配（照 `apps/worker/src/ingest/doc-lock.ts` 形态）+ 键构造函数 + 纯决策函数。
- 新增 `apps/api/src/services/redis.ts`：api 侧共享 ioredis 单例（`getApiRedis` / `closeApiRedis`），`services/queue.ts` 改用它（同一条连接）。
- `apps/api/src/routes/ask.ts`：`POST …/ask` 读 `Idempotency-Key`；命中已 finalize → 复用 `toAskFinal` 返回**同形** DTO（流式则写 `data-ask-final`）；命中在途 → 409；`AskRouteDeps` 加 `idemStore?` 注入点。
- 契约**不**改 `AskRequestSchema`（`.strict()`，键是请求头）。
- OpenAPI：`POST /ask` 节点登记可选 header `Idempotency-Key`（若节点结构允许，不破既有断言）。

## 测例

- `apps/api/tests/ask/idempotency-key.test.ts`：同 key 重放不跑图且 DTO 与在线**深等**；在途 409 + `details.requestId`；无 key 行为不变；跨用户 / 跨 KB 不命中；非成员仍 403；重试不消耗配额；超长 key 400；流式重放写 `data-ask-final`；trace 不可同形 → 409。
- `apps/api/tests/ask/idempotency-store.test.ts`：键形（含 tenant/user/kb）、内存 store 的 claim/reuse/释放、ioredis 适配（假客户端断言 `SET … EX … NX` 参数）。
- 两个文件都要登记 `apps/api/tests/index.md`。

## 不做

SSE 真重连 attach（PRD 用词是「重连**拉状态**」，409 + `/final` 已满足最小闭环）· 起始标记进 `ask_traces` · web 客户端闭环（另张）· 幂等命中计数指标（功能表无此行）· 进程内 Map 实现（多副本违反硬性「不得」）· 用 `x-request-id` 顶替 · 改 ask 图 / min 否决 / verify / 门禁。

## Answer

**已齐**（本仓口径五条钉在工单正文，PRD 只给行为/落点/TTL）。

- **代码**：新增 `apps/api/src/services/ask/idempotency.ts`（`AskIdemStore` = `setNxEx` / `get` / `del`；内存实现**仅测试**；ioredis 适配照 `doc-lock.ts` 形态；`askIdemKey` / `normalizeIdempotencyKey` / `claimAskIdem` / `releaseAskIdem` / `ASK_IDEM_TTL_SEC=600` / `ASK_IDEM_RAW_KEY_MAX=200`）与 `apps/api/src/services/redis.ts`（api 侧共享 ioredis 单例；`services/queue.ts` 改用它，队列与 KV 同一条连接，`closeQueue` 顺带回它）。
- **路由**：`POST …/ask` 在「成员闸 / KB 一致 / mode / docTypes 闸」**之后**、限流**之前**读 `Idempotency-Key`；命中已 finalize → 复用 `toAskFinal` 返回与 `/final` **同形**的 DTO（流式写 `data-status(running, 该 requestId)` + `data-ask-final`）；命中在途 → **409 `CONFLICT`** + `details.requestId` / `details.status='in_flight'`；终态不可同形 → 409 `not_replayable`；跑图抛错（终态未落库）→ 释放 claim；超长键 400；不带 header 行为逐位不变。契约**未**改 `AskRequestSchema`；OpenAPI 只在 `POST /ask` 登记可选 header。
- **测例**：`apps/api/tests/ask/idempotency-key.test.ts`（11 例：无键行为不变 / 同键不跑第二条图且与终态回读口同形 / 在途 409 / 不可同形 409 / 跨用户不命中 / 非成员 403 不占键 / 重试不吃配额 / 超长 400 / 空白键视为未带 / 流式重放写 `data-ask-final` / 抛错释放后可重试）· `apps/api/tests/ask/idempotency-store.test.ts`（8 例：TTL 冻结值 / 键含 tenant+user+kb / 归一 / 抢占复用释放 / ioredis 适配参数）。
- **门禁**：`pnpm test` **11/11**（api 137 files / 878 passed + 3 skipped）· `pnpm check-types` **8/8** · `pnpm lint` **8/8 零 warning**。
- **未做**：SSE 真重连 attach（PRD 用词是「重连**拉状态**」）· web 客户端闭环（另张）· 幂等命中计数指标（功能表无此行）· 起始标记进 `ask_traces`（会污染审计口径）· 进程内 Map（多副本违反硬性「不得」）· `x-request-id` 顶替。
- **未验证**：真 Redis 集群下的多副本行为（单测用内存 store，ioredis 适配只断言命令参数）。
