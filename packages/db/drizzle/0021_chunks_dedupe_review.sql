-- 跨 doc 去重的 chunk 级落点（入 PRD 04 §5.1 / 数据 PRD §3.2 逐字字段名）。
-- duplicate_of = 命中的权威 chunk；dedupe_status 仅取值 'pending_review'（处理完回 NULL）。
-- 不设默认：既有行保持 NULL（= 不适用，未记录），不得用 '' / 0 冒充。
ALTER TABLE "chunks" ADD COLUMN IF NOT EXISTS "duplicate_of" uuid;
ALTER TABLE "chunks" ADD COLUMN IF NOT EXISTS "dedupe_status" text;
