# Project Instructions · StrictRAG

为精准度而生的**严厉企业知识库 RAG**。宁拒勿妄 · 证据优先。

| 优先级 | 路径 | 角色 |
|--------|------|------|
| 1 | **`prds/00–11/**`** | **生产 SSOT**（当前 **0.4.32**） |
| 2 | `prds/12-delivery-guides/` | 交付白话 / 开工 / 试点 / 设计（**非接口契约**） |
| 3 | `prds/12-delivery-guides/90-工业级优化思路.md` | 战略（M3+ 须回写 00–11 后生效） |
| 4 | `product.pen` | 设计线稿 |

冲突一律以 **`prds/00–11`** 为准。改冻结语义：ADR → 改 PRD → 升 `prds/README.md` 版本。  
决策与交接：`prds/11-decisions/`。配套入口：`prds/12-delivery-guides/README.md`。

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|--------|
| Monorepo | pnpm 10 + Turborepo | Node ≥ 20；**仅 pnpm**；版本见 `pnpm-workspace.yaml#catalog` |
| Packages | `@strict-rag/*` | apps 4 + packages 6 |
| admin / web | Next.js（目标） | **骨架占位**，未接框架 |
| api | Hono + Node（目标） | **骨架**；非 CF Workers |
| worker | BullMQ（目标） | **骨架** |
| ORM / PG | Drizzle → PG 16 + pgvector | 唯一 ORM；禁 Prisma |
| Sparse / body / S3 | ES+IK · Mongo · RustFS | 见 `prds/03-data` |
| Queue / graph | Redis · LangGraph.js | ask 状态机见 `prds/04-pipelines` |
| Models / obs | HTTP Gateway · Langfuse · Pino | `prds/07-models` · `08-quality` |

## Project Structure

```text
apps/admin|web|api|worker   → UI / HTTP / 异步（均 scaffold）
packages/contracts          → common/biz-code · response · 按域 contract（Zod）
packages/admin-catalog      → 权限码 + 菜单（ADR-056）
packages/db                 → Drizzle schema（api+worker 共用）
packages/ui|eslint-config|typescript-config
prds/00–11                  → 产品…决策 **SSOT**
prds/12-delivery-guides     → 交付/开工/试点/设计（辅助）
docker/                     → compose 骨架（现 PG+Redis）
product.pen                 → 线稿
```

| 要做… | 打开 |
|--------|------|
| 范围 / 非目标 | `prds/00-product/` |
| 栈 / 仓边界 | `prds/01-architecture/` · `02-engineering/` |
| Schema / 存储 | `prds/03-data/` |
| 入库 / ask 图 | `prds/04-pipelines/` |
| HTTP API | `prds/05-api/` |
| 任务队列 | `prds/06-async/` |
| 模型网关 | `prds/07-models/` |
| 验证·门禁·拒答 | `prds/08-quality/` |
| 权限 ACL | `prds/09-security/` |
| 分期 / 验收 | `prds/10-delivery/` |
| ADR / 待拷问交接 | `prds/11-decisions/` |
| 交付配套总目 | `prds/12-delivery-guides/README.md` |
| Sprint0 / 垂直切片 | `prds/12-delivery-guides/06-工程开工.md` |
| 交付编排 | `prds/12-delivery-guides/04-交付控制台.md` |

## Build & Run

```bash
pnpm install
pnpm check-types
pnpm lint
pnpm build | dev          # turbo；dev 现为占位 echo
# docker compose -f docker/docker-compose.yml up -d
```

目标端口：**web 3005 · admin 3006 · api 4000**；worker 无 HTTP。  
**Phase 0/1 代码已落地**（health/ready、migrate、入库闭环 mock）；**无** JWT 鉴权 / ask 图 / 真 ES 生产路径。

## Code Style

- TypeScript **strict**；共享 tsconfig：`@strict-rag/typescript-config`
- 依赖版本优先 **`catalog:`**（在 `pnpm-workspace.yaml` 登记）
- Prettier：singleQuote、trailingComma all、printWidth 100
- 包名 `@strict-rag/<name>`；源码 `src/`
- contracts：错误码与 `ApiResponse` 信封只放 `packages/contracts`，按域增文件；**`error.code` = PRD 短名**
- UI：`import { cn } from '@strict-rag/ui/lib/utils'`（子路径导出）
- 写库时间本地格式串（见 ORM PRD）；ID 用 uuid v7
- **禁止** route 内散落 SQL / ES DSL / 长 Prompt（SQL 进 `services/` / repo）；密钥不进 web/admin 包

## Testing

- **命令**：`pnpm test`（turbo → vitest）
- **已有**：`apps/api` · `apps/worker` · `packages/db` 同域 `*.test.ts`
- **目标（PRD）**：集成测 + 验收剧本 `prds/10-delivery/03-acceptance-scenarios.md`
- 新增测试与源码同域放置

## Conventions

- **阶段**：Phase 0/1 入库最小闭环（mock ES/scan 可联调）；**禁止** Phase 2 ask 未授权实现
- **下一阶段**：Docker live 验收 → Phase 2 检索+verify 设计评审
- **质量红线**：检索→约束生成→验证→拒答；**min 否决**；合法 draft 必 verify；历史≠evidence；门禁只加严不放宽；双就绪∧active 检索闸
- **Git**：历史过浅；建议 conventional commits
- 沟通默认**简体中文**；命令示例优先 `pnpm` + bash 风格
## Do Not

- 用教学 Notebook / LanceDB 数字当生产 SLA 或实现抄本
- 静默放宽已冻 ADR；用 npm/yarn 装依赖；再 scaffold 第二 monorepo
- 把 `12-delivery-guides` 当接口契约覆盖 `00–11`
- 暗示「业务已完成」——提交说明写清做了什么 / 未做什么
- 删除或「精简」`prds/00–11` 已冻条款
