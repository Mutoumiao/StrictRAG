# 03 · 落：按 02 的裁定实现（桩 或 可诊断失败 + 文档）

Type: task
Status: open
Parent: ../map.md
Blocked by: 02

## Question

按工单 02 择定的路落地，并把裁定里的禁则逐条守住。

**要求**：
- 若路 A：桩实现 + 接入方式 + 启动标注；`scripts/smoke-half.mjs` 的输出须让人一眼看出这一跑用的是桩；**生产档位拒绝启用**（用测例钉住）。
- 若路 B：`smoke:half` 的失败诊断分支（可分辨「缺 Gateway」与「管道坏了」）+ 文档落点。
- 两路都：新增/改动的脚本测例进 `scripts/*.test.mjs`（`node --test`），仓库根 `scripts/*.test.mjs` 的既有测例不得变红；`pnpm check-types` + `pnpm lint` 零 warning + 全仓 `pnpm test --concurrency=1`。
- **反证**：每一处「闸 / 标注 / 拒绝启用」都要能临时放宽后见红，跑完还原。

## Answer

（待回填）
