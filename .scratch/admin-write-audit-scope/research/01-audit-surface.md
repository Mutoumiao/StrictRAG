# 现状核实：全量 mutating 路由 · PRD 审计要求 · 今天两层审计各覆盖什么

> Type: research · Status: done（工单 01）
> 只读：本工单未改任何源码 / PRD / 文档 / 测试。临时探针（`apps/api/tests/obs/_tmp-route-probe.test.ts` 与 `apps/api/tmp-*.json`）已在核完后删除，仓库无残留。
> 每条结论指到 `路径:行号`；区分【源码事实】与【推断】；全称否定附搜索范围与模式。

---

## 0. 方法与实测环境

- **路由枚举**：不在文档里手抄，而是**实际跑**了一次临时 vitest 探针，`createApp()` 后 dump `app.routes`，逐条对 50 条 mutating 路由调用真实的 `shouldAuditAdminWrite`。探针实测输出（命令 `pnpm exec vitest run tests/obs/_tmp-route-probe.test.ts`，exit 0）已作为下表依据。
- **`app.routes` 枚举可行性**：见 §2.2，实测结论：**可行**。
- **`c.req.path` 形状**：见 §2.1，实测探针输出。
- **PRD / ADR / 剧本**：逐文件 `Select-String`/grep 命中行 + 读上下文；行号实测，非凭记忆。
- **中文乱码**：本机 `Select-String`/grep 工具回读中文正常，未触发乱码兜底。

---

## 1. 全量 mutating 路由清单（事实底座）

**口径**：全仓 `POST/PUT/PATCH/DELETE`。注册面 = `apps/api/src/routes/**`（含 `documents/` 子目录）逐文件 + `apps/api/src/app.ts` 的每个 `app.route()`/内联注册 + `apps/api/src/openapi/routes.ts`。
**排除**：`GET` 全量；`/health`·`/ready`·`/metrics`（`app.ts:51/62/80`，均 GET）；`/api/v1/auth/*`；`/…/ask` 单列。

### 1.1 逐条表（`method` · 完整路径含 `/api/v1` 挂载前缀 · 守卫 · 作用 · 今天命中）

「今天命中」= `shouldAuditAdminWrite(method, path)` 实测结果（探针实跑，非推断）；命中列写命中的**正则名**。

| # | 注册 `文件:行` | method | 路径（含前缀） | 权限守卫 | 一句话作用 | 今天命中 |
|---|---|---|---|---|---|---|
| 1 | `routes/documents/index.ts:124` | POST | `/api/v1/knowledge-bases` | `requirePermissionWhenEnforced('kb.create')` | 建 KB；tenant 只认令牌 | **否** |
| 2 | `routes/documents/index.ts:176` | POST | `/api/v1/knowledge-bases/:kbId/documents/upload-url` | `requirePermissionWhenEnforced('doc.upload')` | 取预签名上传位；登记 uploaded 文档 | **否** |
| 3 | `routes/documents/index.ts:224` | PUT | `/api/v1/internal/objects` | `requirePermissionWhenEnforced('doc.upload')` | local 存储上传体 | **否** |
| 4 | `routes/documents/index.ts:256` | POST | `/api/v1/knowledge-bases/:kbId/documents/:docId/complete` | `requirePermissionWhenEnforced('doc.upload')` | ADR-039 权威 size 闸；置 pending 审批 | **否**（有意断言） |
| 5 | `routes/documents/index.ts:284` | POST | `/api/v1/knowledge-bases/:kbId/documents/write` | `requirePermissionWhenEnforced('doc.editor')` | 在线编写 MD，进审批 | **是** `write-post` |
| 6 | `routes/documents/index.ts:372` | POST | `/api/v1/documents/:docId/reindex` | `requirePermissionWhenEnforced('doc.reindex')` + 成员闸 | B12 单文档 reindex 入队 | **否** |
| 7 | `routes/documents/index.ts:444` | POST | `/api/v1/documents/:docId/approve` | `requirePermissionWhenEnforced('approval.decide')` + 成员闸 + 四眼 | 审批通过（释放入库） | **是** `approve\|reject` |
| 8 | `routes/documents/index.ts:485` | POST | `/api/v1/documents/:docId/reject` | `requirePermissionWhenEnforced('approval.decide')` + 成员闸 + 四眼 | 驳回 | **是** `approve\|reject` |
| 9 | `routes/documents/index.ts:526` | POST | `/api/v1/documents/:docId/scan` | `requirePermissionWhenEnforced('doc.upload')` + 成员闸 | 入队 `ingest.scan` | **否** |
| 10 | `routes/documents/index.ts:563` | PATCH | `/api/v1/documents/:docId/lifecycle` | `requirePermissionWhenEnforced('doc.lifecycle')` + 成员闸 | 改业务 lifecycle（draft/active…） | **是** `lifecycle` |
| 11 | `routes/documents/index.ts:598` | POST | `/api/v1/documents/:docId/supersede` | `requirePermissionWhenEnforced('doc.lifecycle')` + 成员闸 | 旧文 superseded、后继 active | **否** |
| 12 | `routes/documents/index.ts:641` | POST | `/api/v1/documents/:docId/dedupe-conflicts/:chunkId/resolve` | `requirePermission('doc.editor')` + 成员闸(`always`) | 跨 doc 去重人工二选一（剧本 E4） | **否** |
| 13 | `routes/documents/index.ts:679` | DELETE | `/api/v1/documents/:docId` | `requirePermissionWhenEnforced('doc.lifecycle')` + 成员闸 | archive + 入队 purge | **否** |
| 14 | `routes/documents/index.ts:717` | PATCH | `/api/v1/documents/:docId` | `requirePermission('doc.editor')` + 成员闸(`always`) | 改部门/可见级/docType/名单/生效区间 | **否** |
| 15 | `routes/documents/index.ts:859` | PUT | `/api/v1/documents/:docId/acl` | `requirePermission('doc.editor')` + 成员闸(`always`) | 文档 ACL 三态写 | **否** |
| 16 | `routes/members.ts:60` | POST | `/api/v1/knowledge-bases/:kbId/members` | `requirePermission('member.manage')` + 成员闸 | 邀请成员 | **是** `members` |
| 17 | `routes/members.ts:102` | PUT | `/api/v1/knowledge-bases/:kbId/members/:userId` | `requirePermission('member.manage')` | 改成员角色 | **是** `members` |
| 18 | `routes/members.ts:125` | DELETE | `/api/v1/knowledge-bases/:kbId/members/:userId` | `requirePermission('member.manage')` | 移除成员 | **是** `members` |
| 19 | `routes/kb-settings.ts:135` | PATCH | `/api/v1/knowledge-bases/:kbId/settings` | `requirePermission('kb.config.write')` + 成员闸 | KB 设置 PATCH；有 diff 落账本 | **是** `settings-patch` |
| 20 | `routes/kb-settings.ts:223` | PUT | `/api/v1/knowledge-bases/:kbId/model-bindings` | `requirePermission('kb.config.write')` | KB 消费端模型绑定 | **否** |
| 21 | `routes/chunk-strategies.ts:95` | PATCH | `/api/v1/knowledge-bases/:kbId/chunk-strategies` | `requirePermission('kb.config.write')` | 分片策略配置；有 diff 落账本 | **否** |
| 22 | `routes/model-gateway.ts:56` | POST | `/api/v1/admin/model-providers` | `requirePermission('model.gateway.manage')` | 新建 Provider | **是** `admin-prefix` |
| 23 | `routes/model-gateway.ts:95` | PATCH | `/api/v1/admin/model-providers/:id` | 同上 | 改 Provider | **是** `admin-prefix` |
| 24 | `routes/model-gateway.ts:134` | DELETE | `/api/v1/admin/model-providers/:id` | 同上 | 删 Provider | **是** `admin-prefix` |
| 25 | `routes/model-gateway.ts:170` | PUT | `/api/v1/admin/model-bindings` | 同上 | 平台绑定 | **是** `admin-prefix` |
| 26 | `routes/platform-users-roles.ts:79` | POST | `/api/v1/admin/roles` | `requirePermission('role.perm.manage')` | 建角色 | **是** `admin-prefix` |
| 27 | `routes/platform-users-roles.ts:122` | PATCH | `/api/v1/admin/roles/:roleId` | 同上 | 改角色 | **是** `admin-prefix` |
| 28 | `routes/platform-users-roles.ts:181` | PUT | `/api/v1/admin/roles/:roleId/permissions` | 同上 | 角色绑码 | **是** `admin-prefix` |
| 29 | `routes/platform-users-roles.ts:240` | POST | `/api/v1/admin/users` | `requirePermission('user.manage')` | 建平台用户 | **是** `admin-prefix` |
| 30 | `routes/platform-users-roles.ts:296` | PATCH | `/api/v1/admin/users/:userId` | 同上 | 改用户（含状态/角色） | **是** `admin-prefix` |
| 31 | `routes/platform-users-roles.ts:360` | POST | `/api/v1/admin/users/:userId/roles` | 同上 | 分配用户角色 | **是** `admin-prefix` |
| 32 | `routes/departments.ts:66` | POST | `/api/v1/admin/departments` | `requirePermission('dept.manage')` | 建部门 | **是** `admin-prefix` |
| 33 | `routes/departments.ts:116` | PATCH | `/api/v1/admin/departments/:deptId` | 同上 | 改部门/移子树 | **是** `admin-prefix` |
| 34 | `routes/departments.ts:184` | DELETE | `/api/v1/admin/departments/:deptId` | 同上 | 删部门 | **是** `admin-prefix` |
| 35 | `routes/departments.ts:225` | PUT | `/api/v1/admin/users/:userId/departments` | `requirePermission('user.manage')` | 设用户部门归属 | **是** `admin-prefix` |
| 36 | `routes/dept-grants.ts:84` | POST | `/api/v1/admin/dept-cross-grants` | `requirePermission('dept.manage')` | 建跨部门 grant | **是** `admin-prefix` |
| 37 | `routes/dept-grants.ts:126` | DELETE | `/api/v1/admin/dept-cross-grants/:id` | 同上 | 删跨部门 grant | **是** `admin-prefix` |
| 38 | `routes/sessions.ts:33` | POST | `/api/v1/knowledge-bases/:kbId/sessions` | `requireKbMember` | 建会话 | **否**（有意断言） |
| 39 | `routes/feedback.ts:101` | POST | `/api/v1/ask/:requestId/feedback` | `requireAuth()` + KB 成员闸 | 提交反馈 | **否** |
| 40 | `routes/feedback.ts:181` | PATCH | `/api/v1/feedback/:feedbackId` | `requireAuth()` + `feedback.queue` + 成员闸 | 处理反馈（可 promote 黄金题） | **否** |
| 41 | `routes/eval.ts:137` | POST | `/api/v1/knowledge-bases/:kbId/gold-questions` | `requirePermission('eval.run')` | 建黄金题 | **否** |
| 42 | `routes/eval.ts:161` | PATCH | `/api/v1/knowledge-bases/:kbId/gold-questions/:id` | 同上 | 改黄金题 | **否** |
| 43 | `routes/eval.ts:190` | DELETE | `/api/v1/knowledge-bases/:kbId/gold-questions/:id` | 同上 | 删黄金题 | **否** |
| 44 | `routes/eval.ts:238` | POST | `/api/v1/knowledge-bases/:kbId/eval/runs` | `requirePermission('eval.run')` | 入队评测批跑 | **否** |
| 45 | `routes/eval.ts:294` | POST | `/api/v1/internal/eval/execute-ask` | `x-eval-internal-token`（非用户令牌） | 内口 execute-ask（worker 批跑回填 τ） | **否** |
| 46 | `routes/auth.ts:37` | POST | `/api/v1/auth/admin/dev-login` | 无（仅 dev/test） | dev 登录 | **否**（auth 排除） |
| 47 | `routes/auth.ts:89` | POST | `/api/v1/auth/web/dev-login` | 无（仅 dev/test） | dev 登录 | **否**（auth 排除） |
| 48 | `routes/auth.ts:125` | POST | `/api/v1/auth/admin/token/refresh` | 无 | 续期 | **否**（auth 排除） |
| 49 | `routes/auth.ts:139` | POST | `/api/v1/auth/web/token/refresh` | 无 | 续期 | **否**（auth 排除） |
| 50 | `routes/ask.ts:238` | POST | `/api/v1/knowledge-bases/:kbId/ask` | `requireKbMember` | ask（SSE） | **否**（ask 排除） |

