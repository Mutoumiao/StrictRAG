# @strict-rag/api · 模块状态

| 字段 | 内容 |
|------|------|
| 路径 | `apps/api` |
| 端口 | 4000 |
| 成熟度 | **可演示**（已包含：P0/P1 入库 + S2 最小问答 + B1–B6 最小运营 API + B10 L1 工程 seed + B12 策略闸 + B13 反馈 API；演示依赖 mock ES / 通常走 mock Gateway；L1 **≠** 业务签字门禁） |
| 默认依赖模式 | 检索：`RETRIEVE_ES_MODE=mock`（默认 mock ES；`http` 须 `ELASTICSEARCH_URL`）；鉴权：临时双 JWT，`AUTH_ENFORCE` **默认 `false`**；rewrite：`SESSION_REWRITE_ENABLED` **默认 false**（图边已落；dogfood 可开；**≠** 准出）；对象存储：默认 `local`（`STORAGE_MODE=s3` 走 RustFS / S3 兼容）；Gateway：`GATEWAY_MODE=''`（空按 `GATEWAY_BASE_URL` 推断，缺 URL 走 mock）；上传上限 `INGEST_MAX_FILE_BYTES=52_428_800`（50 MiB）/ 天花板 `INGEST_MAX_FILE_BYTES_CEILING=209_715_200`（200 MiB）；`LANGFUSE_ENABLED=false`；`OBS_MEMORY_TRACE=true`。**B3-W/B2-W**：ask 读取 platform 绑定 + **KB scope 绑定覆盖（PUT 只 generate/embed/rerank）**；**B4-W**：每请求从 DB `user_roles` hydrate；`DEPT_ACL_ENFORCE` **默认 `false`**（开时精确 ∪ 祖先 + grant 精确 ∪ 祖先部门子树；超管可绕过；列表同滤且列表项带部门字段；`DEPT_INHERIT_DOWN` 默认 true；KB `deptInheritDown` 可覆盖 env；KB `deptAclEnforce` 可覆盖 env，未写跟 env，GET 未写回读 false；设置页可勾选，未改不写回；ES 查询期强制 tenantId+kbId；enforce 开且非超管可追加 `ownerDeptId` terms（缺字段不得当全员可见；PG 可见级闸仍保留）；aclPrincipals 用户 uuid 名单最小已落（PG 把关；ES 查询期非超管 should 收窄；不跟 DEPT_ACL_ENFORCE；**≠** 角色 principal / 默认开））；`MONGODB_URL` 空（非空时检索融合后批取 Mongo `chunk_bodies` 权威正文，缺块 fail-closed）；`ASK_RATE_LIMIT_RPM=0`；`INGEST_RATE_LIMIT_RPM=0`（ask/ingest 分 store 试点限流；aux 只留常量）；`SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` **可选**（无 active 超管时缺一则 **index.ts listen 前**失败；`createApp()` 不跑引导）；L1 CLI 需显式指定 `L1_KB_ID`（可选 `L1_PERSIST_EVAL`） |
| 关联模块 | 入库演示还需要 `worker` + PostgreSQL + Redis；契约 `@strict-rag/contracts`（含 `IMPLEMENTED_CHUNK_STRATEGIES` / `IngestJobData`）；schema `@strict-rag/db`（含 `eval_runs`）；L1 gold / RACI 在仓根 `fixtures/l1/`；L2 题面草案在 `fixtures/l2/` |
| 最近更新 | 2026-09-16（指标骨架补 `fallback` / `node_used` 维；`GET /ask/:requestId/final` 断线重拉终态；`ask_traces.citations` 落库） |
| Spec | `.trellis/spec/api/backend/`（含 [dashboard](../../.trellis/spec/api/backend/dashboard.md) · [l1-eval](../../.trellis/spec/api/backend/l1-eval.md) · [l2-eval](../../.trellis/spec/api/backend/l2-eval.md) · [l3-metrics](../../.trellis/spec/api/backend/l3-metrics.md)） |
| PRD | `prds/05-api` · `04-pipelines` · `08-quality` · `09-security` |

## 一句话状态

基于 Hono 的 HTTP 后端：入库 API、临时双 JWT 鉴权、**listen 前启动引导超管**（env 创建，不是页）、单轮问答图 / **AI SDK UI Message Stream** 流式输出以及会话外壳均已落地；另有 **L1 黄金集工程 seed**（文件 gold + CLI 批跑 `executeAsk(skipTrace)` + 2×2 报告）与 **L2 多轮题面 + 工程 runner + 可选 persist**（`fixtures/l2/` + `run-l2-golden`；可写 `eval_runs`；**≠** 准出）。检索默认 **mock ES**，鉴权**不是**生产级 IdP；**mock L1 数字禁止当业务签字**；**rewrite 图边已落、默认关**；**显式回溯加深部分**；**文档回溯检索加码部分**；**库外文档回溯抑制部分**；**四态派生部分**（**≠** 准出 / **≠** 对外连续追问）。文档部门字段 **可存可回读**（含 complete 可写、列表项同带）；`DEPT_ACL_ENFORCE` **默认关**（开时精确 ∪ 祖先 + grant 精确 ∪ 祖先部门子树；超管可绕过；列表同滤；`DEPT_INHERIT_DOWN` 默认 true；KB `deptInheritDown` 可覆盖 env；KB `deptAclEnforce` 可覆盖 env，未写跟 env，GET 未写回读 false；设置页可勾选，未改不写回；ES 查询期强制 tenantId+kbId，enforce 开且非超管可追加 `ownerDeptId` terms；aclPrincipals 用户 uuid 名单最小已落（PG 把关；ES 查询期非超管 should 收窄；不跟 DEPT_ACL_ENFORCE；**≠** 角色 principal / 默认开））；敏感 KB complete 须 ACL 就绪（部门路径或显式名单；`null` 仍挡；**≠** 角色 principal / **≠** 仓库默认开）。

---

## 已具备能力

