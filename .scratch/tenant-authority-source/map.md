# ask 的租户权威源（检索两条取值链合一）

Label: wayfinder:map
Status: resolved（前沿：空；工单 01–04 全收口）

## Destination

把「**ask 在检索期到底该认哪个租户**」从**两处取值链各自为政**的现状，变成**一条可核对、可断言、方向 fail-closed 的规则**（权威源 + 落点 + 反漂移），并落成源码 + 测例 + 镜像。

今天的样子（开工基线已逐条核过源码；明细由工单 01 补齐）：

- **查询期（ES 稀疏腿）** 取**入口租户**：`apps/api/src/routes/ask.ts` 的 `auth.tenantId ?? kb.tenantId` 一路传到 `apps/api/src/services/retrieve/retrieve.ts` 的 sparse 查询，硬闸在 `apps/api/src/services/retrieve/es-sparse.ts` 的 `requireTenantId`（缺 / 空即抛，禁止补默认租户、禁止少过滤）。
- **装载期（PG 语料）** 取**文档行租户**：`apps/api/src/services/retrieve/corpus.ts` 的 `dual[0]?.tenantId`，而 `dual` 来自「按 `kbId` 取出的文档行」的过滤结果 —— **取第一行**，且该查询**不按租户过滤**。
- **写侧只有一个源**：文档行 `tenant_id = kb.tenantId`（`apps/api/src/routes/documents/index.ts`），worker 全链（chunks / embeddings / ES bulk / 入库报告）都用 `doc.tenantId`（`apps/worker/src/ingest/pipeline.ts`）。

于是 `auth.tenantId ≠ kb.tenantId` 时，ES 腿按入口租户过滤、库里的分片按 KB 租户落的索引 → **稀疏召回静默丢失**（**不泄漏**：异租户命中会被 PG 语料求交滤掉）。**可达性已核清（工单 01 修正）**：主体是「**只在 dev/test 可达**」—— 造不等必须让 JWT claim 取到与 KB 不同的租户，而 `/api/v1/auth/web/dev-login` 的 `tenantId` 直接来自请求体（`apps/api/src/routes/auth.ts`），该路由被 `APP_ENV∈{development,test}` 守卫（生产 404），且请求体租户**只对全新 email 生效**（已存在的 email 直接返回旧行租户）；超管跳过 KB 成员资格（`apps/api/src/auth/permissions/resolve.ts`）故不需要成员行。另有「**结构上可达但无触发面**」一条：内口 `POST /internal/eval/execute-ask` 当时**既不校验 `kbId` 存在、也不校验 `body.tenantId`**（现行 worker 发的是 KB 行租户，故正常运行不等值不会发生）。**不是纯理论**：真 ES 最小对照已跑出旧行为数字（同库三文档租户 A/A/B：用 A 查 2 命中、用 B 查 1；单租户库 A→1、用 B→**0**）。

到达时同时满足：

1. **权威源有裁定书**：写清 ask 检索期认哪个租户，并给出依据（`prds/00–11` 或 ADR 的原文 + 行号）；**指不到冻结文本的必须自陈是「实现选择」**，并说明改动的方向为什么是加严。
2. **两条取值链的关系说清**：谁与谁是同一个变量、谁该改、谁只是「同值而不同源」；并给出**可达性结论**（`auth.tenantId ≠ kb.tenantId` 今天有哪些路径能造出来、生产档位能不能）。
3. **落地**：源码改动（若有）或显式「不改 + 加断言」；改动**只加严或逐位等价**；除裁定书判错的宽松口径外，**不翻任何既有断言**。
4. **反证成立**：拆掉判据 → 若干条测例必红；并给出「改前会丢 / 改后不丢」或「改前不可分辨 / 改后可分辨」的逐条对照。
5. **回写一致**：`.trellis/spec/api/backend/`（检索 / 鉴权相关）· `docs/module-status/api.md`（技术债里簇 40 那一条）· 覆盖表相关行（若有）· 雾清单**簇 8 / 簇 40** · 兄弟图 `retrieve-corpus-tenant-scope` 的指针。
6. **邻接缺口如实入档**：本图若带出相邻缺口（例如成员行租户取**邀请人**的、全仓无「目标用户须同租户」校验；装载面取「第一行」租户的位置脆弱性；`kb_members.tenant_id` 有没有消费者），**记债或划出**并写销账条件 —— 不顺手做，也不隐去。
7. **未验证的如实写**：本图的判定是**取值链判断**；真 ES 上的端到端复现按实际能不能跑来写（本机 Docker / 真 ES 的可用性以实测为准，不凭前图口径推断）。

