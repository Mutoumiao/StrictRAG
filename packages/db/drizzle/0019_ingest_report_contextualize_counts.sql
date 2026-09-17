-- 入库报告补 PRD 04 §5.2 点名的 contextualize_l1_ok / contextualize_l0_fallback。
-- 不设默认：历史行为 NULL（该列之前未记录）；L1 未开启的本轮写 0（有意义的零）。
ALTER TABLE "ingest_reports" ADD COLUMN IF NOT EXISTS "contextualize_l1_ok" integer;
ALTER TABLE "ingest_reports" ADD COLUMN IF NOT EXISTS "contextualize_l0_fallback" integer;
