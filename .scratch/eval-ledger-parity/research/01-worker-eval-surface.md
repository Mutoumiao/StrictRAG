# worker 评测面静态侦察（工单 01）

## 目标 / 范围 / 方法

- **目标**：为「让 worker 队列评测入口接上语料映射账本（`eval-ledger-parity` 图）」核实八组事实，给工单 02–06 提供带行号的证据底座。
- **范围**：只读仓库源码与文档；不改任何既有文件。唯一写入 = 本文件。
- **方法**：纯静态阅读。用 `read_file` 行号锚点核对；`grep` 行号在不确时用 `read_file` 复核。**未起任何服务**（不 docker / 不 pnpm dev / 不连库）。凡不能静态确认的一律标「未核实」。所有路径相对仓库根 `D:\projects\ai-stared-project\StrictRAG`。

> 图判据线（来自 `.scratch/eval-ledger-parity/map.md:1`）：`hitAtK` / `docHit` 这个数字，在 api CLI 与 worker 队列**两条入口**上必须是**同一含义**。

---

## 1. 生产路径的完整调用链

| 跳次 | 位置 | 事实 |
|------|------|------|
| ① HTTP 入口 | `apps/api/src/routes/eval.ts:238` | `routes.post('/knowledge-bases/:kbId/eval/runs', evalMw, ...)` |
| ② 入队调用点 | `apps/api/src/routes/eval.ts:276-286` | `const jobId = await enqueue({ tenantId, kbId, runId, userId, retrieveMode, runType, requestId, maxCases })` |
| ③ 默认 enqueue 绑定 | `apps/api/src/routes/eval.ts:41`（import）· `:114`（`const enqueue = deps.enqueue ?? enqueueEval;`） | 默认实现是 api `services/queue.ts` 的 `enqueueEval` |
| ④ 入队函数 | `apps/api/src/services/queue.ts:60-64` | `enqueueEval(data)` → `getEvalQueue().add(EVAL_JOB_NAME, data)` |
| ⑤ 队列构造 | `apps/api/src/services/queue.ts:40-52` | `new Queue<EvalJobData>(QUEUE_NAMES.EVAL, ...)`，`attempts: EVAL_JOB_DEFAULT_ATTEMPTS` |
| ⑥ 队列名 / job 名 | `packages/contracts/src/async/queues.ts:8`（`EVAL: 'sr-eval'`）· `packages/contracts/src/async/eval-job.ts:27`（`EVAL_JOB_NAME = 'golden_2x2'`）· `:26`（`EVAL_JOB_DEFAULT_ATTEMPTS = 1`） | BullMQ 队列名 `sr-eval`；job name 恒 `golden_2x2` |
| ⑦ worker 注册点 | `apps/worker/src/index.ts:113-125` | `new Worker<EvalJobData>(QUEUE_NAMES.EVAL, async (job) => { ... handleEvalJob(job.data) ... })`（调用在 `:117`；import 在 `:15`） |
| ⑧ 消费者 | `apps/worker/src/eval/consumer.ts:16-19` | `export async function handleEvalJob(raw, deps = {})`；`EvalJobDataSchema.safeParse` 在 `:20` |
| ⑨ 批跑函数 | `apps/worker/src/eval/consumer.ts:96-103`（L1 `runL1Batch`）· `:52-57`（L2 `runL2Batch`） | opts 见第 3 节 |
| ⑩ 落库 | `apps/worker/src/eval/consumer.ts:105`（`persist.saveReport`）· `:58`（`persist.saveL2Report`） | `persist = deps.persist ?? evalPersist`（`:25`） |
| ⑪ 表 | `apps/worker/src/eval/persist.ts:102`（`update(evalRuns)`）· `:154` | `saveReport` / `saveL2Report` 均 `update(evalRuns).set({...}).where(eq(evalRuns.id, runId))` |
| ⑫ schema | `packages/db/src/schema/ask/eval-runs.ts:9` | `pgTable('eval_runs', ...)` |

### 这条链今天有没有被任何测试端到端跑过？

**没有。** 两类测试各覆盖半截，中间互不衔接：

- **api 侧** `apps/api/tests/eval/http-eval-runs.test.ts`：`it('无黄金题 POST 400；有题则入队并回 queued')`（`:119`）等用**注入的 enqueue**（`:126` `enqueue: async () => 'job-x'`；`:155-156`；`:382-383`），**从不 import worker**，也不跑 BullMQ。文件头自陈「请求线程不跑 L1；worker 消费」（`:5`）。
- **worker 侧** `apps/worker/tests/eval/consumer.test.ts`：`it('有题则跑批并 saveReport')`（`:81`）与 `it('session_multiturn 跑 L2 并 saveL2Report')`（`:106`）用 **memoryPersist**（`:32-77`）与**注入 execute / executeL2For**（`:85`、`:131`），**不碰 enqueue / BullMQ / 真 PG / 真 HTTP**。

`consumer.test.ts` 覆盖到哪一步为止：从 `handleEvalJob` 入口 → `runL1Batch` / `runL2Batch` → `saveReport` / `saveL2Report`（**只在内存 persist 桩上**验证 `status` 与报告对象）。**未覆盖**：`enqueueEval` 出队、`sr-eval` 队列、`GET /internal/eval/execute-ask` 真 HTTP、`eval_runs` 真读写、env 驱动的账本读取（账本尚不存在于 worker）。

---

## 2. worker 进程的 env 面

评测相关键**全清单**（`apps/worker/src/env.ts`）：

