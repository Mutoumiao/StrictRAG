# @strict-rag/db · Drizzle 数据层

> 路径：`packages/db`  
> 消费者：`apps/api` · `apps/worker`（**必须**共用）  
> 现状：KB/文档/chunk/manifest/embed/ingest_jobs + **ask_*** + **eval_runs**（B10-followup 工程）+ users + **platform_roles/user_roles** + **departments/user_departments** + model_providers/bindings；`documents.owner_dept_id` / `visibility_level` **已有列**（P3b-META；**强制未接**）；`query/retrieval-gate`；migrate 在 `drizzle/`（含 `0007_p3b_doc_dept_meta`）。

---

## Pre-Development Checklist

- [ ] Schema 是否只放在本包（非 app 私有）？  
- [ ] 是否对照 `prds/03-data/01-postgresql-schema.md`？  
- [ ] 时间列是否本地格式串？ID 是否 uuid v7 策略？  
- [ ] 检索相关改动是否复用 `isDefaultRetrievable`（ready∧active）？  
- [ ] 是否避免引入 Prisma？  

## Quality Check

- [ ] migrate SQL 可评审；生产禁用裸 `db:push`  
- [ ] api 与 worker 使用同一 schema 模块  
- [ ] `pnpm --filter @strict-rag/db check-types` · `test`  

---

## 指南索引

| 指南 | 说明 |
|------|------|
| [directory-structure](./directory-structure.md) | 现状目录（含 ask schema） |
| [database-guidelines](./database-guidelines.md) | Drizzle 规范（PRD 落地 HOW） |

## PRD 映射

- `prds/02-engineering/02-orm-drizzle.md`  
- `prds/03-data/01-postgresql-schema.md`  
- IS：`docs/module-status/db.md`
