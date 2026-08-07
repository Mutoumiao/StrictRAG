# @strict-rag/api · 模块状态

| 字段 | 内容 |
|------|------|
| 路径 | `apps/api` |
| 端口 | 4000 |
| 成熟度 | **可演示**（P0/P1 入库 + S2 最小 ask + B1–B4 最小运营 API；演示依赖 mock ES/Gateway） |
| 默认依赖模式 | ES=`mock` · auth=临时双 JWT（`AUTH_ENFORCE` **默认 false**）· rewrite=强制关 · storage=`local` · Gateway 缺 URL→mock（**仍 env，未读 DB 绑定**）· JWT **未**读 DB `user_roles` · `ASK_RATE_LIMIT_RPM=0` |
| 关联模块 | 入库演示另需 `worker` + PG + Redis；契约 `@strict-rag/contracts` · schema `@strict-rag/db` |
| 最近更新 | 2026-08-07 |
| Spec | `.trellis/spec/api/backend/` |
| PRD | `prds/05-api` · `04-pipelines` · `09-security` |

## 一句话

Hono HTTP 后端：入库 API、临时双 JWT 鉴权、单轮 ask 图 / **AI SDK UI Message Stream** 与会话壳均已落地；检索默认 **mock ES**，鉴权 **非** 生产 IdP。

---

## 已具备能力

### 基础设施
- `/health` · `/ready`（含依赖检查）· `/metrics` 骨架
- request-id 中间件 · Pino 日志 · env 校验
- **ARCH-P0 运行时硬化**：`onError`/`notFound` 标准信封 · PG 约束兜底映射 · `secureHeaders` + 可关 `timeout`（ask except）+ JSON `bodyLimit`（上传 except）· `createDb` api 分端超时 · SIGINT/SIGTERM 关 DB/Queue

### 鉴权与权限
- 双 JWT（access + refresh）· dev-login · `AUTH_ENFORCE` 开关（默认关）
- KB 成员校验 · 权限码求值（对接 admin-catalog）
- 成员路由（最小：list / invite / delete；**无** role 更新）

### 入库（P1）
- 文档上传 / complete 体积闸 · 审批 scan 闸
- 文档生命周期 API；入队 worker 消费
- SQL 在 `services/`，路由薄

### 分片只读（B1 · ADR-052）
- `GET /documents/:docId/chunks`：当前 `indexVersion` · preview 截断 · **无 body** · cursor/limit
- `GET /documents/:docId/chunks/:chunkId`：全文 body（PG `body_text`）· UTF-8 **64KiB** 软截断
- 始终 `requirePermission('chunk.view')`（与 AUTH_ENFORCE 无关）；doc_operator 默认 403

### 知识库设置（B2 · ADR-054 最小）
- `GET/PATCH /knowledge-bases/:kbId/settings`：白名单 `name`/`description`/`allowedModes`/`defaultMode`
- 始终 `requirePermission('kb.config.write')`；kb scope 须成员（超管旁路）
- `qualitySnapshot.tauClaim` 只读（← `env.TAU_CLAIM`）；`sessionRewrite` 固定锁关
- 禁写 τ / `allowDegradedGenerate` / `sessionRewrite*` 等 → 400；可写变更 Pino `kb_settings_patch` + diff
- **未**接 ask 侧 `allowedModes` 闸（配置可存；ask 仍默认 balanced）

### 模型供应商 / 平台绑定（B3 · ADR-055 最小）
- `GET/POST/PATCH/DELETE /admin/model-providers` · `GET …/presets`
- `GET/PUT /admin/model-bindings`（平台 scope）· `GET /model-catalog`
- 始终 `requirePermission('model.gateway.manage')`；GET **永不**回显 `apiKey`（`hasApiKey`）
- 绑定类型闸 + judge≠judge_aux（ADR-042）；删除仍被引用的 Provider → 400
- 表 `model_providers` / `model_bindings`；测例 memory repo
- **未**接 Gateway 运行时读 DB；**未** KB 级 bindings；**未**真 fetch-models 代理

### 平台用户 / 角色（B4 · ADR-056 最小）
- `GET/POST/PATCH /admin/users` · `POST …/users/:id/roles`
- `GET/POST/PATCH /admin/roles` · `PUT …/roles/:id/permissions`
- `GET /admin/permission-catalog`（`user.manage` **或** `role.perm.manage`）
- 始终验码；`codes` ⊆ admin-catalog；最后 active `super_admin` 禁用/剥权 → 400；禁禁用系统 super_admin 角色
- 表 `platform_roles` / `user_roles`；种子四系统角色；测例 memory repo
- **未** JWT/dev-login 读 DB 角色；**无**密码字段 / bootstrap env；**无**部门归属

