# 落 L2 侧阈值判定（近指代 ≥80%）

Type: task
Status: claimed
Blocked by: 02

## 做什么（按 02 的裁定 4）

1. **算近指代通过率**：在 `apps/worker/src/eval/run-l2-batch.ts` 与 `apps/api/src/scripts/run-l2-golden.ts`（两份同义实现，必须同改）里按行算：
   - 分子 = `type === 'near_coref' ∧ verdict === 'pass'` 的行数；
   - 分母 = **全部** `near_coref` 行（**含 `error`**，error 不算 pass）；
   - 分母 0 → `null`。
2. **进 `computeL2SignoffEligible`**（`packages/contracts/src/eval/l2-matrix.ts`）：新增 `nearCorefPassRate` 入参，判据 `!= null && >= L2_NEAR_COREF_PASS_MIN`（常量 = 0.8，带 PRD 出处注释）。
   - **签名新增输入**会让既有测例编译期报红（`packages/contracts/tests/eval/l2-matrix.test.ts` · `apps/worker/tests/eval/run-l2-batch.test.ts`）——按新签名补参，**不要把判据写成可选默认值绕过**。
3. **注释里写明残余**（裁定 4，不许省）：不含「主题是否正确」（无 judge，且 runner 今天未采集 `evidence_snapshot.docId`）、不含「合法 citation」、夹具只有 3 条 `near_coref` → 该门今天等价于「3/3 全过」。
4. **边界测例**：分母 0 · 恰好 80% · 79.9% · 全 error（应为不通过）。

## 纪律

- 新测例只进 `<包>/tests/<能力>/<意图>.test.ts(x)`，文件头「目标 / 需求 / 被测 / 简介」简体中文。**不要**改 `tests/index.md`（本图统一登记）。
- **反证**：把 `>= 0.8` 放宽成 `>= 0` / 去掉判据，确认新测例红；还原后全绿。红名单写进 Answer。
- **禁止**改 L2 规模下限 15（裁定 5）；**禁止**碰其余三项零容忍与 `historyLeaked` 的比对宽度（裁定 6）；**禁止**改 `prds/00–11`。
- 门禁：`pnpm check-types` + `pnpm lint`（零 warning）+ `pnpm --filter @strict-rag/api test` + `pnpm --filter @strict-rag/worker test` + `pnpm --filter @strict-rag/contracts test` 全绿。

## Answer

**结论一句话**：PRD `:188` 的「近指代 ≥80%」已从「数据源齐但零消费者」改为**真进** `computeL2SignoffEligible` 的 `&&`：纯函数 `l2NearCorefPassRate` 下沉 `@strict-rag/contracts`（两 runner 物理上不可能分叉），入参**必填**、`null` 一律不放行（fail-closed，含「全批 error」这条 fail-open 退化的反证钉），常量 `L2_NEAR_COREF_PASS_MIN = 0.8` 只此一处；残余（不含主题正确 / 不含合法 citation / 夹具仅 3 条 near_coref）已写进代码注释。裁定 5 / 6 的四项**未动**。

### 1. 改了哪些文件

**改动文件（7 个：源码 5 + 既有测例补参 2）**

