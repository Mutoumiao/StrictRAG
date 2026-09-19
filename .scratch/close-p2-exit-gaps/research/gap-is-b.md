# 源码事实核查报告 · gap-is-b（6 ID + 签字包前置）

**核查对象**：QUAL-ACL-CAP · QUAL-TENANT-Q · QUAL-PLANE · QUAL-G3 · QUAL-AB8 · QUAL-AC7，外加「签字包数据来源」前置。
**基准 HEAD**：`c35628a chore(wayfinder): 开图 close-p2-exit-gaps`。
**口径**：判定冲突时 **源码 > `docs/module-status` > `docs/testing/coverage` > task 叙事**。本报告只读核查，未改任何源码 / 测试 / 配置。

---

## 核查方法与已读文件清单

方法：
1. 先读登记缺口的原始依据（`coverage-gap-impl.md`、总 backlog §2.5.2、current 图工单），建立「缺口声称」的基准；
2. 用全仓 ripgrep 搜关键符号（`allowedDocIds` / `acl_filter_too_large` / `tenantId` / `maxEmbedCalls` / `TPM` / `promoted_to_gold` / `chunkStrategy` / `judge` / `gatePackageId`），把命中分成「源码 / 契约 / 测试 / 文档」四类；
3. 对每个命中点用 `read_file` 读实际行，确认（而非推测）行为；
4. 对「已被前图收口」结论，回查 `.scratch/fill-must-haves/` 的工单编号与 `git log`。

已读（或已 grep 定位并逐行核对）文件：

- 依据与调度：`.trellis/tasks/08-06-project-backlog/research/coverage-gap-impl.md` · `.trellis/tasks/08-06-project-backlog/status.md` · `.scratch/close-p2-exit-gaps/map.md` 及 `issues/01 · 05 · 06 · 07 · 12 · 14 · 15` · `.scratch/fill-must-haves/issues/06 · 35` · `.scratch/fill-must-haves/research-next-after-84.md`
- PRD：`prds/10-delivery/03-acceptance-scenarios.md` · `prds/12-delivery-guides/14-模块需求功能表.md` · `prds/05-api/01-http-api-hono.md` · `prds/07-models/01-model-gateway.md` · `prds/04-pipelines/02-online-ask-langgraph.md` · `prds/06-async/01-bullmq-jobs.md`
- IS 镜像/派生：`docs/module-status/{api,admin,worker,contracts,db}.md` · `docs/testing/coverage.md` · `docs/testing/coverage/{02-acl,03-ops}.md` · `docs/ops/rate-limit-and-metrics.md`
- 源码：`apps/api/src/services/retrieve/{es-sparse,retrieve,corpus,index}.ts` · `apps/api/src/graph/reasons.ts` · `apps/api/src/routes/{kb-settings,chunk-strategies,feedback,model-gateway,ask}.ts` · `apps/api/src/routes/documents/index.ts` · `apps/api/src/services/{chunk-strategy-catalog,kb-settings,feedback,ingest-complete-pending,model-gateway}.ts` · `apps/api/src/env.ts` · `apps/api/src/obs/{rate-limit,metrics}.ts` · `apps/api/src/eval/adr046-snapshot.ts` · `apps/api/src/scripts/run-l1-golden.ts` · `apps/worker/src/ingest/{es-http,es-store,embed-http}.ts` · `apps/admin/src/app/(ops)/kb/settings/**`
- 契约/schema：`packages/contracts/src/ask/reason.ts` · `ask/feedback.contract.ts` · `ingest/chunk-strategy.ts` · `ingest/chunk-strategy.contract.ts` · `system/model-gateway.contract.ts` · `kb/kb-settings.contract.ts` · `packages/db/src/schema/ask/eval-runs.ts`
- 测试：`apps/api/tests/kb/kb-consume-bindings-http.test.ts` · `apps/api/tests/obs/quota-planes.test.ts` · `apps/api/tests/ask/{es-sparse,sparse-kb-filter,es-dept-query-filter,es-principals-query-filter,embed-budget}.test.ts` · `apps/api/tests/kb/chunk-strategy-audit.test.ts` · `apps/admin/tests/ops/chunk-strategy-panel.test.tsx` · `apps/admin/tests/ops/kb-settings-workspace.test.tsx`（含 `tests/index.md` 登记行）

---

## QUAL-ACL-CAP

