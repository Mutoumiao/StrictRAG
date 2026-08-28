# db · 目录结构

## 当前（对齐 `packages/db/src`）

```text
packages/db/
  package.json            # db:generate · db:migrate 等
  drizzle/                # 迁移 SQL（评审入口；0000–0006+）
  tests/
    index.md              # 本包测例导航
  src/
    index.ts              # 导出 client / schema / query helpers
    client.ts             # createDb（分端 timeout）
    time.ts               # 本地格式串写库 · uuid 辅助
    query/
      retrieval-gate.ts   # isDefaultRetrievable：ready ∧ active
    schema/
      index.ts
      _shard/base-columns.ts
      system/
        schema-meta.ts
        users.ts
        platform-roles.ts   # platform_roles · user_roles（codes_json 现状）
        departments.ts      # departments · user_departments（B5 壳）
        model-providers.ts
        model-bindings.ts
      kb/
        knowledge-bases.ts
        documents.ts
        chunks.ts
        chunk-embeddings.ts
        chunk-manifests.ts
        kb-members.ts
        ingest-jobs.ts
        chunk-strategy-definitions.ts  # ADR-053 平台注册表
        kb-chunk-strategies.ts         # ADR-053 库启用
      ask/
        ask-sessions.ts
        ask-traces.ts
        ask-feedback.ts
        eval-runs.ts        # B10-followup 工程
```

> **完成度 / 相对 PRD 缺表** → `docs/module-status/db.md` + [database-guidelines](./database-guidelines.md)。  
> 本树是路径导航，**非**产品 schema SSOT（WHAT 在 `prds/03-data`）。

## 规则

| 规则 | 说明 |
|------|------|
| 唯一 ORM | Drizzle + postgres-js；禁 Prisma |
| 共用 | api 与 worker **必须**依赖本包；禁止双份 schema |
| 检索闸 | retrieve **必须**复用 `isDefaultRetrievable`（ADR-038）；indexVersion/ACL/scope 等在 api retrieve 叠加 |
| 时间 / ID | 本地格式串写库；uuid v7（见 database-guidelines） |
| 新表 | 先 PRD/ADR（冻结语义）→ schema 文件 → generate migrate → 双端消费 |

## 脚本

| 脚本 | 意图 |
|------|------|
| `db:generate` | drizzle-kit generate |
| `db:migrate` | 生产可重复 migrate |

**生产禁止** `db:push` 直接改线上。
