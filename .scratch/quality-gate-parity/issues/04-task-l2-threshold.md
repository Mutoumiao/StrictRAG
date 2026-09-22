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

（待填）
