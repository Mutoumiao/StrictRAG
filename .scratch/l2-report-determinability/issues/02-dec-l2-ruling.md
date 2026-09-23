# 裁定：L2 三腿证据面各落到什么形状

Type: grilling
Status: resolved
Blocked by: 01

## Question

研究票 01 的事实到位后，把三腿各**裁成可执行的形状**，好让工单 03 / 04 / 05 只做落地不做选择：

1. **采集面**：
   - `docId` 走哪条路进两侧（api CLI 直接读 `graph.evidence_snapshot[].docId`；worker 从 `ExecuteAskJson.data.evidenceDocIds` 读）？两侧的**结果形状**怎么改才能同构（`L2TurnExecuteResult` 加 `evidenceDocIds`？还是加整个 items 数组）？
   - 「命中期望文档」进不进 `L2BatchReport` / `L2Report`？进的话是什么形状（每条 case 一个 bool + 整批一个率？还是只落实测集合让下游自己算）？
   - 「合法 citation」要不要落机械判据？若要，判据是复用 L1 的 `answerKind='knowledge' ∧ answered ∧ citations>0`，还是 L2 无 `answerKind` 时改用别的（或**如实记为不可判**）？
   - 关键前置：若研究票查明 **fixture 的 `expectedDocIds` 与真跑 `docId` 对不上**，则本腿是「补了原料但判不出命中」——此时裁定是「补原料 + 如实标不可判」还是「先不补」。必须给出依据。

2. **零容忍**：四项逐项裁定落到 **① 机械进判定 / ② 机械记报告但不进判定 / ③ 如实记为「需人 / 需 judge」并记债** 三档中的哪一档，各给理由与 PRD 依据。
   - 「历史文本进 evidence」扩宽到上轮 assistant 文本 —— 改还是不改？若研究票查明「structural上不可能」（evidence 只可能来自 KB chunk），则裁定为「保持现状 + 把不变式写成测例钉住」还是「加纵深防御」。
   - `min_support` 这一半比不比？PRD 写「历史文本进 evidence/`min_support`」，`min_support` 是数值不是文本集合 —— 这句话在 PRD 里到底指什么（研究票给事实，主控给裁定）。
   - 「主题粘连胡答」`themePersist` 交叉约束这个方向**接不接受**？不接受的话如实记什么债。
   - 加严后 `computeL2SignoffEligible` 的**新公式原文**写出来（含 reason/标记名），并给出「旧为真集合 ⊇ 新为真集合」的论证。

3. **§8 L2 字段**：
   - 「L2 剧本集哈希」用哪条既有哈希写法、算什么（id 集合 / 文件内容）、放哪个键、进报告还是只进 `reportJson`。
   - 「session 策略版本 / rewrite prompt 版本」今天有没有载体？没有 → 写 `null` + 记债（**禁止**拿源码文本哈希顶替，前图已定此纪律）。
   - 新增区块走**子路径导出**还是进 `index.ts`（取决于研究票对 `node:crypto` 客户端图路径的核证）。
   - `l2Fingerprint` 要与新字段**合并**还是**并存**？`persist.ts` 白名单要不要同构补齐（两侧不同构是前图踩过的坑）。
   - 新字段要不要透 `…/eval/runs` 的 DTO（`EvalRunSchema` 是 `.strict()`）？透 / 不透各给后果。

4. **统一纪律**（每条都要回答「是 / 否 + 一句话」）：
   - 是否**不新增迁移 / 不新增表 / 不新增 HTTP 端点**？
   - 是否所有改动**收紧或逐位等价**？
   - 默认配置下 `computeL2SignoffEligible` 是否**仍为 false**（不得为变绿而放宽）？
   - 夹具（`fixtures/l2/gold.yaml`）是否**不动**？若必须动（例如为「冲突跟错数字」加结构化字段），动哪几条、为什么、是否属「先裁再动」。

## Answer

研究明细见 [research/01-l2-evidence-sources.md](../research/01-l2-evidence-sources.md)。主控裁定如下。**两条贯穿全图的总原则**：① **只补「可核对的原料 + 真钉得住的判据」**；② **判不出来的一律如实记为债，不许造形似代理**（前图同纪律）。

### 一、采集面：补原料，但「命中期望文档」**不进任何判定**

**裁定 1 · 原料两侧都补，且都补的是「本来就在手边的东西」。**
- api CLI（`apps/api/src/scripts/run-l2-golden.ts`）：`graph.evidence_snapshot` 已是对象数组，除 `e.text` 外**同时**取 `e.docId`；另取 `graph.citations.length` 与 `graph.answerKind`。
- worker（`apps/worker/src/eval/run-l2-batch.ts` + `execute-ask-http.ts`）：内口 **本来就在下发** `evidenceDocIds` / `citationCount` / `answerKind` / `minSupport`（`apps/api/src/routes/eval.ts` 的 `ok(c, {...})`），`createEvalHttpL2Execute` 没读。**断点在 worker 的类型定义**（`L2TurnExecuteResult` 无这几个键）→ 扩 `L2TurnExecuteResult` 与 `L2BatchCaseRow` / `L2Report` 的行形状。
- **两侧同构是纪律不是类型**：`L2CaseRow` / `L2BatchCaseRow` / `L2TurnExecuteResult` 是三份手抄。必须在三层各加同名字段，并补一条**跨侧同构测例**（前图踩过「worker 逐键白名单静默丢弃」的坑）。

