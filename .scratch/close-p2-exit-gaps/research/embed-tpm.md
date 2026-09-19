# 核定 embed TPM（R6）的口径 — 事实核查

> 工单：`issues/19-research-embed-tpm.md` · 类型：research · 只读核查
> 冲突裁决序：**源码 > `docs/module-status/` > 覆盖表 > task 叙事**；`prds/00–11` 为 What 契约。
> 文中所有断言均指到 `路径:行号`；搜不到的写「未找到 + 已搜关键词」。

## 已读文件清单

**PRD（What）**
- `D:\projects\ai-stared-project\StrictRAG\prds\10-delivery\03-acceptance-scenarios.md`（剧本 R）
- `D:\projects\ai-stared-project\StrictRAG\prds\07-models\01-model-gateway.md`（§7 三平面）
- `D:\projects\ai-stared-project\StrictRAG\prds\06-async\01-bullmq-jobs.md`（队列表）
- `D:\projects\ai-stared-project\StrictRAG\prds\04-pipelines\01-offline-ingest.md`
- `D:\projects\ai-stared-project\StrictRAG\prds\04-pipelines\02-online-ask-langgraph.md`
- `D:\projects\ai-stared-project\StrictRAG\prds\05-api\01-http-api-hono.md`（§5 限流）
- `D:\projects\ai-stared-project\StrictRAG\prds\08-quality\03-langfuse-observability.md`
- `D:\projects\ai-stared-project\StrictRAG\prds\10-delivery\02-ops-runbook.md`
- `D:\projects\ai-stared-project\StrictRAG\prds\11-decisions\00-adr-index.md`（ADR-044）
- `D:\projects\ai-stared-project\StrictRAG\prds\README.md`（0.4.18 变更行）

**源码（Is）**
- `D:\projects\ai-stared-project\StrictRAG\apps\worker\src\ingest\embed-http.ts`
- `D:\projects\ai-stared-project\StrictRAG\apps\worker\src\ingest\pipeline.ts`
- `D:\projects\ai-stared-project\StrictRAG\apps\worker\src\index.ts`
- `D:\projects\ai-stared-project\StrictRAG\apps\worker\src\env.ts`
- `D:\projects\ai-stared-project\StrictRAG\apps\api\src\obs\rate-limit.ts`
- `D:\projects\ai-stared-project\StrictRAG\apps\api\src\obs\plane-quota.ts`
- `D:\projects\ai-stared-project\StrictRAG\apps\api\src\obs\metrics.ts`
- `D:\projects\ai-stared-project\StrictRAG\apps\api\src\routes\documents\index.ts`
- `D:\projects\ai-stared-project\StrictRAG\apps\api\src\services\ingest-complete-pending.ts`

**镜像 / 文档（辅证）**
- `D:\projects\ai-stared-project\StrictRAG\docs\module-status\api.md`
- `D:\projects\ai-stared-project\StrictRAG\docs\module-status\worker.md`
- `D:\projects\ai-stared-project\StrictRAG\docs\testing\coverage\03-ops.md`
- `D:\projects\ai-stared-project\StrictRAG\docs\ops\rate-limit-and-metrics.md`
- `D:\projects\ai-stared-project\StrictRAG\.scratch\close-p2-exit-gaps\map.md`
- `D:\projects\ai-stared-project\StrictRAG\.scratch\close-p2-exit-gaps\issues\19-research-embed-tpm.md`

---

## 一、PRD 原文

### 1.1 R6 逐字原文

`prds/10-delivery/03-acceptance-scenarios.md:304`（表头在 `:299`，剧本标题在 `:295`，通过口径在 `:312`）：

```
| R6 ingest 触顶 | mock embed TPM 触顶 → 队列堆积 + 告警；文档 **非 ready** 直至清单全 embed；**无**半套 ready |
```

同行相邻上下文（`prds/10-delivery/03-acceptance-scenarios.md:303` / `:305`）：

```
| R5 三平面隔离 | 打满 **ingest** 配额 → ask 仍可达业务路径（仅受 ask 桶约束）；打满 ask **不**阻断 ingest 消费（可慢） |
| R7 L1 降级 | contextualize 429 耗尽 → L0 索引路径；`contextualize_l0_fallback`；ask 不受影响 |
```

签约口径（`prds/10-delivery/03-acceptance-scenarios.md:312`）：

