# 调研：worker（`apps/worker`）metrics / 可观测性出口缺口

Type: research
Label: wayfinder:research
Status: open
Date: 2026-09-17
只读取证，未改动任何源码 / 配置 / 测试。

## 0. 结论先行

1. **api 的 metrics 是「进程内 Map 单例 + JSON 快照端点」，与 Hono app 无耦合，但物理上落在 `apps/api/src/` 内、不是共享包，worker 不能直接复用**（还会踩「禁止 import apps/api」）。
2. **worker 零 metrics 代码**（全包 grep `metric|prometheus|statsd` 零命中），进程形态是**常驻 Node 长进程 + 纯 BullMQ consumer，无任何 HTTP server**（连 `/health` 都没有）；已有观测出口只有 Pino、失败 Webhook、`ingest_jobs` 账本、`ingest_reports` 报告。
3. **PRD 侧没有任何一条要求 worker 暴露 metrics HTTP 端点**；冻结条款要求的是「指标不得缺失 + 实现可选 Prometheus/OTel」（`prds/10-delivery/02-ops-runbook.md` §2），点名 `/metrics` 的条款全部落在 **api** 章节。反过来，**功能表把「Worker 对外 HTTP」明确写进「禁止承担」列**。
4. **有一处真实缺口**：`prds/04-pipelines/01-offline-ingest.md` §5.2「指标（入库报告必出）」点名 `contextualize_l1_ok` / `contextualize_l0_fallback`，目前这两个名字**只在 Pino 日志里**，任何可查询面都读不到（`ingest_reports` 只落三态 `contextSource`）。这是「必须出」但「无出口」的口径差。
5. **推荐最小可行方案：B（不新增端口，先钉「日志字段是否算出口」的口径并把它做实）**；若裁定要真计数器且必须能 scrape，才走 A（worker 内网只读端口），且 A 必须先解「Worker 对外 HTTP」的冻结禁令口径 —— 这是**需要裁定的语义问题，不是工程问题**。

---

## 1. `apps/api/src/obs/metrics.ts` 现状（逐条可核对）

| 问题 | 结论 | 证据 |
|------|------|------|
| 导入依赖 | 只有 api 自己的 `logger` 与 `rate-limit` 的类型；**无 prom-client / OTel / prometheus 任何依赖** | `apps/api/src/obs/metrics.ts:6-7`：`import { logger } from '../logger.js';` / `import type { QuotaPlane } from './rate-limit.js';`；`apps/api/package.json:13-31` 依赖清单无 prom-client |
| 定位自述 | 自述为「骨架」而非生产导出 | `apps/api/src/obs/metrics.ts:1-4`：`/** 进程内指标骨架（P2 · #11）。非 Prometheus 全量；可 snapshot / 打日志聚合。完整直方图 → P4。 */` |
| 注册表组织 | **模块级 `Map<string, number>` 单例**；key = 指标名 + 排序后的 `k=v` 标签串 | `:13` `const counters = new Map<CounterKey, number>();`；`:30-36` `function key(name, labels)` → `` `${name}{${parts.join(',')}}` `` |
| 导出面 | `metricInc` / `metricGet` / `metricsSnapshot` / `metricsReset` + 各业务 `record*`；另有 L3 闩状态 `l3AlertLatched: Set` 与 `isL3RewriteFused()` | `:14` `const l3AlertLatched = new Set<L3GuardKind>();`；`:39 metricInc`、`:44 metricGet`、`:49 metricsSnapshot`、`:53 metricsReset`、`:63 recordAskResult`、`:80 recordL3Ask`、`:118 recordL3TopicComplaint`、`:129 evaluateL2Stale`、`:145 recordLlmCall`、`:153 recordRerank`、`:163 recordRerankNodeUsed`、`:176 recordRerankAttemptFail`、`:180 recordRateLimited`、`:184 recordIngestComplete`；汇总再导出 `apps/api/src/obs/index.ts:1-21` |
| `/metrics` HTTP 出口 | **有，但在 api**：`app.get('/metrics', (c) => c.json({ service: 'api', metrics: metricsSnapshot() }, 200))`；**JSON 信封，不是 Prometheus 文本**；无鉴权（审计中间件显式排除该路径） | `apps/api/src/app.ts:79-80`；`apps/api/src/middleware/admin-write-audit.ts:22`：`if (path === '/health' || path === '/ready' || path === '/metrics') return false;`；`docs/ops/rate-limit-and-metrics.md:85-94`（§3.1「现状（IS）」） |
| 是否与 Hono app 绑定 | **不绑定**。`app.ts` 只是调用 `metricsSnapshot()` 输出；计数在模块加载期就存在，任何同进程代码都能 `metricInc` | `apps/api/src/app.ts:20` `import { metricsSnapshot } from './obs/index.js';`；`:80` 仅做序列化 |
| 能否在 Node 进程间复用 | **不能**。① 模块级单例 = 进程内状态，worker 进程看不到；② 位于 app 内部而非 workspace 包（`apps/api/package.json` 无 `exports` 字段、包名 `@strict-rag/api` 未被他包依赖）；③ 且 `import type { QuotaPlane } from './rate-limit.js'` 与 `logger` 都是 api 私有 | 同上一行；依赖检查：`apps/worker/package.json:16-27` 依赖只有 `@strict-rag/contracts` / `@strict-rag/db`，**无** `@strict-rag/api` |
| 现有消费面 | 只被 api 内部 import：`graph/run.ts:43`、`services/retrieve/retrieve.ts:10`、`services/gateway/{http-client,mock-client}.ts:1`、测试 | 上列各行 |