| 键 | 定义行 | 默认值 | 缺省行为 |
|----|--------|--------|----------|
| `EVAL_ASK_BASE_URL` | `apps/worker/src/env.ts:73` | `http://127.0.0.1:4000` | 空串不触发校验；HTTP 执行器用它拼 `/api/v1/internal/eval/execute-ask` |
| `EVAL_INTERNAL_TOKEN` | `apps/worker/src/env.ts:75` | `''` | 空 → `createEvalHttpExecute` / `createEvalHttpL2Execute` 每次调用返回 `{outcome:'error', errorMessage:'EVAL_INTERNAL_TOKEN is empty'}`（`apps/worker/src/eval/execute-ask-http.ts:39-41`、`:94-96`） |
| `EVAL_L2_GOLD_PATH` | `apps/worker/src/env.ts:77` | `''` | 空 → `defaultL2GoldPath()` 回落 `<repoRoot>/fixtures/l2/gold.yaml`（`apps/worker/src/eval/persist.ts:29-32`） |
| `JUDGE_CALIB_SCORER` | `apps/worker/src/env.ts:83` | `off` | `off`→不跑打分器（`none`）；`mock`→内置伪打分器；`http`→用注入打分器（来源 `live`） |

除以上四键外，`apps/worker/src` 中**无**其它 `EVAL_*` 键（grep 全仓 worker `EVAL_` 仅命中 env.ts 这四个定义点）。**今天 worker 的 env 面没有 `L1_DOC_MAP` / `L2_DOC_MAP`。**

**worker 读 env 的时机**：`env.ts:160` `export const env = parseEnv()` 在**模块加载期**一次性求值（`loadDotenv` 在 `:11-13`）。之后各处只是读这份**加载期快照**——`consumer.ts:45-46` 读 `env.EVAL_ASK_BASE_URL` / `env.EVAL_INTERNAL_TOKEN`（在**每次 job** 内被引用，但值固定于进程启动）；`consumer.ts:103` 读 `env.JUDGE_CALIB_SCORER`（每次 job 读该常量）；`persist.ts:30` 读 `env.EVAL_L2_GOLD_PATH`（每次 job 读该常量）。**没有**任何评测 env 走 `process.env` 动态读取。

### 「worker 的评测输入走进程级 env」是不是既有形状？两个先例

| 先例 | 位置 | 形状 |
|------|------|------|
| `EVAL_L2_GOLD_PATH` | `apps/worker/src/eval/persist.ts:29-32` （`defaultL2GoldPath`） | 进程级 env；缺省回落仓内 `fixtures/l2/gold.yaml`；**已在 worker 落地读仓内文件** |
| `JUDGE_CALIB_SCORER` | `apps/worker/src/eval/consumer.ts:103` · `apps/worker/src/eval/run-l1-batch.ts:196` | 进程级 env（与 api 同名同义）；worker 侧无 Gateway 打分客户端，只有 `mock` 会真出值 |

**反例（评测输入不是进程级 env，而是随 job 下发）**：`retrieveMode` / `maxCases` / `runType` 由 **job payload** 承载，非 env。证据：`EvalJobDataSchema`（`packages/contracts/src/async/eval-job.ts:11-22`）含 `retrieveMode`（`:17`）、`runType`（`:18`，默认 `golden_2x2`）、`maxCases`（`:20`）；`consumer.ts:96-103` 把 `job.retrieveMode` / `job.maxCases` 传进 `runL1Batch`；`:52-57` 同理传 L2。另：被评题面本身来自 **DB**（`persist.loadGold(kbId)`，`persist.ts:41-44`）或 **env 指定文件**（L2 gold），随 job 的 `kbId` / `runType` 分流 —— 两者都**不是**把「映射账本」按 job 下发。结论：env 是既有形状，但 job payload 也有承载评测输入的先例。

---

## 3. 两个批跑函数的入参面

### `runL1Batch` opts（`apps/worker/src/eval/run-l1-batch.ts:122-140`）

| 字段 | 行 | 必填 | 缺省 |
|------|-----|------|------|
| `kbId` | `:123` | 是 | — |
| `cases` | `:125` | 是 | — |
| `retrieveMode` | `:126` | 是 | — |
| `execute` | `:127` | 是 | — |
| `maxCases?` | `:128` | 否 | 不截断（`:144-145`） |
| `now?` | `:129` | 否 | `() => new Date()`（`:223`） |
| `judgeCalibCases?` | `:129` | 否 | 无 → 不跑校准 |
| `judgeScorerMode?` | `:135` | 否 | `opts.judgeScorerMode ?? env.JUDGE_CALIB_SCORER`（`:196`） |
| `scoreJudge?` | `:136` | 否 | 无 → 声明 `http` 也无值 |
| `humanSpotPath?` | `:139` | 否 | 不传 = 缺测 → `humanSpot=null`（`:141-143`） |

**`runL1Batch` opts 里没有任何账本 / 映射参数。**

### `runL2Batch` opts（`apps/worker/src/eval/run-l2-batch.ts:128-134`）

| 字段 | 行 | 必填 | 缺省 |
|------|-----|------|------|
| `kbId` | `:129` | 是 | — |
| `cases` | `:129` | 是 | — |
| `retrieveMode` | `:130` | 是 | — |
| `executeTurn` | `:131` | 是 | — |
| `maxCases?` | `:132` | 否 | 不截断（`:136-137`） |
| `mintSessionId?` | `:133` | 否 | `() => uuidv7()`（`:137`） |
| `now?` | `:133` | 否 | `() => new Date()`（`:248`） |

**`runL2Batch` opts 里同样没有任何账本 / 映射参数。**

### `expectedDocIds` 进入 `hitAtKCase` 的全部位置（共 3 处）

| # | 文件:行 | 代码 | 分支 |
|---|---------|------|------|
| L1-1 | `apps/worker/src/eval/run-l1-batch.ts:176` | `const hit = hitAtKCase(c.expectedDocIds, evidenceDocIds);` | L1 唯一处（正常路径；error 也走此循环体，因 `execute` throw 后 `evidenceDocIds=[]`） |
| L2-1 | `apps/worker/src/eval/run-l2-batch.ts:193` | `const docHit = hitAtKCase(c.expectedDocIds, evidenceDocIds);` | L2 正常路径（末轮 evidence） |
| L2-2 | `apps/worker/src/eval/run-l2-batch.ts:219` | `const docHit = hitAtKCase(c.expectedDocIds, []);` | L2 `catch` 分支（error 题按未命中计） |

