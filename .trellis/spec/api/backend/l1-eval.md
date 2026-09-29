# api · L1 黄金集评测（B10 工程 seed）

> 路径：`apps/api/src/eval/` · `apps/api/src/scripts/run-l1-golden.ts` · 仓根 `fixtures/l1/`  
> 产品语义：`prds/08-quality`（覆盖率 / 2×2）· 任务 `08-08-b10-l1-golden-set`  
> **本窗状态**：工程底座 **已落地**；OPS-1 live profile + `retrieve_mode`/`signoffEligible`；B10-followup **工程**（`eval_runs` 表 + gold 60 + `L1_PERSIST_EVAL`）已归档；B10-RACI owner 表 `fixtures/l1/RACI.md`；ADR-046 快照绑定已落；**业务人签未做**；**L3 打点部分（无自动熔断）**；L2 题面草案见 [l2-eval](./l2-eval.md)（**≠** 准出）。

---

## 双轨门禁（X-13 · ADR-061）

| 轨 | 含义 | 何时算「绿」 | **禁止**宣称 |
|----|------|--------------|--------------|
| **工程绿** | CI / 本地 vitest + mock 注入 CLI | `l1-matrix` · `run-l1-golden` 注入测通过；exit 0 写报告 | 「L1 业务签字 PASS」 |
| **签字 PASS** | 产品/质量门禁 | `signoffEligible===true`（live retrieve）+ RACI 人签 + 配置快照（ADR-046） | 把 mock coverage 写进签字页 |

| 字段 | 工程绿 | 签字 PASS |
|------|:------:|:---------:|
| `mode` / `retrieve_mode` = mock | ✅ 可 | ❌ |
| = live（`RETRIEVE_ES_MODE=http` 等） | ✅ 可 | 必要条件，**非充分** |
| `signoffEligible` | 仅标注 | 须 true（live+规模） **且** 人工签 |
| coverage 数字 | 工程观察 | 仅 live + 人签后可进门禁叙事 |

**Wrong**：PR 全绿 → 路线图勾「L1 已过」。  
**Correct**：PR 工程绿；签字另附 live 报告 + `fixtures/l1/RACI.md` owner。

---

## 硬门判定落点（实测值 → 业务 PASS）

> 2026-09-23 起：`prds/08-quality/02-evaluation-and-gates.md` §6 的试点硬门**不再只做门对门比较**（候选包 vs 试点包），实测值真进 `evaluateAdr046Bind` 的 `&&`。

| 实测值 | 来源 | 进判定的判据 | 缺测（null）时 |
|---|---|---|---|
| 覆盖率 | 2×2 的 A/(A+B) | `>= 试点 coverageMin`（0.40） | 不放行 |
| C 率 | C/(C+D) | `<= 试点 cRateMax`（0.05） | 不放行 |
| Hit@k | evidence.docId 与 expectedDocIds 有交集 | `>= 试点 hitAt20Min`（0.70） | **该门不适用**（PRD 写「有标注时」） |
| Judge AUROC | 独立校准集（Mann-Whitney） | `>= 试点 judgeAurocMin`（0.65）**且 来源 = live 且校准集有效对数 ≥ 100** | 不放行 |
| 引用完整率 | `knowledge ∧ answered` 里 citations>0 的比例 | `>= 试点 citationCompleteMin`（0.99） | **该门不适用**（分母 0） |
| 人工抽检 | 文件账本登记的条数 / 错数 | `checked >= 试点 humanSpotMin`（20）**且** `errors <= 试点 humanSpotErrorMax`（1） | 不放行 |

**门限一律读 `PILOT_HARD_GATES`**，判定处禁止写裸数字。新增门限前先问一句「PRD 写死了吗」：写死 = 落地（实现 PRD）；没写 = 改冻结语义，须 ADR。

**两条必读的诚实面**（写这类改动时不许省）：

1. 打分器来源由 env `JUDGE_CALIB_SCORER` 声明（默认 off = 缺测），判定只认 live 且校准集有效对数 ≥ 100；默认配置（off + 夹具 8 条）下 `judgeAuroc` 恒 `null` → **`businessPass` 在生产路径上不可达**。这是**有意**的：把「未测 / 只测了 mock」显形为红，而不是留一条覆盖率 0.001 也能变真的假绿。worker 侧无 Gateway 打分客户端（`http` 只声明不产值）。
2. 引用完整率受图的不变式约束（`answered ∧ knowledge` 时必带合法引用）→ 结构上只能是 1 或 null。该门钉的是**不变式**，不是筛跑次。

