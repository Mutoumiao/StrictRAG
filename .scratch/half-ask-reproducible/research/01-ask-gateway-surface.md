# 01 · 末步 ask 的失败形态与三契约可达面（真栈取证）

> wayfinder 图 `half-ask-reproducible` 工单 01 的研究文。
> **只读研究 + 真栈取证**；未改任何仓库源码 / 脚本 / 文档 / `.env`。本页任何数字都不是签字数字。
> 本页仅记录**现状事实**，不下裁定（裁留给工单 02）。

## 环境与口径

| 项 | 值 |
|---|---|
| 中间件 | compose 五服务已起（postgres / redis / elasticsearch 8.15.3 / mongo / rustfs，全 healthy） |
| PG 既有数据 | users=18 · knowledge_bases=15 · gold_questions=60 · eval_runs=4 · `ready∧active` documents=28（**未清库**） |
| api 起法 | `pnpm --dir '…\apps\api' start`（`tsx src/index.ts`，不经 turbo），进程级注入 operable env |
| worker 起法 | `pnpm --dir '…\apps\worker' start` |
| 注入档位 | `ELASTICSEARCH_URL` · `RETRIEVE_ES_MODE=http` · `INGEST_ES_MODE=http` · `INGEST_SCAN_MODE=mock_clean` · `INGEST_EMBED_MODE=mock` · `STORAGE_MODE=s3` + `S3_*` · `MONGODB_URL` · `AUTH_ENFORCE=false` · `DEPT_ACL_ENFORCE=false` · `SESSION_REWRITE_ENABLED=false` · `TAU_CLAIM=0.5` · `SUPER_ADMIN_*`；**不设** `GATEWAY_BASE_URL` / `GATEWAY_MODE` |
| 入口 | `pnpm smoke:half` = `node scripts/smoke-half.mjs`（`package.json:16`） |

api 启动日志（逐字，节选）：`api listening on http://127.0.0.1:4000 … gatewayConfigured: false`。
worker 启动日志（逐字，节选）：`scanMode: "mock_clean" esMode: "http" embedMode: "mock" storageMode: "s3" ocrEnabled: false`。
`GET /ready`（逐字）：`{"service":"api","ready":true,"checks":{"postgres":"up","redis":"up","elasticsearch":"up","gateway":"skipped","s3":"up","mongo":"up"}}`。

---

## 1. 失败的确切形态

### 1.1 `pnpm smoke:half` 完整输出（逐字）

```
> strict-rag@0.0.0 smoke:half D:\projects\ai-stared-project\StrictRAG
> node scripts/smoke-half.mjs

HALF-SMOKE → http://127.0.0.1:4000
progress status=uploaded embed=false es=false
progress status=ready embed=true es=true
FAIL: ask has no citations: {"ok":true,"data":{"requestId":"aa2eed66-cfbb-4f68-b3b7-64edc5abaa8a","status":"abstained","answer":"","citations":[],"reason":"internal_guard","userMessage":"服务暂时无法完成可靠回答。","suggestedActions":[{"type":"retry_later","label":"稍后重试"}],"latencyMs":60,"mode":"balanced","sessionId":null},"meta":{"requestId":"aa2eed66-cfbb-4f68-b3b7-64edc5abaa8a","timestamp":"2026-10-01 00:47:31"}}
 ELIFECYCLE  Command failed with exit code 1.
SMOKE_EXIT=1
```

**读数**：第 1–7 步全过（`status=ready embed=true es=true`），**只**末步（脚本注释记的「第 8 步」）失败。
- 失败断言点：`scripts/smoke-half.mjs:169-173` —— `assertOk('ask', …, {expectStatus:200})` 通过（HTTP **200**），随后 `if (!askHasCitations(ask.json)) throw new Error('ask has no citations: …')`。
- 判据：`scripts/smoke-ask.mjs:15-20` —— `askHasCitations` 要求 `ok===true ∧ data.status==='answered'` 且 `citations` 里至少一条带 `docId`；本例 `status='abstained'` / `citations=[]` → false。
- **退出码 = 1**；脚本不伪造绿（`scripts/smoke-half.mjs:10` 注释「无 api / 空引用时失败，不伪造绿」）。
- stdout **含**完整响应体 JSON（因此 `reason` 可见），但**不含**「缺 Gateway / 缺哪条契约」这类显式诊断 —— 只有 `reason=internal_guard` 这个码。

