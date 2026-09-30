# 01b · 研究：两条入口的题源差异（api CLI 读文件 vs worker 队列读 DB）

Type: research
Status: claimed
Parent: ../map.md
Scope：只做「题源差异」这一面（对应工单 01 的第 2 问）。不下裁定结论，只核事实、给源码路径:行号。
纪律：源码 > module-status 旧文 > task 叙事；未核实项显式标注并给可核命令。

---

## 1. 两侧题集的字段与加载实现

### 1.1 api CLI 侧（文件）

| 事实 | 位置 |
|---|---|
| `GoldCase` 形状：`id` / `question` / `type` / `expectedDocIds?` / `expectedChunkIds?` / `rubric?` | `apps/api/src/scripts/run-l1-golden.ts:76-82` |
| 唯一合法类型集合 `GOLD_TYPES` = `answerable` / `unanswerable` / `false_premise` | `apps/api/src/scripts/run-l1-golden.ts:303`（校验点在 `:429-431`） |
| 默认题源路径 `defaultGoldPath()` → `<repoRoot>/fixtures/l1/gold.yaml` | `apps/api/src/scripts/run-l1-golden.ts:310-312` |
| CLI 实际取的路径：`env.L1_GOLD_PATH ?? defaultGoldPath(repoRoot)` | `apps/api/src/scripts/run-l1-golden.ts:865` |
| 加载实现 `loadGold()`（读文件 → `JSON.parse` → 校验 → 映射） | `apps/api/src/scripts/run-l1-golden.ts:390-454` |
| 根对象必须含非空 `cases` 数组 | `apps/api/src/scripts/run-l1-golden.ts:407-411` |
| **必填**：`cases[i].id` 为非空 string | `apps/api/src/scripts/run-l1-golden.ts:419-423` |
| **必填**：`cases[i].question` 为非空 string | `apps/api/src/scripts/run-l1-golden.ts:424-426` |
| **必填**：`cases[i].type` ∈ `GOLD_TYPES` | `apps/api/src/scripts/run-l1-golden.ts:427-431` |
| `expectedDocIds` 走 `parseExpectedDocIds`，非数组 / 含非字符串 → 抛 `GoldLoadError` | `apps/api/src/scripts/run-l1-golden.ts:433-440` |
| `expectedChunkIds` / `rubric` **可选**，类型不符则静默置 `undefined`（不抛错） | `apps/api/src/scripts/run-l1-golden.ts:446-449` |
| `parseExpectedDocIds`：`undefined`/`null` → `null`；`[]`/全空白 → `null`；非字符串元素 → 抛错 | `packages/contracts/src/eval/l1-matrix.ts:91-105` |

注意：`gold.yaml` 直接走 `JSON.parse`（文件头注释自陈「JSON-shaped，零 yaml 依赖」），**不是**真正的 YAML 解析器 —— `apps/api/src/scripts/run-l1-golden.ts:400-402`。

### 1.2 worker 队列侧（DB）

| 事实 | 位置 |
|---|---|
| `EvalGoldCase` 形状：`caseKey` / `question` / `type` / `expectedDocIds?` | `apps/worker/src/eval/run-l1-batch.ts:49-54` |
| 消费者取题：`const cases = await persist.loadGold(job.kbId)`；空题集 → `markFailed('no gold questions')` | `apps/worker/src/eval/consumer.ts:88-93` |
| `loadGold` 实现：`select().from(goldQuestions).where(eq(goldQuestions.kbId, kbId))` | `apps/worker/src/eval/persist.ts:41-45` |
| 逐行映射：`caseKey` / `question` / `type` / `expectedDocIds`（`parseExpectedDocIds`） | `apps/worker/src/eval/persist.ts:46-64` |
| `asGoldType`：非法 `type` → `null` 并被 `continue` **跳过**（不抛错） | `apps/worker/src/eval/persist.ts:14-17`，跳过点 `:49` |
| `expectedDocIds` 形状校验复用 api 同函数 `parseExpectedDocIds` | `apps/worker/src/eval/persist.ts:52` |

### 1.3 逐字段对比