**不含**：改任何 `prds/00–11` 冻结文本 · 改任何默认开关 · 多租户独立 ES 索引（B8 全文）· 建租户表 / 租户生命周期 · 成员邀请的租户校验（除非裁定判定它就是本图必须堵的那一格）· web / admin 的视觉与交互改动。

## Notes

- 域：StrictRAG。**WHAT** 冲突以 `prds/00–11` 为准；**IS 以源码为准**，`docs/module-status/` 是镜像，`docs/testing/coverage/` 是派生对照。
- **来源**：`.scratch/fog-inventory-2026-09-23.md` **簇 40**（2026-10-09 新记）与表格里**簇 8** 的「裁定为不修 + 指向簇 40」；正文与证据在 `.scratch/retrieve-corpus-tenant-scope/`（工单 01–04 已收口）。
- **兄弟图的裁定边界（本图承接，不推翻）**：`retrieve-corpus-tenant-scope` 已裁「**装载面不改**按入口租户收窄」，理由 = 既有 fail-closed 测例有意钉住 + 无 PRD 依据 + 两源在正常数据下同值 + 代价收益不对称；同时记下真问题「ask 的租户有**两源**」并把三条处置原样转给本图。本图就是那张裁定图。
- **内口路径的不对称（裁定时的硬材料，不是既定结论）**：入队用 `tenantId: kb.tenantId`（`apps/api/src/routes/eval.ts`），内口 ask 取请求体里的 `tenantId`（同文件），worker 原样带回（`apps/worker/src/eval/execute-ask-http.ts`）→ **评测路径的租户源是 KB 行**，与用户路径（入口租户）不同源。同一仓里两条入口对同一个问题给了两个答案，这条必须进裁定书。
- **兄弟图留下的两条测试基建事实**（本图直接相关）：① 全仓**无夹具**造过「文档行租户 ≠ 入口租户」；② 装载测例把 `db.js` 的 `where` **mock 成忽略入参**，所以新增查询谓词**没有回归保护**。裁定若要求「不等即拒」，不能只靠 mock 测例自证。
- 每轮先读：本图 · `docs/agents/issue-tracker.md` · `docs/agents/domain.md` · `prds/09-security/01-auth-acl-compliance.md`（租户边界）· `prds/03-data/`（租户列）· `prds/05-api/01-http-api-hono.md`（ask / 内口）· `prds/10-delivery/03-acceptance-scenarios.md`（AE8 对称）· `docs/module-status/api.md`。写代码前读 `.trellis/spec/api/backend/index.md`。
- **本图携带执行**：工单可以直接改代码、补测例、回写镜像，不只锁决策。同一缺口**禁止**再 `task.py create` 平行实现任务。
- **只在本分支（`main`）**：不建 worktree，不新建分支。
- **门禁**：每收一张工单跑 `pnpm check-types` + `pnpm lint`（零 warning）+ 相关包测试；收口批次跑全仓 `pnpm test`（`--concurrency=1`，`web` 包在 CPU 争用下会假超时），并跑 `pnpm check:module-status`（`1-路径` / `6-联动` / `7-时效` 必须为空）。测例只进 `<包>/tests/<能力>/<意图>.test.ts`，文件头「目标 / 需求 / 被测 / 简介」必须简体中文，并登记该包 `tests/index.md`；测试存货闸须**在包目录内**跑。
- **写回纪律（前图教训）**：`docs/module-status/*.md` 正文**不写 `路径:行号`**（会触发 `1-路径` 误报），也不给裸枚举字面量加反引号（会堆 `5-表` 噪声）；行号只写在 `.scratch/` 工单与 `.trellis/spec/` 里。
- **收口复核纪律**：收口声明必须在**最后一次提交之后**复跑 `pnpm check:module-status`，并对回写做**对抗性反向复核**（逐条核「这话在源码里真能指到吗」）。
- **质量红线不放宽**：检索→约束生成→验证→拒答；min 否决；合法 draft 必 verify；历史≠evidence；门禁只加严不放宽；双就绪∧active 检索闸。
- **改既有测例的红线**：`apps/api/tests/acl/dept-acl-ask-e2e.test.ts` 里 `describe('语料装载的 tenantId 来源（fail-closed）')` 与 `describe('runRetrieve 的 ES 收窄与 PG 语料同源（AE8 对称）')` 两组都是**有意断言**；若裁定判定其中任一侧应改判，必须**先裁定、再改断言**，并把「旧断言钉的是哪条口径、为什么它与裁定冲突」写进工单。
- **本机限制**：无浏览器验证手段 → web / admin 视觉改动不在本图；真 ES / 真 PG 的可用性按实测写。