---

## 2. `apps/worker` 现状

### 2.1 有没有 metrics 代码

**没有。** 对 `apps/worker`（排除 `node_modules`）case-insensitive grep `metric|prometheus|statsd` → **零命中**（含测试、含 env）。

唯一与「计数」沾边的是日志字段：`apps/worker/src/ingest/pipeline.ts:601-612`

```ts
const contextSource: ContextSource =
  l1 && l1Ok > 0 && l1Fallback === 0 ? 'l1_llm' : resolveContextSource(contextMode);
log.info(
  { event: 'contextualize_summary', docId: doc.id,
    contextualize_l1_ok: l1Ok, contextualize_l0_fallback: l1Fallback, contextSource },
  'contextualize summary',
);
```

### 2.2 进程形态

- **常驻长进程**：入口 `void main()`（`apps/worker/src/index.ts:195`），`main()` 起三个 BullMQ `Worker`（probe `:60`、ingest `:84`、eval `:113`）、一个 `Queue`（`:75`），随后打 `'worker running'`（`:160-170`），并挂信号退出（`:192-193`）。脚本：`"start": "tsx src/index.ts"`、`"dev": "tsx watch src/index.ts"`（`apps/worker/package.json:7-11`）。
- **不是短任务**：`scripts/up-stack.mjs:19-21` 把 api + worker 作为两个长跑子进程一起拉起（`appFilters() = ['@strict-rag/api','@strict-rag/worker']`），任一非零退出即判失败（`:56-58, :90-93`）。
- **无任何 HTTP server**：`index.ts` 只 import `bullmq` / `ioredis`；依赖清单无 `hono` / `@hono/node-server`（对比 `apps/api/package.json:24` 有 `"@hono/node-server": "catalog:"`）。
- **有出站 HTTP，但都是客户端**：`ingest/contextualize-http.ts`、`ingest/embed-http.ts`、`ingest/es-http.ts`、`eval/execute-ask-http.ts`。

### 2.3 健康检查

- **只有启动前的 Redis 探活**：`assertRedisReachable(url)` → `PING` 非 `PONG` 则 `logger.fatal` + `process.exit(1)`（`apps/worker/src/index.ts:35-53`）。
- `WORKER_PROBE_ON_START`（默认 true）**不是 HTTP 探针**，而是往 `sr-probe` 队列投一个 `noop` job（`apps/worker/src/env.ts:27-30`；`index.ts:137-149`）。
- **无 `/health`、无 `/ready`、无 listening socket**；`docs/module-status/worker.md:6` 表格行：`| 端口 | 无 HTTP 端口 |`。

### 2.4 worker 已有的观测出口（无 metrics 位）

