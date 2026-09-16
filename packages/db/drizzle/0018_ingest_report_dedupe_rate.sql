-- 入库报告补 PRD 04 §5.2 的 dedupe_cross_doc_rate（跨文档去重率）。
-- 不设默认：历史行为 NULL（该列之前未记录）；分母为 0 的新行同样写 NULL（不得假装零重复）。
ALTER TABLE "ingest_reports" ADD COLUMN IF NOT EXISTS "dedupe_cross_doc_rate" real;