**双写常量**：`PILOT_HARD_GATES`（本包 `eval/adr046-snapshot.ts`）与 contracts 的 `TAU_STAR_COVERAGE_MIN` / `TAU_STAR_C_RATE_MAX` 是**两份独立常量、数值一致**（依赖方向只有 api → contracts）。**不合并**，只加一条同时读两处的断言防单边漂移。

**禁止**：为了让某次跑次变绿而放宽任一门；把缺测当合格；在判定处复制门限数字；把「未接打分器」写成「已达 AUROC 门」。

**未做（债）**：真人抽检动作本身（登记面已落，数字须人给；样例 `fixtures/l1/human-spot.example.json` 是恰好达标样例，**禁止**当真实数字）· ≥100 条真标注校准集（规模门已落，真实夹具仍 8 题）· 真 judge live 跑数与验收（本机无 Gateway / 密钥）· `repro` 未透出 DTO · 版本载体类字段仍 `null`（seed / fallbackChains 版本 / promptVersions / lifecycle 规则版本 / session 策略版本）。

---

## 人工抽检账本登记面（PRD §6 硬门「≥20 条，错 ≤1」）

> 承载面 = **文件 JSON 账本**（Zod 契约在 `@strict-rag/contracts` 的 `eval/human-spot.contract.ts`），**不建 PG 表、不开 HTTP 端点、不新增迁移**。

- **形状**：`{ evalRunId, sampledBy, sampledAt, checked, errors, items?[] }`；`checked` / `errors` 为非负整数。
- **唯一机械不变式**（contracts 的 `superRefine` 只校验这三条）：`errors <= checked`；**给了 `items` 时** `items.length === checked` 且 `items` 里 `wrong=true` 的条数 `=== errors`。
- **「错」的口径**：PRD 未定义机械口径 → 由抽检人按 rubric 判；登记面只承载整数 + 可选明细。**禁止**在代码里发明「什么算错」。
- **失败语义**：账本缺文件 / 非 JSON / 违约一律抛 `HumanSpotLoadError`（api 与 worker 各一份同构加载器）→ CLI **exit 2**。**禁止**把坏账本静默降级成「没人登记」。
- **报告落点**：`humanSpot`（条数 / 错数 / 来源）；**不落** `sampledBy` / `sampledAt` / `items` 明细（留在账本文件）。**缺测写 `null`，不写 0 条**。
- **进闸**：`checked >= PILOT_HARD_GATES.humanSpotMin`（20）**且** `errors <= PILOT_HARD_GATES.humanSpotErrorMax`（1）；缺测不放行。三个 reason code 各自可分辨：`human_spot_missing` / `human_spot_below_min` / `human_spot_errors_above_max`（两条同时不过时可同时报）。
- **禁则**：①**禁止**把人工抽检做成「恒 false 的空转闸」—— 顺序必须是**先有登记面、再进闸**，且必须有一条测例证明「一份合法账本确能让该门变绿」；②**禁止**在判定处写裸数字（`20` / `1` 只能来自 `PILOT_HARD_GATES`）；③**禁止**把样例 `fixtures/l1/human-spot.example.json` 当真实抽检数字。
- **入口**：api CLI `--human-spot <path>`（`--human-spot=<path>` 亦可）；worker `runL1Batch({ humanSpotPath })`。**worker 生产消费者今天不传** → 生产跑批 `humanSpot` 恒 `null`（缺测，方向安全）。

---

## 校准打分器来源三态与规模门（PRD §4 / §6）

> 打分器**来源**由入口侧声明（env `JUDGE_CALIB_SCORER`），**值**由「怎么打分」决定；两者不可混同。

- **三态**：`JUDGE_CALIB_SCORER` = `off`（**默认** = 缺测）/ `mock` / `http`；报告 `judgeAurocSource` = `live` / `mock` / `none`。映射由 contracts 的 `judgeAurocSourceFor` 唯一提供，api 与 worker **共用**（禁止单边另写）。
- **判定只认 `live`**：`judgeAurocOk = 值非 null ∧ 值 >= judgeAurocMin ∧ 来源 === 'live' ∧ 校准集有效对数 >= JUDGE_CALIB_MIN_CASES`。三条红各自可分辨：`judge_auroc_missing_or_below_min` / `judge_auroc_source_not_live` / `judge_auroc_calib_too_small`（else-if 互斥，报第一处不过的门）。
- **规模门**：`JUDGE_CALIB_MIN_CASES = 100`（PRD §4 写死），常量单一来源在 contracts，api 只引用；判定处禁止写裸数字。
- **`mock` 的定位**：确定性伪打分器（label 同源 → AUROC 恒 1），**值可打印、绝不进判定**（PRD §6.1 / ADR-061）。
- **`http` 真打分器**：`eval/judge-scorer.ts` 走 `purpose: judge`，复用 ask 的 judge prompt 与解析；**go/no-go** —— 声明 `http` 而 Gateway 非 `http`（`GATEWAY_MODE` / `GATEWAY_BASE_URL`）→ 入口 **exit 2**，**禁止** mock 分数标成 live。
- **禁则**：①**禁止**为了让门变绿而让 mock 冒充 live，或把「未接打分器」写成「已达 AUROC 门」；②**禁止**把 `off`（默认）下注入的打分器当生效来源（声明是来源的唯一决定者）；③**禁止**在判定处复制规模 / 门限数字；④worker 侧**无** Gateway 打分客户端，`http` 只声明不产值 —— 不许把它读成「worker 也能产 live 分」。

