# @strict-rag/api · 模块状态

| 字段 | 内容 |
|------|------|
| 路径 | `apps/api` |
| 端口 | 4000 |
| 成熟度 | **可演示**（已包含：P0/P1 入库 + S2 最小问答 + B1–B6 最小运营 API + B10 L1 工程 seed + B12 策略闸 + B13 反馈 API；演示依赖 mock ES / 通常走 mock Gateway；L1 **≠** 业务签字门禁） |
| 默认依赖模式 | 检索：`RETRIEVE_ES_MODE=mock`（默认 mock ES）；鉴权：临时双 JWT，`AUTH_ENFORCE` **默认 `false`**；rewrite：`SESSION_REWRITE_ENABLED` 默认 false，设为 **true 会启动失败**；对象存储：`local`（`STORAGE_LOCAL_DIR=.data/objects`）；Gateway：`GATEWAY_MODE=''`（空按 `GATEWAY_BASE_URL` 推断，缺 URL 走 mock）；上传上限 `INGEST_MAX_FILE_BYTES=52_428_800`（50 MiB）/ 天花板 `INGEST_MAX_FILE_BYTES_CEILING=209_715_200`（200 MiB）；`LANGFUSE_ENABLED=false`；`OBS_MEMORY_TRACE=true`。**B3-W/B2-W**：ask 读取 platform 绑定 + **KB scope 绑定覆盖（只读 list，无 PUT KB 绑定 HTTP）**；**B4-W**：每请求从 DB `user_roles` hydrate；**无** `DEPT_ACL_ENFORCE` env；`ASK_RATE_LIMIT_RPM=0`；L1 CLI 需显式指定 `L1_KB_ID`（可选 `L1_PERSIST_EVAL`） |
| 关联模块 | 入库演示还需要 `worker` + PostgreSQL + Redis；契约 `@strict-rag/contracts`（含 `IMPLEMENTED_CHUNK_STRATEGIES` / `IngestJobData`）；schema `@strict-rag/db`（含 `eval_runs`）；L1 gold / RACI 在仓根 `fixtures/l1/`；L2 题面草案在 `fixtures/l2/` |
| 最近更新 | 2026-08-15（**P2.5-L2** 多轮题面草案 + `eval/l2-gold` 加载器；rewrite 仍关；**≠** L2 准出） |
| Spec | `.trellis/spec/api/backend/`（含 [dashboard](../../.trellis/spec/api/backend/dashboard.md) · [l1-eval](../../.trellis/spec/api/backend/l1-eval.md) · [l2-eval](../../.trellis/spec/api/backend/l2-eval.md)） |
| PRD | `prds/05-api` · `04-pipelines` · `08-quality` · `09-security` |

## 一句话状态

基于 Hono 的 HTTP 后端：入库 API、临时双 JWT 鉴权、单轮问答图 / **AI SDK UI Message Stream** 流式输出以及会话外壳均已落地；另有 **L1 黄金集工程 seed**（文件 gold + CLI 批跑 `executeAsk(skipTrace)` + 2×2 报告）与 **L2 多轮题面草案**（`fixtures/l2/` + 纯函数加载；**无** runner / **无** 准出）。检索默认 **mock ES**，鉴权**不是**生产级 IdP；**mock L1 数字禁止当业务签字**；**rewrite 仍关**。

---

## 已具备能力

### 基础设施
- 健康检查 `/health`、就绪检查 `/ready`（含依赖项检查）、`/metrics` 指标骨架
- request-id 中间件、Pino 日志、环境变量校验
- **ARCH-P0 运行时硬化**：`onError` / `notFound` 统一返回标准错误信封；PostgreSQL 约束冲突做兜底映射；`secureHeaders` 安全头 + 可关闭的 `timeout` 超时中间件（ask 路由除外）+ JSON `bodyLimit` 请求体限制（上传路由除外）；`createDb` 按 api 端配置超时；收到 SIGINT/SIGTERM 时优雅关闭 DB 连接与队列
- **ARCH-P1b-2 管理写操作日志**：`middleware/admin-write-audit.ts` 在 auth 之后，对成员 / 审批 / lifecycle / `/admin/*` 写 / KB settings PATCH 打 `event:admin_write` 日志（Pino；**不**落审计表；排除 GET / ask / auth）
- **ARCH-P2-1 OpenAPI + Scalar（dev）**：`openapi/document.ts` 从 `@strict-rag/contracts` Zod `toJSONSchema` 生成 OpenAPI 3.1；提供 `GET /api/v1/openapi.json` · `GET /api/v1/docs`（Scalar CDN）；`OPENAPI_DOCS_ENABLED` 未设置时 development|test 默认开、staging|production 默认关。**≠** 全路径覆盖 · **≠** OpenAPIHono 重写 route · **≠** 生产 swagger 发布流水线
- **ARCH-P1a documents 域目录试点**：`routes/documents/`（`index.ts` 导出 `documentRoutes` · `mappers.ts` 纯映射）；`app.ts` 挂载方式不变。**≠** 其它域全量搬家 · **≠** URL / 契约变更

