# OCR 开闸最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 56

## Question

补 P5 第一刀：OCR 开闸。无文本层时，开关打开才进入独立 `ocr` 逻辑 stage；默认关则行为与今日完全相同。这是本批唯一一张执行工单。

权威：[裁定双轨看板后下一步](./56-after-dual-dashboard-order.md)。在线编写仍 P2.x。仓库默认强制仍关。角色 principal 仍留雾。人签仍图外。

现状（源码）：

- parse 无文本层 / 过短 → `needs_ocr` + `NO_TEXT_LAYER`，不续跑
- `INGEST_STAGES` 无 `ocr`；无 `INGEST_OCR_ENABLED`
- `needs_review` 状态枚举已有，检索闸只放行 `ready∧active`

口径：

- `INGEST_OCR_ENABLED` **默认 false**。关：无文本层仍 `needs_ocr` + `NO_TEXT_LAYER`，**不**入队 ocr（Q1/Q3/Q10 不回退）
- 开：parse 在「完全无文本层」（PDF 抽空 / 非 txt·md·pdf）时 **enqueue `ocr`**（parse 本身不算业务失败）。过短 utf8 仍走今日 `NO_TEXT_LAYER`，本刀不拿 OCR 洗短页眉
- 逻辑 stage `ocr` 进 `INGEST_STAGES`（`scan,parse,ocr,chunk,embed,es_index`）；物理队列仍 `sr-ingest`
- 抽取器 **可注入**；生产默认无引擎。无注入 → `OCR_UNAVAILABLE`，文档留 `needs_ocr`，**禁止**假正文
- `{ text, confidence }`；`confidence < INGEST_OCR_MIN_CONFIDENCE`（默认 0.7）→ `needs_review` + `OCR_LOW_CONFIDENCE`，不得 chunk/ready
- 成功且字数达标 → `extractMethod=ocr`，写 body，enqueue chunk（与 parse 成功同路径）
- `OCR_*` 与 `NO_TEXT_LAYER` / `MALWARE` 分码；均不可重试
- staging/production 开闸且 `INGEST_OCR_ADR_REF` 空 → **告警可启动**，不 fail-closed
- **不**默认开、**不**加 Tesseract/Cloud 依赖、**不**敏感 KB Cloud OCR、**不**自动重跑历史 `needs_ocr`

### 做

- contracts：`INGEST_STAGES` 含 `ocr`；测例改全阶段列表
- worker env：`INGEST_OCR_ENABLED` / `INGEST_OCR_ADR_REF` / `INGEST_OCR_MIN_CONFIDENCE`
- 纯函数 `ocrStartupWarning`
- pipeline：`runIngestStage(data, deps?)`；`deps.ocrExtract` 可选
- 测例（`tests/ingest/ocr-gate.test.ts`）：
  - 关：PDF 无层 → `NO_TEXT_LAYER`，next 不是 ocr
  - 开 + 注入高置信：parse→ocr→chunk，`extractMethod=ocr`
  - 开 + 低置信：`needs_review` + `OCR_LOW_CONFIDENCE`，无成功 manifest
  - 开 + 无注入：`OCR_UNAVAILABLE`，仍 `needs_ocr`
  - `OCR_LOW_CONFIDENCE` Unrecoverable；与 `MALWARE` 分码
  - staging 开且无 ADR_REF → warning 字符串非空；关 → null
- 覆盖 Q5 缺口回写；Q8/Q9 延后 → 部分测（真引擎 / 重跑 / Cloud 仍缺口）

### 不做

- 真 Tesseract / Cloud OCR / 默认 `INGEST_OCR_ENABLED=true`
- 敏感 KB Cloud 明文 OCR
- 历史 `needs_ocr` 自动重跑全链路（Q7）
- 过短 utf8 页眉用 OCR 洗成 ready（Q3 保持）
- 仓库默认开 `DEPT_ACL_ENFORCE` / 角色 principal
- 在线编写 / P3a / 默认开 rewrite / LangGraph / E2E / B8
- 人签 / `businessPass`

收工：`.trellis/spec/` worker ingest 矩阵；`docs/module-status/worker.md` · contracts；`docs/testing/coverage/01-ingest.md` Q5/Q8/Q9。禁止 push。禁止 `task.py create`。

写代码前读 `.trellis/spec/worker/backend/ingest-capability-matrix.md`、`.trellis/spec/guides/testing.md`。测例落 `tests/<能力>/`，文件头简体中文，登记 index。

## Answer

OCR 开闸最小闭环已落地。

- `INGEST_OCR_ENABLED` 默认 false。关：无文本层仍 `needs_ocr` + `NO_TEXT_LAYER`，不入队 ocr。
- `INGEST_STAGES` 含逻辑 stage `ocr`。开闸且完全无文本层时 parse 交 ocr。过短 utf8 不交。
- 可注入 `ocrExtract`。无注入 / 抛错 → `OCR_UNAVAILABLE`。低置信 → `needs_review`，**不**写 parsedText（避免 reindex 洗成 ready）。过短 OCR → `OCR_TOO_SHORT`。成功才 `extractMethod=ocr` 交 chunk。
- staging/prod 开闸无 ADR_REF 告警可启动。无真引擎依赖。

未做：Tesseract/Cloud、历史 needs_ocr 重跑、默认开。未 `task.py create`。未 push。

证据：`packages/contracts/src/async/ingest-job.ts` · `apps/worker/src/ingest/pipeline.ts` · `apps/worker/src/ocr-policy.ts` · `apps/worker/tests/ingest/ocr-gate.test.ts`。

## Comments

- 2026-09-09 认领并执行。权威切边见 [裁定双轨看板后下一步](./56-after-dual-dashboard-order.md)。
- 审查指出低置信仍写 parsedText，reindex 可绕闸；已清空失败正文，chunk 拒 `needs_ocr` / `needs_review`。
