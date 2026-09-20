# 研究：B2 / AE 剧本的测例级缺口与最小可断言形态

Type: research
Status: resolved
Blocked by: —

## 问题

P3b 出口要求「B2 + AE（强制段）绿」。镜像已记（`docs/testing/coverage/02-acl.md:39-47`、`:109-121`、`:160`）：B2-1 / B2-2 / B2-3 部分测；AE4–AE8、AE10–AE12 全为部分测。需要落到**测例级**。

剧本原文：`prds/10-delivery/03-acceptance-scenarios.md`（B2-1 `:53` · B2-2 `:54` · B2-3 `:55` · B2-4 `:56` · AE4 `:520` · AE5 `:521` · AE6 `:522` · AE7 `:523` · AE8 `:524` · AE10 `:526` · AE11 `:527` · AE12 `:528`）。

## Answer

### 1. 逐行映射（12 行）

| ID | 现有测例（文件 + `it(...)` 原文标题摘要） | Then 是否已断言 |
|---|---|---|
| B2-1 | `acl/doc-acl-principals.test.ts`（`[] → 不可见` / `命中 userId → 可见` / `未命中 → 不可见` / `缺 userId 且非 bypass → 不可见` / `B2-1 最小：未授权文档不进过滤结果`）；`acl/documents-acl-principals.test.ts`（列表三态、`GET 详情：名单外 403；bypass 200`）；`acl/documents-acl-endpoint.test.ts`（`名单内有我 200 / 名单外 403；超管旁路 200`）；`acl/acl-tighten-index-lag.test.ts`（`语料只剩可读块时，稀疏路返回的不可读 chunkId 被丢弃`） | **部分**。列表/详情/谓词/稀疏旧命中已断言；**缺 ask 端到端**（问"只有 D 能答"→ 拒答或 answer 文本不含 D、evidence 无 D） |
| B2-2 | `acl/documents-acl-endpoint.test.ts`（`收紧才提示需 reindex…放宽不提示`）；`acl/acl-tighten-index-lag.test.ts`（上面两例）；`ingest/reindex-version.test.ts`（`入队载荷 stage=chunk 且不带 indexVersion；api 不改文档 version / ready 位`） | **部分**。只到"收紧→`reindexRequired`→入队"；**无"重入库后该用户不可检索"串联**；principal 仅支持 uuid（`非法 uuid → 400 VALIDATION_ERROR`），**角色码移出未实现** |
| B2-3 | `acl/acl-tighten-index-lag.test.ts`（dense 输入即 PG 闸后语料）；`acl/doc-acl-principals.test.ts`（`filterDocsForAclPrincipals` 两例） | **部分**。**无"绕过 loader 让 dense 召回不可读块"的反向构造**；dense 无独立副本，闸在语料装载 |
| B2-4 | `acl/doc-acl-principals.test.ts`（`null / 缺字段 → 可见`、`[] → 不可见`、`bypass → 可见`）；`acl/documents-acl-principals.test.ts`（三态可回读）；`acl/documents-acl-endpoint.test.ts`（`显式 [] → 非超管 403`、`三态写并回读一致`） | **已断言**（三态读、三态写、列表过滤均有直断言） |
| AE4 | `acl/retrieve-dept-acl.test.ts`（`同部门成员可见 20，不可见 30`）；`acl/documents-dept-filter.test.ts`（`开 + 部门不同 → 403`、`开 + 精确同部门 → 200`、`开 + 无归属 → 他部门省略`、`env false + KB deptAclEnforce true + 跨部门 → 403`）；`kb/dept-acl-enforce-resolve.test.ts`（KB 覆盖三态） | **部分**。列表/详情已断言；**ask 端到端未断言** |
| AE5 | `acl/retrieve-dept-acl.test.ts`（`同部门负责人可见 30`、`归属与 grant 取 max`） | **部分**。仅谓词层；**HTTP/列表无 `isLeader:true` 用例**，ask 更无 |
| AE6 | `acl/retrieve-dept-acl.test.ts`（`无归属只见空部门且级别够`、`空部门 + visibility 30`）；`acl/documents-dept-filter.test.ts`（`开 + 无归属 → 他部门省略，空部门仍在`） | **部分**。谓词 + 列表已断言；**缺 ask 端到端** |
| AE7 | `acl/retrieve-dept-acl.test.ts`（`未过期 grant≥级别 → 精确该部门可见（含 40）`、`过期 grant → 不可见`、`级别不够 → 不可见`、`grant 不作用于空部门文档`）；`acl/dept-grants-http.test.ts`（POST/GET/DELETE 可回读、无码 403） | **部分**。grant 可见（谓词）与 grant 写入（HTTP）**分测未串联**；**审计无断言**（仅 `dept-grants.ts:110-113` 的 pino `dept_cross_grant_create` + 通用 `admin_write`） |
| AE8 | `ask/es-dept-query-filter.test.ts`（`非空 ownerDeptIds：追加 terms`、`enforce 开非超管：含可见部门 terms 列表`、`超管：无部门 terms`、`精确 ∪ inherit 子孙`）；`ask/es-principals-query-filter.test.ts`（`apply + userId`、`成员：带 apply 与 userId，不跟 enforce`）；`worker/tests/ingest/es-http.test.ts`（`bulk 有 ownerDeptId 才写入字段`、`bulk：null 不写；[] 写哨兵`） | **部分**。两路各自有断言，**无单例同时断言 dense 语料与 ES terms 的对称**；**ES 真过滤行为未验** |
| AE10 | `acl/retrieve-dept-acl.test.ts`（`祖先成员可见子孙 20，不可见 30`、`inherit false：祖先不可见子孙 20`）；`kb/dept-inherit-down.test.ts`（KB 覆盖三态 + `grant 不被关`） | **部分**。检索层谓词 + KB 覆盖已断言；**缺 HTTP/ask 端到端** |
| AE11 | `acl/retrieve-dept-acl.test.ts`（`祖先成员可见子孙 20，不可见 30`、`祖先负责人可见子孙 30`、`级别不够 → 不可见`） | **部分**。同上，仅谓词层 |
| AE12 | `acl/retrieve-dept-acl.test.ts`（`下级不可见仅挂在上级的文档`、`grant 在子孙、文档在祖先 → 不可见`、`未过期 grant≥级别 → 精确该部门可见（含 40）`） | **部分**。谓词层已断言；**「兼任」无专例**；缺 HTTP/ask |