**实测小计**：50 条（distinct method+path）。**今天命中 24 条、未命中 26 条**。
分文件：`documents/index.ts` 15 · `model-gateway.ts` 4 · `platform-users-roles.ts` 6 · `departments.ts` 5 · `eval.ts` 5 · `auth.ts` 4 · `members.ts` 3 · `kb-settings.ts` 2 · `feedback.ts` 2 · `dept-grants.ts` 2 · `chunk-strategies.ts` 1 · `sessions.ts` 1 · `ask.ts` 1（含 `departments.ts:225` 与 `model-gateway` 计入对应文件）。

**别处注册的路由**：`app.ts` 内联仅 `GET /health`·`GET /ready`·`GET /metrics`（无 mutating）；`app.route('/')` 挂的 `openapi/routes.ts` 仅 `GET /api/v1/openapi.json`·`GET /api/v1/docs`（`openapi/routes.ts:55/62`）。**【源码事实】全仓 mutating 路由只存在于上表**（搜索范围：`apps/api/src/**`，模式 `\.(post|put|patch|delete)\(` 与 `app\.route\(`；worker / admin / web 无 HTTP mutating 注册）。

### 1.2 反向复核：`shouldAuditAdminWrite` 每条正则今天实际能命中哪些已注册路由

对 `admin-write-audit.ts:19-40` 的六条正则逐条反向跑（实测）：

| 正则（`admin-write-audit.ts` 行） | 今天命中的已注册路由 | 死规则？ |
|---|---|---|
| `members`（`:27`） | `POST`/`PUT`/`DELETE` `…/knowledge-bases/:kbId/members[/:userId]`（3 条） | 否 |
| `approve\|reject`（`:29`） | `POST …/documents/:docId/approve`、`POST …/documents/:docId/reject`（2 条） | 否 |
| `lifecycle`（`:31`） | `PATCH …/documents/:docId/lifecycle`（1 条） | 否 |
| `admin-prefix` `startsWith('/api/v1/admin/')`（`:33`） | 上表 17 条 mutating（`#22–#37`，去掉 `PUT …/admin/model-bindings` 外仍有 16…准确 17 条：model-gateway 4 + platform 6 + departments 4 + dept-grants 2 + `PUT kb.../model-bindings`? 否）→ **实测 17 条 mutating**（#22–#37 共 16 条，另 `GET /admin/*` 8 条被方法闸挡掉） | 否 |
| `settings-patch`（`:35`） | `PATCH …/knowledge-bases/:kbId/settings`（1 条） | 否 |
| `write-post`（`:37`） | `POST …/knowledge-bases/:kbId/documents/write`（1 条） | 否 |

> 说明：`admin-prefix` 正则本身也会命中 8 条 `GET /api/v1/admin/*`（`permission-catalog`/`roles`/`users`/`departments`/`model-providers`/`model-bindings`/`dept-cross-grants`/`dashboard`），但 `shouldAuditAdminWrite` 开头 `MUTATING` 闸（`:20-21`）先挡掉非写方法，故实际审计的只有 17 条 mutating。`members` 正则同样会命中 `GET …/members`，亦被方法闸挡掉。

**【源码事实】六条正则**今天**无一为死规则** —— 每条都至少命中 1 条真实注册路由。反向清单里**没有**「写了但永不命中」的规则。

