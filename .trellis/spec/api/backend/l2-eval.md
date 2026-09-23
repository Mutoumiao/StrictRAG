# api · L2 多轮题面 + 工程 runner（P2.5-L2 / P2.5-L2R / P2.5-L2P）

> 路径：`apps/api/src/eval/l2-gold.ts` · `apps/api/src/scripts/run-l2-golden.ts` · 仓根 `fixtures/l2/`  
> 产品语义：`prds/08-quality/02-evaluation-and-gates.md` §6.2 · 剧本 **J-P2.5**  
> 任务：`08-15-p25-l2-gold-min`（题面）· `08-16-p25-l2-runner-min`（runner）· `08-16-p25-l2-persist-min`（账本）  
> **本窗状态**：题面草案 + 纯函数加载 + **工程 runner** + **HTTP 入队 `session_multiturn`** + worker 多轮窗 + admin `/eval` 入队/回读；`signoffEligible` 为工程公式（live ∧ 九类齐 ∧ 零容忍机械项=0 ∧ ≥15；mock 必 false）。**仍无** 准出、**无** 人签。  
> 图边 `session_load`/`rewrite` 已由 **P2.5-RW** 落地，**默认仍关**（dogfood 可开）。**无合格归档不得写产品默认开**。**runner / persist / 图边 / HTTP 入队 ≠ L2 准出**。

---

## 双轨门禁

| 轨 | 含义 | 何时算「绿」 | **禁止**宣称 |
|----|------|--------------|--------------|
| **工程绿** | gold 形状/覆盖 + runner 注入测 | `tests/eval/l2-gold.test.ts` + `tests/eval/l2-cli.test.ts` 通过；9 类齐全；≥15 条 | 「L2 准出 PASS」 |
| **准出 PASS** | 产品/质量门禁（**非本窗**） | 真跑归档 + 零容忍=0 + RACI 人签 | 把草案条数 / mock 报告写成通过 |

**Wrong**：PR 全绿 → 路线图勾「L2 已过」或把仓库默认改为 `SESSION_REWRITE_ENABLED=true`。  
**Correct**：PR 工程绿 = 题面可版本化 + CLI 可注入跑；图边可 dogfood；准出另开人签 + 语料入库。

---

## 1. Scope / Trigger

- Trigger：改 L2 gold 形状、类型枚举、加载不变量、fixtures/l2 文档、批跑 CLI。
- 目标：可版本化的多轮剧本账本 + 纯校验 + 可注入的串行 runner + 可选 `eval_runs` persist。
- **非目标**：把 persist / 工程 `signoffEligible=true` 当准出 PASS、ADR-046、主题 LLM judge、把仓库 rewrite **默认**打开、宣称准出、L2 剧本 CRUD 进 `gold_questions`。

---

## 2. Signatures

