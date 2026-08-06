# @strict-rag/api · 模块状态

| 字段 | 内容 |
|------|------|
| 路径 | `apps/api` |
| 端口 | 4000 |
| 成熟度 | **可演示**（P0/P1 入库 + S2 最小 ask；演示依赖 mock ES/Gateway） |
| 默认依赖模式 | ES=`mock` · auth=临时双 JWT（`AUTH_ENFORCE` **默认 false**）· rewrite=强制关 · storage=`local` · Gateway 缺 URL→mock · `ASK_RATE_LIMIT_RPM=0` |
| 关联模块 | 入库演示另需 `worker` + PG + Redis；契约 `@strict-rag/contracts` · schema `@strict-rag/db` |
| 最近更新 | 2026-08-05 |
| Spec | `.trellis/spec/api/backend/` |
| PRD | `prds/05-api` · `04-pipelines` · `09-security` |

## 一句话

Hono HTTP 后端：入库 API、临时双 JWT 鉴权、单轮 ask 图/SSE 与会话壳均已落地；检索默认 **mock ES**，鉴权 **非** 生产 IdP。

---

## 已具备能力

### 基础设施
- `/health` · `/ready`（含依赖检查）· `/metrics` 骨架
- request-id 中间件 · Pino 日志 · env 校验

### 鉴权与权限
- 双 JWT（access + refresh）· dev-login · `AUTH_ENFORCE` 开关（默认关）
- KB 成员校验 · 权限码求值（对接 admin-catalog）
- 成员路由（最小：list / invite / delete；**无** role 更新）

### 入库（P1）
- 文档上传 / complete 体积闸 · 审批 scan 闸
- 文档生命周期 API；入队 worker 消费
- SQL 在 `services/`，路由薄

### 问答（S2 最小）
- 同步 ask + SSE；**线性状态机**（非 LangGraph.js）：检索 → 约束生成 → 验证 → 拒答（`graph/run.ts`）
- 会话列表/详情壳（**rewrite 强制关**，`SESSION_REWRITE_ENABLED=true` 启动失败）
- 反馈提交/管理队列 API（`routes/feedback`）
- Gateway 切片（`GATEWAY_MODE` mock/http；缺 URL→mock client）
- 检索适配层（RRF/打分；`RETRIEVE_ES_MODE` **默认 mock**；`http` **运行即拒** `not implemented`，≠ 生产 ES）
- 观测骨架：进程内 metrics · memory tracer · ask 限流（`ASK_RATE_LIMIT_RPM` 默认 0=关）· `/metrics` 无鉴权

---

## 明确未做 / 边界

### 本包 API / 运行时未交付

| 项 | 说明 |
|----|------|
| 生产 ES+IK 检索 | `RETRIEVE_ES_MODE` 默认 `mock`；有 `http` 枚举但 **≠** 已宣称生产 ES（backlog B8） |
| rewrite / 多轮指代 | `SESSION_REWRITE_ENABLED` P2 强制 false；会话历史 ≠ evidence |
| CRAG / multi_hop | 未进本阶段 |
| 完整 ACL / 部门隔离 | 仅 KB 成员 + 权限码骨架 |
| 生产 IdP / 全量用户体系 | 临时双 JWT + dev-login |

### 他包 UI / 产品面挂账（非本包义务）

| 项 | 说明 |
|----|------|
| 分片全文 / KB 设置 / 供应商全 UI | backlog B1–B3；UI 在 admin/web，本包未必已有完整对应 API |
| 数据面板 · 部门壳 · 全量角色 UI | B4–B6；见 admin 与 backlog |
| 用户端反馈控件 | 本包有 feedback **API**；web 是否接 UI 见 `web.md` |

---

## 技术债

| 债 | 影响 | 备注 |
|----|------|------|
| 临时双 JWT + 默认不 enforce | 非生产身份 | 见 auth 相关 PRD/ADR |
| refresh 进程内 Map | 多实例/重启丢 refresh | `auth/identity/refresh-store.ts` |
| mock sparse / 本地 storage 路径 | 检索与对象存储不真 | backlog B8/B9 |
| 观测未接真 Langfuse | 可演示级指标 | `LANGFUSE_ENABLED` 默认 false |
| `/metrics` 无鉴权 | 生产需网关保护 | 注释已标明 |
| 集成测 / 黄金集门禁 | 以单测为主 | backlog B10 |

---

## 证据

| 类型 | 指针 |
|------|------|
| 路由挂载 | `apps/api/src/app.ts` |
| 图 / ask | `apps/api/src/graph/` · `apps/api/src/routes/ask.ts` · `apps/api/src/services/ask/` |
| 会话 / 反馈 | `apps/api/src/routes/sessions.ts` · `routes/feedback.ts` |
| 入库 | `apps/api/src/routes/documents.ts` · `apps/api/src/gates/` |
| 鉴权 / 成员 | `apps/api/src/auth/` · `routes/members.ts` |
| Gateway / 检索 | `apps/api/src/services/gateway/` · `services/retrieve/` |
| 观测 | `apps/api/src/obs/` |
| env 默认 | `apps/api/src/env.ts`（`RETRIEVE_ES_MODE=mock` · `AUTH_ENFORCE=false` · `SESSION_REWRITE_ENABLED=false`） |
| 单测 | `apps/api/src/**/*.test.ts`（ask / graph / retrieve / members / feedback / sessions / obs 等） |
| Task（归档） | `.trellis/tasks/archive/2026-08/08-05-phase-2-ask/` · 子任务 `08-05-p2-*` 同目录 |
| 签字（归档） | `.trellis/tasks/archive/2026-08/08-05-phase-2-ask/sign-off.md` |
| 总 backlog | `.trellis/tasks/08-06-project-backlog/status.md`（ARCH / 穿插） |
| 产品挂账（归档） | `.trellis/tasks/archive/2026-08/08-05-phase-2-backlog/status.md`（B1–B11） |
| HOW | `.trellis/spec/api/backend/ask-pipeline.md` |
