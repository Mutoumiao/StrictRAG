# 回写镜像 / 覆盖表 / spec + 收口门禁

Type: task
Status: open
Blocked by: 02, 03

## 问题

把 02 / 03 的落地写回 IS 镜像与派生表，并做整图收口。

## 完成判据

- **镜像**：`docs/module-status/api.md`（ADR-046 闸那一段）· `contracts.md`（L1/L2 纯函数那段）· `worker.md`（若 L2 报告形态变了）；每处写清「哪条门今天真的参与判定、哪条仍只登记不判定、哪条无数据源」。**不写 `路径:行号`**，不给裸枚举加反引号。
- **覆盖表**：找到 L1/L2 门禁对应的分册（`docs/testing/coverage.md` 索引 → 对应分册），按**脚本机械重数**更新计数，并修任何自带的口径错。
- **spec**：`.trellis/spec/` 对应包补「硬门判定落点」条目（门限常量在哪 · 判定在哪 · 新增门限时的硬约束）。
- **对抗性反向复核**：每处回写逐条核「这话在源码里真能指到吗」。
- **收口门禁（必须在最后一次提交之后跑）**：`pnpm check-types` · `pnpm lint` · `pnpm test`（全仓）全绿；`pnpm check:module-status` 的 `1-路径` / `6-联动` / `7-时效` 三类为空；`git status --short` 干净。
- 在 `map.md` 写「目的地达成」段，并把未闭合项写进 Not yet specified 或明确划出。

## Answer

（待填）
