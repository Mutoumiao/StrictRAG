# P2 出口缺口 · 源码事实核查（HEAD）

## 核查方法与已读文件清单

**方法**：只读核查。以源码为唯一准绳，逐条把剧本 Then 反查到 `路径:行号`；无命中即明说「未找到」并列出关键词。对 `.trellis/tasks/08-06-project-backlog/research/coverage-gap-impl.md`（2026-08-24）的「源码缺口（IS）」列做**滞后校验**，不采信其结论本身，只当搜索入口。

**已读文件**（均为本轮 READ 到内容）：

- 背景/工单：`.trellis/tasks/08-06-project-backlog/research/coverage-gap-impl.md`；`.scratch/close-p2-exit-gaps/map.md` 与 `issues/03-dec-active-version.md` · `04-dec-pending-review.md` · `08-qual-k5-langfuse-acl.md` · `09-qual-l7-orphan-clean.md` · `10-qual-e4-pending-review.md` · `11-qual-e5-contextualize-evidence.md` · `13-qual-aa1-kb-strategy-params.md`
- 验收剧本：`prds/10-delivery/03-acceptance-scenarios.md`（关键词扫读）
- api：`src/app.ts` · `src/env.ts` · `src/logger.ts` · `src/auth/middleware.ts` · `src/auth/permissions/resolve.ts` · `src/obs/{index,metrics,memory-tracer,ask-tracer}.ts` · `src/middleware/admin-write-audit.ts` · `src/routes/{ask,kb-settings,chunk-strategies,ingest-report,dashboard,eval}.ts` · `src/services/{kb-settings,kb-settings-audit,chunk-strategy-catalog,chunk-strategies,ask/traces,ask/execute,ask/index,retrieve/corpus,document-delete,document-supersede,dashboard,superadmin-bootstrap}.ts` · `src/eval/adr046-snapshot.ts` · `src/scripts/run-l1-golden.ts`
- worker：`src/index.ts` · `src/queues.ts` · `src/env.ts` · `src/ingest/{pipeline,cross-doc-dedupe,contextualize-http,es-http,es-store,ingest-report,purge}.ts`
- packages：`packages/db/src/schema/kb/{documents,chunks,knowledge-bases,ingest-reports}.ts` · `packages/db/src/query/retrieval-gate.ts` · `packages/contracts/src/kb/kb-settings.contract.ts` · `packages/contracts/src/ingest/{document,ingest-report,chunk-strategy,chunk-strategy.contract}.ts` · `packages/admin-catalog/src/role-templates.ts`
- 测例：`apps/api/tests/ask/http-audit.test.ts` · `apps/api/tests/kb/{chunk-strategy-audit,chunk-strategies-http}.test.ts` · `apps/worker/tests/ingest/{context-mode-obey,contextualize-http,cross-doc-dedupe}.test.ts`（另经 grep 定位 `cross-doc-skip-index` · `ingest-report` · `ocr-rerun` 等）
- 状态镜像/派生：`docs/testing/coverage/{00-ask,01-ingest,02-acl,03-ops}.md` · `docs/module-status/{api,worker,db,contracts,admin}.md`（仅作对照，不作结论依据）

---

## 总览判定

