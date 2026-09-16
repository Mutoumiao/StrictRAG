# metrics fallback / node_used 维最小闭环

Type: task
Label: wayfinder:task
Status: pending
Assignee: —
Triage: ready-for-agent
Blocked by: —

## Question

补齐 P2 **指标骨架**里点名的两维。功能表 §10.3（第 576 行）逐字：「指标骨架 | `ask_*` / `llm_call_*` / `rerank_*`（**含 fallback 与 node_used**） | P2；完整直方图可 P4」。`prds/10-delivery/01-phased-roadmap.md:85` 同口径。属**必须级**。

PRD 细目：

- `prds/07-models/01-model-gateway.md` §5.1.1:214：「观测 ｜ `rerank_fail_total`、`rerank_fallback_used_total`、**`rerank_node_used{provider,model}`**、`rerank_latency_p95{node}`、`rerank_failover_rate_1h`；备用顶上超阈告警」
- 同文:235：「**fallback 可观测** ｜ `meta.fallbackUsed=true`」

现状（源码 IS）：

- 计数器设施齐：`apps/api/src/obs/metrics.ts:39-51`（`metricInc` / `metricGet` / `metricsSnapshot`，标签排序拼 key）；出口 `GET /metrics` 在 `apps/api/src/app.ts:80`（无鉴权骨架）。
- `llm_call_total{purpose,ok,plane}`（`obs/metrics.ts:140-142`）—— **无 `fallback` 维**。
- `rerank_total{ok,plane,kind?}`（`obs/metrics.ts:144-146`）—— **无 `node` 维**。
- **fallback 真值已存在却被丢**：`apps/api/src/graph/run.ts:567-575` 包装 `gateway.chat` 时只取 `res.text`，丢掉 `res.meta.fallbackUsed`；而 `apps/api/src/services/gateway/types.ts:18-27` 的 `ChatResult.meta = { provider, model, attempt, fallbackUsed, latencyMs }`，`http-client.ts:134-145` / `mock-client.ts:60-70` 都正确填 `fallbackUsed: ni > 0`。
- **rerank 节点真值存在但不出接口**：`services/gateway/http-client.ts:197-259` 遍历 `cfg.rerankEndpoints`（`ei` 即节点序位，`m = resolveRerankModel`），但返回类型是裸 `RerankHit[]`（`types.ts:30-34`）；`mock-client.ts:105-141` 同构。
- rerank 打点在调用点：`apps/api/src/services/retrieve.ts:264/266/274` 调 `recordRerank(ok, kind)`。

口径（本票执行时须在 Answer 复述）：

- `fallback` 维**只能**取自 Gateway 已算出的 `meta.fallbackUsed`，**禁止**在 api 侧自行推断（不得用 attempt / 端点序位猜）。
- `node_used` 的「node」在 rerank 上**不是** DB `ModelRef`（`services/gateway/resolve.ts:44-49` 的 `purposeEndpoints.rerank` 只有 `baseUrl/apiKey/model`）→ 定义为**绑定端点标识 / 序位 + 模型名**（PRD 07 写 `{provider,model}`，本票把 provider 落到端点标识/序位，并在票内写明这一口径不是 DB ModelRef）。
- **不得同一次调用双计**：`rerank_total` 现由调用点打；若改到客户端打点，必须在调用点撤掉，二者择一。

### 做

- `llm_call_total` 增 `fallback` 标签（值来自 `res.meta.fallbackUsed`），`recordLlmCall` 签名加可选参数；**不**改现有其它标签名与 `plane` 语义。
- rerank 侧补齐 PRD §5.1.1 点名的三个名字：`rerank_fail_total` · `rerank_fallback_used_total` · `rerank_node_used{provider,model}`（`rerank_node_used` 可作为 `rerank_total{node,provider,model}` 的一维落地；落地形态在 Answer 写明）。
- 测例：`apps/api/tests/obs/metrics.test.ts` 扩标签聚合断言（可用既有 `generate-fallback` 触发路径）；rerank 双端点/回退用 `apps/api/tests/gateway/` 既有夹具。禁止真 Gateway / 真集群 / 墙钟。
- **功能表 / PRD 未点名的指标不要发明**（如延迟直方图是 P4）。

### 不做

- 远端 Prometheus / Grafana / 告警规则 / 时序存储；`rerank_latency_p95` 与 `rerank_failover_rate_1h`（P4 级，本票只补标签维）。
- 不改 Gateway 契约语义（`ChatResult.meta` 只透出，不改含义）；不改限流 / 三平面配额语义（`ask_total{plane}` 已被 `apps/api/tests/obs/quota-planes.test.ts` 钉住）。
- 不改 `prds/00–11`；不碰检索闸、门禁、默认关的强制开关；不 `task.py create`；禁止 push。

收工：`.trellis/spec/api/backend/` 指标相关节（`l3-metrics.md` 或 obs 一节）+ `docs/module-status/api.md`（obs / 指标行）。回答里写明「本票只补 `fallback` 与 rerank 节点维，未做 P4 直方图与远端导出」。

## Comments

- 2026-09-16 由 [裁定 93](./93-after-92-order.md) 排为本批首张：功能表级必须项、真值已在手、纯单测可钉。