```
**通过**：R1–R6、R8–R10 为 **P2 必签**；R7/R11/R12 在启用对应路径时签。
```

### 1.2 与 TPM / 配额 / 反压 / 半套 ready 相关的冻结语义行

**`prds/11-decisions/00-adr-index.md`（ADR-044，R6 的直接来源）**

- `:884`：`### ADR-044 · P2 无 maxEmbedCalls + ask/ingest/aux 三平面配额 + query embed 挂接 retrieve`
- `:889`：`1. **形态（A）**：`
- `:890`：`- P2 **不设** 图预算字段 maxEmbedCalls；embed **不计** maxLLMCalls。`
- `:891`：`- 全局限流按租户 **三平面** 分桶：ask / ingest / aux（数值可运维调；契约 P2 冻结）。`
- `:909`：`- **#3 ingest embed 触顶 = 反压；禁静默丢 chunk / 半套 ready**`
- `:910`：`- 触顶 → job 退避 + 队列堆积 + 告警（如 ingest_embed_backlog）；manifest 内 searchable chunk **全部** embed 成功才 ready。`
- `:917`：`- staging/prod：缺 plane 配额 → **warning + 安全默认**（不得裸奔无限流）；**非** fail closed……`
- `:926`：`4. **否决**：B P2 先上 maxEmbedCalls；C 全局单桶；purpose 冒充 plane；触顶半套 ready；embed 计入 maxLLM。`

**`prds/07-models/01-model-gateway.md`（三平面正典）**

- `:294`：`- 超**租户平面**配额：ask → 429/503 或强制 fast + **ask_quota_exhausted**（≠ budget_exhausted）；ingest → 反压排队（ADR-044）。`
- `:298`：`### 7.1 三平面配额（ADR-044 · 硬规则）`
- `:300`：`| 1 | **plane** | 租户互扰边界：ask | ingest | aux — **必须** per-tenant 分桶 |`
- `:301`：`| 2 | **purpose** | 平面内运营旋钮（generate/judge/embed/contextualize/rerank/…）— **不能替代** plane |`
- `:308`：`| ingest | contextualize、**入库** embed；BullMQ ingest.* 模型调用 | 退避 + 堆积告警；**禁**半套 ready；**不**砍 ask |`
- `:313`：`- 默认「全 purpose 共一个 TPM 数字」却文档称已隔离。`（禁止项）
- `:318`：`指标：gateway_calls_total{plane,purpose,tenant}、gateway_throttle_total{plane,…}、ingest_embed_backlog、ask_quota_exhausted_total。`
- `:178`：`- Token/费用按 tenant + purpose 打点`（仅定义打点维度，**未定义计数公式**）

**`prds/06-async/01-bullmq-jobs.md`（队列表）**

- `:16`：`| 队列（逻辑 stage） | 并发 | 任务 | 配额平面（ADR-044） |`
- `:18`：`| **ingest.scan** | 中（I/O） | **病毒扫描**（ADR-039）；仅 clean 才下游 | —（无模型 TPM） |`
- `:22`：`| ingest.contextualize | 模型 TPM 相关 | **可选独立**：L1 LLM prefix（也可并入 chunk） | **ingest** |`
- `:23`：`| ingest.embed | 低（TPM） | Embedding → pgvector（prefix+body）；消费 **冻结清单**；触顶 **反压不丢 chunk** | **ingest** |`
- `:72`：`| 顺序理由 | embed 为贵步骤（TPM）；**贵先跑 = 失败快**；全仓统一，禁止文档间混序 |`
- `:81`：`**纪律**：eval.online_sample 失败不得影响 ask；与 eval.run 隔离并发配额，避免 Judge TPM 互抢。`
- `:201`：`- ~~L1/TPM 全局限流 / embed 平面~~ → **ADR-044 已关**`

**`prds/04-pipelines/02-online-ask-langgraph.md`**

- `:227`：`### 6.1 租户配额平面（ADR-044 · 硬规则）`
- `:232`：`| ingest | 入库 L1 contextualize + 入库 embed 批等 | 队列反压/堆积告警；**不**自动暂停 ask；**禁**静默丢 chunk 仍 ready |`
- `:235`：`- **plane 是租户互扰边界**；**purpose 是平面内细分**——禁止仅用 purpose 配 TPM 却共一个全局桶冒充隔离。`
- `:306`：`| 配额平面 | query embed 消耗 **plane=ask** 的 embed/TPM 桶 | 把 query embed 打进 ingest 平面 |`