对比 api CLI（已接账本，解析在 `hitAtKCase` 之前）：`apps/api/src/scripts/run-l1-golden.ts:703-708`（解析 `:703-707`，比对 `:708`）；`apps/api/src/scripts/run-l2-golden.ts:372-373`（`expectedForHit` 包装）→ `:472`（正常）与 `:496`（error）。

### 报告对象里哪些键被字面量测试钉住（会被打红的文件与 it）

详见倒数第二节。核心：`apps/worker/tests/eval/` 下 **7 个文件**用「报告键集 ⊆ `reportJson`」或「报告键逐字等于 contracts 名单」的断言钉住报告形状。

---

## 4. 落库白名单与 DTO

### `saveReport` 的 `reportJson` 逐键清单（`apps/worker/src/eval/persist.ts:119-148`）

`mode`(`:120`) · `retrieve_mode`(`:121`) · `signoffEligible` · `ranAt` · `caseCount` · `answerableCount` · `unanswerableClassCount` · `matrix` · `coverage` · `hitAtK` · `hitAtKHits` · `hitAtKScored` · `tauStar` · `tauSweep` · `judgeAuroc` · `judgeAurocScored` · `judgeAurocSource` · `citationComplete` · `citationCompleteDen` · `humanSpot` · `repro` · `errorCount` · `cases` · `kbId`（以上均取报告真值）· **`docMapSource`(`:146`)** · **`docMapResolved`(`:147`)** · **`docMapUnmappedIds`(`:148`)**。

- **硬编码常量（非取报告真值）**：`docMapSource: 'none'`、`docMapResolved: 0`、`docMapUnmappedIds: []`（`:146-148`，注释自陈「worker 批跑无账本解析（裁定 2 范围）」）。另 `mode`(`:120`) 是 `report.retrieveMode` 的**同义重复键**（由真值派生，非独立常量）。

### `saveL2Report` 的 `reportJson` 逐键清单（`apps/worker/src/eval/persist.ts:170-194`）

`run_type` · `retrieve_mode` · `signoffEligible` · `ranAt` · `caseCount` · `passCount` · `failCount` · `errorCount` · `zeroToleranceHits` · `zeroToleranceCoverage` · `nearCorefPassRate` · `nearCorefPassDen` · `docHitRate` · `docHitHits` · `docHitScored` · `citationComplete` · `citationCompleteDen` · `repro` · `cases` · `kbId` · **`docMapSource`(`:190`)** · **`docMapResolved`(`:191`)** · **`docMapUnmappedIds`(`:192`)**。

- **硬编码常量**：`docMapSource: 'none'` / `docMapResolved: 0` / `docMapUnmappedIds: []`（`:190-192`）。
- 另 DB 列 `matrixA/B/C/D = 0`、`coverage = null` 为硬编码常量（`:161-165`），**不是** `reportJson` 键。

### `eval_runs` 表列清单（`packages/db/src/schema/ask/eval-runs.ts:9-36`）

`baseColumns`（`:10`）· `tenantId uuid`(`:11`) · `kbId uuid NOT NULL`(`:12`) · `runType text`(`:14`) · `retrieveMode text NOT NULL`(`:16`) · `signoffEligible text`(`:18`) · `goldPath text`(`:19`) · `caseCount integer`(`:20`) · `matrixA/B/C/D integer`(`:21-24`) · `coverage real`(`:25`) · `errorCount integer`(`:26`) · `ranAt text NOT NULL`(`:27`) · `status text`(`:29`) · `jobId text`(`:31`) · `errorMessage text`(`:32`) · **`reportJson jsonb('report_json')`(`:34`)** · `notes text`(`:35`)。

- **`reportJson` 列类型 = `jsonb`**（`packages/db/src/schema/ask/eval-runs.ts:34`），非文本。

### `GET …/eval/runs/:runId` 的 DTO 映射

- 映射函数：`toEvalRunDto`（`apps/api/src/services/eval-runs.ts:203-229`）。它调用的两个 `reportJson` 读取器：
  - `extraStatsFromReport`（`:95-131`）从 `reportJson` 取 **7 键**：`passCount`(`:117`)、`failCount`(`:118`)、`zeroToleranceHits`(`:119`)、`hitAtK`(`:120-121`)、`hitAtKHits`(`:122`)、`hitAtKScored`(`:123`)、`tauStar`(`:124-125`)、`judgeAuroc`(`:126-129`)。（严格说 8 个取值点，7 个键名。）
  - `casesFromReport`（`:132-172`）从 `reportJson.cases` 取行（`:135`）。
- **`docMapSource` / `docMapResolved` / `docMapUnmappedIds` / `repro` / `zeroToleranceCoverage` 等键不被 DTO 透出**（`toEvalRunDto` 固定键集 `:203-229` 中无这些键）。
- Zod schema：`EvalRunSchema`（`packages/contracts/src/eval/eval-run.contract.ts:32-58`），**是 `.strict()`**（`:58`）。多余键会被拒。`EvalRunListResponseSchema`（`:82-86`，亦 `.strict()`）在 `apps/api/src/routes/eval.ts:219-221` 对列表做 `.parse()`；单条 `GET …/:runId` 直接 `ok(c, toEvalRunDto(row, true))`（`routes/eval.ts:236`），**未过 schema parse**。因 `toEvalRunDto` 只产出固定键，`.strict()` 不构成运行时风险。

---

## 5. api 侧账本消费的现成资产

### `resolveCorpusLedgerForRun` 完整签名（`apps/api/src/eval/corpus-map.ts:52-70`）

```ts
export function resolveCorpusLedgerForRun(input: {
  ledgerPath: string;
  kbId: string;
  repoRoot: string;
}): CorpusLedger
```

**全部失败分支**（均抛 `CorpusLedgerError`）：