### 判定
**真未做**（无真实生产者；`packages/contracts` 只有码与文案，检索层从不返回该 reason，也无入参闸）。

### 依据
- 枚举码存在：`packages/contracts/src/ask/reason.ts:23`（`'acl_filter_too_large'`）。
- 文案映射存在：`apps/api/src/graph/reasons.ts:93-97`（`userMessage: '权限过滤范围过大，已拒绝本次检索（未截断）。'`）。
- `retrieve` 从不返回该 reason：`apps/api/src/services/retrieve/retrieve.ts` 内所有失败出口只出现 `not_member`(:108) / `kb_not_ready`(:146) / `no_docs_in_scope`(:140) / `internal_guard`(:150,:251,:255) / `low_retrieval`(:162,:215,:226,:276) / `sparse_unavailable`(:202)；全仓 grep `acl_filter_too_large` **仅**命中 `reason.ts:23` + `reasons.ts:93` + `coverage/02-acl.md:36`，**无任何调用点**。
- `allowedDocIds` 全仓出现点共 10 处，**全部是文档或负向测试**，无一是生产者：
  - 文档：`docs/module-status/api.md:34,160` · `docs/module-status/admin.md:83` · `docs/module-status/contracts.md:62` · `docs/testing/coverage/02-acl.md:33,35`；
  - 负向测试（断言「拒绝该字段」而非「消费该字段」）：`packages/contracts/tests/ask/contract.test.ts:113,118`（`UpdateMemberBodySchema.safeParse({role, allowedDocIds}).success === false`）· `apps/api/tests/acl/members-http.test.ts:204`（PUT 成员带 `allowedDocIds` → 应拒）。
- DB schema 无该列：`packages/db` 内 grep `allowedDocIds|allowed_doc_ids` **0 命中**。
- 上限常量/闸不存在：全仓 grep `ACL_DOC_IDS_MAX` **0 命中**（功能表要求「默认 5000，可配」）。
- PRD 侧语义确实已冻：`prds/12-delivery-guides/14-模块需求功能表.md:420`（「`allowedDocIds` 省略/null = 成员全库 ≠ 跳过 ACL；`len > ACL_DOC_IDS_MAX`…→ `acl_filter_too_large`，**禁止截断**」）；剧本原文 `prds/10-delivery/03-acceptance-scenarios.md:46`（B1-A4）。
- 图内已有裁定：`.scratch/close-p2-exit-gaps/map.md:28`「**`allowedDocIds` 收紧路径 / 成员写面**：准入条件是**先指名真实生产者**（前图裁定 103）；**无生产者前不实现**」；`.scratch/close-p2-exit-gaps/issues/06-qual-acl-cap.md:12-13` 复述同一裁定。

### 现有测例
无（不存在任何断言「超 5000 → `acl_filter_too_large`」或「retrieve 入参闸」的测例；仅有两处**反向**断言「写成员 body 不得含 `allowedDocIds`」）。

### 建议
**应划出范围**：本项唯一缺的是「生产者 + 入参闸」，而全仓找不到任何会产生显式 `allowedDocIds` 的调用方（客户端禁传、无 KB 成员级名单、ES PRD 自标可选），继续做等于为不存在的调用者加一段死代码；图内已裁定无生产者前不实现。若产品坚持要留语义，最小动作是先出一个「谁会产生超长名单」的决定，再回落 Q5 题面。

---

## QUAL-TENANT-Q

### 判定
**部分已做**。前置（`tenantId` 成为 builder 必填字段、查询与 bulk 实际写入 `tenantId`）已由**前图 09（检索语义补钉）**落地；剩余差：① 没有「缺 `tenantId` 即失败」的门禁/负向测例（现有只是 TS 必填 + 正向断言）；② 默认 mock 稀疏适配层（`mockEsStore`）与默认 mock 检索路径没有 `tenantId` 概念；③ 独立索引布局整体未实现（B8 划出）。