| 符号 | 位置 | 说明 |
|------|------|------|
| `L2_TYPES` | `eval/l2-gold.ts` | 9 类只读元组 |
| `loadL2Gold(path)` | 同上 | 读 JSON 形 gold；失败抛 `L2GoldLoadError` |
| `l2TypeCoverage(cases)` | 同上 | `{ present, missing }`；测钉 `missing=[]` |
| `defaultL2GoldPath()` | 同上 | `<repo>/fixtures/l2/gold.yaml` |
| `nextSessionId` / `acceptHit` / `historyLeaked` | `scripts/run-l2-golden.ts` | 分配 / 末轮机械分 |
| `hitAtKCase` / `emptyHitAtK` / `accumulateHitAtK` / `hitAtKRate` | contracts `eval/l1-matrix.ts` | docHit 逐题判据与整批率；**直接复用**，禁另写口径 |
| `l2CitationOk` / `l2CitationComplete` | contracts `eval/l2-matrix.ts` | 合法 citation 三态 / 整批率（后者复用 L1 `citationCompleteRate` 与同一分母谓词） |
| `l2ZeroToleranceCoverage` / `L2_ZERO_TOLERANCE_ITEM_KEYS` / `L2_ZERO_TOLERANCE_PLACE_KEYS` | 同上 | PRD §6.2 四项零容忍的**处置档位区块**（`mechanical` / `debt`，两侧同源）；见下方「零容忍四项的处置档位」 |
| `L2_EVIDENCE_REPORT_KEYS` / `L2_EVIDENCE_ROW_KEYS` | 同上 | L2 报告自有键的同构锚点（采集面 + 零容忍区块 + 可复现区块）/ 行级名单（同构唯一锚点） |
| `l2GoldSetHash` / `emptyL2Repro` / `L2Repro` | contracts `eval/l2-repro.ts`（子路径 `@strict-rag/contracts/eval-repro-l2`） | §8 L2 侧可复现区块（三键）与其哈希纯函数；见下方「可复现区块：`repro`」 |
| `runL2Golden(opts)` | 同上 | 串行批跑 + 进程内窗；可注入 `execute`；`persistEval?` |
| `buildL2EvalRunInsert` | 同上 | 纯映射：`runType=session_multiturn` · `signoffEligible='0'` · `matrix*=0` · `coverage=null` · `reportJson.l2Fingerprint`（prompt+model；**≠** 准出） |
| `l2RewriteFingerprint` | `eval/l2-fingerprint.ts` | SHA-256 hex（prompt + NUL + modelId）；不要把窗/问句/evidence 算进去 |
| `persistL2EvalRun` | 同上 | insert `eval_runs`；**禁止**调用 L1 `persistEvalRun`（会写死 `golden_2x2`） |
| `writeL2Report` | 同上 | `artifacts/l2-last-run.json` + `.md` |
| `parseL2CliEnv` | 同上 | `L2_KB_ID` 缺 / 非法 `L2_MAX_CASES` → exit 2 |

批跑 **必须** `skipTrace: true`；窗用 `clipSessionWindow` 注入 `loadSessionWindow`，**不**读 `ask_traces`。  
**禁止**把加载器塞进 `run-l1-golden.ts`；**禁止**把 runner / persist / `l2Fingerprint` 当准出。

`persistEval === true` 或（未显式 false 且 `L2_PERSIST_EVAL` 为 `1`/`true`）才写库；默认关。写完文件报告后再 persist；失败上抛（CLI exit 1）。`signoffEligible` = `computeL2SignoffEligible`（live ∧ 九类齐 ∧ 零容忍机械项=0 ∧ ≥15）；**仍 ≠ 人签 / ≠ 准出**。  
HTTP：`POST …/eval/runs` `{ runType: 'session_multiturn' }` 入队 `sr-eval`（不读 `gold_questions`）；worker 进程内窗 + 内口 `execute-ask`（可带 `sessionId`/`sessionWindow`）。  
persist 的 `reportJson` **可带** `l2Fingerprint`（当前 `rewriteSystemPrompt()` + 注入 `rewriteModelId`，默认 `''`）供 L2 过期告警比对；**有指纹 ≠ 准出**。旧行缺指纹视为无法比对，不抛错。

---

## 3. Contracts

### Gold 根对象（`fixtures/l2/gold.yaml`）

扩展名 `.yaml`，内容合法 JSON；**零 yaml 依赖**。

| 字段 | 约束 |
|------|------|
| `version` | 必须 `1` |
| `run_type` | 必须 `session_multiturn`（禁 `golden_2x2`） |
| `signoffEligible` | 必须 `false` |
| `cases` | 非空数组；本窗 seed **≥15** |

### Case / Turn 不变量（加载器强制）

| 条件 | 规则 |
|------|------|
| `id` | `/^l2-[a-z0-9-]+$/`；文件内唯一 |
| `type` | 九类之一 |
| `turns` | ≥1；每轮 `role=user`、`text` 非空、`session∈same\|new\|none` |
| `type≠no_session` | `turns.length≥2` |
| `type=no_session` | 每轮 `session=none`；`expected.rewriteUsed=false` |
| `type=session_isolation` | 至少一轮 `session=new` |
| `expected.historyInEvidence` | 必须 `false`（历史 ≠ evidence） |

