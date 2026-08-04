# db · 目录结构

## 当前（骨架）

```text
packages/db/
  package.json
    scripts: build/check-types/lint
             db:generate / db:migrate → echo Phase 0 占位
  src/
    index.ts    # export const DB_SCAFFOLD = true
```

**无** `drizzle.config.*`、**无** `schema/`、**无** migrations 目录（Phase 0 再建）。

## 目标组织（PRD · 实现时）

来自 `prds/02-engineering/02-orm-drizzle.md`：

```text
src/
  schema/
    _shard/base-columns.ts
    kb/
      knowledge-bases.ts
      documents.ts
      chunks.ts
      chunk-embeddings.ts
      kb-members.ts
      ...
  index.ts          # 导出 db client 工厂、schema、relations
```

| 规则 | 说明 |
|------|------|
| 唯一 ORM | Drizzle + postgres-js |
| 迁移 | drizzle-kit generate + migrate |
| 共用 | api 与 worker 都依赖本包；禁止双份 schema |

## 脚本目标

| 脚本 | 意图 |
|------|------|
| `db:generate` | drizzle-kit generate |
| `db:migrate` | 生产可重复 migrate |

实现后根目录或本包提供统一 `pnpm` 入口（与工程 PRD 对齐）。