### 依据
- API 查询侧**已有强制字段**：`apps/api/src/services/retrieve/es-sparse.ts:15-24`（`EsSparseSearchInput.tenantId: string` 必填）· `:106-124`（`buildAclFilter` 首条即 `{ term: { tenantId: input.tenantId } }`，见 `:115`）· `:221`（`_search` body `filter: buildAclFilter(input)`）。
- 调用侧确实传 `tenantId`：`apps/api/src/services/retrieve/retrieve.ts:185`（`tenantId: input.tenantId`）。
- Worker bulk 侧**已有强制字段**：`apps/worker/src/ingest/es-http.ts:31-41`（`SparseBulkDoc.tenantId: string` 必填）· `:55-70`（`sparseBulkSource` 写 `tenantId: d.tenantId`，见 `:59`）· mapping `:47-53` 含 `tenantId: { type: 'keyword' }`。
- 但 worker 对账查询**不带** tenant：`apps/worker/src/ingest/es-http.ts:169-200`（`listIndexedChunkIds` 用 `query: { term: { docId } }`，见 `:178`）——这是对账取 chunkId，不是用户侧 query builder，但确属「走到 ES 查询构造」的路径。
- Mock 适配层无 tenant 概念：`apps/worker/src/ingest/es-store.ts:9-52`（`mockEsStore` 键为 `${docId}:v${indexVersion}`，无 `tenantId`）；默认 mock 检索路径 `apps/api/src/services/retrieve/retrieve.ts:206-213`（`esMode !== 'http'` 时用 corpus token 重叠，不构造 ES 查询），corpus 只按 `kbId` 拉 PG：`apps/api/src/services/retrieve/corpus.ts:70`（`eq(documents.kbId, kbId)`）。
- 无「缺 `tenantId` 必须失败」的实现：全仓 grep `tenantId.*required|required.*tenantId|missing tenant` **0 命中**；`buildAclFilter` 无 runtime 校验（`input.tenantId` 为 undefined 时不会抛，只会产出 `{ term: {} }`）。
- 历史归属：`.scratch/fill-must-haves/map.md:31`「检索语义补钉 — ES 查询期 `tenantId`+`kbId`」；`.scratch/fill-must-haves/inventory-p2.md:62` 当时仍标「§8 ES `tenantId` filter … 缺」（说明是本仓前图补上的，非 O4 工单）。
- 图内 O4 要求更严：`.scratch/close-p2-exit-gaps/issues/05-qual-tenant-query.md:12-15`（「缺 `tenantId` 时**构查询即失败**」「含 mock ES 适配层路径」「补测：无 `tenantId` 必须失败，query 与 bulk 各一条」）。
- 旧口径已滞后：`docs/testing/coverage/03-ops.md:54`（「查询/bulk 均无 `tenantId` 强制字段」）与当前源码不符，属**过期派生对照**。

### 现有测例
有正向断言（`tenantId` term 必在）：`apps/api/tests/ask/es-sparse.test.ts:34-53` · `apps/api/tests/ask/sparse-kb-filter.test.ts:92` · `apps/api/tests/ask/es-dept-query-filter.test.ts:117-131` · `apps/api/tests/ask/es-principals-query-filter.test.ts:98-125`；worker bulk 正向：`apps/worker/tests/ingest/es-http.test.ts:86-131`（给了 `tenantId: 't'` 但未断言输出含 `tenantId`）。
**缺**：无「省略 `tenantId` → 抛错/门禁失败」的负向测例。

### 建议
**需先出决定**：O4 的「必须失败」到底以哪一层为准 —— 若接受「TS 必填 + 正向断言」即为门禁，则只剩补一条负向测例（可直接开工）；若要求 runtime guard 且覆盖 mock 适配层，则等于要在 `mockEsStore` 上引入 tenant 维度，属新语义。另需明确独立索引布局（B8）是否随本项一起划出。

---

## QUAL-PLANE

### 判定
**部分已做**（R5 / R8 / R9 已由**前图 35（三平面配额最小闭环）**收口；R4 / R6 / R10 仍真未做）。

### 依据
逐条核（剧本 `prds/10-delivery/03-acceptance-scenarios.md:293-312`）：

