# 裁定 TENANT-Q 的门禁口径与范围

Type: grilling
Status: open
Blocked by: 02

## Question

剧本 O4：「无 `tenantId` 的 query / bulk builder 必须失败」。核查结论是**部分已做**：前图 09 已让 `tenantId` 在 builder 入参上必填（`apps/api/src/retrieval/es-sparse.ts:15/115/221`、`es-http.ts:31/59`），并有正向断言；**缺的是「缺 `tenantId` 即失败」的门禁与负向测**。

请裁定三处：

1. **门禁在哪一层**：TypeScript 编译期必填（现状）是否已足够构成「必须失败」？还是要在运行时**构造前显式校验**并在缺失时抛出/返回约定错误？若后者，错误码取 PRD 短名，落点在哪。
2. **mock 层是否在范围内**：`mockEsStore`（`apps/api/src/retrieval/es-store.ts:9-52`）与默认 mock 路径**无 tenant 概念**。给 mock 加 tenant 维是「补齐对称」还是「给一个不会在生产出现的路径造语义」？选一个并给理由。
3. **独立索引布局的归属**：ES 多租户独立索引属 **B8 延期**。请判定 O4 的「共享 / 独立皆然」是该由**今天**的代码承诺，还是随 B8 一起延后；若延后，本图只落共享索引侧的证据，并在图上写明。

答案须给出**可测的断言形状**（负向优先），以及本图**不做**的部分。

## Answer

<!-- 解析时写 -->
