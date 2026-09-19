# 覆盖表 P2 必签『部分测 / 未测』余量盘点（2026-09-20）

**结论摘要**（只读盘点，未改任何源码 / 文档 / 工单）

- 按 `docs/testing/coverage.md` 与四本分册**「阶段」列**的 P2 标注（`P2必签` / `P2必签代码门禁` / `P2配置必签` / `P2单测必签` / `P2契约必签` / `授码能力必签`，含 acl 分册自列进 P2 子集的 B1-A3），P2 必签余量共 **94 行**：**部分测 94 行 / 未测 0 行**。
- 其中**可离线补齐 71 行**（vitest + 现有 mock / 内存仓 / RTL，不需真 ES、真杀毒、真模型网关、浏览器）；**23 行不可离线补**，阻塞集中在三类：真 ES 命中 / 真双节点部署 / 真进程启动（E1、E2、H5b、H5d、P1、AC4 共 6 行）· 人签与 live 真跑（T4）· **源码与 Then 不一致或源码无落点共 16 行**（D-拼句、H1、H5e、M8、S1、S4、Y6、X4、X5、R9、T6、V5，另 U8/J7c、P3、AC2 同属此类）。
- 覆盖表**已明显过期**：至少 11 行仍标「部分测 / 缺实现」但今天已有可指认的测例（E4 · E5 · L7 · V3 · O4 · R10 · AA1 · AB8 · AC7 · V4 · Q4），另有 K1、U8&J7c、D-fast、H1、H5d 的缺口只剩无关支路。详见下节。
- 覆盖表**汇总数与行级标注互相矛盾**（ask 24/26 vs 行级 25/25；ingest 33 vs 31；acl 37 vs 39；ops AD、G 两行与计数表不符）。**本盘点一律以行级「阶段 + 覆盖」为准**。
- 建议第一批：**信任环 ask 补测 11 行**（A1–A4 · D-fast · D3 · H5 · H6 · K1 · U2 · U5，夹具现成、离线可绿、backlog 点名优先）。

> 「可离线补」判定口径：**是** = 仅用 vitest + 仓库现有 mock（`_support/graph-harness.ts`、内存仓、mock ES、fetch stub、RTL）即可写出对该步骤 Then 有实质断言的测例；**否** = 必须先改源码 / 需真实外部依赖 / 属人签或部署，阻塞原因写在「今天缺的断言」末句。

---

## 覆盖表过期与内部不一致（判读前必读）

**A. 已具备但表中仍标「部分测 / 缺实现」**（源码证据，建议回写覆盖表）

| 行 | 覆盖表现态 | 今天的事实（证据路径） |
|----|------------|------------------------|
| E4 | 部分测 | `apps/worker/tests/ingest/cross-doc-pending-review.test.ts`（pending_review 落库入审不入 manifest）· `apps/api/tests/ingest/dedupe-conflict-resolve.test.ts`（人工二选一 HTTP：winner=this/other、非待审 400、坏 body 400）→ 仅剩「生产 MinHash LSH」非本阶段 |
| E5 | 部分测 | `apps/worker/tests/ingest/contextualize-fallback-ready.test.ts`：正例 `context_source=l1_llm` + 故障（HTTP 500/503、畸形响应、空白输出、AbortError）→ `l0_fallback` 且文档仍 `ready` |
| L7 | 缺实现 | `apps/worker/tests/ingest/orphan-clean.test.ts`（激活版 / 在飞版 / 无激活表示三条反例护栏）· `orphan-clean-on-failure.test.ts` |
| V3 | 缺实现 | `apps/api/tests/ingest/no-self-approve.test.ts`（自审 approve/reject 均 403、他人 approve 200 记审批人、无 actor 不误伤） |
| O4 | 缺实现 | `apps/worker/tests/ingest/es-builder-tenant-required.test.ts` · `apps/api/tests/ask/es-builder-tenant-required.test.ts` |
| R10 | 缺实现 | `apps/api/tests/obs/plane-quota-safe-default.test.ts`（staging/production 缺配 → 安全默认 + 告警，不拒绝启动） |
| AA1 | 缺实现 | `apps/api/tests/kb/chunk-strategy-preserves-docs.test.ts`（保存参数后既有文档 `index_version` / chunk 边界逐字段不变 + 审计一行 + 反向对照） |
| AB8 | 缺实现 | `apps/admin/tests/ops/chunk-strategy-panel.test.tsx`（「设置」弹窗、保存 recommended、文案「不会自动全库 reindex」） |
| AC7 | 缺实现 | `apps/api/tests/kb/kb-consume-bindings-http.test.ts`（KB 侧 PUT judge → 400 且不落行） |
| V4 | 部分测 | `apps/api/tests/ingest/approve-then-scan.test.ts`（approve 200 → scan 200 + `enqueueIngest({stage:'scan'})`）· `no-self-approve.test.ts:116`（他人 approve 200） |
| Q4 | 部分测 | `apps/worker/tests/ingest/header-too-short.test.ts`（低于 `INGEST_MIN_EXTRACTED_CHARS` → `needs_ocr` + `NO_TEXT_LAYER`，不得 chunk/ready） |
| K1 | 部分测 | `apps/api/tests/ask/evidence-verbatim.test.ts:20` 就有工号夹具（`工号A1001`），并断言 generate/claim_split/judge 输入与 citation、`evidence_snapshot` 逐字一致 → 仅缺手机号夹具 |
| U8 / J7c | 部分测 | `apps/api/tests/kb/settings-http.test.ts:297` 已断言 `SESSION_REWRITE_DISABLED`；剩「无 L2 却强制 true → 启动失败」无落点 |
| D-fast | 部分测 | Then 的两支中「无 `purpose=route` 的 LLM 调用」已被 `route-rules.test.ts`+`verify-required.test.ts` 覆盖；源码 `route_llm_skipped` 是**布尔**（`apps/api/src/graph/route-rules.ts:7`），无 `fast_mode` 取值 |
| H1 | 部分测 | 429 + `RATE_LIMITED` + JSON `retryAfterSec` 已测（`apps/api/tests/obs/rate-limit.test.ts`·`quota-planes.test.ts`）；`Retry-After` 头在 PRD 原文是「**可带**」，`apps/api/src` 全仓无该头 |
| M8 | 部分测 | 缺口里「`uploaded_by` 列未在 complete 写入」已过期：`apps/api/src/routes/documents/index.ts:361` 与 `apps/api/src/services/ingest-complete-pending.ts:309` 均写 `uploadedBy` |

**B. 覆盖表可能出现的事实性冲突（需先裁定，勿直接写测）**

- `apps/api/src/graph/route-rules.ts:32-77`：`route_post_block=true` 分支在当前纯规则路径**不可达**（进入该分支要求整句归一后等同于寒暄词，同时命中禁词正则，二者互斥），且**全仓无 `route_source=rule_knowledge` 取值**（仅 `'rule' | 'fallback_single'`）。D-拼句 的 Then「`route_post_block` 可为 true 或 `route_source=rule_knowledge`」今天无从断言。
- `apps/api/src/services/model-gateway.ts:176-214`：`validatePlatformBindings` 只校验 ref/类型启用 + `judge≠judge_aux`，**无 env 分档**（P2 的「dev 同模 warning」确实未做）；也**没有「llm/embedding/rerank 缺一类即拒保存 Provider」闸**（AC2 的 Then 字面只要求「各至少一启用可保存」，已测）。
- `apps/api/src/env.ts`：全仓**无** debug / maintenance / degraded 开关（H5e 的 Then 无落点）。

