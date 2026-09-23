# 研究：L2 报告的可判定面今天到底缺什么、有哪些可复用形状

Type: research
Status: resolved
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

## Answer

研究明细：`.scratch/l2-report-determinability/research/01-l2-evidence-sources.md`（只读勘察，未改任何源码）。

1. **最关键那问的硬结论：按 `expectedDocIds` 判命中，今天不成立。** 真跑 `docId` = `documents.id`（uuid v7，`packages/db/src/schema/_shard/base-columns.ts` + `services/retrieve/corpus.ts` 的 `docId: c.docId` → `retrieve.ts` → `graph/run.ts` 的 `evidence` 构造），而 gold 写的是逻辑 id（`l2-corpus/travel-stay` / `ingest-samples/01-doc`）。三个必要条件全缺：① `fixtures/l2/corpus/*` 三篇**从未入库且无入口**（`scripts/demo-ingest.mjs` 只吃 `fixtures/ingest-samples`）；② `documents` 表**无 `external_id` 或等价列**，全仓也无映射文件 / env / 表（只有两份 README 表格 + 一句人工纪律）；③ worker 通道丢 `evidenceDocIds`。照搬 L1 的 `hitAtKCase` 只会得到**恒 0**（未映射 → `false`，不是 `null`），即「形似判据的恒零」。
2. **`expectedDocIds` 全仓零消费者**：只有 `packages/contracts/src/eval/l2-gold.ts` 的类型声明与 `parseDocIds` 校验；`run-l2-golden.ts` / `run-l2-batch.ts` 只读 `expected.accept` / `rewriteUsed`，`themePersist` 仅回显不比对。夹具实况：**18 条 case（非 20）**，全部带 `expectedDocIds`，共 25 个逻辑 id；`near_coref` 仅 3 条。
3. **采集面断点在 worker 类型，不在内口**：`apps/api/src/routes/eval.ts:329-345` 已下发 9 键（含 `evidenceDocIds` / `minSupport` / `answerKind` / `citationCount`），但 `apps/worker/src/eval/run-l2-batch.ts` 的 `L2TurnExecuteResult` 这 4 键全无，`execute-ask-http.ts` 的 `createEvalHttpL2Execute` 也只读 5/9（对照同文件 L1 的 `createEvalHttpExecute` 读 6/9）。api 侧更不是取不到：`run-l2-golden.ts:309` map 了 `e.text`，同一个 `e.docId` 就在手边。
4. **上轮 assistant 文本进 evidence：结构上不可能。** `graph/run.ts` 的 `evidence` 唯一写点是 retrieve 分支（`r.evidence.map` → `state.evidence` / `state.evidence_snapshot`），正文来自 `corpus.ts` 的 KB chunk（Mongo/PG），会话窗只进 `rewriteUserPrompt`。`ask-traces.ts` 的「禁止会话原文」是**约定 + 单点赋值纪律，不是类型保证**（`GraphEvidence.text` 无 provenance）。故今天的 `historyLeaked` 抓的是「语料撞词」，不是「图把聊天当证据」——把它当已覆盖的零容忍是自欺。
5. **`min_support` 维度无量**：`parseMinSupport`（`packages/contracts/src/eval/l1-matrix.ts`）与 `run.ts` 的 `Math.min(...scores)` 都在，但 PRD 语义（历史文本被当 claim 验证）需要 claim 原文，而 `AskGraphResult` **不含 claims**、`graph_trace` 只落 llmCalls/retrieveCalls/route_*。L2 两侧也没采它：api 连 `result.graph.minSupport` 都没读，worker 类型里没这个键。另三项（主题粘连 / 冲突数字 / 跳过 verify）**均无判据原料**：主题字段图上不存在、冲突数字只在 rubric 自由文本（600/120 确实在 corpus 里）、「是否 verify」无布尔（`debug` 无 purpose 维度）。
6. **§8：`l2RewriteFingerprint` ≠ 剧本集哈希**（它算 `sha256(prompt + '\0' + modelId)`）；剧本集哈希今天**无实现**，但复用 `l1QuestionIdsHash`（`@strict-rag/contracts/eval-repro`，id 集 trim→升序→JSON）即可，L2 case id 受 `/^l2-[a-z0-9-]+$/` 约束、稳定。session 策略 / rewrite prompt 版本**全仓无载体**（`SESSION_REWRITE_ENABLED` 只是布尔，KB 侧只有 `SessionRewriteLock`，prompt 是内联字符串）→ L2 只能记 `null`。`l2Fingerprint` **不进报告本体**（`L2Report` 无该键），只被 `buildL2EvalRunInsert` 的 `{...report}` 塞进 `reportJson`；worker 的 `saveL2Report` 是**手写 13 键白名单**，**无指纹** → 两侧归档键集天然不同，worker 加字段**静默丢弃且零测试红**。新增哈希**必须走子路径导出**（web/admin 用 `transpilePackages` 打 contracts 主入口）。
7. **回归面比预期小**：在 `L2Report` / `L2BatchReport` 上加必填字段，只打红**一处报告字面量** —— `apps/api/tests/eval/l2-cli.test.ts` 的 `sampleReport()`（`:476-492`），连带 3 个 `it`（`maps report → session_multiturn…` / `live report still maps signoffEligible…` / `reportJson.l2Fingerprint matches…`）；worker 侧**零处**。`apps/api/tests/obs/l2-stale.test.ts` **不会红**（`evaluateL2Stale` 零 I/O、入参是字面量字符串，且**全仓无生产调用点**）；`docs-guard/gold-review-guard.test.ts` 只在「`gold.yaml` 字面量与写文件 API 落在 200 字符邻域」时红。真正的爆炸点是改 `AskGraphResult` / `ExecuteAskResult`（一批测试手写 `evidence_snapshot: []`）。
8. **诚实边界**：离线能补成**真判据**的只有 —— 补 `evidenceDocIds` 采集 + 引用完整率（`citationCompleteRate` 现成）+ 历史文本进 evidence（可扩到 assistant 文本，1 个纯函数 + 2 处调用点）+ §8 里 id 哈希 / 剧本集哈希 / `models.env` / `retrieveK`（api 侧由 `graph.mode` 派生）。只能补成**「有原料、没人判」**的 —— `expectedDocIds` 命中率（数据工程欠账）、冲突数字、主题粘连、跳过 verify。

