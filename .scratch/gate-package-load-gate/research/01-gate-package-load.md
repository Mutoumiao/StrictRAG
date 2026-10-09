# 现状核实 · 签字包从哪来、τ 有几处取值、今天有没有一致性判定

Type: research（现状核实） · Status: 完成 · 对应工单：[`01-research-is-verify.md`](../issues/01-research-is-verify.md)

> **纪律声明**：本文所有「行号」均由 `read_file` / `grep -n`（`Select-String` 不可用时用内置 grep）在本次核实中**实测**得出，非凭记忆。
> **三类标注**：**[源码事实]** = 亲眼读到的那一行；**[推断]** = 由事实按代码次序推出（写明推理链）；**[未核]** = 找过但没找到（写明找过哪些位置 / 模式）。
> **全称否定**一律附搜索范围与模式。核心全称否定统一用：
> `grep -n -i "tauClaim|TAU_CLAIM"`（全仓，命中 110+ 行，逐条过筛）与
> `grep -n "readFileSync.*gate-snapshot|readBoundSnapshot|gate-snapshot"`（`apps/` 命中 3 行，见 §7）。
> 路径写法：仓内相对路径（如 `apps/api/src/env.ts:28`）。
> **不含裁定**：本文只落事实，供工单 02 拍板。

---

## 1. 签字包是什么、谁生产

**一句话结论**：所谓「已签字包」在今天只是 `eval_runs` 表里**四条列条件**筛出的**最近一条** L1 run（`runType='golden_2x2' ∧ status='succeeded' ∧ retrieve_mode='live' ∧ signoff_eligible∈{'1','true'}`），对外只暴露 `{id, effectiveAt}`；**RACI 人签不在库里**，是 `fixtures/l1/RACI.md` 文件产物。生产路径有三条（api CLI 直写 · HTTP 入队 + worker 批跑回写 · L2 另一张表），其中只有 L1 两条可能进「签字包」子集。

### 1.1 「已签字包」的筛选条件（字面值）

| 位置 | 原文/行为 | 对本图的意义 |
|------|-----------|--------------|
| `apps/api/src/services/eval-runs.ts:46` | `export const SIGNOFF_PACKAGE_RUN_TYPE: EvalRunType = 'golden_2x2';` | 包必须是 L1 2×2，`session_multiturn` / `tau_sweep` / `verifier_calib` **均不算** |
| `apps/api/src/services/eval-runs.ts:47` | `export const SIGNOFF_ELIGIBLE_TRUE = ['1', 'true'] as const;` | 字符串两态（历史脏数据双读） |
| `apps/api/src/services/eval-runs.ts:53-62` | `isSignoffPackageRow`：`runType==='golden_2x2' && status==='succeeded' && retrieveMode==='live' && ['1','true'].includes(signoffEligible)` | 纯函数口径；注释自陈「**不含 RACI 人签**（那是 `fixtures/l1/RACI.md` 文件产物，不在库里）——不代签」（`:50-52`） |
| `apps/api/src/services/eval-runs.ts:79-85` | 接口 `latestSignoffPackage(kbId)` 返回 **`{ id: string; effectiveAt: string \| null } \| null`** | 只回两列，**不回 τ / 不回报告**；「包内 τ」经此口**读不到** |
| `apps/api/src/services/eval-runs.ts:337-349` | SQL 侧同样写死四条（`select({id, createdAt})` `:340`；`eq runType/status/retrieveMode` + `inArray signoffEligible` `:344-349`；`orderBy desc createdAt limit 1`） | 「最近一条」= 按 `createdAt` 降序，非 `ranAt` |

### 1.2 生产者（三条路径，各自写哪些列）

| # | 位置 | 写入行为 | 是否可能成「签字包」 |
|---|------|----------|----------------------|
| ① api CLI 直写 | `apps/api/src/scripts/run-l1-golden.ts:295-305`（`persistEvalRun`）+ `:268-291`（`buildEvalRunInsert`）；触发开关 `:820-824`（`persistEval` 或 `L1_PERSIST_EVAL=1/true`） | `runType:'golden_2x2'`(`:273`) · `signoffEligible: report.signoffEligible?'1':'0'`(`:275`) · `status:'succeeded'`(`:287`) · `retrieveMode`/`matrix*`/`coverage`/`errorCount`/`ranAt`(本地串 `:285`) · **`reportJson: report`（整份报告对象）**(`:289`) | **是**（live ∧ 规模够） |
| ② HTTP 入队 + worker 回写 | 入队 `apps/api/src/routes/eval.ts:237`（`POST /knowledge-bases/:kbId/eval/runs`）→ `:267` `createQueued`（默认 `signoffEligible:'0'` `:275` / `status:'queued'` `:284`，见 `apps/api/src/services/eval-runs.ts:262-293`）→ `:273` `enqueue` → worker `apps/worker/src/eval/consumer.ts:106` `runL1Batch` → `:118` `persist.saveReport`（`apps/worker/src/eval/persist.ts:102-150`：**白名单**写回 `reportJson` `:118-148`，`signoffEligible` `:108`，`status:'succeeded'` `:104`） | **是**（worker 跑 live 且规模够时） |
| ③ L2 多轮 | `apps/worker/src/eval/persist.ts:152-192` `saveL2Report`：`signoffEligible:'1'/'0'`（`:159`），但 `run_type` 由报告带 `session_multiturn`（`:170`），且 `run-l2-batch.ts:295` 的 `computeL2SignoffEligible` | **否**（`isSignoffPackageRow` 要求 `runType==='golden_2x2'`） |

### 1.3 `report_json` 里到底存了什么（顶层键）

| 生产者 | 顶层键 | 来源 |
|--------|--------|------|
| ① api CLI | 见 `run-l1-golden.ts:778-816` 构造的 `L1Report`：`mode` / `retrieve_mode` / `signoffEligible` / `ranAt` / `caseCount` / `answerableCount` / `unanswerableClassCount` / `matrix` / `coverage` / `hitAtK` / `hitAtKHits` / `hitAtKScored` / `tauStar` / `tauSweep` / `judgeAuroc` / `judgeAurocScored` / `judgeAurocSource` / `citationComplete` / `citationCompleteDen` / `humanSpot` / **`repro`** / `errorCount` / `cases` / `kbId` / `docMapSource` / `docMapResolved` / `docMapUnmappedIds` | **[源码事实]** |
| ② worker 批跑 | `persist.ts:118-148` 白名单：`mode` / `retrieve_mode` / `signoffEligible` / `ranAt` / `caseCount` / `answerableCount` / `unanswerableClassCount` / `matrix` / `coverage` / `hitAtK*` / `tauStar` / `tauSweep` / `judgeAuroc*` / `citationComplete*` / `humanSpot` / **`repro`** / `errorCount` / `cases` / `kbId` / `docMapSource` / `docMapResolved` / `docMapUnmappedIds` | **[源码事实]** |

