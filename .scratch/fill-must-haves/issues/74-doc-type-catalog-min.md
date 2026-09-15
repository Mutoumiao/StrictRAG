# 类型分区 CRUD 最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 73

## Question

补 P2 知识库设置「文档类型」分区真空：枚举只是逗号/`string[]`，无显示名 / 排序 / 启用。这是本批唯一一张执行工单。

权威：[裁定上传 MIME 白名单后下一步](./73-after-mime-whitelist-order.md)。上传 MIME 白名单最小闭环已齐。仓库默认强制仍关。角色 principal 仍留雾。人签仍图外。

现状（源码）：

- `PatchKbSettingsBodySchema.docTypes` 只收 `string[]`
- `config_json.docTypes` 只存码；`toDocTypeItems` 令 `label = code`
- admin 设置页单行逗号输入（`parseDocTypesInput`）
- 无停用：要从枚举消失只能删码
- GET /doc-types 成员口已有；设置 GET 仍要 `kb.config.write`

口径：

- 仍走 **PATCH `/knowledge-bases/:kbId/settings`**（ADR-050 / HTTP 二选一已选 PATCH，不另开子资源、不建 `kb_doc_types` 表）
- catalog 项：`{ code, label, sort, enabled }`；最多 32；`code` 唯一，否则 400
- GET settings 回 `docTypeItems`（全量，按 sort）+ 派生 `docTypes`（**仅启用码**，顺序同 sort）
- PATCH 可写 `docTypeItems` **或** 旧简写 `docTypes`（互斥，同时出现 → 400）
- 旧简写 `docTypes: string[]`：整表替换为启用项，`label=code`、`enabled=true`、`sort=下标`
- 持久化：`config_json.docTypeItems` 为 SSOT；同步写派生 `docTypes`（启用码）
- 旧行只有 `docTypes`、无 `docTypeItems`：解析成全启用、label=code
- `GET /doc-types`：只回 **启用** 项的 `{ code, label }`；停用不出；空仍 `items: []`
- 文档 PATCH / complete 标类型：码须 ∈ **启用** 枚举；空启用列表只能清 null（现语义不改）
- ask `scope.docTypes` 子集闸对启用码；空启用列表仍不限制
- 停用不级联清文档已有 `doc_type`；改码不级联改文档
- 保存后对新请求生效，**不** reindex
- 有 diff 仍走既有修改日志
- admin：设置页逐条增删改 / 上移下移 / 启用勾选；禁止逗号串当主路径；禁止新原生 `<select>`
- `isDefaultRetrievable` **不**改
- 测例禁止依赖墙钟、禁止真集群

### 做

- contracts：`KbDocTypeCatalogItemSchema`；GET settings 含 `docTypeItems`；PATCH 可写 catalog（与 `docTypes` 互斥）
- api：`parseDocTypeCatalogFromConfig`；merge 写 catalog；成员 GET 用启用项真 label
- admin：设置页 catalog 列表，不再 `parseDocTypesInput` 主路径
- 测例：
  - contracts：catalog 形状；重复码拒；`docTypes`+`docTypeItems` 互斥；旧 GET 无 catalog 仍 parse
  - api 纯函数：旧 `docTypes` 合成启用项；停用码不进派生 `docTypes`；简写 PATCH 写成 catalog
  - api HTTP：PATCH catalog 200 回读 label/sort/enabled；GET /doc-types 只含启用且真 label；重复码 400；停用码标注文档 400
  - admin：加载后可见行；新增一行保存 PATCH `docTypeItems` 不发逗号串

### 不做

- 上传表单标部门 / 类型
- MD/TXT 更严体积档 / 魔数嗅探
- 独立 `…/doc-types` 写资源 / 新表
- ES `doc_type` terms / dense 查询期 WHERE
- 改码或停用级联改文档
- 多选勾选组 / 强制用户选类型
- BlockNote / editor-draft
- 默认开 `DEPT_ACL_ENFORCE` / 角色 principal / 默认开 OCR / 真引擎
- 改 `prds/00–11`

收工：`.trellis/spec/` api kb-settings + directory-structure + contracts directory-structure + admin directory-structure；`docs/module-status/` api · admin · contracts。禁止 push。禁止 `task.py create`。

写代码前读 `.trellis/spec/api/backend/kb-settings.md`、`.trellis/spec/api/backend/directory-structure.md`、`.trellis/spec/contracts/library/directory-structure.md`、`.trellis/spec/admin/frontend/directory-structure.md`、`.trellis/spec/guides/testing.md`。测例落 `tests/<能力>/`，文件头简体中文，登记 index。

## Answer

类型分区 CRUD 最小闭环已落地。

- PATCH settings 可写 `docTypeItems`（`code` / `label` / `sort` / `enabled`）或旧简写 `docTypes`（互斥）；catalog 进 `config_json.docTypeItems`，派生启用码仍写 `docTypes`。
- GET settings 回全量 catalog + 启用码；成员 GET /doc-types 只回启用项真 label；停用不出。
- 文档 PATCH 停用码 400；空启用列表只能清 null。ask scope 子集闸对启用码。
- admin 设置页逐条增删改 / 上移下移 / 启用，不再把逗号串当主路径。
- 无新表 / 无独立写资源 / 无上传标部门 / 无级联改文档。

证据：`packages/contracts/src/kb/kb-settings.contract.ts` · `apps/api/src/services/kb-settings.ts` · `apps/api/src/routes/ask.ts` · `apps/admin/src/app/(ops)/kb/settings/_components/settings-workspace.tsx` · `apps/api/tests/kb/doc-type-catalog.test.ts` · `apps/api/tests/kb/doc-type-catalog-http.test.ts` · `apps/admin/tests/ops/kb-settings-doc-types.test.tsx`。

未 `task.py create`。未 push。

## Comments

- 2026-09-15 认领并在主分支执行。权威切边见 [裁定上传 MIME 白名单后下一步](./73-after-mime-whitelist-order.md)。