**整片缺口**：全仓 `apps/api/tests/ask/*.test.ts` 中**无一处**出现 `deptAcl` / `ownerDeptId`（关键词 `ownerDeptId|deptAcl|dept_acl`，0 命中）→ ask 侧部门强制是**整片没测**，不是逐行欠测。

### 2. 最小可断言形态

**共同惯用法（HTTP 层）**：`new Hono()` + `requestIdMiddleware` + `attachAuthMiddleware` + `route('/api/v1', …)`；令牌 `issueTokenPair({userId, app, roles, tenantId})`；依赖用 `vi.mock('<模块路径>')` 整模块替换。**不改 env 默认值**让强制生效的三条既有先例：

- **路由层**（documents / chunks）：`documents-dept-filter.test.ts:92-99` 用 `vi.mock('../../src/services/retrieve/dept-acl.js', importOriginal)` 局部覆盖 `isDeptAclEnforced: () => deptAcl.enforce`；或走 KB 覆盖（同文件 `:185-197`，`documentRepo.getKb` 返回 `configJson`）。
- **检索层**（`runRetrieve`）：`ask/es-dept-query-filter.test.ts:44-75` mock `kb-settings.js` / `departments.js` / `dept-grants.js`，再置 `retrieveKb.configJson = { deptAclEnforce: true }`；亦可 `vi.stubEnv('DEPT_ACL_ENFORCE','true')`（`dept-acl.ts:8` 每次调用现读 `process.env`）。
- **ask 端到端**：`createAskRoutes({ resolveKbMember, getKb, settingsRepo, executeDeps: { skipTrace: true, graphDeps: { chat: scriptedChat({...}), retrieveDeps } } })`（`graph/run.ts:57-74`、`services/ask/execute.ts:47-58`）；`retrieveDeps` 按 `es-dept-query-filter.test.ts` 的 `retrieveDeps()` 造（`loadCorpus` 夹具 + `mockEmbedVector` + `esMode:'http'` + `sparseSearch` stub）；`chat` 用 `apps/api/tests/ask/_support/graph-harness.ts` 的 `scriptedChat`。断言响应体 `data.evidence` / `citations` 不含被禁 docId。

逐缺口：**AE4/AE5/AE6/B2-1（ask E2E）** 用上述 ask 路由夹具，断言层 = HTTP，强制 = `retrieveKb.configJson = { deptAclEnforce: true }`（env 保持默认 false）；AE5 需补 `deptState.assignments = [{ deptId, isLeader: 1 }]` 分支（现库内无）。**AE4/AE5/AE6/AE10/AE11/AE12（HTTP 列表/详情）** 用 `documents-dept-filter.test.ts` 同形桩。**AE7** 拆两条：(a) 谓词串联 —— 用既有 `createMemoryDeptGrantsRepo()`（`dept-grants-http.test.ts:15`）POST grant 后把 `listGrants` 结果喂 `filterDocsForDeptAcl`，断言 D_mgr 进结果（检索层，无需 env）；(b) 审计 —— `vi.spyOn(loggerMod,'childLogger')` 断言 POST 后 `payload.event === 'admin_write'` 且 `path` 为 `/api/v1/admin/dept-cross-grants`（先例 `apps/api/tests/obs/admin-write-audit.test.ts:145-180`）。**AE8（对称）** 单例内 `vi.stubGlobal('fetch', …)` 抓 ES POST body 同时断言 dense 侧输入语料（`loadCorpus` 收到 `bypassDeptAcl=false` 且 evidence 不含禁块）。**B2-1（answer 文本不泄漏）** 用 ask 夹具让 `scriptedChat` 的 generate 引用场外 docId，断言 citations/evidence/answer 文本都不含（先例 `ask/scope-hr-excludes-finance.test.ts` 的 X2/X7 写法）。**B2-2/B2-3** 仓库没有任何"真 `loadCorpusFromDb` 被调用"的测例；可离线的一截 = 断言 `loadCorpus` 契约（`ask/retrieve-run.test.ts` 的 `forwards userId to loadCorpus` 已有）+ 入队载荷 `stage=chunk`；"reindex 后 ES 载荷换新 principals"只能在 worker 侧按 `sparseBulkSource` 载荷断言（先例 `worker/tests/ingest/es-http.test.ts`）。其余见第 3 节。

