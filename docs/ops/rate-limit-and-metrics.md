# 限流分层与 `/metrics` 生产保护（ARCH-P2-4）

| 字段 | 内容 |
|------|------|
| **Owner** | 后端 / 运维 |
| **Backlog** | ARCH-P2-4 · `08-06-project-backlog` |
| **状态** | 策略文档已落地（非进程内全局限流实现） |
| **非目标** | 进程内全路由 RPM 当生产方案；Prometheus 全量；改仓库默认 `ASK_RATE_LIMIT_RPM` / `INGEST_RATE_LIMIT_RPM`；Redis 集群配额；aux 运行时平面 |

---

## 1. 一句话

**生产主闸在网关（L0）**；进程内 ask / ingest 固定窗口（L1）只是试点/防误打，**非集群**。  
`GET /metrics` **默认无鉴权**——生产须网络隔离或反向代理保护，**禁止**对公网裸暴露。

---

## 2. 限流分层

```text
客户端 / 浏览器
    │
    ▼
【L0】边缘 / API 网关 / WAF
    · 全站或按路径 RPM / 并发
    · IP · 租户 · API key 配额
    · 生产主闸（本仓不实现）
    │
    ▼
【L1】api 进程 · ask 与 ingest 分平面
    · ASK_RATE_LIMIT_RPM / INGEST_RATE_LIMIT_RPM（默认 0 = 关）
    · 固定窗口 60s · 分 store · 分前缀
    · ask 键 ask:userId:kbId · ingest 键 ingest:tenantId:kbId
    · 超限 → HTTP 429 · BizCode RATE_LIMITED（不改业务码）
    · aux 只留常量，本窗不跑
    │
    ▼
ask 图 / complete 落 pending …
```

| 层 | 作用域 | 配置 / 落点 | 多实例 | 生产角色 |
|----|--------|-------------|--------|----------|
| **L0 网关** | 入口流量 | 网关产品配置（非本 monorepo 代码） | 由网关集群负责 | **主闸** |
| **L1 ask** | `POST …/ask` | `ASK_RATE_LIMIT_RPM` · `obs/rate-limit.ts` · `routes/ask.ts` | **进程内 Map，实例间不共享** | 试点 / 二次护栏 |
| **L1 ingest** | `POST …/documents/:docId/complete` 入队前 | `INGEST_RATE_LIMIT_RPM` · 同上 · `routes/documents/index.ts` | **独立 ingest store，与 ask 不共享计数** | 试点 / 二次护栏 |
| **aux** | 常量 `QUOTA_PLANES` 含 `'aux'` | 不接线 | — | 本窗不跑 |

### 2.1 L1 行为（代码锚）

| 项 | ask | ingest |
|----|-----|--------|
| 默认 | `ASK_RATE_LIMIT_RPM=0` → dev/test **不限流** | `INGEST_RATE_LIMIT_RPM=0` → dev/test **不限流** |
| staging / production 缺配置 | `0` → **warning + 安全默认 `30`**（剧本 R10：**禁止**无配置裸奔；**非** fail closed，进程照常启动） | 同左（各自告警一次） |
| 试点建议 | 部署 env **显式**设正数（如 `30`） | 同上；**禁止**把仓库默认 0 写成已开试点 |
| 算法 | 固定窗口（`windowMs` 默认 60_000） | 同 |
| 生效值来源 | `obs/plane-quota.ts` 的 `planeQuotas.ask.rpm`（由 env 决议一次，与启动告警共用） | `planeQuotas.ingest.rpm`（同文件） |
| 键 | `askRateLimitKey(userId, kbId)` → `ask:${userId}:${kbId}` | `ingestRateLimitKey(tenantId, kbId)` → `ingest:${tenantId}:${kbId}` |
| store | `askRateLimitStore` | `ingestRateLimitStore`（独立 Map） |
| 超限响应 | 429 `RATE_LIMITED`；`details.plane='ask'` + `ask_quota_exhausted: true` | 429 `RATE_LIMITED`；`details.plane='ingest'` |
| 指标 | `recordAskResult` / `recordLlmCall` / `recordRerank` 带 `plane=ask`；限流 `ask_rate_limited_total` | complete 成功或限流 `ingest_complete_total{plane=ingest}` |
| 单测 | `tests/obs/rate-limit.test.ts` · `tests/obs/quota-planes.test.ts` | `tests/obs/quota-planes.test.ts` |

打满 ask **不**阻断 complete；打满 ingest **不**阻断 ask。aux 平面常量可有、不打运行时。

```bash
# 试点示例（仅部署会话；勿改仓库 .env 默认）
ASK_RATE_LIMIT_RPM=30 INGEST_RATE_LIMIT_RPM=30 pnpm --filter @strict-rag/api dev
```

### 2.2 明确否决

| 否决项 | 原因 |
|--------|------|
| 进程内**全局限流**中间件当生产方案 | 与 ARCH 挂账一致；应放 L0 网关 |
| 把 L1 Map 当集群配额 | 多副本各自窗口，可被打穿 |
| 默认打开 `ASK_RATE_LIMIT_RPM>0` / `INGEST_RATE_LIMIT_RPM>0` | 破坏 demo/test；试点用 env 显式开。**例外**：staging/production 缺配置的**安全默认回落**（R10）不是「默认打开」——仓库 `.env` 契约与 dev/test 行为不变 |
| 用限流「静默丢弃」或 200 空答 `answered` 代替 429 信封 | 须标准 `ApiFailure` + `RATE_LIMITED`（web 认此码） |
| 改 `RATE_LIMITED` 为新业务码 | 会破 web 429 文案 |
| Redis 集群配额 / embed TPM / aux 运行时 | 本窗不做 |

