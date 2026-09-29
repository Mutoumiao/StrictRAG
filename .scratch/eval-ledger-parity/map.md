# 让评测批跑的两条入口（api CLI / worker 队列）对同一数字给同一含义

Label: wayfinder:map
Status: open（前沿：工单 01）

## Destination

把**运营台发起 → worker 队列**这条**生产评测路径**，与 api CLI（`run-l1-golden.ts` / `run-l2-golden.ts`）拉到**同一份账本、同一套语义**上，让 Hit@k / docHit 在两条入口给出**同一含义**的数字。具体做到：

1. **worker 侧能拿到并解析同一份账本**：复用 `@strict-rag/contracts/eval-corpus-ledger` 与上一图落的账本文件，参数走**与 api CLI 同名同义**的 env（`L1_DOC_MAP` / `L2_DOC_MAP`），读取点在 `hitAtKCase` 之前。
2. **账本与本次 KB 或语料指纹不符 → job 失败**（等价 api CLI 的 `exit 2` 拒跑），写 `eval_runs.status=failed` + `errorMessage`；**不许**静默降级成「无账本恒 0」。
3. **未传账本 → 与今天逐位一致**：三键仍 `none` / `0` / `[]`，缺映射**继续算 miss**（绝不变成 `null`）。
4. **落库形状取报告真值**：`apps/worker/src/eval/persist.ts` 两处 `reportJson` 白名单不再硬编码 `docMapSource: 'none'` 一类常量，改从报告对象取，使 `eval_runs.report_json` 与 api CLI 侧**同形**。
5. **一条真栈实测**：经 `POST /knowledge-bases/:kbId/eval/runs` → BullMQ → worker 真跑一次**带账本**的 L1，把落库后的 `report_json.hitAtK` 实测值写进仓内证据（**带 mock 标注、不当签字数字**），并与「不带账本」那跑对照。

**为什么这是目标而非洁癖**：`eval_runs` 是 P2.5 准出「报告归档」的载体之一 —— 运营台与 `GET /knowledge-bases/:kbId/eval/runs/:runId` 都从这里读。今天这条路**必然**给出 `hitAtK = 0/30`（数据面缺映射），而 CLI 侧同一夹具同一 KB 能给出 `30/30`。**同一个数字在两处含义不同**，且生产路径恒 0：准出时若从运营台取报告，取到的是一个**结构性假零**。

**成功长什么样**：① 同一 KB、同一夹具、同一份账本，CLI 与 worker 队列两条路跑出的 `hitAtK` 是**同一含义**（要么都 `30/30`，要么都因账本不符而**双双响亮失败**）；② 不传账本时 worker 侧与今天逐位一致（反证）；③ 账本不符时 job 落 `failed` 且错误信息点名原因；④ `prds/00–11`、`fixtures/` 数据文件、任何门限数字**一个字未改**。

## Notes

