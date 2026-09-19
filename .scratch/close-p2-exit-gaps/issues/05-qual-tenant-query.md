# QUAL-TENANT-Q：无 tenantId 的 ES builder 必须失败

Type: task
Status: resolved
Blocked by: 17

## Question

剧本 O4：「无 `tenantId` 的 query / bulk builder 必须失败」。IS：ES query / bulk builder 均无 `tenantId` 强制字段，现仅 `kbId` filter（O1 测的是 `kbId`，不是本 ID）。

把 `tenantId` 变成 builder 的**必填硬约束**：

- 共享索引与「多租户独立索引」两种布局都不例外；缺 `tenantId` 时**构查询即失败**（不是静默少过滤、不是回退全租户、不是补默认租户）。
- 范围：`apps/api` 检索 / 预览侧 + `apps/worker` bulk 侧，**含 mock ES 适配层路径**（凡走到 ES 查询构造的地方都要覆盖）。
- 契约：仅当需要新错误码 / 类型时才动 `packages/contracts`；错误码取 PRD 短名。

补测：无 `tenantId` 必须失败（query 与 bulk 各一条），有 `tenantId` 行为**逐位不变**（既有 O1 `kbId` 测不得被改写）。**禁止放宽既有 `kbId` 闸。**

## Answer

按前置 [17 的裁定](./17-dec-tenant-q-scope.md) 实现：门禁落在**运行时构造即抛**，不动 TS 类型契约。

### 改了什么

- `apps/api/src/services/retrieve/es-sparse.ts`：新增 `requireTenantId()`，在 **`sparseBulkSource`**（bulk 侧）与 **`buildAclFilter`**（query 侧）里对 `tenantId` 做运行时校验 —— 缺 / 空串 / 纯空白 → 抛 `EsSparseError(..., 'config')`。注释写明「独立索引布局同样受此约束（ADR-041）」作为将来 B8 的准入要求。
- `apps/worker/src/ingest/es-http.ts`：同形 `requireTenantId()` + `sparseBulkSource` 校验（该包无 `EsSparseError`，抛 `Error`）。
- 因为 `bulkIndexSparse`（两仓）都经 `sparseBulkSource` 构 source，**bulk 路径自动覆盖**。

### 测了什么

- 新增 `apps/api/tests/ask/es-builder-tenant-required.test.ts`（5 条）：query/bulk 缺 `tenantId` 与空串 / 纯空白均抛；带 `tenantId` 时 filter 恒为 `[{term:{tenantId}},{term:{kbId}}]`、source 逐位不变。
- 新增 `apps/worker/tests/ingest/es-builder-tenant-required.test.ts`（3 条）：同上（bulk 侧），并断言 **`bulkIndexSparse` 在抛之前不得发出任何 HTTP**（stub fetch 未被调用）。
- 两处均登记 `tests/index.md`。
- **既有 O1 的 `kbId` 闸未被改写**：相关子集回归 `apps/api` 84 文件 / 507 通过（ask + acl + ingest）· `apps/worker` 30 文件 / 149 通过。

### 本票不做（同 17）

`mockEsStore` 的 tenant 维（那是 PG 文本替身，无租户概念，加维等于给非生产路径发明语义）；独立索引布局的实现（随 B8）；下沉到 HTTP 响应层（构造期已失败，无必要）。
