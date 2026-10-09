# 现状核实：检索语料装载的租户来源链与影响面

Type: research（只读核实）
范围：`D:\projects\ai-stared-project\StrictRAG`
方法：静态阅读源码 + 测试夹具；**未**执行 build / test / Install（按工单只读约束）。

约定：下文 `路径:行号` 均为核实当日工作区快照；「未核实」= 未取得可核对证据。

---

## 1. 反推点：`corpus.ts` 的 `tenantId` 来自哪一行

**结论**：取自语料装载时**已完成双闸门过滤后的第一篇文档行**（`dual[0].tenantId`），表达式为 `dual[0]?.tenantId`；`dual` 为空时该值为 `undefined`（可选链）。

证据：
- `apps/api/src/services/retrieve/corpus.ts:64` — `const docs = await db.select().from(documents).where(eq(documents.kbId, kbId));`（**只按 kbId 查，无 tenant 条件**）。
- `apps/api/src/services/retrieve/corpus.ts:66` — `const dual = filterDocsForRetrieve(docs, scope);`（ready∧active∧生效窗口∧docTypes 过滤）。
- `apps/api/src/services/retrieve/corpus.ts:69` — `const subject = { tenantId: dual[0]?.tenantId, userId, bypass: bypassDeptAcl === true };`。
- 若 `dual.length === 0`：`dual[0]` 为 `undefined`，`?.tenantId` → `undefined`。注意此时下方 `if (allowed.length === 0) return [];`（`corpus.ts:81`）之前仍会先执行一次 `loadVisibilityContext`（见第 2 节）。

---

## 2. 该 `tenantId` 传给谁、用来做什么

**结论**：只传给 `loadVisibilityContext`（作为 `subject.tenantId`），进而决定部门归属 / 部门树 / grant 的加载租户；随后 `filterVisibleDocs` 用它做可见性过滤。**不传给 ES sparse**。

证据（`apps/api/src/services/retrieve/corpus.ts`）：
- `:69` 装入 `subject.tenantId`。
- `:71-77` `const ctx = await loadVisibilityContext({ subject, enforce, inheritDown: ... })`。
- `:79` `const allowed = filterVisibleDocs(dual, subject, ctx);`（`filterVisibleDocs` 经 `isDocVisible` 使用 `subject`；`visibility.ts:66-89`）。
- 该 `tenantId` **未**出现在 sparse/es 路径（对比 `retrieve.ts:199` ES 传的是 `input.tenantId`，见第 6 节）。

`loadVisibilityContext` 内的消费点（`apps/api/src/services/retrieve/visibility.ts`）：
- `:46-55` 函数定义；`:54-56` `if (!enforce || subject.bypass)` 短路返回空 ctx（不查库）。
- `:58-61` `loadDeptAssignments(subject.tenantId, subject.userId)` / `loadDeptNodes(subject.tenantId)` / `loadDeptGrants(subject.tenantId, subject.userId)`。

`dept-acl.ts` 对 `undefined` 的处理（`apps/api/src/services/retrieve/dept-acl.ts`）：
- `:228-234` `loadDeptAssignments`：`if (!tenantId || !userId) return [];`。
- `:239-241` `loadDeptNodes`：`if (!tenantId) return [];`。
- `:246-251` `loadDeptGrants`：`if (!tenantId || !userId) return [];`。
（即 `dual` 空 / 文档行缺租户时，部门三连返回空 → 方向 fail-closed，只见「空部门」文档。）

---

## 3. `RetrieveInput.tenantId` 的来源链（入口 → graph → retrieve）

**结论**：`tenantId` 在 ask 路由由 `auth.tenantId ?? kb.tenantId` 决定，逐层透传到 `RetrieveInput`；但 `runRetrieve` 调用 `deps.loadCorpus` 时**未**把它传下去（`CorpusLoader` 入参类型里根本没有 `tenantId`）。