---

## §8 可复现区块（`repro`）

> L1 报告新增 `repro`（形状 = contracts 子路径 `@strict-rag/contracts/eval-repro` 的 `L1Repro`，14 键）；api CLI 与 worker 批跑**同形状**。不含任何判定。

- **取真值**（能取到就取）：`models`（env 三模型 + KB `model_bindings`）· `retrieveK` / `rerankTopN`（图上回包档位派生）· `tauClaim`（与快照同一个 τ）· `questionIdsHash`（题面 id 集合：trim → 去空 → **升序** → sha256）· `calibrationHash`（校准集文件内容逐字节 sha256）。
- **恒 `null`**（无载体 / 未实现，销账见镜像与工单 05 去向表）：`seed` · `fallbackChainsVersion` · `crag` · `contextMode` · `promptVersions` · `lifecycleFilterVersion` · `sessionStrategyVersion` · `l2GoldSetHash`（L2 侧归下一张图）。
- **既有 `mode` 不动**：顶层 `mode` / `retrieve_mode` 是 `retrieve_mode` 的历史别名（`resolveEvalMode`），**不是** ask 档位；区块里**没有**第二个 `mode`。§8 `mode` / `contextMode` 的语义歧义记债。
- **md 渲染**：能取到的渲染真值，取不到的一律渲染「—」。
- **禁则**：①**禁止**用占位串（空串 / `'unknown'` / `'-'` / `'n/a'`）冒充「取不到」—— 取不到只准写 `null`；②**禁止**拿源码文本或配置内容哈希冒充「版本」（会随任意重构噪声跳变，形似而非 PRD 语义），也**禁止**对 prompt / 链内容算哈希顶替版本；③**禁止**把「无版本载体」的字段类型写成 `string` —— 钉成 `null` 字面量，编假值须过不了 `tsc`；④**禁止**在区块里再造 `mode` 第二源；⑤哈希必须是**稳定纯函数**（同输入跨进程同值；输入变一字节即变值），且**逐字节不做行尾归一**（代价：CRLF 检出会变值，记债）。
- **落库同构**：api CLI 走 `reportJson: report` 整对象直落，worker `persist.ts` 是**逐键白名单** → 加字段不同步白名单会被 worker **静默丢弃**（有同构测例钉住）。`L1Repro` 今天**未透出** DTO（`…/eval/runs` 看不到）。

---

## Scenario: L1 批跑 CLI → executeAsk → 2×2 报告

### 1. Scope / Trigger

- Trigger：新增 CLI 入口、env 键、跨层（fixture → script → `executeAsk` → graph）、可执行错误矩阵。
- 目标：串行批跑黄金题，产出 **mode 标注** 的 2×2 矩阵与覆盖率；CI 只钉 **纯函数 + mock 注入**，不跑 live LLM。
- 非目标：B6 看板增强、L2/L3 准出、写 `TAU_CLAIM`、在线抽样；题面已扩≥30+30，**live 真跑数字**仍见 B10-followup 余量。L1 批跑可离线扫 τ 得 tau*（**不**改本跑 2×2 / **不**进签字公式 / **不**新开 `tau_sweep` 入队）。独立校准集可算 Judge AUROC（**不**用 gold type 当 label / **并已进签字公式**（判定只认 live + 校准规模 ≥100）/ **不**新开 `verifier_calib` 入队；无打分器 → null）。人工抽检走文件账本 + CLI `--human-spot`（**无**表 / **无** HTTP 登记面）。  
- **P2 底线（本窗已接）**：`gold-questions` CRUD + `POST eval/runs` 入队 `sr-eval`；worker 串行跑 L1；`GET eval/runs/:runId` 回读。CLI 仍直调 `executeAsk`。

### 2. Signatures

