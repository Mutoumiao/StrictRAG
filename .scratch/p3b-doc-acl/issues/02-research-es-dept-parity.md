# 研究：dense ∥ ES 对称与 ES 部门字段的差额性质

Type: research
Status: resolved
Blocked by: —

## 问题

ADR-009 `prds/11-decisions/00-adr-index.md:152` 要求 dense 与 ES **共用 `buildAclFilter(ctx)`**；ES PRD `prds/03-data/03-elasticsearch-bm25.md:75-77`、`:119`、`:163` 要求部门条件含 `ownerDeptId` **与 `visibilityLevel` 比较**、与 dense 对称、共用同一 filter 生成器。现状差额：

- `buildAclFilter` 定义在 `apps/api/src/services/retrieve/es-sparse.ts:120-138`，唯一生产调用点 `:234`（`searchSparseEs`）。dense 是进程内余弦，输入即 PG 语料（`apps/api/src/services/retrieve/retrieve.ts:163-170`），**从不调用** `buildAclFilter`。
- ES mapping 只有 `chunkId / tenantId / kbId / docId / ownerDeptId / aclPrincipals / sparseText`（`es-sparse.ts:53-61`），**无** `visibilityLevel`。
- 缺 `ownerDeptId` 时 bulk 不写字段（`es-sparse.ts:89-90`），而 PG 语义是「文档无 owner_dept_id = 库内成员可见」（ADR-057 `:1856`）→ 开强制时 `terms ownerDeptId` 匹配不到。
- `aclPrincipals` 是不带前缀的裸 uuid 数组（`packages/db/src/schema/kb/documents.ts:60`），无 ADR-057 `:1861-1864` 的 `user:{id}` / `dept:{deptId}:lv:{n}` 主体形态。
- 部门收窄入口：`retrieve.ts:181-198`（含 `ownerDeptIdsForSparseSearch` `:79-94`）；候选构造 `dept-acl.ts:135-164` `collectVisibleOwnerDeptIds`；防泄漏兜底 `retrieve.ts:195`（ES 命中必须落在 PG 语料内）。

## Answer

### 1. 逐条定性（泄漏侧 / 召回侧）

**① dense 不调用 `buildAclFilter` —— 既非泄漏侧也非召回侧，纯形态差额。**
dense 打分输入就是 `corpus`（`retrieve.ts:163-170`），`corpus` 来自 `deps.loadCorpus`（`retrieve.ts:126`）→ `loadCorpusFromDb` 已在装载期过 `filterDocsForDeptAcl` + `filterDocsForAclPrincipals`（`corpus.ts:85-98`）。dense 可达集合 ⊆ PG 真值集合，既不能多召回也不能额外少召回；差额只在字面（ADR-009 `:152`）。

**② mapping 无 `visibilityLevel` —— 层内泄漏侧，被 `retrieve.ts:195` 兜住；残余召回侧副作用。**
`buildAclFilter` 只下 `terms ownerDeptId`（`es-sparse.ts:132-134`），ES 不比较级别；PG 有 `eff >= vis`（`dept-acl.ts:105-124`）。ES 返回的超集里 `vis > eff` 的命中被 `retrieve.ts:195` 按 `byId` 丢弃（`byId` 由 corpus 建，`retrieve.ts:157`）。副作用：`size: retrieveK`（`es-sparse.ts:222`、`retrieve.ts:189`）下不可读命中**占槽** → 稀疏路有效召回变短。

**③ 缺 `ownerDeptId` 不写字段 —— 召回侧。**
`es-sparse.ts:89-90`（worker 同形 `apps/worker/src/ingest/es-http.ts:76-77`）缺值不写字段；PG 语义「无 owner_dept_id = 库内成员可见」（ADR-057 `:1856`）→ 库级文档留 PG 语料、ES `terms` 不命中。**同源第二面**：`ownerDeptIds` 为空时 dept 条件整体消失（`retrieve.ts:93-94` 把两者都变 `undefined`；`es-sparse.ts:131-134`）→ ES 对部门文档 **fail-open**，属层内泄漏侧，同样被 `:195` 兜住。

**④ `aclPrincipals` 裸 uuid —— 不是泄漏、不是召回损失，是能力缺口（见第 4 节）。**
当前 ES 与 PG **逐位一致**：ES 用裸 `userId` 做 `term`（`es-sparse.ts:99-107` ← `retrieve.ts:191-193`），PG 用 `principals.includes(userId)`（`doc-acl.ts:15`）。哨兵路径逐条对称：null/缺省 → 不写字段 → `must_not exists` 命中 ≡ PG `principals == null → true`（`doc-acl.ts:12-13`）；`[]` → 写 `__acl_none__`（`es-sparse.ts:36`、`:81-93`）→ 字段存在且对真 uuid 无 `term` 命中 ≡ PG `length === 0 → false`（`doc-acl.ts:15-16`），PG 列是 `uuid[]`（`packages/db/drizzle/0014_p3b_acl_principals.sql:1`）故哨兵串不可能成为真实 userId → 无泄漏通道；有字段但调用方无 userId → 只 `must_not exists` ≡ PG `userId == null → false`（`doc-acl.ts:17`）。

