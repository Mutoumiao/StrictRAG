# 01a · 库内对账可达性研究（只读）

> 角色：库内对账可达性研究（工单 01 的一个切面）。**只读**，未改任何源码 / 测试 / 文档。
> 问题面：今天跑批前的账本校验只查 `kbId` ∧ `corpusFingerprint`，**不查**账本 `docId` 是否还在库里；本问评估「加一层库内对账」的可达性与代价。
> 结论一律附 `路径:行号` 证据；查不到的写「未核实」并说明原因。**不下裁定**，只给事实面与代价。
> 路径均相对仓库根 `D:\projects\ai-stared-project\StrictRAG`。

---

## 一、两侧现成的 `documents` 读取入口

### 1.1 `apps/api` 侧

| 入口 | 位置 | 函数名 | 按 `tenantId` 收窄 | 按 `kbId` 收窄 | 按 `id` 批量查 | 返回内容 |
|------|------|--------|-------------------|---------------|--------------|----------|
| API 仓储 | `apps/api/src/services/documents.ts:118-120` | `documentRepo.listDocsByKb(kbId)` | **否** | 是（`eq(documents.kbId, kbId)`） | **否**（全列） | 整行（含 `title` / `status` / `lifecycle`） |
| API 仓储 | `apps/api/src/services/documents.ts:121-124` | `documentRepo.getDoc(docId)` | **否** | **否** | 否（单条 `.limit(1)`） | 单行 / `null` |
| 检索语料装载 | `apps/api/src/services/retrieve/corpus.ts:57-62` | `loadCorpusFromDb` | **否** | 是（`eq(documents.kbId, kbId)`） | **否**（全列再过滤） | 映射成 `CorpusChunk`（含 `docId` / `title` / `text` 等，`retrieve/corpus.ts:112-123`） |
| HTTP 列表（人工对账面） | `apps/api/src/routes/documents/index.ts:145-172` | `GET /api/v1/knowledge-bases/:kbId/documents` | **否**（`tenantId` 取自 `rows[0].tenantId` 作可见性主体，`index.ts:164`） | 是（经 `listDocsByKb`） | 否 | `toListItem`（`id` / `title` / 状态… `routes/documents/mappers.ts:42-64`） |

补充事实：

- **仓内不存在**任何 `inArray(documents.id, …)` 形式的按 id 批量查（全仓 grep `inArray(documents.id` 无命中；现有 `inArray` 仅用于 `chunks.id` / `chunks.docId` / `chunkEmbeddings.chunkId` / `platformRoles.id` / `evalRuns.signoffEligible`，见 `apps/worker/src/ingest/pipeline.ts:796`、`:925`、`apps/api/src/services/retrieve/corpus.ts:86`、`:100`、`apps/api/src/services/platform-users-roles.ts:674`、`apps/api/src/services/eval-runs.ts:348`）。
- `getDoc(docId)` 只按主键查，**既不叠 `tenantId` 也不叠 `kbId`**（`apps/api/src/services/documents.ts:121-124`）。
- HTTP 列表会再过一道可见性闸 `filterVisibleDocs`（`apps/api/src/routes/documents/index.ts:168-171`）—— 若某文档被部门 / ACL 判可见性不足，**不会**出现在该列表里，故「用该列表逐条对账」可能漏掉账本点名的文档（`apps/api/src/routes/documents/index.ts:170-171`）。
- api 侧已有进程内 DB 句柄：`apps/api/src/services/db.ts:11` `getDb()`；`run-l1-golden.ts:72` 与 `run-l2-golden.ts:56` 均已 `import { getDb }`。

### 1.2 `apps/worker` 侧

