# @strict-rag/api · 模块状态

| 字段 | 内容 |
|------|------|
| 路径 | `apps/api` |
| 端口 | 4000 |
| 成熟度 | **可演示**（P0/P1 入库 + S2 最小问答 + B1–B6 最小运营 API + B10 L1 **工程 seed**；演示依赖 mock ES / mock Gateway；L1 **≠** 业务签字门禁） |
| 默认依赖模式 | ES 检索 = `mock` · 鉴权 = 临时双 JWT（`AUTH_ENFORCE` **默认关闭**）· rewrite = 强制关闭 · 对象存储 = `local` 本地目录 · Gateway 缺 URL→mock；**B3-W** ask 读 platform 绑定（失败回退 env；KB 绑定未做）· JWT **尚未**读取 DB 中的 `user_roles` · **未开启** `DEPT_ACL_ENFORCE` 检索强制 · `ASK_RATE_LIMIT_RPM=0`（限流关闭） · L1 CLI 需显式 `L1_KB_ID`（`turbo.json` 已登记 `L1_*` / `L1_PERSIST_EVAL`） |
| 关联模块 | 入库演示还需要 `worker` + PostgreSQL + Redis；契约来自 `@strict-rag/contracts`，schema 来自 `@strict-rag/db`（含 `eval_runs`）；L1 gold / RACI 在仓根 `fixtures/l1/` |
| 最近更新 | 2026-08-11（OPS-1 live sparse；B3-W Gateway 读 platform 绑定；B10 eval_runs） |
| Spec | `.trellis/spec/api/backend/`（含 [dashboard](../../.trellis/spec/api/backend/dashboard.md) · [l1-eval](../../.trellis/spec/api/backend/l1-eval.md)） |
| PRD | `prds/05-api` · `04-pipelines` · `08-quality` · `09-security` |

## 一句话状态

基于 Hono 的 HTTP 后端：入库 API、临时双 JWT 鉴权、单轮问答图 / **AI SDK UI Message Stream** 流式输出以及会话外壳均已落地；另有 **L1 黄金集工程 seed**（文件 gold + CLI 批跑 `executeAsk(skipTrace)` + 2×2 报告）。检索默认 **mock ES**，鉴权**不是**生产级 IdP；**mock L1 数字禁止当业务签字**。

---

## 已具备能力

### 基础设施
- 健康检查 `/health`、就绪检查 `/ready`（含依赖项检查）、`/metrics` 指标骨架
- request-id 中间件、Pino 日志、环境变量校验
- **ARCH-P0 运行时硬化**：`onError` / `notFound` 统一标准错误信封；PostgreSQL 约束冲突兜底映射；`secureHeaders` 安全头 + 可关闭的 `timeout` 超时中间件（ask 路由除外）+ JSON `bodyLimit` 请求体限制（上传路由除外）；`createDb` 按 api 端配置超时；SIGINT/SIGTERM 信号到来时正确关闭 DB 连接与队列

### 鉴权与权限
- 双 JWT（access token + refresh token）、dev-login 开发登录、`AUTH_ENFORCE` 总开关（默认关闭）
- 知识库成员校验、权限码求值（对接 admin-catalog）
- 成员路由最小集：列表 / 邀请 / 删除；**暂不支持**修改成员角色

### 入库（P1）
- 文档上传、complete 接口的体积闸门、审批通过后才能扫描入库的闸门
- 文档生命周期 API；任务入队后由 worker 消费
- SQL 统一放在 `services/` 层，路由保持轻量

### 分片只读（B1 · ADR-052）
- `GET /documents/:docId/chunks`：返回当前 `indexVersion` 的分片列表，正文做 preview 截断（**不返回完整 body**），支持 cursor/limit 分页
- `GET /documents/:docId/chunks/:chunkId`：返回完整正文（取自 PG 的 `body_text` 字段），按 UTF-8 **64KiB** 软截断
- 始终强制 `requirePermission('chunk.view')` 校验（与 `AUTH_ENFORCE` 开关无关）；`doc_operator` 角色默认返回 403