> **纠正 issue 的一处猜测**：题面举例「`PUT …/admin/model-bindings` 这类形状是否真存在」——**存在**（`model-gateway.ts:170`，实测命中 `admin-prefix`）。同名前缀的 `PUT /api/v1/knowledge-bases/:kbId/model-bindings`（`kb-settings.ts:223`）**不**以 `/api/v1/admin/` 开头 → **不**命中（见 §4.4 缺口）。

---

## 2. 白名单机制的形状与可测性

### 2.1 挂载位置、执行顺序、`c.req.path` 形状

- **挂载**：`apps/api/src/app.ts:49` `app.use('*', adminWriteAuditMiddleware)`；顺序 = `requestId`(`:44`) → `secureHeaders`(`:45`) → `timeout`(`:46`) → `bodyLimit`(`:47`) → `attachAuth`(`:48`) → **`adminWriteAudit`(`:49`)** → 域路由(`:83-101`)。**【源码事实】**中间件在 auth **之后**（可取 `c.get('auth')`）、域路由**之前**（能覆盖所有域路由），注释见 `app.ts:40` 与 `admin-write-audit.ts:66-68`。
- **`c.req.path` 形状**（实测探针）：请求 `/api/v1/admin/users/abc?foo=bar&x=1` → `c.req.path === '/api/v1/admin/users/abc'`。即：**带 `/api/v1` 前缀**、**不含 query**、**无尾斜杠**（除非请求本身带）。`c.req.url` 才是含 query 的全 URL。→ 中间件用 `c.req.path` 判路径**正确**。
- **写时机**：`try/finally`（`admin-write-audit.ts:74-97`），handler 抛错也打点（`threw` → `status=500`，`:82`）。成功/失败**都出**一条。

### 2.2 【实测】Hono 4.x 能否从真实 app 枚举路由表

**结论：可行。** 探针实跑（`createApp()` 后 dump `app.routes`）：

- `app.routes` 是**数组**，元素键 = `['basePath','path','method','handler']`（`hasHandler` 均为 function）。`path` 是**含挂载前缀的完整路径**（如 `/api/v1/knowledge-bases/:kbId/documents/complete`）；`method` 为 `POST`/`PUT`/`PATCH`/`DELETE`/`GET` 或中间件的 `ALL`。
- **关键坑（决定反漂移测例写法）**：`app.routes` **按 handler 逐条展开** —— 一条路由若挂了 N 个 handler（路由级中间件 + 业务 handler），会出现 **N 条同 `method`+`path` 的记录**。实测：`GET …/ingest-report`（`memberMw` + `permMw` + handler）出现 **3 次**；`POST …/approve`（`requirePermissionWhenEnforced(...)` + handler）出现 **2 次**；只有单 handler 的 `POST /api/v1/auth/admin/dev-login`、`POST /api/v1/internal/eval/execute-ask` 各 **1 次**。⇒ 反漂移测例必须按 `(method, path)` **去重**后再断言。app 级中间件以 `ALL` + `/*` 出现（本例 6 条）。
- **`createApp()` 能否在测试里直接调用、是否连 DB / 起进程**：**可以，不连 DB、不起进程**。实测 `createApp()` 正常返回且后续 `.request()` 可跑；既有测试早已这么用（`apps/api/tests/env/health-ready.test.ts:14`、`error-envelope.test.ts:16` 等）。`createApp()` 只做中间件/路由装配，DB 连接是 `getDb()` 懒连（`services/db.js`），装配期不触发。**【源码事实 + 实测】**。

### 2.3 现成的「路由清单」可复用性

- `apps/api/src/openapi/document.ts` 有 OpenAPI 文档（`buildOpenApiDocument`），但它是**手写 schema 表**，不是从 `app.routes` 自动生成 —— 用它当路由清单会**漏**（且它的目的是文档，不是 SSOT）。
- `packages/contracts` 里**没有**集中路径常量表（搜索：全仓 `ROUTES`/路径常量未见）。域路由路径都是**各文件内字符串字面量**（如 `documentRoutes.post('/knowledge-bases'…)`）。**【源码事实】**
- ⇒ **唯一可靠可复用的「全量路由清单」来源 = `app.routes`**（运行时真实路由表）。既有测试无此枚举（搜索 `app.routes` 于 `apps/api/tests`：无命中）。⇒ 需**新写**反漂移测例。

### 2.4 「默认全审 + 显式例外」时，例外表需要的条目（今天必须排除的）

按「PRD 无留痕要求 ∧ 高频自助写」双判据，今天**明确要排除**的候选（供裁定票参考，本工单不下结论）：

| 路径 | 理由（事实） |
|---|---|
| `GET` 全量（含 `/api/v1/admin/*` GET） | 非写 |
| `POST /api/v1/knowledge-bases/:kbId/ask` | SSE 长连；#50；高频自助 |
| `POST /api/v1/auth/{admin,web}/{dev-login,token/refresh}` | 身份面；#46–49；高频（每次续期） |
| `POST /api/v1/knowledge-bases/:kbId/sessions` | 每次新会话一条；#38；**高频自助写** |
| `POST /api/v1/ask/:requestId/feedback` | 每次点赞/点踩一条；#39；高频自助写 |
| `PUT /api/v1/internal/objects` | 上传中转；#3；每次上传 |
| `POST …/documents/upload-url`、`POST …/documents/:docId/complete` | 每次上传 2 条；#2/#4 |
| `POST /api/v1/internal/eval/execute-ask` | 内口、非用户令牌；#45；噪声 |

---

## 3. PRD / ADR / 剧本的审计要求（逐条原文 + 出处行号）

### 3.1 `prds/05-api/01-http-api-hono.md`

| 行 | 原文 | 管哪个端点 |
|---|---|---|
| `:52` | 「**超管** \| `super_admin` 模板 → 全部路径允许（审计）」 | 超管全权（路径不限，泛要求） |
| `:104` | 「审计 \| 可写字段变更写 **修改日志**（diff）」 | §2.1.1 **KB settings PATCH**（`:90` 起） |
| `:131` | 「…升为 admin；**审计强制**」（成员 PUT 行的行内注释） | `PUT …/members/:userId` |
| `:190` | 「配置 \| `PATCH …/chunk-strategies` 须 `kb.config.write`；写 **审计日志**」 | `PATCH …/chunk-strategies` |
| `:435` | 小节标题「### 2.9 引用回溯（审计）」+ `:438` `GET /api/v1/ask/:requestId` | ask trace 读面（非写路径） |
| `:494` | 「审计 \| 角色/用户变更写 audit」 | §2.11 **平台用户与角色**（users/roles 写） |
| `:586` | 「### 5.2 试点默认包…变更须审计」 | 配置/门禁包（跨域） |
| `:662` | 检查单「- [ ] settings PATCH 白名单；…；**有审计**（ADR-054 / 剧本 **AB**）」 | KB settings PATCH 检查单 |

### 3.2 `prds/09-security/01-auth-acl-compliance.md`

