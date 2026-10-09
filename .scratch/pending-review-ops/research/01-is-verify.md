# 现状核实（IS）：`pending_review` 全链 + `ingest_jobs` 运营可见面

> 只读核实。所有结论带 `路径:行号` 或检索输出。凡未在源码/文档中找到证据者，标「未核实」，不作推断。
> 核实时间基线 = HEAD 工作区源码。

---

## Q1 落库：`chunks.dedupe_status` / `duplicate_of` 的 worker 写入点、取值域、迁移编号

**一句话结论**：两列由 worker 入库状态机 `chunk` 阶段在**跨文档去重命中且 KB 策略 = `pending_review`** 时写入；`dedupe_status` 全仓唯一写值 = 字符串 `'pending_review'`（无第二个枚举值），`duplicate_of` 写命中的**对方 chunk id**；表结构来自 migration `0021_chunks_dedupe_review.sql`。

证据：

- 表结构（两列定义 + 注释）：`packages/db/src/schema/kb/chunks.ts:18-23`
  - `chunks.ts:22` `duplicateOf: uuid('duplicate_of'),`
  - `chunks.ts:23` `dedupeStatus: text('dedupe_status'),`
  - 注释（`:19-21`）：`dedupe_status` 仅取值 `pending_review`（处理完回 NULL）。
- 迁移：`packages/db/drizzle/0021_chunks_dedupe_review.sql:4-5`
  - `ALTER TABLE "chunks" ADD COLUMN IF NOT EXISTS "duplicate_of" uuid;`
  - `ALTER TABLE "chunks" ADD COLUMN IF NOT EXISTS "dedupe_status" text;`
  - 无默认（`:3` 注释：既有行保持 NULL）。
- worker 唯一写入点：`apps/worker/src/ingest/pipeline.ts`
  - 取策略：`:553` `const dedupeAction = await loadCrossDocDedupeAction(db, doc.kbId);`
  - 分支：`:580` `if (dedupeAction === 'pending_review') {`
  - 插入 held 行（`:583-598`）：`dedupeStatus: 'pending_review'`（`:596`）、`duplicateOf: conflict.otherChunkId`（`:595`）；且该行**不进 manifest**（`:581-582` 注释 + 后续 `chunkIds` 不含）。
- 全仓检索 `dedupeStatus|dedupe_status|pending_review`（`apps/worker/src`）仅 4 命中，均在 `cross-doc-dedupe.ts`（类型注释）与 `pipeline.ts`（`:553/:580/:596`）——**无其它写入点**。
- 取值域：`apps/api/src/services/dedupe-conflict.ts:15` `export const DEDUPE_STATUS_PENDING_REVIEW = 'pending_review';`；服务边界注释 `:5-7`「只写这两列」。schema/迁移均只声明单值，无 PG CHECK（`db.md:9` 记「DB 层无 CHECK 约束」）。

---

## Q2 报告：`ingest_reports.conflict_pairs` 的形状 / 写入条件 / 读出路径

**一句话结论**：`conflict_pairs` 是 JSONB 数组，元素形状 `{otherDocId, otherChunkId, action: 'skip_index'|'pending_review', heldChunkId?}`；由 worker `persistIngestReport` 随入库报告写入（`chunk` 阶段必写、`es_index` 失败/成功也写但冲突对为 `[]`）；`pending_review` 对**在写入端必带 `heldChunkId`**（契约层标可选）。读出路径 = api `GET /knowledge-bases/:kbId/ingest-report` → `IngestReportItemSchema`；**admin 面消费该 GET 但只渲染 `otherDocId`**（详见 Q4）。

证据：

- DB 形状：`packages/db/src/schema/kb/ingest-reports.ts:5-11`（类型）+ `:33` `conflictPairs: jsonb('conflict_pairs').$type<IngestReportConflictPair[]>().notNull(),`
  - 类型字段：`otherDocId` / `otherChunkId` / `action: 'skip_index' | 'pending_review'` / `heldChunkId?: string`（`:5-11`）。
- 契约形状：`packages/contracts/src/ingest/ingest-report.contract.ts:10-18`
  - `heldChunkId: z.string().uuid().optional()`（`:15`）——契约层**可选**；注释 `:8-9`：`pending_review` 时带 `heldChunkId`。