### 开工基线（2026-10-10 · 立图时逐条核过源码）

| # | 事实 | 证据（行号见 `.scratch/`，镜像里不写） |
|---|------|------|
| 1 | ask 的入口租户 = `auth.tenantId ?? kb.tenantId`，进 `runAsk` | `apps/api/src/routes/ask.ts:314` · `:362` · `:390` |
| 2 | 该值直达 sparse 查询；缺 / 空即抛（禁止补默认租户） | `apps/api/src/services/retrieve/retrieve.ts:198` · `apps/api/src/services/retrieve/es-sparse.ts:47-56`（判定体 `:52`） |
| 3 | 语料装载取**文档行**租户，且取的是**第一行**；文档按 `kbId` 取、不按租户滤 | ~~`corpus.ts:62` · `:70`~~ → **工单 01 修正为** `apps/api/src/services/retrieve/corpus.ts:64` · `:71` |
| 4 | 写侧唯一源 = `kb.tenantId`；worker 全链用 `doc.tenantId`（含 ES bulk） | `apps/api/src/routes/documents/index.ts:204` · `:333` · `apps/worker/src/ingest/pipeline.ts:620` · `:931`（另 `:633` · `:697` · `:824`） |
| 5 | 内口评测路径：入队带 `kb.tenantId`、内口取请求体原值、worker 原样回传 | `apps/api/src/routes/eval.ts:276` · `:319` · `apps/worker/src/eval/execute-ask-http.ts:52`。**工单 01 修正措辞**：这不是「以 KB 行为准的闸」，而是「**接受任意 `tenantId`** 的开口」—— 该 handler 当时既不校验 `body.tenantId` 等值、也不校验 `body.kbId` 存在（本图已补） |
| 6 | 可达路径：`/web/dev-login` 的 `tenantId` 来自请求体；超管跳过 KB 成员资格 | `apps/api/src/routes/auth.ts:99` · `apps/api/src/auth/permissions/resolve.ts:52`。**工单 01 补两条前提**：① 整条只在 `APP_ENV∈{development,test}` 通（`auth.ts:38-40` / `:90-92`，生产 404）；② 请求体租户**只对全新 email 生效**（`apps/api/src/services/members.ts:50-64`） |
| 7 | 成员行租户取**邀请人**的租户，全仓无「目标用户须同租户」校验 | `apps/api/src/routes/members.ts:73` → `apps/api/src/services/members.ts:144-150`；**工单 01 补**：`kb_members.tenant_id` 全仓**无消费者**（`isMember` 只按 `(userId,kbId)`） |
| 8 | 既有断言：装载面 fail-closed（文档行缺租户 → 部门文档不可见） | `apps/api/tests/acl/dept-acl-ask-e2e.test.ts:327-341`。**工单 01 修正**：同文件的 `describe('…AE8 对称')`（`:343-372`）**没有断言 `tenantId`**（只断言 `ownerDeptIds` / `maxVisibleLevel` / evidence 集合）—— 「两侧传同一个 `TENANT`」是**夹具事实**，不是被钉住的量；且 AE8 原行（`prds/10-delivery/03-acceptance-scenarios.md:524`）只讲**部门条件**对称，**不涉租户** |
| 9 | 默认租户常量位置 | `apps/api/src/services/members.ts:8` |
| 10 | **工单 01 新增的关键事实（基线未列）** | `prds/11-decisions/00-adr-index.md:151`（ADR-009）与 `prds/04-pipelines/02-online-ask-langgraph.md:170` **明文要求**「检索层纵深：断言 `userId ∈ kb_members(kbId)` **且 tenant 一致**；失败 → finalize abstained `reason=not_member`（或 `internal_guard`），不进 dense/ES」—— 源码此前**只落了成员侧** ⇒ 本议题**不是「PRD 沉默」**，而是「**PRD 已明文、源码未实现**」 |