| 行 | 原文 | 强度 |
|---|---|---|
| `:14` | 「身份可鉴别、资源可授权、**操作可审计**」 | 原则 |
| `:103` | 「**超管显式全权** \| …全路径；**审计** `actor_template=super_admin`」 | 超管写 |
| `:109` | 「**授码审计** \| 改角色树绑码、改用户角色**须审计**」 | roles/users 写 |
| `:234` | 「超管 \| 绕过部门规则（**审计**）」 | 部门可见性旁路 |
| `:252` | 「§3.8 B1-5 `super_admin` 非 kb_member ask / 管文档 → 200 允许（…**审计**）」 | 超管非成员管文档 |
| `:284` | 「**用户 question（检索）** \| ask 问句 …可记审计」 | ask（读面/问句） |
| `:309` | 「**审计** \| `evidence_snapshot` 与当轮校验一致」（§4.2） | trace 快照 |
| `:324` | 「## 5. 审计与观测明文边界（**ADR-035 + ADR-037**）」 | 章节 |
| `:328` | 「记录 \| 谁、何时、requestId、问句…、status/reason、配置快照 id、**下载/删除/ACL/成员变更**、**break-glass**」 | §5 记录清单（**明确含「删除 / ACL」**） |
| `:330` | 「**默认保留** \| ask/审计日志 **180 天**；…缩短须安全会签」 | 保留期 180 天 |
| `:358` | 「infected 处置 \| …**立即删** RustFS 对象 + **审计**（hash/filename/kbId/uploaderId/scanResult/timestamp/engineVersion）；**无隔离区**」 | §7 病毒扫描删除 |
| `:369` | 「**配置变更写审计** + 可触发再认证（见评测 PRD）」（§8 配置篡改防护） | **配置变更**（泛） |
| `:380` | 「- [ ] 审计保留期可配置且有默认 180 天；**break-glass 有审计**」（§9） | 验收 |
| `:382` | 「- [ ] P2：扫描强制；…infected 删+审计、无隔离区」 | 验收 |
| `:388` | 「- [ ] 非成员且非 `super_admin` 的平台账号不可见 KB evidence 明文（trace/审计）…」 | 读面边界 |

### 3.3 `prds/10-delivery/03-acceptance-scenarios.md`（逐行带「审计」的剧本行）

| 行 | 编号 | 原文（节选） | 主语是**哪条写路径** |
|---|---|---|---|
| `:35` | **B1-5** | 「`super_admin` 且非该 KB 成员 ask / 管文档 \| **200 允许**（…**须审计**）」 | 超管对 KB 的**任意**管理写（成员 / 文档 lifecycle 等，路径泛指） |
| `:171` | **K5** | 「`platform_admin` **非** kb_member 查 Langfuse/审计 → **无** 该 KB evidence 明文」 | **读面**（非写） |
| `:202` | **M2** | 「上传…EICAR 或 mock infected → …RustFS **对象已删**；**审计可查**」 | **worker** scan 阶段的 infected 删除（非 api 写路径） |
| `:208` | **M8** | 「infected 删除后 \| …**审计含 hash + uploaderId + timestamp**」 | 同上（worker） |
| `:264` | **P7** | 「换辅 \| 改 `judge_aux` → **审计事件** + 旧基线 `superseded`」 | `PUT /api/v1/admin/model-bindings`（平台绑定；#25） |
| `:345` | **T7** | 「审计 \| 存在 `stricter_than_pilot` + 相对默认 diff + `eval_runs` 关联」 | 加严门禁包（评测/配置域） |
| `:444` | **AA1** | 「改 KB 某策略参数并保存 \| **200**；有 **审计日志**…」 | `PATCH …/chunk-strategies`（#21） |
| `:462` | **AB2** | 「改 `name`、`allowedModes`、`defaultMode` 并保存 \| **200**；有 **审计日志**…」 | `PATCH …/knowledge-bases/:kbId/settings`（#19） |
| `:483` | **AC6** | 「KB 设置选 generate/embed/rerank 覆盖 …；**审计**」 | `PUT /api/v1/knowledge-bases/:kbId/model-bindings`（#20） |
| `:499` | **AD4** | 「超管建角色：树勾选 doc.* 等保存 \| **200**；**审计**」 | `POST /api/v1/admin/roles`（#26） |
| `:523` | **AE7** | 「给 X 跨部门 grant level≥30 \| X 可见 D_mgr；**审计有记录**」 | `POST /api/v1/admin/dept-cross-grants`（#36，**及删除** `DELETE …/:id` #37） |

### 3.4 `prds/11-decisions/00-adr-index.md`（指定 ADR 的审计/留痕条款）

