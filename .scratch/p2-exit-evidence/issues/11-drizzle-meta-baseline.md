# `drizzle/meta` 基线：补齐 `0001`–`0021` 快照

Type: task
Status: resolved
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

**已完成**：`packages/db/drizzle/meta/0021_snapshot.json` 已落盘（26 表 / 69,747 字节），`db:generate` 恢复可用。

**做法**：全部在**仓外副本**完成（`%TEMP%\drizzle-baseline` 生成、`%TEMP%\drizzle-verify-final` 验收）。副本复制 `packages/db` 的 `src/` `drizzle/` `drizzle.config.ts` `package.json` `tsconfig.json`，用 `cmd /c mklink /J` 把 `node_modules` 挂回仓库，直接调 `node <副本>\node_modules\drizzle-kit\bin.cjs generate`。副本里 generate 产出 `0022_romantic_viper.sql`（433 行全量 `CREATE TABLE`，**已丢弃**）+ `meta\0022_snapshot.json`；**只取后者**，落为仓库的 `0021_snapshot.json`。

**`id` / `prevId` 未做任何改写**：工具用 `randomUUID()` 生成 `id`（与已有 `0000` 的 `id` 不冲突），并把 `prevId` 自动写成 `0000_snapshot.json` 的 `id` —— 因为生成时 `0000` 正是副本 `meta/` 里排序末位的快照，链条天然指对。

**硬验收（唯一指标）**：验收副本（`_journal.json` + `0000_snapshot.json` + `0021_snapshot.json`）跑 generate → 原文 **`No schema changes, nothing to migrate 😴`**，且跑完后 `drizzle/` 与 `meta/` 文件数不变（22 个 `.sql` 不变、无新快照）。补充跑 `check` → `Everything's fine 🐶🔥`（仅作旁证，按工单不单独采信）。仓库侧 `git status --porcelain packages/db/drizzle` 输出**只有** `?? packages/db/drizzle/meta/0021_snapshot.json`。

**人工走查**：仓外脚本解析 22 个手写 `.sql`（折叠 15 条 `ADD COLUMN`）与快照逐条比对 —— 表 26=26、列 355=355、唯一约束/索引 11=11，类型 / NOT NULL / PK 全一致；另与 generate 产物做列定义文本级交叉校验。**未在仓库工作区跑过 generate**（避免把 `0022_*.sql` 写进仓库）。

**发现一处既有的 schema ↔ 迁移漂移（不在本工单范围，已上报）**：`ingest_reports.cross_doc_dropped` 与 `ingest_reports.conflict_pairs` 在 `packages/db/drizzle/0015_ingest_report_cross_doc.sql` 里带 `DEFAULT 0` / `DEFAULT '[]'::jsonb`，而 `packages/db/src/schema/kb/ingest-reports.ts:27,33` 只声明 `.notNull()`、**无 default**（快照忠实反映 schema，所以此项不影响 generate 可用性）。按仓库口径「源码为真」，schema 是源；这条属**两个源文件之间**的漂移，已记入本图雾中，未在本工单动手。

**临时目录**：`%TEMP%\drizzle-baseline`（含原始 `0022_romantic_viper.sql` 与 `0022_snapshot.json`）与 `%TEMP%\drizzle-evidence`（走查脚本与各次 generate 日志）已保留作证；两个验收副本已删除，删前先摘掉 junction，并复核 `packages/db/node_modules` 仍为 13 项。

**未做**：未改任何 `.sql`、未改 `_journal.json`、未改 schema；`docs/module-status/db.md` 与 `.trellis/spec/db/backend/database-guidelines.md` 里「缺 21 份快照」的口径**尚未随之更新**——按工单 04 的裁定 8，这属于**下一步**（改为「已补齐至 `0021_snapshot.json`，`db:generate` 可用」）。本工单先如实记在这里，不假装已同步。