| 符号 | 位置 | 说明 |
|------|------|------|
| `cellFor(type, outcome)` | `eval/l1-matrix.ts` | → `'A'\|'B'\|'C'\|'D'\|null` |
| `accumulate(matrix, type, outcome)` | 同上 | 就地 +1 格；error → 返回 `1`（error 增量） |
| `coverage(matrix)` | 同上 | `A/(A+B)`；分母 0 → `null` |
| `hitAtKCase(expected, evidence)` | 同上 | 无非空 expected → `null`；否则交集 |
| `accumulateHitAtK` / `hitAtKRate` | 同上 | scored=0 → `null`；不进签字公式 |
| `sweepTau(cases)` | 同上 | 按 minSupport 离线扫网格；tau* = 满足试点 coverageMin∧cRateMax 的最大 τ；无分母或全不及格 → `null` |
| `auroc(pairs)` / `judgeAurocFromScored` | 同上 | Mann-Whitney；独立校准集 `(score, label)`；单类或无分 → `null` |
| `goldTypeCounts(cases)` | 同上 | `{ answerable, unanswerableClass }` |
| `computeSignoffEligible(mode, counts)` | 同上 | live ∧ 各≥`SIGNOFF_MIN_PER_CLASS`(30) |
| `bindQualitySnapshotToEval(input)` | `eval/adr046-snapshot.ts` | ADR-046 快照绑定 eval 身份；硬门放宽 / 缺四要素 → 不得 `signedPackage`；coverage=0 / `internal_guard` → 不得 `businessPass` |
| `writeBoundSnapshot(outDir, …)` | 同上 | 写 `l1-gate-snapshot.json`（gitignore 产物） |
| `loadGold(goldPath)` | `scripts/run-l1-golden.ts` | 读 JSON 形 gold；失败抛 `GoldLoadError` |
| `runL1Golden(opts)` | 同上 | 串行批跑 + 写报告；可注入 `execute` |
| `executeAsk(params, deps?)` | `services/ask/execute.ts` | 批跑 **必须** `deps.skipTrace: true` |
| CLI `main` | `run-l1-golden.ts` isMain | 读 env → `runL1Golden` → stdout 摘要 JSON |

```ts
// 批跑入口（生产路径形状）
await executeAsk(params, { skipTrace: true, ...opts.executeDeps });
// outcome = result.graph.status  // 'answered' | 'abstained'（throw → 'error'）
```

### 3. Contracts

#### Gold 文件（`fixtures/l1/gold.yaml`）

- 扩展名按 design 为 `.yaml`，**内容为 JSON**（`JSON.parse`，**零 yaml 依赖**）。
- 根：`{ "cases": GoldCase[] }`，`cases` 非空数组。

| 字段 | 类型 | 约束 |
|------|------|------|
| `id` | string | 必填非空 |
| `question` | string | 必填非空 |
| `type` | enum | **仅** `answerable` \| `unanswerable` \| `false_premise` |
| `expectedDocIds?` | string[] | 逻辑 id（见 fixtures README）；有非空名单时计 Hit@k（字符串全等）；**不**设 A 格命中下限 |
| `expectedChunkIds?` | string[] | 可选 |
| `rubric?` | string | 可选 |

Seed 规模：可答 30 + 不可答类 30（含 `false_premise`）；**mock 数字禁签字**。

#### 2×2 格映射（error 不计格）

| type \\ outcome | `answered` | `abstained` | `error` |
|-----------------|------------|-------------|---------|
| `answerable` | **A** | **B** | 不计；`errorCount++` |
| `unanswerable` | **C** | **D** | 同上 |
| `false_premise` | **C** | **D** | 同上（不可答子集） |

- **覆盖率** `coverage = A / (A+B)`；无 answerable 样本 → `null`（勿当 0）。
- `false_premise` **不**单独成格。
- **Hit@k**（P4 最小）：只对非空 `expectedDocIds` 计分；hit = 该题 `evidence_snapshot.docId` 与 expected 有交集；k = 该列表长度；总率 = hits/scored，scored=0 → `null`。**不**进 `signoffEligible`，**不**改 2×2。逻辑 id→uuid 映射由跑批前按账本解析（api CLI `L1_DOC_MAP` / worker `L1_DOC_MAP`，见下方「评测语料映射账本」；未映射继续算 miss）。
- **τ 扫描**（P4 最小）：挂现有 L1 批跑。有 `minSupport` 才按网格重阈（min 否决：`minSupport≥τ` → answered）；无分数保持原 outcome（未进 judge 不得因降 τ 变成 answered）；error 出格。网格 `0.30…0.90` 步长 `0.05`。`cRate=C/(C+D)`。**tau\*** = coverage≥0.4 ∧ cRate≤0.05 的最大 τ；没有 → `null`。本跑 2×2 仍按 env `TAU_CLAIM` 的真实 outcome。**不**写 env、**不**让公开 ask 传 τ、**不**进 `signoffEligible`。`unsupported_claims` 的图结果必须带回 `minSupport`。
- **Judge AUROC**（P4 最小）：独立 `fixtures/l1/judge-calibration.json`（`claim` + `evidence` + `supported|unsupported`）。**禁止**用 gold `type` / ask outcome 当 label。Mann-Whitney；注入打分器才计分；无打分器 / 单类 / 无有效分 → `judgeAuroc=null`。**不**进 `signoffEligible`，但**已**进 api 侧 `evaluateAdr046Bind` 的放行判定（值 ≥ 门限 ∧ 来源 = live ∧ 校准集有效对数 ≥ 100），**不**新开 `verifier_calib` 入队。