| 文件 | 改了什么 |
|---|---|
| `packages/contracts/src/eval/l2-gold.ts` | `L2_SIGNOFF_MIN_CASES` 旁新增 `L2_NEAR_COREF_PASS_MIN = 0.8`，注释写明出处 `prds/08-quality/02-evaluation-and-gates.md §6.2 :188`。 |
| `packages/contracts/src/eval/l2-matrix.ts` | ① 新增纯函数 `l2NearCorefPassRate(rows)`：分子 = `type='near_coref' ∧ verdict='pass'`，分母 = **全部** `near_coref` 行（**含 `error`**），分母 0 → `null`；注释写明「error 进分母是为了不让全批 error 退化成 `null → 不适用 → 放行`（fail-open），本仓纪律是无有效数据不外推（与 `sweepTau` 的 `scored=0 → tauStar=null` 同款）」+ 三条残余。② `computeL2SignoffEligible` 新增**必填**入参 `nearCorefPassRate: number | null`，判据 `!== null && >= L2_NEAR_COREF_PASS_MIN`（`null` / `<0.8` → false），并更新函数顶部 doc（旧文只写四项）。 |
| `apps/worker/src/eval/run-l2-batch.ts` | 调用处传 `nearCorefPassRate: l2NearCorefPassRate(rows)`；`L2BatchReport` 增 `nearCorefPassRate: number \| null` + `nearCorefPassDen: number`（后者 = `rows.filter(type==='near_coref').length`），注释指向纯函数的残余说明。 |
| `apps/api/src/scripts/run-l2-golden.ts` | 同款：`L2Report` 增同样两字段；`runL2Golden` 传参并落报告；`formatL2ReportMd` 门限表在 `zeroToleranceHits` 后加一行 `nearCorefPassRate | 0.8 (den=5)`（沿用 L1 侧 `citationComplete | 0.5 (den=2)` 的写法与三位小数取整）。 |
| `apps/worker/src/eval/persist.ts` | `saveL2Report` 的 `reportJson` 白名单补 `nearCorefPassRate` / `nearCorefPassDen`（照抄 L1 侧刚补 `citationComplete` / `citationCompleteDen` 的位置与风格）；否则 worker 落库报告丢这两个字段。 |
| `apps/api/tests/eval/l2-cli.test.ts` | 仅编译期补齐：`sampleReport()` 的 `L2Report` 字面量加 `nearCorefPassRate: null` / `nearCorefPassDen: 0`（**未改任何断言期望**）。 |
| `packages/contracts/tests/eval/l2-matrix.test.ts` | 仅编译期补齐：该文件共 5 处 `computeL2SignoffEligible` 调用（1 处直调 + 4 处经 `liveOk` spread），在 **2 个位置**各加 `nearCorefPassRate: 1`（直调字面量与 `liveOk` 定义），**未改任何断言期望**。 |

（`apps/api/src/eval/l2-gold.ts` 的再导出**未动**：两 runner 直接从 `@strict-rag/contracts` import 纯函数，常量无须二次导出。）

**测试（3 新 + 2 改）**

| 文件 | 改动 |
|---|---|
| `packages/contracts/tests/eval/l2-near-coref-rate.test.ts` | **新增**（7 条，纯函数 + 闸边界 + 回归钉）。 |
| `apps/worker/tests/eval/run-l2-batch-near-coref-rate.test.ts` | **新增**（3 条，worker runner）。 |
| `apps/api/tests/eval/l2-near-coref-rate.test.ts` | **新增**（4 条，api runner + md）。 |
| `apps/api/tests/eval/l2-cli.test.ts` | 编译期补参（见上）。 |
| `packages/contracts/tests/eval/l2-matrix.test.ts` | 编译期补参（见上）。 |

**未新增 / 未改**：`tests/index.md`（见第 7 节）、`prds/`、`docs/`、任何 env 默认值、任何既有判定。

### 2. 新测例文件清单 + 用例名

**`packages/contracts/tests/eval/l2-near-coref-rate.test.ts`**（describe：`l2NearCorefPassRate` / `computeL2SignoffEligible 近指代门`）

1. `分母只取 near_coref：其它类题的 pass/fail/error 不进分子也不进分母`
2. `无 near_coref 行 → 分母 0 → null（该门缺测，不放行）`
3. `恰好 80%（5 条 4 pass）达标；60%（5 条 3 pass）不达标`（断言 `4/5 === 0.8 === L2_NEAR_COREF_PASS_MIN`）
4. `全 error 的 near_coref → 率 0（error 进分母、不算 pass），不得退化成 null`（显式 `expect(rate).not.toBeNull()`，钉 fail-open）
5. `率 1 → true；恰好 0.8 → true；0.79 → false`
6. `率缺测（null，无 near_coref 题）→ false；率 0（全 error）→ false`
7. `回归钉：原有四项（live / ≥15 / 零容忍 / 九类）各自仍单独压成 false`（含 `mock` / `unknown` / `caseCount:14` / `zeroToleranceHits:1` / 缺 `session_isolation`）

**`apps/worker/tests/eval/run-l2-batch-near-coref-rate.test.ts`**（describe：`runL2Batch 近指代通过率`）