**两条关键差异（本图关键）**：

- **[源码事实]** worker 分支的 `repro` 由 `run-l1-batch.ts:300-309` 用 `emptyL1Repro()` 铺底，**只填** `questionIdsHash` / `goldSource:'db'` / `goldSetMatchesRepoFile`；`emptyL1Repro()` 的 `tauClaim` 默认 **`null`**（`packages/contracts/src/eval/l1-repro.ts:125`，紧接 `:86` 的注释「ADR-007 唯一源 `TAU_CLAIM`；取不到 → null」）。**故 worker 写出的 `report_json.repro.tauClaim` 恒为 `null`**；`apps/worker/tests/eval/run-l1-batch-repro.test.ts:67` 正是断言 `report.repro.tauClaim` 为 `null`。
- **[推断，代码次序]** api CLI 的 DB 行**不含 `gateSnapshot`**：`persistEvalRun`（`:826`）在 `bindQualitySnapshotToEval`（`:841`）**之前**执行，`report.gateSnapshot = bound.snapshot` 在 `:863` 才赋值。DB 序列化在 `:826` 已 await 完成，故 `report_json.gateSnapshot` 不存在于库中；`gateSnapshot` 只落**文件** `l1-last-run.json`（`writeL1Report` 在 `:867`，晚于绑定）与 `l1-gate-snapshot.json`（`:865` `writeBoundSnapshot`）。这与 worker 白名单也不含 `gateSnapshot` 一致。

### 1.4 「人签」在库里有没有表示

| 位置 | 原文/行为 | 对本图的意义 |
|------|-----------|--------------|
| `packages/db/src/schema/ask/eval-runs.ts:1-36`（+ `_shard/base-columns.ts:10-27`） | 表列 = `id/tenant_id/kb_id/run_type/retrieve_mode/signoff_eligible/gold_path/case_count/matrix_a..d/coverage/error_count/ran_at/status/job_id/error_message/report_json/notes` + `created_by/created_at/updated_by/updated_at` | **无任何签名 / 人审 / RACI 列** [源码事实] |
| `apps/api/src/services/eval-runs.ts:50-52`、`:80-83` | 注释：「**RACI 人签**（那是 `fixtures/l1/RACI.md` 文件产物，不在库里）——不代签」「**RACI 人签是文件产物**……不在库里，故不构成过滤条件」 | 人签**不进**筛选谓词 [源码事实] |
| `fixtures/l1/RACI.md:1-50` | 具名 owner 表 + 题面审核记录 + 业务签字页检查项（含「任一项否 → **拒绝**业务签字页绿灯」`§3`） | 人签 = **文件核对清单** [源码事实] |
| `apps/api/src/eval/adr046-snapshot.ts:47-48`、`:154-168` | `FourElements.signatures = businessR && productA`（`:166`）；`signatures` 只由入参布尔决定 | 「签字」在代码里 = **两个调用方传入的布尔**，`main()` 从不传（见 §2/§4），故真实 CLI 路径恒 `false` [源码事实] |

---

## 2. τ 的取值链（本图核心）

**一句话结论**：今天 τ 的**运行时唯一源是 env `TAU_CLAIM`**（ADR-007）。ask 图、trace 快照、KB 设置读面全部直接读 `env.TAU_CLAIM`；CLI 报告与 ADR-046 快照在真实路径上**同取一个局部变量 `tauClaim`**，故「不出现两个 τ」**成立**——但成立的原因是**共用同一个变量**，而非存在一致性判定。签字包内冻结的 τ **没有任何运行时读点**。

### 2.1 全仓 `tauClaim` / `TAU_CLAIM` 取值点（生产源码，逐处）

| 位置 | 角色 | 读的是什么 |
|------|------|-----------|
| `apps/api/src/env.ts:28` | 定义 | `TAU_CLAIM` Zod `default(0.5)`；`:16` 注释「tauClaim 唯一源：`TAU_CLAIM`」 |
| `apps/api/src/env.ts:33` | 定义 | `TAU_CLAIM_LEGACY`（可选第二源，见 §3.4） |
| `apps/api/src/env.ts:207-213` | **启动校验** | `TAU_CLAIM_LEGACY !== undefined && !== TAU_CLAIM` → `superRefine` 报错（`env.ts:271` `parseEnv()` 失败即 `process.exit(1)`） |
| `apps/api/src/index.ts:40` | 仅日志 | 启动日志打 `tauClaim: env.TAU_CLAIM` |
| `apps/api/src/services/ask/execute.ts:204` | **ask 运行时** | `runAskGraph({ …, tauClaim: env.TAU_CLAIM, … })` |
| `apps/api/src/services/ask/execute.ts:271` | trace 快照 | `configSnap: { tauClaim: env.TAU_CLAIM, mode, sessionRewriteEnabledDefault }` |
| `apps/api/src/graph/state.ts:42`、`:58` | 类型 + state | `AskGraphInput.tauClaim` / `AskGraphState.tauClaim`；`:142` `initState` 透传 |
| `apps/api/src/graph/run.ts:542` | **min 否决** | `scores.every((s) => s >= state.tauClaim)` —— τ 的**唯一判定消费点** |
| `apps/api/src/routes/kb-settings.ts:69` | **设置读面** | `defaultQuality` 返回 `tauClaim: env.TAU_CLAIM` |
| `apps/api/src/scripts/run-l1-golden.ts:757` | CLI 报告/快照 | `const tauClaim = snapIn?.tauClaim ?? env.TAU_CLAIM;` |
| `apps/api/src/scripts/run-l1-golden.ts:806`、`:847` | 报告 + 快照 | `repro: buildL1Repro({ …, tauClaim, … })`（`:806`）与 `bindQualitySnapshotToEval({ …, tauClaim, … })`（`:847`） |
| `apps/api/src/eval/adr046-snapshot.ts:59`、`:154`、`:162`、`:303-305` | 快照形状 | `Adr046Snapshot.tauClaim`（`:59`）；`fourElementsOf` 的 `tauOk`（`:162`）；`snapshot.tauClaim = input.tauClaim`（`:305`） |
| `apps/worker/src/env.ts:26-27`、`:96-101` | worker env | 与 api 同形的 `TAU_CLAIM` / `TAU_CLAIM_LEGACY` 校验（**worker 不消费 τ 做判定**） |
| `packages/contracts/src/kb/kb-settings.contract.ts:84` | **对外形状** | `QualitySnapshotSchema.tauClaim` |
| `packages/contracts/src/eval/l1-repro.ts:86` | 报告形状 | `L1Repro.tauClaim: number \| null`（注释「ADR-007 唯一源」） |
| `turbo.json:78` | 构建透传 | `env` 白名单含 `TAU_CLAIM` |