**裁定 2 ·「命中期望文档」只落**报告**，绝不进 `computeL2SignoffEligible`。**
- 理由有两条，任一独立成立：① **PRD §6.2 没有「命中期望文档」这个门**（近指代那行写的是「主题正确且合法作答 ≥80%」），加进去就是**发明一个 PRD 没有的门**；② **今天它恒 0**（夹具逻辑 id vs `documents.id` uuid，且 `fixtures/l2/corpus/*` 从未入库、`documents` 无 `external_id`）→ 加进去就是**第二个「恒 false 空转闸」**，正是前图明令禁止的形状。
- 落法：每条 case 落 `expectedDocIds`（夹具原样）与 `evidenceDocIds`（实测），整批落一个率 `docHitRate` + `docHitHits` + `docHitScored`（分母 = 有非空 `expectedDocIds` 的题数；分母 0 → `null`）。命名与 `l1-matrix` 的 `hitAtK*` 一族同风格，但**用独立名字**避免与 L1 的硬门语义混淆。
- **恒 0 必须显形**：报告 md 渲染要在该率旁写明「**未映射时恒 0，不得当成绩**」；`.trellis/spec/` 与 `fixtures/l2/README.md` 同写；并**加一条护栏测例**（形状照抄 L1 已有的 `packages/contracts/tests/eval/l1-hit-at-k.test.ts`：逻辑 id 与 KB uuid 只有 trim 后逐字全等才算命中 · 未映射不算命中且不抛错）。**不许**为了让它好看而做模糊匹配或子串匹配。

**裁定 3 ·「合法 citation」落成率 + 行级三态，**不改**任何既有 case 判词。**
- 复用 L1 的现成纯函数 `citationCompleteRate`（`packages/contracts/src/eval/l1-matrix.ts`，分子 = `answerKind='knowledge' ∧ outcome='answered' ∧ citations>0`，分母 = `answerKind='knowledge' ∧ outcome='answered'`，分母 0 → `null`）。L2 报告落 `citationComplete` + `citationCompleteDen`。
- 行上落**三态** `citationOk: true | false | null`：`null` = 未下发（**不得**当成「有引用」变绿，也**不得**当成「无引用」把既有用例拉红）；`false` = 明确无引用。
- **不把 `citationOk === false` 加进 case 的 `failReasons`**：那会翻掉既有注入式 stub（它们手写 `answerKind: 'knowledge'` + `citations: []`，本身违反图内不变式，但改它们等于顺手改期望值）。L1 侧同样不把该率塞进 `computeSignoffEligible` —— 本图与 L1 保持同款语义：**记率、不判词**。
- 该率**不进** `signoffEligible`：L2 没有 ADR-046 绑定，「率要不要进闸」须 PRD 澄清近指代那行的「合法 citation」是不是硬门的一部分 → **记债**（写进 `Not yet specified`）。

### 二、零容忍四项：三项记债、一项扩宽为不动

**裁定 4 ·「历史文本进 evidence」——**不扩到 assistant 观测文本**，改为把图上不变式钉成测例。**
- **不扩的理由**（要写进 spec）：`assistant` 的合法答案**本来就会逐字引用 KB 正文**，把「上轮 assistant 答案文本 ≤ evidence 正文」当泄漏判据会产生**假红** —— 把合法行为判成零容忍。这违反「不许把形似判据冒充机械判据」。今天 `historyLeaked` 比对的是**夹具里的用户问句**，它抓的是「语料撞词」这一种真故障，**保留不动**。
- PRD 那半句（「历史文本进 evidence」）的**真机械对应物是图上不变式**：evidence 只能来自 retrieve。落地 = 加**测例钉住**：`apps/api/src/graph/run.ts` 的 `evidence` / `evidence_snapshot` 是唯一写点、正文来自 retrieve 的 KB chunk、会话窗只进 `rewriteUserPrompt`。谁把会话原文塞进 evidence（或给 `evidence_snapshot` 开第二个写点）就红。
- **`min_support` 那半句：不可判，记债。** `AskGraphResult` 不含 claims，`min_support` 只是 `Math.min(...scores)` 一个数值 → 「历史文本被当 claim 送进 verifier」在今天的图上是**不可观测**的。**不许**用「`minSupport` 为 0 即泄漏」这类代理充数。