### 1.2 api 侧响应体（手工复现同一次 ask，带 `debug:true`）

沿用脚本这一跑留下的 KB（`01a0f336-cc38-77e0-9673-5fd5b2fe4762`，文档 `01a0f336-cc4d-7c1d-a4a4-d8a602c3d823` `status=ready lifecycle=active embed_ready=1 es_ready=1`），以 `half-smoke@local.dev`（super_admin）重发同一问题：

```json
{
  "ok": true,
  "data": {
    "requestId": "b325c0e8-b99a-434f-92dc-2f6bd855d779",
    "status": "abstained",
    "answer": "",
    "citations": [],
    "reason": "internal_guard",
    "userMessage": "服务暂时无法完成可靠回答。",
    "suggestedActions": [{ "type": "retry_later", "label": "稍后重试" }],
    "latencyMs": 52,
    "mode": "balanced",
    "sessionId": null,
    "debug": {
      "llmCalls": 1, "retrieveCalls": 1,
      "route_source": "rule_knowledge", "routeLabel": "single",
      "evidenceCount": 2,
      "rewriteUsed": false, "sessionDeepened": false,
      "documentBackref": false, "externalBackref": false,
      "backReference": "none", "sessionRewriteEnabledDefault": false
    }
  },
  "meta": { "requestId": "b325c0e8-b99a-434f-92dc-2f6bd855d779", "timestamp": "2026-10-01 00:47:40" }
}
```

**关键读数**：`evidenceCount=2`（检索**成功**拿到证据）、`retrieveCalls=1`、`llmCalls=1`（**恰好只发生 1 次 chat 调用**）。
`reason=internal_guard` 的呈现语由 `apps/api/src/graph/reasons.ts:98-103` 定义（`服务暂时无法完成可靠回答。` / `retry_later`）。
HTTP 码恒 **200**（业务态）：`AskResponseSchema` 里 `abstained` 与 `verified` 同为 200（`apps/api/src/routes/ask.ts:513-520` 的 `respondAsk`）。

### 1.3 `GET /ready` 的 `gateway` 项

值为 **`"skipped"`**（逐字见上）。实现：`apps/api/src/ready/checks.ts:99-100` —— `if (!env.GATEWAY_BASE_URL) return 'skipped'`。注意 `gateway` **不是**硬依赖：`runReadyChecks` 只把 `postgres`/`redis` 的 `down` 算失败（`checks.ts:132-135`），故 `gateway=skipped` 时 `/ready.ready` 仍为 `true`。

---

## 2. ask 图在两个档位实际发起的模型调用、解析点与降级

### 2.1 实际调用序列（`runAskGraph`，`apps/api/src/graph/run.ts:256`）

主路径：`(session_load→rewrite?) → route → retrieve → generate → claim_split → verify`（`run.ts:254-256` 注释）。默认 `SESSION_REWRITE_ENABLED=false`（`apps/api/src/env.ts:126-129`），且 `route` 是**纯规则**（`apps/api/src/graph/route-rules.ts:44`，`route_llm_skipped` 恒 true），故**默认一轮 ask 的 chat 调用恰好是 generate → claim_split → judge 三次**。

