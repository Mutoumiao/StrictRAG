# 裁定：worker 侧账本的来源 / 读取时机 / 失效语义 / 落库形状

Label: wayfinder:dec
Type: decide
Status: resolved
Blocked by: 01

## Question

在工单 01 的事实面上，把下列各组**逐组裁定**并写下理由与被否掉的备选。裁定必须**收紧或不改变**语义，改仓库默认开关、改门限、把缺失映射写成 `null` 都不在可选集内。

1. **账本从哪来**（本图核心裁定）。至少比较三条：
   - **(a) 与 api CLI 同名的 worker 进程级 env**（`L1_DOC_MAP` / `L2_DOC_MAP`）；
   - **(b) job payload 下发**（`EvalJobDataSchema` 加可选字段 → 连带 `CreateEvalRunBodySchema` + 入队侧 + 可能的运营台表单）；
   - **(c) 按 `kbId` 约定发现**（如 `EVAL_LEDGER_DIR` + `eval-corpus-ledger-<kbId>.json`）。

   逐条给出：**爆炸面**（要改哪些文件、哪些契约、哪些前端）、**表达力**（一个 worker 进程同时服务多 KB 时是否够用）、**与本仓既有形状的一致性**（工单 01 第 2 项的结论）、**失效可见性**（人对不上时能否一眼看出）。裁定要指名**选哪条、为何否掉其余**，并写明「一个 worker 进程同时服务多 KB 的账本」这一限制**是新增的还是既有的**（若既有，举出同款先例）。

   **1b · 复用的落点**（立图后主控新发现，必须一并裁定）：`apps/api/src/eval/corpus-map.ts` 与 `corpus-fixtures.ts` 都在 **api 包内**，且 `corpus-map.ts` 用**相对路径** import `./corpus-fixtures.js`；而 `apps/worker/package.json` 的依赖只有 `@strict-rag/contracts` 与 `@strict-rag/db`，**没有** `@strict-rag/api`。因此 worker **无法**直接 import 这两个文件。裁定必须给出**共享落点**（上移到 `packages/contracts` 的现有/新子路径？新建共享包？worker 侧写薄封装？），并说明：① 为何该落点不构成工单 03 禁止的「另写一套」（判据是「同一个实现」还是「同语义的两份实现」，须写死）；② 落点里读 `fixtures/` 目录这件事放在契约包是否可接受（注意 `corpus-ledger.ts` 已有「用 `node:crypto` + 子路径隔离」的先例，而 `apps/worker/src/eval/persist.ts` 的 `defaultL2GoldPath` 已有「worker 读仓内 `fixtures/`」的先例）；③ api 侧现有 import 路径怎么处理才**不扩大回归面**（re-export 保路径 vs 直接改 import，两案的回归面分别多大）。
2. **读取时机与作用域**：在 `handleEvalJob` 开始处读一次（每次 job 重读，账本被换即生效）还是进程启动时读一次。若选「每次 job 重读」要写明 I/O 成本与失败传播路径。
3. **失效语义**（本图红线所在）。三态必须**互相可分辨**：
   - **未设置** → 与今天逐位一致（三键 `none` / `0` / `[]`，缺映射继续算 miss）；
   - **设置了但不可解析 / `kbId` 不符 / 语料指纹不符** → **响亮失败**（`markFailed` + `ok:false` + 错误信息点名原因），**不得**降级成「未设置」；
   - **设置且自洽** → 解析后再进 `hitAtKCase`。

   写明错误信息的**措辞约定**（与 api CLI 的 `exit 2` 消息是否共用一套文案）以及 job 失败是否消耗重试（核对 `EVAL_JOB_DEFAULT_ATTEMPTS`）。
