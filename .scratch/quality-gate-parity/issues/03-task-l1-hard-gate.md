# 落 L1 侧硬门进闸（只加严）

Type: task
Status: claimed
Blocked by: 02

## 做什么（按 02 的裁定 1 / 2 / 7 逐条）

1. **`evaluateAdr046Bind` 新增实测输入并进 `&&`**（`apps/api/src/eval/adr046-snapshot.ts`）：
   - `coverage`：判据由 `!= null && > 0` 改为 `!= null && >= gates.coverageMin`。
   - `cRate`：新增，`!= null && <= gates.cRateMax`。
   - `hitAtK`：新增，`=== null || >= gates.hitAt20Min`（PRD「有标注时」→ 无标注即该门不适用）。
   - `judgeAuroc`：新增，`!= null && >= gates.judgeAurocMin`。
   - 每项失败要进 `reasons`，且 `businessPass` 的 `&&` 链要读它们。
   - **保持**「只加严」：任何在旧口径下为 `false` 的情形，新口径不得为 `true`（改动方向逐项自证）。
2. **引用完整率补数据源**（两个 L1 runner 同改，否则两条入口口径分叉）：
   - `apps/api/src/scripts/run-l1-golden.ts` 与 `apps/worker/src/eval/run-l1-batch.ts`：逐题采集 `result.graph.answerKind` 与 `result.graph.citations.length`，落到 case 行；报告加 `citationComplete`（率）与分母计数。
   - 口径：分子 = `answerKind='knowledge' ∧ outcome='answered' ∧ citations.length > 0`；分母 = `answerKind='knowledge' ∧ outcome='answered'`；分母 0 → `null`。
   - 把 `citationComplete` 接进 `evaluateAdr046Bind`：`=== null || >= gates.citationCompleteMin`（分母 0 = 无 knowledge answered 题 → 不适用）。
   - 代码注释里写明裁定 2 的**残余**：该率结构上只能是 1 或 null（图在 `answered ∧ knowledge` 时必带合法 citation），此门的作用是钉住该不变式。
3. **双写常量一致性断言**（裁定 7）：在 `apps/api/tests/eval/` 下加一条同时读 `PILOT_HARD_GATES` 与 `TAU_STAR_COVERAGE_MIN` / `TAU_STAR_C_RATE_MAX` 的断言。
4. **被改写的既有断言逐条说明**（01 第四节已点名，最集中的是 `apps/api/tests/eval/adr046-snapshot.test.ts` 里那条「覆盖 >0 → businessPass=true」）。

## 纪律

- 新测例只进 `<包>/tests/<能力>/<意图>.test.ts(x)`，文件头「目标 / 需求 / 被测 / 简介」简体中文。**不要**改 `tests/index.md`（本图统一登记）。
- **反证**：把新增的每一处判定临时去掉（或把 `>= coverageMin` 改回 `> 0`），确认指定测例红；还原后全绿。红名单写进 Answer。
- **禁止**放宽任何既有条件；**禁止**改仓库默认开关；**禁止**改 `prds/00–11`。
- 门禁：`pnpm check-types` + `pnpm lint`（零 warning）+ `pnpm --filter @strict-rag/api test` + `pnpm --filter @strict-rag/worker test` + `pnpm --filter @strict-rag/contracts test` 全绿。

## Answer

**结论一句话**：L1 侧五项实测值（覆盖率 / C 率 / Hit@k / Judge AUROC / 引用完整率）已从「只做门对门比较」改为**真进** `evaluateAdr046Bind` 的 `&&`，方向逐项只加严；四条新门缺测时按裁定 0 fail-closed（例外只有 PRD 自带条件语的两门）；引用完整率在两个 L1 runner 同口径落地（纯函数下沉 `@strict-rag/contracts`，物理上不可能分叉），并把 worker → api 内口的采集面接通。

### 1. 改了哪些文件

**源码（8 个）**