#### `L1Report`（写出 `artifacts/l1-last-run.json` + `.md`）

| 字段 | 约束 |
|------|------|
| `mode` | `'mock' \| 'live' \| 'unknown'` ← `resolveEvalMode(RETRIEVE_ES_MODE)`（历史字段） |
| `retrieve_mode` | 与 `mode` 同步（OPS-1 签字归因） |
| `signoffEligible` | `live` **且** 本跑 `answerable≥30` ∧ `unanswerableClass≥30` → `true`；mock / unknown / 截断冒烟 → `false`；**≠** 自动业务签字 |
| `answerableCount` / `unanswerableClassCount` | 本跑实际题量（受 `L1_MAX_CASES` 截断）；`false_premise` 计入不可答类 |
| `evalRunId?` | `L1_PERSIST_EVAL` 写入 `eval_runs` 后的 id |
| `gateSnapshot?` / `gateVerdict?` | ADR-046：配置快照绑定 `evalBindId`；`signedPackage` 须四要素且硬门未放宽；`businessPass` 另须 signoffEligible ∧ coverage>0 ∧ 非全 `internal_guard` |
| `ranAt` | ISO 字符串（artifact / report_json）；**写库** `eval_runs.ran_at` 用 `formatLocalDateTime`（`evalRunDbRanAt`） |
| `caseCount` / `errorCount` | number |
| `hitAtK` / `hitAtKHits` / `hitAtKScored` | 有 expected 的题的命中率；无计分题 `hitAtK=null` 且 hits/scored=0 |
| `tauStar` / `tauSweep` | 离线网格；`tauStar=null` 表示没有 τ 同时满足试点硬门。不改本跑 matrix |
| `judgeAuroc` / `judgeAurocScored` | 独立校准集；无打分器或单类 `judgeAuroc=null`。不进签字公式 |
| `matrix` | `{ A,B,C,D }` |
| `coverage` | `number \| null` |
| `cases[]` | 每题 `id,type,outcome,cell,reason?,errorMessage?,hitAtK?,minSupport?` |
| `kbId` | 本跑使用的 KB |

`mode`/`retrieve_mode` 规则：`RETRIEVE_ES_MODE===mock` → `mock`；`===http` → `live`；其余 → `unknown`。  
`undefined` 时读 `env.RETRIEVE_ES_MODE`（单测须 **显式** 传入 esMode，勿依赖进程 env 偶发值）。

#### 环境键（CLI）

| 键 | 必填 | 默认 | 说明 |
|----|------|------|------|
| `L1_KB_ID` | **CLI 必填** | — | 缺失 → exit **2** |
| `L1_MAX_CASES` | 否 | 全量 | 正整数；非法 → exit 2 |
| `L1_GOLD_PATH` | 否 | `<repo>/fixtures/l1/gold.yaml` | |
| `L1_OUT_DIR` | 否 | `<repo>/artifacts` | |
| `L1_TENANT_ID` | 否 | 固定 dev uuid | |
| `L1_USER_ID` | 否 | 固定 dev uuid | |
| `L1_PERSIST_EVAL` | 否 | 关 | `1`/`true` → insert `eval_runs`（db migration 0006） |
| `L1_DOC_MAP` | 否 | 关 | 映射账本路径（`artifacts/eval-corpus-ledger-<kbId>.json`）；不设 = 与今天逐位一致；账本缺 / 解析失败 / `kbId` 或 `corpusFingerprint` 不符 → exit 2 |

> **Turbo**：`turbo.json` 的 `lint` / `test` task env 须声明 `L1_*`（含 `L1_PERSIST_EVAL` / `L1_DOC_MAP`）；新增键同步改 turbo。

#### 评测语料映射账本（工单 03 / 04 / 05）

