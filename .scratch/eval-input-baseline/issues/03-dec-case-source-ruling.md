# 03 · 裁定：两条入口的题源以谁为准 / 差异要不要成为信号

Type: grilling
Status: resolved
Parent: ../map.md
Blocked by: 01

## Question

今天 api CLI 读文件 `fixtures/l1/gold.yaml`，worker 队列读 DB 表 `gold_questions`。裁定权威题源 / 差异可检测 / 是否收敛。

## Answer

依据 [`research/01b`](../research/01b-case-source-divergence.md)。

### R1 · 权威分层：**并存**，但各自钉死语义

- **仓内 `fixtures/l1/gold.yaml` = 基线题面**：git 版本化、RACI 审核产物（`fixtures/l1/RACI.md`）、字段更全（含 `expectedChunkIds` / `rubric`），60 题。
- **`gold_questions` 表 = 运行期题集**：运营台 CRUD（`POST …/gold-questions`，需 `eval.run`）+ 反馈晋升（且晋升路径**不写** `expectedDocIds`）。
- 两者**并存是产品设计**（P2 底线 HTTP 的题集由运营侧自管），不是缺陷。

### R2 · 本图**不**收敛题源

- **不**新增「文件 → DB」灌题入口：属新增产品面，PRD 未定义；且仓内 `gold-review-guard.test.ts` 把 L1 名录的意图钉在「只读侧」（`gold.yaml` 不被代码写）。本图**只**让差异可见，不动这条产品面。
- **不**把 worker 改成读文件：那会把「运营台自管题集」这条 P2 底线拆掉。
- 收敛（若产品日后要）落 `Not yet specified`。

### R3 · 可检测信号（本图落地）：题集身份**带来源标注**，并与仓内基线逐位可比

`repro` 区块（§8 可复现面的既有载体，**纯 TS 类型、无 zod、不进任何判定**）新增两键：

| 键 | 取值 | 语义 |
|---|---|---|
| `goldSource` | `'file' \| 'db'` | 本次跑的题面从哪来（api CLI = `file`；worker 队列 = `db`） |
| `goldSetMatchesRepoFile` | `boolean \| null` | 本次跑的题面 id 集合（api 用 `id`、worker 用 `caseKey`）与**仓内 `fixtures/l1/gold.yaml` 的 id 集合**是否**逐个相同**；仓内文件读不到 / 不合形 → `null`（**未知**，不当 `true`，也不当 `false`） |

- 实现口径：复用既有的确定性哈希 `l1QuestionIdsHash`（`packages/contracts/src/eval/l1-repro.ts:30-37`）——「本次集合的哈希 == 仓内文件集合的哈希」即 `true`。**禁**另写一套集合比较。
- 于是 `repro.questionIdsHash` 从「一个不知锚在哪的哈希」变成「**带来源标注、可与仓内基线逐位比对**的题集身份」。
- 顺带能抓的一类：CLI 用 `L1_GOLD_PATH` 指了**非仓内基线**的文件 → `goldSource='file'` ∧ `goldSetMatchesRepoFile=false`，一眼可辨。
- 仓内基线读取器落 `corpus-ledger-file.ts`（已带 `node:fs` 的夹具子路径），形如 `readRepoGoldCaseIds(repoRoot): string[] | null`：只认 JSON 形 `cases[].id`，任何读不到 / 不合形 → `null`，**绝不抛错**（它是**信号**不是闸）。

### R4 · **不**进判定、**不**进签字快照

- 「两侧题集不同」**不**接 `computeSignoffEligible` / `evaluateAdr046Bind` / ADR-046 快照：快照的必达元素由 `prds/08-quality` 定义，**新增必达项 = 改冻结语义**（须 ADR → 改 PRD → 升版）。
- 「把它变成硬门」这条路转 `Not yet specified`（附销账条件）。

### R5 · 顺带发现，本图不改

- worker 的 `loadGold` **丢掉** DB 里已有的 `expected_chunk_ids` 与 `rubric` 两列（`EvalGoldCase` 无对应字段）。今天**无消费方**，故不属本图；记入 `Not yet specified`。