| 文件 | 改了什么 |
|---|---|
| `apps/api/src/eval/adr046-snapshot.ts` | ① `evaluateAdr046Bind` 新增 `cRate` / `hitAtK` / `judgeAuroc` / `citationComplete` 四个入参，全部进 `businessPass` 的 `&&`；`coverage` 判据由 `!= null && > 0` 改为 `!= null && >= PILOT_HARD_GATES.coverageMin`（判定处只读常量，无裸数字）。② 新增 code `coverage_below_min` / `c_rate_above_max` / `hit_at_k_below_min` / `judge_auroc_below_min` / `citation_complete_below_min`；既有 `coverage_zero_or_null` **语义不变**（仍恰在 `coverage == null ∨ coverage <= 0` 时 push）。③ `BindSnapshotInput` 与 `bindQualitySnapshotToEval` 透传新输入。④ 顶部注释补「实测硬门进闸 / 缺测 fail-closed / `judgeAuroc` 生产恒 null 故 `businessPass` 在生产路径不可达（有意：把未测显形为红，不留覆盖率 0.001 也能变真的假绿）」。 |
| `apps/api/src/eval/l1-matrix.ts` | 再导出 `citationCompleteRate`（沿用该文件「包内纯函数保持原 import 路径」的写法）。 |
| `packages/contracts/src/eval/l1-matrix.ts` | 新增纯函数 `citationCompleteRate(rows)`：分子 = `answerKind='knowledge' ∧ outcome='answered' ∧ citationCount>0`；分母 = `answerKind='knowledge' ∧ outcome='answered'`；分母 0 → `null`；注释写明「结构上只能是 1 或 null（图在 `answered ∧ knowledge` 时必带合法 citation），此门钉的是该不变式，不是筛跑次」。两 runner 共用同一函数，口径**不可能**分叉。 |
| `apps/api/src/scripts/run-l1-golden.ts` | ① 逐题采集 `graph.answerKind` 与 `graph.citations.length` 落 `L1CaseRow.answerKind` / `citationCount`。② `L1Report` 加 `citationComplete`（率）与 `citationCompleteDen`（分母计数）。③ md 字段表加 `cRate` / `citationComplete` 两行。④ 构造 `bindQualitySnapshotToEval` 时把 `coverage` / `cRate(matrix)` / `hitAtK` / `judgeAuroc` / `citationComplete` 五个实测值**全部**传入。⑤ CLI stdout JSON 带出引用完整率。 |
| `apps/worker/src/eval/run-l1-batch.ts` | 同口径：`EvalCaseExecuteResult`（非 error 分支）与 `L1BatchCaseRow` 加 `answerKind` / `citationCount`；`L1BatchReport` 加 `citationComplete` / `citationCompleteDen`；用同一个 `citationCompleteRate` 计算。 |
| `apps/worker/src/eval/execute-ask-http.ts` | 解析内口下发的 `answerKind` / `citationCount`，仅合法值带上（条件展开，缺省不冒充 `knowledge`）。**不接这层 worker 侧引用完整率恒 null → 该门空转，两入口口径分叉。** |
| `apps/api/src/routes/eval.ts` | `POST /internal/eval/execute-ask` 响应补 `answerKind` 与 `citationCount`（`Array.isArray` 兜底，兼容既有 mock graph 不带 `citations` 的用例）。 |
| `apps/worker/src/eval/persist.ts` | `saveReport` 的 `reportJson` 白名单补 `citationComplete` / `citationCompleteDen`（否则 worker 落库报告丢这两个字段）。 |

**测试（6 个：4 新 + 2 改）**

| 文件 | 改动 |
|---|---|
| `apps/api/tests/eval/adr046-hard-gates.test.ts` | **新增**（7 条）。 |
| `apps/api/tests/eval/pilot-gates-parity.test.ts` | **新增**（2 条，裁定 7 双写一致性）。 |
| `apps/api/tests/eval/l1-citation-complete.test.ts` | **新增**（2 条，api runner 引用完整率）。 |
| `apps/worker/tests/eval/run-l1-batch-citation-complete.test.ts` | **新增**（2 条，worker runner 引用完整率）。 |
| `apps/api/tests/eval/adr046-snapshot.test.ts` | **改造 1 条 `it`**（详见第 4 节）。 |
| `apps/api/tests/eval/l1-cli.test.ts` | 3 处 `L1Report` 字面量补必填字段 `citationComplete: null` / `citationCompleteDen: 0`（编译期补齐，**未改任何断言期望**）。 |

未新增/未改的：`tests/index.md`（见第 7 节）、`prds/`、`docs/`、任何 env 默认值。

### 2. 新测例文件清单 + 用例名

**`apps/api/tests/eval/adr046-hard-gates.test.ts`**（describe：`L1 实测硬门进 ADR-046 放行判定`）

1. `五项实测全达标 + 四要素齐 + 未放宽 → 业务 PASS`
2. `coverage 恰好 0.4 过；0.39 不过；null 不过`
3. `cRate 恰好 0.05 过；0.051 不过；null 不过`
4. `hitAtK 恰好 0.7 过；0.69 不过；null 过（无标注 = 该门不适用）`
5. `judgeAuroc 恰好 0.65 过；0.64 不过；null 不过（缺测显形为红）`
6. `citationComplete 0.99 / null 过；0.98 不过`
7. `回归钉：coverage=0.001 且其余五项全过 → 业务 PASS 必须为 false`

