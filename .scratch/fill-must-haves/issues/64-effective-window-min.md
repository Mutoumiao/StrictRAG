# 生效区间最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 63

## Question

补 P2 检索谓词真空：文档生效区间。列已有，默认检索未滤，PATCH 不能写。这是本批唯一一张执行工单。

权威：[裁定在线编写后下一步](./63-after-online-write-order.md)。在线编写最小闭环已齐。仓库默认强制仍关。角色 principal 仍留雾。人签仍图外。

现状（源码）：

- `documents.effective_from` / `effective_to` 为 text 列，仓内无读写引用
- `isDefaultRetrievable` 只 `ready∧active`
- `filterDocsForRetrieve` 不看窗口
- `PatchDocumentMetaBodySchema` 无两字段
- admin 文档页无填口

口径：

- 默认检索：`ready∧active` 之后再叠窗口。`now` = `formatLocalDateTime()`（`yyyy-MM-dd HH:mm:ss` 字符串比较）
- 缺界 = 不限：`from` 空或 `from <= now`；`to` 空或 `to > now`
- `isDefaultRetrievable` **不**改（P0 R7 仍只双闸）
- `PATCH /documents/:docId`：`effectiveFrom` / `effectiveTo` omit 不改、`null` 清除、合法串写入；合并后 `from > to` → 400
- 列表/详情回读两字段（缺省 `null`）
- admin 行展开：有 `doc.editor` 才可改；空输入 = 清除；Input 不是新下拉
- 测例注入 `now`，禁止依赖墙钟

### 做

- db：`isWithinEffectiveWindow` / `isEffectiveWindowOrdered` 纯函数
- contracts：列表/详情/PATCH 两字段；格式复用本地时间串
- api：`filterDocsForRetrieve` 叠窗口；PATCH 写库前合并校验；mapper 回读
- admin：文档页两个时间框，保存带上
- 测例：
  - db：空窗口放行；未到 from 拒；已到 to 拒（`to == now` 也拒）；窗内放行
  - api 语料：同上，钉 `filterDocsForRetrieve`（R7 主锚仍双闸文件）
  - contracts：合法串；非法格式拒；只 PATCH 窗口也算非空 body
  - api HTTP：写入回读；`from > to` 400；非法串 400；不改 lifecycle
  - admin：有码可见两框；保存 payload 含两字段（空 → null）

### 不做

- DELETE / 替代联动 / `supersedesDocId`
- dense 查询期 pgvector WHERE
- ES 生效区间 terms（窗口走 PG 语料闸，与 lifecycle 同层）
- BlockNote / editor-draft
- 默认开 `DEPT_ACL_ENFORCE` / 角色 principal / 默认开 OCR / 真引擎
- 在线抽样 / CoVe / 容量 L
- 改 `prds/00–11`

收工：`.trellis/spec/` api ask-pipeline + directory-structure；`docs/module-status/` api · admin · contracts · db。禁止 push。禁止 `task.py create`。

写代码前读 `.trellis/spec/api/backend/directory-structure.md`、`.trellis/spec/api/backend/ask-pipeline.md`、`.trellis/spec/guides/testing.md`。测例落 `tests/<能力>/`，文件头简体中文，登记 index。

## Answer

生效区间最小闭环已落地。

- 默认检索：`filterDocsForRetrieve` 在 ready∧active 之后叠窗口。`now` = `formatLocalDateTime()`；测例注入。
- 缺界不限；`from <= now` 且（`to` 空或 `to > now`）。`to == now` 不进检索。
- `isDefaultRetrievable` 未改。
- `PATCH /documents/:docId` 可写 `effectiveFrom`/`effectiveTo`；合并后 `from > to` → 400；非法串 400。
- 列表/详情回读两字段。admin 行展开两个输入框；空=清除。
- 未做 DELETE / 替代联动 / dense WHERE / ES terms / BlockNote。

证据：`packages/db/src/query/effective-window.ts` · `apps/api/src/services/retrieve/corpus.ts` · `apps/api/src/routes/documents/index.ts` · `apps/admin/src/app/(ops)/documents/_components/documents-workspace.tsx` · `apps/api/tests/ask/effective-window-corpus.test.ts` · `apps/api/tests/ingest/document-effective-window.test.ts`。

未 `task.py create`。未 push。

## Comments

- 2026-09-12 认领并执行。权威切边见 [裁定在线编写后下一步](./63-after-online-write-order.md)。
