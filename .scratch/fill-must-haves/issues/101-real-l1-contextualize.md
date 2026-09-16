# 真 L1 contextualize 最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 100

## Question

把入库的「L1 LLM 情境前缀」从**只记 `l0_fallback` 占位**变成真调用（失败仍回退 L0）。

权威：

- 功能表 §6（第 463 行）：「`ingest.contextualize` | 可选 L1 LLM 前缀 | 失败/触顶 回退 L0，块仍可索引；禁止 skip chunk 仍 ready；关 L1 须 `contextMode=l0_template` | **P1**」；§0（68–69）：「情境前缀 | **L0 规则前缀；L1 可选 LLM `contextualize`** | `sparseText = contextPrefix + "\n" + body`；embed 用 prefix+body」；§9.1（516）「contextualize | 入库 L1 | P1」。
- ADR-013（`prds/11-decisions/00-adr-index.md`:95-98）：「生产默认 **L1 LLM contextualize**（Gateway `purpose=contextualize`），失败回退 **L0 标题路径模板**；允许 KB 显式关 L1…须打点 `context_source`」。
- `prds/04-pipelines/01-offline-ingest.md` §4（194–198）：L1 经 Model Gateway、`purpose=contextualize`、**temp=0**、输出 ≤25 词单句置于 body 前；§4.1（199–209）**已冻提示模板**（`文档标题: {title}` / `文档摘要/前缀: {doc_excerpt}` / `块正文: {chunk}` / 「只输出这一句，不要引号与解释」）；§4.2（210–218）：失败 → `context_source=l0_fallback`（块仍可索引），成功 → `l1_llm`，**原文 body 不变、仅 prefix**；§5.2 点名指标 `contextualize_l1_ok` / `contextualize_l0_fallback`。
- `prds/03-data/01-postgresql-schema.md`:246：`context_source` ∈ `l0_template` / `l1_llm` / `l0_fallback`。

现状（源码 IS）：

- chunk 段已读快照写 prefix：`apps/worker/src/ingest/pipeline.ts:522-527`（`parseContextMode(doc.chunkStrategyParams?.contextMode)` → `resolveContextSource` → `l0ContextPrefix(doc.title)`）、写入 `:551-553`。
- 契约**故意**不落 `l1_llm`：`packages/contracts/src/ingest/chunk-strategy.ts:43-48`（`CONTEXT_MODES` 含 `l1_llm`，但 `CONTEXT_SOURCES` 只有 `l0` / `l0_fallback`，注释「l1_llm 成功要等 Gateway contextualize，禁止先写」）；`:71-73` `resolveContextSource(mode)`；`:50-54` 默认参数 `contextMode: 'l1_llm'`。
- worker **已有**同型 HTTP 网关先例可抄：`apps/worker/src/ingest/embed-http.ts:9-36`（OpenAI 兼容、可注入 `fetchImpl`），调用点 `pipeline.ts:693-714`；env 侧 `apps/worker/src/env.ts:32-33,47`（有 `GATEWAY_BASE_URL` / `GATEWAY_API_KEY` / `GATEWAY_EMBED_MODEL`，**无** chat 模型与 contextualize 开关）。
- **缺**：无 `purpose=contextualize` 调用、无 `contextualize-http.ts`、`CONTEXT_SOURCES` 不含 `l1_llm`（即使调通也无处落库）、报告白名单 `apps/worker/src/ingest/ingest-report.ts` `keepContextSource` 与 api 映射 `apps/api/src/services/ingest-reports.ts:41-45` 同样只认 `l0*`、两个指标名全仓零命中。

口径（本票钉）：