| ID / 前置 | 判定 | 一句话 |
|-----------|------|--------|
| QUAL-K5 | **真未做** | `/ask/:requestId` 审计口有成员闸，但 `super_admin`（= `platform_admin`）旁路成员，仍能看到 evidence `preview` 明文；Langfuse/mock trace、Pino、`/metrics`、dashboard、settings-audit 均不带明文 |
| QUAL-E4 | **部分已做** | 「指标可见」已满足（`dedupeCrossDocRate` 落库 + API + admin 展示）；`pending_review` 的落点/端点/KB 策略位**三处仍无** |
| QUAL-E5 | **部分已做**（源码满足，缺测） | `contextualize-http.ts` + `INGEST_CONTEXTUALIZE_MODE` + 逐块回退 + 计数落库均在；缺「文档仍 `ready`」端到端断言，且无 5xx/超时管线级注入 |
| QUAL-L7 | **真未做** | 只有对账报告 `orphan`，无清理 job、无周期触发；`documents.index_version` 在 chunk 段即 `+1`，失败后指向失败版本 |
| QUAL-AA1 | **部分已做** | 策略参数可保存 + 审计已由 88 覆盖；「旧文档 version/边界不变」只有「未调用文档写仓」的代理断言，无数据级断言 |
| 前置一 | **未冻** | 无独立「激活 version」表示；`documents.index_version` 在 chunk 段即 `+1`，检索闸直接读它 → reindex 失败后**没有**可信的「仍在被检索版本」 |
| 前置二 | **三处仍无** | `pending_review` 非状态枚举、无列、无端点、无 `config_json` 开关 |
| 前置三 | **仍写死 null** | `gatePackageId` / `effectiveAt` 唯一生产者 `defaultQuality()` 恒 `null`；真快照落 `artifacts/l1-gate-snapshot.json`（文件，未回灌设置） |

---

## QUAL-K5：非成员 platform_admin 读 trace / 审计无明文

**判定**：**真未做**。审计/回溯读面（`GET /ask/:requestId`、`GET /ask/:requestId/final`）有成员闸，但 `super_admin` 旁路成员闸——而 `platform_admin` 正是 `super_admin` 的平台角色标签，故「非 kb_member 的 platform_admin」当前**能看到**该 KB evidence `preview` 明文。既有测例甚至把这一行为钉成正向断言。其余出口（Langfuse mock、Pino、`/metrics`、dashboard、settings-audit、memory tracer）逐个核查**均不带 evidence 明文**。缺口 = 缺「对非成员平台管理员遮蔽/拒绝 evidence 明文」的闸，而非缺默认开关。

**依据（文件行）**：

- 审计口挂载与成员闸：`apps/api/src/routes/ask.ts:448`（`requireAuth()`）→ `:460`（`evaluateKbMember(c, trace.kbId, …)`）；终态口同构 `:480` · `:492`。
- 成员闸的旁路：`apps/api/src/auth/middleware.ts:239-242`（`roleBypassesKbMembership(auth.roles)` 直接 `{ ok: true }`）；实现 `packages/admin-catalog/src/role-templates.ts:81-83`，唯一 `bypassKbMembership: true` 的是 `super_admin`（`:40-45`）。
- `platform_admin` = `super_admin`：`apps/api/src/routes/auth.ts:55`（`platformRole: role === 'super_admin' ? 'platform_admin' : 'user'`）、`apps/api/src/services/superadmin-bootstrap.ts:173-179`（建超管写 `platformRole: 'platform_admin'`）、`packages/db/src/schema/system/users.ts:15`（`platform_admin | user` 兼容锚点）。
- evidence 明文载体：`apps/api/src/services/ask/traces.ts:128-136`（`toAskAudit` 回 `evidenceSnapshot[].preview`，仅按 `EVIDENCE_SNAPSHOT_PREVIEW_MAX` 截断，**不按成员裁**）。
- Langfuse / mock export **不带明文**：`apps/api/src/obs/ask-tracer.ts:65-75`（仅记 `spans.map(s => s.name)` + `scores`）；`apps/api/src/obs/memory-tracer.ts:23` · `:27`（`getTraceRecord` / `listTraceRecords` 仅进程内，**未挂任何 HTTP 路由**，全仓仅测例引用）。
- 图上 span 属性**不带正文**：`apps/api/src/graph/run.ts:271`（`ask.route` 仅 `questionLen`）等；`ask.generate` / `ask.verify` 无 evidence 文本属性。
- Pino **不带正文**：`apps/api/src/services/ask/execute.ts:282-290`（`ask execute done` 仅 status/reason/latency/spanCount）；`graph/` 目录无 `logger` 调用（grep 无命中）。
- `/metrics` **无鉴权但不带明文**：`apps/api/src/app.ts:78-80`（`app.get('/metrics', … metricsSnapshot())`，注释「P2 无鉴权」）；`apps/api/src/obs/metrics.ts:49-52`（快照是 `Record<string, number>` 计数器）；`recordAskResult` 标签仅 status/reason/plane（`:63-68`）。
- dashboard 只读计数：`apps/api/src/routes/dashboard.ts:26-37`；`apps/api/src/services/dashboard.ts:53-100`（仅 count/latency）。
- KB 审计面（settings-audit）**不带 evidence**：`apps/api/src/services/kb-settings-audit.ts:22-33`（diff 形状）；路由 `apps/api/src/routes/kb-settings.ts:164-172`（`kb.config.write` + 成员）；写侧操作日志 `apps/api/src/middleware/admin-write-audit.ts:50-65`（payload 只 method/path/status/durationMs，注释「不含 body / 密钥」）。