4. **落库形状**：`persist.saveReport` / `saveL2Report` 的三键是否改为**取报告真值**（`report.docMapSource` 等）。若改，写明「未设置账本时报告里的真值恰好等于今天的常量」这一等价性由什么保证；`eval_runs.report_json` 与 api CLI 侧（`buildEvalRunInsert` 整对象直落）的形状是否就此同构。
5. **L2 是否同办**：`runL2Batch` + `L2_DOC_MAP` 是否与 L1 同一图形处理（含 error 分支那处 `hitAtKCase(c.expectedDocIds, [])`）。写明 L2 侧 `docHitRate` **仍不进任何判定**这一点在本图是否改变（预期：不改变，本图只对齐含义）。
6. **「账本 ↔ 库内文档存在性对账」是否纳入本图**（承接前图 A 段第二条）。若纳入，写明两侧（CLI 无 DB 读 / worker 有 DB 读）怎么统一、爆炸面多大；若不纳入，写明理由与被转给下一图的确切范围。**本组必须给出明确裁定**，不许留空。
7. **配置键的连带**：若新增 env，是否需要登记 `turbo.json` 的 env 段；若该键要进 `docs/module-status` 正文，是否需要同步加进 `scripts/module-status/check.mjs` 的黑名单以守住基线 **39 条**（前图先例）。
8. **报告 DTO 是否同步透出映射来源**（工单 01 第 4 组新发现，必须一并裁定）：`toEvalRunDto`（`apps/api/src/services/eval-runs.ts`）经 `extraStatsFromReport` + `casesFromReport` 只挑白名单键，**不透出 `docMap*` 与 `repro`**。问题：本图只做落库（`eval_runs.report_json`）够不够，还是必须让 `GET …/eval/runs/:runId` 也透出 `docMapSource` / `docMapResolved` / `docMapUnmappedIds`（否则「运营台看到 `hitAtK=1` 但看不出这跑有没有用账本」这一层含义仍是模糊的）。裁定要写明：**纳入或转下一图**、纳入的话爆炸面（DTO schema + 映射函数 + 是否会连带 admin 展示）、以及 `.strict()` 的列表路径（`routes/eval.ts:219`）会不会因新增键被拒。

产物：本工单的 `## Answer`（逐组裁定 + 理由 + 被否备选），必要时附 `research/02-dec-notes.md`。**只写裁定，不改代码。**

## Answer

**已解**。八组裁定如下（第 1b / 8 两组是工单 01 带回来的新裁定项）。

### 1 · 账本从哪来 → **(a) 与 api CLI 同名的 worker 进程级 env**

| 案 | 爆炸面 | 表达力 | 与既有形状 | 失效可见性 | 裁决 |
|---|---|---|---|---|---|
| (a) 进程级 env | **最小**：worker env 加 2 键 + 两条批跑入参 | 一进程一份账本 | **一致**（`persist.ts:29-32` 的 `EVAL_L2_GOLD_PATH`、`consumer.ts:103` 的 `JUDGE_CALIB_SCORER` 都是进程级） | **高**：设了就校验，不符立即失败 | **选** |
| (b) job payload 下发 | 大：`EvalJobDataSchema`（`.strict()`，`:11-22`）+ `CreateEvalRunBodySchema` + `routes/eval.ts:276` 入队侧 +「谁提供路径」 | 每 job 一份 | 有反例（`retrieveMode`/`maxCases`/`runType` 随 job 下发） | 高 | **否** |
| (c) 按 kbId 约定发现 | 中：worker 加目录 env + 命名约定 | 每 KB 一份 | 新增「隐式发现」 | **低**：账本放错目录 = 静默退化成「无账本恒 0」，正是本图要消灭的失败模式 | **否** |

- **否 (b) 的核心理由**：它要求 API 客户端指定**服务器文件路径** —— 这是把「本地文件读取」暴露给调用方，本仓无此先例，运营台前端也不该知道 worker 的文件布局。
- **否 (c) 的核心理由**：约定式发现让「跑哪份账本」取决于文件系统里恰好有什么，与本图「失效必须响亮」的判据相反。
- **选 (a) 的核心理由**：**一个概念一个名** —— worker 与 api CLI 读**同名的** `L1_DOC_MAP` / `L2_DOC_MAP`，这正是本图目的地（两处同含义）在配置面最直接的体现。
- 「一个 worker 进程同时服务多 KB 的账本」这一限制**是既有的**（同款 `EVAL_L2_GOLD_PATH` 同样是进程级单文件），**不是本图新增**。