### 基础设施
- 健康检查 `/health`、就绪检查 `/ready`（PG/Redis 硬依赖；ES/S3/Mongo/Gateway 未配置 `skipped`）、`/metrics` 指标骨架
- request-id 中间件、Pino 日志、环境变量校验
- **ARCH-P0 运行时硬化**：`onError` / `notFound` 统一返回标准错误信封；PostgreSQL 约束冲突做兜底映射；`secureHeaders` 安全头 + 可关闭的 `timeout` 超时中间件（ask 路由除外）+ JSON `bodyLimit` 请求体限制（上传路由除外）；`createDb` 按 api 端配置超时；收到 SIGINT/SIGTERM 时优雅关闭 DB 连接与队列
- **ARCH-P1b-2 管理写操作日志**：`middleware/admin-write-audit.ts` 在 auth 之后，对成员 / 审批 / lifecycle / `/admin/*` 写 / KB settings PATCH 打 `event:admin_write` 日志（Pino；**不**落审计表；排除 GET / ask / auth）
- **ARCH-P2-1 OpenAPI + Scalar（dev）**：`openapi/document.ts` 从 `@strict-rag/contracts` Zod `toJSONSchema` 生成 OpenAPI 3.1；提供 `GET /api/v1/openapi.json` · `GET /api/v1/docs`（Scalar CDN）；`OPENAPI_DOCS_ENABLED` 未设置时 development|test 默认开、staging|production 默认关。**≠** 全路径覆盖 · **≠** OpenAPIHono 重写 route · **≠** 生产 swagger 发布流水线
- **ARCH-P1a documents 域目录试点**：`routes/documents/`（`index.ts` 导出 `documentRoutes` · `mappers.ts` 纯映射）；`app.ts` 挂载方式不变。**≠** 其它域全量搬家 · **≠** URL / 契约变更

### 鉴权与权限
- 双 JWT（access token + refresh token）、dev-login 开发登录、`GET /api/v1/auth/me`（当前主体 + 有效权限码）、`GET /api/v1/me/permissions`（有效码与 `/auth/me` 同源，角色并集）、`AUTH_ENFORCE` 总开关（默认关闭）
- 知识库成员校验、权限码求值（对接 admin-catalog）
- **ARCH-P1b-1 KB 作用域组合**：`auth/kb-scope.ts` 在请求内缓存成员信息；`requireKbScope` 组合入口；`evaluateKbMember` / `checkPermission({ kbId })` 供 handler 使用；feedback 不做私有 assert；**默认 AUTH_ENFORCE 仍关**
- 成员路由：列表 / 邀请 / **PUT 改 role** / 删除；始终 `member.manage` + KB 成员闸。**无** `allowedDocIds`。建库会写入首位库管 `role=admin`

### 入库（P1）+ 分片策略闸（B12）
- `POST /knowledge-bases` 创建知识库（`kb.create`；`AUTH_ENFORCE` 关时仍 WhenEnforced）：body **必填** `initialAdminUserId`，事务写入 `kb_members(role=admin)`；`tenantId` **只认令牌**（无令牌回落默认租户，忽略 body）；用户不存在 404；文档上传（`upload-url` + `PUT /api/v1/internal/objects` local 落体）、**在线编写**（`POST …/documents/write`，`sourceType=write`，与 complete 同闸进 pending，**不**入队 scan，**无** BlockNote）、complete **MIME/扩展名白名单**（未知与 `octet-stream` → 415 `UNSUPPORTED_MEDIA_TYPE`）+ 体积闸 + **checksum 落库/比对**、`POST …/documents/:docId/approve` / `POST …/documents/:docId/reject` 审批族（`approval.decide`；**默认禁自审** ADR-048 #4 四眼：认得出 actor 且与提交人相同时 403 `FORBIDDEN` + `details.reason=self_approve_forbidden`，approve / reject 同口径；认不出 actor 或提交人未知时不拦）、complete / write 记提交人 `uploaded_by`、approve 记 `approved_by`、审批通过后才能 scan 入队的闸门；lifecycle 四态（上架 `active` 仍须 `status=ready`）/ **`POST …/documents/:docId/supersede`**（旧文 `superseded` + `supersededByDocId`，后继 `active` + `supersedesDocId`；后继须 ready）/ **`DELETE …/documents/:docId`**（archived 后入队 `purge`；PATCH archived **不**入队）/ reindex / 列表详情
- `PATCH /documents/:docId`：部门 / 可见级 / **`docType`**（须属于该 KB **启用中** 的类型枚举，否则 400；空启用列表只能清 null；停用码不得新标）/ **生效区间**（`effectiveFrom`/`effectiveTo` 本地时间串，omit 不改、null 清除，合并后 from>to → 400；不改 lifecycle、不入队）；列表项含 `docType` / 窗口 / **替代边**（`supersedesDocId` / `supersededByDocId`，缺省 `null`）/ **`chunkStrategy` + `chunkStrategyParams`**（只读审计，缺省 `null`）
- **B12 / ADR-053 最小闭环**：`chunk_strategy_definitions` + `kb_chunk_strategies` 为 catalog 权威；写入闸仍 **`IMPLEMENTED` 仅 `structure_paragraph`**
  - HTTP：`GET/PATCH …/chunk-strategies`、`/schema`、`/for-upload`（写须 `kb.config.write`）
  - complete/reindex/write：按 for-upload available 计数（仅 1 个可自动；≥2 未选 400）；写入策略码 + `chunk_strategy_params` 快照；reindex 对 `needs_review` / 非 utf8 `needs_ocr` 入队 `ocr`（其余仍 `chunk`；**不是**自动全库）；write 不入队 scan
  - 未实现码 400；PATCH `paramOverrides.contextMode` 仅 `l0_template` / `l1_llm`（非法 400）；PATCH **有 diff** 落 `kb_settings_audits`（键 `chunkStrategy.<code>.<field>`；**无 diff 不落**；复用 KB 设置审计表，**不新建表**）；改库启用 **不** 自动 reindex；**无** 平台定义 CRUD 页、**无** paramSchema 通用动态表单引擎
- 入队：`services/queue.ts` → BullMQ `QUEUE_NAMES.INGEST`（`sr-ingest`）；payload 为 contracts `IngestJobData`；`attempts=3` · backoff 2000ms
- SQL 集中在 `services/`；路由保持轻量
- **`GET /api/v1/knowledge-bases/:kbId/ingest-report`**：成员闸 + `doc.view` WhenEnforced；返回该库已落库行（空列表 200；缺库 404）；只写真事（chunkCount / 文档内 dropped / **跨 doc dropped + 冲突对** / **contextSource** / 双就绪 / 对账计数）；**无** pending_review / Hit@k / `l1_llm` 来源 / doc 级路径（`routes/ingest-report.ts` · `tests/ingest/ingest-report-http.test.ts`）

### 分片只读（B1 · ADR-052）
- `GET /documents/:docId/chunks`：返回当前 `indexVersion` 的分片列表，正文做 preview 截断（**不返回完整 body**），支持 cursor/limit 分页
- `GET /documents/:docId/chunks/:chunkId`：返回完整正文（取自 PG 的 `body_text` 字段），按 UTF-8 **64KiB** 软截断
- 始终强制 `requirePermission('chunk.view')` 校验（与 `AUTH_ENFORCE` 开关无关）；`doc_operator` 角色默认返回 403