- 域：StrictRAG。**WHAT** 冲突以 `prds/00–11` 为准；**IS 以源码为准**，`docs/module-status/` 是镜像，`docs/testing/coverage/` 是派生对照。
- **前图**：本图是 [`eval-corpus-map`](../eval-corpus-map/map.md) `Not yet specified` **A 段第一条**（「worker 侧批跑不接账本」）的执行图。那张图把 L1 硬门 Hit@20 从「结构性必失败」变成「可真测」，但**只接了 api CLI 一条入口**；本条是**同一契约的第二个消费方**。
- **本图立的判据线**：`hitAtK` / `docHit` 这个数字，在**两条入口**上必须是**同一含义**。上一图让 CLI 侧能算真比值，worker 侧仍恒 0 —— 这正是本图要销的账。
- **每轮先读**：本图 · `docs/agents/issue-tracker.md` · `docs/agents/domain.md` · `prds/08-quality/02-evaluation-and-gates.md` §3 / §6 · `prds/06-async/`（eval 队列）· `packages/contracts/src/eval/corpus-ledger.ts` · `packages/contracts/src/async/eval-job.ts` · `apps/worker/src/eval/{consumer,persist,run-l1-batch,run-l2-batch}.ts` · `apps/api/src/routes/eval.ts` · `apps/api/src/scripts/{run-l1-golden,run-l2-golden,ingest-eval-corpus}.ts` · `apps/api/src/eval/{corpus-map,corpus-fixtures,adr046-snapshot}.ts` · `docs/ops/{operable-stack,real-stack-evidence}.md` · `docs/module-status/{api,worker,contracts}.md`。写代码前读 `.trellis/spec/` 对应包（`api/backend/l1-eval.md` · `l2-eval.md` · worker 包 index）。
- **本图携带执行**：工单可直接改代码、补测例、回写镜像。同一缺口**禁止**再 `task.py create` 平行实现任务。
- **只在本分支（`main`）**：不建 worktree，不新建分支。
- **门禁**：每收一张工单跑 `pnpm check-types` + `pnpm lint`（零 warning）+ 相关包测试；收口跑全仓 `pnpm test --concurrency=1`（前图实测：并发抢 CPU 会让 web 包超时假红）。测例只进 `<包>/tests/<能力>/<意图>.test.ts(x)`，文件头「目标 / 需求 / 被测 / 简介」必须简体中文，并登记该包 `tests/index.md`。
- **不改仓库默认开关**：`AUTH_ENFORCE` / `DEPT_ACL_ENFORCE` / `DEPT_INHERIT_DOWN` / `RETRIEVE_ES_MODE` / `INGEST_ES_MODE` / `SESSION_REWRITE_ENABLED` / OCR 的默认值一律不动。
- **不改 `prds/00–11`**。
- **质量红线不放宽**：门禁只加严（ADR-046）；**mock 数字禁进签字包**（PRD §6.1 / ADR-061）；本图所有改动必须是**收紧或逐位等价**。
- **本图特有的「不许」**：
  - **不许**在 worker 侧另写一套账本契约或解析逻辑 —— 必须复用 `@strict-rag/contracts/eval-corpus-ledger`（`parseCorpusLedger` / `resolveExpectedDocIds` / `summarizeDocMap`）与 `apps/api/src/eval/corpus-map.ts` 的同款判定（`kbId` 全等 ∧ 语料指纹全等）。
  - **不许**把「账本不符 / 账本不可解析」降级成「无账本」：前者必须**响亮失败**（`markFailed` + `ok:false`），后者才是「与今天逐位一致」。两者混成一个出口 = 把一道新鲜的闸改常开。
  - **不许**把「缺映射 / 未映射」变成 `null`。`hitAtK == null` 的语义是 PRD 的「有标注时」，拿它当缺映射的出口等于**放宽**。
  - **不许**改任何门限数字（`PILOT_HARD_GATES` 六键一字不动），**不许**动 `computeSignoffEligible` / `computeL2SignoffEligible` / `evaluateAdr046Bind`。
  - **不许**改 `fixtures/` 的**数据文件**（两份 `README.md` 可改）。
  - **不许**做模糊 / 子串 / 前缀匹配或「按标题猜」的启发式命中 —— 只认账本里的精确 uuid。
  - **不许**为了「让运营台好看」而给 worker 侧造默认账本、造兜底映射或改 `reportJson` 的既有键语义。
- **写回纪律（前图教训）**：`docs/module-status/*.md` 正文**不写 `路径:行号`**，也不给裸标识符加反引号（会触发 `check:module-status` 的 `5-表` / `3-符号` 误报）；行号只写在 `.scratch/` 工单与 `.trellis/spec/` 里。
- **前图教训（三条必守）**：① 收口声明必须在**最后一次提交之后**复跑 `pnpm check:module-status`，且 `1-路径` / `6-联动` / `7-时效` 三类须为空（基线 **39 条 = 2 env + 13 符号 + 24 表**）；② 回写要带**对抗性反向复核**（逐条核「这话在源码里真能指到吗」）；③ 镜像/覆盖表里的加式必须**用脚本按行机械核**。
- **本机限制**：无浏览器 → admin / web 视觉改动不在本图；真模型 live 跑数 / 人签也不在。**Docker Desktop 在本机可用**（前图已验证真栈真跑），故本图第 5 条的真栈实测**在本图范围内**；注意 Docker Desktop 会自行退出（前两图共 5 次），真跑要预留重启与重跑预算，且故障那一跑**必须留痕**。

### 开工基线（2026-09-29 · 逐条核过源码）