### 2.2 运行时（ask 图）τ 的完整链

`apps/api/src/index.ts` → `app.ts:92` 挂 `kbSettingsRoutes`（及 ask 路由）→ `routes/ask.ts:100` `deps.execute ?? executeAsk` → `services/ask/execute.ts:204`：
```
executeAsk(params, deps)                         // execute.ts:109
  └─ runAskGraph({ …, tauClaim: env.TAU_CLAIM }, graphDeps)   // :192-208, τ 在 :204
       └─ initState(input)                        // graph/run.ts:263 → state.ts:142
            └─ 最小否决 scores.every(s => s >= state.tauClaim)  // graph/run.ts:542
```
- **[源码事实]** 整链**无任何**包读取、无 KB 设置读取、无快照读取。
- **[源码事实]** `apps/api/src/index.ts:1-50` 的 `start()` 只做：`runSuperAdminBootstrap()`（`:20`）、`logPlaneQuotaGaps()`（`:26`）、`serve()`（`:30`）。**无加载包 / 校验包动作**。

### 2.3 `run-l1-golden.ts:757`「报告与快照读同一个值，不出现两个 τ」是否成立

**成立**，且是「同一变量」级成立：

| 位置 | 事实 |
|------|------|
| `run-l1-golden.ts:755-757` | `const snapIn = opts.snapshot;` → `const tauClaim = snapIn?.tauClaim ?? env.TAU_CLAIM;`（注释 `:756`：「报告与快照读同一个值，不出现两个 τ」） |
| `run-l1-golden.ts:806` | 报告 `repro.tauClaim = tauClaim`（经 `buildL1Repro` `:501`、`:521`） |
| `run-l1-golden.ts:847` → `adr046-snapshot.ts:305` | 快照 `snapshot.tauClaim = input.tauClaim = 同一个 tauClaim` |
| `run-l1-golden.ts:869-921`（`main()`） | **从不传 `snapshot`**；`opts.snapshot` 仅单测注入（`RunL1Options.snapshot` `:187-193`） |

**[源码事实]** 同一 run 上：报告 τ = `report_json.repro.tauClaim`；ADR-046 快照 τ = `snapshot.tauClaim`。二者**不可能不等**——它们是同一个 JS 局部变量。**[推断]** 该注释在「真实 CLI 路径」与「单测注入路径」下均成立；**不存在**两条彼此独立取 τ 的代码路径，故「两个 τ」在 CLI 内部不会发生。

**但要注意边界**：这里的「一致」只保证 **CLI 本跑内部**报告与快照一致；它**不**保证与 **`env.TAU_CLAIM` 在 api 进程侧的当前值**一致（CLI 是独立进程；快照落文件后无人回读，见 §7）。也**不**保证与 **worker 行**一致（worker 的 `report_json.repro.tauClaim` 恒 `null`，见 §1.3）。

### 2.4 `QualitySnapshot` / `KbSettings` 形状：对外能看到的 τ

| 位置 | 事实 | 结论 |
|------|------|------|
| `packages/contracts/src/kb/kb-settings.contract.ts:83-88` | `QualitySnapshotSchema = { tauClaim: number(0..1), gatePackageId: string\|null\|opt, effectiveAt: string\|null\|opt }` | 对外 τ 是**单值** |
| `apps/api/src/routes/kb-settings.ts:66-72` | `defaultQuality(kbId)` → `{ tauClaim: env.TAU_CLAIM, gatePackageId: pkg?.id ?? null, effectiveAt: pkg?.effectiveAt ?? null }` | **对外看到的 τ = env 的 τ**；`gatePackageId` 只给 id，**不给包内 τ** |
| `apps/api/src/routes/kb-settings.ts:62-64` | 注释：「`tauClaim` 仍取 `TAU_CLAIM`（ADR-007 唯一源；改由签字包加载须先 ADR）」 | 代码自陈待办 |

**[源码事实]** 结论：今天**对外可见的 τ 一律是 env 的 τ**；**包内冻结的 τ 对外不可见**（只在文件产物 `l1-gate-snapshot.json` / `l1-last-run.json` 与单测里）。

---

## 3. 今天有没有任何一致性判定

**一句话结论**：**没有**。全仓不存在任何「包内 τ vs 运行时 τ」或「包内其它参数 vs 运行时参数」的比较；`kb-settings.ts` 把 `env.TAU_CLAIM` 与 `pkg?.id` **并列返回却从不核对**；启动路径不加载包；最接近的同类先例是 `TAU_CLAIM_LEGACY`（纯 env 侧双源一致性启动校验）。

### 3.1 全仓是否存在「包内 vs 运行时」比较

**[源码事实] 全仓 0 命中「把包内冻结值拿来与运行值比」的代码。** 找过的模式与范围：

- `grep -n "tauClaim|TAU_CLAIM"`（全仓；110+ 行）→ 无任何比较包内 τ 与 env τ 的分支。
- `grep -n "gatePackageId|latestSignoffPackage|gateSnapshot|signedPackage|isSignoffPackageRow"`（全仓；85 行）→ 逐条看：`latestSignoffPackage` 只回 `{id, effectiveAt}`；`extraStatsFromReport`（`services/eval-runs.ts:99-151`）读 `report_json` 的 `passCount/failCount/.../docMap*`，**不读 `tauClaim`，不读 `repro`，不读 `gateSnapshot`**；运行时无 `l1-gate-snapshot.json` 读点。
- `grep -n "readFileSync.*gate-snapshot|readBoundSnapshot|gate-snapshot"`（`apps/`；3 行）→ 仅 `adr046-snapshot.ts:321`（写）、`l1-cli.test.ts:377`（测）、`README.md:106`（文档）。**无运行时读取 / 加载入口**。

