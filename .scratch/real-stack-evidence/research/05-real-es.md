# 工单 05 · 真 ES sparse 切片真跑（B8 切片 · 真跑证据）

> 图：[`real-stack-evidence`](../map.md) · 工单：[`issues/05-task-real-es-sparse.md`](../issues/05-task-real-es-sparse.md)
> 集群：compose `strict-rag-elasticsearch`（`elasticsearch:8.15.3`，**vanilla，无 IK 插件**，`xpack.security.enabled=false`）
> 索引：`strict_rag_dev`（由 worker 的 `ensureSparseIndex` 真建）

## 1. 建索引与 mapping 落地

```bash
curl :9200/strict_rag_dev/_mapping
```

```json
{"strict_rag_dev":{"mappings":{"properties":{
  "aclPrincipals":{"type":"keyword"},"chunkId":{"type":"keyword"},"docId":{"type":"keyword"},
  "kbId":{"type":"keyword"},"ownerDeptId":{"type":"keyword"},"sparseText":{"type":"text"},
  "tenantId":{"type":"keyword"},"visibilityLevel":{"type":"integer"}}}}}
```

与 `apps/worker/src/ingest/es-http.ts:59-69` 的 `SPARSE_INDEX_PROPERTIES` **逐字段一致**：uuid 字段全是 `keyword`（`term` 才命中），`sparseText` 是 `text`，`visibilityLevel` 是 `integer`。**无显式 analyzer** → 真集群按默认 `standard` 分词。

`ensureSparseIndex` 的「已存在则 PUT `_mapping` 补 keyword」分支也在真集群上真跑过（复用同一索引的多次入库即走该分支），无报错。

## 2. 写入与计数

两次 `smoke:half` 入库共 4 个 chunk 落在 `strict_rag_dev`：

```bash
curl :9200/strict_rag_dev/_count   → {"count":4,…}
```

一篇真文档的 `_source`（节选）：

```json
{"chunkId":"…","tenantId":"01900000-0000-7000-8000-000000000001",
 "kbId":"…","docId":"…",
 "sparseText":"01-doc\n这是第 01 篇企业制度样例正文，…",
 "visibilityLevel":20}
```

`aclPrincipals` / `ownerDeptId` **不在 `_source` 里** —— 与 `sparseBulkSource` 的「null 不写该字段」语义一致。

## 3. **中文检索命中（本票最要紧的一格）**

```bash
# 请求体（UTF-8，与 apps/api/src/services/retrieve/es-sparse.ts 的 must 同形）
{"size":5,"query":{"bool":{
  "filter":[{"term":{"tenantId":"01900000-0000-7000-8000-000000000001"}}],
  "must":[{"match":{"sparseText":"检索闸"}}]}},"_source":["chunkId","docId","sparseText"]}
```

```json
{"hits":{"total":{"value":2,"relation":"eq"},"max_score":2.774679,"hits":[
 {"_score":2.774679,"_source":{"chunkId":"…","docId":"…",
  "sparseText":"01-doc\n第二节说明检索闸仅对 ready 且 active 文档生效，draft 与 superseded 不得进入默认检索集合。"}},
 {…另一篇同文…}]}}
```

**结论（对 IK 问题的直接回答）**：**未装 IK 的真 ES 上，中文术语检索在工作**——`standard` 分词把 CJK 切成单字，查询侧与索引侧同样切分，故 `match` 能命中（`max_score` 非零、命中数正确）。

由此可裁：

- **IK 不是 `sparseSearch` 路径「能用」的必要条件**（本机实测命中），它影响的是**分词粒度与排序质量**，不是「命中 / 不命中」；
- 因此 `docs/ops/operable-stack.md:16`「标准分词，未装 IK」这句是**准确**的，无需改写；
- 而「B8 真 ES+IK」里的 **IK** 仍属**排序质量 / 生产话术**范畴，不是本图能替它下结论的部分（本图只证明：**不装 IK 时路径可用**）。

