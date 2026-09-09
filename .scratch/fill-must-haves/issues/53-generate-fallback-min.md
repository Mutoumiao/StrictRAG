# generate 多模型 fallback 最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 52

## Question

补 P4 余量第一刀：绑定里已写的 generate `fallbacks` 必须在 ask 运行时切链，不能再只落库。这是本批唯一一张执行工单。

权威：[裁定 Judge AUROC 后下一步](./52-after-l1-judge-auroc-order.md)。在线编写仍 P2.x。仓库默认强制仍关。角色 principal 仍留雾。人签仍图外。

现状（源码）：

- 契约 `PurposeBinding.fallbacks` 与表 `fallback_refs` 可写可校验
- 快照 / `applyBindingsToGatewayConfig` **只吃** `primaryRef`
- http/mock `chat` 仅同模型 `withSameModelRetry`，`fallbackUsed` 恒 false
- rerank 双节点是 **URL** 链 + `RERANK_MIN_NODES`，与 generate **ModelRef** fallback 不是同一套

口径：

- **opt-in**：绑定未写 generate fallbacks → 行为与今日完全相同
- 只对 `purpose=generate` 切链；judge / claim_split / rewrite / embed / rerank **不**走这条
- 切链发生在 `gateway.chat` **内**：图层仍一次 `chargeAndChat`（与同模型重试同构），**不**额外占 `maxLLMCalls`
- primary 同模型重试耗尽后，按序试已解析的备用 ModelRef（可跨 provider：换 baseUrl/apiKey/model）
- 切到备用成功 → `meta.fallbackUsed=true`；仍走 primary → `false`
- 仅 `exhausted` / `unavailable` / retryable 才切备用；`auth` / `bad_request` / `content_filter` **不**盲切
- 调用方传 `req.model` 覆盖 → 不切备用（尊重显式模型）
- 无效/禁用/非 llm / 与 primary 同 model+url 的备用 **跳过**，不让坏备用挡住 primary
- **不**新增 `GENERATE_MIN_NODES`；staging 无备用仍可启动
- 合法 draft 仍必须 claim_split → judge；全链失败仍 `internal_guard`，禁止假 answered

### 做

- `BindingSnapshotRow` 带 `fallbackRefs`；`loadPlatformBindingSnapshot` 不再丢
- `GatewayConfig.generateFallbacks?: PurposeEndpoint[]`；`applyBindingsToGatewayConfig` 解析 generate 备用
- `resolveChatNodes`：generate 且无 model 覆盖时 primary + 备用；其它 purpose 只有 primary
- http/mock `chat` 按节点循环；每节点内仍 `withSameModelRetry`
- mock `failChat(attempt, nodeIndex)` 可按节点注入
- 测例（`tests/gateway/generate-fallback.test.ts`）：
  - 快照/resolve：有 fallbackRefs → `generateFallbacks` 有节点；空/缺省 → 无
  - KB 覆盖整行含 fallbackRefs
  - mock：primary 5xx 耗尽 → 备用成功且 `fallbackUsed=true`；无备用仍 exhausted
  - mock：primary `auth` 即使有备用也不切
  - mock：`purpose=judge` 不切 generate 备用
  - http：primary URL 503、备用 URL 200 → 成功且 `fallbackUsed=true`
  - 全备用也失败 → exhausted → `internal_guard`
- 覆盖分册 H5 缺口回写（gateway 层可测；图夹具 / 生产多活仍缺口）

### 不做

- `GENERATE_MIN_NODES` / staging 强制两条 LLM
- 把 binding fallbacks 当成 rerank 第二 URL
- 图层再 `chargeAndChat` 计一次 fallback
- claim_split / judge / rewrite / embed 全面 fallback
- 透传 `fallbackUsed` 进 ask 图 / trace（最小闭环只锁 gateway meta）
- 再认证 / 双轨看板 / 数据面板 / 写 `TAU_CLAIM` / live judge
- 仓库默认开 `DEPT_ACL_ENFORCE` / 角色 principal
- 在线编写 / P3a / 默认开 rewrite / LangGraph / E2E / B8
- 人签 / `businessPass`

收工：`.trellis/spec/` api `model-gateway.md`；`docs/module-status/api.md`；`docs/testing/coverage/00-ask.md` H5。禁止 push。禁止 `task.py create`。

写代码前读 `.trellis/spec/api/backend/model-gateway.md`、`.trellis/spec/guides/testing.md`。测例落 `tests/<能力>/`，文件头简体中文，登记 index。

## Answer

generate 多模型 fallback 最小闭环已落地。

- 快照保留 `fallbackRefs`；`applyBindingsToGatewayConfig` 解析 generate 备用为 `generateFallbacks`。无效/禁用/非 llm/重复跳过。早退路径会清掉上一轮备用，避免残留。
- `resolveChatNodes`：仅 generate 且无 model 覆盖才带备用。judge / claim_split / rewrite 只有 primary。
- http/mock `chat` 按节点切链；每节点内仍同模型重试。切到备用才 `fallbackUsed=true`。`auth` / `bad_request` / `content_filter` 不盲切。图层仍一次 `chargeAndChat`。
- 无备用 = 今日行为。无 `GENERATE_MIN_NODES`。全链失败仍 `exhausted` → `internal_guard`。
- 覆盖 H5 缺口回写（gateway 层可测；走图夹具 / 生产多活仍缺口）。

未做：再认证、双轨看板、数据面板、写 `TAU_CLAIM`、`fallbackUsed` 进 ask 图、默认开强制、角色 principal。未 `task.py create`。未 push。

证据：`apps/api/src/services/gateway/resolve.ts` · `bindings.ts` · `http-client.ts` · `mock-client.ts` · `tests/gateway/generate-fallback.test.ts`。

## Comments

- 2026-09-09 认领并执行。权威切边见 [裁定 Judge AUROC 后下一步](./52-after-l1-judge-auroc-order.md)。
- 审查指出测试 prefer-const、applyBindings 早退可能残留旧备用链；已收紧并补测。绑定 load 空 catch 回退 env 是既有 B3-W 站规，本刀不改。
