# 历史 needs_ocr 重跑最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 58

## Question

补 P5 第二刀：历史 `needs_ocr` 运营重跑。开闸后卡住的扫描件走现有 reindex 入队 `ocr`，成功才抬新 `indexVersion` 走双就绪。这是本批唯一一张执行工单。

权威：[裁定 OCR 开闸后下一步](./58-after-ocr-gate-order.md)。在线编写仍 P2.x。仓库默认强制仍关。角色 principal 仍留雾。人签仍图外。

现状（源码）：

- `POST …/documents/:docId/reindex` 一律 `stage: 'chunk'`
- chunk 已拒 `needs_ocr` / `needs_review`，历史扫描件无入口
- ocr 逻辑 stage 与注入抽取器已齐；生产默认无引擎
- 短 utf8 页眉是 `needs_ocr` + `extractMethod=text`，Q3 不得用 OCR 洗 ready

口径：

- 现有 reindex，**无**新 HTTP、**无**新物理队列
- `needs_review` → 入队 `ocr`
- `needs_ocr` 且 `extractMethod !== 'text'`（含 `null` 历史行）→ 入队 `ocr`
- 其余（含 ready、短 utf8）仍入队 `chunk`
- 响应 `stage` 为实际入队值（`chunk` | `ocr`）
- 失败（关闸 / 无引擎 / 低置信 / 过短）**不**抬 `indexVersion`
- 成功 → 今日 `persistExtractedText` → chunk 抬 version → embed → es_index 双就绪
- worker：utf8 文本层对象入队 ocr 时拒抽，保持 `NO_TEXT_LAYER`（防短页眉洗 ready）
- API **不**复制 `INGEST_OCR_ENABLED`；关闸由 worker 打回
- **不** worker 启动扫描全库自动重跑

### 做

- contracts：`ReindexDocumentResponseSchema.stage` 接受 `chunk` | `ocr`
- api：`reindexEnqueueStage`；reindex 按上表入队
- worker：ocr 拒 utf8 文本层
- 测例：
  - api HTTP：`needs_ocr`（extractMethod none）→ `stage=ocr`；`needs_review` → `ocr`；ready → `chunk`；短 utf8 `extractMethod=text` → `chunk`
  - worker：历史 `needs_ocr` + 开闸 + 注入 → ocr→chunk→embed→es_index，`indexVersion` 新且 `ready`；无注入失败不抬 version；utf8 文本层 ocr 拒抽
- 覆盖 Q7 延后 → 部分测

### 不做

- 真 Tesseract / Cloud OCR / 默认 `INGEST_OCR_ENABLED=true`
- worker 启动或定时全库自动重跑
- 短 utf8 页眉用 OCR 洗成 ready
- 新 admin 按钮 / 新菜单（现有 Reindex 即可）
- 仓库默认开 `DEPT_ACL_ENFORCE` / 角色 principal
- 在线编写 / P3a / 默认开 rewrite / LangGraph / E2E / B8
- 人签 / `businessPass`

收工：`.trellis/spec/` api chunk-strategies + worker ingest 矩阵；`docs/module-status/api.md` · worker · contracts；`docs/testing/coverage/01-ingest.md` Q7。禁止 push。禁止 `task.py create`。

写代码前读 `.trellis/spec/api/backend/chunk-strategies.md`、`.trellis/spec/worker/backend/ingest-capability-matrix.md`、`.trellis/spec/guides/testing.md`。测例落 `tests/<能力>/`，文件头简体中文，登记 index。

## Answer

历史 needs_ocr 重跑最小闭环已落地。

- 现有 reindex：`needs_review` 或 `needs_ocr` 且 `extractMethod !== 'text'` → 入队 `ocr`；ready / 短 utf8 仍 `chunk`。
- 响应 `stage` 为实际入队值。
- worker：utf8 文本层拒抽并清空 parsedText；关闸跑 ocr 同样清空正文、不抬 version。
- 注入成功：ocr→chunk→embed→es_index 双就绪并抬 `indexVersion`。
- 过短 PDF 保留 `extractMethod=pdf_text`，不再误标 `text` 导致永远进不了 ocr。

未做：真引擎、Cloud、默认开、启动自动全库。未 `task.py create`。未 push。

证据：`apps/api/src/services/ingest-reindex-stage.ts` · `apps/api/src/routes/documents/index.ts` · `apps/worker/src/ingest/pipeline.ts` · `apps/api/tests/ingest/ocr-rerun-http.test.ts` · `apps/worker/tests/ingest/ocr-rerun.test.ts`。

## Comments

- 2026-09-10 认领并执行。权威切边见 [裁定 OCR 开闸后下一步](./58-after-ocr-gate-order.md)。
- 审查指出拒抽/关闸仍留 parsedText；已清空。过短 PDF 不再写成 `text`。