| 分支 | 行 | 错误消息原文 |
|------|-----|--------------|
| 读文件失败（缺文件 / IO） | `corpus-map.ts:27-29` | `cannot read corpus ledger: ${ledgerPath}: ${err.message}` |
| 非 JSON | `:35-37` | `invalid corpus ledger JSON in ${ledgerPath}: ${err.message}` |
| 形状违约（`parseCorpusLedger` 抛） | `:42-44` | `invalid corpus ledger in ${ledgerPath}: ${err.message}` |
| `kbId` 不符 | `:58-61` | `corpus ledger kbId ${ledger.kbId} != run KB ${input.kbId}` |
| `corpusFingerprint` 不符（对当前夹具重算） | `:62-67` | `corpus ledger corpusFingerprint ${ledger.corpusFingerprint} != current fixtures ${current}` |

`CorpusLedgerError` 定义并导出：`apps/api/src/eval/corpus-map.ts:14`（`export class CorpusLedgerError extends Error`）。读文件辅助 `loadCorpusLedgerFile`：`:22-45`。

### `run-l1-golden.ts` 里「读账本 → 解析 → 进 `hitAtKCase` → 不符则 `exit 2`」精确代码块

- import：`apps/api/src/scripts/run-l1-golden.ts:33`（`import { CorpusLedgerError, resolveCorpusLedgerForRun } from '../eval/corpus-map.js';`）
- 读账本 + 校验（在批跑循环前）：`:649-655`

```ts
const ledger = opts.docMapPath
  ? resolveCorpusLedgerForRun({
      ledgerPath: opts.docMapPath,
      kbId: opts.kbId,
      repoRoot: opts.repoRoot ?? resolveRepoRoot(),
    })
  : null;
```

- 解析 + 进 `hitAtKCase`（比对前）：`:702-708`

```ts
// 有账本时把逻辑 id 换成 uuid（缺映射原样保留 → 必然 miss）；无账本逐位保持今天语义
const expectedDocIds = ledger
  ? resolveExpectedDocIds(c.expectedDocIds, ledger)
  : c.expectedDocIds;
const hit = hitAtKCase(expectedDocIds, evidenceDocIds);
const accumulateHitAtK(...)  // :709
```

- 不符则 `exit 2`：`:936-945`

```ts
} catch (err) {
  if (
    err instanceof GoldLoadError ||
    err instanceof HumanSpotLoadError ||
    err instanceof CorpusLedgerError
  ) {
    console.error(err.message);
    process.exit(2);
  }
  console.error(err);
  process.exit(1);
}
```

- env 读入口：`:866`（`const docMapPath = process.env.L1_DOC_MAP?.trim() || undefined;`），随 `runL1Golden` 传入 `:889`。
- L2 对应块：`run-l2-golden.ts:362-368`（读 + 校验）· `:369-373`（`expectedForHit` 包装）· `:472` / `:496`（比对）· `:615-621`（`exit 2`）· env `:584`（`L2_DOC_MAP`）。

### `packages/contracts/src/eval/corpus-ledger.ts` 三个函数

| 函数 | 行 | 签名 | 返回形状 |
|------|-----|------|----------|
| `parseCorpusLedger` | `:165-203` | `(raw: unknown): CorpusLedger` | 形状 + 版本 + 指纹自洽校验；`entries` 归一为 `logicalId` 升序 |
| `resolveExpectedDocIds` | `:217-230` | `(expected: readonly string[] \| null \| undefined, ledger: CorpusLedger): string[]` | 命中的换 uuid；账本里**没有的原样保留**（比对必然 miss）；trim → 去空项；空名单 → `[]` |
| `summarizeDocMap` | `:239-261` | `(expectedById: ReadonlyArray<readonly string[] \| null \| undefined>, ledger: CorpusLedger \| null): DocMapSummary` | `{ docMapSource, docMapResolved, docMapUnmappedIds }`（`DocMapSummary` 定义 `:55-60`；`DOC_MAP_SOURCES = ['ledger','none']` 在 `:51`） |

`CorpusLedger` 类型定义 `:39-48`；`CorpusLedgerEntry` `:24-35`；`buildCorpusLedger`（入库 CLI 用）`:130-159`。

### 重点判断：哪些是纯函数 / 无 api 专属依赖

| 资产 | 文件 | 依赖 | 能否直接被 worker import |
|------|------|------|--------------------------|
| 账本形状 + 解析 + 指纹 + 汇总 | `packages/contracts/src/eval/corpus-ledger.ts` | **仅** `node:crypto`（`createHash`，`:18`）；**无** fs / 无 `repoRoot` / 无 `process.exit` | **能**。纯函数，已是 contracts 子路径导出 |
| 语料夹具读取面 | `apps/api/src/eval/corpus-fixtures.ts` | `node:crypto` + **`node:fs`（`readdirSync`/`readFileSync`，`:11`）** + `path`/`fileURLToPath`；`defaultRepoRoot`（`:36-39`）、`readFixtureCorpus(repoRoot)`（`:44-67`）、`fixtureCorpusFingerprint(repoRoot)`（`:70-72`） | **不能直接**：该文件在 `apps/api` 包内，worker 无 `@strict-rag/api` 依赖（见 `.scratch/eval-ledger-parity/map.md` 立图补充表）。带 `repoRoot` + fs，需上移或复制 |
| 读账本 + 新鲜度校验 | `apps/api/src/eval/corpus-map.ts` | `node:fs` `readFileSync`（`:8`）+ `./corpus-fixtures.js`（`:12`，相对 import → api 包内）+ 相对路径耦合；`resolveCorpusLedgerForRun` 返回账本，**不调用 `process.exit`**（exit 在 CLI 脚本里） | **不能直接**：`corpus-map.ts:12` 相对 import `./corpus-fixtures.js`，跨 app 复用不可能 |

### contracts 子路径导出与 worker 可否 import