- **入库入口**：`apps/api/src/scripts/ingest-eval-corpus.ts`（env 驱动；`INGEST_KB_ID` 复用 / `INGEST_KB_NAME` 新建，二者至少一个，否则 exit 2）——把 `fixtures/ingest-samples/*.txt` 与 `fixtures/l2/corpus/*.txt` 逐篇走既有 HTTP 面（upload-url → PUT → complete → approve → scan → 轮询 ready → lifecycle=active，不新增端点 / 表 / 迁移）送入某 KB。
- **四眼审批（ADR-048 #4）**：本 CLI 全步带 token，故 `approve` 的 actor 已知；同一身份自审必被 403。流程用**两个 dev-login 身份**——上传者（`ingest-eval-corpus@local.dev` / `super_admin`）走上传递交与 scan / 读取，审批人（`ingest-eval-reviewer@local.dev` / `kb_admin`）**只**用于 `approve`；并对首篇发一次自审探针钉住 403（非 403 即失败点名逻辑 id）。**成员边界（显式）**：`AUTH_ENFORCE=false`（默认）时审批人无需是该 KB 成员即可通过（成员闸 `whenEnforced`）；`AUTH_ENFORCE=true` 时审批人**必须是该 KB 成员**，CLI **不自动加成员** —— 需人工先加，否则 `approve` 被拒、CLI 如实失败并点名逻辑 id。
- **逻辑 id 由目录结构派生**（`ingest-samples/<name>` / `l2-corpus/<name>`），禁止脚本手抄；权威对照是两份 fixtures README，由 `tests/eval/eval-corpus-map.test.ts` 机械核对（gold 逻辑 id ⊆ 派生 id）。
- **账本形状 / 指纹 / 解析**唯一锚在 contracts 子路径 `@strict-rag/contracts/eval-corpus-ledger`（含 `node:crypto`，故不进主入口）：`buildCorpusLedger` / `parseCorpusLedger` / `corpusFingerprint` / `resolveExpectedDocIds` / `summarizeDocMap`。账本落 `artifacts/`（运行产物不入库）。
- **跑批解析落点**：`runL1Golden` 在 `hitAtKCase` **之前**解析 `expectedDocIds`（`docMapPath`）。**未映射继续算 miss**（原样保留逻辑 id，绝不变成 `null` / 该门不适用）；报告顶层三键 `docMapSource` / `docMapResolved` / `docMapUnmappedIds` 如实标注来源，**都不进任何判定**（`PILOT_HARD_GATES` / `evaluateAdr046Bind` 公式一字不动）。
- **worker 侧（2026-09-29 起接账本）**：来源 = worker 进程级 env `L1_DOC_MAP`（与 api CLI **同名同义**，**不是** job payload；一进程一份账本，换账本须重启进程 —— env 是模块加载期快照）。`consumer.ts` 把 env 快照里的路径传给 `runL1Batch({ docMapPath })`（空 / 纯空白 = 未设置）；`run-l1-batch.ts` 在 `hitAtKCase` **之前**调 `resolveCorpusLedgerForRun` 解析逻辑 id，读取时机是**每次 job**（路径取 env 快照、文件内容每次 job 重读）。**失效三态**：未设置 = 与改动前逐位一致（三键 `none` / `0` / `[]`，缺映射继续算 miss）；设置但账本不可用（缺文件 / 非 JSON / 形状违约 / `kbId` 或指纹不符）→ 抛 `CorpusLedgerError` → `consumer.ts` 捕获后 `markFailed`（**响亮失败**，绝不降级成「未设置」）；设置且自洽 → 解析。落库白名单（`eval/persist.ts` 的 `saveReport`）三键改**取报告真值**（未设账本时恰等于旧常量）。**判定仍在 api 侧**：三键与账本解析都不进 `PILOT_HARD_GATES` / `evaluateAdr046Bind`。共享实现 = contracts 子路径 `@strict-rag/contracts/eval-corpus-ledger-file`（api 侧 `corpus-fixtures.ts` / `corpus-map.ts` 改为其纯 re-export，import 路径一个字未变）。

#### 产物与 git

| 路径 | 提交？ |
|------|--------|
| `fixtures/l1/gold.yaml` · `README.md` · `sample-report.md` | ✅ |
| `artifacts/l1-last-run.*` | ❌ gitignore |
| mock 数字进业务签字页 | ❌ **禁止** |

#### 依赖注入（单测 / CI）