**C. 计数与汇总不一致（勿据汇总数排期）**

| 分册 | 计数表 | 行级实读 | 备注 |
|------|--------|----------|------|
| ask | 已测 24 / 部分测 26 | 已测 25 / 部分测 25 | 总和 64 一致，单项差 1 |
| ingest | 已测 10 / 部分测 33（coverage.md 汇总） | 部分测 31（分册计数表自洽） | 汇总与分册差 2 |
| acl | 已测 22 / 部分测 37（汇总）· 分册计数表 已测 22 / 部分测 39 / 延后 2 | 已测 24 / 部分测 39 / 延后 0 | 分册「延后 2」在行级无对应行 |
| ops | 部分测 29 / 缺实现 10（汇总） | G3 行级已是部分测、AD1–AD3 行级已是已测、AD 行级已测 7 | 汇总沿用了未更新的 AD / G 子表 |

---

## 剧本 A

| 行号/步骤 | 覆盖表现态 | 源码现状（路径） | 今天缺的断言 | 可离线补 | 建议落点 |
|---|---|---|---|---|---|
| A1 | 部分测 | 建库已测 `apps/api/tests/kb/create-kb.test.ts`（POST 201 + 首位库管 + 租户取令牌）；模型供应商/绑定另切片 `apps/api/tests/gateway/bindings-http.test.ts` · 缺口含 `live` 建库可 skip | 无「建 KB → 配 generate/embed/rerank 模型 → 可解析」一条必绿 happy | 是 | `apps/api/tests/kb/create-kb-with-models.test.ts`（新） |
| A2 | 部分测 | 邀请成员 `tests/acl/members-http.test.ts` · 双闸语料 `tests/ask/ready-active-corpus.test.ts` · worker 对账 `apps/worker/tests/ingest/dual-ready-index.test.ts` | 上传 complete → ready → `lifecycle=active` → 成员 ask 可命中 的一条串联（今天全靠切片） | 是 | `apps/api/tests/ingest/upload-to-active-retrievable.test.ts`（新） |
| A3 | 部分测 | 图内 answered+citations+verify 已测 `tests/ask/verify-required.test.ts`；`answerKind=knowledge` 仅 `tests/ask/final-replay.test.ts:141`（GET final 回读）断言 | **POST /ask 与 SSE 响应**未断言 `answerKind=knowledge` | 是 | `apps/api/tests/ask/answer-kind.test.ts`（新，复用 graph-harness） |
| A4 | 部分测 | 空证据 `low_retrieval` abstained 已测 `tests/ask/retrieve-outcomes.test.ts`；web 主按钮 `apps/web/tests/ask/suggested-actions.test.tsx`；api 侧非空仅见 `final-replay.test.ts:149` | abstained 响应（同步 + SSE）`suggestedActions` 非空且随 reason 变 | 是 | `apps/api/tests/ask/abstain-suggested-actions.test.ts`（新） |

## 剧本 D

| 行号/步骤 | 覆盖表现态 | 源码现状（路径） | 今天缺的断言 | 可离线补 | 建议落点 |
|---|---|---|---|---|---|
| D-拼句 | 部分测 | `apps/api/src/graph/route-rules.ts:32-77`；`apps/api/tests/ask/route-rules.test.ts` 只测「你好，年假政策」→ single | 未覆盖原句「你好，请问差旅住宿标准」；未断言 `route_post_block`。**且覆盖表可能过期 / 冲突**：`route_post_block=true` 分支纯规则路径不可达，无 `route_source=rule_knowledge` 取值 → 须先改源码或回 PRD；只能先补「不得 chitchat、应 single」弱断言 | 否（阻塞：源码分支不可达 + PRD 未定义 `rule_knowledge`） | `apps/api/tests/ask/route-rules.test.ts`（补 it，仅弱断言） |
| D-fast | 部分测 | `route-rules.ts:7`（`route_llm_skipped: boolean`）· `tests/ask/route-rules.test.ts` / `rewrite-disabled.test.ts` / `verify-required.test.ts` | `mode=fast` 下**直**断言「从未以 `purpose=route` 调用 chat」（现为间接证据）；`route_llm_skipped=fast_mode` 取值不存在 | 是 | `apps/api/tests/ask/route-rules.test.ts`（补 it） |
| D3 | 部分测 | `apps/api/tests/ask/retrieve-outcomes.test.ts`（仅空证据 → `low_retrieval`） | 无「库外假前提」问句夹具，未断言其 abstained **且非 chitchat answered** | 是 | `apps/api/tests/ask/false-premise.test.ts`（新） |

## 剧本 H

| 行号/步骤 | 覆盖表现态 | 源码现状（路径） | 今天缺的断言 | 可离线补 | 建议落点 |
|---|---|---|---|---|---|
| H1 | 部分测 | `apps/api/tests/obs/rate-limit.test.ts` · `quota-planes.test.ts`（429 + 码 + `retryAfterSec`）；`apps/api/src` 全仓无 `Retry-After` 头 | `Retry-After` 响应头（PRD 原文「可带」= 可选）→ 覆盖表可能过期，主断言已具备 | 否（阻塞：源码不设该头；断言「不存在」无验收价值） | —（建议关行或降为建议） |
| H5 | 部分测 | `tests/gateway/resolve-mock.test.ts:201`（映射 `internal_guard`）· `generate-fallback.test.ts:285` · `tests/ask/http-stream.test.ts:319`（execute 抛错） | 无「generate 全链失败」**走图**的夹具：断言 `status=abstained` + `internal_guard` 且 `answerKind≠knowledge` | 是 | `apps/api/tests/ask/gateway-chain-fail.test.ts`（新） |
| H5b | 部分测 | `tests/gateway/resolve-mock.test.ts`（mock 双节点 fallback） | staging/production **真**双节点断 primary | 否（阻塞：真部署 + 人签，非单测） | — |
| H5d | 部分测 | `resolve-mock.test.ts`（`buildGatewayConfig` 链长 < `RERANK_MIN_NODES` 抛错） | 进程启动失败（Then 的「拒绝加载配置」支已具备）→ 覆盖表可能过期 | 否（阻塞：需真进程启动） | — |
| H5e | 部分测 | `tests/ask/retrieve-run.test.ts`（rerank 失败禁 RRF-only answered）；`apps/api/src` 无 debug/maintenance/degraded 开关 | 无 debug / maintenance 开关夹具，Then 无从构造 | 否（阻塞：源码未做该模式，PRD 未定义开关） | — |
| H6 | 部分测 | `tests/ask/http-stream.test.ts`（`data-ask-final`≡sync；抛错空答）；`apps/api/src/routes/ask.ts:400` 注释「P2 不推 text-delta 伪流式」 | 「token 缓冲作废」可观测形态：拒答路径**不得**下发 `data-text-delta` | 是 | `apps/api/tests/ask/http-stream.test.ts`（补 it） |