### 1b · 复用的落点 → **上移到 `packages/contracts` 的新子路径，api 侧改为 re-export 保路径**

事实（工单 01）：`corpus-ledger.ts` 是纯函数、worker 可直接 import；`corpus-map.ts` + `corpus-fixtures.ts` 带 api 专属依赖（相对 import + 硬编码 `repoRoot`），worker 不能 import。

- **落点**：新增 `packages/contracts/src/eval/corpus-ledger-file.ts`（内容 = `corpus-fixtures.ts` + `corpus-map.ts` 的**搬家**，行为逐位不变），在 `packages/contracts/package.json` 的 `exports` 加 `"./eval-corpus-ledger-file"`。
- **为何不构成「另写一套」**：判据 = **同一个实现**。搬家后 api 与 worker **import 同一份模块**，不存在第二份代码；与上一图把账本形状/指纹算法放进 contracts 是同一手法。
- **读 `fixtures/` 进契约包可接受**：① contracts 已有「node 内建 + 子路径隔离」先例（`corpus-ledger.ts` 用 `node:crypto`）；② 子路径是**显式隔离手段**，worker 只 import 需要的那一个；③ `persist.ts:29-32` 已确立「worker 读仓内 `fixtures/`」为既有形状。为守住「契约 = 纯形状/算法」的直觉，文件 I/O 放**独立子路径**，不塞进 `corpus-ledger.ts`。
- **api 侧 import 路径**：`apps/api/src/eval/corpus-map.ts` 与 `corpus-fixtures.ts` 改为**从 contracts 子路径 re-export**，保留全部既有导出名（`CorpusLedgerError` / `resolveCorpusLedgerForRun` / `readFixtureCorpus` / `defaultRepoRoot` / `FIXTURE_CORPUS_DIRS`…）。这样 api 侧那 **31 条条件面**测试的 import 路径**一个字不改** → 回归面最小。**不许**直接删文件改全部 import 点。
- **`defaultRepoRoot` 必须改成显式入参**：搬进 contracts 后它距 monorepo 根的层数关系变了，**不许**沿用硬编码 `'../../../..'`；两条调用方各自传入自己的 `repoRoot`（两侧算出来是同一个仓库根）。

### 2 · 读取时机 → **每次 job 重读**（`handleEvalJob` 开头）

- 账本是**运行产物**（`artifacts/` 已 gitignore），会在跑批之间重新生成。进程启动读一次会让「重新生成账本后必须先重启 worker」成为隐式要求 —— 最易踩的坑。
- 成本可忽略：一个 JSON + 15 个语料文件的 sha256，相对一次批跑（数十秒至数分钟）是噪声。
- **区分**：worker 的 `env` 是**模块加载期快照**（`env.ts:160`），故**路径**取自 env 快照、**文件内容**每次 job 重读 →「换账本不必重启、换路径才要重启」。这句要写进 spec 与镜像。

### 3 · 失效语义 → **三态互斥**

| 态 | 触发 | 行为 |
|---|---|---|
| 未设置 | env 为空 / 纯空白 | 与今天**逐位一致**：三键 `none` / `0` / `[]`，缺映射继续算 miss |
| 设置但不可用 | 文件缺失 / 非 JSON / 形状违约 / `kbId` 不符 / 语料指纹不符 | **响亮失败**：catch `CorpusLedgerError` → `markFailed(runId, message)` + `return { ok:false, error: message }` |
| 设置且自洽 | — | 解析后再进比对 |

- **禁止**把第二态降级成第一态（等于把一道新鲜的闸改成常开）。
- **文案共用**：失败消息直接复用 `CorpusLedgerError` 原文（与 api CLI `exit 2` 同一套），**不许**在 worker 侧另造措辞。
- **重试**：`EVAL_JOB_DEFAULT_ATTEMPTS = 1`（`eval-job.ts:26`）→ 账本坏是**确定性失败**，本就无重试可消耗。