### 鉴权与权限
- 双 JWT（access token + refresh token）、dev-login 开发登录、`GET /api/v1/auth/me`（当前主体 + 有效权限码）、`AUTH_ENFORCE` 总开关（默认关闭）
- 知识库成员校验、权限码求值（对接 admin-catalog）
- **ARCH-P1b-1 KB 作用域组合**：`auth/kb-scope.ts` 在请求内缓存成员信息；`requireKbScope` 组合入口；`evaluateKbMember` / `checkPermission({ kbId })` 供 handler 使用；feedback 不做私有 assert；**默认 AUTH_ENFORCE 仍关**
- 成员路由最小集：列表 / 邀请 / 删除；**暂不支持**修改成员角色

### 入库（P1）+ 分片策略闸（B12）
- `POST /knowledge-bases` 创建知识库（`kb.create`）；文档上传（`upload-url` + `PUT /api/v1/internal/objects` local 落体）、complete 体积闸门、`POST …/documents/:docId/approve` / `POST …/documents/:docId/reject` 审批族（`approval.decide`）、审批通过后才能 scan 入队的闸门；lifecycle / reindex / 列表详情
- **B12**：`services/chunk-strategies.ts` 对齐 contracts，**`IMPLEMENTED` 仅 `structure_paragraph`**（KNOWN 另含 roadmap 码）
  - complete：多策略 catalog 且文档尚无既有策略时，body **必带** implemented `chunkStrategy`
  - reindex：catalog length>1 时**必带** `chunkStrategy`；未实现码返回 400（**不**静默 default）
  - **无** HTTP「策略 catalog 列表」路由（仅进程内注册表）
- 入队：`services/queue.ts` → BullMQ `QUEUE_NAMES.INGEST`（`sr-ingest`）；payload 为 contracts `IngestJobData`；`attempts=3` · backoff 2000ms
- SQL 集中在 `services/`；路由保持轻量

### 分片只读（B1 · ADR-052）
- `GET /documents/:docId/chunks`：返回当前 `indexVersion` 的分片列表，正文做 preview 截断（**不返回完整 body**），支持 cursor/limit 分页
- `GET /documents/:docId/chunks/:chunkId`：返回完整正文（取自 PG 的 `body_text` 字段），按 UTF-8 **64KiB** 软截断
- 始终强制 `requirePermission('chunk.view')` 校验（与 `AUTH_ENFORCE` 开关无关）；`doc_operator` 角色默认返回 403

### 知识库设置（B2 · ADR-054 · B2-W 接线）
- `GET / PATCH /knowledge-bases/:kbId/settings`：白名单 `name` / `description` / `allowedModes` / `defaultMode` / **`docTypes`**
- 始终强制 `requirePermission('kb.config.write')`；知识库作用域要求调用者是成员（超级管理员可旁路）
- `qualitySnapshot.tauClaim` 只读（取自 `env.TAU_CLAIM`）；`sessionRewrite` 固定锁定为关闭
- 试图写入 τ、`allowDegradedGenerate`、`sessionRewrite*` 等字段一律返回 400；成功的写操作会输出 Pino 日志 `kb_settings_patch` 并记录 diff
- **B2-W 已接线**：ask 入口校验 `mode∈allowedModes` / `defaultMode`；`docTypes` scope 子集闸；Gateway **读** KB scope 绑定覆盖（**无** KB 绑定 HTTP 写；admin 写 UI 仍可延后）