```ts
type RunL1Options = {
  goldPath: string;
  outDir: string;
  kbId: string;
  maxCases?: number;
  tenantId?: string;
  userId?: string;
  /** 注入假 execute，避免 live LLM */
  execute?: (params: ExecuteAskParams, deps?: ExecuteAskDeps) => Promise<ExecuteAskResult>;
  executeDeps?: ExecuteAskDeps;
  /** 写入 PG eval_runs；默认看 L1_PERSIST_EVAL */
  persistEval?: boolean;
};
```

- 默认 `execute = executeAsk`，且批跑硬编码合并 `{ skipTrace: true, ...executeDeps }`。
- **禁止**批跑写 ask_traces（海量噪声 + 拖慢 + 污染观测）。

### 4. Validation & Error Matrix

| 条件 | 行为 |
|------|------|
| 无 `L1_KB_ID`（CLI） | stderr + **exit 2** |
| `L1_MAX_CASES` 非正数 | stderr + **exit 2** |
| gold 文件不可读 / 非 JSON | `GoldLoadError` → CLI **exit 2** |
| `cases` 空或非数组 | `GoldLoadError` |
| 单 case 缺 id/question 或 type 非法 | `GoldLoadError`（含 index） |
| 单题 `executeAsk` **throw** | 该题 `outcome=error`；矩阵不加格；继续串行 |
| 单题返回 `graph.status` | 按 `cellFor` 入格 |
| 其它未捕获异常（非 GoldLoad） | CLI **exit 1** |

进程退出码：**0** 成功写报告（含 errorCount>0 的「有失败题」）；**2** 配置/金标加载；**1** 意外。

### 5. Good / Base / Bad Cases

- **Good**：`L1_KB_ID` 已设 · gold ≥1 · mock 或注入 `execute` · 串行完成 · 报告 `mode` 正确 · `artifacts/` 写出。
- **Base**：默认 gold 30 题 · `skipTrace: true` · 覆盖率公式 · error 不进 A–D。
- **Bad**：把 `RETRIEVE_ES_MODE=mock` 的 coverage 写进业务签字 / 宣称 L1 门禁 PASS；并行批跑打爆 Gateway；批跑不设 `skipTrace`；引入 `yaml` 包只为解析 JSON 形 gold；CI 强依赖 live LLM。

### 6. Tests Required

| 层 | 文件 | 断言点 |
|----|------|--------|
| 纯函数 | `tests/eval/l1-matrix.test.ts` | A/B/C/D 映射；error→null；accumulate error 增量；coverage 分母 0→null |
| CLI/IO | `tests/eval/l1-cli.test.ts` | loadGold 合法/非法；`resolveEvalMode` 三态；注入 execute 得矩阵；写出 json+md；error 题不污染格；live+30/30→signoffEligible；mock/截断→false |
| 集成（可选） | 同文件 mock graphDeps 路径 | `runL1Golden` + `executeDeps.graphDeps` 不撞 DB trace |

**CI 边界**：单元/注入测必须绿；**不要求** 默认 PR 流水线跑真实 Gateway + ES。

本地 live 烟测（人工）：

```bash
L1_KB_ID=<uuid> L1_MAX_CASES=5 pnpm --filter @strict-rag/api exec tsx src/scripts/run-l1-golden.ts
```

### 7. Wrong vs Correct

#### Wrong

```ts
// 并行 Promise.all 批跑 live → 打爆网关 / 乱序难复现
await Promise.all(cases.map((c) => executeAsk(...))); // 无 skipTrace

// mock 数字当签字
// coverage=0.93 (mode=mock) → 业务验收 PASS  // 禁止
```

#### Correct

```ts
for (const c of cases) {
  try {
    const result = await executeAsk(params, { skipTrace: true });
    outcome = result.graph.status;
  } catch {
    outcome = 'error'; // 不计 A–D
  }
  accumulate(matrix, c.type, outcome);
}
// 报告头必须含 mode；mock 禁止写入业务签字页
```

---

## Design Decision: CLI 直调 executeAsk（非 HTTP 自调用）

**Context**：需要可脚本化批跑，且能注入 graph 做 CI。

**Options**：
1. HTTP 打本机 `/ask` — 需起服、鉴权、难注入  
2. **直调 `executeAsk`** — 同进程、可 `graphDeps` / `skipTrace`  

**Decision**：选项 2。CLI 与 route 共享同一业务入口；route 仍只调 `executeAsk`。

**Extensibility**：B6 看板只读报告 artifact / `eval_runs` 表（`L1_PERSIST_EVAL`）；批跑逻辑仍可复用 `runL1Golden`。

---

## Design Decision: gold.yaml 内容 JSON + 零 yaml 依赖

**Context**：design 冻结扩展名 `.yaml`；解析库增加 catalog 与体积。

