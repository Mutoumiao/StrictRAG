# api · 质量指南

## 运行时与栈（冻结）

- Node.js ≥ 20 + **Hono**  
- 日志：**Pino**  
- 校验：**Zod**（contracts + 本地 env）  
- ORM：仅经 `@strict-rag/db`  

## 必须遵守

| 规则 | 来源 |
|------|------|
| 禁止 route 内 SQL / ES DSL / 长 Prompt | 架构 PRD |
| 授权 **以码为准** | `requirePermission(code)`；禁止 `roles.includes` 单独放行 |
| 身份与授权分离 | 双 token / Better Auth 只证明身份；码在服务端求值 |
| access JWT | 必须带唯一 `jti`（同秒续签可区分） |
| refresh | 有状态 jti；replay → 吊销整 session |
| 契约 | TokenPair 在 `@strict-rag/contracts`；细节见 [auth-authorization](./auth-authorization.md) |
| ask `options` 白名单 | **仅** stream / debug / mode / locale；禁客户端改 tau 等 |
| ask `scope` | **顶层**可选字段（如 `scope.docTypes`）；**禁止**塞进 `options`（ADR-050） |
| UI ≠ API 授权 | handler **独立验码**；菜单有无改变不了 API |
| admin 壳 | 根中间件验 **`admin.shell`**；无码 → 403/302→web（ADR-045 经 **051** 修订） |
| 租户 | JWT 内 tenant_id，禁止只靠 body |

> 壳准入 **不要**再写 `platform_admin` ∨ KB write/admin。  
> 权威：`prds/05-api` §1.2 · `prds/09-security` §3.5。工程 PRD §4 旧伪代码若未回写，以本表与安全/API PRD 为准。

## 以码为准（ADR-051）

| 规则 | 说明 |
|------|------|
| 求值 | 有效权限码 = 角色模板默认 ∪ grants − denies |
| 平台级 action | 要求对应 platform 码（如 `kb.create`、`user.manage`） |
| KB 内容 | 要求 **kb scope** 码；**`super_admin` 模板显式全权**（可免成员行，须审计） |
| 面板等 | 如 `dashboard.view` 等按安全 PRD 默认与授码 |
| 禁止 | 仅判断 `platform_role` / `kb_members.role` 字符串就放行，跳过 permission code |

码表与模板 SSOT：`@strict-rag/admin-catalog` + `prds/09-security`。

## 已落地阶段（勿回退）

| 阶段 | 能力 |
|------|------|
| P0 | health/ready · env · Pino · requestId · compose 依赖检查 |
| P1 | 入库 API · 审批/体积闸 · worker 入队 |
| S2 最小 | ask 图/SSE · 会话壳 · 反馈 · Gateway 切片 · 检索 mock · 观测骨架 |

S2 细节与错误矩阵见 [ask-pipeline](./ask-pipeline.md)。  
下一刀：按 backlog（B1/B8…）**新建** feature 任务；禁止宣称全文 Phase 2 / 生产 ES。

## 编码风格

- `type: module` · TypeScript strict  
- Prettier 仓库统一  
- 包依赖版本 `catalog:` / `workspace:*`  

## 反模式

- **Bad**：为 demo 在 api 同步跑 embed 全流程占死事件循环  
- **Bad**：引入 Prisma  
- **Bad**：前端可调的 debug 开关关闭 verify  
- **Bad**：admin 壳用旧 ADR-045 role 公式  
- **Bad**：相对 `STORAGE_LOCAL_DIR` 依赖 api 进程 cwd（与 worker 分裂）  
- **Bad**：route 内展开 Prompt / ES DSL；rerank 失败仍 `answered`  
- **Bad**：`SESSION_REWRITE_ENABLED=true` 或把历史当 evidence  
- **Bad**：`RETRIEVE_ES_MODE=mock` 时对外说「生产 ES」  
- **Good**：重活入队 worker；api 只做受理与查询；权限以码为准  
- **Good**：`STORAGE_LOCAL_DIR` 相对路径解析到 monorepo 根  
- **Good**：ask 走 `executeAsk` → `runAskGraph`；同步 DTO ≡ SSE final