### 模型供应商 / 平台绑定（B3 · ADR-055 最小集）
- `GET / POST / PATCH / DELETE /admin/model-providers`（另含 `GET …/:id` 单查 + `GET …/presets` 预设列表）
- `GET / PUT /admin/model-bindings`（平台作用域）、`GET /model-catalog`
- 始终强制 `requirePermission('model.gateway.manage')`；GET 响应**永不**回显 `apiKey`，只返回 `hasApiKey` 标志
- 绑定类型校验，judge 与 judge_aux 不可混用（ADR-042）；删除仍被引用的供应商会返回 400
- 数据表：`model_providers` / `model_bindings`；测试用内存仓库（memory repo）
- **B3-W/B2-W**：运行时 `getGatewayForTenant(tenant, kbId)` = env + platform + **DB 中 scope=kb 绑定覆盖（走 `listKbBindings` 读路径）**；`bindingSource=env|db|mixed`；失败回退 env；≤5s 缓存
- **无** `PUT` KB scope 绑定的 HTTP 写 API（admin 写路径仅 **platform** bindings）；**未做**真实 fetch-models 上游代理

### 平台用户 / 角色（B4 · ADR-056 最小集）
- `GET / POST / PATCH /admin/users`（另含 `GET …/:userId` 单查），`POST …/users/:id/roles` 分配角色
- `GET / POST / PATCH /admin/roles`（另含 `GET …/:roleId` 单查），`PUT …/roles/:id/permissions` 设置权限码
- `GET /admin/permission-catalog`（需要 `user.manage` **或** `role.perm.manage` 之一）
- 始终做权限码校验；`codes` 必须是 admin-catalog 的子集；最后一个可用的 `super_admin` 被禁用或剥离权限时返回 400；系统内置的 super_admin 角色禁止禁用
- 数据表：`platform_roles` / `user_roles`；内置四个系统角色种子数据；测试用内存仓库
- **B4-W 已接线**：中间件每请求 `hydrateAuthz`（读取 `user_roles` + 启用角色 `codesJson`）；进程缓存 TTL **5s**；loader 超时 **3s** 时回退 JWT claims（`role-hydrate.ts`）；写路径 `invalidateRoleCache`（**单实例假设**）；dev-login `ensureUserRoleCodes` bootstrap；dev/test 无绑定时回退 claims；**没有**密码字段 / 生产 IdP
- **QUAL-1**：`AUTH_ENFORCE=true` 时 `requirePermissionWhenEnforced` 无 Bearer → 401 `UNAUTHORIZED`（`auth-enforce.redline.test.ts`）；**默认仍关**
- 权限运行时实况：**`codes_json` 过渡**（非 PRD 理想三表）；终态迁表须 ADR

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
- **纯规则路由**（`graph/route-rules.ts`）：寒暄白名单 + 后置禁词 + 知识向线索 → `chitchat` / `single`（P2 不依赖 LLM 路由）；随后**线性状态机**（不是 LangGraph.js）：检索 → 约束生成 → 验证 → 拒答，实现见 `graph/run.ts`
- 同步 ask 接口 + AI SDK UI Message Stream 流式输出（使用 `data-status` / `data-ask-final` 数据部件，**没有**自写的 `event: final` 事件）
- 流式异常处理：`execute` 抛错时仍会写出 `data-status phase=error` 与 `data-ask-final`（`reason=internal_guard`）；有单测覆盖（`routes/ask.test.ts`）
- 会话：`POST …/sessions` 创建 + 列表 / 详情外壳（**rewrite 强制关闭**，把 `SESSION_REWRITE_ENABLED` 设为 `true` 会导致启动失败）；list 接口的 query 参数绑定 `SessionListQuerySchema` 校验
- ask 结果落库 `ask_traces`（evidence_snapshot / graph_trace / config_snap；`rewriteUsed` 恒 0），`services/ask/traces.ts`
- 反馈提交 / 管理队列 API（`routes/feedback`）；queue 接口的 query 参数绑定 `FeedbackQueueQuerySchema` 校验
- Gateway 切片（`GATEWAY_MODE` mock/http；ask 走 `getGatewayForTenant`；Key 不进日志）；rerank 双节点：`GATEWAY_RERANK_FALLBACK_URL` + `RERANK_MIN_NODES`（staging/prod 默认 2；`services/gateway/resolve.ts`；QUAL-3 测）
- **B2-W**：ask 入口校验 `mode∈allowedModes` / `defaultMode`；settings `docTypes` 读写 + scope 子集闸；τ 字段仍拒绝写入
- 检索适配层（dense∥sparse → RRF → rerank；`RETRIEVE_ES_MODE` **默认 mock**；`http` = ES BM25 sparse **切片**（`es-sparse.ts`；缺 URL / ES 失败时显式报错（loud fail），**禁止**回落 mock）；**不等于**生产 ES+IK / 多租户 Router（B8））
- 观测骨架：进程内 metrics、内存 tracer、ask 限流（`ASK_RATE_LIMIT_RPM` 默认 0 即关闭）、`/metrics` 端点**无鉴权**（生产保护策略见 `docs/ops/rate-limit-and-metrics.md` · ARCH-P2-4；**≠** 把进程内全局限流当生产方案）
- **P0 红线单测已挂账**（清单见 `docs/testing/p0-redlines.md`；**不是** L1 黄金集评测、**也不是**远程 CI 门禁）：
  - **R7** `filterDocsForRetrieve` / `corpus.test.ts`（生产装载路径；db 包的 `retrieval-gate` 为底层附录）
  - **R8** 生成结果低于阈值被否决时必须拒答（abstained）（`graph.test.ts`）
  - **R9** 正常路径必须经过 verify 环节；负向用例中未完整执行 verify 时不得标记为 answered（同一文件）
  - 关键 `it` 用例标题带 `R#:` 前缀；**不**要求测试内部 stub `AUTH_ENFORCE`