**裁定 5 · 另三项（主题粘连胡答 / 冲突场景跟错数字 / 合法路径跳过 verify）一律记债，不进判定、不造代理。**
- 缺什么要写清：主题无机器可读字段（`expected.themePersist` 只有期望值、无实测值可比）；冲突数字只在 `rubric` **自由文本**里（`kb-conflict` 两条的 800 / 200 与库里 600 / 120 都是散文）；「是否 verify」无布尔（`debug` 只有 `llmCalls` / `retrieveCalls` / `route_*` / `evidenceCount`）。
- **给夹具加结构化字段属「先裁再动」，本图不做**（改夹具会动既有断言，且属改冻结资产形状）。

**裁定 6 · 四项的「处置档位」必须机器可读地写进报告。**
- L2 报告加一个 `zeroToleranceCoverage` 区块，按 PRD §6.2 的四项逐条声明 `judged: 'mechanical' | 'debt'` 与（mechanical 时）命中数。今天的预期取值：`historyInEvidence = mechanical`（保留原探针口径，**并在区块里注明它判的是「语料撞词」这一种**）；其余三项 `debt`。
- 这一条是本图对「可核对」最直接的贡献：**读报告的人不必再靠文档纪律去猜哪几项真判了**。

### 三、§8 的 L2 侧字段

**裁定 7 · 新增 L2 可复现区块，键名与 `L1Repro` 同风格，走子路径导出。**
- `l2GoldSetHash`：**真值可算** —— 复用 `@strict-rag/contracts/eval-repro` 的 `l1QuestionIdsHash` 形状（id 集合 trim → 去空 → 升序 → `JSON.stringify` → sha256）；L2 case id 受 `/^l2-[a-z0-9-]+$/` 约束、稳定。**不另发明哈希**。
- `sessionStrategyVersion` / `rewritePromptVersion`：**全仓无载体**（`SESSION_REWRITE_ENABLED` 只是布尔，KB 侧只有 `SessionRewriteLock`，prompt 是内联字符串）→ 一律 `null` + 记债。**禁止**拿源码文本哈希顶替（前图已定此纪律：会随任意重构噪声跳变）。
- **必须子路径导出**（新子路径或复用 `eval-repro`），理由同前图：contracts 主入口会被 web/admin 客户端打包（`transpilePackages`），`node:crypto` 进客户端图会让 Next 构建失败。**要用 `pnpm build` 实证**。
- `l2Fingerprint`（`l2RewriteFingerprint(prompt, modelId)`）**语义不同**（prompt+model 指纹，不是剧本集哈希）→ **保持原样不动**，不做「合并」也不改名（改名/搬家会动 `l2-cli.test.ts` 与 `obs/l2-stale` 的既有断言）。
- **两侧同构**：新区块落 `L2Report` 本体（api 的 `buildL2EvalRunInsert` 是 `{...report}` 直落，自动带上），worker 的 `saveL2Report` **必须同步加键** —— 它是手写 13 键白名单，加字段**静默丢弃且零测试红**，故须补一条「白名单不缺新键」的测例。
- 新区块**不透** `…/eval/runs` 的 DTO（`EvalRunSchema` 是 `.strict()`；与前图 L1 侧同裁）→ 记债。

### 四、统一纪律（逐条回答）

| 问 | 答 | 依据 |
|---|---|---|
| 不新增迁移 / 表 / HTTP 端点？ | **是** | 本腿全是纯函数 + 报告字段 + 内口透传 |
| 所有改动收紧或逐位等价？ | **是** | 唯一可能改判词的是 `citationOk`，而裁定 3 明确它**不进** `failReasons` → 既有 case verdict 逐位不变；新增字段全是加字段 |
| 默认配置下 `computeL2SignoffEligible` 仍为 false？ | **是** | 本图**不新增**任何合取项到 `signoffEligible`（裁定 2 / 3 明确排除）；它的公式与取值域一字不动 |
| 夹具（`fixtures/l2/gold.yaml`）不动？ | **是** | 18 条 case / 25 个逻辑 id 一字不动（裁定 5）。夹具债（`near_coref` 只 3 条、规模 18 < 建议 30～50）如实留在雾里 |

### 五、给落地票的三句硬话

1. **`docHitRate` 恒 0 是今天的正确取值**，不是 bug。落地时**不许**为了让这个数字非 0 而改夹具、改 id 体系或做模糊匹配 —— 那一步要真入库 + 映射，属数据工程，不在本图。
2. **两侧同构必须用测例钉**，不能靠「我抄了一份」。worker 的逐键白名单与手写类型不会告警。
3. **报告字面量只剩一处要改**：`apps/api/tests/eval/l2-cli.test.ts` 的 `sampleReport()`（连带 3 个 `it`）。worker 侧零处。**真正的爆炸面是改 `AskGraphResult` / `ExecuteAskResult`** —— 本图**禁止**改这两个类型（一批测试手写 `evidence_snapshot: []`）；一切改动都从 L2 自己的 `L2TurnExecuteResult` 与 L2 报告类型出发。
