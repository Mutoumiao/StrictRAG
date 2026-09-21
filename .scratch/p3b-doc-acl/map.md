# Phase 3b 出口的工程侧闭合（文档级 ACL + 部门强制可见）

Label: wayfinder:map
Status: resolved（前沿：空；工单 08 · 10 · 11 · 12 · 13 · 14 全收口）

## Destination

让路线图 Phase 3b 的出口「**B2 + AE（强制段）绿**」（`prds/10-delivery/01-phased-roadmap.md:199-209`）在本分支达到**工程侧可核对闭合** —— 即在不接真 ES 集群、不改仓库默认开关、无业务签字的条件下，下列五件事都能在源码与测例上指出证据：

1. **「列表预览 / chunk 查看 / ask evidence 同一可见性函数」真收敛**（ADR-057 `prds/11-decisions/00-adr-index.md:1867`）。今天是五份各写一遍的组装：文档列表 `apps/api/src/routes/documents/index.ts:157-190` · 详情/ACL 的 `docReadDenied` 同文件 `:818-860` · 分片预览 `apps/api/src/routes/chunks.ts:61-105` · ask 语料装载 `apps/api/src/services/retrieve/corpus.ts:76-98` · 近似拷贝 `hasRetrievableDocs` 同文件 `:150-182`。收敛后行为须逐位不变。
2. **dense ∥ ES 对称有结论**（ADR-009 `prds/11-decisions/00-adr-index.md:152`）。`buildAclFilter` 只在 ES 稀疏路被调用（`apps/api/src/services/retrieve/es-sparse.ts:234`）；dense 是进程内余弦、输入即 PG 语料（`apps/api/src/services/retrieve/retrieve.ts:163-170`），字面上没「共用 `buildAclFilter(ctx)`」。要么补落点，要么留一条**可核对的裁定**说明等价形态与代价。
3. **ES 查询期与 PG 谓词对称**：ES mapping 无 `visibilityLevel`（`es-sparse.ts:53-61`；ES PRD `prds/03-data/03-elasticsearch-bm25.md:75-77`、`:119` 要求级别比较）；缺 `ownerDeptId` 时 bulk 不写字段（`es-sparse.ts:89-90`），而 PG 语义是「无 owner_dept_id = 库内成员可见」（ADR-057 `:1856`）→ 开强制时库级文档丢稀疏召回。
4. **剧本 B2-1…B2-4 与 AE4–AE12 有自动化断言**（含负向 / 反证），且在**显式开启强制**的配置下跑，不靠人签。
5. **ACL 收紧 → 索引一致性**有裁定与落点：今天 PUT 收紧只回 `reindexRequired` + 日志（`apps/api/src/routes/documents/index.ts:911-928`），不入队。

到达时：`pnpm check-types` / `pnpm lint` / `pnpm test` 全绿；`docs/module-status/`（api · worker · db）与 `docs/testing/coverage/02-acl.md` 按源码回写；`docs/testing/coverage/02-acl.md:160` 的「非本阶段」一行只剩**真 ES 集群验证**、**人签**与**明确的 ADR 债**，不再有工程可做的余项。

## Notes

