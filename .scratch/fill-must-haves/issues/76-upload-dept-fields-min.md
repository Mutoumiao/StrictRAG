# 上传表单标部门最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 75

## Question

补 P2 创建面部门字段真空：上传 / 在线编写不能标所属部门与可见级别。这是本批唯一一张执行工单。

权威：[裁定类型分区 CRUD 后下一步](./75-after-doc-type-catalog-order.md)。类型分区 CRUD 最小闭环已齐。仓库默认强制仍关。角色 principal 仍留雾。人签仍图外。

现状（源码）：

- `CompleteUploadBodySchema` / `WriteDocumentBodySchema` 已收 `ownerDeptId` / `visibilityLevel`
- complete / write HTTP 已 `patchMeta`
- admin 列表与行展开可改这两字段
- `uploadAdminDocument` 只传 `chunkStrategy` + `checksumSha256`
- `writeAdminDocument` 只传 `title` / `markdown` / `chunkStrategy`
- 上传确认条只有策略原生 `<select>`；编写区无部门控件

口径：

- 创建面（上传 + 在线编写）可标 **所属部门** 与 **可见级别**
- 空归属 = 库级 `null`；可见级默认 **20**
- 有 `dept.manage`：部门 `ClosedSelect`（库级 + 本次 GET 部门名）；无该码：创建面只留库级，**不**新开 uuid 粘贴
- 可见级始终 `ClosedSelect`（10/20/30/40，文案走既有 `visibilityLabel`）
- 新下拉必须 `@strict-rag/ui` `ClosedSelect`；禁止新原生 `<select>`
- complete / write 把字段带上；omit 与显式 `null` 语义不变
- 不强制必填；不改检索闸；不默认开 `DEPT_ACL_ENFORCE`
- 列表 / 行展开 PATCH 不改
- `isDefaultRetrievable` **不**改
- 测例禁止依赖墙钟、禁止真集群

### 做

- admin：`toCreateDocAclFields`；`uploadAdminDocument` / `writeAdminDocument` 可带部门两字段
- admin 文档页：创建面 ClosedSelect；有 `dept.manage` 才拉部门选项
- 测例：
  - admin 服务：complete / write body 含 `ownerDeptId` / `visibilityLevel`；空归属传 `null`
  - admin 工作区：有 `doc.upload`+`dept.manage` 可见创建面部门关闭列表；选部门后上传调用带 uuid；编写提交同样带字段
  - api HTTP：write 带 `ownerDeptId` 落 patchMeta（complete 已有敏感路径覆盖，不重复造闸）

### 不做

- MD/TXT 更严体积档 / 魔数嗅探
- 上传表单标类型 / aclPrincipals
- 新 `GET /departments` 成员口 / 放宽 `dept.manage`
- 详情页既有原生 `<select>` 换 ClosedSelect
- paramSchema 动态表单
- BlockNote / editor-draft
- 默认开 `DEPT_ACL_ENFORCE` / 角色 principal / 默认开 OCR / 真引擎
- 改 `prds/00–11`

收工：`.trellis/spec/` admin directory-structure；`docs/module-status/` admin。禁止 push。禁止 `task.py create`。08-06 只留指针。

写代码前读 `.trellis/spec/admin/frontend/directory-structure.md`、`.trellis/spec/admin/frontend/module-layering.md`、`.trellis/spec/guides/testing.md`。测例落 `tests/<能力>/`，文件头简体中文，登记 index。

## Answer

上传表单标部门最小闭环已落地。

- 创建面（上传 + 在线编写）用 `ClosedSelect` 标 `ownerDeptId` / `visibilityLevel`；空归属 = 库级 `null`；可见级默认 20。
- complete / write 把字段带上；有 `dept.manage` 才拉部门名；无该码只留库级。
- 列表 / 行展开 PATCH 未改。未默认开 `DEPT_ACL_ENFORCE`。
- 无 MD/TXT 更严体积 / 无魔数嗅探 / 无上传标类型 / 无新部门列表口。

证据：`apps/admin/src/app/(ops)/documents/upload.services.ts` · `write.services.ts` · `_components/documents-workspace.tsx` · `apps/admin/tests/ops/document-upload.test.ts` · `document-write.test.ts` · `documents-workspace.test.tsx` · `apps/api/tests/ingest/write-document-http.test.ts`。

未 `task.py create`。未 push。

## Comments

- 2026-09-15 认领并在主分支执行。权威切边见 [裁定类型分区 CRUD 后下一步](./75-after-doc-type-catalog-order.md)。
