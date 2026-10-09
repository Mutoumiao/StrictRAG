# 现状核实：ask 的租户取值链全图与「两源不等」的可达性

Type: research
Status: resolved
Blocked by: —

## Question

把「ask 在检索期认哪个租户」这件事**逐条落到源码、PRD 与测例事实**，好让裁定票能拍板（不发明语义、不写建议）。每条结论**指到路径 + 行号**，并区分「源码事实」与「推断」。**只读**，不改任何源码 / PRD / 文档 / 测例。

1. **租户取值链全图（本图的事实底座）**
   - 从 HTTP 入口到检索返回，逐段列出**每一个** `tenantId` 的：来源（谁的字段 / 哪个常量 / 哪个请求体字段）· 传递路径（file:line）· 消费点（做什么判定或过滤）。
   - 至少覆盖：`routes/ask.ts`（用户路径）· `routes/eval.ts` 的 `/internal/eval/execute-ask`（内口路径）· `services/ask/execute.ts` · `services/retrieve/{retrieve,types,corpus,visibility,es-sparse}.ts` · `apps/worker/src/ingest/pipeline.ts` 的 ES bulk 写入 · `apps/worker/src/eval/execute-ask-http.ts`。
   - 明确回答：**全仓一共几个「租户权威源」？**（入口 = `auth.tenantId ?? kb.tenantId`；装载 = 文档行第一行；ES 写入 = `doc.tenantId`；ES 查询 = 入口；内口 = 请求体）逐一指到行号，不要合并同类项。
   - `documents.tenant_id` 的**所有写路径**列出来（含 `complete` / 在线编写 `documents/write` / 上传 / 评测语料入库脚本），核每条写的是 `kb.tenantId` 还是别的值；有没有任何路径能写出与所属 KB 不同的租户。
   - `chunks` / `chunk_embeddings` / ES bulk 的 `tenantId` 来源逐个核（是否**全部**来自 `doc.tenantId`）。

2. **可达性：`auth.tenantId ≠ kb.tenantId` 今天能造出来吗**
   - `auth.tenantId` 的最终来源：JWT claim 由谁签发（`routes/auth.ts` 的 dev-login / 内口 / 其它）· 值取自哪一行（`users.tenant_id`？）· refresh 续签时会不会变。
   - `kb.tenantId` 的来源：`createKb` 写的是什么；有没有别的建库入口。
   - **逐条列出能把两者造不等的路径**（例如 `/web/dev-login` 请求体显式 `tenantId` + 超管绕过成员资格；跨租户邀请成员；直接改库）。每条给出**最小复现步骤的形状**（不要真跑生产）。
   - **生产档位**（`APP_ENV` 非 development / test）下这些路径还通不通？`apps/api/src/env.ts` 与各路由的守卫逐条核。
   - **客户端会不会传** `tenantId`：`apps/web` / `apps/admin` 的登录调用有没有该字段；若没有，`auth.tenantId` 在真实客户端下是否恒为 `DEV_DEFAULT_TENANT`。
   - 结论层：给出「**今天可达 / 只在 dev 可达 / 结构上可达但无触发面**」三态里的一态，并说明判据。

3. **PRD / ADR / 剧本：租户权威源的原文与沉默**
   - 逐条给出含「租户 / tenant / 跨租户 / 多租户」的**冻结原文 + 行号**：`prds/09-security/01-auth-acl-compliance.md` · `prds/03-data/`（各存储的租户列与边界）· `prds/05-api/01-http-api-hono.md`（ask / 内口 / 建库 / 邀请成员）· `prds/04-pipelines/`（检索两侧）· `prds/10-delivery/03-acceptance-scenarios.md`（**AE8「ES 收窄与 PG 语料同源」**的原行原文）。
   - 特别核：有没有任何一处**写明**「ask 的租户以哪个为准」？如果没有，**如实写「PRD 沉默」**并给出你搜过的关键词与文件清单（避免「我没找到」被读成「不存在」）。
   - ADR 侧：`prds/11-decisions/00-adr-index.md` 里 ADR-041（独立索引 / filter 强制）· ADR-051（授权 SSOT）· ADR-057（可见性同函数）里与租户相关的条款原文 + 行号；有没有条款规定了「租户必须一致」或「不一致怎么办」。
   - 结论层：本议题属于「PRD 有明文」还是「PRD 沉默 / 只有实现选择」？逐条给依据。

4. **既有断言盘点：改任一侧会翻哪些测例**
   - `apps/api/tests/acl/dept-acl-ask-e2e.test.ts` 的 `describe('语料装载的 tenantId 来源（fail-closed）')` 与 `describe('runRetrieve 的 ES 收窄与 PG 语料同源（AE8 对称）')` 逐条列出断言原文 + 行号 + 它钉住的到底是「哪个源」。
   - 全仓再搜一遍：还有哪些测例（api / worker / contracts）断言过 ask 或检索的 `tenantId`（含 `expect(...).toBe(TENANT)`、fixture 里的 `tenantId:` 常量、`requireTenantId` 的报错断言）？逐条 file:line。
   - 逐条给出**反向影响表**：若把 ES 查询腿改成 `kb.tenantId` → 哪些断言会红？若把装载面改成入口租户 → 哪些会红？若「不等即拒」→ 哪些会红？哪些**不会**红（因为两侧传的是同一个常量、或 mock 忽略入参）？
   - **测试基建事实核实**：装载测例里 `db.js` 的 `where` 是不是被 mock 成忽略入参（前图结论，请独立复核并给出代码行）？全仓有没有任何夹具造过「文档行租户 ≠ 入口租户」？

5. **候选处置的代价面（为裁定票准备，不替它选）**
   - 把三条候选（① ES 稀疏腿改按 `kb.tenantId` ② `auth.tenantId ≠ kb.tenantId` 即拒 ask ③ 明确「跨租户访问不得发生」并在写路径 / 读取面加断言）逐条写成：**改动点（file:line）· 会翻的断言 · 回归面（波及哪些包 / 测试）· 是否与「门禁只加严不放宽」一致 · 是否需要 ADR（改的是不是既有语义）**。
   - 第四条候选：**只加断言、不改判据**（例如在 ask 入口对两源不等时打点 / 拒绝 / 告警）—— 它的可行性、会不会改变现有行为（逐位等价吗）、以及它是否真的能让「静默丢失」不再静默。
   - 明确：三条（或四条）里哪几条**必须动 `prds/00–11`**、哪几条可以「源码收紧 + 记 ADR 债」收口。给判据，不要给结论。

6. **邻接缺口核实（不修，只判性质）**
   - `routes/members.ts` 的 invite 路径：成员行 `tenant_id` 取的是谁的值？全仓有没有「目标用户必须与 KB 同租户」的校验（含 DB 约束）？`isMember` 查询按不按租户过滤？
   - `kb_members.tenant_id` 全仓**有没有消费者**（任何 WHERE / 判定 / 读面）？逐条 file:line；没有就写「无消费者」。
   - `corpus.ts` 取 `dual[0]?.tenantId`（**第一行**）：如果同一 KB 下文档行租户不一致会怎样（逐条推演：可见性上下文取到哪一行的值、其余行的后果）？今天有没有路径能造出这种不一致？
   - `documents.tenant_id` 的 DB 约束现状（NOT NULL？外键？CHECK？）—— 指到 `packages/db/src/schema/kb/documents.ts` 与迁移文件。

7. **真栈可用性（实测，不推断）**
   - 今天本机能不能起 Docker / 真 PG / 真 ES？（给出你**实际执行**的命令与结果，不要凭前图口径。）若能：真 ES 上把「ES 文档租户 = A、查询租户 = B」的最小对照跑出来（写入 2 条不同租户的稀疏文档，分别用 A / B 查，看命中数），给出实际数字。
   - 若起不来：如实写「未实测」并说明阻塞点。

