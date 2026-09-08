# ES 查询期 principals 对称最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 42

## Question

补 P3b 检索面对称：ES 查询期按文档 `aclPrincipals` 收窄。这是本批唯一一张执行工单。

权威：[裁定 aclPrincipals 全文最小闭环后下一步](./42-after-acl-principals-order.md)；覆盖分册 `docs/testing/coverage/02-acl.md` AE8；PG 闸已在 [aclPrincipals 全文最小闭环](./41-acl-principals-min.md)。`DEPT_ACL_ENFORCE` **默认仍关**。显式名单 **不**跟该开关。

### 做

- worker `bulkIndexSparse` / mapping 与 api `es-sparse` 对齐：keyword `aclPrincipals`。
  - PG `NULL` / 未设：**不写**该字段（缺字段 = 未设 = 成员可读）。
  - 显式 `[]`：**写入哨兵** `__acl_none__`（ES exists 不认空数组；哨兵使字段存在且对真实 userId 无 term 命中）。
  - 非空 uuid 列表：写入该数组。
- `buildAclFilter` 可接收可选 `applyAclPrincipals` + `aclPrincipalUserId`。
  - 非超管且 `applyAclPrincipals`：filter 追加 bool should：`must_not exists aclPrincipals` ∪（userId 非空时）`term aclPrincipals=userId`；`minimum_should_match: 1`。
  - 超管 bypass 或缺 apply：不加该 clause，仍只 tenantId+kbId（部门 terms 规则不变）。
  - 无 userId 且非 bypass：只 `must_not exists`（名单文档与空数组文档都不命中）。
- `runRetrieve` http sparse：非超管始终传 apply（**不**读 `DEPT_ACL_ENFORCE`）。超管不传。
- worker 入库 bulk 从文档行带上 `aclPrincipals`。
- PG `filterDocsForAclPrincipals` **保留**（精确可见级仍以 PG 为准；ES 只收窄，允许多召回、禁止少隔离租户）。改名单 **不**自动 reindex（旧索引缺字段会过召回，PG 仍滤）。

- 测例：
  - 缺省 / 不 apply：filter 无 principals clause
  - 非超管 apply + userId：含 should（must_not exists ∪ term）
  - 非超管 apply 无 userId：只有 must_not exists
  - 超管：无 principals clause
  - mapping 含 keyword `aclPrincipals`
  - bulk：null 不写字段；`[]` 写哨兵 `__acl_none__`；非空写数组
  - 已有索引 PUT `_mapping` 补 keyword（避免 dynamic 映成 text）
  - `runRetrieve`：成员带 apply+userId；超管不带；enforce 开关不影响 principals
  - 现有 es-dept-query-filter / sparse-kb-filter / retrieve-dept-acl / doc-acl-principals 仍绿

### 不做

- 仓库默认 `DEPT_ACL_ENFORCE=true`
- 敏感解禁（complete 闸语义不改）
- 角色码 / `role:` 前缀 principal
- 用 ES 替换 PG 名单闸 / 部门闸
- 改 principal 自动 reindex
- `allowedDocIds` / `acl_filter_too_large`
- 在线编写 / P3a / P4 / 人签 / 默认开 rewrite / LangGraph / E2E / B8

收工：`.trellis/spec/` api / worker；`docs/module-status/` 对应包；coverage `02-acl` AE8 能测的 Then 回写。禁止 push。禁止 `task.py create`。

写代码前读 `.trellis/spec/api/backend/` 检索与 `es-sparse.ts`、`.trellis/spec/guides/testing.md`。测例落 `tests/<能力>/`，文件头简体中文，登记 index。

## Answer

ES 查询期 principals 对称已落地。

- mapping：keyword `aclPrincipals`。已有索引 `PUT _mapping` 补字段（避免 dynamic 映成 text）。
- bulk：PG `NULL` 不写字段；显式 `[]` 写哨兵 `__acl_none__`（ES exists 不认空数组）；非空写 uuid 列表。
- 查询：非超管始终 `applyAclPrincipals`（**不**跟 `DEPT_ACL_ENFORCE`）。should = `must_not exists` ∪（有 userId 时）`term`。超管不加 clause。
- PG `filterDocsForAclPrincipals` 保留。改名单不自动 reindex。
- 测例：api `es-principals-query-filter` 12；worker `es-http` 含 bulk 三态与 mapping PUT。部门 terms 测仍绿。

未做：默认开 `DEPT_ACL_ENFORCE`、敏感解禁、角色 principal、用 ES 替换 PG 闸。未 `task.py create`。未 push。

证据：`apps/api/src/services/retrieve/es-sparse.ts` · `retrieve.ts` · `apps/worker/src/ingest/es-http.ts` · `pipeline.ts` · `apps/api/tests/ask/es-principals-query-filter.test.ts` · `apps/worker/tests/ingest/es-http.test.ts`。

## Comments

- 2026-09-08 认领并执行。权威切边见 [裁定 aclPrincipals 全文最小闭环后下一步](./42-after-acl-principals-order.md)。
- 审查指出空数组在 ES exists 语义下等于缺字段；改为哨兵 `__acl_none__`，并对已有索引 PUT mapping。