---

## 3. `/metrics` 生产保护

### 3.1 现状（IS）

| 项 | 说明 |
|----|------|
| 路径 | `GET /metrics`（**不**在 `/api/v1` 下） |
| 鉴权 | **无**（与 `/health` 类似的运维面） |
| 载荷 | `{ service: 'api', metrics: metricsSnapshot() }` — 进程内 counter 快照 |
| 指标名例 | `ask_total` / `ask_ok` / `ask_fail`（`plane=ask`）· `llm_call_total{purpose,ok,fallback}`（`fallback` 取 Gateway `meta.fallbackUsed`；**调用失败拿不到该值 → 记 `unknown`，不谎报 `false`**）· `rerank_total` · `rerank_node_used{provider,model}` / `rerank_fallback_used_total{provider,model}` / `rerank_fail_total{kind}`（**node = 本轮实际尝试的 rerank 端点**；rerank 无 DB `ModelRef`，故 `provider` 落端点标识；与按 ask 调用计的 `rerank_total` **不是**同一口径）· `ask_rate_limited_total` · `ingest_complete_total`（`plane=ingest`）· `l3_rewrite_used_total` / `l3_coref_fail_total` / `l3_session_ask_total` / `l3_session_deepened_total` / `l3_topic_complaint_total` · `l3_guard_alert_total`（kind：`coref_fail_rate` / `rewrite_dogfood` / `topic_complaint` / `l2_stale`；除 dogfood 外闩后进程内关 rewrite，**≠** 写 env） |
| 非目标 | Prometheus exposition 格式 / 直方图全量（→ 更后阶段） |
| 代码 | `apps/api/src/app.ts` · `apps/api/src/obs/metrics.ts` |

```bash
curl -sS http://127.0.0.1:4000/metrics
```

### 3.2 生产策略（选一或组合）

| 选项 | 做法 | 适用 |
|------|------|------|
| **A. 网络隔离（推荐默认）** | 仅内网 / K8s NetworkPolicy / 安全组放行 scrape 源；公网 LB **不**挂载 `/metrics` | 集群内 sidecar / 内网探针 |
| **B. 反向代理鉴权** | nginx/Caddy/Gateway 对 `/metrics` 要求 mTLS 或 Basic/Bearer；应用仍无鉴权 | 共享入口但需挡匿名 |
| **C. 禁公网 path** | CDN/WAF 规则拒绝外网 `GET /metrics` | 已有 WAF |
| **D. 应用内可选门（未默认实现）** | 若未来加 `METRICS_BEARER` 类 env：**默认空=现状无鉴权**；非空才校验；须单测 | 无网关时的权宜 |

**本轮（ARCH-P2-4）采用文档策略 A–C 为生产 DoD 推荐**；**不**默认实现 D（避免破坏本地 curl 与现有测）。

### 3.3 运维检查清单

- [ ] 公网入口是否可 `curl` 到 `/metrics`？若可 → 改 A/B/C  
- [ ] scrape 目标是否仅内网 DNS / Service？  
- [ ] 指标是否含敏感标签？（当前为聚合 counter；`rerank_node_used` 的 `provider` 是**内部端点地址**，**仍**勿对公网开放）  
- [ ] 限流是否在 L0 配置？L1 是否仅作试点 env？

---

## 4. 与健康检查的边界

| 路径 | 用途 | 公网 |
|------|------|------|
| `GET /health` | 进程存活 | 负载健康检查常用；载荷极小 |
| `GET /ready` | 依赖就绪（PG/Redis 等） | 建议仅编排探针网段 |
| `GET /metrics` | 业务/骨架计数快照 | **须**保护（见 §3） |

---

## 5. 交叉引用

| 文档 / 代码 | 角色 |
|-------------|------|
| `apps/api/README.md` · 可观测 / 限流 | 开发者入口 |
| `docs/module-status/api.md` | IS 镜像 |
| `.trellis/spec/api/backend/ask-pipeline.md` | HOW：限流 X-28 · metrics 行 |
| `.trellis/tasks/08-06-project-backlog/status.md` | ARCH-P2-4 行 |
| `docs/ops/live-retrieve-profile.md` | 同目录运维 SSOT 风格参考 |

---

## 6. 变更记录

| 日期 | 内容 |
|------|------|
| 2026-08-12 | 初版 · ARCH-P2-4：L0/L1 分层 + `/metrics` 保护选项 A–C；否决进程内全局限流生产方案 |
| 2026-09-07 | 三平面配额最小闭环：ask/ingest 分 store 固定窗口；aux 只留常量；指标带 `plane` |
| 2026-09-16 | 指标骨架补 `fallback` 与 `node_used`（功能表 §10.3）：`llm_call_total` 加 `fallback` 维（真值取 Gateway `meta.fallbackUsed`，失败记 `unknown`）；rerank 加 `rerank_node_used{provider,model}` / `rerank_fallback_used_total` / `rerank_fail_total{kind}` |
| 2026-09-19 | 剧本 R10：staging/production 缺 plane 配额 → 启动 warning + 安全默认 `30`（`obs/plane-quota.ts`），**非** fail closed；dev/test 与仓库默认行为不变；路由改读 `planeQuotas.{ask,ingest}.rpm` |
