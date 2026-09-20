# 裁定：ES 侧补哪些部门/级别字段与缺字段语义

Type: grilling
Status: open
Blocked by: 02

## 问题

ES PRD `prds/03-data/03-elasticsearch-bm25.md:75-77`、`:119`、`:163` 要求索引字段含 `aclPrincipals` / `ownerDeptId` / `visibilityLevel`，部门可见性须「追加 `ownerDeptId` 与 `visibilityLevel` 比较」且与 dense 对称。现状 mapping（`apps/api/src/services/retrieve/es-sparse.ts:53-61`）只有前两者中的 `ownerDeptId`，且**缺字段时不写**（`:89-90`），与 PG 的「无 owner_dept_id = 库内成员可见」（ADR-057 `:1856`）不对齐。

要裁定：

1. **补不补 `visibilityLevel`**：补的话 mapping / bulk source / 查询期 filter 三处各落到哪（`apps/worker/src/ingest/es-http.ts:60-65`、`es-sparse.ts:81-94`、`:120-138`）；不补的话记什么债、留什么雾。
2. **缺字段语义**：库级文档（无部门）在 ES 查询期怎么写，才能与 PG 一致而**不放松**（候选：`should: { bool: { must_not: { exists: { field: 'ownerDeptId' } } } }`，对齐 `aclPrincipalsFilterClause` `:99-107` 的写法）。要写清 `minimum_should_match` 与和其它 filter 的 bool 结构关系。
3. **验证形态**：能否只用 builder 纯函数单测 + fetch stub 断言（先例 `apps/api/tests/ask/es-dept-query-filter.test.ts`、`apps/worker/tests/ingest/es-http.test.ts`）；哪些部分必须真集群（划出）。
4. **角色 principal**（`user:` / `dept:{id}:lv:{n}`）是否在本图落：若落，写清契约与索引改动；若不落，写成明确的雾并说明 B2-2 的哪一句 Then 因此无法真绿。

## 约束

- 只加严不放宽；不改仓库默认开关；不改 `prds/00–11`。

## Answer

（待填）