**`:195` 是否把泄漏侧全部兜住：是 —— 但仅以「ES 命中只用于排序」为条件。**
它是全仓唯一收口：`sparseRanked` 仅经 `:195` 后进入 `rrfFuse`（`:220`）与 `sparseRankOf`（`:279`）；candidates 由 corpus 建（`:234-242`），evidence 由 candidates 派生（`:282-306`），正文按 candidates 的 chunkId 取 Mongo（`:246-258`）。它是**后置过滤而非查询条件**：一旦 ES 命中被用于计数 / 渲染 / 直接喂 PG-Mongo 查询，或 `byId` 不再等于 ACL 真值源，兜底即失效。

### 2. 「dense ∥ ES 对称」的可核对解释

**(a) dense 查询期落 filter：需要 pgvector，今天不存在。**
本仓 dense 取候选**不是** pgvector SQL，而是「PG 全量取向量进内存 + JS 余弦」：`corpus.ts:117-121` 一次 `select` 该 KB 全部 `chunk_embeddings`（jsonb `number[]`，`packages/db/src/schema/kb/chunk-embeddings.ts:16`），`retrieve.ts:163-170` 逐个 `cosine()`（`scoring.ts:2`）。DB 无 `vector` 列与扩展（`chunk-embeddings.ts:6` 明写「生产可换 pgvector 列」；`packages/db/drizzle/0000–0022` 无 `CREATE EXTENSION vector`）；pgvector 只出现在镜像（`docker/docker-compose.yml:20`）。
代价：加 `vector(D)` 列 + HNSW + SQL `WHERE`（ACL 谓词）+ `ORDER BY embedding <=> $1`，即把「corpus 装载 = ACL 真值」改成两套来源需防漂移，并需迁移 + 回填既有 jsonb 向量；这才对齐 PRD「WHERE 已含同一 ACL / 禁止先全库 top-k 再交 ES」（`prds/04-pipelines/02-online-ask-langgraph.md:188`）。
阻塞判定：**不被 B8 阻塞**（B8 = 真 ES/IK/独立索引），被「pgvector 未实现」这一独立前置阻塞（栈已冻：`prds/01-architecture/02-tech-stack-frozen.md:32`）。
「只加严」：若只写成 `inArray(chunkEmbeddings.chunkId, allowedChunkIds)`，与今天等价（`corpus.ts:119` 本就只取 allowed chunk），无新语义；真落 filter 必须有真 pgvector，否则不可断言。

**(b) 等价形态「PG 语料 = ACL 真值源、ES 仅粗收窄」的成立条件与缺口。**
成立条件（三条均可核对）：① corpus 即过同一 PG 谓词（`corpus.ts:85-98`），dense 与 mock sparse 输入同为它（`retrieve.ts:163-170`、`:205-212`）；② ES 命中必须落在 corpus 内（`retrieve.ts:195`）且只影响排序、不影响 membership（`:219-242`）；③ ES 查询期谓词必须是 PG 谓词的**超集**（弱化）才可能只加严。今天四项 ES 条件均满足 ③：`tenantId`/`kbId` 与 corpus 同源；`ownerDeptIds` 源自同一 `collectVisibleOwnerDeptIds`（`dept-acl.ts:135-164` ← `retrieve.ts:79-94`）；principals clause 是 PG `includes` 的超集。
缺口：`ownerDeptIds` 为空/缺省时 ES 完全去 dept 条件（`retrieve.ts:93-94`），此时 ES 谓词对部门文档退化为全库 —— 仍属超集（安全），但是"单看 ES 会漏"的唯一处。
只加严可行性：**单调可行** —— ES 新增收窄只缩小 `sparseRanked`，再经 `:195` 交 corpus，不触碰 membership / RRF / rerank / verify；且第 3 节三项改动全部可在 builder 层 + fetch stub 断言，不依赖 B8。代价：ADR-009 `:152` 字面未满足 → **记 ADR 债**。

### 3. ES 侧补 `visibilityLevel` 的候选形态

- **mapping**：`es-sparse.ts:53-61` 与 `es-http.ts:58-65` 各增 `visibilityLevel: { type: 'integer' }`；已存在索引的补字段处 `putSparseAclMapping`（`es-sparse.ts:190-205`、`es-http.ts:99-121`）也要加，否则靠 dynamic mapping 映成 `long`。新增字段不触发 mapping 冲突（只有改既有字段类型才冲突）。
- **bulk source**：`SparseBulkDoc` 增 `visibilityLevel?: number | null`（`es-sparse.ts:26-34`、`es-http.ts:30-40`）；`sparseBulkSource` 返回类型从 `Record<string, string | string[]>` 放宽到含 `number`（`es-sparse.ts:81-92`、`es-http.ts:68-82`，**两处近似拷贝须同改**）；PG 列 `notNull().default(20)`（`documents.ts:55`）→ **始终写**（含 20），把"字段缺失"严格留给未 reindex 的旧文档。调用点补字段：`apps/worker/src/ingest/pipeline.ts:930-937`。
- **查询期 filter**：`buildAclFilter` 返回 **filter 数组**、元素间 AND（`es-sparse.ts:126-138` ← `:233`），故 OR 只能落在**单个元素内部**：