### 3.2 `kb-settings.ts` `defaultQuality` 组合的含义

| 位置 | 事实 |
|------|------|
| `apps/api/src/routes/kb-settings.ts:67-71` | `const pkg = await evalRunRepo.latestSignoffPackage(kbId);` → `{ tauClaim: env.TAU_CLAIM, gatePackageId: pkg?.id ?? null, effectiveAt: … }` |

**[推断]** 当「包内 τ ≠ env τ」时：响应会**同时**呈现 **env 的 τ**（`tauClaim`）与 **那个包的 id**（`gatePackageId`），读面把「包」与「τ」并排展示，**暗示**该 τ 属于该包，实则两者各说各话。**没有任何地方会察觉**这个组合不自洽——`latestSignoffPackage` 未取包内 τ，`defaultQuality` 未做比较，也无告警/日志。

### 3.3 启动路径有没有加载包 / 校验包

| 位置 | 事实 |
|------|------|
| `apps/api/src/index.ts:18-48` | `start()`：`runSuperAdminBootstrap()` → `logPlaneQuotaGaps()` → `serve()`；**无包加载 / 包校验** |
| `apps/api/src/env.ts:257-272` | `parseEnv()` 在**模块加载期**执行（`:271 export const env = parseEnv()`）；**此时无 DB 句柄**（`getDb()` 在 `services/db.ts`），结构上也不可能校验库内包 |

### 3.4 `TAU_CLAIM_LEGACY` 一致性校验：挡的是什么、能否类比

| 位置 | 事实 |
|------|------|
| `apps/api/src/env.ts:29-33` | 注释：「若误设旧名/第二源，须与 `TAU_CLAIM` 完全一致，否则启动失败。正常部署应只设 `TAU_CLAIM`，不设本字段。」 |
| `apps/api/src/env.ts:207-213` | `TAU_CLAIM_LEGACY !== undefined && !== TAU_CLAIM` → `ctx.addIssue` → **启动即拒** |
| `apps/worker/src/env.ts:26-27`、`:96-101` | worker 侧同形 |
| `apps/api/tests/env/defaults.test.ts:21-28`、`:193-204` | 测例钉住：单 `TAU_CLAIM` 通过；双源不等 → 拒；双源相等 → 通过 |

**结论**：`TAU_CLAIM_LEGACY` 是**「两个配置源必须一致，否则拒绝启动」的同型先例**，但**只在 env 解析期、纯进程内、与库/包无关**。它能被类比成「同样形状的校验存在先例」，**不能**类比成「跨源（env ↔ 包）校验已有实现」——包校验需 DB 读，落在 `start()` 阶段，与 `parseEnv()` 的时序不同。

**[未核]** 是否有**其它**「跨源一致性闸」先例（如 `RERANK_MIN_NODES` vs 链长在 `start()` 期校验）。已见的 `env.ts` 内 `superRefine`（`:188-247`：`INGEST_MAX_FILE_BYTES` ≤ 天花板、文本族 ≤ 通用、`STORAGE_MODE=s3` 须 `S3_ENDPOINT`、`RETRIEVE_ES_MODE=http` 须 `ELASTICSEARCH_URL`、production 禁默认凭证/密钥）**全是 env↔env**，无 env↔DB。

---

## 4. PRD 与 ADR 的原文

**一句话结论**：§6.0「加载」行（`prds/08-quality/02-evaluation-and-gates.md:151`）逐字要求「运行时质量参数 **仅**来自已签字包；不一致 → **拒绝加载**」；该行**就是 ADR-046 决策 #4 的下沉**（`prds/11-decisions/00-adr-index.md:1024-1026` 逐字同义）。ADR-007（`:71-76`）只说「唯一 tauClaim」，**未**说唯一源是 env——是 `env.ts:16` / `.env.example` / `README` 把它固化成「env 唯一源」。

### 4.1 §6.0 加严包表逐行原文（`prds/08-quality/02-evaluation-and-gates.md:142-155`）

| 行 | 位置 | 原文 |
|----|------|------|
| 锚点 | `:148` | 「上表 = **pilot 默认**；KB 未声明则用默认」／禁「无锚点私自数字当默认」 |
| 加严方向 | `:149` | 「硬门单向更严；提交 **diff 表** 校验；任一硬门变松 → **拒绝**标加严包」／禁「借加严改松其它硬门」 |
| 四要素 | `:150` | 「① 业务书面提案 ② **重跑 L1 适用**（≥2×2/相关硬门；τ 变含工作点说明）③ 业务 R+产品 A + `stricter_than_pilot`+diff ④ KB 配置快照绑定 `eval_runs`」／禁「缺一仍『已签字』；口头改 prod」 |
| **加载** | `:151` | **「运行时质量参数 **仅**来自已签字包；不一致 → **拒绝加载**」／禁「运行时 τ 与签字包脱节」** |
| **放宽** | `:152` | 「任一硬门变松 → **ADR + 合规会签 + 产品 A**；默认拒；配置门禁无 ADR → 失败」／禁「KB admin 一键放宽」 |
| **标记** | `:153` | 「报告/看板：`gate_bundle=pilot\|stricter`」／禁「混报不可审计」 |
| 多 KB | `:154` | 「每 KB 独立包；互不污染」／禁「租户一次放宽污染全部 KB」 |

### 4.2 §7 再认证触发表中与本图相关的行（`:194-215`）

| 位置 | 原文 | 对本图 |
|------|------|--------|
| `:208` | 「修改 `tauClaim` / crag 阈值 / citationPolicy → 2×2 或 τ 扫描」 | 「改 τ」是**再认证触发**；本图若引入「τ 取自包」需回头对上这行 |
| `:209` | 「**业务线加严门禁包生效 / 变更加严数字**（ADR-046）→ **四要素齐**…」 | 加严包生效**必须四要素齐**（含配置快照绑定） |
| `:210` | 「**业务线放宽任一硬门**（ADR-046）→ **禁止**自助；须新 ADR…」 | 放宽路径 |
| `:215` | 「超 90 天未评测 → 强制再跑」 | 时效（本图 map「过期包姿态」留雾处） |
| 表头 | `:194` | 「下列变更后 **必须** 重跑…否则门禁报告视为过期」 |

### 4.3 ADR 原文