| 入口 | 位置 | 函数名 | 按 `tenantId` 收窄 | 按 `kbId` 收窄 | 按 `id` 批量查 |
|------|------|--------|-------------------|---------------|--------------|
| **评测持久层（loadGold 附近）** | `apps/worker/src/eval/persist.ts:41-46` | `evalPersist.loadGold(kbId)` | 否 | 是（`eq(goldQuestions.kbId, kbId)`）——**查的是 `gold_questions` 表，不是 `documents`** | 否 |
| 入库管线 | `apps/worker/src/ingest/pipeline.ts:131-135` | `getDoc(docId)`（模块内私有） | 否 | 否 | 否（单条 `.limit(1)`） |
| 跨文档去重 | `apps/worker/src/ingest/cross-doc-dedupe.ts:87-100` | `loadCrossDocSearchableChunks(db, { kbId, excludeDocId })` | 否 | 是（`eq(documents.kbId, kbId)`） | 否（全列） |
| 孤儿清理 | `apps/worker/src/ingest/orphan-clean.ts:113-115` | `defaultOrphanCleanDeps(db).loadDoc(docId)` | 否（返回行里带 `tenantId`，`:119`） | 否 | 否（单条 `.limit(1)`） |

补充事实：

- worker **评测批跑路径（`apps/worker/src/eval/*`）当前完全不读 `documents`**：`persist.ts` 只 `select ... from goldQuestions`（`:43-46`）与 `update evalRuns`（`:87-90`、`:93-100`、`:103-150`）；`run-l1-batch.ts` / `run-l2-batch.ts` 只读账本文件与夹具，无 DB 读。
- worker 已有进程内 DB 句柄：`apps/worker/src/db.ts:11` `getDb()`（`statementTimeoutMs: 0`）；`artifacts` 见 `persist.ts:10` `import { getDb } from '../db.js'`。
- 与 api 对称：worker 也是「按 kbId 全列」或「按 id 单条」，**无按 id 批量查**。

---

## 二、账本 `title` 的产生与库内 `documents.title` 的可比性

### 2.1 账本 `title` 的来源

- 夹具侧派生：`title: path.basename(name, '.txt')` —— `packages/contracts/src/eval/corpus-ledger-file.ts:77`（`readFixtureCorpus` 内，`logicalId` 同一循环里由 `deriveLogicalId` 派生，`:74` / `:45-47`）。
- 入库 CLI 把同一 `file.title` 传给 `upload-url`：`apps/api/src/scripts/ingest-eval-corpus.ts:378`（客户端 body 组装于 `:281`）；同一 `file.title` 也写进账本条目：`apps/api/src/scripts/ingest-eval-corpus.ts:146`。
- 因此账本 `title` = 夹具文件名去 `.txt`（如 `01-doc`）。

### 2.2 库内 `documents.title` 的来源

- 列定义：`title: text('title').notNull()` —— `packages/db/src/schema/kb/documents.ts:13`。
- 写入点（insert）：`apps/api/src/routes/documents/index.ts:206` `title: parsed.data.title`，落到 `documentRepo.insertUploadedDoc` 的 `title: input.title`（`apps/api/src/services/documents.ts:140`）。
- 入参 schema：`UploadUrlBodySchema.title = z.string().min(1).max(500)` —— `packages/contracts/src/ingest/document.contract.ts:48-49`。**注意：该 schema 无 `.trim()`**。
- 另一写入口 `write`：`const title = parsed.data.title.trim()` —— `apps/api/src/routes/documents/index.ts:293`（会 trim；但该路径用于 `source_type='write'`，非评测入库路径）。

### 2.3 可比性判断（只给事实）

- **在 `ingest-eval-corpus` 这一条路径上，库内 `title` 与账本 `title` 是同一字符串逐字透传**（夹具 `path.basename` → `file.title` → HTTP body `title` → insert `title`），中间无 trim / 归一；故对该路径，**全等（`===`）比较是良定义的**。证据链：`corpus-ledger-file.ts:77` → `ingest-eval-corpus.ts:378` / `:281` → `routes/documents/index.ts:206` → `services/documents.ts:140`。
- **但这不是契约保证的「同形」**：`upload-url` 接受任意客户端 `title`（`document.contract.ts:48-49`，无 trim），`write` 路径则 trim（`routes/documents/index.ts:293`）；库内也无任何约束把 `title` 绑定到源文件名。故**只有「本 CLI 入库」这一路径**上二者才可全等比较；换其他入口入库的文档，`title` 是调用方自由串，**不等价于「同形可比」**。
- 库里**没有** `sourceFile` 列（`packages/db/src/schema/kb/documents.ts:1-67` 全列核过：无 `sourceFile` / `source_file`）；账本的 `sourceFile`（`corpus-ledger-file.ts:76`）在库内**无对应列可直接比对**。
- 库里**有** `checksum_sha256` 列（`packages/db/src/schema/kb/documents.ts:27`），其值 = 上传对象字节的 sha256（`apps/api/src/services/ingest-complete-pending.ts:214`，落库于 `:308`）。账本 `sourceSha256` = 夹具文件字节的 sha256（`corpus-ledger-file.ts:76`）。两者口径同为「文件字节 sha256」，对 CLI 路径**理论上逐位相等**（CLI 上传的即 `readFileSync` 的同一份字节，`ingest-eval-corpus.ts:372` / `:381`）。**未核实**：真库中二者是否确实相等（需真栈跑一次比对，本只读研究不建库）。