1. **R4 `maxEmbedCalls` 启动 warning 且行为 ≡ 无该字段 —— 真未做**。全仓 grep `maxEmbedCalls` 仅命中文档（`prds/04-pipelines/02-online-ask-langgraph.md:238,292` · `prds/README.md:206` · `docs/module-status/api.md:164` · `docs/testing/coverage/03-ops.md:83,90`），`apps/api/src/env.ts` 与 `apps/api/src/graph/budget.ts` 均无该键，也无任何 warning 分支。PRD 明文：`prds/04-pipelines/02-online-ask-langgraph.md:238`（「P2 **无** 图字段 `maxEmbedCalls`；runtime 若出现该键 → **warning + 忽略**」）、`:292` 同义。
2. **R5 ask / ingest 互不阻断 —— 已做**。分 store：`apps/api/src/obs/rate-limit.ts:21-25`（`askRateLimitStore` / `ingestRateLimitStore` 两个独立 Map）、分前缀键 `:66-71`；注入点 `apps/api/src/routes/ask.ts:143`、`apps/api/src/routes/documents/index.ts:90-95`。
3. **R6 mock embed TPM 口径 —— 真未做**。worker 侧 `apps/worker/src/ingest/embed-http.ts:1-38` 全篇无任何 TPM/配额/反压逻辑；全仓 grep `TPM|tpm|tokensPerMinute` 仅命中文档（`prds/06-async/01-bullmq-jobs.md:18,22,23,72,81`）。PRD 要求 `prds/06-async/01-bullmq-jobs.md:23`（「Embedding → pgvector；消费冻结清单；触顶**反压不丢 chunk**」）。
4. **R8 ask 触顶不得 200 空答 answered —— 已做**。`apps/api/src/routes/ask.ts:344-351`（触顶即 `429` + `RATE_LIMITED` + `details.plane='ask'` + `ask_quota_exhausted: true`，不执行图）。
5. **R9 指标带 `plane=` —— 已做**。`apps/api/src/obs/metrics.ts:58-59`（`ASK_PLANE` / `INGEST_PLANE` 常量）、`:67-68`（ask_total/ask_ok/ask_fail 带 `plane: ASK_PLANE`）、`:144-150`（`recordLlmCall` 带 `plane: ASK_PLANE`）、`:153-154` / `:162-167` / `:176-177`（rerank 三键带 `plane: ASK_PLANE`）、`:185-186`（`ingest_complete_total{plane=ingest}`）、`:180`（`recordRateLimited(scope, plane)`）。
6. **R10 staging 缺配额 warning + 安全默认 —— 真未做**。`apps/api/src/env.ts:134-139`（`ASK_RATE_LIMIT_RPM` / `INGEST_RATE_LIMIT_RPM` 默认 `0`，无任何 `APP_ENV==='staging'` 告警分支；`env.ts` 内 `APP_ENV` 相关校验只有 `:223-240` 的 production 凭证校验）；`apps/api/src/obs/rate-limit.ts:37-39`（`limit <= 0` 直接放行 = 无限流，即「裸奔」而非「安全默认」）。PRD 要求：`prds/07-models/01-model-gateway.md:316`（「staging/prod **无** plane 配额配置裸奔（缺则 **warning + 安全默认值**，非 fail closed）」）。

- 相关背景文档：`docs/ops/rate-limit-and-metrics.md:1`（策略文档已落；`:73-78` 明确「Redis 集群配额 / embed TPM / aux 运行时 —— 本窗不做」，与源码一致）。

### 现有测例
- 已测（R5/R8/R9）：`apps/api/tests/obs/quota-planes.test.ts:196-221`（ask 触顶 429 + plane + `ask_quota_exhausted`，且 `data.status !== 'answered'`）、`:223-240`（ingest 触顶 429 + plane=ingest）、`:243-254`（打满 ask 不阻断 complete）、`:290-316`（`/metrics` 含 `plane=ask` / `plane=ingest`，aux 只留常量）；登记 `apps/api/tests/index.md:160-161`。
- 缺测：R4（`maxEmbedCalls` warning）、R6（embed TPM）、R10（staging 缺配额 warning + 安全默认）**无任何测例**；`docs/testing/coverage/03-ops.md:90,92` 亦标「缺实现」。

### 建议
**可直接开工**（但要拆细）：R4 与 R10 是 `env.ts` 层的 warning + 安全默认，改动小、不动契约、不放宽既有 RPM 语义，可先落；R6（mock embed TPM 口径 = 反压/半套 ready 的边界）**需先出决定**——PRD 只说「触顶反压不丢 chunk / 无半套 ready」，具体 TPM 单位、桶大小、与 mock embed（`embed-http.ts:4-6` 的 `mockEmbedVector` 无 token 概念）如何折算都要先定。

---

## QUAL-G3

### 判定
**部分已做**：运营表回流闸已由**前图 84（反馈回流黄金集最小闭环）**落地；但「未经测试/产品审核**不得进 `gold.yaml`**」这条没有实现对象——`gold.yaml` 本身是**静态手写 seed，无任何生成器 / 写入路径**，因此也不存在「未审不得进」的可加闸点。功能表亦无对应行。