- 写入条件与时机（worker）：
  - 构造：`apps/worker/src/ingest/ingest-report.ts:65-89` `buildIngestReportInsert`，`:78` `conflictPairs: [...snapshot.conflictPairs]`。
  - `pending_review` 对必带 held：`pipeline.ts:599` `conflictPairs.push({ ...conflict, heldChunkId: heldId });`（`heldId` = `:585` 新建的 held 行 id）。注意 `findCrossDocConflict` 返回的原始 conflict **不含** `heldChunkId`（`cross-doc-dedupe.ts:76-82`），仅 `pending_review` 分支补上。
  - `skip_index` 对**不带** `heldChunkId`：`pipeline.ts:602` `conflictPairs.push(conflict);`。
  - 调 `persistIngestReport` 三处：`pipeline.ts` 全待审失败 `:674`（conflictPairs 原样）、manifest 冻结 `:711`、es 失败/成功 `:965/:992`（后两处 `conflictPairs: []`，且 `persistIngestReport` 会保留已存在的 `conflictPairs`：`ingest-report.ts:129` `conflictPairs: existing[0]?.conflictPairs ?? snapshot.conflictPairs`）。
- 读出路径（api DTO）：
  - 路由：`apps/api/src/routes/ingest-report.ts:30-38` `GET /knowledge-bases/:kbId/ingest-report`。
  - 服务映射：`apps/api/src/services/ingest-reports.ts:8-62` `toIngestReportItem`，`:47` `conflictPairs: row.conflictPairs ?? [],`；空值回读成 `[]`。
  - DTO 契约：`packages/contracts/src/ingest/ingest-report.contract.ts:22-54` `IngestReportItemSchema`（`.strict()`），`:37` `conflictPairs: z.array(IngestReportConflictPairSchema),`。
- admin 面读出：`apps/admin/src/app/(ops)/documents/api.ts:93` `listIngestReports` → `GET .../ingest-report`；仅渲染（见 Q4）。

---

## Q3 端点：`POST …/dedupe-conflicts/:chunkId/resolve` 的权限码/成员闸/body/返回；是否存在「列出待审冲突」读端点

**一句话结论**：端点存在，权限码 `doc.editor`（**非** WhenEnforced，始终验），成员闸姿态 `always`（始终查 KB 成员）；body `{ winner: 'this' | 'other' }`（strict）；返回 `{docId, chunkId, winner, reindexRequired}`，`reindexRequired = (winner === 'this')`。**不存在**「列出待审冲突」的读端点——api 与 contracts 均无；只此一个 dedupe-conflicts 路由。

证据：

- 路由与权限/成员闸：`apps/api/src/routes/documents/index.ts:637-674`
  - 注释 `:638-639`：权限同 `PATCH /documents/:docId`（`doc.editor`），不代跑 reindex。
  - `:643` `requirePermission('doc.editor'),`（`requirePermission` = 始终验码，见 `auth/middleware.ts:257-277`）。
  - 成员闸 `:656-659`：`docMemberDenied(c, chunk.kbId, 'always')`（块不存在时跳过，留 404）。
  - body 解析 `:647-651`；verdict `:661-664`；落决定 `:665`；返回 `:667-673`。
- body/返回契约：`packages/contracts/src/ingest/dedupe-conflict.contract.ts`
  - `ResolveDedupeConflictBodySchema` `:13-16`（`.strict()`，仅 `winner: 'this'|'other'`）。
  - `ResolveDedupeConflictResponseSchema` `:19-30`；`reindexRequired` `:26-28`（注释：`winner='this'` 时 true，本端点不代跑 reindex）。
- 语义实现：
  - 判定：`apps/api/src/services/dedupe-conflict.ts:89-110` `evaluateResolveRequest`（非 pending_review → `400 VALIDATION_ERROR`；不存在 → `404 NOT_FOUND`）。
  - 落决定：`:60-70` `resolve`：`winner==='this'` → 清 `dedupeStatus`+`duplicateOf`；否则仅清 `dedupeStatus`（保留 `duplicateOf`）；**只写这两列**。
