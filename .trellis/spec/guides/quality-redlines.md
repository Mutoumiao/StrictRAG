# 质量红线（RAG · 宁拒勿妄）

> **WHAT** 权威：`prds/08-quality/` · `prds/04-pipelines/`  
> **HOW**：本文件约束实现与评审时不可越过的底线。  
> 触及 ask / 检索 / 生成 / 验证时 **必读**。  
> 写/改对应测例：先读 [testing](./testing.md)，P0 证据表 `docs/testing/p0-redlines.md`。

---

## 四层控制（不可跳步）

```text
检索 → 约束生成 → 声明验证(verify) → 拒答或 answered
```

| 规则 | 含义 |
|------|------|
| **min 否决** | 不因「整体看起来还行」均值洗白；claim 级不达标 → 整答拒答 |
| **合法 draft 必 verify** | 禁止跳过 verify 直接 `answered` |
| **历史 ≠ evidence** | 会话历史不得当作 citation / min_support 对齐文本 |
| **门禁只加严不放宽** | 生产路径禁止用 flag 静默放宽 |
| **双就绪 ∧ active** | 文档/chunk 检索闸：索引就绪且状态 active |

---

## 实现禁忌清单

| 禁忌 | 正确做法 |
|------|----------|
| rerank 失败/跳过仍 `answered` | 拒答；reason 如 `rerank_unavailable`（ADR-030/034） |
| claim 拆分失败仍出答 | 拒答 `claim_split_failed`；禁止并入模糊 internal_guard |
| 非法 citation 剥光后仍 verify | `invalid_citations` finalize（见 PRD §3） |
| 在线路径字段级脱敏分裂原文 | 脱敏只在入库权威 body；单一真相 ADR-037 |
| 客户端传 `tauClaim` / `retrieveK` 等 | `options` **仅** stream / debug / mode / locale（`prds/05-api` §1.1） |
| 把 `scope` 塞进 `options` | **`scope` 为 ask 顶层可选字段**（如 `scope.docTypes`），与 options **分轨**（ADR-050）；混入 options → 400 |
| 教学 Notebook / LanceDB 数字当 SLA | 生产指标以验收剧本与门禁为准 |
| L1 `mode=mock` 的 2×2 / coverage 当业务签字 | 仅工程 seed；签字须 live + 规模门；HOW → [l1-eval](../api/backend/l1-eval.md) |
| `INGEST_SCAN_MODE=on` / mock 当生产杀毒完成 | QUAL-2 = **安全债**；`on` 未接引擎 **启动失败**；prod 禁 mock（X-01/X-02）；HOW → [worker quality](../worker/backend/quality-guidelines.md) |
| staging/prod 单节点 rerank 冒充双节点 | `RERANK_MIN_NODES` + fallback；全失败拒答；HOW → [model-gateway](../api/backend/model-gateway.md) §9 |
| 多策略 reindex 静默 default strategy | 须显式 `chunkStrategy` 或 400；HOW → [chunk-strategies](../api/backend/chunk-strategies.md) |

### ask 请求形状（摘要）

```text
{
  // ...
  options?: { stream?, debug?, mode?, locale? }   // 仅此四字段
  scope?: { docTypes?: string[] }                 // 顶层；不是 options
}
```

---

## Citation 铁律（摘要）

用户可见 `answered` 响应中，`citations[]` **只能**含本轮 evidence 内 id。  
全文 `INSUFFICIENT_EVIDENCE` → 不进 verify → `model_abstained`。  
细节与分档：`prds/08-quality/01-verification-and-abstention.md`。

---

## verify 触发细节（X-16 · 对照 `graph/run.ts`）

> 与 [ask-pipeline S2 图边表](../api/backend/ask-pipeline.md) 配套。改 judge / claim_split / 预算时 **必读**。

| 主题 | 规则 | Wrong | Correct |
|------|------|-------|---------|
| **合法 draft 必 verify** | generate 产出合法 draft+citations 后 **禁止**直接 `answered`；必须 claim_split → verify | `return finalize(verified)` 在 generate 后 | 走 claim_split → batch judge → 全过才 verified |
| **judge-only 不够** | 仅有 judge 分数、**无** claim 列表不得 verified | 跳过 claim_split 用全文当 1 claim | claim_split 产出结构化 claims；失败 → `claim_split_failed` |
| **批 judge** | S2：**一次** judge 调用对全部 claims 打分（+ 解析失败可再 1 次）；**禁止**无预算地 per-claim 无限 fan-out | 每 claim 单独 chat 且不 `tryChargeLlm` | `judgeUserPrompt(claims, evidence)` 批处理；重试仍计 LLM |
| **maxLLMCalls** | 任何 chat（generate / claim_split / judge / 重试）前 `tryChargeLlm`；不足 → `budget_exhausted` | 重试 judge 不计数 | `chargeAndChat` 统一计数；mode 表见 ask-pipeline |
| **空 claims** | `parseClaimSplitOutput` **拒**空数组（throw → `claim_split_failed`）；即使漏网，`allPass` 要求 `claims.length > 0` | 空 claims + mean 分数当 verified | 空 / 无合法 chunk → `claim_split_failed` 或 `unsupported_claims` |
| **min 否决** | `minSupport = min(scores)`；**每一** claim ≥ `tauClaim` 才 verified | `mean(scores) >= τ` 洗白 | `scores.every(s => s >= tauClaim)` |
| **τ 源** | 仅服务端 `TAU_CLAIM` / `input.tauClaim` | 客户端 `options.tauClaim` | contracts options **无**该字段 |
| **历史 ≠ evidence** | judge/generate 文本 **仅**本轮 `state.evidence` | 把 session 原文拼进 judge user | evidence_snapshot 与 retrieve 同源 |

