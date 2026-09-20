# 研究：dense ∥ ES 对称与 ES 部门字段的差额性质

Type: research
Status: claimed
Blocked by: —

## 问题

ADR-009 `prds/11-decisions/00-adr-index.md:152` 要求 dense 与 ES **共用 `buildAclFilter(ctx)`**；ES PRD `prds/03-data/03-elasticsearch-bm25.md:75-77`、`:119`、`:163` 要求部门条件含 `ownerDeptId` **与 `visibilityLevel` 比较**、与 dense 对称、共用同一 filter 生成器。现状差额：

- `buildAclFilter` 定义在 `apps/api/src/services/retrieve/es-sparse.ts:120-138`，唯一生产调用点 `:234`（`searchSparseEs`）。dense 是进程内余弦，输入即 PG 语料（`apps/api/src/services/retrieve/retrieve.ts:163-170`），**从不调用** `buildAclFilter`。
- ES mapping 只有 `chunkId / tenantId / kbId / docId / ownerDeptId / aclPrincipals / sparseText`（`es-sparse.ts:53-61`），**无** `visibilityLevel`。
- 缺 `ownerDeptId` 时 bulk 不写字段（`es-sparse.ts:89-90`），而 PG 语义是「文档无 owner_dept_id = 库内成员可见」（ADR-057 `:1856`）→ 开强制时 `terms ownerDeptId` 匹配不到。
- `aclPrincipals` 是不带前缀的裸 uuid 数组（`packages/db/src/schema/kb/documents.ts:60`），无 ADR-057 `:1861-1864` 的 `user:{id}` / `dept:{deptId}:lv:{n}` 主体形态。
- 部门收窄入口：`retrieve.ts:181-198`（含 `ownerDeptIdsForSparseSearch` `:79-94`）；候选构造 `dept-acl.ts:135-164` `collectVisibleOwnerDeptIds`；防泄漏兜底 `retrieve.ts:195`（ES 命中必须落在 PG 语料内）。

## 要回答

1. **逐条定性**：上面每个差额属于**泄漏侧**（会多召回不可读内容）还是**召回侧**（会少召回可读内容）？给机制（指出是哪一行代码造成，不猜）。特别判定 `retrieve.ts:195` 的兜底是否已经把泄漏侧全部兜住。
2. **「dense ∥ ES 对称」的可核对解释**：至少给出 (a) 在 dense 查询期真落一条 filter（需 pgvector / 真 ES，代价与风险）；(b) 承认「PG 语料 = ACL 真值源，ES 仅做粗收窄」为等价形态（代价：字面未满足 ADR-009 `:152`，须记 ADR 债）。两者都要写清「只加严」可行性。
3. **ES 侧补 `visibilityLevel` 的候选形态**：mapping、bulk source、查询期 filter 三处各改什么；缺字段语义怎么写（对齐 `aclPrincipals` 的 `must_not exists` 写法 `es-sparse.ts:99-107`）；能否只用 builder 单测 + fetch stub 断言（先例 `apps/api/tests/ask/es-dept-query-filter.test.ts`、`apps/worker/tests/ingest/es-http.test.ts`）。
4. **角色 principal 的影响面**：契约 / 身份展开 / PG 谓词 / ES 索引各要改什么，以及**不做它**会让 B2-2（`prds/10-delivery/03-acceptance-scenarios.md:54`「principal 变更（移出 role）+ reindex 后」）的哪一句 Then 无法真绿。

## 约束

- 只读，不改文件、不跑测试。
- 结论要能直接支撑决定票 `05-dec-dense-es-symmetry.md` 与 `06-dec-es-dept-field.md`。

## Answer

（待填）