| 次序 | purpose | mock 档发起方 | http 档发起方 | 期望响应形状 | 解析点（`路径:行号`） | 解析失败降级 |
|---|---|---|---|---|---|---|
| 1 | `generate` | `mock-client.ts:44` → 返回第 2.2 节的纯文本 | `http-client.ts:90` → `POST {base}/chat/completions` | `{"answer":string,"citations":string[],"insufficient":bool}` | 解析 `run.ts:382` → `parseGenerateOutput` `parse.ts:21-28`（`extractJsonObject` `parse.ts:2-11`） | `catch` → `finalize(state,'internal_guard')`（`run.ts:385-386`） |
| 2 | `claim_split` | `mock-client.ts:44` | 同上 | `{"claims":[{"text":string,"chunkIds":string[]}]}`（≥1 条，每条 ≥1 个 citations∩evidence 内 chunkId） | `run.ts:461` → `parseClaimSplitOutput` `parse.ts:32-48` | `catch` → `finalize(state,'claim_split_failed')`（`run.ts:471-472`，见 `run.ts:169` 与 456-459 的专用分支） |
| 3 | `judge`（verify） | `mock-client.ts:44` | 同上 | `{"scores":number[]}`，`length === claims.length`，0~1 | `run.ts:507` → `parseJudgeScores` `parse.ts:50-60` | 先**再试 1 次** judge（`run.ts:509-536`，多带一行 `PREVIOUS_OUTPUT_INVALID…`）；仍失败 → `finalize(state,'unsupported_claims')`（`run.ts:534-535`） |
| — | `embed`（检索内） | `mock-client.ts:86-103`（`mockEmbedVector`，dim=cfg.embedDims=8） | `http-client.ts:164-195` → `POST {base}/embeddings` | `{"data":[{"embedding":number[],"index":number}]}`，条数 === 入参文本数 | `http-client.ts:185-193`；调用点 `retrieve.ts:174-176` | `GatewayError` → `mapGatewayFailureToAskReason(err,'embed')='low_retrieval'`（`errors.ts:63-65`；`retrieve.ts:184-188`） |
| — | `rerank`（检索内，**无条件**调） | `mock-client.ts:105-146`（token 重叠打分） | `http-client.ts:198-260` → `POST {base}/rerank`（body `{model,query,documents,top_n}`） | `{"results":[{"index":number,"relevance_score"?:number,"score"?:number}]}`，非空 | `http-client.ts:231-247`；调用点 `retrieve.ts:278-279` | `GatewayError` → `mapGatewayFailureToAskReason(...)='rerank_unavailable'`（`errors.ts:58-61`；`retrieve.ts:281-286`） |

`route` 与 `rewrite` 在默认档**不发起** LLM 调用（前者纯规则，后者默认关）。
http 档的 chat transport 解析点：`http-client.ts:121-126`（`data.choices?.[0]?.message?.content`）；空串 → `GatewayError('unavailable','chat: empty content')`（`http-client.ts:127-129`）。

### 2.2 「mock chat 不是 JSON」具体指哪一次、mock 返回什么

- **指 `generate` 这一次**（也是本跑实际唯一发生的 chat 调用）。
- mock 返回（`apps/api/src/services/gateway/mock-client.ts:55-63`）：

```ts
const lastUser = [...req.messages].reverse().find((m) => m.role === 'user');
const text = lastUser?.content?.trim()
  ? `[mock:${req.purpose}] ${lastUser.content.slice(0, 200)}`
  : `[mock:${req.purpose}] empty`;
```

即 `[mock:generate] QUESTION:\n检索闸对哪些文档生效？\n\nEVIDENCE:\n[0] chunkId=…`（截断 200 字）。该文本里**没有 `{`…`}`**，`extractJsonObject`（`parse.ts:2-11`）`indexOf('{') < 0` → `throw new Error('no json object')` → `run.ts:385-386` 落 `internal_guard`。**确定性**、与题面无关（`[mock:<purpose>] ` 前缀本身也不是 JSON）。
→ `claim_split` / `judge` 的 mock 同样非 JSON，但本跑**从未到达**（generate 已先失败）。

---

## 3. 检索侧两契约是否也缺

**结论：末步失败不是缺 embed / rerank —— 在默认 `INGEST_EMBED_MODE=mock` 下，二者无需任何上游；只缺 chat 三条 JSON。**

证据（源码 + 实测）：