`jScenario` 可选：`J1` / `J2` / `J2x` / `J3` / `J4` / `J5` / `J6` / `J8`。  
本窗 seed 至少覆盖 **J2 / J2x / J3 / J4 / J5 / J6 / J8**。

### 零容忍

主题粘连胡答 · 历史进 evidence/`min_support` · 冲突跟错聊天数字 · 合法路径跳过 verify。  
runner **只机械钉**「先前用户轮全文不得出现在末轮 `evidence_snapshot[].text`」；`themePersist` **不**自动判。  
四项里「哪几处真判了、哪几处只是记债」由报告的 `zeroToleranceCoverage` 区块逐条声明 —— 见下方「零容忍四项的处置档位」。

---

### 近指代通过率（2026-09-23 起进工程公式）

`computeL2SignoffEligible` = live ∧ 九类齐 ∧ 零容忍机械项=0 ∧ `caseCount` ≥ 15 ∧ **近指代通过率 ≥ 0.8**（`L2_NEAR_COREF_PASS_MIN`，出处 `prds/08-quality/02-evaluation-and-gates.md` §6.2）。

- **口径**：`l2NearCorefPassRate(rows)` = `type='near_coref' ∧ verdict='pass'` 的行数 ÷ **全部** `near_coref` 行（**含 `error`**；error 不算 pass）；分母 0 → `null`。
- **为什么 error 进分母**：排除它会让「全批 error」退化成缺测 → 该门不适用 → 放行（fail-open）。本仓纪律是「无有效数据不外推」（与 τ 扫描的 `scored=0 → tauStar=null` 同款）。
- **缺测（`null`）→ 不放行**。
- **残余（写口径时不许省）**：本率**不含**「主题是否正确」（今天无 judge）、**不含**「合法 citation」——两者已按下方「采集面」落成 `docHitRate` / `citationComplete`，但**明确不进本式**（PRD §6.2 没有这两道门，且 `docHitRate` 未映射时恒 0）；夹具只有 3 条 `near_coref`，80% 只能取 0 / 33.3 / 66.7 / 100% → 该门今天约等于「3/3 全过」而非比例门。
- **未动**：`L2_SIGNOFF_MIN_CASES` 仍是 15（PRD 的 30～50 是**建议**，不是硬门，改它反而严于 PRD）；其余三项零容忍（主题粘连胡答 / 冲突场景跟错数字 / 合法路径跳过 verify）与 `historyLeaked` 的比对宽度（只比对先前**用户**轮，比 PRD 窄）均**未**收紧 —— 已改为在 `zeroToleranceCoverage` 区块里**逐条如实记债**（见下方「零容忍四项的处置档位」）。
- **禁止**：把 `null` 判成放行；把「3/3 全过」写成「已满足 80% 比例门」。

---

### 采集面：`docHit` / 合法 citation（2026-09-23 起）

> 目的：把「主题是否命中期望文档」从**没有原料**变成**有原料且有判据**，同时**不动任何判词**（既有 case verdict 逐位不变）。
> 工单 `.scratch/l2-report-determinability/issues/03-task-l2-evidence-collection.md` · 裁定 `02-dec-l2-ruling.md`。

| 层 | 字段 | 口径 |
|----|------|------|
| 行 | `expectedDocIds?` | **夹具原样**（逻辑 id）；无标注 → 缺省 |
| 行 | `evidenceDocIds` | api CLI 取末轮 `graph.evidence_snapshot[].docId`；worker 取回包 `data.evidenceDocIds`；无 → `[]` |
| 行 | `docHit: boolean \| null` | **直接复用** contracts `hitAtKCase`；无标注 → `null`（不计分，**不放行**也不拉红） |
| 行 | `answerKind?` / `citationCount?` | 图上 `answerKind` / `citations.length`；未下发 → **键缺省**（不冒充 knowledge，也不当 0） |
| 行 | `citationOk: true \| false \| null` | `null` = **不适用**（非 `knowledge`）**或**未下发；`false` = 图明确答了 `knowledge` 却 `citations === 0`；`true` = 有引用（contracts `l2CitationOk`） |
| 批 | `docHitRate` / `docHitHits` / `docHitScored` | **直接复用** `emptyHitAtK` / `accumulateHitAtK` / `hitAtKRate`；分母 = 有非空 `expectedDocIds` 的题数（**含 `error` 题**，与 L1 批跑同款）；分母 0 → `null` |
| 批 | `citationComplete` / `citationCompleteDen` | contracts `l2CitationComplete` → **直接复用** L1 `citationCompleteRate`（分子 = `knowledge ∧ answered ∧ citations>0`；分母 = `knowledge ∧ answered`；分母 0 → `null`） |

