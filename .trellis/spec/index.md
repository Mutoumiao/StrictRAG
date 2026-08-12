# StrictRAG · Trellis Spec 索引

> 本目录是 **HOW 写代码** 的工程约定库。产品语义与接口契约以 **`prds/00–11`** 为 SSOT；冲突以 PRD 为准。  
> **完成度 / 已具备 / 债（IS）** 以 **源码 + [`docs/module-status/`](../../docs/module-status/README.md)** 为准；下列阶段句是导航摘要，**不是**第二套完成度 SSOT。

**仓库阶段（摘要）**：**P0/P1 入库** + **S2 最小 ask** + 08-11 工程项（接线/策略/反馈/部分 QUAL·OPS；QUAL-2 = mock 扫描**安全债**）。细节 → module-status。  
**默认依赖**：ES/`RETRIEVE_ES_MODE=mock` · Gateway 可 mock · `AUTH_ENFORCE` 默认关 · **rewrite 强制关** · `INGEST_SCAN_MODE=mock_clean`。  
**明确不等于**：路线图 Phase 2 全文 · 生产 ES+IK · 真杀毒引擎 · L1 业务签字真跑 · CRAG/multi_hop。全局调度：`08-06-project-backlog` · HOW 债：`08-12-spec-arch-review-backlog`。

---

## 包与层

| 包 | 路径 | Spec 层 | 角色 |
|----|------|---------|------|
| `admin` | `apps/admin` | [frontend](./admin/frontend/index.md) | Next.js 管理端（S2c 薄页） |
| `web` | `apps/web` | [frontend](./web/frontend/index.md) | Next.js 用户端（S2 最小 ask UI） |
| `api` | `apps/api` | [backend](./api/backend/index.md) | Hono + Node（入库 + S2 ask） |
| `worker` | `apps/worker` | [backend](./worker/backend/index.md) | BullMQ 入库消费者 |
| `contracts` | `packages/contracts` | [library](./contracts/library/index.md) | BizCode / ApiResponse / Zod（含 ask 域） |
| `admin-catalog` | `packages/admin-catalog` | [library](./admin-catalog/library/index.md) | 权限码 + 菜单 SSOT |
| `db` | `packages/db` | [backend](./db/backend/index.md) | Drizzle schema（api/worker 共用） |
| `ui` | `packages/ui` | [frontend](./ui/frontend/index.md) | Tailwind v4 主题 + Soft Bento · shadcn 风格原子 |
| `eslint-config` | `packages/eslint-config` | [tooling](./eslint-config/tooling/index.md) | 共享 ESLint |
| `typescript-config` | `packages/typescript-config` | [tooling](./typescript-config/tooling/index.md) | 共享 tsconfig |

### api 关键入口

| 指南 | 何时读 |
|------|--------|
| [ask-pipeline](./api/backend/ask-pipeline.md) | 改 ask / 图 / 检索 / SSE / Gateway / 会话 / feedback |
| [auth-authorization](./api/backend/auth-authorization.md) | 改登录 / 权限码 / hydrate / AUTH_ENFORCE |
| [kb-settings](./api/backend/kb-settings.md) | 改 KB 设置 / mode·docTypes 闸 |
| [model-gateway](./api/backend/model-gateway.md) | 改供应商绑定 / runtime resolve / rerank 双节点 |
| [chunk-strategies](./api/backend/chunk-strategies.md) | 改 complete/reindex 分片策略 |
| [l1-eval](./api/backend/l1-eval.md) | 改 L1 黄金集 / 2×2 / 批跑 / eval_runs |

### worker 关键入口

| 指南 | 何时读 |
|------|--------|
| [worker quality](./worker/backend/quality-guidelines.md) | 入库状态机 · 扫描闸 · 策略执行 |
| [ingest-idempotency](./worker/backend/ingest-idempotency.md) | 入库幂等/重试（X-04）· 禁重试重分块 |

## 跨包思考指南

| 指南 | 用途 |
|------|------|
| [guides/index.md](./guides/index.md) | 思考指南总入口 |
| [monorepo-boundaries](./guides/monorepo-boundaries.md) | 包边界、依赖方向、禁止项 |
| [quality-redlines](./guides/quality-redlines.md) | RAG 质量红线（拒答 / min / evidence）；P0 自动化表 → `docs/testing/p0-redlines.md` |
| [phase-scaffold-rules](./guides/phase-scaffold-rules.md) | 阶段门禁：允许/禁止（非 IS SSOT） |
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
| 模块完成度（IS） | `docs/module-status/` |

`prds/12-delivery-guides/` 是交付白话 / 开工材料，**不是**接口契约。

## 验证命令（仓库级）

```bash
pnpm install
pnpm check-types
pnpm lint
pnpm test
# docker compose -f docker/docker-compose.yml up -d   # PG+Redis
```

目标端口：**web 3005 · admin 3006 · api 4000**；worker 无 HTTP。
