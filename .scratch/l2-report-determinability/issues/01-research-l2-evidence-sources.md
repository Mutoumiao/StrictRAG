# 研究：L2 报告的可判定面今天到底缺什么、有哪些可复用形状

Type: research
Status: open
Blocked by: —

## Question

把「一次 L2 run 的报告凭什么能拿来做准出判定」这条链上的三样缺失（采集面 · 零容忍判据 · §8 L2 字段）**逐条落到源码事实**，好让裁定票能拍板。要回答：

1. **采集面（`evidence_snapshot.docId`）**
   - `apps/api/src/scripts/run-l2-golden.ts` 与 `apps/worker/src/eval/run-l2-batch.ts` 各自**在哪一行**丢掉 `docId`？两侧的数据形状（`GraphEvidence` / `EvidenceSnapshotItem` / `L2TurnExecuteResult`）**逐字段**列出来，标明哪个字段今天有、哪个没被读。
   - `apps/worker/src/eval/execute-ask-http.ts` 的 `ExecuteAskJson.data` 里**到底有哪些键**、api 侧 `/api/v1/internal/eval/execute-ask` 真正下发了哪些？`createEvalHttpExecute` 与 `createEvalHttpL2Execute` 分别读了哪些（逐键对照）？
   - `L2Case.expectedDocIds` 今天**有没有任何消费者**？全仓搜一遍，给全部读点。`fixtures/l2/gold.yaml` 里 20 条 case 各有几条带 `expectedDocIds`、各带几个 id、这些 id 与语料里的 `external_id` / 文档主键是什么关系（`fixtures/l2/corpus/` 或等价物在哪、id 怎么对上 `evidence_snapshot.docId`）？**这条最关键**：如果 fixture 的 `expectedDocIds` 与真跑出来的 `docId` 根本对不上，那么补采集面也判不出命中。
   - L1 侧「命中期望文档」的完整写法（`run-l1-golden.ts` 取 `e.docId` → `hitAtKCase` → `hitAtKRate`）**逐段**给出，标明哪些部分可直接搬到 L2、哪些部分（例如 `k=20`、无标注 → `null`、分母口径）在 L2 语义下不成立。
   - 「合法 citation」在 L1 侧的定义（`citationCompleteRate` + 图内不变式）原文给出；L2 侧要机械化需要图上/回包上的**哪几个字段**（`answerKind` / `citations` / `citationCount`），今天两侧分别可得吗？

2. **零容忍判据（PRD §6.2 四项）**
   - `historyLeaked` 的**完整语义**与全部调用点；`priorUserTexts` 的构造在两处（api CLI / worker batch）分别是什么？要扩到「历史**文本**」（含上轮 assistant 文本）**最少**要改哪几处？
   - 上轮 assistant 文本进 evidence 这件事，今天**结构上可能发生吗**？（读 `apps/api/src/graph/run.ts` 与 `services/ask/execute.ts` 的 evidence 构造：evidence 是否只可能来自 KB chunk？`packages/db/src/schema/ask/ask-traces.ts` 的注释说「evidence_snapshot 仅 KB chunk 元数据，禁止会话原文」——这条是**类型保证**还是**约定**？）给出结论与依据。
   - `min_support` 是什么：`parseMinSupport` 的定义、`graph.minSupport` 的产生处、「历史文本进 `min_support`」在今天的图上**能不能被观测**？L2 两侧为什么都没采集它？
   - 另外三项零容忍（主题粘连胡答 · 冲突场景跟错数字 · 合法路径跳过 verify）今天**有没有任何**可观测原料？逐项给：fixture 里有哪些结构化字段可用（`expected.themePersist` / `expected.rewriteUsed` / `expected.accept` / `expectedDocIds` / `rubric` 自由文本）、图上有哪些字段可用（`status` / `reason` / `minSupport` / `debug.llmCalls` / `citations`）。**没原料就如实说没原料**，不要给「可以近似」的空话。
   - `fixtures/l2/gold.yaml` 的 20 条 case 逐条给出：`id` / `type` / `expected.*` / 有无 `expectedDocIds` / `rubric` 里是否写了具体数字或明确判据。

