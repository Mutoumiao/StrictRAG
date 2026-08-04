# 骨架阶段规则（Phase Scaffold）

> 适用：当前仓库状态（**Phase 0/1 代码已落地**；Phase 2 **任务已规划、业务编码待授权**）。  
> 权威分期：`prds/10-delivery/01-phased-roadmap.md` · 项目导航：`CLAUDE.md` / `README.md`。  
> Trellis 下一阶段：`08-05-phase-2-ask-design`（硬门）→ `08-05-phase-2-ask`（S2 最小 epic）· 差额 `08-05-phase-2-backlog`。

---

## 当前事实（代码实态 · Phase 0/1 后）

| 单元 | 现状 | 证据文件 |
|------|------|----------|
| `apps/api` | Hono；health/ready；P1 入库；**双 token 身份 + 权限码中间件**（入库默认可不强制登录） | `apps/api/src/**` |
| `apps/worker` | BullMQ probe + ingest 状态机（scan→…→ready） | `apps/worker/src/**` |
| `apps/admin` / `web` | Next 壳；admin 登录+Guard+http 无感 refresh；web 会话层 | `apps/*/src/**` |
| `packages/contracts` | BizCode 短名、信封、Health、ingest、**auth TokenPair**、队列名 | `packages/contracts/src/**` |
| `packages/db` | Drizzle schema + migrate；检索闸 helper | `packages/db/src/**` |
| `packages/ui` | `cn()` + `theme.css` | `packages/ui/src/**` |
| `packages/admin-catalog` | **权限码 + 角色模板 + 菜单树种子** | `packages/admin-catalog/src/**` |
| `docker/` | PG+Redis 默认；es/mongo/rustfs profile | `docker/docker-compose.yml` |
| 测试 | Vitest：api/worker/db + auth 求值/rotation | `**/vitest.config.ts` |

**未做**：Better Auth 生产登录、kb_members 全量、真实 ES/S3 生产路径、ask/LangGraph。  
**已做（薄）**：`AUTH_ENFORCE=true` 时入库路由 `requirePermissionWhenEnforced`；默认 false 保 demo。  
**任务规划**：Phase 2 S2 任务树已创建；**设计评审通过 + 负责人确认前禁止写 ask 业务代码**。

---

## 允许

### 已交付阶段（无需再「申请 Phase 0/1」）

- Phase 0 骨架能力与 Phase 1 **S1 最小入库闭环**（含 mock ES 诚实边界）的维护与修 bug  
- 交付配套文档状态同步（非 `00–11` 契约）  
- Phase 2 **设计文档**（`08-05-phase-2-ask-design`）

### Phase 2 业务编码（须同时满足）

1. `08-05-phase-2-ask-design` 的 `design.md` AC 勾选完成  
2. 负责人确认允许按该设计写 P2 业务代码  
3. 当前 start 的子任务 `meta.blocked_by` 均已完成  

允许范围以子任务 prd 与设计稿为准（S2 最小）；**不等于**路线图 Phase 2 全文（见 `08-05-phase-2-backlog`）。

---

## 禁止

| 禁止 | 原因 |
|------|------|
| 跳过设计闸门写 ask / LangGraph / retrieve / generate / verify | Phase 2 硬门未过 |
| 宣称「全文 Phase 2 / 生产 ES 已上」而实际为 S2 最小或 mock | 签字边界 / 诚实边界 |
| Better Auth 生产身份在无任务/设计时半吊子落地 | 须有收敛设计 |
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
