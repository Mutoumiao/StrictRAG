# 敏感解禁最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 44

## Question

补 P3b complete 闸：敏感库在 **ACL 就绪** 时允许 complete。这是本批唯一一张执行工单。

权威：[裁定 ES 查询期 principals 对称后下一步](./44-after-es-principals-order.md)。文档 ACL 用户 uuid 最小 + ES 查询期对称已齐。`DEPT_ACL_ENFORCE` **默认仍关**。角色 principal 仍留雾。

ACL 就绪 = 下列任一：

- **部门路径**（现口径，不改）：`deptAclEnforce` 为真 **且** 文档有非空 `ownerDeptId`
- **名单路径**（本刀）：文档 `aclPrincipals != null`（显式 `[]` 或 uuid 列表均算已设）

未设名单（`null` / 缺字段）**不算**就绪。不得把「功能已落地」当成全局解禁。

### 做

- `isSensitiveCompleteBlocked`：internal 仍不挡；sensitive 在部门路径或名单路径任一成立时放行，否则挡。
- `POST …/complete`：策略闸之后、`markComplete` 之前仍走该函数。complete body 可选 `aclPrincipals`（omit 不改；`null` 清回未设；`[]` 显式空；uuid 列表，最长 256，非法 uuid / 超长 400）。与 `ownerDeptId` 一样可在本请求先 `patchMeta` 再过闸。
- 挡时仍 400 `RULE_VIOLATION`。文案改为 ACL 就绪，不写死「只等部门强制」。
- 现有部门路径测例仍绿：sensitive + 无 enforce 且无名单仍挡；enforce + owner 仍放行；complete 同请求带 owner / 显式 null 行为不变。
- admin 设置页语料分级说明改为：complete 须 ACL 就绪（部门强制+归属，或显式名单）。不是仓库默认开强制，不是角色 principal。
- 测例：
  - 纯函数：internal 不挡；sensitive + 关强制 + null 挡；关强制 + `[]` 放行；关强制 + uuid 列表放行；开强制无 owner 且 null 挡；开强制有 owner 仍放行（即使名单 null）
  - HTTP：sensitive + 关强制 + 已有 `[]` → 200；关强制 + complete body 带 uuid 列表 → 200 且写入；关强制 + complete 显式 `null` → 仍 400；非法 uuid 400 `VALIDATION_ERROR` 且不 markComplete
  - 契约：complete body omit / null / `[]` / uuid；非法 uuid / 超长 400
  - admin：设置页可见 ACL 就绪说明；不再写「不是已解禁」当现状

### 不做

- 仓库默认 `DEPT_ACL_ENFORCE=true`
- 角色码 / `role:` 前缀 principal
- 改 retrieve / 列表 / ES 过滤
- 把 `aclPrincipals == null` 当就绪（fail-open）
- 上传表单加名单控件 / 自动 reindex
- 在线编写 / P3a / P4 / 人签 / 默认开 rewrite / LangGraph / E2E / B8

收工：`.trellis/spec/` api / contracts / admin；`docs/module-status/` 对应包；coverage 能指到的 Then 回写。禁止 push。禁止 `task.py create`。

写代码前读 `.trellis/spec/api/backend/kb-settings.md`、`departments.md`、`.trellis/spec/guides/testing.md`。测例落 `tests/<能力>/`，文件头简体中文，登记 index。

## Answer

敏感 complete 解禁已落地。

- ACL 就绪 = 部门路径（`deptAclEnforce` ∧ 非空 `ownerDeptId`）**或** 名单路径（`aclPrincipals` 为数组，含 `[]`）。`null` / 缺字段仍挡。
- complete body 可选 `aclPrincipals`（omit 不改；`null` 清回未设；`[]` 显式空；uuid 列表最长 256）。与部门字段一样可本请求先 `patchMeta` 再过闸。
- 回读失败 / KB 行缺失 → 404，不回退旧快照、不把缺库当 `internal` 放行。
- 挡时仍 400 `RULE_VIOLATION`。admin 设置页说明改为 complete 须 ACL 就绪。
- 测例：api `data-class-complete` 5；`sensitive-complete` 16；contracts complete body 三态；admin 设置文案。

未做：默认开 `DEPT_ACL_ENFORCE`、角色 principal、上传表单名单、改检索过滤。未 `task.py create`。未 push。

证据：`apps/api/src/services/kb-settings.ts` · `apps/api/src/routes/documents/index.ts` · `packages/contracts/src/ingest/document.contract.ts` · `apps/api/tests/kb/data-class-complete.test.ts` · `apps/api/tests/ingest/sensitive-complete.test.ts`。

## Comments

- 2026-09-08 认领并执行。权威切边见 [裁定 ES 查询期 principals 对称后下一步](./44-after-es-principals-order.md)。
- 审查指出 patch 后 `getDoc` 失败回退旧值、缺 KB 当 internal 会 fail-open；改为 404 且不 markComplete。
