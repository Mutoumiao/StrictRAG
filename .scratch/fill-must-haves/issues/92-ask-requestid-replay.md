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

- `apps/api/src/routes/ask.ts` 的 `GET /ask/:requestId` 返回**审计快照**（`toAskAudit`，拒绝 `answer` 字段；契约 `.strict()` 在 `packages/contracts/src/ask/ask.contract.ts` 拒 `answer`）
- 流式 part 的 `requestId` 现状：running 状态不带（`transient:true`），断线时客户端可能**连 id 都没有**
- `apps/web/src/api/ask.ts` 注释写明「非断线重拉」；`ask-panel.tsx` 只消费详情，无重挂
- `ask_traces` 已落 `answer`（`packages/db/src/schema/ask/ask-traces.ts`），缺的是终态 DTO / 路由 / 客户端重挂

口径：

- 提供终态回读：`requestId` → 该轮 `AskResponse` 形状（`status` / `answer` / `citations` / `reason` 等），**与在线终态同形**
- **禁止**用审计 preview 冒充 answered：审计接口语义不变，终态回读另走一处（新路径或既有路径的明确分支，工单正文定）
- 未完成的轮次（无终态落库）→ 明确状态，**不得**编造 answered
- 非成员 / 越权读他人轮次 → 403 / 404，不得泄漏
- `running` part 是否带 `requestId` 需一并定：要让客户端断线时拿得到 id
- 测例禁止真 Gateway / 真集群 / 墙钟

### 做

- api：`requestId` 终态回读（含成员闸）；`running` part 带 `requestId`
- contracts：终态回读 DTO
- web：断线后按 id 重挂终态（不重发提问）
- 测例：api 终态回读形状与在线一致；非成员 403；无终态明确状态；web 断线重挂

### 不做

- 审计管理台 / Langfuse SDK / 断线自动重试风暴
- 改 ask 图 / min 否决 / verify / 门禁
- 会话 rewrite 默认开 / 连续追问宣传
- 文档策略快照 / citation 去重（前两张）/ 孤儿清理 / 签字包链 / `dedupe_cross_doc_rate` / metrics 维
- 默认开 `DEPT_ACL_ENFORCE` / 角色 principal / 真引擎
- 改 `prds/00–11`

收工：`.trellis/spec/` api ask-pipeline + web module-layering；`docs/module-status/` api · web · contracts。禁止 push。禁止 `task.py create`。