**`prds/04-pipelines/01-offline-ingest.md`**

- `:150`：`| **token 计数** | SSOT = Embedding tokenizer；近似须记 tokenCounter=approx |`（针对**分块**的 token 计数，非 TPM）
- `:298`：`- [ ] L1/入库 embed 归 **ingest** 平面；触顶反压不半套 ready（ADR-044 / 剧本 R）`
- `:306`：`- ~~L1 并发与 TPM 全局限流~~ → **ADR-044 已关**（ingest 平面；L1→L0；embed 触顶反压禁半套 ready）`

**`prds/08-quality/03-langfuse-observability.md`**

- `:127`：`| 睡眠/限流 | 独立 judge_aux TPM 桶；**禁止**与 verify judge 共用导致 ask 饿死 |`（aux 平面，与 R6 无直接关系）

**`prds/10-delivery/02-ops-runbook.md`**

- `:339`：`| **ingest_embed_backlog** | 入库 embed 反压堆积；查 ingest 平面 TPM / 上游 429 |`
- `:346`：`| ask | 租户 ask TPM/RPM；可临时强制 fast | 为保入库默认砍光 ask 无告警 |`
- `:347`：`| ingest | embed/contextualize 配额；扩容 worker；暂停**新上传**（产品决策） | 静默 skip chunk 强行 ready；自动杀 ask 流量 |`

**`prds/README.md`**

- `:206`：`- 2026-08-01 · **0.4.18** 预算/限流：P2 **无** maxEmbedCalls；embed 不计 maxLLM；query embed **仅** retrieve 内；三平面 **ask/ingest/aux**（plane≠purpose）；ingest 触顶反压禁半套 ready；……`

### 1.3 「embed TPM」是否有定义？——**未定义**

**结论：PRD 全仓把 `TPM` 只当作「平面配额的一类旋钮名」使用，从未给出计数口径（按调用次数 / 按 token 数 / 按文本长度 / 固定权重 / 不计数）。**

- `TPM` 在 `prds/` 共命中 **22 行**（见上），逐条看均为「某平面/某队列涉及 TPM」「避免 TPM 互抢」「TPM 触顶告警」这类**指代**，无一行是定义句或公式。
- PRD 里唯一与「token 计数」有关的**定义**是分块口径：`prds/04-pipelines/01-offline-ingest.md:150`「token 计数 SSOT = Embedding tokenizer；近似须记 `tokenCounter=approx`」，以及 `prds/12-delivery-guides/14-模块需求功能表.md:334` 的复述 —— 二者都**只约束分块元数据**，未约束 TPM 配额。
- PRD 对「配额/限流」的**可落地**规定是 **RPM 固定窗口**：`prds/05-api/01-http-api-hono.md:588`「所有维度未显式配置 env 时默认 **不启用（0=关）**」、`:592`「试点目标 30/min/user」、`:598`「超限：**429** + `RATE_LIMITED` + 建议 `Retry-After`」。**没有任何一行把「TPM」定义成可计算的量。**

> 即：`embed TPM` 属**只被提名、未被定义**的概念。R6 的 Then 里「TPM 触顶」在 mock 模式下**没有定义**。

---

## 二、现状 IS

### 2.1 worker 的 mock embed 路径

**入口函数** `apps/worker/src/ingest/embed-http.ts:3-5`：

```ts
export function mockEmbedVector(chunkId: string, dims: number): number[] {
  return Array.from({ length: dims }, (_, i) => ((chunkId.charCodeAt(i % chunkId.length) ?? 1) % 97) / 97);
}
```

（文件头 `:1` 注明「HALF-EMBED：http 模式走 OpenAI 兼容 /v1/embeddings。默认仍 mock。」）

**pipeline `embed` stage** `apps/worker/src/ingest/pipeline.ts`：

