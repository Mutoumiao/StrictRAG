# PRD 硬门与代码判定的对齐（只加严）

Label: wayfinder:map
Status: resolved（前沿：空；工单 01 · 02 · 03 · 04 · 05 全收口）

## Destination

把「`prds/08-quality` 写死的质量硬门」与「代码里真正参与 PASS 判定的条件」逐条对齐到**可核对**，且所有改动**只许加严**：

1. **差额清单化**：PRD §5 的 L1 硬门（覆盖率 ≥40% · 引用完整率 ≥99% · Judge AUROC ≥0.65 · Hit@20 ≥70% · 人工抽检 ≥20 且错 ≤1 · 零容忍 =0，`prds/08-quality/02-evaluation-and-gates.md:133-137`，另 `:89` · `:99`）与 §6.2 的 L2 阈值（近指代主题正确且合法作答 ≥80% · 零容忍 =0，`:188`）中，每一条今天在代码里属于「有数据源且参与判定 / 有数据源但不参与判定 / 无数据源」三者中的哪一种，全部指到源码行。
2. **离线可判定者落地**：把「有数据源却不参与判定」的差额落成判定条件 + 测例；每处配一条**反证**（改回旧口径 → 测例红）；**不得**放宽任何已有条件。
3. **无数据源者据实记账**：如人工抽检这类「须人做」的项，写明今天是否有入口、缺的是什么，按「带销账路径的债」处理，**不许**写成「已具备」。
4. **收口**：镜像（`docs/module-status/api.md` · `contracts.md` · `worker.md`）· 覆盖表（`docs/testing/coverage/` 对应分册）· `.trellis/spec/` 按源码回写；`pnpm check-types` / `pnpm lint` / `pnpm test` 全绿；`pnpm check:module-status` 的 1-路径 / 6-联动 / 7-时效 三类为空。

**本图的判据线（区别于「改冻结语义」）**：PRD **已经写死**的数字、代码比它松 = 实现缺口，落地属「实现 PRD」；PRD **没写**的数字、代码自己加 = 改冻结语义，须 ADR。**本图只做前者。**

## Notes

