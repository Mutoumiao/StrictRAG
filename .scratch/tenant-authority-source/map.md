# ask 的租户权威源（检索两条取值链合一）

Label: wayfinder:map
Status: 进行中（前沿：工单 01 研究）

## Destination

把「**ask 在检索期到底该认哪个租户**」从**两处取值链各自为政**的现状，变成**一条可核对、可断言、方向 fail-closed 的规则**（权威源 + 落点 + 反漂移），并落成源码 + 测例 + 镜像。

今天的样子（开工基线已逐条核过源码；明细由工单 01 补齐）：

- **查询期（ES 稀疏腿）** 取**入口租户**：`apps/api/src/routes/ask.ts` 的 `auth.tenantId ?? kb.tenantId` 一路传到 `apps/api/src/services/retrieve/retrieve.ts` 的 sparse 查询，硬闸在 `apps/api/src/services/retrieve/es-sparse.ts` 的 `requireTenantId`（缺 / 空即抛，禁止补默认租户、禁止少过滤）。
- **装载期（PG 语料）** 取**文档行租户**：`apps/api/src/services/retrieve/corpus.ts` 的 `dual[0]?.tenantId`，而 `dual` 来自「按 `kbId` 取出的文档行」的过滤结果 —— **取第一行**，且该查询**不按租户过滤**。
- **写侧只有一个源**：文档行 `tenant_id = kb.tenantId`（`apps/api/src/routes/documents/index.ts`），worker 全链（chunks / embeddings / ES bulk / 入库报告）都用 `doc.tenantId`（`apps/worker/src/ingest/pipeline.ts`）。

于是 `auth.tenantId ≠ kb.tenantId` 时，ES 腿按入口租户过滤、库里的分片按 KB 租户落的索引 → **稀疏召回静默丢失**（**不泄漏**：异租户命中会被 PG 语料求交滤掉）。**可达路径已核实存在，不是纯理论**：`/api/v1/auth/web/dev-login` 的 `tenantId` 直接来自请求体（`apps/api/src/routes/auth.ts`），而超管跳过 KB 成员资格（`apps/api/src/auth/permissions/resolve.ts`）→ 可以造出「租户 B 的会话去问租户 A 的库」。

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
| 2 | 该值直达 sparse 查询；缺 / 空即抛（禁止补默认租户） | `apps/api/src/services/retrieve/retrieve.ts:198` · `apps/api/src/services/retrieve/es-sparse.ts:52` |
| 3 | 语料装载取**文档行**租户，且取的是**第一行**；文档按 `kbId` 取、不按租户滤 | `apps/api/src/services/retrieve/corpus.ts:62` · `:70` |
| 4 | 写侧唯一源 = `kb.tenantId`；worker 全链用 `doc.tenantId`（含 ES bulk） | `apps/api/src/routes/documents/index.ts:204` · `:333` · `apps/worker/src/ingest/pipeline.ts:620` · `:931` |
| 5 | 内口评测路径的租户源是 **KB 行**（入队带 `kb.tenantId`，内口取请求体原值） | `apps/api/src/routes/eval.ts:276` · `:319` · `apps/worker/src/eval/execute-ask-http.ts:52` |
| 6 | 可达路径存在：`/web/dev-login` 的 `tenantId` 来自请求体；超管跳过 KB 成员资格 | `apps/api/src/routes/auth.ts:99` · `apps/api/src/auth/permissions/resolve.ts:52` |
| 7 | 成员行租户取**邀请人**的租户，全仓无「目标用户须同租户」校验 | `apps/api/src/routes/members.ts:73` |
| 8 | 既有断言：装载面 fail-closed（文档行缺租户 → 部门文档不可见）；「ES 收窄与 PG 语料同源」两侧传**同一个** `TENANT` | `apps/api/tests/acl/dept-acl-ask-e2e.test.ts:327-341` · `:342-` |
| 9 | 默认租户常量位置 | `apps/api/src/services/members.ts:8` |

## Decisions so far

<!-- 每关闭一张工单追加一行：名称（链接）+ 一行要点 -->

- [01 · 现状核实：租户取值链全图与可达性](./issues/01-research-tenant-authority.md) — pending
- [02 · 裁定：权威源与落点](./issues/02-dec-tenant-authority-ruling.md) — pending
- [03 · 落地：源码 + 测例 + 反证](./issues/03-task-land-ruling.md) — pending
- [04 · 回写：镜像 / spec / 雾清单 + 对抗性复核](./issues/04-task-writeback.md) — pending

## Not yet specified

- 收口时回填（本图未收口前，未知项留在 Destination 的「不含」与 Notes 里）。

## Out of scope

- 改 `prds/00–11` 已冻语义（须 ADR → 改 PRD → 升版）
- 多租户独立 ES 索引（B8 全文）· 租户表 / 租户生命周期
- 改任何生产默认开关 · 真模型 live 跑数 · 人签
- web / admin 的视觉与交互改动（本机无浏览器验证手段）
