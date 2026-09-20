-- 撤掉 0015 给 ingest_reports 遗留的库侧 DEFAULT。
--
-- 0015 要往已有数据的表上加 NOT NULL 列，PostgreSQL 要求带 DEFAULT 才能回填，于是留下了
--   cross_doc_dropped  DEFAULT 0
--   conflict_pairs    DEFAULT '[]'::jsonb
-- 但 Drizzle schema（packages/db/src/schema/kb/ingest-reports.ts）与 meta 快照都声明这两列
-- **无默认**，同表在 0011 建表时的兄弟计数列（chunk_count / internal_dropped）也无默认。
-- 留着 = 库比声明宽松：任何漏传该列的写入会被静默填 0 / '[]'，等于替业务断言「本轮无跨文档
-- 去重」——正是本仓注释禁止的「写 0 假装零重复」。撤掉后漏传即 NOT NULL 违例，响亮失败。
--
-- 不动 schema、不重生成快照（快照本就声明无默认，本迁移是把库侧拉回声明）。
ALTER TABLE "ingest_reports" ALTER COLUMN "cross_doc_dropped" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "ingest_reports" ALTER COLUMN "conflict_pairs" DROP DEFAULT;
