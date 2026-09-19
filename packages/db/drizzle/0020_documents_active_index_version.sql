-- 文档「当前激活 version」（ADR-038 §2.2「双就绪 → ready + 原子激活 version」）。
-- 不设默认：NULL = 从未成功激活 / 旧行未回填。
-- 回填口径：今天能确知激活版的只有 status='ready' 的行（其余留 NULL，宁缺不猜）。
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "active_index_version" integer;
UPDATE "documents" SET "active_index_version" = "index_version" WHERE "status" = 'ready' AND "active_index_version" IS NULL;