| 出口 | 形态 | 证据 |
|------|------|------|
| Pino 结构化日志 | `base: { service: 'worker', env }`；开发态 pino-pretty | `apps/worker/src/logger.ts:5-13` |
| 失败 Webhook | `INGEST_FAILURE_WEBHOOK_URL` 空=不发；仅 `recordStageEnd` 见 `errorCode` 时 POST 一次，失败 warn 不阻断 | `apps/worker/src/ingest/failure-webhook.ts` · `ingest/job-ledger.ts:124-144`；`docs/module-status/worker.md:60` |
| `ingest_jobs` 阶段账本 | 每 stage 先 insert `running`、结束 update `succeeded`/`failed`（写失败仅 warn） | `apps/worker/src/ingest/job-ledger.ts:85-99, :102-121` |
| `ingest_reports` 入库报告 | 按 `docId+indexVersion` 落可查询行，含 `contextSource` / `dedupeCrossDocRate` / 冲突对 | `docs/module-status/worker.md:61`；`packages/db/src/schema/kb/ingest-reports.ts:32` `contextSource: text('context_source')` |
| Langfuse | **无**。worker 无 langfuse 依赖、无 tracer；api 侧才有时 `obs/ask-tracer.ts` | `apps/worker/package.json:16-27`；`prds/08-quality/03-langfuse-observability.md:68`（worker-eval 写 dataset run 仍属规划） |

---

## 3. PRD 侧冻结条款（原文 + 小节号）

### 3.1 `prds/06-async/01-bullmq-jobs.md` §6 可观测（第 169-174 行）

> ## 6. 可观测
>
> - Bull Board 内网
> - 失败 job 保留原因
> - 与 Langfuse：eval job 写 dataset run id
> - 入库阶段边界可在 Bull Board / `ingest_jobs` 看见：`scanning` → `parsing` → … → `embedding` → `indexing_es` → `ready`

→ **没有**要求 worker 暴露 metrics 端点；点名的观测载体是 Bull Board + `ingest_jobs`。
同文件另有指标名点名（`§1.1` 表内「指标」行）：`scan_clean_total` / `scan_infected_total` / `scan_error_total` / `scan_timeout_total`（第 49 行）、`parse_no_text_layer` / `needs_ocr_count` / `ocr_fail` / `ocr_low_confidence`（第 60 行）、`orphan_cleaned_count`（第 150 行）——**只点名语义，未指定出口进程**。

### 3.2 `prds/08-quality/03-langfuse-observability.md` §1 分层（第 12-19 行）

> | 层级 | 工具 | 用途 |
> | 基建 | Pino、Bull Board、Sentry、**HTTP/LLM 指标导出** | 存活、队列、5xx、延迟 SLO |
> | **LLM/RAG** | **Langfuse** | trace、generation、score、dataset、在线抽样 |
>
> 二者互补，不互相替代。详见运维 PRD「双轨监控」。

同文件第 162 行：`系统 SLO ← 指标导出 / 运维看板（非 Langfuse 独占）`。
→ 基建层「指标导出」是**层级归属**，**未指定由哪个进程导出**，也没说必须 HTTP。

### 3.3 `prds/10-delivery/02-ops-runbook.md` §2（第 29-32 行）—— 判据所在

> ## 2. 最小指标契约（Phase 2 起建议具备导出）
>
> > 实现可选 Prometheus 文本格式或 OpenTelemetry；**名称可映射**，语义须覆盖下表。
> > 开发 compose **可选**挂 Prometheus/Grafana；生产可用公司统一观测平台，但指标不得缺失。

§2.3 依赖与队列（第 67-74 行）：

> | `queue_depth` | 按 BullMQ 队列名 |
> | `ingest_job_total` | status=completed\|failed |
> | `es_cluster_health` 代理或外部抓取 | 红立即告警 |

→ 措辞是「**建议具备导出**」「实现**可选**」，唯一硬话是「**指标不得缺失**」（语义层）。反过来说：**没有条款把「worker 暴露 HTTP 端点」写成必须具备**；`queue_depth` / `ingest_job_total` 由 api 侧 BullMQ Queue 读或 Bull Board 读也能覆盖语义。

### 3.4 与 worker 出口直接冲突的冻结点

- `prds/12-delivery-guides/14-模块需求功能表.md:34`（§1 选型表「异步」行，**禁止**列）：`Worker 对外 HTTP；未审批就 scan`
- 同文件 `:206`（模块责任表 `worker` 行，**禁止承担**列）：`对外 HTTP；未审批就 scan`
- `prds/01-architecture/01-system-overview.md:17`：`观测两分：基建（Pino/Sentry）vs LLM（Langfuse）`（未给 worker 出口）
- `prds/02-engineering/01-clhoria-template-alignment.md:64`：`| Bull Board | 内网 only | 挂 api 或独立 |` → 队列观测面**允许挂在 api**，不必在 worker 内
- 同文件 `:66`：`| Pino / 限流 / Vitest | api + worker | 基建 |` → worker 的基建观测义务只列到 Pino

