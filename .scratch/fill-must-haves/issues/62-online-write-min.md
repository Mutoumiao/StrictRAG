# 在线编写最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 61

## Question

补 P2.x 在线编写最小闭环：运营在文档页写 Markdown，服务端落对象并进现有审批闸。这是本批唯一一张执行工单。

权威：[裁定暂停后继续走哪条](./61-after-pause-continue-order.md)。P5 可动手真空已尽。仓库默认强制仍关。角色 principal 仍留雾。人签仍图外。

现状（源码）：

- `sourceType` 默认 `upload`；`insertUploadedDoc` 写死 upload
- 无 write HTTP；admin 文档页只有文件选择
- `doc.editor` 只裁 PATCH 元数据保存
- 审批 / complete 体积闸 / 策略闸 / 敏感 ACL / ingest 配额已有
- 仓内无 BlockNote、无 editor-draft

口径：

- `POST …/knowledge-bases/:kbId/documents/write`；码 `doc.editor`（WhenEnforced）
- body：`title` + `markdown`（trim 后非空）+ 可选 `chunkStrategy` / 部门 / 可见级 / `aclPrincipals`
- `contentType=text/markdown`；utf8 写入对象存储；`sourceType=write`
- 其后与 complete 同一套闸：体积、for-upload 策略、敏感 ACL、ingest 配额 → `approvalStatus=pending`，**不**入队 scan
- 空 / 空白正文 400；不跳过审批
- admin `/documents`：有 `doc.editor` 才显示编写区（标题 Input + 正文 Textarea + 提交审批）；新下拉用 `ClosedSelect`；无新菜单
- 覆盖 V7 延后 → 部分测（无 BlockNote）

### 做

- contracts：`WriteDocumentBodySchema` / `WriteDocumentResponseSchema`（含 `sourceType: 'write'`）
- api：`insertUploadedDoc` 可写 `sourceType`；write 路由；complete 闸复用，禁止两套敏感/体积逻辑
- admin：`write.services.ts` + 文档页编写区
- 测例：
  - contracts：title+markdown 合法；空 markdown 拒；响应含 `sourceType=write`
  - api HTTP：合法 → 201/200 pending + `sourceType=write` + putObject；空白 400；不 enqueue scan；≥2 策略未选 400
  - admin：无 `doc.editor` 无编写区；有码可见；空正文不可提交（服务或按钮）

### 不做

- BlockNote / 富文本 / 协同光标
- editor-draft 自动保存 HTTP
- web 用户侧编辑器
- 跳过审批或 complete 后自动 scan
- 新菜单 / 新物理队列
- 仓库默认开 `DEPT_ACL_ENFORCE` / 角色 principal / 默认开 OCR / 真引擎
- 在线编写完整体验其余（版本对比、导出步骤、图片粘贴）

收工：`.trellis/spec/` api documents 目录 + admin 文档页；`docs/module-status/api.md` · admin · contracts；`docs/testing/coverage/01-ingest.md` V7。禁止 push。禁止 `task.py create`。

写代码前读 `.trellis/spec/api/backend/directory-structure.md`、`.trellis/spec/admin/frontend/directory-structure.md`、`.trellis/spec/guides/testing.md`。测例落 `tests/<能力>/`，文件头简体中文，登记 index。

## Answer

在线编写最小闭环已落地。

- `POST …/documents/write`：`doc.editor` WhenEnforced；title+markdown trim 非空；`sourceType=write`；`text/markdown` 落对象。
- 策略 / 敏感 ACL / ingest 配额在 put/insert **之前**；失败不留行、不留对象。
- 与 complete 同闸进 `pending`，**不**入队 scan。
- admin 文档页有 `doc.editor` 才显示编写区；新下拉 `ClosedSelect`；无新菜单。
- JSON 体积对 write 走有界上限（不是无限 except）。

未做：BlockNote、editor-draft、web 编辑器、跳过审批。未 `task.py create`。未 push。

证据：`packages/contracts/src/ingest/document.contract.ts` · `apps/api/src/routes/documents/index.ts` · `apps/api/src/services/ingest-complete-pending.ts` · `apps/admin/src/app/(ops)/documents/write.services.ts` · `apps/api/tests/ingest/write-document-http.test.ts` · `apps/admin/tests/ops/document-write.test.ts`。

## Comments

- 2026-09-12 认领并执行。权威切边见 [裁定暂停后继续走哪条](./61-after-pause-continue-order.md)。
- 审查指出先 put 再过闸会留孤儿行；已改为闸前评估。write JSON 不再无限 except。
