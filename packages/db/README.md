# `@strict-rag/db`

Drizzle ORM schema 与客户端，供 `apps/api` / `apps/worker` 共用。

## 前提

- 本地 PG：`docker compose -f docker/docker-compose.yml up -d postgres`
- `DATABASE_URL`（默认 compose 凭证见根 `.env.example`）

## 命令

```bash
# 从仓库根
pnpm db:generate   # drizzle-kit generate
pnpm db:migrate    # 应用 migrations

# 或包内
pnpm --filter @strict-rag/db db:migrate
```

## 约定

- 写库时间：`formatLocalDateTime()` → `yyyy-MM-dd HH:mm:ss`（禁止 `toISOString()` 写库）
- ID：`uuidv7()`（应用侧 `$defaultFn`）
- Phase 0 仅含 `schema_meta` 占位表；业务 KB/文档表属 Phase 1

## 导入

```ts
import { createDb, schemaMeta, formatLocalDateTime } from '@strict-rag/db';
```
