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

## createDb 分端超时（ARCH-P0）

`packages/db/src/client.ts` · `CreateDbOptions`：

| 选项 | 含义 |
|------|------|
| `statementTimeoutMs` | session `statement_timeout`；**0 / 不传 = 不设置** |
| `lockTimeoutMs` | session `lock_timeout`；**0 / 不传 = 不设置** |

| 调用方 | 建议默认 | 证据 |
|--------|----------|------|
| **api** `getDb()` | statement **15_000** · lock **10_000** | `apps/api/src/services/db.ts` |
| **worker** `getDb()` | **0**（长入库禁止无脑 15s） | `apps/worker/src/db.ts` |

规则：api/worker **不同默认**；禁止在 `createDb` 内写死 15s 害 worker。

关闭：`close()` / 各端 `closeDb()`；api 进程 SIGINT/SIGTERM 调 `closeDb`。

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

### 检索闸（S2 · 必复用）

```typescript
// packages/db/src/query/retrieval-gate.ts
isDefaultRetrievable({ status, lifecycle })
// ⇔ status === 'ready' && lifecycle === 'active'
```

| 规则 | 说明 |
|------|------|
| 默认闸 | ready ∧ active（ADR-038） |
| 消费者 | `apps/api` retrieve **必须**复用；禁止 route/service 私写平行谓词 |
| 单测 | `retrieval-gate.test.ts` 护栏 |

### 权限表 · Schema Delta（X-10）

| 表 | 职责 | 与 PRD 偏差 |
|----|------|-------------|
| `platform_roles` | 角色元数据 + **`codes_json`** 内嵌权限码 | 非独立 role_permissions 表（**过渡**；DEC-X1） |
| `user_roles` | 用户↔角色 | 对齐 |
| （无）`permissions` 表 | 码字典在 **admin-catalog 包** | 不落 PG 字典表 |

Runtime 放行 HOW → [api auth-authorization](../../api/backend/auth-authorization.md)「Runtime Truth」。  
**禁止**在 db 包复制权限码字符串全集。

### Ask 表（S2 + B10）

| 表/模块 | 用途 |
|---------|------|
| `schema/ask/ask-sessions.ts` | 会话壳（无 rewrite 近窗） |
| `schema/ask/ask-traces.ts` | 请求轨迹 / evidence_snapshot |
| `schema/ask/ask-feedback.ts` | 反馈队列（B13） |
| `schema/ask/eval-runs.ts` | L1 批跑归档（migration `0006_b10_eval_runs`；`L1_PERSIST_EVAL`） |

`evidence_snapshot` **仅**本轮 retrieve 切片；禁止塞会话原文。  
`eval_runs` 写库时间用 `formatLocalDateTime`（见 [l1-eval](../../api/backend/l1-eval.md)）；mock 跑 `signoff_eligible=0`。

---

## Schema 形状（以仓内文件为准）

```typescript
import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { baseColumns } from '../_shard/base-columns';

// 示例：真实列以 packages/db/src/schema/** 为准
export const documents = pgTable('documents', {
  ...baseColumns,
  tenantId: uuid('tenant_id').notNull(),
  kbId: uuid('kb_id').notNull(),
  title: text('title').notNull(),
  status: text('status').notNull(),
});
```

---

## 迁移流程

```bash
pnpm --filter @strict-rag/db db:generate
pnpm --filter @strict-rag/db db:migrate
```

- 评审 migration SQL  
- **生产禁止** `db:push` 直接改线上  

---

## 测试

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