### 3.5 `/metrics` 条款的归属（**全部在 api 章节**）

- `prds/12-delivery-guides/14-模块需求功能表.md:352`（§5 api 必须具备 横切表）：`| 健康检查 | /health 存活；/health/ready 依赖就绪；/metrics 禁止公网裸奔 | P0 / P2 |`
- `prds/05-api/01-http-api-hono.md:613`：`| GET /metrics（可选） | **必须内网或鉴权** | Prometheus 文本；**禁止**公网裸奔 |`
- `prds/10-delivery/03-acceptance-scenarios.md:556`：`| I1 | 未鉴权访问 /metrics（若启用） | **拒绝**…`——「**若启用**」= 非必达
- `prds/11-decisions/00-adr-index.md:193`（ADR：观测两套必备）：`生产必须同时具备 质量/行为…与 可靠性/成本…两套可观测；指标语义见运维 PRD，**实现可选 Prometheus/OTel**`；`:1229`：`GET /metrics 等导出端点：内网或鉴权；不得公网裸奔`
- `prds/10-delivery/01-phased-roadmap.md:223`（P4 项）：`最小指标导出完善；质量/延迟看板分离`；`:237`（P5 非目标/延后）：`…Prometheus/Grafana 或公司观测对齐`

### 3.6 唯一一条与 worker 计数器直接相关的「必出」条款

`prds/04-pipelines/01-offline-ingest.md` §5.2（第 245-250 行）：

> ### 5.2 指标（入库报告必出）
> - `dedupe_doc_internal_dropped`
> - `dedupe_cross_doc_dropped`
> - `dedupe_cross_doc_rate`
> - `contextualize_l1_ok` / `contextualize_l0_fallback`

§9.1（第 312-313 行）：

> | 平面 | `contextualize` + 入库 `embed` ∈ **`plane=ingest`**（per-tenant） |
> | L1 触顶/失败 | **L0 回退**；块仍可索引；指标 `contextualize_l0_fallback` |

→ 这是**「必须出」的硬话**，且落点是「**入库报告**」。当前状态：`dedupe_*` 三项已落库（`ingest_reports`），`contextualize_*` 两项**只落 Pino 日志**，入库报告只落三态 `contextSource`。**这是本主题唯一有 PRD 依据的缺口**。

---

## 4. 功能表 `prds/12-delivery-guides/14-模块需求功能表.md` worker 行原文

### 4.1 模块责任表（第 200-212 行）worker 整行照抄

表头（`:200-201`）：

> | 模块 | 最终必须承担 | 禁止承担 |
> |------|--------------|----------|

worker 行（**:206**，整行）：

> | **worker** | 异步入库状态机 + 评测跑批/抽样 | 对外 HTTP；未审批就 scan |

### 4.2 §1 选型表「异步」行（**:34**，整行）

> | 异步 | **BullMQ 5.x** + **Redis 7**（ioredis）→ `apps/worker` | 入库状态机 + 评测跑批 / 抽样；Bull Board 仅内网 | Worker 对外 HTTP；未审批就 scan |

### 4.3 §6「worker 必须具备」（**:453** 起）——**整节没有一行是 metrics**

节标题 `:453`：`## 6. worker 必须具备`；引导句 `:455`：`在线问答走同步/流式；入库与评测走异步。逻辑 stage 名如下；物理队列 interim = sr-ingest + stage（拆多物理队列须新 ADR）。`
表列为「逻辑 stage / 队列 | 必须做什么 | 硬闸 | 入场」，共 11 行（`:458-470`）：`ingest.scan` / `ingest.parse` / `ingest.ocr` / `ingest.chunk` / `ingest.contextualize` / `ingest.embed` / `ingest.es_index` / activate / `ingest.maintenance` / `eval.run` / `eval.online_sample`。

其中与 metrics 最近的一行（`:463`，整行）：

> | `ingest.contextualize` | 可选 L1 LLM 前缀 | 失败/触顶 **回退 L0**，块仍可索引；禁止 skip chunk 仍 ready；关 L1 须 `contextMode=l0_template` | P1 |

**判定：功能表 `§6 worker 必须具备` 的 11 行里，没有任何一行出现 metrics / 指标 / `/metrics` / 观测 / 导出。** 与 metrics 相关的必须具备只出现在 **api 章节**（`:352`，见 3.5）与 **prds/04 §5.2**（见 3.6）。

