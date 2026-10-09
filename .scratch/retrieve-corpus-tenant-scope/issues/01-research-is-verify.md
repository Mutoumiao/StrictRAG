# 现状核实：检索语料装载的租户来源链与影响面

Type: research
Status: claimed

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