---

## 三、「docId 不存在」与「docId 存在但 title / sourceFile 漂移」各意味着什么

### 3.1 `docId` 不存在

- 今天的消费方式：账本条目只被 `resolveExpectedDocIds` 用来把逻辑 id 换成 uuid（命中换 uuid、未命中原样保留），见 `packages/contracts/src/eval/corpus-ledger.ts:216-230`；跑批侧在 `hitAtKCase` 之前调用（api `run-l1-golden.ts:705-709`、worker `run-l1-batch.ts:211-214`、api L2 `run-l2-golden.ts:371-374` / `:474`、worker L2 `run-l2-batch.ts:172-176` / `:230`）。
- 若 `docId` 已不在库：账本仍会把它换成该 uuid，`hitAtKCase` 拿它去与本次 KB 的 `evidence.docId` 比对，必然不中 → **结构性假 miss**（Hit@k 恒 0 那类结果），且**无任何信号**提示「是映射坏了」。这正是地图所指「数字看起来正常本身就是坑」（`.scratch/eval-input-baseline/map.md:21`）。
- 能造成 `docId` 不存在的操作（仓内可达性）：
  - **重新入库**（对同一 KB 重跑 `ingest-eval-corpus`）会为新文档生成新 uuid v7（`apps/api/src/routes/documents/index.ts:200` `const docId = uuidv7()`），旧账本 `docId` 随即失效；旧行仍在库但指向不同 id（旧行是否被复用取决于是否传 `INGEST_KB_ID` 复用 KB，`ingest-eval-corpus.ts:96-101`）。
  - **DB 重置 / 换库**：账本按 `kbId` 分辨，但若旧 KB 行连同文档一起被清、再用同名 KB 重建，`kbId` 可能变化 → 由 `kbId` 全等校验拦住（`corpus-ledger-file.ts:139-143`）；若 `kbId` 恰好相同，则进入「docId 不存在」。
  - **硬删文档行**：全仓 grep `delete(documents` **无命中**；purge 路径只把 `lifecycle` 置 `archived`、行保留（`apps/worker/src/ingest/purge.ts:25-34`，`pipeline.ts:1039` 注释「pg row archived」）。故**仓内不存在删除 `documents` 行的路径**；手工 `DELETE` / 迁移清库是否会造成「docId 不存在」——**未核实**（需真库）。

### 3.2 `docId` 存在但 `title` 漂移

- **仓内无任何路径在 insert 之后改 `documents.title`**：`documentRepo` 的更新方法（`apps/api/src/services/documents.ts:121-281`）逐条核过，`patchObjectKey` / `markCompletePending` / `approve` / `reject` / `setLifecycle` / `archiveForPurge` / `supersedePair` / `setChunkStrategy` / `patchMeta` **均不写 `title`**；路由层也无「改名」端点（`routes/documents/index.ts` 内 `title` 仅出现在 `upload-url` 与 `write` 两处 insert/校验）。
- 故在本仓操作范围内，`title` 漂移**基本不可发生**（要发生需手工改库或未来新增改名功能）。一旦发生，它**不改变 Hit@k 数值**（计分只用 `docId`，见 `corpus-ledger.ts:216-230` 与 `hitAtKCase` 调用点），只说明「账本登记的人工对账线索（`title`）与库内现状不一致」。

### 3.3 `sourceFile` 漂移

