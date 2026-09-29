# 工单 04 · `pnpm smoke:half` 端到端真跑（真栈证据 + 两处源码缺陷）

> 图：[`real-stack-evidence`](../map.md) · 工单：[`issues/04-task-half-smoke-real.md`](../issues/04-task-half-smoke-real.md)
> 前置：工单 02（五服务 healthy）· 工单 03（迁移 apply）

## 1. 第一次真跑：**在 approve 一步 403**

```text
> node scripts/smoke-half.mjs
HALF-SMOKE → http://127.0.0.1:4000
FAIL: approve: expected HTTP 200, got 403:
 {"ok":false,"error":{"code":"FORBIDDEN","message":"submitter cannot decide own ticket",
  "details":{"reason":"self_approve_forbidden"}},…}
```

**这是一处真缺陷：脚本与后来加严的闸不一致。**

- `scripts/smoke-half.mjs` 用**同一个 dev-login 主体**上传、complete、approve、scan；
- 而 `apps/api/src/routes/documents/index.ts:469-476`（approve）与 `:510-517`（reject）按 **ADR-048 #4 四眼**调 `evaluateSelfDecide`（`apps/api/src/gates/approval-scan.ts:22-32`）：actor 与提交人相同即 403 `self_approve_forbidden`。
- 四眼闸是 2026-08 之后落的（`.scratch/fill-must-haves/issues/86-no-self-approve-min.md`），脚本没跟着改 → **文档里的「可重复跑通」在源码现状下不成立**。

**修**（`scripts/smoke-half.mjs`，属收紧：不放松任何闸）：

1. 先**钉住自审被拒**——同一主体 approve 必须回 403，否则抛错；
2. 再以**另一个主体**（`half-smoke-reviewer@local.dev`，`roleTemplate: kb_admin`）approve + scan。

即脚本现在**同时**验证四眼闸与主链路。

## 2. 第二次真跑：**ingest 在 es_index 一步 `ES_RECONCILE_FAILED`**

```text
progress status=uploaded embed=false es=false
progress status=indexing_es embed=true es=false
progress status=failed embed=true es=false
FAIL: terminal failed ES_RECONCILE_FAILED
```

worker 原始日志（同一 job，首跑失败 → 2 秒后 BullMQ 重试 → 成功）：

```text
20:11:00.716 ingest job started stage=es_index jobId=5
20:11:02.105 ERROR ingest job failed
  err: Error: ingest retryable failure: ES_RECONCILE_FAILED
    at assertIngestBullOutcome (apps/worker/src/ingest/bull-outcome.ts:15)
20:11:04.175 ingest job started stage=es_index jobId=5     ← 重试
20:11:04.282 INFO dual-ready → status=ready lifecycle=draft
  ingestReport: { dualReady: true, reconcile: { ok: true, missingCount: 0, orphanCount: 0 } }
```

**这也是一处真缺陷，且只在真集群上现形。**

- 根因：`apps/worker/src/ingest/es-http.ts` 的 `bulkIndexSparse` 原先 `POST /_bulk` **不带 refresh**；ES 是近实时（默认 1s 刷新），紧随其后的 `listIndexedChunkIds`（`_search`）读不到刚写入的文档 → 返回 0 命中 → `reconcileIndexed` 判定 `missing` → `pipeline.ts` 把文档写成 **`status=failed` / `errorCode=ES_RECONCILE_FAILED`**。
- 影响不止是「慢」：文档**真的进入了 `failed` 终态**（对运营可见、对轮询可见、对上报可见），只是靠 BullMQ 的 retryable 重试才转回 `ready`。若重试次数用尽，正文会被判失败。
- mock ES 是进程内 set 比对，**永远不会暴露这个 bug** —— 这正是本图存在的理由。

**修**：`POST /_bulk?refresh=wait_for`（等待下一次刷新再返回），并在 `pipeline.ts` 的调用序列不变的前提下让「写后立刻读」成立。

