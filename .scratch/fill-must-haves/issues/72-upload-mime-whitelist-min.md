# 上传 MIME 白名单最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 71

## Question

补 P2 入库媒体闸真空：complete 只有体积闸，未知 MIME / `octet-stream` 可登记进审批；checksum 列不写。这是本批唯一一张执行工单。

权威：[裁定文档类型成员面后下一步](./71-after-doc-types-order.md)。文档类型成员面最小闭环已齐。仓库默认强制仍关。角色 principal 仍留雾。人签仍图外。

现状（源码）：

- `finalizePendingIngest` / `evaluateWriteIngestGates` 只做体积；无 MIME/扩展名闸
- `docFamilyFromContentType` 把未知类型映射成 `txt`
- `headObject` 只回 `byteSize`；`documents.checksum_sha256` 不写
- admin `file.type || 'text/plain'` 把空类型改写成白名单内类型
- `BizCode.UNSUPPORTED_MEDIA_TYPE` 已有，`fail()` 联合类型无 415

口径：

- 允许：`text/plain`、`text/markdown`、`text/x-markdown`、`application/pdf`、docx 族（`application/vnd.openxmlformats-officedocument.wordprocessingml.document`）、`application/msword`
- 扩展名允许：`txt` / `md` / `markdown` / `pdf` / `docx` / `doc`
- 未知、空、`application/octet-stream`、可执行、扩展名不在名单 → **415** `UNSUPPORTED_MEDIA_TYPE`
- 权威闸在 **complete**（登记的 `contentType` + title 扩展名）；`upload-url` 与 `PUT /internal/objects` 为纵深，非法不得建档 / 不得落对象
- write 路径 `text/markdown` 走同一闸（应通过）
- checksum：complete 读对象字节算 sha256 写入 `checksum_sha256`；body 可选 `checksumSha256`，不一致 → 400 `VALIDATION_ERROR`
- 体积闸仍 413；不改 50 MiB 默认 / 200 MiB 天花板
- `isDefaultRetrievable` **不**改
- 测例禁止依赖墙钟、禁止真集群

### 做

- contracts：入库媒体白名单 SSOT；`CompleteUploadBodySchema` 可选 `checksumSha256`
- api：`gates/upload-media.ts`；complete / upload-url / PUT / write 共用；`fail()` 接受 415；complete 落 checksum
- admin：解析真实 MIME/扩展名，未知不得改写成 `text/plain`；PUT 回的 checksum 传给 complete
- 测例：
  - contracts：允许 pdf/md/txt/docx；拒 octet-stream / exe 扩展名
  - api 纯函数 + HTTP：upload-url 非法 415 且不建档；complete 合法 text/plain 200；octet-stream 415；declared checksum 不一致 400
  - 体积：合法 MIME 超限仍 413（gates-live 超限用例改用 text/plain）
  - admin：空 type + `.exe` 不调 upload-url；合法 txt 仍走 upload-url → PUT → complete 且带 checksum

### 不做

- 类型分区增删改/排序/启用 CRUD
- 上传表单标部门 / 类型
- MD/TXT 更严体积档
- 魔数 / 文件头嗅探
- QUAL-2 真杀毒 / 真 OCR
- ES `doc_type` terms / dense 查询期 WHERE
- BlockNote / editor-draft
- 默认开 `DEPT_ACL_ENFORCE` / 角色 principal / 默认开 OCR
- 改 `prds/00–11`

收工：`.trellis/spec/` api directory-structure + error-handling + contracts directory-structure + admin directory-structure；`docs/module-status/` api · admin · contracts。禁止 push。禁止 `task.py create`。

写代码前读 `.trellis/spec/api/backend/directory-structure.md`、`.trellis/spec/api/backend/error-handling.md`、`.trellis/spec/contracts/library/directory-structure.md`、`.trellis/spec/admin/frontend/directory-structure.md`、`.trellis/spec/guides/testing.md`。测例落 `tests/<能力>/`，文件头简体中文，登记 index。

## Answer

上传 MIME 白名单最小闭环已落地。

- 允许 pdf / docx 族 / markdown / plain text；未知、`octet-stream`、可执行扩展名 → 415 `UNSUPPORTED_MEDIA_TYPE`。
- 权威闸在 complete（登记 MIME + title 扩展名）；upload-url 与 PUT 为纵深；write `text/markdown` 同闸。
- complete 读对象字节算 sha256 写入 `checksum_sha256`；body 带 `checksumSha256` 且不一致 → 400。
- admin 不再把空 `file.type` 改写成 `text/plain`；PUT 回的 checksum 传给 complete。
- 体积闸仍 413。`isDefaultRetrievable` 未改。
- 未做类型分区 CRUD / 上传表单标部门 / 魔数嗅探 / MD/TXT 更严体积 / BlockNote。

证据：`packages/contracts/src/ingest/upload-media.ts` · `apps/api/src/gates/upload-media.ts` · `apps/api/src/services/ingest-complete-pending.ts` · `apps/admin/src/app/(ops)/documents/upload.services.ts` · `apps/api/tests/ingest/upload-media.test.ts` · `apps/api/tests/ingest/complete-media.test.ts` · `apps/admin/tests/ops/document-upload.test.ts`。

未 `task.py create`。未 push。

## Comments

- 2026-09-14 认领并在主分支执行。权威切边见 [裁定文档类型成员面后下一步](./71-after-doc-types-order.md)。