- `packages/contracts/package.json:10`：`"./eval-corpus-ledger": "./src/eval/corpus-ledger.ts"`（**已声明**）。
- `apps/worker/package.json:17`：依赖 `"@strict-rag/contracts": "workspace:*"`。
- worker **已有**子路径 import 先例：`apps/worker/src/eval/run-l1-batch.ts:30-34` import `@strict-rag/contracts/eval-repro`（`run-l2-batch.ts:19-23` import `@strict-rag/contracts/eval-repro-l2`）。
- 结论：**worker 能 import `@strict-rag/contracts/eval-corpus-ledger`**。⚠️ 不核实项：`resolveCorpusLedgerForRun` 因依赖 api 包内 `corpus-fixtures.ts` 与相对 import，**不能**被 worker import；需在工单 02 裁定共享落点。

---

## 6. worker 侧能不能读到账本文件

### `repoRoot` 推导（`apps/worker/src/eval/persist.ts:31`）

```ts
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
```

层层数：`import.meta.url` = `.../apps/worker/src/eval/persist.ts` → `dirname` = `apps/worker/src/eval` →
上溯 1 = `apps/worker/src` → 2 = `apps/worker` → 3 = `apps` → **4 = 仓库根** `D:\projects\ai-stared-project\StrictRAG`。

即 `repoRoot` 指向**仓库根**。同日 api 侧用的是**同一表达式**（`apps/api/src/eval/corpus-fixtures.ts:36-39` 的 `defaultRepoRoot`，从 `apps/api/src/eval` 同样上溯 4 层），两条路径指向**同一个** monorepo 根。故 worker 用 `path.join(repoRoot, 'artifacts/eval-corpus-ledger-<kbId>.json')` 即可命中 CLI 落盘的同一份账本。

### `.gitignore` 里 `artifacts/` 的语义

`D:\projects\ai-stared-project\StrictRAG\.gitignore:15-16`：

```
# L1 eval last-run reports (fixtures/l1/sample-report.md is committed)
artifacts/
```

语义：`artifacts/` 是**运行产物**目录（L1/L2 报告、快照、账本），**不入库**（只有 `fixtures/l1/sample-report.md` 等样例被提交）。`docs/ops/real-stack-evidence.md:100` 亦称账本属「运行产物不入库」，`docs/ops/operable-stack.md:54` 同义。

### `docs/ops/` 有没有把 `artifacts/` 挂进 docker 容器或提供给 worker 的既有做法

**没有。** `docker/docker-compose.yml` 的 volumes 只有 `pg_data` / `es_data` / `mongo_data` / `rustfs_data`（`:106-116`），**无任何 host 目录挂载**（grep `artifacts` in `docker/` 零命中）。`scripts/up-stack.mjs` 只 `docker compose ... up -d` 起中间件（`:16`），**api / worker 用本地 pnpm dev 在 host 跑**（`docker-compose.yml:14-15` 自陈「业务进程 api/worker 仍用本地 pnpm dev（不在 compose 内）」）。故 worker 读 `artifacts/` 是**读 host 文件系统**，不需容器挂载。

---

## 7. 真栈真跑的前置

### 服务（`docker/docker-compose.yml`）

| 服务 | 行 | 端口 | 用途 |
|------|-----|------|------|
| `postgres` | `:19-34` | 5432 | 主库 + pgvector（`eval_runs` / `gold_questions`） |
| `redis` | `:36-45` | 6379 | 队列（`sr-eval`） |
| `elasticsearch` | `:47-61` | 9200 | BM25 sparse（8.15.3，无 IK） |
| `mongo` | `:63-75` | 27017 | parse 正文 |
| `rustfs` | `:82-102` | 9000/9001 | S3 兼容对象存储 |

### worker 进程启动

- 根 `package.json:10`：`"dev:worker": "turbo run dev --filter=@strict-rag/worker"`；`:17`：`"up:apps": "node scripts/up-stack.mjs"`。
- `apps/worker/package.json:5`：`"dev": "tsx watch src/index.ts"`；`:11`：`"start": "tsx src/index.ts"`。

### 关键 env 出现位置与配法

| 键 | 出现位置 | 配法 |
|----|----------|------|
| `DATABASE_URL` | `.env.example:9` | `postgres://strict_rag:strict_rag@127.0.0.1:5432/strict_rag` |
| `REDIS_URL` | `.env.example:12` | `redis://127.0.0.1:6379` |
| `EVAL_INTERNAL_TOKEN` | `.env.example:91`（**注释态**）；api 侧 `apps/api/src/env.ts:144`（默认 `''`） | 须 api / worker **相同**；空则内口关闭。样例为注释，需手动去注释并赋值 |
| `EVAL_ASK_BASE_URL` | `.env.example:92`（**注释态**） | `http://127.0.0.1:4000` |
| `EVAL_L2_GOLD_PATH` | `.env.example:93`（**注释态**） | 空 → 回落 `fixtures/l2/gold.yaml` |

`.env.operable.example` 只覆盖 ES/S3/Mongo/扫描等（`:7-30`），**不含** `EVAL_*`。

### `docs/ops/` 现成命令块（原样摘录）

`docs/ops/operable-stack.md`：

- 起中间件（`:9-11`）：
  ```bash
  docker compose -f docker/docker-compose.yml up -d
  ```
- 业务进程（`:49-50`）：
  ```bash
  pnpm db:migrate
  pnpm up:apps
  ```
- 评测语料入库 + 映射账本 + L1/L2 跑批（`:53-66`）：
  ```bash
  # 新建 KB（或 INGEST_KB_ID=<kb-uuid> 复用既有）；打印 kbId 与账本路径
  INGEST_KB_NAME=eval-corpus-kb pnpm --filter @strict-rag/api exec tsx src/scripts/ingest-eval-corpus.ts

  # 跑 L1 / L2 时按账本把逻辑 id 解析为 uuid（不传 = 与今天逐位一致）
  L1_KB_ID=<kbId> L1_DOC_MAP=artifacts/eval-corpus-ledger-<kbId>.json \
    pnpm --filter @strict-rag/api exec tsx src/scripts/run-l1-golden.ts
  L2_KB_ID=<kbId> L2_DOC_MAP=artifacts/eval-corpus-ledger-<kbId>.json \
    pnpm --filter @strict-rag/api exec tsx src/scripts/run-l2-golden.ts
  ```
