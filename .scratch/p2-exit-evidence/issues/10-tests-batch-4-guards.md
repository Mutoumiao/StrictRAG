# 补测批 4 · 边界护栏（N2 / S6 / Z3 / C4）

Type: task
Status: open
Blocked by: —

## Question

把 4 条边界行补到有护栏断言（这几行不在 94 行主盘内，但与 P2 出口相关，被单独列出）：

| 行 | 今天缺的断言 | 落点 |
|----|--------------|------|
| N2 | 「Mongo 正文读写无应用层字段 encrypt wrapper」的护栏 | `apps/worker/tests/ingest/mongo-body.test.ts`（补 `it`） |
| S6 | 切换 KB 后写菜单隐藏 / 写路由 403 | `apps/admin/tests/shell/kb-switch-write.test.tsx`（新） |
| Z3 | 未点详情不得预拉全部 chunk body | `apps/admin/tests/ops/chunks-workspace.test.tsx`（新，与批 3 的 Z4/Z8 同文件） |
| C4 | L1 Hit@k 的逻辑 id→uuid 映射层断言 | `packages/contracts/tests/eval/l1-hit-at-k.test.ts`（补 `it`） |

约束：C4 只补映射层逻辑，**不得**把它接进签字公式（`prds/08-quality` 已冻：Hit@k 不进签字公式）；N2 是护栏（断言「没有」），写不成绿就说明源码有该 wrapper，要报告而非迁就。

## Answer

（进行中）