---

## 5. `.trellis/spec/` 既有约定（原文）

### 5.1 `.trellis/spec/worker/backend/`

- `index.md:3`：`> 路径：apps/worker · **无 HTTP 端口**`
- `index.md:13`（Pre-Development Checklist）：`- [ ] 是否避免在 worker 实现 HTTP API？`
- `index.md:25`（Quality Check）：`- [ ] 失败任务可观测；retryable 与 [ingest-idempotency §4](./ingest-idempotency.md) 方向一致`
- `directory-structure.md:13`：`index.ts # BullMQ workers · 优雅退出 · 无 HTTP`
- `quality-guidelines.md:107-109`（§日志）：

  > ## 日志
  >
  > 与 api 相同：Pino；上下文带 `jobId`、`tenantId`、`kbId`、`documentId` 等。**禁止**把对象全文/密钥打进日志。

→ worker 侧 spec **零 metrics 约定**，唯一的观测约定就是「Pino + 失败任务可观测」，且两条 HOW 明写「无 HTTP 端口 / 避免在 worker 实现 HTTP API」。

### 5.2 `.trellis/spec/api/backend/`

- `directory-structure.md:76`：`obs/ # metrics（plane=ask/ingest）· rate-limit（ask/ingest 分 store；aux 常量）· memory/ask tracer`
- `directory-structure.md:111`：`前缀：/api/v1；鉴权：/api/v1/auth/*；指标：GET /metrics（骨架无鉴权）。`
- `ask-pipeline.md:51`：`| GET | /metrics | 无鉴权（骨架） | 生产须网关/网络保护；策略 SSOT → docs/ops/rate-limit-and-metrics.md（ARCH-P2-4） |`
- `l3-metrics.md:3`：`> 路径：apps/api/src/obs/metrics.ts recordL3Ask · …`
- `l3-metrics.md:19`（熔断口径）：`**Correct**：只改本进程 executeAsk 的 rewriteEnabled；env / 库默认不动；metricsReset 清闩即恢复。` → **明写「本进程」**，即计数器是进程内语义
- `l3-metrics.md:142`（反模式表）：`| 给 /metrics 加鉴权或换 Prometheus / Grafana 面板 | 骨架已否决；面板属 P4 |`
- `.trellis/spec/guides/testing.md:191`：`| obs/ | 指标、限流、三平面配额、审计日志 |`（指 api 测试目录）

→ api 侧 spec 把 metrics 完全框在 `apps/api/src/obs/`，并把「换 Prometheus / Grafana 面板」列为**已否决**（骨架口径）。

---

## 6. `docs/module-status/` 原文

### 6.1 `docs/module-status/worker.md`

- `:6`：`| 端口 | 无 HTTP 端口 |`
- `:22`：`- Worker 进程入口：仅 BullMQ consumer + 信号退出（**无**业务 HTTP / listen）`
- `:43` 内（chunk 行，节选原文）：

  > …并打 `event=contextualize_summary` 的 `contextualize_l1_ok` / `contextualize_l0_fallback` 计数（**注**：worker 无 metrics 出口，这两个名字只作日志字段，≠ `/metrics` 计数器）。

- `:52`（评测消费者「未做/禁止」）：`- **禁止** import apps/api；**禁止** mock 覆盖率当签字 PASS；…`
- `:79`（明确未做 / 边界表）：`| HTTP API | **禁止**业务 HTTP |`
- `:87`（明确未做 / 边界表）：`| 真 L1 contextualize | **已落但默认关**：…worker **无** metrics 出口（`contextualize_*` 只作日志字段） |`

### 6.2 `docs/module-status/api.md`

- `:23`：`- 健康检查 /health、就绪检查 /ready（…）、/metrics 指标骨架`
- `:115`（已具备）：`- 观测骨架：进程内 metrics、内存 tracer、**三平面配额最小闭环**（…）、…、/metrics 端点**无鉴权**（生产保护策略见 docs/ops/rate-limit-and-metrics.md · ARCH-P2-4；**≠** 把进程内全局限流当生产方案 / **≠** Redis 集群配额 / **≠** embed TPM / **≠** P4 直方图与远端导出）`
- `:187`（债表）：`| 观测未接真实 Langfuse | 指标只有可演示级别 | LANGFUSE_ENABLED 默认 false |`
- `:188`（债表）：`| /metrics 无鉴权 | 生产环境需要网关层保护 | 代码注释已标明；contracts 中没有对应的线型定义 |`
- `:227`（证据）：`| 观测 | apps/api/src/obs/ · obs/metrics.ts isL3RewriteFused · obs/rate-limit.ts 分平面 store · tests/obs/… |`