- 新增 `INGEST_CONTEXTUALIZE_MODE` ∈ `off | http`，**仓库默认 `off`** —— 无真 Gateway 时默认 on 只会把每一块都记成 `l0_fallback`，是假账；生产按 env 开（与 `INGEST_OCR_ENABLED`、`SESSION_REWRITE_ENABLED` 同款「能力落地、默认关」）。**Answer 里必须写明这条与 ADR-013「生产默认 L1」的关系**：产品默认仍是 L1（KB 快照 `contextMode` 默认 `l1_llm` 不动），仓库**运行时**默认 off 待真 Gateway。
- 失败回退必须落 `l0_fallback`（块仍可索引，**禁止** skip chunk 后仍 ready）；成功落 `l1_llm`；`contextMode=l0_template` 仍只走 L0。
- **不得改** `sparseText = contextPrefix + "\n" + body` 与「embed 用 prefix+body」口径；**不得改**原文 body（只加 prefix）。

### 做

- worker：新增 `apps/worker/src/ingest/contextualize-http.ts`（照 `embed-http.ts` 同型：可注入 `fetchImpl`、`temperature=0`、prompt 用 §4.1 冻结模板、超时/非 2xx/空输出都抛可辨错误）；env 增 `INGEST_CONTEXTUALIZE_MODE` 与 chat 模型名；`pipeline.ts` chunk 段按块调用，失败回退并 warn。
- contracts：`CONTEXT_SOURCES` 增 `l1_llm`（**只在真有成功路径时**才加，避免又一处「先写枚举后无实现」）。
- worker 报告 / api 映射的 `contextSource` 白名单同步放开 `l1_llm`。
- 指标：按 PRD 点名落地 `contextualize_l1_ok` / `contextualize_l0_fallback`（打点位置与现有 `record*` 风格一致；**不**新造第三名）。
- 测例：`apps/worker/tests/ingest/context-mode-obey.test.ts` 扩「http 成功写 `l1_llm` / 失败回退 `l0_fallback` / `l0_template` 不调 LLM」；新增 `tests/ingest/contextualize-http.test.ts`（注入 `fetchImpl`：429、超时、空输出三例）；`packages/contracts/tests/ingest/` 枚举断言同步。**禁止**真 LLM / 真集群 / 墙钟。

### 不做

- **不引**厂商 SDK / 本地权重（真引擎选型锁死；走 HTTP OpenAI 兼容）。
- **不加**库级 TPM / `maxEmbedCalls` 类硬闸（embed TPM 已划出本图）；不做 per-tenant 计费硬闸。
- **不做** PRD §4.2 提到的「结果 checkpoint、重跑跳过已有 prefix」（需断点续传基建，另票）；不默认开（见口径）。
- 不动检索闸 / 门禁 / min 否决 / verify；不动 KB 级 `contextMode` 默认值；不改 `prds/00–11`；不 `task.py create`；禁止 push。

收工：`.trellis/spec/worker/backend/`（ingest 能力矩阵与 chunk/情境一节）+ `.trellis/spec/api/backend/`（若入库报告白名单有专节）+ `docs/module-status/{worker,api,contracts}.md` + 各 `tests/index.md`。Answer 里写明「默认 off 与 ADR-013 的关系」「未做 checkpoint / TPM」。

## Answer

**默认口径（本票钉的，须与 ADR-013 一起读）**：`INGEST_CONTEXTUALIZE_MODE` ∈ `off | http`，**仓库默认 `off`**。ADR-013 的「生产默认 L1」说的是**产品默认**，而仓库的**运行时默认**取 off：没有真 Gateway 时默认 on 只会把每一块都记成 `l0_fallback`（假账）。KB 快照的 `contextMode` 默认值 `l1_llm` **未动**，所以「关 L1 须显式设 `l0_template`」这条口径不受影响。与 `INGEST_OCR_ENABLED`、`SESSION_REWRITE_ENABLED` 同款「能力落地、默认关」。

**做了什么**