| ADR | 位置 | 原文要点 |
|-----|------|----------|
| **ADR-007**「验证门槛唯一 tauClaim」 | `prds/11-decisions/00-adr-index.md:71-76` | 状态已接受；「**决策**：废弃双阈值 tauAbstain；crag 只管检索分支。**后果**：配置简单；τ 须扫描标定。」——**未写「唯一源 = env」** |
| ADR-007 的「env 唯一源」固化处 | `apps/api/src/env.ts:16`、`.env.example:17-19`、`README.md:81-83` | 「唯一配置源：`TAU_CLAIM`（0–1）。若同时设 `TAU_CLAIM_LEGACY` 且值不同 → **启动失败**」 |
| **ADR-046** | `prds/11-decisions/00-adr-index.md:994-1045` | #2 四焊死 `:1008-1017`；**#2.4「配置：运行时质量参数写入 KB 配置快照，与签字包绑定」`（:1017）`**；#4「配置 ↔ 签字包可审计绑定」`（:1024-1026）`：「`tauClaim` 等须来自已签字门禁包推导/登记；与 `eval_runs` run id 关联。**运行时加载校验配置↔包一致；不匹配 → 拒绝加载**。看板可标 `pilot \| stricter`」 |
| **ADR-061**「L1 工程绿 ≠ 业务签字 PASS」 | `prds/11-decisions/00-adr-index.md:1930-1936` | 「**决策**：分轨——**工程绿**（vitest + mock/注入）与 **签字 PASS**（signoffEligible + live + RACI 人签 + ADR-046 快照）分离；mock coverage **禁止**进签字叙事」 |

**§6.0 的「不一致 → 拒绝加载」是 ADR-046 的一部分还是另一处？** **[源码/文档事实]** 是 **ADR-046 决策 #4** 的下沉（`:1026` 逐字「运行时加载校验配置↔包一致；不匹配 → 拒绝加载」），同义另见 ADR-046 `#2.4`（`:1017`）。§6.0 表是它的**产品化表达**。

### 4.4 「加载」行反例列有无更细解释 · 别处有没有「加严包必须真实生效」

| 位置 | 原文 | 说明 |
|------|------|------|
| `prds/08-quality/02-evaluation-and-gates.md:151` | 反例列「运行时 τ 与签字包脱节」 | **本行之外的更细解释：全仓未见**（[未核] 找过 `prds/00–11`、`docs`、`.trellis`，`grep -n "运行时 τ 与签字包脱节|运行时质量参数"` 只命中此一处 + 引用它的镜像/裁定文） |
| `prds/00-product/01-vision-and-success.md:113` | 「配置 \| 运行时 τ/门禁数字须来自已签字包；与 `eval_runs` 关联；不一致 → **拒绝加载**」 | 加强句 |
| `prds/10-delivery/03-acceptance-scenarios.md:344` | 「T6 配置绑定 \| KB 快照 τ/门禁数字 **=** 已签字包；篡改快照 → 加载拒绝或不一致告警失败」 | 验收剧本 T6 |
| `prds/09-security/01-auth-acl-compliance.md` | **[未核] 0 命中**：`grep -n "加严\|已签字包\|签署包\|真实生效\|拒绝加载"` 无输出 | 安全 PRD **未**提「加严包真实生效」 |

---

## 5. 可核对性与作用域（为裁定票准备事实）

**一句话结论**：若要比对，**包内 τ 最可靠的现有载体是 `report_json.repro.tauClaim`**（仅 api CLI 行有真值，worker 行恒 `null`）；`gateSnapshot` **未落库**、`l1-gate-snapshot.json` **只在文件里且被 gitignore**。可能的挂点有 4 个，今天**都没有现成 200-路径测例钉住**（`defaultQuality` 尤其没有直接测），加闸不会自动获得回归保护。

### 5.1 包内 τ 从哪个字段取最可靠

| 载体 | 位置 | 可靠性 |
|------|------|--------|
| `report_json.repro.tauClaim` | `packages/contracts/src/eval/l1-repro.ts:86`；写入 `run-l1-golden.ts:806` | **api CLI 行 = 真值**；worker 行 = `null`（`run-l1-batch.ts:300-309` + `emptyL1Repro` `:125`）→ 混入 worker 行时「取不到 τ」 |
| `report_json.gateSnapshot.tauClaim` | `adr046-snapshot.ts:59` / `:305` | **[推断]** **未落库**（persist `:826` 早于 bind `:863`）；只在 `l1-last-run.json` / `l1-gate-snapshot.json` |
| `l1-gate-snapshot.json` | 写 `adr046-snapshot.ts:315-323`（`writeBoundSnapshot`，文件名 `:321`） | 文件产物；`.gitignore:16 artifacts/` 整个目录被忽略 → **不随仓、进程不可读** |
| `eval_runs` 列 | `packages/db/src/schema/ask/eval-runs.ts` | **无 τ 列**；只有 `report_json` |

**推论**：任何「运行时加载包 τ」实现必须**从 `report_json` 里挖**（或先补落库/补列），且必须处理 worker 行 `tauClaim=null` 的分支。

### 5.2 一致性判定的可能挂点（各有几个、影响面）

