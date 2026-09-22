# 研究：PRD 硬门与代码判定的逐条差额清单

Type: research
Status: claimed

## 问题

把 `prds/08-quality/02-evaluation-and-gates.md` 里**写死的每一条质量门**，与**代码里真正参与判定的每一条条件**，做成一张逐条对应的表，并回答：每一条 PRD 门今天属于下列哪一种，以及证据在哪一行。

三种分类：

- **A · 有数据源且参与判定**：报告的某个字段被算出来后真的进了某处的 `&&` 判定。
- **B · 有数据源但不参与判定**：报告里算出来了（或可算），但没有任何判定读它。
- **C · 无数据源**：报告里根本没有这个量（例如须人做的抽检）。

## 必须覆盖的 PRD 条款（逐条，不许漏）

1. §5 硬门表 `:133-137` 七行：覆盖率 ≥40% · 引用完整率（knowledge）≥99% · Judge AUROC ≥0.65 · Hit@20 ≥70%（有标注时） · 人工抽检 ≥20 且错 ≤1，以及该表引用的零容忍口径。
2. §4 Hit@k 行 `:89`（试点默认 k=20，≥70%）与 Judge 校准 `:97-99`（规模 ≥100 · AUROC ≥0.65 · 负样本不设专用门槛）。
3. §5 `:146-150` ADR-046 四要素与 `stricter_than_pilot` diff。
4. §6.2 L2 `:186` 四项零容忍与 `:188` 「近指代主题正确且合法作答 ≥80% · 零容忍 =0」。
5. §6.1 L2 冻结结构里与门禁相邻的规模/账本要求（`:167-171`）。
6. §7 再认证触发表 `:195-217`：哪些行今天有机械判据、哪些只是文档纪律。（只需分类，不必落地。）

## 必须核到的源码面

- `packages/contracts/src/eval/l1-matrix.ts`（`computeSignoffEligible` · `coverage` · `cRate` · `hitAtKCase` · `hitAtKRate` · `sweepTau` 与 `TAU_STAR_*` · `auroc`）
- `packages/contracts/src/eval/l2-matrix.ts`（`computeL2SignoffEligible`）
- `packages/contracts/src/eval/l2-gold.ts`（`L2_TYPES` · `l2TypeCoverage` · `L2_SIGNOFF_MIN_CASES`）
- `apps/api/src/eval/adr046-snapshot.ts`（`PILOT_HARD_GATES` · `compareHardGates` · `evaluateAdr046Bind` · `fourElementsOf`）
- `apps/api/src/eval/l1-matrix.ts`（是否存在与包内重复的实现）
- `apps/api/src/scripts/run-l1-golden.ts` 与 `apps/worker/src/eval/run-l1-batch.ts`（报告算了什么、写了什么、判了什么）
- `apps/worker/src/eval/run-l2-batch.ts` 与 `apps/api/src/scripts/run-l2-golden.ts`（L2 报告形态与判定）
- `packages/contracts/src/eval/*` 里报告 schema 的字段清单（`citationComplete` 是否存在、叫什么）

## 必须回答的疑点（来自本图 Not yet specified）

1. 人工抽检（`humanSpotMin` / `humanSpotErrorMax`）有没有任何入口 / 登记表 / 命令？没有的话，「谁在哪登记」写清楚。
2. 报告里的 `citationComplete`（或同义字段）是否按 PRD 的 **knowledge** 口径算？分母包不包含未作答的题、非 knowledge 域？
3. `hitAtKCase` 的 k 语义（注释写「k = 该列表长度」）与 PRD「k=20」是否等价？不等价时差在哪。
4. L2 的「主题正确」是否有机械判据，还是只有 `verdict` + rubric 人读？80% 若只能按「近指代题的 pass 率」落地，把**近似关系与残余**写清。
5. L2 四项零容忍里，只有 `history_in_evidence` 直接进 `zeroToleranceHits`；其余三项今天落在哪里（题面 `expected.accept`？`rewriteUsed`？还是根本没有判据）？
6. `fourElementsOf` 的 `l1RerunBound` 与 PRD「重跑 L1 适用」之间的差（「适用」没有机械判据这件事是否属实）。
7. `TAU_STAR_COVERAGE_MIN` / `TAU_STAR_C_RATE_MAX` 与 `PILOT_HARD_GATES` 的双写是否真的是两份独立常量、有无反向依赖（api → contracts 还是 contracts → api）。

## 完成判据

- 一张逐条表：**PRD 条款（行号）→ 分类（A/B/C）→ 源码证据（文件 + 行号 + 一句话）→ 若落地，最小改法**。
- 每条 A 类要写清「哪一行 `&&` 读了这个量」；每条 B 类要写清「谁算了它、有没有任何消费者」；每条 C 类要写清「缺的是什么、谁能补」。
- 疑点 1–7 逐条给出结论。
- 明确指出：**有没有哪一处代码比 PRD 更严**（本图不动那类，但要列出来避免误改）。
- 明确指出：**落地任何一条会不会把已有测例的期望值翻掉**，列出文件与用例名。
- 不许写「大概 / 可能 / 应该是」——无法核实的一律显式写「未能核实，因为…」。

