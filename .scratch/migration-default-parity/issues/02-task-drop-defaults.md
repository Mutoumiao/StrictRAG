# 02 · task：撤掉 0015 遗留的库侧 DEFAULT + 加对账护栏 + 回写镜像

Type: task
Status: open
Blocked by: 01

## 做什么

1. **新迁移** `packages/db/drizzle/0022_ingest_report_default_parity.sql`：
   ```sql
   ALTER TABLE "ingest_reports" ALTER COLUMN "cross_doc_dropped" DROP DEFAULT;
   --> statement-breakpoint
   ALTER TABLE "ingest_reports" ALTER COLUMN "conflict_pairs" DROP DEFAULT;
   ```
   文件头写清「为何撤」与「不改 schema / 不重生成快照」。
2. **journal**：`packages/db/drizzle/meta/_journal.json` 追加 `idx: 22` 条目（`version: "7"`、`breakpoints: true`、`when` 接在 0021 之后递增），tag = `0022_ingest_report_default_parity`。
3. **护栏测例** `packages/db/tests/migrations/sql-snapshot-default-parity.test.ts`（头注释「目标 / 需求 / 被测 / 简介」简体中文）：
   - 按文件名顺序解析全部 `.sql` 的**净** DEFAULT 集合（`ADD COLUMN … DEFAULT` 记入，`ALTER COLUMN … DROP DEFAULT` 移除）；
   - 与 `meta/` 中**最高号** `*_snapshot.json` 的 `default` 集合双向比对；
   - 两条断言：净 SQL DEFAULT ⊆ 快照 default，且快照 default ⊆ 净 SQL DEFAULT。
   - 快照文件名不得硬编码（取最高号），否则下次换基线即假红。
4. **登记** `packages/db/tests/index.md`：能力表加 `migrations/` 行；测例表加一行；`待处理` 段保持「无」。
5. **回写镜像** `docs/module-status/db.md`：迁移条数行、`ingest_reports` 条目（写明两列**已无**库侧默认）、`最近更新` 追加当日条目（写清做了什么 / 未做什么）。

## 纪律

- **不改** schema 文件、**不重生成**快照、**不动**列可空性（属冻结语义）。
- 不做「顺手」重构。
- 收口跑：`pnpm check-types` · `pnpm lint` · `pnpm test`（至少 db 包）· `pnpm check:module-status`。
- **反证**：把两列的 `DROP DEFAULT` 临时注掉，确认新测例**必须红**；还原后**必须绿**。

## 验收

- 对账测例绿；反证时红。
- `pnpm check:module-status` 在**最后一次提交之后**复跑通过，条数记进 map。
- 如实标注**未验证**项：本机无 Docker 守护进程 → 迁移未在真 PG 上跑过。