- **`docHitRate` 未映射时恒 0，不得当成绩**：夹具写逻辑 id（`l2-corpus/*` / `ingest-samples/*`），报告比的是当前 KB 的 `documents.id` uuid；`fixtures/l2/corpus/*` 从未走 worker 入库、`documents` 无 `external_id`。**禁止**为了让这个数字非 0 而改夹具 / 改 id 体系 / 做模糊或子串匹配（映射属数据工程，不在本图）。
- **两条都不进判定**：`docHit*` 与 `citationComplete*` **不得**接进 `computeL2SignoffEligible`；`citationOk === false` **不得**加进 `failReasons`。PRD §6.2 没有这两道门，接进去就是第二道「恒 false 空转闸」；`computeL2SignoffEligible` 的公式与取值域**一字未动**。与 L1 同款语义：**记率、不判词**。`citationOk` 只在 `knowledge` 上判词：`chitchat` 的「合法 citation」**不适用** → `null`（把「不适用」写成 `false` 会让人把正常路由读成引用缺失；原始事实仍由 `citationCount` 回显）。
- **不采集 `minSupport`**：L2 行上无 claims，「历史文本被当 claim 送进 verifier」在图里不可观测 → 采它只会把假象带进报告（裁定 4）。
- **两侧同构用测例钉**：字段名单唯一锚点是 contracts `L2_EVIDENCE_REPORT_KEYS` / `L2_EVIDENCE_ROW_KEYS`；api `L2Report`/`L2CaseRow` 与 worker `L2BatchReport`/`L2BatchCaseRow` 是三份手抄形状 —— **改名 / 漏键必须让两侧测例一起红**。worker `persist.ts` 的 `saveL2Report` 是**逐键白名单**，加字段必须同步（否则**静默丢弃且零测试红**）。
- **md 渲染**：`docHitRate` 旁写明「**未映射时恒 0，不得当成绩**」；`citationComplete` 与行级 `docHit` / `citationOk` 一并渲染。worker **无** md 渲染（只写 `reportJson`），只需同构字段 + 白名单。

---

### 零容忍四项的处置档位（2026-09-23 起）

> 目的：PRD §6.2 写死「**零容忍（任一即 L2 失败）**：主题粘连胡答、历史文本进 evidence/`min_support`、冲突场景跟错数字、合法路径跳过 verify」，而全仓**只有一处**有真机械判据。本区块把「哪几处真判了、哪几处只是记债」写成**机器可读的事实声明** —— 读报告的人不必再靠文档纪律去猜。
> 工单 `.scratch/l2-report-determinability/issues/04-task-l2-zero-tolerance.md` · 裁定 `02-dec-l2-ruling.md`（裁定 4 / 5 / 6）。

**区块**：报告键 `zeroToleranceCoverage`，纯函数 `l2ZeroToleranceCoverage(zeroToleranceHits)`（contracts `eval/l2-matrix.ts`），api / worker 两侧同源调用，**禁单边另写**。
形状 = **4 项**（`L2_ZERO_TOLERANCE_ITEM_KEYS`，PRD 原句顺序）× **5 处去**（`L2_ZERO_TOLERANCE_PLACE_KEYS`）—— 因为 PRD 把「历史文本进 evidence/`min_support`」写在**同一项**里点了两个去处：