## Answer

**行号基线（以我实读为准，与工单给的数字有出入）**：`prds/08-quality/02-evaluation-and-gates.md` 里硬门表在 **§6「试点默认门禁包」`130-138`**（表头 `130`、分隔 `131`、7 行数据 `132-138`），**不是 §5**；§5 是「风险-覆盖扫描」`116-123`。§3 Hit@k 行确在 `:89`；§4 校准 `规模 :97` / `指标 :98` / `试点默认 AUROC :99` 与工单一致。§7 触发表实为 **`197-217`（数据行 `199-216`，共 18 行）**。ADR-046 四要素行 `:150`。§6.2 规模 `:169`、账本 `:170`、`sessionEnabledDefault` `:171`、题型 `:177-184`、零容忍 `:186`、阈值 `:188`。**硬门表里没有「零容忍」行**（只有硬/软列），零容忍只出现在 §6.2 `:186`。

两条贯穿全表的实现事实：① `apps/api/src/eval/l1-matrix.ts` 是 `@strict-rag/contracts` 的**纯再导出**（`:1-42`），`apps/api/src/eval/l2-gold.ts` 同样是再导出 + fs（`:9-27`、`:37-50`）——**不存在与包内重复的矩阵 / τ / AUROC 实现**。② 但**批跑循环有两份同义实现**：`apps/api/src/scripts/run-l1-golden.ts:393-518` 与 `apps/worker/src/eval/run-l1-batch.ts:77-166`，以及 `apps/api/src/scripts/run-l2-golden.ts:216-370` 与 `apps/worker/src/eval/run-l2-batch.ts:58-162`（连 `failReasons` 的三项与顺序都一样）。任何门禁只落一侧都会造成两条入口口径分叉。

### 一、逐条表