- 端到端烟测（`:79-81`）：`pnpm smoke:half`。

`docs/ops/real-stack-evidence.md` §5（`:66-73`）：
```bash
docker compose -f docker/docker-compose.yml up -d      # 五服务
pnpm db:migrate                                        # 真 PG 上 apply（全新库先配 SUPER_ADMIN_*）
pnpm up:apps                                           # 或分别启 api / worker，叠加 .env.operable.example
pnpm smoke:half                                        # 端到端；ask 一步需真 Gateway
```

### `scripts/smoke-half.mjs` 是否覆盖「入队 → worker 消费」

**没有。** 该脚本流程为：`/health` → `/ready`（`:57-62`）→ dev-login（`:68`）→ 建 KB（`:83`）→ `upload-url` → `PUT` → `complete`（`:91-105`）→ 自审 403 断言（`:108-112`）→ 换人 `approve`（`:128`）→ `scan`（`:131`）→ 轮询至 `ready`（`:139-152`）→ `PATCH lifecycle=active`（`:157-160`）→ `ask` 有引用（`:165-172`）。**全程不 POST `…/eval/runs`、不涉及 `sr-eval` 队列或 worker 评测消费**。

---

## 8. 侧证（供后续回写对照）

### `docs/module-status/worker.md` 原样摘录

- `:51`：`### 评测消费者（P2 底线 + L2 归档底线）`
- `:52`：`- sr-eval concurrency=1：L1 读 gold_questions（含 expectedDocIds）→ runL1Batch（2×2 + Hit@k + 离线 τ 扫描 + 可选 Judge AUROC + 引用完整率 + 可选人工抽检账本 + §8 repro 区块）…回写 eval_runs（eval/consumer.ts）`
- `:53`：`- 默认 execute：HTTP POST /api/v1/internal/eval/execute-ask（EVAL_ASK_BASE_URL + EVAL_INTERNAL_TOKEN）；读 evidenceDocIds 计 Hit@k；…`
- `:54`：`- L1 证据面（与 api CLI 同构）：打分器来源由同名 env JUDGE_CALIB_SCORER 声明…`
- `:55`：`- L2 报告面（与 api CLI 同构）：…未映射（夹具逻辑 id vs documents.id uuid）时 docHitRate 恒 0，不得当成绩…`
- `:91`（矩阵行「L2 报告面（worker 侧）」）：`docHitRate 未映射时恒 0（夹具写逻辑 id、documents 无 external_id）→ 不得当成绩`
- `:108`（债行）：`worker 抽检来源未接生产路径` → `生产跑批 humanSpot 恒 null…销账 = 消费者按 run 提供账本路径并透传 humanSpotPath`
- `:110`（债行）：`worker saveL2Report 逐键白名单` → `漏键 = 新字段在库内静默丢弃、零测试红`
- `:134-136`：`## 2026-09-29 · 评测语料映射账本（工单 03 / 04）` … `worker 批跑本图不接映射账本（范围裁定），但其落库报告的逐键白名单已同步补上映射来源三键…worker 侧三键如实为「无映射」取值，不进任何判定。`

### `docs/module-status/api.md` 原样摘录

- `:134`：`- P2 评测底线 HTTP：…POST/GET …/eval/runs（eval.run）；空题集入队 400；只入队 sr-eval；…`
- `:143`：`- 报告可判定面（采集面 / 零容忍区块 / §8 区块，三者都不进判定）：…两侧同构锚点 = contracts L2_EVIDENCE_REPORT_KEYS（7 键）/ L2_EVIDENCE_ROW_KEYS（6 键）…`
- `:146`：`- 语料草案 fixtures/l2/corpus/ 未走 worker 入库；逻辑 id → documents.id 映射缺（documents 无 external_id）→ docHitRate 今天只能恒 0`
- `:147`：`- 边界：可入队可回读；无 准出 / 无 人签；…禁止把工程绿 / persist / 草案条数 / docHitRate 当 L2 通过`
- `:257-259`：`## 2026-09-29 · 评测语料映射账本（工单 03 / 04）` … `跑批侧在比对前把逻辑 id 解析为当前 KB 的 uuid，缺映射继续算 miss…`
- `:261`：`…边界：worker 侧 run-l1-batch.ts 不接账本（其 Hit@k 仍恒 0，且不进任何判定）；账本指「本次跑用的映射」的来源，不改变任何门限。`

### `docs/testing/coverage.md` 涉该路径的行

- `:47`：能力行 `| C | C1 黄金集 2×2；C2 τ 扫描；C3 Judge 校准；C4 Hit@k；C5 签字页 |`
- `:104`（第十一轮，图 `eval-corpus-map`）：`…跑批侧在 hitAtKCase 之前按账本解析（L1_DOC_MAP / L2_DOC_MAP…）。真栈实测…不带账本 hitAtK = 0/30、带账本 30/30…`
- `:106`（保持 `部分测` 行）：`…L2（报告可判定面已测；映射入口已于 2026-09-29 落地…剩 live 真跑归档 + RACI 人签…）`

### `docs/testing/coverage/03-ops.md` 涉该路径的行

- `:18`（C4，覆盖值 **已测**）：`| C4 | 有 expectedDocIds 时算 Hit@k | 签字剧 | 单测 | 已测 | api · worker · contracts | packages/contracts/tests/eval/l1-hit-at-k.test.ts · apps/api/tests/eval/l1-cli.test.ts · apps/worker/tests/eval/run-l1-batch.test.ts | 有非空 expected 按 evidence.docId 交集计分；…逻辑 id→uuid 的映射入口已落（2026-09-29，图 eval-corpus-map）…**仍未落**：worker 侧 run-l1-batch.ts:176 不接账本（其 Hit@k 仍恒 0，且不进任何判定）· live 真跑与业务题面人审… |`
- `:20`（派生行 `L2`，覆盖值 **部分测**）：`| L2 | L2 报告归档：…命中期望文档（docHitRate / docHitHits / docHitScored）… | … | 新增 10 文件 / 65 条 it（contracts 29 · api 20 · worker 16）：… |`

