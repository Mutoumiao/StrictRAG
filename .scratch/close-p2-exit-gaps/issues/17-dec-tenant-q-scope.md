# 裁定 TENANT-Q 的门禁口径与范围

Type: grilling
Status: resolved
Blocked by: 02

## Question

剧本 O4：「无 `tenantId` 的 query / bulk builder 必须失败」。核查结论是**部分已做**：前图 09 已让 `tenantId` 在 builder 入参上必填（`apps/api/src/retrieval/es-sparse.ts:15/115/221`、`es-http.ts:31/59`），并有正向断言；**缺的是「缺 `tenantId` 即失败」的门禁与负向测**。

请裁定三处：

1. **门禁在哪一层**：TypeScript 编译期必填（现状）是否已足够构成「必须失败」？还是要在运行时**构造前显式校验**并在缺失时抛出/返回约定错误？若后者，错误码取 PRD 短名，落点在哪。
2. **mock 层是否在范围内**：`mockEsStore`（`apps/api/src/retrieval/es-store.ts:9-52`）与默认 mock 路径**无 tenant 概念**。给 mock 加 tenant 维是「补齐对称」还是「给一个不会在生产出现的路径造语义」？选一个并给理由。
3. **独立索引布局的归属**：ES 多租户独立索引属 **B8 延期**。请判定 O4 的「共享 / 独立皆然」是该由**今天**的代码承诺，还是随 B8 一起延后；若延后，本图只落共享索引侧的证据，并在图上写明。

答案须给出**可测的断言形状**（负向优先），以及本图**不做**的部分。

## Answer

### 一、事实基线

- PRD 依据：剧本 O4（`prds/10-delivery/03-acceptance-scenarios.md`「无 `tenantId` 的 query/bulk builder 必须失败」）· `prds/03-data/03-elasticsearch-bm25.md`（ADR-041：**filter 即使独立也强制**）。
- IS：两个适配层的 builder 已把 `tenantId` 写成**类型必填**（api `apps/api/src/services/retrieve/es-sparse.ts:15/68/107` · worker `apps/worker/src/ingest/es-http.ts:33/56`），但**没有任何运行时校验**：JS 调用方或宽化类型仍可传空值，结果会构造出 `{ term: { tenantId: undefined } }` 或 source 里 `tenantId: undefined` —— 静默少过滤。
- mock 侧：`mockEsStore`（`apps/api/src/services/retrieve/es-store.ts:9-52`）是 **PG 文本替身，没有 tenant 概念**。

### 二、裁定

**1. 门禁落在运行时「构造即抛」，不依赖 TS 类型。**
落点选**两个纯 builder**（覆盖面最大、最靠近序列化点）：
- `buildAclFilter`（query 侧，api）
- `sparseBulkSource`（bulk 侧，api + worker 各一份）

缺 / 空串 / 纯空白 `tenantId` → 抛错（api 抛 `EsSparseError(..., 'config')`；worker 抛 `Error`，该包无 `EsSparseError`）。
**禁止**静默少过滤、禁止补默认租户、禁止回退「全租户」。因为 `bulkIndexSparse` 也走 `sparseBulkSource`，bulk 路径自动被覆盖。

**2. mock 层不在范围内。**
给 `mockEsStore` 加 tenant 维等于给一条**不存在于生产**的路径发明语义（它是 PG 文本替身，没有租户隔离概念）。**不覆盖**，并在此写明，避免后人误以为「已全路径强制」。

**3. 独立索引布局随 B8。**
ES 多租户独立索引属 **B8 延期**。「独立索引皆然」这条**今天不由代码承诺**：本图只落**共享索引**侧的 builder 闸，并在注释里写死「独立布局同样受此约束（ADR-041）」作为将来 B8 的准入要求。

**4. 可测断言形状（负例优先）**
- 负例：`tenantId` 为 `undefined` / `''` / `'   '` → 抛（query 与 bulk 各一条）。
- 负例：`bulkIndexSparse` 在抛之前**不得发出任何 HTTP**（stub fetch 断言未被调用）。
- 正例：带 `tenantId` 时 filter 恒为 `[{term:{tenantId}}, {term:{kbId}}]`、source 逐位不变 —— 即既有 O1 `kbId` 闸**未被放宽**。

**5. 本图不做**
mock 层 tenant 维；独立索引布局的实现；把 tenant 校验下沉到 HTTP 响应层（无必要，构造期已经失败）。

→ 解锁 [05 QUAL-TENANT-Q](./05-qual-tenant-query.md)。