### 知识库设置（B2 · ADR-054 · B2-W 接线）
- `GET / PATCH /knowledge-bases/:kbId/settings`：白名单 `name` / `description` / `allowedModes` / `defaultMode` / **`docTypes`**（启用码简写）/ **`docTypeItems`**（`{code,label,sort,enabled}` catalog，与 `docTypes` 互斥）
- 始终强制 `requirePermission('kb.config.write')`；知识库作用域要求调用者是成员（超级管理员可旁路）
- `qualitySnapshot.tauClaim` 只读（取自 `env.TAU_CLAIM`）；`sessionRewrite` 固定锁定为关闭
- 试图写入 τ、`allowDegradedGenerate`、`sessionRewrite*` 等字段一律返回 400；成功的写操作会输出 Pino 日志 `kb_settings_patch` 并记录 diff
- **修改日志最小闭环**：PATCH 成功且 `merged.diff` 非空时插入 `kb_settings_audits`（actor = 令牌 userId；tenant = 令牌租户，缺则 `DEV_DEFAULT_TENANT`）；空 diff / 失败 PATCH 不写。`GET /knowledge-bases/:kbId/settings-audit` 同码 + 成员闸；新在前，上限 50；空列表 200；缺库 404（`routes/kb-settings.ts` · `services/kb-settings-audit.ts` · `tests/kb/settings-audit-http.test.ts`）。**不是** `admin_write` 中间件落表
- **B2-W 已接线**：ask 入口校验 `mode∈allowedModes` / `defaultMode`；`docTypes` scope 子集闸；Gateway **读** KB scope 绑定覆盖；**PUT KB 消费绑定**只收 generate/embed/rerank（judge 等 400）

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
- **B4-W 已接线**：中间件每请求 `hydrateAuthz`（读取 `user_roles` + 启用角色 `codesJson`）；进程缓存 TTL **5s**；loader 超时 **3s** 时回退 JWT claims（`role-hydrate.ts`）；写路径 `invalidateRoleCache`（**单实例假设**）；dev-login `ensureUserRoleCodes` bootstrap；dev/test 无绑定时回退 claims；**没有**密码登录 HTTP / 生产 IdP
- **启动引导超管（ADR-056 AD1–AD3）**：`index.ts` listen **前** `runSuperAdminBootstrap`（默认租户）；upsert `permission_definitions`；`super_admin.codesJson` 精确等于 catalog 全码；无 active 超管则按 `SUPER_ADMIN_*` 创建（scrypt 哈希）或缺则失败；已有超管不改哈希；`createApp()` **不**跑。测例 `tests/acl/superadmin-bootstrap.test.ts`。**无**引导页 / **无**验密 HTTP
- **写路径锁超管全码**：PUT/PATCH（带 `codes`）把 `super_admin` 绑码改少 → 400 `RULE_VIOLATION`；全码（乱序）200；PATCH 不带 codes 改 name 200。测例 `tests/acl/platform-users-roles.test.ts`
- **QUAL-1**：`AUTH_ENFORCE=true` 时 `requirePermissionWhenEnforced` 无 Bearer → 401 `UNAUTHORIZED`（`tests/auth/enforce-401.test.ts`）；**默认仍关**
- 权限运行时实况：**`codes_json` 过渡**（字典表已落，**不**切求值）；终态迁表须 ADR