- **ADR-035**（`:479-530`）：`:502` 「平台级能力（仅 `platform_admin`）：管理平台用户、模型网关/全局配置、系统指标、创建 KB、**break-glass 重指派 kb_admin**（**审计强制**；P2 可无主 UI…）」。无其它「审计」字样。
- **ADR-037**（`:576-612`）：`:596` 「审计 `evidence_snapshot`：与当轮校验一致」（决策 3 末条）。**:589** 观测服从成员边界（非「写路径留痕」，属读面）。
- **ADR-046**（`:994-1048`）：`:1023` 决策「#4 **配置 ↔ 签字包可审计绑定**」；`:1042` 否决项「高合规业务无法可审计加严」。管的是**加严门禁包**，非通用写路径。
- **ADR-051**（`:1336-1375`）：`:1360` 决策 6「超管全权：无需 kb_members 即可内容与平台全路径；**审计标记**。非超管仍须码。」
- **ADR-054**（`:1523-1600`）：`:1574` 决策 6「**审计与审批**：所有可写字段变更：**必须**写配置修改日志（who / when / kbId / field diff / 可选 reason）」；`:1591` 否决「**无审计**改 allowedModes / docTypes」；`:1561` 表格行「`route.rules` 完整可视化编辑器…（若做须**审计**+再认证提示）」。
- **ADR-057**（`:1792-1903`）：`:1832` 数据模型行「`dept_cross_grants` \| …\`reason\`、**审计**」；`:1868` 决策 5「超管：默认绕过部门可见性…；**审计**」；`:1892` 否决「跨部门**无审计**、无过期字段（长期授权须有原因审计）」。
- **ADR-062**（`:1939-1944`）：**通篇不含「审计 / 留痕 / 修改日志 / audit」**（搜索范围：该段 `:1939-1944`）。它讲签字包 τ 比对，与本图无关。
- **另需并列的同族条款**（题面点名之外，但对「写路径留痕」有直接要求）：
  - **ADR-020**（`:179-183`）`:182`「supersede 关闭旧版检索但**保留审计**」→ **supersede** 路径。
  - **ADR-053**（`:1436-1522`）`:1501`「**必须**写配置修改日志（谁、何时、旧→新、kbId）」· `:1502`「reindex 动作**审计**（谁、docId、选中 strategy、新 version）」· `:1514` 否决「**无审计**改配置」→ **chunk-strategies + reindex** 两路径。
  - **ADR-055**（`:1600-1692`）`:1626`「ModelRef…全站绑定与**审计**用此 id」· `:1659`「变更 `judge`/`embed`/`rerank`…：**审计** + UI 再认证提示」→ 模型绑定路径。
  - **ADR-048**（`:1116+`）`:1160`「…可配置 `allowSelfApprove` 显式打开并**审计**」· `:1161`「…走 break-glass 流程…**须审计**」。
  - **ADR-039**（`:649+`）`:666`「#4 infected = 删除 + **审计**…」→ worker 域。
  - **ADR-042**（`:778+`）`:800`「换 `roles.judge_aux`：**必须审计**（谁/何时/何模型/原因）…」· `:811` 否决「换辅**无审计**」。

### 3.5 `prds/06-async` 与 `prds/08-quality`（只列与**写路径留痕**相关）

- `prds/06-async/01-bullmq-jobs.md`：`:44`「infected \| `failed` + `MALWARE`；**删** RustFS 对象 + **审计**；**不** parse、**不**物化 manifest」；`:132`「**MALWARE 另写审计并删对象**」；`:163`「回滚 \| router 指回共享名 + **审计**」。均为 **worker** 阶段，非 api 写路径。
- `prds/08-quality/02-evaluation-and-gates.md`：`:108` 换辅流程「**审计** \| 谁、何时、旧/新 `provider+model`、原因」；`:200`「**更换 `roles.judge_aux`** …→ **审计** + 基线 superseded」。
- `prds/08-quality/03-langfuse-observability.md`：`:118`「换 `roles.judge_aux` \| **审计** + 旧基线标 `superseded`…」。
- `prds/08-quality/01-verification-and-abstention.md`：`:127`「换 `roles.judge_aux` 不走本校准路径（ADR-042 #3：**审计** + 基线重置）」。

### 3.6 结论层：PRD 对「痕」的强度**有分级**吗？（判断 + 依据；推断标注）

**【判断】有，且大致分三档**（依据逐条指上方行号）：

1. **明写「修改日志 / diff / 可查账」（最强档）**：
   - KB settings PATCH —— `05-api:104`「写**修改日志（diff）**」+ ADR-054`:1574`「**必须**写配置修改日志（who/when/kbId/field diff/可选 reason）」+ `09-security:369`「配置变更写审计」。→ 要求**含变更内容**、可回溯。
   - `PATCH …/chunk-strategies` —— `05-api:190`「写**审计日志**」+ ADR-053`:1501`「**必须**写配置修改日志（谁、何时、旧→新、kbId）」+ 剧本 AA1「有审计日志」。→ 同属「含旧→新」。
   - 【推断】这两条是本仓**唯一**被明写「diff / 旧→新」的写路径；今天也正对应唯一持久化账本 `kb_settings_audits`（§4.2）。
2. **明写「写 audit / 审计」但未规定形态（中档）**：
   - `05-api:494`「角色/用户变更写 audit」· ADR-051`:1360`「审计标记」· `09-security:109`「授码审计」。
   - ADR-057`:1832/:1892` 跨部门 grant「审计」· 剧本 AE7「审计有记录」。
   - ADR-053`:1502` reindex「动作审计（谁、docId、选中 strategy、新 version）」——【推断】这条其实**接近第 1 档**（列了字段），但未用「diff」字眼，故归中档。
   - ADR-020`:182` supersede「保留审计」。
3. **只写「审计」/「有记录」/「可查」（最弱档，含「须审计」泛句）**：
   - `05-api:52/:131/:586`、`09-security:103/:234/:252/:284/:380/:388`、剧本 **B1-5**「须审计」、**P7**「审计事件」、**AD4**「审计」、**AC6**「审计」。
   - **M2/M8 + ADR-039/042/06-async** 的 infected / 换辅：明写**字段清单**（hash/uploaderId/timestamp；谁/何时/旧新 provider+model/原因）——【推断】强度介于 2、3 之间，且**不在 api 写路径**（worker / 配置域）。

**【来源限定】**：
- 「分级」是本工单**基于文本措辞**的归纳，**非** PRD 显式声明分级。PRD 从未出现「审计强度分级」这类元约定。**【推断】**
- `09-security:328`「记录…**下载/删除/ACL/成员变更**、break-glass」是**唯一**把「删除」「ACL」写进记录的条款 —— 它**明确含** `DELETE` 与 ACL 写路径。**【源码事实】** ⇒ 这条是「文档处置类写」若要找 PRD 依据时最直接的一条（但它的载体是「审计与观测明文边界」段，未指明落表/落 Pino）。

---

## 4. 今天两层审计各覆盖什么（实现事实）

### 4.1 `admin_write`（Pino 结构化行）

- **载荷**（`admin-write-audit.ts:42-61` `buildAdminWritePayload` / `AdminWriteLogPayload`）：仅 `{ event:'admin_write', method, path, status, durationMs }`。**无 body、无字段值、无 diff**。
- **上下文**（`:83-93`）：`childLogger({ requestId, userId, tenantId, kbId })`；`kbId` 由 `extractKbIdFromPath`（`:8-11`）从 `/knowledge-bases/([^/]+)` 抠。
- **写入时机**：`finally`（`:79`），成功与抛错**都写**；抛错时 `status` 记 500（`:82`）。
- **读取面 / 保留期**：**【源码事实】无读取端点、无查询、无留存配置**。Pino 默认写 **stdout**（`logger.ts:8-19`，`base={service,env}`；dev 走 `pino-pretty`，非 dev 无 transport）。env 只有 `LOG_LEVEL`（`env.ts:22`），**无** 保留/轮转键。搜索范围：`apps/api/src`（`pino`/`transport`/`retention`/`LOG_*`）与 `env.ts`。⇒ `admin_write` 今天**不能**满足「可查账」（除非外部日志采集，仓内无配置）。**【未核】**：生产是否有外部 Pino collector —— 仓内无证据。

### 4.2 `kb_settings_audits`（持久化账本）

- **表**：`packages/db/src/schema/kb/kb-settings-audits.ts:11` `pgTable('kb_settings_audits')`，列 `tenant_id`/`kb_id`/`actor_user_id`/`diff_json`(`jsonb`) + base columns；迁移 `packages/db/drizzle/0013_kb_settings_audits.sql:1`。**全仓唯一审计表**（搜索 `_audit`/`audits` 于 `packages/db`：仅此）。
- **谁写**（`:15` 类型 `KbSettingsAuditInsert`）：
  - **KB settings PATCH**：`routes/kb-settings.ts:186-195`，仅当 `Object.keys(merged.diff).length > 0`（`:175`）时 `auditRepo.insert(...)`；`actorUserId = auth?.userId ?? ''`，`tenantId = resolveTenantId(auth?.tenantId)`。
  - **chunk-strategies PATCH**：`routes/chunk-strategies.ts:121-127`，**复用同一 repo**（`auditRepo = deps.auditRepo ?? kbSettingsAuditRepo`，`:44`），仅 `applied.diff` 非空时写。
  - ⇒ **【源码事实】账本服务两条路径**（settings PATCH + chunk-strategies PATCH），**不是**只服务 KB settings 一条。题面说「是不是只服务 KB settings PATCH」→ **否**。
- **`diffJson` 形状**：`KbSettingsAuditDiff = Record<string, { from: unknown; to: unknown }>`（schema `:5`；契约 `packages/contracts/src/kb/settings-audit.contract.ts:4-13`）。chunk-strategies 的键形如 `chunkStrategy.<code>.<field>`（实测见 `tests/kb/chunk-strategy-audit.test.ts:114-116`）。
- **读面**：`GET /api/v1/knowledge-bases/:kbId/settings-audit`（`kb-settings.ts:200-208`），权限 `requirePermission('kb.config.write')`（**同写码**）+ KB 成员闸；默认 **50** 条（`SETTINGS_AUDIT_LIST_LIMIT`，`services/kb-settings-audit.ts:8`），`desc(createdAt),desc(id)` 排序；缺库 404，空列表 200。admin 前端读面：`apps/admin/src/app/(ops)/kb/settings/{api.ts:28,services.ts:66}`。
- **失败 PATCH 是否写**：**不写** —— 早退分支（`:137-149` 的 rewrite 锁、`:151` 校验失败、`:157/171` 404）都在 `insert`（`:186`）之前 return。**【源码事实】**（`tests/kb/settings-audit-http.test.ts` 钉「空 diff 不增行 / 失败不写」）。
- **成员闸**：写路径经 `write = requirePermission('kb.config.write', { resolveKbMember })`（`kb-settings.ts:119-121`）；读面同码同成员闸。**【源码事实】**
- **`apps/api/tests/kb/chunk-strategy-audit.test.ts` 到底在测什么**：不是测中间件，而是**测 `PATCH …/chunk-strategies` 的持久化修改日志**——「有 diff → 落一条（记 actor + 旧→新，`:104-117`）」「同值无 diff → 不落（`:119-127`）」「`paramOverrides` 有 diff → 记键 `chunkStrategy.<code>.paramOverrides`（`:130-150`）」「非法 PATCH 400 → 不落（`:154-160`）」，并断言「**不碰**文档版本与快照」（`:151-152`）。用的是**注入的 memory auditRepo**（`:67`），与 `admin_write` 中间件**无关**。文件头 `:1-6` 自陈「复用 KB 设置审计表（不新建表）」。

### 4.3 全仓「第三处」留痕：inline 领域事件

**【源码事实】**除 `admin_write` 与 `kb_settings_audits` 外，仓内还有一类 `childLogger(...).info({ event: … })` 的**领域事件**（写路径内的结构化 Pino 行）。逐条列 `event:` 名 + 写点行（搜索范围：`apps/api/src`，模式 `event:\s*'[a-z_]+'`）：

| `event:` | 写点 `文件:行` | 属性 |
|---|---|---|
| `kb_settings_patch` | `routes/kb-settings.ts:182` | **写路径**（settings PATCH），**带 `diff`** |
| `chunk_strategy_patch` | `routes/chunk-strategies.ts:118` | **写路径**（chunk-strategies PATCH），**带 `diff`** |
| `chunk_strategy_reindex` | `routes/documents/index.ts:419` | **写路径**（reindex），带 docId/strategy/jobId |
| `doc_acl_tightened` | `routes/documents/index.ts:882` | **写路径**（ACL 收紧触发 reindex 提示） |
| `dept_cross_grant_create` | `routes/dept-grants.ts:112` | **写路径**，带 grantId/userId/deptId |
| `dept_cross_grant_delete` | `routes/dept-grants.ts:142` | **写路径**，带 grantId |
| `department_create` | `routes/departments.ts:98` | 写路径 |
| `department_patch` | `routes/departments.ts:171` / `:178` | 写路径（两支：parentMoved / 普通） |
| `department_delete` | `routes/departments.ts:204` | 写路径 |
| `user_departments_put` | `routes/departments.ts:280` | 写路径 |
| `platform_role_create` | `routes/platform-users-roles.ts:104` | 写路径 |
| `platform_role_patch` | `routes/platform-users-roles.ts:175` | 写路径 |
| `platform_role_permissions` | `routes/platform-users-roles.ts:213` | 写路径 |
| `platform_user_create` | `routes/platform-users-roles.ts:275` | 写路径 |
| `platform_user_patch` | `routes/platform-users-roles.ts:350` | 写路径 |
| `platform_user_roles` | `routes/platform-users-roles.ts:400` | 写路径 |
| `model_provider_create` | `routes/model-gateway.ts:73` | 写路径 |
| `model_provider_patch` | `routes/model-gateway.ts:124` | 写路径（含 `apiKeyUpdated` 布尔，不含 Key） |
| `model_provider_delete` | `routes/model-gateway.ts:158` | 写路径 |
| `model_bindings_put` | `routes/model-gateway.ts:194` | 写路径 |
| `gate_package_rejected` | `routes/kb-settings.ts:83` | **读面**（GET settings 时拒绝包），非写 |
| `dept_acl_bypass` | `routes/documents/index.ts:158` / `:809`；`routes/chunks.ts:66`；`services/retrieve/retrieve.ts:133` | **读面**旁路告警，非写 |

**【源码事实】这些领域事件只覆盖 `/api/v1/admin/*` 写 + KB 配置两条**；对应 §1.1 的 `#22–#37`（管理写）与 `#19/#21`（KB 配置）、以及 reindex/ACL 两处。**它们是「通用操作日志」之外的、带业务语义的写点留痕**，可视为**部分**审计（有谁改了什么的意思，但只落 stdout，同样无读面/留存）。
**【重要纠正】** 题面举例「`supersede`、`resolve`、`lifecycle 变更` 的领域事件」——**【源码事实】这三条写路径今天完全没有 `event:` 领域事件**（搜索范围：`apps/api/src/**`，模式 `event:`；`supersede`/`resolve`/`lifecycle` 相关写点 `documents/index.ts:598/641/563` 内**只有 DB 写入、无 logger 调用**）。⇒ 「第三处留痕」并未覆盖它们。

### 4.4 逐路径对照表（今天 **有** 的痕 × PRD **要求** 的痕 + 缺口）

「今天的痕」取值：**无** / **admin_write**（Pino）/ **领域事件**（Pino，带语义）/ **持久化账本**（`kb_settings_audits`）。PRD 列按 §3 原文。

| 路径 | 今天的痕 | PRD 要求的痕 | 缺口 |
|---|---|---|---|
| `PATCH …/settings` (#19) | `admin_write` + 领域事件(带 diff) + **账本** | `05-api:104` 修改日志(diff)（强） | **已闭环** |
| `PATCH …/chunk-strategies` (#21) | 领域事件(带 diff) + **账本**（**无** `admin_write`） | `05-api:190` 审计日志（强） | **已闭环**（缺 `admin_write` 不影响，账本已含旧→新） |
| `PUT …/admin/model-bindings` (#25) | `admin_write` + 领域事件 | P7/ADR-055 审计（要求含旧/新 provider+model） | 有痕，**缺「旧/新/原因」字段** |
| `POST …/documents/write` (#5) | `admin_write` | `05-api:52` 泛「审计」 | 有痕 |
| members POST/PUT/DELETE (#16–18) | `admin_write` | `05-api:131`「审计强制」· `09-security:328` 成员变更 | 有痕 |
| approve/reject (#7–8) | `admin_write` | `05-api:52` 泛 | 有痕 |
| `PATCH …/lifecycle` (#10) | `admin_write` | `09-security:328`「删除」近邻（lifecycle 未单列） | 有痕 |
| `POST …/admin/dept-cross-grants` + `DELETE …/:id` (#36–37) | `admin_write` + 领域事件 | ADR-057`:1832/:1892`、剧本 **AE7**「审计有记录」 | **已满足**（见 §6.3） |
| 其余 `/api/v1/admin/*` 写（#22–35） | `admin_write` + 领域事件 | `05-api:494`「角色/用户变更写 audit」· `09-security:109` | 有痕（**缺含「改了什么」的账本**） |
| `POST …/documents/:docId/supersede` (#11) | **无** | ADR-020`:182`「保留审计」 | **缺口**：完全无痕 |
| `POST …/dedupe-conflicts/:chunkId/resolve` (#12) | **无** | 无直接条款（最近 `09-security:328`「删除」类） | **缺口**：完全无痕 |
| `PATCH /documents/:docId` (#14) | **无** | `09-security:328`「ACL/成员变更」近邻；`09-security:369` 配置变更（非 KB 文档元数据） | **缺口**：完全无痕 |
| `PUT /documents/:docId/acl` (#15) | **无** | `09-security:328` **明写「ACL」** | **缺口**：完全无痕 |
| `DELETE /documents/:docId` (#13) | **无** | `09-security:328` **明写「删除」** | **缺口**：完全无痕 |
| `POST …/documents/:docId/reindex` (#6) | 领域事件(`chunk_strategy_reindex`) | ADR-053`:1502` reindex 动作审计 | 有痕（字段含 docId/strategy/jobId），**缺「谁」(payload 无 userId)** |
| `POST …/documents/:docId/scan` (#9) | **无** | 无直接条款 | **缺口** |
| `POST …/complete` (#4) | **无** | 无直接条款（有意排除） | 无要求 |
| `PUT …/knowledge-bases/:kbId/model-bindings` (#20) | **无** | 剧本 **AC6**「审计」 | **缺口** |
| `PATCH /feedback/:feedbackId` (#40) | **无** | 无直接条款 | 无要求 |
| gold-questions / eval 写 (#41–44) | **无** | 无直接条款 | 无要求 |
| sessions (#38)、ask 反馈 (#39)、upload 流 (#1–3) | **无** | 无 | 无要求 |

**【推断】** 缺口最集中的是「文档内容处置/状态迁移类」四条（#11/#12/#14/#15）+ `DELETE /documents/:docId`(#13) + `POST …/scan`(#9) —— 前四条正是 backlog §0 未决行点名的四条。

---

## 5. 既有测例与登记现状

### 5.1 `apps/api/tests/obs/admin-write-audit.test.ts` 逐组断言（行号）

- `describe('shouldAuditAdminWrite')`（`:39`）：
  - `:40-50` 「成员 / 审批 / 生命周期写 → true」：`:42` members POST true · `:45` members DELETE true · `:47` approve true · `:48` reject true · `:49` lifecycle true。
  - `:52-62` 「平台 admin 写 + KB settings PATCH → true」：`:53` admin/users true · `:54` admin/roles true · `:55` `PUT /api/v1/admin/model-bindings` true · `:57` settings PATCH true · `:60` documents/write true。
  - `:64-74` 「GET / ask / auth / health → false」：`:65` GET members false · `:68` ask false · `:69/:70` auth false · `:71-73` health/ready/metrics false。
  - **`:76-86` 「非管理写（upload complete / sessions）→ false」**：`:78-81` **`complete` → false** · `:84` **`sessions` → false**。← **这两条是有意断言**（map「改既有测例的红线」）。
- `describe('extractKbIdFromPath / buildAdminWritePayload')`（`:88`）：`:90-93` 抠 kbId；`:95-110` payload 字段 + 无敏感键；`:112-117` 敏感键判定。
- `describe('adminWriteAuditMiddleware')`（`:120`）：`:145-183` 写路径打完 → `info` 1 次、`msg='admin write'`、payload 形状、上下文 `{requestId,userId,tenantId}`；`:185-205` handler throw 仍打点 `status=500`；`:207-220` 「GET 与 ask 不打操作日志」（`info` **not** called）；`:222-264` 剧本 B1-5 超管非成员文档写仍落 `admin_write` 且上下文带 `kbId`。

### 5.2 登记现状

- `apps/api/tests/index.md:200`：
  「`obs/admin-write-audit.test.ts` \| 管理写路径必须打审计日志且不落表、不含敏感键；超管非成员写仍可追溯。 \| ARCH-P1b-2 · 剧本 B1-5 \| `adminWriteAuditMiddleware / shouldAuditAdminWrite` \| 不落表；KB 作用域写日志上下文带 kbId。 \| 现行」。
- `docs/testing/coverage/03-ops.md`：`:127`（AB2 行，列 `obs/admin-write-audit.test.ts`「settings PATCH 应打 `admin_write` Pino，不落表」）· `:146`（AC6 行，列「`PATCH /knowledge-bases/:kbId/settings` 打 `admin_write`」）· `:160`（AD4 行，列「`/admin/roles` 写应审计…审计为中间件命中，非本 POST 日志体」）。
- `docs/testing/coverage/02-acl.md:27`（B1-5 行，列 admin-write-audit 的「剧本 B1-5」用例）。
- `apps/api/tests/acl/dept-grants-http.test.ts` 也 import 中间件（`:16`）并在 `:369` 挂载；含两例 AE7 审计（`:306-350` 路由级、`:352-395` 中间件级）。

### 5.3 若名单变化，**会翻**的既有断言

1. **`apps/api/tests/obs/admin-write-audit.test.ts:76-86`**：若新口径把 `POST …/documents/:docId/complete`(#4) 或 `POST …/sessions`(#38) 判成「要审」，则 `:81`「`complete` → false」与 `:84`「`sessions` → false」**直接翻**。**这是唯一一处把「不审」写成硬断言的用例**。map 红线要求：翻必须**先裁定、再改断言**。
2. **`apps/api/tests/obs/admin-write-audit.test.ts:207-220`**「GET 与 ask 不打操作日志」：只要 GET / ask 仍排除就不翻；若口径把 ask 纳入则翻（当前 PRD 无此要求）。
3. **HTTP 级「断言日志调用次数」类用例**：搜索 `apps/api/tests`（模式 `toHaveBeenCalledTimes(1)` / `not.toHaveBeenCalled` 与 `childLogger`）→ 断言 `childLogger().info` **次数**的只有 `admin-write-audit.test.ts`（`:163/:199/:219/:255`）。`dept-grants-http.test.ts` 用 `payloads.find(p=>p.event===...)`（`:340-341/:388-391`），**不断言次数** ⇒ **不因新增审计行翻**。**【源码事实】除此之外无别的「全 app + mock childLogger + 断言 info 次数」用例**（搜索范围：`apps/api/tests/**`）。
4. `apps/api/tests/kb/chunk-strategy-audit.test.ts`、`settings-audit-http.test.ts` 等**走注入的 memory auditRepo**，不经过 `admin_write` 中间件 ⇒ 不受白名单变化影响。

---

## 6. 反向复核（防高估）

### 6.1 有没有别处已实现「管理写 = 全量 mutating 减例外」的口径/清单？

**【全称否定·附范围】** 搜索范围：全仓（`apps/`+`packages/`+`docs/`+`prds/`+`.trellis/`+`.scratch/`），模式 `AUDITED_|shouldAudit|auditPath|MUTATING_|ADMIN_WRITE` 与 `ROUTES`/路径常量表。**【源码事实】没有**：
- 唯一的「管理写判定」就是 `admin-write-audit.ts:19-40` 的六个手写正则；
- **无** `AUDITED_*` 常量、**无**集中路由清单常量表、**无**权限码驱动中间件枚举写路径；
- `openapi/document.ts` 是手写文档 schema，不构成 path SSOT（见 §2.3）。
⇒ 本项**不是重复功**：除本图外无人做过「全量 mutating − 例外」口径。

### 6.2 既有裁定/债行是否已声明本项不做或延后？（原文 + 出处）

- **总 backlog §0 未决行**（`.trellis/tasks/08-06-project-backlog/status.md:31`）：
  「**文档内容处置类写审计口径（未决 · 2026-10-09）** \| `admin-write-audit.ts` 白名单覆盖成员 / 审批 / 生命周期 / 平台 admin / KB 设置写，**不含** `POST …/dedupe-conflicts/:chunkId/resolve` · `POST …/supersede` · `PATCH /documents/:docId` · `PUT /documents/:docId/acl`。只给其中之一开口会造成同类路径口径分裂 → **先定「哪些路径属管理写」再一次性对齐 + 补测**；出处 = wayfinder 图 `.scratch/pending-review-ops/`（工单 02 裁定）」。⇒ **明写为「未决、待定口径」**，即本图要收的口子。
- **`.scratch/pending-review-ops/issues/02-dec-review-surface.md:50`**：裁定「本图只做『可见可办』；要不要把『文档内容处置类』整体纳入 Pino 写审计白名单，须先定『哪些路径属管理写』的口径 → 记入 `Not yet specified`」。
- **`.scratch/pending-review-ops/map.md:57`**：同债的完整表述（点名四条路径，准入 = 先定口径）。
- **`.scratch/fog-inventory-2026-09-23.md:38`「簇 10」**：`| 10 | 跨部门 grant 的**删除**要不要留痕 | P3b 出口 AE7 行 | 能（先裁删除留痕口径） | 交付剧本 AE7「审计有记录」· ADR-057 否决条「长期授权须有原因审计」 |`。
- **`.scratch/p3b-principal-forms/map.md:54`**：「grant 写审计是否落表：今天只有 Pino（`routes/dept-grants.ts` 的 `dept_cross_grant_*` + 中间件的 `admin_write`），AE7… ADR-057 也写「审计」。**落表要先裁**『Then 是否要求表级证据』」。
- **`docs/module-status/api.md:47`**（dedupe 端点行 …）」：「…**零审计**（不在 `admin-write-audit` 白名单，与 `PATCH /documents/:docId` / `POST …/supersede` 同类未纳入；统一口径属**未裁事项**）」。
- 【判断】以上**均为「未决/待裁」**，**无任何一处**声明「本项永久不做」。⇒ 本图不撞既有裁定；相反，它就是那张「定案图」。

### 6.3 簇 10：跨部门 grant 的**删除**要不要留痕 —— 今天的事实

- **路径**：`apps/api/src/routes/dept-grants.ts:126` `routes.delete('/admin/dept-cross-grants/:id', manage, …)`，挂载前缀 `/api/v1`（`app.ts:96`）⇒ **完整路径 `/api/v1/admin/dept-cross-grants/:id`，落在 `/api/v1/admin/` 前缀下**。
- **是否被 `admin_write` 命中**：**是**。实测 `shouldAuditAdminWrite('DELETE','/api/v1/admin/dept-cross-grants/:id')` → **true**（`admin-prefix` 规则，`admin-write-audit.ts:33`）。
- **领域事件**：`dept_cross_grant_delete`（`dept-grants.ts:142`，带 `grantId`）。
- **既有测例已正面钉住 AE7**：`apps/api/tests/acl/dept-grants-http.test.ts:306-350`（路由级：POST/DELETE 各留一条 `dept_cross_grant_*`，CREATE 带 `grantId`/`userId`/`deptId`，上下文带 actor）+ `:352-395`（中间件级：`/api/v1/admin/` 前缀的 grant 写落一条 `admin_write`）。
- **【判断】AE7「审计有记录」在今天的事实下 —— 对 `admin_write` 层（Pino）已满足；对「表级留痕」未满足**（`.scratch/p3b-principal-forms/map.md:54` 已记此债）。删除与创建**都**有 Pino 痕（`admin_write` + 领域事件）。⇒ 簇 10 若要的是「Pino 有记录」，**已满足**；若要「可查账的持久化行」，**仍缺**（须另裁，见 §6.2）。

### 6.4 `docs/module-status/api.md` 关于 `admin_write`/管理写审计的原文句

- `docs/module-status/api.md:26`（**原文**）：
  「**ARCH-P1b-2 管理写操作日志**：`middleware/admin-write-audit.ts` 在 auth 之后，对成员 / 审批 / lifecycle / `/admin/*` 写 / KB settings PATCH 打 `event:admin_write` 日志（Pino；**不**落审计表；排除 GET / ask / auth）」。
  ——注：此句**未**列「在线编写 `documents/write`」（实现命中但它没写），与源码略不一致。
- `docs/module-status/api.md:60`（**原文**）：「**修改日志最小闭环**：PATCH 成功且 `merged.diff` 非空时插入 `kb_settings_audits`（actor = 令牌 userId；tenant = 令牌租户，缺则 `DEV_DEFAULT_TENANT`）；空 diff / 失败 PATCH 不写。`GET /knowledge-bases/:kbId/settings-audit` 同码 + 成员闸；新在前，上限 50；空列表 200；缺库 404…。**不是** `admin_write` 中间件落表」。
- `docs/module-status/api.md:44`：「…改库启用 **不** 自动 reindex…；PATCH **有 diff** 落 `kb_settings_audits`…（复用 KB 设置审计表，**不新建表**）」。
- `docs/module-status/api.md:164`（债/未做行）：「审计管理台 \| **无**搜索 / 过滤 / 导出；Langfuse 仍 mock 日志」。
- `docs/module-status/api.md:233`（清单行）：「设置修改日志 \| `routes/kb-settings.ts` GET `…/settings-audit` · `services/kb-settings-audit.ts` · `tests/kb/settings-audit-http.test.ts`」。
- 另 `:10`（最近更新）有一段较长的 dedupe 落地叙述，含「**零审计**…统一口径属未裁事项」（与 `:47` 同）。

---

## 7. 噪声与代价（为裁定准备，**不下结论**）

### 7.1 若改「默认审计 + 显式例外」：**新增**会被打点的路径 + 频率量级

今天命中 24 条，未命中 26 条。若「默认全审」，**新增**打点的是**未命中的 26 条减去例外表条目**。逐条估频率（**量级判断，标注为推断**）：

| 路径 | 发生频率量级【推断】 | 是否**高频自助写** |
|---|---|---|
| `POST …/sessions` (#38) | **每新会话 1 条**（用户每开一轮对话即一次） | **最高频**（自助） |
| `POST /ask/:requestId/feedback` (#39) | **每次点赞/点踩 1 条** | 高频自助 |
| `POST …/documents/upload-url` (#2) + `PUT /internal/objects` (#3) + `POST …/complete` (#4) | **每次上传各 1 条**（同一上传 3 条） | 高频自助（上传者） |
| `POST …/documents/:docId/scan` (#9)、`POST …/reindex` (#6) | 每次审批/重索引 1 条 | 运营动作 |
| `POST …/documents/write` (#5) | 每次在线编写 1 条 | 自助（已命中） |
| `POST`/`PATCH`/`DELETE` gold-questions、`POST …/eval/runs` (#41–44) | 运营/评测动作，低频 | 运营 |
| `PUT …/knowledge-bases/:kbId/model-bindings` (#20)、`PATCH /feedback/:feedbackId` (#40) | 运营动作，低频 | 运营 |
| `PATCH /documents/:docId` (#14)、`PUT …/acl` (#15)、`POST …/supersede` (#11)、`DELETE /documents/:docId` (#13)、`resolve` (#12) | 运营动作，低频 | 运营 |
| `POST /api/v1/knowledge-bases` (#1) | 建库，极低频 | 运营 |
| `auth` 四条 (#46–49) | 续期高频，但属身份面 | —— |

**高频自助写（会显著放大日志量）**：`sessions`(#38) > `feedback`(#39) > 上传三连(#2/#3/#4)。这三组是「若默认全审则噪声的主要来源」，也是例外表最需要覆盖的（见 §2.4）。

### 7.2 「同一请求被打两次」的现状

**存在**（领域事件 + `admin_write` 各一行）。今天**已经是**这样的路径：

| 路径 | 领域事件 + `admin_write` |
|---|---|
| `PATCH …/settings` (#19) | `kb_settings_patch`(带 diff) + `admin_write` |
| 全部 `/api/v1/admin/*` 写 (#22–37) | `platform_role_*`/`platform_user_*`/`department_*`/`user_departments_put`/`model_provider_*`/`model_bindings_put`/`dept_cross_grant_*` + `admin_write` |
| `POST …/documents/write` (#5) | （无领域事件）仅 `admin_write` |

**不是两次**的对照：`PATCH …/chunk-strategies`(#21) 有 `chunk_strategy_patch` 领域事件但**不命中** `admin_write`；`POST …/reindex`(#6) 有 `chunk_strategy_reindex` 但不命中；`PUT …/acl`(#15) 在**收紧**时才发 `doc_acl_tightened`，其余情况无痕。⇒ 今天「双写」面 = **`/admin/*` 全部 + settings PATCH**（共 18 条）。

### 7.3 `admin_write` 的行能不能满足「可查账」？

- **今天能核到的最大事实**：`admin_write` 只落 **Pino → stdout**（`logger.ts:8-19`），**无读取端点、无查询 API、无留存/轮转配置、无审计表**（§4.1）。故在本仓内，它 **不能** 满足「可查账 / 可检索 / 有事有据」。
- 对照：`kb_settings_audits` **能**（落表 + `GET …/settings-audit` 读面 + 默认 50 条）。
- **未核**：生产是否外接日志采集/检索（仓内无配置或文档证据）；`09-security:330`「审计日志 180 天」是否由外部平台承接 —— **仓内未核**。
- 【推断】若要「可查账」，须走持久化账本路径（等同 KB settings 那条），而本图 **Out of scope** 明确「新建持久化审计表/迁移默认记债」。

---

## 8. 会推翻立项前提的发现（摘要）

1. **`app.routes` 可枚举且 `createApp()` 不连 DB**（实测）⇒ 反漂移测例技术可行；但**必须按 `(method,path)` 去重**（Hono 按 handler 展开，一条路由出现 N 次）。
2. **六条正则无一死规则** ⇒ 「清理死规则」不是本图要解决的问题。
3. **账本服务两条路径**（settings PATCH **与** chunk-strategies PATCH），非「只服务一条」。
4. **`supersede` / `resolve` / lifecycle 变更今天零痕**（题面以为有领域事件，实为无）——缺口比题面假设**更大**。
5. **`PUT …/knowledge-bases/:kbId/model-bindings`(#20) 今天不命中**，但剧本 **AC6** 明写要「审计」⇒ 这是一条**有 PRD 依据却零痕**的实缺（题面未点名）。
6. 簇 10（grant 删除留痕）：`DELETE /api/v1/admin/dept-cross-grants/:id` **落在 admin 前缀下、已被 `admin_write` 命中**；AE7 的 Pino 层「审计有记录」**已由既有测例钉住**，仅「表级留痕」未满足。
7. **`09-security:328` 是唯一把「删除/ACL/成员变更」写进记录清单的条款** ⇒ 文档处置类四条若找 PRD 依据，这条最直接。