| item | judged | place | judged | hits |
|------|--------|-------|--------|------|
| `topicStickiness` | `debt` | `topicStickiness` | `debt` | `null` |
| `historyText` | `debt`（半判半债，**不许**写成 `mechanical`） | `historyInEvidence` | **`mechanical`** | **= `zeroToleranceHits`（同源）** |
| `historyText` | 同上 | `historyInMinSupport` | `debt` | `null` |
| `kbConflictNumber` | `debt` | `kbConflictNumber` | `debt` | `null` |
| `skipVerify` | `debt` | `skipVerify` | `debt` | `null` |

- 整项 `judged` = **全部去处** `mechanical` 才 `mechanical`；任一处 `debt` → 整项 `debt`。故裁定 6 的 `historyInEvidence = mechanical` 落在**那一处去**的 `judged` 上；整项按 `debt` 记（另一处去是债），**不许**把半判半债含糊成一行 `mechanical`。
- `mechanical` 必带命中数、`debt` 必为 `null`：**不许**拿 `0` 冒充「已判且满足」。非法命中数（NaN / 负 / 非有限）**抛错**，不许静默当 0 变成「零容忍全清白」。
- 区块**不进任何判定**：`computeL2SignoffEligible` 的公式与取值域**一字未动**，`zeroToleranceHits` 仍是它唯一的零容忍合取项。「如实记债」≠ 放行；「一处机械判」≠ 该项已覆盖。
- **两侧同构**：api `L2Report` 与 worker `L2BatchReport` **都必带**该键；worker `saveL2Report` 的逐键白名单**必须同步**（漏键静默丢弃、零测试红）。键名进 contracts `L2_EVIDENCE_REPORT_KEYS`，两侧键集由测例对同一锚点。api 侧 md 逐条渲染（item / place / judged / hits / note）。

**四条债（逐条写清「PRD 写了什么 / 代码为什么判不了 / 缺什么才能销账」；禁止造形似代理）**

| 去处 | PRD 写了什么 | 代码为什么判不了 | 缺什么才能销账 |
|------|--------------|------------------|----------------|
| `topicStickiness` 主题粘连胡答 | 「差旅后突然问无关制度 → **不得**粘连乱答」 | 图上**没有**「本轮主题」这个机器可读字段；`L2Expected.themePersist` 只有**期望值**，无实测值可比（runner 只把它回显成 `expectedThemePersist`） | 先定义「主题」为何物，并让图输出**实测主题标识**（或题面落 per-turn 期望主题 + 可比对字段）。**禁止**用「答里出现了别的文档关键词」这类形似判据顶替 |
| `historyInEvidence` 历史文本进 evidence | 「历史文本进 evidence」 | **不是判不了，是路径不存在**：`graph/run.ts` 的 `evidence` 唯一写点 = retrieve 结果，正文来自 KB chunk；会话窗只进 `rewriteUserPrompt`。`historyLeaked` 抓的是「**语料撞词**」这一种，**比 PRD 窄** | 要更宽只能等「图把聊天当证据」这条路径出现 —— 今天没有可判对象。**禁止**把上轮 assistant 观测文本纳入比对：assistant 的合法答案本就**逐字引库** → 会**假红**（把合法行为判成零容忍） |
| `historyInMinSupport` | 同一项里的「`min_support`」半句 | `AskGraphResult` **不含 claims**；`min_support` 只是 `Math.min(...scores)` 一个数值，文本进不去；「历史文本被当 claim 送进 verifier」在图上**不可观测** | 图上先透出 claims 或 claim 来源标记。**禁止**用「`minSupport` 为 0 即泄漏」这类代理充数（属改 `AskGraphResult`，本图**禁止**） |
| `kbConflictNumber` 冲突场景跟错数字 | 「用户声称上轮数字与库不一致 → **以库为准或拒**，不跟聊天记录」 | 数字只在 `kb-conflict-*` 的 `rubric` **自由文本**里（800 / 200 vs 库内 600 / 120），夹具**无结构化数字字段**；图上只有 `answer` 文本与 `citations[].preview` | 先裁「数字比对规则」（如 answer 金额集合 ⊆ 被引 chunk 金额集合）并给夹具加结构化字段 —— 属「先裁再动」，会动既有断言。**禁止**在没规则前先写个近似匹配当判据 |
| `skipVerify` 合法路径跳过 verify | 「对抗：按聊天记录答、忽略文档 → **仍 verify KB 或拒答**」 | 图上**没有**「这轮调没调 verify」的布尔；`debug` 只有 `llmCalls` / `retrieveCalls` / `route_*` / `evidenceCount`，**无 purpose 维度**；靠 `reason`（`verified` vs `unsupported_claims`）反推是**形似判据** | 图上给 `debug` 加 purpose 维度或显式 verify 标记（属改 `AskGraphResult`，本图**禁止**）。**禁止**用 `llmCalls` 计数反推调用序列当判据 |