**Decision**：文件扩展名保留；内容合法 JSON；`JSON.parse`。`.json` 路径亦可被 `loadGold` 读取。

**禁止**：为 seed 单独加 `yaml`/`js-yaml` 依赖（除非未来真 YAML 多文档需求 + ADR）。

---

## Design Decision: CI = 矩阵纯测 + mock 注入，非 live 门禁

**Context**：默认 Gateway/ES mock；live 成本与 flaky 高。

**Decision**：
- 自动化钉 **cell 映射 / coverage / loadGold / 注入 execute**  
- live 全量 ≥30 为人工/后续 B10-followup 签字路径  
- 报告 **强制 `mode` 字段**；文案禁止把 mock 当生产门禁

---

## Design Decision: error 出 A–D

**Context**：throw / 基础设施失败 ≠「系统错误答了不可答题」。

**Decision**：`outcome=error` → `cellFor=null`；只增 `errorCount`。避免 error 灌进 C 或 B 扭曲覆盖率。

---

## Convention: 批跑必 skipTrace

**What**：`runL1Golden` 调用 `executeAsk` 时始终 `skipTrace: true`。

**Why**：批跑会生成大量 ask_traces 行；评测不需要落库；单测也不该依赖 PG trace。

**Related**：`ExecuteAskDeps.skipTrace` 定义于 `services/ask/execute.ts`；观测指标 `recordAskResult` 仍会走（可接受；若未来要静默可再开 `skipMetrics`，**非本窗**）。

---

## Convention: turbo 声明 L1_* env

**What**：凡测试/脚本可能读 `process.env.L1_*` 的 task，在 `turbo.json` 登记。

**Why**：未声明 → turbo `no-undeclared-env-vars` 失败，本地绿 CI 红。

---

## Don't

| 禁止 | 原因 |
|------|------|
| mock coverage 写进业务签字 / 宣称「L1 门禁 PASS」 | 产品红线；仅工程 seed |
| `L1_MAX_CASES` 截断 live 冒烟仍标 `signoffEligible=true` | 规模门；须两类各≥30 |
| 批跑省略 `skipTrace` | 污染 traces |
| CI 强制 live LLM 全量 | flaky / 成本；与本窗边界冲突 |
| 把 `false_premise` 算进 A 侧分母 | 覆盖率仅 `A/(A+B)`，分母只有 answerable |
| 在 route 内复制 2×2 逻辑 | 复用 `eval/l1-matrix` |
| 宣称 B10 业务完成 / 全文评测平台完成 | 本窗 = 工程底座 |

---

## 交叉引用

- 信任路径：[ask-pipeline](./ask-pipeline.md)（`executeAsk` / `GraphDeps`）  
- 质量红线：[guides/quality-redlines](../../guides/quality-redlines.md)  
- 目录：[directory-structure](./directory-structure.md)  
- Fixture 说明：`fixtures/l1/README.md` · 跑法：`apps/api/README.md`  
- IS：`docs/module-status/api.md` · backlog B10 挂账 `08-06-project-backlog`  
- 已做（工程）：`eval_runs` 表 + `persistEvalRun` / `L1_PERSIST_EVAL` · gold≥60 · OPS-1 `retrieve_mode`/`signoffEligible` · B10-RACI `fixtures/l1/RACI.md`  
- **P2 底线 HTTP**：`routes/eval.ts` · `eval.run` · 空题集 400 · 入队不跑完；内口 `POST /internal/eval/execute-ask`（`x-eval-internal-token`，`skipTrace`）；矩阵函数在 `@strict-rag/contracts`  
- 未做：业务人签 · 在线抽样 · GET `/jobs/:id` 通用账本 · 反馈回流黄金集；L2 题面 + runner + 可选 persist（≠ 准出）→ [l2-eval](./l2-eval.md)。τ 扫描已挂 L1 批跑（不写 env、不新开 `tau_sweep` 入队、不进签字公式）。Judge AUROC 已挂独立校准集（来源三态 + 规模门 ≥100 已进 api 侧放行判定；不新开 `verifier_calib` 入队；live judge 真跑仍缺口）  
- ADR-046 快照：`runL1Golden` 写 `l1-gate-snapshot.json` 并挂 `gateSnapshot`/`gateVerdict`；默认不代签 → `signedPackage=false`；coverage=0 / 全 `internal_guard` → `businessPass=false`  
- 签字禁令：`signoffEligible=true` = `retrieve_mode=live` **且** 两类各≥30；**≠** 自动业务 PASS；coverage=0 / 全 `internal_guard`（无真实 Gateway）**禁止**当成绩单；人审仍禁「仅 env Gateway 绿灯」（见 live profile §4.5）  