**现有测例**：

- `apps/api/tests/ask/http-audit.test.ts:200-209`「非该 KB 成员 403」——**只覆盖非超管**。
- `apps/api/tests/ask/http-audit.test.ts:226-236`「超管可旁路成员闸回读」——**正面断言非成员超管 200 且拿得到快照**，与 K5 的 Then 相反。
- `apps/api/tests/obs/tracer.test.ts`（引用 `getTraceRecord`）——只测 span 记录，非鉴权面（coverage 03-ops.md:175 亦如此标注）。
- 未找到「非成员 platform_admin 无明文」断言；已搜关键词 `platform_admin`、`evidenceSnapshot`、`preview`、`not a knowledge base member`。

**建议**：**需先出决定**。`docs/module-status` 与剧本未写明「platform_admin 是否等于 super_admin」；若按 K5 原文只对 `platform_admin` 收严而不动 `super_admin`，与 `http-audit.test.ts:226` 直接冲突。须先裁定口径（是否允许超管看明文、是否只对 `preview` 做遮蔽），再最小实现「非成员出口遮蔽或拒绝」。

---

## QUAL-E4：pending_review 人工处理

**判定**：**部分已做**。前半句「跨 doc 近重复 · 指标可见」**已满足**：跨文档判定在 `cross-doc-dedupe.ts`，报告落 `dedupeCrossDocRate`，API 与 admin 均可见。后半句 `pending_review` 属**真未做**：落点 / 人工处理端点 / KB 策略位**三处仍无**（详见「前置二」）。此外跨 doc 判定**已不止 chunk 内 `seen`**——`seen` 只做文档内精确去重，跨文档近重复走独立模块。

**依据（文件行）**：

- 跨 doc 判定位置：`apps/worker/src/ingest/cross-doc-dedupe.ts:53-66`（`findCrossDocConflict`，字 3-gram Jaccard ≥ 0.9）；语料装载 `:70-116`（`loadCrossDocSearchableChunks`，仅同 KB、`status=ready`、lifecycle ∈ {draft, active}、`indexVersion>0`）。
- 管线接线：`apps/worker/src/ingest/pipeline.ts:528-531`（装载 corpus，`excludeDocId` 自身）；文档内精确去重 `:545-551`（chunk 内 `seen`）；跨文档命中即 `skip_index` 并计入冲突对 `:552-556`。
- 指标可见（Is met）：`apps/worker/src/ingest/ingest-report.ts:47-55`（`dedupeCrossDocRate`，分母 0 → `null`）；DB 列 `packages/db/src/schema/kb/ingest-reports.ts:30`；API 映射 `apps/api/src/services/ingest-reports.ts:45`；路由 `apps/api/src/routes/ingest-report.ts:30-38`；admin 展示 `apps/admin/src/app/(ops)/documents/_components/documents-workspace.tsx:1193-1194`。
- `pending_review` 三处仍无：
  - 落点：`packages/contracts/src/ingest/document.contract.ts:6-17`（状态枚举无 `pending_review`，只有 `needs_review`）；`packages/db/src/schema/kb/ingest-reports.ts:13`（注释「不含 pending_review」）；`knowledge-bases.ts` 无该列。
  - 端点：`apps/api/src/routes/` 下 17 个路由文件无 `pending_review` 命中；权限码（`packages/admin-catalog`）无对应码。
  - KB 策略位：`packages/db/src/schema/kb/knowledge-bases.ts:6-13`（`config_json` 为自由 jsonb），但 `apps/api/src/services/kb-settings.ts` 的解析只认 `allowedModes/defaultMode/docTypes/docTypeItems/dataClass/deptInheritDown/deptAclEnforce`，**无去重相关位**。