**图上不变式钉成测例（裁定 4）**：PRD 那半句的真机械对应物不是「比对更多文本」，而是**图上不变式「evidence 只能来自 retrieve」**。落地 = `apps/api/tests/ask/evidence-from-retrieve-only.test.ts`：

- **行为型**（优先）：注入 retrieve 与 chat stub，会话窗里放一个独特串 → 断言 `evidence_snapshot` **逐字段等于** retrieve 输出、窗文本不出现在任何 `evidence_snapshot[].text`（拒答路径也不回填），并先断言该窗文本**确实进了 rewrite 提示词**（防止测例空转）。
- **源码形状守卫**（补行为型拦不住的那半）：`graph/run.ts` 里 `evidence_snapshot:` 只两处（retrieve 分支的**写** + `finalize` 的**回读**），写点来源 = `r.evidence`。谁加**第二个写点** / 换来源即红。

---

### 可复现区块：`repro`（2026-09-23 起）

> 目的：PRD §8 :224 的可复现条目里，属于 L2 的是「**L2 剧本集哈希**」与「**session 策略版本 / rewrite prompt 版本**」。L1 图已建同构写法（`L1Repro` / `emptyL1Repro()` / `l1QuestionIdsHash`），本区块把 L2 侧那三键落成**同风格**的形状 —— 能取到的取真值，取不到的一律 `null` + 记债。
> 工单 `.scratch/l2-report-determinability/issues/05-task-l2-repro-fields.md` · 裁定 `02-dec-l2-ruling.md`（裁定 7）。

**区块**：报告键 `repro`，类型 `L2Repro`（contracts `eval/l2-repro.ts`，子路径 `@strict-rag/contracts/eval-repro-l2`），api `L2Report` 与 worker `L2BatchReport` **都必带**，**禁单边另写**。

| 键 | 去向 | 口径 |
|----|------|------|
| `l2GoldSetHash` | **取真值** | `l2GoldSetHash(cases.map(c => c.id))` —— 逐字复用 `l1QuestionIdsHash`（逐项 trim → 去空 → **升序** → `JSON.stringify` → sha256），**不另发明哈希**；空集 → `null` |
| `sessionStrategyVersion` | **恒 `null` + 记债** | 全仓无版本载体：`SESSION_REWRITE_ENABLED` 只是布尔，KB 侧只有 `SessionRewriteLock`（形状 `{ enabledDefault: false, locked: true }`，是「锁」不是版本） |
| `rewritePromptVersion` | **恒 `null` + 记债** | `rewriteSystemPrompt()`（`graph/prompts.ts`）是内联字符串 → 源码即版本，无常量 / 无 KB 配置键 / 无表列 |