1. `5 条 near_coref、4 pass 1 fail = 恰好 80% → 率 0.8、分母 5 且工程 signoffEligible`（15 题 + 九类齐 + 零泄漏）
2. `near_coref 全 error → 率 0（error 进分母）→ 不放行`（7 条 near_coref 全抛错；`caseCount=15`、`zeroToleranceHits=0`、九类齐，故 false 只能由新门产生）
3. `分母只取 near_coref：其它类全 fail 也不压该率`（`nearCorefPassDen=1`、率 1、`failCount=1`）

**`apps/api/tests/eval/l2-near-coref-rate.test.ts`**（describe：`runL2Golden 近指代通过率`）

1. `15 题 5 条 near_coref：4 pass 1 fail = 恰好 80% → 率 0.8 且工程 signoffEligible`（并断言 md 含 `nearCorefPassRate` 与 `(den=5)`）
2. `15 题 5 条 near_coref：2 fail = 60% → 率 0.6 且不放行`
3. `分母只取 near_coref：其它类全拒答不压该率`
4. `无 near_coref 题 → 分母 0 → 率 null → 不放行`

三个新文件文件头均含简体中文「目标 / 需求 / 被测 / 简介」四段，且均已过 `prettier --check`。

### 3. 反证红名单（近指代门放宽为永真 → 红；还原 → 全绿）

临时改动（`packages/contracts/src/eval/l2-matrix.ts`，标记 `FALSIFY-TEMP`，已还原）：

```ts
// 原判据
const nearCorefOk = input.nearCorefPassRate !== null && input.nearCorefPassRate >= L2_NEAR_COREF_PASS_MIN;
// 反证时
const nearCorefOk = L2_NEAR_COREF_PASS_MIN > 0;   // 永真，null 亦放行
```

| # | 文件 | `it` | 现象 |
|---|---|---|---|
| 1 | `packages/contracts/tests/eval/l2-near-coref-rate.test.ts` | `率 1 → true；恰好 0.8 → true；0.79 → false` | 0.79 由 false 变 true |
| 2 | 同上 | `率缺测（null，无 near_coref 题）→ false；率 0（全 error）→ false` | `null` 由 false 变 true |
| 3 | `apps/worker/tests/eval/run-l2-batch-near-coref-rate.test.ts` | `near_coref 全 error → 率 0（error 进分母）→ 不放行` | `signoffEligible` 由 false 变 true |
| 4 | `apps/api/tests/eval/l2-near-coref-rate.test.ts` | `15 题 5 条 near_coref：2 fail = 60% → 率 0.6 且不放行` | `signoffEligible` 由 false 变 true |

**合计 4 条红**（contracts 2 · worker 1 · api 1），其余 12 条新测例 + 全部既有测例在反证状态下仍绿——说明红的正是新门，不是顺手把别的门弄丢。还原后复跑：`contracts` eval 组 **6 files / 48 passed**、`worker` eval 组 **6 files / 23 passed**、`api` eval 组 **14 files / 123 passed**；全包数字见第 6 节。已确认工作区无残留标记（全仓 `FALSIFY-TEMP` 0 命中）。

### 4. 被改写 / 补参的既有测例逐条说明

**a) 改写（断言期望）**：**无**。本次没有把任何既有 `it` 的期望值翻掉。

**b) 编译期补必填入参（新签名）**

| 文件 | 处 | 补了什么 | 是否动断言 |
|---|---|---|---|
| `packages/contracts/tests/eval/l2-matrix.test.ts` | `it('live + 九类 + ≥15 + 零泄漏 → true')` 的调用点 | `nearCorefPassRate: 1` | 未动（该组夹具 near_coref 全 pass，补 1 与语义一致） |
| 同上 | `liveOk` 对象（供 `it('mock / 缺类 / 泄漏 / 不足 15 → false')` 的 4 处 spread） | `nearCorefPassRate: 1` | 未动（4 条期望各自由 mock / caseCount / zeroTolerance / 缺类压 false，与新门无关） |
| `apps/api/tests/eval/l2-cli.test.ts` | `sampleReport()` 的 `L2Report` 字面量 | `nearCorefPassRate: null` / `nearCorefPassDen: 0` | 未动（该工厂只服务 `buildL2EvalRunInsert` 映射断言，不读该字段） |