## Decisions so far

<!-- 每关闭一张工单追加一行：名称（链接）+ 一行要点 -->

- [01 · 现状核实：租户取值链全图与可达性](./issues/01-research-tenant-authority.md) — 逐段列出 `tenantId` 的来源 / 传递 / 消费点；可达性三态 = **只在 dev/test 可达**（dev-login 请求体租户 + 超管 skip 成员资格，且请求体租户只对全新 email 生效）+ **内口是结构上的开口**（不校验 kbId 存在 / 不校验 body 租户）；**真 ES 最小对照实测**：同库三文档租户 A/A/B → A 查 2 / B 查 1，单租户库 A→1 / **B→0**；**推翻四处前提**（行号 stale · 内口措辞 · dev-login 两条限定 · 「AE8 测例钉住同源」= 把夹具事实当断言），并核出**关键事实**：ADR-009 与 online-ask §5 **明文要求「且 tenant 一致」**，源码只落了成员侧。
- [02 · 裁定：权威源与落点](./issues/02-dec-tenant-authority-ruling.md) — **R1 权威源不是二选一，而是「两值必须一致」**（依据 = 上述冻结明文，属**补实现**，不触发 ADR）· **R2 比对双方 = 令牌租户 vs KB 行租户**，令牌缺 claim 时入口回落（只会产生相等）→ 「没声明」不算不一致，**否决「缺失即拒」**（会把默认档全部 ask 打成拒答）· **R3 落点 = ask 图检索节点前置**（失败形态 = abstain，不是 403），`kbTenantId` 必填（类型系统防漂移）· **R4 reason = `not_member`**（不选 `internal_guard`：其文案会把可处置问题说成偶发故障）· **R5 两条入口都落 + 内口补 `getKb`（缺 → 404）**· **R6 否决**「ES 腿改按 `kb.tenantId`」与「路由层 403」· **R7 验收与反证清单**· **R8 六个邻接缺口的留 / 划与销账条件**（含**超管跨租户不给例外** —— 与 ADR-051 `:1360`「内容与平台全路径」的字面张力，已登 `DEC-TENANT-SA`）。
- [03 · 落地：源码 + 测例 + 反证](./issues/03-task-land-ruling.md) — 10 行改动表；新增 **8 例**（图级 2 · ask 路由 3 · 内口 3），路由 / 内口用例走**真 `executeAsk` + 真图**；反证 **P1 删判定 = 3 红**、**P2 入口抹平两值 = 1 红**（恢复 8 绿）；**既有断言零翻**（api 187 文件全绿 · 1169 passed + 3 skipped，较前 +1 文件 +8 例）；`check-types` 8/8 · `lint` 8/8 · 全仓 `pnpm test` 11/11。
- [04 · 回写：镜像 / spec / 雾清单 + 对抗性复核](./issues/04-task-writeback.md) — 8 行回写表；**对抗性复核（子代理，独立复跑 api 全套）发现 1 A + 3 B + 4 C，全部已修**（关键：**裁定书 R5 与落地口径矛盾** —— R5 写内口缺 KB 判 `not_member`、实现是 **404**，按落地修裁定书；「超管不给例外」改写为**与 ADR-051 的字面张力**并登 `DEC-TENANT-SA`；「必填即防漂移」补**覆盖面边界**；补「令牌没声明租户」边界测例）。收口门禁：`check:module-status` 47 条且 `1-路径`/`6-联动`/`7-时效` 为空、全仓 `pnpm test` 11/11。

