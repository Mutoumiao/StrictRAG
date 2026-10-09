# 现状核实：检索语料装载的租户来源链与影响面

Type: research
Status: resolved

## Question

把「检索语料装载的租户从哪来、反推会造成什么」一次核清，供工单 02 裁定。逐条给**源码出处**（路径:行号）与**实测命令**：

1. **反推点**：`apps/api/src/services/retrieve/corpus.ts` 里 `tenantId` 取自哪一行？取值表达式是什么？`dual` 为空时该值是什么？
2. **用法**：该 `tenantId` 被传给谁、用来做什么？（`loadVisibilityContext` / `resolveDeptAclEnforce` / 其它）逐点列出行号。
3. **入口链**：`RetrieveInput.tenantId` 从哪来（ask 路由 → graph → retrieve）？逐层给行号；确认调用 `loadCorpus` 时**没有**把它传下去。
4. **全部调用点**：`loadCorpusFromDb` / `CorpusLoader` 类型的所有生产调用点与测试注入点（含 `apps/api/src/scripts/*`），逐个列出并说明各自能否拿到 `tenantId`。
5. **`documents` 的租户列**：schema 定义（是否 NOT NULL）、写路径（complete / write / upload-url）是否强制写当前租户、有无跨租户写入的可能面。
6. **既有闸**：`es-sparse.ts` 的 `requireTenantId` 今天管到哪一步、从哪个变量取 `tenantId`（是入口的还是反推的？）—— 这决定了「ES 侧必填」是否真的挡住了反推。
7. **影响面**：若把语料查询加 `eq(documents.tenantId, tenantId)`，哪些既有测例会变红？（列文件与断言期望）有没有测试夹具**故意**造「文档行租户 ≠ 入口租户」的情形？
8. **既有测例存货**：`apps/api/tests/ask/*` 与 `apps/api/tests/acl/*` 里与 corpus / 可见性上下文相关的文件与 `tests/index.md` 登记。

产物：`.scratch/retrieve-corpus-tenant-scope/research/01-is-verify.md`。硬约束：**只读**，不改任何文件；每条结论带路径:行号或命令输出。

## Answer

结论见 [`research/01-is-verify.md`](../research/01-is-verify.md)。要点（供工单 02 判定）：

1. **反推点**：`corpus.ts:69` = `tenantId: dual[0]?.tenantId`；`dual` 为空时 `undefined`。
2. **用途**：该值**只**进 `loadVisibilityContext`（作 `subject.tenantId`）→ 部门 / grant 上下文；**不进 ES sparse**。
3. **入口链**：`RetrieveInput.tenantId` ← `ask.ts:314` 的 `auth.tenantId ?? kb.tenantId`；`retrieve.ts:138-143` / `:147` 调 `loadCorpus` 时**未传**。
4. **调用点**：生产装载仅 2 处 —— `retrieve.ts:344`（默认 deps，手上有 `input.tenantId`）与 `seed-es-sparse-probe.ts:47`（**另行反推** `firstDoc.tenantId`）；其余是单测注入点。
5. **租户列**：`documents.tenant_id` **NOT NULL**；`upload-url` / `write` / `complete` 一律写 `kb.tenantId`，无跨租户写入面。
6. **ES 硬闸**：`requireTenantId` 取**入口租户**（`retrieve.ts:199` → `es-sparse.ts`），**不是**反推值 → 前图那条硬闸**挡不住**装载面的反推（两者本非同一变量）。
7. **影响面**：加租户谓词后**运行时不红**（装载测例把 `db.js` 的 `where` mock 成忽略入参）→ 新增谓词**无回归保护**；会红的只是类型检查（3 个调用点未传 `tenantId`）。**无**夹具造「文档行租户 ≠ 入口租户」。
8. **测例存货**：`tests/ask/` 与 `tests/acl/` 相关文件在 `tests/index.md` 均登记「现行」。

**风险点**：PG（文档行）与 ES（入口）租户来源二元化 · 语料查询无租户条件 · mock 忽略 `where` 使新谓词不可测 · 探针脚本同款反推。