### 评测 L1 工程 seed（B10 · 部分 · ≠ 业务签字）
- 仓根 `fixtures/l1/gold.yaml`：**≥60 题**（answerable 30 + 不可答类 30）；扩展名 yaml、**内容为 JSON**（零 yaml 依赖）；逻辑 `expectedDocIds` 见 `fixtures/l1/README.md`；业务题面 RACI → `fixtures/l1/RACI.md`
- 纯函数 `apps/api/src/eval/l1-matrix.ts`：2×2（A–D）+ `coverage=A/(A+B)`（分母 0→null）；`outcome=error` **不计格**，只增 `errorCount`；单测同目录
- CLI `apps/api/src/scripts/run-l1-golden.ts`：串行 **`executeAsk` + `skipTrace: true`**（可注入 `execute` / `graphDeps`）→ 仓根 `artifacts/l1-last-run.{json,md}` + **`l1-gate-snapshot.json`**（**gitignore**）；报告含 **`retrieve_mode` / `mode`** + **`answerableCount` / `unanswerableClassCount`** + **`signoffEligible`**（`live` ∧ 两类各≥30；截断/mock=false）+ ADR-046 `gateSnapshot`/`gateVerdict`
- 签字 live profile（OPS-1）：`docs/ops/live-retrieve-profile.md`；探针 `src/scripts/seed-es-sparse-probe.ts`（PG→ES bulk）
- 跑法：`L1_KB_ID=<uuid> pnpm --filter @strict-rag/api exec tsx src/scripts/run-l1-golden.ts`（可选 `L1_MAX_CASES` 等；见 `apps/api/README.md`）
- CI 范围：矩阵纯测 + mock 注入测 + es-sparse 单元测；**默认不**在 CI 跑真 LLM / 真 ES 全量；样例文 `fixtures/l1/sample-report.md`（非 live 签字数字）
- **边界**：**禁止**把 `retrieve_mode=mock` 或 coverage=0 / 全 `internal_guard` 写入业务签字页；`eval_runs` 可 `L1_PERSIST_EVAL=1` 写入（db migration 0006）；无 worker-eval、无 L3；**签字真跑数字** 2026-08-14 live ×2 已落（B10-followup）；ADR-046 快照绑定已落（`eval/adr046-snapshot.ts`）；业务 PASS 仍须人签（本跑 `businessPass=false`）

### 评测 L2 题面草案（P2.5-L2 · 部分 · ≠ 准出）
- 仓根 `fixtures/l2/gold.yaml`：**≥15** 条多轮剧本；`run_type=session_multiturn`；`signoffEligible=false`；扩展名 yaml、**内容为 JSON**；9 类各至少 1 条（含 `session_isolation` / J2x）
- 纯函数 `apps/api/src/eval/l2-gold.ts`：`loadL2Gold` + `l2TypeCoverage`；错误类 `L2GoldLoadError`；单测同目录加载真实 gold
- 语料草案 `fixtures/l2/corpus/`（travel-stay / meal-allowance / leave-policy）；**未**走 worker 入库
- 说明：`fixtures/l2/README.md` · 未跑模板 `sample-report.md` · owner 占位 `RACI.md`（待指派）
- **边界**：无 `run-l2-golden.ts`、无 `eval_runs` 多轮账本、**rewrite 仍关**；**禁止**把草案条数当 L2 通过

---

## 明确未做 / 边界

### 本包 API / 运行时未交付