3. **§8 的 L2 侧字段**
   - 「L2 剧本集哈希」：`apps/api/src/eval/l2-fingerprint.ts` 的 `l2RewriteFingerprint` 与 §8 的「L2 剧本集哈希」**是不是同一件事**（它算的是 prompt+modelId，不是剧本集）？`l1QuestionIdsHash` / `l1CalibSetHash` 的实现原文给出，评估直接搬来算「剧本集 id 集合哈希」的可行性（L2 的 case id 是 `l2-<slug>`，稳定吗？）。
   - 「session 策略版本 / rewrite prompt 版本」：全仓有没有**任何**版本载体（常量表 / KB 配置键 / 表列）？`SESSION_REWRITE_ENABLED` 只是布尔吗？`rewriteSystemPrompt()` 的来源与稳定性如何？**没有载体就如实说没有**。
   - L1 图新增的 `L1Repro`（14 键）形状原文给出；L2 要同构需要哪些键、哪些今天取不到。
   - `l2Fingerprint` 今天进不进报告本体？`apps/worker/src/eval/persist.ts` 的 `saveL2Report` 白名单**逐键**列出；api 侧 `buildL2EvalRunInsert` 是整对象直落吗？两侧**不同构**这件事会造成什么具体后果（给一个「加了字段会被静默丢弃」的判定依据）。
   - `docs/observability` / `obs/l2-stale`（`evaluateL2Stale`）：它读的指纹从哪来、过期判据是什么？改动 `l2Fingerprint` 会不会连带打红 `apps/api/tests/obs/l2-stale.test.ts`？

4. **落点与回归面**
   - 三腿各要动哪些文件（分 contracts / api / worker 三侧列出，注明是「纯新增」还是「改既有形状」）。
   - 落地会**翻哪些既有断言**？逐条点名文件与用例名。特别核：`packages/contracts/tests/eval/l2-matrix.test.ts` · `l2-near-coref-rate.test.ts` · `apps/api/tests/eval/l2-cli.test.ts` · `l2-near-coref-rate.test.ts` · `apps/worker/tests/eval/run-l2-batch.test.ts` · `run-l2-batch-near-coref-rate.test.ts` · `consumer.test.ts` · `apps/api/tests/obs/l2-stale.test.ts` · `apps/api/tests/eval/http-eval-runs.test.ts` · `apps/api/tests/docs-guard/*`。**特别声明**：在 L2 报告类型上加**必填**字段会一次性打红哪几处报告字面量？
   - `L2BatchReport`（worker）与 `L2Report`（api）两处类型**逐字段对照表**：哪些字段只有一侧有？`persist.ts` 白名单与两侧类型的差异点在哪？
   - `packages/contracts` 的**导出面**：`l1-matrix` / `l2-*` 各从哪导、`index.ts` 与 `package.json` 的 `exports` 现状；L2 新增哈希要不要走子路径导出（评估 `node:crypto` 进客户端图的实际路径）。

5. **诚实面**
   - 三腿里哪几样**离线能补成真判据**、哪几样**只能补成「有原料但没人/judge 判不了」**？逐腿给边界。
   - 有没有哪一项「看起来能机械化、实际上会造出形似而非语义的假判据」？点名并说明为什么。

## 纪律

- 只读 + 只写本工单 Answer 与 `research/01-l2-evidence-sources.md`。**不改源码**。
- 每条结论要能指到**具体路径**（文件名 + 函数名；行号可给，但只写在 `.scratch/` 里）。
- 拿不准写「未核实」，禁止猜了当结论。
- 全文简体中文。行尾统一 LF（本仓有 CRLF 检出会让逐字节哈希变化）。