- 「列出待审冲突」读端点：
  - 检索 `dedupe-conflicts`（`apps/api/src/routes`）仅 2 命中（`:637` 注释、`:642` 路由），**只有 POST resolve**。
  - contracts 检索 `dedupe|Dedupe`：仅 `ingest/dedupe-conflict.contract.ts`（含 `ResolveDedupeConflictBody/Response`，**无 list schema**）+ `ingest-report.contract.ts`（冲突对只嵌在报告里）+ `kb/kb-settings.contract.ts` 策略码。
  - **结论：无独立「待审冲突列表」端点，也无对应 contract**。

---

## Q4 发现路径：今天 admin 里运营得知「某文档有 pending_review 块」的唯一途径

**一句话结论**：**没有专门入口**。唯一沾边的是文档列表「行展开 → 入库报告」里的「冲突 otherDocId」文本（`documents-workspace.tsx:1200-1202`），但它（a）只在有入库报告时出现，（b）**只渲染 `otherDocId`**，不显示 `action` / `heldChunkId` / `pending_review` 字样，（c）**无二选一控件**。逐条核实如下，未发现其它路径。

证据（逐条核 `apps/admin/src/**`）：

- 文档列表「运营标签」：`apps/admin/src/app/(ops)/documents/list.services.ts:87-105`。标签判定只依赖 doc 级 `status` / `lifecycle` / `approvalStatus`；`:101` `if (status === 'needs_review' || approvalStatus === 'pending') return '待审';` —— 这是**文档级** `needs_review`/审批 pending，与 chunk 级 `pending_review` 无关；`:105` 兜底也返回 `待审`。**doc 级不会因 chunk `pending_review` 改变**（pipeline 只把被审块落库，doc 仍走 ready 或全待审→failed）。
- Dashboard「待审文档」：`apps/admin/src/app/(ops)/dashboard/_components/dashboard-workspace.tsx:17` `{ key: 'pendingApprovalCount', label: '待审文档' }` —— 审批数，非去重待审。
- 行展开「入库报告」：`apps/admin/src/app/(ops)/documents/_components/documents-workspace.tsx`
  - 报告块 `:1186-1210`；冲突对渲染 `:1200-1202`：
    ```
    1200:  {r.conflictPairs.length > 0
    1201:    ? ` · 冲突 ${r.conflictPairs.map((p) => p.otherDocId).join(', ')}`
    1202:    : ''}
    ```
    **只用 `otherDocId`**，未用 `action` / `heldChunkId`。
  - 「入库阶段」块 `:1171-1183`（账本行，与去重无关）。
- 全 admin 检索 `resolve|Resolve`：命中的写动作只有 feedback（`feedback-workspace.tsx:70,73,117,126,156`）、departments、documents 上传/删除/保存、lib/http。**无 dedupe resolve 调用**。
- 全 admin 检索 `pending_review|dedupe|duplicate|heldChunkId|conflict`：命中仅 `documents-workspace.tsx`（报告渲染）、`jobs.services.ts`/`report.services.ts`/`api.ts`（数据加载）。**无 `pending_review` 字面、无 `heldChunkId`、无 resolve 控件**。
- 镜像亦自认：`docs/module-status/admin.md:41` 「冲突对只展示 `otherDocId`，**无** `pending_review` 二选一控件（该审阅面仍属雾）」；`:10` 「`pending_review` 审阅面**未做**」。

**结论**：运营目前**无法从 admin 可靠发现/区分**某文档存在 `pending_review` 块；报告列表里的「冲突 otherDocId」即使显示，也不区分 `skip_index` 与 `pending_review`。

---

## Q5 权限与审计：处置动作是否有审计（Pino / 落表）；`doc.editor` 之外的闸；`AUTH_ENFORCE` 关时行为

**一句话结论**：处置动作**无任何审计**——既不落表，也不打 `admin_write` Pino（中间件白名单不含该路径），路由内也无 `logger` 调用。`doc.editor` 之外还有「KB 成员闸（`always`）」与「super_admin 旁路」。`AUTH_ENFORCE=false` 时该端点**仍**要求 Bearer 登录 + `doc.editor` + 成员（因挂 `requirePermission` 而非 `WhenEnforced`）；与 `GET …/ingest-jobs`（WhenEnforced）行为不同。

证据：

