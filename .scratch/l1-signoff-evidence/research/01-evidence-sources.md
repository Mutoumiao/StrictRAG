# 研究：L1 签字证据面的事实底账（工单 01）

> 只读侦察。每条结论指向**具体路径 + 符号名**；拿不准处写「未核实」。行号只出现在本 `.scratch/` 文件里。
> 域：StrictRAG（`prds/08-quality/02-evaluation-and-gates.md` 0.4.34；本次逐行核过源码，日期 2026-09-23）。

---

## 1. 人工抽检

### 1.1 PRD §6 那一行的原文上下文

**`prds/08-quality/02-evaluation-and-gates.md` §6「试点默认门禁包（与愿景一致，可签字附件）」**（约 128–140 行）：

```
| 指标 | 试点默认 | 硬/软 |
| 人工抽检 | ≥20 条，错 ≤1 | 硬 |
```

上下文要点：
- §6 表头把整张表定位为「**可签字附件**」，7 行里 6 行硬门 + 1 行（ask P95）建议。
- §6 末尾一句：「**权威账本**：PG `eval_runs` + CI 报告。Langfuse **不单独放行**。」
- §6.1 把 L1 / L2 / 在线抽样 三类数据分列，**未**说抽检属于哪一类、由谁产。§6.1 只规定「辅助维度不进硬门；禁止 `aux_*` 进通过条件」。

**逐个查过的位置与结论**：

| 查过的位置 | 有没有对「人工抽检」的进一步约束 | 结论 |
|---|---|---|
| PRD §4（Verifier 校准，约 93–115） | 无。只讲校准集规模 ≥100 / AUROC / 换模触发 / `run_type` 账本 | 不涉及 |
| PRD §5（风险-覆盖扫描，约 117–127） | 无。伪码 `for tau in grid: run_eval(seed=fixed, tauClaim=tau, gold_ids=fixed)` → C 率 vs 覆盖率 → 选 tau* → 写 KB config + `eval_runs`；末句「禁止只钉 0.3」 | **未提抽检**；但它是 §8 `seed` 字段的唯一文档出处 |
| PRD §6.0（ADR-046 加严包，约 143–157） | **有间接约束**：加严方向含「抽检更严」；四要素含「KB 配置快照绑定 `eval_runs`」 | 抽检是**硬门身份的一部分**（门禁包 7 键之一），但不给登记形状 |
| PRD §7（再认证触发表，约 195–216） | 18 行里 5 行出现「L1 抽样」（`变更批量 judge prompt` / `route 规则种子` / `rewrite session prompt` / `claim_split` / `rerank 主备切换`） | 这里的「抽样」= **重跑范围的抽样**，与「人工抽检」不是同一件事（不可混用） |
| PRD §8（可复现字段） | 无抽检字段 | 抽检不在 §8 字段表内 |
| PRD §9（验收标准，约 229–243） | 11 条 checkbox 里**无一条**提抽检。最接近的是「试点默认数字可打印为签字页」「回流黄金集 RACI 可执行」「固定 gold 两次 run 可对比」 | **无进一步约束** |
| `prds/00-product/01-vision-and-success.md` §4.1（约 78–87） | 有：「人工抽检 \| **证据支持** \| **发布前必做**」 | 「错」的候选口径之一 = 「证据不支持」 |
| 同上 §4.1.1（约 89–98） | 「人工抽检 \| ≥ 20 条，错误 ≤ 1 \| **业务方参与**」 | **谁做 = 业务方参与**（唯一一处「谁」） |
| 同上 §4.1.2（约 105–118） | 加严含「抽检更严」；放宽含「取消硬门、抽检变松」→ 须 **ADR + 合规会签 + 产品 A** | 抽检变松 = 改冻结语义 |
| `prds/12-delivery-guides/01-业务一页纸.md`（约 117 行） | 「人工抽检 \| 抽检样本错误条数达标 \| **门禁报告可归档**」 | **结论写哪 = 门禁报告**（唯一一处「写哪」，且是白话稿非契约） |
| `prds/12-delivery-guides/02-产品说明.md`（约 603 行） | 试点默认表同数字 | 无新约束 |
| `prds/10-delivery/03-acceptance-scenarios.md` 剧本 C（约 62–75） | 剧本 C「可复现评测与签字」5 步：黄金集 1:1 seed 固定 → τ 扫描 → Judge 校准 AUROC 报告 → Hit@k → 签字页（对照试点默认门禁 + RACI 签字）。末尾注：「在线抽样分**不得**作为本剧通过条件」+ ADR-061 双轨说明 | **剧本 C 无抽检步骤** |
| 同上 剧本 T（约 335–352） | T1–T10 全是「加严/放宽 diff 校验 + 四要素 + 配置绑定」；T4 是四要素齐 → 可生效加严包 | 不涉及抽检登记形状 |
| 同上 签字页必含行（约 596–606） | 5 行：不含连续追问承诺 / 含多会话壳 / **L1 门禁数字达标** / rewrite 默认关 / 敏感语料未入池 | **没有抽检行** |

**结论（本组第 1 问）**：全仓**没有任何一处**规定人工抽检的**登记面形状 / 何时做 / 单次还是累积 / 结论落在哪个可核对的载体**。
- 「谁」最明确的只有 `prds/00-product/01-vision-and-success.md` §4.1.1 的「业务方参与」；
- 「何时」只有「发布前必做」（同文件 §4.1）；
- 「写哪」只有白话稿的「门禁报告可归档」（`prds/12-delivery-guides/01-业务一页纸.md`）；
- 「多少」= ≥20 条、错 ≤1（PRD §6 与 vision §4.1.1 同值）。
- 与 map.md「冻结文本边界」判断一致：**形状属实现选择，不是改语义**。

### 1.2 既有可复用形状（全仓搜「抽检 / 复核 / spot / manual / review」）

逐个给出路径 + **它今天实际承载什么**：