| 处 | 今天的样子 |
|---|---|
| 生产路径的调用链 | `POST /knowledge-bases/:kbId/eval/runs`（`apps/api/src/routes/eval.ts:238`）→ `enqueue({tenantId,kbId,runId,userId,retrieveMode,runType,requestId,maxCases})`（:276-286）→ BullMQ 队列 `sr-eval` → worker `handleEvalJob`（`apps/worker/src/eval/consumer.ts:16`）→ `runL1Batch` / `runL2Batch` → `evalPersist.saveReport` / `saveL2Report` → 表 `eval_runs` |
| job payload 形状 | `EvalJobDataSchema`（`packages/contracts/src/async/eval-job.ts:11-22`）**`.strict()`**，仅 8 键：`tenantId` `kbId` `runId` `userId` `retrieveMode` `runType` `requestId?` `maxCases?` —— **无任何映射 / 账本字段** |
| worker 侧 L1 比 id 处 | `apps/worker/src/eval/run-l1-batch.ts:175` `const hit = hitAtKCase(c.expectedDocIds, evidenceDocIds);` —— `c.expectedDocIds` 是夹具**逻辑 id**，`evidenceDocIds` 是 `documents.id` uuid |
| worker 侧 L2 比 id 处 | `apps/worker/src/eval/run-l2-batch.ts:192`（正常分支）与 `:219`（error 分支，`hitAtKCase(c.expectedDocIds, [])`）—— 同款直比 |
| worker 侧账户参数 | `runL1Batch` opts（`run-l1-batch.ts:123-140`）与 `runL2Batch` opts（`run-l2-batch.ts:127-134`）**都没有**账本 / 映射参数；`consumer.ts:96-105` 的调用点也没传 |
| worker 侧落库 | `persist.saveReport`（`persist.ts:145-147`）与 `saveL2Report`（`:192-194`）的 `reportJson` 白名单里，三键是**硬编码常量** `docMapSource: 'none'` / `docMapResolved: 0` / `docMapUnmappedIds: []`（注释自陈「worker 批跑无账本解析（裁定 2 范围）」） |
| 结构性数字 | worker 路径 `hitAtKScored = 30`（L1 60 题里 30 题带 `expectedDocIds`）→ `hitAtK = 0/30 = 0`（**非 null**）→ 落库 `report_json.hitAtK = 0` → DTO `EvalRunSchema.hitAtK` 透出 → 运营台显示 0。**与检索质量无关** |
| api CLI 侧（已完成） | `run-l1-golden.ts` / `run-l2-golden.ts` 读 `L1_DOC_MAP` / `L2_DOC_MAP`（`resolveCorpusLedgerForRun`，`apps/api/src/eval/corpus-map.ts`）→ 校验 `kbId` + 语料指纹，不符 `exit 2` → `resolveExpectedDocIds` 解析后再进 `hitAtKCase`；报告顶层三键 `docMapSource` / `docMapResolved` / `docMapUnmappedIds`（**都不进判定**）。真栈实测：不带账本 `0/30`、带账本 `30/30` |
| 账本契约 | `packages/contracts/src/eval/corpus-ledger.ts`（子路径 `@strict-rag/contracts/eval-corpus-ledger`）：`CORPUS_LEDGER_VERSION = 1`、`DOC_MAP_SOURCES = ['ledger','none']`、`parseCorpusLedger`（形状 + 版本 + 指纹自洽）、`resolveExpectedDocIds`（映射 → uuid，**未映射原样保留**）、`summarizeDocMap` |
| 账本文件 | `artifacts/eval-corpus-ledger-<kbId>.json`（`artifacts/` 已 gitignore，属**运行产物**，不入库） |
| 同类先例 | worker 侧已有**进程级路径 env** 的先例：`EVAL_L2_GOLD_PATH`（`persist.ts:29-32`，缺省回落 `<repoRoot>/fixtures/l2/gold.yaml`）与 `JUDGE_CALIB_SCORER`（`consumer.ts:103`）—— 说明「worker 的评测输入走 env」是本仓既有形状 |
| 前图已裁定、本图不动 | 账本**形状**与**解析落点**（跑批 CLI 内、`hitAtKCase` 之前）；「命中期望文档」**不进** `computeL2SignoffEligible`；worker 侧批跑**不进任何判定**（判定只在 api 侧）—— 本图只把**数字含义**对齐，**不改**任何判定公式 |