| # | PRD 条款（实读行号） | 类 | 源码证据（文件:行 + 一句话） | 若落地的最小改法 |
|---|---|---|---|---|
| 1 | §2 `C` = 幻觉操作定义 `:79` | A | `contracts/src/eval/l1-matrix.ts:21-27` `cellFor` 把不可答类 answered 记 C；`cRate` `:141-145` 算 C/(C+D)；唯一读者 `l1-matrix.ts:235-236` `cov >= coverageMin && cr <= cRateMax`（只选 τ*） | 把 `cRate(matrix)` 传进 `evaluateAdr046Bind` 并加一条 `&&` |
| 2 | §2 覆盖率 = A/(A+B) `:80` | A（阈值不符） | `coverage()` `l1-matrix.ts:40-44`；`apps/api/src/eval/adr046-snapshot.ts:163` `coverage != null && coverage > 0` 进 `:169` `businessPass` 的 `&&`；另一读者 `l1-matrix.ts:235` `cov >= coverageMin` | 把 `:163` 的 `> 0` 换成 `>= PILOT_HARD_GATES.coverageMin` |
| 3 | §2 引用完整率：仅 `answerKind=knowledge` ∧ `status=answered` `:81` | C | 全仓无字段：`L1CaseRow` `run-l1-golden.ts:63-72` 与 `L1Report` `:74-106` 都没有 citations / answerKind；唯一字面量是常量 `adr046-snapshot.ts:12` `citationCompleteMin` | 先在两个 runner 采 `graph.answerKind` + `graph.citations`（运行时有：`graph/run.ts:119`、`services/ask/execute.ts:80`），再算 knowledge∧answered 分母 |
| 4 | §3 Hit@k 行（试点 k=20，≥70%，有标注硬门）`:89` | B | 算：`hitAtKCase` `l1-matrix.ts:110-126`、`hitAtKRate` `:135-138`，写 `L1Report.hitAtK`（`run-l1-golden.ts` 报告构造里的 `hitAtK: hitAtKRate(hitAcc)`）；展示：`services/dashboard.ts:221`、admin `eval-workspace.tsx:299`；**判定 0 处** | `evaluateAdr046Bind` 加 `hitAtK` 入参 + `hitAtK >= hitAt20Min` |
| 5 | §4 校准规模 ≥100 `:97` | C | 夹具实际 8 题（`fixtures/l1/judge-calibration.json`）；`parseJudgeCalibration` `l1-matrix.ts:265-292` 只要求非空 + 双标签；报告无「校准规模」字段，最接近的 `judgeAurocScored`（`:330-342`）也无判定 | `parseJudgeCalibration` 加 `cases.length >= 100`，并把夹具补到 ≥100 |
| 6 | §4 指标 AUROC / 试点 ≥0.65 `:98-99` | B | 算：`auroc` `l1-matrix.ts:301-318`（单类为空 → `return null` `:308`）、`judgeAurocFromScored` `:330-342`，写 `L1Report.judgeAuroc`（`run-l1-golden.ts` 报告构造里的 `judgeAuroc: calib.judgeAuroc`）；判定 0 处；**且生产入口不产**：CLI `main()` 不传 `scoreJudge`（`run-l1-golden.ts:539-544`），worker `consumer.ts:94-101` 不传 → 实测只有单测能产出 `judgeAuroc` | 接上真实打分器 + 加 gating |
| 7 | §4 账本 `run_type=verifier_calib\|golden_2x2\|tau_sweep` `:102` | C（前两个值无数据源） | `EvalRunTypeSchema` 只有 `golden_2x2` / `session_multiturn`（`contracts/src/eval/eval-run.contract.ts:60-61`）；τ 网格只嵌在 L1 `reportJson.tauSweep` | 加枚举值 + 写库分支 |
| 8 | §5 风险-覆盖扫描（网格 → 业务选 τ*）`:116-123` | A（结果无消费者） | `sweepTau` `l1-matrix.ts:210-244`，`cov >= coverageMin && cr <= cRateMax` `:235-236`，`scored === 0 → tauStar null` `:242`；`tauStar` 只被展示（`dashboard.ts:222`） | τ* 产出后接一个「写 KB config」的出口 |
| 9 | §6 C 率 ≤5%（硬）`:132` | A（放行侧不读） | `TAU_STAR_C_RATE_MAX = 0.05` `l1-matrix.ts:180` 进 `sweepTau` `:236` 的 `&&`；`adr046-snapshot.ts:10` `cRateMax` 只进 `compareHardGates`（门对门），`evaluateAdr046Bind` 不读实测 C 率 | 同 #1 |
| 10 | §6 覆盖率 ≥40%（硬）`:133` | A（阈值 0 而非 0.4） | 常量 `adr046-snapshot.ts:11`；实测读点 `:163` 用 `> 0`；`sweepTau` `:235` 用的是**按 τ 重算的假设格** | 改 `:163` 阈值 |
| 11 | §6 引用完整率（knowledge）≥99%（硬）`:134` | C | 同 #3；`citationCompleteMin` 只在 `:12` 定义，仅被 `compareHardGates` `:92-97` 当门对门数值比较 | 同 #3 |
| 12 | §6 Judge AUROC ≥0.65（硬）`:135` | B | 同 #6；常量 `:13` `judgeAurocMin` 只进 `compareHardGates` | 同 #6 |
| 13 | §6 Hit@20 ≥70%（有标注时，硬）`:136` | B | 同 #4；常量 `:14` `hitAt20Min` 只进 `compareHardGates` | 同 #4 |
| 14 | §6 人工抽检 ≥20 条、错 ≤1（硬）`:137` | C | 全仓 0 命中 `humanSpotMin` / `humanSpotErrorMax`（仅常量 `adr046-snapshot.ts:15-16` 与 `MAX_KEYS` `:25`） | 需新入口（见疑点 1） |
| 15 | §6 ask P95 strict ≤20s（建议→业务可升硬）`:138` | B | 算：`summarizeLatencies` `services/dashboard.ts:180-197`（p95Ms）并出 `DashboardLatencyTrackSchema`；判定 0 处 | 升硬需把 p95Ms 接进放行判定 |
| 16 | §6「该表引用的零容忍口径」 | — | **该表（`130-138`）无零容忍行**；零容忍在 §6.2 `:186` | 若本意指 §2 的 C=幻觉，见 #1 |
| 17 | §6 权威账本 PG `eval_runs` + CI `:142` | A | `persistEvalRun` `run-l1-golden.ts:179-189`；判定读者 `isSignoffPackageRow` `services/eval-runs.ts:52-61` + SQL `:313-331` | 无 |
| 18 | §6.0 锚点（KB 未声明则用 pilot 默认）`:148` | A | `bindQualitySnapshotToEval` `adr046-snapshot.ts:179` `{ ...(input.gates ?? PILOT_HARD_GATES) }` | 无 |
| 19 | §6.0 加严方向（任一硬门变松 → 拒绝标加严包）`:149` | A | `compareHardGates` `:85-103` + `MAX_KEYS` `:25`；`direction === 'looser'` → `:158` reasons、`:160-161` `signedPackage` 的 `&&` | 无 |
| 20 | §6.0 四要素 `:150` | A（②弱） | `fourElementsOf` `:116-133`、`fourElementsComplete` `:135-137`；被 `:160-161` `&&` 读；`bindable` `:153` 只读 configSnapshot + l1RerunBound | ② 补「重跑适用」判据（见疑点 6） |
| 21 | §6.0 加载（运行时质量参数仅来自已签字包，不一致拒绝加载）`:151` | C | `writeBoundSnapshot` `:218-226` 只写；全仓唯一读点是 `apps/api/tests/eval/l1-cli.test.ts:359`；运行时 `tauClaim` 仍取 env（`run-l1-golden.ts:505`、`routes/kb-settings.ts:69`） | 加「读快照 → 与运行时参数比对 → 不一致拒绝」的加载口 |
| 22 | §6.0 放宽须 ADR + 合规会签 + 产品 A `:152` | 部分 A | 机械部分=`direction === 'looser'` 拒 `signedPackage`（`:158`-`:161`）；`FourElements.signatures` `:36` 只有 `businessR && productA`（`:130`），**无 ADR / 会签字段** | 四要素加 `adrRef` / `complianceSign` |
| 23 | §6.0 标记 `gate_bundle=pilot\|stricter` `:153` | A | `:209` 写 `gate_bundle`；报告 md `run-l1-golden.ts:370`；落盘 `l1-gate-snapshot.json` | 无 |
| 24 | §6.0 多 KB 独立包 `:154` | B | 快照带 `kbId`（`:52`、`:201`）；`latestSignoffPackage(kbId)` 按 KB 过滤（`services/eval-runs.ts:313-331`）；无「互不污染」判据 | 无（需跨 KB 比对快照才能判） |
| 25 | §6.1 辅助维度：**禁止** `aux_*` 进通过条件 `:163` | A（以缺席实现） | 报告类型无 aux 字段（`L1Report` `run-l1-golden.ts:74-106`）；`PILOT_HARD_GATES` 只 7 键；钉测 `adr046-snapshot.test.ts:285`、`:292` | 无 |
| 26 | §6.2 规模 30～50 `:169` | 部分 B | `L2_SIGNOFF_MIN_CASES = 15`（`l2-gold.ts:29`）→ `l2-matrix.ts:44` `caseCount < 15` 的 `&&`；真实夹具 18 题 | 改常量 + 补题（会翻测例，见四） |
| 27 | §6.2 账本 `run_type=session_multiturn`，与 L1 分列 `:170` | A | `L2GoldFile.run_type: 'session_multiturn'` 字面 + 加载期强校验（`l2-gold.ts` 抛 `gold.run_type must be session_multiturn`）；`run-l2-golden.ts:142` `runType`；`persistL2EvalRun` `:160` 注释禁止复用 L1 persist | 无 |
| 28 | §6.2 通过才允许 `sessionEnabledDefault=true` `:171` | C | 全仓 0 命中 `sessionEnabledDefault`；最接近 `sessionRewriteEnabledDefault`（`routes/kb-settings.ts:53`）且 PATCH 恒 400（`:108-118`：无合格 L2 → `SESSION_REWRITE_DISABLED`；有合格 L2 → `'session rewrite switch stays locked'`）；L2 合格判定 `hasQualifyingL2Archive` `services/eval-runs.ts:298-310` | 先冻结字段名与出口，再接 L2 合格 |
| 29 | §6.2 题型必含 8 类 `:177-184` | A（比 PRD 多一类） | `L2_TYPES` 9 类 `l2-gold.ts:6-16`；`l2TypeCoverage` `:76-83` → `l2-matrix.ts:47` `missing.length === 0` 的 `&&` | 无（严格对齐 PRD 需先裁 `session_isolation`） |
| 30 | §6.2 零容忍四项 `:186` | A（1/4） | `historyLeaked` `l2-matrix.ts:27-32` → `run-l2-batch.ts:105`、`:116` → `l2-matrix.ts:46` `zeroToleranceHits !== 0` 的 `&&`；其余三项见疑点 5 | 见疑点 5 |
| 31 | §6.2 近指代主题正确且合法作答 ≥80%；零容忍 = 0 `:188` | 80% → **B**；零容忍=0 → A | 数据源齐但无消费者：`L2BatchCaseRow` `run-l2-batch.ts:30-41`（type + verdict），`expectedThemePersist` 只回显 `:128`；`computeL2SignoffEligible` 不读 `passCount` / `verdict` | 在 `run-l2-batch.ts` 加 near_coref pass 率，再进 `computeL2SignoffEligible`（近似与残余见疑点 4） |
| 32 | §7 触发表 `197-217`（数据行 `199-216`） | 见下表 | — | — |

