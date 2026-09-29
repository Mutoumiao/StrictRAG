# 工单 03 · 迁移在真 PG 上 apply 干净（雾簇 23 · 真跑证据）

> 图：[`real-stack-evidence`](../map.md) · 工单：[`issues/03-task-migrate-on-real-pg.md`](../issues/03-task-migrate-on-real-pg.md)
> 目标库：compose `strict-rag-postgres`（`pgvector/pgvector:pg16`，用户/库均为 `strict_rag`）

## 1. 起点：库是空的

```text
docker exec strict-rag-postgres psql -U strict_rag -d strict_rag -c "\dt"
→ Did not find any relations.
docker exec … -tAc "select count(*) from drizzle.__drizzle_migrations"
→ ERROR: relation "drizzle.__drizzle_migrations" does not exist
```

即这是一次**从零 apply**，不是增量补齐。

## 2. 从零 apply

```bash
pnpm db:migrate
```

原始输出（节选）：

```text
> drizzle-kit migrate --config drizzle.config.ts
Reading config file 'D:\projects\ai-stared-project\StrictRAG\packages\db\drizzle.config.ts'
Using 'postgres' driver for database querying
[✓] migrations applied successfully!
```

退出码 0，**零错误**。

## 3. 三处计数一一对应

`packages/db/drizzle` 下：

| 口径 | 命令 | 结果 |
|------|------|------|
| 迁移 SQL 文件数 | `Get-ChildItem packages/db/drizzle -Filter *.sql` | **23**（末三个：`0020_documents_active_index_version.sql` · `0021_chunks_dedupe_review.sql` · `0022_ingest_report_default_parity.sql`） |
| journal 条目数 | `node -e "require('./packages/db/drizzle/meta/_journal.json')"` | **23**，idx 0–22 连续、tag 与文件名逐条一致 |
| 实际已应用数 | `select count(*) from drizzle.__drizzle_migrations` | **23** |
| public 表数 | `select count(*) from information_schema.tables where table_schema='public'` | **26** |

**23 = 23 = 23**，无孤儿、无缺号、无重复应用。

## 4. 能力级回读（不只是「建得出来」）

| 断言 | 结果 |
|------|------|
| 迁移 0020 的列落地 | `documents.active_index_version` → `integer`，`is_nullable=YES`；同表 `index_version` → `integer`，`is_nullable=NO` |
| 迁移 0021 的列落地 | `chunks.dedupe_status` → `text` |
| **真写 / 真读 / 真删** | `insert into schema_meta (id,key,value) values (gen_random_uuid(),'probe:real-stack','ok') returning …` → 1 行；`select` 回读 `probe:real-stack=ok`；`delete … where key='probe:real-stack'` → `DELETE 1` |

真 PG 上表结构不是「只建得出来」，而是**能写能读到**。

## 5. schema 漂移：零

```bash
pnpm --filter @strict-rag/db db:generate
```

原始输出（末尾）：

```text
permission_definitions 5 columns 0 indexes 0 fks
platform_roles 11 columns 1 indexes 0 fks
schema_meta 7 columns 0 indexes 0 fks
…
No schema changes, nothing to migrate 😴
```

且 `git status --short packages/db` 前后**都为空** —— `db:generate` 没有落任何新迁移文件。即**漂移的 Drizzle schema 定义与真 PG 实结构逐位一致**。

## 6. 结论

| 项 | 结果 |
|----|------|
| 空库从零 apply 全部迁移 | ✅ 零错误 |
| SQL 文件 / journal / 已应用 三者一致 | ✅ 23 = 23 = 23 |
| 三条能力级回读 | ✅ |
| `db:generate` 漂移 | ✅ 零 |
| 雾簇 23「迁移未经真 PG apply 验证」 | **本机已解**：不是「不能」，是**此前没人跑过** |

**未覆盖（如实记录）**：迁移 0015 的历史回填值真伪（雾簇 38）在本轮是**空库**，没有历史行可判，故不在本票结论内；本票只证明「从零 apply + 结构一致 + 可写可读」。