**现有测例**：

- `apps/worker/tests/ingest/cross-doc-dedupe.test.ts`（`isCrossDocNearDup · findCrossDocConflict · loadCrossDocSearchableChunks`）；`apps/worker/tests/ingest/cross-doc-skip-index.test.ts`（skip_index + 冲突对 + 跨 KB/archived 不比）。
- 负向拒绝：`packages/contracts/tests/ingest/ingest-report-contract.test.ts:91`（拒 `pending_review` 装齐字段）；`packages/db/tests/ingest/ingest-reports-schema.test.ts:30`（表不得暴露 `pending_review` 列）。
- 未找到「pending_review 放行/驳回」「非成员拒绝」测例；已搜关键词 `pending_review`。

**建议**：**需先出决定**。`issues/04-dec-pending-review.md` 已把三处列为本图裁定项；未冻前实现会与 `ingest-report-contract` / schema 的「拒绝 pending_review」负向断言对撞。指标部分无需再动。

---

## QUAL-E5：L1 contextualize 故障 → L0 回退仍 ready

**判定**：**部分已做 —— 源码满足剧本，缺/弱在测**。实现全在（OpenAI 兼容 chat、temp=0、冻结模板、非 2xx / 网络 / 畸形 / 空 / 超长一律抛；逐块调用、任一块失败回退 L0 不阻断；两计数落库）。但**「文档仍 `ready`」这条 Then 无端到端断言**：既有注入测例只跑到 `chunk` 段，断言「块仍入库 + `l0_fallback` + 计数 (0,1)」，不驱动到 `es_index` 后的 `status=ready`。另 5xx 未单独注入、超时无注入点（`contextualizeChunk` 无 `AbortSignal`/timeout 参数）。可判「部分已做（源码满足剧本 Then，缺 ready 断言）」。

**依据（文件行）**：

- 实现：`apps/worker/src/ingest/contextualize-http.ts:57-101`（`contextualizeChunk`；`:92` 非 2xx 抛、`:100` 畸形抛）；`normalizePrefix` `:32-50`（空 `:42-44`、超长 `:46-49` 抛）；`buildContextualizeUserPrompt` `:20-30`（PRD §4.1 字段）。
- 默认关：`apps/worker/src/env.ts:53`（`INGEST_CONTEXTUALIZE_MODE: z.enum(['off','http']).default('off')`）。
- 逐块回退：`apps/worker/src/ingest/pipeline.ts:534-543`（仅 `l1_llm ∧ mode=http` 才建 L1）；`:559-568`（`try { prefix = await contextualizeChunk(...); l1Ok += 1 } catch { l1Fallback += 1; log.warn }`，块继续入库）。
- 计数落库与口径：`apps/worker/src/ingest/pipeline.ts:600-619`（`contextSource` 与两计数同口径；`l1` 未建时整轮计回退，防「情境 l0_fallback · L0 回退 0」）；落库 `apps/worker/src/ingest/ingest-report.ts:80-81` · `:138-140`（后阶段不复写已记值）。
- 双就绪 → ready：`apps/worker/src/ingest/pipeline.ts:935-941`（`es_index` 成功才 `status='ready'`）。

**现有测例**（逐条列出断言对象）：

- `apps/worker/tests/ingest/contextualize-http.test.ts:79-90`「429 / 网络错 / 畸形响应都抛」——注入 `{ok:false,status:429}`、`ECONNRESET`、`json:{}`；只断言 `rejects.toThrow`。
- `:96-108`「空输出 / 超长输出都抛」——`'   \n  '` 与超长串；只断言抛。
- `:110-116`「缺 `GATEWAY_BASE_URL` 直接抛（不发请求）」。
- `apps/worker/tests/ingest/context-mode-obey.test.ts:235-246`「失败（429）：回退 L0 prefix，报告 l0_fallback，块仍入库」——**管线级唯一故障注入**，断言 `chunks.length=1`、`contextPrefix='考勤制度'`、`contextSource='l0_fallback'`、计数 `(0,1)`；**不断言文档 `ready`**（chunk 段本就不会 ready）。
- `apps/worker/tests/ingest/context-mode-obey.test.ts:216-231`（成功路径）、`:247-257`（`l0_template` 不调 LLM）。