**`apps/api/tests/eval/pilot-gates-parity.test.ts`**（describe：`双写常量一致性（PILOT_HARD_GATES vs TAU_STAR_*）`）

1. `PILOT_HARD_GATES.coverageMin 与 TAU_STAR_COVERAGE_MIN 数值相等`
2. `PILOT_HARD_GATES.cRateMax 与 TAU_STAR_C_RATE_MAX 数值相等`

（同时 import `PILOT_HARD_GATES`（api）与 `TAU_STAR_COVERAGE_MIN` / `TAU_STAR_C_RATE_MAX`（contracts）；注释写明「不合一的原因见裁定 7 —— 合一须把常量下沉 contracts，会动 ADR-046 门禁包 7 键的契约形状；本条只防单边漂移」。）

**`apps/api/tests/eval/l1-citation-complete.test.ts`**（describe：`runL1Golden 引用完整率`）

1. `knowledge ∧ answered：有 citation 计完整，空 citations 计不完整`（断言率 0.5、分母 2、case 行 `answerKind` / `citationCount`）
2. `只有 chitchat / 拒答 → 分母 0 → 率 null（该门不适用）`

**`apps/worker/tests/eval/run-l1-batch-citation-complete.test.ts`**（describe：`runL1Batch 引用完整率`）

1. `knowledge ∧ answered：有 citation 计完整，空 citations 计不完整`
2. `只有 chitchat / 拒答 → 分母 0 → 率 null（该门不适用）`

四个文件文件头均含简体中文「目标 / 需求 / 被测 / 简介」四段。

### 3. 反证红名单（改回旧口径 → 红；还原 → 全绿）

| 反证 | 改动（临时） | 红条数 | 红名单（文件 + `it`） |
|---|---|---|---|
| 1 | `>= gates.coverageMin` 改回 `> 0` | 2 | `adr046-hard-gates.test.ts`：`coverage 恰好 0.4 过；0.39 不过；null 不过`；`回归钉：coverage=0.001 且其余五项全过 → 业务 PASS 必须为 false` |
| 2 | 去掉 C 率判定（`cRateOk = true`） | 1 | `adr046-hard-gates.test.ts`：`cRate 恰好 0.05 过；0.051 不过；null 不过` |
| 3 | 去掉 Hit@k 判定 | 1 | `adr046-hard-gates.test.ts`：`hitAtK 恰好 0.7 过；0.69 不过；null 过（无标注 = 该门不适用）` |
| 4 | 去掉 Judge AUROC 判定 | 2 | `adr046-hard-gates.test.ts`：`judgeAuroc 恰好 0.65 过；0.64 不过；null 不过（缺测显形为红）`；`adr046-snapshot.test.ts`：`四要素齐 + 未放宽 + 只给覆盖率 → 缺测硬门（C 率 / AUROC）不得业务 PASS` |
| 5 | 去掉引用完整率判定 | 1 | `adr046-hard-gates.test.ts`：`citationComplete 0.99 / null 过；0.98 不过` |
| 6 | `citationCompleteRate` 分母去掉 `knowledge` 口径（只按 `answered`） | 2 | `l1-citation-complete.test.ts`（api）：`只有 chitchat / 拒答 → 分母 0 → 率 null（该门不适用）`；`run-l1-batch-citation-complete.test.ts`（worker）：同名 `it` |
| 7 | `citationCompleteRate` 分子去掉 `citations>0` | 2 | api / worker 两文件的：`knowledge ∧ answered：有 citation 计完整，空 citations 计不完整` |

**合计 11 条红**。还原后复跑：`apps/api` eval 组 **13 files / 119 passed**、`apps/worker` eval 组 **5 files / 20 passed**、`contracts` eval 组 **5 files / 41 passed**；全包复跑见第 6 节。已确认工作区无残留临时标记（`FALSIFY-TEMP` 全仓 0 命中）。

### 4. 被改写 / 补齐的既有断言

**a) 改写 1 条（本工单的目的，不是回归）**