### 目的地达成（2026-10-10）

**Destination 的 7 条到达标准，逐条对照：**

1. **权威源有裁定书** ✅ —— **不是二选一，而是「两值必须一致」**，依据是**PRD 明文**（ADR-009 `prds/11-decisions/00-adr-index.md:151` 与 `prds/04-pipelines/02-online-ask-langgraph.md:170` 的「0b 检索层纵深……**且 tenant 一致**；失败 → finalize abstained `reason=not_member`，不进 dense/ES」），源码此前只落了成员侧 ⇒ 属**补实现**而非改语义（不触 ADR、未改任何冻结文本）。**PRD 沉默的只有一格**「比较哪两个 tenant」，裁定取**令牌租户 vs KB 行租户**，并自陈这是实现选择（依据：KB 行是写侧唯一的租户来源）。
2. **两条取值链的关系说清 + 可达性结论** ✅ —— 工单 01 逐段给出「来源 → 传递 → 消费点」；关系结论：写侧只有一个源（`kb.tenantId`，worker 全链 `doc.tenantId`），查询期取入口租户、装载期取文档行租户，**两者在正常数据下同值**；可达性是「**只在 dev/test 可达**」（dev-login 请求体租户 + 超管 skip 成员资格，且请求体租户只对全新 email 生效）+「内口是结构上的开口」。
3. **落地（只加严 / 逐位等价）+ 不翻既有断言** ✅ —— 检索节点前置断言 + `kbTenantId` 三处必填 + 内口补 `getKb`（缺 → 404）+ CLI 入口读 KB 行；改动方向是**能否进检索的集合变小**（加严）。**既有断言零翻**（api 187 文件 / 1169 passed + 3 skipped）：ES 稀疏腿取值来源与装载面**都没动**（R6 明确否决，各会翻两条 / 一条既有断言）。
4. **反证成立** ✅ —— P1（删判定）**3 红**、P2（入口用 `tenantId` 顶替 `kbTenantId`）**1 红**；两处探针都命中真判据（P2 命中的正是「静默抹平不等」这个漂移口）。
5. **回写一致** ✅ —— spec 三处（ask-pipeline 新增 0b 决策节 · departments · quality-guidelines）· `docs/module-status/api.md`（技术债行 / 最近更新 / 证据行）· 覆盖表 `03-ops.md` O1 行 · 雾清单**簇 40 与簇 8** + 2026-10-10 追加段 · 兄弟图 `retrieve-corpus-tenant-scope` 标已销 · 总 backlog §2.6 新增 `DEC-TENANT-SA`。
6. **邻接缺口如实入档** ✅ —— 六条邻接缺口逐条给了「留 / 划 + 销账条件」：`kb_members.tenant_id` 取邀请人租户（无消费者）· 内口硬编码成员槽（绕过 0b 成员侧）· 装载面取「第一行」租户 · `09-security:219` 措辞差（不改 PRD）· 装载测例 mock 忽略 `where`（无回归保护）· **超管跨租户不给例外**（与 ADR-051 的字面张力 → `DEC-TENANT-SA`）。复核又补出第七条第 dev 探针。
7. **未验证的如实写** ✅ —— 真 ES 只跑了**最小对照**（证明**旧行为**：A 查 2 / B 查 1，单租户库 A→1、B→0）；**新行为的端到端（起 api + 真 PG + 真 ES + 网关）本轮未做**，验证停在图级 / 路由级。真 PG 上的 `loadCorpusFromDb` 端到端**未跑**。

**该被记住的四句话**：

