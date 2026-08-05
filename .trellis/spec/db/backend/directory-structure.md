# db · 目录结构

## 当前（P1 + S2 schema）

```text
packages/db/
  package.json            # db:generate · db:migrate 等
  drizzle/                # 迁移 SQL（评审入口）
  src/
    index.ts              # 导出 client / schema / query helpers
    client.ts
    time.ts               # 本地格式串写库
    query/
      retrieval-gate.ts   # isDefaultRetrievable：ready ∧ active
      retrieval-gate.test.ts
    schema/
      index.ts
      _shard/base-columns.ts
      system/
        schema-meta.ts · users.ts
      kb/
        knowledge-bases.ts · documents.ts · chunks.ts
        chunk-embeddings.ts · chunk-manifests.ts
        kb-members.ts · ingest-jobs.ts
      ask/
        ask-sessions.ts · ask-traces.ts · ask-feedback.ts
```

## 规则

| 规则 | 说明 |
|------|------|
| 唯一 ORM | Drizzle + postgres-js；禁 Prisma |
| 共用 | api 与 worker **必须**依赖本包；禁止双份 schema |
| 检索闸 | P2 retrieve **必须**复用 `isDefaultRetrievable`（ADR-038） |
| 时间 / ID | 本地格式串写库；uuid v7（见 database-guidelines） |

## 脚本

| 脚本 | 意图 |
|------|------|
| `db:generate` | drizzle-kit generate |
| `db:migrate` | 生产可重复 migrate |

**生产禁止** `db:push` 直接改线上。
