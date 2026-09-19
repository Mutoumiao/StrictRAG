# 第三条 ES 查询路径补租户闸（`listIndexedChunkIds`）

Type: task
Status: resolved
Blocked by: —

## Question

反向复核（[12](./12-research-writeback-countercheck.md)）查出：QUAL-TENANT-Q 只覆盖了两个**纯 builder**（`buildAclFilter` 查询 · `sparseBulkSource` 批量），但 worker 还有第三条 ES 查询路径没有租户闸 ——

```
apps/worker/src/ingest/es-http.ts:181  listIndexedChunkIds(cfg, docId)
  → _search 的 query 只有 { term: { docId } }，无 tenantId，缺 tenantId 也不失败
```

而这条路径正是**孤儿清理的 ES 侧入口**（`orphan-clean.ts` 走它比对索引内 chunk）。所以 `coverage/03-ops.md` O4 行的 Then「无 `tenantId` 的 query builder → 单测/门禁失败」在**全仓口径**下仍不成立。

要做的：把这条路径纳入同一道闸 —— 与工单 [17（TENANT-Q 口径裁定）](../close-p2-exit-gaps/issues/17-dec-tenant-q-scope.md) 的裁定同向（**门禁只加严不放宽**：缺 / 空 / 空白 `tenantId` → 抛），并补正反例测。

**注意口径**：`docId` 是 uuid v7、全局唯一，所以「查 docId 就够」在**今天**不构成跨租户泄漏；本票不是修漏洞，而是**把闸补全到全仓一致**，避免「某些 ES 查询有闸、某些没有」这种半套状态。

## Answer

**已完成**：第三条 ES 查询路径已纳入同一道闸，全仓 ES 查询 / 写入至此统一为「每条都带租户」。

**改动**（`apps/worker/src/ingest/es-http.ts`，25 行）

1. `requireTenantId(tenantId, where)` 加上 `where` 参数，报错可定位到具体调用点（消息统一为 `missing tenantId in ${where}; 禁止无租户过滤的 ES 查询/写入`）；既有 bulk 调用点补传 `'sparseBulkSource'`。
2. `listIndexedChunkIds(cfg, docId, tenantId)` 加第三位参数，**函数体首行、任何 `fetch` 之前**校验。
3. 查询体由 `{ term: { docId } }` 改为 `{ bool: { filter: [{ term: { tenantId } }, { term: { docId } }] } }`。

**取舍：加 `term: tenantId`（不是只加校验）**。理由是与 `buildAclFilter` 的「每条 ES 查询都带租户」口径统一，消除半套状态。`docId` 是 uuid v7、全局唯一，所以**今天不加也不构成跨租户泄漏**，本票属**加严而非补漏**。风险已评估：正常路径的 `tenantId` 字段必在（写入必经已闸的 `sparseBulkSource`，且索引把它声明为 `keyword`）；若遇旧索引把该字段动态映成 text → term 静默不命中 → 命中 0 → 上层 `reconcileIndexed` 判 not ok → `ES_RECONCILE_FAILED`，**fail-closed 不放行**（且该分支只在 `INGEST_ES_MODE=http` 下才走，默认 mock 不受影响）。

**改动范围的一处越界（已评审接受）**：工单原文假设调用点在 `orphan-clean.ts`，实际**不是** —— `orphan-clean.ts` 走 `mockEsStore`；唯一调用点是 `apps/worker/src/ingest/pipeline.ts:939`（`es_index` 阶段的 http 分支），改为 `listIndexedChunkIds(cfg, doc.id, doc.tenantId)`（同一段 L930 已用 `doc.tenantId` 给 bulk）。**只有这 1 行**，且不改则 http ES 路径会直接 `ES_INDEX_FAILED`，属「调用点必须跟着改」，故接受。

**测例**：`apps/worker/tests/ingest/es-builder-tenant-required.test.ts` 新增 1 个 describe / **3 条 `it`** —— 缺 / 空 / 纯空白 → 拒绝且断言 **`fetch` 零调用**；正常路径对照断言 URL 为 `_search`、过滤体恰为 `tenantId + docId`、`size` / `_source` 逐位不变并回读 chunkId 列表；首尾空白按 trim 后入过滤体。既有 3 条断言**未放宽、未删除**；`apps/worker/tests/index.md` 已登记（目标 / 被测 / 简介同步）。

**验证**：`pnpm --filter @strict-rag/worker test` → 47 文件 / **215 通过**（该文件 3 → 6 条，新增确在跑）；全仓 `pnpm test` **11/11**（api 155 / 935 + 3 skip）；`check-types` 8/8；`lint` 8/8 零 warning。

**同文件其余路径的核查（未改，仅报告）**：`ensureSparseIndex` / `putSparseAclMapping`（HEAD index、PUT index、PUT `_mapping`）属索引生命周期调用，**无租户语义**；`es-store.ts` 的 `mockEsStore`（`listVersions` / `listChunkIds` / `dropVersion` 只按 docId）是 mock 侧非 HTTP。worker `src/` 内 ES HTTP 客户端只有 `es-http.ts` 一个 —— 所以**这道闸现在覆盖了 worker 全部 ES HTTP 查询与写入**。

**连带**：`coverage/03-ops.md` 的 O4 行已按本票结果更新缺口描述（「全仓统一」这一截现已成立），见工单 [12](./12-research-writeback-countercheck.md) 的收口。