**新增测例**：`apps/worker/tests/ingest/es-bulk-refresh-before-reconcile.test.ts`（已登记 `apps/worker/tests/index.md`）——钉住 bulk 请求必须带 `refresh=wait_for`，以及「bulk → 对账查询 → 一次判 ok」；若有人删掉该参数，测试即红。

## 3. 第三次真跑（修复后）：入库一次成功，ask 一步按既有口径拒答

```text
HALF-SMOKE → http://127.0.0.1:4000
progress status=uploaded embed=false es=false
progress status=indexing_es embed=true es=false
progress status=ready embed=true es=true          ← 无 failed 过渡、无重试
FAIL: ask has no citations: {"status":"abstained","answer":"","citations":[],
  "reason":"internal_guard","userMessage":"服务暂时无法完成可靠回答",…}
```

- **入库段（上传 → complete → 四眼审批 → scan → 双就绪 → `ready`）在真栈上跑通**，且四眼闸与 ES 写后读都被脚本覆盖；
- **ask 段的阻塞方不是环境偶发，是 Gateway 契约**（见下）。

## 4. ask 段的阻塞方：一份同时提供三条契约的 Gateway（**本票的边界结论**）

本机事实（两条独立证据）：

1. **源码**：缺 `GATEWAY_BASE_URL` → `resolve.ts:87-92` 判 `mode=mock` → mock chat 返回 `[mock:generate] …` **纯文本**（`mock-client.ts:57-60`）→ `run.ts:381-386` 解析失败 → `finalize(state,'internal_guard')` → `abstained`。仓库**不存在** mock-but-JSON 分支。
2. **真跑**：上面第三次跑的输出，`reason=internal_guard`，与源码推导逐位一致。

而要走 `GATEWAY_MODE=http`，api 的 http 客户端要求上游**同时**提供三条契约（`apps/api/src/services/gateway/http-client.ts`）：

| 用途 | 路径 | 请求体 | 响应体 |
|------|------|--------|--------|
| chat（generate / claim_split / judge / route / rewrite） | `POST {base}/chat/completions` | `{model, messages, temperature, max_tokens}` | `{choices:[{message:{content}}]}`，content 须是**严格 JSON 单行** |
| embed | `POST {base}/embeddings` | `{model, input}` | `{data:[{embedding, index}]}` |
| **rerank** | `POST {base}/rerank` | `{model, query, documents, top_n}` | `{results:[{index, relevance_score}]}` |

而 `runRetrieve` **无条件**调 rerank（`apps/api/src/services/retrieve/retrieve.ts:277-286`；失败即 `fail(mapGatewayFailureToAskReason(...))` → 拒答），所以三条缺一不可。

**本机实测补充**：本机 Ollama 装着 `quentinz/bge-large-zh-v1.5`（embedding）与 `dengcao/bge-reranker-v2-m3`（rerank 模型），**但没有对话模型**；且 Ollama 不暴露 `/rerank` 端点。故「把 Gateway 指向本机 Ollama」在本机**也不成立**（缺 chat 模型 + 缺 `/rerank` 契约）。本图尝试拉取一个小对话模型，在本机网络上未推进（4 分钟零字节增长），已终止。

## 5. 结论

| 段 | 真栈结果 |
|----|----------|
| 起栈 / healthy / 探活 | ✅ |
| 迁移 apply | ✅（工单 03） |
| 上传 → complete（真 RustFS） | ✅ |
| 四眼审批 → scan | ✅（修复脚本后） |
| parse → chunk → embed → **真 ES bulk** → 双就绪 `ready` | ✅（修复 bulk refresh 后；此前必现 `ES_RECONCILE_FAILED`） |
| ask 有引用 | ❌ **阻塞方 = 无可用 Gateway**（需 chat+embed+rerank 三契约）；本机与仓库 mock 都不满足 |

**两处源码改动都是收紧**：脚本多了「自审必须 403」的正向断言；bulk 多了 `refresh=wait_for`。**没有为任何记债项开口子**，`docs/ops/operable-stack.md` 顶部「非生产级」口径未动。