## 4. `aclPrincipals` 三态在真集群上的语义（此前只在 mock 上断过）

用 worker 的真实代码（`ensureSparseIndex` / `bulkIndexSparse` / `sparseBulkSource`）向真 ES 写三篇探针文档，再用**与 `apps/api/src/services/retrieve/es-sparse.ts` 的 `aclPrincipalsFilterClause` 同形**的 DSL 查询。原始输出：

```text
全部命中: 3
  probe-empty-1 → {"aclPrincipals":["__acl_none__"]}
  probe-null-1  → {}
  probe-uid-1   → {"aclPrincipals":["01900000-0000-7000-8000-0000000000cc"]}
以「不在名单的用户」检索 → [ 'probe-null-1' ]
以「名单内用户」检索     → [ 'probe-null-1', 'probe-uid-1' ]
探针索引已删除
```

三条结论：

1. `aclPrincipals: null` → 字段**根本不写**（`_source` 为 `{}`）；
2. `aclPrincipals: []` → 写哨兵 `["__acl_none__"]`（因为 ES 的 `exists` 不认空数组，`[]` 会被当成「字段不存在」而误放行）；
3. 查询期 `should = [must_not exists(aclPrincipals), term(aclPrincipals: uid)] + minimum_should_match:1` 在真集群上**逐位符合预期**：非名单用户只看到「无名单」文档，「空名单」文档与「他人名单」文档都被挡住；名单内用户两者皆可见。

**这是把「只在 mock 断言过」的 ACL 语义补上了真集群证据。**

## 5. `X5` 的裁定（真 ES 在手之后）

- **源码事实**：`apps/api/src/services/retrieve/es-sparse.ts` 查询期**零 `doc_type`/`docType`**（索引 mapping 里也没有该字段），类型过滤只发生在**装载层**（`corpus.ts` 的 `filterDocsForRetrieve`）。
- **真 ES 能验什么、不能验什么**：不存在的东西验不了「对称」本身；真 ES 能验的是「若不做查询期类型 filter，会不会误召回、会不会误作答」。
- **实测与源码给出一致的答案：不会泄漏**。`retrieve.ts:212` 在 sparse 命中之后立刻 `sparseRanked.filter((id) => byId.has(id))`，而 `byId` 来自**已过双闸 + 生效窗口 + docTypes + 部门/可见级 + aclPrincipals 的 PG 语料** → ES 侧多召回的场外 chunk 一律被丢弃。即 X5 的 «禁止一路全库一路过滤» 在**效果层**成立（defense in depth：PG 为准，ES 只管排序）。
- **真正的代价不是安全，是召回**：没有查询期 `doc_type` 收窄时，ES 在**超集**上排序，`size=retrieveK` 的坑位会被范围外 chunk 占掉，导致范围内的文档被挤出 top-k —— 这是**效果损失**，不是泄漏。
- **裁定**：X5 维持 `部分测`，缺口列改为「**查询期 `doc_type` filter 源码不存在**（非环境阻塞）；不构成泄漏（`retrieve.ts:212` 语料求交）；代价是超集排序挤占 top-k。销账条件 = 真索引上加 `docType` keyword 字段 + 查询期 terms filter，并补一条『范围外 chunk 不占 top-k』的测例」。**本图不为它开口子，也不把「真 ES 已跑」记成「X5 已解」**。

## 6. 其他真集群事实（顺手记下）

- `reconcileIndexed` 的 fail-closed 语义在真集群上**曾经误红**（见工单 04 与 `es-http.ts` 的 `refresh=wait_for` 修复）；修好后写后读一次判 `ok`。
- `listIndexedChunkIds` 的 `size:10000` + `term tenantId` + `term docId` 在真集群上工作正常（曾用于对账）。
- 索引里 `visibilityLevel:20` 是文档默认可见级，证明 `sparseBulkSource` 的「有值即写」分支在真集群上落地。