### 知识库设置（B2 · ADR-054 最小集）
- `GET / PATCH /knowledge-bases/:kbId/settings`：白名单字段为 `name` / `description` / `allowedModes` / `defaultMode`
- 始终强制 `requirePermission('kb.config.write')`；知识库作用域要求调用者是成员（超级管理员可旁路）
- `qualitySnapshot.tauClaim` 只读（取自 `env.TAU_CLAIM`）；`sessionRewrite` 固定锁定为关闭
- 试图写入 τ、`allowDegradedGenerate`、`sessionRewrite*` 等字段一律返回 400；成功的写操作会输出 Pino 日志 `kb_settings_patch` 并记录 diff
- **尚未**在 ask 侧接入 `allowedModes` 闸门（配置可以保存，但 ask 仍固定使用 balanced 模式）

### 模型供应商 / 平台绑定（B3 · ADR-055 最小集）
- `GET / POST / PATCH / DELETE /admin/model-providers`，另有 `GET …/presets` 预设列表
- `GET / PUT /admin/model-bindings`（平台作用域）、`GET /model-catalog`
- 始终强制 `requirePermission('model.gateway.manage')`；GET 响应**永不**回显 `apiKey`，只返回 `hasApiKey` 标志
- 绑定类型校验 + judge 与 judge_aux 不可混用（ADR-042）；删除仍被引用的供应商会返回 400
- 数据表：`model_providers` / `model_bindings`；测试用内存仓库（memory repo）
- **B3-W 已接线**：运行时 `getGatewayForTenant` 读 platform 绑定（env 回退）；**未做**知识库级绑定（B2-W）；**未做**真实的 fetch-models 代理

### 平台用户 / 角色（B4 · ADR-056 最小集）
- `GET / POST / PATCH /admin/users`，`POST …/users/:id/roles` 分配角色
- `GET / POST / PATCH /admin/roles`，`PUT …/roles/:id/permissions` 设置权限码
- `GET /admin/permission-catalog`（需要 `user.manage` **或** `role.perm.manage` 之一）
- 始终做权限码校验；`codes` 必须是 admin-catalog 的子集；最后一个可用的 `super_admin` 被禁用或剥离权限时返回 400；系统内置的 super_admin 角色禁止禁用
- 数据表：`platform_roles` / `user_roles`；内置四个系统角色种子数据；测试用内存仓库
- **B4-W 已接线**：中间件每请求 `hydrateAuthz`（`user_roles` + 启用角色 `codesJson`）；≤5s 进程缓存 + 写路径 `invalidateRoleCache`（**单实例假设**）；dev-login `ensureUserRoleCodes` bootstrap；dev/test 无绑定时回退 JWT claims；**没有**密码字段 / 生产 IdP
- **QUAL-1**：`AUTH_ENFORCE=true` 时 `requirePermissionWhenEnforced` 无 Bearer → 401 `UNAUTHORIZED`（`auth-enforce.redline.test.ts` + `vi.stubEnv`）；**默认仍关**
### 部门组织骨架（B5 · ADR-057 最小集）
- `GET / POST /admin/departments`、`GET …/tree`、`GET / PATCH /DELETE …/:deptId`
- `GET / PUT /admin/users/:userId/departments`（主部门 + 兼任部门 + is_leader 标志）
- 部门树操作需要 `dept.manage` 权限；用户归属操作需要 `user.manage` 权限；始终做权限码校验
- 禁止成环；已禁用的部门不可再挂新用户；删除仍有子部门或仍有用户的部门会返回 400
- 数据表：`departments` / `user_departments`；migration `0005_b5_departments`；测试用内存仓库
- **尚未**通过 `DEPT_ACL_ENFORCE` 对检索 / 预览做部门强制隔离；**没有**文档级 `ownerDeptId` / visibility 过滤；**没有**跨部门授权（cross-grants）

### 数据面板（B6 · 薄壳 · 只读）
- `GET /api/v1/admin/dashboard/summary`：始终 `requirePermission('dashboard.view')`
- 指标 ≤5：`kbCount` / `documentCount` / `pendingApprovalCount` / `processReady`（`runReadyChecks`）/ `askCount24h`（`ask_traces` 24h count）
- SQL 在 `services/dashboard.ts`；memory repo 便于单测；**无**写路径、**无** schema 变更、**≠** APM

