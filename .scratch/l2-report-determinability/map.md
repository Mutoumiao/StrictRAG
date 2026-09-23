# L2 报告的可判定面（采集面 · 零容忍 · §8 字段）

Label: wayfinder:map
Status: open（前沿：工单 03 · 04 · 05；01 · 02 已收口）

## Destination

把「**一次 L2 run 的报告，凭什么能拿来做 L2 准出判定**」补到可核对 —— 今天这张桌上缺三样：

1. **采集面丢了 `evidence_snapshot.docId`**：`apps/api/src/scripts/run-l2-golden.ts` 只 `.map((e) => e.text ?? '')`、`apps/worker/src/eval/run-l2-batch.ts` 的结果形状只有 `evidenceTexts`（而 `apps/worker/src/eval/execute-ask-http.ts` 的**线上回包本来就在发 `evidenceDocIds`**，只是 `createEvalHttpL2Execute` 没读）。于是 §6.2 近指代格的「**主题正确**」与 fixture 里**全部 18 条都带的 `expectedDocIds`**（共 25 个逻辑 id）「**命中期望文档**」**连判据的原料都没有** —— 不是判错，是没得判。L1 侧已有现成写法（`run-l1-golden.ts` 取 `e.docId` + `hitAtKCase`）可同构复用。
2. **PRD §6.2 的四项零容忍只有一项、且比 PRD 窄**：PRD 原文写「**零容忍（任一即 L2 失败）**：主题粘连胡答、**历史文本**进 evidence/`min_support`、冲突场景跟错数字、合法路径跳过 verify」。今天全仓只有 `historyLeaked` 一项，且它 (a) 只比对先前**用户**轮原文（`priorUserTexts = c.turns.slice(0, -1).map((t) => t.text)`）——**上轮 assistant 文本进 evidence 不被抓**，而 PRD 写的是「历史**文本**」；(b) 完全不看 `min_support`；(c) 另外三项零容忍无任何机械判据。
3. **§8 的 L2 侧字段缺席**：§8 表里的「**L2 剧本集哈希**」与「**session 策略版本 / rewrite prompt 版本**」在 L2 报告里没有；今天只有 `apps/api/src/eval/l2-fingerprint.ts` 的 `l2RewriteFingerprint`，且它**只在 persist 时算、整对象直落 `reportJson`、worker 侧没有**，报告本体读不到它。L1 图已建 `L1Repro` + 子路径导出 `@strict-rag/contracts/eval-repro` + 两条稳定哈希的写法，L2 可同构复用（**禁止**另发明一套）。

**判据线（承前两张图）**：PRD **已经写死**的东西（§6.2「零容忍」四句 + 「近指代主题正确且合法作答 ≥ **80%**」+ §8 字段表）在代码里缺，属**实现缺口**，落地属「实现 PRD」；PRD **没写**的东西（零容忍怎么机械化、「主题正确」在没有 judge 时算不算、「session 策略版本」的载体是什么）由本图**裁定**（属实现选择，不是改冻结语义）或**如实记债**。改冻结语义须 ADR → 改 PRD → 升版，**本图不做**。

**成功长什么样**：L2 报告里 —— ① 每条 case 能读出「命中期望文档」与「citation 合法性」的**原料**（docId 集合 + 合法性不变式），不再靠文本猜；② §6.2 四项零容忍**各有可核对的处置**：能机械判的进判定，不能的**显式写成「需人 / 需 judge」并记债**，**不许**造一个形似而语义不同的替代品冒充；③ §8 的 L2 字段有取值或如实 `null`；④ 全部改动**收紧或逐位等价**，且**没有任何一处**因「没测 / mock / 没原料」而变绿。

## Notes