| 项 | 说明 |
|----|------|
| 生产级 ES + IK 分词 / 多租户 | `http` 切片可签字归因（OPS-1）；默认仍 `mock`；**≠** 全文 B8（IK、Router、入库双写） |
| rewrite / 多轮指代消解 | `SESSION_REWRITE_ENABLED` 在 P2 阶段强制为 false；会话历史**不等于**检索证据 |
| L2 准出 / 多轮 runner | 题面草案已落；**无**批跑 CLI、**无**真跑归档；**≠** 可开 rewrite |
| CRAG / multi_hop | 未进入本阶段范围 |
| 完整 ACL / 部门强制隔离 | 目前只有 KB 成员校验 + 权限码 + 可配置的组织骨架；**检索仍是成员可见全库**（B5 未开启 DEPT_ACL） |
| 生产 IdP | 仍是临时双 JWT；**B4-W** 已读 `user_roles` hydrate（≠ Better Auth / 密码登录） |

### 其他包的 UI / 产品面挂账（非本包义务）

| 项 | 说明 |
|----|------|
| 知识库设置 admin 全量 UI（分片策略弹窗 / KB 模型绑定写 UI） | API：**docTypes + mode 闸 + KB 绑定读路径已接线**；admin 写 UI 可 defer |
| 按历史 indexVersion 浏览分片 | ADR-052 明确 P2 阶段不做 |
| Mongo 作为正文权威存储 | 目前演示读取的是 PG 的 `body_text` 字段；接真 Mongo 见 B9 |
| 跨部门授权、DEPT_ACL 强制 | B5 仅组织壳；ADR-057 检索强制未开 |
| APM / 时序观测大盘 | B6 仅为 `GET /admin/dashboard/summary` 只读计数 + processReady，**不是**观测生产向 |
| 反馈 API / UI | **本包 API 已有** `routes/feedback`；web 答后 + admin 队列 UI 见各自包文；SLA `docs/ops/feedback-sla.md` |
| L1 业务签字门禁 / live 覆盖率闸 / 真跑数字 | 文件账本 + 可选 `eval_runs`；live 全量 30/30 已跑（`signoffEligible=true`）；ADR-046 快照可绑定；本跑 coverage=0 **不**宣称 L1 门禁 PASS；人签见 **B10-followup** 余量 |
| 入库 ES 双写 / worker 真向量 | **本包不负责**；worker 侧仍 mock（见 [worker](./worker.md)） |

---

## 技术债

| 债 | 影响 | 备注 |
|----|------|------|
| 临时双 JWT + 默认不强制鉴权 | 不是生产级身份方案 | 见 auth 相关 PRD / ADR |
| refresh token 存在进程内 Map | 多实例部署或进程重启会丢失 refresh 状态 | `auth/identity/refresh-store.ts` |
| mock sparse 检索 / 本地 storage 路径 | 检索与对象存储都不是真实依赖 | backlog B8 / B9 |
| 观测未接真实 Langfuse | 指标只有可演示级别 | `LANGFUSE_ENABLED` 默认 false |
| `/metrics` 无鉴权 | 生产环境需要网关层保护 | 代码注释已标明；contracts 中没有对应的线型定义 |
| OpenAPI paths 为代表性子集 | 联调时部分端点不在文档中 | ARCH-P2-1 有意非全量；扩展 paths 时继续 `$ref` contracts |
| sessions / auth TokenPair / documents status 出口使用 `as` 断言 | 存在 D1 类型漂移面 | 以类型标注为主，未做全量 Schema.parse 校验 |
| L1 业务签字包 / 远程 CI 红线任务 / live 门禁数字 | 工程：gold≥60 + CLI + 2×2 + `eval_runs`（`L1_PERSIST_EVAL`）+ OPS-1 live 切片；**mock 数字禁止签字**；无默认 CI 真 LLM；**无**业务签字真跑归档 | B10 seed `08-09-b10-l1-golden-min` · followup **部分** `08-11-b10-followup-eval-runs`；P0 红线表 ≠ L1；AUTH enforce 测 → **QUAL-1**；HOW → `.trellis/spec/api/backend/l1-eval.md` |
| L2 准出 / runner | 题面草案≥15 + 形状测；**未跑**；rewrite 仍关 | P2.5-L2 **部分** `08-15-p25-l2-gold-min`；HOW → `.trellis/spec/api/backend/l2-eval.md` |

---

## 证据