### 问答（S2 最小集）
- 同步 ask 接口 + AI SDK UI Message Stream 流式输出（使用 `data-status` / `data-ask-final` 数据部件，**没有**自写的 `event: final` 事件）；采用**线性状态机**（不是 LangGraph.js）：检索 → 约束生成 → 验证 → 拒答，实现见 `graph/run.ts`
- 流式异常处理：`execute` 抛错时仍会写出 `data-status phase=error` 与 `data-ask-final`（`reason=internal_guard`）；有单测覆盖（`routes/ask.test.ts`）
- 会话列表 / 详情外壳（**rewrite 强制关闭**，把 `SESSION_REWRITE_ENABLED` 设为 `true` 会导致启动失败）；list 接口的 query 参数绑定 `SessionListQuerySchema` 校验
- 反馈提交 / 管理队列 API（`routes/feedback`）；queue 接口的 query 参数绑定 `FeedbackQueueQuerySchema` 校验
- Gateway 切片（`GATEWAY_MODE` mock/http；**B3-W/B2-W**：ask 走 `getGatewayForTenant(tenant, kbId)` = env + platform + **KB 覆盖** `model_bindings`；`bindingSource=env|mixed`；缺绑定回退 env；≤5s 缓存；Key 不进日志）
- **B2-W**：ask 入口 `mode∈allowedModes` / `defaultMode`；settings `docTypes` 读写 + scope 子集闸；质量 τ 仍拒写- 检索适配层（RRF 融合 / 打分；`RETRIEVE_ES_MODE` **默认 mock**；`http` = ES BM25 sparse **切片**（`es-sparse.ts` + `ELASTICSEARCH_URL`；缺 URL / ES 失败 loud fail，**禁止**回落 mock）；**不等于**生产 ES+IK / 多租户 Router（B8））
- 观测骨架：进程内 metrics、内存 tracer、ask 限流（`ASK_RATE_LIMIT_RPM` 默认 0 即关闭）、`/metrics` 端点无鉴权
- **P0 红线单测已挂账**（清单见 `docs/testing/p0-redlines.md`；**不是** L1 黄金集评测、**也不是**远程 CI 门禁）：
  - **R7** `filterDocsForRetrieve` / `corpus.test.ts`（生产装载路径；db 包的 `retrieval-gate` 为底层附录）
  - **R8** 生成结果低于阈值被否决时必须拒答（abstained）（`graph.test.ts`）
  - **R9** 正常路径必须经过 verify 环节；负向用例中未完整执行 verify 时不得标记为 answered（同一文件）
  - 关键 `it` 用例标题带 `R#:` 前缀；**不**要求测试内部 stub `AUTH_ENFORCE`

### 评测 L1 工程 seed（B10 · 部分 · ≠ 业务签字）
- 仓根 `fixtures/l1/gold.yaml`：**≥60 题**（answerable 30 + 不可答类 30）；扩展名 yaml、**内容为 JSON**（零 yaml 依赖）；逻辑 `expectedDocIds` 见 `fixtures/l1/README.md`；业务题面 RACI → `fixtures/l1/RACI.md`
- 纯函数 `apps/api/src/eval/l1-matrix.ts`：2×2（A–D）+ `coverage=A/(A+B)`（分母 0→null）；`outcome=error` **不计格**，只增 `errorCount`；单测同目录
- CLI `apps/api/src/scripts/run-l1-golden.ts`：串行 **`executeAsk` + `skipTrace: true`**（可注入 `execute` / `graphDeps`）→ 仓根 `artifacts/l1-last-run.{json,md}`（**gitignore**）；报告含 **`retrieve_mode` / `mode`: mock|live|unknown** + **`signoffEligible`**（仅 live=true；由 `RETRIEVE_ES_MODE` 推导）
- 签字 live profile（OPS-1）：`docs/ops/live-retrieve-profile.md`；探针 `src/scripts/seed-es-sparse-probe.ts`（PG→ES bulk）
- 跑法：`L1_KB_ID=<uuid> pnpm --filter @strict-rag/api exec tsx src/scripts/run-l1-golden.ts`（可选 `L1_MAX_CASES` 等；见 `apps/api/README.md`）
- CI 范围：矩阵纯测 + mock 注入测 + es-sparse 单元测；**默认不**在 CI 跑真 LLM / 真 ES 全量；样例文 `fixtures/l1/sample-report.md`（非 live 签字数字）
- **边界**：**禁止** `retrieve_mode=mock` 的 coverage/A–D 写入业务签字页；`eval_runs` 可 `L1_PERSIST_EVAL=1` 写入（db migration 0006）；无 worker-eval、无 L2/L3；**签字真跑** 待 live∧B3-W（B10-followup 余量）