### 4 · 落库形状 → **改为取报告真值**

- `persist.ts:146-148` 与 `:190-192` 三键改为 `report.docMapSource` / `report.docMapResolved` / `report.docMapUnmappedIds`。
- **等价性由测例钉住**：`summarizeDocMap(…, null)` 返回**恰好** `{ docMapSource:'none', docMapResolved:0, docMapUnmappedIds:[] }`（`corpus-ledger.ts:252-254`），与今天的硬编码常量逐位相同 → 未设账本时落库形状**不变**（反证测例）。
- **同构收益**：api 侧 `buildEvalRunInsert` 本就整对象直落报告真值；worker 改成取真值后两条入口的 `eval_runs.report_json` **同形**。

### 5 · L2 → **同办**

- `runL2Batch` 接 `L2_DOC_MAP`，与 L1 同一图形；**三处**比对点全接（`run-l2-batch.ts:193` 与 `:219`）。
- `docHit` 三态语义（`null` / `true` / `false`）**保持今天不变**，只是参与比对的 id 换成解析后的。
- `docHitRate` **仍不进** `computeL2SignoffEligible`（本图不改判定，只对齐含义）。
- error 分支解析后**行为无差异**（`evidenceDocIds` 是 `[]`，必然 miss），但**仍要解析** —— 否则「两侧同语义」在 L2 上留一个例外。

### 6 · 账本↔库内存在性对账 → **不纳入本图**

① 本图目的地是「两处入口含义一致」，不是「账本绝对新鲜」；② CLI 侧**没有** DB 读（前图裁定 4 显式划出），单在 worker 侧加会制造**新的**两侧不对称 —— 恰与本图判据相反；③ 今天账本是同一次会话内刚生成的，陈旧风险低。
**转下一图**，并附已核实事实：worker 侧有 DB 读（`persist.ts` 用 `getDb()`），真要统一，落点应在**共享层的可选校验**（两侧一起接或都不接）。

### 7 · 配置键连带 → **两处都无需手工动作（有条件）**

- **`turbo.json`**：`L1_DOC_MAP` / `L2_DOC_MAP` **已登记**在 `lint`（`:36` / `:45`）与 `test`（`:89` / `:98`）的 env 段；turbo 的 env 是 per-task（不分包），**worker 包同样适用** → 无需新增。
- **`check.mjs` 黑名单**：`:304-306` 会把 **api 与 worker 的 `env.ts` 字段名自动加进 `UPPER_STOP`**。故 worker 在 `env.ts` 声明这两个键后**自动进黑名单** → 回写 `docs/module-status` 正文时用这两个键名**不会**触发 `3-符号` 误报（基线 39 条守得住）。**前提**是它们真正声明在 worker 的 `env.ts`，而不是只读 `process.env`。

### 8 · 报告 DTO 是否透出映射来源 → **纳入本图（收窄版）**

- **纳入**：`toEvalRunDto`（`apps/api/src/services/eval-runs.ts`）透出 `docMapSource` / `docMapResolved` / `docMapUnmappedIds`，`EvalRunSchema`（`packages/contracts/src/eval/eval-run.contract.ts`）加三个**可选**字段。二者**必须同时改**，否则 `.strict()` 的列表路径（`routes/eval.ts:219`）会因多余键报错。
- **理由**：本图动机是「准出时从运营台取报告会取到结构性假零」。只对齐 `hitAtK` 数字，运营台仍**分不清**「真检索失败」与「没接账本」—— 这正是「同一数字两处含义不同」在展示层的残留。
- **方向**：如实标注，**不改任何判定**；缺键用 `?? 'none'` 容错。
- **不收**：不动 admin 页面（本机无浏览器，DTO 有字段即可被 API 消费者读到）；不动 `repro` 的透出（§8 的另一条雾，本图不扩）。