| 挂点 | 位置 | 挂了会影响什么 | 今天的测例哪些会翻 |
|------|------|----------------|--------------------|
| **A. `defaultQuality`（设置读面）** | `apps/api/src/routes/kb-settings.ts:66-72` | `GET /settings` 的 `qualitySnapshot`：对不一致的 KB 回 5xx / 拒 / 降级为 `gatePackageId=null`；影响 admin 设置只读区 | **[源码事实] 无 200-路径专测**：所有设置 200 用例都**注入** `qualitySnapshot`（`settings-http.test.ts:55`、`settings-audit-http.test.ts:54`、`create-kb-with-models.test.ts:126,189`、`doc-type-catalog-http.test.ts:43`、`kb-consume-bindings-http.test.ts:64`、`kb-scope-write-isolation.test.ts:49`、`kb-member-gate.test.ts:360`）。唯一未注入的 `apps/api/tests/auth/enforce-permission-matrix.test.ts:81`（`createKbSettingsRoutes({ resolveKbMember })`）走的 settings 条目是 **PATCH**（写入口族 `:130-134`，期望「缺对应码」→ 403），止于权限中间件 → **不触达 `defaultQuality`**。→ **新闸在此挂点无回归保护** |
| **B. api 启动** | `apps/api/src/index.ts:18-48` | 每个 KB 各一包，全局启动闸要么对全库、要么无逐库语境；可能让「试点前无包」也拒 | **[源码事实] 无**：`index.ts` 无测例（`createApp` 测试只碰 health/ready/openapi，见 `tests/env/*`）；仅在 `start()` 加逻辑不影响 `createApp` 测试 |
| **C. ask 运行路径** | `apps/api/src/services/ask/execute.ts:204`（+ `:271` trace） | 每轮 ask 都要核包；**会影响 min 否决结果**（`graph/run.ts:542`），行为可见 | **[源码事实] 直断言「executeAsk 用 env τ」的测例：未找到**。ask 测例多注入 `graphDeps`（如 `execute-trace.test.ts:22,98`、`answer-kind.test.ts:45`），τ 由 `env.TAU_CLAIM` 仍传入，但**无测例断言其值**。`min-veto.test.ts:14` / `_support/graph-harness.ts:25` 是在**图级**传 `tauClaim:0.5`，**不经** `executeAsk` 的 env 注入 |
| **D. worker 批跑** | `apps/worker/src/eval/run-l1-batch.ts:300-309` / `persist.ts:102-150` | worker 侧 `repro.tauClaim=null`；若要「回填包 τ」会改 worker 报告形状 | **[源码事实] 会翻**：`apps/worker/tests/eval/run-l1-batch-repro.test.ts:67` 断言 `report.repro.tauClaim` 为 `null`（map 已把 worker 列 out of scope） |

### 5.3 今天无包时的形状与用例（新闸不得让试点前变红）

| 位置 | 事实 |
|------|------|
| `apps/api/src/routes/kb-settings.ts:70-71` | 无合格 run → `gatePackageId:null`、`effectiveAt:null`（`pkg?.id ?? null`） |
| `apps/api/tests/eval/signoff-package-derive.test.ts:60-63` | 「无合格 run → 保持 null（不臆造 id、不代签）」 |
| `apps/api/tests/eval/signoff-package-derive.test.ts:77-82` | 「创建时间缺失 → `effectiveAt` 为 null（不补造时刻）」 |
| 设置读面 200 用例 | 全部注入 `gatePackageId:null`（上表 A 列） → 钉住「无包 = 正常 200」 |

**结论**：新闸必须允许「无包 → 正常流程（τ 仍 env、`gatePackageId=null`）」，否则 §5.3 这批用例与试点前 dogfood 都会红。

### 5.4 会翻的既有断言（若裁定要求「不一致即拒」或「τ 取自包」）

**诚实结论：按今天源码，我逐条过筛后未找到任何一条「直接钉住 env-τ / 包-τ 关系」的既有断言会必翻。** 候选与其命运：

| 路径:行号 | 断言 | 若「不一致即拒」 | 若「τ 取自包」 | 为什么 |
|-----------|------|------------------|----------------|--------|
| `apps/api/tests/eval/l1-repro-fields.test.ts:146` | `expect(report.repro.tauClaim).toBe(report.gateSnapshot?.tauClaim)` | **不翻** | **除非两值分流才翻** | 二者今天同取局部变量 `tauClaim`（`run-l1-golden.ts:757/806/847`）；若「取自包」仍由单一变量同时喂报告与快照，则仍相等 |
| `apps/worker/tests/eval/run-l1-batch-repro.test.ts:67` | `expect(report.repro.tauClaim).toBeNull()` | 不翻 | **会翻**（若要求 worker 回填 τ） | worker 今天不填 τ；map 已把 worker 划 out of scope，故此条**取决于作用域是否含 worker** |
| `apps/api/tests/env/defaults.test.ts:193-204` | 单 `TAU_CLAIM` 通过 / 双源不等拒 / 双源相等通过 | 不翻 | 不翻 | 只管 `TAU_CLAIM_LEGACY`，与包无关 |
| `apps/api/tests/kb/settings-http.test.ts:113` | `qualitySnapshot.tauClaim === 0.55` | 不翻 | 不翻 | 值来自**注入** `:55`，非 `defaultQuality` |
| `apps/admin/tests/ops/kb-settings-workspace.test.tsx:72` 等 | `qualitySnapshot:{tauClaim:0.7}` | 不翻 | 不翻 | admin 用夹具 |

**反向要点（重要）**：**[源码事实]** 因为 `defaultQuality`（本图最可能的挂点）**没有 200-路径专测**（生产装配 `apps/api/src/app.ts:92` 挂的默认实例也无人测其 `GET /settings`），任何新闸在此挂上后，**既有测例不会变红、新行为也不会被既有测例保护** —— 工单 03 需要新增专测（`<包>/tests/<能力>/<意图>.test.ts`）才能钉住「一致 → 不变 / 不一致 → 拒 / 无包 → 能跑」三态。

---

## 6. 镜像与 spec 的现状