| 类型 | 指针 |
|------|------|
| 路由挂载 / 错误中间件 | `apps/api/src/app.ts` · `middleware/on-error.ts` · `lib/pg-error.ts` |
| 超时 / 请求体限制 | `middleware/timeout.ts` · `body-limit.ts` · `env.ts`（`API_REQUEST_TIMEOUT_MS` 等） |
| 问答图 / ask 路由 | `apps/api/src/graph/` · `apps/api/src/routes/ask.ts` · `apps/api/src/services/ask/` |
| 会话 / 反馈 | `apps/api/src/routes/sessions.ts` · `routes/feedback.ts` |
| 入库 / 策略闸 / 入队 | `routes/documents/`（ARCH-P1a）· `services/chunk-strategies.ts` · `services/queue.ts` · `gates/` · contracts `chunk-strategy.ts` · `async/ingest-job.ts` |
| 分片只读 | `apps/api/src/routes/chunks.ts` · `services/chunks.ts` · `routes/chunks.test.ts` |
| 知识库设置 | `apps/api/src/routes/kb-settings.ts` · `services/kb-settings.ts` · `routes/kb-settings.test.ts` |
| 模型网关 B3 | `apps/api/src/routes/model-gateway.ts` · `services/model-gateway.ts` · `routes/model-gateway.test.ts` |
| 数据面板 B6 | `apps/api/src/routes/dashboard.ts` · `services/dashboard.ts` · `routes/dashboard.test.ts` |
| 鉴权 / 成员 | `apps/api/src/auth/` · `routes/members.ts` |
| Gateway 运行时 / 检索 | `apps/api/src/services/gateway/`（`getGatewayForTenant` · `bindings.ts` · `resolve.ts`）· `services/retrieve/`（`corpus.ts` · `es-sparse.ts` · `filterDocsForRetrieve`） |
| 观测 | `apps/api/src/obs/` |
| L1 工程 seed / followup 工程 | `fixtures/l1/gold.yaml` · `RACI.md` · `README.md` · `apps/api/src/eval/l1-matrix.ts` · `scripts/run-l1-golden.ts` · `scripts/seed-es-sparse-probe.ts` · `packages/db/src/schema/ask/eval-runs.ts` · `docs/ops/live-retrieve-profile.md` · `turbo.json`（`L1_*` / `L1_PERSIST_EVAL`） |
| L2 题面草案 | `fixtures/l2/gold.yaml` · `README.md` · `RACI.md` · `sample-report.md` · `corpus/` · `apps/api/src/eval/l2-gold.ts` · `l2-gold.test.ts` |
| 环境变量默认值 | `apps/api/src/env.ts`（`RETRIEVE_ES_MODE=mock` · `AUTH_ENFORCE=false` · `SESSION_REWRITE_ENABLED=false`）；L1 CLI 另读 `L1_KB_ID` 等（**非** `env.ts` Zod 必填） |
| 单测 | `apps/api/src/**/*.test.ts`（含 **dashboard** / eval/l1 / eval/l2-gold / ask / chunks 等） |
| P0 红线 | `docs/testing/p0-redlines.md` · `services/retrieve/corpus.test.ts`（R7）· `graph/graph.test.ts`（R8/R9） |
| Task（辅证 · 08-11 归档） | `archive/2026-08/08-11-b12-chunk-strategies` · `08-11-b13-feedback-ui` · `08-11-b2-w-kb-settings-wire` · `08-11-b3-w-gateway-read-db` · `08-11-b4-w-jwt-db-roles` · `08-11-b10-followup-eval-runs` · `08-11-ops-live-retrieve-profile` · `08-11-qual-auth-enforce-redline` · `08-11-qual-rerank-dual-node` · `08-11-qual-scan-engine`（QUAL-2 延期） |
| Task（辅证 · 08-12 归档） | `archive/2026-08/08-12-spec-arch-review-backlog` · `08-12-spec-w1-*` · `08-12-spec-w2-*` · `08-12-spec-closeout`（HOW 债；**非**业务抬成熟度） |
| Task（B1–B6 / S2 · 归档） | `08-06-b1-chunk-readonly` · `08-07-b2-kb-settings` · `08-07-b3-model-providers` · `08-07-b4-*` · `08-07-b5-*` · `08-09-b6-dashboard-shell` · `08-09-b10-l1-golden-min` · `08-05-phase-2-ask` |
| 总 backlog | `.trellis/tasks/08-06-project-backlog/status.md` |
| 工程规范（HOW） | `.trellis/spec/api/backend/`（`ask-pipeline` · `chunk-strategies` · `auth-authorization` · `l1-eval` · `l2-eval` · `dashboard` 等） |