**§7 逐行分类（18 行）**

| §7 行（实读） | 事件 | 今天是什么 |
|---|---|---|
| `199` | 更换 generate / 主 judge / embed / rerank | **纯文档纪律**（且报告不记当时模型身份：`L1Report` 无 models / promptVersions / fallbackChains 字段，§8 可复现字段未落 L1 报告） |
| `200` | 更换 `judge_aux` / 辅助体验 prompt | 纯文档纪律 |
| `201` | 变更批量 judge prompt / 分片策略 | 纯文档纪律（`judgeAuroc` 字段存在但无强制） |
| `202` | 变更 route 规则种子 / route.rules / 后置禁词闸 | 纯文档纪律 |
| `203` | 变更 rewrite / session 意图 prompt 或策略 | **有数据源无判定**：`l2Fingerprint` 写进 L2 `reportJson`（`run-l2-golden.ts:154-157`，算法 `l2-fingerprint.ts:4-6`），无「与上次比对」；worker 路径连指纹都没有 |
| `204` | 变更 claim_split / rerank 模型或供应商 | 纯文档纪律 |
| `205` | rerank 主备切换 / 链顺序 / 备用节点替换 | 纯文档纪律 |
| `206` | 变更 Gateway fallbackChains / 主 provider | 纯文档纪律 |
| `207` | 修改 `tauClaim` / crag 阈值 / citationPolicy | **有数据源无判定**：快照记 `tauClaim`（`adr046-snapshot.ts:47`、`run-l1-golden.ts:505`），`tauSweep` 只嵌 reportJson；无「变更即须重跑」比对 |
| `208` | 业务线加严门禁包生效 / 变更加严数字 | **有机械判据**：`compareHardGates` + `fourElementsComplete` + `evaluateAdr046Bind` |
| `209` | 业务线放宽任一硬门 | **有机械判据**（只到 `loosenedKeys` → 拒 `signedPackage`）；「须新 ADR + 合规会签」无字段 |
| `210` | 切换 `contextMode` | 纯文档纪律 |
| `211` | 跨 doc 去重策略变更 | 纯文档纪律 |
| `212` | active 文档数变化 >20% / 关键制度 supersede | 纯文档纪律（无聚合与比较点；我搜到 0 处判据） |
| `213` | ACL 模型变更（引入 doc_acl） | 纯文档纪律 |
| `214` | 超 90 天未评测 | **有数据源无判定**：`eval_runs.ranAt` / `createdAt` 可查（`services/eval-runs.ts:313-331` 已在用 createdAt 排序） |
| `215` | 在线抽样 / feedback 质量崩溃 | 纯文档纪律 |
| `216` | L3 多轮失败率持续超阈 | 纯文档纪律 |

