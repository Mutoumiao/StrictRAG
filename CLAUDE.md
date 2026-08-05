# Project Instructions · StrictRAG

为精准度而生的**严厉企业知识库 RAG**。宁拒勿妄 · 证据优先。

## 权威分层（冲突时）

三问定位：**WHAT**（语义 / 契约）→ **`prds/00–11/`**（当前 **0.4.32**）；**HOW**（怎么写代码）→ `.trellis/spec/`；**IS**（现在仓库有什么）→ **源码为真**，状态镜像 `docs/module-status/`。

| 优先级 | 路径 | 角色 |
|--------|------|------|
| 1 | **`prds/00–11/`** | **生产 SSOT** |
| 2 | `docs/module-status/` | **IS 镜像**（包完成度 / 默认 mock / 债；**非**契约） |
| 3 | `prds/12-delivery-guides/` | 交付白话 / 开工 / 试点 / 设计（**非**接口契约） |
| 4 | `prds/12-delivery-guides/90-工业级优化思路.md` | 战略（M3+ 须回写 00–11 后生效） |
| 5 | `product.pen` | 设计线稿 |

冲突：冻结语义以 **`prds/00–11`** 为准；**完成度 / 已具备** 以 **源码 + `docs/module-status`** 为准（状态文须能指到证据路径）。  
改冻结语义：ADR → 改 PRD → 升 `prds/README.md` 版本。

---

## 现状（IS）· 模块状态

**入口**：[`docs/module-status/README.md`](./docs/module-status/README.md)  
（能力矩阵 + 包清单 + 成熟度口径；细节在 `docs/module-status/<包>.md`）

| 我要… | 打开 |
|--------|------|
| 端到端某能力齐了吗（入库 / ask / 鉴权 / admin…） | `docs/module-status/README.md` **能力矩阵** |
| 某包已具备 / 未做 / 债 / 证据 | `docs/module-status/<包>.md`（如 `api` · `worker` · `web` · `admin`） |
| 默认 mock / 鉴权开关 / rewrite 关 | 各包「默认依赖模式」+ `apps/*/src/env.ts` |
| 回写状态（task 收尾后） | skill `update-module-status`（**先** update-spec **再** 更 IS） |

**读法约束（防高估）**：

- 「已具备」= 源码可核对；**禁止**仅凭 task/sign-off 抬成熟度  
- 矩阵是导航，**不是**第二套状态 SSOT；细节在包文  
- mock ES、临时双 JWT、`AUTH_ENFORCE` 默认关、rewrite 强制关 → 以包文与 env 为准  
- **可演示 ≠ 生产**；S2 最小 **≠** 全文 Phase 2  
- 冲突裁决：**源码 > module-status 旧文 > task 叙事 > spec 顶部「现状」一句话**

---

## Trellis（Agent 工作流）

本仓由 Trellis 管理。写代码前读对应包规范；任务与交接落在 `.trellis/`：

| 路径 | 用途 |
|------|------|
| `.trellis/workflow.md` | 开发阶段、何时建 task、skill 路由 |
| `.trellis/spec/` | 包/层编码指南（**HOW**；开工前读包 `index.md`，内含 checklist） |
| `.trellis/tasks/` | 进行中与归档 task（PRD、research、jsonl） |
| `.trellis/workspace/` | 开发者 journal / session |

有平台命令时优先：`/trellis:finish-work`、`/trellis:continue` 等。 

---

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|--------|
| Monorepo | pnpm 10 + Turborepo | Node ≥ 20；**仅 pnpm**；版本见 `pnpm-workspace.yaml#catalog` |
| Packages | `@strict-rag/*` | apps 4 + packages 6 |
| admin / web | Next.js | **S2 薄页**已接；非完整运营台 |
| api | Hono + Node | ask 图/SSE 已落；非 CF Workers |
| worker | BullMQ | 入库状态机已落 |
| ORM / PG | Drizzle → PG 16 + pgvector | 唯一 ORM；禁 Prisma |
| Sparse / body / S3 | ES+IK · Mongo · RustFS | 见 `prds/03-data`（**默认 mock**，见 module-status） |
| Queue / graph | Redis · LangGraph.js | ask 状态机见 `prds/04-pipelines` |
| Models / obs | HTTP Gateway · Langfuse · Pino | `prds/07-models` · `08-quality` |

