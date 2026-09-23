# 落 L2 采集面：`docId` 与「命中期望文档」

Type: task
Status: resolved
Blocked by: 02

## Question

按裁定票 02 的形状，把 L2 两侧的采集面补上，让「主题是否命中期望文档」从**没有原料**变成**有原料且有判据**。

范围（以裁定票为准，此处为默认预期）：

1. 两侧的 turn 结果形状都能拿到 `evidenceDocIds`：
   - api CLI：从 `graph.evidence_snapshot[].docId` 取（L1 侧已有同款写法）。
   - worker：`createEvalHttpL2Execute` 从回包 `data.evidenceDocIds` 读（L1 的 `createEvalHttpExecute` 已有同款写法），并把 `L2TurnExecuteResult` 扩到能携带它。
2. 「命中期望文档」按裁定落到报告 / 判定（复用 `hitAtKCase` 一类既有纯函数；无标注题 → `null` → **不放行**，不得 fail-open）。
3. 「合法 citation」按裁定落（若裁定为「不可判」，则如实落到报告的可读位置并在文档里记债，**不许**造替代判据）。
4. 两侧**同构**：api CLI 与 worker batch 的字段名、口径、缺测语义必须一致；`apps/worker/src/eval/persist.ts` 的白名单同步补齐（逐键白名单会**静默丢弃**新键）。
5. 测例：新增落 `<包>/tests/<能力>/<意图>.test.ts`，文件头「目标 / 需求 / 被测 / 简介」简体中文，登记该包 `tests/index.md`；**必须包含可达性证明**（合法输入 → 该门能变真）与**反证**（把新采集面拆掉 → 立刻变红且 reason 可分辨）。
6. 门禁：`pnpm check-types` + `pnpm lint`（零 warning）+ 相关三包测试（**串行**跑，不与其他测试命令并发）。

**不许**：新增迁移 / 表 / HTTP 端点；放宽 `computeL2SignoffEligible` 任何既有条件；改 `fixtures/l2/gold.yaml`（除裁定票明确要求）。

## Answer

按裁定票 02「一、采集面」落地。**未**改 `AskGraphResult`（`apps/api/src/graph/state.ts`）与 `ExecuteAskResult`；`fixtures/l2/gold.yaml` **一字未动**；无迁移 / 表 / HTTP 端点；未碰仓库默认开关与 `prds/00–11`；未 `git add` / `commit`。

### 一、改了哪些文件（分组）

**contracts（判据单源）**

- `packages/contracts/src/eval/l2-matrix.ts`
  - 新增 `L2_EVIDENCE_REPORT_KEYS`（5 键）/ `L2_EVIDENCE_ROW_KEYS`（6 键）：api / worker 三份手抄形状的**同构唯一锚点**。
  - 新增 `l2CitationOk(face)`：行级三态 `true | false | null`。`null` = 采集面未下发（不算有引用、也不算无引用）；`false` = 下发后明确 `citations === 0`。
  - 新增 `l2CitationComplete(rows)`：**直接复用** L1 `citationCompleteRate`（分子 = `knowledge ∧ answered ∧ citations>0`；分母 = `knowledge ∧ answered`；分母 0 → `null`），分母用同一谓词算；L2 行的 `lastStatus` 缺省按 `error` 计（不进分母）。**没有**为 L2 重写一份率口径。
  - 修正过期注释：`l2NearCorefPassRate` / `computeL2SignoffEligible` 原写「L2 runner 未采集 `evidence_snapshot.docId`，连判命中都做不到」——现在采集面已补，改写为「已采集但**明确不进本式**，且未映射时恒 0」。

**api**