8. **既有文档与镜像现状**
   - 相关 spec（`.trellis/spec/api/backend/` 下检索 / 鉴权 / 计分相关文件）里今天怎么描述租户来源？逐条给出文件 + 原文（若描述与源码不符，指出不符）。
   - `docs/module-status/api.md` 里簇 40 那条技术债行的**原文**，以及有没有别处也提过该债。
   - `docs/testing/coverage*.md` 里 AE8 相关行的当前值（`已测` / `部分测` / `缺实现`）与缺口文字。

## Answer

> 约定：**「源码事实」= 我读到该行**；**「推断」= 由源码推出**。行号以 2026-10-10 工作区实测为准（我逐行读过原文）。凡与 map 开工基线行号/措辞不一致者，见文末 **「推翻了什么前提」**。
>
> 一句话先给判定（供裁定票，不含建议）：**「auth.tenantId ≠ kb.tenantId」今天在 dev/test 可达（真栈已实测其后果）；生产档位下本仓无任何登录入口，故只余「内口评测端点接受任意 tenantId」这一条结构面。** PRD 对此**不沉默**：`ADR-009` 焊死条款明写「入口校验 `(userId, kbId, tenantId) ∈ kb_members` 且 **tenant 一致**；失败 → 拒答」，而当前源码**没有**这条断言。

---

### 1. 租户取值链全图（本图的事实底座）

#### 1.1 租户取值链表（来源 → 传递 file:line → 消费点）

| # | 阶段 | 取值来源 | 传递路径（file:line） | 消费点（判定 / 过滤） | 性质 |
|---|------|----------|------------------------|------------------------|------|
| T1 | HTTP 入口（用户路径） | `auth.tenantId ?? kb.tenantId` | `apps/api/src/routes/ask.ts:314` → `run({… tenantId …})` `:362`（同步）/`:390`（流式） | 只用于：日志 `:321`、幂等键 `askIdemKey({tenantId,…})` `:335`、`executeAsk` 入参 | 源码事实 |
| T2 | 编排 | `params.tenantId` | `apps/api/src/services/ask/execute.ts:197`（送 `runAskGraph`）· `:118`（日志）· `:123`（tracer）· `:245`（落 `ask_traces.tenantId`）· `:139`（`getGatewayForTenant(tenantId,kbId)`） | 图状态 `tenantId` | 源码事实 |
| T3 | 图状态 | `input.tenantId` | `apps/api/src/graph/state.ts:135`（`initState`） | `retrieveInput.tenantId` | 源码事实 |
| T4 | 检索入参 | `state.tenantId` | `apps/api/src/graph/run.ts:309`（`retrieveInput`）→ `runRetrieve(input, deps)` `:322` → `RetrieveInput.tenantId` `:309` | **ES 稀疏腿**（仅 http 模式） | 源码事实 |
| T5 | **ES 稀疏查询腿** | `input.tenantId`（= T1 入口租户） | `apps/api/src/services/retrieve/retrieve.ts:198`（`sparseSearch({tenantId: input.tenantId,…})`）→ `es-sparse.ts` | `buildAclFilter` → `filter[0] = {term:{tenantId}}` `apps/api/src/services/retrieve/es-sparse.ts:203`；硬闸 `requireTenantId` `:47`/`:52`（缺/空/纯空白即抛 `EsSparseError`） | 源码事实 |
| T6 | 部门收窄上下文（ES 查询期） | `input.tenantId` | `retrieve.ts:90`（`subject:{tenantId: input.tenantId,…}` in `sparseNarrowingForSearch`） | 仅 enforce 开且非超管时加载部门/ grant | 源码事实 |
| T7 | **PG 语料装载腿（可见性上下文）** | **文档行第一行** `dual[0]?.tenantId` | `apps/api/src/services/retrieve/corpus.ts:71`（`subject:{tenantId: dual[0]?.tenantId,…}`）。`dual` 来自「按 `kbId` 取全部文档行」`corpus.ts:64`（`where(eq(documents.kbId, kbId))`，**不按租户滤**）经 `filterDocsForRetrieve` `:66` | **只**进 `loadVisibilityContext`（`corpus.ts:72` → `visibility.ts:59-61` 的 `loadDeptAssignments/loadDeptNodes/loadDeptGrants`）；**不进 ES 查询** | 源码事实 |
| T8 | ES 写入（bulk，worker） | **`doc.tenantId`**（文档行） | `apps/worker/src/ingest/pipeline.ts:931`（`bulkIndexSparse` 的 `tenantId: doc.tenantId`）→ `es-sparse.ts:137`（`sparseBulkSource` 再经 `requireTenantId`） | ES 索引字段 `tenantId` | 源码事实 |
| T9 | chunks / chunk_embeddings 写入（worker） | `doc.tenantId` | `pipeline.ts:620`（chunks）· `:633`（chunk body 行）· `:697`（chunk_manifests）· `:824`（chunk_embeddings）· `:586`/`:676`/`:712`/`:967`/`:995`（报告/账本各列） | PG 行 `tenant_id` | 源码事实 |
| T10 | **内口评测路径：入队** | **`kb.tenantId`** | `apps/api/src/routes/eval.ts:276`（`enqueue({tenantId: kb.tenantId,…})`） | BullMQ job `EvalJobData.tenantId` | 源码事实 |
| T11 | 内口评测路径：worker 原样回传 | `job.tenantId` | `apps/worker/src/eval/consumer.ts:56`/`:101` → `execute-ask-http.ts:52`/`:110`（POST body） | 内口 | 源码事实 |
| T12 | **内口评测路径：内口取请求体** | **请求体 `tenantId`** | `apps/api/src/routes/eval.ts:319`（`tenantId: parsed.data.tenantId`），body schema `eval.ts:49`（uuid 必填） | 同 T4→T5（**ES 腿按此值过滤**） | 源码事实 |

#### 1.2 全仓「租户权威源」清单（不合并同类项）

按工单要求逐一指行，**共 5 个**（另附相邻者）：

1. **入口（用户路径）** = `auth.tenantId ?? kb.tenantId` —— `apps/api/src/routes/ask.ts:314`。
2. **装载（PG 语料可见性上下文）** = 文档行**第一行** `dual[0]?.tenantId` —— `apps/api/src/services/retrieve/corpus.ts:71`。
3. **ES 写入** = `doc.tenantId` —— `apps/worker/src/ingest/pipeline.ts:931`（另 `es-sparse.ts:137` 只做非空约束，不改值）。
4. **ES 查询** = 入口租户（= 1）—— `apps/api/src/services/retrieve/retrieve.ts:198`。
5. **内口** = 请求体 `tenantId` —— `apps/api/src/routes/eval.ts:319`（入队侧却是 `kb.tenantId`，见 T10）。

相邻但非 ask 检索链的取值源（供裁定票知悉，不属本图问题）：KB 列表 `documents/index.ts:112`（`auth.tenantId ?? DEV_DEFAULT_TENANT`）· 建 KB `:131`（同式）· 成员行 `routes/members.ts:73`（**邀请人**的 tenant）· 文档列表可见性上下文 `documents/index.ts:165`（`rows[0]?.tenantId`，与装载面同「取首行」式）· 文档详情/ACL `documents/index.ts:812`（`doc.tenantId`）· 模型网关 `services/model-gateway.ts:560`（`auth.tenantId ?? DEV_DEFAULT_TENANT`）· 启动引导超管 `services/superadmin-bootstrap.ts:187`（`DEV_DEFAULT_TENANT`）。

#### 1.3 `documents.tenant_id` 的所有写路径