→ `docs/module-status/api.md` **没有一处**把 worker 列为观测出口；worker 侧两处明写「无 metrics 出口」。

---

## 7. 仓库现有可复用件清单（若要落真计数器）

| 候选 | 可复用？ | 证据 / 理由 |
|------|----------|-------------|
| `apps/api/src/obs/metrics.ts` | **否（直接）** | 位于 app 内、非 workspace 包导出面；`import { logger } from '../logger.js'`（`:6`）绑 api logger；worker 侧明令 `禁止 import apps/api`（`docs/module-status/worker.md:52`） |
| `packages/contracts` | **不合适承载 runtime 计数器** | 定位是「业务错误码短名、`ApiResponse` 信封、按域 Zod」（`prds/12-delivery-guides/14-模块需求功能表.md:480`）；contracts 目录里唯一的 metrics 命中是仪表盘 DTO 测试（`packages/contracts/tests/system/dashboard-contract.test.ts:16`），无任何 runtime 状态 |
| `packages/db` | 仅可承载「落库字段」 | 已有 `ingest_reports.context_source`（`packages/db/src/schema/kb/ingest-reports.ts:32`）与 `ingest_jobs` 账本表可扩列，但那是**持久化**而非计数器 |
| `packages/admin-catalog` / `ui` / eslint-config / typescript-config | 无关 | 职责见 `packages/*/src` |
| 现成的共享 obs / metrics 包 | **不存在** | `packages/` 目录仅 6 个包（admin-catalog / contracts / db / eslint-config / typescript-config / ui） |
| 跨进程可取数面（不需共享代码） | **有** | ① `ingest_reports`（含 `contextSource` / `dedupeCrossDocRate`，api 已有 `GET …/ingest-report` 读面：`docs/module-status/api.md:45`）；② `ingest_jobs` 账本；③ BullMQ 队列计数（api 已有 Queue 单例：`apps/api/src/services/queue.ts:31-42`）；④ Redis |

**要点**：进程内 `Map` 计数器**天然无法跨进程**。所以「给 worker 加计数器」这个动作本身不产生可见性——必须先决定「可见性从哪来」（worker 端口 / 推送 / 落库），才能谈共享包。

---

## 8. 成本与风险

### 8.1 给 worker 加 HTTP 端口的牵动面

| 面 | 现状 | 加端口的代价 |
|----|------|--------------|
| 端口分配 | 只有 `API_PORT=4000`（`apps/api/src/env.ts:24`、`.env.example:15`），web 3005 / admin 3006；`docker/docker-compose.yml` 里只有中间件端口（`:26,39,55,69,92`），业务进程不在 compose（`docker/docker-compose.yml:11`：`业务进程 api/worker 仍用本地 pnpm dev（不在 compose 内）`） | 需新钉 `WORKER_*_PORT` + 选号（无既有注册表可循，`docs/ops/operable-stack.md:12-19` 端口表只列依赖服务） |
| docker compose | 无 worker 服务 | 无 compose 变更（业务进程不入 compose）；但也没有现成 compose 健康检查位 |
| 云部署 | **仓内无任何 Dockerfile / k8s / tf 清单**（全仓检索仅命中 0 个业务容器清单） | 无仓内文件要改，但也**无证据**说明生产如何跑 worker、scrape 从哪来 → 端口的实际收益无从验证 |
| `.env.example` | Worker 段只有 `WORKER_PROBE_ON_START` / `INGEST_FAILURE_WEBHOOK_URL`（`:21-24`） | 需新增键；`docs/ops/rate-limit-and-metrics.md` §3 的 `/metrics` 保护策略（`:82-112`）适用范围要显式扩到 worker，否则会留下「第二裸奔口」风险（`prds/10-delivery/03-acceptance-scenarios.md:556` I1） |
| 冻结禁令 | 功能表两处把「Worker 对外 HTTP」写进禁止列（`:34`、`:206`）；spec/module-status 三处「无 HTTP 端口」（`.trellis/spec/worker/backend/index.md:3`、`directory-structure.md:13`、`docs/module-status/worker.md:6`） | **需先裁定口径**：内网只读 metrics 端口算不算「对外 HTTP」？若裁定算，则必须走 ADR → 改 PRD → 升版本（`Claude.md` 权威分层），**不能**由工程票自行开 |
| 测试 | vitest 默认 5s；本图已两次因组合超时热修（`apps/api/vitest.config.ts` / `apps/admin/vitest.config.ts` 的 `testTimeout: 20_000`，见 `.scratch/fill-must-haves/map.md`） | 起真 socket 的测例引入端口占用 / flake 风险；需评估用 `listen(0)` 或纯函数注入规避 |
| 依赖 | `@hono/node-server` 已在 catalog（`pnpm-workspace.yaml:33`） | 技术成本低（`"catalog:"` 一行）；也可以用 `node:http` 零依赖 —— **技术不是瓶颈，口径才是** |