- `:38`：`import { embedTextsHttp, mockEmbedVector } from './embed-http.js';`
- `:685`：`case 'embed': {`（stage 起点）
- `:687-696`：`INGEST_EMBED_MODE === 'fail'` → 直接 `failed`（测试用失败注入）
- `:741`：`const dims = 8;`（mock 向量维度）
- `:744`：`let modelName = 'mock-embed';`
- `:745-768`：`INGEST_EMBED_MODE === 'http'` 分支才真调网关 `embedTextsHttp(...)`，失败 → `EMBED_FAILED`
- `:770`：`vectors = toEmbed.map((id) => mockEmbedVector(id, dims));`（**默认 mock 分支，不做任何网络调用**）
- `:771-786`：逐 chunk 写 `chunk_embeddings`（`model=mock-embed`，`dims=8`）
- `:788`：`await setDoc(data.docId, { indexVersion, embedReady: 1 });`
- `:799`：`return { next: enqueueNext(data, 'es_index', indexVersion) };`（串行，embed 成功才 es_index）
- `:805-810`：`// 硬约束：未 embed 不得 es / ready` → `if (doc.embedReady !== 1)` 则 `EMBED_NOT_READY` 失败（**R6「无半套 ready」的现有实现**）

**env** `apps/worker/src/env.ts:46`：`INGEST_EMBED_MODE: z.enum(['mock', 'fail', 'http']).default('mock')`；`:47` `GATEWAY_EMBED_MODEL` 默认 `text-embedding-3-small`。

### 2.2 worker 有无 token 计数 / 配额 / 反压？——**没有**

- 对 `apps/worker/src` 全量搜 `token|tpm|quota|backpressure|backlog|throttle|rate.?limit|配额|反压`（忽略大小写）共 **35 行命中**，逐条分类后**无一条与 embed TPM / 配额 / 反压有关**：
  - `apps/worker/src/ingest/doc-lock.ts:3,21,22,25,43,52,53,63,69,74,77,81,87,89,94,100,102,104,112` —— 是**分布式锁 token**（SET NX 的 value），非模型 token；
  - `apps/worker/src/ingest/mongo-body.ts:70,99` 与 `apps/worker/src/ingest/pipeline.ts:516,581,592` —— 是 chunk 的 `tokenCount = Math.ceil(body.length / 4)`（**分块元数据**，`Math.ceil(body.length / 4)` 在 `pipeline.ts:581` / `:592`），属分块口径，**不参与任何配额**；
  - `apps/worker/src/eval/*` 与 `apps/worker/src/env.ts:74,75` —— 是 `EVAL_INTERNAL_TOKEN`（HTTP 鉴权头），非模型 token。
- **worker 里没有任何计数器、限流器、退避触发点。**

**BullMQ 层** `apps/worker/src/index.ts`：

- `:74-81`：`ingestQueue = new Queue(...)`，`defaultJobOptions: { attempts: INGEST_JOB_DEFAULT_ATTEMPTS, backoff: { type: 'exponential', delay: INGEST_JOB_BACKOFF_MS }, removeOnComplete: 200, removeOnFail: 100 }` —— 有通用指数退避，但**无按 TPM 触发的退避**。
- `:86-103`：`ingestWorker = new Worker(...)`，未显式设 `concurrency`（走 BullMQ 默认）；`evalWorker` 在 `:125` 显式 `concurrency: 1`。
- **worker 无 HTTP / 无 metrics 出口**：`docs/module-status/worker.md:99` 与 `map.md:37`（`Not yet specified` 段）均记「worker metrics 出口：前图已裁定不开端口」。

### 2.3 api 侧现有平面配额现状

**限流核心** `apps/api/src/obs/rate-limit.ts`：

- `:1-9`：文件头「三平面配额：ask / ingest 独立固定窗口（每分钟）；aux 只留常量、不跑。`ASK_RATE_LIMIT_RPM` / `INGEST_RATE_LIMIT_RPM` = 0 关闭。单测可注入时钟与 store；进程内 Map，非集群。」`QUOTA_PLANES = ['ask','ingest','aux']`（`:6`）
- `:22`：`export const askRateLimitStore: RateLimitStore = new Map();`
- `:24`：`export const ingestRateLimitStore: RateLimitStore = new Map();`（与 ask 分实例）
- `:31-56`：`checkFixedWindowRateLimit(key, options)` —— 固定窗口（默认 `windowMs = 60_000`，`:40`），超限返回 `{ ok:false, remaining:0, retryAfterSec }`（`:51-53`）
- `:66-73`：键 `ask:${userId}:${kbId}` / `ingest:${tenantId}:${kbId}`

**缺配置安全默认** `apps/api/src/obs/plane-quota.ts`：

