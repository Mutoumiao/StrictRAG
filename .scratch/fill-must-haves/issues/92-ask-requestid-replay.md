# 断线按 requestId 重拉终态最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: —
Triage: ready-for-agent
Blocked by: 91

## Question

补 P2 可靠性真空：流式回答断线后，用户无法按 `requestId` 取回该轮**终态**，只能重问。

权威：功能表 §3 流式回答行「断线可按 `requestId` 重拉终态」；`prds/05-api/01-http-api-hono.md` ask 与引用点；ADR-047（会话壳）。

现状（源码）：

- `apps/api/src/routes/ask.ts:328` 的 `GET /ask/:requestId` 返回**审计快照**（`toAskAudit`，拒绝 `answer` 字段；契约 `.strict()` 在 `packages/contracts/src/ask/ask.contract.ts` 拒 `answer`）
- 流式 `data-status` 的 `phase='running'` part **不带 `requestId`**（`ask.ts` 约 261–264 行，`transient: true`）→ 断线时客户端可能连 id 都没有
- `apps/web/src/api/ask.ts` 注释写明「非断线重拉」；`apps/web/src/hooks/use-knowledge-ask.ts` 的 `onError` 直接落错误态，无重挂

### ⚠️ 前置：该轮 citations 现在**没有落库**（动手前必读）

`saveAskTrace`（`apps/api/src/services/ask/traces.ts`）落的是 `status / reason / min_support / latency_ms / mode / answer / evidence_snapshot / graph_trace / config_snap`：

- `ask_traces` **没有 citations 列**（`packages/db/src/schema/ask/ask-traces.ts`）
- `graphTrace` 只留 `llmCalls / retrieveCalls / route_source / routeLabel`（`traces.ts` `pickGraphTrace`；`execute.ts` 也只传这四个）
- **不能**从 answer 文本反推：`generateSystemPrompt()`（`apps/api/src/graph/prompts.ts`）要求 citations 走**独立 JSON 数组**，**没有**要求答案里嵌 `[chunkId]` token —— 拿 answer 里的 token 去凑 citations 会得到空集（假 answered）
- 因此「终态与在线同形」**必须先持久化该轮 citations**（新列 + `db:generate` 迁移 + execute 写入），否则只能吐出 answered 却零引用 —— 那正是本工单禁止的「用审计 preview 冒充 answered」同类错误

**先决条件**：先落 citations 持久化，再做重拉路由与客户端重挂。

口径：

- 提供终态回读：`requestId` → 该轮 `AskResponse` 形状，**与在线终态同形**（`status` / `answer` / `citations` / `reason` / `userMessage` / `suggestedActions` / `minSupport`）
- `userMessage` / `suggestedActions` 可由 `reason` 经既有纯函数 `reasonPresentation()` 确定性重建（`apps/api/src/graph/reasons.ts`），不是编造
- **禁止**用审计 preview 冒充 answered：审计接口语义不变，终态回读另走一处（如 `GET /ask/:requestId/final`）
- 未完成的轮次（无终态落库）→ 明确可辨的「未就绪」表达，**不得**编造 answered；客户端需能区分「还没好」与「不存在」
- 非成员 / 越权读他人轮次 → 403 / 404，不得泄漏
- `running` part 带 `requestId`（或客户端自行下发 `X-Request-Id`，`requestIdMiddleware` 已支持透传），断线时客户端拿得到 id
- 测例禁止真 Gateway / 真集群 / 墙钟

### 做

- **前置**：`ask_traces` 增 citations（jsonb）+ 迁移 + `saveAskTrace` / `executeAsk` 写入；`toAskFinal` 纯函数（含 `ready` 判别）
- api：`requestId` 终态回读（含成员闸）；`running` part 带 `requestId`
- contracts：终态回读 DTO
- web：断线后按 id 重挂终态（不重发提问）
- 测例：api 终态回读形状与在线一致；无 citations 落库时不冒充 answered；非成员 403；未就绪明确；web 断线重挂

### 不做

- 审计管理台 / Langfuse SDK / 断线轮询风暴（只重拉一次）
- 改 ask 图 / min 否决 / verify / 门禁
- 会话 rewrite 默认开 / 连续追问宣传
- 文档策略快照 / citation 去重（前两张）/ 孤儿清理 / 签字包链 / `dedupe_cross_doc_rate` / metrics 维
- 默认开 `DEPT_ACL_ENFORCE` / 角色 principal / 真引擎
- 改 `prds/00–11`

收工：`.trellis/spec/` api ask-pipeline + web module-layering、db database-guidelines；`docs/module-status/` api · web · contracts · db。禁止 push。禁止 `task.py create`。

## Answer

**做了什么**

- **前置（数据）**：`ask_traces` 增 `citations` jsonb（`packages/db/src/schema/ask/ask-traces.ts`）。**无默认值**是刻意的：`NULL` = 该列之前未记录（迁移前旧文）、`[]` = 当时确实零引用（拒答 / 闲聊轮），二者必须可辨，否则旧 answered 轮会被读成「answered 且零引用」。迁移 `packages/db/drizzle/0017_ask_traces_citations.sql` + `meta/_journal.json` 条目 idx 17。`saveAskTrace` / `executeAsk` 落该列。
  - 顺带发现：**`db:generate` 实际不可用** —— `drizzle/meta/` 只留了 `0000_snapshot.json`，生成结果是 26 张表全量 `CREATE TABLE`（而非增量）。按仓内既有实践**手写**了 SQL 与 journal 条目，并把这条实测事实写进 `.trellis/spec/db/backend/database-guidelines.md` 与 `docs/module-status/db.md`。