- **唯一 INSERT**：`apps/api/src/services/documents.ts:143` `insertUploadedDoc` → `:154` `db.insert(documents).values({ tenantId: input.tenantId, … })`。两个**生产调用点**都传 `kb.tenantId`：
  - 上传：`apps/api/src/routes/documents/index.ts:202-204`（`tenantId: kb.tenantId`，`kb` 来自 `getKb(kbId)` `:194`）。
  - 在线编写 `documents/write`：`apps/api/src/routes/documents/index.ts:331-333`（同式，`kb` 来自 `:299`）。
- **complete（`finalizePendingIngest`）不写 `tenant_id`**：`apps/api/src/services/ingest-complete-pending.ts` 全文无 `documents.tenant_id` 写；仅用 `doc.tenantId` 做限流键 `:289`。
- **worker 从不 INSERT `documents`**：`apps/worker/src/ingest/pipeline.ts:128` 只有 `update(documents).set(patch).where(eq(documents.id, docId))`（`patch` 无 tenant 列），其余全为 `chunks/chunk_embeddings/manifest/report` 且值取 `doc.tenantId`。
- **评测语料入库脚本**：`apps/api/src/scripts/ingest-eval-corpus.ts` 走 HTTP（`upload-url` → `complete` → `scan`），文档行租户仍由 `documents/index.ts:204` 取 `kb.tenantId`；脚本 dev-login 用 `tenantId: input.tenantId`（`:255`，= `INGEST_TENANT_ID` 或默认租户），ledger 记 `tenantId: opts.env.tenantId`（`:430`）。
- **结论（源码事实）**：**没有任何写路径能写出「文档行租户 ≠ 所属 KB 租户」**。全部写 `kb.tenantId`。（`documents.tenant_id` 只 NOT NULL，无「等于 KB 租户」约束 —— 见 §6.4。）

#### 1.4 `chunks` / `chunk_embeddings` / ES bulk 的 `tenantId` 来源

- **全部来自 `doc.tenantId`**：chunks `pipeline.ts:620` · chunk body 行 `:633` · chunk_manifests `:697` · chunk_embeddings `:824` · ES bulk `:931`。均为 `doc`（=`getDoc(data.docId)`，`pipeline.ts:131-133`，「按 id 取行」，无租户参）。**源码事实。**

---

### 2. 可达性：`auth.tenantId ≠ kb.tenantId` 今天能造出来吗

#### 2.1 `auth.tenantId` 的最终来源

- **JWT 签发处**：`apps/api/src/auth/identity/token-service.ts:39-64`。access token claim `tenantId` 取自 `params.tenantId`（`:58`）。refresh token 的**签名体**不含 tenantId（`:66-71`），但 refresh store 行**存** tenantId（`:86`），续签时 `refreshTokenPair` 用 `row.tenantId` 重新签（`:151-158`）→ **续签不会改变 tenantId**（取登录时那一行）。**源码事实。**
- **claim 值来自哪一行**：dev-login 用 `user.tenantId`（admin：`routes/auth.ts:69-77`；web：`:115-121`），`user` 来自 `ensureUserByEmail`。**关键细节**：`ensureUserByEmail` 先按 `email` 查 `users`，**命中即原样返回该行的 tenantId**（`services/members.ts:50-61`）；**仅当 email 不存在**时才用传入 `tenantId`（`:62-64`，缺省 `DEV_DEFAULT_TENANT`）插入新行。→ 用**已存在**的 email 反复 dev-login，`tenantId` 参数被忽略。**源码事实。**
- 读取处：`auth/middleware.ts:64-84`（`principalFromVerifiedClaims`）把 `claims.tenantId` 原样放进 `auth`。

#### 2.2 `kb.tenantId` 的来源

- `createKb` 写 `tenantId`：`apps/api/src/services/documents.ts:39-44`（`tx.insert(knowledgeBases).values({tenantId: input.tenantId,…})`），唯一生产调用点 `apps/api/src/routes/documents/index.ts:130-131`（`tenantId: auth?.tenantId ?? DEV_DEFAULT_TENANT`）。**源码事实。**
- **别的建库入口**：未找到。全仓 `insert(knowledgeBases)` 仅上述一处（grep `into(knowledgeBases)` / `insertUploadedDoc` 等）。KB 行 tenant 只能 = 建库令牌 tenant（或无令牌时的默认租户）。

#### 2.3 能造「不等」的路径（逐条 + 最小复现形状）

- **P1（主路径，dev/test）**：dev-login 带显式 `tenantId` + **新 email** → 得到「租户 B 会话」。
  - 形状：① `POST /api/v1/auth/web/dev-login`（或 admin）body `{email:"fresh-<ts>@x", roleTemplate:"web_consumer"|"super_admin", tenantId:"<B>"}`（`routes/auth.ts:89-121`，`tenantId` 来自 body：web `:99`、admin `:51`）→ 拿到 `tenantId=B` 的 access token；② 用它访问一个属于租户 A 的 KB 的 ask：`POST /api/v1/knowledge-bases/<kb-A>/ask`。此时 `auth.tenantId=B`、`kb.tenantId=A`（`ask.ts:314`）。
  - **能否过成员闸**：能。要么该用户被邀为该 KB 成员（`kb_members` 只按 `(kbId,userId)` 判，见 §6.1），要么其角色是 `super_admin`（`roleBypassesKbMembership`，见下）。
- **P2（超管旁路，dev/test）**：`super_admin` 跳过 KB 成员资格 —— 模板位 `packages/admin-catalog/src/role-templates.ts:44`（`super_admin.bypassKbMembership: true`）→ 函数 `:81-83` → 用于 `apps/api/src/auth/middleware.ts:240`（`evaluateKbMember`）与 `apps/api/src/auth/permissions/resolve.ts:52`（`canAccessKbScoped`）。故 P1 中把 `roleTemplate` 设为 `super_admin` 即无需成员行。
- **P3（跨租户邀请成员，dev/test）**：租户 A 的超管邀一个「租户 B 用户」进 KB-A：`POST /knowledge-bases/<kb-A>/members` body `{email:"b-user@x"}`。成员行 `tenant_id` 写的是**邀请人**的 tenant（`routes/members.ts:73` → `services/members.ts:144-150`），而 `isMember` 只按 `(kbId,userId)`（`services/members.ts:85-91`）。于是 B 用户成为 KB-A 成员，可造 P1 的不等且**不靠超管旁路**。**注意**：`ensureUserByEmail` 对 B 用户已存在行返回其本租户（`members.ts:50-61`），故 B 用户仍是租户 B。
- **P4（改库）**：直接 UPDATE `users`/`knowledge_bases`/`documents` 的 tenant 列。**无 HTTP 面**，仅 DBA。
- **P5（内口，不依赖 dev-login，非 dev 专属）**：`POST /api/v1/internal/eval/execute-ask`（`routes/eval.ts:294`）只验 `x-eval-internal-token`（`:296-301`），**不校验 `body.kbId` 是否存在、也不校验 `body.tenantId` 是否等于该 KB 的租户**（该 handler 全文无 `getKb`），直接以 `tenantId: parsed.data.tenantId`、`membership:'member'` 跑 `executeAsk`（`:313-327`）。真实 worker 发的是 `job.tenantId = kb.tenantId`（§1.1 T10/T11），故**照常运行时不等**；但任何持该口令者（或未来改错的调用方）可显式让两源不等。

#### 2.4 生产档位（`APP_ENV` 非 development/test）守卫逐条核