**c) 事先点名的两条 runner 既有测例实测未翻**（实跑验证，未改一个字）：

- `apps/worker/tests/eval/run-l2-batch.test.ts` `it('live + 九类齐 + ≥15 + 零泄漏 → 工程 signoffEligible')`：stub 恒 `answered` + `rewriteUsed:false`，7 条 near_coref 全 pass → 率 1 → 仍 true。
- `apps/api/tests/eval/l2-cli.test.ts` `it('8 real gold + stub live → caseCount≥15; 工程 signoffEligible true 仍无 businessPass')` 与 `it('real gold + persist mock + esMode http → 工程 signoffEligible true 仍 ≠ 准出')`：真实夹具 3 条 near_coref 全为 `rewriteUsed:true ∧ accept:['answered']`，stub 全 pass → 3/3 = 100% → 仍 true（这正是裁定 4 第 ③ 条残余「今天该门 ≈ 3/3 全过」的实测体现）。

### 5. 只加严自证（旧 true 集合 ⊇ 新 true 集合）

`computeL2SignoffEligible` 的合取项由 `S_old = {live, caseCount≥15, zeroToleranceHits==0, 九类齐}` 变为 `S_new = S_old ∩ {rate ≠ null ∧ rate ≥ 0.8}`。合取项**只增不减**，其余四项判定代码逐字未动 → `S_new ⊆ S_old`；且真子集（存在旧 true / 新 false）：

| 项 | 旧口径 true 集合 | 新口径 true 集合 | 关系 |
|---|---|---|---|
| 近指代率 | 无该合取项（恒真） | `r ≠ null ∧ r ≥ 0.8` | **真子集**（`null`、`0`、`0.6`、`0.79` 由真变假） |
| live / caseCount≥15 / zeroTolerance==0 / 九类齐 | 原样 | 原样 | 逐位等价（回归钉 7 条实测仍在） |
| runner 报告字段 | `L2BatchReport` / `L2Report` 既有字段 | 既有字段 + 2 个新字段 | **只增**（无删除 / 无改名 → 既有读取方不受影响） |

事实面上分两层（不夸）：**纯函数层**的加严含 `null` 分支（`null` 在旧口径可放行）；**runner 层**的真实可达加严面是「near_coref 有 fail 或 error 的批次」（因为九类齐已隐含至少 1 条 near_coref 行 → 率不为 `null`），`null` 在 runner 上只伴随缺类（旧口径本就 false）。反证第 2 条（`null → false`）钉的是纯函数层，第 3 / 4 条钉的是 runner 层。另：`L2_NEAR_COREF_PASS_MIN` 与所有判定处均为常量引用，无裸数字；未触碰 `L2_SIGNOFF_MIN_CASES`、`zeroToleranceHits` 口径、`historyLeaked` 宽度、`l2TypeCoverage`。

### 6. 门禁实跑数字

| 命令 | 结果 |
|---|---|
| `pnpm check-types` | turbo **8 successful / 8 total**，exit 0 |
| `pnpm lint`（各包 `eslint . --max-warnings 0`） | turbo **8 successful / 8 total**，**零 warning**，exit 0 |
| `pnpm --filter @strict-rag/contracts test` | **红：卡在存货闸**（exit 1，未登记 1 个新文件）；vitest 本体 **28 files passed / 232 passed** |
| `pnpm --filter @strict-rag/worker test` | **红：卡在存货闸**（exit 1，未登记 1 个新文件）；vitest 本体 **49 files passed / 221 passed** |
| `pnpm --filter @strict-rag/api test` | **红：卡在存货闸**（exit 1，未登记 1 个新文件）；vitest 本体 **169 files passed / 1029 passed + 3 skipped** |

存货闸原文（`scripts/check-test-inventory.mjs`）：

- contracts：`未登记: tests/eval/l2-near-coref-rate.test.ts`
- worker：`未登记: tests/eval/run-l2-batch-near-coref-rate.test.ts`
- api：`未登记: tests/eval/l2-near-coref-rate.test.ts`