## 剧本 K

| 行号/步骤 | 覆盖表现态 | 源码现状（路径） | 今天缺的断言 | 可离线补 | 建议落点 |
|---|---|---|---|---|---|
| K1 | 部分测 | `apps/api/tests/ask/evidence-verbatim.test.ts:20`（工号夹具 + 逐字一致）；`tests/ask/citations.test.ts`（可回溯） | 手机号夹具（工号已有）→ 覆盖表可能过期 | 是 | `apps/api/tests/ask/evidence-verbatim.test.ts`（补 it）或直接回写覆盖表 |

## 剧本 U / J7c

| 行号/步骤 | 覆盖表现态 | 源码现状（路径） | 今天缺的断言 | 可离线补 | 建议落点 |
|---|---|---|---|---|---|
| U2 | 部分测 | `tests/sessions/http.test.ts`（列表含 A/B）；路由**已支持**分页 `apps/api/src/routes/sessions.ts:75-85`（`limit ?? 50` / `offset ?? 0`） | `limit` / `offset` 分页切片与越界行为 | 是 | `apps/api/tests/sessions/http.test.ts`（补 it） |
| U5 | 部分测 | `tests/sessions/http.test.ts:147-161`（GET 历史隔离）：`tests/ask/execute-trace.test.ts:90` 有 Vue 泄漏夹具 | 在 B 会话发问时**近窗/历史窗**不得含 A 的 Vue 文本（现只测 GET 历史与 graph 侧 history≠evidence） | 是 | `apps/api/tests/sessions/http.test.ts`（补 it，store 级断言 window(B)） |
| U8 | 部分测 | `apps/api/tests/kb/settings-http.test.ts:297` 已断言 `SESSION_REWRITE_DISABLED`；`packages/contracts/tests/kb/settings-contract.test.ts`（默认关 + 拒写） | 「无 L2 却强制 true → 启动失败」无落点（`env.ts` 无 L2 检测）→ 覆盖表可能过期 | 否（阻塞：源码无 L2 检测 / 启动闸；可选支已具备） | — |
| J7c | 部分测 | 同 U8（`packages/contracts/src/common/biz-code.ts` 有码） | 同 U8：无误开 → 400 的**直**夹具（HTTP 已有等价断言） | 否（同 U8 阻塞） | — |

## 剧本 E

| 行号/步骤 | 覆盖表现态 | 源码现状（路径） | 今天缺的断言 | 可离线补 | 建议落点 |
|---|---|---|---|---|---|
| E1 | 部分测 | `apps/api/tests/ask/ready-active-corpus.test.ts`（R7 主锚）· `packages/db/tests/retrieve/ready-active-gate.test.ts` | 「入库后 ES **可查文号**」需真 ES 查询（mock ES 只比对 chunkId 集合）；离线最多断言 bulk 载荷含正文 | 否（阻塞：真 ES 命中属 B8/OPS-1） | — |
| E2 | 部分测 | `tests/ingest/document-supersede.test.ts`（写两列 + 只留后继）· `ready-active-corpus.test.ts`（superseded 被滤） | 与 ES 命中串联（默认 mock ES） | 否（阻塞：真 ES 命中） | — |
| E5 | 部分测 | **已具备**：`apps/worker/tests/ingest/contextualize-fallback-ready.test.ts`（`l1_llm` 正例 + 4 类故障 → `l0_fallback` + 仍 ready） | 无新断言可加，只需回写覆盖表 | 是（仅回写） | 回写 `docs/testing/coverage/01-ingest.md`（E5 → 已测） |

## 剧本 L

| 行号/步骤 | 覆盖表现态 | 源码现状（路径） | 今天缺的断言 | 可离线补 | 建议落点 |
|---|---|---|---|---|---|
| L1 | 部分测 | `apps/worker/tests/ingest/dual-ready-index.test.ts`（mock ES 集合对账）· `embed-es-serial.test.ts`；`src/ingest/pipeline.ts` | 同一 `indexVersion` 下 **PG `chunk_embeddings` 与 ES 集合逐一对账**（内存 db 可断言 `embeddings.chunkIds ≡ es 集合`）；样例 MD/TXT 到 ready | 是 | `apps/worker/tests/ingest/dual-ready-embeddings-parity.test.ts`（新） |
| L2 | 部分测 | `pipeline.ts` 的 `INGEST_ES_MODE=fail` → `ES_INDEX_FAILED` + `esReady=0`（源码）；`embed-es-serial.test.ts`（半就绪禁 ready） | 走 pipeline 注入 `fail` → `status≠ready`；「向量已写仍检不到」的 ask 串联 | 是 | `apps/worker/tests/ingest/es-fail-not-ready.test.ts`（新）+ `apps/api/tests/ask/…`（语料闸） |
| L3 | 部分测 | `tests/ingest/idempotency.test.ts`（同 version 再 bulk reconcile 仍 ok） | 「失败后重试成功 → ready」；「仅一边有」告警 | 是 | `apps/worker/tests/ingest/es-retry-recover.test.ts`（新） |
| L4 | 部分测 | `packages/db/src/schema/kb/documents.ts:39` 已有 `active_index_version`；`pipeline.ts` 双就绪才 ready | N+1 重索引**原子切换**、切换瞬间只见 N 或 N+1、旧版不被半套污染（负向） | 是 | `apps/worker/tests/ingest/reindex-atomic-switch.test.ts`（新） |
| L5 | 部分测 | `tests/ingest/job-ledger.test.ts`（stage 开始/结束）· `apps/api/tests/ingest/jobs-query.test.ts` | `embedding → indexing_es → ready` **链序**断言；api 入队写 `queued` 行 | 是 | `job-ledger.test.ts`（补）· `apps/api/tests/ingest/jobs-query.test.ts`（补） |
| L9 | 部分测 | `embed-es-serial.test.ts`（本地 `canMarkReady`）· `pipeline.ts`（embed 成功才 `enqueueNext(...,'es_index')`） | 全仓「均为 embed→es_index、无文档间混序」的静态/链式断言（无测例扫源码顺序） | 是 | `apps/worker/tests/ingest/embed-es-order.test.ts`（新） |

## 剧本 M