### 二、疑点 1–7

**疑点 1 · 人工抽检有没有入口 / 登记表 / 命令 / 报告字段？**
没有。`humanSpotMin` / `humanSpotErrorMax` 全仓只有 3 处命中，全在 `apps/api/src/eval/adr046-snapshot.ts`：`:15`、`:16`（常量）与 `:25`（`MAX_KEYS` 把它们当上限类参与门对门比较）。没有命令、没有表、没有报告字段、没有 HTTP。人侧唯一「登记」产物是 `fixtures/l1/RACI.md`（§2「题面审核记录」，内容是 gold 题面审核，与抽检无关）与 `fixtures/l2/RACI.md`（自述「占位」）。**结论：今天无人、无处登记**（全仓 0 命中，不只是「没找到」）。

**疑点 2 · `citationComplete` 是否存在、是否按 knowledge 口径算？**
不存在。任何报告 schema 都没有这个字段或同义字段：`L1Report`（`run-l1-golden.ts:74-106`）、`L1BatchReport`（`run-l1-batch.ts:56-75`）、`L2Report`（`run-l2-golden.ts:62-76`）、`L2BatchReport`（`run-l2-batch.ts:45-55`）、`EvalRunSchema`（`eval-run.contract.ts:32-58`）、`DashboardQualityTrack`（`system/dashboard.contract.ts:25-35`）里都没有；唯一的 `citation*` 字面量是 gate 常量 `citationCompleteMin`（`adr046-snapshot.ts:12`）。分母问题因此无从谈起——**连分子都没有**。而且即便要事后按 knowledge 口径补算也不可能：L1 报告不留 `answerKind`、不留 `citations`（`L1CaseRow` 只有 id / type / outcome / cell / reason / errorMessage / hitAtK / minSupport），非 knowledge 域与未作答题在报告里完全不可分辨。运行时这两个量是有的（`graph/run.ts:119` 只有 `answered ∧ reason==='verified'` 才带 citations；`services/ask/execute.ts:80` 带 `answerKind`），另有两处结构等价物：`validIds.length === 0 → 拒答 invalid_citations`（`graph/run.ts:402-407`）、claim 无合法 chunk → `claim_split_failed`（`graph/run.ts:465-471`）——即「按构造 ≥1 引用」，但那是 ask 图行为，不是评测指标。

**疑点 3 · `hitAtKCase` 的 k 语义与 PRD「k=20」是否等价？**
不等价，且**两侧都有偏差**。函数签名根本不收 k（`l1-matrix.ts:110-113`），k = 传入 evidence 列表长度（注释 `:106-109`）。调用方传的是 `result.graph.evidence_snapshot` 的 `docId`（`run-l1-golden.ts` 里 `evidenceDocIds = (result.graph.evidence_snapshot ?? [])` 那几行），而 `evidence` = rerank 后进 verify 的整表（`graph/run.ts:331-351`）。默认 `mode='balanced'`（`graph/state.ts:139`、`run.ts:262`）→ `rerankTopN=20`（`graph/budget.ts:29-32`），passage 足够时 k 恰为 20，**此时与 PRD 等价**。偏差：① `fast` 档 `rerankTopN=10`（`budget.ts:27-28`）→ 实际是 Hit@10，**比 PRD 更严**；② 语料不足 20 条 passage 时 k<20，**更严**；③ k 的集合是「rerank 截断后进 verify 的集合」而非 PRD 字面的「检索 Top-k」，若将来 verify 前再裁 evidence，Hit@k 会跟着漂移（这一侧是**口径漂移风险**，不是严格意义上的更严/更松）。另有一处与 PRD 无关但影响可比性：gold 里的逻辑 id 必须被映射成当前 KB 的 uuid 才算命中，未映射只降低 Hit@k 且不抛错（`l1-matrix.ts:117-125`；钉测 `packages/contracts/tests/eval/l1-hit-at-k.test.ts:64`）。