- **dev-login 在 staging/production 返回 404**：admin `routes/auth.ts:38-40`；web `:90-92`。→ **P1/P2/P3 全部只在 dev/test 可达**。**源码事实。**
- **本仓在 production 无任何登录入口**：`routes/auth.ts` 仅有 `admin|web/dev-login` 与 `admin|web/token/refresh`（`:125`/`:139`），refresh 必须有既有 refresh token（`:117-119`）。启动引导超管只 upsert 字典表 + `password_hash`（`services/superadmin-bootstrap.ts:116-181`），**不签发 token**；`env.ts:89-97` 注释与 `docs/module-status/api.md:78` 明写「没有密码登录 HTTP / 生产 IdP」。→ **推断**：生产下无法经本仓自身取得 JWT，故「等值/不等值」在用户路径上**无触发面**。
- **ask 路由本身不随 `AUTH_ENFORCE` 放松**：`ask.ts` 用 `requireKbMember`（始终要求登录 + 成员，`middleware.ts:329`，调用 `evaluateKbMember` `:344`），`AUTH_ENFORCE` 只管 `requirePermissionWhenEnforced`（业务入库路由，`middleware.ts:295-321`）。**源码事实。**
- **内口（P5）不受 `APP_ENV` 影响**：`routes/eval.ts:294` 无环境守卫；`EVAL_INTERNAL_TOKEN` 空则 503（`:296-299`），非空且匹配即放行。→ **结构面**，生产若配了口令（worker 需要）就存在。

#### 2.5 客户端会不会传 `tenantId`

- **不传**。`apps/web/src/app/login/page.tsx:22` 只发 `{email, roleTemplate:'web_consumer'}`；`apps/admin/src/app/login/page.tsx:26` 只发 `{email, roleTemplate: role}`。API 封装 `apps/web/src/auth/api.ts:12` / `apps/admin/src/auth/api.ts:12` 原样透传 `DevLoginRequest`。**源码事实。**
- 合同 `packages/contracts/src/auth/session.contract.ts:39-46`：`tenantId` 可选。
- **推断**：真实客户端下 `tenantId` 缺省 → 新 email 落 `DEV_DEFAULT_TENANT`（`auth.ts:99`/`:51` → `members.ts:64`）；已存在 email 则取该 user 行租户。**故「真实客户端下 auth.tenantId 恒为 DEV_DEFAULT_TENANT」不完全成立** —— 只有当所有既有用户都在默认租户时才恒为默认；一旦某 email 的行是别的租户，该 email 用 web/admin 登录也会拿到非默认租户。

#### 2.6 三态结论 + 判据

- **结论：`只在 dev 可达`**（P1/P2/P3 三态里属「dev/test 专属」；P5 是「结构上可达但正常无人触发」）。
- **判据**：
  1. 造不等**必须**让 `auth.tenantId`（JWT claim）取到与 KB 不同的值；JWT 只能由 dev-login/refresh 产生（§2.1）；dev-login 被 `APP_ENV` 守卫在 dev/test（§2.4）→ 用户路径**只在 dev 可达**。
  2. 生产无登录入口（§2.4）→ **无触发面**，非「今天已可达」。
  3. 内口 P5（`eval.ts:294-327`）与 `APP_ENV` 无关、且不校验 `tenantId==kb.tenantId` → 属「结构上可达但无触发面（现行 worker 发同值）」。

---

### 3. PRD / ADR / 剧本：租户权威源的原文与沉默

> **总判：本议题属「PRD 有明文」**（`ADR-009` 焊死条款 + online-ask PRD 第 0b 步），只是**实现没落**；并非「PRD 沉默」。另有若干 PRD 对「哪个租户」保持沉默（需各自标）。

**（a）明文要求「tenant 一致」的冻结条款 —— 这是本图最关键的发现**

- `prds/11-decisions/00-adr-index.md:151`（**ADR-009 · 检索 ACL 过滤** 的「三焊死」之一，状态已接受，见 `:139-140`）：
  > **检索层二次成员断言**：入口校验 `(userId, kbId, tenantId)` ∈ `kb_members` 且 tenant 一致；失败 → 拒答 `not_member` / `internal_guard`，**不进** dense/ES。API 403 为第一道，本断言为纵深。
- `prds/04-pipelines/02-online-ask-langgraph.md:170`（retrieve 算法第 0b 步）：
  > `0b. 检索层纵深：断言 userId ∈ kb_members(kbId) 且 tenant 一致`
  > `失败 → finalize abstained reason=not_member（或 internal_guard），不进 dense/ES`
- **源码对照（源码事实）**：`runRetrieve` 只做 `if (input.membership === 'none') return fail('not_member')`（`apps/api/src/services/retrieve/retrieve.ts:120-122`）；`evaluateKbMember`（`auth/middleware.ts:231-253`）只按 `(userId,kbId)`；**全仓无任何「tenant 一致」断言**（grep `tenantId ===`/`!==` 仅命中 `document-supersede.ts:47`、`departments.ts`、`model-gateway.ts`、`platform-users-roles.ts`，see §4.3）。→ **ADR-009 的「且 tenant 一致」今天未实现。**（推断：这是「PRD 有明文、实现缺口」。）

**（b）租户边界原文（并不指定「ask 以哪一侧为准」）**

- `prds/09-security/01-auth-acl-compliance.md:25`：用户 JWT claims 含 `tenant_id`。
- `:219`（检索 ACL 焊死表）：「纵深防御 | API 成员 403 **+** 检索层 `kb_members` 二次断言；失败 → `not_member`」—— **注意此处省略了「且 tenant 一致」**，与 ADR-009:151 / online:170 措辞不完全一致。
- `:217`：P2 主路径 scope = tenant + kb + ready/active/indexVersion。
- `prds/03-data/03-elasticsearch-bm25.md:38-42/:83/:96`：Router 按 tenantId、**任何**查询/删除**强制** filter、独立索引不豁免（ADR-041）。
- `prds/03-data/01-postgresql-schema.md:55`：`users.tenant_id` =「逻辑租户（P2 单租户亦可）」；`:61-70` `kb_members` 字段表**未列 `tenant_id`**；`:179-200` documents 字段表**亦未列 `tenant_id`**；`:204-212`「检索默认谓词」**不含 tenant**（只有 status/lifecycle/index_version/effective/ACL/docTypes）。→ **推断**：PG 存储 PRD 未写「检索须按 tenant 过滤」。
- `prds/03-data/01-postgresql-schema.md:42`：`es_index_routes`（tenant → index，ADR-041，默认无行=共享）。

**（c）ask / 内口 / 建库 / 邀请的原文**

- `prds/05-api/01-http-api-hono.md:18`：「租户 | JWT 内 tenant_id，**禁止**只靠 body」。（建库 body 的 `tenantId` 忽略在 `docs/module-status/api.md:39`、`.trellis/spec/api/backend/quality-guidelines.md:25` 有镜像，但**内口 execute-ask 例外**——见 §2.3 P5。）
- `prds/10-delivery/03-acceptance-scenarios.md:234-250`（**剧本 O**）：`:238`「**O1 跨租户** | 两租户同共享索引：A ask **永不**返回 B 的 chunk」；`:241`「O4 filter 强制 | 无 `tenantId` 的 query builder → 单测/门禁失败」。
- `prds/10-delivery/03-acceptance-scenarios.md:524`（**AE8 原行原文**）：「`| AE8 | dense 与 ES filter 均含部门条件 | 对称；禁止单路泄漏 |`」——**只讲部门条件对称，未提租户**。（其通过条件见 `:530`：AE4–AE8、AE10–AE12 为 P3/开强制后必签。）

**（d）ADR-041 / ADR-051 / ADR-057 的租户相关条款**