- 库内**无 `sourceFile` 列**（见 §2.3），故 `sourceFile` 漂移**根本无法在库内比对**——它只能与仓库侧夹具路径比。
- 而 `sourceFile` 与 `logicalId` 同源派生（目录 + 文件名，`corpus-ledger-file.ts:30-32` / `:45-47` / `:76`），改名会同时改 `logicalId` → 与「当前夹具重算指纹」不符 → 在 `resolveCorpusLedgerForRun` 的指纹档被拒跑（`corpus-ledger-file.ts:144-149`）。故「`sourceFile` 漂移但指纹仍过」在本仓操作下**不可构造**（要靠手工改账本 JSON 且保持指纹自洽，而 `parseCorpusLedger` 校验指纹自洽，`corpus-ledger.ts:192-194`）。

---

## 四、回归面量化：「两侧入口都加对账」会打红的既有测例

前提读法：**在对账被做成「账本路径上的强制步骤」（即传了 `docMapPath` 就必须能查到库内行）** 时，凡是「传 `docMapPath` 且期望跑成功」的测例都会因测试环境无真库（或查不到这些假 uuid）而红；而「期望在读账本阶段就抛错」的负向测例（`kbId` / 指纹 / 缺文件 / 非 JSON / 形状非法）在 DB 读之前就抛，**不受影响**。

会打红的测例（**共 15 个 `it`，跨 5 个文件**）：

| 文件 | `it` 名称 | 行号 | 打红原因 |
|------|-----------|------|----------|
| `apps/api/tests/eval/l1-doc-map.test.ts` | `runL1Golden · 传账本` → `全命中：逻辑 id → uuid，hitAtK=1；三键如实标注` | `:155` | 传 `docMapPath`（`:158`），账本里的假 uuid（`DOC_01`/`DOC_02`，`:34-35`）库里没有 → 拒跑 |
| 同上 | `runL1Golden · 传账本` → `缺映射 id 原样保留继续算 miss（绝不 null）；resolved 去重、unmapped 字典序` | `:171` | 同上（传账本 `:190`） |
| 同上 | `formatReportMd · 映射来源渲染` → `不传账本 / 传账本两种 md 都能读出映射来源` | `:220` | 后半段传账本（`:227`）→ 拒跑 |
| 同上 | `formatReportMd · 映射来源渲染` → `报告 json 落三键（写文件可回读）` | `:234` | 传账本（`:236`）→ 拒跑 |
| 同上 | `formatReportMd · 映射来源渲染` → `映射 uuid 不冒充「逻辑 id 就是 uuid」：解析结果形如 uuid` | `:245` | 传账本（`:247`）→ 拒跑 |
| `apps/api/tests/eval/l2-doc-map.test.ts` | `runL2Golden · docMap（同构三键）` → `传账本 → 解析成 uuid；命中真值；unmapped 字典序` | `:154` | 传账本（`:161`）→ 拒跑 |
| 同上 | `runL2Golden · docMap（同构三键）` → `md 渲染映射来源行` | `:187` | 传账本（`:194`）→ 拒跑 |
| 同上 | `runL2Golden · 三键不进判定` → `真实 gold + live 桩：传 / 不传账本，signoffEligible 逐位相同` | `:203` | `with_` 传账本（`:219`）→ 拒跑 |
| `apps/worker/tests/eval/run-l1-batch-doc-map.test.ts` | `runL1Batch · 传自洽账本` → `逻辑 id 被解析为 uuid → 命中数变真；三键如实标注` | `:90` | 传账本（`:92`）→ 拒跑 |
| 同上 | `runL1Batch · 传自洽账本` → `缺映射逻辑 id 原样保留继续算 miss（绝不 null）；resolved 去重、unmapped 字典序` | `:103` | 传账本（`:116`）→ 拒跑 |
| `apps/worker/tests/eval/run-l2-batch-doc-map.test.ts` | `runL2Batch · docMap（同构三键）` → `传账本 → 解析成 uuid；命中真值；unmapped 字典序` | `:106` | 传账本（`:113`）→ 拒跑 |
| 同上 | `runL2Batch · error 分支也受解析影响` → `executeTurn 抛错 → 该题 verdict=error 且 docHit 仍按解析后的名单计分` | `:182` | 传账本（`:191`）→ 拒跑 |
| 同上 | `runL2Batch · 三键不进判定` → `live + 九类齐 + ≥15：传 / 不传账本 signoffEligible 逐位相同` | `:213` | `with_` 传账本（`:233`）→ 拒跑 |
| `apps/worker/tests/eval/persist-doc-map-keys.test.ts` | `persist · 映射来源三键白名单（取自报告真值）` → `saveReport（L1）带账本 → reportJson 三键 = 报告真值（ledger / 非 0 / unmapped）` | `:96` | 传账本（`:110`）→ 拒跑；且本文件 `vi.mock` 的 `getDb` 只有 `update`、无 `select`（`:20-31`），对账查询会撞 mock 抛错 |
| 同上 | `persist · 映射来源三键白名单（取自报告真值）` → `saveL2Report（L2）带账本 → reportJson 三键 = 报告真值` | `:139` | 同上（传账本 `:164`） |