- 文件 + 旧名：`apps/api/tests/eval/adr046-snapshot.test.ts` > `it('四要素齐 + 未放宽 + live 覆盖 >0 → 可标已签字包且业务 PASS')`
- 旧断言钉的是哪条宽松口径：该用例只传 `four / diff / signoffEligible / coverage: 0.5`，**C 率、Hit@k、Judge AUROC、引用完整率全部缺测**，却期望 `businessPass === true`。即「未测 = 合格」。
- 为什么与 PRD 冲突：`prds/08-quality/02-evaluation-and-gates.md` 的硬门表把「C 率 ≤5%」「Judge AUROC ≥0.65」「引用完整率 ≥99%」写成**硬门**；一次**从未测过这些量**的跑次拿不到任何证据，按 §6.0「缺项不得静默标绿」与「门禁只加严不放宽」（ADR-046）不得判业务 PASS。
- 改成什么：改名 `it('四要素齐 + 未放宽 + 只给覆盖率 → 缺测硬门（C 率 / AUROC）不得业务 PASS')`；保留 `signedPackage === true`（`signedPackage` 不吃实测值，语义未动），把 `businessPass` 期望改为 `false`，并加 `reasons` 含 `c_rate_above_max` 与 `judge_auroc_below_min`。理由：这正是本工单要钉的 fail-closed 语义；同时在新增文件里补了 `五项实测全达标 → 业务 PASS` 的正例，保证 PASS 路径没被焊死。
- 影响面核对：同文件 `coverage=0 不得翻业务 PASS`（仍 push `coverage_zero_or_null`，绿）、`硬门放宽` / `缺四要素` / `全 internal_guard`（期望本就 false，绿）、`stricter-than-pilot-bind.test.ts`（期望本就 false，绿）、`l1-cli.test.ts` 的 `businessPass=false` 断言（绿）。

**b) 补齐（非断言改写）**

- `apps/api/tests/eval/l1-cli.test.ts` 3 处 `L1Report` 字面量补 `citationComplete: null` / `citationCompleteDen: 0`：新字段设为必填（与 `hitAtK` / `judgeAuroc` 一致），属编译期补齐。
- `apps/worker/tests/eval/execute-ask-http.test.ts` **未改**：新字段用条件展开、未下发即不出现，既有 2 处 `toEqual` 仍绿（已实跑验证）。

### 5. 只加严自证（逐项，「旧 true 集合 ⊇ 新 true 集合」）

`businessPass` 的合取项从 `{signedPackage, signoffEligible, coverageOk_old, ¬internalGuard}` 变为 `{signedPackage, signoffEligible, coverageOk_new, cRateOk, hitAtKOk, judgeAurocOk, citationCompleteOk, ¬internalGuard}`。逐项：

| 项 | 旧口径 true 集合 | 新口径 true 集合 | 关系 |
|---|---|---|---|
| coverage | `c != null ∧ c > 0` | `c != null ∧ c >= 0.4` | **真子集**（`0 < c < 0.4` 由真变假） |
| cRate | 无该合取项（恒真） | `r != null ∧ r <= 0.05` | **真子集**（`null` / `0.051` 由真变假） |
| hitAtK | 无该合取项（恒真） | `h == null ∨ h >= 0.7` | **真子集**（`0.69` 由真变假；`null` 仍真 = PRD「有标注时」） |
| judgeAuroc | 无该合取项（恒真） | `a != null ∧ a >= 0.65` | **真子集**（`null` / `0.64` 由真变假） |
| citationComplete | 无该合取项（恒真） | `q == null ∨ q >= 0.99` | **真子集**（`0.98` 由真变假；`null` 仍真 = 分母 0 不适用） |
| `signedPackage` / `signoffEligible` / `¬internalGuard` | 原样 | 原样 | 逐位等价 |
| `bindable` / `signedPackage` 本身 | — | — | **未改**（新增输入不进这两项） |
| `reasons` | 旧集合 | 旧集合 ∪ 5 个新 code | 只增不减，`coverage_zero_or_null` 触发条件逐位不变 |

推论：任一新口径 `businessPass === true` 的情形，旧口径必为 `true`；反之不成立（如 `coverage=0.2`、`cRate=null`、`judgeAuroc=null` → 旧 true、新 false）。故为**严格加严**，无任何放宽。另：默认开关、`prds/00–11`、既有门限数字（`cRateMax` 等 7 键）全部未动。

### 6. 门禁实跑数字

| 命令 | 结果 |
|---|---|
| `pnpm check-types` | turbo **8 successful / 8 total**，exit 0 |
| `pnpm lint`（`--max-warnings 0`） | turbo **8 successful / 8 total**，**零 warning**，exit 0 |
| `pnpm --filter @strict-rag/api test` | **红：卡在存货闸**（exit 1，未登记 3 个新文件）；vitest 本体 **168 files passed / 1025 passed + 3 skipped** |
| `pnpm --filter @strict-rag/worker test` | **红：卡在存货闸**（exit 1，未登记 1 个新文件）；vitest 本体 **48 files passed / 218 passed** |
| `pnpm --filter @strict-rag/contracts test` | **27 files passed / 225 passed**，exit 0（无新文件，存货闸绿） |