- 无审计：
  - 审计中间件白名单：`apps/api/src/middleware/admin-write-audit.ts:19-40` `shouldAuditAdminWrite`，覆盖 members / approve|reject / lifecycle / `/api/v1/admin/` / PATCH settings / POST documents/write。路径 `/documents/:docId/dedupe-conflicts/:chunkId/resolve`（POST）**不匹配任一模式** → 不产 `admin_write`。
  - 路由体内无 `logger`（`documents/index.ts:640-674` 未见 log 调用；对比 `PUT …/acl` 在 `:880` 打 `logger.info('doc_acl_tightened')`）。
  - 全仓 `admin_write|adminWrite|audit` 命中：`app.ts`（挂载）、`admin-write-audit.ts`、`chunk-strategies.ts`/`kb-settings.ts`（KB settings 审计表，均与 dedupe 无关）。
- 除 `doc.editor` 外的闸：
  - 成员闸 `docMemberDenied(c, chunk.kbId, 'always')`（`documents/index.ts:656-659`）→ `createDocMemberGate`（`auth/doc-scope.ts:41-56`），`super_admin` 旁路（`evaluateKbMember`，`middleware.ts:239`）。
- `AUTH_ENFORCE` 关时：
  - `requirePermission` 始终执行 `ensureAuth`（`middleware.ts:258-259`）+ `checkPermission`（`:266`），**不看** `AUTH_ENFORCE` → 关时仍 401/403。
  - 成员闸姿态 `'always'`（`doc-scope.ts:43` `if (posture === 'whenEnforced' && !isAuthEnforceEnabled()) return null;` —— `always` 不受影响）。
  - 对照：`GET …/ingest-jobs` 用 `requirePermissionWhenEnforced('doc.view')`（`:904`）+ 成员闸 `'whenEnforced'`（`:910`）→ `AUTH_ENFORCE=false` 时**放行**（`requirePermissionWhenEnforced` `middleware.ts:296-301`）。
  - 镜像亦记：`api.md:34`「`requirePermission` 系（…去重二选一…）始终查；`WhenEnforced` 系随 `AUTH_ENFORCE`」。

---

## Q6 镜像口径：逐条抄原文并标注与源码一致与否

> 采信序（`README.md:34`）：源码 > 状态文档旧文 > task 叙事 > spec 顶部现状。
> 「无查询面」类：`GET …/ingest-jobs` 只读 API **已落**（源码见 Q7），下列相关行大多为**过期/漂移**。

### 6.1 `docs/module-status/worker.md`

| 行 | 原文（节选，逐字） | 与源码 |
|----|-------------------|--------|
| `:47` | 「`pending_review` 时冲突块**落库入审**（`dupe_status=pending_review` + `duplicate_of`）但**不进 manifest** → 不 embed / 不 ES，报告冲突对带 `heldChunkId` 供运营二选一」 | **部分不符**：`dupe_status` 是笔误，实际列名 `dedupe_status`（`chunks.ts:23`）。其余（落库、不进 manifest、带 heldChunkId）与源码一致。 |
| `:65` | 「**有** `pending_review` 冲突对（带 `heldChunkId`）但**无**（worker 侧）自动处置（人工二选一见 api `POST …/dedupe-conflicts/:chunkId/resolve`） / 聚合指标 / 审阅面」 | **一致**（就 worker 侧而言）：worker 无自动处置；resolve 在 api。 |
| `:84` | 「`ingest_jobs` 完整运维账本 \| **最小 stage 写已有**；无查询面 / 无 api 入队 `queued`」 | **漂移**：`GET …/ingest-jobs` 只读 API 已落（`documents/index.ts:901-917` + `services/ingest-jobs.ts`），「无查询面」不再成立；「无 api 入队 queued」需单独核实（未在本任务范围）。 |
| `:85` | 「入库报告完整语义…（可含 `pending_review` + `heldChunkId`）…已落；**无**（worker 侧）自动处置 … / 聚合指标 / 审阅面 / 生产 LSH / Hit@k / 「高度重复」阈值提示」 | **一致**（worker 侧）。 |
| `:102` | 「**幂等+账本+锁最小已接 · 运维查询仍欠** \| stage 行可写；同 doc SET NX 互斥；**无运维查询面** / 非 Redlock」 | **漂移**：basic 只读查询面已落（同上）；「完整/运维查询面」措辞可保留，但「无查询面」字面已不准。 |

