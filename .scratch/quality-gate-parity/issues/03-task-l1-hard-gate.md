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

（待填）