① **「两源不等」不等于「该选一个当权威」** —— 冻结明文要的是「**一致**」；本图的正确产出是**补上那条未实现的断言**，而不是挑一个源去改另一条腿。
② **先核 PRD 再裁「沉默」** —— 立项时以为本议题「PRD 沉默」，工单 01 一读就翻：ADR-009 与 online-ask §5 逐字写着「且 tenant 一致」。**「我没找到」与「不存在」是两件事**。
③ **测试自己的名字也会骗人** —— `describe('…AE8 对称')` 让两任读者以为「租户同源有剧本背书」，而它**根本没断言 `tenantId`**，AE8 原行只讲**部门**条件；「两侧传同一个常量」是夹具事实。**夹具同值 ≠ 有保护**。
④ **必填的入参是防线，但要认清防线在哪结束** —— `src/` 三处必填挡住新入口；`tests/` 不进类型门、CLI 那个参还是可选 —— 这条残余必须写在纸上，否则「类型系统防漂移」会变成一句自我安慰。

## Not yet specified

> 收口后剩下的雾，按「谁挡谁」分组；每条带**销账条件**。

- **直接调用 `runRetrieve` 的调用点不受本断言保护**（今天只有测试与 dev 探针）：生产入口都经 ask 图 → 有闸。销账条件 = 出现**第三个生产入口**时把断言**下沉到 `runRetrieve`**（届时给 `RetrieveInput` 加必填 `kbTenantId`，或让 ES 腿改按 KB 租户取值——后者会翻两条既有断言，须同批处理）。
- **CLI 批跑的嵌入式用法**：`RunL1Options.kbTenantId` / `RunL2Options.kbTenantId` 是可选（`?? tenantId`），以编程方式调用 runner 不传时等于声明「入口租户就是 KB 租户」。销账条件 = 把该参提为必填，或让批跑改走内口 HTTP。
- **超管跨租户是否放行**：ADR-051 `:1360` 写「超管全权……内容与平台全路径」但**未写租户**，与 ADR-009 的「一致」形成字面张力；本图按 ADR-009 判**不给例外**，已登总 backlog `DEC-TENANT-SA`。销账条件 = 接真 IdP / 多租户试点**之前**由 ADR 明确（若判可放行，须 ADR → 改 PRD → 升版，并同步开例外）。
- **内口把 `membership: 'member'` 硬编码**：0b 的**成员侧**在该口被绕过（本图只补了租户侧）。销账条件 = 动内口信任模型（让内口携带真实身份或上游成员判定）。
- **成员行租户取邀请人的 + 无「目标用户须同租户」校验**：`kb_members.tenant_id` 今天**无任何消费者**，故不产生越权。销账条件 = 真 IdP 接入或该列出现第一个消费者时必裁。
- **装载面取文档行「第一行」租户**：今天无路径能造出「同 KB 内文档行租户不一致」，且 `select` 无 `ORDER BY` ⇒ 一旦出现就是不确定行为。销账条件 = 先裁「哪一行才算」或给装载查询加租户谓词（后者须同步改测试 mock 口径或用真 PG 验）。
- **`prds/09-security/01-auth-acl-compliance.md:219` 省略「且 tenant 一致」**：与 ADR-009 / online-ask 的措辞不一致。本图**不改 PRD**，只在 spec 与镜像写明「以更具体者为准」。销账条件 = 下一次 PRD 修订时对齐措辞。

## Out of scope（真正的划出项）

- 改 `prds/00–11` 已冻条款（含把本断言写进 PRD）：须 ADR → 改 PRD → 升版
- **ES 稀疏腿改按 `kb.tenantId` 取值** 与 **路由层 403 拒**：本图**明确否决**（R6，各附理由与翻断言面）
- 语料装载面改成入口租户：会翻 `dept-acl-ask-e2e.test.ts:327` 的 fail-closed 用例，且与本图的纵深方向无关
- 多租户独立 ES 索引（B8 全文）· `es_index_routes` / `SparseIndexRouter`（全仓未实现）· 租户表 / 租户生命周期
- 改任何生产默认开关（`AUTH_ENFORCE` / `DEPT_ACL_ENFORCE` / `DEPT_INHERIT_DOWN` / `RETRIEVE_ES_MODE` / `INGEST_ES_MODE` / `SESSION_REWRITE_ENABLED` / OCR）
- 真模型 live 跑数 · 人签 · 业务 PASS
- web / admin 的视觉与交互改动（本机无浏览器验证手段）
- dev 探针 `seed-es-sparse-probe.ts` 的自取租户口径（非生产 ask 入口）
