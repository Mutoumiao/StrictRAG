# db · Drizzle 指南

> Phase 0/1 已落地 schema + migrate；以下为 **HOW** 持续约束。  
> 权威：`prds/02-engineering/02-orm-drizzle.md`。

---

## 选型

| 项 | 决定 |
|----|------|
| ORM | Drizzle（唯一） |
| Driver | `postgres`（postgres-js） |
| API | `drizzle-orm/postgres-js` |
| 迁移 | drizzle-kit generate + migrate |
| 向量 | 迁移 SQL 管理 `vector(D)`；D 与 embed 模型绑定；**Drizzle 列类型（官方/custom）仍 open**（ORM PRD §8），以实现时选型为准 |

---

## 编码规范

### 列与命名

- DB 列：**snake_case**  
- TS 字段：camelCase 映射  

### baseColumns / 时间 / ID

| 规则 | 说明 |
|------|------|
| 写库时间 | 本地格式串，如 `format(new Date(), "yyyy-MM-dd HH:mm:ss")` |
| 禁止 | `toISOString()` 直接写 DB 时间列 |
| ID | uuid **v7**（实现阶段） |

### 查询

- 优先 query builder  
- 复杂 ANN：`sql` 封装进 `denseSearch()` 一类 repository 方法  
- **禁止**业务 route 裸 `pg` Client 散落  

### 事务场景（PRD）

- 文档状态切换  
- `index_version` 激活  

---

## Schema 示例形状（PRD 示意，非现仓文件）

```typescript
import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { baseColumns } from '../_shard/base-columns';

export const documents = pgTable('documents', {
  ...baseColumns,
  tenantId: uuid('tenant_id').notNull(),
  kbId: uuid('kb_id').notNull(),
  title: text('title').notNull(),
  status: text('status').notNull(),
});
```

实现时以真实 `base-columns` 与 PG PRD 为准。

---

## 迁移流程

```bash
# 目标命令（Phase 0 接线后）
pnpm --filter @strict-rag/db db:generate
pnpm --filter @strict-rag/db db:migrate
```

- 评审 migration SQL  
- **生产禁止** `db:push` 直接改线上  

---

## 测试（目标）

| 类型 | 要求 |
|------|------|
| 单元 | repository mock |
| 集成 | 测试库 migrate 后关键查询 |

现状：`packages/db` 已有 vitest（`time` · `retrieval-gate`）；集成 migrate 测仍待 Docker。

---

## 反模式

- **Bad**：仅在 `apps/api/src/db` 建 schema  
- **Bad**：Prisma 与 Drizzle 并行  
- **Bad**：worker 使用过时的复制 schema  
- **Good**：本包一处定义；api/worker 只 import