**疑点 4 · L2「主题正确」有没有机械判据？**
没有。机械判定只有三项：`history_in_evidence`、`accept`、`rewriteUsed`（`run-l2-batch.ts:107-113`；`run-l2-golden.ts` 同形的三处 `failReasons.push`），`verdict = failReasons.length ? 'fail' : 'pass'`（`run-l2-batch.ts:115`）。`expected.themePersist` 只被回显到报告字段（`run-l2-batch.ts:128`、`run-l2-golden.ts:316`），**不参与 verdict**——`apps/api/tests/eval/l2-cli.test.ts:351` 的用例名直接写着 `themePersist not judged`。`rubric` 同理：`L2Case.rubric` 由 `parseRubric`（`l2-gold.ts:249-254`）只校验非空，**零消费者**。
若按「近指代题的 pass 率」落地 80%：**近似关系** = pass 等价于「未泄漏 ∧ 末轮 `status`/`reason` ∈ `expected.accept` ∧ `rewriteUsed` == 期望」。对夹具里的 `l2-near-coref-001..003`（`accept: ["answered"]`、`rewriteUsed: true`，`fixtures/l2/gold.yaml` 内）等价于「答了 ∧ 是 answered ∧ 用了 rewrite」，**不含主题是否正确**——粘在住宿上胡答也是 pass。**残余**：① 主题正确性无人判（无 judge、无按 `expectedDocIds` 的命中率；L2 runner 只取 `evidenceTexts`，把 `evidence_snapshot.docId` 丢掉了，所以连「近指代题是否命中 `expectedDocIds`」都要先补采集）；② 「合法 citation」无人判；③ 分母口径未定：夹具只有 **3** 条 near_coref，80% 只能取 0 / 33.3 / 66.7 / 100%，**≥80% ⟺ 3/3 全过**，等价于零容忍而非比例门。最小可算版本是「near_coref 题 verdict=pass 比例」（数据现成），但它就是上面那个不含主题的近似。

**疑点 5 · 其余三项零容忍今天落在哪里？**
只有 `history_in_evidence` 直接进 `zeroToleranceHits`（`run-l2-batch.ts:116`；`run-l2-golden.ts` 的 `if (leaked) zeroToleranceHits += 1`），并由 `computeL2SignoffEligible` 的 `zeroToleranceHits !== 0`（`l2-matrix.ts:46`）读。其余三项：
- **主题粘连胡答** → 只落在题面 `expected.accept`：`topic_switch` 两条的 `accept` 是 `["answered","abstained"]`（`fixtures/l2/gold.yaml` 两个 topic_switch 用例内），粘连答也是 `answered` → 机械判 pass。**无判据**。（`fixtures/l2/README.md` 自述「本窗**不**自动判；报告只回显 `themePersist`」。）
- **冲突场景跟错数字** → 同款：`kb_conflict` 两条 `accept` 也是 `["answered","abstained"]`；rubric 里写了「库内 600 / 120」（fixture 内文字），但 rubric 无消费者。**无判据，也没有任何字段记录答案里的数字。**
- **合法路径跳过 verify** → **无判据**。没有任何代码读 `reason === 'verified'`；`acceptHit` 只做题面白名单匹配（`l2-matrix.ts:22-24`），而这三类题的白名单里没有 `'verified'`，也没有「answered ⇒ reason 已记录」的检查。
另外，泄漏检查本身**比 PRD 窄**：`historyLeaked` 只比对**先前用户轮**原文（`run-l2-batch.ts:104` `c.turns.slice(0, -1).map(t => t.text)`），上轮 assistant 文本进入 evidence 不会被抓。

**疑点 6 · `l1RerunBound` 与「重跑 L1 适用」的差？**
属实：**「适用」没有机械判据**。`fourElementsOf`（`adr046-snapshot.ts:129`）的 `l1RerunBound = Boolean(input.evalRunId) || Boolean(input.kbId && input.ranAt)`。既没有「绑定的 evalRunId 必须比上一次签字包更新」，也没有「τ 变了就必须带工作点说明」的字段。OR 的第二个分支只要 kbId 与 ranAt 非空即真，而 `run-l1-golden.ts:499-503` 恒传两者 → `bindable` 恒可取真，`signedPackage` 实际只被 `proposal` / `signatures` / `loosened_hard_gate` 这三项拦住。这一点在 `docs/testing/coverage/03-ops.md:108`（T3 行）已被记为「部分测」缺口，措辞是「『无 evalRunId 即不得 bindable』**不成立**」；钉死该回退的测例是 `apps/api/tests/eval/adr046-snapshot.test.ts:211` `it('无 evalRunId 时用 report:kb:ranAt 绑定')`。