| 形状 | 路径 | 今天实际承载 | 与「评测抽检」的距离 |
|---|---|---|---|
| `pending_review`（跨 doc 去重入审） | 契约 `packages/contracts/src/ingest/dedupe-conflict.contract.ts`（`POST …/documents/:docId/dedupe-conflicts/:chunkId/resolve`）· 服务 `apps/api/src/services/dedupe-conflict.ts`（`DEDUPE_STATUS_PENDING_REVIEW` / `resolve`）· 写入 `apps/worker/src/ingest/pipeline.ts`（写 `dedupeStatus='pending_review'` + `duplicateOf`） | **chunk 级近重复的「人工二选一」**；状态机「待审 → 处理完回 NULL」 | 名字像，域完全不同（入库去重，不是评测） |
| Feedback 队列 + 提名入黄金集 | 路由 `apps/api/src/routes/feedback.ts`（`POST /ask/:requestId/feedback` · `GET /knowledge-bases/:kbId/feedback-queue` · `PATCH /feedback/:feedbackId`；权限 `feedback.queue`，`status='promoted_to_gold'` 另需 `eval.run`）· 服务 `apps/api/src/services/feedback.ts` · admin 页 `apps/admin/src/app/(ops)/feedback/` | **用户反馈分拣 → 提名入黄金集**（PRD §1.1 RACI 的「队列分拣（R）/ 提名」两步） | **这是全仓唯一「人工处理队列 + 状态 PATCH + 提名入评测集」的既有形状**，与抽检登记最同构 |
| gold 审核 RACI | `fixtures/l1/RACI.md` | **文件产物**：具名 owner（业务 A / 测试 R / 工程 C / 产品 I）+ 题面审核记录表（模板一行）+ 业务签字页检查项 §3（3 个 checkbox，其中 1 个未勾） | 是「人签记录」的既有载体；`apps/api/src/services/eval-runs.ts` 注释明写「RACI 人签是**文件产物**（`fixtures/l1/RACI.md`），不在库里，故不构成过滤条件（不代签）」 |
| admin `/eval` 薄页 | `apps/admin/src/app/(ops)/eval/_components/eval-workspace.tsx` | 列 run + 展示 hitAtK / tauStar / judgeAuroc + 入队 L1/L2；**无任何登记控件** | 只有读与「入队」，没有「人填一个数」的口 |
| KB 设置页 `qualitySnapshot` 只读回填 | `apps/api/src/routes/kb-settings.ts`（`defaultQuality()` → `evalRunRepo.latestSignoffPackage(kbId)`） | 从 `eval_runs` **读时派生** gatePackageId / effectiveAt，无合格 run → null | 是「签字包只读回填」的先例，但无写入口 |
| `lifecycle='needs_review'`（OCR 低置信） | `packages/contracts/src/ingest/document.contract.ts`（`needs_review`）+ admin `document-ops-label`（显示「待审」） | 文档级待人工复核（OCR） | 域不同 |
| `source: 'manual'` | `apps/api/tests/acl/superadmin-bootstrap.test.ts` | 超管引导的**测试夹具字段**，非生产形状 | 无关 |
| 其余命中 | `packages/contracts/src/ask/ask.contract.ts` 的 `preview`（证据快照预览截断）、`EVIDENCE_SNAPSHOT_PREVIEW_MAX` 等 | 词命中，非「审阅」语义 | 无关 |

**结论（本组第 2 问）**：**没有任何既有「评测人工抽检」的登记面**。最近的两个可复用形状是：
1. **feedback 队列**（HTTP 端点 + 权限码 + 状态机 + 提名入集）——若抽检要「多人、多轮次、可 PATCH 状态」，形状同构；
2. **`fixtures/l1/RACI.md`**（文件账本）——若抽检要「一次一签、随签字包归档」，形状同构。

另注：`apps/admin/src/app/(ops)/approvals/` 是**文档审批**页，与评测无关；`feedback.queue` 权限码在 `packages/admin-catalog/src/permissions.ts` 与 `menu-tree.ts`（菜单 `id: 'feedback'`，href `/feedback`）。

### 1.3 `humanSpotMin` / `humanSpotErrorMax` 的全部读点

定义：`apps/api/src/eval/adr046-snapshot.ts` 的 `PILOT_HARD_GATES`（`humanSpotMin: 20` / `humanSpotErrorMax: 1`）。

**全仓读点（穷举，共 4 类）**：

| 读点 | 位置 | 读它做什么 |
|---|---|---|
| `MAX_KEYS` | `adr046-snapshot.ts`（`const MAX_KEYS = new Set<HardGateKey>(['cRateMax', 'humanSpotErrorMax'])`） | 只被 `compareHardGates` 用于**方向判定**（max 类：候选更大 = looser） |
| `compareHardGates(candidate, pilot = PILOT_HARD_GATES)` | 同文件 | 逐键比 `candidate[key]` vs `pilot[key]`，判 looser / stricter |
| `gatesComplete(gates)` | 同文件 | **遍历 `Object.keys(PILOT_HARD_GATES)`** 做「是有限数」的**存在性检查**（含 `humanSpotMin` / `humanSpotErrorMax`）→ `fourElementsOf` 的 `configSnapshot` |
| `bindQualitySnapshotToEval` | 同文件 | `gates = { ...(input.gates ?? PILOT_HARD_GATES) }` → 落进 `snapshot.gates`（进报告 JSON 与 `l1-gate-snapshot.json`） |
| `runL1Golden` / CLI `main()` | `apps/api/src/scripts/run-l1-golden.ts` | 只把 `PILOT_HARD_GATES` 当 `gates` 默认值传入（不读具体键） |
| 测试 | `apps/api/tests/eval/adr046-snapshot.test.ts`（T1 `snapshot.gates` ≡ `PILOT_HARD_GATES`；P6 断言键名不得以 `aux` 开头）、`adr046-hard-gates.test.ts`（`{...PILOT_HARD_GATES}` 作夹具）、`pilot-gates-parity.test.ts`（只比 `coverageMin` / `cRateMax`） | 断言形状 |

**关键事实：`evaluateAdr046Bind`（判定函数）从不读这两个键。** 判定处只读五个：`coverageMin` / `cRateMax` / `judgeAurocMin` / `hitAt20Min` / `citationCompleteMin`，且注释写明「门限一律读 `PILOT_HARD_GATES`，禁止在判定处写裸数字」。
`gatesComplete` 对 `humanSpotMin` 的「读」只是 `Number.isFinite` 检查 —— **没有任何一处把抽检条数/错误数与这两个常量比较**。

即：**无生产者、无承载字段、无判定读点**（与 map 基线一致），且**唯一的数值读点也不读值**。

---

## 2. 校准打分器

### 2.1 完整调用链

