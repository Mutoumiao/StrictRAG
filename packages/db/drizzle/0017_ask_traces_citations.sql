-- 断线按 requestId 重拉终态前置：当轮 citations 落库（answer 文本无 [chunkId] token，无法反推）。
-- 不加默认：历史行为 NULL（该列之前未记录），新写入拒答轮为 '[]'。
ALTER TABLE "ask_traces" ADD COLUMN IF NOT EXISTS "citations" jsonb;