- **ADR-041**（`prds/11-decisions/00-adr-index.md:737-772`，已接受）：「四焊死 #1 filter 不可省（即使独立索引）：任意 ES 查询/bulk 删除**必须**带 `tenantId`…Query builder **无** `tenantId` filter → 单测/门禁失败」（`:747-749`）。**只规定「必须带 tenantId」，不规定「带哪个 tenantId」，更未规定「与 KB 租户一致」**。
- **ADR-051**（`:1336-1372`，已接受）：`#6 超管全权`「无需 `kb_members` 即可内容与平台全路径」（`:1360`）；后果「B1-5：超管非成员 ask → **允许**」（`:1372`）。**未提跨租户边界**（超管是否可跨租户访问内容，条文未明写）。
- **ADR-057**（`:1792-1863+`，已接受）：部门/可见级别/跨部门 grant；「不修改…超管全权（051）」（`:1796`）；`文档无 owner_dept_id = 库内成员可见`；**通篇按部门/级别，不按 tenant 划 ask 边界**（`vis\" 判定见 `dept-acl.ts`）。
- **推断**：ADR 中**没有**任何条款说「租户必须一致」或「不一致怎么办」——只有 ADR-009 那句「且 tenant 一致」是唯一直接相关明文。

**（e）我搜过的关键词与文件清单（避免「我没找到」被读成「不存在」）**

- 关键词（正则）：`tenant`、`租户`、`跨租户`、`多租户`、`tenant 一致`、`租户一致`、`同租户`、`租户不`、`租户边界`。
- 覆盖目录/文件：`prds/00–11`（重点 `09-security/01`、`03-data/01|02|03|04`、`05-api/01`、`04-pipelines/01|02`、`10-delivery/01|02|03`、`11-decisions/00-adr-index.md` 全文相关段）。
- **结论层**：本议题 = **「PRD 有明文（ADR-009:151 / online:170「且 tenant 一致」），但无一处指明「比较的是哪两个 tenant」**（入口 auth vs KB）。「认哪个租户」的这一层 = **实现选择 + PRD 沉默**；「是否要求一致」这一层 = **PRD 有明文**。

---

### 4. 既有断言盘点：改任一侧会翻哪些测例

#### 4.1 `apps/api/tests/acl/dept-acl-ask-e2e.test.ts` 逐条

- `describe('语料装载的 tenantId 来源（fail-closed）')` **`dept-acl-ask-e2e.test.ts:327`**，单条 `it`（`:328-341`）：「文档行缺 tenantId → 归属/授权查不到，部门文档不可见（只留空部门）」。做法：把 `store.documents` 每行 `tenantId=''`（`:332`），断言 `visibleDocs() == [DOC_LIB]`（`:334`）。
  - **钉住的是「哪个源」**：靠 `subject.tenantId = dual[0]?.tenantId`（corpus.ts:71）传成 `''` → `loadDeptAssignments/Nodes/Grants` 对空 tenant 短路为 `[]`（`dept-acl.ts:229-241`）→ 部门文档 eff=null 不可见，仅「库级文档」`DOC_LIB` 留下。**它钉的是「装载面取文档行租户」这条路**（若改取入口租户 `TENANT` 非空，则 mock 的 `listUserDepartments` 会返回 `state.assignments`，`DOC_A20` 等会由「负责人 30」变可见 → 期望 `[DOC_LIB]` 破）。**源码事实 + 推断。**
  - 该测试的 mock 仅在 dept 谓词层生效（`vi.mock('.../departments.js')`、`'.../dept-grants.js'`），租户判定真走 `dept-acl.ts` 的空 tenant 短路。
- `describe('runRetrieve 的 ES 收窄与 PG 语料同源（AE8 对称）')` **`dept-acl-ask-e2e.test.ts:343`**，单条 `it`（`:344-372`）：
  - 断言 `captured?.ownerDeptIds` = `[DEPT_A,DEPT_B,DEPT_C]`（`:365`）、`captured?.maxVisibleLevel` = 20（`:368`）、`r.evidence` 的 docId 集合 = `{A20,B20,C20,LIB}`（`:369-371`）。
  - **它钉的是「部门收窄参数 + 语料求交」**；**没有断言 `captured.tenantId`**。「两侧传同一个 `TENANT`」（传参 `:359` `tenantId: TENANT` 与夹具文档 `tenantId: TENANT` `:76`）是**夹具事实，不是被断言的量**。→ 对「改 ES 腿租户源」而言，**这条本身不会因 tenantId 变化而红**（只要租户非空、filter 仍是 tenant+kb）。

#### 4.2 全仓再搜：还有哪些测例断言过 ask / 检索的 `tenantId`

- **直接断言 ES 稀疏腿收到「入口租户」的两条**（改 ① 最可能翻）：
  - `apps/api/tests/ask/retrieve-run.test.ts:462`：`expect(seenSparse).toEqual([{ tenantId: 'tenant-1', kbId: 'kb1' }])`（输入 `:447` `tenantId:'tenant-1'`）。
  - `apps/api/tests/ask/sparse-kb-filter.test.ts:117`：`expect(input.tenantId).toBe('tenant-a')`（输入 `:109`）。
- **builder 层 unit（显式传参，不受「运行时选哪个源」影响）**：`apps/api/tests/ask/es-builder-tenant-required.test.ts:31-48`（缺/空/空白 → `EsSparseError`/`/missing tenantId/`；有值 → filter 原位 `:47-52`）· `apps/api/tests/ask/es-sparse.test.ts:36-132` · `apps/api/tests/ask/es-principals-query-filter.test.ts:96-125+` · `apps/api/tests/ask/es-dept-query-filter.test.ts:116-165` · `apps/worker/tests/ingest/es-builder-tenant-required.test.ts:38-88`（含 `listIndexedChunkIds` 第三处 ES 查询）。
- **fail-closed / 装载面**：`dept-acl-ask-e2e.test.ts:327`（见 4.1）；`apps/api/tests/acl/visibility-single-function.test.ts:207`（`loadCorpusFromDb` 真跑，夹具 `tenantId: TENANT`）。
- **runRetrieve 的 `ownerDeptIds` 断言（不涉 tenant）**：`apps/api/tests/ask/es-dept-query-filter.test.ts:334-401`。
- **fixture 里的 `tenantId:` 常量**（大量同类，均为单一 `TENANT`）：见各 `tests/ask/*`、`tests/acl/*`（如 `cred:tenantId: TENANT`）。**全仓无一处把「文档行租户」与「入口租户」设成不同值**（我搜了 `0000-000000000002`/`TENANT_B`/`OTHER_TENANT` 等：仅 `sparse-kb-filter.test.ts:33` 的 `KB_B='kb-tenant-b'` 是**另一个 KB**，不是另一个租户）。

#### 4.3 反向影响表（改哪一侧 → 哪些断言红 / 不红）

| 改动 | 会红（断言/spec） | 不会红（原因） |
|------|-------------------|----------------|
| **① ES 稀疏腿改按 `kb.tenantId`** | **若实现为「查 KB 行取 tenant」**：`retrieve-run.test.ts:462`（见 `tenantId:'tenant-1'`，而该测例 deps 无 KB 行/`kbSettingsRepo` 未 mock，会先因取不到 KB 而异常）· `sparse-kb-filter.test.ts:117`（同理，输入 `tenant-a` 但 `kb-a` 行租户未注入）。**若实现为「无 KB 时回落入口租户」**：两条**可能仍绿**（值不变）→ 需视实现。builder unit（4.2 第二条）**不红**。`dept-acl-ask-e2e.test.ts:343` **不红**（不断言 tenantId）。 | builder 层、契约层测例全绿（都是显式传参）。 |
| **② `auth.tenantId ≠ kb.tenantId` 即拒 ask** | **今天几乎不红** —— 全仓**无**「两租户不等」的夹具（4.2 末段）；超管非成员 ask 测例（`apps/api/tests/acl/kb-member-gate.test.ts:138` 用 probe、`:331-` 用真路由）**都不涉及 KB 租户**，故也不红。**→ 无既有断言可自证**。 | 所有「同租户」ask 测例天然绿。 |
| **③ 明示「跨租户访问不得发生」并在写路径/读取面加断言** | 写路径断言若加在 `documents/index.ts`（INSERT 前比 `kb.tenantId` 与令牌）：现有写测例令牌租户与 KB 同 → **不红**。读取面（ask 入口）同上 → **不红**。 | 除非新增「不等」夹具，否则无回归信号。 |
| **④ 只加断言/打点、不改判据** | 若断言是「不等即抛」→ 等同 ②；若仅打点 → **不红**。 | 行为逐位等价时全绿。 |
| **装载面改按入口租户（反向假设）** | `dept-acl-ask-e2e.test.ts:327-341` **必红**（见 4.1）。 | 其余装载测例（`visibility-single-function.test.ts`）在入口租户=文档行租户下行为不变 → 不红。 |

#### 4.4 测试基建事实核实（独立复核）

- **装载测例把 `db.js` 的 `where` mock 成忽略入参**：**成立**。`dept-acl-ask-e2e.test.ts:100-113`：`getDb().select().from(table).where` 是 `async () => {…}` —— **`where(...)` 的入参被完全忽略**，直接返回全夹具。`visibility-single-function.test.ts:90-104` 同款。**源码事实。**
  - **推断**：故在 `corpus.ts:64` 的 `where` 上**新增租户谓词不会使这两条测试变红**（谓词不生效），新增谓词**无回归保护**；要靠**真 PG** 或改 mock 口径才能证。
- **全仓有无夹具造「文档行租户 ≠ 入口租户」**：**无**（4.2 末段；grep 证据）。

---

### 5. 候选处置的代价面（为裁定票准备，不替它选）

> 说明：以下「是否与『门禁只加严不放宽』一致」= 由「是否只缩小可检集合」推断；「是否需要 ADR」= 是否改动既有语义（`prds/00–11` 冻结行为）。

**候选 ①：ES 稀疏腿改按 `kb.tenantId`（对齐 PG 语料）**
- 改动点（file:line）：`apps/api/src/services/retrieve/retrieve.ts:198`（`tenantId: input.tenantId` → KB 租户）；须有 KB 租户来源：`retrieve.ts:86` 已 `kbSettingsRepo.get(input.kbId)`（仅 enforce 路径），或新增 deps/在 `ask.ts:314` 处先取 KB；`sparseNarrowingForSearch` 的 `retrieve.ts:90` 亦同。
- 会翻的断言：见 4.3 ①（`retrieve-run.test.ts:462`、`sparse-kb-filter.test.ts:117`；是否翻取决于「查 KB 行 / 回落入口租户」的实现）。
- 回归面：`apps/api`（retrieve 全测）、`apps/worker`（ES 写入侧不涉）、契约不涉。
- 只加严？：若「KB 租户」恒等于「正常数据下的入口租户」→ 逐位等价；若两源本可不等，则**改变**了检索行为（不再是入口租户）→ **可能放宽或收紧取决语境，方向不单调** → 需裁。
- 需 ADR？：改的是既有实现语义（`ask.ts:314` 的 `auth.tenantId ?? kb.tenantId` 是既有实现）→ **推断需 ADR**。

**候选 ②：`auth.tenantId ≠ kb.tenantId` 即拒 ask**
- 改动点：`apps/api/src/routes/ask.ts:314` 附近（取到 `kb` 后比较），或 `services/retrieve/retrieve.ts:120-122` 旁加断言。
- 会翻的断言：**今天无**（4.3 ②）→ 需**新增**测例才可自证（对应 map 目的地「反证成立」）。
- 回归面：`apps/api` ask 全测（同租户夹具应全绿）；`apps/worker`（内口照常发 `kb.tenantId`）不受影响。
- 只加严？：**是**（把可 ask 集合缩小）。但**与 ADR-051:1360/1372「超管非成员 ask 允许」的边界需澄清**（超管跨租户是否也拒 → 条文未明写）。
- 需 ADR？：**PRD 明文已支持**（ADR-009:151 / online:170），只需实现「且 tenant 一致」；若「tenant」定义取「入口 vs KB」则是**读法选择**，建议裁明（可能不必新 ADR，但须在裁定书写清依据）。
- 反证难度：`retrieve-run`/`sparse-kb-filter` 的 mock 不涉 KB 行 → ② 的断言无法靠它们自证；须新夹具（真 PG 或双租户内存 fixture）。

**候选 ③：明确「跨租户访问不得发生」并在写路径 / 读取面加断言**
- 改动点：写路径 `apps/api/src/routes/documents/index.ts:131`（建库）· `:204`/`:333`（写文档）· `routes/members.ts:73`（邀请）加「令牌租户 == 目标 KB 租户」断言；读取面 ask/retrieve 同 ②。
- 会翻的断言：同样**今天无**（4.3 ③）。
- 回归面：`apps/api` 写路全测（同租户不红）。
- 只加严？：**是**。
- 需 ADR？：**否**（新增断言，不改既有可见语义）。但若「跨租户邀请」被断言拦下 → 改变 `members.ts:73` 的既有行为（当前写邀请人租户），须记 ADR 债。

**候选 ④：只加断言/打点、不改判据（在 ask 入口对两源不等打点/告警/拒绝）**
- 可行性：入口 `ask.ts:314` 处已有 `auth` 与 `kb`，**取两值即可比较**（低成本）。
- 会不会改变现有行为（逐位等价吗）：**仅打点/告警 → 逐位等价**；**拒绝 → 不等同 ②**。
- 是否真能让「静默丢失」不再静默：**仅在打点被采集/告警被看时**才不静默 —— 属可观测性补丁，不改变检索结果本身。**推断。**

**动 `prds/00–11` vs 「源码收紧 + 记 ADR 债」判据（不替裁）：**
- **必须动 `prds/00–11` 的情形**：裁定结论与既有冻结条文冲突（如判定「超管跨租户允许」但 ④/② 要拦超管；或判定「入口租户为准」而 ADR-009:151 的「一致」被解读为他义）。**判据 = 新语义落在哪条冻结点上且与原文相反。**
- **可「源码收紧 + 记 ADR 债」的情形**：只是把**已明文**要求（ADR-009:151「且 tenant 一致」）**补实现**，且不改条文 → 属落地，不必改冻结文本。**判据 = 改动是否只「补上未实现的明文」。**

---

### 6. 邻接缺口核实（不修，只判性质）

#### 6.1 `routes/members.ts` invite 路径
- 成员行 `tenant_id` 取值：**邀请人**的 `auth.tenantId ?? kb.tenantId`（`apps/api/src/routes/members.ts:73`）→ `membersRepo.invite` 写 `tenantId: input.tenantId`（`apps/api/src/services/members.ts:144-150`）。**源码事实。**
- 「目标用户必须与 KB 同租户」校验：**全仓无**（invite 只 `ensureUserByEmail`/按 `userId` 存在性检查，`members.ts:120-138`；无 tenant 比对）。DB 约束：`kb_members` 仅 `uniqueIndex(kbId,userId)`（`packages/db/src/schema/kb/kb-members.ts:18`；迁移 `0002_phase2_ask_foundation.sql`），**无 tenant 外键/CHECK**。**源码事实。**
- `isMember` 是否按租户过滤：**不**。`services/members.ts:85-91` = `where(and(eq(userId), eq(kbId)))`。**源码事实。**

#### 6.2 `kb_members.tenant_id` 有无消费者
- **无消费者**。全仓对 `kbMembers` 的读/写查询只按 `kbId`/`userId`（`services/members.ts:85-91`、`:96-105`、`:161-164`、`:171-175`；`services/documents.ts:99-103`（`listMemberKbIds`，按 `userId`）；`documents.ts:48-55`（建库时 INSERT，写 tenant））。**无任何 WHERE 读 `kb_members.tenant_id`。**（grep `kbMembers.tenantId` / `kb_members.tenant_id` → 0 命中。）**源码事实。**

#### 6.3 `corpus.ts` 取 `dual[0]?.tenantId`（第一行）推演
- 若同一 KB 下文档行租户不一致：`subject.tenantId` 取的是 `filterDocsForRetrieve(docs)` 后的**第 0 行**（`corpus.ts:66` → `:71`）；`db.select().from(documents).where(eq(documents.kbId,kbId))`（`:64`）**无 ORDER BY**，故「第 0 行」不保证稳定。**推断**：可见性上下文（部门树/归属/grant）会按这一行的租户加载；其余行不参与租户选择，但同受这份上下文裁决（`filterVisibleDocs(dual, subject, ctx)` `corpus.ts:79`）。真正后果取决于两值差异，**今天无路径造出**（§1.3）。
- 有无路径能造不一致：**无**（§1.3）。

#### 6.4 `documents.tenant_id` DB 约束现状
- Schema：`packages/db/src/schema/kb/documents.ts:11` = `uuid('tenant_id').notNull()` —— **仅 NOT NULL，无 FK、无 CHECK、无 UNIQUE**。**源码事实。**
- 迁移：`packages/db/drizzle/0001_phase1_kb_docs.sql:14`（`CREATE TABLE documents`）· `:20`（`"tenant_id" uuid NOT NULL`）—— 无 `REFERENCES`/`CHECK`/`FOREIGN KEY`（整文件仅有 `PRIMARY KEY`，见 §grep）。**源码事实。**
- 相关表：`knowledge_bases.tenant_id` NOT NULL（`schema/kb/knowledge-bases.ts:11`；迁移 `0001:7`）· `chunks` `:8` · `chunk_embeddings` `:10` · `kb_members` `:11` —— 均 NOT NULL，均无跨表租户一致性约束。**源码事实。**

---

### 7. 真栈可用性（实测，不推断）

**我实际执行的命令与结果**（Windows PowerShell 7；Docker Desktop）：

1. `docker version --format '{{.Server.Version}}'` → `25.0.2`；`docker ps` → **空**（初始无容器）。
2. `docker images` → 本地**已有**全部 compose 所需镜像（含 `pgvector/pgvector:pg16` 438MB、`redis:7-alpine`、`docker.elastic.co/elasticsearch/elasticsearch:8.15.3` 1.27GB、`mongo:7`、`rustfs/rustfs:1.0.0-rc.2`）→ **无需拉取**。
3. `docker compose -f docker/docker-compose.yml up -d elasticsearch postgres redis` → `exit 0`，三容器 `Started`。
4. 连通性：`docker ps` → 三容器 `Up (healthy)`；`Test-NetConnection 127.0.0.1 -Port 5432/6379` → **True**（PG / Redis 主机可达）；**9200 初次 False（主机「积极拒绝」）**，`docker port` 显示 `9200/tcp -> 0.0.0.0:9200`，`Get-NetTCPConnection -LocalPort 9200` → 无对象，容器内 `docker exec … curl localhost:9200/_cluster/health` → `{"status":"yellow",…}`（**容器内 ES 已就绪**）。
5. **处置**：`docker restart strict-rag-elasticsearch` → 3s 后 `Test-NetConnection 127.0.0.1 9200` → **True**（Docker Desktop 端口代理首次未生效，重启后恢复）。
6. **真 ES 最小对照**（`strict_rag_probe` 索引，mapping 同 `es-sparse.ts` 的 keyword；NDJSON bulk + term filter，逐位复刻 `buildAclFilter` 的 `[{term tenantId},{term kbId}]`）：
   - 写入 3 条同 `kbId=kb-probe`、租户分别 A/A/B、`sparseText` 均含「年假有多少天」。
   - 查询 `filter tenantId=A` → **`hits.total.value = 2`**（cA1、cA2）；`filter tenantId=B` → **`1`**（cB1）。
   - **静默丢失显式对照**：写入 1 条 `kbId=kb-onlyA`、租户 A 的文档；用 **A** 查 → **`1`**；用 **B** 查 → **`0`**。
   - **结论（实测数字）**：真 ES 上，查询腿的 `term tenantId` **确实**把「异租户文档」全部滤掉 → 当 KB 文档租户 = A 而入口租户 = B 时，稀疏腿**命中 0**，与「静默丢失且不泄漏」的推断一致（PG 语料腿仍能装出文档，故表现为召回丢失而非报错）。
7. **清理**：`DELETE /strict_rag_probe` · `docker compose … down`（已移除 3 容器 + 网络）· 删 `$env:TEMP\es_*`。**系统已还原为无容器状态。**

**结论**：**本机 Docker / 真 PG / 真 ES 均可起**（镜像本地已有；ES 8.15.3 单节点 yellow 可用）；**真 ES 对照已跑出实际数字**。唯一环境坑：首次 ES 端口代理不可达，`docker restart` 后恢复 —— **若据此写「主机 127.0.0.1:9200 直连」的 live 验证，须先确认端口联通**（`RETRIEVE_ES_MODE=http` 的 api 进程需能连到 `ELASTICSEARCH_URL`）。**未实测**：真 PG 上的 `loadCorpusFromDb` 端到端（未跑迁移/未起 api 全栈）—— 我未做，如实记为「未实测」。

---

### 8. 既有文档与镜像现状

#### 8.1 `.trellis/spec/api/backend/`（检索 / 鉴权 / 计分）
- `departments.md:105`（原文摘录）：「…三处**必须保留**的差异：超管 bypass 通道（路由直判角色 vs 检索层读 membership 槽）· **tenantId 来源（路由侧取文档行 / 首行，检索侧取语料首行；`CorpusLoader` 尚未接 `RetrieveInput.tenantId`，属已知接口缺口，fail-closed 方向）** · 输出形态。」→ **描述了装载面的取值来源**；**未描述 ES 稀疏腿的租户来源**，也未提「两源可不等」。
  - **与源码不符处**：spec 说「检索侧取语料首行」——准确；但整段未指出 ES 查询腿取**入口租户**（`retrieve.ts:198`），故读者会误以为检索侧只有「语料首行」一个来源。
- `ask-pipeline.md:451-456`（Design Decision「检索期 tenantId 强制」）：只写 `buildAclFilter` **必须** tenantId+kbId，**未说**该 tenantId 取自入口租户，也未提两源关系。
- `auth-authorization.md:210-211`/`:226-227`/`:254-256`：`tenantId` 在 JWT claims / DevLoginRequest / AuthMe 均为**可选**字段；**未描述** ask 检索期认哪个。
- `quality-guidelines.md:24-25`：「租户 | JWT 内 tenant_id，禁止只靠 body」「建库 … `tenantId` 只认令牌…**忽略** body 租户」——**与内口 execute-ask 接受 body tenantId 相反**（`eval.ts:319`），但该条语境是「业务 HTTP」，内口不在其列（措辞未排除，属**潜在误导**）。
- `index.md:5` / `ask-pipeline.md:308-309`：`RETRIEVE_ES_MODE=mock` 默认、`ELASTIC_INDEX` 仅 http、**≠** 多租户 B8。

#### 8.2 `docs/module-status/api.md` 簇 40 那条技术债（原文）
- **`docs/module-status/api.md:208`**（技术债表行，标题列）：「**ask 的租户有两个来源，不同值时两腿口径分裂**」；正文（摘）：ES sparse 过滤取**入口租户**（`services/retrieve/retrieve.ts:199` ← `routes/ask.ts:314` 的 `auth.tenantId ?? kb.tenantId`）；PG 语料取**KB 的租户**（`services/retrieve/corpus.ts` 里查询 `where` 只有 `kbId`，租户**取自文档行**）。`auth.tenantId ≠ kb.tenantId` 时…**稀疏召回静默丢失**（**不构成泄漏**：异租户命中会被「只保留语料内 id」求交滤掉）。缺口列：**「未实测**（无真 ES 复现，依据 = 源码两处取值链）…裁定见 wayfinder 图 `retrieve-corpus-tenant-scope` 工单 02…三条处置…**须先裁**…」
- **别处也提过该债**：`.scratch/retrieve-corpus-tenant-scope/map.md`（Decisions 01/02 行、`Not yet specified`）与其 `issues/01-research-is-verify.md`、`issues/02-dec-tenant-explicit.md`；本图 `map.md` 开工基线 #3/#5 与 Notes「内口路径的不对称」。
- **注意**：该行引用 `retrieve.ts:199`（实际 198）、未给 `corpus.ts` 行号（实际 71，且原文有取首行语义）。**行号需按本工单 §1 更新**（本工单已给实测行号）。

#### 8.3 `docs/testing/coverage*.md` 里 AE8 相关行
- **`docs/testing/coverage/02-acl.md:119`**：AE8 行 —— 「阶段 P3/开强制后 · 方式 单测 · 覆盖**已测** · api · `apps/api/tests/acl/dept-acl-ask-e2e.test.ts`（`AE8 对称`）· `apps/api/tests/ask/es-dept-query-filter.test.ts` · `es-principals-query-filter.test.ts` · `es-sparse.test.ts` · `apps/api/src/services/retrieve/corpus.ts`」；缺口列：「**≠** 真 ES 集群：只断言到请求体形状；「缺字段不得当全员可见」在真索引上的判定未验」。
- **`docs/testing/coverage/03-ops.md:54`**（O1）：已测，`sparse-kb-filter.test.ts`，缺口列「锁 kbId term + 外库 chunk 丢弃。默认 mock ES。**≠ tenantId 闸**（O4 已按 builder 层必填回写…）」。**该行正是「O1 跨租户」**——其现状是「只锁 kbId、≠ tenantId 闸」，即**跨租户一致性没有专门断言**。
- `03-ops.md:57`（O4）：已测，`es-builder-tenant-required.test.ts`（api+worker），缺口列指出第三处 ES 查询 `listIndexedChunkIds` 的补闸在 `.scratch/p2-exit-evidence/issues/13-…`（**> 本图范围，仅记录**）。
- `02-acl.md:164`「须真 ES 集群：`terms`/`must_not exists`/`range` 在真索引上的命中语义…（AE8 · B2-3 的集群侧）」—— 与 §7 我实测的 `term tenantId` 命中一致（我实测的是 tenant term，非部门 terms）。

---

### 推翻了什么前提

> 对照本图 `map.md` 的 9 条开工基线逐条复核。**结论：9 条中 4 条需要修正（#3 行号 stale；#5/#6 措辞不精确；#8 断言语义被高估）；5 条成立（#1/#2/#4/#7/#9）。**

| # | 基线原文要点 | 复核结论 | 依据 |
|---|--------------|----------|------|
| 1 | ask 入口 = `auth.tenantId ?? kb.tenantId`，进 `runAsk`（`ask.ts:314`·`:362`·`:390`） | **成立** | `ask.ts:314`/`:362`/`:390` 逐行核对一致 |
| 2 | 该值直达 sparse；缺/空即抛（`retrieve.ts:198`·`es-sparse.ts:52`） | **成立** | `retrieve.ts:198`（`tenantId: input.tenantId`）· `es-sparse.ts:47-56`（`requireTenantId`，`:52` 为判定体）。补充：该腿**仅 `esMode==='http'`** 才走 ES；mock 默认不走 |
| 3 | 语料装载取**文档行**租户、取**第一行**；文档按 `kbId` 取不按租户滤（`corpus.ts:62`·`:70`） | **需修正（行号 stale，偏 2）** | 实测：`corpus.ts:64`（`where(eq(documents.kbId,kbId))`）· `corpus.ts:71`（`subject:{tenantId: dual[0]?.tenantId,…}`）。语义（取首行、只按 kbId）正确；行号须改为 **64 / 71** |
| 4 | 写侧唯一源 = `kb.tenantId`；worker 全链用 `doc.tenantId`（`documents/index.ts:204`·`:333`·`pipeline.ts:620`·`:931`） | **成立** | 四行逐条核对一致；另补 `pipeline.ts:633/697/824` 亦 `doc.tenantId` |
| 5 | 内口评测路径租户源是 **KB 行**（`eval.ts:276`·`:319`·`execute-ask-http.ts:52`） | **需修正（措辞不精确）** | 行号成立（`eval.ts:276` 入队 = `kb.tenantId`；`:319` 内口 = `parsed.data.tenantId`；`execute-ask-http.ts:52` 原样回传）。但「内口租户源是 KB 行」**只有在 worker 照发 `kb.tenantId` 时为真**；内口 handler（`eval.ts:294-327`）**不校验** `body.tenantId == kb.tenantId`、**且不校验 `body.kbId` 是否存在**（无 `getKb`）→ 它是「接受任意 tenantId」的开口，不是「以 KB 行为准」的闸 |
| 6 | 可达路径存在：`/web/dev-login` tenantId 来自请求体；超管跳过成员资格（`auth.ts:99`·`resolve.ts:52`） | **需修正（缺两条前提）** | 行号成立。但缺：① 整条只在 `APP_ENV∈{development,test}` 通（`auth.ts:90-92` web / `:38-40` admin），**生产 404**；② 请求体 `tenantId` 仅对**新 email** 生效（`members.ts:50-64`：已存在 email 直接返回旧行租户）→ 复现须用 fresh email |
| 7 | 成员行租户取**邀请人**的租户，无「目标用户须同租户」校验（`members.ts:73`） | **成立** | `routes/members.ts:73`（邀请人 `auth.tenantId ?? kb.tenantId`）→ `services/members.ts:144-150`。补充实测：`kb_members.tenant_id` **无任何消费者**（§6.2） |
| 8 | 既有断言：装载面 fail-closed；「ES 收窄与 PG 语料同源」两侧传**同一个** `TENANT`（`dept-acl-ask-e2e.test.ts:327-341`·`:342-`） | **需修正（把夹具事实当断言）** | `:327-341` 钉「装载面取文档行租户」**成立**；但 AE8 测例（`:343-372`）**没有断言 `captured.tenantId`**，只断言 `ownerDeptIds`/`maxVisibleLevel` 与 evidence 集合。「两侧传同一个 TENANT」是**夹具事实**，不是被断言的量 → 「同源断言」被高估，改 ES 腿租户源时它**不会因 tenantId 而红** |
| 9 | 默认租户常量在 `members.ts:8` | **成立** | `services/members.ts:8` = `DEV_DEFAULT_TENANT` |

**Map 正文另有一处需修正**：Destination 说「`auth.tenantId ≠ kb.tenantId` … **可达路径已核实存在，不是纯理论**」——**结论方向正确**，但应限定为「**dev/test 可达**」（§2.6）；且「无真 ES 证据」的旧口径**已被本工单推翻**：§7 已在真 ES 上跑出 `A查=1 / B查=0` 的实际数字，`docs/module-status/api.md:208` 缺口列「**未实测**」字面**已不成立**（该行应更新为「已实测（最小对照）」，但完整端到端仍未做）。

**本工单新增（基线未列）的关键事实**：`prds/11-decisions/00-adr-index.md:151`（ADR-009）与 `prds/04-pipelines/02-online-ask-langgraph.md:170` **明文要求**「入口校验 `(userId,kbId,tenantId) ∈ kb_members` **且 tenant 一致**；失败 → 拒答」——**今天源码无此断言**。→ 「本议题 PRD 沉默」的前提**不成立**（「是否要求一致」有明文；只有「比较哪两个 tenant」这层沉默）。