**定义层（纯函数，contracts，api/worker 共用）**：`packages/contracts/src/eval/l1-matrix.ts`

| 符号 | 行为 |
|---|---|
| `parseJudgeLabel(raw)` | `1` / `'supported'` → 1；`0` / `'unsupported'` → 0；其它**抛错**（「禁止把 gold type 当 label」） |
| `parseJudgeCalibration(raw)` | 输入形状 = `{ cases: [{ id, claim, evidence, label }] }`；`id`/`claim`/`evidence` 缺或空串抛错；label 走 `parseJudgeLabel`；**要求双类都有**（`hasPos && hasNeg`），否则抛错 |
| `auroc(pairs)` | Mann-Whitney；任一类为空 → `null`（**禁止**写成 1 或 0.5）；平局计 0.5 |
| `judgeAurocFromScored(cases)` | 逐条 `{label, score}`：脏 label 抛错；score 走 `parseMinSupport`（缺/非有限/越界 → 跳过）；跳过后任一类空 → `auroc=null`；返回 `{auroc, scored}`，`scored` = **有效对数** |
| `parseMinSupport(raw)` | 非有限或不在 [0,1] → `null`（脏分数不当抛错，避免一次坏 judge 拖垮整批扫描） |

**「有没有打分器」的判定点（两处，形态不同）**：

- **api CLI**：`apps/api/src/scripts/run-l1-golden.ts` 的私有函数 `scoreJudgeAuroc(opts)`
  - `if (!opts.scoreJudge) return { judgeAuroc: null, judgeAurocScored: 0 }` → **缺省不跑 live judge**；
  - 校准题来源：`opts.judgeCalibCases !== undefined ? [...] : loadJudgeCalib(opts.judgeCalibPath ?? defaultJudgeCalibPath())` → 显式传空数组时**不回落仓根夹具**（`l1-cli.test.ts` 有专测钉住）；
  - 长度不符 → 抛 `GoldLoadError('scoreJudge length …')`（禁止用子集写成 1）。
- **worker**：`apps/worker/src/eval/run-l1-batch.ts` 内联
  - `if (opts.scoreJudge && opts.judgeCalibCases && opts.judgeCalibCases.length > 0)` → **worker 没有默认夹具**，两个入参都要给才跑；
  - 长度不符 → `throw new Error('scoreJudge length …')`。

**结果如何进报告**：
- api：`L1Report.judgeAuroc` / `judgeAurocScored`（`run-l1-golden.ts` 类型定义处 + `runL1Golden` 末尾赋值）；
- worker：`L1BatchReport.judgeAuroc` / `judgeAurocScored`（`run-l1-batch.ts` 类型 + `return` 对象）。

**结果如何进判定**：
- 只有 api CLI 一侧：`runL1Golden` 把 `judgeAuroc: report.judgeAuroc` 传进 `bindQualitySnapshotToEval` → `evaluateAdr046Bind` 的 `judgeAurocOk = input.judgeAuroc != null && input.judgeAuroc >= gates.judgeAurocMin`（null → `reason='judge_auroc_missing_or_below_min'`，fail-closed）。
- **worker 批跑不进判定**：`apps/worker/src/eval/persist.ts` 的 `saveReport` 只落库（`reportJson` 白名单 + 列），worker 侧**没有** ADR-046 绑定/判定调用点（全仓 `evaluateAdr046Bind` 的调用方只有 `bindQualitySnapshotToEval` 与 api 测试）。

### 2.2 两条生产入口今天在什么条件下不注入打分器

**api CLI**（`apps/api/src/scripts/run-l1-golden.ts` 的 `main()`）：
- 只读 4 个 env：`L1_KB_ID`（必需）/ `L1_MAX_CASES` / `L1_GOLD_PATH` / `L1_OUT_DIR`；
- 调用 `runL1Golden({ goldPath, outDir, kbId, maxCases })` —— **不传 `scoreJudge`、不传 `judgeCalibCases`**；
- `scoreJudge` 是 `RunL1Options` 的**函数入参**（类型注释：「按校准题打分。缺省不跑 live judge → judgeAuroc=null」）；
- **全仓无 `L1_JUDGE_*` / 任何打分器相关 env**（`apps/api/src/env.ts` 全文无 judge/calib/auroc 变量）。
→ 结果：**生产路径 `judgeAuroc` 恒 `null`**（`adr046-snapshot.ts` 文件头注释明写「judgeAuroc 在生产入口今天恒为 null（CLI `main()` 不传 `scoreJudge`、worker consumer 同），故 `businessPass` 在生产路径上**不可达**」）。

**worker**（`apps/worker/src/eval/consumer.ts` 的 `handleEvalJob`）：
- 调 `runL1Batch({ kbId, cases, retrieveMode, execute, maxCases })` —— **不传 `judgeCalibCases` / `scoreJudge`**；
- `EvalConsumerDeps` 只有 `persist` / `executeFor` / `executeL2For` —— **没有打分器注入口**；
- 队列载荷 `EvalJobDataSchema`（`packages/contracts/src/async/eval-job.ts`）是 `.strict()`，字段仅 `tenantId` / `kbId` / `runId` / `userId` / `retrieveMode` / `runType` / `requestId?` / `maxCases?` —— **payload 也无法携带打分器**（有专测断言 `safeParse({...valid, tauClaim: 0.4}).success === false`）；
- `apps/worker/src/env.ts` 无任何 judge/calib 变量。

**结论**：**两条生产入口都没有任何 env / 参数 / payload 注入路径**。打分器注入**只存在于单测**（`apps/api/tests/eval/l1-cli.test.ts` 与 `apps/worker/tests/eval/run-l1-batch.test.ts`）。

### 2.3 `fixtures/l1/judge-calibration.json` 确切形状与报告计数

**夹具**（`fixtures/l1/judge-calibration.json`）：
- 根对象：`{ "cases": [ … ] }`；
- **题数：8**；
- 每条字段：`id`（`jc-pos-1`…`jc-pos-4` / `jc-neg-1`…`jc-neg-4`）、`claim`（中文断言）、`evidence`（中文证据句）、`label`（字符串 `"supported"` / `"unsupported"`）；
- 标签分布：**4 正 4 负**（均衡，但远低于 PRD §4 的「≥100 条」）；手工 seed（`evidence` 是 `claim` 的同义改写，非真实语料）。