| 字段 | api `GoldCase`（文件） | worker `EvalGoldCase`（DB 读取后） | `gold_questions` 列 |
|---|---|---|---|
| 题号 | `id`（`run-l1-golden.ts:77`） | `caseKey`（`run-l1-batch.ts:50`） | `case_key`（`gold-questions.ts:14`） |
| 题干 | `question` | `question` | `question`（`:16`） |
| 类型 | `type` | `type` | `type`（`:19`） |
| 期望文档 | `expectedDocIds?` | `expectedDocIds?` | `expected_doc_ids`（jsonb，`:20`） |
| 期望分片 | `expectedChunkIds?` ✅ | ❌ **`loadGold` 不映射（丢弃）** | `expected_chunk_ids`（jsonb，`:21`） |
| 评分提示 | `rubric?` ✅ | ❌ **`loadGold` 不映射（丢弃）** | `rubric`（`:22`） |

- 题号命名两侧不同：文件侧叫 `id`、DB/worker 侧叫 `caseKey`。两侧走同一哈希函数时输入的字段名不同（见 §4）。
- **`expectedChunkIds` / `rubric` 在 DB 有列、在文件有字段，但 worker 的 `EvalGoldCase` 把两者丢掉了** —— `apps/worker/src/eval/persist.ts:58-63` 只 push 四个键。

### 1.4 `expectedDocIds` 在两侧的形态（逻辑 id / uuid）

- **文件侧**：`gold.yaml` 里是**夹具逻辑 id**（如 `ingest-samples/01-doc`）—— `fixtures/l1/gold.yaml:9-11`。
- **DB 侧**：`gold_questions.expected_doc_ids` 是 jsonb `string[] | null` —— `packages/db/src/schema/ask/gold-questions.ts:20`。
  - 写入契约为 `CreateGoldQuestionBodySchema.expectedDocIds`，只要求 `array(string().min(1))`，**无 uuid 约束** —— `packages/contracts/src/eval/gold.contract.ts:27`。故 DB 列里存的也是**逻辑 id 形态**（与文件同口径），uuid 转换发生在跑批期账本解析。
  - **例外**：feedback 晋升路径写 DB 时**不传** `expectedDocIds`（落 `null`）—— `apps/api/src/routes/feedback.ts:248-257`（`data` 只有 `caseKey` / `question` / `type` / `rubric`）。
- **uuid 出现的时点（两侧同构）**：跑批时用账本把逻辑 id 解析成 `documents.id` uuid；账本缺映射则**原样保留**（必然 miss）—— `packages/contracts/src/eval/corpus-ledger.ts:216-230`；api 调用点 `apps/api/src/scripts/run-l1-golden.ts:704-705`，worker 调用点 `apps/worker/src/eval/run-l1-batch.ts:211-213`。
- 比对函数 `hitAtKCase` 只做**精确交集**：`packages/contracts/src/eval/l1-matrix.ts:110-124`。

---

## 2. `gold_questions` 表：schema、列、写入方

### 2.1 schema 与迁移

| 事实 | 位置 |
|---|---|
| Drizzle 表定义 `goldQuestions`（表名 `gold_questions`） | `packages/db/src/schema/ask/gold-questions.ts:9-25` |
| 列：`tenant_id` / `kb_id` / `case_key` / `question` / `type` / `expected_doc_ids` / `expected_chunk_ids` / `rubric`（+ `baseColumns`） | `packages/db/src/schema/ask/gold-questions.ts:12-22` |
| 唯一索引 `gold_questions_kb_case_uidx`（`kb_id` + `case_key`） | `packages/db/src/schema/ask/gold-questions.ts:24` |
| 从包入口导出 | `packages/db/src/schema/index.ts:27` |
| 建表迁移 `0010_eval_floor` | `packages/db/drizzle/0010_eval_floor.sql:1-17` |
| 建表语句里的唯一索引 | `packages/db/drizzle/0010_eval_floor.sql:17` |

### 2.2 谁写入（全仓 insert / upsert 点）

全仓 `insert(goldQuestions)` **只有一处**：`apps/api/src/services/gold-questions.ts:104-129`（`goldQuestionRepo.create`，冲突码 `23505` → `conflict`）。全部调用方：