- **禁止拿源码文本哈希顶替**：prompt / 源码文本哈希会随**任意重构噪声**跳变（改一行注释也变），形似而非语义 —— 这是前图已定的纪律，两个版本键的类型被钉成 `null` 字面量（编一个假版本号过不了 `tsc`）。
- **算的是「本跑实际使用的题面集」**：运行集会受 `L2_MAX_CASES` 截断（截断即另一个题面集，哈希随之变）；api 侧取 `cases.slice(0, maxCases)` 后的集合，worker 侧同。L2 case id 受 `/^l2-[a-z0-9-]+$/` 约束且夹具内唯一，故跨进程稳定。
- **`l2GoldSetHash` 在 L1 侧仍是 `null` 保留键**：`L1Repro.l2GoldSetHash` 与 `emptyL1Repro()` 一字不动（L1 不加载 L2 夹具，**不要**顺手去填它）—— 同名不同源，两侧各自填自己那半。
- **与 `l2RewriteFingerprint` 并存、不合并**：后者（`eval/l2-fingerprint.ts`，prompt + NUL + modelId 的 sha256）语义是「rewrite 提示词 + 模型身份」，**不含任何一道题的 id**，与「剧本集哈希」不是一回事。它**保持原样**：不改名、不搬家、不并入 `repro`（改名会连带打红 `l2-cli.test.ts` 与 obs 侧断言）。
- **区块范围就到这三个键**：§8 的通用字段（`models` / `retrieveK` / `rerankTopN` / `tauClaim` / `contextMode` / …）在 L1 侧已有落点，L2 侧**本图不扩**（记债）。`mode` / `retrieve_mode` 在本区块内**不存在**（既有顶层键是同一语义的历史别名，不许造第二源）。
- **为什么不进 `…/eval/runs` 的 DTO**：`EvalRunSchema` 是 `.strict()`，加键会破坏既有无损读回；与前图 L1 侧同裁 → **记债**（区块只进报告 / `report_json`）。
- **两侧同构用测例钉**：`repro` 进 contracts `L2_EVIDENCE_REPORT_KEYS`；api `buildL2EvalRunInsert` 是 `{...report}` 直落（自动带上），worker `saveL2Report` 是**逐键白名单**，**必须同步加键**（漏键静默丢弃、零测试红）。
- **md 渲染**：api `formatL2ReportMd` 渲染 `## 可复现（PRD §8）` 三行，取不到的渲染成「—」（不渲染 `null` / 空串）；worker **无** md 渲染。
- 区块**不进任何判定**：`computeL2SignoffEligible` 的公式与取值域**一字未动**，`repro` 不是它的入参、也不出现在任何 case 的 `failReasons` 里。

**销账路径（记债，未做）**：① 两个版本键要销账，先得有版本载体（prompt 常量或 KB 配置键 / session 策略版本号）—— 属产品语义变更，须回写 PRD 后另开；② §8 L2 侧通用字段（`models` / 档位预算 / τ）的销账要 worker 拿到本次 run 的档位与模型身份（内口今天不下发 `mode`），属改内口形状，本图不做。

---

## 4. Validation

| 条件 | 行为 |
|------|------|
| 文件不可读 / 非 JSON | `L2GoldLoadError` |
| 错 `run_type` / `signoffEligible≠false` | `L2GoldLoadError` |
| 缺 type / 空 turns / 重复 id | `L2GoldLoadError` |
| `no_session` 却 `session=same` | `L2GoldLoadError` |

CLI 退出码：`0` 写出报告（含 fail/error 题）；`2` 缺 `L2_KB_ID` / 非法 `L2_MAX_CASES` / gold 加载失败；`1` 意外（含 persist 失败）。  
报告 `signoffEligible` 走工程公式（含 live 仍须九类齐、零泄漏、≥15）。可选 `evalRunId`（persist 后回填）。**禁止** `businessPass` / `signedPackage` / 把 persist 或工程绿当准出。

---

## 5. Tests Required

