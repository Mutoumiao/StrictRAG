# 裁定：ES 侧补哪些部门/级别字段与缺字段语义

Type: grilling
Status: resolved
Blocked by: 02

## 问题

ES PRD `prds/03-data/03-elasticsearch-bm25.md:75-77`、`:119`、`:163` 要求索引字段含 `aclPrincipals` / `ownerDeptId` / `visibilityLevel`，部门可见性须「追加 `ownerDeptId` 与 `visibilityLevel` 比较」且与 dense 对称。现状 mapping（`apps/api/src/services/retrieve/es-sparse.ts:53-61`）无 `visibilityLevel`，且缺 `ownerDeptId` 时**不写字段**（`:89-90`），与 PG 的「无 owner_dept_id = 库内成员可见」（ADR-057 `prds/11-decisions/00-adr-index.md:1856`）不对齐。

## Answer

**裁定：补 `visibilityLevel`（integer）到 mapping / bulk / 查询期；把部门组从裸 `terms` 改为 `bool.should[terms, must_not exists]`；并把「是否在收窄」提升为显式三态（以 `maxVisibleLevel` 是否传入为信号）。全部改动都是"ES 命中集 ⊆ 今天"或"ES 命中集 ⊇ PG 可见集"，不引入放宽。**

### 1. 字段与 bulk（两侧近似拷贝须同改）

| 处 | 文件 | 改什么 |
|---|---|---|
| api mapping | `apps/api/src/services/retrieve/es-sparse.ts:53-61` | 增 `visibilityLevel: { type: 'integer' }` |
| api 补 mapping | 同文件 `putSparseAclMapping`（`:190-205`） | 同样增字段（否则靠 dynamic mapping 映成 `long`） |
| api bulk | 同文件 `SparseBulkDoc`（`:26-34`）、`sparseBulkSource`（`:81-92`） | 增 `visibilityLevel?: number \| null`；返回类型放宽到含 `number`；**有值即写**（含 `20`） |
| worker mapping/bulk | `apps/worker/src/ingest/es-http.ts:58-65`、`:99-121`、`:30-40`、`:68-82` | 同上（两处近似拷贝，必须同步） |
| worker 调用点 | `apps/worker/src/ingest/pipeline.ts:930-937` | 传文档的 `visibilityLevel` |

**写「缺失」还是写「20」**：PG 列 `notNull().default(20)`（`packages/db/src/schema/kb/documents.ts:55`），文档**总有**级别 → bulk **始终写**。这样"字段缺失"只可能来自**未 reindex 的旧文档**，语义干净；查询期的"缺失分支"就是旧索引兼容分支。

### 2. 查询期形态（`buildAclFilter`）

`buildAclFilter` 返回 **filter 数组**、元素之间是 AND（`es-sparse.ts:126-138` ← `:233`），所以 OR 只能落在**单个元素内部**：

```json
filter: [
  { "term": { "tenantId": "…" } },
  { "term": { "kbId": "…" } },
  { "bool": { "should": [                       // 部门组（仅收窄生效时存在）
      { "terms": { "ownerDeptId": ["d1","d2"] } },        // ids 为空时省略此支
      { "bool": { "must_not": { "exists": { "field": "ownerDeptId" } } } }
    ], "minimum_should_match": 1 } },
  { "bool": { "should": [                       // 级别组（仅收窄生效时存在）
      { "range": { "visibilityLevel": { "lte": 30 } } },
      { "bool": { "must_not": { "exists": { "field": "visibilityLevel" } } } }
    ], "minimum_should_match": 1 } }
]
```

**硬要求**：部门组与级别组必须是 filter 数组的**两个独立元素**；把四支塞进同一个 `should` 会变成「部门 OR 库级 OR 级别达标 OR 缺失」= **放松**，禁止。写法对齐既有 `aclPrincipalsFilterClause`（`:99-107`）。

### 3. 三态信号（本次一并修掉的 fail-open）

今天 `retrieve.ts:93-94` 把「enforce 关 / 超管 bypass」与「enforce 开但用户无可见部门」都压成 `ownerDeptIds: undefined`，导致后者在 ES 侧对部门文档 **fail-open**（靠 `retrieve.ts:195` 兜住）。裁定：**以 `maxVisibleLevel` 是否传入作为"收窄生效"的显式信号**。