逐层证据：
- 入口：`apps/api/src/routes/ask.ts:316` — `const tenantId = auth.tenantId ?? kb.tenantId;`。
- 路由 → executeAsk：`apps/api/src/routes/ask.ts:359-366`（同步）与 `:386-394`（SSE）传入 `tenantId`。
- executeAsk → 图：`apps/api/src/services/ask/execute.ts:196` — `runAskGraph({ ... tenantId: params.tenantId ... })`（另 `:137-142` 用 `params.tenantId` 选网关并建 `createDefaultRetrieveDeps`）。
- 图 state：`apps/api/src/graph/state.ts:33` / `:50`（`AskGraphInput.tenantId` / `AskGraphState.tenantId`）、`:134` `tenantId: input.tenantId`。
- run → retrieveInput：`apps/api/src/graph/run.ts:309` — `tenantId: state.tenantId`。
- 派发：`apps/api/src/graph/run.ts:320`（`deps.retrieve`）/ `:322`（`runRetrieve(retrieveInput, deps.retrieveDeps)`）。
- `RetrieveInput` 定义：`apps/api/src/services/retrieve/types.ts:39-51`（`:40` `tenantId: string`）。
- **断点**：`apps/api/src/services/retrieve/retrieve.ts:138-143` — `await deps.loadCorpus({ kbId: input.kbId, scope: input.scope, userId: input.userId, bypassDeptAcl })`；**无 tenantId**。`CorpusLoader` 入参 `types.ts:76-84` 亦无 `tenantId` 字段。

---

## 4. `loadCorpusFromDb` / `CorpusLoader` 的全部调用点

**结论**：生产装载点只有 2 处显式调用 `loadCorpusFromDb`（`retrieve.ts` 默认 deps + `seed-es-sparse-probe.ts` 脚本）；其余为单测注入。`retrieve.ts` 侧**拿得到** `input.tenantId`（但没传），脚本侧**另行反推** `firstDoc.tenantId`。

生产调用点：
1. `apps/api/src/services/retrieve/retrieve.ts:344` — `loadCorpus: loadCorpusFromDb`（写入默认 deps）。实际触发在 `:138`（主）与 `:147`（docTypes 落空时的无约束补查）。**能否拿到 tenantId**：能——`runRetrieve(input)`，`input.tenantId` 就在同作用域（`retrieve.ts:119` 参数、`:199` ES 已用它），但未下传。
2. `apps/api/src/scripts/seed-es-sparse-probe.ts:47` — `loadCorpusFromDb({ kbId })`。**能否拿到 tenantId**：能，但脚本另行反推——`:51-62` 查 `documents.tenantId` 得 `firstDoc.tenantId`，`:68-70` 直接把它写进 bulk 源，未回传 corpus 装载。
3. 间接入口（经 `executeAsk → graph → runRetrieve`）：`apps/api/src/scripts/run-l1-golden.ts:678/:685/:693`（`opts.execute ?? executeAsk`、`tenantId = opts.tenantId ?? L1_TENANT_ID ?? 默认`）、`apps/api/src/scripts/run-l2-golden.ts:233`。这些**有** tenantId 并进入 graph。
4. `apps/api/src/scripts/ingest-eval-corpus.ts` — **不调用** `loadCorpusFromDb`（全文无该符号）；其 `tenantId`（`:454`）只在入库侧。非本函数调用点。