| 位置 | 原文句 |
|------|--------|
| `docs/module-status/api.md:58` | 「`qualitySnapshot.tauClaim` 只读（取自 `env.TAU_CLAIM`）；`sessionRewrite` 固定锁定为关闭」 |
| `docs/module-status/api.md:136` | 「**签字包只读回填**：`GET …/settings` 的 `qualitySnapshot.gatePackageId` / `effectiveAt` **从 `eval_runs` 读时派生**…合格 = `run_type=golden_2x2` ∧ `status=succeeded` ∧ `retrieve_mode=live` ∧ `signoff_eligible ∈ {'1','true'}`，取 KB 内**最近一条**…`tauClaim` **仍**取 `TAU_CLAIM`（ADR-007 唯一源）。**RACI 人签是文件产物**…**≠** 业务人签。SQL 谓词未经真 PG 验证」 |
| `docs/module-status/api.md:184`（评测硬门的数据源债） | 详列人工抽检 / 校准规模 / live judge / 版本载体 null / L2 零容忍等债 |
| `docs/module-status/api.md:207`（技术债表） | 「**§6.0 运行时「从已签字包加载 τ」无加载口（验收剧本 T6）** \| …今天只有**写侧 + CLI**，全仓**无运行时读取 / 加载入口** → 运行时质量参数与签字包的绑定在服务侧不可观测 \| 撞 **ADR-007「`TAU_CLAIM` 唯一源」**（源码注释自陈：改由签字包加载须先 ADR）→ 销账条件 = ADR → 改 PRD → 升 `prds/README.md` 版本。裁定见 wayfinder 图 acceptance-divergence」 |
| `.trellis/spec/api/backend/l1-eval.md:88` | 「`tauClaim`（**与快照同一个 τ**）」 |
| `.trellis/spec/api/backend/l1-eval.md:161` | 「本跑 2×2 仍按 env `TAU_CLAIM` 的真实 outcome。**不**写 env、**不**让公开 ask 传 τ、**不**进 `signoffEligible`。」 |
| `.trellis/spec/api/backend/l1-eval.md:119-120` | `bindQualitySnapshotToEval` / `writeBoundSnapshot` 两行；后者注明「写 `l1-gate-snapshot.json`（gitignore 产物）」 |
| `.trellis/spec/api/backend/l1-eval.md:396` | 「ADR-046 快照：`runL1Golden` 写 `l1-gate-snapshot.json` 并挂 `gateSnapshot`/`gateVerdict`；默认不代签 → `signedPackage=false`…」 |
| `.trellis/spec/db/backend/database-guidelines.md:151` | 「`eval_runs` 写库时间用 `formatLocalDateTime`…L2 也可写 `run_type=session_multiturn`；L2 `signoff_eligible` **仍 0**。mock 跑 `signoff_eligible=0`。有账本 ≠ 准出。」（**无**「签字包 / `signedPackage`」字面句） |
| `apps/api/README.md:106` | 「最近跑 \| `artifacts/l1-last-run.{json,md}` + `l1-gate-snapshot.json`（gitignore；含 `retrieve_mode` / `signoffEligible` / ADR-046 绑定）」 |
| `apps/api/README.md:136` | 「`signoffEligible` = live **且** 两类各≥30。ADR-046 快照随批跑写入并绑定 eval 身份；`signedPackage`/`businessPass` 另须四要素（含人签）且 coverage>0、非全 `internal_guard`。**禁止**当成绩单。」 |

`.trellis/spec/api/backend/index.md:86` 另有一行指针：T6「§6.0 与 ADR-007」列入 **ADR-ready 裁定书（八条）**，指向 `.scratch/acceptance-divergence/research/02-adr-ready-findings.md`。

---

## 7. 反过来问（防高估）

### 7.1 §6.0「加载」行有没有可能已被某处实现

**没有。** 逐处找过再回答：

| 找过的位置 / 模式 | 结果 |
|-------------------|------|
| `grep -n "readFileSync.*gate-snapshot\|readBoundSnapshot\|gate-snapshot"`（`apps/`） | 命中 3：`adr046-snapshot.ts:321`（写）、`l1-cli.test.ts:377`（测读）、`README.md:106`（文档）。**无 src 读点** |
| `grep -n "gatePackageId\|latestSignoffPackage\|gateSnapshot\|signedPackage\|isSignoffPackageRow"`（全仓 85 行） | 生产者/消费者逐条核：`bindQualitySnapshotToEval` / `writeBoundSnapshot` 的**唯一调用方**是 CLI `run-l1-golden.ts:841`/`:865`；运行时消费点 `latestSignoffPackage` 只回 `{id, effectiveAt}` |
| `apps/api/src` 全量 import 检索 | 无 `adr046-snapshot` 的运行时 import（该模块只被 `run-l1-golden.ts` 与测试 import） |
| `apps/api/src/index.ts:18-48` | 启动无包加载 |
| worker `apps/worker/src`（`grep "tauClaim\|gateSnapshot\|bindQualitySnapshot"`） | **无** `bindQualitySnapshot`；`repro.tauClaim` 恒 `null` → worker 既不绑定、也不读写包内 τ |

**结论（全称否定 + 范围）**：`grep -n "gatePackage\|签字包\|signoffPackage\|加载"` 于 `apps packages docs prds .trellis` 后，**运行时侧无任何「读包内质量参数 → 与运行值比对 → 拒载」的代码**。§6.0 加载行**未实现**。（反例：`RERANK_MIN_NODES` 链长不足 → 启动拒，见 `apps/api/src/env.ts` / 网关配置构造，属**同型但不同域**——那是 env↔env，不是 env↔包。）

### 7.2 有没有既有 ADR-ready 裁定 / 债行已声明本项不做或延后

**有，且明确指向本图。**（避免本图与既有裁定打架）

| 出处:行号 | 原文要点 |
|-----------|----------|
| `.scratch/acceptance-divergence/research/02-adr-ready-findings.md:118-131`（§7 T6） | 现象「只有写侧 + CLI，**无运行时读取 / 加载入口**；运行时 τ 仍取 env」；归属 **丁**；阻塞方 **ADR-007**；「改动路径：ADR → 改 §6.0/§8 与 ADR-007 → 升版」；并量清「若走实现路的爆炸面：加载器 + 优先级/冲突 + `qualitySnapshot.tauClaim` 来源改写 + 篡改检测 + 全仓读 `TAU_CLAIM` 的点」 |
| `.scratch/acceptance-divergence/issues/02-dec-per-row-ruling.md:62`、`:71` | T6 = 丁；「本图**不**发明运行时加载口」；「**不动 `prds/`**」 |
| `.scratch/quality-gate-parity/issues/01-research-gate-diff.md:85`（行 21） | 「§6.0 加载… **C**（未实现）｜`writeBoundSnapshot` 只写；全仓唯一读点是 `apps/api/tests/eval/l1-cli.test.ts:359`；运行时 `tauClaim` 仍取 env（`run-l1-golden.ts:505`、`routes/kb-settings.ts:69`）｜待加『读快照 → 与运行时参数比对 → 不一致拒绝』的加载口」 |
| `.scratch/l1-signoff-evidence/map.md:104`、`:113` | 「与 ADR-007 冲突 → 属**改冻结语义**，须 ADR → 改 PRD → 升版。本图列进 Out of scope，**留给专门的图**」 |
| `.scratch/l2-report-determinability/map.md:129`、`:136` | 「前图已划出，本图不碰」 |
| `docs/module-status/api.md:207` | 见 §6（技术债表行） |
| `docs/testing/coverage/03-ops.md:114` | T6 行「已裁定：丁…**不发明运行时加载口**…阻塞方 = ADR-007；销账条件 = ADR → 改 PRD → 升版」 |

**判断**：本图（`gate-package-load-gate`）正是上述各图「留给专门的图」所指的图；既有裁定**未**声明「本项永不做」，只声明「须先 ADR」。故本图若不先出 ADR，则与既有裁定一致的做法是**加严式澄清或记债**，而非无 ADR 改冻结语义。