**报告里除 `judgeAuroc` 外的计数**：
- **已有** `judgeAurocScored`（api 与 worker 两处都有；api 的 MD 渲染为 `judgeAuroc | <值> (<scored>)`）。
- **没有** `judgeAurocTotal` / 校准集规模 / 来源标记（live / mock / 缺测）/ `verifier_calib` 入队。
- **DTO 侧缺口**：`apps/api/src/services/eval-runs.ts` 的 `extraStatsFromReport` **只透出 `judgeAuroc`**（不透出 `judgeAurocScored`）；契约 `packages/contracts/src/eval/eval-run.contract.ts` 的 `EvalRunSchema` 也只有可空 `judgeAuroc`。

### 2.4 「live vs mock」在仓库里已有的统一判别形状

**共同范式**：`*_MODE` 枚举 env（默认 mock 态）+ 报告里落**三态字符串**（`mock` / `live` / `unknown`）+ 判定处只认最高态。

| 判别 | 定义处 | 取值 | 用法 |
|---|---|---|---|
| `RETRIEVE_ES_MODE` | `apps/api/src/env.ts`（`z.enum(['mock','http']).default('mock')`） | `mock` \| `http` | 经 `resolveEvalMode`（`run-l1-golden.ts`）与 `resolveRetrieveMode`（`apps/api/src/services/eval-runs.ts`）映射为 **`mock`→`mock` / `http`→`live` / 其它→`unknown`**，落 `report.retrieve_mode` / `report.mode` / `eval_runs.retrieve_mode` / `EvalJobData.retrieveMode` |
| 三态类型 | `apps/api/src/eval/adr046-snapshot.ts`（`RetrieveMode = 'mock' \| 'live' \| 'unknown'`）、`packages/contracts/src/eval/l1-matrix.ts`（`EvalRetrieveMode`）、`packages/contracts/src/eval/eval-run.contract.ts`（`EvalRetrieveModeSchema`） | 同上 | `computeSignoffEligible` 只认 `live` ∧ 两类各 ≥30 |
| `GATEWAY_MODE` | `apps/api/src/env.ts` | `mock` \| `http` \| `''`（空 = 按 `GATEWAY_BASE_URL` 推断） | 模型网关选 mock/http 实现 |
| `INGEST_ES_MODE` | `apps/worker/src/env.ts` | `mock` \| `fail` \| `http` | 入库 sparse 适配 |
| `INGEST_EMBED_MODE` | `apps/worker/src/env.ts` | `mock` \| `fail` \| `http` | 入库向量 |
| `STORAGE_MODE` | api / worker env | `local` \| `s3` | 对象存储 |
| `INGEST_SCAN_MODE` | `apps/worker/src/env.ts` + `apps/worker/src/scan-mode-policy.ts` | `mock_clean` \| `mock_infected` \| `off` \| `on` | 启动策略 + 运行时拦截（`isScanModeRuntimeBlocked`） |
| `INGEST_CONTEXTUALIZE_MODE` | `apps/worker/src/env.ts` | `off` \| `http` | **最接近「声明 + 实测回退」的两层形状**：`off` 时整批走 L0；`http` 时逐块真调，**成功才写 `l1_llm`，任一块失败即回退 L0 并记 `l0_fallback`**（`apps/worker/src/ingest/pipeline.ts`；有专测 `apps/worker/tests/ingest/context-mode-obey.test.ts`） |
| 在线抽样 ≠ 门禁 | `prds/08-quality/03-langfuse-observability.md` §5 | — | 文档层区分，代码未落地 |

**供裁定挑同构做法的事实**：
- 全仓**没有**「由 Gateway 回包声明来源」的先例；
- 全仓**没有**「由调用参数显式传入来源枚举」的先例（调用参数今天只有函数/布尔）；
- 唯一「声明 + 实测回退标记」两层形状是 `INGEST_CONTEXTUALIZE_MODE` + `contextSource`（`l0` / `l0_fallback` / `l1_llm`，契约 `CONTEXT_SOURCES` / `resolveContextSource`）。
- 「三态字符串 + 判定只认最高态」是全仓最一致的既有做法（`mock|live|unknown`）。

---

## 3. §8 可复现字段

### 3.1 §8 字段逐条映射（PRD `prds/08-quality/02-evaluation-and-gates.md` §8）

