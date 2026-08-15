# api · L3 多轮护栏打点（P2.5-L3）

> 路径：`apps/api/src/obs/metrics.ts` `recordL3Ask` · 接线 `services/ask/execute.ts`  
> 产品语义：`prds/08-quality/02-evaluation-and-gates.md` §0 L3 · `prds/10-delivery/02-ops-runbook.md` §2.5  
> 任务：`08-16-p25-l3-metrics-min`  
> **本窗状态**：三条 counter **已落**；**无** 自动熔断 / **无** 面板 / **≠** L2 准出。

---

## 双轨

| 轨 | 含义 | **禁止**宣称 |
|----|------|--------------|
| **打点** | `GET /metrics` 能读到三键；单测钉 true/false | 「L3 护栏已上」/「准出 PASS」 |
| **动作** | 超阈关默认 session / 收窄窗 | 本窗 **不接线**；人工看表决策 |

**Wrong**：计数升高 → 自动改 `SESSION_REWRITE_ENABLED` 或 `clipSessionWindow`。  
**Correct**：只 `metricInc`；默认仍关；准出 / 默认开另建。

---

## 1. 签名

```ts
recordL3Ask({ rewriteUsed, reason, hasSession }): void
```

| 计数名 | +1 条件 |
|--------|---------|
| `l3_rewrite_used_total` | `rewriteUsed === true` |
| `l3_coref_fail_total` | `reason === 'coref_unresolved'` |
| `l3_session_ask_total` | `hasSession === true`（请求带 `sessionId`，无论 rewrite 是否开） |

接线：`executeAsk` 在 `recordAskResult` **之后**调用。`skipTrace` 批跑也计（与 ask 结果同源）。  
**不**改 `recordAskResult` 签名。**不**新建 `obs/l3.ts`。**不**改 `graph/run.ts`。

---

## 2. 人工决策清单（运维 PRD §2.5 · 本窗不接线）

| 观察 | 人工动作（禁止代码自动做） |
|------|----------------------------|
| `l3_coref_fail` 占比高 | 考虑关默认 session / 收窄窗 |
| `l3_rewrite_used` 异常 | 核对 dogfood env，**禁止**合入默认 true |
| 仅有 `l3_session_ask` | 带会话问次；**不等于** rewrite 已开 |

---

## Don't

| 禁止 | 原因 |
|------|------|
| 根据计数自动改 env / 关会话 / 收窄窗 | 会冒充默认开/关策略 |
| 宣称 L2 准出 / 连续追问 / 全文 Phase 2.5 | 本窗 = 打点 |
| 给 `/metrics` 加鉴权或换 Prometheus | 骨架已否决 |
| 仓库默认 `SESSION_REWRITE_ENABLED=true` / `AUTH_ENFORCE=true` | phase-scaffold |

---

## 交叉引用

- Ask 图 / rewrite 默认关：[ask-pipeline](./ask-pipeline.md)  
- L2 分轨（打点 ≠ 准出）：[l2-eval](./l2-eval.md)  
- 指标名例：`docs/ops/rate-limit-and-metrics.md`  
- IS：`docs/module-status/api.md` · 调度 `08-06` **P2.5-L3=部分** · **P2.5-IDX 仍索引**