**哪条 Then 尚无断言**：「文档仍 `ready`」——无任何测例把 contextualize 故障串到 `chunk→embed→es_index` 并断言 `status==='ready'`。5xx（500/503）未单独注入，**超时**因 `contextualizeChunk` 无超时参数而**无注入点**。

**建议**：**可直接开工**（补测）。按 E5 补故障注入测：管线级 500 / 超时（需先给 `contextualizeChunk` 加可注入 timeout 或 `fetchImpl` 抛出 `AbortError`）/ 畸形 / 空串各一条，断言走完全链后 `status='ready'` 且 `contextSource='l0_fallback'`、两计数口径自洽。**未验证真 Gateway** 的事实须如实写出。

---

## QUAL-L7：孤儿清理 job（激活版永不删）

**判定**：**真未做**。全仓只有「对账报告 orphan」（`reconcileIndexed` / `mockEsStore.reconcile`）与 mock ES 的 `dropDoc`（整文档全版本删除，属 purge），**没有任何清理半写非激活 version 的 job**，也无周期调度。前置「激活版不可断言」**仍然成立**（见「前置一」）：`documents.index_version` 在 chunk 段即 `+1`，reindex 失败后指向失败版本，硬做会误删/误判。

**依据（文件行）**：

- 无清理 job：`apps/worker/src/index.ts:86-107`（ingest worker 只 `runIngestStage` + 链式 `enqueue`，无 cleanup 分支）；`apps/worker/src/queues.ts` 阶段集来自 contracts（scan/parse/ocr/chunk/embed/es_index/purge），**无 orphan 阶段**；全仓无 `Repeatable`/`cron`/`schedule` 调用（grep 仅命中 `pnpm-lock.yaml` 依赖名）。
- 现有 orphan 相关实现：`apps/worker/src/ingest/es-http.ts:72-80`（`reconcileIndexed` 返回 `{missing, orphan}`）；`apps/worker/src/ingest/es-store.ts:43-51`（`reconcile`）· `:28-33`（`dropDoc` 按 `docId:` 前缀删**全部** version）。
- 报告侧：`apps/worker/src/ingest/ingest-report.ts:86-88`（`reconcileOrphan` 落库）。
- `documents.index_version` 写入时机（关键前置）：`packages/db/src/schema/kb/documents.ts:34`（`indexVersion … default(0)`）；`apps/worker/src/ingest/pipeline.ts:504`（chunk 段 `const indexVersion = (doc.indexVersion || 0) + 1`）→ `:658-661`（`setDoc({ indexVersion, embedReady: 0, esReady: 0 })`，**在 chunk 段就落地**）；`embed` 段 `:788`、`es_index` 段 `:936-941` 再写同值。
- reindex 失败路径**不回退 version**：`embed` 失败 `:686-696`（只改 `status/errorCode/embedReady`，不动 `indexVersion`）；`es_index` 失败 `:825-834` · `:908-933`（同）。
- `chunks.index_version`：`packages/db/src/schema/kb/chunks.ts:12`（`indexVersion` notNull）；写入 `pipeline.ts:576`。
- mock ES 侧无 `index_version` 字段：`apps/worker/src/ingest/es-store.ts:9-11`（键 `docId:vN`，非文档字段）。
- purge 只清整文档：`apps/worker/src/ingest/purge.ts:27-35`（`deleteObject` + `dropSparse` + `deleteMongoBodies` + patch archived），**非按 version 清**。
- 派生对照亦标注缺实现：`docs/testing/coverage/01-ingest.md:33`（L7「缺实现 · 无清理 job」）。

**现有测例**：