| # | §8 字段 | 今天能从哪取到 | 结论 |
|---|---|---|---|
| 1 | **seed** | 无任何随机种子载体。L1 批跑唯一随机源是 `uuidv7()` requestId（不影响判定）；τ 扫描网格是常量 `TAU_SWEEP_GRID`（contracts `l1-matrix.ts`）。`apps/api/src/scripts/seed-es-sparse-probe.ts` 是 ES 探针脚本，非 eval seed | **取不到**（PRD §5 伪码里的 `seed=fixed` 是文档纪律） |
| 2 | **models** | env `GATEWAY_CHAT_MODEL` / `GATEWAY_EMBED_MODEL` / `GATEWAY_RERANK_MODEL`（`apps/api/src/env.ts`）；KB 级在 `model_bindings` 表（`packages/db/src/schema/system/model-bindings.ts`：`purpose` / `primary_ref` / `fallback_refs`），由 `apps/api/src/services/gateway/resolve.ts` 组装 | **可取得但今天没取**（L1 CLI 完全不读） |
| 3 | **fallbackChains 版本** | 链**内容**可取（`model_bindings.fallback_refs` jsonb + `resolve.ts` 的 fallback 展开）；**「版本」无载体**（无版本号/时间戳/序号） | **版本取不到**；只能改算「链内容哈希」（语义形似而非 PRD 版本） |
| 4 | **retrieveK** | `apps/api/src/graph/budget.ts` 的 `retrieveBudgetForMode(mode)`：fast → 60，balanced/strict → 150；L1 CLI 不传 mode，`apps/api/src/services/ask/execute.ts` 默认 `'balanced'` → **150** | **可派生**（报告无该字段） |
| 5 | **rerankTopN** | 同 `budget.ts`：fast → 10，balanced/strict → 20；L1 默认 balanced → **20** | **可派生** |
| 6 | **tauClaim** | `env.TAU_CLAIM`（ADR-007 唯一源）→ 已落 `gateSnapshot.tauClaim`（`run-l1-golden.ts`） | **已有（api 侧）**；**worker 侧 L1 批跑不落 tau** |
| 7 | **crag\*** | 无实现。`apps/api/src/graph/run.ts` 注释「无 CRAG / grade / refine / multi_hop」；契约 `packages/contracts/src/kb/kb-settings.contract.ts` PATCH 白名单注释「禁：tauClaim / **crag\*** / allowDegradedGenerate / sessionRewrite* / retrieveK / route / 密钥等」，且有专测拒 `cragOk` | **取不到（功能未实现）→ 记债** |
| 8 | **contextMode** | 入库侧：契约 `packages/contracts/src/ingest/chunk-strategy.ts`（`CONTEXT_MODES` / `parseContextMode`）；值在 KB chunk strategy `paramOverrides.contextMode` 或文档 `chunkStrategyParams.contextMode`（`apps/worker/src/ingest/pipeline.ts` 读） | **可取得但是入库参数**；ask/L1 报告今天不读。语义上是「语料制备」而非「本次 run 配置」 |
| 9 | **mode** | **歧义**：`L1Report.mode` 今天只是 `retrieve_mode` 的历史别名（`run-l1-golden.ts` 类型注释「与 retrieve_mode 同义（历史字段）」）；PRD 别处的 `mode` 指 ask 档位（`AskMode` = strict/balanced/fast，`kb-settings.contract.ts`） | **须裁定指哪个**；两者今天都存在且不同值域 |
| 10 | **promptVersions** | 无版本载体：`apps/api/src/graph/prompts.ts` 只有函数（`rewriteSystemPrompt` / `rewriteUserPrompt` / `generateSystemPrompt` / `generateUserPrompt` / `claimSplitSystemPrompt` / `claimSplitUserPrompt` / `judgeSystemPrompt` / `judgeUserPrompt`），**无版本常量** | **版本取不到**；prompt 文本可哈希（见 3.3） |
| 11 | **题面 ID 哈希** | api CLI：`loadGold` 返回的 `id` 列表；worker：`gold_questions.case_key`（`apps/worker/src/eval/persist.ts` 的 `loadGold`） | **可算**（注意两入口 ID 载体不同：`id` vs `caseKey`，口径须同形） |
| 12 | **校准集哈希** | api CLI：`defaultJudgeCalibPath()` → `fixtures/l1/judge-calibration.json` 字节；worker：**无路径**（只能靠 `judgeCalibCases` 入参，且今天生产不传） | **可算（api）**；worker 侧需新增来源 |
| 13 | **lifecycle 过滤规则版本** | 规则是 `packages/db/src/query/retrieval-gate.ts` 的 `isDefaultRetrievable`（`status==='ready' && lifecycle==='active'`）+ `packages/db/src/query/effective-window.ts` 的 `isWithinEffectiveWindow`；**无版本常量** | **版本取不到**；只能记常量名 + 哈希源码（非 PRD 语义） |
| 14 | **session 策略版本 / rewrite prompt 版本** | session：`SESSION_REWRITE_ENABLED`（env，默认 false）+ KB `sessionRewrite` 锁定（`SessionRewriteLockSchema`）+ `apps/api/src/services/ask/session-window.ts` 的 `clipSessionWindow`；L2 报告只落 `rewriteEnabled` 布尔。rewrite prompt：见 #10；**已有先例** `l2RewriteFingerprint` 落进 L2 报告（`apps/api/src/scripts/run-l2-golden.ts` 的 `buildL2EvalRunInsert` 写 `reportJson.l2Fingerprint`） | **版本取不到**；`rewriteFingerprint` 已有的形状可复用 |
| 15 | **L2 剧本集哈希** | `fixtures/l2/gold.yaml`（路径可由 `EVAL_L2_GOLD_PATH` 覆盖，见 `apps/worker/src/eval/persist.ts` 的 `defaultL2GoldPath()` 与 api `apps/api/src/eval/l2-gold.ts` 的 `defaultL2GoldPath`） | **可算** |

「取不到」共 5 类：**seed / fallbackChains 版本 / crag\* / promptVersions / lifecycle 规则版本 / session 策略版本**（其中 `crag*` 属**功能未实现**而非缺数据）。

### 3.2 L1 报告类型今天已有字段 + `reportJson` 白名单

**api 侧 `L1Report`**（`apps/api/src/scripts/run-l1-golden.ts`）：
`mode` · `retrieve_mode` · `signoffEligible` · `ranAt` · `caseCount` · `answerableCount` · `unanswerableClassCount` · `matrix` · `coverage` · `hitAtK` · `hitAtKHits` · `hitAtKScored` · `tauStar` · `tauSweep` · `judgeAuroc` · `judgeAurocScored` · `citationComplete` · `citationCompleteDen` · `errorCount` · `cases` · `kbId` · `evalRunId?` · `gateSnapshot?` · `gateVerdict?`
→ **无** seed / models / promptVersions / 任何哈希 / 任何 `retrieveK` / `rerankTopN` / `contextMode`。

**worker 侧 `L1BatchReport`**（`apps/worker/src/eval/run-l1-batch.ts`）：
`retrieveMode` · `signoffEligible` · `ranAt` · `caseCount` · `answerableCount` · `unanswerableClassCount` · `matrix` · `coverage` · `hitAtK` · `hitAtKHits` · `hitAtKScored` · `tauStar` · `tauSweep` · `judgeAuroc` · `judgeAurocScored` · `citationComplete` · `citationCompleteDen` · `errorCount` · `cases` · `kbId`
→ **无** `gateSnapshot` / `gateVerdict` / `tauClaim` / 任何指纹字段（且字段名是 `retrieveMode` 驼峰，与 api 的 `retrieve_mode` 不同）。

**worker `persist.ts` 的 `reportJson` 白名单**（`saveReport` 里**逐键列举**）：
`mode` · `retrieve_mode` · `signoffEligible` · `ranAt` · `caseCount` · `answerableCount` · `unanswerableClassCount` · `matrix` · `coverage` · `hitAtK` · `hitAtKHits` · `hitAtKScored` · `tauStar` · `tauSweep` · `judgeAuroc` · `judgeAurocScored` · `citationComplete` · `citationCompleteDen` · `errorCount` · `cases` · `kbId`（共 21 键）。
（L2 有另一份白名单，在 `saveL2Report` 里，含 `run_type` / `passCount` / `failCount` / `zeroToleranceHits` / `nearCorefPassRate` / `nearCorefPassDen` / `cases` / `kbId`。）