- 域：StrictRAG。WHAT 冲突以 `prds/00–11` 为准；路线图 = `prds/10-delivery/01-phased-roadmap.md`；剧本原文 = `prds/10-delivery/03-acceptance-scenarios.md`（B2 段 `:49-58` · AE 段 `:509-530`）。IS 以源码为准，`docs/module-status/` 是镜像，`docs/testing/coverage/` 是派生对照。
- **前图**：`close-p2-exit-gaps`（P2 出口工程缺口已清零）。本图是 P2 之后的第一个**独立产品出口**：路线图 `:180` 明写「P3b（doc_acl）**不经**本硬门，可在 P2 之后并行推进」。
- **每轮先读**：本图 · `docs/agents/issue-tracker.md` · `docs/agents/domain.md` · `docs/testing/coverage/02-acl.md` · 相关包 `docs/module-status/<包>.md`。写代码前读 `.trellis/spec/` 对应包。
- **本图携带执行**：工单可以直接写代码补缺口，不只锁决策。同一缺口禁止再 `task.py create` 平行实现任务。
- **门禁**：每收一张工单跑 `pnpm check-types` + `pnpm lint` + 相关包测试；收口批次跑全仓 `pnpm test`。新测例只进 `<包>/tests/<能力>/<意图>.test.ts(x)`，文件头目标/需求/被测/简介用简体中文，并登记该包 `tests/index.md`。
- **站规（UI）**：web / admin 禁止浏览器原生 `<select>`，必须走 `@strict-rag/ui` 关闭列表。本图预计不新增 UI。
- **质量红线不放宽**：检索→约束生成→验证→拒答；min 否决；合法 draft 必 verify；历史≠evidence；**门禁只加严不放宽**（ADR-046）；双就绪∧active 检索闸。本图所有改动必须是**收紧或逐位等价**。
- **不改仓库默认开关**：`DEPT_ACL_ENFORCE` / `DEPT_INHERIT_DOWN` / `AUTH_ENFORCE` / `RETRIEVE_ES_MODE` / `INGEST_ES_MODE` / `SESSION_REWRITE_ENABLED` / OCR / `INGEST_CONTEXTUALIZE_MODE` 的默认值一律不动。AE 强制段靠 **KB 覆盖（`config_json.deptAclEnforce`）或测例内 env 注入**达成（`apps/api/src/env.ts:108-113` 注释「禁止默认 true」；`docs/ops/operable-stack.md:73` 把「仓库默认开」列为明确不是项）。
- **不改 `prds/00–11`**：任何「与 PRD 字面不一致」只能以「源码收紧 + 记 ADR 债」收口；销账须 ADR → 改 PRD → 升版本。
- **写回纪律（前图教训）**：`docs/module-status/*.md` 正文**不写 `路径:行号`**（会触发 `pnpm check:module-status` 的 `1-路径` 误报），也不给裸枚举字面量加反引号（会把 `5-表` 告警刷高）。行号只写在 `.scratch/` 工单与 `.trellis/spec/` 里。
- **已知前置（未验证项）**：本机 Docker daemon 未运行 → 迁移无法对真 PG 验证；此类未验证须显式写在工单 Answer 与回写里。
- **票面调整（2026-09-20）**：`09` 原含"部门组重塑"，执行时拆成两张 —— `09` 只落级别组与字段（**纯增量、不破坏既有断言**），部门组重塑另立 [13](./issues/13-task-es-dept-reshape.md)（会改写既有 `terms` 精确断言，单独承担断言改写与反证）。**执行顺序**：本图先做 `09` 而非编号更小的 `08` —— 09 是行为修复（ES 侧可见级收窄 + 索引字段对称）且改动面自洽可单独回滚；`08` 是横跨四个入口的结构性重构，需单独一轮以保证"逐位等价"。
- **本图第一张代码票的收口门禁（2026-09-20 · 09）**：`pnpm check-types` **8/8** · `pnpm lint` **8/8 零 warning** · `pnpm test` **11/11**（api **162** 文件 / **988** 通过 + 3 skipped；改前为 980，新增 8 条为本票所加）· `pnpm check:module-status` **39 条**（仍为 2 env + 13 符号 + 24 表），`1-路径` / `6-联动` / `7-时效` 全空 —— 其中 `6-联动` 曾报「改 apps/api|worker 未改对应镜像」2 条，已按源码把 `docs/module-status/api.md` 与 `worker.md` 回写清零（回写里含一条**修正**：原记「缺激活 version 表示」为 reindex 前置系陈旧，`active_index_version` 已落地）。**覆盖表（`docs/testing/coverage/02-acl.md`）的 B2/AE 行改写仍归工单 12**，本票未动。
- **HOW 回写（2026-09-20 · 09 收尾）**：`.trellis/spec/api/backend/departments.md` 增「检索期部门 / 名单收窄与 ES 索引一致性」一节 —— 记形态约束（filter 数组元素间 AND、新条件一律加独立元素）、级别组的上界语义与 `maxVisibleLevel` 三态信号、ACL 收紧 = 人工 reindex 的口径，并修正旧文里「缺激活 version 表示」的陈旧说法；节尾列明未覆盖项（真 ES 集群行为只断言到请求体形状）。**这同时落掉了工单 10 的「口径写进 spec」一半**；10 余下的是 B2-2 的测例口径断言。