- `apps/worker/tests/ingest/es-http.test.ts:51-55`（`reconcileIndexed` 报 missing/orphan）；`apps/worker/tests/ingest/dual-ready-index.test.ts:12-33`（集合一致才 ok、文档间不污染）；`apps/worker/tests/ingest/purge.test.ts`（整文档 purge 幂等）。
- 未找到「清理 job」「不碰激活版」任何断言；已搜关键词 `orphan`、`对账`、`clean`、`Repeatable`、`cron`。

**建议**：**需先出决定**。本票 Blocked by 03（「激活 version」表示）。在 03 冻结前不得动手清理；且周期触发依赖尚不存在的调度基建，应**明说留待**，只落可手工/可入队的一次性路径。

---

## QUAL-AA1：KB 策略参数可保存 + 审计（旧文档不变）

**判定**：**部分已做**。①「参数可保存」**已由 88 覆盖**（走 `PATCH /knowledge-bases/:kbId/chunk-strategies` 的 `paramOverrides`，非 `PATCH /settings`——settings 白名单确实没有策略参数，但策略参数另有专属保存面）；②「审计」**已覆盖**（diff 落 `kb_settings_audits`，键形如 `chunkStrategy.<code>.<field>`）；③「旧文档 chunk 边界 / version 不变」**只有代理断言**（证明 PATCH 未调用文档写仓），**无数据级断言**（未断言既有文档 `index_version` 与 `chunk_manifests`/chunk 集合不动）。

**依据（文件行）**：

- ① 保存路径：`apps/api/src/routes/chunk-strategies.ts:95-131`（PATCH → `applyKbChunkStrategyPatch` → 回读 catalog）；`apps/api/src/services/chunk-strategy-catalog.ts:262-327`（`applyKbChunkStrategyPatch`，只写 `kb_chunk_strategies`；`:276-279` 用 `invalidContextModeOverride` 校验 `contextMode`）。
- 「settings 白名单无策略参数」属实：`packages/contracts/src/kb/kb-settings.contract.ts:109-140`（`PatchKbSettingsBodySchema.strict()`，可写字段仅 name/description/allowedModes/defaultMode/docTypes/docTypeItems/dataClass/deptInheritDown/deptAclEnforce）；策略参数白名单在 `packages/contracts/src/ingest/chunk-strategy.contract.ts:58-66`（`PatchKbChunkStrategyItemSchema`：`code/enabled/recommendedFamilies/paramOverrides`）。
- ② 审计覆盖层级：`apps/api/src/routes/chunk-strategies.ts:110-131`（有 diff 才落）；`apps/api/src/services/kb-settings-audit.ts:38-63`（`insert` 写 `kb_settings_audits`）+ `apps/api/src/routes/kb-settings.ts:163-172`（回读端点）。**层级 = KB 库启用表**（`kb_chunk_strategies`），**非文档级**；文档级仅 `GET /documents/:docId` 只读回显（`apps/admin/src/app/(ops)/documents/list.services.ts:45`）。
- diff 键形：`apps/api/src/services/chunk-strategy-catalog.ts:309`（`chunkStrategy.<code>.enabled`）· `:314-317`（`.recommendedFamilies`）· `:320-323`（`.paramOverrides`）。
- ③ 代码层保证（非测）：`apps/api/src/services/chunk-strategy-catalog.ts:261-262`（注释「只动 `kb_chunk_strategies`：旧文档 `index_version` 与参数快照不变」）；`apps/api/src/services/chunk-strategies.ts:101-112`（`shouldRetainExistingStrategy` 旧文档不自动切）· `:118-171`（`resolveDocumentChunkStrategy`）。

**现有测例**：

- `apps/api/tests/kb/chunk-strategy-audit.test.ts:130-155`「contextMode 有 diff → 记 paramOverrides 旧→新，且不碰文档版本与快照」——断言 `auditRows[0].diff` 精确形状，且 `docWrites.setChunkStrategy` / `markCompletePending` **未被调用**（`:149-150`）。这是**代理**（未触达文档写仓），**未**断言既有文档 `index_version` / chunk 边界数值。
- `apps/api/tests/kb/chunk-strategies-http.test.ts`（catalog / for-upload / PATCH 回读 / 400）；`apps/api/tests/kb/chunk-strategy-audit.test.ts:115-128`（无 diff 不落）。
- `apps/api/tests/ingest/chunk-strategies.test.ts:58-135` · `:173-182`（旧文档不自动切换/保留旧策略，纯函数）；`apps/api/tests/ingest/reindex-strategy.test.ts:127`（省略策略保留）。
- 未找到「旧文档 `index_version` / chunk 边界不变」数据级断言；已搜关键词 `不变`、`旧文档`、`边界`、`retain`、`保留`。