1. **embed**：检索里 `deps.embed` 由 `createDefaultRetrieveDeps(gw)` 注入（`retrieve.ts:346`），即 `gateway.embed`。默认 Gateway 是 mock（`client.ts:36-38` `cfg.mode==='mock' → createMockGateway`；`resolve.ts:86-92` 无 baseUrl→mock），`mock-client.ts:86-103` 用 `mockEmbedVector`（dim=8）产出，**不发网络请求**。入库侧 `INGEST_EMBED_MODE=mock`（`apps/worker/src/env.ts:46`）也写 mock 向量（dims=8，`apps/worker/src/ingest/pipeline.ts:788-789,816`），与检索侧同维，`cosine`（`apps/api/src/services/retrieve/scoring.ts:2-17`）可比。
2. **rerank**：`runRetrieve` **无条件**调用 `deps.rerank(...)`（`retrieve.ts:278-279`），mock 档由 `mock-client.ts:105-146` 用 token 重叠打分返回，**不发网络请求**。
3. **实测反证**：手工 ask 的 `debug.evidenceCount=2`、`retrieveCalls=1` —— 说明 dense（quote embed）+ sparse（真 ES）+ rerank 三段都跑通并产出了证据；失败发生在其后的 generate。
4. **边界（未核实项）**：若**切到 `GATEWAY_MODE=http`**（或设 `GATEWAY_BASE_URL`）而入库向量仍 mock(8) 维，则 query embed 走上游、维数可能与库内不符 —— `cosine` 取 `Math.min(len)` 不抛错，只会得到无意义的相似度。本工单**未实测**该组合（本轮未设 base URL）。可核命令：起一个返回非 8 维向量的 HTTP 端点并设 `GATEWAY_BASE_URL`，再跑一次 `pnpm smoke:half`，观察 `evidenceCount` / `reason`。

---

## 4. 若走「路 A 建桩」：最小实现面与零改动接法

### 4.1 零生产代码改动是否可行：**可行**

`GATEWAY_BASE_URL` 非空且 `GATEWAY_MODE` 留空时，`resolve.ts:86-92` 的 `defaultMode` 返回 `'http'`；`createGateway` 走 `createHttpGateway`（`client.ts:36-38`），**api 侧零改动**。`buildGatewayConfig` 对 dev 的 rerank 节点下限是 1（`resolve.ts:94-96,110-124`），故只给一个 base URL 即可启动（不会撞 `RERANK_MIN_NODES` 抛错）。`/ready` 的 `gateway` 项会去 `GET {base}/v1/models` 探活（`ready/checks.ts:107`），但它是软依赖（`checks.ts:132-135`），桩不实现也不影响 `ready`。

### 4.2 桩必须覆盖的 purpose 与最小 JSON 形状（从解析点反推）

| purpose | 桩端点（api 侧） | 最小响应体 | 反推解析点 |
|---|---|---|---|
| `generate` | `POST {base}/chat/completions` | `{"choices":[{"message":{"content":"{\"answer\":\"…\",\"citations\":[\"<库内真实 chunkId>\"],\"insufficient\":false}"}}]}` | `http-client.ts:121-126` → `parse.ts:21-28`；citations 须 ⊂ evidence（`run.ts:397-405`） |
| `claim_split` | 同上（**靠 system prompt 区分**） | content = `{"claims":[{"text":"…","chunkIds":["<同上 chunkId>"]}]}` | `parse.ts:32-48`；chunkIds 须 ∈ evidence∩citations（`run.ts:463-470`） |
| `judge` | 同上 | content = `{"scores":[s,…]}`，长度 === claims 数，且每条 `≥ TAU_CLAIM`（默认 0.5） | `parse.ts:50-60`；min 否决 `run.ts:539-548` |
| `embed` | `POST {base}/embeddings` | `{"data":[{"embedding":[8 个数],"index":0},…]}`，条数 === 入参 texts 数 | `http-client.ts:185-193` |
| `rerank` | `POST {base}/rerank` | `{"results":[{"index":0,"relevance_score":1},…]}`，非空 | `http-client.ts:231-247` |

