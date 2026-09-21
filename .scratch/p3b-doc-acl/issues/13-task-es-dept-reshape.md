# 落 ES 部门组重塑（库级分支 + 关掉 ids 为空的 fail-open）

Type: task
Status: resolved
Blocked by: 09

## 做什么

按 `06-dec-es-dept-field.md` 第 2、3 节，把 `buildAclFilter` 的**部门组**从裸 `terms` 重塑为 `bool.should[terms, must_not exists]`，并把"ids 为空"从 ES 侧 fail-open 改为"只见库级文档"。

## 为何拆票

`09` 已把"是否收窄"的显式信号（`maxVisibleLevel`）与级别组落好，但**重塑部门组会改既有断言**（今天是 `{ terms: { ownerDeptId: [...] } }` 的独立元素，改后是 `bool.should` 元素），影响面与语义风险都比级别组大：

- 库级分支是**召回侧修复**（开强制时无部门文档在 ES 侧不命中，PG 却允许 → 稀疏召回丢文档）；
- `ids 为空 → 只见库级` 是**收紧**（今天 ES 对部门文档 fail-open，靠 `retrieve.ts` 的语料求交兜住）；
- 两者都会改 `apps/api/tests/ask/es-dept-query-filter.test.ts`、`es-sparse.test.ts` 里既有的 `terms` 精确断言。

拆开后，`09` 的改动保持纯增量、可单独回滚；本条独立承担断言改写与更细的反证。

## 完成判据

- `buildAclFilter` 部门组在**收窄生效**（`maxVisibleLevel` 传入）时为 `bool.should[terms(ids 非空时), must_not exists ownerDeptId]` + `minimum_should_match: 1`；`ids` 为空时**只有** `must_not exists` 一支。
- 严格保持："部门组与级别组是 filter 数组的两个独立元素"（并进同一 `should` 即放松）。
- 既有断言按新形状更新；新增断言覆盖两种情形（ids 非空 / ids 为空）。
- **反证**：把库级分支删掉 → 库级文档相关断言变红；把 ids 为空时的 `must_not exists` 换成"不加条件" → fail-open 断言变红。
- **只加严证明**写入注释：PG 对无 `ownerDeptId` 文档给独立级别规则（`dept-acl.ts` 的 `effectiveLevel`：任一处负责人 30，否则 20），已被级别组的 `lte` 上界覆盖。
- `pnpm check-types` + `pnpm lint` + `apps/api` 测试全绿。
- 保存 `apps/api/tests/ask/es-dept-query-filter.test.ts` 的 `toEqual` 断言改写说明（为何旧形状不再成立）。

## Answer

### 落了什么

- `apps/api/src/services/retrieve/es-sparse.ts`：新增 `ownerDeptFilterClause(ids)`（`EsOwnerDeptShould` / `EsOwnerDeptClause` 两个类型 + `EsAclFilterClause` 联合加一支）；`buildAclFilter` 按**收窄生效信号**分流：生效 → 追加部门组 + **独立**的级别组；不生效 → 保持历史的裸 `terms`。`retrieve/index.ts` 增补导出。
- 注释写清**只加严证明**：`must_not exists ownerDeptId` 这一支是 PG 的「库级文档」——PG 对无 `ownerDeptId` 的文档走独立级别规则（`effectiveLevel`：任一处负责人 30，否则 20），该规则的级别正确性由级别组的 `lte` 上界承载；故两支并起来仍是 PG 可见集的**子集**。

### 关于「既有 `toEqual` 断言改写说明」——实跑后的真实结论（与票面预设不同）

票面预设「既有的 `terms` 精确断言要改」。**实跑的真实红名单**（先改代码再全量跑，不用静态推断）是 **1 文件 / 2 例**：`apps/api/tests/ask/es-sparse.test.ts` 的 `传 maxVisibleLevel 时追加级别组` 与 `级别组与部门组是 filter 数组的两个独立元素`。

原因：本实现把重塑**绑定在收窄信号上**（而非绑在 `ownerDeptIds` 是否有值上）。于是：

- `apps/api/tests/ask/es-dept-query-filter.test.ts` 的 `非空 ownerDeptIds：追加 terms`、`传入 ownerDeptIds 时 POST filter 含 terms` **未传收窄信号** → 仍走裸 `terms`，断言**逐位不变、无需改写**；
- 只有**同时**传了 `maxVisibleLevel` 的断言才会看到新形状。这也把「不生效 ⇒ 与旧版逐位一致」这条性质**钉成了可跑的断言**（`不传 maxVisibleLevel 不加级别组（旧行为逐位不变）`）。

**为何旧形状在收窄生效时不再成立**：旧形状是裸 `terms ownerDeptId`，它对**无 `ownerDeptId` 的库级文档恒不命中**，而 PG 在 enforce 开时对库级文档是可能放行的（`effectiveLevel` 规则）→ ES 少召回；且旧形状在"可见部门为空"时**根本不加部门条件**，等于对部门文档 fail-open。新形状一次修掉这两处。

### 新增断言（两种情形都覆盖）

都在 `apps/api/tests/ask/es-sparse.test.ts`（builder 层）与同文件 `searchSparseEs` 段（请求体层）：

| 断言 | 覆盖 |
|---|---|
| `传 maxVisibleLevel 时部门组重塑为部门∪库级，并追加级别组` | 生效 + ids 非空（改写自旧例） |
| `收窄生效 + 可见部门为空：部门组只剩「库级文档」一支` | 生效 + ids 空（原 fail-open 格） |
| `收窄生效时：显式空列表与缺省同形；空白 id 被丢掉` | `[]` / `['  ']` 与缺省同形 |
| `级别组与部门组是 filter 数组的两个独立元素` | 不并进同一 `should`（改写自旧例） |
| `收窄生效时 _search 的 filter 是 部门组 + 级别组 两个独立元素` | 请求体落地形态 |

### 反证（实测，两处各跑一次）

- **F1 删掉库级分支**（`ownerDeptFilterClause` 不再 push `must_not exists`）→ `es-sparse.test.ts` **4 例红**（上面第 1、2、4 行 + `searchSparseEs` 那例）；还原后全绿。
- **F2 ids 为空时退回 fail-open**（生效时 ids 空则不追加部门组）→ **1 例红**（`收窄生效 + 可见部门为空…`）；还原后全绿。

### 门禁

`apps/api`：`tsc --noEmit` 0 · `eslint --max-warnings 0` 0 · `vitest run` **164 文件 / 998 通过 + 3 skipped**（改前 164 / 995，+3 为本票所加）。spec `.trellis/spec/api/backend/departments.md` 的「检索期部门 / 名单收窄与 ES 索引一致性」一节按新形状改写（含 Correct 代码块）。

### 明确必须真 ES 集群（不算可做项）

`exists` / `minimum_should_match` 在 `filter` 上下文的真实语义、`integer` 与既有 dynamic mapping 是否冲突、keyword 映射是否把 uuid 映成 text（`es-http.ts` 自陈的坑）、IK/BM25 排序。现测只断言到**请求体形状**，已在 spec 与 `tests/index.md` 写明。

### 未做

- 真 ES 集群验证（属 B8）。
- 未动 `prds/00–11`，未改任何仓库默认开关。