- 域：StrictRAG。**WHAT** 冲突以 `prds/00–11`（当前 0.4.32）为准；**IS 以源码为准**，`docs/module-status/` 是镜像，`docs/testing/coverage/` 是派生对照。
- **前图**：`p3b-doc-acl`（已收口）与 `p3b-principal-forms`（已收口）把 Phase 3b 的工程侧争议全部落地；两张图都把这个「**门禁比 PRD 松**」的疑点显式划给**另图**，本图即那张图。原文：`p3b-doc-acl/map.md` 的 Out of scope 首段（点名 `prds/08-quality/02-evaluation-and-gates.md:188`）与 `p3b-principal-forms/map.md` 的 Not yet specified 第五节。
- **每轮先读**：本图 · `docs/agents/issue-tracker.md` · `docs/agents/domain.md` · `prds/08-quality/02-evaluation-and-gates.md` 全文 · `docs/testing/coverage/01-eval.md`（若存在，否则按 `docs/testing/coverage.md` 索引找对应分册）· 相关包 `docs/module-status/<包>.md`。写代码前读 `.trellis/spec/` 对应包。
- **本图携带执行**：工单可以直接改代码、补测例、回写镜像，不只锁决策。同一缺口**禁止**再 `task.py create` 平行实现任务。
- **门禁**：每收一张工单跑 `pnpm check-types` + `pnpm lint`（零 warning）+ 相关包测试；收口跑全仓 `pnpm test`。测例只进 `<包>/tests/<能力>/<意图>.test.ts(x)`，文件头「目标 / 需求 / 被测 / 简介」必须简体中文，并登记该包 `tests/index.md`。
- **不改仓库默认开关**：`AUTH_ENFORCE` / `DEPT_ACL_ENFORCE` / `DEPT_INHERIT_DOWN` / `RETRIEVE_ES_MODE` / `INGEST_ES_MODE` / `SESSION_REWRITE_ENABLED` / OCR 的默认值一律不动。
- **不改 `prds/00–11`**：任何「与 PRD 字面不一致且方向是加严」只能以「源码收紧 + 记 ADR 债」收口；销账须 ADR → 改 PRD → 升版本。**若发现代码比 PRD 严**（即代码已超出 PRD），本图**不动**——那属另一类议题（要么回写 PRD，要么登记为「仓内自加严」，须 ADR）。
- **质量红线不放宽**：检索→约束生成→验证→拒答；min 否决；合法 draft 必 verify；历史≠evidence；**门禁只加严不放宽**（ADR-046）；双就绪∧active 检索闸。本图所有改动必须是**收紧或逐位等价**。
- **写回纪律（前图教训）**：`docs/module-status/*.md` 正文**不写 `路径:行号`**（会触发 `pnpm check:module-status` 的 `1-路径` 误报），也不给裸枚举字面量加反引号。行号只写在 `.scratch/` 工单与 `.trellis/spec/` 里。
- **前图教训（两条，本图必守）**：① 收口声明必须在**最后一次提交之后**复跑 `pnpm check:module-status`；② 回写要带**对抗性反向复核**（逐条核「这话在源码里真能指到吗」）。
- **本机限制**：无浏览器验证手段 → admin / web 视觉改动不在本图；真 ES 集群 / 真 PG 迁移 / 真模型 live 跑数 / 人签也不在。
- **成果预期**：本图的「加严」会**改写已有测例的期望值**（今天有测例钉住 `coverage=0.001 → businessPass=true` 这类宽松口径）。这类改写是**本图的目的**，不是回归；每处改写必须在工单 Answer 里写明「旧断言钉的是哪条宽松口径、为什么它与 PRD 冲突」。

### 开工基线（2026-09-23）

| 处 | 今天的样子 |
|---|---|
| PRD §5 L1 硬门 | 七项数字：`cRateMax .05` · `coverageMin .40` · `citationCompleteMin .99` · `judgeAurocMin .65` · `hitAt20Min .70` · `humanSpotMin 20` · `humanSpotErrorMax 1`（`prds/08-quality/02-evaluation-and-gates.md:133-137`；Hit@k 单列 `:89`，AUROC 单列 `:99`） |
| PRD §6.2 L2 阈值 | 近指代主题正确且合法作答 ≥ **80%**；零容忍项 = **0**（`:188`，其上一行 `:186` 列四项零容忍） |
| 门限常量 | `PILOT_HARD_GATES` 七键（`apps/api/src/eval/adr046-snapshot.ts:9-17`），只被 `compareHardGates`（候选 vs 试点）与 `gatesComplete` 使用 |
| L1 工程门 | `computeSignoffEligible` 只查 live ∧ 可答 ≥30 ∧ 不可答 ≥30（`packages/contracts/src/eval/l1-matrix.ts:69-76`） |
| ADR-046 PASS 闸 | `evaluateAdr046Bind` = 四要素 + `diff.direction !== 'looser'` + `signoffEligible` + `coverage != null && coverage > 0`（`adr046-snapshot.ts:160-171`）—— **从不与被测值比较七个门限** |
| 已算但未进闸的量 | `coverage` · `cRate` · `hitAtKRate` · `judgeAuroc` 都在报告里被算出来（`apps/api/src/scripts/run-l1-golden.ts`、`apps/worker/src/eval/run-l1-batch.ts`） |
| L2 工程门 | `computeL2SignoffEligible` = live ∧ caseCount ≥15 ∧ 零容忍 =0 ∧ 九类齐（`packages/contracts/src/eval/l2-matrix.ts:37-45`）—— **不含**近指代 ≥80% |
| L2 报告形态 | 已有 `caseCount` / `passCount` / `failCount` / `errorCount` / `zeroToleranceHits` / `cases[].verdict` / `cases[].type`（`apps/worker/src/eval/run-l2-batch.ts:46-54`、`:122-131`）→ 近指代通过率**可算** |
| 冻结文本边界 | PRD 05 §2.4 与 §5 表均**未**规定「测得值如何与门限比较」的算法，只写门限数字 → 把比较落地属**实现 PRD** |