### 部门组织骨架（B5 · ADR-057 最小集）
- `GET / POST /admin/departments`、`GET …/tree`、`GET / PATCH /DELETE …/:deptId`
- `GET / PUT /admin/users/:userId/departments`（主部门 + 兼任部门 + is_leader 标志）
- 部门树操作需要 `dept.manage` 权限；用户归属操作需要 `user.manage` 权限；始终做权限码校验
- 禁止成环；已禁用的部门不可再挂新用户；删除仍有子部门或仍有用户的部门会返回 400
- 数据表：`departments` / `user_departments`；migration `0005_b5_departments`；测试用内存仓库
- 文档 `ownerDeptId` / `visibilityLevel` **已落库可回读**（`PATCH /documents/:docId` · complete body 可选同写 · `doc.editor` 始终验码；migration `0007`）
- `GET/POST/DELETE /admin/dept-cross-grants`（`dept.manage` 始终验；migration `0008`）；enforce 开时 retrieve/预览/**列表**读未过期 grant（精确 ∪ 祖先部门子树；无树/缺节点只精确；不读 inheritDown）
- `DEPT_ACL_ENFORCE` **默认 false**：开时 `filterDocsForDeptAcl` 为精确 ∪ 祖先 + grant 精确 ∪ 祖先部门子树（预览、列表、retrieve 同函数；grant 子树不读 inheritDown）；超管 `roleBypassesKbMembership` 绕过；`DEPT_INHERIT_DOWN` 默认 true（仅 `'false'` 关祖先）；KB `config_json.deptInheritDown` 可覆盖 env（未写跟 env）；KB `config_json.deptAclEnforce` 可覆盖 env（未写跟 env；GET 未写回读 false；设置页可勾选，未改不写回）；列表项带 `ownerDeptId` / `visibilityLevel`；设置页可勾选 inherit（未改不写回）；ES http 检索 enforce 开且非超管时 `ownerDeptId` terms 收窄（缺字段不得当全员可见；PG `filterDocsForDeptAcl` 仍把关）；**无** 默认开；sensitive complete 须 ACL 就绪（部门路径或显式名单）
- 文档级 `aclPrincipals`（可空用户 uuid 数组）：null=KB 成员可读；`[]`=非超管不可读；列表 / 详情 / chunks / `loadCorpusFromDb` 在部门滤之后同滤；不跟 `DEPT_ACL_ENFORCE`；超管 bypass；ES mapping/bulk 写 keyword 数组（null 不写、`[]` 写哨兵 `__acl_none__`，因 exists 不认空数组）；已有索引 PUT `_mapping` 补 keyword；查询期非超管 should（缺字段可读 ∪ term userId）；**≠** 角色 principal / 默认开强制
- KB `dataClass`（`internal`|`sensitive`，缺省 internal）：`sensitive` complete 须 ACL 就绪（部门路径：enforce ∧ 非空 ownerDeptId；或名单路径：`aclPrincipals != null`）；未就绪 400 `RULE_VIOLATION`；complete body 可同写 `aclPrincipals`；**≠** 仓库默认开 / **≠** 角色 principal

### 数据面板（B6 · 薄壳 · 只读）
- `GET /api/v1/admin/dashboard/summary`：始终 `requirePermission('dashboard.view')`
- 指标 ≤5：`kbCount` / `documentCount` / `pendingApprovalCount` / `processReady`（`runReadyChecks`）/ `askCount24h`（`ask_traces` 24h count）
- **I4 双轨** `GET /api/v1/admin/dashboard/tracks`：独立信封（不改 summary）。质量 = 最近一笔成功 L1 `golden_2x2`（2×2 / coverage / Hit@k / tau* / auroc；无则 null；**不含**签字字段）。延迟 = 近 24h `ask_traces` 次数 / avg / p95（无 `latency_ms` 样本 → null）。**≠** APM / **≠** 准出
- SQL 在 `services/dashboard.ts`；memory repo 便于单测；**无**写路径、**无** schema 变更、**≠** APM

### 问答（S2 最小集）
- **纯规则路由**（`graph/route-rules.ts`）：寒暄白名单 + 后置禁词 + 知识向线索 → `chitchat` / `single`（P2 不依赖 LLM 路由）；随后**线性状态机**（不是 LangGraph.js）：检索 → 约束生成 → 验证 → 拒答，实现见 `graph/run.ts`
- 同步 ask 接口 + AI SDK UI Message Stream 流式输出（使用 `data-status` / `data-ask-final` 数据部件，**没有**自写的 `event: final` 事件）
- 空库（KB 内无任何 `lifecycle=active` 且 `status=ready` 文档）：HTTP **200** + `status=abstained` + `reason=kb_not_ready` + PRD 文案；`suggestedActions` 可带 `contact_admin`；该冲突短名 **不**作 ask 主路径 `error.code`；SSE **不**写 `phase=error`（`services/ask/execute.ts` · `routes/ask.ts` · `tests/ask/http-stream.test.ts`）
- 类型 scope 收窄后语料为空、但双闸后仍有现行文档：`reason=no_docs_in_scope`（**禁止**再标 `kb_not_ready`）；无 scope 或双闸已空仍 `kb_not_ready`（`tests/ask/retrieve-run.test.ts`）
- 流式异常处理：`execute` 抛错时仍会写出 `data-status phase=error` 与 `data-ask-final`（`reason=internal_guard`）；有单测覆盖（`tests/ask/http-stream.test.ts`）
- 会话：`POST …/sessions` 创建 + 列表 / 详情外壳；**rewrite 图边已落、默认关**（`SESSION_REWRITE_ENABLED=false`；dogfood 可开；**≠** L2 准出）；**显式回溯加深部分**（命中「刚才/之前/刚刚+说/聊」时窗硬顶 8）；**文档回溯检索加码部分**（命中「这份/那份文档」时用上轮 evidence `docId` 提权，不翻聊天）；**库外文档回溯抑制部分**（「网上那份文件」不查末轮 docId、不 `preferredDocIds`）；**四态派生部分**（`resolveBackReference`：external > session > document > none；**无** intent LLM）；list 接口的 query 参数绑定 `SessionListQuerySchema` 校验
- ask 结果落库 `ask_traces`（evidence_snapshot / graph_trace / config_snap / **citations**；`rewriteUsed` / `sessionDeepened` **跟图**），`services/ask/traces.ts`。`citations` 列 `NULL` = 迁移前旧文未记录、`[]` = 当时确实零引用（migration `0017_ask_traces_citations`）
- **`GET /api/v1/knowledge-bases/:kbId/ask-modes`**：始终 `requireKbMember`；只回 `allowedModes`/`defaultMode`（`AskModesSchema`）；缺设置回默认档；**不**回 τ / 质量快照（`tests/ask/http-ask-modes.test.ts`）；`GET …/settings` 仍要 `kb.config.write`
- **`GET /api/v1/knowledge-bases/:kbId/doc-types`**：始终 `requireKbMember`；只回启用项 `{ items: [{ code, label }] }`（label 取 catalog）；停用不出；空枚举 `items: []`；**不**回 τ（`tests/ask/http-doc-types.test.ts` · `tests/kb/doc-type-catalog-http.test.ts`）；设置 GET 仍要 `kb.config.write`
- **`GET /api/v1/ask/:requestId`**：登录 + 该 trace 的 KB 成员（`evaluateKbMember`；超管旁路）回读当时 `evidenceSnapshot`（chunkId/docId/lifecycle/preview 截断）与 `graphTrace`；**不**返回 answer / rawQuestion / 正文；**不**查现网分片（reindex 后快照仍在）；`toAskAudit`（`services/ask/traces.ts`）· `tests/ask/http-audit.test.ts`
- **`GET /api/v1/ask/:requestId/final`**：断线重拉该轮**终态**（成员闸同上）。`ready=true` → `{ requestId, ready, response }`，`response` 走 `AskResponseSchema` 与在线同形；status 非终态 / reason 未知 / verified 轮 `citations` 未落库 → `ready=false` + `message`（**禁止**编造 answered、**禁止**拿审计 preview 顶替）；无 trace → 404。`toAskFinal` · `tests/ask/final-mapper.test.ts` · `tests/ask/final-replay.test.ts`。流式 `data-status(phase=running)` 带本轮 `requestId`，且客户端下发的 `X-Request-Id` 被采纳为本轮 id
- 反馈提交 / 管理队列 API（`routes/feedback`）；queue 接口的 query 参数绑定 `FeedbackQueueQuerySchema` 校验；PATCH `promoted_to_gold` 须 `goldType` + `eval.run`，INSERT `gold_questions`（题面来自 ask；用户 POST 不写题；**不**写 gold.yaml、**不**入队评测）
- Gateway 切片（`GATEWAY_MODE` mock/http；ask 走 `getGatewayForTenant`；Key 不进日志）；rerank 双节点：`GATEWAY_RERANK_FALLBACK_URL` + `RERANK_MIN_NODES`（staging/prod 默认 2；`services/gateway/resolve.ts`；QUAL-3 测）；**generate fallback opt-in**：快照保留 `fallbackRefs`，`chat` 在 primary 同模型重试耗尽后可切备用 ModelRef（`fallbackUsed=true`；auth/bad_request/content_filter 不盲切；judge 等不走此链；**无** `GENERATE_MIN_NODES`；图层不二次计费；**≠** 生产多活签字）
- **B2-W**：ask 入口校验 `mode∈allowedModes` / `defaultMode`；settings `docTypes` / `docTypeItems` 读写 + scope 子集闸对**启用码**；τ 字段仍拒绝写入
- 检索适配层（dense∥sparse → RRF → rerank；`RETRIEVE_ES_MODE` **默认 mock**；`http` = ES BM25 sparse **切片**（`es-sparse.ts`；查询期强制 tenantId+kbId `buildAclFilter`，enforce 开且非超管可追加 `ownerDeptId` terms；ES 检索失败 → `sparse_unavailable`，缺 URL → `internal_guard`，**禁止**回落 mock）；服务端按 mode 注入 `retrieveK/rerankTopN`（fast 60/10，balanced/strict 150/20，客户端禁止透传）；`MONGODB_URL` 非空时融合后从 Mongo `chunk_bodies` 批取权威正文（`mongo-body.ts`；缺块 fail-closed），空 = 演示回退 PG `body_text`；**不等于**生产 ES+IK / 多租户 Router（B8））
- 观测骨架：进程内 metrics、内存 tracer、**三平面配额最小闭环**（ask `ASK_RATE_LIMIT_RPM` / ingest `INGEST_RATE_LIMIT_RPM` 默认 0 即关闭；分 store / 分前缀；触顶 429 `RATE_LIMITED`，ask `details` 含 `plane=ask` + `ask_quota_exhausted`；complete 入队前打 ingest 闸；`recordAskResult` / llm / rerank 带 `plane=ask`，complete 成功或限流带 `plane=ingest`；aux 只留常量不跑）、**指标骨架含 `fallback` 与 `node_used`**（功能表 §10.3：`llm_call_total` 加 `fallback` 维，真值取 Gateway `meta.fallbackUsed`，**调用失败拿不到该值 → 记 `unknown`，不谎报 `false`**；rerank 加 `rerank_node_used{provider,model}` / `rerank_fallback_used_total` / `rerank_fail_total{kind}`，**node = 本轮实际尝试的端点**，与按 ask 调用计的 `rerank_total` 两个口径；`tests/obs/metrics.test.ts` · `tests/obs/metrics-fallback-wiring.test.ts`）、`/metrics` 端点**无鉴权**（生产保护策略见 `docs/ops/rate-limit-and-metrics.md` · ARCH-P2-4；**≠** 把进程内全局限流当生产方案 / **≠** Redis 集群配额 / **≠** embed TPM / **≠** P4 直方图与远端导出）
- **L3 打点+告警+进程内熔断部分**（P2.5-L3 / L3A / L3F / L2S）：`recordL3Ask` 记六键 + `l3_topic_complaint_total` + `l3_guard_alert_total{kind}`（`coref_fail_rate` / `rewrite_dogfood` / `topic_complaint` / `l2_stale`）；超阈或 dogfood 开 env 时 Pino warn（每 kind 每进程一闩）；`executeAsk` 传 `rewriteEnvOn`；`coref_fail_rate` / `topic_complaint` / `l2_stale` 闩后后续 ask 强制 `rewriteEnabled=false`（`isL3RewriteFused`；即使 env true 也 `rewriteUsed=false`；会话壳仍落 transcript）；`rewrite_dogfood` **不**熔；**无**写 env / **无**收窄窗 / **无**面板 / **≠** 准出（`obs/metrics.ts` · `services/ask/execute.ts` · `tests/obs/l3-rewrite-fuse.test.ts`）
- **P0 红线单测已挂账**（清单见 `docs/testing/p0-redlines.md`；**不是** L1 黄金集评测、**也不是**远程 CI 门禁）：
  - **R7** `filterDocsForRetrieve` / `tests/ask/ready-active-corpus.test.ts`（生产装载路径；db 包的 `retrieval-gate` 为底层附录）；生效窗口叠在双闸之后（`tests/ask/effective-window-corpus.test.ts`）
  - **R8** 生成结果低于阈值被否决时必须拒答（abstained）（`tests/ask/min-veto.test.ts`）
  - **R9** 正常路径必须经过 verify 环节；负向用例中未完整执行 verify 时不得标记为 answered（`tests/ask/verify-required.test.ts`）
  - 关键 `it` 用例标题带 `R#:` 前缀；**不**要求测试内部 stub `AUTH_ENFORCE`

### 评测 L1 工程 seed（B10 · 部分 · ≠ 业务签字）
- 仓根 `fixtures/l1/gold.yaml`：**≥60 题**（answerable 30 + 不可答类 30）；扩展名 yaml、**内容为 JSON**（零 yaml 依赖）；逻辑 `expectedDocIds` 见 `fixtures/l1/README.md`；业务题面 RACI → `fixtures/l1/RACI.md`
- 纯函数现下沉 `@strict-rag/contracts` `eval/l1-matrix.ts`（api `eval/l1-matrix.ts` 再导出）：2×2（A–D）+ `coverage=A/(A+B)`（分母 0→null）；`outcome=error` **不计格**，只增 `errorCount`；有非空 `expectedDocIds` 时 Hit@k（evidence.docId 交集；不计 2×2 / signoffEligible）；有 `minSupport` 时离线 τ 扫描得 tau*（不计 2×2 / signoffEligible / **不**写 env）；独立校准集可算 Judge AUROC（Mann-Whitney；无打分器/单类 → null；不计签字公式）；单测 `tests/eval/l1-matrix.test.ts` · contracts `tests/eval/l1-hit-at-k.test.ts` · `tests/eval/l1-tau-sweep.test.ts` · `tests/eval/l1-judge-auroc.test.ts`
- CLI `apps/api/src/scripts/run-l1-golden.ts`：串行 **`executeAsk` + `skipTrace: true`**（可注入 `execute` / `graphDeps`）→ 仓根 `artifacts/l1-last-run.{json,md}` + **`l1-gate-snapshot.json`**（**gitignore**）；报告含 **`retrieve_mode` / `mode`** + **`answerableCount` / `unanswerableClassCount`** + **`signoffEligible`**（`live` ∧ 两类各≥30；截断/mock=false）+ **`hitAtK`**（无名单 → null）+ **`tauStar`**（离线网格；无合格 τ → null）+ **`judgeAuroc`**（独立校准集；无打分器 → null）+ ADR-046 `gateSnapshot`/`gateVerdict`
- 签字 live profile（OPS-1）：`docs/ops/live-retrieve-profile.md`；探针 `src/scripts/seed-es-sparse-probe.ts`（PG→ES bulk）
- 跑法：`L1_KB_ID=<uuid> pnpm --filter @strict-rag/api exec tsx src/scripts/run-l1-golden.ts`（可选 `L1_MAX_CASES` 等；见 `apps/api/README.md`）
- CI 范围：矩阵纯测 + mock 注入测 + es-sparse 单元测；**默认不**在 CI 跑真 LLM / 真 ES 全量；样例文 `fixtures/l1/sample-report.md`（非 live 签字数字）
- **P2 评测底线 HTTP**：`GET/POST/PATCH/DELETE …/gold-questions` · `POST/GET …/eval/runs`（`eval.run`）；空题集入队 400；只入队 `sr-eval`；`POST /internal/eval/execute-ask` 口令闸 + `skipTrace`，可带 sessionId/sessionWindow，回 `evidenceDocIds` 与 `minSupport`；GET run 可带 Hit@k / tauStar / judgeAuroc（`routes/eval.ts` · `tests/eval/http-gold-questions.test.ts` · `http-eval-runs.test.ts`）
- **L2 归档底线 HTTP**：`POST …/eval/runs` 可 `runType=session_multiturn`（题面仍 fixtures/l2，不进 gold_questions）；无合格 L2 归档时写产品默认开 rewrite → 400 SESSION_REWRITE_DISABLED；admin 开关仍只读；dogfood env 旁路保留（`routes/kb-settings.ts` · `eval-runs.hasQualifyingL2Archive`）
- **边界**：**禁止**把 `retrieve_mode=mock` 或 coverage=0 / 全 `internal_guard` 写入业务签字页；`eval_runs` 可 CLI `L1_PERSIST_EVAL=1` 或 HTTP 入队后由 worker 回写（migration `0006` + `0010` status/job_id）；τ 扫描挂 L1 批跑得 tau*（**不**写 `TAU_CLAIM` / **不**新开 `tau_sweep` 入队）；Judge AUROC 挂独立校准集（**不**用 gold type 当 label / **不**接签字公式 / **不**新开 `verifier_calib` 入队；无打分器 → null；**≠** live 校准 PASS）；**无** 在线抽样 / 通用 jobs 查询口；**L3 打点+告警+进程内熔断部分（无写 env / 无面板 / ≠准出）**；**签字真跑数字** 2026-08-14 live ×2 已落（B10-followup）；ADR-046 快照绑定已落（`eval/adr046-snapshot.ts`）；业务 PASS 仍须人签（本跑 `businessPass=false`）

### 评测 L2 题面 + 工程 runner + 归档底线（P2.5-L2 / L2R / L2P · 部分 · ≠ 准出）
- 仓根 `fixtures/l2/gold.yaml`：**18 条**多轮剧本（≥15）；文件字段 `signoffEligible` 必须 false；扩展名 yaml、**内容为 JSON**；9 类各至少 1 条
- 解析下沉 `@strict-rag/contracts` `eval/l2-gold.ts` / `l2-matrix.ts`；api `eval/l2-gold.ts` 保留 fs 加载
- 工程 runner `scripts/run-l2-golden.ts`：进程内窗 + `executeAsk(skipTrace)`；末轮机械分；`signoffEligible` = live ∧ 九类齐 ∧ 零容忍机械项=0 ∧ ≥15（mock 必 false；**仍 ≠ 人签**）
- HTTP 入队 `session_multiturn` + worker 多轮窗回写；CLI 仍可 `L2_PERSIST_EVAL` 直写
- 语料草案 `fixtures/l2/corpus/` **未**走 worker 入库
- **边界**：可入队可回读；**无** 准出 / **无** 人签；rewrite 图边已落、**默认关**；**禁止**把工程绿 / persist / 草案条数当 L2 通过

---

## 明确未做 / 边界

### 本包 API / 运行时未交付

| 项 | 说明 |
|----|------|
| 生产级 ES + IK 分词 / 多租户 | `http` 切片可签字归因（OPS-1）；默认仍 `mock`；**≠** 全文 B8（IK、Router、入库双写） |
| rewrite / 多轮指代消解 | 图边 `session_load`→`rewrite` **已落**；默认关；dogfood 可开；**显式回溯加深部分**（硬顶 8）；**文档回溯检索加码部分**（不翻聊天）；**库外抑制部分**（不查末轮 docId）；**四态已派生**（无 intent LLM）；**≠** L2 准出 / **≠** 对外连续追问；会话历史**不等于**检索证据 |
| L2 准出 / 多轮 runner | 题面 + CLI + HTTP 入队 + worker 窗 + 工程 signoffEligible 已落；**无**真跑准出 / 人签；工程绿 ≠ 准出 |
| L3 自动熔断 / 面板 | **打点+告警+进程内熔断有**（六 counter + 主题投诉 + `l3_guard_alert_total` 含 `l2_stale`；三熔断 kind 闩后关 rewrite 路径；`rewrite_dogfood` 不熔）；**无**写 env / 收窄窗 / Grafana |
| CRAG / multi_hop | 未进入本阶段范围 |
| 按 `requestId` 断线重拉 | **终态回读已落**：`GET /ask/:requestId/final`（成员闸同审计口；`ready=true` 时 `response` 与在线 `data-ask-final` 同形，零引用按 status/reason 推出，verified 轮引用取自落库 `citations`；不可同形 → `ready=false` + message；无 trace → 404）。审计口 `GET /ask/:requestId` 语义不变（仍**不是** AskResponse 重放）；**无** 起始标记（trace 仍在 finalize 后写），故「还在跑」与「不存在」在 API 层不可辨 —— PRD §2.7 铁律 6 的 `Idempotency-Key` 未做 |
| 审计管理台 | 无搜索 / 过滤 / 导出；Langfuse 仍 mock 日志 |
| 完整 ACL / 部门强制隔离 | 开关有、默认关；开时精确 ∪ 祖先 + grant 精确 ∪ 祖先部门子树；超管可绕过；列表同滤且带列；可关继承（env + KB 覆盖 + 设置页勾选，未改不写回）；ES 查询期强制 tenantId+kbId，enforce 开且非超管可追加 `ownerDeptId` terms；aclPrincipals 用户 uuid 名单最小已落（PG 把关；ES 查询期非超管 should；**≠** 角色 principal） / **无** 默认开；sensitive complete 须 ACL 就绪（部门路径或显式名单） |
| 生产 IdP | 仍是临时双 JWT；**B4-W** 已读 `user_roles` hydrate（≠ Better Auth / 密码登录）。启动引导只写 `password_hash`，**无**验密 HTTP。超管绑码写路径已锁全码 |
| 成员 `allowedDocIds` / 检索 ACL 闸 | PUT 只改 `role`；`GET /me/permissions` 无 `byKb` |
| 入库报告完整语义 | 库级 GET 含跨 doc skip 冲突对与 **`dedupeCrossDocRate`**（null 原样回读，不填 0）；**无** `pending_review` / L0 vs L1 Hit@k / 「高度重复」阈值提示 |
| DELETE / 三存对齐 | DELETE 写 archived 并入队 purge；worker mock 适配器清对象 / mock ES / 可选 Mongo；**无** PG 硬删 / chunk 清扫 / HTTP ES `_delete_by_query` |
| MD/TXT 更严体积 / 魔数嗅探 | MIME 白名单已落；**无** 按族更严上限；**无** 文件头嗅探 |
| 三平面配额全文 | ask/ingest 进程内 RPM 分 store 已落（默认 0=关）；**无** embed TPM / `maxEmbedCalls` / staging fail-closed / aux 运行时 / Redis 集群 / L0 网关 |

### 其他包的 UI / 产品面挂账（非本包义务）

| 项 | 说明 |
|----|------|
| 知识库设置 admin 全量 UI（分片策略弹窗 / KB 模型绑定写 UI） | API：**docTypes / docTypeItems + mode 闸 + KB 消费绑定 PUT 已接线**；类型分区与三档绑定 admin 已接；paramSchema 可 defer |
| 按历史 indexVersion 浏览分片 | ADR-052 明确 P2 阶段不做 |
| Mongo 作为正文权威存储 | 检索路径已支持 `MONGODB_URL` 非空时融合后批取 Mongo `chunk_bodies`（缺块 fail-closed）；空 URL 仍演示回退 PG `body_text`；chunks 详情接口仍读 PG（ADR-052）；生产 Mongo 基础设施见 B9 |
| 跨部门授权、DEPT_ACL 强制 | grant 可存可配；过滤默认关；开时 grant 进检索（精确 ∪ 祖先部门子树）；超管可绕过；列表同滤；可关继承；KB 可覆盖 enforce（未写跟 env；设置页可勾选，未改不写回）；ADR-057 全文未上（ES 部门 terms 已落、仍默认关；sensitive complete 须 ACL 就绪；aclPrincipals 用户 uuid 名单最小已落（PG + ES should）、**≠** 角色 principal） |
| APM / 时序观测大盘 | B6 summary 只读计数 + processReady；I4 tracks 为最近 L1 账本 + 24h 延迟点值，**不是**观测生产向 / Grafana |
| 反馈 API / UI | **本包 API 已有** `routes/feedback`；PATCH `promoted_to_gold` 写运营黄金集（须 goldType + eval.run）；web 答后 + admin 队列 UI 见各自包文；SLA `docs/ops/feedback-sla.md`；**≠** gold.yaml |
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
| L2 准出 / runner | 题面≥15 + CLI + HTTP 入队 + worker 窗 + 工程公式；**未真跑准出 / 无人签**；默认 rewrite 仍关 | P2.5-L2/L2R/L2P **部分**；HOW → `.trellis/spec/api/backend/l2-eval.md` |
| L3 自动熔断 / 面板 | 六 counter + 主题投诉 + `l3_guard_alert_total`（含 `l2_stale`）已落；进程内熔断已落（三 kind 闩后关 rewrite；dogfood 不熔）；**无**写 env / 无面板 | P2.5-L3 **部分**（打点+熔断；面板仍欠）`08-16-p25-l3-metrics-min` · P2.5-L3A **部分** `08-16-p25-l3-alert-min` · P2.5-L3F **部分** `08-16-p25-l3-feedback-min` · P2.5-L2S **部分** `08-16-p25-l2-stale-min` · P2.5-SIG **部分** `08-16-p25-backref-signal-min`；HOW → `.trellis/spec/api/backend/l3-metrics.md` · `ask-pipeline.md` |

---

## 证据

| 类型 | 指针 |
|------|------|
| 路由挂载 / 错误中间件 | `apps/api/src/app.ts` · `middleware/on-error.ts` · `lib/pg-error.ts` |
| 超时 / 请求体限制 | `middleware/timeout.ts` · `body-limit.ts` · `env.ts`（`API_REQUEST_TIMEOUT_MS` 等） |
| 问答图 / ask 路由 | `apps/api/src/graph/` · `apps/api/src/routes/ask.ts` · `apps/api/src/services/ask/` |
| ask 档位（成员） | `routes/ask.ts` `GET …/ask-modes` · `tests/ask/http-ask-modes.test.ts` |
| ask 审计回溯 | `routes/ask.ts` `GET /ask/:requestId` · `services/ask/traces.ts` `toAskAudit` · `tests/ask/http-audit.test.ts` |
| ask 断线重拉终态 | `routes/ask.ts` `GET /ask/:requestId/final` · `services/ask/traces.ts` `toAskFinal` · `tests/ask/final-replay.test.ts` · `tests/ask/final-mapper.test.ts` · `tests/ask/trace-citations-column.test.ts` |
| 空库拒答 200 | `apps/api/src/services/ask/execute.ts` · `routes/ask.ts` · `tests/ask/http-stream.test.ts`（`kb_not_ready → 200`） |
| 会话 / 反馈 | `apps/api/src/routes/sessions.ts` · `routes/feedback.ts` |
| 入库 / 策略闸 / 入队 | `routes/documents/`（ARCH-P1a）· `services/chunk-strategies.ts` · `services/queue.ts` · `gates/` · contracts `chunk-strategy.ts` · `async/ingest-job.ts` |
| 上传 MIME / checksum | `gates/upload-media.ts` · `ingest-complete-pending.ts` · `tests/ingest/upload-media.test.ts` · `tests/ingest/complete-media.test.ts` |
| 入库报告 | `routes/ingest-report.ts` · `services/ingest-reports.ts` · `tests/ingest/ingest-report-http.test.ts` · `tests/ingest/ingest-report-map.test.ts` |
| 文档类型 / lifecycle | `routes/documents/index.ts` PATCH `docType` · `assertDocTypeAllowed` · `tests/ingest/document-doctype.test.ts` · `tests/ingest/document-lifecycle-http.test.ts` |
| 替代联动 | `POST /documents/:docId/supersede` · `services/document-supersede.ts` · `tests/ingest/document-supersede.test.ts` |
| 删除 / purge 入队 | `DELETE /documents/:docId` · `services/document-delete.ts` · `tests/ingest/document-delete.test.ts` |
| 建库闭环 | `routes/documents/index.ts` POST `/knowledge-bases` · `services/documents.ts` `createKb` · `tests/kb/create-kb.test.ts` |
| 分片只读 | `apps/api/src/routes/chunks.ts` · `services/chunks.ts` · `tests/ingest/chunks-http.test.ts` |
| 知识库设置 | `apps/api/src/routes/kb-settings.ts` · `services/kb-settings.ts` · `tests/kb/settings-http.test.ts` |
| 设置修改日志 | `routes/kb-settings.ts` GET `…/settings-audit` · `services/kb-settings-audit.ts` · `tests/kb/settings-audit-http.test.ts` |
| 模型网关 B3 | `apps/api/src/routes/model-gateway.ts` · `services/model-gateway.ts` · `tests/gateway/bindings-http.test.ts` |
| generate fallback | `services/gateway/resolve.ts` `generateFallbacks` · `http-client.ts` / `mock-client.ts` chat 切链 · `tests/gateway/generate-fallback.test.ts` |
| 数据面板 B6 | `apps/api/src/routes/dashboard.ts` · `services/dashboard.ts` · `tests/ops/dashboard-http.test.ts` |
| I4 双轨 tracks | `GET /admin/dashboard/tracks` · `DashboardTracksSchema` · `tests/ops/dashboard-http.test.ts` |
| 鉴权 / 成员 | `apps/api/src/auth/` · `routes/auth.ts` `meRoutes` · `routes/members.ts` · `tests/acl/me-permissions.test.ts` · `tests/acl/members-http.test.ts` |
| 启动引导超管 | `index.ts` · `services/superadmin-bootstrap.ts` · `services/password-hash.ts` · `env.ts` `SUPER_ADMIN_*` · `tests/acl/superadmin-bootstrap.test.ts` |
| 写路径锁超管全码 | `routes/platform-users-roles.ts` PUT/PATCH · `wouldChangeSuperAdminAwayFromFullCatalog` · `tests/acl/platform-users-roles.test.ts` |
| Gateway 运行时 / 检索 | `apps/api/src/services/gateway/`（`getGatewayForTenant` · `bindings.ts` · `resolve.ts`）· `services/retrieve/`（`corpus.ts` · `es-sparse.ts`（`buildAclFilter`）· `mongo-body.ts` · `filterDocsForRetrieve`） |
| 观测 | `apps/api/src/obs/` · `obs/metrics.ts` `isL3RewriteFused` · `obs/rate-limit.ts` 分平面 store · `tests/obs/quota-planes.test.ts` · `tests/obs/l3-rewrite-fuse.test.ts` |
| L1 工程 seed / followup 工程 | `fixtures/l1/gold.yaml` · `RACI.md` · `README.md` · `apps/api/src/eval/l1-matrix.ts` · `eval/adr046-snapshot.ts` · `scripts/run-l1-golden.ts` · `scripts/seed-es-sparse-probe.ts` · `packages/db/src/schema/ask/eval-runs.ts` · `docs/ops/live-retrieve-profile.md` · `turbo.json`（`L1_*` / `L1_PERSIST_EVAL`） |
| P2 评测底线 HTTP | `apps/api/src/routes/eval.ts` · `services/gold-questions.ts` · `services/eval-runs.ts` · `tests/eval/http-gold-questions.test.ts` · `tests/eval/http-eval-runs.test.ts` |
| L2 题面 + 工程 runner | `fixtures/l2/gold.yaml` · `README.md` · `RACI.md` · `sample-report.md` · `corpus/` · `apps/api/src/eval/l2-gold.ts` · `l2-fingerprint.ts` · `tests/eval/l2-gold.test.ts` · `scripts/run-l2-golden.ts` · `tests/eval/l2-cli.test.ts` · `turbo.json`（`L2_*`） |
| 环境变量默认值 | `apps/api/src/env.ts`（`RETRIEVE_ES_MODE=mock` · `AUTH_ENFORCE=false` · `SESSION_REWRITE_ENABLED=false` · `ASK_RATE_LIMIT_RPM=0` · `INGEST_RATE_LIMIT_RPM=0` · `SUPER_ADMIN_*` 可选）；L1 CLI 另读 `L1_KB_ID` 等（**非** `env.ts` Zod 必填） |
| 单测 | `apps/api/tests/<能力>/`；导航 `apps/api/tests/index.md`；HOW：`.trellis/spec/guides/testing.md` |
| P0 红线 | `docs/testing/p0-redlines.md` · `tests/ask/ready-active-corpus.test.ts`（R7）· `tests/ask/min-veto.test.ts`（R8）· `tests/ask/verify-required.test.ts`（R9） |
| Task（辅证 · 08-11 归档） | `archive/2026-08/08-11-b12-chunk-strategies` · `08-11-b13-feedback-ui` · `08-11-b2-w-kb-settings-wire` · `08-11-b3-w-gateway-read-db` · `08-11-b4-w-jwt-db-roles` · `08-11-b10-followup-eval-runs` · `08-11-ops-live-retrieve-profile` · `08-11-qual-auth-enforce-redline` · `08-11-qual-rerank-dual-node` · `08-11-qual-scan-engine`（QUAL-2 延期） |
| Task（辅证 · 08-12 归档） | `archive/2026-08/08-12-spec-arch-review-backlog` · `08-12-spec-w1-*` · `08-12-spec-w2-*` · `08-12-spec-closeout`（HOW 债；**非**业务抬成熟度） |
| Task（B1–B6 / S2 · 归档） | `08-06-b1-chunk-readonly` · `08-07-b2-kb-settings` · `08-07-b3-model-providers` · `08-07-b4-*` · `08-07-b5-*` · `08-09-b6-dashboard-shell` · `08-09-b10-l1-golden-min` · `08-05-phase-2-ask` |
| Task（辅证 · 08-14/08-15/08-16 归档） | `08-14-b10-followup-live-signoff` · `08-14-b10-followup-adr046-snapshot` · `08-15-p25-l2-gold-min` · `08-15-p25-rewrite-graph-min` · `08-16-p25-l2-runner-min` · `08-16-p25-l2-persist-min` · `08-16-p25-l3-metrics-min` · `08-16-p25-deepen-min` · `08-16-p25-doc-boost-min` · `08-16-p25-ext-min` · `08-16-p25-l3-alert-min` |
| 总 backlog | `.trellis/tasks/08-06-project-backlog/status.md` |
| 工程规范（HOW） | `.trellis/spec/api/backend/`（`ask-pipeline` · `chunk-strategies` · `auth-authorization` · `l1-eval` · `l2-eval` · `dashboard` 等） |
