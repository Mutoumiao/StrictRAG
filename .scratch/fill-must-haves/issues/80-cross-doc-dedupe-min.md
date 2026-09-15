# 同 KB 跨文档去重最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 79

## Question

补 P1–P2 同 KB 跨文档去重真空：管道只做文档内字符串 Set，报告不写真冲突对。这是本批唯一一张执行工单。

权威：[裁定 KB 消费绑定后下一步](./79-after-kb-consume-bindings-order.md)。KB 消费绑定最小闭环已齐。仓库默认强制仍关。角色 principal 仍留雾。人签仍图外。

现状（源码）：

- `apps/worker/src/ingest/pipeline.ts` 仅文档内 `body.toLowerCase()` Set
- `ingest_reports` / `IngestReportItemSchema` 无跨 doc 列；测例钉死拒绝 `crossDocDropped`
- `chunks` 无 `searchable` / `duplicate_of`
- 工单 22 明确不做跨 doc MinHash / `pending_review`

口径：

- 同 KB、他文档、当前 `indexVersion`、`status=ready` 且 lifecycle ∈ {draft, active}
- **不比** archived / superseded（替代文不得被旧文 skip 掉）
- 跨 KB 不比
- 近重复：去空白后字 3-gram Jaccard ≥ **0.9**（无新依赖；不是生产 MinHash LSH）
- 命中默认 **`skip_index`**：不进 manifest、不 embed、不 ES
- 报告写 `crossDocDropped` + `conflictPairs`（`otherDocId` / `otherChunkId` / `action=skip_index`）
- searchable 被清空（文档内 + 跨 doc）仍 `EMPTY_CHUNKS`、不得 ready
- 禁止把未实现字段（Hit@k / pending_review / L1）填 0 装齐
- `isDefaultRetrievable` **不**改
- 测例禁止依赖墙钟、禁止真集群

### 做

- contracts：报告项增加跨 doc 计数与冲突对；仍拒 `hitAtK`
- db：`ingest_reports` 加列；迁移 `0015`
- worker：切块后比他文档近重复；skip 不进 manifest；报告落事实
- api：GET 映射新列
- admin：行展开展示跨 doc 计数与冲突对
- 测例：
  - 纯函数：精确重复 / 近重复 skip；远文不 skip
  - worker：同 KB 后文块 skip 且报告可读冲突对；跨 KB 不比；archived 不挡；全 skip 不得 ready
  - contracts / api / admin：新列是事实，仍拒 Hit@k

### 不做

- `pending_review` 人工二选一 UI / 队列
- `downrank`
- 跨 KB
- 生产 MinHash LSH 索引 / 新 npm 依赖
- `chunks.searchable` / `duplicate_of` 列（skip = 不进 manifest；冲突对即 duplicate 账）
- L0 vs L1 Hit@k / 真 L1 contextualize
- paramSchema 表单
- BlockNote / editor-draft
- 默认开 `DEPT_ACL_ENFORCE` / 角色 principal / 默认开 OCR / 真引擎
- 改 `prds/00–11`

收工：`.trellis/spec/` worker directory-structure + api directory-structure（ingest-report）+ contracts/db 若有目录句；`docs/module-status/` worker · api · admin · contracts · db。禁止 push。禁止 `task.py create`。

写代码前读 `.trellis/spec/worker/backend/directory-structure.md`、`.trellis/spec/guides/testing.md`。测例落 `tests/<能力>/`，文件头简体中文，登记 index。

## Answer

同 KB 跨文档去重最小闭环已落地。

- 切块后比同库 ready 且 draft/active 的他文档当前 version；字 3-gram Jaccard ≥ 0.9 即 `skip_index`（不进 manifest / 不 embed / 不 ES）。
- 入库报告写 `crossDocDropped` + `conflictPairs`；GET 与 admin 行展开展示。
- 跨 KB 不比；archived / superseded 不挡后文。全 skip 仍 `EMPTY_CHUNKS`、不得 ready。
- 无 pending_review / 无 downrank / 无生产 LSH / 无 `chunks.searchable` 列。

证据：`apps/worker/src/ingest/cross-doc-dedupe.ts` · `pipeline.ts` · `packages/db/src/schema/kb/ingest-reports.ts` · `packages/contracts/src/ingest/ingest-report.contract.ts` · `apps/api/src/services/ingest-reports.ts` · `apps/admin/src/app/(ops)/documents/_components/documents-workspace.tsx` · `apps/worker/tests/ingest/cross-doc-dedupe.test.ts` · `cross-doc-skip-index.test.ts`。

未 `task.py create`。未 push。

## Comments

- 2026-09-15 认领并在主分支执行。权威切边见 [裁定 KB 消费绑定后下一步](./79-after-kb-consume-bindings-order.md)。