| 行号/步骤 | 覆盖表现态 | 源码现状（路径） | 今天缺的断言 | 可离线补 | 建议落点 |
|---|---|---|---|---|---|
| M1 | 部分测 | `apps/api/tests/ingest/complete-size.test.ts`（纯函数）· `gates-live.test.ts`（需 Docker，会 skip） | 经 **handler** 的「PG 无 `uploaded` 成功路径」：mock 仓 + `headObject` 返回超限 → 413 且 `documentRepo` 未被调用 | 是 | `apps/api/tests/ingest/complete-size-http.test.ts`（新） |
| M2 | 部分测 | `apps/worker/src/ingest/pipeline.ts`（`mock_infected` → 删对象 + `MALWARE`）· `tests/ingest/idempotency.test.ts` / `bull-outcome.test.ts`（不可重试） | pipeline 注入 infected：断言 `deleteObject` 被调、无 `chunk_manifest`、无 Mongo body、终态 `failed/MALWARE` | 是（≠ 真杀毒） | `apps/worker/tests/ingest/scan-infected-effects.test.ts`（新） |
| M5 | 部分测 | `apps/api/src/routes/documents/index.ts`（complete 以 Head 为权威闸）· `gates-live.test.ts`（默认无 Docker skip） | 「只改前端 limit」对照：mock `headObject` 复现同一超限 → 仍 413 | 是（不再依赖 Docker） | `apps/api/tests/ingest/complete-head-authority.test.ts`（新） |
| M6 | 部分测 | 同上（`upload-url` 回 `maxBytes` 不替代 complete） | 「预签名无 max body 能力」的专用断言（complete 不读预签名参数） | 是 | 同上文件（第二条 it） |
| M8 | 部分测 | `apps/worker/src/ingest/object-store.ts`（`deleteObject` 删 key）；`uploaded_by` **已**在 `documents/index.ts:361`、`ingest-complete-pending.ts:309` 写入 → 覆盖表可能过期 | 「RustFS 无残留 / 无隔离区」可离线断言（对象已删）；「审计含 hash + uploaderId + timestamp」**无落点** | 否（阻塞：审计事件含 hash 无实现） | —（可先补「对象已删」半句到 `scan-infected-effects.test.ts`） |

## 剧本 Q

| 行号/步骤 | 覆盖表现态 | 源码现状（路径） | 今天缺的断言 | 可离线补 | 建议落点 |
|---|---|---|---|---|---|
| Q1 | 部分测 | `apps/worker/tests/ingest/pdf-text.test.ts` · `extract-text.test.ts` · `ocr-gate.test.ts`（关闸不入队）· `apps/api/tests/ingest/approval-scan.test.ts:33`（`needs_ocr` 不可 active） | 「默认 ask 检不到 `needs_ocr`」的直连断言；admin 文档列表可见 `needs_ocr`（RTL） | 是 | `apps/api/tests/ask/needs-ocr-not-retrievable.test.ts`（新）· `apps/admin/tests/ops/documents-needs-ocr.test.tsx`（新） |
| Q2 | 部分测 | `apps/worker/tests/ingest/pdf-text.test.ts`（未压缩 Tj 可抽文本层） | 「有文本层 PDF → 双就绪 ready → active → 成员 ask 可检索」串联（可用现有 PDF 夹具） | 是 | `apps/worker/tests/ingest/pdf-text-to-ready.test.ts`（新） |
| Q4 | 部分测 | **已具备**：`tests/ingest/header-too-short.test.ts`（< `INGEST_MIN_EXTRACTED_CHARS` → `needs_ocr`，不得 chunk/ready） | 无新断言；建议补一条 `INGEST_MIN_EXTRACTED_CHARS` 边界直测或直接回写 | 是（以回写为主） | `header-too-short.test.ts`（可选补 it）+ 回写覆盖表 |
| Q5 | 部分测 | `packages/contracts/tests/async/ingest-job.test.ts`（`INGEST_STAGES` 含 ocr）· `ocr-gate.test.ts`（`OCR_*` 与 `MALWARE`/`NO_TEXT_LAYER` 分码）· `queue-names.test.ts`（仅 `sr-ingest`） | 「逻辑 stage 隔离且错误码不混用」的**显式**断言（今日为间接） | 是 | `packages/contracts/tests/async/ingest-job.test.ts`（补 it）· `apps/worker/tests/ingest/ocr-gate.test.ts`（补 it） |
| Q10 | 部分测 | worker env 无 OCR 必填；`scan-startup-policy.test.ts` 只约束 `INGEST_SCAN_MODE` | 「缺 OCR 引擎仍可启动」vs「缺杀毒 fail-closed」的**对照**启动单测（可用纯函数/env 校验层表达） | 是 | `apps/worker/tests/ingest/scan-vs-ocr-startup.test.ts`（新） |

## 剧本 V

| 行号/步骤 | 覆盖表现态 | 源码现状（路径） | 今天缺的断言 | 可离线补 | 建议落点 |
|---|---|---|---|---|---|
| V1 | 部分测 | `apps/api/src/routes/documents/index.ts`（complete 走 `markCompletePending`，不 `enqueueIngest`）· `tests/ingest/reindex-strategy.test.ts` / `gates-live.test.ts` | complete 200 后 **queue 未被调用**（mock `services/queue.js`，断言 `enqueueIngest` 0 次 + `approval_status=pending`） | 是 | `apps/api/tests/ingest/complete-no-scan-enqueue.test.ts`（新） |
| V2 | 部分测 | `apps/api/tests/ingest/approval-scan.test.ts`（pending 不可 scan）· `ready-active-corpus.test.ts`（非 ready 不可检） | 「未审批文档 → 默认 ask 不可检」的直连（语料装载不出现该 doc 的 chunk） | 是 | `apps/api/tests/ask/pending-not-retrievable.test.ts`（新） |
| V4 | 部分测 | **已具备**：`tests/ingest/approve-then-scan.test.ts` + `no-self-approve.test.ts:116` | 无新断言；如需可补「approve → scan → M3 链」一条串联 | 是（以回写为主） | 回写覆盖表（V4 → 已测） |
| V5 | 部分测 | `tests/ingest/reject-http.test.ts`（reject 200 后 scan 403 且不入队） | 「rejected → pending 重提」**无 API**（源码未做，PRD 未定义端点） | 否（阻塞：无重提 API / PRD 未定义端点） | — |
| V6 | 部分测 | 无 `PATCH status=ready` 路由；worker 未批 → `NOT_APPROVED`；`canEnqueueScan` 未批为 false | 伪造「跳过审批直写 ready」的 404/403 负向 HTTP | 是 | `apps/api/tests/ingest/no-forged-ready.test.ts`（新） |
| V8 | 部分测 | `tests/ingest/approval-scan.test.ts`（仅 `status=ready` 可 active） | 「approve 后直标 ready」的负向 HTTP（与 V6 同文件两条 it） | 是 | 同上（新增 it） |

## 剧本 AA

| 行号/步骤 | 覆盖表现态 | 源码现状（路径） | 今天缺的断言 | 可离线补 | 建议落点 |
|---|---|---|---|---|---|
| AA6 | 部分测 | `apps/api/tests/ingest/reindex-strategy.test.ts`（200 入队 `stage=chunk`）· worker 抬 `indexVersion` 冻结 manifest | reindex 后**新 `indexVersion`**（api 侧回读 / worker 侧断言）与「检索用新切块」（新语料） | 是 | `apps/api/tests/ingest/reindex-version.test.ts`（新）+ 与 L4 共用 `reindex-atomic-switch.test.ts` |
| AA1 | 缺实现（**过期**） | `apps/api/tests/kb/chunk-strategy-preserves-docs.test.ts` 已覆盖 | 无新断言 | 是（仅回写） | 回写覆盖表 |

## 剧本 B1 / B1-ACL

