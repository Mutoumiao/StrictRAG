# aclPrincipals 全文最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 40

## Question

补 P3b 文档 ACL 第一刀：文档级 `aclPrincipals`（用户 uuid 数组）可存、可回读、检索/列表同滤。这是本批唯一一张执行工单。

权威：[裁定 ES 查询期部门对称后下一步](./40-after-es-dept-filter-order.md)；覆盖分册 `docs/testing/coverage/02-acl.md` 剧本 B2-1 / B2-4；`documents` 现无该列；精确部门可见级仍走 `filterDocsForDeptAcl`。`DEPT_ACL_ENFORCE` **默认仍关**。

### 做

- **列**：`documents.acl_principals` 可空 `uuid[]`（migration `0014`）。SQL `NULL` = 未设（KB 成员可读）；`'{}'` = 显式空（非超管不可读）。禁止把 `NULL` 当成 `[]`。
- **契约**：`PatchDocumentMetaBodySchema` 可写 `aclPrincipals: string[] | null`（omit 不改；`null` 清回未设；`[]` 显式空）。元素必须 uuid，否则 400 `VALIDATION_ERROR`。数组最长 256，超出 400。`DocumentListItem` / `DocumentDetail` 回读，缺省 `null`。
- **可见性**（独立纯函数，**不要**塞进 `dept-acl.ts`）：`isDocVisibleForAclPrincipals` / `filterDocsForAclPrincipals`。
  - `bypass`（`roleBypassesKbMembership`）→ 可见
  - `aclPrincipals == null` → 可见（仍受成员闸 / 部门闸）
  - `aclPrincipals.length === 0` → 不可见
  - `userId` 落在数组内 → 可见
  - 否则不可见；缺 `userId` 且非 bypass → 不可见（不 5xx）
- **挂载**：列表、详情/预览、chunks、`loadCorpusFromDb` 在部门滤之后再跑 principals 滤。**不**跟 `DEPT_ACL_ENFORCE`：显式名单永远生效。部门滤语义不改。
- **admin**：文档行展开回读；有 `doc.editor` 时可保存 UUID 列表（逗号或换行；空串 = `null` 未设；只空白括号语义走显式 `[]` 若表单能表达，否则用独立「仅名单」勾选或空数组提交）。禁止新原生 `<select>`。无用户下拉、无角色 principal。
- **测例**：
  - 契约：omit / null / `[]` / uuid 列表；非法 uuid / 超长 400；空 PATCH 仍拒
  - schema：列名 `acl_principals`
  - 纯函数：null 可见、`[]` 不可见、命中可见、未命中不可见、bypass 可见、无 userId 不可见
  - HTTP：PATCH 回读三态；列表对非名单用户不含该行；retrieve 语料/evidence 不含未授权文档（B2-1 最小：注入语料即可）
  - 现有 retrieve-dept-acl / es-dept-query-filter / documents-dept-filter 仍绿
  - admin：行展开能展示名单；保存走 PATCH（无 `doc.editor` 不露保存）

### 不做

- 仓库默认 `DEPT_ACL_ENFORCE=true`
- 敏感解禁（complete 闸语义不改）
- 角色码 / `role:` 前缀 principal
- ES mapping/bulk/query 写 `aclPrincipals` terms（PG 可见级闸先上；ES 允许多召回）
- 用 principals 替换部门闸 / 成员闸
- `allowedDocIds` 请求入参 / `acl_filter_too_large`
- 改 principal 自动 reindex（B2-2 划出；PG 滤即时生效）
- 在线编写 / P3a / P4 / 人签 / 默认开 rewrite / LangGraph / E2E / B8

收工：`.trellis/spec/` api / db / contracts / admin；`docs/module-status/` 对应包；coverage `02-acl` B2-1 / B2-4（能测的 Then 回写，不能把 B2-2/B2-3 假绿）。禁止 push。禁止 `task.py create`。

写代码前读 `.trellis/spec/api/backend/` 检索与授权、`.trellis/spec/db/backend/`、`.trellis/spec/guides/testing.md`。测例落 `tests/<能力>/`，文件头简体中文，登记 index。

## Answer

文档级 `aclPrincipals` 最小闭环已落地。

- 列：`documents.acl_principals` 可空 `uuid[]`（migration `0014`）。SQL `NULL` = 未设（KB 成员可读）；`'{}'` = 显式空（非超管不可读）。
- 契约：PATCH omit 不改；`null` 清回未设；`[]` 显式空；非法 uuid / 超长 256 条 400。列表/详情回读缺省 `null`。
- 可见性：`doc-acl.ts` 纯函数；超管 bypass；不跟 `DEPT_ACL_ENFORCE`。列表 / 详情 / chunks / `loadCorpusFromDb` 在部门滤之后同滤。
- admin：行展开 Textarea +「仅名单可见」；无 `doc.editor` 只读。无用户下拉、无新原生 `<select>`。
- 测例：契约 / schema / 纯函数 / HTTP 三态与列表滤 / admin 保存 `[]`。B2-4 已测；B2-1 部分测。B2-2 / B2-3 仍延后。

未做：默认开 `DEPT_ACL_ENFORCE`、敏感解禁、角色 principal、ES terms、`allowedDocIds`、自动 reindex。未 `task.py create`。未 push。

证据：`packages/db/src/schema/kb/documents.ts` · `apps/api/src/services/retrieve/doc-acl.ts` · `corpus.ts` · `routes/documents/index.ts` · `routes/chunks.ts` · `apps/admin/src/app/(ops)/documents/_components/documents-workspace.tsx` · `apps/api/tests/acl/doc-acl-principals.test.ts` · `apps/api/tests/acl/documents-acl-principals.test.ts`。

## Comments

- 2026-09-07 认领并执行。权威切边见 [裁定 ES 查询期部门对称后下一步](./40-after-es-dept-filter-order.md)。

