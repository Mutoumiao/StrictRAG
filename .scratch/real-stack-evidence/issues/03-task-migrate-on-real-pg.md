# 迁移在真 PG 上 apply 干净（雾簇 23）

Label: wayfinder:task
Type: task
Status: open
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

（待填）
