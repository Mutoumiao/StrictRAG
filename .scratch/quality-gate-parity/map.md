# PRD 硬门与代码判定的对齐（只加严）

Label: wayfinder:map
Status: open（前沿：工单 03 · 04 已认领；05 待 03 ∧ 04 收口。工单 01 已研究、02 已裁定）

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

### 开工基线（2026-09-22）

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

## Not yet specified

- **人工抽检 ≥20 且错 ≤1 有没有入口**：`humanSpotMin` / `humanSpotErrorMax` 是七个门限里唯一看起来「无数据源」的两个。今天有没有人工抽检的登记表 / 命令？没有的话，本图只能把它记成**须人做的债**，并写清「谁、在哪登记」。工单 01 核实。
- **报告里的 `citationComplete` 是不是按 PRD「引用完整率（knowledge）≥ 99%」算的**：PRD 括号里限定了 knowledge 口径（未作答的题是否进分母？非 knowledge 域是否排除？），代码里同一名字可能口径不同。工单 01 逐行核。
- **`hitAt20Min` 的 k 是否真的是 20**：`l1-matrix.ts:110` 的 `hitAtKCase` 注释写「k = 该列表长度」，即命中率按进 verify 的集合算，而不是硬 k=20。这与 PRD `:89`「试点默认 k=20」是否等价，须裁定。
- **L2 「主题正确且合法作答」的判定面**：报告只有 `verdict`（pass/fail）与 `lastStatus`；「主题正确」这一层是**题面 rubric + 人读**还是**已有机械判据**？若只有 `verdict`，则 80% 只能按「近指代题的 pass 率」落地（属**近似**，须在落地处写明近似关系）。工单 01 核实。
- **零容忍四项是否都进 `zeroToleranceHits`**：PRD `:186` 列四项（主题粘连胡答 · 历史文本进 evidence/min_support · 冲突场景跟错数字 · 合法路径跳过 verify），而 `run-l2-batch.ts:116` 只把 `history_in_evidence` 计入 `zeroToleranceHits`；其余三项今天靠题面 `expected.accept` / `rewriteUsed` 间接表达。若间接，须裁清「算不算达标」。工单 01 核实。
- **ADR-046 的四要素里 `l1RerunBound` 是否足够**：PRD `:150` 要求「① 业务书面提案 ② **重跑 L1 适用**（≥2×2/相关硬门；τ 变含工作点说明）③ 业务 R + 产品 A + `stricter_than_pilot` + diff ④ KB 配置快照绑定 `eval_runs`」，而 `fourElementsOf` 的 `l1RerunBound` 只查「有 evalRunId 或有 kbId+ranAt」（`adr046-snapshot.ts:129`）——「重跑是否**适用**」没有机械判据。工单 01 核实后可在本图收口或记债。
- **`TAU_STAR_COVERAGE_MIN` / `TAU_STAR_C_RATE_MAX` 与 `PILOT_HARD_GATES` 的双写**：`l1-matrix.ts:179-180` 与 `adr046-snapshot.ts:9-17` 各写一份 0.4 / 0.05。属**重复常量**，本图顺手合一还是留两份（跨包依赖方向）须裁。
- **`CorpusLoader` 的 tenantId 接口缺口**（前图雾中项原样转来，与本图无关）：`RetrieveInput.tenantId` 已有但 `CorpusLoader` 签名未传。纯工程，另图。
- **`DEPT_INHERIT_DOWN` 关继承时「库级文档」的语义**（前图雾中项）：须 PRD 补行才能销账，可能属改冻结语义。另图。
- **grant 写审计是否落表**（前图雾中项）：AE7 的 Then 写「审计有记录」，今天只有 Pino。须先裁「Then 是否要求表级证据」。另图。
- **`loadVisibilityContext` 要不要挂请求级缓存**（前图雾中项）：待性能证据。另图。

## Out of scope

- **真 ES 集群 / 真 PG 迁移 / 真模型 live 跑数 / 人签 / 业务 PASS**：不可离线核对，一律只做到「纯函数级可断言」。
- **改 `prds/00–11` 已冻语义**（含改任何门限**数字**）：须 ADR → 改 PRD → 升版。
- **改仓库默认开关**。
- **admin / web 的视觉与交互改动**：本机无浏览器验证手段。
- **把代码加严的结果回写成 PRD 加严**：那是「改冻结语义」的另一条路径，须 ADR。
- **P2.5 准出 / 永久关二元出口**：须 L2 报告归档 + 人签，本图不做。
- **P3a（CRAG + multi_hop）**：路线图明写 P2.5 是 P3a 的硬前置门，未落准出/永久关前不进入。
