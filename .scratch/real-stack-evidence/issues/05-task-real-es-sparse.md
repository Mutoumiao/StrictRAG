# 真 ES sparse 切片真跑（B8 切片）+ 被「真 ES」阻塞的行逐条裁定

Label: wayfinder:task
Type: task
Status: resolved
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

**已解**。取证全文：[`../research/05-real-es.md`](../research/05-real-es.md)。

真集群：compose `elasticsearch:8.15.3`（**vanilla，无 IK**），索引 `strict_rag_dev` 由 worker 的 `ensureSparseIndex` 真建。

| 验证项 | 真集群结果 |
|--------|-----------|
| 建索引 + mapping | ✅ mapping 与 `SPARSE_INDEX_PROPERTIES` **逐字段一致**（uuid 类全 `keyword`、`sparseText` `text`、`visibilityLevel` `integer`）；「已存在则 PUT `_mapping` 补 keyword」分支也真跑过 |
| bulk 写入 | ✅ `_count` 与入库 chunk 数一致；`_source` 里 `aclPrincipals` / `ownerDeptId` 按「null 不写」语义缺席 |
| **中文检索** | ✅ `match` 查「检索闸」命中 2 条、`max_score` 非零 —— **IK 不是「能命中」的必要条件**（`standard` 分词两侧同切）；IK 影响的是分词粒度与排序质量 |
| `aclPrincipals` 三态 | ✅ 真集群实测：`null` → 字段不写；`[]` → 哨兵 `["__acl_none__"]`；`[uid]` → uid 列表。查询期 `should=[must_not exists, term uid]` 下，非名单用户**只见**「无名单」文档，名单内用户见「无名单 + 本人名单」 |
| `listIndexedChunkIds` 对账 | ✅ 正常（其 fail-closed 语义在本轮工单 04 抓到的 refresh 缺陷修复后一次判 ok） |

**覆盖表裁定**：

- **`X5`**（acl）：维持 `部分测`，**阻塞方改判** —— 不是「须真 ES」，而是**查询期 `doc_type` filter 在源码里根本不存在**（真 ES 也验不出一条不存在的 filter）。同时**证明其缺失不构成泄漏**：`apps/api/src/services/retrieve/retrieve.ts:212` 在 sparse 命中后立刻与 PG 语料求交（`byId.has`），场外 chunk 一律丢弃；代价是**超集排序挤占 top-k 的召回损失**。销账条件 = 索引加 `docType` keyword + 查询期 terms filter，并补「范围外 chunk 不占 top-k」的测例。缺口列已改写。
- **`E1`**（ingest）：维持 `部分测`，**阻塞方由「真 ES 部署」改判为「仓内可重复的真 ES 集成测位」** —— 真 ES 上已真跑到「入库后按正文中文术语检索命中该 doc 的 chunk」。缺口列已改写。
- **未做**：`E2` 的 supersede ↔ ES 命中串联；多租户独立索引；`X5` 的落地实现（属新增面，须先裁）。
