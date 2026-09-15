# 断线按 requestId 重拉终态最小闭环

Type: task
Label: wayfinder:task
Status: pending
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

## Comments

- 2026-09-16 认领后**未执行**：核查发现 citations 未落库（见上「前置」），硬做会产出「answered 但零引用」的假终态。已退回未认领并把前置写进题面，供下一轮直接开工。

