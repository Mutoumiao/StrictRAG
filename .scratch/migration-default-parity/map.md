# 迁移 SQL 与 schema/快照的默认值对账（撤掉 0015 遗留的库侧 DEFAULT）

Label: wayfinder:map
Status: resolved（前沿：空。三张工单全落地：撤默认 + 护栏测例 + 镜像；旁路发现并修好 `check.mjs` 的解析缺陷。**未验证**：本机无 Docker 守护进程，迁移未在真 PG 上 apply 过）

## Destination

消除 `packages/db/drizzle` 迁移 SQL 与 Drizzle schema / `meta/*_snapshot.json` 之间**列级 DEFAULT 的漂移**，使「库比声明更宽松」的静默默认不再存在：任何漏传该列的写入必须**报错**，而不是悄悄得到 `0` / `'[]'`（那等于替业务断言「本轮无跨文档去重」）。到达时同时满足：

- **全量对账为 0**：所有迁移 SQL 的**净** DEFAULT 集合与最高号快照的 `default` 集合逐列一致，实证得出（脚本跑出来的表，不是肉眼扫）。
- **有回归护栏**：新增一条对账测例，把「迁移 SQL 净 DEFAULT ⊆ 快照 default 且反向亦成立」钉死，下次再有人给 ALTER 加 DEFAULT 忘撤销/忘声明时直接红。
- **不碰冻结语义**：不改 `prds/00–11`；不改任何列的可空性/类型（那属冻结 schema 语义，须 ADR）；只撤库侧 DEFAULT。
- **镜像同步**：`docs/module-status/db.md` 的迁移条数、`ingest_reports` 条目、`最近更新` 与该事实一致。

## Notes

- 域：StrictRAG。**IS 以源码为准**；`docs/module-status/db.md` 是它的镜像。
- **发现经过**：核实上一条雾（`kb_members.role` 是否入闸）时顺带亲核 `packages/db`，发现 `0015_ingest_report_cross_doc.sql` 给 `cross_doc_dropped` 与 `conflict_pairs` 加了库级 `DEFAULT`，而 schema 与快照**都没有** default。
- **全量实证（`.scratch/migration-default-parity/sweep.mjs`，一次性脚本）**：22 个 `.sql` 里标 DEFAULT 的列共 **51**，快照带 `default` 的列共 **49**；差值 **2** 全部来自 0015；反向（快照有 default 而 SQL 无来源）为 **0**。
- **排除的同类嫌疑（已核，非漂移）**：`0007` 的 `documents.visibility_level DEFAULT 20` 与 `0010` 的 `eval_runs.status DEFAULT 'succeeded'` 虽是 ALTER 加的，但 schema 侧确有 `.default(...)`（`packages/db/src/schema/kb/documents.ts:57` · `ask/eval-runs.ts:29`），属正常。
- **为何 0015 会这样**：`ALTER TABLE … ADD COLUMN … NOT NULL` 在有数据的表上必须给 DEFAULT 才能回填；作者给了默认但**没有**在 schema 声明，于是库侧永久比声明宽松。
- **方向裁定（只加严）**：撤库侧 DEFAULT（而非在 schema 声明 default）。理由：同表兄弟计数列（`chunk_count` / `internal_dropped`，`0011` 建表）本就无默认；且若在 schema 声明 `.default(0)`，Drizzle 将**允许**省略该列，正是本仓注释反复警告的「写 0 假装零重复」反模式（`packages/db/src/schema/kb/ingest-reports.ts:28-31`）。
- **本机限制**：Docker 守护进程**未运行** → 本机**无法**把迁移真正 apply 到 PG 上。因此「迁移可执行」这一条**未经验证**，收口必须如实标注；可验证的是：文件/journal 一致、对账测例红→绿、`pnpm check-types` / `lint` / `test` / `check:module-status`。
- **旁路发现（已修）**：收口复跑检查时撞上自相矛盾的 `6-联动` 告警，查明是 `scripts/module-status/check.mjs` 自身的 porcelain 解析缺陷（要求状态码后两个空格 → 被修改的已跟踪文件读不到）。它既造成本次假阳性，也让「只改源码不改文档」这类最常见漂移长期漏判 —— 属「检查器本身不诚实」，必须先修仪器再谈收口。见工单 [03](./issues/03-task-check-porcelain-parse.md)。
- **基线对照**：HEAD 的漂移报告为 `2-env` 2 + `3-符号` 13 + `5-表` 21 = 36 条；本图改动后为 39 条，增量全部是 `5-表` 里把两个**物理列名**加反引号所致（同类条目基线已有 21 条，原文即「可能为字段/状态词」），不抹平、只记录。
- **收口复核纪律（前图教训）**：声明收口必须在**最后一次提交之后**复跑 `pnpm check:module-status`。

## Decisions so far

- [全量对账实证](./issues/01-research-default-parity-sweep.md) — 漂移恰为 0015 的两列；反向为 0；`visibility_level` / `eval_runs.status` 属正常声明，非漂移。
- [落地：撤默认 + 护栏测例 + 镜像](./issues/02-task-drop-defaults.md) — 见工单。
- [修 `check.mjs` 的 porcelain 解析（旁路发现）](./issues/03-task-check-porcelain-parse.md) — 收口复跑检查时撞上一条自相矛盾的 `6-联动` 告警，查明是**检查脚本自己的正则缺陷**（要求状态码后两个空格，导致被修改的已跟踪文件一律读不到）：既造成本次假阳性，也让「只改源码不改文档」这类最常见漂移**长期漏判**。已抽出 `scripts/module-status/git-status.mjs` + 回归测例修复，并在修后量出两侧行为（文档改=0 条 / 文档未改=1 条）。**未修**该脚本其余词表判定。

## Not yet specified

- **历史回填值的真伪**：0015 当年给既有行回填了 `cross_doc_dropped = 0` / `conflict_pairs = '[]'`，这等于替历史行断言「无跨文档重复」，而当时该列**尚未被记录**（同表 `dedupe_cross_doc_rate` 的做法是留 NULL 表「未记录」）。要不要把两列改成可空以表达「未记录」——属**冻结 schema 语义**（须 ADR → 改 `prds/03-data` → 升版本），本图**不动**，只记录。
- **快照基线疏密**：`meta/` 目前只有 `0000_snapshot.json` 与 `0021_snapshot.json`（前图落的基线），中间迁移无逐个快照；本次不改基线策略。

## Out of scope

- 改 `prds/00–11` 已冻语义（含列可空性）
- 重新生成 drizzle 基线快照
- 真 PG 上跑迁移（本机无 Docker 守护进程）