### 负向断言（实现/评审最低集）

| ID | 断言 |
|----|------|
| V-neg-1 | generate 后 mock 直接 finalize verified → **禁止**（代码路径不存在） |
| V-neg-2 | claim_split 空 claims → **非** answered |
| V-neg-3 | 一 claim 低于 τ、其余满分 → `unsupported_claims` |
| V-neg-4 | 耗尽 maxLLMCalls 于 judge 重试前 → `budget_exhausted`，非 verified |
| V-neg-5 | P0 R9：未完整 verify 不得 answered（`docs/testing/p0-redlines.md`） |

证据：`apps/api/src/graph/graph.test.ts` · `run.ts` verify 段 · `parse.ts` empty claims throw。

---

## 与当前阶段关系

**S2 最小 ask 已落地**（线性图 + SSE + 会话壳；ES 默认 mock）。P2.5-RW 图边已落，`SESSION_REWRITE_ENABLED` **默认关**（dogfood 可开；**≠** L2 准出 / **≠** 对外连续追问）。  
Epic `08-05-phase-2-ask` 已关并归档；**≠** 路线图 Phase 2 全文。

本红线仍用于：

1. 评审后续 feature（B1/B8…、P2.5、P3a）是否放宽冻结语义  
2. 改 `graph/` · `retrieve/` · `routes/ask` 时的检查单（对照 [api ask-pipeline](../api/backend/ask-pipeline.md)）  
3. 禁止「为了 demo 先通」的临时绕过合入 main（含 rerank 静默降级、假 ES 当生产）  
4. 改 L1 矩阵 / 批跑时对照 [api l1-eval](../api/backend/l1-eval.md)（error 出格 · skipTrace · 禁 mock 签字）

**下一阶段禁止**：未 P2.5 二元出口进入 P3a CRAG；未 B8 专项宣称生产 ES；未 live 签字包宣称 L1 门禁完成。

---

## 评审检查句式

- 该改动是否让 **拒答变少** 却无对应 ADR？  
- evidence 文本在 generate 与 verify 是否 **同一切片**？  
- 失败路径是否有 **稳定 reason 码**（非吞掉异常）？  
- 是否误开 rewrite 或把历史当 evidence？  
- 是否触及 **P0 自动化红线表**（见下）却未更新/未绿测？

---

## P0 自动化红线（清单 · 思考触发）

> **WHAT 语义**仍以 `prds/08-quality` 为准。  
> **可勾选必绿表（工程）**：仓库 `docs/testing/p0-redlines.md`（R1–R10）。  
> 本地合并前门禁：`pnpm check-types` && `pnpm test`（远程 CI 非本期强制）。

开工/改 ask·检索·拒答·鉴权小模块前自问：

- [ ] 是否改了 R1–R10 任一锚点实现？→ 对应 `R#:` 测须仍绿  
- [ ] 检索闸改动是否只测了 `packages/db` 纯函数？→ **生产装载路径**（api `filterDocsForRetrieve` / corpus）是否仍被覆盖？  
- [ ] verify 路径是否只有 happy `llmCalls` 计数？→ 是否有 **负向**「未完整 verify 不得 answered」？  
- [ ] 跨层 final 形状是否双端各写一份 JSON？→ 应用 `@strict-rag/contracts/testing`  
- [ ] 是否误以为 R 表要求 stub `AUTH_ENFORCE`？→ **不要求**；QUAL-1 红线测已归档（`auth-enforce.redline.test.ts`），**禁止**改仓库默认 on  
- [ ] 是否把 `mapBizError` 字符串当 `shouldRefresh` 断言？→ admin 应直测 `ApiHttpError` 字段  
- [ ] 是否改 scan / 宣称杀毒完成？→ 读 DEC-SCAN；生产前 **新建** QUAL-2 实现 task  
- [ ] 是否改 complete/reindex 策略？→ 读 [chunk-strategies](../api/backend/chunk-strategies.md)

包级 HOW：web/admin [quality-guidelines](../web/frontend/quality-guidelines.md) · api [quality-guidelines](../api/backend/quality-guidelines.md) · contracts [directory-structure](../contracts/library/directory-structure.md)。