存货闸原文（`scripts/check-test-inventory.mjs`）：

- api：`未登记: tests/eval/adr046-hard-gates.test.ts · tests/eval/l1-citation-complete.test.ts · tests/eval/pilot-gates-parity.test.ts`
- worker：`未登记: tests/eval/run-l1-batch-citation-complete.test.ts`

按纪律**未改 `tests/index.md`**（由主控统一登记）。登记后 api / worker 两条门禁即全绿；建议行（沿用现有表格式）：

```
| `eval/adr046-hard-gates.test.ts` | L1 五项实测硬门必须真进 ADR-046 放行判定，方向只加严。 | prds/08-quality/02 §2 / §3 :89 / §4 :98-99 / §6 :132-138 | `evaluateAdr046Bind` | 逐项边界（恰好达标 / 差一点 / 缺测）+ `coverage=0.001` 回归钉。 | 现行 |
| `eval/pilot-gates-parity.test.ts` | PILOT_HARD_GATES 与 TAU_STAR_* 双写不得单边漂移。 | ADR-046 · 02 裁定 7 | `PILOT_HARD_GATES · TAU_STAR_COVERAGE_MIN · TAU_STAR_C_RATE_MAX` | 不合一但断言数值相等。 | 现行 |
| `eval/l1-citation-complete.test.ts` | api runner 引用完整率按 knowledge ∧ answered 口径落报告。 | prds/08-quality/02 §2 :81 · §6 :134 | `runL1Golden` | 注入 execute；分母 0 → null。 | 现行 |
| `eval/run-l1-batch-citation-complete.test.ts` | worker L1 批跑与 api CLI 同口径落引用完整率。 | prds/08-quality/02 §2 :81 · §6 :134 | `runL1Batch` | 注入 execute；分母 0 → null。 | 现行 |
```

### 7. 未做什么 / 为什么

1. **未改 `tests/index.md`**：纪律明写「主控统一登记」，故 4 个新文件未登记，导致 api / worker 两条门禁**只**卡在存货闸（vitest 本体全绿）。已把待登记清单与现成行放在第 6 节，供主控一次登记。
2. **未做人工抽检进闸**（裁定 3）：全仓无入口 / 无登记面，做成恒 `false` 的空转闸与假绿一样没有信息量 → 记债。
3. **未动 L2 侧任何文件**（裁定 4–6 属工单 04）：`l2-matrix.ts` / `l2-gold.ts` / `run-l2-*.ts` / `historyLeaked` 宽度 / L2 规模 15 一律未碰。
4. **未动 `l1RerunBound` 的 `|| kbId && ranAt` 回退**（裁定 8），也未动 `fourElementsOf` 的其它三要素。
5. **未合并双写常量**（裁定 7）：只加一致性断言（`pilot-gates-parity.test.ts`），不合一。
6. **未改仓库默认开关 / 未改 `prds/` / 未改 `docs/`**（回写属工单 05）。
7. **未把 `hitAtK` 的 k 语义改成硬 k=20**（裁定 5 之外的口径差，属 PRD「检索 Top-k vs 进 verify 集合」的漂移风险，不在本工单授权内）。
8. **未跑全仓 `pnpm test`**（任务明令禁止）；也**未**为此改动 L2 相关失败文件（本轮未观察到 L2 相关失败，`packages/contracts` 与 `apps/api` / `apps/worker` 全量 vitest 均绿）。

### 8. 主控复核补记（2026-09-22）

- **测例登记已补**：4 个新文件已由主控登记进 `apps/api/tests/index.md`（3 行）与 `apps/worker/tests/index.md`（1 行），存货闸已过。
- **两处 reason code 改名（精确化）**：`c_rate_above_max` → **`c_rate_missing_or_above_max`**；`judge_auroc_below_min` → **`judge_auroc_missing_or_below_min`**。理由：这两门在**缺测 `null`** 时也会 push，而旧名只描述了「越过上限 / 低于下限」，会把「没测」误报成「测出来不达标」——与 `coverage_zero_or_null` 这种**合并命名**的既有风格对齐。改动落在 `adr046-snapshot.ts`（2 处字面量）与本工单新增测例、`adr046-snapshot.test.ts`（共 6 处断言同步改名）。**语义零变化**（触发条件逐位不变），只改文案。
- 主控另核实：`citation_complete_below_min` 只在非 null 且低于门限时触发、`hit_at_k_below_min` 同理，两名已精确，未改。