- 域：StrictRAG。**WHAT** 冲突以 `prds/00–11`（`prds/08-quality/02-evaluation-and-gates.md` 现为 **0.4.34**）为准；**IS 以源码为准**，`docs/module-status/` 是镜像，`docs/testing/coverage/` 是派生对照。
- **前图**：[`l1-signoff-evidence`](../l1-signoff-evidence/map.md)（已收口）补了 L1 签字证据面（人工抽检 / 校准打分器 / §8 字段），并在它的 `Not yet specified` **A 段**把「L2 报告的可判定面」整体路由给下一张图；本图即那一段的图。
- **每轮先读**：本图 · `docs/agents/issue-tracker.md` · `docs/agents/domain.md` · `prds/08-quality/02-evaluation-and-gates.md` §6.1 / §6.2 / §8 · `packages/contracts/src/eval/l2-gold.ts` · `packages/contracts/src/eval/l2-matrix.ts` · `apps/api/src/scripts/run-l2-golden.ts` · `apps/worker/src/eval/run-l2-batch.ts` · `apps/worker/src/eval/execute-ask-http.ts` · `apps/worker/src/eval/persist.ts` · 相关包 `docs/module-status/<包>.md`。写代码前读 `.trellis/spec/` 对应包。
- **本图携带执行**（同前两张图）：工单可直接改代码、补测例、回写镜像。同一缺口**禁止**再 `task.py create` 平行实现任务。
- **只在本分支（`main`）**：不建 worktree，不新建分支。
- **门禁**：每收一张工单跑 `pnpm check-types` + `pnpm lint`（零 warning）+ 相关包测试；收口跑全仓 `pnpm test`，且**不得与他人并发跑**（前图实测：并发抢 CPU 会让 web 包超时假红）。测例只进 `<包>/tests/<能力>/<意图>.test.ts(x)`，文件头「目标 / 需求 / 被测 / 简介」必须简体中文，并登记该包 `tests/index.md`。
- **不改仓库默认开关**：`AUTH_ENFORCE` / `DEPT_ACL_ENFORCE` / `DEPT_INHERIT_DOWN` / `RETRIEVE_ES_MODE` / `INGEST_ES_MODE` / `SESSION_REWRITE_ENABLED` / OCR 的默认值一律不动。
- **不改 `prds/00–11`**。
- **质量红线不放宽**：门禁只加严（ADR-046）；**mock 数字禁进签字包**（PRD §6.1 / ADR-061）；本图所有改动必须是**收紧或逐位等价**。
- **本图特有的「不许」**：
  - **不许**把「主题正确」偷换成「文本里出现了期望文档的关键词」——那正是前图拒绝过的「形似而非语义」。有 docId 就按 docId 判；没有就如实记「无判据」。
  - **不许**为让 `computeL2SignoffEligible` 变绿而放宽任何既有条件（它今天是 fail-closed：mock / 缺类 / 缺测 / 零容忍>0 一律 false）；本图只允许**加严**。
  - **不许**给 L2 报告加「来源标记」以外的第二种语义 —— L1 的 `judgeAurocSource` 三态是现成范式，要加就同构，不要另造词。
- **写回纪律（前图教训）**：`docs/module-status/*.md` 正文**不写 `路径:行号`**，也不给裸标识符加反引号（会触发 `check:module-status` 的 `5-表` / `3-符号` 误报）；行号只写在 `.scratch/` 工单与 `.trellis/spec/` 里。
- **前图教训（两条必守）**：① 收口声明必须在**最后一次提交之后**复跑 `pnpm check:module-status`，且 `1-路径` / `6-联动` / `7-时效` 三类须为空（基线 **39 条 = 2 env + 13 符号 + 24 表**）；② 回写要带**对抗性反向复核**（逐条核「这话在源码里真能指到吗」）。
- **本机限制**：无浏览器 → admin / web 视觉改动不在本图；真模型 live 跑数 / 真 ES / 真 PG 迁移 / Docker / 人签也不在。
- **成果预期**：本图预期**不新增迁移、不新增表、不新增 HTTP 端点**（前图同裁）；只新增报告字段、纯函数、CLI/内口透传与测例。