### 问答（S2 最小）
- 同步 ask + AI SDK UI Message Stream（`data-status` / `data-ask-final`，**无**自写 `event: final`）；**线性状态机**（非 LangGraph.js）：检索 → 约束生成 → 验证 → 拒答（`graph/run.ts`）
- 流异常：`execute` 抛错时仍写 `data-status phase=error` + `data-ask-final`（`reason=internal_guard`）；单测覆盖（`routes/ask.test.ts`）
- 会话列表/详情壳（**rewrite 强制关**，`SESSION_REWRITE_ENABLED=true` 启动失败）；list query 绑 `SessionListQuerySchema`
- 反馈提交/管理队列 API（`routes/feedback`）；queue query 绑 `FeedbackQueueQuerySchema`
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
| 完整 ACL / 部门隔离 | 仅 KB 成员 + 权限码骨架；B4 无部门（B5） |
| 生产 IdP / JWT 消费 DB 角色 | 临时双 JWT + dev-login roleTemplate；B4 管理面已落，登录未读 `user_roles` |

### 他包 UI / 产品面挂账（非本包义务）

| 项 | 说明 |
|----|------|
| KB 设置全文（docTypes/分片/KB 模型绑定）· ask mode 闸 · Gateway 读 DB | B2/B3 最小已落；ask 仍 env Gateway；KB 绑定未做 |
| 历史 indexVersion 分片浏览 | ADR-052 明确 P2 不做 |
| Mongo 权威 body | 现读 PG `body_text` 演示字段；真 Mongo → B9 |
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
| `/metrics` 无鉴权 | 生产需网关保护 | 注释已标明；无 contracts 线型 |
| sessions / auth TokenPair / documents status 出口 `as` | D1 漂移面 | 类型标注为主；非全量 Schema.parse |
| 集成测 / 黄金集门禁 | 以单测为主 | backlog B10 |

---

## 证据

| 类型 | 指针 |
|------|------|
| 路由挂载 / 错误中间件 | `apps/api/src/app.ts` · `middleware/on-error.ts` · `lib/pg-error.ts` |
| 超时 / 体限 | `middleware/timeout.ts` · `body-limit.ts` · `env.ts`（`API_REQUEST_TIMEOUT_MS` 等） |
| 图 / ask | `apps/api/src/graph/` · `apps/api/src/routes/ask.ts` · `apps/api/src/services/ask/` |
| 会话 / 反馈 | `apps/api/src/routes/sessions.ts` · `routes/feedback.ts` |
| 入库 | `apps/api/src/routes/documents.ts` · `apps/api/src/gates/` |
| 分片只读 | `apps/api/src/routes/chunks.ts` · `services/chunks.ts` · `routes/chunks.test.ts` |
| 知识库设置 | `apps/api/src/routes/kb-settings.ts` · `services/kb-settings.ts` · `routes/kb-settings.test.ts` |
| 模型网关 B3 | `apps/api/src/routes/model-gateway.ts` · `services/model-gateway.ts` · `routes/model-gateway.test.ts` |
| 鉴权 / 成员 | `apps/api/src/auth/` · `routes/members.ts` |
| Gateway 运行时 / 检索 | `apps/api/src/services/gateway/`（env）· `services/retrieve/` |
| 观测 | `apps/api/src/obs/` |
| env 默认 | `apps/api/src/env.ts`（`RETRIEVE_ES_MODE=mock` · `AUTH_ENFORCE=false` · `SESSION_REWRITE_ENABLED=false`） |
| 单测 | `apps/api/src/**/*.test.ts`（ask / graph / retrieve / chunks / kb-settings / members / feedback / sessions / obs 等） |
| Task（B1） | `.trellis/tasks/archive/2026-08/08-06-b1-chunk-readonly/` |
| Task（B2） | `archive/…/08-07-b2-kb-settings/` |
| Task（B3） | `.trellis/tasks/08-07-b3-model-providers/`（完成后 archive） |
| Task（归档） | `.trellis/tasks/archive/2026-08/08-05-phase-2-ask/` · 子任务 `08-05-p2-*` 同目录 |
| 签字（归档） | `.trellis/tasks/archive/2026-08/08-05-phase-2-ask/sign-off.md` |
| 总 backlog | `.trellis/tasks/08-06-project-backlog/status.md`（ARCH / 穿插） |
| 产品挂账（归档） | `.trellis/tasks/archive/2026-08/08-05-phase-2-backlog/status.md`（B1–B11） |
| HOW | `.trellis/spec/api/backend/ask-pipeline.md` |