### 6.2 `docs/module-status/db.md`

| 行 | 原文 | 与源码 |
|----|------|--------|
| `:38` | 「`ingest_jobs`：schema 已有；**worker** `job-ledger` 按阶段边界最小写（**非**本包服务层；**无查询 API**；同 doc 锁在 worker Redis 侧）」 | **漂移（前半）**：api 已有 `GET …/ingest-jobs` 读 HTTP 面（`services/ingest-jobs.ts`），「无查询 API」不再成立；「非本包服务层 / 锁在 worker Redis」仍成立。 |
| `:70` | 「`ingest_jobs` 完整运维账本 \| 表有；worker 最小写；**查询面无**（锁见 worker Redis）」 | **漂移**：同上，api 读端点已落。 |
| `:85` | 「`ingest_jobs` 最小写 ≠ 生产账本 \| 易被抬成熟度 \| **查询 / 入队 queued 仍欠**；锁最小见 worker `doc-lock`」 | **部分漂移**：查询面（只读）已落，「查询仍欠」不准；「入队 queued 仍欠」需单独核实。 |
| `:9`（最近更新） | 提及 `0021` `chunks.duplicate_of` / `dedupe_status`（无默认） | **一致**（与 `0021_chunks_dedupe_review.sql:4-5` 相符）。 |
| `:39` | `conflictPairs` 形状 = `{otherDocId, otherChunkId, action: skip_index\|pending_review, heldChunkId?}` | **一致**（`ingest-reports.ts:5-11`）。 |

### 6.3 `docs/module-status/api.md`

| 行 | 原文 | 与源码 |
|----|------|--------|
| `:34` | 「…**读面 5 个**（`GET /documents/:docId`、`…/acl`、`…/ingest-jobs`、`…/chunks`、`…/chunks/:chunkId`，同日补）…」 | **一致**：承认 `…/ingest-jobs` 读入口存在。 |
| `:47` | 「`POST /documents/:docId/dedupe-conflicts/:chunkId/resolve`…body `{ winner: 'this' \| 'other' }`；权限 `doc.editor`…仅 `dedupe_status='pending_review'`…**只动 `chunks` 两列**，`winner='this'` 清 `duplicate_of` 并回 `reindexRequired: true`…**不代跑 reindex**…**不碰对方文档**」 | **一致**（对照 `documents/index.ts:640-673` + `dedupe-conflict.ts:60-110`）。 |
| `:48` | 「`GET /api/v1/knowledge-bases/:kbId/ingest-report`…成员闸 + `doc.view` WhenEnforced…」 | **一致**（`routes/ingest-report.ts:26-31`）。 |
| `:168` | 「…**有** `pending_review` 冲突对（带 `heldChunkId`，可经 `POST …/dedupe-conflicts/:chunkId/resolve` 人工二选一）但**无**自动处置 / **无**聚合指标、**无** admin 审阅面 / L0 vs L1 Hit@k /「高度重复」阈值提示」 | **一致**（admin 无审阅面，见 Q4）。 |

### 6.4 `docs/module-status/admin.md`

| 行 | 原文 | 与源码 |
|----|------|--------|
| `:10` | 「…`pending_review` 审阅面**未做**」 | **一致**。 |
| `:41` | 「…冲突对只展示 `otherDocId`，**无** `pending_review` 二选一控件（该审阅面仍属雾）」 | **一致**（`documents-workspace.tsx:1200-1202` 只用 `otherDocId`；全 admin 无 resolve 调用）。 |

### 6.5 `docs/module-status/README.md`

| 行 | 原文 | 与源码 |
|----|------|--------|
| `:82` | 「…入库 `ingest_jobs` 完整运维查询面（stage 最小写 + 同 doc SET NX 锁最小已有；非 Redlock）…」列为「尚未交付」 | **部分漂移**：只读查询面已落；若措辞指「完整运维查询面」则仍可成立，但读者可能误读为「无查询面」。 |

### 6.6 `docs/testing/coverage/03-ops.md`

