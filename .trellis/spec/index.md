# StrictRAG · Trellis Spec 索引

> 本目录是 **HOW 写代码** 的工程约定库。产品语义与接口契约以 **`prds/00–11`** 为 SSOT；冲突以 PRD 为准。

**仓库阶段**：**Phase 0/1 已落地**（S1 入库最小闭环 + 身份/权限码骨架；ES 仍为 mock）。  
**Phase 2**：Trellis 任务已规划（`08-05-phase-2-ask*`）；**设计评审通过并授权前禁止**实现 ask / LangGraph / 生产检索。差额能力见 `08-05-phase-2-backlog`。

---

## 包与层

| 包 | 路径 | Spec 层 | 角色 |
|----|------|---------|------|
| `admin` | `apps/admin` | [frontend](./admin/frontend/index.md) | Next.js 管理端（占位） |
| `web` | `apps/web` | [frontend](./web/frontend/index.md) | Next.js 用户端（占位） |
| `api` | `apps/api` | [backend](./api/backend/index.md) | Hono + Node HTTP（占位） |
| `worker` | `apps/worker` | [backend](./worker/backend/index.md) | BullMQ 消费者（占位） |
| `contracts` | `packages/contracts` | [library](./contracts/library/index.md) | BizCode / ApiResponse / Zod |
| `admin-catalog` | `packages/admin-catalog` | [library](./admin-catalog/library/index.md) | 权限码 + 菜单 SSOT |
| `db` | `packages/db` | [backend](./db/backend/index.md) | Drizzle schema（api/worker 共用） |
| `ui` | `packages/ui` | [frontend](./ui/frontend/index.md) | `cn()` · theme · 共享组件 |
| `eslint-config` | `packages/eslint-config` | [tooling](./eslint-config/tooling/index.md) | 共享 ESLint |
| `typescript-config` | `packages/typescript-config` | [tooling](./typescript-config/tooling/index.md) | 共享 tsconfig |

## 跨包思考指南

| 指南 | 用途 |
|------|------|
| [guides/index.md](./guides/index.md) | 思考指南总入口 |
| [monorepo-boundaries](./guides/monorepo-boundaries.md) | 包边界、依赖方向、禁止项 |
| [quality-redlines](./guides/quality-redlines.md) | RAG 质量红线（拒答 / min / evidence） |
| [phase-scaffold-rules](./guides/phase-scaffold-rules.md) | 骨架阶段允许做什么 |
| [cross-layer-thinking-guide](./guides/cross-layer-thinking-guide.md) | 跨层数据流 |
| [code-reuse-thinking-guide](./guides/code-reuse-thinking-guide.md) | 复用与防重复 |

## 权威文档映射

| 要做… | 打开（PRD SSOT） |
|--------|------------------|
| 范围 / 非目标 | `prds/00-product/` |
| 栈 / 仓边界 | `prds/01-architecture/` · `prds/02-engineering/` |
| Schema / 存储 | `prds/03-data/` |
| 入库 / ask 图 | `prds/04-pipelines/` |
| HTTP API | `prds/05-api/` |
| 任务队列 | `prds/06-async/` |
| 模型网关 | `prds/07-models/` |
| 验证·门禁·拒答 | `prds/08-quality/` |
| 权限 ACL | `prds/09-security/` |
| 分期 / 验收 | `prds/10-delivery/` |
| ADR | `prds/11-decisions/` |

`prds/12-delivery-guides/` 是交付白话 / 开工材料，**不是**接口契约。

## 验证命令（仓库级）

```bash
pnpm install
pnpm check-types
pnpm lint
# docker compose -f docker/docker-compose.yml up -d   # 仅 PG+Redis 骨架
```

目标端口（实现后）：**web 3005 · admin 3006 · api 4000**；worker 无 HTTP。