- `:10`（文件头非目标）：`非目标：集群配额、Redis 共享窗口、embed TPM（见 docs/ops/rate-limit-and-metrics.md 否决项）。`
- `:20`：`export const SAFE_DEFAULT_PLANE_RPM = 30;`
- `:31-40`：`resolvePlaneQuota(...)`（`>0` 原样；staging/production 的 `0` 回落安全默认并 `usedSafeDefault=true`；dev/test 的 `0` = 关闭）
- `:58`：`export const planeQuotas = planeQuotasFromEnv(env);`
- `:62-70`：`logPlaneQuotaGaps(...)` 只对回落安全默认的平面 `warn`，**非 fail closed**

**指标** `apps/api/src/obs/metrics.ts`：

- `:57-58`：`const ASK_PLANE: QuotaPlane = 'ask';` / `const INGEST_PLANE: QuotaPlane = 'ingest';`
- `:62-69`：`recordAskResult(...)` → `ask_total{status,reason,plane=ask}` / `ask_ok|ask_fail{reason,plane=ask}`
- `:144-151`：`recordLlmCall(purpose, ok, fallback)` → `llm_call_total{purpose,ok,fallback,plane=ask}`
- `:152-154`：`recordRerank(...)` → `rerank_total{ok,plane=ask,...}`
- `:180-182`：`recordRateLimited(scope, plane='ask')` → `ask_rate_limited_total{scope,plane}`
- `:184-186`：`recordIngestComplete(...)` → `ingest_complete_total{plane=ingest,result}`（**仅 complete 入队前限流**）

**路由接线** `apps/api/src/routes/documents/index.ts:84-95`：complete 入队前 `checkFixedWindowRateLimit(ingestRateLimitKey(tenantId, kbId), { limit: planeQuotas.ingest.rpm, store: ingestRateLimitStore })`；触顶响应见 `apps/api/src/services/ingest-complete-pending.ts:132,140,293,301`（`details.plane='ingest'`）。

**关键空白**：`plane=ingest` 在源码中**只**挂在 `ingest_complete_total`（complete 路由），**入库 embed 本身不打点**。覆盖表已如实登记 `docs/testing/coverage/03-ops.md:95`（R9 行）：「ask/llm/rerank 带 `plane=ask`；complete 成功或限流带 `plane=ingest`。**入库 embed 未打 `plane=ingest`；无 TPM。**」

### 2.4 关键标识符全仓命中

- `ingest_embed_backlog`：全仓（含 `prds/` 外）**0 命中**（已搜关键词：`ingest_embed_backlog`）。仅在 `prds/07-models/01-model-gateway.md:318`、`prds/10-delivery/02-ops-runbook.md:339`、ADR-044 `prds/11-decisions/00-adr-index.md:910` 作为**指标名**出现。
- `maxEmbedCalls`：源码 **0 命中**（已搜关键词：`maxEmbedCalls`）；仅 `docs/module-status/api.md:164`、`docs/testing/coverage/03-ops.md:83,90` 作为「无该字段」的记录出现。
- `plane='ingest'`：源码仅 `apps/api/src/obs/metrics.ts:59,186` 与 `apps/api/src/services/ingest-complete-pending.ts:132,140,293,301`；**无 embed 相关**。

### 2.5 镜像与覆盖表口径（辅证）

- `docs/module-status/api.md:164`：`| 三平面配额全文 | ask/ingest 进程内 RPM 分 store 已落（默认 0=关）；**无** embed TPM / maxEmbedCalls / staging fail-closed / aux 运行时 / Redis 集群 / L0 网关 |`
- `docs/module-status/worker.md:44`：`- **embed**：mock 伪向量 dims=8 · model=mock-embed；缺 embedding 行才补写（幂等 skip）`
- `docs/module-status/worker.md:99`：`| GATEWAY_* 死配置 | 易误读「已接网关 embed」 | pipeline 未用 |`
- `docs/ops/rate-limit-and-metrics.md:80`（明确否决表）：`| Redis 集群配额 / embed TPM / aux 运行时 | 本窗不做 |`
- `docs/ops/rate-limit-and-metrics.md:9`（非目标）：`……Redis 集群配额；aux 运行时平面`
- `docs/testing/coverage/03-ops.md:90`（R4 行）：`无 maxEmbedCalls 字段。`
- `docs/testing/coverage/03-ops.md:95`（**R6 行**）：`| R6 | mock embed TPM 触顶 → 队列堆积+告警；文档非 ready 直至清单全 embed；无半套 ready | P2必签 | 注入 | **缺实现** | worker | apps/worker/tests/ingest/embed-es-serial.test.ts（双就绪，非 TPM） | 无 ingest TPM/配额。 |`
- `apps/api/README.md:18` 指标清单亦**无** embed / TPM 相关项。