### 开工基线（2026-09-23 · 逐条核过源码）

| 处 | 今天的样子 |
|---|---|
| PRD §6.2 零容忍（原文） | 「**零容忍（任一即 L2 失败）**：主题粘连胡答、**历史文本**进 evidence/`min_support`、冲突场景跟错数字、合法路径跳过 verify」（`prds/08-quality/02-evaluation-and-gates.md` §6.2） |
| PRD §6.2 阈值（原文） | 「近指代主题正确且合法作答 ≥ **80%**；零容忍项 = **0**」；规模「建议 **30～50** 条」（代码取实现下限 `L2_SIGNOFF_MIN_CASES = 15`） |
| 零容忍落地 | **仅 1 / 4**：`historyLeaked`（`packages/contracts/src/eval/l2-matrix.ts`），只比先前**用户**轮原文；`min_support` 未比；另三项无机械判据 |
| `min_support` | L2 两侧**都不采集**（`run-l2-batch.ts` 的结果形状无此字段；api CLI 也没读 `graph.minSupport`），而 L1 侧有 `parseMinSupport` 可复用 |
| 采集面 | api CLI：`(graph.evidence_snapshot ?? []).map((e) => e.text ?? '')` —— **`docId` 就在同一个对象上，被丢掉**；worker：`createEvalHttpL2Execute` 只读 `evidenceTexts`，**而同一回包里的 `evidenceDocIds` 与 `citationCount` 它不读**（L1 的 `createEvalHttpExecute` 两个都读） |
| `docId` 可得性 | `apps/api/src/graph/state.ts` 的 `evidence_snapshot?: GraphEvidence[]` **带 `docId`**；`apps/api/src/services/ask/execute.ts` 的 `toEvidenceSnapshot` 也在取 `docId` → **`docId` 两侧都可得，纯属没取** |
| 「命中期望文档」判据 | `packages/contracts/src/eval/l1-matrix.ts` 的 `hitAtKCase(expectedDocIds, evidenceDocIds)` **已存在**，L1 在用；L2 侧的 `expectedDocIds` 在 `l2-gold.ts` 里**已解析**（`L2Case.expectedDocIds`），**但全仓没有任何消费者**。**致命前置**：夹具写的是**逻辑 id**（`l2-corpus/travel-stay` / `ingest-samples/01-doc`），而 `evidence.docId` 是 `documents.id`（uuid v7）；`documents` 表**无 `external_id` 或等价列**，`fixtures/l2/corpus/*` 三篇**从未入库且无入口**（`scripts/demo-ingest.mjs` 只吃 `fixtures/ingest-samples`）→ **照搬 `hitAtKCase` 只会得到恒 0（`false`，不是 `null`）** |
| citation 合法性 | L1 侧 `citationCompleteRate`（= `answerKind='knowledge' ∧ answered ∧ citations>0`）钉的是图内不变式（结构性 1 或 null）；L2 侧**无对应物**，`citations` 在 api CLI 手上、`citationCount` 在 worker 回包上，**都没读** |
| 近指代率 | `l2NearCorefPassRate` = `near_coref ∧ verdict='pass'` 比例（分母含 `error`，分母 0 → `null` → 不放行）；**不含主题正确、不含合法 citation**（源码注释已如实写明残余） |
| `signoffEligible` 公式 | `computeL2SignoffEligible`：`live ∧ 九类齐 ∧ 零容忍=0 ∧ 题量≥15 ∧ 近指代率≥0.8`，缺测一律 false（fail-closed，**只能加严**） |
| §8 L2 字段 | 「L2 剧本集哈希」「session 策略版本 / rewrite prompt 版本」在 L2 报告里**都不存在**；只有 `l2RewriteFingerprint(prompt, modelId)`（sha256），落点是 `buildL2EvalRunInsert` 的 `reportJson.l2Fingerprint`（整对象直落，**报告本体没有**），worker 侧无 |
| `l2Fingerprint` 在 worker 会丢 | `apps/worker/src/eval/persist.ts` 的 `saveL2Report` 用**逐键白名单**（`run_type`…`kbId`），**不含任何指纹键** → api 侧整对象直落、worker 侧白名单逐键，**不同构**（前图已踩过一次同类坑） |
| L1 可复用的哈希写法 | `@strict-rag/contracts/eval-repro` 子路径导出的 `l1QuestionIdsHash`（题面 id 集合，内部升序）/ `l1CalibSetHash`（文件内容逐字节）；子路径导出是因为 contracts 主入口会被 web/admin 客户端打包，`node:crypto` 进客户端图会让 Next 构建失败 |
| `repro` 未透 DTO | `L1Repro` 刻意没进 `…/eval/runs` 的 DTO（前图记债）—— L2 侧同理须先裁要不要透 |
| 既有 L2 测例 | `packages/contracts/tests/eval/l2-matrix.test.ts` · `l2-near-coref-rate.test.ts` · `apps/api/tests/eval/l2-cli.test.ts` · `l2-gold.test.ts` · `l2-fingerprint.test.ts` · `l2-near-coref-rate.test.ts` · `apps/worker/tests/eval/run-l2-batch.test.ts` · `run-l2-batch-near-coref-rate.test.ts` · `consumer.test.ts`（内含 L2 分支） |
| 夹具债 | `fixtures/l2/gold.yaml` **18 条** case（**全部**带 `expectedDocIds`，共 25 个逻辑 id）；`near_coref` **只有 3 条** → 80% 只能取 0 / 33.3 / 66.7 / 100%，该门今天等价于「3/3 全过」；规模 18 < PRD「建议 30～50」（代码下限 15，余量仅 3 条） |
| 上轮 assistant 文本进 evidence | **结构上不可能**：`apps/api/src/graph/run.ts` 的 `evidence` 是唯一写点，正文全部来自 retrieve 的 KB chunk；会话窗只进 `rewriteUserPrompt`。故今天的 `historyLeaked` 抓的是「**语料撞词**」（夹具问句恰好出现在 chunk 正文里），不是「图把聊天当证据」 |
| `evaluateL2Stale` | 只有 `obs/index.ts` 再导出与两个测试文件引用，**无任何生产调用点** → 改 `l2Fingerprint` 不会连带打红 `l2-stale.test.ts` |