| 行号/步骤 | 覆盖表现态 | 源码现状（路径） | 今天缺的断言 | 可离线补 | 建议落点 |
|---|---|---|---|---|---|
| B1-2 | 部分测 | 上传路由 `requirePermissionWhenEnforced('doc.upload')`；`tests/auth/enforce-401.test.ts`（默认关仍 201）；`applications` 无「read 角色上传 403」 | `AUTH_ENFORCE=true` + `web_consumer` → 上传（upload-url/complete）403 | 是 | `apps/api/tests/auth/enforce-permission-matrix.test.ts`（新） |
| B1-3 | 部分测 | `tests/acl/members-http.test.ts:153`（GET 403）· `:219`（PUT 403） | **POST 邀请 / DELETE 成员** 403 直打 | 是 | `apps/api/tests/acl/members-http.test.ts`（补 it） |
| B1-5 | 部分测 | `tests/acl/kb-member-gate.test.ts`（超管非成员 ask 200）· `permission-resolve.test.ts`（bypass） | 超管非成员**管文档**（列表/改文档）HTTP；审计未断言 | 是 | `apps/api/tests/acl/kb-member-gate.test.ts`（补 it）+ `obs/admin-write-audit.test.ts`（补 it） |
| B1-8 | 部分测 | `tests/acl/permission-resolve.test.ts`（`doc_operator cannot decide approval`）· `apps/admin/tests/ops/approvals-workspace.test.tsx` | `AUTH_ENFORCE=true` 下 `doc_operator` POST approve → 403 | 是 | `apps/api/tests/auth/enforce-permission-matrix.test.ts`（新，同 B1-2） |
| B1-A3 | 部分测 | `apps/api/src/services/retrieve/corpus.ts`（按 `kbId` 装载；源码无 `allowedDocIds` 字段） | 「他库 chunk 混入」负向：语料装载后断言无跨 KB 文档/chunk | 是 | `apps/api/tests/ask/retrieve-run.test.ts`（补 it） |

## 剧本 S

| 行号/步骤 | 覆盖表现态 | 源码现状（路径） | 今天缺的断言 | 可离线补 | 建议落点 |
|---|---|---|---|---|---|
| S1 | 部分测 | `apps/admin/tests/shell/auth-guard.test.tsx`（无 `admin.shell` → 清会话并跳 `/login`） | 实现跳 `/login`，非 Then 的 403 / 302→web | 否（阻塞：与 Then 不一致，须先裁定 admin 壳拒绝形态） | — |
| S2 | 部分测 | `tests/acl/members-http.test.ts`、`tests/kb/settings-http.test.ts`（403 已测）；上传/审批/lifecycle/评测走 WhenEnforced | enforce=true 下四类写入口 403 矩阵 | 是 | `apps/api/tests/auth/enforce-permission-matrix.test.ts`（新） |
| S3 | 部分测 | `tests/acl/kb-member-gate.test.ts`（成员 ask 200）· `tests/ask/http-validation.test.ts` | read 角色三入口：ask 200 / 文档元数据列表（`doc.view`）/ feedback 提交 | 是 | 同上（ask 侧）+ `apps/api/tests/feedback/http.test.ts`（补 it） |
| S4 | 部分测 | `apps/admin/tests/shell/auth-guard.test.tsx`（只看平台码）· `packages/admin-catalog/tests/acl/catalog-clip.test.ts` | 「KB-A read + KB-B write → 可进壳」在现码模型下不成立（进壳只认平台码） | 否（阻塞：码模型与 Then 不一致，须先裁定） | — |
| S5 | 部分测 | `tests/acl/kb-member-gate.test.ts` · `tests/kb/settings-http.test.ts`（非本库成员 403） | 同一用户跨两库写隔离（A 库 403 / B 库可达）HTTP | 是 | `apps/api/tests/acl/kb-scope-write-isolation.test.ts`（新） |
| S8 | 部分测 | `members-http` / `settings-http` / `ops/dashboard-http.test.ts`（无码 403） | 绕过壳后，上传/审批仍 403（enforce=true） | 是 | `apps/api/tests/auth/enforce-permission-matrix.test.ts`（新） |
| S9 | 部分测 | `apps/admin/tests/ops/documents-workspace.test.tsx`（无 `doc.upload` 藏选择器） | web 侧无误露上传钮 + 即便调 API 仍 403 | 是 | `apps/web/tests/ask/no-upload-surface.test.tsx`（新） |

## 剧本 Y

| 行号/步骤 | 覆盖表现态 | 源码现状（路径） | 今天缺的断言 | 可离线补 | 建议落点 |
|---|---|---|---|---|---|
| Y2 | 部分测 | `tests/ingest/approval-scan.test.ts` · `gates-live.test.ts` · `role-templates.ts`（doc_operator 有 `doc.upload`） | `doc_operator` complete 200 → `approval_status=pending` 且不入队 scan | 是 | `apps/api/tests/ingest/complete-pending-role.test.ts`（新） |
| Y3 | 部分测 | 同 B1-8 | approve HTTP 403（enforce 关时不会发生） | 是 | `apps/api/tests/auth/enforce-permission-matrix.test.ts`（新） |
| Y5 | 部分测 | `tests/acl/kb-member-gate.test.ts`（超管非成员 ask 200）· `tests/kb/visible-list.test.ts` | 超管非成员**列文档** HTTP 200 | 是 | `apps/api/tests/acl/kb-member-gate.test.ts`（补 it） |
| Y6 | 部分测 | `apps/admin/tests/shell/auth-guard.test.tsx`（跳 `/login`） | 同 S1：非 403、非 302→web | 否（同 S1 阻塞） | — |

## 剧本 W

| 行号/步骤 | 覆盖表现态 | 源码现状（路径） | 今天缺的断言 | 可离线补 | 建议落点 |
|---|---|---|---|---|---|
| W6 | 部分测 | `apps/api/src/routes/dashboard.ts`（仅 GET summary）· `packages/contracts/src/system/dashboard.contract.ts`（无 τ 字段） | 「面板改 τ / 门禁」的负向断言（PATCH 面板 → 404/405；τ 只能走 config） | 是 | `apps/api/tests/ops/dashboard-http.test.ts`（补 it） |
| W8 | 部分测 | `tests/acl/platform-users-roles.test.ts`（PUT 角色码 200）· `permission-resolve.test.ts`（`extraGrants` 并入） | 授 `dashboard.view` 后**再打 summary → 200**（现测是模板角色并集） | 是 | `apps/api/tests/acl/grant-dashboard-view.test.ts`（新） |

## 剧本 Z

| 行号/步骤 | 覆盖表现态 | 源码现状（路径） | 今天缺的断言 | 可离线补 | 建议落点 |
|---|---|---|---|---|---|
| Z4 | 部分测 | `apps/api/tests/ingest/chunks-http.test.ts`（detail 200 + body + `bodyTruncated`） | 「点击才拉」UI（列表只拉 list，点开才打 detail） | 是 | `apps/admin/tests/ops/chunks-workspace.test.tsx`（新） |
| Z5 | 部分测 | `tests/acl/platform-users-roles.test.ts` · `tests/ingest/chunks-http.test.ts`（kb_admin 默认码 200） | 给 `doc_operator` 授 `chunk.view` 后 list/detail 200 | 是 | `apps/api/tests/ingest/chunks-http.test.ts`（补 it） |
| Z6 | 部分测 | `chunks-http.test.ts`（仅当前 version；旧 version detail 404）· `packages/contracts/tests/ingest/chunk-contract.test.ts`（query 无 version） | 显式传历史 `version` 参数 → 忽略或 400 | 是 | `apps/api/tests/ingest/chunks-http.test.ts`（补 it） |
| Z8 | 部分测 | `packages/admin-catalog/tests/acl/catalog-clip.test.ts`（kb_admin clip 含 `/chunks`）· `apps/admin/src/app/(ops)/chunks/page.tsx` | 薄页 RTL（可选文档并列块） | 是 | `apps/admin/tests/ops/chunks-workspace.test.tsx`（新，与 Z4 同文件） |