基线对照（工作区在本轮开始时的实跑值）：contracts **27 files / 225 passed**、worker **48 files / 218 passed**、api **168 files / 1025 passed + 3 skipped** → 净增 contracts 1 文件 / 7 条、worker 1 文件 / 3 条、api 1 文件 / 4 条，**无任何既有测例变红**；也**未观察到**疑似 L1 侧改动导致的失败（三包 vitest 全绿）。按纪律**未改 `tests/index.md`**，登记后三条门禁即全绿；建议行（沿用现有表格式）：

```
| `eval/l2-near-coref-rate.test.ts` | L2 近指代通过率必须按 near_coref 行的机械 pass 比例算（error 进分母），并真进工程 signoffEligible。 | prds/08-quality/02 §6.2 :188 | `l2NearCorefPassRate · computeL2SignoffEligible` | 分母 0 → null → 不放行；恰好 80% / 79% / 全 error 边界 + 原有四项回归钉。 | 现行 |
| `eval/run-l2-batch-near-coref-rate.test.ts` | worker L2 批跑落近指代通过率且与 api CLI 同口径。 | prds/08-quality/02 §6.2 :188 | `runL2Batch` | 注入 executeTurn；全 error → 0% 不放行；分母只取 near_coref。 | 现行 |
| `eval/l2-near-coref-rate.test.ts` | api L2 CLI 落近指代通过率与 md 门限行。 | prds/08-quality/02 §6.2 :188 | `runL2Golden · formatL2ReportMd` | 临时 gold + 注入 execute；60% 不放行、分母 0 → null。 | 现行 |
```

（前两行分别进 `packages/contracts/tests/index.md` 与 `apps/worker/tests/index.md`，第三行进 `apps/api/tests/index.md`。）

### 7. 未做什么 / 为什么

1. **未改 `L2_SIGNOFF_MIN_CASES`（15 → 30）**（裁定 5）：PRD §6.2 `:169` 的措辞是**建议**「30～50」，不是硬门；改它会翻 4 条既有测例（`l2-matrix.test.ts:23`、`run-l2-batch.test.ts:67`、`l2-cli.test.ts:407`、`:651`）并让代码严于 PRD 建议（那属「代码自加严」，须 ADR）。
2. **未动其余三项零容忍**（裁定 6：主题粘连 / 冲突跟错数字 / 合法路径跳过 verify）：今天无判据（`expected.accept` 白名单 / `rubric` 零消费者），须先补采集（`evidence_snapshot.docId`）再定判据 → 记债；绝不把它做成恒 `false` 的空转闸。
3. **未收紧 `historyLeaked` 比对宽度**（裁定 6）：它只比对先前**用户**轮原文，比 PRD §6.2 `:186`「历史文本进 evidence」窄；收紧会翻 `run-l2-batch.test.ts` 泄漏用例组，须单独一轮带反证 → 记债。
4. **未改 `prds/`、未改 `docs/`**（回写属工单 05）、**未改任何仓库默认开关**、**未动 L1 侧任何文件**（`adr046-snapshot.ts` / `run-l1-*.ts` / `l1-matrix.ts` / 其 4 个新测例一律未碰）。
5. **未改 `tests/index.md`**：纪律明写「主控统一登记」，故 3 个新文件未登记，导致三条包门禁**只**卡在存货闸（vitest 本体全绿，数字见第 6 节），与工单 03 的处置一致。
6. **未把新入参设成可选默认值**：`nearCorefPassRate` 是**必填**（`number | null`），判据也不写成「只有传了才检查」——既有测例按新签名逐处补参。
7. **未跑全仓 `pnpm test`**（任务明令禁止）。
8. **未给 `apps/worker/src/eval/consumer.ts` 的完成日志加新字段**：本工单只要求「报告 + 落库白名单 + md 行」；日志面未授权，避免扩大改动面（如需可另开一行）。
9. **未顺手重排他人非 prettier 合规代码**：`l2-gold.ts` / `persist.ts` / `run-l2-golden.ts` / `l2-matrix.test.ts` / `l2-cli.test.ts` 在 HEAD 版本即已非 prettier 合规（已用仓内临时副本逐个核对），我只对自己新增的 3 个文件跑了 `prettier --write`；格式未纳入门禁，故不改他人行。