**给主控的 9 条反直觉发现**（详见研究明细 §6）：

1. 工单写 20 条 case，实测 **18 条**（全带 docIds，共 25 个逻辑 id）→ 「≥15 门」余量只有 3 条，口径要先对齐。
2. 「补采集面就能判命中」是错觉：`l2-corpus/*` 无入库入口、`documents` 无 external_id、无映射账本 —— 差的是两件数据工程。
3. 但 api 侧采集面**早已具备**（内口每次都在下发 `evidenceDocIds`），`run-l2-golden.ts:309` 只是没 map；真断点是 worker 的类型定义。
4. 「历史文本进 evidence」今天**结构上不可能** → 这条治的是恒 0，且没有可修对象。
5. worker 加字段**不会被编译器或现有测试拦住**（白名单静默丢弃，靠人肉同构测例）；api 是 `{...report}` 直落 → 两侧报告键集天然分叉。
6. `evaluateL2Stale` **没有任何生产调用点** —— `l2_stale` 告警是「函数在、线没接」；也因此改指纹不会连带打红它的测例。
7. 报告字面量爆炸面很小（api 1 处 → 3 个 it；worker 0 处），真正的雷是改图/服务返回类型。
8. 两侧「同构」是纪律不是类型：`L2CaseRow` / `L2BatchCaseRow` / `L2Verdict` / 报告类型全是逐字段复制两份，类型不会告警。
9. **落库的 evidence 快照没有正文**（`EvidenceSnapshotItem` 无 `text`）→ 「从 `ask_traces` 反推命中 / 泄漏」这条路不通，必须在活体回合里采。

**标了「未核实」的项**：`evaluateL2Stale` 是否存在动态/间接生产调用（静态检索范围内为零）；`.trellis/spec/` 其余包是否另有 L2 采集口径文档；L2 报告字段是否被 admin/web 消费；`fixtures/l2/corpus/*.txt` 正文的完整数字清单（本地控制台编码把正文显为乱码，仅逐字确认了 travel-stay 600/400 与 meal-allowance 120/80）。