```json
filter: [
  { "term": { "tenantId": "…" } },
  { "term": { "kbId": "…" } },
  { "bool": { "should": [
      { "terms": { "ownerDeptId": ["d1","d2"] } },
      { "bool": { "must_not": { "exists": { "field": "ownerDeptId" } } } }
    ], "minimum_should_match": 1 } },
  { "bool": { "should": [
      { "range": { "visibilityLevel": { "lte": 20 } } },
      { "bool": { "must_not": { "exists": { "field": "visibilityLevel" } } } }
    ], "minimum_should_match": 1 } }
]
```

要点：部门组与级别组必须是 **filter 数组的两个独立元素**（AND），各自 `bool.should` + 显式 `minimum_should_match: 1`（写法对齐 `aclPrincipalsFilterClause`，`es-sparse.ts:99-107`）；把四支塞进同一 `should` 会变成"部门 OR 库级 OR 级别达标 OR 缺失"，即**放松**。库级分支须与级别组并存：`ownerDeptId == null` 的用户有效级别只取 20/30（`dept-acl.ts:50-51`），若只加部门 OR 不加级别组，`vis=40` 的库级文档在 PG 不可见（eff ≤ 30 < 40）却在 ES 命中 → 层内泄漏。级别组建议**无条件**下，`lte` 取用户可见部门有效级别最大值（含 grant）。只加严证明：PG 可见 ⇒ 存在匹配部门 eff ≥ vis 且 vis ≤ max(eff) → range 命中；库级 PG 可见 ⇒ vis ≤ 20/30 ≤ maxLevel → 命中。
契约小坑：今天**无法区分**"enforce 关 / 超管（应 fail-open）"与"enforce 开但用户无可见部门（PG 只许库级文档）"，因为 `retrieve.ts:93-94` 把两者都变 `undefined`；想在 ES 侧把后者也收紧，须先给 builder 显式三态输入（如 `deptNarrowing: 'none' | 'allowed' | 'empty'`），否则只能维持 fail-open 并作为已披露缺口记账。
- **验证形态**：可以，只需 builder 单测 + fetch stub，断言到请求 JSON 形状。先例：`apps/api/tests/ask/es-dept-query-filter.test.ts:139-172`（抓 `_search` body）· `:176-201`（抓 PUT mapping body）· `:234-266`（抓 `_bulk` ndjson）· `apps/worker/tests/ingest/es-http.test.ts:139-206`。**必须真集群（划出）**：`exists` 对缺字段/空数组/哨兵的实际判定、`range` 对缺字段文档不命中、`integer` 与既有 dynamic mapping 的冲突、`minimum_should_match` 在 filter 上下文的真实行为、IK 与 BM25 排序。

### 4. 角色 principal 的影响面

- **契约**：`documents.acl_principals` 是 `uuid[]`（`documents.ts:60`、`0014_p3b_acl_principals.sql:1`），存不下 `role:{code}` / `dept:{id}:lv:{n}` → 需改 text/varchar 数组（迁移 + 放宽 `PutDocumentAclBodySchema` 的 uuid 校验，`documents/index.ts:899-901`；现有测试已锁 `['not-a-uuid']` → 400，`apps/api/tests/acl/documents-acl-principals.test.ts:140`）；admin 编辑面同为 uuid 粘贴。
- **身份展开**：今天只有裸 `input.userId` 进 ES 与 PG（`retrieve.ts:191-193`、`doc-acl.ts:15`），无 principals 展开器（角色源在 `apps/api/src/auth/middleware.ts:179-195` 的 roleCodes）；需新增「userId + 部门 lv + role → 主体集合」，并裁定它与既有 `ownerDeptIds` 的双部门表达如何避免漂移。
- **PG 谓词**：`isDocVisibleForAclPrincipals`（`doc-acl.ts:5-19`）从 `includes(userId)` 改集合求交，三态（null/`[]`/非空）语义不变。
- **ES 索引**：mapping `aclPrincipals: keyword` 无需改（`role:…` 是串），哨兵写法须保留；bulk 内容与查询期 `term` 入参改为主体集合，且 ACL 变更须触发 reindex（ES PRD `:163`）。
- **不做的后果（B2-2）**：剧本 Then 是「该文档对该用户不可检索」，其前置动作「**移出 role**」在契约层**无处执行**（`aclPrincipals` 只能存 uuid）→ **前置不成立、该句无法真绿**，只能以"移出 uuid 名单"做更弱的等价替换。同源第二层：今天收紧只回 `reindexRequired` + Pino、**不入队**。仓内既有披露：`apps/api/src/env.ts:108`（"仍无角色 principal"）、`docs/testing/coverage/02-acl.md:160`。

**未验证**：本票为只读源码分析，未实跑；ES 真集群行为（`exists` / `range` / `minimum_should_match` 在 filter 上下文的语义）**未验证**，属必须真集群的划出项。