**关键约束**：
- **chat 三条必须靠 prompt 区分**：http 客户端**不发送** `purpose`（body 见 `http-client.ts:115-119`：仅 `model/messages/temperature/max_tokens`）。三个 system prompt 互不相同（`graph/prompts.ts:20-30` generate / `42-47` claim_split / `61-67` judge），桩只能按 `messages[0].content` 分支。
- **citations/chunkIds 必须取自真实 evidence**：generate 的引用不在 evidence 内 → `invalid_citations`（`run.ts:401-407`），claim 无合法 chunkId → `claim_split_failed`。
- **`generate` 必须返回可被 verify 通过的内容**：graph 强制「合法 draft 必 verify」（`run.ts:427` 注释），故 claim_split/judge 也**必须**给合规 JSON，桩不能只应付 generate。
- **URL 前缀不一致（实测发现，供桩设计注意）**：api 侧全部直挂 base（`{base}/chat/completions`、`{base}/embeddings`、`{base}/rerank`，见 `http-client.ts:108,179,222`）；worker 的 `contextualize`(http) 也是 `{base}/chat/completions`（`contextualize-http.ts:70`）；**但 worker 的 embed(http) 多一层 `/v1`**：`pipeline.ts:801` 传 `baseUrl = ${GATEWAY_BASE_URL}/v1`，`embed-http.ts:22` 再拼 `/embeddings` → 实际请求 `{base}/v1/embeddings`。若桩只服务 api 侧（`INGEST_EMBED_MODE=mock`），不受影响；若要让入库也走桩（对齐维数），桩需**同时**响应 `{base}/v1/embeddings` 与 `{base}/embeddings`。

### 4.3 爆炸面（`GATEWAY_MODE` / `GATEWAY_BASE_URL` 在测试里被断言的文件）

`grep -r` 结果（排除 `node_modules`）：**18 个测试文件，合计 104 个 `it()`**。

| 文件 | it 数 |
|---|---|
| `apps/api/tests/ask/gateway-chain-fail.test.ts` | 1 |
| `apps/api/tests/env/ready-soft-gateway.test.ts` | 1 |
| `apps/api/tests/eval/judge-auroc-source-gate.test.ts` | 17 |
| `apps/api/tests/gateway/generate-fallback.test.ts` | 13 |
| `apps/api/tests/gateway/resolve-mock.test.ts` | 17 |
| `apps/api/tests/kb/create-kb-with-models.test.ts` | 2 |
| `apps/api/tests/obs/metrics-fallback-wiring.test.ts` | 5 |
| `apps/worker/tests/ingest/context-mode-obey.test.ts` | 6 |
| `apps/worker/tests/ingest/contextualize-fallback-ready.test.ts` | 6 |
| `apps/worker/tests/ingest/contextualize-http.test.ts` | 7 |
| `apps/worker/tests/ingest/cross-doc-pending-review.test.ts` | 4 |
| `apps/worker/tests/ingest/cross-doc-skip-index.test.ts` | 4 |
| `apps/worker/tests/ingest/embed-http.test.ts` | 3 |
| `apps/worker/tests/ingest/header-too-short.test.ts` | 2 |
| `apps/worker/tests/ingest/mock-clean-stage-chain.test.ts` | 2 |
| `apps/worker/tests/ingest/ocr-gate.test.ts` | 7 |
| `apps/worker/tests/ingest/ocr-rerun.test.ts` | 5 |
| `apps/worker/tests/ingest/orphan-clean-on-failure.test.ts` | 2 |

（源码侧 81 处引用，含 `apps/api/src/services/gateway/{client,resolve}.ts`、`ready/checks.ts`、`apps/worker/src/{env,ingest/*}.ts`。）
**注**：这些测例都**自带 env**（显式设 `GATEWAY_MODE` / `GATEWAY_BASE_URL`），故只要**不改默认值**、桩只由显式 env 接入，现有测例**零波及**；爆炸面主要来自「若新增 `GATEWAY_MODE=stub` 档位」时 `resolve.ts:87-88` 的枚举与 `env.ts:40` 的 Zod 枚举需要扩档（会触碰上述文件）。

---

## 5. 路 B：可诊断落点 + 反方证据 + 已有的桩

### 5.1 「mock chat 非 JSON 是有意设计」的现有证据

