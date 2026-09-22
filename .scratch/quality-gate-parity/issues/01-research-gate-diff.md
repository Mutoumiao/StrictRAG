# 研究：PRD 硬门与代码判定的逐条差额清单

Type: research
Status: open

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

（待填）