### 依据
1. **`promoted_to_gold` 定义位置**：
   - 契约枚举：`packages/contracts/src/ask/feedback.contract.ts:19-27`（`FeedbackStatusSchema` 含 `'promoted_to_gold'`，见 `:24`）；PATCH body 校验 `:30-41`（`status` + 条件必填 `goldType`）。
   - 服务侧重复枚举：`apps/api/src/services/feedback.ts:6-12`（`FeedbackStatus` union，`promoted_to_gold` 在 `:12`）。
2. **`gold.yaml` 由什么生成 / 被谁读**：
   - **无生成脚本**：全仓 grep `writeFileSync` 与 `gold` 的组合 **0 命中**；`fixtures/l1/gold.yaml` 是静态 seed（`prds/12-delivery-guides/14-模块需求功能表.md:377` 只写「gold-questions CRUD」）。
   - 读取器：`apps/api/src/scripts/run-l1-golden.ts:269-283`（`loadGold`，`JSON.parse` 后校验）· `:205-207`（`defaultGoldPath` → `fixtures/l1/gold.yaml`）· L2 侧 `apps/api/src/eval/l2-gold.ts:37-48`（`loadL2Gold` → `fixtures/l2/gold.yaml`）。
   - 反馈回流**不写文件**，只写 DB 表 `gold_questions`：`apps/api/src/routes/feedback.ts:247-258`（`gold.create({...caseKey/question/type/rubric})`）；`docs/ops/feedback-sla.md:9` 明确「**不**写 `fixtures/l1/gold.yaml`、**不**自动入队评测」。
3. **有没有审核闸**：运营表**有**（写 `gold_questions` 前须 `feedback.queue` + `eval.run` 双权限 + `goldType`，且题面必须来自当轮 ask trace）：`apps/api/src/routes/feedback.ts:199-246`（`checkPermission(c,'feedback.queue')` → `:213-222` `checkPermission(c,'eval.run')` → `:246` `goldType` 必填）。**`gold.yaml` 无闸**（无写入路径可拦）。
4. **功能表检索结果**：`prds/12-delivery-guides/14-模块需求功能表.md` 内 grep `gold|黄金集|审核|提名|promoted` 命中 6 行 —— `:261`（反馈队列「…回流补库或黄金集」）、`:262`（「黄金集 / 跑批 `eval.run`」）、`:377`（「黄金集 / 评测 gold-questions CRUD」）、`:468`（`eval.run` 门禁平面）、`:563`（2×2 定义）、`:677`（流程图「纳入黄金集 → eval.run」）；其中 **`审核` / `提名` / `promoted` 0 命中** → **功能表没有「提名须审核后才进 gold」的对应行**。
5. **剧本原文行**：`prds/10-delivery/03-acceptance-scenarios.md:139`（`| 提名黄金集 | 须测试/产品审核后才进 gold |`，属剧本 G）。
6. 现行口径：`docs/testing/coverage/03-ops.md:27`（「运营表：…缺：未审不得进 `gold.yaml`（QUAL-G3 工程种子仍缺口）」）· `docs/testing/coverage.md:84`（「G3（运营表回流已部分测；**`gold.yaml`** 审核闸仍缺）」）。

### 现有测例
- `apps/api/tests/feedback/promote-gold.test.ts`（PATCH `promoted_to_gold`：须 `goldType`、须 ask trace、用户 POST 不写题）· `apps/api/tests/index.md:109`（登记）。
- `packages/contracts/tests/ask/feedback-promote-gold.test.ts` · `packages/contracts/tests/index.md:24`。
- `apps/admin/tests/ops/feedback-promote-gold.test.tsx` · `apps/admin/tests/index.md:44`。
- **无**任何「未审不得进 `gold.yaml`」的反例测例。

### 建议
**应划出范围**：本项要防的是「未审产物进了 `gold.yaml`」，但源码里根本不存在往 `gold.yaml` 写入的代码（那份文件是工程手写 seed，唯一的「纳入黄金集」动作是写 DB `gold_questions` 表，且该动作已有双权限 + `goldType` 闸）；同时功能表无对应行。强行实现等于凭空造一条 `gold.yaml` 生成器再给它加闸。关闭本票并在图上记一行 Out of scope 更诚实。