| 证据 | 路径:行号 | 内容 |
|---|---|---|
| mock 构造性返回纯文本 | `apps/api/src/services/gateway/mock-client.ts:55-63` | 模板 `[mock:<purpose>] …`，**从不**产出 JSON |
| 解析层对非 JSON 抛错 | `apps/api/src/graph/parse.ts:2-11` | `extractJsonObject` 无 `{` → `throw 'no json object'` |
| 图对 generate 解析失败即拒答 | `apps/api/src/graph/run.ts:385-386` | → `internal_guard`（`宁拒勿妄`） |
| 脚本头注释 | `scripts/smoke-half.mjs:5` | 「live ask 须 Gateway 产出合法 JSON；默认 mock chat 不是 JSON → 空引用失败」 |
| 清单文档 | `docs/ops/half-smoke.md:13` | 「缺 `GATEWAY_BASE_URL` 时默认 mock chat **不是** JSON，ask 会拒答」 |
| 真栈记录（最完整） | `docs/ops/real-stack-evidence.md:59` | 「mock chat 返回纯文本 `[mock:generate] …`（不是 JSON）→ `internal_guard` → `abstained` …**这是既定口径，不是环境故障**」 |
| 模块状态 | `docs/module-status/README.md:81` | 末步「属**环境前置**，非源码缺陷；是否另建 dev-only 桩属产品决定，未做」 |

**未核实项**：**未找到**一条 PRD / ADR 明文写「mock chat 必须非 JSON」；现有证据是**构造实现 + 注释/文档叙述**（上表），不是冻结契约条文。可核命令：`rg -n "mock" prds/07-models/01-model-gateway.md`（该 PRD 只写「所有 chat/embed/rerank 仅 HTTP」，未定义 mock 输出形状）。

### 5.2 已有的桩 / fake gateway（避免重复造）

**结论：仓内没有可当「真 HTTP Gateway」用的现成 JSON 桩。**
- `apps/api/tests/{obs/metrics-fallback-wiring,gateway/*,ask/gateway-chain-fail}.test.ts` 里的 `fakeGateway(...)` 是**进程内 `GatewayClient` 替身**（如 `metrics-fallback-wiring.test.ts:35`），不是 HTTP 服务，无法被 `GATEWAY_BASE_URL` 指到。
- `createMockGateway`（`apps/api/src/services/gateway/mock-client.ts:41`）就是那个**非 JSON** 的 mock，**不是** JSON 桩。
- `createHttpGateway` 的测例用注入的 `fetchImpl` 内联夹具（`resolve-mock.test.ts:353`、`generate-fallback.test.ts:334`），也无独立进程。
- `scripts/` 下**无**任何 HTTP server（`rg -n "createServer|listen\(" scripts/*.mjs` → 无匹配）。

### 5.3 路 B 的可诊断落点（现状面）

| 落点 | 现状 | 缺口 |
|---|---|---|
| `scripts/smoke-half.mjs` 末步 | `:169-173` 只抛 `ask has no citations: <整段 JSON>`；`:178` 打印 PASS | 无「缺 Gateway / 缺哪条契约 / 是哪次调用跑不出 JSON」的显式分支 |
| `GET /ready` | `checks.ts:99-118` 已报 `gateway: up/down/skipped` | `skipped` 不区分「本机没配」与「末步将失败」；且非阻塞 ready |
| `docs/ops/half-smoke.md` | `:13` 一句话已写 mock chat 非 JSON | 未写「三条契约」清单与可核命令 |
| `docs/ops/operable-stack.md` | `:88-92` 指向 half-smoke | 未复述末步前置 |
| `docs/ops/real-stack-evidence.md` | `:49-60` 有最清楚的三契约表 | 是「真跑记录」页，非清单页，第三人未必先读到 |
| 模块状态 | `README.md:81` 已记环境前置 | `api.md:8` 只记 `GATEWAY_MODE` 默认 |

---

## 6. 第三人「拉起 → 末步失败」现在能读到的解释在哪

按一个外人实际会走的顺序：

