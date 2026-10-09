# 落：admin 待审冲突可见 + 二选一处置控件

Type: task
Status: resolved
Blocked by: 02

## Question

按工单 02 的裁定，在 admin 落「可见 + 可办」：

- **可见**：运营能在文档页（或裁定所指落点）看到该文档的 `pending_review` 待审块（来源按 02：报告 `conflictPairs` / 新端点 / 列表标志）。
- **可办**：二选一控件调**既有** `POST /documents/:docId/dedupe-conflicts/:chunkId/resolve`；`reindexRequired` 时给明确提示（**不**代跑 reindex）；无 `doc.editor` 不显示保存。
- 遵守 admin 站规：分层（services 写业务/URL，page 薄组合，UI 不直连 fetch）、下拉用 `@strict-rag/ui` 关闭列表（禁原生 `<select>`）、权限码来自 `@strict-rag/admin-catalog`。
- RTL 测例落 `apps/admin/tests/ops/<意图>.test.tsx`，文件头目标/简介简体中文，登记 `apps/admin/tests/index.md`；至少钉：有码可见/可点、无码不可点、点击发出正确 `winner`、`reindexRequired` 提示、空态。

**不做**：改 API 语义；加新权限码；视觉回归（本机无浏览器）。

## Answer

按工单 02 的裁定落地「可见 + 可办」，**只动 admin 三个文件 + 一个测例**：

### 改了什么

- `apps/admin/src/app/(ops)/documents/api.ts`：新增 `resolveDedupeConflict(docId, chunkId, body)` 指向**既有**端点（URL 只在此层；不新增权限码）。
- `apps/admin/src/app/(ops)/documents/dedupe-review.services.ts`（新）：纯函数 `pendingReviewConflicts(reports)`（只挑 `action='pending_review'` **且**带非空 `heldChunkId`，按 `heldChunkId` 去重）+ `dedupeWinnerLabel(winner)`（「保留本块」/「保留对方块」）+ `resolvePendingConflict(...)`（调端点、`reindexRequired` 给「须自行 Reindex」文案、失败文案走 `mapBizError`；400 `VALIDATION_ERROR` / 404 `NOT_FOUND` 判**终态**）。
- `apps/admin/src/app/(ops)/documents/_components/documents-workspace.tsx`：在文档行展开的**入库报告区块内**新增「待审冲突（跨文档近重复 · 人工二选一）」块 —— 逐块列 `heldChunkId ↔ otherDocId`，有 `doc.editor` 给两个按钮，处置成功或终态失败后该行显示「已处置」并撤按钮；无 `doc.editor` 显示「不可处置」。文案明写「报告不因处置而改写，本块是否仍待审以此列表为准」「保留本块后须再对本文档做 Reindex 才进检索面」。**不新增原生 `<select>`**（站规），只用 ui `Button`。

### 测了什么

- 新增 `apps/admin/tests/ops/pending-review-resolve.test.tsx`（**11 条**）：纯函数三类（筛选口径 / 跨版本去重 / 文案）+ 服务三类（`this` 回 Reindex 文案 / `other` 无需 reindex / 400 判终态而网络错不判）+ 组件五条（有码列按钮、点「保留本块」按 `heldChunkId` 发请求并停用、终态失败文案与停用、无码只读不给按钮且不调 API、只有 `skip_index` 时不出待审区）。已登记 `apps/admin/tests/index.md`。
- **反证**：临时把 `pendingReviewConflicts` 的 `action` 判据去掉 → **2 条**变红（纯函数筛选 + 组件「只剩一条待审」）；还原后绿。**首轮反证无效**（夹具的 `skip_index` 没带 `heldChunkId`，去掉判据也不变）→ 已补 `skipPairWithHeld` 夹具把「只有 `pending_review` 可处置」这一条钉住。
- **既有测例未改写**：`ops/ingest-report.test.tsx`（原「冲突 otherDocId」汇总行未动）仍绿。

### 门禁

`admin` check-types 绿 · lint 零 warning · test **39 文件 / 198 通过**；`contracts` check-types · lint 绿 · test **37 文件 / 321 通过**。

### 未做 / 边界

审计**不做**（见 02 裁定，记债）；`reportsForDoc` 的历史报告不会因处置改写，故处置后**不**重拉报告（重拉也不会变），改由本地「已处置」标记 + 端点终态码判断；视觉回归不可验（本机无浏览器）。