### 3. 必须真 ES（或真 PG）才能断言 —— 不算"可做项"

1. **ES 索引→查询的真实过滤行为**：keyword 映射是否成立（`es-http.ts:99` 自陈"dynamic 把 uuid 映成 text 会导致 term 静默不命中"）、`terms: { ownerDeptId: [...] }` 对缺字段文档的实际命中、`aclPrincipals` 哨兵与 `must_not exists` 在真索引上的组合语义。现测全部只抓请求体（`vi.stubGlobal('fetch')`），**无法反证"ES 真按条件过滤"**。
2. **B2-2 全链**：`收紧 → reindex → 该用户不可检索` 中"reindex 覆盖 ES 旧 principals"这一半。
3. **AE8 的"缺字段不得当全员可见"**。
4. **B2-3 dense 单路泄漏**：本仓 dense 是进程内 cosine over PG 装载的 embeddings（全仓无 pgvector ANN 查询），泄漏只可能来自**真 PG 的 `loadCorpusFromDb`** —— 属"真 PG"而非"真 ES"，同样不能离线断言。

### 4. 反证方式（破坏哪处代码让断言变红）

- **B2-1**：改 `doc-acl.ts` 的 `null`/`[]` 分支（如把 `[]` 当可读）→ `[] → 不可见`、`B2-1 最小` 红；删 `documents/index.ts` 的 `document acl denied` 闸 → `GET 详情：名单外 403` 红；删 `retrieve.ts` 的 `sparseRanked.filter((id) => byId.has(id))` → `acl-tighten-index-lag` 第一例红。
- **B2-2**：改 `kb-settings.ts:210-212` 的 `??` 覆盖顺序 → `dept-acl-enforce-resolve.test.ts` 红；改 PUT `/acl` 的收紧判定 → `收紧才提示需 reindex` 红。
- **B2-3**：删 `retrieve.ts:189-198`（sparse 与语料求交）→ 两例红；**删 `corpus.ts` 的部门/名单组合本身不会让现有任何测例变红** —— 这就是缺口（`documents-dept-filter.test.ts` 已把 `dept-acl.js` 整模块 mock 掉）。
- **B2-4**：改 `doc-acl.ts` 三态分支 → 多条红。
- **AE4**：去掉 `dept-acl.ts` `effectiveLevel` 中非负责人的 20 上限 → `同部门成员可见 20，不可见 30` 红；改 `documents/index.ts` 的部门过滤调用 → `开 + 部门不同 → 403` 红。
- **AE5**：删 `dept-acl.ts` 的 `a.isLeader ? 30 : 20` → `同部门负责人可见 30` 红（**HTTP 层无断言，改 route 不会红**）。
- **AE6**：把 `ownerDeptId == null` 的可见级改为全放 → `无归属只见空部门且级别够` 红。
- **AE7**：把 `isGrantActive` 恒 true → `过期 grant → 不可见` 红；删 grant 合入 max 的分支 → `未过期 grant≥级别` 红；**删 `dept-grants.ts:110-113` 的 `dept_cross_grant_create` 与 `/admin/` 前缀分支 → 现无测例变红（缺口）**。
- **AE8**：把 `ownerDeptIdsForSparseSearch` 改成恒 `undefined` → `enforce 开非超管：含可见部门 terms 列表` 红；删 `buildAclFilter` 的 terms 追加 → 两条红；worker 侧删 `es-http.ts:68-82` 的 ownerDeptId/principals 写入 → 两条红。
- **AE10/AE11/AE12**：把 `isAncestorPath` 改成对称包含或忽略 `inheritDown` 参数 → 三条红；删 KB 覆盖 → `kb/dept-inherit-down.test.ts` 红。

**未验证**：本票只读测例文件，**未实跑**；"现有测例断言了什么"基于源码判读。第 3 节的划出项**未验证**且不可离线验证。
