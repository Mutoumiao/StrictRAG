# ES 查询期部门对称最小闭环

Type: task
Label: wayfinder:task
Status: claimed
Assignee: grok
Triage: ready-for-agent
Blocked by: 38

## Question

补 P3b 检索面第一刀：ES 查询期按部门收窄。这是本批唯一一张执行工单。

权威：[裁定失败 Webhook 最小闭环后下一步](./38-after-ingest-webhook-order.md)；`buildAclFilter` 现只 `tenantId+kbId`；精确可见级在 `filterDocsForDeptAcl`（`apps/api/src/services/retrieve/dept-acl.ts`）。`DEPT_ACL_ENFORCE` **默认仍关**。

### 做

- worker `bulkIndexSparse` / mapping 增加 keyword `ownerDeptId`（无部门则不写该字段或写空，查询不得把缺字段当全员可见）。
- `buildAclFilter` 可接收可选 `ownerDeptIds: string[]`。enforce 开且非超管：filter 增加 `ownerDeptId` terms（用户归属精确 ∪ 祖先可见部门，与现 PG 归属口径一致；grant 部门并入 terms）。enforce 关或超管 bypass：不加部门 terms，仍只 tenantId+kbId。
- 检索调用 ES 时传入该列表。PG `filterDocsForDeptAcl` **保留**（可见级 / grant 过期 / inherit 精确语义仍以 PG 为准；ES 只收窄，允许多召回、禁止少隔离租户）。
- 测例：
  - enforce 关：filter 仍只有 tenantId+kbId
  - enforce 开非超管：含 ownerDeptId terms
  - 超管：无部门 terms
  - worker mapping/bulk 含 ownerDeptId
  - 现有 sparse-kb-filter / retrieve-dept-acl 仍绿

### 不做

- 仓库默认 `DEPT_ACL_ENFORCE=true`
- 敏感 KB 解禁
- aclPrincipals 用户级全文数组
- 用 ES 替换 PG 可见级闸
- 在线编写 / Webhook 返工
- P3a / P4 / 人签 / 默认开 rewrite / LangGraph / E2E / B8

收工：`.trellis/spec/` api/worker；`docs/module-status/api.md` worker.md；coverage 02-acl 若有对应行则回写。禁止 push。禁止 `task.py create`。

写代码前读 `.trellis/spec/api/backend/` 检索相关与 `dept-acl.ts`。测例落 `tests/<能力>/`，文件头简体中文，登记 index。

## Comments

- 2026-09-07 认领并执行。权威切边见 [裁定失败 Webhook 最小闭环后下一步](./38-after-ingest-webhook-order.md)。