- 检索 `无审阅|无查询|无自动|审阅面|查询面|自动处置|admin 审阅` 仅 1 命中且无关：`:42`「恢复演练，无自动化。」
- **结论**：`03-ops.md` **没有**「无审阅面 / 无查询面 / 无自动处置」类行。相关账本可见面记载在**另一册** `docs/testing/coverage/01-ingest.md:31`（L5 行）：「…**无** Bull Board UI，账本行等价可见面；账本仍无 api 入队 `queued`」——该行**未提**已落的 `GET …/ingest-jobs` 读端点（亦属漏记，但非本任务指定的 03-ops.md）。

---

## Q7 相邻：`GET …/ingest-jobs` 的权限码 / 暴露面

**一句话结论**：权限码 `doc.view`（`requirePermissionWhenEnforced`，随 `AUTH_ENFORCE`）；成员闸 `whenEnforced`；返回**该 doc 的全部账本行**（按 `createdAt` 倒序、上限 20），成员即可读全量账本，无逐级过滤。

证据：

- 路由：`apps/api/src/routes/documents/index.ts:901-917`
  - `:903` `'/documents/:docId/ingest-jobs',`
  - `:904` `requirePermissionWhenEnforced('doc.view'),`
  - `:908-910` 取 doc → 成员闸 `docMemberDenied(c, doc.kbId, 'whenEnforced')`
  - `:914` `const data: IngestJobListItem[] = await ingestJobsRepo.listByDocId(docId);`
- 服务：`apps/api/src/services/ingest-jobs.ts:24-42` `listByDocId`：`where eq(docId)`、`orderBy desc(createdAt)`、`limit(20)`；映射 `toIngestJobListItem`（`:7-22`）返回 `id/docId/jobName/status/errorMessage/indexVersion/createdAt`。
- DTO 契约：`packages/contracts/src/ingest/ingest-job.contract.ts:4-13` `IngestJobListItemSchema`。
- 暴露面：无 role/dept 过滤，凡该 KB 成员（或 super_admin）即可读该文档全量（最近 20 条）账本；`AUTH_ENFORCE=false` 时连登录都不要求（见 Q5）。

---

## Q8 测例存货（`tests/` 与 `tests/index.md` 登记）

**一句话结论**：链路覆盖较全——worker 侧有 `pending_review` 落库/报告/策略回落测；api 侧有 resolve 单测 + 成员闸测 + 报告 HTTP 测；contracts 侧有报告/策略码契约测，但 **`ResolveDedupeConflict*` 无 contracts 级契约测**；**无**「待审冲突列表」测（因无该端点）；**无** dedupe resolve 的审计测（因无审计）。

证据：

- worker（`apps/worker/tests/ingest/`，登记 `apps/worker/tests/index.md:54-56`）：
  - `cross-doc-pending-review.test.ts`（`index.md:55`）：pending_review 落库入审但不进 manifest；held 行带 `dedupe_status`/`duplicate_of`；报告冲突对带 `heldChunkId`；全文待审→不得 ready；脏值回落 skip_index。实质断言见该文件 `:193-255`。
  - `cross-doc-dedupe.test.ts`（`index.md:56`）：3-gram Jaccard≥0.9 命中；跨 KB/archived 不比。
  - `cross-doc-skip-index.test.ts`、`ingest-report.test.ts`（`index.md:54`：去重率与计数同源、分母 0→null）。
- api（`apps/api/tests/`）：
  - `ingest/dedupe-conflict-resolve.test.ts`（`apps/api/tests/index.md:153`）：winner=other 保留 `duplicate_of`；winner=this 清并回 `reindexRequired`；非待审 400 / 不存在 404 / 坏 body 400。
  - `acl/doc-write-kb-member-gate.test.ts`（`index.md:41`）：非成员 403 且不落决定；成员 200 ——路径含 `…/dedupe-conflicts/…/resolve`。
  - `acl/doc-read-kb-member-gate.test.ts`（`index.md:39`）：`…/ingest-jobs` 非成员 403 / 成员 200（`:213-223`）。
  - `ingest/jobs-query.test.ts`（`index.md:169`）：`toIngestJobListItem` 映射契约（**仅纯函数，不覆盖 HTTP 路由**）。
  - `ingest/ingest-report-http.test.ts`（`index.md:174`）、`ingest/ingest-report-map.test.ts`（`index.md:175`）。