---

## QUAL-AB8

### 判定
**已被前图收口**（**前图 06「策略三层最小闭环」+ 82**）。admin 设置页已有「分片策略」分区与 `设置` 弹窗、保存走既有 PATCH、服务端落审计、旧文档快照不变，并有组件测例。唯一残留是**站规**层面的 1 处浏览器原生 `<select>`（非映射表缺口，图内已单列为站规清扫余量）。

### 依据
1. **admin 设置页现在对分片策略渲染了什么**：
   - 挂载点：`apps/admin/src/app/(ops)/kb/settings/_components/settings-workspace.tsx:452`（`<ChunkStrategyPanel kbId={kbId} canWrite={canWrite} />`，位于「文档类型」与「KB 消费绑定」之间）。
   - 面板本体：`apps/admin/src/app/(ops)/kb/settings/_components/chunk-strategy-panel.tsx:96-199` —— 标题「分片策略」(:98)、`设置/收起` 按钮 (:99-107)、`role="dialog" aria-label="分片策略设置"` 的内联弹窗 (:116-118)、「启用」复选框组 (:121-140)、「各 MIME 族 recommended」下拉 (:141-166)、`情境前缀` 用 `ClosedSelect` (:167-190)、`保存策略` 按钮 (:191)。
2. **ADR-053 策略参数形状与 `packages/contracts` 既有 schema**：
   - `packages/contracts/src/ingest/chunk-strategy.contract.ts:8-19`（`ChunkStrategyCatalogItemSchema`：`code/name/implemented/system/docFamilies/paramSchema/pipelineId/enabled/recommendedFamilies/paramOverrides`）；PATCH body `:58-66`（`items[]{ code, enabled, recommendedFamilies?, paramOverrides? }`；`:63-65`）。
   - 参数默认值与族/情境前缀枚举：`packages/contracts/src/ingest/chunk-strategy.ts:53-57`（`DEFAULT_CHUNK_STRATEGY_PARAMS = { chunkTokens: 256, chunkOverlap: 32, contextMode: 'l1_llm' }`）· `:42-51`（`CHUNK_STRATEGY_DOC_FAMILIES` / `CONTEXT_MODES` / `CONTEXT_SOURCES`）· `:90-119`（平台种子三层 `CHUNK_STRATEGY_PLATFORM_SEED`，含 `implemented` 标志）· `:20-28`（可写集仅 `structure_paragraph`）。
3. **「保存」路径现状（有没有 PATCH / 走哪个端点）**：
   - 面板 → `apps/admin/src/app/(ops)/kb/settings/chunk-strategy.services.ts:32-38`（`saveKbChunkStrategies`）→ `apps/admin/src/app/(ops)/kb/settings/api.ts:50-54`（`PATCH /api/v1/knowledge-bases/${kbId}/chunk-strategies`）。
   - 服务端路由：`apps/api/src/routes/chunk-strategies.ts:94-131`（PATCH；`:97` 走 `PatchKbChunkStrategiesBodySchema`；`:113-125` **仅有 diff 时**写 `auditRepo.insert`）。
   - 落库语义：`apps/api/src/services/chunk-strategy-catalog.ts:259-323`（「只动 `kb_chunk_strategies`：旧文档 `index_version` 与参数快照不变」见 `:261`；diff 键 `chunkStrategy.<code>.<field>` 见 `:305-323`）。
   - 即「保存」= **PATCH + 审计 + 旧文档不变**，满足 AA1 语义。
4. **admin 里现有的弹窗/对话框组件是什么**：`packages/ui/src/components/ui/` 只有 `alert/badge/button/card/closed-select/input/label/select/table/textarea`，**没有** `Dialog`/`Modal`/`Sheet`/`Popover`；admin 内全仓唯一 `role="dialog"` 就在 `chunk-strategy-panel.tsx:117`（自建内联 dialog）。可复用的关闭列表是 `ClosedSelect`（`packages/ui/src/components/ui/closed-select.tsx`）。
5. **残留站规问题**：`apps/admin/src/app/(ops)/kb/settings/_components/chunk-strategy-panel.tsx:149-163`（「各 MIME 族 recommended」用浏览器原生 `<select>` + `<option>`），与站规「新下拉必须用 `@strict-rag/ui` 关闭列表，禁止原生 `<select>`」相悖。图内已把它记为站规余量：`.scratch/close-p2-exit-gaps/map.md:24-26`（「admin 站规清扫（… `chunk-strategy-panel 1` …）：是站规余量，**不是**映射表缺口；本机无浏览器验证手段…留在雾里」）。