**⚠️ 两侧持久化口径不同构（重要）**：
- api CLI 走 `buildEvalRunInsert` → **`reportJson: report`（整个对象直落）**，新字段自动入库；
- worker 走 `saveReport` → **白名单逐键挑**，新字段**若不加进白名单会被静默丢弃**（既不报错也不落库）。
→ 这正是地图「前图教训：两侧同义实现分叉过一次」的高风险点；落地 §8 区块/抽检字段时必须两侧都动，并有测例钉住。

### 3.3 现成哈希 / 指纹工具

| 工具 | 位置 | 用法 |
|---|---|---|
| `l2RewriteFingerprint(prompt, modelId)` | `apps/api/src/eval/l2-fingerprint.ts` | `createHash('sha256').update(\`${prompt}\0${modelId}\`).digest('hex')` —— **全仓唯一「语义指纹」工具**，且已进 L2 报告（`reportJson.l2Fingerprint`）与专测 `apps/api/tests/eval/l2-fingerprint.test.ts`；注释明写「SHA-256 稳定即可；不要把窗/问句/evidence 算进去」 |
| 字节校验和 | `apps/api/src/services/storage.ts`（两处）、`apps/api/src/services/ingest-complete-pending.ts` | `createHash('sha256').update(body).digest('hex')` → `checksumSha256`；落 `documents.checksum_sha256` |
| requestId | `apps/api/src/middleware/request-id.ts` | `randomUUID`（非哈希） |
| 幂等键 | `apps/api/src/services/ask/idempotency.ts`（`askIdemKey` / `normalizeIdempotencyKey`） | **Redis key 归一**，不是内容哈希 |

**无**通用 `hashOf(content: string)` 工具；也**无**「对 JSON 结构化列表算稳定哈希」的既有实现（`l2RewriteFingerprint` 只吃 `(prompt, modelId)` 两个字符串）。→ 三个哈希（题面 ID / 校准集 / L2 剧本集）都要新写纯函数，且「稳定纯函数」的既有参照只有 `l2-fingerprint`。

---

## 4. 落点与回归面

### 4.1 最少要动的文件（五侧）

| 侧 | 文件 | 为什么 |
|---|---|---|
| **contracts** | `packages/contracts/src/eval/eval-run.contract.ts`（`EvalRunSchema` 增可空字段）· `packages/contracts/src/eval/l1-matrix.ts`（若把三态/哈希/规模门做成 api/worker 共用纯函数）· `packages/contracts/src/async/eval-job.ts`（若来源声明随 job 传入） | 两侧同构的前提是把纯函数放 contracts（既有纪律：`citationCompleteRate` 就是「api CLI 与 worker 消费者共用，禁止单边另写一份口径」） |
| **api** | `apps/api/src/eval/adr046-snapshot.ts`（新硬门 + 来源三态 + 两个新 reason code）· `apps/api/src/scripts/run-l1-golden.ts`（注入路径 + 报告字段 + §8 区块）· `apps/api/src/services/eval-runs.ts`（`extraStatsFromReport` / DTO 映射）· `apps/api/src/routes/eval.ts`（若登记走 HTTP 端点）· `apps/api/src/services/*`（抽检登记读写 repo）· `apps/api/src/eval/l2-fingerprint.ts`（若扩为通用指纹） | 判定与报告主链在 api |
| **worker** | `apps/worker/src/eval/run-l1-batch.ts`（同构）· **`apps/worker/src/eval/persist.ts`（`reportJson` 白名单必须同步加键）** · `apps/worker/src/eval/consumer.ts`（若来源声明随 job / env 传入）；L2 同批则 `apps/worker/src/eval/run-l2-batch.ts` | 白名单是最易漏的一侧 |
| **db** | 若新增表：`packages/db/drizzle/0023_*.sql` + `packages/db/drizzle/meta/_journal.json`（手写）+ 新 schema 文件（放 `packages/db/src/schema/ask/`，评测域）+ `packages/db/src/schema/index.ts` 导出 | 评测域既有表都在 `schema/ask/` |
| **admin** | 若裁定要运营/业务登记页：`apps/admin/src/app/(ops)/eval/_components/eval-workspace.tsx`（扩）或 `apps/admin/src/app/(ops)/feedback/` 旁新建 | 本机**无浏览器** → 只能做 RTL 可测逻辑（地图已明令不承诺视觉） |

（`.trellis/spec/api/backend/l1-eval.md` 与镜像/覆盖表属回写票，不在本节。）

### 4.2 会翻的既有断言（逐条点名）

**A. `apps/api/tests/eval/adr046-hard-gates.test.ts` —— 最高风险，必翻 8 处**
该文件用 `bind()` 助手（只给 `coverage` / `cRate` / `hitAtK` / `judgeAuroc` / `citationComplete` 五项）与 `ALL_PASS` 常量。**只要新增一个 fail-closed 的人工抽检门（缺测不放行），下列 `expect(...businessPass).toBe(true)` 全部翻红**：
1. `it('五项实测全达标 + 四要素齐 + 未放宽 → 业务 PASS')` → `expect(verdict.businessPass).toBe(true)`
2. `it('coverage 恰好 0.4 过…')` → `bind({ ...ALL_PASS, coverage: 0.4 }).businessPass`
3. `it('cRate 恰好 0.05 过…')` → `cRate: 0.05`
4. `it('hitAtK 恰好 0.7 过…')` → `hitAtK: 0.7`
5. 同上 `unlabeled.businessPass`（`hitAtK: null`）
6. `it('judgeAuroc 恰好 0.65 过…')` → `judgeAuroc: 0.65`
7. `it('citationComplete 0.99 / null 过…')` → 两处（`0.99` 与 `null`）
   （共 8 个 `toBe(true)` 断言点）
→ 落地时必须**同步**在助手补「抽检 20 条 / 错 1」与（若 AUROC 来源门同批）「live 打分器」入参。

