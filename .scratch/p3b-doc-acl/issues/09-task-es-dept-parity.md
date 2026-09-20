# 落 ES 查询期的级别收窄（字段 + 级别组）

Type: task
Status: resolved
Blocked by: 06

## 做什么

按 `06-dec-es-dept-field.md` 落 **ES 侧可见级字段与级别组**（该裁定的「部门组重塑」一半另立 `13-task-es-dept-reshape.md`，见其「为何拆票」）。改动保持**纯增量**：不传 `maxVisibleLevel` 时 filter 与旧版逐位一致。

## Answer

### 落了什么

| 处 | 文件 | 改动 |
|---|---|---|
| 级别上界 | `apps/api/src/services/retrieve/dept-acl.ts` | 新增纯函数 `maxVisibleLevelUpperBound({ assignments, grants, now })` = `max(任一处负责人 ? 30 : 20, 未过期 grant 的 maxVisibilityLevel 最大值)`，grant 用既有 `isGrantActive` 过滤 |
| 收窄参数 | `apps/api/src/services/retrieve/retrieve.ts` | `ownerDeptIdsForSparseSearch` 改为 `sparseNarrowingForSearch`，同一份 IO 同时产出 `{ ownerDeptIds?, maxVisibleLevel? }`；enforce 关或超管 bypass → 两者都不传（`{}`） |
| 类型透传 | `apps/api/src/services/retrieve/types.ts` | `SparseSearcher` 入参增可选 `maxVisibleLevel?: number` |
| 查询期 | `apps/api/src/services/retrieve/es-sparse.ts` | `EsSparseSearchInput` 增 `maxVisibleLevel`；新增 `visibilityLevelFilterClause()` 与 `EsVisibilityLevelClause` 类型；`buildAclFilter` 在 `maxVisibleLevel != null` 时追加**独立的**级别组元素 |
| 索引字段 | 同文件 | `SPARSE_INDEX_PROPERTIES` 与 `putSparseAclMapping` 各增 `visibilityLevel: { type: 'integer' }`；`SparseBulkDoc` 增字段，`sparseBulkSource` 有值即写（返回类型放宽到含 `number`） |
| worker 侧 | `apps/worker/src/ingest/es-http.ts` | 同上三处（mapping / bulk 字段 / 补 mapping） |
| worker 调用点 | `apps/worker/src/ingest/pipeline.ts` | bulk 文档补 `visibilityLevel: doc.visibilityLevel`（`getDoc` 取整行，字段本就可用） |

**级别组形态**（`filter` 数组的独立元素，与部门组 AND）：
```json
{ "bool": { "should": [ { "range": { "visibilityLevel": { "lte": N } } },
                        { "bool": { "must_not": { "exists": { "field": "visibilityLevel" } } } } ],
            "minimum_should_match": 1 } }
```

### 证据

- **为什么取上界只加严**：PG 精确规则是 `eff(doc.ownerDeptId) >= vis`（`dept-acl.ts` 的 `isDocVisibleForDeptAcl`）；空部门文档的 eff 取 `assignments.some(isLeader) ? 30 : 20`。取可达上界 ⇒ PG 可见 ⇒ `vis <= 上界` ⇒ 命中 range。该论证写在函数注释、`visibilityLevelFilterClause` 注释与本票。
- **缺字段放行支**：只表示"不放松 vs 今天"（旧索引无该字段）；精确可见级仍由 PG 语料求交把关。
- **新测例**：
  - `apps/api/tests/acl/retrieve-dept-acl.test.ts` 增 `describe('maxVisibleLevelUpperBound')` 4 条（基线 20 / 负责人 30 / 未过期 grant 40 / 过期 grant 不计 / 取最大值）。
  - `apps/api/tests/ask/es-sparse.test.ts` 的 `buildAclFilter` 增 3 条（不传则不加级别组且长度 3；传入则 `toEqual` 完整级别组；级别组与部门组是两个独立元素且级别组不含 `ownerDeptId`）+ 新增 `describe('sparseBulkSource visibilityLevel')` 1 条。
  - `apps/worker/tests/ingest/es-http.test.ts` 增 1 条（`visibilityLevel` 有值即写、缺省与 `null` 不写），并同步更新 3 处 mapping 精确断言（`es-http.test.ts` 建索引与补 mapping、`apps/api/tests/ask/es-principals-query-filter.test.ts` 补 mapping）与 1 处建索引断言（`apps/api/tests/ask/es-dept-query-filter.test.ts`）。
- **反证（实跑）**：把 `buildAclFilter` 里的级别组 push 去掉 + 把 `maxVisibleLevelUpperBound` 的 grant 分支去掉 → `es-sparse.test.ts` 2 条红、`retrieve-dept-acl.test.ts` 2 条红（`expected 30 to be 40` 等）；恢复后 **60/60 绿**。
- **门禁（本票子集）**：`pnpm check-types` **8/8**；api 相关 4 文件 **83/83** 绿；worker 相关 2 文件 **20/20** 绿。

### 未验证 / 划出

- **真 ES 集群行为未验证**：`range` 对缺字段文档是否真的不命中、`integer` 是否与既有 dynamic mapping 冲突、`minimum_should_match` 在 `filter` 上下文的真实语义 —— 全部只断言到请求 JSON 形状（`vi.stubGlobal('fetch')`）。这是 `06` 第 6 节明确划出的项。
- **未对真 PG 验证**：本票未加迁移（`visibilityLevel` 列早已存在），但本机 Docker daemon 未运行，未做任何真库验证。
- **未做**：部门组重塑（库级 `must_not exists ownerDeptId` 分支 + "ids 为空"时关闭 ES fail-open）→ 见 `13-task-es-dept-reshape.md`；角色 principal → 见 map「Not yet specified」。