### 现有测例
`apps/admin/tests/ops/chunk-strategy-panel.test.tsx`（打开 `role="dialog" { name: '分片策略设置' }` (:68)、`情境前缀 structure_paragraph` 控件 (:107)），登记于 `apps/admin/tests/index.md:36`；API 侧 `apps/api/tests/kb/chunk-strategy-audit.test.ts:115,146`（审计 diff 键）。

### 建议
**应划出范围**：映射表缺口（弹窗存在 + 保存服 AA 语义）已闭合，且有组件测例；剩余的 1 处原生 `<select>` 属站规清扫余量、图内已显式挂在雾里（无浏览器验证手段），不宜在无视觉回归条件时单独改。

---

## QUAL-AC7

### 判定
**已被前图收口**（**前图 78「KB 消费绑定只覆盖 generate/embed/rerank」**）。KB 绑定写路径以白名单 schema 拒绝 `judge` → **400 `VALIDATION_ERROR`**，平台级绑定仍可绑 `judge`（行为不变），admin KB 设置页不列 `judge`。

### 依据
1. **KB 模型绑定的写路径（路由 + 校验 schema）**：
   - 路由：`apps/api/src/routes/kb-settings.ts:187-210`（`PUT /knowledge-bases/:kbId/model-bindings`，`write` = `kb.config.write`）。
   - 校验：`:190` 用 `PutKbConsumeBindingsBodySchema`；`:191-193` 失败即 `fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, …)` → **400**。
   - Schema 白名单：`packages/contracts/src/system/model-gateway.contract.ts:172-190`（`PutKbConsumeBindingsBodySchema` 的 `superRefine` 对每个 key 跑 `isKbConsumePurpose`，`:180-185` 报 `kb bindings cannot include purpose: ${key}`）；白名单本体 `:48-49`（`KB_CONSUME_PURPOSES = ['generate','embed','rerank']`），`isKbConsumePurpose` `:51-53`。
2. **平台级绑定的写路径**：`apps/api/src/routes/model-gateway.ts:170-190`（`PUT /admin/model-bindings`，`manage` = `model.gateway.manage`），用 `PutPlatformBindingsBodySchema`（`model-gateway.contract.ts:150-169`），其 purpose 枚举含 `judge` / `judge_aux`（`:34-45`）；`validatePlatformBindings` 只校验 ref/类型/`judge≠judge_aux`（`apps/api/src/services/model-gateway.ts:176-213`）→ 平台绑 `judge` 未被削弱。
3. **`judge` 的定义位置与平台级约束 PRD 原文**：
   - 定义：`packages/contracts/src/system/model-gateway.contract.ts:37-38`（`'judge'` / `'judge_aux'`）。
   - PRD 原文：`prds/07-models/01-model-gateway.md:82`（「KB 可覆盖 generate/embed/rerank（**judge\* 仅平台**）」）；`:165`（「**`judge` / `judge_aux` 禁止 KB 覆盖**。覆盖须审计」）；`prds/05-api/01-http-api-hono.md:463`（「消费端 KB ｜ PATCH KB bindings 仅白名单 purpose：`generate`/`embed`/`rerank`（…非 judge）｜ 写 `judge` / `judge_aux`」列为**禁止**项）、`:468`（校验须过 042/034/启用态）。
   - **400 vs 403 判据**：PRD 把 KB 绑 `judge` 定义为「purpose 不在白名单」的**请求体非法**（05-api:463 列在「消费端 KB 白名单」约束下），而 403 在本仓语义是「有权限但被策略拒」（如 `perms.ts` 的 FORBIDDEN）。因此**400 更贴 PRD**，也与当前实现一致；AC7 剧本写「400/403」两者皆可，取 400 不破信封。
4. **admin KB 设置页是否会把 `judge` 列为可选项**：不会。`apps/admin/src/app/(ops)/kb/settings/_components/settings-workspace.tsx:457`（文案「仅 generate / embed / rerank。…禁止改 judge」）、`:459`（只迭代 `KB_CONSUME_PURPOSES`），下拉用 `ClosedSelect`（`:461-473`）。