| 入口 | 位置 | 备注 |
|---|---|---|
| 运营 CRUD API `POST /knowledge-bases/:kbId/gold-questions` | `apps/api/src/routes/eval.ts:134-159`（`gold.create` 在 `:147-152`） | 需 `eval.run` 权限（`evalMw`，`:118`） |
| 反馈晋升 `PATCH` status=`promoted_to_gold` | `apps/api/src/routes/feedback.ts:213-258`（`gold.create` 在 `:248-257`） | 同时需 `eval.run` 权限（`:214`）；题面来自 ask trace |
| admin 运营台 | `apps/admin/src/app/(ops)/eval/services.ts:39` → `apps/admin/src/app/(ops)/eval/api.ts:22` | 走上面那条 HTTP API，非直连 DB |
| 改 / 删 | `apps/api/src/services/gold-questions.ts:131-161`（update / remove） | 非新增 |

- **`upsert` 点：全仓无**（只有 `insert` / `update` / `delete`）。
- **无 seed / migration 数据插入**：`grep gold_questions` 命中的 `.sql` 仅建表（`0010_eval_floor.sql`）；`scripts/seed-demo.mjs` 与 `scripts/` 目录内**无** `gold` 相关行。

### 2.3 是否存在「文件 → DB」的现成灌题入口

**没有。** 证据：

- 源码护栏测试明确要求「凡提到 `gold.yaml` 的源码文件，写文件 API 附近不得出现该名录」，且断言 L1 名录只有读侧入口（路径常量 + `loadGold`）—— `apps/api/tests/docs-guard/gold-review-guard.test.ts:69-102`。
- 该测试的意图描述：运营纳入落 `gold_questions` 表、**不**写 `gold.yaml` —— `apps/api/tests/docs-guard/gold-review-guard.test.ts:2-5`。
- `ingest-eval-corpus.ts` 脚本内无任何 `gold` 相关引用（grep 无命中）。
- 前图的真栈跑批是**人工**把 `fixtures/l1/gold.yaml` 的 60 题经 `POST …/gold-questions` 逐条灌进 DB 的 —— `.scratch/eval-ledger-parity/research/05-real-stack-worker-run.md:41`（该文并记录：首次 30 题因 `expectedDocIds: null` 被 schema 拒，改「省略该字段」后 60/60 入库：30 带标注 + 30 无标注）。

---

## 3. 今天的默认数据实际是否已不同

### 3.1 文件侧条目数（已核）

`fixtures/l1/gold.yaml` 共 **60** 条（`grep '"id":'` 命中 60 行）。按类型拆：

| 类型 | 条目 | 计数 |
|---|---|---|
| `answerable` | `l1-ans-001` … `l1-ans-030` | 30 |
| `unanswerable` | `l1-una-001` … `l1-una-027` | 27 |
| `false_premise` | `l1-fp-001` … `l1-fp-003` | 3 |
| 合计 | | **60** |

其中**带 `expectedDocIds` 的只有 30 条**（全部 `answerable`），另 30 条（27 una + 3 fp）无名单 → 不计 Hit@k。

### 3.2 DB 侧条目数

- **仓库默认数据 = 空**：无 seed / 迁移 / 测试夹具向 `gold_questions` 插行（§2.2、§2.3）。故「默认数据」下 DB 侧为 0，直到有人经运营/晋升入口写入。
- **本机真库当前实际行数：未核实（需真库）**。前图那一轮真跑后，某 KB 里被人工灌入过 60 行 —— `.scratch/eval-ledger-parity/research/05-real-stack-worker-run.md:41`；但这是那次跑的产物，**不是**仓库默认，且无法离线断定今天仍存在。
- 可核命令（真库在位时）：

```bash
# 逐库题量与带标注题量（库列名 snake_case）
psql "$DATABASE_URL" -c "select kb_id, count(*) as total, count(expected_doc_ids) as with_expect from gold_questions group by kb_id order by kb_id;"

# 与文件侧清单对比（需先把 gold.yaml 的 id 列成一行一条）
psql "$DATABASE_URL" -c "select case_key from gold_questions where kb_id = '<KB_ID>' order by case_key;"
```

> 结论口径：**文件侧 = 60（已核）**；**DB 侧默认 = 0（由「无 seed」推断）**，**真库现值未核实**。两侧条目数在默认仓库状态下**必然不同**（60 vs 0）；前图那一轮之所以相等（60），靠的是人工灌题，而非任何代码路径。

---

## 4. `l1QuestionIdsHash` 锚住的是哪一侧