## Decisions so far

- [可见性组装有几份、每份差在哪](./issues/01-research-visibility-seams.md) — 五处（列表 · 详情/ACL · 分片 · ask 语料 · `hasRetrievableDocs`）**行为等价**，无放宽拷贝；唯一"近似拷贝" `hasRetrievableDocs` 是**死代码**（全仓 3 命中，无调用方）。真差异只有三条且都不是放宽：tenantId 取值三选（fail-closed 方向）、超管 bypass 通道（路由直判 vs 检索读 `membership` 槽，**跑批刻意压低，必须保留**）、成员断言位置（都在调用方）。给出收敛接缝签名与逐处回归测例清单。
- [dense∥ES 对称与 ES 部门字段的差额性质](./issues/02-research-es-dept-parity.md) — `buildAclFilter` 未被 dense 调用属**纯形态差额**（dense 输入即 PG 闸后语料，既不泄漏也不额外少召回）；ES 无 `visibilityLevel` 是**层内泄漏侧**，被 `retrieve.ts:195` 语料求交兜住，残余是"不可读命中白占 `size` 槽"的召回副作用；缺 `ownerDeptId` 不写字段是**召回侧**（库级文档丢稀疏召回），且"ids 为空"时 ES 对部门文档 **fail-open**。给出级别组/库级分支的候选 filter 形态与"只加严"证明。角色 principal 今天 ES 与 PG **逐位一致**，缺它是**能力缺口**而非泄漏。
- [B2/AE 剧本的测例级缺口](./issues/03-research-p3b-test-map.md) — 12 行逐行映射到测例；B2-4 已断言，其余 11 行为**部分测**；最大缺口是**整片**：`apps/api/tests/ask/*.test.ts` 里**无一处**出现 `deptAcl`/`ownerDeptId`（0 命中）→ ask 侧部门强制从未端到端断言。给出每条的最小夹具/断言层/不改默认开关的开强制手法/反证方式，并单列必须真 ES（或真 PG）才能断言的 4 项。
- [裁定「同一可见性函数」的形态与落点](./issues/04-dec-visibility-function.md) — 抽 `apps/api/src/services/retrieve/visibility.ts`（`loadVisibilityContext` + `isDocVisible` + `filterVisibleDocs`），四个活入口改为调用它；**删除死代码 `hasRetrievableDocs`**；**本步不引入请求级缓存**（避免请求内失效语义）；固定"部门 → principals"顺序与 `reason` 供调用方映射 403 文案；成员闸仍在函数外；bypass 通道与 tenantId 来源的既有差异**必须保留**；`filterDocsForRetrieve` 不并入。
- [裁定 dense∥ES 对称走等价形态](./issues/05-dec-dense-es-symmetry.md) — 取 **B**：PG 语料 = ACL 真值源、ES 查询期 filter = PG 谓词**严格超集**且只在排序上生效、ES 命中一律经语料求交收口；**不实现 pgvector 查询期 filter**（前置不存在、收益为零、属架构变更）。三条成立条件 + 失效条件写清，并记 **3 条 ADR 债**（ADR-009 `:152`、ES PRD `:163`、在线 PRD `:188`）—— 销账须 ADR → 改 PRD → 升版。
- [裁定 ES 侧补字段与缺字段语义](./issues/06-dec-es-dept-field.md) — 补 `visibilityLevel`(integer) 到 mapping/bulk/查询期（api + worker **两处近似拷贝同改**，PG 侧 `notNull default 20` 故**始终写**）；部门组从裸 `terms` 改为 `bool.should[terms, must_not exists]`；**部门组与级别组必须是 filter 数组的两个独立元素**（并进一个 `should` 即放松）；以 `maxVisibleLevel` 是否传入作"收窄生效"的**显式三态**信号，顺手关掉"ids 为空时 ES 对部门文档 fail-open"这一处；`maxVisibleLevel = max(任一处负责人?30:20, 未过期 grant 的级别最大值)` 为上界（保"只加严"）。**角色 principal 明确不在本图落**，并写明 B2-2 只能作"移出 uuid 名单"的等价替换。
- [裁定 ACL 收紧保持人工 reindex](./issues/07-dec-acl-tighten-reindex.md) — **不自动入队**：ADR-009 `:156` 字面是"确认义务"非"自动触发"；泄漏侧今天已由 PG 闸 + 语料求交闭合（索引滞后不构成泄漏）；自动入队会引入无幂等、无预算记账的新压力面。B2-2 的成立口径写清（"不可检索"由 PG 闸即时成立，reindex 只让索引跟上）。连带核实：镜像把「缺激活 version 表示」记为前置系**陈旧**，`active_index_version` 已由前图 L7 落地。
- [落 ES 查询期的级别收窄（字段 + 级别组）](./issues/09-task-es-dept-parity.md) — `maxVisibleLevelUpperBound`（上界而非逐文档规则，故只加严）+ `visibilityLevel` 字段入 api/worker 两处 mapping 与 bulk + `buildAclFilter` 在传 `maxVisibleLevel` 时追加**独立的**级别组；`retrieve.ts` 的 `sparseNarrowingForSearch` 用同一份 IO 同时产出部门 id 与级别上界，并把 `maxVisibleLevel` 立为"收窄生效"的三态信号。**纯增量**：不传信号时 filter 与旧版逐位一致。证据：api 4 文件 **83/83** · worker 2 文件 **20/20** · 反证两处破坏各红 2 条、恢复 60/60 绿。**划出**：真 ES 集群行为（`range`/`exists`/mapping 冲突）未验证；部门组重塑拆到 [13](./issues/13-task-es-dept-reshape.md)。
- [落「同一可见性函数」收敛](./issues/08-task-converge-visibility.md) — 新增 `apps/api/src/services/retrieve/visibility.ts`（`loadVisibilityContext` 是全仓唯一的「归属 + 部门树 + grant」三连加载处 · `isDocVisible` 部门→名单 · `filterVisibleDocs`），**四个活入口 + `sparseNarrowingForSearch`** 全部改调用它；删除死代码 `hasRetrievableDocs`。**保留的差异**（不得被统一）：超管 bypass 通道（路由直判 vs membership 槽）· tenantId 来源（`CorpusLoader` 缺 tenantId 的接口缺口仍在雾中）· 输出形态与 403 文案。证据：新测例 `apps/api/tests/acl/visibility-single-function.test.ts`（4 例，四面 × 四态集合两两一致且等于钉死预期；「关强制」态证明名单闸不随部门闸失效）· **反证**把 `enforce` 置 false → 3 文件 **12 例红** · 全仓 grep 证明三连加载只剩一处。门禁：api **163 文件 / 992 通过 + 3 skipped**（收敛前 162 / 988）· type 0 · lint 0，既有测例断言**一字未改**仍全绿（逐位等价的回归背书）。
- [落 ACL 收紧的索引一致性](./issues/10-task-acl-tighten.md) — 裁定取**人工触发**，故可核对证据 = 断言「PUT 收紧**不**入队」：新增 `apps/api/tests/acl/acl-tighten-no-auto-reindex.test.ts`（3 例，mock `enqueueIngest` 调用面）—— 收紧外显 `reindexRequired=true` 但**零入队** · 放宽零入队 · 反复收紧三次仍零入队且 api 不改版本位；并钉住「PUT 只写 `aclPrincipals` 一列」。B2-2 三行口径与测例逐行落到工单正文。spec 口径与「缺激活 version」镜像陈旧项已由工单 09 落；覆盖表 B2/AE 行归工单 12。
- [裁定 `aclTightens` 在 next 侧遇 `null` 算不算收紧](./issues/14-dec-acl-tightens-null.md) — 由 [10](./issues/10-task-acl-tighten.md) 挖出：该函数把 `next = null` 当空集，`[a] → null` 判 **true**，与它自己写的「收紧 = 新集合不是旧集合的超集」「`null` = 全体成员可读」矛盾，也与既有真值表 `[] → null` 判 false 自相矛盾。**裁定为误报**：成员闸在外层 ⇒ `{a} ∩ 成员 ⊆ 成员`，`[a] → null` 不可能有人失去可读性；且 ADR-009 决策 4 的动机是**泄漏侧**（索引持旧更宽名单）。落地：`packages/contracts` 加 `if (upcoming === null) return false;` + 真值表补两行。**不放宽任何闸**：`reindexRequired` 是建议信号不是闸；收紧侧判定一格未放宽。
- [落 ES 部门组重塑（库级分支 + 关掉 ids 为空的 fail-open）](./issues/13-task-es-dept-reshape.md) — 新增 `ownerDeptFilterClause`：收窄生效（传 `maxVisibleLevel`）时部门组 = `bool.should[terms(ids 非空时), must_not exists ownerDeptId]` + `minimum_should_match:1`，**ids 为空只剩库级那一支**（原为 fail-open）；不生效时保持历史裸 `terms`，故「不生效 ⇒ 与旧版逐位一致」也成了可跑断言。**实跑红名单只有 1 文件 / 2 例**（`ask/es-sparse.test.ts`），与票面「既有 terms 断言都要改」的预设不同——重塑绑在收窄信号上，`es-dept-query-filter.test.ts` 的裸 terms 断言未传信号故逐位不变。反证：**F1 删库级分支 → 4 例红**；**F2 ids 空退回 fail-open → 1 例红**。门禁：api **164 文件 / 998 通过 + 3 skipped**（+3）；spec 与 `tests/index.md` 同改。**划出**：真 ES 集群的 `exists` / `minimum_should_match` / mapping 行为，只断言到请求体形状。
- [回写镜像与覆盖表](./issues/12-task-writeback.md) — 覆盖分册 `02-acl.md`：本册口径注重写（B2-1 / B2-3 转 `已测`，B2-2 保持且**纠偏两处旧叙述** —— 「无自动 reindex」已裁定为人工、不再算欠债；旧「前置：缺激活 version 表示」已消除）；**10 行 `部分测` → `已测`**（B2-1 · B2-3 · AE4 AE5 AE6 AE7 AE8 AE10 AE11 AE12），每行证据列换成**本轮实跑过**的文件、缺口列只留不可离线的部分；计数表按**脚本对「覆盖」列逐行机械重数**得 **69 / 已测 56 / 部分测 8 / 缺测 0 / 缺实现 2 / UAT 3**；`:160` 的「非本阶段」行重写为四类（须真 ES / 须真 PG / 须人签 / 明确的 ADR 债）+ 源码侧待定清单。汇总 `coverage.md`：acl 行改 **56 / 8**、合计 **156 / 65**，并修一处本表自带的错（acl 行原写 45 / 19 与分册第四轮 46 / 18 差 1，S5 改判未同步）。镜像 `api.md` / `contracts.md` 加 2026-09-21 条（可见性收敛 + 部门组重塑 + `aclTightens` 修正；含**未验证**标注）；spec `departments.md` 增「同一可见性函数」条目与测试表。**核实**：`pnpm check:module-status` **39 条 = 2 env + 13 符号 + 24 表**，`1-路径` / `6-联动` / `7-时效` **全空**；全仓 `pnpm test` **11/11**（api 165/1014+3 · worker 47/216 · contracts 27/225 · admin 38/185 · web 19/56 · admin-catalog 1/13 · db 11/31）。
- [落 B2 / AE 剧本的自动化断言](./issues/11-task-b2-ae-tests.md) — 正面补掉研究票 03 报的**整片**缺口（ask 侧部门强制从未端到端断言）：新增 `apps/api/tests/acl/dept-acl-ask-e2e.test.ts`（14 例）——`loadCorpus = loadCorpusFromDb`（**真实装载链**：`visibility.ts` + 真实 `dept-acl` 谓词）→ `runRetrieve` / `runAskGraph`，强制靠 **KB 覆盖**打开（不 stub env、不改默认开关）；逐行覆盖 B2-1（ask 硬引用被挡文档 → `abstained` 且答文/引用/evidence 都不含）、B2-3（**反向构造**：绕过闸喂全量语料则被挡文档确实被召回，证明前面缺席不是空转）、AE4/AE5/AE6/AE7（谓词串联 2 例）/AE8（单例同时断言收窄参数与语料求交）/AE10/AE11/AE12，另补「关强制回退」与「tenantId 缺失 fail-closed」。AE7 的**审计缺口**（研究票标注「删码也不红」）在 `acl/dept-grants-http.test.ts` 补 2 例：路由级 `dept_cross_grant_create/_delete` 含 `grantId`、中间件级 `/api/v1/admin/` 前缀落 `admin_write`。反证：**FA** 把 `isDocVisible` 的 `enforce` 写成 false → 本文件 **10/14 红**；**FB** 删 grant 创建日志 → dept-grants **1 例红**。门禁：api **165 文件 / 1014 通过 + 3 skipped**（+16）。**划出（必须真 ES/真 PG）**：真索引的 `terms`/`exists`/`range` 语义、B2-2 的「reindex 覆盖旧 principals」后半截、AE8 的缺字段判定、B2-3 的真 PG 单路泄漏。