| 层 | 文件 | 断言点 |
|----|------|--------|
| 加载 | `tests/eval/l2-gold.test.ts` | 非法 JSON / 错 run_type / 重复 id / no_session+same / 缺 type |
| 覆盖 | 同上 | 真实 gold `cases.length≥15` 且 `missing=[]` |
| runner | `tests/eval/l2-cli.test.ts` | same/new/none 分配；跨 case 不串窗；泄漏 fail；accept 命中 pass；rewrite 关 + expected true → fail；真 gold+注入 `caseCount≥15` 且 `signoffEligible===false`；execute throw → error |
| persist | 同上 | mapper：`runType=session_multiturn` / `'0'` / matrix 0 / coverage null / ranAt 非 ISO-Z / `reportJson.l2Fingerprint` 与函数一致；`persistEval: false` 不碰 DB；开闸用 persist mock，不连真 PG |
| 指纹 | `tests/eval/l2-fingerprint.test.ts` | 同输入稳定；改 prompt 一字或改 modelId 则变 |
| 采集面 | api `tests/eval/l2-evidence-collection.test.ts` · contracts `tests/eval/l2-evidence-fields.test.ts` · worker `tests/eval/run-l2-batch-evidence-collection.test.ts` | docHit 复用 `hitAtKCase`（无标注 → null 不计分）；**未映射恒 0** 且不抛错；`citationOk` 三态不进 `failReasons`；两侧键集 = contracts 名单；worker 落库白名单不缺新键 |
| 零容忍区块 | api `tests/eval/l2-zero-tolerance-coverage.test.ts` · contracts `tests/eval/l2-zero-tolerance-coverage.test.ts` · worker `tests/eval/l2-zero-tolerance-coverage.test.ts` | 四项逐条取值（1 处 `mechanical` + 4 处 `debt`）；`historyText` 一项如实摊成两处；`historyInEvidence.hits` **同源** `zeroToleranceHits`（泄漏题 = 2 即红）；非法命中数抛错；伪造 `mechanical` / 白名单漏键即红；区块不进判定（真 gold 全绿仍 `signoffEligible`） |
| 可复现区块 | contracts `tests/eval/l2-repro.test.ts` · api `tests/eval/l2-repro-fields.test.ts` · worker `tests/eval/run-l2-batch-repro.test.ts` | `l2GoldSetHash` 逐字等同 `l1QuestionIdsHash`（不另发明哈希）；换序同值 / 改一个 case id 即变 / 空集 → `null`；拼接式哈希的碰撞反证；两个版本键恒 `null` 且类型只可能是 `null`；L1 侧保留键仍 `null`（不被顺手填）；api md 渲染成「—」；`repro` 不在 `l2Fingerprint` 位置（并存不合并）；两侧键集 = `L2_EVIDENCE_REPORT_KEYS`，worker 白名单不缺 `repro` |
| 图上不变式 | api `tests/ask/evidence-from-retrieve-only.test.ts` | 行为型：窗文本进 rewrite 提示词但**不进** `evidence_snapshot`（逐字段 = retrieve 输出）、拒答路径不回填；源码形状守卫：`run.ts` 的 `evidence_snapshot` 写点唯一且来源 = `r.evidence` |

---

## Don't

| 禁止 | 原因 |
|------|------|
| mock / 未跑数字进签字或准出页 | 双轨；sample-report 必须 `n/a（模板）` |
| 未准出把默认改为 `SESSION_REWRITE_ENABLED=true` | 图边 ≠ 准出；phase-scaffold 禁止默认 true |
| 把 runner / persist / `l2Fingerprint` / 工程 `signoffEligible=true` 当 L2 准出 | 工程公式 ≠ 人签；有账本 / 有指纹 ≠ 准出 |
| 调用 L1 `persistEvalRun` 吞 L2 报告 | 会写死 `golden_2x2` + 伪造 matrix |
| ADR-046 / 主题 judge | 对齐 L1 也曾拆 follow-up |
| 把 L2 case 塞进 `fixtures/l1/gold.yaml` | 账本必须分列 |
| 宣称 L2 准出 / 全文 P2 / 生产 ES / 连续追问已开 | 本窗 = 题面 + 工程 runner + 可选 persist |

---

## 交叉引用

- L1 对照（只学 JSON.parse 纪律）：[l1-eval](./l1-eval.md)  
- Ask 图 / rewrite 默认关：[ask-pipeline](./ask-pipeline.md)  
- 质量红线：[guides/quality-redlines](../../guides/quality-redlines.md)  
- Fixture：`fixtures/l2/README.md` · `RACI.md` · `sample-report.md`  
- IS：`docs/module-status/api.md` · 调度 `08-06` **P2.5-L2=部分** · **P2.5-L2R=部分** · **P2.5-L2P=部分** · **P2.5-RW=部分** · **P2.5-IDX 仍索引**