## Decisions so far

- [硬门差额清单：PRD 写死的门 vs 代码里真正参与判定的条件](./issues/01-research-gate-diff.md) — 研究子代理产出（约 119 行，逐条指到源码行）。要点：① **行号基线纠偏**——硬门表在 **§6 `130-138`**（数据行 `132-138`，7 行），不是 §5；§7 触发表 `197-217`；该表**没有**零容忍行。② 分类 A 13 · B 8 · C 7 · 部分 3；**放行级真判据只有一条**：`evaluateAdr046Bind` 的 `coverage != null && > 0`，其余六项门限只被 `compareHardGates` 拿来做**门对门**比较，从不与被测值比。③ 人工抽检全仓 **0 命中**（只有常量）；**`citationComplete` 字段不存在**，且 L1 报告不留 `answerKind` / `citations`；`hitAtKCase` 的 k = rerank 后进 verify 的集合长度（balanced 恰为 20，fast 为 10 → 更严）；L2「主题正确」**零机械判据**，夹具仅 3 条 `near_coref`；L2 四项零容忍只有 `history_in_evidence` 进判定，且 `historyLeaked` 只比对先前**用户**轮（比 PRD 窄）。④ 列出 **9 处代码比 PRD 更严**（规模门 ≥30 · L2 九类齐 · tau\* 无分数不外推 · AUROC 单类禁写 1 ……），供本图避免误改。⑤ 落地会翻的断言逐条点名；**`coverage > 0` → `>= 0.4` 不翻任何断言**。⑥ 另发现两条入口的批跑循环是**两份同义实现**（api CLI 与 worker batch）→ 门禁只落一侧会让口径分叉。
- [裁定：差额怎么落](./issues/02-dec-gate-ruling.md) — 四档处理（**落** / **补源后落** / **记债不成闸** / **不动**），判据 = 「PRD 是不是写死」+「今天有没有数据源」；**缺测语义 = fail-closed**，唯一例外是 PRD 自带条件语的门（`hitAt20`「有标注时」）。**落**：`coverage >= 0.40`（原为 `> 0`）· `cRate <= 0.05` · `hitAtK >= 0.70`（null 不适用）· `judgeAuroc >= 0.65`（null 不放行）· L2 `near_coref` pass 率 `>= 0.80`（error 进分母）；**补源后落**：引用完整率（`answerKind` / `citations` 已在图上，两 runner 可采）；**记债**：人工抽检（全仓 0 命中，禁止做成恒 false 空转闸）· L2 其余三项零容忍 · `historyLeaked` 的比对宽度；**不动**：L2 规模 15（PRD 是「建议 30～50」）· `l1RerunBound` 回退 · 双写常量不合一只加一致性断言。两条必须写进回写的硬事实：`judgeAuroc` 生产入口今天恒 `null` → **落地后 `businessPass` 在生产路径上不可达，这是有意的**；引用完整率结构上只能是 1 或 null，门的真实作用是钉住不变式。**不触碰 `prds/00–11`**。