## Not yet specified

- **角色 principal（`user:` / `dept:{id}:lv:{n}`）是否属 P3b 必达**：ADR-057 `:1861-1864` 要求该主体形态，而 `aclPrincipals` 今天是不带前缀的裸 uuid 数组（`packages/db/src/schema/kb/documents.ts:60`），要落它需迁移 + 放宽契约校验（现测已锁"非 uuid → 400"）+ 新增身份展开器 + 改 PG 谓词 + 改 ES 入参与查询。**已知后果**：B2-2 的「移出 role」在落地前无法真绿，只能等价替换。
- **grant 写审计是否落表**：现在只有 Pino（`apps/api/src/routes/dept-grants.ts:110-115`、`:141-144`），AE7 的 Then 写「审计有记录」，ADR-057 `:1832` 也写「审计」。落表要先裁口径（是否要求表级证据）。
- **请求级缓存**：`loadVisibilityContext` 是否挂请求级缓存（key = `tenantId|userId|enforce|inheritDown|bypass`）以省掉"详情 + ACL 名单"同请求内的重复加载。本图不落（避免请求内失效语义），待有性能证据再议。
- **`DEPT_INHERIT_DOWN` 关继承时"库级文档"的语义**：`collectVisibleOwnerDeptIds` 在关继承时只精确匹配；PG 对无 `ownerDeptId` 的文档独立给了级别规则（`dept-acl.ts:50-51`：任一处负责人 30，否则 20），但"关继承"是否影响库级文档未在 PRD 明说。本图按"不影响"实现（PG 源码如此），口径待 PRD 补行。
- **pin 住 `CorpusLoader` 的 tenantId 接口缺口**：`RetrieveInput.tenantId` 已有（`retrieve/types.ts:40`）但 `CorpusLoader` 签名未传（`:76-82`、`retrieve.ts:126-130`），④⑤只能从文档行反推 tenantId（fail-closed 方向）。修它是纯工程，但会让 `loadCorpus` 的所有夹具改签名，属回归面较大的独立小图。