**不受影响（读账本阶段即抛，DB 读之前）**：

- `apps/api/tests/eval/l1-doc-map.test.ts`：`:133`（不传账本）、`:198`（kbId 不符）、`:204`（指纹不符）、`:211`（文件不存在）。
- `apps/api/tests/eval/l2-doc-map.test.ts`：`:138`（不传账本）、`:173`（kbId 不符）。
- `apps/worker/tests/eval/run-l1-batch-doc-map.test.ts`：`:76`（不传账本）、`:127`、`:132`、`:138`、`:145`、`:152`（账本不可用五例）。
- `apps/worker/tests/eval/run-l2-batch-doc-map.test.ts`：`:92`（不传账本）、`:126`、`:140`、`:154`（账本不可用三例）、`:200`（源码形状守卫）。
- `apps/worker/tests/eval/consumer-doc-map.test.ts`：`:88`、`:102`（env 指向不存在的账本 → 在读文件阶段抛 `cannot read corpus ledger`，早于 DB 读）。
- `packages/contracts/tests/eval/corpus-ledger.test.ts`：纯函数 17 个 `it`（`:47-207`），无 DB / 无账本文件 I/O，不受影响。

**另一种读法（对账无条件、与是否传账本无关）的代价**：若对账被做成「每次跑批都查库」，则所有调用跑批入口的成功用例都会红 —— 例如 `apps/api/tests/eval/l1-cli.test.ts`（`:212`、`:332`、`:393`、`:420`、`:461`、`:486`、`:505`、`:521`、`:541`、`:562`、`:597`、`:610` 等十余处 `runL1Golden`）、`apps/api/tests/eval/l1-repro-fields.test.ts:119`、`l1-citation-complete.test.ts:93`、`:126`、`l1-human-spot-cli.test.ts:250` 等、`apps/worker/tests/eval/run-l1-batch.test.ts`（`:14`、`:34`、`:50`、`:75`、`:96`、`:116`、`:129`）、`run-l2-batch.test.ts`（`:35`、`:51`、`:72`）等。**代价量级显著更大**，故「可选入参」读法（第五节）的回归面 = 上表 15 个 `it`，且可按需只改这 5 个文件。

---

## 五、若做成「可选入参」，两侧接入点与入参类型

### 5.1 共享层唯一接缝

- `packages/contracts/src/eval/corpus-ledger-file.ts:135` `resolveCorpusLedgerForRun(input: { ledgerPath; kbId; repoRoot })` —— 今天只校验 `kbId`（`:139-143`）与指纹（`:144-149`）。**这里是两侧共用、唯一不改语义就能加一层对账的接缝**（api / worker 都经它，`apps/api/src/eval/corpus-map.ts:14` 为 re-export）。
- 该文件及 `corpus-ledger.ts` **只 import node 内置**（`corpus-ledger-file.ts:20-24`；`corpus-ledger.ts:19`），**未 import `@strict-rag/db`**。故入参类型**不宜是 DB 句柄**（会把它拉进 contracts 依赖面），天然形状是**注入一个查询函数**，例如 `(docIds: readonly string[]) => Promise<Array<{ docId: string; title?: string }>>`；**不传该入参 = 与今天逐位一致**（第二层「可选」）。
- 「可选」还可放在更外层：`RunL1Options.docMapPath` / `RunL2Options.docMapPath` / worker `runL1Batch.docMapPath` / `runL2Batch.docMapPath` 旁再加一个可选 `reconcile?`；缺省 → 不变。