### 现有测例
- API：`apps/api/tests/kb/kb-consume-bindings-http.test.ts:81-97`（PUT `judge` → `status 400` 且不落行）；平台侧 `apps/api/tests/gateway/bindings-http.test.ts:146`（合法 ref 200 / embed 绑 llm 400 / `judge≡judge_aux` 400）。
- admin：`apps/admin/tests/ops/kb-settings-workspace.test.tsx:342`（`expect(body.bindings).not.toHaveProperty('judge')`）。
- 契约：`packages/contracts/tests/system/model-gateway-contract.test.ts:78`（`requiredModelTypeForPurpose('judge') === 'llm'`）。

### 建议
**应划出范围**：映射表缺口已闭合且有三层测例；`400` 的选择有 PRD 出处（05-api:463 / 07-models:165），无需再改。若产品偏好 403，属语义微调（需新决定），不影响本项收口。

---

## 前置 · 签字包数据来源

### 判定
**仍缺**：`gatePackageId` / `effectiveAt` 的唯一生产者仍是 `defaultQuality()`，两字段**硬编码 `null`**，无真实写入者；真实快照本体已有落点（`artifacts/l1-gate-snapshot.json` + `eval_runs.report_json.gateSnapshot`），但**没有任何路径**把它回填到 KB 设置的 `gatePackageId` / `effectiveAt`。

### 依据
- 唯一生产者写死 `null`：`apps/api/src/routes/kb-settings.ts:61-66`
  ```
  function defaultQuality(): QualitySnapshot {
    return { tauClaim: env.TAU_CLAIM, gatePackageId: null, effectiveAt: null };
  }
  ```
  注入点 `:79`（`const qualityOf = deps.qualitySnapshot ?? defaultQuality;`），使用处 `:94`（GET）与 `:159`（PATCH 后回读）。
- 契约形状：`packages/contracts/src/kb/kb-settings.contract.ts:69-73`（`QualitySnapshotSchema`：`tauClaim` 必填、`gatePackageId`/`effectiveAt` `nullable().optional()`）。
- admin 只读展示：`apps/admin/src/app/(ops)/kb/settings/_components/settings-workspace.tsx:487-490`（`gatePackageId` 为 null 时渲染 `'—'`）。
- 真实快照落点：`apps/api/src/scripts/run-l1-golden.ts:499-516`（`bindQualitySnapshotToEval` → `report.gateSnapshot = bound.snapshot`(:514) → `writeBoundSnapshot(opts.outDir, …)`(:516)）→ `apps/api/src/eval/adr046-snapshot.ts:217-227`（`writeBoundSnapshot` 写 `<outDir>/l1-gate-snapshot.json`）；`outDir` 默认 `artifacts/`（`run-l1-golden.ts:209-210`，`:536` 读 `L1_OUT_DIR`）。
- `eval_runs` 派生路径**存在但不接线**：`run-l1-golden.ts:172`（`reportJson: report`，即整个 L1Report 含 `gateSnapshot` 落库）；schema `packages/db/src/schema/ask/eval-runs.ts:33-34`（`reportJson` jsonb，注释「完整 L1Report 快照」）；消费方 `apps/api/src/services/dashboard.ts:215`（`extraStatsFromReport(row.reportJson)`）。全仓 grep `gatePackageId` 只命中 `contract` + `kb-settings.ts` + admin 展示 + 4 处测试（`apps/api/tests/kb/settings-http.test.ts:55-56` 等）→ **无 eval_runs → KB 设置的反填**。

### 现有测例
测试全部以 `gatePackageId: null, effectiveAt: null` 为**入参注入**（`apps/api/tests/kb/settings-http.test.ts:55-56` · `settings-audit-http.test.ts:56-57` · `kb-consume-bindings-http.test.ts:64` · `doc-type-catalog-http.test.ts:43`），即测的是「null 时如何渲染」，**无**「真实快照可被读到」的测例。

### 建议
**需先出决定**：要先定三件事 —— ① 谁是 `gatePackageId` 的权威（`l1-gate-snapshot.json` 的 `evalBindId` 还是 `eval_runs.id`）；② `effectiveAt` 取「本跑 `ranAt`」还是「业务签字时间」；③ 回填时机（读时从 `eval_runs` 派生 vs 写时物化）。在这三点冻结前动手会造出第二套快照语义，与 ADR-046「绑定现有 L1 eval 身份、≠ 人签」冲突。