**B. `apps/api/tests/eval/adr046-snapshot.test.ts`**
- `it('四要素齐 + 未放宽 + 只给覆盖率 → 缺测硬门（C 率 / AUROC）不得业务 PASS')`：用 `toContain` 断言两个 reason → **加新 reason 不破**，但若新 reason 与既有同名会串味。
- `describe('剧本 T1 · 未声明加严的 KB 锚定试点默认包')`：`expect(snapshot.gates).toEqual(PILOT_HARD_GATES)` → 若 `PILOT_HARD_GATES` 加键而 `snapshot.gates` 同源，仍等值**不破**；若改成从别处合成 gates 会破。
- `describe('剧本 P6 · L1 门禁条件不含 aux_*')`：断言 `Object.keys(PILOT_HARD_GATES)` 不以 `aux` 开头、不含 `min_support` / `minSupport` → **新增键名不得以 `aux` 开头**。
- `剧本 T2`（放宽 `cRateMax`）与 `writeBoundSnapshot` 落盘断言：新字段进 `snapshot` 不破（只断言了部分键）。
- `it('无 evalRunId 时用 report:kb:ranAt 绑定')`：`snapshotBindIdentity` 不得改。

**C. `apps/api/tests/eval/pilot-gates-parity.test.ts`**
只比 `PILOT_HARD_GATES.coverageMin` / `.cRateMax` 与 contracts `TAU_STAR_COVERAGE_MIN` / `TAU_STAR_C_RATE_MAX` → **加键不破**；但文件头注释写明「两份常量不合一，但必须有一致性断言」→ **不得下沉/改名**这两个常量。

**D. `apps/api/tests/eval/l1-cli.test.ts`**
- **三处 `L1Report` 字面量**（`buildEvalRunInsert / evalRunDbRanAt` 两条 + `describe('writeL1Report')`）：逐字段列举；给 `L1Report` 加**必填**字段 → 三处 TS + vitest 全红。加**可选**字段则过。
- `describe('runL1Golden mock graphDeps path')` 的 `it('serial loop → matrix + report files with required fields')`：断言 md 含 `retrieve_mode:` / `businessPass` / `errorCount`，且 `report.gateSnapshot?.evalBindId` 匹配 `/^report:kb-test:/`、`snapshot.verdict.businessPass===false`。
- `it('注入校准打分器写 judgeAuroc；不注入则 null；不改 2×2')` / `it('校准仅一类有效分 → judgeAuroc null')` / `it('显式空校准集即使有打分器也不回落仓根夹具')`：**这三条正是「缺测不得放行」「不回落夹具」的回归钉**；若把「不注入」改成「默认 live」或「缺测即放行」，三条必红（反证要贴的红）。
- `describe('resolveEvalMode')`：`mock|http|other` 三态映射不得改。

**E. `apps/worker/tests/eval/run-l1-batch.test.ts`**
- 6 处 `runL1Batch({...})` 调用：新增**必填** opt（如 `judgeSource`）→ 全红。
- `it('注入校准打分器写 judgeAuroc；不注入则 null')` 与 `it('打分数组短于校准题 → 抛错，不得用子集写成 1')`：三态/长度门回归钉。
- `it('mock … 不得 signoffEligible')`：`signoffEligible` 语义不得改。

**F. `apps/api/tests/eval/http-eval-runs.test.ts`**
- `expect(extraStatsFromReport({ judgeAuroc: 0.8 }).judgeAuroc).toBe(0.8)` 等四条：若 DTO 新增统计键而 `extraStatsFromReport` 不同步，断言本身不红但 UI 拿不到；`packages/contracts/tests/eval/gold-contract.test.ts` 已钉 `EvalRunSchema.parse({...run, judgeAuroc: …})`（`judgeAuroc` 可空）。
- 注意 `EvalRunSchema` 是 `.strict()`：**新增字段必须同时出现在 schema 与 `toEvalRunDto`**，否则 `EvalRunListResponseSchema.parse` 抛错（HTTP 500 级）。

**G. `apps/api/tests/docs-guard/*`**
- `gold-review-guard.test.ts`：扫**源码**（`apps/*/src` + `packages/*/src` 的 `.ts/.tsx`）。**凡文本含 `gold.yaml` 的文件，`writeFileSync` / `appendFileSync` / `createWriteStream` / `writeFile(` / `rmSync` / `unlinkSync` / `renameSync` 的 ±200 字符窗内不得再出现 `gold.yaml`**。→ 新增「读 gold.yaml → 算题面哈希 → 写报告」的代码若把写调用放得太近会红（现有 `run-l1-golden.ts` 把 `defaultGoldPath` 与 `writeL1Report` 放在不同函数，故意隔开）。另有断言：`run-l1-golden.ts` 必须含 `fixtures/l1/gold.yaml` 与 `loadGold`。
- `auth-enforce-pilot.test.ts`（守 `docs/ops/auth-enforce-pilot.md` 与 `.env.example` 的 `AUTH_ENFORCE=false`）与 `delivery-s05.test.ts`（守 `prds/12-delivery-guides/04-交付控制台.md` §0.5 行）→ 本图不动这些文本则**不染**；若新增 env 变量，**不要**改 `.env.example` 里 `AUTH_ENFORCE` 行。

**H. `packages/db/tests/migrations/sql-snapshot-default-parity.test.ts`**
- 规则：按文件名顺序累积所有 `packages/db/drizzle/*.sql` 的**净 DEFAULT**（`CREATE TABLE` 列内 `DEFAULT` 记入、`ALTER TABLE … ADD COLUMN … DEFAULT` 记入、`ALTER COLUMN … DROP DEFAULT` 移除），与**最高号快照**（今天 `meta/0021_snapshot.json`，约 69 KB / 26 表）双向比对：SQL 有而快照无 → 红；快照有而 SQL 无 → 红。
- **今天没有 0022 快照**（`meta/` 只有 `0000_snapshot.json` 与 `0021_snapshot.json`）。
→ 新表若带 `DEFAULT`（如计数列默认 0），必须新增 `0023_snapshot.json`；**最省事的规避法是不写 DEFAULT**（与 0022 撤 DEFAULT 的既定纪律同向）。

**I. 其它**
- `packages/db/tests/ask/ask-schema.test.ts`（断言 `evalRuns` / `goldQuestions` 等导出）：新表挂 `schema/ask/` 不破，但 `packages/db/tests/index.md` 要登记新测例。
- `apps/admin/tests/ops/eval-workspace.test.tsx` / `dashboard-workspace.test.tsx`：run 夹具是内联对象，加可选字段不破。
- 各包 `tests/index.md` 的「待处理」段：`apps/api`、`apps/worker`、`apps/admin`、`apps/web`、`packages/{contracts,db,admin-catalog}` **均写明「（无。`src/` 下已无 `*.test.ts(x)`。）」** → 地图里「若 index 仍有待处理行」的前置条件**不成立**，新测例按常规登记即可。

