# 骨架阶段规则（Phase Scaffold）

> 适用：当前仓库状态（`0.0.0` monorepo 骨架）。  
> 权威分期：`prds/10-delivery/01-phased-roadmap.md` · 项目导航：`CLAUDE.md` / `README.md`。

---

## 当前事实（代码实态 · Phase 0/1 后）

| 单元 | 现状 | 证据文件 |
|------|------|----------|
| `apps/api` | Hono 真起服；`/health` `/ready`；P1 入库 API（无鉴权演示） | `apps/api/src/**` |
| `apps/worker` | BullMQ probe + ingest 状态机（scan→…→ready） | `apps/worker/src/**` |
| `apps/admin` / `web` | Next 空壳首页；admin 薄 `/documents` 说明页 | `apps/*/src/app/**` |
| `packages/contracts` | BizCode **PRD 短名**、ApiResponse、Health/Ready、ingest DTO、队列名 | `packages/contracts/src/**` |
| `packages/db` | Drizzle schema + migrate；检索闸 helper | `packages/db/src/**` |
| `packages/ui` | `cn()` + `theme.css` | `packages/ui/src/**` |
| `packages/admin-catalog` | 空 `PERMISSIONS` / `MENU_TREE`（种子待 P2） | `packages/admin-catalog/src/index.ts` |
| `docker/` | PG+Redis 默认；es/mongo/rustfs profile | `docker/docker-compose.yml` |
| 测试 | Vitest：`pnpm test`（api/worker/db 护栏） | `**/vitest.config.ts` |

**未做**：JWT 鉴权、真实 ES/S3 SDK 生产路径、ask/LangGraph。
---

## 允许（骨架 / Phase 0 入口）

在明确做 **Phase 0** 时允许：

- `GET /health` · `GET /ready`（契约形状已在 `HealthResponseSchema` / `ReadyResponseSchema`）
- 各 app 自有 `env.ts`（Zod）；密钥不进前端包
- **配置侧闸**（服务端）：如 tauClaim **唯一来源**校验、`RERANK_MIN_NODES` 分档启动检查——**不是**客户端 options
- `packages/db`：Drizzle schema + migrate 基建
- api/worker 真 dev 起服、Pino 日志骨架
- compose 扩展 ES/Mongo/RustFS（按运维 PRD，非默认真业务）

---

## 禁止（未授权前）

| 禁止 | 原因 |
|------|------|
| 入库流水线（parse/chunk/embed/es_index） | Phase 1 |
| ask / LangGraph / retrieve / generate / verify | Phase 2 |
| JWT 鉴权、成员 ACL、审批业务 | Phase 2+ |
| 在 route 内散落 SQL / ES DSL / 长 Prompt | 架构冻结 |
| 引入 Prisma / TypeORM 并行 | `prds/01-architecture/02-tech-stack-frozen.md` |
| npm / yarn 装依赖；再建第二 monorepo | 工程基线 |
| 把 `prds/12-delivery-guides` 当接口契约覆盖 `00–11` | SSOT 规则 |
| 静默放宽已冻 ADR（如 rerank 跳过仍 answered） | 质量红线 |
| 暗示「业务已完成」 | 提交说明须写清做了/未做 |

---

## 实现任务检查清单

开工前确认：

1. 本任务是否属于 **已批准的 Phase**？  
2. 规格落在哪个 PRD 文件？路径写进 task PRD。  
3. 是否只改 scaffold 允许范围？  
4. 提交信息是否避免「功能已上线」式表述？

---

## 反模式

- **Bad**：在 `placeholder.ts` 旁偷偷加完整页面却声称「仍是骨架」  
- **Bad**：为「演示效果」跳过 verify 或 mock 成 answered  
- **Good**：Phase 0 先打通 health/ready + migrate，再进 Phase 1 入库