- `apps/api/src/scripts/run-l2-golden.ts`
  - `L2CaseRow` 增：`expectedDocIds?`（夹具原样，可为 undefined）、`evidenceDocIds`、`docHit`、`answerKind?`、`citationCount?`、`citationOk`。
  - `L2Report` 增：`docHitRate` / `docHitHits` / `docHitScored` / `citationComplete` / `citationCompleteDen`。
  - 采集：末轮 `graph.evidence_snapshot[].docId`（trim + 去空）；`graph.citations.length`（照 L1 的 `Array.isArray` 兜底 0）；`graph.answerKind`（非合法值 → **键缺省**，不冒充 knowledge）。
  - `docHit` 用 `hitAtKCase`；整批用 `emptyHitAtK` / `accumulateHitAtK` / `hitAtKRate`；error 题按「未命中」计（与 L1 批跑同款），无名单题 `null` 不计分。
  - **不采集 `minSupport`**（裁定 4）。`computeL2SignoffEligible` 的**入参与公式一字未动**。
  - `formatL2ReportMd`：新增 `docHitRate`（旁写「**未映射时恒 0，不得当成绩**（逻辑 id ≠ KB uuid；不进 signoffEligible）」）与 `citationComplete`(den) 两行；cases 表加 `docHit` / `citationOk` 两列。

**worker**

- `apps/worker/src/eval/run-l2-batch.ts`：`L2TurnExecuteResult` 扩 `evidenceDocIds?` / `answerKind?` / `citationCount?`（**不加** `minSupport`）；`L2BatchCaseRow` / `L2BatchReport` 与 api **同名同语义**加同 6 行键 + 5 报告键；累加与口径全部调 contracts 那三个/两个函数。
- `apps/worker/src/eval/execute-ask-http.ts`：`createEvalHttpL2Execute` 从回包 `data.evidenceDocIds` / `data.citationCount` / `data.answerKind` 读，解析与过滤**照抄** `createEvalHttpExecute`（数组才收、非空字符串才留、非合法 answerKind / 非有限 citationCount → **键缺省**）；**不读 `minSupport`**（回包本来在发，但 L2 明确不采）。
- `apps/worker/src/eval/persist.ts`：`saveL2Report` 的手写白名单同步加 5 个新键（消息里的坑：漏键会**静默丢弃且零测试红**，已用测例钉住）。
- **worker 无 md 渲染**（只写 `reportJson`），故「同改 md」这一条在 worker 侧无落点。

**spec / 测试登记**

- `.trellis/spec/api/backend/l2-eval.md`：新增「采集面：`docHit` / 合法 citation（2026-09-23 起）」整节（字段口径表 + 三条纪律 + md 渲染 + 白名单纪律）；签名表补 3 行；测例表补「采集面」1 行；改正近指代一节里已过期的「runner 未采集 docId 命中」。
- `.trellis/spec/worker/backend/index.md`：eval 检查项补「L2 落 `docHit*` / `citationComplete*` 但不得进 `signoffEligible` / `failReasons`」+ 新增一条「加字段须同步 `saveL2Report` 白名单」。
- 三包 `tests/index.md` 各登记 1 行新测例。**未动** `docs/module-status/`（留工单 06）。

### 二、测例清单

**新增（3 文件 / 26 条 it）**

| 包 | 文件 | it 数 | 覆盖 |
|----|------|------:|------|
| contracts | `tests/eval/l2-evidence-fields.test.ts` | 10 | `l2CitationOk` 三态（未下发 / 0 / >0 / chitchat）；`l2CitationComplete` 分母谓词（error 不进分母、分母 0 → null）；两条字段名单逐字锁定且无重复；**恒 0 护栏**（照抄 `l1-hit-at-k`：逻辑 id vs uuid 未映射 → `false` 且不抛错、只认 trim 后全等、无标注 → `null`） |
| worker | `tests/eval/run-l2-batch-evidence-collection.test.ts` | 8 | `createEvalHttpL2Execute` 读三键 / 未下发键缺省 / **不读 minSupport**；`runL2Batch` 落 `evidenceDocIds`+`docHit`+两率与分母；未映射恒 0 且 `signoffEligible` 仍 true；`citationOk` 三态不进 `failReasons`；**跨侧同构**（键集 = contracts 名单）；**白名单不缺新键**（捕获 `set` 载荷逐键比对） |
| api | `tests/eval/l2-evidence-collection.test.ts` | 8 | CLI 采集三键落行与整批；未映射 → 真 gold 全 `false` + `docHitRate===0` 且 `signoffEligible===true`；无标注 → `null` 不计分；**分母 0 → null**；error 题按未命中计；`citationOk` 三态 + 未下发键缺省 + 判词不变；md 渲染含「未映射时恒 0，不得当成绩」与 `citationComplete`；报告/行键集 = contracts 名单 |