| 事实 | 位置 |
|---|---|
| 定义 `l1QuestionIdsHash(ids)` | `packages/contracts/src/eval/l1-repro.ts:30-37` |
| 算法：逐项 `trim` → 去空 → **升序** → `JSON.stringify` → `sha256` 十六进制；规范化后为空 → `null` | `packages/contracts/src/eval/l1-repro.ts:31-36` |
| 子路径导出纪律（`node:crypto`，不进 contracts 主入口） | `packages/contracts/src/eval/l1-repro.ts:1-13` |

### 4.1 计算输入（两侧各锚自己）

- **api CLI**：`questionIdsHash: l1QuestionIdsHash(input.goldIds)` —— `apps/api/src/scripts/run-l1-golden.ts:507`；
  输入 `goldIds = all.map((c) => c.id)` —— `apps/api/src/scripts/run-l1-golden.ts:781`（`all` = `loadGold` 全量，**不**受 `L1_MAX_CASES` 截断；截断只作用于 `cases`，见 `:645`）。
  → **锚文件侧 `gold.yaml` 的 `id` 集合**。
- **worker 队列**：`questionIdsHash: l1QuestionIdsHash(opts.cases.map((c) => c.caseKey))` —— `apps/worker/src/eval/run-l1-batch.ts:292`；
  注释自陈「源 = DB `gold_questions.case_key` 全量」—— `apps/worker/src/eval/run-l1-batch.ts:285-289`（同样用全量 `opts.cases`，非 `sliced`）。
  → **锚 DB 侧 `gold_questions.case_key` 集合**。

即：**同一个哈希函数、同一个报告键 `repro.questionIdsHash`，两侧各自锚住自己那一侧的题源**。两份报告分别落库后，哈希值**不会**被任何地方互相比较。

### 4.2 在报告 / 门禁里的用途

- 只出现在报告 `repro` 区块：字段类型 `L1Repro.questionIdsHash: string | null` —— `packages/contracts/src/eval/l1-repro.ts:92-93`。
- Markdown 渲染：`['questionIdsHash', dash(repro.questionIdsHash)]` —— `apps/api/src/scripts/run-l1-golden.ts:535`。
- **不进任何判定**：`grep l1QuestionIdsHash` 全仓无门禁消费方；ADR-046 判定读的是 `coverage` / `cRate` / `hitAtK` / `judgeAuroc` / `citationComplete` / `humanSpot` —— `apps/api/src/eval/adr046-snapshot.ts:249-258`，其中**无**题集哈希。工单注释亦自陈「不进任何判定」—— `apps/api/src/scripts/run-l1-golden.ts:143-147`。
- 复用：L2 的 `l2GoldSetHash` 逐字复用同一函数 —— `packages/contracts/src/eval/l2-repro.ts:17-31`。

---

## 5. 差异信号的承载位置候选

### 5.1 报告顶层键（今天的样子）

- api `L1Report` 顶层键（含 `repro` / `docMapSource` / `docMapResolved` / `docMapUnmappedIds`）—— `apps/api/src/scripts/run-l1-golden.ts:100-166`。
- worker `L1BatchReport` 顶层键（同名同义）—— `apps/worker/src/eval/run-l1-batch.ts:89-139`。
- 承载三键的形状 `DocMapSummary` —— `packages/contracts/src/eval/corpus-ledger.ts:55-61`；汇总函数 `summarizeDocMap` —— `packages/contracts/src/eval/corpus-ledger.ts:239-261`。
- 三键的现成**先例**（顶层加键的写法）：api `run-l1-golden.ts:790-793`；worker `run-l1-batch.ts:298-299`。
- 落库：api 侧 `reportJson: report`（整对象直落）—— `apps/api/src/scripts/run-l1-golden.ts:278`；worker 侧 `reportJson` 是**逐键白名单**，已含 `repro` 与三键 —— `apps/worker/src/eval/persist.ts:119-148`（`repro` 在 `:139`）。
- `eval_runs.report_json` 列类型为 `jsonb`（**写入时不校验**）—— `packages/db/src/schema/ask/eval-runs.ts:33`。

> 含义：`questionIdsHash` 今天已经随两份报告各自落进 `report_json.repro.questionIdsHash`；缺的**不是存储位**，而是「把两侧值取出来比对」的动作（本次研究未发现任何此类比对）。

### 5.2 `signoff` / `adr046` 快照