- contracts（`packages/contracts/tests/`）：
  - `ingest/ingest-report-contract.test.ts`（`packages/contracts/tests/index.md:49`）。
  - `kb/cross-doc-dedupe-action.test.ts`（`index.md:50`）。
  - **缺**：`packages/contracts/tests/ingest/` 目录（实列）**无** `dedupe-conflict*.test.ts` → `ResolveDedupeConflictBody/ResponseSchema` 无 contracts 级契约测。
- admin（`apps/admin/tests/ops/`）：
  - `ingest-report.test.tsx`（`apps/admin/tests/index.md:45`）：报告行展示、去重率标签（`dedupeRateLabel`）。
  - `documents-workspace.test.tsx` / `documents-needs-ocr.test.tsx`：mock `loadIngestJobs`（未断言去重处置）。
  - **无** dedupe resolve / 审阅面测例（与 Q4 无 UI 一致）。

---

## 核实中发现的镜像漂移

> 以下均为「镜像与源码不符」；应改内容给出建议文本（不代改文件）。

1. **`docs/module-status/worker.md:84`** — 原文：「`ingest_jobs` 完整运维账本 \| **最小 stage 写已有**；无查询面 / 无 api 入队 `queued`」。**应改**：「无查询面」→ 已落 `GET /api/v1/documents/:docId/ingest-jobs`（只读、`doc.view` WhenEnforced、成员闸，`apps/api/src/routes/documents/index.ts:901-917` · `apps/api/src/services/ingest-jobs.ts:24-42`）；保留「无 api 入队 `queued`」（未在本次核实范围）。
2. **`docs/module-status/worker.md:102`** — 原文含「**无运维查询面**」。**应改**：改为「只读查询面已落（GET ingest-jobs）；完整运维/Bull Board 面仍欠」。
3. **`docs/module-status/db.md:38`** — 原文「**无查询 API**」。**应改**：api 已有 `GET …/ingest-jobs` 读端点；DB 包本身不提供查询服务层的表述可保留。
4. **`docs/module-status/db.md:70`** — 原文「**查询面无**」。**应改**：`GET …/ingest-jobs` 已落（附源码锚点）。
5. **`docs/module-status/db.md:85`** — 原文「**查询 / 入队 queued 仍欠**」。**应改**：查询（只读）已落，仅「入队 queued」待核。
6. **`docs/module-status/README.md:82`** — 把「入库 `ingest_jobs` 完整运维查询面」列入「尚未交付」。**建议**：区分「只读账本查询面（已落）」与「完整运维查询面（未交付）」，避免读者误读为「无查询」。
7. **`docs/module-status/worker.md:47`** — 笔误 `dupe_status=pending_review`。**应改**：列名应为 `dedupe_status`（`packages/db/src/schema/kb/chunks.ts:23`）。
8. **`docs/testing/coverage/01-ingest.md:31`（L5 行）** — 只记「账本仍无 api 入队 `queued`」，未提已落的 `GET …/ingest-jobs` 读端点。**建议**：补记该读面（本任务指定的 `03-ops.md` 内**无**此类行，见 Q6.6）。

> 一致项（无需改）：`worker.md:65/:85`（worker 侧无自动处置/无审阅面）、`api.md:34/:47/:48/:168`、`admin.md:10/:41`、`db.md:9/:39`。

---

## 未能核实 / 需下游确认

1. `ingest_jobs` 「api 入队 `queued` 是否已落」——本次未核 `apps/api` 入队写 `ingest_jobs.status='queued'` 的路径；镜像多处保留该「仍欠」表述，**未核实**。
2. `ingest_jobs` 读端点的 HTTP 级端到端测例——`apps/api/tests/ingest/jobs-query.test.ts` 只测纯函数映射；端点 HTTP 仅被 `acl/doc-read-kb-member-gate.test.ts:213-223` 间接触达，**未核实**是否存在更强的 schema/字段级 HTTP 断言。
3. contracts 对 `ResolveDedupeConflictBody/ResponseSchema` **无** dedicated 契约测（已由目录实列判定为「缺」）——是否需要补测属工单 02 裁定，**本核实只报现状**。
4. 审计：`resolve` 无 Pino/落表已核；但**是否存在其它集中式审计**（如 ask/写路径统一事件流）覆盖此动作——本次检索未覆盖全部中间件链，按现有证据判「无」，**若下游需要 100% 结论需再核 `app.ts` 完整中间件栈**。