---

## 明确未做 / 边界

### 本包 API / 运行时未交付

| 项 | 说明 |
|----|------|
| 生产级 ES + IK 分词 / 多租户 | `http` 切片可签字归因（OPS-1）；默认仍 `mock`；**≠** 全文 B8（IK、Router、入库双写） |
| rewrite / 多轮指代消解 | `SESSION_REWRITE_ENABLED` 在 P2 阶段强制为 false；会话历史**不等于**检索证据 |
| CRAG / multi_hop | 未进入本阶段范围 |
| 完整 ACL / 部门强制隔离 | 目前只有 KB 成员校验 + 权限码 + 可配置的组织骨架；**检索仍是成员可见全库**（B5 未开启 DEPT_ACL） |
| 生产 IdP | 仍是临时双 JWT；**B4-W** 已读 `user_roles` hydrate（≠ Better Auth / 密码登录） |

### 其他包的 UI / 产品面挂账（非本包义务）

| 项 | 说明 |
|----|------|
| 知识库设置全量项（docTypes / 分片策略 / KB 级模型绑定）、ask 模式闸门 | B2/B3 最小集已落地；**B3-W** ask 已读 platform `model_bindings`（env 回退）；**KB 级绑定未做**（B2-W） |
| 按历史 indexVersion 浏览分片 | ADR-052 明确 P2 阶段不做 |
| Mongo 作为正文权威存储 | 目前演示读取的是 PG 的 `body_text` 字段；接真 Mongo 见 B9 |
| 跨部门授权、DEPT_ACL 强制 | B5 仅组织壳；ADR-057 检索强制未开 |
| APM / 时序观测大盘 | B6 仅为 `GET /admin/dashboard/summary` 只读计数 + processReady，**不是**观测生产向 |
| 用户端反馈控件 | 本包只提供 feedback **API**；web 端是否接 UI 见 `web.md` |
| L1 业务签字门禁 / live 覆盖率闸 / 真跑数字 | 文件账本 + 可选 `eval_runs` 落库（`L1_PERSIST_EVAL`）；**不**宣称 L1 门禁 PASS；签字真跑见 **B10-followup** 余量 |

---

## 技术债

| 债 | 影响 | 备注 |
|----|------|------|
| 临时双 JWT + 默认不强制鉴权 | 不是生产级身份方案 | 见 auth 相关 PRD / ADR |
| refresh token 存在进程内 Map | 多实例部署或进程重启会丢失 refresh 状态 | `auth/identity/refresh-store.ts` |
| mock sparse 检索 / 本地 storage 路径 | 检索与对象存储都不是真实依赖 | backlog B8 / B9 |
| 观测未接真实 Langfuse | 指标只有可演示级别 | `LANGFUSE_ENABLED` 默认 false |
| `/metrics` 无鉴权 | 生产环境需要网关层保护 | 代码注释已标明；contracts 中没有对应的线型定义 |
| sessions / auth TokenPair / documents status 出口使用 `as` 断言 | 存在 D1 类型漂移面 | 以类型标注为主，未做全量 Schema.parse 校验 |
| L1 业务签字包 / 远程 CI 红线任务 / live 门禁数字 | 工程：gold≥60 + CLI + 2×2 + `eval_runs`（`L1_PERSIST_EVAL`）+ OPS-1 live 切片；**mock 数字禁止签字**；无默认 CI 真 LLM；**无**业务签字真跑归档 | B10 seed `08-09-b10-l1-golden-min` · followup **部分** `08-11-b10-followup-eval-runs`；P0 红线表 ≠ L1；AUTH enforce 测 → **QUAL-1**；HOW → `.trellis/spec/api/backend/l1-eval.md` |