- **不生效**（enforce 关或 bypass）：不传 `ownerDeptIds`、不传 `maxVisibleLevel` → filter 与今天逐位相同（仅 tenantId + kbId [+ principals]）。
- **生效且 ids 非空**：部门组 = `terms` ∪ `must_not exists`；级别组 = `lte: maxVisibleLevel`。
- **生效且 ids 为空**：部门组 = **只有** `must_not exists`（即 PG 语义"只见库级文档"）；级别组同上。这是**收紧**（今天此情形 ES fail-open），且仍是 PG 可见集的超集。

### 4. `maxVisibleLevel` 的定义（上界，不是逐文档精确规则）

PG 的精确规则是 `eff(doc.ownerDeptId) >= vis`（`apps/api/src/services/retrieve/dept-acl.ts:93-127`）。ES 无法逐文档算，取**用户可达级别上界**：

```
maxVisibleLevel = max( 任一处负责人 ? 30 : 20 ,  未过期 grant 的 maxVisibilityLevel 最大值 )
```

依据（`dept-acl.ts:46-68`、`:72-91`）：空部门文档的 eff = `assignments.some(isLeader) ? 30 : 20`；有部门文档的 eff = 匹配到的归属（20/30）与 grant 的较大者。取上界保证 `PG 可见 ⇒ vis ≤ maxVisibleLevel`，故**只加严**。

- 落点：新增纯函数（建议放 `dept-acl.ts`，与 `collectVisibleOwnerDeptIds` 并列），入参 `{ assignments, grants, now }`，`now` 缺省 `formatLocalDateTime()`，grant 用既有 `isGrantActive` 过滤。
- 计算发生在 `retrieve.ts:79-94` `ownerDeptIdsForSparseSearch` —— 它**已经**加载了 `assignments/depts/grants`，改为同时返回 `{ ownerDeptIds, maxVisibleLevel }`，不新增 IO。
- 类型透传：`SparseSearchParams`（`apps/api/src/services/retrieve/types.ts`）与 `searchSparseEs` 入参各加可选 `maxVisibleLevel?: number`。

### 5. 角色 principal：**不在本图落**

- 裁定为**雾**（见 map「Not yet specified」）：`aclPrincipals` 今天是不带前缀的裸 uuid 数组（`packages/db/src/schema/kb/documents.ts:60`），落 ADR-057 `:1861-1864` 的 `user:{id}` / `dept:{deptId}:lv:{n}` 形态需要**迁移 + 放宽契约校验**（现测已锁 `['not-a-uuid'] → 400`）+ 新增身份展开器 + 改 PG 谓词 + 改 ES 入参与查询，属独立议题（本图的 AAA 级改动）。
- **后果必须记清**：剧本 B2-2（`prds/10-delivery/03-acceptance-scenarios.md:54`）的前置动作是「principal 变更（**移出 role**）」；在角色 principal 落地前，这句**无法真绿**，只能以"移出 uuid 名单"作**更弱的等价替换**。任务票 `11` 按等价替换断言，并在回写里写明该替换与 ADR 债；**不得**把 B2-2 标成"按原文已绿"。

### 6. 验证形态

- **可离线**：builder 纯函数单测 + `vi.stubGlobal('fetch')` 抓 `_search` / PUT mapping / `_bulk` 请求体（先例 `apps/api/tests/ask/es-dept-query-filter.test.ts:139-172`、`:176-201`、`:234-266`；`apps/worker/tests/ingest/es-http.test.ts:139-206`）。
- **必须真集群（划出，不得写成可做）**：`exists` 对"缺字段 / 空数组 / 哨兵"的实际判定、`range` 对缺字段文档不命中、`integer` 与既有 dynamic mapping 是否冲突、`minimum_should_match` 在 `filter` 上下文的真实行为、IK/BM25 排序。

### 7. 未验证

本裁定为只读分析 + 迁移/契约核查，**未实跑也未对真 ES 验证**；`packages/db` 未跑迁移（本机 Docker daemon 未运行）。