### 8.2 更小的替代（不新增端口）

1. **把日志字段做实**：现状已有 `event=contextualize_summary` + 两个计数字段（`pipeline.ts:603-612`），只差「口径确认 + 命名/字段稳定化 + 落 spec」。日志出口的生产采集器（Promtail/Loki/公司平台）可直接把 JSON 字段当计数器用——符合 `prds/10-delivery/02-ops-runbook.md:31`「实现可选 Prometheus 或 OTel；**名称可映射**」。
2. **入库报告派生**：`contextualize_l1_ok` / `contextualize_l0_fallback` 的**每文档**版本已落 `ingest_reports.contextSource`（l1_llm / l0_fallback / l0）。§5.2 说的是「**入库报告**必出」，若裁定「报告必出」= 报告里能查到，则**已基本满足**；若裁定「必须是计数值」，则需在报告 DTO 加两列（或由 `contextSource` 计数派生），这比开端口小得多。
3. **api 侧聚合**：`queue_depth` / `ingest_job_total`（`prds/10-delivery/02-ops-runbook.md:68-69`）由 api 的 BullMQ Queue 单例（`apps/api/src/services/queue.ts:31-42`）或 Bull Board 读即可，零 worker 改动。
4. **Redis 计数**：worker 打点写 Redis，api `/metrics` 读出汇总——不加端口，但需钉 key 生命周期与「进程寿命 vs 1h 滑窗」口径（`apps/api/src/obs/metrics.ts:23-27` 已显式声明现有实现**不是** PRD 的 1h 滑窗）。

---

## 9. 候选方案 A / B / C

### 方案 A：worker 暴露最小只读 `/metrics`（内网）

- **形态**：`apps/worker/src/obs/metrics.ts`（同型复制 ~40 行 registry）+ `node:http` 或 `@hono/node-server` 起一个只读端点，返回 `{ service: 'worker', metrics: metricsSnapshot() }`；与 api 同款 JSON 快照（**不**引 Prometheus 文本 / 直方图，避免与 `l3-metrics.md:142`「换 Prometheus 面板已否决」冲突）。
- **代价**：中-高。新增端口 + env + 生产保护策略扩写 + 测试形态变化 + 部署侧（无仓内清单）无从验证。
- **前置条件**（**硬**）：① 裁定「Worker 对外 HTTP」禁令是否覆盖内网 metrics 端口（功能表 `:34`、`:206`）——若覆盖，须 ADR → 改 PRD → 升 `prds/README.md` 版本；② 钉端口号与 env 名；③ 把 `docs/ops/rate-limit-and-metrics.md` §3 保护策略（A/B/C 选项）显式覆盖 worker；④ 明确「进程内计数器 = 每进程一份，重启归零、多副本不聚合」的诚实边界。
- **收益**：与 api `/metrics` 同构，抓取侧心智一致；`contextualize_*` 及 PRD §1.1 点名的 `scan_*` / `ocr_*` 系列有落点。

### 方案 B（**推荐**）：不加端口，把「日志字段算不算出口」这一定性钉死并做实

- **形态**：① 一次裁定（写进工单 Answer + `.trellis/spec/worker/backend/quality-guidelines.md` §日志）：worker 侧指标出口 = Pino 结构化日志字段 + 入库报告落库，**不含** HTTP 端点；② 把 `event=contextualize_summary` 的字段名、事件名、触发点（每 stage 结束）写进 spec；③ 顺手补 `ingest_reports` 侧可否派生 `contextualize_l1_ok` / `l0_fallback` 的说明（口径：报告现有 `contextSource` 已覆盖每文档真值）。
- **代价**：低（无代码或极小代码 + 文档回写）。
- **前置条件**：① 承认 `prds/04-pipelines` §5.2「入库报告必出」的「指标」在现仓口径下 = 日志字段 + 报告列（需在工单里写清，不能沉默）；② 若采集侧将来要 scrape，需另开支撑票（本方案不承诺可 scrape）。
- **收益**：零冻结冲突、零部署牵动；把 101 号票「已知但悬空」的口径正式落地。