### 5.2 四个接入点（行号）

| 侧 / 入口 | `docMapPath` 类型声明 | `resolveCorpusLedgerForRun` 调用点 | 该处可用 DB 句柄？ |
|-----------|----------------------|-----------------------------------|-------------------|
| api L1 `apps/api/src/scripts/run-l1-golden.ts` | `:210` | `:649-653` | 是：`import { getDb } from '../services/db.js'`（`:72`，`persistEvalRun` 已用，`:289`） |
| api L2 `apps/api/src/scripts/run-l2-golden.ts` | `:185` | `:361-366` | 是：`import { getDb } from '../services/db.js'`（`:56`，`persistL2EvalRun` 已用，`:250`） |
| worker L1 `apps/worker/src/eval/run-l1-batch.ts` | `:163` | `:173-179` | **否（需新增 import）**：本文件未 import `getDb`；可用 `apps/worker/src/db.ts:11` |
| worker L2 `apps/worker/src/eval/run-l2-batch.ts` | `:158` | `:165-171` | **否（需新增 import）**：本文件未 import `getDb`；可用 `apps/worker/src/db.ts:11` |

### 5.3 调用链上游（谁把 `docMapPath` 传进来，决定新入参的传递路径）

- worker：`apps/worker/src/eval/consumer.ts:67`（L2）与 `:116`（L1）经 `docMapPathOf(env.L1_DOC_MAP / env.L2_DOC_MAP)` 传路径（`consumer.ts:19-21`）。若加对账，`consumer` 是天然注入点；`evalPersist` 已持 `getDb`（`apps/worker/src/eval/persist.ts:10`、`:41`），可把查询函数一并注入 `handleEvalJob`（`consumer.ts:10-12` 的 `EvalConsumerDeps`）。
- api：CLI `main()` 读 `process.env.L1_DOC_MAP`（`run-l1-golden.ts:868`）与 `L2_DOC_MAP`（`run-l2-golden.ts:584`），再传进 `runL1Golden`（`:889`）/ `runL2Golden`（`:592`）。api 侧 `getDb()` 可直接在 `main()` 或 `runL1Golden` 内科用（`:72`）。
- **入参形状建议的两种候选（只陈事实面，不代裁）**：
  1. 注入查询函数 `(docIds) => rows`：contracts 层零新依赖，两侧各传自己的实现（api / worker 都写一遍 3~5 行 `select`）。**推荐面：不破 contracts 的 node-only 纪律**（`corpus-ledger-file.ts:6-14` 注释即为此纪律）。
  2. 注入 DB 句柄 `Db`：与 contracts 现有 import 纪律冲突（会引入 `@strict-rag/db` 到子路径），代价更大。
- 与「未知数」：若采用「按 id 批量查」，需**新写**一条 `select ... from documents where id in (…)`（今天全仓无此查询，见 §1）；若采用「按 kbId 全列再比对」，可复用现成 `listDocsByKb`（`apps/api/src/services/documents.ts:118-120`）或 worker `loadCrossDocSearchableChunks`（`cross-doc-dedupe.ts:87-100`，但返回列不含 `title`，需扩列或另写）。

---

## 未核实项汇总

- 真库中 `documents.checksum_sha256` 与账本 `sourceSha256` 是否逐位相等（理论同口径，需真栈跑一次比对；本只读研究不建库）。
- 手工 `DELETE` / 迁移清库 / 换库脚本是否会造成「账本 `docId` 在库内不存在」（仓内无软删外路径，但库外操作不可枚举）。
- 其它入口（`write`、admin 上传）入库的文档其 `title` 与夹具 `title` 的关系（非评测路径，未逐跑）。
- 「对账」在真栈上的实际查询代价（本问只给静态可达性，未做基准 / 未连库）。