### 7.3 不动 PRD 能否满足 §6.0 字面要求

**[分析，非裁定]** §6.0 加载行「运行时质量参数 **仅**来自已签字包；不一致 → **拒绝加载**」有几种读法，各读法下要不要改 PRD：

| 读法 | 释义 | 要不要改 PRD | 依据 |
|------|------|--------------|------|
| **读法 1「源切换」** | 「仅来自已签字包」= τ 的**来源**从 env 改为包内；env 只作兜底/无包时 | **要改**：直接改 ADR-007 的「唯一源」语义 | ADR-046 `#4`（`:1025`）：「`tauClaim` 等**须来自**已签字门禁包推导/登记」 |
| **读法 2「一致性闸」** | env 仍是源，但**有包时**必须与包内 τ 相等，不等 → 拒（加严式） | **可不改**：不换源、只加约束；但**是否需 ADR** 取决于「加约束」是否被认作改冻结语义（ADR-007 未必禁止「多一道一致性闸」） | §6.0 的「**不一致 → 拒绝加载**」可读作「源的**一致性**要求」，未必是「源本身」 |
| **读法 3「有包才适用」** | 「仅来自已签字包」隐含「**存在**已签字包」前提；无包（试点前）不适用 | 语义澄清；**可不改** | §6.0 锚点行 `:148`「KB 未声明则用默认」；5.3 的无包用例 |
| **读法 4「量词收窄」** | 「运行时质量参数」**是否只指 τ**（不含档位 / `contextMode` / 门限常量 / `sessionEnabledDefault`） | 若只做 τ → 与 map「先收可核对的那一个」一致；不涉 PRD 改动 | 见 §5.1；map「Not yet specified」首条同问 |

**只回答「有几种读法、各读法下要不要改 PRD」，不下裁定**：读法 1 必改 PRD（撞 ADR-007）；读法 2/3/4 在**字面**上可在不动 PRD 下落地为「τ 仍取 env ∧ 有包时 env 须等于包内 τ ∧ 无包放行」，但**是否被既有裁定接受为「加严而非改冻」**属工单 02 的裁量。

---

## 附 A · 会翻的既有断言（汇总）

见 §5.4。**核心结论**：按今天源码，
- 若裁定 = 「不一致即拒」并挂在 `defaultQuality`：**0 条既有断言必翻**（该挂点无 200-路径专测）。
- 若裁定 = 「τ 取自包」并改 CLI 报告/快照：`apps/api/tests/eval/l1-repro-fields.test.ts:146` **不翻**（除非报告与快照分流）；`apps/worker/tests/eval/run-l1-batch-repro.test.ts:67` **仅在把 worker 纳入作用域时翻**。
- **真正风险不是「翻测试」，而是「无测试可翻」**——新闸需新增三态专测。

## 附 B · 反直觉 / 易踩坑

1. **ADR-007 原文并没有说「唯一源 = env」。** `prds/11-decisions/00-adr-index.md:71-76` 只说「唯一 tauClaim / 废弃双阈值」；「env 唯一源」是 `apps/api/src/env.ts:16`、`.env.example:17-19`、`README.md:81-83` 三处**下游固化**出来的。§6.0 与 ADR-007 的「冲突」严格讲是 §6.0 与**下游固化**冲突，措辞精度会影响裁定依据。
2. **「报告与快照不出现两个 τ」成立，但靠的是共用变量，不是校验。** `run-l1-golden.ts:757` 的注释成立（`:806` 与 `:847` 同变量）；它**不**证明任何跨源一致性——同一条 run 的 DB 行里**根本读不到** `gateSnapshot`（[推断] persist `:826` 早于 bind `:863`）。
3. **worker 产出的「签字包」里 τ 是 `null`。** `latestSignoffPackage` 只筛**列**，worker 的 `golden_2x2` live 行也会入选（`services/eval-runs.ts:337-349`），但其 `report_json.repro.tauClaim` 恒 `null`（`run-l1-batch.ts:300-309`）且**无 `gateSnapshot`**。任何「从包内取 τ」的实现都会踩到「有的包没有 τ」。
4. **`latestSignoffPackage` 的排序键是 `createdAt` 而非 `ranAt`**（`services/eval-runs.ts:340`、`:350`）；「最近一条」与「最近一次跑」可能不同（CLI 直写时 `ranAt` 取报告 ISO、`createdAt` 取插入时刻）。
5. **`signoff_eligible` 是字符串双态。** 纯函数与 SQL 都写成 `∈{'1','true'}`（`eval-runs.ts:47`、`:349`、`:60`），但 DTO 输出 `mapRow` 已折成布尔（`eval-runs.ts:206`）、`toEvalRunDto` 再回布尔；改闸时别按布尔写 SQL。
6. **`extraStatsFromReport` 从不读 `tauClaim` / `repro` / `gateSnapshot`。** `services/eval-runs.ts:99-151` 只挖几个顶层统计键 → 「包内 τ」在运行时**无任何既有读点**，不是「藏得深」，是**真的没人读**。
7. **设置读面的「质量快照」是 env τ 与包 id 的拼接，且无测例钉住拼接。** `kb-settings.ts:67-71` 的组合在 `tauClaim≠包内 τ` 时误导；而所有 200 用例都注入 `qualitySnapshot`（§5.2 A），`defaultQuality` 自身无专测。
8. **`TAU_CLAIM_LEGACY` 是「同型先例」但不含 DB。** `apps/api/src/env.ts:207-213` 证明仓内**已有**「双源不一致 → 启动拒」的范式与测例（`tests/env/defaults.test.ts:193-204`），可作**形状**参照；但它在 `parseEnv()`（`:271`）期、无 DB，包校验不能照抄到同一处。
9. **`.env.example:18-19` 与 `README.md:83` 都把「双源不一致 → 启动失败」写进了对外文档**，措辞是「防双源」。若裁定采纳「env 与包必须一致」，措辞上会与既有「防双源」叙事形成呼应，但也可能被读成「又多一个源」。
10. **`report_json` 被两条路径写入且**列白名单**不同：** api CLI 写**整份对象**（含 `repro` 全键、`mk` `tauClaim` 真值），worker 写**显式白名单**（`repro` 保留但 `tauClaim=null`）。同一张表同一列，行间形状不一致——这是「包内 τ 提取」必须在两条来源上都判空的原因。
