# 替代联动最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 65

## Question

补 P2 文档版本替代真空：列已有，PATCH lifecycle 可写成 superseded 但不写后继，无 POST supersede。这是本批唯一一张执行工单。

权威：[裁定生效区间后下一步](./65-after-effective-window-order.md)。生效区间最小闭环已齐。仓库默认强制仍关。角色 principal 仍留雾。人签仍图外。

现状（源码）：

- `documents.supersedes_doc_id` / `superseded_by_doc_id` 为 uuid 列，仓内无读写引用
- `PATCH /documents/:docId/lifecycle` 可写 `superseded`，不写两列
- admin「废止 superseded」只 PATCH lifecycle
- 默认检索已滤 `lifecycle=superseded`（R7）；无「发布新版 → 旧版 superseded」写路径

口径：

- `POST /documents/:docId/supersede`；`:docId` = 被替代旧文；body `{ successorDocId }`；码 `doc.lifecycle`（WhenEnforced）
- 同 tenant + 同 kb；不得自指
- 旧文须 `draft|active` 且 `supersededByDocId` 空，否则 409
- 后继须 `status=ready` 且 `draft|active`，不得已是 `superseded|archived`，否则 409
- 后继已有其它 `supersedesDocId` → 409
- 事务：旧文 `lifecycle=superseded` + `supersededByDocId=后继`；后继 `supersedesDocId=旧文` + `lifecycle=active`
- 列表/详情回读两字段（缺省 `null`）
- PATCH lifecycle=superseded **仍允许**无后继废止（不写两列）
- admin 行展开：有 `doc.lifecycle` 才出后继 `ClosedSelect`（本页已加载行，排除自己；仅 ready 且 draft|active）；未选不可提交
- `isDefaultRetrievable` **不**改（P0 R7 仍只双闸）
- 测例禁止依赖墙钟

### 做

- contracts：列表/详情两字段；`SupersedeDocumentBodySchema` / `SupersedeDocumentResponseSchema`
- api：`evaluateSupersedeLink` 纯函数；repo 事务写两行；POST 路由；mapper 回读
- admin：文档页后继关闭列表 + 替代按钮；废止按钮仍走 PATCH
- 测例：
  - contracts：合法 uuid；缺后继拒；响应含两列与两态
  - api 纯函数：自指 / 跨库 / 未 ready / 已替代 / 后继已 superseded 拒；合法通过
  - api HTTP：200 旧 superseded、后继 active、两列互指；后继未 ready 409；非法 body 400；自指 409
  - 检索：替代后 `filterDocsForRetrieve` 只留后继（R7 主锚仍双闸文件）
  - admin：有码可见后继选择；未选不可点替代；选后提交走 supersede 而非 PATCH lifecycle

### 不做

- DELETE / purge / ES·Mongo·PG 三存对齐
- 转换写入 `ingest_jobs` / `audit_logs`
- dense 查询期 WHERE / ES 新 terms
- 改 `isDefaultRetrievable`
- 禁止无后继 PATCH superseded
- BlockNote / editor-draft
- 默认开 `DEPT_ACL_ENFORCE` / 角色 principal / 默认开 OCR / 真引擎
- 改 `prds/00–11`

收工：`.trellis/spec/` api directory-structure + admin directory-structure；`docs/module-status/` api · admin · contracts。禁止 push。禁止 `task.py create`。

写代码前读 `.trellis/spec/api/backend/directory-structure.md`、`.trellis/spec/admin/frontend/directory-structure.md`、`.trellis/spec/guides/testing.md`。测例落 `tests/<能力>/`，文件头简体中文，登记 index。

## Answer

替代联动最小闭环已落地。

- `POST /documents/:docId/supersede`：`doc.lifecycle` WhenEnforced；body `{ successorDocId }`。
- 同库；自指 / 未 ready / 已替代 / 后继已 superseded|archived → 409。
- 事务：旧文 `superseded` + `supersededByDocId`；后继 `active` + `supersedesDocId`。
- 列表/详情回读两列。PATCH lifecycle=superseded 仍可无后继废止。
- admin 行展开后继 `ClosedSelect`；未选不可提交；替代不走 PATCH lifecycle。
- `isDefaultRetrievable` 未改。替代后 `filterDocsForRetrieve` 只留后继。
- 未做 DELETE / 三存对齐 / 转换账 / BlockNote。

证据：`apps/api/src/services/document-supersede.ts` · `apps/api/src/routes/documents/index.ts` · `apps/admin/src/app/(ops)/documents/_components/documents-workspace.tsx` · `apps/api/tests/ingest/document-supersede.test.ts` · `apps/admin/tests/ops/documents-workspace.test.tsx`。

未 `task.py create`。未 push。

## Comments

- 2026-09-13 认领并在主分支执行。权威切边见 [裁定生效区间后下一步](./65-after-effective-window-order.md)。