- worker 新增 `apps/worker/src/ingest/contextualize-http.ts`：OpenAI 兼容 `/chat/completions`，`temperature=0`，system 提示用 PRD §4.1 冻结措辞（「只输出这一句，不要引号与解释」），user 提示按冻结字段 (`文档标题:` / `文档摘要/前缀:` / `块正文:`) 拼装；输出归一化为**单行**（去引号、压空白），空输出 / 超长（按 PRD ≤25 词折算 200 字符）/ 非 2xx / 畸形响应 / 缺 `GATEWAY_BASE_URL` **一律抛**（不静默返回空串冒充成功）。
- env：`INGEST_CONTEXTUALIZE_MODE`（默认 off）+ `GATEWAY_CHAT_MODEL`（默认 gpt-4o-mini）。
- pipeline chunk 段：`contextMode=l1_llm` **且** mode=http 时逐块调用；成功用模型前缀并计 `l1_ok`，失败该块回退 L0、计 `l1_fallback` 并 warn（**不阻断入库、不改正文**）。报告 `contextSource`：**全部块都走上 L1 才写 `l1_llm`，任一块回退即 `l0_fallback`**（块自身 prefix 已各自回退）。零存活块的 EMPTY_CHUNKS 分支行为不变。
- contracts：`CONTEXT_SOURCES` 增 `l1_llm`（注释同步为「只在真调通时写」）；worker 报告 `keepContextSource` 白名单与 api 映射白名单同步放开 `l1_llm`。
- 打点：`log.info({ event: 'contextualize_summary', contextualize_l1_ok, contextualize_l0_fallback, contextSource })`。

**没做什么 / 边界（如实说）**

- **PRD 点名的 `contextualize_l1_ok` / `contextualize_l0_fallback` 只作日志字段，不是 `/metrics` 计数器** —— **worker 进程没有任何 metrics 出口**（`metricInc` 只存在于 api，见 `apps/api/src/obs/metrics.ts`）；要变成真计数器得先给 worker 造指标出口，属另一张票。**没有**为了「点名落地」去假造一个计数器。
- **未做** PRD §4.2 的「结果 checkpoint、重跑跳过已有 prefix」（需断点续传基建）。
- **未做** per-tenant 计费 / TPM 硬闸（embed TPM 已划出本图）；**未引**厂商 SDK / 本地权重（HTTP OpenAI 兼容）。
- 未改 `sparseText = contextPrefix + "\n" + body` 与「embed 用 prefix+body」口径；未改正文 body（只加 prefix）；未动 KB `contextMode` 默认值；未改 `prds/00–11`。
- **未验证真 Gateway**：测例全部注入 `fetchImpl` / `vi.stubGlobal('fetch')`，没有对真 LLM 端点跑过（本环境无真网关）。真实延迟、限流行为未测。

**验证**：`apps/worker` 整包 **34 files / 165 passed**（新增 `tests/ingest/contextualize-http.test.ts` 7 例 + `context-mode-obey.test.ts` 扩 3 例）；contracts `context-mode.test.ts` 5 例；全仓 `pnpm test` 11/11、`pnpm check-types` 8/8、`pnpm lint` 8/8 零 warning（数字见地图本轮收口）。

**测试先红后绿的一处**（值得记）：`packages/contracts/tests/ingest/ingest-report-contract.test.ts` 里原有一条断言 **拒绝** `contextSource: 'l1_llm'` —— 那是「本轮不落 l1_llm」时代的口径。放开枚举后它按预期变红（全仓测试第一次跑就抓到），已改为「三态接受 + 未知值 `l2_llm` 拒」，**不是**放宽断言而是口径随实现更新。

**回写**：`.trellis/spec/worker/backend/ingest-capability-matrix.md`（chunk 行 + ingest_reports 行）· `.trellis/spec/worker/backend/directory-structure.md`；`docs/module-status/{worker,api}.md`；`apps/worker/tests/index.md` 与 `packages/contracts/tests/index.md`。

## Comments

- 2026-09-16 由 [裁定 98](./98-after-96-order.md) 排为本批第三张：功能表 P1 入场项，worker 已有同型 HTTP 先例，无硬前置。
- 2026-09-16 完成。默认关（理由见 Answer）；`contextualize_*` 只作日志字段（worker 无 metrics 出口，未假造）。
