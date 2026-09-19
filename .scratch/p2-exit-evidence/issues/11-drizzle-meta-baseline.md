# `drizzle/meta` 基线：补齐 `0001`–`0021` 快照

Type: task
Status: open
Blocked by: —

## Question

`packages/db/drizzle/meta/` 物理上只有 `_journal.json`（22 条，`idx` 0–21）与 `0000_snapshot.json`，**缺 `0001`–`0021` 共 21 份**，导致 `pnpm db:generate`（`drizzle-kit generate`）不可用，也导致两处镜像口径不一致（`.trellis/spec/db/backend/database-guidelines.md:193` 写「19 份」、`docs/module-status/db.md:52` 写「21 份」）。

补齐基线快照 `packages/db/drizzle/meta/0021_snapshot.json`，并把两处口径写成同一个数。

**硬验收指标**（唯一）：在仓内跑 `npx drizzle-kit generate --config packages/db/drizzle.config.ts` 打印 `No schema changes, nothing to migrate 😴`；**打印出任何 `CREATE TABLE` 即失败**。`drizzle-kit check` 对本案假绿，不得单独用作验收。

约束与风险（来自 `research/fog-reachability.md` 第 7 节）：

1. **必须在仓外副本里生成**，副本产出的 `0022_*.sql` 一律丢弃 —— 提交 generate 产物会让已建表的库在迁移链上 `relation "…" already exists` 中断。
2. 快照来自 schema 视图，实库来自手写 SQL，二者只在**列名级**核对过零漂移；落盘前先做一次**类型 / 默认值 / NOT NULL 的人工走查**（26 表 350 列 + 10 索引，规模可控）。
3. 只新增这一份快照：**不动**任何 `.sql`、**不动** `_journal.json`。
4. 基线名是 `0021_snapshot.json`（对应 `idx` 21），不能叫 `0022` —— 那是下一次 `generate` 要写出的名字。

## Answer

（进行中）