### `apps/worker/tests/index.md` 评测相关行（原样摘录）

| 文件 | 目标（摘要） | 需求锚点 | 被测 |
|------|--------------|----------|------|
| `eval/consumer.test.ts`（`:28`） | `eval 消费者须写 running→succeeded，空题集 failed。` | `prds/06-async eval.run · 功能表 §5.2` | `handleEvalJob` |
| `eval/execute-ask-http.test.ts`（`:29`） | `worker 调 api 内口必须带口令；失败不得假装 answered。` | `prds/06-async eval.run` | `createEvalHttpExecute` |
| `eval/run-l1-batch.test.ts`（`:30`） | `worker L1 批跑必须串行入 2×2，error 出格。` | `prds/08-quality §2 …` | `runL1Batch` |
| `eval/run-l1-batch-citation-complete.test.ts`（`:31`） | `worker L1 批跑必须与 api CLI 同口径采集「引用完整率」…` | `prds/08-quality/02… §2 :81 · §6 :134` | `runL1Batch` |
| `eval/run-l1-batch-human-spot.test.ts`（`:32`） | `worker L1 批跑须与 api CLI 同构落人工抽检…落库白名单不得静默丢键。` | `…§6（≥20 条 / 错 ≤1） · ADR-046` | `runL1Batch · evalPersist.saveReport` |
| `eval/run-l1-batch-repro.test.ts`（`:33`） | `worker L1 批跑须与 api CLI 落同形状的 §8 可复现区块…白名单不得静默丢弃。` | `…§8 可复现字段` | `runL1Batch · evalPersist.saveReport` |
| `eval/run-l1-batch-judge-source.test.ts`（`:34`） | `worker L1 批跑的打分器来源判别须与 api CLI 同构…白名单不得静默丢键。` | `…§4 · §6 · §6.1 · ADR-046` | `runL1Batch · evalPersist.saveReport` |
| `eval/run-l2-batch-near-coref-rate.test.ts`（`:35`） | `worker L2 批跑必须落近指代通过率并进工程 signoffEligible…` | `…§6.2 :188` | `runL2Batch` |
| `eval/run-l2-batch.test.ts`（`:36`） | `worker L2 批跑必须串行多轮窗，泄漏计零容忍，mock 不得 signoffEligible。` | `prds/08-quality §6.2 · 功能表 §10.2` | `runL2Batch` |
| `eval/run-l2-batch-evidence-collection.test.ts`（`:37`） | `worker L2 批跑必须与 api CLI 同构地落 evidence docId / 命中期望文档 / 合法 citation，落库白名单不得静默丢新键。` | `…§6.2 · 裁定 02` | `runL2Batch · createEvalHttpL2Execute · evalPersist.saveL2Report` |
| `eval/run-l2-batch-repro.test.ts`（`:38`） | `worker L2 批跑必须与 api CLI 落同形状的 §8 可复现区块…白名单不得静默丢弃。` | `…§8 可复现字段 · 裁定 02` | `runL2Batch · evalPersist.saveL2Report` |
| `eval/l2-zero-tolerance-coverage.test.ts`（`:39`） | `worker L2 报告必须与 api CLI 同构地落零容忍处置档位区块…` | `…§6.2 · 裁定 02` | `runL2Batch · evalPersist.saveL2Report` |
| `eval/persist-doc-map-keys.test.ts`（`:40`） | `worker 落库白名单必须带映射来源三键，使库内形状与 api CLI 不分叉。` | `prds/08-quality §3 / §6（Hit@20 数据面）· 裁定 02` | `evalPersist.saveReport · evalPersist.saveL2Report` |

（`:80` 声明「## 待处理（无。`src/` 下已无 `*.test.ts(x)`。）」）

---

## 回归面清单（改 worker 侧接线会打红哪些测试文件与 it）

> 分三层：**A 直接钉住报告键集 / 落库白名单**（加键或改键必红）；**B 语义钉子**（改默认行为必红）；**C 条件面**（仅当把 `corpus-map` / `corpus-fixtures` 上移或改签名时红）。路径均相对仓库根。

### A · 直接钉住报告键集 / 落库白名单（12 条 it）

| # | 文件 | it（行） | 断言要点 |
|---|------|----------|----------|
| A1 | `apps/worker/tests/eval/persist-doc-map-keys.test.ts` | `saveReport（L1）reportJson 带三键且取值 none/0/[]`（`:37`） | `reportJson.docMapSource='none'` / `docMapResolved=0` / `docMapUnmappedIds=[]`（`:48-50`） |
| A2 | 同上 | `saveL2Report（L2）reportJson 带三键且取值 none/0/[]`（`:53`） | 同款（`:64-66`） |
| A3 | `apps/worker/tests/eval/run-l1-batch-repro.test.ts` | `落库 JSON 保留 repro，且报告上的每个键都在白名单里`（`:86`） | `Object.keys(report)` 除 `retrieveMode` 外都须在 `reportJson`（`:97-100`） |
| A4 | `apps/worker/tests/eval/run-l1-batch-human-spot.test.ts` | `落库 JSON 保留 humanSpot，且报告上的每个键都在白名单里`（`:92`） | 同款 `missing` 断言（`:104-107`） |
| A5 | `apps/worker/tests/eval/run-l1-batch-judge-source.test.ts` | `报告上的每个键都在白名单里，且 judgeAurocSource 原样落库`（`:92`） | 同款 `missing` 断言（`:103-106`） |
| A6 | `apps/worker/tests/eval/run-l2-batch-evidence-collection.test.ts` | `落库 JSON 保留新采集面字段与行键，报告上的每个键都在白名单里`（`:256`） | 逐键 `toHaveProperty` + `missing`（`:270-280`） |
| A7 | `apps/worker/tests/eval/run-l2-batch-repro.test.ts` | `落库 JSON 保留 repro，且报告上的每个键都在白名单里`（`:101`） | `missing` 断言（`:112-115`） |
| A8 | `apps/worker/tests/eval/l2-zero-tolerance-coverage.test.ts` | `落库 JSON 保留 zeroToleranceCoverage，且与报告逐位相等`（`:120`） | `missing` 断言（`:136-139`） |
| A9 | `apps/worker/tests/eval/consumer.test.ts` | `有题则跑批并 saveReport`（`:81`） | 若改 `EvalPersist` 接口 / `handleEvalJob` deps 形状 → `memoryPersist`（`:32-77`）类型/运行红 |
| A10 | 同上 | `空黄金集 → failed`（`:94`） | 同款依赖注入面 |
| A11 | 同上 | `非法 payload 不写库`（`:101`） | 若改 payload 校验路径则红 |
| A12 | 同上 | `session_multiturn 跑 L2 并 saveL2Report`（`:106`） | 同款依赖注入面（`:129-138`） |