### 立图后主控补充核实（2026-09-29，供工单 02 裁定）

| 事实 | 证据 |
|---|---|
| **契约子路径已就位，worker 复用无阻碍** | `packages/contracts/package.json:10` 已含 `"./eval-corpus-ledger": "./src/eval/corpus-ledger.ts"`；`apps/worker/package.json:17` 依赖 `@strict-rag/contracts: workspace:*`；且 worker **已有**子路径 import 先例（`run-l1-batch.ts:31-33` import `@strict-rag/contracts/eval-repro`） |
| **但 worker 拿不到 api 包内的两个文件** | `apps/api/src/eval/corpus-map.ts:12` 用相对路径 import `./corpus-fixtures.js`；`apps/worker/package.json` 依赖里**没有** `@strict-rag/api` → 跨 app 复用不可能。共享落点须裁定（工单 02 第 1b 组） |
| **上移的技术成本低** | `corpus-fixtures.ts` 无 api 专属依赖（只用 `node:crypto` / `node:fs` / `path` / `fileURLToPath` + `@strict-rag/contracts/eval-corpus-ledger`）；其 `defaultRepoRoot` 从 `apps/api/src/eval` 上溯 **4 层**，而 `apps/worker/src/eval` 同为 4 层 → 指向**同一个** monorepo 根（`apps/worker/src/eval/persist.ts:31` 今天用的就是同一个表达式） |
| **worker 读仓内 `fixtures/` 已有先例** | `apps/worker/src/eval/persist.ts:29-32` 的 `defaultL2GoldPath` 缺省回落 `path.join(repoRoot, 'fixtures/l2/gold.yaml')` —— 故「worker 侧需要能看到 `fixtures/`」不是本图新引入的假设 |

## Decisions so far

<!-- 每关闭一张工单追加一行：名称（链接）+ 一行要点 -->

- [02 · 裁定：worker 侧账本的来源 / 读取时机 / 失效语义 / 落库形状](./issues/02-dec-worker-ledger-source.md) — 八组裁定。① **来源 = 与 api CLI 同名的 worker 进程级 env**（`L1_DOC_MAP` / `L2_DOC_MAP`）；否掉「job payload 下发」（= 让 API 客户端指定服务器文件路径）与「按 kbId 约定发现」（放错目录会静默退化成恒 0）；「一进程一份账本」是**既有**限制（同款 `EVAL_L2_GOLD_PATH`）。② **复用落点 = 上移 `contracts` 新子路径 `./eval-corpus-ledger-file`**（`corpus-fixtures` + `corpus-map` 搬家，行为逐位不变），api 侧改为 **re-export 保路径**（那 31 条条件面测试 import 路径一个字不改）；`defaultRepoRoot` 改为**显式入参**（层数关系变了，禁沿用硬编码上溯）。③ **每次 job 重读**（路径取 env 快照、内容每次重读 → 换账本不必重启）。④ **三态互斥**：未设置 = 逐位一致；设置但不可用 = **响亮失败**（复用 `CorpusLedgerError` 原文，禁降级）；设置且自洽 = 解析。⑤ **落库三键改取报告真值**（`summarizeDocMap(…,null)` 恰等于今天的常量，测例钉住）。⑥ **L2 同办**（三处比对点全接，`docHitRate` 仍不进判定）。⑦ **「账本↔库内存在性对账」不纳入**（CLI 侧无 DB 读，单侧加会制造新的不对称）→ 转下一图。⑧ **配置键无需手工动作**：turbo 已登记且 per-task 全覆盖；`check.mjs:304-306` 会把 worker `env.ts` 字段名**自动**加进黑名单（守基线 39 条）。⑨ **DTO 透出三键纳入本图**（`EvalRunSchema` + `toEvalRunDto` 同时改，缺键 `?? 'none'` 容错；不动 admin）。
- [01 · 研究：worker 评测路径与账本接缝的现状面](./issues/01-research-worker-eval-path.md) — 正文 [`research/01-worker-eval-surface.md`](./research/01-worker-eval-surface.md)。要点：调用链 `routes/eval.ts:238` → `enqueueEval` → `sr-eval`/`golden_2x2` → `index.ts:113` → `consumer.ts:16` → 两个批跑 → `persist.ts:101/:153` → `eval_runs`；**这条链从未被端到端跑过**（api 测注入假 `enqueue`、worker 测注入内存 persist），故工单 05 是第一次真跑。worker 评测 env 仅 4 键、**无 `L1_DOC_MAP`/`L2_DOC_MAP`**，`env` 在模块加载期一次求值；既有形状支持「输入走进程级 env」，但 `retrieveMode`/`maxCases`/`runType` 是**随 job 下发**的反例。比对点共 3 处（L1 `:176`；L2 `:193`/`:219`）。落库三键硬编码于 `persist.ts:146-148`/`:190-192`，`reportJson` 是 jsonb。**新发现**：`toEvalRunDto` **不透出 `docMap*`/`repro`**（→ 工单 02 第 8 组）。复用：`corpus-ledger.ts` 纯函数可直接 import；`corpus-map.ts`/`corpus-fixtures.ts` 不能（→ 第 1b 组）。**账本可达性零障碍**：compose 无 host 挂载、api 与 worker 都在 host 跑，`repoRoot` 两侧同式同根。回归面：12 条 it（8 文件）+ 2 条语义钉子 = **14 条**最可能打红，另有 31 条条件面（若上移 `corpus-map`/`corpus-fixtures`）。未核实 8 条已转工单 02 / 05。