**疑点 7 · `TAU_STAR_*` 与 `PILOT_HARD_GATES` 的双写？**
是两份独立常量，数值一致，**无任何依赖关系**：
- `packages/contracts/src/eval/l1-matrix.ts:179-180` `TAU_STAR_COVERAGE_MIN = 0.4` / `TAU_STAR_C_RATE_MAX = 0.05`，注释 `:178` 明写「与试点硬门 coverageMin / cRateMax 对齐；**不从 api adr046 反引**」。
- `apps/api/src/eval/adr046-snapshot.ts:9-17` `PILOT_HARD_GATES`（`cRateMax: 0.05` `:10`、`coverageMin: 0.4` `:11`）。
- 依赖方向：只有 api → contracts（`apps/api/src/eval/l1-matrix.ts:1-42` 纯再导出），反向不存在（`PILOT_HARD_GATES` 在 `packages/` 下 0 命中；`adr046-snapshot.ts:4-5` 只 import `node:fs` / `node:path`，不 import contracts）。
- 一致性没有断言：两份数值分别被两组独立测例钉死——`packages/contracts/tests/eval/l1-tau-sweep.test.ts:68` `it('满足试点硬门时取最大 τ')` 里 `expect(TAU_STAR_COVERAGE_MIN).toBe(0.4)` / `expect(TAU_STAR_C_RATE_MAX).toBe(0.05)`，`apps/api/tests/eval/adr046-snapshot.test.ts:219` `it('不传 gates → 门禁包 = pilot 默认、无加严标记、可逐项打印数字')` 里 `expect(snapshot.gates.coverageMin).toBe(0.4)`。**改一份不会让另一份红。**

### 三、比 PRD 更严的地方（只列，不改）

1. `computeSignoffEligible`（`l1-matrix.ts:69-77`）要求 `live ∧ 可答 ≥30 ∧ 不可答类 ≥30`（`SIGNOFF_MIN_PER_CLASS = 30` `:45`）。PRD §6 硬门表无规模项，§1 只有比例规则——这是代码多出来的一道规模门（`live` 之外）。
2. L2 九类必齐（`l2-matrix.ts:47`）严于 PRD §6.2 `:177-184` 的八类：多出 `session_isolation`，且夹具必须至少有一条 `session=new`（`l2-gold.ts:145-147`）。
3. `sweepTau` `:242`：整批无有效 `minSupport` → `tauStar` 恒 null，即使原格碰巧过门（钉测 `packages/contracts/tests/eval/l1-tau-sweep.test.ts:83`）。
4. `auroc` `:308`：任一标签类为空 → null，明令禁止写成 1 / 0.5。
5. 脏数据抛错纪律严于 PRD 沉默：`parseExpectedDocIds` `:92-100`、`parseJudgeCalibration` `:265-292`、`parseJudgeLabel` `:250-255`。
6. `historyLeaked`（`l2-matrix.ts:27-32`）是**子串命中即泄漏**，比「历史文本进 evidence」的字面表述更硬；同时 `expected.historyInEvidence` 必须显式为 `false` 才允许加载（`l2-gold.ts:219-221`）。
7. `gatesComplete`（`:109-113`）要求候选包 7 个键全为非有限数之外的有限值，缺一即 `configSnapshot=false`。
8. `compareHardGates` 的 `MAX_KEYS`（`:25`）把 `humanSpotErrorMax` 归为上限类（越小越严）——方向正确，属实现细节。
9. 反向缺口（代码**没**实现的 PRD 项，顺带记录）：§1「不可答 ≥ 可答 50%」下限无机械判据（`goldTypeCounts` 只被 ≥30 规模门用）；§8 可复现字段（seed / models / fallbackChains / promptVersions / 题面哈希 / 校准集哈希）在 L1 报告里基本不存在。

### 四、落地会翻掉的既有断言（文件 + `it('...')` 原文）

