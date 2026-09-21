# 落「同一可见性函数」收敛

Type: task
Status: resolved
Blocked by: 04

## 做什么

按 `04-dec-visibility-function.md` 的裁定，把今天五份可见性组装（文档列表 · 详情/ACL · 分片预览 · ask 语料装载 · `hasRetrievableDocs`）收敛到一处，行为**逐位等价**。

## 完成判据

- 收敛后不存在第二份「部门 + principals」组合逻辑（除被收敛后的薄包装）。
- 既有测例全绿；新测例证明「同一函数」确实被复用（例如断言两入口在同一夹具下产出同一可见集合），并给反证（把该函数改宽 → 至少两条测例变红）。
- `pnpm check-types` + `pnpm lint` + `apps/api` 测试全绿。

## Answer

### 落了什么

- **新增** `apps/api/src/services/retrieve/visibility.ts`：`loadVisibilityContext`（全仓唯一「归属 + 部门树 + grant」三连加载处；`!enforce || bypass` 短路为空 ctx，既不查库也把判定退化为名单闸独担）· `isDocVisible`（部门 → 名单，返回 `reason: 'dept' | 'principals'`）· `filterVisibleDocs`。
- **四个活入口改调用它**：文档列表（`routes/documents/index.ts` `GET /knowledge-bases/:kbId/documents`）· 详情 / ACL 清单（同文件 `docReadDenied`，两入口共用一份判定）· 分片预览（`routes/chunks.ts` `deniedDocReadMessage`）· ask 语料（`services/retrieve/corpus.ts` `loadCorpusFromDb`）。收敛后这四个入口**不再各自组装**，`filterVisibleDocs` 与 `isDocVisible` 是同一份裁决的集合 / 单项两种出口。
- **第五处 `sparseNarrowingForSearch`（`services/retrieve/retrieve.ts`）也改走 `loadVisibilityContext`**：它是 ES 查询期投影（`collectVisibleOwnerDeptIds` + `maxVisibleLevelUpperBound`），不是第二份 PG 闸；改后三连加载全仓只剩一处，且它与 PG 闸共用同一个 `now`。
- **删除死代码** `hasRetrievableDocs`（`corpus.ts` 定义 + `retrieve/index.ts` 再导出）：全仓 3 命中、零调用方。**删除后全仓无任何行为变化**（全量测例证明）。
- `retrieve/index.ts` 增补 `visibility.ts` 的导出（含类型）。

### 保留的差异（未被「统一」掉，也不得被统一）

1. **超管 bypass 通道**：路由层直判角色（`roleBypassesKbMembership`），检索层读 `membership` 槽（跑批刻意压低）。收敛只统一函数内部，`bypass` 仍由调用方作为 `subject.bypass` 传入 —— 新测例里第四面因此必须显式传 `bypassDeptAcl: true` 才能与前三面一致，这正是该差异的**活证据**。
2. **tenantId 来源**：路由侧沿用文档行（`doc.tenantId` / `rows[0]?.tenantId`），检索侧沿用 `dual[0]?.tenantId`。**接口缺口仍在**：`RetrieveInput.tenantId` 已有但 `CorpusLoader` 签名不传，故检索侧只能从文档行反推（fail-closed 方向）。本票**未动**该缺口（改它要动 `loadCorpus` 全部夹具，属独立小图）。
3. **输出形态**：①④取集合、②③取 bool + 403 文案（由 `reason` 映射：`department acl denied` / `document acl denied`，文案逐字不变）。
4. `filterDocsForRetrieve`（ready ∧ active ∧ 窗口 ∧ docTypes）未并入——它是 ADR-057 求交公式的独立项。
5. **成员闸仍在函数外**（`createDocMemberGate` 是外层）；本步未引入请求级缓存（原裁定即如此）。

### 证据

- 新测例 `apps/api/tests/acl/visibility-single-function.test.ts`（4 例，已登记 `apps/api/tests/index.md`）：同一夹具（空部门 / 同部门 / 级别不足 / 跨部门 / 名单不含五种文档）下，**四个面**（列表 HTTP · 详情 HTTP · 分片 HTTP · 真实 `loadCorpusFromDb`）在**开强制 / 关强制 / 超管旁路 / 无归属**四态产出的可见集合两两一致，且等于钉死的预期（非空转）。其中「关强制」态断言 `P20`（名单不含该用户）仍不可见 —— 名单闸不随部门闸关闭而失效。
- **反证**：把 `isDocVisible` 传给 `isDocVisibleForDeptAcl` 的 `enforce` 临时改成 `false`（即整体放宽部门闸）→ 3 个文件 **12 例红**（新测例 2 · `acl/documents-dept-filter.test.ts` 7 · `acl/chunks-dept-filter.test.ts` 3）；还原后全绿。
- **结构性证据**：全仓 `grep loadDeptAssignments|loadDeptNodes|loadDeptGrants` 只剩两类命中 —— 定义处（`dept-acl.ts`）与 `visibility.ts` 的唯一并列调用。不存在第二处三连加载。
- **门禁**：`apps/api` `tsc --noEmit` 0 · `eslint --max-warnings 0` 0 · `vitest run` **163 文件 / 992 通过 + 3 skipped**（收敛前为 162 / 988，新增 4 例）。既有 162 文件在收敛后**一字未改断言**仍全绿，即「逐位等价」由全量回归背书。

### 未做 / 未验证

- `CorpusLoader` 的 tenantId 接口缺口（见上「保留的差异 2」）——仍在图雾中。
- 本裁定依赖的「五处行为等价」来自只读分析；本票以**收敛后的全量回归**作为等价性证据（无第二套 oracle）。
- 未动 `prds/00–11`，未改任何仓库默认开关。