**改写既有（仅 api `tests/eval/l2-cli.test.ts`，1 个 helper + 3 条 it）**

- helper `sampleReport()`：补 5 个新字段（否则 `L2Report` 字面量过不了 `tsc`）。
- `buildL2EvalRunInsert / persist gate › maps report → session_multiturn; signoff 0; matrix 0; coverage null; ranAt local`：追加 5 条断言，钉住「`{...report}` 直落时新键自动带上」（api 侧无白名单问题）。
- `buildL2EvalRunInsert / persist gate › live report still maps signoffEligible to 0 unless report says true`：仅随 helper 改动而过（`sampleReport` 形态变化），断言未变。
- `buildL2EvalRunInsert / persist gate › reportJson.l2Fingerprint matches current prompt+empty model; signoff stays 0`：同上，断言未变。

**worker 既有测例零改动**（`run-l2-batch.test.ts` · `run-l2-batch-near-coref-rate.test.ts` · `execute-ask-http.test.ts` 全绿通过，等于「既有 case verdict 逐位不变」的回归证据）。

### 三、门禁数字（终检，串行跑）

| 门 | 结果 |
|----|------|
| `pnpm check-types` | **全绿**（8 tasks successful） |
| `pnpm lint` | **全绿**（零 warning，`--max-warnings 0`） |
| `pnpm --filter @strict-rag/contracts test` | **32 文件 / 264 通过**（新增文件 10 条） |
| `pnpm --filter @strict-rag/worker test` | **53 文件 / 241 通过**（新增文件 8 条；文件数 52 → 53） |
| `pnpm --filter @strict-rag/api test` | **174 文件 / 1084 通过 · 3 skipped**（新增文件 8 条） |

### 四、反证（4 轮，全部已还原）

| 轮 | 改了什么 | 红了几条 | 哪几条 |
|----|----------|---------|--------|
| 1 | api CLI 把 `evidenceDocIds` 直接置 `[]`（拆掉 docId 采集面） | **2** | api `l2-evidence-collection`：`末轮 evidence_snapshot[].docId 与 citations / answerKind 落进行与整批`、`无标注题 → docHit null 且不计分` |
| 2 | worker `persist.ts` 白名单删掉 `docHitRate` 一行 | **1** | worker：`saveL2Report › 落库 JSON 保留新采集面字段与行键…`（在库内静默消失） |
| 3 | contracts `l2CitationOk` 把 `count > 0` 反成 `count >= 0` | **4**（跨三包） | contracts 2 条（`下发后 citations=0 → false；>0 → true`、`chitchat 行不判词`）+ worker 1 条（`citationOk 三态`）+ api 1 条（`未下发… citationOk null`） |
| 4 | worker **单边**把报告字段 `docHitScored` 改名（type + 字面量 + 白名单，不动测例与 contracts） | **4** | worker：`两侧同构 · 键集 = contracts 名单`、`saveL2Report 白名单`、`落 evidenceDocIds / docHit 与整批率`、`未映射 → 全 false、率恒 0` —— 证明「同构靠测例钉」而非靠手抄 |

第 1 轮还顺带证明方向安全：拆掉采集面时 `signoffEligible` / md / citation 用例**保持绿**，即 `docHit` 确实不进任何判定。

### 五、未做 / 做不了（如实）