- [落 L1 侧硬门进闸](./issues/03-task-l1-hard-gate.md) — 把 PRD §6 的五项实测值真接进 `evaluateAdr046Bind` 的 `&&`：覆盖率判据由 `> 0` 改为 `>= 0.40`，新增 C 率 `<= 0.05`、Hit@k `>= 0.70`（无标注 → 该门不适用）、Judge AUROC `>= 0.65`、引用完整率 `>= 0.99`（分母 0 → 不适用）；**缺测 null 一律不放行**（唯二例外是 PRD 自带条件语的两门）。引用完整率从「无字段」补成「可算」：两个 L1 runner 逐题采集 `answerKind` 与引用数，率由 contracts 新增的同一纯函数算，并接通 worker→api 内口的下发面（不接则 worker 侧该门空转、两入口分叉）。新增 `tests/eval/adr046-hard-gates.test.ts`（7 例，含「覆盖率 0.001 也能变真」的回归钉）· `pilot-gates-parity.test.ts`（2 例，双写常量一致性）· api/worker 各一例引用完整率测例。**反证 7 轮共红 11 条**；改写既有断言 **1 条**（`adr046-snapshot.test.ts` 那条把「未测」当合格的 PASS 用例）。**两条必须记住的诚实面**：① 生产入口不接校准打分器 → `judgeAuroc` 恒 null → **`businessPass` 在生产路径上不可达**（有意，把「未测」显形为红）；② 引用完整率受图的不变式约束，结构上只能是 1 或 null，门的真实作用是钉住不变式。**未做**：人工抽检（无数据源）· 校准规模 ≥100 · `l1RerunBound` 回退 · 双写常量合一（只加断言）。门禁：api **168 文件 / 1025 通过 + 3 skipped** · worker **48 / 218** · contracts **27 / 225** · type 0 · lint 0。
- [落 L2 侧近指代阈值](./issues/04-task-l2-threshold.md) — PRD §6.2「近指代 ≥80%」进 `computeL2SignoffEligible`：新增纯函数 `l2NearCorefPassRate`（分母只取 `near_coref`，**含 `error`**，error 不算 pass；分母 0 → null）与下限常量，入参**必填**（不允许用可选默认值绕过）。**error 进分母**是为堵 fail-open：排除它会让「全批 error」退化成缺测 → 该门不适用 → 放行。新增 `packages/contracts/tests/eval/l2-near-coref-rate.test.ts`（7 例）+ worker / api 各一组 runner 测例。**残余如实写明**：不含「主题是否正确」（无 judge、未采集 `expectedDocIds` 命中）与「合法 citation」，且夹具只有 3 条 `near_coref` → 该门今天约等于「3/3 全过」。**未动**：`L2_SIGNOFF_MIN_CASES` 仍 15（PRD 的 30～50 是**建议**）· 其余三项零容忍 · `historyLeaked` 的比对宽度。反证 4 条红；既有 runner 测例**一条未翻**（实测印证「今天该门 ≈ 3/3 全过」）。门禁：contracts **28 / 232** · worker **49 / 221** · api **169 / 1029 + 3 skipped**。
- [回写镜像 / 覆盖表 / spec + 收口门禁](./issues/05-task-writeback.md) — 见下方「目的地达成」。

### 目的地达成（2026-09-23）

「PRD 写死的质量硬门」与「代码里真正参与 PASS 判定的条件」之间那条**长期存在的差额**已闭合到可核对：

1. **差额清单化**：研究票把 PRD `prds/08-quality/02-evaluation-and-gates.md` 的 §2 / §3 / §4 / §6 / §6.2 / §7 逐条对照源码，分成 A（有数据源且参与判定）13 · B（有数据源不参与判定）8 · C（无数据源）7 · 部分 3，并**纠偏了行号基线**（硬门表在 §6 `130-138`，不是 §5）与两条前提（该表没有零容忍行；`citationComplete` 字段根本不存在）。核心事实：**放行级真判据原先只有一条** —— `evaluateAdr046Bind` 的 `coverage > 0`。
2. **离线可判定者全部落地**：L1 五门进闸（覆盖率下限、C 率上限、Hit@k、Judge AUROC、引用完整率），L2 近指代 ≥80% 进工程公式；**缺测一律不放行**，唯二例外是 PRD 自带条件语的两门。**只加严**逐项自证（旧口径为真的情形集合严格包含新口径为真的情形集合）。
3. **无数据源者据实记账**：人工抽检 ≥20 条 / 错 ≤1（全仓无入口无登记面）、校准规模 ≥100（实际 8 题）、L2 其余三项零容忍、L2 泄漏检查偏窄 —— 全部写进镜像的**数据源债**行，**不**做成恒 `false` 的空转闸。
4. **本条最该被记住的两句话**：① 生产入口不接校准打分器 → `judgeAuroc` 恒 null → **`businessPass` 在生产路径上不可达**，这是**有意**的（把「未测」显形为红，而不是留一条覆盖率 0.001 也能变真的假绿）；② **PRD 的门限数字一个字未改**，改的是「代码有没有真按它判」——「门禁比 PRD 松」是**实现缺口**，不是语义争议，故本图**未触碰 `prds/00–11`**。