## Decisions so far

<!-- 索引：一条已收工单一行，够判断相关性即可，细节放大进链接 -->

- [研究：L2 报告的可判定面今天到底缺什么、有哪些可复用形状](./issues/01-research-l2-evidence-sources.md) — 研究子代理产出（明细 53.6 KB 在 [research/01-l2-evidence-sources.md](./research/01-l2-evidence-sources.md)）。要点：① **最关键的硬结论：「按 `expectedDocIds` 判命中」今天不成立** —— 夹具写逻辑 id、真跑 `docId` 是 `documents.id`（uuid v7），`documents` 表**无 `external_id`**、`fixtures/l2/corpus/*` **从未入库且无入口**、worker 通道丢 `evidenceDocIds` → 照搬 `hitAtKCase` 只会得到**恒 0**（`false` 而非 `null`）。② `expectedDocIds` **全仓零消费者**；夹具实测 **18 条**（非 20）全部带 id，共 25 个逻辑 id，`near_coref` 仅 3 条。③ **采集面的真断点在 worker 类型**：内口**早已在**下发 `evidenceDocIds` / `citationCount` / `answerKind` / `minSupport`（`routes/eval.ts`），`createEvalHttpL2Execute` 只读 5 / 9 键；api 侧 `run-l2-golden.ts` 的 `e.docId` 就在 `e.text` 旁边。④ **上轮 assistant 文本进 evidence 结构上不可能**（`graph/run.ts` 的 `evidence` 是唯一写点、正文来自 retrieve）；今天的 `historyLeaked` 抓的是**语料撞词**，不是「图把聊天当证据」→ 把它当已覆盖的零容忍是自欺。⑤ `min_support` 维度无量（`AskGraphResult` 不含 claims）；另三项零容忍**均无判据原料**。⑥ `l2RewriteFingerprint` **≠ 剧本集哈希**（它算 prompt+modelId）；session 策略 / rewrite prompt 版本**全仓无载体**。⑦ 回归面比预期小：加必填报告字段只打红**一处**报告字面量（`l2-cli.test.ts` 的 `sampleReport()` + 3 个 `it`），worker 侧零处；**真正的爆炸面是改 `AskGraphResult` / `ExecuteAskResult`**。⑧ `evaluateL2Stale` **无任何生产调用点**；落库的 evidence 快照**无正文**（`EvidenceSnapshotItem` 无 `text`）→ 不能从 `ask_traces` 反推泄漏，必须在活体回合里采。
- [裁定：L2 三腿证据面各落到什么形状](./issues/02-dec-l2-ruling.md) — 主控裁定，**两条总原则**：只补「可核对原料 + 真钉得住的判据」；判不出来的一律记债、不许造形似代理。**采集面**：两侧补 `docId` / `citations.length` / `answerKind`（内口本就在发，断点在 worker 类型），三层同名字段 + 跨侧同构测例；「命中期望文档」**只落报告、绝不进 `signoffEligible`**（PRD §6.2 没有这个门 + 今天恒 0 → 加进去就是第二个恒 false 空转闸），落 `docHitRate` / `docHitHits` / `docHitScored`，并把「未映射时恒 0 不得当成绩」写进 md / spec / README + 加护栏测例（照抄 L1 的 `l1-hit-at-k.test.ts` 形状）；「合法 citation」复用 `citationCompleteRate` 记率 + 行级三态 `citationOk`，**不改任何既有 case 判词**（`false` 不进 `failReasons`）。**零容忍**：「历史文本进 evidence」**不扩到 assistant 观测文本**（assistant 合法答案本就逐字引库 → 会假红），改为把「evidence 只来自 retrieve」的**图上不变式钉成测例**；`min_support` 半句**不可判记债**（图不含 claims）；另三项（主题粘连 / 冲突数字 / 跳过 verify）**一律记债、不造代理**；但报告加 `zeroToleranceCoverage` 区块逐条声明四项的处置档位（`mechanical` / `debt`）—— 这是本图对「可核对」最直接的贡献。**§8**：新增 L2 可复现区块（`l2GoldSetHash` 用 `l1QuestionIdsHash` 同款写法取真值；`sessionStrategyVersion` / `rewritePromptVersion` 无载体 → `null` + 记债），**必须走子路径导出**并以 `pnpm build` 实证；`l2Fingerprint` **保持原样不动**（语义不同）；worker `saveL2Report` 白名单**同步加键 + 补同构测例**；区块**不透 DTO**（同前图 L1 侧）。**统一纪律**：不新增迁移 / 表 / 端点 · 收紧或逐位等价 · `signoffEligible` 公式与取值域**一字不动** · 夹具 18 条**一字不动**。**三句硬话**：`docHitRate` 恒 0 是今天的正确取值 · 两侧同构必须用测例钉 · **禁止**改 `AskGraphResult` / `ExecuteAskResult`（真正的爆炸面）。