## 剧本 AE / X

| 行号/步骤 | 覆盖表现态 | 源码现状（路径） | 今天缺的断言 | 可离线补 | 建议落点 |
|---|---|---|---|---|---|
| AE1 | 部分测 | `apps/api/tests/acl/departments-http.test.ts`（建树 201 / PUT 归属 200）· `apps/admin/tests/ops/departments-workspace.test.tsx` | 「E 主部门=人事 + M 为负责人」同一剧本串联（今天为两条独立断言） | 是 | `apps/api/tests/acl/departments-http.test.ts`（补 it） |
| X2 | 部分测 | `apps/api/tests/ask/ready-active-corpus.test.ts`（装载层滤类型）· `scope-hr-excludes-finance.test.ts`（X3） | 「answered 时 citation 仅来自 hr」的整轮断言（现只到语料层） | 是 | `apps/api/tests/ask/scope-hr-excludes-finance.test.ts`（补 it，或与 X3 合并） |
| X4 | 部分测 | `tests/ask/mode-doc-types-gate.test.ts`（不在 KB 允许列表 → 400）· `tests/kb/ask-mode-doc-types.test.ts`（子集闸） | KB **未配** `docTypes` 时任意类型放行（`kbDocTypes: []`），与 Then「未知类型一律 400」不符 | 否（阻塞：源码行为与 Then 不一致，须先裁口径） | — |
| X5 | 部分测 | `apps/api/src/services/retrieve/corpus.ts`（先滤再 dense∥sparse）· `es-sparse.ts`（ES 切片仅 `kbId`+match） | dense / ES **查询期** `doc_type` 对称（ES 侧未下该 filter） | 否（阻塞：属 B8 ES 切片，源码未做查询期 doc_type） | — |
| X7 | 部分测 | `tests/ask/ready-active-corpus.test.ts`（语料已滤）· `packages/contracts/tests/ask/contract.test.ts` | 「generate / citation 仍带场外 chunk」的负向护栏（构图后断言 citation ⊆ scope 语料） | 是 | `apps/api/tests/ask/citations.test.ts`（补 it） |

## 剧本 G（ops）

| 行号/步骤 | 覆盖表现态 | 源码现状（路径） | 今天缺的断言 | 可离线补 | 建议落点 |
|---|---|---|---|---|---|
| G1 | 部分测 | `apps/api/tests/feedback/http.test.ts`（missing_doc → 201/open，trace 夹具无状态）· `apps/web/tests/ask/feedback-category.test.tsx` | 该轮为 **abstained** 时开单；「仅 abstained 可开单」的负向（源码亦无该闸，需先裁口径） | 是（正例可补；负向待裁） | `apps/api/tests/feedback/http.test.ts`（补 it） |
| G2 | 部分测 | `tests/feedback/http.test.ts`（仅 `dismissed`）；`apps/api/src/services/feedback.ts:10` 已有 `linked_doc` 类目 | `linked_doc` 关单 + 上传后关闭；admin 关单路径 RTL | 是 | `apps/api/tests/feedback/http.test.ts`（补 it）· `apps/admin/tests/ops/feedback-workspace.test.tsx`（新） |
| G3 | 部分测 | `tests/feedback/promote-gold.test.ts`（运营纳入写 `gold_questions`）· `apps/api/tests/eval/l1-cli.test.ts:129`（读 `fixtures/l1/gold.yaml`） | 「未经审核不得进 `gold.yaml`」的护栏（静态/文档护栏式断言：无代码路径写该文件） | 是 | `apps/api/tests/docs-guard/gold-review-guard.test.ts`（新） |

## 剧本 O / P / R / T（ops）

| 行号/步骤 | 覆盖表现态 | 源码现状（路径） | 今天缺的断言 | 可离线补 | 建议落点 |
|---|---|---|---|---|---|
| O2 | 部分测 | `apps/api/tests/ask/es-sparse.test.ts` · `apps/worker/tests/ingest/es-http.test.ts`（各自断言默认名 `strict_rag_dev`） | 无 Router 对象：可补「写/查默认名同源」的显式对照断言 | 是（弱断言，跨包不可 import） | `apps/worker/tests/ingest/es-http.test.ts`（补 it） |
| P1 | 部分测 | `apps/api/tests/gateway/bindings-http.test.ts`（PUT 同模 → 400）· `model-gateway.ts:176-214`（纯函数无 env 分档） | staging/prod **启动加载**同模失败（无启动加载器 / 真进程） | 否（阻塞：需真启动加载路径） | — |
| P3 | 部分测 | `tests/ask/verify-required.test.ts` · `apps/api/src/services/gateway/resolve.ts`（`ChatPurpose` 无 `judge_aux`） | 抽样路径仅 `judge_aux` 的隔离（源码无 online_sample 抽样链） | 否（阻塞：源码未做） | — |
| P6 | 部分测 | `apps/api/src/eval/adr046-snapshot.ts`（`PILOT_HARD_GATES` 无 `aux_*`）· `tests/eval/adr046-snapshot.test.ts` | 类型层「aux 与 min_support 不可互赋」（可用 type-only / `expectTypeOf` 断言） | 是 | `apps/api/tests/eval/adr046-snapshot.test.ts`（补 it） |
| R9 | 部分测 | `apps/api/tests/obs/quota-planes.test.ts:290-308`（`plane=ask` / complete `plane=ingest`）· `metrics.test.ts` | 入库 **embed** 打 `plane=ingest`（worker 侧无打点）+ TPM | 否（阻塞：需先在 worker embed 加打点） | — |
| T1 | 部分测 | `apps/api/src/eval/adr046-snapshot.ts`（`PILOT_HARD_GATES`）· `tests/eval/adr046-snapshot.test.ts` | 「未声明加严的 KB → 加载即试点默认包」的入口级断言（现只断言常量可打印） | 是 | `apps/api/tests/eval/adr046-snapshot.test.ts`（补 it） |
| T2 | 部分测 | `tests/eval/adr046-snapshot.test.ts`（`cRateMax` 放宽 → `looser` + `signedPackage=false`） | 无释放口：可补「放宽包不得写绑定 / 不得生效」的断言 | 是 | `apps/api/tests/eval/adr046-snapshot.test.ts`（补 it） |
| T3 | 部分测 | 同上（缺四要素 → 不得标已签字） | 「提案未绑定 L1 重跑 → 不得标 `stricter_than_pilot` 已签字」的绑定侧断言 | 是 | `apps/api/tests/eval/stricter-than-pilot-bind.test.ts`（补 it） |
| T4 | 部分测 | `tests/eval/adr046-snapshot.test.ts`（四要素齐 → `signedPackage`，注入布尔） | 真实签字流（业务/产品人签） | 否（阻塞：人签 / UAT） | — |
| T6 | 部分测 | `apps/api/src/eval/adr046-snapshot.ts:175,218`（只有写侧 + CLI）；**无运行时读取/加载入口** | 「篡改快照 → 拒绝加载或不一致告警」 | 否（阻塞：源码无读取/加载入口） | — |

