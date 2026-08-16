# 限流分层与 `/metrics` 生产保护（ARCH-P2-4）

| 字段 | 内容 |
|------|------|
| **Owner** | 后端 / 运维 |
| **Backlog** | ARCH-P2-4 · `08-06-project-backlog` |
| **状态** | 策略文档已落地（非进程内全局限流实现） |
| **非目标** | 进程内全路由 RPM 当生产方案；Prometheus 全量；改仓库默认 `ASK_RATE_LIMIT_RPM` |

---

## 1. 一句话

**生产主闸在网关（L0）**；进程内 ask 固定窗口（L1）只是试点/防误打。  
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
【L1】api 进程 · 仅 ask
    · ASK_RATE_LIMIT_RPM（默认 0 = 关）
    · 固定窗口 60s · 键 ask:userId:kbId
    · 超限 → HTTP 429 · BizCode RATE_LIMITED
    │
    ▼
ask 图 / 检索 / 生成 …
```

| 层 | 作用域 | 配置 / 落点 | 多实例 | 生产角色 |
|----|--------|-------------|--------|----------|
| **L0 网关** | 入口流量 | 网关产品配置（非本 monorepo 代码） | 由网关集群负责 | **主闸** |
| **L1 ask** | `POST …/ask` 仅此路径 | `ASK_RATE_LIMIT_RPM` · `apps/api/src/obs/rate-limit.ts` · `routes/ask.ts` | **进程内 Map，实例间不共享** | 试点 / 二次护栏 |

### 2.1 L1 行为（代码锚）

| 项 | 说明 |
|----|------|
| 默认 | `ASK_RATE_LIMIT_RPM=0` → **不限流**（dev / test / demo） |
| 试点建议 | 部署 env **显式**设正数（如 `30`）；**禁止**把仓库默认 0 写成「已满足试点 30」 |
| 算法 | 固定窗口（`windowMs` 默认 60_000） |
| 键 | `askRateLimitKey(userId, kbId)` → `ask:${userId}:${kbId}` |
| 超限响应 | `fail(…, BizCode.RATE_LIMITED, …, 429, { retryAfterSec })`；计数 `ask_rate_limited_total` |
| 单测 | `apps/api/src/obs/obs.test.ts`（`ask route 429 RATE_LIMITED`） |

```bash
# 试点示例（仅部署会话；勿改仓库 .env 默认）
ASK_RATE_LIMIT_RPM=30 pnpm --filter @strict-rag/api dev
```

### 2.2 明确否决

| 否决项 | 原因 |
|--------|------|
| 进程内**全局限流**中间件当生产方案 | 与 ARCH 挂账一致；应放 L0 网关 |
| 把 L1 Map 当集群配额 | 多副本各自窗口，可被打穿 |
| 默认打开 `ASK_RATE_LIMIT_RPM>0` | 破坏 demo/test；试点用 env 显式开 |
| 用限流「静默丢弃」代替 429 信封 | 须标准 `ApiFailure` + `RATE_LIMITED` |

---

## 3. `/metrics` 生产保护

### 3.1 现状（IS）

| 项 | 说明 |
|----|------|
| 路径 | `GET /metrics`（**不**在 `/api/v1` 下） |
| 鉴权 | **无**（与 `/health` 类似的运维面） |
| 载荷 | `{ service: 'api', metrics: metricsSnapshot() }` — 进程内 counter 快照 |
| 指标名例 | `ask_total` / `ask_ok` / `ask_fail` · `llm_call_total` · `rerank_total` · `ask_rate_limited_total` · `l3_rewrite_used_total` / `l3_coref_fail_total` / `l3_session_ask_total` / `l3_session_deepened_total` / `l3_topic_complaint_total` · `l3_guard_alert_total`（kind：`coref_fail_rate` / `rewrite_dogfood` / `topic_complaint` / `l2_stale`） |
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
- [ ] 指标是否含敏感标签？（当前为聚合 counter，**仍**勿对公网开放）  
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