---

## 证据

| 类型 | 指针 |
|------|------|
| 路由挂载 / 错误中间件 | `apps/api/src/app.ts` · `middleware/on-error.ts` · `lib/pg-error.ts` |
| 超时 / 请求体限制 | `middleware/timeout.ts` · `body-limit.ts` · `env.ts`（`API_REQUEST_TIMEOUT_MS` 等） |
| 问答图 / ask 路由 | `apps/api/src/graph/` · `apps/api/src/routes/ask.ts` · `apps/api/src/services/ask/` |
| 会话 / 反馈 | `apps/api/src/routes/sessions.ts` · `routes/feedback.ts` |
| 入库 | `apps/api/src/routes/documents.ts` · `apps/api/src/gates/` |
| 分片只读 | `apps/api/src/routes/chunks.ts` · `services/chunks.ts` · `routes/chunks.test.ts` |
| 知识库设置 | `apps/api/src/routes/kb-settings.ts` · `services/kb-settings.ts` · `routes/kb-settings.test.ts` |
| 模型网关 B3 | `apps/api/src/routes/model-gateway.ts` · `services/model-gateway.ts` · `routes/model-gateway.test.ts` |
| 数据面板 B6 | `apps/api/src/routes/dashboard.ts` · `services/dashboard.ts` · `routes/dashboard.test.ts` |
| 鉴权 / 成员 | `apps/api/src/auth/` · `routes/members.ts` |
| Gateway 运行时 / 检索 | `apps/api/src/services/gateway/`（`getGatewayForTenant` · `bindings.ts` · `resolve.ts`）· `services/retrieve/`（`corpus.ts` · `es-sparse.ts` · `filterDocsForRetrieve`） |
| 观测 | `apps/api/src/obs/` |
| L1 工程 seed / followup 工程 | `fixtures/l1/gold.yaml` · `RACI.md` · `README.md` · `apps/api/src/eval/l1-matrix.ts` · `scripts/run-l1-golden.ts` · `scripts/seed-es-sparse-probe.ts` · `packages/db/src/schema/ask/eval-runs.ts` · `docs/ops/live-retrieve-profile.md` · `turbo.json`（`L1_*` / `L1_PERSIST_EVAL`） |
| 环境变量默认值 | `apps/api/src/env.ts`（`RETRIEVE_ES_MODE=mock` · `AUTH_ENFORCE=false` · `SESSION_REWRITE_ENABLED=false`）；L1 CLI 另读 `L1_KB_ID` 等（**非** `env.ts` Zod 必填） |
| 单测 | `apps/api/src/**/*.test.ts`（含 **dashboard** / eval/l1 / ask / chunks 等） |
| P0 红线 | `docs/testing/p0-redlines.md` · `services/retrieve/corpus.test.ts`（R7）· `graph/graph.test.ts`（R8/R9） |
| Task（B1） | `.trellis/tasks/archive/2026-08/08-06-b1-chunk-readonly/` |
| Task（B2） | `archive/…/08-07-b2-kb-settings/` |
| Task（B3） | `.trellis/tasks/08-07-b3-model-providers/`（完成后归档） |
| Task（B10 部分） | `.trellis/tasks/08-09-b10-l1-golden-min/`（工程 seed；**未**标业务完成） |
| Task（B6 薄 · 归档） | `.trellis/tasks/archive/2026-08/08-09-b6-dashboard-shell/` · 证据见上「数据面板 B6」 |
| Task（已归档） | `.trellis/tasks/archive/2026-08/08-05-phase-2-ask/` · 子任务 `08-05-p2-*` 同目录 |
| 签字记录（已归档） | `.trellis/tasks/archive/2026-08/08-05-phase-2-ask/sign-off.md` |
| 总 backlog | `.trellis/tasks/08-06-project-backlog/status.md`（B6 已完成薄 · B10 部分 · B10-followup） |
| 产品挂账（已归档） | `.trellis/tasks/archive/2026-08/08-05-phase-2-backlog/status.md`（B1–B11） |
| 工程规范（HOW） | `.trellis/spec/api/backend/ask-pipeline.md` · **`dashboard.md`** · **`l1-eval.md`** |