### 方案 C：worker 打点落 Redis / 落库，api `/metrics` 汇总读出

- **形态**：worker `metricInc` 写 Redis（或扩 `ingest_reports` 列 / 新增计数表），api `/metrics` 读取后并入 `metricsSnapshot()`。
- **代价**：中。需钉 key 命名 / TTL / 重置语义 / 多副本聚合口径；PRD 的 1h 滑窗 vs 现有「进程寿命近似」（`apps/api/src/obs/metrics.ts:26`、`.trellis/spec/api/backend/l3-metrics.md:45`）会再次成为争议点。
- **前置条件**：先裁定「跨进程计数是否需要 window 语义」；并接受 api 进程成为 worker 指标的**唯一读面**（与「观测两分」不冲突，但会让 api 承担非自身计数）。
- **收益**：不开端口、不违禁令，且指标可被现有 `/metrics` 与面板读到。

**三案共同前置**：本主题真正待裁定的不是「写多少代码」，而是**「worker 无 metrics 出口」是否构成必须具备缺口**。按功能表 §6 逐行核对（第 4 节），worker 必须具备**不含** metrics；按 prds/04 §5.2，`contextualize_*` 的「必出」落点是**入库报告**。因此建议裁定顺序：**先钉「报告必出」的口径（B），把是否要 scrape（A/C）留给出现真实采集需求时再战。**

---

## 10. 关键证据索引

| 主题 | 路径:行 |
|------|---------|
| api metrics 实现 | `apps/api/src/obs/metrics.ts:1-4, 6-7, 13-14, 30-36, 39, 49` |
| api `/metrics` 端点 | `apps/api/src/app.ts:79-80`；`apps/api/src/middleware/admin-write-audit.ts:22` |
| `/metrics` 保护策略 | `docs/ops/rate-limit-and-metrics.md:82-112` |
| worker 入口 / 无 HTTP | `apps/worker/src/index.ts:55-58, 137-149, 160-170, 192-195` |
| worker 日志出口 | `apps/worker/src/logger.ts:5-13` |
| worker 现有计数（仅日志） | `apps/worker/src/ingest/pipeline.ts:601-612` |
| worker 账本 / 报告 | `apps/worker/src/ingest/job-ledger.ts:85-121`；`packages/db/src/schema/kb/ingest-reports.ts:32` |
| 功能表禁止列 | `prds/12-delivery-guides/14-模块需求功能表.md:34, 206` |
| 功能表 worker §6 | `prds/12-delivery-guides/14-模块需求功能表.md:453-470`（无 metrics 行） |
| 功能表 api `/metrics` 行 | `prds/12-delivery-guides/14-模块需求功能表.md:352` |
| 最小指标契约 | `prds/10-delivery/02-ops-runbook.md:29-32, 67-74` |
| 观测分层 | `prds/08-quality/03-langfuse-observability.md:12-19, 162` |
| 队列可观测 | `prds/06-async/01-bullmq-jobs.md:169-174` |
| contextualize 指标必出 | `prds/04-pipelines/01-offline-ingest.md:245-250, 312-313` |
| worker spec 无 HTTP | `.trellis/spec/worker/backend/index.md:3, 13, 25`；`directory-structure.md:13`；`quality-guidelines.md:107-109` |
| api spec 框定 obs | `.trellis/spec/api/backend/directory-structure.md:76, 111`；`l3-metrics.md:19, 142` |
| IS 镜像 | `docs/module-status/worker.md:6, 22, 43, 52, 79, 87`；`docs/module-status/api.md:23, 115, 187-188, 227` |
| 前一票的悬空口径 | `.scratch/fill-must-haves/issues/101-real-l1-contextualize.md`（Answer「没做什么 / 边界」第 1 条） |
| 地图已挂账 | `.scratch/fill-must-haves/map.md`（Not yet specified：`worker metrics 出口（contextualize_* 要变真计数器得先有它）`） |