测试注入点（`CorpusLoader` 或直接 `loadCorpusFromDb`）：
- `apps/api/tests/acl/dept-acl-ask-e2e.test.ts:153`（`loadCorpus: loadCorpusFromDb`）、`:166`（直接 `loadCorpusFromDb({ kbId: KB, userId: USER })`）；mock `db.js` 的 `where` **忽略入参**、恒返回全夹具（`:100-115`）。
- `apps/api/tests/acl/visibility-single-function.test.ts:207`（`loadCorpusFromDb({ kbId: KB, userId: USER, bypassDeptAcl: bypass })`）；mock `db.js` 同样忽略 `where` 入参（`:92-106`）。
- 注入自定义 `loadCorpus`（多为恒返回固定 corpus，不看输入）：`ask/retrieve-run.test.ts:55/104/162/225/245/450`、`ask/es-dept-query-filter.test.ts:102`、`ask/es-principals-query-filter.test.ts:83`、`ask/embed-budget.test.ts:46`、`ask/sparse-kb-filter.test.ts:55`、`ask/mongo-body.test.ts:36`、`ask/scope-hr-excludes-finance.test.ts:60/94`、`ask/pending-not-retrievable.test.ts:47`、`ask/needs-ocr-not-retrievable.test.ts:48`、`acl/acl-tighten-index-lag.test.ts:55`、`ingest/upload-to-active-retrievable.test.ts:164`。
- 纯函数路径（不装载）：`ask/ready-active-corpus.test.ts`、`ask/effective-window-corpus.test.ts`（测 `filterDocsForRetrieve`）。

---

## 5. `documents` 租户列 schema 与写路径

**结论**：`documents.tenant_id` 为 **NOT NULL**；两条建档写路径（upload-url / write）都强制写 **KB 的行租户** `kb.tenantId`；`complete` 及所有 `update(documents)` 路径**都不改写** `tenant_id`。未见由请求体/令牌直接写 `tenant_id` 的面。

证据：
- schema：`packages/db/src/schema/kb/documents.ts:11` — `tenantId: uuid('tenant_id').notNull()`。
- 建档唯一入口：`apps/api/src/services/documents.ts:143-167` `insertUploadedDoc`，`:154-156` `insert(documents).values({ ... tenantId: input.tenantId ... })`。
- 生产调用仅两处，均传 `kb.tenantId`：
  - upload-url：`apps/api/src/routes/documents/index.ts:200-210`（`:203` `tenantId: kb.tenantId`）。
  - write：`apps/api/src/routes/documents/index.ts:326-340`（`:333` `tenantId: kb.tenantId`）。
- complete：`apps/api/src/routes/documents/index.ts:258-279` → `finalizePendingIngest`（`services/ingest-complete-pending.ts`）；该服务以 `doc.tenantId` 仅作限流键（`:289`），**不写** `tenant_id`。
- 全部 `update(documents)`：`services/documents.ts:172/190/214/226/234/239/246/250/263/298`，`set` 均只含业务列（objectKey/审批/lifecycle/策略/patchMeta 的六列），**无 `tenantId`**。
- 跨仓写入面：仓库内 `insert(documents)` / `insertUploadedDoc` 仅出现在上列 api 两处（grep 全仓 `.ts`）。

次要观察（非本次结论）：write/upload-url 以 URL `:kbId` 取 `kb` 后即用 `kb.tenantId` 建档，代码路径中**未**断言「`kb.tenantId === 调用方 auth.tenantId`」；租户一致性依赖 KB 成员/权限闸（`docMemberDenied` / `requirePermissionWhenEnforced`）。

---

## 6. 既有闸：ES `requireTenantId` 今天从哪个变量取 `tenantId`

**结论**：ES 侧 `requireTenantId` 取的是**入口租户 `input.tenantId`**（`RetrieveInput` → `sparseSearch` → `buildAclFilter`），**不是** corpus 反推的 `dual[0].tenantId`。故「ES 必填」只保证 ES 查询带入口租户，**挡不住** PG 侧的反推（反推值根本未流到 ES）。

