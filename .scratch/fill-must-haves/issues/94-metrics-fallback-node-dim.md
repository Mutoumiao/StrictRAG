# metrics fallback / node_used 维最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
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

## Answer

**做了什么**

- `llm_call_total` 增 `fallback` 维（`apps/api/src/obs/metrics.ts` `recordLlmCall(purpose, ok, fallback?)`），真值**只**取自 Gateway 的 `meta.fallbackUsed`：`apps/api/src/graph/run.ts` 的 `chatFromGateway` 已把该值带进打点。**调用失败时拿不到该值 → 记 `unknown`**，不谎报 `false`（测例显式钉「unknown 不得并进 false」）。
- rerank 侧补齐 PRD 07 §5.1.1 点名的三个名字：`rerank_node_used{provider,model}` · `rerank_fallback_used_total{provider,model}` · `rerank_fail_total{kind}`。落地点在 **http / mock 两个客户端的端点链内**（`services/gateway/http-client.ts` · `mock-client.ts`）：成功时记「本轮实际用的端点」，`ei > 0` 才算 fallback；每次端点尝试失败记 fail。
- **口径（本票钉的，Non-PRD-公式）**：rerank **没有** DB `ModelRef`（`resolve.ts` `purposeEndpoints.rerank` 只有 baseUrl/apiKey/model）→ `node` 落**端点标识**，不是 DB provider；`rerank_fail_total{kind}` 记的是**逃出该端点**的 kind（同端点重试耗尽会被重试器归为 `exhausted`）。与调用级 `rerank_total{ok,kind}`（`retrieve.ts` 打点）**两个口径，不互为重复计数**。
- 测例：`tests/obs/metrics.test.ts` 扩到 3 例（标签聚合含 `fallback`；`unknown` 与 `false` 不混；rerank 三维按端点聚合）+ 新增 `tests/obs/metrics-fallback-wiring.test.ts` 5 例（`chatFromGateway` 真值接线：fallback=true / false / 失败 unknown；mock gateway 双端点：首选失败换端点 → node 记备用端点 + fallback 计数 1 + fail 计数；首选直答 → fallback 0）。全为纯单测，无真 Gateway / 无集群。

**没做什么**

- 未做 P4 级 `rerank_latency_p95` / `rerank_failover_rate_1h` 与任何直方图；未接 Prometheus / Grafana / 告警规则。
- 未改 Gateway 契约语义（`ChatResult.meta` 只被透出，含义不变）、未改限流与三平面配额语义、未改检索闸与门禁。
- 未改 `prds/00–11`。

**验证**

- `pnpm --filter @strict-rag/api exec vitest run tests/obs`：**10 files / 60 passed**（含新增 8 例）。
- `pnpm --filter @strict-rag/api test`：131 files / **840 passed** + 3 skipped，**唯一失败项**是既有脆弱测例 `tests/acl/kb-member-gate.test.ts > POST members without auth → 401`（`Test timed out in 5000ms`，本轮实测 6278ms；此前已用基线对照确认与本图各票无关，见地图「回归债（脆弱测例）」）。本票改动不涉 `createApp` 启动路径。
- `pnpm --filter @strict-rag/api lint`：仍是**既有 7 条** warning（本票零新增）。
- `pnpm --filter @strict-rag/api check-types`：绿。
- 回写：`.trellis/spec/api/backend/model-gateway.md` §9 增「观测」表 + Tests 行；`docs/ops/rate-limit-and-metrics.md`（§3 指标名例 + 变更记录 + §3.3 清单补「`rerank_node_used` 的 `provider` 是内部端点地址，仍勿对公网开放」）；`docs/module-status/api.md`（观测骨架行 + 最近更新）；`apps/api/tests/index.md` 两行。

## Comments

- 2026-09-16 由 [裁定 93](./93-after-92-order.md) 排为本批首张：功能表级必须项、真值已在手、纯单测可钉。
- 2026-09-16 完成。切边：只补维，不做 P4 直方图与远端导出；`rerank_total` 调用级口径保持不动。