- 快照形状 `Adr046Snapshot` 现有键：`snapshotId` / `kbId` / `evalRunId` / `evalBindId` / `retrieve_mode` / `tauClaim` / `gate_bundle` / `gates` / `fourElements` / `stricterThanPilot` / `loosenedKeys` —— `apps/api/src/eval/adr046-snapshot.ts:54-64`。
- **没有**任何「题集哈希 / 题源标识」的现成槽位（无 `questionIdsHash` / `goldSource` 类字段）。若在此承载需**新增键**。
- `EvalRunSchema`（eval_runs 的对外 DTO）同样无题集哈希键 —— `packages/contracts/src/eval/eval-run.contract.ts:32-65`。

### 5.3 若新增键：会经过的 `.strict()` 校验点与 DTO

| 校验点 / DTO | 位置 | 说明 |
|---|---|---|
| `EvalRunSchema`（`.strict()`） | `packages/contracts/src/eval/eval-run.contract.ts:32-65` | eval_runs 行对外 DTO；新增**顶层 DTO 键**须加进这里 |
| `EvalRunCaseRowSchema`（`.strict()`） | `packages/contracts/src/eval/eval-run.contract.ts:18-29` | 逐案行 DTO |
| `EvalRunListResponseSchema`（`.strict()`） | `packages/contracts/src/eval/eval-run.contract.ts:89-93` | 列表响应 |
| DTO 映射白名单 `extraStatsFromReport` | `apps/api/src/services/eval-runs.ts:99-151` | 从 `report_json` 取值上浮到 DTO 的地方；新键不上白名单就**不会**透出 |
| `toEvalRunDto` / `mapRow` | `apps/api/src/services/eval-runs.ts:224-253` / `:197-221` | DTO 组装点 |
| worker `reportJson` 白名单 | `apps/worker/src/eval/persist.ts:119-148` | worker 侧落库逐键白名单，新键须在此登记 |
| `GoldQuestionSchema`（`.strict()`） | `packages/contracts/src/eval/gold.contract.ts:7-20` | DB 题集对外 DTO |
| `CreateGoldQuestionBodySchema`（`.strict()`） | `packages/contracts/src/eval/gold.contract.ts:23-32` | 新增题面请求体 |
| `PatchGoldQuestionBodySchema`（`.strict()`） | `packages/contracts/src/eval/gold.contract.ts:35-45` | 改题请求体 |
| `GoldQuestionListResponseSchema`（`.strict()`） | `packages/contracts/src/eval/gold.contract.ts:48-52` | 题集列表响应 |
| `EvalJobDataSchema`（`.strict()`） | `packages/contracts/src/async/eval-job.ts:10-22` | api 入队 / worker 消费的 job payload |
| `InternalExecuteBodySchema`（`.strict()`） | `apps/api/src/routes/eval.ts:45-65` | worker→api 内口执行体 |

补充：`L1Repro` 是**纯 TS 类型（非 zod）** —— `packages/contracts/src/eval/l1-repro.ts:73-101`；在 `repro` 区块内加键**不**经过任何 `.strict()`，但 api / worker 两处 `buildL1Repro` / report 组装须同步（`apps/api/src/scripts/run-l1-golden.ts:508-509`、`apps/worker/src/eval/run-l1-batch.ts:290-293`），否则两侧形状分叉（现有测例 `packages/contracts/tests/eval/l1-repro.test.ts` 钉住区块键集）。

---

## 未核实项汇总

| 项 | 状态 | 可核命令 |
|---|---|---|
| 本机真库 `gold_questions` 现存的题量 / 是否与 60 条文件集一致 | **未核实（需真库）** | `psql "$DATABASE_URL" -c "select kb_id, count(*), count(expected_doc_ids) from gold_questions group by kb_id;"` |
| 真库中是否有 `expected_doc_ids` 为 null 的行（feedback 晋升产物） | **未核实（需真库）** | `psql "$DATABASE_URL" -c "select count(*) from gold_questions where expected_doc_ids is null;"` |
| 是否存在仓库外（本机脚本 / 手工）的「文件 → DB」灌题路径 | **未核实**；仓库内**确认无**（§2.3） | 手工灌题痕迹见 `.scratch/eval-ledger-parity/research/05-real-stack-worker-run.md:41` |