证据：
- `apps/api/src/services/retrieve/retrieve.ts:199` — sparse 调用 `tenantId: input.tenantId`（`input` 为 `runRetrieve` 的入口入参）。
- `apps/api/src/services/retrieve/retrieve.ts:89-95`（`sparseNarrowingForSearch`）另建 `loadVisibilityContext({ subject: { tenantId: input.tenantId, ... } })`，同样用入手租户。
- `apps/api/src/services/retrieve/types.ts:85-98`（`SparseSearcher` 入参含 `tenantId`）。
- `apps/api/src/services/retrieve/es-sparse.ts:51-57` `requireTenantId`（缺/空/空白即抛 `config`）；消费点 `:200-206` `buildAclFilter` 首元素 `{ term: { tenantId: requireTenantId(...) } }`；写侧 `:138` `sparseBulkSource`。
- 对照：corpus 反推值只在 `corpus.ts:69` → `loadVisibilityContext`（PG 部门/名单可见性），**两条路径的租户来源不一致**。

---

## 7. 影响面：若语料查询加 `eq(documents.tenantId, tenantId)`

**结论**：就**运行时**断言而言，**没有既有测例会变红**——原因是所有走 `loadCorpusFromDb` 的测例都把 `db.js` 的 `where` mock 成「忽略入参、恒返回全夹具」，新增谓词在 mock 下不生效；真正会红的是 **类型检查**（若把 `tenantId` 设为 `CorpusLoader` 必填，则多处调用点未传 → `pnpm check-types` 失败）。此外**无**夹具**故意**造「文档行租户 ≠ 入口租户」。

依据：
- mock 忽略 `where` 入参：`apps/api/tests/acl/dept-acl-ask-e2e.test.ts:100-115`、`apps/api/tests/acl/visibility-single-function.test.ts:92-106`（`where: async () => { if (table === tables.documents) return store.documents; ... }`）。新增 tenant 谓词不会被 mock 执行，断言集合不变。
- 未传 `tenantId` 的调用点（若改必填即类型红）：`apps/api/tests/acl/dept-acl-ask-e2e.test.ts:166`、`apps/api/tests/acl/visibility-single-function.test.ts:207`、`apps/api/src/scripts/seed-es-sparse-probe.ts:47`，以及生产侧 `apps/api/src/services/retrieve/retrieve.ts:138`/`:147`（这两处是待改点）。
- 最接近「异常租户」的夹具只有**空串**、且是 fail-closed 方向：`apps/api/tests/acl/dept-acl-ask-e2e.test.ts:326-341`（`文档行缺 tenantId → 归属/授权查不到，部门文档不可见`，断言只余 `DOC_LIB`）。**未见**任何夹具把文档行租户设成与入口租户不同的**另一非空租户**。
- 反之，若把 mock 改成「忠实执行谓词」，则 `dept-acl-ask-e2e` / `visibility-single-function` 里以 `loadCorpusFromDb({ kbId, userId })`（无 tenantId）的调用会因 `tenant_id = NULL` 恒不匹配而语料清空 → 那时会红（但这是改 mock 的后果，不是当前仓库的红）。

受影响的既有测例清单（需复核但当前不改即绿）：`acl/dept-acl-ask-e2e.test.ts`、`acl/visibility-single-function.test.ts`、`ask/ready-active-corpus.test.ts`、`ask/effective-window-corpus.test.ts`、`ask/retrieve-run.test.ts`、`ask/es-dept-query-filter.test.ts`、`ask/es-principals-query-filter.test.ts`、`ask/es-builder-tenant-required.test.ts`、`ask/sparse-kb-filter.test.ts`、`ask/scope-hr-excludes-finance.test.ts`、`ask/pending-not-retrievable.test.ts`、`ask/needs-ocr-not-retrievable.test.ts`、`acl/documents-acl-principals.test.ts`。

---

## 8. 既有测例存货与 `tests/index.md` 登记

**结论**：与 corpus / 可见性上下文相关的测例均在 `apps/api/tests/{ask,acl}/`，且 `tests/index.md` 逐行登记（状态「现行」），`待处理` 为空。