### B · 语义钉子（改默认行为必红，2 条 it）

| # | 文件 | it（行） | 断言要点 |
|---|------|----------|----------|
| B1 | `apps/worker/tests/eval/run-l1-batch.test.ts` | `有 expectedDocIds 按 evidenceDocIds 计 Hit@k；无名单不计分`（`:49`） | 直比逻辑/占位 id（`doc-a` / `doc-z`）得 `hitAtK=0.5`（`:64-70`）；若默认接 env 账本改变了无账本语义则红 |
| B2 | `apps/worker/tests/eval/run-l2-batch-evidence-collection.test.ts` | `未映射（夹具逻辑 id vs KB uuid）→ 全 false、率恒 0，且不把工程公式拉红`（`:180`） | `docHitHits=0` / `docHitRate=0` / `signoffEligible=true`（`:189-191`）—— 钉「未映射恒 0、不绝不 null」 |

### C · 条件面（仅当把 `corpus-map.ts` / `corpus-fixtures.ts` 上移进 contracts 或改签名时红，31 条 it）

| # | 文件 | 条数 | 关键 it（行） |
|---|------|------|----------------|
| C1 | `apps/api/tests/eval/l1-doc-map.test.ts` | 6 | `kbId 不符 → 拒跑（CorpusLedgerError）`（`:198`）等 |
| C2 | `apps/api/tests/eval/l2-doc-map.test.ts` | 5 | `kbId 不符 → 拒跑`（`:173`）等 |
| C3 | `apps/api/tests/eval/eval-corpus-map.test.ts` | 5 | 夹具目录 / README 对账（`:55`、`:68`、`:76`、`:86`、`:92`） |
| C4 | `packages/contracts/tests/eval/corpus-ledger.test.ts` | 15 | 契约万一被改必须全绿（`:48`–`:207`） |
| C5 | `apps/api/tests/eval/http-eval-runs.test.ts` | 8 | 若改 job payload / DTO 透出键则红（`:119`、`:186`、`:216`、`:240`、`:251`、`:317`、`:351`、`:414`） |

**合计**：直接 12 条（A）+ 语义 2 条（B）= **14 条**在正常「加账本接线」改动下最可能打红；条件面 **31 条**（C）在跨包重构时才有风险。

---

## 未核实项清单

**静态读不到、需起服务或真跑才能确认的：**

1. worker 进程真跑时的**实际 env 组合**（是否已配 `EVAL_INTERNAL_TOKEN` / `EVAL_ASK_BASE_URL` / 账本路径）—— `.env` 被 gitignore（`.gitignore:7`），静态不可见。
2. 经队列**真跑一次 L1** 的端到端行为（`POST …/eval/runs` → `sr-eval` → worker `handleEvalJob` → 落库）：本任务纯静态、未起 docker / 未连 Redis / 未连 PG。`consumer.test.ts` 只到内存桩（第 1 节）。
3. `eval_runs.report_json` 在**真 PG jsonb 列**上的回读等价性（Zod `.strict()` 只在列表路径 `routes/eval.ts:219` 生效；单条 GET 未 parse，见第 4 节）。
4. `apps/api/src/services/eval-runs.ts:285-330` 的 SQL 谓词在真 PG 上的行为（文档自陈「SQL 谓词未经真 PG 验证」，`docs/module-status/api.md:136`）。
5. worker 经 HTTP 内口 `POST /api/v1/internal/eval/execute-ask` 的真链路：需 api 起 + `EVAL_INTERNAL_TOKEN` 落值；本任务未见任何端到端测例覆盖此组合（第 1 节）。
6. **账本 ↔ 库内文档**的运行时不变量（账本 `docId` 是否仍存在于 `documents` 表）：源码侧**不做**运行时校验（`apps/api/src/eval/corpus-map.ts:4-6` 注释自陈改为人工对账）——worker 侧会不会引入该校验，属工单 02 裁定范围，静态未定。
7. worker 侧**共享落点**（`corpus-map.ts` / `corpus-fixtures.ts` 上移进 contracts 还是复制）——代码里不存在，属工单 02 待裁；本文件只核实「现状不可直接 import」（第 5 节）。

**需人工确认的边界：**

8. 本机 Docker Desktop 稳定性（`docs/ops/real-stack-evidence.md:74-75` 记录运行期自行退出多次）——影响工单 05 真栈实测，非代码问题。

**已核实但需在工单中复述的强约束（非未核实项）：** `EvalJobDataSchema` 是 `.strict()` 且**只有 8 键**（`packages/contracts/src/async/eval-job.ts:11-22`），**无任何映射 / 账本字段**——若采「随 job 下发账本路径」方案须改 payload 契约；若采「进程级 env」方案则复用既有两个先例（第 2 节）。