## Not yet specified

<!-- 收口后剩下的雾，按「谁挡谁」分组，供下一张图挑一个当目的地 -->

### A · 本图裁为「不纳入」的（承接前图 A 段第二条）

- **账本 ↔ 库内文档不做运行时对账**：账本只机械校验 `kbId` 与**夹具指纹**两项；「账本里的 docId 是否还在库里」今天由人用 `GET /knowledge-bases/:kbId/documents` 比对。worker 侧**有 DB 访问**（`persist.ts` 用 `getDb()`），所以这条在 worker 侧的实现成本比 CLI 侧低 —— 但会同时牵动两侧（CLI 侧无 DB 读），**本图先裁是否纳入**（工单 02），未纳入则原样转下一图。

### B · 承接前图 B 段（本图同样碰不到）

- **L2 的真跑与准出**（簇 7）：`docHitRate` 现在可真测，但本机没跑真 L2 批跑；L2 准出仍须 live 真跑归档 + RACI 人签，四项零容忍 5 处去处只有 1 处机械判。
- **其余五道 L1 硬门的真值**：`coverage`（需真 Gateway）· `judgeAuroc`（需 live 打分器 + ≥100 真标注校准集）· `humanSpot`（须人）· 四要素（须业务提案与人签）。
- **簇 39（dev-only 桩 Gateway 是否允许）**：仍是**产品决定**。

### C · 与前图同一批的其它口子（原样转，未动）

- 簇 **8**（`CorpusLoader` 未传 `tenantId`）· 簇 **11**（`loadVisibilityContext` 请求级缓存）· 簇 **13**（`kb_members.role` 完整性债）· 簇 **22**（`drizzle/meta` 类型/默认值级人工走查）· 簇 **24 余量**（多租户独立索引）· 簇 **31 余量**（覆盖表剩余 59 行 `部分测`）· 簇 **32**（`/prds` 与 `.trellis/tasks/` 不在版本库）· 簇 **37 余量**（真 ES 上 reindex 覆盖旧 principals）。

## Out of scope

- **真人抽检**（PRD §6「≥20 条，错 ≤1」）：抽检动作须人。
- **≥100 条真标注校准集**与 **live judge 真跑**：须真语料 + 真标注 + 真 Gateway key。
- **真模型 live 跑数 / 人签**：不代签；本图只保证「两条入口的数字含义一致」，**不**宣称 Hit@20 达标。
- **改 `prds/00–11` 已冻语义**（含任何门限数字）：须 ADR → 改 PRD → 升版。
- **改仓库默认开关**。
- **admin / web 的视觉与交互改动**：本机无浏览器验证手段。
- **B8 真 ES+IK / 多租户独立索引 / B9 真 RustFS / QUAL-2 真杀毒**：前图已裁，不在本图。
- **P2.5 准出 / 永久关二元出口 / P3a Full 图**：须 L2 归档 + 人签。