**证据**：`apps/api/tests/eval/adr046-hard-gates.test.ts`（7 例）· `pilot-gates-parity.test.ts`（2 例）· `l1-citation-complete.test.ts`（2 例）· `l2-near-coref-rate.test.ts`（4 例）· `apps/worker/tests/eval/run-l1-batch-citation-complete.test.ts`（2 例）· `run-l2-batch-near-coref-rate.test.ts`（3 例）· `packages/contracts/tests/eval/l2-near-coref-rate.test.ts`（7 例）。反证共 **15 条红**（L1 侧 7 轮 11 条 · L2 侧 4 条），还原后全绿。改写既有断言 **1 条**（把「未测 = 合格」的 PASS 用例改成 fail-closed 语义，另一条既有断言只做编译期补参）。

**收口门禁（在最后一次提交之后复跑）**：`pnpm check-types` 8/8 · `pnpm lint` 8/8 零 warning · `pnpm test` **11/11**（api **169 文件 / 1029 通过 + 3 skipped** · worker **49 / 221** · contracts **28 / 232** · admin 38 / 185 · web 19 / 56 · db 11 / 31 · admin-catalog 1 / 13）· `pnpm check:module-status` **39 条 = 2 env + 13 符号 + 24 表**，`1-路径` / `6-联动` / `7-时效` **全空**。

**一条过程事实（供下次参考）**：全仓 `pnpm test` 第一次跑时 `@strict-rag/web` 超时失败，而**单独跑 web 包 19 文件 / 56 例全绿**；原因是与另一条并发测试命令抢 CPU（前一轮「脆弱测例超时热修」已把 api / admin 的 `testTimeout` 提到 20s，web 未提）。复跑（无并发）11/11 绿。**结论**：本图的门禁数字只能在**无并发测试**下取。

## Not yet specified

> 本图已收口。下列是**收口后剩下的雾**，按「谁挡谁」分组，供下一张图挑一个当目的地。带（另图）的原样转给后续图，不是本图的欠账。

### A · 已裁定但未落地的（须先补数据源或先改口径，落地属「实现 PRD」）

- **人工抽检（≥20 条 / 错 ≤1）的登记面**：全仓 0 命中，无入口、无表、无报告字段。落闸前须先定「谁、在哪、以什么形状登记」（表？报告字段？命令？）。**这是一个完整的小图**：先裁登记面，再补字段，再进闸。
- **校准规模 ≥100 与打分器接线**：PRD §4 要求 ≥100 条且 supported/unsupported 尽量均衡，实际夹具 8 题；解析器只要求非空 + 双标签。**且生产入口不接校准打分器**，所以 `judgeAuroc` 恒 null、`businessPass` 不可达。销账 = 扩校准集 + 接线 + （可能）把「打分器可配」写成 env/配置口径。须真模型才能产真值。
- **L2 其余三项零容忍的机械判据**：主题粘连胡答 / 冲突场景跟错数字 / 合法路径跳过 verify 今天无判据。落地须两步：先补**采集**（L2 runner 今天丢掉 `evidence_snapshot.docId`，连按 `expectedDocIds` 判主题命中都做不到），再定判据。
- **L2 泄漏检查的宽度**：`historyLeaked` 只比对先前**用户**轮原文，上轮 **assistant** 文本进 evidence 不被抓，而 PRD 写的是「历史文本进 evidence」。收紧会翻既有泄漏用例组，须单独一轮带反证。

