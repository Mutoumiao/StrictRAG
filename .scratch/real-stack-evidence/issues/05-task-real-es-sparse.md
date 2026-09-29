# 真 ES sparse 切片真跑（B8 切片）+ 被「真 ES」阻塞的行逐条裁定

Label: wayfinder:task
Type: task
Status: open
Blocked by: 01

## Question

让 `apps/worker` 的 `es-http.ts`（建索引 + `_mapping` 补 keyword + bulk）与 `apps/api` 的 `services/retrieve/es-sparse.ts`（查询期 DSL）在**真 ES 8.15.3** 上真跑一遍——这是九张图都写着「不能（离线不可做）」的那件事。

1. **建索引**：`ensureIndex` 路径在真 ES 上成功；`GET /<index>/_mapping` 显示 `SPARSE_INDEX_PROPERTIES` 的字段类型落地（含 `ownerDeptId` / `aclPrincipals` keyword），且已有索引的 `_mapping` PUT 补字段路径也走过。
2. **写入**：bulk 一批 chunk（含中文 `sparseText`），`_count` 与 PG 侧一致；`__acl_none__` 哨兵（`aclPrincipals: []`）真写进去。
3. **查询**：`_search` 在真 ES 上真命中中文术语——**这是本票最要紧的一格**：compose 的 ES 是 vanilla 8.15.3（**无 IK 插件**），`sparseText` 是 `text` 无显式 analyzer（→ `standard`）。真跑记录：命中还是未命中、命中的是整词还是切碎的 token。据此裁定「IK 是否 B8 必达」「`docs/ops/operable-stack.md` 里『标准分词，未装 IK』这句在检索结果上意味着什么」。
4. **逐条裁定被阻塞的行**（真跑证据在手之后）：
   - 覆盖表 `X5`（acl:544）：dense 与 ES 查询期 filter 是否**均含** `doc_type∈hr`、是否**对称**——源码侧 `es-sparse.ts` 查询期零 `doc_type`；有了真 ES，判断这条到底是「B8 不到位」还是「可离线落地」；
   - `GET /ready` 的 `elasticsearch` 项、`reconcileIndexed` 的 fail-closed 语义在真 ES 上的真实行为；
   - `aclPrincipals` 的 `exists` / `should` 收窄在真 ES 上的行为（此前只在 mock 断言）。
5. 真跑暴露的**源码缺陷**当场修（收紧或逐位等价）并补测例；撞冻结契约的记债并写明阻塞方。

产物：`research/05-real-es.md`（命令 + ES 原始响应摘要 + 每行裁定）。

## Answer

（待填）