**建议**：**可直接开工**（只补第 ③ 条的数据级测）。前两条已具备，**禁止**写新实现充数；补测须构造既有 ready 文档 + 记下其 `index_version` 与 chunk 集合，PATCH 策略参数后断言两者逐位不变（且未生成新 `chunk_manifests`）。

---

## 前置一：文档「当前激活 version」表示

**判定**：**未冻，且无独立表示**。`documents.index_version` 在 **chunk 段**即 `+1`（不是双就绪后才切），无 `active_index_version` 列、无激活表、无派生字段；检索闸直接拿 `c.indexVersion === doc.indexVersion` 过滤。因此 **reindex 失败后「哪一版仍在被检索」不可断言**：失败时 `doc.index_version` 已指向失败版本，旧版本数据虽仍在 PG/ES，但被检索闸排除（即**旧版不再被检索**，与新票 premise 的「上一可检索版本仍在服务」相反）；`status=ready` 只在 `es_index` 成功时写，**不能**单独当「激活版」凭据。

**依据（文件行）**：

- 列定义：`packages/db/src/schema/kb/documents.ts:34`（`index_version`，唯一 version 列）。
- 写入时机：`apps/worker/src/ingest/pipeline.ts:504`（chunk 段 `doc.indexVersion + 1`）→ `:658-661`（同段落 `indexVersion` + 重置 `embedReady/esReady`）；`embed` `:788`、`es_index` `:936-941` 再写同值。
- 失败不回退：`pipeline.ts:686-696`（embed 失败）· `:825-834` / `:908-933`（es 失败）均不改 `indexVersion`。
- 取值语义 / 检索闸：`apps/api/src/services/retrieve/corpus.ts:107-112`（`仅当前 indexVersion`；`c.indexVersion === doc.indexVersion`）；`:126-130`（embedding 也须同 version）。
- `ready` 绑定：`apps/worker/src/ingest/pipeline.ts:935-941`（双就绪才 `status='ready' ∧ lifecycle='draft'`）；闸谓词 `packages/db/src/query/retrieval-gate.ts:11-12`（`status==='ready' ∧ lifecycle==='active'`）。
- 无独立表示：全仓 grep `active_index_version` / `activeIndexVersion` / `activeVersion` **未命中源码**（仅 `product.pen` 文案与 coverage 文档措辞）。`chunks.index_version` 见 `packages/db/src/schema/kb/chunks.ts:12`；`chunk_manifests` 按 version 冻结（`pipeline.ts:647-657`）。

**现有测例**：

- `apps/worker/tests/ingest/ocr-rerun.test.ts:217-267`（OCR 失败**不抬** `indexVersion`）+ `:201-211`（成功抬到 1）——只覆盖 OCR 段，**未**覆盖 chunk 成功而 embed/es 失败的情形。
- `apps/api/tests/ingest/ocr-rerun-http.test.ts`、`apps/api/tests/acl/acl-tighten-index-lag.test.ts`（PG 闸即时）——非激活版表示。
- 未找到「reindex 失败后旧版可检索/激活版被保留」断言；已搜关键词 `index_version`、`indexVersion`、`激活`、`active_version`。

**结论（可直接回答 03）**：**不能**断言「reindex 失败后哪一版仍在被检索」。当前语义下失败即整文档从检索中消失（`doc.index_version` 指向无 ES/无向量的新版本）。若要「激活版永不删」可测，须先按 03 加独立表示（建议加列或表，并在 `es_index` 成功边界原子写）。

---

## 前置二：`pending_review` 三处是否仍未冻

**判定**：**三处仍无**。

**依据（文件行）**：