### 4.3 迁移编号现状与 hand-written SQL 写法

- **现有最大编号 = `0022`**：`packages/db/drizzle/0022_ingest_report_default_parity.sql`；`drizzle/` 下 0000–0022 共 23 个 `.sql`。
- **`drizzle/meta/_journal.json` 是手写的**：23 条 entry（`idx` 0–22），每条形如 `{ "idx": n, "version": "7", "when": <毫秒时间戳>, "tag": "<文件名去后缀>", "breakpoints": true }`；`version: "7"`、`dialect: "postgresql"`。新增迁移必须**手工追加一条 entry**（含 `when`）。
- **快照现状**：`drizzle/meta/` 只有 `0000_snapshot.json` 与 `0021_snapshot.json`（**无 0014–0020、0022 的快照**）。
- **最近迁移的结构摘要（0022，全文 12 行）**：
  1. 开头一段中文 `--` 注释，讲「为什么撤 DEFAULT」（0015 为回填加的 `DEFAULT 0` / `DEFAULT '[]'` 会让漏传列静默填默认值，等于替业务断言「本轮无跨文档去重」）；
  2. 两条 `ALTER TABLE "ingest_reports" ALTER COLUMN … DROP DEFAULT;`；
  3. 语句之间用 `--> statement-breakpoint` 分隔；
  4. 末尾注释「不动 schema、不重生成快照（快照本就声明无默认，本迁移是把库侧拉回声明）」。
- **建表样例（0010 `0010_eval_floor.sql`）**：
  ```
  CREATE TABLE IF NOT EXISTS "gold_questions" (
    "id" uuid PRIMARY KEY NOT NULL,
    "created_at" timestamp(0),
    … 无 DEFAULT …
  );
  --> statement-breakpoint
  CREATE UNIQUE INDEX IF NOT EXISTS "gold_questions_kb_case_uidx" ON "gold_questions" USING btree ("kb_id","case_key");
  --> statement-breakpoint
  ALTER TABLE "eval_runs" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'succeeded' NOT NULL;
  ```
  → 既有写法 = `IF NOT EXISTS` + 制表符缩进 + `--> statement-breakpoint` 分隔 + 每个 `.sql` 顶部「为什么要这个迁移」的中文注释；**有 DEFAULT 时要么该列后来被撤（0022），要么必须在最高号快照里能对上**。
- `eval_runs` 的 Drizzle schema 用了 `.default('golden_2x2')` / `.default('0')` / `.default(0)`，`0006_b10_eval_runs.sql` 里对应 `DEFAULT 'golden_2x2' NOT NULL` 等 → 快照 0021 里有这些默认值（说明快照是全库快照）。

---

## 5. 诚实面：哪几样离线做不出真值

| 样 | 离线能不能做出「真值」 | 缺什么 | 能做的最大部分到哪一步 |
|---|---|---|---|
| **人工抽检** | **不能** | 缺**人**（PRD 只写「业务方参与」）+ 缺**真语料下真实 answered/abstained 结果**供人判对错。本机无浏览器 → admin 视觉登记页也不能验证 | 能做完：**登记面存在**（表/字段/端点/命令行）+ **判据接进 `evaluateAdr046Bind`（缺测不放行）** + **两种红可分辨**（没人登记 vs 登记超标）+ **一个合法登记路径真能让门变绿**（证明不是空转闸）+ 边界测例（19/20/21 条、错 0/1/2）。**做不到**：真抽检结论本身 |
| **校准打分器** | **不能** | 缺**真 judge**（真 Gateway 打分）+ 缺 **≥100 真标注校准集**（夹具仅 8 条手写 seed，扩集需真语料 + 标注） | 能做完：**来源三态判别**（live/mock/缺测）落两条入口且同构 + **mock/缺测都不放行** + **「live 打分器注入后该门可达」的可达性测例**。（若裁定加规模门，也能做：只对「集内题数」做规模判定。）**做不到**：真实 AUROC 数值、`verifier_calib` 真跑 |
| **§8 可复现字段** | **能做的部分最大**（纯计算），但**真值仍不全** | 缺**稳定的「版本」载体**（seed / fallbackChains 版本 / promptVersions / lifecycle 规则版本 / session 策略版本 今天都没有版本号 → 只能改算「配置内容哈希」，**形似而非 PRD 语义**，须裁定是否接受）；缺**真跑环境**（真 PG/ES/Gateway 才能验证「另一台机器复跑同值」，离线只能证明纯函数确定性）；`crag*` 属**功能未实现**（记债，不是缺数据） | 能做完：能取到的字段进报告（`env` / KB 配置 / 派生值）+ 三个哈希写成稳定纯函数（同输入同值、变一字节变值）+ 取不到的一律 `null` + 记债行；**做不到**：真「版本」语义、跨机器复跑验收 |

**共同卡点**：三样都**不能**在离线环境产出**可签字的 PASS**。本图产物是「证据面存在且不可作假」，**不是「证据值」**。

---

## 6. 给裁定票的三条反直觉事实（会改变做法）

1. **两侧持久化不同构**：api CLI `buildEvalRunInsert` 是 `reportJson: report`（整对象直落），worker `saveReport` 是**白名单逐键挑**。任何只在 `L1BatchReport` 类型上加字段的改动，**在 worker 侧会被静默丢弃**（不报错）。
2. **加一个新 fail-closed 硬门会一次性打红 `adr046-hard-gates.test.ts` 的 8 个 `businessPass===true` 断言** —— 因为这些断言用的助手只喂五项指标。这不是「测例写错了」，是新门的必然结果；必须先改助手（补合法抽检/live 打分器入参）再谈落地。
3. **`humanSpotMin` 唯一的「读」只是 `gatesComplete` 的 `Number.isFinite` 存在性检查**（外加 `compareHardGates` 的方向比较）。所以「常量没人读」的准确表述是：**没有任何判定点把抽检条数/错误数与这两个常量比较过**。
   另：**`L1Report.mode` 今天不是 ask 档位**，而是 `retrieve_mode` 的历史别名（同名不同义）——§8 的 `mode` 指哪个必须裁定。