## Not yet specified

<!-- 收口后再填：本图没做到、但仍在目的地方向上的雾 -->

- **「主题粘连胡答」的机械判据**（裁定票 02 已定为**债**，此处留的是「将来怎么机械化」）：判它需要「本轮该答什么主题」的机器可读表示。今天最接近的原料是 `L2Case.expectedDocIds`（18 条全有）与 `expected.themePersist`，但 `themePersist=false` 的题（topic_switch / no_session）本来就**不该**命中上轮主题，语义是反的。能否用「命中 `expectedDocIds` 但 `themePersist=false` 时不得命中上轮主题文档」这类交叉约束表达，须先解决 id 映射。
- **「冲突场景跟错数字」的机械判据**（已定为**债**）：`kb-conflict-*` 的 rubric 写了具体数字（800 / 200），库里是 600 / 120，但**数字在 rubric 自由文本里，不是结构化字段**。要机械化得先给夹具加结构化字段 → 属「先裁再动」，且改夹具会动既有断言。
- **「合法路径跳过 verify」的机械判据**（已定为**债**）：`debug` 只有 `llmCalls` / `retrieveCalls` / `route_*` / `evidenceCount`，**无 purpose 维度** → 「这轮到底跑没跑 verify」在图上是不可观测的。
- **`min_support` 那个方向**（已定为**债**）：`AskGraphResult` 不含 claims，`min_support` 只是 `Math.min(...scores)` 一个数值 → 「历史文本被当 claim 送进 verifier」不可观测。销账需要图上先透出 claims 或 claim 来源标记。
- **「合法 citation」要不要进 L2 的闸**：本图只把它记成率（`citationComplete`）与行级三态，**没进 `signoffEligible`**（L2 没有 ADR-046 绑定，闸的构造面无先例）。它是不是 PRD §6.2 近指代那行「合法 citation」的硬门组成部分，须 PRD 澄清。
- **逻辑 id → `documents.id` 映射**：本图**没有**做（属数据工程：要真 PG + 给 `fixtures/l2/corpus/*` 一个入库入口，`documents` 表也没有 `external_id`）。L1 侧同缺。这是 `docHitRate` 恒 0 的根因。
- **L2 报告要不要来源标记**：L1 有了 `judgeAurocSource` 三态；L2 今天只有 `computeL2SignoffEligible` 里的 `retrieveMode === 'live'` 一处。是否要另加「近指代主题正确率来源 = judge / 人 / 缺测」这类标记，取决于上面第一条。
- **`repro` / 新字段要不要透 DTO**：`EvalRunSchema` 是 `.strict()`，透出即扩契约面；前图 L1 侧刻意没透，本图 L2 侧同裁。何时透出待定。
- **夹具本身是债**：`near_coref` 3 条 vs PRD「建议 30～50」、总数 18 条（下限 15 的余量只剩 3 条）；扩集须真语料与人，不挡本图的机械面。
- **`contextMode` / `lifecycleFilterVersion` / `sessionStrategyVersion` 的「版本载体」**（承前图 B 段）：L1 侧已记债为恒 `null`；L2 侧同题，销账需要**先有载体**或 PRD 明确载体。