> 附注（路径勘误）：`issues/19-research-embed-tpm.md:13` 引用的 `apps/api/src/services/rate-limit.ts:21-25` **不存在**；实际文件为 `apps/api/src/obs/rate-limit.ts`（`apps/api/src/services/` 下无 `rate-limit.ts`）。核查以 `obs/rate-limit.ts` 为准。

---

## 三、关键判断

### 3.1 PRD 是否规定了 TPM 的计数口径？——**未定义**

分四问逐一回答（均基于 §1 原文）：

| 假设口径 | PRD 是否有原文授权 | 依据行 |
|----------|-------------------|--------|
| 按调用次数折算 | **无** | 无任何行把「1 次 embed 调用」定义成 N token；`prds/05-api/01-http-api-hono.md:571-598` 只定义 RPM 固定窗口 |
| 按文本长度估算 | **无** | `prds/04-pipelines/01-offline-ingest.md:150` 的 token 计数 SSOT 只约束**分块**；无一行说它可用于 TPM |
| 固定权重 | **无** | 全仓无该词（已搜关键词：`固定权重` / `折算`） |
| 只留结构不计数 | **隐含允许但未明写** | ADR-044 `:909-910` 只冻结「触顶 → job 退避 + 队列堆积 + 告警」「全部 embed 成功才 ready」，未冻结「如何计量触顶」 |

**判定：PRD 只冻结了 R6 的「行为」（反压、不丢 chunk、不半套 ready），未冻结「TPM 的计数口径」。** 在 `INGEST_EMBED_MODE=mock`（仓库默认，`apps/worker/src/env.ts:46`）下，`pipeline.ts:770` 走 `mockEmbedVector`，**不产生任何 token、不产生任何上游 429** —— 所以「TPM 触顶」的触发源在 mock 路径下**不存在**。

### 3.2 候选落法（最小、不发明语义）与「半接线 / 假指标」评估

**候选 A：按调用次数折算（每次 embed 调用 = 固定单位）**

- 做法：把 R6 的「TPM 触顶」直接复用既有 ingest 平面**固定窗口 RPM**（`apps/api/src/obs/rate-limit.ts:31-56`），即「TPM」≡「RPM」。
- 风险：**造出假指标**。指标/字段命名为 `TPM` 而量纲是「次/分」，与 `INGEST_RATE_LIMIT_RPM` 语义重复；PRD 未授权把「次」当「token」。若为了 R6 另起一个只在 mock 分支自检的计数器，则**无真实触发源 → 半接线**（本仓明确忌讳，见 `map.md:39-46` 的划出先例）。

**候选 B：按文本长度估算（`Math.ceil(body.length/4)` 或 tokenizer）**

- 做法：复用 `pipeline.ts:581,592` 已存在的 `Math.ceil(body.length / 4)`，在 embed 前累加成「估算 token」。
- 风险：**双重问题**。
  1. **发明口径**：PRD 无一行授权把分块估算搬去当 TPM（`prds/04-pipelines/01-offline-ingest.md:150` 仅约束分块元数据）。
  2. **假指标**：mock 无真实消耗，估算出的「token/min」会被下游读成真实成本/容量信号；与 PRD 07 `:313`「禁止默认共一个 TPM 数字却称已隔离」属同类「数字名不副实」。

**候选 C：只留结构不计数（embed 纳入 `plane=ingest` 打点 + 队列堆积告警，不产生 TPM 数字）**

- 做法：只补 R9 缺失的「入库 embed 打 `plane=ingest`」（`docs/testing/coverage/03-ops.md:95` 已登记缺失），并把「触顶」表达为队列堆积（`ingest_embed_backlog`）而非 token 数字。
- 风险：**半接线**。`ingest_embed_backlog` 需要一个**生产者**（读 BullMQ 队列深度），而：
  - worker **无 metrics 出口**（`map.md:37` 已裁定不开端口；`docs/module-status/worker.md:99`）；
  - api 侧 `/metrics` 是**进程内 counter 快照**（`docs/ops/rate-limit-and-metrics.md:96`），不含队列深度；
  - 全仓 `ingest_embed_backlog` 0 命中（§2.4）。
  - 若只写常量/文档而不接生产者，即为**无生产者的半接线**。