1. `package.json:16` `pnpm smoke:half`（先跑，撞失败）。
2. 失败输出本身：`scripts/smoke-half.mjs:171` 的 `FAIL: ask has no citations: {…reason:"internal_guard"…}` —— **可看到 `reason`**，但不知道 `internal_guard` 何意。
3. `docs/ops/half-smoke.md:11-13` —— **第一处**书面解释（「live ask 须 Gateway 产出合法 generate/claim_split/judge JSON；缺 `GATEWAY_BASE_URL` 时 mock chat 不是 JSON」）。
4. `scripts/smoke-half.mjs:5` 头注释 —— 同义重述（读源码的人才看到）。
5. `docs/ops/real-stack-evidence.md:49-60` —— **最完整**的三契约表与「既定口径，不是环境故障」结论，但它挂在「真跑记录」页。
6. `docs/module-status/README.md:81` —— 记为「环境前置」。
7. `apps/api/src/graph/reasons.ts:98-103` —— `internal_guard` 的语义（读源码才见）。

**缺失**：
- `scripts/smoke-half.mjs` 的**运行时输出**不点破「缺 Gateway」（只有 JSON 里的 `reason` 码）；
- 没有一张「三条契约最小形状」放进**清单页**（`half-smoke.md`），它只能从 `real-stack-evidence.md §4` 或源码反推；
- `half-smoke.md` 未给「我怎么知道缺的是哪条」的可核命令（如 `GET /ready | jq .checks.gateway`）。

**附注（地图小误）**：`map.md` 与工单写「`apps/api/src/gateway/`」，实际目录是 `apps/api/src/services/gateway/`。

---

## 给裁定的事实面（不下裁定）

1. **失败是确定的、可复现的**：无 `GATEWAY_BASE_URL` 时 `pnpm smoke:half` 第 8 步必失败（本次 exit 1），api 返回 HTTP **200** + `status=abstained` + `reason=internal_guard` + `citations=[]`；`/ready` 里 `gateway=skipped` 但 `ready=true`（软依赖）。
2. **失败**只**缺 chat 三条 JSON**：`debug` 证明检索侧（embed + 真 ES sparse + rerank）在 mock 档已全通（`evidenceCount=2`），且 mock 档 embed/rerank 不发上游请求；generate 的 mock 文本天然非 JSON，是唯一失败点。
3. **默认档**下确定性的调用序列是 `generate → claim_split → judge`（route 纯规则、rewrite 默认关）；mock 档全部走 `mock-client` 的模板文本，http 档才走三端点。
4. **零生产代码改动的接法存在且清晰**：`GATEWAY_BASE_URL` 指向一台实现三端点（chat/embeddings/rerank）的桩即可；dev 的 rerank 下限为 1，不会撞启动闸。**但** chat 的 purpose 不随请求下发，桩必须按 system prompt 分支才能分别满足 generate/claim_split/judge 的解析器与 verify 门。
5. **反方面**：「mock chat 非 JSON」目前只有**实现 + 文档叙述**背书，**没有** PRD/ADR 明文；且仓内**没有**现成 HTTP JSON 桩可复用（现有 fake 都是进程内 `GatewayClient` 替身）。
6. **爆炸面**：18 个测试文件、104 个 `it()` 引用 `GATEWAY_MODE`/`GATEWAY_BASE_URL`；若只以显式 env 指向桩（不改默认、不新增档位），现有测例零波及。
7. **可诊断面的缺口**：失败原因散在 3+ 处、且 `smoke:half` 运行时输出不点破「缺 Gateway / 缺哪条契约 / 哪次调用」；清单页缺「三条契约最小形状 + 可核命令」。
8. **未核实项**：① 「GATEWAY_BASE_URL 指向非 8 维向量的桩 + 入库仍 mock(8)」时 `cosine` 的实际表现未实测；② 无 PRD/ADR 明文定义 mock 输出形状；③ worker embed(http) 请求 `{base}/v1/embeddings` 与 api 侧 `{base}/embeddings` 的**前缀不一致**未在真栈验证其影响（本轮 `INGEST_EMBED_MODE=mock`，未触发）。