- **终态重建**：`services/ask/traces.ts#toAskFinal`（纯函数，含 `ready` 判别）。`userMessage` / `suggestedActions` 由 `reasonPresentation()` 确定性重建（图中无节点改写二者，`state.suggestedActions` 恒 `[]`），因此**与在线逐字段相等** —— 测例拿 `executeAsk` 的在线响应做**深等**（`toEqual`），不是"看起来差不多"。
- **HTTP**：`GET /api/v1/ask/:requestId/final`（`requireAuth` + `evaluateKbMember`，与审计口同口径；超管旁路）。`ready=true` → `{ requestId, ready, response }`；不可同形 → `ready=false` + `message`；无 trace → 404。契约 `AskFinalResponseSchema` 为 `ready` 判别联合且 `.strict()`（`ready=false` 拒 `response` 与审计字段）。
- **id 拿得到**：流式 `data-status(phase=running)` 带本轮 `requestId`（`AskSseStatusSchema` 增可选 `requestId`）；web 侧**客户端自铸** `x-request-id`（`requestIdMiddleware` 已透传，服务端采纳为同一 id，有测例钉住）。
- **web**：`getAskFinal` / `newAskRequestId` / `withRequestId`；hook 增 `recovering` / `unavailable` 两态；`onError` 且非 4xx 业务拒时**只拉一次** `/final`（**不重发提问**），`ready=true` 直接重挂 answered / abstained；读不回 → 「本轮终态暂不可读」卡；面板加 recovering 文案与该卡。

**没做什么 / 边界（如实说）**

- **「这一轮还在跑」与「从来没有这一轮」在 API 层仍不可辨**（都是 404）：trace 依旧只在 finalize 后写（PRD §2.7 铁律 5 的口径）。本轮**没做**起始标记，也**没做**进程内 in-flight 表。404 时客户端文案只能说「服务端还没有这一轮的终态记录（可能仍在处理中）」。真要区分须按 PRD §2.7 铁律 6 做 `Idempotency-Key`（未做 → 已记入地图雾）。
- 「`status=ready` 但流里没有 final」这条既有路径仍走原 error 兜底（R1 测例），**不**自动重拉（避免与 R1 语义打架）。
- 未做轮询 / 后台续传 / SSE 重连；未做审计管理台 / Langfuse SDK；未动会话 rewrite；未改 `prds/00–11`。
- **未在真浏览器验证**（本环境无浏览器工具）：web 行为只由 RTL 钩子/纯函数测例覆盖（新增 6 + 3 例），没有点过真界面；`AskPanel` 新增的 recovering 文案与 `FinalUnavailableCard` 未做视觉验证。

**验证**

- `pnpm test`（全仓 turbo）：**11/11 成功**；api 131 files / 834 passed + 3 skipped，web 18 / 55，contracts 26 / 207，db 10 / 29，admin 34 / 167，worker 33 / 153，admin-catalog 1 / 11。
- `pnpm check-types`：8/8 成功。`pnpm lint`：仍只有既有 7 条 api 测试文件 warning（本工单前即红；其间我一度把 warning 弄成 8 条——`traces.ts` 里未使用的 `AskResponse` 类型导入——已修正回 7）。
- **一次抖动**：有一轮全量 `pnpm test` 出现 api 两处 `Test timed out in 5000ms`（`acl/kb-member-gate` · `obs/tracer`，都是测试内 `await import(...)` 重模块 + 并行 worker 抢 CPU）。已单独复跑两者 → 均通过（1.5s / 3.1s）；再接一次全量 → 全绿。为进一步定性，用 `git stash`（含未跟踪）在**改动前基线**上跑：`pnpm --filter api test` 单跑**同样**只有 `kb-member-gate` 超时；基线全量 `pnpm test` 为全绿。结论：既有脆弱测例（5s 阈值 vs 1.5–3s 实测），非本工单引入；已作为「回归债（脆弱测例）」记入地图。
- 新增/改测例：`tests/ask/final-mapper.test.ts`(5) · `tests/ask/final-replay.test.ts`(8) · `tests/ask/trace-citations-column.test.ts`(3) · `packages/contracts/tests/ask/final-contract.test.ts`(6) · `apps/web/tests/ask/reconnect-final-replay.test.ts`(6) · `apps/web/tests/ask/request-id-header.test.ts`(3)；并修了 `apps/web/tests/ask/stream-ready-no-final.test.ts` 的整模块 mock（本次 `ask()` 新调 `newAskRequestId()`，旧 mock 缺该导出会直接红）。
- 收工回写：`.trellis/spec/api/backend/ask-pipeline.md`（端点表 + running part + Tests Required）· `.trellis/spec/web/frontend/module-layering.md`（api/ask 职责 + 导航 + checklist）· `.trellis/spec/db/backend/database-guidelines.md`（citations 语义 + 迁移实测债）；`docs/module-status/{api,web,contracts,db}.md`。

## Comments

- 2026-09-16 认领后**未执行**：核查发现 citations 未落库（见上「前置」），硬做会产出「answered 但零引用」的假终态。已退回未认领并把前置写进题面，供下一轮直接开工。
- 2026-09-16 完成：先落迁移与写入，再做 `toAskFinal` + `/final` 路由 + web 重挂；同批修掉自己引入的第 8 条 lint warning，并把「基线对照」证据补全（见「验证」）。

