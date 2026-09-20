# 01 · research：迁移 DEFAULT 与快照的全量对账

Type: research
Status: resolved
Blocked by: 无

## 问题

`packages/db/drizzle/*.sql` 里所有列级 `DEFAULT`，与 `drizzle/meta` 最高号快照记录的 `default`，是否逐列一致？不一致的**全部**列是哪些？

## 做法（实证，非肉眼）

写一次性脚本 `.scratch/migration-default-parity/sweep.mjs`，按文件名顺序解析每个 `.sql`：
- `CREATE TABLE IF NOT EXISTS "<t>"` 之后的列行里带 `DEFAULT` 的记进 `<table>.<col>`；
- `ALTER TABLE "<t>" ADD COLUMN IF NOT EXISTS "<col>" …` 的剩余片段里带 `DEFAULT` 的记进去；
- 与 `drizzle/meta/0021_snapshot.json`（最高号快照）的 `tables[*].columns[*].default` 比对，双向差集都报。

## 结果

命令：`node .scratch/migration-default-parity/sweep.mjs`

- **SQL 有 DEFAULT 而快照无**（漂移）：**2 处，全部来自同一个迁移**
  - `ingest_reports.cross_doc_dropped` ← `packages/db/drizzle/0015_ingest_report_cross_doc.sql:1`
  - `ingest_reports.conflict_pairs` ← `packages/db/drizzle/0015_ingest_report_cross_doc.sql:3`
- **快照有 default 而 SQL 无来源**：**0 处**
- 统计：SQL 标 DEFAULT 的列 = **51**；快照带 `default` 的列 = **49**（51 − 2 = 49，闭合）

## 顺带排除的同类嫌疑（ALTER 加列但**非**漂移）

| 列 | SQL | schema 侧 | 结论 |
|----|-----|-----------|------|
| `documents.visibility_level` | `0007_p3b_doc_dept_meta.sql:3` `DEFAULT 20 NOT NULL` | `packages/db/src/schema/kb/documents.ts:57` `.notNull().default(20)` | 正常 |
| `eval_runs.status` | `0010_eval_floor.sql:19` `DEFAULT 'succeeded' NOT NULL` | `packages/db/src/schema/ask/eval-runs.ts:29` `.notNull().default('succeeded')` | 正常 |

## 根因

`0015` 要给**已有数据的表**加 `NOT NULL` 列，PostgreSQL 要求给 DEFAULT 才能回填；作者给了 DEFAULT 却**没有**在 Drizzle schema 声明，于是库侧永久比声明宽松。同表在 `0011` 建表时就存在的兄弟计数列（`chunk_count` / `internal_dropped`）均**无**默认，可见 0015 是异类。

## 影响（为何要修）

schema 与快照都声明「无默认、必填」，Drizzle 生成的 INSERT 必然显式带值，故**应用路径行为不变**。风险在于绕过应用层的写入：任何漏传这两列的 INSERT 会被库静默填 `0` / `'[]'`，等于替业务断言「本轮没有跨文档去重」——正是本仓注释反复警告的反模式（`packages/db/src/schema/kb/ingest-reports.ts:28-31`：「不得写 0 假装零重复」）。撤掉默认后，漏传即 `NOT NULL` 违例，**响亮失败**。

## 未验证

Docker 守护进程未运行 → 迁移**未**在真 PG 上 apply 过；本工单只给「文件与快照的静态对账」结论。
