# 迁移在真 PG 上 apply 干净（雾簇 23）

Label: wayfinder:task
Type: task
Status: resolved
Blocked by: 01

## Question

对着一台**真 PG 16 + pgvector**（工单 02 起的 compose postgres）跑 `pnpm db:migrate`，把雾簇 23「迁移未经真 PG apply 验证」这条从未核对过的账真核一遍：

1. 空库从头 apply 全部迁移，**零错误**；记录应用的迁移条数与最后一条的 tag（`packages/db/src/migrations` / `drizzle/meta/_journal.json`）；
2. 核 `drizzle/meta` 的 `_journal.json` 条目与 `migrations/*.sql` 文件**一一对应**、无孤儿、无缺号（前图 `migration-default-parity` 只核过默认值/类型级，没核过真 apply）；
3. 至少挑 3 条能力上真跑一次**回读断言**（例：`documents.active_index_version` · `document_bodies` 或 `eval_runs` · 其一 ACL/部门列），证明表结构不只是「建得出来」而是「能写能读」；
4. `drizzle-kit` 的 schema 与已 apply 的实际结构是否一致（`pnpm db:generate` 是否产生空 diff——若有 diff，如实记下差在哪）。

任何一步红，都写清**哪个迁移 / 什么错**，并判断是「迁移本身错」还是「真 PG 与 mock 的差异」，据此裁定：能收紧或逐位等价修的当场修；撞冻结 schema 的记债。

产物：`research/03-migrate-real-pg.md`。

## Answer

**已解**。取证全文：[`../research/03-migrate-real-pg.md`](../research/03-migrate-real-pg.md)。

空库（`\dt` → `Did not find any relations`；`drizzle.__drizzle_migrations` 不存在）上 `pnpm db:migrate` → `[✓] migrations applied successfully!`，零错误。

| 断言 | 结果 |
|------|------|
| SQL 文件数 / journal 条目数 / 已应用行数 | **23 / 23 / 23**（idx 0–22 连续，tag 与文件名逐条一致） |
| public 表数 | 26 |
| 能力级回读 | `documents.active_index_version`(integer, nullable) · `chunks.dedupe_status`(text) 均落地；`schema_meta` 真 insert → 真 select 回读 → 真 delete 通过 |
| `pnpm --filter @strict-rag/db db:generate` | `No schema changes, nothing to migrate`，且前后 `git status packages/db` 皆空 → **零漂移** |

**结论**：雾簇 23「迁移未经真 PG apply 验证」在本机**已解**——不是「不能做」，是此前没人跑过。

**未覆盖**：迁移 0015 的历史回填值真伪（雾簇 38）需有历史行才可判，本轮是空库，不在本票结论内。