## Out of scope

- **真模型 live 跑数与真 judge 打分**：不能离线核对；只做到「纯函数级可断言 + 路径可走通」。
- **L2 准出人签**（业务 R + 产品 A）：本图只保证「人签前该有的证据面在」，不代签；`computeL2SignoffEligible` 即使全真也**≠** L2 准出 PASS。
- **改 `prds/00–11` 已冻语义**：包括给 §6.2 零容忍加项、改 80% 阈值、改「建议 30～50」、改 §8 字段表。
- **`§6.0` 运行时从签字包加载 τ**：与 ADR-007「`TAU_CLAIM` 唯一源」冲突，属改冻结语义（须 ADR → 改 PRD → 升版）；前图已划出，本图不碰。
- **默认开 `session` / 打开 rewrite**：L2 未过即**不准出**（PRD §6 分层表）；本图不碰任何默认开关。
- **真 PG / 真 ES / Docker / 真 RustFS / 真 Langfuse**：本机无基础设施。
- **admin / web 的视觉与交互改动**：本机无浏览器验证手段。
- **`check:module-status` 工具的 `3-符号` / `5-表` 误报修复**：属工具债，前图已记；本图只保证不踩。
- **P2.5 准出 / 永久关二元出口 / P3a Full 图**：须 L2 归档 + 人签。