### B · 口径差（PRD 与代码各自有理由，要动须先裁）

- **L2 规模 15 vs PRD 建议 30～50**：PRD 措辞是「建议」，代码 15 不构成「比 PRD 松的硬门」；改它反而**严于** PRD 建议 → 属「代码自加严」，须 ADR。
- **`hitAtKCase` 的 k 语义**：k = rerank 后进 verify 的集合长度（balanced 恰 20，fast 为 10 → 更严；语料不足时 <20 → 更严）。与 PRD「检索 Top-k」不是同一集合，属**口径漂移风险**（若将来 verify 前再裁 evidence，Hit@k 会跟着漂）。
- **§1「不可答 ≥ 可答 50%」下限**：无机械判据（`goldTypeCounts` 只服务 ≥30 规模门）。要落须先裁「分母口径与 release 面」。
- **`l1RerunBound` 的 `|| kbId && ranAt` 回退**：使「无 evalRunId 即不得 bindable」不成立；已被覆盖表记为「部分测」。要动须先裁「绑定身份」与「重跑**适用**」是不是一回事（PRD §6.0 的 ② 只有文本、无机械判据）。
- **`sessionEnabledDefault` 字段名与出口未冻结**：`PATCH` 恒 400，`stays locked` 分支**无任何测例覆盖**。

### C · 本图未做的相邻项

- **§8 可复现字段**（seed / models / fallbackChains / promptVersions / 题面哈希 / 校准集哈希）在 L1 报告里基本不存在 —— 再认证触发（§7）的 18 行里 12 行因此只是文档纪律。
- **§6.0「运行时质量参数仅来自已签字包，不一致拒绝加载」**：今天只有写侧 + CLI，全仓无运行时读取 / 加载入口；运行时 `tauClaim` 仍取 env。

### D · 前图原样转来的（与本图无关，不要在本图顺手做）

- **`CorpusLoader` 的 tenantId 接口缺口**：`RetrieveInput.tenantId` 已有但 `CorpusLoader` 签名未传，检索侧只能从文档行反推（fail-closed 方向）。纯工程，回归面较大。
- **`DEPT_INHERIT_DOWN` 关继承时「库级文档」的语义**：须 PRD 补行才能销账，可能属改冻结语义。
- **grant 写审计是否落表**：AE7 的 Then 写「审计有记录」，今天只有 Pino。须先裁「Then 是否要求表级证据」。
- **`loadVisibilityContext` 要不要挂请求级缓存**：待性能证据。
- **ES PRD 字段表的 `role:…` 主体**：已裁定非必达、且属放宽方向（见 `p3b-principal-forms` 图裁定 3）。

## Out of scope

- **真 ES 集群 / 真 PG 迁移 / 真模型 live 跑数 / 人签 / 业务 PASS**：不可离线核对，一律只做到「纯函数级可断言」。
- **改 `prds/00–11` 已冻语义**（含改任何门限**数字**）：须 ADR → 改 PRD → 升版。
- **改仓库默认开关**。
- **admin / web 的视觉与交互改动**：本机无浏览器验证手段。
- **把代码加严的结果回写成 PRD 加严**：那是「改冻结语义」的另一条路径，须 ADR。
- **P2.5 准出 / 永久关二元出口**：须 L2 报告归档 + 人签，本图不做。
- **P3a（CRAG + multi_hop）**：路线图明写 P2.5 是 P3a 的硬前置门，未落准出/永久关前不进入。
