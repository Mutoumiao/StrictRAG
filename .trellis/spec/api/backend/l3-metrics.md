# api · L3 多轮护栏打点 + 告警（P2.5-L3 / P2.5-L3A）

> 路径：`apps/api/src/obs/metrics.ts` `recordL3Ask` · 接线 `services/ask/execute.ts`  
> 产品语义：`prds/08-quality/02-evaluation-and-gates.md` §0 L3 · `prds/10-delivery/02-ops-runbook.md` §2.5  
> 任务：`08-16-p25-l3-metrics-min` · `08-16-p25-l3-alert-min`  
> **本窗状态**：六条 counter **已落**；进程内护栏告警 **已落**（`l3_guard_alert_total` + Pino warn）；**无** 自动关默认 / **无** 收窄窗 / **无** 面板 / **≠** L2 准出。

---

## 双轨

| 轨 | 含义 | **禁止**宣称 |
|----|------|--------------|
| **打点 + 告警** | `GET /metrics` 能读到六键与 `l3_guard_alert_total{kind}`；超阈 / dogfood 开 env 时 Pino `warn`（每 kind 每进程一闩） | 「L3 护栏已上生产」/「准出 PASS」/「自动熔断已开」 |
| **自动关默认 / 收窄窗** | 超阈关 `SESSION_REWRITE_ENABLED` / 改 `clipSessionWindow` | **仍不接线**；人工看日志或 `/metrics` 再决策 |

**Wrong**：告警或计数升高 → 自动改 `SESSION_REWRITE_ENABLED` 或 `clipSessionWindow`。  
**Correct**：只 `metricInc` + `logger.warn`；默认仍关；准出 / 默认开另建。

---

## 1. 签名

```ts
recordL3Ask({ rewriteUsed, reason, hasSession, sessionDeepened?, documentBackref?, externalBackref?, rewriteEnvOn? }): void
```

| 计数名 | +1 条件 |
|--------|---------|
| `l3_rewrite_used_total` | `rewriteUsed === true` |
| `l3_coref_fail_total` | `reason === 'coref_unresolved'` |
| `l3_session_ask_total` | `hasSession === true`（请求带 `sessionId`，无论 rewrite 是否开） |
| `l3_session_deepened_total` | `sessionDeepened === true`（可选；缺省当 false） |
| `l3_document_backref_total` | `documentBackref === true`（可选；缺省当 false；**≠** 自动熔断） |
| `l3_external_backref_total` | `externalBackref === true`（可选；缺省当 false；**≠** 自动熔断） |

接线：`executeAsk` 在 `recordAskResult` **之后**调用，并传 `rewriteEnvOn: env.SESSION_REWRITE_ENABLED`。`skipTrace` 批跑也计（与 ask 结果同源）。  
`documentBackref` **由**图 retrieve 写入；`externalBackref` **由** `rawQuestion` 判定写入；`rewriteEnvOn` **由** `executeAsk` 传入；本文件打点 + 闩告警。**不**改 `recordAskResult` 签名。**不**新建 `obs/l3.ts`。**禁止**按计数或告警改 env / 窗。

---

## 1.1 护栏告警（P2.5-L3A · 进程寿命比）

> **ponytail**：进程寿命累计比，**不是**运维 PRD 的 1h 滑窗。要滑窗另开。`metricsReset` 必须清闩。

| kind | 条件 | 首次命中 |
|------|------|----------|
| `coref_fail_rate` | `l3_session_ask_total ≥ 20` 且 `l3_coref_fail_total / l3_session_ask_total ≥ 0.2` | `metricInc('l3_guard_alert_total', { kind })` + `logger.warn({ event: 'l3_guard', kind, sessionAsk, corefFail }, 'l3 guard alert')` |
| `rewrite_dogfood` | 入参 `rewriteEnvOn === true`（缺省当 false） | 同上；payload 可只带 `rewriteEnvOn` |

每种 kind **每进程只闩一次**。阈值常量：`L3_CORE_FAIL_RATE_MIN_SESSION` / `L3_CORE_FAIL_RATE_THRESHOLD`。

---

## 2. 人工决策清单（运维 PRD §2.5 · 自动关仍不接线）

| 观察 | 人工动作（禁止代码自动做） |
|------|----------------------------|
| `l3_guard_alert_total{kind=coref_fail_rate}` 或 `l3_coref_fail` 占比高 | 考虑关默认 session / 收窄窗 |
| `kind=rewrite_dogfood` 或 `l3_rewrite_used` 异常 | 核对 dogfood env，**禁止**合入默认 true |
| 仅有 `l3_session_ask` | 带会话问次；**不等于** rewrite 已开 |

---

## Don't

| 禁止 | 原因 |
|------|------|
| 根据计数或告警自动改 env / 关会话 / 收窄窗 | 会冒充默认开/关策略 |
| 宣称 L2 准出 / 连续追问 / 全文 Phase 2.5 / L3 护栏已上生产 | 本窗 = 打点 + 告警 |
| 给 `/metrics` 加鉴权或换 Prometheus | 骨架已否决 |
| 仓库默认 `SESSION_REWRITE_ENABLED=true` / `AUTH_ENFORCE=true` | phase-scaffold |

---

## 交叉引用

- Ask 图 / rewrite 默认关：[ask-pipeline](./ask-pipeline.md)  
- L2 分轨（打点 ≠ 准出）：[l2-eval](./l2-eval.md)  
- 指标名例：`docs/ops/rate-limit-and-metrics.md`  
- IS：`docs/module-status/api.md` · 调度 `08-06` **P2.5-L3=部分** · **P2.5-L3A=部分** · **P2.5-IDX 仍索引**