## 剧本 AB / AC / AD（ops）

| 行号/步骤 | 覆盖表现态 | 源码现状（路径） | 今天缺的断言 | 可离线补 | 建议落点 |
|---|---|---|---|---|---|
| AB1 | 部分测 | `apps/admin/tests/ops/kb-settings-workspace.test.tsx`（权限/分级/部门勾选）· 页组件分区已存在 | 「分区齐全」清单（基本信息 / 文档类型 / 分片策略入口 / 问答档位 / 质量只读 / 会话锁） | 是 | `apps/admin/tests/ops/kb-settings-workspace.test.tsx`（补 it） |
| AB2 | 部分测 | `tests/kb/settings-http.test.ts`（PATCH 白名单 200）· `settings-audit-http.test.ts`（diff 行）· `tests/ask/mode-doc-types-gate.test.ts` | 「PATCH settings 后立刻 ask 用新 `allowedModes`」的同一 app 往返 | 是 | `apps/api/tests/kb/settings-http.test.ts`（补 it） |
| AB5 | 部分测 | `tests/kb/settings-http.test.ts`（GET 只读 `qualitySnapshot.tauClaim`）· admin 设置页质量只读区 | admin 页**无** τ 滑块/写入控件（RTL 负向） | 是 | `apps/admin/tests/ops/kb-settings-workspace.test.tsx`（补 it） |
| AB7 | 部分测 | **已具备**：`apps/api/tests/kb/doc-type-catalog-http.test.ts`（PATCH 后 GET settings 与成员 GET `/doc-types` 回读真 label） | 无新断言（如需可补 settings PATCH 版本） | 是（以回写为主） | 回写覆盖表 |
| AC2 | 部分测 | `apps/api/tests/gateway/bindings-http.test.ts`（三类模型可写入并绑定）；`model-gateway.ts` 无「缺一类即拒 Provider」闸 | 「缺 llm/embedding/rerank 任一类 → 拒保存 Provider」在源码无落点（Then 字面只要求「各至少一启用可保存」） | 否（阻塞：源码无该闸，须先裁口径） | — |
| AC4 | 部分测 | `bindings-http.test.ts`（同模 400 / 文案含 judge） | staging/prod **启动/加载**同模失败（同 P1） | 否（同 P1 阻塞） | — |
| AC6 | 部分测 | `apps/api/tests/kb/kb-consume-bindings-http.test.ts`（KB PUT 200 / judge 400）· `tests/gateway/resolve-mock.test.ts`（`mergeBindingRows` 覆盖） | 「ask / 入库解析实际用 KB 选择」的端到端（KB PUT 后解析结果 = KB ref） | 是 | `apps/api/tests/gateway/resolve-mock.test.ts`（补 it） |
| AD5 | 部分测 | `tests/acl/platform-users-roles.test.ts`（建用户 + 绑角色 201）· `tests/acl/me-permissions.test.ts`（模板角色并集） | 「建用户 + 绑**自定义**角色 → `/me/permissions` = 该角色并集」链路 | 是 | `apps/api/tests/acl/platform-users-roles.test.ts`（补 it） |
| AD9 | 部分测 | `packages/admin-catalog/src/menu-tree.ts`（无「系统设置」href）· `tests/acl/catalog-clip.test.ts` | 「模型 Key 不在系统域」的菜单/域归属结构断言 | 是 | `packages/admin-catalog/tests/acl/catalog-clip.test.ts`（补 it） |
| AD10 | 部分测 | `apps/api/tests/gateway/bindings-http.test.ts`（GET 无明文）· `packages/contracts/tests/system/model-gateway-contract.test.ts`（`hasApiKey`）· `models-workspace.tsx`（`type=password`） | admin 供应商页 Key 掩码 RTL | 是 | `apps/admin/tests/ops/models-workspace.test.tsx`（新） |

## 边界行（阶段列非「P2必签」，但与 P2 出口相关；单独列出，不计入上面 94 行）

| 行号/步骤 | 覆盖表现态 | 源码现状（路径） | 今天缺的断言 | 可离线补 | 建议落点 |
|---|---|---|---|---|---|
| C1 | 部分测（签字剧） | `apps/api/tests/eval/l1-matrix.test.ts` · `l1-cli.test.ts` · `http-eval-runs.test.ts` · `apps/worker/tests/eval/run-l1-batch.test.ts` · `fixtures/l1/gold.yaml` | live 固定 seed 真跑 2×2 数字 + 业务题面人审 | 否（阻塞：live 真人签） | — |
| C2 | 部分测（签字剧） | `packages/contracts/tests/eval/l1-tau-sweep.test.ts` 等 | live 真跑 τ 扫描、把 τ* 接到运行时 | 否（阻塞：live + 运行时接线未做） | — |
| C3 | 部分测（签字剧） | `packages/contracts/tests/eval/l1-judge-auroc.test.ts` · `fixtures/l1/judge-calibration.json` | live judge 真跑 AUROC、接入签字公式 | 否（阻塞：live + 人签） | — |
| C4 | 部分测（签字剧） | `packages/contracts/tests/eval/l1-hit-at-k.test.ts` | 逻辑 id→uuid 映射 | 是（可离线补映射层断言） | `packages/contracts/tests/eval/l1-hit-at-k.test.ts`（补 it） |
| N2 | 缺测（P2部署必过） | `apps/worker/src/ingest/mongo-body.ts` · `apps/worker/tests/ingest/mongo-body.test.ts`（只测空 URL 走 local） | 「Mongo 读写无应用层字段 encrypt wrapper」的护栏断言 | 是 | `apps/worker/tests/ingest/mongo-body.test.ts`（补 it） |
| S6 | 缺测（建议） | `apps/admin/src/lib/kb-context.ts`（手填 uuid）；菜单按全局码裁剪 | 切换 KB 后写菜单隐藏 / 写路由 403 | 是（RTL / 服务层断言） | `apps/admin/tests/shell/kb-switch-write.test.tsx`（新） |
| Z3 | 缺测（建议） | `apps/admin/src/app/(ops)/chunks/_components/chunks-workspace.tsx`（`loadChunkBody` 仅 `onOpenChunk`） | 未点详情不得预拉全部 chunk body（RTL / 网络抽检） | 是 | `apps/admin/tests/ops/chunks-workspace.test.tsx`（新，与 Z4 同文件） |

---

## 建议补测批次