## Project Structure

```text
apps/admin|web|api|worker   → 运营薄壳 / 用户问答 / HTTP / 异步入库
packages/contracts          → biz-code · response · 按域 Zod
packages/admin-catalog      → 权限码 + 菜单（ADR-056）
packages/db                 → Drizzle schema（api+worker 共用）
packages/ui|eslint-config|typescript-config
docs/module-status/         → IS：能力矩阵 + 包级现状（代码镜像）
prds/00–11                  → WHAT：产品…决策 SSOT
prds/12-delivery-guides     → 交付/开工/试点/设计（辅助）
.trellis/                   → HOW workflow · spec · tasks
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
| ADR / 交接 | `prds/11-decisions/` |
| 交付配套 / 控制台 | `prds/12-delivery-guides/README.md` · `04-交付控制台.md` |
| Sprint0 / 垂直切片 | `prds/12-delivery-guides/06-工程开工.md` |
| 编码 HOW | `.trellis/spec/<包>/` |

## Build & Run

```bash
pnpm install
pnpm check-types
pnpm lint
pnpm build | dev          # turbo
# docker compose -f docker/docker-compose.yml up -d
```

目标端口：**web 3005 · admin 3006 · api 4000**；worker 无 HTTP。  
当前进度、默认 mock / 鉴权开关 → 以 `docs/module-status/` 为准（勿据本节推断完成度）。

## Code Style

- TypeScript **strict**；共享 tsconfig：`@strict-rag/typescript-config`
- 依赖版本优先 **`catalog:`**（在 `pnpm-workspace.yaml` 登记）
- Prettier：singleQuote、trailingComma all、printWidth 100
- 包名 `@strict-rag/<name>`；源码 `src/`
- contracts：错误码与 `ApiResponse` 信封只放 `packages/contracts`；**`error.code` = PRD 短名**
- UI：`import { cn } from '@strict-rag/ui/lib/utils'`（子路径导出；现多用 theme.css）
- 写库时间本地格式串（见 ORM PRD）；ID 用 uuid v7
- **禁止** route 内散落 SQL / ES DSL / 长 Prompt（SQL 进 `services/` / repo）；密钥不进 web/admin 包

## Testing

- **命令**：`pnpm test`（turbo → vitest）
- **已有**：`apps/api|worker|web` · `packages/db|contracts|admin-catalog` 同域 `*.test.ts`
- **目标（PRD）**：集成测 + 验收剧本 `prds/10-delivery/03-acceptance-scenarios.md`
- 新增测试与源码同域放置

## Conventions

- **阶段**：P0/P1 入库 + **S2 最小** ask 已落地（epic `08-05-phase-2-ask` 已关）；下一阶段欠账见 `.trellis/tasks/08-05-phase-2-backlog/status.md`（B1/B8…）
- **质量红线**：检索→约束生成→验证→拒答；**min 否决**；合法 draft 必 verify；历史≠evidence；门禁只加严不放宽；双就绪∧active 检索闸
- **状态回写**：实现 → 更新 `.trellis/spec/` → skill `update-module-status` → 交接/提交
- **Git**：建议 conventional commits
- 沟通默认**简体中文**；命令示例优先 `pnpm` + bash 风格

## Do Not

- 用教学 Notebook / LanceDB 数字当生产 SLA 或实现抄本
- 静默放宽已冻 ADR；用 npm/yarn 装依赖；再 scaffold 第二 monorepo
- 把 `12-delivery-guides` 或 `docs/module-status` 当接口契约覆盖 `00–11`
- 用 task/sign-off 叙事覆盖源码或抬高 module-status 成熟度
- 暗示「业务已完成 / 全文 Phase 2 完成 / 生产 ES 已上」——提交说明写清做了什么 / 未做什么
- 删除或「精简」`prds/00–11` 已冻条款