- **`docHitRate` 恒 0 是今天的正确取值**：夹具写逻辑 id（`l2-corpus/*` · `ingest-samples/*`），报告比的是 `documents.id` uuid，夹具语料从未入库、`documents` 无 `external_id`。本图**没有**为了让这个数字非 0 而改夹具 / 改 id 体系 / 做模糊或子串匹配。
- **「跨侧同构测例」的实现形式**：两个 app 之间无依赖（`apps/api` 与 `apps/worker` 互不 import），单文件无法同时 import 两侧 → 采用**共享锚点**：contracts 的 `L2_EVIDENCE_REPORT_KEYS` / `L2_EVIDENCE_ROW_KEYS`，两侧各自断言自己的报告/行键集等于该名单。**单边改名即两侧一起红**（反证 4 已实证）。若希望「一条 it 同时断言两侧」，须新增跨 app devDependency（本图未做，留作可选）。
- **未做（本图范围外）**：`zeroToleranceCoverage` 区块（裁定 6）、`l2GoldSetHash` 等 §8 字段（裁定 7）——属别张票；`docs/module-status/` 未动（工单 06）。
- **`citationOk` 的语义边界**：它只回显「下发后 `citations` 是否 > 0」，`false` 也可能出现在 chitchat 行（不判词）；判定域由 `l2CitationComplete` 按 L1 口径收窄到 `knowledge ∧ answered`。这是**有意**的，已在 contracts 注释与 spec 写明。

### 六、给工单 06（spec 回写提示）

1. `.trellis/spec/api/backend/l2-eval.md` —— **已改**（本票）：新增「采集面」整节 + 签名表 3 行 + 测例表 1 行 + 近指代残余句。06 只需复核，不必重写。
2. `.trellis/spec/worker/backend/index.md` —— **已改**（本票）：eval 检查项 + 白名单检查项各 1 条。
3. 仍需 06 处理（本票**未**动）：`docs/module-status/api.md` · `docs/module-status/worker.md` 的「L2 runner 未采集 docId / 无合法 citation」类旧表述（若有）需按期更新；`fixtures/l2/README.md` 与 `fixtures/l2/sample-report.md` 建议补一行「`docHitRate` 未映射时恒 0，不得当成绩」并列出新报告字段（裁定 2 明确要求 fixture 侧同写）。
4. 遗留语义债（写进 06 的 `Not yet specified`）：近指代那行 PRD「合法 citation」是否属硬门的一部分（本图按「记率、不判词」处理，未进 `signoffEligible`）；`citationOk` 对 chitchat 行取 `false` 的读法。


---

### 主控复核补记（2026-09-23）

**一、收窄了一处会被误读的语义（已改 + 已重跑门禁）。** 本票原把 `l2CitationOk` 实现为「下发后回显 `citations > 0`」，于是 `chitchat` 行会取 `false`。复核认为这会把「**不适用**」与「**不满足**」混为一谈：L1 引用完整率的分母本就排除 `chitchat`（只有 `knowledge ∧ answered` 才谈「合法 citation」），而报告里出现一个 `chitchat | false` 会让读的人把**正常路由**读成**引用缺失**。已收窄为：**只有 `answerKind === 'knowledge'` 才判 `true` / `false`，其余（含 `chitchat`）一律 `null`**；原始事实仍由行上 `citationCount` 回显。改动三处：`packages/contracts/src/eval/l2-matrix.ts` 的 `l2CitationOk` 与其注释、`packages/contracts/tests/eval/l2-evidence-fields.test.ts` 对应那条 `it`（改名为「chitchat 行的『合法 citation』不适用 → null」并断言 `null`）、`.trellis/spec/api/backend/l2-eval.md` 的签名表与纪律段。**收窄不放宽**：`null` 既不进分子也不进分母，没有任何路径因此变绿。

**二、复核后重跑门禁（串行）**：`pnpm check-types` 8/8 · `pnpm lint` 8/8 零 warning · contracts **32 / 264** · worker **53 / 241** · api **174 / 1084 + 3 skipped**。

**三、复核发现的一条同构残余（本轮**未**改，如实记债）**：`citationCount` 的「键是否存在」语义两侧不同 —— api CLI 侧走 `Array.isArray(graph.citations) ? length : 0`（图对象在手，非数组 → 记 `0`），worker 侧只在回包**下发**该键时才带（未下发 → 键缺省）。结果：对手写 stub 而言，同一种「没给引用数据」在 api 侧落 `citationOk: false`、在 worker 侧落 `null`。**这不是本票引入的**：L1 的 `run-l1-golden.ts` 与 `createEvalHttpExecute` 早就是同款不对称，本票只是照抄。真跑时 `AskGraphResult.citations` 恒为数组，故**只在 stub 路径上可达**。处置：留作残余；若将来要统一，须两侧一起改（含 L1），单改一侧会把不对称换个方向。