1. **落点**：`packages/contracts/src/ingest/document.contract.ts:6-17`（`DocumentStatusSchema` 无 `pending_review`，只有 `needs_review` 属 OCR 语义）；`packages/db/src/schema/kb/ingest-reports.ts:13`（注释明写「不含 pending_review」）；`packages/db/src/schema/kb/{documents,chunks}.ts` 无该列；`knowledge-bases.ts:6-13` 无该字段。
2. **人工处理端点**：`apps/api/src/routes/`（17 文件）无 `pending_review` 命中；`packages/admin-catalog` 无对应权限码；全仓 `pending_review` 仅出现在①负向拒绝断言与②文档说明（grep 19 处，全部为「无 / 不是 / 拒」）。
3. **KB 策略位**：`apps/api/src/services/kb-settings.ts:41-59` / `:180-214`（只解析 `allowedModes/defaultMode/docTypes/dataClass/deptInheritDown/deptAclEnforce`）无去重开关；`packages/contracts/src/kb/kb-settings.contract.ts:109-140` 白名单同；跨 doc 去重在 `pipeline.ts:528-556` **无条件执行**，无 `config_json` 闸。

**现有测例**：`packages/contracts/tests/ingest/ingest-report-contract.test.ts:91`（拒 `pending_review` 装齐字段）；`packages/db/tests/ingest/ingest-reports-schema.test.ts:30`（表不得暴露该列）。均**不是** pending_review 功能测。

**建议**：**需先出决定**。`issues/04-dec-pending-review.md` 是裁定入口；缺定义（粒度/状态名/权限码/KB 默认值）前不得编码，且须避免与既有「拒绝 pending_review」负向断言冲突。

---

## 前置三：签字包 gatePackageId / effectiveAt

**判定**：**唯一生产者仍写死 `null`**；真快照落在**文件**，未回灌设置，故设置页 `gatePackageId` 恒显示 `—`。

**依据（文件行）**：

- 唯一生产者：`apps/api/src/routes/kb-settings.ts:61-67`（`defaultQuality()` 返回 `{ tauClaim: env.TAU_CLAIM, gatePackageId: null, effectiveAt: null }`），并作为路由默认值 `:79`（`const qualityOf = deps.qualitySnapshot ?? defaultQuality`）。全仓 grep `gatePackageId` / `effectiveAt` 的非测命中仅此一处产出（其余为契约定义 `packages/contracts/src/kb/kb-settings.contract.ts:71-72`、admin 展示 `apps/admin/src/app/(ops)/kb/settings/_components/settings-workspace.tsx:487-489`、以及各测例注入 `null`）。
- 真快照落点：`apps/api/src/eval/adr046-snapshot.ts:216-225`（`writeBoundSnapshot` → `<outDir>/l1-gate-snapshot.json`）；由 `apps/api/src/scripts/run-l1-golden.ts:498-518`（`bindQualitySnapshotToEval` 后 `writeBoundSnapshot(opts.outDir, …)`）产出；`outDir` 默认 `<repoRoot>/artifacts`（`:210` `path.join(repoRoot, 'artifacts')`、`:536` `L1_OUT_DIR ?? defaultOutDir`）。
- 无回读：全仓 grep `l1-gate-snapshot` 命中文件写入/文档/测试，**无 api 代码读它回灌 settings**；`apps/api/README.md:106` 记其为 gitignore 产物。

**现有测例**：`apps/api/tests/eval/adr046-snapshot.test.ts:160-198`（`bindQualitySnapshotToEval` + `writeBoundSnapshot` 身份稳定）；`apps/api/tests/eval/l1-cli.test.ts:359`（读 `l1-gate-snapshot.json`）；`apps/api/tests/kb/{settings-http,settings-audit-http,kb-consume-bindings-http,doc-type-catalog-http}.test.ts`（均注入 `null`）。

**建议**：**可直接开工**（若本图要做「设置页显示已签字包」）或 **应划出范围**（若签字包属人签/交付控制台）。技术上只需把 `defaultQuality()` 接真快照来源（读 `artifacts/l1-gate-snapshot.json` 或落库），但须先确认该映射是否属于本图范围。
