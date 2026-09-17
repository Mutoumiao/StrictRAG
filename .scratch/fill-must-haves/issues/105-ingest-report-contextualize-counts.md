# 入库报告补 `contextualize_l1_ok` / `contextualize_l0_fallback`

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 103

## 目标

`prds/04-pipelines/01-offline-ingest.md` §5.2 标题即**「指标（入库报告必出）」**，正文逐字四行：

```
- `dedupe_doc_internal_dropped`  
- `dedupe_cross_doc_dropped`  
- `dedupe_cross_doc_rate`  
- `contextualize_l1_ok` / `contextualize_l0_fallback`
```

前三项已由工单 94/95 落库（`dedupeCrossDocRate` 与计数同源派生）；**后两项没落** —— 工单 101 的真 L1 contextualize 只把它们写成 Pino 日志字段，报告里只有三态 `contextSource`。§9.1 另写「L1 触顶/失败 → L0 回退；块仍可索引；**指标 `contextualize_l0_fallback`**」。

本工单：把这两个计数按 doc + indexVersion 落进入库报告，并如实回读。

## 实现

- `packages/db/src/schema/kb/ingest-reports.ts`：加 `contextualizeL1Ok` / `contextualizeL0Fallback`（integer，**无默认**）。
- migration `0019_ingest_report_contextualize_counts.sql`（手写 SQL + 手写 `_journal.json` 条目 idx 19；`db:generate` 仍不可用）。
- `apps/worker/src/ingest/ingest-report.ts`：snapshot 加两字段；insert/patch 带上；`persistIngestReport` 合并沿用既有一致性口径（后阶段不复写前阶段已记录值）。
- `apps/worker/src/ingest/pipeline.ts`：chunk 段两处 `persistIngestReport` 传 `l1Ok` / `l1Fallback`。
- `packages/contracts/src/ingest/ingest-report.contract.ts`：DTO 加两字段（`int ≥ 0` 或 **null = 未记录**，与 `dedupeCrossDocRate` 同款语义）。
- `apps/api/src/services/ingest-reports.ts`：select 列 + 映射（null 原样回读，不填 0）。
- admin 入库报告行：把 `l1_ok` / `l0_fallback` 与三态 `contextSource` 一起显示；旧行未记录就明说未记录。

## 测例

- worker `tests/ingest/ingest-report.test.ts`：计数落库；后阶段（es_index）不覆盖 chunk 段已记录值；旧行为 null。
- contracts `tests/ingest/ingest-report-contract.test.ts`：两字段可空整数；负数/非整数拒。
- api `tests/ingest/ingest-report-map.test.ts`：null 原样回读（不填 0）。
- admin `tests/ops/ingest-report.test.tsx`：渲染含两计数；未记录（null）文案。
- 各包 `tests/index.md` 行更新。

## 不做

不改 `contextSource` 三态语义（`l1_llm` / `l0_fallback` / `l0`）· 不新增其它指标口径 · 不碰 metrics 导出 / Prometheus 端口 · 不做 per-chunk checkpoint · 不做「高度重复」阈值提示（数据 PRD 无阈值）。

## Answer

**已齐**。PRD 04 §5.2「指标（入库报告必出）」的四行现在全部落进可查询报告。

- **口径钉在本仓**（PRD 只给指标名）：两计数与 `contextSource` **同口径** —— 文档请求了 L1 而 worker `INGEST_CONTEXTUALIZE_MODE≠http`（未实际调用）时整轮按回退计（`l1_ok=0` / `l0_fallback=chunkCount`），**不得**出现「情境 `l0_fallback` · L0 回退 0」这种自相矛盾的行；`contextMode=l0_template` 时两计数为 0（有意义的零）；已在日志与报告里统一用这两个值（日志字段同名同值，另有 `contextSource` 可判读）。
- **代码**：`packages/db` schema 加 `contextualizeL1Ok` / `contextualizeL0Fallback`（integer，**无默认**）+ migration `0019_ingest_report_contextualize_counts.sql` + 手写 `_journal.json` 条目 idx 19；worker `ingest-report.ts` 落库并合并且后阶段（embed / es_index）**不得**复写已记录值；`pipeline.ts` chunk 段两处传值；`packages/contracts` DTO 加两字段（`≥0 整数 | null`，null = 迁移前旧行未记录）；api `toIngestReportItem` 原样回读；admin 入库报告行加「L1 成功 N · L0 回退 M」，两计数任一未记录 → 「L1/L0 计数未记录」（**不补 0**）。
- **测例**：worker `tests/ingest/ingest-report.test.ts`（落库 + 后阶段不复写 + null 语义）· `tests/ingest/context-mode-obey.test.ts`（L1 成功 → 1/0；429 回退 → 0/1；`l0_template` → 0/0；默认 l1_llm 未调用 → 0/1）· contracts `tests/ingest/ingest-report-contract.test.ts`（可空 + 拒负数/非整数/缺字段）· api `tests/ingest/ingest-report-map.test.ts`（null 原样回读）· admin `tests/ops/ingest-report.test.tsx`（渲染 + 未记录文案）。
- **门禁**：`pnpm test` **11/11**（api 137 / 878+3 skipped · worker 34 files 全绿 · admin 34 files 全绿 · contracts 26 files 全绿）· `pnpm check-types` **8/8** · `pnpm lint` **8/8 零 warning**。
- **未做**：不改 `contextSource` 三态语义；不新增其它指标口径；不碰 metrics 导出 / Prometheus 端口（worker 明令禁对外 HTTP）；不做 per-chunk checkpoint；不做「高度重复」阈值提示（数据 PRD 无阈值）。