### 批 1 · 信任环收口（ask 图 / 会话 / 建库）
- **包含行（11）**：A1 · A2 · A3 · A4 · D-fast · D3 · H5 · H6 · K1 · U2 · U5
- **预计新增测例**：12–13 条 `it`（A1 拆「建库+绑模型」「解析用 KB 绑定」两条）
- **落点清单**：`apps/api/tests/kb/create-kb-with-models.test.ts`（新）· `apps/api/tests/ingest/upload-to-active-retrievable.test.ts`（新）· `apps/api/tests/ask/answer-kind.test.ts`（新）· `apps/api/tests/ask/abstain-suggested-actions.test.ts`（新）· `apps/api/tests/ask/false-premise.test.ts`（新）· `apps/api/tests/ask/gateway-chain-fail.test.ts`（新）· `apps/api/tests/ask/route-rules.test.ts`（补）· `apps/api/tests/ask/http-stream.test.ts`（补）· `apps/api/tests/ask/evidence-verbatim.test.ts`（补）· `apps/api/tests/sessions/http.test.ts`（补）；同步登记 `apps/api/tests/index.md`
- **为什么排第一**：backlog 点名的第一优先；全部离线可绿；夹具（`apps/api/tests/ask/_support/graph-harness.ts`、`tests/sessions/http.test.ts` 内存仓）现成，单文件即可闭环；A3/A4/H5/K1 只需补断言，不引入新模式。

### 批 2 · 入库闸与双就绪（worker 为主）
- **包含行（19）**：L1 · L2 · L3 · L4 · L5 · L9 · M1 · M2 · M5 · M6 · Q1 · Q2 · Q5 · Q10 · V1 · V2 · V6 · V8 · AA6
- **预计新增测例**：约 20 条 `it`
- **落点清单**：`apps/worker/tests/ingest/dual-ready-embeddings-parity.test.ts`（新）· `es-fail-not-ready.test.ts`（新）· `es-retry-recover.test.ts`（新）· `reindex-atomic-switch.test.ts`（新）· `embed-es-order.test.ts`（新）· `scan-infected-effects.test.ts`（新）· `pdf-text-to-ready.test.ts`（新）· `scan-vs-ocr-startup.test.ts`（新）· `apps/worker/tests/ingest/job-ledger.test.ts`（补）· `apps/worker/tests/ingest/ocr-gate.test.ts`（补）· `apps/api/tests/ingest/complete-size-http.test.ts`（新）· `complete-head-authority.test.ts`（新）· `complete-no-scan-enqueue.test.ts`（新）· `no-forged-ready.test.ts`（新）· `reindex-version.test.ts`（新）· `apps/api/tests/ask/needs-ocr-not-retrievable.test.ts`（新）· `apps/api/tests/ask/pending-not-retrievable.test.ts`（新）· `packages/contracts/tests/async/ingest-job.test.ts`（补）· `apps/admin/tests/ops/documents-needs-ocr.test.tsx`（新）；登记三包 `tests/index.md`
- **为什么排第二**：入库闸是 P2 出口硬门（L/M/V + Q）；worker 内存 db（见 `contextualize-fallback-ready.test.ts` 的 harness）与 mock ES 已足够离线跑全链；L4 与 AA6 共用同一 `reindex` 夹具，一次搭好可覆盖两行。

### 批 3 · 鉴权矩阵与运营壳（api / admin / admin-catalog）
- **包含行（38）**：B1-2 · B1-3 · B1-5 · B1-8 · B1-A3 · S2 · S3 · S5 · S8 · S9 · Y2 · Y3 · Y5 · W6 · W8 · Z4 · Z5 · Z6 · Z8 · AE1 · X2 · X7 · G1 · G2 · G3 · O2 · P6 · T1 · T2 · T3 · AB1 · AB2 · AB5 · AB7 · AC6 · AD5 · AD9 · AD10
- **预计新增测例**：约 40 条 `it`（其中「enforce=true 权限矩阵」一个新夹具吃掉 B1-2 / B1-8 / S2 / S8 / Y3 五行）
- **落点清单**：`apps/api/tests/auth/enforce-permission-matrix.test.ts`（新）· `apps/api/tests/acl/members-http.test.ts`（补）· `apps/api/tests/acl/kb-member-gate.test.ts`（补）· `apps/api/tests/acl/kb-scope-write-isolation.test.ts`（新）· `apps/api/tests/ops/dashboard-http.test.ts`（补）· `apps/api/tests/acl/grant-dashboard-view.test.ts`（新）· `apps/api/tests/ingest/complete-pending-role.test.ts`（新）· `apps/api/tests/ingest/chunks-http.test.ts`（补 Z5/Z6）· `apps/api/tests/ask/scope-hr-excludes-finance.test.ts`（补）· `apps/api/tests/ask/citations.test.ts`（补）· `apps/api/tests/feedback/http.test.ts`（补）· `apps/api/tests/docs-guard/gold-review-guard.test.ts`（新）· `apps/api/tests/eval/adr046-snapshot.test.ts`（补）· `apps/api/tests/eval/stricter-than-pilot-bind.test.ts`（补）· `apps/api/tests/kb/settings-http.test.ts`（补）· `apps/api/tests/gateway/resolve-mock.test.ts`（补）· `apps/api/tests/acl/platform-users-roles.test.ts`（补）· `apps/worker/tests/ingest/es-http.test.ts`（补）· `apps/web/tests/ask/no-upload-surface.test.tsx`（新）· `apps/admin/tests/ops/kb-settings-workspace.test.tsx`（补）· `apps/admin/tests/ops/chunks-workspace.test.tsx`（新）· `apps/admin/tests/ops/feedback-workspace.test.tsx`（新）· `apps/admin/tests/ops/models-workspace.test.tsx`（新）· `packages/admin-catalog/tests/acl/catalog-clip.test.ts`（补）
- **为什么排第三**：余量最大但价值密度低于前两批；其中 5 行依赖先建「`AUTH_ENFORCE=true` 权限矩阵」夹具，先做夹具再铺行最省；其余为 RTL / HTTP 断言的机械补齐。

### 批 4 · 覆盖表回写、边界护栏与阻塞登记
- **包含行**：
  - 回写（11 行，**不新增测例**，只需把覆盖表状态改对）：E4 · E5 · L7 · V3 · O4 · R10 · AA1 · AB8 · AC7 · V4 · Q4
  - 边界护栏（3 行新增护栏）：N2 · S6 · Z3
  - 阻塞登记（23 行，写入本文件与 backlog 指针即可）：D-拼句 · H1 · H5b · H5d · H5e · U8 · J7c · E1 · E2 · M8 · S1 · S4 · Y6 · X4 · X5 · V5 · T4 · T6 · P1 · P3 · R9 · AC2 · AC4（另 C1–C3 属签字剧 live/人签）
- **预计新增测例**：3–4 条 `it`（N2 · S6 · Z3；C4 可选 1 条）
- **落点清单**：`apps/worker/tests/ingest/mongo-body.test.ts`（补）· `apps/admin/tests/shell/kb-switch-write.test.tsx`（新）· `apps/admin/tests/ops/chunks-workspace.test.tsx`（同批 3 的 Z4/Z8）· 覆盖表 `docs/testing/coverage/00-ask.md` `01-ingest.md` `02-acl.md` `03-ops.md`
- **为什么最后**：这一步不产出新证据，却是「防高估」的关键——今天覆盖表把 11 行已具备写成欠债、又把 ask/ingest/acl/ops 四处汇总数写错；先回写再排下一批，可避免按过期表重复铺测。被源码阻塞的 23 行必须显式登记（改源码或回 PRD 裁口径），不得用假测填绿。
