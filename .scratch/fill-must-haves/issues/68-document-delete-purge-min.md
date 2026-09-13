# 删除与 purge 最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 67

## Question

补 P2 文档删除真空：无 DELETE HTTP，PATCH archived 不入队 purge，三存适配器无按文档清。这是本批唯一一张执行工单。

权威：[裁定替代联动后下一步](./67-after-supersede-order.md)。替代联动最小闭环已齐。仓库默认强制仍关。角色 principal 仍留雾。人签仍图外。

现状（源码）：

- 无 `DELETE /api/v1/documents/:docId`
- `PATCH …/lifecycle` 可写 `archived`，不入队
- `INGEST_STAGES` 无 `purge`；`ingest.maintenance` 逻辑未接线
- `mockEsStore` 无按文档 drop；Mongo 无按文档删；对象删只在 scan infected
- admin 有归档按钮，无删除

口径：

- `DELETE /documents/:docId`；无 body；码 `doc.lifecycle`（WhenEnforced）
- 缺文档 404
- 事务外顺序：先 PG `lifecycle=archived`，再入队 `sr-ingest` `stage=purge`（ADR-060 逻辑 stage；物理队列仍 `sr-ingest`）
- 已 archived 仍 200 并入队（worker 幂等）
- 在途入库不 409（同 doc 锁）
- 响应 `{ docId, lifecycle: 'archived', purgeEnqueued: true }`
- PATCH lifecycle=archived **仍不**入队 purge
- worker `purge`：删对象（有 key）；`mockEsStore.dropDoc`；Mongo URL 空则跳过，有值则删该 doc 的 document_bodies / chunk_bodies；回写 `objectKey=null`、`embedReady=0`、`esReady=0`；lifecycle 保持 archived
- 列表/详情仍回该行（已归档，不硬删 PG 行）
- admin 行展开：有 `doc.lifecycle` 才出「删除」；走 DELETE 不走 PATCH lifecycle
- `isDefaultRetrievable` **不**改（P0 R7 仍只双闸）
- 测例禁止依赖墙钟、禁止真 ES/Mongo 集群

### 做

- contracts：`DeleteDocumentResponseSchema`；`INGEST_STAGES` 加 `purge`
- api：`evaluateDocumentDelete` 纯函数；repo 写 archived；DELETE 路由入队 purge
- worker：`mockEsStore.dropDoc`；Mongo 按文档删（空 URL no-op）；pipeline `case 'purge'`
- admin：文档页删除按钮
- 测例：
  - contracts：响应含 archived + purgeEnqueued；stage 接受 purge、拒未知
  - api 纯函数：缺文档 404；存在即 ok
  - api HTTP：200 archived 且入队 purge；缺文档 404；PATCH archived 不入队
  - 检索：archived 后 `filterDocsForRetrieve` 不含该文（R7 主锚仍双闸文件）
  - worker：purge 调对象删 + dropDoc；空 Mongo URL 不连；二次 purge 不抛
  - admin：有码可见删除；点击走 DELETE 而非 PATCH lifecycle；无码不露出

### 不做

- PG 文档行硬删 / chunk / embedding / manifest 清扫
- HTTP ES `_delete_by_query`（B8）
- 新权限码 / operator 删自己上传
- 转换写入 `audit_logs` 全表（worker 既有 job-ledger 即可）
- BlockNote / editor-draft
- 默认开 `DEPT_ACL_ENFORCE` / 角色 principal / 默认开 OCR / 真引擎
- 改 `prds/00–11`

收工：`.trellis/spec/` api directory-structure + worker directory-structure / ingest-capability-matrix + admin directory-structure；`docs/module-status/` api · admin · contracts · worker。禁止 push。禁止 `task.py create`。

写代码前读 `.trellis/spec/api/backend/directory-structure.md`、`.trellis/spec/worker/backend/directory-structure.md`、`.trellis/spec/admin/frontend/directory-structure.md`、`.trellis/spec/guides/testing.md`。测例落 `tests/<能力>/`，文件头简体中文，登记 index。

## Answer

删除与 purge 最小闭环已落地。

- `DELETE /documents/:docId`：`doc.lifecycle` WhenEnforced；无 body。先 PG `archived`，再入队 `stage=purge`。
- 缺文档 404。已 archived 仍 200 并入队。PATCH lifecycle=archived 不入队。
- worker `purge` 不要求已审批；清对象、`mockEsStore.dropDoc`、Mongo URL 空跳过；回写 `objectKey=null`、双就绪位清零。
- admin 行展开「删除」走 DELETE，不走 PATCH lifecycle。
- `isDefaultRetrievable` 未改。删除后 `filterDocsForRetrieve` 不含该文。
- 未做 PG 硬删 / chunk 清扫 / HTTP ES `_delete_by_query` / BlockNote。

证据：`apps/api/src/services/document-delete.ts` · `apps/api/src/routes/documents/index.ts` · `apps/worker/src/ingest/purge.ts` · `apps/admin/src/app/(ops)/documents/_components/documents-workspace.tsx` · `apps/api/tests/ingest/document-delete.test.ts` · `apps/worker/tests/ingest/purge.test.ts` · `apps/admin/tests/ops/documents-workspace.test.tsx`。

未 `task.py create`。未 push。

## Comments

- 2026-09-14 认领并在主分支执行。权威切边见 [裁定替代联动后下一步](./67-after-supersede-order.md)。