索引登记（`apps/api/tests/index.md` 行号）：
- `:32` `acl/dept-acl-ask-e2e.test.ts`（“tenantId 缺失 fail-closed”字样，L32 简介）。
- `:33` `acl/acl-tighten-index-lag.test.ts`（PG 语料求交）。
- `:50` `acl/retrieve-dept-acl.test.ts`。
- `:54` `acl/visibility-single-function.test.ts`。
- `:61-63` `ask/es-sparse-probe.test.ts` / `ask/es-dept-query-filter.test.ts` / `ask/es-principals-query-filter.test.ts` / `ask/es-builder-tenant-required.test.ts`。
- `:81` `ask/needs-ocr-not-retrievable.test.ts`、`:82` `ask/pending-not-retrievable.test.ts`、`:86` `ask/ready-active-corpus.test.ts`、`:87` `ask/effective-window-corpus.test.ts`、`:90` `ask/retrieve-run.test.ts`、`:94` `ask/sparse-kb-filter.test.ts`、`:92` `ask/scope-hr-excludes-finance.test.ts`。
- `:186` `acl/documents-acl-principals.test.ts`（含“retrieve 语料不含未授权文档”）。
- 末尾「## 待处理」：`（无。src/ 下已无 *.test.ts(x)。）`。

---

## 本图落地时的风险点清单

1. **租户来源二元化（核心）**：PG 可见性上下文用「文档行反推租户」（`corpus.ts:69`），ES 查询用「入口租户」（`retrieve.ts:199`）。两者不一致时，PG 可见集与 ES 收窄口径可能错配。落地时应让**两者同源**（推荐统一为入口 `input.tenantId`）。
2. **语料查询无租户条件**：`corpus.ts:64` 只按 `kbId` 取行；若某 kbId 下混入异租户文档行（尽管写入侧应强制 KB 租户），这些行会先进入候选再受部门/名单闸；加 `eq(documents.tenantId, tenantId)` 是纵深防御。
3. **`dual` 为空时的 `undefined` 传播**：`tenantId=undefined` 经 `dept-acl` 三连返回空 → 只见空部门（fail-closed），行为可接受但依赖下游 `!tenantId` 早退；若未来下游改成必填/抛错会改语义。
4. **类型改动会波及其调用面**：`CorpusLoader` 加必填 `tenantId` 会牵动 `retrieve.ts:138/147`、`seed-es-sparse-probe.ts:47` 及两个 e2e 测例；建议同步更新这些点与 `tests/index.md`。
5. **测试保护力不足**：装载测例普遍 mock `where` 忽略入参，新增租户谓词**不会**被现有 mock 守住；需新增“忠实谓词”的夹具或直接断言入参 `tenantId` 透传，否则改动无回归保护。
6. **脚本旁路**：`seed-es-sparse-probe.ts` 自行反推 `firstDoc.tenantId`（`:51-70`），与 corpus 走同一反推模式；统一入口租户时该脚本需一并收口或显式传参。
7. **写路径未断言跨租户**：write/upload-url 用 `kb.tenantId`（正确），但未校验 `kb.tenantId === auth.tenantId`；异租户可见同一 kbId 时的可写性取决于成员/权限闸，非本次图范围，但影响“加租户过滤是否会误伤”的判定。

## 未能核实

- 新增 `eq(documents.tenantId, tenantId)` 在真实 Drizzle 下 `tenantId=undefined` 生成的 SQL（`= NULL` 恒假 vs 省略）——按只读约束未执行 build/单测，未取得运行证据。
- worker 侧是否存在 `documents` 租户写/改面：本次范围是 api 写路径（complete/write/upload-url）；全仓 grep 未发现 worker 写 `documents`，但未逐文件通读 worker 入库链。
- `kb.tenantId` 与 `auth.tenantId` 在生产是否可能不一致（取决于 KB 成员/权限闸与多租户实际部署）——仅定位到「未显式断言相等」，未追完 `requirePermission` / KB 成员校验对租户的约束。
- `run-l2-golden.ts` 的 tenantId 注入细节仅见 `:233` 一行，未展开确认其是否默认值通路与 L1 完全一致。