**综合**：三个候选里，A 与 B 都会产出「假指标」或「发明口径」，C 若不指名生产者会成为「半接线」。**没有一条能在不发明语义的前提下直接开工。**

### 3.3 已具备的部分（避免误判为全缺）

R6 的 Then 有两半：

- **已实现且可测**：「文档 **非 ready** 直至清单全 embed；**无**半套 ready」→ `apps/worker/src/ingest/pipeline.ts:805-810`（`embedReady !== 1` → `EMBED_NOT_READY`）、`:799`（embed 成功才 `es_index`）；证据 `apps/worker/tests/ingest/embed-es-serial.test.ts`（覆盖表 `:95` 记为「双就绪，非 TPM」）。
- **未实现**：「mock embed TPM 触顶 → 队列堆积 + 告警」→ 无计数口径、无 embed 打点、无 backlog 生产者、无告警。

---

## 四、建议

### 建议：**需先出决定**

**必须由人裁的那一点**：

> **R6 的「TPM」在 `INGEST_EMBED_MODE=mock`（仓库默认）下取什么口径？**
> 三选一：(a) 复用 ingest 平面 RPM 固定窗口，即「TPM ≡ 按调用次数」；(b) 按文本长度估算 token；(c) mock 下**不计数**，R6 只能以 `INGEST_EMBED_MODE=http` 路径签（真实 token 由上游 batch 返回）。
> 并附一问：`ingest_embed_backlog` 的**生产者**落在哪（worker 开 metrics 出口？还是 api 读 BullMQ 队列深度？）—— 现仓库 worker 无出口、api 无队列深度。

**理由**：

1. ADR-044（`prds/11-decisions/00-adr-index.md:889-917`）只冻了**行为**（触顶=反压、禁半套 ready），未冻**计数口径**；PRD 全仓 `TPM` 22 处**全是指代、无定义**（§1.3）。
2. mock embed **不经 Gateway、无真实 token**（`apps/worker/src/ingest/pipeline.ts:770`），今天**没有可挂的「触顶」生产者**；直接开工只能二选一：发明口径，或造一个名不副实的假指标 —— 两者都是本仓明文忌讳。
3. 既有可复用物是 **RPM 固定窗口**（`apps/api/src/obs/rate-limit.ts`）与 **安全默认**（`apps/api/src/obs/plane-quota.ts:20`），但把 RPM 贴 `TPM` 标签属口径偷换，须人事先认可。

**若人裁定 (a) 复用 ingest 平面 RPM（按调用次数），可直接开工的最小可测断言形状**（供决策后执行，不作为现在的开工承诺）：

1. 在 worker（或注入点）以 `limit=1` 对同一 `tenant+kb` 连续入队 2 个含多 chunk 的 embed job；
2. 断言第 2 个 job 走**退避重试**（不 `fail`、不丢 chunk），doc 保持非 ready（`status !== 'ready'` 且 `embedReady === 0`）；
3. 断言清单未全 embed 时**不进入** `es_index`（`apps/worker/src/ingest/pipeline.ts:805-810` 的 `EMBED_NOT_READY`）；
4. 断言 `metricsSnapshot()` 中出现**入库 embed 的 `plane=ingest` 计数**（当前缺，`docs/testing/coverage/03-ops.md:95`）。

（若人裁定 (c) mock 不计数，则 R6 的 mock 分支应显式划出，改以 `INGEST_EMBED_MODE=http` 为签约前提 —— 这是**决定**，不是实现细节。）

### 不建议：直接开工 / 划出范围 的取舍说明

- **不建议「可直接开工」**：会迫使实现者自选口径（A/B/C 任一）→ 或造假指标、或造半接线，均违反「不得发明 PRD 未定义的语义」与「禁止无生产者半接线」。
- **不建议「应划出范围」**：R6 是 `P2 必签`（`prds/10-delivery/03-acceptance-scenarios.md:312`），且其「非 ready / 无半套 ready」半**已有可挂对象**（`pipeline.ts:805-810`）；问题只在「概念未定义」，属**待裁**而非**无对象**，故优先 `需先出决定`。
