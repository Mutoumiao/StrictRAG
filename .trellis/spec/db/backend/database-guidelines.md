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

### 检索闸分层（S2 · X-24 · 必复用）

```typescript
// packages/db/src/query/retrieval-gate.ts
isDefaultRetrievable({ status, lifecycle })
// ⇔ status === 'ready' && lifecycle === 'active'
```

| 层 | 谓词 / 职责 | 落点 |
|----|-------------|------|
| **L0 默认双闸** | `ready ∧ active` | **唯一** `isDefaultRetrievable`（本包） |
| **L1 corpus 过滤** | 在 L0 上再滤 `docTypes` / 租户等 | `apps/api` `services/retrieve/corpus.ts`（**须先** L0） |
| **L2 检索通道** | dense / sparse / RRF / rerank | `services/retrieve/*`；**不得**绕过 L0 直接搜全表 |
| **L3 ACL（P3）** | 部门 / principal | 未强制；开启须 ADR-057/`DEPT_ACL_ENFORCE` |

| 规则 | 说明 |
|------|------|
| 默认闸 | ready ∧ active（ADR-038） |
| 消费者 | `apps/api` retrieve **必须**复用 L0；禁止 route/service 私写平行 `status===ready` |
| 单测 | `tests/retrieve/ready-active-gate.test.ts` 护栏；api corpus 测例证明 draft/embedding 不可见 |
| **Wrong** | retrieve 手写 `WHERE status='ready'` 漏 lifecycle |
| **Correct** | `docs.filter(isDefaultRetrievable)` 后再 docTypes |

### 迁移 runbook（X-22 · 最小可执行）

| 步骤 | 命令 / 动作 |
|------|-------------|
| 1 改 schema | 只改 `packages/db/src/schema/**` |
| 2 生成 | 在 `packages/db`：`pnpm drizzle-kit generate`（以包脚本为准） |
| 3 审 SQL | 读 `drizzle/` 新 migration；**禁**手改历史已应用文件 |
| 4 本地升 | `pnpm` 包内 migrate / 根脚本（见 `docs/module-status` / docker compose） |
| 5 验证 | `pnpm --filter @strict-rag/db test` + api/worker 冒烟 |
| 6 回滚策略 | 前向修复优先；destructive drop 须双人 + 备份 |

| 禁项 | 说明 |
|------|------|
| 业务 route 内 `CREATE TABLE` | 只走 drizzle-kit |
| api/worker 各维护一份 schema | 唯一 `packages/db` |
| 未 migrate 就宣称「表已齐」 | IS 以 migration 目录 + 实库为准 |

### 向量 / 索引阶段门（X-23）

| 阶段 | 门 | 未过则 |
|------|-----|--------|
| embed 写 `chunk_embeddings` | 维数 D 与模型绑定；mock dims=8 **≠** 生产 D | 禁止把 mock 维当生产 ANN |
| `documents.embedReady` | 本 version 全 chunk 有向量（或策略允许的空集规则） | 不得 `ready` |
| `documents.esReady` | sparse 对账成功（mock 或真 ES） | 不得 `ready` |
| 检索可见 | **双就绪** ∧ `lifecycle=active`（L0） | draft ready 文档不可 ask |
| 换 embed 模型 / D | **新 indexVersion** + reindex；禁原地混维 | 须运维 runbook + 测 |

> Drizzle `vector(D)` 列类型选型仍 open（ORM PRD §8）；**阶段门语义**以上表为准，与实现细节解耦。

### 权限表 · Schema Delta（X-10）

| 表 | 职责 | 与 PRD 偏差 |
|----|------|-------------|
| `platform_roles` | 角色元数据 + **`codes_json`** 内嵌权限码 | 非独立 role_permissions 表（**过渡**；DEC-X1） |
| `user_roles` | 用户↔角色 | 对齐 |
| （无）`permissions` 表 | 码字典在 **admin-catalog 包** | 不落 PG 字典表 |

Runtime 放行 HOW → [api auth-authorization](../../api/backend/auth-authorization.md)「Runtime Truth」。  
**禁止**在 db 包复制权限码字符串全集。

### ADR-057 部门模型 · 本包 deferred 清单（X-36）

| 能力 | schema / 代码 | P2 壳 | P3 强制检索 |
|------|---------------|:-----:|:-----------:|
| `departments` 树 | **已有**（B5） | 部分 UI/API | — |
| `user_departments` | **已有** | 部分 | — |
| `documents.owner_dept_id` / `visibility_level` | **已有列**（`0007_p3b_doc_dept_meta`；空 dept=库级 · level 默认 20） | 可存 | api 过滤默认关 |
| `dept_cross_grants` | **已有表**（`0008_p3b_dept_cross_grants`；`(user_id, dept_id)` 唯一） | 可存 | enforce 开时 api 读未过期 grant（精确 ∪ 祖先部门子树） |
| retrieve 部门谓词 | api `filterDocsForDeptAcl`（默认关；精确 ∪ 祖先 + grant 精确 ∪ 祖先部门子树） | — | **禁止**假装 ADR-057 全文已强制（无 ES / 无默认开） |

**HOW**：部门表可演进，但 **不得** 在 db HOW 写「检索已按 ADR-057 全强制」直至 enforce 开关与测齐备。

### Ask 表（S2 + B10）

| 表/模块 | 用途 |
|---------|------|
| `schema/ask/ask-sessions.ts` | 会话壳（无 rewrite 近窗） |
| `schema/ask/ask-traces.ts` | 请求轨迹 / evidence_snapshot |
| `schema/ask/ask-feedback.ts` | 反馈队列（B13） |
| `schema/ask/eval-runs.ts` | L1 `golden_2x2` / L2 `session_multiturn` 批跑归档（migration `0006_b10_eval_runs`；`L1_PERSIST_EVAL` / `L2_PERSIST_EVAL`） |

`evidence_snapshot` **仅**本轮 retrieve 切片；禁止塞会话原文。  
`eval_runs` 写库时间用 `formatLocalDateTime`（见 [l1-eval](../../api/backend/l1-eval.md) / [l2-eval](../../api/backend/l2-eval.md)）。L2 也可写 `run_type=session_multiturn`；L2 `signoff_eligible` **仍 0**。mock 跑 `signoff_eligible=0`。有账本 ≠ 准出。

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

现状：`packages/db` 已有 vitest（`tests/env/local-datetime.test.ts` · `tests/retrieve/ready-active-gate.test.ts` 等，见 `tests/index.md`）；集成 migrate 测仍待 Docker。新测例 HOW：`.trellis/spec/guides/testing.md`。

---

## 反模式

- **Bad**：仅在 `apps/api/src/db` 建 schema  
- **Bad**：Prisma 与 Drizzle 并行  
- **Bad**：worker 使用过时的复制 schema  
- **Good**：本包一处定义；api/worker 只 import