1. **覆盖率阈值 `>0` → `>=0.4`**：**不翻任何断言**。`apps/api/tests/eval/adr046-snapshot.test.ts:135` `it('coverage=0 不得翻业务 PASS')`（期望 false）、`:148` `it('全 internal_guard 不得翻业务 PASS')`（用 0.4，期望 false 的成因是 internal_guard）、`:99` `it('四要素齐 + 未放宽 + live 覆盖 >0 → 可标已签字包且业务 PASS')`（用 0.5，期望 true）都不受影响。
2. **C 率 / 实测覆盖率进放行判定**：需要在 `evaluateAdr046Bind` 加新入参，现有调用侧不改则**不翻**；`apps/api/tests/eval/l1-cli.test.ts:294` `it('serial loop → matrix + report files with required fields')` 已期望 `businessPass=false`。
3. **Hit@20 / Judge AUROC 进 `businessPass`**：翻 **1** 条 —— `apps/api/tests/eval/adr046-snapshot.test.ts:99` `it('四要素齐 + 未放宽 + live 覆盖 >0 → 可标已签字包且业务 PASS')`：该用例只传 `four/diff/signoffEligible/coverage/caseReasons`，把缺测值当不合格后 `businessPass` 由 `true` 变 `false`（同文件 `:111` `it('硬门放宽 → 不得标已签字')`、`:123` `it('缺四要素 → 不得标已签字')`、`apps/api/tests/eval/stricter-than-pilot-bind.test.ts:61` `it('剧本 T3：加严提案未绑 L1 重跑且无人签 → 只标加严、不得标「已签字」')` 的期望本就是 false，不翻）。若把 gate 落在 CLI 层而非纯函数，则需改 `run-l1-golden.ts` 的调用，`l1-cli` 侧无 `businessPass=true` 断言，**不翻**。
4. **校准规模 ≥100 落在 `parseJudgeCalibration` 内**：翻 `packages/contracts/tests/eval/l1-judge-auroc.test.ts:35` `it('合法 cases 解析 label')`（2 题，断言 `toHaveLength(2)`）；`packages/contracts/tests/eval/l1-judge-auroc.test.ts:47` `it('缺 id / claim / evidence / 空数组拒')` 只在新增报错信息不再匹配 `/non-empty/` 时才会翻（它断言 `parseJudgeCalibration({ cases: [] })` 抛 `/non-empty/`）；同时仓根夹具只有 8 题 → live AUROC 路径整体不可用。落在 runner 层：翻 `apps/api/tests/eval/l1-cli.test.ts:458` `it('注入校准打分器写 judgeAuroc；不注入则 null；不改 2×2')`（2 题校准，期望 `judgeAuroc=1`）、`apps/worker/tests/eval/run-l1-batch.test.ts:95` `it('注入校准打分器写 judgeAuroc；不注入则 null')`（2 题，期望 `1`）与 `:124` `it('打分数组短于校准题 → 抛错，不得用子集写成 1')`。
5. **人工抽检进 `businessPass`**：翻第 3 条的同一用例 `apps/api/tests/eval/adr046-snapshot.test.ts:99`（`BindSnapshotInput` 无抽检字段）。
6. **L2 规模 15 → 30（PRD 建议下限）**：翻 **4** 条 —— `packages/contracts/tests/eval/l2-matrix.test.ts:23` `it('live + 九类 + ≥15 + 零泄漏 → true')`（`caseCount: 15`）、`apps/worker/tests/eval/run-l2-batch.test.ts:67` `it('live + 九类齐 + ≥15 + 零泄漏 → 工程 signoffEligible')`（15 题）、`apps/api/tests/eval/l2-cli.test.ts:407` `it('8 real gold + stub live → caseCount≥15; 工程 signoffEligible true 仍无 businessPass')`（真实集 18 题，断言 `signoffEligible=true`）、`apps/api/tests/eval/l2-cli.test.ts:651` `it('real gold + persist mock + esMode http → 工程 signoffEligible true 仍 ≠ 准出')`（同样断言 true）；另 `apps/api/tests/eval/l2-gold.test.ts:218` `it('真实 gold 可 JSON 加载且覆盖 9 类 ≥15')` 断言夹具 ≥15，若同步扩题到 30 才需改。
7. **L2 近指代 ≥80% 进 `computeL2SignoffEligible`**：签名新增输入 → 编译期即红：`l2-matrix.test.ts:23`、`:34`、`run-l2-batch.test.ts:67` 需补参。真实集下**不会**翻语义：stub 恒返回 `answered + rewriteUsed:true`，3 条 near_coref 全 pass → 若判据就是 near_coref pass 率则 100% 仍过。
8. **L2 其余三项零容忍变机械**（例：answered 必须 `reason='verified'`、或按 `expectedDocIds` 判主题）：会翻 `apps/worker/tests/eval/run-l2-batch.test.ts:34` `it('mock 即使零泄漏也不得 signoffEligible')`（断言 `passCount=1`）、`:50` `it('history leak increments zeroToleranceHits and fails the case')`、`:67` `it('live + 九类齐 + ≥15 + 零泄漏 → 工程 signoffEligible')`（stub 无 reason、无 docId）、`apps/api/tests/eval/l2-cli.test.ts:351` `it('6 status in accept + rewrite aligned → pass; themePersist not judged')` 与 `:407`（同为 stub `answered`）。
9. **打开 `sessionEnabledDefault`（§6.2 `:171`）**：今天 PATCH 恒 400（`routes/kb-settings.ts:108-118`），已有断言 `apps/api/tests/kb/settings-http.test.ts:299` `expect(body.error.code).toBe('SESSION_REWRITE_DISABLED')`（对应 `it` 名我未逐字读到，故不写行号外的用例名）；`'session rewrite switch stays locked'` 分支**无任何测例覆盖**（全仓 `stays locked` 仅命中 `kb-settings.ts:118`）。