## Out of scope

- **P2.5 二元出口**（准出 / 永久关）：准出需真模型 live 跑数 + 人签（`packages/contracts/src/eval/l2-matrix.ts:38-48` 第一句就要求 `retrieveMode==='live'`），永久关需产品书面签字；两者都不在本图。**连带发现另图处理**：PRD 阈值「近指代主题正确且合法作答 ≥ 80%」（`prds/08-quality/02-evaluation-and-gates.md:188`）在判定公式里**没有实现**（公式只看零容忍命中与九类覆盖，不看 pass/fail 比）—— 这是「门禁比 PRD 松」的疑点，须另图裁定（本图不动 `prds/00–11`）。
- **真 ES 集群 / IK 插件 / 多租户独立索引布局**（B8）：本图只做到「builder 级可断言」的切片（fetch stub / 纯函数）。
- **敏感语料入池**：路线图 `:209` 明写「**此后**方可讨论」，属安全另签。
- **业务人签 / 签字页勾选**：人不在环内，不代签。
- **改仓库默认开关**（如 `DEPT_ACL_ENFORCE=true`）：须 ADR → 改 PRD → 升版。
- **admin 站规余量**（20 处原生 `<select>` + 4 处旧 `Select`）：属站规清扫，非本图缺口；本机无浏览器验证手段。
